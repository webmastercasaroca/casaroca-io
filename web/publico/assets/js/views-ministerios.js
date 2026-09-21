/* ============================================================
   CASA ROCA AI SYSTEM — VISTAS · MINISTERIOS (Fase 0 · v2)
   Hub de ministerios (congregacionales + operativos) y detalle.
   ============================================================ */
(function () {
  const DB = window.DB, V = window.VIEWS, H = window.VIEWS.H;

  function ministerios(rol, estado) {
    const congr = DB.MINISTERIOS.filter(m => m.tipo === "congregacional");
    const oper = DB.MINISTERIOS.filter(m => m.tipo === "operacional");
    const activos = DB.MINISTERIOS.filter(m => m.activo).length;
    return `
    ${H.pageHead("Pastoral", "Ministerios de la sede",
      `Todos los ministerios por momento de vida y los equipos de servicio. <b>${activos} activos</b> de ${DB.MINISTERIOS.length} en catálogo.`,
      `<button class="btn btn--ghost" data-accion="ir" data-valor="config">⚙️ Activar / crear</button>`)}

    <div class="grid grid-3 mb-4">
      ${H.kpi("🧒", congr.filter(m => m.activo).length, "Congregacionales activos")}
      ${H.kpi("🛠️", oper.filter(m => m.activo).length, "Operativos activos")}
      ${H.kpi("🙋", DB.MINISTERIOS.reduce((s, m) => s + m.voluntarios, 0), "Voluntarios totales")}
    </div>

    <div class="card__title mb-3">🧒 Congregacionales · por momento de vida y afinidad</div>
    <div class="grid grid-auto mb-5">${congr.map(tarjetaMinisterio).join("")}</div>

    <div class="card__title mb-3">🛠️ Operativos · equipos de servicio del domingo</div>
    <div class="grid grid-auto">${oper.map(tarjetaMinisterio).join("")}</div>`;
  }

  function tarjetaMinisterio(m) {
    const inactivo = !m.activo;
    return `<div class="card" style="${inactivo ? "opacity:.62" : ""}">
      <div class="flex gap-3 items-center mb-2">
        <div class="kpi__ico" style="background:${m.tipo === 'congregacional' ? 'var(--azul-100)' : 'var(--mostaza-100)'}">${m.ico}</div>
        <div class="grow"><b style="font-size:var(--tx-md)">${m.nombre}</b>
          <div class="txt-xs txt-suave">${m.tipo === 'congregacional' ? 'Congregacional' : 'Operativo'}${m.subdiv.length ? ' · ' + m.subdiv.length + ' divisiones' : ''}</div></div>
        ${m.activo ? `<span class="badge badge--exito">Activo</span>` : `<span class="badge">Inactivo</span>`}
      </div>
      <p class="txt-sm txt-suave mb-3">${m.desc}</p>
      ${m.activo
        ? `<div class="flex between txt-sm mb-3"><span>👥 ${m.personas}</span><span>🤝 ${m.grupos} grupos</span><span>🙋 ${m.voluntarios}</span></div>
           <button class="btn btn--primario btn--bloque" data-accion="ver-ministerio" data-valor="${m.id}">Ver ministerio →</button>`
        : `<button class="btn btn--mostaza btn--bloque" data-accion="toggle-ministerio" data-valor="${m.id}">＋ Activar en mi sede</button>`}
    </div>`;
  }

  function ministerio(id, rol, estado) {
    const m = DB.ministerio(id);
    if (!m) return `<div class="vacio"><div class="ico">🤷</div>Ministerio no encontrado.</div>`;
    if (!m.activo) {
      return `${H.volver("ministerios", "Volver a ministerios")}
      <div class="card card--pad-lg txt-center">
        <div style="font-size:3rem">${m.ico}</div>
        <h1 class="mt-3">${m.nombre}</h1>
        <p class="txt-suave mt-2 mb-4">${m.desc}</p>
        <div class="alerta alerta--aviso" style="justify-content:center"><span class="ico">🧩</span><div>Este ministerio está <b>inactivo</b> en tu sede.</div></div>
        <button class="btn btn--mostaza mt-4" data-accion="toggle-ministerio" data-valor="${m.id}">＋ Activar en mi sede</button>
      </div>`;
    }
    const grupos = DB.GRUPOS.filter(g => g.ministerio === m.id);
    const esRocaKids = m.id === "m_rocakids";
    return `
    ${H.volver("ministerios", "Volver a ministerios")}
    <div class="card card--pad-lg mb-4" style="background:linear-gradient(135deg,var(--azul-800),var(--azul-900)); color:#fff; border:none">
      <div class="flex gap-4 items-center wrap">
        <div style="font-size:2.4rem; width:76px; height:76px; display:grid; place-items:center; background:var(--mostaza-500); border-radius:var(--radio-md)">${m.ico}</div>
        <div class="grow"><h1 style="font-size:var(--tx-xl)">${m.nombre}</h1>
          <div class="txt-sm" style="opacity:.85">${m.desc}</div>
          <div class="txt-sm mt-2">🧑‍🏫 Director: <b>${m.director}</b></div></div>
        <div class="flex gap-2 wrap">
          <button class="btn btn--mostaza btn--sm" data-accion="demo" data-valor="Abriendo gestión de voluntarios del ministerio…">🙋 Voluntarios</button>
          <button class="btn btn--ghost btn--sm" style="color:#fff;border-color:rgba(255,255,255,.4)" data-accion="demo" data-valor="Generando reporte del ministerio…">📊 Reporte</button>
        </div>
      </div>
    </div>

    <div class="grid grid-4 mb-4">
      ${H.kpi("👥", m.personas, "Personas")}
      ${H.kpi("🧩", m.subdiv.length || grupos.length, m.subdiv.length ? "Divisiones" : "Grupos")}
      ${H.kpi("🤝", m.grupos, "Grupos")}
      ${H.kpi("🙋", m.voluntarios, "Voluntarios")}
    </div>

    ${m.subdiv.length ? `
    <div class="card card--pad-lg mb-4">
      <div class="flex between items-center mb-3"><div class="card__title">🧩 ${esRocaKids ? "Salones por edad" : "Divisiones"}</div>
        <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="Creando nueva división dentro del ministerio…">＋ Añadir división</button></div>
      ${m.subdiv.map(s => `<div class="fila"><span style="font-size:1.3rem">${esRocaKids ? "🧒" : "🧩"}</span>
        <div class="fila__main"><b>${s.nombre} <span class="txt-xs txt-suave">· ${s.rango}</span></b><span>Líder: ${s.lider}</span></div>
        <div class="flex gap-2 items-center"><span class="badge badge--azul">${s.miembros} personas</span>
        <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="Abriendo la división ${s.nombre}…">Ver</button></div></div>`).join("")}
    </div>` : ""}

    ${grupos.length ? `
    <div class="card card--pad-lg mb-4"><div class="card__title mb-3">🤝 Grupos del ministerio</div>
      <div class="grid grid-auto">${grupos.map(V.tarjetaGrupo).join("")}</div></div>` : ""}

    ${esRocaKids ? `<div class="alerta alerta--info"><span class="ico">🔐</span>
      <div>Hoy es domingo — <button class="btn btn--mostaza btn--sm" style="margin-left:6px" data-accion="ir" data-valor="rocakids">Abrir check-in RocaKids →</button></div></div>` : ""}

    ${m.tipo === "operacional" ? `<div class="card card--pad-lg">
      <div class="card__title mb-3">📅 Turnos del domingo</div>
      <div class="alerta alerta--aviso mb-3"><span class="ico">⏰</span><div>2 servidores aún no confirman su turno del próximo domingo.</div></div>
      <button class="btn btn--primario" data-accion="demo" data-valor="Enviando recordatorio de turno a los servidores…">Recordar turnos por WhatsApp</button>
    </div>` : ""}`;
  }

  Object.assign(window.VIEWS, { ministerios, ministerio });
})();
