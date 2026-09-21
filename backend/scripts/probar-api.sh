#!/usr/bin/env bash
# =====================================================================
# Prueba de humo de la API. Comprueba lo que de verdad importa:
# que el MISMO endpoint conteste distinto según quién pregunte, y que
# el dinero solo se mueva con firma válida.
#
# Requiere la API corriendo (scripts/arrancar-api.sh) y la base sembrada.
# =====================================================================
set -uo pipefail
source "$(dirname "$0")/entorno.sh"
# ⛔ levantar_api exporta PGUSER=casaroca_api_dev (el rol de la aplicacion, con
#    RLS). Las consultas de PREPARACION del banco (buscar a quien suplantar,
#    sembrar un caso) son de administrador: se guarda el usuario de antes.
ADMIN="${PGUSER:-$(whoami)}"
psql_admin() { PGUSER="$ADMIN" psql "$@"; }
source "$(dirname "$0")/api-de-laboratorio.sh"
levantar_api "${PORT:-3211}"

# ⛔ 19 sep 2026 · ESTE BANCO ESTABA MUERTO. Se identificaba con la cabecera
#    `X-Persona-Id`, que se elimino al cerrar el hallazgo H-01, y NO estaba
#    en verificar.sh: si hubiera corrido habria fallado entero, y los README
#    seguian afirmando su resultado. Ahora entra por la puerta de verdad.
tok() { PGUSER="$ADMIN" node "$(dirname "$0")/token-para.js" "$1"; }


H='Content-Type: application/json'
ok=0; fallo=0
comprobar() { # nombre, esperado, obtenido
  if [ "$2" = "$3" ]; then printf '  ✅ %-52s %s\n' "$1" "$3"; ok=$((ok+1));
  else printf '  🔴 %-52s esperaba %s y dio %s\n' "$1" "$2" "$3"; fallo=$((fallo+1)); fi
}

DG=$(psql_admin -d "$PGDATABASE" -qAt -c "SELECT persona_id FROM identidad.asignaciones WHERE alcance_tipo='organizacion' LIMIT 1")
# ⛔ 19 sep 2026 · Aqui habia un `if [ -n "$LID" ]` que se saltaba en
#    silencio las DOS comprobaciones de alcance restringido si no existia
#    ningun LIDER_GRUPO: el banco imprimia verde sin haber probado lo unico
#    que de verdad importa (que un lider NO ve toda la red). Y no existia
#    ninguno. Ahora el lider de laboratorio SE CREA, y si no se puede crear
#    el banco se para.
psql_admin -d "$PGDATABASE" -qAt >/dev/null <<'SQL'
DO $lab$
DECLARE v_grupo uuid; v_sede uuid; v_persona uuid;
        sx text := substr(md5(clock_timestamp()::text),1,8);
BEGIN
  -- ⛔ La primera version buscaba «un grupo cualquiera» y «una persona
  --    cualquiera de esa sede», las dos con LIMIT 1 sin orden. Dos
  --    corridas seguidas elegian cosas distintas, y la persona elegida
  --    podia tener ya asignaciones en OTRA sede: la comprobacion «un
  --    lider ve UNA iglesia» daba 2 y parecia una fuga de permisos.
  --    El sujeto de la prueba se CREA entero, y es solo suyo.
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-CHICO';
  IF v_sede IS NULL THEN SELECT id INTO v_sede FROM org.sedes ORDER BY codigo LIMIT 1; END IF;

  INSERT INTO grupos.grupos (sede_id, tipo, nombre)
  VALUES (v_sede,'pequeno','Grupo de laboratorio banco-api '||sx)
  RETURNING id INTO v_grupo;

  INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido, fecha_nacimiento)
  VALUES (v_sede,'Lider','BancoApi '||sx,'1990-05-05')
  RETURNING id INTO v_persona;

  INSERT INTO identidad.asignaciones
    (persona_id, rol, alcance_tipo, alcance_id, nivel_max, acta_referencia)
  VALUES (v_persona,'LIDER_GRUPO','grupo',v_grupo,2,'laboratorio: banco probar-api.sh');
END $lab$;
SQL

LID=$(psql_admin -d "$PGDATABASE" -qAt -c "SELECT persona_id FROM identidad.asignaciones WHERE acta_referencia='laboratorio: banco probar-api.sh' AND revocada_en IS NULL ORDER BY creado_en DESC LIMIT 1")
if [ -z "$LID" ]; then echo "⛔ sin lider de laboratorio: el banco NO puede probar el alcance restringido"; exit 1; fi

# Un token por persona de prueba (DESPUES de resolver las personas).
TOK_DG="$(tok "$DG")"
TOK_LID="$(tok "$LID")"

echo "── alcance: el mismo endpoint, dos personas"
comprobar "Dirección General ve toda la red" "true" \
  "$(curl -s -H "Authorization: Bearer $TOK_DG" $A/sesion/yo | python3 -c 'import json,sys;print(str(json.load(sys.stdin)["alcance"]["todaLaRed"]).lower())')"
  comprobar "Un líder NO ve toda la red" "false" \
    "$(curl -s -H "Authorization: Bearer $TOK_LID" $A/sesion/yo | python3 -c 'import json,sys;print(str(json.load(sys.stdin)["alcance"]["todaLaRed"]).lower())')"
  comprobar "Un líder ve UNA iglesia" "1" \
  "$(curl -s -H "Authorization: Bearer $TOK_LID" $A/organizacion/sedes | python3 -c 'import json,sys;print(len(json.load(sys.stdin)))')"
comprobar "Sin identidad la API no contesta" "401" \
  "$(curl -s -o /dev/null -w '%{http_code}' $A/sesion/yo)"

echo "── catálogos"
comprobar "Ministerios del catálogo" "27" \
  "$(curl -s -H "Authorization: Bearer $TOK_DG" $A/organizacion/ministerios | python3 -c 'import json,sys;print(len(json.load(sys.stdin)))')"

echo "── pasarela: el dinero solo se mueve con firma"
REF="HUMO-$(date +%s)"
psql_admin -d "$PGDATABASE" -qAt -c "
INSERT INTO aportes.pasarela_transacciones (referencia,sede_id,tipo,fondo_id,monto,pagador_nombre)
SELECT '$REF',(SELECT id FROM org.sedes LIMIT 1),'diezmo',
       (SELECT id FROM aportes.fondos WHERE codigo='DIEZMOS'),100000,'Humo';" >/dev/null
CUERPO="{\"reference_sale\":\"$REF\",\"state_pol\":\"4\",\"TX_VALUE\":\"100000.00\",\"currency\":\"COP\",\"transaction_id\":\"HUMO-TX\",\"sign\":\"invalida\"}"
comprobar "Firma inválida NO mueve dinero" "firma_invalida" \
  "$(curl -s -X POST -H 'Content-Type: application/json' -d "$CUERPO" $A/aportes/pasarela/webhook | python3 -c 'import json,sys;print(json.load(sys.stdin).get("motivo",""))')"
comprobar "…pero el aviso queda guardado como prueba" "1" \
  "$(psql_admin -d "$PGDATABASE" -qAt -c "SELECT count(*) FROM aportes.pasarela_eventos WHERE referencia='$REF'")"

echo "── derechos del titular (Ley 1581), que no tenian ni una ruta"
# ⛔ 20 sep 2026 · Toda esta maquinaria existia en la base desde la
#    migracion 0053 y era inalcanzable salvo con psql. Un derecho que solo
#    puede ejercer quien sabe SQL no es un derecho.
PET=$(curl -s -X POST -H "$H" -H "Authorization: Bearer $TOK_DG" \
  -d '{"tipo":"consulta","canal":"correo","titularNombre":"Banco Prueba Titular","titularContacto":"banco@example.org","detalle":"Quiero saber que datos mios tiene la iglesia y con que finalidad."}' \
  $A/cumplimiento/peticiones)
PET_ID=$(echo "$PET" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("id",""))')
comprobar "Radicar deja radicado y fecha de vencimiento" "si" \
  "$(echo "$PET" | python3 -c 'import json,sys;d=json.load(sys.stdin);print("si" if d.get("radicado","").startswith("HD-") and len(d.get("vence_en",""))==10 else "no")')"
comprobar "La bandeja avisa de las vencidas" "si" \
  "$(curl -s -H "Authorization: Bearer $TOK_DG" "$A/cumplimiento/peticiones?limite=5" | python3 -c 'import json,sys;d=json.load(sys.stdin);print("si" if "vencidas" in d and "aviso" in d else "no")')"
comprobar "Prorrogar sin motivo de verdad se rechaza" "400" \
  "$(curl -s -o /dev/null -w '%{http_code}' -X POST -H "$H" -H "Authorization: Bearer $TOK_DG" -d '{"motivo":"porque si"}' $A/cumplimiento/peticiones/$PET_ID/prorrogar)"
comprobar "Suprimir sin confirmacion explicita se rechaza" "400" \
  "$(curl -s -o /dev/null -w '%{http_code}' -X POST -H "$H" -H "Authorization: Bearer $TOK_DG" -d '{"confirmacion":"si"}' $A/cumplimiento/peticiones/$PET_ID/suprimir)"
comprobar "Responder cierra y dice si fue dentro del plazo" "atendida" \
  "$(curl -s -X POST -H "$H" -H "Authorization: Bearer $TOK_DG" -d '{"respuesta":"Se le envia el listado de sus datos y las finalidades declaradas."}' $A/cumplimiento/peticiones/$PET_ID/responder | python3 -c 'import json,sys;print(json.load(sys.stdin).get("estado",""))')"
comprobar "Un lider (N2) lee las peticiones de Habeas Data" "403" \
  "$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOK_LID" $A/cumplimiento/peticiones)"

echo
printf '  %s pasan · %s fallan\n' "$ok" "$fallo"
[ "$fallo" -eq 0 ] || exit 1
