import { api } from '../api.js';
import { pantalla, formulario, tabla, chip, sedes, esc, vacio, avisar } from './comun.js';

/**
 * Asistencia · el domingo.
 *
 * ⛔ Los DOS números van juntos y separados a la vez: «contados» es el de la
 * puerta y «marcados» es la lista. Una sede que cuenta 600 y marca 12 no
 * está fallando: está contando como se puede. Lo que no se puede es
 * mezclarlos y creer que se sabe quién vino.
 */
export function pintarAsistencia(c) {
  let form;
  const { recargar } = pantalla(c, {
    titulo: 'Asistencia',
    intro: 'Contados es el número de la puerta. Marcados es la lista para el seguimiento.',
    cargar: () => api.obtener('/api/v1/asistencia/servicios?limite=30'),
    pintar: (d) => {
      if (!d.servicios.length) {
        return (form?.html ?? '') + vacio('📋', 'Ningún servicio abierto',
          'Abra el servicio del domingo antes de marcar a nadie.');
      }
      return (form?.html ?? '') + tabla(d.servicios.map(s => ({ ...s, __id: s.id })), [
        /* La acción va en la primera celda, no en la última: regla de
           `docs/DISENO.md`. */
        { titulo: 'Fecha', pintar: s => `<a class="enlace-fila" href="#/asistencia/${esc(s.id)}">
            <strong>${esc(s.fecha)}</strong> ${esc(s.hora)}</a>` },
        { titulo: 'Sede', campo: 'sede' },
        { titulo: 'Servicio', pintar: s => esc(s.nombre || s.tipo) },
        { titulo: 'Contados', pintar: s => s.contados == null
            ? `<span class="ayuda">sin reportar</span>` : `<strong>${esc(s.contados)}</strong>` },
        { titulo: 'Marcados', campo: 'marcados' },
      ]);
    },
  });

  sedes().then(op => {
    form = formulario({
      titulo: '+ Abrir un servicio',
      campos: [
        { nombre: 'sedeId', etiqueta: 'Sede', opciones: op, obligatorio: true },
        { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'date', obligatorio: true },
        { nombre: 'hora', etiqueta: 'Hora de inicio', tipo: 'time', obligatorio: true },
        { nombre: 'tipo', etiqueta: 'Tipo', obligatorio: true, placeholder: 'dominical, oración, jóvenes…' },
        { nombre: 'nombre', etiqueta: 'Nombre (opcional)' },
      ],
      al: (d) => api.enviar('/api/v1/asistencia/servicios', d),
    });
    recargar().then(() => form.enganchar(c, recargar));
  }).catch(e => avisar('No se pudieron cargar las sedes: ' + e.message, 'error'));
}

/** La pantalla de UN servicio: marcar gente y reportar el conteo. */
export function pintarServicio(c, id) {
  c.innerHTML = `<p><a href="#/asistencia">← Volver a asistencia</a></p><div id="s"></div>`;
  const z = c.querySelector('#s');

  const { recargar } = pantalla(z, {
    titulo: 'Servicio',
    intro: 'Busque a la persona y márquela. Marcar dos veces no cuenta dos veces.',
    barra: `
      <form id="marcar" style="display:flex;gap:.5rem;flex:1;min-width:260px">
        <label class="sr-solo" for="qm">Buscar persona</label>
        <input id="qm" type="search" placeholder="Nombre o documento" autocomplete="off" style="flex:1">
      </form>`,
    cargar: () => api.obtener(`/api/v1/asistencia/servicios/${id}/marcados`),
    pintar: (d) => `
      <details class="tarjeta" style="margin-bottom:1rem">
        <summary style="cursor:pointer;font-weight:600">Reportar el conteo de la puerta</summary>
        <form id="conteo" style="margin-top:1rem;display:grid;gap:.75rem;grid-template-columns:repeat(auto-fit,minmax(140px,1fr))">
          ${['adultos', 'jovenes', 'ninos', 'primeraVez'].map(k => `
            <div class="campo">
              <label for="c-${k}">${k === 'primeraVez' ? 'Primera vez' : k[0].toUpperCase() + k.slice(1)}</label>
              <input id="c-${k}" name="${k}" type="number" min="0" inputmode="numeric" value="0">
            </div>`).join('')}
          <div style="grid-column:1/-1"><button class="boton" type="submit">Guardar el conteo</button></div>
        </form>
      </details>
      <p class="etiqueta">${d.total_filas} marcado(s)</p>
      ${d.total_filas
        ? tabla(d.marcados, [
            { titulo: 'Nombre', pintar: m => `<strong>${esc(m.nombre_completo)}</strong>` },
            { titulo: 'Marcada', pintar: m => esc(new Date(m.marcada_en).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })) },
            { titulo: 'Medio', pintar: m => chip(m.medio) },
          ])
        : vacio('👥', 'Todavía nadie marcado', 'Busque arriba a la primera persona.')}
      <div id="sug"></div>`,
  });

  z.addEventListener('submit', async ev => {
    if (ev.target.id !== 'conteo') return;
    ev.preventDefault();
    const f = ev.target, datos = {};
    for (const k of ['adultos', 'jovenes', 'ninos', 'primeraVez']) datos[k] = Number(f.elements[k].value || 0);
    try {
      const r = await api.enviar(`/api/v1/asistencia/servicios/${id}/conteo`, datos);
      avisar(`Conteo guardado: ${r.total} contados, ${r.marcados} marcados.`, 'exito');
      if (r.aviso) avisar(r.aviso, 'aviso');
      recargar();
    } catch (e) { avisar(e.message, 'error'); }
  });

  /* Buscar y marcar, sin salir de la pantalla. */
  let t;
  z.addEventListener('input', ev => {
    if (ev.target.id !== 'qm') return;
    clearTimeout(t);
    const q = ev.target.value.trim();
    t = setTimeout(async () => {
      const sug = z.querySelector('#sug');
      if (!sug) return;
      if (q.length < 2) { sug.innerHTML = ''; return; }
      try {
        const r = await api.obtener('/api/v1/personas?limite=8&q=' + encodeURIComponent(q));
        const filas = Array.isArray(r) ? r : (r?.datos ?? r?.filas ?? []);
        sug.innerHTML = filas.length ? `
          <p class="etiqueta" style="margin-top:1rem">Pulse para marcar</p>
          <div class="tarjeta" style="display:grid;gap:.4rem">
            ${filas.map(p => `<button class="boton boton--suave" data-marcar="${esc(p.id)}"
                 style="text-align:left">${esc(p.nombre ?? p.nombre_completo ?? '')}</button>`).join('')}
          </div>` : `<p class="ayuda" style="margin-top:1rem">Nadie coincide con «${esc(q)}».</p>`;
        sug.querySelectorAll('[data-marcar]').forEach(b => b.addEventListener('click', async () => {
          try {
            const r = await api.enviar(`/api/v1/asistencia/servicios/${id}/marcar`, { personaId: b.dataset.marcar });
            avisar(r.repetido ? r.mensaje : 'Marcado.', r.repetido ? 'aviso' : 'exito');
            z.querySelector('#qm').value = ''; sug.innerHTML = '';
            recargar();
          } catch (e) { avisar(e.message, 'error'); }
        }));
      } catch (e) { sug.innerHTML = `<p class="ayuda">No se pudo buscar: ${esc(e.message)}</p>`; }
    }, 300);
  });
}
