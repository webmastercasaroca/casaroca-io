#!/usr/bin/env bash
# Corre TODOS los bancos de invariantes y devuelve distinto de 0 si alguno falla.
# Cada banco tiene su propia compuerta interna (RAISE EXCEPTION 'BANCO EN ROJO'),
# así que una invariante rota detiene la corrida aquí y detiene la integración
# continua allá. Un banco que solo imprime no es una compuerta: es un informe.
set -uo pipefail
source "$(dirname "$0")/entorno.sh"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"

# ⛔ BASE LIMPIA ANTES DE CADA CORRIDA, salvo que se pida --rapido.
#    El 19 de septiembre de 2026 se descubrió que los bancos NO eran
#    independientes: el banco 6 pasaba porque el banco 4 le había dejado
#    datos, y cinco catálogos bloqueantes vacíos quedaron tapados por ese
#    efecto. Una suite cuyo resultado depende del orden no es una suite.
#    Reconstruir tarda segundos; un falso verde cuesta un proyecto.
if [[ "${1:-}" != "--rapido" ]]; then
  echo "  (base limpia: aplicando migraciones y semillas)"
  "$RAIZ/scripts/migrar.sh" > /dev/null || { echo "LA MIGRACION FALLO"; exit 1; }
fi

BANCOS=(
  invariantes
  aislamiento_rls
  invariantes_modulos
  consola_sistemas
  empalme_100p
  catalogos_no_vacios
  rls_tablas_hijas
  modelo_drive_100p
  busqueda_y_duplicados
  particiones
  membresias_sede
  organizacion_central
  catalogos_editables
  identidad_y_sesion
  salvaguarda_menores
  cumplimiento
)

rojos=(); verdes=0; total_pruebas=0
for b in "${BANCOS[@]}"; do
  f="$RAIZ/db/tests/$b.sql"
  # ⛔ Un banco declarado y sin archivo se saltaba EN SILENCIO: no sumaba a
  #    verdes, no sumaba a rojos, no avisaba. `identidad_y_sesion` llevaba
  #    dias figurando como si corriera y nunca existio. Ahora es rojo.
  if [[ ! -f "$f" ]]; then
    echo "⛔ BANCO DECLARADO Y SIN ARCHIVO: $b.sql"
    rojos+=("$b · FALTA EL ARCHIVO"); continue
  fi
  salida="$(psql -d "$PGDATABASE" -v ON_ERROR_STOP=1 -f "$f" 2>&1)"
  rc=$?
  echo "$salida"
  n="$(echo "$salida" | grep -oE '^ *[0-9]+ \| *[0-9]+ \| *[0-9]+ *$' | tail -1 | awk -F'|' '{print $3}' | tr -d ' ')"
  total_pruebas=$(( total_pruebas + ${n:-0} ))
  if [[ $rc -ne 0 ]]; then rojos+=("$b"); else verdes=$(( verdes + 1 )); fi
done

echo
echo "════════════════════════════════════════════════════════"
# Y el conteo tiene que cuadrar con lo declarado.
if [[ ${#rojos[@]} -eq 0 && $verdes -ne ${#BANCOS[@]} ]]; then
  rojos+=("corrieron $verdes de ${#BANCOS[@]} bancos declarados")
fi

if [[ ${#rojos[@]} -eq 0 ]]; then
  echo "  TODOS LOS BANCOS EN VERDE · $verdes bancos · $total_pruebas invariantes"
  echo "════════════════════════════════════════════════════════"
  exit 0
else
  echo "  BANCOS EN ROJO: ${rojos[*]}"
  echo "  No se entrega, no se fusiona y no se despliega."
  echo "════════════════════════════════════════════════════════"
  exit 1
fi
