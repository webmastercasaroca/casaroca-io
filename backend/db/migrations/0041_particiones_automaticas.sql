-- =====================================================================
-- Migración 0041 — LAS PARTICIONES DEJAN DE SER UNA BOMBA DE RELOJERÍA
--
-- ⛔ EL PROBLEMA, CON FECHA EXACTA: `plataforma.auditoria` y
--    `crm.linea_tiempo` estaban particionadas por año hasta el
--    31 de diciembre de 2027 y nada más. Sin partición por defecto y sin
--    nadie que creara la siguiente.
--
--    El 1 de enero de 2028 a las 00:00, una fila con fecha de 2028 no
--    tiene dónde caer y el INSERT falla. Y como la auditoría se escribe
--    por DISPARADOR en las operaciones del sistema, no falla «la
--    auditoría»: falla la operación. El sistema completo deja de poder
--    escribir, a medianoche del 31 de diciembre, cuando no hay nadie.
--
-- ⭐ LA REGLA QUE ESTA MIGRACIÓN INSTALA: el sistema se encarga solo, y
--    si alguien apaga el mantenimiento, una PRUEBA lo delata antes de
--    que el calendario lo cobre. No basta con crear las particiones de
--    2028 y 2029 a mano: eso solo mueve la bomba tres años.
--
-- Cómo queda:
--   1 · `asegurar_particiones()` descubre SOLA cualquier tabla
--       particionada por rango, presente o futura. Una tabla nueva
--       queda cubierta sin que nadie se acuerde de ella.
--   2 · Partición POR DEFECTO como red: si el mantenimiento falla, la
--       fila cae ahí y el sistema sigue escribiendo. Se avisa, no se cae.
--   3 · `absorber_defecto()` devuelve esas filas a su año cuando la
--       partición correcta aparece.
--   4 · `v_salud_particiones` dice cuántos días de colchón quedan.
--   5 · El banco de pruebas EXIGE dos años de colchón. Si baja de ahí,
--       la prueba falla en la integración continua, no en producción.
--
-- ⛔ Las particiones nuevas nacen SIN permiso para la aplicación, igual
--    que las que ya existían. La tabla hija no se lee directo: se lee
--    por la tabla madre, que sí tiene su política. Es la lección de la
--    migración 0031, aplicada al futuro.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · BITÁCORA DE MANTENIMIENTO · append-only
--     Sin esto, «el mantenimiento corre» es una afirmación. Con esto es
--     una fila con fecha que cualquiera puede mirar.
-- ---------------------------------------------------------------------
CREATE TABLE plataforma.bitacora_mantenimiento (
  id          bigserial PRIMARY KEY,
  ocurrido_en timestamptz NOT NULL DEFAULT now(),
  tarea       text NOT NULL,
  objeto      text NOT NULL,
  detalle     jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX bitacora_mant_idx ON plataforma.bitacora_mantenimiento (tarea, ocurrido_en DESC);
CREATE RULE bit_mant_no_update AS ON UPDATE TO plataforma.bitacora_mantenimiento DO INSTEAD NOTHING;
CREATE RULE bit_mant_no_delete AS ON DELETE TO plataforma.bitacora_mantenimiento DO INSTEAD NOTHING;

COMMENT ON TABLE plataforma.bitacora_mantenimiento IS
  'Toda tarea automática deja rastro aquí. Una rutina que deja de correr en silencio es peor que una que falla.';

-- ---------------------------------------------------------------------
-- 2 · LA COLUMNA POR LA QUE SE PARTE UNA TABLA
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION plataforma.columna_de_particion(p_tabla regclass)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT a.attname
  FROM pg_partitioned_table pt
  JOIN pg_attribute a ON a.attrelid = pt.partrelid AND a.attnum = pt.partattrs[0]
  WHERE pt.partrelid = p_tabla;
$$;

-- ---------------------------------------------------------------------
-- 3 · DEVOLVER A SU AÑO LAS FILAS QUE CAYERON EN LA RED
--
--     Se detiene la madre, se crea el año, se mueven las filas y se
--     vuelve a colgar la red. Si la cuenta de filas movidas no cuadra
--     con la esperada, se aborta: mover datos a ciegas no es una opción.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION plataforma.absorber_defecto(
  p_madre regclass, p_defecto regclass, p_desde timestamptz, p_hasta timestamptz, p_hijo text
) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE
  v_col text := plataforma.columna_de_particion(p_madre);
  v_esq text; v_esperadas bigint; v_movidas bigint;
BEGIN
  SELECT n.nspname INTO v_esq FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.oid=p_madre;

  EXECUTE format('SELECT count(*) FROM %s WHERE %I >= %L AND %I < %L',
                 p_defecto::text, v_col, p_desde, v_col, p_hasta) INTO v_esperadas;

  EXECUTE format('ALTER TABLE %s DETACH PARTITION %s', p_madre::text, p_defecto::text);
  EXECUTE format('CREATE TABLE %I.%I PARTITION OF %s FOR VALUES FROM (%L) TO (%L)',
                 v_esq, p_hijo, p_madre::text, p_desde, p_hasta);

  EXECUTE format(
    'WITH movidas AS (DELETE FROM %s WHERE %I >= %L AND %I < %L RETURNING *) '
    'INSERT INTO %s SELECT * FROM movidas',
    p_defecto::text, v_col, p_desde, v_col, p_hasta, p_madre::text);
  GET DIAGNOSTICS v_movidas = ROW_COUNT;

  EXECUTE format('ALTER TABLE %s ATTACH PARTITION %s DEFAULT', p_madre::text, p_defecto::text);

  IF v_movidas <> v_esperadas THEN
    RAISE EXCEPTION 'Se esperaban % filas y se movieron %: se aborta antes de perder datos', v_esperadas, v_movidas;
  END IF;

  INSERT INTO plataforma.bitacora_mantenimiento (tarea, objeto, detalle)
  VALUES ('absorber_defecto', p_madre::text,
          jsonb_build_object('hijo', p_hijo, 'filas_movidas', v_movidas));
  RETURN v_movidas;
END
$$;

-- ---------------------------------------------------------------------
-- 4 · LA TAREA · descubre sola toda tabla particionada por rango
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION plataforma.asegurar_particiones(p_anios_adelante int DEFAULT 3)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE
  r record; v_anio int; v_hijo text; v_defecto text; v_defecto_oid oid;
  v_creadas int := 0; v_desde timestamptz; v_hasta timestamptz; v_en_defecto bigint;
  v_col text;
BEGIN
  IF p_anios_adelante < 1 THEN
    RAISE EXCEPTION 'Se exige al menos un año de colchón. Recibido: %', p_anios_adelante;
  END IF;

  FOR r IN
    SELECT c.oid, n.nspname AS esq, c.relname AS tabla
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_partitioned_table pt ON pt.partrelid = c.oid
    WHERE c.relkind = 'p' AND pt.partstrat = 'r'
    ORDER BY 1
  LOOP
    v_col := plataforma.columna_de_particion(r.oid::regclass);
    v_defecto := left(r.tabla, 50) || '_por_defecto';

    -- 4.a · la red de seguridad
    SELECT ch.oid INTO v_defecto_oid
    FROM pg_inherits i JOIN pg_class ch ON ch.oid = i.inhrelid
    WHERE i.inhparent = r.oid AND pg_get_expr(ch.relpartbound, ch.oid) = 'DEFAULT';

    IF v_defecto_oid IS NULL THEN
      EXECUTE format('CREATE TABLE %I.%I PARTITION OF %I.%I DEFAULT', r.esq, v_defecto, r.esq, r.tabla);
      EXECUTE format('REVOKE ALL ON %I.%I FROM PUBLIC', r.esq, v_defecto);
      EXECUTE format('REVOKE ALL ON %I.%I FROM casaroca_app, casaroca_lectura', r.esq, v_defecto);
      SELECT ch.oid INTO v_defecto_oid
      FROM pg_inherits i JOIN pg_class ch ON ch.oid = i.inhrelid
      WHERE i.inhparent = r.oid AND pg_get_expr(ch.relpartbound, ch.oid) = 'DEFAULT';
      INSERT INTO plataforma.bitacora_mantenimiento (tarea, objeto, detalle)
      VALUES ('particion_creada', r.esq||'.'||r.tabla, jsonb_build_object('hijo', v_defecto, 'tipo','defecto'));
      v_creadas := v_creadas + 1;
    END IF;

    -- 4.b · los años
    FOR v_anio IN extract(year from now())::int .. extract(year from now())::int + p_anios_adelante LOOP
      v_hijo  := left(r.tabla, 50) || '_' || v_anio;
      v_desde := make_timestamptz(v_anio, 1, 1, 0, 0, 0);
      v_hasta := make_timestamptz(v_anio + 1, 1, 1, 0, 0, 0);

      -- ⛔ La comparación va contra el límite INFERIOR exacto, no con LIKE
      --    sobre el texto del límite. La primera versión de esta función
      --    usaba LIKE y se saltó 2028: la partición de 2027 dice
      --    «TO ('2028-01-01')», así que el texto de 2028 SÍ aparecía en ella.
      --    El resultado era un hueco de un año entero que la vista daba por
      --    cubierto. Se descubrió corriéndola, no leyéndola.
      CONTINUE WHEN EXISTS (
        SELECT 1 FROM pg_inherits i JOIN pg_class ch ON ch.oid = i.inhrelid
        WHERE i.inhparent = r.oid
          AND pg_get_expr(ch.relpartbound, ch.oid) <> 'DEFAULT'
          AND (regexp_match(pg_get_expr(ch.relpartbound, ch.oid), 'FROM \(''([0-9-]+)'))[1]::date
              = v_desde::date);

      EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I >= %L AND %I < %L',
                     r.esq, v_defecto, v_col, v_desde, v_col, v_hasta) INTO v_en_defecto;

      IF v_en_defecto > 0 THEN
        -- la red atrapó filas de este año: se devuelven a su sitio
        PERFORM plataforma.absorber_defecto(
          r.oid::regclass, v_defecto_oid::regclass, v_desde, v_hasta, v_hijo);
      ELSE
        EXECUTE format('CREATE TABLE %I.%I PARTITION OF %I.%I FOR VALUES FROM (%L) TO (%L)',
                       r.esq, v_hijo, r.esq, r.tabla, v_desde, v_hasta);
      END IF;

      EXECUTE format('REVOKE ALL ON %I.%I FROM PUBLIC', r.esq, v_hijo);
      EXECUTE format('REVOKE ALL ON %I.%I FROM casaroca_app, casaroca_lectura', r.esq, v_hijo);

      INSERT INTO plataforma.bitacora_mantenimiento (tarea, objeto, detalle)
      VALUES ('particion_creada', r.esq||'.'||r.tabla,
              jsonb_build_object('hijo', v_hijo, 'anio', v_anio, 'rescatadas_del_defecto', v_en_defecto));
      v_creadas := v_creadas + 1;
    END LOOP;
  END LOOP;

  RETURN v_creadas;
END
$$;

COMMENT ON FUNCTION plataforma.asegurar_particiones IS
  'Corre mensualmente. Descubre sola cualquier tabla particionada por rango, incluidas las que nazcan después. Idempotente: correrla dos veces no hace nada la segunda vez.';

-- ---------------------------------------------------------------------
-- 5 · SALUD · cuántos días de colchón quedan, por tabla
--     Esta vista va en el runbook y en el tablero técnico.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW plataforma.v_salud_particiones
WITH (security_invoker = true) AS
WITH hijos AS (
  SELECT n.nspname AS esquema, parent.relname AS tabla,
         pg_get_expr(child.relpartbound, child.oid) AS limite
  FROM pg_inherits i
  JOIN pg_class parent ON parent.oid = i.inhparent
  JOIN pg_class child  ON child.oid  = i.inhrelid
  JOIN pg_namespace n  ON n.oid = parent.relnamespace
  WHERE parent.relkind = 'p'
),
rangos AS (
  SELECT esquema, tabla,
         (regexp_match(limite, 'FROM \(''([0-9-]+)'))[1]::date AS desde,
         (regexp_match(limite, 'TO \(''([0-9-]+)'))[1]::date   AS hasta
  FROM hijos WHERE limite <> 'DEFAULT'
),
tablas AS (
  SELECT esquema, tabla, count(*) AS particiones, min(desde) AS desde_min, max(hasta) AS hasta_max
  FROM rangos GROUP BY 1,2
),
redes AS (
  SELECT esquema, tabla, count(*) > 0 AS tiene FROM hijos WHERE limite = 'DEFAULT' GROUP BY 1,2
),
-- ⛔ El primer año SIN partición. Una tabla con 2026, 2027 y 2029 tiene un
--    hueco en 2028 y NO está cubierta hasta 2030, aunque el máximo lo diga.
huecos AS (
  SELECT t.esquema, t.tabla, min(g.anio) AS primer_hueco
  FROM tablas t
  CROSS JOIN LATERAL generate_series(
      greatest(extract(year from t.desde_min)::int, extract(year from CURRENT_DATE)::int),
      extract(year from t.hasta_max)::int - 1) AS g(anio)
  WHERE NOT EXISTS (
    SELECT 1 FROM rangos r
    WHERE r.esquema = t.esquema AND r.tabla = t.tabla
      AND make_date(g.anio,1,1) >= r.desde AND make_date(g.anio,1,1) < r.hasta)
  GROUP BY 1,2
)
SELECT t.esquema, t.tabla, t.particiones,
       COALESCE(d.tiene, false) AS tiene_red_de_seguridad,
       h.primer_hueco,
       COALESCE(make_date(h.primer_hueco,1,1), t.hasta_max) AS cubierta_hasta,
       (COALESCE(make_date(h.primer_hueco,1,1), t.hasta_max) - CURRENT_DATE) AS dias_de_colchon,
       CASE
         WHEN h.primer_hueco IS NOT NULL                                              THEN 'HUECO'
         WHEN (t.hasta_max - CURRENT_DATE) < 90                                       THEN 'CRITICO'
         WHEN (t.hasta_max - CURRENT_DATE) < 365                                      THEN 'ATENCION'
         ELSE 'BIEN'
       END AS estado
FROM tablas t
LEFT JOIN redes  d ON d.esquema = t.esquema AND d.tabla = t.tabla
LEFT JOIN huecos h ON h.esquema = t.esquema AND h.tabla = t.tabla;

COMMENT ON VIEW plataforma.v_salud_particiones IS
  'HUECO es lo más grave: hay un año sin partición en medio. Menos de 365 días de colchón es ATENCION; menos de 90, CRITICO.';

GRANT SELECT ON plataforma.v_salud_particiones TO casaroca_app, casaroca_lectura;

-- ⛔ La bitácora de mantenimiento NO se le da a la aplicación. La primera
--    versión de esta migración le dio SELECT y el banco `rls_tablas_hijas`
--    lo cazó en la siguiente corrida: una tabla legible por la aplicación
--    sin una sola política es exactamente la fuga de agosto y la de
--    septiembre. La aplicación no necesita leer el log de mantenimiento;
--    necesita saber si el mantenimiento está al día, y para eso está la
--    vista de abajo, que no expone ni una fila de detalle.
CREATE OR REPLACE VIEW plataforma.v_ultimo_mantenimiento
WITH (security_invoker = true) AS
SELECT tarea,
       max(ocurrido_en) AS ultima_corrida,
       (now() - max(ocurrido_en)) AS hace,
       count(*)         AS veces
FROM plataforma.bitacora_mantenimiento
GROUP BY tarea;

COMMENT ON VIEW plataforma.v_ultimo_mantenimiento IS
  'Para el endpoint de salud y el tablero técnico. Dice CUÁNDO corrió cada tarea, no QUÉ hizo.';

GRANT SELECT ON plataforma.v_ultimo_mantenimiento TO casaroca_app, casaroca_lectura;

-- ---------------------------------------------------------------------
-- 6 · SE CORRE AHORA MISMO · tres años de colchón desde hoy
-- ---------------------------------------------------------------------
DO $$
DECLARE v int;
BEGIN
  v := plataforma.asegurar_particiones(3);
  RAISE NOTICE 'Particiones creadas en esta migración: %', v;
END $$;
