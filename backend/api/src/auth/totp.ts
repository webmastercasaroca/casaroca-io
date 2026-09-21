import { createHmac, randomBytes, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto';

/**
 * Segundo factor por código temporal (TOTP, RFC 6238).
 *
 * ⛔ POR QUÉ ES OBLIGATORIO Y NO OPCIONAL. Quien alcanza datos N3 o N4 toca
 * notas de consejería, salud de menores y aportes de la red entera. Una
 * contraseña robada por un correo falso no puede bastar para eso. La base
 * calcula sola quién lo necesita (`identidad.exige_segundo_factor`).
 *
 * ⛔ El secreto NUNCA se guarda en claro: se cifra con AES-256-GCM usando la
 * llave N4, que en producción viene del gestor de llaves. Una base robada
 * sin esa llave no entrega ni un segundo factor.
 *
 * Compatible con cualquier aplicación de autenticación (Google Authenticator,
 * Microsoft Authenticator, 1Password, Aegis).
 */
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function nuevoSecreto(): string {
  const b = randomBytes(20);
  let bits = '', salida = '';
  for (const x of b) bits += x.toString(2).padStart(8, '0');
  for (let i = 0; i + 5 <= bits.length; i += 5) salida += BASE32[parseInt(bits.slice(i, i + 5), 2)];
  return salida;
}

function deBase32(s: string): Buffer {
  let bits = '';
  for (const c of s.toUpperCase().replace(/=+$/, '')) {
    const i = BASE32.indexOf(c);
    if (i < 0) continue;
    bits += i.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function codigoEn(secreto: string, contador: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(contador));
  const h = createHmac('sha1', deBase32(secreto)).update(buf).digest();
  const off = h[h.length - 1] & 0x0f;
  const n = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(n % 1_000_000).padStart(6, '0');
}

/**
 * Verifica el código. Acepta una ventana de ±1 intervalo (30 s) porque los
 * relojes de los teléfonos se desfasan; más ventana que eso empieza a ser
 * un agujero.
 */
export function verificarCodigo(secreto: string, codigo: string): boolean {
  const limpio = (codigo ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(limpio)) return false;
  const paso = Math.floor(Date.now() / 1000 / 30);
  for (const d of [-1, 0, 1]) {
    const esperado = codigoEn(secreto, paso + d);
    const a = Buffer.from(esperado), b = Buffer.from(limpio);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

/** El texto que se convierte en código QR para la aplicación del teléfono. */
export function uriDeAprovisionamiento(secreto: string, usuario: string): string {
  const emisor = encodeURIComponent('Casa Sobre la Roca');
  const cuenta = encodeURIComponent(usuario);
  return `otpauth://totp/${emisor}:${cuenta}?secret=${secreto}&issuer=${emisor}&algorithm=SHA1&digits=6&period=30`;
}

/* ── El secreto, cifrado en reposo ─────────────────────────────────── */
function llave(secretoMaestro: string): Buffer {
  return createHmac('sha256', 'casaroca-segundo-factor').update(secretoMaestro).digest();
}

export function cifrarSecreto(secreto: string, maestra: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', llave(maestra), iv);
  const dato = Buffer.concat([c.update(secreto, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), dato.toString('base64url')].join('.');
}

export function descifrarSecreto(guardado: string, maestra: string): string | null {
  try {
    const [v, iv64, tag64, dato64] = guardado.split('.');
    if (v !== 'v1') return null;
    const d = createDecipheriv('aes-256-gcm', llave(maestra), Buffer.from(iv64, 'base64url'));
    d.setAuthTag(Buffer.from(tag64, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(dato64, 'base64url')), d.final()]).toString('utf8');
  } catch { return null; }
}
