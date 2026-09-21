-- ⛔ LOS CORREOS DE PRUEBA LLEVAN SUFIJO ALEATORIO, Y NO ES UN CAPRICHO.
--    Iban cableados ('carlos.prueba@example.org') y `personas_email_uq` es
--    único, así que la batería SOLO se podía correr una vez: la segunda
--    reventaba con «duplicate key». Una prueba que no se puede repetir sin
--    recrear la base entera no es una prueba, es un trámite.
-- =====================================================================
-- BANCO DE PRUEBAS DE INVARIANTES
-- Cada prueba demuestra que una regla vive en la BASE, no en la pantalla.
-- Si alguna falla, la migración correspondiente está mal: no se despliega.
-- Corre SIEMPRE contra la base local de desarrollo, nunca contra producción.
-- Todos los datos son sintéticos: los crea la propia prueba.
-- =====================================================================
\set ON_ERROR_STOP on

CREATE TEMP TABLE _resultados (n int, nombre text, esperado text, obtenido text, paso boolean);

CREATE OR REPLACE FUNCTION pg_temp.registrar(p_n int, p_nombre text, p_esperado text, p_obtenido text, p_paso boolean)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO _resultados VALUES (p_n,p_nombre,p_esperado,p_obtenido,p_paso);
$$;

-- P1 · Una persona NO puede existir sin sede.
DO $$
BEGIN
  BEGIN
    INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido)
    VALUES (NULL, 'Sin', 'Sede');
    PERFORM pg_temp.registrar(1,'Persona sin sede','RECHAZADA','ACEPTADA',false);
  EXCEPTION WHEN not_null_violation THEN
    PERFORM pg_temp.registrar(1,'Persona sin sede','RECHAZADA','RECHAZADA (not_null_violation)',true);
  END;
END $$;

-- P2 · Un MENOR sin acudiente hace FALLAR la transacción.
DO $$
DECLARE v_sede uuid;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-CHICO';
  BEGIN
    INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido, fecha_nacimiento)
    VALUES (v_sede, 'Menor', 'SinAcudiente', CURRENT_DATE - interval '9 years');
    SET CONSTRAINTS ALL IMMEDIATE;
    PERFORM pg_temp.registrar(2,'Menor sin acudiente','TRANSACCION FALLA','ACEPTADA',false);
  EXCEPTION WHEN foreign_key_violation THEN
    PERFORM pg_temp.registrar(2,'Menor sin acudiente','TRANSACCION FALLA','FALLO como debe',true);
  END;
END $$;

-- P3 · Un MENOR CON acudiente adulto sí entra (misma transacción).
DO $$
DECLARE v_sede uuid; v_menor uuid; v_adulto uuid;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-CHICO';
  INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido, fecha_nacimiento)
  VALUES (v_sede,'Ana','Rojas', CURRENT_DATE - interval '34 years') RETURNING id INTO v_adulto;
  INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido, fecha_nacimiento)
  VALUES (v_sede,'Sofia','Rojas', CURRENT_DATE - interval '8 years') RETURNING id INTO v_menor;
  INSERT INTO nucleo.acudientes (menor_id, acudiente_id, parentesco, es_principal, autoriza_retiro)
  VALUES (v_menor, v_adulto, 'MADRE', true, true);
  SET CONSTRAINTS ALL IMMEDIATE;
  PERFORM pg_temp.registrar(3,'Menor CON acudiente','ACEPTADA','ACEPTADA',true);
EXCEPTION WHEN others THEN
  PERFORM pg_temp.registrar(3,'Menor CON acudiente','ACEPTADA','RECHAZADA: '||SQLERRM,false);
END $$;

-- P4 · Un MENOR no puede ser acudiente de otro menor.
DO $$
DECLARE v_sede uuid; v_m1 uuid; v_m2 uuid; v_adulto uuid;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-CHICO';
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_sede,'Tutor','Adulto',CURRENT_DATE - interval '40 years') RETURNING id INTO v_adulto;
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_sede,'Hermano','Menor',CURRENT_DATE - interval '15 years') RETURNING id INTO v_m1;
  INSERT INTO nucleo.acudientes (menor_id,acudiente_id,parentesco) VALUES (v_m1,v_adulto,'TUTOR');
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_sede,'Bebe','Menor',CURRENT_DATE - interval '3 years') RETURNING id INTO v_m2;
  BEGIN
    INSERT INTO nucleo.acudientes (menor_id,acudiente_id,parentesco) VALUES (v_m2,v_m1,'HERMANO');
    PERFORM pg_temp.registrar(4,'Menor como acudiente','RECHAZADA','ACEPTADA',false);
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.registrar(4,'Menor como acudiente','RECHAZADA','RECHAZADA como debe',true);
  END;
  INSERT INTO nucleo.acudientes (menor_id,acudiente_id,parentesco) VALUES (v_m2,v_adulto,'TUTOR');
  SET CONSTRAINTS ALL IMMEDIATE;
END $$;

-- P5/6/7 · Consentimiento: sin registro NO; con registro SI; revocado NO.
DO $$
DECLARE v_sede uuid; v_p uuid; v_antes boolean; v_despues boolean; v_revocado boolean;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-CHICO';
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,email_principal,fecha_nacimiento)
  VALUES (v_sede,'Carlos','Prueba','carlos.prueba.'||substr(md5(clock_timestamp()::text),1,8)||'@example.org',CURRENT_DATE - interval '30 years')
  RETURNING id INTO v_p;

  v_antes := plataforma.puede_contactar(v_p,'email','convocatoria');

  INSERT INTO plataforma.consentimientos (persona_id,sede_id,finalidad,canal,acto,ocurrido_en,evidencia_tipo,evidencia_ref)
  VALUES (v_p,v_sede,'convocatoria','email','otorgado', now() - interval '2 years','formulario_web','form-2024-0001');
  v_despues := plataforma.puede_contactar(v_p,'email','convocatoria');

  INSERT INTO plataforma.consentimientos (persona_id,sede_id,finalidad,canal,acto,ocurrido_en,evidencia_tipo)
  VALUES (v_p,v_sede,'convocatoria','email','revocado', now() - interval '1 day','formulario_web');
  v_revocado := plataforma.puede_contactar(v_p,'email','convocatoria');

  PERFORM pg_temp.registrar(5,'Sin consentimiento no se contacta','false',v_antes::text, v_antes = false);
  PERFORM pg_temp.registrar(6,'Con consentimiento si se contacta','true', v_despues::text, v_despues = true);
  PERFORM pg_temp.registrar(7,'Tras revocar, no se contacta','false', v_revocado::text, v_revocado = false);
END $$;

-- P8 · El consentimiento es APPEND-ONLY: borrar y editar no surten efecto.
DO $$
DECLARE v_antes bigint; v_despues bigint;
BEGIN
  SELECT count(*) INTO v_antes FROM plataforma.consentimientos;
  DELETE FROM plataforma.consentimientos;
  UPDATE plataforma.consentimientos SET acto = 'revocado';
  SELECT count(*) INTO v_despues FROM plataforma.consentimientos;
  PERFORM pg_temp.registrar(8,'Consentimiento append-only',
    v_antes::text||' filas intactas', v_despues::text||' filas', v_antes = v_despues AND v_antes > 0);
END $$;

-- P9 · La EDAD se deriva: no existe como columna almacenada.
DO $$
DECLARE v_existe boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='nucleo' AND table_name='personas' AND column_name='edad')
  INTO v_existe;
  PERFORM pg_temp.registrar(9,'edad NO se almacena','no existe columna',
    CASE WHEN v_existe THEN 'existe columna edad' ELSE 'no existe columna' END, NOT v_existe);
END $$;

-- P10 · El correo es OPCIONAL: dos personas sin correo conviven.
DO $$
DECLARE v_sede uuid;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='MED';
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_sede,'Abuelo','SinCorreo',CURRENT_DATE - interval '82 years');
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_sede,'Abuela','SinCorreo',CURRENT_DATE - interval '79 years');
  PERFORM pg_temp.registrar(10,'Dos personas sin correo','ACEPTADAS','ACEPTADAS',true);
EXCEPTION WHEN others THEN
  PERFORM pg_temp.registrar(10,'Dos personas sin correo','ACEPTADAS','RECHAZADAS: '||SQLERRM,false);
END $$;

-- P11 · La AUDITORIA se escribió sola y es inmutable.
DO $$
DECLARE v_n bigint; v_tras bigint;
BEGIN
  SELECT count(*) INTO v_n FROM plataforma.auditoria WHERE tabla='personas';
  DELETE FROM plataforma.auditoria;
  SELECT count(*) INTO v_tras FROM plataforma.auditoria WHERE tabla='personas';
  PERFORM pg_temp.registrar(11,'Auditoria automatica e inmutable',
    '>0 y no borrable', v_n::text||' -> '||v_tras::text, v_n > 0 AND v_n = v_tras);
END $$;

-- P12 · Una asignación no puede superar el techo de sensibilidad del rol.
DO $$
DECLARE v_sede uuid; v_p uuid;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-NORTE';
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_sede,'Pastor','Filial',CURRENT_DATE - interval '45 years') RETURNING id INTO v_p;
  /* ⛔ Esta prueba escribia 'PASTOR_CONGREGACIONAL' a mano y se rompio el
     11 de septiembre cuando la direccion subio su techo de N2 a N4: la
     asignacion paso a ser legitima y la prueba fallo sin que la REGLA
     hubiera cambiado.
     Lo que se verifica es la regla, no un rol concreto. Asi que el rol se
     ELIGE: se toma uno cuyo techo sea el mas bajo que exista, y se le
     pide un nivel por encima. Si manana cambian todos los techos, la
     prueba sigue probando lo mismo. */
  DECLARE v_rol text; v_techo smallint;
  BEGIN
    SELECT codigo, nivel_maximo INTO v_rol, v_techo
      FROM identidad.roles ORDER BY nivel_maximo ASC, codigo LIMIT 1;
    BEGIN
      INSERT INTO identidad.asignaciones (persona_id,rol,alcance_tipo,alcance_id,nivel_max)
      VALUES (v_p, v_rol, 'sede', v_sede, v_techo + 1);
      PERFORM pg_temp.registrar(12,'Asignacion por encima del techo del rol','RECHAZADA',
        'ACEPTADA para '||v_rol||' (techo N'||v_techo||')', false);
    EXCEPTION WHEN check_violation THEN
      PERFORM pg_temp.registrar(12,'Asignacion por encima del techo del rol','RECHAZADA',
        'RECHAZADA como debe ('||v_rol||', techo N'||v_techo||')', true);
    END;
  END;
END $$;

-- P13 · Una sede no se puede borrar (referencia histórica).
DO $$
DECLARE v_antes bigint; v_despues bigint;
BEGIN
  SELECT count(*) INTO v_antes FROM org.sedes;
  DELETE FROM org.sedes WHERE codigo='BCN';
  SELECT count(*) INTO v_despues FROM org.sedes;
  PERFORM pg_temp.registrar(13,'Sede no borrable', v_antes::text, v_despues::text, v_antes = v_despues);
END $$;

-- P14 · Toda columna N3/N4 registrada cumple su control de cifrado.
DO $$
DECLARE v_incumple bigint;
BEGIN
  SELECT count(*) INTO v_incumple FROM plataforma.v_control_clasificacion WHERE secreto_sin_cifrar;
  PERFORM pg_temp.registrar(14,'Control de clasificacion (compuerta G5)','0 hallazgos',
    v_incumple::text||' hallazgos', v_incumple = 0);
END $$;

-- P15 · El codigo de entrega N4 se cifra, se verifica y NO se devuelve en claro.
DO $$
DECLARE v_sede uuid; v_adulto uuid; v_menor uuid; v_ac uuid;
        v_ok boolean; v_mal boolean; v_crudo bytea;
BEGIN
  SET LOCAL app.llave_n4 = 'llave-solo-de-desarrollo-no-produccion';
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-CHICO';
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_sede,'Marta','Cifrado',CURRENT_DATE - interval '38 years') RETURNING id INTO v_adulto;
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_sede,'Tomas','Cifrado',CURRENT_DATE - interval '6 years') RETURNING id INTO v_menor;
  INSERT INTO nucleo.acudientes (menor_id,acudiente_id,parentesco,autoriza_retiro)
  VALUES (v_menor,v_adulto,'MADRE',true) RETURNING id INTO v_ac;

  PERFORM nucleo.fijar_codigo_entrega(v_ac, 'A7K2');
  v_ok  := nucleo.verificar_codigo_entrega(v_ac, 'A7K2');
  v_mal := nucleo.verificar_codigo_entrega(v_ac, '0000');
  SELECT codigo_entrega_cifrado INTO v_crudo FROM nucleo.acudientes WHERE id = v_ac;
  SET CONSTRAINTS ALL IMMEDIATE;

  PERFORM pg_temp.registrar(15,'Codigo de entrega N4 cifrado y verificable',
    'correcto=true, incorrecto=false, ilegible en crudo',
    'correcto='||v_ok||', incorrecto='||v_mal||', crudo ilegible='||(position('A7K2' in encode(v_crudo,'escape')) = 0),
    v_ok AND NOT v_mal AND position('A7K2' in encode(v_crudo,'escape')) = 0);
END $$;

-- P16 · Sin llave N4 en la sesion, el cifrado falla ruidosamente (no en silencio).
DO $$
DECLARE v_ac uuid;
BEGIN
  SELECT id INTO v_ac FROM nucleo.acudientes WHERE codigo_entrega_cifrado IS NOT NULL LIMIT 1;
  BEGIN
    PERFORM set_config('app.llave_n4','',true);
    PERFORM nucleo.verificar_codigo_entrega(v_ac,'A7K2');
    PERFORM pg_temp.registrar(16,'Sin llave N4 no se descifra','EXCEPCION','devolvio un valor',false);
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM pg_temp.registrar(16,'Sin llave N4 no se descifra','EXCEPCION','fallo como debe',true);
  END;
END $$;

\echo ''
\echo '========== BANCO DE INVARIANTES - CasaRoca System =========='
SELECT n AS "#", nombre AS "invariante", obtenido AS "resultado",
       CASE WHEN paso THEN 'PASA' ELSE 'FALLA' END AS "veredicto"
FROM _resultados ORDER BY n;

SELECT count(*) FILTER (WHERE paso) AS "pasan",
       count(*) FILTER (WHERE NOT paso) AS "fallan",
       count(*) AS "total"
FROM _resultados;


-- ⛔ COMPUERTA. Sin esto, el banco IMPRIME los fallos y devuelve exito: la
--    integracion continua daria por buena una invariante rota. Se descubrio
--    el 19 de septiembre de 2026: 7 de los 8 bancos eran un informe, no una
--    compuerta.
DO $$
DECLARE v int;
BEGIN
  SELECT count(*) FILTER (WHERE NOT paso) INTO v FROM _resultados;
  IF v > 0 THEN
    RAISE EXCEPTION 'BANCO EN ROJO: % invariante(s) rota(s) en invariantes.sql', v;
  END IF;
END $$;
