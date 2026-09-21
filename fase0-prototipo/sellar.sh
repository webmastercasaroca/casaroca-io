#!/bin/sh
# ============================================================
# CASA ROCA · SELLAR LA CACHÉ DEL PROTOTIPO
#
# Por qué existe, con fecha: el 11 de septiembre de 2026 Daniel vio
# «todas las pestañas activadas» en un panel al que solo se le había
# otorgado un módulo. El código era correcto: lo que corría en su
# navegador era una copia vieja de `pastor.html`, guardada antes de que
# naciera el puente de permisos. El HTML no llevaba sello de versión, así
# que el navegador lo dio por bueno y nunca volvió a pedirlo.
#
# Un permiso que no llega por caché es indistinguible de un permiso roto,
# y se diagnostica igual de caro. Este script pone a TODOS los `?v=` de
# todos los HTML el mismo número, sacado del fichero más reciente de
# `assets/`. Se corre después de tocar cualquier js o css.
# ============================================================
set -e
cd "$(dirname "$0")"

SELLO=$(find assets -type f \( -name '*.js' -o -name '*.css' \) -exec stat -f '%m' {} + | sort -n | tail -1)
[ -n "$SELLO" ] || { echo "No encontré assets que sellar."; exit 1; }

for f in *.html; do
  # 1) refrescar los sellos que ya existen
  perl -pi -e "s/\?v=[0-9A-Za-z._-]+/?v=$SELLO/g" "$f"
  # 2) ⛔ Y PONER SELLO A LOS QUE NUNCA LO TUVIERON.
  #    El 15 sep 2026 se midió: 37 de 54 recursos iban SIN `?v=`, entre
  #    ellos central.js, director.js, store.js y data.js. Como sellar.sh
  #    solo reescribia sellos existentes, esos archivos se cacheaban para
  #    siempre: se editaban, se desplegaban, y el navegador de quien ya
  #    habia entrado seguia sirviendo la version vieja.
  #    Es la MISMA trampa de caché que costó el día 11 de septiembre, solo
  #    que tapada a medias: se arregló el HTML y un tercio del JS.
  perl -pi -e "s{(src|href)=\"(assets/(?:js|css)/[^\"?]+\.(?:js|css))\"}{\$1=\"\$2?v=$SELLO\"}g" "$f"
done

echo "Sellado con v=$SELLO  ($(date -r "$SELLO" '+%Y-%m-%d %H:%M:%S'))"

# ------------------------------------------------------------
# COMPROBADOR DE PANTALLAS HUÉRFANAS
# Por qué existe, con fecha: el 11 de septiembre de 2026 el commit
# ff1a761 borró 423 líneas de master.js y dejó en pie las llamadas.
# Durante CUATRO DÍAS el Control Tower no pudo crear nada: las seis
# entradas de "+ Crear" reventaban con ReferenceError y con ellas dos
# de los cuatro botones de Puesta en marcha. Nadie se enteró porque
# un ReferenceError dentro de un manejador de clic no rompe la
# página: simplemente no pasa nada al pulsar.
#
# Y el mensaje de ese mismo commit avisaba de que YA había ocurrido
# antes con el auxiliar b_. Es el patrón de reemplazar un fichero
# entero y perder funciones por el camino.
#
# Esto lo convierte en un aviso inmediato: si pintar() llama a una
# vista que no existe, el sellado falla y no se despliega.
# ------------------------------------------------------------
HUERFANAS=""
for FN in $(grep -oE 'html = v[A-Za-z0-9_]+\(\)' assets/js/master.js | grep -oE 'v[A-Za-z0-9_]+' | sort -u); do
  grep -qE "function $FN\b" assets/js/master.js || HUERFANAS="$HUERFANAS $FN"
done

if [ -n "$HUERFANAS" ]; then
  echo ""
  echo "⛔ SELLADO ABORTADO · pantallas invocadas que NO existen:"
  for FN in $HUERFANAS; do echo "     $FN()"; done
  echo ""
  echo "   pintar() las llama y no están definidas en master.js."
  echo "   Al pulsar su botón no pasará nada: ReferenceError silencioso."
  echo "   Restáurelas antes de sellar o desplegar."
  exit 1
fi

echo "Comprobado: todas las pantallas que pintar() invoca existen."
echo "Recuerde: en el navegador, recarga dura (cmd+shift+R) la primera vez."
