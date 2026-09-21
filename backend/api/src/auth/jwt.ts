import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';

/**
 * Firma y verificación de tokens, con el `crypto` de Node.
 *
 * ⛔ El token NO es la autoridad. Es solo el sobre: dice qué sesión dice
 * ser. Quien decide es la BASE, que en cada petición responde si esa
 * sesión sigue viva (`identidad.contexto_de_sesion`). Por eso cerrar una
 * sesión surte efecto en el instante y no cuando el token expire.
 *
 * En producción con proveedor de identidad (Keycloak), la verificación
 * pasa a ser RS256 contra el JWKS del proveedor y el resto del flujo no
 * cambia: el punto de sustitución es `verificarToken`.
 */
export interface Cuerpo {
  sub: string;      // persona
  jti: string;      // sesión
  cta: string;      // cuenta
  typ: 'acceso' | 'refresco' | 'configurar_mfa';
  iat: number;
  exp: number;
}

function b64(o: unknown): string {
  return Buffer.from(JSON.stringify(o)).toString('base64url');
}

export function firmarToken(c: Omit<Cuerpo, 'iat' | 'exp'>, segundos: number, secreto: string): string {
  const ahora = Math.floor(Date.now() / 1000);
  const cuerpo: Cuerpo = { ...c, iat: ahora, exp: ahora + segundos };
  const cabecera = b64({ alg: 'HS256', typ: 'JWT' });
  const carga = b64(cuerpo);
  const firma = createHmac('sha256', secreto).update(`${cabecera}.${carga}`).digest('base64url');
  return `${cabecera}.${carga}.${firma}`;
}

export function verificarToken(token: string, secreto: string): Cuerpo | null {
  const partes = token.split('.');
  if (partes.length !== 3) return null;
  const [cabecera, carga, firma] = partes;
  const esperada = createHmac('sha256', secreto).update(`${cabecera}.${carga}`).digest('base64url');
  const a = Buffer.from(firma), b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const c = JSON.parse(Buffer.from(carga, 'base64url').toString('utf8')) as Cuerpo;
    if (typeof c.exp !== 'number' || c.exp < Math.floor(Date.now() / 1000)) return null;
    if (!c.jti || !c.sub || !c.cta) return null;
    return c;
  } catch { return null; }
}

export const nuevoJti = () => randomUUID();
