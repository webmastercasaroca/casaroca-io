import { ForbiddenException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { contextoActual } from '../contexto/contexto';

/**
 * «¿Puede quien llama hacer ESTA acción en ESTE módulo?»
 *
 * La RLS decide QUÉ FILAS ve cada quien; esto decide QUÉ ACCIONES puede
 * ejecutar. Son dos preguntas distintas: una tesorera y un digitador ven
 * los mismos aportes de su sede, pero solo la tesorera los confirma.
 *
 * Acepta los nombres de los dos documentos (`APROBAR_APORTE` del Drive y
 * `CONFIRMAR_APORTE` de la base): la traducción la hace `identidad.puede`.
 */
export async function exigir(c: PoolClient, modulo: string, accion: string): Promise<void> {
  const ctx = contextoActual();
  const { rows: [r] } = await c.query(
    `SELECT identidad.puede($1, $2, $3) AS puede`, [ctx.personaId, modulo, accion]);
  if (!r?.puede) {
    throw new ForbiddenException(
      `Su rol no tiene el permiso ${accion} sobre el módulo ${modulo}.`);
  }
}
