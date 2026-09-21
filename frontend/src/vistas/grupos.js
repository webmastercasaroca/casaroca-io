import { api } from '../api.js';
import { pantalla, formulario, tabla, chip, sedes, esc, vacio, avisar } from './comun.js';

/** Grupos y hogares. Se ordena por el que lleva más tiempo sin reunirse:
    lo que hay que mirar primero no es el grupo grande, es el callado. */
export function pintarGrupos(c) {
  let form;
  const { recargar } = pantalla(c, {
    titulo: 'Grupos',
    intro: 'Ordenados por el que lleva más tiempo sin reportar reunión.',
    cargar: () => api.obtener('/api/v1/grupos?limite=100'),
    pintar: (d) => (form?.html ?? '') + (d.grupos.length
      ? tabla(d.grupos, [
          /* ⛔ Regla de `docs/DISENO.md`: la acción va en la PRIMERA celda.
             En un teléfono la última columna de una tabla que se desplaza
             de lado empieza fuera de la pantalla, y el control no existe. */
          { titulo: 'Grupo', pintar: g => `<a class="enlace-fila" href="#/grupos/${esc(g.id)}">
              <strong>${esc(g.nombre)}</strong></a><br><span class="ayuda">${esc(g.tipo)}</span>` },
          { titulo: 'Sede', campo: 'sede' },
          { titulo: 'Reunión', pintar: g => g.dia_reunion ? `${esc(g.dia_reunion)} ${esc(g.hora ?? '')}` : '<span class="ayuda">sin fijar</span>' },
          { titulo: 'Miembros', campo: 'miembros' },
          { titulo: 'Última reunión', pintar: g => g.ultima_reunion
              ? `${esc(g.ultima_reunion)} ${g.dias_sin_reunirse > 45 ? chip(g.dias_sin_reunirse + ' días', 'distintivo--n4') : ''}`
              : chip('nunca', 'distintivo--n4') },
        ])
      : vacio('🏠', 'Ningún grupo todavía', 'Cree el primero con el formulario de arriba.')),
  });

  sedes().then(op => {
    form = formulario({
      titulo: '+ Crear un grupo',
      campos: [
        { nombre: 'sedeId', etiqueta: 'Sede', opciones: op, obligatorio: true },
        { nombre: 'nombre', etiqueta: 'Nombre', obligatorio: true, minimo: 3 },
        { nombre: 'tipo', etiqueta: 'Tipo', obligatorio: true,
          opciones: [{ valor: 'pequeno', texto: 'Grupo pequeño' }, { valor: 'hogar', texto: 'Hogar' },
                     { valor: 'discipulado', texto: 'Discipulado' }, { valor: 'ministerio', texto: 'De ministerio' }] },
        { nombre: 'diaReunion', etiqueta: 'Día de reunión',
          opciones: ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'].map(d => ({ valor: d, texto: d })) },
        { nombre: 'hora', etiqueta: 'Hora', tipo: 'time' },
        { nombre: 'cupo', etiqueta: 'Cupo', tipo: 'number', numero: true },
      ],
      al: (d) => api.enviar('/api/v1/grupos', d),
    });
    recargar().then(() => form.enganchar(c, recargar));
  }).catch(e => avisar('No se pudieron cargar las sedes: ' + e.message, 'error'));
}

/** La ficha de un grupo: quién está, quién se fue y cuándo se reunieron. */
export function pintarGrupo(c, id) {
  c.innerHTML = `<p><a href="#/grupos">← Volver a grupos</a></p><div id="g"></div>`;
  const z = c.querySelector('#g');

  const { recargar } = pantalla(z, {
    titulo: 'Grupo',
    cargar: () => api.obtener(`/api/v1/grupos/${id}`),
    pintar: (d) => `
      <div class="tarjeta" style="margin-bottom:1rem">
        <h2 style="margin:0 0 .3rem">${esc(d.grupo.nombre)}</h2>
        <p class="etiqueta">${esc(d.grupo.tipo)} · ${esc(d.grupo.sede)}
          ${d.grupo.dia_reunion ? ` · ${esc(d.grupo.dia_reunion)} ${esc(d.grupo.hora ?? '')}` : ''}
          ${d.grupo.cerrado_en ? ` · cerrado el ${esc(d.grupo.cerrado_en)}` : ''}</p>
        <p><strong>${d.miembros.activos}</strong> miembro(s) activo(s) de ${d.miembros.total} en la historia.</p>
      </div>

      <details class="tarjeta" style="margin-bottom:1rem">
        <summary style="cursor:pointer;font-weight:600">+ Reportar una reunión</summary>
        <form id="reunion" style="margin-top:1rem;display:grid;gap:.75rem">
          <div class="campo"><label for="r-fecha">Fecha</label>
            <input id="r-fecha" name="fecha" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
          <div class="campo"><label for="r-tema">Tema</label><input id="r-tema" name="tema"></div>
          <div class="campo"><label for="r-asis">Asistentes</label>
            <input id="r-asis" name="asistentes" type="number" min="0" inputmode="numeric"></div>
          <button class="boton" type="submit">Reportar</button>
        </form>
      </details>

      <h2>Miembros</h2>
      <form id="agregar" style="display:flex;gap:.5rem;margin:.5rem 0 1rem">
        <label class="sr-solo" for="qg">Buscar persona</label>
        <input id="qg" type="search" placeholder="Buscar a quien se agrega" autocomplete="off" style="flex:1">
      </form>
      <div id="sug-g"></div>
      ${d.miembros.lista.length
        ? tabla(d.miembros.lista, [
            { titulo: 'Nombre', pintar: m => `<strong>${esc(m.nombre_completo)}</strong>` },
            { titulo: 'Rol', pintar: m => chip(m.rol) },
            { titulo: 'Desde', campo: 'desde' },
            { titulo: 'Estado', pintar: m => m.hasta
                ? `<span class="ayuda">salió ${esc(m.hasta)}${m.motivo_salida ? ' · ' + esc(m.motivo_salida) : ''}</span>`
                : chip('activo') },
            { titulo: '', pintar: m => m.hasta ? '' :
                `<button class="boton boton--suave" data-salir="${esc(m.persona_id)}">Sacar</button>` },
          ])
        : vacio('👥', 'Nadie en el grupo', 'Busque arriba a la primera persona.')}

      <h2 style="margin-top:2rem">Reuniones</h2>
      ${d.reuniones.length
        ? tabla(d.reuniones, [
            { titulo: 'Fecha', campo: 'fecha' },
            { titulo: 'Tema', pintar: r => esc(r.tema || '—') },
            { titulo: 'Asistentes', pintar: r => r.asistentes ?? '—' },
          ])
        : vacio('🗓', 'Ninguna reunión reportada', 'Un grupo que no reporta reuniones es una lista, no un grupo.')}`,
  });

  z.addEventListener('submit', async ev => {
    if (ev.target.id !== 'reunion') return;
    ev.preventDefault();
    const f = ev.target;
    const d = { fecha: f.elements.fecha.value || undefined, tema: f.elements.tema.value || undefined };
    if (f.elements.asistentes.value) d.asistentes = Number(f.elements.asistentes.value);
    try {
      const r = await api.enviar(`/api/v1/grupos/${id}/reuniones`, d);
      avisar(r.mensaje, 'exito'); recargar();
    } catch (e) { avisar(e.message, 'error'); }
  });

  z.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-salir]');
    if (!b) return;
    const motivo = prompt('¿Por qué sale del grupo? (queda escrito para quien venga detrás)');
    if (!motivo || motivo.trim().length < 5) return avisar('Hace falta un motivo de al menos 5 caracteres.', 'error');
    try {
      const r = await api.enviar(`/api/v1/grupos/${id}/miembros/${b.dataset.salir}/salir`, { motivo: motivo.trim() });
      avisar(r.mensaje, 'exito'); recargar();
    } catch (e) { avisar(e.message, 'error'); }
  });

  let t;
  z.addEventListener('input', ev => {
    if (ev.target.id !== 'qg') return;
    clearTimeout(t);
    const q = ev.target.value.trim();
    t = setTimeout(async () => {
      const sug = z.querySelector('#sug-g');
      if (!sug) return;
      if (q.length < 2) { sug.innerHTML = ''; return; }
      try {
        const r = await api.obtener('/api/v1/personas?limite=8&q=' + encodeURIComponent(q));
        const filas = Array.isArray(r) ? r : (r?.datos ?? r?.filas ?? []);
        sug.innerHTML = filas.length ? `<div class="tarjeta" style="display:grid;gap:.4rem;margin-bottom:1rem">
          ${filas.map(p => `<button class="boton boton--suave" data-agregar="${esc(p.id)}" style="text-align:left">
             ${esc(p.nombre ?? p.nombre_completo ?? '')}</button>`).join('')}</div>`
          : `<p class="ayuda">Nadie coincide.</p>`;
        sug.querySelectorAll('[data-agregar]').forEach(b => b.addEventListener('click', async () => {
          try {
            const r = await api.enviar(`/api/v1/grupos/${id}/miembros`, { personaId: b.dataset.agregar });
            avisar(r.mensaje ?? 'Agregado.', r.repetido ? 'aviso' : 'exito');
            z.querySelector('#qg').value = ''; sug.innerHTML = ''; recargar();
          } catch (e) { avisar(e.message, 'error'); }
        }));
      } catch (e) { sug.innerHTML = `<p class="ayuda">${esc(e.message)}</p>`; }
    }, 300);
  });
}
