import { Body, Controller, Get, Param, Post, Query, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { NuevosService } from './nuevos.service';
import { DbService } from '../db/db.service';
import { almacen } from '../contexto/contexto';
import type { RegistrarNuevo, RegistrarContacto, ConvertirMiembro } from './dto';
import { sesionDe } from '../comun/identidad.helper';

/**
 * Rutas del Módulo de Nuevos.
 * Son EXACTAMENTE las cinco que especificó el equipo 100p en su
 * documento M-Nuevos: el contrato es suyo porque construyen el frontend;
 * la garantía es nuestra porque vive en la base.
 */
@Controller('api/v1/nuevos')
export class NuevosController {
  constructor(private readonly nuevos: NuevosService, private readonly db: DbService) {}

  /** 1 · Público. Sin autenticación: lo protege el reCAPTCHA (RECAPTCHA_SECRET). */
  @Post('registrar')
  registrar(@Body() datos: RegistrarNuevo, @Req() req: Request) {
    return this.nuevos.registrar(datos, ip(req));
  }

  /** 2 · Tablero del coordinador. */
  @Get('dashboard')
  dashboard(@Req() req: Request, @Query('estado') estado?: string, @Query('limite') limite?: string,
            @Query('sede_id') sedeId?: string, @Query('ordenar_por') ordenarPor?: string) {
    return this.conIdentidad(req, () =>
      this.nuevos.dashboard(estado, Number(limite) || 50, sedeId, ordenarPor));
  }

  /** 3 · Registrar un contacto. */
  @Post(':id/registrar-contacto')
  contacto(@Req() req: Request, @Param('id') id: string, @Body() datos: RegistrarContacto) {
    return this.conIdentidad(req, () => this.nuevos.registrarContacto(id, datos));
  }

  /** 4 · Convertir en miembro. */
  @Post(':id/convertir-miembro')
  convertir(@Req() req: Request, @Param('id') id: string, @Body() datos: ConvertirMiembro) {
    return this.conIdentidad(req, () => this.nuevos.convertirMiembro(id, datos ?? {}));
  }

  /** 5 · Historial completo. */
  @Get(':id/historial')
  historial(@Req() req: Request, @Param('id') id: string) {
    return this.conIdentidad(req, () => this.nuevos.historial(id));
  }

  /**
   * Resuelve la identidad y deja el contexto disponible para el servicio.
   *
   * ⛔ 19 sep 2026 · HALLAZGO H-01 CERRADO. Esta función leía la identidad
   * de la cabecera `X-Persona-Id`: quien escribiera un identificador ERA
   * esa persona. Ahora la sesión la resuelve `AuthMiddleware` verificando
   * la firma del token y preguntándole a la base si sigue viva.
   *
   * Las sedes y el nivel NUNCA vienen del cliente: se derivan de las
   * asignaciones vigentes. Si vinieran en la petición, cualquiera podría
   * pedir ver otra sede.
   */
  private async conIdentidad<T>(req: Request, fn: () => Promise<T>): Promise<T> {
    const s = sesionDe(req);
    return almacen.run({
      personaId: s.personaId,
      sedeIds: s.sedeIds,
      nivelMax: s.nivelMax,
      alcanceGlobal: s.alcanceGlobal,
      ip: ip(req),
    }, fn);
  }
}

function ip(req: Request): string | null {
  const x = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  return x || req.socket.remoteAddress || null;
}
