#!/usr/bin/env bash
# LA COMPUERTA. Lo que tiene que estar en verde para entregar, desplegar o
# fusionar. Es lo que corre la integración continua, y es lo mismo que puede
# correr cualquiera en su máquina antes de pedir revisión.
set -uo pipefail
source "$(dirname "$0")/entorno.sh"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"

fallos=(); ok() { echo "  ✔ $1"; }; mal() { echo "  ✖ $1"; fallos+=("$1"); }

echo "══ 1 · La base se levanta desde cero"
if ! "$RAIZ/scripts/arrancar.sh" >/dev/null 2>&1; then
  mal "PostgreSQL no levanta: todo lo demás va a dar resultados sin sentido"
fi
if "$RAIZ/scripts/migrar.sh" >/tmp/cr-migrar.log 2>&1; then ok "migraciones y semillas aplicadas en base limpia"
else mal "la migración desde cero falla (ver /tmp/cr-migrar.log)"; fi

echo "══ 2 · Invariantes de la base"
if "$RAIZ/scripts/probar.sh" --rapido >/tmp/cr-probar.log 2>&1; then
  ok "$(grep -o 'TODOS LOS BANCOS EN VERDE.*' /tmp/cr-probar.log | head -1)"
else mal "hay bancos en rojo: $(grep -o 'BANCOS EN ROJO:.*' /tmp/cr-probar.log | head -1)"; fi

echo "══ 3 · La API compila"
if ( cd "$RAIZ/api" && npm run build >/tmp/cr-build.log 2>&1 ); then ok "compila sin errores de tipo"
else mal "la API no compila (ver /tmp/cr-build.log)"; fi

echo "══ 4 · Autenticación de punta a punta"
if "$RAIZ/scripts/probar-auth.sh" >/tmp/cr-auth.log 2>&1; then
  ok "$(grep -o 'pasan: [0-9]* · fallan: [0-9]*.*' /tmp/cr-auth.log | head -1)"
else mal "la autenticación tiene invariantes rotas (ver /tmp/cr-auth.log)"; fi

echo "══ 4b · Los tres bancos de la API (revividos el 19 sep 2026)"
# ⛔ Estos tres estaban MUERTOS: se identificaban con la cabecera
#    `X-Persona-Id`, eliminada al cerrar el hallazgo H-01, y NO estaban en
#    esta compuerta. 42 comprobaciones que no corrian y que los README
#    daban por buenas. Al revivirlos aparecieron dos fallos reales de
#    produccion: toda donacion devolvia 500 (cast a un enum borrado) y
#    convertir en miembro a quien no autorizo correo era imposible.
for banco in probar-api probar-api-drive; do
  if "$RAIZ/scripts/$banco.sh" >"/tmp/cr-$banco.log" 2>&1; then
    ok "$banco: $(grep -o '[0-9]* pasan · [0-9]* fallan' "/tmp/cr-$banco.log" | tail -1)"
  else mal "$banco en rojo (ver /tmp/cr-$banco.log)"; fi
done
if ( cd "$RAIZ/api" && npm run probar >/tmp/cr-e2e.log 2>&1 ); then
  ok "extremo a extremo de Nuevos: $(grep -oE '^ [0-9]+ *\| [0-9]+ *\| [0-9]+' /tmp/cr-e2e.log | tail -1 | tr -s ' ')"
else mal "el banco de extremo a extremo esta en rojo (ver /tmp/cr-e2e.log)"; fi

echo "══ 4d · Los conectores de la consola llegan a la base"
# ⛔ 20 sep 2026. Este banco existe porque la consola otorgaba un rol
#    mandando `actaReferencia` mientras la API leia `acta`: la peticion
#    devolvia 200, el rol quedaba otorgado y el acta que lo autoriza se
#    perdia EN SILENCIO. Ningun banco que mire el codigo de respuesta lo
#    habria visto. Este manda EXACTAMENTE el cuerpo que manda la consola
#    y despues le PREGUNTA A LA BASE si el dato llego. Ese mismo dia
#    destapo otros cuatro: el tipo de documento no existia como lista,
#    guardar un rol borraba su descripcion, editar un rol descontinuado
#    lo resucitaba solo, y REVOCAR UN ROL NO FUNCIONABA (sin politica de
#    UPDATE, el RLS dejaba el update en cero filas sin dar error).
if "$RAIZ/api/test/conectores.sh" >/tmp/cr-conectores.log 2>&1; then
  ok "conectores: $(grep -o 'CONECTORES: [0-9]* de [0-9]*' /tmp/cr-conectores.log | tail -1)"
else mal "hay conectores rotos entre la consola y la base (ver /tmp/cr-conectores.log)"; fi

echo "══ 4c · Ningun cast de la API apunta a un tipo que ya no existe"
# ⛔ El 19 de septiembre TODA donacion devolvia 500 porque el codigo seguia
#    escribiendo `$4::aportes.tipo_aporte`, un enum que la migracion 0046
#    convirtio en catalogo editable y BORRO. TypeScript no ve dentro de una
#    cadena de SQL: nadie se entero hasta revivir el banco. Esta compuerta
#    lo ve en un segundo.
muertos=""
for t in $(python3 "$RAIZ/scripts/tipos-citados.py" "$RAIZ/api/src"); do
  n=$(psql -d "$PGDATABASE" -qAt -c "SELECT count(*) FROM pg_type y JOIN pg_namespace m ON m.oid=y.typnamespace WHERE m.nspname||'.'||y.typname = '$t'" 2>/dev/null)
  [ "${n:-0}" = "0" ] && muertos="$muertos $t"
done
if [ -z "$muertos" ]; then ok "todos los tipos citados por la API existen en la base"
else mal "la API escribe a tipos BORRADOS:$muertos"; fi

echo "══ 5 · La especificación no se ha quedado atrás"
# ⛔ La version anterior regeneraba el archivo SOBRE SI MISMO y luego
#    comparaba: la primera corrida marcaba rojo pero YA lo habia
#    sobrescrito, asi que la segunda comparaba el archivo consigo mismo y
#    daba verde. La compuerta no podia quedarse en rojo, y ensuciaba el
#    arbol de trabajo. Ahora se genera a un temporal y NO se toca el
#    versionado.
TMP_SPEC="$(mktemp -d)"
if OPENAPI_SALIDA="$TMP_SPEC/openapi.yaml" node "$RAIZ/scripts/generar-openapi.js" >/tmp/cr-openapi.log 2>&1; then
  if diff -q "$RAIZ/api/openapi.yaml" "$TMP_SPEC/openapi.yaml" >/dev/null 2>&1; then
    ok "openapi.yaml al día con las rutas reales"
  else mal "openapi.yaml desactualizado: corra scripts/generar-openapi.js y versione el resultado"; fi
  sin=$(grep -c 'no tiene descripcion' "$TMP_SPEC/openapi.yaml" || true)
  [[ "$sin" == "0" ]] && ok "todas las rutas descritas" || mal "$sin ruta(s) sin descripción en la especificación"
else mal "no se pudo generar la especificación"; fi
rm -rf "$TMP_SPEC"

echo "══ 6 · Secretos fuera del repositorio"
# ⛔ 20 sep 2026 · Esto era una linea de `grep` con cuatro puntos ciegos:
#    solo miraba `backend/` (no `infra/` ni `.github/`), exigia `NOMBRE =`
#    y por tanto no veia el YAML, aplicaba la lista blanca a la LINEA
#    entera (un comentario con la palabra «ejemplo» absolvia al secreto de
#    al lado) y solo conocia cuatro nombres. Ahora es un guion que mira
#    TODO el repositorio y tambien por la FORMA del secreto (clave privada,
#    llave de Google, token de GitHub, cadena de conexion con contraseña).
if salida=$(python3 "$RAIZ/scripts/buscar-secretos.py" "$RAIZ/.." 2>&1); then
  ok "$salida"
else
  echo "$salida" | sed 's/^/    /'
  mal "hay algo que parece un secreto escrito en el repositorio"
fi

echo "══ 7 · Ninguna tabla legible sin política"
FUGAS=$(psql -d "$PGDATABASE" -qtA -c "SELECT count(*) FROM plataforma.v_control_rls WHERE veredicto LIKE 'FUGA%';" 2>/dev/null || echo '?')
[[ "$FUGAS" == "0" ]] && ok "0 fugas de lectura" || mal "$FUGAS tabla(s) legibles sin política ni registro"

echo "══ 8 · Particiones con colchón"
# ⛔ La version anterior caia en la rama OK cuando psql fallaba (base
#    apagada, vista borrada): EST valia '?' y la condicion era falsa, asi
#    que imprimia «particiones: ?» EN VERDE. La compuerta premiaba el fallo.
#    Ahora se exige que TODAS digan BIEN; cualquier otra cosa es rojo.
MAL=$(psql -d "$PGDATABASE" -qtA -c \
  "SELECT count(*) FROM plataforma.v_salud_particiones WHERE estado <> 'BIEN';" 2>/dev/null || echo 'x')
TOT=$(psql -d "$PGDATABASE" -qtA -c "SELECT count(*) FROM plataforma.v_salud_particiones;" 2>/dev/null || echo '0')
if [[ "$MAL" == "0" && "$TOT" -gt 0 ]]; then
  ok "particiones: $TOT tablas, todas con colchón"
else
  mal "particiones: no se pudo verificar o hay tablas fuera de BIEN (mal=$MAL total=$TOT)"
fi
# Y el punto ciego que los paneles no miraban.
PART=$(psql -d "$PGDATABASE" -qtA -c \
  "SELECT count(*) FROM plataforma.v_control_particiones WHERE veredicto <> 'BIEN';" 2>/dev/null || echo 'x')
[[ "$PART" == "0" ]] && ok "ninguna partición legible saltándose su madre" \
                     || mal "control de particiones: $PART objeto(s) fuera de BIEN"

echo "══ 8b · La infraestructura escrita es válida"
# ⛔ 19 sep 2026 · El Terraform se daba por bueno sin haberlo pasado nunca
#    por `validate`: en este Mac no estaba instalado. Se instalo y aparecio
#    lo que tenia que aparecer (el backend de estado comentado, la sonda
#    externa que no existia, la sonda de arranque por puerto). Si la
#    herramienta no esta, la compuerta lo DICE en vez de callarse: un
#    silencio parece verde.
TF="$(command -v terraform || command -v tofu || echo /tmp/tfbin/terraform)"
if [ -x "$TF" ]; then
  if ( cd "$RAIZ/../infra/gcp" && "$TF" init -backend=false >/dev/null 2>&1 \
       && "$TF" validate >/tmp/cr-tf.log 2>&1 \
       && "$TF" fmt -check -recursive >>/tmp/cr-tf.log 2>&1 \
       && "$TF" test >>/tmp/cr-tf.log 2>&1 ); then
    ok "terraform: válido, formateado y $(grep -oE '[0-9]+ passed' /tmp/cr-tf.log | tail -1)"
  else mal "el Terraform no valida (ver /tmp/cr-tf.log)"; fi
else
  echo "  ⚠ terraform no está instalado: la infraestructura NO se verificó en esta corrida"
fi

echo "══ 9 · La restauración se ejecutó de verdad"
# ⛔ La version anterior miraba que el archivo EXISTIERA y que su fecha de
#    modificacion fuera reciente. Nunca leia el veredicto. Una restauracion
#    con «CATALOGOS VACIOS» o «FUGAS=3» dejaba su rastro y ponia la
#    compuerta en verde. Y un `touch` la dejaba verde 45 dias sin haber
#    restaurado nada. Ahora se lee el CONTENIDO: fecha y veredicto.
EVID="$RAIZ/docs/EVIDENCIA-restauracion.txt"
if [[ ! -f "$EVID" ]]; then
  mal "no hay evidencia de restauración: corra scripts/respaldar.sh y scripts/restaurar.sh"
else
  ULT_FECHA=$(grep 'RESTAURACION EJECUTADA' "$EVID" | tail -1 | sed 's/^RESTAURACION EJECUTADA · //' | cut -d' ' -f1)
  ULT_VER=$(grep 'veredicto:' "$EVID" | tail -1 | sed 's/.*veredicto: *//')
  DIAS=$(( ( $(date +%s) - $(date -j -f "%Y-%m-%d" "${ULT_FECHA:-1970-01-01}" +%s 2>/dev/null || echo 0) ) / 86400 ))
  if [[ "$ULT_VER" != "OK" ]]; then
    mal "la última restauración terminó con veredicto «${ULT_VER:-desconocido}», no OK"
  elif (( DIAS > 45 )); then
    mal "la última restauración fue hace $DIAS días (tope 45)"
  else
    ok "restauración con veredicto OK hace $DIAS día(s) · $ULT_FECHA"
  fi
fi

echo
echo "════════════════════════════════════════════════════════"
if [[ ${#fallos[@]} -eq 0 ]]; then
  echo "  VERIFICACIÓN COMPLETA EN VERDE · se puede entregar"
  echo "════════════════════════════════════════════════════════"; exit 0
else
  echo "  ${#fallos[@]} COMPUERTA(S) EN ROJO:"
  for f in "${fallos[@]}"; do echo "    · $f"; done
  echo "  No se entrega, no se fusiona y no se despliega."
  echo "════════════════════════════════════════════════════════"; exit 1
fi
