/* ============================================================
   CASA ROCA · APP DEL PASTOR CONGREGACIONAL — Capa 3
   Demo: sede madre Bogotá Chicó, pastor Camilo Restrepo.
   Visión total de la sede: todos los ministerios (congregacionales +
   operativos), CRM total, finanzas, organigrama, calendario y espacios,
   grupos, equipo, temáticas, peticiones, requerimientos a la admin
   central y directorio de las 36 iglesias.

   Sincronización: el ministerio J+25 se lee EN VIVO de window.DIRECTOR/
   window.DSTORE (lo que edita el director) y window.STORE (inscritos del
   landing/líder). Los demás ministerios vienen de window.PASTOR.
   Reusa el lenguaje visual del director (clases .dr-) + clases .ps-.
   Sin frameworks. Vistas = funciones que devuelven HTML.
   ============================================================ */
(function () {
  "use strict";
  const P = window.PASTOR;
  const PS = window.PSTORE;
  const DB = window.DB;
  const L = window.LANDING;
  const S = window.STORE;
  const D = window.DIRECTOR;
  const DS = window.DSTORE;
  const USER = P.PASTOR_USER;
  const CAFE = "af_j25_cafe";

  let sesion = false;
  let vista = "analitica";
  let clickBound = false;

  // estado por vista
  let crmSort = "nombre", crmDir = 1, crmFiltro = "todos", crmMin = "todos", crmQuery = "";
  let minDrill = null;          // ministerio abierto (grupos/equipo)
  let reqFiltro = "todos";      // requerimientos
  let dirFiltro = "todos", dirQuery = "";
  let filtroPet = "todas";
  let petScope = "sede";        // "sede" (líderes/directores/sede) | "internas" (solo pastores)
  let finTab = "ingresos";
  let proyDrill = null;          // id del proyecto abierto en la pestaña Proyectos
  let calMes = { y: 2026, m: 5 }; // junio 2026
  let calMinFiltro = "todos"; // filtro de ministerio en el calendario
  let gruposMinFiltro = "todos", equipoMinFiltro = "todos";
  let sirveSede = 0;            // índice de sede en la pestaña Sirve (0 = sede madre)
  let oracionTab = "tablero";  // "tablero" | "equipo"
  let oracionEstado = "todas", oracionMin = "todos"; // filtros del tablero de oración
  let temDrill = null;          // id de la temática abierta en el detalle
  let temDrillLive = false;     // si la temática abierta es en vivo (J+25, del director)
  let orgZoom = 1;              // Punto 6 · nivel de zoom del organigrama (0.5–1.6)
  let orgColapsados = {};       // Punto 6 · nodos contraídos {id: true}
  let orgEquipoAbierto = {};    // P3 ronda 2 · ministerios con su equipo desplegado {id: true}
  let consSub = "resumen";      // PANEL ANIDADO · sub-pestaña activa de Consejería

  /* ------------------------------------------------------------ utils */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const app = () => document.getElementById("ps-app");
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
  const PRIO = { Alta: "var(--rojo, #d64545)", Media: "var(--mostaza-500)", Baja: "var(--azul-400)" };
  const REQ_ESTADOS = ["Abierto", "En proceso", "Resuelto"];
  // Punto 1 · servicios de la sede (Bogotá Chicó). Diezmos y asistencia se
  // pueden registrar por servicio. Cada sede ve SOLO su propia información.
  const SERVICIOS = ["7:00 am", "9:00 am", "11:30 am", "Miércoles 7:00 pm"];
  // Suma registros (diezmos/asistencia) por domingo (misma etiqueta 'f').
  function aggPorDomingo(arr) {
    const map = new Map();
    (arr || []).forEach(d => {
      const k = d.f;
      if (!map.has(k)) map.set(k, { f: d.f, fecha: d.fecha, diezmos: 0, ofrendas: 0, total: 0, nuevos: 0 });
      const o = map.get(k);
      o.diezmos += (+d.diezmos || 0);
      o.ofrendas += (+d.ofrendas || 0);
      o.total += (+d.total || 0);
      o.nuevos += (+d.nuevos || 0);
    });
    return [...map.values()];
  }

  function nombreCompleto(p) { return `${p.nombres || ""} ${p.apellidos || ""}`.trim(); }
  function iniciales(p) { return (((p.nombres || "")[0] || "") + ((p.apellidos || "")[0] || "")).toUpperCase() || "·"; }
  function generoDe(p) {
    if (p.genero === "F" || p.genero === "M") return p.genero;
    const ec = (p.estadoCivil || "").toLowerCase();
    if (/(soltera|casada|unida|viuda|divorciada)/.test(ec)) return "F";
    if (/(soltero|casado|unido|viudo|divorciado)/.test(ec)) return "M";
    const n = (p.nombres || "").trim().toLowerCase();
    return /a$/.test(n) ? "F" : "M";
  }
  function diasDesde(iso) { if (!iso) return 9999; const d = new Date(iso); const h = new Date(); h.setHours(0, 0, 0, 0); return Math.round((h - d) / 86400000); }
  function fechaCorta(iso) { if (!iso) return "—"; const d = new Date(iso); if (isNaN(d)) return esc(iso); return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`; }
  function soloDigitos(t) { return String(t || "").replace(/\D/g, ""); }
  function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }
  function mCOP(n) { return "$" + (Math.round(n * 10) / 10).toLocaleString("es-CO") + " M"; }

  /* ----- contacto ----- */
  function waLink(tel, nombre) {
    const n = (nombre || "").split(" ")[0];
    return `https://wa.me/${soloDigitos(tel)}?text=${encodeURIComponent("Hola " + n + ", soy el pastor Camilo de Casa Roca Bogotá Chicó 🙌 Quería saludarte.")}`;
  }
  function mailLink(email, nombre) {
    const n = (nombre || "").split(" ")[0];
    return `mailto:${email}?subject=${encodeURIComponent("Saludo desde Casa Roca · Bogotá Chicó")}&body=${encodeURIComponent("Hola " + n + ",\n\nUn abrazo,\nPastor Camilo Restrepo")}`;
  }

  /* ============================================================
     AGREGACIÓN DE DATOS DE LA SEDE
     ============================================================ */
  // Normaliza cualquier persona (de PASTOR, director o STORE) a una forma común.
  function normP(p, extra) {
    const o = Object.assign({
      id: p.id, nombres: p.nombres || "", apellidos: p.apellidos || "",
      genero: p.genero, edad: p.edad, etapa: p.etapa || "conoce",
      estadoCivil: p.estadoCivil || "—", telefono: p.telefono || "—",
      correo: p.correo || p.email || "—",
      cumpleMes: p.cumpleMes, cumpleDia: p.cumpleDia,
      fechaInscripcion: p.fechaInscripcion || p.primeraVisita || null,
      fuente: p.fuente || "—", cursos: p.cursos || [],
      contactado: p.contactado !== false,
      sirve: !!p.sirve,
      diezma: p.diezma,
      diezmaFrecuencia: p.diezmaFrecuencia || null,
      ultimoDiezmoMonto: p.ultimoDiezmoMonto || 0,
      ultimoDiezmoFecha: p.ultimoDiezmoFecha || null,
    }, extra || {});
    if (o.diezma === undefined) o.diezma = (o.sirve || o.etapa === "crece" || o.etapa === "sirve");
    if (o.diezma && !o.diezmaFrecuencia) o.diezmaFrecuencia = "Mensual";
    return o;
  }

  // J+25 EN VIVO desde el director (DSTORE) + STORE
  function j25Personas() {
    const out = [];
    if (!D || !DS) return out;
    D.GRUPOS.forEach(g => {
      const asign = DS.asignadosDe(g.afId);
      const roster = (g.afId === CAFE ? S.inscritos(CAFE) : D.rosterDe(g.afId)).concat(asign);
      const a = L ? L.afinidad(g.afId) : null;
      const lid = DS.liderDeGrupo(g.afId);
      const lider = (D.LIDERES.find(l => l.id === lid) || {}).nombre || g.lider;
      roster.forEach(p => out.push(normP(p, { ministerioId: "m_j25", ministerio: "J+25", grupo: a ? a.nombre : g.afId, sub: "", lider })));
    });
    DS.equipo().forEach(p => out.push(normP(p, { ministerioId: "m_j25", ministerio: "J+25", grupo: "Equipo de servicio", sub: "", lider: "Andrés Lozano", sirve: true })));
    return out;
  }

  // TODA la sede (registro único deduplicado por correo)
  function registroSede() {
    const byKey = new Map();
    function add(p) {
      const k = (p.correo && p.correo !== "—" ? p.correo : p.id).toLowerCase();
      if (!byKey.has(k)) byKey.set(k, p);
      else { const x = byKey.get(k); if (p.sirve) x.sirve = true; if (p.diezma) x.diezma = true; }
    }
    P.MIN_DEFS.forEach(m => {
      if (m.liveDirector) return;
      (m._roster || []).forEach(p => add(normP(p, { ministerioId: m.id, ministerio: m.nombre, grupo: p.grupo, sub: p.sub, lider: (m._grupos.find(g => g.nombre === p.grupo) || {}).lider && (m._grupos.find(g => g.nombre === p.grupo) || {}).lider.nombre })));
    });
    j25Personas().forEach(add);
    // CRM CENTRAL (Punto 1): personas dadas de alta por CUALQUIER formulario
    // del sistema (inscripción a cursos, alta manual, etc.), sin importar la
    // pestaña. Se centralizan aquí y aparecen en el CRM total de la sede.
    if (S && S.crmPersonas) {
      S.crmPersonas().forEach(p => add(normP(p, {
        ministerioId: p.ministerioId || "crm",
        ministerio: p.ministerio || (p.esNuevo || p.nuevo ? "Nuevos" : "General"),
        grupo: p.grupo || "—",
        sub: p.sub || ""
      })));
    }
    return [...byKey.values()];
  }

  // Todos los grupos pequeños de la sede
  function gruposSede() {
    const out = [];
    P.MIN_DEFS.forEach(m => {
      if (m.liveDirector) return;
      (m._grupos || []).forEach(g => {
        const miembros = (m._roster || []).filter(p => p.grupo === g.nombre).length;
        out.push({ ministerioId: m.id, ministerio: m.nombre, ico: m.ico, tipo: m.tipo, nombre: g.nombre, sub: g.sub, lider: g.lider, dia: g.dia, hora: g.hora, cupo: g.cupo, zona: g.zona, miembros });
      });
    });
    // J+25 en vivo
    if (D && DS) {
      D.GRUPOS.forEach(g => {
        const a = L ? L.afinidad(g.afId) : null;
        const roster = (g.afId === CAFE ? S.inscritos(CAFE) : D.rosterDe(g.afId)).concat(DS.asignadosDe(g.afId));
        const lid = DS.liderDeGrupo(g.afId);
        const lObj = D.LIDERES.find(l => l.id === lid) || {};
        out.push({ ministerioId: "m_j25", ministerio: "J+25", ico: "🌱", tipo: "congregacional", nombre: a ? a.nombre : g.afId, sub: "", lider: { nombre: lObj.nombre || g.lider, tel: lObj.tel || g.liderTel, email: lObj.email || g.liderEmail }, dia: a ? a.dia : "—", hora: a ? a.hora : "—", cupo: a ? a.cupo : 0, zona: a ? a.zona : "—", miembros: roster.length, live: true });
      });
    }
    return out;
  }

  // Eventos combinados (PSTORE + J+25 del director)
  function eventosSede() {
    const base = PS.eventos().slice();
    if (D && DS) {
      const espMap = { esp_norte: "esp_s1", esp_cafe: "esp_cafe", esp_aud: "esp_aud", esp_s3: "esp_s3", esp_aire: "esp_aire" };
      DS.eventos().forEach(e => {
        base.push({ id: e.id, titulo: e.titulo, fecha: e.fecha, horaInicio: e.horaInicio, horaFin: e.horaFin, espacioId: espMap[e.espacioId] || "esp_s1", min: "J+25", desc: e.desc, live: true });
      });
    }
    return base;
  }

  // Peticiones combinadas
  function peticionesSede() {
    const base = PS.peticiones().map(p => Object.assign({}, p));
    if (DS) DS.peticiones().forEach(p => base.push(Object.assign({}, p, { ministerio: "J+25", live: true })));
    return base;
  }
  // Temáticas combinadas
  function tematicasSede() {
    const base = PS.tematicas().map(t => Object.assign({}, t));
    if (DS) DS.tematicas().forEach(t => base.push(Object.assign({}, t, { ministerio: "J+25", live: true })));
    return base;
  }

  function ministerioTamano(m) {
    if (m.liveDirector) return m.tamano; // tamaño reportado
    return m.tamano;
  }

  /* ============================================================ LOGIN */
  function vistaLogin() {
    return `
    <div class="dr-login">
      <div class="dr-login__card">
        <div class="dr-login__logo">CR</div>
        <h1>Pastor de iglesia local</h1>
        <p>Conoce, acompaña y rodea a toda tu sede. Entra para ver la analítica, el CRM total, finanzas, organigrama, agenda, requerimientos y el directorio de la red.</p>
        <button class="dr-google" id="ps-google">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Continuar con Google
        </button>
        <div class="dr-login__nota">🔒 Demo Fase 0 — entrarás como <b>${esc(USER.nombre)}</b>, ${esc(USER.rol)} de <b>${esc(USER.sede)}</b>.</div>
      </div>
    </div>`;
  }

  /* ============================================================ SHELL */
  const NAV = [
    { id: "analitica", ico: "📊", lbl: "Analítica" },
    { id: "tareas", ico: "✅", lbl: "Tareas" },
    { id: "crm", ico: "🗒️", lbl: "CRM total" },
    { id: "finanzas", ico: "💰", lbl: "Finanzas" },
    { id: "asistencia", ico: "📋", lbl: "Asistencia" },
    { id: "organigrama", ico: "🗂️", lbl: "Organigrama" },
    { id: "calendario", ico: "📅", lbl: "Calendario" },
    { id: "grupos", ico: "👥", lbl: "Grupos pequeños" },
    { id: "equipo", ico: "🤝", lbl: "Equipo" },
    { id: "sirve", ico: "🙌", lbl: "Sirve" },
    { id: "rocakids", ico: "🧒", lbl: "RocaKids" },
    { id: "tematicas", ico: "📚", lbl: "Temáticas" },
    { id: "cursos", ico: "🎓", lbl: "Cursos" },
    { id: "oracion", ico: "🙏", lbl: "Oración" },
    { id: "consejeria", ico: "🧭", lbl: "Consejería" },
    { id: "requerimientos", ico: "🎫", lbl: "Requerimientos" },
    { id: "directorio", ico: "📇", lbl: "Directorio" },
  ];
  function shell(contenidoHTML) {
    return `
    <header class="dr-topbar">
      <div class="dr-brand">
        <div class="dr-brand__logo">CR</div>
        <div class="dr-brand__txt"><b>Casa Roca</b><small>Pastor · ${esc(USER.sede)}</small></div>
      </div>
      <div class="dr-topbar__sp"></div>
      <div class="dr-user">
        <div class="dr-user__name">${esc(USER.nombre)}<span>${esc(USER.rol)}</span></div>
        <div class="dr-avatar" title="${esc(USER.nombre)}">${esc(USER.iniciales)}</div>
        <button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="salir">Salir</button>
      </div>
    </header>
    <div class="dr-shell">
      <nav class="dr-nav" aria-label="Secciones de la sede">
        ${NAV.map(n => `<button class="dr-nav__item ${vista === n.id ? "is-active" : ""}" data-accion="ir" data-vista="${n.id}" ${vista === n.id ? 'aria-current="page"' : ""}>
          <span class="dr-nav__ic" aria-hidden="true">${n.ico}</span><span class="dr-nav__lbl">${n.lbl}</span></button>`).join("")}
      </nav>
      <main class="dr-main" id="main">${contenidoHTML}</main>
    </div>`;
  }

  /* ============================================================ helpers UI (charts) */
  const PALETA = ["var(--azul-600)", "var(--mostaza-500)", "var(--etapa-conecta)", "var(--etapa-crece)", "var(--azul-400)", "var(--mostaza-300)", "var(--azul-800)", "var(--etapa-sirve)"];
  function _card(title, sub, body) { return `<div class="dr-card"><h3 class="dr-card__t">${esc(title)}</h3>${sub ? `<p class="dr-card__sub">${sub}</p>` : ""}${body}</div>`; }
  function _legend(items, total) { return `<ul class="dr-legend">${items.map(s => `<li><i style="background:${s.color}"></i><span>${esc(s.lbl)}</span><b>${s.v}</b>${total ? `<em>${pct(s.v, total)}%</em>` : ""}</li>`).join("")}</ul>`; }
  function barChart(titulo, sub, filas, colorFn, fmt, maxOverride) {
    const max = maxOverride || Math.max(1, ...filas.map(f => f.v));
    return `<div class="dr-card"><h3 class="dr-card__t">${esc(titulo)}</h3>${sub ? `<p class="dr-card__sub">${sub}</p>` : ""}
      <div class="dr-bars">${filas.map(f => `<div class="dr-bar"><div class="dr-bar__lbl">${esc(f.lbl)}</div>
        <div class="dr-bar__track"><div class="dr-bar__fill" style="width:${Math.min(100, pct(f.v, max))}%;background:${(colorFn && colorFn(f)) || "var(--azul-500)"}"></div></div>
        <div class="dr-bar__val">${fmt ? fmt(f.v) : f.v}</div></div>`).join("")}</div></div>`;
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
  function lineArea(title, sub, pts, color, fmt) {
    const W = 320, H = 130, pX = 22, pT = 20, pB = 26, n = pts.length;
    const max = Math.max(1, ...pts.map(p => p.v));
    const X = i => pX + (i * (W - 2 * pX) / Math.max(1, n - 1));
    const Y = v => (H - pB) - (v / max) * (H - pT - pB);
    const line = pts.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ");
    const area = `M${X(0).toFixed(1)},${H - pB} ` + pts.map((p, i) => `L${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ") + ` L${X(n - 1).toFixed(1)},${H - pB} Z`;
    const dots = pts.map((p, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="3.2"/>`).join("");
    const vl = pts.map((p, i) => `<text class="dr-line__v" x="${X(i).toFixed(1)}" y="${(Y(p.v) - 7).toFixed(1)}">${fmt ? fmt(p.v) : p.v}</text>`).join("");
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
    const inter = !!k;
    const tag = inter ? "button" : "div";
    const attrs = inter ? ` data-accion="kpi" data-k="${k}" aria-label="Ver el porqué de: ${esc(lbl)}"` : "";
    return `<${tag} class="dr-kpi ${alerta ? "is-alerta" : ""} ${inter ? "ps-kpi--click" : ""}"${attrs}>
      <div class="dr-kpi__n">${n}</div><div class="dr-kpi__l">${esc(lbl)}</div>
      ${inter ? '<span class="ps-kpi__hint" aria-hidden="true">¿Por qué? →</span>' : ""}</${tag}>`;
  }
  function pill(txt, cls) { return `<span class="ps-pill ${cls || ""}">${esc(txt)}</span>`; }

  /* ============================================================ 1. ANALÍTICA */
  function vistaAnalitica() {
    const personas = registroSede();
    const grupos = gruposSede();
    const total = personas.length;
    const tamanoSede = P.MIN_DEFS.reduce((s, m) => s + ministerioTamano(m), 0);
    const f = personas.filter(p => generoDe(p) === "F").length;
    const mPer = personas.filter(p => generoDe(p) === "M").length;
    const sirven = personas.filter(p => p.sirve).length;
    const diezman = personas.filter(p => p.diezma).length;
    const nuevos7 = personas.filter(p => diasDesde(p.fechaInscripcion) <= 7).length;
    const nuevos30 = personas.filter(p => diasDesde(p.fechaInscripcion) <= 30).length;
    const sinContactar = personas.filter(p => p.contactado === false).length;
    const minActivos = P.MIN_DEFS.length;
    const minCong = P.MIN_DEFS.filter(m => m.tipo === "congregacional").length;
    const minOper = P.MIN_DEFS.filter(m => m.tipo === "operativo").length;
    const consejActivas = P.CONSEJERIAS.filter(c => c.estado === "Activa").length;
    const ayudas = P.AYUDAS_MAS.length;

    // asistencia últimos domingos (por servicio)
    const asis = P.ASISTENCIA;
    const promDomingo = asis.length ? Math.round(asis.reduce((s, d) => s + d.s1 + d.s2 + d.s3, 0) / asis.length) : 0;
    const ptsAsis = asis.map(d => ({ lbl: d.f, v: d.s1 + d.s2 + d.s3 }));

    // tamaño por ministerio (reportado), separando tipo
    const filasMinCong = P.MIN_DEFS.filter(m => m.tipo === "congregacional").map(m => ({ lbl: m.nombre, v: m.tamano, _ico: m.ico })).sort((a, b) => b.v - a.v);
    const filasMinOper = P.MIN_DEFS.filter(m => m.tipo === "operativo").map(m => ({ lbl: m.nombre, v: m.tamano })).sort((a, b) => b.v - a.v);

    // edades
    const buckets = [{ lbl: "0–10", min: 0, max: 10 }, { lbl: "11–17", min: 11, max: 17 }, { lbl: "18–25", min: 18, max: 25 }, { lbl: "26–35", min: 26, max: 35 }, { lbl: "36–55", min: 36, max: 55 }, { lbl: "56+", min: 56, max: 200 }];
    const conEdad = personas.filter(p => typeof p.edad === "number");
    const filasEdad = buckets.map(b => ({ lbl: b.lbl, v: conEdad.filter(p => p.edad >= b.min && p.edad <= b.max).length }));

    // etapas 4C
    const orden = ["conoce", "conecta", "crece", "sirve"];
    const filasEt = orden.map(e => ({ lbl: ETAPAS[e].lbl, v: personas.filter(p => p.etapa === e).length, color: ETAPAS[e].color }));
    const madurez = pct(personas.filter(p => p.etapa === "crece" || p.etapa === "sirve").length, total);

    // estado civil
    function ecNorm(p) { const e = (p.estadoCivil || "").toLowerCase(); if (e.includes("solter")) return "Solteros"; if (e.includes("casad")) return "Casados"; if (e.includes("unión") || e.includes("union") || e.includes("unid")) return "Unión libre"; if (e.includes("viud")) return "Viudos"; return "Otro"; }
    const ecCats = ["Solteros", "Casados", "Unión libre", "Viudos", "Otro"];
    const filasEC = ecCats.map((c, i) => ({ lbl: c, v: personas.filter(p => ecNorm(p) === c).length, color: PALETA[i % PALETA.length] })).filter(x => x.v > 0);

    // nuevos por mes
    const mlabels = ["Ene", "Feb", "Mar", "Abr", "May", "Jun"];
    const filasMes = mlabels.map((lbl, i) => ({ lbl, v: personas.filter(p => p.fechaInscripcion && String(p.fechaInscripcion).slice(0, 7) === `2026-0${i + 1}`).length }));

    // género donut
    const segGenero = [{ lbl: "Mujeres", v: f, color: "var(--etapa-conecta)" }, { lbl: "Hombres", v: mPer, color: "var(--azul-600)" }];

    // fuente
    const fuenteTally = {};
    personas.forEach(p => { const k = p.fuente || "Otro"; fuenteTally[k] = (fuenteTally[k] || 0) + 1; });
    const filasFuente = Object.keys(fuenteTally).map(k => ({ lbl: k, v: fuenteTally[k] })).sort((a, b) => b.v - a.v).slice(0, 7);

    // formación
    const cursosCat = [["adn", "ADN"], ["bautizo", "Bautizo"], ["madurez", "Madurez"], ["ibli", "IBLI/FACTER"]];
    const filasCursos = cursosCat.map(([id, lbl]) => ({ lbl, v: personas.filter(p => (Array.isArray(p.cursos) ? p.cursos : []).includes(id)).length }));

    // grupos pequeños totales + ocupación
    const totGrupos = grupos.length;
    const sumCupo = grupos.reduce((s, g) => s + (g.cupo || 0), 0);
    const sumMiem = grupos.reduce((s, g) => s + (g.miembros || 0), 0);
    const ocupGlobal = pct(sumMiem, sumCupo);

    // consejerías por tipo
    const tipCons = {};
    P.CONSEJERIAS.forEach(c => { tipCons[c.tipo] = (tipCons[c.tipo] || 0) + 1; });
    const filasCons = Object.keys(tipCons).map((k, i) => ({ lbl: k, v: tipCons[k], color: PALETA[i % PALETA.length] }));

    // ayudas M.A.S por estado
    const estAyu = {};
    P.AYUDAS_MAS.forEach(a => { estAyu[a.estado] = (estAyu[a.estado] || 0) + 1; });
    const filasAyu = Object.keys(estAyu).map((k, i) => ({ lbl: k, v: estAyu[k], color: PALETA[(i + 2) % PALETA.length] }));

    return shell(`
      <div class="dr-head"><div>
        <h1 class="dr-h1">Analítica de la sede</h1>
        <p class="dr-lead">Una mirada de 360° de Bogotá Chicó: todos los ministerios, asistencia, nuevos, grupos, servidores y cuidado pastoral. J+25 se actualiza en vivo con el director.</p>
      </div></div>

      <div class="dr-kpis">
        ${kpi(tamanoSede.toLocaleString("es-CO"), "Personas en el sistema", "personas")}
        ${kpi(total.toLocaleString("es-CO"), "Fichas detalladas (CRM)", "fichas")}
        ${kpi(promDomingo.toLocaleString("es-CO"), "Promedio domingo", "domingo")}
        ${kpi(sirven.toLocaleString("es-CO"), "Servidores activos", "servidores")}
        ${kpi(totGrupos, "Grupos pequeños", "grupos")}
        ${kpi(minActivos, "Ministerios activos", "ministerios")}
        ${kpi(nuevos30, "Nuevos (30 días)", "nuevos")}
        ${kpi(diezman.toLocaleString("es-CO"), "Diezman (personas)", "diezman")}
        ${kpi(consejActivas, "Consejerías activas", "consejerias", consejActivas > 0)}
        ${kpi(ayudas, "Ayudas M.A.S", "ayudas")}
        ${kpi(sinContactar, "Sin contactar", "sincontactar", sinContactar > 0)}
        ${kpi(`${minCong}+${minOper}`, "Congreg. + operativos", "tipos")}
      </div>

      <div class="dr-grid2">
        ${lineArea("Asistencia · últimos 8 domingos", "Suma de los 3 servicios", ptsAsis, "var(--azul-600)")}
        ${donut("Distribución por género", "Toda la sede", segGenero)}
      </div>

      ${barChart("Tamaño de los ministerios congregacionales", "Personas reportadas por ministerio", filasMinCong, f => "var(--azul-500)", null)}
      ${barChart("Tamaño de los equipos operativos", "Servidores por equipo del domingo", filasMinOper, f => "var(--mostaza-500)", null)}

      <div class="dr-grid2">
        ${funnel("Recorrido pastoral · las 4 C", `Madurez (Crece+Sirve): ${madurez}%`, filasEt)}
        ${columns("Distribución por edades", "Toda la sede", filasEdad, () => "var(--azul-600)")}
      </div>

      <div class="dr-grid2">
        ${donut("Estado civil", null, filasEC)}
        ${lineArea("Nuevos por mes (2026)", "Personas registradas", filasMes, "var(--etapa-crece)")}
      </div>

      <div class="dr-grid2">
        ${lollipop("¿Cómo llegaron? · fuentes", "Top fuentes de toda la sede", filasFuente, () => "var(--mostaza-500)")}
        ${columns("Formación · cursos completados", "ADN, Bautizo, Madurez, Instituto", filasCursos, () => "var(--etapa-crece)")}
      </div>

      <div class="dr-grid2">
        ${donut("Consejerías por tipo", `${consejActivas} activas de ${P.CONSEJERIAS.length}`, filasCons)}
        ${donut("Ayudas Fundación M.A.S", `${ayudas} solicitudes`, filasAyu)}
      </div>

      ${gauges("Ocupación de grupos y madurez", "Indicadores clave de la sede", [
        { lbl: "Ocupación grupos", v: ocupGlobal, color: "var(--azul-600)" },
        { lbl: "Madurez (3C-4C)", v: madurez, color: "var(--etapa-crece)" },
        { lbl: "% que sirve", v: pct(sirven, total), color: "var(--etapa-sirve)" },
        { lbl: "% que diezma", v: pct(diezman, total), color: "var(--mostaza-500)" },
      ])}
    `);
  }

  /* ============================================================ DETALLE DE KPI ("¿por qué este dato?") */
  function kpiModal(num, lbl, porque, calculo, bodyHTML, acciones) {
    abrirModal(`
      <div class="dr-modal__head"><div class="ps-kpi-big">${num}</div>
        <div><h2 id="dr-modal-t">${esc(lbl)}</h2><p class="dr-card__sub">El porqué de este dato · sede Bogotá Chicó</p></div></div>
      <div class="ps-why"><span>¿Qué significa?</span><p>${porque}</p></div>
      <div class="ps-why"><span>Cómo se calcula</span><p>${calculo}</p></div>
      ${bodyHTML || ""}
      <div class="dr-modal__actions">${acciones || ""}<button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cerrar</button></div>
    `);
  }
  function goBtn(vistaDest, filtro, min, lbl) {
    return `<button class="dr-btn dr-btn--primary" data-accion="kpi-go" data-vista="${vistaDest}" data-filtro="${filtro || ""}" data-min="${min || ""}">${esc(lbl)}</button>`;
  }
  function listaPersonas(arr, max) {
    const items = arr.slice(0, max || 12).map(p => `<div class="ps-mini-row" data-accion="ver-persona" data-id="${p.id}" role="button" tabindex="0">
      <span class="dr-mini-avatar">${esc(iniciales(p))}</span>
      <div class="ps-mini-row__main"><b>${esc(nombreCompleto(p))}</b><small>${esc(p.ministerio)} · ${esc(p.grupo || "—")}</small></div>
      ${chip(p.etapa)}</div>`).join("");
    const resto = arr.length > (max || 12) ? `<p class="dr-card__sub">…y ${arr.length - (max || 12)} más.</p>` : "";
    return `<div class="ps-mini-list">${items}</div>${resto}`;
  }
  function kpiDetalle(k) {
    const personas = registroSede();
    const grupos = gruposSede();
    const total = personas.length;
    const porMin = (pred) => P.MIN_DEFS.map(m => ({ lbl: m.nombre, v: personas.filter(p => p.ministerioId === m.id && pred(p)).length })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);

    switch (k) {
      case "personas": {
        const tam = P.MIN_DEFS.reduce((s, m) => s + m.tamano, 0);
        const filas = P.MIN_DEFS.map(m => ({ lbl: m.nombre, v: m.tamano })).sort((a, b) => b.v - a.v);
        return kpiModal(tam.toLocaleString("es-CO"), "Personas en el sistema",
          "Todas las personas vinculadas a la sede, sumando la membresía reportada de cada ministerio (congregacionales y operativos).",
          "Suma del <b>tamaño reportado</b> de los " + P.MIN_DEFS.length + " ministerios activos. Incluye personas que asisten aunque aún no tengan ficha detallada.",
          barChart("Aporte de cada ministerio", "Personas reportadas", filas, () => "var(--azul-500)"),
          goBtn("crm", "todos", "todos", "Ver el CRM completo"));
      }
      case "fichas": {
        return kpiModal(total.toLocaleString("es-CO"), "Fichas detalladas (CRM)",
          "Personas con una ficha completa en el CRM (nombre, contacto, etapa, grupo…), sin duplicados. Es la base sobre la que se calculan las gráficas.",
          "Personas <b>únicas</b> deduplicadas por correo, uniendo los rosters de todos los ministerios. J+25 se trae <b>en vivo</b> del director y los líderes.",
          "", goBtn("crm", "todos", "todos", "Ver el CRM completo"));
      }
      case "domingo": {
        const asis = P.ASISTENCIA;
        const prom = asis.length ? Math.round(asis.reduce((s, d) => s + d.s1 + d.s2 + d.s3, 0) / asis.length) : 0;
        const filasTbl = asis.map(d => `<tr><td>${esc(d.f)}</td><td class="ps-num">${d.s1}</td><td class="ps-num">${d.s2}</td><td class="ps-num">${d.s3}</td><td class="ps-num"><b>${d.s1 + d.s2 + d.s3}</b></td></tr>`).join("");
        return kpiModal(prom.toLocaleString("es-CO"), "Promedio de asistencia dominical",
          "El promedio de personas que asisten un domingo, sumando los 3 servicios (8:00, 10:00 y 12:00).",
          "Promedio de los <b>últimos 8 domingos</b> registrados en el check-in: (servicio 1 + servicio 2 + servicio 3) por fecha, promediado.",
          lineArea("Asistencia · últimos 8 domingos", "Suma de los 3 servicios", asis.map(d => ({ lbl: d.f, v: d.s1 + d.s2 + d.s3 })), "var(--azul-600)") +
          `<div class="dr-card"><h3 class="dr-card__t">Detalle por servicio</h3><div class="dr-tablewrap"><table class="dr-table"><thead><tr><th>Domingo</th><th>8:00</th><th>10:00</th><th>12:00</th><th>Total</th></tr></thead><tbody>${filasTbl}</tbody></table></div></div>`,
          "");
      }
      case "servidores": {
        const sirven = personas.filter(p => p.sirve);
        return kpiModal(sirven.length.toLocaleString("es-CO"), "Servidores activos",
          "Personas que hoy sirven en algún ministerio o equipo operativo (la última C del recorrido: «Sirve»).",
          "Personas con bandera <b>sirve = sí</b> en el CRM. Equivale a la última C del recorrido (Conoce → Conéctate → Crece → <b>Sirve</b>).",
          columns("Servidores por ministerio", null, porMin(p => p.sirve), () => "var(--etapa-sirve)"),
          goBtn("equipo", "", "", "Ver el equipo de servidores"));
      }
      case "grupos": {
        const filas = P.MIN_DEFS.map(m => ({ lbl: m.nombre, v: grupos.filter(g => g.ministerioId === m.id).length })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);
        const sumCupo = grupos.reduce((s, g) => s + (g.cupo || 0), 0), sumMiem = grupos.reduce((s, g) => s + (g.miembros || 0), 0);
        return kpiModal(grupos.length.toLocaleString("es-CO"), "Grupos pequeños",
          "El total de grupos pequeños abiertos en toda la sede, donde las personas se conectan y crecen en comunidad.",
          "Conteo de grupos de todos los ministerios. Ocupación global: <b>" + sumMiem + "/" + sumCupo + "</b> (" + pct(sumMiem, sumCupo) + "%).",
          barChart("Grupos por ministerio", null, filas, () => "var(--azul-500)"),
          goBtn("grupos", "", "", "Ver todos los grupos"));
      }
      case "ministerios": {
        const cong = P.MIN_DEFS.filter(m => m.tipo === "congregacional"), oper = P.MIN_DEFS.filter(m => m.tipo === "operativo");
        const fmt = arr => `<div class="ps-tags">${arr.map(m => `<span class="ps-tag">${m.ico} ${esc(m.nombre)} · ${m.tamano}</span>`).join("")}</div>`;
        return kpiModal(P.MIN_DEFS.length, "Ministerios activos",
          "Los ministerios y equipos que hoy operan en la sede. Cada uno tiene su director, grupos y servidores.",
          "Suma de <b>" + cong.length + " congregacionales</b> + <b>" + oper.length + " operativos</b> activados en la configuración de la sede.",
          `<div class="dr-card"><h3 class="dr-card__t">Congregacionales</h3>${fmt(cong)}</div><div class="dr-card"><h3 class="dr-card__t">Operativos</h3>${fmt(oper)}</div>`,
          "");
      }
      case "nuevos": {
        const nuevos = personas.filter(p => diasDesde(p.fechaInscripcion) <= 30).sort((a, b) => diasDesde(a.fechaInscripcion) - diasDesde(b.fechaInscripcion));
        const mlabels = ["Ene", "Feb", "Mar", "Abr", "May", "Jun"];
        const filasMes = mlabels.map((lbl, i) => ({ lbl, v: personas.filter(p => p.fechaInscripcion && String(p.fechaInscripcion).slice(0, 7) === `2026-0${i + 1}`).length }));
        return kpiModal(nuevos.length, "Nuevos en los últimos 30 días",
          "Personas que se registraron o llegaron por primera vez en el último mes. Son la prioridad de bienvenida y acompañamiento.",
          "Personas cuya <b>fecha de inscripción / primera visita</b> está dentro de los últimos 30 días.",
          lineArea("Nuevos por mes (2026)", null, filasMes, "var(--etapa-crece)") + listaPersonas(nuevos, 10),
          goBtn("crm", "nuevos", "todos", "Ver nuevos en el CRM"));
      }
      case "diezman": {
        const diez = personas.filter(p => p.diezma);
        return kpiModal(diez.length.toLocaleString("es-CO"), "Personas que diezman",
          "Cuántas personas sostienen la obra con su diezmo. Es un indicador de compromiso y madurez, no de recaudo.",
          "Personas con estado <b>diezma = sí</b>. 🔒 Por la Ley 1581/2012 el <b>monto por persona</b> es exclusivo de la Dirección General; aquí solo se cuenta cuántas diezman.",
          columns("Personas que diezman por ministerio", null, porMin(p => p.diezma), () => "var(--mostaza-500)"),
          goBtn("crm", "diezma", "todos", "Ver quiénes diezman"));
      }
      case "consejerias": {
        const act = P.CONSEJERIAS.filter(c => c.estado === "Activa");
        const filas = P.CONSEJERIAS.map(c => `<div class="ps-mini-row"><div class="ps-mini-row__main"><b>${esc(c.persona)}</b><small>${esc(c.ministerio)} · ${esc(c.tipo)} · con ${esc(c.consejero)}</small></div><span class="ps-estado ps-estado--${c.estado === "Activa" ? "orando" : c.estado === "Cerrada" ? "respondida" : "abierta"}">${esc(c.estado)}</span></div>`).join("");
        return kpiModal(act.length, "Consejerías activas",
          "Procesos de consejería pastoral en curso. Cada uno es una persona siendo acompañada de cerca por un consejero.",
          "Consejerías con estado <b>Activa</b> (de " + P.CONSEJERIAS.length + " registradas). Las notas son confidenciales del consejero y el pastor.",
          `<div class="dr-card"><h3 class="dr-card__t">Consejerías de la sede</h3><div class="ps-mini-list">${filas}</div></div>`,
          "");
      }
      case "ayudas": {
        const filas = P.AYUDAS_MAS.map(a => `<div class="ps-mini-row"><div class="ps-mini-row__main"><b>${esc(a.persona)}</b><small>${esc(a.ministerio)} · ${esc(a.tipo)} · ${esc(a.monto)}</small></div><span class="ps-estado ps-estado--${a.estado === "Aprobada" ? "respondida" : "abierta"}">${esc(a.estado)}</span></div>`).join("");
        return kpiModal(P.AYUDAS_MAS.length, "Ayudas Fundación M.A.S",
          "Solicitudes de ayuda social gestionadas por la Fundación M.A.S para familias y personas de la sede en necesidad.",
          "Conteo de solicitudes registradas (mercado, salud, educación, arriendo, empleo…) y su estado de aprobación.",
          `<div class="dr-card"><h3 class="dr-card__t">Solicitudes M.A.S</h3><div class="ps-mini-list">${filas}</div></div>`,
          "");
      }
      case "sincontactar": {
        const sc = personas.filter(p => p.contactado === false);
        return kpiModal(sc.length, "Personas sin contactar",
          "Personas (muchas recién llegadas) a las que aún nadie ha hecho seguimiento. Es una alerta pastoral: nadie debería quedarse solo.",
          "Personas con bandera <b>contactado = no</b> en el CRM. Idealmente este número debe tender a cero.",
          columns("Sin contactar por ministerio", null, porMin(p => p.contactado === false), () => "var(--mostaza-500)") + listaPersonas(sc, 10),
          goBtn("crm", "sincontactar", "todos", "Ver y contactar en el CRM"));
      }
      case "tipos": {
        const cong = P.MIN_DEFS.filter(m => m.tipo === "congregacional"), oper = P.MIN_DEFS.filter(m => m.tipo === "operativo");
        return kpiModal(cong.length + "+" + oper.length, "Congregacionales + operativos",
          "Los ministerios se dividen en <b>congregacionales</b> (acompañan a las personas por etapa de vida) y <b>operativos</b> (hacen posible el domingo).",
          "<b>" + cong.length + "</b> ministerios congregacionales y <b>" + oper.length + "</b> equipos operativos activos.",
          donut("Congregacionales vs operativos", null, [{ lbl: "Congregacionales", v: cong.length, color: "var(--azul-600)" }, { lbl: "Operativos", v: oper.length, color: "var(--mostaza-500)" }]),
          goBtn("crm", "todos", "todos", "Ver el CRM"));
      }
    }
  }

  /* ============================================================ 2. CRM TOTAL */
  const CRM_COLS = [
    { id: "nombre", lbl: "Persona" }, { id: "cedula", lbl: "ID" }, { id: "ministerio", lbl: "Ministerio" }, { id: "grupo", lbl: "Grupo" },
    { id: "etapa", lbl: "Etapa" }, { id: "edad", lbl: "Edad" }, { id: "estadoCivil", lbl: "Estado civil" },
    { id: "sirve", lbl: "Sirve" }, { id: "diezma", lbl: "Diezma" },
  ];
  /* ============================================================ TAREAS
     Panel de "mantener el sistema al día": reúne, desde todos los módulos, lo
     que necesita atención (registros del domingo, nuevos sin contactar,
     requerimientos, oración, accesos, cursos) con acceso directo a resolverlo. */
  function ultimoDomingoISO() {
    const d = new Date(); const sun = new Date(d); sun.setDate(d.getDate() - d.getDay()); sun.setHours(0, 0, 0, 0);
    return sun.toISOString().slice(0, 10);
  }
  function vistaTareas() {
    const reg = registroSede();
    const sinContactar = reg.filter(p => p.contactado === false).length;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const cumpleProx = reg.filter(p => {
      if (!p.cumpleMes || !p.cumpleDia) return false;
      let d = new Date(hoy.getFullYear(), p.cumpleMes - 1, p.cumpleDia);
      if (d < hoy) d = new Date(hoy.getFullYear() + 1, p.cumpleMes - 1, p.cumpleDia);
      const diff = (d - hoy) / 86400000;
      return diff >= 0 && diff <= 7;
    }).length;
    const reqAbiertos = PS.requerimientos().filter(r => r.estado !== "Resuelto").length;
    const petAbiertas = peticionesSede().filter(p => !p.interna && p.estado === "abierta").length;
    const accesosPend = PS.sistemas().filter(s => s.enOrganigrama && (!s.acceso || s.acceso.estado !== "activo")).length;
    const cursosOcultos = (window.STORE && window.STORE.cursos ? window.STORE.cursos() : []).filter(c => !c.activo).length;
    const domISO = ultimoDomingoISO();
    const ing = PS.ingresosDomingo ? PS.ingresosDomingo() : [];
    const asi = PS.asistencias ? PS.asistencias() : [];
    const diezmoPend = ing.some(d => (d.fecha || "") >= domISO) ? 0 : 1;
    const asisPend = asi.some(d => (d.fecha || "") >= domISO) ? 0 : 1;

    const tareas = [
      { ico: "📅", tit: "Registrar el diezmo del domingo", desc: "Sube el diezmo (por servicio) del último domingo.", n: diezmoPend, vista: "finanzas", sev: "alta", cta: "Ir a Finanzas" },
      { ico: "📋", tit: "Marcar la asistencia del domingo", desc: "Registra la asistencia por servicio del último domingo.", n: asisPend, vista: "asistencia", sev: "alta", cta: "Ir a Asistencia" },
      { ico: "📞", tit: "Nuevos sin contactar", desc: "Personas que llegaron y aún no han sido contactadas.", n: sinContactar, vista: "crm", filtro: "sincontactar", sev: "alta", cta: "Ver en el CRM" },
      { ico: "🎂", tit: "Cumpleaños esta semana", desc: "Acompaña con un saludo a quienes cumplen en los próximos 7 días.", n: cumpleProx, vista: "crm", sev: "media", cta: "Ver en el CRM" },
      { ico: "🎫", tit: "Requerimientos abiertos", desc: "Solicitudes a la administración pendientes de resolver.", n: reqAbiertos, vista: "requerimientos", sev: "media", cta: "Ir a Requerimientos" },
      { ico: "🙏", tit: "Peticiones de oración por atender", desc: "Peticiones abiertas sin asignar a intercesión.", n: petAbiertas, vista: "oracion", sev: "media", cta: "Ir a Oración" },
      { ico: "⚙️", tit: "Accesos de director sin repartir", desc: "Cuadros del organigrama con su sistema creado pero sin acceso activo.", n: accesosPend, vista: "organigrama", sev: "media", cta: "Ir al Organigrama" },
      { ico: "🎓", tit: "Cursos sin publicar", desc: "Cursos creados que aún no están visibles en el landing.", n: cursosOcultos, vista: "cursos", sev: "baja", cta: "Ir a Cursos" },
    ];
    const pend = tareas.filter(t => t.n > 0);
    const alDia = tareas.filter(t => t.n === 0);
    const urgentes = pend.filter(t => t.sev === "alta").length;
    const fila = t => `<div class="ps-task ps-task--${t.n > 0 ? "pend" : "ok"}">
        <div class="ps-task__ico">${t.ico}</div>
        <div class="ps-task__main">
          <b>${esc(t.tit)} ${t.n > 0 ? `<span class="ps-task__badge">${t.n}</span>` : '<span class="ps-task__done">✓ al día</span>'}</b>
          <small>${esc(t.desc)}</small>
        </div>
        <button class="dr-btn ${t.n > 0 ? "dr-btn--primary" : "dr-btn--ghost"} dr-btn--sm" data-accion="kpi-go" data-vista="${t.vista}" ${t.filtro ? `data-filtro="${t.filtro}"` : ""}>${esc(t.cta)} →</button>
      </div>`;
    return shell(`
      <div class="dr-head"><div>
        <h1 class="dr-h1">Tareas · mantener el sistema al día</h1>
        <p class="dr-lead">Todo lo que necesita tu atención para mantener la sede al día: registros del domingo, seguimiento de nuevos, requerimientos, oración, accesos y cursos. Cada tarea te lleva directo a donde se resuelve.</p>
      </div></div>
      <div class="dr-kpis">
        ${kpi(pend.length, "Tareas pendientes")}
        ${kpi(urgentes, "Urgentes")}
        ${kpi(alDia.length, "Al día")}
      </div>
      <div class="dr-card"><h3 class="dr-card__t">Pendientes (${pend.length})</h3>
        <div class="ps-tasks">${pend.map(fila).join("") || '<p class="dr-card__sub">🎉 ¡Todo al día! No hay tareas pendientes.</p>'}</div>
      </div>
      ${alDia.length ? `<div class="dr-card"><h3 class="dr-card__t">Al día (${alDia.length})</h3><div class="ps-tasks">${alDia.map(fila).join("")}</div></div>` : ""}
    `);
  }

  function vistaCRM() {
    let reg = registroSede();
    const totalReg = reg.slice();
    // filtro por ministerio
    if (crmMin !== "todos") reg = reg.filter(p => p.ministerioId === crmMin);
    // filtro rápido
    if (crmFiltro === "sirve") reg = reg.filter(p => p.sirve);
    else if (crmFiltro === "diezma") reg = reg.filter(p => p.diezma);
    else if (crmFiltro === "nodiezma") reg = reg.filter(p => !p.diezma);
    else if (crmFiltro === "nuevos") reg = reg.filter(p => diasDesde(p.fechaInscripcion) <= 30);
    else if (crmFiltro === "sincontactar") reg = reg.filter(p => p.contactado === false);
    else if (["conoce", "conecta", "crece", "sirve4"].includes(crmFiltro)) reg = reg.filter(p => p.etapa === (crmFiltro === "sirve4" ? "sirve" : crmFiltro));

    // orden
    const dir = crmDir;
    reg.sort((a, b) => {
      let va, vb;
      switch (crmSort) {
        case "nombre": va = nombreCompleto(a).toLowerCase(); vb = nombreCompleto(b).toLowerCase(); break;
        case "cedula": va = window.CEDULA(a, { raw: true }); vb = window.CEDULA(b, { raw: true }); break;
        case "edad": va = a.edad || 0; vb = b.edad || 0; break;
        case "sirve": va = a.sirve ? 1 : 0; vb = b.sirve ? 1 : 0; break;
        case "diezma": va = a.diezma ? 1 : 0; vb = b.diezma ? 1 : 0; break;
        default: va = (a[crmSort] || "").toString().toLowerCase(); vb = (b[crmSort] || "").toString().toLowerCase();
      }
      return va < vb ? -dir : va > vb ? dir : 0;
    });

    const th = CRM_COLS.map(c => `<th class="dr-th-sort ${crmSort === c.id ? "is-sort" : ""}" data-accion="crm-sort" data-col="${c.id}">${c.lbl}${crmSort === c.id ? (crmDir === 1 ? " ▲" : " ▼") : ""}</th>`).join("") + "<th></th>";

    const filas = reg.map(p => `<tr data-search="${esc((nombreCompleto(p) + " " + p.correo + " " + p.ministerio + " " + (p.grupo || "") + " " + window.CEDULA(p) + " " + window.CEDULA(p, { raw: true })).toLowerCase())}">
      <td><div class="dr-cell-person"><span class="dr-mini-avatar">${esc(iniciales(p))}</span><div><b>${esc(nombreCompleto(p))}</b><small>${esc(p.correo)}</small></div></div></td>
      <td class="ps-num">${window.CEDULA(p)}</td>
      <td><span class="ps-tag">${esc(p.ministerio)}</span></td>
      <td>${esc(p.grupo || "—")}</td>
      <td>${chip(p.etapa)}</td>
      <td>${p.edad || "—"}</td>
      <td>${esc(p.estadoCivil)}</td>
      <td>${p.sirve ? '<span class="ps-yes">✓ Sí</span>' : '<span class="ps-no">—</span>'}</td>
      <td>${p.diezma ? '<span class="ps-yes">💛 Sí</span>' : '<span class="ps-no">No</span>'}</td>
      <td><button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="ver-persona" data-id="${p.id}">Ver →</button></td>
    </tr>`).join("");

    const minOpts = `<option value="todos">Todos los ministerios</option>` + P.MIN_DEFS.map(m => `<option value="${m.id}" ${crmMin === m.id ? "selected" : ""}>${esc(m.nombre)}</option>`).join("");

    return shell(`
      <div class="dr-head"><div>
        <h1 class="dr-h1">CRM total de la sede</h1>
        <p class="dr-lead">Todas las personas del sistema, de todos los ministerios. Busca, filtra y abre el perfil 360°. La columna <b>Diezma</b> muestra solo sí/no — el monto por persona es exclusivo de la Dirección General.</p>
      </div></div>

      <div class="dr-toolbar">
        <input id="ps-crm-search" class="dr-search" type="search" placeholder="🔍 Buscar por nombre, correo, ministerio o grupo…" aria-label="Buscar personas" />
        <select class="dr-select" data-accion="crm-min">${minOpts}</select>
      </div>
      <div class="dr-filtros">
        ${[["todos", "Todos"], ["sirve", "Sirven"], ["diezma", "Diezman"], ["nodiezma", "No diezman"], ["nuevos", "Nuevos 30d"], ["sincontactar", "Sin contactar"], ["conoce", "Conoce"], ["conecta", "Conéctate"], ["crece", "Crece"], ["sirve4", "Sirve"]]
        .map(([id, lbl]) => `<button class="dr-filtro ${crmFiltro === id ? "is-active" : ""}" data-accion="crm-filtro" data-f="${id}">${lbl}</button>`).join("")}
      </div>
      <p class="dr-card__sub">Mostrando <b id="ps-crm-count">${reg.length}</b> de ${totalReg.length} personas.</p>
      <div class="dr-tablewrap">
        <table class="dr-table"><thead><tr>${th}</tr></thead><tbody id="ps-crm-body">${filas}</tbody></table>
      </div>
    `);
  }

  /* Punto 7 · diezmo de los últimos 3 meses como checklist (sí/no, SIN monto).
     El pastor solo puede ver sí/no + frecuencia (el monto es exclusivo de la
     Dirección General). El patrón es determinista por persona para que sea
     estable entre renders; en Fase 1 vendrá del histórico real de donaciones. */
  function diezmo3Meses(p) {
    const now = new Date();
    const base = (window.CEDULA && window.CEDULA.raw) ? window.CEDULA.raw(p) : (p.id || p.correo || "");
    const semilla = parseInt(String(base).replace(/\D/g, "").slice(-5) || "0", 10) || 0;
    const out = [];
    for (let k = 2; k >= 0; k--) {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
      const mes = MESES[d.getMonth()] + " " + String(d.getFullYear()).slice(2);
      let diezmo = false;
      if (p.diezma) {
        // el mes más reciente casi siempre sí; meses previos, variables pero estables
        const s = (semilla + d.getMonth() * 7) % 10;
        diezmo = k === 0 ? true : s >= (k === 1 ? 3 : 5);
      }
      out.push({ mes, diezmo });
    }
    return out;
  }

  /* Punto 9 · Formación del servidor: cursos cortos + Institutos IBLI (1–4) y
     FACTER (5–8). FACTER NO se habilita si no completó IBLI. Progreso
     determinista por persona (estable entre renders); en Fase 1 viene del LMS. */
  function _semilla(p) {
    const raw = (window.CEDULA && window.CEDULA.raw) ? window.CEDULA.raw(p) : (p.id || p.correo || "");
    return parseInt(String(raw).replace(/\D/g, "").slice(-4) || "0", 10) || 0;
  }
  function formacionDe(p) {
    const cur = p.cursos;
    const has = key => Array.isArray(cur) ? cur.includes(key) : (cur && typeof cur === "object") ? (cur[key] === "ok" || cur[key] === true) : false;
    const enCurso = key => (cur && typeof cur === "object" && cur[key] === "curso");
    const seed = _semilla(p);
    let ibli = 0;
    if (has("ibli")) ibli = 4;
    else if (enCurso("ibli")) ibli = 1 + (seed % 3);
    else if (p.etapa === "crece" || p.etapa === "sirve") ibli = (seed % 5 >= 3) ? (1 + seed % 4) : 0;
    ibli = Math.max(0, Math.min(4, ibli));
    let facter = 0;
    if (ibli >= 4) {
      if (has("facter")) facter = 8;
      else if (enCurso("facter")) facter = 5 + (seed % 3);
      else facter = (seed % 4 === 0) ? (5 + seed % 4) : 0;
      if (facter) facter = Math.max(5, Math.min(8, facter));
    }
    return { has, enCurso, ibli, facter, ibliDone: ibli >= 4 };
  }
  function consejeriaDe(p) {
    const seed = _semilla(p);
    const veces = seed % 4; // 0..3
    const consejeros = ["Ps. Andrea Pineda (Directora)", "Coord. Marcela Ríos", "Consejero David Mora", "Consejera Paula Nieto"];
    const temas = ["Acompañamiento personal", "Consejería de pareja", "Proceso de duelo", "Finanzas familiares", "Propósito y vocación"];
    const sesiones = [];
    for (let i = 0; i < veces; i++) {
      const m = 3 + ((seed + i * 2) % 5); // mar..jul
      const dia = 3 + ((seed + i * 7) % 25);
      sesiones.push({ fecha: `2026-${String(m).padStart(2, "0")}-${String(dia).padStart(2, "0")}`, consejero: consejeros[(seed + i) % consejeros.length], tema: temas[(seed + i * 3) % temas.length] });
    }
    return { veces, sesiones };
  }
  function modalInstituto(id, cual) {
    const p = registroSede().find(x => x.id === id); if (!p) return;
    const F = formacionDe(p);
    const esIbli = cual === "ibli";
    if (!esIbli && !F.ibliDone) { toast("FACTER se habilita al completar IBLI (4/4)", false); return; }
    const nums = esIbli ? [1, 2, 3, 4] : [5, 6, 7, 8];
    const actual = esIbli ? F.ibli : F.facter;
    const semLbl = esIbli ? "IBLI" : "FACTER";
    const desc = esIbli
      ? "Primer instituto (semestres 1 a 4). Base bíblica y de identidad."
      : "Segundo instituto (semestres 5 a 8). Formación de liderazgo. Requiere IBLI completo.";
    const items = nums.map(n => {
      const estado = actual >= n ? (actual === n ? "actual" : "hecho") : "pend";
      const ic = estado === "hecho" ? "✓" : estado === "actual" ? "◔" : "○";
      const lbl = estado === "hecho" ? "Cursado" : estado === "actual" ? "En curso" : "Pendiente";
      return `<div class="ps-sem ps-sem--${estado}"><span class="ps-sem__n">${ic} Semestre ${n}</span><span class="ps-sem__st">${lbl}</span></div>`;
    }).join("");
    abrirModal(`
      <h2 id="dr-modal-t">${semLbl} · ${esc(nombreCompleto(p))}</h2>
      <p class="dr-card__sub">${desc}</p>
      <p class="ps-inst-actual">${actual > 0 ? `Va en <b>${semLbl} ${actual}${esIbli ? " de 4" : " de 8"}</b>.` : `Aún no ha iniciado ${semLbl}.`}</p>
      <div class="ps-sem-list">${items}</div>
      <div class="dr-modal__actions"><button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cerrar</button></div>
    `);
  }
  function modalConsejeria(id) {
    const p = registroSede().find(x => x.id === id); if (!p) return;
    const C = consejeriaDe(p);
    const filas = C.sesiones.length
      ? C.sesiones.map(s => `<div class="ps-fact-row">
          <div class="ps-fact-row__main"><b>${esc(s.tema)}</b><small>Tomada por ${esc(s.consejero)}</small></div>
          <span class="ps-pet-fecha">${fechaCorta(s.fecha)}</span>
        </div>`).join("")
      : `<p class="dr-card__sub">Esta persona no tiene consejerías registradas.</p>`;
    abrirModal(`
      <h2 id="dr-modal-t">Consejería · ${esc(nombreCompleto(p))}</h2>
      <p class="dr-card__sub">Historial de consejerías: cuándo, quién la tomó y el tema. 🔒 Confidencial. Anclado al sistema de Consejería.</p>
      <div class="dr-kpis"><div class="dr-kpi"><b>${C.veces}</b><span>Consejerías registradas</span></div></div>
      <div class="ps-fact-list">${filas}</div>
      <div class="dr-modal__actions"><button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cerrar</button></div>
    `);
  }

  function modalPersona(id) {
    const p = registroSede().find(x => x.id === id);
    if (!p) return;
    const g = generoDe(p);
    const F = formacionDe(p);
    const C = consejeriaDe(p);
    const cursoChip = (key, lbl) => {
      const st = F.has(key) ? "ok" : F.enCurso(key) ? "curso" : "pend";
      const ic = st === "ok" ? "✓" : st === "curso" ? "◔" : "○";
      return `<span class="ps-curso-chip ps-curso-chip--${st}">${ic} ${esc(lbl)}</span>`;
    };
    abrirModal(`
      <div class="dr-modal__head">
        <div class="dr-avatar dr-avatar--lg">${esc(iniciales(p))}</div>
        <div><h2 id="dr-modal-t">${esc(nombreCompleto(p))}</h2>
          <p class="dr-card__sub">${esc(p.ministerio)} · ${esc(p.grupo || "Sin grupo")} ${chip(p.etapa)}</p></div>
      </div>
      <div class="ps-perfil-grid">
        <div><span>ID (Cédula)</span><b>🪪 ${window.CEDULA(p)}</b></div>
        <div><span>Correo</span><b>${esc(p.correo)}</b></div>
        <div><span>Teléfono</span><b>${esc(p.telefono)}</b></div>
        <div><span>Edad</span><b>${p.edad || "—"} años</b></div>
        <div><span>Género</span><b>${g === "F" ? "Femenino" : "Masculino"}</b></div>
        <div><span>Estado civil</span><b>${esc(p.estadoCivil)}</b></div>
        <div><span>Cómo llegó</span><b>${esc(p.fuente)}</b></div>
        <div><span>Primera fecha</span><b>${fechaCorta(p.fechaInscripcion)}</b></div>
        <div><span>Sirve</span><b>${p.sirve ? "Sí, es servidor" : "Aún no sirve"}</b></div>
      </div>
      <div class="ps-diezmo-box">
        <div class="ps-diezmo-box__main">
          <span>Estado de diezmo</span>
          <b>${p.diezma ? "💛 Diezma · " + esc(p.diezmaFrecuencia || "Sí") : "No diezma actualmente"}</b>
        </div>
        <div class="ps-diezmo-check" role="group" aria-label="Diezmo últimos 3 meses">
          <span class="ps-diezmo-check__lbl">Últimos 3 meses</span>
          ${diezmo3Meses(p).map(m => `<span class="ps-diezmo-mes ${m.diezmo ? "is-si" : "is-no"}">${m.diezmo ? "✓" : "✕"} ${esc(m.mes)}</span>`).join("")}
        </div>
        <p class="ps-diezmo-box__nota">🔒 Solo sí/no por mes — el monto por persona es exclusivo de la Dirección General (Ley 1581/2012).</p>
      </div>
      <div class="ps-perfil-cursos">
        <span>Formación · cursos</span>
        <div class="ps-cursos-row">${cursoChip("adn", "ADN")}${cursoChip("bautizo", "Bautizo")}${cursoChip("llaves", "Llaves del Poder")}${cursoChip("madurez", "Madurez Espiritual")}</div>
        <div class="ps-inst-row">
          <button class="ps-inst-btn" data-accion="ver-ibli" data-id="${p.id}">🎓 IBLI · ${F.ibli > 0 ? F.ibli + "/4" : "sin iniciar"}</button>
          ${F.ibliDone
        ? `<button class="ps-inst-btn" data-accion="ver-facter" data-id="${p.id}">🎓 FACTER · ${F.facter > 0 ? F.facter + "/8" : "sin iniciar"}</button>`
        : `<button class="ps-inst-btn ps-inst-btn--lock" disabled title="FACTER se habilita al completar IBLI">🔒 FACTER · requiere IBLI</button>`}
        </div>
      </div>
      <div class="ps-perfil-cursos">
        <span>Consejería</span>
        <div class="ps-inst-row"><button class="ps-inst-btn" data-accion="ver-consejeria" data-id="${p.id}">💬 Ver consejerías · ${C.veces > 0 ? C.veces + (C.veces === 1 ? " sesión" : " sesiones") : "sin registros"}</button></div>
      </div>
      <div class="dr-modal__actions">
        <a class="dr-btn dr-btn--ok" href="${waLink(p.telefono, p.nombres)}" target="_blank" rel="noopener">💬 WhatsApp</a>
        <a class="dr-btn dr-btn--primary" href="${mailLink(p.correo, p.nombres)}" target="_blank" rel="noopener">✉️ Correo</a>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cerrar</button>
      </div>
    `);
  }

  /* ============================================================ 3. FINANZAS */
  function vistaFinanzas() {
    const F = P._seed.FINANZAS;
    const tabs = [["ingresos", "💵 Ingresos por domingo"], ["presupuesto", "📊 Presupuesto por ministerio"], ["gastos", "🧾 Gastos de servicios"], ["proyectos", "🏗️ Proyectos"]];
    let body = "";

    if (finTab === "ingresos") {
      const rawIng = (PS.ingresosDomingo ? PS.ingresosDomingo() : F.ingresosDomingo);
      const ingD = aggPorDomingo(rawIng); // por domingo (suma de servicios)
      const ptsD = ingD.map(d => ({ lbl: d.f, v: Math.round(d.diezmos * 10) / 10 }));
      const ptsO = ingD.map(d => ({ lbl: d.f, v: Math.round(d.ofrendas * 10) / 10 }));
      const totMes = ingD.slice(-4).reduce((s, d) => s + d.diezmos + d.ofrendas, 0);
      const ultD = ingD[ingD.length - 1] || { diezmos: 0, ofrendas: 0, f: "" };
      const ultF = ultD.f;
      const porServicio = SERVICIOS.map(s => ({ lbl: s, v: Math.round(rawIng.filter(d => d.f === ultF && (d.servicio || "General") === s).reduce((a, d) => a + (d.diezmos || 0), 0) * 10) / 10 }));
      if (!porServicio.reduce((a, b) => a + b.v, 0)) porServicio.push({ lbl: "General (sin desglose)", v: Math.round(ultD.diezmos * 10) / 10 });
      body = `
        <div class="ps-card-head" style="margin-bottom:var(--sp-3)">
          <div>
            <h3 class="dr-card__t">Ingresos por domingo</h3>
            <p class="dr-card__sub">Cada domingo sube el <b>diezmo</b> (y la ofrenda) de tu iglesia <b>por servicio</b> (${SERVICIOS.join(" · ")}): se agrega al sistema y actualiza los indicadores. Solo ves <b>${esc(USER.sede)}</b>.</p>
          </div>
          <button class="dr-btn dr-btn--primary" data-accion="nuevo-diezmo">＋ Añadir diezmo</button>
        </div>
        <div class="dr-kpis">
          ${kpi(mCOP(ultD.diezmos), "Diezmos · último domingo")}
          ${kpi(mCOP(ultD.ofrendas), "Ofrendas · último domingo")}
          ${kpi(mCOP(totMes), "Ingresos últimas 4 sem.")}
        </div>
        <div class="dr-grid2">
          ${lineArea("Diezmos por domingo reportado", "Millones COP", ptsD, "var(--azul-600)", mCOP)}
          ${lineArea("Ofrendas por domingo", "Millones COP", ptsO, "var(--mostaza-500)", mCOP)}
        </div>
        ${barChart("Diezmos por servicio · último domingo (" + esc(ultF) + ")", "Millones COP", porServicio, () => "var(--azul-500)", mCOP)}
      `;
    } else if (finTab === "presupuesto") {
      const presup = PS.presupuesto();
      const filas = presup.map(r => {
        const oc = pct(r.ejecutado, r.asignado);
        const cls = oc >= 100 ? "ps-bad" : oc >= 80 ? "ps-warn" : "ps-ok";
        return `<tr class="ps-row-edit" data-accion="presup-edit" data-min="${esc(r.min)}" role="button" tabindex="0" title="Clic para editar el presupuesto de ${esc(r.min)}">
          <td><b>${esc(r.min)}</b></td><td>${mCOP(r.asignado)}</td><td>${mCOP(r.ejecutado)}</td>
          <td><div class="ps-progress"><span class="${cls}" style="width:${Math.min(100, oc)}%"></span></div></td>
          <td class="ps-num ${cls}">${oc}%</td>
          <td><button class="dr-iconbtn" data-accion="presup-edit" data-min="${esc(r.min)}" title="Editar ${esc(r.min)}">✎</button></td></tr>`;
      }).join("");
      const sumA = presup.reduce((s, r) => s + r.asignado, 0), sumE = presup.reduce((s, r) => s + r.ejecutado, 0);
      body = `
        <div class="dr-kpis">
          ${kpi(mCOP(sumA), "Presupuesto asignado / mes")}
          ${kpi(mCOP(sumE), "Ejecutado / mes")}
          ${kpi(pct(sumE, sumA) + "%", "Ejecución global")}
        </div>
        <div class="dr-card"><h3 class="dr-card__t">Presupuesto por ministerio</h3>
          <p class="dr-card__sub">✎ Toca cualquier fila para ajustar el monto asignado o ejecutado de ese ministerio.</p>
          <div class="dr-tablewrap"><table class="dr-table"><thead><tr><th>Ministerio</th><th>Asignado</th><th>Ejecutado</th><th>Ejecución</th><th></th><th></th></tr></thead><tbody>${filas}</tbody></table></div>
        </div>`;
    } else if (finTab === "gastos") {
      const gastos = PS.gastos();
      const conFactura = gastos.filter(r => r.archivo).length;
      const filas = gastos.map(r => {
        const soporte = r.archivo
          ? `<a class="ps-factura-link" data-accion="ver-factura" data-id="${r.id}" title="Ver soporte: ${esc(r.archivo)}">📎 ${esc(r.archivo.length > 18 ? r.archivo.slice(0, 16) + "…" : r.archivo)}</a>`
          : `<span class="ps-pill ps-pill--warn">⚠ Sin factura</span>`;
        return `<tr>
          <td>${esc(fmtFechaCorta(r.fecha))}</td>
          <td><b>${esc(r.rubro)}</b>${r.proveedor ? `<br><span class="dr-card__sub">${esc(r.proveedor)}</span>` : ""}</td>
          <td><span class="ps-tag">${esc(r.min)}</span></td>
          <td>${r.factura ? esc(r.factura) : "—"}</td>
          <td>${soporte}</td>
          <td class="ps-num">${mCOP(r.monto)}</td>
          <td><button class="dr-iconbtn" data-accion="del-gasto" data-id="${r.id}" title="Quitar gasto">✕</button></td>
        </tr>`;
      }).join("");
      const tot = gastos.reduce((s, r) => s + r.monto, 0);
      body = `
        <div class="dr-kpis">${kpi(mCOP(tot), "Gastos de servicios / mes")}${kpi(gastos.length, "Rubros")}${kpi(conFactura + "/" + gastos.length, "Con factura adjunta")}</div>
        ${barChart("Gastos por rubro", "Millones COP / mes", gastos.map(r => ({ lbl: r.rubro, v: r.monto })), () => "var(--azul-500)", mCOP)}
        <div class="dr-card">
          <div class="ps-card-head"><h3 class="dr-card__t">Detalle de gastos discriminados</h3>
            <button class="dr-btn dr-btn--primary dr-btn--sm" data-accion="nuevo-gasto">＋ Registrar gasto</button></div>
          <p class="dr-card__sub">Digita cada servicio gastado y adjunta la factura como soporte. Los gastos sin factura quedan marcados ⚠.</p>
          <div class="dr-tablewrap"><table class="dr-table"><thead><tr><th>Fecha</th><th>Rubro</th><th>Asignado a</th><th>N° factura</th><th>Soporte</th><th>Monto</th><th></th></tr></thead><tbody>${filas}<tr class="ps-total"><td colspan="5"><b>Total</b></td><td class="ps-num"><b>${mCOP(tot)}</b></td><td></td></tr></tbody></table></div>
        </div>`;
    } else if (finTab === "proyectos") {
      if (proyDrill) {
        body = detalleProyecto(proyDrill);
      } else {
        const cards = F.proyectos.map(pr => {
          const oc = pct(pr.recaudado, pr.presupuesto);
          const facturado = (pr.facturas || []).reduce((s, f) => s + f.monto, 0);
          return `<div class="dr-card ps-proj-card" data-accion="ver-proyecto" data-id="${pr.id}" role="button" tabindex="0" aria-label="Abrir ${esc(pr.nombre)}">
            <div class="ps-proj-head"><b>${esc(pr.nombre)}</b>${pill(pr.estado, pr.estado === "Financiado" ? "ps-pill--ok" : "ps-pill--warn")}</div>
            <p class="dr-card__sub">Meta: ${fechaProy(pr.fecha)} · ${(pr.gastos || []).length} gastos previstos · ${(pr.facturas || []).length} facturas</p>
            <div class="ps-progress ps-progress--lg"><span class="ps-ok" style="width:${Math.min(100, oc)}%"></span></div>
            <div class="ps-proj-nums"><span>${mCOP(pr.recaudado)} recaudado</span><b>${oc}%</b><span>${mCOP(pr.presupuesto)} meta</span></div>
            <div class="ps-proj-foot"><span>📎 ${mCOP(facturado)} facturado</span><span class="ps-proj-link">Ver desglose →</span></div>
          </div>`;
        }).join("");
        body = `<p class="dr-card__sub">Toca un proyecto para ver sus gastos previstos discriminados y adjuntar facturas.</p><div class="dr-grid2">${cards}</div>`;
      }
    }

    return shell(`
      <div class="dr-head"><div>
        <h1 class="dr-h1">Finanzas de la sede</h1>
        <p class="dr-lead">Diezmos y ofrendas por domingo, presupuesto y gastos por ministerio, y proyectos. 🔒 El detalle del diezmo por persona es exclusivo de la Dirección General.</p>
      </div></div>
      <div class="dr-filtros ps-subnav">${tabs.map(([id, lbl]) => `<button class="dr-filtro ${finTab === id ? "is-active" : ""}" data-accion="fin-tab" data-t="${id}">${lbl}</button>`).join("")}</div>
      ${body}
    `);
  }
  /* --- Detalle de un proyecto: gastos previstos discriminados + facturas --- */
  function proyectoPorId(id) { return (P._seed.FINANZAS.proyectos || []).find(p => p.id === id); }
  function facturasDeGasto(pr, gid) { return (pr.facturas || []).filter(f => f.gastoId === gid); }
  function gastoEstadoCls(e) { return e === "Pagado" ? "ps-ok" : e === "Pendiente" ? "ps-warn" : "ps-bad"; }

  function detalleProyecto(id) {
    const pr = proyectoPorId(id);
    if (!pr) { proyDrill = null; return ""; }
    const gastos = pr.gastos || [];
    const totalGastos = gastos.reduce((s, g) => s + g.monto, 0);
    const facturado = (pr.facturas || []).reduce((s, f) => s + f.monto, 0);
    const oc = pct(pr.recaudado, pr.presupuesto);

    const filas = gastos.map(g => {
      const fs = facturasDeGasto(pr, g.id);
      const fact = fs.reduce((s, f) => s + f.monto, 0);
      const cls = gastoEstadoCls(g.estado);
      return `<tr>
        <td><b>${esc(g.concepto)}</b></td>
        <td class="ps-num">${mCOP(g.monto)}</td>
        <td><span class="ps-tag ${cls}">${esc(g.estado)}</span></td>
        <td class="ps-num">${fs.length ? mCOP(fact) : "—"}</td>
        <td><button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="adjuntar-factura" data-proy="${pr.id}" data-gasto="${g.id}">📎 Adjuntar</button></td>
      </tr>`;
    }).join("");

    const facturasHTML = (pr.facturas || []).length
      ? (pr.facturas || []).map(f => {
          const g = gastos.find(x => x.id === f.gastoId);
          return `<div class="ps-fact-row">
            <div class="ps-fact-row__main"><b>${esc(f.proveedor)}</b><small>N.º ${esc(f.numero)} · ${esc(g ? g.concepto : "—")} · ${fechaCorta(f.fecha)}</small></div>
            <a class="ps-fact-file" href="#" data-accion="ver-factura" data-id="${f.id}" data-proy="${pr.id}" title="${esc(f.archivo)}">📄 ${esc(f.archivo)}</a>
            <span class="ps-num"><b>${mCOP(f.monto)}</b></span>
          </div>`;
        }).join("")
      : `<p class="dr-card__sub">Aún no hay facturas adjuntas. Usa “📎 Adjuntar” en cada gasto.</p>`;

    return `
      <button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="proy-volver">← Volver a proyectos</button>
      <div class="dr-card ps-proj-detail-head">
        <div class="ps-proj-head"><h2 class="dr-card__t">${esc(pr.nombre)}</h2>${pill(pr.estado, pr.estado === "Financiado" ? "ps-pill--ok" : "ps-pill--warn")}</div>
        <p class="dr-card__sub">${esc(pr.descripcion || "")}</p>
        <p class="dr-card__sub">🏗️ ${esc(pr.responsable || "—")} · 🗓️ Meta: ${fechaProy(pr.fecha)}</p>
        <div class="ps-progress ps-progress--lg"><span class="ps-ok" style="width:${Math.min(100, oc)}%"></span></div>
        <div class="ps-proj-nums"><span>${mCOP(pr.recaudado)} recaudado</span><b>${oc}% financiado</b><span>${mCOP(pr.presupuesto)} meta</span></div>
      </div>
      <div class="dr-kpis">
        ${kpi(mCOP(pr.presupuesto), "Valor total del proyecto")}
        ${kpi(mCOP(totalGastos), "Suma de gastos previstos")}
        ${kpi(mCOP(facturado), "Facturado / soportado")}
        ${kpi(mCOP(Math.round((pr.presupuesto - facturado) * 10) / 10), "Por ejecutar")}
      </div>
      <div class="dr-card">
        <h3 class="dr-card__t">Gastos previstos discriminados</h3>
        <p class="dr-card__sub">El detalle de cada rubro suma el valor total del proyecto. Adjunta la factura de soporte en cada gasto.</p>
        <div class="dr-tablewrap"><table class="dr-table">
          <thead><tr><th>Concepto</th><th>Monto previsto</th><th>Estado</th><th>Facturado</th><th></th></tr></thead>
          <tbody>${filas}
            <tr class="ps-total"><td><b>Total del proyecto</b></td><td class="ps-num"><b>${mCOP(totalGastos)}</b></td><td></td><td class="ps-num"><b>${mCOP(facturado)}</b></td><td></td></tr>
          </tbody>
        </table></div>
      </div>
      <div class="dr-card">
        <div class="ps-proj-head"><h3 class="dr-card__t">Facturas adjuntas (${(pr.facturas || []).length})</h3>
          <button class="dr-btn dr-btn--primary dr-btn--sm" data-accion="adjuntar-factura" data-proy="${pr.id}">📎 Adjuntar factura</button></div>
        <div class="ps-fact-list">${facturasHTML}</div>
      </div>`;
  }

  function modalFactura(proyId, gastoId) {
    const pr = proyectoPorId(proyId);
    if (!pr) return;
    const gastos = pr.gastos || [];
    const opts = gastos.map(g => `<option value="${g.id}" ${g.id === gastoId ? "selected" : ""}>${esc(g.concepto)} (${mCOP(g.monto)})</option>`).join("");
    abrirModal(`
      <h2 id="dr-modal-t">Adjuntar factura</h2>
      <p class="dr-card__sub">Proyecto: <b>${esc(pr.nombre)}</b></p>
      <label class="dr-field"><span>Gasto al que corresponde</span><select id="ps-fac-gasto" class="dr-select">${opts}</select></label>
      <div class="dr-field-row">
        <label class="dr-field"><span>Proveedor</span><input id="ps-fac-prov" class="dr-input" placeholder="Ej. AudioPro Colombia" /></label>
        <label class="dr-field"><span>N.º de factura</span><input id="ps-fac-num" class="dr-input" placeholder="Ej. FV-1234" /></label>
      </div>
      <div class="dr-field-row">
        <label class="dr-field"><span>Monto (millones COP)</span><input id="ps-fac-monto" class="dr-input" type="number" step="0.1" min="0" placeholder="Ej. 12.5" /></label>
        <label class="dr-field"><span>Fecha</span><input id="ps-fac-fecha" class="dr-input" type="date" value="${hoyFactura()}" /></label>
      </div>
      <label class="dr-field"><span>Archivo de la factura (PDF o imagen)</span><input id="ps-fac-archivo" class="dr-input" type="file" accept=".pdf,.png,.jpg,.jpeg" /></label>
      <div class="dr-modal__actions">
        <button class="dr-btn dr-btn--primary" data-accion="guardar-factura" data-proy="${pr.id}">Guardar factura</button>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>
    `);
  }
  function hoyFactura() { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

  function fechaProy(s) { const [y, m] = String(s).split("-"); return (MESES_L[(+m) - 1] || m) + " " + y; }

  /* Punto 3 · el pastor sube el diezmo (y la ofrenda) del domingo */
  function etiquetaDomingo(iso) {
    const d = new Date(String(iso) + "T00:00:00");
    if (isNaN(d)) return String(iso);
    return d.getDate() + " " + MESES[d.getMonth()];
  }
  function modalDiezmo() {
    abrirModal(`
      <h2 id="dr-modal-t">Añadir diezmo del domingo</h2>
      <p class="dr-card__sub">Registra el <b>diezmo</b> (y la ofrenda) de tu iglesia <b>por servicio</b>. Se suma al sistema y actualiza los indicadores y el gráfico. En <b>millones de COP</b> (ej. 52.6 = $52.600.000).</p>
      <label class="dr-field"><span>Servicio</span><select id="ps-dz-servicio" class="dr-input">${SERVICIOS.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join("")}</select></label>
      <div class="dr-field-row">
        <label class="dr-field"><span>Diezmos del servicio (millones COP)</span><input id="ps-dz-diezmos" class="dr-input" type="number" step="0.1" min="0" placeholder="Ej. 18.5" /></label>
        <label class="dr-field"><span>Ofrendas (millones COP)</span><input id="ps-dz-ofrendas" class="dr-input" type="number" step="0.1" min="0" placeholder="Ej. 4.1" /></label>
      </div>
      <label class="dr-field"><span>Fecha del domingo</span><input id="ps-dz-fecha" class="dr-input" type="date" value="${hoyFactura()}" /></label>
      <div class="dr-modal__actions">
        <button class="dr-btn dr-btn--primary" data-accion="guardar-diezmo">Guardar diezmo</button>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>
    `);
  }

  /* ============================================================ ASISTENCIA (Punto 5)
     Nueva ventana: el pastor marca la asistencia de cada domingo para
     agregarla al sistema y llevar el gráfico de tracking del crecimiento. */
  function vistaAsistencia() {
    const raw = (PS.asistencias ? PS.asistencias() : []);
    const A = aggPorDomingo(raw); // por domingo (suma de servicios)
    const ult = A[A.length - 1] || { total: 0, nuevos: 0, f: "—" };
    const prev = A[A.length - 2] || null;
    const prom = A.length ? Math.round(A.reduce((s, d) => s + (d.total || 0), 0) / A.length) : 0;
    const delta = prev ? (ult.total - prev.total) : 0;
    const num = n => (n || 0).toLocaleString("es-CO");
    const ptsT = A.map(d => ({ lbl: d.f, v: d.total || 0 }));
    const ptsN = A.map(d => ({ lbl: d.f, v: d.nuevos || 0 }));
    // desglose por servicio del último domingo registrado
    const ultF = ult.f;
    const porServicio = SERVICIOS.map(s => ({ lbl: s, v: raw.filter(d => d.f === ultF && (d.servicio || "General") === s).reduce((a, d) => a + (d.total || 0), 0) }));
    if (!porServicio.reduce((a, b) => a + b.v, 0)) porServicio.push({ lbl: "General (sin desglose)", v: ult.total });
    const filas = raw.map((d, i) => ({ d, i })).reverse().map(({ d, i }) => `<tr>
        <td><b>${esc(d.f)}</b></td>
        <td>${esc(d.servicio || "General")}</td>
        <td class="ps-num">${num(d.total)}</td>
        <td class="ps-num">${num(d.nuevos)}</td>
        <td><button class="dr-iconbtn" data-accion="del-asistencia" data-idx="${i}" title="Quitar registro">✕</button></td>
      </tr>`).join("") || `<tr><td colspan="5"><i>Aún no has marcado ningún domingo.</i></td></tr>`;
    return shell(`
      <div class="dr-head"><div>
        <h1 class="dr-h1">Asistencia de la sede</h1>
        <p class="dr-lead">Marca la asistencia de cada domingo <b>por servicio</b> (${SERVICIOS.join(" · ")}) para agregarla al sistema y llevar el <b>tracking</b> del crecimiento. Solo ves la información de <b>${esc(USER.sede)}</b>.</p>
      </div>
      <button class="dr-btn dr-btn--primary" data-accion="nueva-asistencia">＋ Marcar asistencia</button></div>
      <div class="dr-kpis">
        ${kpi(num(ult.total), "Asistencia · último domingo (" + esc(ult.f) + ")")}
        ${kpi((delta >= 0 ? "▲ " : "▼ ") + num(Math.abs(delta)), "Vs. domingo anterior")}
        ${kpi(num(prom), "Promedio por domingo")}
        ${kpi(num(ult.nuevos), "Nuevos · último domingo")}
      </div>
      <div class="dr-grid2">
        ${lineArea("Asistencia por domingo (tracking)", "Personas", ptsT, "var(--azul-600)", num)}
        ${barChart("Nuevos por domingo", "Personas", ptsN, () => "var(--etapa-conoce)", num)}
      </div>
      ${barChart("Asistencia por servicio · último domingo (" + esc(ultF) + ")", "Personas", porServicio, () => "var(--azul-500)", num)}
      <div class="dr-card"><h3 class="dr-card__t">Domingos registrados</h3>
        <div class="dr-tablewrap"><table class="dr-table">
          <thead><tr><th>Domingo</th><th>Servicio</th><th>Asistencia</th><th>Nuevos</th><th></th></tr></thead>
          <tbody>${filas}</tbody>
        </table></div>
      </div>
    `);
  }
  function modalAsistencia() {
    abrirModal(`
      <h2 id="dr-modal-t">Marcar asistencia del domingo</h2>
      <p class="dr-card__sub">Registra cuántas personas asistieron este domingo. Se agrega al sistema y actualiza el gráfico de tracking.</p>
      <label class="dr-field"><span>Servicio</span><select id="ps-as-servicio" class="dr-input">${SERVICIOS.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join("")}</select></label>
      <div class="dr-field-row">
        <label class="dr-field"><span>Asistencia del servicio</span><input id="ps-as-total" class="dr-input" type="number" min="0" step="1" placeholder="Ej. 380" /></label>
        <label class="dr-field"><span>De ellos, nuevos</span><input id="ps-as-nuevos" class="dr-input" type="number" min="0" step="1" placeholder="Ej. 15" /></label>
      </div>
      <label class="dr-field"><span>Fecha del domingo</span><input id="ps-as-fecha" class="dr-input" type="date" value="${hoyFactura()}" /></label>
      <div class="dr-modal__actions">
        <button class="dr-btn dr-btn--primary" data-accion="guardar-asistencia">Guardar asistencia</button>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>
    `);
  }

  /* ============================================================ 4. ORGANIGRAMA */
  // Pestañas predeterminadas que recibe un sistema de director recién creado
  // (base en 0). Espejan la app del Director de Ministerio.
  const TABS_DIR_MIN = [
    { ico: "📊", lbl: "Analítica" }, { ico: "🗒️", lbl: "CRM" }, { ico: "👥", lbl: "Grupos pequeños" },
    { ico: "🤝", lbl: "Equipo" }, { ico: "🌱", lbl: "Nuevos" }, { ico: "🗂️", lbl: "Organigrama" },
    { ico: "📚", lbl: "Temáticas" }, { ico: "🙏", lbl: "Peticiones" }, { ico: "📅", lbl: "Calendario" },
  ];
  const TABS_DIR_EQ = TABS_DIR_MIN.filter(t => t.lbl !== "Nuevos");
  function tabsDeTipo(tipo) { return tipo === "dir-eq" ? TABS_DIR_EQ : TABS_DIR_MIN; }
  function esNodoDirector(nodo) {
    if (!nodo) return false;
    if (nodo.tipo === "dir-min" || nodo.tipo === "dir-eq") return true;
    return /^(Director|Directora|Líder|Lider)\b/.test(nodo.rol || "");
  }
  function labelTipo(tipo) { return tipo === "dir-eq" ? "Director de equipo" : "Director de ministerio"; }
  // Combina el organigrama del pastor (PSTORE) con el subárbol vivo de J+25 (DSTORE)
  function organigramaCombinado() {
    const base = PS.organigrama().map(n => {
      const o = Object.assign({}, n, { _editable: true });
      if (n.sistemaId) o._sis = PS.sistemaPorNodo(n.id);
      return o;
    });
    if (DS) {
      const j25 = DS.organigrama();
      // re-parent: raíz de J+25 (parent null) cuelga del nodo org_m_j25 del pastor
      j25.forEach(n => {
        base.push({ id: "j25_" + n.id, nombre: n.nombre, rol: n.rol, parent: n.parent ? "j25_" + n.parent : "org_m_j25", _editable: false, _live: true });
      });
    }
    // subárbol vivo de RocaKids: cuelga del nodo org_m_rocakids del pastor
    if (window.PASTOR_RK && window.PASTOR_RK.orgSubtree) {
      window.PASTOR_RK.orgSubtree().forEach(n => base.push(n));
    }
    return base;
  }
  // P3 ronda 2 · relacionar un cuadro de director con su ministerio y su equipo.
  function ministerioDeNodo(nodo) {
    const txt = ((nodo.rol || "") + " " + (nodo.nombre || "")).toLowerCase();
    return (P.MIN_DEFS || []).find(m => m.nombre && txt.includes(m.nombre.toLowerCase())) || null;
  }
  function equipoDeMinisterio(m) {
    if (!m) return [];
    return registroSede().filter(p => p.ministerioId === m.id || p.ministerio === m.nombre);
  }
  function vistaOrganigrama() {
    const nodos = organigramaCombinado();
    const hijos = par => nodos.filter(n => n.parent === par);
    function render(nodo) {
      const kids = hijos(nodo.id);
      const sis = nodo._sis;
      let chip = "";
      if (sis) {
        const ac = sis.acceso || {};
        const estado = ac.estado === "activo" ? { t: "Acceso activo", c: "ps-chip--ok" }
          : ac.estado === "enviado" ? { t: "Acceso enviado", c: "ps-chip--warn" }
            : { t: "Sin repartir acceso", c: "ps-chip--off" };
        chip = `<span class="ps-orgchip ${estado.c}" title="Estado del reparto del sistema">⚙️ ${esc(labelTipo(sis.tipo))} · ${estado.t}</span>`;
      }
      const esDir = esNodoDirector(nodo);
      const colapsado = !!orgColapsados[nodo.id];
      const tieneKids = kids.length > 0;
      // P3 · equipo del ministerio de este director (personas que sirven ahí)
      const min = esDir ? ministerioDeNodo(nodo) : null;
      const team = min ? equipoDeMinisterio(min) : [];
      const equipoAbierto = !!orgEquipoAbierto[nodo.id];
      return `<li>
        <div class="dr-org__node ${nodo._live ? "ps-org-live" : ""} ${sis ? "ps-org-sis" : ""}">
          <div class="dr-org__node-main">
            <b>${tieneKids ? `<button class="ps-org-collapse" data-accion="org-toggle" data-id="${nodo.id}" title="${colapsado ? "Expandir" : "Contraer"}">${colapsado ? "▸" : "▾"}</button>` : ""}${esc(nodo.nombre)}${nodo._live ? ' <span class="ps-live-badge" title="Sincronizado con el director">🔗</span>' : ""}</b>
            <span class="dr-org__rol">${esc(nodo.rol || "")}</span>
            ${chip}
            ${colapsado && tieneKids ? `<span class="ps-org-count" title="Cuadros ocultos">▸ ${kids.length}</span>` : ""}
            ${min && team.length ? `<button class="ps-org-teambtn" data-accion="org-equipo" data-id="${nodo.id}">${equipoAbierto ? "▾" : "▸"} 👥 Equipo (${team.length})</button>` : ""}
          </div>
          ${nodo._editable ? `<div class="dr-org__node-acts">
            ${esDir ? `<button class="dr-iconbtn ps-iconbtn--sis" data-accion="org-sistema" data-id="${nodo.id}" title="Ver / repartir sistema del director">⚙️</button>` : ""}
            <button class="dr-iconbtn" data-accion="org-add" data-id="${nodo.id}" title="Agregar debajo">＋</button>
            <button class="dr-iconbtn" data-accion="org-edit" data-id="${nodo.id}" title="Editar">✎</button>
            <button class="dr-iconbtn" data-accion="org-del" data-id="${nodo.id}" title="Quitar">✕</button>
          </div>` : ""}
        </div>
        ${equipoAbierto && team.length ? `<ul class="ps-org-team">${team.map(pp => `<li class="ps-org-team__item" data-accion="ver-persona" data-id="${pp.id}" role="button" tabindex="0"><span class="dr-mini-avatar">${esc(iniciales(pp))}</span><span class="ps-org-team__txt"><b>${esc(nombreCompleto(pp))}</b><small>${esc(pp.grupo || "Servicio")}${pp.sirve ? " · sirve" : ""}</small></span></li>`).join("")}</ul>` : ""}
        ${tieneKids && !colapsado ? `<ul>${kids.map(render).join("")}</ul>` : ""}
      </li>`;
    }
    const raices = nodos.filter(n => !n.parent);
    const conSis = PS.sistemas().filter(s => s.enOrganigrama).length;
    const zoomPct = Math.round(orgZoom * 100);
    return shell(`
      <div class="dr-head"><div>
        <h1 class="dr-h1">Organigrama de la sede</h1>
        <p class="dr-lead">Aquí <b>nacen los sistemas</b>: cada cuadro de <b>director</b> que creas provisiona su sistema completo (base en 0, con sus 9 pestañas) y le <b>reparte el acceso</b>. <b>RocaKids</b> queda anclado 100% a su app; los demás ministerios, anclados 100% al sistema del pastor. Lo que el director cree debajo queda visible para ti.</p>
      </div>
      <button class="dr-btn dr-btn--primary" data-accion="org-add" data-id="">＋ Agregar cuadro</button></div>
      <div class="ps-org-toolbar">
        <div class="ps-org-legend"><span class="ps-orgchip ps-chip--ok">⚙️ ${conSis} sistema${conSis === 1 ? "" : "s"} de director activo${conSis === 1 ? "" : "s"}</span></div>
        <div class="ps-org-controls">
          <button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="org-expand-all" title="Expandir todo">⤢ Expandir todo</button>
          <button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="org-collapse-all" title="Contraer todo">⤡ Contraer todo</button>
          <span class="ps-org-zoom">
            <button class="dr-iconbtn" data-accion="org-zoom-out" title="Alejar (zoom −)">−</button>
            <button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="org-zoom-reset" title="Restablecer zoom">${zoomPct}%</button>
            <button class="dr-iconbtn" data-accion="org-zoom-in" title="Acercar (zoom +)">＋</button>
          </span>
        </div>
      </div>
      <div class="dr-orgwrap"><div class="ps-org-zoomable" style="transform: scale(${orgZoom}); transform-origin: top left;"><ul class="dr-org">${raices.map(render).join("")}</ul></div></div>
    `);
  }
  function orgTodosLosNodos() { return organigramaCombinado(); }
  function orgTieneHijos(id, nodos) { return nodos.some(n => n.parent === id); }
  function modalNodo(id, esEdicion) {
    const nodos = PS.organigrama();
    const nodo = esEdicion ? nodos.find(n => n.id === id) : null;
    const opciones = `<option value="">— Sin superior (raíz) —</option>` + nodos.filter(n => !esEdicion || n.id !== id).map(n => `<option value="${n.id}" ${nodo && nodo.parent === n.id ? "selected" : ""}>${esc(n.nombre)} · ${esc(n.rol || "")}</option>`).join("");
    abrirModal(`
      <h2 id="dr-modal-t">${esEdicion ? "Editar nodo" : "Agregar al organigrama"}</h2>
      ${esEdicion ? "" : `<label class="dr-field"><span>Tipo de cuadro</span>
        <select id="ps-org-tipo" class="dr-select" data-accion="org-tipo-change">
          <option value="persona">Cargo / persona (sin sistema)</option>
          <option value="dir-min">Director de ministerio (crea sistema)</option>
          <option value="dir-eq">Director de equipo (crea sistema)</option>
        </select></label>`}
      <label class="dr-field"><span>Nombre del director / persona</span><input id="ps-org-nombre" class="dr-input" value="${nodo ? esc(nodo.nombre) : ""}" placeholder="Nombre y apellido" /></label>
      <label class="dr-field"><span>Rol</span><input id="ps-org-rol" class="dr-input" value="${nodo ? esc(nodo.rol || "") : ""}" placeholder="Ej. Director · Mujer Integral" /></label>
      ${esEdicion ? `<label class="dr-field"><span>Depende de</span><select id="ps-org-parent" class="dr-select">${opciones}</select></label>` : ""}
      ${esEdicion ? "" : `<div id="ps-org-acceso-box" class="ps-org-acceso" hidden>
        <div class="ps-org-acceso__head">📦 Reparto del sistema</div>
        <p class="ps-org-acceso__lead">Al guardar se crea el <b>sistema completo del director</b> (base en 0, con sus pestañas) y se genera un <b>enlace de acceso</b>. Con su correo o teléfono podrás repartírselo: él entra a <b>su</b> sistema con el alcance de su rol.</p>
        <div class="dr-grid2">
          <label class="dr-field"><span>Correo del director</span><input id="ps-org-email" class="dr-input" type="email" placeholder="director@casaroca.org" /></label>
          <label class="dr-field"><span>Teléfono (WhatsApp)</span><input id="ps-org-tel" class="dr-input" type="tel" placeholder="+57 3xx xxx xxxx" /></label>
        </div>
        <label class="ps-check"><input type="checkbox" id="ps-org-enviar" checked /> <span>Repartir el acceso al guardar</span></label>
      </div>`}
      <div class="dr-modal__actions">
        <button class="dr-btn dr-btn--primary" data-accion="${esEdicion ? "org-save-edit" : "org-save-new"}" data-id="${id || ""}" data-parent="${esEdicion ? "" : (id || "")}">Guardar</button>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>
    `);
  }
  // Sistema del director: muestra qué se le reparte (pestañas, base en 0) y el acceso.
  function modalSistema(nodoId) {
    const nodos = PS.organigrama();
    const nodo = nodos.find(n => n.id === nodoId);
    if (!nodo) { toast("Cuadro no encontrado", false); return; }
    let sis = PS.sistemaPorNodo(nodoId);
    const tipo = sis ? sis.tipo : (nodo.tipo || "dir-min");
    const tabs = tabsDeTipo(tipo);
    const base = sis ? sis.base : { personas: 0, grupos: 0, coordinadores: 0, lideres: 0, nuevos: 0, equipo: 0 };
    const ac = sis ? sis.acceso : null;
    const estadoTxt = !ac ? "—" : ac.estado === "activo" ? "Activo" : ac.estado === "enviado" ? "Enviado · pendiente de ingreso" : "Sin repartir";
    const tabsHTML = tabs.map(t => `<span class="ps-tabchip">${t.ico} ${esc(t.lbl)}</span>`).join("");
    const statHTML = [
      ["Personas", base.personas], ["Grupos pequeños", base.grupos], ["Coordinadores", base.coordinadores],
      ["Líderes", base.lideres], (tipo === "dir-eq" ? ["Equipo", base.equipo] : ["Nuevos", base.nuevos]),
    ].map(([l, v]) => `<div class="ps-sis-stat"><b>${v}</b><span>${l}</span></div>`).join("");
    abrirModal(`
      <h2 id="dr-modal-t">⚙️ Sistema · ${esc(nodo.nombre)}</h2>
      <p class="dr-card__sub">${esc(nodo.rol || "")} · <b>${esc(labelTipo(tipo))}</b></p>
      ${!sis ? `<div class="ps-sis-warn">Este cuadro es de un director del seed (aún sin sistema provisionado). Así se vería su sistema con las pestañas predeterminadas.</div>` : ""}
      <div class="ps-sis-sec"><h3>Pestañas predeterminadas</h3><div class="ps-tabchips">${tabsHTML}</div></div>
      <div class="ps-sis-sec"><h3>Base del sistema</h3><div class="ps-sis-stats">${statHTML}</div>
        <p class="ps-sis-note">Base en <b>0</b>: se llena con lo que el director registre. Lo que cree —coordinadores y líderes— aparece bajo este cuadro y queda <b>visible para el pastor</b>.</p></div>
      <div class="ps-sis-sec"><h3>Reparto del acceso</h3>
        ${ac ? `<div class="ps-acceso-row"><span class="ps-orgchip ${ac.estado === "activo" ? "ps-chip--ok" : ac.estado === "enviado" ? "ps-chip--warn" : "ps-chip--off"}">${estadoTxt}</span></div>
        <div class="dr-grid2">
          <label class="dr-field"><span>Correo</span><input id="ps-sis-email" class="dr-input" type="email" value="${esc(ac.email || "")}" placeholder="director@casaroca.org" /></label>
          <label class="dr-field"><span>Teléfono</span><input id="ps-sis-tel" class="dr-input" type="tel" value="${esc(ac.tel || "")}" placeholder="+57 3xx xxx xxxx" /></label>
        </div>
        <label class="dr-field"><span>Enlace de acceso</span><input class="dr-input" readonly value="${esc(ac.enlace || "")}" /></label>
        <div class="ps-acceso-acts">
          <button class="dr-btn dr-btn--primary" data-accion="acceso-enviar" data-id="${sis.id}">${ac.estado === "pendiente" ? "Repartir acceso" : "Reenviar acceso"}</button>
          <button class="dr-btn dr-btn--ghost" data-accion="acceso-copiar" data-enlace="${esc(ac.enlace || "")}">Copiar enlace</button>
        </div>
        ${ac.enviadoEl ? `<p class="ps-sis-note">Último reparto: ${esc(ac.enviadoEl)}.</p>` : ""}` : `<p class="ps-sis-note">El acceso se reparte cuando el sistema se crea desde un cuadro de director.</p>`}
      </div>
      <div class="dr-modal__actions">
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cerrar</button>
      </div>
    `);
  }
  // Confirmación al quitar un cuadro. "Solo quitar del organigrama": si tiene
  // sistema, este se CONSERVA en segundo plano (no se borran personas).
  function modalConfirmDel(id) {
    const nodo = PS.organigrama().find(n => n.id === id);
    if (!nodo) { toast("Cuadro no encontrado", false); return; }
    const sis = nodo.sistemaId ? PS.sistemaPorNodo(id) : null;
    const hijos = PS.organigrama().filter(n => n.parent === id).length;
    abrirModal(`
      <h2 id="dr-modal-t">Quitar del organigrama</h2>
      <p class="dr-card__sub">¿Quitar el cuadro de <b>${esc(nodo.nombre)}</b>${nodo.rol ? " · " + esc(nodo.rol) : ""}?</p>
      ${sis ? `<div class="ps-sis-warn">Solo se quita el cuadro del organigrama. El <b>sistema del director se conserva</b> en segundo plano con todos sus datos —no se borra a ninguna persona—. Podrás re-vincularlo después.</div>`
        : `<div class="ps-sis-warn">Se quita el cuadro del organigrama.${hijos ? " Sus " + hijos + " cuadro(s) hijos pasarán a colgar del superior." : ""}</div>`}
      <div class="dr-modal__actions">
        <button class="dr-btn dr-btn--danger" data-accion="org-del-confirm" data-id="${id}">Sí, quitar del organigrama</button>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>
    `);
  }

  function modalPresupuesto(min) {
    const r = PS.presupuesto().find(x => x.min === min);
    if (!r) return;
    const oc = pct(r.ejecutado, r.asignado);
    abrirModal(`
      <h2 id="dr-modal-t">Editar presupuesto · ${esc(r.min)}</h2>
      <p class="dr-card__sub">Montos en millones de pesos (COP) por mes. Ejecución actual: <b>${oc}%</b>.</p>
      <label class="dr-field"><span>Asignado (millones COP)</span>
        <input id="ps-presup-asig" class="dr-input" type="number" min="0" step="0.1" inputmode="decimal" value="${r.asignado}" /></label>
      <label class="dr-field"><span>Ejecutado (millones COP)</span>
        <input id="ps-presup-ejec" class="dr-input" type="number" min="0" step="0.1" inputmode="decimal" value="${r.ejecutado}" /></label>
      <div class="dr-modal__actions">
        <button class="dr-btn dr-btn--primary" data-accion="presup-save" data-min="${esc(r.min)}">Guardar cambios</button>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>
    `);
  }

  function fmtFechaCorta(iso) {
    const p = String(iso || "").split("-");
    if (p.length < 3) return iso || "—";
    return p[2] + " " + (MESES_L[(+p[1]) - 1] || "").slice(0, 3);
  }
  function modalGasto() {
    // "Asignado a" = ministerios + equipos operativos + áreas, con lo ya usado en gastos previos
    const base = ["General"].concat(P.MIN_DEFS.map(m => m.nombre))
      .concat(["VISA", "Alabanza", "Ujieres", "Creativo", "Talento Humano", "Seguridad", "Comunicaciones", "Cultura", "Tesorería"]);
    PS.gastos().forEach(g => base.push(g.min));
    const lista = base.filter((v, i, a) => v && a.indexOf(v) === i).sort();
    const opts = lista.map(v => `<option value="${esc(v)}"></option>`).join("");
    abrirModal(`
      <h2 id="dr-modal-t">Registrar gasto de servicio</h2>
      <p class="dr-card__sub">Digita el servicio gastado y adjunta la factura como soporte. Montos en millones de pesos (COP).</p>
      <label class="dr-field"><span>Rubro / concepto del gasto *</span>
        <input id="ps-gas-rubro" class="dr-input" type="text" placeholder="Ej: Sonido, video y streaming" /></label>
      <div class="dr-grid2">
        <label class="dr-field"><span>Asignado a</span>
          <input id="ps-gas-min" class="dr-input" list="ps-gas-min-list" placeholder="General" />
          <datalist id="ps-gas-min-list">${opts}</datalist></label>
        <label class="dr-field"><span>Monto (millones COP) *</span>
          <input id="ps-gas-monto" class="dr-input" type="number" min="0" step="0.1" inputmode="decimal" placeholder="0.0" /></label>
      </div>
      <div class="dr-grid2">
        <label class="dr-field"><span>Fecha del gasto</span>
          <input id="ps-gas-fecha" class="dr-input" type="date" value="${new Date().toISOString().slice(0, 10)}" /></label>
        <label class="dr-field"><span>N° de factura</span>
          <input id="ps-gas-factura" class="dr-input" type="text" placeholder="Ej: FV-01923" /></label>
      </div>
      <label class="dr-field"><span>Proveedor</span>
        <input id="ps-gas-proveedor" class="dr-input" type="text" placeholder="Ej: Claro, Codensa, Sonido Pro…" /></label>
      <label class="dr-field"><span>Adjuntar factura (PDF o imagen)</span>
        <input id="ps-gas-archivo" class="dr-input dr-input--file" type="file" accept=".pdf,.jpg,.jpeg,.png" /></label>
      <div class="dr-modal__actions">
        <button class="dr-btn dr-btn--primary" data-accion="guardar-gasto">Registrar gasto</button>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>
    `);
  }

  /* ============================================================ 5. CALENDARIO */
  function vistaCalendario() {
    const espacios = PS.espacios();
    const todos = eventosSede();
    // filtro por ministerio (sincroniza/filtra la agenda de todos los ministerios)
    const eventos = calMinFiltro === "todos" ? todos : todos.filter(e => e.min === calMinFiltro);
    const y = calMes.y, m = calMes.m;
    const primero = new Date(y, m, 1);
    const offset = (primero.getDay() + 6) % 7; // L=0
    const dias = new Date(y, m + 1, 0).getDate();
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const isoDe = d => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const evDe = iso => eventos.filter(e => e.fecha === iso);

    let celdas = "";
    for (let i = 0; i < offset; i++) celdas += `<div class="dr-cal__cell is-empty"></div>`;
    for (let d = 1; d <= dias; d++) {
      const iso = isoDe(d);
      const evs = evDe(iso);
      const esHoy = (+new Date(y, m, d) === +hoy);
      const nEv = evs.length;
      const aria = nEv ? `${d} de ${MESES_L[m]}: ${nEv} evento${nEv > 1 ? "s" : ""}` : `${d} de ${MESES_L[m]}: sin eventos`;
      celdas += `<div class="dr-cal__cell dr-cal__cell--click ${esHoy ? "is-today" : ""} ${nEv ? "has-ev" : ""}" data-accion="cal-dia" data-iso="${iso}" role="button" tabindex="0" aria-label="${aria}">
        <span class="dr-cal__d">${d}</span>
        ${evs.slice(0, 3).map(e => `<span class="dr-cal__ev ${e.live ? "ps-ev-live" : ""}" title="${esc(e.titulo)} · ${esc(e.min)}">${esc(e.titulo)}</span>`).join("")}
        ${evs.length > 3 ? `<span class="dr-cal__more">+${evs.length - 3}</span>` : ""}
      </div>`;
    }

    const proximos = eventos.filter(e => e.fecha >= hoy.toISOString().slice(0, 10)).sort((a, b) => a.fecha < b.fecha ? -1 : 1).slice(0, 12);
    const lista = proximos.map(e => {
      const esp = espacios.find(s => s.id === e.espacioId);
      return `<div class="dr-ev-row">
        <div class="dr-ev-row__fecha"><b>${new Date(e.fecha + "T00:00").getDate()}</b><span>${MESES[new Date(e.fecha + "T00:00").getMonth()]}</span></div>
        <div class="dr-ev-row__main"><b>${esc(e.titulo)} ${e.live ? '<span class="ps-live-badge">🔗 J+25</span>' : ""}</b>
          <span>🕒 ${esc(e.horaInicio)}–${esc(e.horaFin)} · 📍 ${esc(esp ? esp.nombre : "—")} · ${pill(e.min)}</span></div>
        ${!e.live ? `<button class="dr-iconbtn" data-accion="del-evento" data-id="${e.id}" title="Eliminar">✕</button>` : ""}
      </div>`;
    }).join("") || `<p class="dr-card__sub">No hay eventos próximos${calMinFiltro !== "todos" ? " para este ministerio" : ""}.</p>`;

    // filtro de ministerio: solo los que tienen al menos un evento + opción "todos"
    const minsConEv = Array.from(new Set(todos.map(e => e.min))).sort();
    const minOpts = `<option value="todos">Todos los ministerios (${todos.length})</option>` +
      minsConEv.map(mn => `<option value="${mn}" ${calMinFiltro === mn ? "selected" : ""}>${esc(mn)} (${todos.filter(e => e.min === mn).length})</option>`).join("");

    // gestión de espacios: cada uno con su botón de borrar
    const espRows = espacios.map(s => {
      const usos = PS.eventosEnEspacio(s.id);
      return `<div class="dr-ev-row">
        <div class="dr-ev-row__main"><b>${s.ico} ${esc(s.nombre)}</b>
          <span>Capacidad: ${s.capacidad} ${usos ? `· 📅 ${usos} evento${usos > 1 ? "s" : ""}` : "· libre"}</span></div>
        <button class="dr-iconbtn" data-accion="del-espacio" data-id="${s.id}" title="Borrar espacio">✕</button>
      </div>`;
    }).join("") || `<p class="dr-card__sub">No hay espacios. Habilita el primero.</p>`;

    return shell(`
      <div class="dr-head"><div>
        <h1 class="dr-h1">Calendario y reserva de espacios</h1>
        <p class="dr-lead">Agenda sincronizada con <b>todos los ministerios</b> y equipos de la sede. Los eventos de <b>J+25</b> llegan en vivo desde el director. Crea eventos, habilita espacios y reserva sin choques de horario.</p>
      </div>
      <button class="dr-btn dr-btn--primary" data-accion="nuevo-evento">＋ Crear evento</button></div>

      <div class="dr-card">
        <div class="dr-cal__head">
          <button class="dr-iconbtn" data-accion="cal-prev" title="Mes anterior">‹</button>
          <b>${MESES_L[m]} ${y}</b>
          <button class="dr-iconbtn" data-accion="cal-next" title="Mes siguiente">›</button>
        </div>
        <label class="dr-field" style="margin:.5rem 0 0">
          <span>Ministerio</span>
          <select class="dr-select" data-accion="cal-min">${minOpts}</select>
        </label>
        <div class="dr-cal__dow">${DOW.map(d => `<span>${d}</span>`).join("")}</div>
        <div class="dr-cal__grid">${celdas}</div>
      </div>

      <div class="dr-grid2">
        <div class="dr-card"><h3 class="dr-card__t">Próximos eventos</h3>${lista}</div>
        <div class="dr-card">
          <div class="flex between" style="align-items:center">
            <h3 class="dr-card__t" style="margin:0">Espacios de la sede</h3>
            <button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="nuevo-espacio">＋ Habilitar espacio</button>
          </div>
          <p class="dr-card__sub">Habilita o borra espacios físicos. Cada espacio queda disponible al crear un evento.</p>
          ${espRows}
        </div>
      </div>
    `);
  }
  // Detalle del día: al hacer clic en una celda del calendario se abre este
  // modal con todos los eventos de ese día (sede + J+25 en vivo), ordenados
  // por hora, con espacio, ministerio y descripción.
  function modalDiaCalendario(iso) {
    const espacios = PS.espacios();
    const todos = eventosSede();
    const eventos = calMinFiltro === "todos" ? todos : todos.filter(e => e.min === calMinFiltro);
    const evs = eventos.filter(e => e.fecha === iso)
      .sort((a, b) => String(a.horaInicio || "").localeCompare(String(b.horaInicio || "")));
    const fd = new Date(iso + "T00:00");
    const diaSem = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"][fd.getDay()];
    const titulo = `${diaSem} ${fd.getDate()} de ${MESES_L[fd.getMonth()]} de ${fd.getFullYear()}`;

    const filas = evs.map(e => {
      const esp = espacios.find(s => s.id === e.espacioId);
      return `<div class="dr-ev-row">
        <div class="dr-ev-row__fecha"><b>🕒</b><span>${esc(e.horaInicio || "—")}</span></div>
        <div class="dr-ev-row__main">
          <b>${esc(e.titulo)} ${e.live ? '<span class="ps-live-badge">🔗 J+25</span>' : ""}</b>
          <span>🕒 ${esc(e.horaInicio || "—")}–${esc(e.horaFin || "—")} · 📍 ${esc(esp ? esp.nombre : "—")} · ${pill(e.min)}</span>
          ${e.desc ? `<span class="dr-card__sub" style="margin-top:.25rem">${esc(e.desc)}</span>` : ""}
        </div>
        ${!e.live ? `<button class="dr-iconbtn" data-accion="del-evento" data-id="${e.id}" title="Eliminar evento">✕</button>` : ""}
      </div>`;
    }).join("");

    const cuerpo = evs.length
      ? `<div class="ps-member-list__head"><b>📅 ${evs.length} evento${evs.length > 1 ? "s" : ""}</b>${calMinFiltro !== "todos" ? `<span class="dr-card__sub">filtrado: ${esc(calMinFiltro)}</span>` : ""}</div>${filas}`
      : `<p class="dr-card__sub">No hay eventos programados para este día${calMinFiltro !== "todos" ? ` en ${esc(calMinFiltro)}` : ""}. Crea el primero.</p>`;

    abrirModal(`
      <h2 id="dr-modal-t">${titulo}</h2>
      <p class="dr-card__sub">Agenda de la sede para este día. Los eventos de J+25 llegan en vivo desde el director.</p>
      ${cuerpo}
      <div class="dr-modal__actions">
        <button class="dr-btn dr-btn--primary" data-accion="nuevo-evento-dia" data-iso="${iso}">＋ Crear evento este día</button>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cerrar</button>
      </div>
    `);
  }
  function modalEspacio() {
    abrirModal(`
      <h2 id="dr-modal-t">Habilitar nuevo espacio</h2>
      <p class="dr-card__sub">Crea un espacio físico reservable de la sede.</p>
      <label class="dr-field"><span>Nombre</span><input id="ps-esp-nombre" class="dr-input" placeholder="Ej. Salón de oración" /></label>
      <div class="dr-field-row">
        <label class="dr-field"><span>Capacidad</span><input id="ps-esp-cap" class="dr-input" type="number" min="0" value="30" /></label>
        <label class="dr-field"><span>Ícono</span><input id="ps-esp-ico" class="dr-input" placeholder="📍" value="📍" maxlength="2" /></label>
      </div>
      <div class="dr-modal__actions">
        <button class="dr-btn dr-btn--primary" data-accion="guardar-espacio">Habilitar espacio</button>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>
    `);
  }
  function modalEvento(isoPreset) {
    const espOpts = PS.espacios().map(s => `<option value="${s.id}">${s.ico} ${esc(s.nombre)} (cap. ${s.capacidad})</option>`).join("")
      || `<option value="">— Habilita un espacio primero —</option>`;
    const fechaVal = isoPreset || "2026-06-21";
    abrirModal(`
      <h2 id="dr-modal-t">Crear evento y reservar espacio</h2>
      <label class="dr-field"><span>Título</span><input id="ps-ev-titulo" class="dr-input" placeholder="Ej. Encuentro de líderes" /></label>
      <div class="dr-field-row">
        <label class="dr-field"><span>Fecha</span><input id="ps-ev-fecha" class="dr-input" type="date" value="${fechaVal}" /></label>
        <label class="dr-field"><span>Inicio</span><input id="ps-ev-inicio" class="dr-input" type="time" value="19:00" /></label>
        <label class="dr-field"><span>Fin</span><input id="ps-ev-fin" class="dr-input" type="time" value="21:00" /></label>
      </div>
      <label class="dr-field"><span>Espacio</span><select id="ps-ev-espacio" class="dr-select">${espOpts}</select></label>
      <label class="dr-field"><span>Descripción</span><input id="ps-ev-desc" class="dr-input" placeholder="Detalle (opcional)" /></label>
      <div id="ps-ev-disp"></div>
      <div class="dr-modal__actions">
        <button class="dr-btn dr-btn--ghost" data-accion="ev-check">Ver disponibilidad</button>
        <button class="dr-btn dr-btn--primary" data-accion="guardar-evento">Reservar y crear</button>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>
    `);
  }
  function chequearDisp() {
    const espId = val("ps-ev-espacio"), fecha = val("ps-ev-fecha"), ini = val("ps-ev-inicio"), fin = val("ps-ev-fin");
    const libre = PS.espacioLibre(espId, fecha, ini, fin, eventosSede());
    const esp = PS.espacios().find(s => s.id === espId) || { nombre: "espacio" };
    const box = document.getElementById("ps-ev-disp");
    if (box) box.innerHTML = libre
      ? `<div class="ps-disp ps-disp--ok">✓ ${esc(esp.nombre)} está libre ese día y horario.</div>`
      : `<div class="ps-disp ps-disp--bad">✕ ${esc(esp.nombre)} ya está ocupado en ese horario. Elige otra hora o espacio.</div>`;
    return libre;
  }

  /* ============================================================ 6. GRUPOS PEQUEÑOS */
  function vistaGrupos() {
    let grupos = gruposSede();
    if (gruposMinFiltro !== "todos") grupos = grupos.filter(g => g.ministerioId === gruposMinFiltro);
    const minOpts = `<option value="todos">Todos los ministerios</option>` + P.MIN_DEFS.map(m => `<option value="${m.id}" ${gruposMinFiltro === m.id ? "selected" : ""}>${esc(m.nombre)}</option>`).join("");
    const totalMiem = grupos.reduce((s, g) => s + g.miembros, 0);
    const cards = grupos.map(g => {
      const oc = g.cupo ? pct(g.miembros, g.cupo) : 0;
      const cls = g.cupo && g.miembros >= g.cupo ? "ps-bad" : oc > 60 ? "ps-ok" : "ps-warn";
      const lider = g.lider || {};
      return `<div class="dr-card ps-group-card ps-group-card--click" data-accion="ver-grupo" data-min="${esc(g.ministerioId)}" data-grupo="${esc(g.nombre)}" role="button" tabindex="0" aria-label="Abrir el grupo ${esc(g.nombre)} y ver sus miembros">
        <div class="ps-group-card__head"><span class="ps-group-ico">${g.ico}</span><div><b>${esc(g.nombre)}</b><small>${esc(g.ministerio)} ${g.live ? '<span class="ps-live-badge">🔗 en vivo</span>' : ""}</small></div>
          <span class="ps-tag ${cls}">${g.miembros}${g.cupo ? "/" + g.cupo : ""}</span></div>
        <div class="ps-group-card__meta">🗓️ ${esc(g.dia)} · ${esc(g.hora)}<br>📍 ${esc(g.zona)}<br>🧑‍🤝‍🧑 Líder: ${esc(lider.nombre || "—")}</div>
        ${g.cupo ? `<div class="ps-progress"><span class="${cls}" style="width:${Math.min(100, oc)}%"></span></div>` : ""}
        <div class="ps-group-card__foot"><span>👥 Ver miembros del grupo</span><span class="ps-group-card__arrow">→</span></div>
      </div>`;
    }).join("");
    return shell(`
      <div class="dr-head"><div>
        <h1 class="dr-h1">Grupos pequeños de la sede</h1>
        <p class="dr-lead">Todos los grupos de todos los ministerios. ${grupos.length} grupos · ${totalMiem} personas conectadas.</p>
      </div>
      <select class="dr-select" data-accion="grupos-min">${minOpts}</select></div>
      ${panelPublicacion()}
      <div class="dr-grid2">${cards || '<p class="dr-card__sub">Sin grupos en este filtro.</p>'}</div>
    `);
  }

  /* Publicación en Conéctate (landing): el pastor autoriza qué grupos de SU
     sede se muestran en el funnel público. Sincroniza vía STORE en vivo. */
  function panelPublicacion() {
    if (!L || !L.afinidadesDeSede || !S || !S.autorizado) return "";
    const grupos = L.afinidadesDeSede(SEDE_CIUDAD);
    if (!grupos.length) return "";
    const pub = grupos.filter(a => S.autorizado(a.id)).length;
    const sedeNom = L.ciudad ? L.ciudad(SEDE_CIUDAD).nombre : "tu sede";
    const filas = grupos.map(a => {
      const m = DB.ministerio(a.min);
      const on = S.autorizado(a.id);
      return `<div class="ps-pub-row">
        <div class="ps-pub-row__main">
          <span class="ps-group-ico">${m ? m.ico : "🤝"}</span>
          <div><b>${esc(a.nombre)}</b><small>${m ? esc(m.nombre) : ""} · 🧑‍🤝‍🧑 ${esc(a.lider || "—")} · 🗓️ ${esc(a.dia || "")} ${esc(a.hora || "")}</small></div>
        </div>
        <div class="ps-pub-row__right">
          <span class="ps-tag ${on ? "ps-ok" : "ps-warn"}">${on ? "🟢 En Conéctate" : "⚪ Oculto"}</span>
          <button class="dr-btn ${on ? "dr-btn--ghost" : "dr-btn--ok"} dr-btn--sm" data-accion="gp-publicar" data-af="${esc(a.id)}"
            aria-label="${on ? "Ocultar" : "Publicar"} el grupo ${esc(a.nombre)} en Conéctate">${on ? "Ocultar" : "Publicar"}</button>
        </div>
      </div>`;
    }).join("");
    return `<div class="dr-card ps-pub">
      <div class="ps-pub__head">
        <div><b>🛡️ Publicación en Conéctate (landing)</b>
          <p class="dr-card__sub">Tú decides qué grupos pequeños de <b>${esc(sedeNom)}</b> ve la persona en el funnel público. ${pub}/${grupos.length} publicados ahora.</p></div>
        <span class="ps-live-badge">🔗 en vivo</span>
      </div>
      <div class="ps-pub__list">${filas}</div>
    </div>`;
  }

  // Detalle de un grupo: el pastor entra con los mismos permisos del líder
  // (ve la ficha del grupo y a TODAS las personas que lo componen).
  function modalGrupo(minId, nombre) {
    const g = gruposSede().find(x => x.ministerioId === minId && x.nombre === nombre);
    if (!g) { toast("No se encontró el grupo", false); return; }
    const lider = g.lider || {};
    const oc = g.cupo ? pct(g.miembros, g.cupo) : 0;
    const cls = g.cupo && g.miembros >= g.cupo ? "ps-bad" : oc > 60 ? "ps-ok" : "ps-warn";

    // Miembros del grupo (mismo registro que ve el líder de ese grupo)
    let miembros = registroSede().filter(p => p.ministerioId === minId && (p.grupo || "") === nombre);
    miembros.sort((a, b) => nombreCompleto(a).toLowerCase() < nombreCompleto(b).toLowerCase() ? -1 : 1);

    const filas = miembros.map(p => `
      <div class="ps-member" data-accion="ver-persona" data-id="${p.id}" role="button" tabindex="0">
        <div class="dr-cell-person">
          <span class="dr-mini-avatar">${esc(iniciales(p))}</span>
          <div><b>${esc(nombreCompleto(p))}</b><small>${typeof p.edad === "number" ? p.edad + " años · " : ""}${esc(p.estadoCivil || "—")}</small></div>
        </div>
        <div class="ps-member__right">
          ${chip(p.etapa)}
          ${p.telefono && p.telefono !== "—" ? `<a class="dr-iconbtn" href="${waLink(p.telefono, p.nombres)}" target="_blank" rel="noopener" data-stop="1" title="WhatsApp">💬</a>` : ""}
          ${p.correo && p.correo !== "—" ? `<a class="dr-iconbtn" href="${mailLink(p.correo, p.nombres)}" target="_blank" rel="noopener" data-stop="1" title="Correo">✉️</a>` : ""}
        </div>
      </div>`).join("");

    abrirModal(`
      <div class="dr-modal__head">
        <div class="dr-avatar dr-avatar--lg">${g.ico}</div>
        <div><h2 id="dr-modal-t">${esc(g.nombre)}</h2>
          <p class="dr-card__sub">${esc(g.ministerio)}${g.live ? ' · <span class="ps-live-badge">🔗 en vivo</span>' : ""}</p></div>
      </div>
      <div class="ps-perfil-grid">
        <div><span>Líder</span><b>${esc(lider.nombre || "—")}</b></div>
        <div><span>Día y hora</span><b>${esc(g.dia)} · ${esc(g.hora)}</b></div>
        <div><span>Lugar / zona</span><b>${esc(g.zona || "—")}</b></div>
        <div><span>Miembros</span><b>${g.miembros}${g.cupo ? " / " + g.cupo + " cupos" : ""}</b></div>
      </div>
      ${g.cupo ? `<div class="ps-progress"><span class="${cls}" style="width:${Math.min(100, oc)}%"></span></div>` : ""}
      <div class="ps-member-list__head">
        <b>👥 Personas del grupo</b>
        <span class="dr-card__sub">${miembros.length} ${miembros.length === 1 ? "persona" : "personas"}</span>
      </div>
      <div class="ps-member-list">${filas || '<p class="dr-card__sub">Este grupo aún no tiene personas registradas.</p>'}</div>
      <div class="dr-modal__actions">
        ${lider.tel ? `<a class="dr-btn dr-btn--ok" href="${waLink(lider.tel, lider.nombre)}" target="_blank" rel="noopener">💬 Escribir al líder</a>` : ""}
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cerrar</button>
      </div>
    `);
  }

  /* ============================================================ 7. EQUIPO */
  function vistaEquipo() {
    let eq = registroSede().filter(p => p.sirve);
    if (equipoMinFiltro !== "todos") eq = eq.filter(p => p.ministerioId === equipoMinFiltro);
    eq.sort((a, b) => nombreCompleto(a).toLowerCase() < nombreCompleto(b).toLowerCase() ? -1 : 1);
    const minOpts = `<option value="todos">Todos los ministerios</option>` + P.MIN_DEFS.map(m => `<option value="${m.id}" ${equipoMinFiltro === m.id ? "selected" : ""}>${esc(m.nombre)}</option>`).join("");
    const filas = eq.map(p => `<tr class="ps-row-click" data-accion="ver-persona" data-id="${p.id}" role="button" tabindex="0" title="Ver perfil y diezmo de los últimos 3 meses">
        <td><div class="dr-cell-person"><span class="dr-mini-avatar">${esc(iniciales(p))}</span><div><b>${esc(nombreCompleto(p))}</b><small>${esc(p.correo)}</small></div></div></td>
        <td><span class="ps-tag">${esc(p.ministerio)}</span></td>
        <td>${esc(p.grupo || "Servicio")}</td>
        <td>${chip(p.etapa)}</td>
        <td>${p.diezma ? '<span class="ps-yes">💛 Sí</span>' : '<span class="ps-no">No</span>'}</td>
        <td><button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="ver-persona" data-id="${p.id}">Ver →</button></td>
      </tr>`).join("");
    return shell(`
      <div class="dr-head"><div>
        <h1 class="dr-h1">Equipo de servidores</h1>
        <p class="dr-lead">Todas las personas que sirven en la sede, de todos los ministerios y equipos operativos. <b>${eq.length}</b> servidores. Toca una persona para ver su perfil y el <b>diezmo de los últimos 3 meses</b> (sí/no).</p>
      </div>
      <select class="dr-select" data-accion="equipo-min">${minOpts}</select></div>
      <div class="dr-tablewrap"><table class="dr-table">
        <thead><tr><th>Servidor</th><th>Ministerio</th><th>Grupo</th><th>Etapa</th><th>Diezma</th><th></th></tr></thead>
        <tbody>${filas || '<tr><td colspan="6"><i>Sin servidores en este filtro.</i></td></tr>'}</tbody>
      </table></div>
    `);
  }

  /* ============================================================ 7b. SIRVE · EQUIPOS OPERATIVOS
     El catálogo de equipos operativos es el MISMO en las 36 sedes; cada sede activa
     el subconjunto que usa. La sede madre (índice 0) trae datos reales y sincronizados
     con el roster; las demás muestran, de forma determinista, su uso del catálogo. */
  function catalogoOper() { return P.MIN_DEFS.filter(m => m.tipo === "operativo"); }
  function sedesLista() { return P.DIRECTORIO_PASTORES || []; }
  function sedeEquipoInfo(sedeIdx, m, teamIdx) {
    if (sedeIdx === 0) {
      return { activo: PS.equipoActivo(m.id), servidores: (m._roster || []).length, grupos: (m._grupos || []).length, real: true };
    }
    const h = (sedeIdx * 37 + teamIdx * 13) % 100;
    const umbral = teamIdx <= 2 ? 10 : 48;          // core (Alabanza/VISA/Ujieres) casi siempre; otros variable
    const activo = h >= umbral;
    const factor = 0.35 + ((sedeIdx * 17) % 60) / 100;   // 0.35–0.95
    const base = (m._roster || []).length || m.tamano || 10;
    const servidores = activo ? Math.max(3, Math.round(base * factor)) : 0;
    const grupos = activo ? Math.max(1, Math.round((m._grupos || []).length * (factor > 0.7 ? 1 : 0.6))) : 0;
    return { activo, servidores, grupos, real: false };
  }
  function vistaSirve() {
    const sedes = sedesLista();
    const sIdx = 0; // Punto 5 · el pastor local SOLO ve su propia iglesia (sede madre)
    const sede = sedes[sIdx] || { iglesia: USER.sede };
    const esMadre = sIdx === 0;
    const cat = catalogoOper();
    const infos = cat.map((m, j) => ({ m, info: sedeEquipoInfo(sIdx, m, j) }));
    const activos = infos.filter(x => x.info.activo);
    const totalServidores = activos.reduce((s, x) => s + x.info.servidores, 0);
    const usoPct = pct(activos.length, cat.length);
    const sedeLabel = s => esc((s.ciudad ? s.ciudad + " · " : "") + (s.iglesia || s.nombre || ""));
    // ordenadas por ciudad, dejando la sede madre (tu sede) siempre de primera
    const sedeOpts = sedes.map((s, i) => ({ s, i }))
      .sort((a, b) => a.i === 0 ? -1 : b.i === 0 ? 1 : (a.s.ciudad || "").localeCompare(b.s.ciudad || ""))
      .map(({ s, i }) => `<option value="${i}" ${i === sIdx ? "selected" : ""}>${sedeLabel(s)}${i === 0 ? " · tu sede" : ""}</option>`).join("");

    const cards = infos.map(({ m, info }) => {
      const activo = info.activo;
      const dirN = ((m.director && m.director.nombre) || "—").split(" ")[0];
      return `<article class="dr-card ps-eqop ${activo ? "" : "ps-eqop--off"}">
        <div class="ps-eqop__top">
          <span class="ps-eqop__ico" style="background:color-mix(in srgb, ${m.color} 14%, white);color:${m.color}">${m.ico}</span>
          <div class="ps-eqop__title"><b>${esc(m.nombre)}</b><small>${esc(m.desc)}</small></div>
          <span class="ps-eqop__estado ${activo ? "is-on" : "is-off"}">${activo ? "● Activo" : "○ No activo"}</span>
        </div>
        <div class="ps-eqop__stats">
          <div><b>${activo ? info.servidores : "—"}</b><span>servidores</span></div>
          <div><b>${activo ? info.grupos : "—"}</b><span>grupos</span></div>
          ${esMadre ? `<div><b>${esc(dirN)}</b><span>director</span></div>` : ""}
        </div>
        <div class="ps-eqop__acts">
          ${esMadre
            ? `<button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="ver-equipo-op" data-id="${m.id}">Ver equipo →</button>
               <button class="dr-btn ${activo ? "dr-btn--ghost" : "dr-btn--ok"} dr-btn--sm" data-accion="toggle-equipo" data-id="${m.id}">${activo ? "Desactivar" : "Activar"}</button>`
            : `<span class="dr-card__sub">${activo ? "✓ En uso en esta sede" : "Disponible en el catálogo, sin activar"}</span>`}
        </div>
      </article>`;
    }).join("");

    return shell(`
      <div class="dr-head"><div>
        <h1 class="dr-h1">Sirve · Equipos operativos</h1>
        <p class="dr-lead">Los equipos operativos de <b>tu iglesia</b> y sus servidores. Como pastor local, solo ves la información de <b>${esc(USER.sede)}</b>.</p>
      </div></div>
      <div class="ps-sede-filtro">
        <span class="ps-sede-filtro__lbl">📍 ${sedeLabel(sede)}</span>
        <span class="ps-sede-filtro__tag ps-sede-filtro__tag--mia">Tu sede · datos en vivo</span>
      </div>
      <div class="dr-kpis">
        ${kpi(activos.length + " / " + cat.length, "Equipos activos")}
        ${kpi(totalServidores.toLocaleString("es-CO"), "Servidores en equipos")}
        ${kpi(usoPct + "%", "Uso del catálogo")}
      </div>
      <div class="ps-eqop-grid">${cards}</div>
    `);
  }
  function modalEquipoOp(id) {
    const m = P.MIN_DEFS.find(x => x.id === id);
    if (!m) { toast("Equipo no encontrado", false); return; }
    const roster = m._roster || [];
    const grupos = (m._grupos || []).map(g => {
      const miembros = roster.filter(p => p.grupo === g.nombre).length;
      return `<div class="ps-eqop-grp">
        <div><b>${esc(g.nombre)}</b><small>${esc(g.lider ? g.lider.nombre : "—")} · ${esc(g.dia)} ${esc(g.hora)}</small></div>
        <span class="ps-pill">${miembros}${g.cupo ? " / " + g.cupo : ""}</span>
      </div>`;
    }).join("");
    const personas = roster.slice(0, 12).map(p => `<article class="dr-person dr-person--click" data-accion="ver-persona" data-id="${p.id}" tabindex="0" role="button">
      <div class="dr-avatar">${esc(iniciales(p))}</div>
      <div class="dr-person__main"><b>${esc(nombreCompleto(p))}</b><span>${esc(p.grupo || "Servicio")}</span></div>
      ${chip(p.etapa)}</article>`).join("");
    const dir = m.director || {};
    abrirModal(`
      <h2 id="dr-modal-t">${m.ico} ${esc(m.nombre)}</h2>
      <p class="dr-card__sub">${esc(m.desc)}</p>
      <div class="ps-perfil-grid">
        <div><span>Director</span><b>${esc(dir.nombre || "—")}</b></div>
        <div><span>Servidores</span><b>${roster.length}</b></div>
        <div><span>Grupos</span><b>${(m._grupos || []).length}</b></div>
        <div><span>Estado en tu sede</span><b>${PS.equipoActivo(m.id) ? "Activo" : "No activo"}</b></div>
      </div>
      <h3 class="ps-modal-sub">Grupos del equipo</h3>
      ${grupos || '<p class="dr-card__sub">Sin grupos.</p>'}
      <h3 class="ps-modal-sub">Servidores (${roster.length})</h3>
      <div class="dr-person-grid">${personas || '<p class="dr-card__sub">Sin servidores.</p>'}</div>
      <div class="dr-modal__actions">
        ${dir.tel ? `<a class="dr-btn dr-btn--ok" href="${waLink(dir.tel, dir.nombre)}" target="_blank" rel="noopener">💬 Escribir al director</a>` : ""}
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cerrar</button>
      </div>`);
  }

  /* ============================================================ 8. TEMÁTICAS */
  // localiza una temática (local del pastor o en vivo del director) y su store.
  // `live` desambigua: los IDs semilla pueden coincidir entre stores, así que si
  // la tarjeta es J+25 en vivo, buscamos primero en el store del director.
  function temPorId(id, live) {
    if (live && DS && DS.tematica) { const d = DS.tematica(id); if (d) return { t: d, live: true, store: DS }; }
    const local = PS.tematica(id);
    if (local) return { t: local, live: false, store: PS };
    if (DS && DS.tematica) { const d = DS.tematica(id); if (d) return { t: d, live: true, store: DS }; }
    return { t: null, live: false, store: null };
  }
  // ícono por extensión de archivo
  function docIco(nombre) {
    const ext = String(nombre || "").split(".").pop().toLowerCase();
    if (["pdf"].includes(ext)) return "📕";
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

  /* ============================================================ CURSOS
     El pastor crea/edita los cursos cortos de SU sede. Se guardan en el
     STORE compartido (window.STORE) etiquetados con la ciudad de la sede,
     y aparecen EN VIVO en "Crece" del landing, filtrados por ciudad.
     ============================================================ */
  const SEDE_CIUDAD = "bogota"; // id de ciudad del landing para esta sede (Bogotá Chicó)
  const MODALIDADES = ["Presencial", "Virtual", "Híbrido"];
  function modalidadIco(m) {
    const t = (m || "").toLowerCase();
    if (t.indexOf("virtual") >= 0) return "💻";
    if (t.indexOf("híbrid") >= 0 || t.indexOf("hibrid") >= 0) return "🔀";
    return "📍";
  }
  function cursoIniciaTxt(iso) {
    if (!iso) return "Matrícula abierta";
    return fechaCorta(iso);
  }
  function vistaCursos() {
    const S = window.STORE;
    const cursos = (S && S.cursosDe) ? S.cursosDe(SEDE_CIUDAD) : [];
    const cards = cursos.length ? cursos.map(c => {
      const et = ETAPAS[c.etapa] || ETAPAS.crece;
      const horario = `${c.dia || ""}${c.dia && c.sesiones ? " · " : ""}${c.sesiones || ""}`.trim();
      return `<div class="dr-card ps-tem-card ${c.activo ? "" : "ps-curso--off"}">
        <div class="ps-tem-card__ico">${esc(c.ico || "📘")}</div>
        <div class="ps-tem-card__body">
          <b>${esc(c.nombre)} ${c.activo ? "" : '<span class="ps-pill ps-pill--warn">Oculto</span>'}</b>
          <p>${esc(c.desc || "")}</p>
          <div class="ps-tem-card__meta">
            <span class="ps-pill" style="background:${et.color}1f;color:${et.color}">${esc(et.lbl)}</span>
            ${pill(modalidadIco(c.modalidad) + " " + (c.modalidad || ""))}
            ${horario ? `<span>🗓️ ${esc(horario)}</span>` : ""}
            <span>▶ ${esc(cursoIniciaTxt(c.inicia))}</span>
            ${c.cupo ? `<span>👥 ${c.inscritos || 0}/${c.cupo}</span>` : ""}
          </div>
        </div>
        <div class="ps-curso-acts">
          <button class="dr-iconbtn" data-accion="curso-inscripcion" data-id="${c.id}" title="Formulario de inscripción y enlace para compartir">📲</button>
          <button class="dr-iconbtn" data-accion="curso-toggle" data-id="${c.id}" title="${c.activo ? "Ocultar del landing" : "Publicar en el landing"}">${c.activo ? "👁️" : "🚫"}</button>
          <button class="dr-iconbtn" data-accion="curso-edit" data-id="${c.id}" title="Editar">✏️</button>
          <button class="dr-iconbtn" data-accion="curso-del" data-id="${c.id}" title="Eliminar">✕</button>
        </div>
      </div>`;
    }).join("") : `<div class="dr-empty">Aún no has creado cursos para tu sede. Toca <b>＋ Nuevo curso</b> para empezar; aparecerá en “Crece” del landing al instante.</div>`;
    return shell(`
      <div class="dr-head"><div>
        <h1 class="dr-h1">Cursos de la sede 🎓</h1>
        <p class="dr-lead">Crea y actualiza los cursos cortos de <b>${esc(USER.sede)}</b> con sus fechas, horarios y modalidad. Se publican <b>en vivo</b> en la etapa <b>Crece</b> del landing, donde cada persona filtra por su ciudad. Los Institutos IBLI · FACTER son corporativos y no se editan aquí.</p>
      </div>
      <button class="dr-btn dr-btn--primary" data-accion="curso-nuevo">＋ Nuevo curso</button></div>
      <div class="dr-grid2">${cards}</div>
    `);
  }
  /* Punto 10 · formulario de inscripción del curso (nombre, correo, cumpleaños,
     ministerio/nuevo, sexo) + enlace para compartir por WhatsApp. Cada inscrito
     se SINCRONIZA con el CRM general (STORE.crmAgregar). Todo curso tiene el suyo. */
  function linkInscripcionCurso(c) {
    const base = (typeof location !== "undefined" && location.origin) ? location.origin : "https://ecosistemacr.netlify.app";
    return base + "/experiencia.html?curso=" + encodeURIComponent(c.id);
  }
  function modalInscripcionCurso(id) {
    const S = window.STORE;
    const c = (S && S.curso) ? S.curso(id) : null;
    if (!c) return;
    const link = linkInscripcionCurso(c);
    const minOpts = (P.MIN_DEFS || []).map(m => `<option value="${m.id}|${esc(m.nombre)}">${esc(m.nombre)}</option>`).join("");
    const waHref = "https://wa.me/?text=" + encodeURIComponent("Te invito al curso " + c.nombre + " en Casa Roca · " + USER.sede + ". Inscríbete aquí: " + link);
    const qr = "https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=" + encodeURIComponent(link);
    const extra = Array.isArray(c.camposExtra) ? c.camposExtra : [];
    const extraHTML = extra.map((cf, i) => {
      const fid = "ps-insc-x" + i;
      if (cf.tipo === "textarea") return `<label class="dr-field"><span>${esc(cf.label)}</span><textarea id="${fid}" class="dr-input" data-xlabel="${esc(cf.label)}" rows="2"></textarea></label>`;
      const t = cf.tipo === "numero" ? "number" : cf.tipo === "fecha" ? "date" : cf.tipo === "telefono" ? "tel" : "text";
      return `<label class="dr-field"><span>${esc(cf.label)}</span><input id="${fid}" class="dr-input" type="${t}" data-xlabel="${esc(cf.label)}" /></label>`;
    }).join("");
    abrirModal(`
      <h2 id="dr-modal-t">Inscripción · ${esc(c.nombre)}</h2>
      <p class="dr-card__sub">Formulario de inscripción del curso, <b>sincronizado con el CRM general</b>: cada inscrito entra automáticamente al CRM de la sede. Comparte el enlace o el <b>QR</b>, o inscribe a alguien manualmente.</p>
      <div class="ps-share-box ps-share-box--qr">
        <div class="ps-share-box__main">
          <label class="dr-field"><span>Enlace para compartir</span><input id="ps-insc-link" class="dr-input" type="text" readonly value="${esc(link)}" /></label>
          <div class="dr-modal__actions" style="margin-top:6px">
            <a class="dr-btn dr-btn--ok" href="${waHref}" target="_blank" rel="noopener" data-accion="compartir-wa-curso">💬 WhatsApp</a>
            <button class="dr-btn dr-btn--ghost" data-accion="copiar-link-curso">📋 Copiar</button>
          </div>
        </div>
        <div class="ps-qr-box"><img class="ps-qr" src="${qr}" alt="Código QR de inscripción al curso ${esc(c.nombre)}" width="140" height="140" loading="lazy" /><small>Escanéalo para inscribirte</small></div>
      </div>
      <hr class="ps-hr" />
      <h3 class="ps-modal-sub">Inscribir a una persona</h3>
      <div class="dr-grid2">
        <label class="dr-field"><span>Nombre completo *</span><input id="ps-insc-nombre" class="dr-input" placeholder="Nombre y apellido" /></label>
        <label class="dr-field"><span>Correo *</span><input id="ps-insc-correo" class="dr-input" type="email" placeholder="correo@email.com" /></label>
      </div>
      <div class="dr-grid2">
        <label class="dr-field"><span>Cumpleaños</span><input id="ps-insc-cumple" class="dr-input" type="date" /></label>
        <label class="dr-field"><span>Sexo</span><select id="ps-insc-genero" class="dr-input"><option value="F">Mujer</option><option value="M">Hombre</option></select></label>
      </div>
      <label class="dr-field"><span>¿Activa en un ministerio o es nueva?</span>
        <select id="ps-insc-min" class="dr-input"><option value="nuevo|Nuevos">✨ Es nueva (aún no sirve)</option>${minOpts}</select></label>
      ${extra.length ? `<div class="ps-extra-fields"><p class="dr-card__sub">Campos propios de este curso</p>${extraHTML}</div>` : ""}
      <div class="dr-modal__actions">
        <button class="dr-btn dr-btn--primary" data-accion="guardar-inscripcion" data-id="${c.id}">Inscribir y agregar al CRM</button>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cerrar</button>
      </div>
    `);
  }

  function modalCurso(id) {
    const S = window.STORE;
    const c = id && S && S.curso ? (S.curso(id) || {}) : {};
    const editar = !!c.id;
    const etOpts = Object.keys(ETAPAS).map(k => `<option value="${k}" ${c.etapa === k ? "selected" : ""}>${esc(ETAPAS[k].lbl)}</option>`).join("");
    const modOpts = MODALIDADES.map(m => `<option value="${m}" ${c.modalidad === m ? "selected" : ""}>${m}</option>`).join("");
    abrirModal(`
      <h2 id="dr-modal-t">${editar ? "Editar curso" : "Nuevo curso"} · ${esc(USER.sede)}</h2>
      <p class="dr-card__sub">Lo que guardes aquí se publica en <b>Crece</b> del landing (ciudad: ${esc(L.ciudad ? L.ciudad(SEDE_CIUDAD).nombre : "tu sede")}).</p>
      <p class="dr-card__sub">📲 Al crear el curso se genera automáticamente su <b>formulario de inscripción</b> (nombre, correo, cumpleaños, ministerio/nuevo, sexo) <b>sincronizado con el CRM general</b>. Ábrelo con el botón 📲 en la tarjeta del curso.</p>
      <div class="dr-grid2">
        <label class="dr-field"><span>Nombre del curso *</span>
          <input id="ps-cur-nombre" class="dr-input" type="text" placeholder="Ej: ADN" value="${esc(c.nombre || "")}" /></label>
        <label class="dr-field"><span>Ícono (emoji)</span>
          <input id="ps-cur-ico" class="dr-input" type="text" maxlength="2" placeholder="🧬" value="${esc(c.ico || "")}" /></label>
      </div>
      <label class="dr-field"><span>Descripción breve</span>
        <input id="ps-cur-desc" class="dr-input" type="text" placeholder="Tus primeros pasos y la identidad de Casa Roca." value="${esc(c.desc || "")}" /></label>
      <div class="dr-grid2">
        <label class="dr-field"><span>Etapa (4C)</span>
          <select id="ps-cur-etapa" class="dr-input">${etOpts}</select></label>
        <label class="dr-field"><span>Modalidad</span>
          <select id="ps-cur-modalidad" class="dr-input">${modOpts}</select></label>
      </div>
      <label class="dr-field"><span>Profesor / responsable</span>
        <input id="ps-cur-profesor" class="dr-input" type="text" placeholder="Ps. Camilo Restrepo" value="${esc(c.profesor || "")}" /></label>
      <div class="dr-grid2">
        <label class="dr-field"><span>Día y hora</span>
          <input id="ps-cur-dia" class="dr-input" type="text" placeholder="Domingos 9:00 am" value="${esc(c.dia || "")}" /></label>
        <label class="dr-field"><span>Sesiones / duración</span>
          <input id="ps-cur-sesiones" class="dr-input" type="text" placeholder="4 sesiones" value="${esc(c.sesiones || "")}" /></label>
      </div>
      <div class="dr-grid2">
        <label class="dr-field"><span>Fecha de inicio</span>
          <input id="ps-cur-inicia" class="dr-input" type="date" value="${esc(c.inicia || "")}" /></label>
        <label class="dr-field"><span>Cupo</span>
          <input id="ps-cur-cupo" class="dr-input" type="number" min="0" step="1" inputmode="numeric" placeholder="30" value="${c.cupo != null ? c.cupo : ""}" /></label>
      </div>
      ${editar ? `<label class="dr-field"><span>Inscritos actuales</span>
        <input id="ps-cur-inscritos" class="dr-input" type="number" min="0" step="1" inputmode="numeric" value="${c.inscritos != null ? c.inscritos : 0}" /></label>` : ""}
      ${editar ? `<div class="ps-camposx">
        <p class="ps-modal-sub">🏷️ Campos personalizados del formulario</p>
        <p class="dr-card__sub">Cada curso puede pedir información distinta. Agrega los campos que necesites; aparecerán en el formulario de inscripción (📲) y viajarán al CRM.</p>
        <div class="ps-camposx__list">
          ${(Array.isArray(c.camposExtra) ? c.camposExtra : []).map((cf, i) => `<div class="ps-campox"><span>🏷️ <b>${esc(cf.label)}</b> · <i>${esc(cf.tipo || "texto")}</i></span><button class="dr-iconbtn" data-accion="curso-delcampo" data-id="${c.id}" data-idx="${i}" title="Quitar campo">✕</button></div>`).join("") || '<p class="dr-card__sub"><i>Aún sin campos personalizados.</i></p>'}
        </div>
        <div class="dr-grid2" style="align-items:end">
          <label class="dr-field"><span>Nuevo campo (etiqueta)</span><input id="ps-cur-xlabel" class="dr-input" placeholder="Ej. Talla de camiseta" /></label>
          <label class="dr-field"><span>Tipo</span><select id="ps-cur-xtipo" class="dr-input"><option value="texto">Texto</option><option value="numero">Número</option><option value="fecha">Fecha</option><option value="telefono">Teléfono</option><option value="textarea">Texto largo</option></select></label>
        </div>
        <button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="curso-addcampo" data-id="${c.id}">＋ Agregar campo</button>
      </div>` : `<p class="dr-card__sub">📋 Tras crear el curso, ábrelo para <b>editarlo</b> y añadir <b>campos personalizados</b> al formulario (cada curso puede pedir datos distintos). El formulario ya trae QR y enlace para compartir.</p>`}
      <label class="dr-check"><input id="ps-cur-activo" type="checkbox" ${c.activo === false ? "" : "checked"} /> <span>Publicado en el landing (visible en Crece)</span></label>
      <div class="dr-modal__actions">
        <button class="dr-btn dr-btn--primary" data-accion="curso-guardar" data-id="${esc(c.id || "")}">${editar ? "Guardar cambios" : "Crear curso"}</button>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>
    `);
  }

  function vistaTematicas() {
    if (temDrill) return vistaTematicaDetalle();
    const tems = tematicasSede();
    const cards = tems.map(t => {
      const nDocs = (t.docs || []).length;
      return `<div class="dr-card ps-tem-card ps-tem-card--click" data-accion="ver-tematica" data-id="${t.id}" data-live="${t.live ? "1" : ""}" role="button" tabindex="0">
        <div class="ps-tem-card__ico">${t.ico || "📚"}</div>
        <div class="ps-tem-card__body"><b>${esc(t.titulo)} ${t.live ? '<span class="ps-live-badge">🔗 J+25</span>' : ""}</b>
          <p>${esc(t.desc || "")}</p>
          <div class="ps-tem-card__meta">${pill(t.tipo || "Material")} ${pill(t.ministerio || "General")} <span>${fechaCorta(t.fecha)}</span>
            <span class="ps-tem-docs ${nDocs ? "" : "ps-tem-docs--0"}">📎 ${nDocs} doc${nDocs === 1 ? "" : "s"}</span></div></div>
        ${!t.live ? `<button class="dr-iconbtn" data-accion="del-tematica" data-id="${t.id}" title="Eliminar">✕</button>` : ""}
      </div>`;
    }).join("");
    return shell(`
      <div class="dr-head"><div>
        <h1 class="dr-h1">Temáticas y material</h1>
        <p class="dr-lead">Series, talleres y campañas de toda la sede. Toca una para ver el detalle y subir documentos. Las de J+25 llegan en vivo del director.</p>
      </div>
      <button class="dr-btn dr-btn--primary" data-accion="nueva-tematica">＋ Nueva temática</button></div>
      <div class="dr-grid2">${cards}</div>
    `);
  }

  function vistaTematicaDetalle() {
    const { t, live } = temPorId(temDrill, temDrillLive);
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
            <h1 class="dr-h1">${esc(t.titulo)} ${live ? '<span class="ps-live-badge">🔗 J+25 en vivo</span>' : ""}</h1>
            <div class="ps-tem-card__meta">${pill(t.tipo || "Material")} ${pill(t.ministerio || "General")} <span>📅 ${fechaCorta(t.fecha)}</span></div>
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
    const { t } = temPorId(id, temDrillLive);
    abrirModal(`
      <h2 id="dr-modal-t">Subir documento${t ? " · " + esc(t.titulo) : ""}</h2>
      <label class="dr-field"><span>Archivo</span><input id="ps-doc-archivo" class="dr-input" type="file" /></label>
      <label class="dr-field"><span>Nombre para mostrar <small>(opcional)</small></span><input id="ps-doc-nombre" class="dr-input" placeholder="Ej. Guía semana 1" /></label>
      <label class="dr-field"><span>Nota <small>(opcional)</small></span><textarea id="ps-doc-nota" class="dr-input" rows="2" placeholder="Para qué sirve o cómo usarlo…"></textarea></label>
      <div class="dr-modal__actions">
        <button class="dr-btn dr-btn--primary" data-accion="guardar-doc" data-id="${id}">Subir</button>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>
    `);
  }
  function modalTematica() {
    abrirModal(`
      <h2 id="dr-modal-t">Nueva temática</h2>
      <label class="dr-field"><span>Título</span><input id="ps-tem-titulo" class="dr-input" placeholder="Ej. Familias que permanecen" /></label>
      <label class="dr-field"><span>Descripción</span><input id="ps-tem-desc" class="dr-input" placeholder="De qué trata" /></label>
      <div class="dr-field-row">
        <label class="dr-field"><span>Tipo</span><input id="ps-tem-tipo" class="dr-input" placeholder="Serie / Taller / Campaña" /></label>
        <label class="dr-field"><span>Ministerio</span><input id="ps-tem-min" class="dr-input" placeholder="General o un ministerio" /></label>
        <label class="dr-field"><span>Ícono</span><input id="ps-tem-ico" class="dr-input" placeholder="📚" /></label>
      </div>
      <div class="dr-modal__actions">
        <button class="dr-btn dr-btn--primary" data-accion="guardar-tematica">Crear</button>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>
    `);
  }

  /* ============================================================ 9. PETICIONES */
  function vistaPeticiones() {
    const elbl = { abierta: "Abiertas", orando: "Orando", respondida: "Respondidas" };
    // De la sede: líderes, directores y personas (excluye internas). Internas: solo entre pastores.
    const deSede = peticionesSede().filter(p => !p.interna);
    const internas = PS.peticiones().filter(p => p.interna);
    const interna = petScope === "internas";
    const fuente = interna ? internas : deSede;
    let lista = fuente;
    if (filtroPet !== "todas") lista = lista.filter(p => p.estado === filtroPet);
    const filas = lista.map(p => `<div class="dr-card ps-pet-card${p.interna ? " ps-pet-card--int" : ""}">
        <div class="ps-pet-card__head"><b>${esc(p.autor)}</b> ${pill(p.ministerio || "General")} ${p.interna ? '<span class="ps-live-badge ps-live-badge--int">🔒 Interna</span>' : ""}${p.live ? '<span class="ps-live-badge">🔗 J+25</span>' : ""}<span class="ps-pet-fecha">${fechaCorta(p.fecha)}</span></div>
        <p class="ps-pet-card__txt">${esc(p.texto)}</p>
        <div class="ps-pet-card__acts">
          <span class="ps-estado ps-estado--${p.estado}">${p.estado === "abierta" ? "Abierta" : p.estado === "orando" ? "🙏 Orando" : "✓ Respondida"}</span>
          ${!p.live ? `${p.estado !== "orando" ? `<button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="estado-pet" data-id="${p.id}" data-e="orando">🙏 Orando</button>` : ""}
          ${p.estado !== "respondida" ? `<button class="dr-btn dr-btn--ok dr-btn--sm" data-accion="estado-pet" data-id="${p.id}" data-e="respondida">✓ Respondida</button>` : ""}` : '<span class="dr-card__sub">Gestionada por el director</span>'}
        </div>
      </div>`).join("");
    const vacio = interna
      ? '<p class="dr-card__sub">No hay peticiones internas en este filtro. Crea una con “＋ Nueva petición”.</p>'
      : '<p class="dr-card__sub">No hay peticiones en este filtro.</p>';
    return shell(`
      <div class="dr-head"><div>
        <h1 class="dr-h1">Peticiones de oración</h1>
        <p class="dr-lead">${interna
          ? "Peticiones internas, confidenciales y visibles solo entre pastores. No se comparten con líderes ni directores."
          : "Todas las peticiones de la sede, sincronizadas de líderes y directores. Acompáñalas con tu equipo."}</p>
      </div>
      <button class="dr-btn dr-btn--primary" data-accion="nueva-peticion">＋ Nueva petición</button></div>
      <div class="dr-filtros ps-pet-scope">
        <button class="dr-filtro ${!interna ? "is-active" : ""}" data-accion="scope-pet" data-s="sede">🏛️ De la sede (${deSede.length})</button>
        <button class="dr-filtro ${interna ? "is-active" : ""}" data-accion="scope-pet" data-s="internas">🔒 Internas · solo pastores (${internas.length})</button>
      </div>
      <div class="dr-filtros">${["todas", "abierta", "orando", "respondida"].map(f => `<button class="dr-filtro ${filtroPet === f ? "is-active" : ""}" data-accion="filtro-pet" data-f="${f}">${f === "todas" ? "Todas" : elbl[f]} (${f === "todas" ? fuente.length : fuente.filter(p => p.estado === f).length})</button>`).join("")}</div>
      <div class="dr-grid2">${filas || vacio}</div>
    `);
  }
  function modalPeticion() {
    const interna = petScope === "internas";
    abrirModal(`
      <h2 id="dr-modal-t">${interna ? "Nueva petición interna" : "Nueva petición"}</h2>
      <label class="dr-field"><span>Autor</span><input id="ps-pet-autor" class="dr-input" placeholder="Nombre (opcional)" value="${esc(USER.nombre)}" /></label>
      <label class="dr-field"><span>Ministerio</span><input id="ps-pet-min" class="dr-input" placeholder="General o un ministerio" /></label>
      <label class="dr-field"><span>Petición</span><textarea id="ps-pet-texto" class="dr-input" rows="3" placeholder="Escribe la petición…"></textarea></label>
      <label class="ps-pet-check"><input type="checkbox" id="ps-pet-interna" ${interna ? "checked" : ""} /> <span>🔒 Petición interna — solo visible entre pastores</span></label>
      <div class="dr-modal__actions">
        <button class="dr-btn dr-btn--primary" data-accion="guardar-peticion">Publicar</button>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>
    `);
  }

  /* ============================================================ 9b. ORACIÓN · centro de intercesión
     Centraliza TODAS las peticiones de la sede (congregación + equipos operativos),
     sincronizadas de líderes y directores, y las conecta con el equipo de Intercesión
     (o_oracion) que las cubre. Dos vistas: el Tablero y el Equipo. */
  function petCardOracion(p) {
    const estLbl = p.estado === "abierta" ? "Abierta" : p.estado === "orando" ? "🙏 Orando" : "✓ Respondida";
    return `<div class="dr-card ps-pet-card${p.intercesion ? " ps-pet-card--interc" : ""}">
      <div class="ps-pet-card__head"><b>${esc(p.autor)}</b> ${pill(p.ministerio || "General")} ${p.intercesion ? '<span class="ps-live-badge ps-live-badge--interc">🕊️ En intercesión</span>' : ""}${p.live ? '<span class="ps-live-badge">🔗 J+25</span>' : ""}<span class="ps-pet-fecha">${fechaCorta(p.fecha)}</span></div>
      <p class="ps-pet-card__txt">${esc(p.texto)}</p>
      <div class="ps-pet-card__acts">
        <span class="ps-estado ps-estado--${p.estado}">${estLbl}</span>
        ${!p.live ? `
          <button class="dr-btn ${p.intercesion ? "dr-btn--ghost" : "dr-btn--primary"} dr-btn--sm" data-accion="toggle-interc" data-id="${p.id}">${p.intercesion ? "Quitar de intercesión" : "🕊️ A intercesión"}</button>
          ${p.estado !== "orando" ? `<button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="estado-pet" data-id="${p.id}" data-e="orando">🙏 Orando</button>` : ""}
          ${p.estado !== "respondida" ? `<button class="dr-btn dr-btn--ok dr-btn--sm" data-accion="estado-pet" data-id="${p.id}" data-e="respondida">✓ Respondida</button>` : ""}
        ` : '<span class="dr-card__sub">Gestionada por el director</span>'}
      </div>
    </div>`;
  }
  function vistaOracion() {
    const team = P.MIN_DEFS.find(m => m.id === "o_oracion");
    const roster = team ? (team._roster || []) : [];
    // Tablero centralizado: TODAS las peticiones de la sede (congregación + equipos), sin internas.
    const todas = peticionesSede().filter(p => !p.interna);
    const enInterc = todas.filter(p => p.intercesion);
    const abiertas = todas.filter(p => p.estado === "abierta").length;
    const orando = todas.filter(p => p.estado === "orando").length;
    const respondidas = todas.filter(p => p.estado === "respondida").length;
    const tabs = `<div class="dr-filtros ps-pet-scope">
        <button class="dr-filtro ${oracionTab === "tablero" ? "is-active" : ""}" data-accion="oracion-tab" data-t="tablero">🕊️ Tablero (${todas.length})</button>
        <button class="dr-filtro ${oracionTab === "equipo" ? "is-active" : ""}" data-accion="oracion-tab" data-t="equipo">🤝 Equipo de intercesión (${roster.length})</button>
      </div>`;

    /* ---- Panel del equipo de intercesión ---- */
    if (oracionTab === "equipo") {
      const dir = (team && team.director) || {};
      const cadenas = (team ? team._grupos || [] : []).map(g => {
        const miembros = roster.filter(p => p.grupo === g.nombre).length;
        return `<div class="ps-eqop-grp">
          <div><b>${esc(g.nombre)}</b><small>${esc(g.lider ? g.lider.nombre : "—")} · ${esc(g.dia)} ${esc(g.hora)}</small></div>
          <span class="ps-pill">${miembros}${g.cupo ? " / " + g.cupo : ""}</span>
        </div>`;
      }).join("");
      const personas = roster.slice(0, 12).map(p => `<article class="dr-person dr-person--click" data-accion="ver-persona" data-id="${p.id}" tabindex="0" role="button">
        <div class="dr-avatar">${esc(iniciales(p))}</div>
        <div class="dr-person__main"><b>${esc(nombreCompleto(p))}</b><span>${esc(p.grupo || "Servicio")}</span></div>
        ${chip(p.etapa)}</article>`).join("");
      return shell(`
        <div class="dr-head"><div>
          <h1 class="dr-h1">Oración · Intercesión</h1>
          <p class="dr-lead">El equipo de Intercesión cubre en oración las peticiones de toda la sede. Es un equipo operativo más del catálogo (aparece también en «Sirve»).</p>
        </div>
        <button class="dr-btn dr-btn--ghost" data-accion="ver-equipo-op" data-id="o_oracion">Ver ficha completa →</button></div>
        ${tabs}
        <div class="dr-kpis">
          ${kpi(roster.length, "Intercesores")}
          ${kpi((team ? team._grupos.length : 0), "Cadenas y vigilias")}
          ${kpi(enInterc.length, "Peticiones cubiertas")}
        </div>
        <div class="dr-card">
          <h3 class="dr-card__t">Director del equipo</h3>
          <div class="ps-pet-card__head"><b>${esc(dir.nombre || "—")}</b> ${pill(team ? team.nombre : "Oración")}<span class="ps-pet-fecha">${esc(dir.email || "")}</span></div>
          ${dir.tel ? `<div class="dr-modal__actions" style="margin-top:8px"><a class="dr-btn dr-btn--ok dr-btn--sm" href="${waLink(dir.tel, dir.nombre)}" target="_blank" rel="noopener">💬 Escribir al director</a></div>` : ""}
        </div>
        <h3 class="ps-modal-sub">Cadenas, turnos y vigilias</h3>
        ${cadenas}
        <h3 class="ps-modal-sub">Intercesores (${roster.length})</h3>
        <div class="dr-person-grid">${personas}</div>
      `);
    }

    /* ---- Tablero centralizado ---- */
    const elbl = { abierta: "Abiertas", orando: "Orando", respondida: "Respondidas" };
    // Punto 11 · Oración fusiona TODO: peticiones de la sede (líderes + directores),
    // y también las internas de pastores (antes en la pestaña "Peticiones").
    const internas = PS.peticiones().filter(p => p.interna);
    const minSet = [...new Set(todas.map(p => p.ministerio || "General"))].sort();
    let lista;
    if (oracionMin === "internas") lista = internas.slice();
    else {
      lista = todas.slice();
      if (oracionMin === "interc") lista = lista.filter(p => p.intercesion);
      else if (oracionMin !== "todos") lista = lista.filter(p => (p.ministerio || "General") === oracionMin);
    }
    if (oracionEstado !== "todas") lista = lista.filter(p => p.estado === oracionEstado);
    const filas = lista.map(petCardOracion).join("");
    const minOpts = `<option value="todos">Todos los ministerios</option><option value="interc" ${oracionMin === "interc" ? "selected" : ""}>🕊️ Solo en intercesión</option><option value="internas" ${oracionMin === "internas" ? "selected" : ""}>🔒 Internas · solo pastores (${internas.length})</option>` +
      minSet.map(mm => `<option value="${esc(mm)}" ${oracionMin === mm ? "selected" : ""}>${esc(mm)}</option>`).join("");

    return shell(`
      <div class="dr-head"><div>
        <h1 class="dr-h1">Oración · Intercesión</h1>
        <p class="dr-lead">El lugar donde se centraliza toda la oración de la sede: peticiones de todos los ministerios y equipos, sincronizadas de líderes y directores. Asígnalas al equipo de Intercesión para que las cubra.</p>
      </div>
      <button class="dr-btn dr-btn--primary" data-accion="nueva-peticion">＋ Nueva petición</button></div>
      ${tabs}
      <div class="dr-kpis">
        ${kpi(todas.length, "Peticiones totales")}
        ${kpi(orando, "🙏 Orando")}
        ${kpi(respondidas, "✓ Respondidas")}
        ${kpi(enInterc.length, "🕊️ En intercesión")}
      </div>
      <div class="dr-head" style="margin-top:4px">
        <div class="dr-filtros">${["todas", "abierta", "orando", "respondida"].map(f => `<button class="dr-filtro ${oracionEstado === f ? "is-active" : ""}" data-accion="oracion-estado" data-f="${f}">${f === "todas" ? "Todas" : elbl[f]} (${f === "todas" ? todas.length : todas.filter(p => p.estado === f).length})</button>`).join("")}</div>
        <select class="dr-select" data-accion="oracion-min" aria-label="Filtrar por ministerio">${minOpts}</select>
      </div>
      <div class="dr-grid2">${filas || '<p class="dr-card__sub">No hay peticiones en este filtro.</p>'}</div>
    `);
  }

  /* ============================================================ 10. REQUERIMIENTOS */
  function diasEntre(a, b) { if (!a || !b) return null; const d = (new Date(b) - new Date(a)) / 86400000; return Math.max(0, Math.round(d)); }
  function vistaRequerimientos() {
    let reqs = PS.requerimientos();
    if (reqFiltro !== "todos") {
      if (REQ_ESTADOS.includes(reqFiltro)) reqs = reqs.filter(r => r.estado === reqFiltro);
      else reqs = reqs.filter(r => r.equipo === reqFiltro);
    }
    const eqName = id => (P.EQUIPOS_ADMIN.find(e => e.id === id) || {}).nombre || id;
    const eqIco = id => (P.EQUIPOS_ADMIN.find(e => e.id === id) || {}).ico || "🎫";
    const todos = PS.requerimientos();
    const abiertos = todos.filter(r => r.estado !== "Resuelto").length;
    const resueltos = todos.filter(r => r.estado === "Resuelto");
    const tProm = resueltos.length ? Math.round(resueltos.map(r => diasEntre(r.fecha, r.respondidoEl) || 0).reduce((a, b) => a + b, 0) / resueltos.length) : "—";

    const filas = reqs.map(r => {
      const espera = r.estado === "Resuelto" ? `Resuelto en ${diasEntre(r.fecha, r.respondidoEl)} d` : `${diasDesde(r.fecha)} d en espera`;
      const eCls = r.estado === "Resuelto" ? "ps-estado--respondida" : r.estado === "En proceso" ? "ps-estado--orando" : "ps-estado--abierta";
      return `<div class="dr-card ps-req-card" data-accion="ver-req" data-id="${r.id}" role="button" tabindex="0">
        <div class="ps-req-card__top"><span class="ps-req-ico">${eqIco(r.equipo)}</span>
          <div class="ps-req-card__title"><b>${esc(r.asunto)}</b><small>${esc(eqName(r.equipo))} · ${fechaCorta(r.fecha)}</small></div>
          <span class="ps-prio" style="--pc:${PRIO[r.prioridad] || "var(--azul-400)"}">${esc(r.prioridad)}</span>
        </div>
        <p class="ps-req-card__desc">${esc(r.descripcion)}</p>
        <div class="ps-req-card__foot"><span class="ps-estado ${eCls}">${esc(r.estado)}</span><span class="ps-req-espera">⏱️ ${espera}</span>${r.respuestas.length ? `<span class="ps-tag">${r.respuestas.length} resp.</span>` : ""}</div>
      </div>`;
    }).join("");

    const chipsEquipo = P.EQUIPOS_ADMIN.map(e => `<button class="dr-filtro ${reqFiltro === e.id ? "is-active" : ""}" data-accion="req-filtro" data-f="${e.id}">${e.ico} ${esc(e.nombre)}</button>`).join("");

    return shell(`
      <div class="dr-head"><div>
        <h1 class="dr-h1">Requerimientos a la administración</h1>
        <p class="dr-lead">Mesa de servicio a la administración central. Crea solicitudes a Contabilidad, RRHH, Comunicaciones, Legal, Tesorería o Construcción, y haz seguimiento de su estado y tiempos de respuesta.</p>
      </div>
      <button class="dr-btn dr-btn--primary" data-accion="nuevo-req">＋ Nuevo requerimiento</button></div>

      <div class="dr-kpis">
        ${kpi(todos.length, "Total requerimientos")}
        ${kpi(abiertos, "Sin resolver", null, abiertos > 0)}
        ${kpi(resueltos.length, "Resueltos")}
        ${kpi(tProm === "—" ? "—" : tProm + " d", "Tiempo prom. respuesta")}
      </div>

      <div class="dr-filtros">
        <button class="dr-filtro ${reqFiltro === "todos" ? "is-active" : ""}" data-accion="req-filtro" data-f="todos">Todos</button>
        ${REQ_ESTADOS.map(e => `<button class="dr-filtro ${reqFiltro === e ? "is-active" : ""}" data-accion="req-filtro" data-f="${e}">${e}</button>`).join("")}
      </div>
      <div class="dr-filtros ps-subnav">${chipsEquipo}</div>

      <div class="dr-grid2">${filas || '<p class="dr-card__sub">No hay requerimientos en este filtro.</p>'}</div>
    `);
  }
  function modalReq(id) {
    const r = PS.requerimientos().find(x => x.id === id); if (!r) return;
    const eq = P.EQUIPOS_ADMIN.find(e => e.id === r.equipo) || {};
    const resp = r.respuestas.map(x => `<div class="ps-resp"><div class="ps-resp__head"><b>${esc(x.de)}</b><span>${fechaCorta(x.fecha)}</span></div><p>${esc(x.texto)}</p></div>`).join("") || '<p class="dr-card__sub">Aún sin respuesta de la administración.</p>';
    const espera = r.estado === "Resuelto" ? `Resuelto en ${diasEntre(r.fecha, r.respondidoEl)} días` : `${diasDesde(r.fecha)} días en espera · SLA ${esc(eq.sla || "—")}`;
    abrirModal(`
      <div class="dr-modal__head"><div class="ps-req-ico ps-req-ico--lg">${eq.ico || "🎫"}</div>
        <div><h2 id="dr-modal-t">${esc(r.asunto)}</h2><p class="dr-card__sub">${esc(eq.nombre || r.equipo)} · ${esc(eq.contacto || "")} · ${fechaCorta(r.fecha)}</p></div></div>
      <div class="ps-req-meta">
        ${pill(r.estado, r.estado === "Resuelto" ? "ps-pill--ok" : "ps-pill--warn")}
        <span class="ps-prio" style="--pc:${PRIO[r.prioridad] || "var(--azul-400)"}">${esc(r.prioridad)}</span>
        <span class="ps-req-espera">⏱️ ${espera}</span>
      </div>
      <p class="ps-req-desc-full">${esc(r.descripcion)}</p>
      <h3 class="dr-card__t">Conversación</h3>
      <div class="ps-resps">${resp}</div>
      <label class="dr-field"><span>Agregar nota / responder</span><textarea id="ps-req-resp" class="dr-input" rows="2" placeholder="Escribe una nota de seguimiento…"></textarea></label>
      <div class="dr-modal__actions">
        <button class="dr-btn dr-btn--primary" data-accion="req-add-resp" data-id="${r.id}">Enviar nota</button>
        ${r.estado !== "En proceso" ? `<button class="dr-btn dr-btn--ghost" data-accion="req-estado" data-id="${r.id}" data-e="En proceso">Marcar En proceso</button>` : ""}
        ${r.estado !== "Resuelto" ? `<button class="dr-btn dr-btn--ok" data-accion="req-estado" data-id="${r.id}" data-e="Resuelto">✓ Marcar resuelto</button>` : ""}
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cerrar</button>
      </div>
    `);
  }
  function modalNuevoReq() {
    const eqOpts = P.EQUIPOS_ADMIN.map(e => `<option value="${e.id}">${e.ico} ${esc(e.nombre)} · SLA ${esc(e.sla)}</option>`).join("");
    abrirModal(`
      <h2 id="dr-modal-t">Nuevo requerimiento a la administración</h2>
      <label class="dr-field"><span>Equipo destino</span><select id="ps-req-eq" class="dr-select">${eqOpts}</select></label>
      <label class="dr-field"><span>Asunto</span><input id="ps-req-asunto" class="dr-input" placeholder="Ej. Solicitud de…" /></label>
      <label class="dr-field"><span>Descripción</span><textarea id="ps-req-desc" class="dr-input" rows="3" placeholder="Detalla tu requerimiento…"></textarea></label>
      <label class="dr-field"><span>Prioridad</span><select id="ps-req-prio" class="dr-select"><option>Media</option><option>Alta</option><option>Baja</option></select></label>
      <div class="dr-modal__actions">
        <button class="dr-btn dr-btn--primary" data-accion="guardar-req">Enviar requerimiento</button>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>
    `);
  }

  /* ============================================================ 11. DIRECTORIO */
  /* ============================================================ PANEL ANIDADO
     Patrón reutilizable (nombre oficial: "Panel Anidado"). Al abrir una pestaña
     base que es un MINISTERIO con su propio sistema (Consejería y, a futuro,
     otros), se despliega una SEGUNDA columna de pestañas — las mismas del
     director — y el pastor ve/gestiona TODO como lo ve el director (jerarquía
     superior, mismo sistema). Firma: panelAnidado(titulo, lead, extraHead, subtabs, activoId, accion). */
  function panelAnidado(titulo, lead, extraHead, subtabs, activoId, accion) {
    const act = subtabs.find(t => t.id === activoId) || subtabs[0];
    return shell(`
      <div class="dr-head"><div>
        <h1 class="dr-h1">${esc(titulo)}</h1>
        <p class="dr-lead">${lead}</p>
      </div>${extraHead || ""}</div>
      <div class="ps-nested">
        <nav class="ps-nested__tabs" aria-label="Pestañas de ${esc(titulo)}">
          ${subtabs.map(t => `<button class="ps-nested__tab ${act.id === t.id ? "is-active" : ""}" data-accion="${accion}" data-t="${t.id}">${t.ico} <span>${esc(t.lbl)}</span></button>`).join("")}
        </nav>
        <div class="ps-nested__body">${act.html}</div>
      </div>
    `);
  }

  const CONSEJERIA_BASE = "https://consejeriacr.netlify.app";
  function vistaConsejeria() {
    // El pastor ve el SISTEMA REAL del director (mismas páginas, mismo detalle),
    // embebido. Elige el rol arriba; cada pestaña carga la app real de ese rol.
    const paginas = {
      director: { lbl: "Dirección", ico: "📚", src: "consejeria-director.html" },
      coordinador: { lbl: "Coordinación", ico: "🗂️", src: "consejeria-coordinador.html" },
      consejero: { lbl: "Consejero", ico: "👥", src: "consejeria-consejero.html" },
      solicitud: { lbl: "Solicitud (público)", ico: "📝", src: "consejeria-solicitud.html" },
    };
    const activo = paginas[consSub] ? consSub : "director";
    const iframeHTML = k => `<div class="ps-embedwrap"><iframe class="ps-embed" src="${paginas[k].src}" title="Sistema de Consejería · ${esc(paginas[k].lbl)}" loading="lazy"></iframe></div>`;
    const subtabs = Object.keys(paginas).map(k => ({ id: k, ico: paginas[k].ico, lbl: paginas[k].lbl, html: iframeHTML(k) }));
    const head = `<a class="dr-btn dr-btn--ghost" href="${paginas[activo].src}" target="_blank" rel="noopener">Abrir en pantalla completa ↗</a>`;
    const lead = `<b>Panel anidado.</b> Estás viendo el <b>sistema real del director</b> de Consejería — completo y con el mismo detalle. Elige el rol arriba (Dirección, Coordinación, Consejero, Solicitud); todo lo que ve y hace el director te aparece aquí.`;
    return panelAnidado("Consejería", lead, head, subtabs, activo, "cons-sub");
  }

  // Equipo de Consejería (Punto 12): el mismo directorio que ven los directores,
  // anclado aquí. En Fase 1 se sincroniza con el sistema de Consejería.
  function consejeriaDir() {
    return [
      { nombre: "Ps. Andrea Pineda", rol: "Directora de Consejería", iglesia: "Casa Roca · Bogotá Chicó (sede madre)", ciudad: "Bogotá", telefono: "+57 300 555 7010", email: "consejeria@casaroca.org", tipo: "consejeria" },
      { nombre: "Coord. Marcela Ríos", rol: "Coordinadora · Consejería de pareja", iglesia: "Casa Roca · Bogotá Chicó", ciudad: "Bogotá", telefono: "+57 300 555 7011", email: "marcela.rios@casaroca.org", tipo: "consejeria" },
      { nombre: "Coord. Julián Vera", rol: "Coordinador · Consejería individual", iglesia: "Casa Roca · Bogotá Chicó", ciudad: "Bogotá", telefono: "+57 300 555 7012", email: "julian.vera@casaroca.org", tipo: "consejeria" },
      { nombre: "Consejero David Mora", rol: "Consejero", iglesia: "Casa Roca · Bogotá Chicó", ciudad: "Bogotá", telefono: "+57 300 555 7013", email: "david.mora@casaroca.org", tipo: "consejeria" },
      { nombre: "Consejera Paula Nieto", rol: "Consejera", iglesia: "Casa Roca · Bogotá Chicó", ciudad: "Bogotá", telefono: "+57 300 555 7014", email: "paula.nieto@casaroca.org", tipo: "consejeria" },
      { nombre: "Consejera Lina Gómez", rol: "Consejera · Familia", iglesia: "Casa Roca · Bogotá Chicó", ciudad: "Bogotá", telefono: "+57 300 555 7015", email: "lina.gomez@casaroca.org", tipo: "consejeria" },
    ];
  }
  function vistaDirectorio() {
    const pastores = P.DIRECTORIO_PASTORES, admin = P.DIRECTORIO_ADMIN, consej = consejeriaDir();
    let lista = [];
    if (dirFiltro === "consejeria") lista = consej.slice();
    else {
      if (dirFiltro === "todos" || dirFiltro === "pastores") lista = lista.concat(pastores);
      if (dirFiltro === "todos" || dirFiltro === "admin") lista = lista.concat(admin);
    }
    if (dirQuery) {
      const q = dirQuery.toLowerCase();
      lista = lista.filter(x => (x.nombre + " " + x.iglesia + " " + (x.ciudad || "") + " " + x.rol + " " + x.email).toLowerCase().includes(q));
    }
    const ini = x => (x.nombre.replace(/^(Pastor[a]?|Ps\.|Coord\.|Consejer[oa])\s+/, "").split(" ").map(w => w[0]).slice(0, 2).join("")).toUpperCase();
    const tagDe = x => x.esMadre ? '<span class="ps-tag ps-ok">Sede madre</span>' : x.tipo === "admin" ? '<span class="ps-tag">Admin central</span>' : x.tipo === "consejeria" ? '<span class="ps-tag">Consejería</span>' : "";
    const filas = lista.map(x => `<tr>
        <td><div class="dr-cell-person"><span class="dr-mini-avatar">${esc(ini(x))}</span><div><b>${esc(x.nombre)}</b><small>${esc(x.rol)}</small></div></div></td>
        <td>🏛️ ${esc(x.iglesia)}${x.ciudad ? " · " + esc(x.ciudad) : ""} ${tagDe(x)}</td>
        <td><div class="ps-dir-card__contact">
          <a class="dr-btn dr-btn--ghost dr-btn--sm" href="${waLink(x.telefono, x.nombre.replace(/^(Pastor[a]?|Ps\.|Coord\.|Consejer[oa])\s+/, ""))}" target="_blank" rel="noopener" data-stop>💬 ${esc(x.telefono)}</a>
          <a class="dr-btn dr-btn--ghost dr-btn--sm" href="mailto:${x.email}" data-stop>✉️ Correo</a>
        </div></td>
      </tr>`).join("");
    return shell(`
      <div class="dr-head"><div>
        <h1 class="dr-h1">Directorio de la red</h1>
        <p class="dr-lead">Pastores de las 36 iglesias, la administración central y el equipo de <b>Consejería</b>, con teléfono y correo. 🔒 Visible solo para pastores.</p>
      </div></div>
      <div class="dr-toolbar">
        <input id="ps-dir-search" class="dr-search" type="search" placeholder="🔍 Buscar por nombre, iglesia, ciudad o rol…" aria-label="Buscar en el directorio" />
      </div>
      <div class="dr-filtros">
        ${[["todos", "Todos (" + (pastores.length + admin.length) + ")"], ["pastores", "Pastores (" + pastores.length + ")"], ["admin", "Admin central (" + admin.length + ")"], ["consejeria", "🧭 Consejería (" + consej.length + ")"]].map(([id, lbl]) => `<button class="dr-filtro ${dirFiltro === id ? "is-active" : ""}" data-accion="dir-filtro" data-f="${id}">${lbl}</button>`).join("")}
      </div>
      <div class="dr-tablewrap"><table class="dr-table">
        <thead><tr><th>Persona</th><th>Iglesia / Ciudad</th><th>Contacto</th></tr></thead>
        <tbody id="ps-dir-grid">${filas || '<tr><td colspan="3"><i>Sin resultados.</i></td></tr>'}</tbody>
      </table></div>
    `);
  }

  /* ============================================================ MODAL / TOAST */
  function abrirModal(html) {
    const wrap = document.getElementById("ps-modal");
    wrap.innerHTML = `<div class="dr-modalbg" id="ps-modalbg"><div class="dr-modal" role="dialog" aria-modal="true" aria-labelledby="dr-modal-t">${html}</div></div>`;
    document.getElementById("ps-modalbg").addEventListener("click", e => { if (e.target.id === "ps-modalbg") cerrarModal(); });
    document.addEventListener("keydown", escClose);
  }
  function cerrarModal() { const w = document.getElementById("ps-modal"); if (w) w.innerHTML = ""; document.removeEventListener("keydown", escClose); }
  function escClose(e) { if (e.key === "Escape") cerrarModal(); }
  function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ""; }
  function chk(id) { const el = document.getElementById(id); return !!(el && el.checked); }
  function toast(msg, ok) {
    const wrap = document.getElementById("ps-toasts");
    const el = document.createElement("div");
    el.className = "dr-toast" + (ok ? " dr-toast--ok" : "");
    el.innerHTML = `<span>${ok ? "✓" : "ℹ️"}</span><span>${esc(msg)}</span>`;
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateY(8px)"; setTimeout(() => el.remove(), 250); }, 3000);
  }

  /* ============================================================ RENDER */
  const VISTAS = {
    analitica: vistaAnalitica, tareas: vistaTareas, crm: vistaCRM, finanzas: vistaFinanzas, asistencia: vistaAsistencia, organigrama: vistaOrganigrama,
    calendario: vistaCalendario, grupos: vistaGrupos, equipo: vistaEquipo, sirve: vistaSirve, tematicas: vistaTematicas,
    oracion: vistaOracion, peticiones: vistaOracion, consejeria: vistaConsejeria, requerimientos: vistaRequerimientos, directorio: vistaDirectorio,
    cursos: vistaCursos,
    rocakids: () => shell(window.PASTOR_RK ? window.PASTOR_RK.render() : '<div class="dr-empty">RocaKids no disponible.</div>'),
  };
  function render() {
    // tema violeta (.rk) solo dentro de la pestaña RocaKids
    if (document.body && document.body.classList) document.body.classList.toggle("rk", sesion && vista === "rocakids");
    if (document.body && document.body.classList) document.body.classList.toggle("ps-cons-full", sesion && vista === "consejeria");
    if (!sesion) { app().innerHTML = vistaLogin(); const g = document.getElementById("ps-google"); if (g) g.addEventListener("click", entrar); return; }
    const fn = VISTAS[vista] || vistaAnalitica;
    app().innerHTML = fn();
    if (!clickBound) { document.addEventListener("click", manejar); clickBound = true; }
    if (vista === "crm") bindSearch("ps-crm-search", "ps-crm-body", "ps-crm-count", v => crmQuery = v);
    if (vista === "directorio") bindDirSearch();
    if (vista === "consejeria") bindConsejeriaEmbed();
    if (vista === "rocakids" && window.PASTOR_RK && window.PASTOR_RK.afterRender) window.PASTOR_RK.afterRender();
  }
  function bindSearch(inputId, bodyId, countId) {
    const inp = document.getElementById(inputId); if (!inp) return;
    inp.value = crmQuery;
    inp.addEventListener("input", () => {
      const q = inp.value.trim().toLowerCase(); crmQuery = q; let vis = 0;
      document.querySelectorAll("#" + bodyId + " tr").forEach(tr => { const ok = !q || (tr.dataset.search || "").includes(q); tr.style.display = ok ? "" : "none"; if (ok) vis++; });
      const c = document.getElementById(countId); if (c) c.textContent = vis;
    });
    if (crmQuery) inp.dispatchEvent(new Event("input"));
  }
  // Panel Anidado · el sistema del director embebido pide "entrar" (demo). Como
  // es mismo origen, entramos automáticamente para que el pastor vea el sistema
  // completo del director sin pasar por su login.
  function bindConsejeriaEmbed() {
    const ifr = document.querySelector(".ps-embed");
    if (!ifr) return;
    const autoEntrar = () => {
      try { const doc = ifr.contentDocument; if (doc) { const b = doc.querySelector(".dr-google"); if (b) b.click(); } } catch (e) {}
    };
    ifr.addEventListener("load", autoEntrar);
    autoEntrar();
  }
  function bindDirSearch() {
    const inp = document.getElementById("ps-dir-search"); if (!inp) return;
    inp.value = dirQuery;
    inp.addEventListener("input", () => { dirQuery = inp.value.trim(); render(); const i2 = document.getElementById("ps-dir-search"); if (i2) { i2.focus(); i2.setSelectionRange(i2.value.length, i2.value.length); } });
  }
  function entrar() { sesion = true; render(); toast(`¡Bienvenido, pastor ${USER.nombre.split(" ")[0]}! 👋`, true); }

  /* ============================================================ EVENTOS */
  function manejar(ev) {
    // enlaces internos (WhatsApp/correo de un miembro) no deben disparar la acción de la tarjeta
    if (ev.target.closest("[data-stop]")) return;
    const el = ev.target.closest("[data-accion]");
    if (!el) return;
    const a = el.dataset.accion, id = el.dataset.id;
    // pestaña RocaKids: delega todas las acciones rk-* al módulo pastor-rocakids.js
    if (a && a.indexOf("rk-") === 0 && window.PASTOR_RK) { if (window.PASTOR_RK.handle(a, el, ev)) return; }
    switch (a) {
      case "salir": ev.preventDefault(); sesion = false; vista = "analitica"; render(); return;
      case "ir": ev.preventDefault(); vista = el.dataset.vista; minDrill = null; proyDrill = null; temDrill = null; window.scrollTo(0, 0); render(); return;

      /* CRM */
      case "crm-sort": { ev.preventDefault(); const col = el.dataset.col; if (crmSort === col) crmDir = -crmDir; else { crmSort = col; crmDir = 1; } render(); return; }
      case "crm-filtro": ev.preventDefault(); crmFiltro = el.dataset.f; render(); return;
      case "ver-persona": ev.preventDefault(); modalPersona(id); return;
      case "ver-ibli": ev.preventDefault(); modalInstituto(id, "ibli"); return;
      case "ver-facter": ev.preventDefault(); modalInstituto(id, "facter"); return;
      case "ver-consejeria": ev.preventDefault(); modalConsejeria(id); return;

      /* grupos pequeños: el pastor entra al grupo como el líder */
      case "ver-grupo": ev.preventDefault(); modalGrupo(el.dataset.min, el.dataset.grupo); return;

      /* KPI: ¿por qué este dato? */
      case "kpi": ev.preventDefault(); kpiDetalle(el.dataset.k); return;
      case "kpi-go": {
        ev.preventDefault();
        const vd = el.dataset.vista;
        if (el.dataset.filtro) crmFiltro = el.dataset.filtro;
        if (el.dataset.min) crmMin = el.dataset.min;
        cerrarModal(); vista = vd; window.scrollTo(0, 0); render();
        return;
      }

      /* finanzas */
      case "fin-tab": ev.preventDefault(); finTab = el.dataset.t; proyDrill = null; render(); return;
      case "cons-sub": ev.preventDefault(); consSub = el.dataset.t; render(); return;
      case "ver-proyecto": ev.preventDefault(); proyDrill = id; window.scrollTo(0, 0); render(); return;
      case "proy-volver": ev.preventDefault(); proyDrill = null; window.scrollTo(0, 0); render(); return;
      case "adjuntar-factura": ev.preventDefault(); modalFactura(el.dataset.proy, el.dataset.gasto || ""); return;
      case "ver-factura": ev.preventDefault(); toast("📄 Vista previa de la factura (demo). En producción abre el archivo adjunto.", true); return;
      case "guardar-factura": {
        ev.preventDefault();
        const pr = proyectoPorId(el.dataset.proy);
        if (!pr) return;
        const gid = val("ps-fac-gasto");
        const prov = val("ps-fac-prov");
        const num = val("ps-fac-num");
        const montoRaw = val("ps-fac-monto");
        const fecha = val("ps-fac-fecha");
        const fileEl = document.getElementById("ps-fac-archivo");
        const archivo = fileEl && fileEl.files && fileEl.files[0] ? fileEl.files[0].name : "";
        if (!prov) { toast("Escribe el proveedor", false); return; }
        if (!num) { toast("Escribe el número de factura", false); return; }
        const monto = parseFloat(montoRaw);
        if (!(monto > 0)) { toast("Escribe un monto válido", false); return; }
        if (!archivo) { toast("Selecciona el archivo de la factura", false); return; }
        pr.facturas = pr.facturas || [];
        pr.facturas.push({ id: "fac_" + Date.now(), gastoId: gid, proveedor: prov, numero: num, monto: monto, fecha: fecha, archivo: archivo });
        cerrarModal(); proyDrill = pr.id; render(); toast("Factura adjuntada ✓", true);
        return;
      }
      case "presup-edit": ev.preventDefault(); modalPresupuesto(el.dataset.min); return;
      case "presup-save": {
        ev.preventDefault();
        const min = el.dataset.min;
        const asig = parseFloat(val("ps-presup-asig").replace(",", "."));
        const ejec = parseFloat(val("ps-presup-ejec").replace(",", "."));
        if (isNaN(asig) || isNaN(ejec)) { toast("Escribe montos válidos", false); return; }
        if (asig < 0 || ejec < 0) { toast("Los montos no pueden ser negativos", false); return; }
        PS.setPresupuesto(min, { asignado: asig, ejecutado: ejec });
        cerrarModal(); render(); toast(`Presupuesto de ${min} actualizado ✓`, true);
        return;
      }

      /* gastos de servicios (digitados + factura) */
      case "nuevo-gasto": ev.preventDefault(); modalGasto(); return;
      case "guardar-gasto": {
        ev.preventDefault();
        const rubro = val("ps-gas-rubro");
        if (!rubro) { toast("Escribe el rubro o concepto del gasto", false); return; }
        const monto = parseFloat(val("ps-gas-monto").replace(",", "."));
        if (isNaN(monto) || monto <= 0) { toast("Escribe un monto válido en millones COP", false); return; }
        const fi = document.getElementById("ps-gas-archivo");
        const archivo = fi && fi.files && fi.files[0] ? fi.files[0].name : "";
        PS.addGasto({
          rubro, min: val("ps-gas-min") || "General", monto,
          fecha: val("ps-gas-fecha") || new Date().toISOString().slice(0, 10),
          factura: val("ps-gas-factura"), proveedor: val("ps-gas-proveedor"), archivo,
        });
        cerrarModal(); render();
        toast(archivo ? "Gasto registrado con factura ✓" : "Gasto registrado (sin factura ⚠)", true);
        return;
      }
      case "nuevo-diezmo": ev.preventDefault(); modalDiezmo(); return;
      case "guardar-diezmo": {
        ev.preventDefault();
        const diezmos = parseFloat((val("ps-dz-diezmos") || "").replace(",", "."));
        if (isNaN(diezmos) || diezmos <= 0) { toast("Escribe el diezmo del domingo en millones COP", false); return; }
        const ofrRaw = (val("ps-dz-ofrendas") || "").replace(",", ".");
        const ofrendas = ofrRaw ? parseFloat(ofrRaw) : 0;
        const fecha = val("ps-dz-fecha") || new Date().toISOString().slice(0, 10);
        const servicio = val("ps-dz-servicio") || "General";
        PS.addDiezmoDomingo({ f: etiquetaDomingo(fecha), diezmos, ofrendas: isNaN(ofrendas) ? 0 : ofrendas, servicio, fecha });
        cerrarModal(); finTab = "ingresos"; render();
        toast("Diezmo del domingo agregado ✓", true);
        return;
      }
      case "nueva-asistencia": ev.preventDefault(); modalAsistencia(); return;
      case "guardar-asistencia": {
        ev.preventDefault();
        const total = parseInt((val("ps-as-total") || "").replace(/\D/g, ""), 10);
        if (isNaN(total) || total <= 0) { toast("Escribe la asistencia total del domingo", false); return; }
        const nuevos = parseInt((val("ps-as-nuevos") || "0").replace(/\D/g, ""), 10) || 0;
        const fecha = val("ps-as-fecha") || new Date().toISOString().slice(0, 10);
        const servicio = val("ps-as-servicio") || "General";
        PS.addAsistencia({ f: etiquetaDomingo(fecha), total, nuevos, servicio, fecha });
        cerrarModal(); vista = "asistencia"; render();
        toast("Asistencia del domingo registrada ✓", true);
        return;
      }
      case "del-asistencia": ev.preventDefault(); PS.delAsistencia(parseInt(el.dataset.idx, 10)); render(); toast("Registro de asistencia eliminado", false); return;
      case "del-gasto": ev.preventDefault(); PS.delGasto(id); render(); toast("Gasto eliminado", false); return;
      case "ver-factura": {
        ev.preventDefault();
        const g = PS.gastos().find(x => x.id === id);
        if (g) toast(`Soporte adjunto: ${g.archivo} (factura ${g.factura || "s/n"})`, true);
        return;
      }

      /* organigrama */
      case "org-add": ev.preventDefault(); modalNodo(id || "", false); return;
      case "org-edit": ev.preventDefault(); modalNodo(id, true); return;
      case "org-sistema": ev.preventDefault(); modalSistema(id); return;
      case "org-del": ev.preventDefault(); modalConfirmDel(id); return;
      case "org-toggle": ev.preventDefault(); orgColapsados[id] = !orgColapsados[id]; render(); return;
      case "org-equipo": ev.preventDefault(); orgEquipoAbierto[id] = !orgEquipoAbierto[id]; render(); return;
      case "org-zoom-in": ev.preventDefault(); orgZoom = Math.min(1.6, Math.round((orgZoom + 0.1) * 10) / 10); render(); return;
      case "org-zoom-out": ev.preventDefault(); orgZoom = Math.max(0.5, Math.round((orgZoom - 0.1) * 10) / 10); render(); return;
      case "org-zoom-reset": ev.preventDefault(); orgZoom = 1; render(); return;
      case "org-expand-all": ev.preventDefault(); orgColapsados = {}; render(); toast("Organigrama expandido", true); return;
      case "org-collapse-all": {
        ev.preventDefault();
        orgColapsados = {};
        const nn = organigramaCombinado();
        nn.forEach(n => { if (nn.some(k => k.parent === n.id)) orgColapsados[n.id] = true; });
        render(); toast("Organigrama contraído", true);
        return;
      }
      case "org-del-confirm": ev.preventDefault(); PS.delNodo(id); cerrarModal(); render(); toast("Cuadro quitado del organigrama", false); return;
      case "org-save-new": {
        ev.preventDefault();
        const nombre = val("ps-org-nombre");
        if (!nombre) { toast("Escribe un nombre", false); return; }
        const tipoEl = document.getElementById("ps-org-tipo");
        const tipo = tipoEl ? tipoEl.value : "persona";
        const esDir = tipo === "dir-min" || tipo === "dir-eq";
        const contacto = esDir ? { email: val("ps-org-email"), tel: val("ps-org-tel"), enviar: chk("ps-org-enviar") } : null;
        PS.addNodo(nombre, val("ps-org-rol"), el.dataset.parent || null, tipo, contacto);
        cerrarModal(); render();
        if (esDir) {
          const repartido = contacto && contacto.enviar && (contacto.email || contacto.tel);
          toast(repartido ? "Sistema creado y acceso repartido ✓" : "Sistema del director creado (base en 0) ✓ — reparte el acceso desde ⚙️", true);
        } else { toast("Cuadro agregado ✓", true); }
        return;
      }
      case "acceso-enviar": {
        ev.preventDefault();
        const email = document.getElementById("ps-sis-email"); const tel = document.getElementById("ps-sis-tel");
        const c = {};
        if (email) c.email = email.value.trim();
        if (tel) c.tel = tel.value.trim();
        if (!c.email && !c.tel) { toast("Agrega un correo o teléfono para repartir el acceso", false); return; }
        PS.enviarAcceso(id, c); cerrarModal(); render(); toast("Acceso repartido al director ✓", true);
        return;
      }
      case "acceso-copiar": {
        ev.preventDefault();
        const enlace = el.dataset.enlace || "";
        if (navigator.clipboard && enlace) { navigator.clipboard.writeText(enlace).then(() => toast("Enlace copiado ✓", true), () => toast("Enlace: " + enlace, true)); }
        else { toast("Enlace: " + enlace, true); }
        return;
      }
      case "org-save-edit": { ev.preventDefault(); const nombre = val("ps-org-nombre"); if (!nombre) { toast("Escribe un nombre", false); return; } const ps = document.getElementById("ps-org-parent"); PS.editNodo(id, { nombre, rol: val("ps-org-rol"), parent: ps ? (ps.value || null) : undefined }); cerrarModal(); render(); toast("Nodo actualizado ✓", true); return; }

      /* calendario */
      case "cal-prev": ev.preventDefault(); calMes = { y: calMes.m === 0 ? calMes.y - 1 : calMes.y, m: (calMes.m + 11) % 12 }; render(); return;
      case "cal-next": ev.preventDefault(); calMes = { y: calMes.m === 11 ? calMes.y + 1 : calMes.y, m: (calMes.m + 1) % 12 }; render(); return;
      case "cal-dia": ev.preventDefault(); modalDiaCalendario(el.dataset.iso); return;
      case "nuevo-evento": ev.preventDefault(); modalEvento(); return;
      case "nuevo-evento-dia": ev.preventDefault(); modalEvento(el.dataset.iso); return;
      case "ev-check": ev.preventDefault(); chequearDisp(); return;
      case "guardar-evento": { ev.preventDefault(); const t = val("ps-ev-titulo"); if (!t) { toast("Escribe un título", false); return; } if (!val("ps-ev-espacio")) { toast("Primero habilita un espacio", false); return; } if (!chequearDisp()) { toast("Ese espacio no está libre en ese horario", false); return; } PS.addEvento({ titulo: t, fecha: val("ps-ev-fecha"), horaInicio: val("ps-ev-inicio"), horaFin: val("ps-ev-fin"), espacioId: val("ps-ev-espacio"), desc: val("ps-ev-desc") }); cerrarModal(); render(); toast("Evento creado y espacio reservado ✓", true); return; }
      case "del-evento": ev.preventDefault(); PS.delEvento(id); render(); toast("Evento eliminado", false); return;

      /* espacios */
      case "nuevo-espacio": ev.preventDefault(); modalEspacio(); return;
      case "guardar-espacio": { ev.preventDefault(); const n = val("ps-esp-nombre"); if (!n) { toast("Escribe un nombre", false); return; } const cap = parseInt(val("ps-esp-cap"), 10); PS.addEspacio({ nombre: n, capacidad: isNaN(cap) || cap < 0 ? 0 : cap, ico: val("ps-esp-ico") || "📍" }); cerrarModal(); render(); toast("Espacio habilitado ✓", true); return; }
      case "del-espacio": { ev.preventDefault(); const usos = PS.eventosEnEspacio(id); if (usos > 0) { toast(`No se puede borrar: tiene ${usos} evento${usos > 1 ? "s" : ""} reservado${usos > 1 ? "s" : ""}`, false); return; } PS.delEspacio(id); render(); toast("Espacio borrado", false); return; }

      /* grupos / equipo filtros vía change abajo */

      /* temáticas */
      case "nueva-tematica": ev.preventDefault(); modalTematica(); return;
      case "guardar-tematica": { ev.preventDefault(); const t = val("ps-tem-titulo"); if (!t) { toast("Escribe un título", false); return; } PS.addTematica({ titulo: t, desc: val("ps-tem-desc"), tipo: val("ps-tem-tipo") || "Material", ministerio: val("ps-tem-min") || "General", ico: val("ps-tem-ico") || "📚" }); cerrarModal(); render(); toast("Temática creada ✓", true); return; }
      case "del-tematica": ev.preventDefault(); PS.delTematica(id); if (temDrill === id) temDrill = null; render(); toast("Temática eliminada", false); return;

      /* ---------------------------------------------------- CURSOS */
      case "curso-nuevo": ev.preventDefault(); modalCurso(""); return;
      case "curso-inscripcion": ev.preventDefault(); modalInscripcionCurso(id); return;
      case "curso-addcampo": {
        ev.preventDefault();
        const label = val("ps-cur-xlabel");
        if (!label) { toast("Escribe la etiqueta del campo", false); return; }
        const tipo = val("ps-cur-xtipo") || "texto";
        const S3 = window.STORE; const cc = S3.curso(id); if (!cc) return;
        const arr = Array.isArray(cc.camposExtra) ? cc.camposExtra.slice() : [];
        arr.push({ label, tipo });
        S3.updateCurso(id, { camposExtra: arr });
        modalCurso(id);
        toast("Campo agregado ✓", true);
        return;
      }
      case "curso-delcampo": {
        ev.preventDefault();
        const S3 = window.STORE; const cc = S3.curso(id); if (!cc) return;
        const arr = Array.isArray(cc.camposExtra) ? cc.camposExtra.slice() : [];
        const idx = parseInt(el.dataset.idx, 10);
        if (arr[idx]) arr.splice(idx, 1);
        S3.updateCurso(id, { camposExtra: arr });
        modalCurso(id);
        return;
      }
      case "copiar-link-curso": {
        ev.preventDefault();
        const li = document.getElementById("ps-insc-link");
        if (li && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(li.value).then(() => toast("Enlace copiado ✓", true), () => toast("Copia manual: " + li.value, false));
        } else if (li) { try { li.select(); document.execCommand && document.execCommand("copy"); toast("Enlace copiado ✓", true); } catch (e) { toast("Copia manual el enlace", false); } }
        return;
      }
      case "compartir-wa-curso": toast("Abriendo WhatsApp para compartir la inscripción…", true); return;
      case "guardar-inscripcion": {
        ev.preventDefault();
        const S2 = window.STORE;
        const nombre = val("ps-insc-nombre");
        const correo = val("ps-insc-correo");
        if (!nombre) { toast("Escribe el nombre", false); return; }
        if (!correo) { toast("Escribe el correo", false); return; }
        const partes = nombre.trim().split(/\s+/);
        const nombres = partes.shift() || nombre;
        const apellidos = partes.join(" ");
        const cumple = val("ps-insc-cumple");
        const genero = val("ps-insc-genero") || "F";
        const minSel = (val("ps-insc-min") || "nuevo|Nuevos").split("|");
        const esNuevo = minSel[0] === "nuevo";
        const cc = S2.curso(id);
        const extraDatos = {};
        document.querySelectorAll("#ps-modal [data-xlabel]").forEach(el => { const k = el.getAttribute("data-xlabel"); if (k && el.value) extraDatos[k] = el.value; });
        S2.crmAgregar({
          nombres, apellidos, correo, genero,
          cumpleMes: cumple ? parseInt(cumple.slice(5, 7), 10) : undefined,
          cumpleDia: cumple ? parseInt(cumple.slice(8, 10), 10) : undefined,
          esNuevo, nuevo: esNuevo, sirve: !esNuevo,
          ministerioId: esNuevo ? "crm" : minSel[0],
          ministerio: minSel[1] || (esNuevo ? "Nuevos" : "General"),
          cursoInscrito: cc ? cc.nombre : "",
          extra: Object.keys(extraDatos).length ? extraDatos : undefined,
        }, "curso:" + (cc ? cc.nombre : id));
        if (cc && S2.updateCurso) S2.updateCurso(id, { inscritos: (cc.inscritos || 0) + 1 });
        cerrarModal(); render();
        toast(`✓ ${esc(nombres)} inscrito en el curso y agregado al CRM`, true);
        return;
      }
      case "curso-edit": ev.preventDefault(); modalCurso(id); return;
      case "curso-toggle": {
        ev.preventDefault();
        const S = window.STORE; if (!S || !S.toggleCursoActivo) return;
        const vis = S.toggleCursoActivo(id); render();
        toast(vis ? "Curso publicado en el landing ✓" : "Curso oculto del landing", vis);
        return;
      }
      case "curso-del": {
        ev.preventDefault();
        const S = window.STORE; if (!S || !S.delCurso) return;
        S.delCurso(id); render(); toast("Curso eliminado", false);
        return;
      }
      case "gp-publicar": {
        ev.preventDefault();
        const S = window.STORE; if (!S || !S.toggleAutorizado) return;
        const afId = el.dataset.af;
        const vis = S.toggleAutorizado(afId); render();
        const a = L && L.afinidad ? L.afinidad(afId) : null;
        const nom = a ? a.nombre : "Grupo";
        toast(vis ? `“${nom}” publicado en Conéctate ✓` : `“${nom}” oculto del landing`, vis);
        return;
      }
      case "curso-guardar": {
        ev.preventDefault();
        const S = window.STORE; if (!S) return;
        const nombre = val("ps-cur-nombre");
        if (!nombre) { toast("Escribe el nombre del curso", false); return; }
        const cupoN = parseInt(val("ps-cur-cupo"), 10);
        const datos = {
          sede: SEDE_CIUDAD,
          nombre,
          ico: val("ps-cur-ico") || "📘",
          desc: val("ps-cur-desc"),
          etapa: val("ps-cur-etapa") || "crece",
          modalidad: val("ps-cur-modalidad") || "Presencial",
          profesor: val("ps-cur-profesor"),
          dia: val("ps-cur-dia"),
          sesiones: val("ps-cur-sesiones"),
          inicia: val("ps-cur-inicia"),
          cupo: isNaN(cupoN) || cupoN < 0 ? 0 : cupoN,
          activo: !!(document.getElementById("ps-cur-activo") && document.getElementById("ps-cur-activo").checked)
        };
        if (id) {
          const insc = parseInt(val("ps-cur-inscritos"), 10);
          if (!isNaN(insc) && insc >= 0) datos.inscritos = insc;
          S.updateCurso(id, datos); toast("Curso actualizado · visible en Crece ✓", true);
        } else {
          datos.inscritos = 0;
          S.addCurso(datos); toast("Curso creado · ya aparece en Crece ✓", true);
        }
        cerrarModal(); render();
        return;
      }
      case "ver-tematica": ev.preventDefault(); temDrill = id; temDrillLive = el.dataset.live === "1"; window.scrollTo(0, 0); render(); return;
      case "tem-volver": ev.preventDefault(); temDrill = null; temDrillLive = false; window.scrollTo(0, 0); render(); return;
      case "subir-doc": ev.preventDefault(); modalSubirDoc(id); return;
      case "guardar-doc": {
        ev.preventDefault();
        const tid = el.dataset.id;
        const fileEl = document.getElementById("ps-doc-archivo");
        const file = fileEl && fileEl.files && fileEl.files[0] ? fileEl.files[0] : null;
        if (!file) { toast("Selecciona un archivo", false); return; }
        const { store } = temPorId(tid, temDrillLive);
        if (!store) { toast("No se encontró la temática", false); return; }
        store.addDocTematica(tid, { archivo: file.name, peso: file.size, nombre: val("ps-doc-nombre") || file.name, nota: val("ps-doc-nota"), por: USER.nombre });
        cerrarModal(); render(); toast("Documento subido ✓", true); return;
      }
      case "del-doc": { ev.preventDefault(); const tid = el.dataset.tem; const { store } = temPorId(tid, temDrillLive); if (store) store.delDocTematica(tid, id); render(); toast("Documento quitado", false); return; }
      case "ver-doc": { ev.preventDefault(); const tid = el.dataset.tem; const { t } = temPorId(tid, temDrillLive); const d = t && (t.docs || []).find(x => x.id === id); toast(d ? `📄 Vista previa de “${d.nombre || d.archivo}” (demo). En producción abre el archivo.` : "Documento no encontrado", true); return; }

      /* sirve · equipos operativos */
      case "ver-equipo-op": ev.preventDefault(); modalEquipoOp(id); return;
      case "toggle-equipo": { ev.preventDefault(); const activo = PS.equipoActivo(id); PS.toggleEquipoActivo(id); render(); const m = P.MIN_DEFS.find(x => x.id === id); toast(activo ? `«${m ? m.nombre : "Equipo"}» desactivado en tu sede` : `«${m ? m.nombre : "Equipo"}» activado en tu sede ✓`, !activo); return; }

      /* oración · centro de intercesión */
      case "oracion-tab": ev.preventDefault(); oracionTab = el.dataset.t; render(); return;
      case "oracion-estado": ev.preventDefault(); oracionEstado = el.dataset.f; render(); return;
      case "toggle-interc": { ev.preventDefault(); const p = PS.peticiones().find(x => x.id === id); const on = !(p && p.intercesion); PS.setIntercesion(id, on); render(); toast(on ? "Asignada al equipo de intercesión 🕊️" : "Quitada de intercesión", on); return; }

      /* peticiones */
      case "filtro-pet": ev.preventDefault(); filtroPet = el.dataset.f; render(); return;
      case "scope-pet": ev.preventDefault(); petScope = el.dataset.s; filtroPet = "todas"; render(); return;
      case "nueva-peticion": ev.preventDefault(); modalPeticion(); return;
      case "guardar-peticion": { ev.preventDefault(); const t = val("ps-pet-texto"); if (!t) { toast("Escribe la petición", false); return; } const interna = chk("ps-pet-interna"); PS.addPeticion({ autor: val("ps-pet-autor") || USER.nombre, ministerio: val("ps-pet-min") || "General", texto: t, interna }); if (interna) petScope = "internas"; cerrarModal(); render(); toast(interna ? "Petición interna publicada 🔒" : "Petición publicada 🙏", true); return; }
      case "estado-pet": ev.preventDefault(); PS.setEstadoPeticion(id, el.dataset.e); render(); toast(el.dataset.e === "respondida" ? "¡Respondida! 🎉" : "Marcada: orando 🙏", true); return;

      /* requerimientos */
      case "req-filtro": ev.preventDefault(); reqFiltro = el.dataset.f; render(); return;
      case "ver-req": ev.preventDefault(); modalReq(id); return;
      case "nuevo-req": ev.preventDefault(); modalNuevoReq(); return;
      case "guardar-req": { ev.preventDefault(); const asunto = val("ps-req-asunto"); if (!asunto) { toast("Escribe un asunto", false); return; } PS.addRequerimiento({ equipo: val("ps-req-eq"), asunto, descripcion: val("ps-req-desc"), prioridad: val("ps-req-prio") || "Media" }); cerrarModal(); render(); toast("Requerimiento enviado a la administración ✓", true); return; }
      case "req-add-resp": { ev.preventDefault(); const t = val("ps-req-resp"); if (!t) { toast("Escribe una nota", false); return; } PS.addRespuestaRequerimiento(id, t); modalReq(id); toast("Nota agregada ✓", true); return; }
      case "req-estado": ev.preventDefault(); PS.setEstadoRequerimiento(id, el.dataset.e); modalReq(id); toast("Estado: " + el.dataset.e, true); return;

      /* directorio */
      case "dir-filtro": ev.preventDefault(); dirFiltro = el.dataset.f; render(); return;

      case "cerrar-modal": ev.preventDefault(); cerrarModal(); return;
    }
  }

  /* selects (change) */
  document.addEventListener("change", e => {
    const t = e.target;
    if (t.closest('[data-accion="crm-min"]')) { crmMin = t.value; render(); return; }
    if (t.closest('[data-accion="cal-min"]')) { calMinFiltro = t.value; render(); return; }
    if (t.closest('[data-accion="grupos-min"]')) { gruposMinFiltro = t.value; render(); return; }
    if (t.closest('[data-accion="equipo-min"]')) { equipoMinFiltro = t.value; render(); return; }
    if (t.closest('[data-accion="sirve-sede"]')) { sirveSede = parseInt(t.value, 10) || 0; render(); return; }
    if (t.closest('[data-accion="oracion-min"]')) { oracionMin = t.value; render(); return; }
    if (t.closest('[data-accion="org-tipo-change"]')) {
      // muestra/oculta el bloque de "reparto del sistema" según el tipo de cuadro
      const box = document.getElementById("ps-org-acceso-box");
      const rol = document.getElementById("ps-org-rol");
      const esDir = t.value === "dir-min" || t.value === "dir-eq";
      if (box) box.hidden = !esDir;
      if (rol && esDir && !rol.value) rol.placeholder = t.value === "dir-eq" ? "Ej. Director · Alabanza" : "Ej. Director · Mujer Integral";
      return;
    }
  });

  /* sincronización en vivo: STORE (landing/líder), DSTORE (director) y PSTORE */
  if (S && S.onCambio) S.onCambio(() => { if (sesion) render(); });
  if (DS && DS.onCambio) DS.onCambio(() => { if (sesion) render(); });
  if (PS && PS.onCambio) PS.onCambio(() => { if (sesion && document.getElementById("ps-modal") && !document.getElementById("ps-modal").innerHTML) render(); });

  /* RocaKids: el módulo re-renderiza vía pastor; sync en vivo con la app del domingo y el director */
  if (window.PASTOR_RK) {
    window.PASTOR_RK.setRerender(render);
    if (window.RKSTORE && window.RKSTORE.onCambio) window.RKSTORE.onCambio(() => {
      const m = document.getElementById("ps-modal");
      if (sesion && (!m || !m.innerHTML)) render();
    });
  }

  /* init */
  document.addEventListener("DOMContentLoaded", render);
  if (document.readyState !== "loading") render();
})();
