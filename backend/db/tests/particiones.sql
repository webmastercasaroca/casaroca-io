-- =====================================================================
-- Banco: PARTICIONES (migración 0041)
--
-- La caída del 1 de enero de 2028 no la vio ninguna prueba porque nadie
-- estaba probando el calendario. Estas pruebas fallan ANTES de que el
-- calendario cobre, y fallan en la integración continua, no en producción.
-- =====================================================================
\set ON_ERROR_STOP on
CREATE TEMP TABLE part_res(n int, caso text, esperado text, obtenido text, pasa boolean);
CREATE FUNCTION pg_temp.rg(a int, b text, c text, d text, e boolean) RETURNS void
LANGUAGE sql AS $$ INSERT INTO part_res VALUES (a,b,c,d,e) $$;

-- P1 · Toda tabla particionada tiene red de seguridad.
DO $$
DECLARE sin_red text;
BEGIN
  SELECT string_agg(esquema||'.'||tabla, ', ') INTO sin_red
  FROM plataforma.v_salud_particiones WHERE NOT tiene_red_de_seguridad;
  PERFORM pg_temp.rg(1,'Tabla particionada sin particion por defecto',
    'ninguna', COALESCE(sin_red,'ninguna'), sin_red IS NULL);
END $$;

-- P2 · Ningún hueco. Una tabla con 2026, 2027 y 2029 NO esta cubierta.
DO $$
DECLARE con_hueco text;
BEGIN
  SELECT string_agg(esquema||'.'||tabla||' (falta '||primer_hueco||')', ', ') INTO con_hueco
  FROM plataforma.v_salud_particiones WHERE primer_hueco IS NOT NULL;
  PERFORM pg_temp.rg(2,'Ano sin particion en medio de la serie',
    'ninguno', COALESCE(con_hueco,'ninguno'), con_hueco IS NULL);
END $$;

-- P3 · Al menos dos años de colchón. Es la prueba que evita la bomba.
DO $$
DECLARE minimo int; detalle text;
BEGIN
  SELECT min(dias_de_colchon), string_agg(tabla||': '||dias_de_colchon||'d', ', ')
    INTO minimo, detalle FROM plataforma.v_salud_particiones;
  PERFORM pg_temp.rg(3,'Colchon de particiones menor a 2 anos',
    '>= 730 dias', COALESCE(detalle,'sin tablas particionadas'), COALESCE(minimo, 99999) >= 730);
END $$;

-- P4 · Ninguna partición es legible directo por la aplicación.
--      La hija se lee por la madre, que es la que tiene política.
DO $$
DECLARE fugas text;
BEGIN
  SELECT string_agg(n.nspname||'.'||c.relname, ', ') INTO fugas
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relispartition AND c.relkind = 'r'
    AND has_table_privilege('casaroca_app', c.oid, 'SELECT');
  PERFORM pg_temp.rg(4,'Particion legible directamente por la aplicacion',
    'ninguna', COALESCE(fugas,'ninguna'), fugas IS NULL);
END $$;

-- P5 · Idempotencia: correrla otra vez no crea nada.
--      Va ANTES de crear la tabla de laboratorio, para que el conteo sea limpio.
DO $$
DECLARE v int;
BEGIN
  v := plataforma.asegurar_particiones(3);
  PERFORM pg_temp.rg(5,'Correr asegurar_particiones dos veces duplica trabajo',
    '0 creadas', v||' creadas', v = 0);
END $$;

-- P6 · Un colchón menor a un año se rechaza.
DO $$
DECLARE ok boolean := false;
BEGIN
  BEGIN PERFORM plataforma.asegurar_particiones(0);
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation
                 OR insufficient_privilege OR raise_exception OR no_data_found
                 THEN ok := true; END;
  PERFORM pg_temp.rg(6,'Se acepta un colchon de cero anos','RECHAZADO como debe',
    CASE WHEN ok THEN 'RECHAZADO como debe' ELSE 'ACEPTADO (mal)' END, ok);
END $$;

-- ---------------------------------------------------------------------
-- LABORATORIO · la red de seguridad y el rescate, sobre una tabla
-- desechable. Probar esto sobre la auditoria real sería temerario.
-- ---------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS pruebas_particion;
CREATE TABLE pruebas_particion.demo (
  id bigserial, ocurrido_en timestamptz NOT NULL, nota text,
  PRIMARY KEY (id, ocurrido_en)
) PARTITION BY RANGE (ocurrido_en);
CREATE TABLE pruebas_particion.demo_2026 PARTITION OF pruebas_particion.demo
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
CREATE TABLE pruebas_particion.demo_por_defecto PARTITION OF pruebas_particion.demo DEFAULT;

-- P7 · Sin partición para 2031, la fila NO se pierde: cae en la red.
DO $$
DECLARE n int;
BEGIN
  INSERT INTO pruebas_particion.demo (ocurrido_en, nota) VALUES ('2031-06-15', 'la red la atrapa');
  SELECT count(*) INTO n FROM pruebas_particion.demo_por_defecto;
  PERFORM pg_temp.rg(7,'Fila de un ano sin particion se pierde','1 en la red', n||' en la red', n = 1);
END $$;

-- P8 · Cuando aparece la partición del año, la fila vuelve a su sitio.
DO $$
DECLARE movidas bigint; en_2031 int; en_red int;
BEGIN
  movidas := plataforma.absorber_defecto(
    'pruebas_particion.demo'::regclass, 'pruebas_particion.demo_por_defecto'::regclass,
    '2031-01-01'::timestamptz, '2032-01-01'::timestamptz, 'demo_2031');
  EXECUTE 'SELECT count(*) FROM pruebas_particion.demo_2031' INTO en_2031;
  SELECT count(*) INTO en_red FROM pruebas_particion.demo_por_defecto;
  PERFORM pg_temp.rg(8,'El rescate devuelve la fila a su ano',
    '1 rescatada y red vacia', movidas||' rescatada(s), '||en_red||' en la red',
    movidas = 1 AND en_2031 = 1 AND en_red = 0);
END $$;

-- P9 · El rescate deja rastro en la bitácora de mantenimiento.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM plataforma.bitacora_mantenimiento
  WHERE tarea='absorber_defecto' AND objeto='pruebas_particion.demo'
    AND ocurrido_en > now() - interval '1 minute';
  PERFORM pg_temp.rg(9,'El mantenimiento corre sin dejar rastro','1 registro', n||' registro(s)', n >= 1);
END $$;

-- P10 · La bitácora de mantenimiento no se puede alterar.
DO $$
DECLARE antes int; despues int;
BEGIN
  SELECT count(*) INTO antes FROM plataforma.bitacora_mantenimiento;
  DELETE FROM plataforma.bitacora_mantenimiento;
  UPDATE plataforma.bitacora_mantenimiento SET tarea = 'alterada';
  SELECT count(*) INTO despues FROM plataforma.bitacora_mantenimiento;
  PERFORM pg_temp.rg(10,'La bitacora de mantenimiento se puede borrar',
    'intacta', CASE WHEN antes = despues THEN 'intacta' ELSE 'ALTERADA' END, antes = despues);
END $$;

DROP SCHEMA pruebas_particion CASCADE;

\echo ''
\echo '===== PARTICIONES: LA BOMBA DESACTIVADA ====='
SELECT n AS "#", caso AS invariante, obtenido AS resultado,
       CASE WHEN pasa THEN 'PASA' ELSE 'FALLA' END AS veredicto
FROM part_res ORDER BY n;
SELECT count(*) FILTER (WHERE pasa) AS pasan,
       count(*) FILTER (WHERE NOT pasa) AS fallan, count(*) AS total FROM part_res;

DO $$
DECLARE v int;
BEGIN
  SELECT count(*) FILTER (WHERE NOT pasa) INTO v FROM part_res;
  IF v > 0 THEN
    RAISE EXCEPTION 'BANCO EN ROJO: % invariante(s) rota(s) en particiones.sql', v;
  END IF;
END $$;
