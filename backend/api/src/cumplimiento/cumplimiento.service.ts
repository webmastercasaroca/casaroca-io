import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { contextoActual } from '../contexto/contexto';

/**
 * Derechos del titular · Ley 1581 de 2012 (Habeas Data).
 *
 * ⛔ 20 de septiembre de 2026. Toda esta maquinaria EXISTÍA en la base
 * desde la migración 0053 (plazos contados en días hábiles con los
 * festivos de Colombia, prórroga que exige motivo, supresión que borra de
 * verdad, revocación de consentimiento) y NO TENÍA NI UNA RUTA. Es decir:
 * el derecho estaba implementado y era inalcanzable salvo entrando a la
 * base con psql.
 *
 * Un derecho que solo puede ejercer quien sabe SQL no es un derecho. Y
 * ante la Superintendencia, «está en la base de datos» no es una respuesta:
 * lo que se mira es si la petición se radicó, si se contestó y en cuántos
 * días hábiles.
 *
 * Las reglas siguen viviendo en la base. Aquí solo hay puerta y traducción.
 */
@Injectable()
export class CumplimientoService {

  /** Radicar una petición. Devuelve el radicado y la fecha en que vence. */
  async radicar(c: PoolClient, d: {
    tipo: string; titularNombre: string; titularContacto: string; detalle: string;
    canal: string; titularId?: string | null; titularDocumento?: string | null;
    sedeId?: string | null;
  }) {
    const ctx = contextoActual();
    try {
      const { rows: [p] } = await c.query(
        `INSERT INTO plataforma.peticiones_titular
           (tipo, titular_id, titular_nombre, titular_documento, titular_contacto,
            detalle, canal, sede_id, responsable_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id, radicado, tipo, estado, recibida_en,
                   to_char(vence_en,'YYYY-MM-DD') AS vence_en`,
        [d.tipo, d.titularId ?? null, d.titularNombre, d.titularDocumento ?? null,
         d.titularContacto, d.detalle, d.canal, d.sedeId ?? null, ctx.personaId]);
      return {
        id: p.id, radicado: p.radicado, tipo: p.tipo, estado: p.estado,
        recibida_en: p.recibida_en, vence_en: p.vence_en,
        mensaje: `Petición radicada con el número ${p.radicado}. Vence el ${p.vence_en}.`,
      };
    } catch (e: any) {
      if (e.code === '23514') throw new BadRequestException('Ese tipo de petición no existe: ' + e.message);
      if (e.code === '23503') throw new BadRequestException('La persona o la sede indicada no existe.');
      throw e;
    }
  }

  /** La bandeja: lo que está abierto, y lo vencido primero. */
  async bandeja(c: PoolClient, f: { estado?: string | null; soloVencidas?: boolean; limite: number }) {
    const { rows } = await c.query(
      `SELECT p.id, p.radicado, p.tipo, p.estado, p.titular_nombre, p.titular_contacto,
              p.recibida_en, to_char(p.vence_en,'YYYY-MM-DD') AS vence_en,
              p.respondida_en, p.prorrogada_en,
              (p.vence_en < CURRENT_DATE AND p.estado NOT IN ('atendida','rechazada')) AS vencida,
              (p.vence_en - CURRENT_DATE) AS dias_restantes
         FROM plataforma.peticiones_titular p
        WHERE ($1::text IS NULL OR p.estado = $1)
          AND ($2::boolean IS NOT TRUE
               OR (p.vence_en < CURRENT_DATE AND p.estado NOT IN ('atendida','rechazada')))
        ORDER BY (p.estado NOT IN ('atendida','rechazada')) DESC, p.vence_en NULLS LAST
        LIMIT $3`,
      [f.estado ?? null, f.soloVencidas ?? false, f.limite]);
    const vencidas = rows.filter(r => r.vencida).length;
    return {
      total_filas: rows.length, vencidas,
      /* Se dice en la respuesta, no solo en una columna: una bandeja con
         peticiones vencidas es un incumplimiento en curso, no un dato. */
      aviso: vencidas > 0
        ? `⛔ ${vencidas} petición(es) VENCIDA(S). La ley no admite demora: responda hoy.`
        : null,
      peticiones: rows,
    };
  }

  /** Responder. Cierra la petición y deja la respuesta escrita. */
  async responder(c: PoolClient, id: string, d: { respuesta: string; evidencia?: string | null; rechazada?: boolean }) {
    const ctx = contextoActual();
    const { rows: [p] } = await c.query(
      `UPDATE plataforma.peticiones_titular
          SET estado = CASE WHEN $4 THEN 'rechazada' ELSE 'atendida' END,
              respuesta = $2, evidencia = $3, respondida_en = now(),
              responsable_id = COALESCE(responsable_id, $5)
        WHERE id = $1 AND estado NOT IN ('atendida','rechazada')
        RETURNING radicado, estado, recibida_en, respondida_en,
                  to_char(vence_en,'YYYY-MM-DD') AS vence_en,
                  (respondida_en::date > vence_en) AS fuera_de_plazo`,
      [id, d.respuesta, d.evidencia ?? null, d.rechazada === true, ctx.personaId]);
    if (!p) throw new NotFoundException('No existe esa petición, o ya fue cerrada.');
    return {
      radicado: p.radicado, estado: p.estado, respondida_en: p.respondida_en,
      fuera_de_plazo: p.fuera_de_plazo,
      /* Si se respondió tarde, se dice. Una respuesta tardía sigue siendo
         un incumplimiento y el registro tiene que poder demostrarlo. */
      aviso: p.fuera_de_plazo
        ? `Se respondió DESPUÉS del vencimiento (${p.vence_en}). Queda registrado así.`
        : null,
    };
  }

  /** Prorrogar. La base exige motivo y recalcula el plazo. */
  async prorrogar(c: PoolClient, id: string, d: { motivo: string; informada?: boolean }) {
    try {
      const { rows: [p] } = await c.query(
        `SELECT plataforma.prorrogar_peticion($1,$2,$3) AS vence_en`,
        [id, d.motivo, d.informada === true]);
      const { rows: [q] } = await c.query(
        `SELECT radicado, estado, to_char(vence_en,'YYYY-MM-DD') AS vence_en,
                prorroga_informada_en
           FROM plataforma.peticiones_titular WHERE id = $1`, [id]);
      return {
        radicado: q?.radicado, estado: q?.estado, vence_en: q?.vence_en,
        informada_al_titular: q?.prorroga_informada_en != null,
        aviso: q?.prorroga_informada_en == null
          ? 'La prórroga NO se le ha informado al titular todavía. La ley obliga a informarla.'
          : null,
      };
    } catch (e: any) {
      if (e.code === '23514' || e.code === 'P0001') throw new BadRequestException(e.message);
      if (e.code === '02000') throw new NotFoundException('No existe esa petición.');
      throw e;
    }
  }

  /** Ejecutar la supresión. Es irreversible y por eso pide confirmación. */
  async suprimir(c: PoolClient, id: string, confirmacion: string) {
    if (confirmacion !== 'SUPRIMIR') {
      throw new BadRequestException(
        'La supresión borra datos y no se deshace. Envíe confirmacion: "SUPRIMIR" para ejecutarla.');
    }
    const ctx = contextoActual();
    try {
      const { rows: [r] } = await c.query(
        `SELECT plataforma.ejecutar_supresion($1,$2) AS resultado`, [id, ctx.personaId]);
      return { resultado: r?.resultado, mensaje: 'Supresión ejecutada y registrada.' };
    } catch (e: any) {
      if (e.code === 'P0001' || e.code === '23514') throw new ConflictException(e.message);
      if (e.code === '02000') throw new NotFoundException('No existe esa petición.');
      throw e;
    }
  }

  /** Qué consentimientos tiene hoy una persona, canal por canal. */
  async consentimientos(c: PoolClient, personaId: string) {
    const { rows } = await c.query(
      `SELECT f.codigo AS finalidad, f.nombre, f.base_legal, cn.canal,
              plataforma.puede_contactar($1, cn.canal, f.codigo) AS puede
         FROM plataforma.finalidades f
         CROSS JOIN (SELECT unnest(enum_range(NULL::plataforma.canal_contacto)) AS canal) cn
        ORDER BY f.codigo, cn.canal`, [personaId]);
    const { rows: hechos } = await c.query(
      `SELECT acto, canal, finalidad, ocurrido_en, evidencia_tipo, calidad
         FROM plataforma.consentimientos
        WHERE persona_id = $1
        ORDER BY ocurrido_en DESC, registrado_en DESC
        LIMIT 100`, [personaId]);
    return { estado_actual: rows, historia: hechos };
  }

  /** Revocar. Sin canal ni finalidad, revoca TODO lo que dependa del consentimiento. */
  async revocar(c: PoolClient, d: { personaId: string; canal?: string | null; finalidad?: string | null; evidencia?: string | null }) {
    try {
      const { rows: [r] } = await c.query(
        `SELECT plataforma.revocar_consentimiento($1,$2::plataforma.canal_contacto,$3,$4) AS revocados`,
        [d.personaId, d.canal ?? null, d.finalidad ?? null,
         d.evidencia ?? 'solicitud del titular']);
      return {
        revocados: r?.revocados ?? 0,
        mensaje: d.canal || d.finalidad
          ? 'Revocado lo indicado. Lo que se apoya en contrato u obligación legal NO se revoca: la ley no lo permite.'
          : 'Revocado TODO lo que dependía del consentimiento.',
      };
    } catch (e: any) {
      if (e.code === '22P02') throw new BadRequestException('Canal o finalidad no válidos.');
      throw e;
    }
  }

  /** Lo que NO se envió, y por qué. La bandeja de lo no atendido. */
  async noAtendido(c: PoolClient) {
    const { rows } = await c.query(`SELECT * FROM plataforma.v_no_atendido LIMIT 200`);
    return { total_filas: rows.length, motivos: rows };
  }
}
