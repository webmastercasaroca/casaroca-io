#!/usr/bin/env bash
# =====================================================================
# Prueba de humo de lo que pide el Drive «Sistema 100p» (migración 0040),
# por HTTP, contra la API corriendo (scripts/arrancar-api.sh).
#
# Lo que demuestra: que las rutas del documento de Nuevos y el flujo de
# Donaciones funcionan con los permisos del documento de Roles, y que el
# modelo del Drive respeta la sede de quien pregunta.
# Crea sus propias personas y roles (sufijo aleatorio): se puede repetir.
# =====================================================================
set -uo pipefail
source "$(dirname "$0")/entorno.sh"
# ⛔ levantar_api exporta PGUSER=casaroca_api_dev (el rol de la aplicacion, con
#    RLS). Las consultas de PREPARACION del banco (buscar a quien suplantar,
#    sembrar un caso) son de administrador: se guarda el usuario de antes.
ADMIN="${PGUSER:-$(whoami)}"
psql_admin() { PGUSER="$ADMIN" psql "$@"; }
source "$(dirname "$0")/api-de-laboratorio.sh"
levantar_api "${PORT:-3212}"

# ⛔ 19 sep 2026 · ESTE BANCO ESTABA MUERTO. Se identificaba con la cabecera
#    `X-Persona-Id`, que se elimino al cerrar el hallazgo H-01, y NO estaba
#    en verificar.sh: si hubiera corrido habria fallado entero, y los README
#    seguian afirmando su resultado. Ahora entra por la puerta de verdad.
tok() { PGUSER="$ADMIN" node "$(dirname "$0")/token-para.js" "$1"; }


ok=0; fallo=0
comprobar() { # nombre, esperado, obtenido
  if [ "$2" = "$3" ]; then printf '  ✅ %-58s %s\n' "$1" "$3"; ok=$((ok+1));
  else printf '  🔴 %-58s esperaba %s y dio %s\n' "$1" "$2" "$3"; fallo=$((fallo+1)); fi
}
sql() { psql_admin -d "$PGDATABASE" -qAt -c "$1"; }
campo() { python3 -c "import json,sys;d=json.load(sys.stdin);print(d$1)" 2>/dev/null; }
codigo() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
SX=$(date +%s | tail -c 6)

# ── Elenco: una tesorera, un digitador y una persona N2, en Panamá ─────
PTY=$(sql "SELECT id FROM org.sedes WHERE codigo='PTY'")
nueva() { sql "INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento) VALUES ('$PTY','$1','Prueba$SX',DATE '1985-01-01') RETURNING id"; }
TES=$(nueva Tesorera); DIG=$(nueva Digitador); N2=$(nueva Secretaria); DON=$(nueva Donante)
sql "INSERT INTO identidad.asignaciones (persona_id,rol,alcance_tipo,alcance_id,nivel_max,vigente_desde) VALUES
     ('$TES','TESORERIA','sede','$PTY',3,CURRENT_DATE),
     ('$DIG','DIGITADOR_APORTES','sede','$PTY',3,CURRENT_DATE),
     ('$N2','SECRETARIA','sede','$PTY',2,CURRENT_DATE)" >/dev/null
H='Content-Type: application/json'

echo "── Nuevos (documento M-Nuevos)"
R=$(curl -s -X POST -H "$H" -d "{\"sede\":\"PTY\",\"nombre\":\"Nuevo Drive $SX\",\"email\":\"nuevo.$SX@example.org\",\"como_supo\":\"amigo\",\"es_cristiano\":\"duda\"}" $A/nuevos/registrar)
NID=$(echo "$R" | campo "['id']")
comprobar "Registro devuelve contacto_esperado (hoy + 1)" "$(date -v+1d +%F)" "$(echo "$R" | campo "['contacto_esperado']" | cut -c1-10)"
comprobar "…y encola la bienvenida" "1" \
  "$(sql "SELECT count(*) FROM plataforma.notificaciones WHERE origen_id='$NID' AND plantilla='Bienvenida_nuevo'")"
PASTOR=$(sql "SELECT a.persona_id FROM identidad.asignaciones a WHERE a.rol='PASTOR_CONGREGACIONAL' AND a.alcance_id='$PTY' LIMIT 1")

# Un token por persona de prueba (DESPUES de resolver las personas).
TOK_DIG="$(tok "$DIG")"
TOK_N2="$(tok "$N2")"
TOK_PASTOR="$(tok "$PASTOR")"
TOK_TES="$(tok "$TES")"
# Un N4 de ESTA sede: el volcado del modelo exige el nivel de su columna
# mas sensible, y la comprobacion de sede necesita a alguien que pueda verlo.
N4P=$(psql_admin -d "$PGDATABASE" -qAt <<SQL
WITH nueva AS (
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES ('$PTY','DirectorN4','Prueba$SX',DATE '1980-01-01') RETURNING id),
 asig AS (
  INSERT INTO identidad.asignaciones (persona_id,rol,alcance_tipo,alcance_id,nivel_max,acta_referencia)
  SELECT id,'PASTOR_CONGREGACIONAL','sede','$PTY',4,'laboratorio: banco drive' FROM nueva RETURNING persona_id)
SELECT persona_id FROM asig
SQL
)
TOK_PASTOR_N4="$(tok "$N4P")"
comprobar "Contacto con nota privada" "201" \
  "$(codigo -X POST -H "$H" -H "Authorization: Bearer $TOK_PASTOR" -d '{"tipo_contacto":"llamada","resumen":"Primera llamada","reaccion":"interesado","notas":"Solo para el coordinador"}' $A/nuevos/$NID/registrar-contacto)"
comprobar "…la nota queda en su tabla privada" "1" "$(sql "SELECT count(*) FROM crm.notas_privadas_nuevos WHERE nuevo_id='$NID'")"
GRUPO=$(sql "INSERT INTO grupos.grupos (sede_id,tipo,nombre) VALUES ('$PTY','pequeno','Crecimiento $SX') RETURNING id")
R=$(curl -s -X POST -H "$H" -H "Authorization: Bearer $TOK_PASTOR" -d "{\"grupo_id\":\"$GRUPO\",\"padrino_id\":\"$PASTOR\",\"notas\":\"Decidió\"}" $A/nuevos/$NID/convertir-miembro)
comprobar "Convertir con grupo y padrino" "Crecimiento $SX" "$(echo "$R" | campo "['grupo_asignado']")"
comprobar "Dashboard ordena por prioridad" "200" \
  "$(codigo -H "Authorization: Bearer $TOK_PASTOR" "$A/nuevos/dashboard?ordenar_por=prioridad&sede_id=$PTY")"

echo "── Donaciones (documento M-Donaciones + Roles)"
R=$(curl -s -X POST -H "$H" -H "Authorization: Bearer $TOK_DIG" -d "{\"persona_id\":\"$DON\",\"tipo_aporte\":\"DIEZMO\",\"monto\":100000,\"metodo_pago\":\"TRANSFERENCIA\",\"referencia\":\"TRX-$SX\",\"fecha_aporte\":\"2026-07-30\"}" $A/aportes)
AID=$(echo "$R" | campo "['id']")
comprobar "El digitador registra una donación" "REGISTRADO" "$(echo "$R" | campo "['estado']")"
comprobar "…pero NO la aprueba (APROBAR_APORTE)" "403" "$(codigo -X POST -H "Authorization: Bearer $TOK_DIG" $A/aportes/$AID/confirmar)"
comprobar "La tesorera la aprueba" "201" "$(codigo -X POST -H "Authorization: Bearer $TOK_TES" $A/aportes/$AID/confirmar)"
R=$(curl -s -X POST -H "$H" -H "Authorization: Bearer $TOK_TES" -d "{\"persona_id\":\"$DON\",\"tipo_aporte\":\"DONACION\",\"monto\":50000,\"metodo_pago\":\"CONSIGNACION\",\"fecha_aporte\":\"2026-08-15\"}" $A/aportes)
A2=$(echo "$R" | campo "['id']")
comprobar "Valores nuevos del Drive (DONACION, CONSIGNACION)" "REGISTRADO" "$(echo "$R" | campo "['estado']")"
comprobar "Nadie aprueba lo que él mismo digitó" "409" "$(codigo -X POST -H "Authorization: Bearer $TOK_TES" $A/aportes/$A2/confirmar)"
comprobar "Consulta de Tesorería por año y tipo" "1" \
  "$(curl -s -H "Authorization: Bearer $TOK_TES" "$A/aportes?anio=2026&tipo=diezmo&persona_id=$DON" | campo "['total_filas']")"
R=$(curl -s -X POST -H "$H" -H "Authorization: Bearer $TOK_TES" -d "{\"persona_id\":\"$DON\",\"anio\":2026}" $A/aportes/certificados)
CID=$(echo "$R" | campo "['id']")
comprobar "Certificado expedido con su total" "150000.00" "$(echo "$R" | campo "['total_certificado']")"
comprobar "…y su url_pdf apunta al documento" "/api/v1/aportes/certificados/$CID/documento" "$(echo "$R" | campo "['url_pdf']")"
comprobar "El documento imprimible lleva el número" "si" \
  "$(curl -s -H "Authorization: Bearer $TOK_TES" $A/aportes/certificados/$CID/documento | grep -q "$(echo "$R" | campo "['numero_certificado']")" && echo si || echo no)"
comprobar "Una sesión N2 no lee el certificado" "403" "$(codigo -H "Authorization: Bearer $TOK_N2" $A/aportes/certificados/$CID)"
comprobar "Anular sin motivo se rechaza" "400" "$(codigo -X POST -H "$H" -H "Authorization: Bearer $TOK_TES" -d '{}' $A/aportes/certificados/$CID/anular)"
comprobar "Anular con motivo libera los 2 aportes" "2" \
  "$(curl -s -X POST -H "$H" -H "Authorization: Bearer $TOK_TES" -d '{"motivo":"Faltaba un aporte"}' $A/aportes/certificados/$CID/anular | campo "['aportes_liberados']")"

echo "── Personas y modelo del Drive"
comprobar "Actualizar campos del Drive (zona, es_cristiano)" "Zona Norte" \
  "$(curl -s -X PUT -H "$H" -H "Authorization: Bearer $TOK_TES" -d '{"zona":"Zona Norte","es_cristiano":"si","es_ministro":false}' $A/personas/$DON | campo "['zona']")"
# ⛔ 20 sep 2026 · Esta ruta devuelve TODAS las columnas (`SELECT *`),
#    incluidas salud, menores y consejeria. La RLS acotaba la sede pero
#    NADIE acotaba la sensibilidad: una sesion N1 podia pedir
#    /modelo100p/menores y llevarse el volcado entero de su sede. Ahora
#    cada tabla exige el nivel de su columna mas sensible.
#    La tesorera es N3 y `personas` exige N4: se le niega, y esa negativa
#    es justamente la garantia nueva.
comprobar "Una sesion N3 se lleva el volcado con todas las columnas" "403" \
  "$(codigo -H "Authorization: Bearer $TOK_TES" "$A/modelo100p/personas?limite=5")"
comprobar "…y la negativa dice que hay rutas curadas" "si" \
  "$(curl -s -H "Authorization: Bearer $TOK_TES" "$A/modelo100p/personas?limite=5" | python3 -c "import json,sys;print('si' if 'curadas' in json.load(sys.stdin).get('mensaje','') else 'no')")"
comprobar "modelo100p/personas solo trae su sede (con N4)" "True" \
  "$(curl -s -H "Authorization: Bearer $TOK_PASTOR_N4" "$A/modelo100p/personas?limite=1000" | python3 -c "import json,sys;d=json.load(sys.stdin)['datos'];print(len(d)>0 and all(x['sede_id']=='$PTY' for x in d))")"
comprobar "Tabla fuera del modelo se rechaza" "400" "$(codigo -H "Authorization: Bearer $TOK_TES" $A/modelo100p/pg_authid)"
comprobar "El trabajador de avisos exige su token" "503" "$(codigo -X POST $A/notificaciones/procesar)"

echo
printf '  %s pasan · %s fallan\n' "$ok" "$fallo"
[ "$fallo" -eq 0 ] || exit 1
