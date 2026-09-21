-- =====================================================================
-- Banco: BÚSQUEDA Y DUPLICADOS (migración 0047)
-- «Jon» tiene que encontrar a «Jhon». Si no, nace el duplicado.
-- =====================================================================
\set ON_ERROR_STOP on
CREATE TEMP TABLE b_res(n int, caso text, esperado text, obtenido text, pasa boolean);
CREATE FUNCTION pg_temp.rg(a int, b text, c text, d text, e boolean) RETURNS void
LANGUAGE sql AS $$ INSERT INTO b_res VALUES (a,b,c,d,e) $$;
CREATE TEMP TABLE blab(k text PRIMARY KEY, v uuid);

DO $$
DECLARE v_chico uuid; v_med uuid; v_a uuid; v_b uuid; v_fondo uuid;
BEGIN
  SELECT id INTO v_chico FROM org.sedes WHERE codigo='BOG-CHICO';
  SELECT id INTO v_med   FROM org.sedes WHERE codigo='MED';
  SELECT id INTO v_fondo FROM aportes.fondos LIMIT 1;

  INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido, fecha_nacimiento,
                               tipo_documento, numero_documento, telefono_movil)
  VALUES (v_chico,'Jhon','Chávez','1988-07-04','CC','1020304050','3105551234')
  RETURNING id INTO v_a;

  -- El mismo ser humano, registrado otra vez en otra sede, escrito distinto.
  INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido, fecha_nacimiento)
  VALUES (v_med,'Jon','Chavez','1988-07-04') RETURNING id INTO v_b;

  INSERT INTO aportes.aportes (sede_id, persona_id, fondo_id, tipo, monto, medio, fecha)
  VALUES (v_med, v_b, v_fondo, 'diezmo', 50000, 'efectivo', CURRENT_DATE - 10);

  INSERT INTO blab VALUES ('a',v_a),('b',v_b),('chico',v_chico),('med',v_med);
END $$;

-- S1 · ⭐ Escribiendo mal el nombre, la persona aparece.
DO $$
DECLARE n int; mejor real;
BEGIN
  SELECT count(*), max(parecido) INTO n, mejor FROM nucleo.buscar_personas('Jon Chavez', 10);
  PERFORM pg_temp.rg(1,'Buscar «Jon Chavez» no encuentra a «Jhon Chavez»','al menos 1',
    n||' resultado(s), mejor '||round(coalesce(mejor,0)::numeric,2), n >= 1);
END $$;

-- S2 · Por documento exacto, con puntaje maximo.
DO $$
DECLARE p real;
BEGIN
  SELECT max(parecido) INTO p FROM nucleo.buscar_personas('1020304050', 5);
  PERFORM pg_temp.rg(2,'Buscar por documento no da coincidencia exacta','1.0',
    coalesce(round(p::numeric,2)::text,'nada'), p = 1.0);
END $$;

-- S3 · Por telefono.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM nucleo.buscar_personas('3105551234', 5) WHERE por_que='telefono';
  PERFORM pg_temp.rg(3,'Buscar por telefono no encuentra','1', n||'', n >= 1);
END $$;

-- S4 · ⭐ La busqueda respeta la seguridad por fila.
DO $$
DECLARE n int; v_sede uuid;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BCN';
  SET LOCAL ROLE casaroca_app;
  PERFORM set_config('app.sede_ids','{'||v_sede::text||'}',true);
  PERFORM set_config('app.nivel_max','4',true);
  SELECT count(*) INTO n FROM nucleo.buscar_personas('Chavez', 20);
  RESET ROLE;
  PERFORM pg_temp.rg(4,'La busqueda se salta la seguridad por fila','0 desde otra sede', n||'', n = 0);
END $$;

-- S5 · Los candidatos a duplicado los detecta, con motivo.
DO $$
DECLARE n int; motivo text;
BEGIN
  SELECT count(*), min(motivos) INTO n, motivo
  FROM nucleo.candidatos_duplicado((SELECT v FROM blab WHERE k='a'));
  PERFORM pg_temp.rg(5,'No detecta al duplicado evidente','al menos 1 con motivo',
    n||' candidato(s): '||coalesce(motivo,'sin motivo'), n >= 1);
END $$;

-- S6 · Fusionar sin motivo o consigo misma: rechazados.
DO $$
DECLARE sin_motivo boolean := false; consigo boolean := false;
BEGIN
  BEGIN PERFORM nucleo.fusionar((SELECT v FROM blab WHERE k='a'),(SELECT v FROM blab WHERE k='b'),'x');
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation
                 OR insufficient_privilege OR raise_exception OR no_data_found
                 THEN sin_motivo := true; END;
  BEGIN PERFORM nucleo.fusionar((SELECT v FROM blab WHERE k='a'),(SELECT v FROM blab WHERE k='a'),'motivo suficientemente largo');
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation
                 OR insufficient_privilege OR raise_exception OR no_data_found
                 THEN consigo := true; END;
  PERFORM pg_temp.rg(6,'Fusionar sin motivo o consigo misma','los dos RECHAZADOS',
    CASE WHEN sin_motivo AND consigo THEN 'los dos RECHAZADOS' ELSE 'alguno paso (mal)' END,
    sin_motivo AND consigo);
END $$;

-- ═══ LA FUSIÓN ═══
DO $$
DECLARE v_f uuid;
BEGIN
  v_f := nucleo.fusionar((SELECT v FROM blab WHERE k='a'),(SELECT v FROM blab WHERE k='b'),
    'Mismo documento y misma fecha de nacimiento: es la misma persona registrada dos veces');
  INSERT INTO blab VALUES ('fusion', v_f);
END $$;

-- S7 · ⭐ Los aportes de la duplicada quedaron en la principal.
DO $$
DECLARE n_principal int; n_dup int;
BEGIN
  SELECT count(*) INTO n_principal FROM aportes.aportes WHERE persona_id=(SELECT v FROM blab WHERE k='a');
  SELECT count(*) INTO n_dup       FROM aportes.aportes WHERE persona_id=(SELECT v FROM blab WHERE k='b');
  PERFORM pg_temp.rg(7,'La fusion deja aportes huerfanos en la duplicada',
    'principal 1, duplicada 0', 'principal '||n_principal||', duplicada '||n_dup,
    n_principal = 1 AND n_dup = 0);
END $$;

-- S8 · La duplicada queda como lapida apuntando a la principal.
DO $$
DECLARE v_estado text; v_apunta uuid;
BEGIN
  SELECT estado::text, fusionada_en_id INTO v_estado, v_apunta
  FROM nucleo.personas WHERE id=(SELECT v FROM blab WHERE k='b');
  PERFORM pg_temp.rg(8,'La duplicada se borra en vez de quedar como lapida',
    'fusionada, apuntando', v_estado||', apunta '||CASE WHEN v_apunta IS NOT NULL THEN 'si' ELSE 'no' END,
    v_estado='fusionada' AND v_apunta=(SELECT v FROM blab WHERE k='a'));
END $$;

-- S9 · Quedo el registro de que se movio y la linea de tiempo.
DO $$
DECLARE v_mov jsonb; n_lt int;
BEGIN
  SELECT referencias_movidas INTO v_mov FROM nucleo.fusiones WHERE id=(SELECT v FROM blab WHERE k='fusion');
  SELECT count(*) INTO n_lt FROM crm.linea_tiempo
   WHERE persona_id=(SELECT v FROM blab WHERE k='a') AND tipo='FUSION_PERSONAS';
  PERFORM pg_temp.rg(9,'La fusion no deja registro de que movio',
    'registro con movidas y 1 hecho',
    coalesce(jsonb_object_keys_count(v_mov),0)||' tablas movidas, '||n_lt||' hecho(s)',
    v_mov <> '{}'::jsonb AND n_lt = 1);
EXCEPTION WHEN undefined_function THEN
  SELECT referencias_movidas INTO v_mov FROM nucleo.fusiones WHERE id=(SELECT v FROM blab WHERE k='fusion');
  SELECT count(*) INTO n_lt FROM crm.linea_tiempo
   WHERE persona_id=(SELECT v FROM blab WHERE k='a') AND tipo='FUSION_PERSONAS';
  PERFORM pg_temp.rg(9,'La fusion no deja registro de que movio',
    'registro con movidas y 1 hecho',
    (SELECT count(*) FROM jsonb_object_keys(v_mov))||' tablas movidas, '||n_lt||' hecho(s)',
    v_mov <> '{}'::jsonb AND n_lt = 1);
END $$;

-- S10 · Fusionar dos veces la misma se rechaza.
DO $$
DECLARE ok boolean := false;
BEGIN
  BEGIN PERFORM nucleo.fusionar((SELECT v FROM blab WHERE k='a'),(SELECT v FROM blab WHERE k='b'),
    'Intento repetido de fusionar la misma persona');
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation
                 OR insufficient_privilege OR raise_exception OR no_data_found
                 THEN ok := true; END;
  PERFORM pg_temp.rg(10,'Se puede fusionar dos veces la misma persona','RECHAZADO como debe',
    CASE WHEN ok THEN 'RECHAZADO como debe' ELSE 'ACEPTADO (mal)' END, ok);
END $$;

-- S11 · El tablero de calidad del dato responde.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM nucleo.v_calidad_datos;
  PERFORM pg_temp.rg(11,'No hay tablero de calidad del dato','al menos 1 sede', n||' sede(s)', n >= 1);
END $$;

-- Limpieza.
-- ⛔ `nucleo.personas` tiene la regla `personas_no_delete`: un DELETE se
--    ignora EN SILENCIO (borrado logico unicamente, que es lo correcto).
--    La primera version de estas limpiezas borraba la membresia y creia
--    haber borrado la persona: quedaban personas vivas sin membresia y el
--    banco 1 se ponia rojo dos bancos despues. Aqui se borra como manda el
--    modelo: marcando.
DELETE FROM crm.linea_tiempo WHERE persona_id IN (SELECT v FROM blab WHERE k IN ('a','b'));
DELETE FROM aportes.aportes  WHERE persona_id IN (SELECT v FROM blab WHERE k IN ('a','b'));
UPDATE nucleo.membresias_sede SET hasta = CURRENT_DATE, es_principal = false
 WHERE persona_id IN (SELECT v FROM blab WHERE k IN ('a','b')) AND hasta IS NULL;
UPDATE nucleo.personas SET eliminado_en = now(), estado = 'inactiva'
 WHERE id IN (SELECT v FROM blab WHERE k IN ('a','b')) AND estado::text <> 'fusionada';

\echo ''
\echo '===== BUSQUEDA Y DUPLICADOS ====='
SELECT n AS "#", caso AS invariante, obtenido AS resultado,
       CASE WHEN pasa THEN 'PASA' ELSE 'FALLA' END AS veredicto
FROM b_res ORDER BY n;
SELECT count(*) FILTER (WHERE pasa) AS pasan,
       count(*) FILTER (WHERE NOT pasa) AS fallan, count(*) AS total FROM b_res;

DO $$
DECLARE v int;
BEGIN
  SELECT count(*) FILTER (WHERE NOT pasa) INTO v FROM b_res;
  IF v > 0 THEN RAISE EXCEPTION 'BANCO EN ROJO: % invariante(s) rota(s) en busqueda_y_duplicados.sql', v; END IF;
END $$;
