-- =====================================================================
-- 0059 · ADMINISTRAR CUENTAS DESDE EL SISTEMA, Y NO DESDE LA TERMINAL
--
-- ⛔ HALLAZGO, 20 de septiembre de 2026, al ir a construir el panel de
--    administración: `identidad.crear_cuenta` es SECURITY DEFINER, la
--    aplicación tiene permiso para ejecutarla, y NO COMPRUEBA NADA sobre
--    quién llama. Hoy no es explotable porque ninguna ruta la expone, pero
--    el primer endpoint de administración la habría convertido en esto:
--    cualquier sesión autenticada creando una cuenta para cualquier
--    persona, incluida una con N4 sobre toda la red.
--
--    Es exactamente el mismo patrón que el hallazgo de la sobrecarga de
--    `registrar_checkin`: una función privilegiada que nadie llamaba, y
--    por eso nadie había mirado.
--
--    Aquí se le pone la comprobación DENTRO, antes de exponerla, y se
--    añaden las operaciones que faltaban para que una red de 36 iglesias
--    se pueda administrar sin `psql`: listar cuentas, reiniciar una
--    contraseña, desbloquear a quien se equivocó cinco veces, y reiniciar
--    el segundo factor de quien perdió el teléfono.
--
--    ⛔ TODAS comprueban dos cosas, no una:
--       · que quien llama pueda ADMINISTRAR el módulo `identidad`, y
--       · que la persona afectada esté en su alcance.
--    Sin la segunda, un pastor de sede administraría toda la red.
-- =====================================================================

BEGIN;

-- ── El guardia, en un solo sitio ─────────────────────────────────────
CREATE OR REPLACE FUNCTION identidad.exigir_admin_de(p_persona_afectada uuid)
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = identidad, nucleo, plataforma, pg_temp AS $$
DECLARE v_quien uuid; v_sede uuid;
BEGIN
  v_quien := plataforma.ctx_persona_id();
  IF v_quien IS NULL THEN
    RAISE EXCEPTION 'No hay sesión: esta operación no se hace sin identidad'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT identidad.puede(v_quien, 'identidad', 'administrar') THEN
    RAISE EXCEPTION 'Su rol no administra accesos'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_persona_afectada IS NOT NULL THEN
    SELECT sede_id INTO v_sede FROM nucleo.personas WHERE id = p_persona_afectada;
    IF v_sede IS NULL THEN
      RAISE EXCEPTION 'No se encuentra a esa persona' USING ERRCODE = 'no_data_found';
    END IF;
    -- ⛔ El alcance. Sin esto, quien administra su sede administra la red.
    IF NOT (plataforma.sede_visible(v_sede)
            OR EXISTS (SELECT 1 FROM nucleo.membresias_sede m
                        WHERE m.persona_id = p_persona_afectada
                          AND plataforma.sede_visible(m.sede_id))) THEN
      RAISE EXCEPTION 'Esa persona no está en su alcance'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
END $$;

-- ── Crear cuenta: la misma función, ahora con guardia ────────────────
CREATE OR REPLACE FUNCTION identidad.crear_cuenta(
  p_persona uuid, p_usuario text, p_clave_hash text, p_quien uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = identidad, nucleo, plataforma, public, pg_temp AS $$
DECLARE v_id uuid; v_super boolean;
BEGIN
  /* ⛔ El guardia se aplica a LA APLICACIÓN, que es de quien hay que
     protegerse. A un superusuario no: ya puede escribir en la tabla
     directamente, así que exigirle una sesión sería teatro y además
     dejaría sin arrancar una instalación nueva (`scripts/crear-cuenta.js`
     crea la PRIMERA cuenta, cuando todavía no hay nadie que autorice).
     Se mira `session_user`, no `current_user`: dentro de una función
     SECURITY DEFINER el segundo ya es el dueño. */
  SELECT COALESCE(r.rolsuper, false) INTO v_super
    FROM pg_roles r WHERE r.rolname = session_user;
  IF NOT v_super THEN
    PERFORM identidad.exigir_admin_de(p_persona);
  END IF;

  INSERT INTO identidad.cuentas (persona_id, usuario, clave_hash, estado, creada_por, clave_cambiada_en, debe_cambiar_clave)
  VALUES (p_persona, p_usuario::citext, p_clave_hash, 'activa',
          COALESCE(p_quien, plataforma.ctx_persona_id()), now(),
          /* La contraseña la pone otra persona: es provisional por
             definición y el sistema la obliga a cambiarla al entrar. La
             del arranque no, porque no hay «otra persona» todavía. */
          NOT v_super)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- ── Listar las cuentas que uno alcanza ───────────────────────────────
-- ⛔ DROP antes de CREATE: cambiar el tipo devuelto de una funcion que ya
--    existe no se puede con CREATE OR REPLACE, y sin esto la migracion
--    falla al correrla dos veces (que es exactamente lo que hace el
--    `migrar.sh` de cualquiera que clone el repositorio hoy).
DROP FUNCTION IF EXISTS identidad.listar_cuentas(text,int);
CREATE OR REPLACE FUNCTION identidad.listar_cuentas(p_texto text DEFAULT NULL, p_limite int DEFAULT 100)
RETURNS TABLE (
  cuenta_id uuid, persona_id uuid, persona text, usuario text, estado text,
  segundo_factor_activo boolean, exige_segundo_factor boolean, debe_cambiar_clave boolean,
  ultimo_ingreso timestamptz, intentos_fallidos smallint, bloqueada boolean, sede text, roles text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = identidad, nucleo, org, plataforma, public, pg_temp AS $$
BEGIN
  PERFORM identidad.exigir_admin_de(NULL);
  RETURN QUERY
  SELECT c.id, c.persona_id, p.nombre_completo, c.usuario::text, c.estado::text,
         c.segundo_factor_activo, c.exige_segundo_factor, c.debe_cambiar_clave,
         c.ultimo_ingreso, c.intentos_fallidos,
         (c.bloqueada_hasta IS NOT NULL AND c.bloqueada_hasta > now()),
         s.codigo::text,
         (SELECT string_agg(a.rol, ', ' ORDER BY a.rol) FROM identidad.asignaciones a
           WHERE a.persona_id = c.persona_id AND a.revocada_en IS NULL
             AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE))
    FROM identidad.cuentas c
    JOIN nucleo.v_personas p ON p.id = c.persona_id
    LEFT JOIN org.sedes s ON s.id = p.sede_id
   WHERE (plataforma.sede_visible(p.sede_id)
          OR EXISTS (SELECT 1 FROM nucleo.membresias_sede m
                      WHERE m.persona_id = c.persona_id AND plataforma.sede_visible(m.sede_id)))
     AND (p_texto IS NULL OR p.nombre_completo ILIKE '%'||p_texto||'%' OR c.usuario::text ILIKE '%'||p_texto||'%')
   ORDER BY p.nombre_completo
   LIMIT GREATEST(1, LEAST(p_limite, 500));
END $$;

-- ── Reiniciar la contraseña ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION identidad.reiniciar_clave(p_cuenta uuid, p_hash text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = identidad, plataforma, pg_temp AS $$
DECLARE v_persona uuid;
BEGIN
  SELECT persona_id INTO v_persona FROM identidad.cuentas WHERE id = p_cuenta;
  IF v_persona IS NULL THEN RAISE EXCEPTION 'No existe esa cuenta' USING ERRCODE='no_data_found'; END IF;
  PERFORM identidad.exigir_admin_de(v_persona);

  UPDATE identidad.cuentas
     SET clave_hash = p_hash, clave_cambiada_en = now(),
         debe_cambiar_clave = true,     -- la puso otro: es provisional
         intentos_fallidos = 0, bloqueada_hasta = NULL,
         estado = CASE WHEN estado::text = 'bloqueada' THEN 'activa' ELSE estado END
   WHERE id = p_cuenta;

  /* ⛔ Y se cierran TODAS sus sesiones. Si no, quien tuviera la sesión
     abierta con la contraseña vieja sigue dentro: reiniciar una clave
     porque se sospecha que alguien la sabe no serviría de nada. */
  PERFORM identidad.cerrar_todas_las_sesiones(p_cuenta, 'contraseña reiniciada por la administración');
END $$;

-- ── Desbloquear a quien se equivocó cinco veces ──────────────────────
CREATE OR REPLACE FUNCTION identidad.desbloquear(p_cuenta uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = identidad, plataforma, pg_temp AS $$
DECLARE v_persona uuid;
BEGIN
  SELECT persona_id INTO v_persona FROM identidad.cuentas WHERE id = p_cuenta;
  IF v_persona IS NULL THEN RAISE EXCEPTION 'No existe esa cuenta' USING ERRCODE='no_data_found'; END IF;
  PERFORM identidad.exigir_admin_de(v_persona);
  UPDATE identidad.cuentas
     SET intentos_fallidos = 0, bloqueada_hasta = NULL,
         estado = CASE WHEN estado::text = 'bloqueada' THEN 'activa' ELSE estado END
   WHERE id = p_cuenta;
END $$;

-- ── Reiniciar el segundo factor (perdió el teléfono) ─────────────────
CREATE OR REPLACE FUNCTION identidad.reiniciar_segundo_factor(p_cuenta uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = identidad, plataforma, pg_temp AS $$
DECLARE v_persona uuid;
BEGIN
  SELECT persona_id INTO v_persona FROM identidad.cuentas WHERE id = p_cuenta;
  IF v_persona IS NULL THEN RAISE EXCEPTION 'No existe esa cuenta' USING ERRCODE='no_data_found'; END IF;
  PERFORM identidad.exigir_admin_de(v_persona);

  /* Se borra el secreto: la próxima entrada vuelve a pedir configurarlo.
     ⛔ NO se le quita la exigencia: un rol N3 o N4 sigue obligado. Quitarla
     sería la salida fácil y dejaría la cuenta más delicada sin candado. */
  UPDATE identidad.cuentas
     SET segundo_factor_activo = false, segundo_factor_secreto = NULL
   WHERE id = p_cuenta;
  PERFORM identidad.cerrar_todas_las_sesiones(p_cuenta, 'segundo factor reiniciado por la administración');
END $$;

-- ── Encender o apagar un módulo en una sede ──────────────────────────
CREATE OR REPLACE FUNCTION sistema.habilitar_modulo(
  p_sede uuid, p_modulo text, p_activo boolean, p_evidencia text DEFAULT NULL, p_nota text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = sistema, plataforma, pg_temp AS $$
BEGIN
  PERFORM identidad.exigir_admin_de(NULL);
  IF NOT plataforma.sede_visible(p_sede) THEN
    RAISE EXCEPTION 'Esa sede no está en su alcance' USING ERRCODE='insufficient_privilege';
  END IF;

  INSERT INTO sistema.modulos_sede (sede_id, modulo, activo, evidencia_legal_ref, nota, activado_por)
  VALUES (p_sede, p_modulo, p_activo, p_evidencia, p_nota, plataforma.ctx_persona_id())
  ON CONFLICT (sede_id, modulo) DO UPDATE
    SET activo = EXCLUDED.activo,
        evidencia_legal_ref = COALESCE(EXCLUDED.evidencia_legal_ref, sistema.modulos_sede.evidencia_legal_ref),
        nota = COALESCE(EXCLUDED.nota, sistema.modulos_sede.nota),
        activado_por = EXCLUDED.activado_por;
  -- La compuerta legal y las dependencias las sigue imponiendo
  -- `tg_habilitacion_valida`: aquí no se repite ninguna regla.
END $$;

-- ── Lo que se MIRA para vigilar, por función y no por permiso ────────
--
-- ⛔ `plataforma.auditoria`, `plataforma.bitacora_lectura`,
--    `identidad.sesiones` e `identidad.intentos_acceso` están CERRADAS a la
--    aplicación, y tienen que seguir estándolo: conceder SELECT sobre la
--    auditoría a la aplicación la haría legible por cualquier sesión, que
--    es justo lo que la auditoría existe para impedir. Se leen por función,
--    con el mismo guardia que todo lo demás.
CREATE OR REPLACE FUNCTION identidad.ver_sesiones_activas(p_limite int DEFAULT 200)
RETURNS TABLE (sesion uuid, usuario text, persona_id uuid, persona text,
               emitida_en timestamptz, expira_en timestamptz, ip inet, agente text, le_queda interval)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = identidad, nucleo, plataforma, public, pg_temp AS $$
BEGIN
  PERFORM identidad.exigir_admin_de(NULL);
  RETURN QUERY SELECT v.sesion, v.usuario::text, v.persona_id, v.persona::text,
                      v.emitida_en, v.expira_en, v.ip, v.agente, v.le_queda
                 FROM identidad.v_sesiones_activas v
                ORDER BY v.emitida_en DESC
                LIMIT GREATEST(1, LEAST(p_limite, 500));
END $$;

CREATE OR REPLACE FUNCTION identidad.ver_alertas_acceso(p_limite int DEFAULT 100)
RETURNS TABLE (usuario text, ip inet, intentos_fallidos bigint, desde timestamptz, hasta timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = identidad, plataforma, public, pg_temp AS $$
BEGIN
  PERFORM identidad.exigir_admin_de(NULL);
  RETURN QUERY SELECT v.usuario::text, v.ip, v.intentos_fallidos::bigint, v.desde, v.hasta
                 FROM identidad.v_alertas_acceso v
                ORDER BY v.intentos_fallidos DESC
                LIMIT GREATEST(1, LEAST(p_limite, 500));
END $$;

CREATE OR REPLACE FUNCTION plataforma.ver_auditoria(p_limite int DEFAULT 100)
RETURNS TABLE (ocurrido_en timestamptz, esquema text, tabla text, operacion text,
               fila_id text, actor text, actor_ip inet)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = plataforma, nucleo, identidad, public, pg_temp AS $$
BEGIN
  PERFORM identidad.exigir_admin_de(NULL);
  RETURN QUERY SELECT a.ocurrido_en, a.esquema, a.tabla, a.operacion::text, a.fila_id,
                      p.nombre_completo::text, a.actor_ip
                 FROM plataforma.auditoria a
                 LEFT JOIN nucleo.v_personas p ON p.id = a.actor_id
                ORDER BY a.ocurrido_en DESC
                LIMIT GREATEST(1, LEAST(p_limite, 500));
END $$;

CREATE OR REPLACE FUNCTION plataforma.ver_bitacora_lectura(p_limite int DEFAULT 100)
RETURNS TABLE (ocurrido_en timestamptz, esquema text, tabla text, nivel smallint,
               motivo text, filas_leidas int, actor text, actor_ip inet)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = plataforma, nucleo, identidad, public, pg_temp AS $$
BEGIN
  PERFORM identidad.exigir_admin_de(NULL);
  RETURN QUERY SELECT b.ocurrido_en, b.esquema, b.tabla, b.nivel, b.motivo, b.filas_leidas,
                      p.nombre_completo::text, b.actor_ip
                 FROM plataforma.bitacora_lectura b
                 LEFT JOIN nucleo.v_personas p ON p.id = b.actor_id
                ORDER BY b.ocurrido_en DESC
                LIMIT GREATEST(1, LEAST(p_limite, 500));
END $$;

GRANT EXECUTE ON FUNCTION identidad.ver_sesiones_activas(int) TO casaroca_app;
GRANT EXECUTE ON FUNCTION identidad.ver_alertas_acceso(int) TO casaroca_app;
GRANT EXECUTE ON FUNCTION plataforma.ver_auditoria(int) TO casaroca_app;
GRANT EXECUTE ON FUNCTION plataforma.ver_bitacora_lectura(int) TO casaroca_app;

-- ── Crear un equipo de la central ────────────────────────────────────
--
-- ⛔ `org.unidades` es de SOLO LECTURA para la aplicacion, y esta bien:
--    crear una direccion o un equipo de la central es un acto estructural,
--    no una operacion del dia. Pero «esta bien» no puede querer decir «se
--    hace con psql»: el equipo de la central es justo quien arma
--    Contabilidad y Tesoreria. Se hace por funcion, con el mismo guardia.
CREATE OR REPLACE FUNCTION org.crear_equipo(
  p_codigo text, p_nombre text, p_clase text, p_proposito text,
  p_padre uuid DEFAULT NULL, p_lider uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = org, identidad, plataforma, public, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM identidad.exigir_admin_de(NULL);
  -- ⛔ Crear estructura de la RED exige alcance de red. Un pastor de sede
  --    administra su sede; no crea direcciones de la central.
  IF NOT plataforma.ctx_es_global() THEN
    RAISE EXCEPTION 'Crear un equipo de la central exige alcance de organización'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_proposito IS NULL OR length(trim(p_proposito)) < 15 THEN
    RAISE EXCEPTION 'Un equipo sin propósito escrito es un equipo que nadie sabe por qué tiene sus permisos'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO org.unidades (codigo, nombre, clase, padre_id, lider_persona_id, proposito)
  VALUES (p_codigo, p_nombre, p_clase, p_padre, p_lider, p_proposito)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION org.crear_equipo(text,text,text,text,uuid,uuid) TO casaroca_app;

-- ── Revocar el rol de un EQUIPO ──────────────────────────────────────
--
-- ⛔ `identidad.revocar_asignacion` solo toca `identidad.asignaciones`.
--    Al construir el panel se vio que una llamada para revocar el rol de
--    un equipo respondia «la asignacion no existe»: son dos tablas
--    distintas, y el rol de un equipo vive en `asignaciones_unidad`.
--    Sin esta funcion, quitarle el permiso a Contabilidad habria sido
--    imposible desde la aplicacion, que es peor que no poder darselo.
CREATE OR REPLACE FUNCTION identidad.revocar_asignacion_unidad(
  p_asignacion uuid, p_motivo text, p_quien uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = identidad, plataforma, public, pg_temp AS $$
BEGIN
  PERFORM identidad.exigir_admin_de(NULL);
  IF p_motivo IS NULL OR length(trim(p_motivo)) < 5 THEN
    RAISE EXCEPTION 'Revocar un permiso exige un motivo escrito' USING ERRCODE='check_violation';
  END IF;
  UPDATE identidad.asignaciones_unidad
     SET revocada_en = now(),
         revocada_por = COALESCE(p_quien, plataforma.ctx_persona_id()),
         motivo_revocacion = p_motivo,
         vigente_hasta = GREATEST(CURRENT_DATE, vigente_desde)
   WHERE id = p_asignacion AND revocada_en IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esa asignacion de equipo no existe o ya estaba revocada' USING ERRCODE='no_data_found';
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION identidad.revocar_asignacion_unidad(uuid,text,uuid) TO casaroca_app;

-- La aplicación ejecuta; nadie más.
REVOKE ALL ON FUNCTION identidad.exigir_admin_de(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identidad.listar_cuentas(text,int) TO casaroca_app;
GRANT EXECUTE ON FUNCTION identidad.reiniciar_clave(uuid,text) TO casaroca_app;
GRANT EXECUTE ON FUNCTION identidad.desbloquear(uuid) TO casaroca_app;
GRANT EXECUTE ON FUNCTION identidad.reiniciar_segundo_factor(uuid) TO casaroca_app;
GRANT EXECUTE ON FUNCTION sistema.habilitar_modulo(uuid,text,boolean,text,text) TO casaroca_app;
GRANT EXECUTE ON FUNCTION identidad.exigir_admin_de(uuid) TO casaroca_app;

COMMIT;
