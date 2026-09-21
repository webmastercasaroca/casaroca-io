/* ============================================================
   CASA ROCA · DATOS + STORE de ROCAKIDS
   Ministerio congregacional RocaKids (m_rocakids). Funciona los
   domingos en 3 servicios. Este archivo lo cargan DOS apps:

     1) rocakids-domingo.html  → la app que usan los servidores el
        domingo (ingreso, entrega segura, panel en vivo).
     2) rocakids-director.html → el panel del Director de RocaKids
        (capa 2), con la misma filosofía que el director de J+25.

   Ambas comparten window.RKSTORE (estado en localStorage), de modo
   que los check-in que se hacen el domingo alimentan EN VIVO la
   analítica, el CRM y las peticiones del director. En Fase 1 se
   reemplaza por Supabase (ver schema.sql) manteniendo la interfaz.

   Expone: window.RKDIR (constantes/seed) y window.RKSTORE (estado).
   ============================================================ */
(function () {
  const MIN_ID = "m_rocakids";

  const DIRECTOR_USER = {
    nombre: "Germán Bahamón",
    email: "german.bahamon@casaroca.org",
    iniciales: "GB",
    rol: "Director de RocaKids",
  };
  const CODIRECTORA = { nombre: "Diana Bahamón", email: "diana.bahamon@casaroca.org" };

  /* ---------- etapas (subdivisiones por edad) ---------- */
  const ETAPAS = [
    { id: "sin-limites", nombre: "RocaKids Sin Límites", corto: "Sin Límites", rango: "Capacidades diversas", emoji: "♾️", color: "var(--rk-morado)", bg: "var(--rk-morado-bg)" },
    { id: "1-4",  nombre: "Semillitas",   corto: "1–4 años",  rango: "1 a 4 años",  emoji: "🧸", color: "var(--mostaza-500)", bg: "var(--mostaza-100)" },
    { id: "5-6",  nombre: "Exploradores", corto: "5–6 años",  rango: "5 a 6 años",  emoji: "🌱", color: "var(--exito)",      bg: "var(--exito-bg)" },
    { id: "7-8",  nombre: "Aventureros",  corto: "7–8 años",  rango: "7 a 8 años",  emoji: "⚡", color: "var(--azul-500)",    bg: "var(--azul-100)" },
    { id: "9-11", nombre: "Conquistadores", corto: "9–11 años", rango: "9 a 11 años", emoji: "🔥", color: "var(--peligro)",  bg: "var(--peligro-bg)" },
  ];

  const SERVICIOS = [
    { id: "1er", nombre: "1er Servicio", horario: "7:00 — 8:30 AM",  startH: 7,    endH: 8.5 },
    { id: "2do", nombre: "2do Servicio", horario: "9:00 — 10:30 AM", startH: 9,    endH: 10.5 },
    { id: "3er", nombre: "3er Servicio", horario: "11:30 AM — 1 PM", startH: 11.5, endH: 13 },
  ];

  /* equipos operativos del ministerio (ver schema: equipo_operacional) */
  const EQUIPOS_OP = [
    { id: "alabanza",   nombre: "Alabanza Kids",  emoji: "🎵" },
    { id: "produccion", nombre: "Producción",     emoji: "🎬" },
    { id: "agentes_rk", nombre: "Agentes RK",     emoji: "🦸" },
    { id: "logistica",  nombre: "Logística",      emoji: "📦" },
    { id: "crear",      nombre: "Crear (arte)",   emoji: "🎨" },
  ];

  /* ---------- helpers de construcción ---------- */
  let _seq = 0;
  function uid(pfx) { return pfx + "_" + (Date.now().toString(36)) + "_" + (++_seq); }
  function hoyISO() { return new Date().toISOString().slice(0, 10); }
  function deaccent(s) { return String(s).normalize("NFD").replace(/[̀-ͯ]/g, ""); }

  /* ------------------------------------------------------------
     COORDINADORES por etapa + por equipo operativo.
     ------------------------------------------------------------ */
  const COORDS = [
    { id: "co_sl",  nombre: "Diana Bahamón",  tel: "+57 311 555 7001", email: "diana.bahamon@casaroca.org", area: "sin-limites" },
    { id: "co_14",  nombre: "Marcela Ríos",    tel: "+57 320 555 7002", email: "marcela.rios@casaroca.org",   area: "1-4" },
    { id: "co_56",  nombre: "Paola Henao",     tel: "+57 315 555 7003", email: "paola.henao@casaroca.org",    area: "5-6" },
    { id: "co_78",  nombre: "Julián Ospina",   tel: "+57 300 555 7004", email: "julian.ospina@casaroca.org",  area: "7-8" },
    { id: "co_911", nombre: "Andrés Cruz",     tel: "+57 312 555 7005", email: "andres.cruz@casaroca.org",    area: "9-11" },
    { id: "co_alab", nombre: "Laura Bernal",   tel: "+57 318 555 7010", email: "laura.bernal@casaroca.org",   area: "alabanza" },
    { id: "co_prod", nombre: "Sergio Pava",    tel: "+57 313 555 7011", email: "sergio.pava@casaroca.org",    area: "produccion" },
    { id: "co_agt",  nombre: "Tatiana Forero", tel: "+57 314 555 7012", email: "tatiana.forero@casaroca.org", area: "agentes_rk" },
    { id: "co_log",  nombre: "Cristian Lozano",tel: "+57 316 555 7013", email: "cristian.lozano@casaroca.org",area: "logistica" },
    { id: "co_crear",nombre: "Melissa Cano",   tel: "+57 317 555 7014", email: "melissa.cano@casaroca.org",   area: "crear" },
  ];

  /* ------------------------------------------------------------
     NIÑOS — censo del ministerio (con acudiente).
     Generador determinista a partir de filas compactas.
     ------------------------------------------------------------ */
  const PARENTESCOS = ["Mamá", "Papá", "Mamá", "Papá", "Abuela", "Tía"];
  const FUENTES = ["Nació en la iglesia", "Invitado por un amigo", "QR en la sede", "Vino con sus papás", "Primera visita", "Recomendado"];
  const FECHAS = ["2025-09-07", "2025-11-02", "2026-01-18", "2026-02-15", "2026-03-08", "2026-04-12", "2026-05-10", "2026-06-07"];

  function mkNino(nombre, apellido, etapa, genero, edad, i, acuNombre, acuParent, cedula, celular, nota) {
    return {
      id: uid("nk"), nombres: nombre, apellidos: apellido, etapa, genero, edad,
      fechaNac: null, nota: nota || "",
      acudiente: { nombre: acuNombre, parentesco: acuParent, cedula: String(cedula), celular },
      fechaIngreso: FECHAS[(i * 3 + 2) % FECHAS.length],
      fuente: FUENTES[(i * 2 + 1) % FUENTES.length],
    };
  }

  // [nombre, apellido, etapa, F|M, edad, acudiente, parentesco, cedula, celular, nota?]
  const NINOS_RAW = [
    ["Luciana", "Garzón", "1-4", "F", 3, "Daniel Garzón", "Papá", 1018401142, "+57 310 555 0142", "Alergia al maní"],
    ["Emiliano", "Rincón", "1-4", "M", 2, "Camilo Rincón", "Papá", 79945112, "+57 311 555 3110", ""],
    ["Antonella", "Bernal", "1-4", "F", 4, "Laura Bernal", "Mamá", 52336710, "+57 318 555 7010", ""],
    ["Matías", "Forero", "1-4", "M", 3, "Tatiana Forero", "Mamá", 1020554477, "+57 314 555 7012", ""],
    ["Isabella", "Cuéllar", "1-4", "F", 4, "David Cuéllar", "Papá", 80114523, "+57 300 555 3201", ""],
    ["Samuel", "Pava", "1-4", "M", 2, "Sergio Pava", "Papá", 79880345, "+57 313 555 7011", "Usa el código de entrega"],
    ["Valentina", "Mejía", "5-6", "F", 6, "Carolina Mejía", "Mamá", 52990114, "+57 321 555 3104", ""],
    ["Tomás", "Lozano", "5-6", "M", 5, "Cristian Lozano", "Papá", 80223456, "+57 316 555 7013", ""],
    ["Mariana", "Henao", "5-6", "F", 6, "Paola Henao", "Mamá", 52114789, "+57 315 555 7003", ""],
    ["Martín", "Cano", "5-6", "M", 5, "Melissa Cano", "Mamá", 1019887654, "+57 317 555 7014", ""],
    ["Sofía", "Ospina", "5-6", "F", 6, "Julián Ospina", "Papá", 80556321, "+57 300 555 7004", ""],
    ["Daniel", "Mendoza", "5-6", "M", 5, "Carlos Mendoza", "Papá", 79667240, "+57 300 555 3400", ""],
    ["Salomé", "Trujillo", "5-6", "F", 5, "Paula Trujillo", "Mamá", 52778190, "+57 300 555 3403", ""],
    ["Jerónimo", "Rojas", "7-8", "M", 8, "Esteban Rojas", "Papá", 80990112, "+57 300 555 3406", ""],
    ["Emma", "Caicedo", "7-8", "F", 7, "Diana Caicedo", "Mamá", 52443098, "+57 300 555 3407", ""],
    ["Gabriel", "Ferro", "7-8", "M", 8, "Gabriel Ferro", "Papá", 79221330, "+57 300 555 3408", "Necesita lentes"],
    ["Juliana", "Camargo", "7-8", "F", 7, "Manuela Ariza", "Mamá", 52667881, "+57 300 555 3409", ""],
    ["Simón", "Quiroga", "7-8", "M", 8, "Mateo Quiroga", "Papá", 80335129, "+57 300 555 3402", ""],
    ["Renata", "Bedoya", "7-8", "F", 7, "Lina Bedoya", "Mamá", 52889003, "+57 300 555 3403", ""],
    ["Maximiliano", "Cruz", "9-11", "M", 10, "Andrés Cruz", "Papá", 80114009, "+57 312 555 7005", ""],
    ["Sara", "Cardona", "9-11", "F", 11, "Diana Cardona", "Mamá", 52220447, "+57 321 555 3105", ""],
    ["Nicolás", "Patiño", "9-11", "M", 9, "Óscar Patiño", "Papá", 79556128, "+57 321 555 3106", ""],
    ["Manuela", "Suárez", "9-11", "F", 10, "Liliana Suárez", "Mamá", 52114003, "+57 321 555 3107", ""],
    ["Alejandro", "Gómez", "9-11", "M", 11, "Hernán Gómez", "Papá", 79880556, "+57 321 555 3108", ""],
    ["Gabriela", "Vargas", "9-11", "F", 9, "Marcela Vargas", "Mamá", 52667129, "+57 321 555 3109", ""],
    ["Esteban", "Beltrán", "sin-limites", "M", 8, "Santiago Beltrán", "Papá", 80334771, "+57 311 555 3020", "TEA — requiere acompañante 1:1"],
    ["Amelia", "Castro", "sin-limites", "F", 6, "Valeria Castro", "Mamá", 52998120, "+57 320 555 3021", "Movilidad reducida"],
    ["Ángel", "Salazar", "sin-limites", "M", 9, "Manuela Salazar", "Mamá", 52114990, "+57 300 555 3023", "Síndrome de Down"],
  ];

  const NINOS = NINOS_RAW.map((r, i) => mkNino(r[0], r[1], r[2], r[3], r[4], i, r[5], r[6], r[7], r[8], r[9]));

  /* ------------------------------------------------------------
     EQUIPO — servidores/voluntarios (por etapa y por operativo).
     ------------------------------------------------------------ */
  function srv(nombre, apellido, genero, area, areaTipo, desde, tel, cursos) {
    return { id: uid("rks"), nombres: nombre, apellidos: apellido, genero, area, areaTipo, desde,
      telefono: tel, correo: deaccent(nombre.split(" ")[0]).toLowerCase() + "." + deaccent(apellido.split(" ")[0]).toLowerCase() + "@email.com",
      cursos: cursos || [] };
  }
  const EQUIPO = [
    srv("Marcela", "Ríos", "F", "1-4", "etapa", "2024-02-01", "+57 320 555 7002", ["adn", "bautizo", "madurez"]),
    srv("Paola", "Henao", "F", "5-6", "etapa", "2023-08-15", "+57 315 555 7003", ["adn", "bautizo", "madurez", "ibli"]),
    srv("Julián", "Ospina", "M", "7-8", "etapa", "2024-05-10", "+57 300 555 7004", ["adn", "madurez"]),
    srv("Andrés", "Cruz", "M", "9-11", "etapa", "2023-03-01", "+57 312 555 7005", ["adn", "bautizo", "madurez"]),
    srv("Diana", "Bahamón", "F", "sin-limites", "etapa", "2022-09-01", "+57 311 555 7001", ["adn", "bautizo", "madurez", "ibli", "facter"]),
    srv("Laura", "Bernal", "F", "alabanza", "operativo", "2024-01-20", "+57 318 555 7010", ["adn", "madurez"]),
    srv("Sergio", "Pava", "M", "produccion", "operativo", "2024-04-12", "+57 313 555 7011", ["adn"]),
    srv("Tatiana", "Forero", "F", "agentes_rk", "operativo", "2023-11-05", "+57 314 555 7012", ["adn", "bautizo"]),
    srv("Cristian", "Lozano", "M", "logistica", "operativo", "2024-06-01", "+57 316 555 7013", ["adn"]),
    srv("Melissa", "Cano", "F", "crear", "operativo", "2024-02-18", "+57 317 555 7014", ["adn", "madurez"]),
    srv("Natalia", "Bustos", "F", "1-4", "etapa", "2025-01-12", "+57 311 555 7020", ["adn"]),
    srv("David", "Cuéllar", "M", "agentes_rk", "operativo", "2025-02-09", "+57 300 555 3201", ["adn"]),
    srv("Carolina", "Mejía", "F", "5-6", "etapa", "2024-10-01", "+57 321 555 3104", ["adn", "bautizo"]),
    srv("Mateo", "Quiroga", "M", "9-11", "etapa", "2025-03-15", "+57 300 555 3402", ["adn"]),
  ];

  /* ------------------------------------------------------------
     NUEVOS — niños primera vez por hacer seguimiento / vincular.
     ------------------------------------------------------------ */
  function nuevo(nombre, apellido, etapa, genero, edad, acuNombre, acuParent, celular, fecha, nota) {
    return { id: uid("nkn"), nombres: nombre, apellidos: apellido, etapa, genero, edad,
      acudiente: { nombre: acuNombre, parentesco: acuParent, celular, cedula: "" },
      fechaIngreso: fecha, fuente: "Primera visita (domingo)", nota: nota || "" };
  }
  const NUEVOS = [
    nuevo("Thiago", "Morales", "5-6", "M", 5, "Andrea Morales", "Mamá", "+57 311 555 8001", "2026-06-14", "Primera vez, vive cerca."),
    nuevo("Catalina", "Vega", "7-8", "F", 7, "Antonia Vega", "Mamá", "+57 320 555 8002", "2026-06-14", "Vino invitada por una amiguita."),
    nuevo("Bruno", "Reyes", "1-4", "M", 3, "Samuel Reyes", "Papá", "+57 315 555 8003", "2026-06-14", ""),
    nuevo("Helena", "Marín", "9-11", "F", 10, "Isabela Marín", "Mamá", "+57 300 555 8004", "2026-06-07", "Hermana mayor ya está en J+25."),
  ];

  /* ------------------------------------------------------------
     CURRÍCULO / TEMÁTICAS por edad.
     ------------------------------------------------------------ */
  function tem(titulo, desc, tipo, dirigidoA, fecha, ico) { return { id: uid("rktem"), titulo, desc, tipo, dirigidoA, fecha, ico, docs: [] }; }
  const TEMATICAS = [
    tem("Dios me hizo único", "Serie de 4 domingos sobre identidad y autoestima desde la fe.", "Serie", "Todas las etapas", "2026-06-01", "🌟"),
    tem("Héroes de la Biblia", "Currículo trimestral con manualidades y memorización.", "Currículo", "7–8 y 9–11", "2026-05-15", "🦸"),
    tem("Mis primeras oraciones", "Material sensorial para los más pequeños.", "Guía", "1–4 años", "2026-05-20", "🙏"),
    tem("Todos somos parte", "Adaptaciones inclusivas para RocaKids Sin Límites.", "Guía", "Sin Límites", "2026-04-30", "♾️"),
  ];

  /* ------------------------------------------------------------
     PETICIONES — oración (las del domingo se suman en vivo).
     ------------------------------------------------------------ */
  function pet(autor, autorTipo, texto, fecha, estado) { return { id: uid("rkpet"), autor, autorTipo, texto, fecha, estado }; }
  const PETICIONES = [
    pet("Coord. Sin Límites", "lider", "Por más acompañantes 1:1 para los niños con capacidades diversas.", "2026-06-13", "abierta"),
    pet("Familia Garzón", "persona", "Por la recuperación de Luciana, está con gripa.", "2026-06-10", "orando"),
    pet("Equipo de Logística", "lider", "Sabiduría para reorganizar los salones, estamos creciendo.", "2026-06-08", "abierta"),
  ];

  /* ------------------------------------------------------------
     ESPACIOS (salones) + EVENTOS.
     ------------------------------------------------------------ */
  const ESPACIOS = [
    { id: "esp_sl",  nombre: "Salón Sin Límites", capacidad: 20, ico: "♾️" },
    { id: "esp_14",  nombre: "Salón Semillitas",  capacidad: 40, ico: "🧸" },
    { id: "esp_56",  nombre: "Salón Exploradores",capacidad: 45, ico: "🌱" },
    { id: "esp_78",  nombre: "Salón Aventureros", capacidad: 45, ico: "⚡" },
    { id: "esp_911", nombre: "Salón Conquistadores", capacidad: 50, ico: "🔥" },
    { id: "esp_aud", nombre: "Auditorio Kids",    capacidad: 200, ico: "🎤" },
  ];
  function ev(titulo, fecha, horaInicio, horaFin, espacioId, mio, desc) { return { id: uid("rkev"), titulo, fecha, horaInicio, horaFin, espacioId, mio, desc }; }
  const EVENTOS = [
    ev("Servicio dominical RocaKids", "2026-06-21", "07:00", "13:00", "esp_aud", true, "Los 3 servicios del domingo."),
    ev("Capacitación de servidores", "2026-06-24", "19:00", "21:00", "esp_56", true, "Formación mensual del equipo."),
    ev("Vacaciones Bíblicas (prep.)", "2026-06-26", "18:00", "20:00", "esp_911", true, "Planeación de la temporada."),
    ev("Reunión de coordinadores", "2026-06-19", "19:00", "20:30", "esp_78", true, "Revisión de currículo y salones."),
  ];

  /* ------------------------------------------------------------
     ORGANIGRAMA seed.
     ------------------------------------------------------------ */
  const ORGANIGRAMA = [
    { id: "org_dir", nombre: "Germán Bahamón", rol: "Director RocaKids", parent: null },
    { id: "org_codir", nombre: "Diana Bahamón", rol: "Co-directora / Sin Límites", parent: "org_dir" },
    { id: "org_etapas", nombre: "Coordinación de Etapas", rol: "Área", parent: "org_dir" },
    { id: "org_op", nombre: "Coordinación Operativa", rol: "Área", parent: "org_dir" },
    { id: "org_c14", nombre: "Marcela Ríos", rol: "Coord. 1–4", parent: "org_etapas" },
    { id: "org_c56", nombre: "Paola Henao", rol: "Coord. 5–6", parent: "org_etapas" },
    { id: "org_c78", nombre: "Julián Ospina", rol: "Coord. 7–8", parent: "org_etapas" },
    { id: "org_c911", nombre: "Andrés Cruz", rol: "Coord. 9–11", parent: "org_etapas" },
    { id: "org_alab", nombre: "Laura Bernal", rol: "Alabanza Kids", parent: "org_op" },
    { id: "org_prod", nombre: "Sergio Pava", rol: "Producción", parent: "org_op" },
    { id: "org_agt", nombre: "Tatiana Forero", rol: "Agentes RK", parent: "org_op" },
    { id: "org_log", nombre: "Cristian Lozano", rol: "Logística", parent: "org_op" },
    { id: "org_crear", nombre: "Melissa Cano", rol: "Crear (arte)", parent: "org_op" },
  ];

  /* ------------------------------------------------------------
     USUARIOS de la app del domingo (acceso por PIN).
     niveles: director (admin total), coordinador (su etapa), candidato.
     ------------------------------------------------------------ */
  const USUARIOS = [
    { id: "u_german", nombre: "Germán Bahamón", rol: "director", pin: "1234", activo: true },
    { id: "u_diana",  nombre: "Diana Bahamón", rol: "director", pin: "1234", activo: true },
    { id: "u_marcela",nombre: "Marcela Ríos",   rol: "coordinador", etapa: "1-4", pin: "1111", activo: true },
    { id: "u_paola",  nombre: "Paola Henao",    rol: "coordinador", etapa: "5-6", pin: "2222", activo: true },
    { id: "u_julian", nombre: "Julián Ospina",  rol: "coordinador", etapa: "7-8", pin: "3333", activo: true },
    { id: "u_andres", nombre: "Andrés Cruz",    rol: "coordinador", etapa: "9-11", pin: "4444", activo: true },
  ];

  /* ------------------------------------------------------------
     REGISTROS seed del domingo (para que la analítica y el panel
     muestren datos al instante). Se generan con la fecha de HOY.
     ------------------------------------------------------------ */
  function genRegistrosHoy() {
    const fecha = hoyISO();
    const out = [];
    // muestras por servicio: [nombreNino, etapa, adulto, cedula, celular, servicio, estado, peticion]
    const muestras = [
      ["Luciana Garzón", "1-4", "Daniel Garzón", "1018401142", "+57 310 555 0142", "1er", "entregado", ""],
      ["Valentina Mejía", "5-6", "Carolina Mejía", "52990114", "+57 321 555 3104", "1er", "entregado", "Por sabiduría como familia."],
      ["Maximiliano Cruz", "9-11", "Andrés Cruz", "80114009", "+57 312 555 7005", "1er", "entregado", ""],
      ["Emma Caicedo", "7-8", "Diana Caicedo", "52443098", "+57 300 555 3407", "1er", "entregado", ""],
      ["Antonella Bernal", "1-4", "Laura Bernal", "52336710", "+57 318 555 7010", "2do", "presente", ""],
      ["Mariana Henao", "5-6", "Paola Henao", "52114789", "+57 315 555 7003", "2do", "presente", ""],
      ["Jerónimo Rojas", "7-8", "Esteban Rojas", "80990112", "+57 300 555 3406", "2do", "presente", "Por la salud de su abuelo."],
      ["Sara Cardona", "9-11", "Diana Cardona", "52220447", "+57 321 555 3105", "2do", "presente", ""],
      ["Amelia Castro", "sin-limites", "Valeria Castro", "52998120", "+57 320 555 3021", "2do", "presente", "Gratitud por su avance."],
      ["Thiago Morales", "5-6", "Andrea Morales", "53110980", "+57 311 555 8001", "2do", "presente", "Primera visita — bienvenirlo."],
      ["Martín Cano", "5-6", "Melissa Cano", "1019887654", "+57 317 555 7014", "2do", "presente", ""],
      ["Simón Quiroga", "7-8", "Mateo Quiroga", "80335129", "+57 300 555 3402", "2do", "presente", ""],
    ];
    const seqPorSrv = {};
    muestras.forEach((m, i) => {
      const srvId = m[5];
      seqPorSrv[srvId] = (seqPorSrv[srvId] || 0) + 1;
      const manilla = String(seqPorSrv[srvId]).padStart(3, "0");
      const horaBase = SERVICIOS.find(s => s.id === srvId).startH;
      const ingreso = new Date(); ingreso.setHours(Math.floor(horaBase), 5 + i * 2, 0, 0);
      const reg = {
        id: uid("rkr"), fecha, servicio: srvId, numero_manilla: manilla,
        nombre_nino: m[0], etapa: m[1], nombre_adulto: m[2], cedula_adulto: m[3], celular_adulto: m[4],
        peticion_oracion: m[7], estado: m[6], hora_ingreso: ingreso.toISOString(),
        hora_entrega: m[6] === "entregado" ? new Date(ingreso.getTime() + 95 * 60000).toISOString() : null,
        registrado_por: "u_german", cedula_retiro: m[6] === "entregado" ? m[3] : null,
      };
      out.push(reg);
    });
    return out;
  }

  /* historial de asistencia de domingos pasados (para la línea de crecimiento) */
  const HISTORIAL = [
    { fecha: "2026-05-03", total: 96 }, { fecha: "2026-05-10", total: 104 },
    { fecha: "2026-05-17", total: 99 }, { fecha: "2026-05-24", total: 112 },
    { fecha: "2026-05-31", total: 118 }, { fecha: "2026-06-07", total: 121 },
  ];

  /* expone constantes/seed */
  window.RKDIR = {
    MIN_ID, DIRECTOR_USER, CODIRECTORA, ETAPAS, SERVICIOS, EQUIPOS_OP, COORDS, NINOS,
    HISTORIAL, uid, hoyISO,
    etapa(id) { return ETAPAS.find(e => e.id === id) || ETAPAS[1]; },
    servicio(id) { return SERVICIOS.find(s => s.id === id) || SERVICIOS[0]; },
    equipoOp(id) { return EQUIPOS_OP.find(e => e.id === id) || null; },
    areaNombre(id) { const e = ETAPAS.find(x => x.id === id); if (e) return e.corto; const o = EQUIPOS_OP.find(x => x.id === id); return o ? o.nombre : id; },
    _seed: { EQUIPO, NUEVOS, TEMATICAS, PETICIONES, EVENTOS, ORGANIGRAMA, USUARIOS },
  };

  /* ============================================================
     RKSTORE — estado compartido (app del domingo + director).
     Mismo patrón que window.DSTORE.
     ============================================================ */
  window.RKSTORE = (function () {
    const KEY = "casaroca_rocakids_v1";
    const hasLS = (function () { try { return typeof localStorage !== "undefined" && localStorage !== null; } catch (e) { return false; } })();
    let mem = null;

    const SEED = {
      v: 1,
      registros: genRegistrosHoy(),
      usuarios: JSON.parse(JSON.stringify(USUARIOS)),
      coordPorArea: COORDS.reduce((o, c) => { o[c.area] = c.id; return o; }, {}),
      equipo: JSON.parse(JSON.stringify(EQUIPO)),
      nuevos: JSON.parse(JSON.stringify(NUEVOS)),
      asignados: {},                 // etapa -> [niños vinculados desde nuevos]
      tematicas: JSON.parse(JSON.stringify(TEMATICAS)),
      peticiones: JSON.parse(JSON.stringify(PETICIONES)),
      eventos: JSON.parse(JSON.stringify(EVENTOS)),
      organigrama: JSON.parse(JSON.stringify(ORGANIGRAMA)),
    };

    function leerRaw() { if (hasLS) { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } } return mem; }
    function escribirRaw(o) { if (hasLS) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} } else { mem = o; } }
    const ENTREGA = (typeof window !== "undefined" && window.CASAROCA_ENTREGA);
    function init() {
      let d = leerRaw();
      if (!d || !d.v) {
        d = ENTREGA
          ? { v: 1, registros: [], usuarios: [], coordPorArea: {}, equipo: [], nuevos: [], asignados: {}, tematicas: [], peticiones: [], eventos: [], organigrama: [] }
          : JSON.parse(JSON.stringify(SEED));
        escribirRaw(d); return d;
      }
      if (ENTREGA) return d; // en entrega no regeneramos registros demo
      // refresca los registros del día si quedaron de un domingo anterior (demo)
      const hoy = hoyISO();
      if (!(d.registros || []).some(r => r.fecha === hoy)) {
        d.registros = genRegistrosHoy().concat(d.registros || []);
        escribirRaw(d);
      }
      return d;
    }
    let DATA = init();

    const subs = [];
    function onCambio(cb) { subs.push(cb); return () => { const i = subs.indexOf(cb); if (i >= 0) subs.splice(i, 1); }; }
    function emitir() { subs.forEach(cb => { try { cb(); } catch (e) {} }); }
    function persist() { escribirRaw(DATA); emitir(); }

    if (hasLS && typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("storage", e => { if (e.key === KEY) { DATA = leerRaw() || DATA; emitir(); } });
    }

    /* -------- registros (check-in del domingo) -------- */
    function registros() { return DATA.registros.slice(); }
    function registrosDe(fecha) { return DATA.registros.filter(r => r.fecha === fecha); }
    function addRegistro(o) {
      const reg = Object.assign({ id: uid("rkr"), fecha: hoyISO(), estado: "presente", hora_ingreso: new Date().toISOString() }, o);
      DATA.registros.unshift(reg); persist(); return reg;
    }
    function updateRegistro(id, updates) {
      const r = DATA.registros.find(x => x.id === id);
      if (r) { Object.assign(r, updates); persist(); }
      return r;
    }
    function delRegistro(id) { const i = DATA.registros.findIndex(x => x.id === id); if (i >= 0) { DATA.registros.splice(i, 1); persist(); } }
    function siguienteManilla(fecha, servicio) {
      const n = DATA.registros.filter(r => r.fecha === fecha && r.servicio === servicio).length;
      return String(n + 1).padStart(3, "0");
    }
    function resetRegistros() { DATA.registros = []; persist(); }

    /* -------- usuarios (acceso por PIN) -------- */
    function usuarios() { return DATA.usuarios.slice(); }
    function addUsuario(o) { DATA.usuarios.push(Object.assign({ id: uid("u"), activo: true }, o)); persist(); }
    function updateUsuario(id, updates) { const u = DATA.usuarios.find(x => x.id === id); if (u) { Object.assign(u, updates); persist(); } return u; }

    /* -------- coordinadores por área -------- */
    function coordDe(area) { return DATA.coordPorArea[area] || (COORDS.find(c => c.area === area) || {}).id; }
    function setCoordDe(area, coordId) { DATA.coordPorArea[area] = coordId; persist(); }

    /* -------- equipo -------- */
    function equipo() { return DATA.equipo.slice(); }

    /* -------- nuevos / vinculación -------- */
    function nuevos() { return DATA.nuevos.slice(); }
    function asignadosDe(etapa) { return (DATA.asignados[etapa] || []).slice(); }
    function vincularNuevo(nuevoId, etapa) {
      const i = DATA.nuevos.findIndex(x => x.id === nuevoId);
      if (i < 0) return false;
      const nino = DATA.nuevos.splice(i, 1)[0];
      nino.etapa = etapa || nino.etapa;
      if (!DATA.asignados[etapa]) DATA.asignados[etapa] = [];
      DATA.asignados[etapa].push(nino);
      persist(); return true;
    }

    /* -------- temáticas -------- */
    function tematicas() { return DATA.tematicas.slice(); }
    function tematica(id) { return DATA.tematicas.find(x => x.id === id) || null; }
    function addTematica(o) { DATA.tematicas.unshift(Object.assign({ id: uid("rktem"), fecha: hoyISO(), docs: [] }, o)); persist(); }
    function delTematica(id) { const i = DATA.tematicas.findIndex(x => x.id === id); if (i >= 0) { DATA.tematicas.splice(i, 1); persist(); } }
    function addDocTematica(id, doc) { const t = DATA.tematicas.find(x => x.id === id); if (!t) return; t.docs = t.docs || []; t.docs.unshift(Object.assign({ id: uid("doc"), fecha: hoyISO() }, doc)); persist(); }
    function delDocTematica(id, docId) { const t = DATA.tematicas.find(x => x.id === id); if (!t || !t.docs) return; t.docs = t.docs.filter(d => d.id !== docId); persist(); }

    /* -------- peticiones -------- */
    function peticiones() { return DATA.peticiones.slice(); }
    function addPeticion(o) { DATA.peticiones.unshift(Object.assign({ id: uid("rkpet"), fecha: hoyISO(), estado: "abierta", autorTipo: "director" }, o)); persist(); }
    function setEstadoPeticion(id, estado) { const x = DATA.peticiones.find(p => p.id === id); if (x) { x.estado = estado; persist(); } }

    /* -------- eventos -------- */
    function eventos() { return DATA.eventos.slice(); }
    function addEvento(o) { DATA.eventos.push(Object.assign({ id: uid("rkev"), mio: true }, o)); persist(); }
    function delEvento(id) { const i = DATA.eventos.findIndex(x => x.id === id); if (i >= 0 && DATA.eventos[i].mio) { DATA.eventos.splice(i, 1); persist(); } }
    function espacioLibre(espacioId, fecha, horaInicio, horaFin, ignoreId) {
      return !DATA.eventos.some(e => e.id !== ignoreId && e.espacioId === espacioId && e.fecha === fecha && solapan(horaInicio, horaFin, e.horaInicio, e.horaFin));
    }
    function eventosEn(fecha) { return DATA.eventos.filter(e => e.fecha === fecha); }

    /* -------- organigrama -------- */
    function organigrama() { return DATA.organigrama.slice(); }
    function addNodo(nombre, rol, parent) { const nodo = { id: uid("org"), nombre, rol, parent: parent || null }; DATA.organigrama.push(nodo); persist(); return nodo; }
    function editNodo(id, campos) { const x = DATA.organigrama.find(o => o.id === id); if (x) { Object.assign(x, campos); persist(); } }
    function delNodo(id) {
      const nodo = DATA.organigrama.find(o => o.id === id); if (!nodo) return;
      DATA.organigrama.forEach(o => { if (o.parent === id) o.parent = nodo.parent; });
      DATA.organigrama = DATA.organigrama.filter(o => o.id !== id); persist();
    }

    function resetDemo() { DATA = JSON.parse(JSON.stringify(SEED)); DATA.registros = genRegistrosHoy(); persist(); }

    /* utils */
    function aMin(h) { const [a, b] = String(h).split(":").map(Number); return a * 60 + (b || 0); }
    function solapan(i1, f1, i2, f2) { return aMin(i1) < aMin(f2) && aMin(i2) < aMin(f1); }

    return {
      KEY, onCambio, persist, resetDemo,
      registros, registrosDe, addRegistro, updateRegistro, delRegistro, siguienteManilla, resetRegistros,
      usuarios, addUsuario, updateUsuario,
      coordDe, setCoordDe,
      equipo,
      nuevos, asignadosDe, vincularNuevo,
      tematicas, tematica, addTematica, delTematica, addDocTematica, delDocTematica,
      peticiones, addPeticion, setEstadoPeticion,
      eventos, addEvento, delEvento, espacioLibre, eventosEn,
      organigrama, addNodo, editNodo, delNodo,
    };
  })();
})();
