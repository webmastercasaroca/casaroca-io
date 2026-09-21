/* ============================================================
   CASA ROCA AI SYSTEM — VISTAS · ROCAKIDS RED GLOBAL (Fase 0 · v2)
   Para el Pastor Director General: asistencia en vivo de todas las
   iglesias, análisis por edad/servicio y CRM de niños por ciudad.
   Otros roles → check-in local (rocakidsLocal).
   ============================================================ */
(function () {
  const DB = window.DB, H = window.VIEWS.H;
  const RK = DB.ROCAKIDS;

  function rocakids(rol, estado) {
    // Solo la Dirección General ve la red global; si entra a una ciudad, su CRM.
    if (rol.id === "pastor_admin") {
      if (estado.params && estado.params.ciudad) return rocakidsCiudad(estado.params.ciudad, rol, estado, true);
      return rocakidsGlobal(rol, estado);
    }
    // Pastor de sede: su ciudad con análisis + CRM + check-in
    if (rol.id === "pastor_sede") return rocakidsCiudad(estado.sede, rol, estado, false);
    // Director / otros: check-in operativo local
    return window.VIEWS.rocakidsLocal(rol, estado);
  }

  /* ---------- Resumen GLOBAL de la red ---------- */
  function rocakidsGlobal(rol, estado) {
    const sedes = RK.sedes;
    const presentes = sedes.reduce((s, x) => s + x.presentes, 0);
    const registrados = sedes.reduce((s, x) => s + x.registrados, 0);
    const reportando = sedes.filter(s => s.reportando).length;
    const pct = Math.round(presentes / registrados * 100);
    // agregados por edad y servicio (toda la red)
    const edadTot = RK.edades.map((_, i) => sedes.reduce((s, x) => s + (x.porEdad[i] || 0), 0));
    const servTot = RK.servicios.map((_, i) => sedes.reduce((s, x) => s + (x.porServicio[i] || 0), 0));
    return `
    ${H.pageHead("Dirección General · RocaKids en vivo", `RocaKids · Red global <span class="badge badge--peligro" style="vertical-align:middle">🔴 EN VIVO</span>`,
      "Asistencia dominical en tiempo real de todas las iglesias Casa Roca. Entra a una ciudad para ver el CRM de niños y a qué servicio asistieron.")}

    <div class="grid grid-4 mb-4">
      ${H.kpi("🧒", presentes, "Niños presentes ahora")}
      ${H.kpi("📋", registrados, "Registrados (red)")}
      ${H.kpi("🏛️", reportando + "/" + sedes.length, "Iglesias reportando")}
      ${H.kpi("📊", pct + "%", "Asistencia")}
    </div>

    <div class="card mb-4">
      <div class="flex between items-center mb-3"><div class="card__title">🏛️ En vivo por iglesia</div>
        <span class="badge badge--exito">Actualizado hace 30 s</span></div>
      <div style="overflow-x:auto"><table class="tabla" style="min-width:680px">
        <thead><tr><th>Iglesia</th><th>Presentes</th><th>Registrados</th><th>Asistencia</th><th>Estado</th><th></th></tr></thead>
        <tbody>${sedes.map(filaSedeRK).join("")}</tbody>
      </table></div>
    </div>

    <div class="grid grid-2 mb-4">
      <div class="card card--pad-lg"><div class="card__title mb-3">📊 Análisis por edad · toda la red</div>
        ${barChart(RK.edades, edadTot, "azul")}</div>
      <div class="card card--pad-lg"><div class="card__title mb-3">🕐 Análisis por servicio · toda la red</div>
        ${barChart(RK.servicios, servTot, "mostaza")}</div>
    </div>

    <div class="alerta alerta--aviso"><span class="ico">📡</span>
      <div><b>Madrid</b> aún no reporta su asistencia de hoy. La IA enviará un recordatorio al equipo de RocaKids de esa sede.</div></div>`;
  }
  function filaSedeRK(s) {
    const pct = s.registrados ? Math.round(s.presentes / s.registrados * 100) : 0;
    return `<tr>
      <td><b>${DB.sede(s.id).nombre}</b><div class="txt-xs txt-suave">${DB.sede(s.id).pais}</div></td>
      <td><b style="font-size:var(--tx-md); color:var(--azul-800)">${s.presentes}</b></td>
      <td>${s.registrados}</td>
      <td style="min-width:120px"><div class="progreso"><div class="progreso__barra" style="width:${pct}%"></div></div><span class="txt-xs txt-suave">${pct}%</span></td>
      <td>${s.reportando ? `<span class="badge badge--exito">🔴 En vivo</span>` : `<span class="badge badge--aviso">Sin reportar</span>`}</td>
      <td>${s.reportando ? `<button class="btn btn--ghost btn--sm" data-accion="rocakids-ciudad" data-valor="${s.id}">Ver ciudad →</button>` : ""}</td>
    </tr>`;
  }

  /* ---------- CRM de niños por CIUDAD ---------- */
  function rocakidsCiudad(ciudadId, rol, estado, esDrill) {
    const s = RK.sedes.find(x => x.id === ciudadId);
    const sede = DB.sede(ciudadId);
    if (!s) return `<div class="vacio"><div class="ico">🤷</div>Ciudad sin datos de RocaKids.</div>`;
    const pct = s.registrados ? Math.round(s.presentes / s.registrados * 100) : 0;
    return `
    ${esDrill ? H.volver("rocakids", "Volver a la red global") : ""}
    ${H.pageHead("RocaKids · " + sede.nombre, `RocaKids ${sede.nombre} <span class="badge badge--peligro" style="vertical-align:middle">🔴 EN VIVO</span>`,
      "CRM de los niños registrados hoy y a qué servicio asistieron.")}

    <div class="grid grid-4 mb-4">
      ${H.kpi("🧒", s.presentes, "Presentes ahora")}
      ${H.kpi("📋", s.registrados, "Registrados")}
      ${H.kpi("📊", pct + "%", "Asistencia")}
      ${H.kpi("🕐", RK.servicios.length, "Servicios")}
    </div>

    <div class="grid grid-2 mb-4">
      <div class="card card--pad-lg"><div class="card__title mb-3">📊 Por edad</div>${barChart(RK.edades, s.porEdad, "azul")}</div>
      <div class="card card--pad-lg"><div class="card__title mb-3">🕐 Por servicio</div>${barChart(RK.servicios, s.porServicio, "mostaza")}</div>
    </div>

    <div class="card" style="padding:0; overflow:hidden">
      <div class="flex between items-center" style="padding:var(--sp-4)"><div class="card__title">🧒 CRM de niños · hoy</div>
        <button class="btn btn--mostaza btn--sm" data-accion="ir" data-valor="rocakids-checkin">＋ Check-in</button></div>
      <div style="overflow-x:auto"><table class="tabla" style="min-width:860px">
        <thead><tr><th>Niño</th><th>Edad</th><th>Salón</th><th>Servicio</th><th>Acudiente</th><th>Estado</th><th>Código</th></tr></thead>
        <tbody>${s.ninos.length ? s.ninos.map(filaNinoCRM).join("") : `<tr><td colspan="7" class="txt-center txt-suave" style="padding:24px">Sin niños registrados aún hoy.</td></tr>`}</tbody>
      </table></div>
    </div>`;
  }
  function filaNinoCRM(n) {
    const dentro = n.estado === "dentro";
    return `<tr>
      <td><div class="flex gap-2 items-center"><div class="avatar avatar--sm" style="background:var(--mostaza-200); color:var(--mostaza-700)">${n.nombre.split(" ").map(x => x[0]).slice(0, 2).join("")}</div>
        <div><b>${n.nombre}</b>${n.alergias !== "Ninguna" ? `<div class="txt-xs" style="color:var(--peligro)">⚠️ ${n.alergias}</div>` : ""}</div></div></td>
      <td>${n.edad}</td><td>${n.salon}</td>
      <td><span class="badge badge--azul">${n.servicio}</span></td>
      <td class="txt-sm">${n.acudiente}<div class="txt-xs txt-suave">${n.tel}</div></td>
      <td>${dentro ? `<span class="badge badge--exito">Dentro · ${n.hora}</span>` : `<span class="badge">Fuera</span>`}</td>
      <td><span class="badge">${n.codigo}</span></td>
    </tr>`;
  }

  /* ---------- mini gráfico de barras (CSS) ---------- */
  function barChart(labels, valores, tono) {
    const max = Math.max(1, ...valores);
    return `<div class="flex gap-2" style="height:150px; align-items:flex-end">
      ${valores.map((v, i) => `<div style="flex:1; text-align:center; display:flex; flex-direction:column; justify-content:flex-end; height:100%">
        <div style="font-weight:700; font-size:var(--tx-sm); color:var(--texto)">${v}</div>
        <div title="${labels[i]}: ${v}" style="height:${Math.round(v / max * 100)}%; min-height:4px; background:${tono === 'mostaza' ? 'linear-gradient(180deg,var(--mostaza-400),var(--mostaza-600))' : 'linear-gradient(180deg,var(--azul-500),var(--azul-700))'}; border-radius:8px 8px 0 0; margin-top:6px"></div>
        <div class="txt-xs txt-suave mt-2" style="line-height:1.2">${labels[i]}</div></div>`).join("")}
    </div>`;
  }

  Object.assign(window.VIEWS, { rocakids });
})();
