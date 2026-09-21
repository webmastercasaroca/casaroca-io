-- =====================================================================
-- Migración 0002 — ESQUEMA 01 · ORGANIZACIÓN  (Etapa 1, bloqueante)
-- «Ninguna fila puede cargarse antes de que exista su sede.»
--
-- Corrige la divergencia nº 1 (la más grave) del modelo del equipo 100p:
-- sin columna de sede no hay multi-tenancy ni RLS posible para 36 sedes.
-- Aquí la sede es una entidad de primera clase y una clave foránea
-- obligatoria en todo lo demás.
-- =====================================================================

CREATE TYPE org.tipo_sede AS ENUM ('sede_madre','filial_nacional','filial_internacional','plantacion');

CREATE TABLE org.paises (
  codigo_iso2  char(2) PRIMARY KEY,
  nombre       text NOT NULL,
  regimen_datos text NOT NULL DEFAULT 'ley_1581_co'
    CHECK (regimen_datos IN ('ley_1581_co','gdpr_eu','otro')),
  huso_horario text NOT NULL
);
COMMENT ON COLUMN org.paises.regimen_datos IS
  'En Colombia manda la Ley 1581/2012 (Habeas Data), no el GDPR. Las sedes internacionales sí caen bajo GDPR: por eso migran en la última ola.';

CREATE TABLE org.sedes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo           text NOT NULL UNIQUE,
  nombre           text NOT NULL,
  tipo             org.tipo_sede NOT NULL,
  pais             char(2) NOT NULL REFERENCES org.paises(codigo_iso2),
  ciudad           text NOT NULL,
  sede_padre_id    uuid REFERENCES org.sedes(id),
  activa           boolean NOT NULL DEFAULT true,
  ola_migracion    smallint CHECK (ola_migracion BETWEEN 1 AND 5),
  -- Linaje de migración (divergencia nº 2): sin esto la reconciliación
  -- contra la plataforma actual es imposible.
  source_system    text,
  source_id        text,
  creado_en        timestamptz NOT NULL DEFAULT now(),
  actualizado_en   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sedes_linaje_completo CHECK ((source_system IS NULL) = (source_id IS NULL))
);
CREATE UNIQUE INDEX sedes_linaje_uq ON org.sedes (source_system, source_id) WHERE source_system IS NOT NULL;
CREATE TRIGGER trg_sedes_upd BEFORE UPDATE ON org.sedes FOR EACH ROW EXECUTE FUNCTION plataforma.tg_set_actualizado_en();

COMMENT ON TABLE org.sedes IS
  'Las 36 sedes. Es la etapa 1 de la carga: bloqueante. Toda fila del sistema cuelga de una de estas.';

CREATE TABLE org.ministerios (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      text NOT NULL UNIQUE,
  nombre      text NOT NULL,
  clase       text NOT NULL CHECK (clase IN ('congregacional','equipo_operativo','formacion','erp')),
  nivel_dato  smallint NOT NULL DEFAULT 2 REFERENCES plataforma.niveles_sensibilidad(nivel)
);
COMMENT ON COLUMN org.ministerios.nivel_dato IS
  'RocaKids nace N4 y Consejería N3: el ministerio arrastra su nivel a los datos que produce.';

-- Activación por sede: el pastor filial enciende lo que necesita.
CREATE TABLE org.ministerios_sede (
  sede_id       uuid NOT NULL REFERENCES org.sedes(id) ON DELETE RESTRICT,
  ministerio_id uuid NOT NULL REFERENCES org.ministerios(id) ON DELETE RESTRICT,
  activo        boolean NOT NULL DEFAULT false,
  activado_en   timestamptz,
  PRIMARY KEY (sede_id, ministerio_id)
);

-- ⛔ Prohibido el borrado físico en organización: la sede es referencia histórica.
CREATE RULE sedes_no_delete AS ON DELETE TO org.sedes DO INSTEAD NOTHING;

GRANT SELECT ON ALL TABLES IN SCHEMA org TO casaroca_app, casaroca_lectura;
GRANT INSERT, UPDATE ON ALL TABLES IN SCHEMA org TO casaroca_app;
