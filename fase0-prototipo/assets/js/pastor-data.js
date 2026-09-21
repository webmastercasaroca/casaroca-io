/* ============================================================
   CASA ROCA · DATOS + STORE de la APP DEL PASTOR CONGREGACIONAL
   Capa 3 (Pastor de iglesia local). Demo: sede madre Bogotá Chicó,
   pastor Camilo Restrepo (p_camilo).

   El pastor ve TODA su sede: los ~16 ministerios (congregacionales +
   operativos), con personas detalladas, grupos, equipo, finanzas,
   organigrama, calendario, peticiones, temáticas, requerimientos a la
   administración central y un directorio de las 36 iglesias.

   SINCRONIZACIÓN: el ministerio J+25 NO se inventa aquí: se lee EN VIVO
   de window.DIRECTOR/window.DSTORE (lo que edita el director) y
   window.STORE (inscritos del landing/líder). Así, si el director
   reasigna un líder, edita el organigrama o crea un evento, el pastor lo
   ve al instante. Los demás ministerios llevan rosters detallados
   generados de forma determinista en este archivo.

   Expone: window.PASTOR (constantes/seed + getters) y window.PSTORE
   (estado editable persistente en localStorage). En Fase 1 se reemplaza
   por Supabase manteniendo la interfaz pública.
   ============================================================ */
(function () {
  "use strict";

  const SEDE_ID = "bogota";
  const SEDE = { id: SEDE_ID, nombre: "Bogotá Chicó", ciudad: "Bogotá", pais: "Colombia", esMadre: true, asistentes: 1940 };

  const PASTOR_USER = {
    nombre: "Camilo Restrepo",
    email: "camilo@casaroca.org",
    telefono: "+57 310 555 0001",
    iniciales: "CR",
    rol: "Pastor Congregacional",
    sede: "Bogotá Chicó",
  };

  /* ---------- helpers de id determinista ---------- */
  let _seq = 0;
  function uid(pfx) { return pfx + "_" + (Date.now().toString(36)) + "_" + (++_seq); }
  function deaccent(s) { return String(s).normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function correoDe(nombres, apellidos, dom) {
    return deaccent(nombres.split(" ")[0]).toLowerCase() + "." + deaccent(apellidos.split(" ")[0]).toLowerCase() + (dom || "@email.com");
  }

  /* ============================================================
     POOLS de nombres para generar rosters realistas y deterministas.
     ============================================================ */
  const NOM_F = ["María", "Laura", "Valentina", "Daniela", "Camila", "Sara", "Andrea", "Paula", "Natalia", "Carolina",
    "Juliana", "Mariana", "Catalina", "Manuela", "Sofía", "Lucía", "Diana", "Ángela", "Tatiana", "Adriana",
    "Verónica", "Alejandra", "Lorena", "Ximena", "Paola", "Marcela", "Liliana", "Sandra", "Patricia", "Rocío"];
  const NOM_M = ["Juan", "Santiago", "Andrés", "Sebastián", "Mateo", "Daniel", "Felipe", "Carlos", "David", "Camilo",
    "Nicolás", "Samuel", "Tomás", "Diego", "Esteban", "Julián", "Ricardo", "Gabriel", "Óscar", "Hernán",
    "Mauricio", "Iván", "Cristian", "Jorge", "Sergio", "Emilio", "Joaquín", "Gustavo", "Hernando", "Pedro"];
  const APE = ["Garzón", "López", "Mejía", "Rodríguez", "Gómez", "Ramírez", "Torres", "Castro", "Beltrán", "Ríos",
    "Vargas", "Salazar", "Quintero", "Pardo", "Ariza", "Robles", "Mora", "Vélez", "Ospina", "Acosta",
    "Cárdenas", "Niño", "Suárez", "Rincón", "Cano", "Reyes", "Marín", "Naranjo", "Cruz", "Vega",
    "Aguilar", "Mendoza", "Trujillo", "Rojas", "Caicedo", "Ferro", "Camargo", "Gil", "Pinzón", "Duarte"];
  const FUENTES = ["Invitado por un amigo", "QR en la sede", "Redes sociales", "Vino solo un domingo", "Recomendado por su jefe", "Conexión por Instagram", "Invitado por su pareja", "Formulario 'Soy nuevo'", "Evangelismo en la U"];
  const FECHAS = ["2025-09-14", "2025-11-02", "2026-01-12", "2026-02-08", "2026-02-24", "2026-03-10", "2026-03-29", "2026-04-14", "2026-04-30", "2026-05-09", "2026-05-21", "2026-06-02", "2026-06-09", "2026-06-13"];
  const ETAPA_POOL = ["conoce", "conoce", "conecta", "conecta", "crece", "crece", "sirve"];
  const CURSOS_POR_ETAPA = { conoce: [], conecta: ["adn"], crece: ["adn", "madurez"], sirve: ["adn", "bautizo", "madurez"] };

  /* Genera N personas deterministas para un ministerio.
     cfg: { genBias("F"|"M"|"mix"), edadBase, edadSpan, prefix, start, grupos:[{nombre,sub}] }
     Cada persona: datos completos + diezma sí/no (sin monto: el monto por
     persona solo lo ve la Dirección General). */
  function genRoster(min, n) {
    const out = [];
    const grupos = min._grupos || [];
    for (let i = 0; i < n; i++) {
      let genero;
      if (min.genBias === "F") genero = "F";
      else if (min.genBias === "M") genero = "M";
      else genero = (i % 2 === 0) ? "F" : "M";
      const nombres = (genero === "F" ? NOM_F : NOM_M)[(i * 7 + min._k) % 30];
      const apellidos = APE[(i * 13 + min._k * 3) % APE.length];
      const etapa = ETAPA_POOL[(i * 3 + min._k + 1) % ETAPA_POOL.length];
      const ecF = ["Soltera", "Soltera", "Casada", "Unión libre", "Viuda"];
      const ecM = ["Soltero", "Soltero", "Casado", "Unión libre", "Viudo"];
      const estadoCivil = (genero === "F" ? ecF : ecM)[(i + min._k) % 5];
      const edad = min.edadBase + ((i * 5 + 3) % (min.edadSpan || 14));
      const grupo = grupos.length ? grupos[i % grupos.length] : { nombre: min.nombre, sub: "" };
      // diezma: más probable a mayor madurez (sembrado determinista, no por monto)
      const diezmaScore = (etapa === "sirve" ? 3 : etapa === "crece" ? 2 : etapa === "conecta" ? 1 : 0) + ((i * 17 + min._k) % 3);
      const diezma = diezmaScore >= 3;
      const sirve = etapa === "sirve" || (etapa === "crece" && (i % 3 === 0));
      out.push({
        id: uid("per"),
        nombres, apellidos, genero,
        correo: correoDe(nombres, apellidos),
        telefono: `+57 ${min.prefix} 555 ${String((min.start || 1000) + i).padStart(4, "0")}`,
        edad, etapa, estadoCivil,
        cumpleMes: ((i * 7 + min._k * 2 + 2) % 12) + 1,
        cumpleDia: ((i * 13 + 5) % 27) + 1,
        fechaInscripcion: FECHAS[(i * 4 + 3 + min._k) % FECHAS.length],
        fuente: FUENTES[(i * 2 + 1 + min._k) % FUENTES.length],
        cursos: CURSOS_POR_ETAPA[etapa].slice(),
        contactado: (i % 6 !== 0),
        sirve,
        diezma,
        diezmaFrecuencia: diezma ? (["Mensual", "Quincenal", "Cada domingo", "Ocasional"][(i + min._k) % 4]) : null,
        ultimoDiezmoMonto: diezma ? (50000 + ((i * 37 + min._k * 13) % 30) * 10000) : 0,
        ultimoDiezmoFecha: diezma ? FECHAS[(i * 3 + min._k) % FECHAS.length] : null,
        grupo: grupo.nombre,
        sub: grupo.sub || "",
        ministerioId: min.id,
        ministerio: min.nombre,
      });
    }
    return out;
  }

  /* ============================================================
     CATÁLOGO DE MINISTERIOS de la sede (congregacionales + operativos).
     J+25 es liveDirector:true → su detalle se obtiene del director.
     _grupos: grupos pequeños / equipos del ministerio (líderes reales
     para el organigrama, grupos pequeños, equipo y directorio).
     ============================================================ */
  function L(nombre, tel, email) { return { nombre, tel, email }; }

  const MIN_DEFS = [
    /* ---- CONGREGACIONALES ---- */
    {
      id: "m_rocakids", nombre: "RocaKids", tipo: "congregacional", ico: "🧒", color: "var(--etapa-conecta)",
      desc: "Niños de 0 a 10 años, con protección reforzada y código de entrega.",
      director: L("Marcela Díaz", "+57 312 555 0210", "marcela@casaroca.org"),
      genBias: "mix", edadBase: 1, edadSpan: 10, prefix: "312", start: 5100, n: 30, tamano: 138,
      subsDef: [
        { id: "bebes", nombre: "Bebés", rango: "1–2 años" },
        { id: "pequenos", nombre: "Pequeños", rango: "3–5 años" },
        { id: "explora", nombre: "Exploradores", rango: "6–7 años" },
        { id: "aventura", nombre: "Aventureros", rango: "8–10 años" },
      ],
      _grupos: [
        { nombre: "RocaKids · Bebés", sub: "Bebés", lider: L("Sofía Lara", "+57 312 555 8890", "sofia.lara@email.com"), dia: "Domingo", hora: "10:00 am", cupo: 24, zona: "Salón 1" },
        { nombre: "RocaKids · Pequeños", sub: "Pequeños", lider: L("Carolina Ruiz", "+57 313 555 8891", "carolina.ruiz@email.com"), dia: "Domingo", hora: "10:00 am", cupo: 30, zona: "Salón 2" },
        { nombre: "RocaKids · Exploradores", sub: "Exploradores", lider: L("Andrés Cano", "+57 314 555 8892", "andres.cano@email.com"), dia: "Domingo", hora: "10:00 am", cupo: 30, zona: "Salón 3" },
        { nombre: "RocaKids · Aventureros", sub: "Aventureros", lider: L("Diana Soto", "+57 315 555 8893", "diana.soto@email.com"), dia: "Domingo", hora: "10:00 am", cupo: 36, zona: "Auditorio kids" },
      ],
    },
    {
      id: "m_tmt", nombre: "tMt (11–25)", tipo: "congregacional", ico: "🎸", color: "var(--mostaza-500)",
      desc: "Jóvenes de 11 a 25 años, en tres franjas por afinidad.",
      director: L("Felipe Acosta", "+57 316 555 0220", "felipe.acosta@casaroca.org"),
      genBias: "mix", edadBase: 11, edadSpan: 14, prefix: "316", start: 5200, n: 40, tamano: 310,
      subsDef: [
        { id: "pulso", nombre: "Pulso", rango: "11–14 años" },
        { id: "eco", nombre: "Eco", rango: "15–18 años" },
        { id: "legado", nombre: "Legado", rango: "19–25 años" },
      ],
      _grupos: [
        { nombre: "Pulso Norte", sub: "Pulso", lider: L("Juan D. Páez", "+57 316 555 4401", "juan.paez@email.com"), dia: "Sábado", hora: "3:00 pm", cupo: 20, zona: "Chicó" },
        { nombre: "Eco Colegios", sub: "Eco", lider: L("Valeria Sánchez", "+57 316 555 4402", "valeria.sanchez@email.com"), dia: "Viernes", hora: "6:00 pm", cupo: 25, zona: "Norte" },
        { nombre: "Legado Universitarios", sub: "Legado", lider: L("Mateo Cano", "+57 316 555 4403", "mateo.cano@email.com"), dia: "Viernes", hora: "6:30 pm", cupo: 25, zona: "Norte" },
        { nombre: "Eco Música", sub: "Eco", lider: L("Samuel Niño", "+57 316 555 4404", "samuel.nino@email.com"), dia: "Viernes", hora: "7:30 pm", cupo: 20, zona: "Centro" },
      ],
    },
    {
      id: "m_j25", nombre: "J+25", tipo: "congregacional", ico: "🌱", color: "var(--etapa-crece)",
      desc: "Jóvenes adultos de 26 a 35 años, por afinidad.",
      director: L("Andrés Lozano", "+57 318 555 0230", "andres.lozano@casaroca.org"),
      liveDirector: true, // detalle en vivo desde el director (DSTORE/STORE)
      genBias: "mix", edadBase: 26, edadSpan: 12, prefix: "318", start: 5300, n: 0, tamano: 240,
      subsDef: [],
      _grupos: [], // se obtienen del director
    },
    {
      id: "m_josues", nombre: "Josués", tipo: "congregacional", ico: "🧗", color: "var(--azul-500)",
      desc: "Adultos solteros de 35 a 55 años.",
      director: L("Ricardo Peña", "+57 319 555 0240", "ricardo.pena@casaroca.org"),
      genBias: "mix", edadBase: 36, edadSpan: 18, prefix: "319", start: 5400, n: 22, tamano: 96,
      subsDef: [],
      _grupos: [
        { nombre: "Josués Aventura", sub: "", lider: L("Ricardo Peña", "+57 319 555 0240", "ricardo.pena@email.com"), dia: "Sábado", hora: "8:00 am", cupo: 16, zona: "Norte" },
        { nombre: "Josués Propósito", sub: "", lider: L("Patricia León", "+57 319 555 6002", "patricia.leon@email.com"), dia: "Martes", hora: "7:00 pm", cupo: 14, zona: "Centro" },
      ],
    },
    {
      id: "m_casa2", nombre: "Casa2", tipo: "congregacional", ico: "💍", color: "var(--mostaza-300)",
      desc: "Matrimonios y parejas, por temporada de vida.",
      director: L("Jaime y Clara Ø", "+57 320 555 0250", "casa2@casaroca.org"),
      genBias: "mix", edadBase: 28, edadSpan: 30, prefix: "320", start: 5500, n: 34, tamano: 188,
      subsDef: [
        { id: "sinhijos", nombre: "Sin hijos", rango: "Recién casados" },
        { id: "conhijos", nombre: "Con hijos", rango: "Familias" },
        { id: "jr", nombre: "Jr", rango: "Matrimonios jóvenes" },
        { id: "sr", nombre: "Sr", rango: "Matrimonios mayores" },
      ],
      _grupos: [
        { nombre: "Casa2 · Recién Casados", sub: "Sin hijos", lider: L("Sergio y Laura Bernal", "+57 320 555 5501", "bernal@email.com"), dia: "Viernes", hora: "7:30 pm", cupo: 14, zona: "Norte" },
        { nombre: "Casa2 · Con hijos", sub: "Con hijos", lider: L("David y Ángela Cuéllar", "+57 320 555 5502", "cuellar@email.com"), dia: "Sábado", hora: "5:00 pm", cupo: 16, zona: "Chicó" },
        { nombre: "Casa2 · Jr", sub: "Jr", lider: L("Andrés y Tatiana Forero", "+57 320 555 5503", "forero@email.com"), dia: "Domingo", hora: "4:00 pm", cupo: 16, zona: "Centro" },
        { nombre: "Casa2 · Sr", sub: "Sr", lider: L("Jorge y Carolina Pineda", "+57 320 555 5504", "pineda@email.com"), dia: "Martes", hora: "7:00 pm", cupo: 14, zona: "Norte" },
      ],
    },
    {
      id: "m_dorados", nombre: "Años Dorados", tipo: "congregacional", ico: "🌅", color: "var(--mostaza-500)",
      desc: "Adultos mayores, comunidad y propósito.",
      director: L("Esperanza Díaz", "+57 300 555 0260", "dorados@casaroca.org"),
      genBias: "mix", edadBase: 58, edadSpan: 28, prefix: "300", start: 5600, n: 18, tamano: 74,
      subsDef: [],
      _grupos: [
        { nombre: "Dorados · Encuentro", sub: "", lider: L("Esperanza Díaz", "+57 300 555 6677", "esperanza.diaz@email.com"), dia: "Miércoles", hora: "9:00 am", cupo: 30, zona: "Salón 2" },
        { nombre: "Dorados · Manos a la obra", sub: "", lider: L("Gabriel Ferro", "+57 300 555 6678", "gabriel.ferro@email.com"), dia: "Viernes", hora: "9:00 am", cupo: 24, zona: "Comedor" },
      ],
    },
    {
      id: "m_mujer", nombre: "Mujer Integral", tipo: "congregacional", ico: "🌷", color: "var(--etapa-conecta)",
      desc: "Mujeres, por afinidad y temporada de vida.",
      director: L("Natalia Cruz", "+57 321 555 0270", "natalia.cruz@casaroca.org"),
      genBias: "F", edadBase: 24, edadSpan: 34, prefix: "321", start: 5700, n: 36, tamano: 220,
      subsDef: [],
      _grupos: [
        { nombre: "Mujer · Centro", sub: "", lider: L("Marta López", "+57 321 555 1100", "marta.lopez@email.com"), dia: "Miércoles", hora: "9:00 am", cupo: 16, zona: "Centro" },
        { nombre: "Mujer · Profesionales", sub: "", lider: L("Natalia Cruz", "+57 321 555 1101", "natalia.cruz@email.com"), dia: "Jueves", hora: "7:00 pm", cupo: 18, zona: "Norte" },
        { nombre: "Mujer · Jóvenes mamás", sub: "", lider: L("Carolina Ruiz", "+57 321 555 1102", "carolina.ruiz2@email.com"), dia: "Martes", hora: "9:30 am", cupo: 15, zona: "Occidente" },
      ],
    },
    {
      id: "m_hombres", nombre: "Hombres de Bien", tipo: "congregacional", ico: "🛡️", color: "var(--azul-600)",
      desc: "Hombres, carácter, propósito y servicio.",
      director: L("Óscar Tovar", "+57 313 555 0280", "hombres@casaroca.org"),
      genBias: "M", edadBase: 26, edadSpan: 32, prefix: "313", start: 5800, n: 28, tamano: 165,
      subsDef: [],
      _grupos: [
        { nombre: "Hombres · Forjados", sub: "", lider: L("Óscar Tovar", "+57 313 555 3321", "oscar.tovar@email.com"), dia: "Sábado", hora: "7:00 am", cupo: 20, zona: "Norte" },
        { nombre: "Hombres · Mentores", sub: "", lider: L("Hernán Gómez", "+57 313 555 3322", "hernan.gomez@email.com"), dia: "Miércoles", hora: "6:30 am", cupo: 16, zona: "Centro" },
      ],
    },
    {
      id: "m_amec", nombre: "AMEC", tipo: "congregacional", ico: "🩺", color: "var(--etapa-crece)",
      desc: "Profesionales de la salud — Asociación Médica Evangélica.",
      director: L("Dra. Patricia Mora", "+57 317 555 0290", "amec@casaroca.org"),
      genBias: "mix", edadBase: 28, edadSpan: 30, prefix: "317", start: 5900, n: 16, tamano: 58,
      subsDef: [],
      _grupos: [
        { nombre: "AMEC · Profesionales", sub: "", lider: L("Dra. Patricia Mora", "+57 317 555 2900", "patricia.mora@email.com"), dia: "Jueves", hora: "7:00 pm", cupo: 20, zona: "Salón 3" },
      ],
    },
    {
      id: "m_centuriones", nombre: "Centuriones", tipo: "congregacional", ico: "🎖️", color: "var(--azul-800)",
      desc: "Militares y policía — fe, honor y familia.",
      director: L("Cap. Iván Rojas", "+57 311 555 0300", "centuriones@casaroca.org"),
      genBias: "M", edadBase: 24, edadSpan: 28, prefix: "311", start: 6000, n: 14, tamano: 46,
      subsDef: [],
      _grupos: [
        { nombre: "Centuriones · Activos", sub: "", lider: L("Cap. Iván Rojas", "+57 311 555 3000", "ivan.rojas@email.com"), dia: "Sábado", hora: "4:00 pm", cupo: 18, zona: "Salón 1" },
      ],
    },
    {
      id: "m_ejecutivos", nombre: "Ejecutivos y Empresarios", tipo: "congregacional", ico: "💼", color: "var(--azul-500)",
      desc: "Empresarios y líderes de organizaciones.",
      director: L("Roberto Salcedo", "+57 322 555 0310", "ejecutivos@casaroca.org"),
      genBias: "mix", edadBase: 32, edadSpan: 28, prefix: "322", start: 6100, n: 18, tamano: 72,
      subsDef: [],
      _grupos: [
        { nombre: "Ejecutivos · Desayuno", sub: "", lider: L("Roberto Salcedo", "+57 322 555 3100", "roberto.salcedo@email.com"), dia: "Martes", hora: "7:00 am", cupo: 22, zona: "Café Roca" },
        { nombre: "Empresarios · Reino y mercado", sub: "", lider: L("Claudia Bernal", "+57 322 555 3101", "claudia.bernal@email.com"), dia: "Jueves", hora: "7:30 am", cupo: 18, zona: "Norte" },
      ],
    },
    /* ---- OPERATIVOS (equipos de servicio del domingo) ---- */
    {
      id: "o_alabanza", nombre: "Alabanza", tipo: "operativo", ico: "🎤", color: "var(--mostaza-500)",
      desc: "Equipo de adoración y música.",
      director: L("Andrés Pardo", "+57 318 555 0400", "alabanza@casaroca.org"),
      genBias: "mix", edadBase: 19, edadSpan: 22, prefix: "318", start: 6200, n: 20, tamano: 32, todosSirven: true,
      subsDef: [],
      _grupos: [
        { nombre: "Banda principal", sub: "", lider: L("Andrés Pardo", "+57 318 555 4000", "andres.pardo2@email.com"), dia: "Domingo", hora: "7:00 am", cupo: 14, zona: "Tarima" },
        { nombre: "Coro y voces", sub: "", lider: L("Daniela Acosta", "+57 318 555 4001", "daniela.acosta2@email.com"), dia: "Jueves", hora: "7:00 pm", cupo: 18, zona: "Salón música" },
      ],
    },
    {
      id: "o_visa", nombre: "VISA (técnica)", tipo: "operativo", ico: "🎚️", color: "var(--azul-600)",
      desc: "Sonido, video, transmisión y luces.",
      director: L("Tomás Giraldo", "+57 320 555 0410", "visa@casaroca.org"),
      genBias: "M", edadBase: 20, edadSpan: 24, prefix: "320", start: 6300, n: 16, tamano: 26, todosSirven: true,
      subsDef: [],
      _grupos: [
        { nombre: "Sonido", sub: "", lider: L("Tomás Giraldo", "+57 320 555 4100", "tomas.giraldo2@email.com"), dia: "Domingo", hora: "6:30 am", cupo: 8, zona: "Cabina" },
        { nombre: "Video & streaming", sub: "", lider: L("Mauricio Gallego", "+57 320 555 4101", "mauricio.gallego@email.com"), dia: "Domingo", hora: "6:30 am", cupo: 10, zona: "Cabina" },
      ],
    },
    {
      id: "o_ujieres", nombre: "Ujieres", tipo: "operativo", ico: "🤝", color: "var(--etapa-conecta)",
      desc: "Bienvenida, orden y cuidado del servicio.",
      director: L("Patricia León", "+57 319 555 0420", "ujieres@casaroca.org"),
      genBias: "mix", edadBase: 22, edadSpan: 40, prefix: "319", start: 6400, n: 24, tamano: 48, todosSirven: true,
      subsDef: [],
      _grupos: [
        { nombre: "Bienvenida", sub: "", lider: L("Patricia León", "+57 319 555 4200", "patricia.leon2@email.com"), dia: "Domingo", hora: "7:00 am", cupo: 20, zona: "Entrada" },
        { nombre: "Orden y seguridad", sub: "", lider: L("Gustavo Mejía", "+57 319 555 4201", "gustavo.mejia@email.com"), dia: "Domingo", hora: "7:00 am", cupo: 16, zona: "Auditorio" },
      ],
    },
    {
      id: "o_creativo", nombre: "Creativo", tipo: "operativo", ico: "🎨", color: "var(--etapa-crece)",
      desc: "Diseño, redes, foto y contenido.",
      director: L("Camila Ariza", "+57 311 555 0430", "creativo@casaroca.org"),
      genBias: "mix", edadBase: 19, edadSpan: 20, prefix: "311", start: 6500, n: 14, tamano: 22, todosSirven: true,
      subsDef: [],
      _grupos: [
        { nombre: "Diseño & redes", sub: "", lider: L("Camila Ariza", "+57 311 555 4300", "camila.ariza2@email.com"), dia: "Lunes", hora: "6:00 pm", cupo: 12, zona: "Estudio" },
        { nombre: "Foto & video", sub: "", lider: L("Samuel Reyes", "+57 311 555 4301", "samuel.reyes@email.com"), dia: "Domingo", hora: "8:00 am", cupo: 10, zona: "Sede" },
      ],
    },
    {
      // Equipo transversal de oración. Recibe y cubre las peticiones de TODA la
      // sede (congregación + equipos). Vive en la pestaña "Oración".
      id: "o_oracion", nombre: "Oración", tipo: "operativo", ico: "🕊️", color: "var(--azul-500)",
      desc: "Equipo de oración e intercesión: recibe y cubre las peticiones de toda la sede.",
      director: L("Esther Camargo", "+57 317 555 0440", "intercesion@casaroca.org"),
      genBias: "mix", edadBase: 30, edadSpan: 38, prefix: "317", start: 6600, n: 18, tamano: 28, todosSirven: true,
      subsDef: [],
      _grupos: [
        { nombre: "Cadena de oración 24/7", sub: "", lider: L("Esther Camargo", "+57 317 555 4400", "esther.camargo2@email.com"), dia: "Todos los días", hora: "Por turnos", cupo: 24, zona: "Remoto / Capilla" },
        { nombre: "Intercesión del servicio", sub: "", lider: L("Rubén Páez", "+57 317 555 4401", "ruben.paez@email.com"), dia: "Domingo", hora: "6:00 am", cupo: 16, zona: "Capilla" },
        { nombre: "Vigilias", sub: "", lider: L("Gloria Niño", "+57 317 555 4402", "gloria.nino@email.com"), dia: "Viernes", hora: "8:00 pm", cupo: 30, zona: "Auditorio" },
      ],
    },
  ];

  // Adjunta clave determinista y genera rosters (J+25 queda vacío: vive en el director)
  MIN_DEFS.forEach((m, k) => {
    m._k = k + 1;
    if (m.liveDirector) { m._roster = []; }
    else {
      // si el ministerio dice todosSirven, marcamos sirve=true tras generar
      m._roster = genRoster(m, m.n);
      if (m.todosSirven) m._roster.forEach(p => { p.sirve = true; if (p.etapa === "conoce") p.etapa = "conecta"; });
    }
  });

  /* ============================================================
     ESPACIOS físicos reservables de la sede.
     ============================================================ */
  const ESPACIOS = [
    { id: "esp_aud", nombre: "Auditorio principal", capacidad: 900, ico: "⛪" },
    { id: "esp_audk", nombre: "Auditorio kids", capacidad: 140, ico: "🧒" },
    { id: "esp_s1", nombre: "Salón 1", capacidad: 60, ico: "🚪" },
    { id: "esp_s2", nombre: "Salón 2", capacidad: 60, ico: "🚪" },
    { id: "esp_s3", nombre: "Salón 3", capacidad: 40, ico: "🚪" },
    { id: "esp_cafe", nombre: "Café Roca", capacidad: 50, ico: "☕" },
    { id: "esp_comedor", nombre: "Comedor", capacidad: 120, ico: "🍽️" },
    { id: "esp_aire", nombre: "Zona al aire libre", capacidad: 200, ico: "🌳" },
  ];

  /* ============================================================
     FINANZAS de la sede (agregados — el detalle por persona del diezmo
     es exclusivo de la Dirección General; aquí solo totales).
     ============================================================ */
  const FINANZAS = {
    moneda: "COP",
    // diezmos + ofrendas reportados por domingo (millones COP)
    ingresosDomingo: [
      { f: "20 abr", diezmos: 41.2, ofrendas: 9.1 },
      { f: "27 abr", diezmos: 44.8, ofrendas: 8.4 },
      { f: "4 may", diezmos: 39.5, ofrendas: 10.2 },
      { f: "11 may", diezmos: 47.1, ofrendas: 9.7 },
      { f: "18 may", diezmos: 43.9, ofrendas: 8.9 },
      { f: "25 may", diezmos: 50.3, ofrendas: 11.4 },
      { f: "1 jun", diezmos: 46.0, ofrendas: 9.5 },
      { f: "8 jun", diezmos: 52.6, ofrendas: 12.1 },
    ],
    // presupuesto mensual por ministerio (asignado vs ejecutado, millones COP)
    presupuestoMin: [
      { min: "RocaKids", asignado: 9.0, ejecutado: 7.8 },
      { min: "tMt (11–25)", asignado: 12.0, ejecutado: 11.2 },
      { min: "J+25", asignado: 8.0, ejecutado: 6.4 },
      { min: "Casa2", asignado: 7.0, ejecutado: 5.9 },
      { min: "Mujer Integral", asignado: 6.5, ejecutado: 6.1 },
      { min: "Hombres de Bien", asignado: 5.0, ejecutado: 4.2 },
      { min: "Años Dorados", asignado: 4.0, ejecutado: 3.5 },
      { min: "Josués", asignado: 3.5, ejecutado: 2.8 },
      { min: "AMEC", asignado: 2.5, ejecutado: 1.9 },
      { min: "Centuriones", asignado: 2.0, ejecutado: 1.4 },
      { min: "Ejecutivos", asignado: 3.0, ejecutado: 2.2 },
    ],
    // gastos de servicios / operación discriminados (millones COP / mes)
    gastosServicios: [
      { rubro: "Arriendo y mantenimiento sede", min: "General", monto: 28.0 },
      { rubro: "Energía, agua, internet", min: "General", monto: 9.5 },
      { rubro: "Sonido, video y streaming", min: "VISA", monto: 6.2 },
      { rubro: "Alabanza (equipos e insumos)", min: "Alabanza", monto: 4.1 },
      { rubro: "Material RocaKids", min: "RocaKids", monto: 3.4 },
      { rubro: "Café y logística domingos", min: "Ujieres", monto: 2.8 },
      { rubro: "Diseño e impresión", min: "Creativo", monto: 2.1 },
      { rubro: "Nómina equipo local", min: "Talento Humano", monto: 34.0 },
    ],
    // ahorro / fondos
    ahorro: {
      saldo: 312.5, // millones COP
      metaMensual: 18.0,
      aporteMes: 21.4,
      fondos: [
        { nombre: "Fondo de imprevistos", saldo: 96.0 },
        { nombre: "Fondo de construcción", saldo: 158.0 },
        { nombre: "Fondo de misiones", saldo: 41.5 },
        { nombre: "Fondo Fundación M.A.S", saldo: 17.0 },
      ],
    },
    // proyectos en curso (presupuesto vs recaudado, millones COP).
    // Cada proyecto trae sus GASTOS PREVISTOS discriminados (suman al presupuesto
    // total) y las FACTURAS adjuntas a cada gasto. Estados de gasto: Pagado / Pendiente / Cotizado.
    proyectos: [
      {
        id: "proy_kids", nombre: "Remodelación auditorio kids", presupuesto: 120.0, recaudado: 78.0,
        estado: "En curso", fecha: "2026-09",
        responsable: "Equipo de Construcción · Casa Roca",
        descripcion: "Adecuación integral del auditorio de RocaKids: obra, mobiliario seguro y experiencia para niños.",
        gastos: [
          { id: "g_kids_1", concepto: "Obra civil y adecuación del salón", monto: 45.0, estado: "Pagado" },
          { id: "g_kids_2", concepto: "Mobiliario infantil (mesas, sillas, repisas)", monto: 25.0, estado: "Pendiente" },
          { id: "g_kids_3", concepto: "Piso de caucho de seguridad", monto: 18.0, estado: "Pendiente" },
          { id: "g_kids_4", concepto: "Iluminación y red eléctrica", monto: 12.0, estado: "Cotizado" },
          { id: "g_kids_5", concepto: "Pintura y mural temático", monto: 12.0, estado: "Pendiente" },
          { id: "g_kids_6", concepto: "Sonido y video del salón", monto: 8.0, estado: "Cotizado" },
        ],
        facturas: [
          { id: "f_kids_1", gastoId: "g_kids_1", proveedor: "Construcciones BdelV S.A.S", numero: "FV-2041", monto: 45.0, fecha: "2026-05-12", archivo: "FV-2041_obra_civil.pdf" },
          { id: "f_kids_2", gastoId: "g_kids_2", proveedor: "Muebles Pequeños Ltda.", numero: "FE-0188", monto: 10.0, fecha: "2026-06-03", archivo: "FE-0188_anticipo_mobiliario.pdf" },
        ],
      },
      {
        id: "proy_sonido", nombre: "Nuevo sistema de sonido", presupuesto: 65.0, recaudado: 65.0,
        estado: "Financiado", fecha: "2026-07",
        responsable: "Equipo VISA (técnica y sonido)",
        descripcion: "Renovación completa del sistema de audio del templo principal.",
        gastos: [
          { id: "g_son_1", concepto: "Consola digital", monto: 22.0, estado: "Pagado" },
          { id: "g_son_2", concepto: "Cajas line-array", monto: 20.0, estado: "Pagado" },
          { id: "g_son_3", concepto: "Microfonía inalámbrica", monto: 9.0, estado: "Pendiente" },
          { id: "g_son_4", concepto: "Monitores de piso", monto: 7.0, estado: "Pendiente" },
          { id: "g_son_5", concepto: "Cableado e instalación", monto: 7.0, estado: "Cotizado" },
        ],
        facturas: [
          { id: "f_son_1", gastoId: "g_son_1", proveedor: "AudioPro Colombia", numero: "FV-7711", monto: 22.0, fecha: "2026-04-20", archivo: "FV-7711_consola.pdf" },
          { id: "f_son_2", gastoId: "g_son_2", proveedor: "AudioPro Colombia", numero: "FV-7740", monto: 20.0, fecha: "2026-05-08", archivo: "FV-7740_line_array.pdf" },
        ],
      },
      {
        id: "proy_navidad", nombre: "Campaña Navidad solidaria", presupuesto: 40.0, recaudado: 12.0,
        estado: "Recaudando", fecha: "2026-12",
        responsable: "Fundación M.A.S · Acción social",
        descripcion: "Mercados, regalos y eventos para familias vulnerables en Navidad.",
        gastos: [
          { id: "g_nav_1", concepto: "Mercados navideños (400 familias)", monto: 24.0, estado: "Cotizado" },
          { id: "g_nav_2", concepto: "Regalos para niños", monto: 9.0, estado: "Cotizado" },
          { id: "g_nav_3", concepto: "Logística y transporte", monto: 4.0, estado: "Pendiente" },
          { id: "g_nav_4", concepto: "Decoración y evento", monto: 3.0, estado: "Pendiente" },
        ],
        facturas: [],
      },
      {
        id: "proy_sur", nombre: "Plantación sede Sur", presupuesto: 220.0, recaudado: 54.0,
        estado: "Recaudando", fecha: "2027-03",
        responsable: "Pastoral de expansión",
        descripcion: "Apertura de una nueva sede en el sur de la ciudad: local, equipos y equipo pastoral.",
        gastos: [
          { id: "g_sur_1", concepto: "Arriendo y adecuación del local (12 meses)", monto: 96.0, estado: "Cotizado" },
          { id: "g_sur_2", concepto: "Sonido e iluminación", monto: 35.0, estado: "Cotizado" },
          { id: "g_sur_3", concepto: "Equipo pastoral inicial (6 meses)", monto: 30.0, estado: "Pendiente" },
          { id: "g_sur_4", concepto: "Sillas y mobiliario", monto: 28.0, estado: "Pendiente" },
          { id: "g_sur_5", concepto: "Equipo audiovisual y streaming", monto: 22.0, estado: "Cotizado" },
          { id: "g_sur_6", concepto: "Señalización y branding", monto: 9.0, estado: "Pendiente" },
        ],
        facturas: [],
      },
    ],
  };

  /* ============================================================
     REQUERIMIENTOS a la administración central (tipo Service desk).
     Equipos destino: Contabilidad, RRHH, Comunicaciones, Legal,
     Tesorería, Construcción.
     ============================================================ */
  const EQUIPOS_ADMIN = [
    { id: "contabilidad", nombre: "Contabilidad", ico: "📒", sla: "3 días hábiles", contacto: "Liliana Suárez", email: "contabilidad@casaroca.org" },
    { id: "rrhh", nombre: "Talento Humano (RRHH)", ico: "👥", sla: "2 días hábiles", contacto: "Sandra Quintero", email: "th@casaroca.org" },
    { id: "comunicaciones", nombre: "Comunicaciones", ico: "📣", sla: "2 días hábiles", contacto: "Camilo Mejía", email: "comunicaciones@casaroca.org" },
    { id: "legal", nombre: "Legal", ico: "⚖️", sla: "5 días hábiles", contacto: "Dra. Ángela Vega", email: "legal@casaroca.org" },
    { id: "tesoreria", nombre: "Tesorería", ico: "💵", sla: "2 días hábiles", contacto: "Jorge Méndez", email: "tesoreria@casaroca.org" },
    { id: "construccion", nombre: "Construcción", ico: "🏗️", sla: "7 días hábiles", contacto: "Ing. Hernán Gómez", email: "construccion@casaroca.org" },
  ];
  function req(equipo, asunto, descripcion, prioridad, estado, fecha, respuesta) {
    return { id: uid("req"), equipo, asunto, descripcion, prioridad, estado, fecha, respondidoEl: respuesta ? respuesta.fecha : null, respuestas: respuesta ? [respuesta] : [], autor: "Camilo Restrepo" };
  }
  const REQUERIMIENTOS = [
    req("construccion", "Filtración en el techo del Salón 2", "Hay una filtración sobre el cielo raso del Salón 2 que empeora con la lluvia. Afecta las clases de RocaKids del domingo.", "Alta", "En proceso", "2026-06-09",
      { de: "Construcción", fecha: "2026-06-10", texto: "Visita técnica programada para el 17 jun. Se llevará sellante provisional el domingo." }),
    req("contabilidad", "Conciliación de ofrendas mayo", "Solicito la conciliación de las ofrendas de mayo para cerrar el reporte de la sede.", "Media", "Resuelto", "2026-06-02",
      { de: "Contabilidad", fecha: "2026-06-05", texto: "Conciliación enviada al correo de la sede. Diferencia de $0. Adjunto soporte." }),
    req("comunicaciones", "Arte para campaña 'Soy nuevo'", "Necesitamos piezas para redes e impresos para reforzar la campaña de bienvenida a nuevos.", "Media", "Abierto", "2026-06-13", null),
    req("rrhh", "Contrato de nuevo auxiliar de logística", "Aprobado el ingreso de un auxiliar de logística para domingos. Solicito iniciar contratación.", "Media", "En proceso", "2026-06-11",
      { de: "Talento Humano", fecha: "2026-06-12", texto: "Recibido. Enviamos formato de requisición; falta firma del pastor." }),
    req("legal", "Revisión de convenio con colegio vecino", "Queremos usar el parqueadero del colegio los domingos. Requiero revisión del convenio.", "Baja", "Abierto", "2026-06-12", null),
    req("tesoreria", "Anticipo para retiro de Hombres de Bien", "Solicito anticipo de $4.000.000 para el retiro de Hombres de Bien del 5 jul.", "Alta", "Abierto", "2026-06-14", null),
  ];

  /* ============================================================
     DIRECTORIO — pastores de las 36 iglesias, equipo de la
     administración central y directores de ministerio. Solo lo ven
     los pastores. (Demo: subconjunto representativo + generador.)
     ============================================================ */
  const CIUDADES = ["Bogotá", "Medellín", "Cali", "Barranquilla", "Bucaramanga", "Pereira", "Cartagena", "Cúcuta", "Ibagué", "Manizales",
    "Villavicencio", "Santa Marta", "Neiva", "Armenia", "Pasto", "Montería", "Valledupar", "Popayán", "Tunja", "Sincelejo",
    "Miami", "Madrid", "Buenos Aires", "Ciudad de México", "Lima", "Santiago", "Quito", "Panamá", "Caracas", "São Paulo",
    "Houston", "Toronto", "Londres", "Sídney", "Orlando", "Bogotá Sur"];
  const SEDES_NOMBRE = ["Chicó", "Norte", "Sur", "Occidente", "Centro", "Poblado", "Sabana", "Internacional", "Chapinero", "Suba",
    "Kennedy", "Salitre", "Cedritos", "Usaquén", "Modelia", "Centro", "Laureles", "Granada", "El Prado", "La Flora",
    "Brickell", "Las Tablas", "Palermo", "Polanco", "Miraflores", "Providencia", "Cumbayá", "Costa del Este", "Las Mercedes", "Jardins",
    "Katy", "Mississauga", "Camden", "Bondi", "Lake Nona", "Sur"];
  function genPastores() {
    const out = [];
    for (let i = 0; i < 36; i++) {
      const genero = i % 4 === 0 ? "F" : "M";
      const nombres = (genero === "F" ? NOM_F : NOM_M)[(i * 5 + 2) % 30];
      const apellidos = APE[(i * 11 + 7) % APE.length] + " " + APE[(i * 3 + 13) % APE.length];
      const ciudad = CIUDADES[i];
      const iglesia = "Casa Roca · " + (SEDES_NOMBRE[i] || ciudad);
      out.push({
        id: "pas_" + i,
        tipo: "pastor",
        nombre: (genero === "F" ? "Pastora " : "Pastor ") + nombres + " " + apellidos,
        rol: i === 0 ? "Pastor Director General" : "Pastor Congregacional",
        iglesia: i === 0 ? "Casa Roca · Bogotá Chicó (sede madre)" : iglesia,
        ciudad,
        pais: i < 20 ? "Colombia" : "Internacional",
        telefono: `+57 ${300 + (i % 22)} 555 ${String(7000 + i).padStart(4, "0")}`,
        email: deaccent(nombres).toLowerCase() + "." + deaccent(apellidos.split(" ")[0]).toLowerCase() + "@casaroca.org",
        esMadre: i === 0,
      });
    }
    return out;
  }
  const DIR_ADMIN = [
    { id: "adm_dg", tipo: "admin", nombre: "Darío Mantilla", rol: "Pastor Director General", iglesia: "Dirección General", ciudad: "Bogotá", telefono: "+57 310 555 9000", email: "direccion@casaroca.org" },
    { id: "adm_cont", tipo: "admin", nombre: "Liliana Suárez", rol: "Jefe de Contabilidad", iglesia: "Contabilidad (corporativo)", ciudad: "Bogotá", telefono: "+57 311 555 9001", email: "contabilidad@casaroca.org" },
    { id: "adm_teso", tipo: "admin", nombre: "Jorge Méndez", rol: "Tesorero general", iglesia: "Tesorería", ciudad: "Bogotá", telefono: "+57 312 555 9002", email: "tesoreria@casaroca.org" },
    { id: "adm_th", tipo: "admin", nombre: "Sandra Quintero", rol: "Directora de Talento Humano", iglesia: "RRHH", ciudad: "Bogotá", telefono: "+57 313 555 9003", email: "th@casaroca.org" },
    { id: "adm_legal", tipo: "admin", nombre: "Dra. Ángela Vega", rol: "Directora Legal", iglesia: "Legal (corporativo)", ciudad: "Bogotá", telefono: "+57 314 555 9004", email: "legal@casaroca.org" },
    { id: "adm_comms", tipo: "admin", nombre: "Camilo Mejía", rol: "Director de Comunicaciones", iglesia: "Comunicaciones", ciudad: "Bogotá", telefono: "+57 315 555 9005", email: "comunicaciones@casaroca.org" },
    { id: "adm_tec", tipo: "admin", nombre: "Iván Restrepo", rol: "Director de Tecnología", iglesia: "Tecnología (corporativo)", ciudad: "Bogotá", telefono: "+57 316 555 9006", email: "tecnologia@casaroca.org" },
    { id: "adm_const", tipo: "admin", nombre: "Ing. Hernán Gómez", rol: "Director de Construcción", iglesia: "Construcción", ciudad: "Bogotá", telefono: "+57 317 555 9007", email: "construccion@casaroca.org" },
  ];

  /* ============================================================
     PETICIONES y TEMÁTICAS de la sede (no-J+25; J+25 viene del director).
     ============================================================ */
  function pet(autor, autorTipo, ministerio, texto, fecha, estado, interna, intercesion) { return { id: uid("pet"), autor, autorTipo, ministerio, texto, fecha, estado, interna: !!interna, intercesion: !!intercesion }; }
  const PETICIONES = [
    pet("Marta López", "lider", "Mujer Integral", "Por una hermana del grupo que recibió un diagnóstico difícil esta semana.", "2026-06-13", "abierta", false, true),
    pet("Felipe Acosta", "director", "tMt (11–25)", "Sabiduría para acompañar a los adolescentes de Eco en este tiempo de exámenes.", "2026-06-12", "orando"),
    pet("Óscar Tovar", "lider", "Hombres de Bien", "Provisión de empleo para tres hombres del grupo que están desempleados.", "2026-06-11", "abierta"),
    pet("Esperanza Díaz", "persona", "Años Dorados", "Salud para don Alberto, está hospitalizado.", "2026-06-10", "orando", false, true),
    pet("Natalia Cruz", "director", "Mujer Integral", "Por el retiro de mujeres del próximo mes, que sea de sanidad.", "2026-06-08", "abierta"),
    pet("Cap. Iván Rojas", "lider", "Centuriones", "Protección para los uniformados del grupo que están en zona de orden público.", "2026-06-07", "respondida"),
    // De los equipos operativos (no solo congregación)
    pet("Andrés Pardo", "director", "Alabanza", "Unidad y bendición sobre la banda y el coro de cara a la temporada de conciertos de adoración.", "2026-06-12", "orando", false, true),
    pet("Tomás Giraldo", "lider", "VISA (técnica)", "Provisión para renovar dos consolas de sonido que están fallando los domingos.", "2026-06-10", "abierta"),
    pet("Patricia León", "director", "Ujieres", "Fortaleza física y buen ánimo para el equipo de bienvenida en los tres servicios.", "2026-06-09", "abierta"),
    pet("Esther Camargo", "director", "Oración", "Por más intercesores que se sumen a la cadena 24/7 y por las vigilias del mes.", "2026-06-14", "orando", false, true),
    // Internas — confidenciales, solo entre pastores
    pet("Camilo Restrepo", "pastor", "Pastoral", "Por unidad y descanso del equipo pastoral de la sede en esta temporada de alta demanda.", "2026-06-14", "orando", true),
    pet("Pastor Director General", "pastor", "Red", "Dirección para la asignación de pastores en las dos filiales nuevas.", "2026-06-13", "abierta", true),
    pet("Camilo Restrepo", "pastor", "Pastoral", "Sabiduría en una situación delicada de un líder que requiere acompañamiento reservado.", "2026-06-11", "abierta", true),
  ];
  function tem(titulo, desc, tipo, ministerio, fecha, ico) { return { id: uid("tem"), titulo, desc, tipo, ministerio, fecha, ico }; }
  const TEMATICAS = [
    tem("Familias que permanecen", "Serie congregacional de 4 semanas sobre el hogar.", "Serie", "General", "2026-06-01", "🏠"),
    tem("Identidad en Cristo", "Material para nuevos, alineado con el curso ADN.", "Serie", "General", "2026-05-25", "📘"),
    tem("Finanzas con propósito", "Taller de mayordomía para adultos y parejas.", "Taller", "Casa2", "2026-06-08", "💰"),
    tem("Generación valiente", "Campaña juvenil para tMt y J+25.", "Campaña", "tMt (11–25)", "2026-06-05", "🔥"),
  ];

  /* ============================================================
     CONSEJERÍAS y AYUDAS M.A.S — para analítica del pastor (agregados).
     ============================================================ */
  const CONSEJERIAS = [
    { id: "cs_1", persona: "Laura Tobón", ministerio: "J+25", tipo: "Emocional", estado: "Activa", consejero: "Andrés Lozano", desde: "2026-05-20" },
    { id: "cs_2", persona: "Pedro Gil", ministerio: "Casa2", tipo: "Pareja", estado: "Activa", consejero: "Jaime Ø", desde: "2026-06-01" },
    { id: "cs_3", persona: "Sandra Q.", ministerio: "Mujer Integral", tipo: "Duelo", estado: "Activa", consejero: "Natalia Cruz", desde: "2026-06-05" },
    { id: "cs_4", persona: "Carlos B.", ministerio: "Hombres de Bien", tipo: "Espiritual", estado: "Activa", consejero: "Óscar Tovar", desde: "2026-06-08" },
    { id: "cs_5", persona: "Daniela R.", ministerio: "tMt (11–25)", tipo: "Familiar", estado: "Programada", consejero: "Felipe Acosta", desde: "2026-06-16" },
    { id: "cs_6", persona: "Gustavo M.", ministerio: "Josués", tipo: "Vocacional", estado: "Cerrada", consejero: "Ricardo Peña", desde: "2026-05-02" },
    { id: "cs_7", persona: "Valentina R.", ministerio: "J+25", tipo: "Espiritual", estado: "Activa", consejero: "Andrés Lozano", desde: "2026-06-09" },
  ];
  const AYUDAS_MAS = [
    { id: "ay_1", persona: "Familia Cardona", ministerio: "Casa2", tipo: "Mercado", estado: "Aprobada", monto: "Mercado mensual", fecha: "2026-06-10" },
    { id: "ay_2", persona: "Don Alberto", ministerio: "Años Dorados", tipo: "Salud", estado: "En estudio", monto: "Medicamentos", fecha: "2026-06-12" },
    { id: "ay_3", persona: "Joven de Eco", ministerio: "tMt (11–25)", tipo: "Educación", estado: "Aprobada", monto: "Útiles escolares", fecha: "2026-06-08" },
    { id: "ay_4", persona: "Madre soltera", ministerio: "Mujer Integral", tipo: "Arriendo", estado: "Aprobada", monto: "Apoyo arriendo", fecha: "2026-06-05" },
    { id: "ay_5", persona: "Desempleado HdB", ministerio: "Hombres de Bien", tipo: "Empleo", estado: "Gestionando", monto: "Conexión laboral", fecha: "2026-06-11" },
  ];

  /* ============================================================
     ASISTENCIA — últimos domingos por servicio (para analítica).
     ============================================================ */
  const ASISTENCIA = [
    { f: "20 abr", s1: 430, s2: 512, s3: 302 },
    { f: "27 abr", s1: 448, s2: 520, s3: 334 },
    { f: "4 may", s1: 440, s2: 506, s3: 334 },
    { f: "11 may", s1: 470, s2: 545, s3: 340 },
    { f: "18 may", s1: 452, s2: 522, s3: 324 },
    { f: "25 may", s1: 488, s2: 560, s3: 354 },
    { f: "1 jun", s1: 462, s2: 534, s3: 334 },
    { f: "8 jun", s1: 480, s2: 566, s3: 340 },
  ];

  /* ============================================================
     ORGANIGRAMA seed de la sede (árbol editable). El subárbol de J+25
     se inyecta en vivo desde el director (pastor.js lo arma).
     Nodo: { id, nombre, rol, parent } (parent=null => raíz).
     ============================================================ */
  const ORGANIGRAMA = [
    { id: "org_pastor", nombre: "Camilo Restrepo", rol: "Pastor Congregacional", parent: null },
    { id: "org_d_cong", nombre: "Camilo Restrepo", rol: "Dirección · Congregacionales", parent: "org_pastor" },
    { id: "org_d_oper", nombre: "David Quintero", rol: "Dirección · Operativos", parent: "org_pastor" },
    { id: "org_d_admin", nombre: "Jorge Méndez", rol: "Dirección · Administración local", parent: "org_pastor" },
    // congregacionales (un nodo por ministerio, bajo Dirección Congregacionales)
    { id: "org_m_rocakids", nombre: "Marcela Díaz", rol: "Director · RocaKids", parent: "org_d_cong" },
    { id: "org_m_tmt", nombre: "Felipe Acosta", rol: "Director · tMt", parent: "org_d_cong" },
    { id: "org_m_j25", nombre: "Andrés Lozano", rol: "Director · J+25", parent: "org_d_cong" },
    { id: "org_m_casa2", nombre: "Jaime Ø", rol: "Director · Casa2", parent: "org_d_cong" },
    { id: "org_m_mujer", nombre: "Natalia Cruz", rol: "Directora · Mujer Integral", parent: "org_d_cong" },
    { id: "org_m_hombres", nombre: "Óscar Tovar", rol: "Director · Hombres de Bien", parent: "org_d_cong" },
    { id: "org_m_dorados", nombre: "Esperanza Díaz", rol: "Directora · Años Dorados", parent: "org_d_cong" },
    { id: "org_m_josues", nombre: "Ricardo Peña", rol: "Director · Josués", parent: "org_d_cong" },
    // operativos (bajo Dirección Operativos)
    { id: "org_o_alabanza", nombre: "Andrés Pardo", rol: "Líder · Alabanza", parent: "org_d_oper" },
    { id: "org_o_visa", nombre: "Tomás Giraldo", rol: "Líder · VISA", parent: "org_d_oper" },
    { id: "org_o_ujieres", nombre: "Patricia León", rol: "Líder · Ujieres", parent: "org_d_oper" },
    { id: "org_o_creativo", nombre: "Camila Ariza", rol: "Líder · Creativo", parent: "org_d_oper" },
    // administración local
    { id: "org_a_teso", nombre: "Jorge Méndez", rol: "Tesorería local", parent: "org_d_admin" },
    { id: "org_a_th", nombre: "Sandra Quintero", rol: "Talento Humano", parent: "org_d_admin" },
    { id: "org_a_comms", nombre: "Camilo Mejía", rol: "Comunicaciones", parent: "org_d_admin" },
    { id: "org_a_cult", nombre: "Diana Soto", rol: "Cultura", parent: "org_d_admin" },
  ];

  /* ============================================================
     EVENTOS de la sede (calendario general). 'min' = ministerio que
     organiza. Los de J+25 se inyectan en vivo desde el director.
     ============================================================ */
  function ev(titulo, fecha, horaInicio, horaFin, espacioId, min, desc) { return { id: uid("ev"), titulo, fecha, horaInicio, horaFin, espacioId, min, desc }; }
  const EVENTOS = [
    ev("Servicio dominical (3 servicios)", "2026-06-21", "08:00", "13:30", "esp_aud", "General", "Cultos de las 8:00, 10:00 y 12:00."),
    ev("Reunión de líderes de grupo", "2026-06-16", "19:00", "21:00", "esp_s2", "General", "Encuentro mensual de líderes."),
    ev("Noche de Mujer Integral", "2026-06-18", "18:30", "21:00", "esp_aud", "Mujer Integral", "Evento del ministerio."),
    ev("Bautizos de julio (preparación)", "2026-06-20", "16:00", "18:00", "esp_s1", "General", "Charla pre-bautismo."),
    ev("Almuerzo Años Dorados", "2026-06-21", "13:00", "15:00", "esp_comedor", "Años Dorados", "Comunidad."),
    ev("Ensayo Alabanza", "2026-06-19", "19:00", "21:30", "esp_aud", "Alabanza", "Ensayo general del domingo."),
    ev("Retiro Hombres de Bien (logística)", "2026-06-17", "07:00", "08:30", "esp_s3", "Hombres de Bien", "Coordinación del retiro."),
    ev("Desayuno Ejecutivos", "2026-06-23", "07:00", "08:30", "esp_cafe", "Ejecutivos y Empresarios", "Reunión semanal."),
    ev("RocaKids · Clase maestros", "2026-06-20", "15:00", "16:30", "esp_audk", "RocaKids", "Capacitación de maestros."),
    ev("tMt · Noche de jóvenes", "2026-06-19", "18:00", "21:00", "esp_s2", "tMt (11–25)", "Pulso, Eco y Legado."),
    ev("Casa2 · Cena de parejas", "2026-06-20", "19:00", "22:00", "esp_comedor", "Casa2", "Encuentro de matrimonios."),
    ev("Josués · Caminata", "2026-06-22", "06:00", "09:00", "esp_aire", "Josués", "Salida al aire libre."),
    ev("AMEC · Jornada de salud", "2026-06-24", "08:00", "12:00", "esp_s3", "AMEC", "Brigada médica."),
    ev("Centuriones · Encuentro", "2026-06-25", "16:00", "18:00", "esp_s1", "Centuriones", "Comunidad militar y policía."),
    ev("VISA · Mantenimiento técnico", "2026-06-18", "09:00", "12:00", "esp_aud", "VISA (técnica)", "Revisión de sonido y video."),
    ev("Ujieres · Capacitación", "2026-06-20", "09:00", "10:30", "esp_s1", "Ujieres", "Protocolo de bienvenida."),
    ev("Creativo · Producción de contenido", "2026-06-22", "18:00", "20:00", "esp_cafe", "Creativo", "Diseño y redes de la semana."),
  ];

  /* ============================================================
     Exponemos constantes/seed en window.PASTOR
     ============================================================ */
  window.PASTOR = {
    /* El nombre ORIGINAL de la sede sembrada. El puente con el centro de
       mando reescribe SEDE.nombre para saludar con la iglesia correcta,
       así que hace falta recordar de quién son de verdad estas cifras. */
    SEDE_DEMO_NOMBRE: SEDE.nombre,
    SEDE, PASTOR_USER, MIN_DEFS, ESPACIOS, EQUIPOS_ADMIN,
    DIRECTORIO_PASTORES: genPastores(), DIRECTORIO_ADMIN: DIR_ADMIN,
    CONSEJERIAS, AYUDAS_MAS, ASISTENCIA,
    uid,
    // getters de seed (PSTORE entrega los editables)
    _seed: { FINANZAS, REQUERIMIENTOS, ORGANIGRAMA, EVENTOS, PETICIONES, TEMATICAS },
    ministerio(id) { return MIN_DEFS.find(m => m.id === id); },
    rosterDe(id) { const m = this.ministerio(id); return m ? (m._roster || []).slice() : []; },
  };

  /* ============================================================ MODO ENTREGA
     Vacío total para repartir el sistema en 0. Conserva sede, usuario, espacios
     y equipos admin (estructura para poder operar); vacía todos los datos demo. */
  if (typeof window !== "undefined" && window.CASAROCA_ENTREGA) {
    MIN_DEFS.length = 0;
    window.PASTOR.DIRECTORIO_PASTORES = [];
    window.PASTOR.DIRECTORIO_ADMIN = [];
    CONSEJERIAS.length = 0; AYUDAS_MAS.length = 0; ASISTENCIA.length = 0;
    FINANZAS.ingresosDomingo = []; FINANZAS.presupuestoMin = []; FINANZAS.gastosServicios = [];
    if (Array.isArray(FINANZAS.proyectos)) FINANZAS.proyectos = [];
    ORGANIGRAMA.length = 0; EVENTOS.length = 0; PETICIONES.length = 0; TEMATICAS.length = 0; REQUERIMIENTOS.length = 0;
  }

  /* ============================================================
     PSTORE — estado editable persistente del pastor (mismo patrón que
     STORE/DSTORE): requerimientos, organigrama, eventos extra,
     peticiones extra, temáticas extra, ajustes de finanzas.
     ============================================================ */
  window.PSTORE = (function () {
    const KEY = "casaroca_pastor_bogota_v1";
    const hasLS = (function () { try { return typeof localStorage !== "undefined" && localStorage !== null; } catch (e) { return false; } })();
    let mem = null;

    const SEED = {
      v: 1,
      requerimientos: JSON.parse(JSON.stringify(REQUERIMIENTOS)),
      organigrama: JSON.parse(JSON.stringify(ORGANIGRAMA)),
      // Sistemas de director provisionados desde el organigrama (base en 0).
      // Cada sistema nace cuando el pastor crea un cuadro de director.
      sistemas: [],
      espacios: JSON.parse(JSON.stringify(ESPACIOS)),
      eventos: JSON.parse(JSON.stringify(EVENTOS)),
      peticiones: JSON.parse(JSON.stringify(PETICIONES)),
      // Equipos operativos del catálogo que ESTA sede desactivó (vacío = todos activos).
      // El catálogo es el mismo en las 36 sedes; cada sede usa el subconjunto que necesita.
      equiposInactivos: [],
      tematicas: JSON.parse(JSON.stringify(TEMATICAS)),
      presupuesto: JSON.parse(JSON.stringify(FINANZAS.presupuestoMin)),
      gastos: FINANZAS.gastosServicios.map((g, i) => ({
        id: "gas_seed_" + i, rubro: g.rubro, min: g.min, monto: g.monto,
        fecha: "2026-06-01", factura: "", proveedor: "", archivo: "",
      })),
      // Diezmos/ofrendas del domingo que el pastor SUBE cada semana (Punto 3).
      // Se suman a la serie base (FINANZAS.ingresosDomingo) en KPIs y gráficos.
      diezmosDomingo: [],
      // Asistencia del domingo (Punto 5): el pastor la marca cada semana para
      // llevar el tracking de crecimiento de la sede. Sembramos algunos domingos.
      asistenciaDomingo: [
        { f: "20 abr", fecha: "2026-04-20", total: 940, nuevos: 32 },
        { f: "27 abr", fecha: "2026-04-27", total: 910, nuevos: 28 },
        { f: "4 may", fecha: "2026-05-04", total: 965, nuevos: 41 },
        { f: "11 may", fecha: "2026-05-11", total: 1005, nuevos: 45 },
        { f: "18 may", fecha: "2026-05-18", total: 980, nuevos: 30 },
        { f: "25 may", fecha: "2026-05-25", total: 1040, nuevos: 52 },
        { f: "1 jun", fecha: "2026-06-01", total: 995, nuevos: 38 },
        { f: "8 jun", fecha: "2026-06-08", total: 1075, nuevos: 60 },
      ],
    };

    function leerRaw() { if (hasLS) { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } } return mem; }
    function escribirRaw(o) { if (hasLS) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} } else { mem = o; } }
    const ENTREGA = (typeof window !== "undefined" && window.CASAROCA_ENTREGA);
    function init() {
      let d = leerRaw();
      if (!d || !d.v) {
        d = JSON.parse(JSON.stringify(SEED));
        if (ENTREGA) { d.asistenciaDomingo = []; } // vacío total (el resto ya viene vacío de las constantes)
        escribirRaw(d); return d;
      }
      if (ENTREGA) return d; // en entrega no re-sembramos datos demo
      // migración: agrega claves nuevas del SEED que falten en datos ya guardados
      let cambio = false;
      Object.keys(SEED).forEach(k => { if (d[k] === undefined) { d[k] = JSON.parse(JSON.stringify(SEED[k])); cambio = true; } });
      // top-up de eventos seed por ministerio (sin borrar los creados por el pastor):
      // agrega los del seed que aún no estén presentes (por título+fecha). Solo una vez.
      if (d._evSeedV !== 2) {
        const claves = new Set((d.eventos || []).map(e => e.titulo + "|" + e.fecha));
        SEED.eventos.forEach(se => {
          if (!claves.has(se.titulo + "|" + se.fecha)) { d.eventos.push(JSON.parse(JSON.stringify(se))); cambio = true; }
        });
        d._evSeedV = 2; cambio = true;
      }
      if (cambio) escribirRaw(d);
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
    function hoyISO() { return new Date().toISOString().slice(0, 10); }
    function aMin(h) { const [a, b] = String(h).split(":").map(Number); return a * 60 + (b || 0); }
    function solapan(i1, f1, i2, f2) { return aMin(i1) < aMin(f2) && aMin(i2) < aMin(f1); }

    /* ---- requerimientos ---- */
    function requerimientos() { return DATA.requerimientos.slice(); }
    function addRequerimiento(o) {
      DATA.requerimientos.unshift(Object.assign({ id: uid("req"), fecha: hoyISO(), estado: "Abierto", respondidoEl: null, respuestas: [], autor: PASTOR_USER.nombre }, o));
      persist();
    }
    function setEstadoRequerimiento(id, estado) { const r = DATA.requerimientos.find(x => x.id === id); if (r) { r.estado = estado; if (estado === "Resuelto") r.respondidoEl = hoyISO(); persist(); } }
    function addRespuestaRequerimiento(id, texto, de) { const r = DATA.requerimientos.find(x => x.id === id); if (r) { r.respuestas.push({ de: de || PASTOR_USER.nombre, fecha: hoyISO(), texto }); persist(); } }

    /* ---- organigrama ---- */
    function organigrama() { return DATA.organigrama.slice(); }
    // tipo: "persona" (cargo sin sistema) | "dir-min" (director de ministerio) | "dir-eq" (director de equipo)
    // Al crear un cuadro de director NACE un sistema completo para ese director,
    // con base en 0 y las pestañas predeterminadas. Lo que el director cree
    // (coordinadores, líderes) queda visible para el pastor.
    function addNodo(nombre, rol, parent, tipo, contacto) {
      const nodo = { id: uid("org"), nombre, rol, parent: parent || null };
      const c = contacto || {};
      if (tipo === "dir-min" || tipo === "dir-eq") {
        nodo.tipo = tipo;
        const sis = {
          id: uid("sis"), nodoId: nodo.id, nombre, rol, tipo,
          creadoEl: hoyISO(), enOrganigrama: true,
          base: { personas: 0, grupos: 0, coordinadores: 0, lideres: 0, nuevos: 0, equipo: 0 },
          // REPARTO DEL SISTEMA: el acceso es la forma en que el director
          // recibe su sistema. Con su correo/teléfono se genera un enlace de
          // acceso; al enviarlo, el director entra a SU sistema con el alcance
          // de su rol. "pendiente" = aún no ha recibido el acceso.
          acceso: { email: c.email || "", tel: c.tel || "", enlace: enlaceAcceso(), estado: "pendiente", enviadoEl: null },
        };
        DATA.sistemas.push(sis);
        nodo.sistemaId = sis.id;
        // si quedó con contacto desde el inicio, repartimos el acceso de una vez
        if (c.enviar && (c.email || c.tel)) { sis.acceso.estado = "enviado"; sis.acceso.enviadoEl = hoyISO(); }
      }
      DATA.organigrama.push(nodo);
      persist();
      return nodo;
    }
    function enlaceAcceso() { return "casaroca.app/acceso/" + Math.random().toString(36).slice(2, 8); }
    // (re)enviar / repartir el acceso del sistema a su director
    function enviarAcceso(sistemaId, contacto) {
      const s = DATA.sistemas.find(s => s.id === sistemaId); if (!s) return null;
      const c = contacto || {};
      if (c.email !== undefined) s.acceso.email = c.email;
      if (c.tel !== undefined) s.acceso.tel = c.tel;
      if (!s.acceso.enlace) s.acceso.enlace = enlaceAcceso();
      s.acceso.estado = s.acceso.estado === "activo" ? "activo" : "enviado";
      s.acceso.enviadoEl = hoyISO();
      persist();
      return s;
    }
    function editNodo(id, campos) {
      const x = DATA.organigrama.find(o => o.id === id); if (x) { Object.assign(x, campos); }
      // mantener el sistema vinculado en sincronía con el nombre/rol del cuadro
      if (x && x.sistemaId) { const s = DATA.sistemas.find(s => s.id === x.sistemaId); if (s) Object.assign(s, { nombre: x.nombre, rol: x.rol }); }
      persist();
    }
    function delNodo(id) {
      const nodo = DATA.organigrama.find(o => o.id === id); if (!nodo) return;
      // "Solo quitar del organigrama": el sistema del director se CONSERVA en
      // segundo plano (no se borran personas). Queda desvinculado del árbol.
      if (nodo.sistemaId) { const s = DATA.sistemas.find(s => s.id === nodo.sistemaId); if (s) s.enOrganigrama = false; }
      DATA.organigrama.forEach(o => { if (o.parent === id) o.parent = nodo.parent; });
      DATA.organigrama = DATA.organigrama.filter(o => o.id !== id);
      persist();
    }

    /* ---- sistemas de director (provisionados desde el organigrama) ---- */
    function sistemas() { return DATA.sistemas.slice(); }
    function sistemaPorNodo(nodoId) { return DATA.sistemas.find(s => s.nodoId === nodoId) || null; }

    /* ---- espacios (físicos reservables; el pastor los habilita/crea/borra) ---- */
    function espacios() { return DATA.espacios.slice(); }
    function addEspacio(o) {
      DATA.espacios.push(Object.assign({ id: uid("esp"), nombre: "Espacio", capacidad: 0, ico: "📍" }, o));
      persist();
    }
    function delEspacio(id) {
      const i = DATA.espacios.findIndex(x => x.id === id);
      if (i >= 0) { DATA.espacios.splice(i, 1); persist(); }
    }
    // ¿cuántos eventos (propios del pastor) usan este espacio? (para proteger el borrado)
    function eventosEnEspacio(id) { return DATA.eventos.filter(e => e.espacioId === id).length; }

    /* ---- eventos ---- */
    function eventos() { return DATA.eventos.slice(); }
    function addEvento(o) { DATA.eventos.push(Object.assign({ id: uid("ev"), min: "General" }, o)); persist(); }
    function delEvento(id) { const i = DATA.eventos.findIndex(x => x.id === id); if (i >= 0) { DATA.eventos.splice(i, 1); persist(); } }
    function espacioLibre(espacioId, fecha, horaInicio, horaFin, todos, ignoreId) {
      return !(todos || DATA.eventos).some(e => e.id !== ignoreId && e.espacioId === espacioId && e.fecha === fecha && solapan(horaInicio, horaFin, e.horaInicio, e.horaFin));
    }

    /* ---- peticiones ---- */
    function peticiones() { return DATA.peticiones.slice(); }
    function addPeticion(o) { DATA.peticiones.unshift(Object.assign({ id: uid("pet"), fecha: hoyISO(), estado: "abierta", autorTipo: "pastor", ministerio: "General", intercesion: false }, o)); persist(); }
    function setEstadoPeticion(id, estado) { const x = DATA.peticiones.find(p => p.id === id); if (x) { x.estado = estado; persist(); } }
    // Asigna/retira una petición del equipo de intercesión (cobertura del equipo de Oración).
    function setIntercesion(id, on) { const x = DATA.peticiones.find(p => p.id === id); if (x) { x.intercesion = !!on; persist(); } }

    /* ---- equipos operativos activos por sede ----
       El catálogo es el mismo en todas las sedes; cada sede activa el subconjunto
       que usa. Guardamos los DESACTIVADOS (vacío = todos activos). */
    function equiposInactivos() { return (DATA.equiposInactivos || []).slice(); }
    function equipoActivo(id) { return !(DATA.equiposInactivos || []).includes(id); }
    function toggleEquipoActivo(id) {
      DATA.equiposInactivos = DATA.equiposInactivos || [];
      const i = DATA.equiposInactivos.indexOf(id);
      if (i >= 0) DATA.equiposInactivos.splice(i, 1); else DATA.equiposInactivos.push(id);
      persist();
    }

    /* ---- temáticas ---- */
    function tematicas() { return DATA.tematicas.slice(); }
    function tematica(id) { return DATA.tematicas.find(x => x.id === id) || null; }
    function addTematica(o) { DATA.tematicas.unshift(Object.assign({ id: uid("tem"), fecha: hoyISO(), ico: "📚", docs: [] }, o)); persist(); }
    function delTematica(id) { const i = DATA.tematicas.findIndex(x => x.id === id); if (i >= 0) { DATA.tematicas.splice(i, 1); persist(); } }
    function addDocTematica(id, doc) { const t = DATA.tematicas.find(x => x.id === id); if (!t) return; t.docs = t.docs || []; t.docs.unshift(Object.assign({ id: uid("doc"), fecha: hoyISO() }, doc)); persist(); }
    function delDocTematica(id, docId) { const t = DATA.tematicas.find(x => x.id === id); if (!t || !t.docs) return; t.docs = t.docs.filter(d => d.id !== docId); persist(); }

    /* ---- presupuesto por ministerio (editable por el pastor) ---- */
    function presupuesto() { return DATA.presupuesto.slice(); }
    function setPresupuesto(min, campos) {
      const r = DATA.presupuesto.find(x => x.min === min);
      if (!r) return;
      if (campos.asignado != null && !isNaN(campos.asignado)) r.asignado = Math.max(0, +campos.asignado);
      if (campos.ejecutado != null && !isNaN(campos.ejecutado)) r.ejecutado = Math.max(0, +campos.ejecutado);
      persist();
    }

    /* ---- gastos de servicios (digitados por el pastor + factura) ---- */
    function gastos() { return DATA.gastos.slice(); }
    function addGasto(o) {
      DATA.gastos.unshift(Object.assign({ id: uid("gas"), fecha: hoyISO(), rubro: "", min: "General", monto: 0, factura: "", proveedor: "", archivo: "" }, o));
      persist();
    }
    function delGasto(id) { const i = DATA.gastos.findIndex(x => x.id === id); if (i >= 0) { DATA.gastos.splice(i, 1); persist(); } }

    /* ---- diezmos/ofrendas por domingo (el pastor los sube cada semana · Punto 3) ---- */
    // Serie combinada: seed base + los domingos que va subiendo el pastor.
    function ingresosDomingo() {
      const base = FINANZAS.ingresosDomingo.map(d => Object.assign({}, d));
      const extra = (DATA.diezmosDomingo || []).map(d => Object.assign({}, d));
      return base.concat(extra);
    }
    function addDiezmoDomingo(o) {
      if (!Array.isArray(DATA.diezmosDomingo)) DATA.diezmosDomingo = [];
      DATA.diezmosDomingo.push({
        f: (o && o.f) || hoyISO(),
        diezmos: Math.max(0, +((o && o.diezmos)) || 0),
        ofrendas: Math.max(0, +((o && o.ofrendas)) || 0),
        servicio: (o && o.servicio) || "General",
        fecha: (o && o.fecha) || hoyISO(),
      });
      persist();
    }
    function delDiezmoDomingo(idx) {
      if (Array.isArray(DATA.diezmosDomingo) && DATA.diezmosDomingo[idx]) { DATA.diezmosDomingo.splice(idx, 1); persist(); }
    }

    /* ---- asistencia por domingo (el pastor la marca cada semana · Punto 5) ---- */
    function asistencias() {
      if (!Array.isArray(DATA.asistenciaDomingo)) DATA.asistenciaDomingo = [];
      return DATA.asistenciaDomingo.map(d => Object.assign({}, d));
    }
    function addAsistencia(o) {
      if (!Array.isArray(DATA.asistenciaDomingo)) DATA.asistenciaDomingo = [];
      DATA.asistenciaDomingo.push({
        f: (o && o.f) || hoyISO(),
        fecha: (o && o.fecha) || hoyISO(),
        total: Math.max(0, parseInt((o && o.total) || 0, 10) || 0),
        nuevos: Math.max(0, parseInt((o && o.nuevos) || 0, 10) || 0),
        servicio: (o && o.servicio) || "General",
      });
      persist();
    }
    function delAsistencia(idx) {
      if (Array.isArray(DATA.asistenciaDomingo) && DATA.asistenciaDomingo[idx]) { DATA.asistenciaDomingo.splice(idx, 1); persist(); }
    }

    function resetDemo() { DATA = JSON.parse(JSON.stringify(SEED)); persist(); }

    return {
      KEY, onCambio, persist, resetDemo,
      requerimientos, addRequerimiento, setEstadoRequerimiento, addRespuestaRequerimiento,
      organigrama, addNodo, editNodo, delNodo,
      sistemas, sistemaPorNodo, enviarAcceso,
      espacios, addEspacio, delEspacio, eventosEnEspacio,
      eventos, addEvento, delEvento, espacioLibre,
      peticiones, addPeticion, setEstadoPeticion, setIntercesion,
      equiposInactivos, equipoActivo, toggleEquipoActivo,
      tematicas, tematica, addTematica, delTematica, addDocTematica, delDocTematica,
      presupuesto, setPresupuesto,
      gastos, addGasto, delGasto,
      ingresosDomingo, addDiezmoDomingo, delDiezmoDomingo,
      asistencias, addAsistencia, delAsistencia,
    };
  })();
})();
