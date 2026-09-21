/* ============================================================
   CASA ROCA · DATOS + STORE de la APP DEL PASTOR CENTRAL ADMINISTRATIVO
   Capa 4 — la cúspide. Dirección General desde la sede madre
   (Bogotá Chicó). Demo: Pastor Darío Mantilla (Pastor Director General).

   Este perfil tiene el control de TODA la red (36 iglesias) + los 8
   equipos del back-office corporativo. Aquí SE SUMA toda la información
   que producen las capas inferiores (líder → director → pastor de sede):
   personas, hombres/mujeres, niños, grupos, asistencia, diezmos, cursos,
   instituto (IBLI/FACTER), bautizos, estado civil, finanzas y obras.

   SINCRONIZACIÓN (Fase 0):
   - La sede madre "Bogotá Chicó" reutiliza EN VIVO los registros de la
     app del pastor (window.PASTOR / window.PSTORE) cuando están cargados,
     para que el total de la red refleje lo que se edita abajo.
   - Las otras 35 sedes se generan de forma determinista (semilla por
     índice) para que las cifras sean estables entre recargas.

   Expone:
     window.CENTRAL  — constantes, sedes agregadas y getters de la red.
     window.CSTORE   — estado editable (organigrama corporativo, agenda
                       empresarial, espacios, requerimientos, peticiones
                       internas y decisiones de aprobación) en localStorage.

   En Fase 1 (Supabase) este archivo se reemplaza por consultas reales
   con RLS, conservando la misma interfaz pública.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- usuario demo ---------- */
  const USER = {
    nombre: "Darío Mantilla",
    email: "direccion@casaroca.org",
    telefono: "+57 310 555 9000",
    iniciales: "DM",
    rol: "Pastor Director General",
    sede: "Dirección General · Bogotá",
  };

  /* ---------- helpers de id / texto ---------- */
  let _seq = 0;
  function uid(pfx) { return (pfx || "id") + "_" + Date.now().toString(36) + "_" + (++_seq); }
  function deaccent(s) { return String(s).normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function ini(n, a) { return (((n || "")[0] || "") + ((a || "")[0] || "")).toUpperCase() || "·"; }
  // PRNG determinista (mulberry32) — cifras estables entre recargas.
  function rng(seed) { let t = seed >>> 0; return function () { t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }
  function ri(r, a, b) { return Math.floor(a + r() * (b - a + 1)); }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }

  /* ============================================================
     POOLS de nombres (consistentes con pastor-data.js).
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
  const EC = ["Soltero(a)", "Casado(a)", "Unión libre", "Separado(a)", "Viudo(a)"];
  const MIN_NOMBRES = ["RocaKids", "tMt (11–25)", "J+25", "Josués", "Casa2", "Años Dorados", "Mujer Integral", "Hombres de Bien", "AMEC", "Centuriones", "Ejecutivos y Empresarios"];
  const ETAPAS_K = ["conoce", "conoce", "conoce", "conecta", "conecta", "crece", "crece", "sirve"];

  /* ============================================================
     36 SEDES — agregados por iglesia. Cifras deterministas por semilla.
     Cada sede resume lo que abajo producen sus líderes/directores/pastor.
     diezmoDom = diezmos del último domingo (millones COP).
     recurrencia = % de diezmadores recurrentes (dan ≥3 meses seguidos).
     ============================================================ */
  // 36 sedes REALES de Casa Roca (del menú del landing): [nombre, país].
  // Índice 0 = sede madre (Bogotá Chicó). 27 en Colombia, 3 España, 4 EE.UU., Panamá y Canadá.
  const SEDES_REALES = [
    ["Bogotá Chicó", "Colombia"], // madre
    ["Armenia", "Colombia"], ["Barranquilla", "Colombia"], ["Bucaramanga", "Colombia"], ["Cali", "Colombia"],
    ["Cartagena", "Colombia"], ["Cúcuta", "Colombia"], ["Florencia", "Colombia"], ["Garzón", "Colombia"],
    ["Girardot", "Colombia"], ["Ibagué", "Colombia"], ["Llanogrande ANT", "Colombia"], ["Manizales", "Colombia"],
    ["Medellín", "Colombia"], ["Montería", "Colombia"], ["Neiva", "Colombia"], ["Pasto", "Colombia"],
    ["Pereira", "Colombia"], ["Popayán", "Colombia"], ["Sabana Norte", "Colombia"], ["Santa Marta", "Colombia"],
    ["Sincelejo", "Colombia"], ["Sogamoso", "Colombia"], ["Tunja", "Colombia"], ["Valledupar", "Colombia"],
    ["Villavicencio", "Colombia"], ["Yopal", "Colombia"],
    ["Barcelona", "España"], ["Madrid", "España"], ["Toledo", "España"],
    ["Boca Ratón", "Estados Unidos"], ["Nueva York", "Estados Unidos"], ["Miami", "Estados Unidos"], ["Orlando", "Estados Unidos"],
    ["Ciudad de Panamá", "Panamá"], ["Ottawa Canadá", "Canadá"],
  ];

  function genSede(i) {
    const r = rng(1000 + i * 97);
    const madre = i === 0;
    const sr = SEDES_REALES[i];
    const nombre = sr[0];
    const ciudad = sr[0];
    const pais = sr[1];
    // tamaño: madre grande; resto escalonado
    const asistentes = madre ? 1940 : ri(r, 140, 1180);
    const personas = Math.round(asistentes * (1.7 + r() * 0.5)); // base de datos > asistentes
    const mujeres = Math.round(personas * (0.52 + r() * 0.06));
    const hombres = personas - mujeres;
    const ninos = Math.round(asistentes * (0.16 + r() * 0.07));
    const grupos = Math.max(4, Math.round(asistentes / (16 + r() * 8)));
    const nuevosMes = ri(r, Math.round(asistentes * 0.02), Math.round(asistentes * 0.06));
    const bautizados = Math.round(personas * (0.34 + r() * 0.16));
    const adn = Math.round(personas * (0.42 + r() * 0.2));
    const instIbli = ri(r, 6, Math.max(8, Math.round(asistentes * 0.05)));
    const instFacter = ri(r, 3, Math.max(5, Math.round(asistentes * 0.03)));
    const cursosMes = ri(r, 10, Math.max(12, Math.round(asistentes * 0.08)));
    // estado civil
    const solteros = Math.round(personas * (0.40 + r() * 0.08));
    const casados = Math.round(personas * (0.34 + r() * 0.08));
    const union = Math.round(personas * (0.08 + r() * 0.04));
    const sep = Math.round(personas * (0.05 + r() * 0.03));
    const viudo = Math.max(0, personas - solteros - casados - union - sep);
    // finanzas (millones COP / mes)
    const diezmoMes = Math.round(asistentes * (0.085 + r() * 0.05) * 10) / 10;
    const diezmoDom = Math.round((diezmoMes / 4) * (0.9 + r() * 0.4) * 10) / 10;
    const recurrencia = ri(r, 58, 86);
    const presupuesto = Math.round(diezmoMes * (0.9 + r() * 0.2) * 10) / 10;
    const gastosMes = Math.round(presupuesto * (0.72 + r() * 0.2) * 10) / 10;
    const ahorro = Math.round(diezmoMes * (1.5 + r() * 4) * 10) / 10;
    // series de 8 domingos (asistencia adultos + niños)
    const asistDom = [], kidsDom = [];
    let baseA = Math.round(asistentes * 0.92), baseK = ninos;
    const fechas = ["20 abr", "27 abr", "4 may", "11 may", "18 may", "25 may", "1 jun", "8 jun"];
    for (let k = 0; k < 8; k++) {
      asistDom.push({ f: fechas[k], v: Math.round(baseA * (0.9 + r() * 0.2)) });
      kidsDom.push({ f: fechas[k], v: Math.round(baseK * (0.85 + r() * 0.3)) });
    }
    const pastorGenero = i % 4 === 0 ? "F" : "M";
    const pNom = (pastorGenero === "F" ? NOM_F : NOM_M)[(i * 5 + 2) % 30];
    const pApe1 = APE[(i * 11 + 7) % APE.length];
    const pApe = pApe1 + " " + APE[(i * 3 + 13) % APE.length];
    // cónyuge (esposo/a): género opuesto, comparte el primer apellido del titular
    const conyGenero = pastorGenero === "F" ? "M" : "F";
    const cNom = (conyGenero === "F" ? NOM_F : NOM_M)[(i * 7 + 5) % 30];
    const cApe = APE[(i * 13 + 4) % APE.length] + " " + pApe1;
    return {
      id: "sede_" + i, idx: i, esMadre: madre,
      nombre: "Casa Roca · " + nombre + (madre ? " (madre)" : ""),
      nombreCorto: nombre, ciudad, pais,
      pastor: (pastorGenero === "F" ? "Pastora " : "Pastor ") + pNom + " " + pApe,
      conyuge: (conyGenero === "F" ? "Pastora " : "Pastor ") + cNom + " " + cApe,
      pastorRol: madre ? "Pastor Director General" : "Pastor Congregacional",
      asistentes, personas, hombres, mujeres, ninos, grupos, nuevosMes,
      bautizados, adn, instIbli, instFacter, cursosMes,
      ec: { "Soltero(a)": solteros, "Casado(a)": casados, "Unión libre": union, "Separado(a)": sep, "Viudo(a)": viudo },
      diezmoMes, diezmoDom, recurrencia,
      presupuesto, gastosMes, ahorro,
      asistDom, kidsDom,
      estado: madre ? "Sede madre" : pick(rng(50 + i), ["Saludable", "Saludable", "Saludable", "En crecimiento", "En crecimiento", "Requiere atención"]),
    };
  }
  const SEDES = [];
  for (let i = 0; i < 36; i++) SEDES.push(genSede(i));

  /* ============================================================
     CRM MASTER — todas las personas de todas las sedes.
     Para no inflar el prototipo se genera una muestra detallada por
     sede (proporcional al tamaño, con tope) que SUMA en los conteos.
     Cada persona trae diezmos recurrentes (records mensuales).
     ============================================================ */
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  function genDiezmos(r, mensual, recurrente) {
    // 6 meses hacia atrás desde junio 2026
    const out = []; const meses = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];
    meses.forEach((m, k) => {
      if (!recurrente && r() < 0.45) return; // no recurrente => salta meses
      const monto = Math.round(mensual * (0.85 + r() * 0.35));
      out.push({ mes: m, monto });
    });
    return out;
  }
  function genPersonasSede(sede) {
    const r = rng(7000 + sede.idx * 131);
    const n = sede.esMadre ? 26 : Math.max(8, Math.min(20, Math.round(sede.asistentes / 70)));
    const out = [];
    for (let k = 0; k < n; k++) {
      const genero = r() < (sede.mujeres / sede.personas) ? "F" : "M";
      const nombres = pick(r, genero === "F" ? NOM_F : NOM_M);
      const apellidos = pick(r, APE) + " " + pick(r, APE);
      const edad = ri(r, 15, 78);
      const etapa = pick(r, ETAPAS_K);
      const ec = edad < 23 ? "Soltero(a)" : pick(r, EC);
      const sirve = etapa === "sirve" || (etapa === "crece" && r() < 0.4);
      const diezma = sirve || etapa === "crece" || r() < 0.3;
      const recurrente = diezma && r() < 0.7;
      const mensual = diezma ? ri(r, 80, 950) / 1000 : 0; // millones COP (0.08–0.95M)
      const bautizado = etapa !== "conoce" && r() < 0.8;
      const adn = etapa !== "conoce" || r() < 0.5;
      const inst = r() < 0.18 ? pick(r, ["IBLI · 1er sem", "IBLI · 2º sem", "IBLI · 3er sem", "FACTER · 1er sem", "FACTER · 2º sem"]) : null;
      out.push({
        id: "per_" + sede.idx + "_" + k,
        nombres, apellidos, iniciales: ini(nombres, apellidos),
        genero, edad, etapa, estadoCivil: ec,
        sede: sede.id, sedeNombre: sede.nombreCorto, ciudad: sede.ciudad,
        ministerio: pick(r, MIN_NOMBRES),
        telefono: `+57 ${300 + (k % 22)} 555 ${String(1000 + sede.idx * 30 + k).slice(-4)}`,
        email: deaccent(nombres).toLowerCase() + "." + deaccent(apellidos.split(" ")[0]).toLowerCase() + "@email.com",
        fechaInscripcion: pick(r, ["2025-08-10", "2025-11-02", "2026-01-12", "2026-02-24", "2026-03-29", "2026-04-30", "2026-05-21", "2026-06-09"]),
        bautizado, adn, cursos: adn ? ri(r, 1, 4) : 0, instituto: inst,
        sirve, diezma, recurrente,
        diezmoMensual: mensual, diezmos: genDiezmos(r, mensual, recurrente),
        consejerias: r() < 0.12 ? [pick(r, ["Emocional", "Pareja", "Espiritual", "Duelo", "Vocacional"])] : [],
        ayudasMas: r() < 0.08 ? [pick(r, ["Mercado", "Salud", "Educación", "Arriendo", "Empleo"])] : [],
        fuente: pick(r, FUENTES),
      });
    }
    return out;
  }
  let _crmCache = null;
  function crmMaster() {
    if (_crmCache) return _crmCache;
    let all = [];
    SEDES.forEach(s => { all = all.concat(genPersonasSede(s)); });
    _crmCache = all;
    return all;
  }

  /* ============================================================
     EQUIPO CENTRAL — staff de la Dirección General (distinto al de sede).
     ============================================================ */
  const EQUIPO_CENTRAL = [
    { id: "ec_dg", nombre: "Darío Mantilla", rol: "Pastor Director General", area: "Dirección", email: "direccion@casaroca.org", tel: "+57 310 555 9000", ini: "DM" },
    { id: "ec_eje", nombre: "Carolina Pardo", rol: "Directora Ejecutiva", area: "Dirección", email: "ejecutiva@casaroca.org", tel: "+57 310 555 9010", ini: "CP" },
    { id: "ec_cont", nombre: "Liliana Suárez", rol: "Jefe de Contabilidad", area: "Contabilidad", email: "contabilidad@casaroca.org", tel: "+57 311 555 9001", ini: "LS" },
    { id: "ec_teso", nombre: "Jorge Méndez", rol: "Tesorero General", area: "Tesorería", email: "tesoreria@casaroca.org", tel: "+57 312 555 9002", ini: "JM" },
    { id: "ec_th", nombre: "Sandra Quintero", rol: "Directora de Talento Humano", area: "RRHH", email: "th@casaroca.org", tel: "+57 313 555 9003", ini: "SQ" },
    { id: "ec_legal", nombre: "Dra. Ángela Vega", rol: "Directora Legal", area: "Legal", email: "legal@casaroca.org", tel: "+57 314 555 9004", ini: "ÁV" },
    { id: "ec_comms", nombre: "Camilo Mejía", rol: "Director de Comunicaciones", area: "Comunicaciones", email: "comunicaciones@casaroca.org", tel: "+57 315 555 9005", ini: "CM" },
    { id: "ec_tec", nombre: "Iván Restrepo", rol: "Director de Tecnología", area: "Tecnología", email: "tecnologia@casaroca.org", tel: "+57 316 555 9006", ini: "IR" },
    { id: "ec_const", nombre: "Ing. Hernán Gómez", rol: "Director de Construcción", area: "Construcción", email: "construccion@casaroca.org", tel: "+57 317 555 9007", ini: "HG" },
    { id: "ec_inst", nombre: "Dr. Ramiro Cano", rol: "Rector Instituto (IBLI·FACTER)", area: "Instituto", email: "instituto@casaroca.org", tel: "+57 318 555 9008", ini: "RC" },
  ];

  /* ============================================================
     ORGANIGRAMA CORPORATIVO (master). Raíz = Pastor Director General.
     Bajo él: 8 equipos back-office + nodo "Filiales" con las 36 sedes.
     Editable vía CSTORE (crear pastor de sede, mover, editar, borrar).
     ============================================================ */
  function orgSeed() {
    const base = [
      { id: "o_dg", nombre: "Darío Mantilla", rol: "Pastor Director General", parent: null, tipo: "direccion" },
      { id: "o_eje", nombre: "Carolina Pardo", rol: "Dirección Ejecutiva", parent: "o_dg", tipo: "direccion" },
      // 8 equipos del back-office
      { id: "o_cont", nombre: "Liliana Suárez", rol: "Contabilidad (corporativo)", parent: "o_eje", tipo: "equipo" },
      { id: "o_teso", nombre: "Jorge Méndez", rol: "Tesorería", parent: "o_eje", tipo: "equipo" },
      { id: "o_th", nombre: "Sandra Quintero", rol: "Talento Humano (RRHH)", parent: "o_eje", tipo: "equipo" },
      { id: "o_legal", nombre: "Dra. Ángela Vega", rol: "Legal (corporativo)", parent: "o_eje", tipo: "equipo" },
      { id: "o_tec", nombre: "Iván Restrepo", rol: "Tecnología (corporativo)", parent: "o_eje", tipo: "equipo" },
      { id: "o_comms", nombre: "Camilo Mejía", rol: "Comunicaciones", parent: "o_eje", tipo: "equipo" },
      { id: "o_const", nombre: "Ing. Hernán Gómez", rol: "Construcción", parent: "o_eje", tipo: "equipo" },
      { id: "o_inst", nombre: "Dr. Ramiro Cano", rol: "Instituto IBLI·FACTER", parent: "o_eje", tipo: "equipo" },
      // nodo de la red
      { id: "o_filiales", nombre: "Red de iglesias", rol: "36 sedes", parent: "o_dg", tipo: "red" },
    ];
    // cada sede como nodo bajo Filiales (referencia a sede)
    SEDES.forEach(s => base.push({ id: "o_" + s.id, nombre: s.pastor, conyuge: s.conyuge, rol: s.pastorRol + " · " + s.nombreCorto, parent: "o_filiales", tipo: "sede", sedeId: s.id }));
    return base;
  }

  /* ============================================================
     CALENDARIO EMPRESARIAL (corporativo) — independiente de los eventos
     de las iglesias. Tareas/proyectos de la administración + reserva de
     espacios de la sede de Bogotá (oficinas dirección general).
     ============================================================ */
  const ESPACIOS = [
    { id: "esp_junta", nombre: "Sala de Junta Directiva", capacidad: 16, ico: "🏛️" },
    { id: "esp_reuniones", nombre: "Sala de Reuniones A", capacidad: 10, ico: "💼" },
    { id: "esp_reuniones2", nombre: "Sala de Reuniones B", capacidad: 8, ico: "🗂️" },
    { id: "esp_audi", nombre: "Auditorio Corporativo", capacidad: 120, ico: "🎤" },
    { id: "esp_capacit", nombre: "Aula de Capacitación", capacidad: 30, ico: "🎓" },
    { id: "esp_coworking", nombre: "Coworking Dirección", capacidad: 24, ico: "🖥️" },
  ];
  function ev(titulo, fecha, hi, hf, esp, area, desc) { return { id: uid("cev"), titulo, fecha, horaInicio: hi, horaFin: hf, espacioId: esp, area, desc }; }
  const EVENTOS_CORP = [
    ev("Junta Directiva mensual", "2026-06-18", "08:00", "11:00", "esp_junta", "Dirección", "Estados financieros de la red y aprobación de proyectos."),
    ev("Cierre contable de mayo (revisión)", "2026-06-16", "14:00", "16:30", "esp_reuniones", "Contabilidad", "Revisión consolidada con jefes de sede."),
    ev("Comité de Tesorería", "2026-06-17", "09:00", "10:30", "esp_reuniones2", "Tesorería", "Aprobación de anticipos y flujo de caja semanal."),
    ev("Selección · Coordinador de Construcción", "2026-06-19", "10:00", "12:00", "esp_reuniones", "RRHH", "Entrevistas finales de la vacante."),
    ev("Capacitación Ley 1581 (datos personales)", "2026-06-20", "08:30", "12:30", "esp_capacit", "Legal", "Habeas data y protección de menores para líderes."),
    ev("Grabación campaña 'Una sola casa'", "2026-06-22", "13:00", "18:00", "esp_audi", "Comunicaciones", "Producción audiovisual de la campaña anual."),
    ev("Visita de obra · Sede Sur", "2026-06-23", "07:00", "09:00", "esp_coworking", "Construcción", "Coordinación logística de la nueva plantación."),
    ev("Consejo Académico IBLI·FACTER", "2026-06-24", "15:00", "17:00", "esp_reuniones2", "Instituto", "Plan de semestre y graduaciones."),
    ev("Planeación estratégica 2027", "2026-06-26", "08:00", "13:00", "esp_junta", "Dirección", "Metas de la red y presupuesto del próximo año."),
  ];

  /* ============================================================
     REQUERIMIENTOS — service desk maestro. Sincroniza lo que TODAS las
     iglesias envían a la administración central. Ruteados por equipo.
     ============================================================ */
  const EQUIPOS_DEF = [
    { id: "contabilidad", nombre: "Contabilidad", ico: "📒", sla: "3 días", resp: "Liliana Suárez" },
    { id: "tesoreria", nombre: "Tesorería", ico: "💵", sla: "2 días", resp: "Jorge Méndez" },
    { id: "rrhh", nombre: "Talento Humano", ico: "👥", sla: "2 días", resp: "Sandra Quintero" },
    { id: "legal", nombre: "Legal", ico: "⚖️", sla: "5 días", resp: "Dra. Ángela Vega" },
    { id: "comunicaciones", nombre: "Comunicaciones", ico: "📣", sla: "2 días", resp: "Camilo Mejía" },
    { id: "construccion", nombre: "Construcción", ico: "🏗️", sla: "7 días", resp: "Ing. Hernán Gómez" },
    { id: "instituto", nombre: "Instituto IBLI·FACTER", ico: "🎓", sla: "4 días", resp: "Dr. Ramiro Cano" },
    { id: "tecnologia", nombre: "Tecnología", ico: "💻", sla: "3 días", resp: "Iván Restrepo" },
  ];
  const REQ_PLANTILLAS = {
    contabilidad: ["Conciliación de ofrendas del mes", "Causación de facturas de proveedores", "Reporte de gastos para junta", "Apertura de centro de costos", "Soporte de retención en la fuente"],
    tesoreria: ["Anticipo para retiro / evento", "Reembolso de caja menor", "Pago a proveedor urgente", "Apertura de cuenta para sede", "Cambio de firma autorizada"],
    rrhh: ["Contratación de auxiliar", "Liquidación de contrato", "Permiso / vacaciones de líder", "Certificado laboral", "Proceso disciplinario"],
    legal: ["Revisión de convenio", "Contrato de arrendamiento de local", "Habeas data de base de datos", "Registro de marca / propiedad", "Concepto sobre donación"],
    comunicaciones: ["Arte para campaña / evento", "Cubrimiento de redes del domingo", "Video institucional", "Plantilla de boletín", "Manual de marca para sede"],
    construccion: ["Filtración / reparación locativa", "Adecuación de salón RocaKids", "Cotización de obra nueva", "Mantenimiento de aire / sonido", "Estudio de ampliación"],
    instituto: ["Inscripción de estudiantes IBLI", "Beca para estudiante FACTER", "Certificado de notas", "Apertura de cohorte en sede", "Homologación de materias"],
    tecnologia: ["Acceso a la plataforma", "Falla en check-in RocaKids", "Correo institucional de líder", "Soporte de streaming", "Integración con Siigo"],
  };
  const PRIOS = ["Alta", "Media", "Media", "Baja"];
  const ESTADOS_REQ = ["Abierto", "Abierto", "En proceso", "En proceso", "Resuelto", "En aprobación"];
  function genRequerimientos() {
    const out = [];
    if (!SEDES.length) return out; // modo entrega / red vacía
    const r = rng(424242);
    for (let i = 0; i < 64; i++) {
      const eq = pick(r, EQUIPOS_DEF);
      const sede = pick(r, SEDES);
      const asunto = pick(r, REQ_PLANTILLAS[eq.id]);
      const estado = pick(r, ESTADOS_REQ);
      const prioridad = pick(r, PRIOS);
      const dia = ri(r, 1, 14);
      out.push({
        id: "req_" + i, equipo: eq.id, sede: sede.id, sedeNombre: sede.nombreCorto,
        autor: sede.pastor, asunto,
        descripcion: asunto + " — solicitud de la sede " + sede.nombreCorto + " (" + sede.ciudad + ").",
        prioridad, estado, requiereAprobacion: estado === "En aprobación" || (prioridad === "Alta" && r() < 0.5),
        montoAsociado: eq.id === "tesoreria" || eq.id === "construccion" ? ri(r, 2, 80) : 0,
        fecha: "2026-06-" + String(dia).padStart(2, "0"),
        respuestas: estado === "Resuelto" ? [{ de: eq.nombre, fecha: "2026-06-" + String(Math.min(14, dia + 2)).padStart(2, "0"), texto: "Atendido y cerrado. Soporte enviado al correo de la sede." }] : [],
      });
    }
    return out;
  }

  /* ============================================================
     PETICIONES INTERNAS — oración confidencial para empleados/equipo
     de la administración central (no se mezclan con las congregacionales).
     ============================================================ */
  function petI(autor, area, texto, fecha, estado) { return { id: uid("peti"), autor, area, texto, fecha, estado, interna: true }; }
  const PETICIONES_INTERNAS = [
    petI("Liliana Suárez", "Contabilidad", "Por sabiduría y paz en el cierre fiscal del año, es una temporada de mucha carga.", "2026-06-14", "orando"),
    petI("Equipo de Tesorería", "Tesorería", "Provisión para cubrir los proyectos de plantación sin descuidar las sedes pequeñas.", "2026-06-13", "abierta"),
    petI("Sandra Quintero", "RRHH", "Por las familias de tres colaboradores que atraviesan situaciones de salud.", "2026-06-12", "orando"),
    petI("Ing. Hernán Gómez", "Construcción", "Seguridad para las cuadrillas de obra en la sede Sur y la sede Norte.", "2026-06-11", "abierta"),
    petI("Darío Mantilla", "Dirección", "Por unidad del cuerpo pastoral de las 36 iglesias y dirección para el 2027.", "2026-06-15", "orando"),
  ];

  /* ============================================================
     DATA POR EQUIPO (especialidad) — analítica + colas de aprobación.
     Cada equipo es un "mini-ERP" con sus propios KPIs y aprobaciones.
     ============================================================ */
  const HOY = "2026-06-16";
  const TEAM_DATA = {
    contabilidad: {
      kpis: { ingresosRed: 0, egresosRed: 0, sedesCerradas: 28, sedesPendientes: 8, siigoSync: "Al día" },
      // se completan abajo con sumas
      cierres: SEDES.slice(0, 12).map((s, i) => ({ sede: s.nombreCorto, estado: i < 9 ? "Cerrado" : i < 11 ? "En revisión" : "Pendiente", dia: i < 9 ? "5 jun" : "—" })),
      asientos: [
        { id: "as_1", concepto: "Causación nómina junio (consolidado)", debito: 412.0, credito: 412.0, estado: "Por aprobar", sede: "Red" },
        { id: "as_2", concepto: "Depreciación equipos audiovisuales", debito: 18.5, credito: 18.5, estado: "Por aprobar", sede: "Bogotá Chicó" },
        { id: "as_3", concepto: "Diferido seguros anuales", debito: 9.2, credito: 9.2, estado: "Aprobado", sede: "Red" },
        { id: "as_4", concepto: "Provisión impuesto de renta Q2", debito: 64.0, credito: 64.0, estado: "Por aprobar", sede: "Red" },
      ],
      cuentas: [
        { cta: "Ingresos por diezmos y ofrendas", saldo: 0, tipo: "ingreso" },
        { cta: "Gastos de personal", saldo: 0, tipo: "egreso" },
        { cta: "Servicios públicos y arriendos", saldo: 0, tipo: "egreso" },
        { cta: "Proyectos y obras", saldo: 0, tipo: "egreso" },
      ],
    },
    tesoreria: {
      bancos: [
        { banco: "Bancolombia · Cta. corriente red", saldo: 1240.0 },
        { banco: "Davivienda · Fondo de proyectos", saldo: 860.0 },
        { banco: "BBVA · Internacional (USD)", saldo: 420.0 },
        { banco: "Caja menor consolidada", saldo: 38.0 },
      ],
      anticipos: [
        { id: "ant_1", sede: "Bogotá Chicó", concepto: "Retiro Hombres de Bien", monto: 4.0, estado: "Por aprobar", solicita: "Pastor Camilo" },
        { id: "ant_2", sede: "Norte", concepto: "Adecuación salón RocaKids", monto: 18.0, estado: "Por aprobar", solicita: "Pastora Laura" },
        { id: "ant_3", sede: "Medellín Poblado", concepto: "Evento de jóvenes tMt", monto: 6.5, estado: "Por aprobar", solicita: "Pastor Andrés" },
        { id: "ant_4", sede: "Cali Sur", concepto: "Reembolso caja menor", monto: 2.2, estado: "Aprobado", solicita: "Tesorería local" },
      ],
      flujo: [{ f: "Sem 1", ing: 320, egr: 240 }, { f: "Sem 2", ing: 298, egr: 260 }, { f: "Sem 3", ing: 342, egr: 251 }, { f: "Sem 4", ing: 310, egr: 268 }],
    },
    rrhh: {
      headcount: 0, contratos: { indefinido: 142, fijo: 64, prestacion: 38, aprendiz: 12 },
      vacantes: [
        { id: "vac_1", cargo: "Coordinador de Construcción", sede: "Dirección General", estado: "Entrevistas", postulados: 14 },
        { id: "vac_2", cargo: "Auxiliar contable", sede: "Medellín Poblado", estado: "Abierta", postulados: 22 },
        { id: "vac_3", cargo: "Maestra RocaKids", sede: "Barranquilla Centro", estado: "Terna final", postulados: 9 },
      ],
      solicitudes: [
        { id: "sol_1", tipo: "Vacaciones", quien: "Camilo Mejía (Comms)", dias: 10, estado: "Por aprobar" },
        { id: "sol_2", tipo: "Permiso no remunerado", quien: "Aux. logística · Norte", dias: 3, estado: "Por aprobar" },
        { id: "sol_3", tipo: "Contratación", quien: "Maestra RocaKids · B/quilla", dias: 0, estado: "Por aprobar" },
        { id: "sol_4", tipo: "Certificado laboral", quien: "Sandra Q.", dias: 0, estado: "Resuelto" },
      ],
      nomina: { mensual: 412.0, sedes: 36, colaboradores: 256, fecha: "30 jun" },
    },
    legal: {
      contratos: [
        { id: "con_1", nombre: "Arriendo local sede Sur", tipo: "Arrendamiento", estado: "Por firmar", vence: "2027-03-01", riesgo: "Medio" },
        { id: "con_2", nombre: "Convenio parqueadero colegio (Chicó)", tipo: "Convenio", estado: "En revisión", vence: "2026-12-01", riesgo: "Bajo" },
        { id: "con_3", nombre: "Proveedor de streaming (anual)", tipo: "Servicios", estado: "Vigente", vence: "2026-09-30", riesgo: "Bajo" },
        { id: "con_4", nombre: "Licencia de software contable Siigo", tipo: "Licencia", estado: "Renovar", vence: "2026-07-15", riesgo: "Alto" },
      ],
      cumplimiento: [
        { item: "Ley 1581/2012 · Habeas data", estado: "Cumple", nota: "Política publicada · 36/36 sedes" },
        { item: "Protección de menores (RocaKids)", estado: "Cumple", nota: "Código de entrega segura activo" },
        { item: "GDPR · sedes internacionales", estado: "Parcial", nota: "Pendiente 2 sedes (Madrid, Londres)" },
        { item: "Régimen tributario especial (ESAL)", estado: "Cumple", nota: "Actualización anual al día" },
      ],
      aprob: [
        { id: "lg_1", asunto: "Convenio uso de parqueadero · Chicó", estado: "Por aprobar" },
        { id: "lg_2", asunto: "Cláusula de datos en formulario 'Soy nuevo'", estado: "Por aprobar" },
        { id: "lg_3", asunto: "Contrato proveedor de buses · retiro", estado: "Por aprobar" },
      ],
    },
    comunicaciones: {
      campanas: [
        { id: "cmp_1", nombre: "Una sola casa (anual)", estado: "En producción", alcance: 0, fecha: "2026-07" },
        { id: "cmp_2", nombre: "Soy nuevo · bienvenida", estado: "Activa", alcance: 48000, fecha: "Permanente" },
        { id: "cmp_3", nombre: "Bautizos de julio", estado: "Programada", alcance: 0, fecha: "2026-07" },
      ],
      redes: [{ red: "Instagram", seguidores: 184000, crec: 3.2 }, { red: "YouTube", seguidores: 96000, crec: 2.1 }, { red: "TikTok", seguidores: 142000, crec: 6.4 }, { red: "Facebook", seguidores: 121000, crec: 0.8 }],
      piezas: [
        { id: "pz_1", titulo: "Arte campaña 'Una sola casa'", sede: "Red", estado: "Por aprobar" },
        { id: "pz_2", titulo: "Reel testimonio · Sede Norte", sede: "Norte", estado: "Por aprobar" },
        { id: "pz_3", titulo: "Plantilla boletín dominical", sede: "Red", estado: "Aprobado" },
      ],
    },
    construccion: {
      proyectos: [
        { id: "ob_1", nombre: "Plantación sede Sur", sede: "Bogotá Sur", presupuesto: 220.0, avance: 24, estado: "En obra" },
        { id: "ob_2", nombre: "Adecuación auditorio RocaKids", sede: "Bogotá Chicó", presupuesto: 120.0, avance: 62, estado: "En obra" },
        { id: "ob_3", nombre: "Ampliación templo Poblado", sede: "Medellín Poblado", presupuesto: 340.0, avance: 8, estado: "Diseño" },
        { id: "ob_4", nombre: "Reforzamiento estructural", sede: "Cali Sur", presupuesto: 90.0, avance: 100, estado: "Entregado" },
      ],
      mantenimiento: [
        { id: "mt_1", sede: "Bogotá Chicó", asunto: "Filtración Salón 2", prioridad: "Alta", estado: "Programado" },
        { id: "mt_2", sede: "Barranquilla Centro", asunto: "Aire acondicionado auditorio", prioridad: "Media", estado: "Cotizando" },
        { id: "mt_3", sede: "Pereira", asunto: "Pintura fachada", prioridad: "Baja", estado: "Abierto" },
      ],
      aprob: [
        { id: "cn_1", asunto: "Cotización obra civil · sede Sur ($96M)", estado: "Por aprobar" },
        { id: "cn_2", asunto: "Orden de compra mobiliario RocaKids ($25M)", estado: "Por aprobar" },
      ],
    },
    instituto: {
      // se completa con sumas de SEDES (instIbli/instFacter)
      inscritosIbli: 0, inscritosFacter: 0,
      semestres: [
        { sem: "IBLI · 1er sem", n: 0 }, { sem: "IBLI · 2º sem", n: 0 }, { sem: "IBLI · 3er sem", n: 0 }, { sem: "IBLI · 4º sem", n: 0 },
        { sem: "FACTER · 1er sem", n: 0 }, { sem: "FACTER · 2º sem", n: 0 }, { sem: "FACTER · 3er sem", n: 0 }, { sem: "FACTER · 4º sem", n: 0 },
      ],
      graduados2026: 86, docentes: 24, plataforma: "Moodle (SSO)",
      aprob: [
        { id: "in_1", asunto: "Apertura cohorte IBLI · sede Medellín", estado: "Por aprobar" },
        { id: "in_2", asunto: "12 becas FACTER 2026-2", estado: "Por aprobar" },
        { id: "in_3", asunto: "Homologación de materias · 3 estudiantes", estado: "Por aprobar" },
      ],
    },
  };

  /* ============================================================
     AGREGADOS DE LA RED — sumas globales (con sede madre en vivo si
     window.PASTOR está disponible).
     ============================================================ */
  function sumaSedes(campo) { return SEDES.reduce((a, s) => a + (s[campo] || 0), 0); }

  /* ------------------------------------------------------------
     LIVE — lee EN VIVO los stores de la operación (sede madre Bogotá):
     inscritos del grupo Café & Palabra (STORE), check-ins de RocaKids del
     último domingo (RKSTORE) y requerimientos abiertos del pastor (PSTORE).
     Si esos scripts no están cargados, devuelve ceros sin romper.
     ------------------------------------------------------------ */
  function live() {
    const o = { inscritosCafe: 0, kidsHoy: 0, reqPastorAbiertos: 0, conectado: false };
    try { if (window.STORE && window.STORE.inscritos) { o.inscritosCafe = window.STORE.inscritos("af_j25_cafe").length; o.conectado = true; } } catch (e) {}
    try {
      if (window.RKSTORE && window.RKSTORE.registros) {
        const regs = window.RKSTORE.registros();
        if (regs.length) {
          const maxF = regs.reduce((m, r) => (r.fecha > m ? r.fecha : m), regs[0].fecha);
          o.kidsHoy = regs.filter(r => r.fecha === maxF).length;
        }
        o.conectado = true;
      }
    } catch (e) {}
    try { if (window.PSTORE && window.PSTORE.requerimientos) { o.reqPastorAbiertos = window.PSTORE.requerimientos().filter(r => r.estado !== "Resuelto").length; o.conectado = true; } } catch (e) {}
    return o;
  }
  function red() {
    const totalPersonas = sumaSedes("personas");
    const r = {
      sedes: SEDES.length,
      personas: totalPersonas,
      hombres: sumaSedes("hombres"),
      mujeres: sumaSedes("mujeres"),
      ninos: sumaSedes("ninos"),
      asistentes: sumaSedes("asistentes"),
      grupos: sumaSedes("grupos"),
      nuevosMes: sumaSedes("nuevosMes"),
      bautizados: sumaSedes("bautizados"),
      adn: sumaSedes("adn"),
      instIbli: sumaSedes("instIbli"),
      instFacter: sumaSedes("instFacter"),
      cursosMes: sumaSedes("cursosMes"),
      diezmoMes: Math.round(sumaSedes("diezmoMes") * 10) / 10,
      diezmoDomUlt: Math.round(sumaSedes("diezmoDom") * 10) / 10,
      presupuesto: Math.round(sumaSedes("presupuesto") * 10) / 10,
      gastosMes: Math.round(sumaSedes("gastosMes") * 10) / 10,
      ahorro: Math.round(sumaSedes("ahorro") * 10) / 10,
      recurrenciaProm: SEDES.length ? Math.round(SEDES.reduce((a, s) => a + s.recurrencia, 0) / SEDES.length) : 0,
    };
    r.ec = {};
    EC.forEach(e => { r.ec[e] = SEDES.reduce((a, s) => a + (s.ec[e] || 0), 0); });
    // series de asistencia agregadas por domingo
    const fechas = SEDES.length ? SEDES[0].asistDom.map(x => x.f) : [];
    r.asistDom = fechas.map((f, i) => ({ f, v: SEDES.reduce((a, s) => a + (s.asistDom[i] ? s.asistDom[i].v : 0), 0) }));
    r.kidsDom = fechas.map((f, i) => ({ f, v: SEDES.reduce((a, s) => a + (s.kidsDom[i] ? s.kidsDom[i].v : 0), 0) }));
    // suma en vivo de la sede madre (no recalcula el seed, solo añade el delta)
    const lv = live();
    r.nuevosMes += lv.inscritosCafe;
    r.personas += lv.inscritosCafe;
    r._live = lv;
    return r;
  }
  // completar TEAM_DATA con sumas
  (function fillTeam() {
    const R = red();
    TEAM_DATA.contabilidad.kpis.ingresosRed = R.diezmoMes;
    TEAM_DATA.contabilidad.kpis.egresosRed = R.gastosMes;
    TEAM_DATA.contabilidad.cuentas[0].saldo = R.diezmoMes;
    TEAM_DATA.contabilidad.cuentas[1].saldo = TEAM_DATA.rrhh.nomina.mensual;
    TEAM_DATA.contabilidad.cuentas[2].saldo = Math.round(R.gastosMes * 0.34 * 10) / 10;
    TEAM_DATA.contabilidad.cuentas[3].saldo = Math.round(R.gastosMes * 0.22 * 10) / 10;
    TEAM_DATA.rrhh.headcount = TEAM_DATA.rrhh.contratos.indefinido + TEAM_DATA.rrhh.contratos.fijo + TEAM_DATA.rrhh.contratos.prestacion + TEAM_DATA.rrhh.contratos.aprendiz;
    TEAM_DATA.instituto.inscritosIbli = R.instIbli;
    TEAM_DATA.instituto.inscritosFacter = R.instFacter;
    // repartir por semestre de forma determinista
    const semIbli = [0.4, 0.28, 0.2, 0.12], semFac = [0.42, 0.28, 0.18, 0.12];
    for (let i = 0; i < 4; i++) TEAM_DATA.instituto.semestres[i].n = Math.round(R.instIbli * semIbli[i]);
    for (let i = 0; i < 4; i++) TEAM_DATA.instituto.semestres[4 + i].n = Math.round(R.instFacter * semFac[i]);
    TEAM_DATA.comunicaciones.campanas[0].alcance = Math.round(R.asistentes * 0.6);
    TEAM_DATA.comunicaciones.campanas[2].alcance = Math.round(R.asistentes * 0.4);
  })();

  /* ============================================================
     window.CENTRAL — lectura
     ============================================================ */
  window.CENTRAL = {
    USER, SEDES, EQUIPOS_DEF, EQUIPO_CENTRAL, ESPACIOS, TEAM_DATA, MIN_NOMBRES, EC, HOY,
    uid, ini, deaccent,
    red, crmMaster, live,
    sede(id) {
      const s = SEDES.find(x => x.id === id);
      if (s && s.esMadre) {
        // sede madre: refleja en vivo lo que ocurre en la operación de Bogotá
        const lv = live();
        return Object.assign({}, s, { _live: lv, nuevosMes: s.nuevosMes + lv.inscritosCafe });
      }
      return s;
    },
    personasSede(id) { return crmMaster().filter(p => p.sede === id); },
    equipo(id) { return EQUIPOS_DEF.find(e => e.id === id); },
    _seed: { orgSeed, EVENTOS_CORP, requerimientos: genRequerimientos, peticionesInternas: PETICIONES_INTERNAS },
  };

  /* ============================================================ MODO ENTREGA
     Vacío total del sistema del Pastor Director General (para repartir en 0).
     Conserva: usuario, catálogo de equipos (EQUIPOS_DEF) y espacios. Vacía:
     red de sedes, CRM master, equipo central, eventos, peticiones y datos ERP. */
  if (typeof window !== "undefined" && window.CASAROCA_ENTREGA) {
    SEDES.length = 0; _crmCache = [];
    EQUIPO_CENTRAL.length = 0; EVENTOS_CORP.length = 0; PETICIONES_INTERNAS.length = 0;
    (function cero(o) {
      if (!o || typeof o !== "object") return;
      if (Array.isArray(o)) { o.length = 0; return; }
      Object.keys(o).forEach(k => {
        const v = o[k];
        if (Array.isArray(v)) o[k] = [];
        else if (typeof v === "number") o[k] = 0;
        else if (v && typeof v === "object") cero(v);
      });
    })(TEAM_DATA);
  }

  /* ============================================================
     window.CSTORE — estado editable persistente (localStorage)
     ============================================================ */
  window.CSTORE = (function () {
    const KEY = "casaroca_central_v1";
    const hasLS = (function () { try { return typeof localStorage !== "undefined" && localStorage !== null; } catch (e) { return false; } })();
    let mem = null;
    function read() { if (hasLS) { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } } return mem; }
    function write(o) { if (hasLS) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { } } else { mem = o; } }
    const SEED = {
      v: 2,
      org: orgSeed(),
      eventos: EVENTOS_CORP.map(e => Object.assign({}, e)),
      espacios: ESPACIOS.map(e => Object.assign({}, e)),
      requerimientos: genRequerimientos(),
      peticiones: PETICIONES_INTERNAS.map(p => Object.assign({}, p)),
      aprobaciones: {}, // id -> "aprobado" | "rechazado"
    };
    const ENTREGA = (typeof window !== "undefined" && window.CASAROCA_ENTREGA);
    let DATA = (function () {
      let d = read();
      if (!d || d.v !== 2) {
        d = ENTREGA
          ? { v: 2, org: [], eventos: [], espacios: ESPACIOS.map(e => Object.assign({}, e)), requerimientos: [], peticiones: [], aprobaciones: {} }
          : JSON.parse(JSON.stringify(SEED));
        write(d);
      }
      return d;
    })();
    const subs = [];
    function emit() { subs.forEach(cb => { try { cb(); } catch (e) { } }); }
    function persist() { write(DATA); emit(); }
    if (hasLS && typeof window !== "undefined" && window.addEventListener) {
      window.addEventListener("storage", e => { if (e.key === KEY) { DATA = read() || DATA; emit(); } });
    }
    return {
      KEY, onCambio(cb) { subs.push(cb); return () => { const i = subs.indexOf(cb); if (i >= 0) subs.splice(i, 1); }; },
      resetDemo() { DATA = JSON.parse(JSON.stringify(SEED)); persist(); },
      /* --- organigrama --- */
      org() { return DATA.org.map(n => Object.assign({}, n)); },
      addNodo(n) { const nodo = Object.assign({ id: uid("o") }, n); DATA.org.push(nodo); persist(); return nodo; },
      editNodo(id, patch) { const n = DATA.org.find(x => x.id === id); if (n) { Object.assign(n, patch); persist(); } return n; },
      delNodo(id) {
        // borra el nodo y reasigna hijos al padre (conserva el sistema/sede)
        const n = DATA.org.find(x => x.id === id); if (!n) return;
        DATA.org.filter(x => x.parent === id).forEach(x => x.parent = n.parent);
        DATA.org = DATA.org.filter(x => x.id !== id); persist();
      },
      crearPastorSede(sedeId, nombre, rol, conyuge) {
        const nodo = { id: uid("o"), nombre, conyuge: conyuge || "", rol: (rol || "Pastor Congregacional") + " · " + (window.CENTRAL.sede(sedeId) || {}).nombreCorto, parent: "o_filiales", tipo: "sede", sedeId };
        DATA.org.push(nodo); persist(); return nodo;
      },
      /* --- calendario corporativo --- */
      eventos() { return DATA.eventos.map(e => Object.assign({}, e)); },
      addEvento(e) { const ev = Object.assign({ id: uid("cev") }, e); DATA.eventos.push(ev); persist(); return ev; },
      delEvento(id) { DATA.eventos = DATA.eventos.filter(e => e.id !== id); persist(); },
      espacios() { return DATA.espacios.map(e => Object.assign({}, e)); },
      addEspacio(e) { const es = Object.assign({ id: uid("esp") }, e); DATA.espacios.push(es); persist(); return es; },
      delEspacio(id) { DATA.espacios = DATA.espacios.filter(e => e.id !== id); persist(); },
      eventosEnEspacio(id) { return DATA.eventos.filter(e => e.espacioId === id).length; },
      libre(espacioId, fecha, hi, hf, ignoreId) {
        return !DATA.eventos.some(e => e.id !== ignoreId && e.espacioId === espacioId && e.fecha === fecha && !(hf <= e.horaInicio || hi >= e.horaFin));
      },
      /* --- requerimientos --- */
      requerimientos() { return DATA.requerimientos.map(r => Object.assign({}, r)); },
      reqResponder(id, texto, de) { const r = DATA.requerimientos.find(x => x.id === id); if (r) { r.respuestas = r.respuestas || []; r.respuestas.push({ de: de || "Dirección General", fecha: window.CENTRAL.HOY, texto }); r.estado = "En proceso"; persist(); } return r; },
      reqEstado(id, estado) { const r = DATA.requerimientos.find(x => x.id === id); if (r) { r.estado = estado; persist(); } return r; },
      /* --- peticiones internas --- */
      peticiones() { return DATA.peticiones.map(p => Object.assign({}, p)); },
      addPeticion(p) { const pe = Object.assign({ id: uid("peti"), fecha: window.CENTRAL.HOY, estado: "abierta", interna: true }, p); DATA.peticiones.unshift(pe); persist(); return pe; },
      petEstado(id, estado) { const p = DATA.peticiones.find(x => x.id === id); if (p) { p.estado = estado; persist(); } return p; },
      /* --- aprobaciones (colas de equipos) --- */
      aprobacion(id) { return DATA.aprobaciones[id] || null; },
      decidir(id, decision) { DATA.aprobaciones[id] = decision; persist(); },
    };
  })();
})();
