/* ============================================================
   CASA ROCA · APP DEL CONSEJERO — Consejería
   Demo: Andrés Lozano (cj_andres). Atiende sus consejerías
   asignadas, registra notas confidenciales y sesiones, ve su
   analítica, consulta el asistente de conocimiento y su agenda.
   Lee window.CONSE / window.CONSESTORE (estado compartido en vivo
   con el coordinador y la dirección). Reusa CSUI + componentes .dr-.
   ============================================================ */
(function () {
  "use strict";
  const C = window.CONSE, S = window.CONSESTORE, U = window.CSUI;
  const USER = C.CONSEJERO_USER;
  const MI_ID = USER.id;

  let sesion = false, vista = "analitica", clickBound = false, dragBound = false;
  let filtro = "todas", casoAbierto = null, calMes = null, dragId = null;
  let conQuery = "", conCat = "todas";
  let gcalConnected = false;
  const gcalEmail = "consejero.demo@example.org"; // demo: correo personal del consejero

  /* ---- Google Calendar (sin backend: usa el enlace de plantilla y .ics) ---- */
  function gcalUrl(titulo, fechaISO, ini, fin, detalles, lugar) {
    const f = String(fechaISO).replace(/-/g, "");
    const t1 = (ini || "09:00").replace(":", "") + "00";
    const t2 = (fin || "10:00").replace(":", "") + "00";
    const dates = `${f}T${t1}/${f}T${t2}`;
    const q = s => encodeURIComponent(s || "");
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${q(titulo)}&dates=${dates}&details=${q(detalles)}&location=${q(lugar)}`;
  }
  function icsDe(citas) {
    const dt = (fechaISO, hora) => String(fechaISO).replace(/-/g, "") + "T" + (hora || "09:00").replace(":", "") + "00";
    const ev = citas.map(e => `BEGIN:VEVENT\nUID:${e.id}@casaroca\nDTSTART:${dt(e.fecha, e.horaInicio)}\nDTEND:${dt(e.fecha, e.horaFin)}\nSUMMARY:${(e.titulo || "Cita").replace(/\n/g, " ")}\nLOCATION:${(C.espacio(e.espacioId) || {}).nombre || ""}\nEND:VEVENT`).join("\n");
    return `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Casa Roca//Consejeria//ES\n${ev}\nEND:VCALENDAR`;
  }
  function icsHref(citas) { return "data:text/calendar;charset=utf-8," + encodeURIComponent(icsDe(citas)); }

  const NAV = [
    { id: "analitica",   ico: "📊", lbl: "Analítica" },
    { id: "mis-casos",   ico: "🗂️", lbl: "Consejerías" },
    { id: "procesos",    ico: "🔄", lbl: "Procesos activos" },
    { id: "calendario",  ico: "📅", lbl: "Calendario" },
    { id: "conocimiento", ico: "📚", lbl: "Conocimiento" },
  ];
  const SHELL = { user: USER, nav: NAV, logo: "CS", sub: "Consejería · Consejero" };

  const misCasos = () => S.deConsejero(MI_ID);
  function avatar(p) { return `<div class="cs-caso__ava">${U.esc(U.iniciales(p))}</div>`; }

  /* ============================================================ 1. MIS CASOS */
  function vistaCasos() {
    let casos = misCasos();
    if (filtro === "activas") casos = casos.filter(c => c.estado === "activa");
    else if (filtro === "programadas") casos = casos.filter(c => c.estado === "programada" || c.estado === "asignada");
    else if (filtro === "cerradas") casos = casos.filter(c => c.estado === "cerrada");

    const todas = misCasos();
    const fil = [
      { id: "todas", lbl: `Todas (${todas.length})` },
      { id: "activas", lbl: `Activas (${todas.filter(c => c.estado === "activa").length})` },
      { id: "programadas", lbl: `Por iniciar (${todas.filter(c => c.estado === "programada" || c.estado === "asignada").length})` },
      { id: "cerradas", lbl: `Cerradas (${todas.filter(c => c.estado === "cerrada").length})` },
    ];

    const cards = casos.length ? casos.map(cardCaso).join("") :
      `<div class="dr-empty">No tienes consejerías en este filtro. Cuando el coordinador te asigne un caso, aparecerá aquí en vivo.</div>`;

    return U.shell(SHELL, U.head(
      "Mis consejerías",
      "Las personas que estás acompañando. Cada caso guarda sus notas de forma <b>confidencial</b> (solo tú y el pastor).",
      `<button class="dr-btn dr-btn--primary" data-accion="nueva-solicitud">＋ Registrar caso</button>`
    ) + `
      <div class="cs-confid" style="margin-bottom:14px">🔒 Las notas pastorales son confidenciales · Ley 1581/2012</div>
      <div class="dr-filtros">
        ${fil.map(f => `<button class="dr-filtro ${filtro === f.id ? "is-active" : ""}" data-accion="filtro" data-f="${f.id}">${f.lbl}</button>`).join("")}
      </div>
      <div class="cs-casos">${cards}</div>
    `, vista);
  }

  function cardCaso(c) {
    const t = C.tipo(c.tipo);
    const tel = U.esc(c.tel || "—"), wa = String(c.tel || "").replace(/\D/g, "");
    return `
    <article class="cs-caso">
      <div class="cs-caso__top">
        <div class="cs-caso__persona">
          ${avatar(c.persona)}
          <div class="cs-caso__nom"><b>${U.esc(c.persona)}</b><small>${U.esc(c.ministerio)}${c.edad ? " · " + c.edad + " años" : ""} · ${c.genero === "F" ? "Mujer" : "Hombre"}</small></div>
        </div>
        ${U.estadoChip(c.estado)}
      </div>
      <div class="cs-caso__contacto">
        <span>📞 ${wa ? `<a href="https://wa.me/${wa}" target="_blank" rel="noopener">${tel}</a>` : tel}</span>
        <span>✉️ ${c.correo ? `<a href="mailto:${U.esc(c.correo)}">${U.esc(c.correo)}</a>` : "—"}</span>
      </div>
      <p class="cs-caso__motivo">${U.esc(c.motivo)}</p>
      <div class="cs-caso__meta">${U.tipoChip(c.tipo)} ${U.prioChip(c.prioridad)}
        ${c.proxima ? `<span class="cs-chip">📅 Próxima: ${U.fechaRel(c.proxima)}</span>` : ""}</div>
      <div class="cs-caso__fechas">
        <span>🗓️ Solicitó: <b>${U.fechaCorta(c.desde)}</b></span>
        <span>✅ Asignado: <b>${c.fechaAsig ? U.fechaCorta(c.fechaAsig) : "—"}</b></span>
      </div>
      <div class="cs-caso__foot">
        <span class="cs-caso__stat"><b>${c.sesiones}</b> sesiones · <b>${c.notas}</b> notas</span>
        <div class="cs-caso__acts">
          <button class="dr-btn dr-btn--sm" data-accion="abrir-caso" data-id="${c.id}">Abrir</button>
        </div>
      </div>
    </article>`;
  }

  function modalCaso(id) {
    const c = S.consejeriaPorId(id); if (!c) return;
    const t = C.tipo(c.tipo);
    const notas = S.notasDe(id);
    const cerrada = c.estado === "cerrada";
    U.abrirModal(`
      <div class="dr-modal__head">
        <div class="cs-caso__ava" style="width:46px;height:46px">${U.esc(U.iniciales(c.persona))}</div>
        <div><h3 id="cs-modal-t">${U.esc(c.persona)}</h3><p class="dr-card__sub">${t.emoji} ${U.esc(t.nombre)} · ${U.esc(c.ministerio)}</p></div>
      </div>
      <div class="cs-caso__meta" style="margin-bottom:12px">${U.estadoChip(c.estado)} ${U.prioChip(c.prioridad)}
        <span class="cs-chip">${c.sesiones} sesiones</span>
        <span class="cs-chip">desde ${U.fechaCorta(c.desde)}</span>
        ${c.proxima ? `<span class="cs-chip">📅 ${U.fechaCorta(c.proxima)}${c.espacio ? " · " + U.esc((C.espacio(c.espacio) || {}).nombre || "") : ""}</span>` : ""}</div>

      <div class="dr-card" style="margin-bottom:12px"><h3 class="dr-card__t">Motivo</h3><p class="cs-caso__motivo">${U.esc(c.motivo)}</p></div>

      <div class="dr-card" style="margin-bottom:12px">
        <h3 class="dr-card__t">🔒 Notas confidenciales <small style="font-weight:500;color:var(--texto-tenue)">(${notas.length})</small></h3>
        <p class="dr-card__sub">Solo visibles para ti y el pastor.</p>
        ${cerrada ? "" : `<form data-accion="guardar-nota" data-id="${id}" style="margin:8px 0 12px">
          <textarea id="cs-nota-txt" class="dr-input" rows="2" placeholder="Escribe una nota de la sesión…"></textarea>
          <div style="display:flex;gap:7px;margin-top:8px">
            <button type="submit" class="dr-btn dr-btn--primary dr-btn--sm">Guardar nota</button>
          </div>
        </form>`}
        <div class="cs-mini">
          ${notas.length ? notas.map(n => `<div class="cs-mini__row"><div><p>${U.esc(n.texto)}</p><small>${U.esc(n.por)} · ${U.fechaCorta(n.fecha)}</small></div></div>`).join("") : `<div class="dr-empty" style="padding:14px">Sin notas todavía.</div>`}
        </div>
      </div>

      <div class="cs-contact-row">
        <a class="cs-wa" href="https://wa.me/${String(c.tel || "").replace(/\D/g, "")}?text=${encodeURIComponent("Hola " + c.persona.split(" ")[0] + ", soy " + USER.nombre.split(" ")[0] + " de Casa Roca 🙌")}" target="_blank" rel="noopener">
          <svg viewBox="0 0 32 32" width="17" height="17" aria-hidden="true"><path fill="currentColor" d="M16 3C9.4 3 4 8.4 4 15c0 2.1.6 4.2 1.6 6L4 29l8.2-1.6c1.7.9 3.7 1.4 5.8 1.4 6.6 0 12-5.4 12-12S22.6 3 16 3zm0 21.8c-1.8 0-3.6-.5-5.1-1.4l-.4-.2-4.9 1 1-4.8-.3-.4c-1-1.6-1.5-3.4-1.5-5.3 0-5.4 4.4-9.8 9.8-9.8s9.7 4.4 9.7 9.8-4.3 9.8-9.7 9.8zm5.4-7.3c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.2s-.8 1-.9 1.1c-.2.2-.3.2-.6.1-1.8-.9-2.9-1.6-4.1-3.6-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.6s-.7-1.6-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.8.4-.3.3-1.1 1-1.1 2.6s1.1 3 1.3 3.2c.2.2 2.3 3.5 5.5 4.9 2 .9 2.8.9 3.8.8.6-.1 1.8-.8 2.1-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.2-.6-.4z"/></svg>
          WhatsApp
        </a>
        <a class="cs-mail" href="mailto:${U.esc(c.correo || "")}?subject=${encodeURIComponent("Casa Roca · Acompañamiento")}">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm9 7L4 7v1l8 5 8-5V7l-8 5z"/></svg>
          Correo
        </a>
      </div>
      <div class="dr-modal__acts">
        ${cerrada ? `<span class="ps-estado ps-estado--respondida">Caso cerrado${c.resultadoCierre ? " · " + ({ completado: "Completado", incompleta: "Incompleta", "no-realizado": "Nunca se realizó" }[c.resultadoCierre] || c.resultadoCierre) : ""}</span>` : `
        <button class="dr-btn dr-btn--primary" data-accion="registrar-sesion" data-id="${id}">✓ Registrar sesión</button>
        <button class="dr-btn" data-accion="agendar-cita" data-id="${id}">📅 Agendar próxima</button>
        ${c.proxima ? `<a class="dr-btn" href="${gcalUrl("Consejería · " + c.persona, c.proxima, "09:00", "10:00", "Cita de consejería con " + c.persona + " · Casa Roca", (C.espacio(c.espacio) || {}).nombre)}" target="_blank" rel="noopener" title="Añadir la próxima cita a tu Google Calendar">📅 Sincronizar</a>` : ""}
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-caso" data-id="${id}">Cerrar caso</button>`}
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Volver</button>
      </div>
    `);
  }

  function modalCerrarCaso(id) {
    const c = S.consejeriaPorId(id); if (!c) return;
    U.abrirModal(`
      <div class="dr-modal__head"><div><h3 id="cs-modal-t">Cerrar caso · ${U.esc(c.persona)}</h3><p class="dr-card__sub">¿Cómo terminó este proceso de consejería?</p></div></div>
      <label class="dr-field"><span>Resultado del cierre</span>
        <select id="cs-cierre-sel" class="dr-select">
          <option value="completado">✅ Completado — el proceso se llevó a cabo y concluyó</option>
          <option value="incompleta">⏸️ Incompleta — se inició pero no se terminó</option>
          <option value="no-realizado">🚫 Nunca se realizó — no llegó a iniciarse</option>
        </select>
      </label>
      <div class="dr-modal__acts">
        <button class="dr-btn dr-btn--primary" data-accion="confirmar-cierre" data-id="${id}">Cerrar caso</button>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>
    `);
  }

  function modalNuevaSolicitud() {
    U.abrirModal(`
      <div class="dr-modal__head"><div><h3 id="cs-modal-t">Registrar consejería</h3><p class="dr-card__sub">Para casos que llegan directamente a ti.</p></div></div>
      <form data-accion="guardar-solicitud">
        <label class="dr-field"><span>Persona</span><input id="cs-ns-persona" class="dr-input" placeholder="Nombre de la persona"></label>
        <label class="dr-field"><span>Ministerio / sede</span><input id="cs-ns-min" class="dr-input" placeholder="Ej. J+25"></label>
        <label class="dr-field"><span>Tipo</span><select id="cs-ns-tipo" class="dr-select">${C.TIPOS.map(t => `<option value="${t.id}">${t.emoji} ${t.nombre}</option>`).join("")}</select></label>
        <label class="dr-field"><span>Prioridad</span><select id="cs-ns-prio" class="dr-select">${C.PRIORIDADES.map(p => `<option value="${p.id}" ${p.id === "media" ? "selected" : ""}>${p.nombre}</option>`).join("")}</select></label>
        <label class="dr-field"><span>Motivo</span><textarea id="cs-ns-motivo" class="dr-input" rows="2" placeholder="Breve descripción"></textarea></label>
        <div class="dr-modal__acts">
          <button type="submit" class="dr-btn dr-btn--primary">Crear caso</button>
          <button type="button" class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
        </div>
      </form>
    `);
  }

  function modalAgendar(id) {
    const c = S.consejeriaPorId(id); if (!c) return;
    U.abrirModal(`
      <div class="dr-modal__head"><div><h3 id="cs-modal-t">Agendar cita · ${U.esc(c.persona)}</h3><p class="dr-card__sub">Reserva un consultorio para la próxima sesión.</p></div></div>
      <form data-accion="guardar-cita" data-id="${id}">
        <label class="dr-field"><span>Fecha</span><input id="cs-ag-fecha" class="dr-input" type="date" value="${C.diasAdel(3)}"></label>
        <div class="dr-grid2">
          <label class="dr-field"><span>Inicio</span><input id="cs-ag-ini" class="dr-input" type="time" value="16:00"></label>
          <label class="dr-field"><span>Fin</span><input id="cs-ag-fin" class="dr-input" type="time" value="17:00"></label>
        </div>
        <label class="dr-field"><span>Espacio</span><select id="cs-ag-esp" class="dr-select">${C.ESPACIOS.map(e => `<option value="${e.id}">${e.nombre}</option>`).join("")}</select></label>
        <div class="dr-modal__acts">
          <button type="submit" class="dr-btn dr-btn--primary">Agendar y reservar</button>
          <button type="button" class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
        </div>
      </form>
    `);
  }

  /* ============================================================ 2. PROCESOS ACTIVOS (Kanban) */
  function vistaProcesos() {
    const casos = misCasos();
    const cols = S.columnasProceso();
    const colHTML = cols.map(col => {
      const enCol = casos.filter(c => (c.etapaProceso || "asignado") === col.id);
      const cls = col.id === "finalizado" ? "cs-kan-col--fin" : col.id === "asignado" ? "cs-kan-col--asig" : "";
      const cards = enCol.length ? enCol.map(kanCard).join("") : `<div class="cs-kan-col__empty">Suelta aquí</div>`;
      return `<div class="cs-kan-col ${cls}" data-col="${col.id}">
        <div class="cs-kan-col__head"><b>${col.ico} ${U.esc(col.lbl)}</b><span class="cs-kan-col__count">${enCol.length}</span></div>
        <div class="cs-kan-col__body">${cards}</div>
      </div>`;
    }).join("");

    return U.shell(SHELL, U.head(
      "Procesos activos",
      "El recorrido de cada persona: <b>Asignado → Consejería 1, 2, 3… → Finalizado</b>. <b>Arrastra</b> cada tarjeta a la columna donde va. Si un proceso necesita más sesiones, añade otra consejería.",
      `<button class="dr-btn dr-btn--primary" data-accion="add-col-proc">＋ Añadir consejería</button>`
    ) + `
      <div class="cs-confid" style="margin-bottom:14px">🔄 ${casos.filter(c => c.etapaProceso !== "finalizado").length} en proceso · ${casos.filter(c => c.etapaProceso === "finalizado").length} finalizados · arrastra las tarjetas entre columnas</div>
      <div class="cs-kanban">${colHTML}</div>
    `, vista);
  }

  function kanCard(c) {
    return `
    <div class="cs-kan-card" draggable="true" data-id="${c.id}">
      <div class="cs-kan-card__top">
        <span class="cs-kan-card__grip" aria-hidden="true">⠿</span>
        <div class="cs-kan-card__ava">${U.esc(U.iniciales(c.persona))}</div>
        <div class="cs-kan-card__nom"><b>${U.esc(c.persona)}</b><small>${U.esc(c.ministerio)}</small></div>
      </div>
      <div class="cs-kan-card__meta">${U.tipoChip(c.tipo)} <span class="cs-chip">${c.sesiones} ses.</span></div>
      <div class="cs-kan-card__foot">
        <button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="abrir-caso" data-id="${c.id}">Abrir</button>
      </div>
    </div>`;
  }

  /* ============================================================ 3. ANALÍTICA */
  function vistaAnalitica() {
    const casos = misCasos();
    const act = casos.filter(c => c.estado === "activa").length;
    const cer = casos.filter(c => c.estado === "cerrada").length;
    const sesiones = casos.reduce((s, c) => s + (c.sesiones || 0), 0);
    const carga = U.pct(casos.filter(c => c.estado !== "cerrada").length, (C.consejero(MI_ID) || {}).capacidad || 6);

    /* asignados por mes (últimos 6 meses, por fecha de asignación) */
    const hoyD = new Date(); const meses = [];
    for (let i = 5; i >= 0; i--) { const d = new Date(hoyD.getFullYear(), hoyD.getMonth() - i, 1); meses.push({ y: d.getFullYear(), m: d.getMonth() }); }
    const porMes = meses.map(mm => ({ lbl: U.MESES[mm.m], v: casos.filter(c => { if (!c.fechaAsig) return false; const d = new Date(c.fechaAsig + "T00:00"); return d.getFullYear() === mm.y && d.getMonth() === mm.m; }).length }));

    /* género */
    const nF = casos.filter(c => c.genero === "F").length, nM = casos.filter(c => c.genero !== "F").length;

    /* edad por rango */
    const rangos = [{ lbl: "<18", a: 0, b: 17 }, { lbl: "18–25", a: 18, b: 25 }, { lbl: "26–35", a: 26, b: 35 }, { lbl: "36–50", a: 36, b: 50 }, { lbl: "50+", a: 51, b: 200 }];
    const porEdad = rangos.map(r => ({ lbl: r.lbl, v: casos.filter(c => typeof c.edad === "number" && c.edad >= r.a && c.edad <= r.b).length, color: "var(--cs-teal)" }));
    const edadProm = (() => { const e = casos.filter(c => typeof c.edad === "number"); return e.length ? Math.round(e.reduce((s, c) => s + c.edad, 0) / e.length) : "—"; })();

    /* tipo de caso */
    const porTipo = C.TIPOS.map(t => ({ lbl: t.nombre.split(" ")[0], v: casos.filter(c => c.tipo === t.id).length, color: t.color })).filter(r => r.v > 0);

    return U.shell(SHELL, U.head("Mi analítica", "Tu acompañamiento en números: a quién atiendes y cómo crece.", "", true) + `
      <div class="dr-kpis">
        ${U.kpi(casos.length, "Casos totales")}
        ${U.kpi(act, "Activos")}
        ${U.kpi(cer, "Finalizados")}
        ${U.kpi(sesiones, "Sesiones")}
        ${U.kpi(edadProm + (edadProm === "—" ? "" : " años"), "Edad promedio")}
        ${U.kpi(carga + "%", "Carga vs. capacidad", carga >= 90)}
      </div>
      <div class="dr-charts">
        ${U.columns("Asignados por mes", "Casos que te asignaron (últimos 6 meses)", porMes, () => "var(--cs-teal)")}
        ${U.donut("Por género", `${nF} mujeres · ${nM} hombres`, [{ lbl: "Mujeres", v: nF, color: "#C2569B" }, { lbl: "Hombres", v: nM, color: "var(--azul-500)" }])}
        ${U.columns("Por edad", "Distribución por rango de edad", porEdad, r => r.color)}
        ${U.donut("Por tipo de caso", `${casos.length} en total`, porTipo)}
      </div>
    `, vista);
  }

  /* ============================================================ 3. CONOCIMIENTO (biblioteca + asistente) */
  function vistaConocimiento() {
    const base = S.conocimiento();
    const cats = []; base.forEach(k => { if (cats.indexOf(k.categoria) < 0) cats.push(k.categoria); });
    let items = base.slice();
    if (conCat !== "todas") items = items.filter(k => k.categoria === conCat);
    if (conQuery) { const q = conQuery.toLowerCase(); items = items.filter(k => (k.titulo + " " + k.desc + " " + k.categoria).toLowerCase().indexOf(q) >= 0); }

    /* agrupar por categoría */
    const porCat = {}; items.forEach(k => { (porCat[k.categoria] = porCat[k.categoria] || []).push(k); });
    const grupos = Object.keys(porCat).map(cat => `
      <div class="cs-kn-cat">${U.esc(cat)} · ${porCat[cat].length}</div>
      <div class="cs-kn-grid">${porCat[cat].map(cardConoc).join("")}</div>`).join("") || `<div class="dr-empty">Sin resultados para tu búsqueda.</div>`;

    return U.shell(SHELL, U.head(
      "Conocimiento",
      `Tu biblioteca de consejería: <b>${base.length} recursos</b> que el Pastor Franklin Peña (Dirección) ha cargado. Búscalos, ábrelos para leer la orientación completa, o pregúntale al asistente con el botón flotante 🤲.`,
      `<button class="dr-btn dr-btn--primary" data-accion="abrir-asistente">🤲 Preguntar al asistente</button>`
    ) + `
      <input id="cs-con-search" class="dr-search" placeholder="Buscar por tema, pregunta o palabra clave…" value="${U.esc(conQuery)}" autocomplete="off" style="width:100%;margin-bottom:12px">
      <div class="dr-filtros">
        <button class="dr-filtro ${conCat === "todas" ? "is-active" : ""}" data-accion="con-cat" data-c="todas">Todas (${base.length})</button>
        ${cats.map(c => `<button class="dr-filtro ${conCat === c ? "is-active" : ""}" data-accion="con-cat" data-c="${U.esc(c)}">${U.esc(c)} (${base.filter(k => k.categoria === c).length})</button>`).join("")}
      </div>
      ${grupos}
    `, vista);
  }
  function cardConoc(k) {
    return `<article class="cs-kn cs-kn--click" data-accion="ver-recurso" data-id="${k.id}" tabindex="0" role="button">
      <div class="cs-kn__top"><div class="cs-kn__ico">${k.ico || "📄"}</div><div><div class="cs-kn__t">${U.esc(k.titulo)}</div><div class="cs-kn__tipo">${U.esc(k.tipo)}</div></div></div>
      <p class="cs-kn__desc cs-kn__desc--clamp">${U.esc(k.desc)}</p>
      ${(k.docs && k.docs.length) ? `<div class="cs-kn__foot"><span>📎 ${k.docs.length} doc(s)</span><span class="cs-kn__leer">Leer →</span></div>` : `<div class="cs-kn__foot"><span>${U.esc(k.por)}</span><span class="cs-kn__leer">Leer →</span></div>`}
    </article>`;
  }
  function modalRecurso(id) {
    const k = S.recursoPorId(id); if (!k) return;
    U.abrirModal(`
      <div class="dr-modal__head"><div class="cs-kn__ico" style="width:44px;height:44px;font-size:22px">${k.ico || "📄"}</div>
        <div><h3 id="cs-modal-t">${U.esc(k.titulo)}</h3><p class="dr-card__sub">${U.esc(k.categoria)} · ${U.esc(k.tipo)} · ${U.esc(k.dirigidoA)}</p></div></div>
      <div class="cs-recurso__texto">${U.esc(k.desc).replace(/\n/g, "<br>")}</div>
      ${(k.docs && k.docs.length) ? `<div class="cs-kn__docs" style="margin-top:12px">${k.docs.map(d => `<div class="cs-kn__doc"><span>📎</span><b>${U.esc(d.nombre)}</b><span style="color:var(--texto-tenue)">${U.pesoKB(d.peso)}</span></div>`).join("")}</div>` : ""}
      <div class="dr-modal__acts">
        <button class="dr-btn dr-btn--primary" data-accion="abrir-asistente">🤲 Preguntar al asistente</button>
        <span class="dr-card__sub" style="align-self:center">Cargado por ${U.esc(k.por)}</span>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal" style="margin-left:auto">Cerrar</button>
      </div>
    `);
  }

  /* ============================================================ 4. CALENDARIO */
  function vistaCalendario() {
    const hoy = new Date();
    if (!calMes) calMes = { y: hoy.getFullYear(), m: hoy.getMonth() };
    const { y, m } = calMes;
    const mios = S.eventos().filter(e => e.consejero === MI_ID || e.tipo !== "cita");
    const first = new Date(y, m, 1), startDow = (first.getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
    const evByDay = {};
    mios.forEach(e => { const d = new Date(e.fecha + "T00:00"); if (d.getFullYear() === y && d.getMonth() === m) { (evByDay[d.getDate()] = evByDay[d.getDate()] || []).push(e); } });

    let cells = "";
    for (let i = 0; i < startDow; i++) cells += `<div class="dr-cal__cell is-empty"></div>`;
    const todayN = (hoy.getFullYear() === y && hoy.getMonth() === m) ? hoy.getDate() : -1;
    for (let d = 1; d <= days; d++) {
      const evs = evByDay[d] || [];
      cells += `<div class="dr-cal__cell ${d === todayN ? "is-today" : ""}">
        <div class="dr-cal__day">${d}</div>
        ${evs.slice(0, 3).map(e => `<button class="dr-cal__ev ${e.tipo === "cita" ? "is-mio" : "is-otro"}" data-accion="ver-evento" data-id="${e.id}" title="${U.esc(e.titulo)}">${e.horaInicio} ${U.esc(e.titulo.replace("Cita · ", ""))}</button>`).join("")}
        ${evs.length > 3 ? `<div class="dr-cal__more">+${evs.length - 3}</div>` : ""}
      </div>`;
    }

    const proximos = mios.filter(e => e.fecha >= C.hoyISO()).sort((a, b) => (a.fecha + a.horaInicio).localeCompare(b.fecha + b.horaInicio)).slice(0, 6);
    const misCitas = mios.filter(e => e.tipo === "cita");

    const conexion = gcalConnected
      ? `<div class="cs-gcal cs-gcal--on">
          <div><span class="cs-gcal__ok">✓ Conectado</span> con <b>${U.esc(gcalEmail)}</b></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <a class="dr-btn dr-btn--sm" href="${icsHref(misCitas)}" download="mis-citas-consejeria.ics">⬇️ Exportar todas (.ics)</a>
            <button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="gcal-disconnect">Desconectar</button>
          </div>
        </div>`
      : `<div class="cs-gcal">
          <div><b>📅 Conecta tu Google Calendar</b><small>Sincroniza tus citas de consejería con tu correo personal de Gmail.</small></div>
          <button class="dr-btn dr-btn--primary dr-btn--sm cs-gcal__btn" data-accion="gcal-connect">
            <svg width="15" height="15" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            Conectar Google Calendar
          </button>
        </div>`;

    return U.shell(SHELL, U.head("Mi calendario", "Tus citas de consejería y las reuniones del equipo. Conéctalo con tu Gmail para tenerlas en tu calendario personal.",
      `<button class="dr-btn dr-btn--primary" data-accion="nuevo-evento">＋ Nueva cita</button>`) + `
      ${conexion}
      <div class="dr-callegend"><span><i class="dot mio"></i>Mis citas</span><span><i class="dot otro"></i>Equipo / formación</span></div>
      <div class="dr-grid2" style="align-items:start">
        <div class="dr-cal">
          <div class="dr-cal__bar">
            <button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="cal-prev">‹</button>
            <b>${U.MESES_L[m]} ${y}</b>
            <button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="cal-next">›</button>
          </div>
          <div class="dr-cal__dow">${U.DOW.map(d => `<div>${d}</div>`).join("")}</div>
          <div class="dr-cal__grid">${cells}</div>
        </div>
        <div class="dr-card"><h3 class="dr-card__t">Próximas citas</h3>
          <div class="cs-mini">
            ${proximos.length ? proximos.map(e => `<div class="cs-mini__row"><div><b>${U.esc(e.titulo)}</b><p>${U.fechaCorta(e.fecha)} · ${e.horaInicio}–${e.horaFin} · ${U.esc((C.espacio(e.espacioId) || {}).nombre || "")}</p></div><div style="display:flex;gap:5px">
              <a class="dr-btn dr-btn--ghost dr-btn--sm" href="${gcalUrl(e.titulo, e.fecha, e.horaInicio, e.horaFin, "Cita de consejería · Casa Roca", (C.espacio(e.espacioId) || {}).nombre)}" target="_blank" rel="noopener" title="Añadir a Google Calendar">＋📅</a>
              ${e.tipo === "cita" ? `<button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="del-evento" data-id="${e.id}">✕</button>` : ""}</div></div>`).join("") : `<div class="dr-empty" style="padding:14px">Sin citas próximas.</div>`}
          </div>
        </div>
      </div>
    `, vista);
  }

  function modalEvento() {
    U.abrirModal(`
      <div class="dr-modal__head"><div><h3 id="cs-modal-t">Nueva cita</h3><p class="dr-card__sub">Reserva un espacio para una sesión.</p></div></div>
      <form data-accion="guardar-evento">
        <label class="dr-field"><span>Título</span><input id="cs-ev-titulo" class="dr-input" placeholder="Ej. Cita · Nombre"></label>
        <label class="dr-field"><span>Fecha</span><input id="cs-ev-fecha" class="dr-input" type="date" value="${C.diasAdel(2)}"></label>
        <div class="dr-grid2">
          <label class="dr-field"><span>Inicio</span><input id="cs-ev-ini" class="dr-input" type="time" value="16:00"></label>
          <label class="dr-field"><span>Fin</span><input id="cs-ev-fin" class="dr-input" type="time" value="17:00"></label>
        </div>
        <label class="dr-field"><span>Espacio</span><select id="cs-ev-esp" class="dr-select">${C.ESPACIOS.map(e => `<option value="${e.id}">${e.nombre}</option>`).join("")}</select></label>
        <div class="dr-modal__acts">
          <button type="submit" class="dr-btn dr-btn--primary">Crear y reservar</button>
          <button type="button" class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
        </div>
      </form>
    `);
  }
  function modalEventoVer(id) {
    const e = S.eventos().find(x => x.id === id); if (!e) return;
    U.abrirModal(`
      <div class="dr-modal__head"><div><h3 id="cs-modal-t">${U.esc(e.titulo)}</h3><p class="dr-card__sub">${U.fechaCorta(e.fecha)} · ${e.horaInicio}–${e.horaFin}</p></div></div>
      <div class="cs-mini"><div class="cs-mini__row"><div><b>Espacio</b><p>${U.esc((C.espacio(e.espacioId) || {}).nombre || "—")}</p></div></div>
      <div class="cs-mini__row"><div><b>Tipo</b><p>${e.tipo === "cita" ? "Cita de consejería" : e.tipo === "reunion" ? "Reunión de equipo" : "Formación"}</p></div></div></div>
      <div class="dr-modal__acts"><button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cerrar</button></div>
    `);
  }

  /* ============================================================ EVENTOS */
  function manejar(ev) {
    const formEl = ev.target.closest("form[data-accion]");
    if (formEl && ev.type === "submit") { ev.preventDefault(); handleForm(formEl.dataset.accion, formEl); return; }
    const el = ev.target.closest("[data-accion]"); if (!el) return;
    const a = el.dataset.accion, id = el.dataset.id;
    switch (a) {
      case "salir": ev.preventDefault(); sesion = false; vista = "analitica"; render(); return;
      case "ir": ev.preventDefault(); vista = el.dataset.vista; casoAbierto = null; window.scrollTo(0, 0); render(); return;
      case "filtro": ev.preventDefault(); filtro = el.dataset.f; render(); return;
      case "abrir-caso": ev.preventDefault(); modalCaso(id); return;
      case "nueva-solicitud": ev.preventDefault(); modalNuevaSolicitud(); return;
      case "mover-proc": ev.preventDefault(); S.moverProceso(id, parseInt(el.dataset.dir, 10)); render(); return;
      case "add-col-proc": ev.preventDefault(); { const n = S.addColumnaConsejeria(); render(); U.toast(`Añadida Consejería ${n} al proceso ✓`, true); } return;
      case "abrir-asistente": ev.preventDefault(); U.abrirAsistente(); return;
      case "con-cat": ev.preventDefault(); conCat = el.dataset.c; render(); return;
      case "ver-recurso": ev.preventDefault(); modalRecurso(id); return;
      case "gcal-connect": ev.preventDefault(); gcalConnected = true; render(); U.toast(`Conectado con ${gcalEmail} ✓`, true); return;
      case "gcal-disconnect": ev.preventDefault(); gcalConnected = false; render(); U.toast("Google Calendar desconectado", false); return;
      case "registrar-sesion": ev.preventDefault(); S.registrarSesion(id); modalCaso(id); U.toast("Sesión registrada ✓", true); return;
      case "cerrar-caso": ev.preventDefault(); modalCerrarCaso(id); return;
      case "confirmar-cierre": { ev.preventDefault(); const sel = document.getElementById("cs-cierre-sel"); const res = sel ? sel.value : "completado"; S.cerrarCaso(id, res); U.cerrarModal(); render(); U.toast("Caso cerrado ✓", true); return; }
      case "agendar-cita": ev.preventDefault(); modalAgendar(id); return;
      case "csa-sugerida": ev.preventDefault(); U.csaResponder(el.dataset.q); return;
      case "nuevo-evento": ev.preventDefault(); modalEvento(); return;
      case "ver-evento": ev.preventDefault(); modalEventoVer(id); return;
      case "del-evento": ev.preventDefault(); S.delEvento(id); render(); U.toast("Cita eliminada", false); return;
      case "cal-prev": ev.preventDefault(); calMes = { y: calMes.m === 0 ? calMes.y - 1 : calMes.y, m: (calMes.m + 11) % 12 }; render(); return;
      case "cal-next": ev.preventDefault(); calMes = { y: calMes.m === 11 ? calMes.y + 1 : calMes.y, m: (calMes.m + 1) % 12 }; render(); return;
      case "cerrar-modal": ev.preventDefault(); U.cerrarModal(); return;
    }
  }

  function handleForm(a, form) {
    switch (a) {
      case "guardar-nota": { const txt = U.val("cs-nota-txt"); if (!txt) { U.toast("Escribe la nota", false); return; } S.addNota(form.dataset.id, txt, USER.nombre); modalCaso(form.dataset.id); U.toast("Nota guardada 🔒", true); return; }
      case "guardar-solicitud": { const persona = U.val("cs-ns-persona"); if (!persona) { U.toast("Escribe el nombre", false); return; } const c = S.addConsejeria({ persona, ministerio: U.val("cs-ns-min") || "—", tipo: U.val("cs-ns-tipo"), prioridad: U.val("cs-ns-prio"), motivo: U.val("cs-ns-motivo") || "—", consejero: MI_ID, estado: "asignada" }); U.cerrarModal(); render(); U.toast("Caso creado ✓", true); return; }
      case "guardar-cita": { const id = form.dataset.id; const c = S.consejeriaPorId(id); const fecha = U.val("cs-ag-fecha"), ini = U.val("cs-ag-ini"), fin = U.val("cs-ag-fin"), esp = U.val("cs-ag-esp"); if (!S.espacioLibre(esp, fecha, ini, fin)) { U.toast("Ese espacio no está libre a esa hora", false); return; } S.programar(id, fecha, esp); S.addEvento({ titulo: "Cita · " + (c ? c.persona : ""), fecha, horaInicio: ini, horaFin: fin, espacioId: esp, consejero: MI_ID, tipo: "cita", csId: id }); U.cerrarModal(); render(); U.toast("Cita agendada ✓", true); return; }
      case "guardar-evento": { const titulo = U.val("cs-ev-titulo"); if (!titulo) { U.toast("Escribe un título", false); return; } const fecha = U.val("cs-ev-fecha"), ini = U.val("cs-ev-ini"), fin = U.val("cs-ev-fin"), esp = U.val("cs-ev-esp"); if (!S.espacioLibre(esp, fecha, ini, fin)) { U.toast("Ese espacio no está libre a esa hora", false); return; } S.addEvento({ titulo, fecha, horaInicio: ini, horaFin: fin, espacioId: esp, consejero: MI_ID, tipo: "cita" }); U.cerrarModal(); render(); U.toast("Cita creada ✓", true); return; }
    }
  }

  function bindCSA() {
    const form = document.querySelector('form[data-accion="csa-enviar"]'); if (!form) return;
    form.addEventListener("submit", e => { e.preventDefault(); const inp = document.getElementById("csa-input"); const q = inp.value.trim(); if (!q) return; U.csaResponder(q); inp.value = ""; });
  }
  function bindConSearch() {
    const inp = document.getElementById("cs-con-search"); if (!inp) return;
    inp.addEventListener("input", () => { conQuery = inp.value.trim(); const pos = inp.selectionStart; render(); const n = document.getElementById("cs-con-search"); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } });
  }

  /* ---------- Kanban: arrastrar y soltar (binding por elemento) ---------- */
  function colLbl(id) { const c = S.columnasProceso().find(x => x.id === id); return c ? c.lbl : id; }
  function limpiarDrop() { (document.querySelectorAll(".cs-kan-col.is-drop") || []).forEach(x => x.classList.remove("is-drop")); }
  function bindKanban() {
    const cards = document.querySelectorAll(".cs-kan-card") || [];
    cards.forEach(card => {
      card.addEventListener("dragstart", e => {
        dragId = card.dataset.id; card.classList.add("is-dragging");
        if (e.dataTransfer) { e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", dragId); } catch (_) {} }
      });
      card.addEventListener("dragend", () => { card.classList.remove("is-dragging"); limpiarDrop(); });
    });
    const cols = document.querySelectorAll(".cs-kan-col") || [];
    cols.forEach(col => {
      const allow = e => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "move"; col.classList.add("is-drop"); };
      col.addEventListener("dragenter", allow);
      col.addEventListener("dragover", allow);
      col.addEventListener("dragleave", e => { if (!col.contains(e.relatedTarget)) col.classList.remove("is-drop"); });
      col.addEventListener("drop", e => {
        e.preventDefault(); e.stopPropagation(); col.classList.remove("is-drop");
        const id = dragId || (e.dataTransfer && e.dataTransfer.getData("text/plain"));
        const destino = col.dataset.col;
        if (id && destino) {
          const c = S.consejeriaPorId(id);
          if (c && (c.etapaProceso || "asignado") !== destino) {
            S.setEtapaProceso(id, destino); dragId = null; render();
            U.toast(`${c.persona.split(" ")[0]} → ${colLbl(destino)} ✓`, true);
            return;
          }
        }
        dragId = null;
      });
    });
  }

  /* ============================================================ RENDER */
  const VISTAS = { "mis-casos": vistaCasos, procesos: vistaProcesos, analitica: vistaAnalitica, conocimiento: vistaConocimiento, calendario: vistaCalendario };
  function render() {
    if (!sesion) { U.app().innerHTML = U.login({ titulo: "Consejería · Consejero", lead: "Acompaña de cerca a cada persona. Entra para ver tus casos asignados, registrar sesiones y notas, y consultar la base de conocimiento.", user: USER, logo: "CS" }); const g = document.getElementById("cs-google"); if (g) g.addEventListener("click", entrar); return; }
    (U.app()).innerHTML = (VISTAS[vista] || vistaAnalitica)() + U.fab();
    if (!clickBound) { document.addEventListener("click", manejar); document.addEventListener("submit", manejar); clickBound = true; }
    if (vista === "procesos") bindKanban();
    if (vista === "conocimiento") bindConSearch();
  }
  function entrar() { sesion = true; render(); U.toast(`¡Bienvenido, ${USER.nombre.split(" ")[0]}! 👋`, true); }

  if (S && S.onCambio) S.onCambio(() => { if (sesion) render(); });
  document.addEventListener("DOMContentLoaded", render);
  if (document.readyState !== "loading") render();
})();
