/* ============================================================
   CASA ROCA · DATOS + STORE del EQUIPO OPERATIVO "NICODEMO"
   (Ministerio de NUEVOS) — Capa de sede (filial).

   Nicodemo es el equipo fuerte de SEGUIMIENTO: TODA persona nueva
   que llega por cualquier puerta (QR de un ministerio, asistencia
   del domingo, página web, YouTube o redes) entra y pasa por aquí.
   Desde el "bucket de nuevos" Nicodemo la dirige al MINISTERIO que
   mejor le corresponde y vela porque quede conectada y porque su
   líder esté hablando con ella.

   Demo: sede Bogotá Chicó. El grupo "Café & Palabra" (af_j25_cafe)
   se lee EN VIVO de window.STORE, así que los inscritos del landing
   y de la app del líder aparecen como nuevos reales en Nicodemo.

   Lo demás (nuevos por funnel, equipo, organigrama, peticiones,
   eventos, espacios) son datos del equipo, persistidos en
   localStorage vía window.NSTORE (mismo patrón que STORE/DSTORE).
   En Fase 1 (Supabase) este puente desaparece.

   Expone: window.NICO (constantes/seed) y window.NSTORE (estado).
   ============================================================ */
(function () {
  const S = window.STORE;
  const DB = window.DB;

  const NICO_USER = {
    nombre: "Paola Restrepo",
    email: "paola.restrepo@casaroca.org",
    iniciales: "PR",
    rol: "Coordinadora de Nicodemo",
    sede: "Bogotá Chicó",
  };

  // Grupo en vivo (STORE) — sus inscritos entran como nuevos de Nicodemo
  const AF_LIVE = "af_j25_cafe";

  /* ---------------------------------------------------------------
     FUNNELS — las puertas por las que llega la gente. TODO entra por
     una de estas y pasa por Nicodemo.
     --------------------------------------------------------------- */
  const FUNNELS = [
    { id: "ministerios", lbl: "Ministerios (QR)", ico: "🎟️", color: "var(--azul-600)", desc: "QR propio de cada ministerio" },
    { id: "domingo", lbl: "Asistencia domingos", ico: "⛪", color: "var(--mostaza-500)", desc: "Registro presencial del servicio" },
    { id: "web", lbl: "Página web", ico: "🌐", color: "var(--etapa-conecta)", desc: "Formularios del sitio web" },
    { id: "youtube", lbl: "YouTube", ico: "▶️", color: "#C13A2B", desc: "Transmisión y canal" },
    { id: "redes", lbl: "Redes sociales", ico: "📱", color: "var(--etapa-crece)", desc: "Instagram · Facebook · TikTok" },
  ];
  const FUNNEL_MAP = FUNNELS.reduce((o, f) => (o[f.id] = f, o), {});

  // Sub-fuente (qué QR / qué formulario) por funnel — para la analítica fina
  const FUENTES = {
    ministerios: ["QR J+25", "QR RocaKids", "QR Casa2", "QR tMt", "QR Mujer Integral", "QR Hombres de Bien", "QR Josués", "QR AMEC"],
    domingo: ["Servicio 8:00 am", "Servicio 10:00 am", "Servicio 12:00 m", "Servicio 5:00 pm"],
    web: ["Formulario «Soy nuevo»", "«Quiero un grupo»", "«Pide oración»", "Bautizos"],
    youtube: ["Transmisión del domingo", "Video «Llaves del Poder»", "Canal Casa Roca"],
    redes: ["Instagram", "Facebook", "TikTok"],
  };

  // Ministerios destino (catálogo real del sistema). Para asignar.
  function ministeriosDestino() {
    const todos = (DB && DB.MINISTERIOS) ? DB.MINISTERIOS : [];
    // congregacionales activos + operativos activos (a donde se conecta a un nuevo)
    return todos.filter(m => m.activo).map(m => ({ id: m.id, nombre: m.nombre, ico: m.ico, tipo: m.tipo }));
  }
  function nombreMinisterio(id) {
    const m = (DB && DB.MINISTERIOS) ? DB.MINISTERIOS.find(x => x.id === id) : null;
    return m ? m.nombre : (id || "—");
  }
  function icoMinisterio(id) {
    const m = (DB && DB.MINISTERIOS) ? DB.MINISTERIOS.find(x => x.id === id) : null;
    return m ? m.ico : "📍";
  }

  /* ---------- helpers de construcción ---------- */
  let _seq = 0;
  function uid(pfx) { return pfx + "_" + (Date.now().toString(36)) + "_" + (++_seq); }
  function hoyISO() { return new Date().toISOString().slice(0, 10); }
  function deaccent(s) { return String(s).normalize("NFD").replace(/[̀-ͯ]/g, ""); }

  /* ---------- generador determinista de nuevos ----------
     NOMBRES = [["Nombres","Apellidos","F|M"], ...]. A partir del índice
     deriva funnel, fuente, fecha de llegada, estado y demás, de forma
     determinista (la demo se ve igual siempre). */
  const ESTADOS = ["sin_contactar", "contactado", "en_seguimiento", "conectado"];
  // fechas de llegada (más densas hacia jun 2026 = "hoy" demo)
  const FECHAS = [
    "2026-02-15", "2026-03-08", "2026-03-22", "2026-04-05", "2026-04-19",
    "2026-05-03", "2026-05-10", "2026-05-17", "2026-05-24", "2026-05-31",
    "2026-06-02", "2026-06-04", "2026-06-06", "2026-06-07", "2026-06-09",
    "2026-06-10", "2026-06-11", "2026-06-12", "2026-06-13", "2026-06-14",
  ];
  const EC_F = ["Soltera", "Soltera", "Casada", "Unión libre", "Soltera"];
  const EC_M = ["Soltero", "Soltero", "Casado", "Unión libre", "Soltero"];
  // a qué ministerio se conecta un nuevo según su QR/interés (demo)
  const QR_MIN = {
    "QR J+25": "m_j25", "QR RocaKids": "m_rocakids", "QR Casa2": "m_casa2",
    "QR tMt": "m_tmt", "QR Mujer Integral": "m_mujer", "QR Hombres de Bien": "m_hombres",
    "QR Josués": "m_josues", "QR AMEC": "m_amec",
  };
  const MIN_POR_EDAD = e => e <= 25 ? "m_tmt" : e <= 35 ? "m_j25" : e <= 55 ? "m_josues" : "m_dorados";

  const NOMBRES = [
    ["Mariana", "Quiroga", "F"], ["Esteban", "Salcedo", "M"], ["Paula", "Cifuentes", "F"],
    ["Ricardo", "Ovalle", "M"], ["Daniela", "Montoya", "F"], ["Camilo", "Arenas", "M"],
    ["Verónica", "Lozano", "F"], ["Andrés", "Bustos", "M"], ["Lina", "Castaño", "F"],
    ["Javier", "Pinzón", "M"], ["Carolina", "Rincón", "F"], ["Felipe", "Aguilar", "M"],
    ["Sara", "Naranjo", "F"], ["Mateo", "Escobar", "M"], ["Valentina", "Suárez", "F"],
    ["Sebastián", "Cárdenas", "M"], ["Juliana", "Peña", "F"], ["Nicolás", "Vargas", "M"],
    ["Adriana", "Forero", "F"], ["Óscar", "Murillo", "M"], ["Tatiana", "Galvis", "F"],
    ["Daniel", "Riaño", "M"], ["Manuela", "Cano", "F"], ["Diego", "Salazar", "M"],
    ["Catalina", "Bernal", "F"], ["Julián", "Ramírez", "M"], ["Gabriela", "Ospina", "F"],
    ["Santiago", "Mora", "M"], ["Laura", "Pardo", "F"], ["Cristian", "Beltrán", "M"],
    ["Natalia", "Quintero", "F"], ["Iván", "Restrepo", "M"], ["Camila", "Duarte", "F"],
    ["Tomás", "Velandia", "M"], ["Andrea", "Sierra", "F"], ["Pablo", "Henao", "M"],
    ["Isabela", "Acuña", "F"], ["Mauricio", "Rojas", "M"], ["Ángela", "Téllez", "F"],
    ["Hernán", "Cuéllar", "M"], ["Lucía", "Barrera", "F"], ["Emilio", "Fajardo", "M"],
    ["Paola", "Guzmán", "F"], ["Rodrigo", "Niño", "M"], ["Ximena", "Patiño", "F"],
    ["Alejandro", "Mejía", "M"], ["Diana", "Cortés", "F"], ["Fernando", "Lara", "M"],
  ];

  function mkNuevo(row, i) {
    const [nombres, apellidos, genero] = row;
    const funnel = FUNNELS[(i * 3 + i % 2) % FUNNELS.length].id;
    const fuenteArr = FUENTES[funnel];
    const fuenteDetalle = fuenteArr[(i * 2 + 1) % fuenteArr.length];
    const edad = 18 + ((i * 7 + 5) % 45);
    const estado = ESTADOS[(i + Math.floor(i / 6)) % ESTADOS.length];
    const fechaLlegada = FECHAS[(i * 3 + 2) % FECHAS.length];
    const estadoCivil = (genero === "F" ? EC_F : EC_M)[i % 5];
    const correo = deaccent(nombres).toLowerCase() + "." + deaccent(apellidos).toLowerCase() + "@email.com";
    const tel = `+57 3${(10 + i % 9)} 555 ${String(1000 + i * 7).padStart(4, "0")}`;
    // ministerio de interés sugerido
    let ministerioInteres = funnel === "ministerios" ? (QR_MIN[fuenteDetalle] || MIN_POR_EDAD(edad)) : MIN_POR_EDAD(edad);
    // si está "conectado", quedó asignado a su ministerio de interés
    const asignadoA = estado === "conectado" ? ministerioInteres : null;
    const liderHabla = estado === "en_seguimiento" || estado === "conectado";
    return {
      id: uid("nv"), nombres, apellidos, correo, telefono: tel, edad, genero,
      estadoCivil, funnel, fuenteDetalle, fechaLlegada,
      ministerioInteres, asignadoA, estado, liderHabla,
      cumpleMes: ((i * 5 + 3) % 12) + 1, cumpleDia: ((i * 11 + 7) % 27) + 1,
      nota: i % 4 === 0 ? "Pidió que la contactaran pronto." : "",
      origen: funnel, cursos: [],
    };
  }
  const NUEVOS = NOMBRES.map(mkNuevo);

  /* ---------- equipo de Nicodemo (servidores de seguimiento) ---------- */
  function eq(nombres, apellidos, genero, rol, correo, tel, desde) {
    return { id: uid("eq"), nombres, apellidos, genero, sirveEn: rol, correo, telefono: tel, desde,
      etapa: "sirve", edad: null, estadoCivil: "—", cumpleMes: null, cumpleDia: null, cursos: ["adn", "bautizo"] };
  }
  const EQUIPO = [
    eq("Paola", "Restrepo", "F", "Coordinación general", "paola.restrepo@casaroca.org", "+57 311 555 7001", "2025-01-15"),
    eq("Juan David", "Ospina", "M", "Primer contacto · llamadas", "juand.ospina@casaroca.org", "+57 320 555 7002", "2025-03-10"),
    eq("Camila", "Ariza", "F", "Bienvenida del domingo", "camila.ariza@casaroca.org", "+57 315 555 7003", "2025-04-22"),
    eq("Sergio", "Ladino", "M", "Seguimiento web y redes", "sergio.ladino@casaroca.org", "+57 300 555 7004", "2025-06-05"),
    eq("Marcela", "Vega", "F", "Conexión a ministerios", "marcela.vega@casaroca.org", "+57 312 555 7005", "2025-02-18"),
    eq("Andrés", "Coronado", "M", "Datos y formularios", "andres.coronado@casaroca.org", "+57 318 555 7006", "2025-07-30"),
  ];

  /* ---------- peticiones ---------- */
  function pet(autor, autorTipo, texto, fecha, estado) { return { id: uid("pet"), autor, autorTipo, texto, fecha, estado }; }
  const PETICIONES = [
    pet("Juan David Ospina", "equipo", "Sabiduría para acompañar a 3 nuevos que llegaron en crisis el domingo pasado.", "2026-06-13", "abierta"),
    pet("Mariana Quiroga", "nuevo", "Acabo de llegar a la iglesia, pido oración por mi familia.", "2026-06-12", "abierta"),
    pet("Camila Ariza", "equipo", "Que cada nuevo del mes encuentre un grupo donde sentirse en casa.", "2026-06-11", "orando"),
    pet("Esteban Salcedo", "nuevo", "Por una decisión laboral importante esta semana.", "2026-06-09", "orando"),
    pet("Marcela Vega", "equipo", "Más líderes dispuestos a recibir nuevos en sus grupos.", "2026-06-06", "respondida"),
  ];

  /* ---------- espacios + eventos ---------- */
  const ESPACIOS = [
    { id: "esp_bienv", nombre: "Sala de Bienvenida", capacidad: 40, ico: "🤝" },
    { id: "esp_norte", nombre: "Salón Norte", capacidad: 80, ico: "🏛️" },
    { id: "esp_cafe", nombre: "Café del Norte", capacidad: 30, ico: "☕" },
    { id: "esp_aud", nombre: "Auditorio principal", capacidad: 400, ico: "🎤" },
    { id: "esp_s2", nombre: "Salón 2", capacidad: 40, ico: "🚪" },
  ];
  function ev(titulo, fecha, horaInicio, horaFin, espacioId, mio, desc) { return { id: uid("ev"), titulo, fecha, horaInicio, horaFin, espacioId, mio, desc }; }
  const EVENTOS = [
    ev("Almuerzo de Nuevos", "2026-06-21", "12:30", "14:30", "esp_norte", true, "Encuentro mensual de bienvenida a los nuevos."),
    ev("Llamadas de seguimiento", "2026-06-17", "18:00", "20:00", "esp_bienv", true, "Jornada del equipo: contactar a los nuevos de la semana."),
    ev("Café de conexión", "2026-06-19", "16:00", "18:00", "esp_cafe", true, "Conversación 1 a 1 con nuevos por conectar."),
    ev("Curso ADN (inicio)", "2026-06-24", "19:00", "21:00", "esp_s2", true, "Primer paso de formación para nuevos."),
    ev("Servicio dominical", "2026-06-21", "10:00", "12:00", "esp_aud", false, "Servicio general (otros equipos)."),
    ev("Ensayo Alabanza", "2026-06-19", "19:00", "21:00", "esp_norte", false, "Equipo de Alabanza (otro equipo)."),
  ];

  /* ---------- organigrama ---------- */
  const ORGANIGRAMA = [
    { id: "org_coord", nombre: "Paola Restrepo", rol: "Coordinadora · Nicodemo", parent: null },
    { id: "org_contacto", nombre: "Juan David Ospina", rol: "Líder · Primer contacto", parent: "org_coord" },
    { id: "org_bienv", nombre: "Camila Ariza", rol: "Líder · Bienvenida domingo", parent: "org_coord" },
    { id: "org_digital", nombre: "Sergio Ladino", rol: "Líder · Web y redes", parent: "org_coord" },
    { id: "org_conexion", nombre: "Marcela Vega", rol: "Líder · Conexión a ministerios", parent: "org_coord" },
    { id: "org_c1", nombre: "Andrés Coronado", rol: "Datos y formularios", parent: "org_digital" },
    { id: "org_b1", nombre: "Voluntarios de mesa", rol: "8 personas", parent: "org_bienv" },
  ];

  /* expone constantes/seed */
  window.NICO = {
    NICO_USER, FUNNELS, FUNNEL_MAP, FUENTES, AF_LIVE, ESPACIOS,
    ministeriosDestino, nombreMinisterio, icoMinisterio,
    _seed: { NUEVOS, EQUIPO, PETICIONES, EVENTOS, ORGANIGRAMA },
    uid,
  };

  /* ============================================================
     NSTORE — estado persistente de Nicodemo. localStorage + subs.
     ============================================================ */
  window.NSTORE = (function () {
    const KEY = "casaroca_nicodemo_v1";
    const hasLS = (function () { try { return typeof localStorage !== "undefined" && localStorage !== null; } catch (e) { return false; } })();
    let mem = null;

    const SEED = {
      v: 1,
      nuevos: JSON.parse(JSON.stringify(NUEVOS)),
      equipo: JSON.parse(JSON.stringify(EQUIPO)),
      peticiones: JSON.parse(JSON.stringify(PETICIONES)),
      eventos: JSON.parse(JSON.stringify(EVENTOS)),
      organigrama: JSON.parse(JSON.stringify(ORGANIGRAMA)),
      // overrides para los nuevos en vivo (STORE): id -> {estado, liderHabla, asignadoA}
      vivos: {},
    };

    function leerRaw() { if (hasLS) { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } } return mem; }
    function escribirRaw(o) { if (hasLS) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} } else { mem = o; } }
    function init() { let d = leerRaw(); if (!d || !d.v) { d = JSON.parse(JSON.stringify(SEED)); escribirRaw(d); } if (!d.vivos) d.vivos = {}; return d; }
    let DATA = init();

    const subs = [];
    function onCambio(cb) { subs.push(cb); return () => { const i = subs.indexOf(cb); if (i >= 0) subs.splice(i, 1); }; }
    function emitir() { subs.forEach(cb => { try { cb(); } catch (e) {} }); }
    function persist() { escribirRaw(DATA); emitir(); }

    if (hasLS && typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("storage", e => { if (e.key === KEY) { DATA = leerRaw() || DATA; emitir(); } });
    }
    // Re-emitir cuando cambia el STORE (inscritos del landing/líder)
    if (S && S.onCambio) S.onCambio(() => emitir());

    /* ---------- nuevos en vivo desde STORE ---------- */
    function generoHeur(nombres, estadoCivil) {
      const ec = (estadoCivil || "").toLowerCase();
      if (/(soltera|casada|unida|viuda|divorciada)/.test(ec)) return "F";
      if (/(soltero|casado|unido|viudo|divorciado)/.test(ec)) return "M";
      return /a$/.test((nombres || "").trim().toLowerCase()) ? "F" : "M";
    }
    function mapVivo(ins) {
      const ov = DATA.vivos[ins.id] || {};
      return {
        id: ins.id,
        nombres: ins.nombres || "", apellidos: ins.apellidos || "",
        correo: ins.correo || "—", telefono: ins.telefono || "—",
        edad: ins.edad || null, genero: generoHeur(ins.nombres, ins.estadoCivil),
        estadoCivil: ins.estadoCivil || "—",
        funnel: "ministerios", fuenteDetalle: "QR J+25 · Café & Palabra",
        fechaLlegada: ins.fechaInscripcion || null,
        ministerioInteres: "m_j25",
        asignadoA: ov.asignadoA !== undefined ? ov.asignadoA : "m_j25",
        estado: ov.estado || "conectado",
        liderHabla: ov.liderHabla !== undefined ? ov.liderHabla : !!ins.contactado,
        cumpleMes: ins.cumpleMes || null, cumpleDia: ins.cumpleDia || null,
        nota: ins.fuente ? ("Llegó por: " + ins.fuente) : "",
        origen: "landing", cursos: [], _vivo: true,
      };
    }
    function vivos() { try { return S ? S.inscritos(AF_LIVE).map(mapVivo) : []; } catch (e) { return []; } }

    /* ---------- nuevos (seed + vivos), fuente de verdad ---------- */
    function nuevos() { return DATA.nuevos.concat(vivos()); }
    function nuevo(id) { return nuevos().find(x => x.id === id) || null; }
    function pendientes() { return nuevos().filter(p => !p.asignadoA); }

    function _setSeed(id, campos) { const x = DATA.nuevos.find(n => n.id === id); if (x) { Object.assign(x, campos); return true; } return false; }
    function _setVivo(id, campos) { DATA.vivos[id] = Object.assign({}, DATA.vivos[id], campos); }

    // Conecta un nuevo de Nicodemo al grupo EN VIVO de J+25 (Café & Palabra)
    // del STORE → aparece al instante en la app del líder y del director.
    // Solo m_j25 tiene grupo vivo en Fase 0.
    function aGrupoVivo(p) {
      if (!S || !p) return null;
      try {
        const res = S.agregar(AF_LIVE, {
          nombres: p.nombres, apellidos: p.apellidos, correo: p.correo,
          telefono: p.telefono, edad: p.edad, estadoCivil: p.estadoCivil,
          etapa: "conecta", cumpleMes: p.cumpleMes, cumpleDia: p.cumpleDia,
          fuente: p.fuenteDetalle || "Conectado por Nicodemo",
          contactado: !!p.liderHabla, origen: "nicodemo",
        });
        return (res && res.ok) ? res.persona.id : null;
      } catch (e) { return null; }
    }
    function asignar(id, ministerioId) {
      const seed = DATA.nuevos.find(n => n.id === id);
      if (seed) {
        // Si conecta a J+25, migra del bucket de Nicodemo al grupo vivo.
        if (ministerioId === "m_j25" && !seed._storeId) {
          const sid = aGrupoVivo(seed);
          if (sid) { DATA.nuevos = DATA.nuevos.filter(n => n.id !== id); persist(); return true; }
        }
        _setSeed(id, { asignadoA: ministerioId, estado: "conectado" }); persist(); return true;
      }
      // vivo (ya está en el café): confirma la conexión.
      if (vivos().some(v => v.id === id)) {
        _setVivo(id, { asignadoA: ministerioId, estado: "conectado" });
        if (S && ministerioId === "m_j25") { try { S.marcarContactado(AF_LIVE, id, true); } catch (e) {} }
        persist(); return true;
      }
      return false;
    }
    function setEstado(id, estado) {
      if (_setSeed(id, { estado })) { persist(); return true; }
      if (vivos().some(v => v.id === id)) { _setVivo(id, { estado }); persist(); return true; }
      return false;
    }
    function toggleLiderHabla(id) {
      const p = nuevo(id); if (!p) return false;
      const val = !p.liderHabla;
      if (p._vivo) { _setVivo(id, { liderHabla: val }); if (S) { try { S.marcarContactado(AF_LIVE, id, val); } catch (e) {} } }
      else { _setSeed(id, { liderHabla: val }); }
      persist(); return val;
    }
    function addNuevo(o) {
      const n = Object.assign({
        id: uid("nv"), fechaLlegada: hoyISO(), estado: "sin_contactar",
        liderHabla: false, asignadoA: null, cursos: [], origen: o.funnel || "manual",
      }, o);
      DATA.nuevos.unshift(n); persist(); return n;
    }

    /* ---------- equipo ---------- */
    function equipo() { return DATA.equipo.slice(); }

    /* ---------- peticiones ---------- */
    function peticiones() { return DATA.peticiones.slice(); }
    function addPeticion(o) { DATA.peticiones.unshift(Object.assign({ id: uid("pet"), fecha: hoyISO(), estado: "abierta", autorTipo: "equipo" }, o)); persist(); }
    function setEstadoPeticion(id, estado) { const x = DATA.peticiones.find(p => p.id === id); if (x) { x.estado = estado; persist(); } }

    /* ---------- eventos / espacios ---------- */
    function eventos() { return DATA.eventos.slice(); }
    function addEvento(o) { DATA.eventos.push(Object.assign({ id: uid("ev"), mio: true }, o)); persist(); }
    function delEvento(id) { const i = DATA.eventos.findIndex(x => x.id === id); if (i >= 0 && DATA.eventos[i].mio) { DATA.eventos.splice(i, 1); persist(); } }
    function aMin(h) { const [a, b] = String(h).split(":").map(Number); return a * 60 + (b || 0); }
    function solapan(i1, f1, i2, f2) { return aMin(i1) < aMin(f2) && aMin(i2) < aMin(f1); }
    function espacioLibre(espacioId, fecha, horaInicio, horaFin, ignoreId) {
      return !DATA.eventos.some(e => e.id !== ignoreId && e.espacioId === espacioId && e.fecha === fecha && solapan(horaInicio, horaFin, e.horaInicio, e.horaFin));
    }

    /* ---------- organigrama ---------- */
    function organigrama() { return DATA.organigrama.slice(); }
    function addNodo(nombre, rol, parent) { const nodo = { id: uid("org"), nombre, rol, parent: parent || null }; DATA.organigrama.push(nodo); persist(); return nodo; }
    function editNodo(id, campos) { const x = DATA.organigrama.find(o => o.id === id); if (x) { Object.assign(x, campos); persist(); } }
    function delNodo(id) {
      const nodo = DATA.organigrama.find(o => o.id === id); if (!nodo) return;
      DATA.organigrama.forEach(o => { if (o.parent === id) o.parent = nodo.parent; });
      DATA.organigrama = DATA.organigrama.filter(o => o.id !== id);
      persist();
    }

    function resetDemo() { DATA = JSON.parse(JSON.stringify(SEED)); persist(); }

    return {
      KEY, onCambio, persist, resetDemo,
      nuevos, nuevo, pendientes, vivos,
      asignar, setEstado, toggleLiderHabla, addNuevo,
      equipo,
      peticiones, addPeticion, setEstadoPeticion,
      eventos, addEvento, delEvento, espacioLibre,
      organigrama, addNodo, editNodo, delNodo,
    };
  })();
})();
