import { BadRequestException, Body, Controller, Get, Module, Param, Post, Query, Req, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { DbModule } from '../db/db.module';
import { DbService } from '../db/db.service';
import { conSesion, exigirNivel, sesionDe } from '../comun/identidad.helper';
import { uuid, uuidOpcional, texto, textoOpcional, entero, fecha, paginacion } from '../comun/validar';

/**
 * Grupos y hogares · donde de verdad pasa el acompañamiento.
 *
 * ⛔ Lo que este módulo protege: que una persona no desaparezca. Un grupo
 * con quince miembros y cero reuniones reportadas en dos meses no es un
 * grupo: es una lista. Por eso cada grupo lleva a la vista cuándo se
 * reunió por última vez, y la bandeja ordena por eso.
 */
@Controller('api/v1/grupos')
export class GruposController {
  constructor(private readonly db: DbService) {}

  @Get()
  lista(@Req() req: Request, @Query() q: any) {
    exigirNivel(req, 2, 'ver los grupos');
    const { limite, desde } = paginacion(q);
    return conSesion(this.db, req, async (c) => {
      const { rows } = await c.query(
        `SELECT g.id, g.nombre, g.tipo, g.sede_id, se.codigo AS sede, g.dia_reunion,
                to_char(g.hora_reunion,'HH24:MI') AS hora, g.cupo, g.abierto,
                g.cerrado_en IS NOT NULL AS cerrado,
                (SELECT count(*) FROM grupos.membresias m
                  WHERE m.grupo_id = g.id AND m.fecha_salida IS NULL) AS miembros,
                (SELECT to_char(max(r.fecha),'YYYY-MM-DD') FROM grupos.reuniones r
                  WHERE r.grupo_id = g.id) AS ultima_reunion,
                (SELECT CURRENT_DATE - max(r.fecha) FROM grupos.reuniones r
                  WHERE r.grupo_id = g.id) AS dias_sin_reunirse
           FROM grupos.grupos g
           JOIN org.sedes se ON se.id = g.sede_id
          WHERE ($1::uuid IS NULL OR g.sede_id = $1)
            AND ($2::boolean IS NOT TRUE OR g.cerrado_en IS NULL)
          ORDER BY (SELECT max(r.fecha) FROM grupos.reuniones r WHERE r.grupo_id = g.id) NULLS FIRST,
                   g.nombre
          LIMIT $3 OFFSET $4`,
        [uuidOpcional(q?.sede_id, 'sede_id'), q?.abiertos !== 'no', limite, desde]);
      const mudos = rows.filter(r => r.dias_sin_reunirse === null || r.dias_sin_reunirse > 45).length;
      return {
        total_filas: rows.length, desde, grupos: rows,
        aviso: mudos > 0
          ? `${mudos} grupo(s) sin reunión reportada en más de 45 días, o sin ninguna. Un grupo que no se reúne es una lista.`
          : null,
      };
    });
  }

  @Post()
  crear(@Req() req: Request, @Body() b: any) {
    exigirNivel(req, 2, 'crear un grupo');
    return conSesion(this.db, req, async (c) => {
      try {
        const { rows: [g] } = await c.query(
          `INSERT INTO grupos.grupos (sede_id, tipo, nombre, dia_reunion, hora_reunion, cupo, abierto, ministerio_id, segmento_id)
           VALUES ($1,$2,$3,$4,$5::time,$6,COALESCE($7,true),$8,$9)
           RETURNING id, nombre, tipo`,
          [uuid(b?.sedeId, 'sedeId'), texto(b?.tipo, 'tipo', { min: 2, max: 40 }),
           texto(b?.nombre, 'nombre', { min: 3, max: 120 }),
           textoOpcional(b?.diaReunion, 'diaReunion', { max: 20 }),
           b?.hora ? texto(b.hora, 'hora', { patron: /^\d{2}:\d{2}$/ }) : null,
           b?.cupo === undefined || b?.cupo === null ? null : entero(b.cupo, 'cupo', { min: 1, max: 500 }),
           b?.abierto === false ? false : true,
           uuidOpcional(b?.ministerioId, 'ministerioId'), uuidOpcional(b?.segmentoId, 'segmentoId')]);
        return { ...g, mensaje: 'Grupo creado.' };
      } catch (e: any) {
        if (e.code === '23503') throw new BadRequestException('La sede, el ministerio o el segmento no existen o no están en su alcance.');
        if (e.code === '23514') throw new BadRequestException('El grupo no cumple las reglas: ' + e.message);
        throw e;
      }
    });
  }

  /** La ficha: quién está, quién se fue y cuándo se reunieron. */
  @Get(':id')
  ficha(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 2, 'ver un grupo');
    return conSesion(this.db, req, async (c) => {
      const g = uuid(id, 'id');
      const { rows: [grupo] } = await c.query(
        `SELECT g.id, g.nombre, g.tipo, g.sede_id, se.codigo AS sede, g.dia_reunion,
                to_char(g.hora_reunion,'HH24:MI') AS hora, g.cupo, g.abierto,
                to_char(g.cerrado_en,'YYYY-MM-DD') AS cerrado_en
           FROM grupos.grupos g JOIN org.sedes se ON se.id = g.sede_id
          WHERE g.id = $1`, [g]);
      if (!grupo) throw new NotFoundException('Ese grupo no existe o no está en su alcance.');
      const { rows: miembros } = await c.query(
        `SELECT m.id, m.persona_id, p.nombre_completo, m.rol,
                to_char(m.fecha_ingreso,'YYYY-MM-DD') AS desde,
                to_char(m.fecha_salida,'YYYY-MM-DD') AS hasta, m.motivo_salida
           FROM grupos.membresias m JOIN nucleo.v_personas p ON p.id = m.persona_id
          WHERE m.grupo_id = $1
          ORDER BY m.fecha_salida NULLS FIRST, p.nombre_completo`, [g]);
      const { rows: reuniones } = await c.query(
        `SELECT r.id, to_char(r.fecha,'YYYY-MM-DD') AS fecha, r.tema, r.asistentes
           FROM grupos.reuniones r WHERE r.grupo_id = $1
          ORDER BY r.fecha DESC LIMIT 24`, [g]);
      return {
        grupo,
        miembros: { activos: miembros.filter(m => !m.hasta).length, total: miembros.length, lista: miembros },
        reuniones,
      };
    });
  }

  @Post(':id/miembros')
  agregar(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 2, 'agregar a alguien a un grupo');
    return conSesion(this.db, req, async (c) => {
      const g = uuid(id, 'id'), p = uuid(b?.personaId, 'personaId');
      const { rows: [ya] } = await c.query(
        `SELECT id FROM grupos.membresias WHERE grupo_id=$1 AND persona_id=$2 AND fecha_salida IS NULL`, [g, p]);
      if (ya) return { id: ya.id, repetido: true, mensaje: 'Esa persona ya está en el grupo.' };
      try {
        const { rows: [m] } = await c.query(
          `INSERT INTO grupos.membresias (grupo_id, persona_id, rol, fecha_ingreso)
           VALUES ($1,$2,COALESCE($3,'miembro'),COALESCE($4::date,CURRENT_DATE)) RETURNING id`,
          [g, p, textoOpcional(b?.rol, 'rol', { max: 30 }), b?.desde ? fecha(b.desde, 'desde') : null]);
        return { id: m.id, repetido: false, mensaje: 'Agregado al grupo.' };
      } catch (e: any) {
        if (e.code === '23503') throw new BadRequestException('El grupo o la persona no están en su alcance.');
        if (e.code === '23514') throw new BadRequestException(e.message);
        throw e;
      }
    });
  }

  /** Sacar a alguien EXIGE motivo: «se fue» no dice nada al que viene detrás. */
  @Post(':id/miembros/:personaId/salir')
  salir(@Req() req: Request, @Param('id') id: string, @Param('personaId') personaId: string, @Body() b: any) {
    exigirNivel(req, 2, 'sacar a alguien de un grupo');
    return conSesion(this.db, req, async (c) => {
      const { rows: [m] } = await c.query(
        `UPDATE grupos.membresias
            SET fecha_salida = COALESCE($3::date, CURRENT_DATE), motivo_salida = $4
          WHERE grupo_id = $1 AND persona_id = $2 AND fecha_salida IS NULL
          RETURNING id, to_char(fecha_salida,'YYYY-MM-DD') AS hasta`,
        [uuid(id, 'id'), uuid(personaId, 'personaId'),
         b?.hasta ? fecha(b.hasta, 'hasta') : null,
         texto(b?.motivo, 'motivo', { min: 5, max: 300 })]);
      if (!m) throw new NotFoundException('Esa persona no está activa en ese grupo.');
      return { ...m, mensaje: 'Salida registrada con su motivo.' };
    });
  }

  /** Reportar la reunión. Es lo que convierte una lista en un grupo vivo. */
  @Post(':id/reuniones')
  reunion(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 2, 'reportar una reunión');
    const s = sesionDe(req);
    return conSesion(this.db, req, async (c) => {
      try {
        const { rows: [r] } = await c.query(
          `INSERT INTO grupos.reuniones (grupo_id, fecha, tema, asistentes, reportada_por)
           VALUES ($1,COALESCE($2::date,CURRENT_DATE),$3,$4,$5)
           RETURNING id, to_char(fecha,'YYYY-MM-DD') AS fecha, tema, asistentes`,
          [uuid(id, 'id'), b?.fecha ? fecha(b.fecha, 'fecha') : null,
           textoOpcional(b?.tema, 'tema', { max: 300 }),
           b?.asistentes === undefined || b?.asistentes === null ? null : entero(b.asistentes, 'asistentes', { min: 0, max: 500 }),
           s.personaId]);
        return { ...r, mensaje: 'Reunión reportada.' };
      } catch (e: any) {
        if (e.code === '23505') throw new BadRequestException('Ya hay una reunión reportada de ese grupo ese día.');
        if (e.code === '23503') throw new BadRequestException('Ese grupo no está en su alcance.');
        throw e;
      }
    });
  }
}

@Module({ imports: [DbModule], controllers: [GruposController] })
export class GruposModule {}
