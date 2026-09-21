/* ============================================================
   CASA ROCA · DATOS + STORE de la APP DEL DIRECTOR DE MINISTERIO
   Capa 2 (Director de ministerio). Demo: ministerio J+25 (m_j25),
   dirigido por Andrés Lozano. El grupo "Café & Palabra"
   (af_j25_cafe, líder Daniel Garzón) se lee EN VIVO de window.STORE,
   por lo que lo que pasa en el landing y en la app del líder se
   refleja aquí al instante.

   Lo demás (rosters de otros grupos, equipo de servicio, bucket de
   nuevos, temáticas, peticiones, eventos, espacios, organigrama) son
   datos del ministerio. Las ediciones del director (reasignar líderes,
   armar el organigrama, crear temáticas/eventos/peticiones, asignar
   nuevos) persisten en localStorage mediante window.DSTORE, con la
   misma filosofía que window.STORE. En Fase 1 se reemplaza por
   Supabase manteniendo la interfaz pública.

   Expone: window.DIRECTOR (constantes/seed) y window.DSTORE (estado).
   ============================================================ */
(function () {
  const MIN_ID = "m_j25";

  const DIRECTOR_USER = {
    nombre: "Andrés Lozano",
    email: "andres.lozano@casaroca.org",
    iniciales: "AL",
    rol: "Director de Ministerio",
  };

  /* ---------- helpers de construcción de registros ---------- */
  let _seq = 0;
  function uid(pfx) { return pfx + "_" + (Date.now().toString(36)) + "_" + (++_seq); }

  function p(nombres, apellidos, correo, telefono, edad, genero, etapa, estadoCivil, cumpleMes, cumpleDia, fechaInscripcion, fuente, cursos) {
    return { id: uid("per"), nombres, apellidos, correo, telefono, edad, genero, etapa, estadoCivil, cumpleMes, cumpleDia, fechaInscripcion, fuente, cursos: cursos || [], contactado: true, origen: "landing" };
  }
  function e(nombres, apellidos, correo, telefono, edad, genero, etapa, estadoCivil, cumpleMes, cumpleDia, sirveEn, desde, cursos) {
    return { id: uid("eq"), nombres, apellidos, correo, telefono, edad, genero, etapa, estadoCivil, cumpleMes, cumpleDia, sirveEn, desde, cursos: cursos || [] };
  }
  function n(nombres, apellidos, correo, telefono, edad, genero, estadoCivil, fechaInscripcion, fuente, nota) {
    return { id: uid("nv"), nombres, apellidos, correo, telefono, edad, genero, etapa: "conoce", estadoCivil, cumpleMes: null, cumpleDia: null, fechaInscripcion, fuente, nota, cursos: [], origen: "landing" };
  }
  function t(titulo, desc, tipo, dirigidoA, fecha, ico) { return { id: uid("tem"), titulo, desc, tipo, dirigidoA, fecha, ico }; }
  function pet(autor, autorTipo, texto, fecha, estado) { return { id: uid("pet"), autor, autorTipo, texto, fecha, estado }; }
  function ev(titulo, fecha, horaInicio, horaFin, espacioId, mio, desc) { return { id: uid("ev"), titulo, fecha, horaInicio, horaFin, espacioId, mio, desc }; }

  /* ---------- generador de rosters (muchas personas, datos deterministas) ----------
     people = [["Nombres","Apellidos","F|M"], ...]. Deriva datos realistas
     a partir del índice para que cada grupo tenga personas completas. */
  function deaccent(s) { return String(s).normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  const FUENTES = ["Invitado por un amigo", "QR en la sede", "Redes sociales", "Vino solo un domingo", "Recomendado por su jefe", "Conexión por Instagram", "Invitado por su pareja", "Escaneó el QR en la U"];
  const FECHAS = ["2026-01-12", "2026-02-08", "2026-02-24", "2026-03-10", "2026-03-29", "2026-04-14", "2026-04-30", "2026-05-09", "2026-05-21", "2026-06-02", "2026-06-09", "2026-06-13"];
  const ETAPA_POOL = ["conoce", "conoce", "conecta", "conecta", "crece", "sirve"];
  const CURSOS_POR_ETAPA = { conoce: [], conecta: ["adn"], crece: ["adn", "madurez"], sirve: ["adn", "bautizo", "madurez"] };
  function mkRoster(prefix3, start, people) {
    return people.map((row, i) => {
      const [nombres, apellidos, genero] = row;
      const etapa = ETAPA_POOL[(i * 3 + 1) % ETAPA_POOL.length];
      const ecF = ["Soltera", "Soltera", "Casada", "Unión libre"];
      const ecM = ["Soltero", "Soltero", "Casado", "Unión libre"];
      const estadoCivil = (genero === "F" ? ecF : ecM)[i % 4];
      const correo = deaccent(nombres.split(" ")[0]).toLowerCase() + "." + deaccent(apellidos.split(" ")[0]).toLowerCase() + "@email.com";
      const tel = `+57 ${prefix3} 555 ${String(start + i).padStart(4, "0")}`;
      return {
        id: uid("per"), nombres, apellidos, correo, telefono: tel,
        edad: 24 + ((i * 5 + 9) % 14), genero, etapa, estadoCivil,
        cumpleMes: ((i * 7 + 2) % 12) + 1, cumpleDia: ((i * 13 + 5) % 27) + 1,
        fechaInscripcion: FECHAS[(i * 4 + 3) % FECHAS.length],
        fuente: FUENTES[(i * 2 + 1) % FUENTES.length],
        cursos: CURSOS_POR_ETAPA[etapa].slice(),
        contactado: (i % 5 !== 0), origen: "landing",
      };
    });
  }

  /* ------------------------------------------------------------
     PERSONAS — rosters de los grupos pequeños que NO viven en STORE.
     (El grupo af_j25_cafe se lee en vivo de window.STORE.)
     Cada persona trae todos los datos de su formulario base para que
     el director pueda acompañar y contactar directo (WhatsApp/correo).
     ------------------------------------------------------------ */
  const ROSTERS = {
    af_j25_virtual: [
      p("Camila", "Ariza", "camila.ariza@email.com", "+57 311 555 3010", 28, "F", "conecta", "Soltera", 3, 9, "2026-05-22", "Conexión por Instagram", ["adn"]),
      p("Tomás", "Giraldo", "tomas.giraldo@email.com", "+57 320 555 3011", 30, "M", "crece", "Casado", 8, 21, "2026-04-18", "Invitado por un amigo", ["adn", "bautizo"]),
      p("Sara", "Quintero", "sara.quintero@email.com", "+57 315 555 3012", 26, "F", "conoce", "Soltera", 11, 4, "2026-06-09", "Vino sola un domingo", []),
      p("Felipe", "Cárdenas", "felipe.cardenas@email.com", "+57 300 555 3013", 33, "M", "conecta", "Unión libre", 1, 27, "2026-05-30", "QR en la sede", ["adn"]),
      p("Natalia", "Robles", "natalia.robles@email.com", "+57 312 555 3014", 29, "F", "crece", "Soltera", 6, 12, "2026-03-15", "Recomendada por su jefe", ["adn", "madurez"]),
      p("Andrés", "Pardo", "andres.pardo@email.com", "+57 318 555 3015", 31, "M", "conecta", "Casado", 9, 2, "2026-05-12", "Redes sociales", ["adn"]),
      p("Lucía", "Mora", "lucia.mora@email.com", "+57 313 555 3016", 27, "F", "conoce", "Soltera", 7, 19, "2026-06-11", "Conexión virtual", []),
      p("Mateo", "Vélez", "mateo.velez@email.com", "+57 314 555 3017", 32, "M", "conecta", "Casado", 2, 8, "2026-05-05", "Invitado por su esposa", ["adn"]),
      p("Paula", "Ríos", "paula.rios@email.com", "+57 316 555 3018", 25, "F", "conoce", "Soltera", 10, 30, "2026-06-13", "Escaneó el QR en la U", []),
    ],
    af_j25_run: [
      p("Santiago", "Beltrán", "santiago.beltran@email.com", "+57 311 555 3020", 29, "M", "crece", "Soltero", 4, 14, "2026-04-02", "Grupo de running", ["adn", "madurez"]),
      p("Valeria", "Castro", "valeria.castro@email.com", "+57 320 555 3021", 27, "F", "sirve", "Soltera", 8, 6, "2026-02-20", "Invitada por una amiga", ["adn", "bautizo", "madurez"]),
      p("Juan David", "Ospina", "juandavid.ospina@email.com", "+57 315 555 3022", 31, "M", "conecta", "Casado", 5, 23, "2026-05-18", "QR en la sede", ["adn"]),
      p("Manuela", "Salazar", "manuela.salazar@email.com", "+57 300 555 3023", 26, "F", "conoce", "Soltera", 12, 1, "2026-06-10", "Vino al parque", []),
      p("Esteban", "Niño", "esteban.nino@email.com", "+57 312 555 3024", 34, "M", "conecta", "Casado", 6, 17, "2026-05-08", "Recomendado", ["adn"]),
      p("Daniela", "Acosta", "daniela.acosta@email.com", "+57 318 555 3025", 28, "F", "crece", "Soltera", 3, 28, "2026-03-30", "Redes sociales", ["adn", "madurez"]),
      p("Andrés Felipe", "León", "andresf.leon@email.com", "+57 313 555 3026", 30, "M", "conoce", "Soltero", 9, 11, "2026-06-12", "Vino a trotar", []),
    ],
    af_j25_finanzas: mkRoster("321", 3100, [
      ["Mauricio", "Gallego", "M"], ["Paola", "Henao", "F"], ["Iván", "Restrepo", "M"], ["Carolina", "Mejía", "F"],
      ["Julián", "Ospina", "M"], ["Diana", "Cardona", "F"], ["Óscar", "Patiño", "M"], ["Liliana", "Suárez", "F"],
      ["Hernán", "Gómez", "M"], ["Marcela", "Vargas", "F"], ["Camilo", "Rincón", "M"],
    ]),
    af_j25_parejas: mkRoster("310", 3200, [
      ["Sergio", "Bernal", "M"], ["Laura", "Bernal", "F"], ["David", "Cuéllar", "M"], ["Ángela", "Cuéllar", "F"],
      ["Andrés", "Forero", "M"], ["Tatiana", "Forero", "F"], ["Cristian", "Lozano", "M"], ["Melissa", "Lozano", "F"],
      ["Jorge", "Pineda", "M"], ["Carolina", "Pineda", "F"],
    ]),
    af_j25_arte: mkRoster("315", 3300, [
      ["Nicolás", "Duarte", "M"], ["Valentina", "Cano", "F"], ["Samuel", "Reyes", "M"], ["Isabela", "Marín", "F"],
      ["Emilio", "Castaño", "M"], ["Sofía", "Naranjo", "F"], ["Daniel", "Cruz", "M"], ["Antonia", "Vega", "F"],
      ["Joaquín", "Ramírez", "M"],
    ]),
    af_j25_norte: mkRoster("300", 3400, [
      ["Felipe", "Aguilar", "M"], ["Andrea", "Salgado", "F"], ["Mateo", "Quiroga", "M"], ["Lina", "Bedoya", "F"],
      ["Carlos", "Mendoza", "M"], ["Paula", "Trujillo", "F"], ["Esteban", "Rojas", "M"], ["Diana", "Caicedo", "F"],
      ["Gabriel", "Ferro", "M"], ["Manuela", "Ariza", "F"], ["Sebastián", "Pava", "M"], ["Juliana", "Camargo", "F"],
      ["Ricardo", "Gil", "M"],
    ]),
    af_j25_mujeres: mkRoster("312", 3500, [
      ["Andrea", "Montoya", "F"], ["Catalina", "Vélez", "F"], ["María José", "Téllez", "F"], ["Laura", "Bustos", "F"],
      ["Valeria", "Ramírez", "F"], ["Daniela", "Hoyos", "F"], ["Sara", "Mejía", "F"], ["Camila", "Otero", "F"],
      ["Paulina", "Salinas", "F"], ["Natalia", "Quintana", "F"], ["Juliana", "Becerra", "F"], ["Mariana", "Solís", "F"],
      ["Alejandra", "Pinto", "F"], ["Lorena", "Cifuentes", "F"], ["Tatiana", "Murcia", "F"], ["Ximena", "Lara", "F"],
    ]),
    af_j25_lectura: mkRoster("316", 3600, [
      ["Andrés", "Cadena", "M"], ["Lucía", "Parra", "F"], ["Tomás", "Escobar", "M"], ["Verónica", "Niño", "F"],
      ["Julián", "Mora", "M"], ["Adriana", "Ruiz", "F"], ["Felipe", "Saavedra", "M"], ["Catalina", "Roa", "F"],
    ]),
  };

  /* ------------------------------------------------------------
     GRUPOS del ministerio (metadatos de líder + lugar). El conteo y
     el roster de af_j25_cafe se obtienen de STORE; el de los demás,
     de ROSTERS. 'liderId' permite reasignar.
     ------------------------------------------------------------ */
  const GRUPOS = [
    { afId: "af_j25_cafe", liderId: "li_daniel", lider: "Daniel Garzón", liderTel: "+57 310 555 0142", liderEmail: "daniel.garzon@casaroca.org", liveStore: true },
    { afId: "af_j25_virtual", liderId: "li_diego", lider: "Diego Rivas", liderTel: "+57 320 555 0103", liderEmail: "diego.rivas@email.com", liveStore: false },
    { afId: "af_j25_run", liderId: "li_laura", lider: "Laura Méndez", liderTel: "+57 315 555 0104", liderEmail: "laura.mendez@email.com", liveStore: false },
    { afId: "af_j25_finanzas", liderId: "li_tomas", lider: "Tomás Giraldo", liderTel: "+57 320 555 3011", liderEmail: "tomas.giraldo@email.com", liveStore: false },
    { afId: "af_j25_parejas", liderId: "li_andres", lider: "Andrés Pardo", liderTel: "+57 318 555 3015", liderEmail: "andres.pardo@email.com", liveStore: false },
    { afId: "af_j25_arte", liderId: "li_camila", lider: "Camila Ariza", liderTel: "+57 311 555 3010", liderEmail: "camila.ariza@email.com", liveStore: false },
    { afId: "af_j25_norte", liderId: "li_santiago", lider: "Santiago Beltrán", liderTel: "+57 311 555 3020", liderEmail: "santiago.beltran@email.com", liveStore: false },
    { afId: "af_j25_mujeres", liderId: "li_valeria", lider: "Valeria Castro", liderTel: "+57 320 555 3021", liderEmail: "valeria.castro@email.com", liveStore: false },
    { afId: "af_j25_lectura", liderId: "li_natalia", lider: "Natalia Robles", liderTel: "+57 312 555 3014", liderEmail: "natalia.robles@email.com", liveStore: false },
  ];

  // Líderes disponibles para reasignar (incluye colíderes en formación)
  const LIDERES = [
    { id: "li_daniel", nombre: "Daniel Garzón", tel: "+57 310 555 0142", email: "daniel.garzon@casaroca.org" },
    { id: "li_diego", nombre: "Diego Rivas", tel: "+57 320 555 0103", email: "diego.rivas@email.com" },
    { id: "li_laura", nombre: "Laura Méndez", tel: "+57 315 555 0104", email: "laura.mendez@email.com" },
    { id: "li_valeria", nombre: "Valeria Castro", tel: "+57 320 555 3021", email: "valeria.castro@email.com" },
    { id: "li_santiago", nombre: "Santiago Beltrán", tel: "+57 311 555 3020", email: "santiago.beltran@email.com" },
    { id: "li_camila", nombre: "Camila Ariza", tel: "+57 311 555 3010", email: "camila.ariza@email.com" },
    { id: "li_tomas", nombre: "Tomás Giraldo", tel: "+57 320 555 3011", email: "tomas.giraldo@email.com" },
    { id: "li_andres", nombre: "Andrés Pardo", tel: "+57 318 555 3015", email: "andres.pardo@email.com" },
    { id: "li_natalia", nombre: "Natalia Robles", tel: "+57 312 555 3014", email: "natalia.robles@email.com" },
  ];

  /* ------------------------------------------------------------
     EQUIPO — personas en servicio activo del ministerio (sirven en
     J+25). Cada una con datos completos para acompañar y contactar.
     ------------------------------------------------------------ */
  const EQUIPO = [
    e("Valeria", "Castro", "valeria.castro@email.com", "+57 320 555 3021", 27, "F", "sirve", "Soltera", 8, 6, "Líder de grupo · Run & Pray", "2025-09-01", ["adn", "bautizo", "madurez", "ibli"]),
    e("Santiago", "Beltrán", "santiago.beltran@email.com", "+57 311 555 3020", 29, "M", "sirve", "Soltero", 4, 14, "Logística y montaje", "2025-11-15", ["adn", "madurez"]),
    e("Camila", "Ariza", "camila.ariza@email.com", "+57 311 555 3010", 28, "F", "sirve", "Soltera", 3, 9, "Bienvenida y nuevos", "2026-01-10", ["adn", "bautizo"]),
    e("Tomás", "Giraldo", "tomas.giraldo@email.com", "+57 320 555 3011", 30, "M", "sirve", "Casado", 8, 21, "Multimedia y redes", "2025-08-20", ["adn", "bautizo", "madurez"]),
    e("Daniela", "Acosta", "daniela.acosta@email.com", "+57 318 555 3025", 28, "F", "sirve", "Soltera", 3, 28, "Oración e intercesión", "2026-02-05", ["adn", "madurez", "ibli"]),
    e("Juan David", "Ospina", "juandavid.ospina@email.com", "+57 315 555 3022", 31, "M", "sirve", "Casado", 5, 23, "Conexión y seguimiento", "2025-10-12", ["adn"]),
    e("Natalia", "Robles", "natalia.robles@email.com", "+57 312 555 3014", 29, "F", "sirve", "Soltera", 6, 12, "Logística y café", "2026-03-01", ["adn", "madurez"]),
    e("Andrés", "Pardo", "andres.pardo@email.com", "+57 318 555 3015", 31, "M", "sirve", "Casado", 9, 2, "Producción y sonido", "2025-12-08", ["adn"]),
  ];

  /* ------------------------------------------------------------
     BUCKET DE NUEVOS — personas registradas esperando ser asignadas
     a un grupo pequeño o afinidad. Toda su info base para decidir.
     ------------------------------------------------------------ */
  const NUEVOS = [
    n("Carolina", "Suárez", "carolina.suarez@email.com", "+57 311 555 4001", 27, "F", "Soltera", "2026-06-13", "Formulario landing", "Le interesa un grupo entre semana, vive en el norte."),
    n("Ricardo", "Méndez", "ricardo.mendez@email.com", "+57 320 555 4002", 32, "M", "Casado", "2026-06-12", "QR en la sede", "Vino con su esposa, buscan grupo de parejas o J+25."),
    n("Andrea", "Pinzón", "andrea.pinzon@email.com", "+57 315 555 4003", 25, "F", "Soltera", "2026-06-14", "Invitada por una amiga", "Universitaria, disponible fines de semana."),
    n("Sebastián", "Cortés", "sebastian.cortes@email.com", "+57 300 555 4004", 30, "M", "Unión libre", "2026-06-11", "Redes sociales", "Prefiere grupo virtual por su horario laboral."),
    n("Mariana", "Gómez", "mariana.gomez2@email.com", "+57 312 555 4005", 29, "F", "Soltera", "2026-06-14", "Vino sola un domingo", "Le gusta el deporte, podría encajar en Run & Pray."),
    n("Felipe", "Duarte", "felipe.duarte@email.com", "+57 318 555 4006", 33, "M", "Casado", "2026-06-10", "Recomendado por su jefe", "Profesional, busca comunidad y crecimiento."),
  ];

  /* ------------------------------------------------------------
     TEMÁTICAS — material/serie creado por el ministerio.
     ------------------------------------------------------------ */
  const TEMATICAS = [
    t("Identidad en Cristo", "Serie de 4 semanas sobre quiénes somos en Dios. Ideal para nuevos.", "Serie", "Todos los grupos", "2026-06-01", "📘"),
    t("Finanzas con propósito", "Taller práctico de mayordomía para jóvenes adultos.", "Taller", "Crece", "2026-06-08", "💰"),
    t("Relaciones que edifican", "Conversaciones sobre noviazgo, amistad y límites sanos.", "Conversatorio", "Conéctate", "2026-05-20", "💬"),
  ];

  /* ------------------------------------------------------------
     PETICIONES — oraciones/peticiones de líderes y personas.
     (Más adelante se conecta con el espacio de Oraciones.)
     ------------------------------------------------------------ */
  const PETICIONES = [
    pet("Diego Rivas", "lider", "Sabiduría para acompañar a dos personas del grupo que están pasando por una crisis familiar.", "2026-06-13", "abierta"),
    pet("Mariana López", "persona", "Por una entrevista de trabajo importante esta semana.", "2026-06-12", "abierta"),
    pet("Laura Méndez", "lider", "Que Dios levante un colíder para Run & Pray; estamos creciendo rápido.", "2026-06-10", "abierta"),
    pet("Andrés Camacho", "persona", "Salud de mi mamá, está en tratamiento.", "2026-06-09", "orando"),
    pet("Valeria Castro", "persona", "Dirección para dar el paso del bautismo.", "2026-06-07", "respondida"),
  ];

  /* ------------------------------------------------------------
     ESPACIOS físicos reservables (de la sede). Disponibilidad por
     hora se calcula contra las reservas (eventos con espacioId+hora).
     ------------------------------------------------------------ */
  const ESPACIOS = [
    { id: "esp_norte", nombre: "Salón Norte", capacidad: 80, ico: "🏛️" },
    { id: "esp_cafe", nombre: "Café del Norte", capacidad: 30, ico: "☕" },
    { id: "esp_aud", nombre: "Auditorio juvenil", capacidad: 200, ico: "🎤" },
    { id: "esp_s3", nombre: "Salón 3", capacidad: 40, ico: "🚪" },
    { id: "esp_aire", nombre: "Zona al aire libre", capacidad: 120, ico: "🌳" },
  ];

  /* ------------------------------------------------------------
     EVENTOS — calendario del ministerio + eventos de otros
     ministerios (read-only) para coordinar. 'mio:true' = de J+25.
     Reserva de espacio: espacioId + horaInicio/horaFin.
     ------------------------------------------------------------ */
  const EVENTOS = [
    ev("J+25 Connect", "2026-06-19", "19:00", "21:00", "esp_norte", true, "Encuentro general del ministerio."),
    ev("Café & Palabra", "2026-06-18", "19:00", "21:00", "esp_cafe", true, "Grupo de Daniel Garzón."),
    ev("Run & Pray", "2026-06-20", "06:30", "08:00", "esp_aire", true, "Trote + devocional."),
    ev("Taller Finanzas con propósito", "2026-06-25", "19:00", "21:00", "esp_s3", true, "Temática del mes."),
    ev("Noche tMt", "2026-06-20", "18:30", "21:00", "esp_aud", false, "Ministerio tMt (otro ministerio)."),
    ev("Mujer Integral", "2026-06-18", "19:00", "21:00", "esp_norte", false, "Choca con J+25 Connect — coordinar."),
  ];

  /* ------------------------------------------------------------
     ORGANIGRAMA seed — árbol editable (mapa mental). Cada nodo:
     { id, nombre, rol, parent }. parent=null => raíz.
     ------------------------------------------------------------ */
  const ORGANIGRAMA = [
    { id: "org_dir", nombre: "Andrés Lozano", rol: "Director J+25", parent: null },
    // Coordinaciones (segundo nivel)
    { id: "org_co_grupos", nombre: "Valeria Castro", rol: "Coord. Grupos", parent: "org_dir" },
    { id: "org_co_nuevos", nombre: "Camila Ariza", rol: "Coord. Nuevos", parent: "org_dir" },
    { id: "org_co_multi", nombre: "Tomás Giraldo", rol: "Coord. Multimedia", parent: "org_dir" },
    { id: "org_co_oracion", nombre: "Daniela Acosta", rol: "Coord. Oración", parent: "org_dir" },
    // Líderes de grupo (bajo Coord. Grupos)
    { id: "org_g1", nombre: "Daniel Garzón", rol: "Líder · Café & Palabra", parent: "org_co_grupos" },
    { id: "org_g2", nombre: "Diego Rivas", rol: "Líder · Conexión Virtual", parent: "org_co_grupos" },
    { id: "org_g3", nombre: "Laura Méndez", rol: "Líder · Run & Pray", parent: "org_co_grupos" },
    { id: "org_g4", nombre: "Andrés Pardo", rol: "Líder · Recién Juntos", parent: "org_co_grupos" },
    { id: "org_g5", nombre: "Santiago Beltrán", rol: "Líder · Conexión Norte", parent: "org_co_grupos" },
    { id: "org_g6", nombre: "Natalia Robles", rol: "Líder · Club de Lectura", parent: "org_co_grupos" },
    // Equipo de nuevos
    { id: "org_n1", nombre: "Juan David Ospina", rol: "Seguimiento", parent: "org_co_nuevos" },
    // Multimedia
    { id: "org_m1", nombre: "Andrés Pardo", rol: "Producción y sonido", parent: "org_co_multi" },
  ];

  /* expone constantes/seed */
  window.DIRECTOR = {
    MIN_ID, DIRECTOR_USER, GRUPOS, LIDERES, ESPACIOS,
    rosterDe(afId) { return (ROSTERS[afId] || []).slice(); },
    _seed: { ROSTERS, EQUIPO, NUEVOS, TEMATICAS, PETICIONES, EVENTOS, ORGANIGRAMA },
    uid,
  };

  /* MODO ENTREGA · vacío total del ministerio (J+25) para repartir en 0. */
  if (typeof window !== "undefined" && window.CASAROCA_ENTREGA) {
    GRUPOS.length = 0; LIDERES.length = 0;
    Object.keys(ROSTERS).forEach(k => { ROSTERS[k] = []; });
    EQUIPO.length = 0; NUEVOS.length = 0; TEMATICAS.length = 0; PETICIONES.length = 0; EVENTOS.length = 0; ORGANIGRAMA.length = 0;
  }

  /* ============================================================
     DSTORE — estado persistente de las ediciones del director.
     Mismo patrón que window.STORE: localStorage + suscripción.
     ============================================================ */
  window.DSTORE = (function () {
    const KEY = "casaroca_director_j25_v1";
    const hasLS = (function () { try { return typeof localStorage !== "undefined" && localStorage !== null; } catch (e) { return false; } })();
    let mem = null;

    const SEED = {
      v: 1,
      // afId -> liderId (reasignaciones); por defecto el de GRUPOS
      lideresPorGrupo: GRUPOS.reduce((o, g) => { o[g.afId] = g.liderId; return o; }, {}),
      equipo: JSON.parse(JSON.stringify(EQUIPO)),
      nuevos: JSON.parse(JSON.stringify(NUEVOS)),
      // afId -> [personas asignadas desde el bucket]
      asignados: {},
      tematicas: JSON.parse(JSON.stringify(TEMATICAS)),
      peticiones: JSON.parse(JSON.stringify(PETICIONES)),
      eventos: JSON.parse(JSON.stringify(EVENTOS)),
      organigrama: JSON.parse(JSON.stringify(ORGANIGRAMA)),
      // Sistemas de coordinador/líder provisionados desde el organigrama del
      // director (base en 0). Nacen cuando el director crea un cuadro de
      // coordinador o líder y le reparte el acceso.
      sistemas: [],
    };

    function leerRaw() { if (hasLS) { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } } return mem; }
    function escribirRaw(o) { if (hasLS) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} } else { mem = o; } }
    function init() { let d = leerRaw(); if (!d || !d.v) { d = JSON.parse(JSON.stringify(SEED)); escribirRaw(d); } return d; }
    let DATA = init();

    const subs = [];
    function onCambio(cb) { subs.push(cb); return () => { const i = subs.indexOf(cb); if (i >= 0) subs.splice(i, 1); }; }
    function emitir() { subs.forEach(cb => { try { cb(); } catch (e) {} }); }
    function persist() { escribirRaw(DATA); emitir(); }

    if (hasLS && typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("storage", e => { if (e.key === KEY) { DATA = leerRaw() || DATA; emitir(); } });
    }

    /* -------- líderes por grupo -------- */
    function liderDeGrupo(afId) { return DATA.lideresPorGrupo[afId] || (GRUPOS.find(g => g.afId === afId) || {}).liderId; }
    function setLiderDeGrupo(afId, liderId) { DATA.lideresPorGrupo[afId] = liderId; persist(); }

    /* -------- equipo -------- */
    function equipo() { return DATA.equipo.slice(); }

    /* -------- nuevos / asignación -------- */
    function nuevos() { return DATA.nuevos.slice(); }
    function asignadosDe(afId) { return (DATA.asignados[afId] || []).slice(); }
    function asignarNuevo(nuevoId, afId) {
      const i = DATA.nuevos.findIndex(x => x.id === nuevoId);
      if (i < 0) return false;
      const persona = DATA.nuevos.splice(i, 1)[0];
      persona.etapa = persona.etapa || "conecta";
      persona.contactado = true;
      if (!DATA.asignados[afId]) DATA.asignados[afId] = [];
      DATA.asignados[afId].push(persona);
      persist();
      return true;
    }

    /* -------- temáticas -------- */
    function tematicas() { return DATA.tematicas.slice(); }
    function tematica(id) { return DATA.tematicas.find(x => x.id === id) || null; }
    function addTematica(o) { DATA.tematicas.unshift(Object.assign({ id: uid("tem"), fecha: hoyISO(), docs: [] }, o)); persist(); }
    function delTematica(id) { const i = DATA.tematicas.findIndex(x => x.id === id); if (i >= 0) { DATA.tematicas.splice(i, 1); persist(); } }
    function addDocTematica(id, doc) { const t = DATA.tematicas.find(x => x.id === id); if (!t) return; t.docs = t.docs || []; t.docs.unshift(Object.assign({ id: uid("doc"), fecha: hoyISO() }, doc)); persist(); }
    function delDocTematica(id, docId) { const t = DATA.tematicas.find(x => x.id === id); if (!t || !t.docs) return; t.docs = t.docs.filter(d => d.id !== docId); persist(); }

    /* -------- peticiones -------- */
    function peticiones() { return DATA.peticiones.slice(); }
    function addPeticion(o) { DATA.peticiones.unshift(Object.assign({ id: uid("pet"), fecha: hoyISO(), estado: "abierta", autorTipo: "director" }, o)); persist(); }
    function setEstadoPeticion(id, estado) { const x = DATA.peticiones.find(p => p.id === id); if (x) { x.estado = estado; persist(); } }

    /* -------- eventos -------- */
    function eventos() { return DATA.eventos.slice(); }
    function addEvento(o) { DATA.eventos.push(Object.assign({ id: uid("ev"), mio: true }, o)); persist(); }
    function delEvento(id) { const i = DATA.eventos.findIndex(x => x.id === id); if (i >= 0 && DATA.eventos[i].mio) { DATA.eventos.splice(i, 1); persist(); } }
    // ¿Está libre un espacio en una fecha y rango horario? (ignora un evento por id al editar)
    function espacioLibre(espacioId, fecha, horaInicio, horaFin, ignoreId) {
      return !DATA.eventos.some(ev => ev.id !== ignoreId && ev.espacioId === espacioId && ev.fecha === fecha &&
        solapan(horaInicio, horaFin, ev.horaInicio, ev.horaFin));
    }
    function eventosEn(fecha) { return DATA.eventos.filter(ev => ev.fecha === fecha); }

    /* -------- organigrama -------- */
    function organigrama() { return DATA.organigrama.slice(); }
    function enlaceAcceso() { return "casaroca.app/acceso/" + Math.random().toString(36).slice(2, 8); }
    // tipo: "persona" (sin sistema) | "coordinador" | "lider".
    // Al crear un coordinador o líder NACE su sistema (base en 0) y se genera
    // su acceso; al repartirlo, entra a SU app con el alcance de su rol.
    // Lo que el coordinador/líder registre queda visible para el director.
    function addNodo(nombre, rol, parent, tipo, contacto) {
      const nodo = { id: uid("org"), nombre, rol, parent: parent || null };
      const c = contacto || {};
      if (tipo === "coordinador" || tipo === "lider") {
        nodo.tipo = tipo;
        const sis = {
          id: uid("sis"), nodoId: nodo.id, nombre, rol, tipo,
          creadoEl: hoyISO(), enOrganigrama: true,
          base: { personas: 0, grupos: 0, nuevos: 0 },
          acceso: { email: c.email || "", tel: c.tel || "", enlace: enlaceAcceso(), estado: "pendiente", enviadoEl: null },
        };
        DATA.sistemas = DATA.sistemas || [];
        DATA.sistemas.push(sis);
        nodo.sistemaId = sis.id;
        if (c.enviar && (c.email || c.tel)) { sis.acceso.estado = "enviado"; sis.acceso.enviadoEl = hoyISO(); }
      }
      DATA.organigrama.push(nodo); persist(); return nodo;
    }
    function editNodo(id, campos) {
      const x = DATA.organigrama.find(o => o.id === id); if (x) { Object.assign(x, campos); }
      if (x && x.sistemaId) { const s = (DATA.sistemas || []).find(s => s.id === x.sistemaId); if (s) Object.assign(s, { nombre: x.nombre, rol: x.rol }); }
      persist();
    }
    function moverNodo(id, nuevoParent) { const x = DATA.organigrama.find(o => o.id === id); if (x && id !== nuevoParent) { x.parent = nuevoParent || null; persist(); } }
    function sistemas() { return (DATA.sistemas || []).slice(); }
    function sistemaPorNodo(nodoId) { return (DATA.sistemas || []).find(s => s.nodoId === nodoId) || null; }
    function enviarAcceso(sistemaId, contacto) {
      const s = (DATA.sistemas || []).find(s => s.id === sistemaId); if (!s) return null;
      const c = contacto || {};
      if (c.email !== undefined) s.acceso.email = c.email;
      if (c.tel !== undefined) s.acceso.tel = c.tel;
      if (!s.acceso.enlace) s.acceso.enlace = enlaceAcceso();
      s.acceso.estado = s.acceso.estado === "activo" ? "activo" : "enviado";
      s.acceso.enviadoEl = hoyISO();
      persist(); return s;
    }
    function delNodo(id) {
      // reasigna hijos al parent del nodo borrado, luego borra
      const nodo = DATA.organigrama.find(o => o.id === id); if (!nodo) return;
      // "Solo quitar del organigrama": el sistema del coordinador/líder se
      // CONSERVA en segundo plano (no se borra a ninguna persona).
      if (nodo.sistemaId) { const s = (DATA.sistemas || []).find(s => s.id === nodo.sistemaId); if (s) s.enOrganigrama = false; }
      DATA.organigrama.forEach(o => { if (o.parent === id) o.parent = nodo.parent; });
      DATA.organigrama = DATA.organigrama.filter(o => o.id !== id);
      persist();
    }

    function resetDemo() { DATA = JSON.parse(JSON.stringify(SEED)); persist(); }

    /* -------- utils de tiempo -------- */
    function hoyISO() { return new Date().toISOString().slice(0, 10); }
    function aMin(h) { const [a, b] = String(h).split(":").map(Number); return a * 60 + (b || 0); }
    function solapan(i1, f1, i2, f2) { return aMin(i1) < aMin(f2) && aMin(i2) < aMin(f1); }

    return {
      KEY, onCambio, persist, resetDemo,
      liderDeGrupo, setLiderDeGrupo,
      equipo,
      nuevos, asignadosDe, asignarNuevo,
      tematicas, tematica, addTematica, delTematica, addDocTematica, delDocTematica,
      peticiones, addPeticion, setEstadoPeticion,
      eventos, addEvento, delEvento, espacioLibre, eventosEn,
      organigrama, addNodo, editNodo, moverNodo, delNodo,
      sistemas, sistemaPorNodo, enviarAcceso,
    };
  })();
})();
