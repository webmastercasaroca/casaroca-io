import { Body, Controller, Get, Param, Put, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PersonasService } from './personas.service';
import { DbService } from '../db/db.service';
import { conSesion } from '../comun/identidad.helper';
import { uuid } from '../comun/validar';

@Controller('api/v1/personas')
export class PersonasController {
  constructor(private readonly personas: PersonasService, private readonly db: DbService) {}

  @Get()
  buscar(@Req() req: Request, @Query('q') q?: string, @Query('limite') limite?: string) {
    return conSesion(this.db, req, (c) => this.personas.buscar(c, q, Number(limite) || 50));
  }

  /** Arrastrar por casilla: /personas/por-atributo?codigo=comida_favorita */
  @Get('por-atributo')
  porAtributo(@Req() req: Request, @Query('codigo') codigo: string, @Query('valor') valor?: string) {
    return conSesion(this.db, req, (c) =>
      this.personas.porAtributo(c, codigo, valor === undefined ? undefined : valor));
  }

  /** Quién podría ser la misma persona registrada dos veces. */
  @Get(':id/duplicados')
  duplicados(@Req() req: Request, @Param('id') id: string) {
    return conSesion(this.db, req, (c) => this.personas.duplicados(c, uuid(id, 'id')));
  }

  @Get(':id')
  ficha(@Req() req: Request, @Param('id') id: string) {
    return conSesion(this.db, req, (c) => this.personas.ficha(c, uuid(id, 'id')));
  }

  /** Actualizar los datos de la persona (campos del documento de Usuarios v1.2). */
  @Put(':id')
  actualizar(@Req() req: Request, @Param('id') id: string, @Body() d: any) {
    return conSesion(this.db, req, (c) => this.personas.actualizar(c, uuid(id, 'id'), d));
  }

  /** ⭐ La ficha 360: todo lo que le ha pasado, de todos los módulos. */
  @Get(':id/linea-tiempo')
  linea(@Req() req: Request, @Param('id') id: string, @Query('limite') limite?: string) {
    return conSesion(this.db, req, (c) => this.personas.lineaTiempo(c, uuid(id, 'id'), Number(limite) || 200));
  }

  @Get(':id/atributos')
  atributos(@Req() req: Request, @Param('id') id: string) {
    return conSesion(this.db, req, (c) => this.personas.atributos(c, uuid(id, 'id')));
  }

  @Put(':id/atributos/:codigo')
  fijar(@Req() req: Request, @Param('id') id: string, @Param('codigo') codigo: string, @Body() d: any) {
    return conSesion(this.db, req, (c) => this.personas.fijarAtributo(c, uuid(id, 'id'), codigo, d?.valor));
  }
}
