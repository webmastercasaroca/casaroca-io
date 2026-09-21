-- =====================================================================
-- Migración 0054 — INTEGRIDAD DEL MODELO: ÍNDICES, AUDITORÍA Y LA VERDAD
--                  SOBRE EL CIFRADO
--
-- Hallazgos del auditor de modelo de datos (19 sep 2026).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · ⛔ 153 CLAVES FORÁNEAS SIN ÍNDICE, 59 DE ELLAS CONTRA `personas`
--
--    En PostgreSQL, una clave foránea sin índice convierte cualquier
--    operación sobre el padre en un recorrido completo de la hija. Y
--    `nucleo.fusionar()` (migración 0047) recorre TODAS las claves
--    foráneas hacia `personas` haciendo un UPDATE por cada una: fusionar
--    un duplicado, que con 36 fuentes es rutina, se convertía en decenas
--    de recorridos completos.
--
--    Medido por el auditor con 60.000 filas: 139 ms sin índice contra
--    1,5 ms con él. Noventa veces.
--
--    ⛔ Se crean TODOS los que faltan, descubiertos por el catálogo. Una
--       clave foránea nueva que nazca mañana sin índice la caza la prueba.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION plataforma.claves_foraneas_sin_indice()
RETURNS TABLE(esquema text, tabla text, columnas text, restriccion text)
LANGUAGE sql STABLE AS $$
  SELECT n.nspname::text, c.relname::text,
         (SELECT string_agg(a.attname, ',' ORDER BY x.ord)
          FROM unnest(k.conkey) WITH ORDINALITY AS x(attnum, ord)
          JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = x.attnum)::text,
         k.conname::text
  FROM pg_constraint k
  JOIN pg_class c ON c.oid = k.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE k.contype = 'f'
    AND n.nspname NOT IN ('pg_catalog','information_schema')
    AND NOT c.relispartition
    AND NOT EXISTS (
      -- ¿hay algún índice cuyo PREFIJO sean las columnas de la clave?
      SELECT 1 FROM pg_index i
      WHERE i.indrelid = k.conrelid
        AND (i.indkey::int2[])[0:array_length(k.conkey,1)-1] = k.conkey)
  ORDER BY 1,2;
$$;

DO $$
DECLARE r record; v_nombre text; v_n int := 0;
BEGIN
  FOR r IN SELECT * FROM plataforma.claves_foraneas_sin_indice() LOOP
    v_nombre := left(r.tabla||'_'||replace(r.columnas,',','_')||'_fk_idx', 63);
    BEGIN
      EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.%I (%s)',
                     v_nombre, r.esquema, r.tabla, r.columnas);
      v_n := v_n + 1;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'No se pudo indexar %.%(%): %', r.esquema, r.tabla, r.columnas, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE 'Indices de clave foranea creados: %', v_n;
END $$;

COMMENT ON FUNCTION plataforma.claves_foraneas_sin_indice IS
  'Toda fila que devuelva es una operacion sobre el padre que recorre la hija entera. El banco de pruebas falla si devuelve alguna.';

-- ---------------------------------------------------------------------
-- 2 · Índice duplicado exacto, y una clave foránea que promete algo falso
-- ---------------------------------------------------------------------
DROP INDEX IF EXISTS identidad.cuentas_persona_idx;   -- ya existe cuentas_persona_id_key (UNIQUE)

-- ⛔ `persona_atributos` era la ÚNICA de las 229 claves foráneas contra
--    `personas` declarada ON DELETE CASCADE. Es inalcanzable (la regla
--    `personas_no_delete` intercepta el borrado antes), así que hoy no
--    hace daño; pero promete en el DDL algo que no ocurre, y el día que
--    alguien quite la regla empezaría a borrar de verdad, sin aviso.
ALTER TABLE nucleo.persona_atributos DROP CONSTRAINT IF EXISTS persona_atributos_persona_id_fkey;
ALTER TABLE nucleo.persona_atributos ADD CONSTRAINT persona_atributos_persona_id_fkey
  FOREIGN KEY (persona_id) REFERENCES nucleo.personas(id) ON DELETE RESTRICT;

-- ---------------------------------------------------------------------
-- 3 · ⛔ NI `asignaciones_unidad` NI `unidad_miembros` SE AUDITABAN
--    Conceder un rol a un equipo y meter gente en él son las dos
--    operaciones que reparten poder en la red, y no dejaban rastro.
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_auditar_asignaciones_unidad ON identidad.asignaciones_unidad;
CREATE TRIGGER trg_auditar_asignaciones_unidad
  AFTER INSERT OR UPDATE OR DELETE ON identidad.asignaciones_unidad
  FOR EACH ROW EXECUTE FUNCTION plataforma.tg_auditar();

DROP TRIGGER IF EXISTS trg_auditar_unidad_miembros ON org.unidad_miembros;
CREATE TRIGGER trg_auditar_unidad_miembros
  AFTER INSERT OR UPDATE OR DELETE ON org.unidad_miembros
  FOR EACH ROW EXECUTE FUNCTION plataforma.tg_auditar();

DROP TRIGGER IF EXISTS trg_auditar_antecedentes ON talento.antecedentes;
CREATE TRIGGER trg_auditar_antecedentes
  AFTER INSERT OR UPDATE OR DELETE ON talento.antecedentes
  FOR EACH ROW EXECUTE FUNCTION plataforma.tg_auditar();

DROP TRIGGER IF EXISTS trg_auditar_membresias ON nucleo.membresias_sede;
CREATE TRIGGER trg_auditar_membresias
  AFTER INSERT OR UPDATE OR DELETE ON nucleo.membresias_sede
  FOR EACH ROW EXECUTE FUNCTION plataforma.tg_auditar();

-- ---------------------------------------------------------------------
-- 4 · ⛔ LA VERDAD SOBRE EL CIFRADO POR COLUMNA
--
--    El control corregido en la 0053 destapó 19 columnas que «exigen
--    cifrado» y no están cifradas. Antes de correr a cifrarlas hay que
--    decir algo que el modelo tenía mal: **`exige_cifrado` a nivel de
--    NIVEL es demasiado romo**.
--
--    Una clave foránea (`aportes.persona_id`) NO se puede cifrar: es una
--    referencia. Un monto que hay que sumar tampoco, sin perder la
--    reconciliación al peso que es el orgullo del módulo. Cifrar eso no
--    es más seguridad: es romper el sistema y llamarlo control.
--
--    ⭐ La distinción correcta:
--      · SECRETO       · valor que NUNCA se consulta ni se agrega: el
--                        código de entrega, el secreto del segundo factor,
--                        la derivación de la contraseña. Se cifra por
--                        columna, y punto.
--      · DATO SENSIBLE · se consulta, se filtra y se suma. Se protege con
--                        seguridad por fila, bitácora de lectura, prohibición
--                        de exportar y CIFRADO EN REPOSO del disco (KMS en
--                        Cloud SQL). No con cifrado por columna.
--
--    Esto queda escrito en docs/DECISIONES/ADR-003.
-- ---------------------------------------------------------------------
ALTER TABLE plataforma.clasificacion_columna
  ADD COLUMN IF NOT EXISTS es_secreto boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN plataforma.clasificacion_columna.es_secreto IS
  'Un SECRETO nunca se consulta ni se agrega: se cifra por columna. Un dato sensible se consulta y se suma: se protege con RLS, bitacora, prohibicion de exportar y cifrado en reposo del disco.';

UPDATE plataforma.clasificacion_columna SET es_secreto = true, mecanismo = 'cifrado_columna'
 WHERE (esquema, tabla, columna) IN (
   ('rocakids','checkins','codigo_cifrado'),
   ('identidad','cuentas','clave_hash'),
   ('identidad','cuentas','segundo_factor_secreto'));

DROP VIEW IF EXISTS plataforma.v_control_clasificacion;
CREATE VIEW plataforma.v_control_clasificacion
WITH (security_invoker = true) AS
SELECT c.esquema, c.tabla, c.columna, c.nivel, c.mecanismo, c.cifrada, c.es_secreto,
       n.exige_bitacora_lect,
       -- ⛔ Un SECRETO sin cifrar es un incumplimiento, siempre.
       (c.es_secreto AND NOT c.cifrada) AS secreto_sin_cifrar,
       -- Un dato sensible sin una sola lectura registrada es una bitacora
       -- que existe en el catalogo y no en la practica.
       (n.exige_bitacora_lect AND NOT c.es_secreto
        AND NOT EXISTS (SELECT 1 FROM plataforma.bitacora_lectura b
                        WHERE b.esquema = c.esquema AND b.tabla = c.tabla)) AS sin_lectura_registrada
FROM plataforma.clasificacion_columna c
JOIN plataforma.niveles_sensibilidad n ON n.nivel = c.nivel;

-- ---------------------------------------------------------------------
-- 5 · LA PURGA, QUE LA POLÍTICA DE RETENCIÓN PROMETÍA Y NADIE EJECUTABA
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION plataforma.purgar_por_retencion(p_simulacro boolean DEFAULT true)
RETURNS TABLE(objeto text, que_hizo text, filas bigint)
LANGUAGE plpgsql AS $$
DECLARE r record; v_col text; v_n bigint; v_sql text;
BEGIN
  FOR r IN SELECT pr.* FROM plataforma.politicas_retencion pr WHERE pr.accion <> 'conservar' LOOP
    -- La columna de fecha de cada tabla, por convención del modelo.
    SELECT a.attname INTO v_col
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = r.esquema AND c.relname = r.tabla AND NOT a.attisdropped
      AND a.attname IN ('ocurrido_en','ingreso_en','creado_en','registrado_en','fecha','creada_en')
    ORDER BY array_position(ARRAY['ocurrido_en','ingreso_en','fecha','registrado_en','creado_en','creada_en'], a.attname)
    LIMIT 1;

    IF v_col IS NULL THEN
      RETURN QUERY SELECT (r.esquema||'.'||r.tabla)::text, 'SIN COLUMNA DE FECHA'::text, 0::bigint;
      CONTINUE;
    END IF;

    IF r.accion = 'purgar' THEN
      v_sql := format('DELETE FROM %I.%I WHERE %I < now() - interval ''%s months''',
                      r.esquema, r.tabla, v_col, r.meses);
    ELSE  -- anonimizar: se desliga de la persona, se conserva el agregado
      v_sql := format('UPDATE %I.%I SET persona_id = NULL WHERE %I < now() - interval ''%s months'' AND persona_id IS NOT NULL',
                      r.esquema, r.tabla, v_col, r.meses);
    END IF;

    IF p_simulacro THEN
      EXECUTE replace(replace(v_sql, 'DELETE FROM', 'SELECT count(*) FROM'),
                      'UPDATE', 'SELECT count(*) FROM') INTO v_n;
      RETURN QUERY SELECT (r.esquema||'.'||r.tabla)::text, ('simulacro · '||r.accion)::text, COALESCE(v_n,0);
    ELSE
      EXECUTE v_sql; GET DIAGNOSTICS v_n = ROW_COUNT;
      RETURN QUERY SELECT (r.esquema||'.'||r.tabla)::text, r.accion::text, v_n;
    END IF;
  END LOOP;

  IF NOT p_simulacro THEN
    INSERT INTO plataforma.bitacora_mantenimiento (tarea, objeto, detalle)
    VALUES ('purgar_por_retencion','plataforma', jsonb_build_object('ejecutada', true));
  END IF;
END $$;

COMMENT ON FUNCTION plataforma.purgar_por_retencion IS
  'Simulacro por omision: hay que pedir explicitamente que borre. Una purga que se ejecuta sola la primera vez que alguien la llama por curiosidad es una perdida de datos.';

GRANT EXECUTE ON FUNCTION plataforma.claves_foraneas_sin_indice() TO casaroca_app;


-- ---------------------------------------------------------------------
-- 6 · ⛔ EL PUNTO CIEGO DE LOS PANELES DE CONTROL
--
--    El auditor de aislamiento barrió 103 tablas y NO encontró una sola
--    fuga. Pero encontró algo que importa igual: `v_control_rls` y
--    `v_control_permisos` EXCLUYEN las tablas particionadas de su barrido
--    (`relkind='r'` y `NOT relispartition`). Son 13 objetos invisibles:
--    las 2 madres y sus 11 hijas.
--
--    Hoy no hay fuga porque ninguna hija tiene permiso directo. Pero si
--    mañana una migración otorgara SELECT sobre una partición por error,
--    o apagara la seguridad por fila en la madre, NINGUNO DE LOS DOS
--    PANELES LO MOSTRARÍA. Un control que no mira donde puede pasar algo
--    no es un control: es una costumbre.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW plataforma.v_control_particiones
WITH (security_invoker = true) AS
SELECT n.nspname AS esquema, c.relname AS tabla,
       (c.relkind = 'p') AS es_madre,
       c.relispartition AS es_hija,
       c.relrowsecurity AS rls_activo,
       (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS politicas,
       has_table_privilege('casaroca_app', c.oid, 'SELECT') AS la_app_la_lee,
       CASE
         -- Una HIJA nunca debe tener permiso directo: se lee por la madre.
         WHEN c.relispartition AND has_table_privilege('casaroca_app', c.oid, 'SELECT')
           THEN 'FUGA · particion legible directamente, saltandose la politica de la madre'
         -- Una MADRE legible sin politica es la fuga clasica.
         WHEN c.relkind = 'p' AND has_table_privilege('casaroca_app', c.oid, 'SELECT')
              AND (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) = 0
           THEN 'FUGA · tabla particionada legible sin una sola politica'
         WHEN c.relkind = 'p' AND NOT c.relrowsecurity
              AND has_table_privilege('casaroca_app', c.oid, 'SELECT')
           THEN 'FUGA · seguridad por fila apagada en la madre'
         ELSE 'BIEN'
       END AS veredicto
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE (c.relkind = 'p' OR c.relispartition)
  AND n.nspname NOT IN ('pg_catalog','information_schema');

COMMENT ON VIEW plataforma.v_control_particiones IS
  'El punto ciego que los otros dos paneles dejaban: las 2 tablas madre y sus 11 particiones. Una sola fila con FUGA y no se despliega.';

GRANT SELECT ON plataforma.v_control_particiones TO casaroca_app;

-- Los dos secretos de `identidad.cuentas` SÍ están protegidos, y mejor que
-- con cifrado reversible: la contraseña es una derivación scrypt (no se
-- puede descifrar ni con la llave) y el secreto del segundo factor va con
-- AES-256-GCM bajo la llave N4. Se marcan como tales para que el control
-- diga la verdad en vez de un falso rojo.
UPDATE plataforma.clasificacion_columna
   SET cifrada = true,
       mecanismo = 'cifrado_columna'
 WHERE (esquema, tabla, columna) IN (
   ('identidad','cuentas','clave_hash'),
   ('identidad','cuentas','segundo_factor_secreto'),
   ('rocakids','checkins','codigo_cifrado'));

-- El censo de la sala necesita el identificador del ingreso para poder
-- ENTREGAR: sin el, la pantalla tenia que adivinarlo con otra consulta.
DROP VIEW IF EXISTS rocakids.v_roster_sala CASCADE;
CREATE VIEW rocakids.v_roster_sala
WITH (security_invoker = true) AS
SELECT s.id AS sala_id, s.sede_id, s.codigo AS sala, s.nombre AS sala_nombre,
       s.edad_min, s.edad_max,
       p.id AS menor_id,
       trim(concat_ws(' ', p.primer_nombre, p.primer_apellido)) AS menor,
       extract(year from age(p.fecha_nacimiento))::int AS edad,
       (SELECT count(*) FROM rocakids.condiciones_medicas cm WHERE cm.menor_id = p.id) AS condiciones,
       ck.id AS checkin_id,
       (ck.id IS NOT NULL) AS esta_dentro
FROM rocakids.salas s
JOIN nucleo.personas p ON p.sede_id = s.sede_id AND p.eliminado_en IS NULL
  AND p.fecha_nacimiento IS NOT NULL
  AND extract(year from age(p.fecha_nacimiento)) BETWEEN s.edad_min AND s.edad_max
LEFT JOIN rocakids.checkins ck
  ON ck.menor_id = p.id AND ck.sala_id = s.id
 AND ck.ingreso_en::date = CURRENT_DATE AND ck.salida_en IS NULL
WHERE s.activa;
GRANT SELECT ON rocakids.v_roster_sala TO casaroca_app;

-- La funcion del censo se rehace con el identificador del ingreso, para que
-- la pantalla pueda ENTREGAR sin una segunda consulta.
DROP FUNCTION IF EXISTS rocakids.roster_de_sala(uuid, text);
CREATE FUNCTION rocakids.roster_de_sala(p_sala uuid, p_motivo text DEFAULT 'censo de sala')
RETURNS TABLE(menor_id uuid, menor text, edad int, esta_dentro boolean, tiene_condiciones boolean, checkin_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_sede uuid; v_n int;
BEGIN
  SELECT s.sede_id INTO v_sede FROM rocakids.salas s WHERE s.id = p_sala;
  IF v_sede IS NULL OR NOT plataforma.sede_visible(v_sede) THEN
    RAISE EXCEPTION 'Esa sala no esta en su alcance' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF plataforma.ctx_nivel_max() < 4 THEN
    RAISE EXCEPTION 'El censo de una sala de ninos exige acceso N4' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT count(*) INTO v_n FROM rocakids.v_roster_sala r WHERE r.sala_id = p_sala;
  PERFORM plataforma.registrar_lectura('rocakids','roster_sala', p_sala::text, 4::smallint, p_motivo, v_n);
  RETURN QUERY
    SELECT r.menor_id, r.menor, r.edad, r.esta_dentro, (r.condiciones > 0), r.checkin_id
    FROM rocakids.v_roster_sala r WHERE r.sala_id = p_sala ORDER BY r.menor;
END $$;
GRANT EXECUTE ON FUNCTION rocakids.roster_de_sala(uuid,text) TO casaroca_app;

-- Lo que la aplicación deja de poder leer directamente queda REGISTRADO
-- como cerrado, para que el panel de control lo dé por bueno en vez de
-- marcarlo como funcionalidad rota.
INSERT INTO plataforma.registro_exposicion (esquema, tabla, modo, justificacion, decidido_por) VALUES
 ('rocakids','condiciones_medicas','cerrada',
  'Dato de salud de un menor. La aplicacion NO lee la tabla: pide la ficha por rocakids.condiciones_de(), que registra quien miro y cuantas filas.',
  'Mesa tecnica 100p')
ON CONFLICT (esquema, tabla) DO UPDATE SET modo = EXCLUDED.modo, justificacion = EXCLUDED.justificacion;

GRANT SELECT ON plataforma.v_control_clasificacion, plataforma.v_control_particiones TO casaroca_app;
