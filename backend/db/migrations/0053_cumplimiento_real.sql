-- =====================================================================
-- Migración 0053 — EL HABEAS DATA DEJA DE SER UNA TABLA Y PASA A SER UN
--                  CAMINO DE EJECUCIÓN
--
-- ⛔ EL VEREDICTO DEL AUDITOR DE CUMPLIMIENTO, TEXTUAL: «el modelo está
--    diseñado bien y ejecutado en ninguna parte». Existían la tabla de
--    consentimientos, la de finalidades, la de peticiones del titular, la
--    bitácora de lectura y la clasificación por columna. NINGUNA estaba
--    conectada a un camino de ejecución:
--
--      · `puede_contactar` con CERO invocaciones en toda la base y la API
--      · `registrar_lectura` con CERO invocaciones desde la API
--      · CERO funciones de supresión: la petición se radica y ahí muere
--      · la CONVICCIÓN RELIGIOSA, que es el dato sensible por excelencia
--        de una iglesia (Ley 1581 art. 5), clasificada en N1 y N2
--      · revocar el consentimiento exigía 30 actos distintos
--
--    Y un fallo funcional que nadie había visto: CONSEJERÍA ESTÁ ROTA.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · ⛔ CONSEJERÍA ERA ILEGIBLE: RECURSIÓN INFINITA EN SU PROPIA POLÍTICA
--
--    `consejeria.caso_visible(id)` ES la política SELECT de
--    `consejeria.casos` y por dentro hace `SELECT ... FROM consejeria.casos`,
--    que vuelve a disparar la misma política. Leer la tabla con el rol de
--    la aplicación revienta con «stack depth limit exceeded».
--
--    Significa que el módulo con la confidencialidad más estricta del
--    sistema NUNCA se ha ejercido a través del rol real. Toda afirmación
--    de cumplimiento sobre consejería estaba sin verificar.
--
--    La solución ya estaba escrita en la migración 0045 para el mismo
--    problema en `identidad.sedes_de`: SECURITY DEFINER, porque la función
--    se llama DESDE la política.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION consejeria.caso_visible(p_caso_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT
    (plataforma.ctx_nivel_max() >= 3
     AND EXISTS (SELECT 1 FROM consejeria.asignaciones a
                  WHERE a.caso_id = p_caso_id
                    AND a.consejero_id = plataforma.ctx_persona_id()
                    AND a.hasta IS NULL))
    OR
    EXISTS (SELECT 1 FROM consejeria.casos c
             WHERE c.id = p_caso_id
               AND identidad.es_pastor_de(plataforma.ctx_persona_id(), c.sede_id));
$$;
COMMENT ON FUNCTION consejeria.caso_visible IS
  'SECURITY DEFINER a proposito: se llama DESDE la politica de consejeria.casos. Sin esto, leer la tabla entra en recursion infinita y el modulo entero es ilegible.';

-- ---------------------------------------------------------------------
-- 2 · ⛔ LA CONVICCIÓN RELIGIOSA ES DATO SENSIBLE POR LEY
--
--    Ley 1581 art. 5: son sensibles los datos «que revelen... convicciones
--    políticas, RELIGIOSAS o filosóficas». El sistema las tenía en N1 y N2,
--    y `nivel_compromiso` y `es_ministro` estaban en un nivel cuya propia
--    descripción dice «sin dato personal», siendo columnas por persona.
--    `es_cristiano` admite el valor «no»: se guardaba también quién NO es
--    cristiano, que es exactamente lo que el artículo protege.
--
--    La excepción del art. 6 lit. d) para entidades religiosas libera de
--    pedir autorización adicional para sus miembros. NO degrada el dato a
--    ordinario, no levanta el deber de seguridad reforzada, no cubre al
--    visitante que llenó el formulario público, y prohíbe compartirlo.
-- ---------------------------------------------------------------------
UPDATE plataforma.clasificacion_columna SET nivel = 3
 WHERE esquema='nucleo' AND tabla='personas'
   AND columna IN ('es_cristiano','fecha_conversion','ha_sido_bautizado','fecha_bautismo','iglesia_anterior');
UPDATE plataforma.clasificacion_columna SET nivel = 2
 WHERE esquema='nucleo' AND tabla='personas' AND columna IN ('nivel_compromiso','es_ministro');

-- Y lo que estaba sin clasificar, incluido el documento de identidad y la
-- derivación de la contraseña de todo el sistema.
INSERT INTO plataforma.clasificacion_columna (esquema, tabla, columna, nivel, finalidad, mecanismo) VALUES
 ('nucleo','personas','numero_documento', 2, 'Identificacion legal (Ley 1581)', 'rls_y_bitacora'),
 ('nucleo','personas','tipo_documento',   1, 'Identificacion legal', 'rls_y_bitacora'),
 ('nucleo','personas','direccion',        2, 'Contacto y visita pastoral', 'rls_y_bitacora'),
 ('nucleo','personas','telefono_fijo',    2, 'Contacto', 'rls_y_bitacora'),
 ('nucleo','personas','segundo_nombre',   2, 'Identificacion', 'rls_y_bitacora'),
 ('nucleo','personas','segundo_apellido', 2, 'Identificacion', 'rls_y_bitacora'),
 ('nucleo','personas','source_payload',   3, 'Linaje de migracion: puede traer cualquier cosa del sistema de origen', 'rls_y_bitacora'),
 ('identidad','cuentas','clave_hash',     4, 'Credencial de acceso', 'cifrado_columna'),
 ('identidad','cuentas','segundo_factor_secreto', 4, 'Segundo factor', 'cifrado_columna'),
 ('crm','nuevos_registros','es_cristiano', 3, 'Conviccion religiosa de quien AUN NO es miembro: la excepcion del art. 6 lit. d) no lo cubre', 'rls_y_bitacora'),
 ('crm','nuevos_registros','telefono',     2, 'Contacto', 'rls_y_bitacora'),
 ('crm','nuevos_registros','email',        2, 'Contacto', 'rls_y_bitacora')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- 3 · ⛔ REVOCAR EXIGÍA 30 ACTOS. AHORA ES UNO.
--
--    `puede_contactar` exige coincidencia exacta de canal Y finalidad, así
--    que «no me contacten más» necesitaba 6 canales × 5 finalidades.
--    El checklist B5.03 lo dice literal: «efectiva en TODOS los canales,
--    no solo en el que se revocó».
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION plataforma.revocar_consentimiento(
  p_persona uuid, p_canal plataforma.canal_contacto DEFAULT NULL,
  p_finalidad text DEFAULT NULL, p_evidencia text DEFAULT 'solicitud del titular'
) RETURNS int LANGUAGE plpgsql AS $$
DECLARE v_sede uuid; v_n int := 0;
BEGIN
  SELECT sede_id INTO v_sede FROM nucleo.personas WHERE id = p_persona;
  IF v_sede IS NULL THEN
    RAISE EXCEPTION 'No se encuentra a esa persona' USING ERRCODE='no_data_found';
  END IF;

  INSERT INTO plataforma.consentimientos
    (persona_id, sede_id, finalidad, canal, acto, ocurrido_en, evidencia_tipo, evidencia_ref)
  SELECT p_persona, v_sede, f.codigo, c.canal, 'revocado', now(), 'verbal_registrado', p_evidencia
  FROM plataforma.finalidades f
  CROSS JOIN (SELECT unnest(enum_range(NULL::plataforma.canal_contacto)) AS canal) c
  WHERE (p_finalidad IS NULL OR f.codigo = p_finalidad)
    AND (p_canal IS NULL OR c.canal = p_canal)
    -- solo donde hoy esta permitido: revocar lo ya revocado es ruido
    AND plataforma.puede_contactar(p_persona, c.canal, f.codigo);
  GET DIAGNOSTICS v_n = ROW_COUNT;

  -- ⭐ Y lo ya encolado se descarta. Entre encolar y enviar pasan dias, y
  --    el auditor reprodujo el caso: se revocaba y el correo salia igual.
  UPDATE plataforma.notificaciones
     SET estado = 'descartada',
         ultimo_error = 'Consentimiento revocado por el titular antes del envio'
   WHERE persona_id = p_persona AND estado = 'pendiente'
     AND (p_canal IS NULL OR canal = p_canal);

  RETURN v_n;
END $$;

COMMENT ON FUNCTION plataforma.revocar_consentimiento IS
  'Sin canal ni finalidad, revoca TODO. Y descarta lo que ya estaba en la cola: una revocacion que no alcanza lo encolado no es una revocacion.';

-- ---------------------------------------------------------------------
-- 4 · ⛔ EL CONSENTIMIENTO SE COMPRUEBA AL ENCOLAR **Y** AL ENVIAR
--    Dos comprobaciones, no una: entre encolar y enviar pasan dias.
-- ---------------------------------------------------------------------
ALTER TABLE plataforma.notificaciones ADD COLUMN IF NOT EXISTS finalidad text;

CREATE OR REPLACE FUNCTION plataforma.tg_notificacion_exige_consentimiento() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_fin text;
BEGIN
  -- Sin persona (avisos operativos a un correo funcional) no aplica.
  IF NEW.persona_id IS NULL THEN RETURN NEW; END IF;

  v_fin := COALESCE(NEW.finalidad, 'convocatoria');

  -- ⛔ «emergencia» no depende del consentimiento: interes vital del titular (Ley 1581 art. 10 lit. c).
  IF v_fin = 'emergencia' THEN RETURN NEW; END IF;

  IF NOT plataforma.puede_contactar(NEW.persona_id, NEW.canal, v_fin) THEN
    RAISE EXCEPTION
      'No hay consentimiento vigente de esa persona para % por %. Sin registro, no se contacta.',
      v_fin, NEW.canal USING ERRCODE = 'check_violation';
  END IF;

  -- Y a quien fue suprimido o fallecio no se le escribe.
  IF EXISTS (SELECT 1 FROM nucleo.personas p
             WHERE p.id = NEW.persona_id
               AND (p.eliminado_en IS NOT NULL OR p.estado::text = 'fallecida')) THEN
    RAISE EXCEPTION 'Esa persona esta dada de baja o fallecida: no se le envian avisos'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_notificacion_exige_consentimiento ON plataforma.notificaciones;
CREATE TRIGGER trg_notificacion_exige_consentimiento
  BEFORE INSERT ON plataforma.notificaciones
  FOR EACH ROW EXECUTE FUNCTION plataforma.tg_notificacion_exige_consentimiento();

-- La segunda comprobación, al salir de la cola.
DROP FUNCTION IF EXISTS plataforma.tomar_notificaciones(integer);
CREATE OR REPLACE FUNCTION plataforma.tomar_notificaciones(p_limite integer DEFAULT 50)
RETURNS TABLE(id uuid, canal plataforma.canal_contacto, destinatario text,
              plantilla text, datos jsonb, persona_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  -- ⛔ Lo que perdio el consentimiento entre encolar y enviar se descarta
  --    AQUI, antes de entregarlo al trabajador.
  UPDATE plataforma.notificaciones n
     SET estado = 'descartada', ultimo_error = 'Consentimiento revocado antes del envio'
   WHERE n.estado = 'pendiente' AND n.persona_id IS NOT NULL
     AND COALESCE(n.finalidad,'convocatoria') <> 'emergencia'
     AND NOT plataforma.puede_contactar(n.persona_id, n.canal, COALESCE(n.finalidad,'convocatoria'));

  RETURN QUERY
  UPDATE plataforma.notificaciones n
     SET estado = 'enviando', intentos = n.intentos + 1
   WHERE n.id IN (SELECT x.id FROM plataforma.notificaciones x
                  WHERE x.estado = 'pendiente' ORDER BY x.creada_en LIMIT p_limite
                  FOR UPDATE SKIP LOCKED)
  RETURNING n.id, n.canal, n.destinatario, n.plantilla, n.datos, n.persona_id;
END $$;

-- ---------------------------------------------------------------------
-- 5 · ⛔ LA SUPRESIÓN EXISTE
--    Antes: se radicaba la petición y no había NADA que la ejecutara. El
--    borrado duro es un no-op silencioso (regla `personas_no_delete`) y el
--    lógico no anonimizaba nada: nombre, correo, teléfono y fecha de
--    conversión quedaban intactos, y se le podía seguir escribiendo.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION plataforma.ejecutar_supresion(
  p_peticion uuid, p_quien uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_persona uuid; v_tipo text; v_estado text; v_res jsonb := '{}'::jsonb; v_n int;
BEGIN
  SELECT titular_id, tipo, estado INTO v_persona, v_tipo, v_estado
  FROM plataforma.peticiones_titular WHERE id = p_peticion;

  IF v_persona IS NULL THEN
    RAISE EXCEPTION 'La peticion no existe o no esta ligada a una persona del sistema'
      USING ERRCODE='no_data_found';
  END IF;
  IF v_tipo <> 'supresion' THEN
    RAISE EXCEPTION 'Esa peticion es de tipo «%», no de supresion', v_tipo USING ERRCODE='check_violation';
  END IF;
  IF v_estado = 'atendida' THEN
    RAISE EXCEPTION 'Esa peticion ya fue atendida' USING ERRCODE='check_violation';
  END IF;

  -- 5.a · Lo que se BORRA: lo que existe solo por el vinculo pastoral.
  DELETE FROM crm.notas_privadas_nuevos WHERE nuevo_id IN
    (SELECT id FROM crm.nuevos_registros WHERE persona_id = v_persona);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_res := v_res || jsonb_build_object('notas_privadas_borradas', v_n);

  DELETE FROM consejeria.notas WHERE caso_id IN
    (SELECT id FROM consejeria.casos WHERE consultante_id = v_persona);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_res := v_res || jsonb_build_object('notas_consejeria_borradas', v_n);

  DELETE FROM rocakids.condiciones_medicas WHERE menor_id = v_persona;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_res := v_res || jsonb_build_object('condiciones_medicas_borradas', v_n);

  DELETE FROM nucleo.persona_atributos WHERE persona_id = v_persona;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_res := v_res || jsonb_build_object('casillas_borradas', v_n);

  -- 5.b · Lo que se ANONIMIZA: la persona deja de ser identificable y el
  --       identificador sobrevive como clave tecnica, porque de el cuelgan
  --       obligaciones contables que la ley EXIGE conservar.
  PERFORM set_config('app.traslado_en_curso','si',true);
  UPDATE nucleo.personas SET
      primer_nombre    = 'Titular',
      segundo_nombre   = NULL,
      primer_apellido  = 'suprimido',
      segundo_apellido = NULL,
      nombre_corto     = NULL,
      email_principal  = NULL, email_secundario = NULL,
      telefono_movil   = NULL, telefono_fijo = NULL, telefono_emergencia = NULL,
      numero_documento = NULL, tipo_documento = NULL,
      direccion        = NULL, foto_url = NULL,
      fecha_nacimiento = NULL,
      es_cristiano     = NULL, fecha_conversion = NULL, fecha_bautismo = NULL,
      ha_sido_bautizado = NULL, iglesia_anterior = NULL,
      source_payload   = NULL,
      estado           = 'inactiva',
      eliminado_en     = now()
   WHERE id = v_persona;
  PERFORM set_config('app.traslado_en_curso','no',true);
  v_res := v_res || jsonb_build_object('persona_anonimizada', true);

  -- 5.c · Lo que se CONSERVA, y por que. Se dice en la respuesta al
  --       titular, que es lo que exige el Decreto 1377 art. 22.
  SELECT count(*) INTO v_n FROM aportes.aportes WHERE persona_id = v_persona;
  v_res := v_res || jsonb_build_object(
    'aportes_conservados', v_n,
    'base_legal_conservacion',
      'Obligacion contable y tributaria: los soportes se conservan diez anos (Codigo de Comercio art. 28). Quedan desligados de la identidad.');

  -- 5.d · El consentimiento NO se borra: es la prueba legal del acto.
  v_res := v_res || jsonb_build_object('consentimientos_conservados',
    'Los registros de consentimiento y revocacion se conservan como prueba del acto (Ley 1581 art. 9).');

  -- 5.e · Se cortan los accesos y los envios.
  PERFORM plataforma.revocar_consentimiento(v_persona, NULL, NULL, 'supresion solicitada por el titular');
  PERFORM identidad.suspender_cuenta(v_persona, 'Supresion solicitada por el titular');

  UPDATE plataforma.peticiones_titular
     SET estado = 'atendida', respondida_en = now(),
         respuesta = 'Supresion ejecutada. '||v_res::text,
         responsable_id = COALESCE(responsable_id, p_quien)
   WHERE id = p_peticion;

  RETURN v_res;
END $$;

COMMENT ON FUNCTION plataforma.ejecutar_supresion IS
  'Borra lo que existe por el vinculo pastoral, anonimiza a la persona, y CONSERVA lo que la ley obliga a conservar diciendo por que. Devuelve el detalle para la respuesta al titular.';

-- ⛔ Y `puede_contactar` deja de decir que si sobre alguien dado de baja.
CREATE OR REPLACE FUNCTION plataforma.puede_contactar(
  p_persona_id uuid, p_canal plataforma.canal_contacto, p_finalidad text
) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT
    NOT EXISTS (SELECT 1 FROM nucleo.personas p
                WHERE p.id = p_persona_id
                  AND (p.eliminado_en IS NOT NULL OR p.estado::text IN ('fallecida','fusionada')))
    AND COALESCE((
      SELECT c.acto::text = 'otorgado'
      FROM plataforma.consentimientos c
      WHERE c.persona_id = p_persona_id AND c.canal = p_canal AND c.finalidad = p_finalidad
      -- ⛔ En un EMPATE de instante gana la REVOCACION. La version anterior
      --    ordenaba solo por fecha y, otorgando y revocando en el mismo
      --    milisegundo (que pasa cuando un formulario escribe varias filas
      --    de golpe), el desempate era arbitrario y podia ganar el permiso.
      --    Ante la duda, no se contacta.
      ORDER BY c.ocurrido_en DESC, c.registrado_en DESC, c.acto DESC
      LIMIT 1), false);
$$;

-- ---------------------------------------------------------------------
-- 6 · ⛔ ¿QUIÉN CONSIENTE POR UN MENOR?
--    La tabla no tenía columna de quién otorga, y aceptó un consentimiento
--    a nombre de un niño de 10 años con evidencia «el propio menor marcó
--    la casilla». Decreto 1377 art. 12: la otorga el representante legal.
-- ---------------------------------------------------------------------
ALTER TABLE plataforma.consentimientos
  ADD COLUMN IF NOT EXISTS otorgado_por uuid REFERENCES nucleo.personas(id),
  ADD COLUMN IF NOT EXISTS calidad text CHECK (calidad IN ('titular','representante_legal'));

CREATE OR REPLACE FUNCTION plataforma.tg_consentimiento_de_menor() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_fn date;
BEGIN
  SELECT fecha_nacimiento INTO v_fn FROM nucleo.personas WHERE id = NEW.persona_id;
  IF v_fn IS NULL OR NOT nucleo.es_menor(v_fn) THEN
    NEW.calidad := COALESCE(NEW.calidad, 'titular');
    RETURN NEW;
  END IF;

  -- Es menor: exige representante legal, y que sea acudiente vigente.
  IF NEW.otorgado_por IS NULL THEN
    RAISE EXCEPTION 'El consentimiento de un menor lo otorga su representante legal: falta otorgado_por'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM nucleo.acudientes a
                 WHERE a.menor_id = NEW.persona_id AND a.acudiente_id = NEW.otorgado_por
                   AND a.vigente_desde <= CURRENT_DATE
                   AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)) THEN
    RAISE EXCEPTION 'Quien otorga el consentimiento de este menor no es su acudiente vigente'
      USING ERRCODE = 'check_violation';
  END IF;
  NEW.calidad := 'representante_legal';
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_consentimiento_de_menor ON plataforma.consentimientos;
CREATE TRIGGER trg_consentimiento_de_menor
  BEFORE INSERT ON plataforma.consentimientos
  FOR EACH ROW EXECUTE FUNCTION plataforma.tg_consentimiento_de_menor();

-- Lo mismo para las autorizaciones de RocaKids: la base aceptaba una
-- autorizacion de fotografia firmada por quien no tiene la patria potestad.
CREATE OR REPLACE FUNCTION rocakids.tg_autorizacion_por_acudiente() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM nucleo.acudientes a
                 WHERE a.menor_id = NEW.menor_id AND a.acudiente_id = NEW.otorgada_por
                   AND a.vigente_desde <= CURRENT_DATE
                   AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)) THEN
    RAISE EXCEPTION 'Quien autoriza no es acudiente vigente de ese menor'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_autorizacion_por_acudiente ON rocakids.autorizaciones;
CREATE TRIGGER trg_autorizacion_por_acudiente
  BEFORE INSERT OR UPDATE ON rocakids.autorizaciones
  FOR EACH ROW EXECUTE FUNCTION rocakids.tg_autorizacion_por_acudiente();

-- ---------------------------------------------------------------------
-- 7 · ⛔ AL CUMPLIR 18 NO PASABA ABSOLUTAMENTE NADA
--    La madre seguía con derecho a retirarlo, la autorización de imagen que
--    él nunca dio seguía concedida, y se le contactaba con un consentimiento
--    que otorgó otra persona.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW plataforma.v_cumplen_mayoria_de_edad
WITH (security_invoker = true) AS
SELECT p.id AS persona_id, p.sede_id,
       p.primer_nombre||' '||p.primer_apellido AS persona,
       p.fecha_nacimiento,
       (p.fecha_nacimiento + interval '18 years')::date AS cumple_18,
       ((p.fecha_nacimiento + interval '18 years')::date - CURRENT_DATE) AS dias
FROM nucleo.personas p
WHERE p.eliminado_en IS NULL AND p.fecha_nacimiento IS NOT NULL
  AND (p.fecha_nacimiento + interval '18 years')::date BETWEEN CURRENT_DATE - 30 AND CURRENT_DATE + 30;

CREATE OR REPLACE FUNCTION plataforma.procesar_mayoria_de_edad()
RETURNS TABLE(persona_id uuid, persona text, que_paso text)
LANGUAGE plpgsql AS $$
DECLARE r record; v_n int := 0;
BEGIN
  FOR r IN
    SELECT p.id, p.primer_nombre||' '||p.primer_apellido AS nombre
    FROM nucleo.personas p
    WHERE p.eliminado_en IS NULL AND p.fecha_nacimiento IS NOT NULL
      AND NOT nucleo.es_menor(p.fecha_nacimiento)
      AND (EXISTS (SELECT 1 FROM nucleo.acudientes a WHERE a.menor_id = p.id AND a.vigente_hasta IS NULL)
        OR EXISTS (SELECT 1 FROM rocakids.autorizaciones z WHERE z.menor_id = p.id AND z.vence_en IS NULL AND z.concedida))
  LOOP
    UPDATE nucleo.acudientes SET vigente_hasta = CURRENT_DATE
     WHERE menor_id = r.id AND vigente_hasta IS NULL;
    UPDATE rocakids.autorizaciones SET vence_en = CURRENT_DATE
     WHERE menor_id = r.id AND vence_en IS NULL;
    -- El consentimiento que otorgo otra persona deja de valer: se revoca y
    -- se le pedira al titular que lo confirme el mismo.
    PERFORM plataforma.revocar_consentimiento(r.id, NULL, NULL,
      'Cumplio la mayoria de edad: el consentimiento que otorgo su representante deja de valer');
    v_n := v_n + 1;
    RETURN QUERY SELECT r.id, r.nombre,
      'acudientes cerrados, autorizaciones vencidas y consentimiento del representante revocado'::text;
  END LOOP;
  INSERT INTO plataforma.bitacora_mantenimiento (tarea, objeto, detalle)
  VALUES ('mayoria_de_edad','plataforma', jsonb_build_object('personas', v_n));
END $$;

-- ---------------------------------------------------------------------
-- 8 · ⛔ LOS PLAZOS DEL TITULAR SE CONTABAN SIN FESTIVOS
--    El sistema fijaba el vencimiento de una consulta EN UN DIA FESTIVO,
--    despues de contar Navidad y Ano Nuevo como habiles.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sistema.festivos (
  pais   char(2) NOT NULL REFERENCES org.paises(codigo_iso2),
  fecha  date NOT NULL,
  nombre text NOT NULL,
  PRIMARY KEY (pais, fecha)
);

-- Colombia: los de fecha fija mas los trasladados por la Ley 51 de 1983.
-- Se siembran 2026 a 2030; la funcion avisa si se sale del rango sembrado.
-- ⛔ El CONTENIDO va en el seed 022: `org.paises` se siembra DESPUES de las
--    migraciones, asi que aqui la clave foranea todavia no tiene a que
--    apuntar. Es la misma razon por la que la 0049 dejo sus roles al seed.


DROP FUNCTION IF EXISTS plataforma.dias_habiles_desde(date, int);
CREATE OR REPLACE FUNCTION plataforma.dias_habiles_desde(
  p_desde date, p_dias int, p_pais char(2) DEFAULT 'CO'
) RETURNS date LANGUAGE plpgsql STABLE AS $$
DECLARE d date := p_desde; n int := 0; v_max date;
BEGIN
  SELECT max(fecha) INTO v_max FROM sistema.festivos WHERE pais = p_pais;
  WHILE n < p_dias LOOP
    d := d + 1;
    IF extract(isodow from d) < 6
       AND NOT EXISTS (SELECT 1 FROM sistema.festivos f WHERE f.pais = p_pais AND f.fecha = d)
    THEN n := n + 1; END IF;
  END LOOP;

  -- ⛔ Si nos salimos del calendario sembrado, el plazo calculado ya no es
  --    de fiar. Se avisa ruidosamente en vez de devolver una fecha falsa.
  IF v_max IS NULL OR d > v_max THEN
    RAISE WARNING 'El calendario de festivos de % solo llega a %: el plazo calculado (%) puede estar mal. Siembre los festivos siguientes.',
      p_pais, v_max, d;
  END IF;
  RETURN d;
END $$;

-- La prorroga que la ley permite, modelada (art. 14: 5 dias mas; art. 15: 8).
ALTER TABLE plataforma.peticiones_titular
  ADD COLUMN IF NOT EXISTS prorrogada_en timestamptz,
  ADD COLUMN IF NOT EXISTS prorroga_informada_en timestamptz,
  ADD COLUMN IF NOT EXISTS prorroga_motivo text;

CREATE OR REPLACE FUNCTION plataforma.prorrogar_peticion(
  p_peticion uuid, p_motivo text, p_informada boolean DEFAULT false
) RETURNS date LANGUAGE plpgsql AS $$
DECLARE v_tipo text; v_vence date; v_nuevo date;
BEGIN
  SELECT tipo, vence_en INTO v_tipo, v_vence FROM plataforma.peticiones_titular WHERE id = p_peticion;
  IF v_tipo IS NULL THEN RAISE EXCEPTION 'La peticion no existe' USING ERRCODE='no_data_found'; END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) < 10 THEN
    RAISE EXCEPTION 'La prorroga exige motivo escrito: la ley obliga a informarlo al titular'
      USING ERRCODE='check_violation';
  END IF;
  v_nuevo := plataforma.dias_habiles_desde(v_vence, CASE WHEN v_tipo='consulta' THEN 5 ELSE 8 END);
  UPDATE plataforma.peticiones_titular
     SET estado='prorrogada', vence_en = v_nuevo, prorrogada_en = now(),
         prorroga_motivo = p_motivo,
         prorroga_informada_en = CASE WHEN p_informada THEN now() ELSE NULL END
   WHERE id = p_peticion;
  RETURN v_nuevo;
END $$;

-- ---------------------------------------------------------------------
-- 9 · ⛔ POLÍTICA DE TRATAMIENTO Y AVISO DE PRIVACIDAD, CON VERSIÓN
--    No se guardaba qué versión aceptó cada titular, así que la
--    autorización recogida era impugnable.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plataforma.politicas_tratamiento (
  version       text PRIMARY KEY,
  vigente_desde date NOT NULL,
  vigente_hasta date,
  url           text NOT NULL,
  hash_sha256   text,
  resumen       text NOT NULL,
  aprobada_por  text NOT NULL,
  CONSTRAINT politica_vigencia CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde)
);
CREATE UNIQUE INDEX IF NOT EXISTS politica_una_vigente ON plataforma.politicas_tratamiento ((true)) WHERE vigente_hasta IS NULL;

ALTER TABLE plataforma.consentimientos ADD COLUMN IF NOT EXISTS politica_version text REFERENCES plataforma.politicas_tratamiento(version);
ALTER TABLE crm.nuevos_registros ADD COLUMN IF NOT EXISTS politica_version text REFERENCES plataforma.politicas_tratamiento(version);

CREATE OR REPLACE FUNCTION plataforma.politica_vigente() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT version FROM plataforma.politicas_tratamiento
  WHERE vigente_desde <= CURRENT_DATE AND vigente_hasta IS NULL LIMIT 1;
$$;

-- ---------------------------------------------------------------------
-- 10 · ⛔ EL CONTROL DE CIFRADO ESTABA ESCRITO PARA NO DETECTAR NADA
--     `incumple_cifrado` incluía el mecanismo en la fórmula, así que
--     declarar `mecanismo='rls_y_bitacora'` apagaba el control. Diez
--     columnas en nivel que exige cifrado figuraban como conformes.
-- ---------------------------------------------------------------------
DROP VIEW IF EXISTS plataforma.v_control_clasificacion;
CREATE VIEW plataforma.v_control_clasificacion
WITH (security_invoker = true) AS
SELECT c.esquema, c.tabla, c.columna, c.nivel, c.mecanismo, c.cifrada,
       n.exige_cifrado, n.exige_bitacora_lect,
       (n.exige_cifrado AND NOT c.cifrada) AS incumple_cifrado,
       (n.exige_bitacora_lect
        AND NOT EXISTS (SELECT 1 FROM plataforma.bitacora_lectura b
                        WHERE b.esquema = c.esquema AND b.tabla = c.tabla)) AS sin_una_sola_lectura_registrada
FROM plataforma.clasificacion_columna c
JOIN plataforma.niveles_sensibilidad n ON n.nivel = c.nivel;

COMMENT ON VIEW plataforma.v_control_clasificacion IS
  'La formula ya NO incluye el mecanismo: declarar «rls_y_bitacora» apagaba el control y diez columnas sin cifrar figuraban como conformes.';

GRANT SELECT ON plataforma.v_cumplen_mayoria_de_edad TO casaroca_app;
GRANT EXECUTE ON FUNCTION plataforma.revocar_consentimiento(uuid,plataforma.canal_contacto,text,text) TO casaroca_app;
GRANT EXECUTE ON FUNCTION plataforma.ejecutar_supresion(uuid,uuid) TO casaroca_app;
GRANT EXECUTE ON FUNCTION plataforma.prorrogar_peticion(uuid,text,boolean) TO casaroca_app;
GRANT EXECUTE ON FUNCTION plataforma.politica_vigente() TO casaroca_app;
GRANT EXECUTE ON FUNCTION plataforma.procesar_mayoria_de_edad() TO casaroca_app;
SELECT plataforma.publicar_tabla('sistema.festivos'::regclass, 'catalogo_red',
  'Calendario de festivos por pais. Sin el, los plazos de la Ley 1581 se calculan mal.', 'Mesa tecnica 100p', false);
SELECT plataforma.publicar_tabla('plataforma.politicas_tratamiento'::regclass, 'catalogo_red',
  'Versiones de la politica de tratamiento. Toda autorizacion guarda cual acepto.', 'Mesa tecnica 100p', false);
