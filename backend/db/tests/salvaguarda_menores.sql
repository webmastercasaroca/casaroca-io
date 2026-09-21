-- =====================================================================
-- Banco: SALVAGUARDA DE MENORES Y DERECHOS DEL TITULAR (migración 0049)
--
-- El sistema protegía el dato del menor y no verificaba a quien está con
-- el menor. Estas pruebas cierran esa contradicción.
-- =====================================================================
\set ON_ERROR_STOP on
CREATE TEMP TABLE v_res(n int, caso text, esperado text, obtenido text, pasa boolean);
CREATE FUNCTION pg_temp.rg(a int, b text, c text, d text, e boolean) RETURNS void
LANGUAGE sql AS $$ INSERT INTO v_res VALUES (a,b,c,d,e) $$;
CREATE TEMP TABLE vlab(k text PRIMARY KEY, v uuid);

DO $$
DECLARE v_sede uuid; v_p uuid; v_sala uuid;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-CHICO';
  INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido, fecha_nacimiento)
  VALUES (v_sede,'Maestra','DePrueba','1995-04-04') RETURNING id INTO v_p;
  -- ⛔ Antes esto era `SELECT id FROM rocakids.salas LIMIT 1`, sin orden y
  --    sobre una sala SEMBRADA que comparten todos. Dos consecuencias: el
  --    «LIMIT 1» podia devolver otra sala en otra corrida, y la prueba V7
  --    («una sala con UN adulto avisa») contaba los adultos que hubieran
  --    quedado de corridas anteriores. Pasaba en base nueva y fallaba en
  --    base usada, que es la peor clase de prueba. La sala es SUYA.
  INSERT INTO rocakids.salas (sede_id, codigo, nombre, edad_min, edad_max, capacidad, activa)
  VALUES (v_sede,'LAB-SALV-'||substr(md5(clock_timestamp()::text),1,6),
          'Sala de laboratorio · salvaguarda', 0, 17, 30, true)
  RETURNING id INTO v_sala;
  INSERT INTO vlab VALUES ('sede',v_sede),('persona',v_p),('sala',v_sala);
END $$;

-- V1 · ⭐ Sin antecedentes NO se puede ser maestro de ninos.
DO $$
DECLARE ok boolean := false; msg text;
BEGIN
  BEGIN
    INSERT INTO identidad.asignaciones (persona_id, rol, alcance_tipo, alcance_id, nivel_max)
    VALUES ((SELECT v FROM vlab WHERE k='persona'),'MAESTRO_ROCAKIDS','ministerio',
            (SELECT id FROM org.ministerios LIMIT 1), 4);
  EXCEPTION WHEN others THEN ok := true; msg := SQLERRM; END;
  PERFORM pg_temp.rg(1,'Se puede ser maestro de ninos sin antecedentes','RECHAZADO con la lista de lo que falta',
    CASE WHEN ok AND msg ~ 'antecedentes' THEN 'RECHAZADO con la lista' ELSE coalesce(msg,'ACEPTADO (mal)') END,
    ok AND msg ~ 'antecedentes');
END $$;

-- V2 · Tampoco se puede estar en una sala de ninos.
DO $$
DECLARE ok boolean := false;
BEGIN
  BEGIN
    INSERT INTO rocakids.servidores_sala (sala_id, persona_id, sede_id)
    VALUES ((SELECT v FROM vlab WHERE k='sala'),(SELECT v FROM vlab WHERE k='persona'),
            (SELECT v FROM vlab WHERE k='sede'));
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation
                 OR insufficient_privilege OR raise_exception OR no_data_found
                 THEN ok := true; END;
  PERFORM pg_temp.rg(2,'Se puede servir en una sala de ninos sin antecedentes','RECHAZADO como debe',
    CASE WHEN ok THEN 'RECHAZADO como debe' ELSE 'ACEPTADO (mal)' END, ok);
END $$;

-- V3 · Con TODOS los antecedentes vigentes, sí.
DO $$
DECLARE ok boolean := true;
BEGIN
  INSERT INTO talento.antecedentes (persona_id, tipo, resultado, expedido_en, vence_en, sede_id)
  SELECT (SELECT v FROM vlab WHERE k='persona'), t.codigo, 'apto',
         CURRENT_DATE - 30, CURRENT_DATE + 300, (SELECT v FROM vlab WHERE k='sede')
  FROM talento.tipos_antecedente t WHERE t.exigido_para_menores;

  BEGIN
    INSERT INTO identidad.asignaciones (persona_id, rol, alcance_tipo, alcance_id, nivel_max)
    VALUES ((SELECT v FROM vlab WHERE k='persona'),'MAESTRO_ROCAKIDS','ministerio',
            (SELECT id FROM org.ministerios LIMIT 1), 4);
  EXCEPTION WHEN others THEN ok := false; END;
  PERFORM pg_temp.rg(3,'Con antecedentes vigentes no deja asignar el rol','ACEPTADO',
    CASE WHEN ok THEN 'ACEPTADO' ELSE 'rechazado (mal)' END, ok);
END $$;

-- V4 · ⭐ Basta que UNO venza para dejar de ser apto.
DO $$
DECLARE apto_antes boolean; apto_despues boolean;
BEGIN
  apto_antes := talento.apto_para_menores((SELECT v FROM vlab WHERE k='persona'));
  UPDATE talento.antecedentes SET vence_en = CURRENT_DATE - 1
   WHERE persona_id=(SELECT v FROM vlab WHERE k='persona') AND tipo='DELITOS_SEXUALES';
  apto_despues := talento.apto_para_menores((SELECT v FROM vlab WHERE k='persona'));
  PERFORM pg_temp.rg(4,'Un antecedente vencido no quita la aptitud','apto antes, no apto despues',
    'antes '||apto_antes||', despues '||apto_despues, apto_antes AND NOT apto_despues);
END $$;

-- V5 · Y con uno vencido, ya no se puede asignar el rol otra vez.
DO $$
DECLARE ok boolean := false;
BEGIN
  BEGIN
    INSERT INTO identidad.asignaciones (persona_id, rol, alcance_tipo, alcance_id, nivel_max)
    VALUES ((SELECT v FROM vlab WHERE k='persona'),'DIRECTOR_ROCAKIDS','ministerio',
            (SELECT id FROM org.ministerios LIMIT 1), 4);
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation
                 OR insufficient_privilege OR raise_exception OR no_data_found
                 THEN ok := true; END;
  PERFORM pg_temp.rg(5,'Con un antecedente vencido deja asignar otro rol de menores','RECHAZADO como debe',
    CASE WHEN ok THEN 'RECHAZADO como debe' ELSE 'ACEPTADO (mal)' END, ok);
END $$;

-- V6 · La lista avisa ANTES de que venza, no despues.
DO $$
DECLARE n int;
BEGIN
  UPDATE talento.antecedentes SET vence_en = CURRENT_DATE + 20
   WHERE persona_id=(SELECT v FROM vlab WHERE k='persona') AND tipo='DELITOS_SEXUALES';
  SELECT count(*) INTO n FROM talento.v_antecedentes_por_vencer
   WHERE persona_id=(SELECT v FROM vlab WHERE k='persona');
  PERFORM pg_temp.rg(6,'No hay aviso previo de vencimiento','al menos 1', n||'', n >= 1);
END $$;

-- V7 · Una sala con un solo adulto aparece en la alerta del domingo.
DO $$
DECLARE n int;
BEGIN
  INSERT INTO rocakids.servidores_sala (sala_id, persona_id, sede_id)
  VALUES ((SELECT v FROM vlab WHERE k='sala'),(SELECT v FROM vlab WHERE k='persona'),
          (SELECT v FROM vlab WHERE k='sede'));
  SELECT count(*) INTO n FROM rocakids.v_salas_sin_dos_adultos
   WHERE sala_id=(SELECT v FROM vlab WHERE k='sala') AND fecha=CURRENT_DATE;
  PERFORM pg_temp.rg(7,'Una sala con un solo adulto no genera alerta','1 alerta', n||'', n = 1);
END $$;

-- V8 · Habeas Data: la consulta vence a los 10 dias habiles y el reclamo a los 15.
DO $$
DECLARE v_c date; v_r date; v_rad text;
BEGIN
  INSERT INTO plataforma.peticiones_titular (tipo, titular_nombre, titular_contacto, detalle, canal, sede_id)
  VALUES ('consulta','Titular DePrueba','titular@ejemplo.org','Quiere saber que datos tienen de el','correo',
          (SELECT v FROM vlab WHERE k='sede'))
  RETURNING vence_en, radicado INTO v_c, v_rad;

  INSERT INTO plataforma.peticiones_titular (tipo, titular_nombre, titular_contacto, detalle, canal, sede_id)
  VALUES ('reclamo','Titular DePrueba','titular@ejemplo.org','Un dato suyo esta mal','correo',
          (SELECT v FROM vlab WHERE k='sede'))
  RETURNING vence_en INTO v_r;

  PERFORM pg_temp.rg(8,'Los plazos de la Ley 1581 no se calculan solos',
    'consulta 10 habiles, reclamo 15 habiles',
    'consulta '||v_c||', reclamo '||v_r||', radicado '||coalesce(v_rad,'sin'),
    v_c = plataforma.dias_habiles_desde(CURRENT_DATE,10)
    AND v_r = plataforma.dias_habiles_desde(CURRENT_DATE,15)
    AND v_rad IS NOT NULL);
END $$;

-- V9 · Una peticion fuera de plazo sale en la lista de incumplimiento.
DO $$
DECLARE n int;
BEGIN
  UPDATE plataforma.peticiones_titular SET vence_en = CURRENT_DATE - 3
   WHERE titular_nombre='Titular DePrueba' AND tipo='consulta';
  SELECT count(*) INTO n FROM plataforma.v_peticiones_titular_vencidas;
  PERFORM pg_temp.rg(9,'Una peticion vencida no se ve','al menos 1', n||'', n >= 1);
END $$;

-- V10 · Todo tipo de antecedente exigido para menores tiene vigencia finita.
DO $$
DECLARE eternos int;
BEGIN
  SELECT count(*) INTO eternos FROM talento.tipos_antecedente
   WHERE exigido_para_menores AND (meses_vigencia IS NULL OR meses_vigencia > 36);
  PERFORM pg_temp.rg(10,'Un antecedente de menores vale para siempre','0', eternos||'', eternos = 0);
END $$;

-- =====================================================================
-- V11 a V13 · EL CHECK-IN NO REVIENTA POR UNA SALIDA DE LA SEMANA PASADA
--             (migración 0057)
--
-- ⛔ `checkin_abierto_uq UNIQUE (menor_id) WHERE salida_en IS NULL` dice
--    que un menor no puede estar en dos salas a la vez. Correcto. Pero la
--    idempotencia buscaba por (menor, SALA, dia), asi que un ingreso
--    abierto en OTRA sala llegaba al INSERT y reventaba con un 23505 en
--    crudo, en la pantalla, un domingo a las nueve, y por culpa de una
--    salida que nadie registro el domingo ANTERIOR.
-- =====================================================================
DO $$
DECLARE v_sede uuid; v_menor uuid; v_acu uuid; v_s1 uuid; v_s2 uuid; v_maestro uuid;
        sx text := substr(md5(clock_timestamp()::text),1,8);
BEGIN
  SELECT v INTO v_sede FROM vlab WHERE k='sede';
  INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido, fecha_nacimiento)
  VALUES (v_sede,'MenorCheckin','DePrueba', CURRENT_DATE - interval '7 years')
  RETURNING id INTO v_menor;
  INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido, fecha_nacimiento)
  VALUES (v_sede,'AcudienteCheckin','DePrueba','1988-02-02') RETURNING id INTO v_acu;
  INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido, fecha_nacimiento)
  VALUES (v_sede,'MaestroCheckin','DePrueba','1990-02-02') RETURNING id INTO v_maestro;
  SET CONSTRAINTS ALL DEFERRED;
  INSERT INTO nucleo.acudientes (menor_id, acudiente_id, parentesco, autoriza_retiro)
  VALUES (v_menor, v_acu, 'MADRE', true);
  SET CONSTRAINTS ALL IMMEDIATE;

  -- Dos salas de laboratorio que cubran la edad del menor, en esta sede.
  INSERT INTO rocakids.salas (sede_id, codigo, nombre, edad_min, edad_max, capacidad, activa)
  VALUES (v_sede,'LABA-'||sx,'Sala Lab A '||sx, 0, 17, 30, true) RETURNING id INTO v_s1;
  INSERT INTO rocakids.salas (sede_id, codigo, nombre, edad_min, edad_max, capacidad, activa)
  VALUES (v_sede,'LABB-'||sx,'Sala Lab B '||sx, 0, 17, 30, true) RETURNING id INTO v_s2;

  -- Dos adultos en cada sala: la regla de los dos adultos no es lo que se
  -- esta probando aqui y no debe enturbiar el resultado. Pero la
  -- salvaguarda SI aplica (y bien: el banco lo demostro al escribirla),
  -- asi que los dos llevan antecedentes vigentes de laboratorio.
  INSERT INTO talento.antecedentes (persona_id, tipo, resultado, expedido_en, vence_en, sede_id)
  SELECT p.id, t.codigo, 'apto', CURRENT_DATE - 30, CURRENT_DATE + 300, v_sede
  FROM (VALUES (v_maestro),(v_acu)) AS p(id), talento.tipos_antecedente t
  WHERE t.exigido_para_menores;

  INSERT INTO rocakids.servidores_sala (sala_id, persona_id, sede_id, fecha)
  VALUES (v_s1, v_maestro, v_sede, CURRENT_DATE), (v_s1, v_acu, v_sede, CURRENT_DATE),
         (v_s2, v_maestro, v_sede, CURRENT_DATE), (v_s2, v_acu, v_sede, CURRENT_DATE);

  INSERT INTO vlab VALUES ('menor_ck',v_menor),('acu_ck',v_acu),('maestro_ck',v_maestro),
                          ('sala1_ck',v_s1),('sala2_ck',v_s2);
END $$;

-- V11 · Se quedo un ingreso ABIERTO del domingo pasado. El de hoy pasa.
DO $$
DECLARE v_menor uuid; v_s1 uuid; v_s2 uuid; v_acu uuid; v_m uuid;
        v_viejo uuid; ok boolean := false; v_aviso text; err text;
BEGIN
  SELECT v INTO v_menor FROM vlab WHERE k='menor_ck';
  SELECT v INTO v_s1 FROM vlab WHERE k='sala1_ck';
  SELECT v INTO v_s2 FROM vlab WHERE k='sala2_ck';
  SELECT v INTO v_acu FROM vlab WHERE k='acu_ck';
  SELECT v INTO v_m FROM vlab WHERE k='maestro_ck';

  PERFORM set_config('app.llave_n4','llave-dev',true);

  INSERT INTO rocakids.checkins (menor_id, sala_id, sede_id, entregado_por, recibido_por,
                                 ingreso_en, codigo_cifrado)
  VALUES (v_menor, v_s1, (SELECT v FROM vlab WHERE k='sede'), v_acu, v_m,
          now() - interval '7 days', pgp_sym_encrypt('LAB1','llave-dev'))
  RETURNING id INTO v_viejo;

  BEGIN
    SELECT aviso INTO v_aviso FROM rocakids.registrar_checkin(v_menor, v_s2, v_acu, v_m);
    ok := true;
  EXCEPTION WHEN others THEN err := SQLERRM;
  END;

  PERFORM pg_temp.rg(11,'Un ingreso sin salida de otro dia revienta el check-in de hoy',
    'se registra igual',
    CASE WHEN ok THEN 'se registra igual' ELSE 'REVENTO: '||COALESCE(err,'?') END, ok);

  PERFORM pg_temp.rg(12,'El ingreso viejo queda cerrado en SU dia, no en el de hoy',
    'cerrado el dia que fue',
    COALESCE((SELECT CASE WHEN salida_en::date = (now() - interval '7 days')::date
                          THEN 'cerrado el dia que fue'
                          ELSE 'cerrado el '||salida_en::date::text END
              FROM rocakids.checkins WHERE id = v_viejo), 'sigue abierto'),
    (SELECT salida_en::date = (now() - interval '7 days')::date
       FROM rocakids.checkins WHERE id = v_viejo));
END $$;

-- V13 · Y el cambio de sala el MISMO dia tampoco revienta.
DO $$
DECLARE v_menor uuid; v_s1 uuid; v_acu uuid; v_m uuid; ok boolean := false; err text;
BEGIN
  SELECT v INTO v_menor FROM vlab WHERE k='menor_ck';
  SELECT v INTO v_s1 FROM vlab WHERE k='sala1_ck';
  SELECT v INTO v_acu FROM vlab WHERE k='acu_ck';
  SELECT v INTO v_m FROM vlab WHERE k='maestro_ck';
  PERFORM set_config('app.llave_n4','llave-dev',true);
  BEGIN
    PERFORM rocakids.registrar_checkin(v_menor, v_s1, v_acu, v_m);
    ok := true;
  EXCEPTION WHEN others THEN err := SQLERRM;
  END;
  PERFORM pg_temp.rg(13,'Cambiar de sala el mismo dia revienta',
    'se registra igual',
    CASE WHEN ok THEN 'se registra igual' ELSE 'REVENTO: '||COALESCE(err,'?') END, ok);
END $$;

-- Limpieza.
DELETE FROM plataforma.peticiones_titular WHERE titular_nombre='Titular DePrueba';
DELETE FROM rocakids.checkins WHERE menor_id IN (SELECT v FROM vlab WHERE k='menor_ck');
DELETE FROM rocakids.servidores_sala WHERE persona_id IN (SELECT v FROM vlab);
DELETE FROM rocakids.servidores_sala WHERE sala_id IN (SELECT v FROM vlab WHERE k IN ('sala','sala1_ck','sala2_ck'));
DELETE FROM rocakids.salas WHERE id IN (SELECT v FROM vlab WHERE k IN ('sala','sala1_ck','sala2_ck'));
-- ⛔ El vinculo con el acudiente NO se borra: `tg_no_dejar_menor_sin_acudiente`
--    lo impide, y tiene razon. Un menor no se queda sin acudiente ni en una
--    prueba. El menor se da de baja como todos los demas, marcandolo.
DELETE FROM identidad.asignaciones WHERE persona_id IN (SELECT v FROM vlab);
DELETE FROM talento.antecedentes WHERE persona_id IN (SELECT v FROM vlab);
-- ⛔ `nucleo.personas` tiene la regla `personas_no_delete`: un DELETE se
--    ignora EN SILENCIO (borrado logico unicamente, que es lo correcto).
--    La primera version de estas limpiezas borraba la membresia y creia
--    haber borrado la persona: quedaban personas vivas sin membresia y el
--    banco 1 se ponia rojo dos bancos despues. Aqui se borra como manda el
--    modelo: marcando.
UPDATE nucleo.membresias_sede SET hasta = CURRENT_DATE, es_principal = false
 WHERE persona_id IN (SELECT v FROM vlab WHERE k IN ('persona','menor_ck','acu_ck','maestro_ck'))
   AND hasta IS NULL;
UPDATE nucleo.personas SET eliminado_en = now(), estado = 'inactiva'
 WHERE id IN (SELECT v FROM vlab WHERE k IN ('persona','menor_ck','acu_ck','maestro_ck'));

\echo ''
\echo '===== SALVAGUARDA DE MENORES Y DERECHOS DEL TITULAR ====='
SELECT n AS "#", caso AS invariante, obtenido AS resultado,
       CASE WHEN pasa THEN 'PASA' ELSE 'FALLA' END AS veredicto
FROM v_res ORDER BY n;
SELECT count(*) FILTER (WHERE pasa) AS pasan,
       count(*) FILTER (WHERE NOT pasa) AS fallan, count(*) AS total FROM v_res;

DO $$
DECLARE v int;
BEGIN
  SELECT count(*) FILTER (WHERE NOT pasa) INTO v FROM v_res;
  IF v > 0 THEN RAISE EXCEPTION 'BANCO EN ROJO: % invariante(s) rota(s) en salvaguarda_menores.sql', v; END IF;
END $$;
