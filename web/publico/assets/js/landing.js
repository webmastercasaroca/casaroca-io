/* ============================================================
   CASA ROCA — EXPERIENCIA PÚBLICA (Funnel 4C) · motor
   Render de Conoce/Conéctate/Crece/Sirve + interacciones:
   selector de ciudad, chat con director (WhatsApp), formulario
   único reutilizable con QR por ministerio/grupo/curso/equipo,
   filtro de afinidades, confirmación correo+WhatsApp, deep links.
   ============================================================ */
(function () {
  const DB = window.DB;
  const L = window.LANDING;

  const estado = { ciudad: "bogota", filtro: "all", paso: "conoce", predicaCiudad: "bogota", crece: "bogota" };
  const PASOS = ["conoce", "conecta", "crece", "sirve"];
  function ciudadNombre(id) { if (id === "global") return "Toda la red"; const c = L.CIUDADES.find(x => x.id === id); return c ? c.nombre : id; }
  function predicasFiltradas() { return estado.predicaCiudad === "all" ? L.PREDICAS.slice() : L.predicasDe(estado.predicaCiudad); }

  /* ---------- Crece: cursos del STORE (lo que edita el pastor) + institutos ---------- */
  const MESES_C = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  function fechaCursoTxt(iso) {
    if (!iso) return "Próximamente";
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d)) return iso;
    return `${d.getDate()} ${MESES_C[d.getMonth()]} ${d.getFullYear()}`;
  }
  function normCurso(c) {
    const inst = c.tipo === "instituto";
    return {
      id: c.id, nombre: c.nombre, ico: c.ico, desc: c.desc, profesor: c.profesor,
      modalidad: c.modalidad, tipo: inst ? "instituto" : "curso",
      horario: inst ? c.horario : `${c.dia || ""}${c.dia && c.sesiones ? " · " : ""}${c.sesiones || ""}`,
      inicia: inst ? c.inicia : fechaCursoTxt(c.inicia),
      inscritos: c.inscritos, cupo: c.cupo
    };
  }
  function creceLista() {
    const S = window.STORE;
    const cursos = (S && S.cursosDe ? S.cursosDe(estado.crece) : []).filter(c => c.activo !== false);
    const institutos = (L.CRECE || []).filter(c => c.tipo === "instituto");
    return cursos.map(normCurso).concat(institutos.map(normCurso));
  }
  function creceCurso(id) {
    const S = window.STORE;
    return (S && S.curso && S.curso(id)) || (L.curso && L.curso(id)) || null;
  }
  function refrescarCrece() {
    document.querySelectorAll("#lp-crece-filtros .lp-chip").forEach(c => c.classList.toggle("activo", c.dataset.ciudad === estado.crece));
    const grid = document.getElementById("lp-crece-grid");
    if (grid) grid.innerHTML = creceLista().map(creceCard).join("");
  }

  /* ---------- Utilidades ---------- */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const $ = sel => document.querySelector(sel);
  function pct(a, b) { return b ? Math.min(100, Math.round((a / b) * 100)) : 0; }

  // Deep link absoluto a esta misma página con parámetros (lo codifica el QR)
  function deepLink(params) {
    let base = location.origin && location.origin !== "null"
      ? location.origin + location.pathname
      : "https://casaroca.org/experiencia";
    const q = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
    return base + "?" + q;
  }
  function qrImg(url) {
    const src = "https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&data=" + encodeURIComponent(url);
    return `<img src="${src}" alt="Código QR para inscribirse"
      onerror="this.parentNode.innerHTML='<span style=&quot;font-size:11px;color:var(--texto-tenue);text-align:center;padding:6px&quot;>QR<br>(en línea)</span>'">`;
  }

  /* ============================================================
     RUTEO — un solo formulario que ubica por ESTADO CIVIL → EDAD → ETAPA.
     Hombres de Bien / Mujer Integral NO entran al ruteo automático:
     se accede haciendo clic directo en su tarjeta (define el género).
     ============================================================ */
  const MIN_META = {
    m_rocakids: { nombre: "RocaKids", ico: "🧒" }, m_tmt: { nombre: "tMt", ico: "🎸" },
    m_j25: { nombre: "J+25", ico: "🌱" }, m_josues: { nombre: "Josués", ico: "🧗" },
    m_casa2: { nombre: "Casa2 (Casados)", ico: "💍" }, m_dorados: { nombre: "Años Dorados", ico: "🌅" },
    m_hombres: { nombre: "Hombres de Bien", ico: "🛡️" }, m_mujer: { nombre: "Mujer Integral", ico: "🌷" },
  };
  const BANDAS = [
    { id: "m_rocakids", min: 0, max: 10 }, { id: "m_tmt", min: 11, max: 25 },
    { id: "m_j25", min: 26, max: 34 }, { id: "m_josues", min: 35, max: 54 }, { id: "m_dorados", min: 55, max: 130 },
  ];
  function bandaPorEdad(edad) {
    if (edad === "" || edad == null) return null;
    const e = Number(edad);
    if (!Number.isFinite(e) || e < 0) return null;
    const b = BANDAS.find(x => e >= x.min && e <= x.max);
    return b ? b.id : "m_dorados";
  }
  function esCasado(c) { return /casad|uni[oó]n libre/i.test(c || ""); }
  function ruteoAuto(p) {
    if (esCasado(p.civil)) return { id: "m_casa2", motivo: "Por tu estado civil (casado · unión libre)" };
    const id = bandaPorEdad(p.edad);
    if (!id) return { id: null, motivo: "Indica tu edad para ubicarte" };
    return { id, motivo: "Por tu edad y etapa de vida" };
  }
  function etapasPorEdad(edad) {
    if (edad === "" || edad == null) return [];
    const e = Number(edad);
    if (!Number.isFinite(e)) return [];
    if (e <= 10) return ["Pre-kínder", "Primero", "Segundo", "Tercero", "Cuarto", "Quinto"];
    if (e <= 25) {
      const uni = [];
      for (let i = 1; i <= 10; i++) uni.push(`Universidad · ${i}° semestre`);
      return ["Sexto", "Séptimo", "Octavo", "Noveno", "Décimo", "Once", ...uni, "Receso preuniversitario", "Primer trabajo"];
    }
    if (e <= 34) return ["Profesional / trabajando", "Emprendiendo", "Buscando empleo", "Posgrado"];
    if (e <= 54) return ["Profesional / trabajando", "Emprendiendo", "Independiente"];
    return ["Activo / trabajando", "Jubilado(a)", "Adulto mayor"];
  }
  const ANOS_CASADO = ["0–3 años", "4–10 años", "11–20 años", "21–49 años", "50 años o más"];

  /* ============================================================
     TOP BAR + HERO
     ============================================================ */
  function topbar() {
    const c = L.ciudad(estado.ciudad);
    return `
    <header class="lp-top"><div class="lp-top__row">
      <a class="lp-brand" href="#top" aria-label="Casa Roca, inicio">
        <span class="lp-brand__logo">CR</span>
        <span class="lp-brand__name">Casa Roca<small>Sobre la Roca</small></span>
      </a>
      <nav class="lp-nav" aria-label="Pasos" role="tablist">
        <a href="#conoce"  role="tab" aria-selected="${estado.paso === "conoce"}"  class="${estado.paso === "conoce" ? "activo" : ""}"  data-accion="paso" data-paso="conoce">Conoce</a><a href="#conecta" role="tab" aria-selected="${estado.paso === "conecta"}" class="${estado.paso === "conecta" ? "activo" : ""}" data-accion="paso" data-paso="conecta">Conéctate</a><a href="#crece"   role="tab" aria-selected="${estado.paso === "crece"}"   class="${estado.paso === "crece" ? "activo" : ""}"   data-accion="paso" data-paso="crece">Crece</a><a href="#sirve"   role="tab" aria-selected="${estado.paso === "sirve"}"   class="${estado.paso === "sirve" ? "activo" : ""}"   data-accion="paso" data-paso="sirve">Sirve</a>
      </nav>
      <span class="lp-top__spacer"></span>
      <label class="lp-city" title="Elige tu ciudad">📍
        <select id="lp-sel-ciudad" aria-label="Ciudad">
          ${L.CIUDADES.map(x => `<option value="${x.id}" ${x.id === estado.ciudad ? "selected" : ""}>${esc(x.nombre)}</option>`).join("")}
        </select>
      </label>
    </div></header>`;
  }

  function hero() {
    const pasos = [
      { id: "conoce", n: "1", cls: "et-conoce", t: "Conoce", d: "Prédicas, horarios y ministerios" },
      { id: "conecta", n: "2", cls: "et-conecta", t: "Conéctate", d: "Encuentra tu grupo pequeño" },
      { id: "crece", n: "3", cls: "et-crece", t: "Crece", d: "Cursos e Instituto bíblico" },
      { id: "sirve", n: "4", cls: "et-sirve", t: "Sirve", d: "Sé parte de un equipo" }
    ];
    return `
    <section class="lp-hero" id="top"><div class="lp-hero__inner">
      <span class="lp-hero__eyebrow">✦ Una casa cálida y segura</span>
      <h1>Aquí tienes un lugar.<br><span class="hl">Da tu primer paso.</span></h1>
      <p class="lp-hero__lead">Bienvenido a Casa Roca. Te acompañamos en cuatro pasos sencillos para conocer,
        conectarte, crecer y servir. Empieza por donde estés hoy.</p>
      <div class="lp-hero__cta">
        <button class="lp-btn lp-btn--mostaza lp-btn--cta" data-accion="form" data-tipo="auto" data-id="auto">Regístrate y te ubicamos</button>
        <a class="lp-btn lp-btn--ghost lp-btn--cta" style="color:#fff;border-color:rgba(255,255,255,0.4)" href="#conoce" data-accion="paso" data-paso="conoce">Explorar ministerios</a>
      </div>
      <div class="lp-steps">
        ${pasos.map(p => `
          <a class="lp-step" href="#${p.id}" data-accion="paso" data-paso="${p.id}">
            <span class="lp-step__n ${p.cls}">${p.n}</span>
            <b>${p.t}</b><span>${p.d}</span>
          </a>`).join("")}
      </div>
    </div></section>`;
  }

  // Cinta de texto infinita (marquee) — firma editorial estilo pic-time.
  function marquee() {
    const words = ["Conoce", "Conéctate", "Crece", "Sirve", "Conocer", "Acompañar", "Ayudar", "Rodear"];
    const row = words.map(w => `<span>${w}</span><span class="dot">✦</span>`).join("");
    return `<div class="lp-marquee" aria-hidden="true"><div class="lp-marquee__track">${row}${row}</div></div>`;
  }

  // Barra de pestañas (las 4C como filtros). Visible en móvil; en desktop va la nav del header.
  function tabbar() {
    const lbl = { conoce: "Conoce", conecta: "Conéctate", crece: "Crece", sirve: "Sirve" };
    return `<div class="lp-tabbar" role="tablist" aria-label="Pasos">
      ${PASOS.map(id => `<button role="tab" aria-selected="${estado.paso === id}" class="${estado.paso === id ? "activo" : ""}" data-accion="paso" data-paso="${id}">${lbl[id]}</button>`).join("")}
    </div>`;
  }

  /* ============================================================
     1 · CONOCE — prédicas por ciudad, horarios y ministerios
     ============================================================ */
  function secHead(num, cls, clsT, eyebrow, titulo, desc) {
    return `<div class="lp-sec-head">
      <div class="lp-sec-num ${clsT}"><i class="${cls}">${num}</i> ${eyebrow}</div>
      <h2>${titulo}</h2><p>${desc}</p></div>`;
  }

  function predicaCard(p) {
    return `<article class="lp-pred__card">
      <div class="lp-pred__thumb">
        <span class="serie">${esc(p.serie)}</span>
        <span class="play" aria-hidden="true">▶</span>
        <span class="city">📍 ${esc(ciudadNombre(p.ciudad))}</span>
        <span class="dur">${esc(p.duracion)}</span>
      </div>
      <div class="lp-pred__body">
        <h4>${esc(p.titulo)}</h4>
        <div class="meta">${esc(p.predicador)} · ${esc(p.fecha)} · ${esc(p.vistas)} vistas</div>
      </div></article>`;
  }

  function servicios() {
    const c = L.ciudad(estado.ciudad);
    return `<div class="lp-info" id="lp-servicios">
      <h3>🕘 Horarios de la iglesia · ${esc(c.nombre)}</h3>
      <p class="lp-muted">${esc(c.direccion)} — te esperamos este domingo.</p>
      <div class="lp-info__servicios">
        ${c.servicios.map(s => `<span class="lp-time">${esc(s)}</span>`).join("")}
      </div>
    </div>`;
  }

  // Las 7 categorías por etapa de vida (reemplazan la lista de ministerios).
  const CATEGORIAS = [
    { id: "ninos",    ico: "🧒",  nombre: "Niñ@s",            desc: "Bebés a 5° de primaria · 0–10 años" },
    { id: "jovenes",  ico: "🎸",  nombre: "Jóvenes",          desc: "Bachillerato y universidad · 11–25 años" },
    { id: "solteros", ico: "🌱",  nombre: "Adultos", desc: "Solteros que trabajan · 26–54 años" },
    { id: "casados",  ico: "💍",  nombre: "Casados",          desc: "Matrimonios y parejas" },
    { id: "hombres",  ico: "🛡️", nombre: "Hombres",          desc: "Hombres de toda edad" },
    { id: "mujeres",  ico: "🌷",  nombre: "Mujeres",          desc: "Mujeres de toda edad" },
    { id: "mayores",  ico: "🌅",  nombre: "Adultos mayores",  desc: "55 años en adelante" },
  ];
  function categoriaCard(cat) {
    return `<article class="lp-card">
      <div class="lp-card__top">
        <div class="lp-emoji">${cat.ico}</div>
        <div><h3>${esc(cat.nombre)}</h3><p class="lp-muted">${esc(cat.desc)}</p></div>
      </div>
      <div class="lp-card__actions">
        <button class="lp-btn lp-btn--primary lp-btn--sm lp-btn--block" data-accion="form" data-tipo="cat" data-id="${cat.id}">Registrarme aquí</button>
      </div>
    </article>`;
  }

  function ministerioCard(cg) {
    const m = DB.ministerio(cg.min);
    if (!m) return "";
    return `<article class="lp-card">
      <div class="lp-card__top">
        <div class="lp-emoji">${m.ico}</div>
        <div><h3>${esc(m.nombre)}</h3><p class="lp-muted">${esc(cg.publico)}</p></div>
      </div>
      <div class="lp-meta">
        <span class="lp-pill">🗓️ ${esc(cg.horarioMes)}</span>
      </div>
      <div class="lp-meta">
        <span class="lp-pill lp-pill--warn">✨ ${esc(cg.encuentro)}</span>
      </div>
      <p class="lp-muted">Director: <b>${esc(cg.director)}</b></p>
      <div class="lp-card__actions">
        <a class="lp-btn lp-btn--wa lp-btn--sm" target="_blank" rel="noopener"
           href="https://wa.me/${cg.wa}?text=${encodeURIComponent("Hola, soy nuevo y quiero conocer el ministerio " + m.nombre)}">
           💬 Chat con el director</a>
        <button class="lp-btn lp-btn--primary lp-btn--sm" data-accion="form" data-tipo="ministerio" data-id="${cg.min}">
           Inscribirme · QR</button>
      </div>
    </article>`;
  }

  function seccionConoce() {
    return `
    <section class="lp-section" id="conoce" ${estado.paso === "conoce" ? "" : "hidden"}><div class="lp-wrap">
      ${secHead("1", "et-conoce", "et-conoce-t", "Paso 1", "Conoce",
        "Mira las prédicas de las iglesias, revisa los horarios y descubre los ministerios. Si quieres congregarte, escribe directo al director o inscríbete con un toque.")}

      <div class="lp-eyebrow et-conoce-t" style="margin-bottom:var(--sp-2)">📺 Prédicas de Casa Roca</div>
      <p class="lp-muted" style="margin:0 0 var(--sp-3)">Filtra por iglesia para ver las prédicas de cada ciudad.</p>
      <div class="lp-filtros" id="lp-pred-filtros" role="tablist" aria-label="Filtrar prédicas por iglesia">
        <button class="lp-chip ${estado.predicaCiudad === "all" ? "activo" : ""}" data-accion="predfiltro" data-ciudad="all">🌐 Todas</button>
        ${L.CIUDADES.map(c => `<button class="lp-chip ${estado.predicaCiudad === c.id ? "activo" : ""}" data-accion="predfiltro" data-ciudad="${c.id}">📍 ${esc(c.nombre)}</button>`).join("")}
      </div>
      <div class="lp-pred" id="lp-pred-grid">
        ${predicasFiltradas().map(predicaCard).join("")}
      </div>

      <div style="margin:var(--sp-6) 0">${servicios()}</div>

      <div class="lp-eyebrow et-conoce-t" style="margin-bottom:var(--sp-2)">🧩 ¿En qué etapa estás?</div>
      <p class="lp-muted" style="margin:-4px 0 var(--sp-4)">Elige tu grupo y te conectamos con tu ministerio. Te ubicamos por tu edad y etapa de vida.</p>
      <div class="lp-grid">
        ${CATEGORIAS.map(categoriaCard).join("")}
      </div>
    </div></section>`;
  }

  /* ============================================================
     2 · CONÉCTATE — filtro por ministerio + directorio de afinidades
     ============================================================ */
  function afinidadCard(a) {
    const m = DB.ministerio(a.min);
    const p = pct(a.miembros, a.cupo);
    const lleno = a.miembros >= a.cupo;
    return `<article class="lp-card">
      <div class="lp-card__top">
        <div class="lp-emoji">${m ? m.ico : "🤝"}</div>
        <div><h3>${esc(a.nombre)}</h3><p class="lp-muted">${m ? esc(m.nombre) : ""} · ${esc(a.modalidad)}</p></div>
      </div>
      <p class="lp-muted">${esc(a.queHacen)}</p>
      <div class="lp-meta">
        <span class="lp-pill">📅 ${esc(a.dia)} ${esc(a.hora)}</span>
        <span class="lp-pill">📍 ${esc(a.lugar)}</span>
      </div>
      <p class="lp-muted">Líder: <b>${esc(a.lider)}</b> · ${a.miembros}/${a.cupo} personas</p>
      <div class="lp-cupo"><i style="width:${p}%"></i></div>
      <div class="lp-card__actions">
        <button class="lp-btn ${lleno ? "lp-btn--ghost" : "lp-btn--primary"} lp-btn--sm lp-btn--block"
          data-accion="form" data-tipo="grupo" data-id="${a.id}" ${lleno ? "disabled" : ""}>
          ${lleno ? "Grupo lleno — ver otros" : "Registrarme en este grupo"}</button>
      </div>
    </article>`;
  }

  function listaAfinidades() {
    const items = L.afinidadesDe(estado.filtro);
    if (!items.length) return `<p class="lp-muted">Aún no hay grupos publicados en este ministerio. Prueba con otro filtro.</p>`;
    return items.map(afinidadCard).join("");
  }

  function seccionConecta() {
    const mins = L.ministeriosConAfinidad();
    return `
    <section class="lp-section" id="conecta" ${estado.paso === "conecta" ? "" : "hidden"}><div class="lp-wrap">
      ${secHead("2", "et-conecta", "et-conecta-t", "Paso 2", "Conéctate",
        "Un grupo pequeño (de afinidad) es donde realmente perteneces: un líder y pocas personas que caminan juntas. Filtra por ministerio y elige el tuyo.")}
      <div class="lp-filtros" id="lp-filtros" role="tablist" aria-label="Filtrar por ministerio">
        <button class="lp-chip ${estado.filtro === "all" ? "activo" : ""}" data-accion="filtro" data-filtro="all">Todos</button>
        ${mins.map(m => `<button class="lp-chip ${estado.filtro === m.id ? "activo" : ""}" data-accion="filtro" data-filtro="${m.id}">${m.ico} ${esc(m.nombre)}</button>`).join("")}
      </div>
      <div class="lp-grid" id="lp-afinidades">${listaAfinidades()}</div>
    </div></section>`;
  }

  /* ============================================================
     3 · CRECE — cursos cortos + Instituto (IBLI / FACTER)
     ============================================================ */
  function creceCard(c) {
    const inst = c.tipo === "instituto";
    return `<article class="lp-card">
      <div class="lp-card__top">
        <div class="lp-emoji">${c.ico}</div>
        <div><h3>${esc(c.nombre)}</h3><p class="lp-muted">${inst ? "Instituto bíblico" : "Curso corto"} · ${esc(c.modalidad)}</p></div>
      </div>
      <p class="lp-muted">${esc(c.desc)}</p>
      <div class="lp-meta">
        <span class="lp-pill">🧑‍🏫 ${esc(c.profesor)}</span>
        <span class="lp-pill">🗓️ ${esc(c.horario)}</span>
      </div>
      <div class="lp-meta">
        <span class="lp-pill ${inst ? "" : "lp-pill--ok"}">▶ ${esc(c.inicia)}</span>
        <span class="lp-pill">${c.inscritos}/${c.cupo} inscritos</span>
      </div>
      <div class="lp-card__actions">
        <button class="lp-btn lp-btn--primary lp-btn--sm lp-btn--block" data-accion="form" data-tipo="curso" data-id="${c.id}">
          ${inst ? "Quiero más información / matricularme" : "Inscribirme a este curso"}</button>
      </div>
    </article>`;
  }

  function seccionCrece() {
    const filtros = `<div class="lp-filtros" id="lp-crece-filtros" role="tablist" aria-label="Filtrar cursos por iglesia">
        ${L.CIUDADES.map(c2 => `<button class="lp-chip ${estado.crece === c2.id ? "activo" : ""}" data-accion="crecefiltro" data-ciudad="${c2.id}">📍 ${esc(c2.nombre)}</button>`).join("")}
      </div>`;
    return `
    <section class="lp-section" id="crece" ${estado.paso === "crece" ? "" : "hidden"}><div class="lp-wrap">
      ${secHead("3", "et-crece", "et-crece-t", "Paso 3", "Crece",
        "Cada sede abre sus cursos cortos con fechas, horarios y modalidad propios. Elige tu ciudad. Los Institutos IBLI · FACTER son virtuales para toda la red.")}
      ${filtros}
      <div class="lp-grid" id="lp-crece-grid">
        ${creceLista().map(creceCard).join("")}
      </div>
    </div></section>`;
  }

  /* ============================================================
     4 · SIRVE — equipos operativos + convocatoria trimestral
     ============================================================ */
  function sirveCard(s) {
    return `<article class="lp-card">
      <div class="lp-card__top">
        <div class="lp-emoji">${s.ico}</div>
        <div><h3>${esc(s.nombre)}</h3><p class="lp-muted">${esc(s.buscan)}</p></div>
      </div>
      <p class="lp-muted">${esc(s.intro)}</p>
      <p class="lp-muted">Líder: <b>${esc(s.lider)}</b></p>
      <div class="lp-card__actions">
        <a class="lp-btn lp-btn--wa lp-btn--sm" target="_blank" rel="noopener"
          href="https://wa.me/${s.wa}?text=${encodeURIComponent("Hola, quiero servir en el equipo " + s.nombre)}">💬 Preguntar</a>
        <button class="lp-btn lp-btn--mostaza lp-btn--sm" data-accion="form" data-tipo="sirve" data-id="${s.id}">Quiero ser parte · QR</button>
      </div>
    </article>`;
  }

  function convocatoria() {
    const c = L.CONVOCATORIA;
    if (!c.activa) return "";
    return `<div class="lp-convoc">
      <span class="lp-convoc__tag">⚡ Convocatoria abierta</span>
      <h3>${esc(c.titulo)}</h3>
      <p>${esc(c.subtitulo)}</p>
      <div class="lp-convoc__facts">
        <div class="lp-convoc__fact"><b>${esc(c.cupos)}</b><span>disponibles</span></div>
        <div class="lp-convoc__fact"><b>${esc(c.cierre)}</b><span>fecha límite</span></div>
        <div class="lp-convoc__fact"><b>${esc(c.encuentro)}</b><span>siguiente paso</span></div>
      </div>
      <button class="lp-btn lp-btn--mostaza lp-btn--cta" data-accion="form" data-tipo="convoc" data-id="convoc">Postularme para servir</button>
    </div>`;
  }

  function seccionSirve() {
    return `
    <section class="lp-section" id="sirve" ${estado.paso === "sirve" ? "" : "hidden"}><div class="lp-wrap">
      ${secHead("4", "et-sirve", "et-sirve-t", "Paso 4", "Sirve",
        "Pasa de asistir a pertenecer. Elige un equipo donde te gustaría servir y postúlate con un toque o escaneando su QR.")}
      <div class="lp-grid">
        ${L.SIRVE.map(sirveCard).join("")}
      </div>
      ${convocatoria()}
    </div></section>`;
  }

  function footer() {
    return `<footer class="lp-foot"><div class="lp-foot__inner">
      <div><div class="lp-brand" style="color:#fff"><span class="lp-brand__logo">CR</span>
        <span class="lp-brand__name" style="color:#fff">Casa Roca<small style="color:rgba(255,255,255,0.6)">Una casa cálida y segura</small></span></div>
        <p style="margin:var(--sp-3) 0 0;max-width:38ch">Conoce · Conéctate · Crece · Sirve. Tu primer paso empieza hoy.</p></div>
      <div><b style="color:#fff">Pasos</b>
        <p style="margin:var(--sp-2) 0 0"><a href="#conoce" data-accion="paso" data-paso="conoce">Conoce</a> · <a href="#conecta" data-accion="paso" data-paso="conecta">Conéctate</a> · <a href="#crece" data-accion="paso" data-paso="crece">Crece</a> · <a href="#sirve" data-accion="paso" data-paso="sirve">Sirve</a></p></div>
      <div><small>Tus datos se tratan conforme a la Ley 1581/2012 (Colombia) y GDPR.<br>Prototipo Fase 0 · datos de demostración.<br><a href="index.html">Ingreso del equipo →</a></small></div>
    </div></footer>`;
  }

  /* ============================================================
     RENDER PRINCIPAL
     ============================================================ */
  function render() {
    const app = document.getElementById("lp-app");
    app.innerHTML = topbar() + hero() + marquee() + tabbar() +
      `<div id="lp-secciones">` + seccionConoce() + seccionConecta() + seccionCrece() + seccionSirve() + `</div>` +
      footer();
    enlazar();
    revelar();
    sincronizarTop();
  }

  function enlazar() {
    const sel = document.getElementById("lp-sel-ciudad");
    if (sel) sel.addEventListener("change", e => {
      estado.ciudad = e.target.value;
      estado.predicaCiudad = estado.ciudad; // el filtro de prédicas sigue a la ciudad elegida
      render(); // conserva el paso activo (estado.paso) y actualiza horarios + prédicas
      toast(`Ciudad activa: ${L.ciudad(estado.ciudad).nombre}`, true);
    });
    document.getElementById("lp-app").addEventListener("click", manejar);

    // El pastor edita sus cursos en otra pestaña/rol → el STORE emite y
    // refrescamos la grilla de Crece en vivo (misma fuente de verdad).
    if (window.STORE && window.STORE.onCambio) {
      window.STORE.onCambio(() => { if (document.getElementById("lp-crece-grid")) refrescarCrece(); });
    }
  }

  function manejar(e) {
    const el = e.target.closest("[data-accion]");
    if (!el) return;
    const a = el.dataset.accion;
    if (a === "paso") {
      e.preventDefault();
      irPaso(el.dataset.paso);
    } else if (a === "predfiltro") {
      estado.predicaCiudad = el.dataset.ciudad;
      document.querySelectorAll("#lp-pred-filtros .lp-chip").forEach(c => c.classList.toggle("activo", c.dataset.ciudad === estado.predicaCiudad));
      const grid = document.getElementById("lp-pred-grid");
      if (grid) grid.innerHTML = predicasFiltradas().map(predicaCard).join("");
    } else if (a === "filtro") {
      estado.filtro = el.dataset.filtro;
      document.querySelectorAll("#lp-filtros .lp-chip").forEach(c => c.classList.toggle("activo", c.dataset.filtro === estado.filtro));
      const cont = document.getElementById("lp-afinidades");
      if (cont) cont.innerHTML = listaAfinidades();
    } else if (a === "crecefiltro") {
      estado.crece = el.dataset.ciudad;
      refrescarCrece();
    } else if (a === "form") {
      abrirForm(el.dataset.tipo, el.dataset.id);
    }
  }

  // Cambiar de paso = filtro de secciones (sin scroll largo entre ellas)
  function irPaso(paso) {
    if (!PASOS.includes(paso) || paso === estado.paso) {
      // aun si es el mismo, asegurar que esté visible
    }
    estado.paso = paso;
    PASOS.forEach(id => { const s = document.getElementById(id); if (s) s.hidden = (id !== paso); });
    // marcar pestañas activas (nav desktop + tabbar móvil)
    document.querySelectorAll("[data-accion='paso']").forEach(b => {
      const on = b.dataset.paso === paso;
      b.classList.toggle("activo", on);
      if (b.hasAttribute("role")) b.setAttribute("aria-selected", on);
    });
    // reposicionar al inicio de la sección activa (salto instantáneo, no scroll animado)
    const cont = document.getElementById("lp-secciones");
    if (cont && cont.scrollIntoView) cont.scrollIntoView({ behavior: "auto", block: "start" });
    revelar();
  }

  /* ---------- Reveal al scroll (IntersectionObserver) ---------- */
  let _io = null;
  function revelar() {
    const sel = ".lp-card, .lp-pred__card, .lp-sec-head, .lp-info, .lp-convoc";
    if (typeof IntersectionObserver === "undefined") {
      document.querySelectorAll(sel).forEach(e => e.classList.add("reveal", "in"));
      return;
    }
    if (!_io) _io = new IntersectionObserver(ents => {
      ents.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); _io.unobserve(en.target); } });
    }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });
    document.querySelectorAll(sel).forEach(e => {
      if (!e.classList.contains("reveal")) { e.classList.add("reveal"); _io.observe(e); }
    });
  }

  /* ---------- Barra superior: transparente arriba, sólida al bajar ---------- */
  let _topBound = false;
  function sincronizarTop() {
    const fn = () => { const t = document.querySelector(".lp-top"); if (t) t.classList.toggle("scrolled", (window.scrollY || window.pageYOffset || 0) > 10); };
    fn();
    if (!_topBound && typeof window.addEventListener === "function") { window.addEventListener("scroll", fn, { passive: true }); _topBound = true; }
  }

  /* ============================================================
     FORMULARIO ÚNICO (modal) + QR
     ============================================================ */
  function contextoForm(tipo, id) {
    if (tipo === "auto") {
      return { modo: "auto", titulo: "Regístrate y te ubicamos", sub: "Cuéntanos de ti y te conectamos al ministerio ideal",
        destino: "Casa Roca", qr: deepLink({ paso: "conoce", auto: 1 }), canal: "auto" };
    }
    if (tipo === "cat") {
      if (id === "hombres") return contextoForm("ministerio", "m_hombres");
      if (id === "mujeres") return contextoForm("ministerio", "m_mujer");
      if (id === "casados") return { modo: "auto", civilPreset: "Casado(a)", titulo: "Regístrate · Casados",
        sub: "Para matrimonios y parejas", destino: "Casa2 (Casados)", qr: deepLink({ paso: "conoce", auto: 1 }), canal: "auto" };
      const lbl = { ninos: "Niñ@s", jovenes: "Jóvenes", solteros: "Adultos", mayores: "Adultos mayores" };
      return { modo: "auto", titulo: `Regístrate · ${lbl[id] || ""}`.trim(),
        sub: "Te ubicamos por tu edad y etapa de vida", destino: "Casa Roca", qr: deepLink({ paso: "conoce", auto: 1 }), canal: "auto" };
    }
    if (tipo === "ministerio") {
      const m = DB.ministerio(id) || {};
      const sexoPreset = id === "m_hombres" ? "Hombre" : id === "m_mujer" ? "Mujer" : null;
      return { modo: "fijo", destinoFijoId: id, sexoPreset,
        titulo: `Inscríbete a ${m.nombre || "este ministerio"}`, sub: "Ministerio congregacional",
        destino: m.nombre, qr: deepLink({ paso: "conoce", inscribir: id }), canal: "ministerio" };
    }
    if (tipo === "grupo") {
      const g = L.afinidad(id) || {}; const m = DB.ministerio(g.min) || {};
      return { titulo: `Únete a ${g.nombre || "este grupo"}`, sub: `Grupo pequeño · ${m.nombre || ""}`,
        destino: g.nombre, qr: deepLink({ paso: "conecta", grupo: id }), canal: "grupo",
        extra: `${g.dia} ${g.hora} · ${g.lugar}` };
    }
    if (tipo === "curso") {
      const c = creceCurso(id) || {};
      const horario = c.tipo === "instituto" ? c.horario : `${c.dia || ""}${c.dia && c.sesiones ? " · " : ""}${c.sesiones || ""}`.trim();
      return { titulo: `Inscríbete a ${c.nombre || "este curso"}`, sub: c.tipo === "instituto" ? "Instituto bíblico" : "Curso corto",
        destino: c.nombre, qr: deepLink({ paso: "crece", curso: id }), canal: "curso", extra: horario || c.horario };
    }
    if (tipo === "sirve") {
      const s = L.equipoSirve(id) || {};
      return { titulo: `Servir en ${s.nombre || "este equipo"}`, sub: "Equipo de servicio",
        destino: s.nombre, qr: deepLink({ paso: "sirve", sirve: id }), canal: "equipo" };
    }
    // convocatoria
    return { titulo: "Postúlate para servir", sub: "Convocatoria de servicio",
      destino: "la convocatoria de servicio", qr: deepLink({ paso: "sirve", convoc: 1 }), canal: "equipo" };
  }

  function abrirForm(tipo, id) {
    const ctx = contextoForm(tipo, id);
    const capa = document.getElementById("lp-modal");
    capa.innerHTML = `
      <div class="lp-modalbg" id="lp-modalbg">
        <div class="lp-modal" role="dialog" aria-modal="true" aria-labelledby="lp-modal-t">
          <div class="lp-modal__head">
            <div><h3 id="lp-modal-t">${esc(ctx.titulo)}</h3><div class="sub">${esc(ctx.sub)}${ctx.extra ? " · " + esc(ctx.extra) : ""}</div></div>
            <button class="lp-modal__x" id="lp-modal-x" aria-label="Cerrar">✕</button>
          </div>
          <div class="lp-modal__body" id="lp-modal-body">
            <div class="lp-qr">
              <div class="lp-qr__img">${qrImg(ctx.qr)}</div>
              <div class="lp-qr__txt"><b>Escanea o comparte</b><p>Este QR lleva directo a este formulario. Imprímelo en la sede para inscripción inmediata.</p></div>
            </div>
            <form id="lp-form" novalidate>
              <div class="lp-ubica${ctx.modo === "auto" ? "" : " lp-ubica--ok"}" id="lp-ubica">${
                ctx.modo === "auto"
                  ? `<b>📍 Te ubicaremos automáticamente</b><span>Completa tu edad y estado civil y te diremos tu ministerio.</span>`
                  : `<b>${(MIN_META[ctx.destinoFijoId] || {}).ico || "📍"} ${esc(ctx.destino)}</b><span>Quedarás conectado(a) aquí.</span>`
              }</div>
              <div class="lp-row">
                <div class="lp-field"><label for="f-nom">Nombres <span class="req">*</span></label>
                  <input class="lp-input" id="f-nom" name="nombres" required autocomplete="given-name"></div>
                <div class="lp-field"><label for="f-ape">Apellidos <span class="req">*</span></label>
                  <input class="lp-input" id="f-ape" name="apellidos" required autocomplete="family-name"></div>
              </div>
              ${
                ctx.sexoPreset
                  ? `<input type="hidden" name="sexo" value="${ctx.sexoPreset}"><div class="lp-field"><label>Soy</label><div class="lp-locked">${ctx.sexoPreset === "Hombre" ? "🛡️ Hombre" : "🌷 Mujer"} <span class="muted">· definido por el ministerio</span></div></div>`
                  : `<div class="lp-field"><label>Soy <span class="req">*</span></label><div class="lp-seg" role="radiogroup" aria-label="Sexo"><label class="lp-segopt"><input type="radio" name="sexo" value="Hombre" required><span>🛡️ Hombre</span></label><label class="lp-segopt"><input type="radio" name="sexo" value="Mujer" required><span>🌷 Mujer</span></label></div></div>`
              }
              <div class="lp-row">
                <div class="lp-field"><label for="f-edad">Edad <span class="req">*</span></label>
                  <input class="lp-input" id="f-edad" name="edad" type="number" min="0" max="120" inputmode="numeric" required></div>
                <div class="lp-field"><label for="f-cumple">Cumpleaños</label>
                  <input class="lp-input" id="f-cumple" name="cumple" type="date"></div>
              </div>
              <div class="lp-field" id="lp-etapa-field"><label for="f-etapa">Etapa de vida</label>
                <select class="lp-select" id="f-etapa" name="etapa" disabled>
                  <option value="">Indica tu edad primero…</option>
                </select></div>
              <div class="lp-field"><label for="f-civil">Estado civil</label>
                <select class="lp-select" id="f-civil" name="civil">
                  <option value="">Prefiero no decir</option>
                  <option>Soltero(a)</option><option>Casado(a)</option><option>Unión libre</option>
                  <option>Separado(a)</option><option>Viudo(a)</option>
                </select></div>
              <div class="lp-casa2" id="lp-casa2" hidden>
                <div class="lp-field"><label for="f-anos">Años de casados</label>
                  <select class="lp-select" id="f-anos" name="anosCasado">
                    <option value="">Selecciona…</option>
                    ${ANOS_CASADO.map(a => `<option>${a}</option>`).join("")}
                  </select></div>
                <div class="lp-coyuge">
                  <div class="lp-coyuge__head">💑 Datos del cónyuge <span class="muted">(opcional)</span></div>
                  <div class="lp-row">
                    <div class="lp-field"><label for="f-cony-nom">Nombres</label>
                      <input class="lp-input" id="f-cony-nom" name="conyugeNombres"></div>
                    <div class="lp-field"><label for="f-cony-ape">Apellidos</label>
                      <input class="lp-input" id="f-cony-ape" name="conyugeApellidos"></div>
                  </div>
                  <div class="lp-row">
                    <div class="lp-field"><label for="f-cony-tel">Teléfono / WhatsApp</label>
                      <input class="lp-input" id="f-cony-tel" name="conyugeTel" type="tel" placeholder="+57 300 000 0000"></div>
                    <div class="lp-field"><label for="f-cony-mail">Correo</label>
                      <input class="lp-input" id="f-cony-mail" name="conyugeCorreo" type="email" placeholder="conyuge@email.com"></div>
                  </div>
                </div>
              </div>
              <div class="lp-field"><label for="f-mail">Correo <span class="req">*</span></label>
                <input class="lp-input" id="f-mail" name="correo" type="email" required autocomplete="email" placeholder="tucorreo@email.com"></div>
              <div class="lp-field"><label for="f-tel">Teléfono / WhatsApp <span class="req">*</span></label>
                <input class="lp-input" id="f-tel" name="telefono" type="tel" required autocomplete="tel" placeholder="+57 300 000 0000"></div>
              <label class="lp-consent"><input type="checkbox" id="f-ok" required>
                <span>Autorizo el tratamiento de mis datos para ser contactado por Casa Roca (Ley 1581/2012 · GDPR).</span></label>
              <button class="lp-btn lp-btn--primary lp-btn--block" type="submit">${ctx.modo === "auto" ? "Confirmar y ubicarme" : "Confirmar inscripción"}</button>
            </form>
          </div>
        </div>
      </div>`;
    const bg = document.getElementById("lp-modalbg");
    bg.addEventListener("click", ev => { if (ev.target.id === "lp-modalbg") cerrarForm(); });
    document.getElementById("lp-modal-x").addEventListener("click", cerrarForm);
    document.getElementById("lp-form").addEventListener("submit", ev => { ev.preventDefault(); enviarForm(ctx); });
    document.addEventListener("keydown", escClose);
    cablearForm(ctx);
    setTimeout(() => { const f = document.getElementById("f-nom"); if (f) f.focus(); }, 60);
  }

  /* Cableado en vivo: etapa según edad, bloque Casa2 y ubicación sugerida. */
  function cablearForm(ctx) {
    const form = document.getElementById("lp-form");
    if (!form) return;
    const auto = ctx.modo === "auto";
    const fEdad = form.querySelector("#f-edad");
    const fCivil = form.querySelector("#f-civil");
    const fEtapa = form.querySelector("#f-etapa");
    const casa2 = form.querySelector("#lp-casa2");
    const ubica = document.getElementById("lp-ubica");

    function pintarEtapas() {
      const ops = etapasPorEdad(fEdad.value);
      if (!ops.length) { fEtapa.innerHTML = `<option value="">Indica tu edad primero…</option>`; fEtapa.disabled = true; return; }
      const prev = fEtapa.value;
      fEtapa.innerHTML = `<option value="">Selecciona tu etapa…</option>` +
        ops.map(o => `<option${o === prev ? " selected" : ""}>${o}</option>`).join("");
      fEtapa.disabled = false;
    }
    function pintarCasa2() { if (casa2) casa2.hidden = !esCasado(fCivil.value); }
    function recomputar() {
      if (!auto || !ubica) return;
      const r = ruteoAuto({ edad: fEdad.value, civil: fCivil.value });
      if (!r.id) { ubica.className = "lp-ubica"; ubica.innerHTML = `<b>📍 Te ubicaremos automáticamente</b><span>${esc(r.motivo)}.</span>`; return; }
      const m = MIN_META[r.id] || { nombre: r.id, ico: "📍" };
      ubica.className = "lp-ubica lp-ubica--ok";
      ubica.innerHTML = `<b>${m.ico} Tu ministerio: ${esc(m.nombre)}</b><span>${esc(r.motivo)}.</span>`;
    }

    fEdad.addEventListener("input", () => { pintarEtapas(); recomputar(); });
    fCivil.addEventListener("change", () => { pintarCasa2(); recomputar(); });
    if (ctx.civilPreset) fCivil.value = ctx.civilPreset; // p.ej. categoría "Casados"
    pintarEtapas(); pintarCasa2(); recomputar();
  }

  function escClose(e) { if (e.key === "Escape") cerrarForm(); }
  function cerrarForm() {
    document.getElementById("lp-modal").innerHTML = "";
    document.removeEventListener("keydown", escClose);
  }

  function enviarForm(ctx) {
    const form = document.getElementById("lp-form");
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const d = Object.fromEntries(new FormData(form).entries());
    const nombre = (d.nombres || "").trim() || "Persona";
    const correo = (d.correo || "").trim();
    const tel = (d.telefono || "").trim();

    // Resolver el ministerio final: en modo auto se calcula por edad/estado civil.
    let destino = ctx.destino;
    if (ctx.modo === "auto") {
      const r = ruteoAuto({ edad: d.edad, civil: d.civil });
      destino = (MIN_META[r.id] || {}).nombre || ctx.destino || "Casa Roca";
    } else if (ctx.modo === "fijo" && ctx.destinoFijoId && MIN_META[ctx.destinoFijoId]) {
      destino = MIN_META[ctx.destinoFijoId].nombre;
    }

    document.getElementById("lp-modal-body").innerHTML = `
      <div class="lp-ok">
        <div class="lp-ok__ic">✓</div>
        <h3>¡Listo, ${esc(nombre)}!</h3>
        <p>Quedaste conectado(a) en <b>${esc(destino)}</b>. Ya eres parte. Te enviamos toda la información por estos canales:</p>
        <div class="lp-ok__canales">
          <div class="lp-ok__canal"><span class="ic">✉️</span><div><b>Correo enviado</b><span>${esc(correo)} — confirmación y próximos pasos</span></div></div>
          <div class="lp-ok__canal"><span class="ic">💬</span><div><b>WhatsApp enviado</b><span>${esc(tel)} — tu líder te escribirá para darte la bienvenida</span></div></div>
        </div>
        <button class="lp-btn lp-btn--mostaza lp-btn--block" id="lp-ok-close">Seguir explorando</button>
      </div>`;
    document.getElementById("lp-ok-close").addEventListener("click", cerrarForm);
    toast(`Inscripción confirmada en ${destino} ✓`, true);
  }

  /* ---------- Toast ---------- */
  function toast(msg, ok) {
    const wrap = document.getElementById("lp-toasts");
    const el = document.createElement("div");
    el.className = "lp-toast" + (ok ? " lp-toast--ok" : "");
    el.innerHTML = `<span>${ok ? "✓" : "ℹ️"}</span><span>${esc(msg)}</span>`;
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateY(8px)"; setTimeout(() => el.remove(), 250); }, 3000);
  }

  /* ---------- Deep links (QR entrantes) ---------- */
  function aplicarDeepLink() {
    const q = new URLSearchParams(location.search);
    if (q.get("ciudad") && L.CIUDADES.some(c => c.id === q.get("ciudad"))) {
      estado.ciudad = q.get("ciudad"); estado.predicaCiudad = q.get("ciudad");
    }
    const paso = q.get("paso");
    if (paso && PASOS.includes(paso)) estado.paso = paso; // abrir directo en esa pestaña
    render();
    if (q.get("auto")) abrirForm("auto", "auto");
    else if (q.get("inscribir")) abrirForm("ministerio", q.get("inscribir"));
    else if (q.get("grupo")) abrirForm("grupo", q.get("grupo"));
    else if (q.get("curso")) abrirForm("curso", q.get("curso"));
    else if (q.get("sirve")) abrirForm("sirve", q.get("sirve"));
    else if (q.get("convoc")) abrirForm("convoc", "convoc");
  }

  // Exponer para pruebas
  window.LP = { render, estado, abrirForm, contextoForm };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", aplicarDeepLink);
  else aplicarDeepLink();
})();
