-- =====================================================================
-- Seed 019 — LOS CINCO CATÁLOGOS QUE ESTABAN VACÍOS
--
-- ⛔ LO QUE SE DESCUBRIÓ EL 19 DE SEPTIEMBRE DE 2026. La prueba
--    `catalogos_no_vacios` ya existía y ya sabía detectarlo, pero corría
--    DESPUÉS de un banco que abortaba, y los bancos anteriores dejaban
--    datos de prueba que llenaban algunos de estos catálogos por accidente.
--    El resultado: la corrida salía verde y el sistema entregado NO PODÍA:
--
--      · abrir un solo caso de consejería   (consejeria.topicos vacío)
--      · inscribir a nadie en formación      (programas, cursos, cohortes)
--      · hacer el check-in de UN SOLO NIÑO   (rocakids.salas vacío)
--
--    Tres módulos completos, bien diseñados y probados, imposibles de usar.
--    Una tabla vacía se ve exactamente igual que una tabla que funciona.
--
-- ⭐ Las salas de RocaKids NO son un catálogo de la red: son de cada sede.
--    Por eso, además de sembrarlas para las sedes que ya existen, se
--    añaden al aprovisionamiento: una sede nueva nace con sus salas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · TÓPICOS DE CONSEJERÍA
--     `requiere_profesional` no es decorativo: marca lo que un líder NO
--     debe atender solo. Es salvaguarda, no taxonomía.
-- ---------------------------------------------------------------------
INSERT INTO consejeria.topicos (codigo, nombre, categoria, requiere_profesional) VALUES
 ('FAM',      'Familia y matrimonio',          'relacional',  false),
 ('CRIANZA',  'Crianza de los hijos',          'relacional',  false),
 ('DUELO',    'Duelo y perdida',               'emocional',   false),
 ('FE',       'Dudas de fe y vida espiritual', 'espiritual',  false),
 ('VOCACION', 'Vocacion y proposito',          'espiritual',  false),
 ('FINANZAS', 'Finanzas personales',           'practico',    false),
 ('LABORAL',  'Situacion laboral',             'practico',    false),
 ('ANSIEDAD', 'Ansiedad y depresion',          'salud',       true),
 ('ADICCION', 'Adicciones',                    'salud',       true),
 ('VIF',      'Violencia intrafamiliar',       'proteccion',  true),
 ('ABUSO',    'Abuso o maltrato',              'proteccion',  true),
 ('SUICIDIO', 'Ideacion suicida',              'crisis',      true),
 ('MENOR',    'Situacion de un menor de edad', 'proteccion',  true),
 ('OTRO',     'Otro',                          'general',     false)
ON CONFLICT (codigo) DO NOTHING;

-- ---------------------------------------------------------------------
-- 2 · PROGRAMAS Y CURSOS DE FORMACIÓN
--     Catálogo base de la red. Cada sede abre sus propias cohortes.
-- ---------------------------------------------------------------------
-- ⛔ `tipo` esta limitado por un CHECK con la lista escrita dentro
--    (curso_corto, instituto, diplomado, taller). Agregar «escuela» hoy
--    exige una migracion y un despliegue: es el mismo problema de rigidez
--    que los tipos enumerados, y se corrige en la migracion 0045.
INSERT INTO formacion.programas (codigo, nombre, tipo, semestres, descripcion) VALUES
 ('RUTA',  'Ruta del creyente',      'curso_corto', NULL, 'Los primeros pasos de quien llega: fundamentos y bautismo.'),
 ('LIDER', 'Escuela de liderazgo',   'diplomado',   2,    'Formacion de lideres de grupo y de ministerio.'),
 ('IBIB',  'Instituto biblico',      'instituto',   4,    'Formacion biblica y teologica de la red.'),
 ('KIDS',  'Formacion de maestros de ninos', 'curso_corto', 1, 'Obligatoria para servir en RocaKids. Incluye salvaguarda de menores.')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO formacion.cursos (programa_id, codigo, nombre, semestre, horas, otorga_certificado)
SELECT p.id, c.codigo, c.nombre, c.semestre, c.horas, c.certifica
FROM formacion.programas p
JOIN (VALUES
  ('RUTA',  'RUTA-01', 'Bienvenida y fundamentos',        1::smallint,  6::smallint, false),
  ('RUTA',  'RUTA-02', 'Bautismo',                        1::smallint,  4::smallint, true),
  ('LIDER', 'LID-01',  'El caracter del lider',           1::smallint, 20::smallint, false),
  ('LIDER', 'LID-02',  'Como dirigir un grupo',           1::smallint, 20::smallint, true),
  ('IBIB',  'IB-101',  'Panorama del Antiguo Testamento', 1::smallint, 48::smallint, true),
  ('IBIB',  'IB-102',  'Panorama del Nuevo Testamento',   1::smallint, 48::smallint, true),
  ('KIDS',  'KID-01',  'Ensenar a ninos',                 1::smallint, 16::smallint, true),
  ('KIDS',  'KID-02',  'Salvaguarda y proteccion de menores', 1::smallint, 8::smallint, true)
) AS c(prog, codigo, nombre, semestre, horas, certifica) ON c.prog = p.codigo
ON CONFLICT (codigo) DO NOTHING;

-- Una cohorte abierta por curso en la sede madre, para que el módulo se
-- pueda usar desde el primer día sin que nadie tenga que sembrar nada.
INSERT INTO formacion.cohortes (curso_id, sede_id, codigo, inicia, cupo)
SELECT c.id, s.id, c.codigo||'-'||to_char(CURRENT_DATE,'YYYY'), date_trunc('month', CURRENT_DATE)::date, 30
FROM formacion.cursos c
CROSS JOIN (SELECT id FROM org.sedes WHERE tipo='sede_madre' ORDER BY codigo LIMIT 1) s
ON CONFLICT (curso_id, sede_id, codigo) DO NOTHING;

-- ---------------------------------------------------------------------
-- 3 · SALAS DE ROCAKIDS · por sede, no de la red
--     Sin una sala no hay check-in, y sin check-in no hay entrega segura.
-- ---------------------------------------------------------------------
INSERT INTO rocakids.salas (sede_id, codigo, nombre, edad_min, edad_max, capacidad)
SELECT s.id, v.codigo, v.nombre, v.emin, v.emax, v.cap
FROM org.sedes s
CROSS JOIN (VALUES
  ('CUNA',     'Cuna (0 a 2)',          0::smallint,  2::smallint, 15::smallint),
  ('PARVULOS', 'Parvulos (3 a 5)',      3::smallint,  5::smallint, 25::smallint),
  ('EXPLORA',  'Exploradores (6 a 8)',  6::smallint,  8::smallint, 30::smallint),
  ('AVENTURA', 'Aventureros (9 a 11)',  9::smallint, 11::smallint, 30::smallint),
  ('PREADO',   'Preadolescentes (12 a 14)', 12::smallint, 14::smallint, 30::smallint)
) AS v(codigo, nombre, emin, emax, cap)
WHERE s.activa
  AND EXISTS (SELECT 1 FROM sistema.modulos_sede ms
              WHERE ms.sede_id = s.id AND ms.modulo = 'rocakids' AND ms.activo)
ON CONFLICT (sede_id, codigo) DO NOTHING;

-- Si ninguna sede tiene RocaKids encendido todavía, la sede madre igual
-- necesita sus salas: es la que se usa para probar y para capacitar.
INSERT INTO rocakids.salas (sede_id, codigo, nombre, edad_min, edad_max, capacidad)
SELECT s.id, v.codigo, v.nombre, v.emin, v.emax, v.cap
FROM (SELECT id FROM org.sedes WHERE tipo='sede_madre' ORDER BY codigo LIMIT 1) s
CROSS JOIN (VALUES
  ('CUNA',     'Cuna (0 a 2)',          0::smallint,  2::smallint, 15::smallint),
  ('PARVULOS', 'Parvulos (3 a 5)',      3::smallint,  5::smallint, 25::smallint),
  ('EXPLORA',  'Exploradores (6 a 8)',  6::smallint,  8::smallint, 30::smallint),
  ('AVENTURA', 'Aventureros (9 a 11)',  9::smallint, 11::smallint, 30::smallint),
  ('PREADO',   'Preadolescentes (12 a 14)', 12::smallint, 14::smallint, 30::smallint)
) AS v(codigo, nombre, emin, emax, cap)
ON CONFLICT (sede_id, codigo) DO NOTHING;

DO $$
DECLARE t int; p int; c int; co int; sa int;
BEGIN
  SELECT count(*) INTO t  FROM consejeria.topicos;
  SELECT count(*) INTO p  FROM formacion.programas;
  SELECT count(*) INTO c  FROM formacion.cursos;
  SELECT count(*) INTO co FROM formacion.cohortes;
  SELECT count(*) INTO sa FROM rocakids.salas;
  RAISE NOTICE 'Catalogos sembrados: % topicos, % programas, % cursos, % cohortes, % salas', t,p,c,co,sa;
END $$;
