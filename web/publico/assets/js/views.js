/* ============================================================
   CASA ROCA AI SYSTEM — VISTAS · NÚCLEO (Fase 0 · v2)
   Expone window.VIEWS y helpers compartidos en VIEWS.H
   (los módulos ministerios/admin/instituto extienden VIEWS).
   ============================================================ */
window.VIEWS = (function () {
  const DB = window.DB;

  /* ---------- Helpers de formato (compartidos) ---------- */
  function cop(n) { return "$" + n.toLocaleString("es-CO"); }
  function etapaBadge(etapa) {
    const e = DB.ETAPAS[etapa]; if (!e) return "";
    return `<span class="badge badge--${e.clase}">${e.ico} ${e.nombre}</span>`;
  }
  function avatar(p, cls) { return `<div class="avatar ${cls || ""}">${p.iniciales}</div>`; }
  function recorrido(etapaActual) {
    const idx = DB.ORDEN_ETAPAS.indexOf(etapaActual);
    return `<div class="recorrido">` + DB.ORDEN_ETAPAS.map((id, i) => {
      const e = DB.ETAPAS[id];
      const ok = i < idx ? "ok " + e.clase : (i === idx ? "ok " + e.clase + " actual" : "");
      return `<div class="recorrido__seg ${ok}"><span class="et">${e.ico}</span>${e.nombre}</div>`;
    }).join("") + `</div>`;
  }
  function pageHead(eyebrow, titulo, desc, accionHTML) {
    return `<div class="page-head"><div class="page-head__row">
      <div class="grow"><div class="page-head__eyebrow">${eyebrow}</div>
        <h1>${titulo}</h1>${desc ? `<p>${desc}</p>` : ""}</div>
      ${accionHTML || ""}</div></div>`;
  }
  function kpi(ico, val, lbl, delta) {
    return `<div class="card"><div class="flex between items-center">
      <div class="kpi"><div class="kpi__val">${val}</div><div class="kpi__lbl">${lbl}</div>
      ${delta ? `<div class="kpi__delta ${delta.dir}">${delta.dir === "up" ? "▲" : "▼"} ${delta.txt}</div>` : ""}</div>
      <div class="kpi__ico">${ico}</div></div></div>`;
  }
  function volver(ruta, txt) { return `<button class="btn btn--ghost btn--sm mb-4" data-accion="ir" data-valor="${ruta}">← ${txt}</button>`; }
  function filaPersona(p) {
    const riesgo = p.riesgo ? `<span class="badge badge--peligro">⚠️ En riesgo</span>` : "";
    const nuevo = p.esNuevo ? `<span class="badge badge--mostaza">✨ Nuevo</span>` : "";
    return `<div class="fila">${avatar(p)}
      <div class="fila__main"><b>${DB.nombre(p)}</b><span>${p.subestado || p.rol}</span></div>
      <div class="flex gap-2 items-center wrap" style="justify-content:flex-end">${nuevo}${riesgo}${etapaBadge(p.etapa)}
        <button class="btn btn--ghost btn--sm" data-accion="ver-perfil" data-valor="${p.id}">Ver</button></div></div>`;
  }
  /* ---------- Iconos SVG (línea, heredan color/tamaño) ---------- */
  const ICON_PATHS = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 9.5V20h14V9.5"/>',
    wallet: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10.5h18"/><circle cx="16.5" cy="13.5" r="1.1"/>',
    inbox: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 14h4.5a2.5 2.5 0 0 0 9 0H21"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.6a3 3 0 0 1 0 5.6"/><path d="M16.5 14.4a5.5 5.5 0 0 1 4 4.6"/>',
    group: '<circle cx="8" cy="9" r="2.6"/><circle cx="16" cy="9" r="2.6"/><path d="M3.5 19a4.5 4.5 0 0 1 9 0"/><path d="M11.5 19a4.5 4.5 0 0 1 9 0"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    child: '<circle cx="12" cy="12" r="9"/><path d="M9 10h.01M15 10h.01"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/>',
    book: '<path d="M12 6c-1.6-1-4.1-1.5-6-1.5V18c1.9 0 4.4.5 6 1.5 1.6-1 4.1-1.5 6-1.5V4.5c-1.9 0-4.4.5-6 1.5z"/><path d="M12 6v13.5"/>',
    cap: '<path d="M12 4 2.5 9 12 14l9.5-5L12 4z"/><path d="M6.5 11v4.2c0 1.4 2.5 2.8 5.5 2.8s5.5-1.4 5.5-2.8V11"/>',
    building: '<rect x="4.5" y="3" width="15" height="18" rx="1.5"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2"/><path d="M10 21v-3.5h4V21"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.36 5.64l-2.12 2.12M7.76 16.24l-2.12 2.12M18.36 18.36l-2.12-2.12M7.76 7.76 5.64 5.64"/>',
    sitemap: '<rect x="9" y="3" width="6" height="4.5" rx="1"/><rect x="3" y="16.5" width="6" height="4.5" rx="1"/><rect x="15" y="16.5" width="6" height="4.5" rx="1"/><path d="M12 7.5v4M6 16.5V13h12v3.5M12 13v-1.5"/>',
    sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>',
    chart: '<path d="M4 20V4M4 20h16"/><rect x="7.5" y="12" width="3" height="5.5" rx="0.5"/><rect x="13.5" y="8" width="3" height="9.5" rx="0.5"/>',
    coins: '<ellipse cx="12" cy="6.5" rx="7" ry="3"/><path d="M5 6.5v5c0 1.66 3.13 3 7 3s7-1.34 7-3v-5"/><path d="M5 11.5v5c0 1.66 3.13 3 7 3s7-1.34 7-3v-5"/>',
    tool: '<path d="M10.5 7 4.5 13a2.8 2.8 0 0 0 4 4l6-6"/><path d="M14.5 11l5-5a3 3 0 0 0-4-4l-3 3"/>',
    heart: '<path d="M12 20s-7-4.5-7-9.6A3.6 3.6 0 0 1 12 7a3.6 3.6 0 0 1 7 3.4C19 15.5 12 20 12 20z"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7"/><path d="M3 12.5h18"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
    message: '<path d="M21 12a8 8 0 0 1-11.7 7.1L4 21l1.9-5.3A8 8 0 1 1 21 12z"/>',
    award: '<circle cx="12" cy="9" r="5"/><path d="M9 13.2 7.5 21 12 18.4 16.5 21 15 13.2"/>',
    clipboard: '<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><rect x="9" y="2.5" width="6" height="4" rx="1.2"/><path d="M9 11h6M9 15h4"/>',
    user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    check: '<path d="M5 13l4 4L19 7"/>',
    bell: '<path d="M6 9.5a6 6 0 0 1 12 0c0 4.5 2 5.5 2 5.5H4s2-1 2-5.5z"/><path d="M10 19.5a2 2 0 0 0 4 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    dot: '<circle cx="12" cy="12" r="3.4"/>'
  };
  function icon(name) {
    const p = ICON_PATHS[name] || ICON_PATHS.dot;
    return `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  }
  const RUTA_ICON = {
    panel: "home", finanzas: "wallet", aprobaciones: "inbox", personas: "users",
    ministerios: "grid", grupos: "group", rocakids: "child", cursos: "book",
    instituto: "cap", admin: "briefcase", donaciones: "coins", filiales: "building",
    config: "gear", orgfilial: "sitemap", nuevos: "sparkle", contabilidad: "chart",
    operativos: "tool", consejerias: "heart", academia: "cap",
    "lms-materias": "cap", "lms-notas": "chart", "lms-calendario": "calendar",
    "lms-foros": "message", "lms-progreso": "award", "lms-matricula": "clipboard",
    "lms-finanzas": "wallet", "lms-perfil": "user",
    "doc-materias": "cap", "doc-calificar": "check", "doc-evaluaciones": "clipboard",
    "doc-gradebook": "chart", "doc-asistencia": "check", "doc-foros": "message",
    "doc-mensajes": "message"
  };
  function iconRuta(id) {
    if (!id) return icon("dot");
    if (id.indexOf("equipo:") === 0) return icon("briefcase");
    if (id.indexOf("mfilial:") === 0) return icon("grid");
    if (id === "operativo" || id.indexOf("operativo:") === 0) return icon("tool");
    if (id.indexOf("aca-") === 0) return icon("cap");
    return icon(RUTA_ICON[id] || "dot");
  }

  const H = { cop, etapaBadge, avatar, recorrido, pageHead, kpi, volver, filaPersona, icon, iconRuta };

  /* ============================================================
     LOGIN / SELECTOR DE ROL
     ============================================================ */
  function login() {
    const roles = Object.values(DB.ROLES);
    return `
    <div class="login"><div class="login__card">
      <div class="login__head">
        <div class="login__logo">CR</div>
        <div class="login__title">Casa Roca · AI System</div>
        <div class="login__sub">Una casa cálida y segura — también en lo digital</div>
      </div>
      <div class="login__body">
        <label class="login__label">Ingresa según tu rol. La experiencia se adapta a tu alcance jerárquico.</label>
        <div class="rol-grid">
          ${roles.map(r => `
            <button class="rol-opcion" data-rol="${r.id}">
              <span class="rol-opcion__ico">${r.ico}</span>
              <span class="rol-opcion__txt"><b>${r.nombre}</b><span>${r.desc}</span></span>
            </button>`).join("")}
        </div>
      </div>
      <div class="login__pie">Prototipo Fase 0 · datos de demostración · 2 sistemas (ERP global + filial) · ${DB.MINISTERIOS.length} ministerios en catálogo
        <br><a href="experiencia.html" style="display:inline-block;margin-top:8px;color:var(--mostaza-600);font-weight:600;text-decoration:none">✦ Ver la experiencia pública (visitantes / 4C) →</a></div>
    </div></div>`;
  }

  /* ============================================================
     SHELL (topbar + sidebar + tabbar)
     ============================================================ */
  function shell(estado) {
    const rol = DB.ROLES[estado.rol];
    const nav = window.UTIL.navPorRol(estado.rol);
    const todos = [];
    Object.values(nav).forEach(g => g.forEach(i => todos.push(i)));

    const grupos = [
      { k: "general", lbl: "General" },
      { k: "aprendizaje", lbl: "Aprendizaje" },
      { k: "docencia", lbl: "Docencia" },
      { k: "evaluacion", lbl: "Evaluación" },
      { k: "comunidad", lbl: "Comunidad" },
      { k: "finanzas", lbl: "Finanzas" },
      { k: "academico", lbl: "Dirección académica" },
      { k: "pastoral", lbl: "Pastoral & Personas" },
      { k: "ministerios", lbl: "Ministerios congregacionales" },
      { k: "formacion", lbl: "Formación" },
      { k: "operativos", lbl: "Equipos Operativos" },
      { k: "erp", lbl: "ERP · Administración" },
      { k: "equipos", lbl: "ERP · Equipos administrativos" },
      { k: "cuenta", lbl: "Mi cuenta" },
      { k: "sistema", lbl: "Sistema" }
    ];
    const sidebarHTML = `
      <nav class="sidebar" aria-label="Navegación principal">
        ${grupos.map(g => (nav[g.k] && nav[g.k].length)
          ? `<div class="sidebar__grupo">${g.lbl}</div>${nav[g.k].map(n => navItem(n, estado.ruta)).join("")}`
          : "").join("")}
        <div class="sidebar__grupo">Sesión</div>
        <button class="nav-item" id="btn-salir"><span class="nav-item__ico">↩️</span> Cambiar de rol</button>
      </nav>`;

    const tabItems = todos.slice(0, 5);
    return `
    <div class="app ${estado.sidebarColapsado ? "sidebar-oculta" : ""}">
      <header class="topbar">
        <button class="topbar__menu" id="btn-sidebar" title="Mostrar/ocultar menú" aria-label="Mostrar u ocultar el menú lateral">${icon("menu")}</button>
        <div class="topbar__logo"><span class="mark">CR</span>
          <span>Casa Roca<small>${rol.sistema}</small></span></div>
        <label class="topbar__search" for="busqueda-global">
          <span class="ico" aria-hidden="true">${icon("search")}</span>
          <input id="busqueda-global" type="search" placeholder="Buscar personas, ministerios, sedes…" aria-label="Búsqueda global" />
          <kbd>⌘K</kbd>
        </label>
        <div class="topbar__right">
          <div class="topbar__sede"><span class="lbl">📍</span>
            ${rol.alcance === "global" ? selectSede(estado.sede) : `<span>${DB.sede(estado.sede).nombre}</span>`}</div>
          <span class="topbar__div" aria-hidden="true"></span>
          <button class="topbar__icon-btn" data-dot title="Notificaciones" aria-label="Notificaciones">${icon("bell")}</button>
          <div class="topbar__user" title="${rol.nombre}">${DB.persona(rol.persona).iniciales}</div>
        </div>
      </header>
      <div class="shell">${sidebarHTML}<main class="contenido" id="contenido"></main></div>
      <nav class="tabbar" aria-label="Navegación móvil">
        ${tabItems.map(n => `<button class="tabbar__item ${n.id === estado.ruta ? "activo" : ""}" data-ruta="${n.id}">
          <span class="ico">${iconRuta(n.id)}</span><span>${n.lbl}</span></button>`).join("")}
      </nav>
      <button class="ia-fab" id="ia-fab" title="Asistente Casa Roca" aria-label="Abrir asistente">✨</button>
    </div>`;
  }
  function navItem(n, rutaActiva) {
    return `<button class="nav-item ${n.id === rutaActiva ? "activo" : ""}" data-ruta="${n.id}">
      <span class="nav-item__ico">${iconRuta(n.id)}</span> ${n.lbl}</button>`;
  }
  function selectSede(sel) {
    return `<select id="sel-sede" aria-label="Cambiar sede">
      ${DB.SEDES.map(s => `<option value="${s.id}" ${s.id === sel ? "selected" : ""}>${s.nombre}${s.esMadre ? " (madre)" : ""}</option>`).join("")}
    </select>`;
  }

  /* ============================================================
     1) PANEL POR ROL
     ============================================================ */
  function panel(rol, estado) {
    switch (rol.id) {
      case "pastor_admin": return panelAdmin(rol, estado);
      case "pastor_sede": return panelSede(rol, estado);
      case "director": return panelDirector(rol, estado);
      case "coordinador": return panelCoordinador(rol, estado);
      case "lider": return panelLider(rol, estado);
      case "tesoreria": return panelTesoreria(rol, estado);
      case "estudiante": return window.VIEWS.panelEstudiante(rol, estado);
      case "docente": return window.VIEWS.panelDocente(rol, estado);
      default: return panelLider(rol, estado);
    }
  }

  function panelAdmin(rol, estado) {
    return `
    ${pageHead("Dirección General · toda la red", "Buenas, Pastor Darío 👋",
      "Diriges los <b>dos sistemas</b>: el ERP corporativo global y la operación pastoral de las " + DB.SEDES.length + " sedes. Cambia de sede arriba para enfocar una filial.")}
    <div class="grid grid-4 mb-4">
      ${kpi("👥", "12.480", "Personas activas", { dir: "up", txt: "3,2% mes" })}
      ${kpi("✨", "214", "Nuevos este mes", { dir: "up", txt: "18 hoy" })}
      ${kpi("🏛️", DB.SEDES.length, "Sedes en red")}
      ${kpi("💛", "$224 M", "Aportes (mayo)", { dir: "up", txt: "13% vs abr" })}
    </div>
    <div class="grid grid-2 mb-4">
      <div class="card card--pad-lg">
        <div class="card__title">🌎 Recorrido espiritual · toda la red</div>
        <p class="card__sub mb-4">Distribución por etapa (las 4 C)</p>
        ${barraEtapas([42, 28, 19, 11])}
      </div>
      <div class="card card--pad-lg">
        <div class="flex between items-center mb-3"><div class="card__title">🏛️ Salud por sede</div>
          <button class="btn btn--ghost btn--sm" data-accion="ir" data-valor="filiales">Gestionar filiales →</button></div>
        ${filaSede("Bogotá Chicó", 96, "exito")}${filaSede("Medellín", 88, "exito")}
        ${filaSede("Cali", 71, "aviso")}${filaSede("Miami", 64, "aviso")}${filaSede("Madrid", 49, "peligro")}
      </div>
    </div>
    <div class="card card--pad-lg mb-4" style="background:linear-gradient(135deg,var(--azul-50),var(--mostaza-100)); border-color:var(--mostaza-300)">
      <div class="flex between items-center mb-2"><div class="card__title">🧱 Centro de control ERP</div>
        <button class="btn btn--primario btn--sm" data-accion="ir" data-valor="admin">Abrir ERP →</button></div>
      <p class="card__sub mb-3">8 equipos administrativos. Lo corporativo (Contable, Legal, Tecnología) vive solo aquí, en la sede madre.</p>
      <div class="grid grid-4">
        ${DB.EQUIPOS.slice(0, 4).map(e => `<button class="btn btn--ghost" data-accion="ver-equipo" data-valor="${e.id}" style="justify-content:flex-start">${e.ico} ${e.nombre}</button>`).join("")}
      </div>
    </div>
    ${tarjetaIACuidado()}`;
  }

  function panelSede(rol, estado) {
    const activos = DB.MINISTERIOS.filter(m => m.activo);
    return `
    ${pageHead("Mi sede · Bogotá Chicó", "Buenas, Pastor Camilo 👋",
      "Tu sistema de filial: administración local + <b>todos</b> los ministerios congregacionales y equipos operativos. Actívalos desde Configuración.")}
    <div class="grid grid-4 mb-4">
      ${kpi("👥", "1.940", "Personas · mi sede", { dir: "up", txt: "1,1% mes" })}
      ${kpi("✨", "34", "Nuevos este mes", { dir: "up", txt: "5 sin contactar" })}
      ${kpi("🧩", activos.length + "/" + DB.MINISTERIOS.length, "Ministerios activos")}
      ${kpi("⚠️", "9", "En riesgo", { dir: "down", txt: "requieren visita" })}
    </div>
    <div class="alerta alerta--info mb-4"><span class="ico">🧩</span>
      <div>¿Falta un ministerio o equipo? Entra a <b>Configuración</b> y actívalo o créalo para tu sede.
      <button class="btn btn--ghost btn--sm" style="margin-left:8px" data-accion="ir" data-valor="config">Ir a Configuración →</button></div></div>
    <div class="grid grid-2 mb-4">
      <div class="card card--pad-lg"><div class="card__title">🧭 Recorrido de mi sede</div>
        <p class="card__sub mb-4">Cómo avanza la congregación</p>${barraEtapas([46, 26, 18, 10])}</div>
      ${tarjetaNuevosSinContacto()}
    </div>
    ${tarjetaIACuidado()}
    ${accesosRapidos(["ministerios", "personas", "grupos", "instituto"])}`;
  }

  function panelDirector(rol, estado) {
    const m = DB.ministerio(rol.ministerio);
    return `
    ${pageHead("Ministerio · " + m.nombre, "Hola, Marcela 👋",
      "Tu ministerio y todos sus grupos. Hoy es domingo: revisa el check-in de niños.")}
    <div class="grid grid-4 mb-4">
      ${kpi("🧒", m.personas, "Niños registrados")}
      ${kpi("🧩", m.subdiv.length, "Salones")}
      ${kpi("✅", DB.NINOS.filter(n => n.estado === "dentro").length + " / 5", "Check-in (demo)")}
      ${kpi("🙋", m.voluntarios, "Voluntarios")}
    </div>
    <div class="alerta alerta--info mb-4"><span class="ico">💡</span>
      <div>La <b>IA de cuidado</b> sugiere reforzar el salón <b>Pequeños (3–5)</b>: hoy tienes 2 voluntarios para 18 niños esperados.</div></div>
    <div class="card mb-4">
      <div class="flex between items-center mb-3"><div class="card__title">🧩 Mis salones</div>
        <button class="btn btn--ghost btn--sm" data-accion="ver-ministerio" data-valor="${m.id}">Ver ministerio →</button></div>
      ${m.subdiv.map(filaSubdiv).join("")}
    </div>
    ${accesosRapidos(["rocakids", "personas", "grupos"])}`;
  }

  function panelCoordinador(rol, estado) {
    const m = DB.ministerio(rol.ministerio);
    const grupos = DB.GRUPOS.filter(g => g.ministerio === rol.ministerio);
    return `
    ${pageHead("Coordinación · " + m.nombre, "Hola, Andrés 👋",
      `Coordinas <b>${grupos.length} grupos</b> dentro de ${m.nombre}. Apoya a tus líderes y cuida el avance de cada grupo.`)}
    <div class="grid grid-3 mb-4">
      ${kpi("🤝", grupos.length, "Grupos a cargo")}
      ${kpi("👥", grupos.reduce((s, g) => s + g.miembros, 0), "Personas en mis grupos")}
      ${kpi("🧑‍🏫", grupos.length, "Líderes a acompañar")}
    </div>
    <div class="card">
      <div class="card__title mb-3">🤝 Mis grupos</div>
      ${grupos.map(g => `<div class="fila"><span style="font-size:1.3rem">🤝</span>
        <div class="fila__main"><b>${g.nombre}</b><span>${g.dia} ${g.hora} · Líder ${DB.nombre(DB.persona(g.lider))} · ${g.miembros}/${g.cupo}</span></div>
        <button class="btn btn--ghost btn--sm" data-accion="ir" data-valor="grupos">Ver</button></div>`).join("")}
    </div>
    ${accesosRapidos(["grupos", "personas", "cursos"])}`;
  }

  function panelLider(rol, estado) {
    const g = DB.grupo(rol.grupo);
    const miembros = DB.MIEMBROS_GRUPO.map(DB.persona);
    const enRiesgo = miembros.filter(m => m.riesgo);
    return `
    ${pageHead("Mi grupo de conexión", "Hola, Andrea 👋",
      `Cuidas a <b>${g.miembros} personas</b> en "${g.nombre}". Esto es lo que la IA preparó para ti.`)}
    <div class="grid grid-3 mb-4">
      ${kpi("🤝", g.miembros, "En mi grupo")}
      ${kpi("📅", g.dia + " " + g.hora, "Próxima reunión")}
      ${kpi("⚠️", enRiesgo.length, "Necesitan cariño", enRiesgo.length ? { dir: "down", txt: "esta semana" } : null)}
    </div>
    <div class="card mb-4" style="border-left:4px solid var(--mostaza-500)">
      <div class="card__title">✨ Resumen IA antes de tu reunión</div>
      <ul class="txt-sm txt-suave mt-3" style="margin:0; padding-left:1.1rem; line-height:1.8">
        <li><b>Laura Tobón</b> no asiste hace 4 semanas — sugerimos un mensaje cálido hoy.</li>
        <li><b>Valentina Ríos</b> va al 60% de Madurez Espiritual — felicítala 🎉</li>
        <li><b>Daniel Garzón</b> sigue "buscando grupo" — invítalo formalmente al tuyo.</li>
      </ul>
    </div>
    <div class="card">
      <div class="flex between items-center mb-3"><div class="card__title">👥 Mi gente</div>
        <button class="btn btn--ghost btn--sm" data-accion="ir" data-valor="personas">Ver todos →</button></div>
      ${miembros.map(filaPersona).join("")}
    </div>
    ${accesosRapidos(["grupos", "cursos", "personas"])}`;
  }

  function panelTesoreria(rol, estado) {
    const total = DB.DONACIONES.reduce((s, d) => s + d.monto, 0);
    const pend = DB.DONACIONES.filter(d => d.estado === "Pendiente").length;
    return `
    ${pageHead("Equipo Tesorería · Bogotá", "Hola, Jorge 👋",
      "Donaciones y conciliación con Siigo. Tu rol ve finanzas, no datos pastorales sensibles.")}
    <div class="grid grid-4 mb-4">
      ${kpi("💛", cop(total), "Recaudo (semana)")}
      ${kpi("🔄", (DB.DONACIONES.length - pend) + "/" + DB.DONACIONES.length, "Conciliadas Siigo")}
      ${kpi("⏳", pend, "Pendientes", pend ? { dir: "down", txt: "por revisar" } : null)}
      ${kpi("🏦", "3", "Pasarelas activas")}
    </div>
    <div class="alerta alerta--exito mb-4"><span class="ico">✓</span>
      <div><b>Conciliación automática activa:</b> ${DB.DONACIONES.length - pend} movimientos cruzados con Siigo sin digitación manual.</div></div>
    <div class="flex gap-3 wrap">
      <button class="btn btn--primario" data-accion="ir" data-valor="donaciones">Panel de donaciones →</button>
      <button class="btn btn--ghost" data-accion="ver-equipo" data-valor="e_tesoreria">Mi equipo (Tesorería) →</button>
    </div>`;
  }

  /* ---- auxiliares del panel ---- */
  function barraEtapas(porc) {
    const c = ["conoce", "conecta", "crece", "sirve"];
    return `<div class="flex gap-2" style="height:120px; align-items:flex-end">
      ${porc.map((p, i) => { const e = DB.ETAPAS[c[i]];
        return `<div style="flex:1; text-align:center">
          <div style="font-weight:700; font-size:var(--tx-sm)">${p}%</div>
          <div style="height:${p * 1.6}px; background:var(--etapa-${e.clase}); border-radius:8px 8px 0 0; margin-top:6px"></div>
          <div class="txt-xs txt-suave mt-2">${e.ico} ${e.nombre}</div></div>`; }).join("")}
    </div>`;
  }
  function filaSede(nombre, salud, tipo) {
    return `<div class="fila"><div class="fila__main"><b>${nombre}</b><span>Índice de cuidado</span></div>
      <div style="width:120px"><div class="progreso"><div class="progreso__barra" style="width:${salud}%; background:var(--${tipo})"></div></div></div>
      <span class="badge badge--${tipo}" style="min-width:48px; justify-content:center">${salud}</span></div>`;
  }
  function filaSubdiv(s) {
    return `<div class="fila"><span style="font-size:1.2rem">🧩</span>
      <div class="fila__main"><b>${s.nombre} <span class="txt-xs txt-suave">· ${s.rango}</span></b><span>Líder: ${s.lider}</span></div>
      <span class="badge badge--azul">${s.miembros} personas</span></div>`;
  }
  function tarjetaIACuidado() {
    return `<div class="card card--pad-lg mb-4" style="background:linear-gradient(135deg,var(--azul-50),var(--mostaza-100)); border-color:var(--mostaza-300)">
      <div class="card__title">✨ Cuidado pastoral con IA</div>
      <p class="card__sub mb-3">Personas que la IA detectó en riesgo de desconexión esta semana</p>
      <div class="flex gap-3 wrap">
        <button class="btn btn--ghost btn--sm" data-accion="ver-perfil" data-valor="p_laura">⚠️ Laura Tobón · 4 semanas ausente</button>
        <button class="btn btn--ghost btn--sm" data-accion="ver-perfil" data-valor="p_daniel">🔎 Daniel Garzón · sin grupo</button>
        <button class="btn btn--ghost btn--sm" data-accion="ver-perfil" data-valor="p_sebastian">🆕 Sebastián Cardona · bienvenida pendiente</button>
      </div></div>`;
  }
  function tarjetaNuevosSinContacto() {
    return `<div class="card card--pad-lg"><div class="card__title">🆕 Nuevos sin contactar</div>
      <p class="card__sub mb-3">Asignados automáticamente a seguimiento</p>
      ${filaPersona(DB.persona("p_sebastian"))}
      <div class="alerta alerta--aviso mt-3"><span class="ico">⏱️</span><div>5 nuevos esperan su primer contacto. La secuencia de bienvenida se envió automáticamente.</div></div></div>`;
  }
  function accesosRapidos(rutas) {
    const map = { personas: { ico: "👥", lbl: "Personas" }, grupos: { ico: "🤝", lbl: "Grupos" },
      cursos: { ico: "🎓", lbl: "Cursos" }, rocakids: { ico: "🧒", lbl: "RocaKids" },
      donaciones: { ico: "💛", lbl: "Tesorería" }, ministerios: { ico: "🧩", lbl: "Ministerios" },
      instituto: { ico: "🎓", lbl: "Instituto" }, admin: { ico: "🧱", lbl: "ERP" } };
    return `<div class="card"><div class="card__title mb-3">⚡ Accesos rápidos</div>
      <div class="grid grid-auto">${rutas.map(r => `<button class="btn btn--ghost" data-accion="ir" data-valor="${r}" style="justify-content:flex-start">${map[r].ico} ${map[r].lbl}</button>`).join("")}</div></div>`;
  }

  /* ============================================================
     2) PERSONAS + PERFIL 360°
     ============================================================ */
  function personas(rol, estado) {
    const esAdminPrincipal = rol.id === "pastor_admin";
    // La cédula (ID) solo la ven pastores y equipos administrativos.
    // Directores, coordinadores y líderes NO la ven.
    const verCedula = ["pastor_admin", "pastor_sede", "tesoreria"].indexOf(rol.id) > -1;
    let ids = (rol.id === "lider") ? DB.MIEMBROS_GRUPO : DB.CONGREGANTES;
    let gente = ids.map(DB.persona);
    // Inscritos EN VIVO del landing (STORE) → aparecen en los roles cuyo alcance
    // cubre el grupo Café & Palabra (J+25). Así un registro nuevo fluye de punta
    // a punta: landing → líder → coordinador → pastor de sede → dirección general.
    const verVivos = ["pastor_admin", "pastor_sede", "coordinador", "lider"].indexOf(rol.id) > -1;
    if (verVivos && typeof DB.registrosVivos === "function") {
      gente = gente.concat(DB.registrosVivos());
    }
    // alcance por sede (RLS): la red global ve todo; las filiales solo su sede
    if (rol.alcance !== "global") gente = gente.filter(p => p.sede === estado.sede);
    const alcanceTxt = {
      pastor_admin: "Ves a <b>todas</b> las personas de la red. Como administrador principal, ves el récord de diezmos.",
      pastor_sede: "Ves a las personas de tu sede (Bogotá).",
      director: "Ves a las personas de tu ministerio.",
      coordinador: "Ves a las personas de tus grupos.",
      lider: "Ves únicamente a las personas de tu grupo.",
      tesoreria: "Acceso limitado: solo datos necesarios para finanzas."
    }[rol.id];
    const diezman = gente.filter(p => p.diezma).length;
    const sirviendo = gente.filter(p => p.etapa === "sirve").length;
    return `
    ${pageHead("CRM Pastoral", "Personas",
      alcanceTxt + " <b>El alcance lo controla tu rol (RLS).</b>",
      `<button class="btn btn--mostaza" data-accion="abrir-nuevo">✨ Registrar nuevo</button>`)}

    <div class="grid grid-4 mb-4">
      ${kpi("👥", gente.length, "Personas (alcance)")}
      ${kpi("🙌", sirviendo, "Sirviendo")}
      ${kpi("⚠️", gente.filter(p => p.riesgo).length, "En riesgo")}
      ${esAdminPrincipal ? kpi("💛", diezman + "/" + gente.length, "Diezman") : kpi("✨", gente.filter(p => p.esNuevo).length, "Nuevos")}
    </div>

    <div class="card mb-4">
      <div class="buscador mb-3"><span class="buscador__ico">🔎</span>
        <input type="search" placeholder="Buscar por nombre, correo, ministerio…" aria-label="Buscar persona" /></div>
      <div class="flex between items-center wrap gap-3">
        <div class="flex gap-2 wrap">
          <span class="chip activo">Todos</span><span class="chip">👋 Conoce</span><span class="chip">🔗 Conéctate</span>
          <span class="chip">🌱 Crece</span><span class="chip">🙌 Sirve</span><span class="chip">⚠️ En riesgo</span></div>
        <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="Exportando CRM a Excel…">⬇️ Exportar</button>
      </div>
    </div>

    <div class="card" style="padding:0; overflow:hidden">
      <div style="overflow-x:auto">
        <table class="tabla" style="min-width:${(esAdminPrincipal ? 920 : 820) + (verCedula ? 130 : 0)}px">
          <thead><tr>
            <th>Persona</th>${verCedula ? "<th>ID (Cédula)</th>" : ""}<th>Contacto</th><th>Iglesia</th><th>Ministerio</th>
            <th>Estado civil</th><th>Etapa</th>${esAdminPrincipal ? "<th>Diezmo</th>" : ""}<th></th>
          </tr></thead>
          <tbody>${gente.map(p => filaCRM(p, esAdminPrincipal, verCedula)).join("")}</tbody>
        </table>
      </div>
    </div>
    ${verCedula ? `<p class="txt-xs txt-suave mt-3">🪪 La columna <b>ID (Cédula)</b> solo es visible para pastores y equipos administrativos. Directores, coordinadores y líderes no la ven.</p>` : ""}
    ${esAdminPrincipal ? `<p class="txt-xs txt-suave mt-1">🔒 La columna <b>Diezmo</b> y el récord financiero solo son visibles para administradores principales. Los demás roles no ven esta información.</p>` : ""}`;
  }

  function filaCRM(p, admin, verCedula) {
    const civil = p.estadoCivil + (p.conyuge ? ` · ${p.conyuge}` : "");
    const diezmoCell = admin
      ? `<td>${p.diezma ? `<span class="badge badge--exito">✓ Diezma</span>` : `<span class="badge">No</span>`}</td>`
      : "";
    const cedulaCell = verCedula ? `<td class="txt-sm nowrap">🪪 ${window.CEDULA(p)}</td>` : "";
    return `<tr>
      <td><div class="flex gap-2 items-center">${avatar(p, "avatar--sm")}
        <div><b>${DB.nombre(p)}</b>${p.esNuevo ? ' <span class="badge badge--mostaza">Nuevo</span>' : ""}${p.riesgo ? ' <span class="badge badge--peligro">Riesgo</span>' : ""}
        <div class="txt-xs txt-suave">${p.rol}</div></div></div></td>
      ${cedulaCell}
      <td class="txt-xs"><div>✉️ ${p.email}</div><div class="txt-suave">📱 ${p.telefono}</div></td>
      <td class="nowrap">${DB.sede(p.sede).nombre}</td>
      <td>${p.ministerio || "—"}</td>
      <td class="txt-sm">${civil}</td>
      <td>${etapaBadge(p.etapa)}</td>
      ${diezmoCell}
      <td><button class="btn btn--ghost btn--sm" data-accion="ver-perfil" data-valor="${p.id}">Ver 360°</button></td>
    </tr>`;
  }

  function perfil(id, rol, estado) {
    const p = DB.persona(id);
    if (!p) return `<div class="vacio"><div class="ico">🤷</div>No se encontró la persona.</div>`;
    const g = p.grupo ? DB.grupo(p.grupo) : null;
    const resp = p.responsable ? DB.persona(p.responsable) : null;
    const puedeVerNotas = rol.id !== "tesoreria";
    const verCedula = ["pastor_admin", "pastor_sede", "tesoreria"].indexOf(rol.id) > -1;
    return `
    ${volver("personas", "Volver a personas")}
    <div class="card card--pad-lg mb-4" style="background:linear-gradient(135deg,var(--azul-800),var(--azul-900)); color:#fff; border:none">
      <div class="flex gap-4 items-center wrap">
        <div class="avatar avatar--lg" style="background:var(--mostaza-500); color:var(--azul-900)">${p.iniciales}</div>
        <div class="grow">
          <div class="flex gap-2 items-center wrap mb-2"><h1 style="font-size:var(--tx-xl)">${DB.nombre(p)}</h1>
            ${p.esNuevo ? `<span class="badge badge--mostaza">✨ Nuevo</span>` : ""}${p.riesgo ? `<span class="badge badge--peligro">⚠️ En riesgo</span>` : ""}</div>
          <div class="txt-sm" style="opacity:.85">${p.rol} · ${p.subestado || ""} · ${DB.sede(p.sede).nombre}</div>
        </div>
        <div class="flex gap-2 wrap">
          ${botonesContacto(p)}
          ${p.esNuevo ? `<button class="btn btn--ghost btn--sm" style="color:#fff;border-color:rgba(255,255,255,.4)" data-accion="seguir-nuevo">✨ Iniciar seguimiento</button>` : ""}
        </div>
      </div>
    </div>
    <div class="card card--pad-lg mb-4"><div class="card__title mb-3">🧭 Su recorrido espiritual</div>
      ${recorrido(p.etapa)}
      <div class="alerta alerta--info mt-4"><span class="ico">✨</span><div><b>Próximo paso sugerido (IA):</b> ${proximoPaso(p)}</div></div></div>
    <div class="grid grid-2 mb-4">
      <div class="card card--pad-lg"><div class="card__title mb-4">📅 Línea de tiempo</div>
        <div class="timeline">${[...p.hitos].reverse().map(h => `
          <div class="timeline__item"><span class="timeline__punto ${h.color}"></span>
            <div class="timeline__fecha">${h.fecha}</div>
            <div class="timeline__txt"><b>${h.tipo}</b> — ${h.txt}</div></div>`).join("")}</div></div>
      <div>
        <div class="card mb-4"><div class="card__title mb-3">📇 Datos</div>
          ${verCedula ? dato("🪪 ID (Cédula)", window.CEDULA(p)) : ""}
          ${dato("📱 Teléfono", p.telefono)}${dato("✉️ Correo", p.email)}
          ${dato("🎂 Edad", p.edad ? p.edad + " años" : "—")}${dato("💍 Estado civil", p.estadoCivil || "—")}
          ${dato("🚪 Cómo llegó", p.fuente || "—")}${g ? dato("🤝 Grupo", g.nombre) : ""}${resp ? dato("🧑‍🤝‍🧑 Responsable", DB.nombre(resp)) : ""}</div>
        ${puedeVerNotas ? tarjetaNotas(p) : `<div class="card"><div class="alerta alerta--aviso"><span class="ico">🔒</span><div>Las notas pastorales son confidenciales y no están disponibles para tu rol.</div></div></div>`}
      </div>
    </div>
    ${seccionesCRM(p, rol)}`;
  }

  function botonesContacto(p) {
    const tieneTel = p.telefono && p.telefono !== "—";
    const tieneMail = p.email && p.email.indexOf("@") > -1;
    const wa = tieneTel ? p.telefono.replace(/[^\d]/g, "") : "";
    const blanco = "color:#fff;border-color:rgba(255,255,255,.4)";
    const btns = [];
    if (tieneTel) btns.push(`<a class="btn btn--mostaza btn--sm" href="https://wa.me/${wa}" target="_blank" rel="noopener">💬 WhatsApp</a>`);
    if (tieneMail) btns.push(`<a class="btn btn--ghost btn--sm" style="${blanco}" href="mailto:${p.email}">✉️ Correo</a>`);
    if (tieneTel) btns.push(`<a class="btn btn--ghost btn--sm" style="${blanco}" href="tel:${wa}">📞 Llamar</a>`);
    if (!btns.length) btns.push(`<button class="btn btn--mostaza btn--sm" data-accion="contactar">📞 Contactar</button>`);
    return btns.join("");
  }

  function seccionesCRM(p, rol) {
    const esAdminPrincipal = rol.id === "pastor_admin";
    const cursos = p.cursos || [], conse = p.consejerias || [], ayudas = p.ayudasMas || [];
    const estadoColor = { "Completado": "exito", "En curso": "azul", "En curso · 60%": "azul", "Pendiente": "aviso" };
    return `
    <div class="grid grid-2 mb-4">
      <div class="card card--pad-lg">
        <div class="card__title mb-3">🎓 Formación</div>
        ${cursos.length ? cursos.map(c => `<div class="fila"><span style="font-size:1.1rem">📘</span>
          <div class="fila__main"><b>${c.nombre}</b></div>
          <span class="badge badge--${estadoColor[c.estado] || 'azul'}">${c.estado}</span></div>`).join("")
          : `<p class="txt-sm txt-suave">Sin cursos registrados aún.</p>`}
        ${p.instituto ? `<div class="alerta alerta--info mt-3"><span class="ico">🏫</span>
          <div>Instituto <b>${p.instituto.programa}</b> · Semestre ${p.instituto.semestre} · ${p.instituto.estado}
          <button class="btn btn--ghost btn--sm" style="margin-left:6px" data-accion="ir" data-valor="instituto">Ver →</button></div></div>`
          : `<p class="txt-xs txt-suave mt-2">No matriculado en IBLI / FACTER.</p>`}
      </div>

      <div class="card card--pad-lg">
        <div class="card__title mb-3">🤲 Consejería y ayudas</div>
        <div class="txt-xs txt-suave mb-2" style="text-transform:uppercase; letter-spacing:.04em">Consejerías solicitadas</div>
        ${conse.length ? conse.map(c => `<div class="fila"><span style="font-size:1.1rem">💬</span>
          <div class="fila__main"><b>${c.tema}</b><span>${c.fecha}</span></div>
          <span class="badge badge--${c.estado === 'Finalizada' ? 'exito' : c.estado === 'Solicitada' ? 'aviso' : 'azul'}">${c.estado}</span></div>`).join("")
          : `<p class="txt-sm txt-suave">Ninguna.</p>`}
        <div class="txt-xs txt-suave mb-2 mt-3" style="text-transform:uppercase; letter-spacing:.04em">Ayudas Fundación M.A.S</div>
        ${ayudas.length ? ayudas.map(a => `<div class="fila"><span style="font-size:1.1rem">❤️</span>
          <div class="fila__main"><b>${a.tipo}</b><span>${a.fecha}</span></div>
          <span class="badge badge--${a.estado === 'Finalizada' || a.estado === 'Entregada' ? 'exito' : 'azul'}">${a.estado}</span></div>`).join("")
          : `<p class="txt-sm txt-suave">Ninguna.</p>`}
        <button class="btn btn--ghost btn--sm btn--bloque mt-3" data-accion="demo" data-valor="Registrando solicitud de consejería…">＋ Solicitar consejería</button>
      </div>
    </div>

    ${esAdminPrincipal ? tarjetaDiezmos(p) : `<div class="card"><div class="alerta alerta--aviso"><span class="ico">🔒</span>
      <div><b>Aportes y diezmos:</b> información financiera reservada para administradores principales. Tu rol no tiene acceso.</div></div></div>`}`;
  }

  function tarjetaDiezmos(p) {
    const dz = p.diezmos || [];
    return `<div class="card card--pad-lg" style="border-left:4px solid var(--mostaza-500)">
      <div class="flex between items-center mb-3"><div class="card__title">💛 Aportes y diezmos <span class="badge badge--aviso">Admin principal</span></div>
        ${p.diezma ? `<span class="badge badge--exito">✓ Diezmador activo</span>` : `<span class="badge">No diezma actualmente</span>`}</div>
      <div class="grid grid-3 mb-3">
        ${kpi("📅", cop(p.diezmoAnual || 0), "Acumulado año")}
        ${kpi("🧾", dz.length, "Aportes registrados")}
        ${kpi("📈", dz.length ? cop(Math.round((p.diezmoAnual || 0) / 12)) : "$0", "Promedio mensual")}
      </div>
      ${dz.length ? `<div style="overflow-x:auto"><table class="tabla"><thead><tr><th>Periodo</th><th>Monto</th><th>Medio</th><th>Estado</th></tr></thead>
        <tbody>${dz.map(d => `<tr><td>${d.mes}</td><td><b>${cop(d.monto)}</b></td><td>Wompi</td><td><span class="badge badge--exito">Conciliado</span></td></tr>`).join("")}</tbody></table></div>`
        : `<p class="txt-sm txt-suave">Sin aportes registrados. Esta persona no figura como diezmador.</p>`}
      <p class="txt-xs txt-suave mt-3">Datos sincronizados con Siigo. Trazabilidad y confidencialidad garantizadas (Ley 1581).</p>
    </div>`;
  }

  function dato(lbl, val) {
    return `<div class="flex between" style="padding:8px 0; border-bottom:1px solid var(--borde)">
      <span class="txt-sm txt-suave">${lbl}</span><b class="txt-sm" style="text-align:right">${val}</b></div>`;
  }
  function tarjetaNotas(p) {
    const notas = p.notas || [], pet = p.peticiones || [];
    return `<div class="card"><div class="card__title mb-2">🔒 Notas pastorales <span class="badge badge--aviso">Confidencial</span></div>
      ${notas.length ? notas.map(n => `<div class="card mb-3" style="background:var(--superficie-2); box-shadow:none">
        <div class="txt-sm">${n.txt}</div><div class="txt-xs txt-suave mt-2">— ${n.autor} · ${n.fecha} · 👁️ ${n.conf}</div></div>`).join("")
        : `<p class="txt-sm txt-suave">Sin notas registradas.</p>`}
      ${pet.length ? `<div class="card__title mb-2 mt-3" style="font-size:var(--tx-sm)">🙏 Peticiones de oración</div>
        ${pet.map(x => `<div class="flex between items-center" style="padding:6px 0"><span class="txt-sm">${x.txt}</span><span class="badge badge--azul">${x.estado}</span></div>`).join("")}` : ""}
      <button class="btn btn--ghost btn--sm btn--bloque mt-3" data-accion="contactar">+ Agregar nota</button></div>`;
  }
  function proximoPaso(p) {
    switch (p.etapa) {
      case "conoce": return "Contactar para dar la bienvenida e invitar a un grupo de conexión afín a su momento de vida.";
      case "conecta": return p.riesgo ? "Lleva 4 semanas sin asistir: enviar un mensaje cálido y proponer un café esta semana."
        : "Inscribir en el curso <b>ADN</b> y animar a tomar el paso del bautizo.";
      case "crece": return "Acompañar a terminar Madurez Espiritual e invitar a servir en un equipo según sus dones.";
      case "sirve": return "Identificar a quién puede discipular y acompañar en su propio liderazgo.";
      default: return "Continuar el acompañamiento cercano.";
    }
  }

  /* ============================================================
     3) GRUPOS POR AFINIDAD
     ============================================================ */
  function grupos(rol, estado) {
    const esLider = ["lider", "coordinador", "director", "pastor_sede", "pastor_admin"].includes(rol.id);
    return `
    ${pageHead("Conéctate", "Grupos de conexión por afinidad",
      "Encuentra tu grupo ideal según tu momento de vida, cercanía y horario — o registra el tuyo.",
      esLider ? `<button class="btn btn--mostaza" data-accion="contactar">＋ Registrar grupo</button>` : "")}
    <div class="card mb-4" style="background:linear-gradient(135deg,var(--azul-50),var(--mostaza-100)); border-color:var(--mostaza-300)">
      <div class="card__title">✨ Recomendado para ti por la IA</div>
      <p class="card__sub mb-3">Según tu perfil (profesional, 26–35, zona norte, disponible jueves)</p>
      ${tarjetaGrupo(DB.grupo("g_j25_norte"), true)}
    </div>
    <div class="card mb-4">
      <div class="buscador mb-3"><span class="buscador__ico">🔎</span>
        <input type="search" placeholder="Buscar grupo por tema, líder o zona…" aria-label="Buscar grupo" /></div>
      <div class="flex gap-2 wrap" data-grupo-filtros>
        <span class="chip activo" data-accion="filtrar-grupo" data-valor="todos">Todos</span>
        <span class="chip" data-accion="filtrar-grupo" data-valor="Jóvenes 26–35">Jóvenes 26–35</span>
        <span class="chip" data-accion="filtrar-grupo" data-valor="Parejas">Parejas</span>
        <span class="chip" data-accion="filtrar-grupo" data-valor="Mujeres">Mujeres</span>
        <span class="chip" data-accion="filtrar-grupo" data-valor="Virtual">Virtual</span>
        <span class="chip" data-accion="filtrar-grupo" data-valor="Vocación: Salud">Salud</span></div>
    </div>
    <div id="lista-grupos">${listaGrupos("todos")}</div>`;
  }
  function listaGrupos(filtro) {
    let lista = DB.GRUPOS;
    if (filtro && filtro !== "todos") lista = DB.GRUPOS.filter(g => g.afinidad.some(a => a.includes(filtro)) || g.modalidad === filtro);
    if (!lista.length) return `<div class="vacio"><div class="ico">🔍</div>No hay grupos con ese filtro todavía. <br>¿Quieres <b>registrar uno nuevo</b>?</div>`;
    return `<div class="grid grid-auto">${lista.map(g => tarjetaGrupo(g)).join("")}</div>`;
  }
  function tarjetaGrupo(g, destacado) {
    const lleno = g.miembros >= g.cupo, lider = DB.persona(g.lider);
    return `<div class="card" ${destacado ? 'style="box-shadow:none; border-color:var(--mostaza-400)"' : ""}>
      <div class="flex between items-center mb-2"><b style="font-size:var(--tx-md)">${g.nombre}</b>
        ${lleno ? `<span class="badge badge--peligro">Cupo lleno</span>` : `<span class="badge badge--exito">${g.cupo - g.miembros} cupos</span>`}</div>
      <div class="flex gap-2 wrap mb-3">${g.afinidad.map(a => `<span class="badge badge--azul">${a}</span>`).join("")}</div>
      <div class="txt-sm txt-suave" style="line-height:1.9">🗓️ ${g.dia} · ${g.hora}<br>📍 ${g.zona} · ${g.modalidad}<br>🧑‍🤝‍🧑 Líder: ${DB.nombre(lider)} · ${g.miembros}/${g.cupo} personas</div>
      <div class="progreso mt-3"><div class="progreso__barra" style="width:${Math.round(g.miembros / g.cupo * 100)}%"></div></div>
      <button class="btn ${lleno ? "btn--ghost" : "btn--primario"} btn--bloque mt-3" ${lleno ? "disabled style='opacity:.5'" : ""} data-accion="unirme-grupo" data-valor="${g.id}">
        ${lleno ? "Lista de espera" : "Unirme a este grupo"}</button></div>`;
  }

  /* ============================================================
     4) CHECK-IN ROCAKIDS
     ============================================================ */
  function rocakidsLocal(rol, estado) {
    const dentro = DB.NINOS.filter(n => n.estado === "dentro"), fuera = DB.NINOS.filter(n => n.estado === "fuera");
    return `
    ${pageHead("RocaKids · Seguridad · " + DB.sede(estado.sede).nombre, "Check-in dominical",
      "Registro rápido y seguro de ingreso y entrega. Cada niño tiene un código único. <b>Meta: < 30 s por niño.</b>")}
    <div class="grid grid-3 mb-4">${kpi("✅", dentro.length, "Dentro ahora")}${kpi("🏠", fuera.length, "Por ingresar")}${kpi("🔐", "100%", "Con código seguro")}</div>
    <div class="card mb-4"><div class="buscador"><span class="buscador__ico">🔎</span>
      <input type="search" placeholder="Buscar niño o acudiente…" aria-label="Buscar niño" /></div></div>
    <div class="card mb-4"><div class="card__title mb-3">🏠 Por ingresar (${fuera.length})</div>
      ${fuera.length ? fuera.map(n => filaNino(n, "checkin")).join("") : `<p class="txt-sm txt-suave">Todos los niños están dentro 🎉</p>`}</div>
    <div class="card"><div class="card__title mb-3">✅ Dentro · listos para entregar (${dentro.length})</div>
      ${dentro.length ? dentro.map(n => filaNino(n, "checkout")).join("") : `<div class="vacio"><div class="ico">🧒</div>Aún no hay niños registrados hoy.</div>`}</div>`;
  }
  function filaNino(n, modo) {
    const dentro = n.estado === "dentro";
    const accion = modo === "checkin"
      ? `<button class="btn btn--mostaza btn--sm" data-accion="checkin" data-valor="${n.id}">＋ Ingresar</button>`
      : `<button class="btn btn--ghost btn--sm" data-accion="checkout" data-valor="${n.id}">Entregar →</button>`;
    return `<div class="fila">
      <div class="avatar avatar--sm" style="background:var(--mostaza-200); color:var(--mostaza-700)">${n.nombre.split(" ").map(x => x[0]).slice(0, 2).join("")}</div>
      <div class="fila__main"><b>${n.nombre} <span class="txt-xs txt-suave">· ${n.edad} años</span></b>
        <span>${n.salon} · 👤 ${n.acudiente}${n.alergias !== "Ninguna" ? ` · ⚠️ ${n.alergias}` : ""}</span></div>
      <div class="flex gap-2 items-center"><span class="badge ${dentro ? "badge--exito" : "badge--azul"}">${n.codigo}${dentro && n.hora ? " · " + n.hora : ""}</span>${accion}</div></div>`;
  }

  /* ============================================================
     5) CURSOS CORTOS
     ============================================================ */
  function cursos(rol, estado) {
    return `
    ${pageHead("Crece", "Cursos cortos",
      "Inscríbete en línea. Recibirás correos automáticos de confirmación, recordatorio y certificado.",
      `<button class="btn btn--ghost" data-accion="ir" data-valor="instituto">🎓 Ir al Instituto →</button>`)}
    <div class="grid grid-auto">${DB.CURSOS.map(tarjetaCurso).join("")}</div>`;
  }
  function tarjetaCurso(c) {
    const lleno = c.inscritos >= c.cupo, e = DB.ETAPAS[c.etapa];
    return `<div class="card">
      <div class="flex gap-3 items-center mb-3"><div class="kpi__ico" style="background:var(--${e.clase === 'crece' ? 'exito-bg' : 'azul-100'})">${c.ico}</div>
        <div class="grow"><b style="font-size:var(--tx-md)">${c.nombre}</b><div class="txt-xs txt-suave">${c.duracion} · ${c.modalidad}</div></div></div>
      <p class="txt-sm txt-suave mb-3">${c.desc}</p>
      <div class="flex between items-center mb-3 txt-sm"><span>📅 ${c.inicia}</span>
        <span class="${lleno ? "badge badge--peligro" : "txt-suave"}">${lleno ? "Cupo lleno" : c.inscritos + "/" + c.cupo + " inscritos"}</span></div>
      <div class="progreso mb-3"><div class="progreso__barra" style="width:${Math.round(c.inscritos / c.cupo * 100)}%"></div></div>
      <button class="btn ${lleno ? "btn--ghost" : "btn--primario"} btn--bloque" ${lleno ? "disabled style='opacity:.5'" : ""} data-accion="inscribir" data-valor="${c.id}">
        ${lleno ? "Lista de espera" : "Inscribirme"}</button></div>`;
  }

  /* ============================================================
     6) DONACIONES / TESORERÍA
     ============================================================ */
  function donaciones(rol, estado) {
    const total = DB.DONACIONES.reduce((s, d) => s + d.monto, 0);
    const diezmos = DB.DONACIONES.filter(d => d.tipo.includes("Diezmo")).reduce((s, d) => s + d.monto, 0);
    const pend = DB.DONACIONES.filter(d => d.estado === "Pendiente").length;
    return `
    ${pageHead("ERP · Tesorería", "Donaciones y diezmos",
      "Aportes por pasarela, conciliados con Siigo. Sin doble digitación.")}
    <div class="grid grid-4 mb-4">${kpi("💛", cop(total), "Total (semana)")}${kpi("🙏", cop(diezmos), "Diezmos")}
      ${kpi("🔄", (DB.DONACIONES.length - pend) + "/" + DB.DONACIONES.length, "Conciliadas")}${kpi("⏳", pend, "Pendientes")}</div>
    <div class="grid grid-2 mb-4">
      <div class="card card--pad-lg"><div class="card__title mb-2">📈 Aportes por mes (millones COP)</div>
        <canvas id="grafico-don" height="180" aria-label="Gráfico de aportes mensuales"></canvas></div>
      <div class="card card--pad-lg"><div class="card__title mb-3">🏦 Por pasarela</div>
        ${barraPasarela("Wompi", 62, "azul-600")}${barraPasarela("PayU", 21, "mostaza-500")}
        ${barraPasarela("Mercado Pago", 12, "exito")}${barraPasarela("Stripe (int'l)", 5, "azul-400")}
        <div class="alerta alerta--exito mt-3"><span class="ico">✓</span><div>Conciliación con <b>Siigo</b> al día.</div></div></div>
    </div>
    <div class="card"><div class="flex between items-center mb-3"><div class="card__title">🧾 Movimientos recientes</div>
        <button class="btn btn--ghost btn--sm" data-accion="contactar">⬇️ Exportar</button></div>
      <div style="overflow-x:auto"><table class="tabla">
        <thead><tr><th>Fecha</th><th>Origen</th><th>Tipo</th><th>Monto</th><th>Pasarela</th><th>Estado</th></tr></thead>
        <tbody>${DB.DONACIONES.map(d => `<tr><td class="nowrap">${d.fecha}</td><td>${d.persona}</td><td>${d.tipo}</td>
          <td class="nowrap"><b>${cop(d.monto)}</b></td><td>${d.pasarela}</td>
          <td><span class="badge badge--${d.estado === "Conciliado" ? "exito" : "aviso"}">${d.estado}</span></td></tr>`).join("")}</tbody>
      </table></div></div>`;
  }
  function barraPasarela(nombre, p, color) {
    return `<div class="flex between items-center" style="gap:12px; margin-bottom:10px">
      <span class="txt-sm" style="width:120px">${nombre}</span>
      <div class="progreso grow"><div class="progreso__barra" style="width:${p}%; background:var(--${color})"></div></div>
      <b class="txt-sm" style="width:38px; text-align:right">${p}%</b></div>`;
  }

  /* ============================================================
     CONFIGURACIÓN — centro de control del pastor
     (activar/crear ministerios y equipos, roles, automatizaciones)
     ============================================================ */
  function config(rol, estado) {
    const esGlobal = rol.id === "pastor_admin";
    const congr = DB.MINISTERIOS.filter(m => m.tipo === "congregacional");
    const oper = DB.MINISTERIOS.filter(m => m.tipo === "operacional");
    return `
    ${pageHead("Administración", esGlobal ? "Configuración global" : "Configuración de mi sede",
      esGlobal
        ? "Defines la plantilla global del sistema y otorgas permisos a las filiales desde <b>Filiales</b>."
        : "Tu centro de control: <b>activa o crea</b> los ministerios congregacionales y equipos operativos que tu sede necesita.",
      esGlobal ? `<button class="btn btn--primario" data-accion="ir" data-valor="filiales">🏛️ Gestionar filiales</button>` : "")}

    <div class="alerta alerta--info mb-4"><span class="ico">🧩</span>
      <div>Activa lo que tu sede usa hoy y deja inactivo el resto. Puedes <b>crear</b> uno nuevo si no está en el catálogo. Lo que actives aparece en el menú y en los tableros.</div></div>

    <div class="card card--pad-lg mb-4">
      <div class="flex between items-center mb-3"><div class="card__title">🧒 Ministerios congregacionales</div>
        <button class="btn btn--mostaza btn--sm" data-accion="demo" data-valor="Abriendo formulario para crear un nuevo ministerio congregacional…">＋ Crear ministerio</button></div>
      ${congr.map(filaMinisterioConfig).join("")}
    </div>

    <div class="card card--pad-lg mb-4">
      <div class="flex between items-center mb-3"><div class="card__title">🛠️ Equipos operativos</div>
        <button class="btn btn--mostaza btn--sm" data-accion="demo" data-valor="Abriendo formulario para crear un nuevo equipo operativo…">＋ Crear equipo</button></div>
      ${oper.map(filaMinisterioConfig).join("")}
    </div>

    <div class="grid grid-2 mb-4">
      <div class="card card--pad-lg"><div class="card__title mb-3">👤 Roles y permisos</div>
        ${Object.values(DB.ROLES).map(r => `<div class="fila"><span style="font-size:1.3rem">${r.ico}</span>
          <div class="fila__main"><b>${r.nombre}</b><span>Alcance: ${r.alcance}</span></div>
          <button class="chip activo" data-accion="config-toggle">Activo</button></div>`).join("")}
        ${esGlobal ? "" : `<div class="alerta alerta--aviso mt-3"><span class="ico">ℹ️</span><div>Los permisos base los otorga la Dirección General. Tú gestionas a tu equipo dentro de ese marco.</div></div>`}
      </div>
      <div class="card card--pad-lg"><div class="card__title mb-3">⚙️ Automatizaciones</div>
        ${DB.AUTOMATIZACIONES.map(a => `<div class="fila"><div class="fila__main"><b>${a.nombre}</b><span>${a.desc}</span></div>
          <button class="chip ${a.activo ? "activo" : ""}" data-accion="config-toggle">${a.activo ? "Activado" : "Desactivado"}</button></div>`).join("")}</div>
    </div>`;
  }
  function filaMinisterioConfig(m) {
    return `<div class="fila">
      <span style="font-size:1.4rem; width:40px; text-align:center">${m.ico}</span>
      <div class="fila__main"><b>${m.nombre}</b><span>${m.desc}</span>
        ${m.activo ? `<div class="txt-xs txt-suave mt-1">👥 ${m.personas} personas · 🧑‍🏫 ${m.director} · 🙋 ${m.voluntarios} voluntarios</div>` : `<div class="txt-xs mt-1" style="color:var(--texto-tenue)">Inactivo — actívalo para empezar a usarlo</div>`}</div>
      <div class="flex gap-2 items-center">
        ${m.activo ? `<button class="btn btn--ghost btn--sm" data-accion="ver-ministerio" data-valor="${m.id}">Configurar</button>` : ""}
        <button class="chip ${m.activo ? "activo" : ""}" data-accion="toggle-ministerio" data-valor="${m.id}">${m.activo ? "Activo" : "Activar"}</button>
      </div></div>`;
  }

  /* ============================================================
     MODAL: registrar persona nueva
     ============================================================ */
  function modalNuevo() {
    return `<div class="modal" role="dialog" aria-modal="true" aria-label="Registrar persona nueva">
      <div class="modal__head"><h2>✨ Registrar persona nueva</h2>
        <p class="txt-sm txt-suave mt-2">Se asignará automáticamente a seguimiento y recibirá la secuencia de bienvenida.</p></div>
      <div class="modal__body">
        <div class="campo"><label for="nuevo-nombre">Nombre completo</label><input id="nuevo-nombre" type="text" placeholder="Ej: María Fernanda López" /></div>
        <div class="campo"><label for="nuevo-tel">Teléfono / WhatsApp</label><input id="nuevo-tel" type="tel" placeholder="+57 3xx xxx xxxx" /></div>
        <div class="campo"><label for="nuevo-fuente">¿Cómo llegó?</label>
          <select id="nuevo-fuente"><option>Formulario web 'Soy nuevo'</option><option>Invitado por alguien</option><option>Domingo presencial</option><option>Redes sociales</option></select></div>
        <div class="campo"><label for="nuevo-grupo">Sugerir grupo afín (IA)</label>
          <select id="nuevo-grupo">${DB.GRUPOS.map(g => `<option>${g.nombre}</option>`).join("")}</select></div>
      </div>
      <div class="modal__pie"><button class="btn btn--ghost grow" data-accion="cerrar-modal">Cancelar</button>
        <button class="btn btn--mostaza grow" data-accion="guardar-nuevo">Registrar y asignar</button></div>
    </div>`;
  }

  /* ============================================================
     ASISTENTE IA
     ============================================================ */
  function iaPanel(rol) {
    rol = rol || { id: null, nombre: "Invitado" };
    const sugerencias = {
      pastor_admin: ["¿Qué sede necesita atención?", "Resumen de nuevos esta semana", "¿Cómo van los aportes?"],
      pastor_sede: ["¿Quién está en riesgo?", "¿Qué ministerios tengo activos?", "Nuevos sin contactar"],
      director: ["¿Cuántos niños hay hoy?", "Voluntarios disponibles"],
      coordinador: ["¿Cómo van mis grupos?", "¿Qué líder necesita apoyo?"],
      lider: ["¿A quién debo dar seguimiento?", "Prepara mi reunión", "¿Quién falta hace tiempo?"],
      tesoreria: ["¿Cuánto se recaudó hoy?", "¿Hay pendientes de conciliar?"]
    }[rol.id] || ["¿En qué puedo ayudarte?"];
    return `
    <div class="ia-panel" id="ia-panel" role="dialog" aria-label="Asistente Casa Roca">
      <div class="ia-panel__head"><div class="av">✨</div>
        <div><b>Asistente Casa Roca</b><span>Respeta tus permisos · ${rol.nombre}</span></div>
        <button class="ia-panel__close" id="ia-close" aria-label="Cerrar">✕</button></div>
      <div class="ia-panel__body">
        <div class="ia-msg ia-msg--bot">Hola 👋 Soy tu asistente. Doy resúmenes, sugiero próximos pasos y te ayudo a cuidar a tu gente — siempre dentro de tu alcance de permisos.</div></div>
      <div class="ia-sug">${sugerencias.map(s => `<button data-pregunta="${s}">${s}</button>`).join("")}</div>
    </div>`;
  }
  function respuestaIA(pregunta, estado) {
    const q = pregunta.toLowerCase();
    if (q.includes("ministerio")) return `Tu sede tiene <b>${DB.MINISTERIOS.filter(m => m.activo).length} ministerios activos</b> de ${DB.MINISTERIOS.length} en catálogo. Centuriones y Ejecutivos están inactivos; puedes activarlos en Configuración.`;
    if (q.includes("riesgo") || q.includes("falta") || q.includes("seguimiento")) return "Detecté que <b>Laura Tobón</b> no asiste hace 4 semanas. Te sugiero un mensaje cálido hoy y proponerle un café. ¿Quieres que prepare un borrador? 💬";
    if (q.includes("reunión") || q.includes("prepara")) return "Para tu reunión del jueves: 11 confirmados, 1 en riesgo (Laura) y Valentina cumple el 60% de Madurez 🎉. Tema sugerido: gratitud.";
    if (q.includes("grupo")) return "Tus grupos suman 41 personas. <b>J+25 Virtual</b> tiene baja asistencia (9/20); te sugiero apoyar a su líder esta semana.";
    if (q.includes("líder") || q.includes("apoyo")) return "Daniel (J+25 · Café & Palabra) va muy bien. Diego (Nuevos en la fe) necesita acompañamiento: 3 personas dejaron de asistir.";
    if (q.includes("niño") || q.includes("hoy")) return `Hoy hay <b>${DB.NINOS.filter(n => n.estado === 'dentro').length} niños dentro</b> y ${DB.NINOS.filter(n => n.estado === 'fuera').length} por ingresar. El salón Pequeños necesita 1 voluntario más.`;
    if (q.includes("recaud") || q.includes("aporte") || q.includes("concili")) return `Esta semana se han recibido <b>${"$" + DB.DONACIONES.reduce((s, d) => s + d.monto, 0).toLocaleString("es-CO")}</b>. Hay ${DB.DONACIONES.filter(d => d.estado === 'Pendiente').length} movimientos por conciliar con Siigo.`;
    if (q.includes("nuevo")) return "Esta semana llegaron 5 personas nuevas; todas recibieron la bienvenida automática. <b>Sebastián Cardona</b> aún espera su primer contacto humano.";
    if (q.includes("sede")) return "<b>Madrid</b> tiene el índice de cuidado más bajo (49). Te recomiendo revisar el seguimiento de nuevos allí desde Filiales.";
    return "Puedo ayudarte con resúmenes de tu gente, próximos pasos y datos de tu alcance. Prueba una sugerencia de abajo 👇";
  }

  /* ============================================================
     activarVista: hooks post-render (gráficos)
     ============================================================ */
  function activarVista(ruta) {
    if (ruta === "donaciones") dibujarGrafico();
    if (typeof VIEWS_HOOKS !== "undefined") {}
  }
  function dibujarGrafico() {
    const cv = document.getElementById("grafico-don");
    if (!cv || !cv.getContext) return;
    const ctx = cv.getContext("2d");
    const w = cv.width = cv.offsetWidth, h = cv.height;
    ctx.clearRect(0, 0, w, h);
    const datos = DB.SERIE_DONACIONES, max = Math.max(...datos.map(d => d.valor)) * 1.15;
    const pad = 28, gw = (w - pad * 2) / datos.length;
    ctx.strokeStyle = "#E6E0D4"; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { const y = pad + (h - pad * 2) * i / 4; ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke(); }
    datos.forEach((d, i) => {
      const bh = (h - pad * 2) * (d.valor / max);
      const x = pad + gw * i + gw * 0.2, bw = gw * 0.6, y = h - pad - bh;
      const grad = ctx.createLinearGradient(0, y, 0, h - pad);
      grad.addColorStop(0, i === datos.length - 1 ? "#E3A52C" : "#2A66C4");
      grad.addColorStop(1, i === datos.length - 1 ? "#C8881A" : "#134291");
      ctx.fillStyle = grad; roundRect(ctx, x, y, bw, bh, 6); ctx.fill();
      ctx.fillStyle = "#56607A"; ctx.font = "11px Segoe UI, sans-serif"; ctx.textAlign = "center"; ctx.fillText(d.mes, x + bw / 2, h - 10);
      ctx.fillStyle = "#1B2540"; ctx.font = "bold 11px Segoe UI, sans-serif"; ctx.fillText(d.valor, x + bw / 2, y - 6);
    });
  }
  function roundRect(ctx, x, y, w, h, r) {
    if (h < r) r = h; ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, 0); ctx.arcTo(x, y + h, x, y, 0); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  return {
    H, login, shell, panel, personas, perfil, grupos, cursos, rocakids: rocakidsLocal, rocakidsLocal, donaciones, config,
    modalNuevo, iaPanel, respuestaIA, listaGrupos, activarVista,
    tarjetaGrupo, filaNino, dato
  };
})();
