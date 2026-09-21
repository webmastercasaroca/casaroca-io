-- =====================================================================
-- Migración 0042 — TODA TABLA NUEVA NACE CERRADA
--
-- ⛔ LA CAUSA RAÍZ DE LAS DOS FUGAS. La migración 0023 dejó escrito:
--
--       «Que lo nuevo herede el permiso sin que nadie tenga que acordarse.»
--       ALTER DEFAULT PRIVILEGES ... GRANT SELECT ON TABLES TO casaroca_app;
--
--    La intención era buena y el efecto es el contrario: **toda tabla que
--    nazca en cualquiera de los 13 esquemas queda legible por la aplicación
--    automáticamente**. Si quien la crea olvida la política de seguridad por
--    fila, la fuga ya está hecha y nadie tuvo que equivocarse activamente.
--
--    Eso es exactamente lo que pasó en agosto con las vistas y el 11 de
--    septiembre con las 16 tablas hijas: la sede de Chía veía los
--    certificados de aporte y las inscripciones de RocaKids de Bogotá Chicó.
--    Se corrigieron las tablas. No se corrigió la REGLA que las hizo nacer
--    abiertas. Esta migración corrige la regla.
--
-- ⭐ EL PRINCIPIO: el camino fácil tiene que ser el camino seguro. No basta
--    con cerrar por defecto: si cerrar por defecto hace que publicar una
--    tabla sea engorroso, alguien va a hacer un GRANT a mano y volveremos
--    al mismo sitio. Por eso aquí van las dos cosas juntas:
--      1 · lo nuevo nace cerrado;
--      2 · `publicar_tabla()` deja una tabla lista (permiso + RLS +
--          políticas) en UNA llamada, y exige decir por qué.
--
-- ⭐ Y LA LISTA BLANCA SE MUDA. Hasta hoy, las tablas de catálogo que sí
--    pueden leerse sin política estaban escritas a mano DENTRO del banco de
--    pruebas. Una lista de control que vive en la prueba se actualiza para
--    que la prueba pase. Aquí pasa a ser una tabla con justificación, fecha
--    y responsable, y la prueba la lee. La prueba deja de ser editable para
--    salir del paso: para exponer una tabla hay que firmarlo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · LO NUEVO NACE CERRADO
-- ---------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA plataforma, org, nucleo, identidad, crm, grupos,
      asistencia, rocakids, consejeria, aportes, formacion, talento, sistema
  REVOKE SELECT ON TABLES FROM casaroca_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA plataforma, org, nucleo, identidad, crm, grupos,
      asistencia, rocakids, consejeria, aportes, formacion, talento, sistema
  REVOKE SELECT ON TABLES FROM casaroca_lectura;

-- Las secuencias sí se heredan: un contador no expone datos de nadie y sin
-- esto cada tabla nueva con bigserial rompería el INSERT de la aplicación.

-- Y la que se coló mientras tanto: la bitácora de mantenimiento de 0041
-- nació legible por esta misma herencia. El banco la cazó en la corrida
-- siguiente. Se cierra: la aplicación no necesita el detalle, le basta
-- `plataforma.v_ultimo_mantenimiento`.
REVOKE SELECT ON plataforma.bitacora_mantenimiento FROM casaroca_app, casaroca_lectura;

-- ---------------------------------------------------------------------
-- 2 · EL REGISTRO DE EXPOSICIÓN · por qué esta tabla se puede leer
-- ---------------------------------------------------------------------
CREATE TABLE plataforma.registro_exposicion (
  esquema        text NOT NULL,
  tabla          text NOT NULL,
  modo           text NOT NULL CHECK (modo IN ('catalogo_red','por_sede','por_persona','cerrada')),
  -- ⛔ Sin justificación no se registra. Una lista blanca sin razones se
  --    convierte en una lista de excepciones que nadie recuerda por qué existen.
  justificacion  text NOT NULL CHECK (length(justificacion) >= 20),
  decidido_por   text NOT NULL,
  decidido_en    date NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (esquema, tabla)
);

COMMENT ON TABLE plataforma.registro_exposicion IS
  'La lista blanca vive aquí, no dentro del banco de pruebas. Exponer una tabla es un acto firmado, no una línea que se edita para que la prueba pase.';
COMMENT ON COLUMN plataforma.registro_exposicion.modo IS
  'catalogo_red: dato de red sin persona, legible por todos. por_sede: RLS por sede. por_persona: RLS por dueño. cerrada: la aplicación no la toca.';

-- ---------------------------------------------------------------------
-- 3 · PUBLICAR UNA TABLA · permiso + RLS + políticas, en una llamada
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION plataforma.publicar_tabla(
  p_tabla         regclass,
  p_modo          text,
  p_justificacion text,
  p_decidido_por  text,
  p_escritura     boolean DEFAULT true
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_esq text; v_tab text; v_tiene_sede boolean;
BEGIN
  SELECT n.nspname, c.relname INTO v_esq, v_tab
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.oid = p_tabla;

  IF p_modo NOT IN ('catalogo_red','por_sede','por_persona','cerrada') THEN
    RAISE EXCEPTION 'Modo desconocido: %', p_modo;
  END IF;

  IF p_modo = 'cerrada' THEN
    EXECUTE format('REVOKE ALL ON %I.%I FROM casaroca_app, casaroca_lectura', v_esq, v_tab);

  ELSIF p_modo = 'catalogo_red' THEN
    -- Dato de red: catálogos, plantillas, roles. No contiene personas.
    EXECUTE format('GRANT SELECT ON %I.%I TO casaroca_app, casaroca_lectura', v_esq, v_tab);

  ELSIF p_modo = 'por_sede' THEN
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = v_esq AND table_name = v_tab AND column_name = 'sede_id')
      INTO v_tiene_sede;
    IF NOT v_tiene_sede THEN
      RAISE EXCEPTION 'La tabla %.% no tiene columna sede_id: no se puede publicar por sede', v_esq, v_tab;
    END IF;
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', v_esq, v_tab);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY',  v_esq, v_tab);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', v_tab||'_sel', v_esq, v_tab);
    EXECUTE format('CREATE POLICY %I ON %I.%I FOR SELECT USING (plataforma.sede_visible(sede_id))',
                   v_tab||'_sel', v_esq, v_tab);
    EXECUTE format('GRANT SELECT ON %I.%I TO casaroca_app', v_esq, v_tab);
    IF p_escritura THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', v_tab||'_ins', v_esq, v_tab);
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', v_tab||'_upd', v_esq, v_tab);
      EXECUTE format('CREATE POLICY %I ON %I.%I FOR INSERT WITH CHECK (plataforma.sede_visible(sede_id))',
                     v_tab||'_ins', v_esq, v_tab);
      EXECUTE format('CREATE POLICY %I ON %I.%I FOR UPDATE USING (plataforma.sede_visible(sede_id)) WITH CHECK (plataforma.sede_visible(sede_id))',
                     v_tab||'_upd', v_esq, v_tab);
      EXECUTE format('GRANT INSERT, UPDATE ON %I.%I TO casaroca_app', v_esq, v_tab);
    END IF;

  ELSIF p_modo = 'por_persona' THEN
    -- La tabla cuelga de una persona: hereda su sede por la política que
    -- escriba quien la crea. Aquí solo se exige que RLS quede encendido.
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', v_esq, v_tab);
    EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY',  v_esq, v_tab);
    EXECUTE format('GRANT SELECT ON %I.%I TO casaroca_app', v_esq, v_tab);
    IF p_escritura THEN
      EXECUTE format('GRANT INSERT, UPDATE ON %I.%I TO casaroca_app', v_esq, v_tab);
    END IF;
  END IF;

  INSERT INTO plataforma.registro_exposicion (esquema, tabla, modo, justificacion, decidido_por)
  VALUES (v_esq, v_tab, p_modo, p_justificacion, p_decidido_por)
  ON CONFLICT (esquema, tabla) DO UPDATE
    SET modo = EXCLUDED.modo, justificacion = EXCLUDED.justificacion,
        decidido_por = EXCLUDED.decidido_por, decidido_en = CURRENT_DATE;
END
$$;

COMMENT ON FUNCTION plataforma.publicar_tabla IS
  'El camino fácil y el camino seguro son el mismo. Deja la tabla con permiso, RLS y políticas, y exige decir por qué se expone y quién lo decidió.';

-- ---------------------------------------------------------------------
-- 4 · SE REGISTRA LO QUE YA ESTABA EXPUESTO
--     Esta lista estaba escrita a mano dentro de `rls_tablas_hijas.sql`.
--     Aquí queda con su razón, su responsable y su fecha.
-- ---------------------------------------------------------------------
INSERT INTO plataforma.registro_exposicion (esquema, tabla, modo, justificacion, decidido_por, decidido_en) VALUES
 ('plataforma','niveles_sensibilidad','catalogo_red','Catalogo N0 de la red: los cuatro niveles de sensibilidad. No contiene ningun dato de persona.','Mesa tecnica 100p','2026-08-31'),
 ('plataforma','finalidades','catalogo_red','Catalogo N0: finalidades de tratamiento de la Ley 1581. La aplicacion las necesita para pedir consentimiento.','Mesa tecnica 100p','2026-08-31'),
 ('plataforma','clasificacion_columna','catalogo_red','Diccionario de sensibilidad por columna. Es metadato del modelo, no dato de persona.','Mesa tecnica 100p','2026-08-31'),
 ('org','paises','catalogo_red','Catalogo de paises y su regimen de datos. Publico por naturaleza.','Mesa tecnica 100p','2026-08-31'),
 ('org','sedes','catalogo_red','Las 36 sedes. Toda sesion necesita el nombre y el codigo de las sedes para pintar cualquier pantalla. No contiene personas.','Mesa tecnica 100p','2026-08-31'),
 ('org','ministerios','catalogo_red','Catalogo de ministerios de la red con su nivel de dato. No contiene personas.','Mesa tecnica 100p','2026-08-31'),
 ('org','ministerios_sede','catalogo_red','Que ministerio esta activo en que sede. Es configuracion de la red, no dato de persona.','Mesa tecnica 100p','2026-08-31'),
 ('nucleo','tipos_documento','catalogo_red','Catalogo de tipos de documento. Publico por naturaleza.','Mesa tecnica 100p','2026-08-31'),
 ('nucleo','tipos_vinculo','catalogo_red','Catalogo de tipos de vinculo familiar. No contiene personas.','Mesa tecnica 100p','2026-08-31'),
 ('identidad','roles','catalogo_red','Los roles de la red con su techo de nivel. Saber que roles existen no revela quien los tiene.','Mesa tecnica 100p','2026-08-31'),
 ('identidad','roles_alias','catalogo_red','Nombres del Drive 100p apuntando a los roles existentes. Metadato de nomenclatura.','Mesa tecnica 100p','2026-09-18'),
 ('crm','tipos_hecho','catalogo_red','Catalogo de tipos de hecho de la linea de tiempo. Metadato de los modulos.','Mesa tecnica 100p','2026-08-31'),
 ('rocakids','salas','catalogo_red','Catalogo de salas por sede. Es infraestructura fisica, no dato de menores.','Mesa tecnica 100p','2026-08-31'),
 ('consejeria','topicos','catalogo_red','Catalogo de topicos de consejeria. Los topicos son genericos; los casos son N3 y estan cerrados.','Mesa tecnica 100p','2026-08-31'),
 ('aportes','fondos','catalogo_red','Catalogo de fondos con destinacion. No contiene montos ni donantes.','Mesa tecnica 100p','2026-08-31'),
 ('formacion','programas','catalogo_red','Catalogo de programas de formacion de la red.','Mesa tecnica 100p','2026-08-31'),
 ('formacion','cursos','catalogo_red','Catalogo de cursos de la red.','Mesa tecnica 100p','2026-08-31'),
 ('talento','cargos','catalogo_red','Catalogo de cargos de la organizacion. No contiene personas ni salarios.','Mesa tecnica 100p','2026-08-31'),
 ('sistema','modulos','catalogo_red','El manifiesto de modulos. La aplicacion lo necesita para saber que puede pintar.','Mesa tecnica 100p','2026-08-31'),
 ('sistema','acciones','catalogo_red','Catalogo de acciones (ver, crear, editar...). Metadato del modelo de permisos.','Mesa tecnica 100p','2026-08-31'),
 ('sistema','acciones_alias','catalogo_red','Nombres del Drive 100p apuntando a acciones existentes.','Mesa tecnica 100p','2026-09-18'),
 ('sistema','matriz_permisos','catalogo_red','Que rol puede que accion en que modulo. Se lee para pintar el menu; escribirla esta cerrado desde la migracion 0031.','Mesa tecnica 100p','2026-09-11'),
 ('sistema','plantillas','catalogo_red','Plantillas de aprovisionamiento por tipo de sede.','Mesa tecnica 100p','2026-08-31'),
 ('sistema','plantilla_modulos','catalogo_red','Que modulos trae cada plantilla.','Mesa tecnica 100p','2026-08-31');

-- ---------------------------------------------------------------------
-- 5 · LA VISTA DE CONTROL AHORA CONTRASTA CONTRA EL REGISTRO
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW plataforma.v_control_rls
WITH (security_invoker = true) AS
SELECT n.nspname                                   AS esquema,
       c.relname                                   AS tabla,
       c.relrowsecurity                            AS rls_activo,
       (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS politicas,
       has_table_privilege('casaroca_app', c.oid, 'SELECT') AS la_app_la_lee,
       re.modo                                     AS exposicion_registrada,
       re.justificacion,
       CASE
         WHEN NOT has_table_privilege('casaroca_app', c.oid, 'SELECT')          THEN 'CERRADA'
         WHEN (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) > 0   THEN 'CON POLITICA'
         WHEN re.modo = 'catalogo_red'                                          THEN 'CATALOGO DE RED (firmado)'
         ELSE 'FUGA · legible sin politica y sin registro'
       END AS veredicto
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN plataforma.registro_exposicion re ON re.esquema = n.nspname AND re.tabla = c.relname
WHERE c.relkind = 'r'
  AND n.nspname IN ('nucleo','org','crm','identidad','plataforma','grupos',
                    'asistencia','rocakids','consejeria','aportes','formacion',
                    'talento','sistema','modelo100p')
  AND NOT c.relispartition;

COMMENT ON VIEW plataforma.v_control_rls IS
  'Una sola fila con veredicto FUGA y no se despliega. La lista blanca ya no vive en el banco de pruebas: vive en plataforma.registro_exposicion, firmada.';

GRANT SELECT ON plataforma.v_control_rls TO casaroca_app;

-- ---------------------------------------------------------------------
-- 6 · LAS EXCEPCIONES DEJAN DE VIVIR DENTRO DE UNA VISTA
--
--     `plataforma.v_control_permisos` avisa de todo objeto que la
--     aplicación NO puede leer, y traía tres nombres escritos a mano como
--     excepción. Es el mismo problema que la lista blanca dentro del banco
--     de pruebas: una excepción sin justificación que nadie recuerda.
--     Ahora las excepciones también viven en el registro, firmadas.
-- ---------------------------------------------------------------------
INSERT INTO plataforma.registro_exposicion (esquema, tabla, modo, justificacion, decidido_por, decidido_en) VALUES
 ('plataforma','auditoria','cerrada',
  'Auditoria append-only. La aplicacion ESCRIBE (por disparador) y no lee: quien audita no puede ser el auditado.','Mesa tecnica 100p','2026-08-31'),
 ('plataforma','bitacora_lectura','cerrada',
  'Bitacora de lectura de datos N3 y N4. La aplicacion la alimenta y no la consulta; se lee por la vista v_quien_vio con permiso aparte.','Mesa tecnica 100p','2026-08-31'),
 ('plataforma','v_quien_vio','cerrada',
  'Vista de auditoria de lecturas. Solo para quien audita, no para la aplicacion.','Mesa tecnica 100p','2026-08-31'),
 ('plataforma','bitacora_mantenimiento','cerrada',
  'Log de tareas automaticas. La aplicacion solo necesita saber si el mantenimiento esta al dia, y eso lo da v_ultimo_mantenimiento.','Mesa tecnica 100p','2026-09-19')
ON CONFLICT (esquema, tabla) DO NOTHING;

SELECT plataforma.publicar_tabla('plataforma.registro_exposicion'::regclass, 'catalogo_red',
  'Registro de gobierno: que tabla se expone y por que. Es metadato del modelo, no contiene ninguna persona.',
  'Mesa tecnica 100p', false);

CREATE OR REPLACE VIEW plataforma.v_control_permisos
WITH (security_invoker = true) AS
SELECT c.table_schema AS esquema, c.table_name AS objeto, c.table_type AS tipo
FROM information_schema.tables c
WHERE c.table_schema IN ('plataforma','org','nucleo','identidad','crm','grupos',
                         'asistencia','rocakids','consejeria','aportes','formacion',
                         'talento','sistema')
  AND NOT has_table_privilege('casaroca_app', quote_ident(c.table_schema)||'.'||quote_ident(c.table_name), 'SELECT')
  -- las particiones no se leen directo: se leen por la madre
  AND NOT EXISTS (SELECT 1 FROM pg_inherits i
                  JOIN pg_class hijo ON hijo.oid = i.inhrelid
                  JOIN pg_namespace n ON n.oid = hijo.relnamespace
                  WHERE n.nspname = c.table_schema AND hijo.relname = c.table_name)
  -- y lo cerrado a propósito está firmado en el registro, no escrito aquí
  AND NOT EXISTS (SELECT 1 FROM plataforma.registro_exposicion re
                  WHERE re.esquema = c.table_schema AND re.tabla = c.table_name
                    AND re.modo = 'cerrada')
ORDER BY 1,2;

COMMENT ON VIEW plataforma.v_control_permisos IS
  'Objetos que la aplicacion no puede leer y que nadie decidio cerrar. Cada fila es una funcionalidad que fallara en produccion sin avisar.';
