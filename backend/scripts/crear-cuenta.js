#!/usr/bin/env node
/**
 * Crea una cuenta de acceso para una persona.
 *
 * La derivación de la contraseña se hace AQUÍ, con scrypt, y a la base solo
 * viaja la derivación: la contraseña en claro no existe fuera de este
 * proceso ni se escribe en ningún log.
 *
 * Uso:  node scripts/crear-cuenta.js <documento|correo|nombre> <usuario> <clave>
 *   ej: node scripts/crear-cuenta.js "Director General" director@casaroca.org "una frase larga y propia"
 */
const path = require('path');
const { createRequire } = require('module');
const API = path.join(__dirname, '..', 'api');
const req = createRequire(path.join(API, 'package.json'));
const { Client } = req('pg');
const { derivarClave, revisarPolitica } = require(path.join(API, 'dist', 'src', 'auth', 'clave.js'));

async function main() {
  const [quien, usuario, clave] = process.argv.slice(2);
  if (!quien || !usuario || !clave) {
    console.error('Uso: node scripts/crear-cuenta.js <persona> <usuario> <clave>');
    process.exit(2);
  }
  const problema = revisarPolitica(clave);
  if (problema) { console.error('⛔ ' + problema); process.exit(2); }

  const c = new Client({
    host: process.env.PGHOST || '/tmp',
    port: Number(process.env.PGPORT || 5433),
    database: process.env.PGDATABASE || 'casaroca_dev',
    user: process.env.PGUSER || 'postgres',
  });
  await c.connect();

  const { rows } = await c.query(
    `SELECT id, primer_nombre||' '||primer_apellido AS nombre
       FROM nucleo.personas
      WHERE eliminado_en IS NULL
        AND (numero_documento = $1 OR email_principal::text = $1
             OR nucleo.normalizar(primer_nombre||' '||primer_apellido) = nucleo.normalizar($1))
      LIMIT 2`, [quien]);

  if (rows.length === 0) { console.error(`⛔ No se encontró a «${quien}».`); process.exit(1); }
  if (rows.length > 1)   { console.error(`⛔ «${quien}» coincide con más de una persona. Use el documento.`); process.exit(1); }

  const r = await c.query(`SELECT identidad.crear_cuenta($1,$2,$3,NULL) AS id`,
                          [rows[0].id, usuario, derivarClave(clave)]);
  console.log(`✔ Cuenta creada para ${rows[0].nombre}`);
  console.log(`  usuario: ${usuario}`);
  console.log(`  cuenta:  ${r.rows[0].id}`);
  console.log(`  ⛔ La contraseña es temporal: el sistema exigirá cambiarla al entrar.`);
  await c.end();
}
main().catch(e => { console.error('⛔ ' + e.message); process.exit(1); });
