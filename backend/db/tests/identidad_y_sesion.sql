-- =====================================================================
-- Banco: IDENTIDAD Y SESIÓN (migraciones 0048 y 0052)
--
-- ⛔ ESTE BANCO NO EXISTÍA. `probar.sh` lo declaraba en su lista y la línea
--    `[[ -f "$f" ]] || continue` lo saltaba EN SILENCIO: no sumaba a verdes,
--    no sumaba a rojos, no avisaba. Era el banco del módulo más nuevo y más
--    sensible del sistema, y llevaba días figurando como si corriera.
--
--    Lo cazó el auditor de operación. Aquí está, y el corredor pasa a
--    FALLAR si un banco declarado no tiene archivo.
-- =====================================================================
\set ON_ERROR_STOP on
CREATE TEMP TABLE i_res(n int, caso text, esperado text, obtenido text, pasa boolean);
CREATE FUNCTION pg_temp.rg(a int, b text, c text, d text, e boolean) RETURNS void
LANGUAGE sql AS $$ INSERT INTO i_res VALUES (a,b,c,d,e) $$;
CREATE TEMP TABLE ilab(k text PRIMARY KEY, v uuid);

-- ⛔ Usuarios únicos por corrida: el banco tiene que poder correrse dos
--    veces seguidas sobre la misma base sin chocar con su propia huella.
CREATE TEMP TABLE isufijo AS SELECT substr(md5(clock_timestamp()::text),1,8) AS sx;
CREATE FUNCTION pg_temp.usuario_banco() RETURNS text LANGUAGE sql STABLE AS
  $$ SELECT 'banco.identidad.'||sx||'@casaroca.org' FROM isufijo $$;
CREATE FUNCTION pg_temp.usuario_sensible() RETURNS text LANGUAGE sql STABLE AS
  $$ SELECT 'sensible.banco.'||sx||'@casaroca.org' FROM isufijo $$;

DO $$
DECLARE v_p uuid; v_c uuid;
BEGIN
  INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido, fecha_nacimiento)
  VALUES ((SELECT id FROM org.sedes WHERE codigo='BOG-CHICO'),'Cuenta','DePrueba','1990-01-01')
  RETURNING id INTO v_p;
  v_c := identidad.crear_cuenta(v_p, pg_temp.usuario_banco(), 'scrypt$16384$8$1$c2Fs$ZGVyaXZhZGE', NULL);
  INSERT INTO ilab VALUES ('persona',v_p),('cuenta',v_c);
END $$;

-- I1 · La contrasena NO se guarda: se guarda una derivacion.
DO $$
DECLARE v_hash text; v_ok boolean;
BEGIN
  SELECT clave_hash INTO v_hash FROM identidad.credencial_de(pg_temp.usuario_banco());
  v_ok := v_hash LIKE 'scrypt$%' AND v_hash NOT LIKE '%clave%';
  PERFORM pg_temp.rg(1,'La contrasena se guarda en claro','derivacion scrypt',
    CASE WHEN v_ok THEN 'derivacion scrypt' ELSE coalesce(v_hash,'nada') END, v_ok);
END $$;

-- I2 · La aplicacion NO puede leer la tabla de cuentas.
DO $$
DECLARE ok boolean := false;
BEGIN
  SET LOCAL ROLE casaroca_app;
  BEGIN PERFORM 1 FROM identidad.cuentas LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN ok := true; END;
  RESET ROLE;
  PERFORM pg_temp.rg(2,'La aplicacion lee la tabla de cuentas','RECHAZADO como debe',
    CASE WHEN ok THEN 'RECHAZADO como debe' ELSE 'la lee (mal)' END, ok);
END $$;

-- I3 · ⭐ CERRAR SESION CIERRA EL PAR, no solo el acceso.
--      El auditor reprodujo el fallo: salir mataba el acceso y el refresco
--      seguia sirviendo doce horas.
DO $$
DECLARE v_a uuid := gen_random_uuid(); v_r uuid := gen_random_uuid();
        v_vivas int;
BEGIN
  PERFORM identidad.abrir_par_de_sesion((SELECT v FROM ilab WHERE k='cuenta'), v_a, v_r, 30, 720, NULL, 'banco', NULL);
  PERFORM identidad.cerrar_sesion(v_a, 'prueba');
  SELECT count(*) INTO v_vivas FROM identidad.sesiones
   WHERE id IN (v_a, v_r) AND revocada_en IS NULL;
  PERFORM pg_temp.rg(3,'Cerrar sesion deja vivo el token de refresco','0 sesiones vivas',
    v_vivas||' vivas', v_vivas = 0);
END $$;

-- I4 · Y cerrar por el REFRESCO tambien cierra el acceso.
DO $$
DECLARE v_a uuid := gen_random_uuid(); v_r uuid := gen_random_uuid(); v_vivas int;
BEGIN
  PERFORM identidad.abrir_par_de_sesion((SELECT v FROM ilab WHERE k='cuenta'), v_a, v_r, 30, 720, NULL, 'banco', NULL);
  PERFORM identidad.cerrar_sesion(v_r, 'prueba al reves');
  SELECT count(*) INTO v_vivas FROM identidad.sesiones WHERE id IN (v_a, v_r) AND revocada_en IS NULL;
  PERFORM pg_temp.rg(4,'Cerrar por el refresco deja vivo el acceso','0 vivas', v_vivas||' vivas', v_vivas = 0);
END $$;

-- I5 · Una sesion revocada NO da contexto.
DO $$
DECLARE v_a uuid := gen_random_uuid(); v_r uuid := gen_random_uuid(); n int;
BEGIN
  PERFORM identidad.abrir_par_de_sesion((SELECT v FROM ilab WHERE k='cuenta'), v_a, v_r, 30, 720, NULL, 'banco', NULL);
  PERFORM identidad.cerrar_sesion(v_a, 'prueba');
  SELECT count(*) INTO n FROM identidad.contexto_de_sesion(v_a);
  PERFORM pg_temp.rg(5,'Una sesion revocada sigue dando contexto','0 filas', n||' filas', n = 0);
END $$;

-- I6 · Una sesion VENCIDA tampoco.
DO $$
DECLARE v_a uuid := gen_random_uuid(); v_r uuid := gen_random_uuid(); n int;
BEGIN
  PERFORM identidad.abrir_par_de_sesion((SELECT v FROM ilab WHERE k='cuenta'), v_a, v_r, 30, 720, NULL, 'banco', NULL);
  -- La restriccion exige expira_en > emitida_en, asi que se envejece la
  -- sesion entera, como haria el paso del tiempo.
  UPDATE identidad.sesiones
     SET emitida_en = now() - interval '2 hours', expira_en = now() - interval '1 minute'
   WHERE id = v_a;
  SELECT count(*) INTO n FROM identidad.contexto_de_sesion(v_a);
  PERFORM pg_temp.rg(6,'Una sesion vencida sigue dando contexto','0 filas', n||' filas', n = 0);
END $$;

-- I7 · El refresco ROTADO invalida el anterior Y su pareja.
DO $$
DECLARE a1 uuid := gen_random_uuid(); r1 uuid := gen_random_uuid();
        a2 uuid := gen_random_uuid(); r2 uuid := gen_random_uuid(); n int;
BEGIN
  PERFORM identidad.abrir_par_de_sesion((SELECT v FROM ilab WHERE k='cuenta'), a1, r1, 30, 720, NULL, 'banco', NULL);
  PERFORM identidad.abrir_par_de_sesion((SELECT v FROM ilab WHERE k='cuenta'), a2, r2, 30, 720, NULL, 'banco', r1);
  SELECT count(*) INTO n FROM identidad.sesiones WHERE id IN (a1, r1) AND revocada_en IS NULL;
  PERFORM pg_temp.rg(7,'Un refresco usado dos veces sigue sirviendo','0 del par viejo vivo', n||' vivas', n = 0);
END $$;

-- I8 · Bloqueo por intentos: cinco fallos y la cuenta queda bloqueada.
DO $$
DECLARE v_bloq timestamptz;
BEGIN
  FOR i IN 1..5 LOOP
    PERFORM identidad.registrar_intento(pg_temp.usuario_banco(), false, 'prueba', NULL, 'banco');
  END LOOP;
  SELECT bloqueada_hasta INTO v_bloq FROM identidad.credencial_de(pg_temp.usuario_banco());
  PERFORM pg_temp.rg(8,'Cinco fallos no bloquean la cuenta','bloqueada',
    CASE WHEN v_bloq > now() THEN 'bloqueada' ELSE 'sin bloqueo' END, v_bloq > now());
END $$;

-- I9 · Un ingreso correcto limpia el bloqueo y el contador.
DO $$
DECLARE v_bloq timestamptz; v_int smallint;
BEGIN
  PERFORM identidad.registrar_intento(pg_temp.usuario_banco(), true, 'prueba', NULL, 'banco');
  SELECT bloqueada_hasta INTO v_bloq FROM identidad.credencial_de(pg_temp.usuario_banco());
  PERFORM pg_temp.rg(9,'Un ingreso correcto no limpia el bloqueo','sin bloqueo',
    CASE WHEN v_bloq IS NULL THEN 'sin bloqueo' ELSE 'sigue bloqueada' END, v_bloq IS NULL);
END $$;

-- I10 · Los intentos son append-only: son evidencia de un incidente.
DO $$
DECLARE antes int; despues int;
BEGIN
  SELECT count(*) INTO antes FROM identidad.intentos_acceso;
  DELETE FROM identidad.intentos_acceso;
  UPDATE identidad.intentos_acceso SET motivo = 'alterado';
  SELECT count(*) INTO despues FROM identidad.intentos_acceso;
  PERFORM pg_temp.rg(10,'La bitacora de intentos se puede alterar','intacta',
    CASE WHEN antes = despues THEN 'intacta' ELSE 'ALTERADA' END, antes = despues AND antes > 0);
END $$;

-- I11 · ⭐ El segundo factor es OBLIGATORIO para quien alcanza N3 o N4, y
--       lo calcula la base, no un manual.
DO $$
DECLARE v_p uuid; v_c uuid; v_exige boolean;
BEGIN
  INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido, fecha_nacimiento)
  VALUES ((SELECT id FROM org.sedes WHERE codigo='BOG-CHICO'),'Sensible','DePrueba','1985-01-01')
  RETURNING id INTO v_p;
  INSERT INTO identidad.asignaciones (persona_id, rol, alcance_tipo, alcance_id, nivel_max)
  VALUES (v_p,'TESORERIA','sede',(SELECT id FROM org.sedes WHERE codigo='BOG-CHICO'),3);
  v_c := identidad.crear_cuenta(v_p, pg_temp.usuario_sensible(), 'scrypt$16384$8$1$c2Fs$eA', NULL);
  SELECT exige_segundo_factor INTO v_exige FROM identidad.credencial_de(pg_temp.usuario_sensible());
  PERFORM pg_temp.rg(11,'Un rol N3 no exige segundo factor','lo exige',
    CASE WHEN v_exige THEN 'lo exige' ELSE 'no lo exige (mal)' END, v_exige);
  INSERT INTO ilab VALUES ('persona_n3', v_p),('cuenta_n3', v_c);
END $$;

-- I12 · El secreto del segundo factor NO se guarda en claro.
DO $$
DECLARE v_s text; v_ok boolean;
BEGIN
  PERFORM identidad.guardar_segundo_factor((SELECT v FROM ilab WHERE k='cuenta'), 'v1.aWv.dGFn.ZGF0bw');
  SELECT identidad.secreto_segundo_factor((SELECT v FROM ilab WHERE k='cuenta')) INTO v_s;
  v_ok := v_s LIKE 'v1.%' AND v_s !~ '^[A-Z2-7]{16,}$';   -- no es base32 en claro
  PERFORM pg_temp.rg(12,'El secreto del segundo factor se guarda en claro','cifrado',
    CASE WHEN v_ok THEN 'cifrado' ELSE 'EN CLARO (mal)' END, v_ok);
END $$;

-- I13 · ⭐ Cuando la persona deja de estar activa, la cuenta se suspende
--       y las sesiones se cierran EN EL INSTANTE.
DO $$
DECLARE v_a uuid := gen_random_uuid(); v_r uuid := gen_random_uuid();
        v_estado text; v_vivas int;
BEGIN
  PERFORM identidad.abrir_par_de_sesion((SELECT v FROM ilab WHERE k='cuenta_n3'), v_a, v_r, 30, 720, NULL, 'banco', NULL);
  UPDATE nucleo.personas SET estado = 'inactiva' WHERE id = (SELECT v FROM ilab WHERE k='persona_n3');
  SELECT estado INTO v_estado FROM identidad.credencial_de(pg_temp.usuario_sensible());
  SELECT count(*) INTO v_vivas FROM identidad.sesiones WHERE id IN (v_a,v_r) AND revocada_en IS NULL;
  PERFORM pg_temp.rg(13,'Inactivar a alguien deja su cuenta y sus sesiones vivas',
    'suspendida y 0 sesiones', v_estado||' · '||v_vivas||' vivas',
    v_estado = 'suspendida' AND v_vivas = 0);
END $$;

-- I14 · Una cuenta suspendida no da contexto aunque la sesion siga en fecha.
DO $$
DECLARE v_a uuid := gen_random_uuid(); v_r uuid := gen_random_uuid(); n int;
BEGIN
  PERFORM identidad.abrir_par_de_sesion((SELECT v FROM ilab WHERE k='cuenta_n3'), v_a, v_r, 30, 720, NULL, 'banco', NULL);
  SELECT count(*) INTO n FROM identidad.contexto_de_sesion(v_a);
  PERFORM pg_temp.rg(14,'Una cuenta suspendida sigue dando contexto','0 filas', n||' filas', n = 0);
END $$;

-- I15 · Cambiar la contrasena cierra las demas sesiones.
DO $$
DECLARE v_a uuid := gen_random_uuid(); v_r uuid := gen_random_uuid(); n int;
BEGIN
  PERFORM identidad.abrir_par_de_sesion((SELECT v FROM ilab WHERE k='cuenta'), v_a, v_r, 30, 720, NULL, 'banco', NULL);
  PERFORM identidad.cambiar_clave((SELECT v FROM ilab WHERE k='cuenta'), 'scrypt$16384$8$1$c2Fs$bnVldmE');
  SELECT count(*) INTO n FROM identidad.sesiones
   WHERE cuenta_id = (SELECT v FROM ilab WHERE k='cuenta') AND revocada_en IS NULL;
  PERFORM pg_temp.rg(15,'Cambiar la contrasena deja sesiones abiertas','0 abiertas', n||' abiertas', n = 0);
END $$;

-- I16 · Suplantar a otro exige consentimiento, motivo y tope de dos horas.
DO $$
DECLARE largo boolean := false; sin_motivo boolean := false;
BEGIN
  BEGIN
    INSERT INTO identidad.suplantaciones (soporte_id, suplantado_id, motivo, termina_en)
    VALUES ((SELECT v FROM ilab WHERE k='persona'),(SELECT v FROM ilab WHERE k='persona_n3'),
            'Soporte a un problema de la sede reportado por telefono', now() + interval '8 hours');
  EXCEPTION WHEN check_violation THEN largo := true; END;
  BEGIN
    INSERT INTO identidad.suplantaciones (soporte_id, suplantado_id, motivo, termina_en)
    VALUES ((SELECT v FROM ilab WHERE k='persona'),(SELECT v FROM ilab WHERE k='persona_n3'),
            'corto', now() + interval '1 hour');
  EXCEPTION WHEN check_violation THEN sin_motivo := true; END;
  PERFORM pg_temp.rg(16,'Suplantar sin limite de tiempo o sin motivo','los dos RECHAZADOS',
    CASE WHEN largo AND sin_motivo THEN 'los dos RECHAZADOS' ELSE 'alguno paso (mal)' END,
    largo AND sin_motivo);
END $$;

-- Limpieza: borrado logico, que es como se borra en este sistema.
UPDATE nucleo.membresias_sede SET hasta = CURRENT_DATE, es_principal = false
 WHERE persona_id IN (SELECT v FROM ilab) AND hasta IS NULL;
UPDATE nucleo.personas SET eliminado_en = now(), estado = 'inactiva'
 WHERE id IN (SELECT v FROM ilab WHERE k IN ('persona','persona_n3'));

\echo ''
\echo '===== IDENTIDAD Y SESION ====='
SELECT n AS "#", caso AS invariante, obtenido AS resultado,
       CASE WHEN pasa THEN 'PASA' ELSE 'FALLA' END AS veredicto
FROM i_res ORDER BY n;
SELECT count(*) FILTER (WHERE pasa) AS pasan,
       count(*) FILTER (WHERE NOT pasa) AS fallan, count(*) AS total FROM i_res;

DO $$
DECLARE v int;
BEGIN
  SELECT count(*) FILTER (WHERE NOT pasa) INTO v FROM i_res;
  IF v > 0 THEN RAISE EXCEPTION 'BANCO EN ROJO: % invariante(s) rota(s) en identidad_y_sesion.sql', v; END IF;
END $$;
