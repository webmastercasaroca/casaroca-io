#!/usr/bin/env bash
# Levanta la API y le mide el domingo.
set -uo pipefail
source "$(dirname "$0")/entorno.sh"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
export APP_JWT_SECRETO="${APP_JWT_SECRETO:-secreto-de-laboratorio-solo-para-esta-prueba-000}"
export APP_LLAVE_N4="${APP_LLAVE_N4:-llave-solo-de-desarrollo}"
export PGUSER=casaroca_api_dev
# ⛔ Puerto propio y comprobado. La primera version usaba el 3000 fijo: si
#    ya habia una API viva ahi, el proceso nuevo fallaba al abrir el puerto,
#    la comprobacion de salud respondia (la vieja), y el banco corria contra
#    OTRO proceso, con su propio limite de peticiones ya gastado y su propia
#    base. Diez pruebas en rojo y ninguna era un fallo del sistema.
export PORT="${PORT:-3210}"
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "⛔ PUERTO OCUPADO: ya hay algo escuchando en :$PORT."
  echo "   Cierrelo o exporte PORT con otro puerto. No se corre contra un proceso ajeno."
  exit 1
fi
( cd "$RAIZ/api" && npm run build >/dev/null 2>&1 )
node "$RAIZ/api/dist/src/main.js" > /tmp/casaroca-carga.log 2>&1 &
API_PID=$!
trap 'kill $API_PID 2>/dev/null' EXIT
for i in $(seq 1 40); do curl -sf "http://127.0.0.1:$PORT/salud" >/dev/null 2>&1 && break; sleep 0.25; done
API_BASE="http://127.0.0.1:$PORT" node "$RAIZ/scripts/probar-carga.js" "${1:-36}" "${2:-20}"
