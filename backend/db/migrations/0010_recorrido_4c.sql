-- =====================================================================
-- Migración 0010 — ESQUEMA 04 · CRM PASTORAL · RECORRIDO 4C
-- «El seguimiento de nuevos — la tesis central del proyecto.»
-- Conoce → Conéctate → Crece → Sirve
-- =====================================================================

CREATE TYPE crm.etapa_4c AS ENUM ('conoce','conectate','crece','sirve');

CREATE TABLE crm.recorrido (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id   uuid NOT NULL REFERENCES nucleo.personas(id) ON DELETE RESTRICT,
  sede_id      uuid NOT NULL REFERENCES org.sedes(id),
  etapa        crm.etapa_4c NOT NULL,
  entro_en     timestamptz NOT NULL DEFAULT now(),
  salio_en     timestamptz,
  puerta_entrada text,   -- de dónde vino: registro público, invitación, evento…
  responsable_id uuid REFERENCES nucleo.personas(id),
  source_system text,
  source_id     text,
  CONSTRAINT recorrido_vigencia CHECK (salio_en IS NULL OR salio_en >= entro_en)
);
CREATE INDEX recorrido_persona_idx ON crm.recorrido (persona_id, entro_en DESC);
CREATE UNIQUE INDEX recorrido_etapa_abierta_uq ON crm.recorrido (persona_id) WHERE salio_en IS NULL;

COMMENT ON INDEX crm.recorrido_etapa_abierta_uq IS
  'Una sola etapa abierta por persona: el embudo no admite estar en dos sitios a la vez.';

ALTER TABLE crm.recorrido ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.recorrido FORCE ROW LEVEL SECURITY;
CREATE POLICY recorrido_sel ON crm.recorrido FOR SELECT USING (plataforma.sede_visible(sede_id));
CREATE POLICY recorrido_ins ON crm.recorrido FOR INSERT WITH CHECK (plataforma.sede_visible(sede_id));
CREATE POLICY recorrido_upd ON crm.recorrido FOR UPDATE USING (plataforma.sede_visible(sede_id));

GRANT SELECT, INSERT, UPDATE ON crm.recorrido TO casaroca_app;
