import { api } from '../api.js';
import { esc, cargando, error, errorDeBloque, engancharReintentar, distintivoNivel } from '../ui.js';

/** El panel se pinta contra lo que la BASE dice que esta persona alcanza,
    no contra una lista escrita en el cliente. Ahí estaba el agujero del
    prototipo: se podía abrir una pestaña que el permiso ya negaba. */
export async function pintarPanel(c, sesion) {
  c.innerHTML = cargando(4);
  try {
    /* ⛔ Antes cada bloque hacía `.catch(() => [])` y la pantalla se pintaba
       como si todo estuviera bien: desaparecían las sedes y el estado del
       sistema sin una sola advertencia. Un pastor no podía distinguir «no
       tengo sedes» de «el sistema está caído». Ahora cada bloque dice lo
       suyo. */
    const [rSedes, rSalud] = await Promise.allSettled([
      api.obtener('/api/v1/organizacion/sedes'),
      api.obtener('/salud/detalle'),
    ]);
    const sedes = rSedes.status === 'fulfilled' ? rSedes.value : null;
    const salud = rSalud.status === 'fulfilled' ? rSalud.value : null;
    const fallaSedes = rSedes.status === 'rejected' ? rSedes.reason : null;
    const fallaSalud = rSalud.status === 'rejected' ? rSalud.reason : null;
    const s = sesion.alcance ?? {};
    c.innerHTML = `
      <h1>Buen día${sesion.persona?.nombre ? ', ' + esc(sesion.persona.nombre.split(' ')[0]) : ''}</h1>
      <p class="etiqueta">lo que usted alcanza hoy</p>
      <div class="rejilla" style="margin:1rem 0 2rem">
        ${ficha('Sedes', s.todaLaRed ? 'Toda la red' : String(s.sedes?.length ?? 0),
                s.todaLaRed ? 'alcance de organización' : 'sedes asignadas')}
        ${ficha('Nivel de acceso', 'N' + (s.nivelMax ?? 0), textoNivel(s.nivelMax ?? 0))}
        ${ficha('Módulos', String(sesion.modulos?.length ?? 0), 'a los que puede entrar')}
        ${ficha('Roles', String(sesion.asignaciones?.length ?? 0), 'vigentes hoy')}
      </div>

      <h2>Sus módulos</h2>
      ${(sesion.modulos ?? []).length ? `
        <div class="rejilla">
          ${sesion.modulos.map(m => `
            <div class="tarjeta">
              <h3 style="margin-bottom:.4rem">${esc(m.nombre ?? m.modulo)}</h3>
              ${distintivoNivel(Number(m.nivel_dato ?? 0))}
            </div>`).join('')}
        </div>` :
        `<div class="tarjeta"><p>Todavía no tiene módulos asignados. Comuníquese con la central.</p></div>`}

      <h2 style="margin-top:2rem">Sedes que alcanza</h2>
      ${fallaSedes ? errorDeBloque('las sedes', fallaSedes.message) : ''}
      ${sedes?.length ? `
        <div class="tarjeta" style="padding:0;overflow:hidden">
          <table class="tabla">
            <thead><tr><th>Código</th><th>Sede</th><th>Ciudad</th></tr></thead>
            <tbody>${sedes.slice(0, 40).map(x => `
              <tr><td data-th="Código"><code>${esc(x.codigo)}</code></td>
                  <td data-th="Sede">${esc(x.nombre)}</td>
                  <td data-th="Ciudad">${esc(x.ciudad ?? '')}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>` : (fallaSedes ? '' : '<p style="color:var(--cr-texto-suave)">No alcanza ninguna sede todavía.</p>')}

      <h2 style="margin-top:2rem">Estado del sistema</h2>
      ${fallaSalud ? errorDeBloque('el estado del sistema', fallaSalud.message) : ''}
      ${salud ? `
        <div class="tarjeta">
          <p>${salud.estado === 'sano'
            ? '<span class="distintivo distintivo--ok">sano</span>'
            : '<span class="distintivo distintivo--aviso">con problemas</span>'}
            ${(salud.problemas ?? []).map(p => `<br><span class="etiqueta">${esc(p)}</span>`).join('')}</p>
        </div>` : ''}
    `;
    engancharReintentar(c, () => pintarPanel(c, sesion));
  } catch (e) {
    c.innerHTML = error(e.message, e.peticionId);
    engancharReintentar(c, () => pintarPanel(c, sesion));
  }
}

const ficha = (t, v, p) => `
  <div class="tarjeta">
    <p class="etiqueta">${esc(t)}</p>
    <p style="font-family:var(--cr-fuente-display);font-size:1.9rem;line-height:1.1;margin:.2rem 0">${esc(v)}</p>
    <p style="color:var(--cr-texto-suave);font-size:var(--cr-tx-sm);margin:0">${esc(p)}</p>
  </div>`;

const textoNivel = (n) => n >= 4 ? 'incluye menores y salud'
  : n === 3 ? 'incluye consejería y aportes'
  : n === 2 ? 'datos personales' : 'solo datos internos';
