/* ============================================================
   CASA ROCA AI SYSTEM — DATOS DEL FUNNEL PÚBLICO (Fase 0)
   "Experiencia del asistente" — la cara pública de las 4C:
   Conoce · Conéctate · Crece · Sirve.
   Reutiliza window.DB (ministerios, cursos, institutos) y añade
   lo propio del recorrido público. Se expone como window.LANDING.
   Sin backend: todo vive en memoria.
   ============================================================ */
window.LANDING = (function () {
  const DB = window.DB;

  /* ------------------------------------------------------------
     CIUDADES con experiencia pública activa (selector global).
     El contenido de "Conoce" (prédicas + horarios) es por ciudad.
     ------------------------------------------------------------ */
  const CIUDADES = [
    { id: "bogota",   nombre: "Bogotá · Chicó",  pais: "Colombia",       esMadre: true,
      direccion: "Calle 95 # 13-55, Chicó", servicios: ["8:00 am", "10:00 am", "12:00 m", "5:00 pm"] },
    { id: "medellin", nombre: "Medellín",        pais: "Colombia",
      direccion: "Cra 43A # 7-50, El Poblado", servicios: ["9:00 am", "11:00 am", "6:00 pm"] },
    { id: "cali",     nombre: "Cali",            pais: "Colombia",
      direccion: "Av. 6N # 28-10, Granada", servicios: ["9:30 am", "11:30 am", "5:00 pm"] },
    { id: "miami",    nombre: "Miami",           pais: "Estados Unidos",
      direccion: "8400 NW 25th St, Doral, FL", servicios: ["10:30 am", "12:30 pm"] },
    { id: "madrid",   nombre: "Madrid",          pais: "España",
      direccion: "Calle de Alcalá 120", servicios: ["11:00 am", "1:00 pm"] }
  ];

  /* ------------------------------------------------------------
     PRÉDICAS subidas, etiquetadas por ciudad.
     "global" = serie nacional que aparece en todas las ciudades.
     ------------------------------------------------------------ */
  const PREDICAS = [
    { id: "pr_01", titulo: "Una casa cálida y segura", predicador: "Ps. Darío Silva", ciudad: "global",
      serie: "ADN de la Casa", fecha: "8 jun 2026", duracion: "42 min", vistas: "12.4k", tema: "Identidad" },
    { id: "pr_02", titulo: "El poder de pertenecer", predicador: "Ps. Camilo Restrepo", ciudad: "bogota",
      serie: "Conéctate", fecha: "1 jun 2026", duracion: "38 min", vistas: "5.1k", tema: "Comunidad" },
    { id: "pr_03", titulo: "Fe que sostiene en la tormenta", predicador: "Ps. Darío Silva", ciudad: "global",
      serie: "Roca firme", fecha: "25 may 2026", duracion: "45 min", vistas: "18.9k", tema: "Fe" },
    { id: "pr_04", titulo: "Diseñados para servir", predicador: "Ps. Andrés Lozano", ciudad: "bogota",
      serie: "Sirve", fecha: "18 may 2026", duracion: "36 min", vistas: "3.7k", tema: "Propósito" },
    { id: "pr_05", titulo: "La generosidad libera", predicador: "Ps. Camilo Restrepo", ciudad: "bogota",
      serie: "Mayordomía", fecha: "11 may 2026", duracion: "40 min", vistas: "4.2k", tema: "Generosidad" },
    { id: "pr_06", titulo: "Raíces profundas", predicador: "Ps. Felipe Acosta", ciudad: "medellin",
      serie: "Crece", fecha: "1 jun 2026", duracion: "39 min", vistas: "2.9k", tema: "Madurez" },
    { id: "pr_07", titulo: "Un nuevo comienzo", predicador: "Ps. Natalia Cruz", ciudad: "medellin",
      serie: "Conoce", fecha: "25 may 2026", duracion: "33 min", vistas: "2.1k", tema: "Nuevos" },
    { id: "pr_08", titulo: "Familias que permanecen", predicador: "Ps. Óscar Tovar", ciudad: "cali",
      serie: "Casa2", fecha: "1 jun 2026", duracion: "41 min", vistas: "1.8k", tema: "Familia" },
    { id: "pr_09", titulo: "Jóvenes con propósito", predicador: "Ps. Mateo Cano", ciudad: "cali",
      serie: "tMt", fecha: "24 may 2026", duracion: "35 min", vistas: "2.4k", tema: "Juventud" },
    { id: "pr_10", titulo: "Hope that holds", predicador: "Ps. Daniel Forero", ciudad: "miami",
      serie: "Roca firme", fecha: "1 jun 2026", duracion: "37 min", vistas: "1.5k", tema: "Esperanza" },
    { id: "pr_11", titulo: "Llamados a más", predicador: "Ps. Esteban Ríos", ciudad: "madrid",
      serie: "Sirve", fecha: "1 jun 2026", duracion: "34 min", vistas: "0.9k", tema: "Vocación" },
    { id: "pr_12", titulo: "La mesa de la gracia", predicador: "Ps. Darío Silva", ciudad: "global",
      serie: "ADN de la Casa", fecha: "4 may 2026", duracion: "43 min", vistas: "9.6k", tema: "Gracia" }
  ];

  /* ------------------------------------------------------------
     CONOCE — Ministerios congregacionales con horario del mes,
     director y canal de chat directo (WhatsApp).
     Orden exacto pedido: RocaKids, tMt, J+25, Josués, Hombres,
     Mujeres, Casados, Años Dorados.
     'min' enlaza al catálogo real en DB.MINISTERIOS.
     ------------------------------------------------------------ */
  const CONGREGACIONALES = [
    { min: "m_rocakids", color: "azul",
      publico: "Niños de 1 a 10 años",
      horarioMes: "Cada domingo · 9:00 am y 11:00 am · Edificio RocaKids",
      encuentro: "Festival RocaKids — sáb 28 jun, 3:00 pm",
      director: "Marcela Gómez", wa: "573105550101" },
    { min: "m_tmt", color: "mostaza",
      publico: "Jóvenes de 11 a 25 años",
      horarioMes: "Viernes · 6:30 pm · Auditorio juvenil (Pulso/Eco/Legado)",
      encuentro: "Noche tMt — vie 20 jun, 6:30 pm",
      director: "Felipe Acosta", wa: "573105550102" },
    { min: "m_j25", color: "verde",
      publico: "Jóvenes adultos de 26 a 35 años",
      horarioMes: "Jueves · 7:00 pm · Salón Norte + grupos de afinidad",
      encuentro: "J+25 Connect — jue 19 jun, 7:00 pm",
      director: "Andrés Lozano", wa: "573105550103" },
    { min: "m_josues", color: "azul",
      publico: "Solteros adultos de 35 a 55 años",
      horarioMes: "2º y 4º sábado · 4:00 pm · Salón 3",
      encuentro: "Encuentro Josués — sáb 21 jun, 4:00 pm",
      director: "Ricardo Peña", wa: "573105550104" },
    { min: "m_hombres", color: "azul",
      publico: "Hombres · carácter e integridad",
      horarioMes: "Sábados · 7:00 am · Desayuno + Palabra",
      encuentro: "Hombres de Bien — sáb 14 jun, 7:00 am",
      director: "Óscar Tovar", wa: "573105550105" },
    { min: "m_mujer", color: "mostaza",
      publico: "Mujeres · toda temporada de vida",
      horarioMes: "Miércoles · 9:00 am y 7:00 pm · Salón Central",
      encuentro: "Mujer Integral — mié 18 jun, 7:00 pm",
      director: "Natalia Cruz", wa: "573105550106" },
    { min: "m_casa2", color: "verde",
      publico: "Parejas y matrimonios",
      horarioMes: "Sábados · 5:00 pm · Salones por etapa (Sin hijos/Con hijos/Jr/Sr)",
      encuentro: "Cita Casa2 — sáb 28 jun, 5:00 pm",
      director: "Camilo y Ana Restrepo", wa: "573105550107" },
    { min: "m_dorados", color: "mostaza",
      publico: "Adultos mayores · honra y propósito",
      horarioMes: "Martes · 10:00 am · Salón Dorado",
      encuentro: "Tarde Dorada — mar 17 jun, 10:00 am",
      director: "Esperanza Díaz", wa: "573105550108" }
  ];

  /* ------------------------------------------------------------
     CONÉCTATE — Afinidades (grupos pequeños). Cada líder, aprobado
     por su director de ministerio, abre un grupo con: nombre,
     qué hacen, cupo permitido, horario, lugar y ministerio.
     Un ministerio tiene MUCHOS líderes con grupos distintos.
     ------------------------------------------------------------ */
  const AFINIDADES = [
    /* J+25 */
    { id: "af_j25_cafe", min: "m_j25", nombre: "Café & Palabra",
      queHacen: "Estudio bíblico relajado con café para profesionales que quieren crecer entre semana.",
      cupo: 16, miembros: 0, dia: "Jueves", hora: "7:00 pm", lugar: "Café del Norte · Chicó", lider: "Daniel Garzón", modalidad: "Presencial" },
    { id: "af_j25_virtual", min: "m_j25", nombre: "Conexión Virtual",
      queHacen: "Grupo en línea para quienes recién llegan o tienen agendas apretadas. Conversación y oración.",
      cupo: 20, miembros: 9, dia: "Martes", hora: "8:00 pm", lugar: "En línea (Meet)", lider: "Diego Rivas", modalidad: "Virtual" },
    { id: "af_j25_run", min: "m_j25", nombre: "Run & Pray",
      queHacen: "Salimos a trotar el sábado y cerramos con un devocional. Vida sana + comunidad.",
      cupo: 16, miembros: 7, dia: "Sábado", hora: "6:30 am", lugar: "Parque El Virrey", lider: "Laura Méndez", modalidad: "Presencial" },
    { id: "af_j25_finanzas", min: "m_j25", nombre: "Finanzas con Propósito",
      queHacen: "Mayordomía práctica: presupuesto, deudas e inversión con principios bíblicos.",
      cupo: 18, miembros: 11, dia: "Miércoles", hora: "7:00 pm", lugar: "Salón Norte", lider: "Tomás Giraldo", modalidad: "Híbrido" },
    { id: "af_j25_parejas", min: "m_j25", nombre: "Recién Juntos",
      queHacen: "Parejas jóvenes de novios y recién casados construyendo cimientos sanos.",
      cupo: 14, miembros: 10, dia: "Viernes", hora: "7:30 pm", lugar: "Salón 3", lider: "Andrés Pardo", modalidad: "Presencial" },
    { id: "af_j25_arte", min: "m_j25", nombre: "Arte & Fe",
      queHacen: "Creativos (música, diseño, foto) que se acompañan y sirven con sus dones.",
      cupo: 16, miembros: 9, dia: "Jueves", hora: "6:30 pm", lugar: "Zona Creativa", lider: "Camila Ariza", modalidad: "Presencial" },
    { id: "af_j25_norte", min: "m_j25", nombre: "Conexión Norte",
      queHacen: "Grupo de barrio para quienes viven en el norte y quieren reunirse cerca de casa.",
      cupo: 18, miembros: 13, dia: "Martes", hora: "7:30 pm", lugar: "Casa fam. Beltrán · Cedritos", lider: "Santiago Beltrán", modalidad: "Presencial" },
    { id: "af_j25_mujeres", min: "m_j25", nombre: "Mujeres J+25",
      queHacen: "Espacio de mujeres jóvenes adultas: mentoría, oración y vida real.",
      cupo: 20, miembros: 16, dia: "Lunes", hora: "7:00 pm", lugar: "Salón Central", lider: "Valeria Castro", modalidad: "Presencial" },
    { id: "af_j25_lectura", min: "m_j25", nombre: "Club de Lectura",
      queHacen: "Leemos un libro al mes (fe, liderazgo, vida) y lo conversamos juntos.",
      cupo: 14, miembros: 8, dia: "Domingo", hora: "4:00 pm", lugar: "Café de familias", lider: "Natalia Robles", modalidad: "Híbrido" },
    /* tMt */
    { id: "af_tmt_legado", min: "m_tmt", nombre: "Legado · Universitarios",
      queHacen: "Grupo de universitarios (19–25) que estudian la Palabra y se acompañan en la U.",
      cupo: 25, miembros: 21, dia: "Viernes", hora: "6:30 pm", lugar: "Salón juvenil 2", lider: "Mateo Cano", modalidad: "Presencial" },
    { id: "af_tmt_eco", min: "m_tmt", nombre: "Eco · Colegios",
      queHacen: "Adolescentes (15–18) con juegos, retos y temas reales de su edad.",
      cupo: 30, miembros: 18, dia: "Sábado", hora: "3:00 pm", lugar: "Zona tMt", lider: "Valeria Sánchez", modalidad: "Presencial" },
    /* Mujer Integral */
    { id: "af_mujer_centro", min: "m_mujer", nombre: "Mujeres · Centro",
      queHacen: "Encuentro de crecimiento, oración y mentoría entre mujeres.",
      cupo: 16, miembros: 15, dia: "Miércoles", hora: "9:00 am", lugar: "Salón Central", lider: "Natalia Cruz", modalidad: "Presencial" },
    { id: "af_mujer_mamas", min: "m_mujer", nombre: "Mamás con propósito",
      queHacen: "Para mamás: crianza con fe, apoyo mutuo y espacio para los niños.",
      cupo: 18, miembros: 12, dia: "Martes", hora: "9:30 am", lugar: "Salón familiar", lider: "Marta Ríos", modalidad: "Presencial" },
    /* Casa2 */
    { id: "af_casa2_recien", min: "m_casa2", nombre: "Recién Casados",
      queHacen: "Parejas sin hijos construyendo bases sólidas de matrimonio.",
      cupo: 12, miembros: 8, dia: "Sábado", hora: "5:00 pm", lugar: "Casa de la familia Gil · Occidente", lider: "Pedro Gil", modalidad: "Presencial" },
    { id: "af_casa2_crianza", min: "m_casa2", nombre: "En crianza",
      queHacen: "Matrimonios con hijos compartiendo retos de la crianza con fe.",
      cupo: 14, miembros: 10, dia: "Viernes", hora: "7:30 pm", lugar: "Salón Casa2", lider: "Marta Ríos", modalidad: "Híbrido" },
    /* Hombres de Bien */
    { id: "af_hombres_taller", min: "m_hombres", nombre: "Taller de Hombres",
      queHacen: "Hombres trabajando carácter, finanzas e integridad. Directo y sin rodeos.",
      cupo: 18, miembros: 14, dia: "Sábado", hora: "7:00 am", lugar: "Cafetería principal", lider: "Óscar Tovar", modalidad: "Presencial" },
    /* Josués */
    { id: "af_josues_mesa", min: "m_josues", nombre: "La Mesa",
      queHacen: "Solteros adultos compartiendo cena y conversación de fe cada quince días.",
      cupo: 16, miembros: 9, dia: "Sábado", hora: "7:00 pm", lugar: "Salón 3", lider: "Ricardo Peña", modalidad: "Presencial" },
    /* Años Dorados */
    { id: "af_dorados_tarde", min: "m_dorados", nombre: "Tarde Dorada",
      queHacen: "Adultos mayores: música, juegos, Palabra y mucho café.",
      cupo: 20, miembros: 16, dia: "Martes", hora: "10:00 am", lugar: "Salón Dorado", lider: "Esperanza Díaz", modalidad: "Presencial" },
    /* RocaKids (grupos para servir/acompañar como familia) */
    { id: "af_kids_familias", min: "m_rocakids", nombre: "Familias RocaKids",
      queHacen: "Papás y mamás de RocaKids que se conectan mientras los niños participan.",
      cupo: 18, miembros: 13, dia: "Domingo", hora: "11:00 am", lugar: "Café de familias", lider: "Carolina Ruiz", modalidad: "Presencial" },

    /* ====== MEDELLÍN — grupos abiertos por el pastor de esa sede ====== */
    { id: "af_med_j25_centro", min: "m_j25", sede: "medellin", nombre: "Conexión Poblado",
      queHacen: "Jóvenes adultos del Poblado que se reúnen entre semana para crecer juntos.",
      cupo: 18, miembros: 11, dia: "Miércoles", hora: "7:00 pm", lugar: "Sede El Poblado", lider: "Felipe Acosta", modalidad: "Presencial" },
    { id: "af_med_mujer", min: "m_mujer", sede: "medellin", nombre: "Mujeres con Propósito",
      queHacen: "Encuentro de mujeres: mentoría, oración y vida real en comunidad.",
      cupo: 16, miembros: 12, dia: "Jueves", hora: "9:00 am", lugar: "Salón Medellín", lider: "Natalia Cruz", modalidad: "Presencial" },
    { id: "af_med_hombres", min: "m_hombres", sede: "medellin", nombre: "Hombres de Antioquia",
      queHacen: "Hombres trabajando carácter, fe y finanzas con franqueza.",
      cupo: 18, miembros: 9, dia: "Sábado", hora: "7:00 am", lugar: "Cafetería sede", lider: "Andrés Gómez", modalidad: "Presencial" },

    /* ====== CALI — grupos abiertos por el pastor de esa sede ====== */
    { id: "af_cali_j25", min: "m_j25", sede: "cali", nombre: "Granada Conecta",
      queHacen: "Profesionales jóvenes de Cali que estudian la Palabra y se acompañan.",
      cupo: 16, miembros: 8, dia: "Martes", hora: "7:30 pm", lugar: "Sede Granada", lider: "Óscar Tovar", modalidad: "Presencial" },
    { id: "af_cali_casa2", min: "m_casa2", sede: "cali", nombre: "Matrimonios Cali",
      queHacen: "Parejas construyendo bases sólidas de hogar con fe.",
      cupo: 14, miembros: 10, dia: "Viernes", hora: "7:30 pm", lugar: "Salón familiar", lider: "Mauricio León", modalidad: "Híbrido" },

    /* ====== MIAMI — grupo abierto por el pastor de esa sede ====== */
    { id: "af_mia_j25", min: "m_j25", sede: "miami", nombre: "Doral Young Pros",
      queHacen: "Grupo bilingüe de jóvenes adultos en Doral. Comunidad y crecimiento.",
      cupo: 20, miembros: 13, dia: "Jueves", hora: "7:30 pm", lugar: "Sede Doral", lider: "Carolina Pérez", modalidad: "Presencial" },

    /* ====== MADRID — grupo abierto por el pastor de esa sede ====== */
    { id: "af_mad_mujer", min: "m_mujer", sede: "madrid", nombre: "Mujeres Madrid",
      queHacen: "Mujeres de la comunidad latina en Madrid: fe, mentoría y apoyo mutuo.",
      cupo: 16, miembros: 7, dia: "Sábado", hora: "11:00 am", lugar: "Sede Alcalá", lider: "Lucía Romero", modalidad: "Presencial" }
  ];

  /* Normalización: los grupos sin 'sede' pertenecen a la sede madre (Bogotá);
     'aprobado' (por defecto true) = autorizado por el pastor para verse en el
     landing. El estado vivo de autorización se gestiona en window.STORE para
     que el pastor pueda publicar/ocultar desde su pestaña "Grupos pequeños". */
  AFINIDADES.forEach(a => {
    if (!a.sede) a.sede = "bogota";
    if (a.aprobado === undefined) a.aprobado = true;
    if (typeof a.miembros !== "number") a.miembros = 0;
  });

  /* ------------------------------------------------------------
     CRECE — Solo INSTITUTOS (IBLI / FACTER): corporativos, virtuales
     y globales (toda la red). Los CURSOS CORTOS ya NO viven aquí:
     cada pastor los crea/edita desde su pestaña "Cursos" y se guardan
     en window.STORE.cursos, etiquetados por sede. El landing los
     muestra en "Crece" filtrados por ciudad (fechas/horarios/modalidad
     propios de cada sede). Aquí quedan los institutos como base global.
     ------------------------------------------------------------ */
  const CRECE = [
    { id: "ibli", tipo: "instituto", sede: "global", nombre: "IBLI — Formación Cristiana Integral",
      desc: "Instituto bíblico de formación integral. 4 semestres, virtual en Moodle con SSO.",
      profesor: "Cuerpo docente IBLI (9)", horario: "Virtual · semestral · matrícula abierta", inicia: "Semestre II — ago 2026",
      modalidad: "Virtual (Moodle)", cupo: 120, inscritos: 86, ico: "🎓", etapa: "crece" },
    { id: "facter", tipo: "instituto", sede: "global", nombre: "FACTER — Formación Teológica",
      desc: "Formación teológica avanzada. 4 semestres, virtual en Moodle con SSO.",
      profesor: "Cuerpo docente FACTER (7)", horario: "Virtual · semestral · matrícula abierta", inicia: "Semestre II — ago 2026",
      modalidad: "Virtual (Moodle)", cupo: 60, inscritos: 41, ico: "📖", etapa: "crece" }
  ];

  /* ------------------------------------------------------------
     SIRVE — Equipos operativos. Cada uno con intro y formulario
     (un QR por equipo) para postularse a servir.
     ------------------------------------------------------------ */
  const SIRVE = [
    { id: "t_ujieres", nombre: "Ujieres", ico: "🚪", color: "azul",
      intro: "Equipo de logística y acompañamiento eclesial. Somos el primer rostro de la casa: recibimos, ubicamos y cuidamos cada domingo.",
      lider: "Claudia Mora", wa: "573105550201", buscan: "Personas cálidas y puntuales" },
    { id: "t_alabanza", nombre: "Alabanza", ico: "🎶", color: "mostaza",
      intro: "Equipo de alabanza de la iglesia. Guiamos a la congregación a la presencia de Dios con música y adoración.",
      lider: "David Quintero", wa: "573105550202", buscan: "Músicos y vocalistas (con audición)" },
    { id: "t_visa", nombre: "VISA", ico: "🎛️", color: "verde",
      intro: "Equipo de producción y audio de cada evento y domingo. Sonido, video, streaming e iluminación.",
      lider: "Hernán Ortiz", wa: "573105550203", buscan: "Técnicos y curiosos por aprender" },
    { id: "t_nicodemo", nombre: "Nicodemo", ico: "🌙", color: "azul",
      intro: "Equipo que recibe a los nuevos. Acompañamos a quien llega por primera vez y lo ayudamos a dar su primer paso.",
      lider: "Andrea Pineda", wa: "573105550204", buscan: "Personas empáticas que aman a la gente" },
    { id: "t_creativo", nombre: "Creativo", ico: "🎬", color: "mostaza",
      intro: "Equipo que ayuda en la experiencia del ministerio. Ambientación, diseño y producción que hacen memorable cada encuentro.",
      lider: "Lucía Franco", wa: "573105550205", buscan: "Diseñadores, fotógrafos y creativos" },
    { id: "t_amec", nombre: "AMEC", ico: "⚕️", color: "verde",
      intro: "Ministerio de médicos y profesionales de la salud en la iglesia. Servimos con jornadas, primeros auxilios y acompañamiento.",
      lider: "Dra. Liliana Vega", wa: "573105550206", buscan: "Profesionales de la salud" },
    { id: "t_oracion", nombre: "Oración", ico: "🕊️", color: "azul",
      intro: "Equipo de oración e intercesión. Cubrimos en oración a toda la iglesia: cadena de oración 24/7, intercesión del servicio del domingo y vigilias.",
      lider: "Esther Camargo", wa: "573105550207", buscan: "Personas que aman orar e interceder" }
  ];

  /* ------------------------------------------------------------
     CONVOCATORIA de servicio — campaña entre temporada (cada 3 meses).
     ------------------------------------------------------------ */
  const CONVOCATORIA = {
    activa: true,
    titulo: "Convocatoria de Servicio · Temporada Jul–Sep 2026",
    subtitulo: "Cada tres meses abrimos las puertas para servir. Este es tu momento de pasar de asistir a pertenecer.",
    cierre: "Inscripciones abiertas hasta el 30 de junio",
    cupos: "+140 espacios en 7 equipos",
    encuentro: "Encuentro de nuevos servidores: domingo 6 jul, 2:00 pm"
  };

  /* ------------------------------------------------------------
     Helpers
     ------------------------------------------------------------ */
  function ciudad(id) { return CIUDADES.find(c => c.id === id) || CIUDADES[0]; }
  function predicasDe(ciudadId) {
    return PREDICAS.filter(p => p.ciudad === ciudadId || p.ciudad === "global");
  }
  function afinidadesDe(minId) {
    return minId === "all" ? AFINIDADES : AFINIDADES.filter(a => a.min === minId);
  }
  // Grupos pequeños de una sede (sedeId = id de ciudad; "all" = todas).
  function afinidadesDeSede(sedeId) {
    return !sedeId || sedeId === "all" ? AFINIDADES : AFINIDADES.filter(a => a.sede === sedeId);
  }
  function afinidad(id) { return AFINIDADES.find(a => a.id === id); }
  function congregacional(minId) { return CONGREGACIONALES.find(c => c.min === minId); }
  function curso(id) { return CRECE.find(c => c.id === id); }
  function equipoSirve(id) { return SIRVE.find(s => s.id === id); }
  // Ministerios que tienen al menos una afinidad publicada (para el filtro Conéctate)
  function ministeriosConAfinidad() {
    const ids = [...new Set(AFINIDADES.map(a => a.min))];
    return ids.map(id => DB.ministerio(id)).filter(Boolean);
  }
  // Sedes (ciudades) que hoy tienen al menos un grupo pequeño en el catálogo.
  function sedesConAfinidad() {
    const ids = [...new Set(AFINIDADES.map(a => a.sede))];
    return CIUDADES.filter(c => ids.includes(c.id));
  }
  // Ministerios con afinidades dentro de una sede dada (para el filtro por sede).
  function ministeriosConAfinidadEnSede(sedeId) {
    const ids = [...new Set(afinidadesDeSede(sedeId).map(a => a.min))];
    return ids.map(id => DB.ministerio(id)).filter(Boolean);
  }

  /* ------------------------------------------------------------
     Metadatos de género y edad por ministerio. Sirven al filtro
     en cascada de Conéctate: el visitante dice quién es (género +
     edad exacta) y mostramos solo los ministerios que aplican.
     genero: "ambos" | "hombre" | "mujer"
     ------------------------------------------------------------ */
  const MIN_META = {
    m_rocakids: { genero: "ambos",  edadMin: 1,  edadMax: 10 },
    m_tmt:      { genero: "ambos",  edadMin: 11, edadMax: 25 },
    m_j25:      { genero: "ambos",  edadMin: 26, edadMax: 35 },
    m_josues:   { genero: "ambos",  edadMin: 35, edadMax: 59 },
    m_hombres:  { genero: "hombre", edadMin: 18, edadMax: 99 },
    m_mujer:    { genero: "mujer",  edadMin: 18, edadMax: 99 },
    m_casa2:    { genero: "ambos",  edadMin: 25, edadMax: 99 },
    m_dorados:  { genero: "ambos",  edadMin: 60, edadMax: 99 }
  };
  function metaMin(id) { return MIN_META[id] || { genero: "ambos", edadMin: 0, edadMax: 120 }; }
  // Ministerios con afinidades que coinciden con género ("all"|"hombre"|"mujer")
  // y edad exacta (número o null = cualquier edad).
  function ministeriosPara(genero, edad) {
    return ministeriosConAfinidad().filter(m => {
      const meta = metaMin(m.id);
      const gOk = !genero || genero === "all" || meta.genero === "ambos" || meta.genero === genero;
      const eOk = edad == null || edad === "" || (edad >= meta.edadMin && edad <= meta.edadMax);
      return gOk && eOk;
    });
  }

  return {
    CIUDADES, PREDICAS, CONGREGACIONALES, AFINIDADES, CRECE, SIRVE, CONVOCATORIA,
    ciudad, predicasDe, afinidadesDe, afinidadesDeSede, afinidad, congregacional, curso, equipoSirve,
    ministeriosConAfinidad, sedesConAfinidad, ministeriosConAfinidadEnSede,
    MIN_META, metaMin, ministeriosPara
  };
})();
