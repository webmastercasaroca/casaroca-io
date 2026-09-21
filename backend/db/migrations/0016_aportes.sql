-- =====================================================================
-- Migración 0016 — ESQUEMA 08 · APORTES  (nivel N3, el más restringido
-- después de menores)
--
-- Sin origen digital: el dato vive en tesorería y en el sistema contable
-- corporativo, en formatos distintos por sede.
--
-- Es el ÚNICO dominio cuyo criterio de aceptación es aritmético:
--        la suma migrada debe ser idéntica AL PESO a la del origen.
-- Por eso el cierre de control no es un informe: es una tabla, y la base
-- sabe decir sola si la migración cuadra o no.
--
-- Y la regla de visibilidad que define el proyecto:
--   · Pastor Director General → ve el aporte POR PERSONA
--   · Tesorería               → ve el agregado de SU sede, sin detalle
--   · Pastor Congregacional   → ve SI una familia aporta y con qué
--                               frecuencia, NUNCA el monto
--   Los tres usan la misma pantalla: cambia el permiso, no el código.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS aportes;
COMMENT ON SCHEMA aportes IS 'Esquema 08. Nivel N3. Cifrado por columna, enmascarado por defecto y bitácora de lectura.';
GRANT USAGE ON SCHEMA aportes TO casaroca_app, casaroca_migrador;

CREATE TYPE aportes.tipo_aporte AS ENUM ('diezmo','ofrenda','pacto','proyecto','primicia','otro');
CREATE TYPE aportes.medio_pago  AS ENUM ('efectivo','transferencia','tarjeta','pse','cheque','datafono','nequi_daviplata');

CREATE TABLE aportes.fondos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo        text NOT NULL UNIQUE,
  nombre        text NOT NULL,
  -- Un aporte dirigido a un proyecto NO puede convertirse en ofrenda
  -- general al migrar. Por eso el fondo es una entidad, no un texto.
  tipo          text NOT NULL CHECK (tipo IN ('general','proyecto','misiones','construccion','beneficencia')),
  cuenta_contable text,
  vigente_desde date NOT NULL DEFAULT CURRENT_DATE,
  vigente_hasta date,
  CONSTRAINT fondo_vigencia CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde)
);
COMMENT ON COLUMN aportes.fondos.cuenta_contable IS
  'Correspondencia con el sistema contable corporativo. Es lo que hace posible la integración posterior sin re-mapear a mano.';

CREATE TABLE aportes.aportes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id        uuid NOT NULL REFERENCES org.sedes(id),
  -- Nulo SOLO si el aporte es anónimo, y hay que declararlo.
  persona_id     uuid REFERENCES nucleo.personas(id) ON DELETE RESTRICT,
  es_anonimo     boolean NOT NULL DEFAULT false,
  fondo_id       uuid NOT NULL REFERENCES aportes.fondos(id),
  tipo           aportes.tipo_aporte NOT NULL,
  -- ⛔ NUMERIC, jamás punto flotante: 0.1 + 0.2 no es 0.3 y un cierre
  --    contable no puede depender de eso.
  monto          numeric(15,2) NOT NULL CHECK (monto > 0),
  moneda         char(3) NOT NULL DEFAULT 'COP',
  medio          aportes.medio_pago NOT NULL,
  fecha          date NOT NULL,
  referencia     text,
  registrado_por uuid REFERENCES nucleo.personas(id),
  registrado_en  timestamptz NOT NULL DEFAULT now(),
  anulado_en     timestamptz,
  anulado_motivo text,
  source_system  text, source_id text,
  -- El anonimato es una DECISIÓN declarada, no el resultado de un campo
  -- que alguien dejó vacío. Sin este CHECK, un error de carga produce
  -- aportes anónimos silenciosos que nadie puede reclamar después.
  CONSTRAINT aporte_anonimo_declarado CHECK (es_anonimo = (persona_id IS NULL)),
  CONSTRAINT aporte_no_futuro CHECK (fecha <= CURRENT_DATE),
  CONSTRAINT aporte_anulacion_coherente CHECK ((anulado_en IS NULL) = (anulado_motivo IS NULL))
);
CREATE INDEX aportes_persona_idx ON aportes.aportes (persona_id, fecha DESC) WHERE anulado_en IS NULL;
CREATE INDEX aportes_sede_fecha_idx ON aportes.aportes (sede_id, fecha) WHERE anulado_en IS NULL;
CREATE UNIQUE INDEX aportes_linaje_uq ON aportes.aportes (source_system, source_id) WHERE source_system IS NOT NULL;

-- Un aporte no se corrige: se anula y se vuelve a registrar. La
-- contabilidad no admite que una cifra cambie sin dejar rastro.
CREATE RULE aportes_no_delete AS ON DELETE TO aportes.aportes DO INSTEAD NOTHING;
CREATE TRIGGER trg_auditar_aportes AFTER INSERT OR UPDATE OR DELETE ON aportes.aportes
  FOR EACH ROW EXECUTE FUNCTION plataforma.tg_auditar();

-- ---------------------------------------------------------------------
-- EL CIERRE DE CONTROL: la suma oficial contra la que se reconcilia.
-- Es «el único juez de si la migración quedó bien».
-- ---------------------------------------------------------------------
CREATE TABLE aportes.cierres_control (
  sede_id       uuid NOT NULL REFERENCES org.sedes(id),
  anio          smallint NOT NULL CHECK (anio BETWEEN 2000 AND 2100),
  mes           smallint NOT NULL CHECK (mes BETWEEN 1 AND 12),
  moneda        char(3) NOT NULL DEFAULT 'COP',
  total_oficial numeric(15,2) NOT NULL CHECK (total_oficial >= 0),
  fuente        text NOT NULL,      -- quién lo certifica
  certificado_por uuid REFERENCES nucleo.personas(id),
  cargado_en    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sede_id, anio, mes, moneda)
);
CREATE RULE cierres_no_update AS ON UPDATE TO aportes.cierres_control DO INSTEAD NOTHING;
CREATE RULE cierres_no_delete AS ON DELETE TO aportes.cierres_control DO INSTEAD NOTHING;

COMMENT ON TABLE aportes.cierres_control IS
  'Inmutable. Si el cierre pudiera editarse, la reconciliación se podría hacer «cuadrar» moviendo el juez en vez del dato.';

-- ---------------------------------------------------------------------
-- LA RECONCILIACIÓN. Una consulta contesta si la migración cuadra.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW aportes.v_reconciliacion AS
SELECT c.sede_id, c.anio, c.mes, c.moneda,
       c.total_oficial,
       COALESCE(m.total_migrado, 0)                       AS total_migrado,
       COALESCE(m.total_migrado, 0) - c.total_oficial     AS diferencia,
       (COALESCE(m.total_migrado, 0) = c.total_oficial)   AS cuadra
FROM aportes.cierres_control c
LEFT JOIN (
  SELECT sede_id, extract(year FROM fecha)::smallint AS anio,
         extract(month FROM fecha)::smallint AS mes, moneda,
         sum(monto) AS total_migrado
  FROM aportes.aportes
  WHERE anulado_en IS NULL
  GROUP BY 1,2,3,4
) m ON m.sede_id = c.sede_id AND m.anio = c.anio AND m.mes = c.mes AND m.moneda = c.moneda;

COMMENT ON VIEW aportes.v_reconciliacion IS
  'Criterio de aceptación de la migración de aportes: toda fila debe tener cuadra = true. Una sola diferencia, aunque sea de un peso, detiene la compuerta.';

-- ---------------------------------------------------------------------
-- LAS TRES VISTAS DEL MISMO DATO. Cambia el permiso, no el código.
-- ---------------------------------------------------------------------

-- Nivel 3 + alcance de organización: el detalle por persona.
CREATE OR REPLACE VIEW aportes.v_detalle_por_persona AS
SELECT a.id, a.sede_id, a.persona_id, a.fondo_id, a.tipo, a.monto, a.moneda, a.medio, a.fecha
FROM aportes.aportes a
WHERE a.anulado_en IS NULL
  AND plataforma.ctx_nivel_max() >= 3
  AND plataforma.ctx_es_global();

-- Nivel 3 + alcance de sede (Tesorería): el agregado, sin detalle.
CREATE OR REPLACE VIEW aportes.v_agregado_sede AS
SELECT a.sede_id, a.fondo_id, a.tipo, a.moneda,
       date_trunc('month', a.fecha)::date AS mes,
       count(*) AS numero_aportes,
       sum(a.monto) AS total
FROM aportes.aportes a
WHERE a.anulado_en IS NULL
  AND plataforma.ctx_nivel_max() >= 3
  AND plataforma.sede_visible(a.sede_id)
GROUP BY 1,2,3,4,5;

-- Nivel 2 (Pastor Congregacional): SI aporta y con qué frecuencia.
-- ⛔ Ni una sola columna de monto. No es que se oculte en la pantalla:
--    es que la vista no la tiene.
CREATE OR REPLACE VIEW aportes.v_habito_aporte AS
SELECT a.persona_id,
       a.sede_id,
       count(*)                                   AS aportes_12_meses,
       count(DISTINCT date_trunc('month', a.fecha)) AS meses_con_aporte,
       max(a.fecha)                               AS ultimo_aporte,
       CASE
         WHEN count(DISTINCT date_trunc('month', a.fecha)) >= 10 THEN 'constante'
         WHEN count(DISTINCT date_trunc('month', a.fecha)) >= 4  THEN 'frecuente'
         ELSE 'ocasional'
       END AS habito
FROM aportes.aportes a
WHERE a.anulado_en IS NULL
  AND a.persona_id IS NOT NULL
  AND a.fecha >= CURRENT_DATE - interval '12 months'
  AND plataforma.sede_visible(a.sede_id)
GROUP BY 1,2;

COMMENT ON VIEW aportes.v_habito_aporte IS
  'La vista del pastor congregacional. Responde «¿esta familia está conectada?» sin responder «¿cuánto da?». Deliberadamente no expone ninguna columna de monto.';

ALTER TABLE aportes.aportes ENABLE ROW LEVEL SECURITY; ALTER TABLE aportes.aportes FORCE ROW LEVEL SECURITY;
CREATE POLICY aportes_sel ON aportes.aportes FOR SELECT
  USING (plataforma.ctx_nivel_max() >= 3 AND plataforma.sede_visible(sede_id));
CREATE POLICY aportes_ins ON aportes.aportes FOR INSERT
  WITH CHECK (plataforma.ctx_nivel_max() >= 3 AND plataforma.sede_visible(sede_id));
CREATE POLICY aportes_upd ON aportes.aportes FOR UPDATE
  USING (plataforma.ctx_nivel_max() >= 3 AND plataforma.sede_visible(sede_id));

INSERT INTO plataforma.clasificacion_columna (esquema,tabla,columna,nivel,finalidad,cifrada,mecanismo) VALUES
  ('aportes','aportes','monto',3,'Conciliación contable y certificados tributarios',false,'rls_y_bitacora'),
  ('aportes','aportes','persona_id',3,'Vincular el aporte con la ficha de persona',false,'rls_y_bitacora');

GRANT SELECT, INSERT, UPDATE ON aportes.aportes TO casaroca_app;
GRANT SELECT ON aportes.fondos, aportes.cierres_control TO casaroca_app;
GRANT SELECT ON aportes.v_reconciliacion, aportes.v_habito_aporte, aportes.v_agregado_sede TO casaroca_app;
