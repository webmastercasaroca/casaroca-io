-- =====================================================================
-- Migración 0051 — LA SALVAGUARDA, CERRADA POR TODAS LAS PUERTAS
--
-- ⛔ LO QUE ENCONTRÓ LA AUDITORÍA INTERNA DEL 19 DE SEPTIEMBRE DE 2026, Y
--    EL PATRÓN QUE LAS UNE. Ocho hallazgos sobre menores, y NO son ocho
--    errores distintos: son la misma omisión ocho veces. Cada salvaguarda
--    se construyó sobre la puerta por la que se esperaba que entrara la
--    gente, y la base tiene más de una puerta.
--
--      · antecedentes sobre `asignaciones` pero NO sobre los equipos
--      · verificación en INSERT pero NO en UPDATE
--      · filtro de sede en `checkins` pero NO en `condiciones_medicas`
--      · la prohibición de exportar escrita sobre la tabla de PERMISOS
--        en vez de sobre el DATO
--      · el pestillo de la entrega en una variable que el escritor enciende
--
--    Esta migración las cierra todas, y añade las pruebas que faltaban.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · ⛔ LOS ANTECEDENTES SE SALTABAN POR LA HERENCIA DE EQUIPO
--
--     La migración 0049 puso el disparador sobre `identidad.asignaciones`
--     y ahí se quedó. Pero desde la 0044 un rol se le puede dar AL EQUIPO,
--     y ya existe sembrado el «Equipo RocaKids Global» con
--     DIRECTOR_ROCAKIDS de alcance organizacion. Meter a alguien en ese
--     equipo parece un trámite administrativo, no una decisión de
--     salvaguarda: una sola fila en `org.unidad_miembros` convertía a
--     cualquiera en director de niños de las 36 sedes, con acceso N4 a
--     fichas y datos de salud, sin un solo certificado.
--
--     Hay que vigilar las DOS direcciones: que un equipo reciba un rol de
--     menores (y entonces sus miembros deben ser aptos), y que alguien
--     entre a un equipo que YA tiene ese rol.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION identidad.falta_de_antecedentes(p_persona uuid)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT string_agg(t.nombre, ', ' ORDER BY t.nombre)
  FROM talento.tipos_antecedente t
  WHERE t.exigido_para_menores
    AND NOT EXISTS (SELECT 1 FROM talento.antecedentes a
                    WHERE a.persona_id = p_persona AND a.tipo = t.codigo
                      AND a.resultado = 'apto' AND a.vence_en >= CURRENT_DATE);
$$;

-- 1.a · Un EQUIPO no recibe un rol de menores si alguno de sus miembros
--       vigentes no está en regla. El rol se hereda en bloque, así que la
--       comprobación tiene que ser en bloque.
CREATE OR REPLACE FUNCTION identidad.tg_unidad_rol_menores() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_motivo text; v_sin text;
BEGIN
  SELECT motivo INTO v_motivo FROM identidad.roles_con_menores WHERE rol = NEW.rol;
  IF v_motivo IS NULL THEN RETURN NEW; END IF;

  SELECT string_agg(p.primer_nombre||' '||p.primer_apellido, ', ') INTO v_sin
  FROM org.unidad_miembros m
  JOIN nucleo.personas p ON p.id = m.persona_id
  WHERE m.unidad_id = NEW.unidad_id AND m.hasta IS NULL AND m.revocado_en IS NULL
    AND NOT talento.apto_para_menores(m.persona_id);

  IF v_sin IS NOT NULL THEN
    RAISE EXCEPTION
      'No se le puede dar el rol % a este equipo: estas personas no tienen antecedentes vigentes: %. %',
      NEW.rol, v_sin, v_motivo USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_unidad_rol_menores
  BEFORE INSERT OR UPDATE ON identidad.asignaciones_unidad
  FOR EACH ROW EXECUTE FUNCTION identidad.tg_unidad_rol_menores();

-- 1.b · Y nadie entra a un equipo que ya tiene un rol de menores sin estar
--       en regla. Esta es la puerta por la que se coló la auditoría.
CREATE OR REPLACE FUNCTION org.tg_miembro_de_equipo_con_menores() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_rol text; v_motivo text; v_falta text;
BEGIN
  IF NEW.hasta IS NOT NULL OR NEW.revocado_en IS NOT NULL THEN RETURN NEW; END IF;

  SELECT rm.rol, rm.motivo INTO v_rol, v_motivo
  FROM identidad.asignaciones_unidad au
  JOIN identidad.roles_con_menores rm ON rm.rol = au.rol
  WHERE au.unidad_id = NEW.unidad_id
    AND au.revocada_en IS NULL
    AND (au.vigente_hasta IS NULL OR au.vigente_hasta >= CURRENT_DATE)
  LIMIT 1;

  IF v_rol IS NULL THEN RETURN NEW; END IF;

  IF NOT talento.apto_para_menores(NEW.persona_id) THEN
    v_falta := identidad.falta_de_antecedentes(NEW.persona_id);
    RAISE EXCEPTION
      'Entrar a este equipo otorga el rol % sobre menores. %. Falta o esta vencido: %',
      v_rol, v_motivo, COALESCE(v_falta, 'todo') USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_miembro_de_equipo_con_menores
  BEFORE INSERT OR UPDATE ON org.unidad_miembros
  FOR EACH ROW EXECUTE FUNCTION org.tg_miembro_de_equipo_con_menores();

-- ---------------------------------------------------------------------
-- 2 · ⛔ UN ANTECEDENTE VENCIDO NO REVOCABA NADA
--
--     El disparador era BEFORE INSERT OR UPDATE sobre la asignación: una
--     vez puesta la fila, nadie volvía a mirar. Al maestro se le vencía el
--     certificado de delitos sexuales y seguía entrando a la sala ocho
--     meses después. `v_antecedentes_por_vencer` avisa a 60 días, pero
--     AVISAR NO ES REVOCAR, y la 0049 no dejó a nadie a cargo de leer ese
--     aviso. El estado del antecedente y el estado del permiso eran dos
--     verdades separadas.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION talento.revocar_no_aptos()
RETURNS TABLE(persona_id uuid, persona text, que_se_revoco text)
LANGUAGE plpgsql AS $$
DECLARE r record; v_n int := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT a.persona_id
    FROM identidad.asignaciones a
    JOIN identidad.roles_con_menores rm ON rm.rol = a.rol
    WHERE a.revocada_en IS NULL
      AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)
      AND NOT talento.apto_para_menores(a.persona_id)
    UNION
    SELECT DISTINCT m.persona_id
    FROM org.unidad_miembros m
    JOIN identidad.asignaciones_unidad au ON au.unidad_id = m.unidad_id
    JOIN identidad.roles_con_menores rm ON rm.rol = au.rol
    WHERE m.hasta IS NULL AND m.revocado_en IS NULL AND au.revocada_en IS NULL
      AND NOT talento.apto_para_menores(m.persona_id)
  LOOP
    UPDATE identidad.asignaciones a
       SET revocada_en = now(),
           motivo_revocacion = 'Antecedentes de salvaguarda vencidos o incompletos: '||
                               COALESCE(identidad.falta_de_antecedentes(r.persona_id),'todos')
     WHERE a.persona_id = r.persona_id AND a.revocada_en IS NULL
       AND a.rol IN (SELECT rol FROM identidad.roles_con_menores);

    UPDATE org.unidad_miembros m
       SET revocado_en = now(), hasta = GREATEST(CURRENT_DATE, m.desde),
           motivo_salida = 'Antecedentes de salvaguarda vencidos o incompletos'
     WHERE m.persona_id = r.persona_id AND m.hasta IS NULL AND m.revocado_en IS NULL
       AND EXISTS (SELECT 1 FROM identidad.asignaciones_unidad au
                   JOIN identidad.roles_con_menores rm ON rm.rol = au.rol
                   WHERE au.unidad_id = m.unidad_id AND au.revocada_en IS NULL);

    -- Y sale de las salas donde estuviera sirviendo hoy.
    UPDATE rocakids.servidores_sala s
       SET salio_en = now()
     WHERE s.persona_id = r.persona_id AND s.fecha = CURRENT_DATE AND s.salio_en IS NULL;

    v_n := v_n + 1;
    RETURN QUERY
      SELECT r.persona_id,
             (SELECT p.primer_nombre||' '||p.primer_apellido FROM nucleo.personas p WHERE p.id = r.persona_id),
             'roles de menores revocados y salida de salas'::text;
  END LOOP;

  INSERT INTO plataforma.bitacora_mantenimiento (tarea, objeto, detalle)
  VALUES ('revocar_no_aptos', 'salvaguarda', jsonb_build_object('personas_revocadas', v_n));
END $$;

COMMENT ON FUNCTION talento.revocar_no_aptos IS
  'Corre a diario. Avisar no es revocar: esto es lo que cierra la brecha entre «se le vencio el certificado» y «ya no puede estar con ninos».';

-- ---------------------------------------------------------------------
-- 3 · ⛔ `trg_servidor_apto` ERA SOLO BEFORE INSERT
--     El registro de custodia («quien estaba con los ninos ese dia», la
--     primera pregunta de cualquier incidente) se podia REESCRIBIR con un
--     UPDATE, metiendo a una persona sin verificar despues del hecho.
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_servidor_apto ON rocakids.servidores_sala;
CREATE TRIGGER trg_servidor_apto
  BEFORE INSERT OR UPDATE ON rocakids.servidores_sala
  FOR EACH ROW EXECUTE FUNCTION rocakids.tg_servidor_apto();

-- Y la aplicación deja de poder reescribir quién estuvo: solo puede
-- cerrar la salida, por función.
REVOKE UPDATE ON rocakids.servidores_sala FROM casaroca_app;

CREATE OR REPLACE FUNCTION rocakids.salir_de_sala(p_sala uuid, p_persona uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE rocakids.servidores_sala
     SET salio_en = now()
   WHERE sala_id = p_sala AND persona_id = p_persona
     AND fecha = CURRENT_DATE AND salio_en IS NULL;
  RETURN FOUND;
END $$;
GRANT EXECUTE ON FUNCTION rocakids.salir_de_sala(uuid,uuid) TO casaroca_app;

-- ---------------------------------------------------------------------
-- 4 · ⛔ LOS DATOS DE SALUD SE LEÍAN ENTRE SEDES, Y SIN TESTIGO
--
--     `rocakids.condiciones_medicas` tenía política `ctx_nivel_max() >= 4`
--     y NADA MÁS: era la única tabla N4 de RocaKids sin filtro de sede.
--     Un maestro de Medellín leía el diagnóstico psiquiátrico y la
--     medicación de un niño de Barcelona al que nunca ha visto, y no
--     quedaba una sola línea de que lo hizo, pese a que la clasificación
--     la declara con mecanismo `rls_y_bitacora`.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS condiciones_sel ON rocakids.condiciones_medicas;
DROP POLICY IF EXISTS condiciones_ins ON rocakids.condiciones_medicas;
DROP POLICY IF EXISTS condiciones_upd ON rocakids.condiciones_medicas;

CREATE POLICY condiciones_sel ON rocakids.condiciones_medicas FOR SELECT
  USING (
    plataforma.ctx_nivel_max() >= 4
    AND EXISTS (SELECT 1 FROM nucleo.personas p
                WHERE p.id = rocakids.condiciones_medicas.menor_id
                  AND plataforma.sede_visible(p.sede_id))
  );
CREATE POLICY condiciones_ins ON rocakids.condiciones_medicas FOR INSERT
  WITH CHECK (
    plataforma.ctx_nivel_max() >= 4
    AND EXISTS (SELECT 1 FROM nucleo.personas p
                WHERE p.id = rocakids.condiciones_medicas.menor_id
                  AND plataforma.sede_visible(p.sede_id))
  );
CREATE POLICY condiciones_upd ON rocakids.condiciones_medicas FOR UPDATE
  USING (
    plataforma.ctx_nivel_max() >= 4
    AND EXISTS (SELECT 1 FROM nucleo.personas p
                WHERE p.id = rocakids.condiciones_medicas.menor_id
                  AND plataforma.sede_visible(p.sede_id))
  );

-- ⭐ Y la bitácora deja de ser una promesa del catálogo. La aplicación NO
--    lee la tabla: pide la ficha por función, y la función registra quién
--    miró, cuándo y cuántas filas. Una exportación es una lectura de
--    muchas filas, y eso es justo lo que `registrar_lectura` sabe contar.
REVOKE SELECT ON rocakids.condiciones_medicas FROM casaroca_app, casaroca_lectura;

CREATE OR REPLACE FUNCTION rocakids.condiciones_de(p_menor uuid, p_motivo text DEFAULT 'consulta de sala')
RETURNS TABLE(id uuid, tipo text, descripcion text, severidad text, registrado_en timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_n int; v_sede uuid;
BEGIN
  -- ⛔ SECURITY DEFINER salta la seguridad por fila, así que el alcance se
  --    comprueba AQUÍ, a mano y de forma explícita. Es la única manera
  --    honesta de usar SECURITY DEFINER.
  SELECT p.sede_id INTO v_sede FROM nucleo.personas p WHERE p.id = p_menor;
  IF v_sede IS NULL OR NOT plataforma.sede_visible(v_sede) THEN
    RAISE EXCEPTION 'Ese menor no esta en su alcance' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF plataforma.ctx_nivel_max() < 4 THEN
    RAISE EXCEPTION 'Los datos de salud de un menor exigen acceso N4' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT count(*) INTO v_n FROM rocakids.condiciones_medicas c WHERE c.menor_id = p_menor;
  PERFORM plataforma.registrar_lectura('rocakids','condiciones_medicas', p_menor::text, 4::smallint, p_motivo, v_n);

  RETURN QUERY
    SELECT c.id, c.tipo::text, c.descripcion, c.severidad::text, c.registrado_en
    FROM rocakids.condiciones_medicas c WHERE c.menor_id = p_menor;
END $$;
GRANT EXECUTE ON FUNCTION rocakids.condiciones_de(uuid,text) TO casaroca_app;

-- ---------------------------------------------------------------------
-- 5 · ⛔ «NADIE EXPORTA MENORES» VIGILABA LA TABLA DE PERMISOS
--
--     El disparador de la 0035 vive sobre `sistema.matriz_permisos`:
--     gobierna filas de la matriz, NO el camino del dato. Un COPY sacaba
--     la lista entera con nombre, edad, condición médica y acudientes, sin
--     dejar rastro. La migración está escrita con convicción («aquí deja
--     de ser un acuerdo y pasa a ser una imposibilidad») y lo que consiguió
--     fue impedir que alguien escribiera la palabra «exportar» en una tabla.
--
--     Un SELECT no se puede interceptar con un disparador en PostgreSQL.
--     El control real es OTRO: que la aplicación no pueda leer la tabla y
--     tenga que pasar por una función que cuenta y registra. Aquí está.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rocakids.roster_de_sala(p_sala uuid, p_motivo text DEFAULT 'censo de sala')
RETURNS TABLE(menor_id uuid, menor text, edad int, esta_dentro boolean, tiene_condiciones boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_sede uuid; v_n int;
BEGIN
  SELECT s.sede_id INTO v_sede FROM rocakids.salas s WHERE s.id = p_sala;
  IF v_sede IS NULL OR NOT plataforma.sede_visible(v_sede) THEN
    RAISE EXCEPTION 'Esa sala no esta en su alcance' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF plataforma.ctx_nivel_max() < 4 THEN
    RAISE EXCEPTION 'El censo de una sala de ninos exige acceso N4' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT count(*) INTO v_n FROM rocakids.v_roster_sala r WHERE r.sala_id = p_sala;
  PERFORM plataforma.registrar_lectura('rocakids','roster_sala', p_sala::text, 4::smallint, p_motivo, v_n);

  RETURN QUERY
    SELECT r.menor_id, r.menor, r.edad, r.esta_dentro, (r.condiciones > 0)
    FROM rocakids.v_roster_sala r WHERE r.sala_id = p_sala ORDER BY r.menor;
END $$;
GRANT EXECUTE ON FUNCTION rocakids.roster_de_sala(uuid,text) TO casaroca_app;

-- ⛔ Y la verdad sobre la 0035, escrita donde alguien la lea.
COMMENT ON TABLE rocakids.checkins IS
  'Ingresos a sala. ⛔ El disparador de la migracion 0035 vigila sistema.matriz_permisos, NO el dato: impide CONCEDER un permiso de exportacion, no impide un SELECT. El control real del dato son los permisos de tabla y las funciones que registran la lectura con su numero de filas (migracion 0051).';

-- ---------------------------------------------------------------------
-- 6 · ⛔ EL PESTILLO DE LA ENTREGA ERA UNA VARIABLE DE SESIÓN
--
--     `app.entrega_verificada` lo encendía la misma sesión que escribía.
--     Con UPDATE directo sobre `checkins` se marcaba a un niño como
--     entregado a un desconocido: sin código, sin ser acudiente, y con
--     `intentos_entrega` guardando solo el intento FALLIDO. El lunes, a la
--     pregunta de quién se llevó a la niña, el sistema respondía con un
--     nombre que nadie verificó y con cara de que todo estuvo bien.
-- ---------------------------------------------------------------------
REVOKE UPDATE ON rocakids.checkins FROM casaroca_app;

-- La función pasa a ser la ÚNICA puerta, y corre como dueña.
ALTER FUNCTION rocakids.entregar_menor(uuid, uuid, text, uuid)
  SECURITY DEFINER SET search_path = pg_catalog, public;
GRANT EXECUTE ON FUNCTION rocakids.entregar_menor(uuid,uuid,text,uuid) TO casaroca_app;

-- ---------------------------------------------------------------------
-- 7 · ⛔ EL CÓDIGO ERA ADIVINABLE Y SIN TOPE DE INTENTOS
--     `random()` es sembrable (`setseed(0.42)` reproduce el código) y no
--     criptográfico. Y 40 intentos seguidos con código equivocado no
--     bloqueaban nada: el código dejaba de ser un segundo factor y pasaba
--     a ser un adorno.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rocakids.codigo_de_entrega() RETURNS text
LANGUAGE sql VOLATILE AS $$
  -- Alfabeto sin I, O, 0 ni 1: alguien lo va a leer de un papel a media luz.
  SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
                           (get_byte(b, i) % 32) + 1, 1), '')
  FROM (SELECT gen_random_bytes(4) AS b) g, generate_series(0,3) AS i;
$$;

CREATE OR REPLACE FUNCTION rocakids.intentos_fallidos_recientes(p_checkin uuid)
RETURNS int LANGUAGE sql STABLE AS $$
  SELECT count(*)::int FROM rocakids.intentos_entrega
  WHERE checkin_id = p_checkin
    AND resultado IN ('codigo_incorrecto','no_autorizado')
    AND ocurrido_en > now() - interval '30 minutes';
$$;

-- ---------------------------------------------------------------------
-- 8 · ⛔ LA REGLA DE DOS ADULTOS NO IMPEDÍA NADA
--     `registrar_checkin` no la consultaba: la sala con cero adultos
--     aceptaba niños sin pestañear.
--
--     ⭐ Y la excepción es deliberada: el domingo real a veces empieza con
--     un solo maestro mientras llega el segundo. Se permite, pero EXIGE
--     decirlo por escrito y queda registrado. Una regla que no admite la
--     realidad se salta en silencio; una que la admite y la registra, no.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rocakids.registrar_checkin(
  p_menor uuid, p_sala uuid, p_entregado_por uuid, p_recibido_por uuid,
  p_servicio uuid DEFAULT NULL, p_anulacion_dos_adultos text DEFAULT NULL
) RETURNS TABLE(checkin_id uuid, codigo text, repetido boolean, aviso text)
LANGUAGE plpgsql AS $$
DECLARE
  v_llave text := plataforma.llave_n4();
  v_sede uuid; v_existente uuid; v_codigo text; v_id uuid;
  v_edad int; v_min smallint; v_max smallint; v_sala_nombre text; v_adultos int;
  v_aviso text;
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

  -- ⛔ QUIEN ENTREGA tiene que ser acudiente vigente. Antes solo se exigia
  --    que el menor TUVIERA acudiente, no que fuera ESTE.
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

  SELECT id INTO v_existente FROM rocakids.checkins
  WHERE menor_id = p_menor AND sala_id = p_sala
    AND ingreso_en::date = CURRENT_DATE AND salida_en IS NULL;
  IF v_existente IS NOT NULL THEN
    RETURN QUERY SELECT v_existente, NULL::text, true,
      'Ese menor ya estaba registrado hoy en esa sala. Se conserva el ingreso y el codigo original.'::text;
    RETURN;
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

GRANT EXECUTE ON FUNCTION rocakids.registrar_checkin(uuid,uuid,uuid,uuid,uuid,text) TO casaroca_app;

-- ---------------------------------------------------------------------
-- 9 · La lista de quien puede RETIRAR deja de incluir a quien no puede
--     La vista decia ofrecer «la lista de quienes estan autorizados» y
--     listaba tambien a los que no. Falla seguro, pero invita al error.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW rocakids.v_puede_retirar
WITH (security_invoker = true) AS
SELECT menor_id, acudiente_id, acudiente, parentesco
FROM rocakids.v_acudientes_del_menor
WHERE autoriza_retiro;

GRANT SELECT ON rocakids.v_puede_retirar TO casaroca_app;

-- ---------------------------------------------------------------------
-- 10 · ⛔ RETENCIÓN: la ficha de un niño de 4 años, con su dirección y su
--      diagnóstico, se conservaba indefinidamente y seguía en N4 el día
--      que cumplía 18. La Ley 1581 tiene principio de temporalidad y no
--      es opcional.
-- ---------------------------------------------------------------------
CREATE TABLE plataforma.politicas_retencion (
  esquema      text NOT NULL,
  tabla        text NOT NULL,
  meses        int  NOT NULL CHECK (meses > 0),
  accion       text NOT NULL CHECK (accion IN ('anonimizar','archivar','purgar','conservar')),
  base_legal   text NOT NULL,
  decidido_por text NOT NULL,
  decidido_en  date NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (esquema, tabla)
);

INSERT INTO plataforma.politicas_retencion (esquema, tabla, meses, accion, base_legal, decidido_por) VALUES
 ('rocakids','checkins',            24,  'purgar',     'Operativo: pasados dos anos no sirve para nada y son datos de menores.', 'Mesa tecnica 100p'),
 ('rocakids','condiciones_medicas', 12,  'purgar',     'Dato de salud de un menor: se conserva mientras sirve para cuidarlo.', 'Mesa tecnica 100p'),
 ('rocakids','intentos_entrega',    60,  'conservar',  'Evidencia de salvaguarda: se conserva cinco anos.', 'Mesa tecnica 100p'),
 ('consejeria','notas',             120, 'conservar',  'Historia clinica pastoral: se conserva diez anos.', 'Mesa tecnica 100p'),
 ('aportes','aportes',              120, 'conservar',  'Obligacion contable y tributaria: diez anos.', 'Mesa tecnica 100p'),
 ('asistencia','entradas',          36,  'anonimizar', 'Pasados tres anos solo interesa el agregado.', 'Mesa tecnica 100p'),
 ('plataforma','auditoria',         60,  'conservar',  'Evidencia de auditoria: cinco anos.', 'Mesa tecnica 100p'),
 ('plataforma','bitacora_lectura',  36,  'conservar',  'Evidencia de quien leyo que: tres anos.', 'Mesa tecnica 100p');

-- Al cumplir 18, los datos que existen POR ser menor dejan de tener razon de ser.
CREATE OR REPLACE FUNCTION rocakids.egresar_mayores_de_edad()
RETURNS TABLE(persona_id uuid, persona text, que_paso text)
LANGUAGE plpgsql AS $$
DECLARE r record; v_n int := 0;
BEGIN
  FOR r IN
    SELECT p.id, p.primer_nombre||' '||p.primer_apellido AS nombre
    FROM nucleo.personas p
    WHERE p.fecha_nacimiento IS NOT NULL
      AND NOT nucleo.es_menor(p.fecha_nacimiento)
      AND (EXISTS (SELECT 1 FROM rocakids.inscripciones i WHERE i.menor_id = p.id AND i.hasta IS NULL)
        OR EXISTS (SELECT 1 FROM rocakids.condiciones_medicas c WHERE c.menor_id = p.id))
  LOOP
    UPDATE rocakids.inscripciones SET hasta = CURRENT_DATE
     WHERE menor_id = r.id AND hasta IS NULL;
    DELETE FROM rocakids.condiciones_medicas WHERE menor_id = r.id;
    v_n := v_n + 1;
    RETURN QUERY SELECT r.id, r.nombre, 'inscripciones cerradas y condiciones medicas de menor purgadas'::text;
  END LOOP;

  INSERT INTO plataforma.bitacora_mantenimiento (tarea, objeto, detalle)
  VALUES ('egresar_mayores', 'rocakids', jsonb_build_object('personas', v_n));
END $$;

COMMENT ON FUNCTION rocakids.egresar_mayores_de_edad IS
  'Al cumplir 18, los datos que existian POR ser menor dejan de tener razon de ser. Principio de temporalidad de la Ley 1581, hecho tarea.';

SELECT plataforma.publicar_tabla('plataforma.politicas_retencion'::regclass, 'catalogo_red',
  'Cuanto se conserva cada cosa y con que base legal. Es gobierno del dato, publico a proposito.',
  'Mesa tecnica 100p', false);
