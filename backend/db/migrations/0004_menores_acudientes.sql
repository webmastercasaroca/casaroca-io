-- =====================================================================
-- Migración 0004 — MENORES Y ACUDIENTES  (nivel N4)
-- «Un menor sin acudiente HACE FALLAR LA TRANSACCIÓN.»
-- No es una validación de pantalla: es una restricción de la base.
--
-- Divergencia nº 10 corregida: la tabla se llama `menores`, no `minores`.
-- Un nombre de tabla vive para siempre.
--
-- Mecanismo: CONSTRAINT TRIGGER DEFERRABLE INITIALLY DEFERRED.
-- Así la aplicación puede insertar al menor y a su acudiente en la misma
-- transacción, en cualquier orden — pero si al hacer COMMIT el menor
-- sigue sin acudiente vigente, la transacción entera se cae.
-- =====================================================================

CREATE TABLE nucleo.acudientes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menor_id       uuid NOT NULL REFERENCES nucleo.personas(id) ON DELETE RESTRICT,
  acudiente_id   uuid NOT NULL REFERENCES nucleo.personas(id) ON DELETE RESTRICT,
  parentesco     text NOT NULL REFERENCES nucleo.tipos_vinculo(codigo),
  es_principal   boolean NOT NULL DEFAULT false,
  autoriza_retiro boolean NOT NULL DEFAULT false,
  vigente_desde  date NOT NULL DEFAULT CURRENT_DATE,
  vigente_hasta  date,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT acudiente_no_reflexivo CHECK (menor_id <> acudiente_id),
  CONSTRAINT acudiente_vigencia CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde)
);
CREATE INDEX acudientes_menor_idx ON nucleo.acudientes (menor_id) WHERE vigente_hasta IS NULL;
CREATE UNIQUE INDEX acudientes_uq ON nucleo.acudientes (menor_id, acudiente_id) WHERE vigente_hasta IS NULL;

COMMENT ON TABLE nucleo.acudientes IS
  'N4. Sin al menos un acudiente vigente, un menor no puede existir en el sistema.';

-- El acudiente tiene que ser mayor de edad. Un menor no puede responder por otro.
CREATE OR REPLACE FUNCTION nucleo.tg_acudiente_es_adulto() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_fnac date;
BEGIN
  SELECT fecha_nacimiento INTO v_fnac FROM nucleo.personas WHERE id = NEW.acudiente_id;
  IF nucleo.es_menor(v_fnac) THEN
    RAISE EXCEPTION 'El acudiente % es menor de edad: no puede responder por otro menor', NEW.acudiente_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER trg_acudiente_es_adulto
  BEFORE INSERT OR UPDATE ON nucleo.acudientes
  FOR EACH ROW EXECUTE FUNCTION nucleo.tg_acudiente_es_adulto();

-- ---------------------------------------------------------------------
-- LA INVARIANTE. Se evalúa al COMMIT, no al INSERT.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION nucleo.tg_menor_exige_acudiente() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_persona_id uuid := COALESCE(NEW.id, OLD.id);
  v_fnac       date;
  v_estado     nucleo.estado_persona;
  v_borrada    timestamptz;
BEGIN
  SELECT fecha_nacimiento, estado, eliminado_en
    INTO v_fnac, v_estado, v_borrada
  FROM nucleo.personas WHERE id = v_persona_id;

  IF NOT FOUND OR v_borrada IS NOT NULL OR v_estado IN ('fallecida','fusionada') THEN
    RETURN NULL;
  END IF;

  IF nucleo.es_menor(v_fnac) THEN
    IF NOT EXISTS (
      SELECT 1 FROM nucleo.acudientes a
      WHERE a.menor_id = v_persona_id
        AND a.vigente_desde <= CURRENT_DATE
        AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)
    ) THEN
      RAISE EXCEPTION 'Menor % sin acudiente vigente: la transacción no puede confirmarse', v_persona_id
        USING ERRCODE = 'foreign_key_violation',
              HINT = 'Registre al menos un acudiente adulto vigente en nucleo.acudientes dentro de la misma transacción.';
    END IF;
  END IF;
  RETURN NULL;
END
$$;

CREATE CONSTRAINT TRIGGER trg_menor_exige_acudiente
  AFTER INSERT OR UPDATE OF fecha_nacimiento, estado ON nucleo.personas
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION nucleo.tg_menor_exige_acudiente();

-- Retirar el último acudiente de un menor activo también debe fallar.
CREATE OR REPLACE FUNCTION nucleo.tg_no_dejar_menor_sin_acudiente() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_fnac date; v_borrada timestamptz;
BEGIN
  SELECT fecha_nacimiento, eliminado_en INTO v_fnac, v_borrada
  FROM nucleo.personas WHERE id = COALESCE(NEW.menor_id, OLD.menor_id);

  IF v_borrada IS NULL AND nucleo.es_menor(v_fnac) AND NOT EXISTS (
      SELECT 1 FROM nucleo.acudientes a
      WHERE a.menor_id = COALESCE(NEW.menor_id, OLD.menor_id)
        AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)
  ) THEN
    RAISE EXCEPTION 'No se puede dejar al menor % sin acudiente vigente', COALESCE(NEW.menor_id, OLD.menor_id)
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NULL;
END
$$;

CREATE CONSTRAINT TRIGGER trg_no_dejar_menor_sin_acudiente
  AFTER UPDATE OR DELETE ON nucleo.acudientes
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION nucleo.tg_no_dejar_menor_sin_acudiente();

-- Registro de clasificación: estas columnas son N4.
INSERT INTO plataforma.clasificacion_columna (esquema,tabla,columna,nivel,finalidad,cifrada) VALUES
  ('nucleo','acudientes','menor_id',     4,'Protección de menores · check-in y entrega segura', false),
  ('nucleo','acudientes','acudiente_id', 4,'Protección de menores · custodia',                   false),
  ('nucleo','personas','fecha_nacimiento',2,'Derivar edad y condición de menor',                 false);
