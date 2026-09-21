import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { Logger } from '@nestjs/common';

/**
 * Identificador de traza por petición.
 *
 * ⛔ HALLAZGO H-07: sin esto, cuando un pastor llama diciendo «me dio
 * error», no hay forma de encontrar SU petición entre las de las 36 sedes.
 * El identificador va en el log, en la respuesta y en la cabecera, para
 * que el usuario pueda leerlo por teléfono.
 */
const log = new Logger('HTTP');

export function trazaYRegistro(req: Request, res: Response, next: NextFunction) {
  const id = (req.header('x-peticion-id') ?? randomUUID()).slice(0, 64);
  (req as any).peticionId = id;
  res.setHeader('X-Peticion-Id', id);

  const inicio = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
    const s = (req as any).sesion;
    /* ⛔ Nunca se registra el cuerpo: pasan por aquí contraseñas, datos de
       menores y notas de consejería. Se registra el QUÉ, no el CON QUÉ. */
    log.log(`${id} ${req.method} ${req.path} ${res.statusCode} ${ms.toFixed(0)}ms ` +
            `${s?.usuario ? 'u=' + s.usuario : 'anon'}`);
  });
  next();
}

/** Cabeceras de seguridad. Sin dependencias: son ocho líneas. */
export function cabecerasDeSeguridad(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.removeHeader('X-Powered-By');
  next();
}
