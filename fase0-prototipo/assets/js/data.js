/* ============================================================
   CASA ROCA AI SYSTEM — DATOS MOCK (Fase 0 · v2 ampliada)
   Dos sistemas con jerarquía de alcance:
   · ERP/Administración global (Pastor Director General · sede madre)
   · Operación de filial (Pastor Congregacional) y hacia abajo.
   Se expone como window.DB. Sin backend: todo vive en memoria.
   ============================================================ */
window.DB = (function () {

  /* ============================================================
     ROLES (con alcance jerárquico y permisos)
     ============================================================ */
  const ROLES = {
    pastor_admin: {
      id: "pastor_admin", nombre: "Pastor Director General", ico: "⛪",
      desc: "Dirige todo el sistema: ERP global + pastoral de toda la red",
      alcance: "global", sede: "bogota", persona: "p_dario",
      sistema: "Dirección General · Sede Madre"
    },
    pastor_sede: {
      id: "pastor_sede", nombre: "Pastor Congregacional", ico: "🏛️",
      desc: "Su sede filial: administración local + todos los ministerios",
      alcance: "sede", sede: "bogota", persona: "p_camilo",
      sistema: "Filial · Bogotá Chicó"
    },
    director: {
      id: "director", nombre: "Director de Ministerio", ico: "🧭",
      desc: "Su ministerio (RocaKids) con todos sus grupos y voluntarios",
      alcance: "ministerio", ministerio: "m_rocakids", sede: "bogota", persona: "p_marcela",
      sistema: "Ministerio RocaKids"
    },
    coordinador: {
      id: "coordinador", nombre: "Coordinador", ico: "🧩",
      desc: "Coordina varios grupos dentro de un ministerio",
      alcance: "coordinacion", ministerio: "m_j25", sede: "bogota", persona: "p_andres",
      sistema: "Coordinación J+25"
    },
    lider: {
      id: "lider", nombre: "Líder de Grupo", ico: "🤝",
      desc: "Su grupo pequeño de conexión",
      alcance: "grupo", grupo: "g_j25_norte", sede: "bogota", persona: "p_daniel",
      sistema: "Grupo J+25 · Café & Palabra"
    },
    tesoreria: {
      id: "tesoreria", nombre: "Equipo Tesorería", ico: "💼",
      desc: "Finanzas, donaciones y conciliación con Siigo",
      alcance: "modulo", modulo: "e_tesoreria", sede: "bogota", persona: "p_jorge",
      sistema: "ERP · Tesorería"
    }
  };

  /* ============================================================
     SEDES
     ============================================================ */
  const SEDES = [
    { id: "bogota", nombre: "Bogotá Chicó", pais: "Colombia", ciudad: "Bogotá", esMadre: true, personas: 1940 },
    { id: "medellin", nombre: "Medellín", pais: "Colombia", ciudad: "Medellín", personas: 1120 },
    { id: "cali", nombre: "Cali", pais: "Colombia", ciudad: "Cali", personas: 860 },
    { id: "miami", nombre: "Miami", pais: "Estados Unidos", ciudad: "Miami", personas: 540 },
    { id: "madrid", nombre: "Madrid", pais: "España", ciudad: "Madrid", personas: 410 }
  ];

  /* ============================================================
     MINISTERIOS — catálogo COMPLETO (congregacionales + operativos)
     Cada uno con flag 'activo' (se activa/crea desde Configuración),
     subdivisiones, director, conteos.
     ============================================================ */
  const MINISTERIOS = [
    /* ---- Congregacionales (por momento de vida / afinidad) ---- */
    { id: "m_rocakids", nombre: "RocaKids", tipo: "congregacional", ico: "🧒", activo: true,
      desc: "Niños de 1 a 10 años. Un ambiente ideal para que conozcan a Jesús.",
      director: "Marcela Gómez", directorId: "p_marcela", personas: 138, grupos: 8, voluntarios: 24,
      subdiv: [
        { nombre: "Bebés", rango: "1–2 años", lider: "Paula Niño", miembros: 18 },
        { nombre: "Pequeños", rango: "3–5 años", lider: "Sofía Lara", miembros: 42 },
        { nombre: "Exploradores", rango: "6–7 años", lider: "Andrés Mejía", miembros: 39 },
        { nombre: "Aventureros", rango: "8–10 años", lider: "Carolina Ruiz", miembros: 39 }
      ] },
    { id: "m_tmt", nombre: "tMt", tipo: "congregacional", ico: "🎸", activo: true,
      desc: "Jóvenes de 11 a 25 años. Trabajan por afinidad en tres franjas.",
      director: "Felipe Acosta", directorId: null, personas: 310, grupos: 22, voluntarios: 40,
      subdiv: [
        { nombre: "Pulso", rango: "11–14 años", lider: "Juan D. Páez", miembros: 96 },
        { nombre: "Eco", rango: "15–18 años", lider: "Valeria Sánchez", miembros: 118 },
        { nombre: "Legado", rango: "19–25 años", lider: "Mateo Cano", miembros: 96 }
      ] },
    { id: "m_j25", nombre: "J+25", tipo: "congregacional", ico: "🌱", activo: true,
      desc: "Jóvenes de 26 a 35 años, organizados por afinidad.",
      director: "Andrés Lozano", directorId: "p_andres", personas: 240, grupos: 14, voluntarios: 18,
      subdiv: [
        { nombre: "Profesionales", rango: "Afinidad", lider: "Andrea Pineda", miembros: 88 },
        { nombre: "Nuevos en la fe", rango: "Afinidad", lider: "Diego Rivas", miembros: 64 },
        { nombre: "Creativos", rango: "Afinidad", lider: "Laura Méndez", miembros: 88 }
      ] },
    { id: "m_josues", nombre: "Josués", tipo: "congregacional", ico: "🧗", activo: true,
      desc: "Adultos solteros de 35 a 55 años.",
      director: "Ricardo Peña", directorId: null, personas: 96, grupos: 6, voluntarios: 8, subdiv: [] },
    { id: "m_casa2", nombre: "Casa2 (Casados)", tipo: "congregacional", ico: "💍", activo: true,
      desc: "Parejas y matrimonios, divididos por etapa de vida.",
      director: "Camilo y Ana Restrepo", directorId: "p_camilo", personas: 188, grupos: 12, voluntarios: 16,
      subdiv: [
        { nombre: "Sin hijos", rango: "Recién casados", lider: "Pedro Gil", miembros: 44 },
        { nombre: "Con hijos", rango: "Crianza", lider: "Marta Ríos", miembros: 70 },
        { nombre: "Jr", rango: "Jóvenes casados", lider: "Luis Soto", miembros: 38 },
        { nombre: "Sr", rango: "Matrimonios maduros", lider: "Gloria Páez", miembros: 36 }
      ] },
    { id: "m_dorados", nombre: "Años Dorados", tipo: "congregacional", ico: "🌅", activo: true,
      desc: "Adultos mayores. Honra, compañía y propósito.",
      director: "Esperanza Díaz", directorId: null, personas: 74, grupos: 4, voluntarios: 9, subdiv: [] },
    { id: "m_mujer", nombre: "Mujer Integral", tipo: "congregacional", ico: "🌷", activo: true,
      desc: "Mujeres, por afinidad y temporada de vida.",
      director: "Natalia Cruz", directorId: null, personas: 220, grupos: 15, voluntarios: 20, subdiv: [] },
    { id: "m_hombres", nombre: "Hombres de Bien", tipo: "congregacional", ico: "🛡️", activo: true,
      desc: "Hombres, formación de carácter e integridad.",
      director: "Óscar Tovar", directorId: null, personas: 165, grupos: 11, voluntarios: 14, subdiv: [] },
    { id: "m_amec", nombre: "AMEC", tipo: "congregacional", ico: "⚕️", activo: true,
      desc: "Vocacional · Profesionales de la salud.",
      director: "Dra. Liliana Vega", directorId: null, personas: 58, grupos: 3, voluntarios: 6, subdiv: [] },
    { id: "m_centuriones", nombre: "Centuriones", tipo: "congregacional", ico: "🎖️", activo: false,
      desc: "Vocacional · Militares y policía.",
      director: "—", directorId: null, personas: 0, grupos: 0, voluntarios: 0, subdiv: [] },
    { id: "m_ejecutivos", nombre: "Ejecutivos y Empresarios", tipo: "congregacional", ico: "💼", activo: false,
      desc: "Vocacional · Líderes de empresa y negocios.",
      director: "—", directorId: null, personas: 0, grupos: 0, voluntarios: 0, subdiv: [] },

    /* ---- Operativos (equipos de servicio del domingo) ---- */
    { id: "m_alabanza", nombre: "Alabanza", tipo: "operacional", ico: "🎶", activo: true,
      desc: "Equipo musical y de adoración.",
      director: "David Quintero", directorId: null, personas: 32, grupos: 0, voluntarios: 32,
      subdiv: [ { nombre: "Vocalistas", rango: "Equipo", lider: "Sara Bello", miembros: 10 },
                { nombre: "Banda", rango: "Equipo", lider: "Iván Cruz", miembros: 12 },
                { nombre: "Producción musical", rango: "Equipo", lider: "Nico Rey", miembros: 10 } ] },
    { id: "m_visa", nombre: "VISA", tipo: "operacional", ico: "🎛️", activo: true,
      desc: "Técnica, sonido, video y transmisión.",
      director: "Hernán Ortiz", directorId: null, personas: 26, grupos: 0, voluntarios: 26,
      subdiv: [ { nombre: "Sonido", rango: "Equipo", lider: "Tomás Vela", miembros: 8 },
                { nombre: "Video y streaming", rango: "Equipo", lider: "Ana Lugo", miembros: 10 },
                { nombre: "Iluminación", rango: "Equipo", lider: "Beto Sanz", miembros: 8 } ] },
    { id: "m_ujieres", nombre: "Ujieres", tipo: "operacional", ico: "🚪", activo: true,
      desc: "Logística y hospitalidad del domingo. Primer rostro de la casa.",
      director: "Claudia Mora", directorId: null, personas: 48, grupos: 0, voluntarios: 48, subdiv: [] },
    { id: "m_creativo", nombre: "Creativo", tipo: "operacional", ico: "🎬", activo: true,
      desc: "Experiencia, ambientación y producción del domingo.",
      director: "Lucía Franco", directorId: null, personas: 22, grupos: 0, voluntarios: 22, subdiv: [] }
  ];

  /* ============================================================
     GRUPOS pequeños (con afinidad)
     ============================================================ */
  const GRUPOS = [
    { id: "g_j25_norte", nombre: "J+25 · Café & Palabra", ministerio: "m_j25", sede: "bogota",
      af: "af_j25_cafe", lider: "p_daniel", afinidad: ["Jóvenes 26–35", "Profesionales"], dia: "Jueves", hora: "7:00 pm",
      modalidad: "Presencial", zona: "Café del Norte · Chicó", cupo: 16, miembros: 11 },
    { id: "g_j25_virtual", nombre: "J+25 Conexión Virtual", ministerio: "m_j25", sede: "bogota",
      lider: "p_andrea", afinidad: ["Jóvenes 26–35", "Nuevos"], dia: "Martes", hora: "8:00 pm",
      modalidad: "Virtual", zona: "En línea", cupo: 20, miembros: 9 },
    { id: "g_casa2_sinhijos", nombre: "Casa2 · Recién Casados", ministerio: "m_casa2", sede: "bogota",
      lider: "p_camilo", afinidad: ["Parejas", "Sin hijos"], dia: "Sábado", hora: "5:00 pm",
      modalidad: "Presencial", zona: "Occidente", cupo: 12, miembros: 8 },
    { id: "g_mujer_centro", nombre: "Mujer Integral · Centro", ministerio: "m_mujer", sede: "bogota",
      lider: "p_marcela", afinidad: ["Mujeres", "Crecimiento"], dia: "Miércoles", hora: "9:00 am",
      modalidad: "Presencial", zona: "Centro", cupo: 16, miembros: 15 },
    { id: "g_amec", nombre: "AMEC · Profesionales de la salud", ministerio: "m_amec", sede: "bogota",
      lider: "p_jorge", afinidad: ["Vocación: Salud", "Profesionales"], dia: "Lunes", hora: "7:30 pm",
      modalidad: "Híbrido", zona: "Norte", cupo: 18, miembros: 12 },
    { id: "g_tmt_legado", nombre: "tMt Legado · Universitarios", ministerio: "m_tmt", sede: "bogota",
      lider: "p_andres", afinidad: ["Jóvenes 19–25", "Universitarios"], dia: "Viernes", hora: "6:30 pm",
      modalidad: "Presencial", zona: "Norte", cupo: 25, miembros: 21 }
  ];

  /* ============================================================
     PERSONAS (corazón del CRM)
     etapa: conoce | conecta | crece | sirve
     ============================================================ */
  const PERSONAS = [
    { id: "p_dario", nombres: "Darío", apellidos: "Silva", iniciales: "DS", rol: "Pastor Director General",
      sede: "bogota", etapa: "sirve", telefono: "—", email: "direccion@casaroca.org" },
    { id: "p_camilo", nombres: "Camilo", apellidos: "Restrepo", iniciales: "CR", rol: "Pastor Congregacional",
      sede: "bogota", etapa: "sirve", telefono: "—", email: "camilo@casaroca.org" },
    { id: "p_marcela", nombres: "Marcela", apellidos: "Gómez", iniciales: "MG", rol: "Directora RocaKids",
      sede: "bogota", etapa: "sirve", telefono: "—", email: "marcela@casaroca.org" },
    { id: "p_andres", nombres: "Andrés", apellidos: "Lozano", iniciales: "AL", rol: "Coordinador J+25",
      sede: "bogota", etapa: "sirve", telefono: "—", email: "andres@casaroca.org" },
    { id: "p_andrea", nombres: "Andrea", apellidos: "Pineda", iniciales: "AP", rol: "Líder J+25",
      sede: "bogota", etapa: "sirve", telefono: "—", email: "andrea@casaroca.org" },
    { id: "p_jorge", nombres: "Jorge", apellidos: "Méndez", iniciales: "JM", rol: "Tesorería",
      sede: "bogota", etapa: "sirve", telefono: "—", email: "jorge@casaroca.org" },

    { id: "p_valentina", nombres: "Valentina", apellidos: "Ríos", iniciales: "VR", rol: "Asistente",
      sede: "bogota", etapa: "crece", subestado: "Curso Madurez Espiritual · Instituto IBLI",
      telefono: "+57 310 555 1208", email: "valentina.rios@email.com",
      edad: 28, estadoCivil: "Soltera", conyuge: null, ministerio: "J+25 · Profesionales",
      fuente: "Invitada por una amiga", primeraVisita: "2025-09-14", grupo: "g_j25_norte",
      responsable: "p_andrea", riesgo: false,
      diezma: true, diezmoAnual: 2840000,
      diezmos: [ { mes: "Jun 2026", monto: 280000 }, { mes: "May 2026", monto: 265000 }, { mes: "Abr 2026", monto: 280000 }, { mes: "Mar 2026", monto: 255000 }, { mes: "Feb 2026", monto: 240000 } ],
      cursos: [ { nombre: "ADN", estado: "Completado" }, { nombre: "Bautizo", estado: "Completado" }, { nombre: "Madurez Espiritual", estado: "En curso · 60%" } ],
      instituto: { programa: "IBLI", semestre: 2, estado: "Activa" },
      consejerias: [ { tema: "Dirección vocacional", estado: "Programada", fecha: "18 jun 2026" } ],
      ayudasMas: [],
      hitos: [
        { tipo: "Primera visita", fecha: "14 sep 2025", color: "azul", txt: "Llegó por primera vez un domingo, invitada por Daniela." },
        { tipo: "Bienvenida", fecha: "16 sep 2025", color: "azul", txt: "Contacto de bienvenida automático + llamada del equipo de seguimiento." },
        { tipo: "Se conectó a un grupo", fecha: "26 sep 2025", color: "mostaza", txt: "Se unió a <b>J+25 · Café & Palabra</b> (afinidad: profesionales)." },
        { tipo: "Curso ADN", fecha: "12 oct 2025", color: "mostaza", txt: "Completó el curso ADN. Certificado emitido." },
        { tipo: "Bautizo", fecha: "23 nov 2025", color: "verde", txt: "¡Se bautizó! Un momento muy especial para su familia." },
        { tipo: "Inscripción Madurez + IBLI", fecha: "10 ene 2026", color: "verde", txt: "Inició <b>Madurez Espiritual</b> y se matriculó en <b>IBLI</b>." }
      ],
      notas: [ { autor: "Andrea Pineda", fecha: "2 jun 2026", txt: "Atraviesa un cambio de trabajo. Pidió oración por dirección. Muy comprometida con el grupo.", conf: "Líder + Pastor" } ],
      peticiones: [ { txt: "Dirección en una decisión laboral importante.", estado: "Activa" } ]
    },
    { id: "p_sebastian", nombres: "Sebastián", apellidos: "Cardona", iniciales: "SC", rol: "Nuevo",
      sede: "bogota", etapa: "conoce", subestado: "Bienvenida pendiente",
      telefono: "+57 320 555 7741", email: "sebastian.c@email.com",
      edad: 31, estadoCivil: "Soltero", conyuge: null, ministerio: "—",
      fuente: "Formulario web 'Soy nuevo'",
      primeraVisita: "2026-06-08", responsable: "p_andrea", riesgo: false, esNuevo: true,
      diezma: false, diezmoAnual: 0, diezmos: [], cursos: [], instituto: null, consejerias: [], ayudasMas: [],
      hitos: [ { tipo: "Registro web", fecha: "8 jun 2026", color: "azul", txt: "Llenó el formulario <b>'Soy nuevo'</b> en la página. Asignado automáticamente a seguimiento." } ],
      notas: [], peticiones: [] },
    { id: "p_laura", nombres: "Laura", apellidos: "Tobón", iniciales: "LT", rol: "Asistente",
      sede: "bogota", etapa: "conecta", subestado: "Sin asistir hace 4 semanas",
      telefono: "+57 311 555 9032", email: "laura.tobon@email.com",
      edad: 26, estadoCivil: "Soltera", conyuge: null, ministerio: "J+25 · Profesionales",
      fuente: "Invitada", primeraVisita: "2025-07-20",
      grupo: "g_j25_norte", responsable: "p_andrea", riesgo: true,
      diezma: false, diezmoAnual: 0, diezmos: [],
      cursos: [ { nombre: "ADN", estado: "Pendiente" } ], instituto: null,
      consejerias: [ { tema: "Acompañamiento emocional", estado: "Solicitada", fecha: "5 jun 2026" } ],
      ayudasMas: [ { tipo: "Mercado de apoyo (M.A.S)", fecha: "abr 2026", estado: "Entregada" } ],
      hitos: [
        { tipo: "Primera visita", fecha: "20 jul 2025", color: "azul", txt: "Primera visita." },
        { tipo: "Se conectó a un grupo", fecha: "2 ago 2025", color: "mostaza", txt: "Se unió a J+25 · Café & Palabra." } ],
      notas: [], peticiones: [] },
    { id: "p_daniel", nombres: "Daniel", apellidos: "Garzón", iniciales: "DG", rol: "Líder J+25 · Café & Palabra",
      sede: "bogota", etapa: "sirve", subestado: "Lidera el grupo Café & Palabra",
      telefono: "+57 310 555 0142", email: "daniel.garzon@casaroca.org",
      edad: 30, estadoCivil: "Soltero", conyuge: null, ministerio: "J+25 · Café & Palabra", grupo: "g_j25_norte",
      fuente: "Asiste hace meses", primeraVisita: "2026-02-02",
      responsable: "p_andres", riesgo: false,
      diezma: true, diezmoAnual: 1200000,
      diezmos: [ { mes: "Jun 2026", monto: 100000 }, { mes: "May 2026", monto: 100000 }, { mes: "Abr 2026", monto: 100000 } ],
      cursos: [ { nombre: "ADN", estado: "Completado" } ], instituto: null, consejerias: [], ayudasMas: [],
      hitos: [
        { tipo: "Primera visita", fecha: "2 feb 2026", color: "azul", txt: "Asiste con frecuencia los domingos." },
        { tipo: "Empezó a liderar", fecha: "20 mar 2026", color: "verde", txt: "Abrió y lidera el grupo de afinidad <b>J+25 · Café & Palabra</b>." } ],
      notas: [], peticiones: [] },

    { id: "p_camila", nombres: "Camila", apellidos: "Vargas", iniciales: "CV", rol: "Voluntaria",
      sede: "bogota", etapa: "sirve", subestado: "Sirve en Casa2 · Con hijos",
      telefono: "+57 310 555 3344", email: "camila.vargas@email.com",
      edad: 39, estadoCivil: "Casada", conyuge: "Andrés Vargas", ministerio: "Casa2 · Con hijos",
      fuente: "Miembro fundador", primeraVisita: "2018-03-04", responsable: "p_camilo", riesgo: false,
      diezma: true, diezmoAnual: 6200000,
      diezmos: [ { mes: "Jun 2026", monto: 520000 }, { mes: "May 2026", monto: 520000 }, { mes: "Abr 2026", monto: 500000 } ],
      cursos: [ { nombre: "ADN", estado: "Completado" }, { nombre: "Madurez Espiritual", estado: "Completado" }, { nombre: "Llaves del Poder", estado: "Completado" } ],
      instituto: { programa: "FACTER", semestre: 1, estado: "Activa" },
      consejerias: [ { tema: "Consejería matrimonial", estado: "Finalizada", fecha: "feb 2026" } ],
      ayudasMas: [],
      hitos: [ { tipo: "Sirve como líder", fecha: "2021", color: "verde", txt: "Lidera pareja en Casa2." } ],
      notas: [], peticiones: [] },
    { id: "p_julian", nombres: "Julián", apellidos: "Ospina", iniciales: "JO", rol: "Asistente",
      sede: "medellin", etapa: "conecta", subestado: "En curso ADN",
      telefono: "+57 314 555 7788", email: "julian.ospina@email.com",
      edad: 24, estadoCivil: "Soltero", conyuge: null, ministerio: "tMt · Legado",
      fuente: "Invitado por un amigo", primeraVisita: "2026-03-15", responsable: null, riesgo: false,
      diezma: false, diezmoAnual: 0, diezmos: [],
      cursos: [ { nombre: "ADN", estado: "En curso" } ], instituto: null, consejerias: [], ayudasMas: [],
      hitos: [ { tipo: "Primera visita", fecha: "15 mar 2026", color: "azul", txt: "Llegó a la sede Medellín." } ],
      notas: [], peticiones: [] },
    { id: "p_marta", nombres: "Marta", apellidos: "López", iniciales: "ML", rol: "Voluntaria",
      sede: "bogota", etapa: "sirve", subestado: "Sirve en Mujer Integral",
      telefono: "+57 320 555 1100", email: "marta.lopez@email.com",
      edad: 47, estadoCivil: "Casada", conyuge: "Hernán Díaz", ministerio: "Mujer Integral",
      fuente: "Miembro", primeraVisita: "2019-08-11", responsable: "p_marcela", riesgo: false,
      diezma: true, diezmoAnual: 3600000,
      diezmos: [ { mes: "Jun 2026", monto: 300000 }, { mes: "May 2026", monto: 300000 } ],
      cursos: [ { nombre: "ADN", estado: "Completado" }, { nombre: "Madurez Espiritual", estado: "Completado" } ],
      instituto: null,
      consejerias: [ { tema: "Duelo familiar", estado: "En proceso", fecha: "may 2026" } ],
      ayudasMas: [ { tipo: "Apoyo en crisis (M.A.S)", fecha: "ene 2026", estado: "Finalizada" } ],
      hitos: [ { tipo: "Sirve", fecha: "2020", color: "verde", txt: "Voluntaria en Mujer Integral." } ],
      notas: [], peticiones: [] }
  ];
  // Roster base del grupo "Café & Palabra" (Daniel es el líder). Los demás
  // inscritos llegan EN VIVO desde el STORE del landing vía bridge.js (DB.registrosVivos()).
  const MIEMBROS_GRUPO = ["p_valentina", "p_laura"];
  // Personas que aparecen en el CRM (congregantes / asistentes / voluntarios)
  const CONGREGANTES = ["p_valentina", "p_camila", "p_marta", "p_daniel", "p_laura", "p_sebastian", "p_julian"];

  /* ============================================================
     FORMACIÓN — Cursos cortos
     ============================================================ */
  const CURSOS = [
    { id: "c_adn", nombre: "ADN", desc: "Tus primeros pasos y la identidad de Casa Roca.", tipo: "curso_corto",
      ico: "🧬", duracion: "4 sesiones", modalidad: "Presencial", cupo: 30, inscritos: 24, inicia: "6 jul 2026", etapa: "conecta" },
    { id: "c_bautizo", nombre: "Bautizo", desc: "Preparación para dar el paso del bautismo en agua.", tipo: "curso_corto",
      ico: "💧", duracion: "2 sesiones", modalidad: "Presencial", cupo: 40, inscritos: 18, inicia: "13 jul 2026", etapa: "conecta" },
    { id: "c_madurez", nombre: "Madurez Espiritual", desc: "Fundamentos para crecer firme en tu fe.", tipo: "curso_corto",
      ico: "🌳", duracion: "8 sesiones", modalidad: "Híbrido", cupo: 35, inscritos: 31, inicia: "En curso", etapa: "crece" },
    { id: "c_llaves", nombre: "Llaves del Poder", desc: "Vida en el Espíritu y dones para servir.", tipo: "curso_corto",
      ico: "🔑", duracion: "6 sesiones", modalidad: "Presencial", cupo: 30, inscritos: 12, inicia: "3 ago 2026", etapa: "crece" }
  ];

  /* ============================================================
     INSTITUTO (LMS · IBLI / FACTER) — malla por semestre
     ============================================================ */
  const INSTITUTOS = [
    { id: "ibli", nombre: "IBLI — Formación Cristiana Integral", ico: "🎓",
      desc: "Instituto bíblico de formación integral. 4 semestres, modalidad virtual en Moodle.",
      semestres: 4, alumnos: 86, docentes: 9, modalidad: "Virtual (Moodle)", sso: true,
      malla: {
        1: [
          { nombre: "Panorama Bíblico I", creditos: 3, profesor: "Ps. Jorge Ariza" },
          { nombre: "Fundamentos de la Fe", creditos: 3, profesor: "Ps. Lina Caro" },
          { nombre: "Vida Devocional", creditos: 2, profesor: "Ps. Marta Niño" }
        ],
        2: [
          { nombre: "Panorama Bíblico II", creditos: 3, profesor: "Ps. Jorge Ariza", avance: 72, nota: 4.5, estado: "En curso" },
          { nombre: "Doctrinas Esenciales", creditos: 3, profesor: "Ps. Hugo Real", avance: 60, nota: 4.2, estado: "En curso" },
          { nombre: "Hermenéutica Básica", creditos: 2, profesor: "Ps. Lina Caro", avance: 45, nota: 4.0, estado: "En curso" },
          { nombre: "Evangelismo y Discipulado", creditos: 2, profesor: "Ps. Ana Vela", avance: 80, nota: 4.7, estado: "En curso" }
        ],
        3: [
          { nombre: "Antiguo Testamento", creditos: 3, profesor: "Ps. Hugo Real" },
          { nombre: "Nuevo Testamento", creditos: 3, profesor: "Ps. Jorge Ariza" },
          { nombre: "Liderazgo Cristiano", creditos: 2, profesor: "Ps. Camilo Restrepo" }
        ],
        4: [
          { nombre: "Teología Sistemática", creditos: 3, profesor: "Ps. Hugo Real" },
          { nombre: "Ministerio y Servicio", creditos: 3, profesor: "Ps. Marcela Gómez" },
          { nombre: "Proyecto de Grado", creditos: 4, profesor: "Comité Académico" }
        ]
      } },
    { id: "facter", nombre: "FACTER — Formación Teológica Integral", ico: "📖",
      desc: "Formación teológica avanzada. 4 semestres, modalidad virtual en Moodle.",
      semestres: 4, alumnos: 41, docentes: 7, modalidad: "Virtual (Moodle)", sso: true,
      malla: {
        1: [
          { nombre: "Introducción a la Teología", creditos: 3, profesor: "Dr. Pablo Mejía" },
          { nombre: "Griego I", creditos: 3, profesor: "Dra. Sofía Lema" },
          { nombre: "Historia de la Iglesia I", creditos: 2, profesor: "Ps. Hugo Real" }
        ],
        2: [ { nombre: "Griego II", creditos: 3, profesor: "Dra. Sofía Lema" },
              { nombre: "Teología Bíblica", creditos: 3, profesor: "Dr. Pablo Mejía" } ],
        3: [ { nombre: "Hebreo I", creditos: 3, profesor: "Dra. Sofía Lema" },
              { nombre: "Apologética", creditos: 2, profesor: "Dr. Pablo Mejía" } ],
        4: [ { nombre: "Ética Cristiana", creditos: 3, profesor: "Ps. Lina Caro" },
              { nombre: "Tesis Teológica", creditos: 4, profesor: "Comité Académico" } ]
      } }
  ];
  // Matrícula del alumno demo (Valentina) en IBLI, semestre 2
  const MATRICULA_DEMO = { instituto: "ibli", alumno: "p_valentina", semestre: 2, promedio: 4.35, creditos: "26/40" };

  /* ============================================================
     ROCAKIDS (niños + check-in)
     ============================================================ */
  const NINOS = [
    { id: "n_1", nombre: "Mateo Ríos", edad: 6, salon: "Exploradores (6–7)", acudiente: "Valentina Ríos", tel: "+57 310 555 1208", alergias: "Maní", estado: "fuera", codigo: "RK-4471" },
    { id: "n_2", nombre: "Sara Restrepo", edad: 4, salon: "Pequeños (3–5)", acudiente: "Camilo Restrepo", tel: "+57 300 555 0021", alergias: "Ninguna", estado: "dentro", codigo: "RK-3320", hora: "9:58 am" },
    { id: "n_3", nombre: "Tomás Pineda", edad: 8, salon: "Aventureros (8–10)", acudiente: "Andrea Pineda", tel: "+57 311 555 7788", alergias: "Lactosa", estado: "dentro", codigo: "RK-2218", hora: "9:45 am" },
    { id: "n_4", nombre: "Isabella Méndez", edad: 5, salon: "Pequeños (3–5)", acudiente: "Jorge Méndez", tel: "+57 320 555 4410", alergias: "Ninguna", estado: "fuera", codigo: "RK-9087" },
    { id: "n_5", nombre: "Daniel Tobón", edad: 7, salon: "Exploradores (6–7)", acudiente: "Laura Tobón", tel: "+57 311 555 9032", alergias: "Ninguna", estado: "fuera", codigo: "RK-6654" }
  ];

  /* ============================================================
     ROCAKIDS RED GLOBAL — asistencia en vivo por iglesia,
     análisis por edad/servicio y CRM de niños por ciudad.
     ============================================================ */
  const ROCAKIDS = {
    servicios: ["8:00 am", "10:00 am", "12:00 m"],
    edades: ["Bebés (1–2)", "Pequeños (3–5)", "Exploradores (6–7)", "Aventureros (8–10)"],
    sedes: [
      { id: "bogota", reportando: true, presentes: 112, registrados: 138,
        porEdad: [14, 34, 38, 26], porServicio: [34, 52, 26],
        ninos: [
          { nombre: "Mateo Ríos", edad: 6, salon: "Exploradores", servicio: "10:00 am", acudiente: "Valentina Ríos", tel: "+57 310 555 1208", estado: "dentro", codigo: "RK-4471", hora: "9:58 am", alergias: "Maní" },
          { nombre: "Sara Restrepo", edad: 4, salon: "Pequeños", servicio: "8:00 am", acudiente: "Camilo Restrepo", tel: "+57 300 555 0021", estado: "dentro", codigo: "RK-3320", hora: "7:52 am", alergias: "Ninguna" },
          { nombre: "Tomás Pineda", edad: 8, salon: "Aventureros", servicio: "10:00 am", acudiente: "Andrea Pineda", tel: "+57 311 555 7788", estado: "dentro", codigo: "RK-2218", hora: "9:45 am", alergias: "Lactosa" },
          { nombre: "Isabella Méndez", edad: 5, salon: "Pequeños", servicio: "12:00 m", acudiente: "Jorge Méndez", tel: "+57 320 555 4410", estado: "fuera", codigo: "RK-9087", hora: "—", alergias: "Ninguna" },
          { nombre: "Daniel Tobón", edad: 2, salon: "Bebés", servicio: "8:00 am", acudiente: "Laura Tobón", tel: "+57 311 555 9032", estado: "dentro", codigo: "RK-6654", hora: "7:58 am", alergias: "Ninguna" },
          { nombre: "Emma Vargas", edad: 7, salon: "Exploradores", servicio: "10:00 am", acudiente: "Camila Vargas", tel: "+57 310 555 3344", estado: "dentro", codigo: "RK-7781", hora: "9:50 am", alergias: "Ninguna" }
        ] },
      { id: "medellin", reportando: true, presentes: 74, registrados: 96,
        porEdad: [9, 22, 25, 18], porServicio: [22, 34, 18],
        ninos: [
          { nombre: "Salomé Ortiz", edad: 3, salon: "Pequeños", servicio: "9:00 am", acudiente: "Lucía Ortiz", tel: "+57 314 555 1212", estado: "dentro", codigo: "RK-MD12", hora: "8:55 am", alergias: "Ninguna" },
          { nombre: "Martín Gómez", edad: 9, salon: "Aventureros", servicio: "11:00 am", acudiente: "Pablo Gómez", tel: "+57 314 555 7744", estado: "dentro", codigo: "RK-MD34", hora: "10:50 am", alergias: "Gluten" },
          { nombre: "Antonia Ruiz", edad: 5, salon: "Pequeños", servicio: "9:00 am", acudiente: "Sara Ruiz", tel: "+57 314 555 9090", estado: "fuera", codigo: "RK-MD55", hora: "—", alergias: "Ninguna" }
        ] },
      { id: "cali", reportando: true, presentes: 51, registrados: 70,
        porEdad: [7, 16, 17, 11], porServicio: [16, 24, 11],
        ninos: [
          { nombre: "Luciana Mora", edad: 4, salon: "Pequeños", servicio: "9:30 am", acudiente: "Diana Mora", tel: "+57 315 555 3030", estado: "dentro", codigo: "RK-CL07", hora: "9:25 am", alergias: "Ninguna" },
          { nombre: "Samuel Díaz", edad: 8, salon: "Aventureros", servicio: "9:30 am", acudiente: "Iván Díaz", tel: "+57 315 555 6161", estado: "dentro", codigo: "RK-CL18", hora: "9:20 am", alergias: "Maní" }
        ] },
      { id: "miami", reportando: true, presentes: 33, registrados: 42,
        porEdad: [4, 11, 10, 8], porServicio: [12, 21, 0],
        ninos: [
          { nombre: "Olivia Pérez", edad: 6, salon: "Exploradores", servicio: "10:30 am", acudiente: "Karen Pérez", tel: "+1 305 555 2020", estado: "dentro", codigo: "RK-MI03", hora: "10:25 am", alergias: "Ninguna" }
        ] },
      { id: "madrid", reportando: false, presentes: 0, registrados: 28,
        porEdad: [0, 0, 0, 0], porServicio: [0, 0, 0], ninos: [] }
    ]
  };

  /* ============================================================
     DONACIONES (ERP / Tesorería)
     ============================================================ */
  const DONACIONES = [
    { id: "d1", fecha: "11 jun 2026", persona: "Valentina Ríos", tipo: "Diezmo", monto: 280000, pasarela: "Wompi", estado: "Conciliado", sede: "bogota" },
    { id: "d2", fecha: "11 jun 2026", persona: "Anónimo", tipo: "Ofrenda", monto: 50000, pasarela: "PayU", estado: "Conciliado", sede: "bogota" },
    { id: "d3", fecha: "10 jun 2026", persona: "Camilo Restrepo", tipo: "Diezmo", monto: 540000, pasarela: "Wompi", estado: "Conciliado", sede: "bogota" },
    { id: "d4", fecha: "10 jun 2026", persona: "Jorge Méndez", tipo: "Donación M.A.S", monto: 120000, pasarela: "Mercado Pago", estado: "Pendiente", sede: "bogota" },
    { id: "d5", fecha: "9 jun 2026", persona: "Andrea Pineda", tipo: "Diezmo", monto: 310000, pasarela: "Wompi", estado: "Conciliado", sede: "bogota" },
    { id: "d6", fecha: "9 jun 2026", persona: "Anónimo", tipo: "Ofrenda", monto: 75000, pasarela: "PayU", estado: "Conciliado", sede: "bogota" },
    { id: "d7", fecha: "8 jun 2026", persona: "Familia Cardona", tipo: "Diezmo", monto: 200000, pasarela: "Wompi", estado: "Pendiente", sede: "bogota" }
  ];
  const SERIE_DONACIONES = [
    { mes: "Ene", valor: 182 }, { mes: "Feb", valor: 168 }, { mes: "Mar", valor: 201 },
    { mes: "Abr", valor: 195 }, { mes: "May", valor: 224 }, { mes: "Jun", valor: 138 }
  ];

  /* ============================================================
     EQUIPOS ADMINISTRATIVOS (ERP + HCM) — 8 equipos
     ambito: 'corporativo' (solo sede madre) | 'local' (lo hereda la filial)
     ============================================================ */
  const EQUIPOS = [
    { id: "e_contable", nombre: "Contable", ico: "📊", ambito: "corporativo", lider: "Patricia Salas",
      desc: "Contabilidad corporativa integrada con Siigo. Conciliación, terceros y cierre.",
      kpis: [ { v: "Siigo", l: "ERP conectado" }, { v: "98%", l: "Conciliado mes" }, { v: "4", l: "Cierres pendientes" } ] },
    { id: "e_tesoreria", nombre: "Tesorería", ico: "💼", ambito: "local", lider: "Jorge Méndez",
      desc: "Flujo de caja, presupuestos por sede/ministerio y aprobación de gastos.",
      kpis: [ { v: "$1.575M", l: "Recaudo mes" }, { v: "$1.21M", l: "Presupuesto ejecutado" }, { v: "6", l: "Gastos por aprobar" } ] },
    { id: "e_legal", nombre: "Legal", ico: "⚖️", ambito: "corporativo", lider: "Dr. Andrés Cuéllar",
      desc: "Repositorio documental, vigencias, PQRS y política de datos (Ley 1581).",
      kpis: [ { v: "312", l: "Documentos" }, { v: "3", l: "Vigencias por vencer" }, { v: "9", l: "PQRS abiertas" } ] },
    { id: "e_hr", nombre: "Talento Humano", ico: "👔", ambito: "local", lider: "Diana Forero",
      desc: "Expedientes, contratación, onboarding, vacaciones y organigrama (HCM).",
      kpis: [ { v: "148", l: "Empleados" }, { v: "5", l: "En onboarding" }, { v: "12", l: "Vacaciones activas" } ] },
    { id: "e_seguridad", nombre: "Seguridad", ico: "🛡️", ambito: "local", lider: "Capitán Rojas",
      desc: "Protocolos de domingo, control de acceso RocaKids y gestión de incidentes.",
      kpis: [ { v: "0", l: "Incidentes hoy" }, { v: "100%", l: "Checklist domingo" }, { v: "18", l: "Voluntarios turno" } ] },
    { id: "e_tecnologia", nombre: "Tecnología", ico: "💻", ambito: "corporativo", lider: "Iván Cardona",
      desc: "Usuarios, roles, integraciones, monitoreo y soporte interno (tickets).",
      kpis: [ { v: "2.480", l: "Usuarios activos" }, { v: "7", l: "Integraciones" }, { v: "4", l: "Tickets abiertos" } ] },
    { id: "e_cultura", nombre: "Cultura", ico: "🌟", ambito: "local", lider: "Sara Bello",
      desc: "Clima, reconocimiento, formación interna y comunicación al equipo.",
      kpis: [ { v: "4.4/5", l: "Clima equipo" }, { v: "23", l: "Reconocimientos mes" }, { v: "3", l: "Capacitaciones" } ] },
    { id: "e_comunicaciones", nombre: "Comunicaciones", ico: "📣", ambito: "local", lider: "Lucía Franco",
      desc: "Calendario de contenido, banco creativo y solicitudes de diseño (intake → aprobación).",
      kpis: [ { v: "14", l: "Piezas en curso" }, { v: "6", l: "Solicitudes nuevas" }, { v: "21", l: "Publicadas mes" } ] }
  ];

  /* ============================================================
     AUTOMATIZACIONES (configurables por sede)
     ============================================================ */
  const AUTOMATIZACIONES = [
    { id: "a1", nombre: "Secuencia de bienvenida al nuevo", desc: "Correo + WhatsApp al registrarse", activo: true },
    { id: "a2", nombre: "Asignación automática a seguimiento", desc: "Nuevo → responsable de su sede", activo: true },
    { id: "a3", nombre: "Recordatorios de curso", desc: "Confirmación, recordatorio y certificado", activo: true },
    { id: "a4", nombre: "Alertas de personas en riesgo", desc: "IA detecta inasistencia o estancamiento", activo: true },
    { id: "a5", nombre: "Agradecimiento por donación", desc: "Comprobante + mensaje de gratitud", activo: true },
    { id: "a6", nombre: "Reporte semanal al pastor", desc: "Resumen de sede cada lunes 7am", activo: false },
    { id: "a7", nombre: "Recordatorio de turno (operativos)", desc: "Aviso a servidores 2 días antes", activo: false }
  ];

  /* ============================================================
     RED GLOBAL — 36 SEDES (backbone de la analítica del
     Pastor Director General). Métricas: tamaño, asistencia,
     RocaKids, grupos pequeños, ministerios, diezmo y cuidado.
     ============================================================ */
  const RED = (function () {
    // [id, nombre, ciudad, país, personas, esMadre?]
    const base = [
      ["bogota", "Bogotá Chicó", "Bogotá", "Colombia", 1940, true],
      ["sabana", "Sabana Norte", "Bogotá", "Colombia", 880],
      ["medellin", "Medellín", "Medellín", "Colombia", 1120],
      ["llanogrande", "Llanogrande", "Rionegro", "Colombia", 280],
      ["cali", "Cali", "Cali", "Colombia", 860],
      ["popayan", "Popayán", "Popayán", "Colombia", 220],
      ["pasto", "Pasto", "Pasto", "Colombia", 250],
      ["barranquilla", "Barranquilla", "Barranquilla", "Colombia", 640],
      ["cartagena", "Cartagena", "Cartagena", "Colombia", 520],
      ["santamarta", "Santa Marta", "Santa Marta", "Colombia", 300],
      ["valledupar", "Valledupar", "Valledupar", "Colombia", 260],
      ["monteria", "Montería", "Montería", "Colombia", 240],
      ["sincelejo", "Sincelejo", "Sincelejo", "Colombia", 190],
      ["bucaramanga", "Bucaramanga", "Bucaramanga", "Colombia", 470],
      ["cucuta", "Cúcuta", "Cúcuta", "Colombia", 360],
      ["pereira", "Pereira", "Pereira", "Colombia", 410],
      ["manizales", "Manizales", "Manizales", "Colombia", 330],
      ["armenia", "Armenia", "Armenia", "Colombia", 300],
      ["ibague", "Ibagué", "Ibagué", "Colombia", 350],
      ["neiva", "Neiva", "Neiva", "Colombia", 280],
      ["florencia", "Florencia", "Florencia", "Colombia", 140],
      ["garzon", "Garzón", "Garzón", "Colombia", 120],
      ["girardot", "Girardot", "Girardot", "Colombia", 160],
      ["villavicencio", "Villavicencio", "Villavicencio", "Colombia", 320],
      ["yopal", "Yopal", "Yopal", "Colombia", 170],
      ["tunja", "Tunja", "Tunja", "Colombia", 200],
      ["sogamoso", "Sogamoso", "Sogamoso", "Colombia", 150],
      ["miami", "Miami", "Miami", "Estados Unidos", 540],
      ["orlando", "Orlando", "Orlando", "Estados Unidos", 380],
      ["nyc", "Nueva York", "Nueva York", "Estados Unidos", 420],
      ["boca", "Boca Ratón", "Boca Ratón", "Estados Unidos", 260],
      ["madrid", "Madrid", "Madrid", "España", 410],
      ["barcelona", "Barcelona", "Barcelona", "España", 330],
      ["toledo", "Toledo", "Toledo", "España", 140],
      ["panama", "Ciudad de Panamá", "Panamá", "Panamá", 300],
      ["ottawa", "Ottawa", "Ottawa", "Canadá", 160]
    ];
    const pastores = {
      bogota: "Camilo Restrepo", sabana: "Ricardo Peña", medellin: "Andrés Lozano",
      cali: "Felipe Acosta", barranquilla: "Óscar Tovar", cartagena: "Natalia Cruz",
      miami: "Daniel Forero", madrid: "Esteban Ríos", orlando: "Karen Pérez",
      nyc: "Pablo Mejía", panama: "Lucía Franco", ottawa: "Hernán Ortiz"
    };
    return base.map((b, i) => {
      const [id, nombre, ciudad, pais, personas, madre] = b;
      const asistencia = Math.round(personas * (0.56 + (i % 7) * 0.02));
      const rockids = Math.round(personas * (0.10 + (i % 5) * 0.012));
      const gpActivos = Math.round(personas / 22) + (i % 4);
      const ministerios = madre ? 16 : 7 + (i % 8);
      const diezmoMes = Math.round(personas * (0.092 + (i % 6) * 0.008)); // millones COP
      const nuevos = Math.round(personas * (0.012 + (i % 5) * 0.004));
      const cuidado = madre ? 96 : 48 + ((i * 17) % 49);
      return {
        id, nombre, ciudad, pais, personas, esMadre: !!madre,
        asistencia, rockids, gpActivos, ministerios, diezmoMes, nuevos, cuidado,
        pastor: pastores[id] || "(por asignar)"
      };
    });
  })();
  const PAISES = [...new Set(RED.map(s => s.pais))];

  /* ============================================================
     CENTRO DE APROBACIONES — lo que escala al Pastor Director
     General desde todos los equipos. Flujo hasta el final.
     ============================================================ */
  const APROBACIONES = [
    { id: "ap1", equipo: "e_tesoreria", area: "Tesorería", ico: "💼", sede: "bogota", prioridad: "alta",
      titulo: "Renovación de consola de sonido (VISA)", detalle: "Compra de consola digital para reemplazo en sede madre. Cotización de 3 proveedores adjunta.",
      solicitante: "Jorge Méndez", fecha: "10 jun 2026", monto: 18500000, estado: "pendiente" },
    { id: "ap2", equipo: "e_hr", area: "Talento Humano", ico: "👔", sede: "medellin", prioridad: "media",
      titulo: "Contratación · Coordinador de RocaKids Medellín", detalle: "Vacante aprobada por presupuesto. Candidata seleccionada tras 3 entrevistas. Inicio sugerido: 1 jul.",
      solicitante: "Diana Forero", fecha: "9 jun 2026", monto: 3200000, estado: "pendiente" },
    { id: "ap3", equipo: "e_legal", area: "Legal", ico: "⚖️", sede: "cali", prioridad: "alta",
      titulo: "Contrato de arriendo · nueva sede Cali sur", detalle: "Contrato a 3 años para sede satélite. Requiere firma del representante legal.",
      solicitante: "Dr. Andrés Cuéllar", fecha: "8 jun 2026", monto: 0, estado: "pendiente" },
    { id: "ap4", equipo: "e_tecnologia", area: "Tecnología", ico: "💻", sede: "global", prioridad: "media",
      titulo: "Requerimiento · App de check-in RocaKids multi-sede", detalle: "Desarrollo del módulo de check-in para 6 sedes piloto. Estimación: 6 semanas.",
      solicitante: "Iván Cardona", fecha: "7 jun 2026", monto: 9800000, estado: "pendiente" },
    { id: "ap5", equipo: "e_comunicaciones", area: "Comunicaciones", ico: "📣", sede: "global", prioridad: "media",
      titulo: "Campaña nacional · Conferencia Crece 2026", detalle: "Plan de campaña multi-sede (redes, web, video). Pieza maestra para aprobación de marca.",
      solicitante: "Lucía Franco", fecha: "7 jun 2026", monto: 6400000, estado: "pendiente" },
    { id: "ap6", equipo: "e_contable", area: "Contable", ico: "📊", sede: "global", prioridad: "alta",
      titulo: "Cierre contable consolidado · Mayo 2026", detalle: "Estados financieros consolidados de la red. Requiere aprobación de Dirección General antes de junta.",
      solicitante: "Patricia Salas", fecha: "6 jun 2026", monto: 0, estado: "pendiente" },
    { id: "ap7", equipo: "e_hr", area: "Talento Humano", ico: "👔", sede: "bogota", prioridad: "baja",
      titulo: "Ajuste salarial · equipo de Alabanza", detalle: "Revisión anual de 4 colaboradores del equipo musical. Dentro del marco presupuestal.",
      solicitante: "Diana Forero", fecha: "5 jun 2026", monto: 2100000, estado: "pendiente" },
    { id: "ap8", equipo: "e_tesoreria", area: "Tesorería", ico: "💼", sede: "barranquilla", prioridad: "media",
      titulo: "Adecuación salón RocaKids Barranquilla", detalle: "Obra menor de seguridad infantil (pisos, puertas, señalización).",
      solicitante: "Jorge Méndez", fecha: "4 jun 2026", monto: 5400000, estado: "pendiente" },
    { id: "ap9", equipo: "e_legal", area: "Legal", ico: "⚖️", sede: "global", prioridad: "alta",
      titulo: "Actualización política de tratamiento de datos", detalle: "Ajuste a Ley 1581 + GDPR para sedes internacionales. Revisión jurídica completa.",
      solicitante: "Dr. Andrés Cuéllar", fecha: "3 jun 2026", monto: 0, estado: "pendiente" },
    { id: "ap10", equipo: "e_comunicaciones", area: "Comunicaciones", ico: "📣", sede: "miami", prioridad: "baja",
      titulo: "Rebranding boletín dominical Miami", detalle: "Nueva plantilla bilingüe del boletín. Aprobación de línea gráfica.",
      solicitante: "Lucía Franco", fecha: "2 jun 2026", monto: 1200000, estado: "pendiente" }
  ];

  /* ============================================================
     TALENTO HUMANO (HCM) — nómina de empleados
     ============================================================ */
  const EMPLEADOS = [
    { id: "em1", nombre: "Patricia Salas", cargo: "Directora Contable", area: "Contable", sede: "bogota", tipo: "Tiempo completo", ingreso: "2019", estado: "Activo" },
    { id: "em2", nombre: "Jorge Méndez", cargo: "Jefe de Tesorería", area: "Tesorería", sede: "bogota", tipo: "Tiempo completo", ingreso: "2020", estado: "Activo" },
    { id: "em3", nombre: "Dr. Andrés Cuéllar", cargo: "Director Jurídico", area: "Legal", sede: "bogota", tipo: "Tiempo completo", ingreso: "2018", estado: "Activo" },
    { id: "em4", nombre: "Diana Forero", cargo: "Directora de Talento Humano", area: "Talento Humano", sede: "bogota", tipo: "Tiempo completo", ingreso: "2021", estado: "Activo" },
    { id: "em5", nombre: "Iván Cardona", cargo: "Líder de Tecnología", area: "Tecnología", sede: "bogota", tipo: "Tiempo completo", ingreso: "2022", estado: "Activo" },
    { id: "em6", nombre: "Lucía Franco", cargo: "Directora de Comunicaciones", area: "Comunicaciones", sede: "bogota", tipo: "Tiempo completo", ingreso: "2021", estado: "Activo" },
    { id: "em7", nombre: "Sara Bello", cargo: "Coordinadora de Cultura", area: "Cultura", sede: "bogota", tipo: "Tiempo completo", ingreso: "2023", estado: "Activo" },
    { id: "em8", nombre: "Capitán Rojas", cargo: "Jefe de Seguridad", area: "Seguridad", sede: "bogota", tipo: "Tiempo completo", ingreso: "2020", estado: "Activo" },
    { id: "em9", nombre: "Marcela Gómez", cargo: "Directora RocaKids", area: "Pastoral", sede: "bogota", tipo: "Tiempo completo", ingreso: "2019", estado: "Activo" },
    { id: "em10", nombre: "Tomás Vela", cargo: "Técnico de Sonido", area: "Tecnología", sede: "medellin", tipo: "Medio tiempo", ingreso: "2024", estado: "Onboarding" },
    { id: "em11", nombre: "Sofía Lara", cargo: "Maestra RocaKids", area: "Pastoral", sede: "cali", tipo: "Medio tiempo", ingreso: "2026", estado: "Onboarding" },
    { id: "em12", nombre: "David Quintero", cargo: "Director de Alabanza", area: "Pastoral", sede: "bogota", tipo: "Tiempo completo", ingreso: "2017", estado: "Activo" }
  ];

  /* ============================================================
     LEGAL — procesos activos
     ============================================================ */
  const LEGAL_PROCESOS = [
    { id: "lg1", titulo: "Renovación contrato arriendo sede Chicó", tipo: "Contrato", sede: "bogota", estado: "En firma", riesgo: "medio", actualizado: "10 jun 2026", responsable: "Dr. Andrés Cuéllar" },
    { id: "lg2", titulo: "Constitución sede Cali Sur", tipo: "Constitución", sede: "cali", estado: "En trámite", riesgo: "bajo", actualizado: "9 jun 2026", responsable: "Dr. Andrés Cuéllar" },
    { id: "lg3", titulo: "Convenio Unidad Educativa IBLI–FACTER", tipo: "Convenio", sede: "global", estado: "Por renovar", riesgo: "alto", actualizado: "5 jun 2026", responsable: "Dra. Liliana Vega" },
    { id: "lg4", titulo: "Actualización política de datos (Ley 1581 + GDPR)", tipo: "Cumplimiento", sede: "global", estado: "Revisión jurídica", riesgo: "alto", actualizado: "3 jun 2026", responsable: "Dr. Andrés Cuéllar" },
    { id: "lg5", titulo: "Registro de marca 'Casa Roca' en España", tipo: "Propiedad intelectual", sede: "madrid", estado: "Aprobado", riesgo: "bajo", actualizado: "28 may 2026", responsable: "Bufete Asociado" },
    { id: "lg6", titulo: "Defensa laboral · caso ex-colaborador", tipo: "Litigio", sede: "medellin", estado: "Audiencia 22 jul", riesgo: "medio", actualizado: "1 jun 2026", responsable: "Dr. Andrés Cuéllar" }
  ];

  /* ============================================================
     TECNOLOGÍA — requerimientos por sede
     ============================================================ */
  const TECH_REQ = [
    { id: "tc1", titulo: "Check-in RocaKids multi-sede", sede: "global", estado: "En desarrollo", avance: 55, prioridad: "alta", equipo: "Producto" },
    { id: "tc2", titulo: "Integración Siigo ↔ pasarelas (Cali)", sede: "cali", estado: "QA", avance: 80, prioridad: "alta", equipo: "Integraciones" },
    { id: "tc3", titulo: "SSO Moodle para Instituto", sede: "global", estado: "Producción", avance: 100, prioridad: "media", equipo: "Plataforma" },
    { id: "tc4", titulo: "Portal de voluntarios (migración 99-o)", sede: "bogota", estado: "Diseño", avance: 25, prioridad: "media", equipo: "Producto" },
    { id: "tc5", titulo: "Tablero de asistencia en vivo", sede: "medellin", estado: "Backlog", avance: 0, prioridad: "baja", equipo: "Datos" },
    { id: "tc6", titulo: "App PWA instalable para líderes", sede: "global", estado: "En desarrollo", avance: 40, prioridad: "alta", equipo: "Producto" }
  ];

  /* ============================================================
     COMUNICACIONES — campañas en curso
     ============================================================ */
  const COMMS_CAMPANAS = [
    { id: "cm1", nombre: "Conferencia Crece 2026", canal: "Multi-canal", sede: "global", estado: "En aprobación", alcance: "Toda la red", piezas: 12, responsable: "Lucía Franco" },
    { id: "cm2", nombre: "Bautizos de Julio", canal: "Redes + Web", sede: "bogota", estado: "En diseño", alcance: "Bogotá + Sabana", piezas: 6, responsable: "Equipo Creativo" },
    { id: "cm3", nombre: "Campaña Generosidad (Diezmos)", canal: "Email + Púlpito", sede: "global", estado: "Publicada", alcance: "Toda la red", piezas: 8, responsable: "Lucía Franco" },
    { id: "cm4", nombre: "Mujer Integral · Encuentro", canal: "Redes", sede: "medellin", estado: "Programada", alcance: "Medellín", piezas: 4, responsable: "Natalia Cruz" },
    { id: "cm5", nombre: "Boletín bilingüe Miami", canal: "Email", sede: "miami", estado: "En aprobación", alcance: "Sedes EE.UU.", piezas: 3, responsable: "Karen Pérez" }
  ];

  /* ============================================================
     INSTITUTO (IBLI / FACTER) — inscritos por ciudad
     (tomador de decisión: dónde crece la formación)
     ============================================================ */
  const INSTITUTO_CIUDAD = [
    { ciudad: "Bogotá", pais: "Colombia", ibli: 86, facter: 41, crecimiento: 12 },
    { ciudad: "Medellín", pais: "Colombia", ibli: 54, facter: 22, crecimiento: 18 },
    { ciudad: "Cali", pais: "Colombia", ibli: 38, facter: 14, crecimiento: 9 },
    { ciudad: "Barranquilla", pais: "Colombia", ibli: 29, facter: 9, crecimiento: 22 },
    { ciudad: "Bucaramanga", pais: "Colombia", ibli: 21, facter: 6, crecimiento: 7 },
    { ciudad: "Pereira", pais: "Colombia", ibli: 18, facter: 5, crecimiento: 15 },
    { ciudad: "Miami", pais: "Estados Unidos", ibli: 24, facter: 11, crecimiento: 31 },
    { ciudad: "Madrid", pais: "España", ibli: 19, facter: 8, crecimiento: 26 },
    { ciudad: "Nueva York", pais: "Estados Unidos", ibli: 14, facter: 4, crecimiento: 19 },
    { ciudad: "Ciudad de Panamá", pais: "Panamá", ibli: 12, facter: 3, crecimiento: 28 }
  ];

  /* ============================================================
     FINANZAS — panorama consolidado de la red (cifras en millones COP)
     Proyectos, ingresos, gastos, deudas y series mensuales.
     ============================================================ */
  const FIN = {
    resumen: { ingresosMes: 2240, gastosMes: 1980, caja: 4120, deudaTotal: 3850, reservas: 1560 },
    serie: [
      { mes: "Ene", ing: 1980, gas: 1820 }, { mes: "Feb", ing: 1860, gas: 1790 },
      { mes: "Mar", ing: 2110, gas: 1900 }, { mes: "Abr", ing: 2050, gas: 1940 },
      { mes: "May", ing: 2320, gas: 2010 }, { mes: "Jun", ing: 2240, gas: 1980 }
    ],
    ingresos: [
      { cat: "Diezmos", val: 1572, ico: "🙏" }, { cat: "Ofrendas", val: 320, ico: "💛" },
      { cat: "Donaciones M.A.S", val: 140, ico: "❤️" }, { cat: "Matrículas Instituto", val: 96, ico: "🎓" },
      { cat: "Eventos y conferencias", val: 72, ico: "🎤" }, { cat: "Otros ingresos", val: 40, ico: "📦" }
    ],
    gastos: [
      { cat: "Nómina y honorarios", val: 940, ico: "👔" }, { cat: "Arriendos y sedes", val: 360, ico: "🏛️" },
      { cat: "Servicios y operación", val: 240, ico: "⚙️" }, { cat: "Ministerios y programas", val: 210, ico: "🧩" },
      { cat: "Misiones y ayuda social", val: 130, ico: "🌍" }, { cat: "Tecnología y plataformas", val: 60, ico: "💻" },
      { cat: "Comunicaciones", val: 40, ico: "📣" }
    ],
    proyectos: [
      { id: "pr1", nombre: "Nueva sede Cali Sur", sede: "cali", presupuesto: 480, ejecutado: 145, estado: "En curso", responsable: "Tesorería + Legal" },
      { id: "pr2", nombre: "Remodelación auditorio Bogotá", sede: "bogota", presupuesto: 320, ejecutado: 290, estado: "En curso", responsable: "Infraestructura" },
      { id: "pr3", nombre: "Expansión RocaKids nacional", sede: "global", presupuesto: 260, ejecutado: 96, estado: "Planeación", responsable: "Pastoral + TH" },
      { id: "pr4", nombre: "Plataforma digital (App + Web)", sede: "global", presupuesto: 180, ejecutado: 110, estado: "En curso", responsable: "Tecnología" },
      { id: "pr5", nombre: "Campus Instituto Medellín", sede: "medellin", presupuesto: 220, ejecutado: 12, estado: "Planeación", responsable: "IBLI–FACTER" },
      { id: "pr6", nombre: "Misiones internacionales 2026", sede: "global", presupuesto: 150, ejecutado: 88, estado: "En curso", responsable: "Misiones" }
    ],
    deudas: [
      { id: "de1", concepto: "Crédito construcción sede madre", acreedor: "Bancolombia", saldo: 2100, cuotaMes: 38, vence: "2029", estado: "Al día" },
      { id: "de2", concepto: "Anticipo arriendos sedes internacionales", acreedor: "Varios", saldo: 1235, cuotaMes: 22, vence: "2028", estado: "Al día" },
      { id: "de3", concepto: "Leasing tecnología y audiovisuales", acreedor: "Davivienda", saldo: 420, cuotaMes: 14, vence: "2027", estado: "Al día" },
      { id: "de4", concepto: "Crédito vehículo de logística", acreedor: "BBVA", saldo: 95, cuotaMes: 4, vence: "2026", estado: "Por refinanciar" }
    ]
  };

  /* ============================================================
     Helpers
     ============================================================ */
  function persona(id) { return PERSONAS.find(p => p.id === id); }
  function grupo(id) { return GRUPOS.find(g => g.id === id); }
  function ministerio(id) { return MINISTERIOS.find(m => m.id === id); }
  function equipo(id) { return EQUIPOS.find(e => e.id === id); }
  function instituto(id) { return INSTITUTOS.find(i => i.id === id); }
  function nombre(p) { return p ? `${p.nombres} ${p.apellidos}` : ""; }
  function sede(id) { return SEDES.find(s => s.id === id) || RED.find(s => s.id === id); }
  function sedeRed(id) { return RED.find(s => s.id === id); }
  function aprobacion(id) { return APROBACIONES.find(a => a.id === id); }
  function totalesRed() {
    const t = RED.reduce((a, s) => ({
      personas: a.personas + s.personas, asistencia: a.asistencia + s.asistencia,
      rockids: a.rockids + s.rockids, gpActivos: a.gpActivos + s.gpActivos,
      ministerios: a.ministerios + s.ministerios, diezmoMes: a.diezmoMes + s.diezmoMes,
      nuevos: a.nuevos + s.nuevos
    }), { personas: 0, asistencia: 0, rockids: 0, gpActivos: 0, ministerios: 0, diezmoMes: 0, nuevos: 0 });
    t.sedes = RED.length; t.paises = PAISES.length;
    t.cuidadoProm = Math.round(RED.reduce((a, s) => a + s.cuidado, 0) / RED.length);
    return t;
  }

  const ETAPAS = {
    conoce:  { id: "conoce",  nombre: "Conoce",  ico: "👋", clase: "conoce",  desc: "Asiste y participa" },
    conecta: { id: "conecta", nombre: "Conéctate", ico: "🔗", clase: "conecta", desc: "Pertenece a un grupo, ADN, bautizo" },
    crece:   { id: "crece",   nombre: "Crece",   ico: "🌱", clase: "crece",   desc: "Cursos e instituto" },
    sirve:   { id: "sirve",   nombre: "Sirve",   ico: "🙌", clase: "sirve",   desc: "Sirve como voluntario o líder" }
  };
  const ORDEN_ETAPAS = ["conoce", "conecta", "crece", "sirve"];

  return {
    ROLES, SEDES, MINISTERIOS, GRUPOS, PERSONAS, MIEMBROS_GRUPO, CONGREGANTES,
    CURSOS, INSTITUTOS, MATRICULA_DEMO, NINOS, ROCAKIDS, DONACIONES, SERIE_DONACIONES,
    EQUIPOS, AUTOMATIZACIONES, ETAPAS, ORDEN_ETAPAS,
    RED, PAISES, APROBACIONES, EMPLEADOS, LEGAL_PROCESOS, TECH_REQ, COMMS_CAMPANAS, INSTITUTO_CIUDAD, FIN,
    persona, grupo, ministerio, equipo, instituto, nombre, sede,
    sedeRed, aprobacion, totalesRed
  };
})();
