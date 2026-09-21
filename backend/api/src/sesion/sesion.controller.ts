import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { SesionService } from './sesion.service';
import { DbService } from '../db/db.service';
import { conSesion } from '../comun/identidad.helper';

@Controller('api/v1/sesion')
export class SesionController {
  constructor(private readonly sesion: SesionService, private readonly db: DbService) {}

  /** Quién soy, qué sedes alcanzo, hasta qué nivel y qué módulos veo. */
  @Get('yo')
  yo(@Req() req: Request) {
    return conSesion(this.db, req, (c) => this.sesion.yo(c));
  }
}
