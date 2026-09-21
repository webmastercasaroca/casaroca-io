/* ============================================================
   CASA ROCA · EXPERIENCIA v3 — motor cinematográfico
   Reusa window.DB y window.LANDING. Single-page oscura con:
   preloader, cursor personalizado, botones magnéticos, reveals
   al scroll, texto que se ilumina, contadores animados, marquees,
   carrusel de prédicas, menú overlay, modal de formulario + QR,
   toasts y deep links (QR entrantes). Sin frameworks ni build.
   ============================================================ */
(function () {
  const DB = window.DB;
  const L = window.LANDING;
  const PASOS = ["conoce", "conecta", "crece", "sirve"];
  const estado = { ciudad: "bogota", filtro: "all", predicaCiudad: "bogota", crece: "bogota" };

  // Meses cortos para formatear las fechas ISO de los cursos del STORE.
  const MESES_C = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  function fechaCursoTxt(iso) {
    if (!iso) return "Próximamente";
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d)) return esc(iso);
    return `${d.getDate()} ${MESES_C[d.getMonth()]} ${d.getFullYear()}`;
  }
  // Normaliza un curso del STORE (por sede) o un instituto (global) a la
  // forma única que consume creceCard.
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
  // Cursos cortos de la ciudad activa (desde el STORE que edita el pastor)
  // + Institutos IBLI/FACTER (globales). El STORE es la fuente de verdad.
  function creceLista() {
    const S = window.STORE;
    const cursos = (S && S.cursosDe ? S.cursosDe(estado.crece) : []).filter(c => c.activo !== false);
    const institutos = (L.CRECE || []).filter(c => c.tipo === "instituto");
    return cursos.map(normCurso).concat(institutos.map(normCurso));
  }
  // Lookup de un curso para el formulario (STORE primero, luego institutos).
  function creceCurso(id) {
    const S = window.STORE;
    return (S && S.curso && S.curso(id)) || (L.curso && L.curso(id)) || null;
  }

  /* ---------- Utilidades ---------- */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pct = (a, b) => (b ? Math.min(100, Math.round((a / b) * 100)) : 0);
  const ciudadNombre = id => { if (id === "global") return "Toda la red"; const c = L.CIUDADES.find(x => x.id === id); return c ? c.nombre : id; };
  const predicasFiltradas = () => estado.predicaCiudad === "all" ? L.PREDICAS.slice() : L.predicasDe(estado.predicaCiudad);

  function deepLink(params) {
    let base = location.origin && location.origin !== "null" ? location.origin + location.pathname : "https://casaroca.org/experiencia-v3";
    const q = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
    return base + "?" + q;
  }
  function qrImg(url) {
    const src = "https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&data=" + encodeURIComponent(url);
    return `<img src="${src}" alt="Código QR para inscribirse" onerror="this.parentNode.innerHTML='<span style=&quot;font-size:11px;color:#888;text-align:center&quot;>QR<br>(en línea)</span>'">`;
  }
  const ar = `<svg class="ar" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  /* ============================================================
     RUTEO — un solo formulario que ubica a la persona por
     ESTADO CIVIL → EDAD → ETAPA. (prima edad y luego etapa)
     Los ministerios de género (Hombres de Bien / Mujer Integral)
     NO entran en el ruteo automático: se accede a ellos haciendo
     clic directo en su tarjeta (autoidentificación de género).
     ============================================================ */
  const MIN_META = {
    m_rocakids: { nombre: "RocaKids",        ico: "🧒" },
    m_tmt:      { nombre: "tMt",             ico: "🎸" },
    m_j25:      { nombre: "J+25",            ico: "🌱" },
    m_josues:   { nombre: "Josués",          ico: "🧗" },
    m_casa2:    { nombre: "Casa2 (Casados)", ico: "💍" },
    m_dorados:  { nombre: "Años Dorados",    ico: "🌅" },
    m_hombres:  { nombre: "Hombres de Bien", ico: "🛡️" },
    m_mujer:    { nombre: "Mujer Integral",  ico: "🌷" },
  };
  // Bandas de edad NO solapadas (el límite superior decide).
  const BANDAS = [
    { id: "m_rocakids", min: 0,  max: 10 },
    { id: "m_tmt",      min: 11, max: 25 },
    { id: "m_j25",      min: 26, max: 34 },
    { id: "m_josues",   min: 35, max: 54 },
    { id: "m_dorados",  min: 55, max: 130 },
  ];
  function bandaPorEdad(edad) {
    if (edad === "" || edad == null) return null;
    const e = Number(edad);
    if (!Number.isFinite(e) || e < 0) return null;
    const b = BANDAS.find(x => e >= x.min && e <= x.max);
    return b ? b.id : "m_dorados";
  }
  function esCasado(civil) { return /casad|uni[oó]n libre/i.test(civil || ""); }
  // Ruteo automático (sin destino fijo). Devuelve {id, motivo} o {id:null,...}
  function ruteoAuto(p) {
    if (esCasado(p.civil)) return { id: "m_casa2", motivo: "Por tu estado civil (casado · unión libre)" };
    const id = bandaPorEdad(p.edad);
    if (!id) return { id: null, motivo: "Indica tu edad para ubicarte" };
    return { id, motivo: "Por tu edad y etapa de vida" };
  }
  // Etapas de vida que dependen de la edad.
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
     HEADER
     ============================================================ */
  function header() {
    return `
    <header class="v3-header" id="v3-header">
      <a class="v3-brand" href="#top" aria-label="Casa Roca, inicio">
        <span class="v3-brand__logo">CR</span>
        <span class="v3-brand__name"><b>Casa Roca</b><small>Sobre la Roca</small></span>
      </a>
      <nav class="v3-header__nav" aria-label="Secciones">
        <a href="#conoce" data-link>Conoce</a>
        <a href="#conecta" data-link>Conéctate</a>
        <a href="#crece" data-link>Crece</a>
        <a href="#sirve" data-link>Sirve</a>
      </nav>
      <div class="v3-header__right">
        <label class="v3-city" title="Elige tu ciudad"><span aria-hidden="true">📍</span>
          <select id="v3-sel-ciudad" aria-label="Ciudad">
            ${L.CIUDADES.map(x => `<option value="${x.id}" ${x.id === estado.ciudad ? "selected" : ""}>${esc(x.nombre)}</option>`).join("")}
          </select>
        </label>
        <button class="v3-burger" id="v3-burger" aria-label="Abrir menú" aria-expanded="false"><i></i><i></i><i></i></button>
      </div>
    </header>`;
  }

  function menuOverlay() {
    const items = [
      { id: "conoce", t: "Conoce", d: "Prédicas, horarios y ministerios" },
      { id: "conecta", t: "Conéctate", d: "Encuentra tu grupo pequeño" },
      { id: "crece", t: "Crece", d: "Cursos e Instituto bíblico" },
      { id: "sirve", t: "Sirve", d: "Sé parte de un equipo" }
    ];
    return `
      <div class="v3-menu__list">
        ${items.map((m, i) => `
          <a class="v3-menu__item" href="#${m.id}" data-link data-menuclose>
            <span class="n">0${i + 1}</span><span class="t">${m.t}</span><span class="d">${m.d}</span>
          </a>`).join("")}
      </div>
      <div class="v3-menu__foot">
        <span>Una casa cálida y segura</span>
        <a href="index.html">Ingreso del equipo →</a>
      </div>`;
  }

  /* ============================================================
     HERO
     ============================================================ */
  function hero() {
    return `
    <section class="v3-hero" id="top">
      <div class="v3-hero__inner">
        <span class="v3-eyebrow"><span class="pulse"></span> Una casa cálida y segura · est. desde tu primer paso</span>
        <h1>
          <span class="ln"><span>Aquí tienes</span></span>
          <span class="ln"><span>un <span class="serif">lugar.</span></span></span>
          <span class="ln"><span>Da tu primer paso.</span></span>
        </h1>
        <p class="v3-hero__lead">Bienvenido a Casa Roca. Te acompañamos en cuatro pasos para conocer, conectarte,
          crecer y servir. No tienes que tenerlo todo resuelto: solo empieza por donde estés hoy.</p>
        <div class="v3-hero__cta">
          <button class="v3-btn v3-btn--gold" data-accion="form" data-tipo="auto" data-id="auto" data-mag>Regístrate y te ubicamos ${ar}</button>
          <a class="v3-btn v3-btn--ghost" href="#conoce" data-link data-mag>Explorar ministerios</a>
        </div>
        <a class="v3-hero__scroll" href="#manifiesto" data-link>
          <span class="mouse"></span> Desliza para descubrir
        </a>
      </div>
    </section>`;
  }

  function marquee(words, opts = {}) {
    const row = words.map((w, i) => `<span class="${i % 3 === 1 ? "out" : ""}">${esc(w)}</span><span class="dot">✦</span>`).join("");
    return `<div class="v3-marquee ${opts.cls || ""}" aria-hidden="true"><div class="v3-marquee__track">${row}${row}</div></div>`;
  }

  /* ============================================================
     MANIFIESTO (texto que se ilumina)
     ============================================================ */
  function manifiesto() {
    const txt = "En Casa Roca creemos que nadie debería caminar solo. Por eso construimos un lugar donde conocer, acompañar, ayudar y rodear no son palabras, sino lo que hacemos contigo cada semana.";
    const goldWords = new Set(["conocer,", "acompañar,", "ayudar", "rodear"]);
    const words = txt.split(" ").map(w => `<span class="w ${goldWords.has(w) ? "gold" : ""}">${esc(w)}</span>`).join(" ");
    return `
    <section class="v3-manifesto" id="manifiesto">
      <div class="label">El porqué de la casa</div>
      <p id="v3-manifesto-text">${words}</p>
    </section>`;
  }

  /* ============================================================
     ÍNDICE 4C (estilo servicios NO.01)
     ============================================================ */
  function indiceC() {
    const pasos = [
      { id: "conoce", t: "Conoce", d: "Mira las prédicas de tu ciudad, revisa horarios y descubre los ministerios." },
      { id: "conecta", t: "Conéctate", d: "Encuentra un grupo pequeño donde de verdad perteneces." },
      { id: "crece", t: "Crece", d: "Cursos cortos e Instituto bíblico para ir más profundo." },
      { id: "sirve", t: "Sirve", d: "Pasa de asistir a pertenecer sirviendo en un equipo." }
    ];
    return `
    <section class="v3-section" id="recorrido">
      <div class="v3-wrap">
        <div class="v3-sechead v3-reveal">
          <div class="top"><span class="num">✦</span> El recorrido · las 4 C <span class="dash"></span></div>
          <h2>Cuatro pasos, <em>un camino</em> hecho para ti.</h2>
          <p class="desc">No es un programa que completar, es una casa que recorrer a tu ritmo. Toca cualquier paso para ir directo.</p>
        </div>
        <div class="v3-steps">
          ${pasos.map((p, i) => `
            <a class="v3-step v3-reveal" href="#${p.id}" data-link>
              <span class="n">NO.0${i + 1}</span>
              <span><span class="ttl">${p.t}</span><span class="sub">${p.d}</span></span>
              <span class="go" aria-hidden="true">${ar}</span>
            </a>`).join("")}
        </div>
      </div>
    </section>`;
  }

  /* ============================================================
     IMPACTO / CONTADORES
     ============================================================ */
  function impacto() {
    const stats = [
      { n: 36, suf: "", t: "Sedes de la red Casa Roca" },
      { n: 12, suf: "", t: "Ministerios y equipos para ti" },
      { n: 120, suf: "+", t: "Espacios abiertos para servir" },
      { n: 4, suf: "", t: "Pasos para sentirte en casa" }
    ];
    return `
    <section class="v3-section v3-section--alt" id="impacto">
      <div class="v3-wrap">
        <div class="v3-impact">
          <div class="v3-reveal">
            <p class="v3-impact__lead" style="margin-bottom:18px;color:var(--v3-gold);letter-spacing:.16em;text-transform:uppercase;font-size:13px">Hecha para acompañar</p>
            <h2 class="v3-impact__title">Una casa que <em>crece contigo.</em></h2>
          </div>
          <p class="v3-impact__lead v3-reveal">Detrás de cada paso hay personas reales que quieren conocerte. Más de una década rodeando familias, jóvenes y nuevos en cada ciudad, y apenas estamos empezando.</p>
        </div>
        <div class="v3-stats">
          ${stats.map(s => `
            <div class="v3-stat v3-reveal">
              <b data-count="${s.n}" data-suf="${s.suf}">0${s.suf}</b>
              <span>${s.t}</span>
            </div>`).join("")}
        </div>
      </div>
    </section>`;
  }

  /* ============================================================
     1 · CONOCE
     ============================================================ */
  function predicaCard(p) {
    return `<article class="v3-pred v3-reveal">
      <div class="v3-pred__thumb">
        <span class="serie">${esc(p.serie)}</span>
        <span class="play" aria-hidden="true">▶</span>
        <span class="city">📍 ${esc(ciudadNombre(p.ciudad))}</span>
        <span class="dur">${esc(p.duracion)}</span>
      </div>
      <div class="v3-pred__body">
        <h4>${esc(p.titulo)}</h4>
        <div class="meta">${esc(p.predicador)} · ${esc(p.fecha)} · ${esc(p.vistas)} vistas</div>
      </div>
    </article>`;
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
    return `<article class="v3-card v3-reveal">
      <div class="v3-card__top">
        <div class="v3-emoji">${cat.ico}</div>
        <div><h3>${esc(cat.nombre)}</h3><p class="muted">${esc(cat.desc)}</p></div>
      </div>
      <div class="v3-card__actions">
        <button class="v3-btn v3-btn--gold v3-btn--sm v3-btn--block" data-accion="form" data-tipo="cat" data-id="${cat.id}">Registrarme aquí</button>
      </div>
    </article>`;
  }

  function seccionConoce() {
    const c = L.ciudad(estado.ciudad);
    return `
    <section class="v3-section" id="conoce">
      <div class="v3-wrap">
        <div class="v3-sechead v3-reveal">
          <div class="top"><span class="num">01</span> Paso uno <span class="dash"></span></div>
          <h2><em>Conoce</em> la casa.</h2>
          <p class="desc">Mira las prédicas de tu ciudad, revisa los horarios y descubre los ministerios. Si quieres congregarte, escribe directo al director o inscríbete con un toque.</p>
        </div>

        <div class="top" style="display:flex;align-items:center;gap:10px;color:var(--v3-text-3);font-size:13px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:16px">📺 Prédicas de Casa Roca</div>
        <div class="v3-filters" id="v3-pred-filtros" role="tablist" aria-label="Filtrar prédicas por iglesia">
          <button class="v3-chip ${estado.predicaCiudad === "all" ? "activo" : ""}" data-accion="predfiltro" data-ciudad="all">🌐 Todas</button>
          ${L.CIUDADES.map(c2 => `<button class="v3-chip ${estado.predicaCiudad === c2.id ? "activo" : ""}" data-accion="predfiltro" data-ciudad="${c2.id}">📍 ${esc(c2.nombre)}</button>`).join("")}
        </div>
        <div class="v3-rail" id="v3-pred-rail">${predicasFiltradas().map(predicaCard).join("")}</div>
        <p class="v3-rail-hint">↔ Desliza para ver más prédicas</p>

        <div class="v3-info v3-reveal" id="v3-servicios" style="margin:36px 0">
          <h3>🕘 Horarios de la iglesia · ${esc(c.nombre)}</h3>
          <p class="muted" style="margin:0">${esc(c.direccion)} — te esperamos este domingo.</p>
          <div class="times">${c.servicios.map(s => `<span class="v3-time">${esc(s)}</span>`).join("")}</div>
        </div>

        <div class="top" style="display:flex;align-items:center;gap:10px;color:var(--v3-text-3);font-size:13px;letter-spacing:.14em;text-transform:uppercase;margin:8px 0 8px">🧩 ¿En qué etapa estás?</div>
        <p class="muted" style="color:var(--v3-text-2);margin:0 0 24px">Elige tu grupo y te conectamos con tu ministerio. Te ubicamos por tu edad y etapa de vida.</p>
        <div class="v3-grid v3-grid--3">${CATEGORIAS.map(categoriaCard).join("")}</div>
      </div>
    </section>`;
  }

  /* ============================================================
     2 · CONÉCTATE
     ============================================================ */
  function afinidadCard(a) {
    const m = DB.ministerio(a.min);
    // El STORE es la fuente de verdad: conteo efectivo y estado abierto/cerrado.
    const S = window.STORE;
    const miembros = S ? S.miembrosEfectivos(a.id) : a.miembros;
    const cerrado = S ? S.cerrado(a.id) : false;
    const lleno = S ? S.lleno(a.id) : (a.miembros >= a.cupo);
    const p = pct(miembros, a.cupo);
    const txtBtn = cerrado ? "Inscripciones cerradas" : (lleno ? "Grupo lleno — ver otros" : "Registrarme en este grupo");
    return `<article class="v3-card v3-reveal">
      <div class="v3-card__top">
        <div class="v3-emoji">${m ? m.ico : "🤝"}</div>
        <div><h3>${esc(a.nombre)}</h3><p class="muted">${m ? esc(m.nombre) : ""} · ${esc(a.modalidad)}</p></div>
      </div>
      <p class="muted">${esc(a.queHacen)}</p>
      <div class="v3-meta">
        <span class="v3-pill">📅 ${esc(a.dia)} ${esc(a.hora)}</span>
        <span class="v3-pill">📍 ${esc(a.lugar)}</span>
      </div>
      <p class="muted">Líder: <b style="color:var(--v3-text)">${esc(a.lider)}</b> · ${miembros}/${a.cupo} personas${cerrado ? " · <b style='color:#ff8d7a'>cerrado por el líder</b>" : ""}</p>
      <div class="v3-cupo"><i style="width:${p}%"></i></div>
      <div class="v3-card__actions">
        <button class="v3-btn ${lleno ? "v3-btn--ghost" : "v3-btn--gold"} v3-btn--sm v3-btn--block"
          data-accion="form" data-tipo="grupo" data-id="${a.id}" ${lleno ? "disabled" : ""}>
          ${txtBtn}</button>
      </div>
    </article>`;
  }

  function listaAfinidades() {
    const items = L.afinidadesDe(estado.filtro);
    if (!items.length) return `<p class="muted" style="color:var(--v3-text-2)">Aún no hay grupos publicados en este ministerio. Prueba con otro filtro.</p>`;
    return items.map(afinidadCard).join("");
  }

  function seccionConecta() {
    const mins = L.ministeriosConAfinidad();
    return `
    <section class="v3-section v3-section--alt" id="conecta">
      <div class="v3-wrap">
        <div class="v3-sechead v3-reveal">
          <div class="top"><span class="num">02</span> Paso dos <span class="dash"></span></div>
          <h2><em>Conéctate</em> con tu gente.</h2>
          <p class="desc">Un grupo pequeño es donde realmente perteneces: un líder y pocas personas que caminan juntas. Filtra por ministerio y elige el tuyo.</p>
        </div>
        <div class="v3-filters" id="v3-filtros" role="tablist" aria-label="Filtrar por ministerio">
          <button class="v3-chip ${estado.filtro === "all" ? "activo" : ""}" data-accion="filtro" data-filtro="all">Todos</button>
          ${mins.map(m => `<button class="v3-chip ${estado.filtro === m.id ? "activo" : ""}" data-accion="filtro" data-filtro="${m.id}">${m.ico} ${esc(m.nombre)}</button>`).join("")}
        </div>
        <div class="v3-grid v3-grid--3" id="v3-afinidades">${listaAfinidades()}</div>
      </div>
    </section>`;
  }

  /* ============================================================
     3 · CRECE
     ============================================================ */
  function creceCard(c) {
    const inst = c.tipo === "instituto";
    return `<article class="v3-card v3-reveal">
      <div class="v3-card__top">
        <div class="v3-emoji">${c.ico}</div>
        <div><h3>${esc(c.nombre)}</h3><p class="muted">${inst ? "Instituto bíblico" : "Curso corto"} · ${esc(c.modalidad)}</p></div>
      </div>
      <p class="muted">${esc(c.desc)}</p>
      <div class="v3-meta">
        <span class="v3-pill">🧑‍🏫 ${esc(c.profesor)}</span>
        <span class="v3-pill">🗓️ ${esc(c.horario)}</span>
      </div>
      <div class="v3-meta">
        <span class="v3-pill ${inst ? "" : "v3-pill--ok"}">▶ ${esc(c.inicia)}</span>
        <span class="v3-pill">${c.inscritos}/${c.cupo} inscritos</span>
      </div>
      <div class="v3-card__actions">
        <button class="v3-btn v3-btn--gold v3-btn--sm v3-btn--block" data-accion="form" data-tipo="curso" data-id="${c.id}">
          ${inst ? "Más información / matricularme" : "Inscribirme a este curso"}</button>
      </div>
    </article>`;
  }

  function seccionCrece() {
    const filtros = `<div class="v3-filtros v3-reveal" id="v3-crece-filtros" role="tablist" aria-label="Filtrar cursos por iglesia">
        ${L.CIUDADES.map(c2 => `<button class="v3-chip ${estado.crece === c2.id ? "activo" : ""}" data-accion="crecefiltro" data-ciudad="${c2.id}">📍 ${esc(c2.nombre)}</button>`).join("")}
      </div>`;
    return `
    <section class="v3-section" id="crece">
      <div class="v3-wrap">
        <div class="v3-sechead v3-reveal">
          <div class="top"><span class="num">03</span> Paso tres <span class="dash"></span></div>
          <h2><em>Crece</em> en tu fe.</h2>
          <p class="desc">Cada sede abre sus cursos cortos con fechas, horarios y modalidad propios. Elige tu ciudad. Los Institutos IBLI · FACTER son virtuales para toda la red.</p>
        </div>
        ${filtros}
        <div class="v3-grid v3-grid--3" id="v3-crece-grid">${creceLista().map(creceCard).join("")}</div>
      </div>
    </section>`;
  }

  /* ============================================================
     4 · SIRVE
     ============================================================ */
  function sirveCard(s) {
    return `<article class="v3-card v3-reveal">
      <div class="v3-card__top">
        <div class="v3-emoji">${s.ico}</div>
        <div><h3>${esc(s.nombre)}</h3><p class="muted">${esc(s.buscan)}</p></div>
      </div>
      <p class="muted">${esc(s.intro)}</p>
      <p class="muted">Líder: <b style="color:var(--v3-text)">${esc(s.lider)}</b></p>
      <div class="v3-card__actions">
        <a class="v3-btn v3-btn--wa v3-btn--sm" target="_blank" rel="noopener"
          href="https://wa.me/${s.wa}?text=${encodeURIComponent("Hola, quiero servir en el equipo " + s.nombre)}">💬 Preguntar</a>
        <button class="v3-btn v3-btn--gold v3-btn--sm" data-accion="form" data-tipo="sirve" data-id="${s.id}">Quiero ser parte · QR</button>
      </div>
    </article>`;
  }

  function convocatoria() {
    const c = L.CONVOCATORIA;
    if (!c.activa) return "";
    return `<div class="v3-convoc v3-reveal">
      <span class="v3-convoc__tag">⚡ Convocatoria abierta</span>
      <h3>${esc(c.titulo)}</h3>
      <p>${esc(c.subtitulo)}</p>
      <div class="v3-convoc__facts">
        <div class="v3-convoc__fact"><b>${esc(c.cupos)}</b><span>disponibles</span></div>
        <div class="v3-convoc__fact"><b>${esc(c.cierre)}</b><span>fecha límite</span></div>
        <div class="v3-convoc__fact"><b>${esc(c.encuentro)}</b><span>siguiente paso</span></div>
      </div>
      <button class="v3-btn v3-btn--light" data-accion="form" data-tipo="convoc" data-id="convoc" data-mag>Postularme para servir ${ar}</button>
    </div>`;
  }

  function seccionSirve() {
    return `
    <section class="v3-section v3-section--alt" id="sirve">
      <div class="v3-wrap">
        <div class="v3-sechead v3-reveal">
          <div class="top"><span class="num">04</span> Paso cuatro <span class="dash"></span></div>
          <h2><em>Sirve</em> y pertenece.</h2>
          <p class="desc">Pasa de asistir a pertenecer. Elige un equipo donde te gustaría servir y postúlate con un toque o escaneando su QR.</p>
        </div>
        <div class="v3-grid v3-grid--3">${L.SIRVE.map(sirveCard).join("")}</div>
        ${convocatoria()}
      </div>
    </section>`;
  }

  /* ============================================================
     CTA FINAL + FOOTER
     ============================================================ */
  function ctaFinal() {
    return `
    ${marquee(["Da tu primer paso", "Aquí tienes un lugar", "Te esperamos", "Una casa cálida"], { cls: "v3-marquee--plain" })}
    <section class="v3-cta" id="contacto">
      <small>Tu momento es hoy</small>
      <h2 class="v3-reveal">¿Listo para dar <em>tu primer paso?</em></h2>
      <div class="v3-hero__cta v3-reveal" style="justify-content:center">
        <a class="v3-btn v3-btn--gold" href="#conoce" data-link data-mag>Empieza aquí ${ar}</a>
        <a class="v3-btn v3-btn--ghost" href="#sirve" data-link data-mag>Quiero servir</a>
      </div>
    </section>`;
  }

  function footer() {
    return `
    <footer class="v3-foot">
      <div class="v3-foot__grid">
        <div>
          <a class="v3-brand" href="#top"><span class="v3-brand__logo">CR</span>
            <span class="v3-brand__name"><b>Casa Roca</b><small>Una casa cálida y segura</small></span></a>
          <p>Conoce · Conéctate · Crece · Sirve. Tu primer paso empieza hoy, sin importar de dónde vengas.</p>
        </div>
        <div>
          <h4>El recorrido</h4>
          <nav class="v3-foot__links">
            <a href="#conoce" data-link>Conoce</a>
            <a href="#conecta" data-link>Conéctate</a>
            <a href="#crece" data-link>Crece</a>
            <a href="#sirve" data-link>Sirve</a>
          </nav>
        </div>
        <div>
          <h4>Casa Roca</h4>
          <nav class="v3-foot__links">
            <a href="#impacto" data-link>Nuestra red</a>
            <a href="#contacto" data-link>Da tu primer paso</a>
            <a href="index.html">Ingreso del equipo →</a>
          </nav>
        </div>
      </div>
      <div class="v3-foot__bottom">
        <span>© 2026 Casa Sobre la Roca · Prototipo Fase 0 · datos de demostración.</span>
        <span>Tus datos se tratan conforme a la Ley 1581/2012 (Colombia) y GDPR.</span>
      </div>
    </footer>`;
  }

  /* ============================================================
     RENDER PRINCIPAL
     ============================================================ */
  function render() {
    const app = document.getElementById("v3-app");
    app.innerHTML =
      header() +
      hero() +
      marquee(["Conoce", "Conéctate", "Crece", "Sirve", "Conocer", "Acompañar", "Ayudar", "Rodear"]) +
      manifiesto() +
      indiceC() +
      impacto() +
      seccionConoce() +
      seccionConecta() +
      seccionCrece() +
      seccionSirve() +
      ctaFinal() +
      footer();
    document.getElementById("v3-menu").innerHTML = menuOverlay();
    enlazar();
    initReveal();
    initHeaderScroll();
    initManifesto();
    initCounters();
    initMagnetic();
    initScrollSpy();
  }

  /* ============================================================
     EVENTOS / DELEGACIÓN
     ============================================================ */
  function enlazar() {
    const sel = document.getElementById("v3-sel-ciudad");
    if (sel) sel.addEventListener("change", e => {
      estado.ciudad = e.target.value;
      estado.predicaCiudad = e.target.value;
      // Actualiza horarios + prédicas sin re-render total (conserva scroll)
      actualizarConoce();
      toast(`Ciudad activa: ${L.ciudad(estado.ciudad).nombre}`, true);
    });

    document.getElementById("v3-app").addEventListener("click", manejar);

    // El pastor edita sus cursos en otra pestaña/rol → el STORE emite y
    // refrescamos la grilla de Crece en vivo (misma fuente de verdad).
    if (window.STORE && window.STORE.onCambio) {
      window.STORE.onCambio(() => { if (document.getElementById("v3-crece-grid")) refrescarCrece(); });
    }

    // Menú overlay
    const burger = document.getElementById("v3-burger");
    if (burger) burger.addEventListener("click", toggleMenu);
    document.getElementById("v3-menu").addEventListener("click", e => {
      if (e.target.closest("[data-menuclose]")) cerrarMenu();
    });
  }

  function manejar(e) {
    const link = e.target.closest("[data-link]");
    if (link && link.getAttribute("href") && link.getAttribute("href").startsWith("#")) {
      e.preventDefault();
      const id = link.getAttribute("href").slice(1);
      irA(id);
      return;
    }
    const el = e.target.closest("[data-accion]");
    if (!el) return;
    const a = el.dataset.accion;
    if (a === "predfiltro") {
      estado.predicaCiudad = el.dataset.ciudad;
      document.querySelectorAll("#v3-pred-filtros .v3-chip").forEach(c => c.classList.toggle("activo", c.dataset.ciudad === estado.predicaCiudad));
      const rail = document.getElementById("v3-pred-rail");
      if (rail) { rail.innerHTML = predicasFiltradas().map(predicaCard).join(""); marcarReveal(rail); }
    } else if (a === "filtro") {
      estado.filtro = el.dataset.filtro;
      document.querySelectorAll("#v3-filtros .v3-chip").forEach(c => c.classList.toggle("activo", c.dataset.filtro === estado.filtro));
      const cont = document.getElementById("v3-afinidades");
      if (cont) { cont.innerHTML = listaAfinidades(); marcarReveal(cont); }
    } else if (a === "crecefiltro") {
      estado.crece = el.dataset.ciudad;
      refrescarCrece();
    } else if (a === "form") {
      abrirForm(el.dataset.tipo, el.dataset.id);
    }
  }

  function actualizarConoce() {
    const c = L.ciudad(estado.ciudad);
    const rail = document.getElementById("v3-pred-rail");
    if (rail) { rail.innerHTML = predicasFiltradas().map(predicaCard).join(""); marcarReveal(rail); }
    document.querySelectorAll("#v3-pred-filtros .v3-chip").forEach(ch => ch.classList.toggle("activo", ch.dataset.ciudad === estado.predicaCiudad));
    const info = document.getElementById("v3-servicios");
    if (info) info.innerHTML = `
      <h3>🕘 Horarios de la iglesia · ${esc(c.nombre)}</h3>
      <p class="muted" style="margin:0">${esc(c.direccion)} — te esperamos este domingo.</p>
      <div class="times">${c.servicios.map(s => `<span class="v3-time">${esc(s)}</span>`).join("")}</div>`;
  }

  // Repinta la grilla de Crece (cursos del STORE por ciudad + institutos)
  // y sincroniza los chips de ciudad. Se llama al filtrar y cuando el
  // pastor edita sus cursos (STORE.onCambio).
  function refrescarCrece() {
    document.querySelectorAll("#v3-crece-filtros .v3-chip").forEach(c => c.classList.toggle("activo", c.dataset.ciudad === estado.crece));
    const grid = document.getElementById("v3-crece-grid");
    if (grid) { grid.innerHTML = creceLista().map(creceCard).join(""); marcarReveal(grid); }
  }

  function irA(id) {
    const t = document.getElementById(id);
    if (!t) return;
    cerrarMenu();
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    t.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  /* ---------- Menú overlay ---------- */
  function toggleMenu() {
    const m = document.getElementById("v3-menu");
    m.classList.contains("open") ? cerrarMenu() : abrirMenu();
  }
  function abrirMenu() {
    document.getElementById("v3-menu").classList.add("open");
    const b = document.getElementById("v3-burger");
    b.classList.add("open"); b.setAttribute("aria-expanded", "true"); b.setAttribute("aria-label", "Cerrar menú");
    document.body.classList.add("no-scroll");
    document.addEventListener("keydown", escMenu);
  }
  function cerrarMenu() {
    const m = document.getElementById("v3-menu");
    if (!m.classList.contains("open")) return;
    m.classList.remove("open");
    const b = document.getElementById("v3-burger");
    b.classList.remove("open"); b.setAttribute("aria-expanded", "false"); b.setAttribute("aria-label", "Abrir menú");
    document.body.classList.remove("no-scroll");
    document.removeEventListener("keydown", escMenu);
  }
  function escMenu(e) { if (e.key === "Escape") cerrarMenu(); }

  /* ============================================================
     INTERACCIONES DE SCROLL
     ============================================================ */
  let _io = null;
  function initReveal() {
    if (typeof IntersectionObserver === "undefined") {
      document.querySelectorAll(".v3-reveal").forEach(e => e.classList.add("in")); return;
    }
    if (!_io) _io = new IntersectionObserver(ents => {
      ents.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); _io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -50px 0px" });
    document.querySelectorAll(".v3-reveal").forEach(e => _io.observe(e));
  }
  function marcarReveal(scope) {
    (scope || document).querySelectorAll(".v3-reveal:not(.in)").forEach(e => { if (_io) _io.observe(e); else e.classList.add("in"); });
  }

  let _headerBound = false;
  function initHeaderScroll() {
    const fn = () => { const h = document.getElementById("v3-header"); if (h) h.classList.toggle("scrolled", (window.scrollY || 0) > 20); };
    fn();
    if (!_headerBound) { window.addEventListener("scroll", fn, { passive: true }); _headerBound = true; }
  }

  // Texto del manifiesto que se ilumina según progreso de scroll
  let _maniBound = false;
  function initManifesto() {
    const p = document.getElementById("v3-manifesto-text");
    if (!p) return;
    const words = Array.from(p.querySelectorAll(".w"));
    const fn = () => {
      const r = p.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      // progreso: 0 cuando el bloque entra por abajo, 1 cuando su parte alta pasa el centro
      const start = vh * 0.85, end = vh * 0.30;
      let prog = (start - r.top) / (start - end + r.height);
      prog = Math.max(0, Math.min(1, prog));
      const activos = Math.round(prog * words.length);
      words.forEach((w, i) => w.classList.toggle("on", i < activos));
    };
    fn();
    if (!_maniBound) { window.addEventListener("scroll", fn, { passive: true }); window.addEventListener("resize", fn); _maniBound = true; }
  }

  // Contadores animados al entrar en vista
  function initCounters() {
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nums = document.querySelectorAll("[data-count]");
    if (typeof IntersectionObserver === "undefined" || reduce) {
      nums.forEach(n => n.textContent = n.dataset.count + (n.dataset.suf || "")); return;
    }
    const io = new IntersectionObserver(ents => {
      ents.forEach(en => {
        if (!en.isIntersecting) return;
        const el = en.target, target = parseInt(el.dataset.count, 10), suf = el.dataset.suf || "";
        const dur = 1400, t0 = performance.now();
        const step = now => {
          const k = Math.min(1, (now - t0) / dur);
          const eased = 1 - Math.pow(1 - k, 3);
          el.textContent = Math.round(target * eased) + suf;
          if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        io.unobserve(el);
      });
    }, { threshold: 0.5 });
    nums.forEach(n => io.observe(n));
  }

  // Scroll spy: marca el nav activo según la sección visible
  function initScrollSpy() {
    if (typeof IntersectionObserver === "undefined") return;
    const map = { recorrido: "conoce", impacto: "conoce" };
    const io = new IntersectionObserver(ents => {
      ents.forEach(en => {
        if (!en.isIntersecting) return;
        let id = en.target.id; if (map[id]) id = map[id];
        document.querySelectorAll(".v3-header__nav a").forEach(a => a.classList.toggle("activo", a.getAttribute("href") === "#" + id));
      });
    }, { threshold: 0.4 });
    PASOS.forEach(p => { const s = document.getElementById(p === "conecta" ? "conecta" : p); if (s) io.observe(s); });
  }

  /* ============================================================
     CURSOR PERSONALIZADO + BOTONES MAGNÉTICOS
     ============================================================ */
  function initCursor() {
    const fine = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cur = document.getElementById("v3-cursor");
    if (!cur || !fine || reduce) return;
    const dot = cur.querySelector(".v3-cursor__dot"), ring = cur.querySelector(".v3-cursor__ring");
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    document.addEventListener("mousemove", e => {
      mx = e.clientX; my = e.clientY;
      dot.style.left = mx + "px"; dot.style.top = my + "px";
    });
    (function loop() { rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18; ring.style.left = rx + "px"; ring.style.top = ry + "px"; requestAnimationFrame(loop); })();
    document.addEventListener("mousedown", () => cur.classList.add("down"));
    document.addEventListener("mouseup", () => cur.classList.remove("down"));
    const hov = "a, button, select, input, .v3-step, .v3-card, .v3-pred";
    document.addEventListener("mouseover", e => { if (e.target.closest(hov)) cur.classList.add("hover"); });
    document.addEventListener("mouseout", e => { if (e.target.closest(hov)) cur.classList.remove("hover"); });
  }

  function initMagnetic() {
    const fine = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduce) return;
    document.querySelectorAll("[data-mag]").forEach(el => {
      if (el._mag) return; el._mag = true;
      el.addEventListener("mousemove", e => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
      });
      el.addEventListener("mouseleave", () => { el.style.transform = ""; });
    });
  }

  /* ============================================================
     PRELOADER
     ============================================================ */
  function runPreloader(done) {
    const pre = document.getElementById("v3-preloader");
    const num = document.getElementById("v3-pre-num"), bar = document.getElementById("v3-pre-bar");
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!pre || reduce) { if (pre) pre.classList.add("done"); document.body.classList.add("v3-ready"); done && done(); return; }
    let v = 0;
    const tick = () => {
      v += Math.random() * 16 + 6;
      if (v >= 100) v = 100;
      num.textContent = Math.floor(v); bar.style.width = v + "%";
      if (v < 100) setTimeout(tick, 90 + Math.random() * 90);
      else setTimeout(() => {
        pre.classList.add("done");
        document.body.classList.add("v3-ready");
        done && done();
      }, 280);
    };
    setTimeout(tick, 120);
  }

  /* ============================================================
     FORMULARIO ÚNICO (modal) + QR
     ============================================================ */
  function contextoForm(tipo, id) {
    if (tipo === "auto") {
      // Formulario único: sin destino fijo, se ubica por edad/estado civil.
      return { modo: "auto", titulo: "Regístrate y te ubicamos", sub: "Cuéntanos de ti y te conectamos al ministerio ideal",
        destino: "Casa Roca", qr: deepLink({ paso: "conoce", auto: 1 }) };
    }
    if (tipo === "cat") {
      // Las 7 categorías visibles. Todas abren el mismo formulario inteligente.
      if (id === "hombres") return contextoForm("ministerio", "m_hombres");
      if (id === "mujeres") return contextoForm("ministerio", "m_mujer");
      if (id === "casados") return { modo: "auto", civilPreset: "Casado(a)", titulo: "Regístrate · Casados",
        sub: "Para matrimonios y parejas", destino: "Casa2 (Casados)", qr: deepLink({ paso: "conoce", auto: 1 }) };
      const lbl = { ninos: "Niñ@s", jovenes: "Jóvenes", solteros: "Adultos", mayores: "Adultos mayores" };
      return { modo: "auto", titulo: `Regístrate · ${lbl[id] || ""}`.trim(),
        sub: "Te ubicamos por tu edad y etapa de vida", destino: "Casa Roca", qr: deepLink({ paso: "conoce", auto: 1 }) };
    }
    if (tipo === "ministerio") {
      const m = DB.ministerio(id) || {};
      // Hombres de Bien / Mujer Integral: el clic ya define el género.
      const sexoPreset = id === "m_hombres" ? "Hombre" : id === "m_mujer" ? "Mujer" : null;
      return { modo: "fijo", destinoFijoId: id, sexoPreset,
        titulo: `Inscríbete a ${m.nombre || "este ministerio"}`, sub: "Ministerio congregacional",
        destino: m.nombre, qr: deepLink({ paso: "conoce", inscribir: id }) };
    }
    if (tipo === "grupo") {
      const g = L.afinidad(id) || {}; const m = DB.ministerio(g.min) || {};
      return { tipo: "grupo", id, titulo: `Únete a ${g.nombre || "este grupo"}`, sub: `Grupo pequeño · ${m.nombre || ""}`, destino: g.nombre, qr: deepLink({ paso: "conecta", grupo: id }), extra: `${g.dia || ""} ${g.hora || ""} · ${g.lugar || ""}` };
    }
    if (tipo === "curso") {
      const c = creceCurso(id) || {};
      const horario = c.tipo === "instituto" ? c.horario : `${c.dia || ""}${c.dia && c.sesiones ? " · " : ""}${c.sesiones || ""}`.trim();
      return { titulo: `Inscríbete a ${c.nombre || "este curso"}`, sub: c.tipo === "instituto" ? "Instituto bíblico" : "Curso corto", destino: c.nombre, qr: deepLink({ paso: "crece", curso: id }), extra: horario || c.horario };
    }
    if (tipo === "sirve") {
      const s = L.equipoSirve(id) || {};
      return { titulo: `Servir en ${s.nombre || "este equipo"}`, sub: "Equipo de servicio", destino: s.nombre, qr: deepLink({ paso: "sirve", sirve: id }) };
    }
    return { titulo: "Postúlate para servir", sub: "Convocatoria de servicio", destino: "la convocatoria de servicio", qr: deepLink({ paso: "sirve", convoc: 1 }) };
  }

  function abrirForm(tipo, id) {
    const ctx = contextoForm(tipo, id);
    const capa = document.getElementById("v3-modal");
    capa.innerHTML = `
      <div class="v3-modalbg" id="v3-modalbg">
        <div class="v3-modal" role="dialog" aria-modal="true" aria-labelledby="v3-modal-t">
          <div class="v3-modal__head">
            <div><h3 id="v3-modal-t">${esc(ctx.titulo)}</h3><div class="sub">${esc(ctx.sub)}${ctx.extra ? " · " + esc(ctx.extra) : ""}</div></div>
            <button class="v3-modal__x" id="v3-modal-x" aria-label="Cerrar">✕</button>
          </div>
          <div class="v3-modal__body" id="v3-modal-body">
            <div class="v3-qr">
              <div class="v3-qr__img">${qrImg(ctx.qr)}</div>
              <div class="v3-qr__txt"><b>Escanea o comparte</b><p>Este QR lleva directo a este formulario. Imprímelo en la sede para inscripción inmediata.</p></div>
            </div>
            <form id="v3-form" novalidate>
              <div class="v3-ubica${ctx.modo === "auto" ? "" : " v3-ubica--ok"}" id="v3-ubica">${
                ctx.modo === "auto"
                  ? `<b>📍 Te ubicaremos automáticamente</b><span>Completa tu edad y estado civil y te diremos tu ministerio.</span>`
                  : `<b>${(MIN_META[ctx.destinoFijoId] || {}).ico || "📍"} ${esc(ctx.destino)}</b><span>Quedarás conectado(a) aquí.</span>`
              }</div>
              <div class="v3-row">
                <div class="v3-field"><label for="f-nom">Nombres <span class="req">*</span></label>
                  <input class="v3-input" id="f-nom" name="nombres" required autocomplete="given-name"></div>
                <div class="v3-field"><label for="f-ape">Apellidos <span class="req">*</span></label>
                  <input class="v3-input" id="f-ape" name="apellidos" required autocomplete="family-name"></div>
              </div>
              ${
                ctx.sexoPreset
                  ? `<input type="hidden" name="sexo" value="${ctx.sexoPreset}"><div class="v3-field"><label>Soy</label><div class="v3-locked">${ctx.sexoPreset === "Hombre" ? "🛡️ Hombre" : "🌷 Mujer"} <span class="muted">· definido por el ministerio</span></div></div>`
                  : `<div class="v3-field"><label>Soy <span class="req">*</span></label><div class="v3-seg" role="radiogroup" aria-label="Sexo"><label class="v3-segopt"><input type="radio" name="sexo" value="Hombre" required><span>🛡️ Hombre</span></label><label class="v3-segopt"><input type="radio" name="sexo" value="Mujer" required><span>🌷 Mujer</span></label></div></div>`
              }
              <div class="v3-row">
                <div class="v3-field"><label for="f-edad">Edad <span class="req">*</span></label>
                  <input class="v3-input" id="f-edad" name="edad" type="number" min="0" max="120" inputmode="numeric" required></div>
                <div class="v3-field"><label for="f-cumple">Cumpleaños</label>
                  <input class="v3-input" id="f-cumple" name="cumple" type="date"></div>
              </div>
              <div class="v3-field" id="v3-etapa-field"><label for="f-etapa">Etapa de vida</label>
                <select class="v3-select" id="f-etapa" name="etapa" disabled>
                  <option value="">Indica tu edad primero…</option>
                </select></div>
              <div class="v3-field"><label for="f-civil">Estado civil</label>
                <select class="v3-select" id="f-civil" name="civil">
                  <option value="">Prefiero no decir</option>
                  <option>Soltero(a)</option><option>Casado(a)</option><option>Unión libre</option>
                  <option>Separado(a)</option><option>Viudo(a)</option>
                </select></div>
              <div class="v3-casa2" id="v3-casa2" hidden>
                <div class="v3-field"><label for="f-anos">Años de casados</label>
                  <select class="v3-select" id="f-anos" name="anosCasado">
                    <option value="">Selecciona…</option>
                    ${ANOS_CASADO.map(a => `<option>${a}</option>`).join("")}
                  </select></div>
                <div class="v3-coyuge">
                  <div class="v3-coyuge__head">💑 Datos del cónyuge <span class="muted">(opcional)</span></div>
                  <div class="v3-row">
                    <div class="v3-field"><label for="f-cony-nom">Nombres</label>
                      <input class="v3-input" id="f-cony-nom" name="conyugeNombres"></div>
                    <div class="v3-field"><label for="f-cony-ape">Apellidos</label>
                      <input class="v3-input" id="f-cony-ape" name="conyugeApellidos"></div>
                  </div>
                  <div class="v3-row">
                    <div class="v3-field"><label for="f-cony-edad">Edad</label>
                      <input class="v3-input" id="f-cony-edad" name="conyugeEdad" type="number" min="0" max="120" inputmode="numeric" placeholder="Años"></div>
                    <div class="v3-field"></div>
                  </div>
                  <div class="v3-row">
                    <div class="v3-field"><label for="f-cony-tel">Teléfono / WhatsApp</label>
                      <input class="v3-input" id="f-cony-tel" name="conyugeTel" type="tel" placeholder="+57 300 000 0000"></div>
                    <div class="v3-field"><label for="f-cony-mail">Correo</label>
                      <input class="v3-input" id="f-cony-mail" name="conyugeCorreo" type="email" placeholder="conyuge@email.com"></div>
                  </div>
                </div>
              </div>
              <div class="v3-field"><label for="f-mail">Correo <span class="req">*</span></label>
                <input class="v3-input" id="f-mail" name="correo" type="email" required autocomplete="email" placeholder="tucorreo@email.com"></div>
              <div class="v3-field"><label for="f-tel">Teléfono / WhatsApp <span class="req">*</span></label>
                <input class="v3-input" id="f-tel" name="telefono" type="tel" required autocomplete="tel" placeholder="+57 300 000 0000"></div>
              <label class="v3-consent"><input type="checkbox" id="f-ok" required>
                <span>Autorizo el tratamiento de mis datos para ser contactado por Casa Roca (Ley 1581/2012 · GDPR).</span></label>
              <button class="v3-btn v3-btn--gold v3-btn--block" type="submit">${ctx.modo === "auto" ? "Confirmar y ubicarme" : "Confirmar inscripción"} ${ar}</button>
            </form>
          </div>
        </div>
      </div>`;
    document.body.classList.add("no-scroll");
    const bg = document.getElementById("v3-modalbg");
    bg.addEventListener("click", ev => { if (ev.target.id === "v3-modalbg") cerrarForm(); });
    document.getElementById("v3-modal-x").addEventListener("click", cerrarForm);
    document.getElementById("v3-form").addEventListener("submit", ev => { ev.preventDefault(); enviarForm(ctx); });
    document.addEventListener("keydown", escClose);
    cablearForm(ctx);
    setTimeout(() => { const f = document.getElementById("f-nom"); if (f) f.focus(); }, 60);
  }

  /* Cableado en vivo: etapa según edad, bloque Casa2 y ubicación sugerida. */
  function cablearForm(ctx) {
    const form = document.getElementById("v3-form");
    if (!form) return;
    const auto = ctx.modo === "auto";
    const fEdad = form.querySelector("#f-edad");
    const fCivil = form.querySelector("#f-civil");
    const fEtapa = form.querySelector("#f-etapa");
    const casa2 = form.querySelector("#v3-casa2");
    const ubica = document.getElementById("v3-ubica");

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
      if (!auto || !ubica) return; // en modo fijo la ubicación no cambia
      const r = ruteoAuto({ edad: fEdad.value, civil: fCivil.value });
      if (!r.id) { ubica.className = "v3-ubica"; ubica.innerHTML = `<b>📍 Te ubicaremos automáticamente</b><span>${esc(r.motivo)}.</span>`; return; }
      const m = MIN_META[r.id] || { nombre: r.id, ico: "📍" };
      ubica.className = "v3-ubica v3-ubica--ok";
      ubica.innerHTML = `<b>${m.ico} Tu ministerio: ${esc(m.nombre)}</b><span>${esc(r.motivo)}.</span>`;
    }

    fEdad.addEventListener("input", () => { pintarEtapas(); recomputar(); });
    fCivil.addEventListener("change", () => { pintarCasa2(); recomputar(); });
    if (ctx.civilPreset) fCivil.value = ctx.civilPreset; // p.ej. categoría "Casados"
    pintarEtapas(); pintarCasa2(); recomputar();
  }

  function escClose(e) { if (e.key === "Escape") cerrarForm(); }
  function cerrarForm() {
    document.getElementById("v3-modal").innerHTML = "";
    document.body.classList.remove("no-scroll");
    document.removeEventListener("keydown", escClose);
  }

  function enviarForm(ctx) {
    const form = document.getElementById("v3-form");
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const d = Object.fromEntries(new FormData(form).entries());
    const nombre = (d.nombres || "").trim() || "Persona";
    const correo = (d.correo || "").trim(), tel = (d.telefono || "").trim();

    // Resolver el ministerio final: en modo auto se calcula por edad/estado civil.
    let destino = ctx.destino;
    if (ctx.modo === "auto") {
      const r = ruteoAuto({ edad: d.edad, civil: d.civil });
      destino = (MIN_META[r.id] || {}).nombre || ctx.destino || "Casa Roca";
    } else if (ctx.modo === "fijo" && ctx.destinoFijoId && MIN_META[ctx.destinoFijoId]) {
      destino = MIN_META[ctx.destinoFijoId].nombre;
    }

    // Grupo pequeño → guardar inscrito en el STORE compartido (panel del líder).
    if (ctx.tipo === "grupo" && ctx.id && window.STORE) {
      const cumple = (d.cumple || "").trim();
      const persona = {
        nombres: nombre, apellidos: (d.apellidos || "").trim(),
        correo, telefono: tel,
        edad: d.edad ? parseInt(d.edad, 10) : null,
        estadoCivil: (d.civil || "").trim(),
        cumpleMes: cumple ? parseInt(cumple.slice(5, 7), 10) : null,
        cumpleDia: cumple ? parseInt(cumple.slice(8, 10), 10) : null,
        etapa: "conoce", fuente: "Inscripción por el landing"
      };
      const r = window.STORE.agregar(ctx.id, persona);
      const grid = document.getElementById("v3-afinidades"); if (grid) grid.innerHTML = listaAfinidades();
      if (!r.ok) {
        toast(r.motivo === "cerrado" ? "Este grupo cerró inscripciones." : "Este grupo ya está lleno.", false);
        cerrarForm();
        return;
      }
    }

    document.getElementById("v3-modal-body").innerHTML = `
      <div class="v3-ok">
        <div class="v3-ok__ic">✓</div>
        <h3>¡Listo, ${esc(nombre)}!</h3>
        <p>Quedaste conectado(a) en <b style="color:var(--v3-text)">${esc(destino)}</b>. Ya eres parte. Te enviamos todo por estos canales:</p>
        <div class="v3-ok__canales">
          <div class="v3-ok__canal"><span class="ic">✉️</span><div><b>Correo enviado</b><span>${esc(correo)} — confirmación y próximos pasos</span></div></div>
          <div class="v3-ok__canal"><span class="ic">💬</span><div><b>WhatsApp enviado</b><span>${esc(tel)} — tu líder te escribirá para darte la bienvenida</span></div></div>
        </div>
        <button class="v3-btn v3-btn--light v3-btn--block" id="v3-ok-close">Seguir explorando</button>
      </div>`;
    document.getElementById("v3-ok-close").addEventListener("click", cerrarForm);
    toast(`Inscripción confirmada en ${destino} ✓`, true);
  }

  /* ---------- Toast ---------- */
  function toast(msg, ok) {
    const wrap = document.getElementById("v3-toasts");
    const el = document.createElement("div");
    el.className = "v3-toast" + (ok ? " v3-toast--ok" : "");
    el.innerHTML = `<span>${ok ? "✓" : "ℹ️"}</span><span>${esc(msg)}</span>`;
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateY(8px)"; setTimeout(() => el.remove(), 260); }, 3000);
  }

  /* ---------- Deep links (QR entrantes) ---------- */
  function aplicarDeepLink() {
    const q = new URLSearchParams(location.search);
    if (q.get("ciudad") && L.CIUDADES.some(c => c.id === q.get("ciudad"))) {
      estado.ciudad = q.get("ciudad"); estado.predicaCiudad = q.get("ciudad");
    }
    render();
    runPreloader(() => {
      initCursor();
      const paso = q.get("paso");
      if (paso && PASOS.includes(paso)) setTimeout(() => irA(paso), 100);
      if (q.get("auto")) abrirForm("auto", "auto");
      else if (q.get("inscribir")) abrirForm("ministerio", q.get("inscribir"));
      else if (q.get("grupo")) abrirForm("grupo", q.get("grupo"));
      else if (q.get("curso")) abrirForm("curso", q.get("curso"));
      else if (q.get("sirve")) abrirForm("sirve", q.get("sirve"));
      else if (q.get("convoc")) abrirForm("convoc", "convoc");
    });
  }

  // Exponer para pruebas
  window.LPV3 = { render, estado, abrirForm, contextoForm };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", aplicarDeepLink);
  else aplicarDeepLink();
})();
