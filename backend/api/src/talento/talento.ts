import { BadRequestException, Body, Controller, Get, Module, Param, Post, Query, Req, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { DbModule } from '../db/db.module';
import { DbService } from '../db/db.service';
import { conSesion, exigirNivel } from '../comun/identidad.helper';
import { uuid, uuidOpcional, texto, textoOpcional, fecha, unoDe, paginacion } from '../comun/validar';

const VINCULO = ['activo', 'suspendido', 'terminado'] as const;

/**
 * Talento y voluntariado.
 *
 * ⛔ La razón por la que este módulo es N3 no es el salario: es que aquí
 * vive la SALVAGUARDA. `talento.antecedentes` decide quién puede estar con
 * niños, y la base rechaza el rol de RocaKids sin antecedentes vigentes.
 * Este módulo es la puerta por la que esos antecedentes entran y se renuevan.
 */
@Controller('api/v1/talento')
export class TalentoController {
  constructor(private readonly db: DbService) {}

  @Get('cargos')
  cargos(@Req() req: Request) {
    exigirNivel(req, 3, 'ver los cargos');
    return conSesion(this.db, req, async (c) => {
      const { rows } = await c.query(
        `SELECT id, codigo, nombre, area, nivel_dato FROM talento.cargos ORDER BY area, nombre`);
      return { total_filas: rows.length, cargos: rows };
    });
  }

  @Get('contratos')
  contratos(@Req() req: Request, @Query() q: any) {
    exigirNivel(req, 3, 'ver los contratos');
    const { limite, desde } = paginacion(q);
    return conSesion(this.db, req, async (c) => {
      const { rows } = await c.query(
        `SELECT t.id, t.persona_id, p.nombre_completo, t.tipo, t.estado,
                to_char(t.inicia,'YYYY-MM-DD') AS inicia,
                to_char(t.termina,'YYYY-MM-DD') AS termina,
                t.salario, t.moneda, g.nombre AS cargo, g.area, se.codigo AS sede,
                (t.termina IS NOT NULL AND t.termina < CURRENT_DATE + 30
                 AND t.estado::text = 'activo') AS vence_pronto
           FROM talento.contratos t
           JOIN nucleo.v_personas p ON p.id = t.persona_id
           JOIN talento.cargos g ON g.id = t.cargo_id
           JOIN org.sedes se ON se.id = t.sede_id
          WHERE ($1::text IS NULL OR t.estado::text = $1)
          ORDER BY (t.estado::text = 'activo') DESC, t.termina NULLS LAST
          LIMIT $2 OFFSET $3`,
        [q?.estado ? unoDe(q.estado, 'estado', VINCULO) : null, limite, desde]);
      const porVencer = rows.filter(r => r.vence_pronto).length;
      return {
        total_filas: rows.length, desde, contratos: rows,
        aviso: porVencer > 0 ? `${porVencer} contrato(s) vencen en menos de 30 días.` : null,
      };
    });
  }

  /** Voluntariados. Los que tocan menores salen marcados y primero. */
  @Get('voluntariados')
  voluntariados(@Req() req: Request, @Query() q: any) {
    exigirNivel(req, 3, 'ver los voluntariados');
    const { limite, desde } = paginacion(q);
    return conSesion(this.db, req, async (c) => {
      const { rows } = await c.query(
        `SELECT v.id, v.persona_id, p.nombre_completo, v.funcion, v.estado,
                to_char(v.desde,'YYYY-MM-DD') AS desde, to_char(v.hasta,'YYYY-MM-DD') AS hasta,
                v.trabaja_con_menores, v.antecedentes_verificados_en, v.compromiso_firmado_en,
                m.nombre AS ministerio, se.codigo AS sede,
                talento.apto_para_menores(v.persona_id) AS apto_para_menores
           FROM talento.voluntariados v
           JOIN nucleo.v_personas p ON p.id = v.persona_id
           JOIN org.ministerios m ON m.id = v.ministerio_id
           JOIN org.sedes se ON se.id = v.sede_id
          WHERE ($1::boolean IS NOT TRUE OR v.trabaja_con_menores)
          ORDER BY v.trabaja_con_menores DESC, (v.estado::text = 'activo') DESC, p.nombre_completo
          LIMIT $2 OFFSET $3`,
        [q?.con_menores === 'si', limite, desde]);
      /* ⛔ El número que importa: cuántos están con niños HOY sin estar
         aptos. No es una métrica, es una lista de salas que hay que cubrir. */
      const riesgo = rows.filter(r => r.trabaja_con_menores && r.estado === 'activo' && !r.apto_para_menores);
      return {
        total_filas: rows.length, desde, voluntariados: rows,
        aviso: riesgo.length > 0
          ? `⛔ ${riesgo.length} voluntario(s) ACTIVOS con menores y SIN antecedentes vigentes: ${riesgo.map(r => r.nombre_completo).join(', ')}`
          : null,
      };
    });
  }

  @Post('voluntariados')
  crearVoluntariado(@Req() req: Request, @Body() b: any) {
    exigirNivel(req, 3, 'registrar un voluntariado');
    return conSesion(this.db, req, async (c) => {
      try {
        const { rows: [v] } = await c.query(
          `INSERT INTO talento.voluntariados
             (persona_id, sede_id, ministerio_id, funcion, estado, desde, trabaja_con_menores, compromiso_firmado_en)
           VALUES ($1,$2,$3,$4,'activo',COALESCE($5::date,CURRENT_DATE),COALESCE($6,false),$7::date)
           RETURNING id, funcion, estado, to_char(desde,'YYYY-MM-DD') AS desde`,
          [uuid(b?.personaId, 'personaId'), uuid(b?.sedeId, 'sedeId'),
           uuid(b?.ministerioId, 'ministerioId'),
           texto(b?.funcion, 'funcion', { min: 3, max: 120 }),
           b?.desde ? fecha(b.desde, 'desde') : null,
           b?.trabajaConMenores === true,
           b?.compromisoFirmadoEn ? fecha(b.compromisoFirmadoEn, 'compromisoFirmadoEn') : null]);
        return { ...v, mensaje: 'Voluntariado registrado.' };
      } catch (e: any) {
        if (e.code === '23503') throw new BadRequestException('La persona, la sede o el ministerio no están en su alcance.');
        if (e.code === '23514' || e.code === 'P0001') throw new BadRequestException(e.message);
        throw e;
      }
    });
  }

  /** Los antecedentes de una persona, con lo que falta por vencer. */
  @Get('antecedentes/:personaId')
  antecedentes(@Req() req: Request, @Param('personaId') personaId: string) {
    exigirNivel(req, 3, 'ver los antecedentes de alguien');
    return conSesion(this.db, req, async (c) => {
      const p = uuid(personaId, 'personaId');
      const { rows } = await c.query(
        `SELECT a.id, a.tipo, t.nombre AS tipo_nombre, a.resultado,
                to_char(a.expedido_en,'YYYY-MM-DD') AS expedido_en,
                to_char(a.vence_en,'YYYY-MM-DD') AS vence_en,
                (a.vence_en < CURRENT_DATE) AS vencido,
                (a.vence_en - CURRENT_DATE) AS dias_restantes
           FROM talento.antecedentes a
           LEFT JOIN talento.tipos_antecedente t ON t.codigo = a.tipo
          WHERE a.persona_id = $1 ORDER BY a.vence_en DESC NULLS LAST`, [p]);
      const { rows: [apto] } = await c.query(
        `SELECT talento.apto_para_menores($1) AS apto`, [p]);
      const { rows: faltan } = await c.query(
        `SELECT t.codigo, t.nombre FROM talento.tipos_antecedente t
          WHERE t.exigido_para_menores
            AND NOT EXISTS (SELECT 1 FROM talento.antecedentes a
                             WHERE a.persona_id = $1 AND a.tipo = t.codigo
                               AND a.resultado = 'apto'
                               AND (a.vence_en IS NULL OR a.vence_en >= CURRENT_DATE))`, [p]);
      return {
        antecedentes: rows,
        apto_para_menores: apto.apto,
        le_faltan: faltan,
        aviso: apto.apto ? null
          : `No está apto para estar con menores. Falta: ${faltan.map(f => f.nombre).join(', ') || 'revisar los vencidos'}.`,
      };
    });
  }

  /** Registrar un antecedente. Es lo que abre (o cierra) la puerta a RocaKids. */
  @Post('antecedentes')
  registrarAntecedente(@Req() req: Request, @Body() b: any) {
    exigirNivel(req, 3, 'registrar un antecedente');
    return conSesion(this.db, req, async (c) => {
      try {
        const { rows: [a] } = await c.query(
          `INSERT INTO talento.antecedentes (persona_id, tipo, resultado, expedido_en, vence_en, sede_id)
           VALUES ($1,$2,$3,$4::date,$5::date,$6)
           RETURNING id, tipo, resultado, to_char(vence_en,'YYYY-MM-DD') AS vence_en`,
          [uuid(b?.personaId, 'personaId'),
           texto(b?.tipo, 'tipo', { min: 2, max: 40 }),
           unoDe(b?.resultado, 'resultado', ['apto', 'no_apto', 'con_observacion', 'en_tramite'] as const),
           fecha(b?.expedidoEn, 'expedidoEn'),
           b?.venceEn ? fecha(b.venceEn, 'venceEn') : null,
           uuidOpcional(b?.sedeId, 'sedeId')]);
        const { rows: [apto] } = await c.query(
          `SELECT talento.apto_para_menores($1) AS apto`, [uuid(b?.personaId, 'personaId')]);
        return { ...a, apto_para_menores: apto.apto, mensaje: 'Antecedente registrado.' };
      } catch (e: any) {
        if (e.code === '23503') throw new BadRequestException('La persona o el tipo de antecedente no existen.');
        if (e.code === '23514') throw new BadRequestException(e.message);
        throw e;
      }
    });
  }

  /** Terminar un voluntariado EXIGE decir por qué. */
  @Post('voluntariados/:id/terminar')
  terminar(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 3, 'terminar un voluntariado');
    return conSesion(this.db, req, async (c) => {
      const { rows: [v] } = await c.query(
        `UPDATE talento.voluntariados
            SET estado = 'terminado', hasta = COALESCE($2::date, CURRENT_DATE)
          WHERE id = $1 AND estado::text <> 'terminado'
          RETURNING id, estado, to_char(hasta,'YYYY-MM-DD') AS hasta`,
        [uuid(id, 'id'), b?.hasta ? fecha(b.hasta, 'hasta') : null]);
      if (!v) throw new NotFoundException('Ese voluntariado no existe, no está en su alcance, o ya terminó.');
      texto(b?.motivo, 'motivo', { min: 5, max: 300 });
      return { ...v, mensaje: 'Voluntariado terminado.' };
    });
  }
}

@Module({ imports: [DbModule], controllers: [TalentoController] })
export class TalentoModule {}
