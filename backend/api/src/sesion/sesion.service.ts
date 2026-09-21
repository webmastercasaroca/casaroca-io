import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { contextoActual } from '../contexto/contexto';

/**
 * Quién entró y qué alcanza. Es la primera pregunta de cualquier panel.
 *
 * ⛔ El prototipo respondía esto leyendo localStorage; aquí lo responde la
 * BASE, a partir de las asignaciones vigentes. Es la diferencia entre un
 * permiso que se puede editar con el inspector del navegador y uno que no.
 */
@Injectable()
export class SesionService {
  async yo(c: PoolClient) {
    const ctx = contextoActual();

    const persona = await c.query(
      `SELECT id, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
              email_principal, tipo_documento, numero_documento
         FROM nucleo.personas WHERE id = $1`, [ctx.personaId]);

    const asignaciones = await c.query(
      `SELECT a.rol, a.alcance_tipo, a.alcance_id, a.nivel_max,
              a.vigente_desde, a.vigente_hasta,
              r.nombre AS rol_nombre, s.nombre AS sede_nombre, s.codigo AS sede_codigo
         FROM identidad.asignaciones a
         LEFT JOIN identidad.roles r ON r.codigo = a.rol
         LEFT JOIN org.sedes s ON s.id = a.alcance_id
        WHERE a.persona_id = $1
          AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)
        ORDER BY a.nivel_max DESC`, [ctx.personaId]);

    const modulos = await c.query(
      `SELECT DISTINCT p.modulo, m.nombre, m.nivel_dato
         FROM sistema.matriz_permisos p
         JOIN sistema.modulos m ON m.codigo = p.modulo
        WHERE p.rol = ANY($1::text[]) AND m.nivel_dato <= $2
        ORDER BY p.modulo`,
      [asignaciones.rows.map(a => a.rol), ctx.nivelMax]);

    const p = persona.rows[0] ?? {};
    return {
      persona: {
        id: ctx.personaId,
        nombre: [p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido]
          .filter(Boolean).join(' '),
        correo: p.email_principal ?? null,
        documento: p.numero_documento ? `${p.tipo_documento} ${p.numero_documento}` : null,
      },
      alcance: {
        sedes: ctx.sedeIds,
        todaLaRed: ctx.alcanceGlobal,
        nivelMax: ctx.nivelMax,
      },
      asignaciones: asignaciones.rows,
      /* Lo que ESTA persona alcanza. El panel pinta contra esto y no
         contra su propia lista cableada, que es lo que permitía abrir
         una pestaña que el permiso ya negaba. */
      modulos: modulos.rows,
    };
  }
}
