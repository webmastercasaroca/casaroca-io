-- =====================================================================
-- Migración 0049 — SALVAGUARDA DE MENORES Y DERECHOS DEL TITULAR
--
-- ⛔ LA CONTRADICCIÓN QUE ENCONTRÓ LA AUDITORÍA (hallazgo H-09): el sistema
--    protege los datos de los menores mejor que la mayoría (acudiente
--    obligatorio, código de entrega cifrado, nadie los exporta) y AL MISMO
--    TIEMPO permitía asignar a un maestro de niños sin verificar nada.
--
--    Proteger el dato del menor y no verificar a quien está con el menor es
--    proteger la parte equivocada.
--
-- ⭐ LO QUE ENTRA:
--    1 · `talento.antecedentes`: la verificación, con vigencia y renovación.
--    2 · La base IMPIDE asignar un rol de menores sin antecedentes vigentes.
--        No es una recomendación del manual: es un disparador.
--    3 · La regla de dos adultos por sala, medible.
--    4 · `plataforma.peticiones_titular`: consulta y reclamo de la Ley 1581,
--        con sus plazos contados y un responsable con nombre. Sin esto, el
--        derecho existe en el aviso de privacidad y no en el sistema.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · ANTECEDENTES
-- ---------------------------------------------------------------------
CREATE TABLE talento.tipos_antecedente (
  codigo      text PRIMARY KEY,
  nombre      text NOT NULL,
  descripcion text NOT NULL,
  meses_vigencia smallint NOT NULL DEFAULT 12,
  exigido_para_menores boolean NOT NULL DEFAULT false
);
INSERT INTO talento.tipos_antecedente (codigo, nombre, descripcion, meses_vigencia, exigido_para_menores) VALUES
 ('JUDICIAL',  'Antecedentes judiciales',   'Certificado de la Policia Nacional.', 12, true),
 ('DELITOS_SEXUALES', 'Registro de delitos sexuales contra menores',
  'Consulta obligatoria para quien sirve con ninos.', 12, true),
 ('REFERENCIAS', 'Referencias personales verificadas',
  'Dos referencias contactadas y registradas.', 24, true),
 ('ENTREVISTA', 'Entrevista de salvaguarda',
  'Entrevista con el equipo pastoral sobre proteccion de menores.', 24, true),
 ('FORMACION_KIDS', 'Curso de salvaguarda aprobado',
  'El curso KID-02 de proteccion de menores, aprobado.', 24, true),
 ('DISCIPLINARIO', 'Antecedentes disciplinarios', 'Para cargos administrativos.', 12, false);

CREATE TABLE talento.antecedentes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id    uuid NOT NULL REFERENCES nucleo.personas(id) ON DELETE RESTRICT,
  tipo          text NOT NULL REFERENCES talento.tipos_antecedente(codigo),
  resultado     text NOT NULL CHECK (resultado IN ('apto','no_apto','con_observacion','en_tramite')),
  expedido_en   date NOT NULL,
  vence_en      date NOT NULL,
  verificado_por uuid REFERENCES nucleo.personas(id),
  referencia    text,
  observacion   text,
  sede_id       uuid NOT NULL REFERENCES org.sedes(id),
  creado_en     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT antecedente_vigencia CHECK (vence_en > expedido_en)
);
CREATE INDEX antecedentes_persona_idx ON talento.antecedentes (persona_id, tipo, vence_en DESC);

COMMENT ON TABLE talento.antecedentes IS
  'La verificacion de quien sirve. Vence a proposito: un antecedente de hace cuatro anos no dice nada de hoy.';

CREATE OR REPLACE FUNCTION talento.apto_para_menores(p_persona uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT NOT EXISTS (
    -- Falta alguno de los exigidos, o el que hay no es «apto» y vigente.
    SELECT 1 FROM talento.tipos_antecedente t
    WHERE t.exigido_para_menores
      AND NOT EXISTS (
        SELECT 1 FROM talento.antecedentes a
        WHERE a.persona_id = p_persona AND a.tipo = t.codigo
          AND a.resultado = 'apto' AND a.vence_en >= CURRENT_DATE)
  );
$$;

COMMENT ON FUNCTION talento.apto_para_menores IS
  'Verdadero solo si TODOS los antecedentes exigidos estan y estan vigentes. Basta que uno venza para que deje de ser apto.';

-- ---------------------------------------------------------------------
-- 2 · ⭐ LA BASE IMPIDE ASIGNAR UN ROL DE MENORES SIN ANTECEDENTES
-- ---------------------------------------------------------------------
CREATE TABLE identidad.roles_con_menores (
  rol text PRIMARY KEY REFERENCES identidad.roles(codigo),
  motivo text NOT NULL
);
-- ⛔ El CONTENIDO va en el seed 021: `identidad.roles` se siembra despues
--    de las migraciones, asi que aqui la clave foranea todavia no tiene a
--    que apuntar. Es la misma razon por la que la migracion 0040 dejo sus
--    roles y permisos para el seed 018.

CREATE OR REPLACE FUNCTION identidad.tg_rol_de_menores_exige_antecedentes() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_motivo text; v_falta text;
BEGIN
  SELECT motivo INTO v_motivo FROM identidad.roles_con_menores WHERE rol = NEW.rol;
  IF v_motivo IS NULL THEN RETURN NEW; END IF;

  IF NOT talento.apto_para_menores(NEW.persona_id) THEN
    SELECT string_agg(t.nombre, ', ') INTO v_falta
    FROM talento.tipos_antecedente t
    WHERE t.exigido_para_menores
      AND NOT EXISTS (SELECT 1 FROM talento.antecedentes a
                      WHERE a.persona_id = NEW.persona_id AND a.tipo = t.codigo
                        AND a.resultado = 'apto' AND a.vence_en >= CURRENT_DATE);
    RAISE EXCEPTION
      'No se puede asignar el rol % sin antecedentes vigentes. %. Falta o esta vencido: %',
      NEW.rol, v_motivo, v_falta
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_rol_de_menores_exige_antecedentes
  BEFORE INSERT OR UPDATE ON identidad.asignaciones
  FOR EACH ROW EXECUTE FUNCTION identidad.tg_rol_de_menores_exige_antecedentes();

-- Y la lista de trabajo: a quién se le vence, para renovarlo ANTES.
CREATE OR REPLACE VIEW talento.v_antecedentes_por_vencer
WITH (security_invoker = true) AS
SELECT a.persona_id,
       p.primer_nombre||' '||p.primer_apellido AS persona,
       s.codigo AS sede, t.nombre AS antecedente,
       a.vence_en, (a.vence_en - CURRENT_DATE) AS dias,
       EXISTS (SELECT 1 FROM identidad.asignaciones x
               JOIN identidad.roles_con_menores rm ON rm.rol = x.rol
               WHERE x.persona_id = a.persona_id AND x.revocada_en IS NULL
                 AND (x.vigente_hasta IS NULL OR x.vigente_hasta >= CURRENT_DATE)) AS sirve_con_menores
FROM talento.antecedentes a
JOIN talento.tipos_antecedente t ON t.codigo = a.tipo
JOIN nucleo.personas p ON p.id = a.persona_id
LEFT JOIN org.sedes s ON s.id = a.sede_id
WHERE a.resultado = 'apto' AND a.vence_en <= CURRENT_DATE + 60;

-- ---------------------------------------------------------------------
-- 3 · LA REGLA DE DOS ADULTOS
-- ---------------------------------------------------------------------
CREATE TABLE rocakids.servidores_sala (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id    uuid NOT NULL REFERENCES rocakids.salas(id) ON DELETE RESTRICT,
  persona_id uuid NOT NULL REFERENCES nucleo.personas(id) ON DELETE RESTRICT,
  sede_id    uuid NOT NULL REFERENCES org.sedes(id),
  fecha      date NOT NULL DEFAULT CURRENT_DATE,
  entro_en   timestamptz NOT NULL DEFAULT now(),
  salio_en   timestamptz,
  UNIQUE (sala_id, persona_id, fecha)
);
CREATE INDEX servidores_sala_idx ON rocakids.servidores_sala (sala_id, fecha);

COMMENT ON TABLE rocakids.servidores_sala IS
  'Quien estuvo en cada sala, cada domingo. Es la respuesta a «quien estaba con los ninos ese dia», que es la primera pregunta de cualquier incidente.';

-- Nadie sirve en una sala de niños sin antecedentes vigentes.
CREATE OR REPLACE FUNCTION rocakids.tg_servidor_apto() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT talento.apto_para_menores(NEW.persona_id) THEN
    RAISE EXCEPTION 'Esa persona no tiene los antecedentes vigentes para estar en una sala de ninos'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_servidor_apto BEFORE INSERT ON rocakids.servidores_sala
  FOR EACH ROW EXECUTE FUNCTION rocakids.tg_servidor_apto();

CREATE OR REPLACE VIEW rocakids.v_salas_sin_dos_adultos
WITH (security_invoker = true) AS
SELECT s.id AS sala_id, s.sede_id, s.codigo AS sala, s.nombre,
       d.fecha,
       count(*) FILTER (WHERE d.salio_en IS NULL) AS adultos_presentes,
       (SELECT count(*) FROM rocakids.checkins c
         WHERE c.sala_id = s.id AND c.ingreso_en::date = d.fecha
           AND c.salida_en IS NULL) AS ninos_presentes
FROM rocakids.salas s
JOIN rocakids.servidores_sala d ON d.sala_id = s.id
GROUP BY s.id, s.sede_id, s.codigo, s.nombre, d.fecha
HAVING count(*) FILTER (WHERE d.salio_en IS NULL) < 2;

COMMENT ON VIEW rocakids.v_salas_sin_dos_adultos IS
  'La regla de dos adultos, medible. Una sala con ninos y un solo adulto es una alerta del domingo, no un hallazgo de auditoria seis meses despues.';

-- ---------------------------------------------------------------------
-- 4 · DERECHOS DEL TITULAR (Ley 1581) · con plazos contados
-- ---------------------------------------------------------------------
CREATE TABLE plataforma.peticiones_titular (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  radicado      text NOT NULL UNIQUE,
  tipo          text NOT NULL CHECK (tipo IN ('consulta','reclamo','supresion','revocacion','actualizacion')),
  titular_id    uuid REFERENCES nucleo.personas(id),
  titular_nombre text NOT NULL,
  titular_documento text,
  titular_contacto text NOT NULL,
  detalle       text NOT NULL,
  canal         text NOT NULL,
  recibida_en   timestamptz NOT NULL DEFAULT now(),
  -- ⛔ Los plazos son de la ley, no del equipo: la consulta se atiende en
  --    10 dias habiles y el reclamo en 15. Se calculan al radicar.
  vence_en      date NOT NULL,
  responsable_id uuid REFERENCES nucleo.personas(id),
  estado        text NOT NULL DEFAULT 'recibida'
                CHECK (estado IN ('recibida','en_tramite','prorrogada','atendida','rechazada')),
  respondida_en timestamptz,
  respuesta     text,
  evidencia     text,
  sede_id       uuid REFERENCES org.sedes(id)
);
CREATE INDEX peticiones_vence_idx ON plataforma.peticiones_titular (vence_en) WHERE estado NOT IN ('atendida','rechazada');

CREATE OR REPLACE FUNCTION plataforma.dias_habiles_desde(p_desde date, p_dias int)
RETURNS date LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE d date := p_desde; n int := 0;
BEGIN
  WHILE n < p_dias LOOP
    d := d + 1;
    IF extract(isodow from d) < 6 THEN n := n + 1; END IF;
  END LOOP;
  RETURN d;
END $$;

CREATE OR REPLACE FUNCTION plataforma.tg_peticion_calcula_plazo() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.vence_en IS NULL THEN
    NEW.vence_en := plataforma.dias_habiles_desde(NEW.recibida_en::date,
      CASE WHEN NEW.tipo = 'consulta' THEN 10 ELSE 15 END);
  END IF;
  IF NEW.radicado IS NULL OR NEW.radicado = '' THEN
    NEW.radicado := 'HD-'||to_char(now(),'YYYYMMDD')||'-'||substr(gen_random_uuid()::text,1,6);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_peticion_calcula_plazo BEFORE INSERT ON plataforma.peticiones_titular
  FOR EACH ROW EXECUTE FUNCTION plataforma.tg_peticion_calcula_plazo();

ALTER TABLE plataforma.peticiones_titular ALTER COLUMN vence_en DROP NOT NULL;
ALTER TABLE plataforma.peticiones_titular ALTER COLUMN radicado DROP NOT NULL;

CREATE OR REPLACE VIEW plataforma.v_peticiones_titular_vencidas
WITH (security_invoker = true) AS
SELECT p.radicado, p.tipo, p.titular_nombre, p.recibida_en, p.vence_en,
       (CURRENT_DATE - p.vence_en) AS dias_de_retraso,
       p.estado, r.primer_nombre||' '||r.primer_apellido AS responsable
FROM plataforma.peticiones_titular p
LEFT JOIN nucleo.personas r ON r.id = p.responsable_id
WHERE p.estado NOT IN ('atendida','rechazada') AND p.vence_en < CURRENT_DATE;

COMMENT ON VIEW plataforma.v_peticiones_titular_vencidas IS
  'Peticion de un titular fuera de plazo. Una sola fila aqui es un incumplimiento de la Ley 1581, no un pendiente.';

-- ---------------------------------------------------------------------
-- 5 · EXPOSICIÓN
-- ---------------------------------------------------------------------
SELECT plataforma.publicar_tabla('talento.tipos_antecedente'::regclass, 'catalogo_red',
  'Catalogo de tipos de antecedente exigidos por la red. No contiene personas.', 'Mesa tecnica 100p', false);
SELECT plataforma.publicar_tabla('identidad.roles_con_menores'::regclass, 'catalogo_red',
  'Que roles exigen antecedentes. Es politica de la red, publica a proposito.', 'Mesa tecnica 100p', false);
SELECT plataforma.publicar_tabla('talento.antecedentes'::regclass, 'por_sede',
  'Antecedentes de quien sirve: dato sensible de la sede donde sirve.', 'Mesa tecnica 100p', true);
SELECT plataforma.publicar_tabla('rocakids.servidores_sala'::regclass, 'por_sede',
  'Quien estuvo en cada sala. Es dato de menores por contexto: se ve solo en su sede.', 'Mesa tecnica 100p', true);
SELECT plataforma.publicar_tabla('plataforma.peticiones_titular'::regclass, 'por_sede',
  'Peticiones de Habeas Data. Las ve la sede que las recibe y quien tiene alcance de organizacion.', 'Mesa tecnica 100p', true);

GRANT SELECT ON talento.v_antecedentes_por_vencer, rocakids.v_salas_sin_dos_adultos,
                plataforma.v_peticiones_titular_vencidas TO casaroca_app;
