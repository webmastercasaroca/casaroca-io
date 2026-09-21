-- =====================================================================
-- Migración 0032 — LO QUE SE ACORDÓ CON EL PASTOR Y NO ESTABA
--
-- Hallazgo del 11 de septiembre de 2026. Daniel lo vio por la vía más
-- honesta: creó una persona, abrió su ficha y vio seis campos en «sin
-- registrar». El formulario pedía tres cosas y la ficha mostraba nueve.
--
-- La causa no era el formulario: era que `nucleo.personas` se quedó más
-- corta que lo acordado en la mesa. Faltaban seis columnas que sí están
-- en el modelo v1.2 del equipo 100p y que el pastor pidió expresamente
-- para el nombramiento pastoral.
--
-- ⭐ La más importante es `fecha_conversion`, el «año de nacimiento en
-- la Fe». No es un campo de CRM genérico: es dato propio de una iglesia
-- y el pastor lo nombró explícitamente. Sin él no hay ficha pastoral.
-- =====================================================================

CREATE TYPE nucleo.genero AS ENUM ('M','F','O');
CREATE TYPE nucleo.estado_civil AS ENUM
  ('soltero','casado','divorciado','viudo','union_libre','separado');
CREATE TYPE nucleo.nivel_compromiso AS ENUM ('visitante','miembro','lider');

ALTER TABLE nucleo.personas
  ADD COLUMN genero            nucleo.genero,
  ADD COLUMN estado_civil      nucleo.estado_civil,
  ADD COLUMN nivel_compromiso  nucleo.nivel_compromiso NOT NULL DEFAULT 'visitante',
  ADD COLUMN fecha_conversion  date,
  ADD COLUMN ha_sido_bautizado boolean,
  ADD COLUMN fecha_bautismo    date,
  ADD COLUMN foto_url          text;

COMMENT ON COLUMN nucleo.personas.fecha_conversion IS
  'El «año de nacimiento en la Fe». Pedido expresamente por el pastor para la ficha pastoral.';
COMMENT ON COLUMN nucleo.personas.nivel_compromiso IS
  'visitante, miembro o lider. Arranca en visitante: nadie nace miembro.';
COMMENT ON COLUMN nucleo.personas.foto_url IS
  'Fotografía del rostro. Exigida en el nombramiento pastoral.';

-- ---------------------------------------------------------------------
-- La bautismal y la conversión NO pueden ser anteriores al nacimiento,
-- y el bautismo no puede preceder a la conversión.
-- ---------------------------------------------------------------------
ALTER TABLE nucleo.personas
  ADD CONSTRAINT conversion_despues_de_nacer CHECK (
    fecha_conversion IS NULL OR fecha_nacimiento IS NULL
    OR fecha_conversion >= fecha_nacimiento),
  ADD CONSTRAINT bautismo_despues_de_nacer CHECK (
    fecha_bautismo IS NULL OR fecha_nacimiento IS NULL
    OR fecha_bautismo >= fecha_nacimiento),
  ADD CONSTRAINT fecha_bautismo_exige_bautizado CHECK (
    fecha_bautismo IS NULL OR ha_sido_bautizado IS TRUE);

-- ---------------------------------------------------------------------
-- CLASIFICACIÓN. Estas columnas no son inocentes: la fecha de conversión
-- y el estado civil son dato personal ordinario (N2, Ley 1581), y la
-- fotografía del rostro es dato biométrico de identificación.
-- ---------------------------------------------------------------------
-- ⭐ `finalidad` es OBLIGATORIA y está bien que lo sea: la Ley 1581 no
-- pregunta qué dato se guarda, pregunta PARA QUÉ. Una columna sin
-- finalidad declarada es un dato que nadie puede justificar el día que
-- lo pidan.
INSERT INTO plataforma.clasificacion_columna (esquema, tabla, columna, nivel, finalidad, mecanismo) VALUES
  ('nucleo','personas','genero',           2, 'administrativa', 'rls_y_bitacora'),
  ('nucleo','personas','estado_civil',     2, 'pastoral',       'rls_y_bitacora'),
  ('nucleo','personas','nivel_compromiso', 1, 'pastoral',       'rls_y_bitacora'),
  ('nucleo','personas','fecha_conversion', 2, 'pastoral',       'rls_y_bitacora'),
  ('nucleo','personas','ha_sido_bautizado',2, 'pastoral',       'rls_y_bitacora'),
  ('nucleo','personas','fecha_bautismo',   2, 'pastoral',       'rls_y_bitacora'),
  ('nucleo','personas','foto_url',         2, 'administrativa', 'rls_y_bitacora')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- ⚠️ LO QUE NO SE HACE AQUÍ, Y POR QUÉ
--
-- El modelo v1.2 del equipo trae además `nacionalidad`, `zona`,
-- `iglesia_anterior`, `es_ministro` y `en_directorio_publico`. No se
-- añaden todavía porque no salieron de la mesa con el pastor, y una
-- columna que nadie llena es peor que una que falta: ensucia el modelo
-- y confunde a quien migre los datos. Se añaden cuando se acuerden.
--
-- Tampoco se adopta su `nombre_completo VARCHAR(100)`. Aquí el nombre va
-- partido en cuatro (`primer_nombre`, `segundo_nombre`, `primer_apellido`,
-- `segundo_apellido`) a propósito: en Colombia el segundo apellido es de
-- uso corriente y un campo único obliga a partirlo después con heurísticas
-- que fallan. Es una divergencia deliberada, no un descuido.
-- ---------------------------------------------------------------------
