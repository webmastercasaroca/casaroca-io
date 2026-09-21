/* ============================================================
   CASA ROCA AI SYSTEM — VISTAS · LMS DOCENTE (Fase 0)
   Panel, gestión de materia, material, evaluaciones+banco,
   calificación, gradebook, asistencia, foros/anuncios,
   analítica y mensajería. Cada botón ejecuta una acción.
   ============================================================ */
(function () {
  const DB = window.DB, H = window.VIEWS.H;
  const L = () => DB.LMS;
  const DOC = "p_jariza"; // docente demo

  const ICO = { lectura: "📖", archivo: "📄", video: "🎬", enlace: "🔗", pagina: "📃",
    scorm: "🧩", glosario: "📕", wiki: "📝", foro: "💬", tarea: "✍️", quiz: "❓" };
  function icoR(t) { return ICO[t] || "📌"; }
  function notaBadge(n) { return `<span class="badge ${n == null ? "badge--azul" : (n >= 4 ? "badge--exito" : (n >= 3 ? "badge--mostaza" : "badge--peligro"))}">${n == null ? "—" : (+n).toFixed(1)}</span>`; }
  function misMaterias() { return DB.lmsMateriasDocente(DOC); }

  /* ============================================================
     PANEL DEL DOCENTE
     ============================================================ */
  function panelDocente(rol, estado) {
    const p = DB.persona(DOC);
    const mats = misMaterias();
    const porCalificar = L().ENTREGAS.filter(e => e.estado === "entregado").length;
    const enRiesgo = L().ESTUDIANTES.filter(s => s.riesgo).length;
    return `
    ${H.pageHead("Instituto · Docencia", `Hola, ${p.nombres} 👋`,
      "Tu espacio docente. Revisa entregas, sube material y acompaña a tus estudiantes.")}

    <div class="grid grid-4 mb-4">
      ${H.kpi("📚", mats.length, "Mis materias")}
      ${H.kpi("👨‍🎓", "60", "Estudiantes")}
      ${H.kpi("📥", porCalificar, "Entregas por calificar")}
      ${H.kpi("⚠️", enRiesgo, "En riesgo")}
    </div>

    ${porCalificar ? `<div class="alerta alerta--aviso mb-4"><span class="ico">📥</span>
      <div class="grow"><b>Tienes ${porCalificar} entregas por calificar.</b> No dejes esperando a tus estudiantes.</div>
      <button class="btn btn--mostaza btn--sm" data-accion="ir" data-valor="doc-calificar">Calificar ahora</button></div>` : ""}

    <div class="flex between items-center mb-3">
      <div class="card__title">📚 Mis materias</div>
      <button class="btn btn--ghost btn--sm" data-accion="ir" data-valor="doc-materias">Gestionar →</button>
    </div>
    <div class="grid grid-2 mb-4">
      ${mats.map(m => `<div class="card">
        <div class="flex between items-center mb-2"><b style="font-size:var(--tx-md)">${m.nombre}</b>
          <span class="badge badge--azul">${m.inscritos} alumnos</span></div>
        <div class="txt-sm txt-suave mb-3">${m.cohorte} · ${m.creditos} créditos</div>
        <div class="flex gap-2 wrap">
          <button class="btn btn--primario btn--sm" data-accion="ver-doc-materia" data-valor="${m.id}">Gestionar</button>
          <button class="btn btn--ghost btn--sm" data-accion="ver-gradebook" data-valor="${m.id}">Notas</button>
          <button class="btn btn--ghost btn--sm" data-accion="ver-analitica" data-valor="${m.id}">Analítica</button>
        </div></div>`).join("")}
    </div>

    <div class="grid grid-2">
      <div class="card card--pad-lg">
        <div class="card__title mb-3">🗓️ Mi agenda</div>
        <div class="fila"><div class="cal-fecha"><b>16</b><span>JUN</span></div>
          <div class="fila__main"><b>Cierra ensayo · Panorama II</b><span>4 entregas pendientes</span></div></div>
        <div class="fila"><div class="cal-fecha"><b>17</b><span>JUN</span></div>
          <div class="fila__main"><b>Sincronía · Panorama II</b><span>Martes 7:00 pm</span></div></div>
        <div class="fila"><div class="cal-fecha"><b>25</b><span>JUN</span></div>
          <div class="fila__main"><b>Examen final · Panorama II</b><span>Activar evaluación</span></div></div>
      </div>
      <div class="card card--pad-lg">
        <div class="card__title mb-3">✨ Asistente docente (IA)</div>
        <p class="txt-sm txt-suave mb-3">Te ayudo a crear quizzes, redactar retroalimentación y detectar alumnos en riesgo.</p>
        <div class="flex gap-2 wrap">
          <button class="btn btn--mostaza btn--sm" data-accion="demo" data-valor="🤖 Generando borrador de 10 preguntas sobre los Evangelios…">Generar quiz</button>
          <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="🤖 Borrador de feedback listo: destaca el fundamento bíblico y pide ampliar la aplicación.">Redactar feedback</button>
          <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="🤖 2 estudiantes en riesgo: Daniel Garzón y Laura Tobón. Sugiero contacto pastoral.">Detectar riesgo</button>
        </div>
      </div>
    </div>`;
  }

  /* ============================================================
     MIS MATERIAS (gestión)
     ============================================================ */
  function docMaterias(rol, estado) {
    const mats = misMaterias();
    return `
    ${H.pageHead("Docencia", "Gestión de materias", "Administra el contenido, las evaluaciones y las notas de tus materias.")}
    <div class="grid grid-2">
      ${mats.map(m => `<div class="card">
        <div class="flex between items-center mb-2"><b style="font-size:var(--tx-md)">${m.nombre}</b>
          <span class="badge badge--azul">${m.inscritos}/${m.cupo}</span></div>
        <div class="txt-sm txt-suave mb-3">${m.cohorte}</div>
        <div class="flex gap-2 wrap">
          <button class="btn btn--primario btn--sm" data-accion="ver-doc-materia" data-valor="${m.id}">Contenido</button>
          <button class="btn btn--ghost btn--sm" data-accion="ver-evaluaciones" data-valor="${m.id}">Evaluaciones</button>
          <button class="btn btn--ghost btn--sm" data-accion="ver-gradebook" data-valor="${m.id}">Calificaciones</button>
          <button class="btn btn--ghost btn--sm" data-accion="ver-asistencia" data-valor="${m.id}">Asistencia</button>
        </div></div>`).join("")}
    </div>`;
  }

  /* ============================================================
     GESTIÓN DE UNA MATERIA (editar sílabo + unidades/recursos)
     ============================================================ */
  function docMateria(p, rol, estado) {
    const m = DB.lmsMateria(p.id);
    if (!m) return `<div class="vacio"><div class="ico">📭</div>Materia no encontrada.</div>`;
    const d = DB.lmsDetalle(p.id);
    return `
    ${H.volver("doc-materias", "Mis materias")}
    ${H.pageHead("Gestión · " + m.cohorte, m.nombre, m.creditos + " créditos · " + m.inscritos + " estudiantes")}

    <div class="flex gap-2 wrap mb-4">
      <button class="btn btn--primario btn--sm" data-accion="crear-recurso" data-valor="${m.id}">+ Agregar recurso</button>
      <button class="btn btn--mostaza btn--sm" data-accion="ver-evaluaciones" data-valor="${m.id}">+ Crear evaluación</button>
      <button class="btn btn--ghost btn--sm" data-accion="publicar-anuncio" data-valor="${m.id}">📣 Publicar anuncio</button>
      <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="✏️ Editor de sílabo abierto…">Editar sílabo</button>
    </div>

    <div class="card card--pad-lg mb-4">
      <div class="card__title mb-2">📋 Sílabo</div>
      <p class="txt-sm txt-suave">${d ? d.silabo : "Aún no has definido el sílabo de esta materia."}</p>
    </div>

    ${d ? d.unidades.map(u => `<div class="card card--pad-lg mb-4">
      <div class="flex between items-center mb-2">
        <div class="card__title">${u.nombre}</div>
        <div class="flex gap-2">
          <button class="btn btn--ghost btn--sm" data-accion="crear-recurso" data-valor="${m.id}">+ Recurso</button>
          <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="↕️ Reordenar recursos (arrastra para cambiar el orden) — demo">↕️ Ordenar</button>
        </div>
      </div>
      <p class="txt-sm txt-suave mb-3">${u.desc}</p>
      ${u.recursos.map(r => `<div class="fila">
        <span style="font-size:1.2rem">${icoR(r.tipo)}</span>
        <div class="fila__main"><b>${r.nombre}</b><span>${r.tipo} · ${r.dur || ""}</span></div>
        <div class="flex gap-2">
          <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="✏️ Editando: ${r.nombre}">Editar</button>
          <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="👁️ Visibilidad cambiada para: ${r.nombre}">Ocultar</button>
        </div></div>`).join("")}
    </div>`).join("") : `<div class="card card--pad-lg mb-4">
      <div class="vacio"><div class="ico">📦</div>Esta materia aún no tiene unidades.<br>
        <button class="btn btn--primario btn--sm mt-3" data-accion="crear-recurso" data-valor="${m.id}">+ Crear la primera unidad</button></div></div>`}`;
  }

  /* ============================================================
     EVALUACIONES + BANCO DE PREGUNTAS
     ============================================================ */
  function docEvaluaciones(p, rol, estado) {
    const m = p && p.id ? DB.lmsMateria(p.id) : null;
    const evs = Object.values(L().EVALUACIONES).filter(e => !m || e.materia === m.id);
    return `
    ${m ? H.volver("doc-materia", "Volver a la materia") : ""}
    ${H.pageHead("Evaluación", "Evaluaciones y banco de preguntas",
      m ? m.nombre : "Tus quizzes, exámenes y tareas.")}

    <div class="flex gap-2 wrap mb-4">
      <button class="btn btn--primario btn--sm" data-accion="crear-evaluacion" data-valor="${m ? m.id : "ibli-21"}">+ Nueva evaluación</button>
      <button class="btn btn--mostaza btn--sm" data-accion="crear-pregunta" data-valor="${m ? m.id : "ibli-21"}">+ Agregar pregunta al banco</button>
      <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="🤖 IA generando 10 preguntas a partir del material…">🤖 Generar con IA</button>
    </div>

    <div class="card card--pad-lg mb-4">
      <div class="card__title mb-3">📝 Evaluaciones</div>
      <table class="tabla"><thead><tr><th>Título</th><th>Tipo</th><th>Cierra</th><th>Acciones</th></tr></thead>
        <tbody>${evs.map(e => `<tr>
          <td><b>${e.titulo}</b></td>
          <td><span class="badge badge--azul">${e.tipo}</span></td>
          <td>${e.cierra || e.entrega || "—"}</td>
          <td><div class="flex gap-2">
            <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="✏️ Editando: ${e.titulo}">Editar</button>
            ${e.tipo === "tarea"
              ? `<button class="btn btn--ghost btn--sm" data-accion="ver-calificar" data-valor="${e.id}">Calificar</button>`
              : `<button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="👁️ Vista previa de: ${e.titulo}">Vista previa</button>`}
          </div></td></tr>`).join("")}</tbody></table>
    </div>

    <div class="card card--pad-lg">
      <div class="card__title mb-3">🏦 Banco de preguntas · ejemplo (Quiz 1 · Los Evangelios)</div>
      ${(L().EVALUACIONES.q201_1.preguntas).map((q, i) => `<div class="fila">
        <span class="badge badge--mostaza">${q.tipo}</span>
        <div class="fila__main"><b>${i + 1}. ${q.texto}</b><span>${q.puntos} pts</span></div>
        <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="✏️ Editando pregunta: ${q.texto}">Editar</button></div>`).join("")}
      <button class="btn btn--ghost btn--sm mt-3" data-accion="crear-pregunta" data-valor="ibli-21">+ Agregar pregunta</button>
    </div>`;
  }

  /* ============================================================
     CALIFICAR ENTREGAS (bandeja + detalle)
     ============================================================ */
  function docCalificar(p, rol, estado) {
    const eid = (p && p.eid) || "t201_1";
    const ev = DB.lmsEval(eid);
    const entregas = DB.lmsEntregasDe(eid);
    const pend = entregas.filter(e => e.estado === "entregado").length;
    return `
    ${H.pageHead("Evaluación", "Calificar entregas", (ev ? ev.titulo : "") + " · " + pend + " por calificar")}
    <div class="card card--pad-lg">
      <table class="tabla"><thead><tr><th>Estudiante</th><th>Estado</th><th>Fecha</th><th>Nota</th><th></th></tr></thead>
        <tbody>${entregas.map(e => {
          const per = DB.persona(e.estudiante);
          const nom = per ? DB.nombre(per) : e.estudiante;
          const badge = e.estado === "calificado" ? "badge--exito" : (e.estado === "entregado" ? "badge--mostaza" : "badge--peligro");
          const lbl = e.estado === "sin_entregar" ? "Sin entregar" : e.estado;
          return `<tr>
            <td><b>${nom}</b></td>
            <td><span class="badge ${badge}">${lbl}</span></td>
            <td>${e.fecha}</td>
            <td>${notaBadge(e.nota)}</td>
            <td>${e.estado === "sin_entregar"
              ? `<button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="📲 Recordatorio enviado a ${nom}.">Recordar</button>`
              : `<button class="btn btn--primario btn--sm" data-accion="ver-entrega" data-valor="${e.id}">Calificar</button>`}</td></tr>`;
        }).join("")}</tbody></table>
      <button class="btn btn--ghost btn--sm mt-3" data-accion="demo" data-valor="⬇️ Exportando entregas a Excel… (demo)">⬇️ Exportar</button>
    </div>`;
  }

  function docEntrega(p, rol, estado) {
    const e = L().ENTREGAS.find(x => x.id === p.id);
    if (!e) return `<div class="vacio"><div class="ico">📭</div>Entrega no encontrada.</div>`;
    const ev = DB.lmsEval(e.evaluacion);
    const per = DB.persona(e.estudiante);
    return `
    ${H.volver("doc-calificar", "Bandeja de entregas")}
    ${H.pageHead("Calificación", "✍️ " + (ev ? ev.titulo : ""), (per ? DB.nombre(per) : e.estudiante) + " · entregado el " + e.fecha)}

    <div class="grid grid-2">
      <div class="card card--pad-lg">
        <div class="card__title mb-2">📄 Entrega del estudiante</div>
        <div class="card txt-center" style="background:var(--superficie-2)">
          <div style="font-size:2.2rem">📄</div><b>${e.archivo || "—"}</b>
          <button class="btn btn--ghost btn--sm mt-2" data-accion="demo" data-valor="👁️ Abriendo ${e.archivo} (demo)">Ver archivo</button></div>
        ${e.comentario ? `<p class="txt-sm txt-suave mt-3">💬 "${e.comentario}"</p>` : ""}
      </div>
      <div class="card card--pad-lg">
        <div class="card__title mb-3">📐 Rúbrica</div>
        ${(ev && ev.rubrica ? ev.rubrica : []).map((c, i) => `<div class="campo">
          <label>${c.criterio}</label>
          <select aria-label="${c.criterio}">${c.niveles.map((n, k) => `<option>${n} (${c.pts[k]} pts)</option>`).join("")}</select></div>`).join("")}
        <div class="campo"><label>Retroalimentación</label>
          <textarea rows="3" placeholder="Escribe tu feedback…">${e.feedback || ""}</textarea></div>
        <div class="flex gap-2">
          <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="🤖 Borrador de feedback generado por IA.">🤖 Sugerir feedback</button>
          <button class="btn btn--primario" data-accion="guardar-nota" data-valor="${e.id}">Guardar nota y devolver</button>
        </div>
      </div>
    </div>`;
  }

  /* ============================================================
     GRADEBOOK (matriz estudiantes × materias)
     ============================================================ */
  function docGradebook(p, rol, estado) {
    const m = p && p.id ? DB.lmsMateria(p.id) : DB.lmsMateria("ibli-21");
    const ests = L().ESTUDIANTES;
    return `
    ${H.volver("doc-materias", "Mis materias")}
    ${H.pageHead("Evaluación", "Libro de calificaciones", m.nombre + " · " + m.cohorte)}
    <div class="card card--pad-lg">
      <table class="tabla"><thead><tr><th>Estudiante</th><th>Avance</th><th>Nota actual</th><th>Estado</th><th></th></tr></thead>
        <tbody>${ests.map(s => {
          const nota = s.notas[m.id];
          return `<tr>
            <td><b>${s.nombre}</b></td>
            <td>${s.avance}%</td>
            <td>${notaBadge(nota)}</td>
            <td>${s.riesgo ? `<span class="badge badge--peligro">⚠️ En riesgo</span>` : `<span class="badge badge--exito">Al día</span>`}</td>
            <td><button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="✏️ Editando nota de ${s.nombre}…">Editar</button></td></tr>`;
        }).join("")}</tbody></table>
      <div class="flex gap-2 mt-3">
        <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="⬇️ Exportando libro de calificaciones a Excel… (demo)">⬇️ Exportar Excel</button>
        <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="⚖️ Editor de ponderaciones por categoría abierto…">Ponderaciones</button>
      </div>
    </div>`;
  }

  /* ============================================================
     ASISTENCIA
     ============================================================ */
  function docAsistencia(p, rol, estado) {
    const m = p && p.id ? DB.lmsMateria(p.id) : DB.lmsMateria("ibli-21");
    const ests = L().ESTUDIANTES;
    return `
    ${H.volver("doc-materias", "Mis materias")}
    ${H.pageHead("Docencia", "Asistencia", m.nombre + " · sincronía del martes")}
    <div class="card card--pad-lg">
      ${ests.map(s => `<div class="fila">
        <div class="avatar">${s.nombre.split(" ").map(w => w[0]).slice(0, 2).join("")}</div>
        <div class="fila__main"><b>${s.nombre}</b></div>
        <div class="flex gap-2">
          <button class="btn btn--ghost btn--sm" data-accion="asistencia" data-valor="presente:${s.nombre}">Presente</button>
          <button class="btn btn--ghost btn--sm" data-accion="asistencia" data-valor="ausente:${s.nombre}">Ausente</button>
        </div></div>`).join("")}
      <button class="btn btn--primario mt-3" data-accion="demo" data-valor="✅ Asistencia guardada para la sincronía del martes.">Guardar asistencia</button>
    </div>`;
  }

  /* ============================================================
     FOROS Y ANUNCIOS (docente)
     ============================================================ */
  function docForos(rol, estado) {
    const foros = Object.values(L().FOROS);
    return `
    ${H.pageHead("Comunidad", "Foros y anuncios", "Modera los debates y comunica a tus clases.")}
    <div class="card card--pad-lg mb-4">
      <div class="flex between items-center mb-3">
        <div class="card__title">📣 Anuncios</div>
        <button class="btn btn--mostaza btn--sm" data-accion="publicar-anuncio" data-valor="ibli-21">+ Publicar anuncio</button>
      </div>
      ${L().ANUNCIOS.map(a => `<div class="fila">
        <span style="font-size:1.3rem">📣</span>
        <div class="fila__main"><b>${a.titulo}</b><span>${a.fecha}</span></div>
        <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="✏️ Editando anuncio: ${a.titulo}">Editar</button></div>`).join("")}
    </div>
    <div class="card card--pad-lg">
      <div class="card__title mb-3">💬 Foros</div>
      ${foros.map(f => `<div class="fila">
        <span style="font-size:1.3rem">💬</span>
        <div class="fila__main"><b>${f.titulo}</b><span>${f.hilos.length} mensajes</span></div>
        <button class="btn btn--ghost btn--sm" data-accion="ver-foro" data-valor="${f.id}">Moderar</button></div>`).join("")}
    </div>`;
  }

  /* ============================================================
     ANALÍTICA DE LA MATERIA
     ============================================================ */
  function docAnalitica(p, rol, estado) {
    const m = p && p.id ? DB.lmsMateria(p.id) : DB.lmsMateria("ibli-21");
    const ests = L().ESTUDIANTES;
    const prom = (ests.reduce((a, s) => a + (s.notas[m.id] || 0), 0) / ests.filter(s => s.notas[m.id]).length).toFixed(1);
    const riesgo = ests.filter(s => s.riesgo);
    const avgAvance = Math.round(ests.reduce((a, s) => a + s.avance, 0) / ests.length);
    return `
    ${H.volver("doc-materias", "Mis materias")}
    ${H.pageHead("Analítica", "Analítica de la materia", m.nombre)}
    <div class="grid grid-3 mb-4">
      ${H.kpi("📈", avgAvance + "%", "Avance promedio")}
      ${H.kpi("⭐", prom, "Nota promedio")}
      ${H.kpi("⚠️", riesgo.length, "En riesgo")}
    </div>
    <div class="card card--pad-lg mb-4">
      <div class="card__title mb-3">📊 Distribución de avance</div>
      ${ests.map(s => `<div class="rank">
        <span class="rank__pos">${s.nombre.split(" ")[0]}</span>
        <div class="rank__bar"><div class="rank__fill" style="width:${s.avance}%"></div></div>
        <span class="txt-sm" style="width:42px;text-align:right">${s.avance}%</span></div>`).join("")}
    </div>
    ${riesgo.length ? `<div class="card card--pad-lg">
      <div class="card__title mb-3">⚠️ Estudiantes que necesitan acompañamiento</div>
      ${riesgo.map(s => `<div class="fila">
        <div class="avatar">${s.nombre.split(" ").map(w => w[0]).slice(0, 2).join("")}</div>
        <div class="fila__main"><b>${s.nombre}</b><span>Avance ${s.avance}% · promedio ${s.promedio}</span></div>
        <button class="btn btn--mostaza btn--sm" data-accion="demo" data-valor="🤝 Alerta enviada al equipo pastoral para acompañar a ${s.nombre}.">Acompañar</button></div>`).join("")}
    </div>` : ""}`;
  }

  /* ============================================================
     MENSAJERÍA (docente)
     ============================================================ */
  function docMensajes(rol, estado) {
    return `
    ${H.pageHead("Comunidad", "Mensajería", "Conversa con tus estudiantes y la coordinación.")}
    <div class="card card--pad-lg">
      ${L().ESTUDIANTES.slice(0, 5).map(s => `<div class="fila">
        <div class="avatar">${s.nombre.split(" ").map(w => w[0]).slice(0, 2).join("")}</div>
        <div class="fila__main"><b>${s.nombre}</b><span>${s.riesgo ? "Necesita acompañamiento" : "Al día"}</span></div>
        <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="✉️ Abriendo conversación con ${s.nombre}…">Escribir</button></div>`).join("")}
    </div>`;
  }

  /* ============================================================
     MODALES (docente)
     ============================================================ */
  function modalCrearRecurso(mid) {
    return `<div class="modal"><div class="modal__head"><h2>➕ Agregar recurso</h2></div>
      <div class="modal__body">
        <div class="campo"><label>Tipo de recurso</label>
          <select id="rec-tipo"><option>📖 Lectura</option><option>📄 Archivo (PDF/slides)</option><option>🎬 Video (URL/embed)</option><option>🔗 Enlace</option><option>📃 Página</option><option>🧩 SCORM</option><option>💬 Foro</option><option>✍️ Tarea</option><option>❓ Quiz</option></select></div>
        <div class="campo"><label>Título</label><input type="text" placeholder="Ej. Lectura: Introducción a Pablo"></div>
        <div class="campo"><label>Contenido / URL / archivo</label><textarea rows="3" placeholder="Pega el texto, la URL del video o sube un archivo…"></textarea></div>
        <div class="campo"><label>Unidad</label><select><option>Unidad 1</option><option>Unidad 2</option><option>Unidad 3</option><option>+ Nueva unidad</option></select></div>
      </div>
      <div class="modal__pie">
        <button class="btn btn--ghost" data-accion="cerrar-modal">Cancelar</button>
        <button class="btn btn--primario" data-accion="guardar-recurso" data-valor="${mid}">Agregar al aula</button>
      </div></div>`;
  }
  function modalCrearPregunta(mid) {
    return `<div class="modal"><div class="modal__head"><h2>➕ Nueva pregunta</h2></div>
      <div class="modal__body">
        <div class="campo"><label>Tipo</label>
          <select><option>Opción múltiple</option><option>Verdadero / Falso</option><option>Respuesta corta</option><option>Emparejar</option><option>Ensayo</option></select></div>
        <div class="campo"><label>Enunciado</label><textarea rows="2" placeholder="Escribe la pregunta…"></textarea></div>
        <div class="campo"><label>Puntos</label><input type="number" value="2" min="1"></div>
        <div class="campo"><label>Retroalimentación</label><input type="text" placeholder="Mensaje al responder…"></div>
      </div>
      <div class="modal__pie">
        <button class="btn btn--ghost" data-accion="cerrar-modal">Cancelar</button>
        <button class="btn btn--primario" data-accion="guardar-pregunta" data-valor="${mid}">Agregar al banco</button>
      </div></div>`;
  }
  function modalAnuncio(mid) {
    const m = DB.lmsMateria(mid);
    return `<div class="modal"><div class="modal__head"><h2>📣 Publicar anuncio</h2></div>
      <div class="modal__body">
        <p class="txt-sm txt-suave mb-3">Para: <b>${m ? m.nombre : "todas mis materias"}</b> — se notifica por correo y WhatsApp.</p>
        <div class="campo"><label>Título</label><input type="text" placeholder="Ej. Recordatorio del examen"></div>
        <div class="campo"><label>Mensaje</label><textarea rows="3" placeholder="Escribe el anuncio…"></textarea></div>
      </div>
      <div class="modal__pie">
        <button class="btn btn--ghost" data-accion="cerrar-modal">Cancelar</button>
        <button class="btn btn--primario" data-accion="guardar-anuncio" data-valor="${mid}">Publicar y notificar</button>
      </div></div>`;
  }

  Object.assign(window.VIEWS, {
    panelDocente, docMaterias, docMateria, docEvaluaciones, docCalificar, docEntrega,
    docGradebook, docAsistencia, docForos, docAnalitica, docMensajes,
    modalCrearRecurso, modalCrearPregunta, modalAnuncio
  });
})();
