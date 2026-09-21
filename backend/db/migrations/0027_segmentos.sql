-- =====================================================================
-- Migración 0027 — EL SEGMENTO, EL ESLABÓN QUE FALTABA
--
-- La jerarquía real de la iglesia tiene un nivel que el modelo no tenía:
--
--   Sede → Ministerio → SEGMENTO → Grupo
--
-- El segmento es la franja dentro de un ministerio: en RocaKids son
-- Bebés, Pequeños, Exploradores y Aventureros; en tMt son Pulso, Eco y
-- Legado. Cada uno tiene su director y su coordinador, y ese es el nivel
-- al que de verdad se opera el día a día.
--
-- Sin esta tabla, los roles «Director de segmento» y «Coordinador de
-- segmento» no se podrían crear: un rol necesita un alcance, y un
-- alcance necesita una entidad sobre la que recaer. Por eso el eslabón
-- va antes que los roles.
-- =====================================================================

CREATE TABLE org.segmentos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id       uuid NOT NULL REFERENCES org.sedes(id) ON DELETE RESTRICT,
  ministerio_id uuid NOT NULL REFERENCES org.ministerios(id) ON DELETE RESTRICT,
  codigo        text NOT NULL,
  nombre        text NOT NULL,
  orden         smallint NOT NULL DEFAULT 1,
  -- Opcionales: hay segmentos por edad (RocaKids, tMt) y otros que no.
  edad_min      smallint CHECK (edad_min IS NULL OR edad_min >= 0),
  edad_max      smallint CHECK (edad_max IS NULL OR edad_max <= 120),
  activo        boolean NOT NULL DEFAULT true,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sede_id, ministerio_id, codigo),
  CONSTRAINT segmento_rango CHECK (edad_max IS NULL OR edad_min IS NULL OR edad_max >= edad_min)
);
CREATE INDEX segmentos_sede_idx ON org.segmentos (sede_id, ministerio_id) WHERE activo;

COMMENT ON TABLE org.segmentos IS
  'La franja dentro de un ministerio: Bebés/Pequeños/Exploradores/Aventureros en RocaKids, Pulso/Eco/Legado en tMt. Es el nivel al que se opera el día a día.';

-- Un segmento solo existe si su ministerio está encendido en esa sede.
CREATE OR REPLACE FUNCTION org.tg_segmento_exige_ministerio_activo() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_min text;
BEGIN
  IF NEW.activo AND NOT EXISTS (
    SELECT 1 FROM org.ministerios_sede ms
    WHERE ms.sede_id = NEW.sede_id AND ms.ministerio_id = NEW.ministerio_id AND ms.activo
  ) THEN
    SELECT nombre INTO v_min FROM org.ministerios WHERE id = NEW.ministerio_id;
    RAISE EXCEPTION 'El ministerio «%» no está activo en esa sede: no puede tener segmentos', v_min
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER trg_segmento_exige_ministerio_activo
  BEFORE INSERT OR UPDATE ON org.segmentos
  FOR EACH ROW EXECUTE FUNCTION org.tg_segmento_exige_ministerio_activo();

-- El grupo cuelga del segmento. Queda opcional porque hay grupos que no
-- pertenecen a ninguno (los familiares, por ejemplo).
ALTER TABLE grupos.grupos
  ADD COLUMN segmento_id uuid REFERENCES org.segmentos(id) ON DELETE RESTRICT;
CREATE INDEX grupos_segmento_idx ON grupos.grupos (segmento_id) WHERE segmento_id IS NOT NULL;

-- Un grupo no puede estar en un segmento de OTRA sede.
CREATE OR REPLACE FUNCTION grupos.tg_segmento_misma_sede() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_sede uuid;
BEGIN
  IF NEW.segmento_id IS NOT NULL THEN
    SELECT sede_id INTO v_sede FROM org.segmentos WHERE id = NEW.segmento_id;
    IF v_sede <> NEW.sede_id THEN
      RAISE EXCEPTION 'El segmento pertenece a otra sede' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER trg_grupo_segmento_misma_sede
  BEFORE INSERT OR UPDATE ON grupos.grupos
  FOR EACH ROW EXECUTE FUNCTION grupos.tg_segmento_misma_sede();

ALTER TABLE org.segmentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE org.segmentos FORCE ROW LEVEL SECURITY;
CREATE POLICY segmentos_sel ON org.segmentos FOR SELECT USING (plataforma.sede_visible(sede_id));
CREATE POLICY segmentos_ins ON org.segmentos FOR INSERT WITH CHECK (plataforma.sede_visible(sede_id));
CREATE POLICY segmentos_upd ON org.segmentos FOR UPDATE USING (plataforma.sede_visible(sede_id));

GRANT SELECT, INSERT, UPDATE ON org.segmentos TO casaroca_app;
