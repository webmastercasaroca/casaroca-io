-- ⛔ El fondo de prueba lleva sufijo aleatorio: iba cableado como 'GEN' y
--    `fondos_codigo_key` es único, así que la batería no se podía correr
--    dos veces seguidas sin recrear la base.
-- =====================================================================
-- BANCO DE INVARIANTES · MÓDULOS 03 a 10
-- Aportes · RocaKids · Formación · Talento · Grupos · Asistencia · Consejería
-- Todos los datos son sintéticos: los crea la propia prueba.
-- =====================================================================
\set ON_ERROR_STOP on

CREATE TEMP TABLE _mod (n int, nombre text, esperado text, obtenido text, paso boolean);
CREATE OR REPLACE FUNCTION pg_temp.reg(p_n int, p_nombre text, p_esp text, p_obt text, p_paso boolean)
RETURNS void LANGUAGE sql AS $$ INSERT INTO _mod VALUES (p_n,p_nombre,p_esp,p_obt,p_paso); $$;

-- ═══════════════════════ APORTES ═══════════════════════

-- M1 · La reconciliación cuadra al peso.
/* ⛔ UN MES LIBRE POR CORRIDA. `cierres_control` no admite UPDATE ni DELETE
   (reglas DO INSTEAD NOTHING, a propósito: un cierre de tesorería no se
   reescribe) ni ON CONFLICT (PostgreSQL lo prohíbe en tablas con reglas).
   Con el mes en curso fijo, la segunda corrida chocaba con la llave del
   cierre. Cada corrida toma el mes más reciente, hacia atrás desde 2025,
   que no tenga ni cierre ni aportes en la sede: así se repite sin fin y
   sin tocar la garantía. Una sede sintética no sirve: exige pastor. */
DO $$
DECLARE v_sede uuid; v_fondo uuid; v_p uuid; v_cuadra boolean; v_dif numeric; v_mes date;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-CHICO';
  SELECT d::date INTO v_mes
    FROM generate_series(DATE '2025-12-01', DATE '1990-01-01', interval '-1 month') d
   WHERE NOT EXISTS (SELECT 1 FROM aportes.cierres_control c
                      WHERE c.sede_id=v_sede AND c.anio=extract(year FROM d) AND c.mes=extract(month FROM d))
     AND NOT EXISTS (SELECT 1 FROM aportes.aportes a
                      WHERE a.sede_id=v_sede AND date_trunc('month',a.fecha)=d)
   ORDER BY d DESC LIMIT 1;
  INSERT INTO aportes.fondos (codigo,nombre,tipo) VALUES ('GEN-'||substr(md5(clock_timestamp()::text),1,6),'Fondo de prueba','general') RETURNING id INTO v_fondo;
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_sede,'Aportante','Uno',DATE '1960-01-01') RETURNING id INTO v_p;

  INSERT INTO aportes.aportes (sede_id,persona_id,fondo_id,tipo,monto,medio,fecha) VALUES
    (v_sede,v_p,v_fondo,'diezmo',  1500000.00,'transferencia', v_mes),
    (v_sede,v_p,v_fondo,'ofrenda',  250000.50,'efectivo',      v_mes);

  INSERT INTO aportes.cierres_control (sede_id,anio,mes,total_oficial,fuente)
  VALUES (v_sede, extract(year FROM v_mes)::smallint, extract(month FROM v_mes)::smallint,
          1750000.50,'Tesorería · cierre mensual');

  SELECT cuadra, diferencia INTO v_cuadra, v_dif FROM aportes.v_reconciliacion
   WHERE sede_id=v_sede AND anio=extract(year FROM v_mes)::smallint
     AND mes=extract(month FROM v_mes)::smallint;

  PERFORM pg_temp.reg(1,'Reconciliacion de aportes cuadra','cuadra=true, dif=0',
    'cuadra='||v_cuadra||', dif='||v_dif, v_cuadra AND v_dif = 0);
END $$;

-- M2 · Un peso de diferencia rompe la reconciliación (sobre el mes de M1).
DO $$
DECLARE v_sede uuid; v_fondo uuid; v_p uuid; v_cuadra boolean; v_dif numeric; v_mes date;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-CHICO';
  SELECT make_date(anio, mes, 1) INTO v_mes FROM aportes.cierres_control
   WHERE sede_id=v_sede AND fuente='Tesorería · cierre mensual'
   ORDER BY cargado_en DESC LIMIT 1;
  SELECT fondo_id, persona_id INTO v_fondo, v_p FROM aportes.aportes
   WHERE sede_id=v_sede AND fecha=v_mes LIMIT 1;
  INSERT INTO aportes.aportes (sede_id,persona_id,fondo_id,tipo,monto,medio,fecha)
  VALUES (v_sede,v_p,v_fondo,'ofrenda',1.00,'efectivo', v_mes);

  SELECT cuadra, diferencia INTO v_cuadra, v_dif FROM aportes.v_reconciliacion
   WHERE sede_id=v_sede AND anio=extract(year FROM v_mes)::smallint
     AND mes=extract(month FROM v_mes)::smallint;

  PERFORM pg_temp.reg(2,'Un peso de mas detiene la compuerta','cuadra=false, dif=1.00',
    'cuadra='||v_cuadra||', dif='||v_dif, (NOT v_cuadra) AND v_dif = 1.00);
END $$;

-- M3 · Un aporte sin persona debe declararse anónimo.
DO $$
DECLARE v_sede uuid; v_fondo uuid;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-CHICO';
  SELECT id INTO v_fondo FROM aportes.fondos WHERE codigo LIKE 'GEN-%' LIMIT 1;
  BEGIN
    INSERT INTO aportes.aportes (sede_id,persona_id,es_anonimo,fondo_id,tipo,monto,medio,fecha)
    VALUES (v_sede,NULL,false,v_fondo,'ofrenda',50000,'efectivo',CURRENT_DATE);
    PERFORM pg_temp.reg(3,'Aporte sin persona y sin declarar anonimo','RECHAZADO','ACEPTADO',false);
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.reg(3,'Aporte sin persona y sin declarar anonimo','RECHAZADO','RECHAZADO como debe',true);
  END;
END $$;

-- M4 · La vista del pastor congregacional NO tiene columna de monto.
DO $$
DECLARE v_tiene boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='aportes' AND table_name='v_habito_aporte'
       AND (column_name ILIKE '%monto%' OR column_name ILIKE '%total%' OR column_name ILIKE '%valor%')
  ) INTO v_tiene;
  PERFORM pg_temp.reg(4,'Vista del pastor sin columna de monto','sin columna de monto',
    CASE WHEN v_tiene THEN 'expone monto' ELSE 'no expone monto' END, NOT v_tiene);
END $$;

-- ═══════════════════════ ROCAKIDS ═══════════════════════

-- M5 · No se recibe a un menor sin acudiente vigente.
DO $$
DECLARE v_sede uuid; v_sala uuid; v_menor uuid; v_maestro uuid; v_llave text := 'llave-dev';
BEGIN
  PERFORM set_config('app.llave_n4', v_llave, true);
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-CHICO';
  INSERT INTO rocakids.salas (sede_id,codigo,nombre,edad_min,edad_max)
  VALUES (v_sede,'EXPL','Exploradores',6,9) RETURNING id INTO v_sala;
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_sede,'Maestro','Kids',CURRENT_DATE - interval '29 years') RETURNING id INTO v_maestro;
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_sede,'Huerfano','Kids',CURRENT_DATE - interval '7 years') RETURNING id INTO v_menor;

  BEGIN
    INSERT INTO rocakids.checkins (menor_id,sala_id,sede_id,entregado_por,recibido_por,codigo_cifrado)
    VALUES (v_menor,v_sala,v_sede,v_maestro,v_maestro, pgp_sym_encrypt('1111', v_llave));
    PERFORM pg_temp.reg(5,'Check-in de menor sin acudiente','RECHAZADO','ACEPTADO',false);
  EXCEPTION WHEN foreign_key_violation THEN
    PERFORM pg_temp.reg(5,'Check-in de menor sin acudiente','RECHAZADO','RECHAZADO como debe',true);
  END;
  INSERT INTO nucleo.acudientes (menor_id,acudiente_id,parentesco) VALUES (v_menor,v_maestro,'TUTOR');
  SET CONSTRAINTS ALL IMMEDIATE;
END $$;

-- M6/M7/M8/M9 · La entrega: tres condiciones, todas obligatorias.
DO $$
DECLARE
  v_sede uuid; v_sala uuid; v_menor uuid; v_madre uuid; v_tia uuid; v_maestro uuid;
  v_chk uuid; v_llave text := 'llave-dev'; v_salida timestamptz; v_bit bigint; v_res text;
BEGIN
  PERFORM set_config('app.llave_n4', v_llave, true);
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-CHICO';
  SELECT id INTO v_sala FROM rocakids.salas WHERE codigo='EXPL';
  SELECT id INTO v_maestro FROM nucleo.personas WHERE primer_nombre='Maestro' AND primer_apellido='Kids';

  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_sede,'Madre','Kids',CURRENT_DATE - interval '35 years') RETURNING id INTO v_madre;
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_sede,'Tia','Kids',CURRENT_DATE - interval '31 years') RETURNING id INTO v_tia;
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_sede,'Nino','Kids',CURRENT_DATE - interval '7 years') RETURNING id INTO v_menor;

  INSERT INTO nucleo.acudientes (menor_id,acudiente_id,parentesco,autoriza_retiro)
  VALUES (v_menor,v_madre,'MADRE',true), (v_menor,v_tia,'TIA',false);
  SET CONSTRAINTS ALL IMMEDIATE;

  INSERT INTO rocakids.checkins (menor_id,sala_id,sede_id,entregado_por,recibido_por,codigo_cifrado)
  VALUES (v_menor,v_sala,v_sede,v_madre,v_maestro, pgp_sym_encrypt('A7K2', v_llave))
  RETURNING id INTO v_chk;

  v_res := rocakids.entregar_menor(v_chk, v_tia, 'A7K2', v_maestro);
  PERFORM pg_temp.reg(6,'Retiro por acudiente SIN permiso de retiro','no_autorizado', v_res, v_res = 'no_autorizado');

  v_res := rocakids.entregar_menor(v_chk, v_madre, '0000', v_maestro);
  PERFORM pg_temp.reg(7,'Retiro con codigo incorrecto','codigo_incorrecto', v_res, v_res = 'codigo_incorrecto');

  v_res := rocakids.entregar_menor(v_chk, v_madre, 'A7K2', v_maestro);
  SELECT salida_en INTO v_salida FROM rocakids.checkins WHERE id = v_chk;
  PERFORM pg_temp.reg(8,'Retiro autorizado y con codigo correcto','entregado',
    v_res||CASE WHEN v_salida IS NULL THEN ' pero sin salida' ELSE ' y salida registrada' END,
    v_res = 'entregado' AND v_salida IS NOT NULL);

  SELECT count(*) INTO v_bit FROM rocakids.intentos_entrega WHERE checkin_id = v_chk;
  PERFORM pg_temp.reg(9,'Los intentos fallidos SOBREVIVEN','3 intentos registrados',
    v_bit::text||' intentos', v_bit = 3);
END $$;

-- M10 · La salida no se puede escribir a mano saltándose la función.
DO $$
DECLARE v_sede uuid; v_sala uuid; v_menor uuid; v_madre uuid; v_maestro uuid; v_chk uuid;
        v_llave text := 'llave-dev';
BEGIN
  PERFORM set_config('app.llave_n4', v_llave, true);
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-CHICO';
  SELECT id INTO v_sala FROM rocakids.salas WHERE codigo='EXPL';
  SELECT id INTO v_maestro FROM nucleo.personas WHERE primer_nombre='Maestro' AND primer_apellido='Kids';
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_sede,'Madre2','Kids',CURRENT_DATE - interval '36 years') RETURNING id INTO v_madre;
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_sede,'Nino2','Kids',CURRENT_DATE - interval '6 years') RETURNING id INTO v_menor;
  INSERT INTO nucleo.acudientes (menor_id,acudiente_id,parentesco,autoriza_retiro)
  VALUES (v_menor,v_madre,'MADRE',true);
  SET CONSTRAINTS ALL IMMEDIATE;
  INSERT INTO rocakids.checkins (menor_id,sala_id,sede_id,entregado_por,recibido_por,codigo_cifrado)
  VALUES (v_menor,v_sala,v_sede,v_madre,v_maestro, pgp_sym_encrypt('B3M9', v_llave))
  RETURNING id INTO v_chk;

  BEGIN
    UPDATE rocakids.checkins
       SET salida_en = now(), retirado_por = v_madre, autorizado_por = v_maestro
     WHERE id = v_chk;
    PERFORM pg_temp.reg(10,'Salida escrita a mano sin verificar','RECHAZADA','ACEPTADA',false);
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM pg_temp.reg(10,'Salida escrita a mano sin verificar','RECHAZADA','RECHAZADA como debe',true);
  END;
END $$;

-- M11 · Un menor no puede estar dentro dos veces.
DO $$
DECLARE v_sede uuid; v_sala uuid; v_menor uuid; v_madre uuid; v_maestro uuid;
        v_llave text := 'llave-dev';
BEGIN
  PERFORM set_config('app.llave_n4', v_llave, true);
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-CHICO';
  SELECT id INTO v_sala FROM rocakids.salas WHERE codigo='EXPL';
  SELECT id INTO v_maestro FROM nucleo.personas WHERE primer_nombre='Maestro' AND primer_apellido='Kids';
  SELECT id INTO v_madre FROM nucleo.personas WHERE primer_nombre='Madre2';
  SELECT id INTO v_menor FROM nucleo.personas WHERE primer_nombre='Nino2';
  BEGIN
    INSERT INTO rocakids.checkins (menor_id,sala_id,sede_id,entregado_por,recibido_por,codigo_cifrado)
    VALUES (v_menor,v_sala,v_sede,v_madre,v_maestro, pgp_sym_encrypt('C4X1', v_llave));
    PERFORM pg_temp.reg(11,'Segundo check-in con el menor adentro','RECHAZADO','ACEPTADO',false);
  EXCEPTION WHEN unique_violation THEN
    PERFORM pg_temp.reg(11,'Segundo check-in con el menor adentro','RECHAZADO','RECHAZADO como debe',true);
  END;
END $$;

-- ═══════════════════════ TALENTO ═══════════════════════

-- M12 · Servir con menores exige antecedentes verificados.
DO $$
DECLARE v_sede uuid; v_min uuid; v_p uuid;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-CHICO';
  -- El ministerio ya viene del seed de segmentos; se reutiliza si existe.
  INSERT INTO org.ministerios (codigo,nombre,clase,nivel_dato)
  VALUES ('ROCAKIDS','RocaKids','congregacional',4)
  ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre
  RETURNING id INTO v_min;
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_sede,'Voluntario','Nuevo',CURRENT_DATE - interval '24 years') RETURNING id INTO v_p;
  BEGIN
    INSERT INTO talento.voluntariados (persona_id,sede_id,ministerio_id,funcion,trabaja_con_menores)
    VALUES (v_p,v_sede,v_min,'Maestro de sala',true);
    PERFORM pg_temp.reg(12,'Voluntario con menores sin antecedentes','RECHAZADO','ACEPTADO',false);
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.reg(12,'Voluntario con menores sin antecedentes','RECHAZADO','RECHAZADO como debe',true);
  END;
END $$;

-- M13 · Una verificación de antecedentes vencida no sirve.
DO $$
DECLARE v_sede uuid; v_min uuid; v_p uuid;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-CHICO';
  SELECT id INTO v_min FROM org.ministerios WHERE codigo='ROCAKIDS';
  SELECT id INTO v_p FROM nucleo.personas WHERE primer_nombre='Voluntario';
  BEGIN
    INSERT INTO talento.voluntariados
      (persona_id,sede_id,ministerio_id,funcion,trabaja_con_menores,
       antecedentes_verificados_en,compromiso_firmado_en)
    VALUES (v_p,v_sede,v_min,'Maestro de sala',true,
            (CURRENT_DATE - interval '3 years')::date, (CURRENT_DATE - interval '3 years')::date);
    PERFORM pg_temp.reg(13,'Antecedentes vencidos (3 anios)','RECHAZADO','ACEPTADO',false);
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.reg(13,'Antecedentes vencidos (3 anios)','RECHAZADO','RECHAZADO como debe',true);
  END;
END $$;

-- M14 · Con antecedentes vigentes y compromiso firmado, sí entra.
DO $$
DECLARE v_sede uuid; v_min uuid; v_p uuid;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-CHICO';
  SELECT id INTO v_min FROM org.ministerios WHERE codigo='ROCAKIDS';
  SELECT id INTO v_p FROM nucleo.personas WHERE primer_nombre='Voluntario';
  INSERT INTO talento.voluntariados
    (persona_id,sede_id,ministerio_id,funcion,trabaja_con_menores,
     antecedentes_verificados_en,compromiso_firmado_en)
  VALUES (v_p,v_sede,v_min,'Maestro de sala',true,
          (CURRENT_DATE - interval '2 months')::date, CURRENT_DATE);
  PERFORM pg_temp.reg(14,'Voluntario verificado y vigente','ACEPTADO','ACEPTADO',true);
EXCEPTION WHEN others THEN
  PERFORM pg_temp.reg(14,'Voluntario verificado y vigente','ACEPTADO','RECHAZADO: '||SQLERRM,false);
END $$;

-- ═══════════════════════ FORMACIÓN ═══════════════════════

-- M15 · Una cohorte con valor exige declarar el estado de pago.
DO $$
DECLARE v_sede uuid; v_prog uuid; v_curso uuid; v_coh uuid; v_p uuid;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-CHICO';
  INSERT INTO formacion.programas (codigo,nombre,tipo) VALUES ('IBLI','Instituto IBLI','instituto') RETURNING id INTO v_prog;
  INSERT INTO formacion.cursos (programa_id,codigo,nombre,otorga_certificado)
  VALUES (v_prog,'IBLI-101','Fundamentos',true) RETURNING id INTO v_curso;
  INSERT INTO formacion.cohortes (curso_id,sede_id,codigo,inicia,cupo,valor)
  VALUES (v_curso,v_sede,'2026-1',CURRENT_DATE,2,180000) RETURNING id INTO v_coh;
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_sede,'Estudiante','Uno',CURRENT_DATE - interval '22 years') RETURNING id INTO v_p;

  BEGIN
    INSERT INTO formacion.inscripciones (cohorte_id,persona_id,estado_pago)
    VALUES (v_coh,v_p,'no_aplica');
    PERFORM pg_temp.reg(15,'Curso con valor e inscripcion sin pago declarado','RECHAZADA','ACEPTADA',false);
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.reg(15,'Curso con valor e inscripcion sin pago declarado','RECHAZADA','RECHAZADA como debe',true);
  END;
END $$;

-- M16 · El cupo de la cohorte no se puede exceder.
DO $$
DECLARE v_sede uuid; v_coh uuid; v_p1 uuid; v_p2 uuid; v_p3 uuid;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-CHICO';
  SELECT id INTO v_coh FROM formacion.cohortes WHERE codigo='2026-1';
  SELECT id INTO v_p1 FROM nucleo.personas WHERE primer_nombre='Estudiante' AND primer_apellido='Uno';
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_sede,'Estudiante','Dos',CURRENT_DATE - interval '23 years') RETURNING id INTO v_p2;
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_sede,'Estudiante','Tres',CURRENT_DATE - interval '24 years') RETURNING id INTO v_p3;

  INSERT INTO formacion.inscripciones (cohorte_id,persona_id,estado_pago) VALUES (v_coh,v_p1,'pagado');
  INSERT INTO formacion.inscripciones (cohorte_id,persona_id,estado_pago) VALUES (v_coh,v_p2,'pendiente');
  BEGIN
    INSERT INTO formacion.inscripciones (cohorte_id,persona_id,estado_pago) VALUES (v_coh,v_p3,'pendiente');
    PERFORM pg_temp.reg(16,'Inscripcion por encima del cupo','RECHAZADA','ACEPTADA',false);
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.reg(16,'Inscripcion por encima del cupo','RECHAZADA','RECHAZADA como debe',true);
  END;
END $$;

-- M17 · No se certifica a quien no aprobó.
DO $$
DECLARE v_ins uuid;
BEGIN
  SELECT i.id INTO v_ins FROM formacion.inscripciones i
   JOIN formacion.cohortes c ON c.id=i.cohorte_id WHERE c.codigo='2026-1' LIMIT 1;
  BEGIN
    INSERT INTO formacion.certificados (inscripcion_id,codigo) VALUES (v_ins,'CERT-0001');
    PERFORM pg_temp.reg(17,'Certificado sin aprobar el curso','RECHAZADO','ACEPTADO',false);
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.reg(17,'Certificado sin aprobar el curso','RECHAZADO','RECHAZADO como debe',true);
  END;
END $$;

-- ═══════════════════════ GRUPOS Y ASISTENCIA ═══════════════════════

-- M18 · Una persona no puede vivir en dos hogares a la vez.
DO $$
DECLARE v_sede uuid; v_h1 uuid; v_h2 uuid; v_p uuid;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-CHICO';
  INSERT INTO grupos.hogares (sede_id,nombre) VALUES (v_sede,'Hogar A') RETURNING id INTO v_h1;
  INSERT INTO grupos.hogares (sede_id,nombre) VALUES (v_sede,'Hogar B') RETURNING id INTO v_h2;
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_sede,'Mudanza','Pendiente',CURRENT_DATE - interval '33 years') RETURNING id INTO v_p;
  INSERT INTO grupos.hogar_miembros (hogar_id,persona_id) VALUES (v_h1,v_p);
  BEGIN
    INSERT INTO grupos.hogar_miembros (hogar_id,persona_id) VALUES (v_h2,v_p);
    PERFORM pg_temp.reg(18,'Persona en dos hogares a la vez','RECHAZADA','ACEPTADA',false);
  EXCEPTION WHEN unique_violation THEN
    PERFORM pg_temp.reg(18,'Persona en dos hogares a la vez','RECHAZADA','RECHAZADA como debe',true);
  END;
END $$;

-- M19 · No se marca entrada en un servicio que no admite check-in.
DO $$
DECLARE v_sede uuid; v_serv uuid; v_p uuid;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-CHICO';
  INSERT INTO asistencia.servicios (sede_id,fecha,hora_inicio,tipo,admite_checkin)
  VALUES (v_sede,CURRENT_DATE,'10:00','dominical',false) RETURNING id INTO v_serv;
  SELECT id INTO v_p FROM nucleo.personas WHERE primer_nombre='Mudanza';
  BEGIN
    INSERT INTO asistencia.entradas (servicio_id,persona_id) VALUES (v_serv,v_p);
    PERFORM pg_temp.reg(19,'Entrada en servicio sin check-in','RECHAZADA','ACEPTADA',false);
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.reg(19,'Entrada en servicio sin check-in','RECHAZADA','RECHAZADA como debe',true);
  END;
END $$;

-- M20 · El total del conteo es generado: no puede contradecir sus sumandos.
DO $$
DECLARE v_sede uuid; v_serv uuid; v_total integer;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-CHICO';
  INSERT INTO asistencia.servicios (sede_id,fecha,hora_inicio,tipo,admite_checkin)
  VALUES (v_sede,CURRENT_DATE,'08:00','dominical',true) RETURNING id INTO v_serv;
  INSERT INTO asistencia.conteos (servicio_id,adultos,jovenes,ninos,primera_vez)
  VALUES (v_serv,120,45,60,12);
  SELECT total INTO v_total FROM asistencia.conteos WHERE servicio_id=v_serv;
  PERFORM pg_temp.reg(20,'Total del conteo generado','225', v_total::text, v_total = 225);
END $$;

-- M21 · Las notas de consejería no se pueden borrar ni editar.
DO $$
DECLARE v_sede uuid; v_p uuid; v_caso uuid; v_antes bigint; v_despues bigint;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-CHICO';
  INSERT INTO consejeria.topicos (codigo,nombre,categoria) VALUES ('FAM','Familia','relacional')
  ON CONFLICT (codigo) DO NOTHING;
  SELECT id INTO v_p FROM nucleo.personas WHERE primer_nombre='Mudanza';
  INSERT INTO consejeria.casos (consultante_id,sede_id,topico) VALUES (v_p,v_sede,'FAM') RETURNING id INTO v_caso;
  INSERT INTO consejeria.notas (caso_id,autor_id,contenido) VALUES (v_caso,v_p,'Primera sesion registrada.');
  SELECT count(*) INTO v_antes FROM consejeria.notas;
  DELETE FROM consejeria.notas;
  UPDATE consejeria.notas SET contenido = 'reescrito';
  SELECT count(*) INTO v_despues FROM consejeria.notas;
  PERFORM pg_temp.reg(21,'Notas de consejeria append-only',
    v_antes::text||' intactas', v_despues::text, v_antes = v_despues AND v_antes > 0);
END $$;

\echo ''
\echo '===== INVARIANTES DE MODULOS (esquemas 03 a 10) ====='
SELECT n AS "#", nombre AS "invariante", obtenido AS "resultado",
       CASE WHEN paso THEN 'PASA' ELSE 'FALLA' END AS "veredicto"
FROM _mod ORDER BY n;

SELECT count(*) FILTER (WHERE paso) AS "pasan",
       count(*) FILTER (WHERE NOT paso) AS "fallan",
       count(*) AS "total"
FROM _mod;


-- ⛔ COMPUERTA. Sin esto, el banco IMPRIME los fallos y devuelve exito: la
--    integracion continua daria por buena una invariante rota. Se descubrio
--    el 19 de septiembre de 2026: 7 de los 8 bancos eran un informe, no una
--    compuerta.
DO $$
DECLARE v int;
BEGIN
  SELECT count(*) FILTER (WHERE NOT paso) INTO v FROM _mod;
  IF v > 0 THEN
    RAISE EXCEPTION 'BANCO EN ROJO: % invariante(s) rota(s) en invariantes_modulos.sql', v;
  END IF;
END $$;
