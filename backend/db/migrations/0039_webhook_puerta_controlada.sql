-- =====================================================================
-- Migración 0039 — EL WEBHOOK ESCRIBE POR UNA PUERTA, NO POR LA VENTANA
--
-- ⛔ EL PROBLEMA, ENCONTRADO AL PROBAR LA API CONTRA LA BASE
--    `pasarela_eventos` lleva RLS de N3 (es dinero). El webhook de PayU
--    corre SIN usuario: lo llama una máquina, no una persona, así que su
--    contexto es público y de nivel 2. Resultado literal:
--      new row violates row-level security policy for table "pasarela_eventos"
--    El webhook no podía escribir ni en su propio buzón.
--
-- ⛔ LA SALIDA FÁCIL ERA LA MALA. Bastaba con bajar la RLS del buzón a
--    nivel 2, y entonces cualquier sesión de nivel 2 podría leer los
--    avisos de pago de toda la red. Se arregla el síntoma y se abre un
--    agujero de N3.
--
-- ⭐ LA SALIDA CORRECTA: una PUERTA. Funciones SECURITY DEFINER que son lo
--    único capaz de escribir. La API no necesita privilegios de N3;
--    necesita poder ejecutar estas acciones concretas y nada más. Es el
--    mismo patrón de `confirmar_pago` y de `crm.anotar_hecho`, y es la
--    diferencia entre «dar permiso» y «dar una acción».
--
--    Leer el buzón SIGUE exigiendo N3. Escribir un aviso y leer los
--    avisos de toda la red no son la misma potestad.
-- =====================================================================

CREATE OR REPLACE FUNCTION aportes.registrar_aviso_pasarela(
  p_pasarela   text,
  p_referencia text,
  p_trx_id     text,
  p_estado     text,
  p_cuerpo     jsonb,
  p_firma      text,
  p_valida     boolean,
  p_huella     text
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = aportes, pg_temp AS $$
DECLARE v_id bigint;
BEGIN
  /* El aviso se guarda SIEMPRE, válido o no: si mañana hay una disputa
     con la pasarela, el cuerpo crudo es la prueba. Que la firma no
     cuadre es un dato del aviso, no una razón para perderlo. */
  INSERT INTO aportes.pasarela_eventos
    (pasarela, referencia, transaccion_id, estado_reportado, cuerpo,
     firma_recibida, firma_valida, huella)
  VALUES (coalesce(p_pasarela,'payu'), p_referencia, p_trx_id, p_estado,
          p_cuerpo, p_firma, coalesce(p_valida,false), p_huella)
  ON CONFLICT (pasarela, huella) DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;   -- NULL si era un reenvío del mismo aviso
END
$$;

COMMENT ON FUNCTION aportes.registrar_aviso_pasarela IS
  'Única puerta de escritura del buzón de webhooks. La API la llama sin tener nivel N3: escribir un aviso y poder leer los avisos de toda la red no son la misma potestad.';

/* Cerrar el aviso una vez procesado, por la misma razón. */
CREATE OR REPLACE FUNCTION aportes.cerrar_aviso_pasarela(
  p_id bigint, p_error text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = aportes, pg_temp AS $$
BEGIN
  UPDATE aportes.pasarela_eventos
     SET procesado_en = now(), error = p_error
   WHERE id = p_id;
END
$$;

/* ⛔ Y poner al día la transacción tampoco puede exigir N3 al webhook.
   Esta función solo mueve el ESTADO que reporta la pasarela; no toca
   montos, ni persona, ni crea aportes. Contabilizar sigue siendo
   potestad exclusiva de `confirmar_pago`. */
CREATE OR REPLACE FUNCTION aportes.actualizar_estado_pasarela(
  p_referencia text,
  p_estado     aportes.estado_pasarela,
  p_trx_id     text,
  p_motivo     text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = aportes, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  UPDATE aportes.pasarela_transacciones
     SET estado = p_estado,
         transaccion_id = coalesce(p_trx_id, transaccion_id),
         motivo_rechazo = CASE WHEN p_estado = 'rechazada'
                               THEN coalesce(p_motivo, 'Rechazado por la pasarela') END,
         confirmada_en = now(),
         actualizada_en = now()
   WHERE referencia = p_referencia
  RETURNING id INTO v_id;
  RETURN v_id;
END
$$;

GRANT EXECUTE ON FUNCTION aportes.registrar_aviso_pasarela(text,text,text,text,jsonb,text,boolean,text) TO casaroca_app;
GRANT EXECUTE ON FUNCTION aportes.cerrar_aviso_pasarela(bigint,text) TO casaroca_app;
GRANT EXECUTE ON FUNCTION aportes.actualizar_estado_pasarela(text,aportes.estado_pasarela,text,text) TO casaroca_app;
GRANT EXECUTE ON FUNCTION aportes.confirmar_pago(uuid) TO casaroca_app;
GRANT EXECUTE ON FUNCTION aportes.emparejar_pagador(uuid) TO casaroca_app;
