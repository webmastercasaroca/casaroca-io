-- =====================================================================
-- 0066 · REVOCAR SURTE EFECTO, Y SE CIERRAN DOS ESCALADAS
--
-- Sale de la auditoría por pestaña del 20 de septiembre de 2026: doce
-- auditores, uno por pantalla, cada uno probando contra la base y no
-- leyendo. Tres de ellos llegaron por caminos distintos al mismo sitio.
--
-- ⛔ 1. REVOCAR UN ROL NO QUITABA EL PERMISO.
--    `revocar_asignacion` (migración 0063) escribe `revocada_en`, el
--    motivo y quién, y pone `vigente_hasta = CURRENT_DATE`. Pero las dos
--    funciones que AUTORIZAN filtran solo por fecha:
--    `vigente_hasta >= CURRENT_DATE`, que HOY es cierto. Ninguna de las
--    dos mira `revocada_en`.
--    Medido: se revoca un TESORERIA y `puede(persona,'aportes','ver')`
--    sigue devolviendo TRUE, con el mismo techo N3. Un auditor se lo
--    revocó a un administrador de accesos y, con la MISMA sesión, siguió
--    listando cuentas y reiniciando contraseñas ajenas.
--    El permiso sobrevivía hasta la medianoche mientras la pantalla decía
--    «la persona pierde ese acceso ahora mismo».
--    La propia 0045 declara de esa columna: «Manda sobre vigente_hasta:
--    una fecha no puede decir ahora». No mandaba.
--
-- ⛔ 2. OTORGAR NO COMPROBABA QUE QUIEN LLAMA ADMINISTRE ACCESOS.
--    `identidad.otorgar` solo miraba el techo de nivel. Revocar sí exige
--    `exigir_admin_de`. Probado: alguien de CONTABILIDAD, que no
--    administra identidad, otorgó AUDITOR/N3/organización a otra persona.
--    Se podía DAR lo que no se podía QUITAR.
--
-- ⛔ 3. SE PODÍA OTORGAR UN ALCANCE MÁS AMPLIO QUE EL MÁXIMO DEL ROL.
--    `tg_asignacion_respeta_techo` valida SOLO `nivel_max`, nunca
--    `alcance_tipo` contra `roles.alcance_maximo`. Cadena completa
--    probada por el auditor:
--      a. A una coordinadora de SEDE se le otorga SECRETARIA —cuyo
--         alcance máximo es `sede`— con `alcanceTipo = organizacion`. 201.
--      b. `es_global` pasa de falso a cierto; sus sedes, de 1 a 12.
--      c. `/sesion/yo` con su token: «toda la red».
--      d. Sin administrar accesos, otorga un rol a alguien de otra sede.
--    Dos clics para convertir a una persona de sede en administradora de
--    la red entera.
-- =====================================================================
BEGIN;

-- ── 1 · Las dos funciones que autorizan miran la revocación ──────────
CREATE OR REPLACE FUNCTION identidad.puede(p_persona uuid, p_modulo text, p_accion text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = identidad, sistema, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
      FROM identidad.asignaciones a
      JOIN identidad.roles r         ON r.codigo = a.rol AND r.activo
      JOIN sistema.matriz_permisos p ON p.rol = a.rol AND p.modulo = p_modulo
      JOIN sistema.modulos m         ON m.codigo = p.modulo
     WHERE a.persona_id = p_persona
       AND a.revocada_en IS NULL          -- ⛔ LA LÍNEA QUE FALTABA
       AND a.vigente_desde <= CURRENT_DATE
       AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)
       AND m.nivel_dato <= a.nivel_max
       AND p.accion IN ('administrar',
             COALESCE((SELECT x.accion FROM sistema.acciones_alias x WHERE x.alias = p_accion), p_accion))
  );
$$;

CREATE OR REPLACE FUNCTION identidad.nivel_max_de(p_persona_id uuid)
RETURNS smallint LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
  SELECT COALESCE(MAX(LEAST(a.nivel_max, r.nivel_maximo)), 0)::smallint
  FROM identidad.asignaciones a
  JOIN identidad.roles r ON r.codigo = a.rol
  WHERE a.persona_id = p_persona_id
    AND a.revocada_en IS NULL              -- ⛔ LA LÍNEA QUE FALTABA
    AND a.vigente_desde <= CURRENT_DATE
    AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE);
$$;

-- ── 2 · El alcance no puede pasarse del máximo del rol ───────────────
--    Se ordenan de menos a más ancho. Un rol de `sede` no se otorga con
--    alcance de `organizacion`, por mucho que el diálogo lo ofrezca.
CREATE OR REPLACE FUNCTION identidad.anchura_de_alcance(p_alcance text)
RETURNS smallint LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_alcance
           WHEN 'persona_propia' THEN 1
           WHEN 'caso_propio'    THEN 1
           WHEN 'grupo'          THEN 2
           WHEN 'ministerio'     THEN 3
           WHEN 'segmento'       THEN 3
           /* ⛔ Una UNIDAD puede abarcar varias sedes —una región agrupa
              sedes—, así que es MÁS ancha que una sede, no menos. En la
              duda, el orden se inclina al lado seguro: negar de más antes
              que conceder de más. */
           WHEN 'sede'           THEN 5
           WHEN 'unidad'         THEN 6
           WHEN 'organizacion'   THEN 9
           ELSE 9
         END::smallint;
$$;

CREATE OR REPLACE FUNCTION identidad.tg_asignacion_respeta_alcance()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_max identidad.tipo_alcance;
BEGIN
  SELECT r.alcance_maximo INTO v_max FROM identidad.roles r WHERE r.codigo = NEW.rol;
  IF v_max IS NULL THEN RETURN NEW; END IF;
  IF identidad.anchura_de_alcance(NEW.alcance_tipo::text)
     > identidad.anchura_de_alcance(v_max::text) THEN
    RAISE EXCEPTION
      'El rol «%» alcanza como máximo «%», y se está otorgando con alcance «%». Un rol de sede no se otorga sobre toda la red.',
      NEW.rol, v_max, NEW.alcance_tipo
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_asignacion_respeta_alcance ON identidad.asignaciones;
CREATE TRIGGER tg_asignacion_respeta_alcance
  BEFORE INSERT OR UPDATE OF rol, alcance_tipo ON identidad.asignaciones
  FOR EACH ROW EXECUTE FUNCTION identidad.tg_asignacion_respeta_alcance();

/* ⛔ Y NO sobre `identidad.asignaciones_unidad`, a propósito.
   El primer intento la puso también ahí y la migración desde cero se cayó
   en el sembrado 020, que es donde la regla se explica sola: el equipo
   EQ-KIDS de la central sostiene `DIRECTOR_ROCAKIDS` —cuyo alcance máximo
   es `ministerio`— sobre TODA la organización, porque es el director de
   RocaKids de la red; y cada región sostiene `PASTOR_CONGREGACIONAL`
   —máximo `sede`— sobre su unidad, que es justo lo que el propio
   comentario del sembrado celebra: «el supervisor regional, que antes no
   se podía representar sin darle la red entera».

   O sea: que un EQUIPO sostenga un rol con más alcance del habitual es el
   mecanismo del modelo, no un fallo. Lo que no puede pasar —y es lo que
   el auditor demostró— es que a una PERSONA se le otorgue directamente un
   rol de sede con alcance de organización y con eso se vuelva global.
   El otro camino, meter a esa persona en un equipo ancho, se cierra
   subiendo esa acción a N4. */

-- ── 3 · Otorgar exige administrar accesos, igual que revocar ─────────
--    Se hace por función, no en la ruta: la ruta se puede rodear.
CREATE OR REPLACE FUNCTION identidad.otorgar_asignacion(
  p_persona   uuid,
  p_rol       text,
  p_alcance   text,
  p_alcance_id uuid,
  p_nivel_max smallint,
  p_acta      text,
  p_desde     date DEFAULT NULL,
  p_hasta     date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = identidad, nucleo, sistema, plataforma, public, pg_temp AS $$
DECLARE
  v_rol   identidad.roles%ROWTYPE;
  v_techo smallint;
  v_id    uuid;
  v_quien uuid := plataforma.ctx_persona_id();
BEGIN
  SELECT * INTO v_rol FROM identidad.roles WHERE codigo = p_rol;
  IF v_rol.codigo IS NULL THEN
    RAISE EXCEPTION 'No existe el rol «%».', p_rol USING ERRCODE = 'no_data_found';
  END IF;
  IF NOT v_rol.activo THEN
    RAISE EXCEPTION 'El rol «%» está descontinuado: no se puede otorgar.', p_rol
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_acta IS NULL OR length(btrim(p_acta)) < 4 THEN
    RAISE EXCEPTION 'Falta el acta que autoriza el rol. Un permiso sin constancia de quién lo autorizó no se otorga.'
      USING ERRCODE = 'check_violation';
  END IF;

  /* ⛔ EL GUARDIA QUE FALTABA. Revocar ya lo exigía; otorgar no, así que
     se podía DAR lo que no se podía QUITAR. */
  PERFORM identidad.exigir_admin_de(p_persona);

  v_techo := LEAST(COALESCE(p_nivel_max, v_rol.nivel_maximo), v_rol.nivel_maximo);
  IF v_techo > plataforma.ctx_nivel_max() THEN
    RAISE EXCEPTION 'No puede otorgar nivel N%: su propio techo es N%.',
      v_techo, plataforma.ctx_nivel_max() USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO identidad.asignaciones
    (persona_id, rol, alcance_tipo, alcance_id, nivel_max,
     vigente_desde, vigente_hasta, otorgado_por, acta_referencia)
  VALUES (p_persona, p_rol, COALESCE(p_alcance, v_rol.alcance_maximo::text)::identidad.tipo_alcance,
          p_alcance_id, v_techo, COALESCE(p_desde, CURRENT_DATE), p_hasta,
          v_quien, btrim(p_acta))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'rol', p_rol, 'nivel_max', v_techo,
                            'alcance_tipo', COALESCE(p_alcance, v_rol.alcance_maximo::text),
                            'otorgado_por', v_quien);
END $$;

REVOKE ALL ON FUNCTION identidad.otorgar_asignacion(uuid, text, text, uuid, smallint, text, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identidad.otorgar_asignacion(uuid, text, text, uuid, smallint, text, date, date) TO casaroca_app;
GRANT EXECUTE ON FUNCTION identidad.anchura_de_alcance(text) TO casaroca_app;

COMMIT;
