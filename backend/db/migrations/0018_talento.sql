-- =====================================================================
-- Migración 0018 — ESQUEMA 10 · TALENTO Y VOLUNTARIADO
-- Sin origen digital. Separado de lo pastoral por diseño.
--
-- El hallazgo del Documento 4: «hoy la frontera entre empleado y
-- voluntario suele estar solo en la cabeza de alguien. Hay que
-- declararla.» Aquí se declara: son dos tablas distintas, con reglas
-- distintas, y una persona puede estar en ambas — pero nunca por
-- accidente, porque cada una exige su propio documento de respaldo.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS talento;
COMMENT ON SCHEMA talento IS 'Esquema 10. Empleados y voluntarios: dos relaciones distintas con la organización.';
GRANT USAGE ON SCHEMA talento TO casaroca_app, casaroca_migrador;

CREATE TYPE talento.tipo_contrato AS ENUM
  ('termino_indefinido','termino_fijo','obra_labor','prestacion_servicios','aprendizaje');
CREATE TYPE talento.estado_vinculo AS ENUM ('activo','suspendido','terminado');

CREATE TABLE talento.cargos (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo    text NOT NULL UNIQUE,
  nombre    text NOT NULL,
  area      text NOT NULL,
  nivel_dato smallint NOT NULL DEFAULT 2 REFERENCES plataforma.niveles_sensibilidad(nivel)
);

-- ── Empleados: relación laboral, con contrato ─────────────────────────
CREATE TABLE talento.contratos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id    uuid NOT NULL REFERENCES nucleo.personas(id) ON DELETE RESTRICT,
  sede_id       uuid NOT NULL REFERENCES org.sedes(id),
  cargo_id      uuid NOT NULL REFERENCES talento.cargos(id),
  tipo          talento.tipo_contrato NOT NULL,
  estado        talento.estado_vinculo NOT NULL DEFAULT 'activo',
  inicia        date NOT NULL,
  termina       date,
  -- N3: la remuneración es dato sensible de talento humano.
  salario       numeric(15,2) CHECK (salario IS NULL OR salario >= 0),
  moneda        char(3) NOT NULL DEFAULT 'COP',
  documento_ref text,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contrato_fechas CHECK (termina IS NULL OR termina >= inicia),
  CONSTRAINT contrato_fijo_con_fin CHECK (tipo <> 'termino_fijo' OR termina IS NOT NULL)
);
CREATE INDEX contratos_persona_idx ON talento.contratos (persona_id) WHERE estado = 'activo';
-- Un empleado no puede tener dos contratos activos en la misma sede.
CREATE UNIQUE INDEX contrato_activo_uq ON talento.contratos (persona_id, sede_id) WHERE estado = 'activo';

-- ── Voluntarios: servicio, sin relación laboral ───────────────────────
CREATE TABLE talento.voluntariados (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id    uuid NOT NULL REFERENCES nucleo.personas(id) ON DELETE RESTRICT,
  sede_id       uuid NOT NULL REFERENCES org.sedes(id),
  ministerio_id uuid NOT NULL REFERENCES org.ministerios(id),
  funcion       text NOT NULL,
  estado        talento.estado_vinculo NOT NULL DEFAULT 'activo',
  desde         date NOT NULL DEFAULT CURRENT_DATE,
  hasta         date,
  -- Servir con menores exige verificación de antecedentes. Es la única
  -- regla de este esquema que la base impone por sí sola.
  trabaja_con_menores boolean NOT NULL DEFAULT false,
  antecedentes_verificados_en date,
  compromiso_firmado_en date,
  CONSTRAINT voluntariado_fechas CHECK (hasta IS NULL OR hasta >= desde)
);
CREATE INDEX voluntariados_persona_idx ON talento.voluntariados (persona_id) WHERE estado = 'activo';

-- ⛔ Nadie sirve con menores sin antecedentes verificados y vigentes.
--    La verificación caduca a los dos años: una revisión de 2019 no
--    dice nada sobre 2026.
CREATE OR REPLACE FUNCTION talento.tg_voluntario_menores_verificado() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.trabaja_con_menores AND NEW.estado = 'activo' THEN
    IF NEW.antecedentes_verificados_en IS NULL THEN
      RAISE EXCEPTION 'Servir con menores exige verificación de antecedentes registrada'
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.antecedentes_verificados_en < CURRENT_DATE - interval '2 years' THEN
      RAISE EXCEPTION 'La verificación de antecedentes venció el %: hay que renovarla',
        NEW.antecedentes_verificados_en + interval '2 years'
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.compromiso_firmado_en IS NULL THEN
      RAISE EXCEPTION 'Falta el compromiso de protección de menores firmado'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER trg_voluntario_menores_verificado
  BEFORE INSERT OR UPDATE ON talento.voluntariados
  FOR EACH ROW EXECUTE FUNCTION talento.tg_voluntario_menores_verificado();

-- La frontera, hecha consulta: quién es empleado, quién es voluntario,
-- y quién es las dos cosas (que es legítimo, pero debe poder verse).
CREATE OR REPLACE VIEW talento.v_vinculo_con_la_organizacion AS
SELECT p.id AS persona_id, p.sede_id,
       EXISTS (SELECT 1 FROM talento.contratos c
                WHERE c.persona_id = p.id AND c.estado = 'activo')     AS es_empleado,
       EXISTS (SELECT 1 FROM talento.voluntariados v
                WHERE v.persona_id = p.id AND v.estado = 'activo')     AS es_voluntario,
       (SELECT count(*) FROM talento.voluntariados v
         WHERE v.persona_id = p.id AND v.estado = 'activo'
           AND v.trabaja_con_menores)                                  AS servicios_con_menores
FROM nucleo.personas p
WHERE p.eliminado_en IS NULL;

ALTER TABLE talento.contratos     ENABLE ROW LEVEL SECURITY; ALTER TABLE talento.contratos     FORCE ROW LEVEL SECURITY;
ALTER TABLE talento.voluntariados ENABLE ROW LEVEL SECURITY; ALTER TABLE talento.voluntariados FORCE ROW LEVEL SECURITY;
CREATE POLICY contratos_sel ON talento.contratos FOR SELECT
  USING (plataforma.ctx_nivel_max() >= 3 AND plataforma.sede_visible(sede_id));
CREATE POLICY contratos_ins ON talento.contratos FOR INSERT
  WITH CHECK (plataforma.ctx_nivel_max() >= 3 AND plataforma.sede_visible(sede_id));
CREATE POLICY voluntariados_sel ON talento.voluntariados FOR SELECT USING (plataforma.sede_visible(sede_id));
CREATE POLICY voluntariados_ins ON talento.voluntariados FOR INSERT WITH CHECK (plataforma.sede_visible(sede_id));
CREATE POLICY voluntariados_upd ON talento.voluntariados FOR UPDATE USING (plataforma.sede_visible(sede_id));

INSERT INTO plataforma.clasificacion_columna (esquema,tabla,columna,nivel,finalidad,cifrada,mecanismo) VALUES
  ('talento','contratos','salario',3,'Nómina y obligaciones laborales',false,'rls_y_bitacora');

GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA talento TO casaroca_app;
