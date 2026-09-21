-- =====================================================================
-- 0067 · EL DOMINGO SE PUEDE OPERAR
--
-- ⛔ QUÉ ESTABA ROTO. El auditor de la pantalla «Niños» lo dijo en una
--    línea: «Por la aplicación, hoy, no se puede registrar la entrada de
--    ningún niño.» Dos 403 encadenados, los dos por permisos del rol de
--    la aplicación, ninguno visible leyendo el código de la pantalla:
--
--    a) «Entrar a servir» usaba `ON CONFLICT ... DO UPDATE`, y PostgreSQL
--       exige UPDATE para esa cláusula aunque no haya conflicto. La 0051
--       se lo revocó a la aplicación a propósito. 403 para todos, también
--       para el Director General. Sin este paso, ninguna sala llega a dos
--       adultos.
--    b) Con menos de dos adultos, recibir a un niño escribiendo el motivo
--       —la anulación que la 0057 creó justo para el domingo— también
--       daba 403: `registrar_checkin` NO es SECURITY DEFINER y escribe en
--       `plataforma.bitacora_mantenimiento`, sobre la que la aplicación
--       no tiene ningún permiso. La misma rama salta al cerrar un ingreso
--       que quedó abierto la semana pasada.
--
-- ⛔ Y UNA TERCERA, de aislamiento: `rocakids.salas` era la ÚNICA tabla
--    del esquema con RLS apagado. Un pastor de Panamá recibía las seis
--    salas de Bogotá Chicó con su ocupación.
-- =====================================================================
BEGIN;

-- ── a · La reentrada, por una puerta con guardia ─────────────────────
--    La aplicación sigue SIN poder reescribir `servidores_sala` a mano.
CREATE OR REPLACE FUNCTION rocakids.volver_a_sala(p_sala uuid, p_persona uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = rocakids, org, plataforma, public, pg_temp AS $$
DECLARE v_sede uuid; v_id uuid; v_salio timestamptz;
BEGIN
  SELECT sa.sede_id INTO v_sede FROM rocakids.salas sa WHERE sa.id = p_sala;
  IF v_sede IS NULL THEN
    RAISE EXCEPTION 'Esa sala no existe.' USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT plataforma.sede_visible(v_sede) THEN
    RAISE EXCEPTION 'Esa sala no está en su alcance.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT id, salio_en INTO v_id, v_salio
    FROM rocakids.servidores_sala
   WHERE sala_id = p_sala AND persona_id = p_persona AND fecha = CURRENT_DATE;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'No hay registro de esa persona en la sala hoy.' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_salio IS NULL THEN
    RETURN jsonb_build_object('id', v_id, 'ya_estaba', true,
      'mensaje', 'Ya estaba registrado sirviendo en esta sala.');
  END IF;

  UPDATE rocakids.servidores_sala SET salio_en = NULL WHERE id = v_id;
  RETURN jsonb_build_object('id', v_id, 'ya_estaba', false,
    'mensaje', 'Volvió a la sala. Queda registrado con la hora.');
END $$;

REVOKE ALL ON FUNCTION rocakids.volver_a_sala(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rocakids.volver_a_sala(uuid, uuid) TO casaroca_app;

-- ── b · `registrar_checkin` corre con los permisos que necesita ──────
--    Es la misma disciplina que ya tienen `entregar_menor` y
--    `roster_de_sala`: la función lleva el guardia DENTRO y por eso puede
--    escribir en la bitácora sin abrirle esa tabla a la aplicación.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS firma
             FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'rocakids' AND p.proname = 'registrar_checkin'
  LOOP
    EXECUTE format('ALTER FUNCTION %s SECURITY DEFINER', r.firma);
    EXECUTE format('ALTER FUNCTION %s SET search_path = rocakids, nucleo, org, crm, plataforma, public, pg_temp', r.firma);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.firma);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO casaroca_app', r.firma);
    RAISE NOTICE 'registrar_checkin: ahora SECURITY DEFINER · %', r.firma;
  END LOOP;
END $$;

-- ── c · Las salas dejan de verse entre sedes ─────────────────────────
ALTER TABLE rocakids.salas ENABLE ROW LEVEL SECURITY;
ALTER TABLE rocakids.salas FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS salas_sel ON rocakids.salas;
CREATE POLICY salas_sel ON rocakids.salas FOR SELECT
  USING (plataforma.sede_visible(sede_id));

COMMENT ON TABLE rocakids.salas IS
  'Salas de RocaKids. ⛔ Era la UNICA tabla del esquema sin RLS: un pastor de otra sede recibia las salas ajenas con su ocupacion (auditoria del 20 sep 2026).';

COMMIT;
