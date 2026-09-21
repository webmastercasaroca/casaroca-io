/* ============================================================
   CASA ROCA AI SYSTEM — VISTAS · INSTITUTO LMS (Fase 0 · v2)
   IBLI / FACTER: malla por semestre, materias con avance/nota,
   panel del alumno y panel académico, SSO a Moodle.
   ============================================================ */
(function () {
  const DB = window.DB, H = window.VIEWS.H;

  function instituto(rol, estado) {
    const mat = DB.MATRICULA_DEMO;
    const inst = DB.instituto(mat.instituto);
    const esAcademico = ["pastor_admin", "pastor_sede"].includes(rol.id);
    return `
    ${H.pageHead("Crece · Unidad Educativa", "Instituto Bíblico",
      "Aprendizaje virtual real en <b>Moodle</b> con inicio de sesión único. Aquí ves matrícula, malla y avance.")}

    <div class="grid grid-2 mb-5">${DB.INSTITUTOS.map(tarjetaInstituto).join("")}</div>

    <!-- Panel del alumno (mi avance) -->
    <div class="card__title mb-3">🎓 Mi formación · ${DB.nombre(DB.persona(mat.alumno))}</div>
    <div class="card card--pad-lg mb-4" style="background:linear-gradient(135deg,var(--azul-50),var(--mostaza-100)); border-color:var(--mostaza-300)">
      <div class="flex between items-center wrap gap-3 mb-2">
        <div><b style="font-size:var(--tx-md)">${inst.nombre}</b>
          <div class="txt-sm txt-suave">Semestre ${mat.semestre} de ${inst.semestres} · ${inst.modalidad}</div></div>
        <div class="flex gap-4">
          <div class="kpi"><div class="kpi__val" style="font-size:var(--tx-lg)">${mat.promedio}</div><div class="kpi__lbl">Promedio</div></div>
          <div class="kpi"><div class="kpi__val" style="font-size:var(--tx-lg)">${mat.creditos}</div><div class="kpi__lbl">Créditos</div></div>
        </div>
      </div>
      <button class="btn btn--primario mt-2" data-accion="demo" data-valor="Abriendo Moodle con inicio de sesión único (SSO)…">🔗 Abrir mi aula en Moodle</button>
    </div>

    <div class="card card--pad-lg mb-4">
      <div class="card__title mb-3">📚 Materias del semestre ${mat.semestre} (en curso)</div>
      ${inst.malla[mat.semestre].map(filaMateria).join("")}
    </div>

    <!-- Malla completa -->
    <div class="card card--pad-lg mb-4">
      <div class="card__title mb-3">🗺️ Malla curricular · ${inst.nombre}</div>
      <div class="grid grid-2">
        ${Object.keys(inst.malla).map(sem => `
          <div class="card" style="box-shadow:none; background:var(--superficie-2)">
            <b>Semestre ${sem}${parseInt(sem) === mat.semestre ? ' <span class="badge badge--mostaza">Actual</span>' : (parseInt(sem) < mat.semestre ? ' <span class="badge badge--exito">Cursado</span>' : '')}</b>
            <ul class="txt-sm txt-suave mt-2" style="margin:0; padding-left:1.1rem; line-height:1.8">
              ${inst.malla[sem].map(x => `<li>${x.nombre} <span class="txt-xs">· ${x.creditos} créd.</span></li>`).join("")}
            </ul></div>`).join("")}
      </div>
    </div>

    ${esAcademico ? panelAcademico(inst) : `<div class="card"><button class="btn btn--mostaza" data-accion="demo" data-valor="Enviando solicitud de matrícula al siguiente semestre…">📝 Solicitar matrícula próximo semestre</button></div>`}`;
  }

  function tarjetaInstituto(i) {
    return `<div class="card">
      <div class="flex gap-3 items-center mb-2"><div class="kpi__ico" style="background:var(--exito-bg)">${i.ico}</div>
        <div class="grow"><b style="font-size:var(--tx-md)">${i.nombre}</b>
          <div class="txt-xs txt-suave">${i.semestres} semestres · ${i.modalidad}</div></div>
        ${i.sso ? `<span class="badge badge--azul">SSO Moodle</span>` : ""}</div>
      <p class="txt-sm txt-suave mb-3">${i.desc}</p>
      <div class="flex between txt-sm mb-3"><span>👨‍🎓 ${i.alumnos} alumnos</span><span>🧑‍🏫 ${i.docentes} docentes</span></div>
      <button class="btn btn--primario btn--bloque" data-accion="demo" data-valor="Abriendo ${i.nombre} en Moodle…">Ver programa →</button></div>`;
  }

  function filaMateria(m) {
    const avance = m.avance != null ? m.avance : 0;
    const nota = m.nota != null ? m.nota : "—";
    return `<div class="fila"><span style="font-size:1.2rem">📖</span>
      <div class="fila__main"><b>${m.nombre} <span class="txt-xs txt-suave">· ${m.creditos} créditos</span></b>
        <span>${m.profesor}</span>
        <div class="progreso mt-2" style="max-width:240px"><div class="progreso__barra" style="width:${avance}%"></div></div></div>
      <div class="flex gap-2 items-center">
        <span class="badge badge--azul">Nota ${nota}</span>
        <span class="badge ${avance >= 100 ? "badge--exito" : "badge--mostaza"}">${avance}%</span>
        <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="Abriendo la materia ${m.nombre} en Moodle…">Aula</button></div></div>`;
  }

  function panelAcademico(inst) {
    return `<div class="card card--pad-lg">
      <div class="flex between items-center mb-3"><div class="card__title">🧑‍🏫 Panel académico (coordinación)</div>
        <button class="btn btn--mostaza btn--sm" data-accion="demo" data-valor="Abriendo gestión de matrículas…">Gestionar matrículas</button></div>
      <div class="grid grid-3 mb-3">
        ${H.kpi("👨‍🎓", inst.alumnos, "Alumnos activos")}
        ${H.kpi("📈", "82%", "Retención semestre")}
        ${H.kpi("🎓", "19", "Próximos a graduar")}
      </div>
      <div class="alerta alerta--aviso"><span class="ico">⚠️</span><div>7 alumnos con avance &lt; 40% en el semestre. La IA sugiere acompañamiento académico.</div></div>
    </div>`;
  }

  Object.assign(window.VIEWS, { instituto });
})();
