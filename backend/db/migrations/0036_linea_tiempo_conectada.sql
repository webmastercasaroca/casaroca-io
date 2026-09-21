-- =====================================================================
-- Migración 0036 — LA LÍNEA DE TIEMPO SE CONECTA DE VERDAD
--
-- ⛔ EL HALLAZGO QUE OBLIGA A ESTA MIGRACIÓN (15 sep 2026, medido)
--
--   SELECT codigo, count(*) FROM crm.tipos_hecho ...
--     → 12 de los 13 tipos de hecho en CERO filas.
--   SELECT count(*) FROM aportes.aportes;                     → 8
--   SELECT count(*) FROM crm.linea_tiempo WHERE tipo='APORTE'; → 0
--
--   Hay ocho aportes registrados y NINGUNO aparece en la línea de
--   tiempo de nadie. Lo mismo con asistencia, grupos, consejería y
--   formación: los doce disparadores que existen sobre esas tablas son
--   todos de INTEGRIDAD, ninguno alimenta el CRM.
--
-- La decisión de arquitectura ya estaba tomada y bien tomada: «ningún
-- módulo tiene su propio CRM; cada uno escribe un HECHO en
-- crm.linea_tiempo y sigue con lo suyo; el CRM es la LECTURA de esa
-- línea». Estaba escrita, estaba la tabla, estaban los 13 tipos.
-- Faltaba lo único que la hace cierta: que los módulos escriban.
--
-- Sin esto, la ficha 360° de una persona está vacía aunque lleve años
-- diezmando, asistiendo y estudiando. El dato existe, pero desperdigado
-- en once esquemas que nadie cruza.
--
-- ⭐ Y ES LO QUE HACE EXTENSIBLE EL SISTEMA. Un módulo nuevo no toca el
--    núcleo: registra su tipo en crm.tipos_hecho, llama a
--    crm.anotar_hecho() y desde ese momento su información aparece sola
--    en la ficha de la persona, en el Centro de Mando y en cualquier
--    lectura futura. Sin esta pieza, cada módulo nuevo obligaría a
--    reescribir el CRM.
--
-- ⛔ POR QUÉ EL RESUMEN DE UN APORTE NO LLEVA EL MONTO
--   La línea de tiempo se filtra por el NIVEL del tipo de hecho:
--   APORTE es N3 y la migración 0034 subió al Pastor Congregacional a
--   N4, así que él SÍ lee estos hechos. Y la regla del proyecto dice:
--     · Pastor Director General → ve el aporte POR PERSONA
--     · Pastor Congregacional   → ve SI una familia aporta y con qué
--                                 frecuencia, NUNCA el monto
--   Si el monto fuera en el `resumen`, la línea de tiempo sería la
--   puerta trasera que salta esa regla. El monto vive SOLO en
--   aportes.aportes. Aquí va el hecho, no la cifra.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · EL AYUDANTE ÚNICO
--     Un solo sitio donde se escribe un hecho. Si mañana la línea de
--     tiempo cambia de forma, cambia aquí y no en seis disparadores.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION crm.anotar_hecho(
  p_persona   uuid,
  p_sede      uuid,
  p_ocurrido  timestamptz,
  p_tipo      text,
  p_modulo    text,
  p_ent_tipo  text,
  p_ent_id    text,
  p_resumen   text,
  p_detalle   jsonb DEFAULT NULL,
  p_src_sys   text  DEFAULT NULL,
  p_src_id    text  DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = crm, pg_temp AS $$
BEGIN
  /* Sin persona o sin sede no hay línea de tiempo: un aporte anónimo o
     un registro huérfano simplemente no produce hecho. No es un error,
     es que no hay a quién atribuirlo. */
  IF p_persona IS NULL OR p_sede IS NULL THEN RETURN; END IF;

  INSERT INTO crm.linea_tiempo
    (persona_id, sede_id, ocurrido_en, tipo,
     entidad_modulo, entidad_tipo, entidad_id, resumen, detalle,
     source_system, source_id)
  VALUES
    (p_persona, p_sede, p_ocurrido, p_tipo,
     p_modulo, p_ent_tipo, p_ent_id, p_resumen, p_detalle,
     p_src_sys, p_src_id);
END
$$;

COMMENT ON FUNCTION crm.anotar_hecho IS
  'Único punto de escritura de la línea de tiempo. SECURITY DEFINER a propósito: el módulo que registra un aporte no necesita permiso sobre el CRM para dejar constancia, igual que un cajero no necesita permiso sobre la contabilidad para que su venta aparezca en ella. Un módulo NUEVO se conecta llamando aquí.';

-- ---------------------------------------------------------------------
-- 2 · APORTES  → tipo APORTE (N3)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION aportes.tg_aporte_a_linea() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.es_anonimo OR NEW.persona_id IS NULL THEN RETURN NEW; END IF;

  PERFORM crm.anotar_hecho(
    NEW.persona_id, NEW.sede_id, NEW.fecha::timestamptz, 'APORTE',
    'aportes', 'aporte', NEW.id::text,
    'Aporte registrado: ' || NEW.tipo::text,
    /* ⛔ Sin monto. Ver la cabecera de esta migración. */
    jsonb_build_object('tipo', NEW.tipo, 'fondo_id', NEW.fondo_id,
                       'medio', NEW.medio, 'fuente', NEW.fuente),
    NEW.source_system, NEW.source_id);
  RETURN NEW;
END
$$;
CREATE TRIGGER trg_aporte_a_linea AFTER INSERT ON aportes.aportes
  FOR EACH ROW EXECUTE FUNCTION aportes.tg_aporte_a_linea();

/* Un aporte anulado no se borra de la línea: se marca. La línea de
   tiempo cuenta lo que pasó, y que algo se anulara también pasó. */
CREATE OR REPLACE FUNCTION aportes.tg_aporte_anulado_a_linea() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = crm, aportes, pg_temp AS $$
BEGIN
  IF OLD.anulado_en IS NULL AND NEW.anulado_en IS NOT NULL THEN
    UPDATE crm.linea_tiempo
       SET detalle = coalesce(detalle,'{}'::jsonb)
                     || jsonb_build_object('anulado', true, 'anulado_motivo', NEW.anulado_motivo),
           resumen = resumen || ' (anulado)'
     WHERE entidad_modulo = 'aportes' AND entidad_tipo = 'aporte'
       AND entidad_id = NEW.id::text;
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER trg_aporte_anulado_a_linea AFTER UPDATE ON aportes.aportes
  FOR EACH ROW EXECUTE FUNCTION aportes.tg_aporte_anulado_a_linea();

-- ---------------------------------------------------------------------
-- 3 · ASISTENCIA → tipo ASISTENCIA (N2)
--     La sede no está en la entrada: viene del servicio.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION asistencia.tg_entrada_a_linea() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_sede uuid; v_nombre text; v_fecha date;
BEGIN
  SELECT s.sede_id, s.nombre, s.fecha INTO v_sede, v_nombre, v_fecha
    FROM asistencia.servicios s WHERE s.id = NEW.servicio_id;
  PERFORM crm.anotar_hecho(
    NEW.persona_id, v_sede, NEW.marcada_en, 'ASISTENCIA',
    'asistencia', 'entrada', NEW.id::text,
    'Asistió a ' || coalesce(v_nombre, 'un servicio'),
    jsonb_build_object('servicio_id', NEW.servicio_id, 'medio', NEW.medio, 'fecha', v_fecha));
  RETURN NEW;
END
$$;
CREATE TRIGGER trg_entrada_a_linea AFTER INSERT ON asistencia.entradas
  FOR EACH ROW EXECUTE FUNCTION asistencia.tg_entrada_a_linea();

-- ---------------------------------------------------------------------
-- 4 · GRUPOS → tipo INGRESO_GRUPO (N2)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION grupos.tg_membresia_a_linea() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_sede uuid; v_nombre text;
BEGIN
  SELECT g.sede_id, g.nombre INTO v_sede, v_nombre
    FROM grupos.grupos g WHERE g.id = NEW.grupo_id;
  PERFORM crm.anotar_hecho(
    NEW.persona_id, v_sede, NEW.fecha_ingreso::timestamptz, 'INGRESO_GRUPO',
    'grupos', 'membresia', NEW.id::text,
    'Entró al grupo ' || coalesce(v_nombre, ''),
    jsonb_build_object('grupo_id', NEW.grupo_id, 'rol', NEW.rol),
    NEW.source_system, NEW.source_id);
  RETURN NEW;
END
$$;
CREATE TRIGGER trg_membresia_a_linea AFTER INSERT ON grupos.membresias
  FOR EACH ROW EXECUTE FUNCTION grupos.tg_membresia_a_linea();

-- ---------------------------------------------------------------------
-- 5 · CONSEJERÍA → tipo CASO_CONSEJERIA (N3)
--     ⛔ El TÓPICO no va en el resumen. Que alguien abrió un caso es un
--     hecho; por qué lo abrió es materia reservada del consejero.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION consejeria.tg_caso_a_linea() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM crm.anotar_hecho(
    NEW.consultante_id, NEW.sede_id, NEW.abierto_en, 'CASO_CONSEJERIA',
    'consejeria', 'caso', NEW.id::text,
    'Abrió un proceso de acompañamiento',
    jsonb_build_object('estado', NEW.estado),
    NEW.source_system, NEW.source_id);
  RETURN NEW;
END
$$;
CREATE TRIGGER trg_caso_a_linea AFTER INSERT ON consejeria.casos
  FOR EACH ROW EXECUTE FUNCTION consejeria.tg_caso_a_linea();

-- ---------------------------------------------------------------------
-- 6 · FORMACIÓN → CURSO_INICIADO y CURSO_CERTIFICADO (N2)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION formacion.tg_inscripcion_a_linea() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_sede uuid; v_cod text;
BEGIN
  SELECT c.sede_id, c.codigo INTO v_sede, v_cod
    FROM formacion.cohortes c WHERE c.id = NEW.cohorte_id;
  PERFORM crm.anotar_hecho(
    NEW.persona_id, v_sede, NEW.inscrito_en, 'CURSO_INICIADO',
    'formacion', 'inscripcion', NEW.id::text,
    'Se inscribió en ' || coalesce(v_cod, 'un curso'),
    jsonb_build_object('cohorte_id', NEW.cohorte_id, 'estado', NEW.estado),
    NEW.source_system, NEW.source_id);
  RETURN NEW;
END
$$;
CREATE TRIGGER trg_inscripcion_a_linea AFTER INSERT ON formacion.inscripciones
  FOR EACH ROW EXECUTE FUNCTION formacion.tg_inscripcion_a_linea();

CREATE OR REPLACE FUNCTION formacion.tg_certificado_a_linea() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_persona uuid; v_sede uuid; v_cod text;
BEGIN
  SELECT i.persona_id, c.sede_id, c.codigo INTO v_persona, v_sede, v_cod
    FROM formacion.inscripciones i
    JOIN formacion.cohortes c ON c.id = i.cohorte_id
   WHERE i.id = NEW.inscripcion_id;
  PERFORM crm.anotar_hecho(
    v_persona, v_sede, NEW.emitido_en, 'CURSO_CERTIFICADO',
    'formacion', 'certificado', NEW.id::text,
    'Certificó ' || coalesce(v_cod, 'un curso'),
    jsonb_build_object('codigo', NEW.codigo));
  RETURN NEW;
END
$$;
CREATE TRIGGER trg_certificado_a_linea AFTER INSERT ON formacion.certificados
  FOR EACH ROW EXECUTE FUNCTION formacion.tg_certificado_a_linea();

-- ---------------------------------------------------------------------
-- 7 · LO QUE NO SE CONECTA AQUÍ, Y POR QUÉ
--
--   ROCAKIDS (CHECKIN_ROCAKIDS, ENTREGA_ROCAKIDS) queda FUERA a
--   propósito. Son hechos N4 sobre menores, y `rocakids.checkins`
--   apunta a `menor_id`, no a `nucleo.personas`. Llevar la entrada y
--   salida de un niño a la misma línea que lee el cuerpo pastoral es
--   una decisión de protección de menores, no de programación: la toma
--   la iglesia, no esta migración. Queda anotado para el taller H-01.
--
--   Los tipos LLAMADA, NOTA_PASTORAL, PRIMERA_VISITA, VISITA_PASTORAL
--   y CAMBIO_ETAPA los escribe el pastor A MANO desde el CRM: no nacen
--   de otra tabla, así que no llevan disparador. Son los únicos cinco
--   de los trece que se capturan directamente.
-- ---------------------------------------------------------------------
