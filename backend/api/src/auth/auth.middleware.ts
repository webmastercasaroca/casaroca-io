import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';

/**
 * Resuelve la sesión de CADA petición, antes de que llegue al controlador.
 *
 * ⛔ Lo que reemplaza: hasta el 19 de septiembre de 2026, la identidad
 * llegaba en la cabecera `X-Persona-Id`, en texto plano. Quien escribiera
 * un identificador ERA esa persona.
 *
 * ⭐ Ahora: token firmado + la sesión tiene que seguir viva EN LA BASE. El
 * token solo dice qué sesión dice ser; quien decide es la base. Por eso
 * cerrar una sesión surte efecto en el instante y no cuando expire el token.
 *
 * No rechaza: solo resuelve. Rechazar es tarea de `conSesion`, para que las
 * rutas públicas (el formulario de nuevos, la salud) sigan funcionando.
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly auth: AuthService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const cabecera = req.header('authorization') ?? '';
    if (!cabecera.toLowerCase().startsWith('bearer ')) return next();
    const token = cabecera.slice(7).trim();
    if (!token) return next();
    try {
      const s = await this.auth.contextoDeToken(token);
      if (s) (req as any).sesion = s;
    } catch { /* token ilegible: se sigue sin sesión */ }
    next();
  }
}
