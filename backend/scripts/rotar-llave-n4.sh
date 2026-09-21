#!/usr/bin/env bash
# =====================================================================
# ROTAR LA LLAVE N4 · el procedimiento que el RUNBOOK decía y no existía
#
# ⛔ Hasta el 19 de septiembre de 2026 el runbook afirmaba que NO hacía
#    falta recifrar («la envoltura usa la versión con la que se cifró cada
#    fila»). Es falso: el sistema cifra con `pgp_sym_encrypt(dato, llave)`
#    y UNA sola llave simétrica, sin versión guardada. Quien siguiera ese
#    runbook dejaba ilegibles los códigos de entrega de los menores de
#    RocaKids, y si además destruía la versión anterior en KMS, para
#    siempre.
#
# Uso:
#   CASAROCA_LLAVE_VIEJA=... CASAROCA_LLAVE_NUEVA=... ./scripts/rotar-llave-n4.sh
#   (añada --aplicar para escribir; sin él solo informa)
#
# Orden obligatorio, y el guion lo impone:
#   1. Informe: cuánto hay cifrado y con cuál llave se lee.
#   2. Recifrado, fila por fila. Se puede cortar y volver a correr.
#   3. Comprobación con la llave NUEVA: cero ilegibles o no se sigue.
#   4. Solo entonces se despliega con la llave nueva.
#   5. La versión anterior en KMS se destruye DESPUÉS, nunca antes.
# =====================================================================
set -uo pipefail
source "$(dirname "$0")/entorno.sh"

: "${CASAROCA_LLAVE_VIEJA:?Falta CASAROCA_LLAVE_VIEJA: la llave con la que estan cifrados los datos}"
: "${CASAROCA_LLAVE_NUEVA:?Falta CASAROCA_LLAVE_NUEVA: la llave a la que se rota}"
APLICAR="${1:-}"

q() { psql -d "$PGDATABASE" -qAt -c "$1"; }

echo "── 1 · Antes de tocar nada"
psql -d "$PGDATABASE" -c "SELECT * FROM plataforma.verificar_cifrado_n4('$CASAROCA_LLAVE_VIEJA')"

PENDIENTES=$(q "SELECT COALESCE(sum(ilegibles),0) FROM plataforma.verificar_cifrado_n4('$CASAROCA_LLAVE_VIEJA')")
if [ "${PENDIENTES:-0}" != "0" ]; then
  echo "⚠️  Hay $PENDIENTES fila(s) que NO se leen con la llave vieja."
  echo "   O ya están rotadas, o se cifraron con otra llave. Averígüelo ANTES"
  echo "   de seguir: el recifrado no las va a tocar y quedarán fuera."
fi

if [ "$APLICAR" != "--aplicar" ]; then
  echo
  echo "── Modo informe. Nada se ha escrito."
  echo "   Para rotar de verdad: ./scripts/rotar-llave-n4.sh --aplicar"
  exit 0
fi

echo
echo "── 2 · Recifrando (se puede cortar y volver a correr)"
psql -d "$PGDATABASE" -v ON_ERROR_STOP=1 \
  -c "SELECT * FROM plataforma.recifrar_n4('$CASAROCA_LLAVE_VIEJA','$CASAROCA_LLAVE_NUEVA')" || {
  echo "⛔ El recifrado fallo. NO despliegue con la llave nueva y NO destruya la vieja."; exit 1; }

echo
echo "── 3 · Comprobando con la llave NUEVA"
psql -d "$PGDATABASE" -c "SELECT * FROM plataforma.verificar_cifrado_n4('$CASAROCA_LLAVE_NUEVA')"
MALAS=$(q "SELECT COALESCE(sum(ilegibles),0) FROM plataforma.verificar_cifrado_n4('$CASAROCA_LLAVE_NUEVA')")

if [ "${MALAS:-1}" != "0" ]; then
  echo
  echo "⛔ QUEDAN $MALAS FILA(S) ILEGIBLES CON LA LLAVE NUEVA."
  echo "   NO despliegue con la llave nueva."
  echo "   NO destruya la version anterior en KMS: es lo unico que las abre."
  exit 1
fi

echo
echo "✅ Todo lo cifrado se lee con la llave nueva."
echo "   Ahora si: actualice el secreto, despliegue, y SOLO DESPUES de"
echo "   comprobar una entrega real en RocaKids, programe la destruccion"
echo "   de la version anterior de la llave en KMS."
echo "   Anote la rotacion en docs/DECISIONES/ con fecha y responsable."
