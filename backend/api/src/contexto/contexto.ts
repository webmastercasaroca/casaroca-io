/**
 * El contexto de la petición.
 *
 * Es la primera cerradura: la aplicación decide quién es el usuario, qué
 * sedes puede tocar y hasta qué nivel de dato alcanza. Ese contexto se
 * escribe en la transacción con SET LOCAL, y la segunda cerradura (RLS)
 * lo lee desde la base.
 *
 * Se guarda en AsyncLocalStorage y no en una variable de módulo: con un
 * pool de conexiones y peticiones concurrentes, una variable compartida
 * es exactamente el fallo que hace que una petición herede la sede de
 * la anterior.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import type { PoolClient } from 'pg';

export interface Contexto {
  personaId: string | null;
  sedeIds: string[];
  nivelMax: number;
  alcanceGlobal: boolean;
  ip: string | null;
  /** El cliente de la transacción abierta para esta petición. */
  cliente?: PoolClient;
}

export const almacen = new AsyncLocalStorage<Contexto>();

export function contextoActual(): Contexto {
  const c = almacen.getStore();
  if (!c) {
    throw new Error(
      'No hay contexto de petición. Toda consulta debe correr dentro de ' +
      'DbService.enTransaccion(): sin contexto la base no devuelve nada, ' +
      'y eso es lo correcto, pero el error real está aquí.',
    );
  }
  return c;
}

/** Contexto de la puerta pública: sin identidad, una sola sede, nivel ordinario. */
export function contextoPublico(sedeId: string, ip: string | null): Contexto {
  return { personaId: null, sedeIds: [sedeId], nivelMax: 2, alcanceGlobal: false, ip };
}
