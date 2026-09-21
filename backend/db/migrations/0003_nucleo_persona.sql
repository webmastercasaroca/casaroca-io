-- =====================================================================
-- Migración 0003 — NÚCLEO · REGISTRO MAESTRO DE PERSONA
-- La raíz del modelo. ~25.000 filas en producción.
--
-- Corrige cuatro divergencias del modelo del equipo 100p:
--   nº 1  `sede_id` obligatorio  → sin él no hay aislamiento
--   nº 2  linaje de migración    → source_system + source_id
--   nº 4  `email_principal` deja de ser obligatorio y único a secas
--   nº 7  `edad` NO se almacena  → se deriva de fecha_nacimiento
-- =====================================================================

-- 16 tipos de documento (multi-país: Barcelona, Panamá, Boca Ratón).
CREATE TABLE nucleo.tipos_documento (
  codigo   text PRIMARY KEY,
  nombre   text NOT NULL,
  pais     char(2) REFERENCES org.paises(codigo_iso2),
  de_menor boolean NOT NULL DEFAULT false
);

CREATE TYPE nucleo.estado_persona AS ENUM ('activa','inactiva','trasladada','fallecida','fusionada');

CREATE TABLE nucleo.personas (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Aislamiento (primera condición de existencia) ──────────────────
  sede_id            uuid NOT NULL REFERENCES org.sedes(id) ON DELETE RESTRICT,

  -- ── Identificación ────────────────────────────────────────────────
  tipo_documento     text REFERENCES nucleo.tipos_documento(codigo),
  numero_documento   text,
  primer_nombre      text NOT NULL,
  segundo_nombre     text,
  primer_apellido    text NOT NULL,
  segundo_apellido   text,
  fecha_nacimiento   date,

  -- ── Contacto. Ninguno es obligatorio: en una iglesia con menores y
  --    adultos mayores, exigir correo bloquea el registro (divergencia nº 4).
  email_principal    citext,
  telefono_movil     text,
  telefono_fijo      text,
  direccion          text,

  -- ── Estado ────────────────────────────────────────────────────────
  estado             nucleo.estado_persona NOT NULL DEFAULT 'activa',
  fusionada_en_id    uuid REFERENCES nucleo.personas(id),
  eliminado_en       timestamptz,          -- borrado lógico; el físico está prohibido

  -- ── Linaje de migración (divergencia nº 2) ────────────────────────
  source_system      text,
  source_id          text,
  source_payload     jsonb,                -- la fila cruda tal como llegó

  creado_en          timestamptz NOT NULL DEFAULT now(),
  actualizado_en     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT personas_linaje_completo CHECK ((source_system IS NULL) = (source_id IS NULL)),
  CONSTRAINT personas_documento_completo CHECK ((tipo_documento IS NULL) = (numero_documento IS NULL)),
  CONSTRAINT personas_nacimiento_no_futuro CHECK (fecha_nacimiento IS NULL OR fecha_nacimiento <= CURRENT_DATE),
  CONSTRAINT personas_fusion_coherente CHECK ((estado = 'fusionada') = (fusionada_en_id IS NOT NULL))
);

-- Deduplicación por documento: única por (tipo, número), ignorando las eliminadas.
CREATE UNIQUE INDEX personas_documento_uq
  ON nucleo.personas (tipo_documento, numero_documento)
  WHERE numero_documento IS NOT NULL AND eliminado_en IS NULL;

-- Correo único SOLO cuando existe. Sin este `WHERE`, dos personas sin correo chocan.
CREATE UNIQUE INDEX personas_email_uq
  ON nucleo.personas (email_principal)
  WHERE email_principal IS NOT NULL AND eliminado_en IS NULL;

CREATE UNIQUE INDEX personas_linaje_uq
  ON nucleo.personas (source_system, source_id) WHERE source_system IS NOT NULL;

CREATE INDEX personas_sede_idx   ON nucleo.personas (sede_id) WHERE eliminado_en IS NULL;
-- unaccent() es STABLE (depende del diccionario cargado), y un índice exige
-- IMMUTABLE. Se fija el diccionario explícitamente en un envoltorio propio:
-- así la expresión indexada es determinista y el índice es legal.
CREATE OR REPLACE FUNCTION nucleo.normalizar(p_texto text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT lower(public.unaccent('public.unaccent'::regdictionary, coalesce(p_texto,'')))
$$;

CREATE INDEX personas_nombre_idx ON nucleo.personas
  USING gin (to_tsvector('simple',
    nucleo.normalizar(primer_nombre||' '||coalesce(segundo_nombre,'')||' '||primer_apellido||' '||coalesce(segundo_apellido,''))));

CREATE TRIGGER trg_personas_upd BEFORE UPDATE ON nucleo.personas
  FOR EACH ROW EXECUTE FUNCTION plataforma.tg_set_actualizado_en();

-- ⛔ Borrado físico prohibido (coincide con el principio del equipo 100p).
CREATE RULE personas_no_delete AS ON DELETE TO nucleo.personas DO INSTEAD NOTHING;

-- ---------------------------------------------------------------------
-- Edad DERIVADA, nunca almacenada (divergencia nº 7).
-- Una columna `edad INT` empieza correcta y se pudre sola: cada
-- cumpleaños convierte en mentira una fila que nadie volvió a tocar.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION nucleo.edad(p_fecha_nacimiento date) RETURNS integer
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_fecha_nacimiento IS NULL THEN NULL
              ELSE date_part('year', age(CURRENT_DATE, p_fecha_nacimiento))::int END
$$;

CREATE OR REPLACE FUNCTION nucleo.es_menor(p_fecha_nacimiento date) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN p_fecha_nacimiento IS NULL THEN false
              ELSE age(CURRENT_DATE, p_fecha_nacimiento) < interval '18 years' END
$$;

CREATE OR REPLACE VIEW nucleo.v_personas AS
SELECT p.*,
       nucleo.edad(p.fecha_nacimiento)     AS edad,
       nucleo.es_menor(p.fecha_nacimiento) AS es_menor,
       trim(p.primer_nombre||' '||coalesce(p.segundo_nombre||' ','')||p.primer_apellido||' '||coalesce(p.segundo_apellido,'')) AS nombre_completo
FROM nucleo.personas p
WHERE p.eliminado_en IS NULL;

COMMENT ON VIEW nucleo.v_personas IS
  'Vista de lectura de la aplicación. La edad se calcula al leer: no puede desactualizarse.';

-- ---------------------------------------------------------------------
-- Vínculos entre personas (hogar y parentesco).
-- ---------------------------------------------------------------------
CREATE TABLE nucleo.tipos_vinculo (
  codigo    text PRIMARY KEY,
  nombre    text NOT NULL,
  reciproco text REFERENCES nucleo.tipos_vinculo(codigo),
  confiere_custodia boolean NOT NULL DEFAULT false
);

CREATE TABLE nucleo.vinculos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id    uuid NOT NULL REFERENCES nucleo.personas(id) ON DELETE RESTRICT,
  relacionada_id uuid NOT NULL REFERENCES nucleo.personas(id) ON DELETE RESTRICT,
  tipo          text NOT NULL REFERENCES nucleo.tipos_vinculo(codigo),
  vigente_desde date NOT NULL DEFAULT CURRENT_DATE,
  vigente_hasta date,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vinculo_no_reflexivo CHECK (persona_id <> relacionada_id),
  CONSTRAINT vinculo_vigencia CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde)
);
CREATE UNIQUE INDEX vinculos_uq ON nucleo.vinculos (persona_id, relacionada_id, tipo) WHERE vigente_hasta IS NULL;

GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA nucleo TO casaroca_app;
GRANT SELECT ON nucleo.v_personas TO casaroca_app, casaroca_lectura;
