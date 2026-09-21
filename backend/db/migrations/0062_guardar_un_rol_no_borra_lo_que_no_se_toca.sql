-- =====================================================================
-- 0062 · GUARDAR UN ROL NO BORRA LO QUE NADIE TOCÓ
--
-- ⛔ QUÉ SE ROMPIÓ. El banco de conectores del 20 de septiembre de 2026
--    guardó un rol sin mandar la descripción y la API respondió «Falta
--    un dato obligatorio». `identidad.roles.descripcion` es NOT NULL y
--    `guardar_rol` metía NULL sin mirar lo que ya había: cualquier
--    cambio parcial (subir el techo, descontinuarlo) reventaba, y el
--    operador recibía una frase que no le decía QUÉ dato faltaba.
--
--    Peor todavía era `activo`. La API mandaba `true` cuando el que
--    llamaba no decía nada, así que editar el nombre de un rol
--    DESCONTINUADO lo volvía a poner en circulación en silencio. Un rol
--    resucitado sin que nadie lo pidiera es un hallazgo de auditoría de
--    accesos, no una molestia.
--
--    La regla correcta es la de siempre en una actualización parcial: lo
--    que no se manda NO SE TOCA. Y la regla vive en la función, que es
--    donde no se puede olvidar según por dónde entre la llamada.
-- =====================================================================
BEGIN;

CREATE OR REPLACE FUNCTION identidad.guardar_rol(
  p_codigo          text,
  p_nombre          text,
  p_alcance_maximo  text,
  p_nivel_maximo    smallint,
  p_descripcion     text    DEFAULT NULL,
  p_activo          boolean DEFAULT NULL       -- ⛔ NULL = «no lo toque»
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = identidad, sistema, plataforma, public, pg_temp AS $$
DECLARE
  v_bajando boolean; v_afectados int;
  v_existe  identidad.roles%ROWTYPE;
  v_desc    text; v_activo boolean;
BEGIN
  PERFORM identidad.exigir_admin_de(NULL);
  IF NOT plataforma.ctx_es_global() THEN
    RAISE EXCEPTION 'Cambiar un rol afecta a toda la red: exige alcance de organización'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_existe FROM identidad.roles r WHERE r.codigo = p_codigo;

  /* Lo que no se manda, se conserva. En un rol NUEVO no hay qué
     conservar, así que la descripción sí es obligatoria: un rol sin
     decir para qué sirve es justo lo que una auditoría de accesos
     marca como «permiso huérfano». */
  v_desc := COALESCE(NULLIF(btrim(p_descripcion), ''), v_existe.descripcion);
  IF v_desc IS NULL OR length(v_desc) < 10 THEN
    RAISE EXCEPTION 'Escriba para qué sirve el rol «%»: al menos diez caracteres. Un rol sin propósito escrito no se puede auditar.', p_codigo
      USING ERRCODE = '23514';
  END IF;
  v_activo := COALESCE(p_activo, v_existe.activo, true);

  SELECT (v_existe.nivel_maximo > p_nivel_maximo) INTO v_bajando;

  INSERT INTO identidad.roles (codigo, nombre, alcance_maximo, nivel_maximo, descripcion, activo)
  VALUES (p_codigo, p_nombre, p_alcance_maximo::identidad.tipo_alcance,
          p_nivel_maximo, v_desc, v_activo)
  ON CONFLICT (codigo) DO UPDATE
    SET nombre = EXCLUDED.nombre, alcance_maximo = EXCLUDED.alcance_maximo,
        nivel_maximo = EXCLUDED.nivel_maximo, descripcion = EXCLUDED.descripcion,
        activo = EXCLUDED.activo;

  /* Bajar el techo deja fuera de alcance a todo el que tenga el rol.
     Se cuenta a cuántos y se deja escrito, en vez de hacerlo callado. */
  IF COALESCE(v_bajando, false) THEN
    SELECT count(*) INTO v_afectados FROM identidad.asignaciones a
     WHERE a.rol = p_codigo AND a.revocada_en IS NULL AND a.nivel_max > p_nivel_maximo;
    INSERT INTO plataforma.bitacora_mantenimiento (tarea, objeto, detalle)
    VALUES ('techo_de_rol_bajado', p_codigo,
            jsonb_build_object('nuevo_techo', p_nivel_maximo,
                               'asignaciones_por_encima', v_afectados,
                               'quien', plataforma.ctx_persona_id()));
  END IF;

  /* Descontinuar un rol tampoco es cosmético: nadie puede volver a
     otorgarlo. Queda escrito con cuántas personas lo tienen puesto,
     porque esas SIGUEN teniéndolo hasta que se les revoque. */
  IF v_existe.codigo IS NOT NULL AND v_existe.activo AND NOT v_activo THEN
    SELECT count(*) INTO v_afectados FROM identidad.asignaciones a
     WHERE a.rol = p_codigo AND a.vigente_hasta IS NULL;
    INSERT INTO plataforma.bitacora_mantenimiento (tarea, objeto, detalle)
    VALUES ('rol_descontinuado', p_codigo,
            jsonb_build_object('personas_que_lo_tienen_puesto', v_afectados,
                               'quien', plataforma.ctx_persona_id()));
  END IF;

  RETURN p_codigo;
END $$;

COMMIT;
