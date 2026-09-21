#!/bin/bash
cd "$(dirname "$0")"
PORT=5175
while lsof -i tcp:$PORT >/dev/null 2>&1; do PORT=$((PORT+1)); done
echo "Casa Roca · ENTREGA Pastor Director — http://localhost:$PORT/central.html"
echo "(Ctrl+C para detener)"
( sleep 1; open "http://localhost:$PORT/central.html" ) &
python3 -m http.server $PORT
