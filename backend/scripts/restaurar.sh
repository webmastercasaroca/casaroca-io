#!/usr/bin/env bash
# Restaura una copia EN UNA BASE APARTE y la verifica de verdad.
#
# ⛔ Restaurar sobre la base viva para "probar" es cómo se pierde una base.
#    Esto restaura en `casaroca_restaurada`, cuenta filas, corre el banco de
#    invariantes contra ella y deja el resultado con fecha y duración en
#    docs/EVIDENCIA-restauracion.txt. Eso es lo que pide la compuerta G7.
set -euo pipefail
source "$(dirname "$0")/entorno.sh"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
DESTINO="${CASAROCA_RESPALDOS:-$HOME/.casaroca-respaldos}"
BASE_PRUEBA="casaroca_restaurada"

ARCHIVO="${1:-$(ls -t "$DESTINO"/casaroca-*.dump* 2>/dev/null | head -1)}"
[[ -f "${ARCHIVO:-}" ]] || { echo "⛔ No hay copia que restaurar en $DESTINO"; exit 1; }

INICIO=$(date +%s)
echo "· restaurando $(basename "$ARCHIVO") en $BASE_PRUEBA"

TRABAJO="$ARCHIVO"
if [[ "$ARCHIVO" == *.enc ]]; then
  [[ -n "${CASAROCA_LLAVE_RESPALDO:-}" ]] || { echo "⛔ La copia está cifrada y falta CASAROCA_LLAVE_RESPALDO"; exit 1; }
  # ⛔ B5 · Se descifraba a /tmp con nombre predecible y permisos por
  #    omision: durante la restauracion, la base entera de la iglesia (datos
  #    N4 de menores, notas de consejeria) quedaba legible para cualquier
  #    proceso de la maquina.
  umask 077
  TRABAJO="$(mktemp -t casaroca-restaurar.XXXXXXXX)"
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in "$ARCHIVO" -out "$TRABAJO" -pass env:CASAROCA_LLAVE_RESPALDO
  trap 'rm -f "$TRABAJO"' EXIT
fi

psql -d postgres -q -c "DROP DATABASE IF EXISTS $BASE_PRUEBA;"
psql -d postgres -q -c "CREATE DATABASE $BASE_PRUEBA;"
# ⛔ El `|| true` descartaba A PROPOSITO cualquier error de pg_restore, pese
#    al set -e. Ahora los avisos se filtran sin tragarse el codigo de salida.
if ! pg_restore -d "$BASE_PRUEBA" --no-owner --no-privileges "$TRABAJO" 2> >(grep -v "^pg_restore: warning" >&2); then
  echo "⛔ pg_restore falló: la copia NO se puede restaurar."
  echo "RESTAURACION FALLIDA · $(date '+%Y-%m-%d %H:%M:%S %Z') · veredicto: PG_RESTORE FALLO" >> "$RAIZ/docs/EVIDENCIA-restauracion.txt"
  exit 1
fi

FIN_T=$(date +%s); DUR=$((FIN_T-INICIO))

echo "· verificando lo restaurado"
CONTEOS=$(psql -d "$BASE_PRUEBA" -qtA -c "
  SELECT 'personas='||(SELECT count(*) FROM nucleo.personas)
       ||' sedes='||(SELECT count(*) FROM org.sedes)
       ||' membresias='||(SELECT count(*) FROM nucleo.membresias_sede)
       ||' aportes='||(SELECT count(*) FROM aportes.aportes)
       ||' auditoria='||(SELECT count(*) FROM plataforma.auditoria);")

# ⛔ A5 · El script contaba filas, las escribia en la evidencia y NO AFIRMABA
#    NINGUNA. Una restauracion que dejara personas=0 sedes=0 producia
#    «veredicto: OK». Sumado a que la compuerta solo miraba el mtime, toda la
#    columna de copias era decorativa. Ahora se compara contra el ORIGEN.
VEREDICTO="OK"
ORIGEN_PERSONAS=$(psql -d "$PGDATABASE" -qtA -c "SELECT count(*) FROM nucleo.personas;" 2>/dev/null || echo 0)
ORIGEN_SEDES=$(psql -d "$PGDATABASE" -qtA -c "SELECT count(*) FROM org.sedes;" 2>/dev/null || echo 0)
REST_PERSONAS=$(psql -d "$BASE_PRUEBA" -qtA -c "SELECT count(*) FROM nucleo.personas;" 2>/dev/null || echo 0)
REST_SEDES=$(psql -d "$BASE_PRUEBA" -qtA -c "SELECT count(*) FROM org.sedes;" 2>/dev/null || echo 0)
(( REST_SEDES < 1 ))    && VEREDICTO="SIN SEDES: la restauracion esta vacia"
(( REST_PERSONAS < ORIGEN_PERSONAS )) && VEREDICTO="$VEREDICTO · FALTAN PERSONAS ($REST_PERSONAS de $ORIGEN_PERSONAS)"
(( REST_SEDES < ORIGEN_SEDES ))       && VEREDICTO="$VEREDICTO · FALTAN SEDES ($REST_SEDES de $ORIGEN_SEDES)"
psql -d "$BASE_PRUEBA" -v ON_ERROR_STOP=1 -f "$RAIZ/db/tests/catalogos_no_vacios.sql" >/dev/null 2>&1 || VEREDICTO="CATALOGOS VACIOS"
FUGAS=$(psql -d "$BASE_PRUEBA" -qtA -c "SELECT count(*) FROM plataforma.v_control_rls WHERE veredicto LIKE 'FUGA%';" 2>/dev/null || echo "?")
[[ "$FUGAS" != "0" ]] && VEREDICTO="$VEREDICTO · FUGAS=$FUGAS"

EVID="$RAIZ/docs/EVIDENCIA-restauracion.txt"
{
  echo "════════════════════════════════════════════════════"
  echo "RESTAURACION EJECUTADA · $(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo "  archivo:   $(basename "$ARCHIVO")"
  echo "  duracion:  ${DUR}s"
  echo "  conteos:   $CONTEOS"
  echo "  fugas RLS: $FUGAS"
  echo "  veredicto: $VEREDICTO"
} | tee -a "$EVID"

psql -d postgres -q -c "DROP DATABASE IF EXISTS $BASE_PRUEBA;"
echo "✔ evidencia en docs/EVIDENCIA-restauracion.txt"
[[ "$VEREDICTO" == "OK" ]] || exit 1
