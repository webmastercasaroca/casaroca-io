#!/usr/bin/env bash
# Copia de seguridad cifrada, con retención.
#
# ⛔ Una copia que nunca se restauró no es una copia: es un archivo. Por eso
#    este script tiene un hermano, `restaurar.sh`, y la verificación de
#    entrega exige que la restauración se haya EJECUTADO, con fecha.
set -euo pipefail
# ⛔ B3 · `source entorno.sh` apuntaba SIEMPRE a la base local: la «copia de
#    seguridad antes de tocar producción» volcaba el portátil. Ahora el
#    ambiente es explícito y en cualquiera que no sea desarrollo la conexión
#    tiene que venir del entorno, no de aquí.
AMBIENTE="${CASAROCA_AMBIENTE:-desarrollo}"
if [[ "$AMBIENTE" == "desarrollo" ]]; then
  source "$(dirname "$0")/entorno.sh"
else
  : "${PGHOST:?En $AMBIENTE la conexión viene del entorno, no de entorno.sh}"
  : "${PGDATABASE:?Falta PGDATABASE}"
fi
DESTINO="${CASAROCA_RESPALDOS:-$HOME/.casaroca-respaldos}"
RETENCION_DIAS="${CASAROCA_RETENCION_DIAS:-30}"
mkdir -p "$DESTINO"

SELLO="$(date +%Y%m%d-%H%M%S)"
ARCHIVO="$DESTINO/casaroca-$SELLO.dump"

echo "· volcando $PGDATABASE"
pg_dump -d "$PGDATABASE" -Fc -Z 6 -f "$ARCHIVO"

# ⛔ El volcado lleva datos N3 y N4 en claro: se cifra SIEMPRE antes de
#    salir de la máquina. La llave no vive aquí.
if [[ -n "${CASAROCA_LLAVE_RESPALDO:-}" ]]; then
  echo "· cifrando"
  openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
    -in "$ARCHIVO" -out "$ARCHIVO.enc" -pass env:CASAROCA_LLAVE_RESPALDO
  rm -f "$ARCHIVO"
  ARCHIVO="$ARCHIVO.enc"
else
  # ⛔ El freno miraba NODE_ENV, que `desplegar.sh` nunca exportaba: al
  #    desplegar a producción desde un portátil la guarda no saltaba y el
  #    volcado con datos N3 y N4 quedaba EN CLARO en el disco. Ahora mira el
  #    AMBIENTE, que es explícito.
  if [[ "$AMBIENTE" != "desarrollo" ]]; then
    echo "⛔ $AMBIENTE sin CASAROCA_LLAVE_RESPALDO: no se deja un volcado con datos N3 y N4 en claro."
    rm -f "$ARCHIVO"; exit 1
  fi
  echo "⚠️  Sin CASAROCA_LLAVE_RESPALDO: copia de DESARROLLO sin cifrar."
fi

# ⛔ B6 · Una copia que no se abre no es una copia. Se comprueba que el
#    archivo sea un volcado legible ANTES de darla por buena.
if [[ "$ARCHIVO" != *.enc ]]; then
  pg_restore -l "$ARCHIVO" >/dev/null 2>&1 || {
    echo "⛔ El volcado no se puede leer: la copia NO sirve."; rm -f "$ARCHIVO"; exit 1; }
fi

TAM=$(du -h "$ARCHIVO" | cut -f1)
echo "· $ARCHIVO ($TAM)"

# ⛔ B4 · `find -mtime +30 -delete` podia borrar LA ULTIMA copia que
#    quedaba si la rutina dejaba de correr un mes (y el Mac se duerme al
#    1 % de bateria con frecuencia). Ahora nunca se baja de un minimo.
MINIMO="${CASAROCA_MINIMO_COPIAS:-3}"
TOTAL=$(ls -1 "$DESTINO"/casaroca-*.dump* 2>/dev/null | wc -l | tr -d ' ')
if (( TOTAL > MINIMO )); then
  echo "· limpiando copias de más de $RETENCION_DIAS días (conservando al menos $MINIMO)"
  ls -1t "$DESTINO"/casaroca-*.dump* | tail -n +$((MINIMO+1)) | while read -r viejo; do
    if [[ -n "$(find "$viejo" -mtime +"$RETENCION_DIAS" 2>/dev/null)" ]]; then
      echo "  quitando $(basename "$viejo")"; rm -f "$viejo"
    fi
  done
else
  echo "· solo hay $TOTAL copia(s): no se borra ninguna"
fi

if [[ "$AMBIENTE" != "desarrollo" ]]; then
  if [[ -n "${CASAROCA_BUCKET_RESPALDOS:-}" ]]; then
    echo "· subiendo a $CASAROCA_BUCKET_RESPALDOS"
    gsutil cp "$ARCHIVO" "$CASAROCA_BUCKET_RESPALDOS/" || {
      echo "⛔ No se pudo subir la copia fuera de la máquina."; exit 1; }
  else
    echo "⛔ Falta CASAROCA_BUCKET_RESPALDOS: una copia que no sale de la máquina"
    echo "   se pierde con la máquina, junto con la base que respalda."
    exit 1
  fi
fi

psql -d "$PGDATABASE" -q -c "INSERT INTO plataforma.bitacora_mantenimiento (tarea, objeto, detalle)
  VALUES ('respaldo', '$PGDATABASE', jsonb_build_object('archivo','$(basename "$ARCHIVO")','tamano','$TAM'));" || true

echo "✔ copia tomada. ⛔ Una copia sin restauración probada no cuenta: corra restaurar.sh al menos una vez al mes."
