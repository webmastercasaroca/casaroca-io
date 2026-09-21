-- =====================================================================
-- 0060 · LO QUE GOBIERNA EL SISTEMA, EDITABLE DESDE EL SISTEMA
--
-- ⛔ Daniel lo probó y lo dijo sin rodeos: «si quiero modificar roles y
--    techo no me sirve de nada esto», «en plantillas cómo agrego, elimino,
--    pongo nuevas, no me deja», «todas las pestañas deben tener casilla de
--    acceso, todo debe tener interactividad».
--
--    Tenía razón. Las cuatro tablas que DEFINEN quién puede qué
--    (`identidad.roles`, `sistema.matriz_permisos`, `sistema.plantillas`
--    y `sistema.plantilla_modulos`) estaban en SOLO LECTURA para la
--    aplicación. Se podían mirar y no tocar: para cambiar un techo o
--    añadir una plantilla había que entrar a la base.
--
--    Un comando central que no puede cambiar la matriz de permisos no es
--    un comando central: es un informe.
--
-- ⛔ Lo que NO cambia: las reglas siguen en la base. `trg_permiso_respeta_nivel`
--    impide dar un permiso por encima del techo del rol,
--    `trg_permiso_nombrado_en_su_modulo` impide inventar acciones fuera de
--    su módulo y `trg_no_exportar_menores` sigue cerrando la puerta que
--    importa. Estas funciones abren la puerta; no levantan un solo freno.
-- =====================================================================

BEGIN;

-- ── Roles: crear y editar, con su techo y su alcance máximo ──────────
CREATE OR REPLACE FUNCTION identidad.guardar_rol(
  p_codigo text, p_nombre text, p_alcance_maximo text,
  p_nivel_maximo smallint, p_descripcion text DEFAULT NULL, p_activo boolean DEFAULT true)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = identidad, sistema, plataforma, public, pg_temp AS $$
DECLARE v_bajando boolean; v_afectados int;
BEGIN
  PERFORM identidad.exigir_admin_de(NULL);
  IF NOT plataforma.ctx_es_global() THEN
    RAISE EXCEPTION 'Cambiar un rol afecta a toda la red: exige alcance de organización'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  /* ⛔ Bajar el techo de un rol NO es un cambio cosmético: deja fuera de
     su alcance a todo el que lo tenga. Se avisa contando a cuántos, y se
     deja escrito en la bitácora, en vez de hacerlo en silencio. */
  SELECT (r.nivel_maximo > p_nivel_maximo) INTO v_bajando
    FROM identidad.roles r WHERE r.codigo = p_codigo;

  INSERT INTO identidad.roles (codigo, nombre, alcance_maximo, nivel_maximo, descripcion, activo)
  VALUES (p_codigo, p_nombre, p_alcance_maximo::identidad.tipo_alcance, p_nivel_maximo, p_descripcion, COALESCE(p_activo, true))
  ON CONFLICT (codigo) DO UPDATE
    SET nombre = EXCLUDED.nombre, alcance_maximo = EXCLUDED.alcance_maximo,
        nivel_maximo = EXCLUDED.nivel_maximo, descripcion = EXCLUDED.descripcion,
        activo = EXCLUDED.activo;

  IF COALESCE(v_bajando, false) THEN
    SELECT count(*) INTO v_afectados FROM identidad.asignaciones a
     WHERE a.rol = p_codigo AND a.revocada_en IS NULL AND a.nivel_max > p_nivel_maximo;
    INSERT INTO plataforma.bitacora_mantenimiento (tarea, objeto, detalle)
    VALUES ('techo_de_rol_bajado', p_codigo,
            jsonb_build_object('nuevo_techo', p_nivel_maximo, 'asignaciones_por_encima', v_afectados,
                               'quien', plataforma.ctx_persona_id()));
  END IF;

  RETURN p_codigo;
END $$;

-- ── La matriz de permisos, casilla por casilla ───────────────────────
CREATE OR REPLACE FUNCTION sistema.marcar_permiso(
  p_rol text, p_modulo text, p_accion text, p_marcado boolean,
  p_nivel_max smallint DEFAULT NULL, p_acta text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = sistema, identidad, plataforma, public, pg_temp AS $$
DECLARE v_techo smallint;
BEGIN
  PERFORM identidad.exigir_admin_de(NULL);
  IF NOT plataforma.ctx_es_global() THEN
    RAISE EXCEPTION 'La matriz de permisos es de toda la red: exige alcance de organización'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT p_marcado THEN
    DELETE FROM sistema.matriz_permisos
     WHERE rol = p_rol AND modulo = p_modulo AND accion = p_accion;
    RETURN false;
  END IF;

  /* Si no se dice el nivel, se usa el techo del rol: es lo que un
     administrador espera al marcar una casilla sin más ceremonia, y los
     disparadores de la base siguen comprobando que no se pase. */
  SELECT r.nivel_maximo INTO v_techo FROM identidad.roles r WHERE r.codigo = p_rol;
  INSERT INTO sistema.matriz_permisos (rol, modulo, accion, nivel_max, acta_ref)
  VALUES (p_rol, p_modulo, p_accion, COALESCE(p_nivel_max, v_techo), p_acta)
  ON CONFLICT (rol, modulo, accion) DO UPDATE
    SET nivel_max = EXCLUDED.nivel_max,
        acta_ref = COALESCE(EXCLUDED.acta_ref, sistema.matriz_permisos.acta_ref);
  RETURN true;
END $$;

-- ── Plantillas de iglesia: crear, editar y borrar ────────────────────
CREATE OR REPLACE FUNCTION sistema.guardar_plantilla(
  p_codigo text, p_nombre text, p_tipo_sede text, p_descripcion text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = sistema, identidad, plataforma, org, public, pg_temp AS $$
BEGIN
  PERFORM identidad.exigir_admin_de(NULL);
  IF NOT plataforma.ctx_es_global() THEN
    RAISE EXCEPTION 'Las plantillas son de toda la red: exige alcance de organización'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  INSERT INTO sistema.plantillas (codigo, nombre, tipo_sede, descripcion)
  VALUES (p_codigo, p_nombre, p_tipo_sede::org.tipo_sede, p_descripcion)
  ON CONFLICT (codigo) DO UPDATE
    SET nombre = EXCLUDED.nombre, tipo_sede = EXCLUDED.tipo_sede,
        descripcion = EXCLUDED.descripcion;
  RETURN p_codigo;
END $$;

/** Marca o desmarca UN módulo de una plantilla. Es la casilla. */
CREATE OR REPLACE FUNCTION sistema.marcar_modulo_de_plantilla(
  p_plantilla text, p_modulo text, p_marcado boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = sistema, identidad, plataforma, public, pg_temp AS $$
BEGIN
  PERFORM identidad.exigir_admin_de(NULL);
  IF NOT plataforma.ctx_es_global() THEN
    RAISE EXCEPTION 'Las plantillas son de toda la red: exige alcance de organización'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_marcado THEN
    INSERT INTO sistema.plantilla_modulos (plantilla, modulo)
    VALUES (p_plantilla, p_modulo) ON CONFLICT DO NOTHING;
    RETURN true;
  END IF;

  /* ⛔ Un módulo de núcleo no se quita de una plantilla: una iglesia sin
     Personas no es una iglesia, es una carpeta vacía. */
  IF EXISTS (SELECT 1 FROM sistema.modulos m WHERE m.codigo = p_modulo AND m.es_nucleo) THEN
    RAISE EXCEPTION 'El módulo «%» es de núcleo: no se puede quitar de una plantilla', p_modulo
      USING ERRCODE = 'check_violation';
  END IF;
  DELETE FROM sistema.plantilla_modulos WHERE plantilla = p_plantilla AND modulo = p_modulo;
  RETURN false;
END $$;

CREATE OR REPLACE FUNCTION sistema.borrar_plantilla(p_codigo text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = sistema, identidad, plataforma, org, public, pg_temp AS $$
DECLARE v_usos int;
BEGIN
  PERFORM identidad.exigir_admin_de(NULL);
  IF NOT plataforma.ctx_es_global() THEN
    RAISE EXCEPTION 'Las plantillas son de toda la red: exige alcance de organización'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  /* ⛔ No se borra una plantilla que ya se usó: el registro de cómo nació
     cada iglesia es lo que permite explicar por qué ve lo que ve. */
  SELECT count(*) INTO v_usos FROM sistema.bitacora_aprovisionamiento b
   WHERE b.detalle->>'plantilla' = p_codigo;
  IF v_usos > 0 THEN
    RAISE EXCEPTION 'Esa plantilla ya se usó para crear % iglesia(s): no se borra, se desactiva cambiándole el nombre', v_usos
      USING ERRCODE = 'check_violation';
  END IF;
  DELETE FROM sistema.plantillas WHERE codigo = p_codigo;
END $$;

-- ── Lecturas que la consola necesita y la aplicación no tiene ────────
CREATE OR REPLACE FUNCTION sistema.ver_matriz(p_rol text DEFAULT NULL)
RETURNS TABLE (rol text, rol_nombre text, rol_techo smallint, modulo text, modulo_nombre text,
               modulo_nivel smallint, accion text, accion_nombre text, marcado boolean,
               nivel_max smallint, acta_ref text, por_encima boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = sistema, identidad, public, pg_temp AS $$
BEGIN
  PERFORM identidad.exigir_admin_de(NULL);
  RETURN QUERY
  SELECT r.codigo, r.nombre, r.nivel_maximo,
         m.codigo, m.nombre, m.nivel_dato,
         a.codigo, a.nombre,
         (p.rol IS NOT NULL),
         p.nivel_max, p.acta_ref,
         /* ⛔ Lo que un auditor busca: módulos cuyo dato está POR ENCIMA
            del techo del rol. La casilla se puede marcar, pero la base no
            devolverá una sola fila: es un permiso que engaña. */
         (m.nivel_dato > r.nivel_maximo)
    FROM identidad.roles r
    CROSS JOIN sistema.modulos m
    JOIN sistema.acciones a ON a.modulo IS NULL OR a.modulo = m.codigo
    LEFT JOIN sistema.matriz_permisos p
           ON p.rol = r.codigo AND p.modulo = m.codigo AND p.accion = a.codigo
   WHERE (p_rol IS NULL OR r.codigo = p_rol)
     AND r.activo
   ORDER BY r.nombre, m.orden, a.orden;
END $$;

GRANT EXECUTE ON FUNCTION identidad.guardar_rol(text,text,text,smallint,text,boolean) TO casaroca_app;
GRANT EXECUTE ON FUNCTION sistema.marcar_permiso(text,text,text,boolean,smallint,text) TO casaroca_app;
GRANT EXECUTE ON FUNCTION sistema.guardar_plantilla(text,text,text,text) TO casaroca_app;
GRANT EXECUTE ON FUNCTION sistema.marcar_modulo_de_plantilla(text,text,boolean) TO casaroca_app;
GRANT EXECUTE ON FUNCTION sistema.borrar_plantilla(text) TO casaroca_app;
GRANT EXECUTE ON FUNCTION sistema.ver_matriz(text) TO casaroca_app;

COMMIT;
