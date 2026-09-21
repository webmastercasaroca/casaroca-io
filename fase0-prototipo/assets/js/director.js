/* ============================================================
   CASA ROCA · APP DEL DIRECTOR DE MINISTERIO — Capa 2
   Demo: ministerio J+25 (m_j25), director Andrés Lozano.
   Lee window.LANDING, window.DB, window.STORE (grupo Café & Palabra
   en vivo) y window.DIRECTOR / window.DSTORE (resto del ministerio).
   Sin frameworks. Vistas = funciones que devuelven HTML.
   ============================================================ */
(function () {
  const L = window.LANDING;
  const DB = window.DB;
  const S = window.STORE;
  const D = window.DIRECTOR;
  const DS = window.DSTORE;

  const MIN_ID = D.MIN_ID;             // "m_j25"
  const CAFE = "af_j25_cafe";          // grupo en vivo (STORE)
  const USER = D.DIRECTOR_USER;

  let sesion = false;
  let vista = "analitica";
  let clickBound = false;
  let temDrill = null;          // id de la temática abierta en el detalle

  /* ------------------------------------------------------------ utils */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const app = () => document.getElementById("dr-app");
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const MESES_L = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const DOW = ["L", "M", "X", "J", "V", "S", "D"];
  const ETAPAS = {
    conoce: { lbl: "Conoce", color: "var(--etapa-conoce)" },
    conecta: { lbl: "Conéctate", color: "var(--etapa-conecta)" },
    crece: { lbl: "Crece", color: "var(--etapa-crece)" },
    sirve: { lbl: "Sirve", color: "var(--etapa-sirve)" },
  };
  const CURSO_NOMBRES = { adn: "ADN", bautizo: "Bautizo", madurez: "Madurez Espiritual", llaves: "Llaves del Poder", ibli: "IBLI", facter: "FACTER" };

  function nombreCompleto(p) { return `${p.nombres || ""} ${p.apellidos || ""}`.trim(); }
  function iniciales(p) { return ((p.nombres || "")[0] || "") + ((p.apellidos || "")[0] || ""); }
  function generoDe(p) {
    if (p.genero === "F" || p.genero === "M") return p.genero;
    const ec = (p.estadoCivil || "").toLowerCase();
    if (/(soltera|casada|unida|viuda|divorciada)/.test(ec)) return "F";
    if (/(soltero|casado|unido|viudo|divorciado)/.test(ec)) return "M";
    const n = (p.nombres || "").trim().toLowerCase();
    return /a$/.test(n) ? "F" : "M"; // heurística de respaldo (demo)
  }
  function diasDesde(iso) { if (!iso) return 9999; const d = new Date(iso); const h = new Date(); h.setHours(0, 0, 0, 0); return Math.round((h - d) / 86400000); }
  function diasHastaCumple(mes, dia) {
    if (!mes || !dia) return null;
    const h = new Date(); h.setHours(0, 0, 0, 0);
    let pr = new Date(h.getFullYear(), mes - 1, dia);
    if (pr < h) pr = new Date(h.getFullYear() + 1, mes - 1, dia);
    return Math.round((pr - h) / 86400000);
  }
  function fechaCorta(iso) { if (!iso) return "—"; const d = new Date(iso); return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`; }
  function soloDigitos(t) { return String(t || "").replace(/\D/g, ""); }
  function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }

  /* ----------------------------------------- enlaces correo / WhatsApp */
  function waLink(p) {
    const n = (p.nombres || "").split(" ")[0];
    const msg = `Hola ${n}, soy Andrés, director del ministerio J+25 de Casa Roca 🙌 Qué alegría tenerte. ¿Cómo estás?`;
    return `https://wa.me/${soloDigitos(p.telefono)}?text=${encodeURIComponent(msg)}`;
  }
  function mailLink(p) {
    const n = (p.nombres || "").split(" ")[0];
    const asunto = "Hola desde J+25 · Casa Roca";
    const cuerpo = `Hola ${n},\n\nSoy Andrés Lozano, director de J+25. Quiero acompañarte de cerca en este tiempo.\n\nUn abrazo,\nAndrés`;
    return `mailto:${p.correo}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
  }
  function waLinkLider(g) {
    const n = (g.lider || "").split(" ")[0];
    return `https://wa.me/${soloDigitos(g.liderTel)}?text=${encodeURIComponent("Hola " + n + ", soy Andrés (director J+25). ¿Cómo va tu grupo?")}`;
  }

  /* ------------------------------------------ datos derivados de grupos */
  function liderActual(afId) {
    const lid = DS.liderDeGrupo(afId);
    const lider = D.LIDERES.find(l => l.id === lid);
    const base = D.GRUPOS.find(g => g.afId === afId) || {};
    return { afId, liderId: lid, lider: lider ? lider.nombre : base.lider, liderTel: lider ? lider.tel : base.liderTel, liderEmail: lider ? lider.email : base.liderEmail };
  }
  function rosterDe(afId) {
    const asign = DS.asignadosDe(afId);
    if (afId === CAFE) return S.inscritos(CAFE).concat(asign);
    return D.rosterDe(afId).concat(asign);
  }
  function gruposMin() {
    return D.GRUPOS.map(g => {
      const r = rosterDe(g.afId);
      const a = L.afinidad(g.afId);
      const li = liderActual(g.afId);
      return { afId: g.afId, af: a, lider: li.lider, liderId: li.liderId, liderTel: li.liderTel, liderEmail: li.liderEmail, roster: r, total: r.length, cupo: a ? a.cupo : 0, live: g.afId === CAFE };
    });
  }
  // Todas las personas del ministerio (para analítica): rosters de grupos + equipo
  function personasMin() {
    const out = [];
    gruposMin().forEach(g => g.roster.forEach(p => out.push(Object.assign({ _grupo: g.af ? g.af.nombre : g.afId }, p))));
    DS.equipo().forEach(p => out.push(Object.assign({ _equipo: true }, p)));
    return out;
  }

  // Registro único (deduplicado por correo): cada persona con su grupo y si
  // sirve. Fuente de verdad para el CRM y la analítica.
  function registro() {
    const byKey = new Map();
    gruposMin().forEach(g => g.roster.forEach(p => {
      const k = (p.correo || p.id).toLowerCase();
      if (!byKey.has(k)) byKey.set(k, Object.assign({}, p, { grupo: g.af ? g.af.nombre : g.afId, grupoId: g.afId, lider: g.lider, sirve: false }));
    }));
    DS.equipo().forEach(p => {
      const k = (p.correo || p.id).toLowerCase();
      if (byKey.has(k)) { const x = byKey.get(k); x.sirve = true; x.sirveEn = p.sirveEn; if (!(x.cursos && x.cursos.length)) x.cursos = p.cursos; }
      else byKey.set(k, Object.assign({}, p, { grupo: "Sin grupo", grupoId: null, lider: "—", sirve: true }));
    });
    return [...byKey.values()];
  }

  /* ============================================================ LOGIN */
  function vistaLogin() {
    return `
    <div class="dr-login">
      <div class="dr-login__card">
        <div class="dr-login__logo">CR</div>
        <h1>Dirección de Ministerio</h1>
        <p>Conoce, acompaña y rodea a tu ministerio. Entra para ver tu analítica, grupos, equipo y agenda.</p>
        <button class="dr-google" id="dr-google">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Continuar con Google
        </button>
        <div class="dr-login__nota">🔒 Demo Fase 0 — entrarás como <b>${esc(USER.nombre)}</b>, ${esc(USER.rol)} de <b>J+25</b>.</div>
      </div>
    </div>`;
  }

  /* ============================================================ SHELL */
  const NAV = [
    { id: "analitica", ico: "📊", lbl: "Analítica" },
    { id: "crm", ico: "🗒️", lbl: "CRM" },
    { id: "grupos", ico: "👥", lbl: "Grupos pequeños" },
    { id: "equipo", ico: "🤝", lbl: "Equipo" },
    { id: "nuevos", ico: "🌱", lbl: "Nuevos" },
    { id: "organigrama", ico: "🗂️", lbl: "Organigrama" },
    { id: "tematicas", ico: "📚", lbl: "Temáticas" },
    { id: "peticiones", ico: "🙏", lbl: "Peticiones" },
    { id: "calendario", ico: "📅", lbl: "Calendario" },
  ];

  function shell(contenidoHTML) {
    const m = DB.ministerio(MIN_ID);
    return `
    <header class="dr-topbar">
      <div class="dr-brand">
        <div class="dr-brand__logo">CR</div>
        <div class="dr-brand__txt"><b>Casa Roca</b><small>Dirección · ${esc(m ? m.nombre : "Ministerio")}</small></div>
      </div>
      <div class="dr-topbar__sp"></div>
      <div class="dr-user">
        <div class="dr-user__name">${esc(USER.nombre)}<span>${esc(USER.rol)}</span></div>
        <div class="dr-avatar" title="${esc(USER.nombre)}">${esc(USER.iniciales)}</div>
        <button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="salir">Salir</button>
      </div>
    </header>
    <div class="dr-shell">
      <nav class="dr-nav" aria-label="Secciones del ministerio">
        ${NAV.map(n => `<button class="dr-nav__item ${vista === n.id ? "is-active" : ""}" data-accion="ir" data-vista="${n.id}" ${vista === n.id ? 'aria-current="page"' : ""}>
          <span class="dr-nav__ic" aria-hidden="true">${n.ico}</span><span class="dr-nav__lbl">${n.lbl}</span></button>`).join("")}
      </nav>
      <main class="dr-main" id="main">${contenidoHTML}</main>
    </div>`;
  }

  /* ============================================================ helpers UI */
  function barChart(titulo, sub, filas, colorFn, fmt, maxOverride) {
    const max = maxOverride || Math.max(1, ...filas.map(f => f.v));
    return `<div class="dr-card">
      <h3 class="dr-card__t">${esc(titulo)}</h3>
      ${sub ? `<p class="dr-card__sub">${sub}</p>` : ""}
      <div class="dr-bars">
        ${filas.map(f => `<div class="dr-bar">
          <div class="dr-bar__lbl">${esc(f.lbl)}</div>
          <div class="dr-bar__track"><div class="dr-bar__fill" style="width:${Math.min(100, pct(f.v, max))}%;background:${(colorFn && colorFn(f)) || "var(--azul-500)"}"></div></div>
          <div class="dr-bar__val">${fmt ? fmt(f.v) : f.v}</div></div>`).join("")}
      </div>
    </div>`;
  }
  /* ----- componentes de gráfico variados (dona, columnas, embudo, línea, medidores, lollipop, apilada) ----- */
  const PALETA = ["var(--azul-600)", "var(--mostaza-500)", "var(--etapa-conecta)", "var(--etapa-crece)", "var(--azul-400)", "var(--mostaza-300)", "var(--azul-800)"];
  function _card(title, sub, body) { return `<div class="dr-card"><h3 class="dr-card__t">${esc(title)}</h3>${sub ? `<p class="dr-card__sub">${sub}</p>` : ""}${body}</div>`; }
  function _legend(items, total) {
    return `<ul class="dr-legend">${items.map(s => `<li><i style="background:${s.color}"></i><span>${esc(s.lbl)}</span><b>${s.v}</b>${total ? `<em>${pct(s.v, total)}%</em>` : ""}</li>`).join("")}</ul>`;
  }
  function donut(title, sub, segs) {
    const total = segs.reduce((s, x) => s + x.v, 0) || 1, r = 52, C = 2 * Math.PI * r; let off = 0;
    const arcs = segs.map(s => { const len = (s.v / total) * C; const el = `<circle class="dr-donut__seg" cx="60" cy="60" r="${r}" stroke="${s.color}" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"/>`; off += len; return el; }).join("");
    return _card(title, sub, `<div class="dr-donut"><div class="dr-donut__chart"><svg viewBox="0 0 120 120" role="img" aria-label="${esc(title)}"><g transform="rotate(-90 60 60)">${arcs}</g></svg><div class="dr-donut__center"><b>${total}</b><span>total</span></div></div>${_legend(segs, total)}</div>`);
  }
  function columns(title, sub, rows, colorFn) {
    const max = Math.max(1, ...rows.map(r => r.v));
    return _card(title, sub, `<div class="dr-cols">${rows.map(r => `<div class="dr-col"><span class="dr-col__v">${r.v}</span><div class="dr-col__track"><div class="dr-col__bar" style="height:${Math.max(2, pct(r.v, max))}%;background:${colorFn ? colorFn(r) : "var(--azul-500)"}"></div></div><span class="dr-col__l">${esc(r.lbl)}</span></div>`).join("")}</div>`);
  }
  function funnel(title, sub, steps) {
    const max = Math.max(1, ...steps.map(s => s.v));
    return _card(title, sub, `<div class="dr-funnel">${steps.map(s => `<div class="dr-funnel__bar" style="width:${Math.max(14, pct(s.v, max))}%;background:${s.color}"><span class="dr-funnel__lbl">${esc(s.lbl)}</span><span class="dr-funnel__v">${s.v}</span></div>`).join("")}</div>`);
  }
  function lineArea(title, sub, pts, color) {
    const W = 320, H = 130, pX = 18, pT = 20, pB = 26, n = pts.length;
    const max = Math.max(1, ...pts.map(p => p.v));
    const X = i => pX + (i * (W - 2 * pX) / Math.max(1, n - 1));
    const Y = v => (H - pB) - (v / max) * (H - pT - pB);
    const line = pts.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ");
    const area = `M${X(0).toFixed(1)},${H - pB} ` + pts.map((p, i) => `L${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ") + ` L${X(n - 1).toFixed(1)},${H - pB} Z`;
    const dots = pts.map((p, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="3.2"/>`).join("");
    const vl = pts.map((p, i) => `<text class="dr-line__v" x="${X(i).toFixed(1)}" y="${(Y(p.v) - 7).toFixed(1)}">${p.v}</text>`).join("");
    const xl = pts.map((p, i) => `<text class="dr-line__x" x="${X(i).toFixed(1)}" y="${H - 8}">${esc(p.lbl)}</text>`).join("");
    return _card(title, sub, `<svg class="dr-line" style="--lc:${color}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}"><path class="dr-line__area" d="${area}"/><path class="dr-line__path" d="${line}"/><g class="dr-line__dots">${dots}</g>${vl}${xl}</svg>`);
  }
  function gauges(title, sub, items) {
    const r = 25, C = 2 * Math.PI * r;
    const cells = items.map(it => { const v = Math.min(100, it.v), len = (v / 100) * C; return `<div class="dr-gauge"><svg viewBox="0 0 64 64"><circle class="dr-gauge__bg" cx="32" cy="32" r="${r}"/><circle class="dr-gauge__fg" cx="32" cy="32" r="${r}" stroke="${it.color}" stroke-dasharray="${len.toFixed(1)} ${(C - len).toFixed(1)}" transform="rotate(-90 32 32)"/><text class="dr-gauge__v" x="32" y="36">${it.v}%</text></svg><div class="dr-gauge__l">${esc(it.lbl)}</div></div>`; }).join("");
    return _card(title, sub, `<div class="dr-gauges">${cells}</div>`);
  }
  function lollipop(title, sub, rows, colorFn) {
    const max = Math.max(1, ...rows.map(r => r.v));
    return _card(title, sub, `<div class="dr-lollis">${rows.map(r => { const w = pct(r.v, max), c = colorFn ? colorFn(r) : "var(--azul-600)"; return `<div class="dr-lolli"><div class="dr-lolli__lbl">${esc(r.lbl)}</div><div class="dr-lolli__track"><span class="dr-lolli__line" style="width:${w}%;background:${c}"></span><span class="dr-lolli__dot" style="left:${w}%;background:${c}"></span></div><div class="dr-lolli__v">${r.v}</div></div>`; }).join("")}</div>`);
  }
  function stackedBar(title, sub, segs) {
    const total = segs.reduce((s, x) => s + x.v, 0) || 1;
    return _card(title, sub, `<div class="dr-stack">${segs.map(s => `<span style="width:${pct(s.v, total)}%;background:${s.color}" title="${esc(s.lbl)}"></span>`).join("")}</div>${_legend(segs, total)}`);
  }

  function chip(etapa) { const e = ETAPAS[etapa] || ETAPAS.conoce; return `<span class="dr-chip" style="color:${e.color};background:color-mix(in srgb, ${e.color} 12%, white)">${e.lbl}</span>`; }
  function kpi(n, lbl, k, alerta) {
    // Si recibe una clave `k`, el KPI es interactivo: abre el "porqué" (igual que en Pastor).
    const inter = !!k;
    const tag = inter ? "button" : "div";
    const attrs = inter ? ` data-accion="kpi" data-k="${k}" aria-label="Ver el porqué de: ${esc(lbl)}"` : "";
    return `<${tag} class="dr-kpi ${alerta ? "is-alerta" : ""} ${inter ? "dr-kpi--click" : ""}"${attrs}>
      <div class="dr-kpi__n">${n}</div><div class="dr-kpi__l">${esc(lbl)}</div>
      ${inter ? '<span class="dr-kpi__hint" aria-hidden="true">¿Por qué? →</span>' : ""}</${tag}>`;
  }

  /* ===== Detalle de KPI ("¿por qué este dato?") — paridad con la app de Pastor ===== */
  function kpiModal(num, lbl, porque, calculo, bodyHTML, acciones) {
    abrirModal(`
      <div class="dr-modal__head"><div class="dr-kpi-big">${num}</div>
        <div><h3 id="dr-modal-t">${esc(lbl)}</h3><p class="dr-card__sub">El porqué de este dato · ministerio J+25</p></div></div>
      <div class="dr-why"><span>¿Qué significa?</span><p>${porque}</p></div>
      <div class="dr-why"><span>Cómo se calcula</span><p>${calculo}</p></div>
      ${bodyHTML || ""}
      <div class="dr-modal__acts">${acciones || ""}<button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cerrar</button></div>
    `);
  }
  function goBtn(vistaDest, filtro, lbl) {
    return `<button class="dr-btn dr-btn--primary" data-accion="kpi-go" data-vista="${vistaDest}" data-filtro="${filtro || ""}">${esc(lbl)}</button>`;
  }
  function listaMini(arr, max) {
    const m = max || 10;
    const items = arr.slice(0, m).map(p => `<div class="dr-mini-row">
      <span class="dr-mini-avatar">${esc(iniciales(p).toUpperCase())}</span>
      <div class="dr-mini-row__main"><b>${esc(nombreCompleto(p))}</b><small>${esc(p.grupo || "Sin grupo")}</small></div>
      ${chip(p.etapa)}</div>`).join("");
    const resto = arr.length > m ? `<p class="dr-card__sub">…y ${arr.length - m} más.</p>` : "";
    return `<div class="dr-mini-list">${items}</div>${resto}`;
  }
  function kpiDetalle(k) {
    const personas = registro();
    const grupos = gruposMin();
    const total = personas.length;
    const nombreGr = g => g.af ? g.af.nombre : g.afId;
    const mesHoy = new Date().getMonth() + 1;

    switch (k) {
      case "tamano": {
        const filasEt = ["conoce", "conecta", "crece", "sirve"].map(e => ({ lbl: ETAPAS[e].lbl, v: personas.filter(p => p.etapa === e).length, color: ETAPAS[e].color }));
        const madurez = pct(personas.filter(p => p.etapa === "crece" || p.etapa === "sirve").length, total);
        return kpiModal(total, "Tamaño del ministerio",
          "Todas las personas vinculadas a J+25: las que están en algún grupo pequeño más las que sirven en el equipo, sin duplicados.",
          "Personas <b>únicas</b> deduplicadas por correo, uniendo los rosters de todos los líderes (en vivo) con el equipo de servidores. Hoy: <b>" + total + "</b>.",
          funnel("Etapas del recorrido (4C)", `${madurez}% ya está en Crece o Sirve`, filasEt),
          goBtn("crm", "todos", "Ver el CRM completo"));
      }
      case "grupos": {
        const filasGr = grupos.map(g => ({ lbl: nombreGr(g), v: g.total })).sort((a, b) => b.v - a.v);
        const sumTotal = grupos.reduce((s, g) => s + g.total, 0);
        const prom = grupos.length ? Math.round(sumTotal / grupos.length) : 0;
        return kpiModal(grupos.length, "Grupos pequeños",
          "Los grupos pequeños abiertos en el ministerio, donde las personas se conocen, se conectan y crecen en comunidad.",
          "Conteo de grupos activos de J+25. En total reúnen a <b>" + sumTotal + "</b> personas, un promedio de <b>" + prom + "</b> por grupo.",
          lollipop("Tamaño de cada grupo", `Promedio ${prom} por grupo`, filasGr, () => "var(--azul-600)"),
          goBtn("grupos", "", "Ver los grupos"));
      }
      case "lideres": {
        const cargaTally = {};
        grupos.forEach(g => { cargaTally[g.lider] = (cargaTally[g.lider] || 0) + g.total; });
        const filasCarga = Object.keys(cargaTally).map(x => ({ lbl: x, v: cargaTally[x] })).sort((a, b) => b.v - a.v);
        const n = filasCarga.length;
        return kpiModal(n, "Líderes activos",
          "Las personas que hoy lideran un grupo pequeño y acompañan de cerca a quienes lo integran.",
          "Líderes <b>distintos</b> al frente de los " + grupos.length + " grupos del ministerio. Entre todos cuidan a <b>" + Object.values(cargaTally).reduce((s, v) => s + v, 0) + "</b> personas.",
          lollipop("Carga por líder", "Personas a cargo de cada líder", filasCarga, fil => fil.v >= 16 ? "var(--mostaza-500)" : "var(--azul-600)"),
          goBtn("grupos", "", "Ver grupos y líderes"));
      }
      case "sirven": {
        const sirven = personas.filter(p => p.sirve);
        const noSirven = total - sirven.length;
        return kpiModal(sirven.length, "En servicio activo",
          "Personas que hoy sirven en J+25 o en un equipo operativo. Es la última C del recorrido: «Sirve».",
          "Personas con la bandera <b>sirve = sí</b> en el CRM (" + pct(sirven.length, total) + "% del ministerio). El resto aún está en Conoce, Conéctate o Crece.",
          donut("Sirven vs. aún no", "Proporción del ministerio en servicio", [{ lbl: "Sirven", v: sirven.length, color: "var(--etapa-sirve)" }, { lbl: "Aún no", v: noSirven, color: "var(--azul-300)" }]) + listaMini(sirven, 8),
          goBtn("equipo", "", "Ver el equipo de servidores"));
      }
      case "ocupacion": {
        const sumTotal = grupos.reduce((s, g) => s + g.total, 0);
        const sumCupo = grupos.reduce((s, g) => s + (g.cupo || 0), 0);
        const ocup = pct(sumTotal, sumCupo);
        const filasOcup = grupos.map(g => ({ lbl: nombreGr(g), v: g.cupo ? pct(g.total, g.cupo) : 0, color: (g.cupo && pct(g.total, g.cupo) >= 90) ? "var(--peligro)" : (g.cupo && pct(g.total, g.cupo) >= 70) ? "var(--mostaza-500)" : "var(--exito)" }));
        return kpiModal(ocup + "%", "Ocupación global",
          "Qué tan llenos están los grupos: cuánta de la capacidad total ya está ocupada por personas.",
          "Suma de miembros (<b>" + sumTotal + "</b>) dividida por la suma de cupos (<b>" + sumCupo + "</b>) de todos los grupos. Verde = hay espacio, amarillo/rojo = casi lleno.",
          gauges("Ocupación por grupo", `Global ${ocup}% · ${Math.max(0, sumCupo - sumTotal)} cupos libres`, filasOcup),
          goBtn("grupos", "", "Ver ocupación por grupo"));
      }
      case "cupos": {
        const sumTotal = grupos.reduce((s, g) => s + g.total, 0);
        const sumCupo = grupos.reduce((s, g) => s + (g.cupo || 0), 0);
        const libres = Math.max(0, sumCupo - sumTotal);
        const filasLibres = grupos.map(g => ({ lbl: nombreGr(g), v: Math.max(0, (g.cupo || 0) - g.total) })).sort((a, b) => b.v - a.v);
        return kpiModal(libres, "Cupos disponibles",
          "Cuántas personas más caben en los grupos hoy. Es la capacidad libre para recibir y conectar nuevos.",
          "Capacidad total (<b>" + sumCupo + "</b>) menos los miembros actuales (<b>" + sumTotal + "</b>). Dónde hay sitio para invitar a alguien.",
          columns("Cupos libres por grupo", "Espacio disponible en cada grupo", filasLibres, () => "var(--exito)"),
          goBtn("grupos", "", "Ver los grupos"));
      }
      case "nuevos": {
        const nuevos = personas.filter(p => diasDesde(p.fechaInscripcion) <= 30).sort((a, b) => diasDesde(a.fechaInscripcion) - diasDesde(b.fechaInscripcion));
        const mlabels = ["Ene", "Feb", "Mar", "Abr", "May", "Jun"];
        const filasMes = mlabels.map((lbl, i) => ({ lbl, v: personas.filter(p => p.fechaInscripcion && String(p.fechaInscripcion).slice(0, 7) === `2026-0${i + 1}`).length }));
        return kpiModal(nuevos.length, "Nuevos (últimos 30 días)",
          "Personas que llegaron por primera vez o se registraron en el último mes. Son la prioridad de bienvenida y acompañamiento.",
          "Personas cuya <b>fecha de inscripción</b> está dentro de los últimos 30 días. Vienen en vivo del landing y de los líderes.",
          lineArea("Nuevos por mes (2026)", null, filasMes, "var(--etapa-crece)") + listaMini(nuevos, 10),
          goBtn("nuevos", "", "Ver y acompañar a los nuevos"));
      }
      case "cumple": {
        const cumple = personas.filter(p => p.cumpleMes === mesHoy).sort((a, b) => (a.cumpleDia || 99) - (b.cumpleDia || 99));
        const MESL = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
        const filas = cumple.map(p => `<div class="dr-mini-row"><span class="dr-mini-avatar">${esc(iniciales(p).toUpperCase())}</span><div class="dr-mini-row__main"><b>${esc(nombreCompleto(p))}</b><small>${p.cumpleDia || "—"} de ${MESL[mesHoy - 1]}</small></div>${chip(p.etapa)}</div>`).join("");
        return kpiModal(cumple.length, "Cumpleaños este mes",
          "Quiénes cumplen años este mes. Una oportunidad para acompañar, celebrar y hacer sentir a cada persona parte de la casa.",
          "Personas cuyo <b>mes de cumpleaños</b> es " + MESL[mesHoy - 1] + ". Un detalle a tiempo dice «te conocemos y te valoramos».",
          `<div class="dr-card"><h3 class="dr-card__t">Cumpleañeros de ${MESL[mesHoy - 1]}</h3><div class="dr-mini-list">${filas || '<p class="dr-card__sub">Nadie cumple años este mes.</p>'}</div></div>`,
          goBtn("crm", "todos", "Ver el CRM completo"));
      }
    }
  }

  /* ============================================================ 1. ANALÍTICA */
  function vistaAnalitica() {
    const personas = registro();
    const grupos = gruposMin();
    const total = personas.length;
    const f = personas.filter(p => generoDe(p) === "F").length;
    const mPer = personas.filter(p => generoDe(p) === "M").length;
    const nLideres = new Set(grupos.map(g => g.liderId)).size;
    const sirven = personas.filter(p => p.sirve).length;
    const nuevos7 = personas.filter(p => diasDesde(p.fechaInscripcion) <= 7).length;
    const nuevos30 = personas.filter(p => diasDesde(p.fechaInscripcion) <= 30).length;
    const recurrentes = personas.filter(p => diasDesde(p.fechaInscripcion) > 30).length;
    const sinContactar = personas.filter(p => p.contactado === false).length;

    // ocupación
    const sumTotal = grupos.reduce((s, g) => s + g.total, 0);
    const sumCupo = grupos.reduce((s, g) => s + (g.cupo || 0), 0);
    const ocupGlobal = pct(sumTotal, sumCupo);
    const cuposLibres = Math.max(0, sumCupo - sumTotal);
    const promGrupo = grupos.length ? Math.round(sumTotal / grupos.length) : 0;

    // cumpleaños este mes
    const mesHoy = new Date().getMonth() + 1;
    const cumpleMes = personas.filter(p => p.cumpleMes === mesHoy).length;

    // edades
    const buckets = [{ lbl: "18–25", min: 0, max: 25 }, { lbl: "26–30", min: 26, max: 30 }, { lbl: "31–35", min: 31, max: 35 }, { lbl: "36+", min: 36, max: 200 }];
    const conEdad = personas.filter(p => typeof p.edad === "number");
    const edadProm = conEdad.length ? Math.round(conEdad.reduce((s, p) => s + p.edad, 0) / conEdad.length) : "—";
    const filasEdad = buckets.map(b => ({ lbl: b.lbl + " años", v: conEdad.filter(p => p.edad >= b.min && p.edad <= b.max).length }));

    // estado civil
    function ecNorm(p) { const e = (p.estadoCivil || "").toLowerCase(); if (e.includes("solter")) return "Solteros"; if (e.includes("casad")) return "Casados"; if (e.includes("unión") || e.includes("union") || e.includes("unid")) return "Unión libre"; return "Otro"; }
    const ecCats = ["Solteros", "Casados", "Unión libre", "Otro"];
    const filasEC = ecCats.map(c => ({ lbl: c, v: personas.filter(p => ecNorm(p) === c).length })).filter(x => x.v > 0);

    // etapas
    const orden = ["conoce", "conecta", "crece", "sirve"];
    const filasEt = orden.map(e => ({ lbl: ETAPAS[e].lbl, v: personas.filter(p => p.etapa === e).length, _e: e }));
    const madurez = pct(personas.filter(p => p.etapa === "crece" || p.etapa === "sirve").length, total);

    // tamaño y ocupación por grupo
    const filasGr = grupos.map(g => ({ lbl: (g.af ? g.af.nombre : g.afId), v: g.total }));
    const filasOcup = grupos.map(g => ({ lbl: (g.af ? g.af.nombre : g.afId), v: g.cupo ? pct(g.total, g.cupo) : 0 }));

    // nuevos por mes (2026)
    const mlabels = ["Ene", "Feb", "Mar", "Abr", "May", "Jun"];
    const filasMes = mlabels.map((lbl, i) => ({ lbl, v: personas.filter(p => p.fechaInscripcion && p.fechaInscripcion.slice(0, 7) === `2026-0${i + 1}`).length }));

    // modalidad de grupos
    const modCats = ["Presencial", "Virtual", "Híbrido"];
    const filasMod = modCats.map(m => ({ lbl: m, v: grupos.filter(g => g.af && g.af.modalidad === m).length })).filter(x => x.v > 0);

    // fuente (cómo llegaron)
    const fuenteTally = {};
    personas.forEach(p => { const k = p.fuente || "Otro"; fuenteTally[k] = (fuenteTally[k] || 0) + 1; });
    const filasFuente = Object.keys(fuenteTally).map(k => ({ lbl: k, v: fuenteTally[k] })).sort((a, b) => b.v - a.v).slice(0, 6);

    // formación (cursos)
    const cursosCat = [["adn", "ADN"], ["bautizo", "Bautizo"], ["madurez", "Madurez"], ["ibli", "IBLI"]];
    const filasCursos = cursosCat.map(([id, lbl]) => ({ lbl, v: personas.filter(p => (Array.isArray(p.cursos) ? p.cursos : []).includes(id)).length }));

    // carga por líder
    const cargaTally = {};
    grupos.forEach(g => { cargaTally[g.lider] = (cargaTally[g.lider] || 0) + g.total; });
    const filasCarga = Object.keys(cargaTally).map(k => ({ lbl: k, v: cargaTally[k] })).sort((a, b) => b.v - a.v);

    // cruces
    const cruceEG = orden.map(e => {
      const sub = personas.filter(p => p.etapa === e);
      return { et: ETAPAS[e].lbl, f: sub.filter(p => generoDe(p) === "F").length, m: sub.filter(p => generoDe(p) === "M").length, tot: sub.length };
    });
    const cruceAE = buckets.map(b => {
      const sub = personas.filter(p => typeof p.edad === "number" && p.edad >= b.min && p.edad <= b.max);
      return { ed: b.lbl, conoce: sub.filter(p => p.etapa === "conoce").length, conecta: sub.filter(p => p.etapa === "conecta").length, crece: sub.filter(p => p.etapa === "crece").length, sirve: sub.filter(p => p.etapa === "sirve").length, tot: sub.length };
    });

    return shell(`
      <div class="dr-head">
        <div><h1 class="dr-h1">Analítica del ministerio</h1>
        <p class="dr-lead">Una mirada de 360° para conocer, acompañar y rodear a J+25. Datos en vivo del landing, los líderes y tu equipo.</p></div>
      </div>

      <div class="dr-kpis">
        ${kpi(total, "Tamaño del ministerio", "tamano")}
        ${kpi(grupos.length, "Grupos pequeños", "grupos")}
        ${kpi(nLideres, "Líderes activos", "lideres")}
        ${kpi(sirven, "En servicio activo", "sirven")}
        ${kpi(ocupGlobal + "%", "Ocupación global", "ocupacion")}
        ${kpi(cuposLibres, "Cupos disponibles", "cupos")}
        ${kpi(nuevos30, "Nuevos (30 días)", "nuevos", nuevos30 > 0)}
        ${kpi(cumpleMes, "Cumpleaños este mes", "cumple")}
      </div>

      <div class="dr-charts">
        ${donut("Mujeres vs. hombres", `${f} mujeres (${pct(f, total)}%) · ${mPer} hombres (${pct(mPer, total)}%)`, [{ lbl: "Mujeres", v: f, color: "var(--mostaza-500)" }, { lbl: "Hombres", v: mPer, color: "var(--azul-600)" }])}
        ${columns("Edades del ministerio", `Edad promedio: ${edadProm}${edadProm === "—" ? "" : " años"}`, filasEdad, () => "var(--azul-500)")}
        ${funnel("Etapas del recorrido (4C)", `${madurez}% ya está en Crece o Sirve`, filasEt.map(r => ({ lbl: ETAPAS[r._e].lbl, v: r.v, color: ETAPAS[r._e].color })))}
        ${donut("Estado civil", "Distribución de la familia J+25", filasEC.map((r, i) => Object.assign({}, r, { color: ({ Solteros: "var(--azul-600)", Casados: "var(--mostaza-500)", "Unión libre": "var(--etapa-conecta)", Otro: "var(--azul-400)" })[r.lbl] || PALETA[i] })))}
        ${lineArea("Nuevos por mes (2026)", `${nuevos30} en los últimos 30 días · ${recurrentes} consolidados`, filasMes, "var(--etapa-crece)")}
        ${lollipop("Tamaño de cada grupo", `Promedio ${promGrupo} por grupo`, filasGr, () => "var(--azul-600)")}
        ${gauges("Ocupación por grupo", `Global ${ocupGlobal}% · ${cuposLibres} cupos libres`, filasOcup.map(r => ({ lbl: r.lbl, v: r.v, color: r.v >= 90 ? "var(--peligro)" : r.v >= 70 ? "var(--mostaza-500)" : "var(--exito)" })))}
        ${donut("Modalidad de los grupos", "Cómo se reúnen", filasMod.map((r) => Object.assign({}, r, { color: ({ Presencial: "var(--azul-600)", Virtual: "var(--etapa-conecta)", "Híbrido": "var(--mostaza-500)" })[r.lbl] || "var(--azul-400)" })))}
        ${stackedBar("Cómo llegaron", "Principales fuentes de ingreso", filasFuente.map((r, i) => Object.assign({}, r, { color: PALETA[i % PALETA.length] })))}
        ${columns("Formación (cursos)", "Cuántos han pasado por cada curso", filasCursos, () => "var(--etapa-crece)")}
        ${lollipop("Carga por líder", "Personas a cargo de cada líder", filasCarga, fil => fil.v >= 16 ? "var(--mostaza-500)" : "var(--azul-600)")}
      </div>

      <div class="dr-grid2">
        <div class="dr-card">
          <h3 class="dr-card__t">Cruce: etapa × género</h3>
          <p class="dr-card__sub">Dónde concentrar acompañamiento.</p>
          <div class="dr-tablewrap"><table class="dr-table">
            <thead><tr><th>Etapa</th><th>Mujeres</th><th>Hombres</th><th>Total</th></tr></thead>
            <tbody>${cruceEG.map(r => `<tr><td>${r.et}</td><td>${r.f}</td><td>${r.m}</td><td><b>${r.tot}</b></td></tr>`).join("")}</tbody>
          </table></div>
        </div>
        <div class="dr-card">
          <h3 class="dr-card__t">Cruce: edad × etapa</h3>
          <p class="dr-card__sub">Madurez del recorrido por rango de edad.</p>
          <div class="dr-tablewrap"><table class="dr-table">
            <thead><tr><th>Edad</th><th>Conoce</th><th>Conéct.</th><th>Crece</th><th>Sirve</th><th>Total</th></tr></thead>
            <tbody>${cruceAE.map(r => `<tr><td>${r.ed}</td><td>${r.conoce}</td><td>${r.conecta}</td><td>${r.crece}</td><td>${r.sirve}</td><td><b>${r.tot}</b></td></tr>`).join("")}</tbody>
          </table></div>
        </div>
      </div>

      <div class="dr-ia">
        <span class="dr-ia__badge">✦ Lectura IA</span>
        <p>El <b>${pct(filasEt[0].v, total)}%</b> de J+25 está en <b>Conoce</b> y solo el <b>${madurez}%</b> llegó a Crece o Sirve: ahí está tu mayor oportunidad de acompañamiento. La ocupación global es <b>${ocupGlobal}%</b> con <b>${cuposLibres}</b> cupos libres; ${cuposLibres < 15 ? "conviene abrir un grupo nuevo pronto." : "aún hay espacio para recibir."} Este mes hay <b>${cumpleMes}</b> cumpleaños y <b>${sinContactar}</b> personas sin contactar.</p>
      </div>
    `);
  }

  /* ============================================================ CRM (lista) */
  let crmSort = "nombre", crmDir = 1, crmQuery = "", crmFiltro = "todos";
  const CRM_COLS = [
    { id: "nombre", lbl: "Nombre" },
    { id: "correo", lbl: "Correo" },
    { id: "telefono", lbl: "Teléfono" },
    { id: "edad", lbl: "Edad", num: true },
    { id: "genero", lbl: "Género" },
    { id: "grupo", lbl: "Grupo" },
    { id: "etapa", lbl: "Etapa" },
    { id: "estadoCivil", lbl: "Estado civil" },
    { id: "sirve", lbl: "Sirve" },
    { id: "cumple", lbl: "Cumpleaños" },
  ];
  function crmValor(p, col) {
    switch (col) {
      case "nombre": return nombreCompleto(p).toLowerCase();
      case "edad": return p.edad || 0;
      case "genero": return generoDe(p);
      case "etapa": return p.etapa || "";
      case "sirve": return p.sirve ? 1 : 0;
      case "cumple": return (p.cumpleMes || 99) * 100 + (p.cumpleDia || 99);
      default: return String(p[col] || "").toLowerCase();
    }
  }
  function vistaCRM() {
    let personas = registro();
    if (crmFiltro === "sirve") personas = personas.filter(p => p.sirve);
    else if (crmFiltro === "nuevos") personas = personas.filter(p => diasDesde(p.fechaInscripcion) <= 30);
    else if (crmFiltro !== "todos") personas = personas.filter(p => p.etapa === crmFiltro);
    personas.sort((a, b) => { const va = crmValor(a, crmSort), vb = crmValor(b, crmSort); return (va < vb ? -1 : va > vb ? 1 : 0) * crmDir; });
    const totalReg = registro();

    const filas = personas.map(p => {
      const search = `${nombreCompleto(p)} ${p.correo} ${p.telefono} ${p.grupo} ${p.estadoCivil} ${p.sirve ? "sirve servicio" : ""}`.toLowerCase();
      const cumple = p.cumpleMes ? `${p.cumpleDia} ${MESES[p.cumpleMes - 1]}` : "—";
      return `<tr data-search="${esc(search)}">
        <td class="dr-td-name"><div class="dr-td-avatar">${esc(iniciales(p).toUpperCase())}</div><div><b>${esc(nombreCompleto(p))}</b><span>${esc(p.lider ? "Líder: " + p.lider : "")}</span></div></td>
        <td><a class="dr-td-link" href="${mailLink(p)}">${esc(p.correo || "—")}</a></td>
        <td><a class="dr-td-link" href="${waLink(p)}" target="_blank" rel="noopener">${esc(p.telefono || "—")}</a></td>
        <td class="dr-td-num">${typeof p.edad === "number" ? p.edad : "—"}</td>
        <td>${generoDe(p) === "F" ? "Mujer" : "Hombre"}</td>
        <td>${esc(p.grupo || "—")}</td>
        <td>${chip(p.etapa || "conoce")}</td>
        <td>${esc(p.estadoCivil || "—")}</td>
        <td>${p.sirve ? '<span class="dr-yes">✓ Sí</span>' : '<span class="dr-no">—</span>'}</td>
        <td>${cumple}</td>
        <td class="dr-td-acts"><a class="dr-iconbtn" href="${waLink(p)}" target="_blank" rel="noopener" title="WhatsApp">💬</a><a class="dr-iconbtn" href="${mailLink(p)}" title="Correo">✉️</a></td>
      </tr>`;
    }).join("");

    const th = CRM_COLS.map(c => `<th class="dr-th-sort ${crmSort === c.id ? "is-sort" : ""}" data-accion="crm-sort" data-col="${c.id}">${c.lbl}${crmSort === c.id ? (crmDir === 1 ? " ▲" : " ▼") : ""}</th>`).join("") + "<th></th>";

    const filtros = [["todos", "Todos"], ["sirve", "Sirven"], ["nuevos", "Nuevos 30d"], ["conoce", "Conoce"], ["conecta", "Conéctate"], ["crece", "Crece"], ["sirve_et", "Sirve (etapa)"]];

    return shell(`
      <div class="dr-head">
        <div><h1 class="dr-h1">CRM · Personas del ministerio</h1>
        <p class="dr-lead">Toda la base de J+25 en una lista: contacto directo, edad, grupo, etapa, servicio y cumpleaños. Busca, ordena y filtra.</p></div>
      </div>

      <div class="dr-crmbar">
        <input class="dr-search" id="dr-crm-search" type="search" placeholder="Buscar por nombre, correo, teléfono, grupo…" aria-label="Buscar" value="${esc(crmQuery)}">
        <div class="dr-crmcount"><b id="dr-crm-count">${personas.length}</b> de ${totalReg.length}</div>
      </div>
      <div class="dr-filtros">
        ${[["todos", "Todos (" + totalReg.length + ")"], ["sirve", "Sirven (" + totalReg.filter(p => p.sirve).length + ")"], ["nuevos", "Nuevos 30d (" + totalReg.filter(p => diasDesde(p.fechaInscripcion) <= 30).length + ")"], ["conoce", "Conoce"], ["conecta", "Conéctate"], ["crece", "Crece"], ["sirve", "—"]].slice(0, 6).map(([id, lbl]) => `<button class="dr-filtro ${crmFiltro === id ? "is-active" : ""}" data-accion="crm-filtro" data-f="${id}">${lbl}</button>`).join("")}
      </div>

      <div class="dr-tablewrap dr-crmwrap">
        <table class="dr-table dr-crmtable">
          <thead><tr>${th}</tr></thead>
          <tbody id="dr-crm-body">${filas}</tbody>
        </table>
      </div>
    `);
  }

  /* ============================================================ 2. GRUPOS */
  let grupoAbierto = null;
  function vistaGrupos() {
    if (grupoAbierto) return vistaGrupoDetalle(grupoAbierto);
    const grupos = gruposMin();
    return shell(`
      <div class="dr-head"><div><h1 class="dr-h1">Grupos pequeños</h1>
      <p class="dr-lead">Tus líderes y sus grupos. Entra a cada uno para ver a las personas, contactarlas y reasignar el líder.</p></div></div>
      <div class="dr-grupos">
        ${grupos.map(g => `
          <button class="dr-grupo" data-accion="abrir-grupo" data-af="${g.afId}">
            <div class="dr-grupo__top">
              <div class="dr-grupo__ic">${g.live ? "🟢" : "👥"}</div>
              <div class="dr-grupo__id">
                <div class="dr-grupo__nombre">${esc(g.af ? g.af.nombre : g.afId)} ${g.live ? '<span class="dr-tag dr-tag--live">en vivo</span>' : ""}</div>
                <div class="dr-grupo__lider">Líder: <b>${esc(g.lider)}</b></div>
              </div>
            </div>
            <div class="dr-grupo__meta">
              <span>📍 ${esc(g.af ? g.af.lugar : "—")}</span>
              <span>🗓️ ${esc(g.af ? (g.af.dia + " " + g.af.hora) : "—")}</span>
            </div>
            <div class="dr-grupo__foot">
              <div class="dr-grupo__count"><b>${g.total}</b> / ${g.cupo || "—"} asignados</div>
              <div class="dr-bar__track" style="flex:1;margin:0 0 0 10px"><div class="dr-bar__fill" style="width:${g.cupo ? pct(g.total, g.cupo) : 0}%;background:var(--azul-500)"></div></div>
            </div>
          </button>`).join("")}
      </div>`);
  }

  function vistaGrupoDetalle(afId) {
    const g = gruposMin().find(x => x.afId === afId);
    if (!g) { grupoAbierto = null; return vistaGrupos(); }
    const r = g.roster;
    const opciones = D.LIDERES.map(l => `<option value="${l.id}" ${l.id === g.liderId ? "selected" : ""}>${esc(l.nombre)}</option>`).join("");
    return shell(`
      <button class="dr-back" data-accion="cerrar-grupo">← Volver a grupos</button>
      <div class="dr-head">
        <div>
          <h1 class="dr-h1">${esc(g.af ? g.af.nombre : afId)} ${g.live ? '<span class="dr-tag dr-tag--live">en vivo</span>' : ""}</h1>
          <p class="dr-lead">${esc(g.af ? g.af.queHacen : "")}</p>
        </div>
      </div>

      <div class="dr-lidercard">
        <div class="dr-lidercard__info">
          <div class="dr-avatar dr-avatar--lg">${esc(iniciales({ nombres: g.lider }).toUpperCase())}</div>
          <div>
            <div class="dr-lidercard__name">${esc(g.lider)} <span class="dr-tag">Líder</span></div>
            <div class="dr-lidercard__sub">${g.total} ${g.total === 1 ? "persona asignada" : "personas asignadas"} · cupo ${g.cupo || "—"}</div>
          </div>
        </div>
        <div class="dr-lidercard__acts">
          <a class="dr-btn dr-btn--gold dr-btn--sm" href="${waLinkLider(g)}" target="_blank" rel="noopener">💬 WhatsApp líder</a>
          <label class="dr-reasignar">Reasignar a:
            <select class="dr-select" data-accion="reasignar" data-af="${afId}">${opciones}</select>
          </label>
        </div>
      </div>

      <h2 class="dr-h2">Personas del grupo <small>${r.length}</small></h2>
      ${g.live ? `<p class="dr-note">🟢 Este grupo se sincroniza en vivo con el landing y la app del líder (Daniel Garzón).</p>` : ""}
      <div class="dr-people">
        ${r.length ? r.map(personaCard).join("") : `<div class="dr-empty">Aún no hay personas asignadas a este grupo.</div>`}
      </div>
    `);
  }

  function personaCard(p) {
    const nuevo = diasDesde(p.fechaInscripcion) <= 7;
    return `<article class="dr-person">
      <div class="dr-person__top">
        <div class="dr-avatar">${esc(iniciales(p).toUpperCase())}</div>
        <div class="dr-person__id">
          <div class="dr-person__name">${esc(nombreCompleto(p))} ${nuevo ? '<span class="dr-tag dr-tag--nuevo">Nuevo</span>' : ""}</div>
          <div class="dr-person__sub">${typeof p.edad === "number" ? p.edad + " años · " : ""}${esc(p.estadoCivil || "")} · ${generoDe(p) === "F" ? "Mujer" : "Hombre"}</div>
          <div style="margin-top:6px">${chip(p.etapa || "conoce")}</div>
        </div>
      </div>
      <div class="dr-person__data">
        <div><span class="k">✉️</span> ${esc(p.correo || "—")}</div>
        <div><span class="k">📱</span> ${esc(p.telefono || "—")}</div>
        <div><span class="k">📅</span> Inscrito ${fechaCorta(p.fechaInscripcion)}</div>
        <div><span class="k">🔗</span> ${esc(p.fuente || "—")}</div>
      </div>
      <div class="dr-person__acts">
        <a class="dr-btn dr-btn--gold dr-btn--sm" href="${waLink(p)}" target="_blank" rel="noopener">💬 WhatsApp</a>
        <a class="dr-btn dr-btn--ghost dr-btn--sm" href="${mailLink(p)}">✉️ Correo</a>
      </div>
    </article>`;
  }

  /* ============================================================ 3. EQUIPO */
  function vistaEquipo() {
    const eq = DS.equipo();
    return shell(`
      <div class="dr-head"><div><h1 class="dr-h1">Equipo de servicio</h1>
      <p class="dr-lead">Quienes sirven activamente en J+25. Toca una persona para ver su perfil y escribirle directo.</p></div></div>
      <div class="dr-kpis">
        ${kpi(eq.length, "Servidores activos")}
        ${kpi(eq.filter(p => generoDe(p) === "F").length, "Mujeres")}
        ${kpi(eq.filter(p => generoDe(p) === "M").length, "Hombres")}
        ${kpi(new Set(eq.map(p => p.sirveEn)).size, "Áreas de servicio")}
      </div>
      <div class="dr-people">
        ${eq.map(p => `<article class="dr-person dr-person--click" data-accion="ver-persona" data-id="${p.id}" tabindex="0" role="button">
          <div class="dr-person__top">
            <div class="dr-avatar">${esc(iniciales(p).toUpperCase())}</div>
            <div class="dr-person__id">
              <div class="dr-person__name">${esc(nombreCompleto(p))}</div>
              <div class="dr-person__sub">${esc(p.sirveEn)}</div>
              <div style="margin-top:6px">${chip(p.etapa)}</div>
            </div>
          </div>
          <div class="dr-person__acts">
            <a class="dr-btn dr-btn--gold dr-btn--sm" href="${waLink(p)}" target="_blank" rel="noopener" data-stop>💬 WhatsApp</a>
            <span class="dr-btn dr-btn--ghost dr-btn--sm">Ver perfil →</span>
          </div>
        </article>`).join("")}
      </div>`);
  }

  function modalPersona(id) {
    const p = DS.equipo().find(x => x.id === id); if (!p) return;
    const dCumple = diasHastaCumple(p.cumpleMes, p.cumpleDia);
    const cursos = (p.cursos || []).map(c => `<span class="dr-pill">${esc(CURSO_NOMBRES[c] || c)}</span>`).join(" ") || "<span class='dr-muted'>Sin cursos registrados</span>";
    abrirModal(`
      <div class="dr-modal__head">
        <div class="dr-avatar dr-avatar--lg">${esc(iniciales(p).toUpperCase())}</div>
        <div><h3 id="dr-modal-t">${esc(nombreCompleto(p))}</h3><div class="dr-muted">${esc(p.sirveEn)} · sirve desde ${fechaCorta(p.desde)}</div></div>
      </div>
      <div class="dr-deflist">
        <div><span>Etapa</span>${chip(p.etapa)}</div>
        <div><span>Edad</span>${typeof p.edad === "number" ? p.edad + " años" : "—"}</div>
        <div><span>Estado civil</span>${esc(p.estadoCivil || "—")}</div>
        <div><span>Cumpleaños</span>${p.cumpleMes ? p.cumpleDia + " de " + MESES_L[p.cumpleMes - 1] + (dCumple !== null && dCumple <= 30 ? ` · ${dCumple === 0 ? "¡hoy! 🎂" : "en " + dCumple + " días"}` : "") : "—"}</div>
        <div><span>Correo</span>${esc(p.correo || "—")}</div>
        <div><span>Teléfono</span>${esc(p.telefono || "—")}</div>
        <div><span>Cursos</span><div>${cursos}</div></div>
      </div>
      <div class="dr-modal__acts">
        <a class="dr-btn dr-btn--gold" href="${waLink(p)}" target="_blank" rel="noopener">💬 WhatsApp</a>
        <a class="dr-btn dr-btn--ghost" href="${mailLink(p)}">✉️ Correo</a>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cerrar</button>
      </div>
    `);
  }

  /* ============================================================ 4. NUEVOS */
  function vistaNuevos() {
    const nuevos = DS.nuevos();
    const grupos = gruposMin();
    return shell(`
      <div class="dr-head"><div><h1 class="dr-h1">Nuevos por asignar</h1>
      <p class="dr-lead">Personas que se registraron y esperan un grupo pequeño o afinidad. Contáctalas y asígnalas.</p></div></div>
      <div class="dr-kpis">${kpi(nuevos.length, "En espera", nuevos.length > 0)}${kpi(nuevos.filter(p => diasDesde(p.fechaInscripcion) <= 7).length, "Esta semana")}</div>
      <div class="dr-people">
        ${nuevos.length ? nuevos.map(p => `<article class="dr-person dr-person--nuevo">
          <div class="dr-person__top">
            <div class="dr-avatar">${esc(iniciales(p).toUpperCase())}</div>
            <div class="dr-person__id">
              <div class="dr-person__name">${esc(nombreCompleto(p))} <span class="dr-tag dr-tag--nuevo">Nuevo</span></div>
              <div class="dr-person__sub">${typeof p.edad === "number" ? p.edad + " años · " : ""}${esc(p.estadoCivil || "")} · ${generoDe(p) === "F" ? "Mujer" : "Hombre"}</div>
            </div>
          </div>
          <div class="dr-person__data">
            <div><span class="k">✉️</span> ${esc(p.correo || "—")}</div>
            <div><span class="k">📱</span> ${esc(p.telefono || "—")}</div>
            <div><span class="k">📅</span> Registrado ${fechaCorta(p.fechaInscripcion)}</div>
            <div><span class="k">🔗</span> ${esc(p.fuente || "—")}</div>
          </div>
          ${p.nota ? `<div class="dr-person__nota">📝 ${esc(p.nota)}</div>` : ""}
          <div class="dr-person__acts">
            <a class="dr-btn dr-btn--gold dr-btn--sm" href="${waLink(p)}" target="_blank" rel="noopener">💬 WhatsApp</a>
            <a class="dr-btn dr-btn--ghost dr-btn--sm" href="${mailLink(p)}">✉️ Correo</a>
            <button class="dr-btn dr-btn--primary dr-btn--sm" data-accion="asignar" data-id="${p.id}">➕ Asignar a grupo</button>
          </div>
        </article>`).join("") : `<div class="dr-empty">🎉 ¡Todo asignado! No hay personas en espera.</div>`}
      </div>`);
  }

  function modalAsignar(id) {
    const p = DS.nuevos().find(x => x.id === id); if (!p) return;
    const grupos = gruposMin();
    const ops = grupos.map(g => `<option value="${g.afId}">${esc(g.af ? g.af.nombre : g.afId)} · ${esc(g.lider)} (${g.total}/${g.cupo || "—"})</option>`).join("");
    abrirModal(`
      <h3 id="dr-modal-t">Asignar a ${esc(nombreCompleto(p))}</h3>
      <p class="dr-muted">Elige el grupo pequeño donde mejor encaje. Quedará en el roster de su líder al instante.</p>
      <label class="dr-field"><span>Grupo</span><select class="dr-select" id="dr-asignar-sel">${ops}</select></label>
      <div class="dr-modal__acts">
        <button class="dr-btn dr-btn--primary" data-accion="confirmar-asignar" data-id="${p.id}">Asignar</button>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>
    `);
  }

  /* ============================================================ 5. ORGANIGRAMA */
  // Pestañas predeterminadas de cada sistema que el director reparte (base 0).
  const TABS_LIDER = [
    { ico: "🏠", lbl: "Resumen" }, { ico: "👥", lbl: "Mi grupo" }, { ico: "📚", lbl: "Temáticas" },
    { ico: "🙏", lbl: "Peticiones" }, { ico: "📊", lbl: "Análisis" }, { ico: "🔔", lbl: "Notificaciones" },
  ];
  const TABS_COORD = [
    { ico: "🏠", lbl: "Resumen" }, { ico: "👥", lbl: "Grupos" }, { ico: "🧑‍🤝‍🧑", lbl: "Líderes" },
    { ico: "📚", lbl: "Temáticas" }, { ico: "🙏", lbl: "Peticiones" }, { ico: "📊", lbl: "Análisis" },
  ];
  function tabsDeTipo(tipo) { return tipo === "coordinador" ? TABS_COORD : TABS_LIDER; }
  function labelTipo(tipo) { return tipo === "coordinador" ? "Coordinador" : "Líder"; }
  function esNodoConSistema(nodo) {
    if (!nodo) return false;
    if (nodo.tipo === "coordinador" || nodo.tipo === "lider") return true;
    return /^(Coordinador|Coordinadora|Líder|Lider)\b/.test(nodo.rol || "");
  }
  function vistaOrganigrama() {
    const nodos = DS.organigrama();
    const raices = nodos.filter(n => !n.parent);
    function render(nodo) {
      const hijos = nodos.filter(n => n.parent === nodo.id);
      const sis = nodo.sistemaId ? DS.sistemaPorNodo(nodo.id) : null;
      let chip = "";
      if (sis) {
        const ac = sis.acceso || {};
        const e = ac.estado === "activo" ? { t: "Acceso activo", c: "ps-chip--ok" }
          : ac.estado === "enviado" ? { t: "Acceso enviado", c: "ps-chip--warn" }
            : { t: "Sin repartir acceso", c: "ps-chip--off" };
        chip = `<span class="ps-orgchip ${e.c}" title="Estado del reparto del sistema">⚙️ ${esc(labelTipo(sis.tipo))} · ${e.t}</span>`;
      }
      const conSis = esNodoConSistema(nodo);
      return `<li>
        <div class="dr-org__node ${sis ? "ps-org-sis" : ""}" data-id="${nodo.id}">
          <div class="dr-org__node-main">
            <b>${esc(nodo.nombre)}</b>
            <span class="dr-org__rol">${esc(nodo.rol || "")}</span>
            ${chip}
          </div>
          <div class="dr-org__node-acts">
            ${conSis ? `<button class="dr-iconbtn ps-iconbtn--sis" data-accion="org-sistema" data-id="${nodo.id}" title="Ver / repartir sistema">⚙️</button>` : ""}
            <button class="dr-iconbtn" data-accion="org-add" data-id="${nodo.id}" title="Agregar debajo">＋</button>
            <button class="dr-iconbtn" data-accion="org-edit" data-id="${nodo.id}" title="Editar">✎</button>
            <button class="dr-iconbtn" data-accion="org-del" data-id="${nodo.id}" title="Quitar">✕</button>
          </div>
        </div>
        ${hijos.length ? `<ul>${hijos.map(render).join("")}</ul>` : ""}
      </li>`;
    }
    const conSis = DS.sistemas().filter(s => s.enOrganigrama).length;
    return shell(`
      <div class="dr-head">
        <div><h1 class="dr-h1">Organigrama</h1>
        <p class="dr-lead">Arma tu equipo y <b>reparte el sistema</b>: cada <b>coordinador</b> o <b>líder</b> que creas nace con su sistema (base en 0, pestañas predeterminadas) y recibe su <b>enlace de acceso</b>. Lo que registren queda visible para ti.</p></div>
        <button class="dr-btn dr-btn--primary" data-accion="org-add" data-id="">＋ Agregar cuadro</button>
      </div>
      <div class="ps-org-legend"><span class="ps-orgchip ps-chip--ok">⚙️ ${conSis} sistema${conSis === 1 ? "" : "s"} repartido${conSis === 1 ? "" : "s"}</span> <span class="ps-org-legend__hint">El botón ⚙️ de cada cuadro abre el sistema y reparte el acceso.</span></div>
      <div class="dr-orgwrap">
        ${raices.length ? `<ul class="dr-org">${raices.map(render).join("")}</ul>` : `<div class="dr-empty">Aún no hay nodos. Empieza agregando el director.</div>`}
      </div>
      <p class="dr-note">💡 Con “✎ Editar” también puedes mover una persona a otro responsable (cambiar de quién depende).</p>
    `);
  }

  function modalNodo(id, esEdicion) {
    const nodos = DS.organigrama();
    const nodo = esEdicion ? nodos.find(n => n.id === id) : null;
    // opciones de "depende de" (no permitir a sí mismo)
    const ops = `<option value="">— Nadie (raíz) —</option>` + nodos.filter(n => !esEdicion || n.id !== id).map(n => `<option value="${n.id}" ${nodo && nodo.parent === n.id ? "selected" : ""}>${esc(n.nombre)} (${esc(n.rol || "")})</option>`).join("");
    abrirModal(`
      <h3 id="dr-modal-t">${esEdicion ? "Editar nodo" : "Nuevo nodo"}</h3>
      ${esEdicion ? "" : `<label class="dr-field"><span>Tipo de cuadro</span>
        <select id="dr-org-tipo" class="dr-select" data-accion="org-tipo-change">
          <option value="persona">Persona / apoyo (sin sistema)</option>
          <option value="coordinador">Coordinador (crea sistema)</option>
          <option value="lider">Líder de grupo (crea sistema)</option>
        </select></label>`}
      <label class="dr-field"><span>Nombre</span><input class="dr-input" id="dr-org-nombre" value="${nodo ? esc(nodo.nombre) : ""}" placeholder="Nombre de la persona"></label>
      <label class="dr-field"><span>Rol</span><input class="dr-input" id="dr-org-rol" value="${nodo ? esc(nodo.rol || "") : ""}" placeholder="Ej. Líder · Café & Palabra"></label>
      <label class="dr-field"><span>Depende de</span><select class="dr-select" id="dr-org-parent">${esEdicion ? ops : ""}</select></label>
      ${esEdicion ? "" : `<div id="dr-org-acceso-box" class="ps-org-acceso" hidden>
        <div class="ps-org-acceso__head">📦 Reparto del sistema</div>
        <p class="ps-org-acceso__lead">Al guardar se crea su <b>sistema</b> (base en 0, con sus pestañas) y se genera un <b>enlace de acceso</b>. Con su correo o teléfono se lo repartes: entra a <b>su</b> app con el alcance de su rol.</p>
        <div class="dr-grid2">
          <label class="dr-field"><span>Correo</span><input id="dr-org-email" class="dr-input" type="email" placeholder="lider@casaroca.org" /></label>
          <label class="dr-field"><span>Teléfono (WhatsApp)</span><input id="dr-org-tel" class="dr-input" type="tel" placeholder="+57 3xx xxx xxxx" /></label>
        </div>
        <label class="ps-check"><input type="checkbox" id="dr-org-enviar" checked /> <span>Repartir el acceso al guardar</span></label>
      </div>`}
      <div class="dr-modal__acts">
        <button class="dr-btn dr-btn--primary" data-accion="${esEdicion ? "org-save-edit" : "org-save-new"}" data-id="${id || ""}" data-parent="${esEdicion ? "" : (id || "")}">Guardar</button>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>
    `);
    // si es nuevo con parent fijo, oculta el select de parent
    if (!esEdicion) { const fld = document.getElementById("dr-org-parent"); if (fld) fld.closest(".dr-field").style.display = "none"; }
  }
  // Sistema del coordinador/líder: qué se le reparte y el acceso.
  function modalSistema(nodoId) {
    const nodo = DS.organigrama().find(n => n.id === nodoId);
    if (!nodo) { toast("Cuadro no encontrado", false); return; }
    const sis = DS.sistemaPorNodo(nodoId);
    const tipo = sis ? sis.tipo : (nodo.tipo || "lider");
    const tabs = tabsDeTipo(tipo);
    const base = sis ? sis.base : { personas: 0, grupos: 0, nuevos: 0 };
    const ac = sis ? sis.acceso : null;
    const estadoTxt = !ac ? "—" : ac.estado === "activo" ? "Activo" : ac.estado === "enviado" ? "Enviado · pendiente de ingreso" : "Sin repartir";
    const tabsHTML = tabs.map(t => `<span class="ps-tabchip">${t.ico} ${esc(t.lbl)}</span>`).join("");
    const stats = tipo === "coordinador"
      ? [["Grupos", base.grupos], ["Líderes", base.personas], ["Nuevos", base.nuevos]]
      : [["Personas", base.personas], ["Grupos", base.grupos], ["Nuevos", base.nuevos]];
    const statHTML = stats.map(([l, v]) => `<div class="ps-sis-stat"><b>${v}</b><span>${l}</span></div>`).join("");
    abrirModal(`
      <h3 id="dr-modal-t">⚙️ Sistema · ${esc(nodo.nombre)}</h3>
      <p class="dr-card__sub">${esc(nodo.rol || "")} · <b>${esc(labelTipo(tipo))}</b></p>
      ${!sis ? `<div class="ps-sis-warn">Este cuadro aún no tiene sistema provisionado. Así se vería con las pestañas predeterminadas.</div>` : ""}
      <div class="ps-sis-sec"><h3>Pestañas predeterminadas</h3><div class="ps-tabchips">${tabsHTML}</div></div>
      <div class="ps-sis-sec"><h3>Base del sistema</h3><div class="ps-sis-stats">${statHTML}</div>
        <p class="ps-sis-note">Base en <b>0</b>: se llena con lo que registre. Lo que cree queda <b>visible para el director</b>.</p></div>
      <div class="ps-sis-sec"><h3>Reparto del acceso</h3>
        ${ac ? `<div class="ps-acceso-row"><span class="ps-orgchip ${ac.estado === "activo" ? "ps-chip--ok" : ac.estado === "enviado" ? "ps-chip--warn" : "ps-chip--off"}">${estadoTxt}</span></div>
        <div class="dr-grid2">
          <label class="dr-field"><span>Correo</span><input id="dr-sis-email" class="dr-input" type="email" value="${esc(ac.email || "")}" placeholder="lider@casaroca.org" /></label>
          <label class="dr-field"><span>Teléfono</span><input id="dr-sis-tel" class="dr-input" type="tel" value="${esc(ac.tel || "")}" placeholder="+57 3xx xxx xxxx" /></label>
        </div>
        <label class="dr-field"><span>Enlace de acceso</span><input class="dr-input" readonly value="${esc(ac.enlace || "")}" /></label>
        <div class="ps-acceso-acts">
          <button class="dr-btn dr-btn--primary" data-accion="acceso-enviar" data-id="${sis.id}">${ac.estado === "pendiente" ? "Repartir acceso" : "Reenviar acceso"}</button>
          <button class="dr-btn dr-btn--ghost" data-accion="acceso-copiar" data-enlace="${esc(ac.enlace || "")}">Copiar enlace</button>
        </div>
        ${ac.enviadoEl ? `<p class="ps-sis-note">Último reparto: ${esc(ac.enviadoEl)}.</p>` : ""}` : `<p class="ps-sis-note">El acceso se reparte cuando el sistema se crea desde un cuadro de coordinador o líder.</p>`}
      </div>
      <div class="dr-modal__acts">
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cerrar</button>
      </div>
    `);
  }
  // Confirmación al quitar: si tiene sistema, se conserva en segundo plano.
  function modalConfirmDel(id) {
    const nodo = DS.organigrama().find(n => n.id === id);
    if (!nodo) { toast("Cuadro no encontrado", false); return; }
    const sis = nodo.sistemaId ? DS.sistemaPorNodo(id) : null;
    const hijos = DS.organigrama().filter(n => n.parent === id).length;
    abrirModal(`
      <h3 id="dr-modal-t">Quitar del organigrama</h3>
      <p class="dr-card__sub">¿Quitar el cuadro de <b>${esc(nodo.nombre)}</b>${nodo.rol ? " · " + esc(nodo.rol) : ""}?</p>
      ${sis ? `<div class="ps-sis-warn">Solo se quita el cuadro del organigrama. El <b>sistema se conserva</b> en segundo plano con sus datos —no se borra a nadie—.</div>`
        : `<div class="ps-sis-warn">Se quita el cuadro del organigrama.${hijos ? " Sus " + hijos + " cuadro(s) hijos pasarán a colgar del superior." : ""}</div>`}
      <div class="dr-modal__acts">
        <button class="dr-btn dr-btn--danger" data-accion="org-del-confirm" data-id="${id}">Sí, quitar del organigrama</button>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>
    `);
  }

  /* ============================================================ 6. TEMÁTICAS */
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

  function vistaTematicas() {
    if (temDrill) return vistaTematicaDetalle();
    const tem = DS.tematicas();
    return shell(`
      <div class="dr-head">
        <div><h1 class="dr-h1">Temáticas y material</h1>
        <p class="dr-lead">El contenido que crea el ministerio para sus grupos. Toca una para ver el detalle y subir documentos.</p></div>
        <button class="dr-btn dr-btn--primary" data-accion="nueva-tematica">＋ Nueva temática</button>
      </div>
      <div class="dr-tematicas">
        ${tem.length ? tem.map(t => {
          const nDocs = (t.docs || []).length;
          return `<article class="dr-tem dr-tem--click" data-accion="ver-tematica" data-id="${t.id}" role="button" tabindex="0">
          <div class="dr-tem__ico">${t.ico || "📚"}</div>
          <div class="dr-tem__body">
            <div class="dr-tem__top"><b>${esc(t.titulo)}</b><span class="dr-pill">${esc(t.tipo || "Material")}</span></div>
            <p class="dr-tem__desc">${esc(t.desc || "")}</p>
            <div class="dr-tem__meta">🎯 ${esc(t.dirigidoA || "Todos")} · 📅 ${fechaCorta(t.fecha)} · 📎 ${nDocs} doc${nDocs === 1 ? "" : "s"}</div>
          </div>
          <button class="dr-iconbtn" data-accion="del-tematica" data-id="${t.id}" title="Eliminar">✕</button>
        </article>`;
        }).join("") : `<div class="dr-empty">Aún no hay temáticas. Crea la primera.</div>`}
      </div>`);
  }

  function vistaTematicaDetalle() {
    const t = DS.tematica(temDrill);
    if (!t) { temDrill = null; return vistaTematicas(); }
    const docs = t.docs || [];
    const filas = docs.map(d => `<div class="dr-card ps-doc-row">
        <span class="ps-doc-ico">${docIco(d.archivo)}</span>
        <div class="ps-doc-main"><b>${esc(d.nombre || d.archivo)}</b>
          <small>${esc(d.archivo)}${d.peso ? " · " + fmtPeso(d.peso) : ""} · subido ${fechaCorta(d.fecha)}${d.por ? " por " + esc(d.por) : ""}</small>
          ${d.nota ? `<p class="ps-doc-nota">${esc(d.nota)}</p>` : ""}</div>
        <div class="ps-doc-acts">
          <button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="ver-doc" data-id="${d.id}" data-tem="${t.id}">👁️ Ver</button>
          <button class="dr-iconbtn" data-accion="del-doc" data-id="${d.id}" data-tem="${t.id}" title="Quitar documento">✕</button>
        </div>
      </div>`).join("");
    return shell(`
      <div class="dr-detail-top"><button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="tem-volver">← Volver a temáticas</button></div>
      <div class="dr-card ps-tem-detail">
        <div class="ps-tem-detail__head">
          <div class="ps-tem-detail__ico">${t.ico || "📚"}</div>
          <div class="ps-tem-detail__title">
            <h1 class="dr-h1">${esc(t.titulo)}</h1>
            <div class="dr-tem__meta">${`<span class="dr-pill">${esc(t.tipo || "Material")}</span>`} 🎯 ${esc(t.dirigidoA || "Todos")} · 📅 ${fechaCorta(t.fecha)}</div>
          </div>
        </div>
        <p class="ps-tem-detail__desc">${esc(t.desc || "Sin descripción.")}</p>
      </div>

      <div class="dr-head"><div>
        <h2 class="dr-card__t">Documentos y material (${docs.length})</h2>
        <p class="dr-lead">Guías, presentaciones, audios o cualquier recurso de esta temática.</p>
      </div>
      <button class="dr-btn dr-btn--primary" data-accion="subir-doc" data-id="${t.id}">⬆️ Subir documento</button></div>

      <div class="ps-doc-list">${filas || '<div class="dr-empty">Aún no hay documentos. Sube el primero con “Subir documento”.</div>'}</div>
    `);
  }

  function modalSubirDoc(id) {
    const t = DS.tematica(id);
    abrirModal(`
      <h3 id="dr-modal-t">Subir documento${t ? " · " + esc(t.titulo) : ""}</h3>
      <label class="dr-field"><span>Archivo</span><input id="dr-doc-archivo" class="dr-input" type="file"></label>
      <label class="dr-field"><span>Nombre para mostrar <small>(opcional)</small></span><input id="dr-doc-nombre" class="dr-input" placeholder="Ej. Guía semana 1"></label>
      <label class="dr-field"><span>Nota <small>(opcional)</small></span><textarea id="dr-doc-nota" class="dr-input" rows="2" placeholder="Para qué sirve o cómo usarlo…"></textarea></label>
      <div class="dr-modal__acts">
        <button class="dr-btn dr-btn--primary" data-accion="guardar-doc" data-id="${id}">Subir</button>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>
    `);
  }

  function modalTematica() {
    abrirModal(`
      <h3 id="dr-modal-t">Nueva temática</h3>
      <label class="dr-field"><span>Título</span><input class="dr-input" id="dr-tem-titulo" placeholder="Ej. Identidad en Cristo"></label>
      <label class="dr-field"><span>Descripción</span><textarea class="dr-input" id="dr-tem-desc" rows="3" placeholder="¿De qué trata?"></textarea></label>
      <div class="dr-row2">
        <label class="dr-field"><span>Tipo</span><select class="dr-select" id="dr-tem-tipo"><option>Serie</option><option>Taller</option><option>Conversatorio</option><option>Devocional</option><option>Material</option></select></label>
        <label class="dr-field"><span>Dirigido a</span><select class="dr-select" id="dr-tem-dir"><option>Todos los grupos</option><option>Conoce</option><option>Conéctate</option><option>Crece</option><option>Sirve</option></select></label>
      </div>
      <label class="dr-field"><span>Ícono</span><input class="dr-input" id="dr-tem-ico" placeholder="📘" maxlength="2" value="📘"></label>
      <div class="dr-modal__acts">
        <button class="dr-btn dr-btn--primary" data-accion="guardar-tematica">Crear</button>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>
    `);
  }

  /* ============================================================ 7. PETICIONES */
  let filtroPet = "todas";
  function vistaPeticiones() {
    let pets = DS.peticiones();
    if (filtroPet !== "todas") pets = pets.filter(p => p.estado === filtroPet);
    const todas = DS.peticiones();
    const badge = { abierta: "var(--info)", orando: "var(--mostaza-600)", respondida: "var(--exito)" };
    const elbl = { abierta: "Abierta", orando: "Orando", respondida: "Respondida" };
    return shell(`
      <div class="dr-head">
        <div><h1 class="dr-h1">Peticiones de oración</h1>
        <p class="dr-lead">Lo que comparten líderes y personas del ministerio. Pronto se conectará con el espacio de Oraciones.</p></div>
        <button class="dr-btn dr-btn--primary" data-accion="nueva-peticion">＋ Nueva petición</button>
      </div>
      <div class="dr-filtros">
        ${["todas", "abierta", "orando", "respondida"].map(f => `<button class="dr-filtro ${filtroPet === f ? "is-active" : ""}" data-accion="filtro-pet" data-f="${f}">${f === "todas" ? "Todas" : elbl[f]} ${f === "todas" ? `(${todas.length})` : `(${todas.filter(p => p.estado === f).length})`}</button>`).join("")}
      </div>
      <div class="dr-peticiones">
        ${pets.length ? pets.map(p => `<article class="dr-peticion">
          <div class="dr-peticion__head">
            <div><b>${esc(p.autor)}</b> <span class="dr-tag">${p.autorTipo === "lider" ? "Líder" : p.autorTipo === "persona" ? "Persona" : "Director"}</span></div>
            <span class="dr-estado" style="color:${badge[p.estado]};background:color-mix(in srgb, ${badge[p.estado]} 12%, white)">${elbl[p.estado]}</span>
          </div>
          <p class="dr-peticion__texto">${esc(p.texto)}</p>
          <div class="dr-peticion__foot">
            <span class="dr-muted">📅 ${fechaCorta(p.fecha)}</span>
            <div class="dr-peticion__acts">
              ${p.estado !== "orando" ? `<button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="estado-pet" data-id="${p.id}" data-e="orando">🙏 Orando</button>` : ""}
              ${p.estado !== "respondida" ? `<button class="dr-btn dr-btn--ok dr-btn--sm" data-accion="estado-pet" data-id="${p.id}" data-e="respondida">✓ Respondida</button>` : ""}
            </div>
          </div>
        </article>`).join("") : `<div class="dr-empty">No hay peticiones en este filtro.</div>`}
      </div>`);
  }

  function modalPeticion() {
    abrirModal(`
      <h3 id="dr-modal-t">Nueva petición</h3>
      <label class="dr-field"><span>Autor</span><input class="dr-input" id="dr-pet-autor" placeholder="Nombre" value="${esc(USER.nombre)}"></label>
      <label class="dr-field"><span>Petición</span><textarea class="dr-input" id="dr-pet-texto" rows="3" placeholder="¿Por qué oramos?"></textarea></label>
      <div class="dr-modal__acts">
        <button class="dr-btn dr-btn--primary" data-accion="guardar-peticion">Publicar</button>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>
    `);
  }

  /* ============================================================ 8. CALENDARIO */
  let calMes = null; // {y, m}
  function vistaCalendario() {
    const hoy = new Date();
    if (!calMes) calMes = { y: hoy.getFullYear(), m: hoy.getMonth() };
    const { y, m } = calMes;
    const primero = new Date(y, m, 1);
    let startDow = (primero.getDay() + 6) % 7; // lunes=0
    const dias = new Date(y, m + 1, 0).getDate();
    const eventos = DS.eventos();
    const isoDe = d => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const hoyIso = hoy.toISOString().slice(0, 10);

    let celdas = "";
    for (let i = 0; i < startDow; i++) celdas += `<div class="dr-cal__cell is-empty"></div>`;
    for (let d = 1; d <= dias; d++) {
      const iso = isoDe(d);
      const evs = eventos.filter(e => e.fecha === iso);
      celdas += `<div class="dr-cal__cell ${iso === hoyIso ? "is-today" : ""}">
        <div class="dr-cal__day">${d}</div>
        ${evs.slice(0, 3).map(e => `<div class="dr-cal__ev ${e.mio ? "is-mio" : "is-otro"}" title="${esc(e.titulo)}">${esc(e.titulo)}</div>`).join("")}
        ${evs.length > 3 ? `<div class="dr-cal__more">+${evs.length - 3}</div>` : ""}
      </div>`;
    }

    // próximos eventos (ordenados, del mes en adelante)
    const prox = eventos.filter(e => e.fecha >= hoyIso).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.horaInicio.localeCompare(b.horaInicio)).slice(0, 8);
    const espNom = id => { const e = D.ESPACIOS.find(x => x.id === id); return e ? (e.ico + " " + e.nombre) : "—"; };
    // conflictos de espacio
    const conflictos = detectarConflictos(eventos);

    return shell(`
      <div class="dr-head">
        <div><h1 class="dr-h1">Calendario y espacios</h1>
        <p class="dr-lead">Crea eventos, reserva espacios por horas y coordina con los demás ministerios. Tu agenda alimenta el calendario general de la iglesia.</p></div>
        <button class="dr-btn dr-btn--primary" data-accion="nuevo-evento">＋ Crear evento</button>
      </div>

      <div class="dr-callegend">
        <span><i class="dot mio"></i> Mis eventos (J+25)</span>
        <span><i class="dot otro"></i> Otros ministerios</span>
      </div>

      ${conflictos.length ? `<div class="dr-alert">⚠️ ${conflictos.length} ${conflictos.length === 1 ? "choque de espacio detectado" : "choques de espacio detectados"}: ${conflictos.map(c => esc(c)).join(" · ")}</div>` : ""}

      <div class="dr-cal">
        <div class="dr-cal__bar">
          <button class="dr-iconbtn" data-accion="cal-prev" title="Mes anterior">‹</button>
          <b>${MESES_L[m][0].toUpperCase() + MESES_L[m].slice(1)} ${y}</b>
          <button class="dr-iconbtn" data-accion="cal-next" title="Mes siguiente">›</button>
        </div>
        <div class="dr-cal__dow">${DOW.map(d => `<div>${d}</div>`).join("")}</div>
        <div class="dr-cal__grid">${celdas}</div>
      </div>

      <h2 class="dr-h2">Próximos eventos</h2>
      <div class="dr-eventos">
        ${prox.length ? prox.map(e => `<article class="dr-evento ${e.mio ? "is-mio" : "is-otro"}">
          <div class="dr-evento__fecha"><b>${new Date(e.fecha + "T00:00").getDate()}</b><span>${MESES[new Date(e.fecha + "T00:00").getMonth()]}</span></div>
          <div class="dr-evento__body">
            <div class="dr-evento__top"><b>${esc(e.titulo)}</b> ${e.mio ? '<span class="dr-tag">J+25</span>' : '<span class="dr-tag dr-tag--otro">Otro ministerio</span>'}</div>
            <div class="dr-evento__meta">🕐 ${e.horaInicio}–${e.horaFin} · ${espNom(e.espacioId)}</div>
            ${e.desc ? `<div class="dr-muted">${esc(e.desc)}</div>` : ""}
          </div>
          ${e.mio ? `<button class="dr-iconbtn" data-accion="del-evento" data-id="${e.id}" title="Eliminar">✕</button>` : ""}
        </article>`).join("") : `<div class="dr-empty">No hay eventos próximos.</div>`}
      </div>
    `);
  }

  function detectarConflictos(eventos) {
    const out = [];
    for (let i = 0; i < eventos.length; i++) {
      for (let j = i + 1; j < eventos.length; j++) {
        const a = eventos[i], b = eventos[j];
        if (a.espacioId === b.espacioId && a.fecha === b.fecha && solapanH(a.horaInicio, a.horaFin, b.horaInicio, b.horaFin)) {
          const e = D.ESPACIOS.find(x => x.id === a.espacioId);
          out.push(`${a.titulo} y ${b.titulo} (${e ? e.nombre : ""}, ${fechaCorta(a.fecha)})`);
        }
      }
    }
    return out;
  }
  function aMin(h) { const [a, b] = String(h).split(":").map(Number); return a * 60 + (b || 0); }
  function solapanH(i1, f1, i2, f2) { return aMin(i1) < aMin(f2) && aMin(i2) < aMin(f1); }

  function modalEvento() {
    const hoyIso = new Date().toISOString().slice(0, 10);
    const ops = D.ESPACIOS.map(e => `<option value="${e.id}">${e.ico} ${esc(e.nombre)} (cap. ${e.capacidad})</option>`).join("");
    abrirModal(`
      <h3 id="dr-modal-t">Crear evento</h3>
      <label class="dr-field"><span>Título</span><input class="dr-input" id="dr-ev-titulo" placeholder="Ej. J+25 Connect"></label>
      <div class="dr-row2">
        <label class="dr-field"><span>Fecha</span><input class="dr-input" type="date" id="dr-ev-fecha" value="${hoyIso}"></label>
        <label class="dr-field"><span>Espacio</span><select class="dr-select" id="dr-ev-espacio">${ops}</select></label>
      </div>
      <div class="dr-row2">
        <label class="dr-field"><span>Inicio</span><input class="dr-input" type="time" id="dr-ev-inicio" value="19:00"></label>
        <label class="dr-field"><span>Fin</span><input class="dr-input" type="time" id="dr-ev-fin" value="21:00"></label>
      </div>
      <label class="dr-field"><span>Descripción</span><input class="dr-input" id="dr-ev-desc" placeholder="Opcional"></label>
      <div id="dr-ev-disp" class="dr-disp"></div>
      <div class="dr-modal__acts">
        <button class="dr-btn dr-btn--ghost" data-accion="ev-check">Ver disponibilidad</button>
        <button class="dr-btn dr-btn--primary" data-accion="guardar-evento">Reservar y crear</button>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>
    `);
  }
  function chequearDisp() {
    const fecha = val("dr-ev-fecha"), esp = val("dr-ev-espacio"), ini = val("dr-ev-inicio"), fin = val("dr-ev-fin");
    const box = document.getElementById("dr-ev-disp"); if (!box) return true;
    if (!fecha || !esp || !ini || !fin || aMin(fin) <= aMin(ini)) { box.innerHTML = `<div class="dr-disp__bad">Revisa fecha y horas (el fin debe ser después del inicio).</div>`; return false; }
    const libre = DS.espacioLibre(esp, fecha, ini, fin);
    const e = D.ESPACIOS.find(x => x.id === esp);
    box.innerHTML = libre
      ? `<div class="dr-disp__ok">✓ ${esc(e.nombre)} está libre el ${fechaCorta(fecha)} de ${ini} a ${fin}. Puedes reservarlo.</div>`
      : `<div class="dr-disp__bad">✕ ${esc(e.nombre)} ya está ocupado en ese horario. Elige otra hora o espacio.</div>`;
    return libre;
  }

  /* ============================================================ MODAL / TOAST */
  function abrirModal(html) {
    const wrap = document.getElementById("dr-modal");
    wrap.innerHTML = `<div class="dr-modalbg" id="dr-modalbg"><div class="dr-modal" role="dialog" aria-modal="true" aria-labelledby="dr-modal-t">${html}</div></div>`;
    const bg = document.getElementById("dr-modalbg");
    bg.addEventListener("click", e => { if (e.target.id === "dr-modalbg") cerrarModal(); });
    document.addEventListener("keydown", escClose);
  }
  function cerrarModal() { const w = document.getElementById("dr-modal"); if (w) w.innerHTML = ""; document.removeEventListener("keydown", escClose); }
  function escClose(e) { if (e.key === "Escape") cerrarModal(); }
  function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ""; }

  function toast(msg, ok) {
    const wrap = document.getElementById("dr-toasts");
    const el = document.createElement("div");
    el.className = "dr-toast" + (ok ? " dr-toast--ok" : "");
    el.innerHTML = `<span>${ok ? "✓" : "ℹ️"}</span><span>${esc(msg)}</span>`;
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateY(8px)"; setTimeout(() => el.remove(), 250); }, 3000);
  }

  /* ============================================================ RENDER */
  const VISTAS = {
    analitica: vistaAnalitica, crm: vistaCRM, grupos: vistaGrupos, equipo: vistaEquipo, nuevos: vistaNuevos,
    organigrama: vistaOrganigrama, tematicas: vistaTematicas, peticiones: vistaPeticiones, calendario: vistaCalendario,
  };

  function render() {
    if (!sesion) { app().innerHTML = vistaLogin(); const g = document.getElementById("dr-google"); if (g) g.addEventListener("click", entrar); return; }
    const fn = VISTAS[vista] || vistaAnalitica;
    app().innerHTML = fn();
    if (!clickBound) { document.addEventListener("click", manejar); clickBound = true; }
    if (vista === "crm") bindCRMSearch();
  }

  function bindCRMSearch() {
    const inp = document.getElementById("dr-crm-search"); if (!inp) return;
    inp.addEventListener("input", () => {
      crmQuery = inp.value.trim().toLowerCase();
      let vis = 0;
      document.querySelectorAll("#dr-crm-body tr").forEach(tr => {
        const ok = !crmQuery || (tr.dataset.search || "").includes(crmQuery);
        tr.style.display = ok ? "" : "none"; if (ok) vis++;
      });
      const c = document.getElementById("dr-crm-count"); if (c) c.textContent = vis;
    });
    // re-aplica filtro de búsqueda tras re-render (ordenar/filtrar)
    if (crmQuery && typeof Event !== "undefined") inp.dispatchEvent(new Event("input"));
  }
  function entrar() { sesion = true; render(); toast(`¡Bienvenido, ${USER.nombre.split(" ")[0]}! 👋`, true); }

  /* ============================================================ EVENTOS */
  function manejar(ev) {
    const stop = ev.target.closest("[data-stop]");
    const el = ev.target.closest("[data-accion]");
    if (!el) return;
    const a = el.dataset.accion;
    const id = el.dataset.id;

    switch (a) {
      case "salir": ev.preventDefault(); sesion = false; grupoAbierto = null; vista = "analitica"; render(); return;
      case "ir": ev.preventDefault(); vista = el.dataset.vista; grupoAbierto = null; temDrill = null; window.scrollTo(0, 0); render(); return;

      /* KPIs interactivos ("¿por qué este dato?") */
      case "kpi": ev.preventDefault(); kpiDetalle(el.dataset.k); return;
      case "kpi-go": {
        ev.preventDefault();
        const vd = el.dataset.vista, f = el.dataset.filtro;
        if (f) crmFiltro = f;
        cerrarModal(); vista = vd; grupoAbierto = null; temDrill = null; window.scrollTo(0, 0); render(); return;
      }

      /* CRM */
      case "crm-sort": { ev.preventDefault(); const col = el.dataset.col; if (crmSort === col) crmDir = -crmDir; else { crmSort = col; crmDir = 1; } render(); return; }
      case "crm-filtro": ev.preventDefault(); crmFiltro = el.dataset.f; render(); return;

      /* grupos */
      case "abrir-grupo": ev.preventDefault(); grupoAbierto = el.dataset.af; window.scrollTo(0, 0); render(); return;
      case "cerrar-grupo": ev.preventDefault(); grupoAbierto = null; render(); return;

      /* equipo */
      case "ver-persona": if (stop) return; ev.preventDefault(); modalPersona(id); return;

      /* nuevos */
      case "asignar": ev.preventDefault(); modalAsignar(id); return;
      case "confirmar-asignar": {
        ev.preventDefault();
        const sel = document.getElementById("dr-asignar-sel"); const afId = sel ? sel.value : null;
        if (afId && DS.asignarNuevo(id, afId)) { cerrarModal(); render(); const g = L.afinidad(afId); toast(`Asignado a ${g ? g.nombre : "el grupo"} ✓`, true); }
        return;
      }

      /* organigrama */
      case "org-add": ev.preventDefault(); modalNodo(id || "", false); return;
      case "org-edit": ev.preventDefault(); modalNodo(id, true); return;
      case "org-sistema": ev.preventDefault(); modalSistema(id); return;
      case "org-del": ev.preventDefault(); modalConfirmDel(id); return;
      case "org-del-confirm": ev.preventDefault(); DS.delNodo(id); cerrarModal(); render(); toast("Cuadro quitado del organigrama", false); return;
      case "org-save-new": {
        ev.preventDefault();
        const nombre = val("dr-org-nombre"); if (!nombre) { toast("Escribe un nombre", false); return; }
        const tipoEl = document.getElementById("dr-org-tipo");
        const tipo = tipoEl ? tipoEl.value : "persona";
        const esSis = tipo === "coordinador" || tipo === "lider";
        let contacto = null;
        if (esSis) {
          const cb = document.getElementById("dr-org-enviar");
          contacto = { email: val("dr-org-email"), tel: val("dr-org-tel"), enviar: !!(cb && cb.checked) };
        }
        DS.addNodo(nombre, val("dr-org-rol"), el.dataset.parent || null, tipo, contacto);
        cerrarModal(); render();
        if (esSis) {
          const repartido = contacto && contacto.enviar && (contacto.email || contacto.tel);
          toast(repartido ? "Sistema creado y acceso repartido ✓" : "Sistema creado (base en 0) ✓ — reparte el acceso desde ⚙️", true);
        } else { toast("Cuadro agregado ✓", true); }
        return;
      }
      case "acceso-enviar": {
        ev.preventDefault();
        const email = document.getElementById("dr-sis-email"); const tel = document.getElementById("dr-sis-tel");
        const c = {};
        if (email) c.email = email.value.trim();
        if (tel) c.tel = tel.value.trim();
        if (!c.email && !c.tel) { toast("Agrega un correo o teléfono para repartir el acceso", false); return; }
        DS.enviarAcceso(id, c); cerrarModal(); render(); toast("Acceso repartido ✓", true);
        return;
      }
      case "acceso-copiar": {
        ev.preventDefault();
        const enlace = el.dataset.enlace || "";
        if (navigator.clipboard && enlace) { navigator.clipboard.writeText(enlace).then(() => toast("Enlace copiado ✓", true), () => toast("Enlace: " + enlace, true)); }
        else { toast("Enlace: " + enlace, true); }
        return;
      }
      case "org-save-edit": {
        ev.preventDefault();
        const nombre = val("dr-org-nombre"); if (!nombre) { toast("Escribe un nombre", false); return; }
        const parentSel = document.getElementById("dr-org-parent");
        DS.editNodo(id, { nombre, rol: val("dr-org-rol"), parent: parentSel ? (parentSel.value || null) : undefined });
        cerrarModal(); render(); toast("Nodo actualizado ✓", true); return;
      }

      /* temáticas */
      case "nueva-tematica": ev.preventDefault(); modalTematica(); return;
      case "guardar-tematica": {
        ev.preventDefault();
        const titulo = val("dr-tem-titulo"); if (!titulo) { toast("Escribe un título", false); return; }
        DS.addTematica({ titulo, desc: val("dr-tem-desc"), tipo: val("dr-tem-tipo"), dirigidoA: val("dr-tem-dir"), ico: val("dr-tem-ico") || "📚" });
        cerrarModal(); render(); toast("Temática creada ✓", true); return;
      }
      case "del-tematica": ev.preventDefault(); DS.delTematica(id); if (temDrill === id) temDrill = null; render(); toast("Temática eliminada", false); return;
      case "ver-tematica": ev.preventDefault(); temDrill = id; window.scrollTo(0, 0); render(); return;
      case "tem-volver": ev.preventDefault(); temDrill = null; window.scrollTo(0, 0); render(); return;
      case "subir-doc": ev.preventDefault(); modalSubirDoc(id); return;
      case "guardar-doc": {
        ev.preventDefault();
        const tid = el.dataset.id;
        const fileEl = document.getElementById("dr-doc-archivo");
        const file = fileEl && fileEl.files && fileEl.files[0] ? fileEl.files[0] : null;
        if (!file) { toast("Selecciona un archivo", false); return; }
        DS.addDocTematica(tid, { archivo: file.name, peso: file.size, nombre: val("dr-doc-nombre") || file.name, nota: val("dr-doc-nota"), por: USER.nombre });
        cerrarModal(); render(); toast("Documento subido ✓", true); return;
      }
      case "del-doc": ev.preventDefault(); DS.delDocTematica(el.dataset.tem, id); render(); toast("Documento quitado", false); return;
      case "ver-doc": { ev.preventDefault(); const tt = DS.tematica(el.dataset.tem); const d = tt && (tt.docs || []).find(x => x.id === id); toast(d ? `📄 Vista previa de “${d.nombre || d.archivo}” (demo). En producción abre el archivo.` : "Documento no encontrado", true); return; }

      /* peticiones */
      case "filtro-pet": ev.preventDefault(); filtroPet = el.dataset.f; render(); return;
      case "nueva-peticion": ev.preventDefault(); modalPeticion(); return;
      case "guardar-peticion": {
        ev.preventDefault();
        const texto = val("dr-pet-texto"); if (!texto) { toast("Escribe la petición", false); return; }
        DS.addPeticion({ autor: val("dr-pet-autor") || USER.nombre, texto }); cerrarModal(); render(); toast("Petición publicada 🙏", true); return;
      }
      case "estado-pet": ev.preventDefault(); DS.setEstadoPeticion(id, el.dataset.e); render(); toast(el.dataset.e === "respondida" ? "¡Respondida! 🎉" : "Marcada: orando 🙏", true); return;

      /* calendario */
      case "cal-prev": ev.preventDefault(); calMes = { y: calMes.m === 0 ? calMes.y - 1 : calMes.y, m: (calMes.m + 11) % 12 }; render(); return;
      case "cal-next": ev.preventDefault(); calMes = { y: calMes.m === 11 ? calMes.y + 1 : calMes.y, m: (calMes.m + 1) % 12 }; render(); return;
      case "nuevo-evento": ev.preventDefault(); modalEvento(); return;
      case "ev-check": ev.preventDefault(); chequearDisp(); return;
      case "guardar-evento": {
        ev.preventDefault();
        const titulo = val("dr-ev-titulo"); if (!titulo) { toast("Escribe un título", false); return; }
        if (!chequearDisp()) { toast("Ese espacio no está libre en ese horario", false); return; }
        DS.addEvento({ titulo, fecha: val("dr-ev-fecha"), horaInicio: val("dr-ev-inicio"), horaFin: val("dr-ev-fin"), espacioId: val("dr-ev-espacio"), desc: val("dr-ev-desc") });
        cerrarModal(); render(); toast("Evento creado y espacio reservado ✓", true); return;
      }
      case "del-evento": ev.preventDefault(); DS.delEvento(id); render(); toast("Evento eliminado", false); return;

      case "cerrar-modal": ev.preventDefault(); cerrarModal(); return;
    }
  }

  /* reasignar líder se dispara por 'change' del select */
  document.addEventListener("change", e => {
    const sel = e.target.closest('[data-accion="reasignar"]');
    if (sel) {
      DS.setLiderDeGrupo(sel.dataset.af, sel.value);
      render();
      const l = D.LIDERES.find(x => x.id === sel.value);
      toast(`Líder reasignado a ${l ? l.nombre : ""} ✓`, true);
      return;
    }
    const tip = e.target.closest('[data-accion="org-tipo-change"]');
    if (tip) {
      const box = document.getElementById("dr-org-acceso-box");
      const esSis = tip.value === "coordinador" || tip.value === "lider";
      if (box) box.hidden = !esSis;
      const rol = document.getElementById("dr-org-rol");
      if (rol && esSis && !rol.value) rol.placeholder = tip.value === "coordinador" ? "Ej. Coordinador · Zona Norte" : "Ej. Líder · Café & Palabra";
      return;
    }
  });

  /* sincronización en vivo: STORE (landing/líder) y DSTORE */
  if (S && S.onCambio) S.onCambio(() => { if (sesion) render(); });
  if (DS && DS.onCambio) DS.onCambio(() => { if (sesion) render(); });

  /* init */
  document.addEventListener("DOMContentLoaded", render);
  if (document.readyState !== "loading") render();
})();
