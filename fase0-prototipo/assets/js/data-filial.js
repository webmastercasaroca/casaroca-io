/* ============================================================
   CASA ROCA AI SYSTEM — DATOS DE FILIAL (Fase 0)
   Datos profundos y ÚNICOS por ministerio para el perfil del
   Pastor Congregacional (sede Bogotá Chicó). Se expone como
   window.DB_FILIAL y lo consume views-pastor-sede.js.
   ============================================================ */
window.DB_FILIAL = (function () {

  /* ============================================================
     PANEL — la iglesia en análisis (sede madre · Bogotá Chicó)
     ============================================================ */
  const PANEL = {
    asistentes: 1940,
    promDomingo: 1318,
    nuevosMes: 34,
    nuevosSinContacto: 5,
    ministeriosActivos: 13,
    ministeriosCatalogo: 16,
    enRiesgo: 9,
    // asistencia domingo tras domingo (últimos 8 domingos)
    asistenciaDom: [
      { f: "20 abr", v: 1244 }, { f: "27 abr", v: 1302 }, { f: "4 may", v: 1280 },
      { f: "11 may", v: 1355 }, { f: "18 may", v: 1298 }, { f: "25 may", v: 1402 },
      { f: "1 jun", v: 1330 }, { f: "8 jun", v: 1386 }
    ],
    // distribución por género
    generos: { hombres: 902, mujeres: 1038 },
    // RocaKids del domingo
    rocakids: { presentes: 112, registrados: 138, porEdad: [14, 34, 38, 26] },
    // tamaño de ministerios (para barra)
    ministeriosTop: [
      { n: "tMt (11–25)", v: 310, ico: "🎸" },
      { n: "J+25", v: 240, ico: "🌱" },
      { n: "Mujer Integral", v: 220, ico: "🌷" },
      { n: "Casa2 (Casados)", v: 188, ico: "💍" },
      { n: "Hombres de Bien", v: 165, ico: "🛡️" },
      { n: "RocaKids", v: 138, ico: "🧒" },
      { n: "Josués", v: 96, ico: "🧗" },
      { n: "Años Dorados", v: 74, ico: "🌅" }
    ],
    // últimos diezmos / aportes (vista del pastor filial: agregados, no por persona detallado)
    ultimosDiezmos: [
      { persona: "Valentina Ríos", monto: 280000, fecha: "11 jun", medio: "Wompi" },
      { persona: "Camilo Restrepo", monto: 540000, fecha: "10 jun", medio: "Wompi" },
      { persona: "Andrea Pineda", monto: 310000, fecha: "9 jun", medio: "Wompi" },
      { persona: "Camila Vargas", monto: 520000, fecha: "9 jun", medio: "PayU" },
      { persona: "Marta López", monto: 300000, fecha: "8 jun", medio: "Wompi" },
      { persona: "Anónimo", monto: 75000, fecha: "8 jun", medio: "PayU" }
    ],
    diezmoMes: 224, // millones COP
    // cumpleaños de la semana
    cumple: [
      { nombre: "Valentina Ríos", dia: "Hoy", edad: 29, ministerio: "J+25", tel: "+57 310 555 1208" },
      { nombre: "Pedro Gil", dia: "Vie 12", edad: 34, ministerio: "Casa2 · Sin hijos", tel: "+57 301 555 2210" },
      { nombre: "Sofía Lara", dia: "Sáb 13", edad: 27, ministerio: "RocaKids (voluntaria)", tel: "+57 312 555 8890" },
      { nombre: "Óscar Tovar", dia: "Dom 14", edad: 45, ministerio: "Hombres de Bien", tel: "+57 313 555 3321" },
      { nombre: "Esperanza Díaz", dia: "Lun 15", edad: 68, ministerio: "Años Dorados", tel: "+57 300 555 6677" }
    ],
    // eventos generales pastorales
    eventos: [
      { titulo: "Servicio dominical (3 servicios)", dia: "Dom 14 jun", hora: "8:00 am · 10:00 am · 12:00 m", lugar: "Auditorio principal", tipo: "Culto" },
      { titulo: "Reunión de líderes de grupo", dia: "Mar 16 jun", hora: "7:00 pm", lugar: "Salón 2", tipo: "Liderazgo" },
      { titulo: "Noche de Mujer Integral", dia: "Jue 18 jun", hora: "6:30 pm", lugar: "Auditorio", tipo: "Ministerio" },
      { titulo: "Bautizos de julio (preparación)", dia: "Sáb 20 jun", hora: "4:00 pm", lugar: "Salón 1", tipo: "Formación" },
      { titulo: "Almuerzo Años Dorados", dia: "Dom 21 jun", hora: "1:00 pm", lugar: "Comedor", tipo: "Comunidad" }
    ]
  };

  /* ============================================================
     ORGANIGRAMA — editable por el pastor (visual de su iglesia)
     ============================================================ */
  const ORG = {
    pastor: { rol: "Pastor Congregacional", nombre: "Camilo y Ana Restrepo", sub: "Responsable de la sede" },
    direcciones: [
      { id: "o_pastoral", rol: "Dirección", nombre: "Pastoral · Congregacionales", sub: "9 ministerios activos", lider: "Camilo Restrepo" },
      { id: "o_operativos", rol: "Dirección", nombre: "Operativos · Domingo", sub: "6 equipos de servicio", lider: "David Quintero" },
      { id: "o_admin", rol: "Dirección", nombre: "Administración local", sub: "Tesorería · TH · Comms · Cultura", lider: "Jorge Méndez" }
    ],
    coordinaciones: [
      { rol: "Coordinación", nombre: "RocaKids", sub: "4 salones", dir: "o_pastoral" },
      { rol: "Coordinación", nombre: "Jóvenes (tMt · J+25)", sub: "36 grupos", dir: "o_pastoral" },
      { rol: "Coordinación", nombre: "Familias y adultos", sub: "Casa2 · Josués · Dorados", dir: "o_pastoral" },
      { rol: "Coordinación", nombre: "Alabanza y VISA", sub: "58 servidores", dir: "o_operativos" },
      { rol: "Coordinación", nombre: "Ujieres y Creativo", sub: "70 servidores", dir: "o_operativos" }
    ],
    base: { rol: "Líderes de grupo", nombre: "88 líderes de grupo pequeño", sub: "cuidan ~1.940 personas" }
  };

  /* ============================================================
     NUEVOS — con recurrencia (semanas de asistencia)
     ============================================================ */
  const NUEVOS = [
    { id: "nv_1", nombre: "Sebastián Cardona", tel: "+57 320 555 7741", email: "sebastian.c@email.com",
      fuente: "Formulario web 'Soy nuevo'", primeraVisita: "8 jun 2026", semanas: [true],
      estado: "Bienvenida pendiente", etapa: "conoce", asignado: "Andrea Pineda", edad: 31 },
    { id: "nv_2", nombre: "María Fernanda Soto", tel: "+57 301 555 9921", email: "mafe.soto@email.com",
      fuente: "Invitada por una amiga", primeraVisita: "25 may 2026", semanas: [true, true, true],
      estado: "Recurrente · sin grupo", etapa: "conoce", asignado: "Andrea Pineda", edad: 27 },
    { id: "nv_3", nombre: "Andrés Felipe Quiroga", tel: "+57 313 555 4002", email: "af.quiroga@email.com",
      fuente: "Redes sociales", primeraVisita: "1 jun 2026", semanas: [true, true],
      estado: "En seguimiento", etapa: "conoce", asignado: "Diego Rivas", edad: 34 },
    { id: "nv_4", nombre: "Laura Ximena Peña", tel: "+57 300 555 7715", email: "lx.pena@email.com",
      fuente: "Domingo presencial", primeraVisita: "18 may 2026", semanas: [true, true, false, true],
      estado: "Recurrente · invitar a ADN", etapa: "conoce", asignado: "Andrea Pineda", edad: 22 },
    { id: "nv_5", nombre: "Julián Esteban Mora", tel: "+57 311 555 2284", email: "je.mora@email.com",
      fuente: "Invitado por un amigo", primeraVisita: "8 jun 2026", semanas: [true],
      estado: "Bienvenida pendiente", etapa: "conoce", asignado: "Diego Rivas", edad: 29 },
    { id: "nv_6", nombre: "Daniela Rincón", tel: "+57 318 555 6650", email: "dani.rincon@email.com",
      fuente: "Formulario web 'Soy nuevo'", primeraVisita: "11 may 2026", semanas: [true, true, true, true, true],
      estado: "Recurrente · listo para grupo", etapa: "conecta", asignado: "Laura Méndez", edad: 25 },
    { id: "nv_7", nombre: "Carlos Andrés Beltrán", tel: "+57 320 555 1190", email: "ca.beltran@email.com",
      fuente: "Invitado", primeraVisita: "1 jun 2026", semanas: [true, false],
      estado: "Una sola visita reciente", etapa: "conoce", asignado: "Diego Rivas", edad: 41 }
  ];

  /* ============================================================
     MINISTERIOS — CRM, grupos pequeños y calendario ÚNICOS
     Estructura: subs vacío = plano; subs con items = por subdivisión
     (grupos/personas pasan a ser objetos keyed por sub id).
     Persona: { n, etapa, edad, tel, email, sub }
     ============================================================ */
  const MIN = {
    /* ---- tMt (Pulso / Eco / Legado) ---- */
    m_tmt: {
      nombre: "tMt", ico: "🎸", director: "Felipe Acosta",
      desc: "Jóvenes de 11 a 25 años, en tres franjas por afinidad.",
      subs: [
        { id: "pulso", nombre: "Pulso", rango: "11–14 años", lider: "Juan D. Páez", personas: 96 },
        { id: "eco", nombre: "Eco", rango: "15–18 años", lider: "Valeria Sánchez", personas: 118 },
        { id: "legado", nombre: "Legado", rango: "19–25 años", lider: "Mateo Cano", personas: 96 }
      ],
      grupos: {
        pulso: [
          { nombre: "Pulso Norte", dia: "Sábado", hora: "3:00 pm", lider: "Juan D. Páez", cupo: 20, miembros: 17, zona: "Chicó" },
          { nombre: "Pulso Skate & Fe", dia: "Sábado", hora: "4:30 pm", lider: "Karen Ruiz", cupo: 18, miembros: 14, zona: "Norte" }
        ],
        eco: [
          { nombre: "Eco Colegios", dia: "Viernes", hora: "6:00 pm", lider: "Valeria Sánchez", cupo: 25, miembros: 22, zona: "Norte" },
          { nombre: "Eco Música", dia: "Viernes", hora: "7:30 pm", lider: "Samuel Niño", cupo: 20, miembros: 18, zona: "Centro" }
        ],
        legado: [
          { nombre: "Legado Universitarios", dia: "Viernes", hora: "6:30 pm", lider: "Mateo Cano", cupo: 25, miembros: 21, zona: "Norte" },
          { nombre: "Legado Profesionales Jr", dia: "Jueves", hora: "7:00 pm", lider: "Diana Cifuentes", cupo: 18, miembros: 15, zona: "Chicó" }
        ]
      },
      personas: {
        pulso: [
          { n: "Samuel Ortiz", etapa: "conoce", edad: 12, tel: "+57 310 555 4101", email: "samu.ortiz@email.com", sub: "Pulso Norte" },
          { n: "Mariana Gil", etapa: "conecta", edad: 13, tel: "+57 311 555 4102", email: "mariana.g@email.com", sub: "Pulso Norte" },
          { n: "Tomás Reyes", etapa: "conoce", edad: 14, tel: "+57 312 555 4103", email: "tomas.r@email.com", sub: "Pulso Skate & Fe" },
          { n: "Valeria Mora", etapa: "conecta", edad: 12, tel: "+57 313 555 4104", email: "valeria.m@email.com", sub: "Pulso Norte" }
        ],
        eco: [
          { n: "Juan Pablo Díaz", etapa: "conecta", edad: 16, tel: "+57 314 555 4201", email: "jp.diaz@email.com", sub: "Eco Colegios" },
          { n: "Sara Camila Ruiz", etapa: "crece", edad: 17, tel: "+57 315 555 4202", email: "sc.ruiz@email.com", sub: "Eco Música" },
          { n: "Nicolás Peña", etapa: "conoce", edad: 15, tel: "+57 316 555 4203", email: "nico.pena@email.com", sub: "Eco Colegios" },
          { n: "Isabela Cano", etapa: "conecta", edad: 18, tel: "+57 317 555 4204", email: "isa.cano@email.com", sub: "Eco Música" },
          { n: "Daniel Forero", etapa: "crece", edad: 17, tel: "+57 318 555 4205", email: "dani.forero@email.com", sub: "Eco Colegios" }
        ],
        legado: [
          { n: "Andrea Salazar", etapa: "crece", edad: 21, tel: "+57 319 555 4301", email: "andrea.s@email.com", sub: "Legado Universitarios" },
          { n: "Felipe Cárdenas", etapa: "sirve", edad: 24, tel: "+57 320 555 4302", email: "feli.c@email.com", sub: "Legado Profesionales Jr" },
          { n: "Laura Vanegas", etapa: "conecta", edad: 20, tel: "+57 321 555 4303", email: "laura.v@email.com", sub: "Legado Universitarios" },
          { n: "Julián Mateus", etapa: "crece", edad: 23, tel: "+57 322 555 4304", email: "julian.m@email.com", sub: "Legado Profesionales Jr" }
        ]
      },
      calendario: [
        { dia: "Vie 12 jun", titulo: "Eco · Noche de juegos", hora: "6:00 pm", lugar: "Salón juvenil" },
        { dia: "Sáb 13 jun", titulo: "Pulso · Salida al parque", hora: "9:00 am", lugar: "Parque 93" },
        { dia: "Vie 19 jun", titulo: "Legado · Conversatorio vocación", hora: "6:30 pm", lugar: "Café Roca" }
      ]
    },

    /* ---- J+25 ---- */
    m_j25: {
      nombre: "J+25", ico: "🌱", director: "Andrés Lozano",
      desc: "Jóvenes de 26 a 35 años, organizados por afinidad.",
      subs: [],
      grupos: [
        { nombre: "J+25 · Café & Palabra", dia: "Jueves", hora: "7:00 pm", lider: "Daniel Garzón", cupo: 16, miembros: 11, zona: "Café del Norte · Chicó" },
        { nombre: "J+25 Conexión Virtual", dia: "Martes", hora: "8:00 pm", lider: "Diego Rivas", cupo: 20, miembros: 9, zona: "En línea" },
        { nombre: "J+25 Creativos", dia: "Miércoles", hora: "7:30 pm", lider: "Laura Méndez", cupo: 16, miembros: 13, zona: "Centro" }
      ],
      personas: [
        { n: "Valentina Ríos", etapa: "crece", edad: 28, tel: "+57 310 555 1208", email: "valentina.rios@email.com", sub: "Profesionales" },
        { n: "Daniel Garzón", etapa: "conecta", edad: 30, tel: "+57 300 555 1199", email: "daniel.garzon@casaroca.org", sub: "Buscando grupo" },
        { n: "Laura Tobón", etapa: "conecta", edad: 26, tel: "+57 311 555 9032", email: "laura.tobon@email.com", sub: "En riesgo", riesgo: true },
        { n: "Camilo Pardo", etapa: "sirve", edad: 33, tel: "+57 312 555 5510", email: "camilo.pardo@email.com", sub: "Creativos" },
        { n: "Natalia Vélez", etapa: "crece", edad: 29, tel: "+57 313 555 5511", email: "nata.velez@email.com", sub: "Profesionales" },
        { n: "Sergio Mahecha", etapa: "conoce", edad: 31, tel: "+57 314 555 5512", email: "sergio.m@email.com", sub: "Nuevos en la fe" }
      ],
      calendario: [
        { dia: "Jue 11 jun", titulo: "Grupo Norte · Café & Palabra", hora: "7:00 pm", lugar: "Café Roca" },
        { dia: "Mar 16 jun", titulo: "Conexión Virtual", hora: "8:00 pm", lugar: "Zoom" },
        { dia: "Sáb 27 jun", titulo: "Encuentro J+25 (todos los grupos)", hora: "5:00 pm", lugar: "Auditorio" }
      ]
    },

    /* ---- Josués ---- */
    m_josues: {
      nombre: "Josués", ico: "🧗", director: "Ricardo Peña",
      desc: "Adultos solteros de 35 a 55 años.",
      subs: [],
      grupos: [
        { nombre: "Josués Aventura", dia: "Sábado", hora: "8:00 am", lider: "Ricardo Peña", cupo: 16, miembros: 12, zona: "Norte" },
        { nombre: "Josués Propósito", dia: "Martes", hora: "7:00 pm", lider: "Patricia León", cupo: 14, miembros: 10, zona: "Centro" }
      ],
      personas: [
        { n: "Ricardo Peña", etapa: "sirve", edad: 48, tel: "+57 315 555 6001", email: "ricardo.pena@email.com", sub: "Líder" },
        { n: "Patricia León", etapa: "sirve", edad: 44, tel: "+57 316 555 6002", email: "patri.leon@email.com", sub: "Líder" },
        { n: "Gustavo Mejía", etapa: "crece", edad: 51, tel: "+57 317 555 6003", email: "gustavo.m@email.com", sub: "Aventura" },
        { n: "Claudia Bernal", etapa: "conecta", edad: 39, tel: "+57 318 555 6004", email: "claudia.b@email.com", sub: "Propósito" },
        { n: "Hernando Ruiz", etapa: "conoce", edad: 46, tel: "+57 319 555 6005", email: "hernando.r@email.com", sub: "Nuevo" }
      ],
      calendario: [
        { dia: "Sáb 13 jun", titulo: "Caminata Josués Aventura", hora: "8:00 am", lugar: "Cerros orientales" },
        { dia: "Mar 23 jun", titulo: "Cena de propósito", hora: "7:00 pm", lugar: "Café Roca" }
      ]
    },

    /* ---- Mujer Integral ---- */
    m_mujer: {
      nombre: "Mujer Integral", ico: "🌷", director: "Natalia Cruz",
      desc: "Mujeres, por afinidad y temporada de vida.",
      subs: [],
      grupos: [
        { nombre: "Mujer · Centro", dia: "Miércoles", hora: "9:00 am", lider: "Marta López", cupo: 16, miembros: 15, zona: "Centro" },
        { nombre: "Mujer · Profesionales", dia: "Jueves", hora: "7:00 pm", lider: "Natalia Cruz", cupo: 18, miembros: 16, zona: "Norte" },
        { nombre: "Mujer · Jóvenes mamás", dia: "Martes", hora: "9:30 am", lider: "Carolina Ruiz", cupo: 15, miembros: 12, zona: "Occidente" }
      ],
      personas: [
        { n: "Marta López", etapa: "sirve", edad: 47, tel: "+57 320 555 1100", email: "marta.lopez@email.com", sub: "Líder · Centro" },
        { n: "Natalia Cruz", etapa: "sirve", edad: 42, tel: "+57 321 555 1101", email: "natalia.cruz@email.com", sub: "Directora" },
        { n: "Adriana Gómez", etapa: "crece", edad: 38, tel: "+57 322 555 1102", email: "adri.gomez@email.com", sub: "Profesionales" },
        { n: "Lucía Fernández", etapa: "conecta", edad: 33, tel: "+57 323 555 1103", email: "lucia.f@email.com", sub: "Jóvenes mamás" },
        { n: "Sandra Quintero", etapa: "conoce", edad: 29, tel: "+57 324 555 1104", email: "sandra.q@email.com", sub: "Nueva" },
        { n: "Rocío Bernal", etapa: "crece", edad: 51, tel: "+57 325 555 1105", email: "rocio.b@email.com", sub: "Centro" }
      ],
      calendario: [
        { dia: "Mié 11 jun", titulo: "Grupo Centro · Estudio", hora: "9:00 am", lugar: "Salón 3" },
        { dia: "Jue 18 jun", titulo: "Noche de Mujer Integral", hora: "6:30 pm", lugar: "Auditorio" },
        { dia: "Sáb 28 jun", titulo: "Desayuno de gratitud", hora: "8:30 am", lugar: "Comedor" }
      ]
    },

    /* ---- Hombres de Bien ---- */
    m_hombres: {
      nombre: "Hombres de Bien", ico: "🛡️", director: "Óscar Tovar",
      desc: "Hombres, formación de carácter e integridad.",
      subs: [],
      grupos: [
        { nombre: "Hombres · Carácter", dia: "Miércoles", hora: "6:30 am", lider: "Óscar Tovar", cupo: 16, miembros: 14, zona: "Norte" },
        { nombre: "Hombres · Finanzas con propósito", dia: "Jueves", hora: "7:00 pm", lider: "Andrés Vargas", cupo: 14, miembros: 11, zona: "Chicó" }
      ],
      personas: [
        { n: "Óscar Tovar", etapa: "sirve", edad: 45, tel: "+57 313 555 3321", email: "oscar.tovar@email.com", sub: "Director" },
        { n: "Andrés Vargas", etapa: "sirve", edad: 41, tel: "+57 326 555 3322", email: "andres.v@email.com", sub: "Líder" },
        { n: "Fernando Gil", etapa: "crece", edad: 38, tel: "+57 327 555 3323", email: "fer.gil@email.com", sub: "Carácter" },
        { n: "Mauricio Ríos", etapa: "conecta", edad: 35, tel: "+57 328 555 3324", email: "mauricio.r@email.com", sub: "Finanzas" },
        { n: "Jairo Mendoza", etapa: "conoce", edad: 49, tel: "+57 329 555 3325", email: "jairo.m@email.com", sub: "Nuevo" }
      ],
      calendario: [
        { dia: "Mié 11 jun", titulo: "Desayuno de carácter", hora: "6:30 am", lugar: "Café Roca" },
        { dia: "Jue 19 jun", titulo: "Finanzas con propósito", hora: "7:00 pm", lugar: "Salón 2" }
      ]
    },

    /* ---- Años Dorados ---- */
    m_dorados: {
      nombre: "Años Dorados", ico: "🌅", director: "Esperanza Díaz",
      desc: "Adultos mayores. Honra, compañía y propósito.",
      subs: [],
      grupos: [
        { nombre: "Dorados · Encuentro semanal", dia: "Martes", hora: "10:00 am", lider: "Esperanza Díaz", cupo: 20, miembros: 18, zona: "Centro" },
        { nombre: "Dorados · Manualidades", dia: "Jueves", hora: "10:00 am", lider: "Beatriz Soto", cupo: 16, miembros: 13, zona: "Norte" }
      ],
      personas: [
        { n: "Esperanza Díaz", etapa: "sirve", edad: 68, tel: "+57 300 555 6677", email: "esperanza.d@email.com", sub: "Directora" },
        { n: "Beatriz Soto", etapa: "sirve", edad: 64, tel: "+57 301 555 6678", email: "bea.soto@email.com", sub: "Líder" },
        { n: "Alfonso Mejía", etapa: "crece", edad: 71, tel: "+57 302 555 6679", email: "alfonso.m@email.com", sub: "Encuentro" },
        { n: "Carmen Rosa Niño", etapa: "conecta", edad: 66, tel: "+57 303 555 6680", email: "carmen.n@email.com", sub: "Manualidades" },
        { n: "Gabriel Páez", etapa: "conoce", edad: 73, tel: "+57 304 555 6681", email: "gabriel.p@email.com", sub: "Nuevo" }
      ],
      calendario: [
        { dia: "Mar 16 jun", titulo: "Encuentro semanal", hora: "10:00 am", lugar: "Salón 1" },
        { dia: "Dom 21 jun", titulo: "Almuerzo Años Dorados", hora: "1:00 pm", lugar: "Comedor" }
      ]
    },

    /* ---- Casa2 / Casados (Jr · Sr · Con hijos · Sin hijos) ---- */
    m_casa2: {
      nombre: "Casa2 (Casados)", ico: "💍", director: "Camilo y Ana Restrepo",
      desc: "Parejas y matrimonios, por etapa de vida.",
      subs: [
        { id: "jr", nombre: "Casados Jr", rango: "Jóvenes casados", lider: "Luis y Tina Soto", personas: 38 },
        { id: "sr", nombre: "Casados Sr", rango: "Matrimonios maduros", lider: "Gloria y Hugo Páez", personas: 36 },
        { id: "conhijos", nombre: "Con hijos", rango: "Etapa de crianza", lider: "Marta y Andrés Ríos", personas: 70 },
        { id: "sinhijos", nombre: "Sin hijos", rango: "Recién casados", lider: "Pedro y Ana Gil", personas: 44 }
      ],
      grupos: {
        jr: [{ nombre: "Casa2 Jr · Norte", dia: "Viernes", hora: "7:30 pm", lider: "Luis Soto", cupo: 12, miembros: 10, zona: "Chicó" }],
        sr: [{ nombre: "Casa2 Sr · Legado", dia: "Sábado", hora: "6:00 pm", lider: "Hugo Páez", cupo: 14, miembros: 12, zona: "Norte" }],
        conhijos: [
          { nombre: "Casa2 Crianza A", dia: "Sábado", hora: "4:00 pm", lider: "Andrés Ríos", cupo: 14, miembros: 12, zona: "Occidente" },
          { nombre: "Casa2 Crianza B", dia: "Domingo", hora: "3:00 pm", lider: "Marta Ríos", cupo: 14, miembros: 11, zona: "Norte" }
        ],
        sinhijos: [{ nombre: "Casa2 Recién Casados", dia: "Sábado", hora: "5:00 pm", lider: "Pedro Gil", cupo: 12, miembros: 8, zona: "Occidente" }]
      },
      personas: {
        jr: [
          { n: "Luis y Tina Soto", etapa: "sirve", edad: 32, tel: "+57 305 555 7001", email: "luis.soto@email.com", sub: "Líderes" },
          { n: "Mateo y Sara Lara", etapa: "crece", edad: 30, tel: "+57 306 555 7002", email: "mateo.lara@email.com", sub: "Norte" },
          { n: "Andrés y Pao Quintero", etapa: "conecta", edad: 29, tel: "+57 307 555 7003", email: "andres.q@email.com", sub: "Norte" }
        ],
        sr: [
          { n: "Gloria y Hugo Páez", etapa: "sirve", edad: 58, tel: "+57 308 555 7101", email: "hugo.paez@email.com", sub: "Líderes" },
          { n: "Jaime y Rosa Tovar", etapa: "crece", edad: 61, tel: "+57 309 555 7102", email: "jaime.t@email.com", sub: "Legado" }
        ],
        conhijos: [
          { n: "Camila y Andrés Vargas", etapa: "sirve", edad: 39, tel: "+57 310 555 3344", email: "camila.vargas@email.com", sub: "Crianza A" },
          { n: "Marta y Andrés Ríos", etapa: "sirve", edad: 41, tel: "+57 311 555 7202", email: "marta.rios@email.com", sub: "Líderes" },
          { n: "Diego y Laura Sáenz", etapa: "crece", edad: 36, tel: "+57 312 555 7203", email: "diego.saenz@email.com", sub: "Crianza B" },
          { n: "Felipe y Ana Moreno", etapa: "conecta", edad: 34, tel: "+57 313 555 7204", email: "felipe.m@email.com", sub: "Crianza A" }
        ],
        sinhijos: [
          { n: "Pedro y Ana Gil", etapa: "sirve", edad: 28, tel: "+57 301 555 2210", email: "pedro.gil@email.com", sub: "Líderes" },
          { n: "Juan y Vale Cano", etapa: "conecta", edad: 27, tel: "+57 314 555 7302", email: "juan.cano@email.com", sub: "Recién casados" }
        ]
      },
      calendario: [
        { dia: "Vie 12 jun", titulo: "Casa2 Jr · Noche de parejas", hora: "7:30 pm", lugar: "Salón 2" },
        { dia: "Sáb 13 jun", titulo: "Casa2 Crianza · Taller de hijos", hora: "4:00 pm", lugar: "Salón familiar" },
        { dia: "Sáb 20 jun", titulo: "Cena de matrimonios (todos)", hora: "6:30 pm", lugar: "Auditorio" }
      ]
    }
  };

  /* ============================================================
     EQUIPOS OPERATIVOS — director + servidores (voluntarios) +
     calendario. Servidor: { n, rol, tel, email }
     ============================================================ */
  const OPER = {
    m_alabanza: {
      nombre: "Alabanza", ico: "🎶", director: "David Quintero", dirTel: "+57 320 555 8001", dirEmail: "david.q@casaroca.org",
      desc: "Equipo musical y de adoración del domingo.",
      servidores: [
        { n: "Sara Bello", rol: "Vocalista líder", tel: "+57 321 555 8002", email: "sara.b@email.com" },
        { n: "Iván Cruz", rol: "Director de banda", tel: "+57 322 555 8003", email: "ivan.c@email.com" },
        { n: "Nico Rey", rol: "Producción musical", tel: "+57 323 555 8004", email: "nico.rey@email.com" },
        { n: "Laura Sáenz", rol: "Vocalista", tel: "+57 324 555 8005", email: "laura.s@email.com" },
        { n: "Tomás Vela", rol: "Guitarra", tel: "+57 325 555 8006", email: "tomas.v@email.com" }
      ],
      calendario: [
        { dia: "Sáb 13 jun", titulo: "Ensayo general", hora: "3:00 pm", lugar: "Auditorio" },
        { dia: "Dom 14 jun", titulo: "Servicio dominical (3 turnos)", hora: "7:00 am", lugar: "Auditorio" }
      ]
    },
    m_nicodemo: {
      nombre: "Nicodemo", ico: "🌙", director: "Esteban Marín", dirTel: "+57 320 555 8101", dirEmail: "esteban.m@casaroca.org",
      desc: "Equipo de oración e intercesión. Cubren los servicios en oración.",
      servidores: [
        { n: "Gloria Méndez", rol: "Intercesora líder", tel: "+57 321 555 8102", email: "gloria.m@email.com" },
        { n: "Raúl Sandoval", rol: "Intercesor", tel: "+57 322 555 8103", email: "raul.s@email.com" },
        { n: "Marina Ortiz", rol: "Coordinadora de turnos", tel: "+57 323 555 8104", email: "marina.o@email.com" },
        { n: "Pedro Niño", rol: "Intercesor", tel: "+57 324 555 8105", email: "pedro.n@email.com" }
      ],
      calendario: [
        { dia: "Sáb 13 jun", titulo: "Vigilia de oración", hora: "8:00 pm", lugar: "Salón 1" },
        { dia: "Dom 14 jun", titulo: "Cobertura de servicios", hora: "7:30 am", lugar: "Sala de oración" }
      ]
    },
    m_ujieres: {
      nombre: "Ujieres", ico: "🚪", director: "Claudia Mora", dirTel: "+57 320 555 8201", dirEmail: "claudia.m@casaroca.org",
      desc: "Logística y hospitalidad del domingo. Primer rostro de la casa.",
      servidores: [
        { n: "Hernán Lugo", rol: "Coordinador de puertas", tel: "+57 321 555 8202", email: "hernan.l@email.com" },
        { n: "Diana Castro", rol: "Hospitalidad", tel: "+57 322 555 8203", email: "diana.c@email.com" },
        { n: "Mauricio Peña", rol: "Estacionamiento", tel: "+57 323 555 8204", email: "mauricio.p@email.com" },
        { n: "Lina Acosta", rol: "Bienvenida nuevos", tel: "+57 324 555 8205", email: "lina.a@email.com" },
        { n: "Carlos Yepes", rol: "Seguridad de salón", tel: "+57 325 555 8206", email: "carlos.y@email.com" }
      ],
      calendario: [
        { dia: "Dom 14 jun", titulo: "Turno de domingo (3 servicios)", hora: "6:30 am", lugar: "Accesos" },
        { dia: "Mar 16 jun", titulo: "Capacitación de hospitalidad", hora: "7:00 pm", lugar: "Salón 3" }
      ]
    },
    m_visa: {
      nombre: "VISA", ico: "🎛️", director: "Hernán Ortiz", dirTel: "+57 320 555 8301", dirEmail: "hernan.o@casaroca.org",
      desc: "Técnica, sonido, video y transmisión.",
      servidores: [
        { n: "Tomás Vela", rol: "Sonido", tel: "+57 321 555 8302", email: "tomas.vela@email.com" },
        { n: "Ana Lugo", rol: "Video y streaming", tel: "+57 322 555 8303", email: "ana.lugo@email.com" },
        { n: "Beto Sanz", rol: "Iluminación", tel: "+57 323 555 8304", email: "beto.s@email.com" },
        { n: "Felipe Rincón", rol: "Cámaras", tel: "+57 324 555 8305", email: "felipe.r@email.com" }
      ],
      calendario: [
        { dia: "Sáb 13 jun", titulo: "Prueba de sonido y transmisión", hora: "2:00 pm", lugar: "Cabina técnica" },
        { dia: "Dom 14 jun", titulo: "Operación de servicios", hora: "7:00 am", lugar: "Cabina técnica" }
      ]
    },
    m_creativo: {
      nombre: "Creativo", ico: "🎬", director: "Lucía Franco", dirTel: "+57 320 555 8401", dirEmail: "lucia.f@casaroca.org",
      desc: "Experiencia, ambientación y producción del domingo.",
      servidores: [
        { n: "Mariana Soto", rol: "Diseño gráfico", tel: "+57 321 555 8402", email: "mariana.s@email.com" },
        { n: "Julián Beltrán", rol: "Audiovisual", tel: "+57 322 555 8403", email: "julian.b@email.com" },
        { n: "Paula Niño", rol: "Ambientación", tel: "+57 323 555 8404", email: "paula.n@email.com" },
        { n: "Andrés Mejía", rol: "Redes sociales", tel: "+57 324 555 8405", email: "andres.mej@email.com" }
      ],
      calendario: [
        { dia: "Mié 11 jun", titulo: "Producción de piezas dominicales", hora: "5:00 pm", lugar: "Estudio creativo" },
        { dia: "Vie 13 jun", titulo: "Montaje de ambientación", hora: "4:00 pm", lugar: "Auditorio" }
      ]
    },
    m_rocafe: {
      nombre: "Rocafe", ico: "☕", director: "Paola Ramírez", dirTel: "+57 320 555 8501", dirEmail: "paola.r@casaroca.org",
      desc: "Cafetería y hospitalidad cálida. Punto de encuentro entre servicios.",
      servidores: [
        { n: "Carolina Díaz", rol: "Barista líder", tel: "+57 321 555 8502", email: "caro.d@email.com" },
        { n: "Mateo Ruiz", rol: "Atención", tel: "+57 322 555 8503", email: "mateo.ru@email.com" },
        { n: "Sofía Mora", rol: "Caja", tel: "+57 323 555 8504", email: "sofia.m@email.com" },
        { n: "Andrés Lara", rol: "Logística", tel: "+57 324 555 8505", email: "andres.la@email.com" }
      ],
      calendario: [
        { dia: "Dom 14 jun", titulo: "Servicio de café (entre servicios)", hora: "8:30 am", lugar: "Rocafe" },
        { dia: "Sáb 20 jun", titulo: "Inventario y compras", hora: "10:00 am", lugar: "Rocafe" }
      ]
    },
    m_consejeria: {
      nombre: "Consejería", ico: "🤲", director: "Ps. Lina Caro", dirTel: "+57 320 555 8601", dirEmail: "lina.caro@casaroca.org",
      desc: "Equipo de consejeros que atienden las solicitudes de acompañamiento.",
      servidores: [
        { n: "Ps. Hugo Real", rol: "Consejero · Matrimonial", tel: "+57 321 555 8602", email: "hugo.real@casaroca.org" },
        { n: "Ps. Marta Niño", rol: "Consejera · Emocional", tel: "+57 322 555 8603", email: "marta.nino@casaroca.org" },
        { n: "Ps. Jorge Ariza", rol: "Consejero · Espiritual", tel: "+57 323 555 8604", email: "jorge.ariza@casaroca.org" },
        { n: "Ps. Ana Vela", rol: "Consejera · Duelo", tel: "+57 324 555 8605", email: "ana.vela@casaroca.org" }
      ],
      calendario: [
        { dia: "Mié 11 jun", titulo: "Citas de consejería", hora: "2:00 pm", lugar: "Consultorios" },
        { dia: "Jue 12 jun", titulo: "Reunión de equipo de consejeros", hora: "7:00 pm", lugar: "Salón pastoral" }
      ]
    }
  };
  // Orden de los equipos operativos en el menú/hub
  const OPER_ORDEN = ["m_alabanza", "m_nicodemo", "m_ujieres", "m_visa", "m_creativo", "m_rocafe", "m_consejeria"];

  /* ============================================================
     CONSEJERÍAS — solicitudes y asignación a consejeros
     ============================================================ */
  const CONSEJERIAS = [
    { id: "cs1", persona: "Laura Tobón", tel: "+57 311 555 9032", email: "laura.tobon@email.com",
      tema: "Acompañamiento emocional", prioridad: "alta", estado: "Solicitada", asignado: "—",
      fecha: "5 jun 2026", ministerio: "J+25" },
    { id: "cs2", persona: "Marta López", tel: "+57 320 555 1100", email: "marta.lopez@email.com",
      tema: "Duelo familiar", prioridad: "alta", estado: "En proceso", asignado: "Ps. Ana Vela",
      fecha: "28 may 2026", ministerio: "Mujer Integral" },
    { id: "cs3", persona: "Camila y Andrés Vargas", tel: "+57 310 555 3344", email: "camila.vargas@email.com",
      tema: "Consejería matrimonial", prioridad: "media", estado: "Programada", asignado: "Ps. Hugo Real",
      fecha: "18 jun 2026", ministerio: "Casa2 · Con hijos" },
    { id: "cs4", persona: "Valentina Ríos", tel: "+57 310 555 1208", email: "valentina.rios@email.com",
      tema: "Dirección vocacional", prioridad: "media", estado: "Programada", asignado: "Ps. Jorge Ariza",
      fecha: "18 jun 2026", ministerio: "J+25" },
    { id: "cs5", persona: "Mauricio Ríos", tel: "+57 328 555 3324", email: "mauricio.r@email.com",
      tema: "Finanzas personales", prioridad: "baja", estado: "Solicitada", asignado: "—",
      fecha: "9 jun 2026", ministerio: "Hombres de Bien" },
    { id: "cs6", persona: "Sandra Quintero", tel: "+57 324 555 1104", email: "sandra.q@email.com",
      tema: "Primeros pasos en la fe", prioridad: "media", estado: "Finalizada", asignado: "Ps. Marta Niño",
      fecha: "2 jun 2026", ministerio: "Mujer Integral" }
  ];

  /* ============================================================
     CONTABILIDAD — presupuesto de la sede + pagos / facturas
     ============================================================ */
  const CONTA = {
    presupuestoMes: 168000000,   // COP presupuestado mes
    ejecutadoMes: 121400000,     // COP ejecutado
    ingresoMes: 224000000,       // recaudo (diezmos + ofrendas)
    presupuesto: [
      { categoria: "Nómina y honorarios", presupuesto: 78000000, ejecutado: 71200000 },
      { categoria: "Operación del domingo", presupuesto: 22000000, ejecutado: 18600000 },
      { categoria: "Ministerios (programas)", presupuesto: 18000000, ejecutado: 9800000 },
      { categoria: "RocaKids y seguridad", presupuesto: 12000000, ejecutado: 7400000 },
      { categoria: "Mantenimiento y servicios", presupuesto: 16000000, ejecutado: 8200000 },
      { categoria: "Misiones y Fundación M.A.S", presupuesto: 14000000, ejecutado: 4800000 },
      { categoria: "Comunicaciones y creativo", presupuesto: 8000000, ejecutado: 1400000 }
    ],
    pagos: [
      { id: "f1", concepto: "Arriendo auditorio · junio", proveedor: "Inmobiliaria Chicó S.A.", monto: 24000000, fecha: "5 jun 2026", estado: "Pagado", factura: "FAC-2210" },
      { id: "f2", concepto: "Sonido · mantenimiento consola", proveedor: "AudioPro Ltda.", monto: 3800000, fecha: "8 jun 2026", estado: "Pagado", factura: "FAC-2231" },
      { id: "f3", concepto: "Insumos RocaKids", proveedor: "Didácticos Kids", monto: 2100000, fecha: "9 jun 2026", estado: "Por pagar", factura: "FAC-2240" },
      { id: "f4", concepto: "Café e insumos Rocafe", proveedor: "Café de la Sabana", monto: 1650000, fecha: "10 jun 2026", estado: "Por pagar", factura: "FAC-2245" },
      { id: "f5", concepto: "Servicios públicos · mayo", proveedor: "Empresas de Servicios", monto: 5400000, fecha: "3 jun 2026", estado: "Pagado", factura: "FAC-2198" }
    ]
  };

  return { PANEL, ORG, NUEVOS, MIN, OPER, OPER_ORDEN, CONSEJERIAS, CONTA };
})();
