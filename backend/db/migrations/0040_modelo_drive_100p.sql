-- =====================================================================
-- Migración 0040 — TODO LO DEL DRIVE «SISTEMA 100p» QUEDA EN EL SISTEMA
--
-- Orden de Daniel, 18 de septiembre de 2026: «todo lo que esté en el
-- Drive debe estar en el sistema». Se contrastó en vivo, documento por
-- documento, contra la carpeta «Sistema 100p Casa Roca Global»:
--   · ESTRUCTURA DE DATOS - USUARIOS (PERSONAS)  v1.2
--   · ESTRUCTURA DE DATOS - ROLES                v1.0 (24 ago)
--   · ESTRUCTURA DE DATOS - NUEVOS               v1.0
--   · ESTRUCTURA DE DATOS - DONACIONES           v1.0 (25 ago)
--   · Arquitectura Fronted y Backed · PLAN DE COSTOS GCP (van fuera de la base)
--
-- ⛔ LA REGLA DE ESTA MIGRACIÓN: se AGREGA lo que falta, no se DEBILITA lo
--    que ya garantiza la base. Donde el Drive y la base dicen lo mismo con
--    otro nombre, se publica con SU nombre en el esquema `modelo100p`; donde
--    el Drive pide algo que rompería una garantía (el correo obligatorio,
--    que bloquea a menores y adultos mayores; un booleano de WhatsApp que
--    se desincroniza del consentimiento), el dato se DERIVA en vez de
--    almacenarse. Es lo mismo que el equipo ya aceptó con `edad`.
--
-- 0032 dejó fuera `nacionalidad`, `zona`, `iglesia_anterior`, `es_ministro`
-- y `en_directorio_publico` «hasta que se acuerden». Esta es esa decisión.
--
-- Los CONTENIDOS (roles, permisos nombrados, alias) van en el seed 018:
-- dependen de `sistema.modulos`, que es un seed y corre después.
-- =====================================================================


-- ═══════════════════════════════════════════════════════════════════
-- 1 · PERSONAS · los campos del documento de Usuarios v1.2
-- ═══════════════════════════════════════════════════════════════════
CREATE TYPE nucleo.es_cristiano AS ENUM ('si','no','en_proceso');

ALTER TABLE nucleo.personas
  ADD COLUMN nombre_corto          text,
  ADD COLUMN nacionalidad          text,
  ADD COLUMN pais_residencia       text,
  ADD COLUMN ciudad_residencia     text,
  ADD COLUMN zona                  text,
  ADD COLUMN email_secundario      citext,
  ADD COLUMN telefono_emergencia   text,
  ADD COLUMN es_cristiano          nucleo.es_cristiano,
  ADD COLUMN iglesia_anterior      text,
  ADD COLUMN es_ministro           boolean NOT NULL DEFAULT false,
  ADD COLUMN en_directorio_publico boolean NOT NULL DEFAULT false;

-- Un segundo correo igual al primero no es un respaldo: es un duplicado
-- que después confunde la deduplicación por correo.
ALTER TABLE nucleo.personas
  ADD CONSTRAINT email_secundario_distinto CHECK (
    email_secundario IS NULL OR email_principal IS NULL
    OR email_secundario <> email_principal);

COMMENT ON COLUMN nucleo.personas.es_cristiano IS
  'si, no o en_proceso (documento Usuarios v1.2). La bandeja de nuevos usa «duda», que al convertir se traduce a en_proceso.';
COMMENT ON COLUMN nucleo.personas.en_directorio_publico IS
  'Aparece en el directorio de la iglesia. Arranca en falso: nadie queda expuesto sin decidirlo.';

INSERT INTO plataforma.clasificacion_columna (esquema, tabla, columna, nivel, finalidad, mecanismo) VALUES
  ('nucleo','personas','nombre_corto',          2, 'administrativa', 'rls_y_bitacora'),
  ('nucleo','personas','nacionalidad',          2, 'administrativa', 'rls_y_bitacora'),
  ('nucleo','personas','pais_residencia',       2, 'administrativa', 'rls_y_bitacora'),
  ('nucleo','personas','ciudad_residencia',     2, 'administrativa', 'rls_y_bitacora'),
  ('nucleo','personas','zona',                  2, 'administrativa', 'rls_y_bitacora'),
  ('nucleo','personas','email_secundario',      2, 'convocatoria',   'rls_y_bitacora'),
  ('nucleo','personas','telefono_emergencia',   2, 'emergencia',     'rls_y_bitacora'),
  ('nucleo','personas','es_cristiano',          2, 'pastoral',       'rls_y_bitacora'),
  ('nucleo','personas','iglesia_anterior',      2, 'pastoral',       'rls_y_bitacora'),
  ('nucleo','personas','es_ministro',           1, 'pastoral',       'rls_y_bitacora'),
  ('nucleo','personas','en_directorio_publico', 1, 'administrativa', 'rls_y_bitacora')
ON CONFLICT DO NOTHING;


-- ═══════════════════════════════════════════════════════════════════
-- 2 · ROLES · `activo` y los nombres del documento de Roles
-- ═══════════════════════════════════════════════════════════════════
-- `roles.activo` (desactivar sin borrar) es lo que el 11 de septiembre ya
-- se había anotado como «conviene adoptarle».
ALTER TABLE identidad.roles ADD COLUMN activo boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION identidad.tg_asignacion_rol_activo() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM identidad.roles WHERE codigo = NEW.rol AND activo) THEN
    RAISE EXCEPTION 'El rol % está desactivado: no se puede otorgar', NEW.rol
      USING ERRCODE = 'check_violation',
            HINT = 'Un rol desactivado conserva su historial, pero no admite asignaciones nuevas.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_asignacion_rol_activo BEFORE INSERT ON identidad.asignaciones
  FOR EACH ROW EXECUTE FUNCTION identidad.tg_asignacion_rol_activo();

-- ⭐ ALIAS. El Drive y la base a veces nombran distinto la MISMA cosa:
--    «DIRECTOR_GENERAL» es nuestro PASTOR_DIRECTOR_GENERAL (Daniel, 11 sep:
--    «Pastor Principal y Pastor Director General son lo mismo»);
--    «GENERAR_CERTIFICADO» es nuestro EXPEDIR_CERTIFICADO. Duplicar el rol
--    o el permiso partiría la matriz en dos; el alias deja que los dos
--    nombres lleguen al mismo sitio.
CREATE TABLE identidad.roles_alias (
  alias   text PRIMARY KEY,
  rol     text NOT NULL REFERENCES identidad.roles(codigo),
  origen  text NOT NULL,
  nota    text
);
CREATE TABLE sistema.acciones_alias (
  alias   text PRIMARY KEY,
  accion  text NOT NULL REFERENCES sistema.acciones(codigo),
  origen  text NOT NULL,
  nota    text
);
GRANT SELECT ON identidad.roles_alias, sistema.acciones_alias TO casaroca_app;

-- ⭐ «¿Puede esta persona hacer ESTA acción en ESTE módulo?» en una sola
--    pregunta, con los nombres de cualquiera de los dos documentos.
--    Mira rol activo, vigencia, techo contra el nivel del módulo y la
--    matriz. `administrar` sobre el módulo cubre todas sus acciones.
CREATE OR REPLACE FUNCTION identidad.puede(p_persona uuid, p_modulo text, p_accion text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = identidad, sistema, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
      FROM identidad.asignaciones a
      JOIN identidad.roles r         ON r.codigo = a.rol AND r.activo
      JOIN sistema.matriz_permisos p ON p.rol = a.rol AND p.modulo = p_modulo
      JOIN sistema.modulos m         ON m.codigo = p.modulo
     WHERE a.persona_id = p_persona
       AND a.vigente_desde <= CURRENT_DATE
       AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)
       AND m.nivel_dato <= a.nivel_max
       AND p.accion IN ('administrar',
             COALESCE((SELECT x.accion FROM sistema.acciones_alias x WHERE x.alias = p_accion), p_accion))
  );
$$;
GRANT EXECUTE ON FUNCTION identidad.puede(uuid, text, text) TO casaroca_app;


-- ═══════════════════════════════════════════════════════════════════
-- 3 · NUEVOS · lo que el documento M-Nuevos pide y faltaba
-- ═══════════════════════════════════════════════════════════════════
-- Flujo 3 del documento: la conversión lleva grupo, padrino y fecha.
ALTER TABLE crm.nuevos_registros
  ADD COLUMN grupo_asignado_id uuid REFERENCES grupos.grupos(id),
  ADD COLUMN padrino_id        uuid REFERENCES nucleo.personas(id),
  ADD COLUMN fecha_decision    date;

-- Paso 9 y paso 12 del flujo: «busca coordinador disponible para esa
-- sede» y «fecha siguiente contacto: hoy + 1 día».
-- ⛔ SECURITY DEFINER a propósito: el formulario público no tiene sesión y
--    no puede leer las asignaciones. La función solo mira UNA cosa (quién
--    es coordinador de nuevos en esa sede) y la usa para UNA fila.
CREATE OR REPLACE FUNCTION crm.tg_nuevo_asignar() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = crm, identidad, pg_temp AS $$
BEGIN
  IF NEW.proximo_contacto IS NULL THEN
    NEW.proximo_contacto := CURRENT_DATE + 1;
  END IF;
  IF NEW.coordinador_id IS NULL THEN
    -- El que menos casos abiertos tiene: repartir, no amontonar.
    SELECT a.persona_id INTO NEW.coordinador_id
      FROM identidad.asignaciones a
      JOIN identidad.roles r ON r.codigo = a.rol AND r.activo
     WHERE a.rol = 'COORDINADOR_NUEVOS'
       AND a.alcance_tipo = 'sede' AND a.alcance_id = NEW.sede_id
       AND a.vigente_desde <= CURRENT_DATE
       AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)
     ORDER BY (SELECT count(*) FROM crm.nuevos_registros n
                WHERE n.coordinador_id = a.persona_id
                  AND n.estado NOT IN ('convertido','inactivo','no_interesado')),
              a.vigente_desde
     LIMIT 1;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_nuevo_asignar BEFORE INSERT ON crm.nuevos_registros
  FOR EACH ROW EXECUTE FUNCTION crm.tg_nuevo_asignar();

-- «notas_privadas (solo coordinador ve)». No es una columna de la bandeja:
-- si lo fuera, cualquiera que viera la fila vería la nota. Es una tabla
-- con su propia cerradura: la lee quien la escribió y el coordinador del
-- registro, nadie más. Solo se agrega: una nota no se corrige, se escribe otra.
CREATE TABLE crm.notas_privadas_nuevos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nuevo_id   uuid NOT NULL REFERENCES crm.nuevos_registros(id),
  autor_id   uuid NOT NULL REFERENCES nucleo.personas(id),
  nota       text NOT NULL CHECK (btrim(nota) <> ''),
  creada_en  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notas_privadas_nuevo_idx ON crm.notas_privadas_nuevos (nuevo_id, creada_en DESC);
ALTER TABLE crm.notas_privadas_nuevos ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.notas_privadas_nuevos FORCE  ROW LEVEL SECURITY;
CREATE POLICY notas_privadas_sel ON crm.notas_privadas_nuevos FOR SELECT USING (
  EXISTS (SELECT 1 FROM crm.nuevos_registros n
           WHERE n.id = nuevo_id AND plataforma.sede_visible(n.sede_id))
  AND (autor_id = plataforma.ctx_persona_id()
       OR EXISTS (SELECT 1 FROM crm.nuevos_registros n
                   WHERE n.id = nuevo_id AND n.coordinador_id = plataforma.ctx_persona_id())));
CREATE POLICY notas_privadas_ins ON crm.notas_privadas_nuevos FOR INSERT WITH CHECK (
  autor_id = plataforma.ctx_persona_id()
  AND EXISTS (SELECT 1 FROM crm.nuevos_registros n
               WHERE n.id = nuevo_id AND plataforma.sede_visible(n.sede_id)));
GRANT SELECT, INSERT ON crm.notas_privadas_nuevos TO casaroca_app;
INSERT INTO plataforma.clasificacion_columna (esquema, tabla, columna, nivel, finalidad, mecanismo) VALUES
  ('crm','notas_privadas_nuevos','nota', 2, 'pastoral', 'rls_y_bitacora')
ON CONFLICT DO NOTHING;

-- Conversión con grupo, padrino y fecha de decisión (endpoint 4 del documento).
-- La de tres argumentos se conserva intacta: la usan las pruebas y el
-- Control Tower. Esta la llama primero y luego completa lo que el
-- documento pide: el grupo y el padrino.
CREATE OR REPLACE FUNCTION crm.convertir_en_miembro(
  p_nuevo_id uuid, p_convertido_por uuid, p_nota text,
  p_grupo_id uuid, p_padrino_id uuid, p_fecha_decision date
) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE v_persona uuid; v_sede uuid; v_sede_grupo uuid; v_duda boolean;
BEGIN
  SELECT sede_id, es_cristiano = 'duda' INTO v_sede, v_duda
    FROM crm.nuevos_registros WHERE id = p_nuevo_id;

  IF p_grupo_id IS NOT NULL THEN
    SELECT sede_id INTO v_sede_grupo FROM grupos.grupos WHERE id = p_grupo_id AND cerrado_en IS NULL;
    IF v_sede_grupo IS NULL THEN
      RAISE EXCEPTION 'El grupo indicado no existe o está cerrado' USING ERRCODE = 'foreign_key_violation';
    END IF;
    IF v_sede_grupo <> v_sede THEN
      RAISE EXCEPTION 'El grupo pertenece a otra sede: la persona se integra en la sede donde llegó'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  v_persona := crm.convertir_en_miembro(p_nuevo_id, p_convertido_por, p_nota);

  UPDATE crm.nuevos_registros
     SET grupo_asignado_id = p_grupo_id,
         padrino_id        = p_padrino_id,
         fecha_decision    = COALESCE(p_fecha_decision, CURRENT_DATE)
   WHERE id = p_nuevo_id;

  -- Lo que la persona dijo en el formulario se hereda a su ficha, sin
  -- pisar lo que ya supiera el registro maestro.
  UPDATE nucleo.personas p
     SET es_cristiano = COALESCE(p.es_cristiano,
           CASE n.es_cristiano WHEN 'si' THEN 'si' WHEN 'no' THEN 'no' WHEN 'duda' THEN 'en_proceso' END::nucleo.es_cristiano)
    FROM crm.nuevos_registros n
   WHERE n.id = p_nuevo_id AND p.id = v_persona;

  IF p_grupo_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM grupos.membresias
        WHERE grupo_id = p_grupo_id AND persona_id = v_persona AND fecha_salida IS NULL) THEN
    INSERT INTO grupos.membresias (grupo_id, persona_id, fecha_ingreso)
    VALUES (p_grupo_id, v_persona, COALESCE(p_fecha_decision, CURRENT_DATE));
  END IF;

  -- El padrino es quien acompaña el 4C: pasa a ser el responsable.
  IF p_padrino_id IS NOT NULL THEN
    UPDATE crm.recorrido SET responsable_id = p_padrino_id
     WHERE persona_id = v_persona AND salio_en IS NULL;
  END IF;

  RETURN v_persona;
END $$;
GRANT EXECUTE ON FUNCTION crm.convertir_en_miembro(uuid, uuid, text, uuid, uuid, date) TO casaroca_app;


-- ═══════════════════════════════════════════════════════════════════
-- 4 · NOTIFICACIONES · la bandeja de salida (correo y SMS)
-- ═══════════════════════════════════════════════════════════════════
-- Los dos documentos piden avisos: bienvenida al nuevo, aviso al
-- coordinador, confirmación al convertirse, confirmación del pago en
-- línea y el certificado expedido.
--
-- ⛔ La base NO envía correos. Los ENCOLA, en la misma transacción que el
--    hecho que los causa: si el registro se revierte, el aviso también.
--    Un trabajador (la API, o un Cloud Run Job en producción) los toma y
--    los manda por SendGrid. Si no hay clave de SendGrid, se quedan
--    pendientes: nada se pierde, nada sale por error desde desarrollo.
CREATE TYPE plataforma.estado_notificacion AS ENUM ('pendiente','enviada','fallida','descartada');

CREATE TABLE plataforma.notificaciones (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id        uuid NOT NULL REFERENCES org.sedes(id),
  persona_id     uuid REFERENCES nucleo.personas(id),
  destinatario   text NOT NULL,
  canal          plataforma.canal_contacto NOT NULL,
  plantilla      text NOT NULL CHECK (plantilla IN (
                   'Bienvenida_nuevo','Notificacion_coordinador','Confirmacion_miembro',
                   'Confirmacion_aporte','Certificado_expedido')),
  datos          jsonb NOT NULL DEFAULT '{}',
  origen_modulo  text NOT NULL,
  origen_id      text,
  estado         plataforma.estado_notificacion NOT NULL DEFAULT 'pendiente',
  intentos       smallint NOT NULL DEFAULT 0,
  ultimo_error   text,
  proveedor_id   text,
  creada_en      timestamptz NOT NULL DEFAULT now(),
  enviada_en     timestamptz,
  CHECK ((estado = 'enviada') = (enviada_en IS NOT NULL))
);
CREATE INDEX notificaciones_pendientes_idx ON plataforma.notificaciones (creada_en)
  WHERE estado = 'pendiente';

-- ⛔ Leer la bandeja exige N3: un aviso de pago lleva el monto. Nadie
--    escribe directo: solo las funciones de abajo, que son la puerta.
ALTER TABLE plataforma.notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE plataforma.notificaciones FORCE  ROW LEVEL SECURITY;
CREATE POLICY notificaciones_sel ON plataforma.notificaciones FOR SELECT
  USING (plataforma.ctx_nivel_max() >= 3 AND plataforma.sede_visible(sede_id));
GRANT SELECT ON plataforma.notificaciones TO casaroca_app;
INSERT INTO plataforma.clasificacion_columna (esquema, tabla, columna, nivel, finalidad, mecanismo) VALUES
  ('plataforma','notificaciones','destinatario', 2, 'convocatoria',   'rls_y_bitacora'),
  ('plataforma','notificaciones','datos',        3, 'administrativa', 'rls_y_bitacora')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION plataforma.encolar_notificacion(
  p_sede uuid, p_persona uuid, p_destinatario text, p_canal plataforma.canal_contacto,
  p_plantilla text, p_datos jsonb, p_modulo text, p_origen text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = plataforma, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  IF p_destinatario IS NULL OR btrim(p_destinatario) = '' THEN
    RETURN NULL;   -- sin a quién escribir no hay aviso, y no es un error
  END IF;
  INSERT INTO plataforma.notificaciones
    (sede_id, persona_id, destinatario, canal, plantilla, datos, origen_modulo, origen_id)
  VALUES (p_sede, p_persona, btrim(p_destinatario), p_canal, p_plantilla,
          COALESCE(p_datos,'{}'), p_modulo, p_origen)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION plataforma.encolar_notificacion(uuid,uuid,text,plataforma.canal_contacto,text,jsonb,text,text) FROM PUBLIC;

-- El trabajador toma un lote SIN que dos trabajadores tomen el mismo aviso
-- (SKIP LOCKED) y lo marca después. Cinco intentos y se da por fallido.
CREATE OR REPLACE FUNCTION plataforma.tomar_notificaciones(p_limite integer)
RETURNS SETOF plataforma.notificaciones
LANGUAGE sql SECURITY DEFINER SET search_path = plataforma, pg_temp AS $$
  UPDATE plataforma.notificaciones n
     SET intentos = n.intentos + 1
   WHERE n.id IN (SELECT id FROM plataforma.notificaciones
                   WHERE estado = 'pendiente' AND intentos < 5
                   ORDER BY creada_en
                   LIMIT GREATEST(1, LEAST(p_limite, 100))
                   FOR UPDATE SKIP LOCKED)
  RETURNING n.*;
$$;

CREATE OR REPLACE FUNCTION plataforma.marcar_notificacion(
  p_id uuid, p_enviada boolean, p_error text, p_proveedor_id text
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = plataforma, pg_temp AS $$
  UPDATE plataforma.notificaciones
     SET estado       = CASE WHEN p_enviada THEN 'enviada'
                             WHEN intentos >= 5 THEN 'fallida'
                             ELSE 'pendiente' END::plataforma.estado_notificacion,
         enviada_en   = CASE WHEN p_enviada THEN now() END,
         ultimo_error = CASE WHEN p_enviada THEN NULL ELSE p_error END,
         proveedor_id = COALESCE(p_proveedor_id, proveedor_id)
   WHERE id = p_id;
$$;
GRANT EXECUTE ON FUNCTION plataforma.tomar_notificaciones(integer) TO casaroca_app;
GRANT EXECUTE ON FUNCTION plataforma.marcar_notificacion(uuid, boolean, text, text) TO casaroca_app;

-- Correo de una persona, por la puerta: el disparador corre en el
-- contexto público del formulario y no ve el registro maestro.
CREATE OR REPLACE FUNCTION plataforma.correo_de(p_persona uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = nucleo, pg_temp AS $$
  SELECT email_principal::text FROM nucleo.personas WHERE id = p_persona AND eliminado_en IS NULL;
$$;
REVOKE ALL ON FUNCTION plataforma.correo_de(uuid) FROM PUBLIC;

-- Paso 10 del flujo de Nuevos: bienvenida + aviso al coordinador.
-- La bienvenida responde a la solicitud que la persona acaba de hacer:
-- es atender su pedido (Ley 1581, art. 10), no una campaña.
CREATE OR REPLACE FUNCTION crm.tg_nuevo_avisos() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = crm, plataforma, pg_temp AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    PERFORM plataforma.encolar_notificacion(NEW.sede_id, NULL, NEW.email::text, 'email',
      'Bienvenida_nuevo', jsonb_build_object('nombre', NEW.nombre), 'nuevos', NEW.id::text);
  END IF;
  IF NEW.coordinador_id IS NOT NULL THEN
    PERFORM plataforma.encolar_notificacion(NEW.sede_id, NEW.coordinador_id,
      plataforma.correo_de(NEW.coordinador_id), 'email', 'Notificacion_coordinador',
      jsonb_build_object('nuevo_id', NEW.id, 'nombre', NEW.nombre, 'como_supo', NEW.como_supo),
      'nuevos', NEW.id::text);
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_nuevo_avisos AFTER INSERT ON crm.nuevos_registros
  FOR EACH ROW EXECUTE FUNCTION crm.tg_nuevo_avisos();

CREATE OR REPLACE FUNCTION crm.tg_nuevo_convertido_aviso() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = crm, plataforma, pg_temp AS $$
BEGIN
  IF NEW.estado = 'convertido' AND OLD.estado IS DISTINCT FROM 'convertido' THEN
    PERFORM plataforma.encolar_notificacion(NEW.sede_id, NEW.persona_id,
      COALESCE(plataforma.correo_de(NEW.persona_id), NEW.email::text), 'email',
      'Confirmacion_miembro', jsonb_build_object('nombre', NEW.nombre), 'nuevos', NEW.id::text);
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_nuevo_convertido_aviso AFTER UPDATE OF estado ON crm.nuevos_registros
  FOR EACH ROW EXECUTE FUNCTION crm.tg_nuevo_convertido_aviso();


-- ═══════════════════════════════════════════════════════════════════
-- 5 · DONACIONES · valores, anulación, auditoría y avisos
-- ═══════════════════════════════════════════════════════════════════
-- Valores que el documento nombra y la base no tenía.
ALTER TYPE aportes.tipo_aporte ADD VALUE IF NOT EXISTS 'donacion';
ALTER TYPE aportes.medio_pago  ADD VALUE IF NOT EXISTS 'consignacion';
ALTER TYPE aportes.medio_pago  ADD VALUE IF NOT EXISTS 'otro';

-- 🔴 HALLAZGO AL CONTRASTAR: el certificado lleva el TOTAL de lo que una
--    persona aportó en el año, que es N3. Su política solo miraba la sede,
--    así que cualquier sesión N2 de esa sede podía leerlo aunque no
--    pudiera ver ni un aporte suelto. Se iguala a la de `aportes.aportes`.
DROP POLICY aportes_certificados_sel ON aportes.certificados;
DROP POLICY aportes_certificados_upd ON aportes.certificados;
CREATE POLICY aportes_certificados_sel ON aportes.certificados FOR SELECT
  USING (plataforma.ctx_nivel_max() >= 3 AND plataforma.sede_visible(sede_id));
CREATE POLICY aportes_certificados_upd ON aportes.certificados FOR UPDATE
  USING (plataforma.ctx_nivel_max() >= 3 AND plataforma.sede_visible(sede_id))
  WITH CHECK (plataforma.ctx_nivel_max() >= 3 AND plataforma.sede_visible(sede_id));

-- «Toda generación de certificados debe insertar una fila inmutable en
-- auditoria_donaciones». Los aportes ya se auditaban; los certificados no.
CREATE TRIGGER trg_auditar_certificados AFTER INSERT OR UPDATE OR DELETE ON aportes.certificados
  FOR EACH ROW EXECUTE FUNCTION plataforma.tg_auditar();

-- Anulación de certificado (documento: «notas de anulación de certificado
-- gestionadas únicamente por Tesorería»). El congelamiento de los aportes
-- se levanta SOLO para los aportes de ESE certificado y SOLO dentro de
-- esta función: la marca vive en la transacción (`set_config(..., true)`).
CREATE OR REPLACE FUNCTION aportes.tg_certificado_congela() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.estado = 'certificado' THEN
    IF OLD.certificado_id::text = current_setting('app.anulando_certificado', true)
       AND NEW.estado = 'confirmado' AND NEW.certificado_id IS NULL
       AND NEW.monto = OLD.monto AND NEW.fecha = OLD.fecha
       AND NEW.persona_id IS NOT DISTINCT FROM OLD.persona_id THEN
      RETURN NEW;   -- se libera para poder certificarse de nuevo, sin tocar nada más
    END IF;
    IF NEW.monto <> OLD.monto OR NEW.fecha <> OLD.fecha
       OR NEW.persona_id IS DISTINCT FROM OLD.persona_id
       OR NEW.estado <> OLD.estado THEN
      RAISE EXCEPTION 'El aporte % está incluido en un certificado expedido: no se puede modificar', OLD.id
        USING ERRCODE = 'check_violation',
              HINT = 'Si el certificado tiene un error, se anula el certificado con motivo y se expide uno nuevo.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION aportes.anular_certificado(p_id uuid, p_motivo text, p_anulado_por uuid)
RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE v_n integer;
BEGIN
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Anular un certificado exige motivo escrito' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE aportes.certificados
     SET estado = 'anulado', anulado_en = now(), anulado_motivo = btrim(p_motivo)
   WHERE id = p_id AND estado = 'expedido';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe ese certificado, no es de su sede o ya estaba anulado'
      USING ERRCODE = 'no_data_found';
  END IF;

  PERFORM set_config('app.anulando_certificado', p_id::text, true);
  UPDATE aportes.aportes SET estado = 'confirmado', certificado_id = NULL
   WHERE certificado_id = p_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  PERFORM set_config('app.anulando_certificado', '', true);
  RETURN v_n;
END $$;
GRANT EXECUTE ON FUNCTION aportes.anular_certificado(uuid, text, uuid) TO casaroca_app;

-- Caso 1 del documento: «el sistema envía automáticamente la confirmación
-- al correo del donante». Y el certificado expedido, a su titular.
CREATE OR REPLACE FUNCTION aportes.tg_aporte_confirmado_aviso() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = aportes, plataforma, pg_temp AS $$
BEGIN
  IF NEW.persona_id IS NOT NULL AND NEW.estado = 'confirmado'
     AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM 'confirmado')
     AND NEW.fuente IN ('online','pasarela') THEN
    PERFORM plataforma.encolar_notificacion(NEW.sede_id, NEW.persona_id,
      plataforma.correo_de(NEW.persona_id), 'email', 'Confirmacion_aporte',
      jsonb_build_object('aporte_id', NEW.id, 'monto', NEW.monto, 'moneda', NEW.moneda,
                         'fecha', NEW.fecha, 'tipo', NEW.tipo),
      'aportes', NEW.id::text);
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_aporte_confirmado_aviso AFTER INSERT OR UPDATE OF estado ON aportes.aportes
  FOR EACH ROW EXECUTE FUNCTION aportes.tg_aporte_confirmado_aviso();

CREATE OR REPLACE FUNCTION aportes.tg_certificado_aviso() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = aportes, plataforma, pg_temp AS $$
BEGIN
  PERFORM plataforma.encolar_notificacion(NEW.sede_id, NEW.persona_id,
    plataforma.correo_de(NEW.persona_id), 'email', 'Certificado_expedido',
    jsonb_build_object('certificado_id', NEW.id, 'numero', NEW.numero,
                       'desde', NEW.periodo_desde, 'hasta', NEW.periodo_hasta),
    'aportes', NEW.id::text);
  RETURN NULL;
END $$;
CREATE TRIGGER trg_certificado_aviso AFTER INSERT ON aportes.certificados
  FOR EACH ROW EXECUTE FUNCTION aportes.tg_certificado_aviso();


-- ═══════════════════════════════════════════════════════════════════
-- 6 · ESQUEMA `modelo100p` · el modelo del Drive, con SUS nombres
-- ═══════════════════════════════════════════════════════════════════
-- ⭐ Jhon construye el frontend contra SU documento. Estas vistas le
--    entregan exactamente las tablas y columnas que él escribió
--    (`personas.documento`, `vinculos_personas.persona_id_1`,
--    `donaciones.metodo_pago`, `usuario_roles.sede_id`…) leyendo de la
--    base real. Nada se copia: si cambia la base, cambia la vista.
-- ⛔ Todas llevan `security_invoker`: la RLS de cada sede y de cada nivel
--    sigue aplicando igual que si se consultara la tabla (regla de 0025).
-- ⛔ Son de SOLO LECTURA. Escribir pasa por la API, que es donde viven
--    las reglas de negocio.
CREATE SCHEMA modelo100p;
COMMENT ON SCHEMA modelo100p IS
  'El modelo de datos del Drive «Sistema 100p» (Usuarios v1.2, Roles, Nuevos, Donaciones) publicado con sus nombres sobre la base real. Solo lectura.';

-- ── Usuarios (Personas) v1.2 ────────────────────────────────────────
CREATE VIEW modelo100p.personas WITH (security_invoker = true) AS
SELECT p.id,
       p.numero_documento                         AS documento,
       p.tipo_documento,
       btrim(p.primer_nombre||' '||COALESCE(p.segundo_nombre||' ','')||p.primer_apellido
             ||' '||COALESCE(p.segundo_apellido,''))  AS nombre_completo,
       p.nombre_corto,
       p.genero::text                             AS genero,
       p.fecha_nacimiento,
       nucleo.edad(p.fecha_nacimiento)            AS edad,
       upper(p.estado_civil::text)                AS estado_civil,
       p.nacionalidad,
       p.pais_residencia,
       p.ciudad_residencia,
       p.zona,
       p.email_principal,
       p.email_secundario,
       p.telefono_movil                           AS telefono_celular,
       p.telefono_fijo,
       p.telefono_emergencia,
       -- ⭐ DERIVADO del consentimiento, no almacenado: un booleano suelto
       --    diría «sí» después de que la persona lo revocó.
       plataforma.puede_contactar(p.id, 'whatsapp', 'convocatoria') AS permite_whatsapp,
       p.direccion                                AS direccion_calle,
       p.ciudad_residencia                        AS direccion_ciudad,
       upper(p.es_cristiano::text)                AS es_cristiano,
       p.fecha_conversion,
       p.iglesia_anterior,
       p.ha_sido_bautizado,
       p.fecha_bautismo,
       p.es_ministro,
       upper(p.nivel_compromiso::text)            AS nivel_compromiso,
       p.foto_url,
       (SELECT v.relacionada_id FROM nucleo.vinculos v
         WHERE v.persona_id = p.id AND v.tipo = 'CONYUGE' AND v.vigente_hasta IS NULL
         LIMIT 1)                                 AS conyuge_id,
       (SELECT a.acudiente_id FROM nucleo.acudientes a
         WHERE a.menor_id = p.id AND a.es_principal AND a.vigente_hasta IS NULL
         LIMIT 1)                                 AS acudiente_id,
       upper(p.estado::text)                      AS estado_persona,
       p.en_directorio_publico,
       -- «consentimiento_gdpr»: en Colombia manda la Ley 1581. Se conserva
       -- el nombre de su documento para no romperle el contrato, y el valor
       -- sale de la tabla de consentimientos, con su fecha original.
       EXISTS (SELECT 1 FROM plataforma.consentimientos c
                WHERE c.persona_id = p.id AND c.acto = 'otorgado') AS consentimiento_gdpr,
       (SELECT min(c.ocurrido_en) FROM plataforma.consentimientos c
         WHERE c.persona_id = p.id AND c.acto = 'otorgado')        AS fecha_consentimiento_gdpr,
       p.sede_id,
       p.creado_en                                AS fecha_registro,
       p.actualizado_en                           AS ultima_actualizacion
  FROM nucleo.personas p
 WHERE p.eliminado_en IS NULL;

CREATE VIEW modelo100p.vinculos_personas WITH (security_invoker = true) AS
SELECT v.id,
       v.persona_id     AS persona_id_1,
       v.relacionada_id AS persona_id_2,
       v.tipo           AS tipo_relacion,
       v.vigente_desde  AS fecha_inicio,
       v.vigente_hasta  AS fecha_fin,
       v.creado_en      AS fecha_registro
  FROM nucleo.vinculos v;

-- La tabla se llamaba `minores` en su documento; en español es `menores`.
-- Se publican las dos para no romperle nada mientras lo corrige.
CREATE VIEW modelo100p.menores WITH (security_invoker = true) AS
SELECT p.id                                          AS persona_id,
       (SELECT a.acudiente_id FROM nucleo.acudientes a
         WHERE a.menor_id = p.id AND a.es_principal AND a.vigente_hasta IS NULL
         LIMIT 1)                                    AS acudiente_principal_id,
       COALESCE(rocakids.autorizado(p.id, 'foto'),    false) AS autorizacion_foto,
       COALESCE(rocakids.autorizado(p.id, 'eventos'), false) AS autorizacion_eventos,
       COALESCE(rocakids.autorizado(p.id, 'retiros'), false) AS autorizacion_retiros,
       NOT nucleo.es_menor(p.fecha_nacimiento)       AS es_mayor_18
  FROM nucleo.personas p
 WHERE p.eliminado_en IS NULL AND nucleo.es_menor(p.fecha_nacimiento);
CREATE VIEW modelo100p.minores WITH (security_invoker = true) AS
SELECT * FROM modelo100p.menores;

-- ── Roles v1.0 ──────────────────────────────────────────────────────
CREATE VIEW modelo100p.roles WITH (security_invoker = true) AS
SELECT r.codigo                   AS id,
       r.codigo,
       r.nombre,
       r.descripcion,
       r.nivel_maximo             AS sensibilidad_maxima,
       upper(r.alcance_maximo::text) AS alcance_default,
       r.activo
  FROM identidad.roles r;

CREATE VIEW modelo100p.usuario_roles WITH (security_invoker = true) AS
SELECT a.id,
       a.persona_id               AS usuario_id,
       a.rol                      AS rol_id,
       CASE WHEN a.alcance_tipo = 'sede' THEN a.alcance_id END AS sede_id,
       upper(a.alcance_tipo::text) AS alcance,
       a.alcance_id,
       a.nivel_max                AS sensibilidad,
       a.vigente_desde            AS fecha_inicio,
       a.vigente_hasta            AS fecha_fin,
       a.otorgado_por             AS usuario_asignacion_id,
       a.creado_en                AS "timestamp"
  FROM identidad.asignaciones a;

CREATE VIEW modelo100p.permisos_por_rol WITH (security_invoker = true) AS
SELECT p.rol                      AS rol_id,
       p.accion                   AS permiso_codigo,
       upper(p.modulo)            AS modulo,
       ac.descripcion,
       true                       AS activo,
       p.definido_en              AS "timestamp"
  FROM sistema.matriz_permisos p
  LEFT JOIN sistema.acciones ac ON ac.codigo = p.accion;

-- ── Nuevos v1.0 ─────────────────────────────────────────────────────
CREATE VIEW modelo100p.nuevos_registros WITH (security_invoker = true) AS
SELECT n.id, n.nombre, n.email, n.telefono, n.como_supo, n.es_cristiano, n.comentarios,
       n.sede_id                  AS sede,
       n.registrado_en            AS fecha_registro,
       CASE n.estado WHEN 'en_seguimiento' THEN 'seguimiento'
                     WHEN 'convertido'     THEN 'decidido'
                     WHEN 'no_interesado'  THEN 'inactivo'
                     ELSE n.estado::text END AS estado,
       n.coordinador_id           AS coordinador_asignado_id,
       n.proximo_contacto         AS fecha_siguiente_contacto,
       n.fuente                   AS fuente_registro,
       n.persona_id               AS persona_id_vinculada
  FROM crm.nuevos_registros n;

CREATE VIEW modelo100p.contactos_nuevos WITH (security_invoker = true) AS
SELECT c.id, c.nuevo_id, c.coordinador_id,
       c.ocurrido_en              AS fecha_contacto,
       c.tipo                     AS tipo_contacto,
       c.resumen, c.reaccion, c.siguiente_paso,
       c.registrado_en            AS "timestamp"
  FROM crm.contactos_nuevos c;

CREATE VIEW modelo100p.seguimiento_nuevos WITH (security_invoker = true) AS
SELECT n.id                       AS nuevo_id,
       (SELECT count(*) FROM crm.contactos_nuevos c WHERE c.nuevo_id = n.id) AS cantidad_contactos,
       (SELECT max(c.ocurrido_en) FROM crm.contactos_nuevos c WHERE c.nuevo_id = n.id) AS ultima_interaccion,
       (SELECT c.siguiente_paso FROM crm.contactos_nuevos c WHERE c.nuevo_id = n.id
         ORDER BY c.ocurrido_en DESC LIMIT 1) AS proxima_accion,
       n.prioridad,
       -- La RLS de las notas decide: aquí solo aparecen las que usted puede ver.
       (SELECT string_agg(np.nota, E'\n' ORDER BY np.creada_en)
          FROM crm.notas_privadas_nuevos np WHERE np.nuevo_id = n.id) AS notas_privadas,
       n.fecha_decision           AS fecha_conversion
  FROM crm.nuevos_registros n;

CREATE VIEW modelo100p.integracion_personas WITH (security_invoker = true) AS
SELECT n.id                       AS nuevo_id,
       n.persona_id,
       n.convertido_en            AS fecha_integracion,
       CASE p.estado WHEN 'activa' THEN 'activo' WHEN 'trasladada' THEN 'trasladado' ELSE 'inactivo' END AS estado_miembro,
       n.grupo_asignado_id,
       g.nombre                   AS grupo_asignado,
       n.padrino_id
  FROM crm.nuevos_registros n
  LEFT JOIN nucleo.personas p ON p.id = n.persona_id
  LEFT JOIN grupos.grupos   g ON g.id = n.grupo_asignado_id
 WHERE n.estado = 'convertido';

-- ── Donaciones v1.0 ─────────────────────────────────────────────────
CREATE VIEW modelo100p.donaciones WITH (security_invoker = true) AS
SELECT a.id, a.persona_id,
       upper(a.tipo::text)        AS tipo_aporte,
       a.monto,
       upper(a.medio::text)       AS metodo_pago,
       a.fecha                    AS fecha_aporte,
       a.referencia,
       CASE WHEN a.anulado_en IS NOT NULL THEN 'ANULADO' ELSE upper(a.estado::text) END AS estado,
       (a.estado = 'certificado') AS inmutable,
       a.certificado_id,
       upper(a.fuente)            AS fuente,
       a.registrado_en            AS fecha_registro,
       a.registrado_por           AS usuario_registro_id,
       a.sede_id, a.moneda, a.fondo_id, a.es_anonimo
  FROM aportes.aportes a;

CREATE VIEW modelo100p.certificados WITH (security_invoker = true) AS
SELECT c.id,
       c.numero                   AS numero_certificado,
       c.persona_id,
       c.periodo_desde            AS fecha_inicio,
       c.periodo_hasta            AS fecha_fin,
       c.total                    AS total_certificado,
       c.cantidad_aportes,
       upper(c.estado)            AS estado,
       c.url_pdf,
       c.expedido_en              AS fecha_expedicion,
       c.expedido_por             AS usuario_expedicion_id,
       c.anulado_motivo           AS motivo_anulacion,
       c.sede_id, c.moneda
  FROM aportes.certificados c;

-- ── Las tres auditorías ─────────────────────────────────────────────
-- `plataforma.auditoria` es UNA bitácora para todo el sistema y la
-- aplicación no la lee directo. Estas funciones son la puerta: filtran por
-- sede y por nivel igual que la RLS, y devuelven solo su tabla.
CREATE OR REPLACE FUNCTION modelo100p.fn_auditoria(p_esquema text, p_tabla text, p_nivel smallint)
RETURNS SETOF plataforma.auditoria
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = plataforma, pg_temp AS $$
  SELECT a.* FROM plataforma.auditoria a
   WHERE a.esquema = p_esquema AND a.tabla = p_tabla
     AND plataforma.ctx_nivel_max() >= p_nivel
     AND (plataforma.ctx_es_global()
          OR plataforma.sede_visible(NULLIF(COALESCE(a.valor_nuevo->>'sede_id', a.valor_anterior->>'sede_id'),'')::uuid));
$$;
GRANT EXECUTE ON FUNCTION modelo100p.fn_auditoria(text, text, smallint) TO casaroca_app;

-- Una fila por CAMPO cambiado, como la pide el documento de Usuarios
-- (campo_modificado, valor_anterior, valor_nuevo).
CREATE VIEW modelo100p.auditoria_personas WITH (security_invoker = true) AS
SELECT a.id,
       a.fila_id::uuid            AS persona_id,
       CASE a.operacion WHEN 'I' THEN 'CREACION' WHEN 'D' THEN 'ELIMINACION' ELSE 'ACTUALIZACION' END AS tipo_cambio,
       k.campo                    AS campo_modificado,
       a.valor_anterior ->> k.campo AS valor_anterior,
       a.valor_nuevo    ->> k.campo AS valor_nuevo,
       a.actor_id                 AS usuario_id,
       a.ocurrido_en              AS fecha_cambio,
       a.actor_ip                 AS ip_usuario
  FROM modelo100p.fn_auditoria('nucleo','personas',2::smallint) a
  CROSS JOIN LATERAL (
    SELECT key AS campo FROM jsonb_object_keys(COALESCE(a.valor_nuevo, a.valor_anterior)) key
     WHERE a.operacion <> 'U'
        OR (a.valor_anterior -> key) IS DISTINCT FROM (a.valor_nuevo -> key)
  ) k
 WHERE k.campo NOT IN ('actualizado_en','creado_en');

CREATE VIEW modelo100p.auditoria_roles WITH (security_invoker = true) AS
SELECT a.id,
       COALESCE(a.valor_nuevo->>'rol', a.valor_anterior->>'rol') AS rol_id,
       CASE WHEN a.operacion = 'I' THEN 'ASIGNACION'
            WHEN a.operacion = 'U' AND a.valor_nuevo->>'vigente_hasta' IS NOT NULL
                 AND a.valor_anterior->>'vigente_hasta' IS NULL THEN 'VENCIMIENTO'
            ELSE 'CAMBIO_PERMISO' END AS tipo_cambio,
       a.actor_id                 AS usuario_id,
       a.ocurrido_en              AS fecha_cambio,
       jsonb_build_object('antes', a.valor_anterior, 'despues', a.valor_nuevo)::text AS detalles
  FROM modelo100p.fn_auditoria('identidad','asignaciones',2::smallint) a;

CREATE VIEW modelo100p.auditoria_donaciones WITH (security_invoker = true) AS
SELECT a.id,
       a.fila_id::uuid            AS donacion_id,
       a.tabla                    AS sobre,
       CASE WHEN a.operacion = 'I' AND a.tabla = 'certificados' THEN 'CERTIFICACION'
            WHEN a.operacion = 'I' THEN 'CREACION'
            WHEN a.valor_nuevo->>'anulado_en' IS NOT NULL
                 AND a.valor_anterior->>'anulado_en' IS NULL THEN 'ANULACION'
            WHEN a.valor_nuevo->>'estado' = 'certificado'
                 AND a.valor_anterior->>'estado' IS DISTINCT FROM 'certificado' THEN 'BLOQUEO'
            ELSE 'ACTUALIZACION' END AS tipo_cambio,
       a.valor_anterior::text     AS valor_anterior,
       a.valor_nuevo::text        AS valor_nuevo,
       a.actor_id                 AS usuario_id,
       a.ocurrido_en              AS fecha_cambio,
       COALESCE(a.valor_nuevo->>'anulado_motivo', a.valor_anterior->>'anulado_motivo') AS motivo,
       a.actor_ip                 AS ip_usuario
  FROM (SELECT * FROM modelo100p.fn_auditoria('aportes','aportes',3::smallint)
        UNION ALL
        SELECT * FROM modelo100p.fn_auditoria('aportes','certificados',3::smallint)) a;

GRANT USAGE ON SCHEMA modelo100p TO casaroca_app;
GRANT SELECT ON ALL TABLES IN SCHEMA modelo100p TO casaroca_app;
