/* ============================================================
   CASA ROCA AI SYSTEM — VISTAS · ERP ADMIN + FILIALES (Fase 0 · v2)
   Hub de equipos administrativos, detalle por equipo, y gestión
   de filiales (permisos y roles que otorga la Dirección General).
   ============================================================ */
(function () {
  const DB = window.DB, H = window.VIEWS.H;

  /* ---------- HUB de equipos administrativos (ERP) ---------- */
  function admin(rol, estado) {
    const esGlobal = rol.id === "pastor_admin";
    // La filial solo ve equipos de ámbito 'local'
    const equipos = esGlobal ? DB.EQUIPOS : DB.EQUIPOS.filter(e => e.ambito === "local");
    const corp = DB.EQUIPOS.filter(e => e.ambito === "corporativo");
    return `
    ${H.pageHead("ERP · Administración", esGlobal ? "Centro de control corporativo" : "Administración de mi sede",
      esGlobal
        ? "Los 8 equipos del back-office. Lo corporativo (Contable, Legal, Tecnología) es global y vive solo aquí."
        : "Heredas la operación <b>local</b>: Tesorería, Talento Humano, Comunicaciones, Seguridad y Cultura de tu sede.")}

    <div class="grid grid-auto mb-5">${equipos.map(tarjetaEquipo).join("")}</div>

    ${!esGlobal ? `<div class="card card--pad-lg">
      <div class="card__title mb-2">🔒 Solo en la sede madre</div>
      <p class="card__sub mb-3">Estos equipos son corporativos: los administra la Dirección General.</p>
      <div class="flex gap-3 wrap">${corp.map(e => `<span class="chip" style="cursor:default">${e.ico} ${e.nombre}</span>`).join("")}</div>
    </div>` : ""}`;
  }
  function tarjetaEquipo(e) {
    return `<div class="card">
      <div class="flex gap-3 items-center mb-2"><div class="kpi__ico" style="background:var(--azul-100)">${e.ico}</div>
        <div class="grow"><b style="font-size:var(--tx-md)">${e.nombre}</b>
          <div class="txt-xs txt-suave">${e.ambito === "corporativo" ? "🔒 Corporativo (global)" : "📍 Local (filial)"}</div></div></div>
      <p class="txt-sm txt-suave mb-3">${e.desc}</p>
      <div class="flex between txt-xs txt-suave mb-3">${e.kpis.map(k => `<div class="txt-center"><b style="display:block; color:var(--azul-800); font-size:var(--tx-sm)">${k.v}</b>${k.l}</div>`).join("")}</div>
      <button class="btn btn--primario btn--bloque" data-accion="ver-equipo" data-valor="${e.id}">Abrir ${e.nombre} →</button></div>`;
  }

  /* ---------- DETALLE por equipo administrativo ---------- */
  function equipo(id, rol, estado) {
    const e = DB.equipo(id);
    if (!e) return `<div class="vacio"><div class="ico">🤷</div>Equipo no encontrado.</div>`;
    return `
    ${H.volver("admin", "Volver al ERP")}
    <div class="card card--pad-lg mb-4" style="background:linear-gradient(135deg,var(--azul-800),var(--azul-900)); color:#fff; border:none">
      <div class="flex gap-4 items-center wrap">
        <div style="font-size:2.2rem; width:70px; height:70px; display:grid; place-items:center; background:var(--mostaza-500); border-radius:var(--radio-md)">${e.ico}</div>
        <div class="grow"><h1 style="font-size:var(--tx-xl)">${e.nombre}</h1>
          <div class="txt-sm" style="opacity:.85">${e.desc}</div>
          <div class="txt-sm mt-2">🧑‍💼 Responsable: <b>${e.lider}</b> · ${e.ambito === "corporativo" ? "🔒 Corporativo" : "📍 Local"}</div></div>
      </div>
    </div>
    <div class="grid grid-3 mb-4">${e.kpis.map(k => H.kpi("📌", k.v, k.l)).join("")}</div>
    ${contenidoEquipo(e)}`;
  }

  /* Contenido bespoke por equipo */
  function contenidoEquipo(e) {
    switch (e.id) {
      case "e_contable": return `
        <div class="card card--pad-lg mb-4"><div class="flex between items-center mb-3"><div class="card__title">📊 Integración Siigo</div>
          <span class="badge badge--exito">Conectado</span></div>
          ${listaProc(["Sincronización de terceros (donantes)", "Conciliación de pasarelas ↔ Siigo", "Comprobantes y certificados de donación", "Cierre contable mensual por sede"])}
          <button class="btn btn--primario mt-3" data-accion="demo" data-valor="Sincronizando movimientos con Siigo…">🔄 Sincronizar ahora</button></div>
        ${tablaCierres()}`;
      case "e_tesoreria": return `
        <div class="grid grid-2 mb-4">
          <div class="card card--pad-lg"><div class="card__title mb-3">💸 Gastos por aprobar</div>
            ${filaAprob("Sonido — repuesto consola", "$1.850.000", "VISA")}
            ${filaAprob("RocaKids — material didáctico", "$640.000", "RocaKids")}
            ${filaAprob("Cafetería — insumos junio", "$420.000", "Ujieres")}</div>
          <div class="card card--pad-lg"><div class="card__title mb-3">📊 Presupuesto por ministerio</div>
            ${barra("RocaKids", 78)}${barra("Alabanza", 64)}${barra("Comunicaciones", 91)}${barra("Misericordia (M.A.S)", 52)}</div></div>
        <div class="card"><button class="btn btn--mostaza" data-accion="ir" data-valor="donaciones">Ver donaciones y diezmos →</button></div>`;
      case "e_legal": return `
        <div class="card card--pad-lg mb-4"><div class="flex between items-center mb-3"><div class="card__title">📁 Repositorio documental</div>
          <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="Subiendo nuevo documento legal…">＋ Subir documento</button></div>
          ${filaDoc("Acta de constitución", "Vigente", "exito")}
          ${filaDoc("Contrato arriendo sede Chicó", "Vence en 38 días", "aviso")}
          ${filaDoc("Política de tratamiento de datos (Ley 1581)", "Vigente", "exito")}
          ${filaDoc("Convenio Unidad Educativa IBLI", "Por renovar", "aviso")}</div>
        <div class="card card--pad-lg"><div class="card__title mb-3">📨 PQRS abiertas</div>
          ${listaProc(["3 peticiones · 4 quejas · 2 reclamos", "Tiempo promedio de respuesta: 2,4 días"])}
          <button class="btn btn--primario mt-3" data-accion="demo" data-valor="Abriendo bandeja de PQRS…">Gestionar PQRS</button></div>`;
      case "e_hr": return `
        <div class="grid grid-2 mb-4">
          <div class="card card--pad-lg"><div class="card__title mb-3">🧑‍💼 En onboarding</div>
            ${filaHR("Lucía Franco", "Comunicaciones", "Día 3 de 10")}
            ${filaHR("Tomás Vela", "VISA · Sonido", "Día 7 de 10")}
            ${filaHR("Sofía Lara", "RocaKids", "Día 1 de 10")}</div>
          <div class="card card--pad-lg"><div class="card__title mb-3">🌴 Vacaciones activas</div>
            ${listaProc(["12 colaboradores en vacaciones", "3 solicitudes por aprobar", "Cobertura de turnos asegurada"])}
            <button class="btn btn--primario mt-3" data-accion="demo" data-valor="Abriendo solicitudes de vacaciones…">Aprobar solicitudes</button></div></div>
        <div class="card card--pad-lg"><div class="card__title mb-3">🗂️ Organigrama (HCM)</div>
          ${listaProc(["148 empleados · 9 áreas", "Portal del empleado activo", "Evaluación de desempeño: ciclo Q2 en curso"])}</div>`;
      case "e_seguridad": return `
        <div class="card card--pad-lg mb-4"><div class="card__title mb-3">✅ Checklist del domingo</div>
          ${filaCheck("Control de acceso RocaKids", true)}${filaCheck("Brigada de primeros auxilios", true)}
          ${filaCheck("Rutas de evacuación señalizadas", true)}${filaCheck("Radios y comunicación de equipo", true)}
          ${filaCheck("Parqueadero y tráfico", false)}</div>
        <div class="card card--pad-lg"><div class="card__title mb-3">🚨 Gestión de incidentes</div>
          <div class="alerta alerta--exito"><span class="ico">✓</span><div>Sin incidentes reportados hoy.</div></div>
          <button class="btn btn--primario mt-3" data-accion="demo" data-valor="Abriendo formulario de incidente…">＋ Reportar incidente</button></div>`;
      case "e_tecnologia": return `
        <div class="grid grid-2 mb-4">
          <div class="card card--pad-lg"><div class="card__title mb-3">🔌 Integraciones</div>
            ${filaInt("Siigo (contabilidad)", true)}${filaInt("Wompi / PayU / Mercado Pago", true)}
            ${filaInt("Moodle (Instituto · SSO)", true)}${filaInt("Resend (correo transaccional)", true)}
            ${filaInt("Google Workspace (SSO)", false)}</div>
          <div class="card card--pad-lg"><div class="card__title mb-3">🎫 Soporte interno</div>
            ${listaProc(["4 tickets abiertos · 2 urgentes", "SLA promedio: 6 h", "Usuarios activos: 2.480"])}
            <button class="btn btn--primario mt-3" data-accion="demo" data-valor="Abriendo mesa de ayuda interna…">Ver tickets</button></div></div>
        <div class="card"><button class="btn btn--mostaza" data-accion="ir" data-valor="config">Administrar usuarios y roles →</button></div>`;
      case "e_cultura": return `
        <div class="grid grid-2 mb-4">
          <div class="card card--pad-lg"><div class="card__title mb-3">⭐ Reconocimientos del mes</div>
            ${listaProc(["Andrea Pineda — Líder destacada", "Equipo VISA — Servicio extra Semana Santa", "Marcela Gómez — Innovación RocaKids"])}</div>
          <div class="card card--pad-lg"><div class="card__title mb-3">😊 Clima del equipo</div>
            ${barra("Pertenencia", 88)}${barra("Carga de trabajo", 71)}${barra("Comunicación", 82)}
            <button class="btn btn--primario mt-3" data-accion="demo" data-valor="Lanzando encuesta de clima…">Lanzar encuesta</button></div></div>`;
      case "e_comunicaciones": return `
        <div class="card card--pad-lg mb-4"><div class="flex between items-center mb-3"><div class="card__title">🎨 Solicitudes de diseño (intake)</div>
          <button class="btn btn--mostaza btn--sm" data-accion="demo" data-valor="Creando nueva solicitud de diseño…">＋ Nueva solicitud</button></div>
          ${filaIntake("Pieza redes — Bautizos julio", "RocaKids", "En diseño", "aviso")}
          ${filaIntake("Banner web — Cursos crecimiento", "Crecimiento", "Aprobación", "azul")}
          ${filaIntake("Video testimonio — Mujer Integral", "Mujer Integral", "Publicado", "exito")}</div>
        <div class="card card--pad-lg"><div class="card__title mb-3">🗓️ Calendario de contenido</div>
          ${listaProc(["14 piezas en producción", "Publicación multi-sede coordinada", "Banco creativo: 320 piezas"])}</div>`;
      default: return `<div class="card">${listaProc(["Módulo en construcción para la Fase 1."])}</div>`;
    }
  }

  /* ---------- FILIALES (Dirección General otorga permisos/roles) ---------- */
  function filiales(rol, estado) {
    if (rol.id !== "pastor_admin") return `<div class="vacio"><div class="ico">🔒</div>Solo la Dirección General gestiona las filiales.</div>`;
    return `
    ${H.pageHead("Dirección General", "Filiales y permisos",
      "Aquí asignas el <b>pastor congregacional</b> de cada sede y defines qué módulos y roles puede activar en su sistema.")}
    <div class="grid grid-3 mb-4">
      ${H.kpi("🏛️", DB.SEDES.length, "Sedes en red")}
      ${H.kpi("🧑‍✈️", DB.SEDES.length, "Pastores filiales")}
      ${H.kpi("🌎", "5", "Países")}
    </div>
    <div class="card"><div class="card__title mb-3">🏛️ Sedes</div>
      ${DB.SEDES.map(filaFilial).join("")}
    </div>
    <div class="card card--pad-lg mt-4"><div class="card__title mb-3">🧩 Plantilla de permisos del Pastor Congregacional</div>
      <p class="card__sub mb-3">Lo que un pastor de filial puede activar y gestionar en su sede.</p>
      ${filaPerm("✅ Todos los ministerios congregacionales", true)}
      ${filaPerm("✅ Todos los equipos operativos", true)}
      ${filaPerm("📍 Administración local: Tesorería, Talento Humano, Comunicaciones, Seguridad, Cultura", true)}
      ${filaPerm("🔒 Contable corporativo / Legal / Tecnología global", false)}
      ${filaPerm("👤 Crear y asignar roles dentro de su sede (Director, Coordinador, Líder)", true)}
    </div>`;
  }
  function filaFilial(s) {
    const pastor = s.id === "bogota" ? "Camilo Restrepo" : "(por asignar)";
    return `<div class="fila"><span style="font-size:1.3rem">🏛️</span>
      <div class="fila__main"><b>${s.nombre}${s.esMadre ? ' <span class="badge badge--mostaza">Sede madre</span>' : ''}</b>
        <span>${s.pais} · 👥 ${s.personas} personas · 🧑‍✈️ Pastor: ${pastor}</span></div>
      <div class="flex gap-2">
        <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="Asignando pastor y permisos a ${s.nombre}…">Permisos y roles</button>
        <button class="btn btn--primario btn--sm" data-accion="demo" data-valor="Entrando como pastor de ${s.nombre} (impersonar)…">Entrar →</button>
      </div></div>`;
  }
  function filaPerm(lbl, on) {
    return `<div class="fila"><div class="fila__main"><b>${lbl}</b></div>
      <button class="chip ${on ? "activo" : ""}" data-accion="config-toggle">${on ? "Permitido" : "Restringido"}</button></div>`;
  }

  /* ---------- bloques reutilizables ---------- */
  function listaProc(items) { return `<ul class="txt-sm txt-suave" style="margin:0; padding-left:1.1rem; line-height:1.9">${items.map(i => `<li>${i}</li>`).join("")}</ul>`; }
  function barra(lbl, p) {
    const color = p >= 85 ? "peligro" : p >= 70 ? "mostaza-500" : "exito";
    return `<div class="flex between items-center" style="gap:12px; margin-bottom:10px">
      <span class="txt-sm" style="width:150px">${lbl}</span>
      <div class="progreso grow"><div class="progreso__barra" style="width:${p}%; background:var(--${color.includes('-') ? color : color})"></div></div>
      <b class="txt-sm" style="width:38px; text-align:right">${p}%</b></div>`;
  }
  function filaAprob(t, monto, min) {
    return `<div class="fila"><div class="fila__main"><b>${t}</b><span>${min}</span></div>
      <div class="flex gap-2 items-center"><b class="txt-sm nowrap">${monto}</b>
      <button class="btn btn--primario btn--sm" data-accion="demo" data-valor="Gasto aprobado ✓">Aprobar</button></div></div>`;
  }
  function tablaCierres() {
    return `<div class="card"><div class="card__title mb-3">🧾 Cierres mensuales por sede</div>
      <div style="overflow-x:auto"><table class="tabla"><thead><tr><th>Sede</th><th>Mes</th><th>Estado</th></tr></thead><tbody>
        <tr><td>Bogotá Chicó</td><td>Mayo 2026</td><td><span class="badge badge--exito">Cerrado</span></td></tr>
        <tr><td>Medellín</td><td>Mayo 2026</td><td><span class="badge badge--exito">Cerrado</span></td></tr>
        <tr><td>Cali</td><td>Mayo 2026</td><td><span class="badge badge--aviso">En revisión</span></td></tr>
        <tr><td>Miami</td><td>Mayo 2026</td><td><span class="badge badge--aviso">Pendiente</span></td></tr>
      </tbody></table></div></div>`;
  }
  function filaDoc(t, estado, tipo) {
    return `<div class="fila"><span style="font-size:1.2rem">📄</span><div class="fila__main"><b>${t}</b></div>
      <span class="badge badge--${tipo}">${estado}</span></div>`;
  }
  function filaHR(n, area, prog) {
    return `<div class="fila"><div class="avatar avatar--sm">${n.split(" ").map(x => x[0]).slice(0, 2).join("")}</div>
      <div class="fila__main"><b>${n}</b><span>${area}</span></div><span class="badge badge--azul">${prog}</span></div>`;
  }
  function filaCheck(t, ok) {
    return `<div class="fila"><span style="font-size:1.2rem">${ok ? "✅" : "⬜"}</span><div class="fila__main"><b>${t}</b></div>
      <span class="badge badge--${ok ? "exito" : "aviso"}">${ok ? "Listo" : "Pendiente"}</span></div>`;
  }
  function filaInt(t, ok) {
    return `<div class="fila"><span style="font-size:1.2rem">🔌</span><div class="fila__main"><b>${t}</b></div>
      <span class="badge badge--${ok ? "exito" : ""}">${ok ? "Conectado" : "Sin conectar"}</span></div>`;
  }
  function filaIntake(t, area, estado, tipo) {
    return `<div class="fila"><span style="font-size:1.2rem">🎨</span><div class="fila__main"><b>${t}</b><span>${area}</span></div>
      <span class="badge badge--${tipo}">${estado}</span></div>`;
  }

  Object.assign(window.VIEWS, { admin, equipo, filiales });
})();
