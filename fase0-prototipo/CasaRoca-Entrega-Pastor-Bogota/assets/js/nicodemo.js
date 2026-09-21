/* ============================================================
   CASA ROCA · EQUIPO OPERATIVO "NICODEMO" (ministerio de nuevos)
   Capa de sede. Equipo de SEGUIMIENTO de la filial: toda persona
   nueva que llega por cualquier puerta (QR de ministerio, domingo,
   web, YouTube, redes) entra y pasa por aquí. Desde el bucket se
   dirige a cada nuevo al MINISTERIO que le corresponde y se vela
   por que quede conectado y por que su líder esté hablando con él.

   Lee window.NICO / window.NSTORE (estado) y window.STORE (grupo
   Café & Palabra en vivo) y window.DB (catálogo de ministerios).
   Sin frameworks. Vistas = funciones que devuelven HTML.
   ============================================================ */
(function () {
  const NI = window.NICO;
  const N = window.NSTORE;
  const S = window.STORE;
  const DB = window.DB;

  const USER = NI.NICO_USER;
  const FUNNELS = NI.FUNNELS;
  const FMAP = NI.FUNNEL_MAP;

  let sesion = false;
  let vista = "analitica";
  let clickBound = false;

  // estado de la vista bucket
  let bucketFiltro = "todos";   // todos | pendientes | sin_contactar | contactado | en_seguimiento | conectado
  let bucketFunnel = "todos";   // todos | <funnelId>
  let bucketQuery = "";
  // selección de ministerio en el modal de asignar
  let asignarSel = null;

  /* ------------------------------------------------------------ utils */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const app = () => document.getElementById("ni-app");
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const MESES_L = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const DOW = ["L", "M", "X", "J", "V", "S", "D"];

  const ESTADOS = {
    sin_contactar: { lbl: "Sin contactar", color: "var(--peligro)" },
    contactado: { lbl: "Contactado", color: "var(--info)" },
    en_seguimiento: { lbl: "En seguimiento", color: "var(--mostaza-700)" },
    conectado: { lbl: "Conectado", color: "var(--exito)" },
  };
  const ESTADO_ORDEN = ["sin_contactar", "contactado", "en_seguimiento", "conectado"];

  function nombreCompleto(p) { return `${p.nombres || ""} ${p.apellidos || ""}`.trim(); }
  function iniciales(p) { return (((p.nombres || "")[0] || "") + ((p.apellidos || "")[0] || "")).toUpperCase() || "·"; }
  function generoDe(p) { return p.genero === "F" || p.genero === "M" ? p.genero : (/a$/.test((p.nombres || "").toLowerCase()) ? "F" : "M"); }
  function soloDigitos(t) { return String(t || "").replace(/\D/g, ""); }
  function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }
  function diasDesde(iso) { if (!iso) return 9999; const d = new Date(iso + "T00:00"); const h = new Date(); h.setHours(0, 0, 0, 0); return Math.round((h - d) / 86400000); }
  function fechaCorta(iso) { if (!iso) return "—"; const d = new Date(iso + "T00:00"); return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`; }
  function haceTexto(iso) { const d = diasDesde(iso); if (d <= 0) return "hoy"; if (d === 1) return "ayer"; if (d < 7) return `hace ${d} días`; if (d < 30) return `hace ${Math.round(d / 7)} sem`; return `hace ${Math.round(d / 30)} meses`; }

  function funBadge(p) {
    const f = FMAP[p.funnel] || { ico: "📍", lbl: p.funnel };
    return `<span class="ni-srcbadge"><i>${f.ico}</i> ${esc(f.lbl)}</span>`;
  }
  function estadoPill(p) {
    const e = ESTADOS[p.estado] || ESTADOS.sin_contactar;
    return `<span class="ni-estado ni-estado--${p.estado}">${e.lbl}</span>`;
  }

  /* ----------------------------------------- enlaces correo / WhatsApp */
  function waLink(p) {
    const n = (p.nombres || "").split(" ")[0];
    const msg = `Hola ${n} 🙌 Te saluda el equipo Nicodemo de Casa Roca. ¡Qué alegría que llegaste! Queremos conocerte y acompañarte. ¿Cómo estás?`;
    return `https://wa.me/${soloDigitos(p.telefono)}?text=${encodeURIComponent(msg)}`;
  }
  function mailLink(p) {
    const n = (p.nombres || "").split(" ")[0];
    const asunto = "Bienvenido a Casa Roca · Nicodemo";
    const cuerpo = `Hola ${n},\n\nTe escribe el equipo Nicodemo de Casa Roca. Vimos que llegaste a la casa y queremos acompañarte de cerca y ayudarte a encontrar tu lugar.\n\nUn abrazo,\n${USER.nombre} · Nicodemo`;
    return `mailto:${p.correo}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
  }

  /* ============================================================ LOGIN */
  function vistaLogin() {
    return `
    <div class="ni-login">
      <div class="ni-login__card">
        <div class="ni-login__logo">CR</div>
        <h1>Nicodemo · Ministerio de Nuevos</h1>
        <p>Toda persona que llega a la casa entra por aquí. Conoce, acompaña y conecta a cada nuevo con su ministerio.</p>
        <button class="ni-google" id="ni-google">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Continuar con Google
        </button>
        <div class="ni-login__nota">🔒 Demo Fase 0 — entrarás como <b>${esc(USER.nombre)}</b>, ${esc(USER.rol)} · sede <b>${esc(USER.sede)}</b>.</div>
      </div>
    </div>`;
  }

  /* ============================================================ SHELL */
  const NAV = [
    { id: "analitica", ico: "📊", lbl: "Analítica" },
    { id: "bucket", ico: "🌱", lbl: "Bucket de nuevos" },
    { id: "equipo", ico: "🤝", lbl: "Equipo" },
    { id: "organigrama", ico: "🗂️", lbl: "Organigrama" },
    { id: "peticiones", ico: "🙏", lbl: "Peticiones" },
    { id: "calendario", ico: "📅", lbl: "Calendario" },
  ];

  function shell(contenidoHTML) {
    return `
    <header class="ni-topbar">
      <div class="ni-brand">
        <div class="ni-brand__logo">CR</div>
        <div class="ni-brand__txt"><b>Casa Roca</b><small>Nicodemo · ${esc(USER.sede)}</small></div>
      </div>
      <div class="ni-topbar__sp"></div>
      <div class="ni-user">
        <div class="ni-user__name">${esc(USER.nombre)}<span>${esc(USER.rol)}</span></div>
        <div class="ni-avatar" title="${esc(USER.nombre)}">${esc(USER.iniciales)}</div>
        <button class="ni-btn ni-btn--ghost ni-btn--sm" data-accion="salir">Salir</button>
      </div>
    </header>
    <div class="ni-shell">
      <nav class="ni-nav" aria-label="Secciones de Nicodemo">
        ${NAV.map(n => `<button class="ni-nav__item ${vista === n.id ? "is-active" : ""}" data-accion="ir" data-vista="${n.id}" ${vista === n.id ? 'aria-current="page"' : ""}>
          <span class="ni-nav__ic" aria-hidden="true">${n.ico}</span><span class="ni-nav__lbl">${n.lbl}</span></button>`).join("")}
      </nav>
      <main class="ni-main" id="main">${contenidoHTML}</main>
    </div>`;
  }

  /* ============================================================ helpers de gráfico (reusa lenguaje del Director) */
  const PALETA = ["var(--azul-600)", "var(--mostaza-500)", "var(--etapa-conecta)", "var(--etapa-crece)", "var(--azul-400)", "var(--mostaza-300)", "var(--azul-800)"];
  function _card(title, sub, body) { return `<div class="ni-card"><h3 class="ni-card__t">${esc(title)}</h3>${sub ? `<p class="ni-card__sub">${sub}</p>` : ""}${body}</div>`; }
  function _legend(items, total) { return `<ul class="ni-legend">${items.map(s => `<li><i style="background:${s.color}"></i><span>${esc(s.lbl)}</span><b>${s.v}</b>${total ? `<em>${pct(s.v, total)}%</em>` : ""}</li>`).join("")}</ul>`; }
  function donut(title, sub, segs) {
    const total = segs.reduce((s, x) => s + x.v, 0) || 1, r = 52, C = 2 * Math.PI * r; let off = 0;
    const arcs = segs.map(s => { const len = (s.v / total) * C; const el = `<circle class="ni-donut__seg" cx="60" cy="60" r="${r}" stroke="${s.color}" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"/>`; off += len; return el; }).join("");
    return _card(title, sub, `<div class="ni-donut"><div class="ni-donut__chart"><svg viewBox="0 0 120 120" role="img" aria-label="${esc(title)}"><g transform="rotate(-90 60 60)">${arcs}</g></svg><div class="ni-donut__center"><b>${total}</b><span>total</span></div></div>${_legend(segs, total)}</div>`);
  }
  function columns(title, sub, rows, colorFn) {
    const max = Math.max(1, ...rows.map(r => r.v));
    return _card(title, sub, `<div class="ni-cols">${rows.map(r => `<div class="ni-col"><span class="ni-col__v">${r.v}</span><div class="ni-col__track"><div class="ni-col__bar" style="height:${Math.max(2, pct(r.v, max))}%;background:${colorFn ? colorFn(r) : "var(--azul-500)"}"></div></div><span class="ni-col__l">${esc(r.lbl)}</span></div>`).join("")}</div>`);
  }
  function funnelChart(title, sub, steps) {
    const max = Math.max(1, ...steps.map(s => s.v));
    return _card(title, sub, `<div class="ni-funnel">${steps.map(s => `<div class="ni-funnel__bar" style="width:${Math.max(14, pct(s.v, max))}%;background:${s.color}"><span class="ni-funnel__lbl">${esc(s.lbl)}</span><span class="ni-funnel__v">${s.v}</span></div>`).join("")}</div>`);
  }
  function lineArea(title, sub, pts, color) {
    const W = 320, H = 130, pX = 18, pT = 20, pB = 26, n = pts.length;
    const max = Math.max(1, ...pts.map(p => p.v));
    const X = i => pX + (i * (W - 2 * pX) / Math.max(1, n - 1));
    const Y = v => (H - pB) - (v / max) * (H - pT - pB);
    const line = pts.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ");
    const area = `M${X(0).toFixed(1)},${H - pB} ` + pts.map((p, i) => `L${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ") + ` L${X(n - 1).toFixed(1)},${H - pB} Z`;
    const dots = pts.map((p, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="3.2"/>`).join("");
    const vl = pts.map((p, i) => `<text class="ni-line__v" x="${X(i).toFixed(1)}" y="${(Y(p.v) - 7).toFixed(1)}">${p.v}</text>`).join("");
    const xl = pts.map((p, i) => `<text class="ni-line__x" x="${X(i).toFixed(1)}" y="${H - 8}">${esc(p.lbl)}</text>`).join("");
    return _card(title, sub, `<svg class="ni-line" style="--lc:${color}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}"><path class="ni-line__area" d="${area}"/><path class="ni-line__path" d="${line}"/><g class="ni-line__dots">${dots}</g>${vl}${xl}</svg>`);
  }
  function lollipop(title, sub, rows, colorFn) {
    const max = Math.max(1, ...rows.map(r => r.v));
    return _card(title, sub, `<div class="ni-lollis">${rows.map(r => { const w = pct(r.v, max), c = colorFn ? colorFn(r) : "var(--azul-600)"; return `<div class="ni-lolli"><div class="ni-lolli__lbl">${esc(r.lbl)}</div><div class="ni-lolli__track"><span class="ni-lolli__line" style="width:${w}%;background:${c}"></span><span class="ni-lolli__dot" style="left:${w}%;background:${c}"></span></div><div class="ni-lolli__v">${r.v}</div></div>`; }).join("")}</div>`);
  }
  function gauges(title, sub, items) {
    const r = 25, C = 2 * Math.PI * r;
    const cells = items.map(it => { const v = Math.min(100, it.v), len = (v / 100) * C; return `<div class="ni-gauge"><svg viewBox="0 0 64 64"><circle class="ni-gauge__bg" cx="32" cy="32" r="${r}"/><circle class="ni-gauge__fg" cx="32" cy="32" r="${r}" stroke="${it.color}" stroke-dasharray="${len.toFixed(1)} ${(C - len).toFixed(1)}" transform="rotate(-90 32 32)"/><text class="ni-gauge__v" x="32" y="36">${it.v}%</text></svg><div class="ni-gauge__l">${esc(it.lbl)}</div></div>`; }).join("");
    return _card(title, sub, `<div class="ni-gauges">${cells}</div>`);
  }
  function kpi(n, lbl, opts) {
    opts = opts || {};
    const inter = !!opts.goFiltro;
    const tag = inter ? "button" : "div";
    const cls = opts.clase ? " " + opts.clase : "";
    const attrs = inter ? ` data-accion="kpi-bucket" data-f="${opts.goFiltro}" aria-label="Ver en el bucket: ${esc(lbl)}"` : "";
    return `<${tag} class="ni-kpi${cls} ${opts.alerta ? "is-alerta" : ""} ${inter ? "ni-kpi--click" : ""}"${attrs}>
      <div class="ni-kpi__n">${n}</div><div class="ni-kpi__l">${esc(lbl)}</div>
      ${inter ? '<span class="ni-kpi__hint" aria-hidden="true">Ver lista →</span>' : ""}</${tag}>`;
  }

  /* ----- tracking: llegadas por semana (últimas N) ----- */
  function lunesDe(d) { const x = new Date(d); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); x.setHours(0, 0, 0, 0); return x; }
  function llegadasPorSemana(nuevos, nWeeks) {
    const base = lunesDe(new Date());
    const out = [];
    for (let i = nWeeks - 1; i >= 0; i--) {
      const start = new Date(base); start.setDate(base.getDate() - i * 7);
      const end = new Date(start); end.setDate(start.getDate() + 7);
      const v = nuevos.filter(p => { if (!p.fechaLlegada) return false; const d = new Date(p.fechaLlegada + "T00:00"); return d >= start && d < end; }).length;
      out.push({ lbl: `${start.getDate()} ${MESES[start.getMonth()]}`, v });
    }
    return out;
  }

  /* ============================================================ 1. ANALÍTICA (capa fuerte) */
  function vistaAnalitica() {
    const nuevos = N.nuevos();
    const total = nuevos.length;
    const sinContactar = nuevos.filter(p => p.estado === "sin_contactar");
    const contactados = nuevos.filter(p => p.estado !== "sin_contactar");
    const enSeguimiento = nuevos.filter(p => p.liderHabla);
    const conectados = nuevos.filter(p => p.asignadoA);
    const pendientes = nuevos.filter(p => !p.asignadoA);
    const nuevos7 = nuevos.filter(p => diasDesde(p.fechaLlegada) <= 7);
    const nuevos30 = nuevos.filter(p => diasDesde(p.fechaLlegada) <= 30);
    const tasaConexion = pct(conectados.length, total);
    const tasaContacto = pct(contactados.length, total);

    // por funnel
    const porFunnel = FUNNELS.map(f => ({ id: f.id, lbl: f.lbl, ico: f.ico, color: f.color, v: nuevos.filter(p => p.funnel === f.id).length }));
    const maxFunnel = Math.max(1, ...porFunnel.map(f => f.v));

    // conversión (embudo de seguimiento)
    const pasos = [
      { lbl: "Llegaron", v: total, color: "var(--azul-700)" },
      { lbl: "Contactados", v: contactados.length, color: "var(--azul-500)" },
      { lbl: "En seguimiento", v: enSeguimiento.length, color: "var(--mostaza-500)" },
      { lbl: "Conectados", v: conectados.length, color: "var(--exito)" },
    ];

    // por estado
    const porEstado = ESTADO_ORDEN.map(e => ({ lbl: ESTADOS[e].lbl, v: nuevos.filter(p => p.estado === e).length, color: ESTADOS[e].color }));

    // llegadas por semana (tracking)
    const semanas = llegadasPorSemana(nuevos, 8);

    // top fuentes (qué QR / formulario)
    const fuenteTally = {};
    nuevos.forEach(p => { const k = p.fuenteDetalle || "Otro"; fuenteTally[k] = (fuenteTally[k] || 0) + 1; });
    const topFuentes = Object.keys(fuenteTally).map(k => ({ lbl: k, v: fuenteTally[k] })).sort((a, b) => b.v - a.v).slice(0, 7);

    // conexión por ministerio
    const minTally = {};
    conectados.forEach(p => { minTally[p.asignadoA] = (minTally[p.asignadoA] || 0) + 1; });
    const porMin = Object.keys(minTally).map(id => ({ lbl: NI.nombreMinisterio(id), v: minTally[id] })).sort((a, b) => b.v - a.v);

    // género
    const fem = nuevos.filter(p => generoDe(p) === "F").length, masc = total - fem;

    // edades
    const buckets = [{ lbl: "≤18", min: 0, max: 18 }, { lbl: "19–25", min: 19, max: 25 }, { lbl: "26–35", min: 26, max: 35 }, { lbl: "36–55", min: 36, max: 55 }, { lbl: "56+", min: 56, max: 200 }];
    const conEdad = nuevos.filter(p => typeof p.edad === "number");
    const filasEdad = buckets.map(b => ({ lbl: b.lbl, v: conEdad.filter(p => p.edad >= b.min && p.edad <= b.max).length }));

    // tabla: últimos en llegar (tracking de cuándo llegaron)
    const ultimos = nuevos.slice().sort((a, b) => (b.fechaLlegada || "").localeCompare(a.fechaLlegada || "")).slice(0, 12);

    return shell(`
      <div class="ni-head">
        <div><h1 class="ni-h1">Analítica de nuevos</h1>
        <p class="ni-lead">Todo el que llega a la casa pasa por Nicodemo. Aquí ves por dónde entran, cuándo llegan y cómo avanzan hasta quedar conectados con un ministerio y con un líder que los acompañe.</p></div>
        <button class="ni-btn ni-btn--primary" data-accion="nuevo-registro">＋ Registrar nuevo</button>
      </div>

      <h2 class="ni-h2">Puertas de entrada <small>${total}</small></h2>
      <div class="ni-funnels">
        ${porFunnel.map(f => `<button class="ni-funnelcard ${bucketFunnel === f.id ? "is-active" : ""}" data-accion="kpi-funnel" data-f="${f.id}">
          <div class="ni-funnelcard__top"><span class="ni-funnelcard__ic">${f.ico}</span><span class="ni-funnelcard__lbl">${esc(f.lbl)}</span></div>
          <div class="ni-funnelcard__n">${f.v}</div>
          <div class="ni-funnelcard__sub">${pct(f.v, total)}% de los nuevos</div>
          <div class="ni-funnelcard__bar"><span style="width:${pct(f.v, maxFunnel)}%;background:${f.color}"></span></div>
        </button>`).join("")}
      </div>

      <div class="ni-kpis">
        ${kpi(total, "Nuevos en total")}
        ${kpi(nuevos7.length, "Llegaron esta semana", { clase: "ni-kpi--ok" })}
        ${kpi(sinContactar.length, "Sin contactar", { alerta: sinContactar.length > 0, clase: "ni-kpi--bad", goFiltro: "sin_contactar" })}
        ${kpi(enSeguimiento.length, "Con líder hablando", { clase: "ni-kpi--warn", goFiltro: "en_seguimiento" })}
        ${kpi(pendientes.length, "Por asignar", { alerta: pendientes.length > 0, goFiltro: "pendientes" })}
        ${kpi(tasaConexion + "%", "Tasa de conexión", { clase: "ni-kpi--ok" })}
      </div>

      <div class="ni-charts">
        ${funnelChart("Recorrido del nuevo", `${tasaContacto}% contactado · ${tasaConexion}% ya conectado a un ministerio`, pasos)}
        ${lineArea("Llegadas por semana", "Cada cuándo está llegando gente nueva (últimas 8 semanas)", semanas, "var(--azul-600)")}
        ${donut("Por dónde llegan", "Distribución por puerta de entrada", porFunnel.map(f => ({ lbl: f.lbl, v: f.v, color: f.color })))}
        ${columns("Estado del seguimiento", "En qué punto del acompañamiento está cada nuevo", porEstado, r => r.color)}
        ${lollipop("Fuentes más efectivas", "Qué QR o formulario trae más gente", topFuentes, () => "var(--azul-600)")}
        ${porMin.length ? lollipop("Conexión por ministerio", "A dónde se está conectando a los nuevos", porMin, () => "var(--etapa-crece)") : ""}
        ${donut("Mujeres vs. hombres", `${fem} mujeres · ${masc} hombres`, [{ lbl: "Mujeres", v: fem, color: "var(--mostaza-500)" }, { lbl: "Hombres", v: masc, color: "var(--azul-600)" }])}
        ${columns("Edades de los nuevos", `${conEdad.length} con edad registrada`, filasEdad, () => "var(--azul-500)")}
        ${gauges("Salud del seguimiento", "Indicadores clave de acompañamiento", [
          { lbl: "Contactados", v: tasaContacto, color: tasaContacto >= 70 ? "var(--exito)" : "var(--mostaza-500)" },
          { lbl: "Con líder", v: pct(enSeguimiento.length, total), color: "var(--azul-500)" },
          { lbl: "Conectados", v: tasaConexion, color: tasaConexion >= 50 ? "var(--exito)" : "var(--peligro)" },
        ])}
      </div>

      <h2 class="ni-h2">Últimos en llegar</h2>
      <div class="ni-tablewrap">
        <table class="ni-table">
          <thead><tr><th>Persona</th><th>Llegó</th><th>Puerta</th><th>Fuente</th><th>Estado</th><th>Ministerio</th><th></th></tr></thead>
          <tbody>
            ${ultimos.map(p => `<tr>
              <td class="ni-td-name"><div class="ni-td-avatar">${esc(iniciales(p))}</div><div><b>${esc(nombreCompleto(p))}</b><span>${typeof p.edad === "number" ? p.edad + " años" : ""}</span></div></td>
              <td>${fechaCorta(p.fechaLlegada)}<br><small class="ni-muted">${haceTexto(p.fechaLlegada)}</small></td>
              <td>${funBadge(p)}</td>
              <td><small>${esc(p.fuenteDetalle || "—")}</small></td>
              <td>${estadoPill(p)}</td>
              <td>${p.asignadoA ? `${NI.icoMinisterio(p.asignadoA)} ${esc(NI.nombreMinisterio(p.asignadoA))}` : '<span class="ni-muted">— por asignar</span>'}</td>
              <td class="ni-td-acts"><button class="ni-btn ni-btn--ghost ni-btn--sm" data-accion="ver-nuevo" data-id="${p.id}">Ver</button></td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>

      <div class="ni-ia">
        <span class="ni-ia__badge">✦ Lectura IA</span>
        <p>Llegaron <b>${nuevos7.length}</b> personas esta semana. El <b>${tasaContacto}%</b> ya fue contactado y el <b>${tasaConexion}%</b> quedó conectado a un ministerio. Hay <b>${sinContactar.length}</b> ${sinContactar.length === 1 ? "persona" : "personas"} <b>sin contactar</b> y <b>${pendientes.length}</b> por asignar: esa es la prioridad de esta semana. La puerta que más trae es <b>${porFunnel.slice().sort((a, b) => b.v - a.v)[0].lbl}</b>.</p>
      </div>
    `);
  }

  /* ============================================================ 2. BUCKET DE NUEVOS */
  function pasaFiltro(p) {
    if (bucketFunnel !== "todos" && p.funnel !== bucketFunnel) return false;
    if (bucketFiltro === "todos") return true;
    if (bucketFiltro === "pendientes") return !p.asignadoA;
    return p.estado === bucketFiltro;
  }
  function vistaBucket() {
    const todos = N.nuevos();
    let lista = todos.filter(pasaFiltro);
    if (bucketQuery) {
      const q = bucketQuery.toLowerCase();
      lista = lista.filter(p => `${nombreCompleto(p)} ${p.correo} ${p.telefono} ${p.fuenteDetalle}`.toLowerCase().includes(q));
    }
    lista.sort((a, b) => (b.fechaLlegada || "").localeCompare(a.fechaLlegada || ""));

    const cont = e => todos.filter(p => p.estado === e).length;
    const filtros = [
      ["todos", `Todos (${todos.length})`],
      ["pendientes", `Por asignar (${todos.filter(p => !p.asignadoA).length})`],
      ["sin_contactar", `Sin contactar (${cont("sin_contactar")})`],
      ["contactado", `Contactados (${cont("contactado")})`],
      ["en_seguimiento", `En seguimiento (${cont("en_seguimiento")})`],
      ["conectado", `Conectados (${cont("conectado")})`],
    ];

    return shell(`
      <div class="ni-head">
        <div><h1 class="ni-h1">Bucket de nuevos</h1>
        <p class="ni-lead">El corazón de Nicodemo: cada persona nueva, sin importar por qué puerta llegó. Contáctala, registra que su líder está hablando con ella y dirígela al ministerio que le corresponde.</p></div>
        <button class="ni-btn ni-btn--primary" data-accion="nuevo-registro">＋ Registrar nuevo</button>
      </div>

      <div class="ni-bucketbar">
        <input class="ni-search" id="ni-bucket-search" type="search" placeholder="Buscar por nombre, correo, teléfono, fuente…" aria-label="Buscar" value="${esc(bucketQuery)}">
        <div class="ni-crmcount"><b>${lista.length}</b> de ${todos.length}</div>
      </div>

      <div class="ni-filtros">
        ${filtros.map(([id, lbl]) => `<button class="ni-filtro ${bucketFiltro === id ? "is-active" : ""}" data-accion="bucket-filtro" data-f="${id}">${lbl}</button>`).join("")}
      </div>
      <div class="ni-filtros">
        <button class="ni-filtro ${bucketFunnel === "todos" ? "is-active" : ""}" data-accion="bucket-funnel" data-f="todos">Todas las puertas</button>
        ${FUNNELS.map(f => `<button class="ni-filtro ${bucketFunnel === f.id ? "is-active" : ""}" data-accion="bucket-funnel" data-f="${f.id}">${f.ico} ${esc(f.lbl)}</button>`).join("")}
      </div>

      <div class="ni-people">
        ${lista.length ? lista.map(nuevoCard).join("") : `<div class="ni-empty">🎉 No hay nuevos en este filtro.</div>`}
      </div>
    `);
  }

  function nuevoCard(p) {
    const reciente = diasDesde(p.fechaLlegada) <= 7;
    const estadoSel = ESTADO_ORDEN.map(e => `<option value="${e}" ${p.estado === e ? "selected" : ""}>${ESTADOS[e].lbl}</option>`).join("");
    return `<article class="ni-person ni-person--nuevo">
      <div class="ni-person__top">
        <div class="ni-avatar">${esc(iniciales(p))}</div>
        <div class="ni-person__id">
          <div class="ni-person__name">${esc(nombreCompleto(p))} ${reciente ? '<span class="ni-tag ni-tag--nuevo">Nuevo</span>' : ""} ${p._vivo ? '<span class="ni-tag ni-tag--live">en vivo</span>' : ""}</div>
          <div class="ni-person__sub">${typeof p.edad === "number" ? p.edad + " años · " : ""}${esc(p.estadoCivil || "")} · ${generoDe(p) === "F" ? "Mujer" : "Hombre"}</div>
          <div class="ni-person__chips">${funBadge(p)} ${estadoPill(p)}</div>
        </div>
      </div>
      <div class="ni-person__data">
        <div><span class="k">✉️</span> ${esc(p.correo || "—")}</div>
        <div><span class="k">📱</span> ${esc(p.telefono || "—")}</div>
        <div><span class="k">📅</span> Llegó ${fechaCorta(p.fechaLlegada)} · ${haceTexto(p.fechaLlegada)}</div>
        <div><span class="k">🔗</span> ${esc(p.fuenteDetalle || "—")}</div>
        <div><span class="k">📍</span> ${p.asignadoA ? `Conectado a <b>${esc(NI.nombreMinisterio(p.asignadoA))}</b>` : `Sugerido: ${esc(NI.nombreMinisterio(p.ministerioInteres))}`}</div>
      </div>
      ${p.nota ? `<div class="ni-person__nota">📝 ${esc(p.nota)}</div>` : ""}
      <div class="ni-person__seg">
        <button class="ni-switch ${p.liderHabla ? "is-on" : ""}" data-accion="lider-habla" data-id="${p.id}" role="switch" aria-checked="${p.liderHabla}">
          <span class="ni-switch__track"></span><span>${p.liderHabla ? "El líder ya habla con esta persona" : "¿El líder ya habla con esta persona?"}</span>
        </button>
        <label class="ni-reasignar">Estado:
          <select class="ni-select ni-select--sm" data-accion="estado-nuevo" data-id="${p.id}">${estadoSel}</select>
        </label>
      </div>
      <div class="ni-person__acts">
        <a class="ni-btn ni-btn--gold ni-btn--sm" href="${waLink(p)}" target="_blank" rel="noopener">💬 WhatsApp</a>
        <a class="ni-btn ni-btn--ghost ni-btn--sm" href="${mailLink(p)}">✉️ Correo</a>
        ${p.asignadoA
          ? `<button class="ni-btn ni-btn--ghost ni-btn--sm" data-accion="asignar" data-id="${p.id}">🔁 Cambiar ministerio</button>`
          : `<button class="ni-btn ni-btn--primary ni-btn--sm" data-accion="asignar" data-id="${p.id}">➕ Asignar a ministerio</button>`}
      </div>
    </article>`;
  }

  function modalAsignar(id) {
    const p = N.nuevo(id); if (!p) return;
    asignarSel = p.asignadoA || p.ministerioInteres || null;
    const mins = NI.ministeriosDestino();
    const grid = mins.map(m => `<button class="ni-minopt ${asignarSel === m.id ? "is-sel" : ""}" data-accion="pick-min" data-min="${m.id}">
      <span class="ni-minopt__ic">${m.ico}</span><span><span class="ni-minopt__nb">${esc(m.nombre)}</span><span class="ni-minopt__tp">${m.tipo === "operacional" ? "Equipo operativo" : "Congregacional"}</span></span>
    </button>`).join("");
    abrirModal(`
      <h3 id="ni-modal-t">Conectar a ${esc(nombreCompleto(p))}</h3>
      <p class="ni-muted">Elige el ministerio al que pertenece. Quedará conectado y aparecerá en ese ministerio para que su director y su líder lo reciban. ${p.ministerioInteres ? `Sugerencia por su perfil: <b>${esc(NI.nombreMinisterio(p.ministerioInteres))}</b>.` : ""}</p>
      <div class="ni-mingrid" id="ni-mingrid">${grid}</div>
      <div class="ni-modal__acts">
        <button class="ni-btn ni-btn--primary" data-accion="confirmar-asignar" data-id="${p.id}">Conectar al ministerio</button>
        <button class="ni-btn ni-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>
    `);
  }

  function modalNuevoRegistro() {
    const funOps = FUNNELS.map(f => `<option value="${f.id}">${f.ico} ${esc(f.lbl)}</option>`).join("");
    abrirModal(`
      <h3 id="ni-modal-t">Registrar persona nueva</h3>
      <p class="ni-muted">Una persona que llegó y aún no está en el sistema. Entrará al bucket de Nicodemo para su seguimiento.</p>
      <div class="ni-row2">
        <label class="ni-field"><span>Nombres</span><input class="ni-input" id="ni-nv-nombres" placeholder="Ej. María"></label>
        <label class="ni-field"><span>Apellidos</span><input class="ni-input" id="ni-nv-apellidos" placeholder="Ej. Gómez"></label>
      </div>
      <div class="ni-row2">
        <label class="ni-field"><span>Correo</span><input class="ni-input" id="ni-nv-correo" type="email" placeholder="correo@email.com"></label>
        <label class="ni-field"><span>Teléfono</span><input class="ni-input" id="ni-nv-tel" placeholder="+57 3..."></label>
      </div>
      <div class="ni-row2">
        <label class="ni-field"><span>Edad</span><input class="ni-input" id="ni-nv-edad" type="number" min="0" max="120" placeholder="Ej. 28"></label>
        <label class="ni-field"><span>Llegó por</span><select class="ni-select" id="ni-nv-funnel">${funOps}</select></label>
      </div>
      <label class="ni-field"><span>Detalle de la fuente <small>(qué QR / formulario)</small></span><input class="ni-input" id="ni-nv-fuente" placeholder="Ej. QR RocaKids · Servicio 10:00 am"></label>
      <label class="ni-field"><span>Nota <small>(opcional)</small></span><textarea class="ni-input" id="ni-nv-nota" rows="2" placeholder="Algo que ayude a acompañarla…"></textarea></label>
      <div class="ni-modal__acts">
        <button class="ni-btn ni-btn--primary" data-accion="guardar-nuevo">Registrar</button>
        <button class="ni-btn ni-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>
    `);
  }

  function modalNuevoDetalle(id) {
    const p = N.nuevo(id); if (!p) return;
    abrirModal(`
      <div class="ni-modal__head">
        <div class="ni-avatar ni-avatar--lg">${esc(iniciales(p))}</div>
        <div><h3 id="ni-modal-t">${esc(nombreCompleto(p))}</h3><div class="ni-muted">${funBadge(p)} · llegó ${fechaCorta(p.fechaLlegada)}</div></div>
      </div>
      <div class="ni-deflist">
        <div><span>Estado</span>${estadoPill(p)}</div>
        <div><span>Edad</span>${typeof p.edad === "number" ? p.edad + " años" : "—"}</div>
        <div><span>Estado civil</span>${esc(p.estadoCivil || "—")}</div>
        <div><span>Correo</span>${esc(p.correo || "—")}</div>
        <div><span>Teléfono</span>${esc(p.telefono || "—")}</div>
        <div><span>Fuente</span>${esc(p.fuenteDetalle || "—")}</div>
        <div><span>Líder hablando</span>${p.liderHabla ? "✅ Sí" : "⛔ Aún no"}</div>
        <div><span>Ministerio</span>${p.asignadoA ? esc(NI.nombreMinisterio(p.asignadoA)) : "Por asignar (sugerido: " + esc(NI.nombreMinisterio(p.ministerioInteres)) + ")"}</div>
      </div>
      ${p.nota ? `<div class="ni-why"><span>Nota</span><p>${esc(p.nota)}</p></div>` : ""}
      <div class="ni-modal__acts">
        <a class="ni-btn ni-btn--gold" href="${waLink(p)}" target="_blank" rel="noopener">💬 WhatsApp</a>
        ${p.asignadoA ? "" : `<button class="ni-btn ni-btn--primary" data-accion="asignar" data-id="${p.id}">➕ Asignar a ministerio</button>`}
        <button class="ni-btn ni-btn--ghost" data-accion="cerrar-modal">Cerrar</button>
      </div>
    `);
  }

  /* ============================================================ 3. EQUIPO */
  function vistaEquipo() {
    const eq = N.equipo();
    return shell(`
      <div class="ni-head"><div><h1 class="ni-h1">Equipo Nicodemo</h1>
      <p class="ni-lead">Quienes sirven en el seguimiento de los nuevos: primer contacto, bienvenida del domingo, web y redes, y conexión a ministerios.</p></div></div>
      <div class="ni-kpis">
        ${kpi(eq.length, "Servidores")}
        ${kpi(eq.filter(p => generoDe(p) === "F").length, "Mujeres")}
        ${kpi(eq.filter(p => generoDe(p) === "M").length, "Hombres")}
        ${kpi(new Set(eq.map(p => p.sirveEn)).size, "Áreas")}
      </div>
      <div class="ni-people">
        ${eq.map(p => `<article class="ni-person ni-person--click" data-accion="ver-persona" data-id="${p.id}" tabindex="0" role="button">
          <div class="ni-person__top">
            <div class="ni-avatar">${esc(iniciales(p))}</div>
            <div class="ni-person__id">
              <div class="ni-person__name">${esc(nombreCompleto(p))}</div>
              <div class="ni-person__sub">${esc(p.sirveEn)}</div>
              <div style="margin-top:6px"><span class="ni-pill">Sirve desde ${fechaCorta(p.desde)}</span></div>
            </div>
          </div>
          <div class="ni-person__acts">
            <a class="ni-btn ni-btn--gold ni-btn--sm" href="${waLink(p)}" target="_blank" rel="noopener" data-stop>💬 WhatsApp</a>
            <span class="ni-btn ni-btn--ghost ni-btn--sm">Ver perfil →</span>
          </div>
        </article>`).join("")}
      </div>`);
  }

  function modalPersona(id) {
    const p = N.equipo().find(x => x.id === id); if (!p) return;
    abrirModal(`
      <div class="ni-modal__head">
        <div class="ni-avatar ni-avatar--lg">${esc(iniciales(p))}</div>
        <div><h3 id="ni-modal-t">${esc(nombreCompleto(p))}</h3><div class="ni-muted">${esc(p.sirveEn)} · sirve desde ${fechaCorta(p.desde)}</div></div>
      </div>
      <div class="ni-deflist">
        <div><span>Área</span>${esc(p.sirveEn)}</div>
        <div><span>Correo</span>${esc(p.correo || "—")}</div>
        <div><span>Teléfono</span>${esc(p.telefono || "—")}</div>
      </div>
      <div class="ni-modal__acts">
        <a class="ni-btn ni-btn--gold" href="${waLink(p)}" target="_blank" rel="noopener">💬 WhatsApp</a>
        <a class="ni-btn ni-btn--ghost" href="${mailLink(p)}">✉️ Correo</a>
        <button class="ni-btn ni-btn--ghost" data-accion="cerrar-modal">Cerrar</button>
      </div>
    `);
  }

  /* ============================================================ 4. ORGANIGRAMA */
  function vistaOrganigrama() {
    const nodos = N.organigrama();
    const raices = nodos.filter(n => !n.parent);
    function render(nodo) {
      const hijos = nodos.filter(n => n.parent === nodo.id);
      return `<li>
        <div class="ni-org__node" data-id="${nodo.id}">
          <div class="ni-org__node-main"><b>${esc(nodo.nombre)}</b><span class="ni-org__rol">${esc(nodo.rol || "")}</span></div>
          <div class="ni-org__node-acts">
            <button class="ni-iconbtn" data-accion="org-add" data-id="${nodo.id}" title="Agregar debajo">＋</button>
            <button class="ni-iconbtn" data-accion="org-edit" data-id="${nodo.id}" title="Editar">✎</button>
            <button class="ni-iconbtn" data-accion="org-del" data-id="${nodo.id}" title="Quitar">✕</button>
          </div>
        </div>
        ${hijos.length ? `<ul>${hijos.map(render).join("")}</ul>` : ""}
      </li>`;
    }
    return shell(`
      <div class="ni-head">
        <div><h1 class="ni-h1">Organigrama de Nicodemo</h1>
        <p class="ni-lead">Arma tu equipo de seguimiento como un mapa: agrega, edita, mueve y quita responsables.</p></div>
        <button class="ni-btn ni-btn--primary" data-accion="org-add" data-id="">＋ Nodo raíz</button>
      </div>
      <div class="ni-orgwrap">
        ${raices.length ? `<ul class="ni-org">${raices.map(render).join("")}</ul>` : `<div class="ni-empty">Aún no hay nodos. Empieza agregando la coordinación.</div>`}
      </div>
      <p class="ni-note">💡 Con “✎ Editar” también puedes mover a una persona a otro responsable.</p>
    `);
  }

  function modalNodo(id, esEdicion) {
    const nodos = N.organigrama();
    const nodo = esEdicion ? nodos.find(n => n.id === id) : null;
    const ops = `<option value="">— Nadie (raíz) —</option>` + nodos.filter(n => !esEdicion || n.id !== id).map(n => `<option value="${n.id}" ${nodo && nodo.parent === n.id ? "selected" : ""}>${esc(n.nombre)} (${esc(n.rol || "")})</option>`).join("");
    abrirModal(`
      <h3 id="ni-modal-t">${esEdicion ? "Editar nodo" : "Nuevo nodo"}</h3>
      <label class="ni-field"><span>Nombre</span><input class="ni-input" id="ni-org-nombre" value="${nodo ? esc(nodo.nombre) : ""}" placeholder="Nombre de la persona"></label>
      <label class="ni-field"><span>Rol</span><input class="ni-input" id="ni-org-rol" value="${nodo ? esc(nodo.rol || "") : ""}" placeholder="Ej. Líder · Primer contacto"></label>
      <label class="ni-field" id="ni-org-parent-fld"><span>Depende de</span><select class="ni-select" id="ni-org-parent">${esEdicion ? ops : ""}</select></label>
      <div class="ni-modal__acts">
        <button class="ni-btn ni-btn--primary" data-accion="${esEdicion ? "org-save-edit" : "org-save-new"}" data-id="${id || ""}" data-parent="${esEdicion ? "" : (id || "")}">Guardar</button>
        <button class="ni-btn ni-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>
    `);
    if (!esEdicion) { const fld = document.getElementById("ni-org-parent-fld"); if (fld) fld.style.display = "none"; }
  }

  /* ============================================================ 5. PETICIONES */
  let filtroPet = "todas";
  function vistaPeticiones() {
    let pets = N.peticiones();
    if (filtroPet !== "todas") pets = pets.filter(p => p.estado === filtroPet);
    const todas = N.peticiones();
    const badge = { abierta: "var(--info)", orando: "var(--mostaza-600)", respondida: "var(--exito)" };
    const elbl = { abierta: "Abierta", orando: "Orando", respondida: "Respondida" };
    const tipoLbl = { equipo: "Equipo", nuevo: "Nuevo", lider: "Líder" };
    return shell(`
      <div class="ni-head">
        <div><h1 class="ni-h1">Peticiones de oración</h1>
        <p class="ni-lead">Lo que comparten el equipo y los nuevos que llegan. Acompañar también es interceder por cada persona.</p></div>
        <button class="ni-btn ni-btn--primary" data-accion="nueva-peticion">＋ Nueva petición</button>
      </div>
      <div class="ni-filtros">
        ${["todas", "abierta", "orando", "respondida"].map(f => `<button class="ni-filtro ${filtroPet === f ? "is-active" : ""}" data-accion="filtro-pet" data-f="${f}">${f === "todas" ? "Todas" : elbl[f]} ${f === "todas" ? `(${todas.length})` : `(${todas.filter(p => p.estado === f).length})`}</button>`).join("")}
      </div>
      <div class="ni-peticiones">
        ${pets.length ? pets.map(p => `<article class="ni-peticion">
          <div class="ni-peticion__head">
            <div><b>${esc(p.autor)}</b> <span class="ni-tag">${tipoLbl[p.autorTipo] || "Equipo"}</span></div>
            <span class="ni-estado" style="color:${badge[p.estado]};background:color-mix(in srgb, ${badge[p.estado]} 12%, white)">${elbl[p.estado]}</span>
          </div>
          <p class="ni-peticion__texto">${esc(p.texto)}</p>
          <div class="ni-peticion__foot">
            <span class="ni-muted">📅 ${fechaCorta(p.fecha)}</span>
            <div class="ni-peticion__acts">
              ${p.estado !== "orando" ? `<button class="ni-btn ni-btn--ghost ni-btn--sm" data-accion="estado-pet" data-id="${p.id}" data-e="orando">🙏 Orando</button>` : ""}
              ${p.estado !== "respondida" ? `<button class="ni-btn ni-btn--ok ni-btn--sm" data-accion="estado-pet" data-id="${p.id}" data-e="respondida">✓ Respondida</button>` : ""}
            </div>
          </div>
        </article>`).join("") : `<div class="ni-empty">No hay peticiones en este filtro.</div>`}
      </div>`);
  }

  function modalPeticion() {
    abrirModal(`
      <h3 id="ni-modal-t">Nueva petición</h3>
      <label class="ni-field"><span>Autor</span><input class="ni-input" id="ni-pet-autor" placeholder="Nombre" value="${esc(USER.nombre)}"></label>
      <label class="ni-field"><span>Petición</span><textarea class="ni-input" id="ni-pet-texto" rows="3" placeholder="¿Por qué oramos?"></textarea></label>
      <div class="ni-modal__acts">
        <button class="ni-btn ni-btn--primary" data-accion="guardar-peticion">Publicar</button>
        <button class="ni-btn ni-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>
    `);
  }

  /* ============================================================ 6. CALENDARIO */
  let calMes = null;
  function vistaCalendario() {
    const hoy = new Date();
    if (!calMes) calMes = { y: hoy.getFullYear(), m: hoy.getMonth() };
    const { y, m } = calMes;
    const primero = new Date(y, m, 1);
    let startDow = (primero.getDay() + 6) % 7;
    const dias = new Date(y, m + 1, 0).getDate();
    const eventos = N.eventos();
    const isoDe = d => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const hoyIso = hoy.toISOString().slice(0, 10);

    let celdas = "";
    for (let i = 0; i < startDow; i++) celdas += `<div class="ni-cal__cell is-empty"></div>`;
    for (let d = 1; d <= dias; d++) {
      const iso = isoDe(d);
      const evs = eventos.filter(e => e.fecha === iso);
      celdas += `<div class="ni-cal__cell ${iso === hoyIso ? "is-today" : ""}">
        <div class="ni-cal__day">${d}</div>
        ${evs.slice(0, 3).map(e => `<div class="ni-cal__ev ${e.mio ? "is-mio" : "is-otro"}" title="${esc(e.titulo)}">${esc(e.titulo)}</div>`).join("")}
        ${evs.length > 3 ? `<div class="ni-cal__more">+${evs.length - 3}</div>` : ""}
      </div>`;
    }

    const prox = eventos.filter(e => e.fecha >= hoyIso).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.horaInicio.localeCompare(b.horaInicio)).slice(0, 8);
    const espNom = id => { const e = NI.ESPACIOS.find(x => x.id === id); return e ? (e.ico + " " + e.nombre) : "—"; };
    const conflictos = detectarConflictos(eventos);

    return shell(`
      <div class="ni-head">
        <div><h1 class="ni-h1">Calendario y espacios</h1>
        <p class="ni-lead">Las jornadas de seguimiento, almuerzos de nuevos y cursos de bienvenida. Reserva espacios y coordina con los demás equipos.</p></div>
        <button class="ni-btn ni-btn--primary" data-accion="nuevo-evento">＋ Crear evento</button>
      </div>

      <div class="ni-callegend">
        <span><i class="dot mio"></i> Eventos de Nicodemo</span>
        <span><i class="dot otro"></i> Otros equipos</span>
      </div>

      ${conflictos.length ? `<div class="ni-alert">⚠️ ${conflictos.length} ${conflictos.length === 1 ? "choque de espacio detectado" : "choques de espacio detectados"}: ${conflictos.map(c => esc(c)).join(" · ")}</div>` : ""}

      <div class="ni-cal">
        <div class="ni-cal__bar">
          <button class="ni-iconbtn" data-accion="cal-prev" title="Mes anterior">‹</button>
          <b>${MESES_L[m][0].toUpperCase() + MESES_L[m].slice(1)} ${y}</b>
          <button class="ni-iconbtn" data-accion="cal-next" title="Mes siguiente">›</button>
        </div>
        <div class="ni-cal__dow">${DOW.map(d => `<div>${d}</div>`).join("")}</div>
        <div class="ni-cal__grid">${celdas}</div>
      </div>

      <h2 class="ni-h2">Próximos eventos</h2>
      <div class="ni-eventos">
        ${prox.length ? prox.map(e => `<article class="ni-evento ${e.mio ? "is-mio" : "is-otro"}">
          <div class="ni-evento__fecha"><b>${new Date(e.fecha + "T00:00").getDate()}</b><span>${MESES[new Date(e.fecha + "T00:00").getMonth()]}</span></div>
          <div class="ni-evento__body">
            <div class="ni-evento__top"><b>${esc(e.titulo)}</b> ${e.mio ? '<span class="ni-tag">Nicodemo</span>' : '<span class="ni-tag ni-tag--otro">Otro equipo</span>'}</div>
            <div class="ni-evento__meta">🕐 ${e.horaInicio}–${e.horaFin} · ${espNom(e.espacioId)}</div>
            ${e.desc ? `<div class="ni-muted">${esc(e.desc)}</div>` : ""}
          </div>
          ${e.mio ? `<button class="ni-iconbtn" data-accion="del-evento" data-id="${e.id}" title="Eliminar">✕</button>` : ""}
        </article>`).join("") : `<div class="ni-empty">No hay eventos próximos.</div>`}
      </div>
    `);
  }

  function detectarConflictos(eventos) {
    const out = [];
    for (let i = 0; i < eventos.length; i++) {
      for (let j = i + 1; j < eventos.length; j++) {
        const a = eventos[i], b = eventos[j];
        if (a.espacioId === b.espacioId && a.fecha === b.fecha && solapanH(a.horaInicio, a.horaFin, b.horaInicio, b.horaFin)) {
          const e = NI.ESPACIOS.find(x => x.id === a.espacioId);
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
    const ops = NI.ESPACIOS.map(e => `<option value="${e.id}">${e.ico} ${esc(e.nombre)} (cap. ${e.capacidad})</option>`).join("");
    abrirModal(`
      <h3 id="ni-modal-t">Crear evento</h3>
      <label class="ni-field"><span>Título</span><input class="ni-input" id="ni-ev-titulo" placeholder="Ej. Almuerzo de Nuevos"></label>
      <div class="ni-row2">
        <label class="ni-field"><span>Fecha</span><input class="ni-input" type="date" id="ni-ev-fecha" value="${hoyIso}"></label>
        <label class="ni-field"><span>Espacio</span><select class="ni-select" id="ni-ev-espacio">${ops}</select></label>
      </div>
      <div class="ni-row2">
        <label class="ni-field"><span>Inicio</span><input class="ni-input" type="time" id="ni-ev-inicio" value="18:00"></label>
        <label class="ni-field"><span>Fin</span><input class="ni-input" type="time" id="ni-ev-fin" value="20:00"></label>
      </div>
      <label class="ni-field"><span>Descripción</span><input class="ni-input" id="ni-ev-desc" placeholder="Opcional"></label>
      <div id="ni-ev-disp" class="ni-disp"></div>
      <div class="ni-modal__acts">
        <button class="ni-btn ni-btn--ghost" data-accion="ev-check">Ver disponibilidad</button>
        <button class="ni-btn ni-btn--primary" data-accion="guardar-evento">Reservar y crear</button>
        <button class="ni-btn ni-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>
    `);
  }
  function chequearDisp() {
    const fecha = val("ni-ev-fecha"), esp = val("ni-ev-espacio"), ini = val("ni-ev-inicio"), fin = val("ni-ev-fin");
    const box = document.getElementById("ni-ev-disp"); if (!box) return true;
    if (!fecha || !esp || !ini || !fin || aMin(fin) <= aMin(ini)) { box.innerHTML = `<div class="ni-disp__bad">Revisa fecha y horas (el fin debe ser después del inicio).</div>`; return false; }
    const libre = N.espacioLibre(esp, fecha, ini, fin);
    const e = NI.ESPACIOS.find(x => x.id === esp);
    box.innerHTML = libre
      ? `<div class="ni-disp__ok">✓ ${esc(e.nombre)} está libre el ${fechaCorta(fecha)} de ${ini} a ${fin}. Puedes reservarlo.</div>`
      : `<div class="ni-disp__bad">✕ ${esc(e.nombre)} ya está ocupado en ese horario. Elige otra hora o espacio.</div>`;
    return libre;
  }

  /* ============================================================ MODAL / TOAST */
  function abrirModal(html) {
    const wrap = document.getElementById("ni-modal");
    wrap.innerHTML = `<div class="ni-modalbg" id="ni-modalbg"><div class="ni-modal" role="dialog" aria-modal="true" aria-labelledby="ni-modal-t">${html}</div></div>`;
    const bg = document.getElementById("ni-modalbg");
    bg.addEventListener("click", e => { if (e.target.id === "ni-modalbg") cerrarModal(); });
    document.addEventListener("keydown", escClose);
  }
  function cerrarModal() { const w = document.getElementById("ni-modal"); if (w) w.innerHTML = ""; document.removeEventListener("keydown", escClose); }
  function escClose(e) { if (e.key === "Escape") cerrarModal(); }
  function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ""; }

  function toast(msg, ok) {
    const wrap = document.getElementById("ni-toasts");
    const el = document.createElement("div");
    el.className = "ni-toast" + (ok ? " ni-toast--ok" : "");
    el.innerHTML = `<span>${ok ? "✓" : "ℹ️"}</span><span>${esc(msg)}</span>`;
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateY(8px)"; setTimeout(() => el.remove(), 250); }, 3000);
  }

  /* ============================================================ RENDER */
  const VISTAS = {
    analitica: vistaAnalitica, bucket: vistaBucket, equipo: vistaEquipo,
    organigrama: vistaOrganigrama, peticiones: vistaPeticiones, calendario: vistaCalendario,
  };

  function render() {
    if (!sesion) { app().innerHTML = vistaLogin(); const g = document.getElementById("ni-google"); if (g) g.addEventListener("click", entrar); return; }
    const fn = VISTAS[vista] || vistaAnalitica;
    app().innerHTML = fn();
    if (!clickBound) { document.addEventListener("click", manejar); clickBound = true; }
    if (vista === "bucket") bindBucketSearch();
  }

  function bindBucketSearch() {
    const inp = document.getElementById("ni-bucket-search"); if (!inp) return;
    inp.addEventListener("input", () => { bucketQuery = inp.value.trim(); render(); reFocus("ni-bucket-search"); });
  }
  function reFocus(id) { const el = document.getElementById(id); if (el) { el.focus(); const v = el.value; el.value = ""; el.value = v; } }

  function entrar() { sesion = true; render(); toast(`¡Bienvenida, ${USER.nombre.split(" ")[0]}! 🌱`, true); }

  /* ============================================================ EVENTOS */
  function manejar(ev) {
    const stop = ev.target.closest("[data-stop]");
    const el = ev.target.closest("[data-accion]");
    if (!el) return;
    const a = el.dataset.accion;
    const id = el.dataset.id;

    switch (a) {
      case "salir": ev.preventDefault(); sesion = false; vista = "analitica"; render(); return;
      case "ir": ev.preventDefault(); vista = el.dataset.vista; window.scrollTo(0, 0); render(); return;

      /* analítica → bucket */
      case "kpi-bucket": ev.preventDefault(); bucketFiltro = el.dataset.f; bucketFunnel = "todos"; vista = "bucket"; window.scrollTo(0, 0); render(); return;
      case "kpi-funnel": ev.preventDefault(); bucketFunnel = el.dataset.f; bucketFiltro = "todos"; vista = "bucket"; window.scrollTo(0, 0); render(); return;
      case "ver-nuevo": ev.preventDefault(); modalNuevoDetalle(id); return;

      /* bucket */
      case "bucket-filtro": ev.preventDefault(); bucketFiltro = el.dataset.f; render(); return;
      case "bucket-funnel": ev.preventDefault(); bucketFunnel = el.dataset.f; render(); return;
      case "lider-habla": {
        ev.preventDefault();
        const val = N.toggleLiderHabla(id);
        render();
        toast(val ? "Marcado: su líder ya habla con esta persona ✓" : "Quitado: su líder aún no habla con ella", val);
        return;
      }
      case "asignar": ev.preventDefault(); modalAsignar(id); return;
      case "pick-min": {
        ev.preventDefault();
        asignarSel = el.dataset.min;
        document.querySelectorAll("#ni-mingrid .ni-minopt").forEach(b => b.classList.toggle("is-sel", b.dataset.min === asignarSel));
        return;
      }
      case "confirmar-asignar": {
        ev.preventDefault();
        if (!asignarSel) { toast("Elige un ministerio", false); return; }
        if (N.asignar(id, asignarSel)) { const nom = NI.nombreMinisterio(asignarSel); cerrarModal(); render(); toast(`Conectado a ${nom} ✓`, true); }
        return;
      }
      case "nuevo-registro": ev.preventDefault(); modalNuevoRegistro(); return;
      case "guardar-nuevo": {
        ev.preventDefault();
        const nombres = val("ni-nv-nombres"); if (!nombres) { toast("Escribe al menos el nombre", false); return; }
        const edad = parseInt(val("ni-nv-edad"), 10);
        N.addNuevo({
          nombres, apellidos: val("ni-nv-apellidos"), correo: val("ni-nv-correo"), telefono: val("ni-nv-tel"),
          edad: isNaN(edad) ? null : edad, funnel: val("ni-nv-funnel") || "domingo",
          fuenteDetalle: val("ni-nv-fuente") || "Registro manual", nota: val("ni-nv-nota"),
          ministerioInteres: "m_j25",
        });
        cerrarModal(); vista = "bucket"; bucketFiltro = "sin_contactar"; render();
        toast("Nuevo registrado en el bucket ✓", true); return;
      }

      /* equipo */
      case "ver-persona": if (stop) return; ev.preventDefault(); modalPersona(id); return;

      /* organigrama */
      case "org-add": ev.preventDefault(); modalNodo(id || "", false); return;
      case "org-edit": ev.preventDefault(); modalNodo(id, true); return;
      case "org-del": ev.preventDefault(); N.delNodo(id); render(); toast("Nodo quitado", false); return;
      case "org-save-new": {
        ev.preventDefault();
        const nombre = val("ni-org-nombre"); if (!nombre) { toast("Escribe un nombre", false); return; }
        N.addNodo(nombre, val("ni-org-rol"), el.dataset.parent || null); cerrarModal(); render(); toast("Nodo agregado ✓", true); return;
      }
      case "org-save-edit": {
        ev.preventDefault();
        const nombre = val("ni-org-nombre"); if (!nombre) { toast("Escribe un nombre", false); return; }
        const parentSel = document.getElementById("ni-org-parent");
        N.editNodo(id, { nombre, rol: val("ni-org-rol"), parent: parentSel ? (parentSel.value || null) : undefined });
        cerrarModal(); render(); toast("Nodo actualizado ✓", true); return;
      }

      /* peticiones */
      case "filtro-pet": ev.preventDefault(); filtroPet = el.dataset.f; render(); return;
      case "nueva-peticion": ev.preventDefault(); modalPeticion(); return;
      case "guardar-peticion": {
        ev.preventDefault();
        const texto = val("ni-pet-texto"); if (!texto) { toast("Escribe la petición", false); return; }
        N.addPeticion({ autor: val("ni-pet-autor") || USER.nombre, texto }); cerrarModal(); render(); toast("Petición publicada 🙏", true); return;
      }
      case "estado-pet": ev.preventDefault(); N.setEstadoPeticion(id, el.dataset.e); render(); toast(el.dataset.e === "respondida" ? "¡Respondida! 🎉" : "Marcada: orando 🙏", true); return;

      /* calendario */
      case "cal-prev": ev.preventDefault(); calMes = { y: calMes.m === 0 ? calMes.y - 1 : calMes.y, m: (calMes.m + 11) % 12 }; render(); return;
      case "cal-next": ev.preventDefault(); calMes = { y: calMes.m === 11 ? calMes.y + 1 : calMes.y, m: (calMes.m + 1) % 12 }; render(); return;
      case "nuevo-evento": ev.preventDefault(); modalEvento(); return;
      case "ev-check": ev.preventDefault(); chequearDisp(); return;
      case "guardar-evento": {
        ev.preventDefault();
        const titulo = val("ni-ev-titulo"); if (!titulo) { toast("Escribe un título", false); return; }
        if (!chequearDisp()) { toast("Ese espacio no está libre en ese horario", false); return; }
        N.addEvento({ titulo, fecha: val("ni-ev-fecha"), horaInicio: val("ni-ev-inicio"), horaFin: val("ni-ev-fin"), espacioId: val("ni-ev-espacio"), desc: val("ni-ev-desc") });
        cerrarModal(); render(); toast("Evento creado y espacio reservado ✓", true); return;
      }
      case "del-evento": ev.preventDefault(); N.delEvento(id); render(); toast("Evento eliminado", false); return;

      case "cerrar-modal": ev.preventDefault(); cerrarModal(); return;
    }
  }

  /* cambiar estado de un nuevo (select) */
  document.addEventListener("change", e => {
    const sel = e.target.closest('[data-accion="estado-nuevo"]');
    if (sel) {
      N.setEstado(sel.dataset.id, sel.value);
      render();
      toast(`Estado actualizado: ${ESTADOS[sel.value].lbl} ✓`, true);
    }
  });

  /* sincronización en vivo: STORE (landing/líder) y NSTORE */
  if (S && S.onCambio) S.onCambio(() => { if (sesion) render(); });
  if (N && N.onCambio) N.onCambio(() => { if (sesion) render(); });

  /* init */
  document.addEventListener("DOMContentLoaded", render);
  if (document.readyState !== "loading") render();
})();
