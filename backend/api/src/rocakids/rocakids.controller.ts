import { Controller, Get, Post, Body, Param, Req, HttpCode } from '@nestjs/common';
import type { Request } from 'express';
import { RocakidsService } from './rocakids.service';
import { DbService } from '../db/db.service';
import { conSesion, exigirNivel, sesionDe } from '../comun/identidad.helper';
import { uuid, texto, uuidOpcional } from '../comun/validar';

/**
 * ⛔ TODO este controlador exige nivel N4. Los datos de menores son el dato
 * más sensible del sistema y no se alcanzan «por estar dentro»: se alcanzan
 * con un techo de acceso que la base calcula a partir de las asignaciones.
 */
@Controller('api/v1/rocakids')
export class RocakidsController {
  constructor(private readonly kids: RocakidsService, private readonly db: DbService) {}

  @Get('salas')
  salas(@Req() req: Request) {
    exigirNivel(req, 4, 'ver las salas de niños');
    return conSesion(this.db, req, (c) => this.kids.salas(c));
  }

  @Get('salas/:id/roster')
  roster(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 4, 'ver el censo de una sala');
    return conSesion(this.db, req, (c) => this.kids.roster(c, uuid(id, 'id')));
  }

  @Get('salas/:id/servidores')
  servidores(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 4, 'ver quién sirve en una sala');
    return conSesion(this.db, req, (c) => this.kids.servidores(c, uuid(id, 'id')));
  }

  @Post('salas/:id/entrar-a-servir')
  @HttpCode(200)
  entrarASala(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 4, 'servir en una sala de niños');
    const s = sesionDe(req);
    return conSesion(this.db, req, (c) => this.kids.entrarASala(c, uuid(id, 'id'), s.personaId));
  }

  @Get('menores/:id/acudientes')
  acudientes(@Req() req: Request, @Param('id') id: string) {
    exigirNivel(req, 4, 'ver los acudientes de un menor');
    return conSesion(this.db, req, (c) => this.kids.acudientes(c, uuid(id, 'id')));
  }

  /** Registrar la entrada. Idempotente: la cola sin conexión puede reintentar. */
  @Post('checkin')
  @HttpCode(200)
  checkin(@Req() req: Request, @Body() b: any) {
    exigirNivel(req, 4, 'registrar la entrada de un menor');
    const s = sesionDe(req);
    return conSesion(this.db, req, (c) => this.kids.checkin(c, {
      menorId: uuid(b?.menorId, 'menorId'),
      salaId: uuid(b?.salaId, 'salaId'),
      entregadoPor: uuid(b?.entregadoPor, 'entregadoPor'),
      recibidoPor: s.personaId,
      servicioId: uuidOpcional(b?.servicioId, 'servicioId'),
      /* La regla de los dos adultos se puede anular, pero solo por escrito
         y con el motivo, que queda en la bitácora con nombre y hora. */
      anulacionDosAdultos: b?.anulacionDosAdultos
        ? texto(b.anulacionDosAdultos, 'anulacionDosAdultos', { min: 10, max: 300 })
        : null,
    }));
  }

  /** Entregar. La base verifica acudiente Y código; un fallo queda registrado. */
  @Post('entregar')
  @HttpCode(200)
  entregar(@Req() req: Request, @Body() b: any) {
    exigirNivel(req, 4, 'entregar un menor');
    const s = sesionDe(req);
    return conSesion(this.db, req, (c) => this.kids.entregar(c, {
      checkinId: uuid(b?.checkinId, 'checkinId'),
      retiradoPor: uuid(b?.retiradoPor, 'retiradoPor'),
      codigo: texto(b?.codigo, 'codigo', { min: 3, max: 10 }),
      maestroId: s.personaId,
    }));
  }
}
