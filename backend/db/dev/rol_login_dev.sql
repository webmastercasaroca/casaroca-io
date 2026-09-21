-- =====================================================================
-- SOLO DESARROLLO. No forma parte de las migraciones.
--
-- Los roles del sistema son de grupo y nacen NOLOGIN a propósito. Para
-- que la API pueda conectarse en la máquina de desarrollo hace falta un
-- rol con login que herede de casaroca_app.
--
-- ⛔ En producción esta credencial la emite el gestor de secretos y la
--    contraseña jamás vive en un archivo del repositorio.
-- =====================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='casaroca_api_dev') THEN
    CREATE ROLE casaroca_api_dev LOGIN INHERIT NOBYPASSRLS;
  END IF;
END $$;
GRANT casaroca_app TO casaroca_api_dev;
