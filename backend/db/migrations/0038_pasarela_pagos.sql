-- =====================================================================
-- Migración 0038 — LA PASARELA DE PAGOS · recibir el diezmo en línea
--
-- Lo que pidió Daniel: «esto irá conectado a PayU y debe ser funcional y
-- súper conectado con cada persona de la iglesia, porque las personas van
-- a diezmar y el sistema lo va a registrar».
--
-- ⛔ POR QUÉ NO BASTA CON ESCRIBIR EN aportes.aportes
--    `aportes.aportes` es un registro CONTABLE: plata que entró. Un pago
--    con pasarela es otra cosa: nace, queda pendiente, y puede aprobarse,
--    rechazarse, expirar o reversarse días después. Si se escribiera el
--    aporte al iniciar el pago se estaría contabilizando dinero que no
--    llegó; y un pago RECHAZADO no tendría dónde vivir.
--    Por eso van separados: la transacción es el intento, el aporte es el
--    hecho. El aporte SOLO nace cuando la pasarela confirma.
--
-- ⛔ LOS CUATRO PROBLEMAS REALES DE UNA PASARELA, Y DÓNDE SE RESUELVEN
--    1. Reintentos: PayU reenvía la confirmación hasta recibir un 200, y
--       puede llegar DESORDENADA. → `pasarela_eventos` con huella única:
--       el mismo aviso dos veces se guarda una sola vez.
--    2. Suplantación: cualquiera puede hacer un POST diciendo «pagado».
--       → se guarda la firma recibida y si se validó. Sin firma válida no
--       se promueve a aporte.
--    3. Comisión: PayU deposita NETO y días después. La suma de aportes
--       nunca va a cuadrar con el extracto. → `desembolsos` con bruto,
--       comisión, IVA y neto, y sus renglones.
--    4. ⭐ Quién pagó: quien diezma en línea escribe un correo y un
--       documento, no un uuid. → el emparejamiento es explícito y lo que
--       no empareja queda EN ESPERA, visible, no perdido.
--
-- ⭐ LA IDEMPOTENCIA YA ESTABA: `aportes_linaje_uq` es un índice único
--    sobre (source_system, source_id). Con source_system='payu' y
--    source_id = el id de transacción, la base RECHAZA sola el aporte
--    duplicado aunque el webhook llegue diez veces. No hubo que inventar
--    nada: estaba bien diseñado desde la 0016.
-- =====================================================================

CREATE TYPE aportes.estado_pasarela AS ENUM
  ('iniciada','pendiente','aprobada','rechazada','expirada','reversada');

-- ---------------------------------------------------------------------
-- 1 · EL INTENTO DE PAGO
-- ---------------------------------------------------------------------
CREATE TABLE aportes.pasarela_transacciones (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pasarela       text NOT NULL DEFAULT 'payu',
  -- Nuestra referencia, la que viaja a la pasarela y vuelve.
  referencia     text NOT NULL UNIQUE,
  -- El id que asigna la pasarela. Nulo hasta que contesta.
  transaccion_id text,
  orden_id       text,

  sede_id        uuid NOT NULL REFERENCES org.sedes(id),
  -- ⛔ Nulo mientras no se sepa QUIÉN pagó. No es un error: es el estado
  --    honesto de un pago que entró por el formulario público.
  persona_id     uuid REFERENCES nucleo.personas(id) ON DELETE RESTRICT,
  -- Lo que la persona escribió de su puño. Es la materia prima del
  -- emparejamiento y se guarda aunque ya se haya emparejado, porque es
  -- la evidencia de lo que dijo.
  pagador_nombre    text,
  pagador_correo    text,
  pagador_documento text,
  pagador_telefono  text,

  tipo    aportes.tipo_aporte NOT NULL,
  fondo_id uuid NOT NULL REFERENCES aportes.fondos(id),
  monto   numeric(15,2) NOT NULL CHECK (monto > 0),
  moneda  char(3) NOT NULL DEFAULT 'COP',
  medio   aportes.medio_pago,               -- se sabe cuando la pasarela contesta

  estado  aportes.estado_pasarela NOT NULL DEFAULT 'iniciada',
  motivo_rechazo text,

  -- El aporte contable que nació de esta transacción. SOLO si se aprobó.
  aporte_id uuid REFERENCES aportes.aportes(id) ON DELETE RESTRICT,

  creada_en      timestamptz NOT NULL DEFAULT now(),
  actualizada_en timestamptz NOT NULL DEFAULT now(),
  confirmada_en  timestamptz,

  CONSTRAINT trx_pasarela_uq UNIQUE (pasarela, transaccion_id),
  /* ⛔ Un aporte contable SOLO puede colgar de una transacción aprobada.
     Sin esto, un error de código contabilizaría un pago rechazado. */
  CONSTRAINT trx_aporte_solo_si_aprobada
    CHECK (aporte_id IS NULL OR estado = 'aprobada'),
  CONSTRAINT trx_rechazo_con_motivo
    CHECK (estado <> 'rechazada' OR motivo_rechazo IS NOT NULL),
  CONSTRAINT trx_confirmada_coherente
    CHECK ((confirmada_en IS NOT NULL) = (estado IN ('aprobada','rechazada','expirada','reversada')))
);
CREATE INDEX trx_estado_idx   ON aportes.pasarela_transacciones (estado, creada_en DESC);
CREATE INDEX trx_sede_idx     ON aportes.pasarela_transacciones (sede_id, creada_en DESC);
CREATE INDEX trx_persona_idx  ON aportes.pasarela_transacciones (persona_id) WHERE persona_id IS NOT NULL;
-- La cola de emparejamiento: aprobadas y todavía sin dueño.
CREATE INDEX trx_sin_dueno_idx ON aportes.pasarela_transacciones (creada_en)
  WHERE persona_id IS NULL AND estado = 'aprobada';

COMMENT ON TABLE aportes.pasarela_transacciones IS
  'El INTENTO de pago. El aporte contable solo nace cuando esto llega a aprobada.';

-- ---------------------------------------------------------------------
-- 2 · EL BUZÓN DE AVISOS · crudo, íntegro y sin borrar
-- ---------------------------------------------------------------------
CREATE TABLE aportes.pasarela_eventos (
  id           bigserial PRIMARY KEY,
  pasarela     text NOT NULL DEFAULT 'payu',
  referencia   text,
  transaccion_id text,
  estado_reportado text,
  -- ⛔ El cuerpo tal como llegó. Si mañana hay una disputa con la
  --    pasarela, esto es la prueba. No se normaliza ni se resume.
  cuerpo       jsonb NOT NULL,
  firma_recibida text,
  firma_valida boolean NOT NULL DEFAULT false,
  -- Huella del aviso: el MISMO aviso reenviado no entra dos veces.
  huella       text NOT NULL,
  recibido_en  timestamptz NOT NULL DEFAULT now(),
  procesado_en timestamptz,
  error        text,
  CONSTRAINT evento_huella_uq UNIQUE (pasarela, huella)
);
CREATE INDEX evento_sin_procesar_idx ON aportes.pasarela_eventos (recibido_en)
  WHERE procesado_en IS NULL;
CREATE RULE eventos_no_delete AS ON DELETE TO aportes.pasarela_eventos DO INSTEAD NOTHING;

COMMENT ON TABLE aportes.pasarela_eventos IS
  'Buzón de webhooks. Solo se agrega. La huella única hace idempotente el reintento de la pasarela.';

-- ---------------------------------------------------------------------
-- 3 · EL DESEMBOLSO · lo que de verdad llega al banco
-- ---------------------------------------------------------------------
CREATE TABLE aportes.desembolsos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pasarela      text NOT NULL DEFAULT 'payu',
  fecha         date NOT NULL,
  monto_bruto   numeric(15,2) NOT NULL CHECK (monto_bruto >= 0),
  comision      numeric(15,2) NOT NULL DEFAULT 0 CHECK (comision >= 0),
  iva_comision  numeric(15,2) NOT NULL DEFAULT 0 CHECK (iva_comision >= 0),
  retenciones   numeric(15,2) NOT NULL DEFAULT 0 CHECK (retenciones >= 0),
  monto_neto    numeric(15,2) NOT NULL CHECK (monto_neto >= 0),
  moneda        char(3) NOT NULL DEFAULT 'COP',
  referencia_banco text,
  conciliado_en timestamptz,
  conciliado_por uuid REFERENCES nucleo.personas(id),
  /* ⛔ La aritmética la comprueba la BASE, no una hoja de cálculo.
     Mismo criterio del cierre de control de la 0016: en aportes, cuadrar
     no es un informe, es una restricción. */
  CONSTRAINT desembolso_cuadra
    CHECK (monto_neto = monto_bruto - comision - iva_comision - retenciones)
);

CREATE TABLE aportes.desembolso_items (
  desembolso_id  uuid NOT NULL REFERENCES aportes.desembolsos(id) ON DELETE RESTRICT,
  transaccion_id uuid NOT NULL REFERENCES aportes.pasarela_transacciones(id) ON DELETE RESTRICT,
  monto_bruto    numeric(15,2) NOT NULL CHECK (monto_bruto > 0),
  comision       numeric(15,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (desembolso_id, transaccion_id)
);

-- ---------------------------------------------------------------------
-- 4 · EMPAREJAR AL PAGADOR CON SU FICHA
--     Determinista y por orden de fuerza: documento, luego correo. El
--     nombre NO empareja solo: hay muchas Marías González, y atribuirle
--     el diezmo a la persona equivocada es peor que dejarlo sin dueño.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION aportes.emparejar_pagador(p_trx uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = aportes, nucleo, pg_temp AS $$
DECLARE t aportes.pasarela_transacciones; v_persona uuid;
BEGIN
  SELECT * INTO t FROM aportes.pasarela_transacciones WHERE id = p_trx;
  IF NOT FOUND OR t.persona_id IS NOT NULL THEN RETURN t.persona_id; END IF;

  -- 1 · por documento, que es la llave fuerte
  IF t.pagador_documento IS NOT NULL AND length(trim(t.pagador_documento)) > 3 THEN
    SELECT id INTO v_persona FROM nucleo.personas
     WHERE numero_documento = regexp_replace(t.pagador_documento, '[^0-9A-Za-z]', '', 'g')
       AND eliminado_en IS NULL
     LIMIT 1;
  END IF;

  -- 2 · por correo
  IF v_persona IS NULL AND t.pagador_correo IS NOT NULL THEN
    SELECT id INTO v_persona FROM nucleo.personas
     WHERE lower(email_principal) = lower(trim(t.pagador_correo))
       AND eliminado_en IS NULL
     LIMIT 1;
  END IF;

  IF v_persona IS NOT NULL THEN
    UPDATE aportes.pasarela_transacciones
       SET persona_id = v_persona, actualizada_en = now()
     WHERE id = p_trx;
  END IF;
  RETURN v_persona;
END
$$;

-- ---------------------------------------------------------------------
-- 5 · PROMOVER UN PAGO APROBADO A APORTE CONTABLE
--     Único camino por el que un pago en línea se convierte en dinero
--     registrado. Idempotente: si ya existe, no duplica.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION aportes.confirmar_pago(p_trx uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = aportes, nucleo, pg_temp AS $$
DECLARE t aportes.pasarela_transacciones; v_aporte uuid; v_persona uuid;
BEGIN
  SELECT * INTO t FROM aportes.pasarela_transacciones WHERE id = p_trx;
  IF NOT FOUND THEN RAISE EXCEPTION 'No existe la transacción %', p_trx; END IF;
  IF t.estado <> 'aprobada' THEN
    RAISE EXCEPTION 'La transacción % está en % y solo se contabiliza lo aprobado', p_trx, t.estado
      USING HINT = 'Un pago pendiente o rechazado no es dinero que entró.';
  END IF;
  IF t.aporte_id IS NOT NULL THEN RETURN t.aporte_id; END IF;

  v_persona := aportes.emparejar_pagador(p_trx);
  /* ⛔ Sin dueño NO se contabiliza a nombre de nadie ni se inventa un
     anónimo: se deja en la cola de emparejamiento. Un diezmo mal
     atribuido es peor que uno sin atribuir, porque el certificado
     tributario saldría a nombre equivocado. */
  IF v_persona IS NULL THEN RETURN NULL; END IF;

  INSERT INTO aportes.aportes
    (sede_id, persona_id, es_anonimo, fondo_id, tipo, monto, moneda, medio,
     fecha, referencia, estado, fuente, source_system, source_id)
  VALUES
    (t.sede_id, v_persona, false, t.fondo_id, t.tipo, t.monto, t.moneda,
     coalesce(t.medio, 'tarjeta'), coalesce(t.confirmada_en, now())::date,
     t.referencia, 'confirmado', 'pasarela', t.pasarela, t.transaccion_id)
  /* ⛔ EL PREDICADO ES OBLIGATORIO. `aportes_linaje_uq` es un índice
     único PARCIAL (WHERE source_system IS NOT NULL), y ON CONFLICT no lo
     reconoce si no se repite la condición: falla con «there is no unique
     or exclusion constraint matching». Lo descubrí probándolo, no
     leyéndolo: sin el predicado, confirmar un pago reventaba entero. */
  ON CONFLICT (source_system, source_id) WHERE source_system IS NOT NULL DO NOTHING
  RETURNING id INTO v_aporte;

  IF v_aporte IS NULL THEN          -- ya existía: la idempotencia de la 0016
    SELECT id INTO v_aporte FROM aportes.aportes
     WHERE source_system = t.pasarela AND source_id = t.transaccion_id;
  END IF;

  UPDATE aportes.pasarela_transacciones
     SET aporte_id = v_aporte, actualizada_en = now() WHERE id = p_trx;
  RETURN v_aporte;
END
$$;

-- ---------------------------------------------------------------------
-- 6 · LO QUE HAY QUE MIRAR CADA DÍA
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW aportes.v_pagos_sin_dueno
WITH (security_invoker = true) AS
SELECT t.id, t.sede_id, t.referencia, t.monto, t.moneda, t.tipo,
       t.pagador_nombre, t.pagador_correo, t.pagador_documento,
       t.confirmada_en
FROM aportes.pasarela_transacciones t
WHERE t.estado = 'aprobada' AND t.persona_id IS NULL;

COMMENT ON VIEW aportes.v_pagos_sin_dueno IS
  'Dinero que entró y todavía no tiene ficha. Se mira todos los días: cada fila es una persona que dio y a la que el sistema aún no sabe agradecer.';

CREATE OR REPLACE VIEW aportes.v_avisos_sin_procesar
WITH (security_invoker = true) AS
SELECT id, pasarela, referencia, transaccion_id, estado_reportado,
       firma_valida, recibido_en, error
FROM aportes.pasarela_eventos
WHERE procesado_en IS NULL;

-- ---------------------------------------------------------------------
-- 7 · PERMISOS Y AISLAMIENTO · N3, como todo el esquema de aportes
-- ---------------------------------------------------------------------
ALTER TABLE aportes.pasarela_transacciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE aportes.pasarela_transacciones FORCE ROW LEVEL SECURITY;
CREATE POLICY trx_por_sede ON aportes.pasarela_transacciones FOR ALL
  USING (plataforma.sede_visible(sede_id) AND plataforma.ctx_nivel_max() >= 3)
  WITH CHECK (plataforma.sede_visible(sede_id) AND plataforma.ctx_nivel_max() >= 3);

/* El buzón de avisos NO lleva sede: llega antes de saber de quién es.
   Lo lee el proceso que concilia, no las sedes. */
ALTER TABLE aportes.pasarela_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY eventos_solo_n3 ON aportes.pasarela_eventos FOR ALL
  USING (plataforma.ctx_nivel_max() >= 3)
  WITH CHECK (plataforma.ctx_nivel_max() >= 3);

ALTER TABLE aportes.desembolsos ENABLE ROW LEVEL SECURITY;
CREATE POLICY desembolsos_solo_n3 ON aportes.desembolsos FOR ALL
  USING (plataforma.ctx_nivel_max() >= 3)
  WITH CHECK (plataforma.ctx_nivel_max() >= 3);

ALTER TABLE aportes.desembolso_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY desembolso_items_solo_n3 ON aportes.desembolso_items FOR ALL
  USING (plataforma.ctx_nivel_max() >= 3)
  WITH CHECK (plataforma.ctx_nivel_max() >= 3);

GRANT SELECT, INSERT, UPDATE ON aportes.pasarela_transacciones TO casaroca_app;
GRANT SELECT, INSERT, UPDATE ON aportes.pasarela_eventos TO casaroca_app;
GRANT USAGE, SELECT ON SEQUENCE aportes.pasarela_eventos_id_seq TO casaroca_app;
GRANT SELECT, INSERT, UPDATE ON aportes.desembolsos TO casaroca_app;
GRANT SELECT, INSERT, UPDATE ON aportes.desembolso_items TO casaroca_app;
GRANT SELECT ON aportes.v_pagos_sin_dueno, aportes.v_avisos_sin_procesar TO casaroca_app;
