-- =====================================================================
-- Migración 0028 — EL ALCANCE «SEGMENTO»
-- Va en su propio archivo porque añadir un valor a un tipo enumerado y
-- usarlo exige que el primero haya confirmado; en el mismo archivo, la
-- segunda sentencia no vería el valor nuevo.
-- =====================================================================
ALTER TYPE identidad.tipo_alcance ADD VALUE IF NOT EXISTS 'segmento' AFTER 'ministerio';
