/* ============================================================
   CASA ROCA AI SYSTEM — MOTOR DE LA APP (Fase 0 · v2)
   Estado, navegación por alcance jerárquico, router y acciones.
   ============================================================ */
(function () {
  const DB = window.DB;
  const V = window.VIEWS;

  const estado = { rol: null, sede: "bogota", ruta: "panel", params: {}, iaAbierto: false, sidebarColapsado: false };
  window.ESTADO = estado;

  /* ---------- Navegación por rol (agrupada por sistema) ----------
     Grupos: pastoral, formacion, operativos, erp, sistema
  ------------------------------------------------------------------ */
  function navPorRol(rolId) {
    const I = {
      panel: { id: "panel", lbl: "Panel", ico: "🏠" },
      finanzas: { id: "finanzas", lbl: "Finanzas", ico: "💰" },
      aprobaciones: { id: "aprobaciones", lbl: "Aprobaciones", ico: "📥" },
      personas: { id: "personas", lbl: "Personas (CRM)", ico: "👥" },
      ministerios: { id: "ministerios", lbl: "Ministerios", ico: "🧩" },
      grupos: { id: "grupos", lbl: "Grupos pequeños", ico: "🤝" },
      rocakids: { id: "rocakids", lbl: "RocaKids", ico: "🧒" },
      cursos: { id: "cursos", lbl: "Cursos", ico: "📚" },
      instituto: { id: "instituto", lbl: "Instituto IBLI·FACTER", ico: "🎓" },
      admin: { id: "admin", lbl: "ERP / Equipos", ico: "🧱" },
      donaciones: { id: "donaciones", lbl: "Tesorería", ico: "💛" },
      filiales: { id: "filiales", lbl: "Filiales", ico: "🏛️" },
      config: { id: "config", lbl: "Configuración", ico: "⚙️" },
      organigrama: { id: "orgfilial", lbl: "Organigrama", ico: "🗂️" },
      nuevos: { id: "nuevos", lbl: "Nuevos", ico: "✨" },
      contabilidad: { id: "contabilidad", lbl: "Contabilidad", ico: "📊" },
      operativos: { id: "operativos", lbl: "Equipos operativos", ico: "🛠️" },
      consejerias: { id: "consejerias", lbl: "Consejerías", ico: "🤲" },
      // --- LMS: Estudiante ---
      e_panel: { id: "panel", lbl: "Inicio", ico: "🏠" },
      e_materias: { id: "lms-materias", lbl: "Mis materias", ico: "📚" },
      e_notas: { id: "lms-notas", lbl: "Calificaciones", ico: "📊" },
      e_calendario: { id: "lms-calendario", lbl: "Calendario", ico: "🗓️" },
      e_foros: { id: "lms-foros", lbl: "Foros y mensajes", ico: "💬" },
      e_progreso: { id: "lms-progreso", lbl: "Mi progreso", ico: "🏅" },
      e_matricula: { id: "lms-matricula", lbl: "Matrícula", ico: "📝" },
      e_finanzas: { id: "lms-finanzas", lbl: "Finanzas", ico: "💳" },
      e_perfil: { id: "lms-perfil", lbl: "Mi perfil", ico: "🙋" },
      // --- LMS: Docente ---
      d_panel: { id: "panel", lbl: "Inicio", ico: "🏠" },
      d_materias: { id: "doc-materias", lbl: "Mis materias", ico: "📚" },
      d_calificar: { id: "doc-calificar", lbl: "Calificar", ico: "📥" },
      d_evaluaciones: { id: "doc-evaluaciones", lbl: "Evaluaciones", ico: "❓" },
      d_gradebook: { id: "doc-gradebook", lbl: "Libro de notas", ico: "📊" },
      d_asistencia: { id: "doc-asistencia", lbl: "Asistencia", ico: "✅" },
      d_foros: { id: "doc-foros", lbl: "Foros y anuncios", ico: "📣" },
      d_mensajes: { id: "doc-mensajes", lbl: "Mensajería", ico: "✉️" },
      // --- LMS: Académico (hub) ---
      academia: { id: "academia", lbl: "IBLI · FACTER (LMS)", ico: "🏛️" }
    };
    // Equipos administrativos como accesos directos en el lateral
    const equipoItem = e => ({ id: "equipo:" + e.id, lbl: e.nombre, ico: e.ico });
    // Ministerios congregacionales como accesos directos del pastor filial
    const minItem = (id, lbl, ico) => ({ id: "mfilial:" + id, lbl, ico });
    switch (rolId) {
      case "pastor_admin":
        return {
          general: [I.panel, I.finanzas, I.aprobaciones],
          pastoral: [I.personas, I.grupos, I.filiales],
          formacion: [I.cursos],
          equipos: DB.EQUIPOS.map(equipoItem),
          academico: [I.academia],
          sistema: [I.config]
        };
      case "pastor_sede":
        return {
          general: [I.panel, I.organigrama, I.nuevos],
          pastoral: [I.personas, I.rocakids],
          ministerios: [
            minItem("m_tmt", "tMt (11–25)", "🎸"),
            minItem("m_j25", "J+25", "🌱"),
            minItem("m_josues", "Josués", "🧗"),
            minItem("m_mujer", "Mujer Integral", "🌷"),
            minItem("m_hombres", "Hombres de Bien", "🛡️"),
            minItem("m_dorados", "Años Dorados", "🌅"),
            minItem("m_casa2", "Casados (Casa2)", "💍")
          ],
          formacion: [I.cursos],
          erp: [I.contabilidad, I.donaciones, I.admin],
          operativos: [I.operativos, I.consejerias],
          academico: [I.academia],
          sistema: [I.config]
        };
      case "estudiante":
        return {
          general: [I.e_panel],
          aprendizaje: [I.e_materias, I.e_calendario, I.e_matricula, I.e_progreso],
          evaluacion: [I.e_notas],
          comunidad: [I.e_foros],
          finanzas: [I.e_finanzas],
          cuenta: [I.e_perfil]
        };
      case "docente":
        return {
          general: [I.d_panel],
          docencia: [I.d_materias, I.d_asistencia],
          evaluacion: [I.d_calificar, I.d_evaluaciones, I.d_gradebook],
          comunidad: [I.d_foros, I.d_mensajes]
        };
      case "director":
        return {
          pastoral: [I.panel, I.personas, I.ministerios, I.grupos, I.rocakids],
          formacion: [I.cursos]
        };
      case "coordinador":
        return {
          pastoral: [I.panel, I.personas, I.grupos],
          formacion: [I.cursos]
        };
      case "lider":
        return {
          pastoral: [I.panel, I.personas, I.grupos],
          formacion: [I.cursos]
        };
      case "tesoreria":
        return {
          pastoral: [I.panel, I.personas],
          erp: [I.donaciones, I.admin]
        };
      default:
        return { pastoral: [I.panel] };
    }
  }
  window.UTIL = { navPorRol };

  /* ---------- Render ---------- */
  function render() {
    const app = document.getElementById("app");
    if (!estado.rol) { app.innerHTML = V.login(); enlazarLogin(); return; }
    app.innerHTML = V.shell(estado);
    enlazarShell();
    renderVista();
    renderIA();
  }

  function renderVista() {
    const cont = document.getElementById("contenido");
    if (!cont) return;
    const rol = DB.ROLES[estado.rol];
    const p = estado.params;
    let html = "";
    switch (estado.ruta) {
      case "panel": html = V.panel(rol, estado); break;
      case "personas": html = V.personas(rol, estado); break;
      case "perfil": html = V.perfil(p.id, rol, estado); break;
      case "ministerios": html = V.ministerios(rol, estado); break;
      case "ministerio": html = V.ministerio(p.id, rol, estado); break;
      case "grupos": html = V.grupos(rol, estado); break;
      case "cursos": html = V.cursos(rol, estado); break;
      case "instituto": html = V.instituto(rol, estado); break;
      case "rocakids": html = V.rocakids(rol, estado); break;
      case "rocakids-checkin": html = V.rocakidsLocal(rol, estado); break;
      case "donaciones": html = V.donaciones(rol, estado); break;
      case "admin": html = V.admin(rol, estado); break;
      case "equipo": html = V.equipo(p.id, rol, estado); break;
      case "filiales": html = V.filiales(rol, estado); break;
      case "sede": html = V.sedeDetalle(p.id, rol, estado); break;
      case "organigrama": html = V.organigramaMinisterio(p, rol, estado); break;
      case "aprobaciones": html = V.aprobaciones(rol, estado); break;
      case "finanzas": html = V.finanzas(rol, estado); break;
      case "orgfilial": html = V.organigramaFilial(rol, estado); break;
      case "nuevos": html = V.nuevosFilial(rol, estado); break;
      case "mfilial": html = V.ministerioFilial(p.id, rol, estado); break;
      case "curso": html = V.cursoRoster(p.id, rol, estado); break;
      case "contabilidad": html = V.contabilidadFilial(rol, estado); break;
      case "operativos": html = V.operativosHub(rol, estado); break;
      case "operativo": html = V.operativoDetalle(p.id, rol, estado); break;
      case "consejerias": html = V.consejeriasFilial(rol, estado); break;
      case "config": html = V.config(rol, estado); break;
      /* ---- LMS · Estudiante ---- */
      case "lms-materias": html = V.lmsMaterias(rol, estado); break;
      case "lms-aula": html = V.lmsAula(p, rol, estado); break;
      case "lms-recurso": html = V.lmsRecursoView(p, rol, estado); break;
      case "lms-tarea": html = V.lmsTarea(p, rol, estado); break;
      case "lms-quiz": html = V.lmsQuiz(p, rol, estado); break;
      case "lms-notas": html = V.lmsNotas(rol, estado); break;
      case "lms-foros": html = V.lmsForos(rol, estado); break;
      case "lms-foro": html = V.lmsForoHilo(p, rol, estado); break;
      case "lms-calendario": html = V.lmsCalendario(rol, estado); break;
      case "lms-finanzas": html = V.lmsFinanzas(rol, estado); break;
      case "lms-matricula": html = V.lmsMatricula(rol, estado); break;
      case "lms-progreso": html = V.lmsProgreso(rol, estado); break;
      case "lms-perfil": html = V.lmsPerfil(rol, estado); break;
      /* ---- LMS · Docente ---- */
      case "doc-materias": html = V.docMaterias(rol, estado); break;
      case "doc-materia": html = V.docMateria(p, rol, estado); break;
      case "doc-evaluaciones": html = V.docEvaluaciones(p, rol, estado); break;
      case "doc-calificar": html = V.docCalificar(p, rol, estado); break;
      case "doc-entrega": html = V.docEntrega(p, rol, estado); break;
      case "doc-gradebook": html = V.docGradebook(p, rol, estado); break;
      case "doc-asistencia": html = V.docAsistencia(p, rol, estado); break;
      case "doc-foros": html = V.docForos(rol, estado); break;
      case "doc-analitica": html = V.docAnalitica(p, rol, estado); break;
      case "doc-mensajes": html = V.docMensajes(rol, estado); break;
      /* ---- LMS · Académico ---- */
      case "academia": html = V.academiaHub(rol, estado); break;
      case "aca-programas": html = V.acaProgramas(rol, estado); break;
      case "aca-secciones": html = V.acaSecciones(rol, estado); break;
      case "aca-matriculas": html = V.acaMatriculas(rol, estado); break;
      case "aca-finanzas": html = V.acaFinanzas(rol, estado); break;
      case "aca-analitica": html = V.acaAnalitica(rol, estado); break;
      case "aca-certificacion": html = V.acaCertificacion(rol, estado); break;
      case "aca-config": html = V.acaConfig(rol, estado); break;
      default: html = V.panel(rol, estado);
    }
    cont.innerHTML = html;
    document.querySelectorAll("[data-ruta]").forEach(b => b.classList.toggle("activo", b.dataset.ruta === estado.ruta));
    window.scrollTo(0, 0);
    if (typeof V.activarVista === "function") V.activarVista(estado.ruta, estado);
  }

  function ir(ruta, params) { estado.ruta = ruta; estado.params = params || {}; renderVista(); }
  window.NAV = { ir, toast, abrirModal, cerrarModal, salir };

  /* ---------- Eventos ---------- */
  function enlazarLogin() {
    document.querySelectorAll("[data-rol]").forEach(btn => {
      btn.addEventListener("click", () => {
        estado.rol = btn.dataset.rol;
        const r = DB.ROLES[estado.rol];
        if (r.sede) estado.sede = r.sede;
        estado.ruta = (estado.rol === "tesoreria") ? "donaciones" : "panel";
        render();
        toast(`Bienvenido · ${r.nombre}`, "exito");
      });
    });
  }
  function enlazarShell() {
    document.querySelectorAll("[data-ruta]").forEach(btn => btn.addEventListener("click", () => {
      const r = btn.dataset.ruta;
      if (r.indexOf("equipo:") === 0) ir("equipo", { id: r.split(":")[1] });
      else if (r.indexOf("mfilial:") === 0) ir("mfilial", { id: r.split(":")[1] });
      else ir(r);
    }));
    const selSede = document.getElementById("sel-sede");
    if (selSede) selSede.addEventListener("change", e => { estado.sede = e.target.value; renderVista(); toast(`Sede activa: ${DB.sede(estado.sede).nombre}`); });
    const btnSalir = document.getElementById("btn-salir");
    if (btnSalir) btnSalir.addEventListener("click", salir);
    const btnSidebar = document.getElementById("btn-sidebar");
    if (btnSidebar) btnSidebar.addEventListener("click", () => {
      estado.sidebarColapsado = !estado.sidebarColapsado;
      const app = document.querySelector(".app");
      if (app) app.classList.toggle("sidebar-oculta", estado.sidebarColapsado);
    });
    const fab = document.getElementById("ia-fab");
    if (fab) fab.addEventListener("click", () => { estado.iaAbierto = !estado.iaAbierto; renderIA(); });
    const buscar = document.getElementById("busqueda-global");
    if (buscar) {
      buscar.addEventListener("keydown", e => {
        if (e.key === "Enter") {
          const q = buscar.value.trim();
          toast(q ? `🔍 Buscando "${q}" en personas, ministerios y sedes…` : "Escribe algo para buscar en todo el sistema.", q ? "exito" : "");
        } else if (e.key === "Escape") { buscar.value = ""; buscar.blur(); }
      });
    }
    document.getElementById("contenido").addEventListener("click", manejarAccion);
  }
  function salir() { estado.rol = null; estado.ruta = "panel"; estado.iaAbierto = false; render(); }

  /* ---------- Acciones declarativas ---------- */
  function manejarAccion(e) {
    const el = e.target.closest("[data-accion]");
    if (!el) return;
    const a = el.dataset.accion, v = el.dataset.valor;
    switch (a) {
      case "ver-perfil": ir("perfil", { id: v }); break;
      case "ver-ministerio": ir("ministerio", { id: v }); break;
      case "ver-mfilial": ir("mfilial", { id: v }); break;
      case "ver-operativo": ir("operativo", { id: v }); break;
      case "ver-curso": ir("curso", { id: v }); break;
      case "ver-equipo": ir("equipo", { id: v }); break;
      case "ver-sede": ir("sede", { id: v }); break;
      case "ver-org": { const x = (v || "").split(":"); ir("organigrama", { sede: x[0], min: x[1] }); break; }
      case "toggle-coord": toggleCoord(el, v); break;
      case "rocakids-ciudad": ir("rocakids", { ciudad: v }); break;
      case "ir": ir(v); break;
      case "aprobar-item": resolverAprob(v, "aprobada"); break;
      case "rechazar-item": resolverAprob(v, "rechazada"); break;
      case "ver-crm-sede": verCrmSede(v); break;
      case "agregar-usuario": toast("Abriendo formulario para agregar un usuario a esta iglesia…", "exito"); break;
      case "quitar-usuario": toast("Usuario retirado de la iglesia ✓ (acción de demostración)", "exito"); break;
      case "checkin": hacerCheckin(v); break;
      case "checkout": hacerCheckout(v); break;
      case "inscribir": inscribirCurso(v); break;
      case "unirme-grupo": unirmeGrupo(v); break;
      case "filtrar-grupo": filtrarGrupos(el); break;
      case "toggle-ministerio": toggleMinisterio(v); break;
      case "seguir-nuevo": toast("Secuencia de bienvenida activada ✉️", "exito"); break;
      case "contactar": toast("Acción registrada ✓", "exito"); break;
      case "abrir-nuevo": abrirModal(V.modalNuevo()); break;
      case "guardar-nuevo": guardarNuevo(); break;
      case "cerrar-modal": cerrarModal(); break;
      case "config-toggle": el.classList.toggle("activo"); toast("Preferencia actualizada"); break;
      case "sub-ministerio": seleccionarSub(el); break;
      case "contacto-wa": toast(`📲 Abriendo WhatsApp con ${v} …`, "exito"); break;
      case "contacto-email": toast(`✉️ Redactando correo a ${v} …`, "exito"); break;
      case "subir-doc": toast("📎 Selector de archivo abierto: sube tu factura o comprobante (demo).", "exito"); break;
      case "org-editar": estado.params.orgEdit = true; renderVista(); toast("✏️ Modo edición activado: toca un cargo o nombre para cambiarlo.", "exito"); break;
      case "org-guardar": estado.params.orgEdit = false; renderVista(); toast("✅ Organigrama actualizado y guardado.", "exito"); break;
      case "org-add": toast("➕ Nodo agregado al organigrama (demo).", "exito"); break;
      case "asignar-consejero": toast("🤝 Solicitud asignada a un consejero. Se notificó a la persona.", "exito"); break;
      /* ---- LMS · navegación con parámetros ---- */
      case "ver-aula": ir("lms-aula", { id: v }); break;
      case "ver-recurso": { const x = (v || "").split(":"); ir("lms-recurso", { mid: x[0], rid: x[1] }); break; }
      case "ver-tarea": { const x = (v || "").split(":"); ir("lms-tarea", { eid: x[0], mid: x[1] }); break; }
      case "ver-quiz": ir("lms-quiz", { eid: v }); break;
      case "ver-foro": ir("lms-foro", { id: v }); break;
      case "ver-doc-materia": ir("doc-materia", { id: v }); break;
      case "ver-evaluaciones": ir("doc-evaluaciones", { id: v }); break;
      case "ver-gradebook": ir("doc-gradebook", { id: v }); break;
      case "ver-asistencia": ir("doc-asistencia", { id: v }); break;
      case "ver-analitica": ir("doc-analitica", { id: v }); break;
      case "ver-calificar": ir("doc-calificar", { eid: v }); break;
      case "ver-entrega": ir("doc-entrega", { id: v }); break;
      /* ---- LMS · acciones concretas ---- */
      case "marcar-completado": marcarCompletado(v); break;
      case "enviar-intento": enviarIntento(v); break;
      case "abrir-pago": abrirModal(V.modalPago(v)); break;
      case "pagar": pagarMatricula(v); break;
      case "abrir-entrega": abrirModal(V.modalEntrega(v)); break;
      case "guardar-entrega": guardarEntrega(v); break;
      case "responder-foro": cerrarModal(); toast("💬 Tu respuesta fue publicada en el foro.", "exito"); break;
      case "confirmar-matricula": toast(`📝 Matrícula al semestre ${v} registrada. Estado: pendiente de pago. Te enviamos el recibo por correo.`, "exito"); break;
      case "crear-recurso": abrirModal(V.modalCrearRecurso(v)); break;
      case "guardar-recurso": cerrarModal(); toast("✅ Recurso agregado al aula. Los estudiantes ya pueden verlo.", "exito"); break;
      case "crear-pregunta": abrirModal(V.modalCrearPregunta(v)); break;
      case "guardar-pregunta": cerrarModal(); toast("✅ Pregunta agregada al banco.", "exito"); break;
      case "crear-evaluacion": toast("📝 Asistente de nueva evaluación abierto (demo).", "exito"); break;
      case "publicar-anuncio": abrirModal(V.modalAnuncio(v)); break;
      case "guardar-anuncio": cerrarModal(); toast("📣 Anuncio publicado. Se notificó a la clase por correo y WhatsApp.", "exito"); break;
      case "guardar-nota": guardarNota(v); break;
      case "asistencia": { const x = (v || "").split(":"); toast(`✅ ${x[1]} marcado como ${x[0]}.`, "exito"); break; }
      case "aprobar-matricula": toast(`✓ Matrícula de ${v} aprobada. Se notificó al estudiante.`, "exito"); break;
      case "demo": toast(v || "Acción de demostración", "exito"); break;
      default: break;
    }
  }

  /* ---------- Aprobaciones (flujo hasta el final) ---------- */
  function resolverAprob(id, estadoFinal) {
    const a = DB.aprobacion(id);
    if (!a) return;
    a.estado = estadoFinal;
    const cont = document.getElementById("lista-aprob");
    if (cont) cont.innerHTML = V.listaAprob();
    if (estadoFinal === "aprobada") toast(`✓ Aprobado: "${a.titulo}". Se notificó a ${a.solicitante}.`, "exito");
    else toast(`✕ Rechazado: "${a.titulo}". Se notificó a ${a.solicitante}.`);
  }
  function toggleCoord(btn, idx) {
    const cont = document.getElementById("coord-" + idx);
    if (!cont) return;
    const abierto = cont.style.display !== "none";
    cont.style.display = abierto ? "none" : "";
    btn.classList.toggle("abierto", !abierto);
    const caret = btn.querySelector(".org__caret");
    if (caret) caret.textContent = abierto ? "▼ ver líderes" : "▲ ocultar líderes";
  }
  function verCrmSede(id) {
    const s = DB.sedeRed(id);
    if (s) estado.sede = id;
    ir("personas");
    if (s) toast(`CRM filtrado a ${s.nombre}`, "exito");
  }

  /* ---------- Acciones concretas ---------- */
  function hacerCheckin(id) { const n = DB.NINOS.find(x => x.id === id); if (!n) return; n.estado = "dentro"; n.hora = horaAhora(); toast(`✅ ${n.nombre} ingresó · código ${n.codigo}`, "exito"); renderVista(); }
  function hacerCheckout(id) { const n = DB.NINOS.find(x => x.id === id); if (!n) return; n.estado = "fuera"; toast(`👋 ${n.nombre} entregado a ${n.acudiente}`, "exito"); renderVista(); }
  function inscribirCurso(id) { const c = DB.CURSOS.find(x => x.id === id); if (!c) return; c.inscritos++; toast(`📩 Inscrito a "${c.nombre}". Correo de confirmación enviado.`, "exito"); renderVista(); }
  function unirmeGrupo(id) { const g = DB.grupo(id); if (!g) return; if (g.miembros < g.cupo) g.miembros++; toast(`🤝 Te uniste a "${g.nombre}". El líder fue notificado.`, "exito"); renderVista(); }
  function toggleMinisterio(id) {
    const m = DB.ministerio(id); if (!m) return;
    m.activo = !m.activo;
    if (m.activo && m.personas === 0) { m.director = "Por asignar"; }
    toast(m.activo ? `🧩 "${m.nombre}" activado en tu sede.` : `"${m.nombre}" desactivado.`, m.activo ? "exito" : "");
    renderVista();
  }
  function filtrarGrupos(el) {
    el.parentElement.querySelectorAll(".chip").forEach(c => c.classList.remove("activo"));
    el.classList.add("activo");
    estado.params.filtro = el.dataset.valor;
    const cont = document.getElementById("lista-grupos");
    if (cont) cont.innerHTML = V.listaGrupos(estado.params.filtro);
  }
  function seleccionarSub(el) {
    estado.params.sub = el.dataset.valor;
    renderVista();
  }
  function guardarNuevo() {
    const nombre = (document.getElementById("nuevo-nombre") || {}).value || "Nueva persona";
    cerrarModal();
    toast(`✨ ${nombre} registrada. Asignada a seguimiento automáticamente.`, "exito");
  }

  /* ---------- Acciones LMS (Instituto) ---------- */
  function marcarCompletado(v) {
    const x = (v || "").split(":");
    const r = DB.lmsRecurso(x[0], x[1]);
    if (r) r.estado = "completado";
    toast("✓ Recurso marcado como completado. ¡Buen trabajo!", "exito");
    ir("lms-aula", { id: x[0] });
  }
  function enviarIntento(eid) {
    const ev = DB.lmsEval(eid);
    const total = ev && ev.preguntas ? ev.preguntas.reduce((a, q) => a + (q.puntos || 0), 0) : 10;
    const obt = Math.round(total * 0.85 * 10) / 10;
    cerrarModal();
    toast(`📨 Intento enviado. Resultado: ${obt}/${total}. Revisa la retroalimentación en cada pregunta.`, "exito");
    if (ev) ir("lms-aula", { id: ev.materia });
  }
  function pagarMatricula(valor) {
    const f = DB.LMS.FINANZAS;
    const mov = f.movimientos.find(m => m.estado === "Pendiente");
    if (mov) { mov.estado = "Pagado"; mov.metodo = "Wompi"; }
    f.saldo = 0; f.estado = "Al día ✓";
    cerrarModal();
    toast(`💳 Pago de ${DB.LMS.FINANZAS ? "$" + (+valor).toLocaleString("es-CO") : valor} aprobado. Recibo enviado a tu correo.`, "exito");
    ir("lms-finanzas");
  }
  function guardarEntrega(eid) {
    const e = DB.LMS.ENTREGAS.find(x => x.evaluacion === eid && x.estudiante === "p_valentina");
    if (e) { e.estado = "entregado"; e.fecha = "hoy"; e.archivo = e.archivo || "mi_entrega.pdf"; }
    cerrarModal();
    toast("📤 Entrega enviada. Tu docente fue notificado.", "exito");
    ir("lms-tarea", { eid: eid });
  }
  function guardarNota(entregaId) {
    const e = DB.LMS.ENTREGAS.find(x => x.id === entregaId);
    if (e) { e.estado = "calificado"; if (e.nota == null) e.nota = 4.5; }
    toast("✅ Nota guardada y devuelta al estudiante.", "exito");
    ir("doc-calificar", { eid: e ? e.evaluacion : undefined });
  }

  /* ---------- Asistente IA ---------- */
  function renderIA() {
    const fab = document.getElementById("ia-fab");
    let panel = document.getElementById("ia-panel");
    if (panel) panel.remove();
    const rolActivo = DB.ROLES[estado.rol];
    if (!estado.iaAbierto || !rolActivo) { estado.iaAbierto = false; if (fab) fab.style.display = "grid"; return; }
    if (fab) fab.style.display = "none";
    document.body.insertAdjacentHTML("beforeend", V.iaPanel(rolActivo));
    panel = document.getElementById("ia-panel");
    panel.querySelector("#ia-close").addEventListener("click", () => { estado.iaAbierto = false; renderIA(); });
    panel.querySelectorAll("[data-pregunta]").forEach(b => b.addEventListener("click", () => responderIA(b.dataset.pregunta)));
  }
  function responderIA(pregunta) {
    const body = document.querySelector("#ia-panel .ia-panel__body");
    if (!body) return;
    body.insertAdjacentHTML("beforeend", `<div class="ia-msg ia-msg--user">${pregunta}</div>`);
    body.insertAdjacentHTML("beforeend", `<div class="ia-msg ia-msg--bot">${V.respuestaIA(pregunta, estado)}</div>`);
    body.scrollTop = body.scrollHeight;
  }

  /* ---------- Modales ---------- */
  function abrirModal(html) {
    const capa = document.getElementById("capa-modal");
    capa.innerHTML = `<div class="modal-bg" id="modal-bg">${html}</div>`;
    capa.querySelector("#modal-bg").addEventListener("click", e => { if (e.target.id === "modal-bg") cerrarModal(); });
    capa.querySelectorAll("[data-accion]").forEach(el => el.addEventListener("click", () => manejarAccion({ target: el })));
  }
  function cerrarModal() { document.getElementById("capa-modal").innerHTML = ""; }

  /* ---------- Toasts ---------- */
  function toast(msg, tipo) {
    const wrap = document.getElementById("toasts");
    const el = document.createElement("div");
    el.className = "toast" + (tipo === "exito" ? " toast--exito" : "");
    el.innerHTML = `<span>${tipo === "exito" ? "✓" : "ℹ️"}</span><span>${msg}</span>`;
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateX(20px)"; setTimeout(() => el.remove(), 250); }, 3200);
  }

  function horaAhora() {
    const d = new Date(); let h = d.getHours(); const m = String(d.getMinutes()).padStart(2, "0");
    const ap = h >= 12 ? "pm" : "am"; h = h % 12 || 12; return `${h}:${m} ${ap}`;
  }

  /* Atajo global ⌘K / Ctrl+K → enfocar búsqueda */
  document.addEventListener("keydown", e => {
    if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
      const b = document.getElementById("busqueda-global");
      if (b) { e.preventDefault(); b.focus(); }
    }
  });

  render();
})();
