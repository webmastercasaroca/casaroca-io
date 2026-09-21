import { api } from '../api.js';
import { esc, cargando, vacio, error, avisar, unaVez } from '../ui.js';

/**
 * Piezas compartidas por las pantallas de módulo.
 *
 * ⛔ Por qué existe este archivo: con veintidós módulos, repetir en cada uno
 * el cargar, el estado vacío, el estado de error y la tabla responsive es
 * la forma más segura de que tres pantallas se olviden de uno de los tres
 * estados. Aquí están una vez, y ninguna vista se los puede saltar.
 *
 * ⛔ Y no hay `innerHTML` con datos sin escapar: todo pasa por `esc`.
 */

/** Tabla con cabecera repetida en móvil (`data-th` lo pinta el CSS). */
export function tabla(filas, columnas) {
  return `
    <div class="tarjeta" style="padding:0;overflow:hidden">
      <table class="tabla">
        <thead><tr>${columnas.map(k => `<th>${esc(k.titulo)}</th>`).join('')}</tr></thead>
        <tbody>${filas.map(f => `
          <tr${f.__id ? ` data-id="${esc(f.__id)}"` : ''}${f.__click ? ' class="fila--pulsable" tabindex="0" role="button"' : ''}>
            ${columnas.map(k => `<td data-th="${esc(k.titulo)}">${k.pintar ? k.pintar(f) : esc(f[k.campo] ?? '—')}</td>`).join('')}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

export const chip = (texto, clase = '') =>
  `<span class="distintivo ${clase}">${esc(texto)}</span>`;

/** Aviso que viene del servidor. Si la API lo manda, se muestra: son los
    números que alguien tiene que ver (cupos pasados, casos sin consejero). */
export const avisoServidor = (t) => t
  ? `<div class="aviso ${/⛔|VENCID|SIN /i.test(t) ? 'aviso--error' : 'aviso--aviso'}" role="status">${esc(t)}</div>`
  : '';

/**
 * El armazón de una pantalla de lista: título, intro, barra de acciones,
 * y un cuerpo que se recarga solo.
 */
export function pantalla(c, { titulo, intro, barra = '', cargar, pintar }) {
  c.innerHTML = `
    <h1>${esc(titulo)}</h1>
    ${intro ? `<p class="etiqueta">${esc(intro)}</p>` : ''}
    <div id="barra" style="display:flex;gap:.5rem;flex-wrap:wrap;margin:.75rem 0">${barra}</div>
    <div id="avisos-vista"></div>
    <div id="cuerpo">${cargando(3)}</div>`;

  const cuerpo = c.querySelector('#cuerpo');
  const zonaAviso = c.querySelector('#avisos-vista');

  /* ⛔ Red de seguridad. Un `<form>` con un solo campo de texto y sin
     botón de envío dispara la submisión IMPLÍCITA al pulsar Intro (o el
     botón «buscar» del teclado del teléfono). Como ninguno lleva
     `action`, el navegador navegaba a la misma dirección por GET: la
     aplicación se recargaba entera, se perdía lo escrito y, dentro de la
     ficha de un grupo o de una cohorte, se salía de la ficha. Los
     buscadores ya filtran al teclear, así que Intro no tiene que hacer
     nada más. Esto va DESPUÉS de los manejadores propios, que llaman a
     `preventDefault` por su cuenta y siguen funcionando igual. */
  c.addEventListener('submit', (ev) => {
    if (!ev.defaultPrevented) ev.preventDefault();
  });

  async function recargar() {
    cuerpo.innerHTML = cargando(3);
    try {
      const datos = await cargar();
      zonaAviso.innerHTML = avisoServidor(datos?.aviso);
      cuerpo.innerHTML = pintar(datos, recargar);
      enganchar(cuerpo, recargar);
    } catch (e) {
      zonaAviso.innerHTML = '';
      cuerpo.innerHTML = error(e.message, e.peticionId);
      cuerpo.querySelectorAll('[data-reintentar]').forEach(b => b.addEventListener('click', recargar));
    }
  }

  /* Los botones declarativos: `data-enviar` (ruta), `data-cuerpo` (JSON) y
     `data-confirmar` (texto). Evita un manejador escrito a mano por botón,
     que es donde se cuela el que olvida `unaVez` y dispara dos veces. */
  function enganchar(raiz, recargar) {
    raiz.querySelectorAll('[data-enviar]').forEach(b => {
      b.addEventListener('click', () => unaVez(b, async () => {
        if (b.dataset.confirmar && !confirm(b.dataset.confirmar)) return;
        try {
          const r = await api.enviar(b.dataset.enviar, JSON.parse(b.dataset.cuerpo || '{}'));
          avisar(r?.mensaje ?? 'Listo.', r?.aviso ? 'aviso' : 'exito');
          if (r?.aviso) avisar(r.aviso, 'aviso');
          await recargar();
        } catch (e) { avisar(e.message, 'error'); }
      }));
    });
    raiz.querySelectorAll('.fila--pulsable').forEach(f => {
      const ir = () => f.dispatchEvent(new CustomEvent('cr:abrir', { bubbles: true, detail: f.dataset.id }));
      f.addEventListener('click', ir);
      f.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ir(); } });
    });
  }

  recargar();
  return { recargar, cuerpo };
}

/**
 * Formulario en una tarjeta plegable. Se pliega a propósito: la pantalla
 * es para MIRAR lo que hay; crear es lo que se hace de vez en cuando.
 */
export function formulario({ titulo, campos, boton = 'Guardar', al }) {
  const id = 'f' + Math.random().toString(36).slice(2, 8);
  const html = `
    <details class="tarjeta" style="margin-bottom:1rem">
      <summary style="cursor:pointer;font-weight:600">${esc(titulo)}</summary>
      <form id="${id}" novalidate style="margin-top:1rem;display:grid;gap:.75rem">
        ${campos.map(k => `
          <div class="campo">
            <label for="${id}-${esc(k.nombre)}">${esc(k.etiqueta)}${k.obligatorio ? ' *' : ''}</label>
            ${k.opciones ? `
              <select id="${id}-${esc(k.nombre)}" name="${esc(k.nombre)}" ${k.obligatorio ? 'required' : ''}>
                <option value="">${esc(k.vacio ?? 'Elija…')}</option>
                ${k.opciones.map(o => `<option value="${esc(o.valor)}">${esc(o.texto)}</option>`).join('')}
              </select>`
            : k.multilinea ? `
              <textarea id="${id}-${esc(k.nombre)}" name="${esc(k.nombre)}" rows="3"
                        ${k.obligatorio ? 'required' : ''}
                        ${k.minimo ? `minlength="${k.minimo}"` : ''}></textarea>`
            : `
              <input id="${id}-${esc(k.nombre)}" name="${esc(k.nombre)}" type="${esc(k.tipo ?? 'text')}"
                     ${k.obligatorio ? 'required' : ''} ${k.minimo ? `minlength="${k.minimo}"` : ''}
                     ${k.placeholder ? `placeholder="${esc(k.placeholder)}"` : ''}>`}
            ${k.ayuda ? `<span class="ayuda">${esc(k.ayuda)}</span>` : ''}
          </div>`).join('')}
        <button class="boton" type="submit">${esc(boton)}</button>
      </form>
    </details>`;
  return {
    html,
    /**
     * ⛔ 20 de septiembre de 2026. Esto colgaba el escuchador DEL PROPIO
     * `<form>`, y el formulario se pinta DENTRO de `#cuerpo`, que
     * `recargar()` reemplaza entero al guardar. Resultado: el formulario
     * funcionaba UNA vez. Al segundo intento, el `<form>` nuevo no tenía
     * escuchador y, como no lleva `action`, el navegador hacía la
     * submisión nativa: la aplicación se recargaba y no se guardaba nada.
     * Para el pastor era exactamente «pulsé y no pasó nada».
     *
     * Ahora se delega en el CONTENEDOR de la vista, que sobrevive a los
     * repintados, y se marca para no colgarlo dos veces si se vuelve a
     * entrar a la misma pantalla.
     */
    enganchar(raiz, recargar) {
      if (raiz.dataset['forma_' + id]) return;
      raiz.dataset['forma_' + id] = '1';
      raiz.addEventListener('submit', ev => {
        const f = ev.target;
        if (f?.id !== id) return;
        ev.preventDefault();
        const b = f.querySelector('button[type=submit]');
        unaVez(b, async () => {
          const datos = {};
          for (const k of campos) {
            const v = f.elements[k.nombre]?.value?.trim();
            if (v !== '' && v !== undefined) datos[k.nombre] = k.numero ? Number(v) : v;
            else if (k.obligatorio) { avisar(`Falta «${k.etiqueta}».`, 'error'); return; }
          }
          try {
            const r = await al(datos);
            avisar(r?.mensaje ?? 'Guardado.', 'exito');
            if (r?.aviso) avisar(r.aviso, 'aviso');
            f.reset();
            f.closest('details').open = false;
            await recargar();
          } catch (e) { avisar(e.message, 'error'); }
        });
      });
    },
  };
}

/** Las sedes que esta sesión alcanza, para los selectores. Se pide una vez. */
let sedesCache = null;
export async function sedes() {
  if (sedesCache) return sedesCache;
  const r = await api.obtener('/api/v1/organizacion/sedes');
  sedesCache = (Array.isArray(r) ? r : r?.sedes ?? []).map(s => ({
    valor: s.id, texto: `${s.codigo} · ${s.nombre}`,
  }));
  return sedesCache;
}

export { esc, vacio, avisar };
