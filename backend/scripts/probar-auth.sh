#!/usr/bin/env bash
# Prueba de punta a punta de la autenticación: levanta la API, crea una
# cuenta de laboratorio, corre el banco y baja todo. Base limpia por corrida.
set -uo pipefail
source "$(dirname "$0")/entorno.sh"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
export PGUSER_ADMIN="$PGUSER"

USUARIO="prueba.auth@casaroca.org"
CLAVE="una frase larga de prueba 2026"

echo "· compilando la API"
( cd "$RAIZ/api" && npm run build >/dev/null 2>&1 ) || { echo "⛔ no compila"; exit 1; }

echo "· creando la cuenta de laboratorio"
PGUSER=postgres node "$RAIZ/scripts/crear-cuenta.js" "Director General" "$USUARIO" "$CLAVE" >/dev/null 2>&1 || true

# ⛔ 20 sep 2026 · La cabecera de este guion dice «base limpia por corrida»
#    y NO lo era: la cuenta de laboratorio conservaba de la corrida anterior
#    el segundo factor activo, los intentos fallidos y el aviso de
#    contraseña provisional. El banco pasaba 19/19 recien migrada la base y
#    fallaba siete pruebas sobre una base usada. Una prueba que depende de
#    como quedo la anterior no prueba nada: prueba el orden en que se corrio.
#    Aqui la cuenta se DEVUELVE a su estado inicial, siempre.
PGUSER=postgres node - "$USUARIO" "$CLAVE" <<'JS'
const path = require('path');
const { createRequire } = require('module');
const API = path.join(process.cwd(), 'api');
const req = createRequire(path.join(API, 'package.json'));
const { Client } = req('pg');
const { derivarClave } = require(path.join(API, 'dist', 'src', 'auth', 'clave.js'));
const [usuario, clave] = process.argv.slice(2);
(async () => {
  const c = new Client({
    host: process.env.PGHOST || '/tmp', port: Number(process.env.PGPORT || 5433),
    database: process.env.PGDATABASE || 'casaroca_dev', user: 'postgres',
  });
  await c.connect();
  /* ⛔ Se busca por PERSONA, no por usuario. Una persona tiene UNA cuenta,
     y tres ayudantes de laboratorio distintos (crear-cuenta.js,
     token-para.js y la demo del frontend) le cambian el `usuario` a la
     misma cuenta del Director General. Buscar por usuario encontraba
     «prueba.auth@casaroca.org» solo si el ultimo en pasar habia sido este
     banco: si no, no reiniciaba nada y las siete pruebas de sesion fallaban
     con un 401 que parecia un fallo de la API. */
  const { rows } = await c.query(
    `SELECT c.id FROM identidad.cuentas c
       JOIN identidad.asignaciones a ON a.persona_id = c.persona_id
      WHERE a.alcance_tipo = 'organizacion' AND a.revocada_en IS NULL
      ORDER BY c.creada_en LIMIT 1`);
  if (rows.length) {
    await c.query('UPDATE identidad.cuentas SET usuario = $2 WHERE id = $1', [rows[0].id, usuario]);
    await c.query('SELECT identidad.cambiar_clave($1,$2)', [rows[0].id, derivarClave(clave)]);
    await c.query(`UPDATE identidad.cuentas
                      SET estado = 'activa', segundo_factor_activo = false,
                          segundo_factor_secreto = NULL, debe_cambiar_clave = false,
                          intentos_fallidos = 0, bloqueada_hasta = NULL
                    WHERE id = $1`, [rows[0].id]);
    await c.query('UPDATE identidad.sesiones SET cerrada_en = now() WHERE cuenta_id = $1 AND cerrada_en IS NULL',
                  [rows[0].id]);
  }
  await c.end();
})().catch(e => { console.error('⛔ no se pudo reiniciar la cuenta de laboratorio: ' + e.message); process.exit(1); });
JS

echo "· levantando la API"
export APP_JWT_SECRETO="${APP_JWT_SECRETO:-secreto-de-laboratorio-solo-para-esta-prueba-000}"
export APP_LLAVE_N4="${APP_LLAVE_N4:-llave-solo-de-desarrollo}"
export PGUSER=casaroca_api_dev
# ⛔ Puerto propio y comprobado. La primera version usaba el 3000 fijo: si
#    ya habia una API viva ahi, el proceso nuevo fallaba al abrir el puerto,
#    la comprobacion de salud respondia (la vieja), y el banco corria contra
#    OTRO proceso, con su propio limite de peticiones ya gastado y su propia
#    base. Diez pruebas en rojo y ninguna era un fallo del sistema.
export PORT="${PORT:-3210}"
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "⛔ PUERTO OCUPADO: ya hay algo escuchando en :$PORT."
  echo "   Cierrelo o exporte PORT con otro puerto. No se corre contra un proceso ajeno."
  exit 1
fi
node "$RAIZ/api/dist/src/main.js" > /tmp/casaroca-api-prueba.log 2>&1 &
API_PID=$!
trap 'kill $API_PID 2>/dev/null' EXIT

for i in $(seq 1 40); do
  curl -sf "http://127.0.0.1:$PORT/salud" >/dev/null 2>&1 && break
  sleep 0.25
done

if ! curl -sf "http://127.0.0.1:$PORT/salud" >/dev/null 2>&1; then
  echo "⛔ la API no levantó. Log:"; tail -20 /tmp/casaroca-api-prueba.log; exit 1
fi

echo "· corriendo el banco"
PRUEBA_USUARIO="$USUARIO" PRUEBA_CLAVE="$CLAVE" API_BASE="http://127.0.0.1:$PORT" \
  node "$RAIZ/api/dist/test/auth.e2e.js"
rc=$?
kill $API_PID 2>/dev/null
exit $rc
