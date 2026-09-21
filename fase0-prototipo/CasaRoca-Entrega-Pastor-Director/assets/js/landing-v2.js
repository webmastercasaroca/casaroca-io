/* ============================================================
   CASA ROCA — EXPERIENCIA PÚBLICA · V2 (editorial) · motor
   Índice editorial de las 4 etapas (Conoce/Conéctate/Crece/Sirve)
   con modo Slider / Lista, orden, selector de ciudad e idioma de
   marca. Al entrar a una etapa se despliega su contenido completo
   (prédicas, ministerios, grupos, cursos, equipos) conservando
   TODA la funcionalidad: inscripción con QR, WhatsApp, toasts y
   deep links. Reutiliza window.DB y window.LANDING.
   ============================================================ */
(function () {
  const DB = window.DB;
  const L = window.LANDING;

  /* ---------- Utilidades ---------- */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pct = (a, b) => (b ? Math.min(100, Math.round((a / b) * 100)) : 0);

  const estado = {
    ciudad: "bogota",
    vista: "slider",     // 'slider' | 'lista'
    orden: "recorrido",  // 'recorrido' | 'az' | 'za'
    paso: null,          // null = índice; o id de etapa
    filtroPred: "bogota",
    filtroCrece: "bogota",  // ciudad activa en "Crece" (cursos por sede)
    filtroSede: "bogota",   // sede activa en "Conéctate" (grupos pequeños por sede)
    filtroSirve: "bogota",  // sede activa en "Sirve" (equipos operativos por sede)
    filtroAfin: "all",
    filtroGenero: "all",   // 'all' | 'hombre' | 'mujer'
    filtroEdad: null        // null = cualquier edad; o número exacto
  };

  /* ---------- Imágenes hero (generadas con IA) ----------
     Servidas desde CDN. Para uso permanente, descárgalas a
     assets/img/ y reemplaza estas URLs por rutas locales. */
  const CDN = "https://d8j0ntlcm91z4.cloudfront.net/user_3EhaFRtcS5BZx6lKxxDT4LpJ2Gr/";
  const IMG = {
    conoce:  CDN + "hf_20260616_034744_73b2651b-ebda-4382-be85-0df831645ca2.png",
    conecta: CDN + "hf_20260616_034745_5c9b7044-8a2a-4a84-becf-672b0d11fbea.png",
    crece:   CDN + "hf_20260616_034746_0255c0ae-fef5-49c2-b1fc-a5281307694c.png",
    sirve:   CDN + "hf_20260616_034747_5fa412b6-05a1-4bea-afee-01358a441656.png"
  };

  /* ---------- Catálogo de etapas (el "índice" editorial) ---------- */
  const ETAPAS = [
    {
      id: "conoce", n: "01", accent: "var(--et-conoce)", img: IMG.conoce,
      kicker: "Paso 1 · Conocer", titulo: "Conoce",
      desc: "Mira las prédicas de tu ciudad, revisa los horarios y descubre los ministerios de la casa.",
      lead: "Empieza por mirar y escuchar. Aquí están las prédicas de cada iglesia, los horarios de los servicios y los ministerios congregacionales con su director — listos para que des el primer paso.",
      tags: ["Prédicas", "Horarios", "Ministerios"],
      count: () => L.CONGREGACIONALES.length, countLbl: "ministerios"
    },
    {
      id: "conecta", n: "02", accent: "var(--et-conecta)", img: IMG.conecta,
      kicker: "Paso 2 · Acompañar", titulo: "Conéctate",
      desc: "Encuentra un grupo pequeño donde realmente perteneces: pocas personas que caminan juntas.",
      lead: "Pertenecer es más que asistir. Filtra por ministerio y elige el grupo de afinidad que va contigo — un líder y un grupo pequeño que camina a tu lado.",
      tags: ["Grupos pequeños", "Afinidades", "Comunidad"],
      count: () => L.AFINIDADES.length, countLbl: "grupos"
    },
    {
      id: "crece", n: "03", accent: "var(--et-crece)", img: IMG.crece,
      kicker: "Paso 3 · Ayudar", titulo: "Crece",
      desc: "Da pasos firmes en tu fe con cursos cortos y el Instituto bíblico IBLI · FACTER.",
      lead: "Crece con fundamento. Cursos cortos para empezar (ADN, Bautizo, Madurez, Llaves del Poder) y el Instituto bíblico para ir más profundo, virtual con SSO.",
      tags: ["Cursos", "Instituto", "IBLI · FACTER"],
      count: () => {
        const S = window.STORE;
        const nCursos = (S && S.cursosDe) ? S.cursosDe(estado.filtroCrece).filter(c => c.activo !== false).length : 0;
        return nCursos + L.CRECE.filter(c => c.tipo === "instituto").length;
      }, countLbl: "programas"
    },
    {
      id: "sirve", n: "04", accent: "var(--et-sirve)", img: IMG.sirve,
      kicker: "Paso 4 · Rodear", titulo: "Sirve",
      desc: "Pasa de asistir a pertenecer: elige un equipo donde servir y postúlate con un toque.",
      lead: "Servir es rodear a otros. Elige el equipo donde quieres servir, escríbele a su líder o postúlate al instante escaneando su QR.",
      tags: ["Equipos", "Voluntariado", "Convocatoria"],
      count: () => L.SIRVE.length, countLbl: "equipos"
    }
  ];
  const etapa = id => ETAPAS.find(e => e.id === id);
  function etapasOrdenadas() {
    const arr = ETAPAS.slice();
    if (estado.orden === "az") arr.sort((a, b) => a.titulo.localeCompare(b.titulo, "es"));
    else if (estado.orden === "za") arr.sort((a, b) => b.titulo.localeCompare(a.titulo, "es"));
    return arr; // 'recorrido' = orden natural
  }

  function ciudadNombre(id) { if (id === "global") return "Toda la red"; const c = L.CIUDADES.find(x => x.id === id); return c ? c.nombre : id; }
  function predicasFiltradas() { return estado.filtroPred === "all" ? L.PREDICAS.slice() : L.predicasDe(estado.filtroPred); }

  /* ---------- Deep link + QR (idéntico al v1) ---------- */
  function deepLink(params) {
    let base = location.origin && location.origin !== "null"
      ? location.origin + location.pathname
      : "https://casaroca.org/experiencia-v2";
    const q = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
    return base + "?" + q;
  }
  function qrImg(url) {
    const src = "https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&data=" + encodeURIComponent(url);
    return `<img src="${src}" alt="Código QR para inscribirse"
      onerror="this.parentNode.innerHTML='<span style=&quot;font-size:11px;color:var(--texto-tenue);text-align:center;padding:6px&quot;>QR<br>(en línea)</span>'">`;
  }
  /* QR CENTRAL único: sin importar el ministerio, todo apunta al
     formulario general que ubica a la persona. Un solo QR para toda
     la sede → el mismo funnel para todos. */
  function qrCentral() { return deepLink({ registro: 1 }); }

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
     SHELL: TOP BAR + CABECERA + ÍNDICE
     ============================================================ */
  function topbar() {
    return `
    <header class="v2-top">
      <a class="v2-brand" href="#top" data-accion="inicio" aria-label="Casa Roca, inicio">
        <b>Casa Roca</b><small>Sobre la Roca</small>
      </a>
      <span class="v2-top__spacer"></span>
      <nav class="v2-nav" aria-label="Etapas del recorrido">
        ${ETAPAS.map(e => `<a href="#${e.id}" data-n="${e.n}" data-accion="entrar" data-paso="${e.id}" class="${estado.paso === e.id ? "activo" : ""}">${esc(e.titulo)}</a>`).join("")}
      </nav>
      <label class="v2-city" title="Elige tu ciudad">
        <span aria-hidden="true">📍</span>
        <select id="v2-ciudad" aria-label="Ciudad">
          ${L.CIUDADES.map(x => `<option value="${x.id}" ${x.id === estado.ciudad ? "selected" : ""}>${esc(x.nombre)}</option>`).join("")}
        </select>
      </label>
    </header>`;
  }

  function cabecera() {
    return `
    <section class="v2-head" id="top">
      <span class="v2-head__eyebrow v2-label">✦ Una casa cálida y segura</span>
      <h1 class="v2-title">Tu recorrido,<br>en <em>cuatro pasos</em>.</h1>
      <div class="v2-sub">
        <span class="v2-label">Experiencia — Casa Roca</span>
        <span>Conoce · Conéctate · Crece · Sirve</span>
        <span class="v2-label">${esc(ciudadNombre(estado.ciudad))}</span>
      </div>
      <div class="v2-controls">
        <div class="v2-ctl">
          <span class="v2-label">Orden</span>
          <span class="v2-seg" role="group" aria-label="Ordenar índice">
            <button data-accion="orden" data-orden="recorrido" class="${estado.orden === "recorrido" ? "activo" : ""}">Recorrido</button>
            <span class="sep">·</span>
            <button data-accion="orden" data-orden="az" class="${estado.orden === "az" ? "activo" : ""}">A–Z</button>
            <span class="sep">·</span>
            <button data-accion="orden" data-orden="za" class="${estado.orden === "za" ? "activo" : ""}">Z–A</button>
          </span>
        </div>
        <span class="v2-controls__spacer"></span>
        <div class="v2-ctl">
          <span class="v2-label">Vista</span>
          <span class="v2-seg" role="group" aria-label="Cambiar vista">
            <button data-accion="vista" data-vista="slider" class="${estado.vista === "slider" ? "activo" : ""}">Slider</button>
            <span class="sep">·</span>
            <button data-accion="vista" data-vista="lista" class="${estado.vista === "lista" ? "activo" : ""}">Lista</button>
          </span>
        </div>
      </div>
    </section>`;
  }

  /* ---------- Índice: lista ---------- */
  function filaLista(e, i, total) {
    return `
    <div class="v2-row" role="button" tabindex="0" data-accion="entrar" data-paso="${e.id}"
         data-img="${e.img}" style="--row-accent:${e.accent}">
      <span class="v2-row__num">${e.n} / ${String(total).padStart(2, "0")}</span>
      <div class="v2-row__main">
        <h2 class="v2-row__title">${esc(e.titulo)}</h2>
        <p class="v2-row__desc">${esc(e.desc)}</p>
        <div class="v2-row__tags">${e.tags.map(t => `<span class="v2-tag">${esc(t)}</span>`).join("")}</div>
      </div>
      <div class="v2-row__meta">
        <span class="v2-row__count">${e.count()} ${esc(e.countLbl)}</span>
        <span class="v2-row__go">Entrar <span class="arr" aria-hidden="true">→</span></span>
      </div>
    </div>`;
  }
  function indiceLista() {
    const arr = etapasOrdenadas();
    return `<div class="v2-index"><div class="v2-list">
      ${arr.map((e, i) => filaLista(e, i, arr.length)).join("")}
    </div></div>
    <div class="v2-hoverimg" id="v2-hoverimg" aria-hidden="true"><img alt=""></div>`;
  }

  /* ---------- Índice: slider ---------- */
  function slide(e, i, total) {
    return `
    <article class="v2-slide" role="button" tabindex="0" data-accion="entrar" data-paso="${e.id}"
             style="--slide-accent:${e.accent}">
      <img src="${e.img}" alt="${esc(e.titulo)}" loading="lazy"
           onerror="this.style.display='none';this.parentNode.style.background='linear-gradient(160deg,var(--v2-night),#10367a)'">
      <span class="v2-slide__veil"></span>
      <span class="v2-slide__num">${e.n} / ${String(total).padStart(2, "0")}</span>
      <div class="v2-slide__body">
        <span class="v2-slide__kicker v2-label">${esc(e.kicker)}</span>
        <h2 class="v2-slide__title">${esc(e.titulo)}</h2>
        <p class="v2-slide__desc">${esc(e.desc)}</p>
        <button class="v2-slide__enter" data-accion="entrar" data-paso="${e.id}">Entrar <span class="arr" aria-hidden="true">→</span></button>
      </div>
    </article>`;
  }
  function indiceSlider() {
    const arr = etapasOrdenadas();
    return `
    <div class="v2-slider-wrap">
      <div class="v2-slider" id="v2-slider">
        ${arr.map((e, i) => slide(e, i, arr.length)).join("")}
      </div>
      <div class="v2-slider-foot">
        <span class="v2-counter" id="v2-counter"><b>01</b> / ${String(arr.length).padStart(2, "0")}</span>
        <span class="v2-arrows">
          <button data-accion="slide-prev" aria-label="Anterior">←</button>
          <button data-accion="slide-next" aria-label="Siguiente">→</button>
        </span>
        <span class="v2-scrollcue v2-label">Desliza →</span>
      </div>
    </div>`;
  }

  function marquee() {
    const words = ["Conocer", "Acompañar", "Ayudar", "Rodear"];
    const row = words.map(w => `<span>${w}</span><span class="dot">✦</span>`).join("");
    return `<div class="v2-marquee" aria-hidden="true"><div class="v2-marquee__track">${row}${row}</div></div>`;
  }

  function footer() {
    return `
    <footer class="v2-foot"><div class="v2-foot__in">
      <p class="v2-foot__big">Aquí tienes un lugar.<br><em>Da tu primer paso.</em></p>
      <div class="v2-foot__cols">
        <div>
          <span class="v2-label" style="color:var(--mostaza-400)">El recorrido</span>
          <p style="margin:10px 0 0">
            ${ETAPAS.map(e => `<a href="#${e.id}" data-accion="entrar" data-paso="${e.id}">${esc(e.titulo)}</a>`).join(" · ")}
          </p>
        </div>
        <div>
          <span class="v2-label" style="color:var(--mostaza-400)">Casa Roca</span>
          <p style="margin:10px 0 0">Una casa cálida y segura.<br>~36 sedes · Sede madre Bogotá Chicó.</p>
        </div>
        <div>
          <small>Tus datos se tratan conforme a la Ley 1581/2012 (Colombia) y GDPR.<br>
          Prototipo Fase 0 · datos de demostración.<br>
          <a href="experiencia.html">← Ver versión 1</a> · <a href="index.html">Ingreso del equipo →</a></small>
        </div>
      </div>
    </div></footer>`;
  }

  /* ============================================================
     DETALLE DE ETAPA
     ============================================================ */
  // --- builders de tarjetas (portados/adaptados del v1) ---
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
  // Las 7 categorías por etapa de vida (reemplazan la lista de ministerios).
  const CATEGORIAS = [
    { id: "ninos",    ico: "🧒",  nombre: "Niñ@s",           desc: "Bebés a 5° de primaria · 0–10 años",   ac: "#2A66C4" },
    { id: "jovenes",  ico: "🎸",  nombre: "Jóvenes",         desc: "Bachillerato y universidad · 11–25 años", ac: "#7E57C2" },
    { id: "solteros", ico: "🌱",  nombre: "Adultos",         desc: "Solteros que trabajan · 26–54 años",   ac: "#1E8A55" },
    { id: "casados",  ico: "💍",  nombre: "Casados",         desc: "Matrimonios y parejas",                ac: "#C8881A" },
    { id: "hombres",  ico: "🛡️", nombre: "Hombres",         desc: "Hombres de toda edad",                 ac: "#3A5BA0" },
    { id: "mujeres",  ico: "🌷",  nombre: "Mujeres",         desc: "Mujeres de toda edad",                 ac: "#C0566F" },
    { id: "mayores",  ico: "🌅",  nombre: "Adultos mayores", desc: "55 años en adelante",                  ac: "#B5732E" },
  ];
  function categoriaCard(cat, i) {
    return `<button type="button" class="v2-etapa" style="--ac:${cat.ac};--i:${i}" data-accion="form" data-tipo="cat" data-id="${cat.id}" aria-label="Registrarme — ${esc(cat.nombre)}">
      <span class="v2-etapa__bar" aria-hidden="true"></span>
      <span class="v2-etapa__head">
        <span class="v2-etapa__ico" aria-hidden="true">${cat.ico}</span>
        <span class="v2-etapa__txt">
          <span class="v2-etapa__name">${esc(cat.nombre)}</span>
          <span class="v2-etapa__desc">${esc(cat.desc)}</span>
        </span>
      </span>
      <span class="v2-etapa__cta">Registrarme<span class="v2-etapa__arrow" aria-hidden="true">→</span></span>
    </button>`;
  }

  function ministerioCard(cg) {
    const m = DB.ministerio(cg.min); if (!m) return "";
    return `<article class="lp-card">
      <div class="lp-card__top">
        <div class="lp-emoji">${m.ico}</div>
        <div><h3>${esc(m.nombre)}</h3><p class="lp-muted">${esc(cg.publico)}</p></div>
      </div>
      <div class="lp-meta"><span class="lp-pill">🗓️ ${esc(cg.horarioMes)}</span></div>
      <div class="lp-meta"><span class="lp-pill lp-pill--warn">✨ ${esc(cg.encuentro)}</span></div>
      <p class="lp-muted">Director: <b>${esc(cg.director)}</b></p>
      <div class="lp-card__actions">
        <a class="lp-btn lp-btn--wa lp-btn--sm" target="_blank" rel="noopener"
           href="https://wa.me/${cg.wa}?text=${encodeURIComponent("Hola, soy nuevo y quiero conocer el ministerio " + m.nombre)}">💬 Chat con el director</a>
        <button class="lp-btn lp-btn--primary lp-btn--sm" data-accion="form" data-tipo="ministerio" data-id="${cg.min}">Inscribirme · QR</button>
      </div>
    </article>`;
  }
  function afinidadCard(a) {
    const m = DB.ministerio(a.min);
    // El STORE es la fuente de verdad: conteo efectivo y estado abierto/cerrado.
    const S = window.STORE;
    const miembros = S ? S.miembrosEfectivos(a.id) : a.miembros;
    const cerrado = S ? S.cerrado(a.id) : false;
    const lleno = S ? S.lleno(a.id) : (a.miembros >= a.cupo);
    const p = pct(miembros, a.cupo);
    const txtBtn = cerrado ? "Inscripciones cerradas" : (lleno ? "Grupo lleno — ver otros" : "Registrarme en este grupo");
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
      <p class="lp-muted">Líder: <b>${esc(a.lider)}</b> · ${miembros}/${a.cupo} personas${cerrado ? " · <b style='color:var(--peligro)'>cerrado por el líder</b>" : ""}</p>
      <div class="lp-cupo"><i style="width:${p}%"></i></div>
      <div class="lp-card__actions">
        <button class="lp-btn ${lleno ? "lp-btn--ghost" : "lp-btn--primary"} lp-btn--sm lp-btn--block"
          data-accion="form" data-tipo="grupo" data-id="${a.id}" ${lleno ? "disabled" : ""}>
          ${txtBtn}</button>
      </div>
    </article>`;
  }
  // Meses cortos para formatear fechas ISO de los cursos.
  const MESES_C = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  function fechaCursoTxt(iso) {
    if (!iso) return "Matrícula abierta";
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d)) return iso;
    return `${d.getDate()} ${MESES_C[d.getMonth()]} ${d.getFullYear()}`;
  }
  function modalidadIco(m) {
    const t = (m || "").toLowerCase();
    if (t.indexOf("virtual") >= 0) return "💻";
    if (t.indexOf("híbrid") >= 0 || t.indexOf("hibrid") >= 0) return "🔀";
    return "📍";
  }
  // Normaliza un curso del STORE (por sede) o un instituto (global) a una
  // forma única para la tarjeta del landing.
  function normCurso(c) {
    const inst = c.tipo === "instituto";
    return {
      id: c.id, nombre: c.nombre, ico: c.ico, desc: c.desc, profesor: c.profesor,
      modalidad: c.modalidad, esInstituto: inst,
      horario: inst ? c.horario : `${c.dia || ""}${c.dia && c.sesiones ? " · " : ""}${c.sesiones || ""}`,
      iniciaTxt: inst ? c.inicia : fechaCursoTxt(c.inicia),
      inscritos: c.inscritos, cupo: c.cupo, sede: c.sede || "global"
    };
  }
  // Cursos cortos de la ciudad activa (desde STORE) + institutos globales.
  function creceLista() {
    const S = window.STORE;
    const cursos = (S && S.cursosDe ? S.cursosDe(estado.filtroCrece) : []).filter(c => c.activo !== false);
    const institutos = L.CRECE.filter(c => c.tipo === "instituto");
    return cursos.map(normCurso).concat(institutos.map(normCurso));
  }
  // Lookup de un curso (STORE primero, luego institutos del landing).
  function creceCurso(id) {
    const S = window.STORE;
    return (S && S.curso && S.curso(id)) || L.curso(id) || null;
  }
  function creceCard(c) {
    const inst = c.esInstituto;
    return `<article class="lp-card">
      <div class="lp-card__top">
        <div class="lp-emoji">${c.ico || "📘"}</div>
        <div><h3>${esc(c.nombre)}</h3><p class="lp-muted">${inst ? "Instituto bíblico" : "Curso corto"} · ${modalidadIco(c.modalidad)} ${esc(c.modalidad)}</p></div>
      </div>
      <p class="lp-muted">${esc(c.desc)}</p>
      <div class="lp-meta">
        ${c.profesor ? `<span class="lp-pill">🧑‍🏫 ${esc(c.profesor)}</span>` : ""}
        ${c.horario ? `<span class="lp-pill">🗓️ ${esc(c.horario)}</span>` : ""}
      </div>
      <div class="lp-meta">
        <span class="lp-pill ${inst ? "" : "lp-pill--ok"}">▶ ${esc(c.iniciaTxt)}</span>
        ${c.cupo ? `<span class="lp-pill">${c.inscritos}/${c.cupo} inscritos</span>` : ""}
      </div>
      <div class="lp-card__actions">
        <button class="lp-btn lp-btn--primary lp-btn--sm lp-btn--block" data-accion="form" data-tipo="curso" data-id="${c.id}">
          ${inst ? "Quiero más información / matricularme" : "Inscribirme a este curso"}</button>
      </div>
    </article>`;
  }
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
    const c = L.CONVOCATORIA; if (!c.activa) return "";
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

  function bloque(label, titulo, hint, contenido) {
    return `<div class="v2-block">
      <div class="v2-block__head"><span class="v2-label">${esc(label)}</span><h3>${esc(titulo)}</h3></div>
      ${hint ? `<p class="v2-block__hint">${esc(hint)}</p>` : ""}
      ${contenido}
    </div>`;
  }

  function cuerpoConoce() {
    const c = L.ciudad(estado.ciudad);
    const filtros = `<div class="lp-filtros" id="v2-pred-filtros" role="tablist" aria-label="Filtrar prédicas por iglesia">
        <button class="lp-chip ${estado.filtroPred === "all" ? "activo" : ""}" data-accion="predfiltro" data-ciudad="all">🌐 Todas</button>
        ${L.CIUDADES.map(cc => `<button class="lp-chip ${estado.filtroPred === cc.id ? "activo" : ""}" data-accion="predfiltro" data-ciudad="${cc.id}">📍 ${esc(cc.nombre)}</button>`).join("")}
      </div>`;
    const pred = `${filtros}<div class="lp-pred" id="v2-pred-grid">${predicasFiltradas().map(predicaCard).join("")}</div>`;
    const horarios = `<div class="lp-info">
        <h3>🕘 Horarios de la iglesia · ${esc(c.nombre)}</h3>
        <p class="lp-muted">${esc(c.direccion)} — te esperamos este domingo.</p>
        <div class="lp-info__servicios">${c.servicios.map(s => `<span class="lp-time">${esc(s)}</span>`).join("")}</div>
      </div>`;
    const mins = `<div class="v2-etapas">${CATEGORIAS.map(categoriaCard).join("")}</div>`;
    return bloque("Prédicas", "Mira y escucha", "Filtra por iglesia para ver las prédicas de cada ciudad.", pred)
      + bloque("Horarios", "Visítanos", null, horarios)
      + bloque("¿En qué etapa estás?", "Encuentra el tuyo", "Elige tu grupo y te conectamos con tu ministerio. Te ubicamos por tu edad y etapa de vida.", mins);
  }
  /* ---------- Conéctate: filtro en cascada (sede → género → edad → ministerio) ----------
     Defensivo: si una versión cacheada de store.js/landing-data.js aún no
     trae los helpers nuevos, degradamos en vez de romper la navegación. */
  function tieneFiltroSede() { return !!(L.afinidadesDeSede && L.sedesConAfinidad); }
  function gpAutorizado(afId) {
    const S = window.STORE;
    return !S || typeof S.autorizado !== "function" || S.autorizado(afId);
  }
  // Grupos de la sede activa (o todos si no hay soporte de sede).
  function afinidadesSedeActiva() {
    return tieneFiltroSede() ? L.afinidadesDeSede(estado.filtroSede) : L.AFINIDADES;
  }
  // Solo ministerios que (a) aplican al género/edad y (b) tienen al menos un
  // grupo AUTORIZADO por el pastor en la sede activa.
  function ministeriosAplicables() {
    const mins = L.ministeriosPara(estado.filtroGenero, estado.filtroEdad);
    const consede = afinidadesSedeActiva().filter(a => gpAutorizado(a.id)).map(a => a.min);
    return mins.filter(m => consede.includes(m.id));
  }
  // Chips de sede (igual que Prédicas/Crece): elige la iglesia cuyos grupos ves.
  function chipsSede() {
    if (!tieneFiltroSede()) return "";
    const sedes = L.sedesConAfinidad();
    return sedes.map(c => `<button class="lp-chip ${estado.filtroSede === c.id ? "activo" : ""}" data-accion="sedefiltro" data-ciudad="${c.id}">📍 ${esc(c.nombre)}${c.esMadre ? " · madre" : ""}</button>`).join("");
  }
  function notaSede() {
    if (!tieneFiltroSede()) return "";
    const c = L.ciudad(estado.filtroSede);
    const n = afinidadesSedeActiva().filter(a => gpAutorizado(a.id)).length;
    return `🛡️ Estos son los <b>${n} grupo${n === 1 ? "" : "s"} pequeño${n === 1 ? "" : "s"}</b> autorizados por el pastor de <b>${esc(c.nombre)}</b>. Cada sede abre los suyos.`;
  }
  function chipsMinisterios() {
    const mins = ministeriosAplicables();
    // Si el ministerio seleccionado ya no aplica al género/edad, vuelve a "Todos"
    if (estado.filtroAfin !== "all" && !mins.some(m => m.id === estado.filtroAfin)) estado.filtroAfin = "all";
    if (!mins.length) return `<span class="lp-muted" style="padding:6px 0">No hay ministerios para estos datos.</span>`;
    return `<button class="lp-chip ${estado.filtroAfin === "all" ? "activo" : ""}" data-accion="afinfiltro" data-filtro="all">Todos</button>`
      + mins.map(m => `<button class="lp-chip ${estado.filtroAfin === m.id ? "activo" : ""}" data-accion="afinfiltro" data-filtro="${m.id}">${m.ico} ${esc(m.nombre)}</button>`).join("");
  }
  function cuerpoConecta() {
    const edadVal = estado.filtroEdad == null ? "cualquier edad" : `${estado.filtroEdad} años`;
    const sliderVal = estado.filtroEdad == null ? 25 : estado.filtroEdad;
    const sede = !tieneFiltroSede() ? "" : `<div class="v2-cf">
        <div class="v2-cf__row">
          <span class="v2-cf__lbl">Mi sede</span>
          <div class="lp-filtros v2-cf__chips" id="v2-sede-filtros" role="tablist" aria-label="Filtrar grupos por sede">${chipsSede()}</div>
        </div>
      </div>
      <p class="v2-block__hint" id="v2-afin-sedenote" style="margin-top:-2px">${notaSede()}</p>`;
    const guia = `<div class="v2-cf">
        <div class="v2-cf__row">
          <span class="v2-cf__lbl">Soy</span>
          <div class="lp-filtros v2-cf__chips" id="v2-genero-filtros" role="tablist" aria-label="Filtrar por género">
            <button class="lp-chip ${estado.filtroGenero === "all" ? "activo" : ""}" data-accion="generofiltro" data-genero="all">Todos</button>
            <button class="lp-chip ${estado.filtroGenero === "hombre" ? "activo" : ""}" data-accion="generofiltro" data-genero="hombre">♂ Hombre</button>
            <button class="lp-chip ${estado.filtroGenero === "mujer" ? "activo" : ""}" data-accion="generofiltro" data-genero="mujer">♀ Mujer</button>
          </div>
        </div>
        <div class="v2-cf__row">
          <span class="v2-cf__lbl">Tengo <strong id="v2-edad-val">${edadVal}</strong></span>
          <input type="range" id="v2-edad" class="v2-cf__range" min="1" max="90" step="1" value="${sliderVal}"
                 aria-label="Tu edad" aria-valuetext="${edadVal}">
          <button class="lp-chip v2-cf__reset" data-accion="edadreset">Cualquier edad</button>
        </div>
      </div>`;
    const filtros = `<div class="lp-filtros" id="v2-afin-filtros" role="tablist" aria-label="Ministerios que aplican">${chipsMinisterios()}</div>`;
    return bloque("Grupos pequeños", "Donde perteneces",
      "Elige tu sede; luego dinos tu género y edad. Te mostramos solo los grupos que el pastor de esa sede tiene abiertos para ti.",
      `${sede}${guia}${filtros}<div class="lp-grid" id="v2-afin-grid">${listaAfinidades()}</div>`);
  }
  function listaAfinidades() {
    const aplican = ministeriosAplicables().map(m => m.id);
    // Solo grupos de la sede activa, autorizados por el pastor, del ministerio elegido.
    let items = afinidadesSedeActiva()
      .filter(a => aplican.includes(a.min))
      .filter(a => gpAutorizado(a.id));
    if (estado.filtroAfin !== "all") items = items.filter(a => a.min === estado.filtroAfin);
    if (!items.length) {
      const dondeSede = tieneFiltroSede() ? `En <b>${esc(L.ciudad(estado.filtroSede).nombre)}</b> no` : "No";
      return `<p class="lp-muted">${dondeSede} hay grupos que coincidan con estos filtros. ${tieneFiltroSede() ? "Cambia de sede, ajusta" : "Ajusta"} el género o la edad, o toca “Cualquier edad”.</p>`;
    }
    return items.map(afinidadCard).join("");
  }
  // Repinta ministerios + grilla + etiqueta de edad sin recrear el slider (mantiene el arrastre)
  function repintarConecta() {
    const val = document.getElementById("v2-edad-val");
    if (val) val.textContent = estado.filtroEdad == null ? "cualquier edad" : `${estado.filtroEdad} años`;
    document.querySelectorAll("#v2-sede-filtros .lp-chip").forEach(c => c.classList.toggle("activo", c.dataset.ciudad === estado.filtroSede));
    const nota = document.getElementById("v2-afin-sedenote"); if (nota) nota.innerHTML = notaSede();
    document.querySelectorAll("#v2-genero-filtros .lp-chip").forEach(c => c.classList.toggle("activo", c.dataset.genero === estado.filtroGenero));
    const fil = document.getElementById("v2-afin-filtros"); if (fil) fil.innerHTML = chipsMinisterios();
    const g = document.getElementById("v2-afin-grid"); if (g) g.innerHTML = listaAfinidades();
  }
  function cuerpoCrece() {
    const filtros = `<div class="lp-filtros" id="v2-crece-filtros" role="tablist" aria-label="Filtrar cursos por iglesia">
        ${L.CIUDADES.map(cc => `<button class="lp-chip ${estado.filtroCrece === cc.id ? "activo" : ""}" data-accion="crecefiltro" data-ciudad="${cc.id}">📍 ${esc(cc.nombre)}</button>`).join("")}
      </div>`;
    return bloque("Formación", "Crece con fundamento",
      "Cada sede abre sus cursos cortos con fechas, horarios y modalidad propios. Elige tu ciudad. Los Institutos IBLI · FACTER son virtuales para toda la red.",
      `${filtros}<div class="lp-grid" id="v2-crece-grid">${creceLista().map(creceCard).join("")}</div>`);
  }
  // Los equipos son los mismos en toda la red; cada sede activa el subconjunto que usa.
  // La sede madre (bogota) tiene todos; las demás, un subconjunto determinista (los
  // 4 equipos base siempre; Creativo/AMEC/Oración según la sede).
  function equiposDeSede(ciudadId) {
    if (ciudadId === "bogota") return L.SIRVE.slice();
    const h = String(ciudadId).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return L.SIRVE.filter((t, j) => j <= 3 || ((h * 7 + j * 13) % 100) >= 45);
  }
  function notaSirve() {
    const eqs = equiposDeSede(estado.filtroSirve);
    return `Los equipos son los mismos en toda la red; cada sede activa los que usa. <b>${esc(ciudadNombre(estado.filtroSirve))}</b> tiene <b>${eqs.length}</b> de ${L.SIRVE.length} equipos abiertos.`;
  }
  function cuerpoSirve() {
    const chips = `<div class="lp-filtros" id="v2-sirve-filtros" role="tablist" aria-label="Filtrar equipos por sede">
        ${L.CIUDADES.map(cc => `<button class="lp-chip ${estado.filtroSirve === cc.id ? "activo" : ""}" data-accion="sirvefiltro" data-ciudad="${cc.id}">📍 ${esc(cc.nombre)}</button>`).join("")}
      </div>`;
    const eqs = equiposDeSede(estado.filtroSirve);
    return bloque("Equipos", "Elige dónde servir",
      "Pasa de asistir a pertenecer. Elige tu sede; te mostramos los equipos abiertos ahí. Postúlate con un toque o escaneando el QR del equipo.",
      `${chips}<p class="lp-muted" id="v2-sirve-nota">${notaSirve()}</p><div class="lp-grid" id="v2-sirve-grid">${eqs.map(sirveCard).join("")}</div>`)
      + `<div class="v2-block">${convocatoria()}</div>`;
  }

  function cuerpoEtapa(id) {
    if (id === "conoce") return cuerpoConoce();
    if (id === "conecta") return cuerpoConecta();
    if (id === "crece") return cuerpoCrece();
    if (id === "sirve") return cuerpoSirve();
    return "";
  }

  function detalle(e) {
    return `
    <section class="v2-detail" id="v2-detail" aria-label="Etapa ${esc(e.titulo)}" style="--detail-accent:${e.accent}">
      <div class="v2-detail__hero">
        <img src="${e.img}" alt="" aria-hidden="true"
             onerror="this.style.display='none'">
        <div class="v2-detail__heroin">
          <button class="v2-back" data-accion="inicio">← Volver al índice</button>
          <div class="v2-detail__num">${e.n} / 04 · ${esc(e.kicker)}</div>
          <h1 class="v2-detail__title">${esc(e.titulo)}</h1>
          <p class="v2-detail__lead">${esc(e.lead)}</p>
        </div>
      </div>
      <div class="v2-detail__body">${cuerpoEtapa(e.id)}</div>
    </section>`;
  }

  /* ============================================================
     RENDER PRINCIPAL
     ============================================================ */
  function render() {
    const app = document.getElementById("v2-app");
    let indice = estado.paso
      ? detalle(etapa(estado.paso))
      : (estado.vista === "slider" ? indiceSlider() : indiceLista());

    const cabeza = estado.paso ? "" : (cabecera() + marquee());
    app.innerHTML = topbar() + cabeza + `<main id="main">${indice}</main>` + footer();

    enlazar();
    if (!estado.paso) {
      if (estado.vista === "lista") montarHoverImg();
      else montarSlider();
    }
    revelar();
    sincronizarTop();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function enlazar() {
    const sel = document.getElementById("v2-ciudad");
    if (sel) sel.addEventListener("change", ev => {
      estado.ciudad = ev.target.value;
      estado.filtroPred = estado.ciudad;
      estado.filtroCrece = estado.ciudad;
      estado.filtroSede = estado.ciudad;
      estado.filtroSirve = estado.ciudad;
      render();
      toast(`Ciudad activa: ${L.ciudad(estado.ciudad).nombre}`, true);
    });
    const edadEl = document.getElementById("v2-edad");
    if (edadEl) edadEl.addEventListener("input", ev => {
      estado.filtroEdad = ev.target.value === "" ? null : Number(ev.target.value);
      repintarConecta();
    });
    document.getElementById("v2-app").addEventListener("click", manejar);
    document.getElementById("v2-app").addEventListener("keydown", ev => {
      if ((ev.key === "Enter" || ev.key === " ") && ev.target.matches(".v2-row, .v2-slide")) {
        ev.preventDefault(); ev.target.click();
      }
    });
  }

  function manejar(e) {
    const el = e.target.closest("[data-accion]");
    if (!el) return;
    const a = el.dataset.accion;
    if (a === "entrar") { e.preventDefault(); entrar(el.dataset.paso); }
    else if (a === "inicio") { e.preventDefault(); estado.paso = null; render(); }
    else if (a === "vista") { estado.vista = el.dataset.vista; render(); }
    else if (a === "orden") { estado.orden = el.dataset.orden; render(); }
    else if (a === "slide-next") moverSlider(1);
    else if (a === "slide-prev") moverSlider(-1);
    else if (a === "predfiltro") {
      estado.filtroPred = el.dataset.ciudad;
      document.querySelectorAll("#v2-pred-filtros .lp-chip").forEach(c => c.classList.toggle("activo", c.dataset.ciudad === estado.filtroPred));
      const g = document.getElementById("v2-pred-grid"); if (g) g.innerHTML = predicasFiltradas().map(predicaCard).join("");
    }
    else if (a === "crecefiltro") {
      estado.filtroCrece = el.dataset.ciudad;
      document.querySelectorAll("#v2-crece-filtros .lp-chip").forEach(c => c.classList.toggle("activo", c.dataset.ciudad === estado.filtroCrece));
      const g = document.getElementById("v2-crece-grid"); if (g) g.innerHTML = creceLista().map(creceCard).join("");
    }
    else if (a === "sirvefiltro") {
      estado.filtroSirve = el.dataset.ciudad;
      document.querySelectorAll("#v2-sirve-filtros .lp-chip").forEach(c => c.classList.toggle("activo", c.dataset.ciudad === estado.filtroSirve));
      const g = document.getElementById("v2-sirve-grid"); if (g) g.innerHTML = equiposDeSede(estado.filtroSirve).map(sirveCard).join("");
      const n = document.getElementById("v2-sirve-nota"); if (n) n.innerHTML = notaSirve();
    }
    else if (a === "sedefiltro") {
      estado.filtroSede = el.dataset.ciudad;
      estado.filtroAfin = "all";
      repintarConecta();
      toast(`Grupos de ${L.ciudad(estado.filtroSede).nombre}`, true);
    }
    else if (a === "afinfiltro") {
      estado.filtroAfin = el.dataset.filtro;
      repintarConecta();
    }
    else if (a === "generofiltro") {
      estado.filtroGenero = el.dataset.genero;
      repintarConecta();
    }
    else if (a === "edadreset") {
      estado.filtroEdad = null;
      const s = document.getElementById("v2-edad"); if (s) s.value = 25;
      repintarConecta();
    }
    else if (a === "form") abrirForm(el.dataset.tipo, el.dataset.id);
  }

  function entrar(id) {
    if (!etapa(id)) return;
    estado.paso = id;
    estado.filtroAfin = "all";
    estado.filtroGenero = "all";
    estado.filtroEdad = null;
    estado.filtroSede = estado.ciudad;  // arranca en la sede activa del visitante
    render();
  }

  /* ---------- Slider: navegación + contador ---------- */
  function montarSlider() {
    const sl = document.getElementById("v2-slider");
    if (!sl) return;
    const upd = () => {
      const slides = [...sl.querySelectorAll(".v2-slide")];
      const c = sl.scrollLeft + sl.clientWidth / 2;
      let idx = 0, best = Infinity;
      slides.forEach((s, i) => { const m = s.offsetLeft + s.offsetWidth / 2; const d = Math.abs(m - c); if (d < best) { best = d; idx = i; } });
      const cnt = document.getElementById("v2-counter");
      if (cnt) cnt.innerHTML = `<b>${String(idx + 1).padStart(2, "0")}</b> / ${String(slides.length).padStart(2, "0")}`;
    };
    sl.addEventListener("scroll", upd, { passive: true });
    upd();
  }
  function moverSlider(dir) {
    const sl = document.getElementById("v2-slider");
    if (!sl) return;
    const first = sl.querySelector(".v2-slide");
    const step = first ? first.offsetWidth + 22 : sl.clientWidth * 0.8;
    sl.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  /* ---------- Hover-image (modo lista) ---------- */
  function montarHoverImg() {
    const box = document.getElementById("v2-hoverimg");
    if (!box) return;
    const img = box.querySelector("img");
    const rows = [...document.querySelectorAll(".v2-row")];
    let active = false;
    rows.forEach(r => {
      r.addEventListener("mouseenter", () => { img.src = r.dataset.img; box.classList.add("on"); active = true; });
      r.addEventListener("mouseleave", () => { box.classList.remove("on"); active = false; });
    });
    document.addEventListener("mousemove", ev => {
      if (!active) return;
      box.style.left = ev.clientX + "px";
      box.style.top = ev.clientY + "px";
    }, { passive: true });
  }

  /* ---------- Reveal ---------- */
  let _io = null;
  function revelar() {
    const sel = ".lp-card, .lp-pred__card, .lp-info, .lp-convoc, .v2-block";
    if (typeof IntersectionObserver === "undefined") { document.querySelectorAll(sel).forEach(e => e.classList.add("reveal", "in")); return; }
    if (!_io) _io = new IntersectionObserver(ents => {
      ents.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); _io.unobserve(en.target); } });
    }, { threshold: 0.06, rootMargin: "0px 0px -30px 0px" });
    document.querySelectorAll(sel).forEach(e => { if (!e.classList.contains("reveal")) { e.classList.add("reveal"); _io.observe(e); } });
  }

  /* ---------- Top bar al hacer scroll ---------- */
  let _topBound = false;
  function sincronizarTop() {
    const fn = () => { const t = document.querySelector(".v2-top"); if (t) t.classList.toggle("scrolled", (window.scrollY || 0) > 10); };
    fn();
    if (!_topBound) { window.addEventListener("scroll", fn, { passive: true }); _topBound = true; }
  }

  /* ============================================================
     FORMULARIO + QR (idéntico en comportamiento al v1)
     ============================================================ */
  function contextoForm(tipo, id) {
    if (tipo === "auto") {
      return { modo: "auto", titulo: "Regístrate y te ubicamos", sub: "Cuéntanos de ti y te conectamos al ministerio ideal",
        destino: "Casa Roca", qr: deepLink({ paso: "conoce", auto: 1 }) };
    }
    if (tipo === "cat") {
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
      const sexoPreset = id === "m_hombres" ? "Hombre" : id === "m_mujer" ? "Mujer" : null;
      return { modo: "fijo", destinoFijoId: id, sexoPreset,
        titulo: `Inscríbete a ${m.nombre || "este ministerio"}`, sub: "Ministerio congregacional",
        destino: m.nombre, qr: deepLink({ paso: "conoce", inscribir: id }) };
    }
    if (tipo === "grupo") {
      const g = L.afinidad(id) || {}; const m = DB.ministerio(g.min) || {};
      return { tipo: "grupo", id, titulo: `Únete a ${g.nombre || "este grupo"}`, sub: `Grupo pequeño · ${m.nombre || ""}`,
        destino: g.nombre, qr: deepLink({ paso: "conecta", grupo: id }), extra: `${g.dia} ${g.hora} · ${g.lugar}` };
    }
    if (tipo === "curso") {
      const c = creceCurso(id) || {};
      const esInst = c.tipo === "instituto";
      const horario = esInst ? c.horario : `${c.dia || ""}${c.dia && c.sesiones ? " · " : ""}${c.sesiones || ""}`;
      const inicia = esInst ? c.inicia : fechaCursoTxt(c.inicia);
      return { titulo: `Inscríbete a ${c.nombre || "este curso"}`, sub: esInst ? "Instituto bíblico" : "Curso corto",
        destino: c.nombre, qr: deepLink({ paso: "crece", curso: id }), extra: `${horario}${horario && inicia ? " · inicia " + inicia : ""}` };
    }
    if (tipo === "sirve") {
      const s = L.equipoSirve(id) || {};
      return { titulo: `Servir en ${s.nombre || "este equipo"}`, sub: "Equipo de servicio",
        destino: s.nombre, qr: deepLink({ paso: "sirve", sirve: id }) };
    }
    return { titulo: "Postúlate para servir", sub: "Convocatoria de servicio",
      destino: "la convocatoria de servicio", qr: deepLink({ paso: "sirve", convoc: 1 }) };
  }

  function abrirForm(tipo, id) {
    const ctx = contextoForm(tipo, id);
    const capa = document.getElementById("v2-modal");
    capa.innerHTML = `
      <div class="lp-modalbg" id="v2-modalbg">
        <div class="lp-modal" role="dialog" aria-modal="true" aria-labelledby="v2-modal-t">
          <div class="lp-modal__head">
            <div><h3 id="v2-modal-t">${esc(ctx.titulo)}</h3><div class="sub">${esc(ctx.sub)}${ctx.extra ? " · " + esc(ctx.extra) : ""}</div></div>
            <button class="lp-modal__x" id="v2-modal-x" aria-label="Cerrar">✕</button>
          </div>
          <div class="lp-modal__body" id="v2-modal-body">
            <div class="lp-qr">
              <div class="lp-qr__img">${qrImg(qrCentral())}</div>
              <div class="lp-qr__txt"><b>QR central de inscripción</b><p>Un solo QR para toda la sede: lleva a cualquier persona al registro general y el formulario la ubica por edad y etapa. Imprime <b>uno</b> y úsalo en todos los ministerios.</p></div>
            </div>
            <form id="v2-form" novalidate>
              <div class="lp-ubica${ctx.modo === "auto" ? "" : " lp-ubica--ok"}" id="v2-ubica">${
                ctx.modo === "auto"
                  ? `<b>📍 Te ubicaremos automáticamente</b><span>Completa tu edad y estado civil y te diremos tu ministerio.</span>`
                  : `<b>${(MIN_META[ctx.destinoFijoId] || {}).ico || "📍"} ${esc(ctx.destino)}</b><span>Quedarás conectado(a) aquí.</span>`
              }</div>
              <div class="lp-field"><label for="vf-sede">Iglesia / Sede <span class="req">*</span></label>
                <select class="lp-select" id="vf-sede" name="sede" required aria-describedby="vf-sede-hint">
                  ${L.CIUDADES.map(x => `<option value="${x.id}" ${x.id === estado.ciudad ? "selected" : ""}>${esc(x.nombre)}</option>`).join("")}
                </select>
                <span class="lp-fieldhint" id="vf-sede-hint">Tu registro queda en esta iglesia. Por defecto es la sede que elegiste arriba.</span></div>
              <div class="lp-row">
                <div class="lp-field"><label for="vf-nom">Nombres <span class="req">*</span></label>
                  <input class="lp-input" id="vf-nom" name="nombres" required autocomplete="given-name"></div>
                <div class="lp-field"><label for="vf-ape">Apellidos <span class="req">*</span></label>
                  <input class="lp-input" id="vf-ape" name="apellidos" required autocomplete="family-name"></div>
              </div>
              ${
                ctx.sexoPreset
                  ? `<input type="hidden" name="sexo" value="${ctx.sexoPreset}"><div class="lp-field"><label>Soy</label><div class="lp-locked">${ctx.sexoPreset === "Hombre" ? "🛡️ Hombre" : "🌷 Mujer"} <span class="muted">· definido por el ministerio</span></div></div>`
                  : `<div class="lp-field"><label>Soy <span class="req">*</span></label><div class="lp-seg" role="radiogroup" aria-label="Sexo"><label class="lp-segopt"><input type="radio" name="sexo" value="Hombre" required><span>🛡️ Hombre</span></label><label class="lp-segopt"><input type="radio" name="sexo" value="Mujer" required><span>🌷 Mujer</span></label></div></div>`
              }
              <div class="lp-row">
                <div class="lp-field"><label for="vf-edad">Edad <span class="req">*</span></label>
                  <input class="lp-input" id="vf-edad" name="edad" type="number" min="0" max="120" inputmode="numeric" required></div>
                <div class="lp-field"><label for="vf-cumple">Cumpleaños</label>
                  <input class="lp-input" id="vf-cumple" name="cumple" type="date"></div>
              </div>
              <div class="lp-field" id="v2-etapa-field"><label for="vf-etapa">Etapa de vida</label>
                <select class="lp-select" id="vf-etapa" name="etapa" disabled>
                  <option value="">Indica tu edad primero…</option>
                </select></div>
              <div class="lp-field"><label for="vf-civil">Estado civil</label>
                <select class="lp-select" id="vf-civil" name="civil">
                  <option value="">Prefiero no decir</option>
                  <option>Soltero(a)</option><option>Casado(a)</option><option>Unión libre</option>
                  <option>Separado(a)</option><option>Viudo(a)</option>
                </select></div>
              <div class="lp-casa2" id="v2-casa2" hidden>
                <div class="lp-field"><label for="vf-anos">Años de casados</label>
                  <select class="lp-select" id="vf-anos" name="anosCasado">
                    <option value="">Selecciona…</option>
                    ${ANOS_CASADO.map(a => `<option>${a}</option>`).join("")}
                  </select></div>
                <div class="lp-coyuge">
                  <div class="lp-coyuge__head">💑 Datos del cónyuge <span class="muted">(opcional)</span></div>
                  <div class="lp-row">
                    <div class="lp-field"><label for="vf-cony-nom">Nombres</label>
                      <input class="lp-input" id="vf-cony-nom" name="conyugeNombres"></div>
                    <div class="lp-field"><label for="vf-cony-ape">Apellidos</label>
                      <input class="lp-input" id="vf-cony-ape" name="conyugeApellidos"></div>
                  </div>
                  <div class="lp-row">
                    <div class="lp-field"><label for="vf-cony-tel">Teléfono / WhatsApp</label>
                      <input class="lp-input" id="vf-cony-tel" name="conyugeTel" type="tel" placeholder="+57 300 000 0000"></div>
                    <div class="lp-field"><label for="vf-cony-mail">Correo</label>
                      <input class="lp-input" id="vf-cony-mail" name="conyugeCorreo" type="email" placeholder="conyuge@email.com"></div>
                  </div>
                </div>
              </div>
              <div class="lp-field"><label for="vf-mail">Correo <span class="req">*</span></label>
                <input class="lp-input" id="vf-mail" name="correo" type="email" required autocomplete="email" placeholder="tucorreo@email.com"></div>
              <div class="lp-field"><label for="vf-tel">Teléfono / WhatsApp <span class="req">*</span></label>
                <input class="lp-input" id="vf-tel" name="telefono" type="tel" required autocomplete="tel" placeholder="+57 300 000 0000"></div>
              <label class="lp-consent"><input type="checkbox" id="vf-ok" required>
                <span>Autorizo el tratamiento de mis datos para ser contactado por Casa Roca (Ley 1581/2012 · GDPR).</span></label>
              <button class="lp-btn lp-btn--primary lp-btn--block" type="submit">${ctx.modo === "auto" ? "Confirmar y ubicarme" : "Confirmar inscripción"}</button>
            </form>
          </div>
        </div>
      </div>`;
    document.getElementById("v2-modalbg").addEventListener("click", ev => { if (ev.target.id === "v2-modalbg") cerrarForm(); });
    document.getElementById("v2-modal-x").addEventListener("click", cerrarForm);
    document.getElementById("v2-form").addEventListener("submit", ev => { ev.preventDefault(); enviarForm(ctx); });
    document.addEventListener("keydown", escClose);
    cablearForm(ctx);
    setTimeout(() => { const f = document.getElementById("vf-nom"); if (f) f.focus(); }, 60);
  }

  /* Cableado en vivo: etapa según edad, bloque Casa2 y ubicación sugerida. */
  function cablearForm(ctx) {
    const form = document.getElementById("v2-form");
    if (!form) return;
    const auto = ctx.modo === "auto";
    const fEdad = form.querySelector("#vf-edad");
    const fCivil = form.querySelector("#vf-civil");
    const fEtapa = form.querySelector("#vf-etapa");
    const casa2 = form.querySelector("#v2-casa2");
    const ubica = document.getElementById("v2-ubica");

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
  function cerrarForm() { document.getElementById("v2-modal").innerHTML = ""; document.removeEventListener("keydown", escClose); }

  function enviarForm(ctx) {
    const form = document.getElementById("v2-form");
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const d = Object.fromEntries(new FormData(form).entries());
    const nombre = (d.nombres || "").trim() || "Persona";
    const correo = (d.correo || "").trim();
    const tel = (d.telefono || "").trim();

    // Resolver la IGLESIA/SEDE del ingreso: el select del formulario manda;
    // si faltara, cae a la sede activa del selector global. Así cada
    // inscrito queda atribuido a la iglesia correcta.
    const sedeId = (d.sede || estado.ciudad);
    const iglesia = ciudadNombre(sedeId);

    // Resolver el ministerio final: en modo auto se calcula por edad/estado civil.
    let destino = ctx.destino;
    let ministerioId = ctx.destinoFijoId || null;
    if (ctx.modo === "auto") {
      const r = ruteoAuto({ edad: d.edad, civil: d.civil });
      ministerioId = r.id || null;
      destino = (MIN_META[r.id] || {}).nombre || ctx.destino || "Casa Roca";
    } else if (ctx.modo === "fijo" && ctx.destinoFijoId && MIN_META[ctx.destinoFijoId]) {
      destino = MIN_META[ctx.destinoFijoId].nombre;
      ministerioId = ctx.destinoFijoId;
    }

    // Si es un grupo pequeño, guardamos al inscrito en el STORE compartido:
    // así el líder lo ve en vivo en su panel y el cupo se actualiza.
    if (ctx.tipo === "grupo" && ctx.id && window.STORE) {
      const cumple = (d.cumple || "").trim(); // YYYY-MM-DD
      const persona = {
        nombres: nombre, apellidos: (d.apellidos || "").trim(),
        correo, telefono: tel,
        edad: d.edad ? parseInt(d.edad, 10) : null,
        estadoCivil: (d.civil || "").trim(),
        cumpleMes: cumple ? parseInt(cumple.slice(5, 7), 10) : null,
        cumpleDia: cumple ? parseInt(cumple.slice(8, 10), 10) : null,
        sede: sedeId, iglesia,
        ministerioId, ministerio: destino,
        etapa: "conoce", fuente: "Inscripción por el landing"
      };
      const r = window.STORE.agregar(ctx.id, persona);
      if (!r.ok) {
        toast(r.motivo === "cerrado" ? "Este grupo cerró inscripciones." : "Este grupo ya está lleno.", false);
        cerrarForm();
        const g = document.getElementById("v2-afin-grid"); if (g) g.innerHTML = listaAfinidades();
        return;
      }
      const grid = document.getElementById("v2-afin-grid"); if (grid) grid.innerHTML = listaAfinidades();
    }

    document.getElementById("v2-modal-body").innerHTML = `
      <div class="lp-ok">
        <div class="lp-ok__ic">✓</div>
        <h3>¡Listo, ${esc(nombre)}!</h3>
        <p>Quedaste conectado(a) en <b>${esc(destino)}</b> · <b>${esc(iglesia)}</b>. Ya eres parte. Te enviamos toda la información por estos canales:</p>
        <div class="lp-ok__canales">
          <div class="lp-ok__canal"><span class="ic">✉️</span><div><b>Correo enviado</b><span>${esc(correo)} — confirmación y próximos pasos</span></div></div>
          <div class="lp-ok__canal"><span class="ic">💬</span><div><b>WhatsApp enviado</b><span>${esc(tel)} — tu líder te escribirá para darte la bienvenida</span></div></div>
        </div>
        <button class="lp-btn lp-btn--mostaza lp-btn--block" id="v2-ok-close">Seguir explorando</button>
      </div>`;
    document.getElementById("v2-ok-close").addEventListener("click", cerrarForm);
    toast(`Inscripción confirmada en ${destino} · ${iglesia} ✓`, true);
  }

  /* ---------- Toast ---------- */
  function toast(msg, ok) {
    const wrap = document.getElementById("v2-toasts");
    const el = document.createElement("div");
    el.className = "lp-toast" + (ok ? " lp-toast--ok" : "");
    el.innerHTML = `<span>${ok ? "✓" : "ℹ️"}</span><span>${esc(msg)}</span>`;
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateY(8px)"; setTimeout(() => el.remove(), 250); }, 3000);
  }

  /* ---------- Deep links (QR entrantes) ---------- */
  function aplicarDeepLink() {
    const q = new URLSearchParams(location.search);
    if (q.get("ciudad") && L.CIUDADES.some(c => c.id === q.get("ciudad"))) { estado.ciudad = q.get("ciudad"); estado.filtroPred = q.get("ciudad"); estado.filtroCrece = q.get("ciudad"); estado.filtroSirve = q.get("ciudad"); }
    const paso = q.get("paso");
    if (paso && etapa(paso)) estado.paso = paso;
    render();
    if (q.get("registro") || q.get("auto")) abrirForm("auto", "auto");
    else if (q.get("inscribir")) abrirForm("ministerio", q.get("inscribir"));
    else if (q.get("grupo")) abrirForm("grupo", q.get("grupo"));
    else if (q.get("curso")) abrirForm("curso", q.get("curso"));
    else if (q.get("sirve")) abrirForm("sirve", q.get("sirve"));
    else if (q.get("convoc")) abrirForm("convoc", "convoc");
  }

  window.LPV2 = { render, estado, entrar, abrirForm, contextoForm, ETAPAS };

  /* ---------- Sync en vivo: cuando un pastor crea/edita un curso en
     su plataforma (otra pestaña/rol), el STORE emite y refrescamos la
     grilla de "Crece" sin recargar la página. ---------- */
  if (window.STORE && window.STORE.onCambio) {
    window.STORE.onCambio(() => {
      // Crece: cursos por sede.
      if (estado.paso === "crece") {
        const g = document.getElementById("v2-crece-grid");
        if (g) g.innerHTML = creceLista().map(creceCard).join("");
      }
      // Conéctate: si el pastor publica/oculta un grupo de su sede, se refleja aquí.
      if (estado.paso === "conecta") repintarConecta();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", aplicarDeepLink);
  else aplicarDeepLink();
})();
