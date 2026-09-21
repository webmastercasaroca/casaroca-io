-- =====================================================================
-- Seed 018 — EL CONTENIDO DEL DOCUMENTO DE ROLES DEL DRIVE
--
-- Compañero de la migración 0040. Aquí va lo que depende de catálogos
-- (módulos, acciones): los roles que el documento «ESTRUCTURA DE DATOS -
-- ROLES» nombra y la base no tenía, sus permisos nombrados, y los alias
-- para los que ya existían con otro nombre.
--
-- Criterio de cada techo (nivel máximo): el que exige el módulo que el
-- rol opera. En esta base los aportes son N3 (no N2 como en su tabla de
-- niveles), así que quien digita aportes necesita N3 para poder verlos.
-- =====================================================================

-- ── Los roles del documento que faltaban ───────────────────────────
INSERT INTO identidad.roles (codigo, nombre, alcance_maximo, nivel_maximo, descripcion) VALUES
 ('PROPIETARIO', 'Propietario de la plataforma', 'organizacion', 4,
  'Acceso total, como lo define el documento de Roles. Es un rol técnico de custodia: se otorga con acta y a muy pocas personas.'),
 ('DIGITADOR_APORTES', 'Digitador de aportes', 'sede', 3,
  'Ingresa aportes. No los confirma ni expide certificados: digitar y aprobar son manos distintas a propósito.'),
 ('ASISTENCIA_REGISTRO', 'Registro de asistencia', 'sede', 2,
  'Toma asistencia y registra eventos de su sede.'),
 ('VISITANTE', 'Visitante', 'persona_propia', 2,
  'Solo lectura, y solo de sus propios datos.'),
 ('LIDER_DE_ORACION', 'Líder de oración', 'sede', 3,
  'Registra peticiones de oración y sus respuestas. Una petición cuenta una enfermedad o una crisis: por eso es N3.'),
 ('PERSONA_QUE_ORA', 'Persona que ora', 'sede', 3,
  'Ve la lista de peticiones de su sede y reporta respuestas. No crea peticiones.'),
 ('GERENCIA_ADMINISTRATIVA', 'Gerencia administrativa', 'organizacion', 2,
  'Reportes de eventos y ocupación de espacios. No ve datos pastorales ni financieros por persona.'),
 ('AUDITOR', 'Auditor', 'organizacion', 3,
  'Lectura para control: reportes financieros, cumplimiento y trazabilidad. No escribe nada.')
ON CONFLICT (codigo) DO NOTHING;

-- ── Los que ya existían con otro nombre ────────────────────────────
INSERT INTO identidad.roles_alias (alias, rol, origen, nota) VALUES
 ('DIRECTOR_GENERAL',          'PASTOR_DIRECTOR_GENERAL', 'Drive · Roles v1.0',
  'Daniel, 11 sep 2026: Pastor Principal y Pastor Director General son el mismo cargo.'),
 ('PASTOR_PRINCIPAL',          'PASTOR_DIRECTOR_GENERAL', 'Drive · Roles v1.0',
  'Mismo cargo que Director General (seed 012).'),
 ('SECRETARIA_ADMINISTRATIVA', 'SECRETARIA',              'Drive · Roles v1.0', NULL),
 ('LIDER_DE_GRUPO',            'LIDER_GRUPO',             'Drive · Roles v1.0', NULL),
 ('RESPONSABLE_ROCAKIDS',      'DIRECTOR_ROCAKIDS',       'Drive · Roles v1.0', NULL)
ON CONFLICT (alias) DO NOTHING;

-- ── Los permisos nombrados que faltaban ────────────────────────────
INSERT INTO sistema.acciones (codigo, nombre, orden, es_sensible, modulo, descripcion) VALUES
 ('CREAR_NUEVO',                    'Crear un nuevo',                    13, false, 'crm',
  'Registrar en la bandeja a alguien que llegó en persona (el formulario web no lo necesita).'),
 ('VER_REPORTES_FINANCIEROS',       'Ver reportes financieros',          24, true,  'aportes',
  'Totales y conciliación. No expone el aporte de una persona.'),
 ('EXPORTAR_APORTES',               'Exportar aportes',                  25, true,  'aportes',
  'Sacar aportes del sistema. Queda en la bitácora de lectura.'),
 ('REGISTRAR_CONVERSACION_PASTORAL','Registrar conversación pastoral',   31, true,  'consejeria',
  'Deja constancia de una sesión de acompañamiento en el caso asignado.'),
 ('REGISTRAR_PETICION_ORACION',     'Registrar petición de oración',     50, true,  'oracion', NULL),
 ('REPORTAR_RESPUESTA_ORACION',     'Reportar respuesta de oración',     51, false, 'oracion', NULL),
 ('REGISTRAR_EVENTO',               'Registrar evento',                  60, false, 'asistencia', NULL),
 ('TOMAR_ASISTENCIA',               'Tomar asistencia',                  61, false, 'asistencia', NULL),
 ('VER_REPORTES_ASISTENCIA',        'Ver reportes de asistencia',        62, false, 'asistencia', NULL),
 ('GENERAR_ACTA_EVENTO',            'Generar acta de evento',            63, false, 'asistencia', NULL)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO sistema.acciones_alias (alias, accion, origen, nota) VALUES
 ('VER_REPORTES_NUEVOS',  'VER_METRICAS_NUEVOS', 'Drive · Roles v1.0', NULL),
 ('APROBAR_APORTE',       'CONFIRMAR_APORTE',    'Drive · Roles v1.0',
  'Aprobar es confirmar contra el extracto o la pasarela.'),
 ('GENERAR_CERTIFICADO',  'EXPEDIR_CERTIFICADO', 'Drive · Roles v1.0', NULL)
ON CONFLICT (alias) DO NOTHING;

-- ── La matriz, tal como la cuenta el documento fase por fase ───────
INSERT INTO sistema.matriz_permisos (rol, modulo, accion, acta_ref) VALUES
 -- Fase 1 · Nuevos
 ('COORDINADOR_NUEVOS',     'crm',        'CREAR_NUEVO',                    'Drive · Roles v1.0 · Fase 1'),
 ('PASTOR_DIRECTOR_GENERAL','crm',        'VER_METRICAS_NUEVOS',            'Drive · Roles v1.0 · Fase 1'),
 -- Fase 2 · Donaciones
 ('DIGITADOR_APORTES',      'aportes',    'ver',                            'Drive · Roles v1.0 · Fase 2'),
 ('DIGITADOR_APORTES',      'aportes',    'crear',                          'Drive · Roles v1.0 · Fase 2'),
 ('DIGITADOR_APORTES',      'aportes',    'REGISTRAR_APORTE',               'Drive · Roles v1.0 · Fase 2'),
 ('DIGITADOR_APORTES',      'personas',   'ver',                            'Drive · Roles v1.0 · Fase 2'),
 ('TESORERIA',              'aportes',    'CONFIRMAR_APORTE',               'Drive · Roles v1.0 · Fase 2'),
 ('TESORERIA',              'aportes',    'VER_REPORTES_FINANCIEROS',       'Drive · Roles v1.0 · Fase 2'),
 ('TESORERIA',              'aportes',    'EXPORTAR_APORTES',               'Drive · Roles v1.0 · Fase 2'),
 ('CONTABILIDAD',           'aportes',    'VER_REPORTES_FINANCIEROS',       'Drive · Roles v1.0 · Fase 2'),
 ('PASTOR_DIRECTOR_GENERAL','aportes',    'VER_REPORTES_FINANCIEROS',       'Drive · Roles v1.0 · Fase 2'),
 -- Fase 3 · Pastoral
 ('CONSEJERO',              'consejeria', 'REGISTRAR_CONVERSACION_PASTORAL','Drive · Roles v1.0 · Fase 3'),
 ('LIDER_DE_ORACION',       'oracion',    'ver',                            'Drive · Roles v1.0 · Fase 3'),
 ('LIDER_DE_ORACION',       'oracion',    'crear',                          'Drive · Roles v1.0 · Fase 3'),
 ('LIDER_DE_ORACION',       'oracion',    'REGISTRAR_PETICION_ORACION',     'Drive · Roles v1.0 · Fase 3'),
 ('LIDER_DE_ORACION',       'oracion',    'REPORTAR_RESPUESTA_ORACION',     'Drive · Roles v1.0 · Fase 3'),
 ('PERSONA_QUE_ORA',        'oracion',    'ver',                            'Drive · Roles v1.0 · Fase 3'),
 ('PERSONA_QUE_ORA',        'oracion',    'REPORTAR_RESPUESTA_ORACION',     'Drive · Roles v1.0 · Fase 3'),
 -- Fase 4 · Asistencia y eventos
 ('ASISTENCIA_REGISTRO',    'asistencia', 'ver',                            'Drive · Roles v1.0 · Fase 4'),
 ('ASISTENCIA_REGISTRO',    'asistencia', 'crear',                          'Drive · Roles v1.0 · Fase 4'),
 ('ASISTENCIA_REGISTRO',    'asistencia', 'TOMAR_ASISTENCIA',               'Drive · Roles v1.0 · Fase 4'),
 ('ASISTENCIA_REGISTRO',    'asistencia', 'REGISTRAR_EVENTO',               'Drive · Roles v1.0 · Fase 4'),
 ('SECRETARIA',             'asistencia', 'ver',                            'Drive · Roles v1.0 · Fase 4'),
 ('SECRETARIA',             'asistencia', 'crear',                          'Drive · Roles v1.0 · Fase 4'),
 ('SECRETARIA',             'asistencia', 'REGISTRAR_EVENTO',               'Drive · Roles v1.0 · Fase 4'),
 ('SECRETARIA',             'asistencia', 'TOMAR_ASISTENCIA',               'Drive · Roles v1.0 · Fase 4'),
 ('SECRETARIA',             'asistencia', 'GENERAR_ACTA_EVENTO',            'Drive · Roles v1.0 · Fase 4'),
 ('LIDER_GRUPO',            'asistencia', 'VER_REPORTES_ASISTENCIA',        'Drive · Roles v1.0 · Fase 4'),
 ('GERENCIA_ADMINISTRATIVA','asistencia', 'ver',                            'Drive · Roles v1.0 · Fase 4'),
 ('GERENCIA_ADMINISTRATIVA','asistencia', 'VER_REPORTES_ASISTENCIA',        'Drive · Roles v1.0 · Fase 4'),
 ('GERENCIA_ADMINISTRATIVA','calendario', 'ver',                            'Drive · Roles v1.0 · Fase 4'),
 -- Visitante y auditor
 ('VISITANTE',              'personas',   'ver',                            'Drive · Roles v1.0 · Roles iniciales'),
 ('AUDITOR',                'aportes',    'ver',                            'Drive · Roles v1.0 · Fase 5+'),
 ('AUDITOR',                'aportes',    'VER_REPORTES_FINANCIEROS',       'Drive · Roles v1.0 · Fase 5+'),
 ('AUDITOR',                'cumplimiento','ver',                           'Drive · Roles v1.0 · Fase 5+'),
 ('AUDITOR',                'identidad',  'ver',                            'Drive · Roles v1.0 · Fase 5+')
ON CONFLICT DO NOTHING;

-- PROPIETARIO: «acceso total», módulo por módulo, para que la matriz lo
-- diga explícitamente y no dependa de una excepción escondida en código.
INSERT INTO sistema.matriz_permisos (rol, modulo, accion, acta_ref)
SELECT 'PROPIETARIO', m.codigo, 'administrar', 'Drive · Roles v1.0 · Roles iniciales'
  FROM sistema.modulos m
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  RAISE NOTICE 'Drive 100p: % roles, % alias de rol, % alias de acción',
    (SELECT count(*) FROM identidad.roles),
    (SELECT count(*) FROM identidad.roles_alias),
    (SELECT count(*) FROM sistema.acciones_alias);
END $$;
