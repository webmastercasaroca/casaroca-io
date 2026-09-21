import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { IdentidadService } from './identidad.service';
import { DbService } from '../db/db.service';
import { conSesion, sesionDe } from '../comun/identidad.helper';
import { texto, uuid, uuidOpcional } from '../comun/validar';

@Controller('api/v1/identidad')
export class IdentidadController {
  constructor(private readonly id: IdentidadService, private readonly db: DbService) {}

  @Get('roles')   roles(@Req() r: Request)   { return conSesion(this.db, r, c => this.id.roles(c)); }
  @Get('modulos') modulos(@Req() r: Request) { return conSesion(this.db, r, c => this.id.modulos(c)); }
  @Get('matriz')  matriz(@Req() r: Request)  { return conSesion(this.db, r, c => this.id.matriz(c)); }

  @Get('personas/:id/asignaciones')
  asignaciones(@Req() r: Request, @Param('id') id: string) {
    return conSesion(this.db, r, c => this.id.asignacionesDe(c, uuid(id, 'id')));
  }

  /** Qué módulos alcanza de verdad esta persona hoy. */
  @Get('personas/:id/efectivo')
  efectivo(@Req() r: Request, @Param('id') id: string) {
    return conSesion(this.db, r, c => this.id.efectivo(c, uuid(id, 'id')));
  }

  @Post('personas/:id/otorgar')
  otorgar(@Req() r: Request, @Param('id') id: string, @Body() d: any) {
    return conSesion(this.db, r, c => this.id.otorgar(c, uuid(id, 'id'), d?.roles ?? d));
  }

  /* ⛔ El motivo NO es opcional: revocar sin decir por qué deja un hueco
     justo en la pregunta que hace una auditoría de accesos. */
  @Delete('asignaciones/:id')
  cerrar(@Req() r: Request, @Param('id') id: string, @Body() d: any) {
    return conSesion(this.db, r, c => this.id.cerrar(c, uuid(id, 'id'), d?.motivo));
  }

  /* casillas */
  @Get('atributos')  atributos(@Req() r: Request) { return conSesion(this.db, r, c => this.id.atributos(c)); }
  @Post('atributos') crear(@Req() r: Request, @Body() d: any) {
    return conSesion(this.db, r, c => this.id.crearAtributo(c, d));
  }

  /* ── Catálogos ────────────────────────────────────────────────── */

  @Get('catalogos')
  catalogos(@Req() req: Request) {
    return conSesion(this.db, req, (c) => this.id.catalogos(c));
  }

  @Get('catalogos/:catalogo/valores')
  valores(@Req() req: Request, @Param('catalogo') catalogo: string) {
    return conSesion(this.db, req, (c) =>
      this.id.valoresDeCatalogo(c, texto(catalogo, 'catalogo', { min: 2, max: 60 })));
  }

  /** ⛔ Ampliar un catálogo es configuración de la red: exige alcance de organización. */
  @Post('catalogos/:catalogo/valores')
  @HttpCode(200)
  agregarValor(@Req() req: Request, @Param('catalogo') catalogo: string, @Body() b: any) {
    const s = sesionDe(req);
    if (!s.alcanceGlobal) {
      throw new ForbiddenException('Ampliar un catálogo de la red exige alcance de organización.');
    }
    return conSesion(this.db, req, (c) => this.id.agregarValor(
      c, texto(catalogo, 'catalogo', { min: 2, max: 60 }), {
        codigo: texto(b?.codigo, 'codigo', { min: 2, max: 40, patron: /^[A-Za-z0-9_]+$/ }),
        etiqueta: texto(b?.etiqueta, 'etiqueta', { min: 2, max: 120 }),
        descripcion: b?.descripcion ? texto(b.descripcion, 'descripcion', { max: 400 }) : null,
        sedeId: uuidOpcional(b?.sedeId, 'sedeId'),
        quien: s.personaId,
      }));
  }

  @Post('catalogos/:catalogo/valores/:codigo/retirar')
  @HttpCode(200)
  retirarValor(@Req() req: Request, @Param('catalogo') catalogo: string,
               @Param('codigo') codigo: string, @Body() b: any) {
    const s = sesionDe(req);
    if (!s.alcanceGlobal) {
      throw new ForbiddenException('Retirar un valor de un catálogo de la red exige alcance de organización.');
    }
    return conSesion(this.db, req, (c) => this.id.retirarValor(
      c, texto(catalogo, 'catalogo', { min: 2, max: 60 }),
      texto(codigo, 'codigo', { min: 2, max: 40 }),
      texto(b?.motivo, 'motivo', { min: 5, max: 400 })));
  }
}
