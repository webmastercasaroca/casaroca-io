-- =====================================================================
-- Migración 0008 — LA SEGUNDA CERRADURA (RLS)
--
-- Respuesta a la pregunta del Comité: «¿cómo garantizan que Panamá no vea
-- Barcelona?». La primera cerradura es el motor de políticas en la
-- aplicación. Esta es la segunda: aunque el programador olvide el filtro
-- de sede, la base no devuelve filas ajenas.
--
-- Nota deliberada: la autorización NO descansa solo en RLS — esa fue una
-- de las razones para descartar la plataforma Supabase como fundación.
-- RLS es la red, no el trapecio.
-- =====================================================================

ALTER TABLE nucleo.personas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE nucleo.acudientes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE plataforma.consentimientos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE identidad.asignaciones      ENABLE ROW LEVEL SECURITY;

-- FORCE: aplica también al propietario de la tabla. Sin esto, cualquier
-- conexión que resulte ser dueña salta la política sin decir nada.
ALTER TABLE nucleo.personas             FORCE ROW LEVEL SECURITY;
ALTER TABLE nucleo.acudientes           FORCE ROW LEVEL SECURITY;
ALTER TABLE plataforma.consentimientos  FORCE ROW LEVEL SECURITY;
ALTER TABLE identidad.asignaciones      FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- Predicado de sede. Vacío ⇒ ninguna fila. Nunca «todas».
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION plataforma.sede_visible(p_sede_id uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT plataforma.ctx_es_global()
      OR p_sede_id = ANY (plataforma.ctx_sede_ids())
$$;

-- ── nucleo.personas ───────────────────────────────────────────────────
CREATE POLICY personas_sel ON nucleo.personas FOR SELECT
  USING (plataforma.sede_visible(sede_id));

CREATE POLICY personas_ins ON nucleo.personas FOR INSERT
  WITH CHECK (plataforma.sede_visible(sede_id));

-- El USING evita mover una fila ajena; el WITH CHECK evita sacarla de tu alcance.
CREATE POLICY personas_upd ON nucleo.personas FOR UPDATE
  USING (plataforma.sede_visible(sede_id))
  WITH CHECK (plataforma.sede_visible(sede_id));

-- ── nucleo.acudientes (N4: además exige nivel 4) ──────────────────────
CREATE POLICY acudientes_sel ON nucleo.acudientes FOR SELECT
  USING (
    plataforma.ctx_nivel_max() >= 4
    AND EXISTS (SELECT 1 FROM nucleo.personas p
                WHERE p.id = nucleo.acudientes.menor_id
                  AND plataforma.sede_visible(p.sede_id))
  );

CREATE POLICY acudientes_ins ON nucleo.acudientes FOR INSERT
  WITH CHECK (
    plataforma.ctx_nivel_max() >= 4
    AND EXISTS (SELECT 1 FROM nucleo.personas p
                WHERE p.id = nucleo.acudientes.menor_id
                  AND plataforma.sede_visible(p.sede_id))
  );

CREATE POLICY acudientes_upd ON nucleo.acudientes FOR UPDATE
  USING (plataforma.ctx_nivel_max() >= 4)
  WITH CHECK (plataforma.ctx_nivel_max() >= 4);

-- ── plataforma.consentimientos ────────────────────────────────────────
CREATE POLICY consentimientos_sel ON plataforma.consentimientos FOR SELECT
  USING (plataforma.sede_visible(sede_id));
CREATE POLICY consentimientos_ins ON plataforma.consentimientos FOR INSERT
  WITH CHECK (plataforma.sede_visible(sede_id));

-- ── identidad.asignaciones ────────────────────────────────────────────
-- Cada quien ve sus propias asignaciones; el resto exige alcance de organización.
CREATE POLICY asignaciones_sel ON identidad.asignaciones FOR SELECT
  USING (persona_id = plataforma.ctx_persona_id() OR plataforma.ctx_es_global());
CREATE POLICY asignaciones_ins ON identidad.asignaciones FOR INSERT
  WITH CHECK (plataforma.ctx_es_global());

-- ---------------------------------------------------------------------
-- El migrador es el ÚNICO que puede saltar RLS, y de forma explícita.
-- La carga inicial ocurre antes de que existan sesiones con contexto.
-- ---------------------------------------------------------------------
ALTER ROLE casaroca_migrador BYPASSRLS;

-- Y la aplicación explícitamente NO puede:
ALTER ROLE casaroca_app NOBYPASSRLS;
ALTER ROLE casaroca_lectura NOBYPASSRLS;

GRANT SELECT, INSERT, UPDATE ON nucleo.personas, nucleo.acudientes, identidad.asignaciones TO casaroca_app;
GRANT SELECT, INSERT ON plataforma.consentimientos TO casaroca_app;
GRANT INSERT ON plataforma.bitacora_lectura TO casaroca_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA plataforma TO casaroca_app;

COMMENT ON FUNCTION plataforma.sede_visible IS
  'Segunda cerradura. Si app.sede_ids no está fijado, devuelve falso: la sesión sin contexto no ve nada.';
