-- =====================================================================
-- Migración 0012 — ESQUEMA 03 · GRUPOS Y HOGARES
-- Alimenta la etapa «Conéctate» del recorrido 4C.
-- Origen: plataforma actual (Grupos Familiares + Grupos Pequeños).
--
-- Lo que no se puede reconstruir después: la FECHA DE INGRESO de cada
-- membresía. Sin ella se pierde la antigüedad, que es la única forma de
-- medir si alguien avanza en el recorrido o lleva dos años estancado.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS grupos;
COMMENT ON SCHEMA grupos IS 'Esquema 03. Hogares, grupos familiares y grupos pequeños.';
GRANT USAGE ON SCHEMA grupos TO casaroca_app, casaroca_lectura, casaroca_migrador;

CREATE TYPE grupos.tipo_grupo AS ENUM ('familiar','pequeno','discipulado','ministerial');
CREATE TYPE grupos.rol_membresia AS ENUM ('miembro','anfitrion','lider','colider','aprendiz');

-- ---------------------------------------------------------------------
-- Hogar: la unidad de convivencia. NO es lo mismo que familia — dos
-- hermanos adultos que viven juntos son un hogar; una madre y su hijo
-- en ciudades distintas son familia pero no hogar. Separarlos permite
-- que la visita pastoral y el parentesco no se contradigan.
-- ---------------------------------------------------------------------
CREATE TABLE grupos.hogares (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id        uuid NOT NULL REFERENCES org.sedes(id),
  nombre         text NOT NULL,
  direccion      text,
  jefe_hogar_id  uuid REFERENCES nucleo.personas(id),
  activo         boolean NOT NULL DEFAULT true,
  source_system  text, source_id text,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX hogares_linaje_uq ON grupos.hogares (source_system, source_id) WHERE source_system IS NOT NULL;
CREATE TRIGGER trg_hogares_upd BEFORE UPDATE ON grupos.hogares FOR EACH ROW EXECUTE FUNCTION plataforma.tg_set_actualizado_en();

CREATE TABLE grupos.hogar_miembros (
  hogar_id      uuid NOT NULL REFERENCES grupos.hogares(id) ON DELETE RESTRICT,
  persona_id    uuid NOT NULL REFERENCES nucleo.personas(id) ON DELETE RESTRICT,
  desde         date NOT NULL DEFAULT CURRENT_DATE,
  hasta         date,
  PRIMARY KEY (hogar_id, persona_id, desde),
  CONSTRAINT hogar_miembro_vigencia CHECK (hasta IS NULL OR hasta >= desde)
);
-- Una persona vive en UN hogar a la vez. Si aparece en dos, alguien
-- olvidó cerrar la mudanza — y las visitas pastorales se duplican.
CREATE UNIQUE INDEX hogar_miembro_unico ON grupos.hogar_miembros (persona_id) WHERE hasta IS NULL;

-- ---------------------------------------------------------------------
-- Grupos
-- ---------------------------------------------------------------------
CREATE TABLE grupos.grupos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id        uuid NOT NULL REFERENCES org.sedes(id),
  ministerio_id  uuid REFERENCES org.ministerios(id),
  tipo           grupos.tipo_grupo NOT NULL,
  nombre         text NOT NULL,
  dia_reunion    text CHECK (dia_reunion IN ('lunes','martes','miercoles','jueves','viernes','sabado','domingo')),
  hora_reunion   time,
  cupo           smallint CHECK (cupo IS NULL OR cupo > 0),
  abierto        boolean NOT NULL DEFAULT true,
  hogar_id       uuid REFERENCES grupos.hogares(id),
  cerrado_en     date,
  source_system  text, source_id text,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX grupos_linaje_uq ON grupos.grupos (source_system, source_id) WHERE source_system IS NOT NULL;
CREATE INDEX grupos_sede_idx ON grupos.grupos (sede_id) WHERE cerrado_en IS NULL;
CREATE TRIGGER trg_grupos_upd BEFORE UPDATE ON grupos.grupos FOR EACH ROW EXECUTE FUNCTION plataforma.tg_set_actualizado_en();

CREATE TABLE grupos.membresias (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id      uuid NOT NULL REFERENCES grupos.grupos(id) ON DELETE RESTRICT,
  persona_id    uuid NOT NULL REFERENCES nucleo.personas(id) ON DELETE RESTRICT,
  rol           grupos.rol_membresia NOT NULL DEFAULT 'miembro',
  -- ⛔ Obligatoria: es el dato que la plataforma actual sí tiene y que
  --    no se puede recuperar si se migra sin él.
  fecha_ingreso date NOT NULL,
  fecha_salida  date,
  motivo_salida text,
  source_system text, source_id text,
  CONSTRAINT membresia_vigencia CHECK (fecha_salida IS NULL OR fecha_salida >= fecha_ingreso)
);
CREATE UNIQUE INDEX membresia_abierta_uq ON grupos.membresias (grupo_id, persona_id) WHERE fecha_salida IS NULL;
CREATE INDEX membresias_persona_idx ON grupos.membresias (persona_id);

-- Un grupo cerrado no admite membresías nuevas.
CREATE OR REPLACE FUNCTION grupos.tg_grupo_abierto() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_cerrado date; v_cupo smallint; v_actuales bigint;
BEGIN
  SELECT cerrado_en, cupo INTO v_cerrado, v_cupo FROM grupos.grupos WHERE id = NEW.grupo_id;
  IF v_cerrado IS NOT NULL THEN
    RAISE EXCEPTION 'El grupo % está cerrado desde %: no admite membresías nuevas', NEW.grupo_id, v_cerrado
      USING ERRCODE = 'check_violation';
  END IF;
  IF v_cupo IS NOT NULL AND NEW.fecha_salida IS NULL THEN
    SELECT count(*) INTO v_actuales FROM grupos.membresias
     WHERE grupo_id = NEW.grupo_id AND fecha_salida IS NULL AND id <> COALESCE(NEW.id, gen_random_uuid());
    IF v_actuales >= v_cupo THEN
      RAISE EXCEPTION 'El grupo % ya alcanzó su cupo de %', NEW.grupo_id, v_cupo
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER trg_grupo_abierto BEFORE INSERT OR UPDATE ON grupos.membresias
  FOR EACH ROW EXECUTE FUNCTION grupos.tg_grupo_abierto();

CREATE TABLE grupos.reuniones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id    uuid NOT NULL REFERENCES grupos.grupos(id) ON DELETE RESTRICT,
  fecha       date NOT NULL,
  tema        text,
  asistentes  smallint CHECK (asistentes IS NULL OR asistentes >= 0),
  reportada_por uuid REFERENCES nucleo.personas(id),
  registrada_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (grupo_id, fecha)
);

-- ── Aislamiento ───────────────────────────────────────────────────────
ALTER TABLE grupos.hogares  ENABLE ROW LEVEL SECURITY; ALTER TABLE grupos.hogares  FORCE ROW LEVEL SECURITY;
ALTER TABLE grupos.grupos   ENABLE ROW LEVEL SECURITY; ALTER TABLE grupos.grupos   FORCE ROW LEVEL SECURITY;
CREATE POLICY hogares_sel ON grupos.hogares FOR SELECT USING (plataforma.sede_visible(sede_id));
CREATE POLICY hogares_ins ON grupos.hogares FOR INSERT WITH CHECK (plataforma.sede_visible(sede_id));
CREATE POLICY hogares_upd ON grupos.hogares FOR UPDATE USING (plataforma.sede_visible(sede_id));
CREATE POLICY grupos_sel ON grupos.grupos FOR SELECT USING (plataforma.sede_visible(sede_id));
CREATE POLICY grupos_ins ON grupos.grupos FOR INSERT WITH CHECK (plataforma.sede_visible(sede_id));
CREATE POLICY grupos_upd ON grupos.grupos FOR UPDATE USING (plataforma.sede_visible(sede_id));

GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA grupos TO casaroca_app;
