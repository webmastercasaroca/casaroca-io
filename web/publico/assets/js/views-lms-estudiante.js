/* ============================================================
   CASA ROCA AI SYSTEM — VISTAS · LMS ESTUDIANTE (Fase 0)
   Aula virtual: panel, materias, aula, recursos, tareas,
   exámenes, notas, foros, calendario, finanzas, matrícula,
   progreso/certificados y perfil. Todos los botones actúan.
   ============================================================ */
(function () {
  const DB = window.DB, H = window.VIEWS.H;
  const L = () => DB.LMS;

  /* ---------- helpers ---------- */
  const ICO = { lectura: "📖", archivo: "📄", video: "🎬", enlace: "🔗", pagina: "📃",
    scorm: "🧩", glosario: "📕", wiki: "📝", foro: "💬", tarea: "✍️", quiz: "❓",
    cuestionario: "🗳️", leccion: "🧭" };
  function icoRecurso(t) { return ICO[t] || "📌"; }
  function badgeEstado(e) {
    if (e === "completado") return `<span class="badge badge--exito">✓ Completado</span>`;
    if (e === "en_curso") return `<span class="badge badge--mostaza">● En curso</span>`;
    return `<span class="badge badge--azul">○ Pendiente</span>`;
  }
  function notaBadge(n) { return `<span class="badge ${n == null ? "badge--azul" : (n >= 4 ? "badge--exito" : (n >= 3 ? "badge--mostaza" : "badge--peligro"))}">${n == null ? "—" : n.toFixed(1)}</span>`; }
  function barra(pct, max) { return `<div class="progreso" style="max-width:${max || 260}px"><div class="progreso__barra" style="width:${pct}%"></div></div>`; }
  function ssoBtn(txt) { return `<button class="btn btn--primario" data-accion="demo" data-valor="🔗 Abriendo Moodle con inicio de sesión único (SSO)…">${txt || "🔗 Abrir en Moodle"}</button>`; }

  // Materias del semestre vivo del alumno demo (IBLI sem 2)
  function misMaterias() { return DB.lmsMateriasDe("ibli", 2); }

  /* ============================================================
     PANEL / DASHBOARD DEL ESTUDIANTE
     ============================================================ */
  function panelEstudiante(rol, estado) {
    const p = DB.persona("p_valentina");
    const mats = misMaterias();
    const prog = L().PROGRESO;
    const fin = L().FINANZAS;
    const prox = L().CALENDARIO.slice(0, 3);
    return `
    ${H.pageHead("Instituto IBLI · Aula virtual", `Hola, ${p.nombres} 👋`,
      "Tu casa de estudio en línea. Continúa donde quedaste y no pierdas el ritmo.")}

    <div class="grid grid-4 mb-4">
      ${H.kpi("📊", prog.avanceGlobal + "%", "Avance del programa")}
      ${H.kpi("⭐", "4.35", "Promedio acumulado")}
      ${H.kpi("🎓", prog.creditosAcum + "/" + prog.creditosTotal, "Créditos")}
      ${H.kpi("🔥", prog.racha + " días", "Racha de estudio")}
    </div>

    ${fin.estado.indexOf("Pendiente") === 0 ? `
    <div class="alerta alerta--aviso mb-4"><span class="ico">💳</span>
      <div class="grow"><b>Tienes un pago pendiente.</b> ${fin.estado} (${H.cop(fin.saldo)}).</div>
      <button class="btn btn--mostaza btn--sm" data-accion="ir" data-valor="lms-finanzas">Ir a finanzas</button>
    </div>` : ""}

    <div class="card card--pad-lg mb-4" style="background:linear-gradient(135deg,var(--azul-50),var(--mostaza-100)); border-color:var(--mostaza-300)">
      <div class="flex between items-center wrap gap-3">
        <div><b style="font-size:var(--tx-md)">Continúa: Panorama Bíblico II</b>
          <div class="txt-sm txt-suave">Unidad 2 · Lectura: Pentecostés y la misión</div>
          ${barra(72, 320)}</div>
        <div class="flex gap-2 wrap">
          <button class="btn btn--primario" data-accion="ver-aula" data-valor="ibli-21">▶ Continuar</button>
          ${ssoBtn("🔗 Mi aula en Moodle")}
        </div>
      </div>
    </div>

    <div class="flex between items-center mb-3">
      <div class="card__title">📚 Mis materias · Semestre 2</div>
      <button class="btn btn--ghost btn--sm" data-accion="ir" data-valor="lms-materias">Ver todas →</button>
    </div>
    <div class="grid grid-2 mb-4">${mats.map(tarjetaMateria).join("")}</div>

    <div class="grid grid-2">
      <div class="card card--pad-lg">
        <div class="card__title mb-3">🗓️ Próximas fechas</div>
        ${prox.map(filaEvento).join("")}
        <button class="btn btn--ghost btn--sm mt-3" data-accion="ir" data-valor="lms-calendario">Ver calendario completo →</button>
      </div>
      <div class="card card--pad-lg">
        <div class="card__title mb-3">✨ Tu tutor de estudio (IA)</div>
        <p class="txt-sm txt-suave mb-3">Puedo explicarte temas, generarte repasos o quizzes de práctica.</p>
        <div class="flex gap-2 wrap">
          <button class="btn btn--mostaza btn--sm" data-accion="demo" data-valor="🤖 Generando un repaso de los Evangelios…">Generar repaso</button>
          <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="🤖 Creando 5 preguntas de práctica…">Quiz de práctica</button>
          <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="🤖 Explícame: ¿quién escribió Hechos? → Lucas, el mismo autor del tercer evangelio.">Hacer una pregunta</button>
        </div>
      </div>
    </div>`;
  }

  function tarjetaMateria(m) {
    const d = DB.lmsDetalle(m.id) || { avance: 0, nota: null };
    return `<div class="card">
      <div class="flex between items-center mb-2">
        <b style="font-size:var(--tx-md)">${m.nombre}</b>
        ${notaBadge(d.nota)}
      </div>
      <div class="txt-sm txt-suave mb-2">${m.docenteNombre} · ${m.creditos} créditos</div>
      ${barra(d.avance, 999)}
      <div class="flex between items-center mt-3">
        <span class="txt-xs txt-suave">${d.avance}% completado</span>
        <button class="btn btn--primario btn--sm" data-accion="ver-aula" data-valor="${m.id}">Entrar al aula →</button>
      </div></div>`;
  }
  function filaEvento(e) {
    return `<div class="fila">
      <div class="cal-fecha"><b>${e.dia}</b><span>${e.mes}</span></div>
      <div class="fila__main"><b>${e.titulo}</b><span>${e.materia}</span></div>
      <span class="badge badge--${e.color}">${e.tipo}</span></div>`;
  }

  /* ============================================================
     MIS MATERIAS (lista completa)
     ============================================================ */
  function lmsMaterias(rol, estado) {
    const mats = misMaterias();
    return `
    ${H.pageHead("Aprendizaje", "Mis materias",
      "Semestre 2 · IBLI — Formación Cristiana Integral. Entra a cada aula para ver el contenido.")}
    <div class="grid grid-2">${mats.map(tarjetaMateria).join("")}</div>`;
  }

  /* ============================================================
     AULA DE MATERIA (course view)
     ============================================================ */
  function lmsAula(p, rol, estado) {
    const m = DB.lmsMateria(p.id);
    const d = DB.lmsDetalle(p.id);
    if (!m || !d) return `<div class="vacio"><div class="ico">📭</div>Materia no encontrada.</div>`;
    const totalRec = d.unidades.reduce((a, u) => a + u.recursos.length, 0);
    const hechos = d.unidades.reduce((a, u) => a + u.recursos.filter(r => r.estado === "completado").length, 0);
    return `
    ${H.volver("lms-materias", "Mis materias")}
    ${H.pageHead("Aula virtual · " + m.cohorte, m.nombre,
      m.docenteNombre + " · " + m.creditos + " créditos · " + m.modalidad)}

    <div class="grid grid-3 mb-4">
      ${H.kpi("📊", d.avance + "%", "Avance")}
      ${H.kpi("✅", hechos + "/" + totalRec, "Recursos completados")}
      ${H.kpi("⭐", d.nota ? d.nota.toFixed(1) : "—", "Nota parcial")}
    </div>

    <div class="card card--pad-lg mb-4">
      <div class="flex between items-center wrap gap-2 mb-2">
        <div class="card__title">📋 Sílabo</div>
        <div class="flex gap-2">
          ${ssoBtn("🔗 Abrir en Moodle")}
          <button class="btn btn--ghost btn--sm" data-accion="ir" data-valor="lms-foros">💬 Foro</button>
        </div>
      </div>
      <p class="txt-sm txt-suave">${d.silabo}</p>
      <div class="txt-xs txt-suave mt-2">⏰ ${d.horario}</div>
    </div>

    ${L().ANUNCIOS.filter(a => a.materia === p.id).slice(0, 1).map(a => `
      <div class="alerta alerta--info mb-4"><span class="ico">📣</span>
        <div><b>${a.titulo}</b><div class="txt-sm">${a.txt}</div>
        <div class="txt-xs txt-suave mt-2">${a.autor} · ${a.fecha}</div></div></div>`).join("")}

    ${d.unidades.map(u => unidadCard(u, p.id)).join("")}`;
  }

  function unidadCard(u, mid) {
    return `<div class="card card--pad-lg mb-4">
      <div class="card__title mb-1">${u.nombre}</div>
      <p class="txt-sm txt-suave mb-3">${u.desc}</p>
      ${u.recursos.map(r => filaRecurso(r, mid)).join("")}</div>`;
  }
  function filaRecurso(r, mid) {
    let accion;
    if (r.tipo === "tarea") accion = `data-accion="ver-tarea" data-valor="${r.evaluacion}:${mid}"`;
    else if (r.tipo === "quiz" || r.tipo === "cuestionario") accion = `data-accion="ver-quiz" data-valor="${r.evaluacion}"`;
    else if (r.tipo === "foro") accion = `data-accion="ver-foro" data-valor="${r.foro}"`;
    else accion = `data-accion="ver-recurso" data-valor="${mid}:${r.id}"`;
    return `<div class="fila">
      <span style="font-size:1.3rem">${icoRecurso(r.tipo)}</span>
      <div class="fila__main"><b>${r.nombre}</b><span>${r.dur || ""}</span></div>
      <div class="flex gap-2 items-center wrap" style="justify-content:flex-end">
        ${badgeEstado(r.estado)}
        <button class="btn btn--ghost btn--sm" ${accion}>Abrir</button></div></div>`;
  }

  /* ============================================================
     VISOR DE RECURSO
     ============================================================ */
  function lmsRecursoView(p, rol, estado) {
    const m = DB.lmsMateria(p.mid);
    const r = DB.lmsRecurso(p.mid, p.rid);
    if (!r) return `<div class="vacio"><div class="ico">📭</div>Recurso no encontrado.</div>`;
    let cuerpo = "";
    if (r.tipo === "video") {
      cuerpo = `<div style="position:relative;padding-bottom:56.25%;height:0;border-radius:var(--radio-md);overflow:hidden;background:#000">
        <iframe src="${r.url}" title="${r.nombre}" style="position:absolute;inset:0;width:100%;height:100%;border:0" allowfullscreen></iframe></div>
        <p class="txt-sm txt-suave mt-3">${r.contenido || ""}</p>`;
    } else if (r.tipo === "archivo") {
      cuerpo = `<div class="card txt-center" style="background:var(--superficie-2)">
        <div style="font-size:2.6rem">📄</div>
        <b>${r.nombre}</b><div class="txt-sm txt-suave mb-3">${r.dur || ""}</div>
        <button class="btn btn--primario" data-accion="demo" data-valor="⬇️ Descargando ${r.nombre}… (demo)">⬇️ Descargar</button></div>
        <p class="txt-sm txt-suave mt-3">${r.contenido || ""}</p>`;
    } else if (r.tipo === "scorm") {
      cuerpo = `<div class="alerta alerta--info"><span class="ico">🧩</span><div>Módulo interactivo SCORM. Se abre en Moodle con tu sesión única.</div></div>
        <p class="txt-sm txt-suave mt-3">${r.contenido || ""}</p>
        <div class="mt-3">${ssoBtn("🔗 Abrir módulo interactivo")}</div>`;
    } else {
      cuerpo = `<div class="card" style="background:var(--superficie-2);line-height:1.8"><p>${r.contenido || "Contenido de la lectura."}</p></div>`;
    }
    const completado = r.estado === "completado";
    return `
    ${H.volver("lms-aula", "Volver al aula")}
    ${H.pageHead(m.nombre + " · " + (r.dur || ""), `${icoRecurso(r.tipo)} ${r.nombre}`, "")}
    <div class="card card--pad-lg mb-4">${cuerpo}</div>
    <div class="flex between items-center wrap gap-2">
      <button class="btn btn--ghost" data-accion="ver-aula" data-valor="${p.mid}">← Aula</button>
      ${completado
        ? `<span class="badge badge--exito">✓ Marcado como completado</span>`
        : `<button class="btn btn--primario" data-accion="marcar-completado" data-valor="${p.mid}:${r.id}">✓ Marcar como completado</button>`}
    </div>`;
  }

  /* ============================================================
     ENTREGA DE TAREA
     ============================================================ */
  function lmsTarea(p, rol, estado) {
    const ev = DB.lmsEval(p.eid);
    const m = DB.lmsMateria(p.mid || (ev && ev.materia));
    if (!ev) return `<div class="vacio"><div class="ico">📭</div>Tarea no encontrada.</div>`;
    const mia = L().ENTREGAS.find(e => e.evaluacion === p.eid && e.estudiante === "p_valentina");
    return `
    ${H.volver("lms-aula", "Volver al aula")}
    ${H.pageHead((m ? m.nombre : "") + " · Tarea", "✍️ " + ev.titulo, "Entrega hasta el " + ev.entrega + " · " + ev.puntaje + " pts")}

    <div class="card card--pad-lg mb-4">
      <div class="card__title mb-2">📋 Enunciado</div>
      <p class="txt-sm txt-suave">${ev.descripcion}</p>
    </div>

    <div class="card card--pad-lg mb-4">
      <div class="card__title mb-3">📐 Rúbrica de evaluación</div>
      <table class="tabla"><thead><tr><th>Criterio</th><th>Niveles</th><th>Máx.</th></tr></thead>
        <tbody>${ev.rubrica.map(c => `<tr><td><b>${c.criterio}</b></td>
          <td class="txt-suave">${c.niveles.join(" · ")}</td><td>${Math.max.apply(null, c.pts)} pts</td></tr>`).join("")}</tbody></table>
    </div>

    <div class="card card--pad-lg">
      <div class="card__title mb-3">📤 Mi entrega</div>
      ${mia && mia.estado === "calificado" ? `
        <div class="alerta alerta--exito mb-3"><span class="ico">✓</span>
          <div><b>Calificado: ${mia.nota}</b><div class="txt-sm">${mia.feedback}</div></div></div>` : ""}
      ${mia && mia.estado === "entregado" ? `
        <div class="alerta alerta--info mb-3"><span class="ico">📨</span>
          <div><b>Entregado el ${mia.fecha}</b> — ${mia.archivo}. Pendiente de calificación.</div></div>` : ""}
      <div class="flex gap-2 wrap">
        <button class="btn btn--primario" data-accion="abrir-entrega" data-valor="${p.eid}">📎 ${mia && mia.estado !== "sin_entregar" ? "Reemplazar entrega" : "Subir entrega"}</button>
        <button class="btn btn--ghost" data-accion="demo" data-valor="🤖 La IA revisó tu borrador: buen fundamento, amplía la aplicación personal.">🤖 Revisar con IA antes de entregar</button>
      </div>
    </div>`;
  }

  /* ============================================================
     EXAMEN / QUIZ (intento)
     ============================================================ */
  function lmsQuiz(p, rol, estado) {
    const ev = DB.lmsEval(p.eid);
    if (!ev) return `<div class="vacio"><div class="ico">📭</div>Evaluación no encontrada.</div>`;
    const m = DB.lmsMateria(ev.materia);
    const tienePreg = ev.preguntas && ev.preguntas.length;
    return `
    ${H.volver("lms-aula", "Volver al aula")}
    ${H.pageHead((m ? m.nombre : "") + " · Evaluación", "❓ " + ev.titulo,
      "⏱️ " + ev.tiempo + " · " + ev.intentos + " intento(s) · Cierra " + ev.cierra)}

    <div class="alerta alerta--info mb-4"><span class="ico">⏱️</span>
      <div class="grow"><b>Tiempo restante: ${ev.tiempo}</b> — el cronómetro corre al iniciar.</div>
      <span class="badge badge--azul">Intento 1 de ${ev.intentos}</span></div>

    ${tienePreg ? `<form id="quiz-form">${ev.preguntas.map((q, i) => preguntaCard(q, i)).join("")}</form>
      <div class="flex between items-center wrap gap-2 mt-3">
        <button class="btn btn--ghost" data-accion="ver-aula" data-valor="${ev.materia}">Guardar y salir</button>
        <button class="btn btn--primario" data-accion="enviar-intento" data-valor="${ev.id}">📨 Enviar intento</button>
      </div>`
    : `<div class="card card--pad-lg txt-center">
        <div style="font-size:2.6rem">📝</div>
        <b>${ev.titulo}</b>
        <p class="txt-sm txt-suave mb-3">Esta evaluación se rinde en Moodle con inicio de sesión único. ${ev.puntaje} puntos.</p>
        ${ssoBtn("🔗 Iniciar examen en Moodle")}</div>`}`;
  }
  function preguntaCard(q, i) {
    let cuerpo = "";
    if (q.tipo === "opcion") cuerpo = q.opciones.map((o, k) =>
      `<label class="fila" style="cursor:pointer"><input type="radio" name="q${q.id}" value="${k}"> <span class="fila__main">${o}</span></label>`).join("");
    else if (q.tipo === "vf") cuerpo = ["Verdadero", "Falso"].map((o, k) =>
      `<label class="fila" style="cursor:pointer"><input type="radio" name="q${q.id}" value="${k}"> <span class="fila__main">${o}</span></label>`).join("");
    else cuerpo = `<div class="campo"><input type="text" placeholder="Tu respuesta…" aria-label="Respuesta"></div>`;
    return `<div class="card card--pad-lg mb-3">
      <div class="flex between mb-2"><b>${i + 1}. ${q.texto}</b><span class="badge badge--azul">${q.puntos} pts</span></div>
      ${cuerpo}</div>`;
  }

  /* ============================================================
     MIS CALIFICACIONES (gradebook del alumno)
     ============================================================ */
  function lmsNotas(rol, estado) {
    const mats = misMaterias();
    return `
    ${H.pageHead("Evaluación", "Mis calificaciones",
      "Semestre 2 · escala " + L().CONFIG.escala + ". Aprobado desde " + L().CONFIG.aprobado.toFixed(1) + ".")}
    <div class="grid grid-3 mb-4">
      ${H.kpi("⭐", "4.35", "Promedio del semestre")}
      ${H.kpi("✅", "4/4", "Materias en curso")}
      ${H.kpi("🎯", "0", "Materias en riesgo")}
    </div>
    ${mats.map(m => {
      const d = DB.lmsDetalle(m.id);
      return `<div class="card card--pad-lg mb-4">
        <div class="flex between items-center mb-3">
          <div class="card__title">${m.nombre}</div>${notaBadge(d.nota)}
        </div>
        <table class="tabla"><thead><tr><th>Categoría</th><th>Ponderación</th><th>Nota</th></tr></thead>
          <tbody>${d.gradebook.map(g => `<tr><td>${g.cat}</td><td>${g.pond}%</td><td>${notaBadge(g.nota)}</td></tr>`).join("")}</tbody></table>
        <div class="flex between items-center mt-3">
          <span class="txt-xs txt-suave">${m.docenteNombre}</span>
          <button class="btn btn--ghost btn--sm" data-accion="ver-aula" data-valor="${m.id}">Ir al aula →</button>
        </div></div>`;
    }).join("")}`;
  }

  /* ============================================================
     FOROS / MENSAJERÍA
     ============================================================ */
  function lmsForos(rol, estado) {
    const foros = Object.values(L().FOROS);
    return `
    ${H.pageHead("Comunidad", "Foros y mensajería",
      "Participa en los debates de tus materias y conversa con docentes y compañeros.")}

    <div class="card card--pad-lg mb-4">
      <div class="flex between items-center mb-3">
        <div class="card__title">💬 Foros de mis materias</div>
        <button class="btn btn--mostaza btn--sm" data-accion="demo" data-valor="📝 Abriendo editor para crear un nuevo tema…">+ Nuevo tema</button>
      </div>
      ${foros.map(f => {
        const m = DB.lmsMateria(f.materia);
        return `<div class="fila">
          <span style="font-size:1.3rem">💬</span>
          <div class="fila__main"><b>${f.titulo}</b><span>${m ? m.nombre : ""} · ${f.hilos.length} mensajes</span></div>
          <button class="btn btn--ghost btn--sm" data-accion="ver-foro" data-valor="${f.id}">Abrir</button></div>`;
      }).join("")}
    </div>

    <div class="card card--pad-lg">
      <div class="card__title mb-3">✉️ Mensajes</div>
      ${L().MENSAJES.map(ms => `<div class="fila">
        <div class="avatar">${ms.con.split(" ").map(w => w[0]).slice(0, 2).join("")}</div>
        <div class="fila__main"><b>${ms.con} ${ms.noLeido ? `<span class="badge badge--peligro">${ms.noLeido}</span>` : ""}</b>
          <span>${ms.ultimo}</span></div>
        <div class="flex gap-2 items-center"><span class="txt-xs txt-suave">${ms.fecha}</span>
          <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="✉️ Abriendo conversación con ${ms.con}…">Ver</button></div></div>`).join("")}
    </div>`;
  }

  function lmsForoHilo(p, rol, estado) {
    const f = DB.lmsForo(p.id);
    if (!f) return `<div class="vacio"><div class="ico">📭</div>Foro no encontrado.</div>`;
    const m = DB.lmsMateria(f.materia);
    return `
    ${H.volver("lms-foros", "Foros")}
    ${H.pageHead((m ? m.nombre : "") + " · Foro", "💬 " + f.titulo, "")}
    <div class="card card--pad-lg mb-4">
      ${f.hilos.map(h => `<div class="fila" style="align-items:flex-start">
        <div class="avatar ${h.inicial ? "" : ""}">${h.autor.split(" ").map(w => w[0]).slice(0, 2).join("")}</div>
        <div class="fila__main">
          <b>${h.autor} <span class="badge ${h.rol === "Docente" ? "badge--azul" : "badge--mostaza"}">${h.rol}</span></b>
          <span style="white-space:normal">${h.txt}</span>
          <div class="txt-xs txt-suave mt-2">${h.fecha}</div>
        </div></div>`).join("")}
    </div>
    <div class="card card--pad-lg">
      <div class="campo"><label for="foro-resp">Tu respuesta</label>
        <textarea id="foro-resp" rows="3" placeholder="Escribe tu aporte al foro…"></textarea></div>
      <div class="flex gap-2">
        <button class="btn btn--primario" data-accion="responder-foro" data-valor="${f.id}">Publicar respuesta</button>
        <button class="btn btn--ghost" data-accion="demo" data-valor="🤖 La IA sugiere: apoya tu aporte con un texto bíblico concreto.">🤖 Ayuda IA</button>
      </div>
    </div>`;
  }

  /* ============================================================
     CALENDARIO
     ============================================================ */
  function lmsCalendario(rol, estado) {
    return `
    ${H.pageHead("Aprendizaje", "Calendario académico",
      "Tus próximas entregas, exámenes, sincronías y fechas clave.")}
    <div class="card card--pad-lg">
      ${L().CALENDARIO.map(e => `<div class="fila">
        <div class="cal-fecha"><b>${e.dia}</b><span>${e.mes}</span></div>
        <div class="fila__main"><b>${e.titulo}</b><span>${e.materia}</span></div>
        <div class="flex gap-2 items-center">
          <span class="badge badge--${e.color}">${e.tipo}</span>
          <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="🗓️ ${e.titulo} — ${e.fecha}. Recordatorio activado.">Detalle</button></div></div>`).join("")}
    </div>`;
  }

  /* ============================================================
     FINANZAS DEL ESTUDIANTE
     ============================================================ */
  function lmsFinanzas(rol, estado) {
    const f = L().FINANZAS;
    return `
    ${H.pageHead("Finanzas · Instituto", "Estado de cuenta",
      "Tu matrícula, pensiones, becas y pagos. Conectado con Tesorería.")}

    <div class="grid grid-3 mb-4">
      ${H.kpi("💳", H.cop(f.saldo), "Saldo pendiente")}
      ${H.kpi("🎓", H.cop(f.pension), "Pensión mensual")}
      ${H.kpi("🎁", f.beca.nombre, "Beca activa")}
    </div>

    ${f.saldo > 0 ? `
    <div class="card card--pad-lg mb-4" style="border-color:var(--mostaza-300);background:var(--mostaza-100)">
      <div class="flex between items-center wrap gap-3">
        <div><b>${f.estado}</b><div class="txt-sm txt-suave">Evita recargos pagando a tiempo.</div></div>
        <button class="btn btn--primario" data-accion="abrir-pago" data-valor="${f.saldo}">💳 Pagar ahora</button>
      </div></div>` : ""}

    <div class="card card--pad-lg">
      <div class="card__title mb-3">🧾 Movimientos</div>
      <table class="tabla"><thead><tr><th>Fecha</th><th>Concepto</th><th>Valor</th><th>Estado</th></tr></thead>
        <tbody>${f.movimientos.map(m => `<tr>
          <td>${m.fecha}</td><td>${m.concepto}${m.nota ? `<div class="txt-xs txt-suave">${m.nota}</div>` : ""}</td>
          <td>${H.cop(m.valor)}</td>
          <td><span class="badge ${m.estado === "Pagado" ? "badge--exito" : "badge--mostaza"}">${m.estado}</span></td></tr>`).join("")}</tbody></table>
      <div class="flex gap-2 mt-3">
        <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="⬇️ Descargando recibos en PDF… (demo)">⬇️ Descargar recibos</button>
        <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="🎁 Abriendo solicitud de beca…">Solicitar beca</button>
      </div>
    </div>`;
  }

  /* ============================================================
     MATRÍCULA
     ============================================================ */
  function lmsMatricula(rol, estado) {
    const mt = L().MATRICULA;
    const prox = mt.proximo;
    const proxMaterias = prox.materias.map(id => DB.lmsMateria(id)).filter(Boolean);
    const malla = DB.LMS.MALLA.ibli;
    return `
    ${H.pageHead("Aprendizaje", "Matrícula",
      "Tu historial académico y la matrícula del próximo semestre.")}

    <div class="card card--pad-lg mb-4">
      <div class="card__title mb-3">📜 Historial académico</div>
      <table class="tabla"><thead><tr><th>Semestre</th><th>Periodo</th><th>Promedio</th><th>Créditos</th><th>Estado</th></tr></thead>
        <tbody>${mt.historial.map(h => `<tr><td>Semestre ${h.semestre}</td><td>${h.periodo}</td>
          <td>${notaBadge(h.promedio)}</td><td>${h.creditos}</td>
          <td><span class="badge ${h.estado === "Aprobado" ? "badge--exito" : "badge--mostaza"}">${h.estado}</span></td></tr>`).join("")}</tbody></table>
    </div>

    <div class="card card--pad-lg mb-4" style="background:linear-gradient(135deg,var(--azul-50),var(--exito-bg))">
      <div class="card__title mb-2">📝 Matrícula · Semestre ${prox.semestre} (${prox.periodo})</div>
      <p class="txt-sm txt-suave mb-3">La inscripción abre el <b>${prox.abre}</b>. Selecciona las materias del semestre ${prox.semestre}:</p>
      ${proxMaterias.map(m => `<label class="fila" style="cursor:pointer">
        <input type="checkbox" checked aria-label="${m.nombre}">
        <div class="fila__main"><b>${m.nombre}</b><span>${m.docenteNombre} · ${m.creditos} créditos · prerrequisito OK</span></div>
        <span class="badge badge--exito">Disponible</span></label>`).join("")}
      <div class="flex between items-center wrap gap-2 mt-3">
        <span class="txt-sm txt-suave">Valor matrícula: <b>${H.cop(L().CONFIG.valorMatricula)}</b> + pensión</span>
        <button class="btn btn--primario" data-accion="confirmar-matricula" data-valor="${prox.semestre}">Confirmar matrícula →</button>
      </div>
    </div>

    <div class="card card--pad-lg">
      <div class="card__title mb-3">🗺️ Malla completa · IBLI</div>
      <div class="grid grid-2">
        ${Object.keys(malla).map(s => `<div class="card" style="box-shadow:none;background:var(--superficie-2)">
          <b>Semestre ${s}${+s < mt.semestreActual ? ' <span class="badge badge--exito">Cursado</span>' : (+s === mt.semestreActual ? ' <span class="badge badge--mostaza">Actual</span>' : "")}</b>
          <ul class="txt-sm txt-suave mt-2" style="margin:0;padding-left:1.1rem;line-height:1.8">
            ${malla[s].map(n => `<li>${n}</li>`).join("")}</ul></div>`).join("")}
      </div>
    </div>`;
  }

  /* ============================================================
     PROGRESO · CERTIFICADOS · INSIGNIAS
     ============================================================ */
  function lmsProgreso(rol, estado) {
    const pr = L().PROGRESO;
    return `
    ${H.pageHead("Crece", "Mi progreso",
      "Tu avance global, insignias y certificados. ¡Sigue así, " + DB.persona("p_valentina").nombres + "!")}

    <div class="grid grid-4 mb-4">
      ${H.kpi("📊", pr.avanceGlobal + "%", "Avance del programa")}
      ${H.kpi("🏅", pr.nivel, "Nivel")}
      ${H.kpi("⚡", pr.puntos, "Puntos")}
      ${H.kpi("🔥", pr.racha + " días", "Racha")}
    </div>

    <div class="card card--pad-lg mb-4">
      <div class="card__title mb-3">🏆 Insignias</div>
      <div class="grid grid-auto">
        ${pr.badges.map(b => `<div class="card txt-center" style="box-shadow:none;background:${b.obtenida ? "var(--exito-bg)" : "var(--superficie-2)"};opacity:${b.obtenida ? 1 : 0.55}">
          <div style="font-size:2rem">${b.ico}</div><b>${b.nombre}</b>
          <div class="txt-xs txt-suave">${b.desc}</div>
          ${b.obtenida ? `<span class="badge badge--exito mt-2">Obtenida</span>` : `<button class="btn btn--ghost btn--sm mt-2" data-accion="demo" data-valor="🔒 Insignia bloqueada: ${b.desc}">Ver cómo</button>`}</div>`).join("")}
      </div>
    </div>

    <div class="card card--pad-lg">
      <div class="card__title mb-3">📜 Certificados</div>
      ${pr.certificados.map(c => `<div class="fila">
        <span style="font-size:1.3rem">📜</span>
        <div class="fila__main"><b>${c.nombre}</b><span>${c.tipo} · ${c.fecha}</span></div>
        <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="⬇️ Descargando certificado: ${c.nombre} (PDF, demo)">⬇️ Descargar</button></div>`).join("")}
    </div>`;
  }

  /* ============================================================
     PERFIL DEL ESTUDIANTE
     ============================================================ */
  function lmsPerfil(rol, estado) {
    const p = DB.persona("p_valentina");
    return `
    ${H.pageHead("Mi cuenta", "Perfil del estudiante", "Tus datos, preferencias y accesibilidad.")}
    <div class="grid grid-2">
      <div class="card card--pad-lg">
        <div class="flex gap-3 items-center mb-3">
          ${H.avatar(p, "avatar--lg")}
          <div><b style="font-size:var(--tx-md)">${DB.nombre(p)}</b>
            <div class="txt-sm txt-suave">IBLI · Semestre 2 · Activa</div></div>
        </div>
        <table class="tabla"><tbody>
          <tr><td class="txt-suave">Correo</td><td>${p.email}</td></tr>
          <tr><td class="txt-suave">Teléfono</td><td>${p.telefono}</td></tr>
          <tr><td class="txt-suave">Sede</td><td>${DB.sede(p.sede).nombre}</td></tr>
          <tr><td class="txt-suave">Grupo</td><td>J+25 · Café & Palabra</td></tr>
        </tbody></table>
        <button class="btn btn--ghost btn--sm mt-3" data-accion="demo" data-valor="✏️ Abriendo edición de datos…">Editar datos</button>
      </div>
      <div class="card card--pad-lg">
        <div class="card__title mb-3">⚙️ Preferencias y accesibilidad</div>
        <div class="fila"><div class="fila__main"><b>Notificaciones por correo</b><span>Recordatorios de entregas y notas</span></div>
          <button class="btn btn--ghost btn--sm activo" data-accion="config-toggle" data-valor="notif">Activado</button></div>
        <div class="fila"><div class="fila__main"><b>Notificaciones por WhatsApp</b><span>Avisos urgentes</span></div>
          <button class="btn btn--ghost btn--sm" data-accion="config-toggle" data-valor="wa">Activar</button></div>
        <div class="fila"><div class="fila__main"><b>Alto contraste</b><span>Mejor legibilidad</span></div>
          <button class="btn btn--ghost btn--sm" data-accion="config-toggle" data-valor="contraste">Activar</button></div>
        <div class="fila"><div class="fila__main"><b>Texto grande</b><span>Tamaño de fuente aumentado</span></div>
          <button class="btn btn--ghost btn--sm" data-accion="config-toggle" data-valor="texto">Activar</button></div>
      </div>
    </div>`;
  }

  /* ============================================================
     MODALES
     ============================================================ */
  function modalPago(valor) {
    return `<div class="modal"><div class="modal__head"><h2>💳 Pago en línea</h2></div>
      <div class="modal__body">
        <p class="txt-sm txt-suave mb-3">Estás pagando <b>${H.cop(+valor)}</b> · Pensión junio (beca 20% aplicada).</p>
        <div class="campo"><label>Medio de pago</label>
          <select><option>Wompi (PSE / Tarjeta)</option><option>PayU</option><option>Mercado Pago</option></select></div>
        <div class="campo"><label>Nombre en la tarjeta</label><input type="text" placeholder="Valentina Ríos"></div>
        <div class="campo"><label>Número de tarjeta</label><input type="text" placeholder="•••• •••• •••• 1208"></div>
      </div>
      <div class="modal__pie">
        <button class="btn btn--ghost" data-accion="cerrar-modal">Cancelar</button>
        <button class="btn btn--primario" data-accion="pagar" data-valor="${valor}">Pagar ${H.cop(+valor)}</button>
      </div></div>`;
  }
  function modalEntrega(eid) {
    return `<div class="modal"><div class="modal__head"><h2>📤 Subir entrega</h2></div>
      <div class="modal__body">
        <div class="campo"><label>Archivo</label>
          <div class="card txt-center" style="background:var(--superficie-2);border-style:dashed">
            <div style="font-size:2rem">📎</div><div class="txt-sm txt-suave">Arrastra tu PDF/Word o</div>
            <button class="btn btn--ghost btn--sm mt-2" data-accion="demo" data-valor="📎 Selector de archivos abierto (demo).">Seleccionar archivo</button></div></div>
        <div class="campo"><label>Comentario (opcional)</label><textarea rows="2" placeholder="Una nota para tu docente…"></textarea></div>
      </div>
      <div class="modal__pie">
        <button class="btn btn--ghost" data-accion="cerrar-modal">Cancelar</button>
        <button class="btn btn--primario" data-accion="guardar-entrega" data-valor="${eid}">Entregar tarea</button>
      </div></div>`;
  }

  Object.assign(window.VIEWS, {
    panelEstudiante, lmsMaterias, lmsAula, lmsRecursoView, lmsTarea, lmsQuiz,
    lmsNotas, lmsForos, lmsForoHilo, lmsCalendario, lmsFinanzas, lmsMatricula,
    lmsProgreso, lmsPerfil, modalPago, modalEntrega
  });
})();
