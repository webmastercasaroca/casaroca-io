-- =====================================================================
-- Seed 021 — QUÉ ROLES EXIGEN ANTECEDENTES
--
-- El contenido de la migración 0049. Va aquí porque `identidad.roles` se
-- siembra después de las migraciones.
-- =====================================================================
INSERT INTO identidad.roles_con_menores (rol, motivo)
SELECT v.rol, v.motivo
FROM (VALUES
 ('MAESTRO_ROCAKIDS', 'Esta a solas con ninos en una sala.'),
 ('DIRECTOR_ROCAKIDS','Dirige el ministerio de ninos y accede a sus datos de salud.')
) AS v(rol, motivo)
JOIN identidad.roles r ON r.codigo = v.rol
ON CONFLICT (rol) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM identidad.roles_con_menores;
  RAISE NOTICE 'Roles que exigen antecedentes de salvaguarda: %', n;
END $$;
