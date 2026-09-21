-- =====================================================================
-- Banco: MEMBRESÍA POR SEDE (migración 0043)
--
-- La prueba que el modelo anterior no podía pasar: trasladar a alguien
-- SIN entregarle su pasado a la sede nueva y SIN borrárselo a la vieja.
-- =====================================================================
\set ON_ERROR_STOP on
CREATE TEMP TABLE m_res(n int, caso text, esperado text, obtenido text, pasa boolean);
CREATE FUNCTION pg_temp.rg(a int, b text, c text, d text, e boolean) RETURNS void
LANGUAGE sql AS $$ INSERT INTO m_res VALUES (a,b,c,d,e) $$;

-- Laboratorio: Ana congrega en Chicó, aporta allí, y se muda a Chía.
CREATE TEMP TABLE lab(k text PRIMARY KEY, v uuid);
DO $$
DECLARE v_chico uuid; v_chia uuid; v_med uuid; v_ana uuid; v_fondo uuid; v_ap uuid;
BEGIN
  SELECT id INTO v_chico FROM org.sedes WHERE codigo='BOG-CHICO';
  SELECT id INTO v_chia  FROM org.sedes WHERE codigo='CHIA';
  SELECT id INTO v_med   FROM org.sedes WHERE codigo='MED';
  SELECT id INTO v_fondo FROM aportes.fondos LIMIT 1;

  INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido, fecha_nacimiento, estado)
  VALUES (v_chico, 'Ana', 'DePrueba', '1990-03-12', 'activa') RETURNING id INTO v_ana;

  INSERT INTO aportes.aportes (sede_id, persona_id, fondo_id, tipo, monto, medio, fecha)
  VALUES (v_chico, v_ana, v_fondo, 'diezmo', 100000, 'efectivo', CURRENT_DATE - 400)
  RETURNING id INTO v_ap;

  INSERT INTO lab VALUES ('chico',v_chico),('chia',v_chia),('med',v_med),('ana',v_ana),('aporte',v_ap);
END $$;

-- M1 · Toda persona tiene exactamente una membresía principal vigente.
DO $$
DECLARE malas int;
BEGIN
  -- ⛔ Se cuentan solo las personas VIVAS y no fusionadas. Una persona
  --    borrada logicamente o fusionada no tiene por que conservar una
  --    membresia principal vigente: ya no congrega en ningun sitio.
  SELECT count(*) INTO malas FROM (
    SELECT p.id FROM nucleo.personas p
    LEFT JOIN nucleo.membresias_sede m
      ON m.persona_id=p.id AND m.es_principal AND m.hasta IS NULL
    WHERE p.eliminado_en IS NULL AND p.estado::text <> 'fusionada'
    GROUP BY p.id HAVING count(m.id) <> 1) x;
  PERFORM pg_temp.rg(1,'Persona sin sede principal vigente o con dos','0 personas', malas||' personas', malas=0);
END $$;

-- M2 · La sede NO se cambia con un UPDATE. Es el corazón del arreglo.
DO $$
DECLARE ok boolean := false;
BEGIN
  BEGIN
    UPDATE nucleo.personas SET sede_id=(SELECT v FROM lab WHERE k='chia')
    WHERE id=(SELECT v FROM lab WHERE k='ana');
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation
                 OR insufficient_privilege OR raise_exception OR no_data_found
                 THEN ok := true; END;
  PERFORM pg_temp.rg(2,'Cambiar la sede con UPDATE (reescribe el pasado)','RECHAZADO como debe',
    CASE WHEN ok THEN 'RECHAZADO como debe' ELSE 'ACEPTADO (mal)' END, ok);
END $$;

-- M3 · Traslado sin motivo y a la propia sede: los dos se rechazan.
DO $$
DECLARE sin_motivo boolean := false; misma boolean := false;
BEGIN
  BEGIN PERFORM nucleo.trasladar((SELECT v FROM lab WHERE k='ana'), (SELECT v FROM lab WHERE k='chia'), 'x');
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation
                 OR insufficient_privilege OR raise_exception OR no_data_found
                 THEN sin_motivo := true; END;
  BEGIN PERFORM nucleo.trasladar((SELECT v FROM lab WHERE k='ana'), (SELECT v FROM lab WHERE k='chico'), 'se muda al mismo sitio');
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation
                 OR insufficient_privilege OR raise_exception OR no_data_found
                 THEN misma := true; END;
  PERFORM pg_temp.rg(3,'Traslado sin motivo o a la propia sede','los dos RECHAZADOS',
    CASE WHEN sin_motivo AND misma THEN 'los dos RECHAZADOS' ELSE 'alguno paso (mal)' END,
    sin_motivo AND misma);
END $$;

-- M4 · Un tipo que no puede ser principal, no lo es.
DO $$
DECLARE ok boolean := false;
BEGIN
  BEGIN
    INSERT INTO nucleo.membresias_sede (persona_id, sede_id, tipo, es_principal)
    VALUES ((SELECT v FROM lab WHERE k='ana'), (SELECT v FROM lab WHERE k='med'), 'servidor', true);
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation
                 OR insufficient_privilege OR raise_exception OR no_data_found
                 THEN ok := true; END;
  PERFORM pg_temp.rg(4,'Un servidor se marca como sede principal','RECHAZADO como debe',
    CASE WHEN ok THEN 'RECHAZADO como debe' ELSE 'ACEPTADO (mal)' END, ok);
END $$;

-- M5 · Sirve en Medellín sin dejar de congregar en Chicó.
DO $$
DECLARE n int;
BEGIN
  INSERT INTO nucleo.membresias_sede (persona_id, sede_id, tipo, es_principal, motivo)
  VALUES ((SELECT v FROM lab WHERE k='ana'), (SELECT v FROM lab WHERE k='med'), 'servidor', false,
          'Sirve en el equipo de alabanza de Medellin');
  SELECT count(*) INTO n FROM nucleo.membresias_sede
   WHERE persona_id=(SELECT v FROM lab WHERE k='ana') AND hasta IS NULL;
  PERFORM pg_temp.rg(5,'Congregar en una sede y servir en otra','2 membresias vigentes', n||' vigentes', n=2);
END $$;

-- M6 · Dos membresías vigentes en la MISMA sede se rechazan.
DO $$
DECLARE ok boolean := false;
BEGIN
  BEGIN
    INSERT INTO nucleo.membresias_sede (persona_id, sede_id, tipo)
    VALUES ((SELECT v FROM lab WHERE k='ana'), (SELECT v FROM lab WHERE k='med'), 'invitado');
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation
                 OR insufficient_privilege OR raise_exception OR no_data_found
                 THEN ok := true; END;
  PERFORM pg_temp.rg(6,'Dos membresias vigentes en la misma sede','RECHAZADO como debe',
    CASE WHEN ok THEN 'RECHAZADO como debe' ELSE 'ACEPTADO (mal)' END, ok);
END $$;

-- ═══ EL TRASLADO ═══
DO $$
BEGIN
  PERFORM nucleo.trasladar((SELECT v FROM lab WHERE k='ana'), (SELECT v FROM lab WHERE k='chia'),
    'Se muda a Chia por trabajo', NULL, 'ACTA-2026-114');
END $$;

-- M7 · La sede principal cambió y quedó la fecha.
DO $$
DECLARE v_sede uuid; v_desde date; v_cerrada date;
BEGIN
  SELECT sede_id, desde INTO v_sede, v_desde FROM nucleo.membresias_sede
   WHERE persona_id=(SELECT v FROM lab WHERE k='ana') AND es_principal AND hasta IS NULL;
  SELECT hasta INTO v_cerrada FROM nucleo.membresias_sede
   WHERE persona_id=(SELECT v FROM lab WHERE k='ana') AND sede_id=(SELECT v FROM lab WHERE k='chico');
  PERFORM pg_temp.rg(7,'El traslado deja fecha de entrada y de salida','Chia con fecha, Chico cerrada',
    CASE WHEN v_sede=(SELECT v FROM lab WHERE k='chia') AND v_desde IS NOT NULL AND v_cerrada IS NOT NULL
         THEN 'Chia con fecha, Chico cerrada' ELSE 'incompleto' END,
    v_sede=(SELECT v FROM lab WHERE k='chia') AND v_desde IS NOT NULL AND v_cerrada IS NOT NULL);
END $$;

-- M8 · ⭐ LA PRUEBA ESTRELLA · Chía NO ve el aporte que Ana dio en Chicó.
DO $$
DECLARE n int; v_sede uuid; v_ana uuid;
BEGIN
  SELECT v INTO v_sede FROM lab WHERE k='chia';
  SELECT v INTO v_ana  FROM lab WHERE k='ana';
  SET LOCAL ROLE casaroca_app;
  PERFORM set_config('app.sede_ids','{'||v_sede::text||'}',true);
  PERFORM set_config('app.nivel_max','4',true);
  SELECT count(*) INTO n FROM aportes.aportes WHERE persona_id=v_ana;
  RESET ROLE;
  PERFORM pg_temp.rg(8,'La sede destino hereda los aportes de la sede anterior',
    '0 aportes', n||' aportes', n=0);
END $$;

-- M9 · Y Chicó SIGUE viendo el aporte que recibió. Su historia no se movió.
DO $$
DECLARE n int; v_sede uuid; v_ana uuid;
BEGIN
  SELECT v INTO v_sede FROM lab WHERE k='chico';
  SELECT v INTO v_ana  FROM lab WHERE k='ana';
  SET LOCAL ROLE casaroca_app;
  PERFORM set_config('app.sede_ids','{'||v_sede::text||'}',true);
  PERFORM set_config('app.nivel_max','4',true);
  SELECT count(*) INTO n FROM aportes.aportes WHERE persona_id=v_ana;
  RESET ROLE;
  PERFORM pg_temp.rg(9,'La sede anterior pierde su propia historia','1 aporte', n||' aporte(s)', n=1);
END $$;

-- M10 · Chicó sigue VIENDO a Ana (fue suya ocho años) pero ya no la edita.
DO $$
DECLARE ve int; edito boolean := true; v_sede uuid; v_ana uuid;
BEGIN
  SELECT v INTO v_sede FROM lab WHERE k='chico';
  SELECT v INTO v_ana  FROM lab WHERE k='ana';
  SET LOCAL ROLE casaroca_app;
  PERFORM set_config('app.sede_ids','{'||v_sede::text||'}',true);
  PERFORM set_config('app.nivel_max','4',true);
  SELECT count(*) INTO ve FROM nucleo.personas WHERE id=v_ana;
  UPDATE nucleo.personas SET segundo_nombre='NoDeberia' WHERE id=v_ana;
  IF NOT FOUND THEN edito := false; END IF;
  RESET ROLE;
  PERFORM pg_temp.rg(10,'La sede anterior puede seguir editando a quien ya no es suyo',
    've 1, edita 0', 've '||ve||', edita '||CASE WHEN edito THEN '1' ELSE '0' END,
    ve=1 AND NOT edito);
END $$;

-- M11 · Chía sí la ve y sí la edita.
DO $$
DECLARE ve int; edito boolean := false; v_sede uuid; v_ana uuid;
BEGIN
  SELECT v INTO v_sede FROM lab WHERE k='chia';
  SELECT v INTO v_ana  FROM lab WHERE k='ana';
  SET LOCAL ROLE casaroca_app;
  PERFORM set_config('app.sede_ids','{'||v_sede::text||'}',true);
  PERFORM set_config('app.nivel_max','4',true);
  SELECT count(*) INTO ve FROM nucleo.personas WHERE id=v_ana;
  UPDATE nucleo.personas SET segundo_nombre='Maria' WHERE id=v_ana;
  IF FOUND THEN edito := true; END IF;
  RESET ROLE;
  PERFORM pg_temp.rg(11,'La sede nueva no puede trabajar con quien recibio',
    've 1, edita 1', 've '||ve||', edita '||CASE WHEN edito THEN '1' ELSE '0' END, ve=1 AND edito);
END $$;

-- M12 · Una sede que nunca la tuvo (Barcelona) no la ve.
DO $$
DECLARE n int; v_sede uuid; v_ana uuid;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BCN';
  SELECT v  INTO v_ana  FROM lab WHERE k='ana';
  SET LOCAL ROLE casaroca_app;
  PERFORM set_config('app.sede_ids','{'||v_sede::text||'}',true);
  PERFORM set_config('app.nivel_max','4',true);
  SELECT count(*) INTO n FROM nucleo.personas WHERE id=v_ana;
  RESET ROLE;
  PERFORM pg_temp.rg(12,'Una sede ajena ve a alguien que nunca fue suyo','0', n||'', n=0);
END $$;

-- M13 · El traslado quedó en la línea de tiempo de la persona.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM crm.linea_tiempo
   WHERE persona_id=(SELECT v FROM lab WHERE k='ana') AND tipo='TRASLADO_SEDE';
  PERFORM pg_temp.rg(13,'El traslado no queda en la linea de tiempo','1 hecho', n||' hecho(s)', n=1);
END $$;

-- M14 · La membresía de otra sede no se ve desde la mía.
DO $$
-- ⛔ La primera version de esta prueba exigia CERO filas en total, y
--    fallaba en cuanto otro banco creaba una persona en Barcelona: una
--    membresia legitima de BCN. Lo que hay que probar no es que la sede
--    no vea nada, sino que no vea lo AJENO.
DECLARE n int; v_sede uuid; v_ana uuid;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BCN';
  SELECT v  INTO v_ana  FROM lab WHERE k='ana';
  SET LOCAL ROLE casaroca_app;
  PERFORM set_config('app.sede_ids','{'||v_sede::text||'}',true);
  PERFORM set_config('app.nivel_max','4',true);
  SELECT count(*) INTO n FROM nucleo.membresias_sede WHERE persona_id = v_ana;
  RESET ROLE;
  PERFORM pg_temp.rg(14,'Una sede ve membresias de otras sedes','0 filas', n||' filas', n=0);
END $$;

-- Limpieza del laboratorio.
-- ⛔ `nucleo.personas` tiene la regla `personas_no_delete`: un DELETE se
--    ignora EN SILENCIO (borrado logico unicamente, que es lo correcto).
--    La primera version de estas limpiezas borraba la membresia y creia
--    haber borrado la persona: quedaban personas vivas sin membresia y el
--    banco 1 se ponia rojo dos bancos despues. Aqui se borra como manda el
--    modelo: marcando.
DELETE FROM crm.linea_tiempo WHERE persona_id=(SELECT v FROM lab WHERE k='ana');
DELETE FROM aportes.aportes  WHERE persona_id=(SELECT v FROM lab WHERE k='ana');
UPDATE nucleo.membresias_sede SET hasta = CURRENT_DATE, es_principal = false
 WHERE persona_id=(SELECT v FROM lab WHERE k='ana') AND hasta IS NULL;
UPDATE nucleo.personas SET eliminado_en = now(), estado = 'inactiva'
 WHERE id=(SELECT v FROM lab WHERE k='ana');

\echo ''
\echo '===== MEMBRESIA POR SEDE: EL PASADO NO SE REESCRIBE ====='
SELECT n AS "#", caso AS invariante, obtenido AS resultado,
       CASE WHEN pasa THEN 'PASA' ELSE 'FALLA' END AS veredicto
FROM m_res ORDER BY n;
SELECT count(*) FILTER (WHERE pasa) AS pasan,
       count(*) FILTER (WHERE NOT pasa) AS fallan, count(*) AS total FROM m_res;

DO $$
DECLARE v int;
BEGIN
  SELECT count(*) FILTER (WHERE NOT pasa) INTO v FROM m_res;
  IF v > 0 THEN RAISE EXCEPTION 'BANCO EN ROJO: % invariante(s) rota(s) en membresias_sede.sql', v; END IF;
END $$;
