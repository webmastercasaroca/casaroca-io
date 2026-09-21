-- =====================================================================
-- Migración 0009 — ESQUEMA 11 · LÍNEA DE TIEMPO (polimórfica)
-- «La pieza más valiosa del volcado: la memoria de la relación.
--  No existe forma de reconstruirla.»
--
-- Polimórfica a propósito: acepta hechos nuevos de cualquier módulo sin
-- rediseño. Es lo que hace barato cruzar datos más adelante.
-- =====================================================================

CREATE TABLE crm.tipos_hecho (
  codigo      text PRIMARY KEY,
  nombre      text NOT NULL,
  modulo      text NOT NULL,
  nivel       smallint NOT NULL REFERENCES plataforma.niveles_sensibilidad(nivel)
);

CREATE TABLE crm.linea_tiempo (
  id            bigserial,
  persona_id    uuid NOT NULL REFERENCES nucleo.personas(id) ON DELETE RESTRICT,
  sede_id       uuid NOT NULL REFERENCES org.sedes(id),
  ocurrido_en   timestamptz NOT NULL,
  tipo          text NOT NULL REFERENCES crm.tipos_hecho(codigo),
  -- Referencia polimórfica: módulo + entidad, sin FK rígida.
  entidad_modulo text,
  entidad_tipo   text,
  entidad_id     text,
  resumen       text NOT NULL,
  detalle       jsonb,
  registrado_por uuid REFERENCES nucleo.personas(id),
  registrado_en timestamptz NOT NULL DEFAULT now(),
  source_system text,
  source_id     text,
  PRIMARY KEY (id, ocurrido_en)
) PARTITION BY RANGE (ocurrido_en);

CREATE TABLE crm.linea_tiempo_historico PARTITION OF crm.linea_tiempo
  FOR VALUES FROM ('2000-01-01') TO ('2026-01-01');
CREATE TABLE crm.linea_tiempo_2026 PARTITION OF crm.linea_tiempo
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
CREATE TABLE crm.linea_tiempo_2027 PARTITION OF crm.linea_tiempo
  FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');

CREATE INDEX linea_tiempo_persona_idx ON crm.linea_tiempo (persona_id, ocurrido_en DESC);
CREATE INDEX linea_tiempo_entidad_idx ON crm.linea_tiempo (entidad_modulo, entidad_tipo, entidad_id);

-- La memoria no se edita ni se borra.
CREATE RULE linea_tiempo_no_update AS ON UPDATE TO crm.linea_tiempo DO INSTEAD NOTHING;
CREATE RULE linea_tiempo_no_delete AS ON DELETE TO crm.linea_tiempo DO INSTEAD NOTHING;

ALTER TABLE crm.linea_tiempo ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm.linea_tiempo FORCE ROW LEVEL SECURITY;
CREATE POLICY linea_tiempo_sel ON crm.linea_tiempo FOR SELECT
  USING (plataforma.sede_visible(sede_id) AND plataforma.ctx_nivel_max() >= (SELECT nivel FROM crm.tipos_hecho t WHERE t.codigo = linea_tiempo.tipo));
CREATE POLICY linea_tiempo_ins ON crm.linea_tiempo FOR INSERT
  WITH CHECK (plataforma.sede_visible(sede_id));

GRANT SELECT, INSERT ON crm.linea_tiempo TO casaroca_app;
GRANT SELECT ON crm.tipos_hecho TO casaroca_app, casaroca_lectura;

COMMENT ON TABLE crm.linea_tiempo IS
  'Bitácora polimórfica. Particionada por año e inmutable: es la memoria de la relación con cada persona.';
