-- =====================================================================
-- Migración 0044 — LA CENTRAL EXISTE, LAS REGIONES EXISTEN, Y UN EQUIPO
--                  PUEDE TENER PERMISOS
--
-- ⛔ EL PROBLEMA. El modelo tenía sedes y tenía ministerios, y nada más.
--    Con eso, «la central tiene muchos equipos» no se podía representar:
--
--      · Un coordinador de Comunicaciones de la central solo podía recibir
--        alcance de ORGANIZACIÓN (ve las 36 sedes) o de UNA SEDE (ve una).
--        No había término medio, y el término medio es donde vive la central.
--      · El supervisor de ocho iglesias tampoco existía: se resolvía dándole
--        toda la red. Eso no es un permiso, es una fuga con buena intención.
--      · Y el permiso se pegaba a la PERSONA. Quien salía del equipo de
--        Finanzas seguía viendo los aportes hasta que alguien se acordara
--        de quitárselo. «Alguien se acuerda» no es un control.
--
-- ⭐ LO QUE ENTRA:
--      1 · `org.unidades`: un árbol de unidades organizativas que NO son
--          congregaciones (la central, las regiones, los equipos, las
--          direcciones). `org.sedes` no se toca: sigue siendo la sede, con
--          sus 40 tablas colgando. Solo aprende de qué unidad depende.
--      2 · `org.unidad_miembros`: quién está en qué equipo, con vigencia.
--      3 · `identidad.asignaciones_unidad`: el rol se le da AL EQUIPO. Las
--          personas lo heredan mientras pertenezcan, y lo pierden solas el
--          día que salen. Eso es B4.16 hecho base de datos.
--      4 · El alcance «unidad»: un rol sobre la región de Bogotá alcanza
--          las sedes de la región de Bogotá, ni una más.
--
-- ⛔ Y LO QUE NO CAMBIA: el permiso efectivo sigue siendo
--    rol × alcance × nivel × vigencia. Aquí solo aparece una forma más de
--    que el alcance llegue: heredado de un equipo en vez de puesto a mano.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · EL ÁRBOL DE UNIDADES
-- ---------------------------------------------------------------------
CREATE TABLE org.clases_unidad (
  codigo      text PRIMARY KEY,
  nombre      text NOT NULL,
  descripcion text NOT NULL,
  agrupa_sedes boolean NOT NULL DEFAULT false,
  orden       smallint NOT NULL DEFAULT 100
);
INSERT INTO org.clases_unidad (codigo, nombre, descripcion, agrupa_sedes, orden) VALUES
 ('central',   'Central',        'La oficina que administra la red completa.', true, 10),
 ('region',    'Region',         'Agrupa sedes por territorio. Es el nivel que faltaba entre la central y las 36 sedes.', true, 20),
 ('direccion', 'Direccion',      'Un area de la central con varios equipos debajo.', false, 30),
 ('equipo',    'Equipo',         'Un equipo de trabajo de la central o de una direccion.', false, 40);

CREATE TABLE org.unidades (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo        text NOT NULL UNIQUE,
  nombre        text NOT NULL,
  clase         text NOT NULL REFERENCES org.clases_unidad(codigo),
  padre_id      uuid REFERENCES org.unidades(id),
  lider_persona_id uuid REFERENCES nucleo.personas(id),
  proposito     text,
  activa        boolean NOT NULL DEFAULT true,
  creada_en     timestamptz NOT NULL DEFAULT now(),
  -- ⛔ Solo puede haber UNA central, y la central no cuelga de nadie.
  CONSTRAINT unidad_central_sin_padre CHECK (clase <> 'central' OR padre_id IS NULL)
);
CREATE UNIQUE INDEX unidad_una_sola_central ON org.unidades ((clase)) WHERE clase = 'central';
CREATE INDEX unidad_padre_idx ON org.unidades (padre_id);

COMMENT ON TABLE org.unidades IS
  'La central, las regiones y los equipos. Todo lo organizativo que NO es una congregacion. Las sedes siguen en org.sedes.';

-- Un ciclo en el árbol (A depende de B que depende de A) cuelga cualquier
-- consulta recursiva. La base lo impide.
CREATE OR REPLACE FUNCTION org.tg_unidad_sin_ciclos() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_actual uuid; v_saltos int := 0;
BEGIN
  v_actual := NEW.padre_id;
  WHILE v_actual IS NOT NULL LOOP
    IF v_actual = NEW.id THEN
      RAISE EXCEPTION 'La unidad «%» no puede depender de si misma, ni directa ni indirectamente', NEW.nombre
        USING ERRCODE = 'check_violation';
    END IF;
    v_saltos := v_saltos + 1;
    IF v_saltos > 20 THEN RAISE EXCEPTION 'Arbol de unidades demasiado profundo o con ciclo'; END IF;
    SELECT padre_id INTO v_actual FROM org.unidades WHERE id = v_actual;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_unidad_sin_ciclos BEFORE INSERT OR UPDATE ON org.unidades
  FOR EACH ROW EXECUTE FUNCTION org.tg_unidad_sin_ciclos();

-- La sede aprende de qué unidad depende (su región).
ALTER TABLE org.sedes ADD COLUMN unidad_id uuid REFERENCES org.unidades(id);
CREATE INDEX sedes_unidad_idx ON org.sedes (unidad_id);
COMMENT ON COLUMN org.sedes.unidad_id IS
  'La region (o la central) de la que depende esta sede. Es lo que hace posible el rol de supervisor regional.';

-- ---------------------------------------------------------------------
-- 2 · QUIÉN ESTÁ EN QUÉ EQUIPO, CON FECHAS
-- ---------------------------------------------------------------------
CREATE TABLE org.unidad_miembros (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidad_id   uuid NOT NULL REFERENCES org.unidades(id) ON DELETE RESTRICT,
  persona_id  uuid NOT NULL REFERENCES nucleo.personas(id) ON DELETE RESTRICT,
  rol_en_unidad text NOT NULL DEFAULT 'integrante'
    CHECK (rol_en_unidad IN ('lider','coordinador','integrante','invitado')),
  desde       date NOT NULL DEFAULT CURRENT_DATE,
  hasta       date,
  motivo_salida text,
  creado_en   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT miembro_vigencia CHECK (hasta IS NULL OR hasta >= desde)
);
CREATE UNIQUE INDEX unidad_miembro_uq ON org.unidad_miembros (unidad_id, persona_id) WHERE hasta IS NULL;
CREATE INDEX unidad_miembro_persona_idx ON org.unidad_miembros (persona_id) WHERE hasta IS NULL;

COMMENT ON TABLE org.unidad_miembros IS
  'Pertenencia a un equipo, con fecha de entrada y de salida. El dia que alguien sale, sus permisos heredados caen solos.';

-- ---------------------------------------------------------------------
-- 3 · EL ROL SE LE DA AL EQUIPO, NO A LA PERSONA
-- ---------------------------------------------------------------------
ALTER TYPE identidad.tipo_alcance ADD VALUE IF NOT EXISTS 'unidad';

CREATE TABLE identidad.asignaciones_unidad (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidad_id      uuid NOT NULL REFERENCES org.unidades(id) ON DELETE RESTRICT,
  rol            text NOT NULL REFERENCES identidad.roles(codigo),
  alcance_tipo   identidad.tipo_alcance NOT NULL,
  alcance_id     uuid,
  nivel_max      smallint NOT NULL REFERENCES plataforma.niveles_sensibilidad(nivel),
  vigente_desde  date NOT NULL DEFAULT CURRENT_DATE,
  vigente_hasta  date,
  otorgado_por   uuid REFERENCES nucleo.personas(id),
  acta_referencia text,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT asig_unidad_vigencia CHECK (vigente_hasta IS NULL OR vigente_hasta >= vigente_desde),
  CONSTRAINT asig_unidad_alcance CHECK (
    (alcance_tipo IN ('organizacion','caso_propio','persona_propia') AND alcance_id IS NULL)
    OR (alcance_tipo IN ('sede','ministerio','grupo','unidad') AND alcance_id IS NOT NULL))
);
CREATE INDEX asig_unidad_idx ON identidad.asignaciones_unidad (unidad_id) WHERE vigente_hasta IS NULL;

COMMENT ON TABLE identidad.asignaciones_unidad IS
  'El permiso del EQUIPO. Quien pertenece lo hereda; quien sale lo pierde el mismo dia, sin que nadie tenga que acordarse.';

-- El mismo techo de rol que gobierna las asignaciones personales.
CREATE OR REPLACE FUNCTION identidad.tg_asig_unidad_respeta_techo() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_techo smallint;
BEGIN
  SELECT nivel_maximo INTO v_techo FROM identidad.roles WHERE codigo = NEW.rol;
  IF NEW.nivel_max > v_techo THEN
    RAISE EXCEPTION 'El rol % admite como maximo N%, se intento asignar N% a la unidad', NEW.rol, v_techo, NEW.nivel_max
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_asig_unidad_respeta_techo
  BEFORE INSERT OR UPDATE ON identidad.asignaciones_unidad
  FOR EACH ROW EXECUTE FUNCTION identidad.tg_asig_unidad_respeta_techo();

-- ---------------------------------------------------------------------
-- 4 · LAS SEDES QUE ALCANZA UNA UNIDAD · el árbol, hacia abajo
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION org.unidades_bajo(p_unidad uuid)
RETURNS TABLE(id uuid) LANGUAGE sql STABLE AS $$
  WITH RECURSIVE arbol AS (
    SELECT u.id FROM org.unidades u WHERE u.id = p_unidad AND u.activa
    UNION ALL
    SELECT h.id FROM org.unidades h JOIN arbol a ON h.padre_id = a.id WHERE h.activa
  )
  SELECT arbol.id FROM arbol;
$$;

CREATE OR REPLACE FUNCTION org.sedes_de_unidad(p_unidad uuid)
RETURNS uuid[] LANGUAGE sql STABLE AS $$
  SELECT COALESCE(array_agg(s.id), '{}'::uuid[])
  FROM org.sedes s
  WHERE s.activa AND s.unidad_id IN (SELECT id FROM org.unidades_bajo(p_unidad));
$$;

COMMENT ON FUNCTION org.sedes_de_unidad IS
  'Las sedes que cuelgan de una unidad y de todo lo que hay debajo. Un rol sobre la region de Bogota alcanza las sedes de Bogota, ni una mas.';

-- ---------------------------------------------------------------------
-- 5 · EL PERMISO EFECTIVO SUMA LO PROPIO Y LO HEREDADO
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW identidad.v_permiso_efectivo AS
-- lo que le dieron a la persona
SELECT a.persona_id,
       a.rol,
       a.alcance_tipo,
       a.alcance_id,
       LEAST(a.nivel_max, r.nivel_maximo) AS nivel_efectivo,
       (a.vigente_desde <= CURRENT_DATE
        AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)) AS vigente,
       'directo'::text AS origen,
       NULL::uuid      AS unidad_id
FROM identidad.asignaciones a
JOIN identidad.roles r ON r.codigo = a.rol

UNION ALL

-- lo que hereda por pertenecer hoy a un equipo
SELECT m.persona_id,
       au.rol,
       au.alcance_tipo,
       au.alcance_id,
       LEAST(au.nivel_max, r.nivel_maximo) AS nivel_efectivo,
       (au.vigente_desde <= CURRENT_DATE
        AND (au.vigente_hasta IS NULL OR au.vigente_hasta >= CURRENT_DATE)
        AND m.desde <= CURRENT_DATE
        AND (m.hasta IS NULL OR m.hasta >= CURRENT_DATE)) AS vigente,
       'equipo'::text AS origen,
       au.unidad_id
FROM identidad.asignaciones_unidad au
JOIN org.unidad_miembros m ON m.unidad_id = au.unidad_id
JOIN identidad.roles r ON r.codigo = au.rol;

COMMENT ON VIEW identidad.v_permiso_efectivo IS
  'Permiso = rol x alcance x nivel x vigencia, venga de una asignacion personal o heredado de un equipo. La columna origen dice de donde viene, que es lo primero que pregunta una auditoria.';

-- Y las sedes que alcanza una persona incluyen ahora las de su unidad.
CREATE OR REPLACE FUNCTION identidad.sedes_de(p_persona_id uuid) RETURNS uuid[]
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(array_agg(DISTINCT sede), '{}'::uuid[]) FROM (
    -- alcance de organizacion o de una sede concreta
    SELECT s.id AS sede
    FROM identidad.v_permiso_efectivo pe
    JOIN org.sedes s ON (pe.alcance_tipo = 'organizacion' OR s.id = pe.alcance_id)
    WHERE pe.persona_id = p_persona_id AND pe.vigente
    UNION
    -- alcance sobre una unidad: se expande a las sedes que cuelgan de ella
    SELECT unnest(org.sedes_de_unidad(pe.alcance_id)) AS sede
    FROM identidad.v_permiso_efectivo pe
    WHERE pe.persona_id = p_persona_id AND pe.vigente
      AND pe.alcance_tipo = 'unidad' AND pe.alcance_id IS NOT NULL
  ) x WHERE sede IS NOT NULL;
$$;

-- ---------------------------------------------------------------------
-- 6 · VISTAS DE TRABAJO
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW org.v_organigrama
WITH (security_invoker = true) AS
WITH RECURSIVE arbol AS (
  SELECT u.id, u.codigo, u.nombre, u.clase, u.padre_id, 0 AS nivel,
         u.nombre::text AS ruta
  FROM org.unidades u WHERE u.padre_id IS NULL
  UNION ALL
  SELECT h.id, h.codigo, h.nombre, h.clase, h.padre_id, a.nivel + 1,
         (a.ruta || ' > ' || h.nombre)::text
  FROM org.unidades h JOIN arbol a ON h.padre_id = a.id
)
SELECT a.*,
       (SELECT count(*) FROM org.unidad_miembros m WHERE m.unidad_id = a.id AND m.hasta IS NULL) AS integrantes,
       (SELECT count(*) FROM org.sedes s WHERE s.unidad_id = a.id AND s.activa) AS sedes_directas,
       array_length(org.sedes_de_unidad(a.id), 1) AS sedes_que_alcanza
FROM arbol a;

CREATE OR REPLACE VIEW identidad.v_quien_tiene_que
WITH (security_invoker = true) AS
SELECT pe.persona_id,
       p.primer_nombre || ' ' || p.primer_apellido AS persona,
       pe.rol, r.nombre AS rol_nombre,
       pe.alcance_tipo, pe.alcance_id, pe.nivel_efectivo, pe.origen,
       u.nombre AS equipo
FROM identidad.v_permiso_efectivo pe
JOIN nucleo.personas p ON p.id = pe.persona_id
JOIN identidad.roles r ON r.codigo = pe.rol
LEFT JOIN org.unidades u ON u.id = pe.unidad_id
WHERE pe.vigente;

COMMENT ON VIEW identidad.v_quien_tiene_que IS
  'La respuesta a «quien puede ver esto y por que». Es la consulta que pide toda auditoria de accesos.';

-- ---------------------------------------------------------------------
-- 7 · EXPOSICIÓN · las tablas nuevas nacieron cerradas (migración 0042)
-- ---------------------------------------------------------------------
SELECT plataforma.publicar_tabla('org.clases_unidad'::regclass, 'catalogo_red',
  'Catalogo de clases de unidad organizativa. No contiene personas.', 'Mesa tecnica 100p', false);
SELECT plataforma.publicar_tabla('org.unidades'::regclass, 'catalogo_red',
  'El organigrama de la red. Saber que existe el equipo de Finanzas no revela ningun dato de persona, y toda pantalla lo necesita.', 'Mesa tecnica 100p', false);

-- La pertenencia SÍ es dato de persona: va con seguridad por fila.
ALTER TABLE org.unidad_miembros ENABLE ROW LEVEL SECURITY;
ALTER TABLE org.unidad_miembros FORCE ROW LEVEL SECURITY;
CREATE POLICY unidad_miembros_sel ON org.unidad_miembros FOR SELECT
  USING (
    plataforma.ctx_es_global()
    OR persona_id = plataforma.ctx_persona_id()
    OR EXISTS (SELECT 1 FROM nucleo.personas p
               WHERE p.id = org.unidad_miembros.persona_id
                 AND plataforma.sede_visible(p.sede_id))
  );
CREATE POLICY unidad_miembros_ins ON org.unidad_miembros FOR INSERT
  WITH CHECK (plataforma.ctx_es_global());
CREATE POLICY unidad_miembros_upd ON org.unidad_miembros FOR UPDATE
  USING (plataforma.ctx_es_global()) WITH CHECK (plataforma.ctx_es_global());
GRANT SELECT, INSERT, UPDATE ON org.unidad_miembros TO casaroca_app;
INSERT INTO plataforma.registro_exposicion (esquema, tabla, modo, justificacion, decidido_por)
VALUES ('org','unidad_miembros','por_persona',
        'La pertenencia a un equipo es dato de persona: se ve si la persona es visible, si es uno mismo, o con alcance de organizacion.',
        'Mesa tecnica 100p');

ALTER TABLE identidad.asignaciones_unidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE identidad.asignaciones_unidad FORCE ROW LEVEL SECURITY;
CREATE POLICY asig_unidad_sel ON identidad.asignaciones_unidad FOR SELECT USING (true);
CREATE POLICY asig_unidad_ins ON identidad.asignaciones_unidad FOR INSERT
  WITH CHECK (plataforma.ctx_es_global());
CREATE POLICY asig_unidad_upd ON identidad.asignaciones_unidad FOR UPDATE
  USING (plataforma.ctx_es_global()) WITH CHECK (plataforma.ctx_es_global());
GRANT SELECT, INSERT, UPDATE ON identidad.asignaciones_unidad TO casaroca_app;
INSERT INTO plataforma.registro_exposicion (esquema, tabla, modo, justificacion, decidido_por)
VALUES ('identidad','asignaciones_unidad','por_persona',
        'Que rol tiene un equipo es legible por todos (como identidad.roles); otorgarlo exige alcance de organizacion.',
        'Mesa tecnica 100p');

GRANT SELECT ON org.v_organigrama, identidad.v_quien_tiene_que TO casaroca_app;
