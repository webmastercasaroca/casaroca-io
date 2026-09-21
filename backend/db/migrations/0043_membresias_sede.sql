-- =====================================================================
-- Migración 0043 — LA SEDE DE UNA PERSONA DEJA DE SER UNA COLUMNA
--
-- ⛔ EL PROBLEMA, CON UN CASO REAL. Ana congrega en Bogotá Chicó ocho
--    años: aporta, se forma, recibe consejería. Se muda a Chía y alguien
--    actualiza `nucleo.personas.sede_id`. En ese instante, con el modelo
--    anterior:
--      · Chía pasa a ver TODA su historia de Chicó, incluidos ocho años
--        de aportes, porque la historia colgaba de la sede de HOY.
--      · Chicó deja de verla, y sus reportes históricos cambian solos.
--      · Nadie puede responder «¿desde cuándo está en Chía?»: no hay fecha.
--      · Y un líder que congrega en una sede y SIRVE en otra simplemente
--        no se puede representar. En una red de 36 sedes eso no es un caso
--        raro: es el caso normal.
--
--    Una columna mutable no guarda un hecho: guarda el último hecho y
--    borra los anteriores. Cambiar la sede de alguien reescribía el pasado.
--
-- ⭐ LO QUE ESTA MIGRACIÓN CAMBIA Y LO QUE DELIBERADAMENTE NO CAMBIA:
--
--    SÍ cambia: la verdad sobre dónde está una persona pasa a
--    `nucleo.membresias_sede`, con tipo, fecha de inicio, fecha de fin,
--    motivo y quién la aprobó. Se puede tener más de una vigente.
--
--    NO cambia: `personas.sede_id` SIGUE existiendo, como la sede
--    principal de hoy, mantenida por disparador. No es duplicación por
--    descuido: es la columna que hace que la seguridad por fila resuelva
--    con un índice en vez de con una subconsulta en cada una de las 76
--    tablas. La diferencia es que ahora NADIE la escribe a mano: el
--    intento se rechaza y hay que usar `nucleo.trasladar()`.
--
--    TAMPOCO cambia: los hechos (aportes, asistencia, casos, check-ins)
--    conservan SU propio `sede_id`, el de la sede donde ocurrieron. Por eso
--    un traslado ya no mueve la historia: la historia nunca fue de la
--    persona, fue del hecho.
--
-- ⭐ Y LA REGLA DE VISIBILIDAD, QUE ES LA PARTE FINA:
--      · Membresía VIGENTE en mi sede  → la veo y la puedo editar.
--      · Membresía HISTÓRICA en mi sede → la veo, no la puedo editar.
--        Quien fue de Chicó ocho años sigue siendo parte de la historia de
--        Chicó. Lo que Chicó no ve es lo que Ana haga en Chía a partir de hoy.
--      · Sin membresía, ni vigente ni histórica → no existe para mí.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · CATÁLOGO DE TIPOS · tabla, no tipo enumerado del motor
--     (la razón está en la migración 0045)
-- ---------------------------------------------------------------------
CREATE TABLE nucleo.tipos_membresia (
  codigo            text PRIMARY KEY,
  nombre            text NOT NULL,
  descripcion       text NOT NULL,
  puede_ser_principal boolean NOT NULL DEFAULT true,
  orden             smallint NOT NULL DEFAULT 100,
  vigente           boolean NOT NULL DEFAULT true
);

INSERT INTO nucleo.tipos_membresia (codigo, nombre, descripcion, puede_ser_principal, orden) VALUES
 ('miembro',    'Miembro',            'Congrega en esta sede y es su casa.', true, 10),
 ('visitante',  'Visitante',          'Ha asistido, todavia no es su casa.', true, 20),
 ('servidor',   'Servidor',           'Sirve en esta sede aunque congregue en otra.', false, 30),
 ('en_traslado','En traslado',        'Traslado en curso: la sede destino ya lo espera.', false, 40),
 ('invitado',   'Invitado de la red', 'Participa en algo puntual de esta sede.', false, 50),
 ('egresado',   'Egresado',           'Estuvo aqui y ya no. Se conserva para la historia.', false, 60);

-- ---------------------------------------------------------------------
-- 2 · LA MEMBRESÍA · la verdad sobre dónde está alguien, con fechas
-- ---------------------------------------------------------------------
CREATE TABLE nucleo.membresias_sede (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id    uuid NOT NULL REFERENCES nucleo.personas(id) ON DELETE RESTRICT,
  sede_id       uuid NOT NULL REFERENCES org.sedes(id) ON DELETE RESTRICT,
  tipo          text NOT NULL REFERENCES nucleo.tipos_membresia(codigo),
  es_principal  boolean NOT NULL DEFAULT false,
  desde         date NOT NULL DEFAULT CURRENT_DATE,
  hasta         date,
  motivo        text,
  aprobada_por  uuid REFERENCES nucleo.personas(id),
  acta_referencia text,
  source_system text,
  source_id     text,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT membresia_vigencia CHECK (hasta IS NULL OR hasta >= desde),
  CONSTRAINT membresia_linaje CHECK ((source_system IS NULL) = (source_id IS NULL))
);

-- Una sola membresía PRINCIPAL vigente por persona. La base lo impide,
-- no el programador.
CREATE UNIQUE INDEX membresia_principal_uq ON nucleo.membresias_sede (persona_id)
  WHERE es_principal AND hasta IS NULL;
-- Y no dos membresías vigentes en la MISMA sede.
CREATE UNIQUE INDEX membresia_sede_uq ON nucleo.membresias_sede (persona_id, sede_id)
  WHERE hasta IS NULL;
CREATE INDEX membresia_sede_idx    ON nucleo.membresias_sede (sede_id) WHERE hasta IS NULL;
CREATE INDEX membresia_persona_idx ON nucleo.membresias_sede (persona_id, desde DESC);

COMMENT ON TABLE nucleo.membresias_sede IS
  'Donde esta y donde estuvo cada persona, con fechas. Es la fuente de verdad; personas.sede_id es su reflejo mantenido por disparador.';
COMMENT ON COLUMN nucleo.membresias_sede.es_principal IS
  'La sede que la persona llama su casa. Solo una vigente. Las demas son servicio, invitacion o traslado en curso.';

-- Solo un tipo marcado como principal puede serlo.
CREATE OR REPLACE FUNCTION nucleo.tg_membresia_tipo_valido() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_ok boolean;
BEGIN
  IF NEW.es_principal THEN
    SELECT puede_ser_principal INTO v_ok FROM nucleo.tipos_membresia WHERE codigo = NEW.tipo;
    IF NOT v_ok THEN
      RAISE EXCEPTION 'El tipo de membresia «%» no puede ser la sede principal de nadie', NEW.tipo
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_membresia_tipo_valido
  BEFORE INSERT OR UPDATE ON nucleo.membresias_sede
  FOR EACH ROW EXECUTE FUNCTION nucleo.tg_membresia_tipo_valido();

-- ---------------------------------------------------------------------
-- 3 · CONSULTAS BÁSICAS
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION nucleo.sedes_de_persona(p_persona uuid, p_fecha date DEFAULT CURRENT_DATE)
RETURNS uuid[] LANGUAGE sql STABLE AS $$
  SELECT COALESCE(array_agg(DISTINCT sede_id), '{}'::uuid[])
  FROM nucleo.membresias_sede
  WHERE persona_id = p_persona AND desde <= p_fecha AND (hasta IS NULL OR hasta >= p_fecha);
$$;

CREATE OR REPLACE FUNCTION nucleo.sede_principal_de(p_persona uuid)
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT sede_id FROM nucleo.membresias_sede
  WHERE persona_id = p_persona AND es_principal AND hasta IS NULL LIMIT 1;
$$;

-- ---------------------------------------------------------------------
-- 4 · EL REFLEJO · personas.sede_id lo mantiene el disparador
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION nucleo.tg_sincronizar_sede_principal() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_actual uuid;
BEGIN
  IF NEW.es_principal AND NEW.hasta IS NULL THEN
    SELECT sede_id INTO v_actual FROM nucleo.personas WHERE id = NEW.persona_id;
    IF v_actual IS DISTINCT FROM NEW.sede_id THEN
      PERFORM set_config('app.traslado_en_curso', 'si', true);
      UPDATE nucleo.personas SET sede_id = NEW.sede_id WHERE id = NEW.persona_id;
      PERFORM set_config('app.traslado_en_curso', 'no', true);
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_sincronizar_sede_principal
  AFTER INSERT OR UPDATE ON nucleo.membresias_sede
  FOR EACH ROW EXECUTE FUNCTION nucleo.tg_sincronizar_sede_principal();

-- ⛔ Y la columna se vuelve de solo lectura para todo el mundo.
--    Este es el corazón de la migración: sin este disparador, cualquiera
--    sigue pudiendo reescribir el pasado con un UPDATE de una línea.
CREATE OR REPLACE FUNCTION nucleo.tg_sede_no_se_toca_a_mano() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.sede_id IS DISTINCT FROM OLD.sede_id
     AND COALESCE(current_setting('app.traslado_en_curso', true), 'no') <> 'si' THEN
    RAISE EXCEPTION
      'La sede de una persona no se cambia con UPDATE: se traslada con nucleo.trasladar(). Un UPDATE reescribe el pasado sin dejar fecha ni motivo.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_sede_no_se_toca_a_mano
  BEFORE UPDATE ON nucleo.personas
  FOR EACH ROW EXECUTE FUNCTION nucleo.tg_sede_no_se_toca_a_mano();

-- Toda persona nueva nace con su membresía principal. Así el código que
-- ya existe (y los seeds) siguen funcionando sin tocar una línea.
CREATE OR REPLACE FUNCTION nucleo.tg_persona_nace_con_membresia() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO nucleo.membresias_sede (persona_id, sede_id, tipo, es_principal, desde, motivo, source_system, source_id)
  VALUES (NEW.id, NEW.sede_id,
          CASE WHEN NEW.estado::text = 'activa' THEN 'miembro' ELSE 'visitante' END,
          true, COALESCE(NEW.creado_en::date, CURRENT_DATE),
          'Alta de la persona', NEW.source_system, NEW.source_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_persona_nace_con_membresia
  AFTER INSERT ON nucleo.personas
  FOR EACH ROW EXECUTE FUNCTION nucleo.tg_persona_nace_con_membresia();

-- ---------------------------------------------------------------------
-- 5 · TRASLADAR · el proceso, no el UPDATE
-- ---------------------------------------------------------------------
INSERT INTO crm.tipos_hecho (codigo, nombre, modulo, nivel)
SELECT 'TRASLADO_SEDE', 'Traslado de sede', 'personas', 1
WHERE NOT EXISTS (SELECT 1 FROM crm.tipos_hecho WHERE codigo = 'TRASLADO_SEDE');

CREATE OR REPLACE FUNCTION nucleo.trasladar(
  p_persona        uuid,
  p_sede_destino   uuid,
  p_motivo         text,
  p_aprobada_por   uuid DEFAULT NULL,
  p_acta           text DEFAULT NULL,
  p_desde          date DEFAULT CURRENT_DATE
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_origen uuid; v_id uuid; v_nombre text; v_mismo_dia boolean;
BEGIN
  SELECT sede_id INTO v_origen FROM nucleo.membresias_sede
  WHERE persona_id = p_persona AND es_principal AND hasta IS NULL;

  IF v_origen IS NULL THEN
    RAISE EXCEPTION 'La persona % no tiene sede principal vigente: no hay de dónde trasladarla', p_persona;
  END IF;
  IF v_origen = p_sede_destino THEN
    RAISE EXCEPTION 'Origen y destino son la misma sede. Un traslado a la propia sede no es un traslado'
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) < 5 THEN
    RAISE EXCEPTION 'Un traslado sin motivo escrito no se registra' USING ERRCODE = 'check_violation';
  END IF;

  -- La membresía anterior se CIERRA, no se borra. Esa es toda la diferencia.
  --
  -- ⛔ El GREATEST no es cosmético. Sin él, trasladar a alguien el MISMO
  --    día en que fue registrado deja la fecha de salida un día antes de
  --    la de entrada y la base rechaza la transacción entera. Y ese caso
  --    ocurre de verdad: un visitante que llega el domingo y se registra
  --    en la sede equivocada, y lo corrigen esa misma mañana. El traslado
  --    del mismo día se marca como corrección en la línea de tiempo.
  SELECT (desde = p_desde) INTO v_mismo_dia FROM nucleo.membresias_sede
   WHERE persona_id = p_persona AND es_principal AND hasta IS NULL;

  UPDATE nucleo.membresias_sede
     SET hasta = GREATEST(p_desde - 1, desde), tipo = 'egresado', es_principal = false,
         motivo = COALESCE(motivo,'') || ' · cerrada por traslado: ' || p_motivo
   WHERE persona_id = p_persona AND es_principal AND hasta IS NULL;

  INSERT INTO nucleo.membresias_sede
    (persona_id, sede_id, tipo, es_principal, desde, motivo, aprobada_por, acta_referencia)
  VALUES (p_persona, p_sede_destino, 'miembro', true, p_desde, p_motivo, p_aprobada_por, p_acta)
  RETURNING id INTO v_id;

  SELECT COALESCE(primer_nombre,'')||' '||COALESCE(primer_apellido,'') INTO v_nombre
  FROM nucleo.personas WHERE id = p_persona;

  PERFORM crm.anotar_hecho(
    p_persona, p_sede_destino, now(), 'TRASLADO_SEDE', 'personas',
    'membresia_sede', v_id::text,
    CASE WHEN v_mismo_dia THEN 'Correccion de sede el mismo dia: ' ELSE 'Traslado de sede: ' END||p_motivo,
    jsonb_build_object('sede_origen', v_origen, 'sede_destino', p_sede_destino,
                       'desde', p_desde, 'aprobada_por', p_aprobada_por, 'acta', p_acta,
                       'es_correccion_mismo_dia', COALESCE(v_mismo_dia,false)));
  RETURN v_id;
END $$;

COMMENT ON FUNCTION nucleo.trasladar IS
  'Cierra la membresia anterior y abre la nueva. La historia de la sede anterior NO viaja: los hechos conservan su propio sede_id.';

-- ---------------------------------------------------------------------
-- 6 · SEGURIDAD POR FILA · ahora la visibilidad la da la membresía
-- ---------------------------------------------------------------------
SELECT plataforma.publicar_tabla('nucleo.tipos_membresia'::regclass, 'catalogo_red',
  'Catalogo de tipos de membresia de la red. No contiene ninguna persona.', 'Mesa tecnica 100p');

ALTER TABLE nucleo.membresias_sede ENABLE ROW LEVEL SECURITY;
ALTER TABLE nucleo.membresias_sede FORCE ROW LEVEL SECURITY;
CREATE POLICY membresias_sel ON nucleo.membresias_sede FOR SELECT
  USING (plataforma.sede_visible(sede_id));
CREATE POLICY membresias_ins ON nucleo.membresias_sede FOR INSERT
  WITH CHECK (plataforma.sede_visible(sede_id));
CREATE POLICY membresias_upd ON nucleo.membresias_sede FOR UPDATE
  USING (plataforma.sede_visible(sede_id)) WITH CHECK (plataforma.sede_visible(sede_id));
GRANT SELECT, INSERT, UPDATE ON nucleo.membresias_sede TO casaroca_app;
INSERT INTO plataforma.registro_exposicion (esquema, tabla, modo, justificacion, decidido_por)
VALUES ('nucleo','membresias_sede','por_sede',
        'La membresia es de la sede: cada sede ve quien esta y quien estuvo en ella, y nada de las demas.',
        'Mesa tecnica 100p');

-- ⛔ LA POLÍTICA DE PERSONAS SE REESCRIBE. Antes: «tu sede de hoy es la
--    mía». Ahora: «tuviste o tienes membresía en una de mis sedes».
--    Ver es una cosa; editar es otra, y exige membresía VIGENTE.
DROP POLICY IF EXISTS personas_sel ON nucleo.personas;
DROP POLICY IF EXISTS personas_ins ON nucleo.personas;
DROP POLICY IF EXISTS personas_upd ON nucleo.personas;

CREATE POLICY personas_sel ON nucleo.personas FOR SELECT
  USING (
    plataforma.sede_visible(sede_id)            -- camino rápido: su sede de hoy
    OR EXISTS (                                  -- o cualquier membresia, vigente o cerrada
      SELECT 1 FROM nucleo.membresias_sede m
      WHERE m.persona_id = nucleo.personas.id
        AND plataforma.sede_visible(m.sede_id))
  );

CREATE POLICY personas_ins ON nucleo.personas FOR INSERT
  WITH CHECK (plataforma.sede_visible(sede_id));

CREATE POLICY personas_upd ON nucleo.personas FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM nucleo.membresias_sede m
            WHERE m.persona_id = nucleo.personas.id
              AND m.hasta IS NULL
              AND plataforma.sede_visible(m.sede_id))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM nucleo.membresias_sede m
            WHERE m.persona_id = nucleo.personas.id
              AND m.hasta IS NULL
              AND plataforma.sede_visible(m.sede_id))
  );

-- ---------------------------------------------------------------------
-- 7 · VISTAS DE TRABAJO
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW nucleo.v_membresias_actuales
WITH (security_invoker = true) AS
SELECT m.persona_id, m.sede_id, s.codigo AS sede_codigo, s.nombre AS sede_nombre,
       m.tipo, t.nombre AS tipo_nombre, m.es_principal, m.desde,
       (CURRENT_DATE - m.desde) AS dias_en_la_sede
FROM nucleo.membresias_sede m
JOIN org.sedes s ON s.id = m.sede_id
JOIN nucleo.tipos_membresia t ON t.codigo = m.tipo
WHERE m.hasta IS NULL;

CREATE OR REPLACE VIEW nucleo.v_traslados
WITH (security_invoker = true) AS
SELECT m.persona_id, m.sede_id, s.codigo AS sede_codigo, m.desde, m.hasta,
       m.motivo, m.aprobada_por, m.acta_referencia,
       (m.hasta IS NULL) AS vigente
FROM nucleo.membresias_sede m
JOIN org.sedes s ON s.id = m.sede_id
ORDER BY m.persona_id, m.desde;

GRANT SELECT ON nucleo.v_membresias_actuales, nucleo.v_traslados TO casaroca_app;

-- ---------------------------------------------------------------------
-- 8 · CARGA INICIAL · toda persona que ya existía recibe su membresía
--     En una base recién creada esto no hace nada (las personas llegan
--     en los seeds y las crea el disparador). En la base de producción,
--     que ya tiene gente, esta es la línea que la pone al día.
-- ---------------------------------------------------------------------
DO $$
DECLARE v int;
BEGIN
  INSERT INTO nucleo.membresias_sede
    (persona_id, sede_id, tipo, es_principal, desde, motivo, source_system, source_id)
  SELECT p.id, p.sede_id,
         CASE WHEN p.estado::text = 'activa' THEN 'miembro' ELSE 'visitante' END,
         true, COALESCE(p.creado_en::date, CURRENT_DATE),
         'Carga inicial desde personas.sede_id (migracion 0043)',
         p.source_system, p.source_id
  FROM nucleo.personas p
  WHERE NOT EXISTS (SELECT 1 FROM nucleo.membresias_sede m WHERE m.persona_id = p.id);
  GET DIAGNOSTICS v = ROW_COUNT;
  RAISE NOTICE 'Membresias creadas en la carga inicial: %', v;
END $$;
