#!/usr/bin/env bash
# Arranca la API contra la base de desarrollo.
set -euo pipefail
source "$(dirname "$0")/entorno.sh"
cd "$(dirname "$0")/../api"
[ -d node_modules ] || npm install
npm run build
PGUSER=casaroca_api_dev PGPASSWORD="${PGPASSWORD:-dev}" \
PGHOST="$PGHOST" PGPORT="$PGPORT" PGDATABASE="$PGDATABASE" \
PORT="${PORT:-3010}" node dist/src/main.js
