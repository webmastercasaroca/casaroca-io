/* ============================================================
   CASA ROCA · MÓDULO ROCAKIDS DENTRO DEL PASTOR — Capa 3
   Expone window.PASTOR_RK: una pestaña "RocaKids" para el pastor
   congregacional que reúne TODO lo que ve el Director de RocaKids
   (analítica, CRM, salones, equipo, nuevos, peticiones) a nivel de
   análisis y CRM, con énfasis especial en la RECURRENCIA dominical
   (domingo a domingo). Lee window.RKDIR (seed) y window.RKSTORE
   (estado compartido EN VIVO con la app del domingo y el director).

   El pastor (pastor.js) provee el shell, el contenedor #ps-app, el
   modal #ps-modal y los toasts #ps-toasts. Este módulo devuelve el
   contenido interno de la vista, atiende sus propias acciones (todas
   con prefijo rk-) y pide un re-render al pastor cuando algo cambia.
   Sin frameworks. Vistas = funciones que devuelven HTML.
   ============================================================ */
(function () {
  "use strict";
  const RK = window.RKDIR;
  const S = window.RKSTORE;
  if (!RK || !S) { window.PASTOR_RK = null; return; }

  const ETAPAS = RK.ETAPAS;
  const EQUIPOS_OP = RK.EQUIPOS_OP;
  const SERVICIOS = RK.SERVICIOS;
  const PUSER = (window.PASTOR && window.PASTOR.PASTOR_USER) || { nombre: "el pastor" };
  const PNAME = (PUSER.nombre || "el pastor").split(" ")[0];

  /* ----- estado interno de la pestaña ----- */
  let sub = "analitica";          // subvista activa
  let salonAbierto = null;
  let crmSort = "nombre", crmDir = 1, crmQuery = "", crmFiltro = "todas";
  let filtroPet = "todas";
  let recEtapa = "todas", recEstado = "todas";
  let _rerender = function () {};

  /* ------------------------------------------------------------ utils */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const CURSO_NOMBRES = { adn: "ADN", bautizo: "Bautizo", madurez: "Madurez Espiritual", llaves: "Llaves del Poder", ibli: "IBLI", facter: "FACTER" };

  const hoy = () => RK.hoyISO();
  function ninoNombre(n) { return `${n.nombres || ""} ${n.apellidos || ""}`.trim(); }
  function iniciales(p) { return (((p.nombres || "")[0] || "") + ((p.apellidos || "")[0] || "")).toUpperCase(); }
  function soloDigitos(t) { return String(t || "").replace(/\D/g, ""); }
  function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }
  function fechaCorta(iso) { if (!iso) return "—"; const d = new Date(iso + "T00:00"); if (isNaN(d)) return esc(iso); return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`; }
  function diaMes(iso) { const d = new Date(iso + "T00:00"); return `${d.getDate()} ${MESES[d.getMonth()]}`; }

  /* hash determinista (FNV-1a) para sintetizar recurrencia histórica demo */
  function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rand01(s) { return (hashStr(s) % 100000) / 100000; }

  /* ----- enlaces correo / WhatsApp (de parte del pastor) ----- */
  function waAcudiente(n) {
    const cel = soloDigitos(n.acudiente ? n.acudiente.celular : n.celular);
    const nom = (n.acudiente ? n.acudiente.nombre : "").split(" ")[0] || "";
    return `https://wa.me/${cel}?text=${encodeURIComponent("Hola " + nom + ", soy el pastor " + PNAME + " 🙌 Gracias por confiarnos a " + (n.nombres || "tu pequeño/a") + " en RocaKids. ¿Cómo están?")}`;
  }
  function waServidor(p) {
    const nom = (p.nombres || "").split(" ")[0];
    return `https://wa.me/${soloDigitos(p.telefono)}?text=${encodeURIComponent("Hola " + nom + ", soy el pastor " + PNAME + ". ¡Gracias por servir en RocaKids! ¿Cómo vas?")}`;
  }
  function mailServidor(p) {
    const nom = (p.nombres || "").split(" ")[0];
    return `mailto:${p.correo}?subject=${encodeURIComponent("Hola desde RocaKids · Casa Roca")}&body=${encodeURIComponent("Hola " + nom + ",\n\nSoy el pastor " + PNAME + ". Gracias por tu servicio con los niños.\n\nUn abrazo.")}`;
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
  function presenteHoyNombre(nombre) { return regsHoy().some(r => (r.nombre_nino || "").toLowerCase() === nombre.toLowerCase()); }

  const _ESPACIOS_CAP = { esp_sl: 20, esp_14: 40, esp_56: 45, esp_78: 45, esp_911: 50, esp_aud: 200 };

  /* ============================================================
     MOTOR DE RECURRENCIA (domingo a domingo)
     Reconstruye una matriz de asistencia por niño y por domingo:
     - columnas = los domingos de RK.HISTORIAL + "Hoy" (en vivo).
     - "Hoy" usa los check-in reales de la app del domingo.
     - los domingos pasados se sintetizan de forma determinista por
       niño (cada niño tiene una "fidelidad" estable), respetando su
       fecha de ingreso. En Fase 1 esto se reemplaza por la consulta
       real a registros_ingreso por domingo (ver schema.sql).
     ============================================================ */
  function domingos() {
    const cols = RK.HISTORIAL.map(h => ({ iso: h.fecha, lbl: diaMes(h.fecha), total: h.total }));
    cols.push({ iso: hoy(), lbl: "Hoy", total: regsHoy().length, esHoy: true });
    return cols;
  }
  function fidelidad(n) { return 0.40 + 0.57 * rand01(n.id + "·fid"); }
  function asistioEn(n, col) {
    if (n.fechaIngreso && n.fechaIngreso > col.iso) return false; // aún no llegaba a la iglesia
    if (col.esHoy) return presenteHoyNombre(ninoNombre(n));
    return rand01(n.id + "|" + col.iso) < fidelidad(n);
  }
  function matrizRecurrencia() {
    const cols = domingos();
    const filas = censo().map(n => {
      const asis = cols.map(c => asistioEn(n, c));
      const presentes = asis.filter(Boolean).length;
      const porc = pct(presentes, cols.length);
      // racha actual (desde el último domingo hacia atrás)
      let racha = 0; for (let i = asis.length - 1; i >= 0; i--) { if (asis[i]) racha++; else break; }
      const ult3 = asis.slice(-3);
      const enRiesgo = ult3.every(x => !x) || porc < 30;
      const estado = enRiesgo ? "riesgo" : (porc >= 75 ? "recurrente" : "intermitente");
      return { n, asis, presentes, porc, racha, estado };
    });
    return { cols, filas };
  }
  function retencionSemanal(mat) {
    // de los presentes el domingo i, % que vuelve el domingo i+1 (promedio)
    const cols = mat.cols; const tasas = [];
    for (let i = 0; i < cols.length - 1; i++) {
      const base = mat.filas.filter(f => f.asis[i]);
      if (!base.length) { tasas.push({ lbl: cols[i].lbl + "→" + cols[i + 1].lbl, v: 0 }); continue; }
      const vol = base.filter(f => f.asis[i + 1]).length;
      tasas.push({ lbl: cols[i].lbl + "→", v: pct(vol, base.length) });
    }
    return tasas;
  }

  /* ============================================================ helpers UI (gráficas) — mismas que el director */
  const PALETA = ["var(--rk-morado)", "var(--mostaza-500)", "var(--exito)", "var(--azul-500)", "var(--peligro)", "var(--azul-400)", "var(--mostaza-300)"];
  function _card(title, sub2, body) { return `<div class="dr-card"><h3 class="dr-card__t">${esc(title)}</h3>${sub2 ? `<p class="dr-card__sub">${sub2}</p>` : ""}${body}</div>`; }
  function _legend(items, total) { return `<ul class="dr-legend">${items.map(s => `<li><i style="background:${s.color}"></i><span>${esc(s.lbl)}</span><b>${s.v}</b>${total ? `<em>${pct(s.v, total)}%</em>` : ""}</li>`).join("")}</ul>`; }
  function donut(title, sub2, segs) {
    const total = segs.reduce((s, x) => s + x.v, 0) || 1, r = 52, C = 2 * Math.PI * r; let off = 0;
    const arcs = segs.map(s => { const len = (s.v / total) * C; const el = `<circle class="dr-donut__seg" cx="60" cy="60" r="${r}" stroke="${s.color}" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"/>`; off += len; return el; }).join("");
    return _card(title, sub2, `<div class="dr-donut"><div class="dr-donut__chart"><svg viewBox="0 0 120 120" role="img" aria-label="${esc(title)}"><g transform="rotate(-90 60 60)">${arcs}</g></svg><div class="dr-donut__center"><b>${total}</b><span>total</span></div></div>${_legend(segs, total)}</div>`);
  }
  function columns(title, sub2, rows, colorFn) {
    const max = Math.max(1, ...rows.map(r => r.v));
    return _card(title, sub2, `<div class="dr-cols">${rows.map(r => `<div class="dr-col"><span class="dr-col__v">${r.v}</span><div class="dr-col__track"><div class="dr-col__bar" style="height:${Math.max(2, pct(r.v, max))}%;background:${colorFn ? colorFn(r) : "var(--azul-500)"}"></div></div><span class="dr-col__l">${esc(r.lbl)}</span></div>`).join("")}</div>`);
  }
  function lineArea(title, sub2, pts, color) {
    const W = 320, H = 130, pX = 18, pT = 20, pB = 26, n = pts.length;
    const max = Math.max(1, ...pts.map(p => p.v));
    const X = i => pX + (i * (W - 2 * pX) / Math.max(1, n - 1));
    const Y = v => (H - pB) - (v / max) * (H - pT - pB);
    const line = pts.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ");
    const area = `M${X(0).toFixed(1)},${H - pB} ` + pts.map((p, i) => `L${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ") + ` L${X(n - 1).toFixed(1)},${H - pB} Z`;
    const dots = pts.map((p, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="3.2"/>`).join("");
    const vl = pts.map((p, i) => `<text class="dr-line__v" x="${X(i).toFixed(1)}" y="${(Y(p.v) - 7).toFixed(1)}">${p.v}</text>`).join("");
    const xl = pts.map((p, i) => `<text class="dr-line__x" x="${X(i).toFixed(1)}" y="${H - 8}">${esc(p.lbl)}</text>`).join("");
    return _card(title, sub2, `<svg class="dr-line" style="--lc:${color}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}"><path class="dr-line__area" d="${area}"/><path class="dr-line__path" d="${line}"/><g class="dr-line__dots">${dots}</g>${vl}${xl}</svg>`);
  }
  function gauges(title, sub2, items) {
    const r = 25, C = 2 * Math.PI * r;
    const cells = items.map(it => { const v = Math.min(100, it.v), len = (v / 100) * C; return `<div class="dr-gauge"><svg viewBox="0 0 64 64"><circle class="dr-gauge__bg" cx="32" cy="32" r="${r}"/><circle class="dr-gauge__fg" cx="32" cy="32" r="${r}" stroke="${it.color}" stroke-dasharray="${len.toFixed(1)} ${(C - len).toFixed(1)}" transform="rotate(-90 32 32)"/><text class="dr-gauge__v" x="32" y="36">${it.v}%</text></svg><div class="dr-gauge__l">${esc(it.lbl)}</div></div>`; }).join("");
    return _card(title, sub2, `<div class="dr-gauges">${cells}</div>`);
  }
  function lollipop(title, sub2, rows, colorFn) {
    const max = Math.max(1, ...rows.map(r => r.v));
    return _card(title, sub2, `<div class="dr-lollis">${rows.map(r => { const w = pct(r.v, max), c = colorFn ? colorFn(r) : "var(--rk-morado)"; return `<div class="dr-lolli"><div class="dr-lolli__lbl">${esc(r.lbl)}</div><div class="dr-lolli__track"><span class="dr-lolli__line" style="width:${w}%;background:${c}"></span><span class="dr-lolli__dot" style="left:${w}%;background:${c}"></span></div><div class="dr-lolli__v">${r.v}</div></div>`; }).join("")}</div>`);
  }
  function kpi(n, lbl, alerta) { return `<div class="dr-kpi ${alerta ? "is-alerta" : ""}"><div class="dr-kpi__n">${n}</div><div class="dr-kpi__l">${esc(lbl)}</div></div>`; }
  function etChip(etId) { const e = RK.etapa(etId); return `<span class="dr-chip" style="color:${e.color};background:color-mix(in srgb, ${e.color} 14%, white)">${e.emoji} ${esc(e.corto)}</span>`; }
  function estChip(estado) {
    const m = { recurrente: ["🟢 Recurrente", "var(--exito)", "var(--exito-bg)"], intermitente: ["🟡 Intermitente", "var(--mostaza-600, #b8860b)", "var(--mostaza-100)"], riesgo: ["🔴 En riesgo", "var(--peligro)", "var(--peligro-bg)"] };
    const x = m[estado] || m.intermitente;
    return `<span class="dr-chip" style="color:${x[1]};background:${x[2]}">${x[0]}</span>`;
  }

  /* ============================================================ SUB-NAV */
  const SUBNAV = [
    { id: "analitica", ico: "📊", lbl: "Analítica" },
    { id: "recurrencia", ico: "🔁", lbl: "Recurrencia" },
    { id: "crm", ico: "🧒", lbl: "CRM niños" },
    { id: "salones", ico: "🏫", lbl: "Salones" },
    { id: "equipo", ico: "🤝", lbl: "Equipo" },
    { id: "nuevos", ico: "🌱", lbl: "Nuevos" },
    { id: "peticiones", ico: "🙏", lbl: "Peticiones" },
  ];
  function subnav() {
    return `<div class="dr-filtros ps-rk-subnav" role="tablist" aria-label="Secciones de RocaKids">
      ${SUBNAV.map(s => `<button class="dr-pill ${sub === s.id ? "is-on" : ""}" data-accion="rk-sub" data-sub="${s.id}" ${sub === s.id ? 'aria-selected="true"' : ""}>${s.ico} ${s.lbl}</button>`).join("")}
    </div>`;
  }
  function cabecera() {
    const dir = RK.DIRECTOR_USER;
    return `<div class="dr-head">
      <div><h1 class="dr-h1">🧒 RocaKids · ${esc(USERsede())}</h1>
      <p class="dr-lead">Todo el ministerio de niños con la misma profundidad que su director: asistencia dominical en vivo, recurrencia domingo a domingo, CRM completo, salones y equipo. Sincronizado en vivo con la app del domingo y con la dirección de <b>${esc(dir.nombre)}</b>.</p></div>
      <span class="dr-tag rk-live">● En vivo · ${esc(new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" }))}</span>
    </div>`;
  }
  function USERsede() { return (PUSER.sede) || "Bogotá Chicó"; }

  /* ============================================================ 1. ANALÍTICA */
  function vAnalitica() {
    const regs = regsHoy();
    const cen = censo();
    const presentes = presentesHoy().length;
    const entregados = regs.filter(r => r.estado === "entregado").length;
    const totalHoy = regs.length;
    const servidores = S.equipo().length;
    const peticionesHoy = regs.filter(r => r.peticion_oracion).length;
    const nuevosN = S.nuevos().length;

    const filasSrv = SERVICIOS.map(s => ({ lbl: s.nombre.replace(" Servicio", ""), v: regs.filter(r => r.servicio === s.id).length }));
    const filasEt = ETAPAS.map(e => ({ lbl: e.corto, v: regs.filter(r => r.etapa === e.id).length, color: e.color }));
    const filasCenso = ETAPAS.map(e => ({ lbl: e.corto, v: cen.filter(n => n.etapa === e.id).length, color: e.color }));
    const fNinas = cen.filter(n => n.genero === "F").length, fNinos = cen.filter(n => n.genero === "M").length;
    const hist = RK.HISTORIAL.map(h => ({ lbl: MESES[new Date(h.fecha + "T00:00").getMonth()] + " " + new Date(h.fecha + "T00:00").getDate(), v: h.total })).concat([{ lbl: "Hoy", v: totalHoy }]);
    const filasOcup = ETAPAS.map(e => {
      const esp = { "sin-limites": "esp_sl", "1-4": "esp_14", "5-6": "esp_56", "7-8": "esp_78", "9-11": "esp_911" }[e.id];
      const cap = _ESPACIOS_CAP[esp] || 40;
      const pres = regs.filter(r => r.etapa === e.id && r.estado === "presente").length;
      return { lbl: e.corto, v: pct(pres, cap), color: e.color };
    });
    const tasaEntrega = pct(entregados, totalHoy);
    const filasServ = ETAPAS.map(e => ({ lbl: e.corto, v: servidoresDe(e.id).length, color: e.color }))
      .concat(EQUIPOS_OP.map((o, i) => ({ lbl: o.nombre, v: servidoresDe(o.id).length, color: PALETA[i % PALETA.length] })));
    const edadProm = (() => { const ce = cen.filter(n => typeof n.edad === "number"); return ce.length ? Math.round(ce.reduce((s, n) => s + n.edad, 0) / ce.length) : "—"; })();

    return `
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
        <span class="dr-ia__badge">✦ Lectura IA para el pastor</span>
        <p>Hoy han ingresado <b>${totalHoy}</b> niños y hay <b>${presentes}</b> en sala. La etapa con más asistencia es <b>${esc((filasEt.slice().sort((a, b) => b.v - a.v)[0] || {}).lbl || "—")}</b>. ${nuevosN > 0 ? `Hay <b>${nuevosN}</b> niños nuevos por vincular.` : "No hay niños nuevos pendientes."} ${peticionesHoy > 0 ? `Se recogieron <b>${peticionesHoy}</b> peticiones para acompañar a las familias.` : ""} Revisa la pestaña <b>Recurrencia</b> para ver quiénes faltan domingo a domingo.</p>
      </div>`;
  }

  /* ============================================================ 2. RECURRENCIA */
  function vRecurrencia() {
    const mat = matrizRecurrencia();
    const cols = mat.cols, total = mat.filas.length;
    const recurrentes = mat.filas.filter(f => f.estado === "recurrente").length;
    const intermit = mat.filas.filter(f => f.estado === "intermitente").length;
    const riesgo = mat.filas.filter(f => f.estado === "riesgo").length;
    const nuevos60 = censo().filter(n => n.fechaIngreso && diasISO(n.fechaIngreso) <= 70).length;
    const retencion = retencionSemanal(mat);
    const retProm = retencion.length ? Math.round(retencion.reduce((s, x) => s + x.v, 0) / retencion.length) : 0;
    const asisMedia = Math.round(mat.filas.reduce((s, f) => s + f.presentes, 0) / Math.max(1, cols.length));
    const porcProm = Math.round(mat.filas.reduce((s, f) => s + f.porc, 0) / Math.max(1, total));

    // asistencia total por domingo (global) — usa los totales reales del historial + hoy
    const lineTotal = cols.map(c => ({ lbl: c.lbl, v: c.total }));
    // asistencia de niños conocidos (del censo) domingo a domingo
    const lineConocidos = cols.map((c, i) => ({ lbl: c.lbl, v: mat.filas.filter(f => f.asis[i]).length }));
    // distribución de recurrencia: cuántos niños asistieron k de N domingos
    const dist = []; for (let k = cols.length; k >= 0; k--) { const v = mat.filas.filter(f => f.presentes === k).length; if (v > 0 || k === cols.length || k === 0) dist.push({ lbl: k + "/" + cols.length, v, k }); }
    // recurrencia promedio por etapa
    const porEtapa = ETAPAS.map(e => {
      const fs = mat.filas.filter(f => f.n.etapa === e.id);
      const v = fs.length ? Math.round(fs.reduce((s, f) => s + f.porc, 0) / fs.length) : 0;
      return { lbl: e.corto, v, color: e.color };
    });

    // tabla / heatmap filtrable
    let filas = mat.filas.slice();
    if (recEtapa !== "todas") filas = filas.filter(f => f.n.etapa === recEtapa);
    if (recEstado !== "todas") filas = filas.filter(f => f.estado === recEstado);
    filas.sort((a, b) => (a.porc - b.porc) || (a.racha - b.racha)); // los más flojos primero (para actuar)

    const heatHead = `<th class="ps-rk-stick">Niño/a</th><th>Etapa</th>${cols.map(c => `<th title="${esc(fechaCorta(c.iso))}">${esc(c.lbl)}</th>`).join("")}<th>Recurrencia</th><th>Racha</th><th>Estado</th>`;
    const heatRows = filas.map(f => {
      const dots = f.asis.map((a, i) => a
        ? `<td class="ps-rk-h is-yes" title="${esc(cols[i].lbl)}: presente">●</td>`
        : `<td class="ps-rk-h is-no" title="${esc(cols[i].lbl)}: ausente">○</td>`).join("");
      return `<tr class="dr-trclick" data-accion="rk-ver-nino" data-id="${f.n.id}">
        <td class="ps-rk-stick"><div class="dr-cell-name"><span class="dr-mini-avatar">${esc(iniciales(f.n))}</span><b>${esc(ninoNombre(f.n))}</b></div></td>
        <td>${etChip(f.n.etapa)}</td>
        ${dots}
        <td><b>${f.porc}%</b></td>
        <td>${f.racha > 0 ? "🔥 " + f.racha : "—"}</td>
        <td>${estChip(f.estado)}</td>
      </tr>`;
    }).join("");

    // lista de seguimiento prioritario (en riesgo)
    const enRiesgoLista = mat.filas.filter(f => f.estado === "riesgo").sort((a, b) => a.porc - b.porc).slice(0, 8);

    return `
      <div class="dr-card rk-domingo" style="margin-bottom:14px">
        <h3 class="dr-card__t">🔁 Recurrencia dominical — la pregunta clave</h3>
        <p class="dr-card__sub">¿Quiénes vuelven domingo a domingo y quiénes se están enfriando? Análisis sobre los <b>${total}</b> niños del censo a lo largo de <b>${cols.length}</b> domingos (los ${cols.length - 1} anteriores + hoy en vivo).</p>
      </div>
      <div class="dr-kpis">
        ${kpi(recurrentes, "Recurrentes (≥75%)")}
        ${kpi(intermit, "Intermitentes")}
        ${kpi(riesgo, "En riesgo", riesgo > 0)}
        ${kpi(retProm + "%", "Retención sem. media")}
        ${kpi(porcProm + "%", "Recurrencia media")}
        ${kpi(asisMedia, "Asistencia media/dom.")}
        ${kpi(nuevos60, "Nuevos (≤10 sem.)")}
        ${kpi(cols.length, "Domingos analizados")}
      </div>
      <div class="dr-charts">
        ${lineArea("Asistencia total por domingo", "Conteo global de la red de niños", lineTotal, "var(--rk-morado)")}
        ${lineArea("Niños conocidos presentes", "Del censo, cuántos asistieron cada domingo", lineConocidos, "var(--azul-500)")}
        ${columns("Distribución de recurrencia", "Cuántos niños asistieron a k de " + cols.length + " domingos", dist, r => r.k >= Math.ceil(cols.length * 0.75) ? "var(--exito)" : r.k <= Math.floor(cols.length * 0.3) ? "var(--peligro)" : "var(--mostaza-500)")}
        ${lollipop("Recurrencia media por etapa", "% de asistencia promedio", porEtapa, r => r.color)}
        ${lollipop("Retención semana a semana", "% que vuelve el domingo siguiente", retencion, () => "var(--rk-morado)")}
        ${donut("Salud de la asistencia", "Censo por nivel de recurrencia", [{ lbl: "Recurrentes", v: recurrentes, color: "var(--exito)" }, { lbl: "Intermitentes", v: intermit, color: "var(--mostaza-500)" }, { lbl: "En riesgo", v: riesgo, color: "var(--peligro)" }])}
      </div>

      <div class="dr-card" style="margin-top:6px">
        <h3 class="dr-card__t">🗓️ Matriz domingo a domingo</h3>
        <p class="dr-card__sub">Cada niño y su asistencia en cada domingo (● presente · ○ ausente). Toca una fila para ver el perfil 360°.</p>
        <div class="dr-toolbar">
          <div class="dr-filtros">
            <span class="dr-muted" style="align-self:center">Etapa:</span>
            <button class="dr-pill ${recEtapa === "todas" ? "is-on" : ""}" data-accion="rk-rec-etapa" data-f="todas">Todas</button>
            ${ETAPAS.map(e => `<button class="dr-pill ${recEtapa === e.id ? "is-on" : ""}" data-accion="rk-rec-etapa" data-f="${e.id}">${e.emoji} ${esc(e.corto)}</button>`).join("")}
          </div>
          <div class="dr-filtros">
            <span class="dr-muted" style="align-self:center">Estado:</span>
            ${[["todas", "Todos"], ["recurrente", "🟢 Recurrentes"], ["intermitente", "🟡 Intermitentes"], ["riesgo", "🔴 En riesgo"]].map(([f, l]) => `<button class="dr-pill ${recEstado === f ? "is-on" : ""}" data-accion="rk-rec-estado" data-f="${f}">${l}</button>`).join("")}
          </div>
        </div>
        <p class="dr-muted">Mostrando <b>${filas.length}</b> de ${total} niños · ordenados por menor recurrencia primero.</p>
        <div class="dr-tablewrap ps-rk-heatwrap"><table class="dr-table dr-table--hover ps-rk-heat">
          <thead><tr>${heatHead}</tr></thead>
          <tbody>${heatRows || `<tr><td colspan="${cols.length + 5}"><div class="dr-empty">Sin niños con este filtro.</div></td></tr>`}</tbody>
        </table></div>
      </div>

      <div class="dr-card">
        <h3 class="dr-card__t">🚨 Seguimiento prioritario — niños que se están enfriando</h3>
        <p class="dr-card__sub">Los que llevan más domingos sin venir. Una llamada del pastor a la familia marca la diferencia.</p>
        ${enRiesgoLista.length ? `<div class="dr-mini-list">${enRiesgoLista.map(f => `<div class="dr-mini-row">
          <span class="dr-mini-avatar" style="background:${RK.etapa(f.n.etapa).color}">${esc(iniciales(f.n))}</span>
          <div class="dr-mini-row__main"><b>${esc(ninoNombre(f.n))}</b><small>${etChipText(f.n.etapa)} · recurrencia ${f.porc}% · ${f.racha === 0 ? "no viene hace " + ausenciaReciente(f) + " dom." : "racha " + f.racha}</small></div>
          <a class="dr-btn dr-btn--ghost dr-btn--sm" href="${waAcudiente(f.n)}" target="_blank" rel="noopener" data-stop>💬 Llamar familia</a>
        </div>`).join("")}</div>` : `<div class="dr-empty">🎉 Ningún niño en riesgo. ¡La recurrencia está sana!</div>`}
      </div>`;
  }
  function etChipText(etId) { const e = RK.etapa(etId); return e.emoji + " " + e.corto; }
  function ausenciaReciente(f) { let c = 0; for (let i = f.asis.length - 1; i >= 0; i--) { if (!f.asis[i]) c++; else break; } return c; }
  function diasISO(iso) { const d = new Date(iso + "T00:00"); const h = new Date(); h.setHours(0, 0, 0, 0); return Math.round((h - d) / 86400000); }

  /* ============================================================ 3. CRM */
  const CRM_COLS = [
    { id: "nombre", lbl: "Niño/a" }, { id: "etapa", lbl: "Etapa" }, { id: "edad", lbl: "Edad" },
    { id: "genero", lbl: "Género" }, { id: "acudiente", lbl: "Acudiente" }, { id: "celular", lbl: "Celular" },
    { id: "recurrencia", lbl: "Recurrencia" }, { id: "hoy", lbl: "Hoy" },
  ];
  function crmValor(n, col, recMap) {
    switch (col) {
      case "nombre": return ninoNombre(n).toLowerCase();
      case "etapa": return n.etapa || "";
      case "edad": return n.edad || 0;
      case "genero": return n.genero || "";
      case "acudiente": return (n.acudiente ? n.acudiente.nombre : "").toLowerCase();
      case "recurrencia": return recMap[n.id] ? recMap[n.id].porc : 0;
      default: return "";
    }
  }
  function vCRM() {
    const mat = matrizRecurrencia();
    const recMap = {}; mat.filas.forEach(f => recMap[f.n.id] = f);
    let lista = censo();
    if (crmFiltro !== "todas") lista = lista.filter(n => n.etapa === crmFiltro);
    lista.sort((a, b) => { const va = crmValor(a, crmSort, recMap), vb = crmValor(b, crmSort, recMap); return (va < vb ? -1 : va > vb ? 1 : 0) * crmDir; });
    const cen = censo();
    const filas = lista.map(n => {
      const ac = n.acudiente || {};
      const here = presenteHoyNombre(ninoNombre(n));
      const rec = recMap[n.id];
      const search = `${ninoNombre(n)} ${ac.nombre || ""} ${ac.celular || ""} ${RK.etapa(n.etapa).corto}`.toLowerCase();
      return `<tr data-search="${esc(search)}" data-accion="rk-ver-nino" data-id="${n.id}" class="dr-trclick">
        <td><div class="dr-cell-name"><span class="dr-mini-avatar">${esc(iniciales(n))}</span><b>${esc(ninoNombre(n))}</b></div></td>
        <td>${etChip(n.etapa)}</td>
        <td>${n.edad || "—"}</td>
        <td>${n.genero === "F" ? "Niña" : "Niño"}</td>
        <td>${esc(ac.nombre || "—")}<small class="dr-muted"> · ${esc(ac.parentesco || "")}</small></td>
        <td>${esc(ac.celular || "—")}</td>
        <td>${rec ? `<b>${rec.porc}%</b> ${estChip(rec.estado)}` : "—"}</td>
        <td>${here ? '<span class="dr-chip" style="color:var(--exito);background:var(--exito-bg)">🟢 Sí</span>' : '<span class="dr-muted">—</span>'}</td>
      </tr>`;
    }).join("");

    return `
      <div class="dr-toolbar">
        <input class="dr-input" id="ps-rk-crm-search" placeholder="🔍 Buscar niño, acudiente, teléfono…" />
        <div class="dr-filtros">
          <button class="dr-pill ${crmFiltro === "todas" ? "is-on" : ""}" data-accion="rk-crm-filtro" data-f="todas">Todas</button>
          ${ETAPAS.map(e => `<button class="dr-pill ${crmFiltro === e.id ? "is-on" : ""}" data-accion="rk-crm-filtro" data-f="${e.id}">${e.emoji} ${esc(e.corto)}</button>`).join("")}
        </div>
      </div>
      <p class="dr-muted">Mostrando <b id="ps-rk-crm-count">${lista.length}</b> de ${cen.length} niños.</p>
      <div class="dr-tablewrap"><table class="dr-table dr-table--hover">
        <thead><tr>${CRM_COLS.map(c => `<th data-accion="rk-crm-sort" data-col="${c.id}" class="dr-th-sort ${crmSort === c.id ? "is-sorted" : ""}">${c.lbl}${crmSort === c.id ? (crmDir > 0 ? " ▲" : " ▼") : ""}</th>`).join("")}</tr></thead>
        <tbody id="ps-rk-crm-body">${filas}</tbody>
      </table></div>`;
  }
  function modalNino(id) {
    const n = censo().find(x => x.id === id); if (!n) return;
    const ac = n.acudiente || {}, e = RK.etapa(n.etapa);
    const visitas = S.registros().filter(r => (r.nombre_nino || "").toLowerCase() === ninoNombre(n).toLowerCase());
    const mat = matrizRecurrencia(); const f = mat.filas.find(x => x.n.id === n.id);
    const cols = mat.cols;
    const tira = f ? cols.map((c, i) => `<span class="ps-rk-dot ${f.asis[i] ? "is-yes" : "is-no"}" title="${esc(c.lbl)}">${f.asis[i] ? "●" : "○"}</span>`).join("") : "";
    abrirModal(`
      <div class="dr-modal__head"><div class="dr-avatar dr-avatar--lg" style="background:${e.color}">${esc(iniciales(n))}</div>
        <div><h3 id="dr-modal-t">${esc(ninoNombre(n))}</h3><p class="dr-card__sub">${e.emoji} ${esc(e.nombre)} · ${n.edad || "—"} años</p></div></div>
      ${f ? `<div class="dr-why"><span>Recurrencia dominical</span><p>${tira}<br><b>${f.porc}%</b> de asistencia · ${estChip(f.estado)} ${f.racha > 0 ? "· racha 🔥 " + f.racha : ""}</p></div>` : ""}
      <div class="dr-why"><span>Acudiente</span><p><b>${esc(ac.nombre || "—")}</b> (${esc(ac.parentesco || "—")}) · 📱 ${esc(ac.celular || "—")} · 🪪 ${esc(ac.cedula || "—")}</p></div>
      <div class="dr-why"><span>Vinculación</span><p>Ingresó el ${fechaCorta(n.fechaIngreso)} · ${esc(n.fuente || "—")}</p></div>
      ${n.nota ? `<div class="dr-why"><span>⚠️ Nota importante</span><p>${esc(n.nota)}</p></div>` : ""}
      <div class="dr-why"><span>Historial de check-in</span><p>${visitas.length ? visitas.slice(0, 6).map(v => `${fechaCorta(v.fecha)} · ${RK.servicio(v.servicio).nombre} (${v.estado})`).join("<br>") : "Sin registros aún."}</p></div>
      <div class="dr-modal__acts">
        <a class="dr-btn dr-btn--primary" href="${waAcudiente(n)}" target="_blank" rel="noopener">💬 WhatsApp al acudiente</a>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cerrar</button>
      </div>`);
  }

  /* ============================================================ 4. SALONES */
  function vSalones() {
    if (salonAbierto) return vSalonDetalle(salonAbierto);
    const regs = regsHoy();
    return `<div class="dr-grid2">
      ${ETAPAS.map(e => {
        const co = coordDe(e.id);
        const cen = ninosDeEtapa(e.id).length;
        const pres = regs.filter(r => r.etapa === e.id && r.estado === "presente").length;
        const serv = servidoresDe(e.id).length;
        return `<button class="dr-card dr-card--click rk-salon" data-accion="rk-abrir-salon" data-id="${e.id}" style="--ec:${e.color}">
          <div class="rk-salon__head"><span class="rk-salon__ic" style="background:${e.bg};color:${e.color}">${e.emoji}</span>
            <div><b>${esc(e.nombre)}</b><small>${esc(e.rango)}</small></div></div>
          <div class="rk-salon__stats"><span><b>${cen}</b> en censo</span><span><b>${pres}</b> hoy</span><span><b>${serv}</b> servidores</span></div>
          <div class="rk-salon__coord">👤 Coord.: <b>${esc(co ? co.nombre : "—")}</b></div>
        </button>`;
      }).join("")}
    </div>`;
  }
  function vSalonDetalle(etId) {
    const e = RK.etapa(etId);
    const co = coordDe(etId);
    const ninos = ninosDeEtapa(etId);
    const regs = regsHoy().filter(r => r.etapa === etId);
    const serv = servidoresDe(etId);
    const opciones = RK.COORDS.map(c => `<option value="${c.id}" ${co && c.id === co.id ? "selected" : ""}>${esc(c.nombre)}</option>`).join("");
    return `
      <button class="dr-back" data-accion="rk-cerrar-salon">← Volver a salones</button>
      <div class="dr-head"><div><h2 class="dr-h1">${e.emoji} ${esc(e.nombre)}</h2>
        <p class="dr-lead">${esc(e.rango)} · ${ninos.length} niños en el censo · ${regs.filter(r => r.estado === "presente").length} presentes hoy.</p></div></div>
      <div class="dr-card">
        <h3 class="dr-card__t">Coordinador del salón</h3>
        <div class="dr-reasignar">
          <label class="dr-field"><span>Asignar coordinador</span>
            <select class="dr-select" data-accion="rk-reasignar-coord" data-area="${etId}">${opciones}</select></label>
          ${co ? `<a class="dr-btn dr-btn--ghost dr-btn--sm" href="https://wa.me/${soloDigitos(co.tel)}" target="_blank" rel="noopener">💬 WhatsApp</a>` : ""}
        </div>
      </div>
      <div class="dr-grid2">
        <div class="dr-card">
          <h3 class="dr-card__t">Servidores del salón (${serv.length})</h3>
          <div class="dr-mini-list">
            ${serv.length ? serv.map(p => `<div class="dr-mini-row" data-accion="rk-ver-servidor" data-id="${p.id}"><span class="dr-mini-avatar">${esc(iniciales(p))}</span><div class="dr-mini-row__main"><b>${esc(ninoNombre(p))}</b><small>Sirve desde ${fechaCorta(p.desde)}</small></div></div>`).join("") : '<p class="dr-card__sub">Aún sin servidores asignados.</p>'}
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
          <tbody>${ninos.map(n => { const ac = n.acudiente || {}; return `<tr data-accion="rk-ver-nino" data-id="${n.id}" class="dr-trclick"><td><b>${esc(ninoNombre(n))}</b></td><td>${n.edad || "—"}</td><td>${esc(ac.nombre || "—")}</td><td>${esc(ac.celular || "—")}</td><td>›</td></tr>`; }).join("")}</tbody>
        </table></div>
      </div>`;
  }

  /* ============================================================ 5. EQUIPO */
  function vEquipo() {
    const equipo = S.equipo();
    const porEtapa = ETAPAS.map(e => ({ e, gente: equipo.filter(p => p.area === e.id) }));
    const porOp = EQUIPOS_OP.map(o => ({ o, gente: equipo.filter(p => p.area === o.id) }));
    return `
      <p class="dr-lead">Quienes hacen posible cada domingo: coordinadores de etapa y los equipos operativos. ${equipo.length} servidores.</p>
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
      </div>`;
  }
  function srvRow(p) {
    return `<div class="dr-mini-row" data-accion="rk-ver-servidor" data-id="${p.id}"><span class="dr-mini-avatar">${esc(iniciales(p))}</span><div class="dr-mini-row__main"><b>${esc(ninoNombre(p))}</b><small>${(p.cursos || []).map(c => CURSO_NOMBRES[c] || c).join(" · ") || "En formación"}</small></div><span class="dr-go">›</span></div>`;
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

  /* ============================================================ 6. NUEVOS */
  function vNuevos() {
    const nuevos = S.nuevos();
    return nuevos.length ? `<div class="dr-grid2">${nuevos.map(n => { const ac = n.acudiente || {}; const e = RK.etapa(n.etapa); return `
      <div class="dr-card" style="--ec:${e.color}">
        <div class="dr-mini-row"><span class="dr-mini-avatar" style="background:${e.color}">${esc(iniciales(n))}</span>
          <div class="dr-mini-row__main"><b>${esc(ninoNombre(n))}</b><small>${e.emoji} ${esc(e.corto)} · ${n.edad || "—"} años</small></div></div>
        <p class="dr-card__sub">👤 ${esc(ac.nombre || "—")} (${esc(ac.parentesco || "")}) · 📱 ${esc(ac.celular || "—")}</p>
        ${n.nota ? `<p class="dr-muted">📝 ${esc(n.nota)}</p>` : ""}
        <p class="dr-muted">Llegó: ${fechaCorta(n.fechaIngreso)}</p>
        <div class="dr-modal__acts">
          <button class="dr-btn dr-btn--primary dr-btn--sm" data-accion="rk-vincular" data-id="${n.id}">Vincular a salón</button>
          <a class="dr-btn dr-btn--ghost dr-btn--sm" href="${waAcudiente(n)}" target="_blank" rel="noopener" data-stop>💬 WhatsApp</a>
        </div>
      </div>`; }).join("")}</div>` : `<div class="dr-empty">🎉 ¡No hay niños nuevos pendientes! Todos están vinculados.</div>`;
  }
  function modalVincular(id) {
    const n = S.nuevos().find(x => x.id === id); if (!n) return;
    const ops = ETAPAS.map(e => `<option value="${e.id}" ${e.id === n.etapa ? "selected" : ""}>${e.emoji} ${esc(e.nombre)} (${esc(e.rango)})</option>`).join("");
    abrirModal(`
      <h3 id="dr-modal-t">Vincular a ${esc(ninoNombre(n))}</h3>
      <p class="dr-card__sub">Asígnalo a un salón según su edad. Pasará al censo del salón. (Se sincroniza con el director.)</p>
      <label class="dr-field"><span>Salón / etapa</span><select class="dr-select" id="ps-rk-vinc-sel">${ops}</select></label>
      <div class="dr-modal__acts">
        <button class="dr-btn dr-btn--primary" data-accion="rk-confirmar-vincular" data-id="${id}">Vincular</button>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>`);
  }

  /* ============================================================ 7. PETICIONES */
  function vPeticiones() {
    const delDomingo = regsHoy().filter(r => r.peticion_oracion).map(r => ({ autor: r.nombre_adulto + " (familia de " + r.nombre_nino + ")", texto: r.peticion_oracion }));
    let lista = S.peticiones();
    if (filtroPet !== "todas") lista = lista.filter(p => p.estado === filtroPet);
    return `
      <div class="dr-head"><div></div><button class="dr-btn dr-btn--primary" data-accion="rk-nueva-peticion">＋ Nueva petición</button></div>
      ${delDomingo.length ? `<div class="dr-card rk-domingo">
        <h3 class="dr-card__t">🟣 Del domingo (en vivo) · ${delDomingo.length}</h3>
        <div class="dr-mini-list">${delDomingo.map(p => `<div class="dr-peticion"><div class="dr-peticion__top"><b>${esc(p.autor)}</b><span class="dr-tag">Domingo</span></div><p>${esc(p.texto)}</p></div>`).join("")}</div>
      </div>` : ""}
      <div class="dr-filtros">
        ${[["todas", "Todas"], ["abierta", "Abiertas"], ["orando", "Orando"], ["respondida", "Respondidas"]].map(([f, l]) => `<button class="dr-pill ${filtroPet === f ? "is-on" : ""}" data-accion="rk-filtro-pet" data-f="${f}">${l}</button>`).join("")}
      </div>
      <div class="dr-peticiones">
        ${lista.length ? lista.map(p => `<div class="dr-peticion is-${p.estado}">
          <div class="dr-peticion__top"><b>${esc(p.autor)}</b><span class="dr-estado dr-estado--${p.estado}">${p.estado}</span></div>
          <p>${esc(p.texto)}</p>
          <div class="dr-peticion__acts">
            <span class="dr-muted">${fechaCorta(p.fecha)}</span>
            ${p.estado !== "orando" ? `<button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="rk-estado-pet" data-id="${p.id}" data-e="orando">🙏 Orando</button>` : ""}
            ${p.estado !== "respondida" ? `<button class="dr-btn dr-btn--primary dr-btn--sm" data-accion="rk-estado-pet" data-id="${p.id}" data-e="respondida">✓ Respondida</button>` : ""}
          </div>
        </div>`).join("") : '<div class="dr-empty">No hay peticiones con este filtro.</div>'}
      </div>`;
  }
  function modalPeticion() {
    abrirModal(`
      <h3 id="dr-modal-t">Nueva petición</h3>
      <label class="dr-field"><span>Autor</span><input class="dr-input" id="ps-rk-pet-autor" placeholder="${esc(PUSER.nombre)}"></label>
      <label class="dr-field"><span>Petición</span><textarea class="dr-input" id="ps-rk-pet-texto" rows="3" placeholder="Escribe la petición de oración"></textarea></label>
      <div class="dr-modal__acts">
        <button class="dr-btn dr-btn--primary" data-accion="rk-guardar-peticion">Publicar</button>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>`);
  }

  /* ============================================================ MODAL / TOAST (sobre los contenedores del pastor) */
  function abrirModal(html) {
    const wrap = document.getElementById("ps-modal"); if (!wrap) return;
    wrap.innerHTML = `<div class="dr-modalbg" id="ps-rk-modalbg"><div class="dr-modal" role="dialog" aria-modal="true" aria-labelledby="dr-modal-t">${html}</div></div>`;
    const bg = document.getElementById("ps-rk-modalbg");
    if (bg) bg.addEventListener("click", e => { if (e.target.id === "ps-rk-modalbg") cerrarModal(); });
    document.addEventListener("keydown", escClose);
  }
  function cerrarModal() { const w = document.getElementById("ps-modal"); if (w) w.innerHTML = ""; document.removeEventListener("keydown", escClose); }
  function escClose(e) { if (e.key === "Escape") cerrarModal(); }
  function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ""; }
  function toast(msg, ok) {
    const wrap = document.getElementById("ps-toasts"); if (!wrap) return;
    const el = document.createElement("div");
    el.className = "dr-toast" + (ok ? " dr-toast--ok" : "");
    el.innerHTML = `<span>${ok ? "✓" : "ℹ️"}</span><span>${esc(msg)}</span>`;
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateY(8px)"; setTimeout(() => el.remove(), 250); }, 3000);
  }

  /* ============================================================ RENDER (contenido interno de la pestaña) */
  const VISTAS = { analitica: vAnalitica, recurrencia: vRecurrencia, crm: vCRM, salones: vSalones, equipo: vEquipo, nuevos: vNuevos, peticiones: vPeticiones };
  function render() {
    const fn = VISTAS[sub] || vAnalitica;
    return `${cabecera()}${subnav()}<div class="ps-rk-body">${fn()}</div>`;
  }
  function afterRender() {
    if (sub === "crm") {
      const inp = document.getElementById("ps-rk-crm-search"); if (!inp) return;
      inp.value = crmQuery;
      inp.oninput = () => {
        crmQuery = inp.value.trim().toLowerCase(); let vis = 0;
        document.querySelectorAll("#ps-rk-crm-body tr").forEach(tr => { const ok = !crmQuery || (tr.dataset.search || "").includes(crmQuery); tr.style.display = ok ? "" : "none"; if (ok) vis++; });
        const c = document.getElementById("ps-rk-crm-count"); if (c) c.textContent = vis;
      };
      if (crmQuery) inp.dispatchEvent(new Event("input"));
    }
  }

  /* ============================================================ ACCIONES (todas con prefijo rk-) */
  function handle(a, el, ev) {
    const id = el.dataset.id;
    switch (a) {
      case "rk-sub": ev.preventDefault(); sub = el.dataset.sub; salonAbierto = null; if (typeof window !== "undefined") window.scrollTo(0, 0); _rerender(); return true;

      /* recurrencia */
      case "rk-rec-etapa": ev.preventDefault(); recEtapa = el.dataset.f; _rerender(); return true;
      case "rk-rec-estado": ev.preventDefault(); recEstado = el.dataset.f; _rerender(); return true;

      /* crm */
      case "rk-crm-sort": { ev.preventDefault(); const col = el.dataset.col; if (crmSort === col) crmDir = -crmDir; else { crmSort = col; crmDir = 1; } _rerender(); return true; }
      case "rk-crm-filtro": ev.preventDefault(); crmFiltro = el.dataset.f; _rerender(); return true;
      case "rk-ver-nino": ev.preventDefault(); modalNino(id); return true;

      /* salones */
      case "rk-abrir-salon": ev.preventDefault(); salonAbierto = id; if (typeof window !== "undefined") window.scrollTo(0, 0); _rerender(); return true;
      case "rk-cerrar-salon": ev.preventDefault(); salonAbierto = null; _rerender(); return true;

      /* equipo */
      case "rk-ver-servidor": ev.preventDefault(); modalServidor(id); return true;

      /* nuevos */
      case "rk-vincular": ev.preventDefault(); modalVincular(id); return true;
      case "rk-confirmar-vincular": { ev.preventDefault(); const sel = document.getElementById("ps-rk-vinc-sel"); const et = sel ? sel.value : null; if (et && S.vincularNuevo(id, et)) { cerrarModal(); _rerender(); toast(`Vinculado a ${RK.etapa(et).nombre} ✓`, true); } return true; }

      /* peticiones */
      case "rk-filtro-pet": ev.preventDefault(); filtroPet = el.dataset.f; _rerender(); return true;
      case "rk-nueva-peticion": ev.preventDefault(); modalPeticion(); return true;
      case "rk-guardar-peticion": { ev.preventDefault(); const texto = val("ps-rk-pet-texto"); if (!texto) { toast("Escribe la petición", false); return true; } S.addPeticion({ autor: val("ps-rk-pet-autor") || PUSER.nombre, texto }); cerrarModal(); _rerender(); toast("Petición publicada 🙏", true); return true; }
      case "rk-estado-pet": ev.preventDefault(); S.setEstadoPeticion(id, el.dataset.e); _rerender(); toast(el.dataset.e === "respondida" ? "¡Respondida! 🎉" : "Marcada: orando 🙏", true); return true;
    }
    return false;
  }

  /* reasignar coordinador (change del select dentro de la pestaña) */
  document.addEventListener("change", e => {
    const sel = e.target.closest('[data-accion="rk-reasignar-coord"]');
    if (sel) { S.setCoordDe(sel.dataset.area, sel.value); _rerender(); const c = RK.COORDS.find(x => x.id === sel.value); toast(`Coordinador asignado: ${c ? c.nombre : ""} ✓`, true); }
  });

  /* ============================================================ ORGANIGRAMA: subárbol vivo para el pastor
     Cuelga el organigrama de RocaKids del nodo org_m_rocakids del pastor. */
  function orgSubtree() {
    return S.organigrama().map(n => ({
      id: "rk_" + n.id,
      nombre: n.nombre,
      rol: n.rol,
      parent: n.parent ? "rk_" + n.parent : "org_m_rocakids",
      _editable: false,
      _live: true,
    }));
  }

  /* ============================================================ API pública para pastor.js */
  window.PASTOR_RK = {
    NAV: { id: "rocakids", ico: "🧒", lbl: "RocaKids" },
    setRerender(fn) { if (typeof fn === "function") _rerender = fn; },
    render, afterRender, handle, orgSubtree,
    get vista() { return sub; },
  };
})();
