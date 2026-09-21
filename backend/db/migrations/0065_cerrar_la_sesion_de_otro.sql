-- =====================================================================
-- 0065 · CERRAR LA SESIÓN DE OTRO, CON GUARDIA
--
-- ⛔ La pantalla «Sesiones y alertas» de la consola es lo primero que
--    mira un auditor de accesos, y era de SOLO LECTURA: se veía quién
--    estaba dentro y no había forma de echarlo. Si alguien pierde el
--    teléfono un domingo, la única salida era entrar a la base a mano.
--
-- ⛔ `identidad.cerrar_sesion(jti, motivo)` ya existía y es SECURITY
--    DEFINER, pero NO comprueba quién llama: existe para que una persona
--    cierre LA SUYA desde `/auth/salir`. Exponerla tal cual desde la
--    consola habría significado que cualquier sesión puede cerrar la de
--    cualquiera con solo conocer su identificador. Por eso se añade una
--    puerta aparte, con el mismo guardia que el resto de la
--    administración, en vez de abrir la que ya hay.
-- =====================================================================
BEGIN;

CREATE OR REPLACE FUNCTION identidad.cerrar_sesion_de_otro(
  p_sesion uuid,
  p_motivo text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = identidad, nucleo, plataforma, public, pg_temp AS $$
DECLARE
  v_s      identidad.sesiones%ROWTYPE;
  v_persona uuid;
  v_quien  uuid := plataforma.ctx_persona_id();
BEGIN
  IF p_motivo IS NULL OR length(btrim(p_motivo)) < 5 THEN
    RAISE EXCEPTION 'Cerrarle la sesión a otra persona exige un motivo escrito: queda en la auditoría.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_s FROM identidad.sesiones WHERE id = p_sesion;
  IF v_s.id IS NULL THEN
    RAISE EXCEPTION 'No existe esa sesión.' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_s.revocada_en IS NOT NULL THEN
    RAISE EXCEPTION 'Esa sesión ya estaba cerrada.' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT c.persona_id INTO v_persona FROM identidad.cuentas c WHERE c.id = v_s.cuenta_id;
  PERFORM identidad.exigir_admin_de(v_persona);

  UPDATE identidad.sesiones
     SET revocada_en = now(),
         motivo_revocacion = 'Cerrada por la administración: ' || btrim(p_motivo)
   WHERE id = p_sesion;

  RETURN jsonb_build_object('sesion', p_sesion, 'persona_id', v_persona,
                            'cerrada_por', v_quien, 'motivo', btrim(p_motivo));
END $$;

REVOKE ALL ON FUNCTION identidad.cerrar_sesion_de_otro(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identidad.cerrar_sesion_de_otro(uuid, text) TO casaroca_app;

COMMIT;
