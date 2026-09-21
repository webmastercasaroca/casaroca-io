-- =====================================================================
-- Migración 0005 — CONSENTIMIENTO · LEY 1581/2012 (Habeas Data)
-- «Un contacto sin consentimiento NO SE PUEDE USAR.»
--
-- Corrige las divergencias nº 5 y nº 6 del modelo del equipo 100p:
--   nº 5  banderas booleanas (`puede_recibir_email`) → tabla append-only
--         con finalidad · canal · evidencia · fecha. Una bandera no guarda
--         la fecha original, y esa fecha es exactamente el requisito legal:
--         un consentimiento recapturado hoy NO cubre el tratamiento de ayer.
--   nº 6  el campo se llamaba `consentimiento_gdpr`. En Colombia manda la
--         Ley 1581. El GDPR aplica solo a las sedes internacionales.
-- =====================================================================

CREATE TYPE plataforma.canal_contacto AS ENUM ('email','sms','whatsapp','llamada','correo_fisico','push');
CREATE TYPE plataforma.acto_consentimiento AS ENUM ('otorgado','revocado');

CREATE TABLE plataforma.finalidades (
  codigo      text PRIMARY KEY,
  nombre      text NOT NULL,
  descripcion text NOT NULL,
  base_legal  text NOT NULL CHECK (base_legal IN ('consentimiento','contrato','obligacion_legal','interes_vital'))
);

INSERT INTO plataforma.finalidades VALUES
  ('pastoral',    'Acompañamiento pastoral',   'Contacto de seguimiento, oración y cuidado.',        'consentimiento'),
  ('convocatoria','Convocatoria a actividades','Invitaciones a servicios, cursos y eventos.',        'consentimiento'),
  ('administrativa','Gestión administrativa',  'Certificados, inscripciones y trámites solicitados.','contrato'),
  ('menores',     'Gestión de menores',        'Autorizaciones y entrega segura en RocaKids.',       'obligacion_legal'),
  ('emergencia',  'Emergencia',                'Contacto ante riesgo para la vida o la salud.',      'interes_vital');

-- ---------------------------------------------------------------------
-- Registro APPEND-ONLY. Cada acto queda; nada se sobrescribe.
-- Revocar es insertar una fila nueva, no borrar la anterior.
-- ---------------------------------------------------------------------
CREATE TABLE plataforma.consentimientos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id    uuid NOT NULL REFERENCES nucleo.personas(id) ON DELETE RESTRICT,
  sede_id       uuid NOT NULL REFERENCES org.sedes(id),
  finalidad     text NOT NULL REFERENCES plataforma.finalidades(codigo),
  canal         plataforma.canal_contacto NOT NULL,
  acto          plataforma.acto_consentimiento NOT NULL,
  -- La fecha del acto ORIGINAL, que puede ser muy anterior a la migración.
  ocurrido_en   timestamptz NOT NULL,
  -- Evidencia: cómo se capturó. Sin esto no es demostrable ante la SIC.
  evidencia_tipo text NOT NULL CHECK (evidencia_tipo IN ('formulario_web','formulario_fisico','verbal_registrado','importado_origen','doble_opt_in')),
  evidencia_ref  text,
  registrado_en timestamptz NOT NULL DEFAULT now(),
  source_system text,
  source_id     text,
  CONSTRAINT consentimiento_no_futuro CHECK (ocurrido_en <= now())
);
CREATE INDEX consentimientos_busqueda_idx
  ON plataforma.consentimientos (persona_id, finalidad, canal, ocurrido_en DESC);

COMMENT ON TABLE plataforma.consentimientos IS
  'Append-only. Revocar = insertar acto=revocado. Nunca se actualiza ni se borra: el histórico ES la prueba legal.';

-- Append-only de verdad, no por convención.
CREATE RULE consentimientos_no_update AS ON UPDATE TO plataforma.consentimientos DO INSTEAD NOTHING;
CREATE RULE consentimientos_no_delete AS ON DELETE TO plataforma.consentimientos DO INSTEAD NOTHING;

-- ---------------------------------------------------------------------
-- La pregunta que el sistema debe saber contestar antes de cada envío.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION plataforma.puede_contactar(
  p_persona_id uuid,
  p_canal      plataforma.canal_contacto,
  p_finalidad  text
) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT c.acto = 'otorgado'
     FROM plataforma.consentimientos c
     WHERE c.persona_id = p_persona_id
       AND c.canal = p_canal
       AND c.finalidad = p_finalidad
     ORDER BY c.ocurrido_en DESC, c.registrado_en DESC
     LIMIT 1),
    -- Sin registro no hay permiso. El silencio nunca es un sí.
    false
  )
  -- La base legal de interés vital no depende del consentimiento.
  OR EXISTS (SELECT 1 FROM plataforma.finalidades f
             WHERE f.codigo = p_finalidad AND f.base_legal = 'interes_vital');
$$;

COMMENT ON FUNCTION plataforma.puede_contactar IS
  'Devuelve false si NO hay registro. La ausencia de consentimiento no es consentimiento.';

-- Vista operativa: a quién sí se le puede escribir hoy, por canal y finalidad.
CREATE OR REPLACE VIEW plataforma.v_contactables AS
SELECT p.id AS persona_id, p.sede_id, f.codigo AS finalidad, c.canal,
       plataforma.puede_contactar(p.id, c.canal, f.codigo) AS permitido
FROM nucleo.personas p
CROSS JOIN plataforma.finalidades f
CROSS JOIN unnest(enum_range(NULL::plataforma.canal_contacto)) AS c(canal)
WHERE p.eliminado_en IS NULL;

INSERT INTO plataforma.clasificacion_columna (esquema,tabla,columna,nivel,finalidad,cifrada) VALUES
  ('plataforma','consentimientos','persona_id',2,'Prueba de tratamiento legítimo · Ley 1581', false),
  ('nucleo','personas','email_principal',2,'Contacto pastoral y convocatoria', false),
  ('nucleo','personas','telefono_movil', 2,'Contacto pastoral y convocatoria', false);
