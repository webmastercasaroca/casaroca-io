-- =====================================================================
-- Migración 0031 — LA TERCERA FUGA: las tablas hijas sin RLS
--
-- Hallazgo del 11 de septiembre de 2026, medido contra la base corriendo.
--
-- La segunda cerradura (0008) se puso sobre las tablas "cabeza": personas,
-- grupos, casos, servicios, cohortes, aportes. Pero las tablas HIJAS —las
-- que guardan a quién se inscribió, quién asistió, quién es acudiente de
-- quién— se quedaron sin política. Y `casaroca_app` sí tiene SELECT sobre
-- ellas.
--
-- La prueba que lo destapó: la sede de Chía, que no tiene UNA sola persona
-- registrada, veía los mismos certificados de aporte e inscripciones de
-- formación que Bogotá Chicó. El banco de pruebas no lo detectó porque
-- probaba las tablas cabeza, que sí estaban protegidas.
--
-- Es el mismo patrón que la fuga de las vistas (0025): el control se puso
-- donde se estaba mirando, no donde estaban todos los datos.
--
-- Dos arreglos aquí:
--   A. RLS sobre las 16 tablas hijas con datos de persona.
--   B. Quitarle a la aplicación la escritura sobre los catálogos que
--      definen los permisos. Medido: con app.nivel_max=1, la app reescribió
--      las 173 filas de sistema.matriz_permisos poniéndose nivel_max=4.
--      Es decir, podía subirse su propio techo de acceso.
-- =====================================================================


-- =====================================================================
-- A1 · Tablas que llevan sede_id propio: predicado directo.
-- =====================================================================

CREATE OR REPLACE FUNCTION plataforma.proteger_por_sede(p_tabla regclass)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE n text := p_tabla::text;
        s text := replace(replace(n,'.','_'),'"','');
BEGIN
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', n);
  EXECUTE format('ALTER TABLE %s FORCE  ROW LEVEL SECURITY', n);
  EXECUTE format($f$CREATE POLICY %I ON %s FOR SELECT
                    USING (plataforma.sede_visible(sede_id))$f$, s||'_sel', n);
  EXECUTE format($f$CREATE POLICY %I ON %s FOR INSERT
                    WITH CHECK (plataforma.sede_visible(sede_id))$f$, s||'_ins', n);
  EXECUTE format($f$CREATE POLICY %I ON %s FOR UPDATE
                    USING (plataforma.sede_visible(sede_id))
                    WITH CHECK (plataforma.sede_visible(sede_id))$f$, s||'_upd', n);
END $$;

COMMENT ON FUNCTION plataforma.proteger_por_sede(regclass) IS
  'Aplica la segunda cerradura a una tabla que lleva sede_id propio. Sin contexto de sede, cero filas.';

SELECT plataforma.proteger_por_sede('aportes.certificados');
SELECT plataforma.proteger_por_sede('aportes.cierres_control');
SELECT plataforma.proteger_por_sede('sistema.modulos_sede');
SELECT plataforma.proteger_por_sede('sistema.bitacora_aprovisionamiento');


-- =====================================================================
-- A2 · Tablas hijas: heredan la visibilidad de su padre.
--
-- La política no repite el filtro de sede: pregunta si el padre es
-- visible. Como el padre tiene RLS, el EXISTS ya viene filtrado. Una sola
-- fuente de verdad — si mañana cambia la regla de sede, cambia en un sitio.
-- =====================================================================

CREATE OR REPLACE FUNCTION plataforma.proteger_por_padre(
  p_tabla regclass, p_columna text, p_padre regclass)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE n text := p_tabla::text;
        s text := replace(replace(n,'.','_'),'"','');
        pred text := format('EXISTS (SELECT 1 FROM %s p WHERE p.id = %I)', p_padre::text, p_columna);
BEGIN
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', n);
  EXECUTE format('ALTER TABLE %s FORCE  ROW LEVEL SECURITY', n);
  EXECUTE format('CREATE POLICY %I ON %s FOR SELECT USING (%s)', s||'_sel', n, pred);
  EXECUTE format('CREATE POLICY %I ON %s FOR INSERT WITH CHECK (%s)', s||'_ins', n, pred);
  EXECUTE format('CREATE POLICY %I ON %s FOR UPDATE USING (%s) WITH CHECK (%s)', s||'_upd', n, pred, pred);
END $$;

COMMENT ON FUNCTION plataforma.proteger_por_padre(regclass,text,regclass) IS
  'La fila hija se ve si y solo si su padre se ve. El padre ya tiene RLS: el EXISTS hereda el filtro.';

-- Asistencia: la entrada y el conteo cuelgan del servicio
SELECT plataforma.proteger_por_padre('asistencia.entradas',      'servicio_id', 'asistencia.servicios');
SELECT plataforma.proteger_por_padre('asistencia.conteos',       'servicio_id', 'asistencia.servicios');

-- Grupos: membresías y reuniones cuelgan del grupo; los miembros, del hogar
SELECT plataforma.proteger_por_padre('grupos.membresias',        'grupo_id',    'grupos.grupos');
SELECT plataforma.proteger_por_padre('grupos.reuniones',         'grupo_id',    'grupos.grupos');
SELECT plataforma.proteger_por_padre('grupos.hogar_miembros',    'hogar_id',    'grupos.hogares');

-- Formación: la inscripción cuelga de la cohorte; el certificado, de la inscripción
SELECT plataforma.proteger_por_padre('formacion.inscripciones',  'cohorte_id',  'formacion.cohortes');
SELECT plataforma.proteger_por_padre('formacion.certificados',   'inscripcion_id','formacion.inscripciones');

-- Consejería: la asignación cuelga del caso, que ya está anclado al pastor (0030)
SELECT plataforma.proteger_por_padre('consejeria.asignaciones',  'caso_id',     'consejeria.casos');

-- RocaKids: lo más sensible del sistema. Todo cuelga del menor o del checkin.
SELECT plataforma.proteger_por_padre('rocakids.inscripciones',   'menor_id',    'nucleo.personas');
SELECT plataforma.proteger_por_padre('rocakids.autorizaciones',  'menor_id',    'nucleo.personas');
SELECT plataforma.proteger_por_padre('rocakids.intentos_entrega','checkin_id',  'rocakids.checkins');

-- Núcleo: el vínculo familiar se ve si se ve la persona de la que cuelga
SELECT plataforma.proteger_por_padre('nucleo.vinculos',          'persona_id',  'nucleo.personas');


-- =====================================================================
-- B · La aplicación NO configura sus propios permisos.
--
-- Estos catálogos los escribe la consola de sistemas o una migración con
-- acta de respaldo, nunca el rol con el que corre la API. Dejarle UPDATE
-- sobre la matriz de permisos convierte el techo de sensibilidad en una
-- sugerencia: la app se lo sube sola.
-- =====================================================================

REVOKE INSERT, UPDATE, DELETE ON sistema.matriz_permisos        FROM casaroca_app;
REVOKE INSERT, UPDATE, DELETE ON sistema.plantilla_modulos      FROM casaroca_app;
REVOKE INSERT, UPDATE, DELETE ON sistema.plantillas             FROM casaroca_app;
REVOKE INSERT, UPDATE, DELETE ON sistema.modulos                FROM casaroca_app;
REVOKE INSERT, UPDATE, DELETE ON sistema.acciones               FROM casaroca_app;
REVOKE INSERT, UPDATE, DELETE ON identidad.roles                FROM casaroca_app;
REVOKE INSERT, UPDATE, DELETE ON plataforma.niveles_sensibilidad FROM casaroca_app;
REVOKE INSERT, UPDATE, DELETE ON plataforma.clasificacion_columna FROM casaroca_app;


-- =====================================================================
-- C · El control que impide que esto vuelva a pasar.
--
-- No basta con tapar las 16 de hoy. Esta vista deja a la vista cualquier
-- tabla futura que quede legible por la app sin una sola política.
-- =====================================================================

CREATE OR REPLACE VIEW plataforma.v_control_rls
WITH (security_invoker = true) AS
SELECT n.nspname                                   AS esquema,
       c.relname                                   AS tabla,
       c.relrowsecurity                            AS rls_activo,
       (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS politicas,
       has_table_privilege('casaroca_app', c.oid, 'SELECT') AS la_app_la_lee
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r'
  AND n.nspname IN ('nucleo','org','crm','identidad','plataforma','grupos',
                    'asistencia','rocakids','consejeria','aportes','formacion',
                    'talento','sistema')
  AND NOT c.relispartition;

COMMENT ON VIEW plataforma.v_control_rls IS
  'Toda tabla con la_app_la_lee=true y politicas=0 es una fuga potencial. Revisar en cada corte.';

GRANT SELECT ON plataforma.v_control_rls TO casaroca_app;
