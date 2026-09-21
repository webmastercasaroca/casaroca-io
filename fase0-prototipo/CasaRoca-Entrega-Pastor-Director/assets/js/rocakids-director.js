/* ============================================================
   CASA ROCA · APP DEL DIRECTOR DE ROCAKIDS — Capa 2
   Demo: ministerio RocaKids (m_rocakids), director Germán Bahamón.
   Misma filosofía que el director de J+25 (clases .dr-) con acento
   violeta (.rk). Lee window.RKDIR (seed) y window.RKSTORE (estado),
   que comparte EN VIVO con la app del domingo: los check-in del
   domingo alimentan la analítica, el CRM y las peticiones.
   Sin frameworks. Vistas = funciones que devuelven HTML.
   ============================================================ */
(function () {
  const RK = window.RKDIR;
  const S = window.RKSTORE;
  const ETAPAS = RK.ETAPAS;
  const EQUIPOS_OP = RK.EQUIPOS_OP;
  const SERVICIOS = RK.SERVICIOS;
  const USER = RK.DIRECTOR_USER;

  let sesion = false;
  let vista = "analitica";
  let clickBound = false;
  let salonAbierto = null;
  let temDrill = null;
  let filtroPet = "todas";
  let calMes = null;
  let crmSort = "nombre", crmDir = 1, crmQuery = "", crmFiltro = "todas";

  /* ------------------------------------------------------------ utils */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const app = () => document.getElementById("dr-app");
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const MESES_L = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const DOW = ["L", "M", "X", "J", "V", "S", "D"];
  const CURSO_NOMBRES = { adn: "ADN", bautizo: "Bautizo", madurez: "Madurez Espiritual", llaves: "Llaves del Poder", ibli: "IBLI", facter: "FACTER" };

  const hoy = () => RK.hoyISO();
  function ninoNombre(n) { return `${n.nombres || ""} ${n.apellidos || ""}`.trim(); }
  function iniciales(p) { return (((p.nombres || "")[0] || "") + ((p.apellidos || "")[0] || "")).toUpperCase(); }
  function soloDigitos(t) { return String(t || "").replace(/\D/g, ""); }
  function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }
  function fechaCorta(iso) { if (!iso) return "—"; const d = new Date(iso + "T00:00"); return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`; }
  function fmtHora(ts) { return ts ? new Date(ts).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }) : "—"; }
  function diasDesde(iso) { if (!iso) return 9999; const d = new Date(iso); const h = new Date(); h.setHours(0, 0, 0, 0); return Math.round((h - d) / 86400000); }

  /* ----- enlaces correo / WhatsApp ----- */
  function waAcudiente(n) {
    const cel = soloDigitos(n.acudiente ? n.acudiente.celular : n.celular);
    const nom = (n.acudiente ? n.acudiente.nombre : "").split(" ")[0] || "";
    return `https://wa.me/${cel}?text=${encodeURIComponent("Hola " + nom + ", soy Germán, director de RocaKids 🙌 Gracias por confiarnos a " + (n.nombres || "tu pequeño/a") + ". ¿Cómo están?")}`;
  }
  function waServidor(p) {
    const nom = (p.nombres || "").split(" ")[0];
    return `https://wa.me/${soloDigitos(p.telefono)}?text=${encodeURIComponent("Hola " + nom + ", soy Germán (director RocaKids). ¡Gracias por servir! ¿Cómo vas?")}`;
  }
  function mailServidor(p) {
    const nom = (p.nombres || "").split(" ")[0];
    return `mailto:${p.correo}?subject=${encodeURIComponent("Hola desde RocaKids · Casa Roca")}&body=${encodeURIComponent("Hola " + nom + ",\n\nSoy Germán Bahamón, director de RocaKids. Quiero acompañarte de cerca.\n\nUn abrazo,\nGermán")}`;
  }

  /* ------------------------------------------ datos derivados */
  function censo() {
    let out = RK.NINOS.slice();
    ETAPAS.forEach(e => { out = out.concat(S.asignadosDe(e.id)); });
    return out;
  }
  function ninosDeEtapa(etId) { return censo().filter(n => n.etapa === etId); }
  function regsHoy() { return S.registrosDe(hoy()); }
  function presentesHoy() { return regsHoy().filter(r => r.estado === "presente"); }
  function coordDe(area) {
    const id = S.coordDe(area);
    return RK.COORDS.find(c => c.id === id) || RK.COORDS.find(c => c.area === area) || null;
  }
  function servidoresDe(area) { return S.equipo().filter(p => p.area === area); }

  /* ============================================================ LOGIN */
  function vistaLogin() {
    return `
    <div class="dr-login">
      <div class="dr-login__card">
        <div class="dr-login__logo rk-logo">RK</div>
        <h1>Dirección de RocaKids</h1>
        <p>Conoce, acompaña y rodea a cada niño y su familia. Entra para ver la asistencia dominical en vivo, los salones, tu equipo y la agenda.</p>
        <button class="dr-google" id="dr-google">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Continuar con Google
        </button>
        <div class="dr-login__nota">🔒 Demo Fase 0 — entrarás como <b>${esc(USER.nombre)}</b>, ${esc(USER.rol)}.</div>
      </div>
    </div>`;
  }

  /* ============================================================ SHELL */
  const NAV = [
    { id: "analitica", ico: "📊", lbl: "Analítica" },
    { id: "crm", ico: "🧒", lbl: "CRM niños" },
    { id: "salones", ico: "🏫", lbl: "Salones" },
    { id: "equipo", ico: "🤝", lbl: "Equipo" },
    { id: "nuevos", ico: "🌱", lbl: "Nuevos" },
    { id: "organigrama", ico: "🗂️", lbl: "Organigrama" },
    { id: "tematicas", ico: "📚", lbl: "Currículo" },
    { id: "peticiones", ico: "🙏", lbl: "Peticiones" },
    { id: "calendario", ico: "📅", lbl: "Calendario" },
  ];
  function shell(contenidoHTML) {
    return `
    <header class="dr-topbar">
      <div class="dr-brand">
        <div class="dr-brand__logo rk-logo">RK</div>
        <div class="dr-brand__txt"><b>Casa Roca</b><small>Dirección · RocaKids</small></div>
      </div>
      <div class="dr-topbar__sp"></div>
      <div class="dr-user">
        <div class="dr-user__name">${esc(USER.nombre)}<span>${esc(USER.rol)}</span></div>
        <div class="dr-avatar" title="${esc(USER.nombre)}">${esc(USER.iniciales)}</div>
        <button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="salir">Salir</button>
      </div>
    </header>
    <div class="dr-shell">
      <nav class="dr-nav" aria-label="Secciones de RocaKids">
        ${NAV.map(n => `<button class="dr-nav__item ${vista === n.id ? "is-active" : ""}" data-accion="ir" data-vista="${n.id}" ${vista === n.id ? 'aria-current="page"' : ""}>
          <span class="dr-nav__ic" aria-hidden="true">${n.ico}</span><span class="dr-nav__lbl">${n.lbl}</span></button>`).join("")}
      </nav>
      <main class="dr-main" id="main">${contenidoHTML}</main>
    </div>`;
  }

  /* ============================================================ helpers UI (gráficas) */
  const PALETA = ["var(--rk-morado)", "var(--mostaza-500)", "var(--exito)", "var(--azul-500)", "var(--peligro)", "var(--azul-400)", "var(--mostaza-300)"];
  function _card(title, sub, body) { return `<div class="dr-card"><h3 class="dr-card__t">${esc(title)}</h3>${sub ? `<p class="dr-card__sub">${sub}</p>` : ""}${body}</div>`; }
  function _legend(items, total) { return `<ul class="dr-legend">${items.map(s => `<li><i style="background:${s.color}"></i><span>${esc(s.lbl)}</span><b>${s.v}</b>${total ? `<em>${pct(s.v, total)}%</em>` : ""}</li>`).join("")}</ul>`; }
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
    return _card(title, sub, `<div class="dr-lollis">${rows.map(r => { const w = pct(r.v, max), c = colorFn ? colorFn(r) : "var(--rk-morado)"; return `<div class="dr-lolli"><div class="dr-lolli__lbl">${esc(r.lbl)}</div><div class="dr-lolli__track"><span class="dr-lolli__line" style="width:${w}%;background:${c}"></span><span class="dr-lolli__dot" style="left:${w}%;background:${c}"></span></div><div class="dr-lolli__v">${r.v}</div></div>`; }).join("")}</div>`);
  }
  function kpi(n, lbl, alerta) {
    return `<div class="dr-kpi ${alerta ? "is-alerta" : ""}"><div class="dr-kpi__n">${n}</div><div class="dr-kpi__l">${esc(lbl)}</div></div>`;
  }
  function etChip(etId) { const e = RK.etapa(etId); return `<span class="dr-chip" style="color:${e.color};background:color-mix(in srgb, ${e.color} 14%, white)">${e.emoji} ${esc(e.corto)}</span>`; }

  /* ============================================================ 1. ANALÍTICA */
  function vistaAnalitica() {
    const regs = regsHoy();
    const cen = censo();
    const presentes = presentesHoy().length;
    const entregados = regs.filter(r => r.estado === "entregado").length;
    const totalHoy = regs.length;
    const servidores = S.equipo().length;
    const peticionesHoy = regs.filter(r => r.peticion_oracion).length;
    const nuevosN = S.nuevos().length;

    // por servicio
    const filasSrv = SERVICIOS.map(s => ({ lbl: s.nombre.replace(" Servicio", ""), v: regs.filter(r => r.servicio === s.id).length }));
    // por etapa (hoy)
    const filasEt = ETAPAS.map(e => ({ lbl: e.corto, v: regs.filter(r => r.etapa === e.id).length, color: e.color }));
    // censo por etapa
    const filasCenso = ETAPAS.map(e => ({ lbl: e.corto, v: cen.filter(n => n.etapa === e.id).length, color: e.color }));
    // género del censo
    const fNinas = cen.filter(n => n.genero === "F").length, fNinos = cen.filter(n => n.genero === "M").length;
    // crecimiento histórico + hoy
    const hist = RK.HISTORIAL.map(h => ({ lbl: MESES[new Date(h.fecha + "T00:00").getMonth()] + " " + new Date(h.fecha + "T00:00").getDate(), v: h.total })).concat([{ lbl: "Hoy", v: totalHoy }]);
    // ocupación de salones (presentes vs capacidad)
    const filasOcup = ETAPAS.map(e => {
      const esp = { "sin-limites": "esp_sl", "1-4": "esp_14", "5-6": "esp_56", "7-8": "esp_78", "9-11": "esp_911" }[e.id];
      const cap = _ESPACIOS_CAP[esp] || 40;
      const pres = regs.filter(r => r.etapa === e.id && r.estado === "presente").length;
      return { lbl: e.corto, v: pct(pres, cap), color: e.color };
    });
    // entregados vs presentes
    const tasaEntrega = pct(entregados, totalHoy);
    // servidores por área
    const filasServ = ETAPAS.map(e => ({ lbl: e.corto, v: servidoresDe(e.id).length, color: e.color }))
      .concat(EQUIPOS_OP.map((o, i) => ({ lbl: o.nombre, v: servidoresDe(o.id).length, color: PALETA[i % PALETA.length] })));
    const edadProm = (() => { const ce = cen.filter(n => typeof n.edad === "number"); return ce.length ? Math.round(ce.reduce((s, n) => s + n.edad, 0) / ce.length) : "—"; })();

    return shell(`
      <div class="dr-head">
        <div><h1 class="dr-h1">Analítica de RocaKids</h1>
        <p class="dr-lead">La foto del domingo en vivo: cuántos niños tenemos hoy, por servicio y por etapa. Datos sincronizados con la app del domingo.</p></div>
        <span class="dr-tag rk-live">● En vivo · ${esc(new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" }))}</span>
      </div>

      <div class="dr-kpis">
        ${kpi(presentes, "Presentes ahora")}
        ${kpi(totalHoy, "Ingresos de hoy")}
        ${kpi(entregados, "Entregados")}
        ${kpi(cen.length, "Niños en el censo")}
        ${kpi(servidores, "Servidores")}
        ${kpi(ETAPAS.length, "Etapas")}
        ${kpi(peticionesHoy, "Peticiones hoy", peticionesHoy > 0)}
        ${kpi(nuevosN, "Nuevos por vincular", nuevosN > 0)}
      </div>

      <div class="dr-charts">
        ${columns("Asistencia por servicio (hoy)", `Total del día: ${totalHoy} niños`, filasSrv, () => "var(--rk-morado)")}
        ${columns("Asistencia por etapa (hoy)", "Distribución del domingo", filasEt, r => r.color)}
        ${lineArea("Crecimiento de asistencia", "Últimos domingos + hoy", hist, "var(--rk-morado)")}
        ${donut("Niñas vs. niños (censo)", `${fNinas} niñas · ${fNinos} niños`, [{ lbl: "Niñas", v: fNinas, color: "var(--mostaza-500)" }, { lbl: "Niños", v: fNinos, color: "var(--rk-morado)" }])}
        ${columns("Censo por etapa", `${cen.length} niños · edad promedio ${edadProm}${edadProm === "—" ? "" : " años"}`, filasCenso, r => r.color)}
        ${gauges("Ocupación de salones (hoy)", "Presentes sobre capacidad", filasOcup.map(r => ({ lbl: r.lbl, v: r.v, color: r.v >= 90 ? "var(--peligro)" : r.v >= 70 ? "var(--mostaza-500)" : "var(--exito)" })))}
        ${lollipop("Servidores por área", `${servidores} servidores en total`, filasServ.filter(r => r.v > 0), r => r.color)}
      </div>

      <div class="dr-grid2">
        <div class="dr-card">
          <h3 class="dr-card__t">Entrega segura</h3>
          <p class="dr-card__sub">Cada niño se entrega solo verificando la cédula del acudiente.</p>
          ${gauges("", "", [{ lbl: "Entregados", v: tasaEntrega, color: "var(--exito)" }, { lbl: "Aún en sala", v: pct(presentes, totalHoy), color: "var(--rk-morado)" }])}
        </div>
        <div class="dr-card">
          <h3 class="dr-card__t">🙏 Peticiones del domingo</h3>
          <p class="dr-card__sub">Recogidas en el ingreso de hoy.</p>
          <div class="dr-mini-list">
            ${regs.filter(r => r.peticion_oracion).slice(0, 6).map(r => `<div class="dr-mini-row"><span class="dr-mini-avatar">${esc((r.nombre_nino || "?")[0])}</span><div class="dr-mini-row__main"><b>${esc(r.nombre_nino)}</b><small>${esc(r.peticion_oracion)}</small></div></div>`).join("") || '<p class="dr-card__sub">Sin peticiones registradas hoy.</p>'}
          </div>
        </div>
      </div>

      <div class="dr-ia">
        <span class="dr-ia__badge">✦ Lectura IA</span>
        <p>Hoy han ingresado <b>${totalHoy}</b> niños y hay <b>${presentes}</b> en sala. La etapa con más asistencia es <b>${esc((filasEt.slice().sort((a, b) => b.v - a.v)[0] || {}).lbl || "—")}</b>. ${nuevosN > 0 ? `Tienes <b>${nuevosN}</b> niños nuevos por vincular a un salón.` : "No hay niños nuevos pendientes."} ${peticionesHoy > 0 ? `Se recogieron <b>${peticionesHoy}</b> peticiones de oración para acompañar a las familias.` : ""}</p>
      </div>
    `);
  }
  // capacidad de salones (para ocupación)
  const _ESPACIOS_CAP = { esp_sl: 20, esp_14: 40, esp_56: 45, esp_78: 45, esp_911: 50, esp_aud: 200 };

  /* ============================================================ 2. CRM */
  const CRM_COLS = [
    { id: "nombre", lbl: "Niño/a" }, { id: "etapa", lbl: "Etapa" }, { id: "edad", lbl: "Edad", num: true },
    { id: "genero", lbl: "Género" }, { id: "acudiente", lbl: "Acudiente" }, { id: "celular", lbl: "Celular" },
    { id: "ingreso", lbl: "Ingresó" }, { id: "hoy", lbl: "Hoy" },
  ];
  function crmValor(n, col) {
    switch (col) {
      case "nombre": return ninoNombre(n).toLowerCase();
      case "etapa": return n.etapa || "";
      case "edad": return n.edad || 0;
      case "genero": return n.genero || "";
      case "acudiente": return (n.acudiente ? n.acudiente.nombre : "").toLowerCase();
      case "ingreso": return n.fechaIngreso || "";
      default: return "";
    }
  }
  function presenteHoyNombre(nombre) { return regsHoy().some(r => r.nombre_nino.toLowerCase() === nombre.toLowerCase()); }
  function vistaCRM() {
    let lista = censo();
    if (crmFiltro !== "todas") lista = lista.filter(n => n.etapa === crmFiltro);
    lista.sort((a, b) => { const va = crmValor(a, crmSort), vb = crmValor(b, crmSort); return (va < vb ? -1 : va > vb ? 1 : 0) * crmDir; });
    const cen = censo();

    const filas = lista.map(n => {
      const ac = n.acudiente || {};
      const here = presenteHoyNombre(ninoNombre(n));
      const search = `${ninoNombre(n)} ${ac.nombre || ""} ${ac.celular || ""} ${RK.etapa(n.etapa).corto}`.toLowerCase();
      return `<tr data-search="${esc(search)}" data-accion="ver-nino" data-id="${n.id}" class="dr-trclick">
        <td><div class="dr-cell-name"><span class="dr-mini-avatar">${esc(iniciales(n))}</span><b>${esc(ninoNombre(n))}</b></div></td>
        <td>${etChip(n.etapa)}</td>
        <td>${n.edad || "—"}</td>
        <td>${n.genero === "F" ? "Niña" : "Niño"}</td>
        <td>${esc(ac.nombre || "—")}<small class="dr-muted"> · ${esc(ac.parentesco || "")}</small></td>
        <td>${esc(ac.celular || "—")}</td>
        <td>${fechaCorta(n.fechaIngreso)}</td>
        <td>${here ? '<span class="dr-chip" style="color:var(--exito);background:var(--exito-bg)">🟢 Sí</span>' : '<span class="dr-muted">—</span>'}</td>
      </tr>`;
    }).join("");

    return shell(`
      <div class="dr-head">
        <div><h1 class="dr-h1">CRM de niños y familias</h1>
        <p class="dr-lead">El censo completo de RocaKids con su acudiente. Toca una fila para ver el perfil 360°.</p></div>
      </div>
      <div class="dr-toolbar">
        <input class="dr-input" id="dr-crm-search" placeholder="🔍 Buscar niño, acudiente, teléfono…" />
        <div class="dr-filtros">
          <button class="dr-pill ${crmFiltro === "todas" ? "is-on" : ""}" data-accion="crm-filtro" data-f="todas">Todas</button>
          ${ETAPAS.map(e => `<button class="dr-pill ${crmFiltro === e.id ? "is-on" : ""}" data-accion="crm-filtro" data-f="${e.id}">${e.emoji} ${esc(e.corto)}</button>`).join("")}
        </div>
      </div>
      <p class="dr-muted">Mostrando <b id="dr-crm-count">${lista.length}</b> de ${cen.length} niños.</p>
      <div class="dr-tablewrap"><table class="dr-table dr-table--hover">
        <thead><tr>${CRM_COLS.map(c => `<th data-accion="crm-sort" data-col="${c.id}" class="dr-th-sort ${crmSort === c.id ? "is-sorted" : ""}">${c.lbl}${crmSort === c.id ? (crmDir > 0 ? " ▲" : " ▼") : ""}</th>`).join("")}</tr></thead>
        <tbody id="dr-crm-body">${filas}</tbody>
      </table></div>
    `);
  }
  function modalNino(id) {
    const n = censo().find(x => x.id === id); if (!n) return;
    const ac = n.acudiente || {}, e = RK.etapa(n.etapa);
    const visitas = S.registros().filter(r => r.nombre_nino.toLowerCase() === ninoNombre(n).toLowerCase());
    abrirModal(`
      <div class="dr-modal__head"><div class="dr-avatar dr-avatar--lg" style="background:${e.color}">${esc(iniciales(n))}</div>
        <div><h3 id="dr-modal-t">${esc(ninoNombre(n))}</h3><p class="dr-card__sub">${e.emoji} ${esc(e.nombre)} · ${n.edad || "—"} años</p></div></div>
      <div class="dr-why"><span>Acudiente</span><p><b>${esc(ac.nombre || "—")}</b> (${esc(ac.parentesco || "—")}) · 📱 ${esc(ac.celular || "—")} · 🪪 ${esc(ac.cedula || "—")}</p></div>
      <div class="dr-why"><span>Vinculación</span><p>Ingresó el ${fechaCorta(n.fechaIngreso)} · ${esc(n.fuente || "—")}</p></div>
      ${n.nota ? `<div class="dr-why"><span>⚠️ Nota importante</span><p>${esc(n.nota)}</p></div>` : ""}
      <div class="dr-why"><span>Historial de asistencia</span><p>${visitas.length ? visitas.slice(0, 6).map(v => `${fechaCorta(v.fecha)} · ${RK.servicio(v.servicio).nombre} (${v.estado})`).join("<br>") : "Sin registros aún."}</p></div>
      <div class="dr-modal__acts">
        <a class="dr-btn dr-btn--primary" href="${waAcudiente(n)}" target="_blank" rel="noopener">💬 WhatsApp al acudiente</a>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cerrar</button>
      </div>`);
  }

  /* ============================================================ 3. SALONES (etapas) */
  function vistaSalones() {
    if (salonAbierto) return vistaSalonDetalle(salonAbierto);
    const regs = regsHoy();
    return shell(`
      <div class="dr-head">
        <div><h1 class="dr-h1">Salones por etapa</h1>
        <p class="dr-lead">Cada etapa tiene su coordinador, su salón y su equipo. Toca para ver el detalle.</p></div>
      </div>
      <div class="dr-grid2">
        ${ETAPAS.map(e => {
          const co = coordDe(e.id);
          const cen = ninosDeEtapa(e.id).length;
          const pres = regs.filter(r => r.etapa === e.id && r.estado === "presente").length;
          const serv = servidoresDe(e.id).length;
          return `<button class="dr-card dr-card--click rk-salon" data-accion="abrir-salon" data-id="${e.id}" style="--ec:${e.color}">
            <div class="rk-salon__head"><span class="rk-salon__ic" style="background:${e.bg};color:${e.color}">${e.emoji}</span>
              <div><b>${esc(e.nombre)}</b><small>${esc(e.rango)}</small></div></div>
            <div class="rk-salon__stats"><span><b>${cen}</b> en censo</span><span><b>${pres}</b> hoy</span><span><b>${serv}</b> servidores</span></div>
            <div class="rk-salon__coord">👤 Coord.: <b>${esc(co ? co.nombre : "—")}</b></div>
          </button>`;
        }).join("")}
      </div>
    `);
  }
  function vistaSalonDetalle(etId) {
    const e = RK.etapa(etId);
    const co = coordDe(etId);
    const ninos = ninosDeEtapa(etId);
    const regs = regsHoy().filter(r => r.etapa === etId);
    const serv = servidoresDe(etId);
    const opciones = RK.COORDS.map(c => `<option value="${c.id}" ${co && c.id === co.id ? "selected" : ""}>${esc(c.nombre)}</option>`).join("");
    return shell(`
      <button class="dr-back" data-accion="cerrar-salon">← Volver a salones</button>
      <div class="dr-head">
        <div><h1 class="dr-h1">${e.emoji} ${esc(e.nombre)}</h1>
        <p class="dr-lead">${esc(e.rango)} · ${ninos.length} niños en el censo · ${regs.filter(r => r.estado === "presente").length} presentes hoy.</p></div>
      </div>
      <div class="dr-card">
        <h3 class="dr-card__t">Coordinador del salón</h3>
        <div class="dr-reasignar">
          <label class="dr-field"><span>Asignar coordinador</span>
            <select class="dr-select" data-accion="reasignar-coord" data-area="${etId}">${opciones}</select></label>
          ${co ? `<a class="dr-btn dr-btn--ghost dr-btn--sm" href="https://wa.me/${soloDigitos(co.tel)}" target="_blank" rel="noopener">💬 WhatsApp</a>` : ""}
        </div>
      </div>
      <div class="dr-grid2">
        <div class="dr-card">
          <h3 class="dr-card__t">Servidores del salón (${serv.length})</h3>
          <div class="dr-mini-list">
            ${serv.length ? serv.map(p => `<div class="dr-mini-row" data-accion="ver-servidor" data-id="${p.id}"><span class="dr-mini-avatar">${esc(iniciales(p))}</span><div class="dr-mini-row__main"><b>${esc(ninoNombre(p))}</b><small>Sirve desde ${fechaCorta(p.desde)}</small></div></div>`).join("") : '<p class="dr-card__sub">Aún sin servidores asignados.</p>'}
          </div>
        </div>
        <div class="dr-card">
          <h3 class="dr-card__t">Presentes hoy (${regs.filter(r => r.estado === "presente").length})</h3>
          <div class="dr-mini-list">
            ${regs.length ? regs.map(r => `<div class="dr-mini-row"><span class="dr-mini-avatar" style="background:${e.color}">${esc(r.numero_manilla)}</span><div class="dr-mini-row__main"><b>${esc(r.nombre_nino)}</b><small>👤 ${esc(r.nombre_adulto)} · ${r.estado === "presente" ? "🟢 en sala" : "✅ entregado"}</small></div></div>`).join("") : '<p class="dr-card__sub">Nadie ha ingresado a este salón hoy.</p>'}
          </div>
        </div>
      </div>
      <div class="dr-card">
        <h3 class="dr-card__t">Censo del salón (${ninos.length})</h3>
        <div class="dr-tablewrap"><table class="dr-table dr-table--hover">
          <thead><tr><th>Niño/a</th><th>Edad</th><th>Acudiente</th><th>Celular</th><th></th></tr></thead>
          <tbody>${ninos.map(n => { const ac = n.acudiente || {}; return `<tr data-accion="ver-nino" data-id="${n.id}" class="dr-trclick"><td><b>${esc(ninoNombre(n))}</b></td><td>${n.edad || "—"}</td><td>${esc(ac.nombre || "—")}</td><td>${esc(ac.celular || "—")}</td><td>›</td></tr>`; }).join("")}</tbody>
        </table></div>
      </div>
    `);
  }

  /* ============================================================ 4. EQUIPO */
  function vistaEquipo() {
    const equipo = S.equipo();
    const porEtapa = ETAPAS.map(e => ({ e, gente: equipo.filter(p => p.area === e.id) }));
    const porOp = EQUIPOS_OP.map(o => ({ o, gente: equipo.filter(p => p.area === o.id) }));
    return shell(`
      <div class="dr-head">
        <div><h1 class="dr-h1">Equipo de servidores</h1>
        <p class="dr-lead">Quienes hacen posible cada domingo: coordinadores de etapa y los equipos operativos. ${equipo.length} servidores.</p></div>
      </div>
      <h2 class="dr-h2">Por etapa</h2>
      <div class="dr-grid2">
        ${porEtapa.map(({ e, gente }) => `<div class="dr-card" style="--ec:${e.color}">
          <h3 class="dr-card__t">${e.emoji} ${esc(e.corto)} <span class="dr-tag">${gente.length}</span></h3>
          <div class="dr-mini-list">${gente.length ? gente.map(p => srvRow(p)).join("") : '<p class="dr-card__sub">Sin servidores.</p>'}</div>
        </div>`).join("")}
      </div>
      <h2 class="dr-h2">Equipos operativos</h2>
      <div class="dr-grid2">
        ${porOp.map(({ o, gente }) => `<div class="dr-card">
          <h3 class="dr-card__t">${o.emoji} ${esc(o.nombre)} <span class="dr-tag">${gente.length}</span></h3>
          <div class="dr-mini-list">${gente.length ? gente.map(p => srvRow(p)).join("") : '<p class="dr-card__sub">Sin servidores.</p>'}</div>
        </div>`).join("")}
      </div>
    `);
  }
  function srvRow(p) {
    return `<div class="dr-mini-row" data-accion="ver-servidor" data-id="${p.id}"><span class="dr-mini-avatar">${esc(iniciales(p))}</span><div class="dr-mini-row__main"><b>${esc(ninoNombre(p))}</b><small>${(p.cursos || []).map(c => CURSO_NOMBRES[c] || c).join(" · ") || "En formación"}</small></div><span class="dr-go">›</span></div>`;
  }
  function modalServidor(id) {
    const p = S.equipo().find(x => x.id === id); if (!p) return;
    const area = RK.areaNombre(p.area);
    abrirModal(`
      <div class="dr-modal__head"><div class="dr-avatar dr-avatar--lg">${esc(iniciales(p))}</div>
        <div><h3 id="dr-modal-t">${esc(ninoNombre(p))}</h3><p class="dr-card__sub">${esc(area)} · ${p.genero === "F" ? "Mujer" : "Hombre"}</p></div></div>
      <div class="dr-why"><span>Servicio</span><p>Sirve en <b>${esc(area)}</b> desde ${fechaCorta(p.desde)}.</p></div>
      <div class="dr-why"><span>Contacto</span><p>📱 ${esc(p.telefono)} · ✉️ ${esc(p.correo)}</p></div>
      <div class="dr-why"><span>Formación</span><p>${(p.cursos || []).map(c => CURSO_NOMBRES[c] || c).join(" · ") || "Aún sin cursos registrados."}</p></div>
      <div class="dr-modal__acts">
        <a class="dr-btn dr-btn--primary" href="${waServidor(p)}" target="_blank" rel="noopener">💬 WhatsApp</a>
        <a class="dr-btn dr-btn--ghost" href="${mailServidor(p)}">✉️ Correo</a>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cerrar</button>
      </div>`);
  }

  /* ============================================================ 5. NUEVOS */
  function vistaNuevos() {
    const nuevos = S.nuevos();
    return shell(`
      <div class="dr-head">
        <div><h1 class="dr-h1">Niños nuevos</h1>
        <p class="dr-lead">Primeras visitas por acompañar y vincular a un salón. La prioridad de la bienvenida.</p></div>
      </div>
      ${nuevos.length ? `<div class="dr-grid2">${nuevos.map(n => { const ac = n.acudiente || {}; const e = RK.etapa(n.etapa); return `
        <div class="dr-card" style="--ec:${e.color}">
          <div class="dr-mini-row"><span class="dr-mini-avatar" style="background:${e.color}">${esc(iniciales(n))}</span>
            <div class="dr-mini-row__main"><b>${esc(ninoNombre(n))}</b><small>${e.emoji} ${esc(e.corto)} · ${n.edad || "—"} años</small></div></div>
          <p class="dr-card__sub">👤 ${esc(ac.nombre || "—")} (${esc(ac.parentesco || "")}) · 📱 ${esc(ac.celular || "—")}</p>
          ${n.nota ? `<p class="dr-muted">📝 ${esc(n.nota)}</p>` : ""}
          <p class="dr-muted">Llegó: ${fechaCorta(n.fechaIngreso)}</p>
          <div class="dr-modal__acts">
            <button class="dr-btn dr-btn--primary dr-btn--sm" data-accion="vincular" data-id="${n.id}">Vincular a salón</button>
            <a class="dr-btn dr-btn--ghost dr-btn--sm" href="${waAcudiente(n)}" target="_blank" rel="noopener">💬 WhatsApp</a>
          </div>
        </div>`; }).join("")}</div>` : `<div class="dr-empty">🎉 ¡No hay niños nuevos pendientes! Todos están vinculados.</div>`}
    `);
  }
  function modalVincular(id) {
    const n = S.nuevos().find(x => x.id === id); if (!n) return;
    const ops = ETAPAS.map(e => `<option value="${e.id}" ${e.id === n.etapa ? "selected" : ""}>${e.emoji} ${esc(e.nombre)} (${esc(e.rango)})</option>`).join("");
    abrirModal(`
      <h3 id="dr-modal-t">Vincular a ${esc(ninoNombre(n))}</h3>
      <p class="dr-card__sub">Asígnalo a un salón según su edad. Pasará al censo del salón.</p>
      <label class="dr-field"><span>Salón / etapa</span><select class="dr-select" id="dr-vinc-sel">${ops}</select></label>
      <div class="dr-modal__acts">
        <button class="dr-btn dr-btn--primary" data-accion="confirmar-vincular" data-id="${id}">Vincular</button>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>`);
  }

  /* ============================================================ 6. ORGANIGRAMA */
  function vistaOrganigrama() {
    const nodos = S.organigrama();
    function render(nodo) {
      const hijos = nodos.filter(n => n.parent === nodo.id);
      return `<li>
        <div class="dr-org__node">
          <div class="dr-org__name">${esc(nodo.nombre)}</div>
          <div class="dr-org__rol">${esc(nodo.rol || "")}</div>
          <div class="dr-org__acts">
            <button class="dr-iconbtn" data-accion="org-add" data-id="${nodo.id}" title="Agregar debajo">＋</button>
            <button class="dr-iconbtn" data-accion="org-edit" data-id="${nodo.id}" title="Editar">✎</button>
            ${nodo.parent ? `<button class="dr-iconbtn" data-accion="org-del" data-id="${nodo.id}" title="Quitar">✕</button>` : ""}
          </div>
        </div>
        ${hijos.length ? `<ul>${hijos.map(render).join("")}</ul>` : ""}
      </li>`;
    }
    const raices = nodos.filter(n => !n.parent);
    return shell(`
      <div class="dr-head">
        <div><h1 class="dr-h1">Organigrama de RocaKids</h1>
        <p class="dr-lead">El mapa del equipo: dirección, coordinaciones de etapa y equipos operativos. Editable.</p></div>
        <button class="dr-btn dr-btn--primary" data-accion="org-add" data-id="">＋ Agregar nodo</button>
      </div>
      <div class="dr-orgwrap"><ul class="dr-org">${raices.map(render).join("")}</ul></div>
    `);
  }
  function modalNodo(id, esEdit) {
    const nodos = S.organigrama();
    const nodo = esEdit ? nodos.find(n => n.id === id) : null;
    const ops = `<option value="">— Raíz —</option>` + nodos.filter(n => !esEdit || n.id !== id).map(n => `<option value="${n.id}" ${nodo && nodo.parent === n.id ? "selected" : ""}>${esc(n.nombre)}</option>`).join("");
    abrirModal(`
      <h3 id="dr-modal-t">${esEdit ? "Editar nodo" : "Agregar nodo"}</h3>
      <label class="dr-field"><span>Nombre</span><input class="dr-input" id="dr-org-nombre" value="${nodo ? esc(nodo.nombre) : ""}" placeholder="Nombre de la persona/área"></label>
      <label class="dr-field"><span>Rol</span><input class="dr-input" id="dr-org-rol" value="${nodo ? esc(nodo.rol || "") : ""}" placeholder="Ej. Coord. 5–6"></label>
      ${esEdit ? `<label class="dr-field"><span>Depende de</span><select class="dr-select" id="dr-org-parent">${ops}</select></label>` : ""}
      <div class="dr-modal__acts">
        <button class="dr-btn dr-btn--primary" data-accion="${esEdit ? "org-save-edit" : "org-save-new"}" data-id="${id}" data-parent="${esEdit ? "" : (id || "")}">Guardar</button>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>`);
  }

  /* ============================================================ 7. CURRÍCULO / TEMÁTICAS */
  function vistaTematicas() {
    if (temDrill) return vistaTematicaDetalle();
    const tems = S.tematicas();
    return shell(`
      <div class="dr-head">
        <div><h1 class="dr-h1">Currículo y temáticas</h1>
        <p class="dr-lead">Las series, guías y material que usan los salones cada domingo.</p></div>
        <button class="dr-btn dr-btn--primary" data-accion="nueva-tematica">＋ Nueva temática</button>
      </div>
      <div class="dr-grid2">
        ${tems.map(t => `<div class="dr-card dr-card--click" data-accion="ver-tematica" data-id="${t.id}">
          <div class="dr-tem"><span class="dr-tem__ic">${t.ico || "📚"}</span>
            <div><b>${esc(t.titulo)}</b><small>${esc(t.tipo)} · ${esc(t.dirigidoA)}</small></div></div>
          <p class="dr-card__sub">${esc(t.desc || "")}</p>
          <p class="dr-muted">${(t.docs || []).length} documento(s) · ${fechaCorta(t.fecha)}</p>
        </div>`).join("")}
      </div>
    `);
  }
  function vistaTematicaDetalle() {
    const t = S.tematica(temDrill); if (!t) { temDrill = null; return vistaTematicas(); }
    return shell(`
      <button class="dr-back" data-accion="tem-volver">← Volver al currículo</button>
      <div class="dr-head">
        <div><h1 class="dr-h1">${t.ico || "📚"} ${esc(t.titulo)}</h1>
        <p class="dr-lead">${esc(t.tipo)} · dirigido a ${esc(t.dirigidoA)}. ${esc(t.desc || "")}</p></div>
        <div>
          <button class="dr-btn dr-btn--primary" data-accion="subir-doc" data-id="${t.id}">⬆ Subir documento</button>
          <button class="dr-btn dr-btn--ghost" data-accion="del-tematica" data-id="${t.id}">Eliminar</button>
        </div>
      </div>
      <div class="dr-card">
        <h3 class="dr-card__t">Documentos (${(t.docs || []).length})</h3>
        ${(t.docs || []).length ? `<div class="dr-mini-list">${t.docs.map(d => `<div class="dr-mini-row"><span class="dr-mini-avatar">📄</span><div class="dr-mini-row__main"><b>${esc(d.nombre || d.archivo)}</b><small>${esc(d.nota || "")} · ${fechaCorta(d.fecha)} · por ${esc(d.por || "—")}</small></div>
          <button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="ver-doc" data-tem="${t.id}" data-id="${d.id}">Ver</button>
          <button class="dr-iconbtn" data-accion="del-doc" data-tem="${t.id}" data-id="${d.id}" title="Quitar">✕</button></div>`).join("")}</div>` : '<p class="dr-card__sub">Aún no hay documentos. Sube guías, presentaciones o manualidades.</p>'}
      </div>
    `);
  }
  function modalTematica() {
    abrirModal(`
      <h3 id="dr-modal-t">Nueva temática</h3>
      <label class="dr-field"><span>Título</span><input class="dr-input" id="dr-tem-titulo" placeholder="Ej. Héroes de la Biblia"></label>
      <label class="dr-field"><span>Descripción</span><input class="dr-input" id="dr-tem-desc" placeholder="De qué trata"></label>
      <div class="dr-row2">
        <label class="dr-field"><span>Tipo</span><input class="dr-input" id="dr-tem-tipo" placeholder="Serie / Guía / Currículo"></label>
        <label class="dr-field"><span>Dirigido a</span><input class="dr-input" id="dr-tem-dir" placeholder="Etapa(s)"></label>
      </div>
      <label class="dr-field"><span>Emoji</span><input class="dr-input" id="dr-tem-ico" placeholder="📚" maxlength="2"></label>
      <div class="dr-modal__acts">
        <button class="dr-btn dr-btn--primary" data-accion="guardar-tematica">Crear</button>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>`);
  }
  function modalSubirDoc(id) {
    abrirModal(`
      <h3 id="dr-modal-t">Subir documento</h3>
      <label class="dr-field"><span>Archivo</span><input class="dr-input" type="file" id="dr-doc-archivo"></label>
      <label class="dr-field"><span>Nombre visible</span><input class="dr-input" id="dr-doc-nombre" placeholder="Ej. Guía del maestro — semana 1"></label>
      <label class="dr-field"><span>Nota</span><input class="dr-input" id="dr-doc-nota" placeholder="Opcional"></label>
      <div class="dr-modal__acts">
        <button class="dr-btn dr-btn--primary" data-accion="guardar-doc" data-id="${id}">Subir</button>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>`);
  }

  /* ============================================================ 8. PETICIONES */
  function vistaPeticiones() {
    const delDomingo = regsHoy().filter(r => r.peticion_oracion).map(r => ({ id: "reg_" + r.id, autor: r.nombre_adulto + " (familia de " + r.nombre_nino + ")", autorTipo: "domingo", texto: r.peticion_oracion, fecha: r.fecha, estado: "abierta" }));
    let lista = S.peticiones();
    if (filtroPet !== "todas") lista = lista.filter(p => p.estado === filtroPet);
    return shell(`
      <div class="dr-head">
        <div><h1 class="dr-h1">Peticiones de oración</h1>
        <p class="dr-lead">Las del ministerio y las que las familias dejan al ingresar el domingo. Oramos por cada una.</p></div>
        <button class="dr-btn dr-btn--primary" data-accion="nueva-peticion">＋ Nueva petición</button>
      </div>
      ${delDomingo.length ? `<div class="dr-card rk-domingo">
        <h3 class="dr-card__t">🟣 Del domingo (en vivo) · ${delDomingo.length}</h3>
        <div class="dr-mini-list">${delDomingo.map(p => `<div class="dr-peticion"><div class="dr-peticion__top"><b>${esc(p.autor)}</b><span class="dr-tag">Domingo</span></div><p>${esc(p.texto)}</p></div>`).join("")}</div>
      </div>` : ""}
      <div class="dr-filtros">
        ${[["todas", "Todas"], ["abierta", "Abiertas"], ["orando", "Orando"], ["respondida", "Respondidas"]].map(([f, l]) => `<button class="dr-pill ${filtroPet === f ? "is-on" : ""}" data-accion="filtro-pet" data-f="${f}">${l}</button>`).join("")}
      </div>
      <div class="dr-peticiones">
        ${lista.length ? lista.map(p => `<div class="dr-peticion is-${p.estado}">
          <div class="dr-peticion__top"><b>${esc(p.autor)}</b><span class="dr-estado dr-estado--${p.estado}">${p.estado}</span></div>
          <p>${esc(p.texto)}</p>
          <div class="dr-peticion__acts">
            <span class="dr-muted">${fechaCorta(p.fecha)}</span>
            ${p.estado !== "orando" ? `<button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="estado-pet" data-id="${p.id}" data-e="orando">🙏 Orando</button>` : ""}
            ${p.estado !== "respondida" ? `<button class="dr-btn dr-btn--primary dr-btn--sm" data-accion="estado-pet" data-id="${p.id}" data-e="respondida">✓ Respondida</button>` : ""}
          </div>
        </div>`).join("") : '<div class="dr-empty">No hay peticiones con este filtro.</div>'}
      </div>
    `);
  }
  function modalPeticion() {
    abrirModal(`
      <h3 id="dr-modal-t">Nueva petición</h3>
      <label class="dr-field"><span>Autor</span><input class="dr-input" id="dr-pet-autor" placeholder="${esc(USER.nombre)}"></label>
      <label class="dr-field"><span>Petición</span><textarea class="dr-input" id="dr-pet-texto" rows="3" placeholder="Escribe la petición de oración"></textarea></label>
      <div class="dr-modal__acts">
        <button class="dr-btn dr-btn--primary" data-accion="guardar-peticion">Publicar</button>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>`);
  }

  /* ============================================================ 9. CALENDARIO */
  function vistaCalendario() {
    const h = new Date();
    if (!calMes) calMes = { y: h.getFullYear(), m: h.getMonth() };
    const { y, m } = calMes;
    const primero = new Date(y, m, 1);
    let startDow = (primero.getDay() + 6) % 7;
    const dias = new Date(y, m + 1, 0).getDate();
    const eventos = S.eventos();
    const isoDe = d => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const hoyIso = h.toISOString().slice(0, 10);
    let celdas = "";
    for (let i = 0; i < startDow; i++) celdas += `<div class="dr-cal__cell is-empty"></div>`;
    for (let d = 1; d <= dias; d++) {
      const iso = isoDe(d);
      const evs = eventos.filter(e => e.fecha === iso);
      celdas += `<div class="dr-cal__cell ${iso === hoyIso ? "is-today" : ""}"><div class="dr-cal__day">${d}</div>
        ${evs.slice(0, 3).map(e => `<div class="dr-cal__ev ${e.mio ? "is-mio" : "is-otro"}" title="${esc(e.titulo)}">${esc(e.titulo)}</div>`).join("")}
        ${evs.length > 3 ? `<div class="dr-cal__more">+${evs.length - 3}</div>` : ""}</div>`;
    }
    const prox = eventos.filter(e => e.fecha >= hoyIso).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.horaInicio.localeCompare(b.horaInicio)).slice(0, 8);
    const espNom = id => { const e = _ESPACIOS().find(x => x.id === id); return e ? (e.ico + " " + e.nombre) : "—"; };
    return shell(`
      <div class="dr-head">
        <div><h1 class="dr-h1">Calendario y salones</h1>
        <p class="dr-lead">Servicios, capacitaciones y eventos de RocaKids. Reserva salones por horas.</p></div>
        <button class="dr-btn dr-btn--primary" data-accion="nuevo-evento">＋ Crear evento</button>
      </div>
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
            <div class="dr-evento__top"><b>${esc(e.titulo)}</b> ${e.mio ? '<span class="dr-tag">RocaKids</span>' : '<span class="dr-tag dr-tag--otro">Otro</span>'}</div>
            <div class="dr-evento__meta">🕐 ${e.horaInicio}–${e.horaFin} · ${espNom(e.espacioId)}</div>
            ${e.desc ? `<div class="dr-muted">${esc(e.desc)}</div>` : ""}
          </div>
          ${e.mio ? `<button class="dr-iconbtn" data-accion="del-evento" data-id="${e.id}" title="Eliminar">✕</button>` : ""}
        </article>`).join("") : `<div class="dr-empty">No hay eventos próximos.</div>`}
      </div>
    `);
  }
  function _ESPACIOS() { return [
    { id: "esp_sl", nombre: "Salón Sin Límites", capacidad: 20, ico: "♾️" },
    { id: "esp_14", nombre: "Salón Semillitas", capacidad: 40, ico: "🧸" },
    { id: "esp_56", nombre: "Salón Exploradores", capacidad: 45, ico: "🌱" },
    { id: "esp_78", nombre: "Salón Aventureros", capacidad: 45, ico: "⚡" },
    { id: "esp_911", nombre: "Salón Conquistadores", capacidad: 50, ico: "🔥" },
    { id: "esp_aud", nombre: "Auditorio Kids", capacidad: 200, ico: "🎤" },
  ]; }
  function modalEvento() {
    const hoyIso = new Date().toISOString().slice(0, 10);
    const ops = _ESPACIOS().map(e => `<option value="${e.id}">${e.ico} ${esc(e.nombre)} (cap. ${e.capacidad})</option>`).join("");
    abrirModal(`
      <h3 id="dr-modal-t">Crear evento</h3>
      <label class="dr-field"><span>Título</span><input class="dr-input" id="dr-ev-titulo" placeholder="Ej. Capacitación de servidores"></label>
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
      </div>`);
  }
  function aMin(h) { const [a, b] = String(h).split(":").map(Number); return a * 60 + (b || 0); }
  function chequearDisp() {
    const fecha = val("dr-ev-fecha"), esp = val("dr-ev-espacio"), ini = val("dr-ev-inicio"), fin = val("dr-ev-fin");
    const box = document.getElementById("dr-ev-disp"); if (!box) return true;
    if (!fecha || !esp || !ini || !fin || aMin(fin) <= aMin(ini)) { box.innerHTML = `<div class="dr-disp__bad">Revisa fecha y horas (el fin debe ser después del inicio).</div>`; return false; }
    const libre = S.espacioLibre(esp, fecha, ini, fin);
    const e = _ESPACIOS().find(x => x.id === esp);
    box.innerHTML = libre
      ? `<div class="dr-disp__ok">✓ ${esc(e.nombre)} está libre el ${fechaCorta(fecha)} de ${ini} a ${fin}.</div>`
      : `<div class="dr-disp__bad">✕ ${esc(e.nombre)} ya está ocupado en ese horario.</div>`;
    return libre;
  }

  /* ============================================================ MODAL / TOAST */
  function abrirModal(html) {
    const wrap = document.getElementById("dr-modal");
    wrap.innerHTML = `<div class="dr-modalbg" id="dr-modalbg"><div class="dr-modal" role="dialog" aria-modal="true" aria-labelledby="dr-modal-t">${html}</div></div>`;
    document.getElementById("dr-modalbg").addEventListener("click", e => { if (e.target.id === "dr-modalbg") cerrarModal(); });
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
  const VISTAS = { analitica: vistaAnalitica, crm: vistaCRM, salones: vistaSalones, equipo: vistaEquipo, nuevos: vistaNuevos, organigrama: vistaOrganigrama, tematicas: vistaTematicas, peticiones: vistaPeticiones, calendario: vistaCalendario };
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
      crmQuery = inp.value.trim().toLowerCase(); let vis = 0;
      document.querySelectorAll("#dr-crm-body tr").forEach(tr => { const ok = !crmQuery || (tr.dataset.search || "").includes(crmQuery); tr.style.display = ok ? "" : "none"; if (ok) vis++; });
      const c = document.getElementById("dr-crm-count"); if (c) c.textContent = vis;
    });
    if (crmQuery && typeof Event !== "undefined") inp.dispatchEvent(new Event("input"));
  }
  function entrar() { sesion = true; render(); toast(`¡Bienvenido, ${USER.nombre.split(" ")[0]}! 👋`, true); }

  /* ============================================================ EVENTOS */
  function manejar(ev) {
    const el = ev.target.closest("[data-accion]"); if (!el) return;
    const a = el.dataset.accion, id = el.dataset.id;
    switch (a) {
      case "salir": ev.preventDefault(); sesion = false; salonAbierto = null; vista = "analitica"; render(); return;
      case "ir": ev.preventDefault(); vista = el.dataset.vista; salonAbierto = null; temDrill = null; window.scrollTo(0, 0); render(); return;

      /* CRM */
      case "crm-sort": { ev.preventDefault(); const col = el.dataset.col; if (crmSort === col) crmDir = -crmDir; else { crmSort = col; crmDir = 1; } render(); return; }
      case "crm-filtro": ev.preventDefault(); crmFiltro = el.dataset.f; render(); return;
      case "ver-nino": ev.preventDefault(); modalNino(id); return;

      /* salones */
      case "abrir-salon": ev.preventDefault(); salonAbierto = id; window.scrollTo(0, 0); render(); return;
      case "cerrar-salon": ev.preventDefault(); salonAbierto = null; render(); return;

      /* equipo */
      case "ver-servidor": ev.preventDefault(); modalServidor(id); return;

      /* nuevos */
      case "vincular": ev.preventDefault(); modalVincular(id); return;
      case "confirmar-vincular": { ev.preventDefault(); const sel = document.getElementById("dr-vinc-sel"); const et = sel ? sel.value : null; if (et && S.vincularNuevo(id, et)) { cerrarModal(); render(); toast(`Vinculado a ${RK.etapa(et).nombre} ✓`, true); } return; }

      /* organigrama */
      case "org-add": ev.preventDefault(); modalNodo(id || "", false); return;
      case "org-edit": ev.preventDefault(); modalNodo(id, true); return;
      case "org-del": ev.preventDefault(); S.delNodo(id); render(); toast("Nodo quitado", false); return;
      case "org-save-new": { ev.preventDefault(); const nombre = val("dr-org-nombre"); if (!nombre) { toast("Escribe un nombre", false); return; } S.addNodo(nombre, val("dr-org-rol"), el.dataset.parent || null); cerrarModal(); render(); toast("Nodo agregado ✓", true); return; }
      case "org-save-edit": { ev.preventDefault(); const nombre = val("dr-org-nombre"); if (!nombre) { toast("Escribe un nombre", false); return; } const ps = document.getElementById("dr-org-parent"); S.editNodo(id, { nombre, rol: val("dr-org-rol"), parent: ps ? (ps.value || null) : undefined }); cerrarModal(); render(); toast("Nodo actualizado ✓", true); return; }

      /* temáticas */
      case "nueva-tematica": ev.preventDefault(); modalTematica(); return;
      case "guardar-tematica": { ev.preventDefault(); const titulo = val("dr-tem-titulo"); if (!titulo) { toast("Escribe un título", false); return; } S.addTematica({ titulo, desc: val("dr-tem-desc"), tipo: val("dr-tem-tipo") || "Material", dirigidoA: val("dr-tem-dir") || "Todas las etapas", ico: val("dr-tem-ico") || "📚" }); cerrarModal(); render(); toast("Temática creada ✓", true); return; }
      case "del-tematica": ev.preventDefault(); S.delTematica(id); if (temDrill === id) temDrill = null; render(); toast("Temática eliminada", false); return;
      case "ver-tematica": ev.preventDefault(); temDrill = id; window.scrollTo(0, 0); render(); return;
      case "tem-volver": ev.preventDefault(); temDrill = null; window.scrollTo(0, 0); render(); return;
      case "subir-doc": ev.preventDefault(); modalSubirDoc(id); return;
      case "guardar-doc": { ev.preventDefault(); const tid = el.dataset.id; const fileEl = document.getElementById("dr-doc-archivo"); const file = fileEl && fileEl.files && fileEl.files[0] ? fileEl.files[0] : null; if (!file) { toast("Selecciona un archivo", false); return; } S.addDocTematica(tid, { archivo: file.name, peso: file.size, nombre: val("dr-doc-nombre") || file.name, nota: val("dr-doc-nota"), por: USER.nombre }); cerrarModal(); render(); toast("Documento subido ✓", true); return; }
      case "del-doc": ev.preventDefault(); S.delDocTematica(el.dataset.tem, id); render(); toast("Documento quitado", false); return;
      case "ver-doc": { ev.preventDefault(); const tt = S.tematica(el.dataset.tem); const d = tt && (tt.docs || []).find(x => x.id === id); toast(d ? `📄 Vista previa de “${d.nombre || d.archivo}” (demo).` : "Documento no encontrado", true); return; }

      /* peticiones */
      case "filtro-pet": ev.preventDefault(); filtroPet = el.dataset.f; render(); return;
      case "nueva-peticion": ev.preventDefault(); modalPeticion(); return;
      case "guardar-peticion": { ev.preventDefault(); const texto = val("dr-pet-texto"); if (!texto) { toast("Escribe la petición", false); return; } S.addPeticion({ autor: val("dr-pet-autor") || USER.nombre, texto }); cerrarModal(); render(); toast("Petición publicada 🙏", true); return; }
      case "estado-pet": ev.preventDefault(); if (String(id).startsWith("reg_")) { toast("Las peticiones del domingo se atienden desde el seguimiento pastoral.", true); return; } S.setEstadoPeticion(id, el.dataset.e); render(); toast(el.dataset.e === "respondida" ? "¡Respondida! 🎉" : "Marcada: orando 🙏", true); return;

      /* calendario */
      case "cal-prev": ev.preventDefault(); calMes = { y: calMes.m === 0 ? calMes.y - 1 : calMes.y, m: (calMes.m + 11) % 12 }; render(); return;
      case "cal-next": ev.preventDefault(); calMes = { y: calMes.m === 11 ? calMes.y + 1 : calMes.y, m: (calMes.m + 1) % 12 }; render(); return;
      case "nuevo-evento": ev.preventDefault(); modalEvento(); return;
      case "ev-check": ev.preventDefault(); chequearDisp(); return;
      case "guardar-evento": { ev.preventDefault(); const titulo = val("dr-ev-titulo"); if (!titulo) { toast("Escribe un título", false); return; } if (!chequearDisp()) { toast("Ese espacio no está libre en ese horario", false); return; } S.addEvento({ titulo, fecha: val("dr-ev-fecha"), horaInicio: val("dr-ev-inicio"), horaFin: val("dr-ev-fin"), espacioId: val("dr-ev-espacio"), desc: val("dr-ev-desc") }); cerrarModal(); render(); toast("Evento creado y espacio reservado ✓", true); return; }
      case "del-evento": ev.preventDefault(); S.delEvento(id); render(); toast("Evento eliminado", false); return;

      case "cerrar-modal": ev.preventDefault(); cerrarModal(); return;
    }
  }

  /* reasignar coordinador (change del select) */
  document.addEventListener("change", e => {
    const sel = e.target.closest('[data-accion="reasignar-coord"]');
    if (sel) { S.setCoordDe(sel.dataset.area, sel.value); render(); const c = RK.COORDS.find(x => x.id === sel.value); toast(`Coordinador asignado: ${c ? c.nombre : ""} ✓`, true); }
  });

  /* sincronización en vivo con la app del domingo */
  if (S && S.onCambio) S.onCambio(() => { if (sesion) render(); });

  /* init */
  document.addEventListener("DOMContentLoaded", render);
  if (document.readyState !== "loading") render();
})();
