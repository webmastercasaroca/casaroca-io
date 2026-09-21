-- =====================================================================
-- Migración 0023 — LOS PERMISOS QUE LA CAPA DE PERMISOS NO SE DIO
--
-- Lo destapó la API al arrancar: `identidad.v_permiso_efectivo` nunca
-- recibió GRANT. La aplicación no podía averiguar quién era el usuario
-- que la estaba llamando, y el fallo salía como un 500 genérico.
--
-- Es un error fácil de cometer y difícil de ver: las migraciones
-- concedieron permisos sobre las TABLAS y se olvidaron de las VISTAS y
-- de las que se crearon después del `GRANT ... ON ALL TABLES`, que no es
-- retroactivo. Por eso, además del arreglo, queda un control que lo
-- muestra en una consulta en vez de en un error de producción.
-- =====================================================================

GRANT SELECT ON identidad.v_permiso_efectivo, identidad.roles TO casaroca_app, casaroca_lectura;
GRANT SELECT ON sistema.v_permiso_efectivo, sistema.v_iglesias, sistema.v_matriz,
                sistema.v_quien_exporta TO casaroca_app, casaroca_lectura;
GRANT SELECT ON nucleo.v_personas TO casaroca_app, casaroca_lectura;
GRANT SELECT ON plataforma.v_contactables, plataforma.v_control_clasificacion TO casaroca_app;
GRANT SELECT ON crm.v_bandeja_nuevos TO casaroca_app, casaroca_lectura;
GRANT SELECT ON asistencia.v_se_estan_enfriando TO casaroca_app;
GRANT SELECT ON talento.v_vinculo_con_la_organizacion TO casaroca_app;
GRANT SELECT ON rocakids.v_alertas_entrega TO casaroca_app;

-- Las SECUENCIAS son la otra mitad que se olvida siempre: una tabla con
-- `bigserial` no se puede insertar sin USAGE sobre su secuencia, y el
-- error sale como un 500 que no menciona la tabla.
DO $$
DECLARE e text;
BEGIN
  FOREACH e IN ARRAY ARRAY['plataforma','org','nucleo','identidad','crm','grupos',
                           'asistencia','rocakids','consejeria','aportes','formacion',
                           'talento','sistema'] LOOP
    EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA %I TO casaroca_app', e);
  END LOOP;
END
$$;

-- Que lo nuevo herede el permiso sin que nadie tenga que acordarse.
ALTER DEFAULT PRIVILEGES IN SCHEMA plataforma, org, nucleo, identidad, crm, grupos,
      asistencia, rocakids, consejeria, aportes, formacion, talento, sistema
  GRANT SELECT ON TABLES TO casaroca_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA plataforma, org, nucleo, identidad, crm, grupos,
      asistencia, rocakids, consejeria, aportes, formacion, talento, sistema
  GRANT USAGE, SELECT ON SEQUENCES TO casaroca_app;

-- Catálogos de la plataforma: son N0/N1 y la aplicación los necesita
-- para pintar etiquetas y validar. No exponen ningún dato de persona.
GRANT SELECT ON plataforma.niveles_sensibilidad, plataforma.finalidades,
                plataforma.clasificacion_columna TO casaroca_app, casaroca_lectura;

-- La vista de detalle por persona ya filtra por nivel y alcance dentro
-- de su propia definición, así que puede concederse.
GRANT SELECT ON aportes.v_detalle_por_persona TO casaroca_app;

-- ---------------------------------------------------------------------
-- ⛔ LO QUE SE DEJA DENEGADO A PROPÓSITO, y por qué.
--
-- `plataforma.auditoria` y `plataforma.bitacora_lectura` NO tienen RLS:
-- son append-only y globales. Concederle SELECT a la aplicación
-- significaría que cualquier sesión puede leer la auditoría entera de
-- las 36 sedes — justo lo contrario de lo que la auditoría existe para
-- garantizar.
--
-- Se sirven, cuando haga falta, por una función SECURITY DEFINER que
-- reciba el alcance y lo aplique. Mientras esa función no exista, el
-- acceso queda cerrado, que es el lado correcto en el que equivocarse.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- El control: qué tablas y vistas NO puede leer la aplicación.
-- Una fila aquí es un 500 esperando a ocurrir.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW plataforma.v_control_permisos AS
SELECT c.table_schema AS esquema,
       c.table_name   AS objeto,
       c.table_type   AS tipo
FROM information_schema.tables c
WHERE c.table_schema IN ('plataforma','org','nucleo','identidad','crm','grupos',
                         'asistencia','rocakids','consejeria','aportes','formacion',
                         'talento','sistema')
  AND NOT has_table_privilege('casaroca_app', c.table_schema||'.'||quote_ident(c.table_name), 'SELECT')
  -- Las particiones se consultan por su tabla padre: el permiso del
  -- padre basta y darles GRANT propio solo añadiría superficie.
  AND NOT EXISTS (SELECT 1 FROM pg_inherits i
                   JOIN pg_class hijo ON hijo.oid = i.inhrelid
                   JOIN pg_namespace n ON n.oid = hijo.relnamespace
                   WHERE n.nspname = c.table_schema AND hijo.relname = c.table_name)
  -- Denegados por decisión, no por olvido (ver el bloque de arriba).
  AND (c.table_schema, c.table_name) NOT IN (
        ('plataforma','auditoria'), ('plataforma','bitacora_lectura'),
        ('plataforma','v_quien_vio'))
ORDER BY 1,2;

-- Las secuencias también: sin USAGE, un INSERT falla con un mensaje que
-- no dice qué tabla lo causó.
-- El `OFFSET 0` no es adorno: sin esa barrera el planificador puede
-- evaluar has_sequence_privilege() ANTES del filtro por relkind, y
-- tropieza con tablas TOAST que no son secuencias.
CREATE OR REPLACE VIEW plataforma.v_control_secuencias AS
SELECT esquema, secuencia FROM (
  SELECT n.nspname AS esquema, c.relname AS secuencia, c.oid
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind = 'S'
    AND n.nspname IN ('plataforma','org','nucleo','identidad','crm','grupos',
                      'asistencia','rocakids','consejeria','aportes','formacion',
                      'talento','sistema')
  OFFSET 0
) s
WHERE NOT has_sequence_privilege('casaroca_app', s.oid, 'USAGE')
ORDER BY 1,2;

COMMENT ON VIEW plataforma.v_control_secuencias IS
  'Secuencias sin USAGE para la aplicación. Debe dar cero filas: cada una es un INSERT que va a fallar.';

GRANT SELECT ON plataforma.v_control_secuencias TO casaroca_app;

COMMENT ON VIEW plataforma.v_control_permisos IS
  'Objetos que la aplicación no puede leer. Debe dar cero filas: cada una es un error 500 que todavía no ha ocurrido.';

GRANT SELECT ON plataforma.v_control_permisos TO casaroca_app;
