import { Body, Controller, Get, Header, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AportesService } from './aportes.service';
import { DonacionesService } from './donaciones.service';
import { DbService } from '../db/db.service';
import { conSesion, ipDe } from '../comun/identidad.helper';
import { uuid } from '../comun/validar';

@Controller('api/v1/aportes')
export class AportesController {
  constructor(private readonly aportes: AportesService, private readonly donaciones: DonacionesService,
              private readonly db: DbService) {}

  /** ⛔ Pública: la llama PayU, no una persona. La firma es la puerta. */
  @Post('pasarela/webhook')
  webhook(@Body() cuerpo: any, @Req() req: Request) {
    return this.aportes.webhook(cuerpo, ipDe(req));
  }

  @Get('pagos-sin-dueno')
  sinDueno(@Req() req: Request) {
    return conSesion(this.db, req, (c) => this.aportes.sinDueno(c));
  }

  @Post('pagos/:id/emparejar')
  emparejar(@Req() req: Request, @Param('id') id: string, @Body() d: any) {
    return conSesion(this.db, req, (c) => this.aportes.emparejar(c, uuid(id, 'id'), d?.personaId));
  }

  // ── Módulo de Donaciones (documento del Drive 100p) ──────────────

  /** Consulta de Tesorería: ?anio=2026&tipo=diezmo&estado=confirmado&persona_id=… */
  @Get()
  listar(@Req() req: Request, @Query() f: any) {
    return conSesion(this.db, req, (c) => this.donaciones.listar(c, f ?? {}));
  }

  /** Registro manual (REGISTRAR_APORTE). */
  @Post()
  registrar(@Req() req: Request, @Body() d: any) {
    return conSesion(this.db, req, (c) => this.donaciones.registrar(c, d));
  }

  /** Aprobación (APROBAR_APORTE = CONFIRMAR_APORTE). */
  @Post(':id/confirmar')
  confirmar(@Req() req: Request, @Param('id') id: string) {
    return conSesion(this.db, req, (c) => this.donaciones.confirmar(c, uuid(id, 'id')));
  }

  /** Expedir certificado (GENERAR_CERTIFICADO): { persona_id, anio } o { fecha_inicio, fecha_fin }. */
  @Post('certificados')
  expedir(@Req() req: Request, @Body() d: any) {
    return conSesion(this.db, req, (c) => this.donaciones.expedirCertificado(c, d));
  }

  @Get('certificados/:id')
  certificado(@Req() req: Request, @Param('id') id: string) {
    return conSesion(this.db, req, (c) => this.donaciones.certificado(c, uuid(id, 'id')));
  }

  /** El certificado imprimible (la `url_pdf` apunta aquí). */
  @Get('certificados/:id/documento')
  @Header('Content-Type', 'text/html; charset=utf-8')
  documento(@Req() req: Request, @Param('id') id: string) {
    return conSesion(this.db, req, (c) => this.donaciones.documento(c, uuid(id, 'id')));
  }

  /** Anulación con motivo escrito (solo Tesorería). */
  @Post('certificados/:id/anular')
  anular(@Req() req: Request, @Param('id') id: string, @Body() d: any) {
    return conSesion(this.db, req, (c) => this.donaciones.anularCertificado(c, uuid(id, 'id'), d?.motivo));
  }
}
