import { Controller, Post, Get, Body, Req, HttpCode, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { ipDe } from '../comun/identidad.helper';
import { texto } from '../comun/validar';
import { limitarPorClave } from '../comun/limite';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Entrar.
   * ⛔ Límite estricto: la puerta de entrada es el único sitio donde alguien
   * puede probar millones de contraseñas. Diez intentos por dirección cada
   * cinco minutos, además del bloqueo por cuenta que aplica la base.
   */
  @Post('entrar')
  @HttpCode(200)
  async entrar(@Body() cuerpo: any, @Req() req: Request) {
    const ip = ipDe(req);
    limitarPorClave(`entrar:${ip}`, 10, 5 * 60_000,
      'Demasiados intentos desde esta conexión. Espere unos minutos.');
    const usuario = texto(cuerpo?.usuario, 'usuario', { min: 3, max: 120 });
    const clave   = texto(cuerpo?.clave,   'clave',   { min: 1, max: 200, sinRecortar: true });
    const codigo  = cuerpo?.codigo === undefined ? undefined
                  : texto(cuerpo.codigo, 'codigo', { min: 6, max: 9 });
    return this.auth.entrar(usuario, clave, ip, req.header('user-agent') ?? null, codigo);
  }

  @Post('refrescar')
  @HttpCode(200)
  async refrescar(@Body() cuerpo: any, @Req() req: Request) {
    const t = texto(cuerpo?.refresco, 'refresco', { min: 10, max: 4000 });
    return this.auth.refrescar(t, ipDe(req), req.header('user-agent') ?? null);
  }

  @Post('salir')
  @HttpCode(200)
  async salir(@Req() req: Request) {
    const s = (req as any).sesion;
    if (!s) throw new UnauthorizedException('No hay sesión abierta.');
    await this.auth.salir(s.jti);
    return { cerrada: true };
  }

  @Post('salir-de-todo')
  @HttpCode(200)
  async salirDeTodo(@Req() req: Request) {
    const s = (req as any).sesion;
    if (!s) throw new UnauthorizedException('No hay sesión abierta.');
    return this.auth.salirDeTodo(s.cuentaId);
  }

  @Post('cambiar-clave')
  @HttpCode(200)
  async cambiarClave(@Body() cuerpo: any, @Req() req: Request) {
    const s = (req as any).sesion;
    if (!s) throw new UnauthorizedException('No hay sesión abierta.');
    const actual = texto(cuerpo?.actual, 'actual', { min: 1, max: 200, sinRecortar: true });
    const nueva  = texto(cuerpo?.nueva,  'nueva',  { min: 1, max: 200, sinRecortar: true });
    return this.auth.cambiarClave(s.cuentaId, s.usuario, actual, nueva);
  }

  /**
   * Configurar el segundo factor. Acepta el token LIMITADO que entrega la
   * entrada cuando el rol lo exige y todavía no está activo: así nadie
   * queda fuera de su cuenta, pero tampoco entra a los datos sin activarlo.
   */
  @Post('segundo-factor/iniciar')
  @HttpCode(200)
  async iniciarSegundoFactor(@Req() req: Request) {
    const s = await this.limitadaOAbierta(req);
    return this.auth.iniciarSegundoFactor(s.cuentaId, s.usuario);
  }

  @Post('segundo-factor/activar')
  @HttpCode(200)
  async activarSegundoFactor(@Body() cuerpo: any, @Req() req: Request) {
    const s = await this.limitadaOAbierta(req);
    const codigo = texto(cuerpo?.codigo, 'codigo', { min: 6, max: 9 });
    return this.auth.activarSegundoFactor(s.cuentaId, codigo);
  }

  private async limitadaOAbierta(req: Request): Promise<{ cuentaId: string; usuario: string }> {
    const abierta = (req as any).sesion;
    if (abierta) return { cuentaId: abierta.cuentaId, usuario: abierta.usuario };
    const cab = req.header('authorization') ?? '';
    if (cab.toLowerCase().startsWith('bearer ')) {
      const limitada = await this.auth.contextoDeTokenLimitado(cab.slice(7).trim());
      if (limitada) return limitada;
    }
    throw new UnauthorizedException('Necesita iniciar sesión.');
  }

  /** Quién soy, según el token y la base. Sirve al frontend para pintar. */
  @Get('quien-soy')
  quienSoy(@Req() req: Request) {
    const s = (req as any).sesion;
    if (!s) throw new UnauthorizedException('No hay sesión abierta.');
    return {
      personaId: s.personaId, usuario: s.usuario,
      alcance: { sedes: s.sedeIds, nivelMax: s.nivelMax, todaLaRed: s.alcanceGlobal },
    };
  }
}
