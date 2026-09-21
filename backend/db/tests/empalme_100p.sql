-- ⛔ LOS CORREOS DE PRUEBA LLEVAN SUFIJO ALEATORIO, Y NO ES UN CAPRICHO.
--    Iban cableados ('carlos.prueba@example.org') y `personas_email_uq` es
--    único, así que la batería SOLO se podía correr una vez: la segunda
--    reventaba con «duplicate key». Una prueba que no se puede repetir sin
--    recrear la base entera no es una prueba, es un trámite.
-- =====================================================================
-- BANCO DE PRUEBAS · EMPALME CON LOS MÓDULOS DEL EQUIPO 100p
-- Certificados tributarios · permisos nombrados · bandeja de nuevos.
-- Datos sintéticos: los crea la propia prueba.
-- =====================================================================
\set ON_ERROR_STOP on
-- ⛔ AYUDA DE LABORATORIO. Desde la migracion 0053, encolar un aviso EXIGE
--    consentimiento vigente de esa persona para ese canal y esa finalidad.
--    Los datos de prueba tienen que ser tan legales como los de verdad: si
--    el banco pudiera saltarse el consentimiento, estaria probando un
--    sistema que no existe.
CREATE OR REPLACE FUNCTION pg_temp.consentir(p_persona uuid) RETURNS void
LANGUAGE sql AS $$
  INSERT INTO plataforma.consentimientos
    (persona_id, sede_id, finalidad, canal, acto, ocurrido_en, evidencia_tipo, evidencia_ref)
  SELECT p_persona, p.sede_id, f.codigo, c.canal, 'otorgado', now(), 'formulario_web', 'banco de pruebas'
  FROM nucleo.personas p
  CROSS JOIN plataforma.finalidades f
  CROSS JOIN (SELECT unnest(enum_range(NULL::plataforma.canal_contacto)) AS canal) c
  WHERE p.id = p_persona
    -- ⛔ Sin ON CONFLICT: `consentimientos` es append-only con REGLAS, y
    --    PostgreSQL no admite ON CONFLICT sobre una tabla con reglas.
    AND NOT EXISTS (SELECT 1 FROM plataforma.consentimientos x
                    WHERE x.persona_id = p_persona AND x.canal = c.canal
                      AND x.finalidad = f.codigo);
$$;

CREATE TEMP TABLE _e (n int, nombre text, esperado text, obtenido text, paso boolean);
CREATE OR REPLACE FUNCTION pg_temp.rg(a int,b text,c text,d text,e boolean) RETURNS void
LANGUAGE sql AS $$ INSERT INTO _e VALUES (a,b,c,d,e); $$;

-- ═══════════ CERTIFICADOS ═══════════

-- P1 · El total del certificado se CALCULA, y cuadra con sus renglones.
DO $$
DECLARE v_sede uuid; v_f uuid; v_p uuid; v_cert uuid; v_cuadra boolean; v_total numeric;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-CHICO';
  INSERT INTO aportes.fondos (codigo,nombre,tipo) VALUES ('GENC','General cert','general') RETURNING id INTO v_f;
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_sede,'Donante','Anual',DATE '1985-04-04') RETURNING id INTO v_p;
  PERFORM pg_temp.consentir(v_p);
  INSERT INTO aportes.aportes (sede_id,persona_id,fondo_id,tipo,monto,medio,fecha) VALUES
    (v_sede,v_p,v_f,'diezmo',400000.00,'transferencia',DATE '2026-01-15'),
    (v_sede,v_p,v_f,'diezmo',400000.00,'transferencia',DATE '2026-02-15'),
    (v_sede,v_p,v_f,'ofrenda',150000.50,'efectivo',    DATE '2026-03-10');

  v_cert := aportes.expedir_certificado(v_p, DATE '2026-01-01', DATE '2026-12-31','CERT-2026-0001', v_p);
  SELECT cuadra, total_certificado INTO v_cuadra, v_total
    FROM aportes.v_control_certificados WHERE id = v_cert;
  PERFORM pg_temp.rg(1,'El certificado cuadra con sus renglones','950.000,50 y cuadra',
    v_total::text||' · cuadra='||v_cuadra, v_cuadra AND v_total = 950000.50);
END $$;

-- P2 · Un aporte certificado NO se puede modificar.
DO $$
DECLARE v_a uuid;
BEGIN
  SELECT id INTO v_a FROM aportes.aportes WHERE estado='certificado' LIMIT 1;
  BEGIN
    UPDATE aportes.aportes SET monto = 1 WHERE id = v_a;
    PERFORM pg_temp.rg(2,'Modificar un aporte certificado','RECHAZADO','ACEPTADO',false);
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.rg(2,'Modificar un aporte certificado','RECHAZADO','RECHAZADO como debe',true);
  END;
END $$;

-- P3 · Tampoco se puede anular.
DO $$
DECLARE v_a uuid;
BEGIN
  SELECT id INTO v_a FROM aportes.aportes WHERE estado='certificado' LIMIT 1;
  BEGIN
    UPDATE aportes.aportes SET estado='anulado', anulado_en=now(), anulado_motivo='error' WHERE id=v_a;
    PERFORM pg_temp.rg(3,'Anular un aporte certificado','RECHAZADO','ACEPTADO',false);
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.rg(3,'Anular un aporte certificado','RECHAZADO','RECHAZADO como debe',true);
  END;
END $$;

-- P4 · Un certificado no puede mezclar monedas.
DO $$
DECLARE v_sede uuid; v_f uuid; v_p uuid;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-CHICO';
  SELECT id INTO v_f FROM aportes.fondos WHERE codigo='GENC';
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_sede,'Donante','Mixto',DATE '1980-01-01') RETURNING id INTO v_p;
  PERFORM pg_temp.consentir(v_p);
  INSERT INTO aportes.aportes (sede_id,persona_id,fondo_id,tipo,monto,moneda,medio,fecha) VALUES
    (v_sede,v_p,v_f,'ofrenda',100000,'COP','efectivo',DATE '2026-05-01'),
    (v_sede,v_p,v_f,'ofrenda',   100,'USD','efectivo',DATE '2026-06-01');
  BEGIN
    PERFORM aportes.expedir_certificado(v_p, DATE '2026-01-01', DATE '2026-12-31','CERT-2026-0002', v_p);
    PERFORM pg_temp.rg(4,'Certificado con monedas mezcladas','RECHAZADO','ACEPTADO',false);
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.rg(4,'Certificado con monedas mezcladas','RECHAZADO','RECHAZADO como debe',true);
  END;
END $$;

-- ═══════════ PERMISOS NOMBRADOS ═══════════

-- P5 · Un permiso nombrado no se puede otorgar fuera de su módulo.
DO $$
BEGIN
  BEGIN
    INSERT INTO sistema.matriz_permisos (rol,modulo,accion)
    VALUES ('CONTABILIDAD','consejeria','EXPEDIR_CERTIFICADO');
    PERFORM pg_temp.rg(5,'Permiso nombrado fuera de su modulo','RECHAZADO','ACEPTADO',false);
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.rg(5,'Permiso nombrado fuera de su modulo','RECHAZADO','RECHAZADO como debe',true);
  END;
END $$;

-- P6 · Los verbos genéricos siguen valiendo en cualquier módulo.
DO $$
DECLARE v_n bigint;
BEGIN
  SELECT count(*) INTO v_n FROM sistema.matriz_permisos mp
   JOIN sistema.acciones a ON a.codigo = mp.accion WHERE a.modulo IS NULL;
  PERFORM pg_temp.rg(6,'Verbos genericos conviven con los nombrados','>50',
    v_n::text||' filas', v_n > 50);
END $$;

-- P7 · El coordinador de nuevos existe y tiene sus permisos.
DO $$
DECLARE v_falta text;
BEGIN
  /* ⛔ Esta prueba afirmaba `count(*) = 5` y se rompio el 11 de septiembre
     al anadir modulos legitimos que el rol tambien necesita. El numero no
     era la regla: era una foto del dia que se escribio.

     Lo que de verdad hay que garantizar es que el rol conserve los
     permisos del CONTRATO del Modulo de Nuevos del equipo 100p. Si
     manana se le suman diez permisos mas, eso no rompe nada; lo que
     rompe es que le falte uno de estos. */
  SELECT string_agg(x.modulo||'.'||x.accion, ', ') INTO v_falta
  FROM (VALUES ('crm','ver'),('crm','crear'),('crm','REGISTRAR_CONTACTO'),
               ('crm','CONVERTIR_MIEMBRO'),('personas','ver')) AS x(modulo,accion)
  WHERE NOT EXISTS (SELECT 1 FROM sistema.matriz_permisos m
                    WHERE m.rol='COORDINADOR_NUEVOS' AND m.modulo=x.modulo AND m.accion=x.accion);
  PERFORM pg_temp.rg(7,'COORDINADOR_NUEVOS conserva el contrato del modulo',
    'los 5 del contrato', COALESCE('le falta: '||v_falta,'los tiene todos'), v_falta IS NULL);
END $$;

-- ═══════════ BANDEJA DE NUEVOS ═══════════

-- P8 · Un registro sin correo NI teléfono no sirve y se rechaza.
DO $$
DECLARE v_sede uuid;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-NORTE';
  BEGIN
    INSERT INTO crm.nuevos_registros (sede_id,nombre,canales_autorizados,autorizado_en) VALUES (v_sede,'Fantasma Sin Contacto',ARRAY['email','whatsapp']::plataforma.canal_contacto[],now());
    PERFORM pg_temp.rg(8,'Nuevo sin ninguna forma de contacto','RECHAZADO','ACEPTADO',false);
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.rg(8,'Nuevo sin ninguna forma de contacto','RECHAZADO','RECHAZADO como debe',true);
  END;
END $$;

-- P9 · Convertir crea la persona y abre el 4C con la fecha REAL de llegada.
DO $$
DECLARE v_sede uuid; v_nuevo uuid; v_p uuid; v_entro timestamptz; v_reg timestamptz;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-NORTE';
  INSERT INTO crm.nuevos_registros (sede_id,nombre,email,como_supo,es_cristiano,registrado_en,canales_autorizados,autorizado_en) VALUES (v_sede,'Marta Llegada','marta.llegada.'||substr(md5(clock_timestamp()::text),1,8)||'@example.org','amigo','duda', now() - interval '20 days',ARRAY['email','whatsapp']::plataforma.canal_contacto[],now())
  RETURNING id, registrado_en INTO v_nuevo, v_reg;

  v_p := crm.convertir_en_miembro(v_nuevo, NULL, 'Decidió integrarse');
  SELECT entro_en INTO v_entro FROM crm.recorrido WHERE persona_id = v_p AND salio_en IS NULL;

  PERFORM pg_temp.rg(9,'El 4C arranca en la fecha de llegada, no de hoy','hace 20 dias',
    CASE WHEN v_entro = v_reg THEN 'hace 20 dias' ELSE 'usó la fecha de hoy' END, v_entro = v_reg);
END $$;

-- P10 · Convertir dos veces el mismo registro se rechaza.
DO $$
DECLARE v_nuevo uuid;
BEGIN
  SELECT id INTO v_nuevo FROM crm.nuevos_registros WHERE estado='convertido' LIMIT 1;
  BEGIN
    PERFORM crm.convertir_en_miembro(v_nuevo, NULL, NULL);
    PERFORM pg_temp.rg(10,'Convertir dos veces el mismo registro','RECHAZADO','ACEPTADO',false);
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.rg(10,'Convertir dos veces el mismo registro','RECHAZADO','RECHAZADO como debe',true);
  END;
END $$;

-- P11 · Si la persona YA existe en el maestro, se vincula en vez de duplicar.
DO $$
DECLARE v_sede uuid; v_p1 uuid; v_nuevo uuid; v_p2 uuid; v_total bigint; v_email text;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-NORTE';
  /* ⛔ Un solo correo. `clock_timestamp()` cambia en cada llamada: generarlo
     tres veces daba tres correos distintos y la prueba fallaba sin que el
     sistema tuviera nada roto. */
  v_email := 'pedro.existente.'||substr(md5(clock_timestamp()::text),1,8)||'@example.org';
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,email_principal,fecha_nacimiento)
  VALUES (v_sede,'Pedro','Existente',v_email,DATE '1990-02-02')
  RETURNING id INTO v_p1;
  PERFORM pg_temp.consentir(v_p1);
  INSERT INTO crm.nuevos_registros (sede_id,nombre,email,como_supo,canales_autorizados,autorizado_en) VALUES (v_sede,'Pedro Existente',v_email,'redes',ARRAY['email','whatsapp']::plataforma.canal_contacto[],now()) RETURNING id INTO v_nuevo;

  v_p2 := crm.convertir_en_miembro(v_nuevo, NULL, NULL);
  SELECT count(*) INTO v_total FROM nucleo.personas
   WHERE email_principal=v_email AND eliminado_en IS NULL;
  PERFORM pg_temp.rg(11,'Convertir a alguien que ya existe no lo duplica','1 persona',
    v_total::text||' persona(s)', v_p1 = v_p2 AND v_total = 1);
END $$;

-- P12 · La bandeja marca ATRASADO lo que lleva mas de 48 horas.
DO $$
DECLARE v_sede uuid; v_estado text;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='MED';
  INSERT INTO crm.nuevos_registros (sede_id,nombre,telefono,registrado_en,canales_autorizados,autorizado_en) VALUES (v_sede,'Olvidado Tres Dias','+57 3000000000', now() - interval '3 days',ARRAY['email','whatsapp']::plataforma.canal_contacto[],now());
  SELECT proxima_accion INTO v_estado FROM crm.v_bandeja_nuevos WHERE nombre='Olvidado Tres Dias';
  PERFORM pg_temp.rg(12,'La bandeja marca los atrasados','ATRASADO', v_estado, v_estado = 'ATRASADO');
END $$;

\echo ''
\echo '===== EMPALME CON LOS MODULOS 100p ====='
SELECT n AS "#", nombre AS "invariante", obtenido AS "resultado",
       CASE WHEN paso THEN 'PASA' ELSE 'FALLA' END AS "veredicto"
FROM _e ORDER BY n;
SELECT count(*) FILTER (WHERE paso) AS "pasan", count(*) FILTER (WHERE NOT paso) AS "fallan", count(*) AS "total" FROM _e;


-- ⛔ COMPUERTA. Sin esto, el banco IMPRIME los fallos y devuelve exito: la
--    integracion continua daria por buena una invariante rota. Se descubrio
--    el 19 de septiembre de 2026: 7 de los 8 bancos eran un informe, no una
--    compuerta.
DO $$
DECLARE v int;
BEGIN
  SELECT count(*) FILTER (WHERE NOT paso) INTO v FROM _e;
  IF v > 0 THEN
    RAISE EXCEPTION 'BANCO EN ROJO: % invariante(s) rota(s) en empalme_100p.sql', v;
  END IF;
END $$;
