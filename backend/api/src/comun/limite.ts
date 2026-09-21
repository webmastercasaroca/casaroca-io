import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Límite de peticiones, en memoria del proceso.
 *
 * ⛔ Qué cubre y qué NO. Cubre la fuerza bruta y el abuso desde una
 * conexión contra UNA instancia. Con varias instancias detrás del
 * balanceador, cada una lleva su propia cuenta, así que el límite real es
 * el número de instancias por el configurado. Para el tamaño de esta red
 * (36 sedes) es suficiente y no añade una dependencia de Redis; queda
 * escrito para que nadie lo descubra por sorpresa. La defensa de verdad
 * contra la fuerza bruta es el bloqueo POR CUENTA, que vive en la base y
 * sí es compartido entre instancias.
 */
type Cubo = { golpes: number; reinicia: number };
const cubos = new Map<string, Cubo>();

setInterval(() => {
  const ahora = Date.now();
  for (const [k, v] of cubos) if (v.reinicia < ahora) cubos.delete(k);
}, 60_000).unref?.();

export function limitarPorClave(clave: string, maximo: number, ventanaMs: number, mensaje?: string): void {
  const ahora = Date.now();
  const c = cubos.get(clave);
  if (!c || c.reinicia < ahora) {
    cubos.set(clave, { golpes: 1, reinicia: ahora + ventanaMs });
    return;
  }
  c.golpes += 1;
  if (c.golpes > maximo) {
    const faltan = Math.ceil((c.reinicia - ahora) / 1000);
    throw new HttpException(
      { mensaje: mensaje ?? 'Demasiadas peticiones. Espere un momento.', reintentarEnSegundos: faltan },
      HttpStatus.TOO_MANY_REQUESTS);
  }
}

export const estadoDelLimite = () => ({ clavesVigiladas: cubos.size });
