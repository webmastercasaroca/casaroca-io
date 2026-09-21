-- =====================================================================
-- Catálogo de módulos, plantillas y la matriz de permisos.
-- ⚠️ La matriz es una PROPUESTA para el taller H-01, no una decisión
--    tomada. Se lleva a la mesa impresa, se discute fila por fila y se
--    firma. Lo que aquí está escrito es el punto de partida razonado.
-- =====================================================================

INSERT INTO sistema.modulos (codigo,nombre,esquema,orden,descripcion,nivel_dato,es_nucleo,exige_compuerta_legal,depende_de) VALUES
 ('personas',    'Personas',                 'nucleo',     1,'Registro maestro. La raíz: todos los demás módulos la referencian.',2,true ,false,NULL),
 ('organizacion','Organización y sedes',     'org',        2,'Sedes, ministerios activos y organigrama.',                        1,true ,false,NULL),
 ('identidad',   'Identidad y accesos',      'identidad',  3,'Roles, alcances y vigencias. Quién entra y hasta dónde.',          2,true ,false,'personas'),
 ('cumplimiento','Auditoría y cumplimiento', 'plataforma', 4,'Habeas Data, auditoría, bitácora de lectura y clasificación.',     2,true ,false,'personas'),
 ('crm',         'CRM Pastoral · 4C',        'crm',        5,'Seguimiento de nuevos y línea de tiempo de la relación.',          2,false,false,'personas'),
 ('grupos',      'Grupos y hogares',         'grupos',     6,'Grupos familiares, pequeños y composición del hogar.',             2,false,false,'personas'),
 ('asistencia',  'Asistencia',               'asistencia', 7,'Conteo por servicio y entrada por persona.',                       2,false,false,'personas'),
 ('formacion',   'Formación e Instituto',    'formacion',  8,'Cursos cortos, IBLI y FACTER, cupos y certificados.',              2,false,false,'personas'),
 ('talento',     'Talento y voluntariado',   'talento',    9,'Empleados, contratos y quién sirve dónde.',                        3,false,false,'personas'),
 ('consejeria',  'Consejería',               'consejeria',10,'Casos reservados. Acceso por caso asignado.',                      3,false,true ,'personas'),
 ('aportes',     'Aportes',                  'aportes',   11,'Diezmos, ofrendas, pactos y conciliación contable.',               3,false,true ,'personas'),
 ('rocakids',    'RocaKids',                 'rocakids',  12,'Menores: check-in, entrega segura y autorizaciones.',              4,false,true ,'personas');

-- ── Plantillas ────────────────────────────────────────────────────────
INSERT INTO sistema.plantillas VALUES
 ('MAESTRA',   'Sede maestra',            'sede_madre',           'Todos los módulos. Es la que gobierna el ecosistema.'),
 ('FILIAL',    'Filial nacional',         'filial_nacional',      'Operación completa de una sede en Colombia.'),
 ('INTERNAC',  'Filial internacional',    'filial_internacional', 'Igual que la filial, pero migra en la última ola por GDPR y husos horarios.'),
 ('PLANTACION','Plantación',              'plantacion',           'Arranque mínimo: personas, seguimiento y grupos. Sin aportes ni menores hasta consolidarse.');

INSERT INTO sistema.plantilla_modulos (plantilla,modulo)
SELECT 'MAESTRA', codigo FROM sistema.modulos;

INSERT INTO sistema.plantilla_modulos (plantilla,modulo)
SELECT 'FILIAL', codigo FROM sistema.modulos;

INSERT INTO sistema.plantilla_modulos (plantilla,modulo)
SELECT 'INTERNAC', codigo FROM sistema.modulos;

INSERT INTO sistema.plantilla_modulos (plantilla,modulo)
SELECT 'PLANTACION', codigo FROM sistema.modulos
 WHERE codigo IN ('personas','organizacion','identidad','cumplimiento','crm','grupos','asistencia');

-- ── LA MATRIZ ─────────────────────────────────────────────────────────
-- Se declara como (rol, módulo, lista de acciones) y se expande.
-- Leerla en voz alta debe sonar a una frase verdadera sobre la iglesia.
INSERT INTO sistema.matriz_permisos (rol, modulo, accion, acta_ref)
SELECT d.rol, d.modulo, unnest(d.acciones), 'Propuesta para taller H-01'
FROM (VALUES
 -- Pastor Director General · alcance de organización, techo N4: todo
 ('PASTOR_DIRECTOR_GENERAL','personas',    ARRAY['ver','crear','editar','exportar','administrar']),
 ('PASTOR_DIRECTOR_GENERAL','organizacion',ARRAY['ver','crear','editar','administrar']),
 ('PASTOR_DIRECTOR_GENERAL','identidad',   ARRAY['ver','crear','editar','administrar']),
 ('PASTOR_DIRECTOR_GENERAL','cumplimiento',ARRAY['ver','exportar']),
 ('PASTOR_DIRECTOR_GENERAL','crm',         ARRAY['ver','crear','editar','exportar']),
 ('PASTOR_DIRECTOR_GENERAL','grupos',      ARRAY['ver','crear','editar']),
 ('PASTOR_DIRECTOR_GENERAL','asistencia',  ARRAY['ver','exportar']),
 ('PASTOR_DIRECTOR_GENERAL','formacion',   ARRAY['ver','crear','editar']),
 ('PASTOR_DIRECTOR_GENERAL','talento',     ARRAY['ver','crear','editar']),
 ('PASTOR_DIRECTOR_GENERAL','consejeria',  ARRAY['ver']),
 ('PASTOR_DIRECTOR_GENERAL','aportes',     ARRAY['ver','exportar']),
 ('PASTOR_DIRECTOR_GENERAL','rocakids',    ARRAY['ver']),

 -- Pastor Congregacional · su sede, techo N2. NO ve aportes ni menores.
 ('PASTOR_CONGREGACIONAL','personas',    ARRAY['ver','crear','editar']),
 ('PASTOR_CONGREGACIONAL','organizacion',ARRAY['ver','editar']),
 ('PASTOR_CONGREGACIONAL','identidad',   ARRAY['ver','crear']),
 ('PASTOR_CONGREGACIONAL','crm',         ARRAY['ver','crear','editar']),
 ('PASTOR_CONGREGACIONAL','grupos',      ARRAY['ver','crear','editar']),
 ('PASTOR_CONGREGACIONAL','asistencia',  ARRAY['ver','crear']),
 ('PASTOR_CONGREGACIONAL','formacion',   ARRAY['ver','crear']),
 ('PASTOR_CONGREGACIONAL','cumplimiento',ARRAY['ver']),

 ('DIRECTOR_MINISTERIO','personas',  ARRAY['ver','crear','editar']),
 ('DIRECTOR_MINISTERIO','crm',       ARRAY['ver','crear','editar']),
 ('DIRECTOR_MINISTERIO','grupos',    ARRAY['ver','crear','editar']),
 ('DIRECTOR_MINISTERIO','asistencia',ARRAY['ver','crear']),
 ('DIRECTOR_MINISTERIO','formacion', ARRAY['ver','crear','editar']),

 ('COORDINADOR','personas',  ARRAY['ver','crear','editar']),
 ('COORDINADOR','crm',       ARRAY['ver','crear','editar']),
 ('COORDINADOR','grupos',    ARRAY['ver','crear','editar']),
 ('COORDINADOR','asistencia',ARRAY['ver','crear']),

 ('LIDER_GRUPO','personas',  ARRAY['ver']),
 ('LIDER_GRUPO','crm',       ARRAY['ver','crear']),
 ('LIDER_GRUPO','grupos',    ARRAY['ver','editar']),
 ('LIDER_GRUPO','asistencia',ARRAY['ver','crear']),

 -- Consejero · techo N3, pero solo sobre SUS casos (alcance caso_propio)
 ('CONSEJERO','personas',  ARRAY['ver']),
 ('CONSEJERO','consejeria',ARRAY['ver','crear','editar']),

 -- Maestro RocaKids · techo N4, solo en su ministerio
 ('MAESTRO_ROCAKIDS','personas',ARRAY['ver']),
 ('MAESTRO_ROCAKIDS','rocakids',ARRAY['ver','crear','editar']),

 -- Tesorería · agregado de su sede. Sin exportar.
 ('TESORERIA','personas',ARRAY['ver']),
 ('TESORERIA','aportes', ARRAY['ver','crear','anular']),

 -- Contabilidad · conciliación. Exporta, y por eso queda registrado.
 ('CONTABILIDAD','aportes',     ARRAY['ver','exportar']),
 ('CONTABILIDAD','cumplimiento',ARRAY['ver']),

 ('TALENTO_HUMANO','personas',ARRAY['ver','editar']),
 ('TALENTO_HUMANO','talento', ARRAY['ver','crear','editar','exportar']),

 ('SECRETARIA','personas',    ARRAY['ver','crear','editar']),
 ('SECRETARIA','organizacion',ARRAY['ver']),
 ('SECRETARIA','formacion',   ARRAY['ver','crear','editar']),
 ('SECRETARIA','grupos',      ARRAY['ver']),

 ('MIEMBRO','personas', ARRAY['ver','editar']),
 ('MIEMBRO','formacion',ARRAY['ver']),
 ('MIEMBRO','grupos',   ARRAY['ver']),

 -- Acudiente · techo N4, pero solo sobre los menores a su cargo
 ('ACUDIENTE','personas',ARRAY['ver']),
 ('ACUDIENTE','rocakids',ARRAY['ver']),

 -- Integración técnica · techo N1. Jamás toca dato personal.
 ('INTEGRACION_TECNICA','organizacion',ARRAY['ver'])
) AS d(rol,modulo,acciones);

-- ── La sede maestra: Bogotá Chicó, con todo encendido ─────────────────
INSERT INTO sistema.modulos_sede (sede_id, modulo, activo, evidencia_legal_ref, nota)
SELECT s.id, m.codigo, true,
       CASE WHEN m.exige_compuerta_legal THEN 'PENDIENTE-H02 · demostración' END,
       'Sede maestra: nace con el catálogo completo'
FROM org.sedes s CROSS JOIN sistema.modulos m
WHERE s.tipo = 'sede_madre';
