-- =====================================================================
-- Migración 0006 — ESQUEMA 02 · IDENTIDAD Y ACCESO
-- «Los permisos no se migran: se deciden.» (taller H-01, semana 1)
--
-- Corrige la divergencia nº 3 del modelo del equipo 100p:
-- `permisos_personas` asignaba acceso persona×usuario. Con 25.000 personas
-- eso son cientos de millones de filas potenciales y ninguna forma de
-- responder «¿qué puede ver un Pastor Congregacional?».
--
-- Aquí el permiso efectivo es la combinación de CUATRO condiciones:
--        rol  ×  alcance  ×  nivel de sensibilidad  ×  vigencia
-- =====================================================================

CREATE TYPE identidad.tipo_alcance AS ENUM ('organizacion','sede','ministerio','grupo','caso_propio','persona_propia');

CREATE TABLE identidad.roles (
  codigo        text PRIMARY KEY,
  nombre        text NOT NULL,
  alcance_maximo identidad.tipo_alcance NOT NULL,
  nivel_maximo  smallint NOT NULL REFERENCES plataforma.niveles_sensibilidad(nivel),
  descripcion   text NOT NULL
);

COMMENT ON TABLE identidad.roles IS
  'Los 14 roles del taller H-01. `nivel_maximo` es el techo del rol: ninguna asignación puede superarlo.';

-- Asignación concreta: este usuario, con este rol, sobre este alcance,
-- hasta esta fecha. Una asignación vencida deja de dar acceso sola.
CREATE TABLE identidad.asignaciones (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id     uuid NOT NULL REFERENCES nucleo.personas(id) ON DELETE RESTRICT,
  rol            text NOT NULL REFERENCES identidad.roles(codigo),
  alcance_tipo   identidad.tipo_alcance NOT NULL,
  alcance_id     uuid,                       -- sede_id / ministerio_id / grupo_id
  nivel_max      smallint NOT NULL REFERENCES plataforma.niveles_sensibilidad(nivel),
  vigente_desde  date NOT NULL DEFAULT CURRENT_DATE,
  vigente_hasta  date,
  otorgado_por   uuid REFERENCES nucleo.personas(id),
  acta_referencia text,                      -- el documento firmado que lo autoriza
  creado_en      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT asignacion_vigencia CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde),
  -- Un alcance que no es de organización ni propio EXIGE su identificador.
  CONSTRAINT asignacion_alcance_identificado CHECK (
    (alcance_tipo IN ('organizacion','caso_propio','persona_propia') AND alcance_id IS NULL)
    OR (alcance_tipo IN ('sede','ministerio','grupo') AND alcance_id IS NOT NULL)
  )
);
CREATE INDEX asignaciones_persona_idx ON identidad.asignaciones (persona_id) WHERE vigente_hasta IS NULL;

-- El techo del rol manda sobre la asignación: nadie puede recibir más
-- sensibilidad de la que su rol admite, aunque alguien la escriba a mano.
CREATE OR REPLACE FUNCTION identidad.tg_asignacion_respeta_techo() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_techo smallint; v_alcance identidad.tipo_alcance;
BEGIN
  SELECT nivel_maximo, alcance_maximo INTO v_techo, v_alcance
  FROM identidad.roles WHERE codigo = NEW.rol;

  IF NEW.nivel_max > v_techo THEN
    RAISE EXCEPTION 'El rol % admite como máximo nivel N%, se intentó asignar N%', NEW.rol, v_techo, NEW.nivel_max
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER trg_asignacion_respeta_techo
  BEFORE INSERT OR UPDATE ON identidad.asignaciones
  FOR EACH ROW EXECUTE FUNCTION identidad.tg_asignacion_respeta_techo();

-- ---------------------------------------------------------------------
-- Permiso efectivo. Lo consulta el motor de políticas de la aplicación
-- (primera cerradura) para armar el contexto que después lee RLS (segunda).
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW identidad.v_permiso_efectivo AS
SELECT a.persona_id,
       a.rol,
       a.alcance_tipo,
       a.alcance_id,
       LEAST(a.nivel_max, r.nivel_maximo) AS nivel_efectivo,
       (a.vigente_desde <= CURRENT_DATE
        AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)) AS vigente
FROM identidad.asignaciones a
JOIN identidad.roles r ON r.codigo = a.rol;

-- Sedes que una persona puede tocar hoy. Es la fuente de `app.sede_ids`.
CREATE OR REPLACE FUNCTION identidad.sedes_de(p_persona_id uuid) RETURNS uuid[]
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(array_agg(DISTINCT s.id), '{}'::uuid[])
  FROM identidad.v_permiso_efectivo pe
  JOIN org.sedes s ON (pe.alcance_tipo = 'organizacion' OR s.id = pe.alcance_id)
  WHERE pe.persona_id = p_persona_id AND pe.vigente;
$$;

CREATE OR REPLACE FUNCTION identidad.nivel_max_de(p_persona_id uuid) RETURNS smallint
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(MAX(nivel_efectivo), 0)::smallint
  FROM identidad.v_permiso_efectivo
  WHERE persona_id = p_persona_id AND vigente;
$$;
