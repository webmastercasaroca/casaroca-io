/* ============================================================
   CASA ROCA AI SYSTEM — DATOS · INSTITUTO LMS (Fase 0)
   Plataforma de estudio tipo Moodle (mejorada) para
   estudiantes, docentes y dirección académica.
   Extiende window.DB. Sin backend: todo vive en memoria.
   Programas: IBLI y FACTER · 8 semestres · 4 materias c/u.
   ============================================================ */
(function () {
  const DB = window.DB;

  /* ============================================================
     1) NUEVOS ROLES (estudiante y docente) + personas
     ============================================================ */
  // Personas docentes (para topbar / autoría / asignaciones)
  DB.PERSONAS.push(
    { id: "p_jariza", nombres: "Jorge", apellidos: "Ariza", iniciales: "JA", rol: "Docente IBLI",
      sede: "bogota", etapa: "sirve", telefono: "—", email: "jorge.ariza@casaroca.org" },
    { id: "p_hreal", nombres: "Hugo", apellidos: "Real", iniciales: "HR", rol: "Docente IBLI",
      sede: "bogota", etapa: "sirve", telefono: "—", email: "hugo.real@casaroca.org" },
    { id: "p_lcaro", nombres: "Lina", apellidos: "Caro", iniciales: "LC", rol: "Docente IBLI",
      sede: "bogota", etapa: "sirve", telefono: "—", email: "lina.caro@casaroca.org" },
    { id: "p_avela", nombres: "Ana", apellidos: "Vela", iniciales: "AV", rol: "Docente IBLI",
      sede: "bogota", etapa: "sirve", telefono: "—", email: "ana.vela@casaroca.org" }
  );

  DB.ROLES.docente = {
    id: "docente", nombre: "Docente / Profesor", ico: "🧑‍🏫",
    desc: "Imparte materias del Instituto: material, evaluaciones y notas",
    alcance: "docente", sede: "bogota", persona: "p_jariza",
    sistema: "Instituto · Docencia"
  };
  DB.ROLES.estudiante = {
    id: "estudiante", nombre: "Estudiante", ico: "🎓",
    desc: "Aula virtual: materias, tareas, exámenes, notas y matrícula",
    alcance: "estudiante", sede: "bogota", persona: "p_valentina",
    sistema: "Instituto · Aula virtual"
  };

  /* ============================================================
     2) CONFIG GLOBAL DEL LMS
     ============================================================ */
  const CONFIG = {
    escala: "0.0 – 5.0 (Colombia)", aprobado: 3.0,
    valorCredito: 92000, valorMatricula: 480000, valorPension: 360000, moneda: "COP",
    sso: { activo: true, proveedor: "Moodle · SSO", url: "lms.casaroca.org" },
    integraciones: [
      { id: "moodle", nombre: "Moodle (SSO)", estado: true, desc: "Inicio de sesión único y sincronización de aulas." },
      { id: "siigo", nombre: "Siigo / Tesorería", estado: true, desc: "Pagos de matrícula y pensión como movimientos contables." },
      { id: "crm", nombre: "CRM Pastoral", estado: true, desc: "Formación visible en el perfil 360° de la persona." },
      { id: "correo", nombre: "Correo + WhatsApp", estado: true, desc: "Notificaciones automáticas a estudiantes." },
      { id: "zoom", nombre: "Zoom (sincronías)", estado: false, desc: "Sesiones en vivo embebidas (próximamente)." }
    ]
  };

  /* ============================================================
     3) PROGRAMAS · 8 semestres × 4 materias (malla completa)
     Se generan mallas coherentes; las 4 materias del semestre
     "vivo" del alumno demo se enriquecen con contenido real.
     ============================================================ */
  const PROGRAMAS = [
    { id: "ibli", nombre: "IBLI", titulo: "Formación Cristiana Integral", ico: "🎓",
      desc: "Instituto bíblico de formación integral. 8 semestres, modalidad virtual en Moodle.",
      semestres: 8, modalidad: "Virtual (Moodle)", sso: true, alumnos: 512, docentes: 22 },
    { id: "facter", nombre: "FACTER", titulo: "Formación Teológica Avanzada", ico: "📖",
      desc: "Formación teológica avanzada con lenguas bíblicas. 8 semestres en Moodle.",
      semestres: 8, modalidad: "Virtual (Moodle)", sso: true, alumnos: 288, docentes: 18 }
  ];

  // Catálogo de nombres por programa/semestre (4 por semestre)
  const MALLA = {
    ibli: {
      1: ["Panorama Bíblico I", "Fundamentos de la Fe", "Vida Devocional", "Identidad en Cristo"],
      2: ["Panorama Bíblico II", "Doctrinas Esenciales", "Hermenéutica Básica", "Evangelismo y Discipulado"],
      3: ["Antiguo Testamento I", "Nuevo Testamento I", "Liderazgo Cristiano", "Oración e Intercesión"],
      4: ["Antiguo Testamento II", "Nuevo Testamento II", "Familia y Relaciones", "Dones y Ministerios"],
      5: ["Teología Sistemática I", "Historia de la Iglesia", "Homilética I", "Consejería Básica"],
      6: ["Teología Sistemática II", "Misiones y Cultura", "Homilética II", "Ética Cristiana"],
      7: ["Eclesiología", "Plantación de Iglesias", "Mayordomía Integral", "Práctica Ministerial I"],
      8: ["Apologética", "Liderazgo de Equipos", "Práctica Ministerial II", "Proyecto de Grado"]
    },
    facter: {
      1: ["Introducción a la Teología", "Griego I", "Historia de la Iglesia I", "Métodos de Estudio"],
      2: ["Teología Bíblica", "Griego II", "Historia de la Iglesia II", "Filosofía y Fe"],
      3: ["Hebreo I", "Exégesis del AT", "Patrística", "Hermenéutica Avanzada"],
      4: ["Hebreo II", "Exégesis del NT", "Teología Reformada", "Apologética I"],
      5: ["Teología Sistemática I", "Cristología", "Ética Teológica", "Apologética II"],
      6: ["Teología Sistemática II", "Pneumatología", "Teología Pastoral", "Religiones Comparadas"],
      7: ["Escatología", "Teología Contemporánea", "Seminario de Investigación", "Práctica I"],
      8: ["Teología Pública", "Liderazgo Académico", "Práctica II", "Tesis Teológica"]
    }
  };

  const DOCENTES_POOL = [
    { id: "p_jariza", nombre: "Ps. Jorge Ariza" },
    { id: "p_hreal", nombre: "Ps. Hugo Real" },
    { id: "p_lcaro", nombre: "Ps. Lina Caro" },
    { id: "p_avela", nombre: "Ps. Ana Vela" }
  ];

  // Genera todas las materias (id, código, créditos, docente) de la malla
  function generarMaterias() {
    const out = [];
    PROGRAMAS.forEach(pr => {
      for (let s = 1; s <= 8; s++) {
        MALLA[pr.id][s].forEach((nombre, i) => {
          const creditos = i === 3 && s === 8 ? 4 : (i < 2 ? 3 : 2);
          const doc = DOCENTES_POOL[(s + i) % DOCENTES_POOL.length];
          out.push({
            id: `${pr.id}-${s}${i + 1}`,
            codigo: `${pr.nombre}-${s}0${i + 1}`,
            nombre, programa: pr.id, semestre: s, creditos,
            docente: doc.id, docenteNombre: doc.nombre,
            cohorte: `${pr.nombre} ${s}° · 2026-1`,
            cupo: 40, inscritos: 24 + ((s * 3 + i) % 14),
            modalidad: "Virtual asíncrona + 1 sincronía/semana"
          });
        });
      }
    });
    return out;
  }
  const MATERIAS = generarMaterias();
  // Overrides de docente para coherencia del demo (semestre vivo + 1 materia extra del docente demo)
  const OVERRIDE_DOC = {
    "ibli-21": "p_jariza", "ibli-22": "p_hreal", "ibli-23": "p_lcaro", "ibli-24": "p_avela",
    "ibli-32": "p_jariza"
  };
  MATERIAS.forEach(m => {
    if (OVERRIDE_DOC[m.id]) {
      m.docente = OVERRIDE_DOC[m.id];
      const d = DOCENTES_POOL.find(x => x.id === m.docente);
      if (d) m.docenteNombre = d.nombre;
    }
  });

  /* ============================================================
     4) CONTENIDO ENRIQUECIDO — materias del semestre vivo
     (IBLI semestre 2, cohorte de la alumna demo Valentina)
     ============================================================ */
  function recurso(id, tipo, nombre, estado, extra) {
    return Object.assign({ id, tipo, nombre, estado: estado || "pendiente" }, extra || {});
  }

  // Unidades + recursos para "Panorama Bíblico II" (materia del docente demo)
  const UNIDADES_201 = [
    { id: "u1", nombre: "Unidad 1 · Los Evangelios", desc: "Contexto, autores y propósito de los cuatro evangelios.",
      recursos: [
        recurso("r1", "lectura", "Lectura: Introducción a los Evangelios", "completado",
          { dur: "15 min", contenido: "Los cuatro evangelios (Mateo, Marcos, Lucas y Juan) presentan la vida, muerte y resurrección de Jesús desde perspectivas complementarias. Mateo escribe a una audiencia judía resaltando a Jesús como el Mesías prometido; Marcos, ágil y directo, lo muestra como el Siervo; Lucas, médico y detallista, como el Hijo del Hombre; y Juan, teológico, como el Hijo de Dios. Esta unidad explora cómo leer los evangelios entendiendo su género literario y su intención pastoral." }),
        recurso("r2", "video", "Video: Mapa del ministerio de Jesús", "completado",
          { dur: "12 min", url: "https://www.youtube.com/embed/wO5wkrH9D60", contenido: "Recorrido geográfico por Galilea, Samaria y Judea durante el ministerio de Jesús." }),
        recurso("r3", "archivo", "PDF: Línea de tiempo de los Evangelios", "en_curso",
          { dur: "PDF · 8 pág.", contenido: "Documento descargable con la cronología comparada de los cuatro evangelios." }),
        recurso("r4", "quiz", "Quiz 1 · Los Evangelios", "pendiente",
          { evaluacion: "q201_1", dur: "20 min · 10 preguntas" })
      ] },
    { id: "u2", nombre: "Unidad 2 · Hechos y la Iglesia primitiva", desc: "El nacimiento y expansión de la Iglesia.",
      recursos: [
        recurso("r5", "lectura", "Lectura: Pentecostés y la misión", "en_curso",
          { dur: "18 min", contenido: "El libro de los Hechos narra cómo el Espíritu Santo capacita a la Iglesia para ser testigo 'en Jerusalén, Judea, Samaria y hasta lo último de la tierra' (Hch 1:8). Estudiaremos el patrón misionero de la Iglesia primitiva y su relevancia hoy." }),
        recurso("r6", "foro", "Foro: ¿Qué marca a una iglesia saludable?", "pendiente",
          { foro: "f201_1", dur: "Participación" }),
        recurso("r7", "tarea", "Tarea 1 · Ensayo: La Iglesia que anhelo", "pendiente",
          { evaluacion: "t201_1", dur: "Entrega · 800 palabras" })
      ] },
    { id: "u3", nombre: "Unidad 3 · Las cartas paulinas", desc: "Pablo, su teología y sus cartas.",
      recursos: [
        recurso("r8", "lectura", "Lectura: Introducción a Pablo", "pendiente",
          { dur: "20 min", contenido: "Pablo de Tarso, de perseguidor a apóstol. Sus cartas son ocasionales y pastorales: responden a situaciones concretas de iglesias reales." }),
        recurso("r9", "scorm", "Módulo interactivo SCORM · Romanos", "pendiente",
          { dur: "Interactivo", contenido: "Recorrido interactivo por la carta a los Romanos." }),
        recurso("r10", "quiz", "Examen final · Panorama Bíblico II", "pendiente",
          { evaluacion: "q201_final", dur: "60 min · 25 preguntas" })
      ] }
  ];

  // Materias enriquecidas (las 4 del semestre vivo del alumno demo)
  const CURSO_DETALLE = {
    "ibli-21": {
      silabo: "Estudio panorámico del Nuevo Testamento: evangelios, Hechos y cartas. Objetivo: leer cada libro entendiendo su contexto, género y mensaje central para aplicarlo a la vida y al ministerio.",
      horario: "Sincronía: martes 7:00 pm · Asíncrono el resto de la semana",
      avance: 72, nota: 4.5,
      unidades: UNIDADES_201,
      gradebook: [
        { cat: "Quices", pond: 30, nota: 4.6 },
        { cat: "Tareas y foros", pond: 30, nota: 4.4 },
        { cat: "Participación", pond: 10, nota: 4.8 },
        { cat: "Examen final", pond: 30, nota: null }
      ]
    },
    "ibli-22": {
      silabo: "Doctrinas esenciales de la fe cristiana: Dios, Cristo, Espíritu Santo, salvación e Iglesia. Fundamento bíblico y aplicación práctica.",
      horario: "Sincronía: miércoles 7:00 pm",
      avance: 60, nota: 4.2,
      unidades: [
        { id: "u1", nombre: "Unidad 1 · La doctrina de Dios", desc: "Atributos y carácter de Dios.",
          recursos: [
            recurso("r1", "lectura", "Lectura: ¿Quién es Dios?", "completado", { dur: "16 min", contenido: "Un recorrido por los atributos comunicables e incomunicables de Dios." }),
            recurso("r2", "video", "Video: La Trinidad explicada", "completado", { dur: "14 min", url: "https://www.youtube.com/embed/KQLfgaUoQCw", contenido: "Una explicación accesible de la doctrina trinitaria." }),
            recurso("r3", "quiz", "Quiz · Doctrina de Dios", "completado", { evaluacion: "q202_1", dur: "15 min" })
          ] },
        { id: "u2", nombre: "Unidad 2 · La salvación", desc: "Gracia, fe y nueva vida.",
          recursos: [
            recurso("r4", "lectura", "Lectura: Justificación por la fe", "en_curso", { dur: "20 min", contenido: "La salvación es por gracia, mediante la fe, no por obras (Ef 2:8-9)." }),
            recurso("r5", "tarea", "Tarea · Mi testimonio de salvación", "pendiente", { evaluacion: "t202_1", dur: "Entrega" })
          ] }
      ],
      gradebook: [
        { cat: "Quices", pond: 40, nota: 4.3 },
        { cat: "Tareas", pond: 30, nota: 4.0 },
        { cat: "Examen final", pond: 30, nota: null }
      ]
    },
    "ibli-23": {
      silabo: "Principios de interpretación bíblica (hermenéutica): contexto, género literario, idioma original y aplicación responsable del texto.",
      horario: "Sincronía: jueves 7:00 pm",
      avance: 45, nota: 4.0,
      unidades: [
        { id: "u1", nombre: "Unidad 1 · ¿Qué es interpretar?", desc: "El puente entre el texto y hoy.",
          recursos: [
            recurso("r1", "lectura", "Lectura: Los tres mundos del texto", "completado", { dur: "18 min", contenido: "El mundo detrás del texto, el mundo del texto y el mundo frente al texto." }),
            recurso("r2", "video", "Video: Errores comunes al interpretar", "en_curso", { dur: "11 min", url: "https://www.youtube.com/embed/ak06MSETeo4", contenido: "Sacar versículos de contexto y otras trampas frecuentes." }),
            recurso("r3", "foro", "Foro: Un versículo mal usado", "pendiente", { foro: "f203_1", dur: "Participación" })
          ] }
      ],
      gradebook: [
        { cat: "Talleres", pond: 50, nota: 4.0 },
        { cat: "Examen final", pond: 50, nota: null }
      ]
    },
    "ibli-24": {
      silabo: "Fundamentos bíblicos y prácticos del evangelismo y el discipulado: compartir la fe con naturalidad y acompañar a otros a crecer.",
      horario: "Sincronía: lunes 7:00 pm",
      avance: 80, nota: 4.7,
      unidades: [
        { id: "u1", nombre: "Unidad 1 · El corazón del evangelista", desc: "Motivación y mensaje.",
          recursos: [
            recurso("r1", "lectura", "Lectura: Las buenas nuevas", "completado", { dur: "14 min", contenido: "El evangelio en su forma más simple y poderosa." }),
            recurso("r2", "tarea", "Tarea · Mi mapa de relaciones", "completado", { evaluacion: "t204_1", dur: "Entrega" }),
            recurso("r3", "quiz", "Quiz · El mensaje del evangelio", "completado", { evaluacion: "q204_1", dur: "12 min" })
          ] },
        { id: "u2", nombre: "Unidad 2 · Hacer discípulos", desc: "Acompañar el crecimiento.",
          recursos: [
            recurso("r4", "video", "Video: El modelo de Jesús", "en_curso", { dur: "16 min", url: "https://www.youtube.com/embed/1Jwo5qc78QM", contenido: "Cómo Jesús formó a sus discípulos." }),
            recurso("r5", "tarea", "Tarea final · Plan de discipulado", "pendiente", { evaluacion: "t204_2", dur: "Entrega" })
          ] }
      ],
      gradebook: [
        { cat: "Tareas", pond: 50, nota: 4.7 },
        { cat: "Quices", pond: 20, nota: 4.8 },
        { cat: "Proyecto final", pond: 30, nota: null }
      ]
    }
  };

  /* ============================================================
     5) BANCO DE PREGUNTAS + EVALUACIONES
     ============================================================ */
  const EVALUACIONES = {
    q201_1: { id: "q201_1", materia: "ibli-21", tipo: "quiz", titulo: "Quiz 1 · Los Evangelios",
      intentos: 2, tiempo: "20 min", abre: "5 jun 2026", cierra: "20 jun 2026", puntaje: 10,
      preguntas: [
        { id: "p1", tipo: "opcion", texto: "¿Cuántos evangelios hay en el Nuevo Testamento?", opciones: ["2", "3", "4", "5"], correcta: 2, puntos: 2,
          feedback: "Son cuatro: Mateo, Marcos, Lucas y Juan." },
        { id: "p2", tipo: "vf", texto: "Marcos es el evangelio más extenso.", correcta: false, puntos: 2,
          feedback: "Marcos es el más breve y directo." },
        { id: "p3", tipo: "opcion", texto: "¿A qué audiencia escribe principalmente Mateo?", opciones: ["Griegos", "Judíos", "Romanos", "Egipcios"], correcta: 1, puntos: 3,
          feedback: "Mateo escribe a una audiencia judía, resaltando a Jesús como el Mesías." },
        { id: "p4", tipo: "corta", texto: "¿Qué evangelio presenta a Jesús como el Hijo de Dios de forma más teológica?", respuesta: "Juan", puntos: 3,
          feedback: "El evangelio de Juan." }
      ] },
    q201_final: { id: "q201_final", materia: "ibli-21", tipo: "examen", titulo: "Examen final · Panorama Bíblico II",
      intentos: 1, tiempo: "60 min", abre: "25 jun 2026", cierra: "30 jun 2026", puntaje: 25, preguntas: [] },
    t201_1: { id: "t201_1", materia: "ibli-21", tipo: "tarea", titulo: "Ensayo: La Iglesia que anhelo",
      entrega: "22 jun 2026", puntaje: 5, descripcion: "Escribe un ensayo de 800 palabras describiendo las marcas de una iglesia saludable según el libro de los Hechos, y cómo te gustaría servir en una.",
      rubrica: [
        { criterio: "Fundamento bíblico", niveles: ["Insuficiente", "Aceptable", "Bueno", "Excelente"], pts: [1, 2, 3, 4] },
        { criterio: "Claridad y redacción", niveles: ["Insuficiente", "Aceptable", "Bueno", "Excelente"], pts: [1, 2, 3, 4] },
        { criterio: "Aplicación personal", niveles: ["Insuficiente", "Aceptable", "Bueno", "Excelente"], pts: [1, 2, 3, 4] }
      ] }
  };

  /* ============================================================
     6) ENTREGAS (bandeja de calificación del docente)
     ============================================================ */
  const ENTREGAS = [
    { id: "e1", evaluacion: "t201_1", materia: "ibli-21", estudiante: "p_valentina", estado: "entregado",
      fecha: "11 jun 2026", archivo: "ensayo_iglesia_valentina.pdf", nota: null, feedback: "", comentario: "Disfruté mucho esta tarea, pastor." },
    { id: "e2", evaluacion: "t201_1", materia: "ibli-21", estudiante: "p_julian", estado: "entregado",
      fecha: "10 jun 2026", archivo: "ensayo_julian.docx", nota: null, feedback: "", comentario: "" },
    { id: "e3", evaluacion: "t201_1", materia: "ibli-21", estudiante: "p_laura", estado: "calificado",
      fecha: "9 jun 2026", archivo: "ensayo_laura.pdf", nota: 4.3, feedback: "Buen fundamento bíblico. Cuida la extensión.", comentario: "" },
    { id: "e4", evaluacion: "t201_1", materia: "ibli-21", estudiante: "p_daniel", estado: "sin_entregar",
      fecha: "—", archivo: null, nota: null, feedback: "", comentario: "" }
  ];

  /* ============================================================
     7) ESTUDIANTES de cohorte (gradebook + analítica)
     ============================================================ */
  const ESTUDIANTES = [
    { id: "p_valentina", nombre: "Valentina Ríos", avance: 72, promedio: 4.35, riesgo: false,
      notas: { "ibli-21": 4.5, "ibli-22": 4.2, "ibli-23": 4.0, "ibli-24": 4.7 } },
    { id: "p_julian", nombre: "Julián Ospina", avance: 64, promedio: 4.0, riesgo: false,
      notas: { "ibli-21": 4.1, "ibli-22": 3.8, "ibli-23": 4.0, "ibli-24": 4.2 } },
    { id: "p_laura", nombre: "Laura Tobón", avance: 38, promedio: 3.4, riesgo: true,
      notas: { "ibli-21": 4.3, "ibli-22": 3.0, "ibli-23": 2.8, "ibli-24": 3.5 } },
    { id: "p_daniel", nombre: "Daniel Garzón", avance: 22, promedio: 2.9, riesgo: true,
      notas: { "ibli-21": null, "ibli-22": 3.2, "ibli-23": 2.6, "ibli-24": 2.9 } },
    { id: "s_andrea2", nombre: "Andrea Suárez", avance: 91, promedio: 4.7, riesgo: false,
      notas: { "ibli-21": 4.8, "ibli-22": 4.6, "ibli-23": 4.5, "ibli-24": 4.9 } },
    { id: "s_mateo", nombre: "Mateo Gil", avance: 80, promedio: 4.3, riesgo: false,
      notas: { "ibli-21": 4.4, "ibli-22": 4.2, "ibli-23": 4.1, "ibli-24": 4.5 } },
    { id: "s_paula", nombre: "Paula Niño", avance: 55, promedio: 3.7, riesgo: false,
      notas: { "ibli-21": 3.8, "ibli-22": 3.5, "ibli-23": 3.6, "ibli-24": 3.9 } },
    { id: "s_carlos", nombre: "Carlos Mora", avance: 33, promedio: 3.1, riesgo: true,
      notas: { "ibli-21": 3.0, "ibli-22": 3.2, "ibli-23": 2.9, "ibli-24": 3.3 } }
  ];

  /* ============================================================
     8) FINANZAS ACADÉMICAS (estado de cuenta del estudiante)
     ============================================================ */
  const FINANZAS = {
    estudiante: "p_valentina",
    matricula: 480000, pension: 360000, beca: { nombre: "Beca servicio 20%", desc: 72000 },
    saldo: 360000, estado: "Pendiente de pago · pensión junio",
    movimientos: [
      { id: "m1", fecha: "10 ene 2026", concepto: "Matrícula 2026-1", valor: 480000, estado: "Pagado", metodo: "Wompi" },
      { id: "m2", fecha: "5 feb 2026", concepto: "Pensión febrero", valor: 288000, estado: "Pagado", metodo: "Wompi", nota: "Beca 20% aplicada" },
      { id: "m3", fecha: "5 mar 2026", concepto: "Pensión marzo", valor: 288000, estado: "Pagado", metodo: "PayU" },
      { id: "m4", fecha: "5 abr 2026", concepto: "Pensión abril", valor: 288000, estado: "Pagado", metodo: "Wompi" },
      { id: "m5", fecha: "5 may 2026", concepto: "Pensión mayo", valor: 288000, estado: "Pagado", metodo: "Wompi" },
      { id: "m6", fecha: "5 jun 2026", concepto: "Pensión junio", valor: 288000, estado: "Pendiente", metodo: "—" }
    ]
  };
  // Cartera consolidada (vista académica)
  const CARTERA = {
    recaudoMes: 96, // millones COP
    enMora: 14, alDia: 786, total: 800,
    morosos: [
      { id: "p_daniel", nombre: "Daniel Garzón", programa: "IBLI", semestre: 2, saldo: 576000, dias: 35 },
      { id: "s_carlos", nombre: "Carlos Mora", programa: "IBLI", semestre: 2, saldo: 288000, dias: 12 },
      { id: "s_paula", nombre: "Paula Niño", programa: "IBLI", semestre: 2, saldo: 288000, dias: 8 }
    ],
    becas: [
      { tipo: "Beca servicio (voluntarios)", beneficiarios: 64, descuento: "20%" },
      { tipo: "Beca pastoral (necesidad)", beneficiarios: 28, descuento: "50%" },
      { tipo: "Beca excelencia (promedio > 4.5)", beneficiarios: 19, descuento: "30%" }
    ]
  };

  /* ============================================================
     9) MATRÍCULA del estudiante (historial + próximo semestre)
     ============================================================ */
  const MATRICULA = {
    estudiante: "p_valentina", programa: "ibli", semestreActual: 2, estado: "Activa",
    historial: [
      { semestre: 1, periodo: "2025-2", estado: "Aprobado", promedio: 4.4, creditos: 12 },
      { semestre: 2, periodo: "2026-1", estado: "En curso", promedio: 4.35, creditos: 10 }
    ],
    proximo: { semestre: 3, periodo: "2026-2", abre: "1 jul 2026", materias: ["ibli-31", "ibli-32", "ibli-33", "ibli-34"] }
  };

  /* ============================================================
     10) FOROS, ANUNCIOS Y MENSAJERÍA
     ============================================================ */
  const FOROS = {
    f201_1: { id: "f201_1", materia: "ibli-21", titulo: "¿Qué marca a una iglesia saludable?",
      hilos: [
        { id: "h1", autor: "Ps. Jorge Ariza", rol: "Docente", fecha: "8 jun 2026", inicial: true,
          txt: "Después de leer Hechos 2:42-47, ¿cuáles crees que son las marcas innegociables de una iglesia saludable? Comparte una y un ejemplo." },
        { id: "h2", autor: "Valentina Ríos", rol: "Estudiante", fecha: "9 jun 2026",
          txt: "La comunión genuina. En mi grupo pequeño he visto cómo orar juntos cambia todo." },
        { id: "h3", autor: "Julián Ospina", rol: "Estudiante", fecha: "10 jun 2026",
          txt: "Yo diría la enseñanza fiel de la Palabra. Sin eso, lo demás se desenfoca." }
      ] }
  };
  const ANUNCIOS = [
    { id: "an1", materia: "ibli-21", autor: "Ps. Jorge Ariza", fecha: "11 jun 2026",
      titulo: "Recordatorio: examen final el 25 de junio", txt: "Repasen las unidades 1 a 3. El examen tiene un solo intento y 60 minutos." },
    { id: "an2", materia: "ibli-21", autor: "Ps. Jorge Ariza", fecha: "6 jun 2026",
      titulo: "Sincronía de esta semana", txt: "Nos vemos el martes 7:00 pm. Traigan sus preguntas de la lectura de Hechos." }
  ];
  const MENSAJES = [
    { id: "ms1", con: "Ps. Jorge Ariza", rol: "Docente · Panorama Bíblico II", ultimo: "Claro, con gusto reviso tu avance del ensayo.", fecha: "Hoy 10:12 am", noLeido: 1 },
    { id: "ms2", con: "Coordinación académica", rol: "Instituto IBLI", ultimo: "Tu matrícula al semestre 3 abre el 1 de julio.", fecha: "Ayer", noLeido: 0 },
    { id: "ms3", con: "Tutoría IA", rol: "Asistente de estudio", ultimo: "¿Quieres que te genere un repaso de los Evangelios?", fecha: "Lun", noLeido: 0 }
  ];

  /* ============================================================
     11) CALENDARIO ACADÉMICO
     ============================================================ */
  const CALENDARIO = [
    { id: "ev1", fecha: "16 jun 2026", dia: "16", mes: "JUN", tipo: "tarea", titulo: "Entrega · Ensayo La Iglesia que anhelo", materia: "Panorama Bíblico II", color: "mostaza" },
    { id: "ev2", fecha: "17 jun 2026", dia: "17", mes: "JUN", tipo: "sincronia", titulo: "Sincronía · Doctrinas Esenciales", materia: "Doctrinas Esenciales", color: "azul" },
    { id: "ev3", fecha: "20 jun 2026", dia: "20", mes: "JUN", tipo: "quiz", titulo: "Cierra · Quiz 1 Los Evangelios", materia: "Panorama Bíblico II", color: "mostaza" },
    { id: "ev4", fecha: "25 jun 2026", dia: "25", mes: "JUN", tipo: "examen", titulo: "Examen final · Panorama Bíblico II", materia: "Panorama Bíblico II", color: "peligro" },
    { id: "ev5", fecha: "1 jul 2026", dia: "01", mes: "JUL", tipo: "matricula", titulo: "Abre matrícula · Semestre 3", materia: "Instituto IBLI", color: "verde" }
  ];

  /* ============================================================
     12) PROGRESO · CERTIFICADOS · INSIGNIAS (gamificación)
     ============================================================ */
  const PROGRESO = {
    estudiante: "p_valentina", avanceGlobal: 38, creditosAcum: 22, creditosTotal: 80,
    racha: 12, nivel: "Aprendiz fiel", puntos: 1840,
    badges: [
      { id: "b1", nombre: "Primer semestre", ico: "🥇", obtenida: true, desc: "Aprobaste tu primer semestre." },
      { id: "b2", nombre: "Racha de 7 días", ico: "🔥", obtenida: true, desc: "Estudiaste 7 días seguidos." },
      { id: "b3", nombre: "Lector devoto", ico: "📖", obtenida: true, desc: "Completaste 20 lecturas." },
      { id: "b4", nombre: "Mentor", ico: "🤝", obtenida: false, desc: "Ayuda a 3 compañeros en el foro." },
      { id: "b5", nombre: "Excelencia", ico: "⭐", obtenida: false, desc: "Promedio mayor a 4.5 un semestre." }
    ],
    certificados: [
      { id: "cert1", nombre: "Semestre 1 · IBLI aprobado", fecha: "dic 2025", tipo: "Semestre" },
      { id: "cert2", nombre: "Curso ADN", fecha: "oct 2025", tipo: "Curso corto" },
      { id: "cert3", nombre: "Curso Bautizo", fecha: "nov 2025", tipo: "Curso corto" }
    ]
  };

  /* ============================================================
     13) ANALÍTICA (cohortes / programas)
     ============================================================ */
  const ANALITICA = {
    matriculados: 800, retencion: 84, desercion: 9, graduacionProyectada: 71, promedioRed: 4.1,
    porPrograma: [
      { programa: "IBLI", matriculados: 512, retencion: 86, promedio: 4.2 },
      { programa: "FACTER", matriculados: 288, retencion: 81, promedio: 4.0 }
    ],
    porSemestre: [
      { sem: 1, alumnos: 168, retencion: 78 }, { sem: 2, alumnos: 142, retencion: 83 },
      { sem: 3, alumnos: 118, retencion: 85 }, { sem: 4, alumnos: 96, retencion: 87 },
      { sem: 5, alumnos: 78, retencion: 88 }, { sem: 6, alumnos: 92, retencion: 86 },
      { sem: 7, alumnos: 56, retencion: 90 }, { sem: 8, alumnos: 50, retencion: 92 }
    ],
    enRiesgo: 38, graduandos: 50
  };

  /* ============================================================
     14) SECCIONES / COHORTES (gestión académica)
     ============================================================ */
  const SECCIONES = [
    { id: "sec1", materia: "ibli-21", nombre: "Panorama Bíblico II", docente: "Ps. Jorge Ariza", cupo: 40, inscritos: 32, cohorte: "IBLI 2° · 2026-1", sede: "Virtual" },
    { id: "sec2", materia: "ibli-22", nombre: "Doctrinas Esenciales", docente: "Ps. Hugo Real", cupo: 40, inscritos: 30, cohorte: "IBLI 2° · 2026-1", sede: "Virtual" },
    { id: "sec3", materia: "ibli-23", nombre: "Hermenéutica Básica", docente: "Ps. Lina Caro", cupo: 35, inscritos: 28, cohorte: "IBLI 2° · 2026-1", sede: "Virtual" },
    { id: "sec4", materia: "ibli-24", nombre: "Evangelismo y Discipulado", docente: "Ps. Ana Vela", cupo: 40, inscritos: 34, cohorte: "IBLI 2° · 2026-1", sede: "Virtual" },
    { id: "sec5", materia: "facter-11", nombre: "Introducción a la Teología", docente: "Dr. Pablo Mejía", cupo: 30, inscritos: 22, cohorte: "FACTER 1° · 2026-1", sede: "Virtual" }
  ];

  /* ============================================================
     15) GETTERS expuestos en DB
     ============================================================ */
  function lmsPrograma(id) { return PROGRAMAS.find(p => p.id === id); }
  function lmsMateria(id) { return MATERIAS.find(m => m.id === id); }
  function lmsMateriasDe(programa, semestre) {
    return MATERIAS.filter(m => m.programa === programa && (semestre ? m.semestre === semestre : true));
  }
  function lmsMateriasDocente(personaId) { return MATERIAS.filter(m => m.docente === personaId); }
  function lmsDetalle(id) { return CURSO_DETALLE[id] || null; }
  function lmsRecurso(materiaId, recursoId) {
    const d = CURSO_DETALLE[materiaId]; if (!d) return null;
    for (const u of d.unidades) { const r = u.recursos.find(x => x.id === recursoId); if (r) return r; }
    return null;
  }
  function lmsEval(id) { return EVALUACIONES[id] || null; }
  function lmsForo(id) { return FOROS[id] || null; }
  function lmsEntregasDe(evalId) { return ENTREGAS.filter(e => e.evaluacion === evalId); }
  function lmsEstudiante(id) { return ESTUDIANTES.find(e => e.id === id); }

  DB.LMS = {
    CONFIG, PROGRAMAS, MALLA, MATERIAS, CURSO_DETALLE, EVALUACIONES, ENTREGAS,
    ESTUDIANTES, FINANZAS, CARTERA, MATRICULA, FOROS, ANUNCIOS, MENSAJES,
    CALENDARIO, PROGRESO, ANALITICA, SECCIONES
  };
  Object.assign(DB, {
    lmsPrograma, lmsMateria, lmsMateriasDe, lmsMateriasDocente, lmsDetalle,
    lmsRecurso, lmsEval, lmsForo, lmsEntregasDe, lmsEstudiante
  });
})();
