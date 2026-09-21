import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Derivación de contraseñas con scrypt.
 *
 * ⛔ Por qué scrypt y no SHA ni MD5: scrypt es MEMORIA-dura. Una tarjeta
 * gráfica acelera un SHA millones de veces; contra scrypt no puede, porque
 * el cuello no es el cálculo sino la memoria. Es lo que convierte una base
 * de contraseñas robada en un problema manejable en vez de en un desastre.
 *
 * ⛔ Y por qué del `crypto` de Node y no de una librería: una dependencia
 * menos es una superficie de suministro menos. scrypt está en el núcleo de
 * Node desde la versión 10 y es el mismo algoritmo que recomienda OWASP.
 *
 * Formato guardado: scrypt$N$r$p$sal$derivada  (todo en base64url).
 */
const N = 16384;   // coste de CPU y memoria: ~16 MB por verificación
const r = 8;
const p = 1;
const LARGO = 32;

export function derivarClave(clave: string): string {
  const sal = randomBytes(16);
  const der = scryptSync(clave.normalize('NFKC'), sal, LARGO, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return ['scrypt', N, r, p, sal.toString('base64url'), der.toString('base64url')].join('$');
}

export function verificarClave(clave: string, guardado: string | null): boolean {
  if (!guardado) return false;
  const partes = guardado.split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;
  const [, sN, sr, sp, sal64, der64] = partes;
  try {
    const der = Buffer.from(der64, 'base64url');
    const calc = scryptSync(clave.normalize('NFKC'), Buffer.from(sal64, 'base64url'), der.length, {
      N: Number(sN), r: Number(sr), p: Number(sp), maxmem: 64 * 1024 * 1024,
    });
    /* Comparación en tiempo constante: comparar con === filtra, por el
       tiempo de respuesta, cuántos bytes iniciales acertó quien prueba. */
    return timingSafeEqual(der, calc);
  } catch { return false; }
}

/**
 * Política mínima de contraseña. Deliberadamente por LARGO y no por
 * "un número y un símbolo": una frase larga es más fuerte y más fácil de
 * recordar que «P@ssw0rd», y no termina escrita en un papel bajo el teclado.
 */
export function revisarPolitica(clave: string): string | null {
  if (!clave || clave.length < 12) return 'La contraseña debe tener al menos 12 caracteres. Una frase que recuerde sirve mejor que un jeroglífico.';
  if (clave.length > 200) return 'La contraseña es demasiado larga.';
  const comunes = ['casaroca', 'contrasena', 'password', '123456', 'iglesia', 'qwerty', 'casasobrelaroca'];
  const baja = clave.toLowerCase();
  if (comunes.some(c => baja.includes(c))) return 'La contraseña contiene una palabra demasiado previsible.';
  return null;
}
