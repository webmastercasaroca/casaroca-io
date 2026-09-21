-- =====================================================================
-- Migración 0019 — EL RASTRO DE LOS INTENTOS DE RETIRO
--
-- Origen: la prueba M9 del banco de módulos. Detectó que los intentos
-- fallidos de retirar a un menor NO quedaban registrados.
--
-- La causa es de manual, y merece quedar escrita porque se repite en
-- todo sistema de auditoría:
--
--   `entregar_menor` registraba el intento y acto seguido hacía
--   RAISE EXCEPTION. La excepción revierte la transacción — y con ella,
--   el registro que se acababa de escribir. El rastro se borraba solo.
--
-- El arreglo NO es un truco de transacción autónoma. Es reconocer que
-- un código equivocado NO ES UN ERROR DEL SISTEMA: es un resultado
-- previsible del negocio, y los resultados se devuelven, no se lanzan.
-- Ahora la función devuelve un estado, el intento queda escrito, y la
-- transacción confirma. La garantía de seguridad no cambia: sin las
-- tres condiciones, la salida no se escribe.
-- =====================================================================

CREATE TABLE rocakids.intentos_entrega (
  id            bigserial PRIMARY KEY,
  checkin_id    uuid NOT NULL REFERENCES rocakids.checkins(id),
  menor_id      uuid NOT NULL REFERENCES nucleo.personas(id),
  intentado_por uuid REFERENCES nucleo.personas(id),
  atendido_por  uuid REFERENCES nucleo.personas(id),
  resultado     text NOT NULL CHECK (resultado IN
                  ('entregado','no_autorizado','codigo_incorrecto','ya_entregado')),
  ocurrido_en   timestamptz NOT NULL DEFAULT now(),
  actor_ip      inet
);
CREATE INDEX intentos_checkin_idx ON rocakids.intentos_entrega (checkin_id, ocurrido_en DESC);
CREATE INDEX intentos_fallidos_idx ON rocakids.intentos_entrega (menor_id, ocurrido_en DESC)
  WHERE resultado <> 'entregado';

CREATE RULE intentos_no_update AS ON UPDATE TO rocakids.intentos_entrega DO INSTEAD NOTHING;
CREATE RULE intentos_no_delete AS ON DELETE TO rocakids.intentos_entrega DO INSTEAD NOTHING;

COMMENT ON TABLE rocakids.intentos_entrega IS
  'Todo intento de retirar a un menor, haya salido bien o mal. Dos fallos seguidos sobre el mismo niño es información que alguien debe ver el mismo domingo, no en la auditoría anual.';

DROP FUNCTION IF EXISTS rocakids.entregar_menor(uuid,uuid,text,uuid,boolean);
DROP FUNCTION IF EXISTS rocakids.entregar_menor(uuid,uuid,text,uuid);

-- ---------------------------------------------------------------------
-- Devuelve el resultado. No lanza excepción por un código equivocado.
-- Sí la lanza cuando falta la llave o no existe el ingreso: eso sí es
-- un fallo del sistema, no una decisión del negocio.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rocakids.entregar_menor(
  p_checkin_id   uuid,
  p_retirado_por uuid,
  p_codigo       text,
  p_maestro_id   uuid
) RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_menor uuid; v_cifrado bytea; v_salida timestamptz;
  v_llave text := plataforma.llave_n4();
  v_resultado text;
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
    v_resultado := 'ya_entregado';
  ELSIF NOT EXISTS (
    SELECT 1 FROM nucleo.acudientes a
    WHERE a.menor_id = v_menor AND a.acudiente_id = p_retirado_por
      AND a.autoriza_retiro
      AND a.vigente_desde <= CURRENT_DATE
      AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)
  ) THEN
    v_resultado := 'no_autorizado';
  ELSIF pgp_sym_decrypt(v_cifrado, v_llave) <> p_codigo THEN
    v_resultado := 'codigo_incorrecto';
  ELSE
    PERFORM set_config('app.entrega_verificada','si', true);
    UPDATE rocakids.checkins
       SET salida_en = now(), retirado_por = p_retirado_por, autorizado_por = p_maestro_id
     WHERE id = p_checkin_id;
    PERFORM set_config('app.entrega_verificada','', true);
    v_resultado := 'entregado';
  END IF;

  -- Se escribe SIEMPRE, y sobrevive porque no hay excepción que revierta.
  INSERT INTO rocakids.intentos_entrega
    (checkin_id, menor_id, intentado_por, atendido_por, resultado, actor_ip)
  VALUES (p_checkin_id, v_menor, p_retirado_por, p_maestro_id, v_resultado,
          NULLIF(current_setting('app.ip', true),'')::inet);

  PERFORM plataforma.registrar_lectura('rocakids','checkins',p_checkin_id::text,4::smallint,
          'Intento de entrega de menor · resultado: '||v_resultado);

  RETURN v_resultado;
END
$$;

COMMENT ON FUNCTION rocakids.entregar_menor IS
  'Devuelve: entregado · no_autorizado · codigo_incorrecto · ya_entregado. La aplicación debe mostrar el mensaje adecuado; la base ya dejó el rastro.';

-- La señal que el ministerio necesita ver el mismo domingo.
CREATE OR REPLACE VIEW rocakids.v_alertas_entrega AS
SELECT i.menor_id, i.checkin_id,
       count(*) FILTER (WHERE i.resultado <> 'entregado') AS intentos_fallidos,
       max(i.ocurrido_en) AS ultimo_intento,
       array_agg(DISTINCT i.resultado) AS resultados
FROM rocakids.intentos_entrega i
WHERE i.ocurrido_en > now() - interval '1 day'
GROUP BY i.menor_id, i.checkin_id
HAVING count(*) FILTER (WHERE i.resultado <> 'entregado') >= 2;

COMMENT ON VIEW rocakids.v_alertas_entrega IS
  'Dos o más intentos fallidos sobre el mismo niño en el día. No acusa a nadie: pide que un adulto se acerque a mirar.';

GRANT SELECT, INSERT ON rocakids.intentos_entrega TO casaroca_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA rocakids TO casaroca_app;
