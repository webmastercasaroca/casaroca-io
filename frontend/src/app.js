import { api, hayTokens, borrarTokens, guardarTokens } from './api.js';
import { pintarEntrar } from './vistas/entrar.js';
import { pintarPanel } from './vistas/panel.js';
import { pintarPersonas } from './vistas/personas.js';
import { pintarCheckin } from './vistas/checkin.js';
import { pintarCatalogos } from './vistas/catalogos.js';
import { pintarAsistencia, pintarServicio } from './vistas/asistencia.js';
import { pintarGrupos, pintarGrupo } from './vistas/grupos.js';
import { pintarConsejeria, pintarCaso } from './vistas/consejeria.js';
import { pintarFormacion, pintarCohorte } from './vistas/formacion.js';
import { pintarTalento, pintarAntecedentes } from './vistas/talento.js';
import { esc, cargando, error, engancharReintentar, avisar } from './ui.js';
import { cola } from './offline.js';
import { demoActivo } from './demo.js';

/**
 * El armazón.
 *
 * ⛔ LA REGLA QUE ORDENA TODO ESTO: el menú se pinta contra lo que la BASE
 * dice que esta sesión alcanza (`/api/v1/sesion/yo`), no contra una lista
 * escrita aquí. En el prototipo la lista estaba cableada en el cliente y se
 * podía abrir una pestaña que el permiso ya negaba.
 */
const RAIZ = document.getElementById('app');
let sesion = null;

/* Cada vista declara QUÉ MÓDULO necesita. Si la sesión no lo alcanza, ni
   siquiera aparece en el menú, y entrar por la URL tampoco la abre. */
const VISTAS = {
  panel:      { titulo: 'Panel',      icono: '◈', modulo: null,          pintar: pintarPanel },
  personas:   { titulo: 'Personas',   icono: '☺', modulo: 'personas',    pintar: pintarPersonas, ficha: null },
  asistencia: { titulo: 'Asistencia', icono: '✓', modulo: 'asistencia',  pintar: pintarAsistencia, ficha: pintarServicio },
  grupos:     { titulo: 'Grupos',     icono: '⬡', modulo: 'grupos',      pintar: pintarGrupos,   ficha: pintarGrupo },
  checkin:    { titulo: 'Niños',      icono: '✦', modulo: 'rocakids',    pintar: pintarCheckin },
  consejeria: { titulo: 'Consejería', icono: '🕊', modulo: 'consejeria', pintar: pintarConsejeria, ficha: pintarCaso },
  formacion:  { titulo: 'Formación',  icono: '✎', modulo: 'formacion',   pintar: pintarFormacion, ficha: pintarCohorte },
  talento:    { titulo: 'Talento',    icono: '⚑', modulo: 'talento',     pintar: pintarTalento,  ficha: pintarAntecedentes },
  /* ⛔ 20 sep 2026 · Catálogos declaraba el módulo «sistemas», que NO
     EXISTE en `sistema.modulos` (el que existe es «identidad»). Resultado:
     a quien no tuviera alcance de toda la red, la pantalla no le aparecía
     nunca, y nadie lo había notado porque se probó siempre con el Pastor
     Director General. Una lista escrita a mano que nadie contrasta con la
     base se equivoca en silencio. */
  catalogos:  { titulo: 'Catálogos',  icono: '☰', modulo: 'identidad',   pintar: pintarCatalogos },
};

/* ⛔ 20 sep 2026 · LA ADMINISTRACIÓN NO VIVE AQUÍ, y no es un detalle de
   organización: es una decisión de Daniel. El Sistema Master (el comando
   central: desplegar iglesias, crear accesos, otorgar roles, armar los
   equipos corporativos) es OTRA plataforma, con su propia dirección y su
   propio visual, porque quien entra ahí administra la red entera y tiene
   que saber dónde está. Esta aplicación es la de la sede.
   Vive en `master/` y se entra por el enlace de abajo. */

const alcanza = (modulo) =>
  !modulo || (sesion?.modulos ?? []).some(m => (m.modulo ?? m) === modulo) || sesion?.alcance?.todaLaRed;

/* ⛔ Dos segmentos: `#/grupos` y `#/grupos/<id>`. La ficha tiene su propia
   direccion a proposito: es lo que permite mandar «mira este caso» por un
   mensaje, y lo que hace que el boton de atras del telefono funcione. */
function rutaActual() {
  const partes = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const r = partes[0] || 'panel';
  if (!VISTAS[r] || !alcanza(VISTAS[r].modulo)) return { vista: 'panel', id: null };
  return { vista: r, id: partes[1] ?? null };
}

async function arrancar() {
  /* En demostración se entra directo: pedir una contraseña que no existe
     solo sería un obstáculo para quien abre esto en el teléfono. */
  /* ⛔ Escribir en sessionStorage NO basta: `hayTokens()` lee la variable
     del módulo, que solo se rellena al cargarlo. Hay que pasar por
     `guardarTokens`, que actualiza las dos cosas. Con la primera versión
     la demostración se quedaba en la pantalla de entrada pidiendo una
     contraseña que no existe. */
  if (demoActivo() && !hayTokens()) guardarTokens({ acceso: 'demo', refresco: null });
  if (!hayTokens()) return pintarEntrar(RAIZ, entrarYa);
  RAIZ.innerHTML = cargando(3);
  try {
    sesion = await api.obtener('/api/v1/sesion/yo');
    pintarMarco();
  } catch (e) {
    if (e.estado === 401) { borrarTokens(); return pintarEntrar(RAIZ, entrarYa); }
    /* ⛔ `error()` solo toma dos argumentos: el tercero se descartaba y el
       botón «Reintentar» del arranque se pintaba muerto. Si la sesión
       falla al abrir, ese botón es la ÚNICA salida que tiene la persona. */
    RAIZ.innerHTML = error(e.message, e.peticionId);
    engancharReintentar(RAIZ, arrancar);
  }
}

async function entrarYa() {
  sesion = await api.obtener('/api/v1/sesion/yo');
  location.hash = '#/panel';
  pintarMarco();
}

/* ⛔ 20 sep 2026 · LA BARRA DE ABAJO NO CRECE INDEFINIDAMENTE.
   Con nueve secciones, en un telefono de 375 px caben cinco y las otras
   cuatro quedaban fuera de la pantalla sin ninguna senal. «Consejeria» y
   «Talento» simplemente no existian para quien entrara desde el movil.
   Y van a ser mas de veinte.
   La barra lleva CUATRO fijas -- las que se usan de pie, un domingo, con
   una mano -- y un boton «Mas» que abre la lista completa. En escritorio
   la columna las muestra todas y el boton sobra. */
const FIJAS_EN_MOVIL = 4;

function pintarMarco() {
  const disponibles = Object.entries(VISTAS).filter(([, v]) => alcanza(v.modulo));
  const actual = rutaActual().vista;
  const enMovil = () => !window.matchMedia('(min-width: 860px)').matches;
  const indiceActual = disponibles.findIndex(([k]) => k === actual);
  /* Si la seccion abierta esta fuera de las cuatro fijas, entra en la
     barra: quien esta DENTRO de Consejeria tiene que verse ahi. */
  const enBarra = disponibles.slice(0, FIJAS_EN_MOVIL);
  if (indiceActual >= FIJAS_EN_MOVIL) enBarra[FIJAS_EN_MOVIL - 1] = disponibles[indiceActual];

  const boton = ([k, v], clase = 'nav__item') => `
    <button class="${clase}" data-ruta="${k}" ${k === actual ? 'aria-current="page"' : ''}>
      <span class="nav__icono" aria-hidden="true">${v.icono}</span>
      <span>${esc(v.titulo)}</span>
    </button>`;

  RAIZ.innerHTML = `
    <a class="salto-al-contenido" href="#contenido" id="salto">Ir al contenido</a>
    <div class="marco">
      <nav class="nav" aria-label="Secciones">
        <span class="nav__todas">${disponibles.map(v => boton(v)).join('')}</span>
        <span class="nav__pocas">${enBarra.map(v => boton(v)).join('')}
          ${disponibles.length > FIJAS_EN_MOVIL ? `
          <button class="nav__item" id="b-mas" aria-haspopup="dialog" aria-expanded="false">
            <span class="nav__icono" aria-hidden="true">⋯</span><span>Más</span>
          </button>` : ''}</span>
      </nav>
      <div class="hoja" id="hoja" hidden>
        <div class="hoja__fondo" data-cerrar-hoja></div>
        <div class="hoja__panel" role="dialog" aria-modal="true" aria-label="Todas las secciones">
          <div class="hoja__cabecera">
            <strong>Secciones</strong>
            <button class="boton boton--suave" data-cerrar-hoja>Cerrar</button>
          </div>
          <div class="hoja__lista">${disponibles.map(v => boton(v, 'hoja__item')).join('')}</div>
        </div>
      </div>
      <div class="columna">
        ${demoActivo() ? `
        <div class="banda-demo" role="alert">
          ⛔ MODO DEMOSTRACIÓN · todos los nombres y las cifras de esta pantalla son
          <strong>inventados</strong>. Nada se guarda y nada viene del sistema real.
        </div>` : ''}
        <header class="cabecera">
          <span class="cabecera__marca">Casa Sobre la Roca</span>
          <span class="cabecera__sede">${esc(sesion?.alcance?.todaLaRed ? 'toda la red'
            : (sesion?.alcance?.sedes?.length ?? 0) + ' sede(s)')}</span>
          <div class="cabecera__derecha">
            <span id="cr-pendientes"></span>
            <span class="distintivo">N${esc(String(sesion?.alcance?.nivelMax ?? 0))}</span>
            <button class="boton boton--suave" id="b-salir">Salir</button>
          </div>
        </header>
        <div id="banda-conexion"></div>
        <main class="contenido" id="contenido" tabindex="-1">
          <div id="avisos" aria-live="polite"></div>
          <div id="vista"></div>
        </main>
        <footer class="pie">
          CasaRoca System · versión <code>${esc(window.CASAROCA_VERSION ?? 'dev')}</code>
          · <code>${esc(api.base)}</code>
          ${sesion?.alcance?.todaLaRed ? `
            · <a href="master/" style="color:var(--cr-azul-700)">Sistema Master</a>` : ''}
        </footer>
      </div>
    </div>`;

  RAIZ.querySelectorAll('[data-ruta]').forEach(b =>
    b.addEventListener('click', () => { cerrarHoja(); location.hash = '#/' + b.dataset.ruta; }));
  RAIZ.querySelector('#b-mas')?.addEventListener('click', abrirHoja);
  RAIZ.querySelectorAll('[data-cerrar-hoja]').forEach(b => b.addEventListener('click', cerrarHoja));
  RAIZ.querySelector('#b-salir').addEventListener('click', salir);

  /* ⛔ El enlace de salto ponia location.hash='#contenido', el enrutador no
     reconocia esa ruta y caia al Panel: la unica ayuda de teclado de la
     aplicacion deshacia la navegacion del usuario. */
  RAIZ.querySelector('#salto')?.addEventListener('click', ev => {
    ev.preventDefault();
    document.getElementById('contenido')?.focus({ preventScroll: false });
  });

  pintarPendientes();
  pintarVista();
}

function abrirHoja() {
  const h = document.getElementById('hoja');
  if (!h) return;
  h.hidden = false;
  document.getElementById('b-mas')?.setAttribute('aria-expanded', 'true');
  /* El foco entra en la hoja: si se queda detras, quien usa teclado abre
     un panel y sigue navegando por lo que hay debajo sin verlo. */
  h.querySelector('.hoja__item')?.focus();
}
function cerrarHoja() {
  const h = document.getElementById('hoja');
  if (!h || h.hidden) return;
  h.hidden = true;
  const b = document.getElementById('b-mas');
  b?.setAttribute('aria-expanded', 'false');
  b?.focus();
}
document.addEventListener('keydown', ev => { if (ev.key === 'Escape') cerrarHoja(); });

/* ⛔ El contador solo existia dentro de Ninos y la banda solo aparecia al
   perder la conexion: alguien podia cerrar la tableta con ninos sin enviar
   y nadie se enteraba nunca. */
function pintarPendientes() {
  const z = document.getElementById('cr-pendientes');
  if (!z) return;
  const n = cola.pendientes(), r = cola.rechazados().length;
  z.innerHTML = !n && !r ? '' :
    `<span class="distintivo ${r ? 'distintivo--n4' : 'distintivo--aviso'}">
       ${n ? n + ' sin enviar' : ''}${n && r ? ' · ' : ''}${r ? r + ' rechazado(s)' : ''}
     </span>`;
}
window.addEventListener('cr:cola-cambio', pintarPendientes);

async function pintarVista() {
  const { vista: r, id } = rutaActual();
  const zona = document.getElementById('vista');
  if (!zona) return pintarMarco();
  /* ⛔ `toggleAttribute` dejaba `aria-current=""`, que segun la
     especificacion equivale a FALSE, y el CSS busca [aria-current="page"]:
     ni el lector de pantalla ni el ojo sabian en que seccion estaban. */
  document.querySelectorAll('[data-ruta]').forEach(b => {
    if (b.dataset.ruta === r) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  document.title = `${VISTAS[r].titulo} · CasaRoca`;
  try {
    if (id && VISTAS[r].ficha) await VISTAS[r].ficha(zona, id, sesion);
    else await VISTAS[r].pintar(zona, sesion);
  }
  catch (e) {
    zona.innerHTML = error(e.message, e.peticionId);
    engancharReintentar(zona, () => pintarVista());
  }
  /* Quien navega con teclado se quedaba en BODY y tenia que recorrer todo
     otra vez desde arriba en cada cambio de vista. */
  document.getElementById('contenido')?.focus({ preventScroll: true });
}

async function salir() {
  const n = cola.pendientes();
  if (n && !confirm(
      `Hay ${n} registro(s) guardados en este equipo que todavía no se enviaron.\n\n` +
      `Si sale ahora, nadie más podrá enviarlos con su identidad hasta que usted vuelva a entrar.\n\n` +
      `¿Salir de todas formas?`)) return;
  try { await api.enviar('/api/v1/auth/salir', {}); } catch { /* la sesión igual se cierra aquí */ }
  borrarTokens(); sesion = null; location.hash = '';
  pintarEntrar(RAIZ, entrarYa);
}

window.addEventListener('hashchange', () => { if (sesion) pintarVista(); });
/* ⛔ Tres peticiones fallando a la vez disparaban el evento tres veces y
   `pintarEntrar` reconstruia el formulario tres veces, borrando lo escrito.
   Y el aviso no se veia NUNCA: `avisar` lo metia en #avisos y la linea
   siguiente destruia ese nodo al repintar. Ahora se dispara una sola vez y
   el mensaje viaja DENTRO del formulario nuevo. */
let sesionYaCaida = false;
window.addEventListener('cr:sesion-caida', () => {
  if (sesionYaCaida) return;
  sesionYaCaida = true;
  sesion = null;
  pintarEntrar(RAIZ, () => { sesionYaCaida = false; return entrarYa(); },
    'Su sesión se cerró. Vuelva a entrar.');
});
window.addEventListener('online',  () => bandaConexion(true));
window.addEventListener('offline', () => bandaConexion(false));

function bandaConexion(enLinea) {
  const z = document.getElementById('banda-conexion');
  if (!z) return;
  z.innerHTML = enLinea ? '' :
    `<div class="sin-conexion" role="status">Sin conexión · <strong>puede seguir trabajando</strong>,
      lo que registre se envía al volver la red${cola.pendientes() ? ` (${cola.pendientes()} en espera)` : ''}.</div>`;
}

arrancar();
