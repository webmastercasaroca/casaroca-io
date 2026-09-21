-- =====================================================================
-- 0063 · QUITAR UN ROL TIENE QUE FUNCIONAR
--
-- ⛔ QUÉ SE ROMPIÓ. El banco de conectores del 20 de septiembre de 2026
--    revocó un rol y la respuesta fue «No existe esa asignación, o no
--    está a su alcance». La asignación existía y estaba a su alcance.
--
--    La causa: `identidad.asignaciones` tiene RLS encendido y SOLO dos
--    políticas, `asignaciones_sel` (SELECT) y `asignaciones_ins`
--    (INSERT). No hay ninguna para UPDATE. En PostgreSQL, con RLS
--    encendido y sin política que ampare la orden, el UPDATE no toca
--    NINGUNA fila y no da error: devuelve cero. El rol del sistema sí
--    tenía el permiso de UPDATE concedido, así que nada saltaba.
--
--    Resultado: en una plataforma de control de accesos, QUITAR UN
--    ACCESO no funcionaba. Es lo más grave que puede fallar: dar un
--    permiso de más se ve; uno que no se pudo quitar no se ve, porque
--    la pantalla dice que hubo un error y el permiso sigue puesto.
--
--    Aquí NO se abre una política de UPDATE sobre la tabla. Abrirla
--    significaría que cualquier consulta de la aplicación puede cambiar
--    una asignación. Se hace por la única puerta: una función que
--    comprueba por dentro quién llama, exige el motivo por escrito y
--    deja el rastro. La tabla sigue cerrada.
-- =====================================================================
BEGIN;

/* Devolvía void; ahora devuelve lo que se revocó, para que la ruta pueda
   decir QUÉ rol le quitó a QUIÉN en vez de un «listo» a ciegas. */
DROP FUNCTION IF EXISTS identidad.revocar_asignacion(uuid, text, uuid);

CREATE OR REPLACE FUNCTION identidad.revocar_asignacion(
  p_asignacion uuid,
  p_motivo     text,
  p_quien      uuid DEFAULT NULL      -- se ignora: manda la sesión
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = identidad, nucleo, org, plataforma, public, pg_temp AS $$
DECLARE
  v_a      identidad.asignaciones%ROWTYPE;
  v_quien  uuid := plataforma.ctx_persona_id();
  v_quedan int;
BEGIN
  IF p_motivo IS NULL OR length(btrim(p_motivo)) < 5 THEN
    RAISE EXCEPTION 'Revocar un permiso exige un motivo escrito: quedará en la ficha de la persona y en la auditoría.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_a FROM identidad.asignaciones WHERE id = p_asignacion;
  IF v_a.id IS NULL THEN
    RAISE EXCEPTION 'No existe esa asignación.' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_a.revocada_en IS NOT NULL THEN
    RAISE EXCEPTION 'Ese rol ya estaba revocado el %.', v_a.revocada_en::date
      USING ERRCODE = 'no_data_found';
  END IF;

  /* ⛔ La comprobación va DENTRO, no en la ruta: la función es
     SECURITY DEFINER y salta el RLS, así que si el guardia viviera
     fuera bastaría con llamarla por otro camino. */
  PERFORM identidad.exigir_admin_de(v_a.persona_id);

  /* ⛔ Nadie se deja a la red sin quién la administre. Con bus factor 1,
     que el único Director General se revoque su propio rol deja el
     sistema sin nadie que pueda volver a otorgar nada: habría que
     entrar por la base de datos a mano. */
  IF v_a.alcance_tipo = 'organizacion'
     AND identidad.puede_rol(v_a.rol, 'identidad', 'administrar') THEN
    SELECT count(*) INTO v_quedan
      FROM identidad.asignaciones a
     WHERE a.alcance_tipo = 'organizacion'
       AND a.id <> p_asignacion
       AND a.revocada_en IS NULL
       AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)
       AND identidad.puede_rol(a.rol, 'identidad', 'administrar');
    IF v_quedan = 0 THEN
      RAISE EXCEPTION
        'Es el ÚNICO rol que puede administrar la red entera. Si se revoca, nadie podrá volver a otorgar accesos: nombre primero a otra persona.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  UPDATE identidad.asignaciones
     SET revocada_en = now(),
         revocada_por = v_quien,
         motivo_revocacion = btrim(p_motivo),
         vigente_hasta = GREATEST(CURRENT_DATE, vigente_desde)
   WHERE id = p_asignacion;

  RETURN jsonb_build_object(
    'id', p_asignacion, 'rol', v_a.rol, 'persona_id', v_a.persona_id,
    'revocada_por', v_quien, 'motivo', btrim(p_motivo));
END $$;

/* Quién puede qué, mirando SOLO el rol. Se usa arriba para saber si el
   rol que se está quitando es de los que administran la red. */
CREATE OR REPLACE FUNCTION identidad.puede_rol(p_rol text, p_modulo text, p_accion text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = identidad, sistema, public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM sistema.matriz_permisos
                  WHERE rol = p_rol AND modulo = p_modulo AND accion = p_accion);
$$;

REVOKE ALL ON FUNCTION identidad.revocar_asignacion(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identidad.revocar_asignacion(uuid, text, uuid) TO casaroca_app;
REVOKE ALL ON FUNCTION identidad.puede_rol(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identidad.puede_rol(text, text, text) TO casaroca_app;

/* ⛔ Y se le quita a la aplicación el UPDATE directo sobre la tabla. No
   servía para nada (el RLS lo dejaba en cero) y su sola presencia hacía
   creer que había una vía abierta. Ahora la única puerta es la función. */
REVOKE UPDATE ON identidad.asignaciones FROM casaroca_app;

COMMIT;
