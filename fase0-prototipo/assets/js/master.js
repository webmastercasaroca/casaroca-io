/* ============================================================
   CASA ROCA · SISTEMA MASTER (Dirección General)
   El cascarón total. Recoge TODO el sistema en una sola shell y
   lo gobierna por roles y permisos.

   Tres cosas lo distinguen de las apps por rol:
   1. Desde aquí se CREA a todo el mundo: pastores, directores,
      líderes, consejeros, tesorería, maestros de RocaKids.
   2. Cada pestaña está atada a un módulo real del backend y
      declara qué nivel de dato maneja y qué roles la alcanzan.
   3. Las apps por rol no se duplican: se ABREN aquí dentro, con
      el patrón de panel anidado que ya usa el pastor.
   ============================================================ */
(function () {
  "use strict";
  const I = window.IDENTIDAD, M = window.MSTORE;
  if (!I || !M) { console.error("Falta master-identidad.js o master-store.js"); return; }

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g,
    c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const hoy = () => new Date().toISOString().slice(0, 10);
  const $ = s => document.querySelector(s);

  /* Quien opera el master. En Fase 0 es la Dirección General. */
  let YO = { personaId:"p-dg", nombre:"Ps. Director General",
             rol:"PASTOR_DIRECTOR_GENERAL", techo:4 };

  /* La red completa a la que se aspira. Es una META, no un dato:
     lo REAL sale siempre de M.sedes().length. Antes el "36" iba
     cableado en la cabecera y en el tablero, así que la pantalla
     decía "36 iglesias" con 6 registradas justo debajo. */
  const META_IGLESIAS = 36;

  let vista = "arranque";   // el proceso, no el tablero
  let borrador = null;   // asistente de creación de acceso
  let filtro  = "";      // búsqueda de la lista
  let abierta = null;    // fila desplegada
  let cfgSede = null;    // iglesia que se está configurando
  let menuCrear = false; // desplegable de + Crear
  let logro = null;      // lo que acaba de pasar, para encadenar el siguiente paso

  /* ============================================================
     NAVEGACIÓN · todas las pestañas del sistema
     `mod` ata la pestaña a un módulo del backend; si está, el
     permiso se calcula de verdad y no es decorativo.
     ============================================================ */
  const NAV = [
    { sep:"Dirección" },
    { id:"arranque",ico:"🧭", lbl:"Puesta en marcha" },
    { id:"comando", ico:"🛰️", lbl:"Centro de mando", mod:"crm" },
    { id:"tablero", ico:"🌐", lbl:"Tablero de la red" },

    { sep:"Identidad y accesos" },
    { id:"accesos",  ico:"🔑", lbl:"Personas con acceso", mod:"identidad" },
    { id:"crear",    ico:"➕", lbl:"Crear acceso",        mod:"identidad" },
    { id:"roles",    ico:"🎭", lbl:"Roles y techos",      mod:"identidad" },
    { id:"matriz",   ico:"🧮", lbl:"Matriz de permisos",  mod:"identidad" },
    { id:"permisos", ico:"✅", lbl:"Qué puede hacer cada rol", mod:"identidad" },
    { id:"efectivo", ico:"🔎", lbl:"Qué ve cada persona", mod:"identidad" },
    { id:"bitacora", ico:"📜", lbl:"Bitácora de accesos", mod:"cumplimiento" },
    { id:"contraste",ico:"⚖️", lbl:"Contraste con el equipo 100p" },

    { sep:"Organización" },
    { id:"iglesias",  ico:"⛪", lbl:"Iglesias y sedes",  mod:"organizacion" },
    { id:"plantillas",ico:"🧩", lbl:"Plantillas de iglesia", mod:"organizacion" },
    { id:"modsede",   ico:"🎚️", lbl:"Qué ve cada iglesia", mod:"organizacion" },

    { sep:"Operación" },
    { id:"personas",   ico:"👤", lbl:"Personas",        mod:"personas" },
    { id:"crm",        ico:"🗒️", lbl:"CRM Pastoral 4C", mod:"crm" },
    { id:"grupos",     ico:"🏠", lbl:"Grupos y hogares",mod:"grupos" },
    { id:"asistencia", ico:"📋", lbl:"Asistencia",      mod:"asistencia" },
    { id:"aportes",    ico:"💰", lbl:"Aportes",         mod:"aportes" },
    { id:"formacion",  ico:"🎓", lbl:"Formación",       mod:"formacion" },
    { id:"talento",    ico:"🤝", lbl:"Talento y voluntariado", mod:"talento" },
    { id:"rocakids",   ico:"🧒", lbl:"RocaKids",        mod:"rocakids" },
    { id:"consejeria", ico:"💬", lbl:"Consejería",      mod:"consejeria" },

    { sep:"Apps por rol" },
    { id:"app-central",   ico:"🏛️", lbl:"Dirección General", src:"central.html" },
    { id:"app-pastor",    ico:"⛪", lbl:"Pastor de sede",     src:"pastor.html" },
    { id:"app-director",  ico:"🗂️", lbl:"Director de ministerio", src:"director.html" },
    { id:"app-lider",     ico:"👥", lbl:"Líder de grupo",     src:"lider.html" },
    { id:"app-nicodemo",  ico:"🌱", lbl:"Nicodemo · nuevos",  src:"nicodemo.html" },
    { id:"app-rocakids",  ico:"🧒", lbl:"RocaKids · dirección", src:"rocakids-director.html" },
    { id:"app-consejeria",ico:"💬", lbl:"Consejería · dirección", src:"consejeria-director.html" },

    { sep:"Gobierno" },
    { id:"cumplimiento", ico:"🛡️", lbl:"Auditoría y cumplimiento", mod:"cumplimiento" },
  ];

  /* El borrador de la pantalla en curso. Vive aquí arriba porque lo
     usan tanto las vistas como los manejadores de eventos. */
  function b_() { return (borrador = borrador || {}); }

  /* ---------- utilidades de presentación ---------- */
  function pastilla(n) {
    const x = I.nivel(n) || { codigo:"N?" };
    return `<span class="ms-niv ms-niv--${n}" title="${esc(x.desc || "")}">${esc(x.codigo)}</span>`;
  }
  function nombreDestino(id) {
    const s = M.sedes().find(x => x.id === id);
    const m = M.ministerios().find(x => x.codigo === id);
    return (s && s.nombre) || (m && m.nombre) || id;
  }
  function nombreAlcance(a) {
    const t = I.alcance(a.alcanceTipo);
    if (!t) return esc(a.alcanceTipo);
    const l = I.alcancesDe(a);
    if (!l.length) return esc(t.nombre);
    if (l.length === 1) return esc(t.nombre) + " · " + esc(nombreDestino(l[0]));
    return esc(t.nombre) + " · " + esc(l.length + " destinos: " + l.map(nombreDestino).join(", "));
  }
  function vigencia(a) {
    if (!a.hasta) return `<span class="ms-vig ms-vig--ok">Vigente desde ${esc(a.desde)}</span>`;
    const cerrada = a.hasta < hoy();
    return `<span class="ms-vig ms-vig--${cerrada ? "fin" : "porvencer"}">${
      cerrada ? "Cerrada el " : "Vence el "}${esc(a.hasta)}</span>`;
  }
  function head(t, s) {
    return `<div class="ms-head"><h1>${esc(t)}</h1><p>${s}</p></div>`;
  }
  function fichaModulo(cod) {
    const m = I.modulo(cod); if (!m) return "";
    const roles = [...new Set(I.MATRIZ.filter(p => p.modulo === cod).map(p => p.rol))];
    const acc   = [...new Set(I.MATRIZ.filter(p => p.modulo === cod).map(p => p.accion))].sort();
    const n = I.nivel(m.nivel) || {};
    return `
    <div class="ms-modcard">
      <div class="ms-modcard__fila">
        <div><div class="ms-lbl">Nivel del dato</div><div class="ms-val">${pastilla(m.nivel)} ${esc(n.desc || "")}</div></div>
        <div><div class="ms-lbl">Controles que activa</div><div class="ms-val">${
          [n.cifrado && "cifrado", n.bitacora && "bitácora de lectura", n.enmascarado && "enmascarado"]
          .filter(Boolean).join(" · ") || "ninguno adicional"}</div></div>
      </div>
      <div class="ms-modcard__fila">
        <div><div class="ms-lbl">Roles con acceso (${roles.length})</div>
          <div class="ms-chips">${roles.map(r => {
            const rr = I.rol(r); return `<span class="ms-chip">${esc(rr ? rr.nombre : r)}</span>`; }).join("")}</div></div>
      </div>
      <div class="ms-modcard__fila">
        <div><div class="ms-lbl">Acciones definidas (${acc.length})</div>
          <div class="ms-chips">${acc.map(a => `<span class="ms-chip ms-chip--acc">${esc(a)}</span>`).join("")}</div></div>
      </div>
    </div>`;
  }

  /* ============================================================ PUESTA EN MARCHA
     El orden importa y no es decorativo: primero los pastores
     generales, de ellos sale la parte administrativa, de ahí las
     iglesias (cada una con SU pastor, que la base exige), y solo
     entonces los roles de cada iglesia. Saltarse un paso deja
     huérfano el siguiente. */
  function vArranque() {
    const per = M.personas(), asg = M.asignaciones();
    const vig = a => !a.hasta || a.hasta >= hoy();
    const generales = asg.filter(a => vig(a) && a.alcanceTipo === "organizacion");
    const admin     = M.equipos();
    const sedes     = M.sedes();
    const conPastor = sedes.filter(s => asg.some(a => vig(a) && a.alcanceId === s.id && a.rol === "PASTOR_CONGREGACIONAL"));
    const rolesSede = asg.filter(a => vig(a) && a.alcanceTipo !== "organizacion");

    const pasos = [
      { n:1, t:"Pastores generales", sub:"La Dirección General. De aquí sale todo lo demás.",
        hecho:generales.length, meta:"al menos 1", ok:generales.length > 0,
        ir:"crear", btn:"Otorgar Dirección General",
        detalle:generales.length
          ? generales.map(a => (M.persona(a.personaId) || {}).nombre).join(", ")
          : "Todavía nadie gobierna la red." },
      { n:2, t:"Equipo administrativo", sub:"Los equipos corporativos que dependen de la Dirección.",
        hecho:admin.length, meta:"los que hagan falta", ok:admin.length > 0,
        ir:"n-equipo", btn:"Crear equipo",
        detalle:admin.length ? admin.map(e => e.nombre).join(", ") : "Ningún equipo creado todavía.",
        bloqueado: generales.length === 0, porque:"Primero tiene que existir la Dirección General." },
      /* ⛔ El número y el visto tienen que medir LO MISMO. Antes el
         contador decía "6 / 36" (iglesias creadas) pero el ✓ se
         encendía por otra cosa (que TODAS tuvieran pastor), así que
         se podía llegar a 36/36 y seguir sin visto, sin explicación.
         Ahora ambos miden iglesias CON PASTOR, que es lo que hace
         falta para que el paso siguiente tenga dónde apoyarse. */
      { n:3, t:"Iglesias con pastor", sub:"Cada una nace con su pastor y con una plantilla que define qué ve.",
        hecho:conPastor.length, meta:sedes.length || META_IGLESIAS,
        ok:sedes.length > 0 && conPastor.length === sedes.length,
        ir:"n-iglesia", btn:"Crear iglesia",
        detalle:sedes.length
          ? `${conPastor.length} de ${sedes.length} tienen pastor asignado. La red prevé ${META_IGLESIAS}.`
          : "Ninguna iglesia creada.",
        bloqueado: generales.length === 0, porque:"La Dirección General es quien crea iglesias." },
      { n:4, t:"Roles por iglesia", sub:"Directores, líderes, consejeros y tesorería de cada sede.",
        hecho:rolesSede.length, meta:"según cada iglesia", ok:rolesSede.length > 0,
        ir:"crear", btn:"Otorgar acceso",
        detalle:rolesSede.length ? `${rolesSede.length} accesos vigentes fuera de la Dirección.` : "Sin roles locales todavía.",
        bloqueado: sedes.length === 0, porque:"Primero hay que crear la iglesia donde van a servir." },
    ];
    const hechos = pasos.filter(x => x.ok).length;

    return `<div class="ms-ancho--lectura">` + head("Puesta en marcha",
      "El sistema se llena en un orden. Cada paso habilita el siguiente; saltarse uno deja huérfano al que sigue.") + `
      <div class="ms-prog">
        <div class="ms-prog__barra"><i style="width:${(hechos / pasos.length) * 100}%"></i></div>
        <span class="ms-cuenta">${hechos} de ${pasos.length} pasos completos</span>
      </div>
      ${pasos.map(x => `
        <div class="ms-paso-seq ${x.ok ? "is-ok" : ""} ${x.bloqueado ? "is-bloq" : ""}">
          <div class="ms-paso-seq__n">${x.ok ? "\u2713" : x.n}</div>
          <div class="ms-paso-seq__c">
            <h3>${esc(x.t)}</h3>
            <p>${esc(x.sub)}</p>
            <div class="ms-paso-seq__est">${esc(x.detalle)}</div>
            ${x.bloqueado ? `<div class="ms-nota ms-nota--ojo">${esc(x.porque)}</div>` : ""}
          </div>
          <div class="ms-paso-seq__a">
            <div class="ms-cuenta">${x.hecho} <small>/ ${esc(x.meta)}</small></div>
            <button class="ms-btn ${x.ok ? "" : "ms-btn--primario"}" data-accion="ir" data-vista="${x.ir}"
              ${x.bloqueado ? "disabled" : ""}>${esc(x.btn)}</button>
          </div>
        </div>`).join("")}
    </div>`;
  }





  /* ============================================================ AFINAR UNA ASIGNACIÓN
     Los tres ejes, modulares, para UNA persona:
       · qué módulos ve       (excepción sobre lo que da su rol)
       · sobre qué destinos   (una sede, tres sedes)
       · con qué nivel        (uno general, o afinado por módulo)

     Lo único rígido, a propósito, es el TECHO DEL ROL. Todo lo demás
     se ajusta persona por persona sin inventar roles nuevos. */
  function vAfinar() {
    const b = b_();
    const a = M.asignaciones().find(x => x.id === b.afinarId);
    if (!a) return head("Afinar acceso", "No hay ninguna asignación seleccionada.");
    const p = M.persona(a.personaId), r = I.rol(a.rol);
    const t = I.alcance(a.alcanceTipo);
    const destinos = I.alcancesDe(a);
    const modular = b.modularNivel || !!a.nivelPorModulo;
    const fuente = t && t.exigeId
      ? (t.fuente === "ministerios" ? M.ministerios().map(m => ({ id:m.codigo, nombre:m.nombre }))
        : t.fuente === "sedes" ? M.sedes() : [])
      : [];

    return `<div class="ms-ancho--lectura">` + head("Afinar el acceso de " + esc(p ? p.nombre : ""),
      `Como <b>${esc(r ? r.nombre : a.rol)}</b>. Los preestablecidos ya están puestos; aquí se ajusta lo que haga falta para esta persona, sin inventarle un rol nuevo.`) + `

    <div class="ms-alerta ms-alerta--ambar">
      <b>Lo único que no se ajusta es el techo del rol:</b> ${pastilla(r ? r.techo : 0)}.
      Por debajo de ahí todo es modular. Por encima, no hay excepción que valga: habría que
      cambiarle el rol.
    </div>

    <div class="ms-paso"><h3><i>1</i> Qué módulos ve</h3>
      <p class="ms-sub" style="font-family:var(--ui);margin:0 0 12px">
        Esta lista es <b>de esta persona</b>, no de su rol ni de su iglesia. Lo que no esté
        marcado, no lo ve: su panel aparece sin esa pestaña. El rol solo sugiere el arranque;
        la iglesia es un techo, porque lo que la sede tenga apagado no se ve aunque aquí esté marcado.</p>
      <div class="ms-acciones" style="margin-bottom:12px">
        <button class="ms-btn ms-btn--peq" data-accion="mods-todos" data-id="${esc(a.id)}" data-v="1">Marcar todo lo que su rol permite</button>
        <button class="ms-btn ms-btn--peq ms-btn--peligro" data-accion="mods-todos" data-id="${esc(a.id)}" data-v="0">Dejar en cero</button>
      </div>
      <div class="ms-sel">
        ${I.MODULOS.map(m => {
          const filas = M.matriz().filter(x => x.rol === a.rol && x.modulo === m.codigo);
          const daRol = filas.length > 0;
          /* La CONCESIÓN: una fila de la matriz con nivel_max propio sube
             el nivel para ESE módulo, con acta. Es como el pastor ve la
             consejería de su sede sin ver los aportes, siendo ambos N3. */
          const concesion = filas.find(x => x.nivel != null && x.nivel > a.nivelMax);
          const alcanza = concesion ? concesion.nivel : I.nivelEn(a, m.codigo);
          const posible = alcanza >= m.nivel;
          const perm = I.moduloPermitido(a, m.codigo, m.nivel);
          const on = daRol && perm.ok;
          const exc = a.modulos && a.modulos[m.codigo] !== undefined;
          const porque = !daRol ? "el rol no lo da"
            : concesion ? `concesión declarada: N${concesion.nivel} solo aquí`
            : !posible ? `el rol llega a N${alcanza} y esto es N${m.nivel}`
            : exc ? "excepción de esta persona"
            : "lo da su rol";
          return `<label class="ms-opt ${on ? "is-on" : ""} ${(!daRol || !posible) ? "is-off" : ""}"
            title="${esc(porque)}">
            <input type="checkbox" ${on ? "checked" : ""} ${(!daRol || !posible) ? "disabled" : ""}
              data-modpersona="${esc(m.codigo)}">
            <div><b>${esc(m.nombre)}</b> ${pastilla(m.nivel)}
              <small>${esc(porque)}</small></div></label>`;
        }).join("")}
      </div>
    </div>

    ${t && t.exigeId ? `<div class="ms-paso"><h3><i>2</i> Sobre qué destinos</h3>
      <p class="ms-sub" style="font-family:var(--ui);margin:0 0 12px">
        Un pastor regional cubre tres iglesias con UNA asignación, no con tres iguales.
        Cubre ahora <b>${destinos.length}</b>.</p>
      <div class="ms-sel">
        ${fuente.map(f => {
          const on = destinos.indexOf(f.id) >= 0;
          return `<label class="ms-opt ${on ? "is-on" : ""}">
            <input type="checkbox" ${on ? "checked" : ""} data-destino="${esc(f.id)}">
            <div><b>${esc(f.nombre)}</b>${f.codigo ? `<small>${esc(f.codigo)}</small>` : ""}</div></label>`;
        }).join("") || "<i>No hay destinos cargados.</i>"}
      </div>
    </div>` : `<div class="ms-paso"><h3><i>2</i> Sobre qué destinos</h3>
      <div class="ms-nota">El alcance «${esc(t ? t.nombre : a.alcanceTipo)}» no lleva destinos:
        ${esc(t ? t.ayuda : "")}</div></div>`}

    <div class="ms-paso"><h3><i>3</i> Con qué nivel de dato</h3>
      <div class="ms-nota">Nivel general de esta asignación: ${pastilla(a.nivelMax)}.
        Vale para todos los módulos mientras no se afine ninguno.</div>
      <label class="ms-opt ${modular ? "is-on" : ""}" style="max-width:420px">
        <input type="checkbox" ${modular ? "checked" : ""} data-accion-chk="modular">
        <div><b>Afinar el nivel módulo por módulo</b>
          <small>Para casos como «N2 en general, pero N3 en aportes».</small></div></label>
      ${modular ? `<div class="ms-permsel" style="margin-top:12px">
        <div class="ms-permsel__cab" style="grid-template-columns:minmax(0,1fr) repeat(5,54px)">
          <span class="ms-lbl" style="margin:0">Módulo</span>
          ${I.NIVELES.map(n => `<span class="ms-lbl" style="margin:0;text-align:center">N${n.nivel}</span>`).join("")}
        </div>
        ${I.MODULOS.map(m => {
          const act = I.nivelEn(a, m.codigo);
          const exc = a.nivelPorModulo && a.nivelPorModulo[m.codigo] !== undefined;
          return `<div class="ms-permsel__f" style="grid-template-columns:minmax(0,1fr) repeat(5,54px)">
            <div class="ms-permsel__m"><b>${esc(m.nombre)}</b> ${pastilla(m.nivel)}
              ${exc ? `<span class="ms-chip">afinado</span>` : ""}</div>
            ${I.NIVELES.map(n => {
              const bloq = r && n.nivel > r.techo;
              return `<label class="ms-radio ${act === n.nivel ? "is-on" : ""}">
                <input type="radio" name="niv_${esc(m.codigo)}" ${act === n.nivel ? "checked" : ""}
                  ${bloq ? "disabled" : ""} data-nivmod="${esc(m.codigo)}" data-niv="${n.nivel}"></label>`;
            }).join("")}
          </div>`;
        }).join("")}
      </div>` : ""}
    </div>

    <div class="ms-lbl" style="margin-top:18px">Con esto, hoy alcanza</div>
    <div class="ms-chips">${(() => {
      const ef = I.permisoEfectivo([a]);
      return ef.length ? ef.map(x => `<span class="ms-chip">${esc(x.nombre)} ${pastilla(x.nivelModulo)}</span>`).join("")
        : "<i>ningún módulo</i>";
    })()}</div>

    <div class="ms-acciones" style="margin-top:18px">
      <button class="ms-btn ms-btn--primario" data-accion="verpersona" data-id="${esc(a.personaId)}">Listo</button>
    </div></div>`;
  }

  /* ============================================================ PROMOVER O TRASLADAR
     De líder a director, de una sede a otra. La fila vieja NO se
     edita: se cierra y se abre una nueva. Así la auditoría puede
     responder «¿qué era esta persona en marzo?». */
  function vPromover() {
    const b = b_();
    const a = M.asignaciones().find(x => x.id === b.promId);
    if (!a) return head("Cambiar rol", "No hay ninguna asignación seleccionada.");
    const p = M.persona(a.personaId), rv = I.rol(a.rol);
    const puede = I.rolesQuePuedeCrear(YO.rol);
    const rn = b.rol ? I.rol(b.rol) : null;
    const al = b.alcanceTipo ? I.alcance(b.alcanceTipo) : null;
    const v = (b.rol && b.alcanceTipo && b.nivelMax != null)
      ? I.validarAsignacion({ personaId:a.personaId, rol:b.rol, alcanceTipo:b.alcanceTipo,
          alcanceId:b.alcanceId || null, nivelMax:b.nivelMax, desde:hoy(), hasta:null, acta:b.acta }, YO)
      : null;
    let opciones = "";
    if (al && al.exigeId) {
      const fuente = al.fuente === "ministerios" ? M.ministerios().map(m => ({ id:m.codigo, nombre:m.nombre }))
                   : al.fuente === "sedes" ? M.sedes() : [];
      opciones = fuente.length
        ? `<label class="ms-campo"><span>¿Cuál? <b class="ms-req">obligatorio</b></span>
           <select data-campo="alcanceId"><option value="">Elegir…</option>
           ${fuente.map(f => `<option value="${esc(f.id)}" ${b.alcanceId === f.id ? "selected" : ""}>${esc(f.nombre)}</option>`).join("")}
           </select></label>`
        : `<div class="ms-alerta ms-alerta--ambar">No hay ${esc(al.fuente)} cargados. Créelos antes.</div>`;
    }
    return `<div class="ms-ancho--forma">` + head("Cambiar el rol de " + esc(p ? p.nombre : ""),
      "La asignación actual se cierra con fecha de hoy y se abre una nueva. Nunca se edita ni se borra: la auditoría tiene que poder decir qué era esta persona el mes pasado.") + `
    <div class="ms-paso">
      <div class="ms-lbl">Hoy es</div>
      <div class="ms-val" style="margin-bottom:12px"><b>${esc(rv ? rv.nombre : a.rol)}</b> · ${nombreAlcance(a)} · ${pastilla(a.nivelMax)}
        <span class="ms-sub" style="font-family:var(--ui)">desde ${esc(a.desde)}</span></div>
      <div class="ms-lbl">Pasa a ser</div>
      <label class="ms-campo"><span>Nuevo rol</span>
        <select data-campo="rol"><option value="">Elegir…</option>
        ${M.rolesTodos().filter(x => puede.indexOf(x.codigo) >= 0 && x.codigo !== a.rol)
          .map(x => `<option value="${esc(x.codigo)}" ${b.rol === x.codigo ? "selected" : ""}>${esc(x.nombre)} · techo N${x.techo}</option>`).join("")}
        </select></label>
      ${rn ? `<div class="ms-nota ${rn.techo > (rv||{techo:0}).techo ? "ms-nota--ojo" : ""}">
        ${rn.techo > (rv||{techo:0}).techo
          ? `Sube de techo N${(rv||{}).techo} a N${rn.techo}: alcanzará datos que antes no veía.`
          : rn.techo < (rv||{techo:0}).techo
            ? `Baja de techo N${(rv||{}).techo} a N${rn.techo}: dejará de ver lo que veía.`
            : `Mantiene el techo N${rn.techo}.`}</div>` : ""}
      <label class="ms-campo"><span>Nuevo alcance</span>
        <select data-campo="alcanceTipo"><option value="">Elegir…</option>
        ${I.ALCANCES.map(x => `<option value="${esc(x.codigo)}" ${b.alcanceTipo === x.codigo ? "selected" : ""}>${esc(x.nombre)}</option>`).join("")}
        </select></label>
      ${al ? `<div class="ms-nota">${esc(al.ayuda)}</div>` : ""}
      ${opciones}
      <div class="ms-lbl" style="margin-top:12px">Hasta qué nivel de dato</div>
      <div class="ms-niveles">
        ${I.NIVELES.map(n => {
          const bloq = (rn && n.nivel > rn.techo) || n.nivel > YO.techo;
          return `<button class="ms-nivbtn ${b.nivelMax === n.nivel ? "is-on" : ""} ${bloq ? "is-off" : ""}"
            ${bloq ? "disabled" : ""} data-accion="nivel" data-n="${n.nivel}">
            ${pastilla(n.nivel)}<span>${esc(n["desc"])}</span></button>`; }).join("")}
      </div>
      <label class="ms-campo" style="margin-top:12px"><span>Acta que respalda el cambio
        ${b.nivelMax >= 3 ? '<b class="ms-req">obligatoria para N3/N4</b>' : "(recomendada)"}</span>
        <input data-campo="acta" value="${esc(b.acta || "")}" placeholder="ACTA-JD-2026-000"></label>
    </div>
    ${v ? (v.ok
      ? `<div class="ms-alerta ms-alerta--verde"><b>Listo.</b> Se cerrará «${esc(rv ? rv.nombre : a.rol)}» hoy y se abrirá el nuevo.</div>`
      : `<div class="ms-alerta ms-alerta--roja"><b>La base rechazaría esto:</b><ul>${v.fallos.map(f => `<li>${esc(f)}</li>`).join("")}</ul></div>`) : ""}
    <div class="ms-acciones">
      <button class="ms-btn ms-btn--primario" data-accion="hacer-promover" ${v && v.ok ? "" : "disabled"}>Cambiar el rol</button>
      <button class="ms-btn" data-accion="verpersona" data-id="${esc(a.personaId)}">Cancelar</button>
    </div></div>`;
  }

  /* ============================================================ HECHO · QUÉ SIGUE
     El defecto que esto arregla: cada creación devolvía a una lista
     distinta, y para el siguiente paso había que volver al menú y
     adivinar cuál de treinta pestañas tocaba.

     Ahora nada suelta al usuario en el menú. Cada acto termina
     diciendo qué acaba de pasar y cuál es el paso lógico siguiente,
     con el botón puesto. El flujo es el producto. */
  const SIGUIENTES = {
    persona:  { t:"Ficha creada", sig:[
      { v:"crear",       l:"Darle sus roles y permisos", p:true, lleva:"persona",
        d:"Una ficha sin rol no abre nada. Es el paso que falta, y va con ella ya elegida." },
      { v:"n-persona",   l:"Crear otra persona" }] },
    iglesia:  { t:"Iglesia creada y pastoreada", sig:[
      { v:"crear",       l:"Otorgar roles en esta iglesia", p:true, lleva:"sede",
        d:"Va con el alcance de esta sede ya puesto." },
      { v:"n-ministerio",l:"Crear su primer ministerio", lleva:"sede",
        d:"El pastor ya puede entrar. Lo siguiente es su equipo." },
      { v:"iglesia",     l:"Ver la ficha de la iglesia" },
      { v:"n-iglesia",   l:"Crear otra iglesia" }] },
    ministerio:{ t:"Ministerio creado con su director", sig:[
      { v:"crear",       l:"Nombrar líderes del ministerio", p:true, lleva:"sede",
        d:"El director ya entra. Ahora sus líderes de grupo." },
      { v:"n-ministerio",l:"Crear otro ministerio", lleva:"sede" }] },
    equipo:   { t:"Equipo creado con su responsable", sig:[
      { v:"crear",       l:"Sumar a alguien más al equipo", p:true },
      { v:"n-equipo",    l:"Crear otro equipo" },
      { v:"arranque",    l:"Volver al proceso" }] },
    acceso:   { t:"Acceso otorgado", sig:[
      { v:"persona",     l:"Ver qué abre esta persona", p:true,
        d:"Compruebe que su panel abre de verdad." },
      { v:"crear",       l:"Otorgar otro acceso" },
      { v:"arranque",    l:"Volver al proceso" }] },
    rol:      { t:"Rol creado", sig:[
      { v:"permisos",    l:"Decir qué puede hacer", p:true,
        d:"Un rol sin permisos no sirve de nada todavía." },
      { v:"roles",       l:"Ver todos los roles" }] },
    modulo:   { t:"Módulo creado", sig:[
      { v:"permisos",    l:"Dar permisos sobre él", p:true },
      { v:"modsede",     l:"Encenderlo en las iglesias" }] },
  };

  function vHecho() {
    const g = logro || {};
    const cfg = SIGUIENTES[g.que] || { t:"Listo", sig:[{ v:"arranque", l:"Volver al proceso", p:true }] };
    return `<div class="ms-ancho--forma"><div class="ms-hecho">
      <div class="ms-hecho__tic">✓</div>
      <h1>${esc(cfg.t)}</h1>
      <p>${esc(g.detalle || "")}</p>
      ${g.codigo ? `<div class="ms-codigo" style="font-size:13px;padding:3px 10px">${esc(g.codigo)}</div>` : ""}
    </div>
    <div class="ms-lbl" style="margin-top:24px">Qué sigue</div>
    <div class="ms-sig">
      ${cfg.sig.map(x => `<button class="ms-sigb ${x.p ? "is-p" : ""}" data-accion="seguir"
        data-vista="${esc(x.v)}" data-lleva="${esc(x.lleva || "")}">
        <span class="ms-sigb__l">${esc(x.l)}</span>
        ${x.d ? `<span class="ms-sigb__d">${esc(x.d)}</span>` : ""}
        <span class="ms-sigb__f">→</span></button>`).join("")}
    </div></div>`;
  }

  /* ============================================================ CENTRO DE MANDO
     El CRM no es una capa encima de cada proceso: es la LECTURA de la
     línea de tiempo donde todos los procesos escriben. Aquí se ve la
     red entera moviéndose, y desde aquí se actúa.

     Si mañana entra un módulo nuevo, no hay que tocar esta pantalla:
     basta con que escriba sus hechos. Esa es toda la gracia. */
  function vComando() {
    const hs = M.hechos().sort((a, b) => a.cuando < b.cuando ? 1 : -1);
    const porModulo = {};
    hs.forEach(h => { const m = (I.tipoHecho(h.tipo) || {}).modulo || h.modulo;
      porModulo[m] = (porModulo[m] || 0) + 1; });
    const sinHechos = M.personas().filter(p => !M.hechosDe(p.id).length);
    const frios = M.personas().map(p => {
      const h = M.hechosDe(p.id)[0];
      if (!h) return null;
      const d = Math.round((Date.now() - new Date(h.cuando).getTime()) / 86400000);
      return d > 120 ? { p, d, h } : null;
    }).filter(Boolean).sort((a, b) => b.d - a.d);

    return `<div class="ms-ancho">` + head("Centro de mando",
      "Una sola línea de tiempo. Cada módulo escribe un hecho y sigue con lo suyo; esto es la lectura de esa línea, no una capa encima de cada proceso.") + `

    <div class="ms-kpis">
      <div class="ms-kpi"><b>${hs.length}</b><span>hechos registrados</span></div>
      <div class="ms-kpi"><b>${Object.keys(porModulo).length}</b><span>módulos alimentando</span></div>
      <div class="ms-kpi ${sinHechos.length ? "ms-kpi--ojo" : ""}"><b>${sinHechos.length}</b><span>personas sin un solo hecho</span></div>
      <div class="ms-kpi ${frios.length ? "ms-kpi--ojo" : ""}"><b>${frios.length}</b><span>sin movimiento hace 4 meses</span></div>
    </div>

    ${sinHechos.length ? `<div class="ms-alerta ms-alerta--ambar">
      <b>${sinHechos.length} persona(s) sin un solo hecho en su línea.</b>
      Si se les da un rol, se les da a ciegas: ${esc(sinHechos.map(p => p.nombre).join(", "))}.</div>` : ""}

    ${frios.length ? `<div class="ms-lbl">Se están enfriando</div>
      <table class="ms-tabla"><thead><tr><th>Persona</th><th>Último movimiento</th><th>Hace</th><th></th></tr></thead><tbody>
      ${frios.slice(0, 6).map(x => `<tr>
        <td><button class="ms-enlace ms-nom" data-accion="verpersona" data-id="${esc(x.p.id)}">${esc(x.p.nombre)}</button></td>
        <td>${esc(x.h.resumen)}</td><td class="num">${x.d} días</td>
        <td class="ms-acc-col"><button class="ms-btn ms-btn--peq" data-accion="verpersona" data-id="${esc(x.p.id)}">Ver ficha</button></td>
      </tr>`).join("")}</tbody></table>` : ""}

    <div class="ms-lbl" style="margin-top:22px">Qué módulos están alimentando la línea</div>
    <div class="ms-chips">${I.MODULOS.map(m => {
      const n = porModulo[m.codigo] || 0;
      return `<span class="ms-chip ${n ? "" : "ms-chip--veda"}">${esc(m.nombre)} · ${n}</span>`;
    }).join("")}</div>
    <div class="ms-nota">Los tachados todavía no escriben hechos. No es un defecto del CRM: es que ese
      módulo aún no está conectado. Cuando lo esté, aparece aquí sin tocar esta pantalla.</div>

    <div class="ms-lbl" style="margin-top:22px">La línea, toda la red</div>
    <ul class="ms-linea ms-linea--grande">
      ${hs.slice(0, 20).map(h => {
        const p = M.persona(h.personaId), t = I.tipoHecho(h.tipo);
        return `<li><span class="ms-linea__f">${esc(h.cuando)}</span>
          <span class="ms-chip">${esc(t ? t.modulo : h.modulo)}</span>
          <button class="ms-enlace" data-accion="verpersona" data-id="${esc(h.personaId)}">${esc(p ? p.nombre : "")}</button>
          ${esc(h.resumen)}</li>`;
      }).join("")}
    </ul></div>`;
  }

  /* ============================================================ TABLERO */
  function vTablero() {
    const asg = M.asignaciones(), per = M.personas();
    const vig = asg.filter(a => !a.hasta || a.hasta >= hoy());
    const porVencer = asg.filter(a => a.hasta && a.hasta >= hoy() && a.hasta <= new Date(Date.now()+30*864e5).toISOString().slice(0,10));
    const sinRol = per.filter(p => !vig.some(a => a.personaId === p.id));
    const n34 = vig.filter(a => a.nivelMax >= 3);
    return head("Tablero de la red", `Estado del gobierno de accesos en las ${M.sedes().length} iglesias registradas, de ${META_IGLESIAS} previstas.`) + `
    <div class="ms-kpis">
      <div class="ms-kpi"><b>${I.SEDES.length}</b><span>iglesias registradas</span></div>
      <div class="ms-kpi"><b>${per.length}</b><span>personas con ficha</span></div>
      <div class="ms-kpi"><b>${vig.length}</b><span>accesos vigentes</span></div>
      <div class="ms-kpi ${n34.length ? "ms-kpi--ojo" : ""}"><b>${n34.length}</b><span>con acceso a dato sensible (N3/N4)</span></div>
    </div>
    ${sinRol.length ? `<div class="ms-alerta ms-alerta--roja">
      <b>${sinRol.length} persona(s) sin ningún rol vigente.</b> La regla dice que sin rol vigente
      el acceso queda bloqueado: ${esc(sinRol.map(p => p.nombre).join(", "))}.</div>` : ""}
    ${porVencer.length ? `<div class="ms-alerta ms-alerta--ambar">
      <b>${porVencer.length} acceso(s) vencen en los próximos 30 días.</b> Un acceso que vence sin
      que nadie mire deja a una persona por fuera sin aviso.</div>` : ""}
    <h2 class="ms-h2">Los 12 módulos y quién los alcanza</h2>
    <table class="ms-tabla"><thead><tr>
      <th>Módulo</th><th>Dato</th><th>Roles</th><th>Acciones</th></tr></thead><tbody>
    ${I.MODULOS.map(m => {
      const roles = new Set(I.MATRIZ.filter(p => p.modulo === m.codigo).map(p => p.rol));
      const acc   = new Set(I.MATRIZ.filter(p => p.modulo === m.codigo).map(p => p.accion));
      return `<tr><td><b>${esc(m.nombre)}</b><br><code>${esc(m.codigo)}</code></td>
        <td>${pastilla(m.nivel)}</td><td>${roles.size}</td><td>${acc.size}</td></tr>`;
    }).join("")}</tbody></table>`;
  }

  /* ============================================================ ACCESOS · LISTA
     Una tarjeta por persona obliga a desplazarse para comparar dos.
     La lista deja ver veinte de un golpe, que es lo que se necesita
     para gobernar accesos. El detalle se despliega, no se navega. */
  function vAccesos() {
    const norm = x => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const q = norm(filtro || "");
    const filas = M.personas().map(p => {
      const asg = M.deLaPersona(p.id);
      const vig = asg.filter(a => !a.hasta || a.hasta >= hoy());
      return { p, asg, vig, ef: I.permisoEfectivo(asg),
               techo: vig.reduce((m, a) => Math.max(m, a.nivelMax), -1) };
    }).filter(f => !q || norm(f.p.nombre).indexOf(q) >= 0 ||
      f.vig.some(a => norm((I.rol(a.rol) || {}).nombre || a.rol).indexOf(q) >= 0));

    return `<div class="ms-ancho">` + head("Personas con acceso",
      "Otorgar agrega una fila; cerrar le pone fecha de fin. Nunca se borra ni se edita.") + `
    <div class="ms-barra">
      <input class="ms-busca" data-campo="filtro" value="${esc(filtro)}" placeholder="Buscar persona o rol…">
      <span class="ms-cuenta">${filas.length} de ${M.personas().length}</span>
      <div class="ms-barra__sp"></div>
      <button class="ms-btn ms-btn--primario" data-accion="ir" data-vista="crear">Crear acceso</button>
    </div>
    <table class="ms-lista-t"><thead><tr>
      <th style="width:26px"></th><th>Persona</th><th>Roles vigentes</th><th>Alcance</th>
      <th style="width:70px">Techo</th><th style="width:120px">Módulos</th>
      <th style="width:150px">Vigencia</th><th class="ms-acc-col">Acciones</th>
    </tr></thead><tbody>
    ${filas.length ? filas.map(f => {
      const ab = abierta === f.p.id;
      const prox = f.vig.filter(a => a.hasta).sort((x, y) => x.hasta < y.hasta ? -1 : 1)[0];
      return `<tr class="${ab ? "is-abierta" : ""}">
        <td><button class="ms-desp" data-accion="desplegar" data-id="${esc(f.p.id)}"
             title="Abrir ficha">\u203A</button></td>
        <td><button class="ms-enlace ms-nom" data-accion="verpersona" data-id="${esc(f.p.id)}">${esc(f.p.nombre)}</button>
            <span class="ms-sub">${esc(f.p.codigo || "")} \u00b7 ${esc(f.p.documento || "sin documento")}</span></td>
        <td>${f.vig.length
            ? `<div class="ms-chips">${f.vig.map(a => `<span class="ms-chip">${esc((I.rol(a.rol)||{}).nombre || a.rol)}</span>`).join("")}</div>`
            : `<span class="ms-vig ms-vig--fin">Sin rol vigente</span>`}</td>
        <td>${f.vig.length ? f.vig.map(a => `<div class="ms-sub" style="font-family:var(--ui)">${nombreAlcance(a)}</div>`).join("") : "<span class=ms-sub>—</span>"}</td>
        <td>${f.techo >= 0 ? pastilla(f.techo) : "<span class=ms-sub>—</span>"}</td>
        <td class="num">${f.ef.length ? f.ef.length + " de " + I.MODULOS.length : "<span class=ms-sub>0</span>"}</td>
        <td>${f.vig.length ? (prox ? vigencia(prox) : `<span class="ms-vig ms-vig--ok">Indefinido</span>`)
                           : `<span class="ms-vig ms-vig--fin">Bloqueado</span>`}</td>
        <td class="ms-acc-col">
          <button class="ms-btn ms-btn--peq" data-accion="verefectivo" data-id="${esc(f.p.id)}">Qué ve</button>
          <button class="ms-btn ms-btn--peq ms-btn--primario" data-accion="agregarrol" data-id="${esc(f.p.id)}">+ Rol</button>
        </td>
      </tr>
      ${ab ? `<tr class="ms-detalle"><td colspan="8">
        <div class="ms-lbl">Todas las asignaciones, incluidas las cerradas</div>
        <table class="ms-tabla ms-tabla--mini" style="margin-top:6px"><thead><tr>
          <th>Rol</th><th>Alcance</th><th>Techo</th><th>Vigencia</th><th>Acta</th><th>Otorgó</th><th></th>
        </tr></thead><tbody>
        ${f.asg.length ? f.asg.map(a => {
          const cerrada = a.hasta && a.hasta < hoy(), q2 = M.persona(a.otorgadoPor);
          return `<tr class="${cerrada ? "ms-fila--cerrada" : ""}">
            <td><b>${esc((I.rol(a.rol)||{}).nombre || a.rol)}</b></td>
            <td>${nombreAlcance(a)}</td><td>${pastilla(a.nivelMax)}</td>
            <td>${vigencia(a)}</td>
            <td>${a.acta ? `<code>${esc(a.acta)}</code>` : `<span class="ms-falta">sin acta</span>`}</td>
            <td>${esc(q2 ? q2.nombre : (a.otorgadoPor || "—"))}</td>
            <td class="ms-acc-col">${cerrada ? "" :
              `<button class="ms-btn ms-btn--peq ms-btn--peligro" data-accion="revocar" data-id="${esc(a.id)}">Cerrar</button>`}</td>
          </tr>`; }).join("")
          : `<tr><td colspan="7" class="ms-vacio">Nunca se le otorgó un acceso.</td></tr>`}
        </tbody></table></td></tr>` : ""}`;
    }).join("") : `<tr><td colspan="8" class="ms-vacio" style="padding:24px;text-align:center">Nadie coincide con la búsqueda.</td></tr>`}
    </tbody></table></div>`;
  }


  /* ============================================================ FICHA DE PERSONA
     Hacer clic en alguien no debe desplegar una fila: debe abrir su
     ficha. A la izquierda quién es; a la derecha qué puede hacer y
     por qué. Todo lo que un pastor necesita saber antes de nombrarla
     o de cerrarle el acceso, en una pantalla. */
  function iniciales(n) {
    return (n || "?").split(/\s+/).filter(w => w.length > 2).slice(0, 2)
      .map(w => w[0]).join("").toUpperCase() || "?";
  }
  function edadDe(f) {
    if (!f) return null;
    const d = new Date(f), h = new Date();
    let a = h.getFullYear() - d.getFullYear();
    const m = h.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && h.getDate() < d.getDate())) a--;
    return a >= 0 && a < 130 ? a : null;
  }
  function vPersona() {
    const id = (borrador && borrador.verPersona) || M.personas()[0].id;
    const p = M.persona(id);
    if (!p) return head("Persona", "No existe esa ficha.");
    const asg = M.deLaPersona(id);
    const vig = asg.filter(a => !a.hasta || a.hasta >= hoy());
    const cerradas = asg.filter(a => a.hasta && a.hasta < hoy());
    const ef = I.permisoEfectivo(asg);
    const conyuge = M.conyugeDe(id), hijos = M.hijosDe(id);
    const pot = M.potestad(id);
    const edad = edadDe(p.fechaNac);
    const menor = edad != null && edad < 18;

    const dato = (l, v, mono) => `<div class="ms-dato"><div class="ms-lbl">${esc(l)}</div>
      <div class="ms-val ${mono ? "mono" : ""}">${v || '<span class="ms-falta">sin registrar</span>'}</div></div>`;

    return `<div class="ms-ancho">` + `
    <div class="ms-ficha__top">
      <button class="ms-btn ms-btn--peq" data-accion="ir" data-vista="accesos">← Volver a la lista</button>
      <div class="ms-barra__sp"></div>
      <button class="ms-btn ms-btn--peq" data-accion="verefectivo2" data-id="${esc(id)}">Ver permiso detallado</button>
      <button class="ms-btn ms-btn--peq ms-btn--primario" data-accion="agregarrol" data-id="${esc(id)}">+ Otorgar rol</button>
    </div>

    <div class="ms-ficha">
      <aside class="ms-ficha__id">
        <div class="ms-foto">${p.foto
          ? `<img src="${esc(p.foto)}" alt="${esc(p.nombre)}">`
          : `<span>${esc(iniciales(p.nombre))}</span>`}</div>
        <h1>${esc(p.nombre)}</h1>
        <div class="ms-codigo">${esc(p.codigo || "sin código")}</div>
        ${menor ? `<div class="ms-alerta ms-alerta--roja" style="margin:12px 0 0">
          <b>Es menor de edad.</b> Sus datos son N4: protección reforzada y acudiente obligatorio.</div>` : ""}

        <div class="ms-lbl" style="margin-top:18px">Hoja de vida</div>
        <div class="ms-datos">
          ${dato("Documento", esc(p.documento), true)}
          ${dato("Fecha de nacimiento", p.fechaNac ? esc(p.fechaNac) + (edad != null ? ` <small>(${edad} años)</small>` : "") : "")}
          ${dato("Celular", esc(p.celular), true)}
          ${dato("Correo", esc(p.correo), true)}
          ${dato("Nacimiento en la Fe", esc(p.anioFe))}
        </div>

        <div class="ms-lbl" style="margin-top:18px">Familia</div>
        <div class="ms-datos">
          ${conyuge
            ? `<div class="ms-dato"><div class="ms-lbl">Cónyuge</div>
                 <button class="ms-enlace" data-accion="verpersona" data-id="${esc(conyuge.id)}">${esc(conyuge.nombre)}</button></div>`
            : `<div class="ms-dato"><div class="ms-lbl">Cónyuge</div><div class="ms-val"><span class="ms-falta">sin vínculo registrado</span></div></div>`}
          <div class="ms-dato"><div class="ms-lbl">Hijos (${hijos.length})</div>
            <div class="ms-val">${hijos.length
              ? hijos.map(h => `<button class="ms-enlace" data-accion="verpersona" data-id="${esc(h.id)}">${esc(h.nombre)}</button>`).join(" · ")
              : '<span class="ms-falta">ninguno registrado</span>'}</div></div>
        </div>
      </aside>

      <section class="ms-ficha__acc">
        <div class="ms-kpis">
          <div class="ms-kpi"><b>${vig.length}</b><span>roles vigentes</span></div>
          <div class="ms-kpi"><b>${ef.length}</b><span>de ${I.MODULOS.length} módulos</span></div>
          <div class="ms-kpi ${vig.some(a => a.nivelMax >= 3) ? "ms-kpi--ojo" : ""}">
            <b>${vig.length ? "N" + Math.max.apply(null, vig.map(a => a.nivelMax)) : "—"}</b><span>techo alcanzado</span></div>
          <div class="ms-kpi ${pot.puede ? "ms-kpi--ojo" : ""}"><b>${pot.puede ? "Sí" : "No"}</b><span>puede nombrar a otros</span></div>
        </div>

        ${!vig.length ? `<div class="ms-alerta ms-alerta--roja">
          <b>Hoy no tiene acceso.</b> ${cerradas.length
            ? `Tuvo ${cerradas.length} asignación(es) que ya cerraron. Sin rol vigente, el acceso queda bloqueado.`
            : "Nunca se le otorgó ninguno."}</div>` : ""}

        <div class="ms-lbl">Roles vigentes</div>
        ${vig.length ? vig.map(a => {
          const r = I.rol(a.rol);
          return `<div class="ms-rolcard">
            <div class="ms-rolcard__c">
              <b>${esc(r ? r.nombre : a.rol)}</b>
              <div class="ms-sub" style="font-family:var(--ui)">${nombreAlcance(a)}</div>
            </div>
            <div>${pastilla(a.nivelMax)}</div>
            <div>${vigencia(a)}</div>
            <div>${a.acta ? `<code>${esc(a.acta)}</code>` : `<span class="ms-falta">sin acta</span>`}</div>
            <div class="ms-rolcard__a">
              <label class="ms-opt ${a.delega ? "is-on" : ""}" style="padding:2px 8px" title="Potestad de nombrar y cerrar accesos dentro de su alcance">
                <input type="checkbox" ${a.delega ? "checked" : ""} data-delega="${esc(a.id)}">
                <div><b style="font-size:11.5px">Puede nombrar</b></div></label>
              <button class="ms-btn ms-btn--peq" data-accion="afinar" data-id="${esc(a.id)}">Afinar</button>
              <button class="ms-btn ms-btn--peq" data-accion="promover" data-id="${esc(a.id)}">Cambiar rol</button>
              <button class="ms-btn ms-btn--peq ms-btn--peligro" data-accion="revocar" data-id="${esc(a.id)}">Cerrar</button>
            </div>
          </div>`;
        }).join("") : ""}

        <div class="ms-lbl" style="margin-top:20px">Qué panel abre</div>
        ${(() => {
          const pn = I.panelesDe(asg, (sid, mod) => M.moduloActivo(sid, mod));
          if (!pn.length) return `<div class="ms-nota">Ningún panel. Sin rol vigente no hay pantalla que abrir.</div>`;
          return `<div class="ms-modgrid">${pn.map(x => {
            const sd = x.asignacion.alcanceId && M.sedes().find(z => z.id === x.asignacion.alcanceId);
            return `<div class="ms-panelc ${x.abre ? "is-on" : ""}">
              <div class="ms-panelc__c">
                <b>${esc(x.nombre)}</b>
                <span class="ms-sub">${sd ? esc(sd.nombre) : esc((I.alcance(x.asignacion.alcanceTipo)||{}).nombre || "")}</span>
              </div>
              ${x.abre
                ? `<button class="ms-btn ms-btn--peq ms-btn--primario" data-accion="abrirpanel" data-url="${esc(x.url)}" data-lbl="${esc(x.nombre)}" data-persona="${esc(id)}">Entrar</button>`
                : `<span class="ms-vig ms-vig--fin">${esc(x.razon || "sin acceso")}</span>`}
              ${x.crea && x.crea.length ? `<div class="ms-panelc__crea">Desde ahí crea: ${esc(x.crea.join(", "))}</div>` : ""}
            </div>`;
          }).join("")}</div>`;
        })()}

        <div class="ms-lbl" style="margin-top:20px">Qué puede hacer hoy</div>
        ${ef.length ? `<div class="ms-modgrid">
          ${ef.map(x => `<div class="ms-modmini">
            <div class="ms-modmini__c"><b>${esc(x.nombre)}</b> ${pastilla(x.nivelModulo)}</div>
            <div class="ms-chips">${x.acciones.slice(0, 6).map(ac => `<span class="ms-chip ms-chip--acc">${esc(ac)}</span>`).join("")}
              ${x.acciones.length > 6 ? `<span class="ms-chip">+${x.acciones.length - 6}</span>` : ""}</div>
          </div>`).join("")}</div>`
          : `<div class="ms-nota">Ningún módulo alcanzable hoy.</div>`}

        ${cerradas.length ? `<div class="ms-lbl" style="margin-top:20px">Historial cerrado (${cerradas.length})</div>
          <table class="ms-tabla ms-tabla--mini"><thead><tr><th>Rol</th><th>Alcance</th><th>Cerró</th></tr></thead><tbody>
          ${cerradas.map(a => `<tr class="ms-fila--cerrada"><td>${esc((I.rol(a.rol)||{}).nombre || a.rol)}</td>
            <td>${nombreAlcance(a)}</td><td>${esc(a.hasta)}</td></tr>`).join("")}</tbody></table>` : ""}
      </section>
    </div></div>`;
  }

  /* ============================================================ CREAR ACCESO */
  function vCrear() {
    const b = b_();
    b.sel = b.sel || {};                 // { rol: {alcanceTipo, alcanceId, nivelMax, acta} }
    const puede = I.rolesQuePuedeCrear(YO.rol);
    const marcados = Object.keys(b.sel);

    /* Al marcar un rol, arranca con SU alcance sugerido y SU techo. Así
       marcar cinco roles no obliga a configurar cinco veces lo mismo. */
    const filas = marcados.map(cod => {
      const r = I.rol(cod), cfg = b.sel[cod];
      const al = I.alcance(cfg.alcanceTipo);
      const fuente = al && al.exigeId
        ? (al.fuente === "ministerios" ? M.ministerios().map(m => ({ id:m.codigo, nombre:m.nombre }))
          : al.fuente === "sedes" ? M.sedes() : [])
        : [];
      return `<div class="ms-rolfila">
        <div class="ms-rolfila__n"><b>${esc(r ? r.nombre : cod)}</b> ${pastilla(r ? r.techo : 0)}
          <button class="ms-x" data-accion="quitarol" data-cod="${esc(cod)}" title="Quitar">×</button></div>
        <label class="ms-campo" style="margin:0"><span>Alcance</span>
          <select data-rolcfg="${esc(cod)}" data-campo2="alcanceTipo">
          ${I.ALCANCES.map(x => `<option value="${esc(x.codigo)}" ${cfg.alcanceTipo === x.codigo ? "selected" : ""}>${esc(x.nombre)}</option>`).join("")}
          </select></label>
        <label class="ms-campo" style="margin:0"><span>${al && al.exigeId ? "¿Cuál?" : "—"}</span>
          ${al && al.exigeId
            ? `<select data-rolcfg="${esc(cod)}" data-campo2="alcanceId"><option value="">Elegir…</option>
               ${fuente.map(f => `<option value="${esc(f.id)}" ${cfg.alcanceId === f.id ? "selected" : ""}>${esc(f.nombre)}</option>`).join("")}
               </select>`
            : `<input disabled value="no lleva">`}</label>
        <label class="ms-campo" style="margin:0"><span>Nivel</span>
          <select data-rolcfg="${esc(cod)}" data-campo2="nivelMax">
          ${I.NIVELES.filter(n => n.nivel <= (r ? r.techo : 4) && n.nivel <= YO.techo)
            .map(n => `<option value="${n.nivel}" ${cfg.nivelMax === n.nivel ? "selected" : ""}>N${n.nivel}</option>`).join("")}
          </select></label>
        <label class="ms-campo" style="margin:0"><span>Acta ${cfg.nivelMax >= 3 ? '<b class="ms-req">obligatoria</b>' : ""}</span>
          <input data-rolcfg="${esc(cod)}" data-campo2="acta" value="${esc(cfg.acta || "")}" placeholder="ACTA-…"></label>
      </div>`;
    }).join("");

    const lista = marcados.map(cod => Object.assign({
      personaId: b.personaId || (b.nuevaPersona ? "nueva" : ""), rol:cod,
      desde: b.desde || hoy(), hasta: b.hasta || null }, b.sel[cod]));
    const fallos = [];
    if (!b.personaId && !b.nuevaPersona) fallos.push("Falta decir a quién se le otorga.");
    if (!marcados.length) fallos.push("Marque al menos un rol.");
    lista.forEach(a => { const v = I.validarAsignacion(a, YO);
      if (!v.ok) { const r = I.rol(a.rol);
        v.fallos.forEach(f => { const t = `${r ? r.nombre : a.rol}: ${f}`;
          if (f.indexOf("a quién") < 0 && fallos.indexOf(t) < 0) fallos.push(t); }); } });

    return `<div class="ms-ancho--lectura">` + head("Otorgar roles",
      `Usted otorga como <b>${esc(I.rol(YO.rol).nombre)}</b>, techo ${pastilla(YO.techo)}. Puede dar <b>varios roles a la vez</b>: una persona puede ser Consejero y Coordinador de Nuevos, o Pastor General y Director de RocaKids.`) + `

      <section class="ms-paso"><h3><i>1</i> ¿A quién?</h3>
        <div class="ms-fila2">
          <label class="ms-campo"><span>Persona que ya existe</span>
            <select data-campo="personaId"><option value="">Elegir…</option>
            ${M.personas().map(p => `<option value="${esc(p.id)}" ${b.personaId === p.id ? "selected" : ""}>${esc(p.nombre)}${p.codigo ? " · " + esc(p.codigo) : ""}</option>`).join("")}
            </select></label>
          <label class="ms-campo"><span>…o crear una ficha nueva</span>
            <input data-campo="nuevaPersona" value="${esc(b.nuevaPersona || "")}" placeholder="Nombre completo"></label>
        </div>
      </section>

      ${(() => {
        const pid = b.personaId; if (!pid) return "";
        const c = M.contextoPara(pid); if (!c) return "";
        return `<section class="ms-paso ms-paso--ctx">
          <h3><i>·</i> Lo que el CRM sabe de ${esc(c.persona.nombre)}</h3>
          <p class="ms-sub" style="font-family:var(--ui);margin:0 0 12px">
            Nadie debería nombrar a alguien a ciegas. Esto sale de la línea de tiempo.</p>
          <div class="ms-ctxkpis">
            <div><b>${c.meses != null ? c.meses : "—"}</b><span>meses en la iglesia</span></div>
            <div><b>${c.hechos.length}</b><span>hechos</span></div>
            <div><b>${c.cursos.length}</b><span>cursos</span></div>
            <div><b>${c.rolesVigentes.length}</b><span>roles vigentes</span></div>
          </div>
          ${c.señales.map(x => `<div class="ms-senal ms-senal--${esc(x.t)}">${esc(x.txt)}</div>`).join("")}
        </section>`;
      })()}

      <section class="ms-paso"><h3><i>2</i> ¿Qué roles? <small style="font-weight:400;color:var(--tin-dim)">selección múltiple</small></h3>
        <div class="ms-sel">
          ${I.ROLES.filter(x => puede.indexOf(x.codigo) >= 0).map(x => {
            const on = !!b.sel[x.codigo];
            const alto = x.techo >= 4;
            return `<label class="ms-opt ${on ? "is-on" : ""}">
              <input type="checkbox" ${on ? "checked" : ""} data-selrol="${esc(x.codigo)}">
              <div><b>${esc(x.nombre)}</b><small>techo N${x.techo}${alto ? " · toca menores" : ""} · alcance ${esc((I.alcance(x.alcanceMax)||{}).nombre || x.alcanceMax || "")}</small></div></label>`;
          }).join("")}
        </div>
      </section>

      ${marcados.length ? `<section class="ms-paso"><h3><i>3</i> Cómo queda cada rol</h3>
        <p class="ms-sub" style="font-family:var(--ui);margin:0 0 12px">
          Cada rol arranca con SU alcance sugerido y SU techo. No se fuerza uno común: un consejero
          va por «solo sus casos» y un coordinador por «una sede», y mezclarlos rompería la regla
          que impide que el consejero vea todos los casos de su sede.</p>
        ${filas}
      </section>` : ""}

      <section class="ms-paso"><h3><i>4</i> Vigencia</h3>
        <div class="ms-fila2">
          <label class="ms-campo"><span>Desde</span><input type="date" data-campo="desde" value="${esc(b.desde || hoy())}"></label>
          <label class="ms-campo"><span>Hasta (vacío = indefinido)</span><input type="date" data-campo="hasta" value="${esc(b.hasta || "")}"></label>
        </div>
        ${!b.hasta ? `<div class="ms-nota ms-nota--ojo">Un acceso indefinido no se revisa nunca. Para roles de dato sensible conviene ponerle fecha.</div>` : ""}
      </section>

      ${marcados.some(c => (I.rol(c) || {}).techo >= 4) && b.personaId ? (() => {
        const c = M.contextoPara(b.personaId);
        return `<div class="ms-alerta ms-alerta--roja">
          <b>Hay un rol que toca datos de menores (N4).</b>
          ${c && c.antecedentes ? "Hay antecedentes en su línea de tiempo: verifique que sigan vigentes."
            : "No hay ningún registro de antecedentes verificados en su línea de tiempo."}</div>`;
      })() : ""}

      ${fallos.length
        ? `<div class="ms-alerta ms-alerta--roja"><b>Falta:</b><ul>${fallos.map(f => `<li>${esc(f)}</li>`).join("")}</ul></div>`
        : `<div class="ms-alerta ms-alerta--verde"><b>Listo.</b> Se otorgarán ${marcados.length} rol(es) en un solo acto. Si uno fallara, no se otorga ninguno.</div>`}
      <div class="ms-acciones">
        <button class="ms-btn ms-btn--primario" data-accion="otorgar" ${fallos.length ? "disabled" : ""}>
          Otorgar ${marcados.length || ""} rol${marcados.length === 1 ? "" : "es"}</button>
        <button class="ms-btn" data-accion="limpiar">Limpiar</button>
      </div></div>`;
  }

  /* ============================================================ SELECTOR DE PERMISOS
     El MISMO componente en un rol, en un ministerio y en un equipo.
     Tres niveles, no quince acciones. Si una pantalla usara palabras
     distintas de otra, nadie entendería el sistema.

     `techo` recorta lo que se puede ofrecer: un módulo por encima del
     techo sale vedado y no se puede marcar. */
  function selectorPermisos(permisos, techo, campo, modsVisibles) {
    permisos = permisos || {};
    const mods = (modsVisibles && modsVisibles.length)
      ? I.MODULOS.filter(m => modsVisibles.indexOf(m.codigo) >= 0)
      : I.MODULOS;
    const n = Object.keys(permisos).filter(k => permisos[k]).length;
    return `
    <div class="ms-permsel">
      <div class="ms-permsel__cab">
        <span class="ms-lbl" style="margin:0">Módulo</span>
        ${I.NIVELES_ACCESO.map(x => `<span class="ms-lbl" style="margin:0;text-align:center" title="${esc(x.ayuda)}">${esc(x.nombre)}</span>`).join("")}
        <span class="ms-lbl" style="margin:0;text-align:center">Sin acceso</span>
      </div>
      ${mods.map(m => {
        const vedado = m.nivel > techo;
        const act = permisos[m.codigo] || null;
        return `<div class="ms-permsel__f ${vedado ? "is-veda" : ""}">
          <div class="ms-permsel__m"><b>${esc(m.nombre)}</b> ${pastilla(m.nivel)}
            ${vedado ? `<span class="ms-porque">fuera del techo N${techo}</span>` : ""}</div>
          ${I.NIVELES_ACCESO.map(x => `
            <label class="ms-radio ${act === x.codigo ? "is-on" : ""}" title="${esc(x.ayuda)}">
              <input type="radio" name="${esc(campo)}_${esc(m.codigo)}" ${act === x.codigo ? "checked" : ""}
                ${vedado ? "disabled" : ""} data-perm-campo="${esc(campo)}"
                data-perm-mod="${esc(m.codigo)}" data-perm-niv="${esc(x.codigo)}"></label>`).join("")}
          <label class="ms-radio ${!act ? "is-on" : ""}" title="Sin acceso a este módulo">
            <input type="radio" name="${esc(campo)}_${esc(m.codigo)}" ${!act ? "checked" : ""}
              ${vedado ? "disabled" : ""} data-perm-campo="${esc(campo)}"
              data-perm-mod="${esc(m.codigo)}" data-perm-niv=""></label>
        </div>`;
      }).join("")}
      <div class="ms-permsel__pie">
        <span class="ms-cuenta">${n} módulo(s) con acceso</span>
        <div class="ms-barra__sp"></div>
        ${I.NIVELES_ACCESO.map(x => `<button class="ms-btn ms-btn--peq" data-accion="perm-todos"
          data-campo="${esc(campo)}" data-niv="${esc(x.codigo)}">Todo a «${esc(x.nombre.toLowerCase())}»</button>`).join("")}
        <button class="ms-btn ms-btn--peq" data-accion="perm-todos" data-campo="${esc(campo)}" data-niv="">Ninguno</button>
      </div>
    </div>`;
  }

  /* ============================================================ FORMULARIOS DE CREACIÓN
     Un patrón para todos: campos arriba, la consecuencia visible
     abajo, y el botón deshabilitado hasta que la base lo aceptaría.
     Nunca se deja pulsar algo que va a fallar. */
  function b_() { return (borrador = borrador || {}); }
  function selPersona(campo, etiqueta, ayuda) {
    const b = b_();
    return `<label class="ms-campo"><span>${esc(etiqueta)} <b class="ms-req">obligatorio</b></span>
      <select data-campo="${campo}"><option value="">Elegir persona…</option>
      ${M.personas().map(x => `<option value="${esc(x.id)}" ${b[campo] === x.id ? "selected" : ""}>${esc(x.nombre)}</option>`).join("")}
      </select></label>
      <label class="ms-campo"><span>…o crear la ficha aquí mismo</span>
        <input data-campo="${campo}_nueva" value="${esc(b[campo + "_nueva"] || "")}" placeholder="Nombre completo"></label>
      ${ayuda ? `<div class="ms-nota">${esc(ayuda)}</div>` : ""}`;
  }
  function selSede(campo, etiqueta) {
    const b = b_();
    return `<label class="ms-campo"><span>${esc(etiqueta)} <b class="ms-req">obligatorio</b></span>
      <select data-campo="${campo}"><option value="">Elegir iglesia…</option>
      ${M.sedes().map(x => `<option value="${esc(x.id)}" ${b[campo] === x.id ? "selected" : ""}>${esc(x.nombre)}</option>`).join("")}
      </select></label>`;
  }
  function pie(fallos, textoBtn, accion) {
    return `${fallos.length
      ? `<div class="ms-alerta ms-alerta--roja"><b>Falta para poder crear:</b><ul>${fallos.map(f => `<li>${esc(f)}</li>`).join("")}</ul></div>`
      : `<div class="ms-alerta ms-alerta--verde"><b>Listo.</b> La base aceptaría esto.</div>`}
      <div class="ms-acciones">
        <button class="ms-btn ms-btn--primario" data-accion="${accion}" ${fallos.length ? "disabled" : ""}>${esc(textoBtn)}</button>
        <button class="ms-btn" data-accion="limpiar">Limpiar</button>
      </div>`;
  }

  /* ---------- PERSONA ----------
     El formulario se GENERA de `MSTORE.FICHA`, que es la copia exacta
     de las columnas de `nucleo.personas`. Una sola fuente de verdad: si
     mañana entra una columna nueva en la base, aparece aquí sola.

     Ese es el arreglo del defecto que encontró Daniel: el formulario
     pedía tres cosas y la ficha mostraba nueve en «sin registrar»,
     porque cada uno tenía su propia lista. */
  function campoFicha(c, pref) {
    const b = b_(), k = (pref || "") + c.k, v = b[k] || "";
    const req = c.req ? ' <b class="ms-req">obligatorio</b>' : "";
    const niv = c.n != null ? " " + pastilla(c.n) : "";
    let control;
    if (c.opciones) {
      control = `<select data-campo="${esc(k)}"><option value="">Elegir…</option>
        ${c.opciones.map(o => { const val = Array.isArray(o) ? o[0] : o, txt = Array.isArray(o) ? o[1] : o;
          return `<option value="${esc(val)}" ${v === val ? "selected" : ""}>${esc(txt)}</option>`; }).join("")}
        </select>`;
    } else if (c.k === "sedeId") {
      control = `<select data-campo="${esc(k)}"><option value="">Elegir iglesia…</option>
        ${M.sedes().map(x => `<option value="${esc(x.id)}" ${v === x.id ? "selected" : ""}>${esc(x.nombre)} · ${esc(x.codigo || "")}</option>`).join("")}
        </select>`;
    } else {
      control = `<input type="${esc(c.tipo || "text")}" data-campo="${esc(k)}" value="${esc(v)}">`;
    }
    return `<label class="ms-campo"><span>${esc(c.l)}${req}${niv}</span>${control}
      ${c.ayuda ? `<small class="ms-ayuda">${esc(c.ayuda)}</small>` : ""}</label>`;
  }
  function grupoFicha(grupo, pref) {
    const cs = M.FICHA.filter(c => c.g === grupo);
    if (!cs.length) return "";
    return `<div class="ms-grupo"><div class="ms-lbl">${esc(grupo)}</div>
      <div class="ms-grid-campos">${cs.map(c => campoFicha(c, pref)).join("")}</div></div>`;
  }

  function vNPersona() {
    const b = b_();
    const f = M.validarFicha(b, "Ficha");
    const grupos = [...new Set(M.FICHA.map(c => c.g))];
    return `<div class="ms-ancho--lectura">` + head("Crear persona",
      "Los campos son exactamente las columnas de <code>nucleo.personas</code> en el backend. Lo que se llena aquí es lo que se verá en su ficha, sin sorpresas.") + `
      <div class="ms-paso">
        ${grupos.map(g => grupoFicha(g)).join("")}
      </div>
      <div class="ms-nota">La ficha por sí sola no da acceso a nada. El acceso se otorga después,
        o al crear la iglesia, el ministerio o el equipo donde va a servir.</div>
      ` + pie(f, "Crear persona", "hacer-persona") + `</div>`;
  }

  /* ---------- IGLESIA ---------- */
  function vNIglesia() {
    const b = b_(), f = [];
    if (!b.nombre) f.push("El nombre de la iglesia.");
    if (!b.plantilla) f.push("La plantilla: define qué módulos verá esta iglesia.");
    if (!b.pastorId && !b.pastorId_nueva) f.push("Su pastor. Una iglesia no se crea sin pastor.");
    /* ⛔ REGLA DE LA IGLESIA: nunca se nombra un pastor solo. El motor ya
       la exigía en `crearIglesia`, pero el formulario no ofrecía dónde
       poner a la esposa, así que la creación fallaba siempre salvo que
       la persona ya tuviera el vínculo CONYUGE registrado. */
    if (!b.esposaId && !b.esposaId_nueva) f.push("Su esposa. Los pastores se nombran en matrimonio, nunca uno solo.");
    if (b.pastorId && b.esposaId && b.pastorId === b.esposaId)
      f.push("El pastor y su esposa no pueden ser la misma persona.");
    const mods = b.plantilla ? I.modulosDePlantilla(b.plantilla) : [];
    return `<div class="ms-ancho--lectura">` + head("Crear iglesia",
      "Tres cosas y queda operando: cómo se llama, qué plantilla usa y quién la pastorea.") + `
      <div class="ms-paso"><h3><i>1</i> Identidad</h3>
        <label class="ms-campo"><span>Nombre <b class="ms-req">obligatorio</b></span>
          <input data-campo="nombre" value="${esc(b.nombre || "")}" placeholder="Bogotá Norte"></label>
        <div class="ms-fila2">
          <label class="ms-campo"><span>Ciudad</span>
            <input data-campo="ciudad" value="${esc(b.ciudad || "")}" placeholder="Bogotá"></label>
          <label class="ms-campo"><span>País</span>
            <select data-campo="pais">
              <option value="CO" ${b.pais === "CO" || !b.pais ? "selected" : ""}>Colombia</option>
              <option value="ES" ${b.pais === "ES" ? "selected" : ""}>España</option>
              <option value="US" ${b.pais === "US" ? "selected" : ""}>Estados Unidos</option>
              <option value="PA" ${b.pais === "PA" ? "selected" : ""}>Panamá</option>
            </select></label>
        </div>
      </div>

      <div class="ms-paso"><h3><i>2</i> Plantilla</h3>
        <p class="ms-sub" style="font-family:var(--ui);margin:0 0 12px">
          Aquí se decide qué ve esta iglesia. No todas son iguales: una plantación arranca con lo
          mínimo y crece cuando se consolida.</p>
        <div class="ms-plant">
          ${I.PLANTILLAS.map(pl => {
            const n = I.modulosDePlantilla(pl.codigo).length;
            return `<button class="ms-plantc ${b.plantilla === pl.codigo ? "is-on" : ""}"
              data-accion="plantilla" data-cod="${esc(pl.codigo)}" style="text-align:left;cursor:pointer;font:inherit">
              <h4>${esc(pl.nombre)}</h4><p>${esc(pl["desc"] || "")}</p>
              <span class="ms-plantc__n">${n} de ${I.MODULOS.length} módulos</span></button>`;
          }).join("")}
        </div>
        ${b.plantilla ? `<div class="ms-lbl">Con esta plantilla verá</div>
          <div class="ms-chips">${I.MODULOS.map(m => mods.indexOf(m.codigo) >= 0
            ? `<span class="ms-chip">${esc(m.nombre)} ${pastilla(m.nivel)}</span>`
            : `<span class="ms-chip ms-chip--veda">${esc(m.nombre)}</span>`).join("")}</div>
          <div class="ms-nota">Lo tachado se puede encender después desde <b>Qué ve cada iglesia</b>.
            Los módulos de dato sensible piden evidencia legal para encenderse.</div>` : ""}
      </div>

      <div class="ms-paso"><h3><i>3</i> Sus pastores</h3>
        <p class="ms-sub" style="font-family:var(--ui);margin:0 0 12px">
          En Casa Sobre la Roca los pastores se nombran en matrimonio. Nunca se nombra un pastor
          solo, así que aquí van los dos y los dos quedan con el mismo acceso.</p>
        ${selPersona("pastorId", "Pastor congregacional",
          "Queda nombrado en el mismo acto, con alcance de esta sede y el techo que le da el catálogo de roles. La base lo exige: una sede sin pastor no existe.")}
        ${selPersona("esposaId", "Esposa del pastor",
          "Queda nombrada en el mismo acto y con el mismo acceso que él.")}
      </div>` + pie(f, "Crear iglesia y nombrar a sus pastores", "hacer-iglesia") + `</div>`;
  }

  /* ---------- MINISTERIO ---------- */
  function vNMinisterio() {
    const b = b_(), f = [];
    if (!b.nombre) f.push("El nombre del ministerio.");
    if (!b.sedeId) f.push("La iglesia a la que pertenece.");
    if (!b.liderId && !b.liderId_nueva) f.push("Su director. Un ministerio no se crea sin alguien a cargo.");
    if (!Object.keys(b.permisos || {}).some(k => b.permisos[k]))
      f.push("Al menos un módulo con acceso. Un ministerio que no puede ver nada no sirve de nada.");
    return `<div class="ms-ancho--forma">` + head("Crear ministerio",
      "RocaKids, tMt, Mujer Integral, Hombres de Bien. Cada uno pertenece a una iglesia y tiene alguien al frente.") + `
      <div class="ms-paso"><h3><i>1</i> Qué y dónde</h3>
        <label class="ms-campo"><span>Nombre <b class="ms-req">obligatorio</b></span>
          <input data-campo="nombre" value="${esc(b.nombre || "")}" placeholder="Mujer Integral"></label>
        ${selSede("sedeId", "Iglesia")}
      </div>
      <div class="ms-paso"><h3><i>2</i> Qué puede hacer este ministerio</h3>
        <p class="ms-sub" style="font-family:var(--ui);margin:0 0 12px">
          Los mismos tres niveles que en cualquier otra parte del sistema. Es lo que podrán hacer
          quienes sirvan aquí.</p>
        ${selectorPermisos(b.permisos, b.techo != null ? +b.techo : 2, "permisos")}
        <label class="ms-campo" style="margin-top:12px"><span>Techo del ministerio</span>
          <select data-campo="techo">
            ${I.NIVELES.map(n => `<option value="${n.nivel}" ${(b.techo != null ? +b.techo : 2) === n.nivel ? "selected" : ""}>N${n.nivel} · ${esc(n["desc"])}</option>`).join("")}
          </select></label>
      </div>

      <div class="ms-paso"><h3><i>3</i> Quién lo dirige</h3>
        ${selPersona("liderId", "Director del ministerio",
          "Queda nombrado en el mismo acto, con alcance de este ministerio. Un ministerio sin nadie al frente es una carpeta que nadie revisa, y el día que hay un problema con un menor no hay a quién preguntarle.")}
        ${b.nombre && /roca|kid|nin|niñ/i.test(b.nombre) ? `<div class="ms-nota ms-nota--ojo">
          Este ministerio parece de menores. Los módulos de menores son <b>N4</b>: exigen antecedentes
          verificados y vigentes para servir, y acta de respaldo para el acceso.</div>` : ""}
      </div>` + pie(f, "Crear ministerio y nombrar a su director", "hacer-ministerio") + `</div>`;
  }

  /* ---------- EQUIPO ---------- */
  function vNEquipo() {
    const b = b_(), f = [];
    const roles = b.roles || [];
    const local = (b.ambito || "local") === "local";
    if (!b.nombre) f.push("El nombre del equipo.");
    if (!roles.length) f.push("Al menos un rol. Un equipo sin roles no otorga nada.");
    if (local && !b.sedeId) f.push("La iglesia, o márquelo como corporativo.");
    if (!b.liderId && !b.liderId_nueva) f.push("Su responsable.");
    return `<div class="ms-ancho--lectura">` + head("Crear equipo administrativo",
      "Un equipo no es un rol: es un conjunto de roles que se otorgan juntos. Sirve para no repetir cuatro veces la misma asignación.") + `
      <div class="ms-paso"><h3><i>1</i> Qué equipo</h3>
        <label class="ms-campo"><span>Nombre <b class="ms-req">obligatorio</b></span>
          <input data-campo="nombre" value="${esc(b.nombre || "")}" placeholder="Tesorería Bogotá Chicó"></label>
        <label class="ms-campo"><span>Ámbito</span>
          <div class="ms-seg">
            <button data-accion="ambito" data-v="local" class="${local ? "is-on" : ""}">Local, de una iglesia</button>
            <button data-accion="ambito" data-v="corporativo" class="${!local ? "is-on" : ""}">Corporativo, de toda la red</button>
          </div></label>
        ${local ? selSede("sedeId", "Iglesia") : `<div class="ms-nota">Un equipo corporativo alcanza TODAS las iglesias de la red. Úselo solo para Contable, Legal y Tecnología.</div>`}
        ${I.EQUIPOS.length ? `<div class="ms-lbl" style="margin-top:12px">Atajos de los 8 equipos del back-office</div>
          <div class="ms-chips">${I.EQUIPOS.map(e => `<button class="ms-chip" style="cursor:pointer"
            data-accion="equipo-atajo" data-cod="${esc(e.codigo)}">${esc(e.nombre)}</button>`).join("")}</div>` : ""}
      </div>

      <div class="ms-paso"><h3><i>2</i> Qué puede hacer este equipo</h3>
        <p class="ms-sub" style="font-family:var(--ui);margin:0 0 12px">
          Los mismos tres niveles que en un rol o en un ministerio. Vocabulario único en todo el sistema.</p>
        ${selectorPermisos(b.permisos, b.techo != null ? +b.techo : 3, "permisos")}
        <label class="ms-campo" style="margin-top:12px"><span>Techo del equipo</span>
          <select data-campo="techo">
            ${I.NIVELES.map(n => `<option value="${n.nivel}" ${(b.techo != null ? +b.techo : 3) === n.nivel ? "selected" : ""}>N${n.nivel} · ${esc(n["desc"])}</option>`).join("")}
          </select></label>

        <div class="ms-lbl" style="margin-top:16px">Roles que otorga al responsable</div>
        <div class="ms-sel">
          ${M.rolesTodos().map(r => {
            const on = roles.indexOf(r.codigo) >= 0;
            return `<label class="ms-opt ${on ? "is-on" : ""}">
              <input type="checkbox" data-rol="${esc(r.codigo)}" ${on ? "checked" : ""}>
              <div><b>${esc(r.nombre)}</b><small>techo N${r.techo}</small></div></label>`;
          }).join("")}
        </div>
      </div>

      <div class="ms-paso"><h3><i>3</i> Quién responde</h3>
        ${selPersona("liderId", "Responsable del equipo",
          "Recibe todos los roles marcados en el mismo acto.")}
      </div>` + pie(f, "Crear equipo y nombrar a su responsable", "hacer-equipo") + `</div>`;
  }

  /* ---------- ROL ---------- */
  function vNRol() {
    const b = b_(), f = [];
    if (!b.nombre) f.push("El nombre del rol.");
    if (b.techo == null) f.push("El techo: la sensibilidad máxima que alcanzará.");
    return `<div class="ms-ancho--forma">` + head("Crear rol",
      "El catálogo es extensible a propósito: cada módulo nuevo trae sus roles. Lo que no cambia nunca es el techo.") + `
      <div class="ms-paso">
        <label class="ms-campo"><span>Nombre <b class="ms-req">obligatorio</b></span>
          <input data-campo="nombre" value="${esc(b.nombre || "")}" placeholder="Líder de Oración"></label>
        <label class="ms-campo"><span>Techo de sensibilidad <b class="ms-req">obligatorio</b></span></label>
        <div class="ms-niveles">
          ${I.NIVELES.map(n => `<button class="ms-nivbtn ${b.techo === n.nivel ? "is-on" : ""}"
            data-accion="techo" data-n="${n.nivel}">${pastilla(n.nivel)}<span>${esc(n["desc"])}</span></button>`).join("")}
        </div>
        ${b.techo != null ? `<div class="ms-nota">Con techo N${b.techo} este rol podrá alcanzar
          <b>${I.MODULOS.filter(m => m.nivel <= b.techo).length}</b> de los ${I.MODULOS.length} módulos.
          Los demás le quedan vedados para siempre: el techo no se negocia por asignación.</div>` : ""}
      </div>` + pie(f, "Crear rol", "hacer-rol") + `</div>`;
  }

  /* ---------- MÓDULO ---------- */
  function vNModulo() {
    const b = b_(), f = [];
    if (!b.nombre) f.push("El nombre del módulo.");
    if (b.nivel == null) f.push("El nivel del dato que maneja.");
    return `<div class="ms-ancho--forma">` + head("Crear módulo",
      "Un módulo nuevo declara qué dato maneja. De ese nivel sale, automáticamente, qué roles pueden alcanzarlo.") + `
      <div class="ms-paso">
        <label class="ms-campo"><span>Nombre <b class="ms-req">obligatorio</b></span>
          <input data-campo="nombre" value="${esc(b.nombre || "")}" placeholder="Peticiones de oración"></label>
        <label class="ms-campo"><span>Nivel del dato <b class="ms-req">obligatorio</b></span></label>
        <div class="ms-niveles">
          ${I.NIVELES.map(n => `<button class="ms-nivbtn ${b.nivel === n.nivel ? "is-on" : ""}"
            data-accion="nivelmod" data-n="${n.nivel}">${pastilla(n.nivel)}<span>${esc(n["desc"])}</span></button>`).join("")}
        </div>
        ${b.nivel != null ? `<div class="ms-nota">Con dato N${b.nivel}, solo los roles con techo N${b.nivel}
          o mayor podrán recibir permisos aquí: <b>${M.rolesTodos().filter(r => r.techo >= b.nivel).length}</b>
          de ${M.rolesTodos().length} roles.
          ${b.nivel >= 3 ? " Además activa cifrado, bitácora de lectura y enmascarado." : ""}</div>` : ""}
      </div>` + pie(f, "Crear módulo", "hacer-modulo") + `</div>`;
  }


  /* ============================================================ ROLES */
  function vRoles() {
    return head("Roles y techos",
      "El techo es la sensibilidad máxima que el rol alcanza. No cambia por asignación: es del rol.") + `
    <table class="ms-tabla"><thead><tr><th>Rol</th><th>Techo</th><th>Módulos que alcanza</th><th>Puede crear</th></tr></thead><tbody>
    ${I.ROLES.map(r => {
      const mods = I.MODULOS.filter(m => I.MATRIZ.some(p => p.rol === r.codigo && p.modulo === m.codigo));
      const crea = I.rolesQuePuedeCrear(r.codigo);
      return `<tr>
        <td><b>${esc(r.nombre)}</b><br><code>${esc(r.codigo)}</code></td>
        <td>${pastilla(r.techo)}</td>
        <td><div class="ms-chips">${mods.map(m => `<span class="ms-chip">${esc(m.nombre)}</span>`).join("") || "<i>ninguno</i>"}</div></td>
        <td>${crea.length ? (crea.length === I.ROLES.length ? "<b>todos</b>" : crea.length + " rol(es)") : "<i>a nadie</i>"}</td>
      </tr>`; }).join("")}</tbody></table>`;
  }

  /* ============================================================ MATRIZ */
  function vMatriz() {
    return head("Matriz de permisos",
      `Las ${M.matriz().length} filas de <code>sistema.matriz_permisos</code>. Una casilla en rojo no es un olvido: es el techo del rol impidiéndolo.`) + `
    <div class="ms-scroll"><table class="ms-tabla ms-matriz"><thead><tr><th>Rol</th>
    ${I.MODULOS.map(m => `<th title="${esc(m.nombre)}">${esc(m.codigo.slice(0,5))}<br>${pastilla(m.nivel)}</th>`).join("")}
    </tr></thead><tbody>
    ${I.ROLES.map(r => `<tr><td class="ms-rolcel"><b>${esc(r.nombre)}</b> ${pastilla(r.techo)}</td>
      ${I.MODULOS.map(m => {
        const n = M.matriz().filter(p => p.rol === r.codigo && p.modulo === m.codigo).length;
        const permitido = I.rolPuedeModulo(r.codigo, m.codigo).ok;
        if (!permitido) return `<td class="ms-cel ms-cel--veda" title="Techo N${r.techo} contra dato N${m.nivel}">—</td>`;
        return `<td class="ms-cel ${n ? "ms-cel--si" : "ms-cel--no"}">${n || ""}</td>`;
      }).join("")}</tr>`).join("")}
    </tbody></table></div>
    <div class="ms-leyenda">
      <span><i class="ms-cel--si"></i> con permisos (el número son las acciones)</span>
      <span><i class="ms-cel--no"></i> sin permisos, pero sería otorgable</span>
      <span><i class="ms-cel--veda"></i> vedado por techo: la base lo rechaza</span>
    </div>`;
  }


  /* ============================================================ PERMISOS DEL ROL
     Aquí se habilita y se deshabilita, casilla por casilla, qué puede
     hacer cada rol en cada módulo. La matriz es DATO: por eso se
     edita sin tocar el sistema.

     Lo único que no se puede saltar es el techo. Una casilla apagada
     se puede encender; una VEDADA no, y dice por qué. */
  function vPermisos() {
    const rolSel = (borrador && borrador.rolPerm) || I.ROLES[0].codigo;
    const r = I.rol(rolSel) || M.rolesTodos().find(x => x.codigo === rolSel);
    const verbos = I.ACCIONES.filter(a => /^[a-z]/.test(a.codigo));   // ver, crear, editar…
    const nombrados = I.ACCIONES.filter(a => /^[A-Z]/.test(a.codigo)); // ENTREGAR_MENOR…
    const total = M.permisosDelRol(rolSel).length;

    function celda(mod, acc) {
      const veto = I.rolPuedeModulo(rolSel, mod.codigo);
      const on = M.tienePermiso(rolSel, mod.codigo, acc);
      if (!veto.ok) return `<td><button class="ms-sw is-veda" disabled title="${esc(veto.razon)}"></button></td>`;
      return `<td><button class="ms-sw ${on ? "is-on" : ""}" data-accion="perm"
        data-mod="${esc(mod.codigo)}" data-acc="${esc(acc)}"
        title="${on ? "Quitar" : "Dar"} «${esc(acc)}» sobre ${esc(mod.nombre)}"
        aria-pressed="${on}"></button></td>`;
    }
    function tabla(titulo, acciones, nota) {
      return `<div class="ms-lbl" style="margin-top:18px">${esc(titulo)}</div>
      ${nota ? `<div class="ms-nota">${esc(nota)}</div>` : ""}
      <div class="ms-scroll"><table class="ms-grid-cfg"><thead><tr><th>Módulo</th>
        ${acciones.map(a => `<th>${esc(a.codigo.replace(/_/g, " "))}</th>`).join("")}
      </tr></thead><tbody>
      ${I.MODULOS.map(m => `<tr>
        <td><b>${esc(m.nombre)}</b> ${pastilla(m.nivel)}</td>
        ${acciones.map(a => celda(m, a.codigo)).join("")}
      </tr>`).join("")}</tbody></table></div>`;
    }

    return `<div class="ms-ancho">` + head("Qué puede hacer cada rol",
      "Casilla por casilla. Lo que quede encendido es lo que el rol podrá hacer en cada módulo.") + `
    <div class="ms-barra">
      <label class="ms-campo" style="margin:0;min-width:280px"><span>Rol</span>
        <select data-campo="rolPerm">
        ${M.rolesTodos().map(x => `<option value="${esc(x.codigo)}" ${x.codigo === rolSel ? "selected" : ""}>${esc(x.nombre)} · techo N${x.techo}</option>`).join("")}
        </select></label>
      <div class="ms-barra__sp"></div>
      <span class="ms-cuenta">${total} permiso(s) activos</span>
    </div>

    ${r ? `<div class="ms-alerta ${r.techo >= 3 ? "ms-alerta--ambar" : "ms-alerta--verde"}">
      <b>${esc(r.nombre)}</b> tiene techo ${pastilla(r.techo)}.
      Alcanza ${I.MODULOS.filter(m => I.rolPuedeModulo(rolSel, m.codigo).ok).length} de ${I.MODULOS.length} módulos.
      Los demás le quedan vedados y no hay forma de encenderlos: el techo es del rol, no de la asignación.
      ${r.techo >= 3 ? " Este rol toca dato sensible: cada permiso que le dé aquí queda en la bitácora." : ""}
    </div>` : ""}

    ${tabla("Verbos generales", verbos)}
    ${tabla("Acciones nombradas", nombrados,
      "Estas son las que de verdad importan en una iglesia: entregar un menor, ver notas confidenciales, anular un certificado. Un permiso de «editar» no las cubre.")}

    <div class="ms-leyenda" style="margin-top:16px">
      <span><i class="ms-sw is-on" style="pointer-events:none"></i> puede hacerlo</span>
      <span><i class="ms-sw" style="pointer-events:none"></i> no, pero se puede encender</span>
      <span><i class="ms-sw is-veda" style="pointer-events:none"></i> vedado por techo: no es otorgable</span>
    </div></div>`;
  }

  /* ============================================================ PERMISO EFECTIVO */
  function vEfectivo() {
    const sel = (borrador && borrador.verPersona) || M.personas()[0].id;
    const p = M.persona(sel), asg = M.deLaPersona(sel), ef = I.permisoEfectivo(asg);
    const cerradas = asg.filter(a => a.hasta && a.hasta < hoy());
    return head("Qué ve cada persona",
      "No es «¿qué puede hacer Juan?» sino «¿qué puede hacer Juan CON ESTE rol, en ESTE alcance, HOY?».") + `
    <label class="ms-campo ms-campo--ancho"><span>Persona</span>
      <select data-campo="verPersona">${M.personas().map(x =>
        `<option value="${esc(x.id)}" ${x.id === sel ? "selected" : ""}>${esc(x.nombre)}</option>`).join("")}</select></label>
    ${ef.length ? `
      <div class="ms-resumen">${esc(p.nombre)} alcanza <b>${ef.length}</b> módulo(s) hoy,
        con <b>${ef.reduce((s,x) => s + x.acciones.length, 0)}</b> acción(es) en total.</div>
      ${ef.map(x => `<div class="ms-efmod">
        <div class="ms-efmod__cab"><b>${esc(x.nombre)}</b> ${pastilla(x.nivelModulo)}</div>
        <div class="ms-lbl">Puede</div>
        <div class="ms-chips">${x.acciones.map(a => `<span class="ms-chip ms-chip--acc">${esc(a)}</span>`).join("")}</div>
        <div class="ms-lbl">Por qué</div>
        <div class="ms-chips">${x.porque.map(w => `<span class="ms-chip">${esc(w)}</span>`).join("")}</div>
      </div>`).join("")}`
      : `<div class="ms-alerta ms-alerta--roja"><b>Hoy no alcanza ningún módulo.</b>
         ${cerradas.length ? `Tuvo ${cerradas.length} asignación(es) que ya cerraron. La regla es explícita:
         sin rol vigente, el acceso queda bloqueado.` : "Nunca se le otorgó acceso."}</div>`}
    ${cerradas.length ? `<h2 class="ms-h2">Historial cerrado</h2>
      <table class="ms-tabla ms-tabla--mini"><thead><tr><th>Rol</th><th>Alcance</th><th>Cerró</th></tr></thead><tbody>
      ${cerradas.map(a => `<tr class="ms-fila--cerrada"><td>${esc((I.rol(a.rol)||{}).nombre || a.rol)}</td>
        <td>${nombreAlcance(a)}</td><td>${esc(a.hasta)}</td></tr>`).join("")}</tbody></table>` : ""}`;
  }

  /* ============================================================ BITÁCORA */
  function vBitacora() {
    return head("Bitácora de accesos",
      "Solo se agrega. Quién otorgó qué, a quién y cuándo. Ninguna línea se borra ni se edita.") + `
    <table class="ms-tabla"><thead><tr><th>Cuándo</th><th>Tipo</th><th>Quién</th><th>Qué pasó</th></tr></thead><tbody>
    ${M.bitacora().map(l => {
      const q = M.persona(l.quien);
      return `<tr><td><code>${esc(l.ts)}</code></td>
        <td><span class="ms-tag ms-tag--${esc(l.tipo.toLowerCase())}">${esc(l.tipo)}</span></td>
        <td>${esc(q ? q.nombre : l.quien)}</td><td>${esc(l.detalle)}</td></tr>`; }).join("")}
    </tbody></table>`;
  }

  /* ============================================================ CONTRASTE */
  function vContraste() {
    return head("Contraste con el modelo del equipo 100p",
      "Lo que hay que resolver en la mesa antes de conectar el frontend. Está escrito en el código, no en un correo.") +
    I.DIVERGENCIAS.map(d => `
      <div class="ms-div ms-div--${esc(d.gravedad)}">
        <div class="ms-div__cab"><b>${esc(d.punto)}</b><span class="ms-grav">${esc(d.gravedad)}</span></div>
        <div class="ms-fila2">
          <div><div class="ms-lbl">Lo construido</div><div class="ms-val">${esc(d.nuestro)}</div></div>
          <div><div class="ms-lbl">Documento del equipo</div><div class="ms-val">${esc(d.dejhon)}</div></div>
        </div>
        <div class="ms-div__porque">${esc(d.porque)}</div>
      </div>`).join("") + `
    <h2 class="ms-h2">Lo que conviene adoptar de su documento</h2>
    <ul class="ms-lista">${I.ADOPTAR_DE_JHON.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`;
  }

  /* ============================================================ ORGANIZACIÓN */
  function vIglesias() {
    const asg = M.asignaciones(), vig = a => !a.hasta || a.hasta >= hoy();
    return `<div class="ms-ancho">` + head("Iglesias y sedes",
      "Toda la red. Haga clic en una para ver su gobierno completo: quién la pastorea, quién tiene acceso y qué módulos ve.") + `
    <div class="ms-barra">
      <span class="ms-cuenta">${M.sedes().length} iglesias</span>
      <div class="ms-barra__sp"></div>
      <button class="ms-btn ms-btn--primario" data-accion="ir" data-vista="n-iglesia">+ Crear iglesia</button>
    </div>
    <table class="ms-lista-t"><thead><tr>
      <th style="width:26px"></th><th>Iglesia</th><th style="width:110px">Código</th>
      <th>Plantilla</th><th>Pastores</th><th style="width:110px">Módulos</th>
      <th style="width:110px">Con acceso</th><th class="ms-acc-col"></th>
    </tr></thead><tbody>
    ${M.sedes().map(sd => {
      const past = asg.filter(a => vig(a) && a.alcanceId === sd.id && a.rol === "PASTOR_CONGREGACIONAL")
                      .map(a => M.persona(a.personaId)).filter(Boolean);
      const gente = new Set(asg.filter(a => vig(a) && a.alcanceId === sd.id).map(a => a.personaId));
      const mods = M.modsede().filter(x => x.sede === sd.id && x.activo).length;
      const pl = I.plantilla(sd.plantilla);
      return `<tr>
        <td><button class="ms-desp" data-accion="veriglesia" data-id="${esc(sd.id)}" title="Abrir ficha">›</button></td>
        <td><button class="ms-enlace ms-nom" data-accion="veriglesia" data-id="${esc(sd.id)}">${esc(sd.nombre)}</button>
            <span class="ms-sub">${esc(sd.ciudad || "")}${sd.pais ? " · " + esc(sd.pais) : ""}</span></td>
        <td><span class="ms-codigo">${esc(sd.codigo || "—")}</span></td>
        <td>${pl ? `<span class="ms-chip">${esc(pl.nombre)}</span>` : "<span class=ms-falta>sin plantilla</span>"}</td>
        <td>${past.length
          ? `<div class="ms-chips">${past.map(p => `<span class="ms-chip">${esc(p.nombre)}</span>`).join("")}</div>`
          : `<span class="ms-vig ms-vig--fin">Sin pastor</span>`}</td>
        <td class="num">${mods} de ${I.MODULOS.length}</td>
        <td class="num">${gente.size}</td>
        <td class="ms-acc-col">
          <button class="ms-btn ms-btn--peq" data-accion="veriglesia" data-id="${esc(sd.id)}">Ver todo</button></td>
      </tr>`;
    }).join("")}</tbody></table></div>`;
  }

  /* ============================================================ FICHA DE IGLESIA
     Todo el gobierno de una sede en una pantalla: quién la pastorea,
     quién más tiene acceso y con qué permiso, qué módulos ve y qué
     ministerios y equipos tiene dentro. */
  function vIglesia() {
    const id = (borrador && borrador.verSede) || (M.sedes()[0] || {}).id;
    const sd = M.sedes().find(x => x.id === id);
    if (!sd) return head("Iglesia", "No existe esa sede.");
    const asg = M.asignaciones(), vig = a => !a.hasta || a.hasta >= hoy();
    const aqui = asg.filter(a => vig(a) && a.alcanceId === id);
    const past = aqui.filter(a => a.rol === "PASTOR_CONGREGACIONAL");
    const otros = aqui.filter(a => a.rol !== "PASTOR_CONGREGACIONAL");
    const mins = M.ministerios().filter(m => m.sedeId === id);
    const eqs = M.equipos().filter(e => e.sedeId === id);
    const pl = I.plantilla(sd.plantilla);
    const activos = M.modsede().filter(x => x.sede === id && x.activo).map(x => x.modulo);

    const filaAcceso = a => {
      const p = M.persona(a.personaId), r = I.rol(a.rol);
      /* ⛔⛔ ESTA COLUMNA MENTÍA, Y ERA EL DEFECTO QUE DANIEL VIO EL 11 DE
         SEPTIEMBRE: «le asigno permisos a la iglesia de Barcelona y pongo
         un pastor, y aparecen todas las pestañas activadas».

         El alcance se calculaba SIN pasarle la cuarta puerta del motor,
         la que pregunta si el módulo está encendido EN ESA IGLESIA. Por
         eso la ficha de Barcelona listaba los 20 módulos que concede el
         rol mientras la sede tenía uno solo encendido. No era un adorno
         mal pintado: era la ficha diciendo lo contrario de lo que el
         panel iba a hacer, que es la peor forma de equivocarse.

         Ahora enseña lo EFECTIVO, y lo que el rol da pero la iglesia
         retiene se dice aparte, en vez de ocultarlo o de fingir que se
         otorga. */
      const ef = I.permisoEfectivo([a], null, null, (sid, mo) => M.moduloActivo(sid, mo));
      const frenados = I.permisoEfectivo([a]).length - ef.length;
      return `<tr>
        <td><button class="ms-enlace ms-nom" data-accion="verpersona" data-id="${esc(a.personaId)}">${esc(p ? p.nombre : a.personaId)}</button>
            <span class="ms-sub">${esc((p || {}).codigo || "")}</span></td>
        <td>${esc(r ? r.nombre : a.rol)}</td>
        <td>${pastilla(a.nivelMax)}</td>
        <td><div class="ms-chips">${ef.length
          ? ef.map(x => `<span class="ms-chip">${esc(x.nombre)}</span>`).join("")
          : "<i>ninguno</i>"}</div>${frenados > 0
          ? `<div class="ms-sub">+${frenados} que su rol concede y esta iglesia tiene apagados</div>`
          : ""}</td>
        <td>${a.delega ? `<span class="ms-vig ms-vig--ok">Puede nombrar</span>` : `<span class="ms-sub">no nombra</span>`}</td>
        <td>${vigencia(a)}</td>
        <td class="ms-acc-col"><button class="ms-btn ms-btn--peq ms-btn--peligro" data-accion="revocar" data-id="${esc(a.id)}">Cerrar</button></td>
      </tr>`;
    };

    return `<div class="ms-ancho">` + `
    <div class="ms-ficha__top">
      <button class="ms-btn ms-btn--peq" data-accion="ir" data-vista="iglesias">← Todas las iglesias</button>
      <div class="ms-barra__sp"></div>
      <button class="ms-btn ms-btn--peq" data-accion="ir" data-vista="n-ministerio">+ Ministerio</button>
      <button class="ms-btn ms-btn--peq" data-accion="ir" data-vista="n-equipo">+ Equipo</button>
      <button class="ms-btn ms-btn--peq ms-btn--primario" data-accion="ir" data-vista="crear">+ Otorgar acceso</button>
    </div>

    <div class="ms-head">
      <h1>${esc(sd.nombre)} <span class="ms-codigo" style="vertical-align:6px">${esc(sd.codigo || "")}</span></h1>
      <p>${esc(sd.ciudad || "")}${sd.pais ? " · " + esc(sd.pais) : ""}
         ${pl ? ` · plantilla <b>${esc(pl.nombre)}</b>: ${esc(pl["desc"] || "")}` : ""}</p>
    </div>

    <div class="ms-kpis">
      <div class="ms-kpi"><b>${past.length}</b><span>pastores</span></div>
      <div class="ms-kpi"><b>${aqui.length}</b><span>accesos vigentes</span></div>
      <div class="ms-kpi"><b>${activos.length}</b><span>de ${I.MODULOS.length} módulos</span></div>
      <div class="ms-kpi"><b>${mins.length}</b><span>ministerios</span></div>
    </div>

    ${!past.length ? `<div class="ms-alerta ms-alerta--roja">
      <b>Esta iglesia no tiene pastor asignado.</b> Una sede sin pastor no debería existir:
      la base lo exige y aquí quedó sin cumplir.</div>` : ""}
    ${past.length === 1 ? `<div class="ms-alerta ms-alerta--ambar">
      <b>Solo hay un pastor nombrado.</b> En Casa Sobre la Roca los pastores se nombran en
      matrimonio: falta su esposa.</div>` : ""}

    <div class="ms-lbl">Pastores</div>
    ${past.length ? `<table class="ms-tabla"><thead><tr>
      <th>Persona</th><th>Rol</th><th>Techo</th><th>Alcanza</th><th>Nombra</th><th>Vigencia</th><th></th>
    </tr></thead><tbody>${past.map(filaAcceso).join("")}</tbody></table>`
      : `<div class="ms-nota">Nadie la pastorea todavía.</div>`}

    <div class="ms-lbl" style="margin-top:22px">Otros accesos en esta iglesia (${otros.length})</div>
    ${otros.length ? `<table class="ms-tabla"><thead><tr>
      <th>Persona</th><th>Rol</th><th>Techo</th><th>Alcanza</th><th>Nombra</th><th>Vigencia</th><th></th>
    </tr></thead><tbody>${otros.map(filaAcceso).join("")}</tbody></table>`
      : `<div class="ms-nota">Nadie más tiene acceso a esta sede todavía.</div>`}

    <div class="ms-lbl" style="margin-top:22px">Qué ve esta iglesia</div>
    <div class="ms-nota">Encender o apagar aquí cambia lo que ven TODOS los de esta sede.
      Los módulos de dato sensible piden evidencia legal.</div>
    <div class="ms-modgrid">
      ${I.MODULOS.map(m => {
        const on = activos.indexOf(m.codigo) >= 0;
        return `<button class="ms-modtog ${on ? "is-on" : ""}" data-accion="cfg-mod"
          data-sede="${esc(id)}" data-mod="${esc(m.codigo)}" aria-pressed="${on}">
          <span class="ms-sw ${on ? "is-on" : ""}" aria-hidden="true"></span>
          <span><b>${esc(m.nombre)}</b> ${pastilla(m.nivel)}</span></button>`;
      }).join("")}
    </div>
    <div class="ms-acciones" style="margin-top:12px">
      ${I.PLANTILLAS.map(x => `<button class="ms-btn ms-btn--peq" data-accion="cfg-plant"
        data-sede="${esc(id)}" data-cod="${esc(x.codigo)}">Aplicar «${esc(x.nombre)}»</button>`).join("")}
    </div>


    ${(() => {
      /* ⭐ «le active tres cosas a Barcelona y no puedo ver lo que puse,
         por que no esta el boton».
         Estaba condicionado a que hubiera alguien con acceso en la sede,
         y Barcelona no tiene pastor. Logico, pero inutil: lo que se
         quiere es ver la CONFIGURACION, haya gente o no.

         Ahora el bloque esta SIEMPRE. Si hay personas, se entra con las
         suyas. Si no, se entra en VISTA PREVIA simulando el rol que
         correspondería, que es lo que hace falta para comprobar antes de
         nombrar a nadie. */
      const candidatos = aqui.map(x => {
        const per = M.persona(x.personaId);
        const pn = I.panelesDe([x], (sid, mo) => M.moduloActivo(sid, mo)).filter(y => y.abre);
        return per && pn.length ? { per, paneles:pn, esPastor: x.rol === "PASTOR_CONGREGACIONAL" } : null;
      }).filter(Boolean).sort((a2, b2) => (b2.esPastor ? 1 : 0) - (a2.esPastor ? 1 : 0));

      const previas = [
        { rol:"PASTOR_CONGREGACIONAL", url:"pastor.html",   lbl:"Pastor de sede" },
        { rol:"DIRECTOR_MINISTERIO",   url:"director.html", lbl:"Director de ministerio" },
        { rol:"COORDINADOR_NUEVOS",    url:"nicodemo.html", lbl:"Nicodemo · nuevos" },
      ];

      return `<div class="ms-comprobar">
        <div>
          <div class="ms-lbl" style="margin:0 0 2px">Comprobar cómo se ve</div>
          <div class="ms-sub" style="font-family:var(--ui)">Entra al panel real con la
            configuración que acaba de dejar arriba. ${activos.length} módulo(s) encendidos.</div>
        </div>
        <div class="ms-comprobar__b">
          ${candidatos.slice(0, 3).map(c => `<button class="ms-btn ms-btn--peq ${c.esPastor ? "ms-btn--primario" : ""}"
            data-accion="abrirpanel" data-url="${esc(c.paneles[0].url)}"
            data-lbl="${esc(c.paneles[0].nombre)}" data-persona="${esc(c.per.id)}">
            Entrar como ${esc(c.per.nombre.split(" ").slice(0, 2).join(" "))}</button>`).join("")}
        </div>
      </div>

      ${!candidatos.length ? `<div class="ms-nota ms-nota--ojo">
        <b>Esta iglesia todavía no tiene a nadie con acceso</b>, así que no hay permisos reales
        que mirar. Use la vista previa: simula el rol y enseña exactamente lo que vería quien
        lo ocupe, con los módulos que usted acaba de encender.</div>` : ""}

      <div class="ms-lbl" style="margin-top:14px">Vista previa por rol</div>
      <div class="ms-comprobar__b">
        ${previas.map(v => {
          const r2 = I.rol(v.rol); if (!r2) return "";
          const finge = { rol:v.rol, alcanceTipo:"sede", alcanceId:id, nivelMax:r2.techo,
            desde:"2000-01-01", hasta:null };
          const n = I.permisoEfectivo([finge], null, null, (sid, mo) => M.moduloActivo(sid, mo)).length;
          return `<button class="ms-btn ms-btn--peq" data-accion="previa"
            data-url="${esc(v.url)}" data-lbl="${esc(v.lbl)}" data-rol="${esc(v.rol)}" data-sede="${esc(id)}">
            Ver como ${esc(v.lbl)} <span class="ms-sub" style="font-family:var(--ui)">· ${n} módulos</span></button>`;
        }).join("")}
      </div>`;
    })()}

    <div class="ms-lbl" style="margin-top:22px">Paneles vivos en esta iglesia</div>
    <div class="ms-nota">Cada persona con rol aquí abre su propia pantalla. Si un módulo está apagado
      arriba, el panel que depende de él no abre, por mucho que la persona tenga el rol.</div>
    ${(() => {
      const filas = [];
      aqui.forEach(a => {
        I.panelesDe([a], (sid, mod) => M.moduloActivo(sid, mod)).forEach(x => {
          const per = M.persona(a.personaId);
          filas.push(`<tr>
            <td><b>${esc(x.nombre)}</b><span class="ms-sub">${esc(x.url)}</span></td>
            <td>${esc((I.rol(a.rol)||{}).nombre || a.rol)}</td>
            <td><button class="ms-enlace" data-accion="verpersona" data-id="${esc(a.personaId)}">${esc(per ? per.nombre : "")}</button></td>
            <td>${x.abre ? `<span class="ms-vig ms-vig--ok">Abre</span>`
                         : `<span class="ms-vig ms-vig--fin">${esc(x.razon || "sin acceso")}</span>`}</td>
            <td class="ms-acc-col">${x.abre
              ? `<button class="ms-btn ms-btn--peq" data-accion="abrirpanel" data-url="${esc(x.url)}" data-lbl="${esc(x.nombre)}" data-persona="${esc(id)}">Entrar</button>` : ""}</td>
          </tr>`);
        });
      });
      return filas.length
        ? `<table class="ms-tabla"><thead><tr><th>Panel</th><th>Rol</th><th>Quién</th><th>Estado</th><th></th></tr></thead>
           <tbody>${filas.join("")}</tbody></table>`
        : `<div class="ms-nota">Ningún panel vivo: nadie tiene todavía un rol con pantalla en esta sede.</div>`;
    })()}

    <div class="ms-lbl" style="margin-top:22px">Ministerios (${mins.length}) y equipos (${eqs.length})</div>
    ${mins.length || eqs.length ? `<table class="ms-tabla"><thead><tr>
      <th>Unidad</th><th>Código</th><th>Tipo</th><th>A cargo</th></tr></thead><tbody>
      ${mins.map(m => {
        const l = asg.find(a => vig(a) && a.alcanceId === m.codigo && a.rol === "DIRECTOR_MINISTERIO");
        const per = l && M.persona(l.personaId);
        return `<tr><td><b>${esc(m.nombre)}</b></td><td><span class="ms-codigo">${esc(m.codTrabajo || "—")}</span></td>
          <td>Ministerio</td><td>${per
            ? `<button class="ms-enlace" data-accion="verpersona" data-id="${esc(per.id)}">${esc(per.nombre)}</button>`
            : `<span class="ms-falta">sin director</span>`}</td></tr>`;
      }).join("")}
      ${eqs.map(e => { const per = M.persona(e.liderId);
        return `<tr><td><b>${esc(e.nombre)}</b></td><td><span class="ms-codigo">${esc(e.codTrabajo || "—")}</span></td>
          <td>Equipo ${esc(e.ambito)}</td><td>${per
            ? `<button class="ms-enlace" data-accion="verpersona" data-id="${esc(per.id)}">${esc(per.nombre)}</button>`
            : `<span class="ms-falta">sin responsable</span>`}</td></tr>`;
      }).join("")}
    </tbody></table>` : `<div class="ms-nota">Esta iglesia no tiene ministerios ni equipos creados.</div>`}

    ${(() => {
      /* ============================================================
         MINISTERIOS Y GRUPOS PEQUEÑOS DE ESTA IGLESIA
         ------------------------------------------------------------
         Orden de Daniel, 11 de septiembre: «todo lo que se ponga allí es
         lo que debe aparecer en las diferentes iglesias locales, y cada
         pastor debe poder crear y modificar ministerios y grupos
         pequeños, aunque desde el centro de mando también».

         Las dos manos escriben en el mismo sitio: lo que abre el pastor
         desde su panel aparece aquí, y lo que se abra aquí aparece en su
         panel. Por eso se dice quién creó cada uno: en un sistema con dos
         puertas, la autoría deja de ser un adorno.

         Va pegado a la tabla de ministerios y equipos a propósito: los
         tres son la misma pregunta, cómo está armada esta iglesia, y
         partirla en dos sitios es como se acaba con dos verdades.
         ============================================================ */
      const mins = M.ministeriosDeSede(id);
      const gps  = M.gruposDeSede(id);
      const onGrupos = M.moduloActivo(id, "grupos");
      return `
      <div class="ms-lbl" style="margin-top:22px">Grupos pequeños (${gps.length})</div>
      ${!onGrupos ? `<div class="ms-nota ms-nota--ojo">
        <b>El módulo «Grupos y hogares» está apagado en esta iglesia.</b> Puede dejarlos escritos,
        pero su pastor no los verá hasta que lo encienda arriba.</div>` : ""}
      ${gps.length ? `<table class="ms-tabla"><thead><tr>
        <th>Grupo</th><th>Código</th><th>Ministerio</th><th>Líder</th><th>Cuándo</th><th>Personas</th><th>Lo abrió</th><th></th>
      </tr></thead><tbody>${gps.map(g => {
        const mn = mins.find(x => x.codigo === g.ministerioCodigo);
        const qn = g.creadoPor === "master" ? "el centro de mando" : ((M.persona(g.creadoPor) || {}).nombre || g.creadoPor);
        return `<tr>
          <td><b>${esc(g.nombre)}</b></td>
          <td><span class="ms-codigo">${esc(g.codTrabajo)}</span></td>
          <td>${esc(mn ? mn.nombre : "—")}</td>
          <td>${esc(g.lider)}<span class="ms-sub">${esc(g.liderTel || "")}</span></td>
          <td>${esc([g.dia, g.hora].filter(Boolean).join(" · ") || "—")}<span class="ms-sub">${esc(g.zona || "")}</span></td>
          <td>${g.miembros || 0}${g.cupo ? " / " + g.cupo : ""}</td>
          <td><span class="ms-sub">${esc(qn)}</span></td>
          <td class="ms-acc-col"><button class="ms-btn ms-btn--peq ms-btn--peligro"
            data-accion="gp-cerrar" data-id="${esc(g.id)}">Cerrar</button></td>
        </tr>`; }).join("")}</tbody></table>`
        : `<div class="ms-nota">Ninguno todavía. Los abre su pastor desde el panel, o usted aquí mismo.</div>`}

      <div class="ms-crear" style="margin-top:12px">
        <div class="ms-lbl" style="margin:0 0 6px">Abrir un grupo desde el centro de mando</div>
        <div class="ms-datos">
          <label class="ms-campo"><span>Nombre <b class="ms-req">obligatorio</b></span>
            <input id="ms-gp-nombre" placeholder="Ej. Hogar Chapinero"></label>
          <label class="ms-campo"><span>Líder <b class="ms-req">obligatorio</b></span>
            <input id="ms-gp-lider" placeholder="Nombre y apellido"></label>
          <label class="ms-campo"><span>Celular del líder</span>
            <input id="ms-gp-tel" placeholder="+57 300 000 0000"></label>
          <label class="ms-campo"><span>Ministerio</span>
            <select id="ms-gp-min"><option value="">Sin ministerio</option>
            ${mins.map(m => `<option value="${esc(m.codigo)}">${esc(m.nombre)}</option>`).join("")}</select></label>
          <label class="ms-campo"><span>Día</span><input id="ms-gp-dia" placeholder="Miércoles"></label>
          <label class="ms-campo"><span>Hora</span><input id="ms-gp-hora" placeholder="7:00 pm"></label>
          <label class="ms-campo"><span>Zona</span><input id="ms-gp-zona" placeholder="Chapinero"></label>
          <label class="ms-campo"><span>Cupo</span><input id="ms-gp-cupo" type="number" min="0" placeholder="20"></label>
        </div>
        <div class="ms-acciones" style="margin-top:10px">
          <button class="ms-btn ms-btn--primario ms-btn--peq" data-accion="gp-crear"
            data-sede="${esc(id)}">Abrir el grupo</button>
        </div>
      </div>`;
    })()}

    ${(() => {
      /* El CRM DE ESTA IGLESIA. Sale de la misma línea de tiempo, no de
         un CRM aparte: eso sería montar el CRM encima de cada proceso. */
      const c = M.crmDeSede(id);
      return `
      <div class="ms-lbl" style="margin-top:26px">CRM de esta iglesia</div>
      <div class="ms-nota">Los hechos de toda la gente con alcance aquí. Sale de la misma línea de
        tiempo de la red, filtrada por esta sede.</div>
      <div class="ms-kpis">
        <div class="ms-kpi"><b>${c.hechos.length}</b><span>hechos</span></div>
        <div class="ms-kpi"><b>${c.personas}</b><span>personas con alcance aquí</span></div>
        <div class="ms-kpi ${c.frios.length ? "ms-kpi--ojo" : ""}"><b>${c.frios.length}</b><span>se están enfriando</span></div>
        <div class="ms-kpi ${c.sinHechos.length ? "ms-kpi--ojo" : ""}"><b>${c.sinHechos.length}</b><span>sin un solo hecho</span></div>
      </div>
      ${c.sinHechos.length ? `<div class="ms-alerta ms-alerta--ambar">
        <b>${c.sinHechos.length} persona(s) con acceso aquí y sin un solo hecho registrado:</b>
        ${esc(c.sinHechos.map(p => p.nombre).join(", "))}.</div>` : ""}
      ${c.frios.length ? `<table class="ms-tabla"><thead><tr>
        <th>Se está enfriando</th><th>Último movimiento</th><th>Hace</th></tr></thead><tbody>
        ${c.frios.slice(0, 5).map(x => `<tr>
          <td><button class="ms-enlace ms-nom" data-accion="verpersona" data-id="${esc(x.persona.id)}">${esc(x.persona.nombre)}</button></td>
          <td>${esc(x.ultimo.resumen)}</td><td class="num">${x.dias} días</td></tr>`).join("")}
        </tbody></table>` : ""}
      <div class="ms-chips" style="margin-bottom:10px">${I.MODULOS.map(m => {
        const n = c.porModulo[m.codigo] || 0;
        return `<span class="ms-chip ${n ? "" : "ms-chip--veda"}">${esc(m.nombre)} · ${n}</span>`;
      }).join("")}</div>
      <div class="ms-lbl" style="margin-top:18px">Las personas de esta iglesia y en qué van</div>
      ${c.gente.length ? `<table class="ms-lista-t"><thead><tr>
        <th>Persona</th><th style="width:110px">Etapa 4C</th><th>Grupo</th>
        <th>Cursos certificados</th><th style="width:90px">Hechos</th>
        <th style="width:150px">Último movimiento</th><th>Rol aquí</th>
      </tr></thead><tbody>
      ${c.gente.map(g => {
        const eta = { conoce:"Conoce", conecta:"Conéctate", crece:"Crece", sirve:"Sirve" }[g.etapa];
        return `<tr>
          <td><button class="ms-enlace ms-nom" data-accion="verpersona" data-id="${esc(g.persona.id)}">${esc(g.persona.nombre)}</button>
              <span class="ms-sub">${esc(g.persona.codigo || "")}${g.desde ? " · desde " + esc(g.desde) : ""}</span></td>
          <td>${eta ? `<span class="ms-etapa ms-etapa--${esc(g.etapa)}">${esc(eta)}</span>` : `<span class="ms-sub">sin registrar</span>`}</td>
          <td>${g.grupo ? esc(g.grupo) : `<span class="ms-sub">ninguno</span>`}</td>
          <td>${g.cursos.length
            ? `<div class="ms-chips">${g.cursos.map(x => `<span class="ms-chip">${esc(x.resumen.replace(/^Certificó (el curso )?/i, "").replace(/\.$/, ""))}</span>`).join("")}</div>`
            : `<span class="ms-sub">ninguno</span>`}</td>
          <td class="num">${g.hechos}</td>
          <td>${g.ultimo
            ? `<span class="ms-vig ${g.dias > 120 ? "ms-vig--fin" : "ms-vig--ok"}">hace ${g.dias} días</span>`
            : `<span class="ms-vig ms-vig--fin">nunca</span>`}</td>
          <td>${g.rol ? `<span class="ms-chip">${esc((I.rol(g.rol)||{}).nombre || g.rol)}</span>` : `<span class="ms-sub">—</span>`}</td>
        </tr>`;
      }).join("")}</tbody></table>` : `<div class="ms-nota">Nadie con alcance en esta iglesia todavía.</div>`}

      <div class="ms-lbl" style="margin-top:18px">La línea de tiempo de esta iglesia</div>
      ${c.hechos.length ? `<ul class="ms-linea ms-linea--grande">
        ${c.hechos.slice(0, 12).map(h => {
          const p = M.persona(h.personaId), t = I.tipoHecho(h.tipo);
          return `<li><span class="ms-linea__f">${esc(h.cuando)}</span>
            <span class="ms-chip">${esc(t ? t.modulo : h.modulo)}</span>
            <button class="ms-enlace" data-accion="verpersona" data-id="${esc(h.personaId)}">${esc(p ? p.nombre : "")}</button>
            ${esc(h.resumen)}</li>`;
        }).join("")}</ul>`
        : `<div class="ms-nota">Todavía no hay ningún hecho registrado en esta iglesia.</div>`}`;
    })()}
    </div>`;
  }

  function vModSede() {
    return head("Módulos por sede", "Cada iglesia enciende solo lo que usa. Encender un módulo de dato sensible exige evidencia legal.") + `
    <div class="ms-scroll"><table class="ms-tabla"><thead><tr><th>Iglesia</th>
      ${I.MODULOS.map(m => `<th>${esc(m.codigo.slice(0,5))}<br>${pastilla(m.nivel)}</th>`).join("")}</tr></thead><tbody>
      ${I.SEDES.map(s => `<tr><td><b>${esc(s.nombre)}</b></td>
        ${I.MODULOS.map(m => `<td class="ms-cel ms-cel--si">✓</td>`).join("")}</tr>`).join("")}
    </tbody></table></div>
    <div class="ms-nota">Los datos de habilitación viven en <code>sistema.modulos_sede</code>. Esta vista
      los mostrará en vivo cuando el frontend consuma la API.</div>`;
  }

  /* ============================================================ MÓDULOS DE OPERACIÓN */
  /* ⛔ ESTA PANTALLA NO ES UN ERROR, PERO LO PARECÍA.
     Once pestañas del menú caen aquí. Antes salían con el nombre del
     módulo a secas y una tarjeta de datos, y se leían como una pantalla
     rota o a medio hacer. No lo están: el master gobierna QUIÉN entra,
     y la operación diaria vive en la app del rol. Ahora lo dice de
     frente y ofrece el atajo, en vez de dejar al usuario adivinando. */
  const APP_DEL_MODULO = {
    rocakids:  { src:"rocakids-director.html",   lbl:"RocaKids · dirección" },
    consejeria:{ src:"consejeria-director.html", lbl:"Consejería · dirección" },
    grupos:    { src:"lider.html",               lbl:"Líder de grupo" },
    crm:       { src:"pastor.html",              lbl:"Pastor de sede" },
    personas:  { src:"pastor.html",              lbl:"Pastor de sede" },
    asistencia:{ src:"pastor.html",              lbl:"Pastor de sede" },
    aportes:   { src:"central.html",             lbl:"Dirección General" },
    talento:   { src:"central.html",             lbl:"Dirección General" },
    formacion: { src:"central.html",             lbl:"Dirección General" },
  };
  function vModulo(cod) {
    const m = I.modulo(cod);
    const yo = M.deLaPersona(YO.personaId);
    const alcanza = I.puedeVer(yo, cod);
    const app = APP_DEL_MODULO[cod];
    const destino = app && (NAV.find(x => x.src === app.src) || {}).id;
    return head(m.nombre, "Ficha de gobierno del módulo. Aquí se decide quién entra, no se opera el día a día.") +
      (alcanza ? "" : `<div class="ms-alerta ms-alerta--roja">Su rol no alcanza este módulo.</div>`) +
      fichaModulo(cod) + `
      <div class="ms-nota">
        <b>Esta pestaña no tiene pantalla de operación, y es a propósito.</b>
        El sistema master gobierna accesos: qué nivel de dato es este módulo, qué controles activa
        y qué roles lo alcanzan. El trabajo diario de <b>${esc(m.nombre)}</b> se hace en la app del
        rol que lo usa.
        ${destino ? `<div style="margin-top:10px">
          <button class="ms-btn ms-btn--primario" data-accion="ir" data-vista="${esc(destino)}">Abrir ${esc(app.lbl)}</button>
        </div>` : ` Ábrala desde <b>Apps por rol</b>, en el menú.`}
      </div>`;
  }

  /* ============================================================ PLANTILLAS
     La pestaña decía «Plantillas de iglesia» y caía en la ficha genérica
     del módulo `organizacion`, así que el título que salía era «Organización
     y sedes». El menú prometía una cosa y la pantalla mostraba otra.
     El catálogo existe (I.PLANTILLAS), solo faltaba enseñarlo. */
  function vPlantillas() {
    const usoPorPlantilla = cod => M.sedes().filter(x => x.plantilla === cod).length;
    return `<div class="ms-ancho--lectura">` + head("Plantillas de iglesia",
      "Con qué módulos nace una iglesia según su madurez. Se elige al crearla y se puede ajustar después en <b>Qué ve cada iglesia</b>.") + `
      ${I.PLANTILLAS.map(pl => {
        const mods = I.modulosDePlantilla(pl.codigo);
        const n = usoPorPlantilla(pl.codigo);
        return `<div class="ms-paso">
          <h3>${esc(pl.nombre)}</h3>
          <p>${esc(pl["desc"] || "")}</p>
          <div class="ms-lbl">En uso</div>
          <div class="ms-val">${n} ${n === 1 ? "iglesia la usa" : "iglesias la usan"}</div>
          <div class="ms-lbl" style="margin-top:12px">Enciende ${mods.length} de ${I.MODULOS.length} módulos</div>
          <div class="ms-chips">${I.MODULOS.map(m => mods.indexOf(m.codigo) >= 0
            ? `<span class="ms-chip">${esc(m.nombre)} ${pastilla(m.nivel)}</span>`
            : `<span class="ms-chip ms-chip--veda">${esc(m.nombre)}</span>`).join("")}</div>
        </div>`;
      }).join("")}
      <div class="ms-nota">Lo tachado no es un veto permanente: se enciende iglesia por iglesia.
        Los módulos de dato sensible piden evidencia legal para encenderse.</div>
    </div>`;
  }

  /* ============================================================ APP EMBEBIDA */
  function vApp(n) {
    const url = (borrador && borrador.panelUrl) || n.src;
    const lbl = (borrador && borrador.panelLbl) || n.lbl;
    const pn = I.PANELES.filter(x => x.url === url);
    const quien = [];
    M.personas().forEach(p => {
      I.panelesDe(M.deLaPersona(p.id), (sid, m) => M.moduloActivo(sid, m))
        .filter(x => x.url === url && x.abre).forEach(() => quien.push(p));
    });
    return `<div class="ms-ancho">` + head(lbl,
      "No es una demo suelta: es lo que ve quien tiene este rol. Se abre aquí dentro, con el patrón de panel anidado.") + `
    ${pn.length ? `<div class="ms-panelinfo">
      ${pn.map(x => `<div>
        <div class="ms-lbl">Lo abre</div>
        <div class="ms-val">${esc((I.rol(x.rol)||{}).nombre || x.rol)}
          <span class="ms-sub" style="font-family:var(--ui)">alcance ${esc((I.alcance(x.alcance)||{}).nombre || x.alcance)}</span></div>
        <div class="ms-lbl" style="margin-top:10px">Depende del módulo</div>
        <div class="ms-val">${esc((I.modulo(x.modulo)||{}).nombre || x.modulo)} ${pastilla((I.modulo(x.modulo)||{}).nivel)}
          <span class="ms-sub" style="font-family:var(--ui)">si la iglesia lo apaga, este panel no abre</span></div>
        ${x.crea && x.crea.length ? `<div class="ms-lbl" style="margin-top:10px">Desde aquí se crea</div>
          <div class="ms-chips">${x.crea.map(c => `<span class="ms-chip">${esc(c)}</span>`).join("")}</div>` : ""}
      </div>`).join("")}
      <div>
        <div class="ms-lbl">Quién lo abre hoy (${quien.length})</div>
        <div class="ms-chips">${quien.length
          ? quien.map(p => `<button class="ms-chip" style="cursor:pointer" data-accion="verpersona" data-id="${esc(p.id)}">${esc(p.nombre)}</button>`).join("")
          : "<i>nadie todavía</i>"}</div>
      </div>
    </div>` : ""}
    <div class="ms-marco"><iframe src="${esc(url)}" title="${esc(lbl)}" loading="lazy"></iframe></div>
    <div class="ms-nota">Origen: <code>${esc(url)}</code>. Si diera 404, es que no se desplegó junto
      al master: ambos deben publicarse en el mismo sitio.</div></div>`;
  }

  /* ============================================================ SHELL */
  function shell(html) {
    const yo = M.deLaPersona(YO.personaId), ef = I.permisoEfectivo(yo);
    return `
    <header class="ms-top">
      <div class="ms-marca"><div class="ms-logo">CR</div>
        <div><b>Casa Roca · Sistema Master</b><small>Dirección General · ${M.sedes().length} de ${META_IGLESIAS} iglesias${origenEtiqueta()}</small></div></div>
      <div class="ms-sp"></div>
      <button class="ms-ck" data-accion="abrircmd" title="Ir a cualquier parte">
        <span>Buscar o ir a…</span><kbd>\u2318K</kbd></button>
      <div class="ms-crear">
        <button class="ms-btn ms-btn--primario" data-accion="menucrear">+ Crear</button>
        <div class="ms-crear__men ${menuCrear ? "is-on" : ""}">
          ${[["n-persona","👤","Persona"],["n-iglesia","⛪","Iglesia"],
             ["n-ministerio","🗂️","Ministerio"],["n-equipo","🤝","Equipo administrativo"],
             ["crear","🔑","Acceso a una persona"],["n-rol","🎭","Rol"],["n-modulo","🧩","Módulo"]]
            .map(([id,ic,l]) => `<button data-accion="ir" data-vista="${id}"><span>${ic}</span>${l}</button>`).join("")}
        </div>
      </div>
      <div class="ms-yo"><div><b>${esc(YO.nombre)}</b><small>${esc((I.rol(YO.rol) || {}).nombre || YO.rol)} · techo N${YO.techo} · ${ef.length} módulos</small></div>
        <div class="ms-av">${esc(String(YO.nombre||"CR").split(/\s+/).filter(x=>x.length>2).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"CR")}</div></div>
    </header>
    <div class="ms-shell">
      <nav class="ms-nav" aria-label="Secciones del sistema master">
        ${NAV.map(n => n.sep
          ? `<div class="ms-navsep">${esc(n.sep)}</div>`
          : `<button class="ms-navit ${vista === n.id ? "is-on" : ""}" data-accion="ir" data-vista="${esc(n.id)}"
               ${vista === n.id ? 'aria-current="page"' : ""}>
             <span class="ms-navic">${n.ico}</span><span>${esc(n.lbl)}</span>
             ${n.mod ? `<em class="ms-navniv">${(I.nivel((I.modulo(n.mod)||{}).nivel)||{}).codigo || ""}</em>` : ""}
           </button>`).join("")}
      </nav>
      <main class="ms-main" id="ms-main" tabindex="-1">${html}</main>
    </div>
    <div class="ms-cmd" id="ms-cmd" role="dialog" aria-modal="true" aria-label="Ir a">
      <div class="ms-cmd__caja">
        <input class="ms-cmd__in" id="ms-cmd-in" placeholder="Pestaña, persona o rol…" autocomplete="off">
        <div class="ms-cmd__lista" id="ms-cmd-lista"></div>
      </div>
    </div>`;
  }

  /* ⛔ LA PANTALLA DICE DE DÓNDE SALEN LOS DATOS, SIEMPRE.
     Un sistema que enseña cifras sin decir si son reales o de
     demostración es un sistema en el que nadie puede confiar cuando
     importa. Si hay API detrás se dice; si no, también. */
  function origenEtiqueta() {
    const api = window.CASAROCA_API_CLIENTE;
    if (M.origen && M.origen() === "api") return " · <b>datos reales</b>";
    if (api && api.hayApi) return " · sin conexión con la API";
    return " · juego de demostración";
  }

  function pintar() {
    const n = NAV.find(x => x.id === vista) || {};
    let html;
    if (n.src) html = vApp(n);
    else switch (vista) {
      case "tablero":   html = vTablero(); break;
      case "accesos":   html = vAccesos(); break;
      case "crear":     html = vCrear();   break;
      case "roles":     html = vRoles();   break;
      case "matriz":    html = vMatriz();  break;
      case "permisos":  html = vPermisos();break;
      case "efectivo":  html = vEfectivo();break;
      case "bitacora":  html = vBitacora();break;
      case "contraste": html = vContraste();break;
      case "arranque":  html = vArranque(); break;
      case "comando":   html = vComando();  break;
      case "hecho":     html = vHecho();    break;
      case "promover":  html = vPromover();break;
      case "afinar":    html = vAfinar();  break;
      case "persona":   html = vPersona();  break;
      case "iglesia":   html = vIglesia();  break;
      case "n-persona": html = vNPersona(); break;
      case "n-iglesia": html = vNIglesia(); break;
      case "n-ministerio": html = vNMinisterio(); break;
      case "n-equipo":  html = vNEquipo();  break;
      case "n-rol":     html = vNRol();     break;
      case "n-modulo":  html = vNModulo();  break;
      case "iglesias":  html = vIglesias();break;
      case "modsede":   html = vModSede(); break;
      case "plantillas":html = vPlantillas(); break;
      default:          html = n.mod ? vModulo(n.mod) : vTablero();
    }
    document.getElementById("app").innerHTML = shell(html);
  }

  /* ⭐ El puente con la API necesita poder repintar cuando llegan los
     datos de verdad. Se expone SOLO esto: repintar y saber qué vista
     está abierta. Abrir el estado interno invitaría a que otro archivo
     lo modifique, y entonces habría dos sitios decidiendo qué se ve. */
  window.MASTER = {
    repintar: pintar,
    vistaActual: () => vista,
    /* ⛔ QUIÉN OPERA EL MASTER TIENE QUE VENIR DEL SERVIDOR.
       `YO` nace apuntando a «p-dg», el id de la semilla. Con datos reales
       ese id no existe, así que `deLaPersona(YO.personaId)` no devolvía
       nada y la cabecera decía «0 módulos» con la sesión bien abierta.
       Un sistema de permisos que dice cero cuando son veintidós no se
       lee como un dato raro: se lee como que el permiso está roto. */
    fijarYo(datos) {
      if (!datos || !datos.persona) return false;
      const asg = (datos.asignaciones || [])[0] || {};
      YO = {
        personaId: datos.persona.id,
        nombre: datos.persona.nombre || YO.nombre,
        rol: asg.rol || YO.rol,
        techo: (datos.alcance && datos.alcance.nivelMax) || YO.techo,
      };
      return true;
    },
  };

  /* ---------- eventos ---------- */
  document.addEventListener("click", e => {
    const bt = e.target.closest("[data-accion]");
    if (!bt) { if (menuCrear && !e.target.closest(".ms-crear")) { menuCrear = false; pintar(); } return; }
    const a = bt.dataset.accion;
    if (menuCrear && a !== "menucrear") menuCrear = false;
    if (a === "abrircmd") { cmdAbrir(); return; }
    if (a === "menucrear") { menuCrear = !menuCrear; pintar(); return; }

    const b = b_();
    if (a === "plantilla")  { b.plantilla = bt.dataset.cod; pintar(); return; }
    if (a === "techo")      { b.techo   = +bt.dataset.n; pintar(); return; }
    if (a === "nivelmod")   { b.nivel   = +bt.dataset.n; pintar(); return; }
    if (a === "ambito")     { b.ambito  = bt.dataset.v; if (b.ambito !== "local") b.sedeId = ""; pintar(); return; }
    if (a === "equipo-atajo") {
      const e = I.EQUIPOS.find(x => x.codigo === bt.dataset.cod);
      if (e) { b.nombre = e.nombre; b.ambito = e.ambito; b.roles = e.roles.slice(); }
      pintar(); return;
    }
    if (a === "desplegar")  { b.verPersona = bt.dataset.id; vista = "persona"; pintar(); return; }
    if (a === "seguir") {
      /* El encadenado ARRASTRA el contexto: si acaba de crear una
         persona, el alta de acceso se abre con ella elegida; si acaba
         de crear una iglesia, con el alcance de esa sede puesto. Sin
         esto el usuario vuelve a buscar lo que acaba de crear. */
      const g = logro || {}, lleva = bt.dataset.lleva;
      const nb = {};
      if (lleva === "persona" && g.personaId) { nb.personaId = g.personaId; nb.verPersona = g.personaId; }
      if (lleva === "sede" && g.sedeId) {
        nb.sedeId = g.sedeId; nb.verSede = g.sedeId;
        if (bt.dataset.vista === "crear") { nb.alcanceTipo = "sede"; nb.alcanceId = g.sedeId; }
      }
      if (g.personaId && bt.dataset.vista === "persona") nb.verPersona = g.personaId;
      if (g.sedeId && bt.dataset.vista === "iglesia")    nb.verSede = g.sedeId;
      borrador = nb; vista = bt.dataset.vista; pintar();
      const m = $("#ms-main"); if (m) m.focus(); return;
    }
    if (a === "mods-todos") {
      M.fijarModulos(bt.dataset.id, bt.dataset.v === "1"); pintar(); return;
    }
    if (a === "previa") {
      /* La vista previa no crea nada ni toca la base: arma una asignación
         de mentira en memoria, la deja escrita para el panel, y la borra
         al salir. Sirve para comprobar la configuración de una iglesia
         antes de que exista nadie a quien nombrar. */
      const r3 = I.rol(bt.dataset.rol);
      try {
        localStorage.setItem("casaroca_panel_simulado", JSON.stringify({
          rol: bt.dataset.rol, alcanceTipo:"sede", alcanceId: bt.dataset.sede,
          nivelMax: r3 ? r3.techo : 2, desde:"2000-01-01", hasta:null,
          etiqueta: (r3 ? r3.nombre : bt.dataset.rol) + " · vista previa" }));
        localStorage.removeItem("casaroca_panel_persona");
      } catch (e) {}
      b.panelUrl = bt.dataset.url; b.panelLbl = bt.dataset.lbl + " · vista previa";
      vista = "app-pastor"; pintar(); return;
    }
    if (a === "abrirpanel") {
      try { localStorage.removeItem("casaroca_panel_simulado"); } catch (e) {}
      /* ⭐ El panel tiene que saber QUIÉN entra, o se abriría completo.
         Se deja escrito antes de abrirlo; `permisos-panel.js` lo lee y
         oculta lo que esa persona no alcanza. */
      try { localStorage.setItem("casaroca_panel_persona", bt.dataset.persona || ""); } catch (e) {}
      b.panelUrl = bt.dataset.url; b.panelLbl = bt.dataset.lbl;
      vista = "app-pastor"; pintar(); return;
    }
    if (a === "veriglesia") { b.verSede = bt.dataset.id; vista = "iglesia"; pintar(); return; }
    if (a === "verpersona") { b.verPersona = bt.dataset.id; vista = "persona"; pintar(); return; }
    if (a === "verefectivo"){ b.verPersona = bt.dataset.id; vista = "persona"; pintar(); return; }
    if (a === "verefectivo2"){ b.verPersona = bt.dataset.id; vista = "efectivo"; pintar(); return; }
    if (a === "agregarrol") { borrador = { personaId: bt.dataset.id }; vista = "crear"; pintar(); return; }
    if (a === "quitarol") { const b4 = b_(); delete (b4.sel || {})[bt.dataset.cod]; pintar(); return; }
    if (a === "afinar") { borrador = { afinarId: bt.dataset.id }; vista = "afinar"; pintar(); return; }
    if (a === "promover") { const per = M.asignaciones().find(x => x.id === bt.dataset.id);
      borrador = { promId: bt.dataset.id, verPersona: per && per.personaId };
      vista = "promover"; pintar(); return; }
    if (a === "hacer-promover") {
      const asg = M.asignaciones().find(x => x.id === b.promId);
      const r2 = M.promover(b.promId, { rol:b.rol, alcanceTipo:b.alcanceTipo,
        alcanceId:b.alcanceId || null, nivelMax:b.nivelMax, acta:b.acta }, YO);
      if (!r2.ok) { alert("No se puede:\n\n" + r2.fallos.join("\n")); return; }
      const per2 = asg && M.persona(asg.personaId);
      borrador = { verPersona: asg && asg.personaId };
      logro = { que:"acceso", personaId: asg && asg.personaId,
        detalle:`${per2 ? per2.nombre : "La persona"} pasa a ${(I.rol(b.rol)||{}).nombre || b.rol}. El rol anterior quedó cerrado, no borrado.` };
      vista = "hecho"; pintar(); return;
    }
    if (a === "delegar")    { M.alternarDelegacion(bt.dataset.id); pintar(); return; }
    if (a === "cerrar-sel") {
      const ids = Array.from(document.querySelectorAll("[data-marca]:checked")).map(x => x.dataset.marca);
      if (!ids.length) return;
      if (!confirm(`Se cerrará el acceso de ${ids.length} asignación(es). Queda registrado en la bitácora y no se borra nada. ¿Continuar?`)) return;
      M.revocarVarios(ids, "cierre en lote desde el master"); pintar(); return;
    }
    if (a === "perm-todos") {
      const b2 = b_(); b2.permisos = {};
      if (bt.dataset.niv) {
        const techo = b2.techo != null ? +b2.techo : 4;
        I.MODULOS.forEach(m => { if (m.nivel <= techo) b2.permisos[m.codigo] = bt.dataset.niv; });
      }
      pintar(); return;
    }
    if (a === "perm") {
      const rs = (borrador && borrador.rolPerm) || I.ROLES[0].codigo;
      const r2 = M.alternarPermiso(rs, bt.dataset.mod, bt.dataset.acc);
      if (!r2.ok) alert(r2.fallos.join("\n"));
      pintar(); return;
    }
    if (a === "cfg-sede")   { cfgSede = bt.dataset.id; pintar(); return; }
    if (a === "cfg-mod")    { M.alternarModulo(bt.dataset.sede, bt.dataset.mod); pintar(); return; }
    if (a === "gp-crear") {
      const v = i => { const e = $("#" + i); return e ? e.value.trim() : ""; };
      /* El centro de mando escribe sin pedirle permiso a nadie, pero pasa
         por las MISMAS validaciones: un grupo sin líder no se abre aquí
         tampoco. Las reglas son del sistema, no de la pantalla. */
      const r = M.crearGrupo({ sedeId: bt.dataset.sede, nombre: v("ms-gp-nombre"),
        lider: v("ms-gp-lider"), liderTel: v("ms-gp-tel"),
        ministerioCodigo: v("ms-gp-min") || null, dia: v("ms-gp-dia"),
        hora: v("ms-gp-hora"), zona: v("ms-gp-zona"), cupo: v("ms-gp-cupo") }, null);
      if (!r.ok) { alert("No se puede:\n\n" + r.fallos.join("\n")); return; }
      pintar(); return;
    }
    if (a === "gp-cerrar") {
      const motivo = prompt("Cerrar el grupo. ¿Por qué? (queda en la bitácora)");
      if (motivo === null) return;
      const r = M.cerrarGrupo(bt.dataset.id, null, motivo);
      if (!r.ok) { alert("No se puede:\n\n" + r.fallos.join("\n")); return; }
      pintar(); return;
    }
    if (a === "cfg-plant")  { M.aplicarPlantilla(bt.dataset.sede, bt.dataset.cod); pintar(); return; }

    /* ---- creaciones: si vino nombre nuevo, se crea la ficha primero ---- */
    function resolverPersona(campo) {
      if (b[campo]) return b[campo];
      const n = (b[campo + "_nueva"] || "").trim();
      return n ? M.crearPersona(n, "", "").id : "";
    }
    let logroSede = null;
    function hecho(r, que, detalle, codigo) {
      if (!r.ok) { alert("No se puede crear:\n\n" + r.fallos.join("\n")); return; }
      borrador = null;
      logro = { que, detalle, codigo, sedeId: logroSede || (b && b.sedeId) || null };
      vista = "hecho"; pintar();
    }
    if (a === "hacer-persona") {
      const extra = {};
      M.FICHA.forEach(c => { if (b[c.k]) extra[c.k] = b[c.k]; });
      extra.nombre = [b.primerNombre, b.segundoNombre, b.primerApellido, b.segundoApellido]
        .filter(Boolean).join(" ");
      const np = M.crearPersona(extra.nombre, b.documento, b.correo, extra);
      borrador = { verPersona: np.id };
      logro = { que:"persona", personaId:np.id, codigo:np.codigo,
        detalle:`${np.nombre} ya tiene ficha. Todavía no abre nada: falta darle sus roles.` };
      vista = "hecho"; pintar(); return;
    }
    if (a === "hacer-iglesia") {
      const nom = b.nombre, pl = I.plantilla(b.plantilla);
      const r2 = M.crearIglesia({ nombre:nom, ciudad:b.ciudad, pais:b.pais,
        plantilla:b.plantilla, pastorId:resolverPersona("pastorId"),
        esposaId:resolverPersona("esposaId"), otorgadoPor:YO.personaId });
      if (r2.ok) borrador = { verSede:r2.id };
      const sd = r2.ok && M.sedes().find(x => x.id === r2.id);
      if (r2.ok) { logroSede = r2.id; }
      hecho(r2, "iglesia",
        `${nom} queda con plantilla ${pl ? pl.nombre : ""}: ${b.plantilla ? I.modulosDePlantilla(b.plantilla).length : 0} de ${I.MODULOS.length} módulos, y su pastor ya puede entrar.`,
        sd && sd.codigo);
      return;
    }
    if (a === "hacer-ministerio") {
      const nom = b.nombre;
      hecho(M.crearMinisterio({ nombre:nom, sedeId:b.sedeId, permisos:b.permisos,
        liderId:resolverPersona("liderId"), otorgadoPor:YO.personaId }), "ministerio",
        `${nom} ya tiene director nombrado. Puede empezar a crear sus líderes de grupo.`);
      return;
    }
    if (a === "hacer-equipo") {
      const nom = b.nombre;
      hecho(M.crearEquipo({ nombre:nom, ambito:b.ambito, sedeId:b.sedeId, permisos:b.permisos,
        roles:b.roles || [], liderId:resolverPersona("liderId"), otorgadoPor:YO.personaId }), "equipo",
        `${nom} queda con su responsable, que ya recibió los roles del equipo.`);
      return;
    }
    if (a === "hacer-rol") { const nom = b.nombre, t = b.techo;
      hecho(M.crearRol({ nombre:nom, techo:t }), "rol",
        `${nom} existe con techo N${t}, pero todavía no puede hacer nada: hay que darle permisos.`); return; }
    if (a === "hacer-modulo") { const nom = b.nombre, n2 = b.nivel;
      hecho(M.crearModulo({ nombre:nom, nivel:n2 }), "modulo",
        `${nom} maneja dato N${n2}. Solo los roles con ese techo o mayor podrán alcanzarlo.`); return; }
    if (a === "ir") {
      if (borrador) { delete borrador.panelUrl; delete borrador.panelLbl; }
      const destino = NAV.find(x => x.id === bt.dataset.vista);
      if (destino && destino.src) {
        try { localStorage.setItem("casaroca_panel_persona", YO.personaId); } catch (e) {}
      }
      vista = bt.dataset.vista; pintar(); const m = $("#ms-main"); if (m) m.focus(); }
    if (a === "nivel")   { b_().nivelMax = +bt.dataset.n; pintar(); }
    if (a === "limpiar") { borrador = null; pintar(); }
    if (a === "revocar") {
      const r = M.revocar(bt.dataset.id, "cierre desde el master");
      if (!r.ok) alert(r.fallos.join("\n")); pintar();
    }
    if (a === "otorgar") {
      const bo = b_();
      let pid = bo.personaId;
      if (!pid && bo.nuevaPersona) pid = M.crearPersona(bo.nuevaPersona, "", "").id;
      const cods = Object.keys(bo.sel || {});
      const lista = cods.map(c => Object.assign({ personaId:pid, rol:c,
        desde:bo.desde || hoy(), hasta:bo.hasta || null }, bo.sel[c],
        { alcanceId: bo.sel[c].alcanceId || null }));
      const res = M.otorgarVarios(lista, YO);
      if (!res.ok) { alert("La base rechazaría esto:\n\n" + res.fallos.join("\n")); return; }
      const per = M.persona(pid);
      borrador = { verPersona: pid };
      logro = { que:"acceso", personaId:pid,
        detalle:`${per ? per.nombre : "La persona"} queda con ${cods.length} rol(es): ` +
          cods.map(c => (I.rol(c) || {}).nombre || c).join(", ") + "." };
      vista = "hecho"; pintar();
    }
  });
  document.addEventListener("change", e => {
    const b3 = b_();
    const sr = e.target.closest("[data-selrol]");
    if (sr) {
      const b4 = b_(); b4.sel = b4.sel || {};
      const cod = sr.dataset.selrol;
      if (sr.checked) {
        const r4 = I.rol(cod);
        b4.sel[cod] = { alcanceTipo: I.alcanceSugerido(cod) || "sede", alcanceId:"",
          nivelMax: Math.min(r4 ? r4.techo : 2, YO.techo), acta:"" };
      } else delete b4.sel[cod];
      pintar(); return;
    }
    const rc2 = e.target.closest("[data-rolcfg]");
    if (rc2) {
      const b4 = b_(); const cod = rc2.dataset.rolcfg, k = rc2.dataset.campo2;
      b4.sel[cod] = b4.sel[cod] || {};
      b4.sel[cod][k] = k === "nivelMax" ? +rc2.value : rc2.value;
      if (k === "alcanceTipo") b4.sel[cod].alcanceId = "";
      pintar(); return;
    }
    const mp = e.target.closest("[data-modpersona]");
    if (mp) { const r3 = M.alternarModuloPersona(b3.afinarId, mp.dataset.modpersona);
      if (!r3.ok) alert(r3.fallos.join("\n")); pintar(); return; }
    const de = e.target.closest("[data-destino]");
    if (de) { const r3 = M.alternarAlcance(b3.afinarId, de.dataset.destino);
      if (!r3.ok) alert(r3.fallos.join("\n")); pintar(); return; }
    const nm = e.target.closest("[data-nivmod]");
    if (nm) { const r3 = M.nivelDeModulo(b3.afinarId, nm.dataset.nivmod, +nm.dataset.niv);
      if (!r3.ok) alert(r3.fallos.join("\n")); pintar(); return; }
    if (e.target.dataset && e.target.dataset.accionChk === "modular") {
      b3.modularNivel = e.target.checked; pintar(); return; }
    const pr = e.target.closest("[data-perm-campo]");
    if (pr) {
      const b2 = b_(); const campo = pr.dataset.permCampo;
      b2[campo] = b2[campo] || {};
      if (pr.dataset.permNiv) b2[campo][pr.dataset.permMod] = pr.dataset.permNiv;
      else delete b2[campo][pr.dataset.permMod];
      pintar(); return;
    }
    const dl = e.target.closest("[data-delega]");
    if (dl) { M.alternarDelegacion(dl.dataset.delega); pintar(); return; }
    const rc = e.target.closest("[data-rol]");
    if (rc) {
      const b = b_(); b.roles = b.roles || [];
      const cod = rc.dataset.rol, i = b.roles.indexOf(cod);
      if (rc.checked && i < 0) b.roles.push(cod); else if (!rc.checked && i >= 0) b.roles.splice(i, 1);
      pintar(); return;
    }
    if (e.target.dataset && e.target.dataset.marca !== undefined) return;  // marcas de lote: sin repintar
    const c = e.target.closest("[data-campo]"); if (!c) return;
    const k = c.dataset.campo;
    if (k === "verPersona") { b_().verPersona = c.value; pintar(); return; }
    if (k === "filtro")     { filtro = c.value; pintar(); return; }
    b_()[k] = c.value;
    if (k === "alcanceTipo") borrador.alcanceId = "";
    if (k === "rol") { const r = I.rol(c.value);
      if (r && borrador.nivelMax > r.techo) borrador.nivelMax = r.techo; }
    pintar();
  });
  document.addEventListener("input", e => {
    const c = e.target.closest("[data-campo]");
    if (!c || c.tagName !== "INPUT") return;
    if (c.dataset.campo === "filtro") { filtro = c.value; pintar(); const f = $("[data-campo=filtro]");
      if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); } return; }
    b_()[c.dataset.campo] = c.value;
  });

  /* ============================================================
     BARRA DE COMANDOS · el gesto de Linear.
     Con 36 iglesias y 30 pestañas, el menú deja de servir: lo que
     sirve es escribir tres letras. Indexa pestañas, personas y roles.
     ============================================================ */
  let cmdAbierta = false, cmdSel = 0, cmdRes = [];

  function cmdIndice() {
    const idx = [];
    NAV.forEach(n => { if (!n.sep) idx.push({ t:"Pestaña", txt:n.lbl, ico:n.ico, ir:n.id }); });
    M.personas().forEach(p => {
      const vig = M.deLaPersona(p.id).filter(a => !a.hasta || a.hasta >= hoy());
      idx.push({ t:"Persona", txt:p.nombre, ico:"👤",
        pista: vig.length ? (I.rol(vig[0].rol)||{}).nombre : "sin acceso",
        ir:"efectivo", persona:p.id });
    });
    I.ROLES.forEach(r => idx.push({ t:"Rol", txt:r.nombre, ico:"🎭",
      pista:"techo N" + r.techo, ir:"roles" }));
    return idx;
  }
  function cmdPintar(q) {
    const norm = x => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const t = norm(q || "").trim();
    cmdRes = cmdIndice().filter(x => !t || norm(x.txt).indexOf(t) >= 0 || norm(x.t).indexOf(t) >= 0)
                        .slice(0, 40);
    if (cmdSel >= cmdRes.length) cmdSel = 0;
    const cont = document.getElementById("ms-cmd-lista"); if (!cont) return;
    cont.innerHTML = cmdRes.length
      ? cmdRes.map((x, i) => `<button class="ms-cmd__it ${i === cmdSel ? "is-sel" : ""}" data-cmd="${i}">
          <span>${x.ico}</span><span>${esc(x.txt)}</span>
          <em>${esc(x.pista || x.t)}</em></button>`).join("")
      : `<div class="ms-cmd__vac">Nada coincide con «${esc(q)}».</div>`;
  }
  function cmdIr(i) {
    const x = cmdRes[i]; if (!x) return;
    if (x.persona) { borrador = borrador || {}; borrador.verPersona = x.persona; }
    vista = x.ir; cmdCerrar(); pintar();
  }
  function cmdAbrir() {
    const c = document.getElementById("ms-cmd"); if (!c) return;
    cmdAbierta = true; cmdSel = 0; c.classList.add("is-on");
    const inp = document.getElementById("ms-cmd-in");
    inp.value = ""; cmdPintar(""); inp.focus();
  }
  function cmdCerrar() {
    cmdAbierta = false;
    const c = document.getElementById("ms-cmd"); if (c) c.classList.remove("is-on");
  }
  document.addEventListener("keydown", e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); cmdAbierta ? cmdCerrar() : cmdAbrir(); return; }
    if (!cmdAbierta) return;
    if (e.key === "Escape") { e.preventDefault(); cmdCerrar(); }
    if (e.key === "ArrowDown") { e.preventDefault(); cmdSel = Math.min(cmdSel + 1, cmdRes.length - 1); cmdPintar(document.getElementById("ms-cmd-in").value); }
    if (e.key === "ArrowUp")   { e.preventDefault(); cmdSel = Math.max(cmdSel - 1, 0); cmdPintar(document.getElementById("ms-cmd-in").value); }
    if (e.key === "Enter")     { e.preventDefault(); cmdIr(cmdSel); }
  });
  document.addEventListener("input", e => {
    if (e.target.id === "ms-cmd-in") { cmdSel = 0; cmdPintar(e.target.value); }
  });
  document.addEventListener("click", e => {
    if (e.target.id === "ms-cmd") { cmdCerrar(); return; }
    const it = e.target.closest("[data-cmd]");
    if (it) cmdIr(+it.dataset.cmd);
  });

  document.addEventListener("DOMContentLoaded", pintar);
  if (document.readyState !== "loading") pintar();
})();
