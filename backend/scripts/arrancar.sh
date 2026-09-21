#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/entorno.sh"
if ! pg_isready -q; then
  pg_ctl -D "$PGDATA" -l "$HOME/.casaroca-pg/server.log" -o "-p $PGPORT -k /tmp" start
  sleep 2
fi
pg_isready
