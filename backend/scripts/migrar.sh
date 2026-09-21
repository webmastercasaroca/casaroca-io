#!/usr/bin/env bash
# Aplica todas las migraciones en orden sobre una base LIMPIA de desarrollo.
# Producción usa el mismo directorio, aplicado por el migrador con control de versión.
set -euo pipefail
source "$(dirname "$0")/entorno.sh"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"

# ⛔ GUARDA DE SEGURIDAD. Este script hace DROP DATABASE y toma el nombre
#    del ENTORNO. Quien tuviera PGDATABASE apuntando a una base real y
#    corriera verificar.sh (que llama aqui) BORRARIA esa base: la compuerta
#    de calidad era el camino mas corto a perder datos.
case "$PGDATABASE" in
  casaroca_dev|casaroca_test|casaroca_restaurada) ;;
  *) echo "⛔ migrar.sh RECREA la base desde cero y solo acepta casaroca_dev o casaroca_test."
     echo "   PGDATABASE vale «$PGDATABASE». Si de verdad quiere migrar ese destino,"
     echo "   use scripts/migrar-produccion.sh, que aplica solo lo nuevo."
     exit 2 ;;
esac

# Nadie mas puede estar conectado, o el DROP falla. Se cierran las sesiones
# ajenas (la API en desarrollo suele tener una abierta).
psql -d postgres -v ON_ERROR_STOP=1 -q -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity
    WHERE datname = '$PGDATABASE' AND pid <> pg_backend_pid();" >/dev/null 2>&1 || true

psql -d postgres -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS $PGDATABASE;" 
psql -d postgres -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE $PGDATABASE;"

for f in "$RAIZ"/db/migrations/*.sql; do
  printf '  → %s\n' "$(basename "$f")"
  psql -d "$PGDATABASE" -v ON_ERROR_STOP=1 -q -f "$f"
done
for f in "$RAIZ"/db/seeds/*.sql; do
  printf '  → seed %s\n' "$(basename "$f")"
  psql -d "$PGDATABASE" -v ON_ERROR_STOP=1 -q -f "$f"
done
# Rol de conexión de la API. SOLO desarrollo (ver db/dev/rol_login_dev.sql).
psql -d "$PGDATABASE" -v ON_ERROR_STOP=1 -q -f "$RAIZ/db/dev/rol_login_dev.sql"

echo "migraciones aplicadas sobre $PGDATABASE"
