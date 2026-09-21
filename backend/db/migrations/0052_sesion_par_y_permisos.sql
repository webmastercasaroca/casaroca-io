-- =====================================================================
-- Migración 0052 — CERRAR SESIÓN CIERRA LA SESIÓN ENTERA
--
-- ⛔ HALLAZGO CRÍTICO DE LA AUDITORÍA DE SEGURIDAD (19 sep 2026):
--    `POST /auth/salir` revocaba SOLO la fila del token de acceso. El
--    token de REFRESCO, emitido en el mismo ingreso como una sesión
--    aparte, no se tocaba. Con él se seguía pidiendo acceso nuevo durante
--    doce horas después de que el usuario «cerró sesión».
--
--    Reproducido por el auditor: salir devuelve {cerrada:true}, el acceso
--    muere (401), y acto seguido `POST /auth/refrescar` con el refresco
--    viejo devuelve 200 con un par nuevo y `quien-soy` responde 200.
--
--    El caso real: alguien cierra sesión en el computador de recepción
--    creyendo que quedó protegido. No quedó.
--
-- ⭐ EL ARREGLO: el acceso y su refresco son DOS FILAS DE LA MISMA SESIÓN.
--    Se enlazan al emitirlos y cerrar una cierra la otra. Que fueran dos
--    filas sueltas era la causa: nada decía que eran hermanas.
-- =====================================================================

ALTER TABLE identidad.sesiones ADD COLUMN par_de uuid REFERENCES identidad.sesiones(id);
CREATE INDEX sesiones_par_idx ON identidad.sesiones (par_de) WHERE revocada_en IS NULL;

COMMENT ON COLUMN identidad.sesiones.par_de IS
  'El acceso y su refresco son la misma sesion en dos filas. Cerrar una cierra la otra: sin esto, «cerrar sesion» dejaba el refresco vivo doce horas.';

-- Emitir el par, enlazado desde el principio.
CREATE OR REPLACE FUNCTION identidad.abrir_par_de_sesion(
  p_cuenta uuid, p_jti_acceso uuid, p_jti_refresco uuid,
  p_minutos_acceso int, p_minutos_refresco int,
  p_ip inet DEFAULT NULL, p_agente text DEFAULT NULL, p_refresco_de uuid DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  INSERT INTO identidad.sesiones (id, cuenta_id, expira_en, ip, agente, refresco_de)
  VALUES (p_jti_acceso, p_cuenta, now() + make_interval(mins => p_minutos_acceso), p_ip, p_agente, NULL);

  INSERT INTO identidad.sesiones (id, cuenta_id, expira_en, ip, agente, refresco_de, par_de)
  VALUES (p_jti_refresco, p_cuenta, now() + make_interval(mins => p_minutos_refresco), p_ip, p_agente,
          p_refresco_de, p_jti_acceso);

  UPDATE identidad.sesiones SET par_de = p_jti_refresco WHERE id = p_jti_acceso;

  -- Un refresco usado dos veces es la senal clasica de un token robado:
  -- el anterior y SU PAREJA se cierran.
  IF p_refresco_de IS NOT NULL THEN
    UPDATE identidad.sesiones SET revocada_en = now(), motivo_revocacion = 'rotada'
     WHERE (id = p_refresco_de OR par_de = p_refresco_de OR id = (SELECT par_de FROM identidad.sesiones WHERE id = p_refresco_de))
       AND revocada_en IS NULL;
  END IF;
END $$;

-- Cerrar una cierra a su pareja.
CREATE OR REPLACE FUNCTION identidad.cerrar_sesion(p_jti uuid, p_motivo text DEFAULT 'salida del usuario')
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v int;
BEGIN
  UPDATE identidad.sesiones
     SET revocada_en = now(), motivo_revocacion = p_motivo
   WHERE revocada_en IS NULL
     AND (id = p_jti
          OR par_de = p_jti
          OR id = (SELECT s.par_de FROM identidad.sesiones s WHERE s.id = p_jti));
  GET DIAGNOSTICS v = ROW_COUNT;
  RETURN v > 0;
END $$;

GRANT EXECUTE ON FUNCTION identidad.abrir_par_de_sesion(uuid,uuid,uuid,int,int,inet,text,uuid) TO casaroca_app;

-- ---------------------------------------------------------------------
-- El banco de pruebas de identidad que `probar.sh` declaraba y que NUNCA
-- EXISTIÓ: la línea `[[ -f "$f" ]] || continue` lo saltaba en silencio.
-- Se crea en db/tests/identidad_y_sesion.sql (fuera de esta migración) y
-- el corredor pasa a FALLAR si un banco declarado no está.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- ⛔ EL NIVEL EXIGIDO DEJA DE DEPENDER DE QUIEN ESCRIBE EL CONTROLADOR
--
--    Hallazgo de la auditoría: `GET /api/v1/modelo100p/menores` no llamaba
--    a `exigirNivel` y entregaba a una sesión N2 (un tesorero, un líder de
--    célula) el listado de menores con nombre, edad, dirección de la casa,
--    teléfono de emergencia y foto, hasta mil por página. Cinco rutas de
--    RocaKids sí lo exigían; la sexta no. La misma omisión otra vez.
--
--    El arreglo no es añadir la línea que falta: es que el nivel NO se
--    escriba a mano en ningún controlador. Se DERIVA de la clasificación
--    de columnas, que ya existe y ya dice qué tan sensible es cada dato.
--    Una vista nueva queda protegida sin que nadie se acuerde.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION plataforma.nivel_que_exige(p_esquema text, p_objeto text)
RETURNS smallint LANGUAGE plpgsql STABLE AS $$
DECLARE v_nivel smallint;
BEGIN
  -- 1 · si el objeto está clasificado, manda su columna más sensible
  SELECT max(nivel) INTO v_nivel
  FROM plataforma.clasificacion_columna
  WHERE esquema = p_esquema AND tabla = p_objeto;
  IF v_nivel IS NOT NULL THEN RETURN v_nivel; END IF;

  -- 2 · si es una vista, manda la tabla más sensible de la que depende
  SELECT max(cc.nivel) INTO v_nivel
  FROM pg_depend d
  JOIN pg_rewrite rw ON rw.oid = d.objid
  JOIN pg_class v ON v.oid = rw.ev_class
  JOIN pg_namespace nv ON nv.oid = v.relnamespace
  JOIN pg_class t ON t.oid = d.refobjid
  JOIN pg_namespace nt ON nt.oid = t.relnamespace
  JOIN plataforma.clasificacion_columna cc
    ON cc.esquema = nt.nspname AND cc.tabla = t.relname
  WHERE nv.nspname = p_esquema AND v.relname = p_objeto AND v.relkind = 'v';
  IF v_nivel IS NOT NULL THEN RETURN v_nivel; END IF;

  -- 3 · ⛔ Lo que no se sabe clasificar se trata como sensible, no como
  --     público. El valor por omisión de la duda es la protección.
  RETURN 3::smallint;
END $$;

COMMENT ON FUNCTION plataforma.nivel_que_exige IS
  'Que nivel hace falta para leer un objeto, derivado de la clasificacion de sus columnas. Lo que no se sabe clasificar se trata como N3: el valor por omision de la duda es la proteccion.';

GRANT EXECUTE ON FUNCTION plataforma.nivel_que_exige(text,text) TO casaroca_app;
