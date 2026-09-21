import { BadRequestException, Body, Controller, Get, Module, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { DbModule } from '../db/db.module';
import { DbService } from '../db/db.service';
import { conSesion, exigirNivel, sesionDe } from '../comun/identidad.helper';
import { uuid, uuidOpcional, texto, textoOpcional, entero, fecha, paginacion } from '../comun/validar';

/**
 * Asistencia · el servicio del domingo.
 *
 * Dos formas de contar, y las dos hacen falta:
 *   · la LISTA (quién entró), que sirve para el seguimiento pastoral;
 *   · el CONTEO (cuántos hubo), que es lo único que se puede hacer cuando
 *     entran seiscientas personas por una puerta en diez minutos.
 *
 * ⛔ El conteo NO se deriva de la lista: si se derivara, una sede que no
 *    alcanza a marcar a nadie reportaría cero asistentes, y eso no es
 *    «cero», es «no se marcó». Son dos números distintos y se guardan
 *    aparte, con su diferencia a la vista.
 */
@Controller('api/v1/asistencia')
export class AsistenciaController {
  constructor(private readonly db: DbService) {}

  /** Los servicios de una sede, del más reciente al más viejo. */
  @Get('servicios')
  servicios(@Req() req: Request, @Query() q: any) {
    exigirNivel(req, 2, 'ver la asistencia');
    const { limite, desde } = paginacion(q);
    return conSesion(this.db, req, async (c) => {
      const { rows } = await c.query(
        `SELECT s.id, s.sede_id, se.codigo AS sede, to_char(s.fecha,'YYYY-MM-DD') AS fecha,
                to_char(s.hora_inicio,'HH24:MI') AS hora, s.tipo, s.nombre, s.admite_checkin,
                (SELECT count(*) FROM asistencia.entradas e WHERE e.servicio_id = s.id) AS marcados,
                cn.total AS contados, cn.adultos, cn.jovenes, cn.ninos, cn.primera_vez
           FROM asistencia.servicios s
           JOIN org.sedes se ON se.id = s.sede_id
           LEFT JOIN asistencia.conteos cn ON cn.servicio_id = s.id
          WHERE ($1::uuid IS NULL OR s.sede_id = $1)
            AND ($2::date IS NULL OR s.fecha >= $2)
          ORDER BY s.fecha DESC, s.hora_inicio DESC
          LIMIT $3 OFFSET $4`,
        [uuidOpcional(q?.sede_id, 'sede_id'), q?.desde_fecha ? fecha(q.desde_fecha, 'desde_fecha') : null,
         limite, desde]);
      return { total_filas: rows.length, desde, servicios: rows };
    });
  }

  /** Abrir un servicio. Sin servicio abierto no se marca a nadie. */
  @Post('servicios')
  crearServicio(@Req() req: Request, @Body() b: any) {
    exigirNivel(req, 2, 'abrir un servicio');
    return conSesion(this.db, req, async (c) => {
      try {
        const { rows: [s] } = await c.query(
          `INSERT INTO asistencia.servicios (sede_id, fecha, hora_inicio, tipo, nombre, admite_checkin)
           VALUES ($1,$2,$3::time,$4,$5,COALESCE($6,true))
           RETURNING id, to_char(fecha,'YYYY-MM-DD') AS fecha, to_char(hora_inicio,'HH24:MI') AS hora, tipo, nombre`,
          [uuid(b?.sedeId, 'sedeId'), fecha(b?.fecha, 'fecha'),
           texto(b?.hora, 'hora', { patron: /^\d{2}:\d{2}$/ }),
           texto(b?.tipo, 'tipo', { min: 2, max: 40 }),
           textoOpcional(b?.nombre, 'nombre', { max: 120 }),
           b?.admiteCheckin === false ? false : true]);
        return { ...s, mensaje: 'Servicio abierto. Ya se puede marcar asistencia.' };
      } catch (e: any) {
        if (e.code === '23505') throw new BadRequestException('Ya hay un servicio de esa sede a esa hora ese día.');
        if (e.code === '23503') throw new BadRequestException('Esa sede no existe o no está en su alcance.');
        throw e;
      }
    });
  }

  /** Marcar a alguien. Idempotente: marcar dos veces no cuenta dos veces. */
  @Post('servicios/:id/marcar')
  marcar(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 2, 'marcar asistencia');
    return conSesion(this.db, req, async (c) => {
      const servicio = uuid(id, 'id');
      const persona = uuid(b?.personaId, 'personaId');
      const { rows: [ya] } = await c.query(
        `SELECT id FROM asistencia.entradas WHERE servicio_id = $1 AND persona_id = $2`,
        [servicio, persona]);
      if (ya) return { id: ya.id, repetido: true, mensaje: 'Esa persona ya estaba marcada en este servicio.' };
      try {
        const { rows: [e] } = await c.query(
          `INSERT INTO asistencia.entradas (servicio_id, persona_id, medio)
           VALUES ($1,$2,COALESCE($3,'manual')) RETURNING id, marcada_en`,
          [servicio, persona, textoOpcional(b?.medio, 'medio', { max: 20 })]);
        return { id: e.id, repetido: false, marcada_en: e.marcada_en };
      } catch (err: any) {
        if (err.code === '23503') throw new BadRequestException('El servicio o la persona no están en su alcance.');
        throw err;
      }
    });
  }

  /** Quién está marcado hoy en ese servicio. */
  @Get('servicios/:id/marcados')
  marcados(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 2, 'ver quién asistió');
    return conSesion(this.db, req, async (c) => {
      const { rows } = await c.query(
        `SELECT e.id, e.persona_id, p.nombre_completo, e.marcada_en, e.medio
           FROM asistencia.entradas e
           JOIN nucleo.v_personas p ON p.id = e.persona_id
          WHERE e.servicio_id = $1
          ORDER BY e.marcada_en DESC`, [uuid(id, 'id')]);
      return { total_filas: rows.length, marcados: rows };
    });
  }

  /**
   * El conteo de cabeza. Se puede corregir: el primer número de un domingo
   * siempre es el que alguien gritó desde la puerta.
   */
  @Post('servicios/:id/conteo')
  conteo(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 2, 'reportar el conteo');
    const s = sesionDe(req);
    return conSesion(this.db, req, async (c) => {
      const servicio = uuid(id, 'id');
      const n = (v: unknown, campo: string) =>
        v === undefined || v === null ? 0 : entero(v, campo, { min: 0, max: 100000 });
      const { rows: [r] } = await c.query(
        `INSERT INTO asistencia.conteos (servicio_id, adultos, jovenes, ninos, primera_vez, reportado_por)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (servicio_id) DO UPDATE
           SET adultos = EXCLUDED.adultos, jovenes = EXCLUDED.jovenes,
               ninos = EXCLUDED.ninos, primera_vez = EXCLUDED.primera_vez,
               reportado_por = EXCLUDED.reportado_por, reportado_en = now()
         RETURNING total, adultos, jovenes, ninos, primera_vez, reportado_en`,
        [servicio, n(b?.adultos, 'adultos'), n(b?.jovenes, 'jovenes'),
         n(b?.ninos, 'ninos'), n(b?.primeraVez, 'primeraVez'), s.personaId]);
      const { rows: [m] } = await c.query(
        `SELECT count(*)::int AS marcados FROM asistencia.entradas WHERE servicio_id = $1`, [servicio]);
      return {
        ...r, marcados: m.marcados,
        /* ⛔ La diferencia se DICE. Un conteo de 600 con 12 marcados no es
           un error del sistema, es la realidad de una puerta un domingo,
           pero quien mire el informe tiene que saber cuál número es cuál. */
        diferencia: r.total - m.marcados,
        aviso: r.total !== m.marcados
          ? `Contados ${r.total} y marcados ${m.marcados}: el conteo es el número de la puerta, la lista es para el seguimiento.`
          : null,
      };
    });
  }
}

@Module({ imports: [DbModule], controllers: [AsistenciaController] })
export class AsistenciaModule {}
