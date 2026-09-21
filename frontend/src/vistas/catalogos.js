import { api } from '../api.js';
import { esc, cargando, error, engancharReintentar, unaVez, avisar } from '../ui.js';

/**
 * La consola de catálogos.
 *
 * ⛔ Esta pantalla es la respuesta a lo que pidió Daniel: «si mañana
 * necesito un culto de jóvenes, debe ser fácil». Antes eso era una
 * migración, una revisión y un despliegue. Aquí es un formulario.
 *
 * Y lo contrario también se ve: una MÁQUINA DE ESTADOS no se puede ampliar
 * desde aquí, y la pantalla dice POR QUÉ. Que se pueda cambiar todo es tan
 * peligroso como que no se pueda cambiar nada.
 */
export async function pintarCatalogos(c) {
  c.innerHTML = cargando(4);
  try {
    /* ⛔ La versión anterior hacía `.catch(() => null)` y pintaba SIEMPRE
       «la ruta todavía no está expuesta». Con eso, quedarse sin red, no
       tener permiso o que el servidor se cayera producían el mismo
       diagnóstico, y era falso: la ruta existe. Alguien abría un ticket
       contra el backend por una función que ya funciona. */
    const cats = await api.obtener('/api/v1/identidad/catalogos');
    pintar(cats);
  } catch (e) {
    const porQue =
      e.estado === 0   ? 'No hay conexión con el servidor.'
    : e.estado === 401 ? 'Su sesión no es válida. Vuelva a entrar.'
    : e.estado === 403 ? 'Su rol no tiene permiso para ver los catálogos de la red.'
    : e.estado === 404 ? 'Esta ruta todavía no está expuesta en la API.'
    : e.estado >= 500  ? 'El servidor tuvo un problema.'
    : e.message;
    c.innerHTML = `<h1>Catálogos</h1>` + error(porQue, e.peticionId);
    engancharReintentar(c, () => pintarCatalogos(c));
  }

  function pintar(cats) {
    const abiertos = cats.filter(x => !x.cerrado);
    const cerrados = cats.filter(x => x.cerrado);
    c.innerHTML = `
      <h1>Catálogos</h1>
      <p class="etiqueta">agregar un valor aquí no exige desplegar nada</p>

      <h2 style="margin-top:1.5rem">Se pueden ampliar</h2>
      <div class="rejilla">
        ${abiertos.map(x => `
          <div class="tarjeta">
            <h3>${esc(x.nombre)}</h3>
            <p style="color:var(--cr-texto-suave);font-size:var(--cr-tx-sm)">${esc(x.descripcion)}</p>
            <p><span class="distintivo distintivo--ok">${x.valores_vigentes} vigentes</span>
               ${x.editable_por_sede ? '<span class="distintivo">por sede</span>' : ''}</p>
            <button class="boton boton--suave" data-cat="${esc(x.codigo)}">Agregar un valor</button>
          </div>`).join('')}
      </div>

      <h2 style="margin-top:2rem">Cerrados a propósito</h2>
      <p style="color:var(--cr-texto-suave);font-size:var(--cr-tx-sm)">
        Son máquinas de estados: cada valor lo produce código y tiene transiciones.
        Agregar uno sin escribir el código dejaría filas en un estado que nadie sabe procesar.</p>
      <div class="rejilla">
        ${cerrados.map(x => `
          <div class="tarjeta" style="opacity:.85">
            <h3>${esc(x.nombre)}</h3>
            <p class="etiqueta">por qué está cerrado</p>
            <p style="font-size:var(--cr-tx-sm);color:var(--cr-texto-suave)">${esc(x.motivo_cerrado)}</p>
          </div>`).join('')}
      </div>`;

    c.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => agregar(b.dataset.cat)));
  }

  async function agregar(catalogo) {
    const etiqueta = prompt(`Nombre del valor nuevo para «${catalogo}»\n(ej. Culto de jóvenes)`);
    if (!etiqueta) return;
    const codigo = prompt('Código corto, sin espacios ni tildes\n(ej. culto_jovenes)');
    if (!codigo) return;
    try {
      await api.enviar('/api/v1/identidad/catalogos/' + encodeURIComponent(catalogo) + '/valores',
        { codigo, etiqueta });
      avisar(`«${etiqueta}» ya está disponible. No hubo que desplegar nada.`, 'ok');
      pintarCatalogos(c);
    } catch (e) { avisar(e.message, 'error'); }
  }
}
