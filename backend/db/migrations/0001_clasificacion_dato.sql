-- =====================================================================
-- Migración 0001 — CLASIFICACIÓN DEL DATO N0–N4
-- La etiqueta no es documental: activa controles. Una columna registrada
-- como N3 queda obligada a cifrado y a bitácora de LECTURA, y el registro
-- es verificable por consulta (no por confianza en el programador).
--
-- Corrige la divergencia nº 8 del modelo del equipo 100p: un booleano
-- `datos_sensibles` no puede activar controles distintos por nivel.
-- =====================================================================

CREATE TABLE plataforma.niveles_sensibilidad (
  nivel               smallint PRIMARY KEY CHECK (nivel BETWEEN 0 AND 4),
  codigo              text NOT NULL UNIQUE,
  descripcion         text NOT NULL,
  exige_cifrado       boolean NOT NULL DEFAULT false,
  exige_bitacora_lect boolean NOT NULL DEFAULT false,
  exige_enmascarado   boolean NOT NULL DEFAULT false
);

INSERT INTO plataforma.niveles_sensibilidad VALUES
  (0,'N0','Público. Puede salir del sistema sin control.',                       false,false,false),
  (1,'N1','Interno. Organización, sedes, catálogos. Sin dato personal.',         false,false,false),
  (2,'N2','Dato personal ordinario. Ley 1581: exige finalidad y consentimiento.',false,false,false),
  (3,'N3','Sensible. Aportes, notas pastorales, consejería, salud.',             true, true, true),
  (4,'N4','Menores de edad. Protección reforzada; el más restringido.',          true, true, true);

COMMENT ON TABLE plataforma.niveles_sensibilidad IS
  'N3 = aportes / notas pastorales / consejería. N4 = menores. La etiqueta activa el control, no lo describe.';

-- ---------------------------------------------------------------------
-- Registro columna por columna. Permite auditar de un vistazo:
--   «enséñame toda columna N3 que NO esté cifrada» → debe dar cero filas.
-- ---------------------------------------------------------------------
CREATE TABLE plataforma.clasificacion_columna (
  esquema      text     NOT NULL,
  tabla        text     NOT NULL,
  columna      text     NOT NULL,
  nivel        smallint NOT NULL REFERENCES plataforma.niveles_sensibilidad(nivel),
  finalidad    text     NOT NULL,
  cifrada      boolean  NOT NULL DEFAULT false,
  registrado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (esquema, tabla, columna)
);

-- La columna registrada tiene que existir de verdad. Sin esto el registro
-- se convierte en un documento que envejece; con esto, en una restricción.
CREATE OR REPLACE FUNCTION plataforma.tg_clasificacion_columna_existe() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = NEW.esquema AND c.table_name = NEW.tabla AND c.column_name = NEW.columna
  ) THEN
    RAISE EXCEPTION 'No se puede clasificar %.%.%: la columna no existe', NEW.esquema, NEW.tabla, NEW.columna
      USING ERRCODE = 'undefined_column';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER trg_clasificacion_columna_existe
  BEFORE INSERT OR UPDATE ON plataforma.clasificacion_columna
  FOR EACH ROW EXECUTE FUNCTION plataforma.tg_clasificacion_columna_existe();

-- Vista de control para el CTO y para la compuerta G5 (prueba de intrusión).
CREATE OR REPLACE VIEW plataforma.v_control_clasificacion AS
SELECT c.esquema, c.tabla, c.columna, c.nivel, n.codigo,
       n.exige_cifrado, c.cifrada,
       (n.exige_cifrado AND NOT c.cifrada) AS incumple_cifrado
FROM plataforma.clasificacion_columna c
JOIN plataforma.niveles_sensibilidad n USING (nivel);

COMMENT ON VIEW plataforma.v_control_clasificacion IS
  'Control de la compuerta G5: toda fila con incumple_cifrado = true es un hallazgo.';
