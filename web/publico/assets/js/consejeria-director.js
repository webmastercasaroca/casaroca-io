/* ============================================================
   ⚠️ ARCHIVO EN DESUSO — el director ahora usa consejeria-coordinador.js
   con window.CS_ROLE={user:"director"} (motor compartido). Se conserva
   solo como referencia histórica.
   CASA ROCA · APP DEL DIRECTOR DE CONSEJERÍA
   Demo: Pastor Franklin Peña. Es quien se hace cargo de dar
   TODO el conocimiento base: cura protocolos, guías y recursos que
   alimentarán al asistente virtual y a los consejeros. Además ve la
   analítica del operativo, el equipo y su formación, y el calendario.
   Estado compartido EN VIVO con consejeros y coordinación.
   ============================================================ */
(function () {
  "use strict";
  const C = window.CONSE, S = window.CONSESTORE, U = window.CSUI;
  const USER = C.DIRECTOR_USER;

  let sesion = false, vista = "analitica", clickBound = false;
  let calMes = null;
  const CATEGORIAS = ["Protocolos", "Guías por tema", "Recursos espirituales", "Formación"];

  const NAV = [
    { id: "analitica",    ico: "📊", lbl: "Analítica" },
    { id: "conocimiento", ico: "📚", lbl: "Conocimiento" },
    { id: "asistente",    ico: "🤲", lbl: "Asistente IA" },
    { id: "equipo",       ico: "🤝", lbl: "Equipo" },
    { id: "calendario",   ico: "📅", lbl: "Calendario" },
  ];
  const SHELL = { user: USER, nav: NAV, logo: "CS", sub: "Consejería · Dirección" };

  /* ============================================================ 1. CONOCIMIENTO (base curada) */
  function vistaConocimiento() {
    const base = S.conocimiento();
    const docs = base.reduce((s, k) => s + (k.docs ? k.docs.length : 0), 0);
    const porCat = {};
    base.forEach(k => { (porCat[k.categoria] = porCat[k.categoria] || []).push(k); });
    const cats = CATEGORIAS.concat(Object.keys(porCat).filter(c => CATEGORIAS.indexOf(c) < 0));

    const cuerpo = cats.filter(cat => (porCat[cat] || []).length).map(cat => `
      <div class="cs-kn-cat">${U.esc(cat)} · ${(porCat[cat] || []).length}</div>
      <div class="cs-kn-grid">${(porCat[cat] || []).map(cardRecurso).join("")}</div>
    `).join("") || `<div class="dr-empty">La base está vacía. Crea el primer recurso para empezar a alimentar al asistente.</div>`;

    return U.shell(SHELL, U.head(
      "Base de conocimiento",
      "Aquí cargas y curas <b>todo el conocimiento base</b> de la consejería: protocolos, guías por tema y recursos espirituales. Esto es lo que alimentará al asistente virtual y a cada consejero.",
      `<button class="dr-btn dr-btn--primary" data-accion="nuevo-recurso">＋ Nuevo recurso</button>`
    ) + `
      <div class="dr-kpis" style="margin-bottom:18px">
        ${U.kpi(base.length, "Recursos")}
        ${U.kpi(docs, "Documentos")}
        ${U.kpi(Object.keys(porCat).length, "Categorías")}
        ${U.kpi(base.filter(k => k.tipo === "Protocolo").length, "Protocolos")}
      </div>
      <div class="cs-confid" style="margin-bottom:18px">💡 El asistente virtual responderá citando estos recursos. Cuanto más completa la base, mejores respuestas.</div>
      ${cuerpo}
    `, vista);
  }

  function cardRecurso(k) {
    return `
    <article class="cs-kn">
      <div class="cs-kn__top">
        <div class="cs-kn__ico">${k.ico || "📄"}</div>
        <div><div class="cs-kn__t">${U.esc(k.titulo)}</div><div class="cs-kn__tipo">${U.esc(k.tipo)} · ${U.esc(k.dirigidoA)}</div></div>
      </div>
      <p class="cs-kn__desc">${U.esc(k.desc)}</p>
      ${(k.docs && k.docs.length) ? `<div class="cs-kn__docs">${k.docs.map(d => `<div class="cs-kn__doc"><span>📎</span><b>${U.esc(d.nombre)}</b><span style="color:var(--texto-tenue)">${U.pesoKB(d.peso)}</span><button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="del-doc" data-kn="${k.id}" data-id="${d.id}" style="margin-left:auto">✕</button></div>`).join("")}</div>` : ""}
      <div class="cs-kn__foot">
        <span>${U.esc(k.por)} · ${U.fechaCorta(k.fecha)}</span>
        <span style="display:flex;gap:6px">
          <button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="subir-doc" data-id="${k.id}">＋ Doc</button>
          <button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="del-recurso" data-id="${k.id}">Eliminar</button>
        </span>
      </div>
    </article>`;
  }

  function modalNuevoRecurso() {
    U.abrirModal(`
      <div class="dr-modal__head"><div><h3 id="cs-modal-t">Nuevo recurso de conocimiento</h3><p class="dr-card__sub">Será parte de la base que alimenta al asistente.</p></div></div>
      <form data-accion="guardar-recurso">
        <label class="dr-field"><span>Título</span><input id="cs-kn-titulo" class="dr-input" placeholder="Ej. Protocolo de acompañamiento en duelo"></label>
        <div class="dr-grid2">
          <label class="dr-field"><span>Categoría</span><select id="cs-kn-cat" class="dr-select">${CATEGORIAS.map(c => `<option>${c}</option>`).join("")}</select></label>
          <label class="dr-field"><span>Tipo</span><select id="cs-kn-tipo" class="dr-select"><option>Protocolo</option><option>Guía</option><option>Documento</option><option>Video</option><option>Plantilla</option></select></label>
        </div>
        <div class="dr-grid2">
          <label class="dr-field"><span>Ícono</span><input id="cs-kn-ico" class="dr-input" placeholder="📋" value="📋"></label>
          <label class="dr-field"><span>Dirigido a</span><input id="cs-kn-dir" class="dr-input" placeholder="Todos los consejeros" value="Todos los consejeros"></label>
        </div>
        <label class="dr-field"><span>Descripción</span><textarea id="cs-kn-desc" class="dr-input" rows="3" placeholder="¿Qué contiene y cuándo usarlo?"></textarea></label>
        <div class="dr-modal__acts"><button type="submit" class="dr-btn dr-btn--primary">Crear recurso</button><button type="button" class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button></div>
      </form>
    `);
  }

  function modalSubirDoc(knId) {
    const k = S.recursoPorId(knId); if (!k) return;
    U.abrirModal(`
      <div class="dr-modal__head"><div><h3 id="cs-modal-t">Subir documento</h3><p class="dr-card__sub">A “${U.esc(k.titulo)}”.</p></div></div>
      <form data-accion="guardar-doc" data-id="${knId}">
        <label class="dr-field"><span>Archivo</span><input id="cs-doc-file" class="dr-input" type="file"></label>
        <label class="dr-field"><span>Nombre visible (opcional)</span><input id="cs-doc-nombre" class="dr-input" placeholder="Ej. Guía PDF"></label>
        <div class="dr-modal__acts"><button type="submit" class="dr-btn dr-btn--primary">Subir</button><button type="button" class="dr-btn dr-btn--ghost" data-accion="cerrar-modal">Cancelar</button></div>
      </form>
    `);
  }

  /* ============================================================ 2. ASISTENTE IA */
  function vistaAsistente() {
    return U.shell(SHELL, U.asistenteIA({
      lead: "Así verán los consejeros al asistente. Aquí puedes probar cómo responde con la base que has cargado. La conexión al motor de IA se habilitará en una fase próxima.",
    }), vista);
  }

  /* ============================================================ 3. EQUIPO + FORMACIÓN */
  function vistaEquipo() {
    const eq = S.equipo();
    const cert = eq.filter(c => c.cert).length;
    return U.shell(SHELL, U.head("Equipo y formación", "Tus consejeros, sus especialidades y certificaciones. Aquí cuidas que cada uno esté preparado.", "") + `
      <div class="dr-kpis" style="margin-bottom:18px">
        ${U.kpi(eq.length, "Consejeros")}
        ${U.kpi(eq.filter(c => c.activo).length, "Activos")}
        ${U.kpi(cert, "Con certificación")}
        ${U.kpi(C.TIPOS.length, "Áreas cubiertas")}
      </div>
      <div class="cs-team">
        ${eq.map(c => `<article class="cs-member ${c.activo ? "" : "is-off"}">
          <div class="cs-member__top"><div class="cs-member__ava">${U.esc(U.iniciales(c.nombre))}</div>
            <div class="cs-member__nom"><b>${U.esc(c.nombre)}</b><small>${c.activo ? "Activo" : "En pausa"}</small></div></div>
          <div class="cs-member__load">🎓 ${U.esc(c.cert || "Sin certificación registrada")}</div>
          <div class="cs-member__esp">${(c.especialidades || []).map(e => U.tipoChip(e)).join("") || '<span style="color:var(--texto-tenue);font-size:12px">Sin especialidades</span>'}</div>
          <div class="cs-member__acts"><a class="dr-btn dr-btn--sm" href="mailto:${c.email}">Correo</a></div>
        </article>`).join("")}
      </div>
    `, vista);
  }

  /* ============================================================ 4. ANALÍTICA */
  function vistaAnalitica() {
    const all = S.consejerias();
    const base = S.conocimiento();
    const docs = base.reduce((s, k) => s + (k.docs ? k.docs.length : 0), 0);
    const act = all.filter(c => c.estado === "activa").length;
    const cerr = all.filter(c => c.estado === "cerrada").length;

    const porTipo = C.TIPOS.map(t => ({ lbl: t.nombre.split(" ")[0], v: all.filter(c => c.tipo === t.id).length, color: t.color })).filter(r => r.v > 0);
    const baseCat = {}; base.forEach(k => baseCat[k.categoria] = (baseCat[k.categoria] || 0) + 1);
    const baseFilas = Object.keys(baseCat).map((c, i) => ({ lbl: c.split(" ")[0], v: baseCat[c], color: U.PALETA[i % U.PALETA.length] }));
    /* cobertura: ¿cada tipo de consejería tiene material? */
    const cobertura = C.TIPOS.map(t => {
      const tieneMat = base.some(k => (k.dirigidoA || "").toLowerCase().includes(t.nombre.split(" ")[0].toLowerCase()) || (k.titulo || "").toLowerCase().includes(t.nombre.split(" ")[0].toLowerCase()));
      const casos = all.filter(c => c.tipo === t.id).length;
      return { t, tieneMat, casos };
    });
    const cobPct = U.pct(cobertura.filter(c => c.tieneMat).length, C.TIPOS.length);

    return U.shell(SHELL, U.head("Analítica de la dirección", "La salud del conocimiento y del operativo de consejería en la sede.", "", true) + `
      <div class="dr-kpis">
        ${U.kpi(base.length, "Recursos en la base")}
        ${U.kpi(docs, "Documentos")}
        ${U.kpi(cobPct + "%", "Cobertura por tema", cobPct < 70)}
        ${U.kpi(all.length, "Consejerías")}
        ${U.kpi(act, "Activas")}
        ${U.kpi(cerr, "Cerradas")}
      </div>
      <div class="dr-charts">
        ${U.columns("Base por categoría", `${base.length} recursos`, baseFilas, r => r.color)}
        ${U.donut("Demanda por tipo", `${all.length} consejerías`, porTipo)}
        ${U.gauges("Cobertura de material por tema", "¿Cada tema tiene recurso de apoyo?", cobertura.map(c => ({ lbl: c.t.nombre.split(" ")[0], v: c.tieneMat ? 100 : 0, color: c.tieneMat ? "var(--exito)" : "var(--peligro)" })))}
      </div>
    `, vista);
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
        ${e2.slice(0, 3).map(e => `<button class="dr-cal__ev ${e.tipo === "formacion" ? "is-mio" : "is-otro"}" data-accion="ver-evento" data-id="${e.id}" title="${U.esc(e.titulo)}">${e.horaInicio} ${U.esc(e.titulo.replace("Cita · ", ""))}</button>`).join("")}
        ${e2.length > 3 ? `<div class="dr-cal__more">+${e2.length - 3}</div>` : ""}</div>`;
    }
    const prox = evs.filter(e => e.fecha >= C.hoyISO()).sort((a, b) => (a.fecha + a.horaInicio).localeCompare(b.fecha + b.horaInicio)).slice(0, 7);

    return U.shell(SHELL, U.head("Calendario", "Formaciones, reuniones de equipo y citas del operativo.",
      `<button class="dr-btn dr-btn--primary" data-accion="nuevo-evento">＋ Programar formación</button>`) + `
      <div class="dr-callegend"><span><i class="dot mio"></i>Formación</span><span><i class="dot otro"></i>Citas / reuniones</span></div>
      <div class="dr-grid2" style="align-items:start">
        <div class="dr-cal">
          <div class="dr-cal__bar"><button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="cal-prev">‹</button><b>${U.MESES_L[m]} ${y}</b><button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="cal-next">›</button></div>
          <div class="dr-cal__dow">${U.DOW.map(d => `<div>${d}</div>`).join("")}</div>
          <div class="dr-cal__grid">${cells}</div>
        </div>
        <div class="dr-card"><h3 class="dr-card__t">Próximos</h3><div class="cs-mini">
          ${prox.length ? prox.map(e => `<div class="cs-mini__row"><div><b>${U.esc(e.titulo)}</b><p>${U.fechaCorta(e.fecha)} · ${e.horaInicio}–${e.horaFin}</p></div><button class="dr-btn dr-btn--ghost dr-btn--sm" data-accion="del-evento" data-id="${e.id}">✕</button></div>`).join("") : `<div class="dr-empty" style="padding:14px">Sin eventos.</div>`}
        </div></div>
      </div>
    `, vista);
  }

  function modalEvento() {
    U.abrirModal(`
      <div class="dr-modal__head"><div><h3 id="cs-modal-t">Nuevo evento</h3><p class="dr-card__sub">Formación, reunión o cita.</p></div></div>
      <form data-accion="guardar-evento">
        <label class="dr-field"><span>Título</span><input id="cs-ev-titulo" class="dr-input" placeholder="Ej. Capacitación · escucha activa"></label>
        <label class="dr-field"><span>Tipo</span><select id="cs-ev-tipo" class="dr-select"><option value="formacion">Formación</option><option value="reunion">Reunión de equipo</option><option value="cita">Cita</option></select></label>
        <label class="dr-field"><span>Fecha</span><input id="cs-ev-fecha" class="dr-input" type="date" value="${C.diasAdel(7)}"></label>
        <div class="dr-grid2">
          <label class="dr-field"><span>Inicio</span><input id="cs-ev-ini" class="dr-input" type="time" value="18:30"></label>
          <label class="dr-field"><span>Fin</span><input id="cs-ev-fin" class="dr-input" type="time" value="20:00"></label>
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

  /* ============================================================ EVENTOS */
  function manejar(ev) {
    const formEl = ev.target.closest("form[data-accion]");
    if (formEl && ev.type === "submit") { ev.preventDefault(); handleForm(formEl.dataset.accion, formEl); return; }
    const el = ev.target.closest("[data-accion]"); if (!el) return;
    const a = el.dataset.accion, id = el.dataset.id;
    switch (a) {
      case "salir": ev.preventDefault(); sesion = false; vista = "analitica"; render(); return;
      case "ir": ev.preventDefault(); vista = el.dataset.vista; window.scrollTo(0, 0); render(); return;
      case "nuevo-recurso": ev.preventDefault(); modalNuevoRecurso(); return;
      case "del-recurso": ev.preventDefault(); S.delRecurso(id); render(); U.toast("Recurso eliminado", false); return;
      case "subir-doc": ev.preventDefault(); modalSubirDoc(id); return;
      case "del-doc": ev.preventDefault(); S.delDocRecurso(el.dataset.kn, id); render(); U.toast("Documento quitado", false); return;
      case "nuevo-evento": ev.preventDefault(); modalEvento(); return;
      case "ver-evento": ev.preventDefault(); modalEventoVer(id); return;
      case "del-evento": ev.preventDefault(); S.delEvento(id); render(); U.toast("Evento eliminado", false); return;
      case "csa-sugerida": ev.preventDefault(); U.csaResponder(el.dataset.q); return;
      case "abrir-asistente": ev.preventDefault(); U.abrirAsistente(); return;
      case "cal-prev": ev.preventDefault(); calMes = { y: calMes.m === 0 ? calMes.y - 1 : calMes.y, m: (calMes.m + 11) % 12 }; render(); return;
      case "cal-next": ev.preventDefault(); calMes = { y: calMes.m === 11 ? calMes.y + 1 : calMes.y, m: (calMes.m + 1) % 12 }; render(); return;
      case "cerrar-modal": ev.preventDefault(); U.cerrarModal(); return;
    }
  }

  function handleForm(a, form) {
    switch (a) {
      case "guardar-recurso": { const titulo = U.val("cs-kn-titulo"); if (!titulo) { U.toast("Escribe un título", false); return; } S.addRecurso({ titulo, categoria: U.val("cs-kn-cat"), tipo: U.val("cs-kn-tipo"), ico: U.val("cs-kn-ico") || "📄", dirigidoA: U.val("cs-kn-dir") || "Todos los consejeros", desc: U.val("cs-kn-desc"), por: USER.nombre }); U.cerrarModal(); render(); U.toast("Recurso creado ✓", true); return; }
      case "guardar-doc": { const knId = form.dataset.id; const fileEl = document.getElementById("cs-doc-file"); const file = fileEl && fileEl.files && fileEl.files[0] ? fileEl.files[0] : null; if (!file) { U.toast("Selecciona un archivo", false); return; } S.addDocRecurso(knId, { nombre: U.val("cs-doc-nombre") || file.name, archivo: file.name, peso: file.size }); U.cerrarModal(); render(); U.toast("Documento subido ✓", true); return; }
      case "guardar-evento": { const titulo = U.val("cs-ev-titulo"); if (!titulo) { U.toast("Escribe un título", false); return; } const fecha = U.val("cs-ev-fecha"), ini = U.val("cs-ev-ini"), fin = U.val("cs-ev-fin"), esp = U.val("cs-ev-esp"); if (!S.espacioLibre(esp, fecha, ini, fin)) { U.toast("Ese espacio no está libre a esa hora", false); return; } S.addEvento({ titulo, fecha, horaInicio: ini, horaFin: fin, espacioId: esp, tipo: U.val("cs-ev-tipo") || "formacion" }); U.cerrarModal(); render(); U.toast("Evento creado ✓", true); return; }
    }
  }

  function bindCSA() {
    const form = document.querySelector('form[data-accion="csa-enviar"]'); if (!form) return;
    form.addEventListener("submit", e => { e.preventDefault(); const inp = document.getElementById("csa-input"); const q = inp.value.trim(); if (!q) return; U.csaResponder(q); inp.value = ""; });
  }

  /* ============================================================ RENDER */
  const VISTAS = { conocimiento: vistaConocimiento, asistente: vistaAsistente, equipo: vistaEquipo, analitica: vistaAnalitica, calendario: vistaCalendario };
  function render() {
    if (!sesion) { U.app().innerHTML = U.login({ titulo: "Consejería · Dirección", lead: "Cuida y alimenta el conocimiento de la consejería. Entra para curar la base, preparar al equipo y supervisar el operativo.", user: USER, logo: "CS" }); const g = document.getElementById("cs-google"); if (g) g.addEventListener("click", entrar); return; }
    (U.app()).innerHTML = (VISTAS[vista] || vistaAnalitica)() + U.fab();
    if (!clickBound) { document.addEventListener("click", manejar); document.addEventListener("submit", manejar); clickBound = true; }
    if (vista === "asistente") bindCSA();
  }
  function entrar() { sesion = true; render(); U.toast(`Bienvenida, ${USER.nombre.replace("Ps. ", "").split(" ")[0]} 👋`, true); }

  if (S && S.onCambio) S.onCambio(() => { if (sesion) render(); });
  document.addEventListener("DOMContentLoaded", render);
  if (document.readyState !== "loading") render();
})();
