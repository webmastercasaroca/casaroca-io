-- =====================================================================
-- Migración 0022 — EMPALME CON LOS MÓDULOS DEL EQUIPO 100p
--
-- Origen: los tres documentos de `02 Módulos` del Drive, escritos entre
-- el 24 y el 25 de agosto de 2026:
--   · ESTRUCTURA DE DATOS - ROLES      (arquitectura progresiva)
--   · ESTRUCTURA DE DATOS - NUEVOS     (M-Nuevos, 5 endpoints)
--   · ESTRUCTURA DE DATOS - DONACIONES (M-Donaciones, certificados)
--
-- Esta migración ADOPTA tres cosas que ellos tienen y nosotros no, y las
-- monta sobre las garantías que ya vive nuestra base. Las divergencias
-- que quedan abiertas van en el documento de empalme, no aquí: el código
-- solo incorpora lo que no está en discusión.
--
--   1. Permisos NOMBRADOS por módulo, además de los verbos genéricos.
--   2. Certificados tributarios de donación, y su regla de inmutabilidad.
--   3. La bandeja de nuevos como paso previo al registro maestro.
-- =====================================================================


-- ═══════════════════════════════════════════════════════════════════
-- 1 · PERMISOS NOMBRADOS · adopción del modelo progresivo
--
-- Su documento tiene razón en un punto importante: nuestros seis verbos
-- (ver/crear/editar/anular/exportar/administrar) describen operaciones
-- de tabla, no acciones de la iglesia. «REGISTRAR_CONVERSACION_PASTORAL»
-- dice algo que «editar consejeria» no dice.
--
-- No se sustituye una cosa por otra: se suman. El verbo genérico sirve
-- para lo que es CRUD de verdad; el permiso nombrado, para la acción de
-- negocio que alguien va a discutir en el taller H-01.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE sistema.acciones
  ADD COLUMN modulo text REFERENCES sistema.modulos(codigo),
  ADD COLUMN descripcion text;

COMMENT ON COLUMN sistema.acciones.modulo IS
  'NULL = verbo genérico, aplicable a cualquier módulo. Con valor = permiso nombrado, propio de ese módulo. Es lo que permite que cada módulo nuevo traiga sus permisos sin tocar el núcleo.';

-- ⛔ Un permiso nombrado solo puede otorgarse sobre SU módulo. Sin esta
--    regla, «EXPEDIR_CERTIFICADO» se podría conceder sobre Consejería y
--    la matriz dejaría de significar algo.
CREATE OR REPLACE FUNCTION sistema.tg_permiso_nombrado_en_su_modulo() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_mod text;
BEGIN
  SELECT modulo INTO v_mod FROM sistema.acciones WHERE codigo = NEW.accion;
  IF v_mod IS NOT NULL AND v_mod <> NEW.modulo THEN
    RAISE EXCEPTION 'El permiso «%» pertenece al módulo «%»: no se puede otorgar sobre «%»',
      NEW.accion, v_mod, NEW.modulo USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER trg_permiso_nombrado_en_su_modulo
  BEFORE INSERT OR UPDATE ON sistema.matriz_permisos
  FOR EACH ROW EXECUTE FUNCTION sistema.tg_permiso_nombrado_en_su_modulo();


-- ═══════════════════════════════════════════════════════════════════
-- 2 · CERTIFICADOS TRIBUTARIOS · adopción de M-Donaciones
--
-- Nos faltaba, y no es un detalle: en Colombia el certificado de
-- donación es el documento con el que la persona deduce. Su documento
-- además trae una regla mejor que la nuestra: certificar CONGELA.
--
-- Nosotros teníamos «un aporte no se corrige, se anula y se vuelve a
-- registrar». Eso sigue valiendo — pero solo mientras el aporte no esté
-- certificado. Después, ni eso: el certificado ya salió firmado.
-- ═══════════════════════════════════════════════════════════════════

CREATE TYPE aportes.estado_aporte AS ENUM
  ('registrado','confirmado','certificado','anulado');

ALTER TABLE aportes.aportes
  ADD COLUMN estado aportes.estado_aporte NOT NULL DEFAULT 'registrado',
  ADD COLUMN certificado_id uuid,
  ADD COLUMN fuente text NOT NULL DEFAULT 'manual'
    CHECK (fuente IN ('manual','online','pasarela','importado'));

COMMENT ON COLUMN aportes.aportes.fuente IS
  'manual = digitado en el sistema interno · online = formulario público · pasarela = confirmado por webhook de PayU · importado = migración.';

CREATE TABLE aportes.certificados (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero          text NOT NULL UNIQUE,
  persona_id      uuid NOT NULL REFERENCES nucleo.personas(id) ON DELETE RESTRICT,
  sede_id         uuid NOT NULL REFERENCES org.sedes(id),
  periodo_desde   date NOT NULL,
  periodo_hasta   date NOT NULL,
  total           numeric(15,2) NOT NULL CHECK (total > 0),
  moneda          char(3) NOT NULL DEFAULT 'COP',
  cantidad_aportes integer NOT NULL CHECK (cantidad_aportes > 0),
  estado          text NOT NULL DEFAULT 'expedido' CHECK (estado IN ('expedido','anulado')),
  url_pdf         text,
  expedido_en     timestamptz NOT NULL DEFAULT now(),
  expedido_por    uuid REFERENCES nucleo.personas(id),
  anulado_en      timestamptz,
  anulado_motivo  text,
  CONSTRAINT certificado_periodo CHECK (periodo_hasta >= periodo_desde),
  CONSTRAINT certificado_anulacion CHECK ((anulado_en IS NULL) = (anulado_motivo IS NULL)),
  CONSTRAINT certificado_estado_coherente CHECK ((estado = 'anulado') = (anulado_en IS NOT NULL))
);
CREATE INDEX certificados_persona_idx ON aportes.certificados (persona_id, periodo_desde DESC);
CREATE RULE certificados_no_delete AS ON DELETE TO aportes.certificados DO INSTEAD NOTHING;

ALTER TABLE aportes.aportes
  ADD CONSTRAINT aportes_certificado_fk FOREIGN KEY (certificado_id)
      REFERENCES aportes.certificados(id) ON DELETE RESTRICT,
  ADD CONSTRAINT aporte_certificado_coherente
      CHECK ((estado = 'certificado') = (certificado_id IS NOT NULL));

-- ⛔ LA REGLA: un aporte certificado no se toca. Ni el monto, ni la
--    fecha, ni la persona, ni el estado.
CREATE OR REPLACE FUNCTION aportes.tg_certificado_congela() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.estado = 'certificado' THEN
    IF NEW.monto <> OLD.monto OR NEW.fecha <> OLD.fecha
       OR NEW.persona_id IS DISTINCT FROM OLD.persona_id
       OR NEW.estado <> OLD.estado THEN
      RAISE EXCEPTION 'El aporte % está incluido en un certificado expedido: no se puede modificar', OLD.id
        USING ERRCODE = 'check_violation',
              HINT = 'Si el certificado tiene un error, se anula el certificado con motivo y se expide uno nuevo.';
    END IF;
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER trg_certificado_congela BEFORE UPDATE ON aportes.aportes
  FOR EACH ROW EXECUTE FUNCTION aportes.tg_certificado_congela();

/**
 * Expedir un certificado.
 * El total NO se recibe como parámetro: se calcula. Un certificado cuyo
 * total lo escribe una persona es un documento que puede no cuadrar con
 * sus propios renglones, y este documento va a la DIAN.
 */
CREATE OR REPLACE FUNCTION aportes.expedir_certificado(
  p_persona_id uuid, p_desde date, p_hasta date, p_numero text, p_expedido_por uuid
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_id uuid; v_total numeric(15,2); v_n integer; v_sede uuid; v_moneda char(3);
        v_sedes_distintas integer; v_monedas_distintas integer;
BEGIN
  -- `min()` no existe para uuid, y da igual: un certificado que abarcara
  -- dos sedes o dos monedas no sería un documento válido. Se cuentan los
  -- distintos y se rechaza antes de tomar ninguno.
  SELECT sum(monto), count(*),
         count(DISTINCT sede_id), count(DISTINCT moneda)
    INTO v_total, v_n, v_sedes_distintas, v_monedas_distintas
  FROM aportes.aportes
  WHERE persona_id = p_persona_id AND fecha BETWEEN p_desde AND p_hasta
    AND anulado_en IS NULL AND estado IN ('registrado','confirmado');

  IF COALESCE(v_n,0) = 0 THEN
    RAISE EXCEPTION 'No hay aportes certificables de esa persona en el período'
      USING ERRCODE = 'no_data_found';
  END IF;
  IF v_monedas_distintas > 1 THEN
    RAISE EXCEPTION 'Los aportes del período están en monedas distintas: un certificado no puede mezclarlas'
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_sedes_distintas > 1 THEN
    RAISE EXCEPTION 'Los aportes del período pertenecen a sedes distintas: se expide un certificado por sede'
      USING ERRCODE = 'check_violation',
            HINT = 'Cada sede certifica lo que recibió: es lo que permite conciliar contra su propio cierre.';
  END IF;

  SELECT sede_id, moneda INTO v_sede, v_moneda
  FROM aportes.aportes
  WHERE persona_id = p_persona_id AND fecha BETWEEN p_desde AND p_hasta
    AND anulado_en IS NULL AND estado IN ('registrado','confirmado')
  LIMIT 1;

  INSERT INTO aportes.certificados
    (numero, persona_id, sede_id, periodo_desde, periodo_hasta, total, moneda,
     cantidad_aportes, expedido_por)
  VALUES (p_numero, p_persona_id, v_sede, p_desde, p_hasta, v_total, v_moneda, v_n, p_expedido_por)
  RETURNING id INTO v_id;

  UPDATE aportes.aportes
     SET estado = 'certificado', certificado_id = v_id
   WHERE persona_id = p_persona_id AND fecha BETWEEN p_desde AND p_hasta
     AND anulado_en IS NULL AND estado IN ('registrado','confirmado');

  RETURN v_id;
END
$$;

-- Control: el total del certificado contra la suma real de sus renglones.
CREATE OR REPLACE VIEW aportes.v_control_certificados AS
SELECT c.id, c.numero, c.persona_id, c.total AS total_certificado,
       COALESCE(sum(a.monto),0) AS suma_renglones,
       c.cantidad_aportes, count(a.id) AS renglones,
       (c.total = COALESCE(sum(a.monto),0) AND c.cantidad_aportes = count(a.id)) AS cuadra
FROM aportes.certificados c
LEFT JOIN aportes.aportes a ON a.certificado_id = c.id
GROUP BY c.id;

GRANT SELECT, INSERT, UPDATE ON aportes.certificados TO casaroca_app;
GRANT SELECT ON aportes.v_control_certificados TO casaroca_app;


-- ═══════════════════════════════════════════════════════════════════
-- 3 · LA BANDEJA DE NUEVOS · adopción de M-Nuevos
--
-- Su modelo separa `nuevos_registros` de `personas`, y tienen razón:
-- quien llena un formulario web no es todavía una persona verificada, y
-- meterlo directo al registro maestro lo contamina.
--
-- Lo que añadimos por nuestro lado: la bandeja NO pierde el embudo. La
-- fecha en que alguien llegó y por qué puerta entró se conservan y pasan
-- al recorrido 4C en la conversión, porque son el dato con el que se
-- mide si el acompañamiento funciona.
-- ═══════════════════════════════════════════════════════════════════

CREATE TYPE crm.estado_nuevo AS ENUM
  ('nuevo','contactado','en_seguimiento','convertido','no_interesado','inactivo');
CREATE TYPE crm.reaccion AS ENUM
  ('interesado','dudoso','no_interesado','no_contesto');

CREATE TABLE crm.nuevos_registros (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- La sede es una clave foránea, no un texto: 'bogota' y 'Bogotá' no
  -- pueden ser dos sedes distintas por un acento.
  sede_id        uuid NOT NULL REFERENCES org.sedes(id),
  nombre         text NOT NULL,
  email          citext,
  telefono       text,
  como_supo      text CHECK (como_supo IN ('google','amigo','evento','redes','otro')),
  es_cristiano   text CHECK (es_cristiano IN ('si','no','duda')),
  comentarios    text,
  estado         crm.estado_nuevo NOT NULL DEFAULT 'nuevo',
  coordinador_id uuid REFERENCES nucleo.personas(id),
  proximo_contacto date,
  prioridad      text NOT NULL DEFAULT 'media' CHECK (prioridad IN ('alta','media','baja')),
  fuente         text NOT NULL DEFAULT 'web' CHECK (fuente IN ('web','presencial','evento','otro')),
  persona_id     uuid REFERENCES nucleo.personas(id),   -- se llena al convertir
  convertido_en  timestamptz,
  registrado_en  timestamptz NOT NULL DEFAULT now(),
  ip_registro    inet,
  CONSTRAINT nuevo_conversion_coherente
    CHECK ((estado = 'convertido') = (persona_id IS NOT NULL AND convertido_en IS NOT NULL)),
  -- Al menos una forma de volver a contactarlo, o el registro no sirve.
  CONSTRAINT nuevo_contactable CHECK (email IS NOT NULL OR telefono IS NOT NULL)
);
CREATE INDEX nuevos_sede_estado_idx ON crm.nuevos_registros (sede_id, estado, registrado_en DESC);
-- Deduplicación por correo dentro de la BANDEJA, no contra el maestro:
-- que alguien ya sea miembro no impide que vuelva a llenar el formulario;
-- lo que se evita es procesar dos veces la misma solicitud abierta.
CREATE UNIQUE INDEX nuevos_email_abierto_uq ON crm.nuevos_registros (email)
  WHERE email IS NOT NULL AND estado IN ('nuevo','contactado','en_seguimiento');

CREATE TABLE crm.contactos_nuevos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nuevo_id       uuid NOT NULL REFERENCES crm.nuevos_registros(id) ON DELETE RESTRICT,
  coordinador_id uuid REFERENCES nucleo.personas(id),
  ocurrido_en    timestamptz NOT NULL DEFAULT now(),
  tipo           text NOT NULL CHECK (tipo IN ('llamada','visita','email','whatsapp','mensaje')),
  resumen        text NOT NULL,
  reaccion       crm.reaccion NOT NULL,
  siguiente_paso text,
  proximo_contacto date,
  registrado_en  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contactos_nuevo_idx ON crm.contactos_nuevos (nuevo_id, ocurrido_en DESC);
CREATE RULE contactos_nuevos_no_update AS ON UPDATE TO crm.contactos_nuevos DO INSTEAD NOTHING;
CREATE RULE contactos_nuevos_no_delete AS ON DELETE TO crm.contactos_nuevos DO INSTEAD NOTHING;

/**
 * Convertir un registro de la bandeja en persona del registro maestro.
 *
 * Si ya existe una persona con ese documento o correo, se VINCULA en vez
 * de crear otra: la deduplicación ocurre aquí, en el único punto por el
 * que se entra al maestro.
 *
 * El recorrido 4C se abre con la fecha en que la persona LLEGÓ, no con
 * la de hoy. Si se abriera hoy, todo el mundo tendría cero días en la
 * etapa «conoce» y la métrica del embudo sería un adorno.
 */
CREATE OR REPLACE FUNCTION crm.convertir_en_miembro(
  p_nuevo_id uuid, p_convertido_por uuid, p_nota text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE n record; v_persona uuid;
BEGIN
  SELECT * INTO n FROM crm.nuevos_registros WHERE id = p_nuevo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe ese registro en la bandeja' USING ERRCODE = 'no_data_found';
  END IF;
  IF n.estado = 'convertido' THEN
    RAISE EXCEPTION 'Ese registro ya fue convertido' USING ERRCODE = 'check_violation';
  END IF;

  -- ¿ya existe en el maestro?
  SELECT id INTO v_persona FROM nucleo.personas
   WHERE eliminado_en IS NULL AND n.email IS NOT NULL AND email_principal = n.email
   LIMIT 1;

  IF v_persona IS NULL THEN
    -- El linaje apunta al registro de la bandeja del que salió. Así se
    -- puede responder «esta persona vino del formulario del 3 de agosto»
    -- igual que se responde «vino del registro 48211 de la plataforma».
    INSERT INTO nucleo.personas
      (sede_id, primer_nombre, primer_apellido, email_principal, telefono_movil,
       source_system, source_id)
    VALUES (n.sede_id,
            split_part(btrim(n.nombre),' ',1),
            COALESCE(NULLIF(btrim(substr(btrim(n.nombre),
                     length(split_part(btrim(n.nombre),' ',1))+1)),''), '(sin apellido)'),
            n.email, n.telefono, 'bandeja_nuevos', p_nuevo_id::text)
    RETURNING id INTO v_persona;
  END IF;

  -- El recorrido arranca en la fecha real de llegada.
  IF NOT EXISTS (SELECT 1 FROM crm.recorrido WHERE persona_id = v_persona AND salio_en IS NULL) THEN
    INSERT INTO crm.recorrido (persona_id, sede_id, etapa, entro_en, puerta_entrada, responsable_id)
    VALUES (v_persona, n.sede_id, 'conoce', n.registrado_en,
            COALESCE(n.como_supo,'formulario web'), p_convertido_por);
  END IF;

  INSERT INTO crm.linea_tiempo
    (persona_id, sede_id, ocurrido_en, tipo, entidad_modulo, entidad_tipo, entidad_id,
     resumen, registrado_por)
  VALUES (v_persona, n.sede_id, now(), 'CAMBIO_ETAPA','nuevos','nuevo_registro',p_nuevo_id::text,
          COALESCE(p_nota,'Convertido desde la bandeja de nuevos'), p_convertido_por);

  UPDATE crm.nuevos_registros
     SET estado = 'convertido', persona_id = v_persona, convertido_en = now()
   WHERE id = p_nuevo_id;

  RETURN v_persona;
END
$$;

ALTER TABLE crm.nuevos_registros  ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.nuevos_registros  FORCE ROW LEVEL SECURITY;
ALTER TABLE crm.contactos_nuevos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.contactos_nuevos  FORCE ROW LEVEL SECURITY;
CREATE POLICY nuevos_sel ON crm.nuevos_registros FOR SELECT USING (plataforma.sede_visible(sede_id));
CREATE POLICY nuevos_ins ON crm.nuevos_registros FOR INSERT WITH CHECK (plataforma.sede_visible(sede_id));
CREATE POLICY nuevos_upd ON crm.nuevos_registros FOR UPDATE USING (plataforma.sede_visible(sede_id));
CREATE POLICY cont_sel ON crm.contactos_nuevos FOR SELECT
  USING (EXISTS (SELECT 1 FROM crm.nuevos_registros n
                  WHERE n.id = crm.contactos_nuevos.nuevo_id AND plataforma.sede_visible(n.sede_id)));
CREATE POLICY cont_ins ON crm.contactos_nuevos FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM crm.nuevos_registros n
                       WHERE n.id = crm.contactos_nuevos.nuevo_id AND plataforma.sede_visible(n.sede_id)));

-- El tablero del coordinador, tal como lo describe su documento.
CREATE OR REPLACE VIEW crm.v_bandeja_nuevos AS
SELECT n.id, n.sede_id, n.nombre, n.email, n.telefono, n.como_supo, n.es_cristiano,
       n.estado, n.prioridad, n.coordinador_id, n.registrado_en, n.proximo_contacto,
       (SELECT count(*) FROM crm.contactos_nuevos c WHERE c.nuevo_id = n.id) AS contactos,
       (SELECT max(c.ocurrido_en) FROM crm.contactos_nuevos c WHERE c.nuevo_id = n.id) AS ultimo_contacto,
       CASE
         WHEN n.estado = 'nuevo' AND n.registrado_en < now() - interval '48 hours' THEN 'ATRASADO'
         WHEN n.proximo_contacto IS NOT NULL AND n.proximo_contacto <= CURRENT_DATE THEN 'CONTACTAR HOY'
         WHEN n.estado = 'nuevo' THEN 'POR CONTACTAR'
         ELSE 'EN SEGUIMIENTO'
       END AS proxima_accion
FROM crm.nuevos_registros n
WHERE n.estado NOT IN ('convertido','inactivo');

COMMENT ON VIEW crm.v_bandeja_nuevos IS
  'Un registro que lleva más de 48 horas sin contactar sale marcado ATRASADO. La bandeja no es una lista: es una deuda con alguien que levantó la mano.';

GRANT SELECT, INSERT, UPDATE ON crm.nuevos_registros TO casaroca_app;
GRANT SELECT, INSERT ON crm.contactos_nuevos TO casaroca_app;
GRANT SELECT ON crm.v_bandeja_nuevos TO casaroca_app;
