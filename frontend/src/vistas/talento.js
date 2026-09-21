import { api } from '../api.js';
import { pantalla, formulario, tabla, chip, sedes, esc, vacio, avisar } from './comun.js';

/**
 * Talento y voluntariado.
 *
 * ⛔ Lo primero que se ve no son los contratos: son los voluntarios que
 * están con niños HOY sin antecedentes vigentes. No es una métrica, es una
 * lista de salas que hay que cubrir antes del domingo.
 */
export function pintarTalento(c) {
  let form;
  const { recargar } = pantalla(c, {
    titulo: 'Talento y voluntariado',
    intro: 'Aquí entran los antecedentes que abren (o cierran) la puerta de RocaKids.',
    barra: `
      <button class="boton boton--suave" data-tab="voluntariados" aria-current="page">Voluntariados</button>
      <button class="boton boton--suave" data-tab="contratos">Contratos</button>`,
    cargar: async () => {
      const [v, t] = await Promise.all([
        api.obtener('/api/v1/talento/voluntariados?limite=100'),
        api.obtener('/api/v1/talento/contratos?limite=100').catch(() => ({ contratos: [], aviso: null })),
      ]);
      return { voluntariados: v.voluntariados, aviso: v.aviso, contratos: t.contratos, avisoContratos: t.aviso };
    },
    pintar: (d) => (form?.html ?? '') + `
      <section data-panel="voluntariados">
        <h2>Voluntariados</h2>
        ${d.voluntariados.length
          ? tabla(d.voluntariados, [
              { titulo: 'Nombre', pintar: v => `<strong>${esc(v.nombre_completo)}</strong>` },
              { titulo: 'Función', pintar: v => `${esc(v.funcion)}<br><span class="ayuda">${esc(v.ministerio)} · ${esc(v.sede)}</span>` },
              { titulo: 'Estado', pintar: v => chip(v.estado, v.estado === 'activo' ? '' : 'distintivo--aviso') },
              { titulo: 'Con menores', pintar: v => !v.trabaja_con_menores ? '—'
                  : v.apto_para_menores ? chip('apto') : chip('SIN antecedentes', 'distintivo--n4') },
              { titulo: '', pintar: v => `<a class="boton boton--suave" href="#/talento/${esc(v.persona_id)}">Antecedentes</a>` },
            ])
          : vacio('🙌', 'Ningún voluntariado', 'Registre el primero con el formulario de arriba.')}
      </section>
      <section data-panel="contratos" hidden>
        <h2>Contratos</h2>
        ${d.avisoContratos ? `<div class="aviso aviso--aviso" role="status">${esc(d.avisoContratos)}</div>` : ''}
        ${d.contratos.length
          ? tabla(d.contratos, [
              { titulo: 'Nombre', pintar: t => `<strong>${esc(t.nombre_completo)}</strong>` },
              { titulo: 'Cargo', pintar: t => `${esc(t.cargo)}<br><span class="ayuda">${esc(t.area)} · ${esc(t.sede)}</span>` },
              { titulo: 'Tipo', pintar: t => chip(t.tipo) },
              { titulo: 'Estado', pintar: t => chip(t.estado, t.estado === 'activo' ? '' : 'distintivo--aviso') },
              { titulo: 'Vigencia', pintar: t => `${esc(t.inicia)}${t.termina ? ' → ' + esc(t.termina) : ''}
                  ${t.vence_pronto ? chip('vence pronto', 'distintivo--aviso') : ''}` },
            ])
          : vacio('📄', 'Ningún contrato', 'Los contratos los carga Talento Humano de la central.')}
      </section>`,
  });

  c.addEventListener('click', ev => {
    const b = ev.target.closest('[data-tab]');
    if (!b) return;
    c.querySelectorAll('[data-tab]').forEach(x => x.removeAttribute('aria-current'));
    b.setAttribute('aria-current', 'page');
    c.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== b.dataset.tab; });
  });

  Promise.all([sedes(), api.obtener('/api/v1/organizacion/ministerios')]).then(([op, mi]) => {
    const ministerios = (Array.isArray(mi) ? mi : mi?.ministerios ?? [])
      .map(m => ({ valor: m.id, texto: m.nombre }));
    form = formulario({
      titulo: '+ Registrar un voluntariado',
      campos: [
        { nombre: 'personaId', etiqueta: 'Identificador de la persona', obligatorio: true,
          ayuda: 'Búsquela en Personas y pegue aquí su identificador.' },
        { nombre: 'sedeId', etiqueta: 'Sede', opciones: op, obligatorio: true },
        { nombre: 'ministerioId', etiqueta: 'Ministerio', opciones: ministerios, obligatorio: true },
        { nombre: 'funcion', etiqueta: 'Función', obligatorio: true, minimo: 3 },
        { nombre: 'desde', etiqueta: 'Desde', tipo: 'date' },
        /* ⛔ 20 sep 2026. Esta casilla NO estaba, y el backend la lee
           (`b?.trabajaConMenores === true`). Todo voluntariado creado
           desde aquí nacía con `trabaja_con_menores = false`, así que
           NUNCA podía aparecer en el aviso rojo de «activos con menores
           y sin antecedentes vigentes» que esta misma pantalla anuncia
           en su cabecera. La salvaguarda de menores se perdía en
           silencio, con respuesta 200. */
        { nombre: 'trabajaConMenores', etiqueta: '¿Va a estar con menores?', obligatorio: true,
          opciones: [{ valor: 'no', texto: 'No' }, { valor: 'si', texto: 'Sí, con niños o adolescentes' }],
          ayuda: 'Si marca que sí, el sistema le exigirá antecedentes vigentes antes de dejarlo servir.' },
        { nombre: 'compromisoFirmadoEn', etiqueta: 'Compromiso de protección firmado el', tipo: 'date' },
      ],
      al: (d) => api.enviar('/api/v1/talento/voluntariados',
        { ...d, trabajaConMenores: d.trabajaConMenores === 'si' }),
    });
    recargar().then(() => form.enganchar(c, recargar));
  }).catch(e => avisar('No se pudo preparar el formulario: ' + e.message, 'error'));
}

/** Los antecedentes de una persona: lo que la deja o no estar con niños. */
export function pintarAntecedentes(c, personaId) {
  c.innerHTML = `<p><a href="#/talento">← Volver a talento</a></p><div id="a"></div>`;
  const z = c.querySelector('#a');

  const { recargar } = pantalla(z, {
    titulo: 'Antecedentes',
    cargar: () => api.obtener(`/api/v1/talento/antecedentes/${personaId}`),
    pintar: (d) => `
      <div class="tarjeta" style="margin-bottom:1rem">
        <p style="margin:0;font-size:1.1rem">
          ${d.apto_para_menores
            ? '✅ <strong>Apto para estar con menores</strong>'
            : '⛔ <strong>NO apto para estar con menores</strong>'}
        </p>
        ${d.le_faltan?.length ? `<p class="ayuda" style="margin:.4rem 0 0">Falta: ${esc(d.le_faltan.map(f => f.nombre).join(', '))}</p>` : ''}
      </div>

      <details class="tarjeta" style="margin-bottom:1rem">
        <summary style="cursor:pointer;font-weight:600">+ Registrar un antecedente</summary>
        <form id="ant" style="margin-top:1rem;display:grid;gap:.75rem">
          <div class="campo"><label for="a-tipo">Tipo</label>
            <input id="a-tipo" name="tipo" placeholder="DELITOS_SEXUALES, JUDICIALES…" required></div>
          <div class="campo"><label for="a-res">Resultado</label>
            <select id="a-res" name="resultado" required>
              <option value="apto">Apto</option><option value="no_apto">No apto</option>
              <option value="con_observacion">Con observación</option><option value="en_tramite">En trámite</option>
            </select></div>
          <div class="campo"><label for="a-exp">Expedido</label>
            <input id="a-exp" name="expedidoEn" type="date" required></div>
          <div class="campo"><label for="a-ven">Vence</label>
            <input id="a-ven" name="venceEn" type="date"></div>
          <button class="boton" type="submit">Registrar</button>
        </form>
      </details>

      ${d.antecedentes.length
        ? tabla(d.antecedentes, [
            { titulo: 'Tipo', pintar: a => `<strong>${esc(a.tipo_nombre || a.tipo)}</strong>` },
            { titulo: 'Resultado', pintar: a => chip(a.resultado, a.resultado === 'apto' ? '' : 'distintivo--n4') },
            { titulo: 'Expedido', campo: 'expedido_en' },
            { titulo: 'Vence', pintar: a => !a.vence_en ? 'sin vencimiento'
                : `${esc(a.vence_en)} ${a.vencido ? chip('VENCIDO', 'distintivo--n4')
                    : a.dias_restantes < 30 ? chip(a.dias_restantes + ' días', 'distintivo--aviso') : ''}` },
          ])
        : vacio('🗂', 'Ningún antecedente registrado', 'Sin antecedentes no se puede servir con niños.')}`,
  });

  z.addEventListener('submit', async ev => {
    if (ev.target.id !== 'ant') return;
    ev.preventDefault();
    const f = ev.target;
    try {
      const r = await api.enviar('/api/v1/talento/antecedentes', {
        personaId,
        tipo: f.elements.tipo.value.trim(),
        resultado: f.elements.resultado.value,
        expedidoEn: f.elements.expedidoEn.value,
        venceEn: f.elements.venceEn.value || undefined,
      });
      avisar(r.mensaje + (r.apto_para_menores ? ' Queda apto para menores.' : ''), 'exito');
      recargar();
    } catch (e) { avisar(e.message, 'error'); }
  });
}
