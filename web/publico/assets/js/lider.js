/* ============================================================
   CASA ROCA · APP DEL LÍDER — Capa 1 (Líder de grupo pequeño)
   Layout estilo CRM (Salesforce/HubSpot):
   - Encabezado de registro (el grupo) persistente con acción principal
   - Navegación lateral por pestañas: Resumen · Mi grupo · Análisis · Notificaciones
   - El contenido cambia al hacer clic (sin recargar la página)
   Usa window.LANDING, window.DB y window.STORE. Sin frameworks.
   ============================================================ */
(function () {
  const L = window.LANDING;
  const DB = window.DB;
  const S = window.STORE;
  const DS = window.DSTORE; // datos del ministerio (lo que publica el director): temáticas + peticiones

  /* ---- Identidad del líder demo (Google se conecta después) ---- */
  const GRUPO_ID = "af_j25_cafe";
  const LIDER = { nombre: "Daniel Garzón", email: "lider.demo@example.org", iniciales: "DG" };

  /* ---- Estado de la app ---- */
  const estado = { tab: "resumen", filtroGrupo: "todos", busqueda: "", filtroPet: "todas" };
  let sesion = false;
  let clickBound = false;
  let temDrill = null;          // id de la temática abierta en el detalle (solo lectura)
  const orando = {};            // id de petición -> me uní en oración (local)
  let verifCurso = null;        // { insId, key } curso con barra de verificación abierta

  /* ------------------------------------------------------------ utils */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const app = () => document.getElementById("ld-app");

  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const ETAPAS = {
    conoce: { lbl: "Conoce" }, conecta: { lbl: "Conéctate" }, crece: { lbl: "Crece" }, sirve: { lbl: "Sirve" }
  };
  // Formación: cursos cortos + Institutos (IBLI/FACTER). Orden del recorrido.
  const FORMACION = [
    { key: "adn", lbl: "ADN" },
    { key: "bautizo", lbl: "Bautizo" },
    { key: "madurez", lbl: "Madurez" },
    { key: "llaves", lbl: "Llaves" },
    { key: "ibli", lbl: "IBLI" },
    { key: "facter", lbl: "FACTER" }
  ];
  const FORM_ESTADO = {
    ok: { cls: "ok", ico: "✓", txt: "Completado" },
    curso: { cls: "curso", ico: "•", txt: "En curso" },
    pend: { cls: "pend", ico: "", txt: "Pendiente" }
  };
  // Devuelve la fila de chips de formación para la ficha de una persona.
  // El líder toca un curso → aparece la barra de verificación para activarlo.
  function formacionHTML(p) {
    const cursos = (p && p.cursos) || {};
    const hechos = FORMACION.filter(c => cursos[c.key] === "ok").length;
    const chips = FORMACION.map(c => {
      const est = FORM_ESTADO[cursos[c.key]] || FORM_ESTADO.pend;
      const sel = verifCurso && verifCurso.insId === p.id && verifCurso.key === c.key;
      return `<button type="button" class="ld-form__chip ld-form__chip--${est.cls}${sel ? " is-sel" : ""}" data-accion="curso-sel" data-id="${p.id}" data-key="${c.key}" aria-pressed="${cursos[c.key] === "ok"}" title="${c.lbl}: ${est.txt} · toca para verificar">${est.ico ? `<i class="ld-form__ic">${est.ico}</i>` : ""}${esc(c.lbl)}</button>`;
    }).join("");
    let confirmBar = "";
    if (verifCurso && verifCurso.insId === p.id) {
      const c = FORMACION.find(x => x.key === verifCurso.key);
      const ya = cursos[verifCurso.key] === "ok";
      confirmBar = `
        <div class="ld-form__confirm">
          <span class="ld-form__q">${ya
            ? `¿Quitar la verificación de <b>${esc(c.lbl)}</b>?`
            : `¿<b>${esc(nombreCompleto(p))}</b> completó <b>${esc(c.lbl)}</b>?`}</span>
          <div class="ld-form__cacts">
            <button type="button" class="ld-btn ld-btn--ghost ld-btn--sm" data-accion="curso-cancel">Cancelar</button>
            ${ya
              ? `<button type="button" class="ld-btn ld-btn--ghost ld-btn--sm" data-accion="curso-set" data-id="${p.id}" data-key="${verifCurso.key}" data-val="pend">Quitar ✓</button>`
              : `<button type="button" class="ld-btn ld-btn--ok ld-btn--sm" data-accion="curso-set" data-id="${p.id}" data-key="${verifCurso.key}" data-val="ok">✓ Sí, lo verifico</button>`}
          </div>
        </div>`;
    }
    return `
      <div class="ld-form">
        <div class="ld-form__head"><span class="ld-form__t">🎓 Formación</span><span class="ld-form__n">${hechos}/${FORMACION.length}</span></div>
        <div class="ld-form__chips">${chips}</div>
        ${confirmBar}
      </div>`;
  }
  const iniciales = p => ((p.nombres || "")[0] || "") + ((p.apellidos || "")[0] || "");
  const nombreCompleto = p => `${p.nombres || ""} ${p.apellidos || ""}`.trim();

  function diasHastaCumple(mes, dia) {
    if (!mes || !dia) return null;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    let prox = new Date(hoy.getFullYear(), mes - 1, dia);
    if (prox < hoy) prox = new Date(hoy.getFullYear() + 1, mes - 1, dia);
    return Math.round((prox - hoy) / 86400000);
  }
  function diasDesde(iso) {
    if (!iso) return 999;
    const d = new Date(iso); const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    return Math.round((hoy - d) / 86400000);
  }
  function fechaCorta(iso) {
    if (!iso) return "—";
    const d = new Date(iso); return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
  }
  function docIco(nombre) {
    const ext = String(nombre || "").split(".").pop().toLowerCase();
    if (ext === "pdf") return "📕";
    if (["doc", "docx"].includes(ext)) return "📘";
    if (["xls", "xlsx", "csv"].includes(ext)) return "📊";
    if (["ppt", "pptx", "key"].includes(ext)) return "📙";
    if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "🖼️";
    if (["mp3", "wav", "m4a"].includes(ext)) return "🎵";
    if (["mp4", "mov", "avi", "mkv"].includes(ext)) return "🎬";
    if (["zip", "rar", "7z"].includes(ext)) return "🗜️";
    return "📄";
  }
  function fmtPeso(b) {
    if (!b || isNaN(b)) return "";
    if (b < 1024) return b + " B";
    if (b < 1048576) return (b / 1024).toFixed(0) + " KB";
    return (b / 1048576).toFixed(1) + " MB";
  }

  /* ----------------------------------------- enlaces correo / WhatsApp */
  function waLink(p) {
    const n = (p.nombres || "").split(" ")[0];
    const msg = `Hola ${n}, soy Daniel, líder del grupo "Café & Palabra" de Casa Roca 🙌 `
      + `Vi que te inscribiste y quiero darte la bienvenida. ¿Cómo estás? `
      + `Nos reunimos los jueves 7:00 pm en el Café del Norte (Chicó). ¡Me encantaría conocerte!`;
    return `https://wa.me/${S.soloDigitos(p.telefono)}?text=${encodeURIComponent(msg)}`;
  }
  function mailLink(p) {
    const n = (p.nombres || "").split(" ")[0];
    const asunto = "Bienvenido(a) a Café & Palabra · Casa Roca";
    const cuerpo = `Hola ${n},\n\nSoy Daniel, líder del grupo "Café & Palabra".\n`
      + `Gracias por inscribirte. Nos reunimos los jueves a las 7:00 pm en el Café del Norte (Chicó).\n`
      + `Cualquier cosa, aquí estoy para acompañarte.\n\nUn abrazo,\nDaniel Garzón`;
    return `mailto:${p.correo}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
  }

  /* ---- métricas derivadas (para badges y KPIs) ---- */
  function metrics() {
    const ins = S.inscritos(GRUPO_ID);
    const nuevos = ins.filter(p => diasDesde(p.fechaInscripcion) <= 7).length;
    const sinContactar = ins.filter(p => !p.contactado).length;
    const cumplesProx = ins.filter(p => { const d = diasHastaCumple(p.cumpleMes, p.cumpleDia); return d !== null && d <= 30; }).length;
    const nuevosSC = ins.filter(p => !p.contactado && diasDesde(p.fechaInscripcion) <= 7).length;
    return { ins, nuevos, sinContactar, cumplesProx, nuevosSC, notisTotal: cumplesProx + nuevosSC };
  }

  /* ============================================================ LOGIN */
  function vistaLogin() {
    return `
    <div class="ld-login">
      <div class="ld-login__card">
        <div class="ld-login__logo">CR</div>
        <h1>Panel del Líder</h1>
        <p>Acompaña a las personas de tu grupo pequeño. Entra con tu cuenta para ver a quienes se inscribieron contigo.</p>
        <button class="ld-google" id="ld-google">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Continuar con Google
        </button>
        <div class="ld-login__nota">
          🔒 Demo Fase 0 — la conexión real con Google se configurará después.
          Entrarás como <b>${esc(LIDER.nombre)}</b>, líder de <b>Café & Palabra</b>.
        </div>
      </div>
    </div>`;
  }

  /* ====================================================== SHELL / CRM */
  function grupoInfo() {
    const a = L.afinidad(GRUPO_ID);
    return { a, m: DB.ministerio(a.min) };
  }

  function vistaApp() {
    return `
      <div class="ld-shell">
        ${topbar()}
        ${recordHeader()}
        <div class="ld-body">
          ${sidebar()}
          <main class="ld-content" id="ld-content">${contenido()}</main>
        </div>
      </div>`;
  }

  function topbar() {
    return `
    <header class="ld-topbar">
      <div class="ld-brand">
        <div class="ld-brand__logo">CR</div>
        <div class="ld-brand__txt"><b>Casa Roca</b><small>Panel del Líder</small></div>
      </div>
      <div class="ld-topbar__sp"></div>
      <div class="ld-user">
        <div class="ld-user__name">${esc(LIDER.nombre)}<span>Líder de grupo</span></div>
        <div class="ld-avatar" title="${esc(LIDER.nombre)}">${esc(LIDER.iniciales)}</div>
        <button class="ld-btn ld-btn--ghost ld-btn--sm" data-accion="salir" title="Cerrar sesión">Salir</button>
      </div>
    </header>`;
  }

  /* Encabezado de registro (el grupo) — persistente en todas las pestañas */
  function recordHeader() {
    const { a, m } = grupoInfo();
    const cerrado = S.cerrado(GRUPO_ID);
    const efect = S.miembrosEfectivos(GRUPO_ID);
    const cupo = S.cupo(GRUPO_ID);
    const disp = S.disponible(GRUPO_ID);
    const pctCupo = cupo ? Math.min(100, Math.round((efect / cupo) * 100)) : 0;
    return `
    <section class="ld-record">
      <div class="ld-record__in">
        <div class="ld-record__main">
          <div class="ld-record__eyebrow">${m ? esc(m.ico + " " + m.nombre) : "Grupo pequeño"} · Grupo de afinidad</div>
          <h1 class="ld-record__title">${esc(a.nombre)}
            <span class="ld-statusbadge ld-statusbadge--${cerrado ? "cerrado" : "abierto"}">${cerrado ? "🔒 Cerrado" : "🟢 Abierto"}</span>
          </h1>
          <div class="ld-record__pills">
            <span class="ld-record__pill">📅 ${esc(a.dia)} ${esc(a.hora)}</span>
            <span class="ld-record__pill">📍 ${esc(a.lugar)}</span>
            <span class="ld-record__pill">🧭 ${esc(a.modalidad)}</span>
          </div>
        </div>
        <div class="ld-record__side">
          <div class="ld-record__cupo"><b>${efect}/${cupo}</b> personas · ${disp} ${disp === 1 ? "cupo libre" : "cupos libres"}
            <div class="ld-recbar ${cerrado ? "is-cerrado" : ""}"><i style="width:${pctCupo}%"></i></div>
          </div>
          <button class="ld-btn ${cerrado ? "ld-btn--ok" : "ld-btn--danger"}" data-accion="toggle-bloqueo">
            ${cerrado ? "🔓 Reabrir inscripciones" : "🔒 Bloquear inscripciones"}
          </button>
        </div>
      </div>
    </section>`;
  }

  /* Navegación por pestañas */
  function sidebar() {
    const mtr = metrics();
    const item = (id, ico, lbl, badge, alerta) => `
      <button class="ld-nav__item ${estado.tab === id ? "is-active" : ""}" data-accion="tab" data-tab="${id}" aria-current="${estado.tab === id ? "page" : "false"}">
        <span class="ld-nav__ic" aria-hidden="true">${ico}</span>
        <span class="ld-nav__lbl">${lbl}</span>
        ${badge ? `<span class="ld-nav__badge ${alerta ? "ld-nav__badge--alerta" : ""}">${badge}</span>` : ""}
      </button>`;
    return `
    <aside class="ld-side">
      <nav class="ld-nav" aria-label="Secciones del grupo">
        ${item("resumen", "🏠", "Resumen", "", false)}
        ${item("grupo", "👥", "Mi grupo", mtr.ins.length, false)}
        ${item("tematicas", "📚", "Temáticas", DS ? DS.tematicas().length : "", false)}
        ${item("peticiones", "🙏", "Peticiones", DS ? (DS.peticiones().filter(p => p.estado !== "respondida").length || "") : "", false)}
        ${item("analisis", "📊", "Análisis", "", false)}
        ${item("notis", "🔔", "Notificaciones", mtr.notisTotal || "", mtr.notisTotal > 0)}
      </nav>
      <div class="ld-side__hr"></div>
      <div class="ld-side__hint">Casa Roca · una casa cálida y segura</div>
    </aside>`;
  }

  /* Router de contenido por pestaña */
  function contenido() {
    switch (estado.tab) {
      case "grupo": return vistaGrupo();
      case "tematicas": return vistaTematicas();
      case "peticiones": return vistaPeticiones();
      case "analisis": return vistaAnalisis();
      case "notis": return vistaNotis();
      default: return vistaResumen();
    }
  }

  /* ------------------------------------------------- TAB: RESUMEN */
  function vistaResumen() {
    const { ins, nuevos, sinContactar } = metrics();
    const disp = S.disponible(GRUPO_ID);
    const cerrado = S.cerrado(GRUPO_ID);
    return `
      <div class="ld-view-head"><h2>🏠 Resumen</h2><p>Una mirada rápida a tu grupo y lo que pide tu atención.</p></div>

      <div class="ld-kpis">
        <div class="ld-kpi"><div class="ld-kpi__n">${ins.length}</div><div class="ld-kpi__l">Inscritos en total</div></div>
        <div class="ld-kpi"><div class="ld-kpi__n">${disp}</div><div class="ld-kpi__l">Cupos disponibles</div></div>
        <div class="ld-kpi ${nuevos ? "ld-kpi--alerta" : ""}"><div class="ld-kpi__n">${nuevos}</div><div class="ld-kpi__l">Nuevos (7 días)</div></div>
        <div class="ld-kpi ${sinContactar ? "ld-kpi--alerta" : ""}"><div class="ld-kpi__n">${sinContactar}</div><div class="ld-kpi__l">Sin contactar</div></div>
      </div>

      <div class="ld-estado ld-estado--${cerrado ? "cerrado" : "abierto"}">
        <div class="ld-estado__info">
          <div class="ld-estado__t">${cerrado ? "🔒 Inscripciones cerradas" : "🟢 Inscripciones abiertas"}</div>
          <div class="ld-estado__d">${cerrado
            ? "Tu grupo aparece como <b>cerrado</b> en el landing. Nadie más puede inscribirse."
            : "Cualquiera puede inscribirse desde el landing. Se refleja al instante aquí."}</div>
        </div>
        <button class="ld-btn ${cerrado ? "ld-btn--ok" : "ld-btn--danger"}" data-accion="toggle-bloqueo">
          ${cerrado ? "🔓 Reabrir" : "🔒 Bloquear"}
        </button>
      </div>

      <section class="ld-card ld-ia" style="margin-top:14px">
        <div class="ld-ia__head"><span class="ld-ia__badge">✦ IA Pastoral</span></div>
        <div class="ld-ia__sub">Sugerencias para estar muy cerca de quienes se inscribieron contigo.</div>
        ${recomendaciones(ins)}
      </section>`;
  }

  /* ------------------------------------------------- TAB: MI GRUPO */
  function vistaGrupo() {
    const ins = filtrarYBuscar(S.inscritos(GRUPO_ID));
    const total = S.inscritos(GRUPO_ID).length;
    const f = estado.filtroGrupo;
    return `
      <div class="ld-view-head"><h2>👥 Mi grupo <span style="font:500 13px Inter,sans-serif;color:var(--texto-tenue)">· ${total} ${total === 1 ? "persona" : "personas"}</span></h2>
        <p>Las personas que se inscribieron contigo. Conéctate por correo o WhatsApp en un toque.</p></div>
      <div class="ld-toolbar">
        <input class="ld-search" id="ld-search" type="search" placeholder="Buscar por nombre…" aria-label="Buscar persona" value="${esc(estado.busqueda)}">
        <div class="ld-segment" role="tablist" aria-label="Filtrar">
          <button class="${f === "todos" ? "is-active" : ""}" data-accion="filtro" data-filtro="todos">Todos</button>
          <button class="${f === "nuevos" ? "is-active" : ""}" data-accion="filtro" data-filtro="nuevos">Nuevos</button>
          <button class="${f === "sin" ? "is-active" : ""}" data-accion="filtro" data-filtro="sin">Sin contactar</button>
        </div>
      </div>
      ${ins.length ? `<div class="ld-people" id="ld-people">${ins.map(personaCard).join("")}</div>`
        : `<div class="ld-empty">No hay personas que coincidan con tu búsqueda o filtro.</div>`}`;
  }

  function filtrarYBuscar(arr) {
    let r = arr.slice();
    if (estado.filtroGrupo === "nuevos") r = r.filter(p => diasDesde(p.fechaInscripcion) <= 7);
    else if (estado.filtroGrupo === "sin") r = r.filter(p => !p.contactado);
    const q = estado.busqueda.trim().toLowerCase();
    if (q) r = r.filter(p => nombreCompleto(p).toLowerCase().includes(q));
    return r;
  }

  /* ------------------------------------------------- TAB: ANÁLISIS */
  function vistaAnalisis() {
    const ins = S.inscritos(GRUPO_ID);
    return `
      <div class="ld-view-head"><h2>📊 Análisis del grupo</h2><p>Quiénes son y en qué etapa del recorrido (4C) están.</p></div>
      <div class="ld-analytics">
        ${cardEdades(ins)}
        ${cardEtapas(ins)}
      </div>`;
  }

  /* ------------------------------------------------- TAB: NOTIS */
  function vistaNotis() {
    const ins = S.inscritos(GRUPO_ID);
    return `
      <div class="ld-view-head"><h2>🔔 Notificaciones</h2><p>Cumpleaños cercanos y personas nuevas que aún no contactas.</p></div>
      <div class="ld-notis">${notificaciones(ins)}</div>`;
  }

  /* ------------------------------------------------- TAB: TEMÁTICAS (solo lectura) */
  /* El líder VE el material que publica su director. No puede crear, editar,
     subir ni eliminar: es viewer del contenido del ministerio (DSTORE). */
  function vistaTematicas() {
    if (!DS) return `<div class="ld-view-head"><h2>📚 Temáticas</h2></div><div class="ld-empty">No hay material disponible por ahora.</div>`;
    if (temDrill) return vistaTematicaDetalle();
    const tem = DS.tematicas();
    return `
      <div class="ld-view-head"><h2>📚 Temáticas y material</h2>
        <p>El contenido y los recursos que tu director publica para los grupos. Toca una para ver y descargar el material.</p></div>
      <div class="ld-viewer">👁️ <b>Solo lectura.</b> Este material lo prepara y comparte tu director de ministerio.</div>
      ${tem.length ? `<div class="ld-tem-list">${tem.map(tematicaCard).join("")}</div>`
        : `<div class="ld-empty">Tu director aún no ha publicado temáticas. Aparecerán aquí en cuanto las comparta.</div>`}`;
  }

  function tematicaCard(t) {
    const nDocs = (t.docs || []).length;
    return `
      <article class="ld-tem ld-tem--click" data-accion="ver-tematica" data-id="${t.id}" role="button" tabindex="0">
        <div class="ld-tem__ico">${t.ico || "📚"}</div>
        <div class="ld-tem__body">
          <div class="ld-tem__top"><b>${esc(t.titulo)}</b><span class="ld-pill">${esc(t.tipo || "Material")}</span></div>
          <p class="ld-tem__desc">${esc(t.desc || "")}</p>
          <div class="ld-tem__meta">🎯 ${esc(t.dirigidoA || "Todos")} · 📅 ${fechaCorta(t.fecha)} · 📎 ${nDocs} doc${nDocs === 1 ? "" : "s"}</div>
        </div>
        <div class="ld-tem__chev" aria-hidden="true">›</div>
      </article>`;
  }

  function vistaTematicaDetalle() {
    const t = DS.tematica(temDrill);
    if (!t) { temDrill = null; return vistaTematicas(); }
    const docs = t.docs || [];
    const filas = docs.map(d => `
      <div class="ld-doc-row">
        <span class="ld-doc-ico">${docIco(d.archivo)}</span>
        <div class="ld-doc-main"><b>${esc(d.nombre || d.archivo)}</b>
          <small>${esc(d.archivo || "")}${d.peso ? " · " + fmtPeso(d.peso) : ""} · ${fechaCorta(d.fecha)}${d.por ? " · por " + esc(d.por) : ""}</small>
          ${d.nota ? `<p class="ld-doc-nota">${esc(d.nota)}</p>` : ""}</div>
        <div class="ld-doc-acts">
          <button class="ld-btn ld-btn--ghost ld-btn--sm" data-accion="ver-doc" data-id="${d.id}" data-tem="${t.id}">👁️ Ver</button>
        </div>
      </div>`).join("");
    return `
      <div class="ld-detail-top"><button class="ld-btn ld-btn--ghost ld-btn--sm" data-accion="tem-volver">← Volver a temáticas</button></div>
      <div class="ld-card ld-tem-detail">
        <div class="ld-tem-detail__head">
          <div class="ld-tem-detail__ico">${t.ico || "📚"}</div>
          <div>
            <h2 style="margin:0">${esc(t.titulo)}</h2>
            <div class="ld-tem__meta"><span class="ld-pill">${esc(t.tipo || "Material")}</span> 🎯 ${esc(t.dirigidoA || "Todos")} · 📅 ${fechaCorta(t.fecha)}</div>
          </div>
        </div>
        <p class="ld-tem-detail__desc">${esc(t.desc || "Sin descripción.")}</p>
      </div>
      <div class="ld-view-head" style="margin-top:14px"><h2>📎 Material (${docs.length})</h2>
        <p>Guías, presentaciones, audios o recursos de esta temática. Disponibles para tu grupo.</p></div>
      <div class="ld-doc-list">${filas || '<div class="ld-empty">Tu director aún no ha subido material a esta temática.</div>'}</div>`;
  }

  /* ------------------------------------------------- TAB: PETICIONES */
  /* El líder VE las peticiones del ministerio, crea las propias (se sincronizan
     con el director vía DSTORE) y puede unirse en oración. */
  function vistaPeticiones() {
    if (!DS) return `<div class="ld-view-head"><h2>🙏 Peticiones</h2></div><div class="ld-empty">No hay peticiones disponibles por ahora.</div>`;
    const todas = DS.peticiones();
    let pets = todas;
    if (estado.filtroPet !== "todas") pets = todas.filter(p => p.estado === estado.filtroPet);
    const elbl = { abierta: "Abierta", orando: "Orando", respondida: "Respondida" };
    const filtros = ["todas", "abierta", "orando", "respondida"];
    return `
      <div class="ld-view-head"><h2>🙏 Peticiones de oración</h2>
        <p>Lo que comparte tu ministerio. Crea las tuyas y únete en oración por las demás.</p></div>
      <div class="ld-pet-bar">
        <div class="ld-segment" role="tablist" aria-label="Filtrar peticiones">
          ${filtros.map(f => `<button class="${estado.filtroPet === f ? "is-active" : ""}" data-accion="filtro-pet" data-f="${f}">${f === "todas" ? "Todas" : elbl[f]} (${f === "todas" ? todas.length : todas.filter(p => p.estado === f).length})</button>`).join("")}
        </div>
        <button class="ld-btn ld-btn--primary ld-btn--sm" data-accion="nueva-peticion">＋ Nueva petición</button>
      </div>
      ${pets.length ? `<div class="ld-peticiones">${pets.map(peticionCard).join("")}</div>`
        : `<div class="ld-empty">No hay peticiones en este filtro.</div>`}`;
  }

  function peticionCard(p) {
    const elbl = { abierta: "Abierta", orando: "Orando", respondida: "Respondida" };
    const mia = p.autorTipo === "lider" && p.autor === LIDER.nombre;
    const yaOro = !!orando[p.id];
    return `
      <article class="ld-peticion ${mia ? "ld-peticion--mia" : ""}">
        <div class="ld-peticion__head">
          <div class="ld-peticion__autor"><b>${esc(p.autor)}</b>
            <span class="ld-tag ld-tag--rol">${p.autorTipo === "lider" ? "Líder" : p.autorTipo === "persona" ? "Persona" : "Director"}</span>
            ${mia ? `<span class="ld-tag ld-tag--mia">Tú</span>` : ""}
          </div>
          <span class="ld-pet-estado ld-pet-estado--${p.estado}">${elbl[p.estado] || "Abierta"}</span>
        </div>
        <p class="ld-peticion__texto">${esc(p.texto)}</p>
        <div class="ld-peticion__foot">
          <span class="ld-muted">📅 ${fechaCorta(p.fecha)}</span>
          <div class="ld-peticion__acts">
            <button class="ld-btn ld-btn--gold ld-btn--sm ${yaOro ? "is-on" : ""}" data-accion="orar" data-id="${p.id}" ${yaOro ? "disabled" : ""}>${yaOro ? "🙏 Estás orando" : "🙏 Me uno en oración"}</button>
            ${mia && p.estado !== "respondida" ? `<button class="ld-btn ld-btn--ok ld-btn--sm" data-accion="pet-respondida" data-id="${p.id}">✓ Respondida</button>` : ""}
          </div>
        </div>
      </article>`;
  }

  function modalPeticion() {
    const wrap = document.getElementById("ld-modal");
    wrap.innerHTML = `
      <div class="ld-modalbg" id="ld-modalbg">
        <div class="ld-modal" role="dialog" aria-modal="true" aria-labelledby="ld-pet-t">
          <h3 id="ld-pet-t">Nueva petición de oración</h3>
          <p>Se compartirá con tu director y el equipo de oración del ministerio.</p>
          <label class="ld-field"><span>Autor</span>
            <input class="ld-input" id="ld-pet-autor" value="${esc(LIDER.nombre)}" readonly></label>
          <label class="ld-field"><span>¿Por qué oramos?</span>
            <textarea class="ld-input" id="ld-pet-texto" rows="3" placeholder="Escribe la petición…"></textarea></label>
          <div class="ld-modal__acts">
            <button class="ld-btn ld-btn--ghost" id="ld-pet-cancel">Cancelar</button>
            <button class="ld-btn ld-btn--primary" id="ld-pet-ok">Publicar</button>
          </div>
        </div>
      </div>`;
    const cerrar = () => { wrap.innerHTML = ""; };
    const ta = document.getElementById("ld-pet-texto");
    if (ta) ta.focus();
    document.getElementById("ld-modalbg").addEventListener("click", e => { if (e.target.id === "ld-modalbg") cerrar(); });
    document.getElementById("ld-pet-cancel").addEventListener("click", cerrar);
    document.getElementById("ld-pet-ok").addEventListener("click", () => {
      const texto = (ta.value || "").trim();
      if (!texto) { ta.focus(); ta.classList.add("is-error"); return; }
      DS.addPeticion({ autor: LIDER.nombre, autorTipo: "lider", texto });
      cerrar(); estado.filtroPet = "todas"; render();
      toast("Petición publicada. Tu director ya la ve 🙏", true);
    });
  }

  /* ---------------------------------------------- recomendaciones IA */
  function recomendaciones(ins) {
    const recos = [];
    const total = ins.length || 1;
    const sinContactar = ins.filter(p => !p.contactado);
    const enConoce = ins.filter(p => p.etapa === "conoce");
    const pctConoce = Math.round((enConoce.length / total) * 100);
    const cumpleProx = ins.map(p => ({ p, d: diasHastaCumple(p.cumpleMes, p.cumpleDia) }))
      .filter(x => x.d !== null && x.d <= 7).sort((a, b) => a.d - b.d);
    const disp = S.disponible(GRUPO_ID);
    const cerrado = S.cerrado(GRUPO_ID);

    if (sinContactar.length) recos.push({ ico: "📞", html: `Tienes <b>${sinContactar.length} persona${sinContactar.length > 1 ? "s" : ""} sin contactar</b>. Un mensaje en las primeras 48 horas duplica la probabilidad de que se queden. Empieza por <b>${esc(sinContactar[0].nombres)}</b>.`, accion: { id: sinContactar[0].id, lbl: "Escribir" } });
    if (cumpleProx.length) { const c = cumpleProx[0]; const cuando = c.d === 0 ? "hoy" : c.d === 1 ? "mañana" : `en ${c.d} días`; recos.push({ ico: "🎂", html: `El cumpleaños de <b>${esc(c.p.nombres)}</b> es ${cuando}. Felicitarlo a tiempo dice "te tengo presente".`, accion: { id: c.p.id, lbl: "Felicitar" } }); }
    if (pctConoce >= 40) recos.push({ ico: "🌱", html: `El <b>${pctConoce}%</b> de tu grupo está en la etapa <b>Conoce</b>. Invítalos al curso <b>ADN</b> para que den su siguiente paso en las 4C.` });
    if (!cerrado && disp <= 3) recos.push({ ico: "🚪", html: `Tu grupo está casi lleno (<b>${disp} cupo${disp === 1 ? "" : "s"}</b>). Piensa en formar a un <b>colíder</b> o abrir un segundo grupo.` });
    if (cerrado) recos.push({ ico: "🔒", html: `Las inscripciones están <b>bloqueadas</b> y el landing ya lo muestra. Aprovecha para consolidar a los que ya están.` });
    recos.push({ ico: "💛", html: `Recuerda los verbos de la casa: <b>conocer, acompañar, ayudar y rodear</b>. Pregunta por la semana de cada quien, no solo por su asistencia.` });

    return recos.map(r => `
      <div class="ld-reco">
        <div class="ld-reco__ic">${r.ico}</div>
        <div class="ld-reco__tx">${r.html}</div>
        ${r.accion ? `<div class="ld-reco__act"><a class="ld-btn ld-btn--sm" href="${waLink(ins.find(p => p.id === r.accion.id))}" target="_blank" rel="noopener" data-accion="felicitar" data-id="${r.accion.id}">${r.accion.lbl}</a></div>` : ""}
      </div>`).join("");
  }

  /* ------------------------------------------------------ análisis */
  function cardEdades(ins) {
    const buckets = [{ lbl: "18–25", min: 0, max: 25 }, { lbl: "26–30", min: 26, max: 30 }, { lbl: "31–35", min: 31, max: 35 }, { lbl: "36+", min: 36, max: 200 }];
    const conEdad = ins.filter(p => typeof p.edad === "number");
    const max = Math.max(1, ...buckets.map(b => conEdad.filter(p => p.edad >= b.min && p.edad <= b.max).length));
    const prom = conEdad.length ? Math.round(conEdad.reduce((s, p) => s + p.edad, 0) / conEdad.length) : "—";
    const filas = buckets.map(b => {
      const n = conEdad.filter(p => p.edad >= b.min && p.edad <= b.max).length;
      return `<div class="ld-chart__row"><div class="ld-chart__lbl">${b.lbl} años</div><div class="ld-chart__track"><div class="ld-chart__fill fill-edad" style="width:${Math.round((n / max) * 100)}%"></div></div><div class="ld-chart__val">${n}</div></div>`;
    }).join("");
    return `<div class="ld-card"><h3 class="ld-card__h">Edades</h3>${filas}<div class="ld-prom">Edad promedio: <b>${prom}${prom === "—" ? "" : " años"}</b> · ${conEdad.length}/${ins.length} con edad registrada</div></div>`;
  }
  function cardEtapas(ins) {
    const total = ins.length || 1;
    const orden = ["conoce", "conecta", "crece", "sirve"];
    const max = Math.max(1, ...orden.map(e => ins.filter(p => p.etapa === e).length));
    const filas = orden.map(e => {
      const n = ins.filter(p => p.etapa === e).length;
      return `<div class="ld-chart__row"><div class="ld-chart__lbl">${ETAPAS[e].lbl}</div><div class="ld-chart__track"><div class="ld-chart__fill fill-${e}" style="width:${Math.round((n / max) * 100)}%"></div></div><div class="ld-chart__val">${n}</div></div>`;
    }).join("");
    const enConoce = ins.filter(p => p.etapa === "conoce").length;
    return `<div class="ld-card"><h3 class="ld-card__h">Etapa del recorrido (4C)</h3>${filas}<div class="ld-prom"><b>${Math.round((enConoce / total) * 100)}%</b> apenas está en <b>Conoce</b>: tu prioridad de acompañamiento.</div></div>`;
  }

  /* ------------------------------------------------ notificaciones */
  function notificaciones(ins) {
    const items = [];
    const cumples = ins.map(p => ({ p, d: diasHastaCumple(p.cumpleMes, p.cumpleDia) }))
      .filter(x => x.d !== null && x.d <= 30).sort((a, b) => a.d - b.d);
    cumples.forEach(({ p, d }) => {
      const cuando = d === 0 ? "¡es hoy! 🎉" : d === 1 ? "es mañana" : `en ${d} días`;
      items.push(`<div class="ld-noti ld-noti--cumple"><div class="ld-noti__ic">🎂</div><div class="ld-noti__tx"><b>${esc(nombreCompleto(p))}</b> cumple años ${cuando}<small>${p.cumpleDia} de ${MESES[p.cumpleMes - 1]} · escríbele un saludo</small></div><div class="ld-noti__act"><a class="ld-btn ld-btn--gold ld-btn--sm" href="${waLink(p)}" target="_blank" rel="noopener" data-accion="felicitar" data-id="${p.id}">Felicitar</a></div></div>`);
    });
    const nuevosSC = ins.filter(p => !p.contactado && diasDesde(p.fechaInscripcion) <= 7);
    nuevosSC.forEach(p => {
      const dd = diasDesde(p.fechaInscripcion);
      items.push(`<div class="ld-noti ld-noti--nuevo"><div class="ld-noti__ic">👋</div><div class="ld-noti__tx"><b>${esc(nombreCompleto(p))}</b> se inscribió ${dd === 0 ? "hoy" : "hace " + dd + " días"} y aún no lo contactas<small>${esc(p.fuente || "Nuevo en el grupo")}</small></div><div class="ld-noti__act"><a class="ld-btn ld-btn--primary ld-btn--sm" href="${waLink(p)}" target="_blank" rel="noopener" data-accion="felicitar" data-id="${p.id}">Dar bienvenida</a></div></div>`);
    });
    if (!items.length) return `<div class="ld-empty">Todo al día ✓ No hay cumpleaños cercanos ni personas sin contactar.</div>`;
    return items.join("");
  }

  /* ----------------------------------------------- tarjeta persona */
  function personaCard(p) {
    const nuevo = diasDesde(p.fechaInscripcion) <= 7;
    const dCumple = diasHastaCumple(p.cumpleMes, p.cumpleDia);
    const cumpleSoon = dCumple !== null && dCumple <= 30;
    const et = ETAPAS[p.etapa] || ETAPAS.conoce;
    return `
    <article class="ld-person ${nuevo ? "ld-person--nuevo" : ""}" data-nombre="${esc(nombreCompleto(p).toLowerCase())}">
      <div class="ld-person__top">
        <div class="ld-person__av">${esc(iniciales(p).toUpperCase())}</div>
        <div class="ld-person__id">
          <div class="ld-person__name">${esc(nombreCompleto(p))}
            ${nuevo ? `<span class="ld-tag ld-tag--nuevo">Nuevo</span>` : ""}
            ${cumpleSoon ? `<span class="ld-tag ld-tag--cumple">🎂 ${dCumple === 0 ? "Hoy" : dCumple + "d"}</span>` : ""}
          </div>
          <div class="ld-person__sub">${typeof p.edad === "number" ? p.edad + " años · " : ""}${esc(p.estadoCivil || "")}</div>
          <div style="margin-top:6px"><span class="ld-chip chip-${p.etapa || "conoce"}">${et.lbl}</span></div>
        </div>
      </div>
      <div class="ld-person__data">
        <div><span class="k">✉️ Correo</span> <span>${esc(p.correo || "—")}</span></div>
        <div><span class="k">📱 Teléfono</span> <span>${esc(p.telefono || "—")}</span></div>
        <div><span class="k">📅 Inscrito</span> <span>${fechaCorta(p.fechaInscripcion)}</span></div>
        <div><span class="k">🔗 Fuente</span> <span>${esc(p.fuente || "—")}</span></div>
      </div>
      ${formacionHTML(p)}
      <div class="ld-person__acts">
        <a class="ld-btn ld-btn--gold ld-btn--sm" href="${waLink(p)}" target="_blank" rel="noopener" data-accion="felicitar" data-id="${p.id}">💬 WhatsApp</a>
        <a class="ld-btn ld-btn--ghost ld-btn--sm" href="${mailLink(p)}" data-accion="correo" data-id="${p.id}">✉️ Correo</a>
      </div>
      <div>${p.contactado
        ? `<span class="ld-contacted">✓ Contactado</span> · <button class="ld-linklike" data-accion="contactar" data-id="${p.id}" data-val="0">deshacer</button>`
        : `<button class="ld-btn ld-btn--ghost ld-btn--sm" data-accion="contactar" data-id="${p.id}" data-val="1">Marcar como contactado</button>`}
      </div>
    </article>`;
  }

  /* ============================================================ RENDER */
  function render() {
    if (!sesion) { app().innerHTML = vistaLogin(); enlazarLogin(); return; }
    app().innerHTML = vistaApp();
    enlazarApp();
  }
  // Re-render solo del contenido (al cambiar de pestaña) — más fluido
  function renderContenido() {
    const c = document.getElementById("ld-content");
    if (c) c.innerHTML = contenido();
    // refrescar estado activo de la navegación y badges
    const side = document.querySelector(".ld-side");
    if (side) side.outerHTML = sidebar();
    enlazarBusqueda();
  }

  function enlazarLogin() {
    const g = document.getElementById("ld-google");
    if (g) g.addEventListener("click", () => { sesion = true; estado.tab = "resumen"; render(); toast(`¡Bienvenido, ${LIDER.nombre.split(" ")[0]}! 👋`, true); });
  }
  function enlazarApp() {
    if (!clickBound) { app().addEventListener("click", manejar); clickBound = true; }
    enlazarBusqueda();
  }
  function enlazarBusqueda() {
    const s = document.getElementById("ld-search");
    if (s) s.addEventListener("input", e => {
      estado.busqueda = e.target.value;
      const pos = e.target.selectionStart;
      const cont = document.getElementById("ld-people");
      const lista = filtrarYBuscar(S.inscritos(GRUPO_ID));
      if (cont) cont.innerHTML = lista.map(personaCard).join("");
      // mantener foco en el input tras refrescar la lista
      const s2 = document.getElementById("ld-search"); if (s2) { s2.focus(); try { s2.setSelectionRange(pos, pos); } catch (e) {} }
    });
  }

  /* --------------------------------------------------- interacciones */
  function manejar(ev) {
    const el = ev.target.closest("[data-accion]");
    if (!el) return;
    const a = el.dataset.accion;

    if (a === "salir") { ev.preventDefault(); sesion = false; render(); return; }

    if (a === "tab") { ev.preventDefault(); estado.tab = el.dataset.tab; estado.busqueda = ""; estado.filtroGrupo = "todos"; temDrill = null; renderContenido(); document.querySelector(".ld-content").scrollIntoView({ block: "start", behavior: "instant" in window ? "instant" : "auto" }); return; }

    if (a === "filtro") { ev.preventDefault(); estado.filtroGrupo = el.dataset.filtro; renderContenido(); return; }

    /* ---- Temáticas (solo lectura) ---- */
    if (a === "ver-tematica") { ev.preventDefault(); temDrill = el.dataset.id; renderContenido(); document.querySelector(".ld-content").scrollIntoView({ block: "start", behavior: "auto" }); return; }
    if (a === "tem-volver") { ev.preventDefault(); temDrill = null; renderContenido(); return; }
    if (a === "ver-doc") {
      ev.preventDefault();
      const tt = DS && DS.tematica(el.dataset.tem);
      const d = tt && (tt.docs || []).find(x => x.id === el.dataset.id);
      toast(d ? `📄 Vista previa de “${d.nombre || d.archivo}” (demo). En producción abre o descarga el archivo.` : "Documento no encontrado", true);
      return;
    }

    /* ---- Peticiones ---- */
    if (a === "filtro-pet") { ev.preventDefault(); estado.filtroPet = el.dataset.f; renderContenido(); return; }
    if (a === "nueva-peticion") { ev.preventDefault(); modalPeticion(); return; }
    if (a === "orar") {
      ev.preventDefault();
      orando[el.dataset.id] = true;
      renderContenido();
      toast("Te uniste en oración 🙏 Gracias por rodear a tu gente.", true);
      return;
    }
    if (a === "pet-respondida") {
      ev.preventDefault();
      if (DS) DS.setEstadoPeticion(el.dataset.id, "respondida");
      renderContenido();
      toast("Petición marcada como respondida ✓ ¡Gloria a Dios!", true);
      return;
    }

    if (a === "toggle-bloqueo") {
      ev.preventDefault();
      if (!S.cerrado(GRUPO_ID)) confirmarBloqueo();
      else { S.setCerrado(GRUPO_ID, false); render(); toast("Inscripciones reabiertas. El landing ya las acepta ✓", true); }
      return;
    }
    if (a === "felicitar") {
      const p = S.inscritos(GRUPO_ID).find(x => x.id === el.dataset.id);
      if (p && !p.contactado) setTimeout(() => { S.marcarContactado(GRUPO_ID, p.id, true); render(); }, 300);
      return; // el href se abre solo
    }
    if (a === "correo") return; // mailto se abre solo
    if (a === "contactar") {
      ev.preventDefault();
      S.marcarContactado(GRUPO_ID, el.dataset.id, el.dataset.val === "1");
      render();
      toast(el.dataset.val === "1" ? "Marcado como contactado ✓" : "Marca de contacto retirada", el.dataset.val === "1");
      return;
    }

    /* ---- Formación: verificar cursos de cada persona ---- */
    if (a === "curso-sel") {
      ev.preventDefault();
      const id = el.dataset.id, key = el.dataset.key;
      verifCurso = (verifCurso && verifCurso.insId === id && verifCurso.key === key) ? null : { insId: id, key };
      render();
      return;
    }
    if (a === "curso-cancel") { ev.preventDefault(); verifCurso = null; render(); return; }
    if (a === "curso-set") {
      ev.preventDefault();
      const id = el.dataset.id, key = el.dataset.key, val = el.dataset.val;
      const cur = FORMACION.find(x => x.key === key);
      S.setCursoEstado(GRUPO_ID, id, key, val === "ok" ? "ok" : null);
      verifCurso = null;
      render();
      const p = S.inscritos(GRUPO_ID).find(x => x.id === id);
      toast(val === "ok"
        ? `✓ ${cur ? cur.lbl : "Curso"} verificado para ${p ? p.nombres : "la persona"}. Actualizado en el CRM.`
        : `Verificación de ${cur ? cur.lbl : "curso"} retirada.`, val === "ok");
      return;
    }
  }

  /* --------------------------------------- modal confirmar bloqueo */
  function confirmarBloqueo() {
    const wrap = document.getElementById("ld-modal");
    wrap.innerHTML = `
      <div class="ld-modalbg" id="ld-modalbg">
        <div class="ld-modal" role="dialog" aria-modal="true" aria-labelledby="ld-modal-t">
          <h3 id="ld-modal-t">¿Bloquear inscripciones?</h3>
          <p>Tu grupo <b>Café & Palabra</b> dejará de aceptar personas. En el landing aparecerá como <b>cerrado</b> y nadie podrá inscribirse hasta que reabras.</p>
          <div class="ld-modal__acts">
            <button class="ld-btn ld-btn--ghost" id="ld-modal-cancel">Cancelar</button>
            <button class="ld-btn ld-btn--danger" id="ld-modal-ok">Sí, bloquear</button>
          </div>
        </div>
      </div>`;
    const cerrar = () => { wrap.innerHTML = ""; };
    document.getElementById("ld-modalbg").addEventListener("click", e => { if (e.target.id === "ld-modalbg") cerrar(); });
    document.getElementById("ld-modal-cancel").addEventListener("click", cerrar);
    document.getElementById("ld-modal-ok").addEventListener("click", () => {
      S.setCerrado(GRUPO_ID, true); cerrar(); render();
      toast("Inscripciones bloqueadas. El landing ya muestra el grupo cerrado 🔒", true);
    });
  }

  /* ---------------------------------------------------------- toast */
  function toast(msg, ok) {
    const wrap = document.getElementById("ld-toasts");
    const el = document.createElement("div");
    el.className = "ld-toast" + (ok ? " ld-toast--ok" : "");
    el.innerHTML = `<span>${ok ? "✓" : "ℹ️"}</span><span>${esc(msg)}</span>`;
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateY(8px)"; setTimeout(() => el.remove(), 250); }, 3200);
  }

  /* ----- sincronización en vivo con el landing (otra pestaña) ----- */
  if (S && S.onCambio) S.onCambio(() => { if (sesion) render(); });
  /* ----- sincronización en vivo con el director (temáticas y peticiones) ----- */
  if (DS && DS.onCambio) DS.onCambio(() => { if (sesion) render(); });

  /* ---------------------------------------------------------- init */
  document.addEventListener("DOMContentLoaded", render);
  if (document.readyState !== "loading") render();
})();
