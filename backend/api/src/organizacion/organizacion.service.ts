import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { contextoActual } from '../contexto/contexto';

/**
 * Organización: las iglesias, sus ministerios y qué tiene encendido cada una.
 *
 * ⛔ OJO, Y LO COMPROBÉ EQUIVOCÁNDOME: `org.sedes` NO tiene RLS.
 * Escribí primero que la base filtraba sola y la prueba lo desmintió: un
 * LÍDER recibía las seis iglesias. No es un descuido de la base, es una
 * decisión: el esquema `org` es N1, y qué iglesias existe es información
 * pública, está en el sitio web. Solo `org.segmentos` lleva RLS.
 *
 * Pero un PANEL es otra cosa: al líder de un grupo no se le ofrece un
 * selector con las 36 iglesias de la red. Así que aquí sí se recorta por
 * alcance, EXPLÍCITAMENTE y diciendo por qué, en vez de dar por hecho que
 * alguien más lo hizo. Dar por hecho un control ajeno es como se abren
 * los agujeros.
 */
@Injectable()
export class OrganizacionService {
  async sedes(c: PoolClient) {
    const ctx = contextoActual();
    const { rows } = await c.query(
      `SELECT s.id, s.codigo, s.nombre, s.tipo, s.pais, s.ciudad, s.activa,
              (SELECT count(*) FROM org.ministerios_sede ms
                WHERE ms.sede_id = s.id AND ms.activo) AS ministerios_activos
         FROM org.sedes s
        WHERE s.activa
          AND ($1::boolean OR s.id = ANY($2::uuid[]))
        ORDER BY s.nombre`,
      [ctx.alcanceGlobal, ctx.sedeIds]);
    return rows;
  }

  async ministeriosDe(c: PoolClient, sedeId: string) {
    const { rows } = await c.query(
      `SELECT m.id, m.codigo, m.nombre, m.clase, m.nivel_dato,
              coalesce(ms.activo, false) AS activo, ms.activado_en
         FROM org.ministerios m
         LEFT JOIN org.ministerios_sede ms
                ON ms.ministerio_id = m.id AND ms.sede_id = $1
        ORDER BY m.clase, m.nombre`, [sedeId]);
    return rows;
  }

  /** Encender o apagar un ministerio en una iglesia. */
  async fijarMinisterio(c: PoolClient, sedeId: string, ministerioId: string, activo: boolean) {
    const { rows } = await c.query(
      `INSERT INTO org.ministerios_sede (sede_id, ministerio_id, activo, activado_en)
       VALUES ($1,$2,$3, CASE WHEN $3 THEN now() ELSE NULL END)
       ON CONFLICT (sede_id, ministerio_id)
       DO UPDATE SET activo = EXCLUDED.activo,
                     activado_en = CASE WHEN EXCLUDED.activo THEN now() ELSE NULL END
       RETURNING sede_id, ministerio_id, activo`,
      [sedeId, ministerioId, activo]);
    if (!rows.length) throw new NotFoundException('No existe esa iglesia o ese ministerio.');
    return rows[0];
  }

  /** El catálogo completo, para el centro de mando. */
  async ministerios(c: PoolClient) {
    const { rows } = await c.query(
      `SELECT id, codigo, nombre, clase, nivel_dato FROM org.ministerios
        ORDER BY clase, nombre`);
    return rows;
  }

  /**
   * Crear una iglesia. ⛔ La regla de la iglesia se cumple en la BASE:
   * una sede no existe sin pastor, y el pastor no va solo. Aquí solo se
   * traduce el error para que se entienda en pantalla.
   */
  async crearSede(c: PoolClient, d: any) {
    const ctx = contextoActual();
    if (!ctx.alcanceGlobal) {
      throw new BadRequestException('Solo la Dirección General abre iglesias.');
    }
    if (!d?.nombre?.trim()) throw new BadRequestException('Falta el nombre de la iglesia.');
    if (!d?.pastorId)  throw new BadRequestException('Una iglesia no se crea sin su pastor.');
    if (!d?.esposaId) {
      throw new BadRequestException(
        'Falta la esposa del pastor. En Casa Sobre la Roca los pastores se nombran en ' +
        'matrimonio: nunca se nombra un pastor solo.');
    }
    const { rows: [sede] } = await c.query(
      `INSERT INTO org.sedes (codigo, nombre, tipo, pais, ciudad)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, codigo, nombre`,
      [d.codigo ?? null, d.nombre.trim(), d.tipo ?? 'filial_nacional',
       d.pais ?? 'CO', d.ciudad ?? d.nombre.trim()]);

    /* Los dos quedan nombrados en el MISMO acto. Crear la iglesia y
       "acordarse" luego del pastor es como quedaban las sedes huérfanas. */
    const techo = (await c.query(
      `SELECT nivel_maximo FROM identidad.roles WHERE codigo='PASTOR_CONGREGACIONAL'`
    )).rows[0]?.nivel_maximo ?? 2;

    for (const pid of [d.pastorId, d.esposaId]) {
      await c.query(
        `INSERT INTO identidad.asignaciones
           (persona_id, rol, alcance_tipo, alcance_id, nivel_max, vigente_desde, otorgado_por, acta_referencia)
         VALUES ($1,'PASTOR_CONGREGACIONAL','sede',$2,$3,CURRENT_DATE,$4,$5)`,
        [pid, sede.id, techo, ctx.personaId, d.acta ?? null]);
    }
    return { ...sede, pastores: [d.pastorId, d.esposaId] };
  }
}
