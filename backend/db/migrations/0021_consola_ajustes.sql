-- =====================================================================
-- Migración 0021 — Ajuste al tablero de iglesias
-- El conteo de personas con rol ignoraba las asignaciones de ALCANCE DE
-- ORGANIZACIÓN, y por eso la sede maestra aparecía con cero roles — que
-- es justo lo contrario de la verdad: quien tiene alcance global manda
-- en todas las sedes, empezando por ella.
-- =====================================================================

CREATE OR REPLACE VIEW sistema.v_iglesias AS
SELECT s.id, s.codigo, s.nombre, s.tipo, s.pais, s.ciudad, s.activa, s.ola_migracion,
       (s.tipo = 'sede_madre') AS es_maestra,
       count(*) FILTER (WHERE ms.activo)     AS modulos_activos,
       count(*) FILTER (WHERE NOT ms.activo) AS modulos_apagados,
       count(*) FILTER (WHERE NOT ms.activo AND m.exige_compuerta_legal) AS esperando_compuerta_legal,
       (SELECT count(*) FROM identidad.asignaciones a
         WHERE (a.alcance_tipo = 'organizacion' OR (a.alcance_tipo = 'sede' AND a.alcance_id = s.id))
           AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)) AS personas_con_rol
FROM org.sedes s
LEFT JOIN sistema.modulos_sede ms ON ms.sede_id = s.id
LEFT JOIN sistema.modulos m ON m.codigo = ms.modulo
GROUP BY s.id;
