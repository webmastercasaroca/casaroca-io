/* ============================================================
   CASA ROCA AI SYSTEM — VISTAS · LMS ACADÉMICO (Fase 0)
   Dirección/Coordinación: hub Academia, programas y mallas,
   secciones/cohortes, matrículas, finanzas académicas,
   analítica global, certificación/graduación y configuración.
   ============================================================ */
(function () {
  const DB = window.DB, H = window.VIEWS.H;
  const L = () => DB.LMS;

  /* ============================================================
     HUB ACADEMIA
     ============================================================ */
  function academiaHub(rol, estado) {
    const a = L().ANALITICA;
    const cards = [
      { r: "aca-programas", ico: "🎓", t: "Programas y mallas", d: "IBLI y FACTER · 8 semestres × 4 materias." },
      { r: "aca-secciones", ico: "🧩", t: "Secciones y cohortes", d: "Crea secciones y asigna docentes." },
      { r: "aca-matriculas", ico: "📝", t: "Matrículas", d: "Aprueba, matrícula masiva y retiros." },
      { r: "aca-finanzas", ico: "💰", t: "Finanzas académicas", d: "Pensiones, becas, cartera y recaudo." },
      { r: "aca-analitica", ico: "📊", t: "Analítica global", d: "Retención, deserción y desempeño." },
      { r: "aca-certificacion", ico: "📜", t: "Certificación y graduación", d: "Candidatos a graduar y certificados." },
      { r: "aca-config", ico: "⚙️", t: "Configuración del LMS", d: "Escalas, SSO Moodle e integraciones." }
    ];
    return `
    ${H.pageHead("Instituto · Dirección académica", "Academia (LMS)",
      "Gobierna toda la unidad educativa: programas, docentes, matrículas, finanzas y analítica.")}

    <div class="grid grid-4 mb-4">
      ${H.kpi("👨‍🎓", a.matriculados, "Estudiantes")}
      ${H.kpi("📈", a.retencion + "%", "Retención")}
      ${H.kpi("⚠️", a.enRiesgo, "En riesgo")}
      ${H.kpi("🎓", a.graduandos, "Próximos a graduar")}
    </div>

    <div class="grid grid-2">
      ${cards.map(c => `<div class="card">
        <div class="flex gap-3 items-center mb-2">
          <div class="kpi__ico">${c.ico}</div>
          <div class="grow"><b style="font-size:var(--tx-md)">${c.t}</b>
            <div class="txt-sm txt-suave">${c.d}</div></div></div>
        <button class="btn btn--primario btn--bloque" data-accion="ir" data-valor="${c.r}">Abrir →</button></div>`).join("")}
    </div>`;
  }

  /* ============================================================
     PROGRAMAS Y MALLAS
     ============================================================ */
  function acaProgramas(rol, estado) {
    return `
    ${H.volver("academia", "Academia")}
    ${H.pageHead("Gestión académica", "Programas y mallas", "Estructura curricular de la unidad educativa.")}
    <div class="flex gap-2 wrap mb-4">
      <button class="btn btn--primario btn--sm" data-accion="demo" data-valor="➕ Asistente para crear un nuevo programa…">+ Nuevo programa</button>
      <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="✏️ Editor de prerrequisitos abierto…">Editar prerrequisitos</button>
    </div>
    ${L().PROGRAMAS.map(pr => `<div class="card card--pad-lg mb-4">
      <div class="flex between items-center wrap gap-2 mb-3">
        <div><b style="font-size:var(--tx-md)">${pr.ico} ${pr.nombre} — ${pr.titulo}</b>
          <div class="txt-sm txt-suave">${pr.semestres} semestres · ${pr.alumnos} alumnos · ${pr.docentes} docentes · ${pr.modalidad}</div></div>
        <span class="badge badge--azul">SSO Moodle</span>
      </div>
      <div class="grid grid-2">
        ${Object.keys(L().MALLA[pr.id]).map(s => `<div class="card" style="box-shadow:none;background:var(--superficie-2)">
          <b>Semestre ${s}</b>
          <ul class="txt-sm txt-suave mt-2" style="margin:0;padding-left:1.1rem;line-height:1.8">
            ${L().MALLA[pr.id][s].map(n => `<li>${n}</li>`).join("")}</ul></div>`).join("")}
      </div>
      <button class="btn btn--ghost btn--sm mt-3" data-accion="demo" data-valor="✏️ Editando malla de ${pr.nombre}…">Editar malla</button>
    </div>`).join("")}`;
  }

  /* ============================================================
     SECCIONES Y COHORTES
     ============================================================ */
  function acaSecciones(rol, estado) {
    return `
    ${H.volver("academia", "Academia")}
    ${H.pageHead("Gestión académica", "Secciones y cohortes", "Asigna docentes y controla cupos por sección.")}
    <div class="flex gap-2 wrap mb-4">
      <button class="btn btn--primario btn--sm" data-accion="demo" data-valor="➕ Creando nueva sección…">+ Nueva sección</button>
      <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="🧑‍🏫 Asistente de asignación de docentes abierto…">Asignar docentes</button>
    </div>
    <div class="card card--pad-lg">
      <table class="tabla"><thead><tr><th>Materia</th><th>Docente</th><th>Cohorte</th><th>Cupo</th><th></th></tr></thead>
        <tbody>${L().SECCIONES.map(s => `<tr>
          <td><b>${s.nombre}</b></td><td>${s.docente}</td><td>${s.cohorte}</td>
          <td>${s.inscritos}/${s.cupo}</td>
          <td><button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="✏️ Editando sección: ${s.nombre}">Editar</button></td></tr>`).join("")}</tbody></table>
    </div>`;
  }

  /* ============================================================
     MATRÍCULAS
     ============================================================ */
  function acaMatriculas(rol, estado) {
    const pend = [
      { id: "p_valentina", nombre: "Valentina Ríos", prog: "IBLI", sem: 3, estado: "Pendiente de pago" },
      { id: "s_mateo", nombre: "Mateo Gil", prog: "IBLI", sem: 3, estado: "Pendiente revisión" },
      { id: "s_paula", nombre: "Paula Niño", prog: "IBLI", sem: 3, estado: "Pendiente de pago" }
    ];
    return `
    ${H.volver("academia", "Academia")}
    ${H.pageHead("Gestión académica", "Matrículas", "Aprueba solicitudes, matricula cohortes completas o registra retiros.")}
    <div class="flex gap-2 wrap mb-4">
      <button class="btn btn--primario btn--sm" data-accion="demo" data-valor="👥 Matrícula masiva: 142 estudiantes promovidos al semestre 3 (demo).">Matrícula masiva por cohorte</button>
      <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="📤 Exportando matrículas… (demo)">Exportar</button>
    </div>
    <div class="card card--pad-lg">
      <div class="card__title mb-3">📥 Solicitudes pendientes</div>
      ${pend.map(p => `<div class="fila">
        <div class="avatar">${p.nombre.split(" ").map(w => w[0]).slice(0, 2).join("")}</div>
        <div class="fila__main"><b>${p.nombre}</b><span>${p.prog} · Semestre ${p.sem} · ${p.estado}</span></div>
        <div class="flex gap-2">
          <button class="btn btn--primario btn--sm" data-accion="aprobar-matricula" data-valor="${p.nombre}">Aprobar</button>
          <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="✕ Solicitud de ${p.nombre} devuelta con observación.">Devolver</button>
        </div></div>`).join("")}
    </div>`;
  }

  /* ============================================================
     FINANZAS ACADÉMICAS (cartera)
     ============================================================ */
  function acaFinanzas(rol, estado) {
    const c = L().CARTERA;
    return `
    ${H.volver("academia", "Academia")}
    ${H.pageHead("Finanzas académicas", "Pensiones, becas y cartera", "Recaudo, mora y becas — conciliado con Tesorería.")}
    <div class="grid grid-3 mb-4">
      ${H.kpi("💰", "$" + c.recaudoMes + "M", "Recaudo del mes")}
      ${H.kpi("✅", c.alDia, "Al día")}
      ${H.kpi("⚠️", c.enMora, "En mora")}
    </div>

    <div class="card card--pad-lg mb-4">
      <div class="flex between items-center mb-3">
        <div class="card__title">⚠️ Cartera en mora</div>
        <button class="btn btn--mostaza btn--sm" data-accion="demo" data-valor="📲 Recordatorios de pago enviados a 14 estudiantes en mora.">Enviar recordatorios</button>
      </div>
      <table class="tabla"><thead><tr><th>Estudiante</th><th>Programa</th><th>Saldo</th><th>Días</th><th></th></tr></thead>
        <tbody>${c.morosos.map(m => `<tr>
          <td><b>${m.nombre}</b></td><td>${m.programa} · S${m.semestre}</td>
          <td>${H.cop(m.saldo)}</td>
          <td><span class="badge ${m.dias > 30 ? "badge--peligro" : "badge--mostaza"}">${m.dias} días</span></td>
          <td><button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="📲 Recordatorio individual enviado a ${m.nombre}.">Recordar</button></td></tr>`).join("")}</tbody></table>
    </div>

    <div class="card card--pad-lg">
      <div class="flex between items-center mb-3">
        <div class="card__title">🎁 Becas y descuentos</div>
        <button class="btn btn--primario btn--sm" data-accion="demo" data-valor="🎁 Asistente para asignar una nueva beca…">+ Asignar beca</button>
      </div>
      <table class="tabla"><thead><tr><th>Tipo de beca</th><th>Beneficiarios</th><th>Descuento</th></tr></thead>
        <tbody>${c.becas.map(b => `<tr><td>${b.tipo}</td><td>${b.beneficiarios}</td><td>${b.descuento}</td></tr>`).join("")}</tbody></table>
      <button class="btn btn--ghost btn--sm mt-3" data-accion="demo" data-valor="🔄 Conciliando matrículas con Tesorería / Siigo… (demo)">🔄 Conciliar con Tesorería</button>
    </div>`;
  }

  /* ============================================================
     ANALÍTICA GLOBAL
     ============================================================ */
  function acaAnalitica(rol, estado) {
    const a = L().ANALITICA;
    const maxSem = Math.max.apply(null, a.porSemestre.map(s => s.alumnos));
    return `
    ${H.volver("academia", "Academia")}
    ${H.pageHead("Analítica", "Analítica global", "Desempeño de toda la unidad educativa.")}
    <div class="grid grid-4 mb-4">
      ${H.kpi("👨‍🎓", a.matriculados, "Matriculados")}
      ${H.kpi("📈", a.retencion + "%", "Retención")}
      ${H.kpi("📉", a.desercion + "%", "Deserción")}
      ${H.kpi("⭐", a.promedioRed, "Promedio red")}
    </div>

    <div class="grid grid-2 mb-4">
      ${a.porPrograma.map(pr => `<div class="card card--pad-lg">
        <div class="card__title mb-2">${pr.programa}</div>
        <div class="flex between txt-sm"><span>Matriculados</span><b>${pr.matriculados}</b></div>
        <div class="flex between txt-sm"><span>Retención</span><b>${pr.retencion}%</b></div>
        <div class="flex between txt-sm"><span>Promedio</span><b>${pr.promedio}</b></div></div>`).join("")}
    </div>

    <div class="card card--pad-lg">
      <div class="card__title mb-3">📊 Estudiantes por semestre</div>
      ${a.porSemestre.map(s => `<div class="rank">
        <span class="rank__pos">S${s.sem}</span>
        <div class="rank__bar"><div class="rank__fill" style="width:${Math.round(s.alumnos / maxSem * 100)}%"></div></div>
        <span class="txt-sm" style="width:120px;text-align:right">${s.alumnos} · ${s.retencion}% ret.</span></div>`).join("")}
      <button class="btn btn--ghost btn--sm mt-3" data-accion="demo" data-valor="⬇️ Exportando reporte analítico (PDF)… (demo)">⬇️ Exportar reporte</button>
    </div>`;
  }

  /* ============================================================
     CERTIFICACIÓN Y GRADUACIÓN
     ============================================================ */
  function acaCertificacion(rol, estado) {
    const cand = [
      { nombre: "Camila Vargas", prog: "FACTER", promedio: 4.6, creditos: "80/80" },
      { nombre: "Andrea Suárez", prog: "IBLI", promedio: 4.7, creditos: "78/80" },
      { nombre: "Mateo Gil", prog: "IBLI", promedio: 4.3, creditos: "80/80" }
    ];
    return `
    ${H.volver("academia", "Academia")}
    ${H.pageHead("Certificación", "Certificación y graduación", "Candidatos a graduar y emisión de certificados/insignias.")}
    <div class="card card--pad-lg mb-4">
      <div class="flex between items-center mb-3">
        <div class="card__title">🎓 Candidatos a graduar (${cand.length})</div>
        <button class="btn btn--primario btn--sm" data-accion="demo" data-valor="🎓 Emitiendo certificados de graduación para 3 candidatos… (demo)">Emitir certificados</button>
      </div>
      <table class="tabla"><thead><tr><th>Estudiante</th><th>Programa</th><th>Promedio</th><th>Créditos</th><th></th></tr></thead>
        <tbody>${cand.map(c => `<tr>
          <td><b>${c.nombre}</b></td><td>${c.prog}</td><td>${c.promedio}</td><td>${c.creditos}</td>
          <td><button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="📜 Certificado emitido para ${c.nombre}.">Emitir</button></td></tr>`).join("")}</tbody></table>
    </div>
    <div class="card card--pad-lg">
      <div class="card__title mb-3">🏅 Plantillas de certificado e insignias</div>
      <div class="flex gap-2 wrap">
        <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="🎨 Editor de plantilla de certificado abierto…">Plantilla de certificado</button>
        <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="🏅 Editor de insignias (badges) abierto…">Diseñar insignias</button>
      </div>
    </div>`;
  }

  /* ============================================================
     CONFIGURACIÓN DEL LMS
     ============================================================ */
  function acaConfig(rol, estado) {
    const cfg = L().CONFIG;
    return `
    ${H.volver("academia", "Academia")}
    ${H.pageHead("Configuración", "Configuración del LMS", "Parámetros académicos, SSO Moodle e integraciones.")}
    <div class="grid grid-2 mb-4">
      <div class="card card--pad-lg">
        <div class="card__title mb-3">📐 Parámetros académicos</div>
        <table class="tabla"><tbody>
          <tr><td class="txt-suave">Escala de notas</td><td>${cfg.escala}</td></tr>
          <tr><td class="txt-suave">Nota mínima de aprobación</td><td>${cfg.aprobado.toFixed(1)}</td></tr>
          <tr><td class="txt-suave">Valor del crédito</td><td>${H.cop(cfg.valorCredito)}</td></tr>
          <tr><td class="txt-suave">Valor matrícula</td><td>${H.cop(cfg.valorMatricula)}</td></tr>
          <tr><td class="txt-suave">Valor pensión</td><td>${H.cop(cfg.valorPension)}</td></tr>
        </tbody></table>
        <button class="btn btn--ghost btn--sm mt-3" data-accion="demo" data-valor="✏️ Editando parámetros académicos…">Editar parámetros</button>
      </div>
      <div class="card card--pad-lg">
        <div class="card__title mb-3">🔌 Integraciones</div>
        ${cfg.integraciones.map(i => `<div class="fila">
          <div class="fila__main"><b>${i.nombre}</b><span>${i.desc}</span></div>
          <button class="btn btn--ghost btn--sm ${i.estado ? "activo" : ""}" data-accion="config-toggle" data-valor="${i.id}">${i.estado ? "Conectado" : "Conectar"}</button></div>`).join("")}
      </div>
    </div>`;
  }

  Object.assign(window.VIEWS, {
    academiaHub, acaProgramas, acaSecciones, acaMatriculas, acaFinanzas,
    acaAnalitica, acaCertificacion, acaConfig
  });
})();
