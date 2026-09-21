#!/usr/bin/env node
/**
 * Token de una persona, para los bancos de API.
 *
 * ⛔ SOLO LABORATORIO. Crea (o reutiliza) una cuenta para esa persona, le
 * resuelve el segundo factor si su rol lo exige, e imprime el token.
 * Existe porque las tres suites de API se identificaban con la cabecera
 * `X-Persona-Id`, que se elimino el 19 de septiembre: quedaron muertas y
 * fuera de la compuerta, y la documentacion seguia afirmando «22/22».
 *
 * Uso: node scripts/token-para.js <persona_uuid>
 */
const path = require('path');
const { createRequire } = require('module');
const { createHmac } = require('node:crypto');
const API = path.join(__dirname, '..', 'api');
const req = createRequire(path.join(API, 'package.json'));
const { Client } = req('pg');
const { derivarClave } = require(path.join(API, 'dist', 'src', 'auth', 'clave.js'));

// ⛔ Antes esto apuntaba fijo al :3000. El banco levantaba SU API en otro
//    puerto, pero el token se pedia a la API del 3000 (otro proceso, otro
//    secreto JWT): el token se firmaba bien y la API del banco lo rechazaba
//    con un 401 que parecia un fallo de permisos. Ahora sigue a $API, que
//    es la que el propio banco acaba de levantar.
const BASE = process.env.API_BASE || process.env.API || 'http://127.0.0.1:3000';
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const CLAVE = 'frase larga de laboratorio para el banco de api';

function totp(secreto) {
  let bits = '';
  for (const c of secreto.toUpperCase()) { const i = B32.indexOf(c); if (i >= 0) bits += i.toString(2).padStart(5, '0'); }
  const by = []; for (let i = 0; i + 8 <= bits.length; i += 8) by.push(parseInt(bits.slice(i, i + 8), 2));
  const buf = Buffer.alloc(8); buf.writeBigInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)));
  const h = createHmac('sha1', Buffer.from(by)).update(buf).digest();
  const o = h[h.length - 1] & 15;
  return String((((h[o] & 127) << 24) | (h[o+1] << 16) | (h[o+2] << 8) | h[o+3]) % 1e6).padStart(6, '0');
}

const post = async (ruta, cuerpo, token) => {
  const r = await fetch(BASE + ruta, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(cuerpo ?? {}),
  });
  return { estado: r.status, cuerpo: await r.json().catch(() => null) };
};

async function main() {
  const persona = process.argv[2];
  if (!persona) { console.error('Uso: node scripts/token-para.js <persona_uuid>'); process.exit(2); }

  const c = new Client({
    host: process.env.PGHOST || '/tmp', port: Number(process.env.PGPORT || 5433),
    database: process.env.PGDATABASE || 'casaroca_dev', user: 'postgres',
  });
  await c.connect();
  const usuario = `banco.api.${persona.slice(0, 8)}@casaroca.org`;
  const { rows } = await c.query(`SELECT id FROM identidad.cuentas WHERE persona_id = $1`, [persona]);
  if (rows.length) {
    await c.query(`SELECT identidad.cambiar_clave($1,$2)`, [rows[0].id, derivarClave(CLAVE)]);
    await c.query(`UPDATE identidad.cuentas SET usuario = $2, estado='activa',
                     segundo_factor_activo = false, segundo_factor_secreto = NULL
                   WHERE id = $1`, [rows[0].id, usuario]);
  } else {
    await c.query(`SELECT identidad.crear_cuenta($1,$2,$3,NULL)`, [persona, usuario, derivarClave(CLAVE)]);
  }
  await c.end();

  let r = await post('/api/v1/auth/entrar', { usuario, clave: CLAVE });
  if (r.cuerpo?.debeConfigurarSegundoFactor) {
    const ini = await post('/api/v1/auth/segundo-factor/iniciar', {}, r.cuerpo.acceso);
    await post('/api/v1/auth/segundo-factor/activar', { codigo: totp(ini.cuerpo.secreto) }, r.cuerpo.acceso);
    r = await post('/api/v1/auth/entrar', { usuario, clave: CLAVE, codigo: totp(ini.cuerpo.secreto) });
  }
  if (!r.cuerpo?.acceso) { console.error('⛔ ' + (r.cuerpo?.mensaje ?? r.estado)); process.exit(1); }
  console.log(r.cuerpo.acceso);
}
main().catch(e => { console.error('⛔ ' + e.message); process.exit(1); });
