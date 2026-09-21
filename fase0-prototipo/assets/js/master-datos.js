/* ============================================================
   CASA ROCA · EL CANAL ENTRE EL CENTRO DE MANDO Y LA IGLESIA LOCAL

   Orden de Daniel, 11 de septiembre de 2026:
     «todo debe funcionar desde el centro de mando, todo lo que se ponga
      allí es lo que debe aparecer en las diferentes iglesias locales, y
      cada pastor debe tener el acceso de crear y modificar ministerios y
      grupos pequeños (aunque desde el centro de mando también); la idea
      es que cada pastor arme su equipo y ministerio y grupos pequeños».

   Hasta hoy cruzaban dos cosas del master al panel: QUÉ módulos ve la
   persona y, desde esta misma mañana, QUIÉN es. Los datos no cruzaban
   nada: cada app pintaba su propio juego sembrado. Por eso una iglesia
   nueva como Barcelona nacía enseñando los ministerios y los grupos de
   Bogotá Chicó, que no son suyos.

   Este archivo abre el tercer carril, el de los datos, y lo abre en los
   DOS sentidos:

     leer    · window.CENTRO.ministerios() / .grupos()  → lo que el centro
               de mando tiene puesto para ESTA iglesia, no para otra.
     escribir· .crearGrupo() / .editarGrupo() / .cerrarGrupo()
               .crearMinisterio()
               → el pastor construye su iglesia desde su panel, y queda
                 escrito en el mismo sitio del que bebe el centro de mando.

   ⚠️ Escribir pasa por las mismas tres puertas que mirar: la iglesia tiene
   que tener el módulo encendido, la persona tiene que alcanzarlo, y el
   alcance tiene que ser esa sede. No hay una puerta trasera para el
   pastor: que pueda construir su equipo no es una excepción al permiso,
   es un permiso más.
   ============================================================ */
(function () {
  "use strict";
  const M = window.MSTORE, I = window.IDENTIDAD;
  if (!M || !I) { console.warn("[centro] falta master-store.js o master-identidad.js"); return; }

  /* Quién entró y a qué iglesia. Es la misma lectura que hace el puente
     de permisos: una sola verdad sobre la sesión, no dos que se
     contradigan. */
  function sesion() {
    let sim = null, pid = null;
    try { sim = JSON.parse(localStorage.getItem("casaroca_panel_simulado") || "null"); } catch (e) {}
    if (sim && sim.rol) {
      return { personaId:null, previa:true, rol:sim.rol,
               alcanceTipo: sim.alcanceTipo || null,
               sedeId: sim.alcanceTipo === "sede" ? sim.alcanceId : null,
               todaLaRed: sim.alcanceTipo === "organizacion",
               asignaciones: [sim] };
    }
    try { pid = localStorage.getItem("casaroca_panel_persona"); } catch (e) {}
    if (!pid) return null;
    const hoy = new Date().toISOString().slice(0, 10);
    const asg = M.deLaPersona(pid).filter(a => !a.hasta || a.hasta >= hoy);

    /* ⛔ ESTO ESTABA ROTO Y DEJABA A LA DIRECCIÓN GENERAL SIN CANAL.
       Antes solo se buscaba una asignación de alcance SEDE. El Pastor
       Director General tiene alcance ORGANIZACIÓN, así que no encontraba
       nada, `sedeId` quedaba en null y `puede()` devolvía false SIEMPRE:
       el panel de la Dirección General no podía leer ni escribir nada
       del centro de mando, aunque es quien más alcance tiene de todos.
       Ahora el canal entiende los cinco alcances del catálogo. */
    const org    = asg.find(a => a.alcanceTipo === "organizacion");
    const deSede = asg.find(a => a.alcanceTipo === "sede");
    const otra   = asg[0] || {};
    const principal = org || deSede || otra;

    return {
      personaId: pid, previa: false,
      rol: principal.rol || null,
      alcanceTipo: principal.alcanceTipo || null,
      /* Con alcance de organización NO hay una sede: hay todas. Se deja
         en null a propósito y se resuelve con `sedes()`. */
      sedeId: org ? null : (deSede ? deSede.alcanceId : null),
      todaLaRed: !!org,
      asignaciones: asg
    };
  }

  const S = sesion();
  if (!S) return;                                  // sin sesión no se abre el canal
  const sede = S.sedeId ? (M.sedes().find(x => x.id === S.sedeId) || null) : null;

  /* ============================================================
     EL ALCANCE, RESUELTO UNA SOLA VEZ
     Qué iglesias alcanza quien entró. Con alcance de organización son
     todas; con alcance de sede, la suya; con cualquier otro, ninguna
     completa (un líder ve su grupo, no su iglesia).
     Todos los paneles preguntan aquí en vez de sembrar su propio juego
     de datos, que es lo que hacía que cinco archivos distintos tuvieran
     cinco «Andrés Lozano» diferentes, cada uno con su propio id.
     ============================================================ */
  function sedesAlcanzadas() {
    if (S.todaLaRed) return M.sedes();
    if (S.sedeId) { const x = M.sedes().find(y => y.id === S.sedeId); return x ? [x] : []; }
    return [];
  }
  function sedesIds() { return sedesAlcanzadas().map(x => x.id); }

  /* En vista previa nadie ha sido nombrado todavía, así que no hay a quién
     atribuir lo que se escriba. Se puede MIRAR, no escribir: si no, el
     sistema acumularía grupos creados por «nadie». */
  function escritor(sedeDestino) {
    if (S.previa) return { ok:false, razon:"Esto es una vista previa: no hay nadie nombrado a quien atribuir el cambio. Nombre al pastor en el centro de mando y vuelva a entrar." };
    /* Con alcance de ORGANIZACIÓN no hay una sede fija, y eso no es un
       impedimento: es que hay que decir en CUÁL se está escribiendo. La
       Dirección General crea un grupo en Barcelona nombrando Barcelona.
       Antes esta guarda la bloqueaba, porque daba por hecho que toda
       sesión tenía una sola iglesia. */
    const id = sedeDestino || S.sedeId;
    if (!id) return { ok:false, razon:"Diga en qué iglesia se escribe: esta sesión alcanza varias." };
    if (sedesIds().indexOf(id) < 0)
      return { ok:false, razon:"Esa iglesia queda fuera de su alcance." };
    return { ok:true, sedeId:id };
  }

  /* El primer argumento puede traer `sedeId`: así la misma llamada sirve
     al pastor (una iglesia) y a la Dirección General (cualquiera de la red). */
  function envolver(fn) {
    return function () {
      const a0 = arguments[0];
      const destino = (a0 && typeof a0 === "object" && a0.sedeId) ? a0.sedeId : null;
      const e = escritor(destino);
      if (!e.ok) return { ok:false, fallos:[e.razon] };
      return fn.apply(null, [].slice.call(arguments).concat([e.sedeId]));
    };
  }

  window.CENTRO = {
    sedeId:     S.sedeId,
    sedeNombre: sede ? sede.nombre : null,
    personaId:  S.personaId,
    previa:     S.previa,

    /* ¿Puede quien entró tocar este módulo en esta iglesia? La pantalla
       pregunta esto ANTES de ofrecer un botón, para no ofrecer lo que la
       escritura va a rechazar. */
    puede(modulo, sedeId) {
      if (S.previa) return false;
      const id = sedeId || S.sedeId || sedesIds()[0];
      if (!id) return false;
      return M.puedeEnSede(S.personaId, id, modulo).ok;
    },
    porQueNo(modulo, sedeId) {
      if (S.previa) return "Vista previa: se puede mirar, no escribir.";
      const id = sedeId || S.sedeId || sedesIds()[0];
      if (!id) return "Esta sesión no alcanza ninguna iglesia.";
      const v = M.puedeEnSede(S.personaId, id, modulo);
      return v.ok ? "" : v.razon;
    },

    /* ---- vocabulario COMÚN de todos los paneles ----
       Un solo sitio del que beben la Dirección General, el pastor, el
       director de ministerio, el líder, Nicodemo, RocaKids y Consejería.
       Si una pantalla necesita un dato de la iglesia, lo pide aquí. */
    alcance:   S.alcanceTipo,
    todaLaRed: !!S.todaLaRed,
    rol:       S.rol,

    yo() {
      if (S.previa) return { id:null, nombre:"Vista previa", rol:S.rol, previa:true };
      const p = M.persona(S.personaId) || {};
      return { id:S.personaId, nombre:p.nombre || "", codigo:p.codigo || "",
               rol:S.rol, alcance:S.alcanceTipo, previa:false };
    },

    /* Las iglesias que esta sesión alcanza. La Dirección General las ve
       todas; un pastor, la suya. Nadie tiene que saber cuál es cuál. */
    sedes()    { return sedesAlcanzadas(); },
    sedesIds() { return sedesIds(); },

    /* ⭐ Acepta una sede explícita para que la Dirección General pueda
       mirar DENTRO de cualquier iglesia de la red sin cambiar de sesión,
       y sin que el panel del pastor tenga que cambiar: si no se pasa
       nada, sigue respondiendo lo de SU iglesia, como hasta ahora. */
    ministerios(sedeId) {
      const ids = sedeId ? [sedeId] : sedesIds();
      return ids.reduce((a, id) => a.concat(M.ministeriosDeSede(id)), []);
    },
    grupos(sedeId) {
      const ids = sedeId ? [sedeId] : sedesIds();
      return ids.reduce((a, id) => a.concat(M.gruposDeSede(id)), []);
    },
    equipos() { return (M.equipos ? M.equipos() : []); },

    /* Las PERSONAS del centro de mando. Es la pieza que faltaba para que
       los paneles dejen de inventarse su propia gente. */
    personas(sedeId) {
      const ids = sedeId ? [sedeId] : sedesIds();
      if (!ids.length) return [];
      const conAcceso = {};
      M.asignaciones().forEach(a => {
        if (a.alcanceTipo === "sede" && ids.indexOf(a.alcanceId) >= 0) conAcceso[a.personaId] = true;
        if (a.alcanceTipo === "organizacion" && S.todaLaRed) conAcceso[a.personaId] = true;
      });
      return M.personas().filter(p => conAcceso[p.id]);
    },

    /* Qué módulos tiene encendidos una iglesia. Lo pregunta cada panel
       antes de pintar una pestaña, para no ofrecer lo que no hay. */
    modulosDe(sedeId) {
      const id = sedeId || S.sedeId;
      if (!id) return [];
      return M.modsede().filter(x => x.sede === id && x.activo).map(x => x.modulo);
    },

    crearGrupo:  envolver((d, _b, _c, sedeOk) => M.crearGrupo(Object.assign({}, d, { sedeId: sedeOk }), S.personaId)),
    editarGrupo: envolver((id, c) => M.editarGrupo(id, c, S.personaId)),
    cerrarGrupo: envolver((id, m) => M.cerrarGrupo(id, m ? String(m) : "", S.personaId)),

    crearMinisterio: envolver(d => {
      const destino = d.sedeId || S.sedeId || sedesIds()[0];
      const v = M.puedeEnSede(S.personaId, destino, "organizacion");
      if (!v.ok) return { ok:false, fallos:[v.razon] };
      /* Un ministerio no se crea sin director: la regla es del master y
         aquí no se salta. Si el pastor no eligió a nadie, se queda él,
         que es quien responde por su iglesia mientras nombra. */
      return M.crearMinisterio(Object.assign({}, d, {
        sedeId: destino, liderId: d.liderId || S.personaId, otorgadoPor: S.personaId }));
    }),
  };
})();
