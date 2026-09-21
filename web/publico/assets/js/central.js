/* ============================================================
   CASA ROCA · APP DEL PASTOR CENTRAL ADMINISTRATIVO (Capa 4)
   La cúspide del sistema: Dirección General de toda la red (36
   iglesias) + los 8 equipos del back-office corporativo.

   Lee window.CENTRAL (agregados de la red, CRM master, equipos) y
   window.CSTORE (organigrama corporativo, agenda empresarial,
   requerimientos, peticiones internas y aprobaciones — editable).

   Patrón idéntico al resto del prototipo: vistas = funciones que
   devuelven HTML; navegación por estado; acciones por data-accion;
   reutiliza las clases dr-/ps- (director.css + pastor.css) y añade
   cn-* (central.css). Mobile-first, español, accesible.
   ============================================================ */
(function () {
  "use strict";
  const C = window.CENTRAL;
  const CS = window.CSTORE;
  if (!C || !CS) { console.error("Falta central-data.js"); return; }
  // Stores en vivo de la operación de la sede madre (pueden no estar cargados).
  const SS = window.STORE || null;     // inscritos del landing (Café & Palabra)
  const RK = window.RKSTORE || null;   // check-ins de RocaKids
  const PS = window.PSTORE || null;    // requerimientos del pastor de sede

  /* Requerimientos del pastor de la sede madre, mapeados al formato del
     service desk central. Así la mesa maestra recibe en vivo lo que el
     pastor de Bogotá envía, y las respuestas vuelven a su app (write-back). */
  function pastorReqs() {
    if (!PS || !PS.requerimientos) return [];
    try {
      return PS.requerimientos().map(r => Object.assign({}, r, {
        sede: "sede_0", sedeNombre: "Bogotá Chicó",
        requiereAprobacion: r.prioridad === "Alta" && r.estado !== "Resuelto",
        montoAsociado: r.montoAsociado || 0, _pastor: true, _pid: r.id,
      }));
    } catch (e) { return []; }
  }
  function allReqs() { return pastorReqs().concat(CS.requerimientos()); }
  function reqAplicarEstado(id, estado) {
    const r = allReqs().find(x => x.id === id);
    if (r && r._pastor && PS) PS.setEstadoRequerimiento(r._pid, estado);
    else CS.reqEstado(id, estado);
  }

  /* ============================================================ helpers */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pct = (n, d) => d ? Math.round((n / d) * 100) : 0;
  const miles = n => Math.round(n || 0).toLocaleString("es-CO");
  function mCOP(n) { const x = Math.round((n || 0) * 10) / 10; return "$" + x.toLocaleString("es-CO") + " M"; }
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const MESES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  function fechaCorta(iso) { if (!iso) return "—"; const d = new Date(iso); if (isNaN(d)) return esc(iso); return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`; }
  function nombre(p) { return `${p.nombres || ""} ${p.apellidos || ""}`.trim(); }
  function soloDigitos(t) { return String(t || "").replace(/\D/g, ""); }

  const USER = C.USER;
  const ETAPAS = {
    conoce: { lbl: "Conoce", color: "var(--etapa-conoce)" },
    conecta: { lbl: "Conéctate", color: "var(--etapa-conecta)" },
    crece: { lbl: "Crece", color: "var(--etapa-crece)" },
    sirve: { lbl: "Sirve", color: "var(--etapa-sirve)" },
  };
  const PALETA = ["var(--azul-600)", "var(--mostaza-500)", "var(--etapa-conecta)", "var(--etapa-crece)", "var(--azul-400)", "var(--mostaza-300)", "var(--azul-800)", "var(--etapa-sirve)", "var(--azul-300)", "var(--mostaza-600)"];

  /* --- estado de la app --- */
  let sesion = false;
  let vista = "tablero";
  let crmSort = "nombre", crmDir = 1, crmFiltro = "todos", crmSede = "todas", crmBusca = "";
  let finSede = null;
  let calMes = { y: 2026, m: 5 };
  let orgSedeDrill = null;
  let teamSub = {}; // por equipo: subpestaña
  let reqEq = "todos", reqEstado = "todos", reqSede = "todas";
  let tableroDrill = null;

  /* ============================================================ charts (reutiliza estilos dr-) */
  function card(t, sub, body) { return `<div class="dr-card"><h3 class="dr-card__t">${esc(t)}</h3>${sub ? `<p class="dr-card__sub">${sub}</p>` : ""}${body}</div>`; }
  function legend(items, total) { return `<ul class="dr-legend">${items.map(s => `<li><i style="background:${s.color}"></i><span>${esc(s.lbl)}</span><b>${miles(s.v)}</b>${total ? `<em>${pct(s.v, total)}%</em>` : ""}</li>`).join("")}</ul>`; }
  function kpi(n, lbl, k, alerta) {
    const inter = !!k, tag = inter ? "button" : "div";
    const attrs = inter ? ` data-accion="kpi" data-k="${k}"` : "";
    return `<${tag} class="dr-kpi ${alerta ? "is-alerta" : ""} ${inter ? "ps-kpi--click" : ""}"${attrs}>
      <div class="dr-kpi__n">${n}</div><div class="dr-kpi__l">${esc(lbl)}</div>
      ${inter ? '<span class="ps-kpi__hint" aria-hidden="true">Ver detalle →</span>' : ""}</${tag}>`;
  }
  function pill(txt, cls) { return `<span class="ps-pill ${cls || ""}">${esc(txt)}</span>`; }
  function chip(etapa) { const e = ETAPAS[etapa] || ETAPAS.conoce; return `<span class="dr-chip" style="color:${e.color};background:color-mix(in srgb, ${e.color} 12%, white)">${e.lbl}</span>`; }
  function barChart(t, sub, filas, colorFn, fmt, maxO) {
    const max = maxO || Math.max(1, ...filas.map(f => f.v));
    return `<div class="dr-card"><h3 class="dr-card__t">${esc(t)}</h3>${sub ? `<p class="dr-card__sub">${sub}</p>` : ""}
      <div class="dr-bars">${filas.map(f => `<div class="dr-bar"><div class="dr-bar__lbl">${esc(f.lbl)}</div>
        <div class="dr-bar__track"><div class="dr-bar__fill" style="width:${Math.min(100, pct(f.v, max))}%;background:${(colorFn && colorFn(f)) || "var(--azul-500)"}"></div></div>
        <div class="dr-bar__val">${fmt ? fmt(f.v) : miles(f.v)}</div></div>`).join("")}</div></div>`;
  }
  function donut(t, sub, segs) {
    const total = segs.reduce((s, x) => s + x.v, 0) || 1, r = 52, Cc = 2 * Math.PI * r; let off = 0;
    const arcs = segs.map(s => { const len = (s.v / total) * Cc; const el = `<circle class="dr-donut__seg" cx="60" cy="60" r="${r}" stroke="${s.color}" stroke-dasharray="${len.toFixed(2)} ${(Cc - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"/>`; off += len; return el; }).join("");
    return card(t, sub, `<div class="dr-donut"><div class="dr-donut__chart"><svg viewBox="0 0 120 120" role="img" aria-label="${esc(t)}"><g transform="rotate(-90 60 60)">${arcs}</g></svg><div class="dr-donut__center"><b>${miles(total)}</b><span>total</span></div></div>${legend(segs, total)}</div>`);
  }
  function columns(t, sub, rows, colorFn, fmt) {
    const max = Math.max(1, ...rows.map(r => r.v));
    return card(t, sub, `<div class="dr-cols">${rows.map(r => `<div class="dr-col"><span class="dr-col__v">${fmt ? fmt(r.v) : miles(r.v)}</span><div class="dr-col__track"><div class="dr-col__bar" style="height:${Math.max(2, pct(r.v, max))}%;background:${colorFn ? colorFn(r) : "var(--azul-500)"}"></div></div><span class="dr-col__l">${esc(r.lbl)}</span></div>`).join("")}</div>`);
  }
  function lineArea(t, sub, pts, color, fmt) {
    const W = 340, H = 140, pX = 26, pT = 22, pB = 26, n = pts.length;
    const max = Math.max(1, ...pts.map(p => p.v));
    const X = i => pX + (i * (W - 2 * pX) / Math.max(1, n - 1));
    const Y = v => (H - pB) - (v / max) * (H - pT - pB);
    const line = pts.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ");
    const area = `M${X(0).toFixed(1)},${H - pB} ` + pts.map((p, i) => `L${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ") + ` L${X(n - 1).toFixed(1)},${H - pB} Z`;
    const dots = pts.map((p, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="3"/>`).join("");
    const vl = pts.map((p, i) => `<text class="dr-line__v" x="${X(i).toFixed(1)}" y="${(Y(p.v) - 7).toFixed(1)}">${fmt ? fmt(p.v) : miles(p.v)}</text>`).join("");
    const xl = pts.map((p, i) => `<text class="dr-line__x" x="${X(i).toFixed(1)}" y="${H - 8}">${esc(p.lbl)}</text>`).join("");
    return card(t, sub, `<svg class="dr-line" style="--lc:${color}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t)}"><path class="dr-line__area" d="${area}"/><path class="dr-line__path" d="${line}"/><g class="dr-line__dots">${dots}</g>${vl}${xl}</svg>`);
  }
  function dualLine(t, sub, a, b, ca, cb, la, lb) {
    const W = 340, H = 178, pX = 30, pT = 24, pB = 34, n = a.length;
    const lab = p => p.lbl != null ? p.lbl : (p.f != null ? p.f : "");
    const kf = v => Math.abs(v) >= 1000 ? (Math.round(v / 100) / 10).toFixed(1).replace(/\.0$/, "") + "k" : String(Math.round(v));
    // escala al rango real de los datos (con holgura) para que se vean las subidas/bajadas
    const vals = [...a, ...b].map(p => p.v);
    const hi = Math.max(...vals), lo = Math.min(...vals);
    const pad = (hi - lo) * 0.18 || Math.max(1, hi * 0.1);
    const top = hi + pad, bot = Math.max(0, lo - pad);
    const X = i => pX + (i * (W - 2 * pX) / Math.max(1, n - 1));
    const Y = v => (H - pB) - ((v - bot) / Math.max(1, top - bot)) * (H - pT - pB);
    const path = arr => arr.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ");
    const dots = (arr, c) => arr.map((p, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="2.8" fill="${c}"/>`).join("");
    // valores sobre cada punto (serie alta arriba, baja abajo, para no encimarse)
    const aArriba = ((a[a.length - 1] || {}).v || 0) >= ((b[b.length - 1] || {}).v || 0);
    const vlabel = (arr, c, arriba) => arr.map((p, i) => `<text x="${X(i).toFixed(1)}" y="${(Y(p.v) + (arriba ? -6 : 12)).toFixed(1)}" fill="${c}" font-size="8" font-weight="700" text-anchor="middle">${kf(p.v)}</text>`).join("");
    const xl = a.map((p, i) => `<text class="dr-line__x" x="${X(i).toFixed(1)}" y="${H - 10}">${esc(lab(p))}</text>`).join("");
    // línea guía suave a media altura
    const gy = pT + 0.5 * (H - pT - pB);
    const grid = `<line x1="${pX}" y1="${gy.toFixed(1)}" x2="${W - pX}" y2="${gy.toFixed(1)}" stroke="var(--linea, #e5e7eb)" stroke-width="1" stroke-dasharray="3 3"/>`;
    // transición primer → último domingo
    const delta = (arr) => { if (!arr || !arr.length) return `<b>0%</b>`; const f = arr[0].v, u = arr[arr.length - 1].v, d = f ? Math.round((u - f) / f * 100) : 0; return d > 0 ? `<b style="color:var(--etapa-crece)">▲ +${d}%</b>` : d < 0 ? `<b style="color:var(--peligro)">▼ ${d}%</b>` : `<b>0%</b>`; };
    return card(t, sub, `<svg class="dr-line" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t)}">
      ${grid}
      <path d="${path(a)}" fill="none" stroke="${ca}" stroke-width="2.5"/>${dots(a, ca)}${vlabel(a, ca, aArriba)}
      <path d="${path(b)}" fill="none" stroke="${cb}" stroke-width="2.5"/>${dots(b, cb)}${vlabel(b, cb, !aArriba)}${xl}</svg>
      <div class="cn-leg2"><span><i style="background:${ca}"></i>${esc(la)} · ${delta(a)}</span><span><i style="background:${cb}"></i>${esc(lb)} · ${delta(b)}</span></div>`);
  }
  function gauges(t, sub, items) {
    const r = 25, Cc = 2 * Math.PI * r;
    const cells = items.map(it => { const v = Math.min(100, it.v), len = (v / 100) * Cc; return `<div class="dr-gauge"><svg viewBox="0 0 64 64"><circle class="dr-gauge__bg" cx="32" cy="32" r="${r}"/><circle class="dr-gauge__fg" cx="32" cy="32" r="${r}" stroke="${it.color}" stroke-dasharray="${len.toFixed(1)} ${(Cc - len).toFixed(1)}" transform="rotate(-90 32 32)"/><text class="dr-gauge__v" x="32" y="36">${it.v}%</text></svg><div class="dr-gauge__l">${esc(it.lbl)}</div></div>`; }).join("");
    return card(t, sub, `<div class="dr-gauges">${cells}</div>`);
  }
  function lollipop(t, sub, rows, colorFn, fmt) {
    const max = Math.max(1, ...rows.map(r => r.v));
    return card(t, sub, `<div class="dr-lollis">${rows.map(r => { const w = pct(r.v, max), c = colorFn ? colorFn(r) : "var(--azul-600)"; return `<div class="dr-lolli"><div class="dr-lolli__lbl">${esc(r.lbl)}</div><div class="dr-lolli__track"><span class="dr-lolli__line" style="width:${w}%;background:${c}"></span><span class="dr-lolli__dot" style="left:${w}%;background:${c}"></span></div><div class="dr-lolli__v">${fmt ? fmt(r.v) : miles(r.v)}</div></div>`; }).join("")}</div>`);
  }

  /* ============================================================ LOGIN */
  function vistaLogin() {
    return `
    <div class="dr-login">
      <div class="dr-login__card">
        <div class="dr-login__logo">CR</div>
        <h1>Dirección General</h1>
        <p>El control de toda la casa. Aquí se suma la información de las 36 iglesias y se dirige el back-office corporativo: contabilidad, tesorería, RRHH, legal, comunicaciones, construcción e instituto.</p>
        <button class="dr-google" id="cn-google">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Continuar con Google
        </button>
        <div class="dr-login__nota">🔒 Demo Fase 0 — entrarás como <b>${esc(USER.nombre)}</b>, ${esc(USER.rol)}.</div>
      </div>
    </div>`;
  }

  /* ============================================================ SHELL */
  const NAV = [
    { id: "tablero", ico: "🌐", lbl: "Tablero central" },
    { id: "crm", ico: "🗒️", lbl: "CRM total" },
    { id: "finanzas", ico: "💰", lbl: "Finanzas" },
    { id: "organigrama", ico: "🗂️", lbl: "Organigrama" },
    { id: "calendario", ico: "📅", lbl: "Calendario" },
    { id: "equipo", ico: "🤝", lbl: "Equipo" },
    { id: "sep1", sep: "Equipos corporativos" },
    { id: "contabilidad", ico: "📒", lbl: "Contabilidad" },
    { id: "tesoreria", ico: "💵", lbl: "Tesorería" },
    { id: "rrhh", ico: "👥", lbl: "Talento Humano" },
    { id: "legal", ico: "⚖️", lbl: "Legal" },
    { id: "instituto", ico: "🎓", lbl: "IBLI · FACTER" },
    { id: "comunicaciones", ico: "📣", lbl: "Comunicaciones" },
    { id: "construccion", ico: "🏗️", lbl: "Construcción" },
    { id: "sep2", sep: "Operación" },
    { id: "peticiones", ico: "🙏", lbl: "Peticiones internas" },
    { id: "requerimientos", ico: "🎫", lbl: "Requerimientos" },
    { id: "directorio", ico: "📇", lbl: "Directorio" },
  ];
  function shell(html) {
    return `
    <header class="dr-topbar">
      <div class="dr-brand"><div class="dr-brand__logo">CR</div><div class="dr-brand__txt"><b>Casa Roca</b><small>Dirección General · Red nacional</small></div></div>
      <div class="dr-topbar__sp"></div>
      <div class="cn-badge">🌐 36 iglesias</div>
      <div class="dr-user"><div class="dr-user__name">${esc(USER.nombre)}<span>${esc(USER.rol)}</span></div>
        <div class="dr-avatar" title="${esc(USER.nombre)}">${esc(USER.iniciales)}</div>
        <button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="salir">Salir</button></div>
    </header>
    <div class="dr-shell">
      <nav class="dr-nav" aria-label="Secciones de la dirección general">
        ${NAV.map(n => n.sep ? `<div class="cn-nav-sep">${esc(n.sep)}</div>` :
        `<button class="dr-nav__item ${vista === n.id ? "is-active" : ""}" data-accion="ir" data-vista="${n.id}" ${vista === n.id ? 'aria-current="page"' : ""}>
          <span class="dr-nav__ic" aria-hidden="true">${n.ico}</span><span class="dr-nav__lbl">${n.lbl}</span></button>`).join("")}
      </nav>
      <main class="dr-main" id="main">${html}</main>
    </div>`;
  }
  function head(titulo, sub) { return `<div class="dr-head"><div><h1 class="dr-h1">${esc(titulo)}</h1><p class="dr-lead">${sub}</p></div></div>`; }

  /* ============================================================ 1. TABLERO CENTRAL */
  function vistaTablero() {
    const R = C.red();
    const cong = R.personas;
    const generoSegs = [{ lbl: "Mujeres", v: R.mujeres, color: "var(--etapa-conecta)" }, { lbl: "Hombres", v: R.hombres, color: "var(--azul-600)" }];
    const ecSegs = C.EC.map((e, i) => ({ lbl: e, v: R.ec[e], color: PALETA[i % PALETA.length] })).filter(x => x.v > 0);
    // top sedes por tamaño
    const topSedes = C.SEDES.slice().sort((a, b) => b.asistentes - a.asistentes).slice(0, 8).map(s => ({ lbl: s.nombreCorto, v: s.asistentes, _id: s.id }));
    // formación
    const formRows = [
      { lbl: "ADN", v: R.adn, color: "var(--azul-500)" },
      { lbl: "Bautizados", v: R.bautizados, color: "var(--etapa-crece)" },
      { lbl: "Cursos cortos (mes)", v: R.cursosMes, color: "var(--mostaza-500)" },
      { lbl: "IBLI (instituto)", v: R.instIbli, color: "var(--azul-700)" },
      { lbl: "FACTER (instituto)", v: R.instFacter, color: "var(--etapa-conecta)" },
    ];
    return shell(`
      ${head("Tablero central de la red", `Suma en vivo de las <b>${R.sedes} iglesias</b>. Toca cualquier indicador para ver de dónde sale el dato.`)}
      ${liveBanner(R)}
      <section class="dr-kpis cn-kpis">
        ${kpi(miles(R.personas), "Personas en la red", "personas")}
        ${kpi(miles(R.asistentes), "Asistentes / domingo", "asistentes")}
        ${kpi(miles(R.ninos), "Niños RocaKids", "ninos")}
        ${kpi(miles(R.grupos), "Grupos pequeños", "grupos")}
        ${kpi(miles(R.nuevosMes), "Nuevos este mes", "nuevos")}
        ${kpi(mCOP(R.diezmoDomUlt), "Diezmos último domingo", "diezmodom")}
      </section>
      ${tableroDrill ? tableroDetalle(tableroDrill, R) : ""}
      <div class="dr-grid2">
        ${dualLine("Asistencia de la red por domingo", "Adultos vs. niños, suma de las 36 iglesias (últimos 8 domingos).", R.asistDom, R.kidsDom, "var(--azul-600)", "var(--mostaza-500)", "Adultos", "Niños (RocaKids)")}
        ${donut("Hombres vs. mujeres", `Base total: ${miles(cong)} personas.`, generoSegs)}
      </div>
      <div class="dr-grid2">
        ${donut("Estado civil de la red", "Distribución consolidada.", ecSegs)}
        ${barChart("Formación y discipulado", "Personas que han pasado por cada etapa formativa.", formRows, f => f.color)}
      </div>
      <div class="dr-grid2">
        ${barChart("Top 8 sedes por tamaño", "Asistencia dominical. Toca una sede para abrir su ficha.", topSedes, () => "var(--azul-500)", null)}
        ${lineArea("Diezmos del último domingo", `Total red: ${mCOP(R.diezmoDomUlt)} · recurrencia promedio ${R.recurrenciaProm}%.`, sedesDiezmoDom(), "var(--etapa-crece)", mCOP)}
      </div>
      ${cardSedesGrid()}
    `);
  }
  function liveBanner(R) {
    const lv = (R && R._live) || (C.live ? C.live() : {});
    if (!lv || !lv.conectado) return "";
    return `<div class="cn-detalle" style="border-left:4px solid var(--exito,#1E8A55)">
      <h3>🟢 Conexión en vivo · sede madre (Bogotá Chicó)</h3>
      <p>Lo que ocurre ahora en la operación llega a la Dirección General sin recargar:
      <b>${miles(lv.inscritosCafe || 0)}</b> inscritos en Café & Palabra (J+25) ·
      <b>${miles(lv.kidsHoy || 0)}</b> check-ins de RocaKids del último domingo ·
      <b>${miles(lv.reqPastorAbiertos || 0)}</b> requerimientos abiertos del pastor de sede.</p>
    </div>`;
  }
  function sedesDiezmoDom() { return C.SEDES.slice().sort((a, b) => b.idx - a.idx).slice(0, 8).reverse().map(s => ({ lbl: s.nombreCorto, v: s.diezmoDom })); }
  function tableroDetalle(k, R) {
    const map = {
      personas: ["Personas en la red", `Suma de las bases de datos de las 36 sedes: <b>${miles(R.personas)}</b> personas. Mujeres ${miles(R.mujeres)} (${pct(R.mujeres, R.personas)}%), hombres ${miles(R.hombres)} (${pct(R.hombres, R.personas)}%).`],
      asistentes: ["Asistentes por domingo", `Promedio dominical sumado: <b>${miles(R.asistentes)}</b>. La sede madre aporta ${miles(C.sede("sede_0").asistentes)}.`],
      ninos: ["Niños RocaKids", `<b>${miles(R.ninos)}</b> niños en la red. Se reportan por servicio en cada ciudad desde el check-in del domingo.`],
      grupos: ["Grupos pequeños", `<b>${miles(R.grupos)}</b> grupos pequeños activos sumando las 36 iglesias.`],
      nuevos: ["Nuevos este mes", `<b>${miles(R.nuevosMes)}</b> personas nuevas registradas este mes en toda la red.`],
      diezmodom: ["Diezmos del último domingo", `<b>${mCOP(R.diezmoDomUlt)}</b> recaudados el domingo pasado. En el mes: ${mCOP(R.diezmoMes)}. Recurrencia promedio: ${R.recurrenciaProm}% de diezmadores constantes.`],
    };
    const d = map[k]; if (!d) return "";
    return `<div class="cn-detalle"><button class="cn-detalle__x" data-accion="kpi-cerrar" aria-label="Cerrar">✕</button><h3>${esc(d[0])}</h3><p>${d[1]}</p></div>`;
  }
  function cardSedesGrid() {
    const filas = C.SEDES.map(s => `
      <button class="cn-sede" data-accion="ver-sede" data-sede="${s.id}">
        <div class="cn-sede__top"><b>${esc(s.nombreCorto)}</b>${s.esMadre ? '<span class="cn-tag cn-tag--madre">madre</span>' : `<span class="cn-tag cn-tag--${s.estado === "Requiere atención" ? "warn" : "ok"}">${esc(s.estado)}</span>`}</div>
        <small>${esc(s.ciudad)} · ${esc(s.pais)}</small>
        <div class="cn-sede__stats"><span>👥 ${miles(s.asistentes)}</span><span>🧒 ${miles(s.ninos)}</span><span>👨‍👩‍👧 ${miles(s.grupos)}</span><span>💰 ${mCOP(s.diezmoMes)}</span></div>
      </button>`).join("");
    return `<div class="dr-card"><h3 class="dr-card__t">Las 36 iglesias</h3><p class="dr-card__sub">Toca una sede para ver su ficha consolidada.</p><div class="cn-sedes-grid">${filas}</div></div>`;
  }

  /* ============================================================ 2. CRM TOTAL */
  const CRM_COLS = [
    { id: "nombre", lbl: "Persona" }, { id: "cedula", lbl: "ID" }, { id: "sede", lbl: "Sede" }, { id: "ministerio", lbl: "Ministerio" },
    { id: "etapa", lbl: "Etapa" }, { id: "estadoCivil", lbl: "Estado civil" }, { id: "diezmo", lbl: "Diezmo" },
  ];
  function crmFiltrado() {
    let reg = C.crmMaster().slice();
    if (crmSede !== "todas") reg = reg.filter(p => p.sede === crmSede);
    if (crmFiltro === "diezma") reg = reg.filter(p => p.diezma);
    else if (crmFiltro === "recurrente") reg = reg.filter(p => p.recurrente);
    else if (crmFiltro === "sirve") reg = reg.filter(p => p.sirve);
    else if (crmFiltro === "instituto") reg = reg.filter(p => p.instituto);
    else if (crmFiltro === "nuevos") reg = reg.filter(p => ["2026-05-21", "2026-06-09"].includes(p.fechaInscripcion));
    else if (["conoce", "conecta", "crece", "sirve4"].includes(crmFiltro)) reg = reg.filter(p => p.etapa === (crmFiltro === "sirve4" ? "sirve" : crmFiltro));
    if (crmBusca) { const q = crmBusca.toLowerCase(); reg = reg.filter(p => nombre(p).toLowerCase().includes(q) || (p.email || "").toLowerCase().includes(q) || (p.ciudad || "").toLowerCase().includes(q) || window.CEDULA(p).includes(q) || window.CEDULA(p, { raw: true }).includes(q)); }
    reg.sort((a, b) => {
      let va, vb;
      switch (crmSort) {
        case "cedula": va = window.CEDULA(a, { raw: true }); vb = window.CEDULA(b, { raw: true }); break;
        case "sede": va = a.sedeNombre; vb = b.sedeNombre; break;
        case "ministerio": va = a.ministerio; vb = b.ministerio; break;
        case "etapa": va = a.etapa; vb = b.etapa; break;
        case "estadoCivil": va = a.estadoCivil; vb = b.estadoCivil; break;
        case "diezmo": va = a.diezmoMensual || 0; vb = b.diezmoMensual || 0; break;
        default: va = nombre(a).toLowerCase(); vb = nombre(b).toLowerCase();
      }
      return va < vb ? -crmDir : va > vb ? crmDir : 0;
    });
    return reg;
  }
  function vistaCRM() {
    const reg = crmFiltrado();
    const total = C.crmMaster().length;
    const sedeOpts = `<option value="todas">Todas las sedes (${total})</option>` + C.SEDES.map(s => `<option value="${s.id}" ${crmSede === s.id ? "selected" : ""}>${esc(s.nombreCorto)} · ${esc(s.ciudad)}</option>`).join("");
    const filtros = [["todos", "Todos"], ["nuevos", "Nuevos"], ["conoce", "Conoce"], ["conecta", "Conéctate"], ["crece", "Crece"], ["sirve4", "Sirve"], ["diezma", "Diezman"], ["recurrente", "Diezmo recurrente"], ["instituto", "En el instituto"]];
    const th = CRM_COLS.map(c => `<th class="dr-th-sort ${crmSort === c.id ? "is-sort" : ""}" data-accion="crm-sort" data-col="${c.id}">${c.lbl}${crmSort === c.id ? (crmDir === 1 ? " ▲" : " ▼") : ""}</th>`).join("") + "<th></th>";
    const filas = reg.slice(0, 300).map(p => `
      <tr class="cn-row" data-accion="ver-persona" data-id="${p.id}">
        <td><div class="dr-cell-person"><span class="dr-mini-avatar">${esc(p.iniciales)}</span><div><b>${esc(nombre(p))}</b><small>${esc(p.email)}</small></div></div></td>
        <td class="cn-num">${window.CEDULA(p)}</td>
        <td><b>${esc(p.sedeNombre)}</b><small class="cn-td-sub">${esc(p.ciudad)}</small></td>
        <td><span class="ps-tag">${esc(p.ministerio)}</span></td>
        <td>${chip(p.etapa)}</td>
        <td>${esc(p.estadoCivil)}</td>
        <td>${p.diezma ? `<b>${mCOP(p.diezmoMensual)}</b>${p.recurrente ? '<small class="cn-rec">recurrente</small>' : '<small class="cn-td-sub">ocasional</small>'}` : '<small class="cn-td-sub">—</small>'}</td>
        <td><button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="ver-persona" data-id="${p.id}">Ver →</button></td>
      </tr>`).join("");
    return shell(`
      ${head("CRM total de la red", `<b>${miles(total)}</b> personas de las 36 iglesias en una sola base. Diezmos y recurrencia visibles solo para la Dirección General.`)}
      <div class="dr-toolbar">
        <input class="dr-search" type="search" placeholder="🔍 Buscar por nombre, correo o ciudad…" value="${esc(crmBusca)}" data-accion="crm-busca" aria-label="Buscar personas" />
        <select class="dr-select" data-accion="crm-sede">${sedeOpts}</select>
      </div>
      <div class="dr-filtros">${filtros.map(([id, l]) => `<button class="dr-filtro ${crmFiltro === id ? "is-active" : ""}" data-accion="crm-filtro" data-f="${id}">${l}</button>`).join("")}</div>
      <p class="dr-card__sub">Mostrando <b>${miles(Math.min(300, reg.length))}</b> de ${miles(reg.length)} personas${reg.length > 300 ? " · límite de 300 en la vista demo" : ""}.</p>
      <div class="dr-tablewrap"><table class="dr-table dr-crmtable"><thead><tr>${th}</tr></thead><tbody>${filas || `<tr><td colspan="8" class="cn-empty">Sin resultados.</td></tr>`}</tbody></table></div>`);
  }
  function modalPersona(id) {
    const p = C.crmMaster().find(x => x.id === id); if (!p) return;
    const s = C.sede(p.sede) || {};
    const diezmos = p.diezmos || [];
    const maxD = Math.max(1, ...diezmos.map(d => d.monto));
    const barras = diezmos.map(d => `<div class="cn-dz"><span>${esc(d.mes.slice(5))}/${esc(d.mes.slice(2, 4))}</span><div class="cn-dz__track"><div class="cn-dz__fill" style="width:${pct(d.monto, maxD)}%"></div></div><b>${mCOP(d.monto)}</b></div>`).join("");
    const totalAnual = diezmos.reduce((a, d) => a + d.monto, 0);
    abrirModal(`
      <div class="dr-modal__head"><div class="dr-cell-person"><span class="dr-mini-avatar">${esc(p.iniciales)}</span><div><h3>${esc(nombre(p))}</h3><small>${esc(p.ministerio)} · ${esc(s.nombreCorto)} (${esc(p.ciudad)})</small></div></div>
        <button class="cn-x" data-accion="cerrar-modal" aria-label="Cerrar">✕</button></div>
      <div class="ps-perfil-grid">
        <div><span>ID (Cédula)</span><b>🪪 ${window.CEDULA(p)}</b></div>
        <div><span>Etapa</span>${chip(p.etapa)}</div>
        <div><span>Género</span><b>${p.genero === "F" ? "Femenino" : "Masculino"}</b></div>
        <div><span>Edad</span><b>${p.edad} años</b></div>
        <div><span>Estado civil</span><b>${esc(p.estadoCivil)}</b></div>
        <div><span>Bautizado</span><b>${p.bautizado ? "Sí" : "No"}</b></div>
        <div><span>Curso ADN</span><b>${p.adn ? "Sí" : "Pendiente"}</b></div>
        <div><span>Cursos cortos</span><b>${p.cursos}</b></div>
        <div><span>Instituto</span><b>${p.instituto ? esc(p.instituto) : "—"}</b></div>
        <div><span>Ingreso</span><b>${fechaCorta(p.fechaInscripcion)}</b></div>
        <div><span>Fuente</span><b>${esc(p.fuente)}</b></div>
      </div>
      <div class="cn-contacto"><a class="dr-btn dr-btn--ghost dr-btn--sm" href="https://wa.me/${soloDigitos(p.telefono)}" target="_blank" rel="noopener">💬 WhatsApp</a>
        <a class="dr-btn dr-btn--ghost dr-btn--sm" href="mailto:${esc(p.email)}" target="_blank" rel="noopener">✉️ Correo</a>
        <span class="cn-tel">${esc(p.telefono)}</span></div>
      ${p.consejerias.length || p.ayudasMas.length ? `<div class="cn-flags">${p.consejerias.map(c => `<span class="ps-pill ps-pill--warn">Consejería: ${esc(c)}</span>`).join("")}${p.ayudasMas.map(a => `<span class="ps-pill">Ayuda M.A.S: ${esc(a)}</span>`).join("")}</div>` : ""}
      <div class="cn-dz-box">
        <div class="cn-dz-box__h"><b>Récord de diezmos</b><span class="cn-conf">🔒 Solo Dirección General</span></div>
        ${p.diezma ? `<p class="cn-dz-sub">${p.recurrente ? "Diezmador <b>recurrente</b>" : "Diezmador ocasional"} · aporte típico ${mCOP(p.diezmoMensual)}/mes · total 6 meses: <b>${mCOP(totalAnual)}</b></p>${barras}` : `<p class="cn-dz-sub">Esta persona no registra diezmos.</p>`}
      </div>`);
  }

  /* ============================================================ 3. FINANZAS MASTER */
  function vistaFinanzas() {
    const R = C.red();
    if (finSede) return shell(finanzasSede(finSede));
    const balanceRed = R.diezmoMes - R.gastosMes;
    const filasIngresos = C.SEDES.slice().sort((a, b) => b.diezmoMes - a.diezmoMes).slice(0, 10).map(s => ({ lbl: s.nombreCorto, v: s.diezmoMes }));
    const filasAhorro = C.SEDES.slice().sort((a, b) => b.ahorro - a.ahorro).slice(0, 8).map(s => ({ lbl: s.nombreCorto, v: s.ahorro }));
    const filas = C.SEDES.map(s => {
      const bal = Math.round((s.diezmoMes - s.gastosMes) * 10) / 10;
      return `<tr data-accion="fin-sede" data-sede="${s.id}">
        <td><b>${esc(s.nombreCorto)}</b><small class="cn-td-sub">${esc(s.ciudad)}</small></td>
        <td class="cn-num">${mCOP(s.presupuesto)}</td><td class="cn-num">${mCOP(s.diezmoMes)}</td><td class="cn-num">${mCOP(s.gastosMes)}</td>
        <td class="cn-num ${bal >= 0 ? "cn-pos" : "cn-neg"}"><b>${mCOP(bal)}</b></td>
        <td class="cn-num">${mCOP(s.ahorro)}</td><td class="dr-td-go">›</td></tr>`;
    }).join("");
    return shell(`
      ${head("Finanzas master de la red", "Presupuesto, ingresos, gastos, balance y ahorro por sede. Toca una sede para ver su detalle y proyectos.")}
      <section class="dr-kpis cn-kpis">
        ${kpi(mCOP(R.diezmoMes), "Ingresos red / mes")}
        ${kpi(mCOP(R.gastosMes), "Gastos red / mes")}
        ${kpi(mCOP(balanceRed), "Balance neto / mes", null, balanceRed < 0)}
        ${kpi(mCOP(R.ahorro), "Ahorro acumulado")}
        ${kpi(mCOP(R.presupuesto), "Presupuesto total")}
        ${kpi(R.recurrenciaProm + "%", "Recurrencia de diezmo")}
      </section>
      <div class="dr-grid2">
        ${barChart("Ingresos por sede (mes)", "Top 10 sedes por diezmos y ofrendas.", filasIngresos, () => "var(--etapa-crece)", mCOP)}
        ${barChart("Ahorro previsto por sede", "Fondos acumulados (top 8).", filasAhorro, () => "var(--azul-600)", mCOP)}
      </div>
      <div class="dr-card"><h3 class="dr-card__t">Detalle por sede</h3><p class="dr-card__sub">36 iglesias · cifras en millones de COP por mes.</p>
        <div class="dr-tablewrap"><table class="dr-table dr-crmtable cn-fin-tabla"><thead><tr><th>Sede</th><th class="cn-num">Presupuesto</th><th class="cn-num">Ingresos</th><th class="cn-num">Gastos</th><th class="cn-num">Balance</th><th class="cn-num">Ahorro</th><th></th></tr></thead><tbody>${filas || `<tr><td colspan="7" class="cn-empty">Sin sedes registradas.</td></tr>`}</tbody></table></div>
      </div>`);
  }
  function finanzasSede(id) {
    const s = C.sede(id); if (!s) return "";
    const bal = Math.round((s.diezmoMes - s.gastosMes) * 10) / 10;
    // proyectos demo por sede (deterministas)
    const proyectos = [
      { nombre: "Adecuación de salón", presupuesto: Math.round(s.ahorro * 0.4 * 10) / 10, avance: 45, estado: "En obra" },
      { nombre: "Equipos de sonido", presupuesto: Math.round(s.ahorro * 0.25 * 10) / 10, avance: 80, estado: "Financiado" },
      { nombre: "Fondo de expansión", presupuesto: Math.round(s.ahorro * 0.9 * 10) / 10, avance: 22, estado: "Recaudando" },
    ];
    const desglose = [
      { lbl: "Personal y pastoral", v: Math.round(s.gastosMes * 0.46 * 10) / 10, color: "var(--azul-600)" },
      { lbl: "Servicios y arriendo", v: Math.round(s.gastosMes * 0.24 * 10) / 10, color: "var(--mostaza-500)" },
      { lbl: "Ministerios y eventos", v: Math.round(s.gastosMes * 0.18 * 10) / 10, color: "var(--etapa-conecta)" },
      { lbl: "Administración", v: Math.round(s.gastosMes * 0.12 * 10) / 10, color: "var(--etapa-crece)" },
    ];
    return `
      <button class="cn-volver" data-accion="fin-volver">‹ Volver a finanzas de la red</button>
      ${head("Finanzas · " + s.nombreCorto, esc(s.nombre) + " · " + esc(s.ciudad) + " · pastor " + esc(s.pastor))}
      <section class="dr-kpis cn-kpis">
        ${kpi(mCOP(s.presupuesto), "Presupuesto / mes")}
        ${kpi(mCOP(s.diezmoMes), "Ingresos / mes")}
        ${kpi(mCOP(s.gastosMes), "Gastos / mes")}
        ${kpi(mCOP(bal), "Balance", null, bal < 0)}
        ${kpi(mCOP(s.ahorro), "Ahorro previsto")}
        ${kpi(mCOP(s.diezmoDom), "Último domingo")}
      </section>
      <div class="dr-grid2">
        ${donut("Desglose de gastos del mes", "Cómo se reparte el gasto de la sede.", desglose)}
        <div class="dr-card"><h3 class="dr-card__t">Proyectos de la sede</h3><p class="dr-card__sub">Inversiones y fondos en curso.</p>
          ${proyectos.map(pr => `<div class="cn-proj"><div class="cn-proj__h"><b>${esc(pr.nombre)}</b>${pill(pr.estado, pr.estado === "Financiado" ? "ps-pill--ok" : "ps-pill--warn")}</div>
            <div class="cn-proj__bar"><div style="width:${pr.avance}%"></div></div>
            <small>${mCOP(pr.presupuesto)} · ${pr.avance}% ejecutado</small></div>`).join("")}
        </div>
      </div>`;
  }

  /* ============================================================ 4. ORGANIGRAMA MASTER */
  function vistaOrganigrama() {
    if (orgSedeDrill) return shell(orgSedeDetalle(orgSedeDrill));
    const org = CS.org();
    const hijos = pid => org.filter(n => n.parent === pid);
    function render(n, nivel) {
      const ch = hijos(n.id);
      const esRed = n.tipo === "red";
      const esSede = n.tipo === "sede";
      const acc = esSede ? ` data-accion="ver-sede-org" data-sede="${n.sedeId}"` : "";
      const cony = esSede ? (n.conyuge || (C.sede(n.sedeId) || {}).conyuge || "") : "";
      const mainHtml = esSede
        ? `<div class="cn-org__main"><b>${esc(n.nombre)}</b>${cony ? `<span class="cn-org__cony">💍 y ${esc(cony)}</span>` : ""}<small>${esc(n.rol)}</small></div>`
        : `<div class="cn-org__main"><b>${esc(n.nombre)}</b><small>${esc(n.rol)}</small></div>`;
      return `<li class="cn-org__li">
        <div class="cn-org__node cn-org__node--${n.tipo || "x"}"${acc} ${esSede ? 'role="button" tabindex="0"' : ""}>
          ${mainHtml}
          <div class="cn-org__acts">
            ${esSede ? `<button class="cn-ic" data-accion="org-edit-pareja" data-id="${n.id}" title="Editar pastor y esposa">✎</button><span class="cn-org__go">ver sede ›</span>` : `<button class="cn-ic" data-accion="org-add" data-parent="${n.id}" title="Agregar bajo este cuadro">＋</button>`}
            ${nivel > 0 && !esSede ? `<button class="cn-ic" data-accion="org-edit" data-id="${n.id}" title="Editar">✎</button>` : ""}
            ${nivel > 1 && !esSede ? `<button class="cn-ic cn-ic--del" data-accion="org-del" data-id="${n.id}" title="Quitar">🗑</button>` : ""}
          </div>
        </div>
        ${esRed ? `<div class="cn-org__count">${ch.length} sedes</div>` : ""}
        ${ch.length && !esRed ? `<ul class="cn-org__ul">${ch.map(c => render(c, nivel + 1)).join("")}</ul>` : ""}
        ${esRed ? `<details class="cn-org__sedes"><summary>Ver las ${ch.length} sedes</summary><ul class="cn-org__ul">${ch.map(c => render(c, nivel + 1)).join("")}</ul></details>` : ""}
      </li>`;
    }
    const raiz = org.filter(n => n.parent === null);
    return shell(`
      ${head("Organigrama master", "El mando completo de la aplicación. Desde aquí se crean los pastores de cada sede y se ve la consecuencia de cada iglesia.")}
      <div class="dr-card cn-org-actions">
        <button class="dr-btn dr-btn--primary dr-btn--sm" data-accion="org-crear-pastor">＋ Crear pastor de sede</button>
        <button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="org-add" data-parent="o_eje">＋ Nuevo cargo corporativo</button>
        <span class="cn-org-hint">Toca una sede para ver su organigrama y consecuencia.</span>
      </div>
      <div class="dr-card"><ul class="cn-org__ul cn-org__root">${raiz.map(n => render(n, 0)).join("")}</ul></div>`);
  }
  function orgSedeDetalle(sedeId) {
    const s = C.sede(sedeId); if (!s) return "";
    const nodoSede = CS.org().find(x => x.tipo === "sede" && x.sedeId === sedeId) || {};
    const pastorNom = nodoSede.nombre || s.pastor;
    const pastorRol = nodoSede.rol || s.pastorRol;
    const conySede = nodoSede.conyuge || s.conyuge || "";
    const personas = C.personasSede(sedeId);
    const porMin = {};
    personas.forEach(p => { porMin[p.ministerio] = (porMin[p.ministerio] || 0) + 1; });
    const filas = Object.keys(porMin).sort((a, b) => porMin[b] - porMin[a]).map(m => ({ lbl: m, v: porMin[m] }));
    return `
      <button class="cn-volver" data-accion="org-volver">‹ Volver al organigrama</button>
      ${head("Sede · " + s.nombreCorto, "La consecuencia de esta iglesia: equipo, ministerios y tamaño. " + esc(s.ciudad) + " · " + esc(s.pais))}
      <section class="dr-kpis cn-kpis">
        ${kpi(miles(s.asistentes), "Asistentes")}
        ${kpi(miles(s.personas), "Personas")}
        ${kpi(miles(s.grupos), "Grupos pequeños")}
        ${kpi(miles(s.ninos), "Niños")}
        ${kpi(miles(s.instIbli + s.instFacter), "En instituto")}
        ${kpi(mCOP(s.diezmoMes), "Diezmo / mes")}
      </section>
      <div class="dr-card cn-org-pastor">
        <div class="cn-org__node cn-org__node--direccion">
          <div class="cn-org__main"><b>${esc(pastorNom)}</b>${conySede ? `<span class="cn-org__cony">💍 y ${esc(conySede)}</span>` : ""}<small>${esc(pastorRol)}</small></div>
          ${nodoSede.id ? `<button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="org-edit-pareja" data-id="${nodoSede.id}">✎ Editar pastores</button>` : ""}
        </div>
        <p class="cn-org-hint">Bajo este pastor (y su esposa) cuelga toda la operación de la sede (directores de ministerio → coordinadores → líderes → grupos).</p>
      </div>
      ${barChart("Ministerios de la sede (muestra del CRM)", "Personas por ministerio en la muestra detallada.", filas, () => "var(--azul-500)")}`;
  }

  /* ============================================================ 5. CALENDARIO CORPORATIVO */
  function vistaCalendario() {
    const eventos = CS.eventos();
    const espacios = CS.espacios();
    const y = calMes.y, m = calMes.m;
    const primero = new Date(y, m, 1), dias = new Date(y, m + 1, 0).getDate();
    let inicio = primero.getDay(); inicio = inicio === 0 ? 6 : inicio - 1; // lunes primero
    const evPorDia = {};
    eventos.forEach(e => { const d = new Date(e.fecha); if (d.getFullYear() === y && d.getMonth() === m) { const k = d.getDate(); (evPorDia[k] = evPorDia[k] || []).push(e); } });
    let celdas = "";
    for (let i = 0; i < inicio; i++) celdas += `<div class="cn-cal__cell cn-cal__cell--off"></div>`;
    for (let d = 1; d <= dias; d++) {
      const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const evs = evPorDia[d] || [];
      celdas += `<button class="cn-cal__cell ${evs.length ? "is-ev" : ""}" data-accion="cal-dia" data-iso="${iso}">
        <span class="cn-cal__d">${d}</span>${evs.slice(0, 3).map(e => `<span class="cn-cal__pill" title="${esc(e.titulo)}">${esc(e.titulo)}</span>`).join("")}${evs.length > 3 ? `<span class="cn-cal__more">+${evs.length - 3}</span>` : ""}</button>`;
    }
    const dow = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(x => `<div class="cn-cal__dow">${x}</div>`).join("");
    const proximos = eventos.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(0, 6);
    return shell(`
      ${head("Calendario empresarial", "Agenda corporativa de la Dirección General: junta, comités, proyectos y reserva de espacios de las oficinas. <b>Independiente</b> de los eventos de las iglesias.")}
      <div class="dr-card cn-cal-actions">
        <button class="dr-btn dr-btn--primary dr-btn--sm" data-accion="nuevo-evento">＋ Nuevo evento / reserva</button>
        <button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="ver-espacios">📍 Espacios (${espacios.length})</button>
      </div>
      <div class="dr-card">
        <div class="cn-cal__nav"><button class="cn-ic" data-accion="cal-prev" aria-label="Mes anterior">‹</button>
          <b>${MESES_LARGO[m]} ${y}</b><button class="cn-ic" data-accion="cal-next" aria-label="Mes siguiente">›</button></div>
        <div class="cn-cal__grid">${dow}${celdas}</div>
      </div>
      <div class="dr-card"><h3 class="dr-card__t">Próximos eventos corporativos</h3>
        ${proximos.map(e => { const esp = espacios.find(x => x.id === e.espacioId) || {}; return `<div class="cn-ev-row"><div class="cn-ev-row__d"><b>${new Date(e.fecha).getDate()}</b><small>${MESES[new Date(e.fecha).getMonth()]}</small></div>
          <div class="cn-ev-row__m"><b>${esc(e.titulo)}</b><small>${esc(e.horaInicio)}–${esc(e.horaFin)} · ${esp.ico || "📍"} ${esc(esp.nombre || "")} · ${esc(e.area)}</small></div>
          <button class="cn-ic cn-ic--del" data-accion="del-evento" data-id="${e.id}" title="Eliminar">🗑</button></div>`; }).join("")}
      </div>`);
  }

  /* ============================================================ 6. EQUIPO */
  function vistaEquipo() {
    const eq = C.EQUIPO_CENTRAL;
    const filas = eq.map(m => `
      <div class="cn-team-card">
        <span class="dr-mini-avatar">${esc(m.ini)}</span>
        <div class="cn-team-card__m"><b>${esc(m.nombre)}</b><small>${esc(m.rol)}</small><span class="cn-tag cn-tag--ok">${esc(m.area)}</span></div>
        <div class="cn-team-card__a">
          <a class="cn-ic" href="mailto:${esc(m.email)}" title="Correo">✉️</a>
          <a class="cn-ic" href="https://wa.me/${soloDigitos(m.tel)}" target="_blank" rel="noopener" title="WhatsApp">💬</a>
        </div>
      </div>`).join("");
    return shell(`
      ${head("Equipo de la Dirección General", "El back-office corporativo: las personas que dirigen los 8 equipos de toda la red.")}
      <section class="dr-kpis cn-kpis">
        ${kpi(eq.length, "Líderes corporativos")}
        ${kpi("8", "Equipos del back-office")}
        ${kpi(miles(C.TEAM_DATA.rrhh.headcount), "Colaboradores en la red")}
        ${kpi("36", "Sedes coordinadas")}
      </section>
      <div class="dr-card"><h3 class="dr-card__t">Directores y líderes</h3><div class="cn-team-grid">${filas}</div></div>`);
  }

  /* ============================================================ 7. EQUIPOS CORPORATIVOS (especialidad) */
  function aprobBtns(id) {
    const dec = CS.aprobacion(id);
    if (dec) return `<span class="cn-tag cn-tag--${dec === "aprobado" ? "ok" : "warn"}">${dec === "aprobado" ? "✓ Aprobado" : "✕ Rechazado"}</span>`;
    return `<span class="cn-aprob"><button class="dr-btn dr-btn--primary dr-btn--sm" data-accion="aprobar" data-id="${id}">Aprobar</button><button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="rechazar" data-id="${id}">Rechazar</button></span>`;
  }
  function colaAprob(titulo, items, label) {
    if (!items.length) return "";
    return `<div class="dr-card"><h3 class="dr-card__t">🔔 ${esc(titulo)}</h3><p class="dr-card__sub">${items.length} pendiente${items.length > 1 ? "s" : ""} de tu aprobación.</p>
      ${items.map(it => `<div class="cn-aprob-row"><div class="cn-aprob-row__m"><b>${esc(it[label] || it.asunto || it.concepto)}</b>${it.sede || it.solicita || it.estado ? `<small>${esc([it.sede, it.solicita, it.monto ? mCOP(it.monto) : ""].filter(Boolean).join(" · "))}</small>` : ""}</div>${aprobBtns(it.id)}</div>`).join("")}</div>`;
  }

  function vistaContabilidad() {
    const d = C.TEAM_DATA.contabilidad, R = C.red();
    const cuentas = d.cuentas.map(c => ({ lbl: c.cta, v: c.saldo, color: c.tipo === "ingreso" ? "var(--etapa-crece)" : "var(--azul-600)" }));
    const cierres = d.cierres;
    const asientosPend = d.asientos.filter(a => a.estado === "Por aprobar");
    return shell(`
      ${head("Contabilidad corporativa", "Consolidado contable de las 36 sedes. Integración con Siigo, cierres por sede y asientos por aprobar.")}
      <section class="dr-kpis cn-kpis">
        ${kpi(mCOP(d.kpis.ingresosRed), "Ingresos red / mes")}
        ${kpi(mCOP(d.kpis.egresosRed), "Egresos red / mes")}
        ${kpi(mCOP(d.kpis.ingresosRed - d.kpis.egresosRed), "Resultado neto")}
        ${kpi(d.kpis.sedesCerradas + "/36", "Sedes con cierre")}
        ${kpi(d.kpis.siigoSync, "Siigo")}
      </section>
      ${colaAprob("Asientos contables por aprobar", asientosPend, "concepto")}
      <div class="dr-grid2">
        ${barChart("Estado de resultados (consolidado)", "Principales cuentas de la red, en millones COP/mes.", cuentas, c => c.color, mCOP)}
        <div class="dr-card"><h3 class="dr-card__t">Cierre contable por sede</h3><p class="dr-card__sub">${d.kpis.sedesPendientes} sedes pendientes de cierre.</p>
          <div class="dr-tablewrap"><table class="dr-table"><thead><tr><th>Sede</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>
          ${cierres.map(c => `<tr><td><b>${esc(c.sede)}</b></td><td>${pill(c.estado, c.estado === "Cerrado" ? "ps-pill--ok" : "ps-pill--warn")}</td><td>${esc(c.dia)}</td></tr>`).join("") || `<tr><td colspan="3" class="cn-empty">Sin cierres pendientes.</td></tr>`}
          </tbody></table></div></div>
      </div>
      <div class="dr-card"><h3 class="dr-card__t">Libro de asientos</h3>
        <div class="dr-tablewrap"><table class="dr-table"><thead><tr><th>Concepto</th><th>Sede</th><th class="cn-num">Débito</th><th class="cn-num">Crédito</th><th>Estado</th></tr></thead><tbody>
        ${d.asientos.map(a => `<tr><td>${esc(a.concepto)}</td><td>${esc(a.sede)}</td><td class="cn-num">${mCOP(a.debito)}</td><td class="cn-num">${mCOP(a.credito)}</td><td>${pill(a.estado, a.estado === "Aprobado" ? "ps-pill--ok" : "ps-pill--warn")}</td></tr>`).join("") || `<tr><td colspan="5" class="cn-empty">Sin asientos registrados.</td></tr>`}
        </tbody></table></div></div>`);
  }

  function vistaTesoreria() {
    const d = C.TEAM_DATA.tesoreria;
    const totalBanco = d.bancos.reduce((a, b) => a + b.saldo, 0);
    const anticiposPend = d.anticipos.filter(a => a.estado === "Por aprobar");
    return shell(`
      ${head("Tesorería corporativa", "Flujo de caja de la red, saldos bancarios consolidados y aprobación de anticipos y desembolsos.")}
      <section class="dr-kpis cn-kpis">
        ${kpi(mCOP(totalBanco), "Disponible total")}
        ${kpi(mCOP((d.flujo[d.flujo.length - 1] || {}).ing || 0), "Ingresos última semana")}
        ${kpi(mCOP((d.flujo[d.flujo.length - 1] || {}).egr || 0), "Egresos última semana")}
        ${kpi(anticiposPend.length, "Anticipos por aprobar", null, anticiposPend.length > 0)}
      </section>
      ${colaAprob("Anticipos y desembolsos por aprobar", anticiposPend, "concepto")}
      <div class="dr-grid2">
        ${dualLine("Flujo de caja semanal", "Ingresos vs. egresos de la red (millones COP).", d.flujo.map(f => ({ lbl: f.f, v: f.ing })), d.flujo.map(f => ({ lbl: f.f, v: f.egr })), "var(--etapa-crece)", "var(--peligro)", "Ingresos", "Egresos")}
        <div class="dr-card"><h3 class="dr-card__t">Saldos bancarios</h3><p class="dr-card__sub">Cuentas de la red.</p>
          ${d.bancos.map(b => `<div class="cn-bank"><div><b>${esc(b.banco)}</b></div><b class="cn-pos">${mCOP(b.saldo)}</b></div>`).join("")}
          <div class="cn-bank cn-bank--tot"><div><b>Total disponible</b></div><b>${mCOP(totalBanco)}</b></div></div>
      </div>
      <div class="dr-card"><h3 class="dr-card__t">Anticipos recientes</h3>
        <div class="dr-tablewrap"><table class="dr-table"><thead><tr><th>Sede</th><th>Concepto</th><th class="cn-num">Monto</th><th>Solicita</th><th>Estado</th></tr></thead><tbody>
        ${d.anticipos.map(a => `<tr><td><b>${esc(a.sede)}</b></td><td>${esc(a.concepto)}</td><td class="cn-num">${mCOP(a.monto)}</td><td>${esc(a.solicita)}</td><td>${pill(a.estado, a.estado === "Aprobado" ? "ps-pill--ok" : "ps-pill--warn")}</td></tr>`).join("") || `<tr><td colspan="5" class="cn-empty">Sin anticipos recientes.</td></tr>`}
        </tbody></table></div></div>`);
  }

  function vistaRRHH() {
    const d = C.TEAM_DATA.rrhh;
    const contr = [
      { lbl: "Indefinido", v: d.contratos.indefinido, color: "var(--azul-600)" },
      { lbl: "Término fijo", v: d.contratos.fijo, color: "var(--mostaza-500)" },
      { lbl: "Prestación", v: d.contratos.prestacion, color: "var(--etapa-conecta)" },
      { lbl: "Aprendiz", v: d.contratos.aprendiz, color: "var(--etapa-crece)" },
    ];
    const solPend = d.solicitudes.filter(s => s.estado === "Por aprobar");
    return shell(`
      ${head("Talento Humano (RRHH)", "Nómina, contratos, vacantes y solicitudes de toda la red. Aprobación de permisos, vacaciones y contrataciones.")}
      <section class="dr-kpis cn-kpis">
        ${kpi(miles(d.headcount), "Colaboradores")}
        ${kpi(mCOP(d.nomina.mensual), "Nómina / mes")}
        ${kpi(d.vacantes.length, "Vacantes abiertas")}
        ${kpi(solPend.length, "Solicitudes por aprobar", null, solPend.length > 0)}
        ${kpi(d.nomina.fecha, "Próximo pago")}
      </section>
      ${colaAprob("Solicitudes de RRHH por aprobar", solPend, "tipo")}
      <div class="dr-grid2">
        ${donut("Tipos de contrato", "Distribución de la planta de la red.", contr)}
        <div class="dr-card"><h3 class="dr-card__t">Vacantes en proceso</h3>
          ${d.vacantes.map(v => `<div class="cn-vac"><div><b>${esc(v.cargo)}</b><small>${esc(v.sede)} · ${v.postulados} postulados</small></div>${pill(v.estado, v.estado === "Abierta" ? "ps-pill--warn" : "ps-pill--ok")}</div>`).join("")}
        </div>
      </div>
      <div class="dr-card"><h3 class="dr-card__t">Solicitudes del personal</h3>
        <div class="dr-tablewrap"><table class="dr-table"><thead><tr><th>Tipo</th><th>Quién</th><th class="cn-num">Días</th><th>Estado</th></tr></thead><tbody>
        ${d.solicitudes.map(s => `<tr><td>${esc(s.tipo)}</td><td>${esc(s.quien)}</td><td class="cn-num">${s.dias || "—"}</td><td>${pill(s.estado, s.estado === "Resuelto" ? "ps-pill--ok" : "ps-pill--warn")}</td></tr>`).join("") || `<tr><td colspan="4" class="cn-empty">Sin solicitudes del personal.</td></tr>`}
        </tbody></table></div></div>`);
  }

  function vistaLegal() {
    const d = C.TEAM_DATA.legal;
    const aprobPend = d.aprob.filter(a => !CS.aprobacion(a.id) || CS.aprobacion(a.id) === null).filter(a => a.estado === "Por aprobar");
    return shell(`
      ${head("Legal corporativo", "Contratos, convenios y cumplimiento de la red. Habeas data (Ley 1581) y GDPR para sedes internacionales.")}
      <section class="dr-kpis cn-kpis">
        ${kpi(d.contratos.length, "Contratos activos")}
        ${kpi(d.contratos.filter(c => c.estado === "Renovar" || c.estado === "Por firmar").length, "Requieren acción", null, true)}
        ${kpi(d.cumplimiento.filter(c => c.estado === "Cumple").length + "/" + d.cumplimiento.length, "Cumplimiento OK")}
        ${kpi(d.aprob.filter(a => a.estado === "Por aprobar").length, "Por aprobar")}
      </section>
      ${colaAprob("Documentos legales por aprobar", d.aprob.filter(a => a.estado === "Por aprobar"), "asunto")}
      <div class="dr-grid2">
        <div class="dr-card"><h3 class="dr-card__t">Contratos y convenios</h3>
          ${d.contratos.map(c => `<div class="cn-legal"><div><b>${esc(c.nombre)}</b><small>${esc(c.tipo)} · vence ${fechaCorta(c.vence)} · riesgo ${esc(c.riesgo)}</small></div>${pill(c.estado, c.estado === "Vigente" ? "ps-pill--ok" : "ps-pill--warn")}</div>`).join("")}
        </div>
        <div class="dr-card"><h3 class="dr-card__t">Cumplimiento normativo</h3>
          ${d.cumplimiento.map(c => `<div class="cn-legal"><div><b>${esc(c.item)}</b><small>${esc(c.nota)}</small></div>${pill(c.estado, c.estado === "Cumple" ? "ps-pill--ok" : "ps-pill--warn")}</div>`).join("")}
        </div>
      </div>`);
  }

  function vistaInstituto() {
    const d = C.TEAM_DATA.instituto, R = C.red();
    const ibli = d.semestres.slice(0, 4).map((s, i) => ({ lbl: s.sem.replace("IBLI · ", ""), v: s.n, color: "var(--azul-600)" }));
    const facter = d.semestres.slice(4).map((s, i) => ({ lbl: s.sem.replace("FACTER · ", ""), v: s.n, color: "var(--etapa-conecta)" }));
    return shell(`
      ${head("Instituto · IBLI y FACTER", "El LMS de formación de líderes de toda la red. Inscritos por semestre, graduaciones y aprobación de cohortes y becas.")}
      <section class="dr-kpis cn-kpis">
        ${kpi(miles(d.inscritosIbli + d.inscritosFacter), "Estudiantes activos")}
        ${kpi(miles(d.inscritosIbli), "IBLI")}
        ${kpi(miles(d.inscritosFacter), "FACTER")}
        ${kpi(miles(d.graduados2026), "Graduados 2026")}
        ${kpi(d.docentes, "Docentes")}
        ${kpi(miles(R.adn), "ADN en la red")}
      </section>
      ${colaAprob("Solicitudes académicas por aprobar", d.aprob.filter(a => a.estado === "Por aprobar"), "asunto")}
      <div class="dr-grid2">
        ${barChart("IBLI por semestre", "Estudiantes por nivel.", ibli, c => c.color)}
        ${barChart("FACTER por semestre", "Estudiantes por nivel.", facter, c => c.color)}
      </div>
      <div class="dr-card cn-inst-foot"><span>🎓 Plataforma: <b>${esc(d.plataforma)}</b></span><span>Acceso unificado para las 36 sedes con inicio de sesión único.</span></div>`);
  }

  function vistaComunicaciones() {
    const d = C.TEAM_DATA.comunicaciones;
    const totalSeg = d.redes.reduce((a, r) => a + r.seguidores, 0);
    const redes = d.redes.map((r, i) => ({ lbl: r.red, v: r.seguidores, color: PALETA[i % PALETA.length] }));
    return shell(`
      ${head("Comunicaciones corporativas", "Campañas de la red, contenido y métricas de redes sociales. Aprobación de piezas y artes.")}
      <section class="dr-kpis cn-kpis">
        ${kpi(miles(totalSeg), "Seguidores totales")}
        ${kpi(d.campanas.filter(c => c.estado === "Activa" || c.estado === "En producción").length, "Campañas activas")}
        ${kpi(d.piezas.filter(p => p.estado === "Por aprobar").length, "Piezas por aprobar", null, true)}
        ${kpi("+3.1%", "Crecimiento mensual")}
      </section>
      ${colaAprob("Piezas y artes por aprobar", d.piezas.filter(p => p.estado === "Por aprobar"), "titulo")}
      <div class="dr-grid2">
        ${donut("Audiencia por red", "Seguidores en plataformas.", redes)}
        <div class="dr-card"><h3 class="dr-card__t">Campañas</h3>
          ${d.campanas.map(c => `<div class="cn-legal"><div><b>${esc(c.nombre)}</b><small>${c.alcance ? "Alcance " + miles(c.alcance) + " · " : ""}${esc(c.fecha)}</small></div>${pill(c.estado, c.estado === "Activa" ? "ps-pill--ok" : "ps-pill--warn")}</div>`).join("")}
        </div>
      </div>
      <div class="dr-card"><h3 class="dr-card__t">Métricas por red</h3>
        <div class="dr-tablewrap"><table class="dr-table"><thead><tr><th>Red</th><th class="cn-num">Seguidores</th><th class="cn-num">Crecimiento</th></tr></thead><tbody>
        ${d.redes.map(r => `<tr><td><b>${esc(r.red)}</b></td><td class="cn-num">${miles(r.seguidores)}</td><td class="cn-num cn-pos">+${r.crec}%</td></tr>`).join("") || `<tr><td colspan="3" class="cn-empty">Sin métricas de redes.</td></tr>`}
        </tbody></table></div></div>`);
  }

  function vistaConstruccion() {
    const d = C.TEAM_DATA.construccion;
    const totalInv = d.proyectos.reduce((a, p) => a + p.presupuesto, 0);
    const enObra = d.proyectos.filter(p => p.estado === "En obra").length;
    return shell(`
      ${head("Construcción y obras", "Proyectos de obra y mantenimiento de toda la red. Presupuestos, avances y aprobación de cotizaciones.")}
      <section class="dr-kpis cn-kpis">
        ${kpi(mCOP(totalInv), "Inversión en obras")}
        ${kpi(enObra, "Proyectos en obra")}
        ${kpi(d.mantenimiento.length, "Mantenimientos abiertos")}
        ${kpi(d.aprob.filter(a => a.estado === "Por aprobar").length, "Por aprobar", null, true)}
      </section>
      ${colaAprob("Cotizaciones y órdenes por aprobar", d.aprob.filter(a => a.estado === "Por aprobar"), "asunto")}
      <div class="dr-card"><h3 class="dr-card__t">Proyectos de obra</h3>
        ${d.proyectos.map(p => `<div class="cn-proj"><div class="cn-proj__h"><b>${esc(p.nombre)}</b><span class="cn-tag cn-tag--${p.estado === "Entregado" ? "ok" : "warn"}">${esc(p.estado)}</span></div>
          <small>${esc(p.sede)} · ${mCOP(p.presupuesto)}</small>
          <div class="cn-proj__bar"><div style="width:${p.avance}%"></div></div><small>${p.avance}% de avance</small></div>`).join("")}
      </div>
      <div class="dr-card"><h3 class="dr-card__t">Mantenimientos</h3>
        <div class="dr-tablewrap"><table class="dr-table"><thead><tr><th>Sede</th><th>Asunto</th><th>Prioridad</th><th>Estado</th></tr></thead><tbody>
        ${d.mantenimiento.map(m => `<tr><td><b>${esc(m.sede)}</b></td><td>${esc(m.asunto)}</td><td>${pill(m.prioridad, m.prioridad === "Alta" ? "ps-pill--warn" : "")}</td><td>${esc(m.estado)}</td></tr>`).join("") || `<tr><td colspan="4" class="cn-empty">Sin mantenimientos abiertos.</td></tr>`}
        </tbody></table></div></div>`);
  }

  /* ============================================================ 8. PETICIONES INTERNAS */
  function vistaPeticiones() {
    const pets = CS.peticiones();
    const estCls = e => e === "respondida" ? "ps-estado--respondida" : e === "orando" ? "ps-estado--orando" : "ps-estado--abierta";
    return shell(`
      ${head("Peticiones internas", "Oración confidencial del equipo de la Dirección General y los colaboradores. No se mezclan con las peticiones de las congregaciones.")}
      <div class="dr-card cn-cal-actions"><button class="dr-btn dr-btn--primary dr-btn--sm" data-accion="nueva-peticion">＋ Nueva petición interna</button>
        <span class="cn-org-hint">🔒 Visible solo para el equipo corporativo.</span></div>
      <div class="dr-card"><h3 class="dr-card__t">${pets.length} peticiones</h3>
        ${pets.map(p => `<div class="cn-peti">
          <div class="cn-peti__m"><b>${esc(p.autor)}</b><span class="cn-tag cn-tag--ok">${esc(p.area)}</span><small>${fechaCorta(p.fecha)}</small></div>
          <p>${esc(p.texto)}</p>
          <div class="cn-peti__a"><span class="ps-estado ${estCls(p.estado)}">${esc(p.estado)}</span>
            <button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="pet-orando" data-id="${p.id}">🙏 Orando</button>
            <button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="pet-respondida" data-id="${p.id}">✓ Respondida</button></div>
        </div>`).join("")}
      </div>`);
  }

  /* ============================================================ 9. REQUERIMIENTOS */
  function vistaRequerimientos() {
    let reqs = allReqs();
    if (reqEq !== "todos") reqs = reqs.filter(r => r.equipo === reqEq);
    if (reqEstado !== "todos") reqs = reqs.filter(r => r.estado === reqEstado);
    if (reqSede !== "todas") reqs = reqs.filter(r => r.sede === reqSede);
    reqs.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    const all = allReqs();
    const porEquipo = C.EQUIPOS_DEF.map(e => ({ lbl: e.nombre, v: all.filter(r => r.equipo === e.id).length, _id: e.id }));
    const abiertos = all.filter(r => r.estado !== "Resuelto").length;
    const enAprob = all.filter(r => r.requiereAprobacion && r.estado !== "Resuelto").length;
    const eqChips = [["todos", "Todos los equipos"]].concat(C.EQUIPOS_DEF.map(e => [e.id, e.ico + " " + e.nombre]));
    const estChips = [["todos", "Todos"], ["Abierto", "Abiertos"], ["En proceso", "En proceso"], ["En aprobación", "En aprobación"], ["Resuelto", "Resueltos"]];
    const totalRed = all.length;
    const sedeReqOpts = `<option value="todas">Todas las sedes (${totalRed})</option>` + C.SEDES.map(s => {
      const n = all.filter(r => r.sede === s.id).length;
      return `<option value="${s.id}" ${reqSede === s.id ? "selected" : ""}>${esc(s.nombreCorto)} · ${esc(s.ciudad)} (${n})</option>`;
    }).join("");
    const filas = reqs.slice(0, 80).map(r => {
      const eq = C.equipo(r.equipo) || {};
      return `<div class="cn-req" data-accion="ver-req" data-id="${r.id}">
        <div class="cn-req__ico">${eq.ico || "🎫"}</div>
        <div class="cn-req__m"><b>${esc(r.asunto)}</b><small>${esc(r.sedeNombre)} · ${esc(eq.nombre || "")}${r.montoAsociado ? " · " + mCOP(r.montoAsociado) : ""} · ${fechaCorta(r.fecha)}</small></div>
        <div class="cn-req__r">${r.requiereAprobacion && r.estado !== "Resuelto" ? '<span class="cn-tag cn-tag--warn">aprobación</span>' : ""}${pill(r.prioridad, r.prioridad === "Alta" ? "ps-pill--warn" : "")}${pill(r.estado, r.estado === "Resuelto" ? "ps-pill--ok" : "")}</div>
      </div>`;
    }).join("");
    return shell(`
      ${head("Requerimientos de la red", "Mesa de servicio maestra. Aquí llegan <b>sincronizados</b> todos los requerimientos que las 36 iglesias envían a la administración central.")}
      <section class="dr-kpis cn-kpis">
        ${kpi(all.length, "Total requerimientos")}
        ${kpi(abiertos, "Sin resolver")}
        ${kpi(enAprob, "Requieren aprobación", null, enAprob > 0)}
        ${kpi(all.filter(r => r.prioridad === "Alta" && r.estado !== "Resuelto").length, "Prioridad alta", null, true)}
      </section>
      ${barChart("Carga por equipo", "Requerimientos recibidos por cada equipo corporativo.", porEquipo, () => "var(--azul-500)")}
      <div class="dr-card">
        <div class="dr-toolbar"><select class="dr-select" data-accion="req-sede" aria-label="Filtrar por sede">${sedeReqOpts}</select></div>
        <div class="dr-filtros">${eqChips.map(([id, l]) => `<button class="dr-filtro ${reqEq === id ? "is-active" : ""}" data-accion="req-eq" data-eq="${id}">${l}</button>`).join("")}</div>
        <div class="dr-filtros">${estChips.map(([id, l]) => `<button class="dr-filtro ${reqEstado === id ? "is-active" : ""}" data-accion="req-est" data-est="${id}">${l}</button>`).join("")}</div>
        <p class="cn-crm-count">Mostrando <b>${Math.min(80, reqs.length)}</b> de ${reqs.length}.</p>
        <div class="cn-req-list">${filas || `<p class="cn-empty">Sin requerimientos con ese filtro.</p>`}</div>
      </div>`);
  }
  function modalReq(id) {
    const r = allReqs().find(x => x.id === id); if (!r) return;
    const eq = C.equipo(r.equipo) || {};
    abrirModal(`
      <div class="dr-modal__head"><div><h3>${eq.ico || "🎫"} ${esc(r.asunto)}</h3><small>${esc(r.sedeNombre)} · ${esc(eq.nombre)} · ${esc(r.autor)}</small></div>
        <button class="cn-x" data-accion="cerrar-modal" aria-label="Cerrar">✕</button></div>
      <div class="ps-perfil-grid">
        <div><span>Equipo</span><b>${esc(eq.nombre)}</b></div>
        <div><span>Prioridad</span>${pill(r.prioridad, r.prioridad === "Alta" ? "ps-pill--warn" : "")}</div>
        <div><span>Estado</span>${pill(r.estado, r.estado === "Resuelto" ? "ps-pill--ok" : "")}</div>
        <div><span>Fecha</span><b>${fechaCorta(r.fecha)}</b></div>
        ${r.montoAsociado ? `<div><span>Monto</span><b>${mCOP(r.montoAsociado)}</b></div>` : ""}
        <div><span>SLA equipo</span><b>${esc(eq.sla)}</b></div>
      </div>
      <p class="cn-req-desc">${esc(r.descripcion)}</p>
      ${(r.respuestas || []).map(rp => `<div class="cn-resp"><b>${esc(rp.de)}</b> <small>${fechaCorta(rp.fecha)}</small><p>${esc(rp.texto)}</p></div>`).join("")}
      <div class="cn-req-form">
        <textarea class="dr-input" id="cn-req-resp" rows="2" placeholder="Escribe una respuesta o instrucción a la sede…"></textarea>
        <div class="cn-req-form__a">
          <button class="dr-btn dr-btn--primary dr-btn--sm" data-accion="req-responder" data-id="${r.id}">Responder</button>
          ${r.requiereAprobacion && r.estado !== "Resuelto" ? `<button class="dr-btn dr-btn--primary dr-btn--sm" data-accion="req-aprobar" data-id="${r.id}">✓ Aprobar</button>` : ""}
          <button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="req-resolver" data-id="${r.id}">Marcar resuelto</button>
        </div>
      </div>`);
  }

  /* ============================================================ 10. DIRECTORIO */
  function vistaDirectorio() {
    const orgSedes = CS.org().filter(n => n.tipo === "sede");
    const pastores = C.SEDES.map(s => { const nodo = orgSedes.find(n => n.sedeId === s.id) || {}; return { nombre: nodo.nombre || s.pastor, conyuge: nodo.conyuge || s.conyuge || "", rol: nodo.rol || s.pastorRol, iglesia: s.nombreCorto, ciudad: s.ciudad, pais: s.pais, tipo: "pastor" }; });
    const admin = C.EQUIPO_CENTRAL.map(m => ({ nombre: m.nombre, rol: m.rol, iglesia: m.area, ciudad: "Bogotá", email: m.email, tel: m.tel, tipo: "admin" }));
    const filasP = pastores.map(p => `<tr><td><div class="dr-cell-person"><span class="dr-mini-avatar">${esc(C.ini(p.nombre.split(" ")[1] || p.nombre, p.nombre.split(" ")[2] || ""))}</span><div><b>${esc(p.nombre)}</b><small>${esc(p.rol)}</small></div></div></td><td>${p.conyuge ? esc(p.conyuge) : "<span class='cn-muted'>—</span>"}</td><td>${esc(p.iglesia)}</td><td>${esc(p.ciudad)} · ${esc(p.pais)}</td></tr>`).join("");
    const filasA = admin.map(m => `<tr><td><div class="dr-cell-person"><span class="dr-mini-avatar">${esc(m.nombre.split(" ").map(x => x[0]).slice(0, 2).join(""))}</span><div><b>${esc(m.nombre)}</b><small>${esc(m.rol)}</small></div></div></td><td>${esc(m.iglesia)}</td><td><a href="mailto:${esc(m.email)}">${esc(m.email)}</a></td></tr>`).join("");
    return shell(`
      ${head("Directorio de la red", "Los 36 pastores de las iglesias y el equipo de la administración central.")}
      <section class="dr-kpis cn-kpis">
        ${kpi("36", "Pastores de sede")}
        ${kpi(C.SEDES.filter(s => s.pais === "Colombia").length, "Sedes en Colombia")}
        ${kpi(C.SEDES.filter(s => s.pais !== "Colombia").length, "Sedes internacionales")}
        ${kpi(C.EQUIPO_CENTRAL.length, "Equipo central")}
      </section>
      <div class="dr-card"><h3 class="dr-card__t">Pastores de las 36 iglesias</h3>
        <div class="dr-tablewrap"><table class="dr-table"><thead><tr><th>Pastor</th><th>Esposo(a) / cónyuge</th><th>Iglesia</th><th>Ciudad</th></tr></thead><tbody>${filasP || `<tr><td colspan="4" class="cn-empty">Sin pastores registrados.</td></tr>`}</tbody></table></div></div>
      <div class="dr-card"><h3 class="dr-card__t">Administración central</h3>
        <div class="dr-tablewrap"><table class="dr-table"><thead><tr><th>Persona</th><th>Área</th><th>Correo</th></tr></thead><tbody>${filasA || `<tr><td colspan="3" class="cn-empty">Sin equipo central registrado.</td></tr>`}</tbody></table></div></div>`);
  }

  /* ============================================================ MODALES base */
  function abrirModal(html) {
    const w = document.getElementById("cn-modal"); if (!w) return;
    w.innerHTML = `<div class="dr-modalbg" data-accion="modal-bg"><div class="dr-modal" role="dialog" aria-modal="true">${html}</div></div>`;
    document.addEventListener("keydown", escClose);
  }
  function cerrarModal() { const w = document.getElementById("cn-modal"); if (w) w.innerHTML = ""; document.removeEventListener("keydown", escClose); }
  function escClose(e) { if (e.key === "Escape") cerrarModal(); }
  function val(id) { const el = document.getElementById(id); return el ? (el.value || "").trim() : ""; }

  function modalNodo(parent, esEdit, nodo) {
    const org = CS.org();
    const opts = org.filter(n => n.tipo !== "sede" && n.tipo !== "red").map(n => `<option value="${n.id}" ${((nodo && nodo.parent === n.id) || (!esEdit && parent === n.id)) ? "selected" : ""}>${esc(n.nombre)} · ${esc(n.rol)}</option>`).join("");
    abrirModal(`
      <div class="dr-modal__head"><h3>${esEdit ? "Editar cargo" : "Nuevo cargo corporativo"}</h3><button class="cn-x" data-accion="cerrar-modal">✕</button></div>
      <label class="cn-f"><span>Nombre</span><input class="dr-input" id="cn-org-nombre" value="${esEdit ? esc(nodo.nombre) : ""}" placeholder="Nombre de la persona" /></label>
      <label class="cn-f"><span>Rol / cargo</span><input class="dr-input" id="cn-org-rol" value="${esEdit ? esc(nodo.rol) : ""}" placeholder="Ej. Coordinador de Tesorería" /></label>
      <label class="cn-f"><span>Depende de</span><select class="dr-select" id="cn-org-parent">${opts}</select></label>
      <div class="cn-modal-actions">${esEdit ? `<button class="dr-btn dr-btn--primary" data-accion="org-save-edit" data-id="${nodo.id}">Guardar</button>` : `<button class="dr-btn dr-btn--primary" data-accion="org-save-new">Crear</button>`}<button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button></div>`);
  }
  function modalPareja(nodo) {
    if (!nodo) { toast("No se encontró la sede", false); return; }
    const sede = C.sede(nodo.sedeId) || {};
    const cony = nodo.conyuge || sede.conyuge || "";
    abrirModal(`
      <div class="dr-modal__head"><h3>Editar pastores de la sede</h3><button class="cn-x" data-accion="cerrar-modal">✕</button></div>
      <p class="cn-dz-sub">${esc(sede.nombreCorto || "")}${sede.ciudad ? " · " + esc(sede.ciudad) : ""}. La Dirección General puede actualizar el pastor titular y su esposa.</p>
      <label class="cn-f"><span>Pastor (titular)</span><input class="dr-input" id="cn-pa-pastor" value="${esc(nodo.nombre)}" placeholder="Ej. Pastor Juan Gómez" /></label>
      <label class="cn-f"><span>Esposo(a) / cónyuge</span><input class="dr-input" id="cn-pa-conyuge" value="${esc(cony)}" placeholder="Ej. Pastora María Gómez" /></label>
      <label class="cn-f"><span>Rol</span><input class="dr-input" id="cn-pa-rol" value="${esc(nodo.rol)}" /></label>
      <div class="cn-modal-actions"><button class="dr-btn dr-btn--primary" data-accion="pareja-save" data-id="${nodo.id}">Guardar</button><button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button></div>`);
  }
  function modalCrearPastor() {
    const opts = C.SEDES.map(s => `<option value="${s.id}">${esc(s.nombreCorto)} · ${esc(s.ciudad)}</option>`).join("");
    abrirModal(`
      <div class="dr-modal__head"><h3>Crear pastor de sede</h3><button class="cn-x" data-accion="cerrar-modal">✕</button></div>
      <p class="cn-dz-sub">Asigna un pastor a una iglesia de la red. Quedará bajo el nodo de Filiales del organigrama master.</p>
      <label class="cn-f"><span>Sede</span><select class="dr-select" id="cn-np-sede">${opts}</select></label>
      <label class="cn-f"><span>Nombre del pastor</span><input class="dr-input" id="cn-np-nombre" placeholder="Ej. Pastor Juan Gómez" /></label>
      <label class="cn-f"><span>Esposo(a) / cónyuge</span><input class="dr-input" id="cn-np-conyuge" placeholder="Ej. Pastora María Gómez" /></label>
      <label class="cn-f"><span>Rol</span><select class="dr-select" id="cn-np-rol"><option>Pastor Congregacional</option><option>Pastor de plantación</option><option>Pastor asistente</option></select></label>
      <div class="cn-modal-actions"><button class="dr-btn dr-btn--primary" data-accion="np-save">Crear pastor</button><button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button></div>`);
  }
  function modalConfirmDel(id) {
    const n = CS.org().find(x => x.id === id) || {};
    abrirModal(`<div class="dr-modal__head"><h3>¿Quitar este cuadro?</h3><button class="cn-x" data-accion="cerrar-modal">✕</button></div>
      <p class="cn-dz-sub">Se quitará <b>${esc(n.nombre)}</b> (${esc(n.rol)}) del organigrama. Sus dependientes pasarán al nivel superior; el sistema/sede se conserva.</p>
      <div class="cn-modal-actions"><button class="dr-btn dr-btn--primary" data-accion="org-del-confirm" data-id="${id}">Sí, quitar</button><button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button></div>`);
  }
  function modalEvento(iso) {
    const esp = CS.espacios();
    abrirModal(`
      <div class="dr-modal__head"><h3>Nuevo evento / reserva</h3><button class="cn-x" data-accion="cerrar-modal">✕</button></div>
      <label class="cn-f"><span>Título</span><input class="dr-input" id="cn-ev-titulo" placeholder="Ej. Comité de proyectos" /></label>
      <div class="cn-f2">
        <label class="cn-f"><span>Fecha</span><input class="dr-input" type="date" id="cn-ev-fecha" value="${iso || "2026-06-18"}" /></label>
        <label class="cn-f"><span>Área</span><input class="dr-input" id="cn-ev-area" placeholder="Dirección, RRHH…" value="Dirección" /></label>
      </div>
      <div class="cn-f2">
        <label class="cn-f"><span>Inicio</span><input class="dr-input" type="time" id="cn-ev-inicio" value="09:00" /></label>
        <label class="cn-f"><span>Fin</span><input class="dr-input" type="time" id="cn-ev-fin" value="10:00" /></label>
      </div>
      <label class="cn-f"><span>Espacio</span><select class="dr-select" id="cn-ev-espacio">${esp.map(e => `<option value="${e.id}">${e.ico} ${esc(e.nombre)} (cap. ${e.capacidad})</option>`).join("")}</select></label>
      <div class="cn-modal-actions"><button class="dr-btn dr-btn--primary" data-accion="ev-guardar">Crear y reservar</button><button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button></div>`);
  }
  function modalEspacios() {
    const esp = CS.espacios();
    abrirModal(`
      <div class="dr-modal__head"><h3>Espacios reservables</h3><button class="cn-x" data-accion="cerrar-modal">✕</button></div>
      ${esp.map(e => `<div class="cn-bank"><div><b>${e.ico} ${esc(e.nombre)}</b><small> · capacidad ${e.capacidad} · ${CS.eventosEnEspacio(e.id)} reservas</small></div><button class="cn-ic cn-ic--del" data-accion="del-espacio" data-id="${e.id}">🗑</button></div>`).join("")}
      <label class="cn-f"><span>Nuevo espacio</span><input class="dr-input" id="cn-esp-nombre" placeholder="Nombre del espacio" /></label>
      <div class="cn-modal-actions"><button class="dr-btn dr-btn--primary" data-accion="esp-guardar">Habilitar espacio</button><button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cerrar</button></div>`);
  }
  function modalDia(iso) {
    const evs = CS.eventos().filter(e => e.fecha === iso);
    const esp = CS.espacios();
    const d = new Date(iso);
    abrirModal(`
      <div class="dr-modal__head"><h3>${d.getDate()} de ${MESES_LARGO[d.getMonth()]}</h3><button class="cn-x" data-accion="cerrar-modal">✕</button></div>
      ${evs.length ? evs.map(e => { const es = esp.find(x => x.id === e.espacioId) || {}; return `<div class="cn-ev-row"><div class="cn-ev-row__m"><b>${esc(e.titulo)}</b><small>${esc(e.horaInicio)}–${esc(e.horaFin)} · ${es.ico || ""} ${esc(es.nombre || "")} · ${esc(e.area)}</small></div><button class="cn-ic cn-ic--del" data-accion="del-evento" data-id="${e.id}">🗑</button></div>`; }).join("") : `<p class="cn-dz-sub">Sin eventos este día.</p>`}
      <div class="cn-modal-actions"><button class="dr-btn dr-btn--primary" data-accion="nuevo-evento-dia" data-iso="${iso}">＋ Agregar evento</button></div>`);
  }
  function modalPeticion() {
    abrirModal(`
      <div class="dr-modal__head"><h3>Nueva petición interna</h3><button class="cn-x" data-accion="cerrar-modal">✕</button></div>
      <label class="cn-f"><span>Autor</span><input class="dr-input" id="cn-pe-autor" value="${esc(USER.nombre)}" /></label>
      <label class="cn-f"><span>Área</span><input class="dr-input" id="cn-pe-area" placeholder="Dirección, Contabilidad…" value="Dirección" /></label>
      <label class="cn-f"><span>Petición</span><textarea class="dr-input" id="cn-pe-texto" rows="3" placeholder="Comparte el motivo de oración…"></textarea></label>
      <div class="cn-modal-actions"><button class="dr-btn dr-btn--primary" data-accion="pe-guardar">Compartir</button><button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button></div>`);
  }

  /* ============================================================ TOAST */
  function toast(msg, ok) {
    const w = document.getElementById("cn-toasts"); if (!w) return;
    const t = document.createElement("div");
    t.className = "dr-toast " + (ok === false ? "is-warn" : "is-ok");
    t.textContent = msg; w.appendChild(t);
    setTimeout(() => { t.classList.add("is-out"); setTimeout(() => t.remove(), 300); }, 2600);
  }

  /* ============================================================ ROUTER de vistas */
  function contenido() {
    switch (vista) {
      case "tablero": return vistaTablero();
      case "crm": return vistaCRM();
      case "finanzas": return vistaFinanzas();
      case "organigrama": return vistaOrganigrama();
      case "calendario": return vistaCalendario();
      case "equipo": return vistaEquipo();
      case "contabilidad": return vistaContabilidad();
      case "tesoreria": return vistaTesoreria();
      case "rrhh": return vistaRRHH();
      case "legal": return vistaLegal();
      case "instituto": return vistaInstituto();
      case "comunicaciones": return vistaComunicaciones();
      case "construccion": return vistaConstruccion();
      case "peticiones": return vistaPeticiones();
      case "requerimientos": return vistaRequerimientos();
      case "directorio": return vistaDirectorio();
      default: return vistaTablero();
    }
  }
  function render() {
    const app = document.getElementById("cn-app");
    app.innerHTML = sesion ? contenido() : vistaLogin();
  }

  /* ============================================================ acciones */
  function onClick(ev) {
    const el = ev.target.closest("[data-accion]"); if (!el) return;
    const a = el.dataset.accion, id = el.dataset.id;
    switch (a) {
      case "salir": ev.preventDefault(); sesion = false; vista = "tablero"; render(); return;
      case "ir": ev.preventDefault(); vista = el.dataset.vista; orgSedeDrill = null; finSede = null; tableroDrill = null; window.scrollTo(0, 0); render(); return;
      // tablero
      case "kpi": { ev.preventDefault(); tableroDrill = el.dataset.k; render(); const dd = document.querySelector(".cn-detalle"); if (dd && dd.scrollIntoView) dd.scrollIntoView({ block: "center" }); return; }
      case "kpi-cerrar": ev.preventDefault(); tableroDrill = null; render(); return;
      case "ver-sede": case "ver-sede-org": ev.preventDefault(); vista = "organigrama"; orgSedeDrill = el.dataset.sede; window.scrollTo(0, 0); render(); return;
      // crm
      case "crm-sort": ev.preventDefault(); { const c = el.dataset.col; if (crmSort === c) crmDir = -crmDir; else { crmSort = c; crmDir = 1; } render(); } return;
      case "crm-filtro": ev.preventDefault(); crmFiltro = el.dataset.f; render(); return;
      case "ver-persona": ev.preventDefault(); modalPersona(id); return;
      // finanzas
      case "fin-sede": ev.preventDefault(); finSede = el.dataset.sede; window.scrollTo(0, 0); render(); return;
      case "fin-volver": ev.preventDefault(); finSede = null; window.scrollTo(0, 0); render(); return;
      // organigrama
      case "org-volver": ev.preventDefault(); orgSedeDrill = null; window.scrollTo(0, 0); render(); return;
      case "org-add": ev.preventDefault(); modalNodo(el.dataset.parent, false); return;
      case "org-edit": ev.preventDefault(); modalNodo(null, true, CS.org().find(x => x.id === id)); return;
      case "org-del": ev.preventDefault(); modalConfirmDel(id); return;
      case "org-del-confirm": ev.preventDefault(); CS.delNodo(id); cerrarModal(); render(); toast("Cuadro quitado del organigrama", false); return;
      case "org-crear-pastor": ev.preventDefault(); modalCrearPastor(); return;
      case "org-edit-pareja": ev.preventDefault(); modalPareja(CS.org().find(x => x.id === id)); return;
      case "pareja-save": { ev.preventDefault(); const nom = val("cn-pa-pastor"); if (!nom) { toast("Escribe el nombre del pastor", false); return; } CS.editNodo(id, { nombre: nom, conyuge: val("cn-pa-conyuge"), rol: val("cn-pa-rol") }); cerrarModal(); render(); toast("Pastores de la sede actualizados ✓", true); return; }
      case "org-save-new": { ev.preventDefault(); const nom = val("cn-org-nombre"); if (!nom) { toast("Escribe un nombre", false); return; } CS.addNodo({ nombre: nom, rol: val("cn-org-rol") || "Cargo", parent: val("cn-org-parent") || "o_eje", tipo: "equipo" }); cerrarModal(); render(); toast("Cargo creado ✓", true); return; }
      case "org-save-edit": { ev.preventDefault(); const nom = val("cn-org-nombre"); if (!nom) { toast("Escribe un nombre", false); return; } CS.editNodo(id, { nombre: nom, rol: val("cn-org-rol"), parent: val("cn-org-parent") }); cerrarModal(); render(); toast("Actualizado ✓", true); return; }
      case "np-save": { ev.preventDefault(); const nom = val("cn-np-nombre"); if (!nom) { toast("Escribe el nombre del pastor", false); return; } CS.crearPastorSede(val("cn-np-sede"), nom, val("cn-np-rol"), val("cn-np-conyuge")); cerrarModal(); render(); toast("Pastor de sede creado ✓", true); return; }
      // calendario
      case "cal-prev": ev.preventDefault(); calMes = { y: calMes.m === 0 ? calMes.y - 1 : calMes.y, m: (calMes.m + 11) % 12 }; render(); return;
      case "cal-next": ev.preventDefault(); calMes = { y: calMes.m === 11 ? calMes.y + 1 : calMes.y, m: (calMes.m + 1) % 12 }; render(); return;
      case "cal-dia": ev.preventDefault(); modalDia(el.dataset.iso); return;
      case "nuevo-evento": ev.preventDefault(); modalEvento(); return;
      case "nuevo-evento-dia": ev.preventDefault(); modalEvento(el.dataset.iso); return;
      case "ver-espacios": ev.preventDefault(); modalEspacios(); return;
      case "ev-guardar": {
        ev.preventDefault();
        const t = val("cn-ev-titulo"); if (!t) { toast("Escribe un título", false); return; }
        const fecha = val("cn-ev-fecha"), hi = val("cn-ev-inicio"), hf = val("cn-ev-fin"), espacio = val("cn-ev-espacio");
        if (hf <= hi) { toast("La hora de fin debe ser mayor", false); return; }
        if (!CS.libre(espacio, fecha, hi, hf)) { toast("Ese espacio no está libre en ese horario", false); return; }
        CS.addEvento({ titulo: t, fecha, horaInicio: hi, horaFin: hf, espacioId: espacio, area: val("cn-ev-area") || "Dirección" });
        cerrarModal(); render(); toast("Evento creado y espacio reservado ✓", true); return;
      }
      case "esp-guardar": { ev.preventDefault(); const n = val("cn-esp-nombre"); if (!n) { toast("Escribe un nombre", false); return; } CS.addEspacio({ nombre: n, capacidad: 10, ico: "📍" }); cerrarModal(); render(); vista = "calendario"; render(); toast("Espacio habilitado ✓", true); return; }
      case "del-evento": ev.preventDefault(); CS.delEvento(id); cerrarModal(); render(); toast("Evento eliminado", false); return;
      case "del-espacio": { ev.preventDefault(); const usos = CS.eventosEnEspacio(id); if (usos > 0) { toast("No se puede borrar: tiene reservas", false); return; } CS.delEspacio(id); modalEspacios(); toast("Espacio borrado", false); return; }
      // aprobaciones de equipos
      case "aprobar": ev.preventDefault(); CS.decidir(id, "aprobado"); render(); toast("Aprobado ✓", true); return;
      case "rechazar": ev.preventDefault(); CS.decidir(id, "rechazado"); render(); toast("Rechazado", false); return;
      // peticiones
      case "nueva-peticion": ev.preventDefault(); modalPeticion(); return;
      case "pe-guardar": { ev.preventDefault(); const tx = val("cn-pe-texto"); if (!tx) { toast("Escribe la petición", false); return; } CS.addPeticion({ autor: val("cn-pe-autor") || USER.nombre, area: val("cn-pe-area") || "Dirección", texto: tx }); cerrarModal(); render(); toast("Petición compartida 🙏", true); return; }
      case "pet-orando": ev.preventDefault(); CS.petEstado(id, "orando"); render(); toast("Marcada: orando 🙏", true); return;
      case "pet-respondida": ev.preventDefault(); CS.petEstado(id, "respondida"); render(); toast("¡Gloria a Dios! Respondida ✓", true); return;
      // requerimientos
      case "ver-req": ev.preventDefault(); modalReq(id); return;
      case "req-responder": {
        ev.preventDefault(); const tx = val("cn-req-resp"); if (!tx) { toast("Escribe una respuesta", false); return; }
        const rr = allReqs().find(x => x.id === id);
        if (rr && rr._pastor && PS) { PS.addRespuestaRequerimiento(rr._pid, tx, "Dirección General"); PS.setEstadoRequerimiento(rr._pid, "En proceso"); }
        else CS.reqResponder(id, tx);
        cerrarModal(); render(); toast("Respuesta enviada a la sede ✓", true); return;
      }
      case "req-aprobar": ev.preventDefault(); reqAplicarEstado(id, "En proceso"); CS.decidir(id, "aprobado"); cerrarModal(); render(); toast("Requerimiento aprobado ✓", true); return;
      case "req-resolver": ev.preventDefault(); reqAplicarEstado(id, "Resuelto"); cerrarModal(); render(); toast("Marcado como resuelto ✓", true); return;
      case "req-eq": ev.preventDefault(); reqEq = el.dataset.eq; render(); return;
      case "req-est": ev.preventDefault(); reqEstado = el.dataset.est; render(); return;
      // modal
      case "cerrar-modal": ev.preventDefault(); cerrarModal(); return;
      case "modal-bg": if (ev.target === el) { ev.preventDefault(); cerrarModal(); } return;
    }
  }
  function onInput(ev) {
    const el = ev.target.closest("[data-accion]"); if (!el) return;
    const a = el.dataset.accion;
    if (a === "crm-sede") { crmSede = el.value; render(); }
    else if (a === "req-sede") { reqSede = el.value; render(); }
    else if (a === "crm-busca") { crmBusca = el.value; const reg = crmFiltrado(); /* re-render preservando foco */ render(); const inp = document.querySelector('[data-accion="crm-busca"]'); if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); } }
  }

  /* ============================================================ init */
  function init() {
    document.addEventListener("click", e => {
      if (e.target.closest("#cn-google")) { sesion = true; vista = "tablero"; render(); return; }
      onClick(e);
    });
    document.addEventListener("change", onInput);
    document.addEventListener("input", e => { const el = e.target.closest('[data-accion="crm-busca"]'); if (el) onInput(e); });
    CS.onCambio(() => { if (sesion) render(); });
    // En vivo: re-renderiza cuando cambia la operación de la sede madre.
    [SS, RK, PS].forEach(st => { if (st && st.onCambio) st.onCambio(() => { if (sesion) render(); }); });
    render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
