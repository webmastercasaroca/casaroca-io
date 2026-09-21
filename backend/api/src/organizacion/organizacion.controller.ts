import { Body, Controller, Get, Param, Post, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { OrganizacionService } from './organizacion.service';
import { DbService } from '../db/db.service';
import { conSesion } from '../comun/identidad.helper';
import { uuid } from '../comun/validar';

@Controller('api/v1/organizacion')
export class OrganizacionController {
  constructor(private readonly org: OrganizacionService, private readonly db: DbService) {}

  @Get('sedes')
  sedes(@Req() req: Request) {
    return conSesion(this.db, req, (c) => this.org.sedes(c));
  }

  @Post('sedes')
  crearSede(@Req() req: Request, @Body() d: any) {
    return conSesion(this.db, req, (c) => this.org.crearSede(c, d));
  }

  @Get('ministerios')
  ministerios(@Req() req: Request) {
    return conSesion(this.db, req, (c) => this.org.ministerios(c));
  }

  @Get('sedes/:id/ministerios')
  deSede(@Req() req: Request, @Param('id') id: string) {
    return conSesion(this.db, req, (c) => this.org.ministeriosDe(c, uuid(id, 'id')));
  }

  @Put('sedes/:id/ministerios/:min')
  fijar(@Req() req: Request, @Param('id') id: string, @Param('min') min: string, @Body() d: any) {
    return conSesion(this.db, req, (c) => this.org.fijarMinisterio(c, uuid(id, 'id'), min, !!d?.activo));
  }
}
