-- =====================================================================
-- 0055 · EL AVISO NO BLOQUEA EL NEGOCIO
--
-- ⛔ HALLAZGO DEL 19 DE SEPTIEMBRE DE 2026, encontrado por el banco de la
--    API (probar-api-drive.sh) al revivirlo. Convertir en miembro a alguien
--    que NO marcó la casilla de autorización devolvía un error y NO LO
--    CONVERTÍA. La cadena era:
--
--      convertir_en_miembro → UPDATE estado='convertido'
--        → tg_nuevo_convertido_aviso → encolar_notificacion(...,'email')
--          → tg_notificacion_exige_consentimiento → EXCEPTION
--            → toda la transacción se deshace
--
--    Eso está mal por dos razones distintas, y las dos importan:
--
--    1. DE NEGOCIO: un aviso que no se puede enviar no puede tumbar el acto
--       que lo originó. La persona SE CONVIRTIÓ; lo que no se puede es
--       escribirle. Con la versión anterior, quien no autorizaba correo
--       simplemente no podía entrar al sistema.
--
--    2. DE LEY: la Ley 1581/2012 no exige consentimiento para todo. El
--       propio modelo ya lo sabe: `plataforma.finalidades.base_legal`
--       distingue consentimiento, contrato, obligación legal e interés
--       vital. El disparador IGNORABA esa columna y exigía consentimiento
--       para todo salvo «emergencia»: es decir, exigía permiso de mercadeo
--       para mandarle a alguien SU PROPIO certificado de donación, que es
--       un trámite que él mismo pidió (base legal: contrato).
--
--    Lo que esta migración cambia:
--      · El consentimiento se exige SOLO cuando la finalidad se apoya en el
--        consentimiento. Lo transaccional (certificados, recibos, respuesta
--        al formulario que la persona misma llenó) pasa por «contrato».
--      · Lo que NO se pudo enviar QUEDA ESCRITO en `avisos_no_enviados`
--        con su motivo, en vez de desaparecer o de reventar la operación.
--        (Principio de la Maestría: registrar lo no atendido.)
--      · `notificaciones.finalidad` deja de poder ser NULL: por omisión es
--        «convocatoria», la más estricta. Quien quiera lo transaccional lo
--        declara, y queda escrito.
-- =====================================================================

BEGIN;

-- ── 1. El registro de lo que NO se envió ─────────────────────────────
CREATE TABLE IF NOT EXISTS plataforma.avisos_no_enviados (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id        uuid NOT NULL REFERENCES org.sedes(id),
  persona_id     uuid REFERENCES nucleo.personas(id),
  destinatario   text,
  canal          plataforma.canal_contacto NOT NULL,
  plantilla      text NOT NULL,
  finalidad      text NOT NULL REFERENCES plataforma.finalidades(codigo),
  motivo         text NOT NULL,
  origen_modulo  text,
  origen_id      text,
  ocurrido_en    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE plataforma.avisos_no_enviados IS
  'Avisos que el sistema decidió NO enviar, con su motivo. Es la prueba de '
  'que no se contactó a quien no autorizó, y la bandeja de lo que quedó sin atender.';

-- ⛔ Toda clave foránea con índice (compuerta de la migración 0054).
CREATE INDEX IF NOT EXISTS avisos_no_enviados_sede_idx    ON plataforma.avisos_no_enviados (sede_id, ocurrido_en DESC);
CREATE INDEX IF NOT EXISTS avisos_no_enviados_persona_idx ON plataforma.avisos_no_enviados (persona_id);
CREATE INDEX IF NOT EXISTS avisos_no_enviados_final_idx   ON plataforma.avisos_no_enviados (finalidad);

-- Se lee con el mismo techo que las notificaciones (N3), y solo de su sede.
ALTER TABLE plataforma.avisos_no_enviados ENABLE ROW LEVEL SECURITY;
ALTER TABLE plataforma.avisos_no_enviados FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS avisos_no_enviados_sel ON plataforma.avisos_no_enviados;
CREATE POLICY avisos_no_enviados_sel ON plataforma.avisos_no_enviados
  FOR SELECT USING (plataforma.ctx_nivel_max() >= 3 AND plataforma.sede_visible(sede_id));
DROP POLICY IF EXISTS avisos_no_enviados_ins ON plataforma.avisos_no_enviados;
CREATE POLICY avisos_no_enviados_ins ON plataforma.avisos_no_enviados
  FOR INSERT WITH CHECK (plataforma.sede_visible(sede_id));
GRANT SELECT, INSERT ON plataforma.avisos_no_enviados TO casaroca_app;

-- ── 2. `finalidad` deja de ser opcional ──────────────────────────────
UPDATE plataforma.notificaciones SET finalidad = 'convocatoria' WHERE finalidad IS NULL;
ALTER TABLE plataforma.notificaciones ALTER COLUMN finalidad SET DEFAULT 'convocatoria';
ALTER TABLE plataforma.notificaciones ALTER COLUMN finalidad SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid='plataforma.notificaciones'::regclass
                    AND conname='notificaciones_finalidad_fkey') THEN
    ALTER TABLE plataforma.notificaciones
      ADD CONSTRAINT notificaciones_finalidad_fkey
      FOREIGN KEY (finalidad) REFERENCES plataforma.finalidades(codigo);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS notificaciones_finalidad_idx ON plataforma.notificaciones (finalidad);

-- ── 3. El consentimiento se exige donde la ley lo exige ──────────────
CREATE OR REPLACE FUNCTION plataforma.tg_notificacion_exige_consentimiento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = plataforma, nucleo, pg_temp AS $$
DECLARE v_fin text; v_base text;
BEGIN
  -- Sin persona (avisos operativos a un correo funcional) no aplica.
  IF NEW.persona_id IS NULL THEN RETURN NEW; END IF;

  v_fin := COALESCE(NEW.finalidad, 'convocatoria');
  SELECT base_legal INTO v_base FROM plataforma.finalidades WHERE codigo = v_fin;
  IF v_base IS NULL THEN
    RAISE EXCEPTION 'Finalidad desconocida «%»: no se envía lo que no se sabe por qué se envía', v_fin
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- ⛔ A quien fue suprimido o falleció NO se le escribe, sea cual sea la
  --    base legal. Esto va PRIMERO: es el freno que nunca se levanta.
  IF EXISTS (SELECT 1 FROM nucleo.personas p
             WHERE p.id = NEW.persona_id
               AND (p.eliminado_en IS NOT NULL OR p.estado::text = 'fallecida')) THEN
    RAISE EXCEPTION 'Esa persona esta dada de baja o fallecida: no se le envian avisos'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Contrato, obligación legal e interés vital NO piden consentimiento
  -- (Ley 1581/2012, art. 10). Solo lo pide lo que se apoya en él.
  IF v_base <> 'consentimiento' THEN RETURN NEW; END IF;

  IF NOT plataforma.puede_contactar(NEW.persona_id, NEW.canal, v_fin) THEN
    RAISE EXCEPTION
      'No hay consentimiento vigente de esa persona para % por %. Sin registro, no se contacta.',
      v_fin, NEW.canal USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END $$;

-- ── 4. Encolar declarando la finalidad ───────────────────────────────
-- Se borran TODAS las firmas: la de 8 argumentos (la original) y la de 9
-- (por si esta migracion se corre dos veces). Sin esto, la segunda corrida
-- choca con «already exists with same argument types».
DROP FUNCTION IF EXISTS plataforma.encolar_notificacion(uuid,uuid,text,plataforma.canal_contacto,text,jsonb,text,text);
DROP FUNCTION IF EXISTS plataforma.encolar_notificacion(uuid,uuid,text,plataforma.canal_contacto,text,jsonb,text,text,text);
CREATE FUNCTION plataforma.encolar_notificacion(
  p_sede uuid, p_persona uuid, p_destinatario text,
  p_canal plataforma.canal_contacto, p_plantilla text, p_datos jsonb,
  p_modulo text, p_origen text, p_finalidad text DEFAULT 'convocatoria')
RETURNS uuid
-- ⛔ SECURITY DEFINER, como la version original de la 0040. La aplicacion
--    solo tiene SELECT sobre `notificaciones`: quien ENCOLA es la base.
--    Recrear la funcion sin esta linea deja «permission denied for table
--    notificaciones» en cada registro del formulario publico.
LANGUAGE plpgsql SECURITY DEFINER SET search_path = plataforma, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  IF p_destinatario IS NULL OR btrim(p_destinatario) = '' THEN
    RETURN NULL;   -- sin a quién escribir no hay aviso, y no es un error
  END IF;
  INSERT INTO plataforma.notificaciones
    (sede_id, persona_id, destinatario, canal, plantilla, datos, origen_modulo, origen_id, finalidad)
  VALUES (p_sede, p_persona, btrim(p_destinatario), p_canal, p_plantilla,
          COALESCE(p_datos,'{}'), p_modulo, p_origen, p_finalidad)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- ── 5. Encolar SIN tumbar la operación que lo originó ────────────────
CREATE OR REPLACE FUNCTION plataforma.encolar_si_puede(
  p_sede uuid, p_persona uuid, p_destinatario text,
  p_canal plataforma.canal_contacto, p_plantilla text, p_datos jsonb,
  p_modulo text, p_origen text, p_finalidad text DEFAULT 'convocatoria')
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = plataforma, pg_temp AS $$
DECLARE v_id uuid;
BEGIN
  BEGIN
    v_id := plataforma.encolar_notificacion(p_sede, p_persona, p_destinatario,
              p_canal, p_plantilla, p_datos, p_modulo, p_origen, p_finalidad);
    RETURN v_id;
  EXCEPTION WHEN check_violation OR foreign_key_violation THEN
    -- ⭐ No se envía, PERO QUEDA ESCRITO. Antes esto tumbaba la conversión
    --    entera: la persona no llegaba a existir por no querer recibir correo.
    -- ⛔ Ni siquiera ESTE apunte puede tumbar la operacion: si el propio
    --    registro falla, se avisa por el log y se sigue. Un aviso que no
    --    sale jamas debe costar una conversion, un aporte o un certificado.
    BEGIN
      INSERT INTO plataforma.avisos_no_enviados
        (sede_id, persona_id, destinatario, canal, plantilla, finalidad, motivo,
         origen_modulo, origen_id)
      VALUES (p_sede, p_persona, btrim(COALESCE(p_destinatario,'')), p_canal, p_plantilla,
              p_finalidad, SQLERRM, p_modulo, p_origen);
    EXCEPTION WHEN others THEN
      RAISE WARNING 'No se pudo anotar el aviso no enviado (%): %', p_plantilla, SQLERRM;
    END;
    RETURN NULL;
  END;
END $$;

COMMENT ON FUNCTION plataforma.encolar_si_puede IS
  'Encola el aviso; si no se puede (sin consentimiento, persona dada de baja), '
  'lo ANOTA en avisos_no_enviados y devuelve NULL. Nunca tumba la transacción '
  'de negocio que lo originó.';

-- ── 6. Los cuatro avisos, con su base legal declarada ────────────────

-- Respuesta al formulario que la persona MISMA llenó, y aviso al
-- coordinador (personal de la iglesia): trámite, no convocatoria.
CREATE OR REPLACE FUNCTION crm.tg_nuevo_avisos() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = crm, plataforma, pg_temp AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    PERFORM plataforma.encolar_si_puede(NEW.sede_id, NULL, NEW.email::text, 'email',
      'Bienvenida_nuevo', jsonb_build_object('nombre', NEW.nombre), 'nuevos', NEW.id::text,
      'administrativa');
  END IF;
  IF NEW.coordinador_id IS NOT NULL THEN
    PERFORM plataforma.encolar_si_puede(NEW.sede_id, NEW.coordinador_id,
      plataforma.correo_de(NEW.coordinador_id), 'email', 'Notificacion_coordinador',
      jsonb_build_object('nuevo_id', NEW.id, 'nombre', NEW.nombre, 'como_supo', NEW.como_supo),
      'nuevos', NEW.id::text, 'administrativa');
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION crm.tg_nuevo_convertido_aviso() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = crm, plataforma, pg_temp AS $$
BEGIN
  IF NEW.estado = 'convertido' AND OLD.estado IS DISTINCT FROM 'convertido' THEN
    PERFORM plataforma.encolar_si_puede(NEW.sede_id, NEW.persona_id,
      COALESCE(plataforma.correo_de(NEW.persona_id), NEW.email::text), 'email',
      'Confirmacion_miembro', jsonb_build_object('nombre', NEW.nombre), 'nuevos', NEW.id::text,
      'administrativa');
  END IF;
  RETURN NULL;
END $$;

-- El recibo de SU propia donación: contrato, no mercadeo.
CREATE OR REPLACE FUNCTION aportes.tg_aporte_confirmado_aviso() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = aportes, plataforma, pg_temp AS $$
BEGIN
  IF NEW.persona_id IS NOT NULL AND NEW.estado = 'confirmado'
     AND (TG_OP = 'INSERT' OR OLD.estado IS DISTINCT FROM 'confirmado')
     AND NEW.fuente IN ('online','pasarela') THEN
    PERFORM plataforma.encolar_si_puede(NEW.sede_id, NEW.persona_id,
      plataforma.correo_de(NEW.persona_id), 'email', 'Confirmacion_aporte',
      jsonb_build_object('aporte_id', NEW.id, 'monto', NEW.monto, 'moneda', NEW.moneda,
                         'fecha', NEW.fecha, 'tipo', NEW.tipo),
      'aportes', NEW.id::text, 'administrativa');
  END IF;
  RETURN NULL;
END $$;

-- El certificado que la persona pidió: trámite solicitado.
CREATE OR REPLACE FUNCTION aportes.tg_certificado_aviso() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = aportes, plataforma, pg_temp AS $$
BEGIN
  PERFORM plataforma.encolar_si_puede(NEW.sede_id, NEW.persona_id,
    plataforma.correo_de(NEW.persona_id), 'email', 'Certificado_expedido',
    jsonb_build_object('certificado_id', NEW.id, 'numero', NEW.numero,
                       'desde', NEW.periodo_desde, 'hasta', NEW.periodo_hasta),
    'aportes', NEW.id::text, 'administrativa');
  RETURN NULL;
END $$;

-- ── 7. La bandeja de lo no atendido, para que alguien la mire ────────
DROP VIEW IF EXISTS plataforma.v_no_atendido;
-- ⛔ `security_invoker` NO es decorativo: sin el, la vista se ejecuta con
--    los permisos de su DUEÑO y SE SALTA el RLS de la tabla que agrega.
--    Es exactamente la fuga del 11 de septiembre, y el banco
--    consola_sistemas la cazo el mismo dia que se escribio esta vista.
CREATE VIEW plataforma.v_no_atendido WITH (security_invoker = true) AS
SELECT a.finalidad, a.canal, a.plantilla, a.motivo,
       count(*) AS cuantos,
       min(a.ocurrido_en) AS desde,
       max(a.ocurrido_en) AS hasta
  FROM plataforma.avisos_no_enviados a
 GROUP BY 1,2,3,4
 ORDER BY count(*) DESC;
GRANT SELECT ON plataforma.v_no_atendido TO casaroca_app;
GRANT EXECUTE ON FUNCTION plataforma.encolar_si_puede(uuid,uuid,text,plataforma.canal_contacto,text,jsonb,text,text,text) TO casaroca_app;
GRANT EXECUTE ON FUNCTION plataforma.encolar_notificacion(uuid,uuid,text,plataforma.canal_contacto,text,jsonb,text,text,text) TO casaroca_app;

SELECT plataforma.publicar_tabla('plataforma.finalidades','catalogo_red',
  'Catalogo de finalidades y su base legal: la aplicacion necesita saber por que puede escribir',
  'migracion 0055 · 19 sep 2026');

COMMIT;
