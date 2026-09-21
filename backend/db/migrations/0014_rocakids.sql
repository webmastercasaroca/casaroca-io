-- =====================================================================
-- Migración 0014 — ESQUEMA 06 · ROCAKIDS  (nivel N4, el más restringido)
-- Sin origen digital: sale de las planillas y del sistema del ministerio.
--
-- La regla que este esquema existe para hacer cumplir:
--   A UN NIÑO SOLO SE LO ENTREGA A QUIEN ESTÁ AUTORIZADO Y CONOCE EL
--   CÓDIGO. Y esa regla vive aquí, en la base, no en la pantalla del
--   voluntario de turno — porque la pantalla se salta y la base no.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS rocakids;
COMMENT ON SCHEMA rocakids IS 'Esquema 06. Nivel N4. Check-in y entrega segura de menores.';
GRANT USAGE ON SCHEMA rocakids TO casaroca_app, casaroca_migrador;

-- Las cuatro etapas del ministerio. ⛔ La etapa es un rango de edad
-- declarado por el ministerio, no una deducción del sistema.
CREATE TABLE rocakids.salas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id      uuid NOT NULL REFERENCES org.sedes(id),
  codigo       text NOT NULL,
  nombre       text NOT NULL,
  edad_min     smallint NOT NULL CHECK (edad_min >= 0),
  edad_max     smallint NOT NULL CHECK (edad_max < 18),
  capacidad    smallint CHECK (capacidad IS NULL OR capacidad > 0),
  activa       boolean NOT NULL DEFAULT true,
  UNIQUE (sede_id, codigo),
  CONSTRAINT sala_rango_coherente CHECK (edad_max >= edad_min)
);

CREATE TABLE rocakids.inscripciones (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menor_id     uuid NOT NULL REFERENCES nucleo.personas(id) ON DELETE RESTRICT,
  sala_id      uuid NOT NULL REFERENCES rocakids.salas(id) ON DELETE RESTRICT,
  desde        date NOT NULL DEFAULT CURRENT_DATE,
  hasta        date,
  CONSTRAINT inscripcion_vigencia CHECK (hasta IS NULL OR hasta >= desde)
);
CREATE UNIQUE INDEX inscripcion_abierta_uq ON rocakids.inscripciones (menor_id) WHERE hasta IS NULL;

-- Autorizaciones del acudiente. Cada una con su fecha: una autorización
-- de foto firmada en 2021 no cubre una publicación de 2026.
CREATE TABLE rocakids.autorizaciones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menor_id      uuid NOT NULL REFERENCES nucleo.personas(id) ON DELETE RESTRICT,
  otorgada_por  uuid NOT NULL REFERENCES nucleo.personas(id),
  tipo          text NOT NULL CHECK (tipo IN ('foto','video','eventos','retiros','transporte','emergencia_medica')),
  concedida     boolean NOT NULL,
  ocurrido_en   timestamptz NOT NULL,
  vence_en      date,
  evidencia_ref text,
  registrado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX autorizaciones_menor_idx ON rocakids.autorizaciones (menor_id, tipo, ocurrido_en DESC);
CREATE RULE autorizaciones_no_update AS ON UPDATE TO rocakids.autorizaciones DO INSTEAD NOTHING;
CREATE RULE autorizaciones_no_delete AS ON DELETE TO rocakids.autorizaciones DO INSTEAD NOTHING;

CREATE OR REPLACE FUNCTION rocakids.autorizado(p_menor_id uuid, p_tipo text)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT a.concedida AND (a.vence_en IS NULL OR a.vence_en >= CURRENT_DATE)
     FROM rocakids.autorizaciones a
     WHERE a.menor_id = p_menor_id AND a.tipo = p_tipo
     ORDER BY a.ocurrido_en DESC, a.registrado_en DESC LIMIT 1),
    false)   -- sin registro, NO autorizado
$$;

-- Información médica. N4 y de lectura registrada.
CREATE TABLE rocakids.condiciones_medicas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menor_id      uuid NOT NULL REFERENCES nucleo.personas(id) ON DELETE RESTRICT,
  tipo          text NOT NULL CHECK (tipo IN ('alergia','medicamento','condicion','restriccion_alimentaria')),
  descripcion   text NOT NULL,
  critica       boolean NOT NULL DEFAULT false,
  registrada_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX condiciones_menor_idx ON rocakids.condiciones_medicas (menor_id) WHERE critica;

-- ---------------------------------------------------------------------
-- CHECK-IN
-- ---------------------------------------------------------------------
CREATE TABLE rocakids.checkins (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menor_id       uuid NOT NULL REFERENCES nucleo.personas(id) ON DELETE RESTRICT,
  sala_id        uuid NOT NULL REFERENCES rocakids.salas(id),
  servicio_id    uuid REFERENCES asistencia.servicios(id),
  sede_id        uuid NOT NULL REFERENCES org.sedes(id),
  entregado_por  uuid NOT NULL REFERENCES nucleo.personas(id),  -- quién lo trajo
  recibido_por   uuid NOT NULL REFERENCES nucleo.personas(id),  -- el maestro
  ingreso_en     timestamptz NOT NULL DEFAULT now(),
  -- El código de entrega, cifrado. Se genera al ingresar y se le da al
  -- acudiente; el sistema nunca lo muestra de nuevo.
  codigo_cifrado bytea NOT NULL,
  salida_en      timestamptz,
  retirado_por   uuid REFERENCES nucleo.personas(id),
  autorizado_por uuid REFERENCES nucleo.personas(id),  -- maestro que entregó
  observacion_salida text,
  CONSTRAINT checkin_salida_coherente CHECK (
    (salida_en IS NULL AND retirado_por IS NULL AND autorizado_por IS NULL)
    OR (salida_en IS NOT NULL AND retirado_por IS NOT NULL AND autorizado_por IS NOT NULL))
);
CREATE INDEX checkins_menor_idx ON rocakids.checkins (menor_id, ingreso_en DESC);
CREATE UNIQUE INDEX checkin_abierto_uq ON rocakids.checkins (menor_id) WHERE salida_en IS NULL;

COMMENT ON INDEX rocakids.checkin_abierto_uq IS
  'Un menor no puede estar dentro dos veces. Si el índice choca, es que la salida anterior nunca se registró: eso es un incidente, no un error de tecleo.';

-- ⛔ INVARIANTE 1: no se hace check-in de un menor sin acudiente vigente.
CREATE OR REPLACE FUNCTION rocakids.tg_checkin_exige_acudiente() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM nucleo.acudientes a
    WHERE a.menor_id = NEW.menor_id
      AND a.vigente_desde <= CURRENT_DATE
      AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)
  ) THEN
    RAISE EXCEPTION 'No se puede recibir al menor %: no tiene acudiente vigente registrado', NEW.menor_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER trg_checkin_exige_acudiente BEFORE INSERT ON rocakids.checkins
  FOR EACH ROW EXECUTE FUNCTION rocakids.tg_checkin_exige_acudiente();

-- ---------------------------------------------------------------------
-- ⛔ INVARIANTE 2 — LA ENTREGA. Tres condiciones, todas obligatorias:
--    1. quien retira es acudiente vigente CON permiso de retiro
--    2. el código coincide
--    3. queda registrado quién autorizó la salida
-- La salida NO se escribe con un UPDATE suelto: se hace por esta función.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rocakids.entregar_menor(
  p_checkin_id   uuid,
  p_retirado_por uuid,
  p_codigo       text,
  p_maestro_id   uuid
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_menor uuid; v_cifrado bytea; v_salida timestamptz; v_llave text := plataforma.llave_n4();
BEGIN
  IF v_llave IS NULL THEN
    RAISE EXCEPTION 'No hay llave N4 en la sesión: no se puede verificar el código de entrega'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT menor_id, codigo_cifrado, salida_en INTO v_menor, v_cifrado, v_salida
  FROM rocakids.checkins WHERE id = p_checkin_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe el ingreso %', p_checkin_id USING ERRCODE = 'no_data_found';
  END IF;
  IF v_salida IS NOT NULL THEN
    RAISE EXCEPTION 'El menor ya fue entregado el %', v_salida USING ERRCODE = 'check_violation';
  END IF;

  -- Condición 1: acudiente vigente y con permiso de retiro.
  IF NOT EXISTS (
    SELECT 1 FROM nucleo.acudientes a
    WHERE a.menor_id = v_menor AND a.acudiente_id = p_retirado_por
      AND a.autoriza_retiro
      AND a.vigente_desde <= CURRENT_DATE
      AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)
  ) THEN
    PERFORM plataforma.registrar_lectura('rocakids','checkins',p_checkin_id::text,4::smallint,
            'INTENTO DE RETIRO POR PERSONA NO AUTORIZADA');
    RAISE EXCEPTION 'La persona % no está autorizada para retirar al menor %', p_retirado_por, v_menor
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Condición 2: el código.
  IF pgp_sym_decrypt(v_cifrado, v_llave) <> p_codigo THEN
    PERFORM plataforma.registrar_lectura('rocakids','checkins',p_checkin_id::text,4::smallint,
            'CÓDIGO DE ENTREGA INCORRECTO');
    RAISE EXCEPTION 'El código de entrega no coincide' USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE rocakids.checkins
     SET salida_en = now(), retirado_por = p_retirado_por, autorizado_por = p_maestro_id
   WHERE id = p_checkin_id;

  PERFORM plataforma.registrar_lectura('rocakids','checkins',p_checkin_id::text,4::smallint,
          'Entrega de menor verificada');
END
$$;

COMMENT ON FUNCTION rocakids.entregar_menor IS
  'Única vía para registrar la salida de un menor. Los intentos fallidos quedan en la bitácora de lectura: un código equivocado dos veces seguidas es información que alguien debe ver.';

-- ⛔ La salida no se puede escribir a mano saltándose la función.
CREATE OR REPLACE FUNCTION rocakids.tg_salida_solo_por_funcion() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.salida_en IS NULL AND NEW.salida_en IS NOT NULL
     AND COALESCE(current_setting('app.entrega_verificada', true),'') <> 'si' THEN
    RAISE EXCEPTION 'La salida de un menor solo puede registrarse con rocakids.entregar_menor()'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER trg_salida_solo_por_funcion BEFORE UPDATE ON rocakids.checkins
  FOR EACH ROW EXECUTE FUNCTION rocakids.tg_salida_solo_por_funcion();

-- La función marca el permiso para su propio UPDATE.
CREATE OR REPLACE FUNCTION rocakids.entregar_menor(
  p_checkin_id uuid, p_retirado_por uuid, p_codigo text, p_maestro_id uuid, p_interno boolean
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('app.entrega_verificada','si', true);
  PERFORM rocakids.entregar_menor(p_checkin_id, p_retirado_por, p_codigo, p_maestro_id);
  PERFORM set_config('app.entrega_verificada','', true);
END
$$;

-- ── Aislamiento: sede + nivel N4 ──────────────────────────────────────
ALTER TABLE rocakids.checkins ENABLE ROW LEVEL SECURITY; ALTER TABLE rocakids.checkins FORCE ROW LEVEL SECURITY;
CREATE POLICY checkins_sel ON rocakids.checkins FOR SELECT
  USING (plataforma.ctx_nivel_max() >= 4 AND plataforma.sede_visible(sede_id));
CREATE POLICY checkins_ins ON rocakids.checkins FOR INSERT
  WITH CHECK (plataforma.ctx_nivel_max() >= 4 AND plataforma.sede_visible(sede_id));
CREATE POLICY checkins_upd ON rocakids.checkins FOR UPDATE
  USING (plataforma.ctx_nivel_max() >= 4 AND plataforma.sede_visible(sede_id));

ALTER TABLE rocakids.condiciones_medicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE rocakids.condiciones_medicas FORCE ROW LEVEL SECURITY;
CREATE POLICY condiciones_sel ON rocakids.condiciones_medicas FOR SELECT
  USING (plataforma.ctx_nivel_max() >= 4);
CREATE POLICY condiciones_ins ON rocakids.condiciones_medicas FOR INSERT
  WITH CHECK (plataforma.ctx_nivel_max() >= 4);

INSERT INTO plataforma.clasificacion_columna (esquema,tabla,columna,nivel,finalidad,cifrada,mecanismo) VALUES
  ('rocakids','checkins','codigo_cifrado',4,'Entrega segura de menores',true,'cifrado_columna'),
  ('rocakids','condiciones_medicas','descripcion',4,'Salud del menor durante el cuidado',false,'rls_y_bitacora'),
  ('rocakids','checkins','menor_id',4,'Trazabilidad de custodia',false,'rls_y_bitacora');

GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA rocakids TO casaroca_app;
