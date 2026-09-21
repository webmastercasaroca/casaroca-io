import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import type { PoolClient } from 'pg';
import { DbService } from '../db/db.service';

/**
 * Identidad + transacción, en UN solo paso, para toda la API.
 *
 * ⛔ POR QUÉ VAN JUNTAS. Eran dos llamadas: resolver la identidad y abrir la
 * transacción. Con un módulo funcionaba; con nueve, olvidar la segunda abre
 * una conexión SIN contexto, y una conexión sin `app.sede_ids` no ve
 * ninguna fila: el sistema fallaría de forma rara en vez de fallar claro.
 *
 * ⛔ LO QUE CAMBIÓ EL 19 DE SEPTIEMBRE DE 2026 (hallazgo H-01). Antes:
 *
 *      const personaId = req.header('X-Persona-Id');   // ← cualquiera
 *
 * Ahora la sesión la resuelve `AuthMiddleware` verificando la firma del
 * token Y preguntándole a la base si esa sesión sigue viva. Las sedes y el
 * nivel NUNCA llegan del cliente: se derivan de las asignaciones vigentes.
 *
 * ⛔ Y el punto de sustitución de Keycloak sigue siendo UNO solo:
 * `AuthService.contextoDeToken`. Cambiar a OIDC es cambiar la verificación
 * de la firma; el resto de la API no se entera.
 */
export interface SesionDePeticion {
  personaId: string; cuentaId: string; usuario: string; jti: string;
  sedeIds: string[]; nivelMax: number; alcanceGlobal: boolean;
}

export function sesionDe(req: Request): SesionDePeticion {
  const s = (req as any).sesion as SesionDePeticion | undefined;
  if (!s) {
    throw new UnauthorizedException(
      'Necesita iniciar sesión. Envíe el token en la cabecera Authorization: Bearer ‹token›.');
  }
  return s;
}

export async function conSesion<T>(
  db: DbService, req: Request, fn: (c: PoolClient) => Promise<T>,
): Promise<T> {
  const s = sesionDe(req);

  /* Sin sede alcanzable no hay nada que consultar. Se dice claro en vez de
     devolver listas vacías que parecen un error de datos. */
  if (!s.alcanceGlobal && s.sedeIds.length === 0) {
    throw new ForbiddenException(
      'Su usuario no tiene ninguna sede asignada todavía. Comuníquese con la central.');
  }

  return db.enTransaccion({
    personaId: s.personaId,
    sedeIds: s.sedeIds,
    nivelMax: s.nivelMax,
    alcanceGlobal: s.alcanceGlobal,
    ip: ipDe(req),
  }, fn);
}

/** Exige un nivel mínimo de sensibilidad antes de tocar datos N3 o N4. */
export function exigirNivel(req: Request, minimo: number, que: string): void {
  const s = sesionDe(req);
  if (s.nivelMax < minimo) {
    throw new ForbiddenException(
      `Para ${que} se necesita acceso de nivel N${minimo}; su acceso llega a N${s.nivelMax}.`);
  }
}

/**
 * La dirección de quien llama.
 *
 * ⛔ HALLAZGO DE LA AUDITORÍA: esta función tomaba `X-Forwarded-For` sin
 * comprobar que viniera de un proxy de confianza, y es la clave del único
 * límite de intentos de la API. Reproducido: 15 intentos de entrar
 * cambiando esa cabecera en cada uno, ninguno bloqueado. El barrido de
 * contraseñas contra muchas cuentas quedaba sin freno de red.
 *
 * Ahora la verdad es el socket. La cabecera solo se cree cuando hay un
 * balanceador declarado delante (en Cloud Run lo hay; en el portátil no),
 * y entonces se toma el salto correcto, no el primero, que es el que
 * escribe el cliente.
 */
export function ipDe(req: Request): string | null {
  const saltos = Number(process.env.APP_PROXIES_CONFIABLES ?? 0);
  if (saltos > 0) {
    const cadena = (req.headers['x-forwarded-for'] as string | undefined)?.split(',').map(s => s.trim()) ?? [];
    /* El cliente controla el PRINCIPIO de la cadena; el proxy añade al
       final. Se cuenta desde el final tantos saltos como proxies haya. */
    const i = cadena.length - saltos;
    if (i >= 0 && cadena[i]) return cadena[i];
  }
  return req.socket.remoteAddress || null;
}
