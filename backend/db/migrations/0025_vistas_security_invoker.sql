-- =====================================================================
-- Migración 0025 — LA FUGA MÁS GRAVE: LAS VISTAS SE SALTABAN EL RLS
--
-- Lo destapó la prueba de extremo a extremo de la API: el pastor de
-- Medellín veía un registro de Bogotá Norte. El esquema estaba bien; el
-- agujero estaba en un comportamiento de PostgreSQL que no perdona:
--
--   Una vista se ejecuta con los permisos de SU PROPIETARIO, no con los
--   de quien la consulta. Nuestras vistas las creó `postgres`, que es
--   superusuario — y un superusuario salta RLS SIEMPRE. Resultado: toda
--   consulta hecha a través de una vista devolvía filas de todas las
--   sedes, en silencio y sin ningún error.
--
-- Por qué las pruebas no lo vieron: el banco de aislamiento consulta las
-- TABLAS directamente, y ahí RLS sí aplicaba. La API consulta VISTAS.
-- La lección va escrita aquí porque se va a repetir con cada vista nueva:
--
--   ⛔ TODA vista sobre una tabla con RLS necesita `security_invoker`.
--
-- Desde PostgreSQL 15 se puede pedir que la vista corra con los permisos
-- de quien la llama, que es lo que se quería desde el principio.
-- =====================================================================

DO $$
DECLARE v record; n int := 0;
BEGIN
  FOR v IN
    SELECT n.nspname AS esquema, c.relname AS vista
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'v'
      AND n.nspname IN ('plataforma','org','nucleo','identidad','crm','grupos',
                        'asistencia','rocakids','consejeria','aportes','formacion',
                        'talento','sistema')
  LOOP
    EXECUTE format('ALTER VIEW %I.%I SET (security_invoker = true)', v.esquema, v.vista);
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'security_invoker activado en % vistas', n;
END
$$;

-- ---------------------------------------------------------------------
-- El control, para que esto no vuelva a pasar sin avisar.
-- Una fila aquí es una vista que puede estar filtrando datos entre sedes.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW plataforma.v_control_vistas AS
SELECT n.nspname AS esquema, c.relname AS vista
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'v'
  AND n.nspname IN ('plataforma','org','nucleo','identidad','crm','grupos',
                    'asistencia','rocakids','consejeria','aportes','formacion',
                    'talento','sistema')
  AND NOT COALESCE(
        (SELECT option_value::boolean FROM pg_options_to_table(c.reloptions)
          WHERE option_name = 'security_invoker'), false)
ORDER BY 1,2;

COMMENT ON VIEW plataforma.v_control_vistas IS
  'Vistas SIN security_invoker. Debe dar cero filas: cada una se ejecuta con los permisos de su propietario y puede saltarse el aislamiento entre sedes.';

GRANT SELECT ON plataforma.v_control_vistas TO casaroca_app;

-- Las vistas de control se crean después del bucle, así que se marcan aquí.
ALTER VIEW plataforma.v_control_vistas   SET (security_invoker = true);
ALTER VIEW plataforma.v_control_permisos SET (security_invoker = true);

ALTER VIEW plataforma.v_control_secuencias SET (security_invoker = true);
