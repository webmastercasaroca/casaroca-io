#!/usr/bin/env bash
# Entorno común. La base de desarrollo vive en ~/.casaroca-pg (fuera del proyecto).
export PATH="$HOME/Applications/Postgres.app/Contents/Versions/16/bin:$PATH"
export PGDATA="$HOME/.casaroca-pg/data"
export PGPORT="${PGPORT:-5433}"
export PGHOST="${PGHOST:-/tmp}"
export PGUSER="${PGUSER:-postgres}"
export PGDATABASE="${PGDATABASE:-casaroca_dev}"
