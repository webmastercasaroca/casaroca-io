-- =====================================================================
-- Migración 0050 — EL CHECK-IN DEL DOMINGO, DE VERDAD
--
-- ⛔ LO QUE SE DESCUBRIÓ AL REVISAR SI ESTO ESTABA LISTO PARA AUDITORÍA:
--    la pantalla de check-in encolaba en el navegador y enviaba a
--    `/api/v1/rocakids/checkin`, UNA RUTA QUE NO EXISTÍA. Con la política
--    de la cola (un 4xx se descarta porque reintentar lo que el servidor
--    rechaza solo esconde el problema), cada registro del domingo habría
--    terminado en un aviso y en la basura.
--
--    La base tenía TODO lo difícil desde la migración 0014: el acudiente
--    obligatorio, el código cifrado, la entrega verificada, los intentos
--    fallidos. Lo que faltaba era la puerta.
--
-- ⭐ Y LA PIEZA QUE NADIE PIDE HASTA QUE DUELE: IDEMPOTENCIA.
--    La cola sin conexión reintenta. Sin idempotencia, un domingo con mala
--    señal genera dos, tres o cinco ingresos del mismo niño, cada uno con
--    su código, y a la salida nadie sabe cuál es el bueno. Registrar dos
--    veces al mismo menor, en la misma sala, el mismo día y sin haber
--    salido, devuelve EL MISMO ingreso. No falla: devuelve lo que ya hay.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · REGISTRAR UN INGRESO
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rocakids.registrar_checkin(
  p_menor        uuid,
  p_sala         uuid,
  p_entregado_por uuid,
  p_recibido_por uuid,
  p_servicio     uuid DEFAULT NULL
) RETURNS TABLE(checkin_id uuid, codigo text, repetido boolean)
LANGUAGE plpgsql AS $$
DECLARE
  v_llave text := plataforma.llave_n4();
  v_sede uuid; v_existente uuid; v_codigo text; v_id uuid;
  v_edad int; v_min smallint; v_max smallint; v_sala_nombre text;
BEGIN
  IF v_llave IS NULL THEN
    RAISE EXCEPTION 'No hay llave N4 en la sesion: el codigo de entrega no se puede cifrar'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT sede_id, edad_min, edad_max, nombre INTO v_sede, v_min, v_max, v_sala_nombre
  FROM rocakids.salas WHERE id = p_sala AND activa;
  IF v_sede IS NULL THEN
    RAISE EXCEPTION 'La sala no existe o esta inactiva' USING ERRCODE = 'no_data_found';
  END IF;

  -- ⛔ El menor tiene que ser de una sede que la sesion alcance. Sin esto,
  --    conocer un identificador bastaria para registrar a un niño ajeno.
  IF NOT EXISTS (SELECT 1 FROM nucleo.personas WHERE id = p_menor) THEN
    RAISE EXCEPTION 'No se encuentra a ese menor en su alcance' USING ERRCODE = 'no_data_found';
  END IF;

  -- ⭐ IDEMPOTENCIA. Es lo que hace que la cola sin conexion sea segura.
  SELECT id INTO v_existente
  FROM rocakids.checkins
  WHERE menor_id = p_menor AND sala_id = p_sala
    AND ingreso_en::date = CURRENT_DATE AND salida_en IS NULL;
  IF v_existente IS NOT NULL THEN
    RETURN QUERY SELECT v_existente, NULL::text, true;
    RETURN;
  END IF;

  -- La sala tiene un rango de edad y existe por una razon: un niño de once
  -- años en la sala de cuna no es un error de datos, es un problema real.
  SELECT extract(year from age(fecha_nacimiento))::int INTO v_edad
  FROM nucleo.personas WHERE id = p_menor;
  IF v_edad IS NOT NULL AND (v_edad < v_min OR v_edad > v_max) THEN
    RAISE EXCEPTION 'La sala «%» es para % a % años y el menor tiene %',
      v_sala_nombre, v_min, v_max, v_edad USING ERRCODE = 'check_violation';
  END IF;

  -- Código de cuatro caracteres, sin letras que se confundan con números
  -- cuando alguien lo lee de un papel a media luz (I, O, 0, 1).
  v_codigo := (
    SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
                             (floor(random()*32)+1)::int, 1), '')
    FROM generate_series(1,4));

  INSERT INTO rocakids.checkins
    (menor_id, sala_id, servicio_id, sede_id, entregado_por, recibido_por, codigo_cifrado)
  VALUES (p_menor, p_sala, p_servicio, v_sede, p_entregado_por, p_recibido_por,
          pgp_sym_encrypt(v_codigo, v_llave))
  RETURNING id INTO v_id;

  PERFORM crm.anotar_hecho(p_menor, v_sede, now(), 'CHECKIN_ROCAKIDS', 'rocakids',
    'checkin', v_id::text, 'Ingreso a la sala '||v_sala_nombre, NULL);

  RETURN QUERY SELECT v_id, v_codigo, false;
END $$;

COMMENT ON FUNCTION rocakids.registrar_checkin IS
  'Devuelve el codigo UNA vez. Despues solo existe cifrado. Idempotente por menor, sala y dia: la cola sin conexion puede reintentar sin duplicar.';

-- ---------------------------------------------------------------------
-- 2 · LO QUE LA SALA NECESITA SABER, Y NADA MÁS
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW rocakids.v_roster_sala
WITH (security_invoker = true) AS
SELECT s.id AS sala_id, s.sede_id, s.codigo AS sala, s.nombre AS sala_nombre,
       s.edad_min, s.edad_max,
       p.id AS menor_id,
       trim(concat_ws(' ', p.primer_nombre, p.primer_apellido)) AS menor,
       extract(year from age(p.fecha_nacimiento))::int AS edad,
       (SELECT count(*) FROM rocakids.condiciones_medicas cm
         WHERE cm.menor_id = p.id) AS condiciones,
       EXISTS (SELECT 1 FROM rocakids.checkins c
               WHERE c.menor_id = p.id AND c.ingreso_en::date = CURRENT_DATE
                 AND c.salida_en IS NULL) AS esta_dentro
FROM rocakids.salas s
JOIN nucleo.personas p ON p.sede_id = s.sede_id AND p.eliminado_en IS NULL
  AND p.fecha_nacimiento IS NOT NULL
  AND extract(year from age(p.fecha_nacimiento)) BETWEEN s.edad_min AND s.edad_max
WHERE s.activa;

COMMENT ON VIEW rocakids.v_roster_sala IS
  'Quien puede entrar a cada sala hoy. Es lo que la pantalla guarda en el equipo para trabajar sin conexion: nombres y edades, NUNCA condiciones medicas ni codigos.';

CREATE OR REPLACE VIEW rocakids.v_sala_ahora
WITH (security_invoker = true) AS
SELECT s.id AS sala_id, s.sede_id, s.codigo AS sala, s.nombre,
       s.capacidad,
       count(c.id) FILTER (WHERE c.salida_en IS NULL) AS ninos_dentro,
       (SELECT count(*) FROM rocakids.servidores_sala d
         WHERE d.sala_id = s.id AND d.fecha = CURRENT_DATE AND d.salio_en IS NULL) AS adultos,
       (SELECT count(*) FROM rocakids.servidores_sala d
         WHERE d.sala_id = s.id AND d.fecha = CURRENT_DATE AND d.salio_en IS NULL) >= 2 AS regla_dos_adultos
FROM rocakids.salas s
LEFT JOIN rocakids.checkins c ON c.sala_id = s.id AND c.ingreso_en::date = CURRENT_DATE
WHERE s.activa
GROUP BY s.id, s.sede_id, s.codigo, s.nombre, s.capacidad;

-- ---------------------------------------------------------------------
-- 3 · QUIÉN PUEDE RETIRAR A ESTE NIÑO
--     La pantalla NO ofrece un campo de texto libre: ofrece la lista de
--     quienes están autorizados. Un texto libre convierte la salvaguarda
--     en una formalidad.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW rocakids.v_acudientes_del_menor
WITH (security_invoker = true) AS
SELECT a.menor_id,
       a.acudiente_id,
       trim(concat_ws(' ', p.primer_nombre, p.primer_apellido)) AS acudiente,
       a.parentesco,
       a.autoriza_retiro,
       a.vigente_desde, a.vigente_hasta
FROM nucleo.acudientes a
JOIN nucleo.personas p ON p.id = a.acudiente_id
WHERE a.vigente_desde <= CURRENT_DATE
  AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE);

GRANT SELECT ON rocakids.v_roster_sala, rocakids.v_sala_ahora,
                rocakids.v_acudientes_del_menor TO casaroca_app;
GRANT EXECUTE ON FUNCTION rocakids.registrar_checkin(uuid,uuid,uuid,uuid,uuid) TO casaroca_app;
