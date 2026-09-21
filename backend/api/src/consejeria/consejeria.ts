import { BadRequestException, Body, Controller, Get, Module, Param, Post, Query, Req, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { DbModule } from '../db/db.module';
import { DbService } from '../db/db.service';
import { conSesion, exigirNivel, sesionDe } from '../comun/identidad.helper';
import { uuid, uuidOpcional, texto, textoOpcional, entero, unoDe, paginacion } from '../comun/validar';

const ESTADOS = ['abierto', 'en_proceso', 'en_pausa', 'cerrado', 'derivado'] as const;

/**
 * Consejería · el módulo más delicado del sistema.
 *
 * ⛔ Reglas que NO se negocian, y que vienen de la base, no de aquí:
 *   · Un caso lo ve su consejero asignado y el pastor de la sede. Nadie más,
 *     ni siquiera alguien con N4 de otra sede (`consejeria.caso_visible`).
 *   · Las NOTAS no se devuelven en la lista. Una nota de consejería es lo
 *     más privado que guarda esta iglesia, y una lista que las trae de
 *     paso las reparte por accidente.
 *   · Leer un caso deja rastro (`plataforma.bitacora_lectura`). Quien entra
 *     a mirar por curiosidad queda escrito, y saberlo es la mitad de la
 *     protección.
 */
@Controller('api/v1/consejeria')
export class ConsejeriaController {
  constructor(private readonly db: DbService) {}

  /** Los tópicos, para que nadie escriba «problema familiar» de doce formas. */
  @Get('topicos')
  topicos(@Req() req: Request) {
    exigirNivel(req, 3, 'ver los tópicos de consejería');
    return conSesion(this.db, req, async (c) => {
      const { rows } = await c.query(
        `SELECT codigo, nombre, categoria, requiere_profesional
           FROM consejeria.topicos ORDER BY categoria, nombre`);
      return { total_filas: rows.length, topicos: rows };
    });
  }

  /** La bandeja. SIN notas y SIN el detalle: solo lo que permite priorizar. */
  @Get('casos')
  casos(@Req() req: Request, @Query() q: any) {
    exigirNivel(req, 3, 'ver los casos de consejería');
    const { limite, desde } = paginacion(q);
    return conSesion(this.db, req, async (c) => {
      const { rows } = await c.query(
        `SELECT k.id, k.estado, k.topico, t.nombre AS topico_nombre, t.requiere_profesional,
                k.sede_id, se.codigo AS sede, k.abierto_en, k.cerrado_en,
                p.nombre_completo AS consultante,
                (CURRENT_DATE - k.abierto_en::date) AS dias_abierto,
                (SELECT count(*) FROM consejeria.sesiones s WHERE s.caso_id = k.id) AS sesiones,
                (SELECT to_char(max(s.fecha),'YYYY-MM-DD') FROM consejeria.sesiones s WHERE s.caso_id = k.id) AS ultima_sesion,
                (SELECT string_agg(cp.nombre_completo, ', ')
                   FROM consejeria.asignaciones a
                   JOIN nucleo.v_personas cp ON cp.id = a.consejero_id
                  WHERE a.caso_id = k.id AND a.hasta IS NULL) AS consejeros
           FROM consejeria.casos k
           JOIN org.sedes se ON se.id = k.sede_id
           JOIN nucleo.v_personas p ON p.id = k.consultante_id
           LEFT JOIN consejeria.topicos t ON t.codigo = k.topico
          WHERE ($1::text IS NULL OR k.estado::text = $1)
          ORDER BY (k.estado::text IN ('abierto','en_proceso')) DESC, k.abierto_en
          LIMIT $2 OFFSET $3`,
        [q?.estado ? unoDe(q.estado, 'estado', ESTADOS) : null, limite, desde]);
      const sin = rows.filter(r => !r.consejeros && r.estado !== 'cerrado').length;
      return {
        total_filas: rows.length, desde, casos: rows,
        aviso: sin > 0
          ? `${sin} caso(s) abierto(s) SIN consejero asignado. Un caso sin nadie detrás es una persona esperando.`
          : null,
      };
    });
  }

  @Post('casos')
  abrir(@Req() req: Request, @Body() b: any) {
    exigirNivel(req, 3, 'abrir un caso de consejería');
    return conSesion(this.db, req, async (c) => {
      try {
        const { rows: [k] } = await c.query(
          `INSERT INTO consejeria.casos (consultante_id, sede_id, topico, estado)
           VALUES ($1,$2,$3,'abierto') RETURNING id, estado, abierto_en`,
          [uuid(b?.consultanteId, 'consultanteId'), uuid(b?.sedeId, 'sedeId'),
           texto(b?.topico, 'topico', { min: 2, max: 40 })]);
        return { ...k, mensaje: 'Caso abierto. Asígnele un consejero: un caso sin nadie detrás es una persona esperando.' };
      } catch (e: any) {
        if (e.code === '23503') throw new BadRequestException('La persona, la sede o el tópico no existen.');
        throw e;
      }
    });
  }

  /** La ficha. Aquí SÍ van las notas, y leerla deja rastro. */
  @Get('casos/:id')
  ficha(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 3, 'ver un caso de consejería');
    const s = sesionDe(req);
    return conSesion(this.db, req, async (c) => {
      const k = uuid(id, 'id');
      const { rows: [caso] } = await c.query(
        `SELECT k.id, k.estado, k.topico, t.nombre AS topico_nombre, k.sede_id,
                k.abierto_en, k.cerrado_en, k.derivado_a,
                k.consultante_id, p.nombre_completo AS consultante
           FROM consejeria.casos k
           LEFT JOIN consejeria.topicos t ON t.codigo = k.topico
           JOIN nucleo.v_personas p ON p.id = k.consultante_id
          WHERE k.id = $1`, [k]);
      if (!caso) throw new NotFoundException('Ese caso no existe o no está a su alcance.');

      /* ⛔ Rastro de lectura ANTES de devolver nada. Si la escritura del
         rastro falla, no se entrega el caso: un dato N3 que se lee sin
         dejar huella es exactamente lo que la bitácora existe para evitar. */
      await c.query(
        `SELECT plataforma.registrar_lectura('consejeria','casos',$1,3::smallint,$2)`,
        [k, 'ficha completa del caso, con notas']);

      const { rows: asignaciones } = await c.query(
        `SELECT a.id, a.consejero_id, cp.nombre_completo AS consejero, a.rol, a.desde, a.hasta
           FROM consejeria.asignaciones a JOIN nucleo.v_personas cp ON cp.id = a.consejero_id
          WHERE a.caso_id = $1 ORDER BY a.hasta NULLS FIRST, a.desde DESC`, [k]);
      const { rows: sesiones } = await c.query(
        `SELECT s.id, s.fecha, s.duracion_min, s.modalidad, s.asistio,
                cp.nombre_completo AS consejero
           FROM consejeria.sesiones s JOIN nucleo.v_personas cp ON cp.id = s.consejero_id
          WHERE s.caso_id = $1 ORDER BY s.fecha DESC`, [k]);
      const { rows: notas } = await c.query(
        `SELECT n.id, n.escrita_en, n.contenido AS texto, cp.nombre_completo AS autor
           FROM consejeria.notas n LEFT JOIN nucleo.v_personas cp ON cp.id = n.autor_id
          WHERE n.caso_id = $1 ORDER BY n.escrita_en DESC`, [k]);
      return { caso, asignaciones, sesiones, notas, lectura_registrada: true };
    });
  }

  @Post('casos/:id/asignar')
  asignar(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 3, 'asignar un consejero');
    const s = sesionDe(req);
    return conSesion(this.db, req, async (c) => {
      try {
        const { rows: [a] } = await c.query(
          `INSERT INTO consejeria.asignaciones (caso_id, consejero_id, rol, asignado_por)
           VALUES ($1,$2,COALESCE($3,'consejero'),$4) RETURNING id, desde`,
          [uuid(id, 'id'), uuid(b?.consejeroId, 'consejeroId'),
           textoOpcional(b?.rol, 'rol', { max: 30 }), s.personaId]);
        await c.query(
          `UPDATE consejeria.casos SET estado='en_proceso'
            WHERE id=$1 AND estado='abierto'`, [uuid(id, 'id')]);
        return { ...a, mensaje: 'Consejero asignado. El caso pasa a «en proceso».' };
      } catch (e: any) {
        if (e.code === '23503') throw new BadRequestException('El caso o la persona no están a su alcance.');
        throw e;
      }
    });
  }

  @Post('casos/:id/sesiones')
  sesion(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 3, 'registrar una sesión');
    const s = sesionDe(req);
    return conSesion(this.db, req, async (c) => {
      const { rows: [r] } = await c.query(
        `INSERT INTO consejeria.sesiones (caso_id, consejero_id, fecha, duracion_min, modalidad, asistio)
         VALUES ($1,$2,COALESCE($3::timestamptz,now()),$4,$5,COALESCE($6,true))
         RETURNING id, fecha, asistio`,
        [uuid(id, 'id'), uuidOpcional(b?.consejeroId, 'consejeroId') ?? s.personaId,
         textoOpcional(b?.fecha, 'fecha', { max: 40 }),
         b?.duracionMin === undefined || b?.duracionMin === null ? null : entero(b.duracionMin, 'duracionMin', { min: 5, max: 600 }),
         textoOpcional(b?.modalidad, 'modalidad', { max: 30 }),
         b?.asistio === false ? false : true]);
      return { ...r, mensaje: 'Sesión registrada.' };
    });
  }

  /** Una nota. Va aparte a propósito: no viaja en ninguna lista. */
  @Post('casos/:id/notas')
  nota(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 3, 'escribir una nota de consejería');
    const s = sesionDe(req);
    return conSesion(this.db, req, async (c) => {
      const { rows: [n] } = await c.query(
        `INSERT INTO consejeria.notas (caso_id, autor_id, contenido)
         VALUES ($1,$2,$3) RETURNING id, escrita_en`,
        [uuid(id, 'id'), s.personaId, texto(b?.texto, 'texto', { min: 5, max: 8000 })]);
      return { ...n, mensaje: 'Nota guardada. Solo se ve dentro de la ficha del caso.' };
    });
  }

  /** Cerrar o derivar. Derivar EXIGE decir a dónde. */
  @Post('casos/:id/cerrar')
  cerrar(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 3, 'cerrar un caso');
    const derivar = b?.derivadoA !== undefined && b?.derivadoA !== null && b?.derivadoA !== '';
    return conSesion(this.db, req, async (c) => {
      const { rows: [k] } = await c.query(
        `UPDATE consejeria.casos
            SET estado = CASE WHEN $2::text IS NOT NULL THEN 'derivado' ELSE 'cerrado' END::consejeria.estado_caso,
                cerrado_en = now(), derivado_a = $2
          WHERE id = $1 AND cerrado_en IS NULL
          RETURNING id, estado, cerrado_en, derivado_a`,
        [uuid(id, 'id'), derivar ? texto(b.derivadoA, 'derivadoA', { min: 3, max: 200 }) : null]);
      if (!k) throw new NotFoundException('Ese caso no existe, no está a su alcance, o ya estaba cerrado.');
      /* Cerrar el caso cierra también las asignaciones vivas: si no, el
         consejero sigue figurando como responsable de algo que ya terminó. */
      await c.query(
        `UPDATE consejeria.asignaciones SET hasta = now() WHERE caso_id = $1 AND hasta IS NULL`,
        [uuid(id, 'id')]);
      return { ...k, mensaje: derivar ? 'Caso derivado y registrado a dónde.' : 'Caso cerrado.' };
    });
  }
}

@Module({ imports: [DbModule], controllers: [ConsejeriaController] })
export class ConsejeriaModule {}
