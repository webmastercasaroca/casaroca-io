#!/usr/bin/env bash
# =====================================================================
# Migrador de PRODUCCIÓN. Aplica SOLO lo que falta, en orden, y deja
# constancia de cada archivo en `migraciones.historial`.
#
# ⛔ No se parece a migrar.sh a propósito: aquel BORRA la base y la
#    recrea, que es lo correcto en desarrollo y una catástrofe aquí.
#    Este jamás borra nada. Si algo no cuadra, se detiene y lo dice.
#
# Uso:
#   migrar-produccion.sh                aplica lo pendiente
#   migrar-produccion.sh --plan         muestra lo pendiente y no toca nada
#   migrar-produccion.sh --sin-rol-api  no crea el rol de conexión de la API
#                                       (solo para pruebas locales)
#
# Conexión: variables estándar de libpq (PGHOST, PGPORT, PGDATABASE,
# PGUSER, PGPASSWORD). En Cloud Run, PGHOST es el socket
# /cloudsql/PROYECTO:REGION:INSTANCIA, PGPORT es 5432 y PGUSER es el
# usuario administrador de Cloud SQL (`postgres`).
#
# Rol de la API: API_DB_USUARIO (por omisión casaroca_api) y
# API_DB_PASSWORD, que llega del gestor de secretos, nunca de un archivo.
#
# Sede maestra (solo la primera vez, ver «@sede_maestra» abajo):
# SEDE_MAESTRA_CODIGO, SEDE_MAESTRA_NOMBRE, SEDE_MAESTRA_CIUDAD y
# SEDE_MAESTRA_PAIS (por omisión CO).
#
# Mismo orden que migrar.sh: todas las migraciones, luego las semillas.
# Cada archivo corre en UNA transacción junto con su registro en el
# historial: o quedan los dos, o no queda ninguno.
# =====================================================================
set -euo pipefail
# Orden de bytes, no de idioma: «0010» < «0009» no puede depender de la
# configuración regional de quien corre el script.
export LC_ALL=C

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
MIGRACIONES="${MIGRACIONES_DIR:-$RAIZ/db/migrations}"
SEMILLAS="${SEMILLAS_DIR:-$RAIZ/db/seeds}"
API_DB_USUARIO="${API_DB_USUARIO:-casaroca_api}"
# Cloud Run pone el nombre de la ejecución; queda en el historial para
# saber qué corrida aplicó cada archivo.
EJECUCION="${CLOUD_RUN_EXECUTION:-local-$(hostname)}"

# ---------------------------------------------------------------------
# Semillas: cuáles van a producción y cuáles NO.
#
# ⛔ Lista explícita, no convención de nombres. Una semilla nueva que no
#    esté en ninguna de las dos listas DETIENE el migrador. Así nadie
#    sube a producción una demostración por olvido, y nadie deja fuera
#    un catálogo real sin darse cuenta (el patrón del 15 sep: tabla bien
#    diseñada y vacía, que se ve igual que una que funciona).
#
# Producción = estructura que la base necesita para aceptar el primer
# dato real: catálogos, roles, matriz de permisos, fondos, cargos.
# Las que actúan «sobre las sedes que existan» (003 al final, 013, 015)
# no hacen nada en una base sin sedes, que es como nace producción.
# ---------------------------------------------------------------------
SEMILLAS_PRODUCCION=(
  001_catalogos.sql
  @sede_maestra
  003_consola_sistemas.sql
  005_empalme_100p.sql
  006_roles_de_segmento.sql
  007_consejeria_pastores.sql
  008_director_rocakids.sql
  009_modulos_de_las_apps.sql
  010_techo_pastor.sql
  011_pastor_principal_cabeza.sql
  012_fusion_pastor_principal.sql
  013_alcanzar_modulos_nuevos.sql
  015_catalogo_ministerios_real.sql
  016_fondos_aportes.sql
  017_cargos_talento.sql
  018_modelo_drive_100p.sql
)
# «@sede_maestra» no es un archivo: es el paso que ocupa el lugar de la
# 002 en producción. La 002 crea la sede Y una persona inventada con
# alcance N4 sobre toda la organización; aquí solo nace la sede, con los
# datos reales que da la Dirección General por variables de entorno.
# ⛔ Va en ESE lugar y no al final porque la 006 carga los segmentos en
#    la sede madre y aborta si no existe (medido el 18 sep 2026 contra
#    una base vacía), y la 003 y la 015 encienden módulos y ministerios
#    en ella. Es el mismo orden que se prueba en desarrollo.
#
# Demostración: personas inventadas, iglesias de ejemplo, la casilla
# «qué le gusta comer». Jamás en una base con datos reales.
#   002: sede maestra + un «Director General» nacido el 1970-01-01
#   004: iglesias de ejemplo creadas con sistema.crear_iglesia()
#   014: el atributo de ejemplo `comida_favorita`
SEMILLAS_DEMO=(
  002_sedes_demo.sql
  004_iglesias_demo.sql
  014_atributo_ejemplo.sql
)

PLAN=0
ROL_API=1
for a in "$@"; do
  case "$a" in
    --plan) PLAN=1 ;;
    --sin-rol-api) ROL_API=0 ;;
    *) echo "✗ opción desconocida: $a" >&2; exit 2 ;;
  esac
done

: "${PGHOST:?falta PGHOST}"
: "${PGDATABASE:?falta PGDATABASE}"
: "${PGUSER:?falta PGUSER}"

PSQL=(psql -X -q -v ON_ERROR_STOP=1)
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

huella_texto() {  # la «huella» de un paso que no es archivo
  if command -v sha256sum >/dev/null 2>&1; then printf '%s' "$1" | sha256sum | cut -d' ' -f1
  else printf '%s' "$1" | shasum -a 256 | cut -d' ' -f1; fi
}

huella() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1
  else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

en_lista() {  # en_lista <nombre> <elementos...>
  local x="$1"; shift
  local e; for e in "$@"; do [ "$e" = "$x" ] && return 0; done
  return 1
}

# ---------------------------------------------------------------------
# 0. Antes de tocar nada: versión del servidor y semillas clasificadas.
# ---------------------------------------------------------------------
version="$("${PSQL[@]}" -Atc "SELECT current_setting('server_version_num')::int")"
if [ "$version" -lt 160000 ]; then
  echo "✗ El servidor es PostgreSQL $version; las migraciones exigen 16 o superior." >&2
  exit 1
fi

sin_clasificar=0
for f in "$SEMILLAS"/*.sql; do
  n="$(basename "$f")"
  if en_lista "$n" "${SEMILLAS_PRODUCCION[@]}" && en_lista "$n" "${SEMILLAS_DEMO[@]}"; then
    echo "✗ $n está en las DOS listas. Tiene que estar en una." >&2; sin_clasificar=1
  elif ! en_lista "$n" "${SEMILLAS_PRODUCCION[@]}" && ! en_lista "$n" "${SEMILLAS_DEMO[@]}"; then
    echo "✗ Semilla sin clasificar: $n" >&2
    echo "  Añádela a SEMILLAS_PRODUCCION o a SEMILLAS_DEMO en $(basename "$0")." >&2
    sin_clasificar=1
  fi
done
for n in "${SEMILLAS_PRODUCCION[@]}"; do
  case "$n" in @*) continue ;; esac
  [ -f "$SEMILLAS/$n" ] || { echo "✗ La lista nombra $n y el archivo no existe." >&2; sin_clasificar=1; }
done
[ "$sin_clasificar" -eq 0 ] || exit 1

# ---------------------------------------------------------------------
# 1. La tabla de control. Esquema propio: la API no tiene ningún
#    permiso sobre él, así que no puede reescribir la historia.
# ---------------------------------------------------------------------
existe_control="$("${PSQL[@]}" -Atc "SELECT to_regclass('migraciones.historial') IS NOT NULL")"
if [ "$PLAN" -eq 0 ] && [ "$existe_control" != "t" ]; then
  "${PSQL[@]}" -1 <<'SQL'
CREATE SCHEMA IF NOT EXISTS migraciones;
REVOKE ALL ON SCHEMA migraciones FROM PUBLIC;
CREATE TABLE IF NOT EXISTS migraciones.historial (
  tipo        text        NOT NULL CHECK (tipo IN ('migracion','semilla')),
  archivo     text        NOT NULL,
  sha256      text        NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  aplicada_en timestamptz NOT NULL DEFAULT now(),
  aplicada_por text       NOT NULL DEFAULT current_user,
  ejecucion   text,
  PRIMARY KEY (tipo, archivo)
);
REVOKE ALL ON migraciones.historial FROM PUBLIC;
COMMENT ON TABLE migraciones.historial IS
  'Qué archivo de db/migrations y db/seeds se aplicó, cuándo y con qué huella. Lo escribe SOLO backend/scripts/migrar-produccion.sh.';
SQL
  existe_control=t
fi

# Lo ya aplicado, como «tipo|archivo|sha256», en un archivo plano
# (bash 3.2 del Mac no tiene arreglos asociativos).
: > "$TMP/aplicadas"
if [ "$existe_control" = "t" ]; then
  "${PSQL[@]}" -At -F'|' -c \
    "SELECT tipo, archivo, sha256 FROM migraciones.historial ORDER BY tipo, archivo" > "$TMP/aplicadas"
fi

# ---------------------------------------------------------------------
# 2. Qué falta. Tres reglas duras:
#    ⛔ Un archivo ya aplicado que cambió de contenido DETIENE todo. Lo
#       aplicado en producción es historia: el cambio va en un archivo
#       nuevo. (Si el cambio fue solo un comentario, el re-sellado es un
#       acto humano documentado en infra/gcp/README.md.)
#    ⛔ Un archivo pendiente que ordena ANTES del último aplicado detiene
#       todo: alguien intercaló un número y el orden ya no es el que se
#       probó en desarrollo.
#    ⛔ Un archivo registrado que ya no existe en el repositorio detiene
#       todo: el repositorio y la base dejaron de contar la misma historia.
# ---------------------------------------------------------------------
: > "$TMP/pendientes"
problemas=0
revisar() {  # revisar <tipo> <archivo>
  local tipo="$1" f="$2" n h fila ultimo
  n="$(basename "$f")"
  case "$n" in @*) h="$(huella_texto "$n")" ;; *) h="$(huella "$f")" ;; esac
  fila="$(grep -F "$tipo|$n|" "$TMP/aplicadas" || true)"
  if [ -n "$fila" ]; then
    if [ "${fila##*|}" != "$h" ]; then
      echo "✗ $n ya se aplicó y su contenido CAMBIÓ (huella distinta)." >&2
      echo "  Lo aplicado no se reescribe: el cambio va en un archivo nuevo." >&2
      problemas=1
    fi
    return 0
  fi
  # Los pasos «@» no cuentan para el orden: «@» ordena después de los
  # dígitos y haría parecer atrasada a cualquier semilla nueva.
  ultimo="$(grep "^$tipo|[0-9]" "$TMP/aplicadas" | cut -d'|' -f2 | sort | tail -n1 || true)"
  if [ -n "$ultimo" ] && [[ "$n" != @* ]] && [[ "$n" < "$ultimo" ]]; then
    echo "✗ $n está pendiente pero ordena antes de $ultimo, que ya se aplicó." >&2
    echo "  Renómbralo con un número posterior al último aplicado." >&2
    problemas=1
    return 0
  fi
  printf '%s|%s|%s\n' "$tipo" "$f" "$h" >> "$TMP/pendientes"
}

for f in "$MIGRACIONES"/*.sql; do revisar migracion "$f"; done
for n in "${SEMILLAS_PRODUCCION[@]}"; do revisar semilla "$SEMILLAS/$n"; done

while IFS='|' read -r tipo n _; do
  [ -z "$tipo" ] && continue
  case "$n" in @*) continue ;; esac
  if [ "$tipo" = migracion ]; then dir="$MIGRACIONES"; else dir="$SEMILLAS"; fi
  if [ ! -f "$dir/$n" ]; then
    echo "✗ El historial dice que se aplicó $n y el archivo ya no está en el repositorio." >&2
    problemas=1
  fi
done < "$TMP/aplicadas"

[ "$problemas" -eq 0 ] || { echo "✗ No se aplicó nada." >&2; exit 1; }

total="$(wc -l < "$TMP/pendientes" | tr -d ' ')"
if [ "$PLAN" -eq 1 ]; then
  echo "Plan contra $PGDATABASE: $total pendientes."
  while IFS='|' read -r tipo f _; do printf '  · %-9s %s\n' "$tipo" "$(basename "$f")"; done < "$TMP/pendientes"
  exit 0
fi

# ---------------------------------------------------------------------
# 3. Aplicar, un archivo por transacción.
#    El candado consultivo impide que dos ejecuciones simultáneas (dos
#    builds seguidos) apliquen el mismo archivo; la segunda espera y,
#    al entrar, ve que ya está y falla sin tocar nada.
#    ⛔ lock_timeout: una migración que espera un candado de la API no
#       se queda colgada un domingo por la mañana; falla y se reintenta.
# ---------------------------------------------------------------------
cat > "$TMP/antes.sql" <<'SQL'
\o /dev/null
SELECT pg_advisory_xact_lock(hashtext('casaroca.migraciones'));
SELECT set_config('migrador.tipo', :'tipo', true), set_config('migrador.archivo', :'archivo', true);
SET LOCAL lock_timeout = '15s';
\o
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM migraciones.historial
              WHERE tipo = current_setting('migrador.tipo')
                AND archivo = current_setting('migrador.archivo')) THEN
    RAISE EXCEPTION 'Otra ejecución ya aplicó %', current_setting('migrador.archivo');
  END IF;
END $$;
SQL
# La sede maestra: solo la sede, sin personas. Si ya existe una (creada a
# mano por la Dirección), no se toca: solo se registra el paso.
cat > "$TMP/sede_maestra.sql" <<'SQL'
INSERT INTO org.sedes (codigo, nombre, tipo, pais, ciudad, ola_migracion)
SELECT :'codigo', :'nombre', 'sede_madre', :'pais', :'ciudad', 1
WHERE NOT EXISTS (SELECT 1 FROM org.sedes WHERE tipo = 'sede_madre');
SQL
cat > "$TMP/despues.sql" <<'SQL'
INSERT INTO migraciones.historial (tipo, archivo, sha256, ejecucion)
VALUES (:'tipo', :'archivo', :'sha', :'ejecucion');
SQL

aplicadas=0
while IFS='|' read -r tipo f h; do
  n="$(basename "$f")"
  printf '  → %-9s %s\n' "$tipo" "$n"
  if [ "$n" = "@sede_maestra" ]; then
    hay="$("${PSQL[@]}" -Atc "SELECT EXISTS (SELECT 1 FROM org.sedes WHERE tipo = 'sede_madre')")"
    if [ "$hay" != t ] && { [ -z "${SEDE_MAESTRA_CODIGO:-}" ] || [ -z "${SEDE_MAESTRA_NOMBRE:-}" ] || [ -z "${SEDE_MAESTRA_CIUDAD:-}" ]; }; then
      echo "✗ La base no tiene sede maestra y las semillas que siguen la necesitan." >&2
      echo "  Define SEDE_MAESTRA_CODIGO, SEDE_MAESTRA_NOMBRE y SEDE_MAESTRA_CIUDAD con los datos" >&2
      echo "  REALES que entregue la Dirección General y vuelve a ejecutar. Nada de datos de ejemplo." >&2
      echo "  Quedaron aplicados $aplicadas de $total; seguirá desde aquí." >&2
      exit 1
    fi
    if ! "${PSQL[@]}" -1 -v tipo="$tipo" -v archivo="$n" -v sha="$h" -v ejecucion="$EJECUCION" \
         -v codigo="${SEDE_MAESTRA_CODIGO:-}" -v nombre="${SEDE_MAESTRA_NOMBRE:-}" \
         -v ciudad="${SEDE_MAESTRA_CIUDAD:-}" -v pais="${SEDE_MAESTRA_PAIS:-CO}" \
         -f "$TMP/antes.sql" -f "$TMP/sede_maestra.sql" -f "$TMP/despues.sql" < /dev/null; then
      echo "✗ Falló la creación de la sede maestra. No quedó nada a medias." >&2
      exit 1
    fi
    aplicadas=$((aplicadas + 1))
    continue
  fi
  if ! "${PSQL[@]}" -1 -v tipo="$tipo" -v archivo="$n" -v sha="$h" -v ejecucion="$EJECUCION" \
       -f "$TMP/antes.sql" -f "$f" -f "$TMP/despues.sql" < /dev/null; then
    echo "✗ Falló $n. Su transacción se revirtió: la base quedó como estaba antes de ese archivo." >&2
    echo "  Quedaron aplicados $aplicadas de $total. Corrige y vuelve a ejecutar: seguirá desde aquí." >&2
    exit 1
  fi
  aplicadas=$((aplicadas + 1))
done < "$TMP/pendientes"

# ---------------------------------------------------------------------
# 4. El rol con el que se conecta la API.
#
# ⛔ Se crea AQUÍ, con SQL, y no con Terraform ni con la consola de
#    Cloud SQL: los usuarios que crea Cloud SQL nacen dentro de
#    `cloudsqlsuperuser`, y la API NUNCA debe tener más poder que
#    `casaroca_app`. Es la misma idea que db/dev/rol_login_dev.sql, con
#    la contraseña traída del gestor de secretos.
#
# ALTER ROLE solo toca LOGIN y PASSWORD. Los atributos de poder
# (SUPERUSER, BYPASSRLS...) se fijan en el CREATE y se VERIFICAN abajo,
# porque en PostgreSQL 16 un administrador sin SUPERUSER no puede ni
# nombrarlos en un ALTER, aunque sea para negarlos.
# ---------------------------------------------------------------------
if [ "$ROL_API" -eq 1 ]; then
  : "${API_DB_PASSWORD:?falta API_DB_PASSWORD (secreto de la contraseña de la API)}"
  "${PSQL[@]}" -1 -v usuario="$API_DB_USUARIO" <<'SQL'
\getenv clave API_DB_PASSWORD
\o /dev/null
SELECT NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'usuario') AS falta \gset
SELECT set_config('migrador.usuario', :'usuario', true);
\o
\if :falta
CREATE ROLE :"usuario" LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
\endif
ALTER ROLE :"usuario" WITH LOGIN PASSWORD :'clave';
GRANT casaroca_app TO :"usuario";
DO $$
DECLARE
  v text := current_setting('migrador.usuario');
  r record;
BEGIN
  SELECT * INTO r FROM pg_roles WHERE rolname = v;
  IF r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR r.rolreplication THEN
    RAISE EXCEPTION '⛔ El rol % tiene atributos de poder (super, bypassrls, createrole, createdb o replication). La API no puede conectarse con él.', v;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cloudsqlsuperuser')
     AND pg_has_role(v, 'cloudsqlsuperuser', 'MEMBER') THEN
    RAISE EXCEPTION '⛔ El rol % es miembro de cloudsqlsuperuser: lo creó la consola o Terraform, no este script. Hay que borrarlo y dejar que el migrador lo cree.', v;
  END IF;
  IF pg_has_role(v, 'casaroca_owner', 'MEMBER') OR pg_has_role(v, 'casaroca_migrador', 'MEMBER') THEN
    RAISE EXCEPTION '⛔ El rol % hereda de casaroca_owner o casaroca_migrador: podría saltarse RLS.', v;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relowner = r.oid) THEN
    RAISE EXCEPTION '⛔ El rol % es dueño de tablas, y RLS no se aplica al dueño.', v;
  END IF;
END $$;
SQL
  echo "  ✓ rol de la API «$API_DB_USUARIO»: hereda de casaroca_app, sin BYPASSRLS, sin tablas propias"
fi

# ---------------------------------------------------------------------
# 5. ¿Se puede OPERAR con lo sembrado? db/tests/catalogos_no_vacios.sql
#    dice si algún catálogo que otra tabla exige (NOT NULL) quedó vacío.
#    Corre dentro de una transacción que se revierte: solo mira.
#
#    Es AVISO y no bloqueo a propósito: el 18 sep 2026, contra una base
#    nueva con solo las semillas de producción, salieron seis catálogos
#    vacíos (consejeria.topicos, formacion.cohortes/cursos/programas,
#    rocakids.salas, sistema.atributos). En desarrollo la prueba pasa
#    porque los llenan las pruebas del banco, no las semillas. Bloquear
#    aquí dejaría la maqueta (fase 0) sin desplegar por algo que no se
#    arregla en la infraestructura sino en db/seeds/.
# ---------------------------------------------------------------------
PRUEBA_CATALOGOS="${PRUEBA_CATALOGOS:-$RAIZ/db/tests/catalogos_no_vacios.sql}"
if [ -f "$PRUEBA_CATALOGOS" ]; then
  if { echo "BEGIN;"; cat "$PRUEBA_CATALOGOS"; echo; echo "ROLLBACK;"; } \
       | "${PSQL[@]}" > "$TMP/catalogos.log" 2>&1; then
    echo "  ✓ catálogos bloqueantes: todos con contenido"
  else
    echo "  ⚠ AVISO: hay catálogos bloqueantes vacíos. La base migró, pero hay operaciones imposibles:" >&2
    grep '·' "$TMP/catalogos.log" >&2 || cat "$TMP/catalogos.log" >&2
  fi
fi

echo "✓ $aplicadas archivos aplicados sobre $PGDATABASE. La base está al día."
