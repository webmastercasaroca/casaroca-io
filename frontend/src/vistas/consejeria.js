import { api } from '../api.js';
import { pantalla, formulario, tabla, chip, sedes, esc, vacio, avisar } from './comun.js';

/**
 * Consejería · lo más delicado que guarda esta iglesia.
 *
 * ⛔ Esta LISTA no trae notas. Ni una. Las notas viven solo dentro de la
 * ficha de un caso, y abrir esa ficha queda escrito en la bitácora de
 * lectura. No es una restricción técnica: es lo que hace que alguien se lo
 * piense antes de entrar a mirar por curiosidad.
 */
export function pintarConsejeria(c) {
  let form;
  const { recargar } = pantalla(c, {
    titulo: 'Consejería',
    intro: 'Las notas no aparecen en esta lista. Abrir un caso queda registrado.',
    cargar: () => api.obtener('/api/v1/consejeria/casos?limite=100'),
    pintar: (d) => (form?.html ?? '') + (d.casos.length
      ? tabla(d.casos, [
          { titulo: 'Consultante', pintar: k => `<a class="enlace-fila" href="#/consejeria/${esc(k.id)}">
              <strong>${esc(k.consultante)}</strong></a>` },
          { titulo: 'Tópico', pintar: k => `${esc(k.topico_nombre || k.topico)}
              ${k.requiere_profesional ? chip('profesional', 'distintivo--n4') : ''}` },
          { titulo: 'Estado', pintar: k => chip(k.estado, k.estado === 'abierto' ? 'distintivo--aviso' : '') },
          { titulo: 'Consejero', pintar: k => k.consejeros
              ? esc(k.consejeros) : chip('sin asignar', 'distintivo--n4') },
          { titulo: 'Abierto', pintar: k => `${k.dias_abierto} día(s)` },
          { titulo: 'Sesiones', campo: 'sesiones' },
        ])
      : vacio('🕊', 'Ningún caso abierto', 'Cuando alguien pida acompañamiento, ábralo aquí.')),
  });

  Promise.all([sedes(), api.obtener('/api/v1/consejeria/topicos')]).then(([op, t]) => {
    form = formulario({
      titulo: '+ Abrir un caso',
      campos: [
        { nombre: 'sedeId', etiqueta: 'Sede', opciones: op, obligatorio: true },
        { nombre: 'consultanteId', etiqueta: 'Identificador de la persona', obligatorio: true,
          ayuda: 'Búsquela en Personas y pegue aquí su identificador.' },
        { nombre: 'topico', etiqueta: 'Tópico', obligatorio: true,
          opciones: t.topicos.map(x => ({ valor: x.codigo, texto: `${x.nombre}${x.requiere_profesional ? ' (profesional)' : ''}` })) },
      ],
      al: (d) => api.enviar('/api/v1/consejeria/casos', d),
    });
    recargar().then(() => form.enganchar(c, recargar));
  }).catch(e => avisar('No se pudo preparar el formulario: ' + e.message, 'error'));
}

/** La ficha. Aquí SÍ están las notas, y entrar deja rastro. */
export function pintarCaso(c, id) {
  c.innerHTML = `<p><a href="#/consejeria">← Volver a consejería</a></p><div id="k"></div>`;
  const z = c.querySelector('#k');

  const { recargar } = pantalla(z, {
    titulo: 'Caso de consejería',
    cargar: () => api.obtener(`/api/v1/consejeria/casos/${id}`),
    pintar: (d) => `
      <div class="aviso aviso--aviso" role="status">
        Su entrada a este caso quedó registrada en la bitácora de lectura, con su nombre y la hora.
      </div>
      <div class="tarjeta" style="margin:1rem 0">
        <h2 style="margin:0 0 .3rem">${esc(d.caso.consultante)}</h2>
        <p class="etiqueta">${esc(d.caso.topico_nombre || d.caso.topico)} ·
          ${esc(d.caso.estado)}${d.caso.derivado_a ? ' · derivado a ' + esc(d.caso.derivado_a) : ''}</p>
      </div>

      ${d.caso.cerrado_en ? '' : `
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem">
        <button class="boton boton--suave" id="b-asignar">Asignar consejero</button>
        <button class="boton boton--suave" id="b-sesion">Registrar sesión</button>
        <button class="boton boton--suave" id="b-nota">Escribir nota</button>
        <button class="boton boton--suave" id="b-cerrar">Cerrar o derivar</button>
      </div>`}

      <h2>Consejeros</h2>
      ${d.asignaciones.length
        ? tabla(d.asignaciones, [
            { titulo: 'Consejero', pintar: a => `<strong>${esc(a.consejero)}</strong>` },
            { titulo: 'Rol', pintar: a => chip(a.rol) },
            { titulo: 'Estado', pintar: a => a.hasta ? '<span class="ayuda">terminó</span>' : chip('activo') },
          ])
        : vacio('🤝', 'Sin consejero asignado', 'Un caso sin nadie detrás es una persona esperando.')}

      <h2 style="margin-top:2rem">Sesiones</h2>
      ${d.sesiones.length
        ? tabla(d.sesiones, [
            { titulo: 'Fecha', pintar: s => esc(new Date(s.fecha).toLocaleDateString('es-CO')) },
            { titulo: 'Consejero', campo: 'consejero' },
            { titulo: 'Duración', pintar: s => s.duracion_min ? s.duracion_min + ' min' : '—' },
            { titulo: 'Asistió', pintar: s => s.asistio ? chip('sí') : chip('no', 'distintivo--aviso') },
          ])
        : vacio('🗓', 'Ninguna sesión', 'Registre la primera cuando ocurra.')}

      <h2 style="margin-top:2rem">Notas</h2>
      <p class="etiqueta">Solo se ven aquí dentro. No viajan en ninguna lista.</p>
      ${d.notas.length
        ? d.notas.map(n => `
            <div class="tarjeta" style="margin-bottom:.75rem">
              <p class="etiqueta">${esc(new Date(n.escrita_en).toLocaleString('es-CO'))}
                 ${n.autor ? '· ' + esc(n.autor) : ''}</p>
              <p style="white-space:pre-wrap;margin:.4rem 0 0">${esc(n.texto)}</p>
            </div>`).join('')
        : vacio('📝', 'Ninguna nota', 'Lo que se escriba aquí no sale de aquí.')}`,
  });

  z.addEventListener('click', async ev => {
    const b = ev.target.closest('button[id^="b-"]');
    if (!b) return;
    try {
      if (b.id === 'b-asignar') {
        const p = prompt('Identificador de la persona que será consejero:');
        if (!p) return;
        const r = await api.enviar(`/api/v1/consejeria/casos/${id}/asignar`, { consejeroId: p.trim() });
        avisar(r.mensaje, 'exito');
      } else if (b.id === 'b-sesion') {
        const min = prompt('¿Cuántos minutos duró la sesión? (deje vacío si no lo sabe)');
        const d = {}; if (min && Number(min) > 0) d.duracionMin = Number(min);
        const r = await api.enviar(`/api/v1/consejeria/casos/${id}/sesiones`, d);
        avisar(r.mensaje, 'exito');
      } else if (b.id === 'b-nota') {
        const t = prompt('Escriba la nota (queda solo dentro de este caso):');
        if (!t || t.trim().length < 5) return avisar('La nota necesita al menos 5 caracteres.', 'error');
        const r = await api.enviar(`/api/v1/consejeria/casos/${id}/notas`, { texto: t.trim() });
        avisar(r.mensaje, 'exito');
      } else if (b.id === 'b-cerrar') {
        const a = prompt('Si lo DERIVA, escriba a dónde. Si solo lo cierra, deje vacío y acepte:');
        if (a === null) return;
        const r = await api.enviar(`/api/v1/consejeria/casos/${id}/cerrar`,
          a.trim() ? { derivadoA: a.trim() } : {});
        avisar(r.mensaje, 'exito');
      }
      recargar();
    } catch (e) { avisar(e.message, 'error'); }
  });
}
