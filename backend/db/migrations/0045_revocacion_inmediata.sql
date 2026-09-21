-- =====================================================================
-- Migración 0045 — REVOCAR UN ACCESO ES AHORA, NO MAÑANA
--
-- ⛔ EL PROBLEMA, QUE APARECIÓ AL PROBAR. La vigencia de un permiso se
--    guardaba solo con FECHAS (`vigente_hasta date`, `hasta date`). Con
--    eso, quitarle el acceso a alguien tiene dos salidas y las dos están mal:
--
--      · `hasta = hoy`   → sigue teniendo acceso todo el día de hoy.
--      · `hasta = ayer`  → la base lo rechaza, porque la fecha de salida
--                          quedaría antes de la de entrada si entró hoy.
--
--    Y el caso que importa es justo ese: a las 10:00 de la mañana se saca a
--    alguien del equipo de Finanzas por un problema, y a las 10:01 tiene que
--    estar fuera. No mañana. Una fecha no puede expresar «ahora».
--
-- ⭐ LA SOLUCIÓN: la fecha se queda para el registro humano («estuvo en el
--    equipo del 3 de marzo al 19 de septiembre») y se añade un instante de
--    revocación que manda sobre todo. Y la función `sacar_del_equipo()`
--    hace lo correcto de una sola forma, para que nadie tenga que recordar
--    poner las dos cosas.
--
-- ⛔ Aplica también a `identidad.asignaciones`, la tabla de permisos
--    personales que ya existía desde la migración 0006 y que tenía
--    exactamente el mismo hueco.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · EL INSTANTE MANDA SOBRE LA FECHA
-- ---------------------------------------------------------------------
ALTER TABLE identidad.asignaciones      ADD COLUMN revocada_en timestamptz;
ALTER TABLE identidad.asignaciones      ADD COLUMN revocada_por uuid REFERENCES nucleo.personas(id);
ALTER TABLE identidad.asignaciones      ADD COLUMN motivo_revocacion text;
ALTER TABLE identidad.asignaciones_unidad ADD COLUMN revocada_en timestamptz;
ALTER TABLE identidad.asignaciones_unidad ADD COLUMN revocada_por uuid REFERENCES nucleo.personas(id);
ALTER TABLE identidad.asignaciones_unidad ADD COLUMN motivo_revocacion text;
ALTER TABLE org.unidad_miembros         ADD COLUMN revocado_en timestamptz;
ALTER TABLE org.unidad_miembros         ADD COLUMN revocado_por uuid REFERENCES nucleo.personas(id);

COMMENT ON COLUMN identidad.asignaciones.revocada_en IS
  'Instante exacto en que se corto el acceso. Manda sobre vigente_hasta: una fecha no puede decir «ahora».';

-- Los índices de unicidad ahora excluyen lo revocado.
DROP INDEX IF EXISTS org.unidad_miembro_uq;
CREATE UNIQUE INDEX unidad_miembro_uq ON org.unidad_miembros (unidad_id, persona_id)
  WHERE hasta IS NULL AND revocado_en IS NULL;

-- ---------------------------------------------------------------------
-- 2 · EL PERMISO EFECTIVO RESPETA LA REVOCACIÓN
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW identidad.v_permiso_efectivo AS
SELECT a.persona_id, a.rol, a.alcance_tipo, a.alcance_id,
       LEAST(a.nivel_max, r.nivel_maximo) AS nivel_efectivo,
       (a.revocada_en IS NULL
        AND a.vigente_desde <= CURRENT_DATE
        AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)) AS vigente,
       'directo'::text AS origen,
       NULL::uuid      AS unidad_id
FROM identidad.asignaciones a
JOIN identidad.roles r ON r.codigo = a.rol

UNION ALL

SELECT m.persona_id, au.rol, au.alcance_tipo, au.alcance_id,
       LEAST(au.nivel_max, r.nivel_maximo) AS nivel_efectivo,
       (au.revocada_en IS NULL
        AND m.revocado_en IS NULL
        AND au.vigente_desde <= CURRENT_DATE
        AND (au.vigente_hasta IS NULL OR au.vigente_hasta >= CURRENT_DATE)
        AND m.desde <= CURRENT_DATE
        AND (m.hasta IS NULL OR m.hasta >= CURRENT_DATE)) AS vigente,
       'equipo'::text AS origen,
       au.unidad_id
FROM identidad.asignaciones_unidad au
JOIN org.unidad_miembros m ON m.unidad_id = au.unidad_id
JOIN identidad.roles r ON r.codigo = au.rol;

-- ---------------------------------------------------------------------
-- 3 · LAS FUNCIONES QUE HACEN LO CORRECTO DE UNA SOLA FORMA
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION org.meter_en_equipo(
  p_unidad uuid, p_persona uuid, p_rol_en_unidad text DEFAULT 'integrante', p_desde date DEFAULT CURRENT_DATE
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO org.unidad_miembros (unidad_id, persona_id, rol_en_unidad, desde)
  VALUES (p_unidad, p_persona, p_rol_en_unidad, p_desde)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION org.sacar_del_equipo(
  p_unidad uuid, p_persona uuid, p_motivo text, p_quien uuid DEFAULT NULL
) RETURNS int LANGUAGE plpgsql AS $$
DECLARE v int;
BEGIN
  IF p_motivo IS NULL OR length(trim(p_motivo)) < 5 THEN
    RAISE EXCEPTION 'Sacar a alguien de un equipo exige un motivo escrito' USING ERRCODE='check_violation';
  END IF;
  UPDATE org.unidad_miembros
     SET revocado_en = now(), revocado_por = p_quien,
         hasta = GREATEST(CURRENT_DATE, desde),
         motivo_salida = p_motivo
   WHERE unidad_id = p_unidad AND persona_id = p_persona
     AND hasta IS NULL AND revocado_en IS NULL;
  GET DIAGNOSTICS v = ROW_COUNT;
  IF v = 0 THEN
    RAISE EXCEPTION 'Esa persona no esta vigente en ese equipo' USING ERRCODE='no_data_found';
  END IF;
  RETURN v;
END $$;

COMMENT ON FUNCTION org.sacar_del_equipo IS
  'Corta el acceso en el instante, deja la fecha para el registro y exige motivo. Es el unico camino: un UPDATE a mano deja el acceso vivo hasta manana.';

CREATE OR REPLACE FUNCTION identidad.revocar_asignacion(
  p_asignacion uuid, p_motivo text, p_quien uuid DEFAULT NULL
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_motivo IS NULL OR length(trim(p_motivo)) < 5 THEN
    RAISE EXCEPTION 'Revocar un permiso exige un motivo escrito' USING ERRCODE='check_violation';
  END IF;
  UPDATE identidad.asignaciones
     SET revocada_en = now(), revocada_por = p_quien, motivo_revocacion = p_motivo,
         vigente_hasta = GREATEST(CURRENT_DATE, vigente_desde)
   WHERE id = p_asignacion AND revocada_en IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La asignacion no existe o ya estaba revocada' USING ERRCODE='no_data_found';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 4 · RECERTIFICACIÓN · qué accesos llevan demasiado tiempo sin revisar
--     (checklist B4.17: revision trimestral con evidencia de quien reviso)
-- ---------------------------------------------------------------------
CREATE TABLE identidad.recertificaciones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asignacion_id uuid REFERENCES identidad.asignaciones(id),
  asignacion_unidad_id uuid REFERENCES identidad.asignaciones_unidad(id),
  revisada_en   timestamptz NOT NULL DEFAULT now(),
  revisada_por  uuid NOT NULL REFERENCES nucleo.personas(id),
  veredicto     text NOT NULL CHECK (veredicto IN ('se_mantiene','se_reduce','se_revoca')),
  nota          text,
  CONSTRAINT recert_una_sola CHECK (num_nonnulls(asignacion_id, asignacion_unidad_id) = 1)
);
CREATE INDEX recert_asig_idx ON identidad.recertificaciones (asignacion_id, revisada_en DESC);
CREATE RULE recert_no_update AS ON UPDATE TO identidad.recertificaciones DO INSTEAD NOTHING;
CREATE RULE recert_no_delete AS ON DELETE TO identidad.recertificaciones DO INSTEAD NOTHING;

CREATE OR REPLACE VIEW identidad.v_accesos_por_recertificar
WITH (security_invoker = true) AS
SELECT a.id AS asignacion_id, a.persona_id,
       p.primer_nombre||' '||p.primer_apellido AS persona,
       a.rol, a.alcance_tipo, a.nivel_max, a.vigente_desde,
       (SELECT max(revisada_en) FROM identidad.recertificaciones r WHERE r.asignacion_id = a.id) AS ultima_revision,
       COALESCE(
         (CURRENT_DATE - (SELECT max(revisada_en) FROM identidad.recertificaciones r WHERE r.asignacion_id = a.id)::date),
         (CURRENT_DATE - a.vigente_desde)) AS dias_sin_revisar,
       CASE WHEN a.nivel_max >= 3 THEN 90 ELSE 180 END AS tope_dias
FROM identidad.asignaciones a
JOIN nucleo.personas p ON p.id = a.persona_id
WHERE a.revocada_en IS NULL
  AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE);

COMMENT ON VIEW identidad.v_accesos_por_recertificar IS
  'Un acceso N3 o N4 sin revisar en 90 dias es un hallazgo de auditoria. Esta vista es la lista de trabajo del comite trimestral.';

SELECT plataforma.publicar_tabla('identidad.recertificaciones'::regclass, 'por_persona',
  'Evidencia de quien reviso cada acceso y con que veredicto. Se lee para auditar; nadie la altera.',
  'Mesa tecnica 100p', true);
GRANT SELECT ON identidad.v_accesos_por_recertificar TO casaroca_app;

-- ---------------------------------------------------------------------
-- 5 · `sedes_de` COMPLETA · los seis alcances, y la herencia de equipo
--
-- ⛔ LO QUE PASÓ Y POR QUÉ QUEDA ESCRITO. Al añadir el alcance «unidad»
--    en la migración 0044 se reemplazó esta función partiendo de la
--    versión de 0006, y se perdieron sin ruido los alcances de SEGMENTO,
--    GRUPO y MINISTERIO que había añadido la 0029. El banco lo cazó en la
--    corrida siguiente («El director de segmento resuelve a UNA sede»),
--    pero la lección es la que importa: un CREATE OR REPLACE sobre una
--    función que otra migración ya había ampliado la deja como estaba
--    ANTES de esa ampliación. Aquí queda la versión completa, con los seis
--    alcances en un solo sitio.
--
-- ⛔ SECURITY DEFINER es deliberado y NO es un descuido: esta función se
--    llama DESDE las políticas de seguridad por fila. Si corriera como el
--    invocador, leer `identidad.asignaciones` dispararía otra vez la
--    política y entraría en recursión.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW identidad.v_permiso_efectivo
WITH (security_invoker = true) AS
SELECT a.persona_id, a.rol, a.alcance_tipo, a.alcance_id,
       LEAST(a.nivel_max, r.nivel_maximo) AS nivel_efectivo,
       (a.revocada_en IS NULL
        AND a.vigente_desde <= CURRENT_DATE
        AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)) AS vigente,
       'directo'::text AS origen, NULL::uuid AS unidad_id
FROM identidad.asignaciones a
JOIN identidad.roles r ON r.codigo = a.rol
UNION ALL
SELECT m.persona_id, au.rol, au.alcance_tipo, au.alcance_id,
       LEAST(au.nivel_max, r.nivel_maximo) AS nivel_efectivo,
       (au.revocada_en IS NULL AND m.revocado_en IS NULL
        AND au.vigente_desde <= CURRENT_DATE
        AND (au.vigente_hasta IS NULL OR au.vigente_hasta >= CURRENT_DATE)
        AND m.desde <= CURRENT_DATE
        AND (m.hasta IS NULL OR m.hasta >= CURRENT_DATE)) AS vigente,
       'equipo'::text AS origen, au.unidad_id
FROM identidad.asignaciones_unidad au
JOIN org.unidad_miembros m ON m.unidad_id = au.unidad_id
JOIN identidad.roles r ON r.codigo = au.rol;

CREATE OR REPLACE FUNCTION identidad.sedes_de(p_persona_id uuid) RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT COALESCE(array_agg(DISTINCT sede), '{}'::uuid[]) FROM (
    -- 1 · organizacion: toda la red
    SELECT s.id AS sede
    FROM identidad.v_permiso_efectivo pe CROSS JOIN org.sedes s
    WHERE pe.persona_id = p_persona_id AND pe.vigente AND pe.alcance_tipo = 'organizacion'
    UNION
    -- 2 · sede: la suya
    SELECT pe.alcance_id
    FROM identidad.v_permiso_efectivo pe
    WHERE pe.persona_id = p_persona_id AND pe.vigente AND pe.alcance_tipo = 'sede'
    UNION
    -- 3 · segmento: la sede del segmento
    SELECT g.sede_id
    FROM identidad.v_permiso_efectivo pe JOIN org.segmentos g ON g.id = pe.alcance_id
    WHERE pe.persona_id = p_persona_id AND pe.vigente AND pe.alcance_tipo = 'segmento'
    UNION
    -- 4 · grupo: la sede del grupo
    SELECT gr.sede_id
    FROM identidad.v_permiso_efectivo pe JOIN grupos.grupos gr ON gr.id = pe.alcance_id
    WHERE pe.persona_id = p_persona_id AND pe.vigente AND pe.alcance_tipo = 'grupo'
    UNION
    -- 5 · ministerio: las sedes donde ese ministerio esta encendido
    SELECT ms.sede_id
    FROM identidad.v_permiso_efectivo pe JOIN org.ministerios_sede ms ON ms.ministerio_id = pe.alcance_id
    WHERE pe.persona_id = p_persona_id AND pe.vigente AND pe.alcance_tipo = 'ministerio' AND ms.activo
    UNION
    -- 6 · unidad: las sedes que cuelgan de esa unidad y de todo lo de abajo
    SELECT unnest(org.sedes_de_unidad(pe.alcance_id))
    FROM identidad.v_permiso_efectivo pe
    WHERE pe.persona_id = p_persona_id AND pe.vigente AND pe.alcance_tipo = 'unidad'
      AND pe.alcance_id IS NOT NULL
  ) t WHERE sede IS NOT NULL;
$$;

COMMENT ON FUNCTION identidad.sedes_de IS
  'Los SEIS alcances: organizacion, sede, segmento, grupo, ministerio y unidad; y suma lo heredado de los equipos. Es la fuente de app.sede_ids.';

-- Las vistas nuevas de 0044 también declaran security_invoker.
ALTER VIEW org.v_organigrama              SET (security_invoker = true);
ALTER VIEW identidad.v_quien_tiene_que    SET (security_invoker = true);
ALTER VIEW identidad.v_accesos_por_recertificar SET (security_invoker = true);
ALTER VIEW nucleo.v_membresias_actuales   SET (security_invoker = true);
ALTER VIEW nucleo.v_traslados             SET (security_invoker = true);
ALTER VIEW plataforma.v_salud_particiones SET (security_invoker = true);
ALTER VIEW plataforma.v_ultimo_mantenimiento SET (security_invoker = true);
ALTER VIEW plataforma.v_control_rls       SET (security_invoker = true);
ALTER VIEW plataforma.v_control_permisos  SET (security_invoker = true);

-- ---------------------------------------------------------------------
-- 6 · La política de recertificaciones, que `publicar_tabla` en modo
--     `por_persona` deja encendida pero sin escribir: sin política, la
--     tabla queda con seguridad por fila activa y CERO filas visibles.
--     No es una fuga, es algo peor de diagnosticar: una funcionalidad
--     que no devuelve nada y nadie sabe por qué.
-- ---------------------------------------------------------------------
CREATE POLICY recert_sel ON identidad.recertificaciones FOR SELECT
  USING (
    plataforma.ctx_es_global()
    OR revisada_por = plataforma.ctx_persona_id()
    OR EXISTS (SELECT 1 FROM identidad.asignaciones a
               JOIN nucleo.personas p ON p.id = a.persona_id
               WHERE a.id = identidad.recertificaciones.asignacion_id
                 AND plataforma.sede_visible(p.sede_id))
  );
CREATE POLICY recert_ins ON identidad.recertificaciones FOR INSERT
  WITH CHECK (plataforma.ctx_es_global() OR revisada_por = plataforma.ctx_persona_id());
