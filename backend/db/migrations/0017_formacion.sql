-- =====================================================================
-- Migración 0017 — ESQUEMA 09 · FORMACIÓN
-- Origen: plataforma actual (Cursos) + Instituto (IBLI y FACTER).
-- Aporta inscripciones, avance y certificados emitidos, con cupos y
-- valores donde los haya.
--
-- ⚠️ Los cursos con precio son el mayor riesgo funcional identificado en
-- la auditoría de la plataforma actual: si se migran inscripciones
-- pagadas sin su pago, la iglesia pierde el rastro del dinero recibido.
-- Por eso la inscripción con valor exige su estado de pago declarado.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS formacion;
COMMENT ON SCHEMA formacion IS 'Esquema 09. Cursos cortos, Instituto (IBLI/FACTER) y certificados.';
GRANT USAGE ON SCHEMA formacion TO casaroca_app, casaroca_lectura, casaroca_migrador;

CREATE TYPE formacion.modalidad AS ENUM ('presencial','virtual','mixta');
CREATE TYPE formacion.estado_inscripcion AS ENUM ('inscrito','cursando','aprobado','reprobado','retirado');
CREATE TYPE formacion.estado_pago AS ENUM ('no_aplica','pendiente','pagado','exonerado','parcial');

CREATE TABLE formacion.programas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      text NOT NULL UNIQUE,
  nombre      text NOT NULL,
  tipo        text NOT NULL CHECK (tipo IN ('curso_corto','instituto','diplomado','taller')),
  semestres   smallint CHECK (semestres IS NULL OR semestres > 0),
  descripcion text
);

CREATE TABLE formacion.cursos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programa_id  uuid NOT NULL REFERENCES formacion.programas(id),
  codigo       text NOT NULL UNIQUE,
  nombre       text NOT NULL,
  semestre     smallint,
  horas        smallint CHECK (horas IS NULL OR horas > 0),
  otorga_certificado boolean NOT NULL DEFAULT false,
  prerequisito_id uuid REFERENCES formacion.cursos(id)
);

CREATE TABLE formacion.cohortes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id     uuid NOT NULL REFERENCES formacion.cursos(id) ON DELETE RESTRICT,
  sede_id      uuid NOT NULL REFERENCES org.sedes(id),
  codigo       text NOT NULL,
  modalidad    formacion.modalidad NOT NULL DEFAULT 'presencial',
  inicia       date NOT NULL,
  termina      date,
  cupo         smallint CHECK (cupo IS NULL OR cupo > 0),
  valor        numeric(12,2) CHECK (valor IS NULL OR valor >= 0),
  moneda       char(3) NOT NULL DEFAULT 'COP',
  docente_id   uuid REFERENCES nucleo.personas(id),
  source_system text, source_id text,
  UNIQUE (curso_id, sede_id, codigo),
  CONSTRAINT cohorte_fechas CHECK (termina IS NULL OR termina >= inicia)
);
CREATE INDEX cohortes_sede_idx ON formacion.cohortes (sede_id, inicia DESC);

CREATE TABLE formacion.inscripciones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohorte_id    uuid NOT NULL REFERENCES formacion.cohortes(id) ON DELETE RESTRICT,
  persona_id    uuid NOT NULL REFERENCES nucleo.personas(id) ON DELETE RESTRICT,
  estado        formacion.estado_inscripcion NOT NULL DEFAULT 'inscrito',
  estado_pago   formacion.estado_pago NOT NULL DEFAULT 'no_aplica',
  valor_pagado  numeric(12,2) CHECK (valor_pagado IS NULL OR valor_pagado >= 0),
  aporte_id     uuid REFERENCES aportes.aportes(id),   -- si el pago entró como aporte
  inscrito_en   timestamptz NOT NULL DEFAULT now(),
  nota_final    numeric(4,2) CHECK (nota_final IS NULL OR nota_final BETWEEN 0 AND 5),
  source_system text, source_id text,
  UNIQUE (cohorte_id, persona_id)
);
CREATE INDEX inscripciones_persona_idx ON formacion.inscripciones (persona_id);

-- ⛔ Una cohorte con valor no admite inscripciones con pago «no_aplica».
--    Es el control que impide perder el rastro del dinero al migrar.
CREATE OR REPLACE FUNCTION formacion.tg_pago_declarado() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_valor numeric(12,2); v_cupo smallint; v_inscritos bigint;
BEGIN
  SELECT valor, cupo INTO v_valor, v_cupo FROM formacion.cohortes WHERE id = NEW.cohorte_id;

  IF v_valor IS NOT NULL AND v_valor > 0 AND NEW.estado_pago = 'no_aplica' THEN
    RAISE EXCEPTION 'La cohorte tiene un valor de %: la inscripción debe declarar su estado de pago', v_valor
      USING ERRCODE = 'check_violation',
            HINT = 'Use pendiente, pagado, parcial o exonerado. «no_aplica» solo vale en cursos gratuitos.';
  END IF;

  IF v_cupo IS NOT NULL AND NEW.estado NOT IN ('retirado','reprobado') THEN
    SELECT count(*) INTO v_inscritos FROM formacion.inscripciones
     WHERE cohorte_id = NEW.cohorte_id AND estado NOT IN ('retirado','reprobado') AND id <> NEW.id;
    IF v_inscritos >= v_cupo THEN
      RAISE EXCEPTION 'La cohorte ya alcanzó su cupo de %', v_cupo USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER trg_pago_declarado BEFORE INSERT OR UPDATE ON formacion.inscripciones
  FOR EACH ROW EXECUTE FUNCTION formacion.tg_pago_declarado();

CREATE TABLE formacion.certificados (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inscripcion_id uuid NOT NULL UNIQUE REFERENCES formacion.inscripciones(id) ON DELETE RESTRICT,
  codigo         text NOT NULL UNIQUE,
  emitido_en     date NOT NULL DEFAULT CURRENT_DATE,
  emitido_por    uuid REFERENCES nucleo.personas(id),
  anulado_en     date,
  anulado_motivo text
);

-- ⛔ Un certificado exige la inscripción APROBADA. Certificar a quien no
--    aprobó no es un error de datos: es un documento falso.
CREATE OR REPLACE FUNCTION formacion.tg_certificado_exige_aprobacion() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_estado formacion.estado_inscripcion; v_otorga boolean;
BEGIN
  SELECT i.estado, c.otorga_certificado INTO v_estado, v_otorga
  FROM formacion.inscripciones i
  JOIN formacion.cohortes co ON co.id = i.cohorte_id
  JOIN formacion.cursos   c  ON c.id  = co.curso_id
  WHERE i.id = NEW.inscripcion_id;

  IF v_estado <> 'aprobado' THEN
    RAISE EXCEPTION 'No se puede certificar una inscripción en estado %', v_estado
      USING ERRCODE = 'check_violation';
  END IF;
  IF NOT v_otorga THEN
    RAISE EXCEPTION 'Este curso no otorga certificado' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER trg_certificado_exige_aprobacion BEFORE INSERT ON formacion.certificados
  FOR EACH ROW EXECUTE FUNCTION formacion.tg_certificado_exige_aprobacion();

ALTER TABLE formacion.cohortes ENABLE ROW LEVEL SECURITY; ALTER TABLE formacion.cohortes FORCE ROW LEVEL SECURITY;
CREATE POLICY cohortes_sel ON formacion.cohortes FOR SELECT USING (plataforma.sede_visible(sede_id));
CREATE POLICY cohortes_ins ON formacion.cohortes FOR INSERT WITH CHECK (plataforma.sede_visible(sede_id));
CREATE POLICY cohortes_upd ON formacion.cohortes FOR UPDATE USING (plataforma.sede_visible(sede_id));

GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA formacion TO casaroca_app;
