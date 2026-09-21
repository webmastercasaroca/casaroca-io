#!/bin/bash
# Casa Roca · servidor local del DEMO — busca puerto libre desde 5173
cd "$(dirname "$0")"
PORT=5173
while lsof -i tcp:$PORT >/dev/null 2>&1; do PORT=$((PORT+1)); done
echo "Casa Roca · DEMO — http://localhost:$PORT/hub.html"
echo "(Ctrl+C para detener)"
( sleep 1; open "http://localhost:$PORT/hub.html" ) &
python3 -m http.server $PORT
