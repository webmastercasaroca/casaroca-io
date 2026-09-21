/* ============================================================
   CASA ROCA · DATOS + STORE de CONSEJERÍA
   Operativo de cuidado pastoral "Consejería" (m_consejeria) de la
   sede. Este archivo lo cargan CUATRO apps que comparten estado:

     1) consejeria-consejero.html    → el consejero atiende sus casos.
     2) consejeria-coordinador.html  → gestiona y asigna las consejerías.
     3) consejeria-director.html     → carga y cura el conocimiento base.
     4) (pastor.html)                → ve todo, agregado de la sede.

   Comparten window.CONSESTORE (estado en localStorage) → lo que el
   coordinador asigna se refleja EN VIVO en la bandeja del consejero,
   en la analítica del director y del pastor. En Fase 1 se reemplaza
   por Supabase manteniendo la misma interfaz pública.

   Expone:
     window.CONSE      → constantes / seed (solo lectura)
     window.CONSESTORE → estado mutable + sync en vivo
     window.CSUI       → helpers de UI compartidos (gráficas, modal, toast)
   Sin frameworks. Vistas = funciones que devuelven HTML.
   ============================================================ */
(function () {
  "use strict";

  const MIN_ID = "m_consejeria";

  /* ---------- usuarios demo por rol ---------- */
  const CONSEJERO_USER    = { nombre: "Andrés Lozano",  email: "andres.lozano@casaroca.org",  iniciales: "AL", rol: "Consejero · Emocional", id: "cj_andres" };
  const COORDINADOR_USER  = { nombre: "Javier Rodríguez", email: "javier.rodriguez@casaroca.org", iniciales: "JR", rol: "Coordinador de Consejería", id: "cj_javier" };
  const DIRECTOR_USER     = { nombre: "Pastor Franklin Peña", email: "franklin.pena@casaroca.org", iniciales: "FP", rol: "Director de Consejería", id: "cj_franklin" };

  /* ---------- tipos de consejería (con color e ícono) ---------- */
  const TIPOS = [
    { id: "emocional",  nombre: "Emocional",     emoji: "💙", color: "var(--azul-500)" },
    { id: "pareja",     nombre: "Pareja / Matrimonial", emoji: "💍", color: "#C2569B" },
    { id: "duelo",      nombre: "Duelo",         emoji: "🕊️", color: "var(--texto-suave)" },
    { id: "espiritual", nombre: "Espiritual",    emoji: "✝️", color: "var(--cs-teal, #0F766E)" },
    { id: "familiar",   nombre: "Familiar",      emoji: "👨‍👩‍👧", color: "var(--mostaza-500)" },
    { id: "vocacional", nombre: "Vocacional",    emoji: "🎯", color: "var(--azul-700)" },
    { id: "adicciones", nombre: "Adicciones / Restauración", emoji: "🌅", color: "var(--peligro)" },
    { id: "crisis",     nombre: "Crisis",        emoji: "🚨", color: "#D97706" },
  ];
  const tipo = id => TIPOS.find(t => t.id === id) || { id, nombre: id, emoji: "🤲", color: "var(--texto-suave)" };

  /* ---------- estados de una consejería ---------- */
  const ESTADOS = [
    { id: "solicitada", nombre: "Solicitada", color: "abierta" },
    { id: "asignada",   nombre: "Asignada",   color: "orando" },
    { id: "programada", nombre: "Programada", color: "orando" },
    { id: "activa",     nombre: "Activa",     color: "orando" },
    { id: "cerrada",    nombre: "Cerrada",    color: "respondida" },
  ];

  /* ---------- prioridades ---------- */
  const PRIORIDADES = [
    { id: "alta",  nombre: "Alta",  color: "var(--peligro)" },
    { id: "media", nombre: "Media", color: "var(--mostaza-600)" },
    { id: "baja",  nombre: "Baja",  color: "var(--texto-tenue)" },
  ];

  /* ---------- equipo de consejeros ---------- */
  /* catálogo de formación (cursos cortos + instituto) y módulos de consejería */
  const FORMACION = [
    { id: "adn",     nombre: "ADN",                grupo: "Cursos cortos" },
    { id: "bautizo", nombre: "Bautizo",            grupo: "Cursos cortos" },
    { id: "madurez", nombre: "Madurez Espiritual", grupo: "Cursos cortos" },
    { id: "llaves",  nombre: "Llaves del Poder",   grupo: "Cursos cortos" },
    { id: "ibli",    nombre: "IBLI",               grupo: "Instituto LMS" },
    { id: "facter",  nombre: "FACTER",             grupo: "Instituto LMS" },
  ];
  const MODULOS_CONSEJERIA = [
    { id: "mc1", nombre: "Fundamentos de consejería" },
    { id: "mc2", nombre: "Escucha activa y empatía" },
    { id: "mc3", nombre: "Duelo y pérdida" },
    { id: "mc4", nombre: "Consejería de pareja" },
    { id: "mc5", nombre: "Crisis y rutas de derivación" },
    { id: "mc6", nombre: "Confidencialidad y ética (Ley 1581)" },
  ];

  /* ---------- ministerios base de la iglesia (sincronizados con el CRM master) ----------
     Un consejero SIEMPRE pertenece a uno de estos ministerios; es la misma
     lista base de la iglesia (congregacionales + equipos operativos). */
  const MINISTERIOS_BASE = [
    "RocaKids", "tMt (11–25)", "J+25", "Josués", "Casa2", "Años Dorados",
    "Mujer Integral", "Hombres de Bien", "AMEC", "Centuriones", "Ejecutivos y Empresarios",
    "Alabanza", "VISA", "Ujieres", "Equipo Creativo", "Nicodemo",
  ];

  /* ---------- tipo de vínculo del consejero ---------- */
  const VINCULOS = [
    { id: "planta", nombre: "Planta", desc: "Colaborador de tiempo completo de la iglesia" },
    { id: "voluntario", nombre: "Voluntario", desc: "Consejero laico voluntario del ministerio" },
  ];

  const CONSEJEROS = [
    { id: "cj_andres",  nombre: "Andrés Lozano",   genero: "M", edad: 34, ingreso: "2023-02-10", tipoVinculo: "planta",     ministerio: "J+25",                     disponible: true,  especialidades: ["emocional", "espiritual"], tel: "+57 311 555 9001", email: "andres.lozano@casaroca.org",  capacidad: 6, activo: true, cert: "Consejería Básica · IBLI",
      formacion: { adn: "completo", bautizo: "completo", madurez: "completo", llaves: "curso", ibli: "completo", facter: "pendiente" }, modConsejeria: ["mc1", "mc2", "mc3", "mc5"] },
    { id: "cj_natalia", nombre: "Natalia Cruz",    genero: "F", edad: 38, ingreso: "2022-08-01", tipoVinculo: "voluntario", ministerio: "Mujer Integral",           disponible: true,  especialidades: ["duelo", "emocional"],       tel: "+57 320 555 9002", email: "natalia.cruz@casaroca.org",   capacidad: 5, activo: true, cert: "Acompañamiento en duelo",
      formacion: { adn: "completo", bautizo: "completo", madurez: "completo", llaves: "completo", ibli: "completo", facter: "curso" }, modConsejeria: ["mc1", "mc2", "mc3", "mc6"] },
    { id: "cj_jaime",   nombre: "Jaime Ortega",    genero: "M", edad: 45, ingreso: "2021-05-15", tipoVinculo: "planta",     ministerio: "Casa2",                    disponible: true,  especialidades: ["pareja", "familiar"],        tel: "+57 315 555 9003", email: "jaime.ortega@casaroca.org",   capacidad: 5, activo: true, cert: "Consejería matrimonial",
      formacion: { adn: "completo", bautizo: "completo", madurez: "completo", llaves: "completo", ibli: "completo", facter: "completo" }, modConsejeria: ["mc1", "mc2", "mc4", "mc6"] },
    { id: "cj_oscar",   nombre: "Óscar Tovar",     genero: "M", edad: 41, ingreso: "2022-01-20", tipoVinculo: "planta",     ministerio: "Hombres de Bien",          disponible: true,  especialidades: ["espiritual", "vocacional"],  tel: "+57 300 555 9004", email: "oscar.tovar@casaroca.org",    capacidad: 6, activo: true, cert: "Madurez Espiritual",
      formacion: { adn: "completo", bautizo: "completo", madurez: "completo", llaves: "curso", ibli: "curso", facter: "pendiente" }, modConsejeria: ["mc1", "mc2"] },
    { id: "cj_felipe",  nombre: "Felipe Acosta",   genero: "M", edad: 36, ingreso: "2023-09-05", tipoVinculo: "voluntario", ministerio: "Hombres de Bien",          disponible: true,  especialidades: ["familiar", "adicciones"],    tel: "+57 312 555 9005", email: "felipe.acosta@casaroca.org",  capacidad: 4, activo: true, cert: "Restauración · FACTER",
      formacion: { adn: "completo", bautizo: "completo", madurez: "curso", llaves: "pendiente", ibli: "pendiente", facter: "completo" }, modConsejeria: ["mc1", "mc5"] },
    { id: "cj_marta",   nombre: "Marta Niño",      genero: "F", edad: 29, ingreso: "2024-03-12", tipoVinculo: "voluntario", ministerio: "J+25",                     disponible: false, especialidades: ["emocional", "duelo"],        tel: "+57 322 555 9006", email: "marta.nino@casaroca.org",     capacidad: 5, activo: false, cert: "Consejería Básica",
      formacion: { adn: "completo", bautizo: "completo", madurez: "curso", llaves: "pendiente", ibli: "pendiente", facter: "pendiente" }, modConsejeria: ["mc1"] },
    /* --- consejeros añadidos (planta + voluntarios) --- */
    { id: "cj_paola",   nombre: "Paola Méndez",    genero: "F", edad: 33, ingreso: "2023-06-18", tipoVinculo: "voluntario", ministerio: "Mujer Integral",           disponible: true,  especialidades: ["emocional", "familiar"],     tel: "+57 314 555 9007", email: "paola.mendez@casaroca.org",   capacidad: 4, activo: true, cert: "Consejería Básica",
      formacion: { adn: "completo", bautizo: "completo", madurez: "completo", llaves: "curso", ibli: "curso", facter: "pendiente" }, modConsejeria: ["mc1", "mc2"] },
    { id: "cj_ricardo", nombre: "Ricardo Sáenz",   genero: "M", edad: 47, ingreso: "2020-11-02", tipoVinculo: "planta",     ministerio: "Hombres de Bien",          disponible: true,  especialidades: ["espiritual", "vocacional"],  tel: "+57 301 555 9008", email: "ricardo.saenz@casaroca.org",  capacidad: 6, activo: true, cert: "Madurez Espiritual · FACTER",
      formacion: { adn: "completo", bautizo: "completo", madurez: "completo", llaves: "completo", ibli: "completo", facter: "completo" }, modConsejeria: ["mc1", "mc2", "mc5", "mc6"] },
    { id: "cj_diana",   nombre: "Diana Peralta",   genero: "F", edad: 28, ingreso: "2024-01-15", tipoVinculo: "voluntario", ministerio: "J+25",                     disponible: true,  especialidades: ["emocional", "duelo"],        tel: "+57 318 555 9009", email: "diana.peralta@casaroca.org",  capacidad: 4, activo: true, cert: "Consejería Básica",
      formacion: { adn: "completo", bautizo: "curso", madurez: "curso", llaves: "pendiente", ibli: "pendiente", facter: "pendiente" }, modConsejeria: ["mc1"] },
    { id: "cj_hernan",  nombre: "Hernán Gil",      genero: "M", edad: 52, ingreso: "2019-08-20", tipoVinculo: "planta",     ministerio: "Ejecutivos y Empresarios", disponible: false, especialidades: ["pareja", "vocacional"],      tel: "+57 305 555 9010", email: "hernan.gil@casaroca.org",     capacidad: 5, activo: true, cert: "Consejería matrimonial · IBLI",
      formacion: { adn: "completo", bautizo: "completo", madurez: "completo", llaves: "completo", ibli: "completo", facter: "curso" }, modConsejeria: ["mc1", "mc2", "mc4"] },
  ];
  const consejero = id => CONSEJEROS.find(c => c.id === id) || null;

  /* ---------- espacios (consultorios) para el calendario ---------- */
  const ESPACIOS = [
    { id: "esp_1", nombre: "Consultorio 1", cap: 3 },
    { id: "esp_2", nombre: "Consultorio 2", cap: 3 },
    { id: "esp_3", nombre: "Sala de oración", cap: 6 },
    { id: "esp_virtual", nombre: "Virtual (videollamada)", cap: 99 },
  ];

  /* ---------- helpers de construcción ---------- */
  let _seq = 0;
  function uid(pfx) { return pfx + "_" + Date.now().toString(36) + "_" + (++_seq); }
  function hoyISO() { return new Date().toISOString().slice(0, 10); }
  function diasAtras(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
  function diasAdel(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

  /* ============================================================
     SEED — datos demo precargados
     ============================================================ */
  function seedConsejerias() {
    return [
      /* consejería ANTERIOR de Laura Tobón (mismo correo → el CRM la reconoce como recurrente) */
      { id: "cs_0", persona: "Laura Tobón",   genero: "F", edad: 27, tel: "+57 311 555 0142", correo: "laura.tobon@email.com", ministerio: "J+25",            tipo: "duelo",      estado: "cerrada",    prioridad: "baja",  consejero: "cj_natalia", desde: diasAtras(220), fechaAsig: diasAtras(215), proxima: null,        espacio: "esp_3", motivo: "Proceso anterior por duelo (cerrado).", sesiones: 6, notas: 4, etapaProceso: "finalizado", resultadoCierre: "Completado", confidencial: true },
      { id: "cs_1", persona: "Laura Tobón",   genero: "F", edad: 27, tel: "+57 311 555 0142", correo: "laura.tobon@email.com", ministerio: "J+25",            tipo: "emocional",  estado: "activa",     prioridad: "media", consejero: "cj_andres",  desde: diasAtras(40), fechaAsig: diasAtras(37), proxima: diasAdel(2),  espacio: "esp_1", motivo: "Acompañamiento por ansiedad y carga laboral.", sesiones: 4, notas: 4, etapaProceso: "c3", confidencial: true },
      { id: "cs_2", persona: "Pedro y Ana Gil", genero: "M", edad: 34, tel: "+57 320 555 8810", correo: "pedro.gil@email.com", ministerio: "Casa2",         tipo: "pareja",     estado: "activa",     prioridad: "alta",  consejero: "cj_jaime",   desde: diasAtras(28), fechaAsig: diasAtras(25), proxima: diasAdel(1),  espacio: "esp_2", motivo: "Consejería matrimonial · comunicación.", sesiones: 3, notas: 3, etapaProceso: "c3", confidencial: true },
      { id: "cs_3", persona: "Sandra Quintero", genero: "F", edad: 45, tel: "+57 315 555 2204", correo: "sandra.q@email.com", ministerio: "Mujer Integral", tipo: "duelo",     estado: "activa",     prioridad: "alta",  consejero: "cj_natalia", desde: diasAtras(24), fechaAsig: diasAtras(21), proxima: diasAdel(3),  espacio: "esp_3", motivo: "Pérdida reciente de un familiar.", sesiones: 3, notas: 5, etapaProceso: "c2", confidencial: true },
      { id: "cs_4", persona: "Carlos Beltrán",  genero: "M", edad: 38, tel: "+57 300 555 7733", correo: "carlos.beltran@email.com", ministerio: "Hombres de Bien", tipo: "espiritual", estado: "activa",   prioridad: "baja",  consejero: "cj_oscar",   desde: diasAtras(20), fechaAsig: diasAtras(18), proxima: diasAdel(5),  espacio: "esp_1", motivo: "Búsqueda de dirección y madurez.", sesiones: 2, notas: 2, etapaProceso: "c2", confidencial: true },
      { id: "cs_5", persona: "Daniela Rojas",   genero: "F", edad: 19, tel: "+57 312 555 6190", correo: "daniela.rojas@email.com", ministerio: "tMt (11–25)",   tipo: "familiar",   estado: "programada", prioridad: "media", consejero: "cj_felipe",  desde: diasAtras(12), fechaAsig: diasAtras(10), proxima: diasAdel(2),  espacio: "esp_virtual", motivo: "Conflicto familiar en casa.", sesiones: 0, notas: 0, etapaProceso: "asignado", confidencial: true },
      { id: "cs_6", persona: "Gustavo Mora",    genero: "M", edad: 29, tel: "+57 313 555 4521", correo: "gustavo.mora@email.com", ministerio: "Josués",        tipo: "vocacional", estado: "cerrada",    prioridad: "baja",  consejero: "cj_oscar",   desde: diasAtras(58), fechaAsig: diasAtras(55), proxima: null,         espacio: "esp_1", motivo: "Discernimiento vocacional (cerrado).", sesiones: 5, notas: 3, etapaProceso: "finalizado", confidencial: true },
      { id: "cs_7", persona: "Valentina Reyes", genero: "F", edad: 24, tel: "+57 318 555 3380", correo: "valentina.reyes@email.com", ministerio: "J+25",          tipo: "espiritual", estado: "activa",     prioridad: "media", consejero: "cj_andres",  desde: diasAtras(16), fechaAsig: diasAtras(12), proxima: diasAdel(4),  espacio: "esp_3", motivo: "Crecimiento y heridas del pasado.", sesiones: 2, notas: 2, etapaProceso: "c2", confidencial: true },
      /* otro caso del consejero Andrés, recién asignado (para el Kanban) */
      { id: "cs_12", persona: "Camilo Rincón", genero: "M", edad: 33, tel: "+57 301 555 7711", correo: "camilo.rincon@email.com", ministerio: "Hombres de Bien", tipo: "emocional", estado: "asignada", prioridad: "media", consejero: "cj_andres", desde: diasAtras(6), fechaAsig: diasAtras(1), proxima: null, espacio: null, motivo: "Estrés y dificultad para dormir.", sesiones: 0, notas: 0, etapaProceso: "asignado", confidencial: true },
      /* solicitudes sin asignar (bandeja del coordinador) */
      { id: "cs_8", persona: "Mónica Salas",    genero: "F", edad: 31, tel: "+57 316 555 9090", correo: "monica.salas@email.com", ministerio: "Mujer Integral", tipo: "emocional", estado: "solicitada", prioridad: "alta",  consejero: null,         desde: diasAtras(2),  fechaAsig: null, proxima: null, espacio: null, motivo: "Solicita apoyo, episodios de tristeza.", sesiones: 0, notas: 0, etapaProceso: "asignado", confidencial: true },
      { id: "cs_9", persona: "Héctor Páez",     genero: "M", edad: 41, tel: "+57 317 555 1212", correo: "hector.paez@email.com", ministerio: "Hombres de Bien", tipo: "adicciones", estado: "solicitada", prioridad: "alta", consejero: null,        desde: diasAtras(1),  fechaAsig: null, proxima: null, espacio: null, motivo: "Pide ayuda para iniciar proceso de restauración.", sesiones: 0, notas: 0, etapaProceso: "asignado", confidencial: true },
      { id: "cs_10", persona: "Camila y Jorge", genero: "F", edad: 28, tel: "+57 319 555 3434", correo: "camila.jorge@email.com", ministerio: "Casa2",         tipo: "pareja",     estado: "solicitada", prioridad: "media", consejero: null,        desde: diasAtras(3),  fechaAsig: null, proxima: null, espacio: null, motivo: "Preparación prematrimonial.", sesiones: 0, notas: 0, etapaProceso: "asignado", confidencial: true },
      { id: "cs_11", persona: "Esteban Quiroz", genero: "M", edad: 17, tel: "+57 321 555 5656", correo: "esteban.quiroz@email.com", ministerio: "tMt (11–25)",   tipo: "vocacional", estado: "solicitada", prioridad: "baja",  consejero: null,        desde: diasAtras(5),  fechaAsig: null, proxima: null, espacio: null, motivo: "Dudas de estudio y futuro.", sesiones: 0, notas: 0, etapaProceso: "asignado", confidencial: true },
    ];
  }

  /* base de conocimiento — la cura el Director (categorías + recursos) */
  function seedConocimiento() {
    return [
      { id: "kn_1", titulo: "Protocolo de primera cita", categoria: "Protocolos", tipo: "Protocolo", ico: "📋", dirigidoA: "Todos los consejeros", desc: "Cómo abrir un proceso: encuadre, confidencialidad, escucha activa y acuerdos.", por: "Pastor Franklin Peña", fecha: diasAtras(40), docs: [{ id: "d1", nombre: "Guía primera cita.pdf", archivo: "guia-primera-cita.pdf", peso: 184320 }] },
      { id: "kn_2", titulo: "Acompañamiento en duelo", categoria: "Guías por tema", tipo: "Guía", ico: "🕊️", dirigidoA: "Consejeros de duelo", desc: "Etapas del duelo, qué decir y qué evitar, oración y seguimiento.", por: "Pastor Franklin Peña", fecha: diasAtras(30), docs: [] },
      { id: "kn_3", titulo: "Consejería matrimonial · comunicación", categoria: "Guías por tema", tipo: "Guía", ico: "💍", dirigidoA: "Consejeros de pareja", desc: "Herramientas para parejas: escucha, lenguajes del amor, acuerdos.", por: "Jaime Ortega", fecha: diasAtras(22), docs: [{ id: "d2", nombre: "Taller comunicación.pptx", archivo: "taller-comunicacion.pptx", peso: 512000 }] },
      { id: "kn_4", titulo: "Señales de crisis y ruta de derivación", categoria: "Protocolos", tipo: "Protocolo", ico: "🚨", dirigidoA: "Todos los consejeros", desc: "Cuándo escalar al pastor o a un profesional externo. Líneas de ayuda.", por: "Pastor Franklin Peña", fecha: diasAtras(15), docs: [] },
      { id: "kn_5", titulo: "Versículos de consuelo por situación", categoria: "Recursos espirituales", tipo: "Documento", ico: "✝️", dirigidoA: "Todos los consejeros", desc: "Banco de pasajes ordenados por tema para acompañar la oración.", por: "Óscar Tovar", fecha: diasAtras(12), docs: [{ id: "d3", nombre: "Versiculos por tema.docx", archivo: "versiculos.docx", peso: 96000 }] },
      { id: "kn_6", titulo: "Confidencialidad y manejo de notas (Ley 1581)", categoria: "Protocolos", tipo: "Protocolo", ico: "🔒", dirigidoA: "Todos los consejeros", desc: "Reglas de privacidad de las notas pastorales y datos sensibles.", por: "Pastor Franklin Peña", fecha: diasAtras(8), docs: [] },
    ].concat((window.CONSE_FAQS || []).map(function (f, i) { return Object.assign({ fecha: diasAtras(7) }, f); }));
  }

  /* eventos del calendario (citas + reuniones de equipo) */
  function seedEventos() {
    return [
      { id: "ev_1", titulo: "Cita · Laura Tobón",  fecha: diasAdel(2), horaInicio: "16:00", horaFin: "17:00", espacioId: "esp_1", consejero: "cj_andres",  tipo: "cita", csId: "cs_1" },
      { id: "ev_2", titulo: "Cita · Pedro y Ana",  fecha: diasAdel(1), horaInicio: "18:00", horaFin: "19:00", espacioId: "esp_2", consejero: "cj_jaime",   tipo: "cita", csId: "cs_2" },
      { id: "ev_3", titulo: "Cita · Sandra Q.",    fecha: diasAdel(3), horaInicio: "10:00", horaFin: "11:00", espacioId: "esp_3", consejero: "cj_natalia", tipo: "cita", csId: "cs_3" },
      { id: "ev_4", titulo: "Reunión de equipo de consejeros", fecha: diasAdel(4), horaInicio: "19:00", horaFin: "20:30", espacioId: "esp_3", consejero: null, tipo: "reunion", csId: null },
      { id: "ev_5", titulo: "Capacitación · escucha activa", fecha: diasAdel(7), horaInicio: "18:30", horaFin: "20:00", espacioId: "esp_3", consejero: null, tipo: "formacion", csId: null },
    ];
  }

  /* ============================================================
     PLANTILLA oficial del correo de asignación (bienvenida)
     Placeholders: {{persona}} {{tel}} {{consejero}} {{consejeroTel}} {{modalidad}}
     ============================================================ */
  const PLANTILLA_ASIGNACION =
`CASA SOBRE LA ROCA – IGLESIA CRISTIANA INTEGRAL

Estimado/a: {{persona}}.   (por favor leer hasta el final)

Bienvenido(a) al servicio de apoyo espiritual en consejería, estamos para apoyarle, pronto se comunicará a su celular {{tel}}, el consejero(a) asignado para atenderle es {{consejero}} (celular {{consejeroTel}}), deben acordar una primera reunión, en día, hora y medio (según su solicitud), que sea conveniente para ambos.

El propósito del consejero(a) es guiarle, acompañarle y direccionar el proceso, esto requerirá compromiso de su parte:

1. El consejero(a) hará la gestión necesaria para atenderle en las instalaciones de la iglesia o a través de conexión virtual; según lo acuerden, le pedimos que cumpla con la cita programada, y si no puede asistir, avise a su consejero con anticipación para reprogramarla.

2. Su consejero puede darle tareas para completar entre las reuniones programadas, la realización de estas, son vitales para su proceso y muestra su interés en el mismo, si su consejero(a) evidencia que usted no está cumpliendo con su parte, puede interrumpir el proceso, el objetivo es desarrollar un acompañamiento eficaz y realizar un cierre mutuamente acordado; sin embargo, si usted no está comprometido, es posible que se deba concluir el proceso.

3. Adjunto encontrará un formulario de admisión, el cual lo invitamos a diligenciar, su consejero(a) le dará instrucciones y le informará a que correo o porque medio enviarlo, (por favor no lo envíe a este correo).

Estamos seguros de que Jesús quiere para su vida; sanidad y libertad, el equipo ministerial continuará apoyándolo(a) en oración.

De no ser contactado por el consejero asignado dentro de las próximas 48 horas, agradecemos responder a este correo informándonos y así poder hacer seguimiento.

Cordialmente.
Unidad de Consejería Laica de Casa Sobre la Roca. ICI.
apoyoconsejeria.bogota@casaroca.org
www.casaroca.org`;

  /* PLANTILLA de la encuesta de satisfacción (al cerrar el proceso) */
  const PLANTILLA_ENCUESTA =
`CASA SOBRE LA ROCA – Unidad de Consejería Laica

Estimado/a {{persona}}:

Tu proceso de consejería ha finalizado. Gracias por confiar en nosotros.
Nos ayudaría mucho conocer tu experiencia. Por favor califica de 1 (muy insatisfecho) a 5 (muy satisfecho) el acompañamiento recibido y déjanos un comentario.

Tu respuesta es confidencial y nos permite seguir mejorando el servicio.

Con cariño,
Unidad de Consejería Laica · Casa Sobre la Roca`;

  /* documentos: formularios de admisión (adjuntos al asignar) + correo de asignación */
  function seedDocumentos() {
    return [
      { id: "doc_f_ind", tipo: "formulario", nombre: "Formulario de admisión · Individual", desc: "Ficha de admisión para consejería individual.", aplicaA: ["emocional", "espiritual", "vocacional", "duelo", "adicciones", "crisis"], archivo: "admision-individual.pdf", activo: true, fecha: diasAtras(60), por: "Pastor Franklin Peña", contenido: "" },
      { id: "doc_f_par", tipo: "formulario", nombre: "Formulario de admisión · Pareja", desc: "Ficha de admisión para consejería de pareja / matrimonial.", aplicaA: ["pareja"], archivo: "admision-pareja.pdf", activo: true, fecha: diasAtras(60), por: "Jaime Ortega", contenido: "" },
      { id: "doc_f_men", tipo: "formulario", nombre: "Formulario de admisión · Menor de edad", desc: "Ficha + consentimiento del acudiente para menores.", aplicaA: ["emocional", "familiar"], archivo: "admision-menor.pdf", activo: true, fecha: diasAtras(60), por: "Pastor Franklin Peña", contenido: "" },
      { id: "doc_f_fam", tipo: "formulario", nombre: "Formulario de admisión · Familiar", desc: "Ficha de admisión para consejería familiar.", aplicaA: ["familiar"], archivo: "admision-familiar.pdf", activo: true, fecha: diasAtras(60), por: "Pastor Franklin Peña", contenido: "" },
      { id: "doc_correo_asig", tipo: "correo", nombre: "Correo de asignación (bienvenida)", desc: "Se envía a la persona en el momento de asignarle un consejero.", aplicaA: [], archivo: null, activo: true, fecha: diasAtras(60), por: "Unidad de Consejería Laica", contenido: PLANTILLA_ASIGNACION },
      { id: "doc_correo_enc", tipo: "correo", nombre: "Correo de encuesta de satisfacción", desc: "Se envía a la persona cuando el proceso se cierra.", aplicaA: [], archivo: null, activo: true, fecha: diasAtras(60), por: "Unidad de Consejería Laica", contenido: PLANTILLA_ENCUESTA },
    ];
  }

  const CONSE = {
    MIN_ID, CONSEJERO_USER, COORDINADOR_USER, DIRECTOR_USER,
    TIPOS, ESTADOS, PRIORIDADES, CONSEJEROS, ESPACIOS, FORMACION, MODULOS_CONSEJERIA,
    MINISTERIOS_BASE, VINCULOS,
    tipo, consejero, uid, hoyISO, diasAtras, diasAdel,
    estado: id => ESTADOS.find(e => e.id === id) || { id, nombre: id, color: "abierta" },
    prioridad: id => PRIORIDADES.find(p => p.id === id) || { id, nombre: id, color: "var(--texto-tenue)" },
    espacio: id => ESPACIOS.find(e => e.id === id) || null,
  };
  window.CONSE = CONSE;

  /* ============================================================
     STORE — estado mutable, persistente, con sync en vivo
     ============================================================ */
  window.CONSESTORE = (function () {
    const KEY = "casaroca_consejeria_v1";
    const hasLS = (function () { try { return typeof localStorage !== "undefined" && localStorage !== null; } catch (e) { return false; } })();
    let mem = null;

    function fresh() {
      /* interacción reciente (días atrás) y satisfacción demo por caso */
      const INT_DEMO = { cs_1: 2, cs_2: 1, cs_3: 9, cs_4: 14, cs_5: 3, cs_7: 6, cs_12: 1 };
      const SAT_DEMO = { cs_0: 5, cs_6: 4 };
      const cons = seedConsejerias();
      cons.forEach(c => {
        if (c.estado !== "solicitada" && c.ultimaInteraccion == null) {
          const d = INT_DEMO[c.id] != null ? INT_DEMO[c.id] : 5;
          c.ultimaInteraccion = new Date(Date.now() - d * 86400000).toISOString();
        }
        if (c.estado === "cerrada" && c.satisfaccion == null) {
          c.satisfaccion = { score: SAT_DEMO[c.id] != null ? SAT_DEMO[c.id] : 4, comentario: "", fecha: c.fechaAsig || hoyISO() };
          c.encuestaEnviada = true;
        }
        /* campos derivados del formulario oficial (riesgo por evaluación, modalidad) para la analítica */
        if (c.riesgo == null) c.riesgo = c.prioridad === "alta" ? "alto" : c.prioridad === "media" ? "medio" : "bajo";
        if (c.modalidad == null) c.modalidad = ((c.edad || 30) % 2 === 0) ? "presencial" : "virtual";
      });
      return {
        v: 6,
        consejerias: cons,
        conocimiento: seedConocimiento(),
        eventos: seedEventos(),
        equipo: JSON.parse(JSON.stringify(CONSEJEROS)),
        documentos: seedDocumentos(), // formularios de admisión + correo de asignación
        envios: [],                    // bitácora de correos (automatizaciones simuladas)
        notas: {}, // csId -> [{id, texto, por, fecha}]
        procesoCols: 3, // nº de columnas "Sesión N" del tablero Kanban
        analisis: [], // análisis guardados del explorador (tablas dinámicas)
      };
    }
    function leerRaw() { try { return JSON.parse(hasLS ? localStorage.getItem(KEY) : mem); } catch (e) { return null; } }
    function escribirRaw(d) { const s = JSON.stringify(d); if (hasLS) localStorage.setItem(KEY, s); else mem = s; }

    let DATA = leerRaw();
    if (!DATA || DATA.v !== 6) { DATA = fresh(); escribirRaw(DATA); }

    const subs = [];
    function onCambio(cb) { subs.push(cb); return () => { const i = subs.indexOf(cb); if (i >= 0) subs.splice(i, 1); }; }
    function emitir() { subs.forEach(cb => { try { cb(); } catch (e) {} }); }
    function persist() { escribirRaw(DATA); emitir(); }

    if (hasLS && typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("storage", e => { if (e.key === KEY) { DATA = leerRaw() || DATA; emitir(); } });
    }

    /* ---- lecturas ---- */
    function consejerias() { return DATA.consejerias.slice(); }
    function consejeriaPorId(id) { return DATA.consejerias.find(c => c.id === id) || null; }
    function deConsejero(cjId) { return DATA.consejerias.filter(c => c.consejero === cjId); }
    function solicitudes() { return DATA.consejerias.filter(c => c.estado === "solicitada"); }
    function activas() { return DATA.consejerias.filter(c => c.estado === "activa"); }
    function conocimiento() { return DATA.conocimiento.slice(); }
    function recursoPorId(id) { return DATA.conocimiento.find(k => k.id === id) || null; }
    function eventos() { return DATA.eventos.slice(); }
    function equipo() { return DATA.equipo.slice(); }
    function notasDe(csId) { return (DATA.notas[csId] || []).slice(); }

    /* ---- proceso / Kanban ---- */
    function numConsejerias() { return DATA.procesoCols || 3; }
    function columnasProceso() {
      const n = numConsejerias();
      const cols = [{ id: "asignado", lbl: "Asignado", ico: "📥" }];
      for (let i = 1; i <= n; i++) cols.push({ id: "c" + i, lbl: "Sesión " + i, ico: "🤲" });
      cols.push({ id: "finalizado", lbl: "Finalizado", ico: "✅" });
      return cols;
    }
    function addColumnaConsejeria() { DATA.procesoCols = numConsejerias() + 1; persist(); return DATA.procesoCols; }
    function setEtapaProceso(csId, et) {
      const c = consejeriaPorId(csId); if (!c) return false;
      c.etapaProceso = et;
      if (et === "finalizado") c.estado = "cerrada";
      else if (et === "asignado") { if (c.estado === "cerrada") c.estado = "asignada"; }
      else { c.estado = "activa"; } // está en alguna sesión N
      c.ultimaInteraccion = new Date().toISOString();
      persist(); return true;
    }
    function moverProceso(csId, dir) {
      const c = consejeriaPorId(csId); if (!c) return false;
      const cols = columnasProceso().map(x => x.id);
      let i = cols.indexOf(c.etapaProceso || "asignado");
      if (i < 0) i = 0;
      const ni = Math.max(0, Math.min(cols.length - 1, i + dir));
      return setEtapaProceso(csId, cols[ni]);
    }

    /* ---- mutaciones: consejerías ---- */
    function asignarConsejero(csId, cjId) {
      const c = consejeriaPorId(csId); if (!c) return false;
      c.consejero = cjId;
      if (c.estado === "solicitada") c.estado = "asignada";
      if (!c.fechaAsig) c.fechaAsig = hoyISO();
      if (!c.etapaProceso) c.etapaProceso = "asignado";
      c.ultimaInteraccion = new Date().toISOString();
      persist(); return true;
    }
    function setEstado(csId, est) { const c = consejeriaPorId(csId); if (!c) return false; c.estado = est; persist(); return true; }
    function setPrioridad(csId, p) { const c = consejeriaPorId(csId); if (!c) return false; c.prioridad = p; persist(); return true; }
    function programar(csId, fecha, espacio) {
      const c = consejeriaPorId(csId); if (!c) return false;
      c.proxima = fecha || c.proxima; if (espacio) c.espacio = espacio;
      if (c.estado === "asignada" || c.estado === "solicitada") c.estado = "programada";
      persist(); return true;
    }
    function cerrar(csId) { return setEstado(csId, "cerrada"); }
    function cerrarCaso(csId, resultado) {
      const c = consejeriaPorId(csId); if (!c) return false;
      c.estado = "cerrada"; c.etapaProceso = "finalizado"; c.resultadoCierre = resultado || "completado";
      c.ultimaInteraccion = new Date().toISOString();
      if (!c.encuestaEnviada) {
        c.encuestaEnviada = true;
        const doc = (DATA.documentos || []).find(d => d.id === "doc_correo_enc");
        const cuerpo = (doc && doc.contenido ? doc.contenido : "Gracias por tu proceso. Califica de 1 a 5 tu satisfacción.").replace(/\{\{persona\}\}/g, c.persona || "");
        registrarEnvio({ tipo: "encuesta", csId, para: c.correo || "", paraNombre: c.persona, asunto: "¿Cómo estuvo tu proceso de consejería?", cuerpo });
      }
      persist(); return true;
    }
    function addConsejeria(o) {
      const c = Object.assign({ id: uid("cs"), estado: "solicitada", prioridad: "media", consejero: null, desde: hoyISO(), fechaAsig: null, proxima: null, espacio: null, sesiones: 0, notas: 0, etapaProceso: "asignado", genero: "M", edad: null, tel: "", correo: "", confidencial: true }, o);
      if (c.consejero && !c.fechaAsig) c.fechaAsig = hoyISO();
      DATA.consejerias.unshift(c); persist(); return c;
    }
    function addNota(csId, texto, por) {
      if (!DATA.notas[csId]) DATA.notas[csId] = [];
      DATA.notas[csId].unshift({ id: uid("nt"), texto, por: por || "Consejero", fecha: hoyISO() });
      const c = consejeriaPorId(csId); if (c) { c.notas = (c.notas || 0) + 1; c.ultimaInteraccion = new Date().toISOString(); }
      persist(); return true;
    }
    function registrarSesion(csId) {
      const c = consejeriaPorId(csId); if (!c) return false;
      c.sesiones = (c.sesiones || 0) + 1;
      if (c.estado === "programada" || c.estado === "asignada") c.estado = "activa";
      // avanzar el proceso: asignado→c1, c(n)→c(n+1) hasta el nº de columnas
      const n = numConsejerias();
      const et = c.etapaProceso || "asignado";
      if (et === "asignado") c.etapaProceso = "c1";
      else if (/^c\d+$/.test(et)) { const k = Math.min(n, parseInt(et.slice(1), 10) + 1); c.etapaProceso = "c" + k; }
      c.ultimaInteraccion = new Date().toISOString();
      persist(); return true;
    }

    /* ---- mutaciones: conocimiento ---- */
    function addRecurso(o) {
      const k = Object.assign({ id: uid("kn"), categoria: "Guías por tema", tipo: "Guía", ico: "📚", dirigidoA: "Todos los consejeros", desc: "", por: DIRECTOR_USER.nombre, fecha: hoyISO(), docs: [] }, o);
      DATA.conocimiento.unshift(k); persist(); return k;
    }
    function delRecurso(id) { const i = DATA.conocimiento.findIndex(k => k.id === id); if (i >= 0) { DATA.conocimiento.splice(i, 1); persist(); return true; } return false; }
    function addDocRecurso(knId, doc) { const k = recursoPorId(knId); if (!k) return false; k.docs = k.docs || []; k.docs.push(Object.assign({ id: uid("doc") }, doc)); persist(); return true; }
    function delDocRecurso(knId, docId) { const k = recursoPorId(knId); if (!k || !k.docs) return false; const i = k.docs.findIndex(d => d.id === docId); if (i >= 0) { k.docs.splice(i, 1); persist(); return true; } return false; }

    /* ---- mutaciones: calendario ---- */
    function addEvento(o) { const e = Object.assign({ id: uid("ev"), tipo: "cita", consejero: null, csId: null }, o); DATA.eventos.push(e); persist(); return e; }
    function delEvento(id) { const i = DATA.eventos.findIndex(e => e.id === id); if (i >= 0) { DATA.eventos.splice(i, 1); persist(); return true; } return false; }
    function espacioLibre(espacioId, fecha, ini, fin, exceptId) {
      return !DATA.eventos.some(e => e.id !== exceptId && e.espacioId === espacioId && e.fecha === fecha && !(fin <= e.horaInicio || ini >= e.horaFin));
    }

    /* ---- mutaciones: equipo ---- */
    function equipoPorId(id) { return DATA.equipo.find(x => x.id === id) || null; }
    function toggleConsejero(cjId) { const c = equipoPorId(cjId); if (c) { c.activo = !c.activo; persist(); return c.activo; } return null; }
    function setDisponible(cjId, val) { const c = equipoPorId(cjId); if (!c) return null; c.disponible = (val == null ? !c.disponible : !!val); persist(); return c.disponible; }
    function addConsejero(o) {
      const c = Object.assign({ id: uid("cj"), especialidades: [], capacidad: 5, activo: true, disponible: true, tipoVinculo: "voluntario", ministerio: "", genero: "M", edad: null, tel: "", email: "", ingreso: hoyISO(), cert: "", formacion: {}, modConsejeria: [] }, o);
      DATA.equipo.push(c); persist(); return c;
    }
    function delConsejero(cjId) {
      const i = DATA.equipo.findIndex(x => x.id === cjId); if (i < 0) return false;
      // los casos ABIERTOS del consejero regresan a la bandeja (sin asignar); los cerrados conservan el histórico
      DATA.consejerias.forEach(c => {
        if (c.consejero === cjId && c.estado !== "cerrada") { c.consejero = null; c.estado = "solicitada"; c.etapaProceso = "asignado"; c.fechaAsig = null; c.proxima = null; }
      });
      DATA.equipo.splice(i, 1); persist(); return true;
    }

    /* ---- mutaciones: documentos (formularios de admisión + correos) ---- */
    function documentos() { return (DATA.documentos || []).slice(); }
    function documentoPorId(id) { return (DATA.documentos || []).find(d => d.id === id) || null; }
    function formularios() { return (DATA.documentos || []).filter(d => d.tipo === "formulario" && d.activo !== false); }
    function correoActivo() { return documentoPorId("doc_correo_asig") || (DATA.documentos || []).find(d => d.tipo === "correo" && d.activo !== false) || null; }
    function addDocumento(o) { const d = Object.assign({ id: uid("doc"), tipo: "texto", nombre: "Documento", desc: "", contenido: "", aplicaA: [], archivo: null, activo: true, fecha: hoyISO(), por: DIRECTOR_USER.nombre }, o); DATA.documentos.unshift(d); persist(); return d; }
    function updDocumento(id, campos) { const d = documentoPorId(id); if (!d) return false; Object.assign(d, campos); persist(); return true; }
    function delDocumento(id) { const i = DATA.documentos.findIndex(d => d.id === id); if (i >= 0) { DATA.documentos.splice(i, 1); persist(); return true; } return false; }

    /* ---- bitácora de correos (automatizaciones simuladas) ---- */
    function envios() { return (DATA.envios || []).slice(); }
    function enviosDe(csId) { return (DATA.envios || []).filter(e => e.csId === csId); }
    function registrarEnvio(o) { const e = Object.assign({ id: uid("env"), fecha: new Date().toISOString() }, o); DATA.envios.unshift(e); persist(); return e; }

    /* ---- composición de correos (usa la plantilla activa de Documentos) ---- */
    function componerCorreoAsignacion(c, cj) {
      const doc = correoActivo();
      const t = doc && doc.contenido ? doc.contenido : PLANTILLA_ASIGNACION;
      return t.replace(/\{\{persona\}\}/g, c.persona || "")
              .replace(/\{\{tel\}\}/g, c.tel || "—")
              .replace(/\{\{consejero\}\}/g, cj ? cj.nombre : "(por asignar)")
              .replace(/\{\{consejeroTel\}\}/g, cj ? (cj.tel || "—") : "—")
              .replace(/\{\{modalidad\}\}/g, c.modalidad || "—");
    }
    function componerCorreoConsejero(c, cj) {
      const t = tipo(c.tipo);
      return "Hola " + (cj ? cj.nombre.split(" ")[0] : "") + ",\n\n" +
        "Se te ha asignado un NUEVO caso de consejería:\n\n" +
        "• Persona: " + c.persona + "\n" +
        "• Tema: " + t.emoji + " " + t.nombre + "\n" +
        "• Prioridad: " + c.prioridad + "\n" +
        "• Modalidad: " + (c.modalidad || "—") + "\n" +
        "• Contacto: " + (c.tel || "—") + " · " + (c.correo || "—") + "\n" +
        "• Motivo: " + (c.motivo || "—") + "\n\n" +
        "Por favor comunícate con la persona dentro de las próximas 48 horas para acordar la primera sesión. El caso ya aparece en tu tablero, en la columna \"Asignado\".\n\n" +
        "Unidad de Consejería Laica · Casa Sobre la Roca";
    }

    /* asignar + notificar (correo a la persona y al consejero) + registrar formularios enviados */
    function asignarYNotificar(csId, cjId, formIds) {
      const c = consejeriaPorId(csId); if (!c) return null;
      asignarConsejero(csId, cjId);
      c.formulariosEnviados = (formIds || []).slice();
      const cj = equipoPorId(cjId);
      const forms = (formIds || []).map(id => { const d = documentoPorId(id); return d ? d.nombre : id; });
      const ep = registrarEnvio({ tipo: "asignacion-persona", csId, para: c.correo || "", paraNombre: c.persona, asunto: "Bienvenido(a) al servicio de apoyo espiritual en consejería", cuerpo: componerCorreoAsignacion(c, cj), adjuntos: forms });
      const ec = registrarEnvio({ tipo: "asignacion-consejero", csId, para: cj ? cj.email : "", paraNombre: cj ? cj.nombre : "", asunto: "Nuevo caso de consejería asignado", cuerpo: componerCorreoConsejero(c, cj) });
      persist();
      return { persona: ep, consejero: ec, consejeroObj: cj, forms: forms };
    }

    /* satisfacción (respuesta a la encuesta de cierre) */
    function registrarSatisfaccion(csId, score, comentario) { const c = consejeriaPorId(csId); if (!c) return false; c.satisfaccion = { score: Number(score), comentario: comentario || "", fecha: hoyISO() }; persist(); return true; }

    /* ---- análisis guardados (explorador / tablas dinámicas) ---- */
    function listaAnalisis() { return (DATA.analisis || []).slice(); }
    function addAnalisis(nombre, cfg) { if (!DATA.analisis) DATA.analisis = []; const a = { id: uid("an"), nombre, cfg: JSON.parse(JSON.stringify(cfg)) }; DATA.analisis.unshift(a); persist(); return a; }
    function delAnalisis(id) { if (!DATA.analisis) return false; const i = DATA.analisis.findIndex(a => a.id === id); if (i >= 0) { DATA.analisis.splice(i, 1); persist(); return true; } return false; }

    function resetDemo() { DATA = fresh(); persist(); }

    return {
      onCambio, persist, resetDemo,
      consejerias, consejeriaPorId, deConsejero, solicitudes, activas,
      conocimiento, recursoPorId, eventos, equipo, notasDe,
      asignarConsejero, setEstado, setPrioridad, programar, cerrar, cerrarCaso, addConsejeria, addNota, registrarSesion,
      numConsejerias, columnasProceso, addColumnaConsejeria, setEtapaProceso, moverProceso,
      addRecurso, delRecurso, addDocRecurso, delDocRecurso,
      addEvento, delEvento, espacioLibre,
      equipoPorId, toggleConsejero, setDisponible, addConsejero, delConsejero,
      documentos, documentoPorId, formularios, correoActivo, addDocumento, updDocumento, delDocumento,
      envios, enviosDe, registrarEnvio, componerCorreoAsignacion, componerCorreoConsejero, asignarYNotificar, registrarSatisfaccion,
      listaAnalisis, addAnalisis, delAnalisis,
    };
  })();
})();
