/**
 * Las plantillas que nombra el documento M-Nuevos («Bienvenida_nuevo.html»,
 * «Notificacion_coordinador.html», «Confirmacion_miembro.html») y las dos
 * del documento de Donaciones.
 *
 * Van en código y no en archivos sueltos a propósito: la imagen de
 * producción solo lleva `dist/`, y una plantilla que no viaja con el
 * build es un correo que en producción sale vacío.
 */
type Datos = Record<string, any>;
export interface Correo { asunto: string; html: string }

const esc = (v: any) => String(v ?? '').replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[ch]);

const marco = (cuerpo: string) => `<!doctype html><html lang="es"><body style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:560px;margin:auto;padding:24px">
${cuerpo}
<p style="color:#777;font-size:12px;margin-top:32px">Casa Sobre la Roca · Este correo responde a una solicitud o transacción suya.
Para dejar de recibir comunicaciones escríbanos y lo retiramos (Ley 1581 de 2012).</p></body></html>`;

export const PLANTILLAS: Record<string, (d: Datos) => Correo> = {
  Bienvenida_nuevo: d => ({
    asunto: 'Bienvenido a Casa Sobre la Roca',
    html: marco(`<h2>¡Bienvenido, ${esc(d.nombre)}!</h2>
<p>Recibimos tu registro. Muy pronto alguien de nuestro equipo se pondrá en contacto contigo.</p>
<p>Mientras tanto, te esperamos en cualquiera de nuestros servicios.</p>`),
  }),
  Notificacion_coordinador: d => ({
    asunto: `Nuevo registro: ${d.nombre}`,
    html: marco(`<h2>Tienes un nuevo registro</h2>
<p><strong>${esc(d.nombre)}</strong> se registró${d.como_supo ? ` (supo de nosotros por: ${esc(d.como_supo)})` : ''}.</p>
<p>Entra al sistema para hacer el primer contacto. El contacto sugerido es mañana.</p>`),
  }),
  Confirmacion_miembro: d => ({
    asunto: 'Ya eres parte de Casa Sobre la Roca',
    html: marco(`<h2>${esc(d.nombre)}, ¡qué alegría tenerte!</h2>
<p>Quedaste integrado a nuestra comunidad. Tu pastor o líder te acompañará en los próximos pasos.</p>`),
  }),
  Confirmacion_aporte: d => ({
    asunto: 'Recibimos tu aporte',
    html: marco(`<h2>Gracias por tu aporte</h2>
<p>Confirmamos tu ${esc(d.tipo)} por <strong>${esc(d.moneda)} ${Number(d.monto).toLocaleString('es-CO')}</strong>
del ${esc(d.fecha)}.</p><p>Referencia interna: ${esc(d.aporte_id)}</p>`),
  }),
  Certificado_expedido: d => ({
    asunto: `Tu certificado de donación ${d.numero}`,
    html: marco(`<h2>Tu certificado de donación está listo</h2>
<p>Expedimos el certificado <strong>${esc(d.numero)}</strong> por los aportes entre el ${esc(d.desde)} y el ${esc(d.hasta)}.</p>
<p>Puedes solicitarlo a Tesorería de tu sede.</p>`),
  }),
};
