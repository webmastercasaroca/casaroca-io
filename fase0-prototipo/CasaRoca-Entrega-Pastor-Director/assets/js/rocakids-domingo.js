/* ============================================================
   CASA ROCA · ROCAKIDS — APP DEL DOMINGO
   Herramienta que usan los servidores cada domingo en los 3
   servicios: ingreso de niños con manilla, entrega segura por
   verificación de cédula del acudiente, y panel en vivo.
   Mobile-first, sin frameworks. Escribe en window.RKSTORE, por lo
   que el panel del director ve todo EN VIVO.
   Prefijo de clases: .rkd-
   ============================================================ */
(function () {
  const RK = window.RKDIR;
  const S = window.RKSTORE;
  const ETAPAS = RK.ETAPAS;
  const SERVICIOS = RK.SERVICIOS;

  const ROLES = {
    director: "Director", coordinador: "Coordinador", candidato: "Candidato", pastor: "Pastor",
  };
  const SESION_KEY = "casaroca_rocakids_sesion_v1";

  /* ---------------- estado ---------------- */
  let user = leerSesion();
  let screen = "dashboard";
  let bound = false;
  // form ingreso
  let ing = blankIngreso();
  let ingDone = null;
  // entrega
  let entRes = null, entDone = null, entError = "";
  // panel
  let pSrv = null, pEst = "todos", pEt = "todas", pQuery = "";
  // admin
  let adminTab = "usuarios";

  /* ---------------- utils ---------------- */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const app = () => document.getElementById("rkd-app");
  const hoy = () => RK.hoyISO();
  const esAdmin = u => u && (u.rol === "director" || u.rol === "pastor");
  const getEtapa = id => RK.etapa(id);
  const getServicio = id => RK.servicio(id);
  function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ""; }
  function soloDig(t) { return String(t || "").replace(/\D/g, ""); }
  function fmtHora(ts) { return ts ? new Date(ts).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }) : "—"; }
  function blankIngreso() { return { servicio: servicioActual(), etapa: "", nombre_adulto: "", celular_adulto: "", cedula_adulto: "", nombre_nino: "", peticion_oracion: "" }; }

  function servicioActual() {
    const h = new Date().getHours() + new Date().getMinutes() / 60;
    for (const s of SERVICIOS) if (h >= s.startH && h < s.endH) return s.id;
    if (h < SERVICIOS[0].startH) return "1er";
    if (h < SERVICIOS[1].startH) return "2do";
    if (h < SERVICIOS[2].startH) return "3er";
    return "1er";
  }
  const SRV_ACTUAL = servicioActual();

  function leerSesion() { try { return JSON.parse(localStorage.getItem(SESION_KEY) || "null"); } catch (e) { return null; } }
  function guardarSesion(u) { try { localStorage.setItem(SESION_KEY, JSON.stringify(u)); } catch (e) {} }
  function borrarSesion() { try { localStorage.removeItem(SESION_KEY); } catch (e) {} }

  /* ============================================================ LOGIN */
  let loginSel = null;
  function vistaLogin() {
    const us = S.usuarios().filter(u => u.activo !== false);
    if (!loginSel) {
      return `
      <div class="rkd-login">
        <div class="rkd-login__card">
          <div class="rkd-login__head">
            <div class="rkd-login__logo">RK</div>
            <h1>RocaKids</h1>
            <p>App del domingo · Casa Roca</p>
          </div>
          <div class="rkd-login__body">
            <p class="rkd-eyebrow">¿Quién eres?</p>
            <div class="rkd-userlist">
              ${us.map(u => `
                <button class="rkd-userbtn" data-accion="sel-user" data-id="${u.id}">
                  <span class="rkd-ava ${esAdmin(u) ? "is-admin" : ""}">${esc((u.nombre || "?")[0])}</span>
                  <span class="rkd-userbtn__txt"><b>${esc(u.nombre)}</b><small>${esc(ROLES[u.rol] || u.rol)}${u.etapa ? " · " + esc(getEtapa(u.etapa).corto) : ""}</small></span>
                  ${esAdmin(u) ? '<span class="rkd-chip rkd-chip--admin">Admin</span>' : ""}
                </button>`).join("")}
            </div>
            <p class="rkd-login__nota">PIN demo: directores <b>1234</b> · coordinadores <b>1111/2222/3333/4444</b></p>
          </div>
        </div>
      </div>`;
    }
    const u = S.usuarios().find(x => x.id === loginSel);
    return `
    <div class="rkd-login">
      <div class="rkd-login__card">
        <div class="rkd-login__head">
          <div class="rkd-login__logo">RK</div>
          <h1>RocaKids</h1>
          <p>App del domingo · Casa Roca</p>
        </div>
        <div class="rkd-login__body">
          <button class="rkd-back" data-accion="login-volver">← Volver</button>
          <div class="rkd-login__user">
            <span class="rkd-ava rkd-ava--lg ${esAdmin(u) ? "is-admin" : ""}">${esc((u.nombre || "?")[0])}</span>
            <b>${esc(u.nombre)}</b>
            <small>${esc(ROLES[u.rol] || u.rol)}${u.etapa ? " · " + esc(getEtapa(u.etapa).corto) : ""}</small>
          </div>
          <label class="rkd-label" for="rkd-pin">PIN de acceso</label>
          <input id="rkd-pin" class="rkd-input rkd-input--pin" type="password" inputmode="numeric" placeholder="••••" maxlength="8" autocomplete="off" />
          <div id="rkd-pin-err" class="rkd-alert rkd-alert--error" hidden></div>
          <button class="rkd-btn rkd-btn--primary rkd-btn--lg rkd-btn--block" data-accion="login-entrar">Entrar</button>
        </div>
      </div>
    </div>`;
  }

  /* ============================================================ SHELL */
  const NAV = [
    { id: "dashboard", ico: "🏠", lbl: "Inicio" },
    { id: "ingreso", ico: "➕", lbl: "Ingreso" },
    { id: "entrega", ico: "✅", lbl: "Entrega" },
    { id: "panel", ico: "📋", lbl: "Panel" },
  ];
  function navItems() { return esAdmin(user) ? NAV.concat([{ id: "admin", ico: "⚙️", lbl: "Admin" }]) : NAV; }

  function topbar() {
    return `
    <header class="rkd-top">
      <div class="rkd-top__brand"><span class="rkd-top__logo">RK</span><b>RocaKids</b>
        <span class="rkd-chip rkd-chip--live">${esc(getServicio(SRV_ACTUAL).nombre)}</span></div>
      <div class="rkd-top__user"><span>${esc((user.nombre || "").split(" ")[0])}</span>
        <button class="rkd-top__out" data-accion="salir">Salir</button></div>
    </header>`;
  }
  function tabbar() {
    return `<nav class="rkd-tabs" aria-label="Secciones">
      ${navItems().map(n => `<button class="rkd-tab ${screen === n.id ? "is-active" : ""}" data-accion="ir" data-screen="${n.id}" ${screen === n.id ? 'aria-current="page"' : ""}>
        <span class="rkd-tab__ic">${n.ico}</span><span class="rkd-tab__lbl">${n.lbl}</span></button>`).join("")}
    </nav>`;
  }

  /* ============================================================ DASHBOARD */
  function vistaDashboard() {
    const regs = S.registrosDe(hoy());
    const srv = regs.filter(r => r.servicio === SRV_ACTUAL);
    const total = srv.length;
    const presentes = srv.filter(r => r.estado === "presente").length;
    const entregados = srv.filter(r => r.estado === "entregado").length;
    const etapaStats = ETAPAS.map(e => ({ ...e, n: srv.filter(r => r.etapa === e.id && r.estado === "presente").length })).filter(e => e.n > 0);
    const s = getServicio(SRV_ACTUAL);
    const fecha = new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
    return `
    <div class="rkd-view">
      <div class="rkd-hi">
        <div><p class="rkd-eyebrow rkd-cap">${esc(fecha)}</p><h1>Hola, ${esc((user.nombre || "").split(" ")[0])} 👋</h1></div>
        <span class="rkd-chip ${esAdmin(user) ? "rkd-chip--admin" : ""}">${esAdmin(user) ? "⭐ Admin" : esc(ROLES[user.rol] || user.rol)}</span>
      </div>

      <div class="rkd-hero">
        <div class="rkd-hero__top"><div><p class="rkd-eyebrow rkd-hero__eye">Servicio activo</p><p class="rkd-hero__name">${esc(s.nombre)}</p></div>
          <span class="rkd-chip rkd-chip--ghost">${esc(s.horario)}</span></div>
        <div class="rkd-hero__stats">
          ${[["Total", total, "👶"], ["Presentes", presentes, "🟢"], ["Entregados", entregados, "✅"]].map(([l, v, i]) =>
            `<div class="rkd-hstat"><span>${i}</span><b>${v}</b><small>${l}</small></div>`).join("")}
        </div>
      </div>

      <div class="rkd-quick">
        <button class="rkd-qbtn rkd-qbtn--green" data-accion="ir" data-screen="ingreso"><span class="rkd-qbtn__ic">➕</span><b>Nuevo ingreso</b><small>Registrar niño/a</small></button>
        <button class="rkd-qbtn rkd-qbtn--blue" data-accion="ir" data-screen="entrega"><span class="rkd-qbtn__ic">✅</span><b>Entregar</b><small>Retirar niño/a</small></button>
      </div>

      ${etapaStats.length ? `<div class="rkd-card"><h3 class="rkd-card__t">Presentes por etapa</h3>
        ${etapaStats.map(e => `<div class="rkd-row"><span>${e.emoji} ${esc(e.corto)}</span><span class="rkd-pill" style="background:${e.color}">${e.n}</span></div>`).join("")}
      </div>` : ""}

      ${esAdmin(user) ? `<div class="rkd-card"><h3 class="rkd-card__t">Resumen del día</h3>
        <div class="rkd-grid3">${SERVICIOS.map(sv => { const n = regs.filter(r => r.servicio === sv.id).length;
          return `<div class="rkd-mini ${sv.id === SRV_ACTUAL ? "is-on" : ""}"><b>${n}</b><small>${esc(sv.nombre)}</small></div>`; }).join("")}</div>
      </div>` : ""}

      ${total === 0 ? `<div class="rkd-empty"><div class="rkd-empty__ic">🕐</div><p>Aún no hay registros para este servicio</p><small>¡Empieza con el primer ingreso!</small></div>` : ""}
    </div>`;
  }

  /* ============================================================ INGRESO */
  function vistaIngreso() {
    if (ingDone) return vistaIngresoOK();
    const manilla = S.siguienteManilla(hoy(), ing.servicio);
    return `
    <div class="rkd-view">
      <h1 class="rkd-h1">➕ Nuevo ingreso</h1>

      <div class="rkd-card">
        <label class="rkd-label">Servicio</label>
        <div class="rkd-seg">
          ${SERVICIOS.map(s => `<button class="rkd-seg__b ${ing.servicio === s.id ? "is-on" : ""}" data-accion="ing-srv" data-id="${s.id}">
            <b>${esc(s.nombre)}</b><small>${esc(s.horario.split("—")[0].trim())}</small></button>`).join("")}
        </div>
      </div>

      <div class="rkd-card">
        <h3 class="rkd-card__t">👤 Adulto responsable</h3>
        <label class="rkd-label" for="rkd-ad-nom">Nombre completo *</label>
        <input id="rkd-ad-nom" class="rkd-input" placeholder="Nombre del adulto" value="${esc(ing.nombre_adulto)}" />
        <div class="rkd-2col">
          <div><label class="rkd-label" for="rkd-ad-cel">Celular *</label>
            <input id="rkd-ad-cel" class="rkd-input" type="tel" inputmode="numeric" placeholder="3XX XXX XXXX" value="${esc(ing.celular_adulto)}" /></div>
          <div><label class="rkd-label" for="rkd-ad-ced">Cédula *</label>
            <input id="rkd-ad-ced" class="rkd-input" type="tel" inputmode="numeric" placeholder="Número" value="${esc(ing.cedula_adulto)}" /></div>
        </div>
      </div>

      <div class="rkd-card">
        <h3 class="rkd-card__t">👶 Niño / Niña</h3>
        <label class="rkd-label" for="rkd-ni-nom">Nombre completo *</label>
        <input id="rkd-ni-nom" class="rkd-input" placeholder="Nombre del niño o niña" value="${esc(ing.nombre_nino)}" />
        <label class="rkd-label">Etapa *</label>
        <div class="rkd-etapas">
          ${ETAPAS.map(e => `<button class="rkd-etapa ${ing.etapa === e.id ? "is-on" : ""}" data-accion="ing-etapa" data-id="${e.id}" style="--ec:${e.color};--ebg:${e.bg}">
            <span class="rkd-etapa__ic">${e.emoji}</span><span class="rkd-etapa__txt"><b>${esc(e.nombre)}</b><small>${esc(e.rango)}</small></span>
            ${ing.etapa === e.id ? '<span class="rkd-etapa__ok">✓</span>' : ""}</button>`).join("")}
        </div>
      </div>

      <div class="rkd-card">
        <label class="rkd-label" for="rkd-ni-pet">🙏 Petición de oración (opcional)</label>
        <textarea id="rkd-ni-pet" class="rkd-input rkd-textarea" rows="2" placeholder="¿Tiene alguna petición de oración?">${esc(ing.peticion_oracion)}</textarea>
        <label class="rkd-label">🔢 Número de manilla</label>
        <div class="rkd-manilla">${esc(manilla)}</div>
        <small class="rkd-hint">Asignada automáticamente para este servicio</small>
      </div>

      <div id="rkd-ing-err" class="rkd-alert rkd-alert--error" hidden></div>
      <button class="rkd-btn rkd-btn--green rkd-btn--lg rkd-btn--block" data-accion="ing-guardar">✅ Registrar ingreso</button>
    </div>`;
  }
  function vistaIngresoOK() {
    const d = ingDone, e = getEtapa(d.etapa);
    return `
    <div class="rkd-view">
      <div class="rkd-ok">
        <div class="rkd-ok__ic">🎉</div>
        <h2>¡Registro exitoso!</h2><p class="rkd-muted">Niño/a registrado correctamente</p>
        <div class="rkd-manilla-card">
          <p class="rkd-eyebrow">Número de manilla</p>
          <p class="rkd-manilla-card__n">${esc(d.numero_manilla)}</p>
          <small>${esc(getServicio(d.servicio).nombre)} · ${fmtHora(d.hora_ingreso)}</small>
        </div>
        <div class="rkd-okbox" style="--ec:${e.color};--ebg:${e.bg}">
          <b>${esc(d.nombre_nino)}</b><span>${e.emoji} ${esc(e.nombre)}</span>
          <small>👤 ${esc(d.nombre_adulto)} · 📱 ${esc(d.celular_adulto)}</small>
        </div>
        ${d.peticion_oracion ? `<div class="rkd-okbox rkd-okbox--pet"><b>🙏 Petición de oración</b><span>${esc(d.peticion_oracion)}</span></div>` : ""}
        <button class="rkd-btn rkd-btn--primary rkd-btn--lg rkd-btn--block" data-accion="ing-otro">+ Registrar otro niño/a</button>
      </div>
    </div>`;
  }

  /* ============================================================ ENTREGA */
  function vistaEntrega() {
    if (entDone) {
      const d = entDone;
      return `
      <div class="rkd-view">
        <div class="rkd-ok">
          <div class="rkd-ok__ic">✅</div>
          <h2>¡Entrega confirmada!</h2><p class="rkd-muted">${esc(d.nombre_nino)} fue retirado/a exitosamente</p>
          <div class="rkd-okbox rkd-okbox--green">
            <span><b>Niño/a:</b> ${esc(d.nombre_nino)}</span>
            <span><b>Adulto:</b> ${esc(d.nombre_adulto_retiro || d.nombre_adulto)}</span>
            <span><b>Hora de retiro:</b> ${fmtHora(d.hora_entrega)}</span>
          </div>
          <button class="rkd-btn rkd-btn--primary rkd-btn--lg rkd-btn--block" data-accion="ent-otra">Registrar otra entrega</button>
        </div>
      </div>`;
    }
    return `
    <div class="rkd-view">
      <h1 class="rkd-h1">✅ Registrar entrega</h1>
      <div class="rkd-card">
        <label class="rkd-label">🔍 Buscar por manilla o nombre</label>
        <div class="rkd-2flex">
          <input id="rkd-ent-q" class="rkd-input" placeholder="Ej: 001  ó  nombre" value="${esc(entRes ? "" : "")}" />
          <button class="rkd-btn rkd-btn--primary" data-accion="ent-buscar">Buscar</button>
        </div>
      </div>
      ${entError && !entRes ? `<div class="rkd-alert rkd-alert--error">${esc(entError)}</div>` : ""}
      ${entRes ? bloqueEntrega() : `<div class="rkd-empty"><div class="rkd-empty__ic">🔍</div><p>Ingresa la manilla o el nombre para buscar</p></div>`}
    </div>`;
  }
  function bloqueEntrega() {
    const r = entRes, e = getEtapa(r.etapa);
    return `
    <div class="rkd-card" style="--ec:${e.color};--ebg:${e.bg}">
      <div class="rkd-found">
        <span class="rkd-found__n">${esc(r.numero_manilla)}</span>
        <div><b>${esc(r.nombre_nino)}</b><small>${e.emoji} ${esc(e.nombre)}</small></div>
      </div>
      <div class="rkd-found__meta">
        <span>👤 <b>${esc(r.nombre_adulto)}</b></span><span>📱 ${esc(r.celular_adulto)}</span><span>🕐 Ingresó ${fmtHora(r.hora_ingreso)}</span>
      </div>
    </div>
    <div class="rkd-card">
      <label class="rkd-label">🔐 Verificar identidad</label>
      <p class="rkd-hint">La cédula debe coincidir con la registrada al ingreso.</p>
      <input id="rkd-ent-ced" class="rkd-input rkd-input--big" type="tel" inputmode="numeric" placeholder="Cédula del adulto" />
      <label class="rkd-label" for="rkd-ent-otro">Nombre del adulto si es diferente (opcional)</label>
      <input id="rkd-ent-otro" class="rkd-input" placeholder="Otro acudiente autorizado" />
    </div>
    ${entError ? `<div class="rkd-alert rkd-alert--error">${esc(entError)}</div>` : ""}
    <button class="rkd-btn rkd-btn--green rkd-btn--lg rkd-btn--block" data-accion="ent-confirmar">✅ Confirmar entrega</button>`;
  }

  /* ============================================================ PANEL */
  function vistaPanel() {
    const srvF = pSrv || SRV_ACTUAL;
    const list = S.registrosDe(hoy()).filter(r => {
      if (r.servicio !== srvF) return false;
      if (pEst !== "todos" && r.estado !== pEst) return false;
      if (pEt !== "todas" && r.etapa !== pEt) return false;
      if (pQuery) { const s = pQuery.toLowerCase();
        return r.nombre_nino.toLowerCase().includes(s) || r.numero_manilla.includes(s) || r.nombre_adulto.toLowerCase().includes(s); }
      return true;
    });
    return `
    <div class="rkd-view">
      <h1 class="rkd-h1">📋 Panel de control</h1>
      <div class="rkd-fscroll">
        ${SERVICIOS.map(s => `<button class="rkd-fchip ${srvF === s.id ? "is-on" : ""}" data-accion="p-srv" data-id="${s.id}">${esc(s.nombre)}</button>`).join("")}
      </div>
      <div class="rkd-fscroll">
        ${[["todos", "Todos"], ["presente", "🟢 Presentes"], ["entregado", "✅ Entregados"]].map(([v, l]) =>
          `<button class="rkd-fchip rkd-fchip--dark ${pEst === v ? "is-on" : ""}" data-accion="p-est" data-id="${v}">${l}</button>`).join("")}
      </div>
      <div class="rkd-fscroll">
        <button class="rkd-fchip ${pEt === "todas" ? "is-on" : ""}" data-accion="p-et" data-id="todas">Todas</button>
        ${ETAPAS.map(e => `<button class="rkd-fchip ${pEt === e.id ? "is-on" : ""}" data-accion="p-et" data-id="${e.id}" style="--ec:${e.color}" title="${esc(e.corto)}">${e.emoji}</button>`).join("")}
      </div>
      <input id="rkd-p-q" class="rkd-input" placeholder="🔍 Buscar nombre, manilla, adulto..." value="${esc(pQuery)}" />
      <p class="rkd-count">${list.length} registro${list.length !== 1 ? "s" : ""}</p>
      <div class="rkd-list">
        ${list.map(r => { const e = getEtapa(r.etapa);
          return `<button class="rkd-litem" data-accion="p-ver" data-id="${r.id}" style="--ec:${e.color};--ebg:${e.bg}">
            <span class="rkd-litem__n">${esc(r.numero_manilla)}</span>
            <span class="rkd-litem__txt"><b>${esc(r.nombre_nino)}</b><small>${e.emoji} ${esc(e.corto)}</small><small class="rkd-muted">👤 ${esc(r.nombre_adulto)}</small></span>
            <span class="rkd-litem__st"><span class="rkd-state ${r.estado === "presente" ? "is-here" : "is-out"}">${r.estado === "presente" ? "🟢 Aquí" : "✅ Salió"}</span><small>${fmtHora(r.hora_ingreso)}</small></span>
          </button>`; }).join("")}
      </div>
      ${list.length === 0 ? `<div class="rkd-empty"><div class="rkd-empty__ic">📭</div><p>No hay registros con estos filtros</p></div>` : ""}
    </div>`;
  }
  function modalDetalle(id) {
    const r = S.registrosDe(hoy()).find(x => x.id === id); if (!r) return;
    const e = getEtapa(r.etapa);
    abrirModal(`
      <div class="rkd-modal__head" style="--ec:${e.color}"><h3 id="rkd-modal-t">${esc(r.nombre_nino)}</h3><button class="rkd-x" data-accion="cerrar-modal">✕</button></div>
      <div class="rkd-modal__body">
        <div class="rkd-okbox" style="--ec:${e.color};--ebg:${e.bg}">
          <b>Manilla ${esc(r.numero_manilla)} · ${e.emoji} ${esc(e.nombre)}</b>
          <span>👤 ${esc(r.nombre_adulto)} · 📱 ${esc(r.celular_adulto)}</span>
          <span>🪪 Cédula: ${esc(r.cedula_adulto)}</span>
          <span>🕐 Ingreso: ${fmtHora(r.hora_ingreso)}${r.hora_entrega ? " · Salida: " + fmtHora(r.hora_entrega) : ""}</span>
        </div>
        ${r.peticion_oracion ? `<div class="rkd-okbox rkd-okbox--pet"><b>🙏 Petición</b><span>${esc(r.peticion_oracion)}</span></div>` : ""}
        ${r.estado === "presente"
          ? `<button class="rkd-btn rkd-btn--green rkd-btn--block" data-accion="p-ir-entrega" data-id="${r.id}">Registrar entrega</button>`
          : `<div class="rkd-alert rkd-alert--success">✅ Ya fue entregado/a a las ${fmtHora(r.hora_entrega)}</div>`}
      </div>`);
  }

  /* ============================================================ ADMIN */
  function vistaAdmin() {
    const regs = S.registrosDe(hoy());
    return `
    <div class="rkd-view">
      <h1 class="rkd-h1">⚙️ Administración</h1>
      <div class="rkd-segtabs">
        ${[["usuarios", "👥 Usuarios"], ["stats", "📊 Stats"], ["datos", "💾 Datos"]].map(([id, l]) =>
          `<button class="rkd-segtab ${adminTab === id ? "is-on" : ""}" data-accion="adm-tab" data-id="${id}">${l}</button>`).join("")}
      </div>
      ${adminTab === "usuarios" ? adminUsuarios() : adminTab === "stats" ? adminStats(regs) : adminDatos(regs)}
    </div>`;
  }
  function adminUsuarios() {
    const us = S.usuarios();
    return `
    <div class="rkd-card">
      <h3 class="rkd-card__t">➕ Agregar usuario</h3>
      <input id="rkd-nu-nom" class="rkd-input" placeholder="Nombre del usuario" />
      <div class="rkd-2col">
        <input id="rkd-nu-pin" class="rkd-input" type="password" inputmode="numeric" placeholder="PIN (mín. 4)" />
        <select id="rkd-nu-rol" class="rkd-input">
          <option value="coordinador">Coordinador</option>
          <option value="director">Director</option>
          <option value="candidato">Candidato</option>
        </select>
      </div>
      <button class="rkd-btn rkd-btn--primary rkd-btn--block" data-accion="adm-add-user">Agregar</button>
    </div>
    <h3 class="rkd-card__t rkd-mt">Usuarios registrados</h3>
    ${us.map(u => `
      <div class="rkd-uitem ${u.activo === false ? "is-off" : ""}">
        <span class="rkd-ava ${esAdmin(u) ? "is-admin" : ""}">${esc((u.nombre || "?")[0])}</span>
        <div class="rkd-uitem__txt"><b>${esc(u.nombre)}</b><small>${esc(ROLES[u.rol] || u.rol)}${u.etapa ? " · " + esc(getEtapa(u.etapa).corto) : ""} · ${u.activo === false ? "🔴 Inactivo" : "🟢 Activo"}</small></div>
        ${u.id !== user.id ? `<button class="rkd-mini-btn ${u.activo === false ? "is-green" : "is-red"}" data-accion="adm-toggle" data-id="${u.id}">${u.activo === false ? "Activar" : "Desactivar"}</button>` : '<span class="rkd-chip">Tú</span>'}
      </div>`).join("")}`;
  }
  function adminStats(regs) {
    return `
    <div class="rkd-card">
      <h3 class="rkd-card__t">Hoy — ${new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long" })}</h3>
      <div class="rkd-grid3">
        ${SERVICIOS.map(s => { const n = regs.filter(r => r.servicio === s.id).length; const e = regs.filter(r => r.servicio === s.id && r.estado === "entregado").length;
          return `<div class="rkd-mini"><b>${n}</b><small>${esc(s.nombre)}</small><em>${e} entregados</em></div>`; }).join("")}
      </div>
      <div class="rkd-divider"></div>
      <p class="rkd-card__t">Por etapa (hoy)</p>
      ${ETAPAS.map(e => { const n = regs.filter(r => r.etapa === e.id).length; if (!n) return ""; return `<div class="rkd-row"><span>${e.emoji} ${esc(e.corto)}</span><span class="rkd-pill" style="background:${e.color}">${n}</span></div>`; }).join("") || '<p class="rkd-muted">Sin registros aún.</p>'}
    </div>
    ${regs.filter(r => r.peticion_oracion).length ? `<div class="rkd-card rkd-card--pet">
      <h3 class="rkd-card__t">🙏 Peticiones de oración hoy (${regs.filter(r => r.peticion_oracion).length})</h3>
      ${regs.filter(r => r.peticion_oracion).map(r => `<div class="rkd-petitem"><b>${esc(r.nombre_nino)} · ${esc(r.nombre_adulto)}</b><span>${esc(r.peticion_oracion)}</span></div>`).join("")}
    </div>` : ""}`;
  }
  function adminDatos(regs) {
    const total = S.registros().length;
    return `
    <div class="rkd-alert rkd-alert--info">Los datos se guardan en este dispositivo y se sincronizan con el panel del director. Usa Exportar para respaldos.</div>
    <div class="rkd-card">
      <p><b>Total registros guardados:</b> ${total}</p>
      <p><b>Registros de hoy:</b> ${regs.length}</p>
      <button class="rkd-btn rkd-btn--primary rkd-btn--block" data-accion="adm-export-json">📥 Exportar respaldo (.json)</button>
      <button class="rkd-btn rkd-btn--ghost rkd-btn--block" data-accion="adm-export-csv">📊 Exportar como Excel/CSV</button>
      <button class="rkd-btn rkd-btn--linkred rkd-btn--block" data-accion="adm-reset">🗑 Borrar registros de la demo</button>
    </div>`;
  }

  /* ============================================================ MODAL / TOAST */
  function abrirModal(html) {
    const w = document.getElementById("rkd-modal");
    w.innerHTML = `<div class="rkd-modalbg" id="rkd-modalbg"><div class="rkd-modal" role="dialog" aria-modal="true" aria-labelledby="rkd-modal-t">${html}</div></div>`;
    document.getElementById("rkd-modalbg").addEventListener("click", e => { if (e.target.id === "rkd-modalbg") cerrarModal(); });
    document.addEventListener("keydown", escClose);
  }
  function cerrarModal() { const w = document.getElementById("rkd-modal"); if (w) w.innerHTML = ""; document.removeEventListener("keydown", escClose); }
  function escClose(e) { if (e.key === "Escape") cerrarModal(); }
  function toast(msg, ok) {
    const w = document.getElementById("rkd-toasts");
    const el = document.createElement("div");
    el.className = "rkd-toast" + (ok ? " rkd-toast--ok" : "");
    el.innerHTML = `<span>${ok ? "✓" : "ℹ️"}</span><span>${esc(msg)}</span>`;
    w.appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateY(8px)"; setTimeout(() => el.remove(), 250); }, 2800);
  }

  /* ============================================================ RENDER */
  const VISTAS = { dashboard: vistaDashboard, ingreso: vistaIngreso, entrega: vistaEntrega, panel: vistaPanel, admin: vistaAdmin };
  function render() {
    if (!user) { app().innerHTML = vistaLogin(); bindOnce(); const pin = document.getElementById("rkd-pin"); if (pin) setTimeout(() => pin.focus(), 60); return; }
    if (screen === "admin" && !esAdmin(user)) screen = "dashboard";
    const fn = VISTAS[screen] || vistaDashboard;
    app().innerHTML = topbar() + `<main class="rkd-main" id="rkd-main">${fn()}</main>` + tabbar();
    bindOnce();
    if (screen === "panel") bindPanelSearch();
  }
  function bindOnce() {
    if (bound) return;
    document.addEventListener("click", manejar);
    document.addEventListener("keydown", e => {
      if (e.key === "Enter" && document.getElementById("rkd-pin") && !user) { e.preventDefault(); loginEntrar(); }
    });
    bound = true;
  }
  function bindPanelSearch() {
    const inp = document.getElementById("rkd-p-q"); if (!inp) return;
    inp.addEventListener("input", () => { pQuery = inp.value; const pos = inp.selectionStart; render(); const n = document.getElementById("rkd-p-q"); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } });
  }

  /* capturar valores del form de ingreso antes de re-render */
  function capturarIngreso() {
    ing.nombre_adulto = val("rkd-ad-nom") || ing.nombre_adulto;
    ing.celular_adulto = val("rkd-ad-cel") || ing.celular_adulto;
    ing.cedula_adulto = val("rkd-ad-ced") || ing.cedula_adulto;
    ing.nombre_nino = val("rkd-ni-nom") || ing.nombre_nino;
    ing.peticion_oracion = val("rkd-ni-pet") || ing.peticion_oracion;
  }

  /* ============================================================ EVENTOS */
  function manejar(ev) {
    const el = ev.target.closest("[data-accion]"); if (!el) return;
    const a = el.dataset.accion, id = el.dataset.id;
    switch (a) {
      /* login */
      case "sel-user": loginSel = id; render(); { const p = document.getElementById("rkd-pin"); if (p) setTimeout(() => p.focus(), 60); } return;
      case "login-volver": loginSel = null; render(); return;
      case "login-entrar": loginEntrar(); return;

      /* nav */
      case "ir": ev.preventDefault();
        if (el.dataset.screen === "ingreso") { ingDone = null; if (!ing.servicio) ing.servicio = SRV_ACTUAL; }
        screen = el.dataset.screen; window.scrollTo(0, 0); render(); return;
      case "salir": ev.preventDefault(); borrarSesion(); user = null; loginSel = null; screen = "dashboard"; render(); return;

      /* ingreso */
      case "ing-srv": capturarIngreso(); ing.servicio = id; render(); return;
      case "ing-etapa": capturarIngreso(); ing.etapa = id; render(); return;
      case "ing-guardar": ev.preventDefault(); guardarIngreso(); return;
      case "ing-otro": ingDone = null; ing = blankIngreso(); render(); return;

      /* entrega */
      case "ent-buscar": ev.preventDefault(); entregaBuscar(); return;
      case "ent-confirmar": ev.preventDefault(); entregaConfirmar(); return;
      case "ent-otra": entDone = null; entRes = null; entError = ""; render(); return;

      /* panel */
      case "p-srv": pSrv = id; render(); return;
      case "p-est": pEst = id; render(); return;
      case "p-et": pEt = id; render(); return;
      case "p-ver": modalDetalle(id); return;
      case "p-ir-entrega": { cerrarModal(); const r = S.registros().find(x => x.id === id); entRes = r; entError = ""; screen = "entrega"; render(); return; }

      /* admin */
      case "adm-tab": adminTab = id; render(); return;
      case "adm-add-user": admAddUser(); return;
      case "adm-toggle": { const u = S.usuarios().find(x => x.id === id); if (u) { S.updateUsuario(id, { activo: !(u.activo !== false) }); render(); toast("Usuario actualizado", true); } return; }
      case "adm-export-json": exportJSON(); return;
      case "adm-export-csv": exportCSV(); return;
      case "adm-reset": if (confirm("¿Borrar los registros de la demo? Se regenerarán los de hoy al recargar.")) { S.resetRegistros(); render(); toast("Registros borrados", false); } return;

      case "cerrar-modal": ev.preventDefault(); cerrarModal(); return;
    }
  }

  function loginEntrar() {
    const u = S.usuarios().find(x => x.id === loginSel); if (!u) return;
    const pin = val("rkd-pin");
    const errEl = document.getElementById("rkd-pin-err");
    if (u.pin !== pin) { if (errEl) { errEl.textContent = "PIN incorrecto"; errEl.hidden = false; } const p = document.getElementById("rkd-pin"); if (p) { p.value = ""; p.focus(); } return; }
    user = u; guardarSesion(u); loginSel = null; screen = "dashboard"; render();
    toast(`¡Bienvenido, ${(u.nombre || "").split(" ")[0]}! 👋`, true);
  }

  function guardarIngreso() {
    capturarIngreso();
    const errEl = document.getElementById("rkd-ing-err");
    const req = [["nombre_adulto", "Nombre del adulto"], ["celular_adulto", "Celular"], ["cedula_adulto", "Cédula"], ["nombre_nino", "Nombre del niño/a"], ["etapa", "Etapa"]];
    for (const [k, l] of req) { if (!ing[k]) { if (errEl) { errEl.textContent = "⚠ Falta: " + l; errEl.hidden = false; } return; } }
    const manilla = S.siguienteManilla(hoy(), ing.servicio);
    ingDone = S.addRegistro({
      servicio: ing.servicio, numero_manilla: manilla, nombre_nino: ing.nombre_nino, etapa: ing.etapa,
      nombre_adulto: ing.nombre_adulto, cedula_adulto: soloDig(ing.cedula_adulto), celular_adulto: ing.celular_adulto,
      peticion_oracion: ing.peticion_oracion, estado: "presente", registrado_por: user.id, hora_entrega: null, cedula_retiro: null,
    });
    ing = blankIngreso(); render(); window.scrollTo(0, 0);
  }

  function entregaBuscar() {
    entError = ""; entRes = null;
    const q = val("rkd-ent-q").toLowerCase();
    if (!q) { render(); return; }
    const r = S.registrosDe(hoy()).find(x => x.estado === "presente" &&
      (x.numero_manilla === q || x.numero_manilla === q.padStart(3, "0") || x.nombre_nino.toLowerCase().includes(q)));
    if (!r) entError = "No se encontró ningún niño/a presente con ese dato, o ya fue entregado/a.";
    else entRes = r;
    render();
  }
  function entregaConfirmar() {
    const ced = soloDig(val("rkd-ent-ced"));
    if (!ced) { entError = "Ingresa la cédula del adulto"; render(); return; }
    if (ced !== soloDig(entRes.cedula_adulto)) { entError = "⚠ La cédula NO coincide. No se puede entregar al niño/a."; render(); return; }
    const otro = val("rkd-ent-otro");
    entDone = S.updateRegistro(entRes.id, { estado: "entregado", hora_entrega: new Date().toISOString(), cedula_retiro: ced, nombre_adulto_retiro: otro || null, entregado_por: user.id });
    entRes = null; entError = ""; render(); window.scrollTo(0, 0);
  }

  function admAddUser() {
    const nom = val("rkd-nu-nom"), pin = val("rkd-nu-pin"), rol = val("rkd-nu-rol") || "coordinador";
    if (!nom) { toast("Escribe un nombre", false); return; }
    if (!pin || pin.length < 4) { toast("El PIN debe tener al menos 4 dígitos", false); return; }
    S.addUsuario({ nombre: nom, pin, rol, activo: true });
    render(); toast("✅ Usuario agregado", true);
  }

  function exportJSON() {
    const data = { usuarios: S.usuarios(), registros: S.registros(), exportado: new Date().toISOString() };
    descargar(JSON.stringify(data, null, 2), `rocakids-backup-${hoy()}.json`, "application/json");
    toast("Respaldo exportado", true);
  }
  function exportCSV() {
    const cols = ["fecha", "servicio", "numero_manilla", "nombre_nino", "etapa", "nombre_adulto", "celular_adulto", "cedula_adulto", "peticion_oracion", "hora_ingreso", "hora_entrega", "estado"];
    const rows = S.registros().map(r => cols.map(c => `"${String(r[c] == null ? "" : r[c]).replace(/"/g, '""')}"`).join(","));
    descargar([cols.join(","), ...rows].join("\n"), `rocakids-registros-${hoy()}.csv`, "text/csv");
    toast("CSV exportado", true);
  }
  function descargar(contenido, nombre, tipo) {
    try { const blob = new Blob([contenido], { type: tipo }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nombre; a.click(); }
    catch (e) { toast("No se pudo exportar en este entorno", false); }
  }

  /* sincronización en vivo (otra pestaña / app del director) */
  if (S && S.onCambio) S.onCambio(() => { if (user) render(); });

  /* init */
  if (document.readyState !== "loading") render();
  else document.addEventListener("DOMContentLoaded", render);
})();
