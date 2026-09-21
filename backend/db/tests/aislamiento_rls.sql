-- =====================================================================
-- PRUEBA DE AISLAMIENTO ENTRE SEDES (la segunda cerradura)
--
-- Responde literalmente la pregunta del Comité de Tecnología:
--        «¿cómo garantizan que Panamá no vea Barcelona?»
--
-- La prueba se hace CONECTADA COMO LA APLICACIÓN (`casaroca_app`), no
-- como superusuario: un superusuario salta RLS siempre, así que probar
-- el aislamiento desde una sesión de administrador no demuestra nada.
--
-- Lo importante: las consultas NO llevan filtro de sede. Piden «todas
-- las personas». Es exactamente el descuido que la segunda cerradura
-- tiene que atajar.
-- Todos los datos son sintéticos: los crea la propia prueba.
-- =====================================================================
\set ON_ERROR_STOP on

CREATE TEMP TABLE _rls (n int, escenario text, esperado text, obtenido text, paso boolean);
-- La tabla de resultados la escribe la sesión ya degradada a casaroca_app.
GRANT INSERT, SELECT ON _rls TO casaroca_app;

-- ── Preparación (como administrador, antes de bajar de privilegio) ────
DO $$
DECLARE v_pty uuid; v_bcn uuid; v_bog uuid; v_adulto uuid;
BEGIN
  SELECT id INTO v_pty FROM org.sedes WHERE codigo='PTY';
  SELECT id INTO v_bcn FROM org.sedes WHERE codigo='BCN';
  SELECT id INTO v_bog FROM org.sedes WHERE codigo='BOG-CHICO';

  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_pty,'Persona','DePanama', CURRENT_DATE - interval '30 years'),
         (v_pty,'Otra','DePanama',    CURRENT_DATE - interval '41 years'),
         (v_bcn,'Persona','DeBarcelona', CURRENT_DATE - interval '35 years'),
         (v_bog,'Persona','DeBogota',    CURRENT_DATE - interval '28 years');

  -- Un menor en Panamá, con su acudiente, para probar el nivel N4.
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_pty,'Madre','Panamena', CURRENT_DATE - interval '33 years') RETURNING id INTO v_adulto;
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_pty,'Nino','Panameno', CURRENT_DATE - interval '7 years');
  INSERT INTO nucleo.acudientes (menor_id,acudiente_id,parentesco)
  SELECT p.id, v_adulto, 'MADRE' FROM nucleo.personas p
   WHERE p.primer_nombre='Nino' AND p.primer_apellido='Panameno';
  SET CONSTRAINTS ALL IMMEDIATE;
END $$;

GRANT SELECT ON org.sedes TO casaroca_app;

-- =====================================================================
-- A PARTIR DE AQUÍ SOMOS LA APLICACIÓN, NO EL ADMINISTRADOR.
-- =====================================================================
SET ROLE casaroca_app;

-- E1 · Sesión SIN contexto: no debe ver absolutamente nada.
DO $$
DECLARE v_n bigint;
BEGIN
  SELECT count(*) INTO v_n FROM nucleo.personas;   -- sin WHERE, a propósito
  INSERT INTO _rls VALUES (1,'Sesion sin contexto de sede','0 filas', v_n::text||' filas', v_n = 0);
END $$;

-- E2/E3 · Sesión de PANAMÁ: ve Panamá y NADA de Barcelona ni Bogotá.
DO $$
DECLARE v_pty uuid; v_total bigint; v_ajenas bigint;
BEGIN
  SELECT id INTO v_pty FROM org.sedes WHERE codigo='PTY';
  PERFORM set_config('app.sede_ids', '{'||v_pty::text||'}', true);
  PERFORM set_config('app.nivel_max','2', true);

  SELECT count(*) INTO v_total   FROM nucleo.personas;
  SELECT count(*) INTO v_ajenas  FROM nucleo.personas WHERE sede_id <> v_pty;

  INSERT INTO _rls VALUES (2,'Panama ve sus propias filas','>0', v_total::text||' filas', v_total > 0);
  INSERT INTO _rls VALUES (3,'Panama NO ve Barcelona ni Bogota','0 ajenas', v_ajenas::text||' ajenas', v_ajenas = 0);
END $$;

-- E4 · Panamá no puede ESCRIBIR en una sede ajena.
DO $$
DECLARE v_bcn uuid;
BEGIN
  SELECT id INTO v_bcn FROM org.sedes WHERE codigo='BCN';
  BEGIN
    INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
    VALUES (v_bcn,'Intruso','EnBarcelona',CURRENT_DATE - interval '25 years');
    INSERT INTO _rls VALUES (4,'Panama escribiendo en Barcelona','RECHAZADA','ACEPTADA',false);
  EXCEPTION WHEN insufficient_privilege THEN
    INSERT INTO _rls VALUES (4,'Panama escribiendo en Barcelona','RECHAZADA','RECHAZADA por RLS',true);
  END;
END $$;

-- E5 · Nivel N2 no alcanza para leer acudientes (N4), AUNQUE la sede sea la suya.
-- Nota: el contexto se vuelve a fijar en cada bloque a propósito. `set_config`
-- con `is_local = true` vive solo dentro de la transacción, y cada bloque corre
-- en la suya. Eso NO es un estorbo de la prueba: es la garantía de que el
-- contexto de una petición no se filtra a la siguiente en un pool de conexiones.
DO $$
DECLARE v_n bigint; v_pty uuid;
BEGIN
  SELECT id INTO v_pty FROM org.sedes WHERE codigo='PTY';
  PERFORM set_config('app.sede_ids', '{'||v_pty::text||'}', true);
  PERFORM set_config('app.nivel_max','2', true);
  SELECT count(*) INTO v_n FROM nucleo.acudientes;
  INSERT INTO _rls VALUES (5,'Nivel N2 leyendo datos N4 (menores)','0 filas', v_n::text||' filas', v_n = 0);
END $$;

-- E6 · Con nivel N4 y la sede correcta, sí ve a los menores de SU sede.
DO $$
DECLARE v_n bigint; v_pty uuid;
BEGIN
  SELECT id INTO v_pty FROM org.sedes WHERE codigo='PTY';
  PERFORM set_config('app.sede_ids', '{'||v_pty::text||'}', true);
  PERFORM set_config('app.nivel_max','4', true);
  SELECT count(*) INTO v_n FROM nucleo.acudientes;
  INSERT INTO _rls VALUES (6,'Nivel N4 en su propia sede','>0', v_n::text||' filas', v_n > 0);
END $$;

-- E7 · Alcance de organización (Pastor Director General): ve todas las sedes.
DO $$
DECLARE v_sedes bigint;
BEGIN
  PERFORM set_config('app.sede_ids','', true);
  PERFORM set_config('app.alcance_global','true', true);
  PERFORM set_config('app.nivel_max','4', true);
  SELECT count(DISTINCT sede_id) INTO v_sedes FROM nucleo.personas;
  INSERT INTO _rls VALUES (7,'Alcance de organizacion ve todas las sedes','>1 sede',
                           v_sedes::text||' sedes', v_sedes > 1);
END $$;

-- E9 · El contexto NO sobrevive a la transacción: la siguiente petición
-- que reuse la conexión del pool arranca ciega. Es la defensa contra el
-- fallo clásico de multi-tenancy: heredar el tenant del usuario anterior.
DO $$
DECLARE v_n bigint;
BEGIN
  SELECT count(*) INTO v_n FROM nucleo.personas;
  INSERT INTO _rls VALUES (9,'El contexto no se filtra entre transacciones','0 filas',
                           v_n::text||' filas', v_n = 0);
END $$;

-- E8 · La aplicación NO puede saltarse RLS aunque lo intente.
DO $$
DECLARE v_puede boolean;
BEGIN
  SELECT rolbypassrls INTO v_puede FROM pg_roles WHERE rolname = 'casaroca_app';
  INSERT INTO _rls VALUES (8,'El rol de la aplicacion no puede saltar RLS','false', v_puede::text, v_puede = false);
END $$;

RESET ROLE;

\echo ''
\echo '===== AISLAMIENTO ENTRE SEDES (segunda cerradura) ====='
SELECT n AS "#", escenario, obtenido AS "resultado",
       CASE WHEN paso THEN 'PASA' ELSE 'FALLA' END AS "veredicto"
FROM _rls ORDER BY n;

SELECT count(*) FILTER (WHERE paso) AS "pasan",
       count(*) FILTER (WHERE NOT paso) AS "fallan",
       count(*) AS "total"
FROM _rls;


-- ⛔ COMPUERTA. Sin esto, el banco IMPRIME los fallos y devuelve exito: la
--    integracion continua daria por buena una invariante rota. Se descubrio
--    el 19 de septiembre de 2026: 7 de los 8 bancos eran un informe, no una
--    compuerta.
DO $$
DECLARE v int;
BEGIN
  SELECT count(*) FILTER (WHERE NOT paso) INTO v FROM _rls;
  IF v > 0 THEN
    RAISE EXCEPTION 'BANCO EN ROJO: % invariante(s) rota(s) en aislamiento_rls.sql', v;
  END IF;
END $$;
