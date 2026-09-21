/* ============================================================
   CASA ROCA · EL PUENTE ENTRE EL MASTER Y LOS PANELES

   El defecto que esto arregla, encontrado por Daniel el 11 de
   septiembre de 2026: «le desactivé CRM y entré al sistema y aún lo
   podía ver». Tenía razón y era grave.

   Las apps por rol (pastor, director, líder, nicodemo, RocaKids,
   consejería) se escribieron antes que el sistema de permisos, y
   dibujaban su menú COMPLETO sin preguntarle a nadie. El master
   calculaba el permiso efectivo con todo rigor y luego nadie lo
   miraba: quedaba en un tablero bonito sin efecto.

   Este archivo lo conecta. Va en cada app junto a master-identidad.js
   y hace tres cosas:

     1. Averigua QUIÉN entró (el master lo deja escrito al abrir).
     2. Calcula qué módulos alcanza, con el mismo motor del master.
     3. Oculta las pestañas cuyo módulo no alcanza, y bloquea la
        navegación hacia ellas aunque alguien fuerce la URL.

   ⚠️ Esto es un control de INTERFAZ, no de seguridad. La seguridad de
   verdad la impone el RLS de PostgreSQL: aunque alguien borrara este
   archivo, la base seguiría sin devolverle filas ajenas. Aquí se evita
   ofrecer lo que allá va a ser negado, que es distinto.
   ============================================================ */
(function () {
  "use strict";
  const I = window.IDENTIDAD;
  if (!I) { console.warn("[permisos] falta master-identidad.js"); return; }

  /* ---------- 1 · qué pestaña corresponde a qué módulo ----------
     Se saca de las NAV reales de cada app, una por una. Si una pestaña
     no está aquí, se deja pasar: más vale mostrar de más que romper una
     app por un mapeo olvidado. */
  const MAPA = {
    "pastor.html": {
      analitica:"analitica", tareas:"tareas", crm:"crm", finanzas:"aportes",
      asistencia:"asistencia", organigrama:"organizacion", calendario:"calendario",
      grupos:"grupos", equipo:"talento", sirve:"talento", rocakids:"rocakids",
      tematicas:"tematicas", cursos:"formacion", oracion:"oracion",
      consejeria:"consejeria", requerimientos:"requerimientos", directorio:"personas",
    },
    "central.html": {
      tablero:"organizacion", crm:"crm", finanzas:"aportes", organigrama:"organizacion",
      calendario:"calendario", equipo:"talento", contabilidad:"aportes",
      tesoreria:"aportes", rrhh:"talento", legal:"legal", instituto:"formacion",
      comunicaciones:"comunicaciones", construccion:"construccion",
      peticiones:"peticiones", requerimientos:"requerimientos", directorio:"personas",
    },
    "director.html": {
      analitica:"analitica", crm:"crm", grupos:"grupos", equipo:"talento",
      nuevos:"crm", organigrama:"organizacion", tematicas:"tematicas",
      peticiones:"peticiones", calendario:"calendario",
    },
    "nicodemo.html": {
      analitica:"analitica", bucket:"crm", equipo:"talento",
      organigrama:"organizacion", peticiones:"peticiones", calendario:"calendario",
    },
    "lider.html": {
      resumen:"grupos", grupo:"grupos", analisis:"analitica",
      tematicas:"tematicas", tematicaDetalle:"tematicas",
      peticiones:"peticiones", notis:"peticiones", app:"grupos",
    },
    "rocakids-domingo.html":  { "*":"rocakids" },
    "rocakids-director.html": { "*":"rocakids" },
    "consejeria-consejero.html":   { "*":"consejeria" },
    "consejeria-coordinador.html": { "*":"consejeria" },
    "consejeria-director.html":    { "*":"consejeria" },
  };

  const archivo = location.pathname.split("/").pop() || "";
  const mapa = MAPA[archivo];
  if (!mapa) return;                       // app sin mapeo: no se toca

  /* ---------- 2 · quién entró ---------- */
  function contexto() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem("casaroca_master_v1") || "null"); } catch (e) {}
    /* ⛔ ESTA GUARDA ESTABA ANTES DE LA VISTA PREVIA Y LA MATABA.
       La vista previa trae SU PROPIA asignación de mentira, así que no
       necesita el censo del master para existir; solo lo necesita para
       saber qué módulos tiene encendidos la iglesia. Exigir `d` aquí
       arriba hacía que el botón «comprobar cómo se ve» contestara
       «este panel no tiene sesión» en cualquier navegador limpio.
       Ahora la falta de censo NO tumba la previa: sigue con el catálogo
       vacío, que es lo honesto (nada encendido todavía). El camino
       REAL sí sigue exigiendo censo: sin él no se sabe quién entra. */
    const censo = (d && d.asignaciones) ? d : null;
    /* Lo que la IGLESIA tiene encendido, primero: lo necesitan los dos
       caminos, el real y la vista previa. */
    const msRows = (censo && censo.modsede) || [];
    const activo = (sedeId, modulo) => {
      const r = msRows.find(x => x.sede === sedeId && x.modulo === modulo);
      return !!(r && r.activo);
    };

    /* ⭐ VISTA PREVIA. El master la usa para comprobar la configuración de
       una iglesia ANTES de que exista nadie a quien nombrar, que es
       justo cuando hace falta mirarla. No crea nada: es una asignación
       de mentira que vive en el navegador y se borra al salir. */
    let sim = null;
    try { sim = JSON.parse(localStorage.getItem("casaroca_panel_simulado") || "null"); } catch (e) {}
    if (sim && sim.rol) {
      return { persona: { nombre: sim.etiqueta || "Vista previa" },
               asignaciones: [sim], activoEnSede: activo, previa: true,
               datos: censo || { personas:[], asignaciones:[], modsede:[] } };
    }

    /* El camino REAL sí exige censo: sin él no hay forma de saber quién
       entra, y abrir a ciegas sería permitir por defecto. */
    if (!censo) return null;
    let pid = null;
    try { pid = localStorage.getItem("casaroca_panel_persona"); } catch (e) {}
    if (!pid) return null;                 // sin persona declarada, no se filtra
    const persona = (censo.personas || []).find(p => p.id === pid);
    const asig = censo.asignaciones.filter(a => a.personaId === pid);
    return { persona, asignaciones: asig, activoEnSede: activo, datos: censo };
  }

  const ctx = contexto();

  /* ⛔⛔ ESTO ESTABA AL REVÉS Y ERA EL DEFECTO DE FONDO.
     Antes, si no se sabía quién entraba, el panel se abría COMPLETO.
     Eso es «permitir por defecto», y en permisos la regla es la
     contraria: lo que no está otorgado, no se ve.

     Daniel lo dijo exacto: «si yo no le activo, él no debería ver nada».
     Tiene razón, y no es un matiz: con el criterio viejo bastaba con
     abrir pastor.html directamente, sin pasar por el master, para verlo
     todo. El control no servía de nada.

     Ahora sin sesión declarada no se muestra ni una pestaña, y se
     explica por qué en vez de dejar una pantalla muda. */
  if (!ctx) {
    cerrarTodo("Este panel no tiene sesión.",
      "Ábralo desde el sistema master, que es donde se dice quién entra y qué alcanza. " +
      "Abrirlo directamente no da acceso a nada: lo que no está otorgado, no se ve.");
    return;
  }
  if (ctx.previa) document.documentElement.setAttribute("data-vista-previa", "1");

  /* ============================================================
     2 bis · QUIÉN DICE EL PANEL QUE ENTRÓ
     ------------------------------------------------------------
     Segundo defecto que Daniel encontró el 11 de septiembre, y es
     hermano del anterior: «aparece un tal Camilo». Tenía razón.

     Cada app de Fase 0 trae cableada su propia identidad de
     demostración (PASTOR_USER, DIRECTOR_USER, NICO_USER, la USER de
     central) y su pantalla de entrada la usaba sin preguntarle a
     nadie. Resultado: el centro de mando decía «entra Julián Prieto,
     pastor de Barcelona» y el panel saludaba a Camilo Restrepo, de
     Bogotá Chicó. El master mandaba y el panel no lo escuchaba, que es
     justo lo contrario de la regla: lo que se pone en el centro de
     mando es lo que se ve en la iglesia local.

     Se puede arreglar sin tocar las cuatro apps porque todas toman su
     usuario POR REFERENCIA (`const USER = P.PASTOR_USER`). Basta con
     reescribir ESE objeto antes del primer dibujo: este archivo es
     síncrono y las apps pintan en DOMContentLoaded.
     ============================================================ */
  const IDENT = {
    "pastor.html":   () => window.PASTOR  && window.PASTOR.PASTOR_USER,
    "director.html": () => window.DIRECTOR && window.DIRECTOR.DIRECTOR_USER,
    "nicodemo.html": () => window.NICO    && window.NICO.NICO_USER,
    "central.html":  () => window.CENTRAL && window.CENTRAL.USER,
    /* ⛔ Estos SEIS faltaban, y por eso seguían saludando a su usuario de
       demostración aunque el centro de mando dijera quién entró. Era el
       mismo fallo del «Camilo Restrepo» de Bogotá Chicó que Daniel
       reportó el 11 de septiembre, sin cerrar en el resto de las apps. */
    "lider.html":                  () => window.LIDERAPP && window.LIDERAPP.LIDER,
    "rocakids-director.html":      () => window.RKDIR && window.RKDIR.DIRECTOR_USER,
    "rocakids-domingo.html":       () => window.RKDIR && window.RKDIR.DIRECTOR_USER,
    "consejeria-director.html":    () => window.CONSE && window.CONSE.DIRECTOR_USER,
    "consejeria-coordinador.html": () => window.CONSE && window.CONSE.COORDINADOR_USER,
    "consejeria-consejero.html":   () => window.CONSE && window.CONSE.CONSEJERO_USER,
  };

  function iniciales(n) {
    return String(n || "").trim().split(/\s+/).slice(0, 2)
      .map(x => x.charAt(0).toUpperCase()).join("") || "CR";
  }
  function nombreSede(sedeId) {
    const ss = (ctx.datos && ctx.datos.sedes) || [];
    const s = ss.find(x => x.id === sedeId);
    return s ? s.nombre : null;
  }

  /* La asignación que manda es la de esta app: la de mayor alcance que
     traiga la persona. Con una sola, es esa. */
  const asigMandante = (ctx.asignaciones || [])[0] || null;
  let sedeDeclarada = null;

  (function suplantar() {
    const traer = IDENT[archivo];
    const U = traer && traer();
    if (!U || !asigMandante) return;

    const rl = I.rol(asigMandante.rol);
    const nom = (ctx.persona && ctx.persona.nombre) || (rl ? rl.nombre : "Sin nombre");
    sedeDeclarada = asigMandante.alcanceTipo === "sede"
      ? nombreSede(asigMandante.alcanceId) : null;

    U.nombre = nom;
    U.iniciales = iniciales(nom);
    if (rl) U.rol = rl.nombre;
    /* ⛔ EL CORREO SE REESCRIBE SIEMPRE, NO SOLO SI EL MASTER LO TRAE.
       Antes solo se tocaba cuando la persona tenía correo registrado, y
       las personas sembradas lo tienen vacío. Resultado: el panel decía
       «Julián Prieto» con el correo de Franklin Peña debajo. Un nombre
       con la dirección de otro no es un detalle estético: es la clase de
       incoherencia por la que alguien escribe al buzón equivocado.
       Si el master no sabe el correo, se deriva del nombre en el dominio
       de la iglesia, que es honesto y no señala a nadie real. */
    if (ctx.persona && ctx.persona.correo) {
      U.email = ctx.persona.correo;
    } else if (nom) {
      U.email = nom.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/^(ps|pastor|pastora)\.?\s+/, "")
        .trim().split(/\s+/).slice(0, 2).join(".")
        .replace(/[^a-z.]/g, "") + "@casaroca.org";
    }
    if (sedeDeclarada) U.sede = sedeDeclarada;

    /* El nombre de la sede en el encabezado del panel del pastor vive
       aparte del usuario. Se cambia solo la etiqueta, NUNCA el id: hay
       datos colgados de ese id. */
    const SD = window.PASTOR && window.PASTOR.SEDE;
    if (SD && sedeDeclarada) SD.nombre = sedeDeclarada;
  })();
  const alcanzados = I.permisoEfectivo(ctx.asignaciones, null, null, ctx.activoEnSede)
    .map(x => x.modulo);
  /* Si el mapa dice "*", la app entera depende de un solo módulo. */
  const moduloDeLaApp = mapa["*"] || null;

  /* ⛔⛔ ESCAPE REAL DE DATO N4, ENCONTRADO EL 15 SEP 2026 AUDITANDO.
     Cuando una app ENTERA depende de un módulo (`"*"`), no se puede
     confiar en encontrar pestañas que ocultar: el filtro solo mira
     `[data-vista]`, y `rocakids-domingo.js` marca sus pantallas con
     `data-screen`. Resultado medido en PRODUCCIÓN: una persona con techo
     N2 abría el check-in dominical de RocaKids con sus 5 pantallas
     visibles, es decir, DATOS DE MENORES (N4). El panel de dirección de
     RocaKids sí cerraba, y por eso no se había notado.

     La regla correcta no depende del DOM: si la app entera cuelga de un
     módulo y la persona no lo alcanza, se cierra la app. Punto. Ocultar
     pestañas es para las apps que mezclan módulos; aquí no hay nada que
     mezclar. */
  if (moduloDeLaApp && alcanzados.indexOf(moduloDeLaApp) < 0) {
    const m = I.modulo ? I.modulo(moduloDeLaApp) : null;
    cerrarTodo("Este panel no está a su alcance.",
      "Todo lo que hay aquí pertenece a " + ((m && m.nombre) || moduloDeLaApp) +
      ", y ese módulo no le ha sido otorgado en esta iglesia. " +
      "Si debería tenerlo, se concede desde el sistema master.");
    return;
  }

  const sinMapear = [];
  const permitido = id => {
    if (moduloDeLaApp) return alcanzados.indexOf(moduloDeLaApp) >= 0;
    const m = mapa[id];
    if (!m) { if (sinMapear.indexOf(id) < 0) sinMapear.push(id); return false; }
    return alcanzados.indexOf(m) >= 0;
  };

  /* ---------- 3 · aplicar, y volver a aplicar ----------
     Las apps redibujan su menú entero en cada navegación, así que no
     basta con filtrar una vez: hay que observar el DOM. */
  function cerrarTodo(titulo, detalle) {
    const pinta = () => {
      if (document.getElementById("cr-sin-sesion")) return;
      const d = document.createElement("div");
      d.id = "cr-sin-sesion";
      d.style.cssText = "position:fixed;inset:0;z-index:99999;background:#fafafa;" +
        "display:grid;place-items:center;padding:24px;" +
        "font:400 14px/21px Inter,system-ui,sans-serif;color:#57575e";
      d.innerHTML = "<div style='max-width:420px;text-align:center;background:#fff;" +
        "border:1px solid #e6e6e9;border-radius:12px;padding:32px'>" +
        "<div style='width:40px;height:40px;margin:0 auto 16px;border-radius:10px;" +
        "background:#134291;color:#fff;display:grid;place-items:center;font-weight:600'>CR</div>" +
        "<div style='font-size:17px;font-weight:600;color:#1c1c1f;margin-bottom:8px'>" + titulo + "</div>" +
        "<div style='font-size:13px;line-height:20px'>" + detalle + "</div></div>";
      document.body.appendChild(d);

      /* ⛔ Y SE VACÍA LO QUE HAY DEBAJO, no solo se tapa.
         Una capa encima deja el contenido en el DOM: sigue en la
         memoria del navegador, sale en una captura de pantalla si algo
         falla al pintar, y se lee con dos clics en el inspector.
         Para N3 y N4 eso no basta. Se marca el documento y una regla CSS
         esconde TODO lo que no sea este aviso, así también desaparece lo
         que la app dibuje después. */
      document.documentElement.setAttribute("data-panel-cerrado", "1");
      if (!document.getElementById("cr-css-cerrado")) {
        const st = document.createElement("style");
        st.id = "cr-css-cerrado";
        st.textContent =
          "html[data-panel-cerrado] body > *:not(#cr-sin-sesion){display:none!important;visibility:hidden!important}";
        document.head.appendChild(st);
      }
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", pinta);
    else pinta();
    new MutationObserver(pinta).observe(document.documentElement, { childList: true, subtree: true });
  }

  function aplicar() {
    let ocultas = 0;
    document.querySelectorAll("[data-vista]").forEach(el => {
      const v = el.dataset.vista;
      if (!v || permitido(v)) return;
      el.style.display = "none";
      el.setAttribute("data-permiso-oculto", "1");
      ocultas++;
    });
    return ocultas;
  }

  /* Si alguien fuerza la navegación a una vista vedada, se corta el
     clic antes de que la app la pinte. */
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-vista]");
    if (!b) return;
    if (permitido(b.dataset.vista)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    alert("Su rol no alcanza esta sección.\n\nSi debería verla, pídalo en el sistema master: es ahí donde se otorga.");
  }, true);

  function aviso(n) {
    if (document.getElementById("cr-aviso-permisos")) return;
    /* Puede llegar 0 porque en esta pasada no se ocultó nada nuevo, y
       aun así haber secciones ocultas de antes. Se cuenta el total. */
    const total = document.querySelectorAll("[data-permiso-oculto]").length || n;
    if (!total) return;
    n = total;
    const d = document.createElement("div");
    d.id = "cr-aviso-permisos";
    d.style.cssText = "position:fixed;bottom:12px;left:12px;z-index:9999;max-width:320px;" +
      "background:#fff;border:1px solid #e6e6e9;border-left:3px solid #134291;border-radius:8px;" +
      "padding:9px 12px;font:400 12px/17px Inter,system-ui,sans-serif;color:#57575e;" +
      "box-shadow:0 4px 12px rgba(20,20,24,.08)";
    /* ⚠️ Decir la verdad sobre las CIFRAS, no solo sobre las pestañas.
       El panel entra ya con el nombre y la iglesia correctos, pero los
       números que pinta siguen siendo el conjunto sembrado de Fase 0.
       Callarlo sería cambiar un engaño por otro: alguien leería que
       Barcelona tiene 1.763 personas. Mientras los paneles no lean del
       centro de mando, se avisa. */
    const demo = window.PASTOR && window.PASTOR.SEDE_DEMO_NOMBRE;
    const mezcla = sedeDeclarada && demo && sedeDeclarada !== demo;
    d.innerHTML = "<b style='color:#1c1c1f'>" + (ctx.persona ? ctx.persona.nombre : "Sesión") + "</b><br>" +
      n + " sección(es) ocultas porque " + (ctx.previa ? "este rol" : "su rol") + " no las alcanza. " +
      "<span style='color:#8b8b93'>" +
      (ctx.previa ? "Vista previa: nadie ocupa este rol todavía." : "Se otorgan en el centro de mando.") +
      "</span>" +
      (mezcla ? "<br><span style='color:#8b8b93'>Las cifras siguen siendo el conjunto de prueba de " +
        demo + ", no de " + sedeDeclarada + ".</span>" : "");
    document.body.appendChild(d);
  }

  /* ⛔⛔ ESCONDER EL BOTÓN NO ES QUITAR EL ACCESO.
     Visto el 11 de septiembre con el panel ya corregido: a Julián le
     quedaba una sola pestaña en la barra, «Directorio», y aun así la
     pantalla mostraba la Analítica completa de la sede, con sus 1.763
     personas y sus aportes. La razón es simple y fácil de pasar por
     alto: cada app arranca en una vista fija (`analitica`), y nosotros
     ocultábamos el botón que lleva a ella sin sacarlo de la pantalla.

     Era el mismo defecto de fondo que Daniel ya había señalado antes,
     «le desactivé CRM y aún lo podía ver», solo que por la puerta de
     atrás: no por navegar, sino por quedarse donde el panel abre solo.

     Si la vista en curso no está otorgada, se lleva a la primera que sí
     lo esté. */
  let llevado = false;
  function llevarADondeSiAlcanza() {
    const enCurso = document.querySelector('nav [data-vista][aria-current="page"]')
      || document.querySelector("nav [data-vista].is-active");
    if (enCurso && permitido(enCurso.dataset.vista)) { llevado = false; return; }
    const destino = Array.from(document.querySelectorAll("nav [data-vista]"))
      .find(el => permitido(el.dataset.vista));
    if (!destino || llevado) return;
    llevado = true;                      // un solo intento por render
    destino.click();
  }

  function ciclo() {
    const n = aplicar();
    const quedan = Array.from(document.querySelectorAll("[data-vista]"))
      .filter(el => el.style.display !== "none").length;
    /* Si no alcanza ni una sola pestaña, no se deja una app vacía y
       confusa: se dice claramente que no tiene nada otorgado aquí. */
    if (!quedan && document.querySelectorAll("[data-vista]").length) {
      cerrarTodo((ctx.persona ? ctx.persona.nombre : "Esta persona") + " no tiene nada aquí.",
        "No se le ha otorgado ningún módulo de este panel. Se otorgan en el sistema master, " +
        "en la ficha de la persona o en la de su iglesia.");
      return;
    }
    if (sinMapear.length) console.info("[permisos] pestañas sin mapear, ocultas por defecto:", sinMapear);
    llevarADondeSiAlcanza();
    aviso(n);
  }
  /* ⚠️ El aviso no llegaba nunca a verse, y era un fallo silencioso.
     `ciclo()` corre al cargar, cuando el panel todavía enseña su pantalla
     de entrada y no existe una sola pestaña que contar: se ocultaban 0 y
     el aviso se callaba con razón. Después del login aparecían las 17 de
     golpe, pero ahí ya solo corría `aplicar()`, que oculta y no explica.

     Resultado: al pastor le faltaban 16 secciones y nadie le decía por
     qué. Ocultar sin explicar es como no tener permisos: se lee como que
     el sistema está roto. Ahora el observador vuelve a pasar el ciclo
     entero, con freno para no encadenarse con sus propios cambios. */
  let pendiente = null;
  function reevaluar() {
    if (pendiente) return;
    pendiente = setTimeout(() => { pendiente = null; ciclo(); }, 60);
  }
  document.addEventListener("DOMContentLoaded", ciclo);
  if (document.readyState !== "loading") ciclo();
  new MutationObserver(() => { aplicar(); reevaluar(); })
    .observe(document.documentElement, { childList: true, subtree: true });
})();
