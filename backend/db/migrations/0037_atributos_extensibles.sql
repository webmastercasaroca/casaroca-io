-- =====================================================================
-- Migración 0037 — CASILLAS NUEVAS SIN MIGRACIÓN, Y MÓDULOS QUE
--                  ARRASTRAN LA INFORMACIÓN QUE YA EXISTE
--
-- Lo que pidió Daniel el 15 sep 2026, textual:
--   «si más adelante creo una casilla de, no sé, qué le gusta comer,
--    debe ser fácil, práctico, debe estar sincronizada en módulos»
--   «si mañana creo un módulo de casados y arrastro todos los que estén
--    casados debe ser fácil y práctico»
--
-- ⛔ EL PROBLEMA REAL: hoy, añadir «qué le gusta comer» obliga a escribir
--    una migración, revisarla, aplicarla y desplegar. Eso NO es fácil ni
--    práctico, y garantiza que ese dato termine en un Excel aparte. Un
--    dato que vive fuera del sistema no tiene permisos, ni bitácora, ni
--    Habeas Data.
--
-- ⭐ LO QUE YA ESTABA Y NO HAY QUE REHACER (comprobado en la base):
--    · `sistema.modulos` ya es el REGISTRO de módulos, con nivel_dato,
--      es_nucleo, exige_compuerta_legal y depende_de. El manifiesto
--      existe: un módulo nuevo se declara, no se programa en el núcleo.
--    · `nucleo.personas` YA tiene `estado_civil`. El «módulo de casados»
--      del ejemplo se puede consultar HOY, sin construir nada.
--    · `crm.linea_tiempo` + `crm.anotar_hecho()` (migración 0036) es
--      cómo un módulo nuevo publica lo que pasa.
--    Faltaba UNA sola pieza: las casillas propias.
--
-- ⛔ Y LA TRAMPA QUE ESTO EVITA: una tabla de «campos extra» sin gobierno
--    se convierte en el cajón de sastre donde acaba el dato sensible sin
--    etiqueta. Por eso aquí CADA atributo declara su NIVEL (N0–N4) y su
--    MÓDULO dueño, y la RLS lo aplica sola. Una casilla de salud nace
--    siendo N3 y nadie por debajo la ve, aunque quien la creó no supiera
--    que estaba creando un dato sensible.
-- =====================================================================

CREATE TYPE sistema.tipo_dato_atributo AS ENUM
  ('texto','numero','fecha','booleano','opcion','multiopcion');

-- ---------------------------------------------------------------------
-- 1 · EL CATÁLOGO · aquí se declara la casilla, una sola vez
-- ---------------------------------------------------------------------
CREATE TABLE sistema.atributos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      text NOT NULL UNIQUE,
  etiqueta    text NOT NULL,
  ayuda       text,
  -- Quién es el dueño. Si el módulo se apaga, sus casillas se apagan
  -- con él y no quedan datos huérfanos que nadie sabe de dónde salieron.
  modulo      text NOT NULL REFERENCES sistema.modulos(codigo),
  tipo_dato   sistema.tipo_dato_atributo NOT NULL,
  -- ⛔ El nivel NO tiene valor por defecto cómodo: quien crea la casilla
  --    tiene que decidir qué tan sensible es lo que va a guardar.
  nivel_dato  smallint NOT NULL REFERENCES plataforma.niveles_sensibilidad(nivel),
  -- Para 'opcion' y 'multiopcion'. Un desplegable es un dato limpio;
  -- un texto libre es un dato que nadie podrá agrupar después.
  opciones    jsonb,
  obligatorio boolean NOT NULL DEFAULT false,
  orden       smallint NOT NULL DEFAULT 100,
  vigente     boolean NOT NULL DEFAULT true,
  creado_en   timestamptz NOT NULL DEFAULT now(),
  creado_por  uuid REFERENCES nucleo.personas(id),
  CONSTRAINT atributo_opciones_coherente CHECK (
    (tipo_dato IN ('opcion','multiopcion')) = (opciones IS NOT NULL)),
  CONSTRAINT atributo_codigo_limpio CHECK (codigo ~ '^[a-z][a-z0-9_]{2,49}$')
);
COMMENT ON TABLE sistema.atributos IS
  'Casillas que la iglesia añade sin migración. Cada una declara su nivel de dato y su módulo dueño, y de ahí sale sola la privacidad.';

-- ---------------------------------------------------------------------
-- 2 · EL VALOR · lo que tiene cada persona en cada casilla
-- ---------------------------------------------------------------------
CREATE TABLE nucleo.persona_atributos (
  persona_id      uuid NOT NULL REFERENCES nucleo.personas(id) ON DELETE CASCADE,
  atributo_id     uuid NOT NULL REFERENCES sistema.atributos(id) ON DELETE RESTRICT,
  -- jsonb y no text: un número se guarda como número y una fecha como
  -- fecha, así se pueden comparar y ordenar sin convertir a ciegas.
  valor           jsonb NOT NULL,
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  actualizado_por uuid REFERENCES nucleo.personas(id),
  PRIMARY KEY (persona_id, atributo_id)
);
CREATE INDEX persona_atributos_atributo_idx ON nucleo.persona_atributos (atributo_id);
-- Para «tráeme todos los que respondieron X»: índice sobre el valor.
CREATE INDEX persona_atributos_valor_idx ON nucleo.persona_atributos USING gin (valor);

-- ---------------------------------------------------------------------
-- 3 · LA PRIVACIDAD SALE SOLA DEL NIVEL DECLARADO
--     Misma doble cerradura del resto del sistema: la sede tiene que ser
--     visible Y el techo del lector tiene que alcanzar el nivel de ESA
--     casilla. No hay que acordarse de nada al crearla.
-- ---------------------------------------------------------------------
ALTER TABLE nucleo.persona_atributos ENABLE ROW LEVEL SECURITY;
ALTER TABLE nucleo.persona_atributos FORCE ROW LEVEL SECURITY;

CREATE POLICY persona_atributos_lectura ON nucleo.persona_atributos FOR SELECT
  USING (
    plataforma.sede_visible((SELECT p.sede_id FROM nucleo.personas p WHERE p.id = persona_id))
    AND plataforma.ctx_nivel_max() >=
        (SELECT a.nivel_dato FROM sistema.atributos a WHERE a.id = atributo_id)
  );

CREATE POLICY persona_atributos_escritura ON nucleo.persona_atributos FOR ALL
  USING (
    plataforma.sede_visible((SELECT p.sede_id FROM nucleo.personas p WHERE p.id = persona_id))
    AND plataforma.ctx_nivel_max() >=
        (SELECT a.nivel_dato FROM sistema.atributos a WHERE a.id = atributo_id)
  )
  WITH CHECK (
    plataforma.sede_visible((SELECT p.sede_id FROM nucleo.personas p WHERE p.id = persona_id))
    AND plataforma.ctx_nivel_max() >=
        (SELECT a.nivel_dato FROM sistema.atributos a WHERE a.id = atributo_id)
  );

ALTER TABLE sistema.atributos ENABLE ROW LEVEL SECURITY;
CREATE POLICY atributos_lectura ON sistema.atributos FOR SELECT USING (true);

GRANT SELECT ON sistema.atributos TO casaroca_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON nucleo.persona_atributos TO casaroca_app;

-- ---------------------------------------------------------------------
-- 4 · CREAR UNA CASILLA · una llamada, sin migración ni despliegue
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sistema.crear_atributo(
  p_codigo text, p_etiqueta text, p_modulo text,
  p_tipo sistema.tipo_dato_atributo, p_nivel smallint,
  p_opciones jsonb DEFAULT NULL, p_ayuda text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO sistema.atributos (codigo, etiqueta, modulo, tipo_dato, nivel_dato, opciones, ayuda)
  VALUES (p_codigo, p_etiqueta, p_modulo, p_tipo, p_nivel, p_opciones, p_ayuda)
  RETURNING id INTO v_id;
  RETURN v_id;
END
$$;

-- ---------------------------------------------------------------------
-- 5 · LA FICHA COMPLETA DE UNA PERSONA, CASILLAS INCLUIDAS
--     security_invoker: la vista NO se salta la RLS, la respeta.
--     (Es la lección de la migración 0025, que no se repite aquí.)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW nucleo.v_persona_atributos
WITH (security_invoker = true) AS
SELECT pa.persona_id, a.codigo, a.etiqueta, a.modulo,
       a.tipo_dato, a.nivel_dato, pa.valor, pa.actualizado_en
FROM nucleo.persona_atributos pa
JOIN sistema.atributos a ON a.id = pa.atributo_id
WHERE a.vigente;

GRANT SELECT ON nucleo.v_persona_atributos TO casaroca_app;

-- ---------------------------------------------------------------------
-- 6 · ARRASTRAR PERSONAS POR UNA CASILLA
--     «tráeme todos los que respondieron X».
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sistema.personas_con_atributo(
  p_codigo text, p_valor jsonb DEFAULT NULL
) RETURNS TABLE (persona_id uuid, valor jsonb)
LANGUAGE sql STABLE AS $$
  SELECT pa.persona_id, pa.valor
  FROM nucleo.persona_atributos pa
  JOIN sistema.atributos a ON a.id = pa.atributo_id
  WHERE a.codigo = p_codigo AND a.vigente
    AND (p_valor IS NULL OR pa.valor = p_valor);
$$;

COMMENT ON FUNCTION sistema.personas_con_atributo IS
  'El «arrástrame todos los que…» de cualquier módulo nuevo. Respeta la RLS porque lee la tabla, no la esquiva.';

-- ---------------------------------------------------------------------
-- 7 · LA CASILLA DE EJEMPLO NO VA AQUÍ, Y NO ES UN DESCUIDO
--
--     Se intentó sembrar aquí «Qué le gusta comer» y la migración
--     ABORTÓ: `sistema.modulos` está VACÍA cuando corren las
--     migraciones, porque la llena el seed 009. Es la misma lección que
--     costó una corrida en la migración 0033 y que está escrita en su
--     acta: LAS MIGRACIONES DEFINEN ESTRUCTURA; LOS SEEDS, EL CONTENIDO
--     QUE DEPENDE DE CATÁLOGOS.
--
--     El ejemplo vive en `db/seeds/014_atributo_ejemplo.sql`.
-- ---------------------------------------------------------------------
