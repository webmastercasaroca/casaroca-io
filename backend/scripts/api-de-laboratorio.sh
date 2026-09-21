#!/usr/bin/env bash
# =====================================================================
# API DE LABORATORIO · arranque compartido de los bancos de la API
#
# ⛔ 19 sep 2026. Los tres bancos de la API (probar-api.sh,
#    probar-api-drive.sh y api/test/e2e.ts) daban por supuesto que "alguien"
#    habia dejado la API corriendo en el 3010. Si no estaba, curl devolvia
#    vacio, python3 reventaba al leer JSON y el banco imprimia cinco rojos
#    que no eran del sistema sino del entorno. Si SI estaba, corria contra
#    un proceso ajeno, con su base y su limite de peticiones.
#
#    Ahora cada banco levanta SU propia API, en SU puerto, y la baja al
#    salir. Si el puerto esta ocupado, se para: no se corre contra un
#    proceso que no es el nuestro.
#
# Uso:  source "$(dirname "$0")/api-de-laboratorio.sh"
#       levantar_api 3211        # deja $A y $PORT listos
# =====================================================================

levantar_api() {
  local puerto="${1:-3210}"
  local raiz; raiz="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

  echo "· compilando la API"
  ( cd "$raiz/api" && npm run build >/dev/null 2>&1 ) || { echo "⛔ no compila"; exit 1; }

  export APP_JWT_SECRETO="${APP_JWT_SECRETO:-secreto-de-laboratorio-solo-para-esta-prueba-000}"
  export APP_LLAVE_N4="${APP_LLAVE_N4:-llave-solo-de-desarrollo}"
  export PGUSER=casaroca_api_dev
  export PORT="$puerto"

  if lsof -nP -iTCP:"$puerto" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "⛔ PUERTO OCUPADO: ya hay algo escuchando en :$puerto."
    echo "   El banco NO corre contra un proceso ajeno. Cierrelo o exporte otro puerto."
    exit 1
  fi

  echo "· levantando la API en :$puerto"
  node "$raiz/api/dist/src/main.js" > "/tmp/casaroca-api-lab-$puerto.log" 2>&1 &
  API_LAB_PID=$!
  trap 'kill $API_LAB_PID 2>/dev/null' EXIT

  local i
  for i in $(seq 1 60); do
    curl -sf "http://127.0.0.1:$puerto/salud" >/dev/null 2>&1 && break
    sleep 0.25
  done
  if ! curl -sf "http://127.0.0.1:$puerto/salud" >/dev/null 2>&1; then
    echo "⛔ la API no levanto. Log:"; tail -25 "/tmp/casaroca-api-lab-$puerto.log"; exit 1
  fi

  export API="http://127.0.0.1:$puerto"
  A="$API/api/v1"
  export A
}
