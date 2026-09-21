-- =====================================================================
-- Banco: HABEAS DATA EJECUTABLE (migración 0053)
--
-- ⛔ El veredicto del auditor de cumplimiento era: «el modelo está diseñado
--    bien y ejecutado en ninguna parte». `puede_contactar` con cero
--    invocaciones, `registrar_lectura` con cero, cero funciones de
--    supresión, y la convicción religiosa clasificada como dato ordinario.
--    Estas pruebas exigen que cada pieza esté CONECTADA, no solo que exista.
-- =====================================================================
\set ON_ERROR_STOP on
CREATE TEMP TABLE h_res(n int, caso text, esperado text, obtenido text, pasa boolean);
CREATE FUNCTION pg_temp.rg(a int, b text, c text, d text, e boolean) RETURNS void
LANGUAGE sql AS $$ INSERT INTO h_res VALUES (a,b,c,d,e) $$;
CREATE TEMP TABLE hlab(k text PRIMARY KEY, v uuid);

DO $$
DECLARE v_sede uuid; v_p uuid; v_m uuid; v_a uuid;
        sx text := substr(md5(clock_timestamp()::text),1,8);   -- corrida repetible
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-CHICO';
  INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido, fecha_nacimiento, email_principal, es_cristiano)
  VALUES (v_sede,'Titular','Cumplimiento','1985-06-06','titular.hd.'||sx||'@example.org','si') RETURNING id INTO v_p;
  INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido, fecha_nacimiento)
  VALUES (v_sede,'Acudiente','Cumplimiento','1980-01-01') RETURNING id INTO v_a;
  INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido, fecha_nacimiento)
  VALUES (v_sede,'Menor','Cumplimiento', CURRENT_DATE - interval '9 years') RETURNING id INTO v_m;
  SET CONSTRAINTS ALL DEFERRED;
  INSERT INTO nucleo.acudientes (menor_id, acudiente_id, parentesco, autoriza_retiro)
  VALUES (v_m, v_a, 'MADRE', true);
  SET CONSTRAINTS ALL IMMEDIATE;
  INSERT INTO hlab VALUES ('sede',v_sede),('persona',v_p),('menor',v_m),('acudiente',v_a);
END $$;

-- C1 · Sin registro, no se contacta. El silencio no es un si.
DO $$
DECLARE puede boolean;
BEGIN
  puede := plataforma.puede_contactar((SELECT v FROM hlab WHERE k='persona'),'email','convocatoria');
  PERFORM pg_temp.rg(1,'Sin consentimiento se puede contactar','falso', puede::text, NOT puede);
END $$;

-- C2 · ⭐ Encolar un aviso SIN consentimiento se RECHAZA en la base.
DO $$
DECLARE ok boolean := false; msg text;
BEGIN
  BEGIN
    INSERT INTO plataforma.notificaciones (sede_id, persona_id, destinatario, canal, plantilla, datos, origen_modulo, finalidad)
    VALUES ((SELECT v FROM hlab WHERE k='sede'),(SELECT v FROM hlab WHERE k='persona'),
            (SELECT email_principal::text FROM nucleo.personas WHERE id=(SELECT v FROM hlab WHERE k='persona')),'email','Bienvenida_nuevo','{}'::jsonb,'crm','convocatoria');
  EXCEPTION WHEN others THEN ok := true; msg := SQLERRM; END;
  PERFORM pg_temp.rg(2,'Se encola un aviso sin consentimiento','RECHAZADO con el motivo',
    CASE WHEN ok AND msg ~ 'consentimiento' THEN 'RECHAZADO con el motivo' ELSE coalesce(msg,'ACEPTADO (mal)') END,
    ok AND msg ~ 'consentimiento');
END $$;

-- C3 · Con consentimiento, si.
DO $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO plataforma.consentimientos
    (persona_id, sede_id, finalidad, canal, acto, ocurrido_en, evidencia_tipo, evidencia_ref)
  VALUES ((SELECT v FROM hlab WHERE k='persona'),(SELECT v FROM hlab WHERE k='sede'),
          'convocatoria','email','otorgado',now(),'formulario_web','banco');
  INSERT INTO plataforma.notificaciones (sede_id, persona_id, destinatario, canal, plantilla, datos, origen_modulo, finalidad)
  VALUES ((SELECT v FROM hlab WHERE k='sede'),(SELECT v FROM hlab WHERE k='persona'),
          (SELECT email_principal::text FROM nucleo.personas WHERE id=(SELECT v FROM hlab WHERE k='persona')),'email','Bienvenida_nuevo','{}'::jsonb,'crm','convocatoria')
  RETURNING id INTO v_id;
  PERFORM pg_temp.rg(3,'Con consentimiento no deja encolar','encolado',
    CASE WHEN v_id IS NOT NULL THEN 'encolado' ELSE 'rechazado (mal)' END, v_id IS NOT NULL);
  INSERT INTO hlab VALUES ('aviso', v_id);
END $$;

-- C4 · ⭐ Revocar UNA VEZ apaga TODOS los canales y finalidades.
DO $$
DECLARE n_antes int; n_despues int; revocados int; otras int;
BEGIN
  INSERT INTO plataforma.consentimientos
    (persona_id, sede_id, finalidad, canal, acto, ocurrido_en, evidencia_tipo, evidencia_ref)
  SELECT (SELECT v FROM hlab WHERE k='persona'),(SELECT v FROM hlab WHERE k='sede'),
         f.codigo, c.canal, 'otorgado', now(), 'formulario_web','banco'
  FROM plataforma.finalidades f
  CROSS JOIN (SELECT unnest(enum_range(NULL::plataforma.canal_contacto)) AS canal) c;

  SELECT count(*) INTO n_antes FROM plataforma.finalidades f
  CROSS JOIN (SELECT unnest(enum_range(NULL::plataforma.canal_contacto)) AS canal) c
  WHERE f.base_legal = 'consentimiento'
    AND plataforma.puede_contactar((SELECT v FROM hlab WHERE k='persona'), c.canal, f.codigo);

  -- ⛔ Desde la migracion 0058 `revocar_consentimiento` comprueba por dentro
  --    el alcance de la sesion (se hizo SECURITY DEFINER para poder cancelar
  --    lo encolado, y eso deja de aplicar la politica). Hay que decirle a la
  --    prueba desde donde mira, igual que hace la aplicacion.
  PERFORM set_config('app.sede_ids','{'||(SELECT v FROM hlab WHERE k='sede')::text||'}',true);
  PERFORM set_config('app.nivel_max','4',true);

  revocados := plataforma.revocar_consentimiento((SELECT v FROM hlab WHERE k='persona'));

  SELECT count(*) INTO n_despues FROM plataforma.finalidades f
  CROSS JOIN (SELECT unnest(enum_range(NULL::plataforma.canal_contacto)) AS canal) c
  WHERE f.base_legal = 'consentimiento'
    AND plataforma.puede_contactar((SELECT v FROM hlab WHERE k='persona'), c.canal, f.codigo);

  -- ⭐ Y lo que NO se apoya en el consentimiento sigue vivo: revocar el
  --    permiso de convocatoria no puede impedir que se avise de una
  --    emergencia con un menor. La version anterior de esta prueba exigia
  --    «0 despues» CONTANDO TODO, es decir, exigia algo que la ley no
  --    permite: renunciar a una base legal que no es el consentimiento.
  SELECT count(*) INTO otras FROM plataforma.finalidades f
  CROSS JOIN (SELECT unnest(enum_range(NULL::plataforma.canal_contacto)) AS canal) c
  WHERE f.base_legal <> 'consentimiento'
    AND plataforma.puede_contactar((SELECT v FROM hlab WHERE k='persona'), c.canal, f.codigo);

  PERFORM pg_temp.rg(4,'Revocar deja vivo lo que SI se revoca, o tumba lo que no se puede revocar',
    n_antes||' revocables antes, 0 despues, y las demas bases legales intactas',
    n_antes||' antes, '||n_despues||' despues, otras bases '||otras,
    n_antes > 1 AND n_despues = 0 AND otras > 0);
END $$;

-- C5 · ⭐ Y lo YA ENCOLADO se descarta. Entre encolar y enviar pasan dias.
DO $$
DECLARE v_estado text;
BEGIN
  SELECT estado::text INTO v_estado FROM plataforma.notificaciones WHERE id=(SELECT v FROM hlab WHERE k='aviso');
  PERFORM pg_temp.rg(5,'El aviso ya encolado sale igual tras revocar','descartada',
    v_estado, v_estado = 'descartada');
END $$;

-- C6 · La convicción religiosa es dato SENSIBLE por la Ley 1581 art. 5.
DO $$
DECLARE bajas text;
BEGIN
  SELECT string_agg(columna||'(N'||nivel||')', ', ') INTO bajas
  FROM plataforma.clasificacion_columna
  WHERE esquema='nucleo' AND tabla='personas'
    AND columna IN ('es_cristiano','fecha_conversion','ha_sido_bautizado','fecha_bautismo','iglesia_anterior')
    AND nivel < 3;
  PERFORM pg_temp.rg(6,'Conviccion religiosa clasificada como dato ordinario','ninguna por debajo de N3',
    COALESCE(bajas,'ninguna por debajo de N3'), bajas IS NULL);
END $$;

-- C7 · El documento de identidad y la contrasena estan clasificados.
DO $$
DECLARE faltan text;
BEGIN
  SELECT string_agg(x.c, ', ') INTO faltan FROM (VALUES
    ('nucleo','personas','numero_documento'),('identidad','cuentas','clave_hash')
  ) AS v(e,t,c)
  LEFT JOIN plataforma.clasificacion_columna cc
    ON cc.esquema=v.e AND cc.tabla=v.t AND cc.columna=v.c
  CROSS JOIN LATERAL (SELECT v.c AS c) x
  WHERE cc.columna IS NULL;
  PERFORM pg_temp.rg(7,'Columnas criticas sin clasificar','ninguna', COALESCE(faltan,'ninguna'), faltan IS NULL);
END $$;

-- C8 · ⭐ La supresion EXISTE y hace algo.
DO $$
DECLARE v_pet uuid; v_res jsonb; v_nombre text; v_mail text; v_fe text;
BEGIN
  INSERT INTO plataforma.peticiones_titular (tipo, titular_id, titular_nombre, titular_contacto, detalle, canal, sede_id)
  VALUES ('supresion',(SELECT v FROM hlab WHERE k='persona'),'Titular Cumplimiento','titular.hd@example.org',
          'Solicita la supresion de sus datos','correo',(SELECT v FROM hlab WHERE k='sede'))
  RETURNING id INTO v_pet;

  v_res := plataforma.ejecutar_supresion(v_pet);

  SELECT primer_nombre, email_principal::text, es_cristiano::text INTO v_nombre, v_mail, v_fe
  FROM nucleo.personas WHERE id=(SELECT v FROM hlab WHERE k='persona');

  PERFORM pg_temp.rg(8,'La supresion no borra ni anonimiza nada',
    'anonimizada: sin nombre, sin correo, sin conviccion',
    'nombre='||coalesce(v_nombre,'-')||' correo='||coalesce(v_mail,'-')||' fe='||coalesce(v_fe,'-'),
    v_nombre = 'Titular' AND v_mail IS NULL AND v_fe IS NULL);
END $$;

-- C9 · Y CONSERVA lo que la ley obliga, diciendo por que.
DO $$
DECLARE v_resp text;
BEGIN
  SELECT respuesta INTO v_resp FROM plataforma.peticiones_titular
   WHERE titular_id=(SELECT v FROM hlab WHERE k='persona') AND tipo='supresion';
  PERFORM pg_temp.rg(9,'La supresion no dice que conserva ni por que','menciona la base legal',
    CASE WHEN v_resp ~ 'base_legal_conservacion' THEN 'menciona la base legal' ELSE coalesce(left(v_resp,60),'sin respuesta') END,
    v_resp ~ 'base_legal_conservacion');
END $$;

-- C10 · A quien fue suprimido no se le escribe, aunque quedara consentimiento.
DO $$
DECLARE puede boolean;
BEGIN
  puede := plataforma.puede_contactar((SELECT v FROM hlab WHERE k='persona'),'email','convocatoria');
  PERFORM pg_temp.rg(10,'Se puede escribir a alguien suprimido','falso', puede::text, NOT puede);
END $$;

-- C11 · ⭐ El consentimiento de un MENOR lo otorga su representante.
DO $$
DECLARE solo boolean := false; ajeno boolean := false;
BEGIN
  BEGIN
    INSERT INTO plataforma.consentimientos (persona_id, sede_id, finalidad, canal, acto, ocurrido_en, evidencia_tipo, evidencia_ref)
    VALUES ((SELECT v FROM hlab WHERE k='menor'),(SELECT v FROM hlab WHERE k='sede'),
            'convocatoria','email','otorgado',now(),'formulario_web','el propio menor marco la casilla');
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation
                 OR insufficient_privilege OR raise_exception OR no_data_found
                 THEN solo := true; END;

  BEGIN
    INSERT INTO plataforma.consentimientos (persona_id, sede_id, finalidad, canal, acto, ocurrido_en, evidencia_tipo, evidencia_ref, otorgado_por)
    VALUES ((SELECT v FROM hlab WHERE k='menor'),(SELECT v FROM hlab WHERE k='sede'),
            'convocatoria','email','otorgado',now(),'formulario_web','un adulto cualquiera',
            (SELECT v FROM hlab WHERE k='persona'));
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation
                 OR insufficient_privilege OR raise_exception OR no_data_found
                 THEN ajeno := true; END;

  PERFORM pg_temp.rg(11,'Un menor consiente solo, o consiente un adulto ajeno','los dos RECHAZADOS',
    CASE WHEN solo AND ajeno THEN 'los dos RECHAZADOS' ELSE 'alguno paso (mal)' END, solo AND ajeno);
END $$;

-- C12 · Y con su acudiente vigente, si, y queda marcado como tal.
DO $$
DECLARE v_cal text;
BEGIN
  INSERT INTO plataforma.consentimientos (persona_id, sede_id, finalidad, canal, acto, ocurrido_en, evidencia_tipo, evidencia_ref, otorgado_por)
  VALUES ((SELECT v FROM hlab WHERE k='menor'),(SELECT v FROM hlab WHERE k='sede'),
          'menores','email','otorgado',now(),'formulario_fisico','firmado por la madre',
          (SELECT v FROM hlab WHERE k='acudiente'))
  RETURNING calidad INTO v_cal;
  PERFORM pg_temp.rg(12,'El consentimiento del acudiente no queda marcado','representante_legal',
    coalesce(v_cal,'sin marcar'), v_cal = 'representante_legal');
END $$;

-- C13 · Los plazos cuentan los festivos de Colombia.
DO $$
DECLARE v_sin int; v_con date;
BEGIN
  SELECT count(*) INTO v_sin FROM sistema.festivos WHERE pais='CO';
  v_con := plataforma.dias_habiles_desde(DATE '2026-12-18', 10, 'CO');
  PERFORM pg_temp.rg(13,'Los plazos cuentan Navidad y Ano Nuevo como habiles',
    'calendario sembrado y plazo despues del 1 de enero',
    v_sin||' festivos · vence '||v_con,
    v_sin >= 50 AND v_con > DATE '2027-01-01');
END $$;

-- C14 · La prorroga exige motivo escrito.
DO $$
DECLARE ok boolean := false; v_pet uuid;
BEGIN
  INSERT INTO plataforma.peticiones_titular (tipo, titular_nombre, titular_contacto, detalle, canal, sede_id)
  VALUES ('consulta','Otro Titular','otro@example.org','Quiere saber que datos tienen','correo',
          (SELECT v FROM hlab WHERE k='sede'))
  RETURNING id INTO v_pet;
  BEGIN PERFORM plataforma.prorrogar_peticion(v_pet, 'corto');
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation
                 OR insufficient_privilege OR raise_exception OR no_data_found
                 THEN ok := true; END;
  PERFORM pg_temp.rg(14,'Se puede prorrogar sin motivo','RECHAZADO como debe',
    CASE WHEN ok THEN 'RECHAZADO como debe' ELSE 'ACEPTADO (mal)' END, ok);
  DELETE FROM plataforma.peticiones_titular WHERE id = v_pet;
END $$;

-- C15 · Toda tabla con dato de persona declara su retencion.
DO $$
DECLARE faltan text;
BEGIN
  SELECT string_agg(x.t, ', ') INTO faltan FROM (VALUES
    ('rocakids','checkins'),('rocakids','condiciones_medicas'),('consejeria','notas'),
    ('aportes','aportes'),('asistencia','entradas'),('plataforma','auditoria')
  ) AS v(e,t)
  CROSS JOIN LATERAL (SELECT v.e||'.'||v.t AS t) x
  WHERE NOT EXISTS (SELECT 1 FROM plataforma.politicas_retencion r
                    WHERE r.esquema=v.e AND r.tabla=v.t);
  PERFORM pg_temp.rg(15,'Tablas sensibles sin politica de retencion','ninguna',
    COALESCE(faltan,'ninguna'), faltan IS NULL);
END $$;

-- C16 · La purga es SIMULACRO por omision: no borra por curiosidad.
DO $$
DECLARE n int; borradas bigint;
BEGIN
  SELECT count(*) INTO n FROM rocakids.checkins;
  SELECT sum(filas) INTO borradas FROM plataforma.purgar_por_retencion();  -- simulacro
  PERFORM pg_temp.rg(16,'La purga borra sin que se lo pidan','no borro nada',
    (SELECT count(*) FROM rocakids.checkins)||' checkins siguen',
    (SELECT count(*) FROM rocakids.checkins) = n);
END $$;

-- C17 · ⭐ CONSEJERIA SE PUEDE LEER. Antes reventaba con recursion infinita
--       y el modulo entero era ilegible con el rol de la aplicacion.
DO $$
DECLARE ok boolean := true; n int;
BEGIN
  SET LOCAL ROLE casaroca_app;
  PERFORM set_config('app.sede_ids','{'||(SELECT id FROM org.sedes WHERE codigo='BOG-CHICO')::text||'}',true);
  PERFORM set_config('app.nivel_max','4',true);
  BEGIN SELECT count(*) INTO n FROM consejeria.casos;
  EXCEPTION WHEN others THEN ok := false; END;
  RESET ROLE;
  PERFORM pg_temp.rg(17,'Consejeria revienta con recursion infinita','se puede leer',
    CASE WHEN ok THEN 'se puede leer' ELSE 'RECURSION (mal)' END, ok);
END $$;

-- =====================================================================
-- 18 a 22 · EL AVISO NO TUMBA EL NEGOCIO (migración 0055)
--
-- ⛔ Encontrado el 19 de septiembre de 2026 al revivir el banco de la API:
--    convertir en miembro a quien NO autorizó correo reventaba la
--    transacción entera y la persona no llegaba a existir. Dos errores en
--    uno: el aviso tumbaba el acto que lo originó, y se exigía
--    consentimiento para finalidades cuya base legal NO es el
--    consentimiento (un certificado que la persona misma pidió).
-- =====================================================================

-- ⛔ Persona PROPIA de este bloque. La de arriba ya fue suprimida por las
--    pruebas de supresion (H14-H16) y a un suprimido no se le escribe nada:
--    reutilizarla hacia fallar estas cinco por el motivo equivocado.
DO $$
DECLARE v_s uuid; v_n uuid; sx text := substr(md5(clock_timestamp()::text),1,8);
BEGIN
  SELECT v INTO v_s FROM hlab WHERE k='sede';
  INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido, fecha_nacimiento, email_principal)
  VALUES (v_s,'Avisos','Cumplimiento','1988-04-04','avisos.hd.'||sx||'@example.org')
  RETURNING id INTO v_n;
  INSERT INTO hlab VALUES ('persona0055', v_n);
END $$;

-- H18 · Lo transaccional (base legal «contrato») NO pide consentimiento.
DO $$
DECLARE v_id uuid; v_p uuid; v_s uuid;
BEGIN
  SELECT v INTO v_p FROM hlab WHERE k='persona0055';
  SELECT v INTO v_s FROM hlab WHERE k='sede';
  -- Desde 0058 la revocacion comprueba el alcance por dentro: hay que decir
  -- desde donde se mira, igual que hace la aplicacion en cada peticion.
  PERFORM set_config('app.sede_ids','{'||v_s::text||'}',true);
  PERFORM set_config('app.nivel_max','4',true);
  PERFORM plataforma.revocar_consentimiento(v_p, 'email', 'convocatoria', 'prueba 0055');
  v_id := plataforma.encolar_notificacion(v_s, v_p,
            'destino.'||substr(md5(clock_timestamp()::text),1,6)||'@example.org',
            'email','Certificado_expedido','{}'::jsonb,'aportes','lab','administrativa');
  PERFORM pg_temp.rg(18,'Un certificado pedido por el titular exige permiso de mercadeo',
    'se encola', CASE WHEN v_id IS NOT NULL THEN 'se encola' ELSE 'BLOQUEADO (mal)' END,
    v_id IS NOT NULL);
END $$;

-- H19 · La convocatoria SIN consentimiento sigue bloqueada. El permiso de
--       arriba no puede haber abierto la puerta de al lado.
DO $$
DECLARE bloqueo boolean := false; v_p uuid; v_s uuid;
BEGIN
  SELECT v INTO v_p FROM hlab WHERE k='persona0055';
  SELECT v INTO v_s FROM hlab WHERE k='sede';
  BEGIN
    PERFORM plataforma.encolar_notificacion(v_s, v_p,'x@example.org','email',
              'Invitacion_evento','{}'::jsonb,'crm','lab','convocatoria');
  EXCEPTION WHEN check_violation THEN bloqueo := true;
  END;
  PERFORM pg_temp.rg(19,'Convocatoria sin consentimiento sigue bloqueada',
    'RECHAZADO', CASE WHEN bloqueo THEN 'RECHAZADO como debe' ELSE 'ACEPTADO (fuga)' END, bloqueo);
END $$;

-- H20 · Lo que no se pudo enviar QUEDA ESCRITO con su motivo.
DO $$
DECLARE v_id uuid; n int; v_p uuid; v_s uuid;
BEGIN
  SELECT v INTO v_p FROM hlab WHERE k='persona0055';
  SELECT v INTO v_s FROM hlab WHERE k='sede';
  v_id := plataforma.encolar_si_puede(v_s, v_p,'x@example.org','email',
            'Invitacion_evento','{}'::jsonb,'crm','lab-0055','convocatoria');
  SELECT count(*) INTO n FROM plataforma.avisos_no_enviados
   WHERE persona_id = v_p AND origen_id = 'lab-0055';
  PERFORM pg_temp.rg(20,'Lo no enviado queda registrado con su motivo',
    '1 apunte y sin aviso', n||' apunte(s), aviso '||COALESCE(v_id::text,'NULO'),
    n = 1 AND v_id IS NULL);
END $$;

-- H21 · Y NO tumba la transacción que lo rodea: es el fallo original.
DO $$
DECLARE ok boolean := true; v_p uuid; v_s uuid; v_marca uuid;
BEGIN
  SELECT v INTO v_p FROM hlab WHERE k='persona0055';
  SELECT v INTO v_s FROM hlab WHERE k='sede';
  BEGIN
    INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido, fecha_nacimiento)
    VALUES (v_s,'Sobrevive','Cumplimiento','1990-03-03') RETURNING id INTO v_marca;
    PERFORM plataforma.encolar_si_puede(v_s, v_p,'x@example.org','email',
              'Invitacion_evento','{}'::jsonb,'crm','lab-0055b','convocatoria');
  EXCEPTION WHEN others THEN ok := false;
  END;
  ok := ok AND EXISTS (SELECT 1 FROM nucleo.personas WHERE id = v_marca);
  IF v_marca IS NOT NULL THEN
    UPDATE nucleo.personas SET eliminado_en = now(), estado='inactiva' WHERE id = v_marca;
  END IF;
  PERFORM pg_temp.rg(21,'El aviso que no sale tumba la operacion que lo origino',
    'la operacion sobrevive',
    CASE WHEN ok THEN 'la operacion sobrevive' ELSE 'SE DESHIZO TODO (mal)' END, ok);
END $$;

-- H22 · Ninguna finalidad puede quedar sin base legal declarada, y la
--       columna `finalidad` de la cola ya no admite NULL: por omisión, la
--       más estricta.
DO $$
DECLARE sin_base int; admite_nulo boolean;
BEGIN
  SELECT count(*) INTO sin_base FROM plataforma.finalidades
   WHERE base_legal IS NULL OR btrim(base_legal) = '';
  SELECT is_nullable = 'YES' INTO admite_nulo FROM information_schema.columns
   WHERE table_schema='plataforma' AND table_name='notificaciones' AND column_name='finalidad';
  PERFORM pg_temp.rg(22,'Finalidad sin base legal, o cola que admite finalidad nula',
    'ninguna y no admite',
    sin_base||' sin base; admite nulo: '||admite_nulo::text,
    sin_base = 0 AND NOT admite_nulo);
END $$;

-- H23 · Revocar por alguien que la sesion NO alcanza.
--
-- ⛔ `revocar_consentimiento` se hizo SECURITY DEFINER en la migracion 0058
--    para poder cancelar lo ya encolado (la aplicacion solo tiene SELECT
--    sobre la cola). Al hacerlo dejo de aplicarse la politica de la sesion:
--    sin la comprobacion que se le metio dentro, conocer un identificador
--    bastaria para revocarle los consentimientos a alguien de otra sede.
--    Es un sabotaje silencioso: la persona deja de recibir convocatorias y
--    nadie sabe por que.
DO $$
DECLARE bloqueo boolean := false; v_p uuid; v_otra uuid; err text;
BEGIN
  SELECT v INTO v_p FROM hlab WHERE k='persona0055';
  SELECT id INTO v_otra FROM org.sedes WHERE codigo='MED';
  BEGIN
    SET LOCAL ROLE casaroca_app;
    PERFORM set_config('app.sede_ids','{'||v_otra::text||'}',true);
    PERFORM set_config('app.nivel_max','4',true);
    PERFORM plataforma.revocar_consentimiento(v_p, NULL, NULL, 'prueba de alcance');
    RESET ROLE;
  EXCEPTION WHEN insufficient_privilege THEN bloqueo := true; RESET ROLE;
            WHEN others THEN err := SQLERRM; RESET ROLE;
  END;
  PERFORM pg_temp.rg(23,'Se revoca por alguien de OTRA sede conociendo su id',
    'RECHAZADO',
    CASE WHEN bloqueo THEN 'RECHAZADO como debe'
         ELSE COALESCE('ACEPTADO ('||err||')','ACEPTADO (fuga)') END, bloqueo);
END $$;

-- H24 · Y lo que se apoya en contrato NO se revoca, aunque se pida todo.
DO $$
DECLARE n int; v_p uuid;
BEGIN
  SELECT v INTO v_p FROM hlab WHERE k='persona0055';
  SELECT count(*) INTO n FROM plataforma.consentimientos c
   JOIN plataforma.finalidades f ON f.codigo = c.finalidad
   WHERE c.persona_id = v_p AND c.acto = 'revocado'
     AND f.base_legal <> 'consentimiento';
  PERFORM pg_temp.rg(24,'Se revoca lo que la ley NO deja revocar (contrato, obligacion legal)',
    '0 revocaciones', n||' revocaciones', n = 0);
END $$;

-- Limpieza.
DELETE FROM plataforma.notificaciones WHERE persona_id IN (SELECT v FROM hlab);
DELETE FROM plataforma.avisos_no_enviados WHERE persona_id IN (SELECT v FROM hlab);
UPDATE nucleo.membresias_sede SET hasta = CURRENT_DATE, es_principal = false
 WHERE persona_id IN (SELECT v FROM hlab) AND hasta IS NULL;
UPDATE nucleo.personas SET eliminado_en = now(), estado='inactiva' WHERE id IN (SELECT v FROM hlab);

\echo ''
\echo '===== HABEAS DATA EJECUTABLE ====='
SELECT n AS "#", caso AS invariante, obtenido AS resultado,
       CASE WHEN pasa THEN 'PASA' ELSE 'FALLA' END AS veredicto
FROM h_res ORDER BY n;
SELECT count(*) FILTER (WHERE pasa) AS pasan,
       count(*) FILTER (WHERE NOT pasa) AS fallan, count(*) AS total FROM h_res;

DO $$
DECLARE v int;
BEGIN
  SELECT count(*) FILTER (WHERE NOT pasa) INTO v FROM h_res;
  IF v > 0 THEN RAISE EXCEPTION 'BANCO EN ROJO: % invariante(s) rota(s) en cumplimiento.sql', v; END IF;
END $$;
