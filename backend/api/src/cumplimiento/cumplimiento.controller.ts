import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CumplimientoService } from './cumplimiento.service';
import { DbService } from '../db/db.service';
import { conSesion, exigirNivel } from '../comun/identidad.helper';
import { texto, textoOpcional, uuid, uuidOpcional, unoDe, entero } from '../comun/validar';

const TIPOS   = ['consulta', 'reclamo', 'supresion', 'revocacion', 'actualizacion'] as const;
const CANALES = ['presencial', 'correo', 'telefono', 'web', 'whatsapp'] as const;
const ESTADOS = ['recibida', 'en_tramite', 'prorrogada', 'atendida', 'rechazada'] as const;

/**
 * Derechos del titular · Ley 1581 de 2012.
 *
 * ⛔ Estas rutas NO EXISTÍAN. La base sabía contar días hábiles con los
 * festivos de Colombia, exigir motivo para una prórroga y ejecutar una
 * supresión de verdad, y nada de eso se podía pedir desde fuera.
 *
 * Nivel exigido: N3. Una petición de Habeas Data trae el nombre, el
 * documento y el contacto de una persona, y el detalle suele decir por qué
 * está molesta. No es un formulario administrativo.
 */
@Controller('api/v1/cumplimiento')
export class CumplimientoController {
  constructor(private readonly c: CumplimientoService, private readonly db: DbService) {}

  /** Radicar una petición del titular. */
  @Post('peticiones')
  radicar(@Req() req: Request, @Body() b: any) {
    exigirNivel(req, 3, 'radicar una petición de Habeas Data');
    return conSesion(this.db, req, (cl) => this.c.radicar(cl, {
      tipo:             unoDe(b?.tipo, 'tipo', TIPOS),
      canal:            unoDe(b?.canal, 'canal', CANALES),
      titularNombre:    texto(b?.titularNombre, 'titularNombre', { min: 3, max: 200 }),
      titularContacto:  texto(b?.titularContacto, 'titularContacto', { min: 5, max: 200 }),
      /* El detalle es lo que pide el titular, con sus palabras. Se exige
         que diga algo: «consulta» a secas no permite responder nada. */
      detalle:          texto(b?.detalle, 'detalle', { min: 15, max: 4000 }),
      titularId:        uuidOpcional(b?.titularId, 'titularId'),
      titularDocumento: textoOpcional(b?.titularDocumento, 'titularDocumento', { max: 40 }),
      sedeId:           uuidOpcional(b?.sedeId, 'sedeId'),
    }));
  }

  /** La bandeja. Por omisión trae lo abierto, con lo vencido arriba. */
  @Get('peticiones')
  bandeja(@Req() req: Request, @Query('estado') estado?: string,
          @Query('vencidas') vencidas?: string, @Query('limite') limite?: string) {
    exigirNivel(req, 3, 'ver las peticiones de Habeas Data');
    return conSesion(this.db, req, (cl) => this.c.bandeja(cl, {
      estado: estado ? unoDe(estado, 'estado', ESTADOS) : null,
      soloVencidas: vencidas === 'si' || vencidas === 'true',
      limite: limite ? entero(limite, 'limite', { min: 1, max: 500 }) : 100,
    }));
  }

  /** Responder y cerrar. */
  @Post('peticiones/:id/responder')
  responder(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 3, 'responder una petición de Habeas Data');
    return conSesion(this.db, req, (cl) => this.c.responder(cl, uuid(id, 'id'), {
      respuesta: texto(b?.respuesta, 'respuesta', { min: 15, max: 8000 }),
      evidencia: textoOpcional(b?.evidencia, 'evidencia', { max: 500 }),
      rechazada: b?.rechazada === true,
    }));
  }

  /** Prorrogar. La base exige el motivo; la ley exige informarlo. */
  @Post('peticiones/:id/prorrogar')
  prorrogar(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    exigirNivel(req, 3, 'prorrogar una petición de Habeas Data');
    return conSesion(this.db, req, (cl) => this.c.prorrogar(cl, uuid(id, 'id'), {
      motivo: texto(b?.motivo, 'motivo', { min: 15, max: 1000 }),
      informada: b?.informada === true,
    }));
  }

  /** Ejecutar la supresión. Irreversible: pide confirmación explícita. */
  @Post('peticiones/:id/suprimir')
  suprimir(@Req() req: Request, @Param('id') id: string, @Body() b: any) {
    /* N4: suprimir toca los datos de menores y de consejería si los hay. */
    exigirNivel(req, 4, 'ejecutar una supresión de datos');
    return conSesion(this.db, req, (cl) =>
      this.c.suprimir(cl, uuid(id, 'id'), texto(b?.confirmacion, 'confirmacion', { min: 1, max: 20 })));
  }

  /** Qué consentimientos tiene hoy una persona. */
  @Get('consentimientos/:personaId')
  consentimientos(@Req() req: Request, @Param('personaId') personaId: string) {
    exigirNivel(req, 3, 'ver los consentimientos de una persona');
    return conSesion(this.db, req, (cl) => this.c.consentimientos(cl, uuid(personaId, 'personaId')));
  }

  /** Revocar. Sin canal ni finalidad, revoca todo lo revocable. */
  @Post('consentimientos/revocar')
  revocar(@Req() req: Request, @Body() b: any) {
    exigirNivel(req, 3, 'revocar un consentimiento');
    return conSesion(this.db, req, (cl) => this.c.revocar(cl, {
      personaId: uuid(b?.personaId, 'personaId'),
      canal: textoOpcional(b?.canal, 'canal', { max: 30 }),
      finalidad: textoOpcional(b?.finalidad, 'finalidad', { max: 40 }),
      evidencia: textoOpcional(b?.evidencia, 'evidencia', { max: 300 }),
    }));
  }

  /** Lo que el sistema decidió NO enviar, y por qué. */
  @Get('no-atendido')
  noAtendido(@Req() req: Request) {
    exigirNivel(req, 3, 'ver los avisos que no se enviaron');
    return conSesion(this.db, req, (cl) => this.c.noAtendido(cl));
  }
}
