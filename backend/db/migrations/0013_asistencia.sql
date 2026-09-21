-- =====================================================================
-- Migración 0013 — ESQUEMA 05 · ASISTENCIA
-- «La plataforma actual registra actividades, pero no el check-in
--  dominical.» Probablemente no hay histórico que traer: este esquema
--  puede empezar en cero sin costo, y esa es una buena noticia para el
--  calendario.
--
-- Dos niveles distintos que NO se deben mezclar:
--   · CONTEO por servicio  — cuánta gente hubo. Existe siempre.
--   · ENTRADA por persona  — quién estuvo. Existe solo donde hay check-in.
-- Confundirlos produce el error clásico: sumar entradas y presentarlas
-- como asistencia total cuando solo una parte de las sedes marca entrada.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS asistencia;
COMMENT ON SCHEMA asistencia IS 'Esquema 05. Conteos por servicio y entradas por persona. Detecta a quien se enfría.';
GRANT USAGE ON SCHEMA asistencia TO casaroca_app, casaroca_lectura, casaroca_migrador;

CREATE TYPE asistencia.tipo_servicio AS ENUM
  ('dominical','entre_semana','oracion','especial','celula','conferencia','retiro');

CREATE TABLE asistencia.servicios (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id       uuid NOT NULL REFERENCES org.sedes(id),
  fecha         date NOT NULL,
  hora_inicio   time NOT NULL,
  tipo          asistencia.tipo_servicio NOT NULL,
  nombre        text,
  -- Si el servicio no admite check-in, sus entradas por persona no
  -- existen y los informes no deben insinuar que faltan.
  admite_checkin boolean NOT NULL DEFAULT false,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sede_id, fecha, hora_inicio, tipo)
);
CREATE INDEX servicios_sede_fecha_idx ON asistencia.servicios (sede_id, fecha DESC);

-- Conteo agregado. Un solo conteo oficial por servicio.
CREATE TABLE asistencia.conteos (
  servicio_id     uuid PRIMARY KEY REFERENCES asistencia.servicios(id) ON DELETE RESTRICT,
  adultos         integer NOT NULL DEFAULT 0 CHECK (adultos >= 0),
  jovenes         integer NOT NULL DEFAULT 0 CHECK (jovenes >= 0),
  ninos           integer NOT NULL DEFAULT 0 CHECK (ninos >= 0),
  primera_vez     integer NOT NULL DEFAULT 0 CHECK (primera_vez >= 0),
  reportado_por   uuid REFERENCES nucleo.personas(id),
  reportado_en    timestamptz NOT NULL DEFAULT now(),
  total           integer GENERATED ALWAYS AS (adultos + jovenes + ninos) STORED
);
COMMENT ON COLUMN asistencia.conteos.total IS
  'Columna generada: no se puede escribir a mano, así que no puede contradecir a sus sumandos.';

-- Los de primera vez son un subconjunto: no pueden superar el total.
ALTER TABLE asistencia.conteos
  ADD CONSTRAINT conteo_primera_vez_coherente CHECK (primera_vez <= adultos + jovenes + ninos);

CREATE TABLE asistencia.entradas (
  id           bigserial PRIMARY KEY,
  servicio_id  uuid NOT NULL REFERENCES asistencia.servicios(id) ON DELETE RESTRICT,
  persona_id   uuid NOT NULL REFERENCES nucleo.personas(id) ON DELETE RESTRICT,
  marcada_en   timestamptz NOT NULL DEFAULT now(),
  medio        text NOT NULL DEFAULT 'manual' CHECK (medio IN ('manual','qr','app','tarjeta')),
  UNIQUE (servicio_id, persona_id)
);
CREATE INDEX entradas_persona_idx ON asistencia.entradas (persona_id, marcada_en DESC);

-- No se puede marcar entrada en un servicio que no admite check-in.
CREATE OR REPLACE FUNCTION asistencia.tg_servicio_admite_checkin() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_admite boolean;
BEGIN
  SELECT admite_checkin INTO v_admite FROM asistencia.servicios WHERE id = NEW.servicio_id;
  IF NOT v_admite THEN
    RAISE EXCEPTION 'El servicio % no admite registro de entrada por persona', NEW.servicio_id
      USING ERRCODE = 'check_violation',
            HINT = 'Marque el servicio como admite_checkin, o registre solo el conteo agregado.';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER trg_servicio_admite_checkin BEFORE INSERT ON asistencia.entradas
  FOR EACH ROW EXECUTE FUNCTION asistencia.tg_servicio_admite_checkin();

-- ---------------------------------------------------------------------
-- La pregunta que este esquema existe para responder:
-- ¿quién se está enfriando? Personas con membresía viva que llevan más
-- de N semanas sin aparecer, solo donde el check-in es fiable.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION asistencia.dias_sin_asistir(p_persona_id uuid)
RETURNS integer LANGUAGE sql STABLE AS $$
  SELECT (CURRENT_DATE - max(s.fecha))::int
  FROM asistencia.entradas e JOIN asistencia.servicios s ON s.id = e.servicio_id
  WHERE e.persona_id = p_persona_id
$$;

CREATE OR REPLACE VIEW asistencia.v_se_estan_enfriando AS
SELECT p.id AS persona_id, p.sede_id,
       asistencia.dias_sin_asistir(p.id) AS dias_sin_asistir,
       (SELECT count(*) FROM grupos.membresias m
         WHERE m.persona_id = p.id AND m.fecha_salida IS NULL) AS grupos_activos
FROM nucleo.personas p
WHERE p.eliminado_en IS NULL AND p.estado = 'activa'
  AND COALESCE(asistencia.dias_sin_asistir(p.id), 9999) > 42;

COMMENT ON VIEW asistencia.v_se_estan_enfriando IS
  'Seis semanas sin marcar entrada. Es una señal para el pastor, no un juicio: en sedes sin check-in todos aparecen aquí, por eso se cruza con grupos_activos.';

ALTER TABLE asistencia.servicios ENABLE ROW LEVEL SECURITY; ALTER TABLE asistencia.servicios FORCE ROW LEVEL SECURITY;
CREATE POLICY servicios_sel ON asistencia.servicios FOR SELECT USING (plataforma.sede_visible(sede_id));
CREATE POLICY servicios_ins ON asistencia.servicios FOR INSERT WITH CHECK (plataforma.sede_visible(sede_id));
CREATE POLICY servicios_upd ON asistencia.servicios FOR UPDATE USING (plataforma.sede_visible(sede_id));

GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA asistencia TO casaroca_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA asistencia TO casaroca_app;
