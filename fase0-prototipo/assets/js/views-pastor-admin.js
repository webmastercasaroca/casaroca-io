/* ============================================================
   CASA ROCA AI SYSTEM — VISTAS · PASTOR DIRECTOR GENERAL (Fase 0 · v3)
   Perfil profundo: panel de red (36 sedes) con drill-down por
   iglesia, organigrama y gestión de usuarios por sede, centro de
   aprobaciones con flujos hasta el final, analítica de grupos
   pequeños / cursos por iglesia / instituto por ciudad, y secciones
   profundas por equipo administrativo (Legal, Tecnología, Talento
   Humano, Comunicaciones, Tesorería, Contable).
   Extiende window.VIEWS envolviendo las vistas base.
   ============================================================ */
(function () {
  const DB = window.DB, V = window.VIEWS, H = window.VIEWS.H;
  const cop = H.cop, kpi = H.kpi, pageHead = H.pageHead, volver = H.volver;
  const fM = n => "$" + n.toLocaleString("es-CO") + " M";

  /* ============================================================
     1) PANEL — análisis profundo de la red (suma de 36 sedes)
        + drill-down: click en iglesia → detalle de esa sede
     ============================================================ */
  function panelRed(rol, estado) {
    const t = DB.totalesRed();
    const pend = DB.APROBACIONES.filter(a => a.estado === "pendiente").length;
    const ordenadas = [...DB.RED].sort((a, b) => b.personas - a.personas);
    const maxP = ordenadas[0].personas;
    return `
    ${pageHead("Dirección General · toda la red", "Buenas, Pastor Darío 👋",
      `Visión consolidada de las <b>${t.sedes} iglesias</b> en ${t.paises} países. Cada métrica suma la red; haz clic en una iglesia para ver su detalle y su CRM.`,
      `<button class="btn btn--primario" data-accion="ir" data-valor="aprobaciones">📥 ${pend} aprobaciones pendientes</button>`)}

    <div class="grid grid-5 mb-4">
      ${kpi("👥", t.personas.toLocaleString("es-CO"), "Personas en la red", { dir: "up", txt: "3,2% mes" })}
      ${kpi("⛪", t.asistencia.toLocaleString("es-CO"), "Asistencia domingo")}
      ${kpi("🧒", t.rockids.toLocaleString("es-CO"), "RocaKids asistentes")}
      ${kpi("🤝", t.gpActivos.toLocaleString("es-CO"), "Grupos pequeños activos")}
      ${kpi("💛", fM(t.diezmoMes), "Diezmos (mes)", { dir: "up", txt: "13% vs abr" })}
    </div>
    <div class="grid grid-5 mb-4">
      ${kpi("🧩", t.ministerios.toLocaleString("es-CO"), "Grupos ministeriales")}
      ${kpi("✨", t.nuevos.toLocaleString("es-CO"), "Nuevos este mes")}
      ${kpi("🏛️", t.sedes, "Sedes / filiales")}
      ${kpi("🌎", t.paises, "Países")}
      ${kpi("❤️", t.cuidadoProm, "Índice de cuidado prom.")}
    </div>

    <div class="grid grid-2 mb-4">
      <div class="card card--pad-lg">
        <div class="card__title mb-3">🌎 Personas por país</div>
        ${porPais()}
      </div>
      <div class="card card--pad-lg">
        <div class="card__title mb-3">🏆 Top sedes por tamaño</div>
        ${ordenadas.slice(0, 8).map((s, i) => `
          <div class="rank">
            <span class="rank__pos">${i + 1}</span>
            <div class="rank__bar"><div class="rank__fill" style="width:${Math.round(s.personas / maxP * 100)}%"></div></div>
            <button class="btn btn--ghost btn--sm" data-accion="ver-sede" data-valor="${s.id}" style="min-width:160px; justify-content:space-between">${s.nombre} <b>${s.personas}</b></button>
          </div>`).join("")}
      </div>
    </div>

    <div class="card mb-4" style="padding:0; overflow:hidden">
      <div class="flex between items-center wrap gap-3" style="padding:var(--sp-4) var(--sp-4) var(--sp-3)">
        <div class="card__title">🏛️ Las ${t.sedes} iglesias · discriminado</div>
        <div class="flex gap-2 wrap">
          <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="Exportando consolidado de la red a Excel…">⬇️ Exportar</button>
          <button class="btn btn--ghost btn--sm" data-accion="ir" data-valor="filiales">Gestionar filiales →</button>
        </div>
      </div>
      <div style="overflow-x:auto">
        <table class="tabla" style="min-width:920px">
          <thead><tr>
            <th>Iglesia</th><th>País</th><th>Personas</th><th>Asist. dom.</th><th>RocaKids</th>
            <th>Grupos peq.</th><th>Ministerios</th><th>Diezmo/mes</th><th>Cuidado</th><th></th>
          </tr></thead>
          <tbody>${ordenadas.map(filaSedeRed).join("")}</tbody>
        </table>
      </div>
    </div>
    ${tarjetaIaRed()}`;
  }
  function filaSedeRed(s) {
    const tipo = s.cuidado >= 80 ? "exito" : s.cuidado >= 60 ? "aviso" : "peligro";
    return `<tr style="cursor:pointer">
      <td><b>${s.nombre}</b>${s.esMadre ? ' <span class="badge badge--mostaza">Madre</span>' : ""}<div class="txt-xs txt-suave">🧑‍✈️ ${s.pastor}</div></td>
      <td class="nowrap txt-sm">${s.pais}</td>
      <td><b>${s.personas.toLocaleString("es-CO")}</b></td>
      <td class="txt-sm">${s.asistencia.toLocaleString("es-CO")}</td>
      <td class="txt-sm">${s.rockids}</td>
      <td class="txt-sm">${s.gpActivos}</td>
      <td class="txt-sm">${s.ministerios}</td>
      <td class="nowrap txt-sm"><b>${fM(s.diezmoMes)}</b></td>
      <td><span class="badge badge--${tipo}">${s.cuidado}</span></td>
      <td><button class="btn btn--primario btn--sm" data-accion="ver-sede" data-valor="${s.id}">Ver iglesia →</button></td>
    </tr>`;
  }
  function porPais() {
    const map = {};
    DB.RED.forEach(s => { map[s.pais] = (map[s.pais] || 0) + s.personas; });
    const arr = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const max = arr[0][1];
    return arr.map(([pais, v]) => `
      <div class="flex between items-center" style="gap:12px; margin-bottom:10px">
        <span class="txt-sm" style="width:130px">${pais}</span>
        <div class="progreso grow"><div class="progreso__barra" style="width:${Math.round(v / max * 100)}%"></div></div>
        <b class="txt-sm" style="width:64px; text-align:right">${v.toLocaleString("es-CO")}</b>
      </div>`).join("");
  }
  function tarjetaIaRed() {
    return `<div class="card card--pad-lg" style="background:linear-gradient(135deg,var(--azul-50),var(--mostaza-100)); border-color:var(--mostaza-300)">
      <div class="card__title">✨ Lectura de la red (IA)</div>
      <ul class="txt-sm txt-suave mt-3" style="margin:0; padding-left:1.1rem; line-height:1.9">
        <li><b>Miami</b> y <b>Madrid</b> lideran el crecimiento del Instituto (+31% / +26%). Considera reforzar formación internacional.</li>
        <li>3 sedes tienen índice de cuidado bajo (&lt;60): revisa su seguimiento de nuevos desde <b>Filiales</b>.</li>
        <li>Tienes <b>${DB.APROBACIONES.filter(a => a.estado === "pendiente").length} aprobaciones</b> esperando tu decisión, ${DB.APROBACIONES.filter(a => a.estado === "pendiente" && a.prioridad === "alta").length} de alta prioridad.</li>
      </ul>
      <button class="btn btn--ghost btn--sm mt-3" data-accion="ir" data-valor="aprobaciones">Revisar aprobaciones →</button>
    </div>`;
  }

  /* ============================================================
     2) DETALLE DE SEDE — organigrama + análisis + usuarios + CRM
     ============================================================ */
  function sedeDetalle(id, rol, estado) {
    const s = DB.sedeRed(id);
    if (!s) return `<div class="vacio"><div class="ico">🤷</div>Iglesia no encontrada.</div>`;
    const tipo = s.cuidado >= 80 ? "exito" : s.cuidado >= 60 ? "aviso" : "peligro";
    return `
    ${volver("filiales", "Volver a filiales")}
    <div class="card card--pad-lg mb-4" style="background:linear-gradient(135deg,var(--azul-800),var(--azul-900)); color:#fff; border:none">
      <div class="flex gap-4 items-center wrap">
        <div style="font-size:2rem; width:70px; height:70px; display:grid; place-items:center; background:var(--mostaza-500); border-radius:var(--radio-md)">🏛️</div>
        <div class="grow">
          <div class="flex gap-2 items-center wrap"><h1 style="font-size:var(--tx-xl)">${s.nombre}</h1>${s.esMadre ? '<span class="badge badge--mostaza">Sede madre</span>' : ""}</div>
          <div class="txt-sm" style="opacity:.85">${s.ciudad} · ${s.pais} · 🧑‍✈️ Pastor congregacional: <b>${s.pastor}</b></div>
        </div>
        <div class="flex gap-2 wrap">
          <button class="btn btn--mostaza btn--sm" data-accion="ver-crm-sede" data-valor="${s.id}">👥 Ver CRM de esta iglesia →</button>
          <button class="btn btn--ghost btn--sm" style="color:#fff;border-color:rgba(255,255,255,.4)" data-accion="demo" data-valor="Entrando como pastor de ${s.nombre} (impersonar)…">Entrar como pastor →</button>
        </div>
      </div>
    </div>

    <div class="card card--pad-lg mb-4">
      <div class="card__title mb-3">📊 Análisis de la iglesia</div>
      <div class="metricas">
        <div class="m"><b>${s.personas.toLocaleString("es-CO")}</b><span>Personas</span></div>
        <div class="m"><b>${s.asistencia.toLocaleString("es-CO")}</b><span>Asist. domingo</span></div>
        <div class="m"><b>${s.rockids}</b><span>RocaKids</span></div>
        <div class="m"><b>${s.gpActivos}</b><span>Grupos peq.</span></div>
        <div class="m"><b>${s.ministerios}</b><span>Ministerios</span></div>
        <div class="m"><b>${fM(s.diezmoMes)}</b><span>Diezmo/mes</span></div>
        <div class="m"><b>${s.nuevos}</b><span>Nuevos/mes</span></div>
        <div class="m"><b>${s.cuidado}</b><span>Índice cuidado</span></div>
      </div>
      <div class="alerta alerta--${tipo === 'exito' ? 'exito' : tipo === 'aviso' ? 'aviso' : 'info'} mt-4"><span class="ico">${tipo === 'exito' ? '✅' : '⚠️'}</span>
        <div>Índice de cuidado <b>${s.cuidado}/100</b>. ${s.cuidado >= 80 ? "Sede saludable, buen seguimiento de personas." : s.cuidado >= 60 ? "Aceptable; conviene reforzar el contacto a nuevos." : "Bajo: prioriza acompañamiento y asignación de líderes."}</div></div>
    </div>

    <div class="card card--pad-lg mb-4">
      <div class="card__title mb-3">🗂️ Organigrama de ${s.nombre}</div>
      ${organigrama(s)}
    </div>

    <div class="grid grid-2 mb-4">
      <div class="card card--pad-lg">
        <div class="card__title mb-3">🧩 Ministerios por tamaño</div>
        ${ministeriosSede(s)}
      </div>
      <div class="card card--pad-lg">
        <div class="card__title mb-3">🤝 Líderes y voluntarios</div>
        ${kpi("🧑‍🏫", Math.round(s.gpActivos * 1.1), "Líderes activos")}
        <div class="mt-3">${kpi("🙋", Math.round(s.personas * 0.08), "Voluntarios sirviendo")}</div>
        <div class="alerta alerta--info mt-3"><span class="ico">✨</span><div>Relación de cuidado: <b>1 líder por cada ${Math.round(s.personas / Math.max(1, s.gpActivos * 1.1))} personas</b>. ${s.personas / Math.max(1, s.gpActivos) > 25 ? "Recomendado formar más líderes." : "Saludable."}</div></div>
      </div>
    </div>

    <div class="card card--pad-lg">
      <div class="flex between items-center mb-3"><div class="card__title">👤 Gestión de usuarios · ${s.nombre}</div>
        <button class="btn btn--mostaza btn--sm" data-accion="agregar-usuario" data-valor="${s.id}">＋ Agregar usuario</button></div>
      <p class="card__sub mb-3">Como Dirección General puedes <b>poner o quitar</b> usuarios y roles en cualquier filial.</p>
      <div id="usuarios-sede">${usuariosSede(s)}</div>
    </div>`;
  }

  function organigrama(s) {
    const congr = DB.MINISTERIOS.filter(m => m.activo && m.tipo === "congregacional");
    const oper = DB.MINISTERIOS.filter(m => m.activo && m.tipo === "operacional");
    const tarjetaMin = m => `<button class="org__caja org__caja--clic" data-accion="ver-org" data-valor="${s.id}:${m.id}">
        <span style="font-size:1.4rem">${m.ico}</span>
        <b>${m.nombre}</b>
        <small>${m.director}</small>
        <span class="org__chip">${m.subdiv && m.subdiv.length ? m.subdiv.length + " coord." : "Director"} · ${m.grupos} grupos</span>
        <span class="org__ver">Ver organigrama →</span>
      </button>`;
    return `<div class="org">
      <div class="org__nivel"><div class="org__caja org__caja--top">
        <span class="org__rol" style="color:var(--mostaza-300)">Pastor congregacional</span>
        <b>${s.pastor}</b><small>Responsable de la sede · ${s.ministerios} ministerios</small></div></div>
      <div class="org__rama"></div>
      <div class="org__hint">👇 Estos son los ministerios de la sede. Haz clic en uno para ver su organigrama interno (director / coordinadores → líderes).</div>
      <div class="org__seccion-lbl">🧒 Ministerios congregacionales</div>
      <div class="org__grid">${congr.map(tarjetaMin).join("")}</div>
      <div class="org__seccion-lbl mt-4">🛠️ Equipos operativos</div>
      <div class="org__grid">${oper.map(tarjetaMin).join("")}</div>
    </div>`;
  }

  /* ---- Generador de organigrama detallado por ministerio ---- */
  const NOMBRES = ["Andrés", "Carolina", "Felipe", "Valeria", "Mateo", "Daniela", "Sebastián", "Laura", "Camilo", "Natalia", "Diego", "Paula", "Santiago", "Andrea", "Juan David", "Sofía", "Ricardo", "Marcela", "Óscar", "Liliana", "David", "Sara", "Tomás", "Ana", "Iván", "Gloria", "Pedro", "Marta", "Luis", "Carmen", "Hernán", "Lucía", "Nicolás", "Valentina", "Mariana", "Esteban"];
  const APELLIDOS = ["Gómez", "Rodríguez", "Martínez", "López", "Ramírez", "Peña", "Lozano", "Acosta", "Cruz", "Tovar", "Vega", "Quintero", "Ortiz", "Mora", "Franco", "Niño", "Lara", "Mejía", "Ruiz", "Cano", "Sánchez", "Páez", "Rivas", "Méndez", "Bello", "Cardona", "Vela", "Lugo", "Sanz", "Forero", "Salas", "Cuéllar"];
  function seed(str) { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h; }
  function nombreSeed(sd) { return NOMBRES[sd % NOMBRES.length] + " " + APELLIDOS[(sd >> 3) % APELLIDOS.length]; }
  function iniciales(n) { return n.split(" ").map(x => x[0]).slice(0, 2).join(""); }

  function orgMinisterio(sedeId, minId) {
    const m = DB.ministerio(minId);
    const factor = (DB.sedeRed(sedeId).personas) / 1940;
    // Coordinaciones: usar subdivisiones reales si existen; si no, generar
    let coords;
    if (m.subdiv && m.subdiv.length) {
      coords = m.subdiv.map((sv, i) => {
        const sd = seed(sedeId + minId + i);
        const personas = Math.max(8, Math.round(sv.miembros * factor));
        const nLid = Math.min(4, Math.max(2, Math.round(personas / 14)));
        return {
          nombre: sv.nombre, rango: sv.rango, coordinador: sv.lider, personas,
          lideres: Array.from({ length: nLid }, (_, j) => {
            const sj = seed(sedeId + minId + i + "L" + j);
            const pp = Math.max(5, Math.round(personas / nLid) + (sj % 4) - 1);
            return { nombre: nombreSeed(sj), grupo: `${m.nombre} · Grupo ${String.fromCharCode(65 + j)}`, personas: pp };
          })
        };
      });
    } else {
      const nCo = Math.max(2, Math.min(4, Math.round(m.grupos / 3) || 2));
      coords = Array.from({ length: nCo }, (_, i) => {
        const sd = seed(sedeId + minId + i);
        const personas = Math.max(10, Math.round((m.personas * factor) / nCo));
        const nLid = Math.min(4, Math.max(2, Math.round(personas / 16)));
        return {
          nombre: `Coordinación ${String.fromCharCode(65 + i)}`, rango: "Por afinidad", coordinador: nombreSeed(sd), personas,
          lideres: Array.from({ length: nLid }, (_, j) => {
            const sj = seed(sedeId + minId + i + "L" + j);
            const pp = Math.max(5, Math.round(personas / nLid) + (sj % 4) - 1);
            return { nombre: nombreSeed(sj), grupo: `${m.nombre} · Grupo ${i + 1}.${j + 1}`, personas: pp };
          })
        };
      });
    }
    const nLideres = coords.reduce((a, c) => a + c.lideres.length, 0);
    const totalPersonas = coords.reduce((a, c) => a + c.personas, 0);
    return { m, coords, nLideres, totalPersonas };
  }

  function organigramaMinisterio(params, rol, estado) {
    const sedeId = params.sede, minId = params.min;
    const s = DB.sedeRed(sedeId);
    const m = DB.ministerio(minId);
    if (!s || !m) return `<div class="vacio"><div class="ico">🤷</div>Ministerio no encontrado.</div>`;
    const org = orgMinisterio(sedeId, minId);
    const colaps = (estado.params && estado.params.colaps) || {};
    return `
    <button class="btn btn--ghost btn--sm mb-4" data-accion="ver-sede" data-valor="${s.id}">← Volver al organigrama de ${s.nombre}</button>
    <div class="card card--pad-lg mb-4" style="background:linear-gradient(135deg,var(--azul-800),var(--azul-900)); color:#fff; border:none">
      <div class="flex gap-4 items-center wrap">
        <div style="font-size:2rem; width:70px; height:70px; display:grid; place-items:center; background:var(--mostaza-500); border-radius:var(--radio-md)">${m.ico}</div>
        <div class="grow">
          <div class="flex gap-2 items-center wrap"><h1 style="font-size:var(--tx-xl)">${m.nombre}</h1><span class="badge badge--mostaza">${m.tipo === "congregacional" ? "Congregacional" : "Operativo"}</span></div>
          <div class="txt-sm" style="opacity:.85">${s.nombre} · ${s.ciudad} · 🧑‍🏫 Director: <b>${m.director}</b></div>
          <div class="txt-sm" style="opacity:.85">${m.desc}</div>
        </div>
      </div>
    </div>
    <div class="grid grid-4 mb-4">
      ${kpi("🧑‍🏫", "1", "Director")}
      ${kpi("🧩", org.coords.length, "Coordinadores")}
      ${kpi("🤝", org.nLideres, "Líderes de grupo")}
      ${kpi("👥", org.totalPersonas.toLocaleString("es-CO"), "Personas")}
    </div>

    <div class="card card--pad-lg mb-4">
      <div class="card__title mb-2">🗂️ Organigrama de ${m.nombre} · ${s.nombre}</div>
      <p class="card__sub mb-3">Cadena completa: Pastor → Director → Coordinadores → Líderes. Haz clic en un coordinador para ver y ocultar a sus líderes.</p>
      <div class="org">
        <div class="org__nivel"><div class="org__caja" style="background:var(--superficie-2)"><span class="org__rol">Pastor congregacional</span><b>${s.pastor}</b><small>Cabeza de la sede</small></div></div>
        <div class="org__rama"></div>
        <div class="org__nivel"><div class="org__caja org__caja--top"><span class="org__rol" style="color:var(--mostaza-300)">Director del ministerio</span><b>${m.director}</b><small>${m.nombre}</small></div></div>
        <div class="org__rama"></div>
        <div class="org__nivel org__coords">
          ${org.coords.map((c, i) => {
            const abierto = !colaps[i];
            return `<div class="org__col">
              <button class="org__caja org__caja--coord ${abierto ? "abierto" : ""}" data-accion="toggle-coord" data-valor="${i}">
                <span class="org__rol">Coordinador</span><b>${c.coordinador}</b>
                <small>${c.nombre} · ${c.rango}</small>
                <span class="org__chip">${c.lideres.length} líderes · ${c.personas} personas</span>
                <span class="org__caret">${abierto ? "▲ ocultar líderes" : "▼ ver líderes"}</span>
              </button>
              <div class="org__lideres" id="coord-${i}" ${abierto ? "" : 'style="display:none"'}>
                ${c.lideres.map(l => `<div class="org__lider">
                  <div class="avatar avatar--sm">${iniciales(l.nombre)}</div>
                  <div class="grow"><b>${l.nombre}</b><small class="org__rol" style="color:var(--mostaza-600)">Líder</small><small>${l.grupo}</small></div>
                  <span class="badge badge--azul">${l.personas}</span>
                </div>`).join("")}
              </div>
            </div>`;
          }).join("")}
        </div>
      </div>
    </div>

    <div class="alerta alerta--info"><span class="ico">✨</span>
      <div><b>Para el pastor:</b> este es el equipo completo de ${m.nombre}. Bajo ${m.director} hay ${org.coords.length} coordinadores y ${org.nLideres} líderes que cuidan ${org.totalPersonas.toLocaleString("es-CO")} personas. La IA sugiere reforzar coordinaciones con más de 25 personas por líder.</div></div>`;
  }
  function ministeriosSede(s) {
    // muestra representativa basada en el catálogo, escalada al tamaño de la sede
    const factor = s.personas / 1940;
    const muestra = DB.MINISTERIOS.filter(m => m.activo).slice(0, 6);
    const max = Math.max(...muestra.map(m => m.personas));
    return muestra.map(m => {
      const v = Math.max(8, Math.round(m.personas * factor));
      return `<div class="flex between items-center" style="gap:12px; margin-bottom:10px">
        <span class="txt-sm" style="width:130px">${m.ico} ${m.nombre}</span>
        <div class="progreso grow"><div class="progreso__barra" style="width:${Math.round(m.personas / max * 100)}%"></div></div>
        <b class="txt-sm" style="width:42px; text-align:right">${v}</b></div>`;
    }).join("");
  }
  function usuariosSede(s) {
    const base = [
      { n: s.pastor, r: "Pastor congregacional", ico: "🏛️" },
      { n: "Director de RocaKids", r: "Director de ministerio", ico: "🧒" },
      { n: "Coordinador J+25", r: "Coordinador", ico: "🧩" },
      { n: "Líder de grupo", r: "Líder", ico: "🤝" },
      { n: "Tesorero local", r: "Tesorería (módulo)", ico: "💼" }
    ];
    return base.map((u, i) => `<div class="fila">
      <span style="font-size:1.3rem; width:34px; text-align:center">${u.ico}</span>
      <div class="fila__main"><b>${u.n}</b><span>${u.r}</span></div>
      <div class="flex gap-2">
        <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="Editando permisos de ${u.n}…">Permisos</button>
        ${i === 0 ? "" : `<button class="btn btn--ghost btn--sm" style="color:var(--peligro);border-color:var(--peligro)" data-accion="quitar-usuario" data-valor="${s.id}">Quitar</button>`}
      </div></div>`).join("");
  }

  /* ============================================================
     3) CENTRO DE APROBACIONES — todos los equipos, flujo completo
     ============================================================ */
  function aprobaciones(rol, estado) {
    const pend = DB.APROBACIONES.filter(a => a.estado === "pendiente");
    const montoRev = pend.reduce((s, a) => s + (a.monto || 0), 0);
    const alta = pend.filter(a => a.prioridad === "alta").length;
    const equipos = [...new Set(DB.APROBACIONES.map(a => a.area))];
    return `
    ${pageHead("Dirección General", "Centro de aprobaciones",
      "Todo lo que requiere tu decisión, escalado desde cada equipo administrativo. Aprueba o rechaza; el flujo se cierra al instante y se notifica al solicitante.")}
    <div class="grid grid-3 mb-4">
      ${kpi("📥", pend.length, "Pendientes de tu decisión", pend.length ? { dir: "down", txt: alta + " de alta prioridad" } : null)}
      ${kpi("💰", cop(montoRev), "Monto en revisión")}
      ${kpi("✅", DB.APROBACIONES.length - pend.length, "Resueltas (sesión)")}
    </div>
    <div class="card mb-4">
      <div class="flex gap-2 wrap">
        <span class="chip activo">Todos los equipos</span>
        ${equipos.map(e => `<span class="chip">${e}</span>`).join("")}
      </div>
    </div>
    <div id="lista-aprob">${listaAprob()}</div>`;
  }
  function listaAprob() {
    const items = DB.APROBACIONES;
    if (!items.length) return `<div class="vacio"><div class="ico">🎉</div>No hay nada pendiente. Todo al día.</div>`;
    return items.map(aprobCard).join("");
  }
  function aprobCard(a) {
    const resuelta = a.estado !== "pendiente";
    const badge = a.estado === "aprobada" ? `<span class="badge badge--exito">✓ Aprobada</span>`
      : a.estado === "rechazada" ? `<span class="badge badge--peligro">✕ Rechazada</span>` : "";
    const prio = { alta: "badge--peligro", media: "badge--aviso", baja: "badge--azul" }[a.prioridad];
    return `<div class="aprob aprob--${a.prioridad}" id="aprob-${a.id}" ${resuelta ? 'style="opacity:.62"' : ""}>
      <div class="aprob__ico">${a.ico}</div>
      <div class="aprob__main">
        <div class="flex between items-center wrap gap-2">
          <b>${a.titulo}</b>
          <span class="badge ${prio}">${a.prioridad}</span>
        </div>
        <div class="aprob__meta">${a.area} · ${a.sede === "global" ? "🌎 Toda la red" : DB.sede(a.sede).nombre} · 🧑‍💼 ${a.solicitante} · 📅 ${a.fecha}${a.monto ? " · 💰 " + cop(a.monto) : ""}</div>
        <p class="txt-sm txt-suave mt-2">${a.detalle}</p>
        <div class="aprob__act mt-3">
          ${resuelta ? badge : `
            <button class="btn btn--primario btn--sm" data-accion="aprobar-item" data-valor="${a.id}">✓ Aprobar</button>
            <button class="btn btn--ghost btn--sm" style="color:var(--peligro);border-color:var(--peligro)" data-accion="rechazar-item" data-valor="${a.id}">✕ Rechazar</button>
            <button class="btn btn--ghost btn--sm" data-accion="ver-equipo" data-valor="${a.equipo}">Ver equipo</button>`}
        </div>
      </div>
    </div>`;
  }

  /* ============================================================
     4) GRUPOS PEQUEÑOS — analítica de toda la red
     ============================================================ */
  function gruposRed(rol, estado) {
    const t = DB.totalesRed();
    const ordenadas = [...DB.RED].sort((a, b) => b.gpActivos - a.gpActivos);
    const maxG = ordenadas[0].gpActivos;
    const enGrupo = Math.round(t.personas * 0.46);
    return `
    ${pageHead("Conéctate · toda la red", "Grupos pequeños",
      `Salud del modelo de grupos en las ${t.sedes} sedes: dónde crece la conexión y dónde reforzar.`)}
    <div class="grid grid-4 mb-4">
      ${kpi("🤝", t.gpActivos.toLocaleString("es-CO"), "Grupos pequeños activos")}
      ${kpi("👥", enGrupo.toLocaleString("es-CO"), "Personas en grupos", { dir: "up", txt: "46% de la red" })}
      ${kpi("📊", (t.gpActivos / t.sedes).toFixed(1), "Promedio por sede")}
      ${kpi("🌱", "62%", "Tasa de conexión", { dir: "up", txt: "+4 pts" })}
    </div>
    <div class="grid grid-2 mb-4">
      <div class="card card--pad-lg">
        <div class="card__title mb-3">🏆 Sedes con más grupos activos</div>
        ${ordenadas.slice(0, 8).map((s, i) => `
          <div class="rank"><span class="rank__pos">${i + 1}</span>
            <div class="rank__bar"><div class="rank__fill" style="width:${Math.round(s.gpActivos / maxG * 100)}%"></div></div>
            <button class="btn btn--ghost btn--sm" data-accion="ver-sede" data-valor="${s.id}" style="min-width:160px; justify-content:space-between">${s.nombre} <b>${s.gpActivos}</b></button>
          </div>`).join("")}
      </div>
      <div class="card card--pad-lg">
        <div class="card__title mb-3">🧩 Grupos por afinidad (muestra)</div>
        ${afinidadDist()}
        <div class="alerta alerta--info mt-3"><span class="ico">✨</span><div>La IA de emparejamiento detecta <b>${Math.round(t.personas * 0.07).toLocaleString("es-CO")} personas</b> sin grupo con afinidad clara: candidatas a invitación dirigida.</div></div>
      </div>
    </div>
    <div class="card">
      <div class="card__title mb-3">📋 Estado de grupos (muestra de la sede madre)</div>
      <div style="overflow-x:auto"><table class="tabla">
        <thead><tr><th>Grupo</th><th>Afinidad</th><th>Día</th><th>Ocupación</th><th>Estado</th></tr></thead>
        <tbody>${DB.GRUPOS.map(g => {
          const oc = Math.round(g.miembros / g.cupo * 100);
          const e = g.miembros >= g.cupo ? `<span class="badge badge--peligro">Lleno</span>` : oc > 60 ? `<span class="badge badge--exito">Saludable</span>` : `<span class="badge badge--aviso">Con cupo</span>`;
          return `<tr><td><b>${g.nombre}</b></td><td class="txt-sm">${g.afinidad.join(", ")}</td><td class="txt-sm">${g.dia}</td><td class="txt-sm">${g.miembros}/${g.cupo} (${oc}%)</td><td>${e}</td></tr>`;
        }).join("")}</tbody>
      </table></div>
    </div>`;
  }
  function afinidadDist() {
    const datos = [["Jóvenes 26–35", 28], ["Parejas", 22], ["Mujeres", 18], ["Hombres", 12], ["Vocacionales", 11], ["Virtuales", 9]];
    const max = 28;
    return datos.map(([l, v]) => `<div class="flex between items-center" style="gap:12px; margin-bottom:10px">
      <span class="txt-sm" style="width:130px">${l}</span>
      <div class="progreso grow"><div class="progreso__barra" style="width:${Math.round(v / max * 100)}%"></div></div>
      <b class="txt-sm" style="width:36px; text-align:right">${v}%</b></div>`).join("");
  }

  /* ============================================================
     5) CURSOS — analítica por iglesia (cómo crece la formación)
     ============================================================ */
  function cursosRed(rol, estado) {
    const ordenadas = [...DB.RED].sort((a, b) => b.personas - a.personas).slice(0, 8);
    const maxP = ordenadas[0].personas;
    const totalInscritos = DB.CURSOS.reduce((s, c) => s + c.inscritos, 0);
    return `
    ${pageHead("Crece · toda la red", "Cursos cortos · analítica",
      "Cómo crece cada iglesia en los cursos de discipulado (ADN, Bautizo, Madurez, Llaves). Insumo de decisión para impulsar formación donde haga falta.")}
    <div class="grid grid-4 mb-4">
      ${kpi("📚", "4", "Cursos del camino")}
      ${kpi("📝", (totalInscritos * 9).toLocaleString("es-CO"), "Inscritos en la red")}
      ${kpi("📈", "+14%", "Crecimiento trimestre", { dir: "up", txt: "vs Q1" })}
      ${kpi("🎓", "78%", "Tasa de finalización")}
    </div>
    <div class="grid grid-2 mb-4">
      <div class="card card--pad-lg">
        <div class="card__title mb-3">📊 Inscritos por curso (red)</div>
        ${DB.CURSOS.map(c => {
          const tot = c.inscritos * 9;
          return `<div class="flex between items-center" style="gap:12px; margin-bottom:12px">
            <span class="txt-sm" style="width:150px">${c.ico} ${c.nombre}</span>
            <div class="progreso grow"><div class="progreso__barra" style="width:${Math.round(c.inscritos / 31 * 100)}%"></div></div>
            <b class="txt-sm" style="width:48px; text-align:right">${tot}</b></div>`;
        }).join("")}
      </div>
      <div class="card card--pad-lg">
        <div class="card__title mb-3">🏆 Iglesias que más crecen en cursos</div>
        ${ordenadas.map((s, i) => {
          const insc = Math.round(s.personas * 0.18);
          return `<div class="rank"><span class="rank__pos">${i + 1}</span>
            <div class="rank__bar"><div class="rank__fill" style="width:${Math.round(s.personas / maxP * 100)}%"></div></div>
            <button class="btn btn--ghost btn--sm" data-accion="ver-sede" data-valor="${s.id}" style="min-width:160px; justify-content:space-between">${s.nombre} <b>${insc}</b></button></div>`;
        }).join("")}
      </div>
    </div>
    <div class="card">
      <div class="card__title mb-3">📋 Discriminado por iglesia</div>
      <div style="overflow-x:auto"><table class="tabla" style="min-width:640px">
        <thead><tr><th>Iglesia</th><th>ADN</th><th>Bautizo</th><th>Madurez</th><th>Llaves</th><th>Total</th></tr></thead>
        <tbody>${ordenadas.map(s => {
          const f = s.personas / 1000;
          const adn = Math.round(24 * f * 4), bau = Math.round(18 * f * 4), mad = Math.round(31 * f * 3), lla = Math.round(12 * f * 4);
          return `<tr><td><b>${s.nombre}</b></td><td>${adn}</td><td>${bau}</td><td>${mad}</td><td>${lla}</td><td><b>${adn + bau + mad + lla}</b></td></tr>`;
        }).join("")}</tbody>
      </table></div>
    </div>`;
  }

  /* ============================================================
     6) INSTITUTO IBLI / FACTER — inscritos por ciudad
     ============================================================ */
  function institutoRed(rol, estado) {
    const C = DB.INSTITUTO_CIUDAD;
    const totIbli = C.reduce((s, c) => s + c.ibli, 0);
    const totFacter = C.reduce((s, c) => s + c.facter, 0);
    const top = [...C].sort((a, b) => b.crecimiento - a.crecimiento)[0];
    const maxTot = Math.max(...C.map(c => c.ibli + c.facter));
    return `
    ${pageHead("Crece · Instituto", "IBLI · FACTER por ciudad",
      "La unidad educativa IBLI–FACTER es un tomador de decisión clave. Aquí ves inscritos por ciudad y dónde crece la formación teológica.")}
    <div class="grid grid-4 mb-4">
      ${kpi("🎓", totIbli, "Inscritos IBLI")}
      ${kpi("📖", totFacter, "Inscritos FACTER")}
      ${kpi("🏙️", C.length, "Ciudades con instituto")}
      ${kpi("🚀", top.ciudad, "Mayor crecimiento", { dir: "up", txt: "+" + top.crecimiento + "%" })}
    </div>
    <div class="grid grid-2 mb-4">
      <div class="card card--pad-lg">
        <div class="card__title mb-3">🏙️ Inscritos por ciudad</div>
        ${C.map(c => `<div class="flex between items-center" style="gap:12px; margin-bottom:11px">
          <span class="txt-sm" style="width:140px">${c.ciudad}</span>
          <div class="progreso grow" style="display:flex"><div style="width:${Math.round(c.ibli / maxTot * 100)}%; background:var(--azul-600); height:100%"></div><div style="width:${Math.round(c.facter / maxTot * 100)}%; background:var(--mostaza-500); height:100%"></div></div>
          <b class="txt-sm" style="width:38px; text-align:right">${c.ibli + c.facter}</b></div>`).join("")}
        <div class="flex gap-3 mt-2 txt-xs txt-suave"><span>🟦 IBLI</span><span>🟨 FACTER</span></div>
      </div>
      <div class="card card--pad-lg">
        <div class="card__title mb-3">📈 Crecimiento por ciudad</div>
        ${[...C].sort((a, b) => b.crecimiento - a.crecimiento).map(c => `<div class="flex between items-center" style="gap:12px; margin-bottom:11px">
          <span class="txt-sm" style="width:140px">${c.ciudad}</span>
          <div class="progreso grow"><div class="progreso__barra" style="width:${Math.round(c.crecimiento / top.crecimiento * 100)}%; background:var(--exito)"></div></div>
          <b class="txt-sm" style="width:42px; text-align:right">+${c.crecimiento}%</b></div>`).join("")}
        <div class="alerta alerta--info mt-3"><span class="ico">✨</span><div>Las sedes internacionales (Miami, Madrid, Panamá) crecen más rápido: oportunidad de abrir cohortes nuevas.</div></div>
      </div>
    </div>
    <div class="card">
      <div class="card__title mb-3">📋 Discriminado IBLI / FACTER</div>
      <div style="overflow-x:auto"><table class="tabla">
        <thead><tr><th>Ciudad</th><th>País</th><th>IBLI</th><th>FACTER</th><th>Total</th><th>Crecimiento</th></tr></thead>
        <tbody>${C.map(c => `<tr><td><b>${c.ciudad}</b></td><td class="txt-sm">${c.pais}</td><td>${c.ibli}</td><td>${c.facter}</td><td><b>${c.ibli + c.facter}</b></td><td><span class="badge badge--exito">+${c.crecimiento}%</span></td></tr>`).join("")}</tbody>
      </table></div>
    </div>`;
  }

  /* ============================================================
     7) EXTRAS POR EQUIPO (se anexan al detalle de cada equipo)
        Legal, Tecnología, Talento Humano, Comunicaciones, etc.
     ============================================================ */
  function aprobacionesEquipo(equipoId) {
    const items = DB.APROBACIONES.filter(a => a.equipo === equipoId);
    if (!items.length) return "";
    return `<div class="card card--pad-lg mt-4">
      <div class="flex between items-center mb-3"><div class="card__title">📥 Aprobaciones de este equipo</div>
        <button class="btn btn--ghost btn--sm" data-accion="ir" data-valor="aprobaciones">Ver centro de aprobaciones →</button></div>
      <div id="lista-aprob">${items.map(aprobCard).join("")}</div>
    </div>`;
  }
  function extrasEquipo(id) {
    switch (id) {
      case "e_legal": return `
        <div class="card card--pad-lg mt-4"><div class="card__title mb-3">⚖️ Procesos legales activos</div>
          <div style="overflow-x:auto"><table class="tabla" style="min-width:640px">
            <thead><tr><th>Proceso</th><th>Tipo</th><th>Sede</th><th>Estado</th><th>Riesgo</th><th>Actualizado</th></tr></thead>
            <tbody>${DB.LEGAL_PROCESOS.map(l => {
              const rc = { alto: "peligro", medio: "aviso", bajo: "exito" }[l.riesgo];
              return `<tr><td><b>${l.titulo}</b><div class="txt-xs txt-suave">${l.responsable}</div></td><td class="txt-sm">${l.tipo}</td>
                <td class="txt-sm">${l.sede === "global" ? "🌎 Red" : DB.sede(l.sede).nombre}</td>
                <td><span class="badge badge--azul">${l.estado}</span></td><td><span class="badge badge--${rc}">${l.riesgo}</span></td><td class="txt-sm nowrap">${l.actualizado}</td></tr>`;
            }).join("")}</tbody>
          </table></div></div>
        ${aprobacionesEquipo("e_legal")}`;
      case "e_tecnologia": return `
        <div class="card card--pad-lg mt-4"><div class="card__title mb-3">💻 Requerimientos y trabajos por sede</div>
          ${DB.TECH_REQ.map(t => {
            const pc = { alta: "peligro", media: "aviso", baja: "azul" }[t.prioridad];
            return `<div class="fila"><div class="fila__main"><b>${t.titulo}</b><span>${t.sede === "global" ? "🌎 Toda la red" : DB.sede(t.sede).nombre} · ${t.equipo} · <span class="badge badge--${pc}" style="padding:1px 8px">${t.prioridad}</span></span>
              <div class="progreso mt-2"><div class="progreso__barra" style="width:${t.avance}%"></div></div></div>
              <span class="badge badge--${t.estado === 'Producción' ? 'exito' : t.estado === 'Backlog' ? '' : 'azul'}" style="min-width:96px; justify-content:center">${t.estado} · ${t.avance}%</span></div>`;
          }).join("")}</div>
        ${aprobacionesEquipo("e_tecnologia")}`;
      case "e_hr": return `
        <div class="card card--pad-lg mt-4"><div class="flex between items-center mb-3"><div class="card__title">👔 Empleados (HCM)</div>
          <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="Exportando nómina…">⬇️ Exportar</button></div>
          <div style="overflow-x:auto"><table class="tabla" style="min-width:680px">
            <thead><tr><th>Colaborador</th><th>Cargo</th><th>Área</th><th>Sede</th><th>Vínculo</th><th>Estado</th></tr></thead>
            <tbody>${DB.EMPLEADOS.map(e => `<tr><td><b>${e.nombre}</b><div class="txt-xs txt-suave">Desde ${e.ingreso}</div></td>
              <td class="txt-sm">${e.cargo}</td><td class="txt-sm">${e.area}</td><td class="txt-sm">${DB.sede(e.sede) ? DB.sede(e.sede).nombre : e.sede}</td>
              <td class="txt-sm">${e.tipo}</td><td><span class="badge badge--${e.estado === 'Activo' ? 'exito' : 'aviso'}">${e.estado}</span></td></tr>`).join("")}</tbody>
          </table></div>
          <div class="metricas mt-3">
            <div class="m"><b>${DB.EMPLEADOS.length}</b><span>Empleados (muestra)</span></div>
            <div class="m"><b>${DB.EMPLEADOS.filter(e => e.estado === 'Onboarding').length}</b><span>En onboarding</span></div>
            <div class="m"><b>${[...new Set(DB.EMPLEADOS.map(e => e.area))].length}</b><span>Áreas</span></div>
          </div></div>
        ${aprobacionesEquipo("e_hr")}`;
      case "e_comunicaciones": return `
        <div class="card card--pad-lg mt-4"><div class="card__title mb-3">📣 Campañas en curso</div>
          <div style="overflow-x:auto"><table class="tabla" style="min-width:680px">
            <thead><tr><th>Campaña</th><th>Canal</th><th>Alcance</th><th>Piezas</th><th>Estado</th></tr></thead>
            <tbody>${DB.COMMS_CAMPANAS.map(c => {
              const ec = { "Publicada": "exito", "En aprobación": "aviso", "Programada": "azul", "En diseño": "azul" }[c.estado] || "azul";
              return `<tr><td><b>${c.nombre}</b><div class="txt-xs txt-suave">${c.responsable}</div></td><td class="txt-sm">${c.canal}</td>
                <td class="txt-sm">${c.alcance}</td><td>${c.piezas}</td><td><span class="badge badge--${ec}">${c.estado}</span></td></tr>`;
            }).join("")}</tbody>
          </table></div></div>
        ${aprobacionesEquipo("e_comunicaciones")}`;
      case "e_tesoreria": return aprobacionesEquipo("e_tesoreria");
      case "e_contable": return aprobacionesEquipo("e_contable");
      default: return "";
    }
  }

  /* ============================================================
     WRAPPERS — sólo el Pastor Director General ve la versión profunda
     ============================================================ */
  function wrap(nombre, fnProfunda) {
    const base = V[nombre];
    V[nombre] = function (rol, estado) {
      if (rol && rol.id === "pastor_admin") return fnProfunda(rol, estado);
      return base(rol, estado);
    };
  }
  function wrapPanel() {
    const base = V.panel;
    V.panel = function (rol, estado) {
      if (rol.id === "pastor_admin") return panelRed(rol, estado);
      return base(rol, estado);
    };
  }
  function wrapEquipo() {
    const base = V.equipo;
    V.equipo = function (id, rol, estado) {
      let html = base(id, rol, estado);
      if (rol && rol.id === "pastor_admin") html += extrasEquipo(id);
      return html;
    };
  }
  function wrapFiliales() {
    const base = V.filiales;
    V.filiales = function (rol, estado) {
      if (rol.id === "pastor_admin") return filialesRed(rol, estado);
      return base(rol, estado);
    };
  }
  function filialesRed(rol, estado) {
    const t = DB.totalesRed();
    return `
    ${pageHead("Dirección General", "Filiales · las " + t.sedes + " iglesias",
      "Entra a cualquier iglesia para ver su <b>organigrama</b>, su análisis de ministerios, líderes y asistentes, y para <b>poner o quitar usuarios</b>.")}
    <div class="grid grid-4 mb-4">
      ${kpi("🏛️", t.sedes, "Sedes en red")}${kpi("🌎", t.paises, "Países")}
      ${kpi("👥", t.personas.toLocaleString("es-CO"), "Personas")}${kpi("❤️", t.cuidadoProm, "Cuidado prom.")}
    </div>
    <div class="card mb-4">
      <div class="buscador mb-3"><span class="buscador__ico">🔎</span>
        <input type="search" placeholder="Buscar iglesia por nombre, ciudad o país…" aria-label="Buscar iglesia" /></div>
      <div class="flex gap-2 wrap">
        <span class="chip activo">Todas</span>${DB.PAISES.map(p => `<span class="chip">${p}</span>`).join("")}
      </div>
    </div>
    <div class="grid grid-auto">
      ${[...DB.RED].sort((a, b) => b.personas - a.personas).map(tarjetaFilial).join("")}
    </div>`;
  }
  function tarjetaFilial(s) {
    const tipo = s.cuidado >= 80 ? "exito" : s.cuidado >= 60 ? "aviso" : "peligro";
    return `<div class="card">
      <div class="flex between items-center mb-2"><b style="font-size:var(--tx-md)">${s.nombre}</b>${s.esMadre ? '<span class="badge badge--mostaza">Madre</span>' : `<span class="badge badge--${tipo}">${s.cuidado}</span>`}</div>
      <div class="txt-xs txt-suave mb-3">${s.ciudad} · ${s.pais}<br>🧑‍✈️ ${s.pastor}</div>
      <div class="metricas mb-3">
        <div class="m"><b>${s.personas.toLocaleString("es-CO")}</b><span>Personas</span></div>
        <div class="m"><b>${s.gpActivos}</b><span>Grupos</span></div>
        <div class="m"><b>${s.ministerios}</b><span>Minist.</span></div>
      </div>
      <button class="btn btn--primario btn--bloque" data-accion="ver-sede" data-valor="${s.id}">Entrar a la iglesia →</button>
    </div>`;
  }

  /* ============================================================
     8) FINANZAS — panorama consolidado de la red
     ============================================================ */
  function finanzas(rol, estado) {
    const F = DB.FIN, R = F.resumen;
    const excedente = R.ingresosMes - R.gastosMes;
    const margen = Math.round(excedente / R.ingresosMes * 100);
    const maxSerie = Math.max(...F.serie.map(s => Math.max(s.ing, s.gas)));
    const totIng = F.ingresos.reduce((a, b) => a + b.val, 0);
    const totGas = F.gastos.reduce((a, b) => a + b.val, 0);
    const cuotaDeuda = F.deudas.reduce((a, d) => a + d.cuotaMes, 0);
    const finAprob = DB.APROBACIONES.filter(a => a.monto && a.monto > 0);
    const montoAprob = finAprob.filter(a => a.estado === "pendiente").reduce((s, a) => s + a.monto, 0);
    const barsCat = (arr, tot, color) => arr.map(c => `
      <div class="flex between items-center" style="gap:12px; margin-bottom:11px">
        <span class="txt-sm" style="width:170px">${c.ico} ${c.cat}</span>
        <div class="progreso grow"><div class="progreso__barra" style="width:${Math.round(c.val / arr[0].valMax * 100)}%; background:var(--${color})"></div></div>
        <b class="txt-sm" style="width:96px; text-align:right">${fM(c.val)} · ${Math.round(c.val / tot * 100)}%</b>
      </div>`).join("");
    // anexar valMax para escalar
    const ingMax = Math.max(...F.ingresos.map(c => c.val)); F.ingresos.forEach(c => c.valMax = ingMax);
    const gasMax = Math.max(...F.gastos.map(c => c.val)); F.gastos.forEach(c => c.valMax = gasMax);
    const finPorIglesia = [...DB.RED].sort((a, b) => b.diezmoMes - a.diezmoMes).slice(0, 12).map(s => {
      const ing = Math.round(s.diezmoMes * 1.42);
      const ratio = s.cuidado < 60 ? 0.93 : s.cuidado < 80 ? 0.86 : 0.80;
      const gas = Math.round(ing * ratio);
      const exc = ing - gas;
      return { s, ing, gas, exc, margen: Math.round(exc / ing * 100) };
    });

    return `
    ${pageHead("Dirección General", "Finanzas de la red",
      "Panorama consolidado: ingresos, gastos, proyectos, deudas y solicitudes de aprobación financiera de las iglesias. Cifras en millones de COP.",
      finAprob.filter(a => a.estado === "pendiente").length ? `<button class="btn btn--primario" data-accion="ir" data-valor="aprobaciones">💰 ${finAprob.filter(a => a.estado === "pendiente").length} aprobaciones financieras</button>` : "")}

    <div class="grid grid-5 mb-4">
      ${kpi("📈", fM(R.ingresosMes), "Ingresos del mes", { dir: "up", txt: "+9% vs may" })}
      ${kpi("📉", fM(R.gastosMes), "Gastos del mes")}
      ${kpi("💵", fM(excedente), "Excedente", excedente >= 0 ? { dir: "up", txt: margen + "% margen" } : { dir: "down", txt: "déficit" })}
      ${kpi("🏦", fM(R.caja), "Caja disponible")}
      ${kpi("⚖️", fM(R.deudaTotal), "Deuda total", { dir: "down", txt: fM(cuotaDeuda) + "/mes" })}
    </div>

    <div class="card card--pad-lg mb-4">
      <div class="flex between items-center mb-2"><div class="card__title">📊 Ingresos vs. gastos (6 meses)</div>
        <div class="fin-leyenda"><span><i style="background:var(--azul-600)"></i>Ingresos</span><span><i style="background:var(--mostaza-500)"></i>Gastos</span></div></div>
      <div class="fin-chart">
        ${F.serie.map(s => `<div class="fin-mes">
          <div class="fin-par">
            <div class="fin-bar fin-bar--ing" style="height:${Math.round(s.ing / maxSerie * 100)}%" title="Ingresos ${fM(s.ing)}"></div>
            <div class="fin-bar fin-bar--gas" style="height:${Math.round(s.gas / maxSerie * 100)}%" title="Gastos ${fM(s.gas)}"></div>
          </div><small>${s.mes}</small></div>`).join("")}
      </div>
    </div>

    <div class="grid grid-2 mb-4">
      <div class="card card--pad-lg">
        <div class="card__title mb-3">💛 Composición de ingresos · ${fM(totIng)}</div>
        ${barsCat(F.ingresos, totIng, "azul-600")}
      </div>
      <div class="card card--pad-lg">
        <div class="card__title mb-3">🧾 Composición de gastos · ${fM(totGas)}</div>
        ${barsCat(F.gastos, totGas, "mostaza-500")}
      </div>
    </div>

    <div class="card mb-4">
      <div class="flex between items-center mb-3"><div class="card__title">🏗️ Proyectos en ejecución</div>
        <span class="badge badge--azul">${F.proyectos.length} proyectos · ${fM(F.proyectos.reduce((a, p) => a + p.presupuesto, 0))} presupuesto</span></div>
      <div style="overflow-x:auto"><table class="tabla" style="min-width:760px">
        <thead><tr><th>Proyecto</th><th>Sede</th><th>Presupuesto</th><th>Ejecutado</th><th>Avance</th><th>Estado</th></tr></thead>
        <tbody>${F.proyectos.map(p => {
          const av = Math.round(p.ejecutado / p.presupuesto * 100);
          const ec = p.estado === "En curso" ? "azul" : "aviso";
          return `<tr><td><b>${p.nombre}</b><div class="txt-xs txt-suave">${p.responsable}</div></td>
            <td class="txt-sm">${p.sede === "global" ? "🌎 Red" : DB.sede(p.sede).nombre}</td>
            <td class="nowrap txt-sm">${fM(p.presupuesto)}</td><td class="nowrap txt-sm">${fM(p.ejecutado)}</td>
            <td style="min-width:120px"><div class="progreso"><div class="progreso__barra" style="width:${av}%"></div></div><span class="txt-xs txt-suave">${av}%</span></td>
            <td><span class="badge badge--${ec}">${p.estado}</span></td></tr>`;
        }).join("")}</tbody>
      </table></div>
    </div>

    <div class="grid grid-2 mb-4">
      <div class="card card--pad-lg">
        <div class="flex between items-center mb-3"><div class="card__title">⚖️ Deudas y obligaciones</div>
          <span class="badge badge--aviso">${fM(R.deudaTotal)} · ${fM(cuotaDeuda)}/mes</span></div>
        ${DB.FIN.deudas.map(d => `<div class="fila">
          <div class="fila__main"><b>${d.concepto}</b><span>${d.acreedor} · vence ${d.vence} · cuota ${fM(d.cuotaMes)}/mes</span></div>
          <div class="flex gap-2 items-center"><b class="txt-sm nowrap">${fM(d.saldo)}</b>
          <span class="badge badge--${d.estado === "Al día" ? "exito" : "aviso"}">${d.estado}</span></div></div>`).join("")}
        <div class="alerta alerta--info mt-3"><span class="ico">📌</span><div>Relación deuda/ingreso anual: <b>${Math.round(R.deudaTotal / (R.ingresosMes * 12) * 100)}%</b> · saludable (&lt; 40%).</div></div>
      </div>
      <div class="card card--pad-lg">
        <div class="card__title mb-3">📥 Aprobaciones financieras solicitadas</div>
        <p class="card__sub mb-3">De las distintas iglesias · ${fM(Math.round(montoAprob / 1e6))} en revisión</p>
        ${finAprob.slice(0, 4).map(a => `<div class="fila">
          <span style="font-size:1.2rem; width:30px; text-align:center">${a.ico}</span>
          <div class="fila__main"><b>${a.titulo}</b><span>${a.area} · ${a.sede === "global" ? "🌎 Red" : DB.sede(a.sede).nombre} · ${cop(a.monto)}</span></div>
          ${a.estado === "pendiente"
            ? `<div class="flex gap-2"><button class="btn btn--primario btn--sm" data-accion="aprobar-item" data-valor="${a.id}">✓</button><button class="btn btn--ghost btn--sm" style="color:var(--peligro);border-color:var(--peligro)" data-accion="rechazar-item" data-valor="${a.id}">✕</button></div>`
            : `<span class="badge badge--${a.estado === "aprobada" ? "exito" : "peligro"}">${a.estado === "aprobada" ? "✓ Aprobada" : "✕ Rechazada"}</span>`}
        </div>`).join("")}
        <button class="btn btn--ghost btn--sm btn--bloque mt-3" data-accion="ir" data-valor="aprobaciones">Ver centro de aprobaciones →</button>
      </div>
    </div>

    <div class="card">
      <div class="flex between items-center mb-3"><div class="card__title">🏛️ Finanzas por iglesia</div>
        <button class="btn btn--ghost btn--sm" data-accion="demo" data-valor="Exportando estado financiero por sede…">⬇️ Exportar</button></div>
      <div style="overflow-x:auto"><table class="tabla" style="min-width:680px">
        <thead><tr><th>Iglesia</th><th>Ingresos/mes</th><th>Gastos/mes</th><th>Excedente</th><th>Margen</th><th></th></tr></thead>
        <tbody>${finPorIglesia.map(f => `<tr>
          <td><b>${f.s.nombre}</b><div class="txt-xs txt-suave">${f.s.pais}</div></td>
          <td class="nowrap txt-sm">${fM(f.ing)}</td><td class="nowrap txt-sm">${fM(f.gas)}</td>
          <td class="nowrap txt-sm"><b>${fM(f.exc)}</b></td>
          <td><span class="badge badge--${f.margen >= 12 ? "exito" : f.margen >= 6 ? "aviso" : "peligro"}">${f.margen}%</span></td>
          <td><button class="btn btn--ghost btn--sm" data-accion="ver-sede" data-valor="${f.s.id}">Ver iglesia →</button></td>
        </tr>`).join("")}</tbody>
      </table></div>
      <p class="txt-xs txt-suave mt-3">🔒 Datos financieros consolidados desde Siigo. Visibles solo para la Dirección General.</p>
    </div>`;
  }

  // Aplicar wrappers y registrar nuevas vistas
  wrapPanel();
  wrapEquipo();
  wrapFiliales();
  wrap("grupos", gruposRed);
  wrap("cursos", cursosRed);
  wrap("instituto", institutoRed);
  Object.assign(window.VIEWS, { sedeDetalle, aprobaciones, listaAprob, organigramaMinisterio, finanzas });
})();
