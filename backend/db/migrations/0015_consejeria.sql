-- =====================================================================
-- Migración 0015 — ESQUEMA 07 · CONSEJERÍA  (nivel N3)
-- Origen: plataforma actual (casos + tópicos).
-- «Un caso sin su antecedente obliga al consejero a empezar de cero.»
--
-- La regla de acceso aquí NO es por sede: es POR CASO. Un consejero ve
-- los casos que le fueron asignados, y ninguno más — ni siquiera los de
-- su propia sede. Es el único esquema con alcance `caso_propio`.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS consejeria;
COMMENT ON SCHEMA consejeria IS 'Esquema 07. Nivel N3. Acceso por caso asignado, no por sede.';
GRANT USAGE ON SCHEMA consejeria TO casaroca_app, casaroca_migrador;

CREATE TYPE consejeria.estado_caso AS ENUM ('abierto','en_proceso','en_pausa','cerrado','derivado');

CREATE TABLE consejeria.topicos (
  codigo      text PRIMARY KEY,
  nombre      text NOT NULL,
  categoria   text NOT NULL,
  requiere_profesional boolean NOT NULL DEFAULT false
);
COMMENT ON COLUMN consejeria.topicos.requiere_profesional IS
  'Marca los tópicos que el acompañamiento pastoral no debe atender solo (salud mental, violencia, adicciones). El sistema no diagnostica: señala que hay que derivar.';

CREATE TABLE consejeria.casos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultante_id uuid NOT NULL REFERENCES nucleo.personas(id) ON DELETE RESTRICT,
  sede_id       uuid NOT NULL REFERENCES org.sedes(id),
  topico        text NOT NULL REFERENCES consejeria.topicos(codigo),
  estado        consejeria.estado_caso NOT NULL DEFAULT 'abierto',
  abierto_en    timestamptz NOT NULL DEFAULT now(),
  cerrado_en    timestamptz,
  derivado_a    text,
  source_system text, source_id text,
  CONSTRAINT caso_cierre_coherente CHECK ((estado = 'cerrado') = (cerrado_en IS NOT NULL))
);
CREATE INDEX casos_consultante_idx ON consejeria.casos (consultante_id, abierto_en DESC);
CREATE UNIQUE INDEX casos_linaje_uq ON consejeria.casos (source_system, source_id) WHERE source_system IS NOT NULL;

-- Quién puede ver cada caso. Es la tabla que gobierna el acceso.
CREATE TABLE consejeria.asignaciones (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id      uuid NOT NULL REFERENCES consejeria.casos(id) ON DELETE RESTRICT,
  consejero_id uuid NOT NULL REFERENCES nucleo.personas(id) ON DELETE RESTRICT,
  rol          text NOT NULL DEFAULT 'consejero' CHECK (rol IN ('consejero','supervisor','observador')),
  desde        timestamptz NOT NULL DEFAULT now(),
  hasta        timestamptz,
  asignado_por uuid REFERENCES nucleo.personas(id)
);
CREATE INDEX asignaciones_consejero_idx ON consejeria.asignaciones (consejero_id) WHERE hasta IS NULL;

CREATE TABLE consejeria.sesiones (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id      uuid NOT NULL REFERENCES consejeria.casos(id) ON DELETE RESTRICT,
  consejero_id uuid NOT NULL REFERENCES nucleo.personas(id),
  fecha        timestamptz NOT NULL,
  duracion_min smallint CHECK (duracion_min IS NULL OR duracion_min > 0),
  modalidad    text CHECK (modalidad IN ('presencial','virtual','telefonica')),
  asistio      boolean NOT NULL DEFAULT true,
  registrada_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sesiones_caso_idx ON consejeria.sesiones (caso_id, fecha DESC);

-- Las notas son lo más sensible del esquema. Append-only: una nota
-- pastoral corregida a posteriori deja de ser un registro y pasa a ser
-- una versión de los hechos.
CREATE TABLE consejeria.notas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id      uuid NOT NULL REFERENCES consejeria.casos(id) ON DELETE RESTRICT,
  sesion_id    uuid REFERENCES consejeria.sesiones(id),
  autor_id     uuid NOT NULL REFERENCES nucleo.personas(id),
  contenido    text NOT NULL,
  escrita_en   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notas_caso_idx ON consejeria.notas (caso_id, escrita_en DESC);
CREATE RULE notas_no_update AS ON UPDATE TO consejeria.notas DO INSTEAD NOTHING;
CREATE RULE notas_no_delete AS ON DELETE TO consejeria.notas DO INSTEAD NOTHING;

-- ---------------------------------------------------------------------
-- Acceso POR CASO. El predicado no mira la sede: mira la asignación.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION consejeria.caso_visible(p_caso_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT plataforma.ctx_nivel_max() >= 3
     AND EXISTS (
       SELECT 1 FROM consejeria.asignaciones a
       WHERE a.caso_id = p_caso_id
         AND a.consejero_id = plataforma.ctx_persona_id()
         AND a.hasta IS NULL)
$$;

ALTER TABLE consejeria.casos    ENABLE ROW LEVEL SECURITY; ALTER TABLE consejeria.casos    FORCE ROW LEVEL SECURITY;
ALTER TABLE consejeria.sesiones ENABLE ROW LEVEL SECURITY; ALTER TABLE consejeria.sesiones FORCE ROW LEVEL SECURITY;
ALTER TABLE consejeria.notas    ENABLE ROW LEVEL SECURITY; ALTER TABLE consejeria.notas    FORCE ROW LEVEL SECURITY;

CREATE POLICY casos_sel ON consejeria.casos FOR SELECT USING (consejeria.caso_visible(id));
CREATE POLICY casos_ins ON consejeria.casos FOR INSERT WITH CHECK (plataforma.ctx_nivel_max() >= 3 AND plataforma.sede_visible(sede_id));
CREATE POLICY casos_upd ON consejeria.casos FOR UPDATE USING (consejeria.caso_visible(id));
CREATE POLICY sesiones_sel ON consejeria.sesiones FOR SELECT USING (consejeria.caso_visible(caso_id));
CREATE POLICY sesiones_ins ON consejeria.sesiones FOR INSERT WITH CHECK (consejeria.caso_visible(caso_id));
CREATE POLICY notas_sel ON consejeria.notas FOR SELECT USING (consejeria.caso_visible(caso_id));
CREATE POLICY notas_ins ON consejeria.notas FOR INSERT WITH CHECK (consejeria.caso_visible(caso_id));

INSERT INTO plataforma.clasificacion_columna (esquema,tabla,columna,nivel,finalidad,cifrada,mecanismo) VALUES
  ('consejeria','notas','contenido',3,'Acompañamiento pastoral reservado',false,'rls_y_bitacora'),
  ('consejeria','casos','topico',3,'Continuidad del acompañamiento',false,'rls_y_bitacora');

GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA consejeria TO casaroca_app;
