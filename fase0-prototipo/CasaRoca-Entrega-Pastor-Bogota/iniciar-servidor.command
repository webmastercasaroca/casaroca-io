#!/bin/bash
# Casa Roca · ENTREGA Pastor de Bogotá (sistema en 0) — servidor de previsualización
# Busca automáticamente un puerto libre (5174, 5175, ...) para no chocar con otros servidores.
cd "$(dirname "$0")"
PORT=5174
while lsof -i tcp:$PORT >/dev/null 2>&1; do
  PORT=$((PORT+1))
done
echo "Casa Roca · ENTREGA Pastor Bogotá — http://localhost:$PORT/pastor.html"
echo "(Ctrl+C para detener)"
( sleep 1; open "http://localhost:$PORT/pastor.html" ) &
python3 -m http.server $PORT
