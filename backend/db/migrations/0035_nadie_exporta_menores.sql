-- =====================================================================
-- Migración 0035 — NADIE EXPORTA DATOS DE MENORES. NI LA CÚSPIDE.
--
-- Decisión de Daniel, 11 de septiembre de 2026, cuando la salvaguarda C12
-- se rompió al darle al Pastor Principal todos los verbos sobre todos los
-- módulos: «nadie, ni el Principal».
--
-- Hasta ahora esto era un ACUERDO comprobado por una prueba: la prueba
-- contaba que no hubiera filas de `exportar` sobre rocakids. Pero un
-- acuerdo que solo vive en una prueba se rompe el día que alguien hace un
-- INSERT masivo, que es exactamente lo que pasó.
--
-- Aquí deja de ser un acuerdo y pasa a ser una imposibilidad. Ver un dato
-- de un menor se puede justificar: se es su maestro, su director, su
-- pastor. SACARLO del sistema en un archivo no se justifica con ningún
-- cargo, porque el archivo sale del sistema y ya no hay control sobre él.
-- =====================================================================

CREATE OR REPLACE FUNCTION sistema.tg_no_exportar_menores() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_nivel smallint;
BEGIN
  SELECT nivel_dato INTO v_nivel FROM sistema.modulos WHERE codigo = NEW.modulo;
  IF NEW.accion = 'exportar' AND v_nivel >= 4 THEN
    RAISE EXCEPTION 'Nadie puede exportar datos de nivel N4 (menores). Módulo «%», rol «%»',
      NEW.modulo, NEW.rol
      USING ERRCODE = 'check_violation',
            HINT = 'Ver un dato de un menor se justifica por el cargo. Sacarlo del sistema en un archivo, no: el archivo sale del control del sistema. Si de verdad hace falta, se pide por escrito y lo genera la dirección con acta.';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_no_exportar_menores ON sistema.matriz_permisos;
CREATE TRIGGER trg_no_exportar_menores BEFORE INSERT OR UPDATE ON sistema.matriz_permisos
  FOR EACH ROW EXECUTE FUNCTION sistema.tg_no_exportar_menores();

COMMENT ON FUNCTION sistema.tg_no_exportar_menores IS
  'N4 se puede ver con justificación, pero no se exporta. Un archivo sale del sistema y del control.';
