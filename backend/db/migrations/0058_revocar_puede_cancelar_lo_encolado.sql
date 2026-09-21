-- =====================================================================
-- 0058 · REVOCAR TIENE QUE PODER CANCELAR LO YA ENCOLADO
--
-- ⛔ Encontrado el 20 de septiembre de 2026 al darle por fin una PUERTA a
--    los derechos del titular (hasta hoy la Ley 1581 estaba implementada
--    en la base y era inalcanzable salvo con psql).
--
--    `plataforma.revocar_consentimiento` hace dos cosas: anota la
--    revocación y descarta lo que ya estaba en la cola de envío. Lo
--    segundo es lo que de verdad protege al titular: entre encolar y
--    enviar pasan días, y sin eso se revoca y el correo sale igual.
--
--    Pero la función era SECURITY INVOKER y la aplicación solo tiene
--    SELECT sobre `plataforma.notificaciones` (quien encola es la base,
--    con una función privilegiada). Resultado: **revocar desde la API
--    fallaba entero con «no tiene permiso»**. La revocación no se
--    registraba y lo encolado salía.
--
--    Se hace SECURITY DEFINER, que es lo que ya son las funciones que
--    escriben en esa cola. Y como al hacerlo deja de aplicarse la política
--    de la sesión, se añade DENTRO la comprobación que antes hacía el RLS:
--    no se revoca por una persona que la sesión no alcanza.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION plataforma.revocar_consentimiento(
  p_persona uuid,
  p_canal plataforma.canal_contacto DEFAULT NULL,
  p_finalidad text DEFAULT NULL,
  p_evidencia text DEFAULT 'solicitud del titular')
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = plataforma, nucleo, pg_temp AS $$
DECLARE v_sede uuid; v_n int := 0;
BEGIN
  SELECT sede_id INTO v_sede FROM nucleo.personas WHERE id = p_persona;
  IF v_sede IS NULL THEN
    RAISE EXCEPTION 'No se encuentra a esa persona' USING ERRCODE='no_data_found';
  END IF;

  -- ⛔ La comprobación que antes hacía el RLS y que SECURITY DEFINER se
  --    salta. Sin esto, conocer un identificador bastaría para revocarle
  --    los consentimientos a alguien de otra sede: un sabotaje silencioso
  --    (la persona deja de recibir convocatorias y nadie sabe por qué).
  -- ⛔ Excepcion UNICA y explicita: `ejecutar_supresion` revoca todo como
  --    parte de la supresion, y esa la autoriza la peticion del titular, no
  --    el alcance de quien la ejecuta. La bandera la pone esa funcion y
  --    muere con la transaccion.
  IF COALESCE(current_setting('app.supresion_en_curso', true),'') <> 'si'
     AND NOT (plataforma.sede_visible(v_sede)
              OR EXISTS (SELECT 1 FROM nucleo.membresias_sede m
                          WHERE m.persona_id = p_persona
                            AND plataforma.sede_visible(m.sede_id))) THEN
    RAISE EXCEPTION 'Esa persona no está en su alcance' USING ERRCODE='insufficient_privilege';
  END IF;

  INSERT INTO plataforma.consentimientos
    (persona_id, sede_id, finalidad, canal, acto, ocurrido_en, evidencia_tipo, evidencia_ref)
  SELECT p_persona, v_sede, f.codigo, c.canal, 'revocado', now(), 'verbal_registrado', p_evidencia
  FROM plataforma.finalidades f
  CROSS JOIN (SELECT unnest(enum_range(NULL::plataforma.canal_contacto)) AS canal) c
  WHERE (p_finalidad IS NULL OR f.codigo = p_finalidad)
    AND (p_canal IS NULL OR c.canal = p_canal)
    -- ⛔ Solo se revoca lo que se apoya EN EL CONSENTIMIENTO. Lo que se
    --    apoya en contrato o en obligación legal no es revocable, y decir
    --    que se revocó sería mentirle al titular sobre su propio derecho.
    AND f.base_legal = 'consentimiento'
    -- Revocar lo ya revocado es ruido.
    AND plataforma.puede_contactar(p_persona, c.canal, f.codigo);
  GET DIAGNOSTICS v_n = ROW_COUNT;

  -- ⭐ Y lo ya encolado se descarta. Entre encolar y enviar pasan dias, y
  --    el auditor reprodujo el caso: se revocaba y el correo salia igual.
  UPDATE plataforma.notificaciones
     SET estado = 'descartada',
         ultimo_error = 'Consentimiento revocado por el titular antes del envio'
   WHERE persona_id = p_persona AND estado = 'pendiente'
     AND (p_canal IS NULL OR canal = p_canal)
     -- Un recibo o un certificado que la persona pidió NO se cancela por
     -- revocar el permiso de convocatoria: son cosas distintas.
     AND finalidad IN (SELECT codigo FROM plataforma.finalidades
                        WHERE base_legal = 'consentimiento');

  RETURN v_n;
END $$;

COMMENT ON FUNCTION plataforma.revocar_consentimiento IS
  'Revoca lo revocable (base legal = consentimiento) y descarta lo encolado '
  'de esas finalidades. SECURITY DEFINER porque tiene que tocar la cola de '
  'envio; comprueba el alcance de la sesion por dentro.';

-- La supresion levanta la bandera: el resto del cuerpo es el de la
-- migracion 0053, sin tocar.
CREATE OR REPLACE FUNCTION plataforma.ejecutar_supresion(p_peticion uuid, p_quien uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql AS $fn$DECLARE
  v_persona uuid; v_tipo text; v_estado text; v_res jsonb := '{}'::jsonb; v_n int;
BEGIN
  -- ⛔ 20 sep 2026 · La supresion revoca TODO como parte de su trabajo, y
  --    `revocar_consentimiento` pasa a comprobar el alcance de la sesion
  --    (migracion 0058). Esta supresion no la autoriza el alcance de quien
  --    la ejecuta: la autoriza la peticion del titular. La bandera lo dice
  --    y muere con la transaccion.
  PERFORM set_config('app.supresion_en_curso','si',true);
  SELECT titular_id, tipo, estado INTO v_persona, v_tipo, v_estado
  FROM plataforma.peticiones_titular WHERE id = p_peticion;

  IF v_persona IS NULL THEN
    RAISE EXCEPTION 'La peticion no existe o no esta ligada a una persona del sistema'
      USING ERRCODE='no_data_found';
  END IF;
  IF v_tipo <> 'supresion' THEN
    RAISE EXCEPTION 'Esa peticion es de tipo «%», no de supresion', v_tipo USING ERRCODE='check_violation';
  END IF;
  IF v_estado = 'atendida' THEN
    RAISE EXCEPTION 'Esa peticion ya fue atendida' USING ERRCODE='check_violation';
  END IF;

  -- 5.a · Lo que se BORRA: lo que existe solo por el vinculo pastoral.
  DELETE FROM crm.notas_privadas_nuevos WHERE nuevo_id IN
    (SELECT id FROM crm.nuevos_registros WHERE persona_id = v_persona);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_res := v_res || jsonb_build_object('notas_privadas_borradas', v_n);

  DELETE FROM consejeria.notas WHERE caso_id IN
    (SELECT id FROM consejeria.casos WHERE consultante_id = v_persona);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_res := v_res || jsonb_build_object('notas_consejeria_borradas', v_n);

  DELETE FROM rocakids.condiciones_medicas WHERE menor_id = v_persona;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_res := v_res || jsonb_build_object('condiciones_medicas_borradas', v_n);

  DELETE FROM nucleo.persona_atributos WHERE persona_id = v_persona;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_res := v_res || jsonb_build_object('casillas_borradas', v_n);

  -- 5.b · Lo que se ANONIMIZA: la persona deja de ser identificable y el
  --       identificador sobrevive como clave tecnica, porque de el cuelgan
  --       obligaciones contables que la ley EXIGE conservar.
  PERFORM set_config('app.traslado_en_curso','si',true);
  UPDATE nucleo.personas SET
      primer_nombre    = 'Titular',
      segundo_nombre   = NULL,
      primer_apellido  = 'suprimido',
      segundo_apellido = NULL,
      nombre_corto     = NULL,
      email_principal  = NULL, email_secundario = NULL,
      telefono_movil   = NULL, telefono_fijo = NULL, telefono_emergencia = NULL,
      numero_documento = NULL, tipo_documento = NULL,
      direccion        = NULL, foto_url = NULL,
      fecha_nacimiento = NULL,
      es_cristiano     = NULL, fecha_conversion = NULL, fecha_bautismo = NULL,
      ha_sido_bautizado = NULL, iglesia_anterior = NULL,
      source_payload   = NULL,
      estado           = 'inactiva',
      eliminado_en     = now()
   WHERE id = v_persona;
  PERFORM set_config('app.traslado_en_curso','no',true);
  v_res := v_res || jsonb_build_object('persona_anonimizada', true);

  -- 5.c · Lo que se CONSERVA, y por que. Se dice en la respuesta al
  --       titular, que es lo que exige el Decreto 1377 art. 22.
  SELECT count(*) INTO v_n FROM aportes.aportes WHERE persona_id = v_persona;
  v_res := v_res || jsonb_build_object(
    'aportes_conservados', v_n,
    'base_legal_conservacion',
      'Obligacion contable y tributaria: los soportes se conservan diez anos (Codigo de Comercio art. 28). Quedan desligados de la identidad.');

  -- 5.d · El consentimiento NO se borra: es la prueba legal del acto.
  v_res := v_res || jsonb_build_object('consentimientos_conservados',
    'Los registros de consentimiento y revocacion se conservan como prueba del acto (Ley 1581 art. 9).');

  -- 5.e · Se cortan los accesos y los envios.
  PERFORM plataforma.revocar_consentimiento(v_persona, NULL, NULL, 'supresion solicitada por el titular');
  PERFORM identidad.suspender_cuenta(v_persona, 'Supresion solicitada por el titular');

  UPDATE plataforma.peticiones_titular
     SET estado = 'atendida', respondida_en = now(),
         respuesta = 'Supresion ejecutada. '||v_res::text,
         responsable_id = COALESCE(responsable_id, p_quien)
   WHERE id = p_peticion;

  RETURN v_res;
END
$fn$;

COMMIT;
