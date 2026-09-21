import { BadRequestException, Logger } from '@nestjs/common';

const log = new Logger('reCAPTCHA');
let avisado = false;

/**
 * El formulario público de casaroca.org no tiene sesión: el reCAPTCHA es
 * lo único que separa a una persona de un robot llenando la bandeja.
 *
 * ⛔ Sin `RECAPTCHA_SECRET` NO se valida, y se dice en el log una vez.
 *    Es el modo de desarrollo; en producción el secreto sale de Secret
 *    Manager (ver infra/gcp). Fallar cerrado aquí dejaría al equipo sin
 *    poder probar el formulario en su equipo.
 */
export async function verificarRecaptcha(token: string | undefined, ip: string | null): Promise<void> {
  const secreto = process.env.RECAPTCHA_SECRET;
  if (!secreto) {
    if (!avisado) {
      log.warn('RECAPTCHA_SECRET no está configurado: el formulario público NO se está validando.');
      avisado = true;
    }
    return;
  }
  if (!token) throw new BadRequestException('Falta la verificación reCAPTCHA.');

  const cuerpo = new URLSearchParams({ secret: secreto, response: token });
  if (ip) cuerpo.set('remoteip', ip);
  const r = await fetch('https://www.google.com/recaptcha/api/siteverify', { method: 'POST', body: cuerpo });
  const d = await r.json() as { success?: boolean; score?: number };

  // reCAPTCHA v3 devuelve un puntaje; v2 solo `success`. 0.5 es el umbral que recomienda Google.
  const umbral = Number(process.env.RECAPTCHA_UMBRAL ?? 0.5);
  if (!d.success || (typeof d.score === 'number' && d.score < umbral)) {
    throw new BadRequestException({ error: 'No pudimos verificar que no es un robot.', codigo_error: 'RECAPTCHA' });
  }
}
