-- =====================================================================
-- Migración 0029 — QUE EL ALCANCE «SEGMENTO» FUNCIONE DE VERDAD
--
-- Añadir el valor al tipo no basta: hay tres sitios que decidían qué
-- hacer con cada alcance y no lo conocían. Si se olvidara alguno, un
-- director de segmento quedaría sin ver nada — o, peor, viéndolo todo.
-- =====================================================================

-- 1 · El alcance de segmento EXIGE su identificador, como sede o grupo.
ALTER TABLE identidad.asignaciones DROP CONSTRAINT asignacion_alcance_identificado;
ALTER TABLE identidad.asignaciones ADD CONSTRAINT asignacion_alcance_identificado CHECK (
  (alcance_tipo IN ('organizacion','caso_propio','persona_propia') AND alcance_id IS NULL)
  OR (alcance_tipo IN ('sede','ministerio','segmento','grupo') AND alcance_id IS NOT NULL)
);

-- 2 · La resolución de sedes tiene que saber llegar desde un segmento.
--     Un director de segmento opera en la sede de su segmento, no en
--     ninguna otra. Sin esta rama, `sedes_de` devolvía vacío y la
--     persona no veía absolutamente nada.
CREATE OR REPLACE FUNCTION identidad.sedes_de(p_persona_id uuid) RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT COALESCE(array_agg(DISTINCT sede), '{}'::uuid[]) FROM (
    -- alcance de organización: todas las sedes
    SELECT s.id AS sede
    FROM identidad.asignaciones a CROSS JOIN org.sedes s
    WHERE a.persona_id = p_persona_id AND a.alcance_tipo = 'organizacion'
      AND a.vigente_desde <= CURRENT_DATE
      AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)
    UNION
    -- alcance de sede: la suya
    SELECT a.alcance_id
    FROM identidad.asignaciones a
    WHERE a.persona_id = p_persona_id AND a.alcance_tipo = 'sede'
      AND a.vigente_desde <= CURRENT_DATE
      AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)
    UNION
    -- alcance de segmento: la sede a la que pertenece el segmento
    SELECT g.sede_id
    FROM identidad.asignaciones a JOIN org.segmentos g ON g.id = a.alcance_id
    WHERE a.persona_id = p_persona_id AND a.alcance_tipo = 'segmento'
      AND a.vigente_desde <= CURRENT_DATE
      AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)
    UNION
    -- alcance de grupo: la sede del grupo
    SELECT gr.sede_id
    FROM identidad.asignaciones a JOIN grupos.grupos gr ON gr.id = a.alcance_id
    WHERE a.persona_id = p_persona_id AND a.alcance_tipo = 'grupo'
      AND a.vigente_desde <= CURRENT_DATE
      AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)
    UNION
    -- alcance de ministerio: las sedes donde ese ministerio está activo
    SELECT ms.sede_id
    FROM identidad.asignaciones a JOIN org.ministerios_sede ms ON ms.ministerio_id = a.alcance_id
    WHERE a.persona_id = p_persona_id AND a.alcance_tipo = 'ministerio' AND ms.activo
      AND a.vigente_desde <= CURRENT_DATE
      AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)
  ) t;
$$;

-- 3 · El tablero de permisos efectivos, con la misma resolución.
--     Se suelta y se recrea: CREATE OR REPLACE no admite insertar una
--     columna en medio, y `alcance_tipo` va en medio a propósito, junto
--     a lo demás que describe la asignación.
DROP VIEW sistema.v_permiso_efectivo;
CREATE VIEW sistema.v_permiso_efectivo AS
SELECT a.persona_id,
       s.id     AS sede_id,
       s.codigo AS sede,
       mp.rol, mp.modulo, m.nombre AS modulo_nombre, mp.accion,
       m.nivel_dato,
       LEAST(a.nivel_max, r.nivel_maximo) AS nivel_efectivo,
       a.alcance_tipo,
       ms.activo AS modulo_habilitado,
       (a.vigente_desde <= CURRENT_DATE
        AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)) AS asignacion_vigente,
       (ms.activo
        AND LEAST(a.nivel_max, r.nivel_maximo) >= m.nivel_dato
        AND a.vigente_desde <= CURRENT_DATE
        AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)) AS permitido
FROM identidad.asignaciones a
JOIN identidad.roles r          ON r.codigo = a.rol
JOIN sistema.matriz_permisos mp ON mp.rol = a.rol
JOIN sistema.modulos m          ON m.codigo = mp.modulo
JOIN org.sedes s ON (
      a.alcance_tipo = 'organizacion'
   OR (a.alcance_tipo = 'sede'      AND s.id = a.alcance_id)
   OR (a.alcance_tipo = 'segmento'  AND s.id = (SELECT sede_id FROM org.segmentos  WHERE id = a.alcance_id))
   OR (a.alcance_tipo = 'grupo'     AND s.id = (SELECT sede_id FROM grupos.grupos  WHERE id = a.alcance_id))
   OR (a.alcance_tipo = 'ministerio' AND EXISTS (SELECT 1 FROM org.ministerios_sede ms2
                                                  WHERE ms2.ministerio_id = a.alcance_id
                                                    AND ms2.sede_id = s.id AND ms2.activo)))
LEFT JOIN sistema.modulos_sede ms ON ms.sede_id = s.id AND ms.modulo = mp.modulo;

ALTER VIEW sistema.v_permiso_efectivo SET (security_invoker = true);
GRANT SELECT ON sistema.v_permiso_efectivo TO casaroca_app, casaroca_lectura;
