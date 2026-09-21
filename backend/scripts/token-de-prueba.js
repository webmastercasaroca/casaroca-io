#!/usr/bin/env node
/**
 * Devuelve un token de acceso válido para pruebas, resolviendo el segundo
 * factor si el rol lo exige.
 *
 * ⛔ SOLO PARA DESARROLLO Y AUDITORÍA INTERNA contra una base de laboratorio.
 * Calcula el código como lo haría el teléfono del usuario; en producción el
 * secreto nunca sale del gestor de llaves y este atajo no funciona.
 *
 * Uso: node scripts/token-de-prueba.js <usuario> <clave>
 */
const { createHmac } = require('node:crypto');
const BASE = process.env.API_BASE || 'http://127.0.0.1:3000';
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function codigo(secreto) {
  let bits = '';
  for (const c of secreto.toUpperCase()) { const i = B32.indexOf(c); if (i >= 0) bits += i.toString(2).padStart(5, '0'); }
  const by = []; for (let i = 0; i + 8 <= bits.length; i += 8) by.push(parseInt(bits.slice(i, i + 8), 2));
  const buf = Buffer.alloc(8); buf.writeBigInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)));
  const h = createHmac('sha1', Buffer.from(by)).update(buf).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1000000).padStart(6, '0');
}

const pedir = async (ruta, cuerpo, token) => {
  const r = await fetch(BASE + ruta, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(cuerpo ?? {}),
  });
  return { estado: r.status, cuerpo: await r.json().catch(() => null) };
};

async function main() {
  const [usuario, clave] = process.argv.slice(2);
  if (!usuario || !clave) { console.error('Uso: node scripts/token-de-prueba.js <usuario> <clave>'); process.exit(2); }

  let r = await pedir('/api/v1/auth/entrar', { usuario, clave });
  if (r.estado !== 200) { console.error('⛔ ' + (r.cuerpo?.mensaje ?? r.estado)); process.exit(1); }

  if (r.cuerpo.debeConfigurarSegundoFactor) {
    const ini = await pedir('/api/v1/auth/segundo-factor/iniciar', {}, r.cuerpo.acceso);
    const secreto = ini.cuerpo.secreto;
    await pedir('/api/v1/auth/segundo-factor/activar', { codigo: codigo(secreto) }, r.cuerpo.acceso);
    r = await pedir('/api/v1/auth/entrar', { usuario, clave, codigo: codigo(secreto) });
    process.stderr.write(`(segundo factor activado · secreto ${secreto})\n`);
  } else if (r.cuerpo?.faltaSegundoFactor) {
    console.error('⛔ La cuenta ya tiene segundo factor activo y no se conoce su secreto.');
    process.exit(1);
  }
  if (r.estado !== 200 || !r.cuerpo?.acceso) { console.error('⛔ no se obtuvo token'); process.exit(1); }
  console.log(r.cuerpo.acceso);
}
main().catch(e => { console.error('⛔ ' + e.message); process.exit(1); });
