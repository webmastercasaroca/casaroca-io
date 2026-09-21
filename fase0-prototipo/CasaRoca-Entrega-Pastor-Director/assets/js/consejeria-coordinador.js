/* ============================================================
   CASA ROCA · APP DEL COORDINADOR DE CONSEJERÍA
   Demo: Natalia Cruz (cj_natalia, coordinadora). Gestiona el
   operativo: recibe solicitudes, las ASIGNA al consejero correcto,
   balancea la carga del equipo, ve la analítica del operativo,
   el calendario y la base de conocimiento.
   Estado compartido EN VIVO con consejeros y dirección.
   ============================================================ */
(function () {
  "use strict";
  const C = window.CONSE, S = window.CONSESTORE, U = window.CSUI;
  /* Motor compartido por COORDINADOR y DIRECTOR. La única diferencia:
     el director ALIMENTA la base de conocimiento (Conocimiento editable);
     el coordinador la consulta. El rol llega por window.CS_ROLE. */
  const ROLE = (window.CS_ROLE && window.CS_ROLE.user) || "coordinador";
  const ES_DIRECTOR = ROLE === "director";
  const USER = ES_DIRECTOR ? C.DIRECTOR_USER : C.COORDINADOR_USER;
  const conocEditable = ES_DIRECTOR;

  let sesion = false, vista = "analitica", clickBound = false;
  let filtroEstado = "todas", filtroTipo = "todos", calMes = null;
  let bandFiltro = "sin-asignar", bandQuery = "", crmQuery = "";
  let equipoQuery = "", equipoEsp = "todos", equipoMin = "todos";
  let ncVinculo = "voluntario", ncMin = ""; // formulario nuevo consejero
  /* Explorador = tabla dinámica: filas × columnas × medida + filtros */
  let expCfg = { filtros: {}, filas: "tipo", columnas: "", medida: "count", viz: "tabla", pctTotal: false, totales: true, ordenar: "valor" };

  const NAV = [
    { id: "analitica",   ico: "📊", lbl: "Analítica" },
    { id: "recordatorios", ico: "⏰", lbl: "Recordatorios" },
    { id: "bandeja",     ico: "📥", lbl: "Bandeja" },
    { id: "consejerias", ico: "🗂️", lbl: "Consejerías" },
    { id: "explorador",  ico: "📈", lbl: "Explorador" },
    { id: "equipo",      ico: "🤝", lbl: "Equipo" },
    { id: "calendario",  ico: "📅", lbl: "Calendario" },
    { id: "documentos",  ico: "📎", lbl: "Documentos" },
    { id: "conocimiento", ico: "📚", lbl: "Conocimiento" },
  ];
  const SHELL = { user: USER, nav: NAV, logo: "CS", sub: ES_DIRECTOR ? "Consejería · Dirección" : "Consejería · Coordinación" };

  /* tipo en texto compacto (para tablas, sin la “píldora” grande) */
  const tipoTxt = tid => { const t = C.tipo(tid); return `<span class="cs-tipo-txt" style="color:${t.color}">${t.emoji} ${U.esc(t.nombre)}</span>`; };
  /* cédula = llave/código única, derivada del correo (igual que el CRM general) */
  const ced = c => (window.CSCRM ? window.CSCRM.cedulaDe({ correo: c.correo, nombre: c.persona || c.nombre }) : (window.CEDULA ? window.CEDULA(c.correo || c.persona || c.nombre || "") : "—"));
  const telLink = t => { const w = String(t || "").replace(/\D/g, ""); return w ? `<a href="https://wa.me/${w}" target="_blank" rel="noopener">${U.esc(t)}</a>` : "—"; };
  const mailLink = m => m ? `<a href="mailto:${U.esc(m)}">${U.esc(m)}</a>` : "—";
  /* historial de consejerías de la misma persona (por correo/nombre) */
  const _norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  function historialDe(c) {
    const k = _norm(c.correo) || _norm(c.persona);
    const otras = S.consejerias().filter(x => x.id !== c.id && (_norm(x.correo) || _norm(x.persona)) === k);
    const previas = otras.filter(x => x.estado === "cerrada" || x.etapaProceso === "finalizado");
    return { otras, total: otras.length, previas: previas.length, previasArr: previas };
  }
  function recBadge(c) {
    const h = historialDe(c);
    return h.previas > 0
      ? `<span class="cs-rec-badge is-rec">🔁 ${h.previas} previa${h.previas > 1 ? "s" : ""}</span>`
      : `<span class="cs-rec-badge is-new">🆕 Nueva</span>`;
  }
  /* etapa del proceso (columna del Kanban del consejero) — refleja arrastres EN VIVO */
  function etapaProcChip(c) {
    const col = S.columnasProceso().find(x => x.id === (c.etapaProceso || "asignado")) || { ico: "📥", lbl: "Asignado", id: "asignado" };
    const cls = col.id === "finalizado" ? "is-fin" : col.id === "asignado" ? "is-asig" : "is-proc";
    return `<span class="cs-etapa ${cls}">${col.ico} ${U.esc(col.lbl)}</span>`;
  }

  /* ----- detalle del formulario web (solicitudes que llegan del público) ----- */
  function detalleFormulario(c) {
    const f = c.formulario;
    if (!f) return "";
    const li = (lbl, v) => v ? `<div class="cs-fw__row"><span class="cs-fw__k">${U.esc(lbl)}</span><span class="cs-fw__v">${U.esc(v)}</span></div>` : "";
    const lista = (lbl, arr) => (arr && arr.length) ? `<div class="cs-fw__row"><span class="cs-fw__k">${U.esc(lbl)}</span><span class="cs-fw__v">${arr.map(U.esc).join(", ")}</span></div>` : "";
    const banderas = [];
    if (c.menor) banderas.push(`<span class="cs-chip" style="background:var(--mostaza-100);color:var(--mostaza-800);border-color:var(--mostaza-300)">⚠️ Menor de edad · protección reforzada</span>`);
    if (c.riesgo === "alto") banderas.push(`<span class="cs-chip" style="background:var(--peligro-bg);color:var(--peligro);border-color:var(--peligro-borde)">🚨 Riesgo alto (eval. ${f.evaluacionPuntaje}/12)</span>`);
    else if (c.riesgo === "medio") banderas.push(`<span class="cs-chip">Riesgo medio (eval. ${f.evaluacionPuntaje}/12)</span>`);
    if (c.modalidad) banderas.push(`<span class="cs-chip">${c.modalidad === "virtual" ? "💻 Virtual" : "🏛️ Presencial"}</span>`);
    const evalHtml = (f.evaluacion || []).map(e => `<div class="cs-fw__eval"><p>${U.esc(e.pregunta)}</p><b>${U.esc(e.respuesta || "—")}</b></div>`).join("");
    return `
      <details class="cs-fw" open>
        <summary>📝 Detalle del formulario web (${U.esc(c.origen || "Solicitud")})</summary>
        ${banderas.length ? `<div class="cs-caso__meta" style="margin:10px 0">${banderas.join(" ")}</div>` : ""}
        ${li("Carácter", f.caracter)}
        ${li("Tema indicado", f.tema)}
        ${li("Quién asiste", f.quienAsiste)}
        ${li("Rango de edad", f.rangoEdad)}
        ${li("Estado civil", f.estadoCivil)}
        ${li("¿Se congrega aquí?", f.congrega)}
        ${li("Ciudad / sede", f.ciudad)}
        ${li("Tiempo asistiendo", f.tiempoAsistencia)}
        ${lista("Ministerios", f.ministerios)}
        ${lista("Voluntariado", f.voluntariado)}
        ${lista("Procesos de crecimiento", f.procesos)}
        ${li("Modalidad solicitada", f.modalidad)}
        ${f.algoImportante ? `<div class="cs-fw__row"><span class="cs-fw__k">Algo importante</span><span class="cs-fw__v">${U.esc(f.algoImportante)}</span></div>` : ""}
        ${(f.contactoNombre || f.contactoTel) ? `<div class="cs-fw__row"><span class="cs-fw__k">Contacto adicional</span><span class="cs-fw__v">${U.esc(f.contactoNombre || "—")} · ${U.esc(f.contactoTel || "—")}</span></div>` : ""}
        ${evalHtml ? `<div class="cs-fw__evalwrap"><p class="cs-fw__k" style="margin:10px 0 4px">Evaluación (últimas 4 semanas)</p>${evalHtml}</div>` : ""}
        <div class="cs-fw__row"><span class="cs-fw__k">Consentimiento informado</span><span class="cs-fw__v">${f.consentimiento ? "✅ Aceptado" : "—"}</span></div>
      </details>`;
  }

  /* ----- carga de cada consejero (casos abiertos / capacidad) ----- */
  function cargaDe(cjId) {
    const cj = S.equipoPorId(cjId) || C.consejero(cjId) || { capacidad: 6 };
    const abiertos = S.deConsejero(cjId).filter(c => c.estado !== "cerrada").length;
    return { abiertos, cap: cj.capacidad || 6, pct: U.pct(abiertos, cj.capacidad || 6) };
  }
  /* mejor sugerencia para una solicitud: activo + disponible, con especialidad, menor carga */
  function sugeridos(cs) {
    return S.equipo().filter(c => c.activo).map(c => {
      const match = (c.especialidades || []).includes(cs.tipo);
      const cg = cargaDe(c.id);
      const disp = c.disponible !== false;
      return { c, match, cg, disp, score: (match ? 100 : 0) + (disp ? 20 : 0) - cg.pct };
    }).sort((a, b) => b.score - a.score);
  }

  /* ============================================================ 1. BANDEJA (lista de solicitudes con columnas) */
  function vistaBandeja() {
    const all = S.consejerias();
    const sinAsig = S.solicitudes();
    let items = bandFiltro === "sin-asignar" ? sinAsig.slice() : all.slice();
    if (bandQuery) { const q = bandQuery.toLowerCase(); items = items.filter(c => (c.persona + " " + c.correo + " " + c.ministerio + " " + (c.tel || "")).toLowerCase().includes(q)); }
    items.sort((a, b) => (b.prioridad === "alta" ? 1 : 0) - (a.prioridad === "alta" ? 1 : 0) || b.desde.localeCompare(a.desde));

    const espera = sinAsig.length ? Math.round(sinAsig.reduce((s, c) => s + U.diasDesde(c.desde), 0) / sinAsig.length) : 0;
    return U.shell(SHELL, U.head(
      "Bandeja de solicitudes",
      "Todas las solicitudes de consejería que llegan (hoy desde el formulario) entran aquí como lista. <b>Asignar una persona aquí la coloca en la primera columna del proceso (Kanban) del consejero.</b>",
      `<button class="dr-btn dr-btn--primary" data-accion="nueva-solicitud">＋ Nueva solicitud</button>`
    ) + `
      <div class="dr-kpis" style="margin-bottom:16px">
        ${U.kpi(sinAsig.length, "Sin asignar", sinAsig.length > 0)}
        ${U.kpi(sinAsig.filter(c => c.prioridad === "alta").length, "Prioridad alta", sinAsig.some(c => c.prioridad === "alta"))}
        ${U.kpi(espera + "d", "Espera promedio", espera > 4)}
        ${U.kpi(S.equipo().filter(c => c.activo).length, "Consejeros activos")}
      </div>
      <div class="dr-filtros" style="align-items:center">
        <button class="dr-filtro ${bandFiltro === "sin-asignar" ? "is-active" : ""}" data-accion="band-filtro" data-f="sin-asignar">Sin asignar (${sinAsig.length})</button>
        <button class="dr-filtro ${bandFiltro === "todas" ? "is-active" : ""}" data-accion="band-filtro" data-f="todas">Todas (${all.length})</button>
        <input id="cs-band-search" class="dr-search" placeholder="Buscar por nombre, correo, teléfono…" value="${U.esc(bandQuery)}" style="max-width:280px">
      </div>
      <div class="dr-card" style="overflow-x:auto">
        <table class="dr-table cs-tabla-bandeja">
          <thead><tr>
            <th>Persona</th><th>Teléfono</th><th>Correo</th><th>Edad</th><th>Género</th>
            <th>Ministerio</th><th>Tipo</th><th>Motivo</th><th>Solicitó</th><th>Prioridad</th><th>Estado / Consejero</th><th></th>
          </tr></thead>
          <tbody>${items.map(filaBandeja).join("") || `<tr><td colspan="12"><div class="dr-empty" style="padding:18px">🎉 Sin solicitudes en este filtro.</div></td></tr>`}</tbody>
        </table>
      </div>
    `, vista);
  }

  function filaBandeja(c) {
    const wa = String(c.tel || "").replace(/\D/g, "");
    const cj = c.consejero ? (C.consejero(c.consejero) || {}) : null;
    const sug = !cj ? sugeridos(c)[0] : null;
    return `<tr>
      <td><button class="cs-persona-link" data-accion="ver-registro" data-id="${c.id}" title="Ver todo el registro"><b>${U.esc(c.persona)}</b>${recBadge(c)}</button></td>
      <td>${wa ? `<a href="https://wa.me/${wa}" target="_blank" rel="noopener">${U.esc(c.tel)}</a>` : "—"}</td>
      <td>${c.correo ? `<a href="mailto:${U.esc(c.correo)}">${U.esc(c.correo)}</a>` : "—"}</td>
      <td>${c.edad || "—"}</td>
      <td>${c.genero === "F" ? "Mujer" : c.genero === "M" ? "Hombre" : "—"}</td>
      <td>${U.esc(c.ministerio)}</td>
      <td>${tipoTxt(c.tipo)}</td>
      <td style="max-width:200px"><span title="${U.esc(c.motivo)}" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${U.esc(c.motivo)}</span></td>
      <td>${U.fechaCorta(c.desde)}<br><small style="color:var(--texto-tenue)">hace ${U.diasDesde(c.desde)}d</small></td>
      <td>${U.prioChip(c.prioridad)}</td>
      <td>${cj ? `${U.estadoChip(c.estado)}<br><small>${U.esc(cj.nombre.split(" ")[0])}</small>` : U.estadoChip(c.estado)}</td>
      <td style="text-align:right;white-space:nowrap">
        <button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="ver-registro" data-id="${c.id}">Ver registro</button>
        ${!cj ? `${sug ? `<button class="dr-btn dr-btn--primary dr-btn--sm" data-accion="asignar-rapido" data-id="${c.id}" data-cj="${sug.c.id}" title="Sugerido: ${U.esc(sug.c.nombre)}${sug.match ? " (especialista)" : ""}">→ ${U.esc(sug.c.nombre.split(" ")[0])}</button> ` : ""}<button class="dr-btn dr-btn--sm" data-accion="asignar" data-id="${c.id}">Asignar…</button>` : `<button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="gestionar" data-id="${c.id}">Gestionar</button>`}
      </td>
    </tr>`;
  }

  function modalAsignar(id) {
    const c = S.consejeriaPorId(id); if (!c) return;
    const lista = sugeridos(c);
    U.abrirModal(`
      <div class="dr-modal__head"><div><h3 id="cs-modal-t">Asignar consejero · ${U.esc(c.persona)}</h3>
      <p class="dr-card__sub">${U.tipoChip(c.tipo)} ${U.prioChip(c.prioridad)} — elige el mejor perfil.</p></div></div>
      <div class="cs-mini" style="margin-bottom:12px">
        ${lista.map(s => `<div class="cs-mini__row">
          <div><b>${U.esc(s.c.nombre)}</b><p>${(s.c.especialidades || []).map(e => C.tipo(e).nombre).join(" · ")}</p>
          <small>${s.cg.abiertos}/${s.cg.cap} casos · ${s.cg.pct}% carga ${s.match ? "· ⭐ especialista en este tema" : ""}</small></div>
          <button class="dr-btn ${s.match ? "dr-btn--primary" : ""} dr-btn--sm" data-accion="asignar-rapido" data-id="${id}" data-cj="${s.c.id}">Asignar</button>
        </div>`).join("")}
      </div>
      <div class="dr-modal__acts"><button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button></div>
    `);
  }

  /* registro COMPLETO (clic en la persona o "Ver registro") */
  function modalRegistro(id) {
    const c = S.consejeriaPorId(id); if (!c) return;
    const h = historialDe(c);
    const cj = c.consejero ? (S.equipoPorId(c.consejero) || {}) : null;
    const wa = String(c.tel || "").replace(/\D/g, "");
    const previasHTML = h.previasArr.length
      ? h.previasArr.map(p => `<div class="cs-mini__row"><div><b>${U.esc(C.tipo(p.tipo).nombre)}</b><p>${U.esc((S.equipoPorId(p.consejero) || {}).nombre || "Sin asignar")} · ${p.sesiones || 0} sesiones${p.resultadoCierre ? " · " + U.esc(p.resultadoCierre) : ""}</p></div>${U.estadoChip(p.estado)}</div>`).join("")
      : `<div class="dr-empty" style="padding:12px">No ha tenido consejerías anteriores.</div>`;
    U.abrirModal(`
      <div class="dr-modal__head"><div class="cs-caso__ava" style="width:46px;height:46px">${U.esc(U.iniciales(c.persona))}</div>
        <div><h3 id="cs-modal-t">${U.esc(c.persona)}</h3><p class="dr-card__sub">${C.tipo(c.tipo).emoji} ${U.esc(C.tipo(c.tipo).nombre)} · ${U.esc(c.ministerio || "—")}</p></div></div>
      <div class="cs-caso__meta" style="margin-bottom:10px">
        ${h.previas > 0 ? `<span class="cs-rec-badge is-rec">🔁 Recurrente · ${h.previas} anterior${h.previas > 1 ? "es" : ""}</span>` : `<span class="cs-rec-badge is-new">🆕 Primera consejería</span>`}
        ${U.estadoChip(c.estado)} ${U.prioChip(c.prioridad)} <span class="cs-chip">${c.sesiones || 0} sesiones</span>
      </div>
      <div class="cs-contact-row">
        ${wa ? `<a class="cs-wa" href="https://wa.me/${wa}" target="_blank" rel="noopener">💬 WhatsApp</a>` : ""}
        ${c.correo ? `<a class="cs-mail" href="mailto:${U.esc(c.correo)}">✉️ ${U.esc(c.correo)}</a>` : ""}
      </div>
      <div class="cs-hv__meta">${U.esc(c.tel || "")}${c.edad ? ` · ${c.edad} años` : ""}${c.genero ? ` · ${c.genero === "F" ? "Mujer" : "Hombre"}` : ""}</div>
      <p class="cs-caso__motivo" style="margin:10px 0 12px">${U.esc(c.motivo || "—")}</p>
      ${detalleFormulario(c) || `<div class="dr-empty" style="padding:12px">Registro general (sin formulario web detallado).</div>`}
      <div class="cs-hv__grp" style="margin-top:14px">Consejerías anteriores <span class="cs-hv__count">${h.previas}</span></div>
      <div class="cs-mini">${previasHTML}</div>
      <div class="dr-modal__acts">
        ${!cj ? `<button class="dr-btn dr-btn--primary" data-accion="asignar" data-id="${c.id}">Asignar consejero…</button>` : `<button class="dr-btn dr-btn--primary" data-accion="gestionar" data-id="${c.id}">Gestionar</button>`}
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cerrar</button>
      </div>
    `);
  }

  /* pre-selección de formularios según el tipo/carácter del caso */
  function preseleccionForms(c) {
    const ids = new Set();
    const car = (c.formulario && c.formulario.caracter) || "";
    if (c.menor || /menor/i.test(car)) ids.add("doc_f_men");
    if (c.tipo === "pareja" || /pareja|matrimon|noviazgo/i.test(car)) ids.add("doc_f_par");
    if (c.tipo === "familiar" || /familiar/i.test(car)) ids.add("doc_f_fam");
    if (!ids.size) ids.add("doc_f_ind");
    return ids;
  }
  /* paso: elegir formularios a enviar + vista previa del correo */
  function modalEnviarFormularios(csId, cjId) {
    const c = S.consejeriaPorId(csId); if (!c) return;
    const cj = S.equipoPorId(cjId); if (!cj) { U.toast("Consejero no encontrado", false); return; }
    const forms = S.formularios();
    const pre = preseleccionForms(c);
    const previewCorreo = S.componerCorreoAsignacion(c, cj);
    U.abrirModal(`
      <div class="dr-modal__head"><div><h3 id="cs-modal-t">Asignar y enviar formularios</h3>
        <p class="dr-card__sub">Asignar <b>${U.esc(c.persona)}</b> a <b>${U.esc(cj.nombre)}</b>. Elige los formularios de admisión que se adjuntan al correo (pueden ser varios).</p></div></div>
      <div class="cs-formsel">
        ${forms.map(f => `<label class="cs-formsel__item"><input type="checkbox" class="cs-form-chk" value="${f.id}" ${pre.has(f.id) ? "checked" : ""}><span><b>${U.esc(f.nombre.replace("Formulario de admisión · ", ""))}</b><small>${U.esc(f.desc)}</small></span></label>`).join("")}
      </div>
      <details class="cs-mailprev"><summary>👁️ Vista previa del correo a la persona (muestra el consejero y su teléfono)</summary><pre class="cs-mailprev__body">${U.esc(previewCorreo)}</pre></details>
      <div class="cs-mailnote">Al confirmar se envía automáticamente: <b>1 correo a la persona</b> (con los formularios) y <b>1 correo al consejero</b> (nuevo caso). El caso pasa a la columna <b>Asignado</b> del consejero.</div>
      <div class="dr-modal__acts">
        <button class="dr-btn dr-btn--primary" data-accion="confirmar-asignacion" data-id="${csId}" data-cj="${cjId}">Confirmar asignación y enviar</button>
        <button class="dr-btn dr-btn--ghost" data-accion="asignar" data-id="${csId}">← Elegir otro consejero</button>
      </div>
    `);
  }
  /* confirmación con la vista de los correos enviados */
  function modalAsignacionOk(csId) {
    const c = S.consejeriaPorId(csId); if (!c) return;
    const cj = c.consejero ? S.equipoPorId(c.consejero) : null;
    const envs = S.enviosDe(csId).slice(0, 2);
    U.abrirModal(`
      <div class="dr-modal__head"><div><h3 id="cs-modal-t">✅ Asignado y notificado</h3>
        <p class="dr-card__sub">${U.esc(c.persona)} → <b>${U.esc(cj ? cj.nombre : "")}</b>. Se enviaron los correos automáticos.</p></div></div>
      ${envs.map(e => `<details class="cs-mailprev" ${e.tipo === "asignacion-persona" ? "open" : ""}><summary>✉️ ${e.tipo === "asignacion-persona" ? "Correo a la persona" : "Correo al consejero"} · ${U.esc(e.para || "—")}${e.adjuntos && e.adjuntos.length ? ` · ${e.adjuntos.length} adjunto(s)` : ""}</summary><pre class="cs-mailprev__body">${U.esc(e.cuerpo)}</pre></details>`).join("")}
      <div class="dr-modal__acts"><button class="dr-btn dr-btn--primary" data-accion="cerrar-modal">Listo</button></div>
    `);
  }

  function modalNuevaSolicitud(pre) {
    pre = pre || {};
    const enCRM = !!(pre.nombre);
    U.abrirModal(`
      <div class="dr-modal__head"><div><h3 id="cs-modal-t">Nueva solicitud de consejería</h3><p class="dr-card__sub">${enCRM ? "Para una persona ya existente en el CRM — no se duplica." : "Si la persona no está en el CRM, se agrega al directorio general sin duplicar."}</p></div></div>
      <form data-accion="guardar-solicitud">
        <label class="dr-field"><span>Persona</span><input id="cs-ns-persona" class="dr-input" placeholder="Nombre" value="${U.esc(pre.nombre || "")}" ${enCRM ? "readonly" : ""}></label>
        <div class="dr-grid2">
          <label class="dr-field"><span>Correo</span><input id="cs-ns-correo" class="dr-input" type="email" placeholder="correo@email.com" value="${U.esc(pre.correo || "")}"></label>
          <label class="dr-field"><span>Teléfono</span><input id="cs-ns-tel" class="dr-input" placeholder="+57 …" value="${U.esc(pre.telefono || "")}"></label>
        </div>
        <div class="dr-grid2">
          <label class="dr-field"><span>Edad</span><input id="cs-ns-edad" class="dr-input" type="number" min="0" max="120" value="${pre.edad || ""}"></label>
          <label class="dr-field"><span>Género</span><select id="cs-ns-genero" class="dr-select"><option value="F" ${pre.genero === "F" ? "selected" : ""}>Mujer</option><option value="M" ${pre.genero !== "F" ? "selected" : ""}>Hombre</option></select></label>
        </div>
        <label class="dr-field"><span>Ministerio / sede</span><input id="cs-ns-min" class="dr-input" placeholder="Ej. Mujer Integral" value="${U.esc(pre.grupo || "")}"></label>
        <div class="dr-grid2">
          <label class="dr-field"><span>Tipo</span><select id="cs-ns-tipo" class="dr-select">${C.TIPOS.map(t => `<option value="${t.id}">${t.emoji} ${t.nombre}</option>`).join("")}</select></label>
          <label class="dr-field"><span>Prioridad</span><select id="cs-ns-prio" class="dr-select">${C.PRIORIDADES.map(p => `<option value="${p.id}" ${p.id === "media" ? "selected" : ""}>${p.nombre}</option>`).join("")}</select></label>
        </div>
        <label class="dr-field"><span>Motivo</span><textarea id="cs-ns-motivo" class="dr-input" rows="2" placeholder="Breve descripción"></textarea></label>
        <div class="dr-modal__acts">
          <button type="submit" class="dr-btn dr-btn--primary">Crear solicitud</button>
          <button type="button" class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
        </div>
      </form>
    `);
  }

  /* ============================================================ 2. CONSEJERÍAS (todas) + BUSCADOR CRM */
  function vistaConsejerias() {
    let items = S.consejerias();
    if (filtroEstado !== "todas") items = items.filter(c => c.estado === filtroEstado);
    if (filtroTipo !== "todos") items = items.filter(c => c.tipo === filtroTipo);
    items.sort((a, b) => b.desde.localeCompare(a.desde));
    const filasEstado = [{ id: "todas", lbl: "Todas" }].concat(C.ESTADOS.map(e => ({ id: e.id, lbl: e.nombre })));

    /* buscador del CRM general (personas de toda la iglesia) */
    const CRM = window.CSCRM;
    const totalPersonas = CRM ? CRM.personas().length : 0;
    const resultados = (CRM && crmQuery) ? CRM.buscar(crmQuery) : [];
    const crmBox = `
      <div class="cs-crm">
        <div class="cs-crm__head">
          <div><b>🔎 Buscar en el CRM de la iglesia</b><small>Conectado al directorio general · ${totalPersonas} persona(s). Escribe un nombre, correo o teléfono.</small></div>
          <span class="cs-crm__sync">⟲ Sincronizado</span>
        </div>
        <input id="cs-crm-search" class="dr-search" placeholder="Buscar persona por nombre, correo o teléfono…" value="${U.esc(crmQuery)}" autocomplete="off" style="width:100%">
        ${crmQuery ? `<div class="cs-crm__res">
          ${resultados.length ? resultados.slice(0, 20).map(p => `
            <button class="cs-crm__row" data-accion="ver-persona" data-key="${U.esc(p.key)}">
              <span class="cs-crm__ava">${U.esc(U.iniciales(p.nombre))}</span>
              <span class="cs-crm__info"><b>${U.esc(p.nombre)}</b><small>${U.esc(p.correo || p.telefono || "—")} · ${U.esc(p.grupo)}</small></span>
              ${p.enIglesia ? `<span class="cs-crm__badge is-ig">⛪ En la iglesia</span>` : `<span class="cs-crm__badge">Solo consejería</span>`}
              ${(p.consejerias || []).length ? `<span class="cs-crm__badge is-cs">${(p.consejerias || []).length} consejería(s)</span>` : ""}
            </button>`).join("") : `<div class="dr-empty" style="padding:16px">Sin coincidencias para “${U.esc(crmQuery)}”.</div>`}
        </div>` : ""}
      </div>`;

    return U.shell(SHELL, U.head("Consejerías y CRM", "Busca a cualquier persona del CRM general y abre su ficha completa. Abajo, todas las consejerías del operativo.", "") + `
      ${crmBox}
      <div class="dr-filtros">
        ${filasEstado.map(f => `<button class="dr-filtro ${filtroEstado === f.id ? "is-active" : ""}" data-accion="f-estado" data-f="${f.id}">${f.lbl}</button>`).join("")}
      </div>
      <div class="dr-filtros">
        <button class="dr-filtro ${filtroTipo === "todos" ? "is-active" : ""}" data-accion="f-tipo" data-f="todos">Todos los tipos</button>
        ${C.TIPOS.map(t => `<button class="dr-filtro ${filtroTipo === t.id ? "is-active" : ""}" data-accion="f-tipo" data-f="${t.id}">${t.emoji} ${t.nombre.split(" ")[0]}</button>`).join("")}
      </div>
      <div class="dr-card" style="overflow-x:auto">
        <table class="dr-table cs-tabla-crm">
          <thead><tr><th>Persona</th><th>Edad</th><th>Género</th><th>Teléfono</th><th>Correo</th><th>Tipo</th><th>Consejero</th><th>Etapa del proceso</th><th>Estado</th><th>Prioridad</th><th>Ses.</th><th>Última interacción</th><th></th></tr></thead>
          <tbody>${items.map(filaConsejeria).join("") || `<tr><td colspan="13"><div class="dr-empty" style="padding:18px">Sin resultados.</div></td></tr>`}</tbody>
        </table>
      </div>
    `, vista);
  }

  /* ficha 360° de la persona — leída del CRM general (sin diezmo) */
  function modalPersona360(key) {
    const CRM = window.CSCRM; if (!CRM) return;
    const p = CRM.porKey(key); if (!p) return;
    const wa = String(p.telefono || "").replace(/\D/g, "");
    const cdl = p.cedula || (window.CEDULA ? window.CEDULA(p.correo || p.nombre) : "—");
    const cursoEstado = est => est === "ok" || est === "completo" ? `<span class="cs-fitem__s" style="color:var(--exito);background:var(--exito-bg)">Completo</span>` : est === "curso" ? `<span class="cs-fitem__s" style="color:var(--mostaza-800);background:var(--mostaza-100)">En curso</span>` : `<span class="cs-fitem__s" style="color:var(--texto-tenue);background:var(--superficie-2)">Pendiente</span>`;
    const cursosKeys = ["adn", "bautizo", "madurez", "llaves", "ibli", "facter"];
    const cursosHTML = cursosKeys.map(k => `<div class="cs-fitem"><span class="cs-fitem__n">${U.esc(CRM.CURSO_LBL[k])}</span>${cursoEstado((p.cursos || {})[k])}</div>`).join("");
    const cons = CRM.consejeriasDe(p);
    const etapa = p.etapa ? (CRM.ETAPA_LBL[p.etapa] || p.etapa) : "—";
    /* ¿es una persona nueva en consejería o recurrente? */
    const esCerrada = c => c.estado === "cerrada" || c.etapaProceso === "finalizado";
    const previas = cons.filter(esCerrada);
    const enCurso = cons.filter(c => !esCerrada(c));
    const esNueva = previas.length === 0;
    const ultima = previas.slice().sort((a, b) => String(b.fechaAsig || b.desde || "").localeCompare(String(a.fechaAsig || a.desde || "")))[0];
    const recBadge = esNueva
      ? `<span class="cs-hv__state is-on" style="background:var(--exito-bg);color:var(--exito)">🆕 Primera consejería</span>`
      : `<span class="cs-hv__state" style="background:var(--mostaza-100,#FDF4DE);color:var(--mostaza-800,#A86E12)">🔁 Recurrente · ${previas.length} anterior${previas.length > 1 ? "es" : ""}</span>`;
    const recBanner = esNueva
      ? `<div class="cs-rec" style="margin:10px 0 0;padding:11px 13px;border-radius:11px;background:var(--exito-bg);border:1px solid var(--exito);color:var(--exito);font-size:.86rem;line-height:1.4">✨ <b>Consejería nueva.</b> Es la primera vez que esta persona solicita acompañamiento en consejería.</div>`
      : `<div class="cs-rec" style="margin:10px 0 0;padding:11px 13px;border-radius:11px;background:var(--mostaza-100,#FDF4DE);border:1px solid var(--mostaza-500,#E3A52C);color:var(--mostaza-800,#A86E12);font-size:.86rem;line-height:1.4">🔁 <b>Persona recurrente.</b> Ya ha tenido <b>${previas.length}</b> consejería${previas.length > 1 ? "s" : ""} anterior${previas.length > 1 ? "es" : ""}${ultima ? ` · la última: ${U.esc(C.tipo(ultima.tipo).nombre)}${ultima.resultadoCierre ? " (" + U.esc(ultima.resultadoCierre) + ")" : ""}` : ""}.${enCurso.length ? ` Tiene <b>${enCurso.length}</b> en curso.` : ""}</div>`;
    const filaMini = c => `<div class="cs-mini__row"><div><b>${U.esc(C.tipo(c.tipo).nombre)}</b><p>${U.esc((C.consejero(c.consejero) || {}).nombre || "Sin asignar")} · ${c.sesiones || 0} sesiones${c.resultadoCierre ? " · " + U.esc(c.resultadoCierre) : ""}</p></div>${U.estadoChip(c.estado)}</div>`;

    U.abrirModal(`
      <div class="cs-hv__hero">
        <div class="cs-hv__ava">${U.esc(U.iniciales(p.nombre))}</div>
        <div class="cs-hv__id">
          <h3 id="cs-modal-t">${U.esc(p.nombre)}</h3>
          <p>${U.esc(p.grupo)} · ${U.esc(p.sede)}</p>
          <div class="cs-hv__tags">${p.enIglesia ? `<span class="cs-hv__state is-on">⛪ En la iglesia</span>` : `<span class="cs-hv__state is-off">Solo consejería</span>`}${recBadge}<span class="cs-hv__cert">Recorrido: ${U.esc(etapa)}</span></div>
        </div>
        <div class="cs-hv__kpis"><div class="cs-hv__kpi"><b>${cons.length}</b><span>Consejerías</span></div><div class="cs-hv__kpi"><b>${previas.length}</b><span>Anteriores</span></div></div>
      </div>
      <div class="cs-crm__priv">🔒 CRM general sincronizado · el <b>diezmo</b> no es visible para coordinación/consejería.</div>
      ${recBanner}
      <div class="cs-hv__body">
        <div class="cs-hv__col">
          <div class="cs-hv__grp">Datos</div>
          <dl class="cs-kv">
            <div><dt>Edad · Género</dt><dd>${p.edad || "—"}${p.edad ? " años" : ""} · ${p.genero === "F" ? "Mujer" : p.genero === "M" ? "Hombre" : "—"}</dd></div>
            <div><dt>Estado civil</dt><dd>${U.esc(p.estadoCivil || "—")}</dd></div>
            <div><dt>Recorrido (4C)</dt><dd>${U.esc(etapa)}</dd></div>
          </dl>
          <div class="cs-hv__grp">Contacto</div>
          <div class="cs-contact-row">
            ${wa ? `<a class="cs-wa" href="https://wa.me/${wa}" target="_blank" rel="noopener"><svg viewBox="0 0 32 32" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M16 3C9.4 3 4 8.4 4 15c0 2.1.6 4.2 1.6 6L4 29l8.2-1.6c1.7.9 3.7 1.4 5.8 1.4 6.6 0 12-5.4 12-12S22.6 3 16 3z"/></svg>WhatsApp</a>` : ""}
            ${p.correo ? `<a class="cs-mail" href="mailto:${U.esc(p.correo)}"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm9 7L4 7v1l8 5 8-5V7l-8 5z"/></svg>Correo</a>` : ""}
          </div>
          <div class="cs-hv__meta">${U.esc(p.telefono || "")}<br>${U.esc(p.correo || "")}</div>
        </div>
        <div class="cs-hv__col">
          <div class="cs-hv__grp">🎓 Crecimiento ${p.enIglesia ? "" : `<span class="cs-hv__count">no registrada en la iglesia</span>`}</div>
          <div class="cs-flist">${cursosHTML}</div>
          <div class="cs-hv__grp">Consejería actual ${enCurso.length ? `<span class="cs-hv__count">${enCurso.length}</span>` : ""}</div>
          <div class="cs-mini">
            ${enCurso.length ? enCurso.map(filaMini).join("") : `<div class="dr-empty" style="padding:12px">Sin consejería activa ahora.</div>`}
          </div>
          <div class="cs-hv__grp">Historial anterior ${previas.length ? `<span class="cs-hv__count">${previas.length}</span>` : ""}</div>
          <div class="cs-mini">
            ${previas.length ? previas.map(filaMini).join("") : `<div class="dr-empty" style="padding:12px">No ha tenido consejerías anteriores.</div>`}
          </div>
        </div>
      </div>
      <div class="dr-modal__acts">
        <button class="dr-btn dr-btn--primary" data-accion="nueva-para" data-key="${U.esc(key)}">＋ Nueva consejería para esta persona</button>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cerrar</button>
      </div>
    `);
  }

  /* última interacción del consejero con el caso (para vigilar seguimiento) */
  function ultimaInteraccionTxt(c) {
    if (!c.ultimaInteraccion) return `<span style="color:var(--texto-tenue)">— sin registro —</span>`;
    const dias = U.diasDesde(String(c.ultimaInteraccion).slice(0, 10));
    const stale = dias > 7 && c.estado !== "cerrada";
    const lbl = dias <= 0 ? "hoy" : dias === 1 ? "ayer" : `hace ${dias}d`;
    return `<span class="cs-lastint ${stale ? "is-stale" : dias > 3 ? "is-warn" : "is-ok"}" title="${String(c.ultimaInteraccion).slice(0, 10)}">${stale ? "⚠️ " : ""}${lbl}</span>`;
  }
  function filaConsejeria(c) {
    const cj = c.consejero ? (S.equipoPorId(c.consejero) || C.consejero(c.consejero) || {}) : null;
    return `<tr>
      <td><button class="cs-persona-link" data-accion="ver-registro" data-id="${c.id}" title="Ver todo el registro"><b>${U.esc(c.persona)}</b></button><br><small style="color:var(--texto-tenue)">${U.esc(c.ministerio)}</small></td>
      <td>${c.edad || "—"}</td>
      <td>${c.genero === "F" ? "Mujer" : c.genero === "M" ? "Hombre" : "—"}</td>
      <td>${telLink(c.tel)}</td>
      <td>${mailLink(c.correo)}</td>
      <td>${tipoTxt(c.tipo)}</td>
      <td>${cj && cj.nombre ? U.esc(cj.nombre) : `<span style="color:var(--texto-tenue)">— sin asignar —</span>`}</td>
      <td>${etapaProcChip(c)}</td>
      <td>${U.estadoChip(c.estado)}</td>
      <td>${U.prioChip(c.prioridad)}</td>
      <td>${c.sesiones}</td>
      <td>${ultimaInteraccionTxt(c)}</td>
      <td style="text-align:right;white-space:nowrap">
        <button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="gestionar" data-id="${c.id}">Gestionar</button>
      </td>
    </tr>`;
  }

  function modalGestionar(id) {
    const c = S.consejeriaPorId(id); if (!c) return;
    const cj = c.consejero ? (C.consejero(c.consejero) || {}) : null;
    U.abrirModal(`
      <div class="dr-modal__head"><div class="cs-caso__ava" style="width:46px;height:46px">${U.esc(U.iniciales(c.persona))}</div>
        <div><h3 id="cs-modal-t">${U.esc(c.persona)}</h3><p class="dr-card__sub">${C.tipo(c.tipo).emoji} ${U.esc(C.tipo(c.tipo).nombre)} · ${U.esc(c.ministerio)}</p></div></div>
      <div class="cs-caso__meta" style="margin-bottom:12px">${etapaProcChip(c)} ${U.estadoChip(c.estado)} ${U.prioChip(c.prioridad)} <span class="cs-chip">${c.sesiones} sesiones</span>
        ${(c.tel || c.correo) ? `<span class="cs-chip">${c.tel ? "📞 " + U.esc(c.tel) : ""}${c.tel && c.correo ? " · " : ""}${c.correo ? "✉️ " + U.esc(c.correo) : ""}</span>` : ""}</div>
      <p class="cs-caso__motivo" style="margin-bottom:14px">${U.esc(c.motivo)}</p>
      ${detalleFormulario(c)}

      <label class="dr-field"><span>Consejero asignado</span>
        <select id="cs-g-cj" class="dr-select">
          <option value="">— sin asignar —</option>
          ${S.equipo().filter(x => x.activo || x.id === c.consejero).map(x => `<option value="${x.id}" ${x.id === c.consejero ? "selected" : ""}>${x.nombre}${(x.especialidades || []).includes(c.tipo) ? " ⭐" : ""} (${cargaDe(x.id).abiertos}/${cargaDe(x.id).cap})</option>`).join("")}
        </select></label>
      <div class="dr-grid2">
        <label class="dr-field"><span>Estado</span><select id="cs-g-estado" class="dr-select">${C.ESTADOS.map(e => `<option value="${e.id}" ${e.id === c.estado ? "selected" : ""}>${e.nombre}</option>`).join("")}</select></label>
        <label class="dr-field"><span>Prioridad</span><select id="cs-g-prio" class="dr-select">${C.PRIORIDADES.map(p => `<option value="${p.id}" ${p.id === c.prioridad ? "selected" : ""}>${p.nombre}</option>`).join("")}</select></label>
      </div>
      <div class="dr-modal__acts">
        <button class="dr-btn dr-btn--primary" data-accion="guardar-gestion" data-id="${id}">Guardar cambios</button>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
      </div>
    `);
  }

  /* ============================================================ 3. EQUIPO */
  function vinculoChip(c) {
    return c.tipoVinculo === "planta"
      ? `<span class="cs-vinc cs-vinc--planta">🏛️ Planta</span>`
      : `<span class="cs-vinc cs-vinc--vol">🙌 Voluntario</span>`;
  }
  function vistaEquipo() {
    let eq = S.equipo();
    // filtros
    const q = equipoQuery.toLowerCase();
    if (q) eq = eq.filter(c => (c.nombre + " " + (c.ministerio || "") + " " + (c.especialidades || []).map(e => C.tipo(e).nombre).join(" ")).toLowerCase().includes(q));
    if (equipoEsp !== "todos") eq = eq.filter(c => (c.especialidades || []).includes(equipoEsp));
    if (equipoMin !== "todos") eq = eq.filter(c => c.ministerio === equipoMin);
    const total = S.equipo();
    const mins = Array.from(new Set(total.map(c => c.ministerio).filter(Boolean))).sort();

    return U.shell(SHELL, U.head("Equipo de consejeros",
      "Consejeros de <b>planta</b> y <b>voluntarios</b>, sincronizados con el CRM central de la iglesia. <b>Haz clic en una tarjeta</b> para ver su hoja de vida, activarlo/desactivarlo o eliminarlo.",
      `<button class="dr-btn dr-btn--primary" data-accion="nuevo-consejero">＋ Agregar consejero</button>`) + `
      <div class="dr-kpis" style="margin-bottom:14px">
        ${U.kpi(total.length, "Consejeros")}
        ${U.kpi(total.filter(c => c.tipoVinculo === "planta").length, "Planta")}
        ${U.kpi(total.filter(c => c.tipoVinculo === "voluntario").length, "Voluntarios")}
        ${U.kpi(total.filter(c => c.activo && c.disponible).length, "Activos y disponibles")}
      </div>
      <div class="cs-eqbar">
        <input id="cs-eq-search" class="dr-search" placeholder="Buscar consejero por nombre, ministerio o especialidad…" value="${U.esc(equipoQuery)}" autocomplete="off">
        <label class="cs-eqbar__sel"><span>Especialidad</span>
          <select class="dr-select" data-accion="equipo-esp"><option value="todos">Todas</option>${C.TIPOS.map(t => `<option value="${t.id}" ${equipoEsp === t.id ? "selected" : ""}>${t.emoji} ${U.esc(t.nombre)}</option>`).join("")}</select></label>
        <label class="cs-eqbar__sel"><span>Ministerio</span>
          <select class="dr-select" data-accion="equipo-min"><option value="todos">Todos</option>${mins.map(m => `<option value="${U.esc(m)}" ${equipoMin === m ? "selected" : ""}>${U.esc(m)}</option>`).join("")}</select></label>
        ${(equipoQuery || equipoEsp !== "todos" || equipoMin !== "todos") ? `<button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="equipo-clear">Limpiar</button>` : ""}
      </div>
      <p class="dr-card__sub" style="margin:2px 4px 10px">${eq.length} de ${total.length} consejeros</p>
      <div class="cs-team">
        ${eq.length ? eq.map(c => {
          const cg = cargaDe(c.id);
          const fp = formacionPct(c);
          const estadoTxt = !c.activo ? "En pausa" : (c.disponible ? "Activo · disponible" : "Activo · no disponible");
          return `<article class="cs-member cs-member--click ${c.activo ? "" : "is-off"}" data-accion="ver-consejero" data-id="${c.id}" tabindex="0" role="button" aria-label="Hoja de vida de ${U.esc(c.nombre)}">
            <div class="cs-member__top">
              <div class="cs-member__ava">${U.esc(U.iniciales(c.nombre))}</div>
              <div class="cs-member__nom"><b>${U.esc(c.nombre)}</b><small>${U.esc(c.ministerio || "Sin ministerio")}</small></div>
            </div>
            <div class="cs-member__badges">${vinculoChip(c)}<span class="cs-avail ${c.activo ? (c.disponible ? "is-on" : "is-busy") : "is-off"}">${c.activo ? (c.disponible ? "● Disponible" : "◐ No disponible") : "○ En pausa"}</span></div>
            <div class="cs-member__load">Carga: <b>${cg.abiertos}</b> de ${cg.cap} casos (${cg.pct}%)</div>
            <div class="cs-member__bar"><i style="width:${Math.min(100, cg.pct)}%;background:${cg.pct >= 90 ? "var(--peligro)" : cg.pct >= 70 ? "var(--mostaza-500)" : "var(--cs-teal)"}"></i></div>
            <div class="cs-member__esp">${(c.especialidades || []).map(e => U.tipoChip(e)).join("")}</div>
            <div class="cs-member__load">🎓 Formación: <b>${fp}%</b> completa</div>
            <div class="cs-member__acts" data-stop>
              <button class="dr-btn dr-btn--sm" data-accion="ver-consejero" data-id="${c.id}">Hoja de vida</button>
              <button class="dr-btn ${c.activo ? "dr-btn--ghost" : "dr-btn--primary"} dr-btn--sm" data-accion="toggle-consejero" data-id="${c.id}">${c.activo ? "Desactivar" : "Activar"}</button>
            </div>
          </article>`;
        }).join("") : `<div class="dr-empty" style="padding:26px;grid-column:1/-1">Ningún consejero coincide con la búsqueda o los filtros.</div>`}
      </div>
    `, vista);
  }

  /* % de formación completa (cursos + instituto + módulos de consejería) */
  function formacionPct(cj) {
    const f = cj.formacion || {};
    const totFor = C.FORMACION.length, hechFor = C.FORMACION.filter(x => f[x.id] === "completo").length;
    const totMod = C.MODULOS_CONSEJERIA.length, hechMod = (cj.modConsejeria || []).length;
    return U.pct(hechFor + hechMod, totFor + totMod);
  }
  function fEstadoChip(est) {
    const m = { completo: { t: "Completo", c: "respondida" }, curso: { t: "En curso", c: "orando" }, pendiente: { t: "Pendiente", c: "abierta" } };
    const x = m[est] || m.pendiente;
    return `<span class="ps-estado ps-estado--${x.c}">${x.t}</span>`;
  }

  function modalVerConsejero(id) {
    const cj = S.equipo().find(x => x.id === id); if (!cj) return;
    const casos = S.deConsejero(id);
    const abiertos = casos.filter(c => c.estado !== "cerrada").length;
    const wa = String(cj.tel || "").replace(/\D/g, "");
    const f = cj.formacion || {};
    const pctF = formacionPct(cj);
    const cg = cargaDe(cj.id);

    const fdot = est => est === "completo"
      ? `<span class="cs-fdot is-ok" aria-label="Completo">✓</span>`
      : est === "curso" ? `<span class="cs-fdot is-mid" aria-label="En curso">◐</span>`
      : `<span class="cs-fdot is-off" aria-label="Pendiente">○</span>`;
    const fLbl = est => est === "completo" ? "Completo" : est === "curso" ? "En curso" : "Pendiente";
    const grupos = {}; C.FORMACION.forEach(x => { (grupos[x.grupo] = grupos[x.grupo] || []).push(x); });
    const formHTML = Object.keys(grupos).map(g => `
      <div class="cs-hv__grp">${U.esc(g)}</div>
      <div class="cs-flist">${grupos[g].map(x => `<div class="cs-fitem cs-fitem--${f[x.id] || "pendiente"}">${fdot(f[x.id])}<span class="cs-fitem__n">${U.esc(x.nombre)}</span><span class="cs-fitem__s">${fLbl(f[x.id])}</span></div>`).join("")}</div>`).join("");
    const modHechos = (cj.modConsejeria || []);
    const modHTML = C.MODULOS_CONSEJERIA.map(m => { const ok = modHechos.indexOf(m.id) >= 0; return `<div class="cs-fitem cs-fitem--${ok ? "completo" : "pendiente"}">${ok ? `<span class="cs-fdot is-ok">✓</span>` : `<span class="cs-fdot is-off">○</span>`}<span class="cs-fitem__n">${U.esc(m.nombre)}</span><span class="cs-fitem__s">${ok ? "Hecho" : "Pendiente"}</span></div>`; }).join("");

    U.abrirModal(`
      <div class="cs-hv__hero">
        <div class="cs-hv__ava">${U.esc(U.iniciales(cj.nombre))}</div>
        <div class="cs-hv__id">
          <h3 id="cs-modal-t">${U.esc(cj.nombre)}</h3>
          <p>${(cj.especialidades || []).map(e => C.tipo(e).nombre).join(" · ") || "Consejero"}</p>
          <div class="cs-hv__tags"><span class="cs-hv__state ${cj.activo ? "is-on" : "is-off"}">${cj.activo ? "● Activo" : "○ En pausa"}</span>${vinculoChip(cj)}<span class="cs-avail ${cj.activo ? (cj.disponible ? "is-on" : "is-busy") : "is-off"}">${cj.activo ? (cj.disponible ? "Disponible" : "No disponible") : "En pausa"}</span><span class="cs-hv__cert">🎓 ${U.esc(cj.cert || "Consejería")}</span></div>
        </div>
        <div class="cs-hv__kpis">
          <div class="cs-hv__kpi"><b>${pctF}%</b><span>Formación</span></div>
          <div class="cs-hv__kpi"><b>${abiertos}/${cj.capacidad}</b><span>Carga</span></div>
          <div class="cs-hv__kpi"><b>${casos.length}</b><span>Casos</span></div>
        </div>
      </div>

      <div class="cs-hv__body">
        <div class="cs-hv__col">
          <div class="cs-hv__grp">Datos</div>
          <dl class="cs-kv">
            <div><dt>Vínculo</dt><dd>${cj.tipoVinculo === "planta" ? "Planta" : "Voluntario"}</dd></div>
            <div><dt>Ministerio</dt><dd>${U.esc(cj.ministerio || "—")}</dd></div>
            <div><dt>Disponibilidad</dt><dd>${cj.activo ? (cj.disponible ? "Disponible" : "No disponible") : "En pausa"}</dd></div>
            <div><dt>Edad · Género</dt><dd>${cj.edad || "—"}${cj.edad ? " años" : ""} · ${cj.genero === "F" ? "Mujer" : "Hombre"}</dd></div>
            <div><dt>En el equipo</dt><dd>desde ${cj.ingreso ? U.fechaCorta(cj.ingreso) : "—"}</dd></div>
            <div><dt>Carga actual</dt><dd>${cg.abiertos} de ${cj.capacidad} casos (${cg.pct}%)</dd></div>
          </dl>
          <div class="cs-hv__grp">Contacto</div>
          <div class="cs-hv__contact">
            ${wa ? `<a class="dr-btn dr-btn--primary dr-btn--sm" href="https://wa.me/${wa}?text=${encodeURIComponent("Hola " + cj.nombre.split(" ")[0] + " 🙌")}" target="_blank" rel="noopener">💬 WhatsApp</a>` : ""}
            <a class="dr-btn dr-btn--sm" href="mailto:${cj.email}">✉️ Correo</a>
            ${cj.tel ? `<a class="dr-btn dr-btn--sm" href="tel:${wa}">📞 Llamar</a>` : ""}
          </div>
          <div class="cs-hv__meta">${U.esc(cj.tel || "")}<br>${U.esc(cj.email || "")}</div>

          <div class="cs-hv__grp" style="margin-top:14px">Casos asignados (${casos.length})</div>
          <div class="cs-mini">
            ${casos.length ? casos.map(c => `<div class="cs-mini__row"><div><b>${U.esc(c.persona)}</b><p>${C.tipo(c.tipo).nombre} · ${c.sesiones} sesiones</p></div>${U.estadoChip(c.estado)}</div>`).join("") : `<div class="dr-empty" style="padding:12px">Sin casos asignados.</div>`}
          </div>
        </div>

        <div class="cs-hv__col">
          <div class="cs-hv__progwrap">
            <div class="cs-hv__grp" style="margin:0">🎓 Formación · ${pctF}%</div>
            <div class="cs-prog"><i style="width:${pctF}%;background:${pctF >= 80 ? "var(--exito)" : pctF >= 50 ? "var(--cs-teal)" : "var(--mostaza-500)"}"></i></div>
          </div>
          ${formHTML}
          <div class="cs-hv__grp">Módulos de consejería <span class="cs-hv__count">${modHechos.length}/${C.MODULOS_CONSEJERIA.length}</span></div>
          <div class="cs-flist">${modHTML}</div>
        </div>
      </div>

      <div class="dr-modal__acts">
        <button class="dr-btn ${cj.activo ? "dr-btn--ghost" : "dr-btn--primary"}" data-accion="toggle-consejero" data-id="${cj.id}">${cj.activo ? "Desactivar consejero" : "Activar consejero"}</button>
        ${cj.activo ? `<button class="dr-btn dr-btn--ghost" data-accion="toggle-disponible" data-id="${cj.id}">${cj.disponible ? "Marcar no disponible" : "Marcar disponible"}</button>` : ""}
        <button class="dr-btn dr-btn--ghost" data-accion="del-consejero" data-id="${cj.id}" style="color:var(--peligro)">🗑 Eliminar</button>
        <button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cerrar</button>
      </div>
    `);
  }

  function modalNuevoConsejero() {
    U.abrirModal(`
      <div class="dr-modal__head"><div><h3 id="cs-modal-t">Agregar consejero</h3><p class="dr-card__sub">Planta o voluntario. Queda <b>sincronizado con el CRM central</b> de la iglesia.</p></div></div>
      <form data-accion="guardar-consejero">
        <label class="dr-field"><span>Nombre y apellido</span><input id="cs-nc-nombre" class="dr-input" placeholder="Nombre y apellido"></label>
        <div class="dr-grid2">
          <label class="dr-field"><span>Tipo de vínculo</span>
            <select id="cs-nc-vinc" class="dr-select">${C.VINCULOS.map(v => `<option value="${v.id}">${v.nombre}</option>`).join("")}</select></label>
          <label class="dr-field"><span>Ministerio <small style="color:var(--texto-tenue)">(base de la iglesia)</small></span>
            <select id="cs-nc-min" class="dr-select"><option value="">— elige —</option>${C.MINISTERIOS_BASE.map(m => `<option value="${U.esc(m)}">${U.esc(m)}</option>`).join("")}</select></label>
        </div>
        <div class="dr-grid2">
          <label class="dr-field"><span>Correo</span><input id="cs-nc-email" class="dr-input" type="email" placeholder="correo@casaroca.org"></label>
          <label class="dr-field"><span>Teléfono</span><input id="cs-nc-tel" class="dr-input" placeholder="+57 3xx xxx xxxx"></label>
        </div>
        <label class="dr-field"><span>Expertise / especialidades <small style="color:var(--texto-tenue)">(una o varias)</small></span>
          <div class="cs-member__esp" id="cs-nc-esp">${C.TIPOS.map(t => `<button type="button" class="cs-chip cs-chip--sel" data-accion="toggle-esp" data-t="${t.id}">${t.emoji} ${t.nombre.split(" ")[0]}</button>`).join("")}</div>
        </label>
        <label class="dr-field"><span>Capacidad (casos simultáneos)</span><input id="cs-nc-cap" class="dr-input" type="number" value="5" min="1" max="20"></label>
        <div class="dr-modal__acts">
          <button type="submit" class="dr-btn dr-btn--primary">Agregar al equipo</button>
          <button type="button" class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
        </div>
      </form>
    `);
  }

  /* ============================================================ 1. ANALÍTICA (primera pantalla del coordinador) */
  function vistaAnalitica() {
    const all = S.consejerias();
    const sinAsig = S.solicitudes().length;
    const asignadas = all.filter(c => c.consejero).length;
    const act = all.filter(c => c.estado === "activa").length;
    const cerr = all.filter(c => c.estado === "cerrada").length;
    const sesiones = all.reduce((s, c) => s + (c.sesiones || 0), 0);
    const nF = all.filter(c => c.genero === "F").length, nM = all.length - nF;
    const edadProm = (() => { const e = all.filter(c => typeof c.edad === "number"); return e.length ? Math.round(e.reduce((s, c) => s + c.edad, 0) / e.length) : "—"; })();

    const porTipo = C.TIPOS.map(t => ({ lbl: t.nombre.split(" ")[0], v: all.filter(c => c.tipo === t.id).length, color: t.color })).filter(r => r.v > 0);
    const porEstado = C.ESTADOS.map(e => ({ lbl: e.nombre, v: all.filter(c => c.estado === e.id).length, color: e.id === "cerrada" ? "var(--exito)" : e.id === "solicitada" ? "var(--azul-400)" : "var(--cs-teal)" })).filter(r => r.v > 0);
    const rangos = [{ lbl: "<18", a: 0, b: 17 }, { lbl: "18–25", a: 18, b: 25 }, { lbl: "26–35", a: 26, b: 35 }, { lbl: "36–50", a: 36, b: 50 }, { lbl: "50+", a: 51, b: 200 }];
    const porEdad = rangos.map(r => ({ lbl: r.lbl, v: all.filter(c => typeof c.edad === "number" && c.edad >= r.a && c.edad <= r.b).length, color: "var(--cs-teal)" }));
    const hoyD = new Date(); const meses = [];
    for (let i = 5; i >= 0; i--) { const d = new Date(hoyD.getFullYear(), hoyD.getMonth() - i, 1); meses.push({ y: d.getFullYear(), m: d.getMonth() }); }
    const porMes = meses.map(mm => ({ lbl: U.MESES[mm.m], v: all.filter(c => { if (!c.fechaAsig) return false; const d = new Date(c.fechaAsig + "T00:00"); return d.getFullYear() === mm.y && d.getMonth() === mm.m; }).length }));

    /* detalle por cada tipo de consejería: cantidades y estados */
    const filasDetalle = C.TIPOS.map(t => {
      const xs = all.filter(c => c.tipo === t.id);
      if (!xs.length) return "";
      return `<tr>
        <td>${U.tipoChip(t.id)}</td>
        <td><b>${xs.length}</b></td>
        <td>${xs.filter(c => c.consejero).length}</td>
        <td>${xs.filter(c => c.estado === "activa").length}</td>
        <td>${xs.filter(c => !c.consejero).length}</td>
        <td>${xs.filter(c => c.estado === "cerrada").length}</td>
        <td>${xs.filter(c => c.genero === "F").length}/${xs.filter(c => c.genero !== "F").length}</td>
      </tr>`;
    }).join("");

    /* cruces derivados del formulario oficial */
    const porRiesgo = [
      { lbl: "Alto", v: all.filter(c => c.riesgo === "alto").length, color: "var(--peligro)" },
      { lbl: "Medio", v: all.filter(c => c.riesgo === "medio").length, color: "var(--mostaza-500)" },
      { lbl: "Bajo", v: all.filter(c => c.riesgo === "bajo").length, color: "var(--cs-teal)" },
    ].filter(r => r.v > 0);
    const porModalidad = [
      { lbl: "Presencial", v: all.filter(c => c.modalidad === "presencial").length, color: "var(--azul-500)" },
      { lbl: "Virtual", v: all.filter(c => c.modalidad === "virtual").length, color: "var(--cs-teal)" },
    ].filter(r => r.v > 0);
    const minsSet = Array.from(new Set(all.map(c => c.ministerio).filter(Boolean)));
    const porMinisterio = minsSet.map(m => ({ lbl: m.length > 10 ? m.slice(0, 10) + "…" : m, v: all.filter(c => c.ministerio === m).length, color: "var(--azul-600)" })).sort((a, b) => b.v - a.v).slice(0, 6);

    /* satisfacción (encuesta de cierre) */
    const conSat = all.filter(c => c.satisfaccion && c.satisfaccion.score != null);
    const satProm = conSat.length ? (conSat.reduce((s, c) => s + c.satisfaccion.score, 0) / conSat.length) : null;
    const satDist = [5, 4, 3, 2, 1].map(n => ({ lbl: n + "★", v: conSat.filter(c => Math.round(c.satisfaccion.score) === n).length, color: n >= 4 ? "var(--exito)" : n === 3 ? "var(--mostaza-500)" : "var(--peligro)" }));
    const encuestasPend = all.filter(c => c.estado === "cerrada" && (!c.satisfaccion || c.satisfaccion.score == null)).length;

    /* lectura inteligente (insights derivados) */
    const topTema = porTipo.slice().sort((a, b) => b.v - a.v)[0];
    const pctAlto = all.length ? Math.round((all.filter(c => c.riesgo === "alto").length / all.length) * 100) : 0;
    const staleN = all.filter(c => c.consejero && c.estado !== "cerrada" && c.ultimaInteraccion && U.diasDesde(String(c.ultimaInteraccion).slice(0, 10)) > 7).length;
    const insights = [
      topTema ? `🔎 El tema con más demanda es <b>${U.esc(topTema.lbl)}</b> (${topTema.v} casos).` : "",
      `🚨 El <b>${pctAlto}%</b> de los casos vienen con <b>riesgo alto</b> según la evaluación del formulario.`,
      satProm != null ? `⭐ Satisfacción promedio de los procesos cerrados: <b>${satProm.toFixed(1)}/5</b> (${conSat.length} respuesta${conSat.length !== 1 ? "s" : ""}).` : "",
      staleN ? `⏳ <b>${staleN}</b> caso(s) llevan <b>+7 días</b> sin interacción del consejero — revísalos en Recordatorios.` : `✅ Todos los casos con seguimiento al día.`,
    ].filter(Boolean);

    return U.shell(SHELL, U.head("Analítica del operativo", "Indicadores del cuidado, cruces del formulario oficial y satisfacción. <b>Toca cualquier tarjeta de arriba</b> para ver el porqué.", "", true) + `
      <div class="dr-kpis">
        ${kpiWhy(all.length, "Consejerías totales", "total")}
        ${kpiWhy(asignadas, "Asignadas", "asignadas")}
        ${kpiWhy(sinAsig, "Sin asignar", "sinasig", sinAsig > 0)}
        ${kpiWhy(act, "Activas", "activas")}
        ${kpiWhy(cerr, "Cerradas", "cerradas")}
        ${kpiWhy(satProm != null ? satProm.toFixed(1) + "/5" : "—", "Satisfacción", "satisfaccion")}
      </div>

      <div class="cs-insights">
        <div class="cs-insights__t">🤖 Lectura inteligente <small>del registro del formulario oficial</small></div>
        <ul>${insights.map(i => `<li>${i}</li>`).join("")}</ul>
      </div>

      <div class="dr-charts">
        ${U.columns("Asignadas por mes", "Casos asignados (últimos 6 meses)", porMes, () => "var(--cs-teal)")}
        ${U.donut("Por tipo de consejería", `${all.length} en total`, porTipo)}
        ${U.donut("Por riesgo (evaluación)", "Derivado del formulario", porRiesgo)}
        ${U.donut("Por modalidad solicitada", `${all.length} casos`, porModalidad)}
        ${U.donut("Por género", `${nF} mujeres · ${nM} hombres`, [{ lbl: "Mujeres", v: nF, color: "#C2569B" }, { lbl: "Hombres", v: nM, color: "var(--azul-500)" }])}
        ${U.columns("Por edad", "Distribución por rango", porEdad, r => r.color)}
        ${U.columns("Demanda por ministerio", "Top ministerios", porMinisterio, r => r.color)}
        ${U.columns("Por estado", "Distribución actual", porEstado, r => r.color)}
      </div>

      <div class="cs-satpanel">
        <div class="cs-satpanel__score">
          <b>${satProm != null ? satProm.toFixed(1) : "—"}</b><span>/ 5</span>
          <p>Satisfacción promedio<br><small>${conSat.length} respuesta(s) · ${encuestasPend} encuesta(s) pendiente(s)</small></p>
        </div>
        <div class="cs-satpanel__dist">
          ${satDist.map(d => `<div class="cs-satrow"><span class="cs-satrow__l">${d.lbl}</span><div class="cs-satrow__bar"><i style="width:${conSat.length ? Math.round(d.v / conSat.length * 100) : 0}%;background:${d.color}"></i></div><b>${d.v}</b></div>`).join("")}
        </div>
      </div>

      <div class="dr-card" style="margin-top:18px;overflow-x:auto">
        <h3 class="dr-card__t">Detalle por cada consejería</h3>
        <p class="dr-card__sub">Cantidades, asignadas y estados, desglosado por tipo.</p>
        <table class="dr-table"><thead><tr><th>Tipo</th><th>Total</th><th>Asignadas</th><th>Activas</th><th>Sin asignar</th><th>Cerradas</th><th>M/H</th></tr></thead>
        <tbody>${filasDetalle || '<tr><td colspan="7"><div class="dr-empty" style="padding:14px">Sin datos.</div></td></tr>'}</tbody></table>
      </div>
      <p class="dr-card__sub" style="margin-top:14px">¿Necesitas otro cruce? Ve al <b>Explorador</b> para armar tus propios gráficos (filas × medida).</p>
    `, vista);
  }

  /* KPI clickable (drill-down del porqué) */
  function kpiWhy(n, lbl, key, alerta) {
    return `<button type="button" class="dr-kpi dr-kpi--btn ${alerta ? "is-alerta" : ""}" data-accion="kpi-why" data-k="${key}"><div class="dr-kpi__n">${n}</div><div class="dr-kpi__l">${U.esc(lbl)}</div><span class="dr-kpi__hint">ⓘ ver detalle</span></button>`;
  }
  function modalKpiWhy(key) {
    const all = S.consejerias();
    const miniList = arr => arr.length ? `<div class="cs-mini">${arr.map(c => `<div class="cs-mini__row"><div><b>${U.esc(c.persona)}</b><p>${C.tipo(c.tipo).nombre} · ${U.esc((S.equipoPorId(c.consejero) || {}).nombre || "Sin asignar")}</p></div>${U.estadoChip(c.estado)}</div>`).join("")}</div>` : `<div class="dr-empty" style="padding:12px">Sin casos.</div>`;
    const barras = rows => `<div class="cs-bars" style="margin-top:6px">${rows.filter(r => r.v > 0).map(r => { const max = Math.max(1, ...rows.map(x => x.v)); return `<div class="cs-barrow"><span class="cs-barrow__lbl">${U.esc(r.lbl)}</span><div class="cs-bar"><span class="cs-bar__seg" style="width:${Math.round(r.v / max * 100)}%;background:${r.color || "var(--cs-teal)"}">${r.v}</span></div></div>`; }).join("")}</div>`;
    let titulo = "", cuerpo = "";
    if (key === "total") {
      titulo = "Todas las consejerías · ¿de qué se componen?";
      cuerpo = barras(C.TIPOS.map(t => ({ lbl: t.nombre, v: all.filter(c => c.tipo === t.id).length, color: t.color })));
    } else if (key === "asignadas") {
      titulo = "Asignadas · carga por consejero";
      cuerpo = barras(S.equipo().map(cj => ({ lbl: cj.nombre.split(" ")[0], v: S.deConsejero(cj.id).filter(c => c.consejero).length, color: "var(--cs-teal)" })));
    } else if (key === "sinasig") {
      titulo = "Sin asignar · esperando en la bandeja";
      cuerpo = miniList(S.solicitudes());
    } else if (key === "activas") {
      titulo = "Activas · en proceso ahora";
      cuerpo = miniList(all.filter(c => c.estado === "activa"));
    } else if (key === "cerradas") {
      const cer = all.filter(c => c.estado === "cerrada");
      titulo = "Cerradas · resultado del cierre";
      const res = {}; cer.forEach(c => { const r = c.resultadoCierre || "completado"; res[r] = (res[r] || 0) + 1; });
      cuerpo = barras(Object.keys(res).map(r => ({ lbl: r, v: res[r], color: "var(--exito)" }))) + miniList(cer);
    } else if (key === "satisfaccion") {
      const conSat = all.filter(c => c.satisfaccion && c.satisfaccion.score != null);
      titulo = "Satisfacción · encuesta de cierre";
      cuerpo = barras([5, 4, 3, 2, 1].map(n => ({ lbl: n + "★", v: conSat.filter(c => Math.round(c.satisfaccion.score) === n).length, color: n >= 4 ? "var(--exito)" : n === 3 ? "var(--mostaza-500)" : "var(--peligro)" }))) +
        `<p class="dr-card__sub" style="margin-top:10px">${conSat.length} persona(s) respondieron la encuesta enviada al cerrar el proceso.</p>`;
    }
    U.abrirModal(`
      <div class="dr-modal__head"><div><h3 id="cs-modal-t">${titulo}</h3><p class="dr-card__sub">Desglose en vivo de este indicador.</p></div></div>
      ${cuerpo}
      <div class="dr-modal__acts"><button class="dr-btn dr-btn--primary" data-accion="cerrar-modal">Cerrar</button></div>
    `);
  }

  /* ============================================================ EXPLORADOR · TABLAS DINÁMICAS (pivot) */
  const RANGOS_EDAD = [{ lbl: "<18", a: 0, b: 17 }, { lbl: "18–25", a: 18, b: 25 }, { lbl: "26–35", a: 26, b: 35 }, { lbl: "36–50", a: 36, b: 50 }, { lbl: "50+", a: 51, b: 200 }];
  const DIMS = [
    { id: "tipo", lbl: "Tipo de consejería", val: c => ({ k: c.tipo, lbl: C.tipo(c.tipo).nombre, color: C.tipo(c.tipo).color }) },
    { id: "estado", lbl: "Estado", val: c => ({ k: c.estado, lbl: C.estado(c.estado).nombre, color: c.estado === "cerrada" ? "var(--exito)" : c.estado === "solicitada" ? "var(--azul-400)" : "var(--cs-teal)" }) },
    { id: "prioridad", lbl: "Prioridad", val: c => ({ k: c.prioridad, lbl: C.prioridad(c.prioridad).nombre, color: C.prioridad(c.prioridad).color }) },
    { id: "genero", lbl: "Género", val: c => ({ k: c.genero, lbl: c.genero === "F" ? "Mujeres" : "Hombres", color: c.genero === "F" ? "#C2569B" : "var(--azul-500)" }) },
    { id: "edad", lbl: "Rango de edad", val: c => { const r = RANGOS_EDAD.find(r => typeof c.edad === "number" && c.edad >= r.a && c.edad <= r.b); return { k: r ? r.lbl : "—", lbl: r ? r.lbl : "Sin edad", color: "var(--cs-teal)" }; } },
    { id: "consejero", lbl: "Consejero", val: c => { const cj = c.consejero ? (C.consejero(c.consejero) || {}) : null; return { k: c.consejero || "—", lbl: cj ? cj.nombre.split(" ")[0] : "Sin asignar", color: c.consejero ? "var(--cs-teal)" : "var(--texto-tenue)" }; } },
    { id: "ministerio", lbl: "Ministerio / sede", val: c => ({ k: c.ministerio, lbl: c.ministerio, color: "var(--azul-600)" }) },
    { id: "mes", lbl: "Mes de asignación", val: c => { if (!c.fechaAsig) return { k: "zzz", lbl: "Sin asignar", color: "var(--texto-tenue)" }; const d = new Date(c.fechaAsig + "T00:00"); return { k: d.getFullYear() + "-" + String(d.getMonth()).padStart(2, "0"), lbl: U.MESES[d.getMonth()] + " " + String(d.getFullYear()).slice(2), color: "var(--cs-teal)" }; } },
  ];
  const DIM = id => DIMS.find(d => d.id === id);
  const MEDS = [
    { id: "count", lbl: "Nº de consejerías", agg: l => l.length },
    { id: "sesiones", lbl: "Σ Sesiones", agg: l => l.reduce((s, c) => s + (c.sesiones || 0), 0) },
    { id: "notas", lbl: "Σ Notas", agg: l => l.reduce((s, c) => s + (c.notas || 0), 0) },
    { id: "edadProm", lbl: "Edad promedio", agg: l => { const e = l.filter(c => typeof c.edad === "number"); return e.length ? Math.round(e.reduce((s, c) => s + c.edad, 0) / e.length) : 0; } },
  ];
  const MED = id => MEDS.find(m => m.id === id) || MEDS[0];
  const VIZ = [
    { id: "tabla", lbl: "Tabla dinámica", ico: "▦" }, { id: "barras", lbl: "Barras", ico: "▮" },
    { id: "apiladas", lbl: "Apiladas", ico: "▤" }, { id: "dona", lbl: "Dona", ico: "◍" }, { id: "calor", lbl: "Mapa de calor", ico: "▩" },
  ];
  const FILTRABLES = ["tipo", "estado", "prioridad", "genero", "consejero"];

  /* aplica filtros y arma la matriz pivote */
  function pivote(cfg) {
    let data = S.consejerias();
    Object.keys(cfg.filtros || {}).forEach(fid => {
      const sel = cfg.filtros[fid]; if (!sel || !sel.length) return;
      const d = DIM(fid); data = data.filter(c => sel.indexOf(d.val(c).k) >= 0);
    });
    const fdim = DIM(cfg.filas), cdim = cfg.columnas ? DIM(cfg.columnas) : null, med = MED(cfg.medida);
    const rowMap = {}, colMap = {}, cells = {};
    data.forEach(c => {
      const rv = fdim.val(c); rowMap[rv.k] = rv;
      let ck = "·", cv = { k: "·", lbl: med.lbl, color: "var(--cs-teal)" };
      if (cdim) { cv = cdim.val(c); ck = cv.k; } colMap[ck] = cv;
      (cells[rv.k] = cells[rv.k] || {}); (cells[rv.k][ck] = cells[rv.k][ck] || []).push(c);
    });
    let rowKeys = Object.keys(rowMap), colKeys = Object.keys(colMap);
    const cellVal = (rk, ck) => med.agg((cells[rk] && cells[rk][ck]) || []);
    const rowTot = rk => med.id === "edadProm" ? med.agg(Object.keys(cells[rk] || {}).reduce((a, ck) => a.concat(cells[rk][ck]), [])) : colKeys.reduce((s, ck) => s + cellVal(rk, ck), 0);
    if (cfg.ordenar === "valor") rowKeys.sort((a, b) => rowTot(b) - rowTot(a));
    else rowKeys.sort((a, b) => String(rowMap[a].lbl).localeCompare(rowMap[b].lbl));
    colKeys.sort((a, b) => String(colMap[a].lbl).localeCompare(colMap[b].lbl));
    const grand = med.id === "edadProm" ? med.agg(data) : rowKeys.reduce((s, rk) => s + rowTot(rk), 0);
    return { data, fdim, cdim, med, rowMap, colMap, rowKeys, colKeys, cellVal, rowTot, grand };
  }

  function csvDe(p) {
    const esc = s => `"${String(s == null ? "" : s).replace(/"/g, '""')}"`;
    const head = [p.fdim.lbl].concat(p.cdim ? p.colKeys.map(ck => p.colMap[ck].lbl) : [p.med.lbl]);
    if (p.cdim) head.push("Total");
    const rows = p.rowKeys.map(rk => { const base = [p.rowMap[rk].lbl].concat(p.cdim ? p.colKeys.map(ck => p.cellVal(rk, ck)) : [p.rowTot(rk)]); if (p.cdim) base.push(p.rowTot(rk)); return base; });
    return [head].concat(rows).map(r => r.map(esc).join(",")).join("\n");
  }
  function csvHref(p) { return "data:text/csv;charset=utf-8," + encodeURIComponent(csvDe(p)); }

  function renderPivot(p, cfg) {
    if (!p.rowKeys.length) return `<div class="dr-empty">No hay datos para este cruce. Ajusta los filtros.</div>`;
    const fmt = (v, rk) => { if (!cfg.pctTotal || p.med.id === "edadProm") return v; return p.grand ? Math.round(v / p.grand * 100) + "%" : "0%"; };
    if (cfg.viz === "tabla") {
      const cols = p.cdim ? p.colKeys : ["·"];
      const thead = `<tr><th>${U.esc(p.fdim.lbl)}</th>${cols.map(ck => `<th class="cs-piv__num">${U.esc(p.cdim ? p.colMap[ck].lbl : p.med.lbl)}</th>`).join("")}${p.cdim && cfg.totales ? `<th class="cs-piv__num cs-piv__tot">Total</th>` : ""}</tr>`;
      const body = p.rowKeys.map(rk => `<tr><th class="cs-piv__rh">${U.esc(p.rowMap[rk].lbl)}</th>${cols.map(ck => { const v = p.cellVal(rk, ck); return `<td class="cs-piv__num">${fmt(v, rk)}</td>`; }).join("")}${p.cdim && cfg.totales ? `<td class="cs-piv__num cs-piv__tot">${fmt(p.rowTot(rk))}</td>` : ""}</tr>`).join("");
      const foot = cfg.totales && p.med.id !== "edadProm" ? `<tr class="cs-piv__foot"><th>Total</th>${cols.map(ck => `<td class="cs-piv__num">${p.cdim ? fmt(p.rowKeys.reduce((s, rk) => s + p.cellVal(rk, ck), 0)) : fmt(p.grand)}</td>`).join("")}${p.cdim ? `<td class="cs-piv__num cs-piv__tot">${fmt(p.grand)}</td>` : ""}</tr>` : "";
      return `<div class="dr-card" style="overflow-x:auto"><table class="dr-table cs-piv">${`<thead>${thead}</thead>`}<tbody>${body}${foot}</tbody></table></div>`;
    }
    if (cfg.viz === "calor") {
      const cols = p.cdim ? p.colKeys : ["·"];
      let max = 1; p.rowKeys.forEach(rk => cols.forEach(ck => { max = Math.max(max, p.cellVal(rk, ck)); }));
      const head = `<tr><th></th>${cols.map(ck => `<th class="cs-piv__num">${U.esc(p.cdim ? p.colMap[ck].lbl : p.med.lbl)}</th>`).join("")}</tr>`;
      const body = p.rowKeys.map(rk => `<tr><th class="cs-piv__rh">${U.esc(p.rowMap[rk].lbl)}</th>${cols.map(ck => { const v = p.cellVal(rk, ck); const a = max ? (v / max) : 0; return `<td class="cs-heat" style="background:color-mix(in srgb, var(--cs-teal) ${Math.round(a * 85) + 6}%, white);color:${a > .55 ? "#fff" : "var(--texto)"}">${v || ""}</td>`; }).join("")}</tr>`).join("");
      return `<div class="dr-card" style="overflow-x:auto"><table class="dr-table cs-piv cs-piv--heat"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
    }
    if (cfg.viz === "dona") {
      const segs = p.rowKeys.map(rk => ({ lbl: p.rowMap[rk].lbl, v: p.rowTot(rk), color: p.rowMap[rk].color }));
      return U.donut(`${p.med.lbl} por ${p.fdim.lbl}`, "", segs);
    }
    // barras / apiladas
    const cols = p.cdim ? p.colKeys : ["·"];
    const maxStack = Math.max(1, ...p.rowKeys.map(rk => cfg.viz === "apiladas" ? p.rowTot(rk) : Math.max(...cols.map(ck => p.cellVal(rk, ck)))));
    const legend = p.cdim ? `<div class="dr-legend" style="margin-bottom:10px">${cols.map(ck => `<span style="display:inline-flex;align-items:center;gap:5px;margin-right:12px;font-size:12px"><i style="width:11px;height:11px;border-radius:3px;background:${p.colMap[ck].color};display:inline-block"></i>${U.esc(p.colMap[ck].lbl)}</span>`).join("")}</div>` : "";
    const bars = p.rowKeys.map(rk => {
      const segs = cols.map(ck => ({ v: p.cellVal(rk, ck), color: p.cdim ? p.colMap[ck].color : p.rowMap[rk].color, lbl: p.cdim ? p.colMap[ck].lbl : "" }));
      const inner = cfg.viz === "apiladas"
        ? `<div class="cs-bar cs-bar--stack">${segs.filter(s => s.v > 0).map(s => `<div class="cs-bar__seg" style="width:${(s.v / maxStack) * 100}%;background:${s.color}" title="${U.esc(s.lbl)}: ${s.v}">${s.v > 0 ? s.v : ""}</div>`).join("")}</div>`
        : `<div class="cs-bar cs-bar--group">${segs.map(s => `<div class="cs-bar__seg" style="width:${(s.v / maxStack) * 100}%;background:${s.color}" title="${U.esc(s.lbl)}: ${s.v}"><span>${s.v || ""}</span></div>`).join("")}</div>`;
      return `<div class="cs-barrow"><div class="cs-barrow__lbl">${U.esc(p.rowMap[rk].lbl)}</div>${inner}<div class="cs-barrow__tot">${p.rowTot(rk)}</div></div>`;
    }).join("");
    return `<div class="dr-card"><h3 class="dr-card__t">${U.esc(p.med.lbl)} por ${U.esc(p.fdim.lbl)}${p.cdim ? " × " + U.esc(p.cdim.lbl) : ""}</h3>${legend}<div class="cs-bars">${bars}</div></div>`;
  }

  function vistaExplorador() {
    const p = pivote(expCfg);
    const sel = (k, opts, cur, extra) => `<select class="dr-select" data-accion="exp-cfg" data-k="${k}">${extra || ""}${opts.map(o => `<option value="${o.id}" ${o.id === cur ? "selected" : ""}>${o.lbl}</option>`).join("")}</select>`;
    const nFiltros = Object.keys(expCfg.filtros).reduce((s, k) => s + ((expCfg.filtros[k] || []).length), 0);
    const filtrosHTML = FILTRABLES.map(fid => {
      const d = DIM(fid); const vals = {}; S.consejerias().forEach(c => { const v = d.val(c); vals[v.k] = v; });
      const sel = expCfg.filtros[fid] || [];
      return `<div class="cs-flt"><div class="cs-flt__lbl">${U.esc(d.lbl)}</div><div class="cs-flt__chips">${Object.keys(vals).map(k => `<button class="cs-chip cs-chip--sel ${sel.indexOf(k) >= 0 ? "is-on" : ""}" data-accion="exp-filtro" data-f="${fid}" data-k="${U.esc(k)}">${U.esc(vals[k].lbl)}</button>`).join("")}</div></div>`;
    }).join("");

    return U.shell(SHELL, U.head("Explorador · Tablas dinámicas",
      "Construye cualquier análisis: filtra los datos, define <b>filas</b> y <b>columnas</b> (cruce), elige la <b>medida</b> y la visualización. Guarda tus análisis y expórtalos a CSV.",
      `<a class="dr-btn" href="${csvHref(p)}" download="analisis-consejeria.csv">⬇️ Exportar CSV</a>`) + `
      <div class="cs-pivpanel">
        <div class="cs-pivpanel__row">
          <label class="cs-explorer__ctl"><span>Filas</span>${sel("filas", DIMS, expCfg.filas)}</label>
          <label class="cs-explorer__ctl"><span>Columnas</span>${sel("columnas", DIMS, expCfg.columnas, `<option value="" ${expCfg.columnas === "" ? "selected" : ""}>— Ninguna —</option>`)}</label>
          <label class="cs-explorer__ctl"><span>Medida</span>${sel("medida", MEDS, expCfg.medida)}</label>
          <label class="cs-explorer__ctl"><span>Orden</span>${sel("ordenar", [{ id: "valor", lbl: "Por valor" }, { id: "etiqueta", lbl: "Alfabético" }], expCfg.ordenar)}</label>
          <div class="cs-explorer__ctl"><span>Visualización</span><div class="dr-filtros" style="margin:0">${VIZ.map(v => `<button class="dr-filtro ${expCfg.viz === v.id ? "is-active" : ""}" data-accion="exp-viz" data-v="${v.id}" title="${v.lbl}">${v.ico} ${v.lbl}</button>`).join("")}</div></div>
          <div class="cs-explorer__ctl"><span>Opciones</span><div class="dr-filtros" style="margin:0">
            <button class="dr-filtro ${expCfg.pctTotal ? "is-active" : ""}" data-accion="exp-opt" data-o="pctTotal">% del total</button>
            <button class="dr-filtro ${expCfg.totales ? "is-active" : ""}" data-accion="exp-opt" data-o="totales">Totales</button>
          </div></div>
        </div>
        <details class="cs-pivpanel__flt" ${nFiltros ? "open" : ""}>
          <summary>🔎 Filtros ${nFiltros ? `<span class="cs-flt__n">${nFiltros}</span>` : ""} ${nFiltros ? `<button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="exp-clearflt">Limpiar</button>` : ""}</summary>
          <div class="cs-flt__grid">${filtrosHTML}</div>
        </details>
      </div>

      <div class="cs-pivbar">
        <span class="dr-card__sub">${p.data.length} consejería(s) en el análisis · total ${p.med.id === "edadProm" ? p.grand + " años" : p.grand}</span>
        <div class="cs-pivbar__saved">
          ${S.listaAnalisis().map(a => `<span class="cs-saved"><button class="cs-saved__load" data-accion="exp-cargar" data-id="${a.id}">📌 ${U.esc(a.nombre)}</button><button class="cs-saved__del" data-accion="exp-del" data-id="${a.id}" title="Eliminar">✕</button></span>`).join("")}
          <button class="dr-btn dr-btn--primary dr-btn--sm" data-accion="exp-guardar">＋ Guardar análisis</button>
        </div>
      </div>

      <div class="cs-explorer__out">${renderPivot(p, expCfg)}</div>
    `, vista);
  }

  function modalGuardarAnalisis() {
    U.abrirModal(`
      <div class="dr-modal__head"><div><h3 id="cs-modal-t">Guardar análisis</h3><p class="dr-card__sub">Quédate con esta configuración para volver a abrirla.</p></div></div>
      <form data-accion="guardar-analisis">
        <label class="dr-field"><span>Nombre del análisis</span><input id="cs-an-nombre" class="dr-input" placeholder="Ej. Casos por tipo y consejero"></label>
        <div class="dr-modal__acts"><button type="submit" class="dr-btn dr-btn--primary">Guardar</button><button type="button" class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button></div>
      </form>
    `);
  }

  /* ============================================================ 5. CALENDARIO */
  function vistaCalendario() {
    const hoy = new Date();
    if (!calMes) calMes = { y: hoy.getFullYear(), m: hoy.getMonth() };
    const { y, m } = calMes;
    const evs = S.eventos();
    const first = new Date(y, m, 1), startDow = (first.getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
    const byDay = {};
    evs.forEach(e => { const d = new Date(e.fecha + "T00:00"); if (d.getFullYear() === y && d.getMonth() === m) (byDay[d.getDate()] = byDay[d.getDate()] || []).push(e); });

    let cells = "";
    for (let i = 0; i < startDow; i++) cells += `<div class="dr-cal__cell is-empty"></div>`;
    const todayN = (hoy.getFullYear() === y && hoy.getMonth() === m) ? hoy.getDate() : -1;
    for (let d = 1; d <= days; d++) {
      const e2 = byDay[d] || [];
      cells += `<div class="dr-cal__cell ${d === todayN ? "is-today" : ""}"><div class="dr-cal__day">${d}</div>
        ${e2.slice(0, 3).map(e => `<button class="dr-cal__ev ${e.tipo === "cita" ? "is-mio" : "is-otro"}" data-accion="ver-evento" data-id="${e.id}" title="${U.esc(e.titulo)}">${e.horaInicio} ${U.esc(e.titulo.replace("Cita · ", ""))}</button>`).join("")}
        ${e2.length > 3 ? `<div class="dr-cal__more">+${e2.length - 3}</div>` : ""}</div>`;
    }
    const prox = evs.filter(e => e.fecha >= C.hoyISO()).sort((a, b) => (a.fecha + a.horaInicio).localeCompare(b.fecha + b.horaInicio)).slice(0, 7);

    /* todas las consejerías del equipo (debajo del calendario) */
    const equipoCasos = S.consejerias().filter(c => c.consejero).sort((a, b) => (a.proxima || "9999").localeCompare(b.proxima || "9999"));

    return U.shell(SHELL, U.head("Calendario coordinado", "La agenda completa del equipo: citas, reuniones y formaciones. Debajo, todas las consejerías de tu equipo.",
      `<button class="dr-btn dr-btn--primary" data-accion="nuevo-evento">＋ Nuevo evento</button>`) + `
      <div class="dr-callegend"><span><i class="dot mio"></i>Citas</span><span><i class="dot otro"></i>Reuniones / formación</span></div>
      <div class="dr-cal cs-cal--grande">
        <div class="dr-cal__bar"><button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="cal-prev">‹</button><b>${U.MESES_L[m]} ${y}</b><button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="cal-next">›</button></div>
        <div class="dr-cal__dow">${U.DOW.map(d => `<div>${d}</div>`).join("")}</div>
        <div class="dr-cal__grid">${cells}</div>
      </div>

      <div class="dr-card" style="margin-top:18px;overflow-x:auto">
        <h3 class="dr-card__t">Consejerías del equipo (${equipoCasos.length})</h3>
        <p class="dr-card__sub">Todas las consejerías asignadas, con su próxima cita y consejero.</p>
        <table class="dr-table">
          <thead><tr><th>Persona</th><th>Tipo</th><th>Consejero</th><th>Etapa</th><th>Estado</th><th>Próxima cita</th><th>Espacio</th><th></th></tr></thead>
          <tbody>${equipoCasos.length ? equipoCasos.map(c => { const cj = C.consejero(c.consejero) || {}; return `<tr>
            <td><b>${U.esc(c.persona)}</b></td>
            <td>${tipoTxt(c.tipo)}</td>
            <td>${U.esc(cj.nombre || "—")}</td>
            <td>${etapaProcChip(c)}</td>
            <td>${U.estadoChip(c.estado)}</td>
            <td>${c.proxima ? U.fechaCorta(c.proxima) + ` <small style="color:var(--texto-tenue)">(${U.fechaRel(c.proxima)})</small>` : "—"}</td>
            <td>${U.esc((C.espacio(c.espacio) || {}).nombre || "—")}</td>
            <td style="text-align:right"><button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="gestionar" data-id="${c.id}">Gestionar</button></td>
          </tr>`; }).join("") : `<tr><td colspan="9"><div class="dr-empty" style="padding:14px">Sin consejerías asignadas.</div></td></tr>`}</tbody>
        </table>
      </div>
    `, vista);
  }

  function modalEvento() {
    U.abrirModal(`
      <div class="dr-modal__head"><div><h3 id="cs-modal-t">Nuevo evento</h3><p class="dr-card__sub">Cita, reunión de equipo o formación.</p></div></div>
      <form data-accion="guardar-evento">
        <label class="dr-field"><span>Título</span><input id="cs-ev-titulo" class="dr-input" placeholder="Ej. Reunión de equipo"></label>
        <label class="dr-field"><span>Tipo</span><select id="cs-ev-tipo" class="dr-select"><option value="cita">Cita</option><option value="reunion">Reunión de equipo</option><option value="formacion">Formación</option></select></label>
        <label class="dr-field"><span>Fecha</span><input id="cs-ev-fecha" class="dr-input" type="date" value="${C.diasAdel(3)}"></label>
        <div class="dr-grid2">
          <label class="dr-field"><span>Inicio</span><input id="cs-ev-ini" class="dr-input" type="time" value="18:00"></label>
          <label class="dr-field"><span>Fin</span><input id="cs-ev-fin" class="dr-input" type="time" value="19:00"></label>
        </div>
        <label class="dr-field"><span>Espacio</span><select id="cs-ev-esp" class="dr-select">${C.ESPACIOS.map(e => `<option value="${e.id}">${e.nombre}</option>`).join("")}</select></label>
        <div class="dr-modal__acts"><button type="submit" class="dr-btn dr-btn--primary">Crear y reservar</button><button type="button" class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button></div>
      </form>
    `);
  }
  function modalEventoVer(id) {
    const e = S.eventos().find(x => x.id === id); if (!e) return;
    U.abrirModal(`
      <div class="dr-modal__head"><div><h3 id="cs-modal-t">${U.esc(e.titulo)}</h3><p class="dr-card__sub">${U.fechaCorta(e.fecha)} · ${e.horaInicio}–${e.horaFin}</p></div></div>
      <div class="cs-mini"><div class="cs-mini__row"><div><b>Espacio</b><p>${U.esc((C.espacio(e.espacioId) || {}).nombre || "—")}</p></div></div></div>
      <div class="dr-modal__acts"><button class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cerrar</button></div>
    `);
  }

  /* ============================================================ 6. CONOCIMIENTO
     Director → editable (alimenta la memoria del asistente IA).
     Coordinador → consulta (asistente). */
  const CONOC_CATS = ["Protocolos", "Guías por tema", "Recursos espirituales", "Formación"];
  function vistaConocimiento() {
    if (!conocEditable) return U.shell(SHELL, U.asistenteIA({ lead: "Consulta la base de conocimiento del operativo: protocolos de asignación, rutas de derivación y guías por tema." }), vista);
    const base = S.conocimiento();
    const docs = base.reduce((s, k) => s + (k.docs ? k.docs.length : 0), 0);
    const porCat = {}; base.forEach(k => { (porCat[k.categoria] = porCat[k.categoria] || []).push(k); });
    const cats = CONOC_CATS.concat(Object.keys(porCat).filter(c => CONOC_CATS.indexOf(c) < 0));
    const cuerpo = cats.filter(cat => (porCat[cat] || []).length).map(cat => `
      <div class="cs-kn-cat">${U.esc(cat)} · ${(porCat[cat] || []).length}</div>
      <div class="cs-kn-grid">${(porCat[cat] || []).map(cardRecurso).join("")}</div>`).join("") || `<div class="dr-empty">La base está vacía. Crea el primer recurso para alimentar al asistente.</div>`;
    return U.shell(SHELL, U.head(
      "Base de conocimiento",
      "Como dirección, aquí cargas y curas <b>todo el conocimiento base</b> de la consejería. Esto es lo que <b>alimenta la memoria del asistente IA</b> y a cada consejero.",
      `<button class="dr-btn dr-btn--primary" data-accion="nuevo-recurso">＋ Nuevo recurso</button>`
    ) + `
      <div class="dr-kpis" style="margin-bottom:18px">
        ${U.kpi(base.length, "Recursos")}${U.kpi(docs, "Documentos")}${U.kpi(Object.keys(porCat).length, "Categorías")}${U.kpi(base.filter(k => k.tipo === "Protocolo").length, "Protocolos")}
      </div>
      <div class="cs-confid" style="margin-bottom:18px">💡 El asistente responderá citando estos recursos. Cuanto más completa la base, mejores respuestas.</div>
      ${cuerpo}
    `, vista);
  }
  function cardRecurso(k) {
    return `<article class="cs-kn">
      <div class="cs-kn__top"><div class="cs-kn__ico">${k.ico || "📄"}</div><div><div class="cs-kn__t">${U.esc(k.titulo)}</div><div class="cs-kn__tipo">${U.esc(k.tipo)} · ${U.esc(k.dirigidoA)}</div></div></div>
      <p class="cs-kn__desc">${U.esc(k.desc)}</p>
      ${(k.docs && k.docs.length) ? `<div class="cs-kn__docs">${k.docs.map(d => `<div class="cs-kn__doc"><span>📎</span><b>${U.esc(d.nombre)}</b><span style="color:var(--texto-tenue)">${U.pesoKB(d.peso)}</span><button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="del-doc" data-kn="${k.id}" data-id="${d.id}" style="margin-left:auto">✕</button></div>`).join("")}</div>` : ""}
      <div class="cs-kn__foot"><span>${U.esc(k.por)} · ${U.fechaCorta(k.fecha)}</span><span style="display:flex;gap:6px"><button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="subir-doc" data-id="${k.id}">＋ Doc</button><button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="del-recurso" data-id="${k.id}">Eliminar</button></span></div>
    </article>`;
  }
  function modalNuevoRecurso() {
    U.abrirModal(`
      <div class="dr-modal__head"><div><h3 id="cs-modal-t">Nuevo recurso de conocimiento</h3><p class="dr-card__sub">Será parte de la base que alimenta al asistente.</p></div></div>
      <form data-accion="guardar-recurso">
        <label class="dr-field"><span>Título</span><input id="cs-kn-titulo" class="dr-input" placeholder="Ej. Protocolo de acompañamiento en duelo"></label>
        <div class="dr-grid2">
          <label class="dr-field"><span>Categoría</span><select id="cs-kn-cat" class="dr-select">${CONOC_CATS.map(c => `<option>${c}</option>`).join("")}</select></label>
          <label class="dr-field"><span>Tipo</span><select id="cs-kn-tipo" class="dr-select"><option>Protocolo</option><option>Guía</option><option>Documento</option><option>Video</option><option>Plantilla</option></select></label>
        </div>
        <div class="dr-grid2">
          <label class="dr-field"><span>Ícono</span><input id="cs-kn-ico" class="dr-input" value="📋"></label>
          <label class="dr-field"><span>Dirigido a</span><input id="cs-kn-dir" class="dr-input" value="Todos los consejeros"></label>
        </div>
        <label class="dr-field"><span>Descripción</span><textarea id="cs-kn-desc" class="dr-input" rows="3" placeholder="¿Qué contiene y cuándo usarlo?"></textarea></label>
        <div class="dr-modal__acts"><button type="submit" class="dr-btn dr-btn--primary">Crear recurso</button><button type="button" class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button></div>
      </form>`);
  }
  function modalSubirDoc(knId) {
    const k = S.recursoPorId(knId); if (!k) return;
    U.abrirModal(`
      <div class="dr-modal__head"><div><h3 id="cs-modal-t">Subir documento</h3><p class="dr-card__sub">A “${U.esc(k.titulo)}”.</p></div></div>
      <form data-accion="guardar-doc" data-id="${knId}">
        <label class="dr-field"><span>Archivo</span><input id="cs-doc-file" class="dr-input" type="file"></label>
        <label class="dr-field"><span>Nombre visible (opcional)</span><input id="cs-doc-nombre" class="dr-input" placeholder="Ej. Guía PDF"></label>
        <div class="dr-modal__acts"><button type="submit" class="dr-btn dr-btn--primary">Subir</button><button type="button" class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button></div>
      </form>`);
  }

  /* estado para el formulario de nuevo consejero */
  let espNuevo = [];

  /* ============================================================ EVENTOS */
  function manejar(ev) {
    const formEl = ev.target.closest("form[data-accion]");
    if (formEl && ev.type === "submit") { ev.preventDefault(); handleForm(formEl.dataset.accion, formEl); return; }
    const el = ev.target.closest("[data-accion]"); if (!el) return;
    const a = el.dataset.accion, id = el.dataset.id;
    switch (a) {
      case "salir": ev.preventDefault(); sesion = false; vista = "analitica"; render(); return;
      case "ir": ev.preventDefault(); vista = el.dataset.vista; window.scrollTo(0, 0); render(); return;
      case "f-estado": ev.preventDefault(); filtroEstado = el.dataset.f; render(); return;
      case "f-tipo": ev.preventDefault(); filtroTipo = el.dataset.f; render(); return;
      case "band-filtro": ev.preventDefault(); bandFiltro = el.dataset.f; render(); return;
      case "exp-viz": ev.preventDefault(); expCfg.viz = el.dataset.v; render(); return;
      case "exp-opt": ev.preventDefault(); expCfg[el.dataset.o] = !expCfg[el.dataset.o]; render(); return;
      case "exp-filtro": { ev.preventDefault(); const f = el.dataset.f, k = el.dataset.k; const arr = expCfg.filtros[f] = expCfg.filtros[f] || []; const i = arr.indexOf(k); if (i >= 0) arr.splice(i, 1); else arr.push(k); if (!arr.length) delete expCfg.filtros[f]; render(); return; }
      case "exp-clearflt": ev.preventDefault(); expCfg.filtros = {}; render(); return;
      case "exp-guardar": ev.preventDefault(); modalGuardarAnalisis(); return;
      case "exp-cargar": { ev.preventDefault(); const a = S.listaAnalisis().find(x => x.id === id); if (a) { expCfg = JSON.parse(JSON.stringify(a.cfg)); render(); U.toast(`Análisis “${a.nombre}” cargado`, true); } return; }
      case "exp-del": ev.preventDefault(); S.delAnalisis(id); render(); U.toast("Análisis eliminado", false); return;
      case "nueva-solicitud": ev.preventDefault(); modalNuevaSolicitud(); return;
      case "ver-persona": ev.preventDefault(); modalPersona360(el.dataset.key); return;
      case "nueva-para": { ev.preventDefault(); const p = window.CSCRM ? window.CSCRM.porKey(el.dataset.key) : null; modalNuevaSolicitud(p || {}); return; }
      case "asignar": ev.preventDefault(); modalAsignar(id); return;
      case "ver-registro": ev.preventDefault(); modalRegistro(id); return;
      case "asignar-rapido": { ev.preventDefault(); modalEnviarFormularios(id, el.dataset.cj); return; }
      case "confirmar-asignacion": {
        ev.preventDefault();
        const cjId = el.dataset.cj;
        const chks = Array.prototype.slice.call(document.querySelectorAll(".cs-form-chk:checked")).map(x => x.value);
        S.asignarYNotificar(id, cjId, chks);
        render(); modalAsignacionOk(id);
        const cj = S.equipoPorId(cjId);
        U.toast(`Asignado a ${cj ? cj.nombre.split(" ")[0] : ""} · correos enviados ✓`, true);
        return;
      }
      case "gestionar": ev.preventDefault(); modalGestionar(id); return;
      case "guardar-gestion": { ev.preventDefault(); const cj = U.val("cs-g-cj"); S.asignarConsejero(id, cj || null); S.setEstado(id, U.val("cs-g-estado")); S.setPrioridad(id, U.val("cs-g-prio")); U.cerrarModal(); render(); U.toast("Cambios guardados ✓", true); return; }
      case "ver-consejero": ev.preventDefault(); modalVerConsejero(id); return;
      case "toggle-consejero": { ev.preventDefault(); const on = S.toggleConsejero(id); U.cerrarModal(); render(); U.toast(on ? "Consejero activado ✓" : "Consejero desactivado", on); return; }
      case "del-consejero": {
        ev.preventDefault(); const cj = S.equipoPorId(id); if (!cj) return;
        if (!window.confirm(`¿Eliminar a ${cj.nombre} del equipo?\nSus casos abiertos volverán a la bandeja para reasignar.`)) return;
        S.delConsejero(id); U.cerrarModal(); render(); U.toast("Consejero eliminado · casos abiertos devueltos a la bandeja", false); return;
      }
      case "toggle-disponible": { ev.preventDefault(); const d = S.setDisponible(id); U.cerrarModal(); render(); U.toast(d ? "Marcado como disponible ✓" : "Marcado como no disponible", d); return; }
      case "equipo-clear": ev.preventDefault(); equipoQuery = ""; equipoEsp = "todos"; equipoMin = "todos"; render(); return;
      case "kpi-why": ev.preventDefault(); modalKpiWhy(el.dataset.k); return;
      case "nuevo-documento": ev.preventDefault(); modalDocumento(null); return;
      case "editar-documento": ev.preventDefault(); modalDocumento(id); return;
      case "toggle-documento": { ev.preventDefault(); const d = S.documentoPorId(id); if (d) { S.updDocumento(id, { activo: d.activo === false }); render(); U.toast(d.activo === false ? "Documento activado ✓" : "Documento desactivado", d.activo === false); } return; }
      case "del-documento": { ev.preventDefault(); const d = S.documentoPorId(id); if (!d) return; if (!window.confirm(`¿Eliminar “${d.nombre}”?`)) return; S.delDocumento(id); render(); U.toast("Documento eliminado", false); return; }
      case "nuevo-consejero": ev.preventDefault(); espNuevo = []; modalNuevoConsejero(); return;
      case "toggle-esp": { ev.preventDefault(); const t = el.dataset.t; const i = espNuevo.indexOf(t); if (i >= 0) espNuevo.splice(i, 1); else espNuevo.push(t); el.classList.toggle("is-on"); return; }
      case "nuevo-evento": ev.preventDefault(); modalEvento(); return;
      case "ver-evento": ev.preventDefault(); modalEventoVer(id); return;
      case "del-evento": ev.preventDefault(); S.delEvento(id); render(); U.toast("Evento eliminado", false); return;
      case "csa-sugerida": ev.preventDefault(); U.csaResponder(el.dataset.q); return;
      case "abrir-asistente": ev.preventDefault(); U.abrirAsistente(); return;
      case "nuevo-recurso": ev.preventDefault(); modalNuevoRecurso(); return;
      case "del-recurso": ev.preventDefault(); S.delRecurso(id); render(); U.toast("Recurso eliminado", false); return;
      case "subir-doc": ev.preventDefault(); modalSubirDoc(id); return;
      case "del-doc": ev.preventDefault(); S.delDocRecurso(el.dataset.kn, id); render(); U.toast("Documento quitado", false); return;
      case "cal-prev": ev.preventDefault(); calMes = { y: calMes.m === 0 ? calMes.y - 1 : calMes.y, m: (calMes.m + 11) % 12 }; render(); return;
      case "cal-next": ev.preventDefault(); calMes = { y: calMes.m === 11 ? calMes.y + 1 : calMes.y, m: (calMes.m + 1) % 12 }; render(); return;
      case "cerrar-modal": ev.preventDefault(); U.cerrarModal(); return;
    }
  }

  function handleForm(a, form) {
    switch (a) {
      case "guardar-solicitud": {
        const persona = U.val("cs-ns-persona"); if (!persona) { U.toast("Escribe el nombre", false); return; }
        const correo = U.val("cs-ns-correo"), tel = U.val("cs-ns-tel"), edad = parseInt(U.val("cs-ns-edad"), 10) || null, genero = U.val("cs-ns-genero");
        let creadoEnCRM = false;
        if (window.CSCRM) { const r = window.CSCRM.vincularONuevo({ nombre: persona, correo, telefono: tel, edad, genero }); creadoEnCRM = r && r.creado; }
        S.addConsejeria({ persona, correo, tel, edad, genero, ministerio: U.val("cs-ns-min") || "—", tipo: U.val("cs-ns-tipo"), prioridad: U.val("cs-ns-prio"), motivo: U.val("cs-ns-motivo") || "—" });
        U.cerrarModal(); vista = "bandeja"; render();
        U.toast(creadoEnCRM ? "Solicitud creada · persona añadida al CRM general ✓" : "Solicitud registrada ✓", true); return;
      }
      case "guardar-consejero": {
        const nombre = U.val("cs-nc-nombre"); if (!nombre) { U.toast("Escribe el nombre", false); return; }
        const min = U.val("cs-nc-min"); if (!min) { U.toast("Elige el ministerio", false); return; }
        if (!espNuevo.length) { U.toast("Elige al menos una especialidad", false); return; }
        const email = U.val("cs-nc-email"), tel = U.val("cs-nc-tel");
        S.addConsejero({ nombre, email, tel, tipoVinculo: U.val("cs-nc-vinc") || "voluntario", ministerio: min, especialidades: espNuevo.slice(), capacidad: parseInt(U.val("cs-nc-cap"), 10) || 5, cert: "Consejería" });
        if (window.CSCRM) { try { window.CSCRM.vincularONuevo({ nombre, correo: email, telefono: tel }); } catch (e) {} }
        U.cerrarModal(); render(); U.toast("Consejero agregado y sincronizado con el CRM ✓", true); return;
      }
      case "guardar-documento-nuevo": {
        const nombre = U.val("cs-dc-nombre"); if (!nombre) { U.toast("Escribe el nombre", false); return; }
        S.addDocumento({ tipo: U.val("cs-dc-tipo") || "texto", nombre, desc: U.val("cs-dc-desc"), contenido: U.val("cs-dc-contenido"), por: USER.nombre });
        U.cerrarModal(); render(); U.toast("Documento creado ✓", true); return;
      }
      case "guardar-documento-edit": {
        const did = form.dataset.id; const nombre = U.val("cs-dc-nombre"); if (!nombre) { U.toast("Escribe el nombre", false); return; }
        S.updDocumento(did, { nombre, desc: U.val("cs-dc-desc"), contenido: U.val("cs-dc-contenido") });
        U.cerrarModal(); render(); U.toast("Documento actualizado ✓", true); return;
      }
      case "guardar-evento": { const titulo = U.val("cs-ev-titulo"); if (!titulo) { U.toast("Escribe un título", false); return; } const fecha = U.val("cs-ev-fecha"), ini = U.val("cs-ev-ini"), fin = U.val("cs-ev-fin"), esp = U.val("cs-ev-esp"); if (!S.espacioLibre(esp, fecha, ini, fin)) { U.toast("Ese espacio no está libre a esa hora", false); return; } S.addEvento({ titulo, fecha, horaInicio: ini, horaFin: fin, espacioId: esp, tipo: U.val("cs-ev-tipo") || "cita" }); U.cerrarModal(); render(); U.toast("Evento creado ✓", true); return; }
      case "guardar-analisis": { const nombre = U.val("cs-an-nombre"); if (!nombre) { U.toast("Escribe un nombre", false); return; } S.addAnalisis(nombre, expCfg); U.cerrarModal(); render(); U.toast("Análisis guardado 📌", true); return; }
      case "guardar-recurso": { const titulo = U.val("cs-kn-titulo"); if (!titulo) { U.toast("Escribe un título", false); return; } S.addRecurso({ titulo, categoria: U.val("cs-kn-cat"), tipo: U.val("cs-kn-tipo"), ico: U.val("cs-kn-ico") || "📄", dirigidoA: U.val("cs-kn-dir") || "Todos los consejeros", desc: U.val("cs-kn-desc"), por: USER.nombre }); U.cerrarModal(); render(); U.toast("Recurso creado · el asistente ya puede usarlo ✓", true); return; }
      case "guardar-doc": { const knId = form.dataset.id; const fileEl = document.getElementById("cs-doc-file"); const file = fileEl && fileEl.files && fileEl.files[0] ? fileEl.files[0] : null; if (!file) { U.toast("Selecciona un archivo", false); return; } S.addDocRecurso(knId, { nombre: U.val("cs-doc-nombre") || file.name, archivo: file.name, peso: file.size }); U.cerrarModal(); render(); U.toast("Documento subido ✓", true); return; }
    }
  }

  function bindCSA() {
    const form = document.querySelector('form[data-accion="csa-enviar"]'); if (!form) return;
    form.addEventListener("submit", e => { e.preventDefault(); const inp = document.getElementById("csa-input"); const q = inp.value.trim(); if (!q) return; U.csaResponder(q); inp.value = ""; });
  }
  function onChange(ev) {
    const el = ev.target.closest("[data-accion]"); if (!el) return;
    if (el.dataset.accion === "exp-cfg") { const k = el.dataset.k; expCfg[k] = el.value; render(); }
    if (el.dataset.accion === "equipo-esp") { equipoEsp = el.value; render(); }
    if (el.dataset.accion === "equipo-min") { equipoMin = el.value; render(); }
  }
  function bindEquipoSearch() {
    const inp = document.getElementById("cs-eq-search"); if (!inp) return;
    inp.addEventListener("input", () => { equipoQuery = inp.value.trim(); const pos = inp.selectionStart; render(); const n = document.getElementById("cs-eq-search"); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } });
  }
  function bindBandSearch() {
    const inp = document.getElementById("cs-band-search"); if (!inp) return;
    inp.addEventListener("input", () => { bandQuery = inp.value.trim(); const pos = inp.selectionStart; render(); const n = document.getElementById("cs-band-search"); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } });
  }
  function bindCrmSearch() {
    const inp = document.getElementById("cs-crm-search"); if (!inp) return;
    inp.addEventListener("input", () => { crmQuery = inp.value.trim(); const pos = inp.selectionStart; render(); const n = document.getElementById("cs-crm-search"); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } });
  }

  /* ============================================================ DOCUMENTOS (formularios + correos, conectados a la asignación) */
  function vistaDocumentos() {
    const docs = S.documentos();
    const grupos = [
      { tipo: "formulario", t: "📄 Formularios de admisión", sub: "Se adjuntan al correo cuando asignas un caso. Actívalos, edítalos o elimínalos." },
      { tipo: "correo", t: "✉️ Correos automáticos", sub: "Se envían al asignar (bienvenida) y al cerrar (encuesta). Lo que edites aquí es lo que reciben las personas." },
      { tipo: "texto", t: "📝 Otros textos / documentos", sub: "Materiales que el equipo crea para adjuntar o compartir." },
    ];
    const card = d => `
      <article class="cs-doc ${d.activo === false ? "is-off" : ""}">
        <div class="cs-doc__top">
          <span class="cs-doc__ic">${d.tipo === "formulario" ? "📄" : d.tipo === "correo" ? "✉️" : "📝"}</span>
          <div class="cs-doc__idb"><b>${U.esc(d.nombre)}</b><small>${U.esc(d.desc || "")}</small></div>
          <span class="cs-doc__state ${d.activo === false ? "is-off" : "is-on"}">${d.activo === false ? "Inactivo" : "Activo"}</span>
        </div>
        ${d.tipo === "formulario" && (d.aplicaA || []).length ? `<div class="cs-doc__tags">${d.aplicaA.map(t => U.tipoChip(t)).join("")}</div>` : ""}
        ${d.archivo ? `<div class="cs-doc__file">📎 ${U.esc(d.archivo)}</div>` : ""}
        ${d.tipo !== "formulario" && d.contenido ? `<details class="cs-mailprev"><summary>👁️ Ver contenido</summary><pre class="cs-mailprev__body">${U.esc(d.contenido)}</pre></details>` : ""}
        <div class="cs-doc__meta">por ${U.esc(d.por || "—")}${d.fecha ? " · " + U.fechaCorta(d.fecha) : ""}</div>
        <div class="cs-doc__acts">
          <button class="dr-btn dr-btn--sm" data-accion="editar-documento" data-id="${d.id}">Editar</button>
          <button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="toggle-documento" data-id="${d.id}">${d.activo === false ? "Activar" : "Desactivar"}</button>
          <button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="del-documento" data-id="${d.id}" style="color:var(--peligro)">Eliminar</button>
        </div>
      </article>`;
    return U.shell(SHELL, U.head("Documentos",
      "Formularios de admisión y correos que se <b>envían automáticamente al asignar y al cerrar</b> un caso. Lo que edites aquí es lo que reciben las personas.",
      `<button class="dr-btn dr-btn--primary" data-accion="nuevo-documento">＋ Nuevo documento</button>`) +
      grupos.map(g => { const arr = docs.filter(d => d.tipo === g.tipo); return `
        <div class="cs-doc__grp"><h3>${g.t}</h3><p>${g.sub}</p></div>
        <div class="cs-doc__grid">${arr.length ? arr.map(card).join("") : `<div class="dr-empty" style="padding:16px">Sin documentos en esta categoría.</div>`}</div>`; }).join(""),
    vista);
  }
  function modalDocumento(id) {
    const d = id ? S.documentoPorId(id) : null;
    const tipos = [["formulario", "Formulario de admisión"], ["correo", "Correo automático"], ["texto", "Texto / documento"]];
    U.abrirModal(`
      <div class="dr-modal__head"><div><h3 id="cs-modal-t">${d ? "Editar documento" : "Nuevo documento"}</h3><p class="dr-card__sub">${d ? "Los correos y formularios activos se usan al asignar/cerrar." : "Créalo para adjuntarlo o enviarlo."}</p></div></div>
      <form data-accion="${d ? "guardar-documento-edit" : "guardar-documento-nuevo"}" ${d ? `data-id="${d.id}"` : ""}>
        <label class="dr-field"><span>Nombre</span><input id="cs-dc-nombre" class="dr-input" value="${d ? U.esc(d.nombre) : ""}" placeholder="Nombre del documento"></label>
        <label class="dr-field"><span>Tipo</span><select id="cs-dc-tipo" class="dr-select" ${d ? "disabled" : ""}>${tipos.map(t => `<option value="${t[0]}" ${d && d.tipo === t[0] ? "selected" : ""}>${t[1]}</option>`).join("")}</select></label>
        <label class="dr-field"><span>Descripción</span><input id="cs-dc-desc" class="dr-input" value="${d ? U.esc(d.desc || "") : ""}" placeholder="Para qué sirve"></label>
        <label class="dr-field"><span>Contenido / cuerpo <small style="color:var(--texto-tenue)">(correos y textos · variables: {{persona}} {{consejero}} {{consejeroTel}} {{tel}})</small></span><textarea id="cs-dc-contenido" class="dr-input" rows="8" placeholder="Texto del correo o documento">${d ? U.esc(d.contenido || "") : ""}</textarea></label>
        <div class="dr-modal__acts">
          <button type="submit" class="dr-btn dr-btn--primary">${d ? "Guardar cambios" : "Crear"}</button>
          <button type="button" class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button>
        </div>
      </form>
    `);
  }

  /* ============================================================ RECORDATORIOS (pendientes derivados de la data en vivo) */
  function vistaRecordatorios() {
    const cons = S.consejerias();
    const sinAsig = S.solicitudes();
    const abiertos = cons.filter(c => c.consejero && c.estado !== "cerrada");
    const stale = abiertos.filter(c => c.ultimaInteraccion && U.diasDesde(String(c.ultimaInteraccion).slice(0, 10)) > 7);
    const sinCita = abiertos.filter(c => !c.proxima);
    const cerradosSinSat = cons.filter(c => c.estado === "cerrada" && (!c.satisfaccion || c.satisfaccion.score == null));
    const hoy = C.hoyISO();
    const proxCitas = S.eventos().filter(e => e.tipo === "cita" && e.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(0, 6);

    const item = (ico, txt, sub, accion, id, extra) => `
      <div class="cs-rem__item">
        <span class="cs-rem__ic">${ico}</span>
        <div class="cs-rem__tx"><b>${txt}</b>${sub ? `<small>${sub}</small>` : ""}</div>
        ${accion ? `<button class="dr-btn dr-btn--sm" data-accion="${accion}" data-id="${id || ""}" ${extra || ""}>${accion === "asignar" ? "Asignar" : accion === "ver-registro" ? "Ver" : "Abrir"}</button>` : ""}
      </div>`;
    const bloque = (titulo, ico, arr, vacio) => `
      <div class="cs-rem__block">
        <div class="cs-rem__head"><h3>${ico} ${titulo}</h3><span class="cs-rem__n">${arr.length}</span></div>
        <div class="cs-rem__list">${arr.length ? arr.join("") : `<div class="dr-empty" style="padding:14px">${vacio}</div>`}</div>
      </div>`;

    const nombre = c => `${C.tipo(c.tipo).emoji} ${U.esc(c.persona)}`;
    return U.shell(SHELL, U.head("Recordatorios",
      "Todo lo que el equipo de consejería debe atender ahora — derivado en vivo de la operación. Cada punto te lleva a resolverlo.", "") +
      `<div class="dr-kpis" style="margin-bottom:16px">
        ${U.kpi(sinAsig.length, "Por asignar", sinAsig.length > 0)}
        ${U.kpi(stale.length, "Sin seguimiento (+7d)", stale.length > 0)}
        ${U.kpi(sinCita.length, "Sin próxima cita", sinCita.length > 0)}
        ${U.kpi(cerradosSinSat.length, "Encuestas pendientes")}
      </div>
      ${bloque("Solicitudes por asignar", "📥", sinAsig.map(c => item("🆕", nombre(c), `Espera ${U.diasDesde(c.desde)}d · ${U.esc(c.ministerio || "")}`, "asignar", c.id)), "Nada por asignar. 🎉")}
      ${bloque("Casos sin seguimiento reciente (+7 días)", "⚠️", stale.map(c => item("⏳", nombre(c), `Última interacción hace ${U.diasDesde(String(c.ultimaInteraccion).slice(0, 10))}d · ${U.esc((S.equipoPorId(c.consejero) || {}).nombre || "")}`, "ver-registro", c.id)), "Todos los casos con seguimiento al día. ✅")}
      ${bloque("Casos activos sin próxima cita", "📅", sinCita.map(c => item("🗓️", nombre(c), `${U.esc((S.equipoPorId(c.consejero) || {}).nombre || "")} · programar próxima sesión`, "ver-registro", c.id)), "Todos los casos tienen próxima cita.")}
      ${bloque("Encuestas de satisfacción sin respuesta", "⭐", cerradosSinSat.map(c => item("📨", nombre(c), `Cerrado · encuesta enviada, sin respuesta`, "ver-registro", c.id)), "Sin encuestas pendientes.")}
      ${bloque("Próximas citas agendadas", "🕒", proxCitas.map(e => item("📌", U.esc(e.titulo), `${U.fechaCorta(e.fecha)} · ${e.horaInicio}–${e.horaFin}`, null)), "Sin citas próximas.")}
    `, vista);
  }

  /* ============================================================ RENDER */
  const VISTAS = { analitica: vistaAnalitica, recordatorios: vistaRecordatorios, bandeja: vistaBandeja, consejerias: vistaConsejerias, explorador: vistaExplorador, equipo: vistaEquipo, calendario: vistaCalendario, documentos: vistaDocumentos, conocimiento: vistaConocimiento };
  function render() {
    if (!sesion) { U.app().innerHTML = U.login({ titulo: ES_DIRECTOR ? "Consejería · Dirección" : "Consejería · Coordinación", lead: ES_DIRECTOR ? "Dirige el cuidado y alimenta el conocimiento: gestiona el operativo completo y cura la base que usa el asistente IA." : "Gestiona el operativo de cuidado: recibe solicitudes, asígnalas al consejero correcto y cuida la carga del equipo.", user: USER, logo: "CS" }); const g = document.getElementById("cs-google"); if (g) g.addEventListener("click", entrar); return; }
    (U.app()).innerHTML = (VISTAS[vista] || vistaAnalitica)() + U.fab();
    if (!clickBound) { document.addEventListener("click", manejar); document.addEventListener("submit", manejar); document.addEventListener("change", onChange); clickBound = true; }
    if (vista === "conocimiento") bindCSA();
    if (vista === "bandeja") bindBandSearch();
    if (vista === "consejerias") bindCrmSearch();
    if (vista === "equipo") bindEquipoSearch();
  }
  function entrar() { sesion = true; render(); U.toast(`¡Hola, ${USER.nombre.split(" ")[0]}! 👋`, true); }

  if (S && S.onCambio) S.onCambio(() => { if (sesion) render(); });
  if (window.STORE && window.STORE.onCambio) window.STORE.onCambio(() => { if (sesion && vista === "consejerias") render(); });
  document.addEventListener("DOMContentLoaded", render);
  if (document.readyState !== "loading") render();
})();
