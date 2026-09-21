#!/usr/bin/env bash
# Despliegue a un ambiente. Aburrido y reversible, que es como tiene que ser.
#
# ⛔ NO despliega si la verificación no está en verde. Esa es la única razón
#    por la que este script existe en vez de un `gcloud run deploy` a mano.
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
AMBIENTE="${1:-}"

case "$AMBIENTE" in
  staging|produccion) ;;
  *) echo "Uso: $0 <staging|produccion>"; exit 2 ;;
esac

PROYECTO="casaroca-${AMBIENTE/produccion/prod}"
REGION="${CASAROCA_REGION:-us-east1}"

# ⛔ B2 · ESTE SCRIPT NO DEFINIA LA CONEXION A LA BASE. `migrar-produccion.sh`
#    usa las variables libpq del entorno, asi que `desplegar.sh produccion`
#    habria migrado CONTRA LO QUE TUVIERA LA TERMINAL: si alguien habia
#    hecho `source entorno.sh`, contra casaroca_dev en el portatil. Y luego
#    habria desplegado la imagen a produccion sin migrar produccion.
: "${CASAROCA_PGHOST:?Falta CASAROCA_PGHOST (el proxy de Cloud SQL del ambiente). Ver docs/PUESTA-EN-MARCHA-GCP.md}"
: "${CASAROCA_PGDATABASE:?Falta CASAROCA_PGDATABASE}"
: "${CASAROCA_PGUSER:?Falta CASAROCA_PGUSER}"
export PGHOST="$CASAROCA_PGHOST"
export PGPORT="${CASAROCA_PGPORT:-5432}"
export PGDATABASE="$CASAROCA_PGDATABASE"
export PGUSER="$CASAROCA_PGUSER"
export PGPASSWORD="${CASAROCA_PGPASSWORD:-}"
export NODE_ENV=production
export CASAROCA_AMBIENTE="$AMBIENTE"

# Y se comprueba que el destino sea el que se pidio, no el del portatil.
if [[ "$PGHOST" == "/tmp" || "$PGDATABASE" == "casaroca_dev" ]]; then
  echo "⛔ La conexión apunta a la base LOCAL de desarrollo, no a $AMBIENTE. Se aborta."
  exit 1
fi
VERSION="$(git -C "$RAIZ/.." rev-parse --short HEAD 2>/dev/null || date +%Y%m%d-%H%M)"

echo "════════════════════════════════════════════════════"
echo "  DESPLIEGUE · $AMBIENTE · $PROYECTO · versión $VERSION"
echo "════════════════════════════════════════════════════"

echo "══ 1 · Verificación completa"
"$RAIZ/scripts/verificar.sh" || { echo "⛔ La verificación está en rojo. No se despliega."; exit 1; }

if [[ "$AMBIENTE" == "produccion" ]]; then
  DIA=$(date +%u)
  if [[ "$DIA" == "7" ]]; then
    echo "⛔ Es domingo. El domingo es el pico de uso de las 36 sedes: no se despliega."
    echo "   Si es una emergencia, exporte CASAROCA_FORZAR_DOMINGO=si y quede por escrito."
    [[ "${CASAROCA_FORZAR_DOMINGO:-no}" == "si" ]] || exit 1
  fi
  echo "══ 2 · Copia de seguridad antes de tocar producción"
  # ⛔ B3 · Esto volcaba la base LOCAL del portatil, porque respaldar.sh
  #    hacia `source entorno.sh`. Y sin CASAROCA_LLAVE_RESPALDO quedaba SIN
  #    CIFRAR, con datos N3 y N4 en claro en el disco de quien desplegaba.
  : "${CASAROCA_LLAVE_RESPALDO:?Falta CASAROCA_LLAVE_RESPALDO: no se toca producción sin copia cifrada}"
  CASAROCA_AMBIENTE=produccion "$RAIZ/scripts/respaldar.sh"
fi

command -v gcloud >/dev/null || { echo "⛔ falta gcloud. Ver docs/INFRA.md"; exit 1; }

echo "══ 3 · Construir la imagen"
gcloud builds submit "$RAIZ/api" \
  --project "$PROYECTO" \
  --tag "$REGION-docker.pkg.dev/$PROYECTO/imagenes/api:$VERSION"

echo "══ 4 · Migrar la base (solo lo nuevo)"
# ⛔ B1 · Aqui se le pasaba "$AMBIENTE" a un script que solo acepta --plan
#    y --sin-rol-api: abortaba SIEMPRE en este paso, en los dos ambientes,
#    despues de haber construido y subido la imagen. La ruta documentada en
#    el runbook NUNCA se habia ejecutado entera.
#    Primero el plan, para ver que va a pasar; despues se aplica.
"$RAIZ/scripts/migrar-produccion.sh" --plan
"$RAIZ/scripts/migrar-produccion.sh"

echo "══ 5 · Desplegar la revisión SIN tráfico"
gcloud run deploy casaroca-api \
  --project "$PROYECTO" --region "$REGION" \
  --image "$REGION-docker.pkg.dev/$PROYECTO/imagenes/api:$VERSION" \
  --no-traffic --tag "v$VERSION" \
  --set-env-vars "NODE_ENV=production,APP_VERSION=$VERSION"

echo "══ 6 · Comprobar LA REVISIÓN NUEVA antes de darle tráfico"
# ⛔ A6 · `status.traffic[0].url` es la PRIMERA entrada de trafico, o sea la
#    revision VIEJA sirviendo el 100 %. Y el `|| true` hacia que un fallo
#    dejara URL vacia y el `if` SALTARA el chequeo entero en silencio. Las
#    dos salidas posibles eran: comprobar la revision vieja (sana) o no
#    comprobar nada. En ningun caso bloqueaba.
URL=$(gcloud run services describe casaroca-api --project "$PROYECTO" --region "$REGION" \
        --format="value(status.traffic.filter(\"tag:v$VERSION\").url)" 2>/dev/null | head -1)
[[ -z "$URL" ]] && URL=$(gcloud run revisions describe "casaroca-api-$VERSION" \
        --project "$PROYECTO" --region "$REGION" --format='value(status.url)' 2>/dev/null | head -1)
if [[ -z "$URL" ]]; then
  echo "⛔ No se pudo resolver la URL de la revisión nueva. No se pasa tráfico a ciegas."
  exit 1
fi
echo "   comprobando $URL/salud/detalle"
SALUD=$(curl -sf "$URL/salud/detalle") || { echo "⛔ la revisión nueva no responde"; exit 1; }
echo "$SALUD" | grep -q '"estado":"sano"' || {
  echo "⛔ la revisión nueva responde pero NO está sana:"; echo "$SALUD"; exit 1; }

echo "══ 7 · Pasar el tráfico"
# La reversion, resuelta ANTES de tocar nada: a las 9 de un domingo nadie
# tiene que averiguar el nombre de la revision anterior bajo presion.
ANTERIOR=$(gcloud run revisions list --service casaroca-api --project "$PROYECTO" \
           --region "$REGION" --format='value(metadata.name)' --limit 2 2>/dev/null | tail -1)
gcloud run services update-traffic casaroca-api \
  --project "$PROYECTO" --region "$REGION" --to-latest

echo
echo "✔ Desplegado $VERSION en $AMBIENTE"
echo "⛔ REVERSIÓN DEL CÓDIGO, si algo sale mal (menos de 5 minutos):"
echo "   gcloud run services update-traffic casaroca-api --project $PROYECTO --region $REGION --to-revisions ${ANTERIOR:-<revisión anterior>}=100"
echo
echo "⛔ Y LO QUE LA REVERSIÓN NO DESHACE: las migraciones."
echo "   Este script migra ANTES de desplegar, así que volver atrás devuelve"
echo "   el CÓDIGO, nunca el esquema. Si la migración quitó o renombró algo,"
echo "   el código viejo queda contra un esquema nuevo. Por eso la regla de"
echo "   expandir y luego contraer: una migración nunca quita nada en el"
echo "   mismo despliegue que deja de usarlo. Si hay que deshacer el esquema,"
echo "   se restaura la copia de la línea 2 (docs/RUNBOOK.md, punto 3)."
