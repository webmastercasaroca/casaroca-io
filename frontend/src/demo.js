/**
 * MODO DEMOSTRACIÓN.
 *
 * ⛔ LÉASE ESTO ANTES DE TOCAR NADA DE AQUÍ.
 *
 * Este archivo devuelve datos INVENTADOS. Existe por una razón concreta y
 * limitada: que se pueda ver y recorrer la aplicación desde un teléfono
 * mientras la infraestructura no está aplicada y la API solo corre en un
 * portátil. Nada de lo que hay aquí sale de la base real, y nada de lo que
 * se escriba aquí llega a ninguna parte: vive en la memoria de la pestaña
 * y muere al cerrarla.
 *
 * ⛔ NO se enciende solo. Hace falta `?demo=1` en la dirección o
 *    `window.CASAROCA_DEMO = true`. Y cuando está encendido, la aplicación
 *    lo dice ARRIBA, en rojo, en todas las pantallas. Un sistema que
 *    guarda datos de menores no puede parecerse a su demostración sin que
 *    se note: la peor confusión posible es creer que se está mirando la
 *    realidad.
 *
 * Los nombres son inventados a propósito y las sedes llevan «(demo)».
 */

const hoy = new Date();
const d = (dias = 0) => new Date(hoy.getTime() + dias * 86400000).toISOString().slice(0, 10);
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/* ⛔ Faltaban `tipo`, `ciudad`, `pais` y `activa`, que la API real sí
   devuelve: tres pantallas pintaban esas columnas EN BLANCO (el Tablero
   de la red, Iglesias y sedes, y el Panel). */
const SEDES = [
  { id: id(1), codigo: 'BOG-NORTE', nombre: 'Bogotá Norte (demo)', tipo: 'sede_madre',
    pais: 'CO', ciudad: 'Bogotá', activa: true, ministerios_activos: 6 },
  { id: id(2), codigo: 'MED', nombre: 'Medellín (demo)', tipo: 'filial_nacional',
    pais: 'CO', ciudad: 'Medellín', activa: true, ministerios_activos: 4 },
  { id: id(3), codigo: 'CHIA', nombre: 'Chía (demo)', tipo: 'plantacion',
    pais: 'CO', ciudad: 'Chía', activa: true, ministerios_activos: 2 },
];

const PERSONAS = [
  'Marta Quiroga Peña', 'Andrés Beltrán Ruiz', 'Lucía Naranjo Díaz', 'Tomás Ibarra Cano',
  'Elena Vargas Toro', 'Julián Espinosa Mora', 'Rosa Cifuentes Lara', 'Damián Rueda Silva',
].map((nombre, i) => ({
  id: id(100 + i), nombre, nombre_completo: nombre,
  numero_documento: String(1020304050 + i * 7), documento: String(1020304050 + i * 7),
  sede: SEDES[i % 3].codigo, sede_codigo: SEDES[i % 3].codigo, estado: 'activa',
}));


/* ═══════════════════════════════════════════════════════════════════
   GOBIERNO DE LA RED · el estado que SÍ cambia
   Lo que se marca en la consola de demostración tiene que quedarse
   marcado mientras dure la pestaña. No llega a ninguna base: vive aquí.
   ═══════════════════════════════════════════════════════════════════ */
const MODULOS_DEMO = [
  { codigo: 'personas',   nombre: 'Personas',              esquema: 'nucleo',    nivel_dato: 2, es_nucleo: true,  exige_compuerta_legal: false, depende_de: null,       orden: 1 },
  { codigo: 'organizacion', nombre: 'Organización y sedes', esquema: 'org',      nivel_dato: 1, es_nucleo: true,  exige_compuerta_legal: false, depende_de: null,       orden: 2 },
  { codigo: 'identidad',  nombre: 'Identidad y accesos',   esquema: 'identidad', nivel_dato: 2, es_nucleo: true,  exige_compuerta_legal: false, depende_de: null,       orden: 3 },
  { codigo: 'auditoria',  nombre: 'Auditoría y cumplimiento', esquema: 'plataforma', nivel_dato: 2, es_nucleo: true, exige_compuerta_legal: false, depende_de: null,   orden: 4 },
  { codigo: 'crm',        nombre: 'CRM Pastoral · 4C',     esquema: 'crm',       nivel_dato: 2, es_nucleo: false, exige_compuerta_legal: false, depende_de: 'personas', orden: 5 },
  { codigo: 'grupos',     nombre: 'Grupos y hogares',      esquema: 'grupos',    nivel_dato: 2, es_nucleo: false, exige_compuerta_legal: false, depende_de: 'personas', orden: 6 },
  { codigo: 'asistencia', nombre: 'Asistencia',            esquema: 'asistencia',nivel_dato: 2, es_nucleo: false, exige_compuerta_legal: false, depende_de: 'personas', orden: 7 },
  { codigo: 'formacion',  nombre: 'Formación e Instituto', esquema: 'formacion', nivel_dato: 2, es_nucleo: false, exige_compuerta_legal: false, depende_de: 'personas', orden: 8 },
  { codigo: 'talento',    nombre: 'Talento y voluntariado',esquema: 'talento',   nivel_dato: 3, es_nucleo: false, exige_compuerta_legal: true,  depende_de: 'personas', orden: 9 },
  { codigo: 'consejeria', nombre: 'Consejería',            esquema: 'consejeria',nivel_dato: 3, es_nucleo: false, exige_compuerta_legal: true,  depende_de: 'personas', orden: 10 },
  { codigo: 'aportes',    nombre: 'Aportes',               esquema: 'aportes',   nivel_dato: 3, es_nucleo: false, exige_compuerta_legal: true,  depende_de: 'personas', orden: 11 },
  { codigo: 'rocakids',   nombre: 'RocaKids',              esquema: 'rocakids',  nivel_dato: 4, es_nucleo: false, exige_compuerta_legal: true,  depende_de: 'personas', orden: 12 },
  { codigo: 'analitica',  nombre: 'Analítica y tableros',  esquema: 'analitica', nivel_dato: 2, es_nucleo: false, exige_compuerta_legal: false, depende_de: null,       orden: 13 },
  { codigo: 'tareas',     nombre: 'Tareas',                esquema: 'tareas',    nivel_dato: 1, es_nucleo: false, exige_compuerta_legal: false, depende_de: null,       orden: 14 },
  { codigo: 'calendario', nombre: 'Calendario',            esquema: 'calendario',nivel_dato: 1, es_nucleo: false, exige_compuerta_legal: false, depende_de: null,       orden: 15 },
  { codigo: 'oracion',    nombre: 'Peticiones de oración', esquema: 'oracion',   nivel_dato: 3, es_nucleo: false, exige_compuerta_legal: true,  depende_de: 'personas', orden: 16 },
  { codigo: 'comunicaciones', nombre: 'Comunicaciones',    esquema: 'notificaciones', nivel_dato: 2, es_nucleo: false, exige_compuerta_legal: false, depende_de: null, orden: 17 },
  { codigo: 'construccion', nombre: 'Construcción',        esquema: 'construccion', nivel_dato: 1, es_nucleo: false, exige_compuerta_legal: false, depende_de: null,   orden: 18 },
];

const ACCIONES_DEMO = [
  { codigo: 'ver', nombre: 'Ver', orden: 1, es_sensible: false, modulo: null },
  { codigo: 'crear', nombre: 'Crear', orden: 2, es_sensible: false, modulo: null },
  { codigo: 'editar', nombre: 'Editar', orden: 3, es_sensible: false, modulo: null },
  { codigo: 'anular', nombre: 'Anular', orden: 4, es_sensible: true, modulo: null },
  { codigo: 'exportar', nombre: 'Exportar', orden: 5, es_sensible: true, modulo: null },
  { codigo: 'administrar', nombre: 'Administrar', orden: 6, es_sensible: true, modulo: null },
  { codigo: 'REGISTRAR_APORTE', nombre: 'Registrar un aporte', orden: 10, es_sensible: false, modulo: 'aportes' },
  { codigo: 'EXPEDIR_CERTIFICADO', nombre: 'Expedir certificado', orden: 11, es_sensible: true, modulo: 'aportes' },
  { codigo: 'VER_REPORTES_FINANCIEROS', nombre: 'Ver reportes financieros', orden: 12, es_sensible: true, modulo: 'aportes' },
  { codigo: 'TOMAR_ASISTENCIA', nombre: 'Tomar asistencia', orden: 13, es_sensible: false, modulo: 'asistencia' },
  { codigo: 'VER_NOTAS_CONFIDENCIALES', nombre: 'Ver notas de consejería', orden: 14, es_sensible: true, modulo: 'consejeria' },
  { codigo: 'ENTREGAR_MENOR', nombre: 'Entregar un menor', orden: 15, es_sensible: true, modulo: 'rocakids' },
  { codigo: 'REGISTRAR_CONTACTO', nombre: 'Registrar contacto', orden: 16, es_sensible: false, modulo: 'crm' },
];

const ROLES_DEMO = [
  { codigo: 'PASTOR_DIRECTOR_GENERAL', nombre: 'Pastor Director General', alcance_maximo: 'organizacion', nivel_maximo: 4, descripcion: 'Dirige la red entera: despliega iglesias y otorga accesos.', activo: true },
  { codigo: 'PASTOR_CONGREGACIONAL', nombre: 'Pastor congregacional', alcance_maximo: 'sede', nivel_maximo: 3, descripcion: 'Pastorea una iglesia y responde por su gente.', activo: true },
  { codigo: 'TESORERIA', nombre: 'Tesorería', alcance_maximo: 'organizacion', nivel_maximo: 3, descripcion: 'Diezmos, ofrendas y certificados de toda la red.', activo: true },
  { codigo: 'CONTABILIDAD', nombre: 'Contabilidad', alcance_maximo: 'organizacion', nivel_maximo: 3, descripcion: 'Contabilidad consolidada de las 36 sedes.', activo: true },
  { codigo: 'SECRETARIA', nombre: 'Secretaría de sede', alcance_maximo: 'sede', nivel_maximo: 2, descripcion: 'Registra personas y lleva la agenda de la sede.', activo: true },
  { codigo: 'MAESTRO_ROCAKIDS', nombre: 'Maestro de RocaKids', alcance_maximo: 'ministerio', nivel_maximo: 4, descripcion: 'Atiende a los menores en su sala.', activo: true },
  { codigo: 'CONSEJERO', nombre: 'Consejero', alcance_maximo: 'caso_propio', nivel_maximo: 3, descripcion: 'Acompaña casos de consejería, solo los suyos.', activo: true },
  { codigo: 'AUDITOR', nombre: 'Auditor', alcance_maximo: 'organizacion', nivel_maximo: 3, descripcion: 'Mira y no toca: revisa sin poder cambiar nada.', activo: true },
];

const NIVELES_DEMO = [
  { nivel: 0, codigo: 'N0', descripcion: 'Público. Puede salir del sistema sin control.', exige_cifrado: false, exige_bitacora_lect: false },
  { nivel: 1, codigo: 'N1', descripcion: 'Interno. Lo ve quien trabaja en la iglesia.', exige_cifrado: false, exige_bitacora_lect: false },
  { nivel: 2, codigo: 'N2', descripcion: 'Personal. Datos de identificación de una persona.', exige_cifrado: false, exige_bitacora_lect: false },
  { nivel: 3, codigo: 'N3', descripcion: 'Sensible. Salud, finanzas, consejería.', exige_cifrado: true, exige_bitacora_lect: true },
  { nivel: 4, codigo: 'N4', descripcion: 'Menores y lo más delicado. Toda lectura queda registrada.', exige_cifrado: true, exige_bitacora_lect: true },
];

const TIPOS_DOC_DEMO = [
  { codigo: 'CC', etiqueta: 'Cédula de ciudadanía', descripcion: 'Mayores de edad colombianos.' },
  { codigo: 'TI', etiqueta: 'Tarjeta de identidad', descripcion: 'De 7 a 17 años.' },
  { codigo: 'RC', etiqueta: 'Registro civil', descripcion: 'Menores de 7 años.' },
  { codigo: 'CE', etiqueta: 'Cédula de extranjería', descripcion: 'Extranjeros residentes.' },
  { codigo: 'PA', etiqueta: 'Pasaporte', descripcion: 'Extranjeros sin cédula de extranjería.' },
];

/* Lo que cambia mientras la pestaña esté abierta. */
const G = {
  roles: ROLES_DEMO.map(r => ({ ...r })),
  /* «ROL|modulo|accion» de lo que está marcado. */
  matriz: new Set([
    'PASTOR_DIRECTOR_GENERAL|personas|ver', 'PASTOR_DIRECTOR_GENERAL|personas|crear',
    'PASTOR_DIRECTOR_GENERAL|personas|editar', 'PASTOR_DIRECTOR_GENERAL|identidad|administrar',
    'PASTOR_CONGREGACIONAL|personas|ver', 'PASTOR_CONGREGACIONAL|personas|crear',
    'PASTOR_CONGREGACIONAL|grupos|ver', 'PASTOR_CONGREGACIONAL|asistencia|ver',
    'PASTOR_CONGREGACIONAL|asistencia|TOMAR_ASISTENCIA',
    'TESORERIA|aportes|ver', 'TESORERIA|aportes|REGISTRAR_APORTE',
    'TESORERIA|aportes|EXPEDIR_CERTIFICADO', 'TESORERIA|aportes|VER_REPORTES_FINANCIEROS',
    'TESORERIA|personas|ver',
    'CONTABILIDAD|aportes|ver', 'CONTABILIDAD|aportes|VER_REPORTES_FINANCIEROS',
    'SECRETARIA|personas|ver', 'SECRETARIA|personas|crear', 'SECRETARIA|calendario|ver',
    'MAESTRO_ROCAKIDS|rocakids|ver', 'MAESTRO_ROCAKIDS|rocakids|ENTREGAR_MENOR',
    'CONSEJERO|consejeria|ver', 'CONSEJERO|consejeria|VER_NOTAS_CONFIDENCIALES',
    'AUDITOR|auditoria|ver', 'AUDITOR|personas|ver', 'AUDITOR|aportes|ver',
  ]),
  plantillas: [
    { codigo: 'PLANTACION', nombre: 'Plantación', tipo_sede: 'plantacion',
      descripcion: 'Lo mínimo para arrancar una iglesia nueva.',
      modulos: new Set(['personas','organizacion','identidad','auditoria','crm','grupos','asistencia','calendario','tareas','comunicaciones']) },
    { codigo: 'FILIAL', nombre: 'Filial nacional', tipo_sede: 'filial_nacional',
      descripcion: 'Una iglesia completa, con aportes y RocaKids.',
      modulos: new Set(MODULOS_DEMO.filter(m => m.codigo !== 'construccion').map(m => m.codigo)) },
  ],
  /* sedeId → { modulo: { activo, evidencia } } */
  modulosSede: {},
  /* Roles otorgados a personas: personaId → [{ id, rol, ... }] */
  asignaciones: {},
};

/* La primera sede nace completa y las otras con la plantilla de plantación. */
for (const [i, sede] of SEDES.entries()) {
  const trae = i === 0 ? G.plantillas[1].modulos : G.plantillas[0].modulos;
  G.modulosSede[sede.id] = {};
  for (const m of MODULOS_DEMO) {
    const dentro = trae.has(m.codigo);
    G.modulosSede[sede.id][m.codigo] = {
      activo: dentro && !m.exige_compuerta_legal,
      evidencia: null,
    };
  }
}
G.modulosSede[SEDES[0].id].aportes = { activo: true, evidencia: 'ACTA-DIAN-2026-03' };

const rolDe = (c) => G.roles.find(r => r.codigo === c);
const accionesDe = (mod) => ACCIONES_DEMO.filter(a => !a.modulo || a.modulo === mod);
const noEnDemo = (m) => { const e = new Error(m); e.demo = true; throw e; };

const ACU_NOMBRES = ['Marta Quiroga Peña', 'Andrés Beltrán Ruiz', 'Rosa Cifuentes Lara', 'Julián Espinosa Mora'];

/* ── RocaKids, Catálogos y las sedes completas ─────────────────────
   Con la forma EXACTA de la API real: un arreglo plano y los mismos
   nombres de campo. Una demostración que devuelve otra forma no enseña
   el sistema: enseña un error de JavaScript. */
const SALAS = [
  { id: id(960), codigo: 'CUNA', nombre: 'Cuna (0 a 2)', sede_id: id(1), sede_codigo: 'BOG-NORTE',
    edad_min: 0, edad_max: 2, capacidad: 20, ninos_dentro: 12, adultos: 3, regla_dos_adultos: true },
  { id: id(961), codigo: 'EXPLO', nombre: 'Exploradores (6 a 8)', sede_id: id(1), sede_codigo: 'BOG-NORTE',
    edad_min: 6, edad_max: 8, capacidad: 30, ninos_dentro: 21, adultos: 1, regla_dos_adultos: false },
  { id: id(962), codigo: 'AVENT', nombre: 'Aventureros (9 a 11)', sede_id: id(2), sede_codigo: 'MED',
    edad_min: 9, edad_max: 11, capacidad: 25, ninos_dentro: 8, adultos: 2, regla_dos_adultos: true },
];

const MENORES = [
  'Sara Quiroga', 'Matías Beltrán', 'Emilia Naranjo', 'Tomás Ibarra',
  'Valentina Vargas', 'Samuel Espinosa', 'Antonia Cifuentes', 'Martín Rueda',
].map((menor, i) => ({
  menor_id: id(820 + i), menor, edad: 1 + (i % 10),
  sala_id: SALAS[i % 3].id, esta_dentro: i < 3, codigo: null,
  alergias: i === 2 ? 'Maní' : null, acudiente_principal: ACU_NOMBRES[i % 4],
}));

const ACUDIENTES = [
  { acudiente: 'Marta Quiroga Peña', parentesco: 'madre', autoriza_retiro: true, telefono: '300 000 0001' },
  { acudiente: 'Andrés Beltrán Ruiz', parentesco: 'padre', autoriza_retiro: true, telefono: '300 000 0002' },
  { acudiente: 'Rosa Cifuentes Lara', parentesco: 'abuela', autoriza_retiro: false, telefono: '300 000 0003' },
];

/* Lo que mira el comité trimestral y la vigilancia de accesos. */
const RECERT = [
  { asignacion_id: id(770), persona_id: id(100), persona: 'Marta Quiroga Peña', rol: 'TESORERIA',
    alcance_tipo: 'organizacion', nivel_max: 3, vigente_desde: d(-260),
    ultima_revision: null, dias_sin_revisar: 260, tope_dias: 90, vencido: true },
  { asignacion_id: id(771), persona_id: id(101), persona: 'Andrés Beltrán Ruiz', rol: 'PASTOR_CONGREGACIONAL',
    alcance_tipo: 'sede', nivel_max: 3, vigente_desde: d(-400),
    ultima_revision: d(-120), dias_sin_revisar: 120, tope_dias: 90, vencido: true },
  { asignacion_id: id(772), persona_id: id(102), persona: 'Lucía Naranjo Díaz', rol: 'SECRETARIA',
    alcance_tipo: 'sede', nivel_max: 2, vigente_desde: d(-40),
    ultima_revision: null, dias_sin_revisar: 40, tope_dias: 180, vencido: false },
];

const SESIONES = [
  { sesion: id(780), usuario: 'marta@casaroca.org', persona_id: id(100), persona: 'Marta Quiroga Peña',
    emitida_en: new Date(Date.now() - 42 * 60000).toISOString(),
    expira_en: new Date(Date.now() + 18 * 60000).toISOString(),
    ip: '190.0.0.2', agente: 'Safari · iPhone', le_queda: '18 min' },
  { sesion: id(781), usuario: 'andrés@casaroca.org', persona_id: id(101), persona: 'Andrés Beltrán Ruiz',
    emitida_en: new Date(Date.now() - 6 * 3600000).toISOString(),
    expira_en: new Date(Date.now() + 2 * 3600000).toISOString(),
    ip: '190.0.0.7', agente: 'Chrome · Windows', le_queda: '2 h 4 min' },
];

const UNIDADES = [
  { id: id(700), codigo: 'CENTRAL', nombre: 'Casa Sobre la Roca · Central', clase: 'central', padre_id: null,
    proposito: 'Administra la red completa: da servicios a las sedes y no las reemplaza.',
    activa: true, padre: null, lider: null, integrantes: '6', roles: '2' },
  { id: id(701), codigo: 'TESORERIA', nombre: 'Tesorería de la red', clase: 'equipo', padre_id: id(700),
    proposito: 'Administra diezmos, ofrendas y certificados de toda la red.',
    activa: true, padre: 'Casa Sobre la Roca · Central', lider: null, integrantes: '3', roles: '1' },
  { id: id(702), codigo: 'CONTA', nombre: 'Contabilidad', clase: 'equipo', padre_id: id(700),
    proposito: 'Lleva la contabilidad consolidada de las 36 sedes.',
    activa: true, padre: 'Casa Sobre la Roca · Central', lider: null, integrantes: '2', roles: '1' },
  { id: id(703), codigo: 'REG-ANDINA', nombre: 'Región Andina', clase: 'region', padre_id: id(700),
    proposito: 'Acompaña a las sedes de la región.',
    activa: true, padre: 'Casa Sobre la Roca · Central', lider: null, integrantes: '1', roles: '0' },
];

const CATALOGOS = [
  { codigo: 'estado_civil', nombre: 'Estado civil',
    descripcion: 'Lista abierta: cambia con la ley y con la realidad de la gente.',
    editable_por_sede: false, cerrado: false, motivo_cerrado: null,
    valores_vigentes: 6, valores_retirados: 1,
    valores: [
      { codigo: 'soltero', etiqueta: 'Soltero o soltera' }, { codigo: 'casado', etiqueta: 'Casado o casada' },
      { codigo: 'union', etiqueta: 'Unión libre' }, { codigo: 'separado', etiqueta: 'Separado o separada' },
      { codigo: 'divorciado', etiqueta: 'Divorciado o divorciada' }, { codigo: 'viudo', etiqueta: 'Viudo o viuda' }] },
  { codigo: 'medio_pago', nombre: 'Medio de pago',
    descripcion: 'Aparecen medios nuevos cada año: se agregan sin tocar código.',
    editable_por_sede: true, cerrado: false, motivo_cerrado: null,
    valores_vigentes: 4, valores_retirados: 0,
    valores: [
      { codigo: 'efectivo', etiqueta: 'Efectivo' }, { codigo: 'transferencia', etiqueta: 'Transferencia' },
      { codigo: 'tarjeta', etiqueta: 'Tarjeta' }, { codigo: 'nequi', etiqueta: 'Nequi' }] },
  { codigo: 'nivel_sensibilidad', nombre: 'Nivel de sensibilidad',
    descripcion: 'Qué tan delicado es un dato.',
    editable_por_sede: false, cerrado: true,
    motivo_cerrado: 'Lo fija la política de datos, no la operación.',
    valores_vigentes: 5, valores_retirados: 0,
    valores: [
      { codigo: 'N0', etiqueta: 'Público' }, { codigo: 'N1', etiqueta: 'Interno' },
      { codigo: 'N2', etiqueta: 'Personal' }, { codigo: 'N3', etiqueta: 'Sensible' },
      { codigo: 'N4', etiqueta: 'Menores y lo más delicado' }] },
];

const SERVICIOS = [
  { id: id(200), sede: 'BOG-NORTE', fecha: d(0), hora: '09:00', tipo: 'dominical', nombre: 'Primera reunión', marcados: 3, contados: 412, adultos: 280, jovenes: 70, ninos: 62, primera_vez: 9 },
  { id: id(201), sede: 'BOG-NORTE', fecha: d(-7), hora: '09:00', tipo: 'dominical', nombre: 'Primera reunión', marcados: 5, contados: 398, adultos: 270, jovenes: 66, ninos: 62, primera_vez: 6 },
  { id: id(202), sede: 'MED', fecha: d(0), hora: '10:30', tipo: 'dominical', nombre: null, marcados: 0, contados: null },
];

const GRUPOS = [
  { id: id(300), nombre: 'Hogar Los Rosales', tipo: 'hogar', sede: 'BOG-NORTE', dia_reunion: 'jueves', hora: '19:30', cupo: 14, miembros: 11, ultima_reunion: d(-4), dias_sin_reunirse: 4 },
  { id: id(301), nombre: 'Crecimiento Chapinero', tipo: 'pequeno', sede: 'BOG-NORTE', dia_reunion: 'martes', hora: '19:00', cupo: 12, miembros: 9, ultima_reunion: d(-52), dias_sin_reunirse: 52 },
  { id: id(302), nombre: 'Jóvenes Medellín', tipo: 'pequeno', sede: 'MED', dia_reunion: 'viernes', hora: '18:00', cupo: 20, miembros: 17, ultima_reunion: null, dias_sin_reunirse: null },
];

const CASOS = [
  { id: id(400), estado: 'en_proceso', topico: 'FAM', topico_nombre: 'Familia y matrimonio', requiere_profesional: false, sede: 'BOG-NORTE', consultante: 'Marta Quiroga Peña', dias_abierto: 23, sesiones: 3, ultima_sesion: d(-5), consejeros: 'Rosa Cifuentes Lara' },
  { id: id(401), estado: 'abierto', topico: 'DUELO', topico_nombre: 'Duelo', requiere_profesional: false, sede: 'MED', consultante: 'Tomás Ibarra Cano', dias_abierto: 2, sesiones: 0, ultima_sesion: null, consejeros: null },
];

const COHORTES = [
  { id: id(500), codigo: '2026-2', modalidad: 'presencial', inicia: d(-30), termina: d(60), cupo: 25, valor: '180000.00', moneda: 'COP', sede: 'BOG-NORTE', curso: 'Fundamentos de la fe', programa: 'Instituto Bíblico', docente: 'Julián Espinosa Mora', inscritos: 22, otorga_certificado: true },
  { id: id(501), codigo: 'KID-2026', modalidad: 'mixta', inicia: d(-10), termina: null, cupo: 12, valor: null, moneda: 'COP', sede: 'MED', curso: 'Enseñar a niños', programa: 'Formación de maestros', docente: null, inscritos: 14, otorga_certificado: true },
];

const VOLUNTARIADOS = [
  { id: id(600), persona_id: id(105), nombre_completo: 'Julián Espinosa Mora', funcion: 'Maestro de sala', estado: 'activo', desde: d(-400), hasta: null, trabaja_con_menores: true, apto_para_menores: true, ministerio: 'RocaKids', sede: 'BOG-NORTE' },
  { id: id(601), persona_id: id(107), nombre_completo: 'Damián Rueda Silva', funcion: 'Apoyo de sala', estado: 'activo', desde: d(-30), hasta: null, trabaja_con_menores: true, apto_para_menores: false, ministerio: 'RocaKids', sede: 'MED' },
  { id: id(602), persona_id: id(104), nombre_completo: 'Elena Vargas Toro', funcion: 'Ujier', estado: 'activo', desde: d(-90), hasta: null, trabaja_con_menores: false, apto_para_menores: false, ministerio: 'Servicio', sede: 'CHIA' },
];

/** Respuestas por ruta. La clave es «MÉTODO ruta» con los identificadores
    sustituidos por `:id`, igual que las declara el servidor. */
function responder(metodo, ruta, cuerpo = null) {
  const u = new URL(ruta, 'http://demo');
  const p = u.pathname.replace(/\/api\/v1/, '');
  const trozos = p.split('/').filter(Boolean);
  const q = u.searchParams;

  const M = {
    'POST /auth/entrar': () => ({ acceso: 'demo', refresco: 'demo', debeCambiarClave: false }),
    'POST /auth/salir': () => ({ ok: true }),
    'GET /sesion/yo': () => ({
      persona: { id: id(999), nombre: 'Visitante de la demostración', correo: null, documento: null },
      alcance: { sedes: SEDES.map(s => s.id), todaLaRed: true, nivelMax: 4 },
      asignaciones: [{ rol: 'PASTOR_DIRECTOR_GENERAL', rol_nombre: 'Pastor Director General',
                       alcance_tipo: 'organizacion', nivel_max: 4, vigente_desde: d(-900), vigente_hasta: null }],
      /* ⛔ Pintaba el CÓDIGO en minúscula («rocakids») en vez del nombre
         («RocaKids»), metía un módulo llamado 'sistemas' que NO EXISTE, y
         daba a Aportes un nivel de dato 2 cuando es 3. Los nombres y los
         niveles ya están en `MODULOS_DEMO`, en este mismo fichero. */
      modulos: MODULOS_DEMO
        .filter(m => m.codigo !== 'construccion')
        .map(m => ({ modulo: m.codigo, nombre: m.nombre, nivel_dato: m.nivel_dato })),
    }),
    'GET /organizacion/sedes': () => SEDES,
    'GET /organizacion/ministerios': () => [
      { id: id(700), nombre: 'RocaKids' }, { id: id(701), nombre: 'Servicio' }, { id: id(702), nombre: 'Alabanza' }],
    'GET /personas': () => {
      const t = (q.get('q') ?? '').toLowerCase();
      return PERSONAS.filter(x => !t || x.nombre.toLowerCase().includes(t));
    },
    'GET /asistencia/servicios': () => ({ total_filas: SERVICIOS.length, desde: 0, servicios: SERVICIOS }),
    'POST /asistencia/servicios': () => ({ id: id(299), fecha: d(0), hora: '09:00', mensaje: 'En la demostración nada se guarda.' }),
    'GET /asistencia/servicios/:id/marcados': () => ({
      total_filas: 3,
      marcados: PERSONAS.slice(0, 3).map((x, i) => ({
        id: i + 1, persona_id: x.id, nombre_completo: x.nombre,
        marcada_en: new Date(hoy.getTime() - i * 240000).toISOString(), medio: 'manual' })),
    }),
    'POST /asistencia/servicios/:id/marcar': () => ({ id: 9, repetido: false, marcada_en: new Date().toISOString() }),
    'POST /asistencia/servicios/:id/conteo': () => ({ total: 412, adultos: 280, jovenes: 70, ninos: 62, primera_vez: 9, marcados: 3, diferencia: 409, aviso: 'Contados 412 y marcados 3: el conteo es el número de la puerta, la lista es para el seguimiento.' }),
    'GET /grupos': () => ({ total_filas: GRUPOS.length, desde: 0, grupos: GRUPOS,
      aviso: '2 grupo(s) sin reunión reportada en más de 45 días, o sin ninguna. Un grupo que no se reúne es una lista.' }),
    'GET /grupos/:id': () => {
      const g = GRUPOS.find(x => x.id === trozos[1]) ?? GRUPOS[0];
      return { grupo: g, miembros: { activos: g.miembros, total: g.miembros + 2,
        lista: PERSONAS.slice(0, g.miembros > 5 ? 5 : g.miembros).map((p, i) => ({
          id: i, persona_id: p.id, nombre_completo: p.nombre, rol: i === 0 ? 'lider' : 'miembro',
          desde: d(-120 - i * 20), hasta: null, motivo_salida: null })) },
        reuniones: g.ultima_reunion ? [{ id: 1, fecha: g.ultima_reunion, tema: 'La paciencia', asistentes: 8 }] : [] };
    },
    'GET /consejeria/topicos': () => ({ total_filas: 3, topicos: [
      { codigo: 'FAM', nombre: 'Familia y matrimonio', categoria: 'relacional', requiere_profesional: false },
      { codigo: 'DUELO', nombre: 'Duelo', categoria: 'crisis', requiere_profesional: false },
      { codigo: 'SUICIDIO', nombre: 'Ideación suicida', categoria: 'crisis', requiere_profesional: true }] }),
    'GET /consejeria/casos': () => ({ total_filas: CASOS.length, desde: 0, casos: CASOS,
      aviso: '1 caso(s) abierto(s) SIN consejero asignado. Un caso sin nadie detrás es una persona esperando.' }),
    'GET /consejeria/casos/:id': () => {
      const k = CASOS.find(x => x.id === trozos[2]) ?? CASOS[0];
      return { caso: { ...k, cerrado_en: null, derivado_a: null, consultante_id: id(100) },
        asignaciones: k.consejeros ? [{ id: 1, consejero_id: id(106), consejero: k.consejeros, rol: 'consejero', desde: d(-20), hasta: null }] : [],
        sesiones: Array.from({ length: k.sesiones }, (_, i) => ({
          id: i, fecha: new Date(hoy.getTime() - (i + 1) * 7 * 86400000).toISOString(),
          consejero: k.consejeros, duracion_min: 60, modalidad: 'presencial', asistio: true })),
        notas: k.sesiones ? [{ id: 1, escrita_en: new Date(hoy.getTime() - 5 * 86400000).toISOString(),
          autor: k.consejeros, texto: 'Nota de ejemplo. En el sistema real esto no sale nunca de esta ficha.' }] : [],
        lectura_registrada: true };
    },
    'GET /formacion/programas': () => ({ total_filas: 2, programas: [
      { id: id(800), codigo: 'IBLI', nombre: 'Instituto Bíblico', tipo: 'instituto', semestres: 4, descripcion: 'Formación bíblica completa.', cursos: 12 },
      { id: id(801), codigo: 'MAEST', nombre: 'Formación de maestros', tipo: 'diplomado', semestres: 1, descripcion: 'Para quienes enseñan a niños.', cursos: 4 }] }),
    'GET /formacion/cursos': () => ({ total_filas: 2, cursos: [
      { id: id(850), codigo: 'FUND', nombre: 'Fundamentos de la fe', semestre: 1, horas: 40, otorga_certificado: true, programa: 'Instituto Bíblico' },
      { id: id(851), codigo: 'KID', nombre: 'Enseñar a niños', semestre: 1, horas: 24, otorga_certificado: true, programa: 'Formación de maestros' }] }),
    'GET /formacion/cohortes': () => ({ total_filas: COHORTES.length, desde: 0, cohortes: COHORTES,
      aviso: '1 cohorte(s) por encima del cupo. Es un problema de salón, no de informe.' }),
    'GET /formacion/cohortes/:id': () => {
      const h = COHORTES.find(x => x.id === trozos[2]) ?? COHORTES[0];
      return { cohorte: { ...h, horas: 40 },
        ocupacion: { inscritos: h.inscritos, cupo: h.cupo },
        inscritos: PERSONAS.slice(0, 5).map((p, i) => ({
          id: i, persona_id: p.id, nombre_completo: p.nombre,
          estado: ['cursando','cursando','aprobado','inscrito','retirado'][i],
          estado_pago: ['pagado','pendiente','pagado','exonerado','pendiente'][i],
          valor_pagado: null, nota_final: i === 2 ? '4.5' : null, inscrito_en: d(-25) })) };
    },
    'GET /talento/cargos': () => ({ total_filas: 2, cargos: [
      { id: id(900), codigo: 'PASTOR', nombre: 'Pastor congregacional', area: 'Pastoral', nivel_dato: 3 },
      { id: id(901), codigo: 'ADMIN', nombre: 'Administrador de sede', area: 'Administrativa', nivel_dato: 3 }] }),
    'GET /talento/contratos': () => ({ total_filas: 1, desde: 0, contratos: [
      { id: id(950), persona_id: id(101), nombre_completo: 'Andrés Beltrán Ruiz', tipo: 'indefinido',
        estado: 'activo', inicia: d(-700), termina: null, salario: null, moneda: 'COP',
        cargo: 'Pastor congregacional', area: 'Pastoral', sede: 'BOG-NORTE', vence_pronto: false }], aviso: null }),
    'GET /talento/voluntariados': () => ({ total_filas: VOLUNTARIADOS.length, desde: 0, voluntariados: VOLUNTARIADOS,
      aviso: '⛔ 1 voluntario(s) ACTIVOS con menores y SIN antecedentes vigentes: Damián Rueda Silva' }),
    'GET /talento/antecedentes/:id': () => {
      const apto = trozos[2] === id(105);
      return { apto_para_menores: apto,
        le_faltan: apto ? [] : [{ codigo: 'DELITOS_SEXUALES', nombre: 'Registro de delitos sexuales contra menores' }],
        antecedentes: apto ? [
          { id: 1, tipo: 'DELITOS_SEXUALES', tipo_nombre: 'Registro de delitos sexuales contra menores',
            resultado: 'apto', expedido_en: d(-200), vence_en: d(165), vencido: false, dias_restantes: 165 },
          { id: 2, tipo: 'JUDICIALES', tipo_nombre: 'Antecedentes judiciales',
            resultado: 'apto', expedido_en: d(-200), vence_en: d(20), vencido: false, dias_restantes: 20 }] : [],
        aviso: apto ? null : 'No está apto para estar con menores. Falta: Registro de delitos sexuales contra menores.' };
    },
    /* ⛔ Devolvía `{abiertos, cerrados}` y la API real devuelve un ARREGLO
       PLANO con `cerrado`, `motivo_cerrado` y `valores_vigentes`. La vista
       hacía `cats.filter(...)` y la pantalla entera salía en rojo con
       «cats.filter is not a function». */
    'GET /identidad/catalogos': () => CATALOGOS,
    'GET /identidad/catalogos/:id/valores': () => {
      const c = CATALOGOS.find(x => x.codigo === trozos[2]);
      return (c?.valores ?? []).map((v, i) => ({ ...v, orden: (i + 1) * 10, vigente: true }));
    },
    'POST /identidad/catalogos/:id/valores': () => {
      const c = CATALOGOS.find(x => x.codigo === trozos[2]);
      if (!c) noEnDemo('Ese catálogo no existe.');
      if (c.cerrado) noEnDemo(`«${c.nombre}» es un catálogo cerrado: ${c.motivo_cerrado}`);
      c.valores.push({ codigo: cuerpo?.codigo, etiqueta: cuerpo?.etiqueta });
      c.valores_vigentes = c.valores.length;
      return { mensaje: 'Valor agregado al catálogo.' };
    },
    /* ⛔ Devolvía un OBJETO `{total_filas, salas}` y la API real devuelve
       un ARREGLO PLANO. La vista hacía `salas.map(...)` y reventaba con
       «salas.map is not a function» EN PANTALLA. Peor: el objeto se
       guardaba antes en `localStorage`, así que la pestaña Niños quedaba
       rota de forma permanente hasta borrar el almacenamiento. */
    'GET /rocakids/salas': () => SALAS,
    'GET /rocakids/salas/:id/roster': () => {
      const sala = SALAS.find(x => x.id === trozos[2]) ?? SALAS[0];
      return MENORES.filter(m => m.sala_id === sala.id);
    },
    'GET /rocakids/menores/:id/acudientes': () => ACUDIENTES.map((a, i) => ({
      ...a, acudiente_id: id(880 + i), menor_id: trozos[2] })),
    'POST /rocakids/salas/:id/entrar-a-servir': () => {
      const sala = SALAS.find(x => x.id === trozos[2]) ?? SALAS[0];
      /* La API real llama a esta columna `adultos`, no `adultos_dentro`.
         Con el nombre equivocado, la pantalla leía `undefined`, lo tomaba
         como CERO y toda sala decía «0 adultos, la regla exige dos». */
      sala.adultos += 1;
      sala.regla_dos_adultos = sala.adultos >= 2;
      return { mensaje: 'Queda registrado sirviendo en ' + sala.nombre + '.',
               aviso: sala.regla_dos_adultos ? null : 'Todavía hay un solo adulto en la sala: no se puede abrir con menos de dos.' };
    },
    'POST /rocakids/checkin': () => {
      const m = MENORES.find(x => x.menor_id === cuerpo?.menorId);
      if (!m) noEnDemo('Ese menor no está en el censo de la sala.');
      if (m.esta_dentro) noEnDemo(`${m.menor} ya está dentro: no se registra dos veces.`);
      m.esta_dentro = true;
      m.codigo = String(Math.floor(1000 + Math.random() * 9000));
      const sala = SALAS.find(s => s.id === m.sala_id);
      if (sala) sala.ninos_dentro += 1;
      return { checkinId: id(970), codigo: m.codigo, repetido: false,
               aviso: 'Este código se muestra UNA sola vez: sin él no se entrega al niño.' };
    },
    'POST /rocakids/entregar': () => {
      const m = MENORES.find(x => x.esta_dentro && x.codigo === String(cuerpo?.codigo ?? '').trim());
      if (!m) noEnDemo('Ese código no corresponde a ningún niño dentro de la sala.');
      m.esta_dentro = false; m.codigo = null;
      const sala = SALAS.find(s => s.id === m.sala_id);
      if (sala) sala.ninos_dentro = Math.max(0, sala.ninos_dentro - 1);
      return { mensaje: `${m.menor} fue entregado y queda registrado con hora y nombre de quien lo retiró.` };
    },
    /* ── Lo que se CREA desde la aplicación de los pastores ──────────
       ⛔ Ninguna de estas rutas estaba, así que cada «+ Crear…» respondía
          con el comodín. Ahora escriben en el estado de esta pestaña: se
          crea un grupo y aparece en la lista, como en el sistema real. */
    'POST /grupos': () => {
      if (!cuerpo?.nombre || !cuerpo?.sedeId) noEnDemo('Falta el nombre o la sede del grupo.');
      const sede = SEDES.find(x => x.id === cuerpo.sedeId) ?? SEDES[0];
      GRUPOS.unshift({ id: id(310 + GRUPOS.length), nombre: cuerpo.nombre, tipo: cuerpo.tipo ?? 'pequeno',
        sede: sede.codigo, dia_reunion: cuerpo.diaReunion ?? null, hora: cuerpo.hora ?? null,
        cupo: cuerpo.cupo ?? null, miembros: 0, ultima_reunion: null, dias_sin_reunirse: null });
      return { id: GRUPOS[0].id, mensaje: 'Grupo creado. Todavía no tiene a nadie dentro.' };
    },
    'POST /grupos/:id/reuniones': () => {
      const g = GRUPOS.find(x => x.id === trozos[1]);
      if (!g) noEnDemo('Ese grupo no existe.');
      g.ultima_reunion = cuerpo?.fecha ?? d(0); g.dias_sin_reunirse = 0;
      return { mensaje: 'Reunión reportada. El grupo sale de la lista de los que no se reúnen.' };
    },
    'POST /grupos/:id/miembros': () => {
      const g = GRUPOS.find(x => x.id === trozos[1]);
      if (!g) noEnDemo('Ese grupo no existe.');
      if (g.cupo && g.miembros >= g.cupo) noEnDemo(`«${g.nombre}» está en su cupo de ${g.cupo}.`);
      g.miembros += 1;
      return { mensaje: 'Entró al grupo.' };
    },
    'POST /grupos/:id/miembros/:id2/salir': () => {
      const g = GRUPOS.find(x => x.id === trozos[1]);
      if (!g) noEnDemo('Ese grupo no existe.');
      g.miembros = Math.max(0, g.miembros - 1);
      return { mensaje: 'Salió del grupo. Queda la fecha, no se borra el rastro.' };
    },

    'POST /consejeria/casos': () => {
      if (!cuerpo?.consultanteId) noEnDemo('Falta a quién se va a acompañar.');
      CASOS.unshift({ id: id(410 + CASOS.length), estado: 'abierto',
        topico: cuerpo.topico ?? 'OTRO', topico_nombre: 'Sin clasificar',
        requiere_profesional: false, sede: SEDES[0].codigo,
        consultante: PERSONAS.find(p => p.id === cuerpo.consultanteId)?.nombre ?? 'Persona de la demostración',
        dias_abierto: 0, sesiones: 0, ultima_sesion: null, consejeros: null });
      return { id: CASOS[0].id, mensaje: 'Caso abierto. Asígnele un consejero: sin consejero no avanza.' };
    },
    'POST /consejeria/casos/:id/asignar': () => {
      const c = CASOS.find(x => x.id === trozos[2]);
      if (!c) noEnDemo('Ese caso no existe.');
      c.consejeros = PERSONAS.find(p => p.id === cuerpo?.consejeroId)?.nombre ?? 'Consejero de la demostración';
      return { mensaje: 'Consejero asignado. Solo él y quien supervisa verán las notas.' };
    },
    'POST /consejeria/casos/:id/sesiones': () => {
      const c = CASOS.find(x => x.id === trozos[2]);
      if (!c) noEnDemo('Ese caso no existe.');
      c.sesiones += 1; c.ultima_sesion = d(0); c.estado = 'en_proceso';
      return { mensaje: 'Sesión registrada.' };
    },
    'POST /consejeria/casos/:id/notas': () => {
      if (!String(cuerpo?.texto ?? '').trim()) noEnDemo('Una nota vacía no se guarda.');
      return { mensaje: 'Nota guardada. Es N3: cada lectura queda registrada con nombre y hora.' };
    },
    'POST /consejeria/casos/:id/cerrar': () => {
      const c = CASOS.find(x => x.id === trozos[2]);
      if (!c) noEnDemo('Ese caso no existe.');
      if (!String(cuerpo?.motivo ?? cuerpo?.cierre ?? '').trim()) noEnDemo('Cerrar un caso exige escribir cómo terminó.');
      c.estado = 'cerrado';
      return { mensaje: 'Caso cerrado. Queda el histórico completo.' };
    },

    'POST /formacion/cohortes': () => {
      if (!cuerpo?.codigo) noEnDemo('Falta el código de la cohorte.');
      COHORTES.unshift({ id: id(510 + COHORTES.length), codigo: cuerpo.codigo,
        modalidad: cuerpo.modalidad ?? 'presencial', inicia: cuerpo.inicia ?? d(0),
        termina: cuerpo.termina ?? null, cupo: cuerpo.cupo ?? 20, valor: cuerpo.valor ?? null,
        moneda: 'COP', sede: SEDES[0].codigo, curso: 'Curso de la demostración',
        programa: 'Instituto Bíblico', docente: null, inscritos: 0, otorga_certificado: true });
      return { id: COHORTES[0].id, mensaje: 'Cohorte abierta. Ya se puede inscribir gente.' };
    },
    'POST /formacion/cohortes/:id/inscribir': () => {
      const h = COHORTES.find(x => x.id === trozos[2]);
      if (!h) noEnDemo('Esa cohorte no existe.');
      h.inscritos += 1;
      return { mensaje: h.inscritos > h.cupo
        ? 'Inscrito. ⚠️ La cohorte quedó POR ENCIMA del cupo: es un problema de salón, no de informe.'
        : 'Inscrito.' };
    },
    'POST /formacion/inscripciones/:id/calificar': () => {
      if (cuerpo?.nota === undefined || cuerpo?.nota === null) noEnDemo('Falta la nota.');
      return { mensaje: 'Calificación registrada.' };
    },

    'POST /talento/voluntariados': () => {
      if (!cuerpo?.personaId) noEnDemo('Falta a quién se registra.');
      const conMenores = cuerpo.trabajaConMenores === true;
      VOLUNTARIADOS.unshift({ id: id(610 + VOLUNTARIADOS.length), persona_id: cuerpo.personaId,
        nombre_completo: PERSONAS.find(p => p.id === cuerpo.personaId)?.nombre ?? 'Persona de la demostración',
        funcion: cuerpo.funcion ?? 'Sin función', estado: 'activo', desde: cuerpo.desde ?? d(0),
        hasta: null, trabaja_con_menores: conMenores, apto_para_menores: false,
        ministerio: 'RocaKids', sede: SEDES[0].codigo });
      return { id: VOLUNTARIADOS[0].id, mensaje: conMenores
        ? '⛔ Registrado, y marcado como que estará con MENORES: no puede servir hasta que tenga antecedentes vigentes.'
        : 'Voluntariado registrado.' };
    },
    'POST /talento/antecedentes': () => {
      if (!cuerpo?.tipo) noEnDemo('Falta qué antecedente se está registrando.');
      const v = VOLUNTARIADOS.find(x => x.persona_id === cuerpo.personaId);
      if (v && cuerpo.resultado === 'apto') v.apto_para_menores = true;
      return { mensaje: 'Antecedente registrado con su fecha de vencimiento.' };
    },
    'POST /talento/voluntariados/:id/terminar': () => {
      const v = VOLUNTARIADOS.find(x => x.id === trozos[2]);
      if (!v) noEnDemo('Ese voluntariado no existe.');
      if (!String(cuerpo?.motivo ?? '').trim()) noEnDemo('Terminar un voluntariado exige un motivo escrito.');
      v.estado = 'terminado'; v.hasta = d(0);
      return { mensaje: 'Voluntariado terminado. Queda el histórico.' };
    },

    /* ── Lo que puede cada quien, para la consola ────────────────── */
    'GET /identidad/personas/:id/asignaciones': () => G.asignaciones[trozos[2]] ?? [],
    'GET /identidad/personas/:id/efectivo': () => {
      const roles = (G.asignaciones[trozos[2]] ?? []).map(a => a.rol);
      const salida = [];
      for (const llave of G.matriz) {
        const [rol, modulo, accion] = llave.split('|');
        if (!roles.includes(rol)) continue;
        const m = MODULOS_DEMO.find(x => x.codigo === modulo);
        const a = ACCIONES_DEMO.find(x => x.codigo === accion);
        salida.push({ modulo, modulo_nombre: m?.nombre ?? modulo,
          accion, accion_nombre: a?.nombre ?? accion,
          nivel_max: rolDe(rol)?.nivel_maximo ?? 0 });
      }
      return salida;
    },

    /* ── Las tres acciones de una cuenta ─────────────────────────── */
    'POST /administracion/cuentas/:id/reiniciar-clave': () => ({
      clave_provisional: 'cedro brisa faro lazo ' + (10 + Math.floor(Math.random() * 89)),
      mensaje: 'Se cerraron todas sus sesiones. Tendrá que cambiarla al entrar.' }),
    'POST /administracion/cuentas/:id/desbloquear': () => ({
      mensaje: 'Cuenta desbloqueada. Los intentos fallidos vuelven a cero.' }),
    'POST /administracion/cuentas/:id/reiniciar-segundo-factor': () => ({
      mensaje: 'Segundo factor borrado. Lo volverá a configurar la próxima vez que entre.' }),

    /* ── Gobierno de la red · TODO esto reacciona de verdad ───────── */
    'GET /administracion/catalogo': () => ({
      modulos: MODULOS_DEMO, acciones: ACCIONES_DEMO, roles: G.roles,
      niveles: NIVELES_DEMO, tiposDocumento: TIPOS_DOC_DEMO }),

    'GET /administracion/matriz': () => {
      const codigo = q.get('rol') ?? G.roles[0].codigo;
      const r = rolDe(codigo) ?? G.roles[0];
      const filas = [];
      for (const m of MODULOS_DEMO) for (const a of accionesDe(m.codigo)) {
        filas.push({
          rol: r.codigo, rol_nombre: r.nombre, rol_techo: r.nivel_maximo,
          modulo: m.codigo, modulo_nombre: m.nombre, modulo_nivel: m.nivel_dato,
          accion: a.codigo, accion_nombre: a.nombre,
          marcado: G.matriz.has(`${r.codigo}|${m.codigo}|${a.codigo}`),
          nivel_max: null, acta_ref: null,
          /* Un permiso que engaña: el módulo guarda datos más sensibles
             que el techo del rol, así que existe y no deja ver nada. */
          por_encima: m.nivel_dato > r.nivel_maximo,
        });
      }
      return { total_filas: filas.length, matriz: filas, aviso: null };
    },

    'POST /administracion/matriz': () => {
      const { rol, modulo, accion, marcado } = cuerpo ?? {};
      const llave = `${rol}|${modulo}|${accion}`;
      if (marcado) G.matriz.add(llave); else G.matriz.delete(llave);
      return { marcado: !!marcado, mensaje: marcado ? 'Permiso otorgado.' : 'Permiso quitado.' };
    },

    'POST /administracion/roles': () => {
      const b = cuerpo ?? {};
      const y = rolDe(b.codigo);
      if (!y && String(b.descripcion ?? '').trim().length < 10) {
        noEnDemo('Escriba para qué sirve el rol: al menos diez caracteres. Un rol sin propósito escrito no se puede auditar.');
      }
      const fila = {
        codigo: b.codigo, nombre: b.nombre,
        alcance_maximo: b.alcanceMaximo, nivel_maximo: Number(b.nivelMaximo),
        /* Lo que no se manda NO SE TOCA, igual que en la base. */
        descripcion: String(b.descripcion ?? '').trim() || y?.descripcion || '',
        activo: typeof b.activo === 'boolean' ? b.activo : (y?.activo ?? true),
      };
      if (y) Object.assign(y, fila); else G.roles.push(fila);
      return { mensaje: 'Rol guardado. Los permisos que le sobren por encima del techo dejan de servir.' };
    },

    'GET /administracion/plantillas': () => ({
      total_filas: G.plantillas.length,
      plantillas: G.plantillas.map(p => ({
        codigo: p.codigo, nombre: p.nombre, tipo_sede: p.tipo_sede, descripcion: p.descripcion,
        modulos: p.modulos.size,
        lista: MODULOS_DEMO.filter(m => p.modulos.has(m.codigo)).map(m => m.nombre).join(', '),
        con_compuerta_legal: MODULOS_DEMO.filter(m => p.modulos.has(m.codigo) && m.exige_compuerta_legal).length,
      })),
      aviso: 'Los módulos con compuerta legal nacen APAGADOS: se encienden cuando exista la evidencia jurídica.' }),

    'POST /administracion/plantillas': () => {
      const b = cuerpo ?? {};
      const y = G.plantillas.find(p => p.codigo === b.codigo);
      if (y) { Object.assign(y, { nombre: b.nombre, descripcion: b.descripcion ?? y.descripcion }); }
      else G.plantillas.push({ codigo: b.codigo, nombre: b.nombre, tipo_sede: b.tipoSede,
        descripcion: b.descripcion ?? '',
        modulos: new Set(MODULOS_DEMO.filter(m => m.es_nucleo).map(m => m.codigo)) });
      return { mensaje: 'Plantilla guardada. Marque los módulos que debe traer una iglesia nueva.' };
    },

    'POST /administracion/plantillas/:id/modulos': () => {
      const p = G.plantillas.find(x => x.codigo === trozos[2]);
      if (!p) noEnDemo('Esa plantilla no existe.');
      const m = MODULOS_DEMO.find(x => x.codigo === cuerpo?.modulo);
      if (m?.es_nucleo && !cuerpo?.marcado) {
        noEnDemo(`El módulo «${m.codigo}» es de núcleo: no se puede quitar de una plantilla`);
      }
      if (cuerpo?.marcado) p.modulos.add(cuerpo.modulo); else p.modulos.delete(cuerpo.modulo);
      return { marcado: !!cuerpo?.marcado,
               mensaje: cuerpo?.marcado ? 'Módulo añadido a la plantilla.' : 'Módulo quitado.' };
    },

    'POST /administracion/plantillas/:id/borrar': () => {
      const i = G.plantillas.findIndex(x => x.codigo === trozos[2]);
      if (i < 0) noEnDemo('Esa plantilla no existe.');
      G.plantillas.splice(i, 1);
      return { mensaje: 'Plantilla borrada.' };
    },

    'POST /administracion/sedes/:id/modulos': () => {
      const sede = G.modulosSede[trozos[2]] ?? G.modulosSede[SEDES[0].id];
      const m = MODULOS_DEMO.find(x => x.codigo === cuerpo?.modulo);
      if (!m) noEnDemo('Ese módulo no existe.');
      if (m.es_nucleo && !cuerpo?.activo) {
        noEnDemo(`«${m.nombre}» es de núcleo: sin él la iglesia no puede ni registrar personas.`);
      }
      if (cuerpo?.activo && m.exige_compuerta_legal && !cuerpo?.evidencia
          && !sede[m.codigo]?.evidencia) {
        noEnDemo(`«${m.nombre}» toca datos protegidos: no se enciende sin la referencia del instrumento jurídico que lo autoriza.`);
      }
      sede[m.codigo] = { activo: !!cuerpo?.activo,
                         evidencia: cuerpo?.evidencia ?? sede[m.codigo]?.evidencia ?? null };
      return { mensaje: cuerpo?.activo ? 'Módulo encendido en esa sede.' : 'Módulo apagado en esa sede.' };
    },

    'GET /administracion/personas/:id': () => {
      const p = PERSONAS.find(x => x.id === trozos[2]) ?? PERSONAS[0];
      const roles = G.asignaciones[p.id] ?? [];
      return {
        persona: { id: p.id, nombre_completo: p.nombre, numero_documento: p.numero_documento,
          tipo_documento: 'CC', email_principal: null, telefono_movil: null, estado: 'activa',
          edad: 34, es_menor: false, sede: p.sede, sede_nombre: p.sede },
        cuenta: { cuenta_id: id(980), persona_id: p.id, persona: p.nombre,
          usuario: p.nombre.split(' ')[0].toLowerCase() + '@casaroca.org', estado: 'activa',
          segundo_factor_activo: true, exige_segundo_factor: true, debe_cambiar_clave: false,
          ultimo_ingreso: new Date().toISOString(), bloqueada: false },
        roles, equipos: [],
        aviso: roles.length ? null : 'Esta persona no tiene ningún rol: puede entrar y no ve nada.' };
    },

    'GET /administracion/sedes/:id': () => {
      const sede = SEDES.find(x => x.id === trozos[2]) ?? SEDES[0];
      const mods = G.modulosSede[sede.id] ?? {};
      const on = Object.values(mods).filter(x => x.activo).length;
      return {
        sede: { id: sede.id, codigo: sede.codigo, nombre: sede.nombre, tipo: 'plantacion',
                pais: 'CO', ciudad: sede.nombre.replace(' (demo)', ''), activa: true,
                sede_padre: null, ola_migracion: 1 },
        conteo: { personas: String(PERSONAS.filter(p => p.sede === sede.codigo).length),
                  grupos: '3', modulos_encendidos: String(on) },
        equipo: [{ persona: 'Andrés Beltrán Ruiz', rol: 'PASTOR_CONGREGACIONAL',
                   rol_nombre: 'Pastor congregacional', nivel_max: 3, desde: d(-400) }],
        unidades: [{ id: id(700), nombre: 'Casa Sobre la Roca · Central', clase: 'central' }],
        aviso: null };
    },

    'POST /identidad/personas/:id/otorgar': () => {
      const lista = cuerpo?.roles ?? (Array.isArray(cuerpo) ? cuerpo : [cuerpo]);
      const persona = PERSONAS.find(x => x.id === trozos[2])?.id ?? PERSONAS[0].id;
      G.asignaciones[persona] = G.asignaciones[persona] ?? [];
      for (const a of lista) {
        if (!a?.rol) noEnDemo('Falta el código del rol.');
        const acta = String(a.acta ?? a.actaReferencia ?? '').trim();
        if (acta.length < 4) {
          noEnDemo('Falta el acta que autoriza el rol. Un permiso sin constancia de quién lo autorizó no se otorga.');
        }
        const r = rolDe(a.rol);
        G.asignaciones[persona].push({
          id: id(8000 + G.asignaciones[persona].length), rol: a.rol,
          rol_nombre: r?.nombre ?? a.rol, alcance_tipo: a.alcanceTipo ?? 'sede',
          alcance_id: a.alcanceId ?? null, nivel_max: r?.nivel_maximo ?? 2,
          desde: d(0), hasta: null, acta_referencia: acta });
      }
      return { ok: true, otorgados: G.asignaciones[persona] };
    },

    'DELETE /identidad/asignaciones/:id': () => {
      const motivo = String(cuerpo?.motivo ?? '').trim();
      if (motivo.length < 5) {
        noEnDemo('Revocar un permiso exige un motivo escrito: quedará en la ficha de la persona y en la auditoría.');
      }
      for (const [persona, lista] of Object.entries(G.asignaciones)) {
        const i = lista.findIndex(x => x.id === trozos[2]);
        if (i >= 0) {
          lista.splice(i, 1);
          return { id: trozos[2], motivo,
                   mensaje: 'Rol revocado. Queda en la ficha de la persona y en la auditoría.' };
        }
      }
      noEnDemo('No existe esa asignación.');
    },

    'POST /administracion/iglesias': () => ({ id: id(970), mensaje: 'En la demostración nada se guarda.' }),
    'POST /administracion/personas': () => ({ id: id(971), mensaje: 'En la demostración nada se guarda.' }),
    'GET /administracion/unidades': () => ({
      total_filas: UNIDADES.length, unidades: UNIDADES,
      aviso: UNIDADES.filter(u => u.clase === 'equipo' && !Number(u.roles)).length
        + ' equipo(s) sin ningún rol otorgado: existen pero no pueden hacer nada.' }),
    'POST /administracion/unidades': () => {
      const b = cuerpo ?? {};
      if (String(b.proposito ?? '').trim().length < 15) {
        noEnDemo('Escriba para qué existe el equipo: al menos quince caracteres.');
      }
      if (UNIDADES.some(u => u.codigo === b.codigo)) noEnDemo('Ya existe un equipo con ese código.');
      UNIDADES.push({ id: id(710 + UNIDADES.length), codigo: b.codigo, nombre: b.nombre,
        clase: b.clase, padre_id: UNIDADES[0].id, proposito: b.proposito, activa: true,
        padre: UNIDADES[0].nombre, lider: null, integrantes: '0', roles: '0' });
      return { mensaje: 'Equipo creado. Ahora otórguele un rol: sin rol existe y no puede hacer nada.' };
    },
    'POST /administracion/unidades/:id/miembros': () => {
      const u = UNIDADES.find(x => x.id === trozos[2]);
      if (!u) noEnDemo('Ese equipo no existe.');
      u.integrantes = String(Number(u.integrantes) + 1);
      return { mensaje: 'Entró al equipo. Hereda lo que el equipo alcance mientras esté dentro.' };
    },
    'POST /administracion/unidades/:id/miembros/:id2/salir': () => {
      const u = UNIDADES.find(x => x.id === trozos[2]);
      if (!u) noEnDemo('Ese equipo no existe.');
      if (!String(cuerpo?.motivo ?? '').trim()) noEnDemo('Sacar a alguien de un equipo exige un motivo escrito.');
      u.integrantes = String(Math.max(0, Number(u.integrantes) - 1));
      return { mensaje: 'Salió del equipo. Pierde lo que heredaba de él, y queda la fecha de salida.' };
    },
    'POST /administracion/unidades/:id/roles': () => {
      const u = UNIDADES.find(x => x.id === trozos[2]);
      if (!u) noEnDemo('Ese equipo no existe.');
      if (String(cuerpo?.acta ?? cuerpo?.actaReferencia ?? '').trim().length < 4) {
        noEnDemo('Falta el acta que autoriza el rol del equipo.');
      }
      u.roles = String(Number(u.roles) + 1);
      return { mensaje: 'Rol otorgado al equipo. Lo hereda cada integrante mientras esté dentro.' };
    },
    'POST /administracion/unidades/roles/:id/revocar': () => {
      if (!String(cuerpo?.motivo ?? '').trim()) noEnDemo('Revocar el rol de un equipo exige un motivo escrito.');
      const u = UNIDADES.find(x => Number(x.roles) > 0);
      if (u) u.roles = String(Number(u.roles) - 1);
      return { mensaje: 'Rol revocado. Lo pierden TODOS los integrantes del equipo a la vez.' };
    },
    /* ⛔ Ignoraba el identificador y devolvía SIEMPRE Tesorería: se pulsaba
       «Región Andina» y la ficha decía «Tesorería de la red», con sus
       miembros y su acta. En una auditoría eso se lee como que el sistema
       mezcla registros. */
    'GET /administracion/unidades/:id': () => {
      const u = UNIDADES.find(x => x.id === trozos[2]) ?? UNIDADES[0];
      const cuantos = Number(u.integrantes) || 0;
      return {
        unidad: { ...u, lider: cuantos ? PERSONAS[0].nombre : null },
        miembros: { activos: cuantos, lista: PERSONAS.slice(0, cuantos).map((p, i) => ({
          id: i, persona_id: p.id, nombre_completo: p.nombre,
          rol_en_unidad: i === 0 ? 'lider' : 'integrante', desde: d(-200), hasta: null })) },
        roles: Number(u.roles) ? [{ id: id(704), rol: 'TESORERIA', rol_nombre: 'Tesorería',
          alcance_tipo: 'organizacion', nivel_max: 3, desde: d(-200), hasta: null,
          acta_referencia: 'Acta 2026-014 de la Junta' }] : [],
        alcanza: u.clase === 'region' ? SEDES.slice(0, 2).map(s => ({ codigo: s.codigo, nombre: s.nombre }))
               : SEDES.map(s => ({ codigo: s.codigo, nombre: s.nombre })),
        aviso: Number(u.roles) ? null
             : 'Este equipo no tiene ningún rol otorgado: existe pero no puede hacer nada.' };
    },
    'GET /administracion/cuentas': () => ({ total_filas: 3, cuentas: PERSONAS.slice(0, 3).map((p, i) => ({
      cuenta_id: id(980 + i), persona_id: p.id, persona: p.nombre,
      usuario: p.nombre.split(' ')[0].toLowerCase() + '@casaroca.org',
      estado: i === 2 ? 'bloqueada' : 'activa', segundo_factor_activo: i === 0,
      exige_segundo_factor: i < 2, debe_cambiar_clave: i === 1,
      ultimo_ingreso: i === 0 ? new Date().toISOString() : null,
      intentos_fallidos: i === 2 ? 5 : 0, bloqueada: i === 2, sede: SEDES[i].codigo,
      roles: ['PASTOR_DIRECTOR_GENERAL','TESORERIA','SECRETARIA'][i] })),
      aviso: '2 cuenta(s) necesitan atención: bloqueadas, suspendidas o con el segundo factor sin activar.' }),
    'POST /administracion/cuentas': () => ({ id: id(989), usuario: 'nueva@casaroca.org',
      clave_provisional: 'cedro brisa faro lazo 47',
      mensaje: 'En la demostración nada se guarda. Así se vería la contraseña provisional.' }),
    'GET /administracion/sedes/:id/modulos': () => {
      const sede = G.modulosSede[trozos[2]] ?? G.modulosSede[SEDES[0].id];
      const modulos = MODULOS_DEMO.map(m => ({
        ...m, activo: !!sede[m.codigo]?.activo,
        evidencia_legal_ref: sede[m.codigo]?.evidencia ?? null }));
      const falta = modulos.filter(x => x.activo && x.exige_compuerta_legal && !x.evidencia_legal_ref);
      return { total_filas: modulos.length, modulos,
        aviso: falta.length ? `${falta.length} módulo(s) encendidos sin la evidencia jurídica registrada.` : null };
    },
    'GET /administracion/organigrama': () => ({ total_filas: 4, unidades: [
      { id: id(700), codigo: 'CENTRAL', nombre: 'Casa Sobre la Roca · Central', clase: 'central', nivel: 0, integrantes: 6, sedes_que_alcanza: 3 },
      { id: id(703), codigo: 'REG-ANDINA', nombre: 'Región Andina', clase: 'region', nivel: 1, integrantes: 1, sedes_que_alcanza: 2 },
      { id: id(701), codigo: 'TESORERIA', nombre: 'Tesorería de la red', clase: 'equipo', nivel: 1, integrantes: 3, sedes_que_alcanza: 3 },
      { id: id(702), codigo: 'CONTA', nombre: 'Contabilidad', clase: 'equipo', nivel: 1, integrantes: 2, sedes_que_alcanza: 3 }] }),
    'GET /administracion/sesiones': () => ({ total_filas: SESIONES.length, sesiones: SESIONES }),
    'GET /administracion/alertas': () => ({ total_filas: 1, alertas: [
      { usuario: 'desconocido@x.org', ip: '45.12.9.3', intentos_fallidos: 14, desde: d(0), hasta: d(0) }],
      aviso: '1 usuario(s) o dirección(es) con intentos fallidos agrupados.' }),
    'GET /administracion/recertificar': () => {
      const vencidos = RECERT.filter(x => x.vencido);
      const lista = q.get('todos') === 'si' ? RECERT : vencidos;
      return { total_filas: lista.length, accesos: lista,
        vencidos: vencidos.length, vigentes: RECERT.length,
        aviso: vencidos.length
          ? `${vencidos.length} acceso(s) pasaron su plazo de revisión, de ${RECERT.length} vigentes. Un permiso que nadie revisa es un permiso que nadie quitó.`
          : `Ninguno de los ${RECERT.length} accesos vigentes pasó su plazo. El plazo es de 90 días para los que tocan datos N3 o N4, y de 180 para el resto.` };
    },
    'POST /administracion/recertificar/:id': () => {
      const a = RECERT.find(x => x.asignacion_id === trozos[2]);
      if (!a) noEnDemo('Ese acceso no existe o ya se revisó.');
      if (String(cuerpo?.nota ?? '').trim().length < 5) {
        noEnDemo('Escriba por qué se mantiene o se quita el acceso: la revisión queda firmada con su nombre.');
      }
      a.ultima_revision = new Date().toISOString();
      a.dias_sin_revisar = 0; a.vencido = false;
      if (cuerpo?.veredicto === 'se_revoca') RECERT.splice(RECERT.indexOf(a), 1);
      return { mensaje: cuerpo?.veredicto === 'se_revoca'
        ? 'Revisado y REVOCADO. La persona pierde ese acceso ahora mismo.'
        : 'Revisado. El contador de días vuelve a cero y queda firmado con su nombre.' };
    },
    'POST /administracion/sesiones/:id/cerrar': () => {
      if (String(cuerpo?.motivo ?? '').trim().length < 5) {
        noEnDemo('Cerrarle la sesión a otra persona exige un motivo escrito: queda en la auditoría.');
      }
      const i = SESIONES.findIndex(x => x.sesion === trozos[2]);
      if (i < 0) noEnDemo('Esa sesión ya no está abierta.');
      SESIONES.splice(i, 1);
      return { mensaje: 'Sesión cerrada. Surte efecto ahora, no cuando expire el token.' };
    },

    'GET /administracion/auditoria': () => ({ total_filas: 2, movimientos: [
      { ocurrido_en: new Date().toISOString(), esquema: 'aportes', tabla: 'aportes', operacion: 'I', actor: 'Rosa Cifuentes Lara', actor_ip: '190.0.0.4' },
      { ocurrido_en: new Date(Date.now()-36e5).toISOString(), esquema: 'identidad', tabla: 'asignaciones', operacion: 'U', actor: 'Marta Quiroga Peña', actor_ip: '190.0.0.1' }] }),
    'GET /administracion/lecturas': () => ({ total_filas: 1, lecturas: [
      { ocurrido_en: new Date().toISOString(), esquema: 'consejeria', tabla: 'casos', nivel: 3,
        motivo: 'ficha completa del caso, con notas', filas_leidas: 1, actor: 'Rosa Cifuentes Lara', actor_ip: '190.0.0.4' }],
      aviso: 'Esta bitácora existe para que mirar por curiosidad tenga nombre y hora.' }),
    'GET /identidad/roles': () => [
      { codigo: 'PASTOR_DIRECTOR_GENERAL', nombre: 'Pastor Director General', activo: true },
      { codigo: 'TESORERIA', nombre: 'Tesorería', activo: true },
      { codigo: 'CONTABILIDAD', nombre: 'Contabilidad', activo: true },
      { codigo: 'PASTOR_CONGREGACIONAL', nombre: 'Pastor congregacional', activo: true }],
    /* ⛔ Devolvía `estado: 'demostración'`, y el Panel solo pinta el
       distintivo verde cuando vale exactamente 'sano'. El dueño veía
       «Estado del sistema: con problemas» y ninguna línea que dijera
       cuál, porque tampoco devolvía `problemas`. */
    'GET /salud/detalle': () => ({
      estado: 'sano', problemas: [],
      base: { estado: 'responde', ms: 4 },
      particiones: [{ tabla: 'asistencia.entradas', meses_de_colchon: 14 },
                    { tabla: 'plataforma.auditoria', meses_de_colchon: 14 }],
      fugasDeLectura: 0 }),
  };

  /* Se busca la clave exacta y, si no, la genérica con `:id`.
     ⛔ Antes solo se sustituía lo que tuviera pinta de uuid. Una plantilla
        se identifica por su código («PLANTACION»), no por un uuid: la
        ruta no casaba con ningún patrón y la consola de demostración
        contestaba «esta pantalla todavía no trae datos de ejemplo» al
        marcar un módulo. Ahora se prueba sustituyendo CADA segmento. */
  const exacta = `${metodo} ${p}`;
  if (M[exacta]) return M[exacta]();
  const generica = `${metodo} /` + trozos.map(t =>
    /^[0-9a-f-]{16,}$/i.test(t) ? ':id' : t).join('/');
  if (M[generica]) return M[generica]();
  for (let i = 0; i < trozos.length; i++) {
    const clave = `${metodo} /` + trozos.map((t, j) => (j === i ? ':id' : t)).join('/');
    if (M[clave]) return M[clave]();
  }
  /* ⛔ 20 de septiembre de 2026. Esto RESOLVÍA la promesa, y ese era el
     peor fallo de todo el modo demostración: veintisiete botones de
     guardar respondían con un aviso VERDE de éxito cuyo texto era «en la
     demostración todavía no trae datos», el formulario se limpiaba y se
     plegaba como si hubiera guardado. Quien recorriera la solución creía
     estar creando grupos, casos y voluntariados.
     Un aviso rojo que dice la verdad vale más que veintisiete verdes que
     mienten. Ahora se RECHAZA, y el manejo de error que ya tienen todas
     las vistas hace su trabajo. */
  if (metodo !== 'GET') {
    const e = new Error('En la demostración no se guarda nada: esta acción existe en el sistema real. '
      + 'Lo que ve aquí son datos inventados que viven solo en esta pestaña.');
    e.estado = 501; e.demo = true;
    throw e;
  }
  const e = new Error('Esta pantalla todavía no trae datos de ejemplo en la demostración.');
  e.estado = 501; e.demo = true;
  throw e;
}

export const demoActivo = () =>
  window.CASAROCA_DEMO === true || new URLSearchParams(location.search).has('demo');

export function responderDemo(ruta, opciones = {}) {
  const metodo = (opciones.method ?? 'GET').toUpperCase();
  /* ⛔ Sin el cuerpo, la demostración solo sabía contestar «aquí no se
     guarda nada» y cada casilla que se marcaba volvía sola a su sitio al
     cambiar de pestaña. Una demostración en la que nada reacciona no
     enseña el sistema: enseña una foto. Lo que se marca aquí vive en la
     memoria de ESTA pestaña y muere al cerrarla. */
  let cuerpo = null;
  try { cuerpo = opciones.body ? JSON.parse(opciones.body) : null; } catch { cuerpo = null; }
  return new Promise((resolver, rechazar) => setTimeout(() => {
    try { resolver(responder(metodo, ruta, cuerpo)); }
    catch (e) { rechazar(e); }
  }, 120));
}
