-- =====================================================================
-- 0057 · EL CHECK-IN NO REVIENTA UN DOMINGO POR UNA SALIDA DE LA SEMANA
--        PASADA
--
-- ⛔ HALLAZGO DEL AUDITOR DE RENDIMIENTO, 19 de septiembre de 2026.
--
--    `rocakids.checkins` tiene `checkin_abierto_uq UNIQUE (menor_id)
--    WHERE salida_en IS NULL`: un menor no puede estar en dos salas a la
--    vez. Correcto. Pero la comprobacion de idempotencia de
--    `registrar_checkin` busca por (menor, SALA, dia), asi que:
--
--      · Si a un niño se le olvido registrar la salida un domingo (pasa, y
--        el propio codigo lo llama «un incidente»), el domingo siguiente
--        su check-in en OTRA sala no encuentra coincidencia... y el INSERT
--        choca contra el indice unico con un 23505 en crudo.
--      · Lo mismo si el niño CAMBIA de sala el mismo dia, que es lo normal
--        cuando llega a la sala equivocada.
--
--    Resultado: un error duro, en la pantalla de check-in, a las 9 de la
--    mañana, con la fila de padres delante. Y la causa es de la semana
--    anterior, asi que quien lo sufre no tiene forma de entenderlo.
--
--    Lo que hace esta migracion: en vez de reventar, CIERRA el ingreso
--    anterior dejando dicho por que, y sigue. Nada se borra y todo queda
--    en la bitacora: un menor sin salida registrada es un dato que hay
--    que conservar, no un estorbo que haya que barrer.
-- =====================================================================

BEGIN;

-- ⛔⛔ HALLAZGO GRAVE, encontrado por el banco al escribir estas pruebas.
--
--     Quedaban DOS `registrar_checkin` vivas: la de la migracion 0050 (5
--     argumentos) y la de la 0051 (6). La 0051 es la que anadio la
--     salvaguarda: que QUIEN ENTREGA sea acudiente vigente y que la sala
--     tenga dos adultos. Pero la API llama con CINCO argumentos:
--
--         SELECT * FROM rocakids.registrar_checkin($1,$2,$3,$4,$5)
--
--     ...y eso resuelve a la version VIEJA. Es decir: el endurecimiento de
--     la salvaguarda de menores estaba escrito, probado por el banco
--     llamando a la funcion de 6 argumentos, y NO LLEGABA por la API.
--     Cualquiera podia entregar a un niño por la aplicacion sin figurar
--     como acudiente, y una sala con un solo adulto recibia sin decir nada.
--
--     Una funcion sobrecargada que nadie tumbo es una puerta trasera
--     silenciosa: las pruebas apuntaban a una puerta y el producto entraba
--     por la otra. Aqui se tumba la vieja, y ademas la llamada de cuatro
--     argumentos deja de ser ambigua.
DROP FUNCTION IF EXISTS rocakids.registrar_checkin(uuid,uuid,uuid,uuid,uuid);

-- ── Tres estados, no dos ─────────────────────────────────────────────
--
-- `checkin_salida_coherente` exigia que un ingreso cerrado tuviera SIEMPRE
-- `retirado_por` y `autorizado_por`. Es correcto para una entrega y es
-- imposible para un ingreso que se quedo abierto: ahi no hubo nadie que
-- se llevara al niño, y poner un nombre cualquiera para cerrar la fila
-- seria falsificar la ficha de un menor.
--
-- Asi que el estado se hace EXPLICITO. Un ingreso esta en uno de tres:
--   · abierto            · entregado (con quien y quien autorizo)
--   · cerrado por el sistema (sin nadie, y diciendolo)
ALTER TABLE rocakids.checkins
  ADD COLUMN IF NOT EXISTS cierre_administrativo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN rocakids.checkins.cierre_administrativo IS
  'true = el ingreso se cerro sin entrega: nadie registro la salida. NO es una entrega.';

ALTER TABLE rocakids.checkins DROP CONSTRAINT IF EXISTS checkin_salida_coherente;
ALTER TABLE rocakids.checkins ADD CONSTRAINT checkin_salida_coherente CHECK (
     (salida_en IS NULL     AND retirado_por IS NULL     AND autorizado_por IS NULL     AND NOT cierre_administrativo)
  OR (salida_en IS NOT NULL AND retirado_por IS NOT NULL AND autorizado_por IS NOT NULL AND NOT cierre_administrativo)
  OR (salida_en IS NOT NULL AND retirado_por IS NULL     AND autorizado_por IS NULL     AND     cierre_administrativo)
);

-- ── El cierre administrativo NO es una entrega ───────────────────────
--
-- `tg_salida_solo_por_funcion` impide poner `salida_en` fuera de
-- `entregar_menor()`, y hace muy bien: un menor no queda marcado como
-- entregado sin que alguien verificara el codigo y al acudiente.
--
-- Pero cerrar un ingreso que se quedo abierto NO es entregar a nadie: es
-- reconocer por escrito que la salida nunca se registro. Son dos cosas
-- distintas y el sistema tiene que poder decir cual fue. Se abre una
-- segunda puerta, explicita, que:
--   · solo se abre dentro de `registrar_checkin` (bandera de transaccion),
--   · obliga a dejar dicho en `observacion_salida` que fue administrativo,
--   · y queda en la bitacora con quien lo hizo.
CREATE OR REPLACE FUNCTION rocakids.tg_salida_solo_por_funcion()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.salida_en IS NULL AND NEW.salida_en IS NOT NULL THEN
    IF COALESCE(current_setting('app.entrega_verificada', true),'') = 'si' THEN
      RETURN NEW;   -- entrega de verdad, con codigo y acudiente verificados
    END IF;
    IF COALESCE(current_setting('app.cierre_administrativo', true),'') = 'si' THEN
      -- Cierre administrativo: tiene que DECIRLO en la ficha, no solo en
      -- la bitacora. Quien lea este ingreso dentro de un año tiene que
      -- ver que al menor no se le registro la salida.
      IF NEW.observacion_salida IS NULL
         OR NEW.observacion_salida NOT ILIKE '%sistema%' THEN
        RAISE EXCEPTION 'Un cierre administrativo tiene que quedar explicado en observacion_salida'
          USING ERRCODE = 'check_violation';
      END IF;
      IF NEW.retirado_por IS NOT NULL THEN
        RAISE EXCEPTION 'Un cierre administrativo NO puede decir que alguien retiro al menor'
          USING ERRCODE = 'check_violation';
      END IF;
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'La salida de un menor solo puede registrarse con rocakids.entregar_menor()'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION rocakids.registrar_checkin(
  p_menor uuid, p_sala uuid, p_entregado_por uuid, p_recibido_por uuid,
  p_servicio uuid DEFAULT NULL, p_anulacion_dos_adultos text DEFAULT NULL)
RETURNS TABLE(checkin_id uuid, codigo text, repetido boolean, aviso text)
LANGUAGE plpgsql AS $$
DECLARE
  v_llave text := plataforma.llave_n4();
  v_sede uuid; v_existente uuid; v_codigo text; v_id uuid;
  v_edad int; v_min smallint; v_max smallint; v_sala_nombre text; v_adultos int;
  v_aviso text;
  v_abierto record; v_sala_previa text;
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
  IF NOT EXISTS (SELECT 1 FROM nucleo.personas WHERE id = p_menor) THEN
    RAISE EXCEPTION 'No se encuentra a ese menor en su alcance' USING ERRCODE = 'no_data_found';
  END IF;

  -- ⛔ QUIEN ENTREGA tiene que ser acudiente vigente.
  IF NOT EXISTS (
    SELECT 1 FROM nucleo.acudientes a
    WHERE a.menor_id = p_menor AND a.acudiente_id = p_entregado_por
      AND a.vigente_desde <= CURRENT_DATE
      AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)
  ) THEN
    RAISE EXCEPTION 'Quien entrega al menor no figura como acudiente vigente'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*) INTO v_adultos FROM rocakids.servidores_sala d
  WHERE d.sala_id = p_sala AND d.fecha = CURRENT_DATE AND d.salio_en IS NULL;

  IF v_adultos < 2 THEN
    IF p_anulacion_dos_adultos IS NULL OR length(trim(p_anulacion_dos_adultos)) < 10 THEN
      RAISE EXCEPTION
        'La sala «%» tiene % adulto(s) y la regla exige dos. Para recibir igual hay que escribir el motivo, y queda registrado.',
        v_sala_nombre, v_adultos USING ERRCODE = 'check_violation';
    END IF;
    v_aviso := 'Recibido con '||v_adultos||' adulto(s) en la sala. Motivo: '||p_anulacion_dos_adultos;
    INSERT INTO plataforma.bitacora_mantenimiento (tarea, objeto, detalle)
    VALUES ('anulacion_dos_adultos', p_sala::text,
            jsonb_build_object('adultos', v_adultos, 'motivo', p_anulacion_dos_adultos,
                               'menor', p_menor, 'quien', plataforma.ctx_persona_id()));
  END IF;

  -- ⭐ IDEMPOTENCIA: mismo menor, MISMA sala, mismo dia y todavia dentro.
  SELECT id INTO v_existente FROM rocakids.checkins
  WHERE menor_id = p_menor AND sala_id = p_sala
    AND ingreso_en::date = CURRENT_DATE AND salida_en IS NULL;
  IF v_existente IS NOT NULL THEN
    RETURN QUERY SELECT v_existente, NULL::text, true,
      'Ese menor ya estaba registrado hoy en esa sala. Se conserva el ingreso y el codigo original.'::text;
    RETURN;
  END IF;

  -- ⭐⭐ LO NUEVO. Queda un ingreso ABIERTO en OTRA sala (o de otro dia).
  --     Antes esto llegaba al INSERT y chocaba con `checkin_abierto_uq`
  --     con un 23505 en crudo, en la pantalla, un domingo a las nueve.
  SELECT c.id, c.sala_id, c.ingreso_en INTO v_abierto
  FROM rocakids.checkins c
  WHERE c.menor_id = p_menor AND c.salida_en IS NULL
  ORDER BY c.ingreso_en DESC LIMIT 1;

  IF v_abierto.id IS NOT NULL THEN
    SELECT nombre INTO v_sala_previa FROM rocakids.salas WHERE id = v_abierto.sala_id;
    -- Bandera de transaccion: se apaga sola al terminar. No es una entrega.
    PERFORM set_config('app.cierre_administrativo','si',true);

    IF v_abierto.ingreso_en::date < CURRENT_DATE THEN
      -- Se quedo abierto de otro dia: nadie registro la salida. Se cierra
      -- al final de AQUEL dia (no ahora: decir que el niño estuvo una
      -- semana en la sala seria mentir en la bitacora) y queda el apunte.
      UPDATE rocakids.checkins
         SET salida_en = v_abierto.ingreso_en::date + time '23:59',
             cierre_administrativo = true,
             observacion_salida = COALESCE(observacion_salida||' · ','')
               ||'Cerrado por el sistema al registrar un ingreso nuevo el '
               ||to_char(CURRENT_DATE,'YYYY-MM-DD')||'. La salida no se registro ese dia.'
       WHERE id = v_abierto.id;
      v_aviso := COALESCE(v_aviso||' ','')
        ||'Atencion: quedaba un ingreso sin salida del '
        ||to_char(v_abierto.ingreso_en,'YYYY-MM-DD')||' en la sala «'
        ||COALESCE(v_sala_previa,'?')||'». Se cerro para poder registrar este.';
    ELSE
      -- Mismo dia, otra sala: es un cambio de sala, que es normal.
      UPDATE rocakids.checkins
         SET salida_en = now(),
             cierre_administrativo = true,
             observacion_salida = COALESCE(observacion_salida||' · ','')
               ||'Cerrado por el sistema: cambio a la sala «'||v_sala_nombre||'»'
       WHERE id = v_abierto.id;
      v_aviso := COALESCE(v_aviso||' ','')
        ||'Cambio de sala: venia de «'||COALESCE(v_sala_previa,'?')||'».';
    END IF;

    PERFORM set_config('app.cierre_administrativo','',true);

    INSERT INTO plataforma.bitacora_mantenimiento (tarea, objeto, detalle)
    VALUES ('checkin_abierto_cerrado', v_abierto.id::text,
            jsonb_build_object('menor', p_menor,
                               'sala_previa', v_abierto.sala_id,
                               'sala_nueva', p_sala,
                               'ingreso_previo', v_abierto.ingreso_en,
                               'mismo_dia', v_abierto.ingreso_en::date = CURRENT_DATE,
                               'quien', plataforma.ctx_persona_id()));
  END IF;

  SELECT extract(year from age(fecha_nacimiento))::int INTO v_edad
  FROM nucleo.personas WHERE id = p_menor;
  IF v_edad IS NOT NULL AND (v_edad < v_min OR v_edad > v_max) THEN
    RAISE EXCEPTION 'La sala «%» es para % a % anos y el menor tiene %',
      v_sala_nombre, v_min, v_max, v_edad USING ERRCODE = 'check_violation';
  END IF;

  v_codigo := rocakids.codigo_de_entrega();

  INSERT INTO rocakids.checkins
    (menor_id, sala_id, servicio_id, sede_id, entregado_por, recibido_por, codigo_cifrado)
  VALUES (p_menor, p_sala, p_servicio, v_sede, p_entregado_por, p_recibido_por,
          pgp_sym_encrypt(v_codigo, v_llave))
  RETURNING id INTO v_id;

  PERFORM crm.anotar_hecho(p_menor, v_sede, now(), 'CHECKIN_ROCAKIDS', 'rocakids',
    'checkin', v_id::text, 'Ingreso a la sala '||v_sala_nombre, NULL);

  RETURN QUERY SELECT v_id, v_codigo, false, v_aviso;
END $$;

-- Para que alguien pueda MIRAR cuantas salidas se quedan sin registrar:
-- si son muchas, el problema no es el sistema, es el procedimiento de la
-- sala, y se arregla hablando con las maestras, no con codigo.
DROP VIEW IF EXISTS rocakids.v_salidas_sin_registrar;
CREATE VIEW rocakids.v_salidas_sin_registrar WITH (security_invoker = true) AS
SELECT s.nombre AS sala, c.sede_id,
       date_trunc('week', c.ingreso_en)::date AS semana,
       count(*) AS cuantas
  FROM rocakids.checkins c
  JOIN rocakids.salas s ON s.id = c.sala_id
 WHERE c.cierre_administrativo
   AND c.salida_en::date <> c.ingreso_en::date   -- el cambio de sala no cuenta
 GROUP BY 1,2,3
 ORDER BY 3 DESC, 4 DESC;
GRANT SELECT ON rocakids.v_salidas_sin_registrar TO casaroca_app;

COMMIT;
