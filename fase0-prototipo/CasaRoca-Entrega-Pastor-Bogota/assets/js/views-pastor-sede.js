/* ============================================================
   CASA ROCA AI SYSTEM — VISTAS · PASTOR CONGREGACIONAL (Fase 0)
   Perfil profundo del pastor filial (Bogotá Chicó):
   panel de la iglesia en análisis, organigrama editable, nuevos,
   ministerios con CRM/grupos/calendario únicos (tMt y Casados con
   subdivisiones), cursos con inscritos, IBLI/FACTER, contabilidad,
   equipos operativos y consejerías. Extiende window.VIEWS.
   Consume window.DB (base) + window.DB_FILIAL (datos de filial).
   ============================================================ */
(function () {
  const DB = window.DB, F = window.DB_FILIAL, V = window.VIEWS, H = window.VIEWS.H;
  const cop = H.cop, kpi = H.kpi, pageHead = H.pageHead, volver = H.volver, etapaBadge = H.etapaBadge;
  const fM = n => "$" + n.toLocaleString("es-CO") + " M";

  /* ---------- Helpers compartidos del perfil ---------- */
  function ini(nombre) {
    return nombre.split(" ").filter(Boolean).slice(0, 2).map(x => x[0].toUpperCase()).join("");
  }
  function contactoBtns(tel, email) {
    return `<button class="btn btn--ghost btn--sm" data-accion="contacto-wa" data-valor="${tel}" title="WhatsApp ${tel}">💬 WhatsApp</button>
      <button class="btn btn--ghost btn--sm" data-accion="contacto-email" data-valor="${email}" title="Correo ${email}">✉️ Email</button>`;
  }
  function filaCRM(p) {
    return `<div class="fila">
      <div class="avatar avatar--sm">${ini(p.n)}</div>
      <div class="fila__main"><b>${p.n}${p.riesgo ? ' <span class="badge badge--peligro">⚠️ Riesgo</span>' : ""}</b>
        <span>${p.sub}${p.edad ? " · " + p.edad + " años" : ""}</span></div>
      <div class="flex gap-2 items-center wrap" style="justify-content:flex-end">
        ${etapaBadge(p.etapa)}${contactoBtns(p.tel, p.email)}</div></div>`;
  }
  function calendarList(items) {
    return `<div class="card card--pad-lg mb-4"><div class="card__title mb-3">📅 Calendario del ministerio</div>
      ${items.map(c => `<div class="fila"><div class="cal-fecha">${c.dia}</div>
        <div class="fila__main"><b>${c.titulo}</b><span>🕒 ${c.hora} · 📍 ${c.lugar}</span></div>
        <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="Abriendo el evento '${c.titulo}'…">Ver</button></div>`).join("")}
      <button class="btn btn--ghost btn--sm btn--bloque mt-3" data-accion="demo" data-valor="Creando un nuevo evento en el calendario…">＋ Agregar al calendario</button></div>`;
  }
  function gruposGrid(grupos) {
    return `<div class="grid grid-auto">${grupos.map(g => {
      const oc = Math.round(g.miembros / g.cupo * 100);
      const tipo = g.miembros >= g.cupo ? "peligro" : oc > 60 ? "exito" : "aviso";
      return `<div class="card">
        <div class="flex between items-center mb-2"><b style="font-size:var(--tx-md)">${g.nombre}</b>
          <span class="badge badge--${tipo}">${g.miembros}/${g.cupo}</span></div>
        <div class="txt-sm txt-suave" style="line-height:1.9">🗓️ ${g.dia} · ${g.hora}<br>📍 ${g.zona}<br>🧑‍🤝‍🧑 Líder: ${g.lider}</div>
        <div class="progreso mt-3"><div class="progreso__barra" style="width:${oc}%"></div></div>
        <button class="btn btn--ghost btn--bloque mt-3" data-accion="demo" data-valor="Abriendo el grupo '${g.nombre}'…">Ver grupo →</button></div>`;
    }).join("")}</div>`;
  }
  function distribucionEtapas(personas) {
    const c = { conoce: 0, conecta: 0, crece: 0, sirve: 0 };
    personas.forEach(p => { if (c[p.etapa] != null) c[p.etapa]++; });
    const orden = ["conoce", "conecta", "crece", "sirve"];
    const tot = personas.length || 1;
    return `<div class="flex gap-2 wrap">${orden.map(e => `<span class="badge badge--${DB.ETAPAS[e].clase}">${DB.ETAPAS[e].ico} ${DB.ETAPAS[e].nombre}: ${c[e]} (${Math.round(c[e] / tot * 100)}%)</span>`).join("")}</div>`;
  }

  /* ============================================================
     1) PANEL — la iglesia en análisis
     ============================================================ */
  function panelFilial(rol, estado) {
    const P = F.PANEL;
    const totalGen = P.generos.hombres + P.generos.mujeres;
    const pctH = Math.round(P.generos.hombres / totalGen * 100);
    return `
    ${pageHead("Mi sede · Bogotá Chicó", "Buenas, Pastor Camilo 👋",
      "Tu iglesia en análisis: asistencia, nuevos, ministerios, RocaKids, aportes y la agenda pastoral de la semana. Todo esto alimenta el tablero de la Dirección General.")}

    <div class="grid grid-4 mb-4">
      ${kpi("👥", P.asistentes.toLocaleString("es-CO"), "Asistentes (mi sede)", { dir: "up", txt: "1,1% mes" })}
      ${kpi("⛪", P.promDomingo.toLocaleString("es-CO"), "Promedio domingo")}
      ${kpi("✨", P.nuevosMes, "Nuevos este mes", { dir: "up", txt: P.nuevosSinContacto + " sin contactar" })}
      ${kpi("💛", fM(P.diezmoMes), "Aportes (mes)", { dir: "up", txt: "13% vs abr" })}
    </div>
    <div class="grid grid-4 mb-4">
      ${kpi("🧩", P.ministeriosActivos + "/" + P.ministeriosCatalogo, "Ministerios activos")}
      ${kpi("🧒", P.rocakids.presentes + "/" + P.rocakids.registrados, "RocaKids hoy")}
      ${kpi("👨", P.generos.hombres.toLocaleString("es-CO"), "Hombres")}
      ${kpi("👩", P.generos.mujeres.toLocaleString("es-CO"), "Mujeres")}
    </div>

    <div class="grid grid-2 mb-4">
      <div class="card card--pad-lg">
        <div class="card__title mb-2">⛪ Asistencia · domingo tras domingo</div>
        <p class="card__sub mb-3">Últimos 8 domingos</p>
        ${barrasAsistencia(P.asistenciaDom)}
      </div>
      <div class="card card--pad-lg">
        <div class="card__title mb-3">🧒 RocaKids · asistencia de hoy</div>
        <div class="metricas mb-3">
          <div class="m"><b>${P.rocakids.presentes}</b><span>Presentes</span></div>
          <div class="m"><b>${P.rocakids.registrados}</b><span>Registrados</span></div>
          <div class="m"><b>${Math.round(P.rocakids.presentes / P.rocakids.registrados * 100)}%</b><span>Cobertura</span></div>
        </div>
        ${["Bebés (1–2)", "Pequeños (3–5)", "Exploradores (6–7)", "Aventureros (8–10)"].map((e, i) => `
          <div class="flex between items-center" style="gap:12px; margin-bottom:9px">
            <span class="txt-sm" style="width:140px">${e}</span>
            <div class="progreso grow"><div class="progreso__barra" style="width:${Math.round(P.rocakids.porEdad[i] / Math.max(...P.rocakids.porEdad) * 100)}%"></div></div>
            <b class="txt-sm" style="width:30px; text-align:right">${P.rocakids.porEdad[i]}</b></div>`).join("")}
        <button class="btn btn--ghost btn--sm btn--bloque mt-3" data-accion="ir" data-valor="rocakids">Abrir check-in RocaKids →</button>
      </div>
    </div>

    <div class="grid grid-2 mb-4">
      <div class="card card--pad-lg">
        <div class="card__title mb-3">🧩 Ministerios por tamaño</div>
        ${P.ministeriosTop.map(m => `<div class="flex between items-center" style="gap:12px; margin-bottom:10px">
          <span class="txt-sm" style="width:150px">${m.ico} ${m.n}</span>
          <div class="progreso grow"><div class="progreso__barra" style="width:${Math.round(m.v / P.ministeriosTop[0].v * 100)}%"></div></div>
          <b class="txt-sm" style="width:38px; text-align:right">${m.v}</b></div>`).join("")}
      </div>
      <div class="card card--pad-lg">
        <div class="card__title mb-3">👫 Hombres y mujeres</div>
        <div class="progreso" style="height:26px; display:flex; margin-bottom:10px">
          <div style="width:${pctH}%; background:var(--azul-600); height:100%; display:grid; place-items:center; color:#fff; font-size:var(--tx-xs); font-weight:700">${pctH}%</div>
          <div style="width:${100 - pctH}%; background:var(--mostaza-500); height:100%; display:grid; place-items:center; color:var(--azul-900); font-size:var(--tx-xs); font-weight:700">${100 - pctH}%</div>
        </div>
        <div class="flex gap-3 txt-xs txt-suave mb-3"><span>🟦 Hombres: ${P.generos.hombres}</span><span>🟨 Mujeres: ${P.generos.mujeres}</span></div>
        <div class="card__title mb-2 mt-3">💛 Últimos diezmos y aportes</div>
        <div style="overflow-x:auto"><table class="tabla"><thead><tr><th>Persona</th><th>Monto</th><th>Fecha</th><th>Medio</th></tr></thead>
          <tbody>${P.ultimosDiezmos.map(d => `<tr><td>${d.persona}</td><td><b>${cop(d.monto)}</b></td><td class="txt-sm">${d.fecha}</td><td class="txt-sm">${d.medio}</td></tr>`).join("")}</tbody></table></div>
        <p class="txt-xs txt-suave mt-2">🔒 El récord de diezmo por persona es exclusivo de la Dirección General.</p>
      </div>
    </div>

    <div class="grid grid-2 mb-4">
      <div class="card card--pad-lg">
        <div class="card__title mb-3">🎂 Cumpleaños de la semana</div>
        ${F.PANEL.cumple.map(c => `<div class="fila"><div class="avatar avatar--sm" style="background:var(--mostaza-200); color:var(--mostaza-700)">${ini(c.nombre)}</div>
          <div class="fila__main"><b>${c.nombre} <span class="txt-xs txt-suave">· cumple ${c.edad}</span></b><span>${c.dia} · ${c.ministerio}</span></div>
          <button class="btn btn--ghost btn--sm" data-accion="contacto-wa" data-valor="${c.tel}">💬 Felicitar</button></div>`).join("")}
      </div>
      <div class="card card--pad-lg">
        <div class="card__title mb-3">📅 Eventos pastorales generales</div>
        ${P.eventos.map(e => `<div class="fila"><div class="cal-fecha">${e.dia.split(" ").slice(0, 2).join(" ")}</div>
          <div class="fila__main"><b>${e.titulo}</b><span>🕒 ${e.hora} · 📍 ${e.lugar}</span></div>
          <span class="badge badge--azul">${e.tipo}</span></div>`).join("")}
        <button class="btn btn--ghost btn--sm btn--bloque mt-3" data-accion="demo" data-valor="Abriendo el calendario general de la sede…">Ver calendario completo →</button>
      </div>
    </div>

    <div class="card card--pad-lg" style="background:linear-gradient(135deg,var(--azul-50),var(--mostaza-100)); border-color:var(--mostaza-300)">
      <div class="card__title">✨ Lectura de tu iglesia (IA)</div>
      <ul class="txt-sm txt-suave mt-3" style="margin:0; padding-left:1.1rem; line-height:1.9">
        <li>La asistencia dominical creció <b>+4,6%</b> en el último mes; el domingo 25 de mayo fue el más alto (1.402).</li>
        <li>Tienes <b>${P.nuevosSinContacto} nuevos sin contactar</b> y <b>${P.enRiesgo} personas en riesgo</b>: prioriza el seguimiento esta semana.</li>
        <li>Ministerios con más cupo disponible: <b>Josués</b> y <b>Años Dorados</b>. Buen momento para invitar.</li>
      </ul>
      <div class="flex gap-2 wrap mt-3">
        <button class="btn btn--ghost btn--sm" data-accion="ir" data-valor="nuevos">Ver nuevos →</button>
        <button class="btn btn--ghost btn--sm" data-accion="ir" data-valor="personas">Ver CRM →</button>
        <button class="btn btn--ghost btn--sm" data-accion="ir" data-valor="organigrama">Ver organigrama →</button>
      </div>
    </div>`;
  }
  function barrasAsistencia(data) {
    const max = Math.max(...data.map(d => d.v));
    return `<div class="flex gap-2" style="height:170px; align-items:flex-end">
      ${data.map(d => `<div style="flex:1; text-align:center; min-width:0">
        <div style="font-weight:700; font-size:var(--tx-xs)">${d.v}</div>
        <div style="height:${Math.round(d.v / max * 120)}px; background:linear-gradient(180deg,var(--azul-500),var(--azul-700)); border-radius:6px 6px 0 0; margin-top:4px"></div>
        <div class="txt-xs txt-suave mt-2">${d.f}</div></div>`).join("")}
    </div>`;
  }

  /* ============================================================
     2) ORGANIGRAMA — editable
     ============================================================ */
  function organigramaFilial(rol, estado) {
    const O = F.ORG;
    const edit = !!estado.params.orgEdit;
    const ce = edit ? 'contenteditable="true" spellcheck="false"' : "";
    const caja = (rol, nombre, sub, top) => `<div class="org__caja ${top ? "org__caja--top" : ""} ${edit ? "org__caja--edit" : ""}">
      <span class="org__rol" ${edit ? 'contenteditable="true"' : ""}>${rol}</span>
      <b ${ce}>${nombre}</b><small ${ce}>${sub}</small></div>`;
    return `
    ${pageHead("Mi sede", "Organigrama de mi iglesia",
      "La visual viva de tu estructura. Puedes <b>editarla</b> para reflejar cambios de liderazgo en cualquier momento.",
      edit
        ? `<div class="flex gap-2"><button class="btn btn--ghost" data-accion="org-add">＋ Nodo</button><button class="btn btn--primario" data-accion="org-guardar">✅ Guardar</button></div>`
        : `<button class="btn btn--mostaza" data-accion="org-editar">✏️ Editar organigrama</button>`)}

    ${edit ? `<div class="alerta alerta--info mb-4"><span class="ico">✏️</span><div>Modo edición: toca cualquier cargo o nombre para cambiarlo. Pulsa <b>Guardar</b> al terminar.</div></div>` : ""}

    <div class="card card--pad-lg">
      <div class="org">
        <div class="org__nivel">${caja(O.pastor.rol, O.pastor.nombre, O.pastor.sub, true)}</div>
        <div class="org__nivel">${O.direcciones.map(d => caja(d.rol, d.nombre, d.sub + " · " + d.lider)).join("")}</div>
        <div class="org__nivel">${O.coordinaciones.map(c => caja(c.rol, c.nombre, c.sub)).join("")}</div>
        <div class="org__nivel">${caja(O.base.rol, O.base.nombre, O.base.sub)}</div>
      </div>
    </div>

    <div class="grid grid-3 mt-4">
      ${kpi("🧭", O.direcciones.length, "Direcciones")}
      ${kpi("🧩", O.coordinaciones.length, "Coordinaciones")}
      ${kpi("🤝", "88", "Líderes de grupo")}
    </div>`;
  }

  /* ============================================================
     3) NUEVOS — con recurrencia
     ============================================================ */
  function nuevosFilial(rol, estado) {
    const N = F.NUEVOS;
    const recurrentes = N.filter(n => n.semanas.filter(Boolean).length >= 2).length;
    const sinContacto = N.filter(n => n.estado.toLowerCase().includes("pendiente")).length;
    return `
    ${pageHead("Acompañamiento", "Nuevos en la iglesia",
      "Quiénes están llegando y con qué <b>recurrencia</b> regresan. El primer cuidado define si se quedan: contáctalos rápido.",
      `<button class="btn btn--mostaza" data-accion="abrir-nuevo">✨ Registrar nuevo</button>`)}

    <div class="grid grid-4 mb-4">
      ${kpi("✨", N.length, "Nuevos en seguimiento")}
      ${kpi("🔁", recurrentes, "Recurrentes (2+ domingos)")}
      ${kpi("⏱️", sinContacto, "Bienvenida pendiente", sinContacto ? { dir: "down", txt: "contactar hoy" } : null)}
      ${kpi("🤝", N.filter(n => n.etapa === "conecta").length, "Listos para grupo")}
    </div>

    <div class="alerta alerta--aviso mb-4"><span class="ico">⏱️</span>
      <div>La secuencia de bienvenida (correo + WhatsApp) se envió automáticamente. Los <b>recurrentes sin grupo</b> son tu mejor oportunidad de conexión esta semana.</div></div>

    <div class="card" style="padding:0; overflow:hidden">
      <div style="overflow-x:auto"><table class="tabla" style="min-width:860px">
        <thead><tr><th>Persona</th><th>Contacto</th><th>Llegó por</th><th>1ª visita</th><th>Recurrencia</th><th>Estado</th><th></th></tr></thead>
        <tbody>${N.map(filaNuevo).join("")}</tbody>
      </table></div>
    </div>`;
  }
  function filaNuevo(n) {
    const asistencias = n.semanas.filter(Boolean).length;
    const puntos = n.semanas.map(s => `<span class="recur ${s ? "recur--si" : "recur--no"}" title="${s ? "Asistió" : "Faltó"}">${s ? "●" : "○"}</span>`).join("");
    return `<tr>
      <td><div class="flex gap-2 items-center">${`<div class="avatar avatar--sm">${ini(n.nombre)}</div>`}
        <div><b>${n.nombre}</b><div class="txt-xs txt-suave">${n.edad} años · ${n.asignado}</div></div></div></td>
      <td class="txt-xs"><div>✉️ ${n.email}</div><div class="txt-suave">📱 ${n.tel}</div></td>
      <td class="txt-sm">${n.fuente}</td>
      <td class="txt-sm nowrap">${n.primeraVisita}</td>
      <td><div class="flex gap-1 items-center">${puntos} <b class="txt-xs" style="margin-left:4px">${asistencias}×</b></div></td>
      <td>${etapaBadge(n.etapa)}<div class="txt-xs txt-suave mt-1">${n.estado}</div></td>
      <td><div class="flex gap-2"><button class="btn btn--ghost btn--sm" data-accion="contacto-wa" data-valor="${n.tel}">💬</button>
        <button class="btn btn--ghost btn--sm" data-accion="contacto-email" data-valor="${n.email}">✉️</button></div></td>
    </tr>`;
  }

  /* ============================================================
     4) MINISTERIO FILIAL — subdivisiones + CRM + grupos + calendario
     ============================================================ */
  function ministerioFilial(id, rol, estado) {
    const m = F.MIN[id];
    if (!m) return `<div class="vacio"><div class="ico">🤷</div>Ministerio no encontrado.</div>`;
    const tieneSubs = m.subs && m.subs.length;
    let subActivo = estado.params.sub;
    if (tieneSubs && (!subActivo || !m.subs.some(s => s.id === subActivo))) subActivo = m.subs[0].id;
    const grupos = tieneSubs ? (m.grupos[subActivo] || []) : m.grupos;
    const personas = tieneSubs ? (m.personas[subActivo] || []) : m.personas;
    const totalPersonas = tieneSubs ? m.subs.reduce((s, x) => s + x.personas, 0) : personas.length;
    const subObj = tieneSubs ? m.subs.find(s => s.id === subActivo) : null;

    return `
    ${volver("panel", "Volver al panel")}
    <div class="card card--pad-lg mb-4" style="background:linear-gradient(135deg,var(--azul-800),var(--azul-900)); color:#fff; border:none">
      <div class="flex gap-4 items-center wrap">
        <div style="font-size:2.2rem; width:72px; height:72px; display:grid; place-items:center; background:var(--mostaza-500); border-radius:var(--radio-md)">${m.ico}</div>
        <div class="grow"><h1 style="font-size:var(--tx-xl)">${m.nombre}</h1>
          <div class="txt-sm" style="opacity:.85">${m.desc}</div>
          <div class="txt-sm mt-2">🧑‍🏫 Director: <b>${m.director}</b></div></div>
        <button class="btn btn--mostaza btn--sm" data-accion="demo" data-valor="Generando reporte de ${m.nombre}…">📊 Reporte</button>
      </div>
    </div>

    <div class="grid grid-4 mb-4">
      ${kpi("👥", totalPersonas, "Personas")}
      ${kpi("🤝", tieneSubs ? Object.values(m.grupos).reduce((s, g) => s + g.length, 0) : grupos.length, "Grupos pequeños")}
      ${kpi("🧩", tieneSubs ? m.subs.length : "—", tieneSubs ? "Subdivisiones" : "Sin subdivisión")}
      ${kpi("📅", m.calendario.length, "Eventos próximos")}
    </div>

    ${tieneSubs ? `
    <div class="card mb-4">
      <div class="card__title mb-3">🧩 Escoge la subdivisión</div>
      <div class="flex gap-2 wrap">
        ${m.subs.map(s => `<button class="chip ${s.id === subActivo ? "activo" : ""}" data-accion="sub-ministerio" data-min="${id}" data-valor="${s.id}">${s.nombre} · ${s.rango}</button>`).join("")}
      </div>
      <div class="alerta alerta--info mt-3"><span class="ico">${m.ico}</span><div><b>${subObj.nombre}</b> (${subObj.rango}) · 👥 ${subObj.personas} personas · 🧑‍🏫 Líder: ${subObj.lider}</div></div>
    </div>` : ""}

    <div class="card card--pad-lg mb-4">
      <div class="card__title mb-2">🤝 Grupos pequeños${tieneSubs ? " · " + subObj.nombre : ""}</div>
      <p class="card__sub mb-3">Ocupación y liderazgo de cada grupo</p>
      ${grupos.length ? gruposGrid(grupos) : `<p class="txt-sm txt-suave">Sin grupos en esta subdivisión todavía.</p>`}
    </div>

    <div class="card card--pad-lg mb-4">
      <div class="flex between items-center mb-2"><div class="card__title">👥 CRM · personas${tieneSubs ? " · " + subObj.nombre : ""}</div>
        <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="Exportando el CRM de ${m.nombre} a Excel…">⬇️ Exportar</button></div>
      <p class="card__sub mb-2">Contacto rápido por WhatsApp o correo desde cada persona.</p>
      <div class="mb-3">${distribucionEtapas(personas)}</div>
      ${personas.length ? personas.map(filaCRM).join("") : `<p class="txt-sm txt-suave">Sin personas registradas en esta subdivisión.</p>`}
    </div>

    ${calendarList(m.calendario)}`;
  }

  /* ============================================================
     5) CURSOS — con inscritos (wrap para pastor_sede)
     ============================================================ */
  const POOL_INSCRITOS = [
    { n: "Sebastián Cardona", tel: "+57 320 555 7741", email: "sebastian.c@email.com", etapa: "conoce" },
    { n: "Daniela Rincón", tel: "+57 318 555 6650", email: "dani.rincon@email.com", etapa: "conecta" },
    { n: "Laura Ximena Peña", tel: "+57 300 555 7715", email: "lx.pena@email.com", etapa: "conoce" },
    { n: "Sergio Mahecha", tel: "+57 314 555 5512", email: "sergio.m@email.com", etapa: "conoce" },
    { n: "Natalia Vélez", tel: "+57 313 555 5511", email: "nata.velez@email.com", etapa: "crece" },
    { n: "Mauricio Ríos", tel: "+57 328 555 3324", email: "mauricio.r@email.com", etapa: "conecta" },
    { n: "Andrea Salazar", tel: "+57 319 555 4301", email: "andrea.s@email.com", etapa: "crece" },
    { n: "Claudia Bernal", tel: "+57 318 555 6004", email: "claudia.b@email.com", etapa: "conecta" }
  ];
  function cursosFilial(rol, estado) {
    return `
    ${pageHead("Crece", "Cursos cortos · activos por mes",
      "Cada curso del camino de discipulado. Entra para ver inscritos y su información de contacto.",
      `<button class="btn btn--ghost" data-accion="ir" data-valor="instituto">🎓 Ir al Instituto →</button>`)}
    <div class="grid grid-auto">${DB.CURSOS.map(c => {
      const lleno = c.inscritos >= c.cupo, e = DB.ETAPAS[c.etapa];
      return `<div class="card">
        <div class="flex gap-3 items-center mb-3"><div class="kpi__ico" style="background:var(--${e.clase === 'crece' ? 'exito-bg' : 'azul-100'})">${c.ico}</div>
          <div class="grow"><b style="font-size:var(--tx-md)">${c.nombre}</b><div class="txt-xs txt-suave">${c.duracion} · ${c.modalidad}</div></div></div>
        <p class="txt-sm txt-suave mb-3">${c.desc}</p>
        <div class="flex between items-center mb-2 txt-sm"><span>📅 ${c.inicia}</span>
          <span class="${lleno ? "badge badge--peligro" : "txt-suave"}">${c.inscritos}/${c.cupo} inscritos</span></div>
        <div class="progreso mb-3"><div class="progreso__barra" style="width:${Math.round(c.inscritos / c.cupo * 100)}%"></div></div>
        <button class="btn btn--primario btn--bloque" data-accion="ver-curso" data-valor="${c.id}">Ver inscritos →</button></div>`;
    }).join("")}</div>`;
  }
  function cursoRoster(id, rol, estado) {
    const c = DB.CURSOS.find(x => x.id === id);
    if (!c) return `<div class="vacio"><div class="ico">🤷</div>Curso no encontrado.</div>`;
    const muestra = POOL_INSCRITOS.slice(0, Math.min(POOL_INSCRITOS.length, Math.max(4, Math.round(c.inscritos / 5))));
    return `
    ${volver("cursos", "Volver a cursos")}
    <div class="card card--pad-lg mb-4" style="background:linear-gradient(135deg,var(--azul-800),var(--azul-900)); color:#fff; border:none">
      <div class="flex gap-4 items-center wrap">
        <div style="font-size:2rem; width:66px; height:66px; display:grid; place-items:center; background:var(--mostaza-500); border-radius:var(--radio-md)">${c.ico}</div>
        <div class="grow"><h1 style="font-size:var(--tx-xl)">${c.nombre}</h1>
          <div class="txt-sm" style="opacity:.85">${c.desc}</div>
          <div class="txt-sm mt-2">📅 ${c.inicia} · ${c.duracion} · ${c.modalidad}</div></div>
      </div>
    </div>
    <div class="grid grid-3 mb-4">
      ${kpi("📝", c.inscritos, "Inscritos")}
      ${kpi("🪑", c.cupo - c.inscritos, "Cupos libres")}
      ${kpi("📊", Math.round(c.inscritos / c.cupo * 100) + "%", "Ocupación")}
    </div>
    <div class="card card--pad-lg">
      <div class="flex between items-center mb-3"><div class="card__title">👥 Inscritos (muestra)</div>
        <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="Exportando lista de inscritos…">⬇️ Exportar</button></div>
      ${muestra.map(p => `<div class="fila"><div class="avatar avatar--sm">${ini(p.n)}</div>
        <div class="fila__main"><b>${p.n}</b><span>${p.email} · ${p.tel}</span></div>
        <div class="flex gap-2 items-center">${etapaBadge(p.etapa)}${contactoBtns(p.tel, p.email)}</div></div>`).join("")}
    </div>`;
  }

  /* ============================================================
     6) INSTITUTO IBLI/FACTER — inscritos (wrap para pastor_sede)
     ============================================================ */
  const INSCRITOS_INSTITUTO = [
    { n: "Valentina Ríos", prog: "IBLI", sem: 2, tel: "+57 310 555 1208", email: "valentina.rios@email.com" },
    { n: "Camila Vargas", prog: "FACTER", sem: 1, tel: "+57 310 555 3344", email: "camila.vargas@email.com" },
    { n: "Andrea Pineda", prog: "IBLI", sem: 4, tel: "+57 311 555 7788", email: "andrea@casaroca.org" },
    { n: "Diego Rivas", prog: "IBLI", sem: 3, tel: "+57 314 555 6003", email: "diego.r@email.com" },
    { n: "Natalia Cruz", prog: "FACTER", sem: 2, tel: "+57 321 555 1101", email: "natalia.cruz@email.com" },
    { n: "Óscar Tovar", prog: "IBLI", sem: 1, tel: "+57 313 555 3321", email: "oscar.tovar@email.com" }
  ];
  function institutoFilial(rol, estado) {
    const base = V._institutoBase(rol, estado);
    const ibli = INSCRITOS_INSTITUTO.filter(i => i.prog === "IBLI").length;
    const facter = INSCRITOS_INSTITUTO.filter(i => i.prog === "FACTER").length;
    const roster = `
    <div class="card card--pad-lg mt-4">
      <div class="flex between items-center mb-3"><div class="card__title">👨‍🎓 Inscritos de mi sede · IBLI / FACTER</div>
        <div class="flex gap-2"><span class="badge badge--azul">IBLI: ${ibli}</span><span class="badge badge--mostaza">FACTER: ${facter}</span></div></div>
      <p class="card__sub mb-3">En qué programa y semestre está cada persona de tu iglesia.</p>
      <div style="overflow-x:auto"><table class="tabla" style="min-width:680px">
        <thead><tr><th>Persona</th><th>Programa</th><th>Semestre</th><th>Contacto</th><th></th></tr></thead>
        <tbody>${INSCRITOS_INSTITUTO.map(i => `<tr>
          <td><div class="flex gap-2 items-center"><div class="avatar avatar--sm">${ini(i.n)}</div><b>${i.n}</b></div></td>
          <td><span class="badge badge--${i.prog === "IBLI" ? "azul" : "mostaza"}">${i.prog}</span></td>
          <td>Semestre ${i.sem}</td>
          <td class="txt-xs"><div>✉️ ${i.email}</div><div class="txt-suave">📱 ${i.tel}</div></td>
          <td><div class="flex gap-2"><button class="btn btn--ghost btn--sm" data-accion="contacto-wa" data-valor="${i.tel}">💬</button>
            <button class="btn btn--ghost btn--sm" data-accion="contacto-email" data-valor="${i.email}">✉️</button></div></td></tr>`).join("")}</tbody>
      </table></div>
    </div>`;
    return base + roster;
  }

  /* ============================================================
     7) CONTABILIDAD — presupuesto + pagos / facturas
     ============================================================ */
  function contabilidadFilial(rol, estado) {
    const C = F.CONTA;
    const pctEjec = Math.round(C.ejecutadoMes / C.presupuestoMes * 100);
    const maxCat = Math.max(...C.presupuesto.map(p => p.presupuesto));
    return `
    ${pageHead("ERP · Administración local", "Contabilidad de mi iglesia",
      "El esquema de presupuesto de tu sede, su ejecución y los últimos pagos. Sube facturas y comprobantes para soporte.",
      `<button class="btn btn--mostaza" data-accion="subir-doc">📎 Subir factura / pago</button>`)}

    <div class="grid grid-4 mb-4">
      ${kpi("💛", cop(C.ingresoMes), "Ingresos (mes)")}
      ${kpi("📋", cop(C.presupuestoMes), "Presupuesto (mes)")}
      ${kpi("💸", cop(C.ejecutadoMes), "Ejecutado", { dir: "up", txt: pctEjec + "% del presupuesto" })}
      ${kpi("✅", cop(C.ingresoMes - C.ejecutadoMes), "Disponible")}
    </div>

    <div class="card card--pad-lg mb-4">
      <div class="card__title mb-3">📊 Presupuesto por categoría (ejecución)</div>
      ${C.presupuesto.map(p => {
        const pct = Math.round(p.ejecutado / p.presupuesto * 100);
        const tipo = pct > 90 ? "peligro" : pct > 70 ? "aviso" : "exito";
        return `<div style="margin-bottom:14px">
          <div class="flex between items-center txt-sm mb-1"><b>${p.categoria}</b>
            <span class="txt-suave">${cop(p.ejecutado)} / ${cop(p.presupuesto)} · <b>${pct}%</b></span></div>
          <div class="progreso"><div class="progreso__barra" style="width:${pct}%; background:var(--${tipo})"></div></div></div>`;
      }).join("")}
    </div>

    <div class="card card--pad-lg">
      <div class="flex between items-center mb-3"><div class="card__title">🧾 Últimos pagos y facturas</div>
        <button class="btn btn--mostaza btn--sm" data-accion="subir-doc">📎 Subir comprobante</button></div>
      <div style="overflow-x:auto"><table class="tabla" style="min-width:760px">
        <thead><tr><th>Concepto</th><th>Proveedor</th><th>Factura</th><th>Monto</th><th>Fecha</th><th>Estado</th></tr></thead>
        <tbody>${C.pagos.map(f => `<tr>
          <td><b>${f.concepto}</b></td><td class="txt-sm">${f.proveedor}</td><td class="txt-sm">${f.factura}</td>
          <td class="nowrap"><b>${cop(f.monto)}</b></td><td class="txt-sm nowrap">${f.fecha}</td>
          <td><span class="badge badge--${f.estado === "Pagado" ? "exito" : "aviso"}">${f.estado}</span></td></tr>`).join("")}</tbody>
      </table></div>
      <div class="alerta alerta--info mt-3"><span class="ico">🔗</span><div>Estos movimientos se sincronizan con <b>Tesorería</b> y el cierre corporativo en Siigo (Dirección General).</div></div>
    </div>`;
  }

  /* ============================================================
     8) EQUIPOS OPERATIVOS — hub + detalle
     ============================================================ */
  function operativosHub(rol, estado) {
    const totServ = F.OPER_ORDEN.reduce((s, id) => s + F.OPER[id].servidores.length, 0);
    return `
    ${pageHead("Equipos operativos", "Equipos de servicio del domingo",
      "Cada equipo, su director y los servidores voluntarios. Entra para ver el detalle y su calendario.")}
    <div class="grid grid-3 mb-4">
      ${kpi("🛠️", F.OPER_ORDEN.length, "Equipos operativos")}
      ${kpi("🙋", totServ, "Servidores voluntarios")}
      ${kpi("📅", "Domingo", "Próximo turno")}
    </div>
    <div class="grid grid-auto">
      ${F.OPER_ORDEN.map(id => {
        const o = F.OPER[id];
        return `<div class="card">
          <div class="flex gap-3 items-center mb-2"><div class="kpi__ico" style="background:var(--mostaza-100)">${o.ico}</div>
            <div class="grow"><b style="font-size:var(--tx-md)">${o.nombre}</b>
              <div class="txt-xs txt-suave">🧑‍🏫 ${o.director}</div></div></div>
          <p class="txt-sm txt-suave mb-3">${o.desc}</p>
          <div class="flex between txt-sm mb-3"><span>🙋 ${o.servidores.length} servidores</span><span>📅 ${o.calendario.length} eventos</span></div>
          <button class="btn btn--primario btn--bloque" data-accion="ver-operativo" data-valor="${id}">Ver equipo →</button></div>`;
      }).join("")}
    </div>`;
  }
  function operativoDetalle(id, rol, estado) {
    const o = F.OPER[id];
    if (!o) return `<div class="vacio"><div class="ico">🤷</div>Equipo no encontrado.</div>`;
    return `
    ${volver("operativos", "Volver a equipos operativos")}
    <div class="card card--pad-lg mb-4" style="background:linear-gradient(135deg,var(--azul-800),var(--azul-900)); color:#fff; border:none">
      <div class="flex gap-4 items-center wrap">
        <div style="font-size:2.2rem; width:72px; height:72px; display:grid; place-items:center; background:var(--mostaza-500); border-radius:var(--radio-md)">${o.ico}</div>
        <div class="grow"><h1 style="font-size:var(--tx-xl)">${o.nombre}</h1>
          <div class="txt-sm" style="opacity:.85">${o.desc}</div></div>
        <button class="btn btn--mostaza btn--sm" data-accion="demo" data-valor="Enviando recordatorio de turno por WhatsApp…">📲 Recordar turno</button>
      </div>
    </div>

    <div class="card card--pad-lg mb-4">
      <div class="card__title mb-3">🧑‍🏫 Director del equipo</div>
      <div class="fila"><div class="avatar avatar--sm" style="background:var(--mostaza-200); color:var(--mostaza-700)">${ini(o.director)}</div>
        <div class="fila__main"><b>${o.director}</b><span>Director · ${o.nombre}</span></div>
        <div class="flex gap-2 items-center">${contactoBtns(o.dirTel, o.dirEmail)}</div></div>
    </div>

    <div class="card card--pad-lg mb-4">
      <div class="flex between items-center mb-3"><div class="card__title">🙋 Servidores voluntarios (${o.servidores.length})</div>
        <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="Agregando un nuevo servidor al equipo…">＋ Agregar servidor</button></div>
      ${o.servidores.map(s => `<div class="fila"><div class="avatar avatar--sm">${ini(s.n)}</div>
        <div class="fila__main"><b>${s.n}</b><span>${s.rol}</span></div>
        <div class="flex gap-2 items-center">${contactoBtns(s.tel, s.email)}</div></div>`).join("")}
    </div>

    ${calendarList(o.calendario)}`;
  }

  /* ============================================================
     9) CONSEJERÍAS — solicitudes + asignación
     ============================================================ */
  function consejeriasFilial(rol, estado) {
    const items = F.CONSEJERIAS;
    const sinAsignar = items.filter(c => c.asignado === "—").length;
    const proceso = items.filter(c => c.estado === "En proceso" || c.estado === "Programada").length;
    const consejeros = F.OPER.m_consejeria.servidores;
    return `
    ${pageHead("Cuidado pastoral", "Consejerías",
      "Las solicitudes de acompañamiento de las personas y su asignación al consejero correspondiente.",
      `<button class="btn btn--mostaza" data-accion="demo" data-valor="Registrando nueva solicitud de consejería…">＋ Nueva solicitud</button>`)}

    <div class="grid grid-4 mb-4">
      ${kpi("🤲", items.length, "Solicitudes")}
      ${kpi("📥", sinAsignar, "Sin asignar", sinAsignar ? { dir: "down", txt: "asignar consejero" } : null)}
      ${kpi("🔄", proceso, "En proceso / programadas")}
      ${kpi("✅", items.filter(c => c.estado === "Finalizada").length, "Finalizadas")}
    </div>

    <div class="card mb-4">
      <div class="card__title mb-3">🧑‍🏫 Equipo de consejeros disponibles</div>
      <div class="flex gap-2 wrap">${consejeros.map(c => `<span class="chip" style="cursor:default" title="${c.email}">${c.n.replace("Ps. ", "")} · ${c.rol.replace("Consejero · ", "").replace("Consejera · ", "")}</span>`).join("")}</div>
    </div>

    <div class="card" style="padding:0; overflow:hidden">
      <div style="overflow-x:auto"><table class="tabla" style="min-width:900px">
        <thead><tr><th>Persona</th><th>Tema</th><th>Ministerio</th><th>Prioridad</th><th>Asignado a</th><th>Estado</th><th></th></tr></thead>
        <tbody>${items.map(filaConsejeria).join("")}</tbody>
      </table></div>
    </div>`;
  }
  function filaConsejeria(c) {
    const prio = { alta: "badge--peligro", media: "badge--aviso", baja: "badge--azul" }[c.prioridad];
    const est = { "Solicitada": "aviso", "En proceso": "azul", "Programada": "azul", "Finalizada": "exito" }[c.estado] || "azul";
    return `<tr>
      <td><div class="flex gap-2 items-center"><div class="avatar avatar--sm">${ini(c.persona)}</div>
        <div><b>${c.persona}</b><div class="txt-xs txt-suave">${c.fecha}</div></div></div></td>
      <td>${c.tema}</td>
      <td class="txt-sm">${c.ministerio}</td>
      <td><span class="badge ${prio}">${c.prioridad}</span></td>
      <td class="txt-sm">${c.asignado === "—" ? `<span class="badge badge--aviso">Sin asignar</span>` : c.asignado}</td>
      <td><span class="badge badge--${est}">${c.estado}</span></td>
      <td><div class="flex gap-2">
        <button class="btn btn--ghost btn--sm" data-accion="contacto-wa" data-valor="${c.tel}">💬</button>
        ${c.asignado === "—" ? `<button class="btn btn--mostaza btn--sm" data-accion="asignar-consejero" data-valor="${c.id}">Asignar</button>` : ""}</div></td>
    </tr>`;
  }

  /* ============================================================
     WRAPPERS — solo el Pastor Congregacional ve estas versiones
     ============================================================ */
  function wrapPanel() {
    const base = V.panel;
    V.panel = function (rol, estado) {
      if (rol && rol.id === "pastor_sede") return panelFilial(rol, estado);
      return base(rol, estado);
    };
  }
  function wrapCursos() {
    const base = V.cursos;
    V.cursos = function (rol, estado) {
      if (rol && rol.id === "pastor_sede") return cursosFilial(rol, estado);
      return base(rol, estado);
    };
  }
  function wrapInstituto() {
    const base = V.instituto;
    V._institutoBase = base;
    V.instituto = function (rol, estado) {
      if (rol && rol.id === "pastor_sede") return institutoFilial(rol, estado);
      return base(rol, estado);
    };
  }

  wrapPanel();
  wrapCursos();
  wrapInstituto();
  Object.assign(window.VIEWS, {
    organigramaFilial, nuevosFilial, ministerioFilial, cursoRoster,
    contabilidadFilial, operativosHub, operativoDetalle, consejeriasFilial
  });
})();
