import { api, hayTokens, guardarTokens, borrarTokens } from '../src/api.js';
import { demoActivo } from '../src/demo.js';

/**
 * CASA ROCA · SISTEMA MASTER
 *
 * ⛔ Esto NO es la aplicación de los pastores, y por eso no se le parece.
 * Es el comando central: desde aquí el equipo de la central despliega
 * iglesias, registra personas, crea accesos, otorga roles, arma los
 * equipos corporativos (Contabilidad, Tesorería) y enciende o apaga
 * módulos en cada sede. Un pastor administra su sede; aquí se administra
 * la red.
 *
 * El visual es el del prototipo que la iglesia eligió: columna de pestañas
 * a la izquierda agrupada por materia, densidad de Linear sobre blanco,
 * cero sombras, cifras tabulares y un solo acento (el azul de la marca).
 * No se reinventó: se conservó, porque la uniformidad es parte de lo que
 * convenció.
 */

const RAIZ = document.getElementById('app');
let sesion = null;
let vista = 'arranque';

/* Las secciones, en el orden en que un administrador las necesita.
   ⛔ «Puesta en marcha» va primero a propósito: el sistema se llena en un
   orden y saltarse un paso deja huérfano al que sigue. */
const NAV = [
  { grupo: 'Dirección' },
  { id: 'arranque',   icono: '🧭', titulo: 'Puesta en marcha' },
  { id: 'red',        icono: '🌐', titulo: 'Tablero de la red' },

  { grupo: 'Identidad y accesos' },
  { id: 'cuentas',    icono: '🔑', titulo: 'Personas con acceso', nivel: 'N4' },
  { id: 'crear',      icono: '➕', titulo: 'Crear acceso',        nivel: 'N4' },
  { id: 'permisos',   icono: '🔎', titulo: 'Qué puede cada quien', nivel: 'N3' },
  { id: 'roles',      icono: '🎭', titulo: 'Roles y techos',      nivel: 'N2' },
  { id: 'recert',     icono: '📜', titulo: 'Recertificación',     nivel: 'N4' },

  { grupo: 'Organización' },
  { id: 'iglesias',   icono: '⛪', titulo: 'Iglesias y sedes',    nivel: 'N2' },
  { id: 'plantillas', icono: '🧩', titulo: 'Plantillas de iglesia' },
  { id: 'modulos',    icono: '🎚️', titulo: 'Qué ve cada iglesia', nivel: 'N3' },
  { id: 'equipos',    icono: '🏛️', titulo: 'Equipos corporativos', nivel: 'N4' },
  { id: 'organigrama',icono: '🗂️', titulo: 'Organigrama' },

  { grupo: 'Gobierno' },
  { id: 'vigilancia', icono: '🛡️', titulo: 'Sesiones y alertas',  nivel: 'N4' },
  { id: 'bitacora',   icono: '📖', titulo: 'Quién hizo y quién miró', nivel: 'N4' },
];

/**
 * Dónde vive la aplicación de los pastores.
 *
 * ⛔ 20 de septiembre de 2026, por la tarde. Los dos botones que prometen
 * abrirla hacían `window.open('../index.html#/panel')`. En el repositorio
 * eso es correcto: la consola vive en `master/` y la aplicación al lado.
 * Pero en la copia publicada son DOS PÁGINAS DISTINTAS, cada una en su
 * dirección, y `../index.html` resolvía a la propia consola. Encima, una
 * ventana emergente abierta desde código la bloquea el navegador sin
 * decir nada. Daniel pulsaba el botón y «no me dirige a nada»: las dos
 * cosas a la vez.
 *
 * Ahora es un ENLACE de verdad (no una ventana emergente, que se bloquea)
 * y el destino se puede fijar desde fuera, que es lo que hace la copia
 * publicada en su `index.html`.
 */
const APP_PASTORES = (typeof window !== 'undefined' && window.CASAROCA_APP_PASTORES)
  || '../index.html';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
  c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const niv = (n) => `<span class="ms-niv ms-niv--${Number(n) || 0}">N${Number(n) || 0}</span>`;
const num = (n) => `<span class="num">${esc(n ?? 0)}</span>`;


/* ── Catálogos ──────────────────────────────────────────────────────
   ⛔ Un campo que pide un IDENTIFICADOR a mano no es una interacción:
      nadie se sabe un uuid. Todo lo que antes se escribía ahora se
      ELIGE de una lista que sale de la base. */
let CAT = null, SEDES = null;
async function catalogo() {
  if (!CAT) CAT = await api.obtener('/api/v1/administracion/catalogo');
  return CAT;
}
async function sedesDe() {
  if (!SEDES) {
    const s = await api.obtener('/api/v1/organizacion/sedes').catch(() => []);
    SEDES = Array.isArray(s) ? s : (s?.sedes ?? []);
  }
  return SEDES;
}
const opcSedes = (l) => l.map(s => ({ valor: s.id, texto: `${s.codigo} · ${s.nombre}` }));
async function opcPersonas() {
  const r = await api.obtener('/api/v1/personas?limite=400').catch(() => []);
  const l = Array.isArray(r) ? r : (r?.personas ?? r?.resultados ?? []);
  return l.map(p => ({
    valor: p.id,
    /* ⛔ Se leía `p.sede` y la API devuelve `sede_codigo`: la iglesia no
       salía NUNCA junto al nombre, y con dos personas que se llaman igual
       no había forma de distinguirlas. Mismo fallo que `actaReferencia`
       contra `acta`: 200, campo distinto, dato perdido sin avisar. */
    texto: `${p.nombre_completo ?? p.nombre ?? p.persona ?? p.id}`
         + `${p.sede_codigo ?? p.sede ? ' · ' + (p.sede_codigo ?? p.sede) : ''}`,
  }));
}

/* Casilla de acceso. Es el gesto de toda la consola: una cosa se enciende
   o se apaga, y la base decide si se deja. */
function casilla({ id, titulo, sub, marcado, bloqueado, motivo, datos = {} }) {
  const at = Object.entries(datos).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ');
  return `<label class="ms-opt${marcado ? ' is-on' : ''}${bloqueado ? ' is-off' : ''}" ${at}>
    <input type="checkbox" ${marcado ? 'checked' : ''} ${bloqueado ? 'disabled' : ''}>
    <div><b>${esc(titulo)}</b><small>${esc(bloqueado && motivo ? motivo : (sub ?? ''))}</small></div>
  </label>`;
}

/* Deja la casilla como estaba cuando la base dice que no. Sin esto, la
   pantalla miente: se ve encendido lo que el servidor rechazó. */
function revertir(inp, e) {
  inp.checked = !inp.checked;
  inp.closest('.ms-opt')?.classList.toggle('is-on', inp.checked);
  avisar(e.message, 'roja');
}
function pintarEstado(inp) {
  inp.closest('.ms-opt')?.classList.toggle('is-on', inp.checked);
}

/* Ficha lateral: lo que se abre al pulsar una persona o una iglesia. */
function fichaAbrir(titulo, sub, cuerpo) {
  document.getElementById('ms-ficha')?.remove();
  const d = document.createElement('div');
  d.id = 'ms-ficha';
  d.className = 'ms-ficha';
  d.innerHTML = `<div class="ms-ficha__caja" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
      <div class="ms-ficha__cab">
        <div><b>${esc(titulo)}</b><span class="ms-doc">${esc(sub ?? '')}</span></div>
        <button class="ms-btn ms-btn--peq" id="ms-ficha-x" aria-label="Cerrar">Cerrar</button>
      </div>
      <div class="ms-ficha__cuerpo">${cuerpo}</div>
    </div>`;
  document.body.appendChild(d);
  /* ⛔ El escuchador de Escape se colgaba de `document` y SOLO se quitaba
     a sí mismo al pulsar Escape: cerrar con el botón o con el fondo lo
     dejaba vivo apuntando a un nodo ya borrado, y se acumulaba uno por
     cada ficha abierta. Ahora `cerrar()` limpia siempre. */
  const porEscape = (ev) => { if (ev.key === 'Escape') cerrar(); };
  const cerrar = () => { document.removeEventListener('keydown', porEscape); d.remove(); };
  d.querySelector('#ms-ficha-x').addEventListener('click', cerrar);
  d.addEventListener('click', ev => { if (ev.target === d) cerrar(); });
  document.addEventListener('keydown', porEscape);
  d.querySelector('#ms-ficha-x').focus();
  return d;
}

/* ── Arranque ─────────────────────────────────────────────────────── */
async function arrancar() {
  if (demoActivo() && !hayTokens()) guardarTokens({ acceso: 'demo', refresco: null });
  if (!hayTokens()) return entrada();
  try {
    sesion = await api.obtener('/api/v1/sesion/yo');
    if (!(sesion?.alcance?.todaLaRed) && Number(sesion?.alcance?.nivelMax ?? 0) < 4) {
      /* ⛔ No es un adorno: quien no alcanza la red no tiene nada que
         hacer aquí, y decírselo claro es mejor que enseñarle pestañas
         que después le van a responder «no tiene permiso» una por una. */
      return sinPaso();
    }
    marco();
  } catch (e) {
    if (e.estado === 401) { borrarTokens(); return entrada(); }
    RAIZ.innerHTML = `<div class="ms-main"><div class="ms-alerta ms-alerta--roja">
      No se pudo abrir la consola: ${esc(e.message)}</div></div>`;
  }
}

function entrada(mensaje = '') {
  RAIZ.innerHTML = `
    <div style="min-height:100dvh;display:grid;place-items:center;padding:24px;background:var(--pa)">
      <div style="width:100%;max-width:380px">
        <div style="text-align:center;margin-bottom:24px">
          <div class="ms-logo" style="width:44px;height:44px;font-size:16px;margin:0 auto 12px">CR</div>
          <b style="font-size:18px;display:block">Sistema Master</b>
          <small style="color:var(--tin-dim)">El comando central de la red</small>
        </div>
        <div style="background:var(--sup);border:1px solid var(--fil);border-radius:var(--r-lg);padding:24px">
          ${mensaje ? `<div class="ms-alerta ms-alerta--roja">${esc(mensaje)}</div>` : ''}
          <form id="f-entrar">
            <label class="ms-campo"><span>Usuario</span>
              <input name="usuario" type="email" autocomplete="username" required></label>
            <label class="ms-campo"><span>Contraseña</span>
              <input name="clave" type="password" autocomplete="current-password" required></label>
            <div id="zona-codigo"></div>
            <button class="ms-btn ms-btn--primario" style="width:100%" type="submit">Entrar</button>
          </form>
        </div>
        <p style="text-align:center;color:var(--tin-dim);font-size:11px;margin-top:16px">
          Esta consola administra los accesos de toda la red.
        </p>
      </div>
    </div>`;

  let usuario = '', clave = '', paso = 'clave', secreto = '';
  RAIZ.querySelector('#f-entrar').addEventListener('submit', async ev => {
    ev.preventDefault();
    const f = ev.target, b = f.querySelector('button');
    b.disabled = true; b.textContent = 'Un momento…';
    try {
      if (paso === 'clave') {
        usuario = f.usuario.value.trim(); clave = f.clave.value;
        const r = await api.enviar('/api/v1/auth/entrar', { usuario, clave });
        if (r.debeConfigurarSegundoFactor) {
          guardarTokens({ acceso: r.acceso, refresco: null });
          const ini = await api.enviar('/api/v1/auth/segundo-factor/iniciar', {});
          secreto = ini.secreto; paso = 'configurar';
          f.querySelector('#zona-codigo').innerHTML = `
            <div class="ms-nota" style="margin-bottom:12px">
              Su rol alcanza datos sensibles. Agregue esta clave a su aplicación de
              autenticación y escriba el código:
              <div class="mono" style="margin-top:6px;word-break:break-all">${esc(secreto)}</div>
            </div>
            <label class="ms-campo"><span>Código</span>
              <input name="codigo" inputmode="numeric" maxlength="6" required></label>`;
          return;
        }
        guardarTokens(r); return entrar();
      }
      if (paso === 'configurar') {
        await api.enviar('/api/v1/auth/segundo-factor/activar', { codigo: f.codigo.value });
      }
      const r = await api.enviar('/api/v1/auth/entrar', { usuario, clave, codigo: f.codigo?.value });
      guardarTokens(r); return entrar();
    } catch (e) {
      if (e.datos?.faltaSegundoFactor) {
        paso = 'codigo';
        f.querySelector('#zona-codigo').innerHTML = `
          <label class="ms-campo"><span>Código del segundo factor</span>
            <input name="codigo" inputmode="numeric" maxlength="6" required></label>`;
      } else entrada(e.message);
    } finally { b.disabled = false; b.textContent = 'Entrar'; }
  });
  RAIZ.querySelector('input')?.focus();
}

async function entrar() { sesion = await api.obtener('/api/v1/sesion/yo'); marco(); }

function sinPaso() {
  RAIZ.innerHTML = `
    <div class="ms-main ms-ancho--lectura">
      <div class="ms-head"><h1>Esta consola no es para su rol</h1>
        <p>El Sistema Master administra los accesos, las iglesias y los permisos de
           toda la red, y exige alcance de organización. Su trabajo diario está en la
           aplicación de la sede.</p></div>
      <p><a class="ms-btn ms-btn--primario" href="../index.html">Ir a la aplicación</a>
         <button class="ms-btn" id="b-salir2">Salir</button></p>
    </div>`;
  RAIZ.querySelector('#b-salir2').addEventListener('click', salir);
}

/* ── Marco ────────────────────────────────────────────────────────── */
function marco() {
  const yo = sesion?.persona?.nombre ?? 'Usuario maestro';
  const iniciales = yo.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  RAIZ.innerHTML = `
    ${demoActivo() ? `<div style="background:#7A1F12;color:#FFF6F2;padding:6px 24px;font-size:11px;text-align:center">
      ⛔ MODO DEMOSTRACIÓN · todos los nombres y las cifras son <b>inventados</b>. Nada se guarda.</div>` : ''}
    <header class="ms-top">
      <div class="ms-marca">
        <div class="ms-logo">CR</div>
        <div><b>Casa Roca · Sistema Master</b>
          <small id="ms-sub">Comando central de la red</small></div>
      </div>
      <div class="ms-sp"></div>
      <div class="ms-yo"><div><b>${esc(yo)}</b>
        <small>${esc(sesion?.alcance?.todaLaRed ? 'toda la red' : 'alcance limitado')}
          · techo N${esc(String(sesion?.alcance?.nivelMax ?? 0))}</small></div>
        <div class="ms-av">${esc(iniciales)}</div></div>
      <button class="ms-btn" id="b-salir" style="margin-left:12px">Salir</button>
    </header>
    <div class="ms-shell">
      <nav class="ms-nav" aria-label="Secciones del Sistema Master">
        ${NAV.map(n => n.grupo
          ? `<div class="ms-navsep">${esc(n.grupo)}</div>`
          : `<button class="ms-navit ${n.id === vista ? 'is-on' : ''}" data-vista="${n.id}"
                     ${n.id === vista ? 'aria-current="page"' : ''}>
               <span class="ms-navic" aria-hidden="true">${n.icono}</span><span>${esc(n.titulo)}</span>
               ${n.nivel ? `<em class="ms-navniv">${esc(n.nivel)}</em>` : ''}
             </button>`).join('')}
      </nav>
      <main class="ms-main" id="ms-main" tabindex="-1"></main>
    </div>`;
  RAIZ.querySelectorAll('[data-vista]').forEach(b =>
    b.addEventListener('click', () => { location.hash = '#/' + b.dataset.vista; }));
  RAIZ.querySelector('#b-salir').addEventListener('click', salir);
  pintar();
  subtitulo();
}

/** El subtítulo dice el estado real de la red, no un eslogan. */
async function subtitulo() {
  try {
    const s = await api.obtener('/api/v1/organizacion/sedes');
    const lista = Array.isArray(s) ? s : (s?.sedes ?? []);
    const z = document.getElementById('ms-sub');
    if (z) z.textContent = `Comando central · ${lista.length} iglesia(s) en la red`;
  } catch { /* el marco vale igual sin esto */ }
}

async function salir() {
  try { await api.enviar('/api/v1/auth/salir', {}); } catch { /* igual se cierra aquí */ }
  borrarTokens(); sesion = null; location.hash = ''; entrada();
}

window.addEventListener('hashchange', () => { if (sesion) { vista = ruta(); marco(); } });
const tramos = () => location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
const ruta = () => {
  const r = tramos()[0];
  /* ⛔ 20 sep 2026. Aquí había dos trampas juntas. Sin dirección en la
     barra (que es como se abre la consola publicada), `tramos()[0]` es
     `undefined`; y NAV lleva separadores de grupo `{ grupo: '...' }` SIN
     `id`, así que `n.id === undefined` daba CIERTO y `ruta()` devolvía
     `undefined`. La consola arrancaba con «VISTAS[vista] is not a
     function» y no se veía nada. Se exige que la pestaña exista de
     verdad: `n.id && n.id === r`. */
  return r && NAV.some(n => n.id && n.id === r) ? r : 'arranque';
};
/* El segundo tramo de la dirección: `#/roles/TESORERIA` → 'TESORERIA'.
   ⛔ Antes cada vista hacía `location.hash.split('/')[1]`, que sobre
      `#/roles/TESORERIA` devuelve 'roles', no 'TESORERIA': la almohadilla
      cuenta como primer trozo. Resultado: abrir el enlace de un rol o de
      una iglesia concreta siempre caía en la primera de la lista, y
      parecía que el enlace no llevaba a ningún sitio. */
const subruta = () => tramos()[1] ?? null;

/* ── Pintado ──────────────────────────────────────────────────────── */
const cargando = `<div class="ms-main" style="padding:0"><p style="color:var(--tin-dim)">Cargando…</p></div>`;

async function pintar() {
  vista = ruta();
  const viejo = document.getElementById('ms-main');
  if (!viejo) return;
  /* ⛔ Se cambia el NODO, no solo su contenido. `innerHTML = ...` borra
     lo de adentro pero deja vivos los escuchadores colgados del propio
     contenedor: al ir y volver de una pestaña se acumulaban, y un solo
     clic terminaba abriendo el mismo diálogo tres o cuatro veces.
     Un nodo nuevo no arrastra nada del anterior. */
  const m = viejo.cloneNode(false);
  viejo.replaceWith(m);
  document.getElementById('ms-ficha')?.remove();
  m.innerHTML = cargando;
  /* ⛔ Una fila que se pulsa con el dedo tiene que abrirse también con el
     teclado, o queda fuera de alcance para quien no usa ratón. */

  document.title = `${NAV.find(n => n.id === vista)?.titulo ?? 'Sistema Master'} · Casa Roca`;
  try {
    await VISTAS[vista](m);
  } catch (e) {
    m.innerHTML = `<div class="ms-alerta ms-alerta--roja">
      <b>No se pudo cargar.</b> ${esc(e.message)}
      ${e.peticionId ? `<div class="mono" style="margin-top:4px">petición ${esc(e.peticionId)}</div>` : ''}
    </div>`;
  }
  m.focus({ preventScroll: true });
}

function cabecera(titulo, texto) {
  return `<div class="ms-head"><h1>${esc(titulo)}</h1><p>${esc(texto)}</p></div>`;
}
function alerta(texto, clase = 'ambar') {
  return texto ? `<div class="ms-alerta ms-alerta--${clase}">${esc(texto)}</div>` : '';
}
/**
 * Tabla de la consola.
 *
 * ⛔ 20 de septiembre de 2026, por la tarde. Daniel pulsó una iglesia en
 * el teléfono y «no me abrió nada». No era un fallo del código: el botón
 * «Abrir ficha» vivía en la ÚLTIMA columna, y en una pantalla de 375
 * píxeles esa columna empieza en el 360 y termina en el 405. El botón
 * existía, respondía y estaba FUERA DE LA PANTALLA. Lo único visible era
 * el nombre de la iglesia, que no hacía nada.
 *
 * Una acción escondida detrás de un desplazamiento lateral no existe.
 * Desde aquí, cuando una tabla lleva a algún sitio:
 *   · la FILA ENTERA abre, con el dedo o con Intro,
 *   · y la PRIMERA celda es un enlace de verdad, que siempre se ve y al
 *     que se llega con el tabulador.
 * Nunca más una acción sola en la última columna.
 *
 * `abre` = { attr: 'sede', id: f => f.id, que: f => f.nombre }
 */
function tablaMs(filas, cols, vacio = 'Nada todavía.', abre = null) {
  if (!filas?.length) return `<p class="ms-vacio">${esc(vacio)}</p>`;
  const fila = (f) => {
    /* ⛔ Nada de `role="button"` sobre un `<tr>`: sustituye el rol nativo
       `row` y un lector de pantalla deja de anunciar la tabla como tabla,
       perdiendo fila, columna y encabezados. El foco y la acción viven en
       el enlace de la primera celda, que ya existe y ya se alcanza con el
       tabulador; la fila es solo un blanco más grande para el dedo. */
    const at = abre ? ` class="ms-fila-abre" data-${abre.attr}="${esc(abre.id(f))}"` : '';
    return `<tr${at}>${cols.map(c => `<td>${c.p ? c.p(f) : esc(f[c.k] ?? '—')}</td>`).join('')}</tr>`;
  };
  return `<div class="ms-scroll"><table class="ms-tabla">
    <thead><tr>${cols.map(c => `<th>${esc(c.t)}</th>`).join('')}</tr></thead>
    <tbody>${filas.map(fila).join('')}</tbody>
  </table></div>`;
}

/* Diálogo de una pregunta, en el marco de la consola. */
function pedir(campos, titulo) {
  return new Promise(resolve => {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;z-index:120;display:grid;place-items:center;background:rgba(20,20,24,.45)';
    d.innerHTML = `<div style="background:var(--sup);border:1px solid var(--fil);border-radius:var(--r-lg);
        padding:24px;width:min(520px,92vw);max-height:88dvh;overflow:auto;box-shadow:var(--som-flota)">
      <h3 style="margin:0 0 16px;font-size:15px">${esc(titulo)}</h3>
      <form id="f-modal">
        ${campos.map(c => `
          <label class="ms-campo"><span>${esc(c.etiqueta)}${c.obligatorio ? ' <i class="ms-req">obligatorio</i>' : ''}</span>
            ${c.opciones
              ? `${c.opciones.length > 8 ? `<input class="ms-filtro" data-filtra="${esc(c.nombre)}"
                     placeholder="Escriba para filtrar entre ${c.opciones.length}">` : ''}
                 <select name="${esc(c.nombre)}" ${c.obligatorio ? 'required' : ''}
                         ${c.opciones.length > 8 ? 'size="7"' : ''}>
                   ${c.vacio ? `<option value="">${esc(c.vacio)}</option>` : ''}
                   ${c.opciones.map(o => `<option value="${esc(o.valor)}"
                        ${o.valor === c.valor ? 'selected' : ''}>${esc(o.texto)}</option>`).join('')}
                 </select>`
              : `<input name="${esc(c.nombre)}" type="${esc(c.tipo ?? 'text')}"
                        ${c.obligatorio ? 'required' : ''} ${c.valor ? `value="${esc(c.valor)}"` : ''}
                        ${c.ayuda ? `placeholder="${esc(c.ayuda)}"` : ''}>`}
          </label>`).join('')}
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
          <button type="button" class="ms-btn" id="b-cancelar">Cancelar</button>
          <button type="submit" class="ms-btn ms-btn--primario">Confirmar</button>
        </div>
      </form></div>`;
    document.body.appendChild(d);
    /* Filtrar una lista larga: teclear acorta lo que se ve. Sin esto,
       elegir entre 400 personas es imposible. */
    d.querySelectorAll('[data-filtra]').forEach(inp => {
      const sel = d.querySelector(`select[name="${inp.dataset.filtra}"]`);
      const todas = [...sel.options].map(o => ({ v: o.value, t: o.textContent }));
      inp.addEventListener('input', () => {
        const q = inp.value.trim().toLowerCase();
        sel.innerHTML = todas.filter(o => !q || o.t.toLowerCase().includes(q))
          .map(o => `<option value="${esc(o.v)}">${esc(o.t)}</option>`).join('')
          || '<option value="">Nadie coincide</option>';
      });
    });
    d.querySelector('input,select')?.focus();
    d.querySelector('#b-cancelar').addEventListener('click', () => { d.remove(); resolve(null); });
    d.querySelector('#f-modal').addEventListener('submit', ev => {
      ev.preventDefault();
      const out = {};
      for (const c of campos) {
        const v = ev.target.elements[c.nombre]?.value?.trim();
        if (v) out[c.nombre] = c.numero ? Number(v) : v;
      }
      d.remove(); resolve(out);
    });
  });
}

function avisar(texto, clase = 'verde') {
  /* Con una ficha abierta, el aviso tiene que salir donde está la vista
     del administrador: si va al fondo, no se entera de nada. */
  const m = document.querySelector('#ms-ficha .ms-ficha__cuerpo') ?? document.getElementById('ms-main');
  if (!m) return;
  const d = document.createElement('div');
  d.className = `ms-alerta ms-alerta--${clase}`;
  d.setAttribute('role', clase === 'roja' ? 'alert' : 'status');
  d.textContent = texto;
  m.prepend(d);
  setTimeout(() => d.remove(), 9000);
}

/* ══════════════════════════════════════════════════════════════════════
   LAS VISTAS
   ══════════════════════════════════════════════════════════════════════ */
const VISTAS = {

  /* ── Puesta en marcha ──────────────────────────────────────────────
     ⛔ El sistema se llena EN UN ORDEN. Cada paso habilita el siguiente;
     saltarse uno deja huérfano al que sigue: una iglesia sin pastor no
     se opera sola, y un equipo sin rol existe pero no puede hacer nada. */
  async arranque(m) {
    const [sed, uni, cue, pla] = await Promise.all([
      api.obtener('/api/v1/organizacion/sedes').catch(() => []),
      api.obtener('/api/v1/administracion/unidades').catch(() => ({ unidades: [] })),
      api.obtener('/api/v1/administracion/cuentas?limite=500').catch(() => ({ cuentas: [] })),
      api.obtener('/api/v1/administracion/plantillas').catch(() => ({ plantillas: [] })),
    ]);
    const sedes = Array.isArray(sed) ? sed : (sed?.sedes ?? []);
    const equipos = (uni.unidades ?? []).filter(u => u.clase === 'equipo');
    const equiposConRol = equipos.filter(u => Number(u.roles) > 0);
    const cuentas = cue.cuentas ?? [];

    const pasos = [
      { n: 1, titulo: 'Dirección General',
        texto: 'De aquí sale todo lo demás: quien despliega iglesias y otorga accesos.',
        hecho: cuentas.some(c => (c.roles ?? '').includes('PASTOR_DIRECTOR_GENERAL')),
        cuenta: cuentas.filter(c => (c.roles ?? '').includes('PASTOR_DIRECTOR_GENERAL')).length,
        de: 'al menos 1', ir: 'cuentas', boton: 'Ver accesos' },
      { n: 2, titulo: 'Equipos corporativos',
        texto: 'Contabilidad, Tesorería y los demás equipos que dependen de la Dirección.',
        hecho: equiposConRol.length > 0,
        cuenta: equiposConRol.length, de: `${equipos.length} creados`,
        ir: 'equipos', boton: 'Crear equipo' },
      { n: 3, titulo: 'Iglesias con pastor',
        texto: 'Cada una nace con su pastor y con una plantilla que define qué ve.',
        hecho: sedes.length > 1, cuenta: sedes.length, de: 'la red prevé 36',
        ir: 'iglesias', boton: 'Desplegar iglesia' },
      { n: 4, titulo: 'Accesos por iglesia',
        texto: 'Directores, líderes, consejeros y tesorería de cada sede.',
        hecho: cuentas.length > 1, cuenta: cuentas.length, de: 'según cada iglesia',
        ir: 'crear', boton: 'Crear acceso' },
    ];
    const listos = pasos.filter(p => p.hecho).length;

    m.innerHTML = `
      <div class="ms-ancho--lectura">
      ${cabecera('Puesta en marcha',
        'El sistema se llena en un orden. Cada paso habilita el siguiente; saltarse uno deja huérfano al que sigue.')}
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
        <div style="flex:1;height:4px;background:var(--pa-alt);border-radius:2px;overflow:hidden">
          <div style="width:${(listos / pasos.length) * 100}%;height:100%;background:var(--ok)"></div>
        </div>
        <small style="color:var(--tin-dim);white-space:nowrap">${listos} de ${pasos.length} pasos completos</small>
      </div>
      <div class="ms-asistente">
        ${pasos.map(p => `
          <div class="ms-paso">
            <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start">
              <div style="flex:1;min-width:0">
                <h3><i style="${p.hecho ? 'background:var(--ok)' : 'background:var(--pa-alt);color:var(--tin-mid)'}">
                  ${p.hecho ? '✓' : p.n}</i>${esc(p.titulo)}</h3>
                <p style="margin:0;color:var(--tin-mid);font-size:13px">${esc(p.texto)}</p>
              </div>
              <div style="text-align:right;white-space:nowrap">
                <b class="num" style="font-size:22px;font-weight:500">${p.cuenta}</b>
                <small style="display:block;color:var(--tin-dim);font-size:11px">/ ${esc(p.de)}</small>
              </div>
            </div>
            <div style="margin-top:12px;text-align:right">
              <button class="ms-btn ${p.hecho ? '' : 'ms-btn--pri'}" data-ir="${p.ir}">${esc(p.boton)}</button>
            </div>
          </div>`).join('')}
      </div>
      ${pla.plantillas?.length ? `<p class="ms-nota" style="margin-top:24px">
        La red tiene ${pla.plantillas.length} plantilla(s) de iglesia. Los módulos con
        compuerta legal nacen apagados: se encienden cuando exista la evidencia jurídica.</p>` : ''}
      </div>`;
    m.querySelectorAll('[data-ir]').forEach(b =>
      b.addEventListener('click', () => { location.hash = '#/' + b.dataset.ir; }));
  },

  /* ── Tablero de la red ─────────────────────────────────────────── */
  async red(m) {
    const [sed, uni, cue, rec] = await Promise.all([
      api.obtener('/api/v1/organizacion/sedes').catch(() => []),
      api.obtener('/api/v1/administracion/unidades').catch(() => ({ unidades: [] })),
      api.obtener('/api/v1/administracion/cuentas?limite=500').catch(() => ({ cuentas: [] })),
      api.obtener('/api/v1/administracion/recertificar').catch(() => ({ accesos: [] })),
    ]);
    const sedes = Array.isArray(sed) ? sed : (sed?.sedes ?? []);
    const cuentas = cue.cuentas ?? [];
    const problemas = cuentas.filter(c => c.bloqueada || c.estado !== 'activa'
      || (c.exige_segundo_factor && !c.segundo_factor_activo));
    m.innerHTML = `
      ${cabecera('Tablero de la red', 'Lo que hay hoy, contado por el sistema, no por un informe.')}
      <div class="ms-kpis">
        <div class="ms-kpi"><b class="num">${sedes.length}</b><span>Iglesias</span></div>
        <div class="ms-kpi"><b class="num">${(uni.unidades ?? []).filter(u => u.clase === 'equipo').length}</b><span>Equipos</span></div>
        <div class="ms-kpi"><b class="num">${cuentas.length}</b><span>Personas con acceso</span></div>
        <div class="ms-kpi ${problemas.length ? 'ms-kpi--ojo' : ''}"><b class="num">${problemas.length}</b><span>Accesos con problema</span></div>
        <div class="ms-kpi ${(rec.accesos ?? []).length ? 'ms-kpi--ojo' : ''}"><b class="num">${(rec.accesos ?? []).length}</b><span>Por recertificar</span></div>
      </div>
      ${alerta(rec.aviso)}
      <h2 class="ms-h2">Iglesias</h2>
      ${tablaMs(sedes, [
        { t: 'Iglesia', p: s => `<button class="ms-enlace" data-modulos="${esc(s.id)}">
            <b>${esc(s.nombre)}</b><span class="ms-doc">${esc(s.codigo)}</span></button>` },
        { t: 'Ciudad', k: 'ciudad' },
        { t: 'Tipo', p: s => `<span class="ms-chip">${esc(s.tipo ?? '')}</span>` },
      ], 'Ninguna iglesia todavía.',
         { attr: 'modulos', id: s => s.id, que: s => 'lo que ve ' + s.nombre })}`;
    /* ⛔ Delegado sobre el contenedor: antes se colgaba de cada botón, y
       el botón vivía en la última columna, fuera de la pantalla en un
       teléfono. Ahora abre la fila entera y lleva a ESA sede, no a la
       primera de la lista. */
    m.addEventListener('click', ev => {
      const b = ev.target.closest('[data-modulos]');
      if (b) location.hash = '#/modulos/' + b.dataset.modulos;
    });
  },

  /* ── Personas con acceso ───────────────────────────────────────── */
  /* ── Personas con acceso ───────────────────────────────────────────
     La lista de quién puede entrar. Pulsar una persona abre su ficha
     completa: su cuenta, sus roles vigentes, sus equipos y lo que se le
     puede hacer. Antes los botones colgaban de la fila y no había a
     dónde entrar. */
  async cuentas(m) {
    const d = await api.obtener('/api/v1/administracion/cuentas?limite=300');
    m.innerHTML = `
      ${cabecera('Personas con acceso',
        'Quién puede entrar hoy, con qué roles y en qué estado está su cuenta. Pulse una persona para abrir su ficha.')}
      ${alerta(d.aviso)}
      <div class="ms-barra">
        <button class="ms-btn ms-btn--primario" id="b-nuevo">+ Crear acceso</button>
        <input class="ms-busca" id="q" placeholder="Buscar por nombre o usuario">
        <span class="ms-barra__sp"></span>
        <span style="color:var(--tin-dim);font-size:12px" id="cuantas">${d.cuentas.length} cuentas</span>
      </div>
      <div id="tabla">${tablaMs(d.cuentas, COLS_CUENTA, 'Ninguna cuenta a su alcance.',
        { attr: 'persona', id: x => x.persona_id, que: x => 'la ficha de ' + x.persona })}</div>`;
    m.querySelector('#b-nuevo').addEventListener('click', () => { location.hash = '#/crear'; });
    let t;
    m.querySelector('#q').addEventListener('input', ev => {
      clearTimeout(t);
      const q = ev.target.value.trim();
      t = setTimeout(async () => {
        const r = await api.obtener('/api/v1/administracion/cuentas?limite=300&q=' + encodeURIComponent(q));
        m.querySelector('#tabla').innerHTML = tablaMs(r.cuentas, COLS_CUENTA, 'Nadie coincide.',
          { attr: 'persona', id: x => x.persona_id, que: x => 'la ficha de ' + x.persona });
        m.querySelector('#cuantas').textContent = r.cuentas.length + ' cuentas';
      }, 300);
    });
    m.addEventListener('click', ev => {
      const b = ev.target.closest('[data-persona]');
      if (b) abrirPersona(b.dataset.persona);
    });
  },

  /* ── Crear acceso ──────────────────────────────────────────────── */
  async crear(m) {
    const [sedes, cat] = await Promise.all([sedesDe(), catalogo()]);
    m.innerHTML = `
      <div class="ms-ancho--forma">
      ${cabecera('Crear acceso',
        'Dos pasos: registrar a la persona, si no está, y crearle la cuenta. La contraseña provisional se muestra una sola vez.')}
      <div class="ms-paso">
        <h3><i>1</i>Registrar a la persona</h3>
        <form id="f-persona">
          <div class="ms-fila2">
            <label class="ms-campo"><span>Primer nombre <i class="ms-req">obligatorio</i></span>
              <input name="primerNombre" required></label>
            <label class="ms-campo"><span>Primer apellido <i class="ms-req">obligatorio</i></span>
              <input name="primerApellido" required></label>
          </div>
          <label class="ms-campo"><span>Iglesia <i class="ms-req">obligatorio</i></span>
            <select name="sedeId" required>
              ${sedes.map(s => `<option value="${esc(s.id)}">${esc(s.codigo)} · ${esc(s.nombre)}</option>`).join('')}
            </select></label>
          <div class="ms-fila2">
            <label class="ms-campo"><span>Tipo de documento</span>
              <select name="tipoDocumento">
                <option value="">— sin documento —</option>
                ${(cat.tiposDocumento ?? []).map(t =>
                  `<option value="${esc(t.codigo)}">${esc(t.codigo)} · ${esc(t.etiqueta)}</option>`).join('')}
              </select></label>
            <label class="ms-campo"><span>Número de documento</span>
              <input name="numeroDocumento" autocomplete="off"></label>
          </div>
          <p class="ms-nota">El documento va completo o no va: si escribe el número, elija también el tipo.
            Los tipos salen del catálogo, así que la central los cambia sin tocar código.</p>
          <div class="ms-fila2">
            <label class="ms-campo"><span>Fecha de nacimiento</span>
              <input name="fechaNacimiento" type="date"></label>
            <label class="ms-campo"><span>Correo</span><input name="email" type="email"></label>
          </div>
          <label class="ms-campo"><span>Teléfono móvil</span><input name="telefono" type="tel"></label>
          <button class="ms-btn ms-btn--primario" type="submit">Registrar</button>
        </form>
        <div id="salida-persona"></div>
      </div>

      <div class="ms-paso" style="margin-top:12px">
        <h3><i>2</i>Crearle la cuenta</h3>
        <form id="f-cuenta">
          <label class="ms-campo"><span>Persona <i class="ms-req">obligatorio</i></span>
            <input class="ms-filtro" id="q-persona" placeholder="Escriba para buscar a alguien ya registrado"
                   style="margin-bottom:6px">
            <select name="personaId" required id="sel-persona" size="6">
              <option value="">— registre a alguien arriba o búsquelo aquí —</option>
            </select></label>
          <label class="ms-campo"><span>Usuario (correo) <i class="ms-req">obligatorio</i></span>
            <input name="usuario" type="email" required></label>
          <button class="ms-btn ms-btn--primario" type="submit">Crear cuenta</button>
        </form>
        <div id="salida-cuenta"></div>
      </div>
      </div>`;

    m.querySelector('#f-persona').addEventListener('submit', async ev => {
      ev.preventDefault();
      const f = ev.target, d = {};
      for (const k of ['primerNombre','primerApellido','sedeId','tipoDocumento',
                       'numeroDocumento','fechaNacimiento','email','telefono'])
        if (f.elements[k]?.value.trim()) d[k] = f.elements[k].value.trim();
      /* ⛔ La pareja incompleta se avisa AQUÍ, antes de gastar una
         petición y antes de que la base conteste con el nombre de una
         restricción que nadie fuera del equipo entiende. */
      const z = m.querySelector('#salida-persona');
      if (!!d.numeroDocumento !== !!d.tipoDocumento) {
        z.innerHTML = `<div class="ms-alerta ms-alerta--roja" style="margin-top:12px">
          ${d.numeroDocumento ? 'Escribió el número del documento pero no eligió el tipo.'
                              : 'Eligió el tipo de documento pero no escribió el número.'}
          Van juntos: un número suelto no identifica a nadie.</div>`;
        return;
      }
      try {
        const r = await api.enviar('/api/v1/administracion/personas', d);
        m.querySelector('#f-cuenta').elements.personaId.value = r.id;
        m.querySelector('#f-cuenta').dataset.nombre = `${d.primerNombre} ${d.primerApellido}`;
        if (d.email) m.querySelector('#f-cuenta').elements.usuario.value = d.email;
        /* ⛔ Antes solo se insertaba la opción en el DOM. Bastaba teclear
           una letra en el filtro para que el `select` se reconstruyera
           desde el array `personas` —que no la tenía— y la persona recién
           registrada desapareciera, dejando el paso 2 bloqueado sin
           explicar por qué. Ahora entra en el ARRAY, que es la fuente. */
        const s2 = m.querySelector('#sel-persona');
        const etiqueta = `${d.primerNombre} ${d.primerApellido} · recién registrada`;
        personas.unshift({ valor: r.id, texto: etiqueta });
        s2.insertAdjacentHTML('afterbegin', `<option value="${esc(r.id)}" selected>${esc(etiqueta)}</option>`);
        s2.value = r.id;
        z.innerHTML = `<div class="ms-alerta ms-alerta--verde" style="margin-top:12px">${esc(r.mensaje)}
            Ya queda elegida abajo, en el paso 2.</div>`;
        f.reset();
      } catch (e) {
        m.querySelector('#salida-persona').innerHTML =
          `<div class="ms-alerta ms-alerta--roja" style="margin-top:12px">${esc(e.message)}</div>`;
      }
    });

    /* Quien ya está registrado no se vuelve a registrar: se busca.
       ⛔ Antes había que pegar su identificador a mano. */
    const sel = m.querySelector('#sel-persona');
    /* ⛔ Las recién registradas van DELANTE y se conservan cuando llega la
       lista del servidor: si no, quien registraba a alguien mientras la
       lista cargaba lo perdía sin enterarse. */
    let personas = [];
    opcPersonas().then(l => {
      const nuevas = personas.filter(p => !l.some(x => x.valor === p.valor));
      personas = [...nuevas, ...l];
      const elegido = sel.value;
      sel.innerHTML = '<option value="">— elija a quien va a tener cuenta —</option>' +
        personas.map(p => `<option value="${esc(p.valor)}">${esc(p.texto)}</option>`).join('');
      if (elegido) sel.value = elegido;
      m.querySelector('#q-persona').placeholder = `Escriba para buscar entre ${personas.length} personas`;
    });
    m.querySelector('#q-persona').addEventListener('input', ev => {
      const q = ev.target.value.trim().toLowerCase();
      sel.innerHTML = '<option value="">— elija a quien va a tener cuenta —</option>' +
        personas.filter(p => !q || p.texto.toLowerCase().includes(q))
          .map(p => `<option value="${esc(p.valor)}">${esc(p.texto)}</option>`).join('');
    });

    m.querySelector('#f-cuenta').addEventListener('submit', async ev => {
      ev.preventDefault();
      const f = ev.target;
      try {
        const r = await api.enviar('/api/v1/administracion/cuentas', {
          personaId: f.elements.personaId.value.trim(),
          usuario: f.elements.usuario.value.trim(),
        });
        m.querySelector('#salida-cuenta').innerHTML = claveProvisional(r.clave_provisional, r.mensaje);
        engancharCopiar(m);
        f.reset();
      } catch (e) {
        m.querySelector('#salida-cuenta').innerHTML =
          `<div class="ms-alerta ms-alerta--roja" style="margin-top:12px">${esc(e.message)}</div>`;
      }
    });
  },
};

/* ══════════════════════════════════════════════════════════════════════
   El resto de las vistas. Se añaden con Object.assign en vez de alargar
   el literal de arriba: así cada bloque se lee entero sin tener que
   buscar dónde cierra el anterior.
   ══════════════════════════════════════════════════════════════════════ */
Object.assign(VISTAS, {

  /* ── Qué puede cada quien ──────────────────────────────────────────
     La pregunta de toda auditoría: «muéstreme qué alcanza esta persona».
     ⛔ Antes pedía pegar un identificador. Nadie tiene a mano un uuid:
        ahora se elige de la lista y se puede filtrar escribiendo. */
  async permisos(m) {
    const personas = await opcPersonas();
    m.innerHTML = `
      ${cabecera('Qué puede cada quien',
        'Los roles de una persona y lo que de verdad alcanza con ellos.')}
      <div class="ms-barra">
        <input class="ms-busca" id="q" placeholder="Escriba para filtrar entre ${personas.length} personas">
        <select id="sel" class="ms-sel-ancho">
          <option value="">— elija una persona —</option>
          ${personas.map(p => `<option value="${esc(p.valor)}">${esc(p.texto)}</option>`).join('')}
        </select>
      </div>
      <div id="det"><p class="ms-vacio">Elija una persona para ver sus roles y lo que alcanza.</p></div>`;

    const sel = m.querySelector('#sel');
    m.querySelector('#q').addEventListener('input', ev => {
      const q = ev.target.value.trim().toLowerCase();
      const coinciden = personas.filter(p => !q || p.texto.toLowerCase().includes(q));
      sel.innerHTML = '<option value="">— elija una persona —</option>' +
        coinciden.map(p => `<option value="${esc(p.valor)}">${esc(p.texto)}</option>`).join('');
      /* Si el filtro deja UNA sola, se elige sola: el navegador no dispara
         `change` cuando solo queda una opción, y había que pulsarla aunque
         ya estuviera a la vista. Y si no, se limpia el detalle: antes se
         quedaban abajo los roles de la persona ANTERIOR mientras arriba
         decía «elija una persona». */
      if (coinciden.length === 1) sel.value = coinciden[0].valor;
      ver();
    });

    const ver = async () => {
      const id = sel.value;
      const z = m.querySelector('#det');
      if (!id) { z.innerHTML = '<p class="ms-vacio">Elija una persona.</p>'; return; }
      z.innerHTML = cargando;
      try {
        const [asig, efe] = await Promise.all([
          api.obtener('/api/v1/identidad/personas/' + id + '/asignaciones'),
          api.obtener('/api/v1/identidad/personas/' + id + '/efectivo').catch(() => null),
        ]);
        const filas = Array.isArray(asig) ? asig : (asig?.asignaciones ?? []);
        const permisos = Array.isArray(efe) ? efe : (efe?.permisos ?? []);
        z.innerHTML = `
          <div class="ms-barra">
            <button class="ms-btn ms-btn--primario" id="b-otorgar">+ Otorgar un rol</button>
            <button class="ms-btn" id="b-ficha">Abrir su ficha completa</button>
          </div>
          <h2 class="ms-h2">Roles vigentes</h2>
          ${tablaMs(filas, [
            { t: 'Rol', p: a => `<b>${esc(a.rol_nombre ?? a.rol)}</b><span class="ms-doc">${esc(a.rol)}</span>
                <button class="ms-btn ms-btn--peq" data-rev="${esc(a.id)}" style="margin-top:4px">Revocar</button>` },
            { t: 'Alcance', p: a => esc(a.alcance_tipo) },
            { t: 'Techo', p: a => niv(a.nivel_max) },
            { t: 'Desde', p: a => esc(a.vigente_desde ?? a.desde ?? '—') },
            { t: 'Acta', p: a => a.acta_referencia ? `<code>${esc(a.acta_referencia)}</code>` : '<span class="ms-falta">sin acta</span>' },
          ], 'Sin roles vigentes: esta persona no puede hacer nada.')}
          <h2 class="ms-h2">Lo que alcanza de verdad <span class="num">${permisos.length}</span></h2>
          ${tablaMs(permisos.slice(0, 300), [
            { t: 'Módulo', p: p => esc(p.modulo_nombre ?? p.modulo) },
            { t: 'Acción', p: p => esc(p.accion_nombre ?? p.accion) },
            { t: 'Techo', p: p => niv(p.nivel_max ?? p.nivel) },
          ], 'Nada. Tiene rol pero ninguna casilla marcada: revise «Roles y techos».')}
          ${permisos.length > 300 ? `<p class="ms-vacio">Se muestran 300 de ${permisos.length}.</p>` : ''}`;

        z.querySelector('#b-ficha').addEventListener('click', () => abrirPersona(id));
        z.querySelector('#b-otorgar').addEventListener('click', async () => {
          const cat = await catalogo();
          const r = await pedir([
            { nombre: 'rol', etiqueta: 'Rol', obligatorio: true,
              opciones: cat.roles.filter(x => x.activo)
                .map(x => ({ valor: x.codigo, texto: `${x.nombre} · techo N${x.nivel_maximo} · ${x.alcance_maximo}` })) },
            { nombre: 'alcanceTipo', etiqueta: 'Alcance', obligatorio: true, valor: 'sede',
              opciones: ['persona_propia','grupo','ministerio','segmento','sede','unidad','organizacion']
                .map(v => ({ valor: v, texto: v })) },
            { nombre: 'alcanceId', etiqueta: 'Iglesia (solo si el alcance es «sede»)',
              vacio: '— no aplica —', opciones: opcSedes(await sedesDe()) },
            { nombre: 'acta', etiqueta: 'Acta que lo autoriza', obligatorio: true },
          ], 'Otorgar un rol');
          if (!r) return;
          try {
            await api.enviar('/api/v1/identidad/personas/' + id + '/otorgar', { roles: [r] });
            avisar('Rol otorgado.'); ver();
          } catch (e) { avisar(e.message, 'roja'); }
        });
        z.querySelectorAll('[data-rev]').forEach(b => b.addEventListener('click', async () => {
          const r = await pedir([{ nombre: 'motivo', obligatorio: true,
            etiqueta: 'Motivo · queda en su ficha y en la auditoría' }], 'Quitarle el rol');
          if (!r) return;
          try {
            const x = await api.borrar('/api/v1/identidad/asignaciones/' + b.dataset.rev, { motivo: r.motivo });
            avisar(x.mensaje ?? 'Rol revocado.'); ver();
          } catch (e) { avisar(e.message, 'roja'); }
        }));
      } catch (e) { z.innerHTML = `<div class="ms-alerta ms-alerta--roja">${esc(e.message)}</div>`; }
    };
    sel.addEventListener('change', ver);
  },

  /* ── Roles y techos ────────────────────────────────────────────────
     La pantalla donde se decide QUÉ PUEDE HACER cada rol, casilla por
     casilla. El techo no es decorativo: la base no deja otorgar por
     encima de él. Una casilla marcada sobre un módulo MÁS sensible que
     el techo del rol se señala «engaña», porque el permiso existe en la
     tabla y no sirve para nada: es la clase de detalle que una auditoría
     busca y que nadie ve hasta que alguien reclama que «no le aparece». */
  async roles(m) {
    const cat = await catalogo();
    const pedidas = subruta();
    let actual = cat.roles.some(r => r.codigo === pedidas) ? pedidas : cat.roles[0]?.codigo;

    m.innerHTML = `
      ${cabecera('Roles y techos',
        'Cada rol tiene un alcance máximo, un techo de sensibilidad y una casilla por cada cosa que puede hacer.')}
      <div class="ms-dos">
        <aside class="ms-lateral">
          <button class="ms-btn ms-btn--primario" id="b-rol">+ Crear un rol</button>
          <input class="ms-filtro" id="q-rol" placeholder="Filtrar ${cat.roles.length} roles">
          <div class="ms-listilla" id="lista-roles"></div>
        </aside>
        <section id="det">${cargando}</section>
      </div>`;

    const listar = (q = '') => {
      m.querySelector('#lista-roles').innerHTML = cat.roles
        .filter(r => !q || (r.nombre + r.codigo).toLowerCase().includes(q.toLowerCase()))
        .map(r => `<button class="ms-itemlista${r.codigo === actual ? ' is-on' : ''}" data-rol="${esc(r.codigo)}">
            <b>${esc(r.nombre)}</b>
            <span>${niv(r.nivel_maximo)} ${esc(r.alcance_maximo)}${r.activo ? '' : ' · inactivo'}</span>
          </button>`).join('') || '<p class="ms-vacio">Ninguno coincide.</p>';
    };

    const detalle = async () => {
      const z = m.querySelector('#det');
      z.innerHTML = cargando;
      const rol = cat.roles.find(r => r.codigo === actual);
      const d = await api.obtener('/api/v1/administracion/matriz?rol=' + encodeURIComponent(actual));
      const celda = new Map(d.matriz.map(x => [x.modulo + '|' + x.accion, x]));
      const globales = cat.acciones.filter(a => !a.modulo);
      const propias = (mod) => cat.acciones.filter(a => a.modulo === mod);
      const marcadas = d.matriz.filter(x => x.marcado).length;
      const enganan = d.matriz.filter(x => x.marcado && x.por_encima).length;

      const cel = (mod, acc) => {
        const c = celda.get(mod + '|' + acc);
        if (!c) return '<td class="ms-cel ms-cel--na"></td>';
        return `<td class="ms-cel ${c.marcado ? 'ms-cel--si' : 'ms-cel--no'}${c.por_encima ? ' ms-cel--veda' : ''}">
          <input type="checkbox" class="ms-tick" ${c.marcado ? 'checked' : ''}
                 data-mod="${esc(mod)}" data-acc="${esc(acc)}"
                 aria-label="${esc(acc)} en ${esc(mod)}"
                 title="${c.por_encima ? 'El módulo es N' + c.modulo_nivel + ' y el techo del rol es N' + c.rol_techo + ': aunque se marque, no verá el dato.' : ''}">
        </td>`;
      };

      z.innerHTML = `
        <div class="ms-persona">
          <div class="ms-persona__cab">
            <div><b>${esc(rol.nombre)}</b><span class="ms-doc">${esc(rol.codigo)}</span></div>
            <div style="display:flex;gap:8px;align-items:center">
              ${niv(rol.nivel_maximo)}
              <span class="ms-chip">${esc(rol.alcance_maximo)}</span>
              ${rol.activo ? '' : '<span class="ms-vig ms-vig--fin">inactivo</span>'}
              <button class="ms-btn" id="b-editar">Editar</button>
            </div>
          </div>
          <div style="padding:12px 16px">
            <p style="margin:0 0 12px;color:var(--tin-mid);font-size:13px">${esc(rol.descripcion ?? 'Sin descripción.')}</p>
            <div class="ms-kpis">
              <div class="ms-kpi"><b>${marcadas}</b><span>permisos marcados</span></div>
              <div class="ms-kpi"><b>${d.total_filas}</b><span>casillas posibles</span></div>
              <div class="ms-kpi ${enganan ? 'ms-kpi--ojo' : ''}"><b>${enganan}</b><span>marcados que engañan</span></div>
            </div>
            ${enganan ? alerta('Hay ' + enganan + ' permisos marcados sobre módulos más sensibles que el techo del rol: existen en la tabla y no dejan ver el dato. O se sube el techo, o se desmarcan.', 'ambar') : ''}
            ${alerta(d.aviso)}
          </div>
        </div>

        <h2 class="ms-h2">Lo que puede hacer</h2>
        <div class="ms-leyenda" style="margin-bottom:8px">
          <span><i style="background:var(--ok-bg)"></i>marcado</span>
          <span><i style="background:var(--sup)"></i>sin marcar</span>
          <span><i style="background:var(--pel-bg)"></i>por encima del techo</span>
          <span><i style="background:var(--pa-alt)"></i>no aplica a ese módulo</span>
        </div>
        <div class="ms-scroll"><table class="ms-tabla ms-matriz">
          <thead><tr><th class="ms-rolcel" style="text-align:left">Módulo</th>
            ${globales.map(a => `<th>${esc(a.nombre)}</th>`).join('')}
            <th style="text-align:left">Acciones propias del módulo</th></tr></thead>
          <tbody>${cat.modulos.map(mo => `
            <tr>
              <td class="ms-rolcel">${esc(mo.nombre)} ${niv(mo.nivel_dato)}</td>
              ${globales.map(a => cel(mo.codigo, a.codigo)).join('')}
              <td>${propias(mo.codigo).length
                ? `<div class="ms-rejilla ms-rejilla--apretada">${propias(mo.codigo).map(a => {
                    const c = celda.get(mo.codigo + '|' + a.codigo);
                    return casilla({ titulo: a.nombre, sub: a.codigo, marcado: !!c?.marcado,
                      datos: { mod: mo.codigo, acc: a.codigo } });
                  }).join('')}</div>`
                : '<span class="ms-vacio">ninguna</span>'}</td>
            </tr>`).join('')}</tbody>
        </table></div>`;

      z.querySelector('#b-editar').addEventListener('click', async () => {
        const r = await pedir([
          { nombre: 'nombre', etiqueta: 'Nombre', obligatorio: true, valor: rol.nombre },
          { nombre: 'alcanceMaximo', etiqueta: 'Alcance máximo', obligatorio: true, valor: rol.alcance_maximo,
            opciones: ['persona_propia','grupo','ministerio','segmento','sede','unidad','organizacion']
              .map(v => ({ valor: v, texto: v })) },
          { nombre: 'nivelMaximo', etiqueta: 'Techo de sensibilidad', obligatorio: true, numero: true,
            valor: String(rol.nivel_maximo),
            opciones: cat.niveles.map(n => ({ valor: String(n.nivel), texto: `N${n.nivel} · ${n.descripcion}` })) },
          { nombre: 'descripcion', etiqueta: 'Para qué sirve', valor: rol.descripcion ?? '' },
          { nombre: 'activo', etiqueta: '¿Se puede otorgar?', obligatorio: true, valor: rol.activo ? 'si' : 'no',
            opciones: [{ valor: 'si', texto: 'Sí, está vigente' }, { valor: 'no', texto: 'No, quedó descontinuado' }] },
        ], 'Editar ' + rol.nombre);
        if (!r) return;
        try {
          const x = await api.enviar('/api/v1/administracion/roles',
            { codigo: rol.codigo, ...r, activo: r.activo === 'si' });
          CAT = null; avisar(x.mensaje);
          CAT = await catalogo();
          Object.assign(rol, CAT.roles.find(y => y.codigo === rol.codigo));
          listar(m.querySelector('#q-rol').value); detalle();
        } catch (e) { avisar(e.message, 'roja'); }
      });
    };

    /* ⛔ UNA vez. Dentro de `detalle()` se volvía a colgar en cada
       repintado sobre el mismo `#det`: marcar una casilla disparaba el
       guardado tantas veces como roles se hubieran mirado antes. */
    m.addEventListener('change', async ev => {
      const inp = ev.target;
      if (inp.type !== 'checkbox') return;
      const cont = inp.closest('[data-mod]') ?? inp;
      const mod = inp.dataset.mod ?? cont.dataset?.mod;
      const acc = inp.dataset.acc ?? cont.dataset?.acc;
      if (!mod || !acc) return;
      pintarEstado(inp);
      inp.closest('td')?.classList.toggle('ms-cel--si', inp.checked);
      inp.closest('td')?.classList.toggle('ms-cel--no', !inp.checked);
      try {
        const r = await api.enviar('/api/v1/administracion/matriz',
          { rol: actual, modulo: mod, accion: acc, marcado: inp.checked });
        avisar(r.mensaje);
      } catch (e) { revertir(inp, e); detalle(); }
    });

    m.querySelector('#lista-roles').addEventListener('click', ev => {
      const b = ev.target.closest('[data-rol]');
      if (!b) return;
      actual = b.dataset.rol;
      history.replaceState(null, '', '#/roles/' + actual);
      listar(m.querySelector('#q-rol').value); detalle();
    });
    m.querySelector('#q-rol').addEventListener('input', ev => listar(ev.target.value));
    m.querySelector('#b-rol').addEventListener('click', async () => {
      const r = await pedir([
        { nombre: 'codigo', etiqueta: 'Código (en mayúsculas, sin espacios)', obligatorio: true, ayuda: 'TESORERIA_SEDE' },
        { nombre: 'nombre', etiqueta: 'Nombre', obligatorio: true },
        { nombre: 'alcanceMaximo', etiqueta: 'Alcance máximo', obligatorio: true, valor: 'sede',
          opciones: ['persona_propia','grupo','ministerio','segmento','sede','unidad','organizacion']
            .map(v => ({ valor: v, texto: v })) },
        { nombre: 'nivelMaximo', etiqueta: 'Techo de sensibilidad', obligatorio: true, numero: true, valor: '2',
          opciones: cat.niveles.map(n => ({ valor: String(n.nivel), texto: `N${n.nivel} · ${n.descripcion}` })) },
        { nombre: 'descripcion', etiqueta: 'Para qué sirve', obligatorio: true },
      ], 'Crear un rol');
      if (!r) return;
      try {
        const x = await api.enviar('/api/v1/administracion/roles', r);
        avisar(x.mensaje + ' Ahora marque lo que puede hacer.');
        CAT = null; CAT = await catalogo();
        cat.roles = CAT.roles; actual = r.codigo;
        listar(''); detalle();
      } catch (e) { avisar(e.message, 'roja'); }
    });

    listar(); detalle();
  },

  /* ── Recertificación ───────────────────────────────────────────────
     ⛔ 20 sep 2026. Esta vista era de SOLO LECTURA: una lista de trabajo
        del comité trimestral que no se podía tachar, así que los días sin
        revisar solo podían crecer. Y el número era falso: contaba TODOS
        los accesos vigentes, no los vencidos. Ahora se revisa de verdad,
        con veredicto y nota firmada. */
  async recert(m) {
    let todos = false;
    const pintarTodo = async () => {
      const d = await api.obtener('/api/v1/administracion/recertificar' + (todos ? '?todos=si' : ''));
      m.innerHTML = `
        ${cabecera('Recertificación de accesos',
          'Un permiso que nadie revisa es un permiso que nadie quitó. El plazo es de 90 días para lo que toca datos N3 o N4, y de 180 para el resto.')}
        <div class="ms-kpis">
          <div class="ms-kpi ${d.vencidos ? 'ms-kpi--ojo' : ''}"><b>${esc(d.vencidos ?? 0)}</b><span>pasaron su plazo</span></div>
          <div class="ms-kpi"><b>${esc(d.vigentes ?? 0)}</b><span>accesos vigentes</span></div>
        </div>
        ${alerta(d.aviso, d.vencidos ? 'ambar' : 'verde')}
        <div class="ms-barra">
          <label class="ms-opt" style="max-width:340px">
            <input type="checkbox" id="c-todos" ${todos ? 'checked' : ''}>
            <div><b>Ver también los que están en plazo</b>
              <small>La lista del comité son solo los vencidos.</small></div>
          </label>
        </div>
        ${tablaMs(d.accesos, [
          { t: 'Persona', p: x => `<b>${esc(x.persona)}</b>
              <span class="ms-doc">${esc(x.rol)}</span>
              <button class="ms-btn ms-btn--peq" data-recert="${esc(x.asignacion_id)}"
                      style="margin-top:4px">Revisar</button>` },
          { t: 'Techo', p: x => niv(x.nivel_max) },
          { t: 'Alcance', k: 'alcance_tipo' },
          { t: 'Sin revisar', p: x => `<span class="num">${esc(x.dias_sin_revisar)}</span> de ${esc(x.tope_dias)} día(s)
              ${x.vencido ? '<span class="ms-falta">VENCIDO</span>' : ''}` },
          { t: 'Última revisión', p: x => x.ultima_revision
              ? esc(new Date(x.ultima_revision).toLocaleDateString('es-CO'))
              : '<span class="ms-vacio">nunca</span>' },
        ], todos ? 'Ningún acceso vigente.' : 'Nada vencido: el comité está al día.')}`;
      m.querySelector('#c-todos').addEventListener('change', ev => { todos = ev.target.checked; pintarTodo(); });
    };
    await pintarTodo();

    m.addEventListener('click', async ev => {
      const b = ev.target.closest('[data-recert]');
      if (!b) return;
      const r = await pedir([
        { nombre: 'veredicto', etiqueta: '¿Qué decide el comité?', obligatorio: true, valor: 'mantener',
          opciones: [
            { valor: 'se_mantiene', texto: 'Se mantiene: sigue necesitando ese acceso' },
            { valor: 'se_reduce', texto: 'Se reduce: necesita menos del que tiene' },
            { valor: 'se_revoca', texto: 'Se revoca: ya no lo necesita' }] },
        { nombre: 'nota', etiqueta: 'Por qué · queda firmado con su nombre', obligatorio: true },
      ], 'Revisar este acceso');
      if (!r) return;
      try {
        const x = await api.enviar('/api/v1/administracion/recertificar/' + b.dataset.recert, r);
        avisar(x.mensaje); pintarTodo();
      } catch (e) { avisar(e.message, 'roja'); }
    });
  },

  /* ── Iglesias y sedes ──────────────────────────────────────────────
     Pulsar una iglesia abre su ficha: cuánta gente tiene, qué módulos
     ve, quién la pastorea y qué le falta. Desde ahí se entra a lo que
     ella ve. */
  async iglesias(m) {
    const [sedes, pla] = await Promise.all([
      sedesDe(), api.obtener('/api/v1/administracion/plantillas'),
    ]);
    m.innerHTML = `
      ${cabecera('Iglesias y sedes',
        'Desplegar una iglesia es una sola operación: la sede, sus módulos según la plantilla y su pastor. Pulse una fila para abrir su ficha.')}
      ${alerta(pla.aviso)}
      <div class="ms-barra">
        <button class="ms-btn ms-btn--primario" id="b-desplegar">+ Desplegar una iglesia</button>
        <input class="ms-busca" id="q" placeholder="Buscar iglesia">
        <span class="ms-barra__sp"></span>
        <span style="color:var(--tin-dim);font-size:12px">${sedes.length} en la red</span>
      </div>
      <div id="tabla"></div>`;

    const cols = [
      /* La primera celda es el enlace: se ve siempre, aunque la tabla se
         desplace de lado, y se alcanza con el tabulador. */
      { t: 'Iglesia', p: x => `<button class="ms-enlace" data-sede="${esc(x.id)}">
          <b>${esc(x.nombre)}</b><span class="ms-doc">${esc(x.codigo)}</span></button>` },
      { t: 'Ciudad', p: x => esc([x.ciudad, x.pais].filter(Boolean).join(', ')) },
      { t: 'Tipo', p: x => `<span class="ms-chip">${esc(x.tipo ?? '')}</span>` },
      { t: 'Estado', p: x => x.activa === false
          ? '<span class="ms-vig ms-vig--fin">inactiva</span>'
          : '<span class="ms-vig ms-vig--ok">activa</span>' },
    ];
    const pintarTabla = (q = '') => {
      const l = sedes.filter(x => !q || (x.codigo + x.nombre + (x.ciudad ?? '')).toLowerCase().includes(q.toLowerCase()));
      m.querySelector('#tabla').innerHTML = tablaMs(l, cols, 'Ninguna iglesia coincide.',
        { attr: 'sede', id: x => x.id, que: x => 'la ficha de ' + x.nombre });
    };
    pintarTabla();
    m.querySelector('#q').addEventListener('input', ev => pintarTabla(ev.target.value));

    m.addEventListener('click', async ev => {
      const b = ev.target.closest('[data-sede]');
      if (!b) return;
      const id = b.dataset.sede;
      const d = fichaAbrir('Cargando…', '', cargando);
      try {
        const [f, mods] = await Promise.all([
          api.obtener('/api/v1/administracion/sedes/' + id),
          api.obtener('/api/v1/administracion/sedes/' + id + '/modulos').catch(() => ({ modulos: [] })),
        ]);
        const on = mods.modulos.filter(x => x.activo);
        d.remove();
        const z = fichaAbrir(f.sede.nombre, f.sede.codigo + ' · ' + f.sede.tipo + ' · ' + (f.sede.ciudad ?? ''), `
          ${alerta(f.aviso, 'roja')}
          <div class="ms-kpis">
            <div class="ms-kpi"><b>${esc(f.conteo.personas)}</b><span>personas</span></div>
            <div class="ms-kpi"><b>${esc(f.conteo.grupos)}</b><span>grupos</span></div>
            <div class="ms-kpi"><b>${esc(f.conteo.modulos_encendidos)}</b><span>módulos encendidos</span></div>
          </div>
          <div class="ms-acciones" style="margin:16px 0">
            <a class="ms-btn ms-btn--primario" id="f-ver" href="${esc(APP_PASTORES)}#/panel"
               target="_blank" rel="noopener">Abrir la aplicación de los pastores ↗</a>
            <button class="ms-btn" id="f-mod">Cambiar sus módulos</button>
            <button class="ms-btn" id="f-pas">Asignar pastor</button>
          </div>
          <p class="ms-nota">Entra a la aplicación de los pastores con SU usuario, no con el del pastor:
            esta consola no suplanta a nadie, porque cada cosa hecha en el sistema tiene que quedar a
            nombre de quien la hizo. ⚠️ Todavía NO entra situada en esta iglesia: lo que esta iglesia ve
            es la lista de módulos de aquí abajo.</p>

          <h2 class="ms-h2">Quién la pastorea</h2>
          ${tablaMs(f.equipo ?? [], [
            { t: 'Persona', p: x => `<b>${esc(x.persona ?? x.nombre_completo ?? '')}</b>` },
            { t: 'Rol', p: x => `<span class="ms-chip">${esc(x.rol_nombre ?? x.rol ?? '')}</span>` },
            { t: 'Techo', p: x => niv(x.nivel_max) },
            { t: 'Desde', k: 'desde' },
          ], 'Nadie con rol en esta sede. Asigne un pastor: una sede sin pastor no se opera sola.')}

          <h2 class="ms-h2">Qué ve · ${on.length} módulos encendidos</h2>
          <div class="ms-chips">${on.length
            ? on.map(x => `<span class="ms-chip">${esc(x.nombre)}</span>`).join('')
            : '<span class="ms-vacio">Ninguno.</span>'}</div>
          ${mods.modulos.filter(x => !x.activo).length ? `
            <h2 class="ms-h2">Apagados</h2>
            <div class="ms-chips">${mods.modulos.filter(x => !x.activo)
              .map(x => `<span class="ms-chip ms-chip--veda">${esc(x.nombre)}</span>`).join('')}</div>` : ''}

          <h2 class="ms-h2">Unidades que la alcanzan</h2>
          <div class="ms-chips">${(f.unidades ?? []).length
            ? f.unidades.map(u => `<span class="ms-chip">${esc(u.nombre)}</span>`).join('')
            : '<span class="ms-vacio">Ninguna.</span>'}</div>`);

        /* Es un enlace, no una ventana emergente: lo de antes lo bloqueaba
           el navegador y no pasaba nada al pulsarlo. */
        z.querySelector('#f-mod').addEventListener('click', () => { z.remove(); location.hash = '#/modulos/' + id; });
        z.querySelector('#f-pas').addEventListener('click', async () => {
          const personas = await opcPersonas();
          const cat = await catalogo();
          const r = await pedir([
            { nombre: 'personaId', etiqueta: 'Persona', obligatorio: true, opciones: personas },
            { nombre: 'rol', etiqueta: 'Rol', obligatorio: true, valor: 'PASTOR_CONGREGACIONAL',
              opciones: cat.roles.filter(x => x.activo).map(x => ({ valor: x.codigo, texto: x.nombre })) },
            { nombre: 'acta', etiqueta: 'Acta que lo autoriza', obligatorio: true },
          ], 'Asignar pastor a ' + f.sede.nombre);
          if (!r) return;
          try {
            await api.enviar('/api/v1/identidad/personas/' + r.personaId + '/otorgar',
              { roles: [{ rol: r.rol, alcanceTipo: 'sede', alcanceId: id, acta: r.acta }] });
            avisar('Rol otorgado en ' + f.sede.nombre + '.'); z.remove();
          } catch (e) { avisar(e.message, 'roja'); }
        });
      } catch (e) {
        d.remove();
        fichaAbrir('No se pudo abrir', '', `<div class="ms-alerta ms-alerta--roja">${esc(e.message)}</div>`);
      }
    });

    m.querySelector('#b-desplegar').addEventListener('click', async () => {
      const personas = await opcPersonas();
      const d = await pedir([
        { nombre: 'codigo', etiqueta: 'Código', obligatorio: true, ayuda: 'BOG-SUR' },
        { nombre: 'nombre', etiqueta: 'Nombre', obligatorio: true, ayuda: 'Bogotá Sur' },
        { nombre: 'tipo', etiqueta: 'Tipo', obligatorio: true, opciones: [
          { valor: 'plantacion', texto: 'Plantación' },
          { valor: 'filial_nacional', texto: 'Filial nacional' },
          { valor: 'filial_internacional', texto: 'Filial internacional' }] },
        { nombre: 'pais', etiqueta: 'País (2 letras)', obligatorio: true, valor: 'CO' },
        { nombre: 'ciudad', etiqueta: 'Ciudad', obligatorio: true },
        { nombre: 'plantilla', etiqueta: 'Plantilla · define con qué módulos nace', obligatorio: true, opciones:
          pla.plantillas.filter(p => p.codigo !== 'MAESTRA')
            .map(p => ({ valor: p.codigo, texto: p.nombre + ' · ' + p.modulos + ' módulos' })) },
        { nombre: 'pastorId', etiqueta: 'Pastor congregacional', obligatorio: true, opciones: personas },
      ], 'Desplegar una iglesia');
      if (!d) return;
      try {
        const r = await api.enviar('/api/v1/administracion/iglesias', d);
        SEDES = null; pintar().then(() => avisar(r.mensaje));
      } catch (e) { avisar(e.message, 'roja'); }
    });
  },

  /* ── Plantillas de iglesia ─────────────────────────────────────────
     Una plantilla es la respuesta a «¿con qué nace una iglesia nueva?».
     Se edita con casillas: marcar un módulo lo mete en la plantilla.
     ⛔ Los de núcleo no se pueden quitar y la casilla lo dice en vez de
        fallar cuando alguien lo intenta. */
  async plantillas(m) {
    const [cat, d] = await Promise.all([catalogo(), api.obtener('/api/v1/administracion/plantillas')]);
    let actual = d.plantillas[0]?.codigo;

    m.innerHTML = `
      ${cabecera('Plantillas de iglesia',
        'Qué módulos trae una iglesia nueva según su tipo. Es lo que hace que las 36 nazcan con el mismo sistema.')}
      ${alerta(d.aviso)}
      <div class="ms-dos">
        <aside class="ms-lateral">
          <button class="ms-btn ms-btn--primario" id="b-nueva">+ Crear una plantilla</button>
          <div class="ms-listilla" id="lista-pla"></div>
        </aside>
        <section id="det">${cargando}</section>
      </div>`;

    const listar = () => {
      m.querySelector('#lista-pla').innerHTML = d.plantillas.map(p => `
        <button class="ms-itemlista${p.codigo === actual ? ' is-on' : ''}" data-pla="${esc(p.codigo)}">
          <b>${esc(p.nombre)}</b><span>${p.modulos} módulos · ${esc(p.tipo_sede)}</span>
        </button>`).join('') || '<p class="ms-vacio">Ninguna.</p>';
    };

    const detalle = () => {
      const p = d.plantillas.find(x => x.codigo === actual);
      const z = m.querySelector('#det');
      if (!p) { z.innerHTML = '<p class="ms-vacio">Elija una plantilla.</p>'; return; }
      const dentro = new Set((p.lista ?? '').split(', ').filter(Boolean));
      z.innerHTML = `
        <div class="ms-persona">
          <div class="ms-persona__cab">
            <div><b>${esc(p.nombre)}</b><span class="ms-doc">${esc(p.codigo)} · ${esc(p.tipo_sede)}</span></div>
            <div style="display:flex;gap:8px">
              <button class="ms-btn" id="b-ren">Renombrar</button>
              ${p.codigo === 'MAESTRA' ? '' : '<button class="ms-btn ms-btn--peligro" id="b-bor">Borrar</button>'}
            </div>
          </div>
          <div style="padding:12px 16px">
            <p style="margin:0 0 4px;color:var(--tin-mid);font-size:13px">${esc(p.descripcion ?? '')}</p>
            ${p.con_compuerta_legal ? alerta(p.con_compuerta_legal + ' de estos módulos NACEN APAGADOS aunque estén en la plantilla: exigen evidencia jurídica antes de encenderse en una sede.', 'ambar') : ''}
          </div>
        </div>
        <h2 class="ms-h2">Módulos que trae <span class="num" id="cuantos">${p.modulos}</span> de ${cat.modulos.length}</h2>
        <div class="ms-rejilla">${cat.modulos.map(mo => casilla({
          titulo: mo.nombre,
          sub: mo.es_nucleo ? 'De núcleo · siempre viene' : `N${mo.nivel_dato}${mo.exige_compuerta_legal ? ' · exige evidencia legal' : ''}`,
          marcado: dentro.has(mo.nombre),
          bloqueado: mo.es_nucleo,
          motivo: 'De núcleo · no se puede quitar',
          datos: { mod: mo.codigo },
        })).join('')}</div>`;

      z.querySelector('#b-ren').addEventListener('click', async () => {
        const r = await pedir([
          { nombre: 'nombre', etiqueta: 'Nombre', obligatorio: true, valor: p.nombre },
          { nombre: 'descripcion', etiqueta: 'Para qué tipo de iglesia', valor: p.descripcion ?? '' },
        ], 'Renombrar ' + p.codigo);
        if (!r) return;
        try {
          await api.enviar('/api/v1/administracion/plantillas',
            { codigo: p.codigo, tipoSede: p.tipo_sede, ...r });
          Object.assign(p, r); avisar('Plantilla guardada.'); listar(); detalle();
        } catch (e) { avisar(e.message, 'roja'); }
      });

      z.querySelector('#b-bor')?.addEventListener('click', async () => {
        if (!confirm('Se borra la plantilla «' + p.nombre + '». Las iglesias ya desplegadas con ella NO cambian. ¿Seguir?')) return;
        try {
          const r = await api.enviar('/api/v1/administracion/plantillas/' + p.codigo + '/borrar', {});
          pintar().then(() => avisar(r.mensaje));
        } catch (e) { avisar(e.message, 'roja'); }
      });
    };

    /* ⛔ UNA vez, sobre el contenedor de la vista: dentro de `detalle()`
       se recolgaba en cada plantilla mirada y marcar un módulo mandaba
       la misma orden varias veces. */
    m.addEventListener('change', async ev => {
      const inp = ev.target;
      if (inp.type !== 'checkbox') return;
      const mod = inp.closest('[data-mod]')?.dataset.mod;
      if (!mod) return;
      const p = d.plantillas.find(x => x.codigo === actual);
      pintarEstado(inp);
      try {
        const r = await api.enviar('/api/v1/administracion/plantillas/' + actual + '/modulos',
          { modulo: mod, marcado: inp.checked });
        avisar(r.mensaje);
        const nombre = cat.modulos.find(x => x.codigo === mod).nombre;
        const lista = new Set((p.lista ?? '').split(', ').filter(Boolean));
        inp.checked ? lista.add(nombre) : lista.delete(nombre);
        p.lista = [...lista].join(', '); p.modulos = lista.size;
        const c = m.querySelector('#cuantos');
        if (c) c.textContent = p.modulos;
        listar();
      } catch (e) { revertir(inp, e); }
    });

    m.querySelector('#lista-pla').addEventListener('click', ev => {
      const b = ev.target.closest('[data-pla]');
      if (!b) return;
      actual = b.dataset.pla; listar(); detalle();
    });
    m.querySelector('#b-nueva').addEventListener('click', async () => {
      const r = await pedir([
        { nombre: 'codigo', etiqueta: 'Código', obligatorio: true, ayuda: 'PLANTA-CO' },
        { nombre: 'nombre', etiqueta: 'Nombre', obligatorio: true },
        { nombre: 'tipoSede', etiqueta: 'Para qué tipo de iglesia', obligatorio: true, opciones: [
          { valor: 'plantacion', texto: 'Plantación' },
          { valor: 'filial_nacional', texto: 'Filial nacional' },
          { valor: 'filial_internacional', texto: 'Filial internacional' },
          { valor: 'sede_madre', texto: 'Sede madre' }] },
        { nombre: 'descripcion', etiqueta: 'Para qué sirve', obligatorio: true },
      ], 'Crear una plantilla');
      if (!r) return;
      try { const x = await api.enviar('/api/v1/administracion/plantillas', r); pintar().then(() => avisar(x.mensaje)); }
      catch (e) { avisar(e.message, 'roja'); }
    });

    listar(); detalle();
  },
});

Object.assign(VISTAS, {

  /* ── Qué ve cada iglesia ───────────────────────────────────────────
     Casillas, no botones: encender y apagar es un gesto, no un trámite.
     Lo que manda es la base, y se ve en la casilla antes de intentarlo:
     el núcleo sale deshabilitado, y lo que exige compuerta legal pide la
     referencia del instrumento ANTES de encenderse. */
  async modulos(m) {
    const [cat, sedes] = await Promise.all([catalogo(), sedesDe()]);
    const pedida = subruta();
    m.innerHTML = `
      ${cabecera('Qué ve cada iglesia',
        'Los módulos encendidos en una sede. El núcleo no se apaga, y lo que toca datos protegidos no se enciende sin evidencia jurídica.')}
      <div class="ms-barra">
        <label class="ms-campo ms-campo--ancho" style="margin:0"><span>Iglesia</span>
          <select id="sel">${sedes.map(x => `<option value="${esc(x.id)}"
            ${x.id === pedida ? 'selected' : ''}>${esc(x.codigo)} · ${esc(x.nombre)}</option>`).join('')}</select>
        </label>
        <span class="ms-barra__sp"></span>
        <a class="ms-btn" id="b-ver" href="${esc(APP_PASTORES)}#/panel"
           target="_blank" rel="noopener">Abrir la aplicación de los pastores ↗</a>
      </div>
      <div id="lista">${cargando}</div>`;

    const sel = m.querySelector('#sel');
    /* ⛔ 20 sep 2026. Decía «de esta iglesia» y abría SIEMPRE la misma
       dirección, sin la sede: daba lo mismo para las 36. La aplicación de
       los pastores todavía no toma la sede de la dirección, así que el
       botón dice la verdad y, de paso, deja el código de la iglesia a la
       vista para que se sepa cuál se estaba mirando. */
    /* Un `<a target="_blank">` no lo bloquea el navegador; una ventana
       emergente abierta desde código, sí. */
    m.querySelector('#b-ver').addEventListener('click', () => {
      const s = sedes.find(x => x.id === sel.value);
      avisar('Se abre la aplicación de los pastores con SU usuario. Todavía no entra situada en '
        + (s ? s.codigo : 'esa iglesia') + ': eso exige que la aplicación acepte la sede en la dirección.', 'ambar');
    });

    const pintarLista = async () => {
      const z = m.querySelector('#lista');
      z.innerHTML = cargando;
      try {
        const d = await api.obtener('/api/v1/administracion/sedes/' + sel.value + '/modulos');
        const encendidos = d.modulos.filter(x => x.activo).length;
        const falta = d.modulos.filter(x => x.activo && x.exige_compuerta_legal && !x.evidencia_legal_ref);
        z.innerHTML = `
          ${alerta(d.aviso, 'roja')}
          ${falta.length ? alerta(falta.length + ' módulo(s) encendidos SIN la evidencia jurídica registrada: ' +
             falta.map(x => x.nombre).join(', '), 'ambar') : ''}
          <div class="ms-kpis">
            <div class="ms-kpi"><b>${encendidos}</b><span>encendidos</span></div>
            <div class="ms-kpi"><b>${d.modulos.length - encendidos}</b><span>apagados</span></div>
            <div class="ms-kpi ${falta.length ? 'ms-kpi--ojo' : ''}"><b>${falta.length}</b><span>sin evidencia legal</span></div>
          </div>
          <div class="ms-rejilla">${d.modulos.map(x => casilla({
            titulo: x.nombre,
            sub: [
              'N' + x.nivel_dato,
              x.es_nucleo ? 'núcleo' : null,
              x.depende_de ? 'necesita ' + x.depende_de : null,
              x.evidencia_legal_ref ? 'evidencia ' + x.evidencia_legal_ref : null,
              (x.exige_compuerta_legal && !x.evidencia_legal_ref) ? 'exige evidencia jurídica' : null,
            ].filter(Boolean).join(' · '),
            marcado: !!x.activo,
            bloqueado: x.es_nucleo && x.activo,
            motivo: 'De núcleo · no se apaga',
            datos: { mod: x.codigo, legal: x.exige_compuerta_legal ? '1' : '0' },
          })).join('')}</div>`;

      } catch (e) { z.innerHTML = `<div class="ms-alerta ms-alerta--roja">${esc(e.message)}</div>`; }
    };

    /* ⛔ UNA vez, sobre el contenedor de la vista. Dentro de `pintarLista`
       se volvía a colgar en cada repintado sobre el MISMO `#lista`, y a
       la tercera vuelta un clic abría tres diálogos de compuerta legal. */
    m.addEventListener('change', async ev => {
          const inp = ev.target;
          if (inp.type !== 'checkbox') return;
          const lbl = inp.closest('[data-mod]');
          if (!lbl) return;
          pintarEstado(inp);
          let evidencia;
          if (inp.checked && lbl.dataset.legal === '1') {
            const r = await pedir([{ nombre: 'evidencia', obligatorio: true,
              etiqueta: 'Referencia del instrumento jurídico que lo autoriza' }],
              'Este módulo exige compuerta legal');
            if (!r) { inp.checked = false; pintarEstado(inp); return; }
            evidencia = r.evidencia;
          }
          try {
            const r = await api.enviar('/api/v1/administracion/sedes/' + sel.value + '/modulos',
              { modulo: lbl.dataset.mod, activo: inp.checked, evidencia });
            avisar(r.mensaje); pintarLista();
          } catch (e) { revertir(inp, e); }
    });
    sel.addEventListener('change', pintarLista);
    pintarLista();
  },

  async equipos(m) {
    const d = await api.obtener('/api/v1/administracion/unidades');
    m.innerHTML = `
      ${cabecera('Equipos corporativos',
        'Contabilidad, Tesorería, Pastoral. Lo que se le otorga al equipo lo hereda cada integrante mientras esté dentro, y se le cae al salir.')}
      ${alerta(d.aviso)}
      <p style="margin-bottom:16px"><button class="ms-btn ms-btn--primario" id="b-eq">+ Crear un equipo</button></p>
      ${tablaMs(d.unidades, [
        { t: 'Unidad', p: u => `<button class="ms-enlace" data-eq="${esc(u.id)}">
            <b>${esc(u.nombre)}</b><span class="ms-doc">${esc(u.codigo)}</span></button>` },
        { t: 'Clase', p: u => `<span class="ms-chip">${esc(u.clase)}</span>` },
        { t: 'Integrantes', p: u => num(u.integrantes) },
        { t: 'Roles', p: u => Number(u.roles) === 0 && u.clase === 'equipo'
            ? '<span class="ms-falta">sin rol</span>' : num(u.roles) },
      ], 'Ningún equipo todavía.', { attr: 'eq', id: u => u.id, que: u => 'el equipo ' + u.nombre })}
      <div id="ficha" style="margin-top:24px"></div>`;

    m.querySelector('#b-eq').addEventListener('click', async () => {
      const r = await pedir([
        { nombre: 'codigo', etiqueta: 'Código', obligatorio: true, ayuda: 'TESORERIA' },
        { nombre: 'nombre', etiqueta: 'Nombre', obligatorio: true },
        { nombre: 'clase', etiqueta: 'Clase', obligatorio: true, opciones: [
          { valor: 'equipo', texto: 'Equipo' }, { valor: 'direccion', texto: 'Dirección' },
          { valor: 'region', texto: 'Región' }] },
        { nombre: 'proposito', etiqueta: 'Propósito (mínimo 15 caracteres)', obligatorio: true },
      ], 'Crear un equipo');
      if (!r) return;
      try { const x = await api.enviar('/api/v1/administracion/unidades', r); pintar().then(() => avisar(x.mensaje)); }
      catch (e) { avisar(e.message, 'roja'); }
    });

    m.addEventListener('click', async ev => {
      const b = ev.target.closest('[data-eq]');
      if (!b) return;
      const z = m.querySelector('#ficha');
      z.innerHTML = cargando;
      try {
        const u = await api.obtener('/api/v1/administracion/unidades/' + b.dataset.eq);
        z.innerHTML = `
          <div class="ms-persona">
            <div class="ms-persona__cab">
              <div><b>${esc(u.unidad.nombre)}</b><span class="ms-doc">${esc(u.unidad.codigo)} · ${esc(u.unidad.clase)}</span></div>
              <div style="display:flex;gap:8px">
                <button class="ms-btn ms-btn--primario" data-rol="${esc(u.unidad.id)}">Otorgar rol</button>
                <button class="ms-btn" data-mie="${esc(u.unidad.id)}">Meter a alguien</button>
              </div>
            </div>
            <div style="padding:12px 16px">
              <p style="margin:0 0 12px;color:var(--tin-mid);font-size:13px">${esc(u.unidad.proposito ?? '')}</p>
              ${alerta(u.aviso, 'roja')}
              <h2 class="ms-h2" style="margin-top:0">Roles del equipo</h2>
              ${tablaMs(u.roles, [
                { t: 'Rol', p: r => `<b>${esc(r.rol_nombre ?? r.rol)}</b>
                    <button class="ms-btn ms-btn--peq" data-revr="${esc(r.id)}" style="margin-top:4px">Revocar</button>` },
                { t: 'Alcance', k: 'alcance_tipo' },
                { t: 'Techo', p: r => niv(r.nivel_max) },
                { t: 'Acta', p: r => r.acta_referencia ? `<code>${esc(r.acta_referencia)}</code>` : '—' },
              ], 'Ninguno: el equipo existe pero no puede hacer nada.')}
              <h2 class="ms-h2">Integrantes</h2>
              ${tablaMs(u.miembros.lista, [
                { t: 'Persona', p: x => `<b>${esc(x.nombre_completo)}</b>${x.hasta ? '' :
                    `<button class="ms-btn ms-btn--peq" data-sac="${esc(u.unidad.id)}|${esc(x.persona_id)}"
                       style="margin-top:4px;display:block">Sacar</button>`}` },
                { t: 'Rol en el equipo', p: x => `<span class="ms-chip">${esc(x.rol_en_unidad)}</span>` },
                { t: 'Desde', k: 'desde' },
                { t: 'Estado', p: x => x.hasta
                    ? `<span class="ms-vig ms-vig--fin">salió ${esc(x.hasta)}</span>`
                    : '<span class="ms-vig ms-vig--ok">activo</span>' },
              ], 'Nadie todavía.')}
              <h2 class="ms-h2">Sedes que alcanza</h2>
              <div class="ms-chips">${u.alcanza.length
                ? u.alcanza.map(s => `<span class="ms-chip">${esc(s.codigo)}</span>`).join('')
                : '<span class="ms-vacio">Ninguna por esta vía.</span>'}</div>
            </div>
          </div>`;
        z.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (e) { z.innerHTML = `<div class="ms-alerta ms-alerta--roja">${esc(e.message)}</div>`; }
    });

    m.addEventListener('click', async ev => {
      const rol = ev.target.closest('[data-rol]'), mie = ev.target.closest('[data-mie]');
      const rev = ev.target.closest('[data-revr]'), sac = ev.target.closest('[data-sac]');
      let dicho = null;
      try {
        if (rol) {
          const r = await pedir([
            { nombre: 'rol', etiqueta: 'Rol', obligatorio: true,
              opciones: (await catalogo()).roles.filter(x => x.activo)
                .map(x => ({ valor: x.codigo, texto: `${x.nombre} · techo N${x.nivel_maximo}` })) },
            { nombre: 'alcanceTipo', etiqueta: 'Alcance', obligatorio: true, valor: 'organizacion', opciones:
              ['organizacion','sede','segmento','grupo','ministerio','unidad'].map(v => ({ valor: v, texto: v })) },
            { nombre: 'alcanceId', etiqueta: 'Iglesia (solo si el alcance es «sede»)',
              vacio: '— toda la organización —', opciones: opcSedes(await sedesDe()) },
            { nombre: 'nivelMax', etiqueta: 'Techo (1 a 4)', obligatorio: true, valor: '3', numero: true },
            { nombre: 'acta', etiqueta: 'Acta que lo autoriza', obligatorio: true },
          ], 'Otorgar un rol al equipo');
          if (!r) return;
          const x = await api.enviar('/api/v1/administracion/unidades/' + rol.dataset.rol + '/roles', r);
          dicho = x.mensaje;
        } else if (mie) {
          const r = await pedir([
            { nombre: 'personaId', etiqueta: 'Persona', obligatorio: true, opciones: await opcPersonas() },
            { nombre: 'rolEnUnidad', etiqueta: 'Qué hace en el equipo', valor: 'integrante',
              opciones: [{ valor: 'integrante', texto: 'Integrante' }, { valor: 'lider', texto: 'Líder' },
                         { valor: 'suplente', texto: 'Suplente' }] },
          ], 'Meter a alguien en el equipo');
          if (!r) return;
          const x = await api.enviar('/api/v1/administracion/unidades/' + mie.dataset.mie + '/miembros', r);
          dicho = x.mensaje;
        } else if (rev) {
          const r = await pedir([{ nombre: 'motivo', etiqueta: 'Motivo (lo pierden todos los integrantes)', obligatorio: true }],
                                'Revocar el rol del equipo');
          if (!r) return;
          const x = await api.enviar('/api/v1/administracion/unidades/roles/' + rev.dataset.revr + '/revocar', r);
          dicho = x.mensaje;
        } else if (sac) {
          const partes = sac.dataset.sac.split('|');
          const r = await pedir([{ nombre: 'motivo', etiqueta: 'Motivo de la salida', obligatorio: true }],
                                'Sacar del equipo');
          if (!r) return;
          const x = await api.enviar('/api/v1/administracion/unidades/' + partes[0] + '/miembros/' + partes[1] + '/salir', r);
          dicho = x.mensaje;
        } else return;
        /* ⛔ El aviso va DESPUÉS del repintado: `pintar()` reemplaza el
           contenedor y se llevaba el mensaje consigo. */
        pintar().then(() => dicho && avisar(dicho));
      } catch (e) { avisar(e.message, 'roja'); }
    });
  },

  async organigrama(m) {
    const d = await api.obtener('/api/v1/administracion/organigrama');
    m.innerHTML = `
      ${cabecera('Organigrama', 'La central, sus regiones, sus direcciones y sus equipos.')}
      ${tablaMs(d.unidades, [
        { t: 'Unidad', p: u => `${'&nbsp;'.repeat(Math.max(0, (u.nivel ?? 0) * 4))}<b>${esc(u.nombre)}</b>` },
        { t: 'Clase', p: u => `<span class="ms-chip">${esc(u.clase)}</span>` },
        { t: 'Código', p: u => `<code>${esc(u.codigo)}</code>` },
        { t: 'Integrantes', p: u => num(u.integrantes) },
        { t: 'Sedes que alcanza', p: u => num(u.sedes_que_alcanza) },
      ])}`;
  },

  async vigilancia(m) {
    const [ses, ale] = await Promise.all([
      api.obtener('/api/v1/administracion/sesiones'),
      api.obtener('/api/v1/administracion/alertas'),
    ]);
    m.innerHTML = `
      ${cabecera('Sesiones y alertas', 'Quién está dentro ahora y quién está probando contraseñas.')}
      ${alerta(ale.aviso, 'ambar')}
      <h2 class="ms-h2">Sesiones abiertas</h2>
      ${tablaMs(ses.sesiones, [
        /* ⛔ La acción va en la PRIMERA celda: en un teléfono, la última
           columna de una tabla que se desplaza de lado no existe. */
        { t: 'Persona', p: x => `<b>${esc(x.persona)}</b><span class="ms-doc">${esc(x.usuario)}</span>
            <button class="ms-btn ms-btn--peq" data-cerrar="${esc(x.sesion)}"
                    style="margin-top:4px">Cerrar esta sesión</button>` },
        { t: 'Desde', p: x => esc(new Date(x.emitida_en).toLocaleString('es-CO')) },
        /* ⛔ `le_queda` llegaba como objeto y se veía «[object Object]» en
           TODAS las filas. Ahora la base lo manda ya formateado. */
        { t: 'Le queda', p: x => `<code>${esc(x.le_queda ?? '—')}</code>` },
        { t: 'Dirección', p: x => `<code>${esc(x.ip ?? '—')}</code>` },
      ], 'Nadie dentro.')}
      <h2 class="ms-h2">Intentos fallidos</h2>
      ${tablaMs(ale.alertas, [
        { t: 'Usuario', k: 'usuario' },
        { t: 'Dirección', p: x => `<code>${esc(x.ip ?? '—')}</code>` },
        { t: 'Intentos', p: x => `<span class="ms-niv ms-niv--4">${esc(x.intentos_fallidos)}</span>` },
      ], 'Ninguno.')}`;

    m.addEventListener('click', async ev => {
      const b = ev.target.closest('[data-cerrar]');
      if (!b) return;
      const r = await pedir([{ nombre: 'motivo', obligatorio: true,
        etiqueta: 'Motivo · queda en la auditoría' }], 'Cerrarle la sesión a esta persona');
      if (!r) return;
      try {
        const x = await api.enviar('/api/v1/administracion/sesiones/' + b.dataset.cerrar + '/cerrar', r);
        pintar().then(() => avisar(x.mensaje));
      } catch (e) { avisar(e.message, 'roja'); }
    });
  },

  async bitacora(m) {
    const [aud, lec] = await Promise.all([
      api.obtener('/api/v1/administracion/auditoria?limite=100'),
      api.obtener('/api/v1/administracion/lecturas?limite=100'),
    ]);
    m.innerHTML = `
      ${cabecera('Quién hizo y quién miró',
        'La auditoría registra los cambios. La bitácora de lectura existe para que mirar por curiosidad tenga nombre y hora.')}
      <h2 class="ms-h2">Lecturas de datos sensibles</h2>
      ${tablaMs(lec.lecturas, [
        { t: 'Cuándo', p: x => esc(new Date(x.ocurrido_en).toLocaleString('es-CO')) },
        { t: 'Quién', p: x => `<b>${esc(x.actor ?? '—')}</b>` },
        { t: 'Qué', p: x => `<code>${esc(x.esquema)}.${esc(x.tabla)}</code> ${niv(x.nivel)}` },
        { t: 'Motivo', p: x => `<span style="color:var(--tin-mid)">${esc(x.motivo ?? '')}</span>` },
      ], 'Ninguna lectura sensible registrada.')}
      <h2 class="ms-h2">Cambios</h2>
      ${tablaMs(aud.movimientos, [
        { t: 'Cuándo', p: x => esc(new Date(x.ocurrido_en).toLocaleString('es-CO')) },
        { t: 'Quién', p: x => esc(x.actor ?? 'sistema') },
        { t: 'Qué', p: x => `<code>${esc(x.esquema)}.${esc(x.tabla)}</code>` },
        { t: 'Operación', p: x => `<span class="ms-chip">${esc({ I: 'creó', U: 'cambió', D: 'borró' }[x.operacion] ?? x.operacion)}</span>` },
      ], 'Sin movimientos.')}`;
  },
});

/* ── Piezas compartidas de las cuentas ────────────────────────────── */
/* La primera columna es el enlace a la ficha: la fila entera lleva a
   algún lado, que era justo lo que faltaba.
   ⛔ El estado y el bloqueo son dos cosas distintas, pero cuando una
      cuenta está BLOQUEADA el estado ya lo dice: mostrar las dos daba
      «bloqueada bloqueada» en la pantalla. */
const COLS_CUENTA = [
  { t: 'Persona', p: x => `<button class="ms-enlace" data-persona="${esc(x.persona_id)}">
      <b>${esc(x.persona)}</b><span class="ms-doc">${esc(x.usuario)}</span></button>` },
  { t: 'Iglesia', p: x => esc(x.sede ?? '—') },
  { t: 'Estado', p: x => `
      ${x.estado === 'activa' && !x.bloqueada ? '<span class="ms-vig ms-vig--ok">activa</span>' : ''}
      ${x.bloqueada ? '<span class="ms-vig ms-vig--porvencer">bloqueada</span>'
        : (x.estado !== 'activa' ? `<span class="ms-vig ms-vig--fin">${esc(x.estado)}</span>` : '')}
      ${x.debe_cambiar_clave ? '<span class="ms-chip">clave provisional</span>' : ''}` },
  { t: 'Segundo factor', p: x => !x.exige_segundo_factor ? '<span class="ms-vacio">no lo exige</span>'
      : x.segundo_factor_activo ? '<span class="ms-vig ms-vig--ok">activo</span>'
      : '<span class="ms-falta">SIN activar</span>' },
  { t: 'Último ingreso', p: x => x.ultimo_ingreso
      ? esc(new Date(x.ultimo_ingreso).toLocaleDateString('es-CO')) : '<span class="ms-vacio">nunca</span>' },
  { t: 'Roles', p: x => x.roles ? `<span style="color:var(--tin-mid)">${esc(x.roles)}</span>`
      : '<span class="ms-falta">ninguno</span>' },
];

/* ── Ficha de una persona ───────────────────────────────────────────
   Todo lo que se puede saber y hacer con alguien, en un solo sitio:
   su cuenta, sus roles, sus equipos y las tres operaciones que el
   equipo de la central hace a diario. */
async function abrirPersona(id) {
  const esperando = fichaAbrir('Cargando…', '', cargando);
  try {
    const f = await api.obtener('/api/v1/administracion/personas/' + id);
    esperando.remove();
    const p = f.persona, c = f.cuenta;
    const z = fichaAbrir(p.nombre_completo,
      [p.sede_nombre ?? p.sede, p.numero_documento ? p.tipo_documento + ' ' + p.numero_documento : null,
       p.edad != null ? p.edad + ' años' : null].filter(Boolean).join(' · '), `
      ${alerta(f.aviso)}
      ${p.es_menor ? alerta('Es MENOR DE EDAD: su ficha es N4 y toda lectura queda registrada con nombre y fecha.', 'ambar') : ''}
      <h2 class="ms-h2" style="margin-top:0">Su cuenta</h2>
      ${c ? `
        <div class="ms-modcard">
          <div class="ms-modcard__fila"><span class="ms-lbl">Usuario</span><span class="ms-val mono">${esc(c.usuario)}</span></div>
          <div class="ms-modcard__fila"><span class="ms-lbl">Estado</span><span class="ms-val">
            ${c.bloqueada ? '<span class="ms-vig ms-vig--porvencer">bloqueada</span>'
              : `<span class="ms-vig ms-vig--${c.estado === 'activa' ? 'ok' : 'fin'}">${esc(c.estado)}</span>`}</span></div>
          <div class="ms-modcard__fila"><span class="ms-lbl">Segundo factor</span><span class="ms-val">
            ${!c.exige_segundo_factor ? 'no se le exige'
              : c.segundo_factor_activo ? '<span class="ms-vig ms-vig--ok">activo</span>'
              : '<span class="ms-falta">SIN activar</span>'}</span></div>
          <div class="ms-modcard__fila"><span class="ms-lbl">Contraseña</span><span class="ms-val">
            ${c.debe_cambiar_clave ? '<span class="ms-falta">provisional · no la ha cambiado</span>' : 'suya'}</span></div>
          <div class="ms-modcard__fila"><span class="ms-lbl">Último ingreso</span><span class="ms-val">
            ${c.ultimo_ingreso ? esc(new Date(c.ultimo_ingreso).toLocaleString('es-CO')) : 'nunca ha entrado'}</span></div>
        </div>
        <div class="ms-acciones" style="margin:12px 0 4px">
          <button class="ms-btn" data-cl="${esc(c.cuenta_id)}">Nueva contraseña</button>
          ${c.bloqueada ? `<button class="ms-btn" data-db="${esc(c.cuenta_id)}">Desbloquear</button>` : ''}
          <button class="ms-btn" data-mfa="${esc(c.cuenta_id)}">Reiniciar segundo factor</button>
        </div>`
      : `<p class="ms-vacio">No tiene cuenta: existe en el sistema pero no puede entrar.</p>
         <button class="ms-btn ms-btn--primario" id="f-cuenta">Crearle una cuenta</button>`}

      <h2 class="ms-h2">Roles vigentes</h2>
      ${tablaMs(f.roles, [
        { t: 'Rol', p: r => `<b>${esc(r.rol_nombre ?? r.rol)}</b><span class="ms-doc">${esc(r.rol)}</span>
            <button class="ms-btn ms-btn--peq" data-revp="${esc(r.id)}" style="margin-top:4px">Revocar</button>` },
        { t: 'Alcance', p: r => esc(r.alcance_tipo) },
        { t: 'Techo', p: r => niv(r.nivel_max) },
        { t: 'Desde', k: 'desde' },
        { t: 'Acta', p: r => r.acta_referencia ? `<code>${esc(r.acta_referencia)}</code>`
            : '<span class="ms-falta">sin acta</span>' },
      ], 'Ninguno: entra al sistema y no ve nada.')}
      <button class="ms-btn ms-btn--primario" id="f-otorgar" style="margin-top:8px">+ Otorgar un rol</button>

      <h2 class="ms-h2">Equipos a los que pertenece</h2>
      ${tablaMs(f.equipos ?? [], [
        { t: 'Equipo', p: e => `<b>${esc(e.unidad ?? e.nombre)}</b>` },
        { t: 'Qué hace', p: e => `<span class="ms-chip">${esc(e.rol_en_unidad ?? '')}</span>` },
        { t: 'Desde', k: 'desde' },
      ], 'Ninguno. Lo que herede de un equipo aparecería aquí.')}`);

    engancharCuentas(z, () => { z.remove(); abrirPersona(id); });
    z.querySelector('#f-otorgar').addEventListener('click', async () => {
      const cat = await catalogo();
      const r = await pedir([
        { nombre: 'rol', etiqueta: 'Rol', obligatorio: true,
          opciones: cat.roles.filter(x => x.activo)
            .map(x => ({ valor: x.codigo, texto: `${x.nombre} · techo N${x.nivel_maximo} · ${x.alcance_maximo}` })) },
        { nombre: 'alcanceTipo', etiqueta: 'Alcance', obligatorio: true, valor: 'sede',
          opciones: ['persona_propia','grupo','ministerio','segmento','sede','unidad','organizacion']
            .map(v => ({ valor: v, texto: v })) },
        { nombre: 'alcanceId', etiqueta: 'Iglesia (solo si el alcance es «sede»)',
          vacio: '— no aplica —', opciones: opcSedes(await sedesDe()) },
        { nombre: 'acta', etiqueta: 'Acta que lo autoriza', obligatorio: true },
      ], 'Otorgar un rol a ' + p.nombre_completo);
      if (!r) return;
      try {
        await api.enviar('/api/v1/identidad/personas/' + id + '/otorgar', { roles: [r] });
        avisar('Rol otorgado.'); z.remove(); abrirPersona(id);
      } catch (e) { avisar(e.message, 'roja'); }
    });
    z.querySelectorAll('[data-revp]').forEach(b => b.addEventListener('click', async () => {
      /* ⛔ El motivo se PIDE y se MANDA. Antes se preguntaba en algunas
         pantallas y no viajaba en la petición: la auditoría se quedaba
         sin la única respuesta que busca, «por qué se le quitó». */
      const r = await pedir([{ nombre: 'motivo', obligatorio: true,
        etiqueta: 'Motivo · queda en su ficha y en la auditoría' }],
        'Quitarle el rol a ' + p.nombre_completo);
      if (!r) return;
      try {
        const x = await api.borrar('/api/v1/identidad/asignaciones/' + b.dataset.revp, { motivo: r.motivo });
        avisar(x.mensaje ?? 'Rol revocado.'); z.remove(); abrirPersona(id);
      } catch (e) { avisar(e.message, 'roja'); }
    }));
    z.querySelector('#f-cuenta')?.addEventListener('click', () => { z.remove(); location.hash = '#/crear'; });
  } catch (e) {
    esperando.remove();
    fichaAbrir('No se pudo abrir', '', `<div class="ms-alerta ms-alerta--roja">${esc(e.message)}</div>`);
  }
}

function claveProvisional(clave, mensaje) {
  return `<div class="ms-alerta ms-alerta--verde" style="margin-top:12px">
    <b>Contraseña provisional · se muestra una sola vez</b>
    <div class="mono" style="font-size:16px;margin:8px 0;padding:8px;background:var(--sup);
         border:1px solid var(--fil);border-radius:var(--r);word-break:break-word">${esc(clave)}</div>
    <div style="font-size:12px">${esc(mensaje ?? '')}</div>
    <button class="ms-btn" data-copiar="${esc(clave)}" style="margin-top:8px">Copiar</button>
  </div>`;
}

function engancharCopiar(m) {
  m.querySelectorAll('[data-copiar]').forEach(b => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copiar); avisar('Copiada.'); }
    catch { avisar('Su navegador no dejó copiar: selecciónela a mano.', 'ambar'); }
  }));
}

function engancharCuentas(m, alTerminar) {
  const refrescar = alTerminar ?? pintar;
  m.querySelectorAll('[data-cl],[data-db],[data-mfa]').forEach(b => b.addEventListener('click', async () => {
    try {
      if (b.dataset.cl) {
        if (!confirm('Se genera una contraseña provisional NUEVA y se cierran todas sus sesiones. ¿Seguir?')) return;
        const r = await api.enviar('/api/v1/administracion/cuentas/' + b.dataset.cl + '/reiniciar-clave', {});
        /* ⛔ La contraseña se muestra UNA vez: se pinta donde el
           administrador está mirando, no detrás de la ficha abierta. */
        const destino = m.querySelector('.ms-ficha__cuerpo') ?? document.getElementById('ms-main');
        const z = document.createElement('div');
        z.innerHTML = claveProvisional(r.clave_provisional, r.mensaje);
        destino.prepend(z.firstElementChild);
        engancharCopiar(destino);
        return;
      }
      if (b.dataset.db) {
        const r = await api.enviar('/api/v1/administracion/cuentas/' + b.dataset.db + '/desbloquear', {});
        avisar(r.mensaje);
      }
      if (b.dataset.mfa) {
        if (!confirm('Se borra su segundo factor y se cierran sus sesiones. Lo volverá a configurar al entrar. ¿Seguir?')) return;
        const r = await api.enviar('/api/v1/administracion/cuentas/' + b.dataset.mfa + '/reiniciar-segundo-factor', {});
        avisar(r.mensaje);
      }
      refrescar();
    } catch (e) { avisar(e.message, 'roja'); }
  }));
}

arrancar();
