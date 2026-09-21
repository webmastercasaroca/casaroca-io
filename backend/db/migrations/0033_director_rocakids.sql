-- =====================================================================
-- Migración 0033 — FALTABA EL DIRECTOR DE ROCAKIDS
--
-- Hallazgo del 11 de septiembre de 2026. Daniel dijo una frase simple
-- («un pastor general puede ser director de niños también») y al
-- comprobarlo salió un hueco del modelo:
--
--   DIRECTOR_MINISTERIO tiene techo N2.
--   RocaKids maneja dato N4.
--   → Un director de ministerio NO puede dirigir RocaKids.
--
-- No es un error de permisos: es que faltaba el rol. El ministerio de
-- menores es el único cuyo director necesita N4, y meterlo dentro del
-- director genérico habría subido a N4 a TODOS los directores de
-- ministerio, que es justo lo que no se quiere.
--
-- Es el enfoque progresivo que las dos partes acordaron: cada módulo
-- trae los roles que necesita. RocaKids trae el suyo.
-- =====================================================================

-- `alcance_maximo` es el alcance más amplio que este rol puede recibir.
-- Existía ya en el modelo, y es la misma idea que el equipo 100p llama
-- `alcance_default`: el rol trae su alcance sugerido y evita que alguien
-- otorgue por descuido un alcance mayor del que el rol admite.
INSERT INTO identidad.roles (codigo, nombre, alcance_maximo, nivel_maximo, descripcion) VALUES
  ('DIRECTOR_ROCAKIDS', 'Director de RocaKids', 'ministerio', 4,
   'Dirige el ministerio de menores. Necesita N4 porque el módulo lo maneja; '
   'por eso es un rol aparte y no el director de ministerio genérico, que se '
   'queda en N2 a propósito.')
ON CONFLICT (codigo) DO NOTHING;

-- ⛔ SUS PERMISOS NO VAN AQUÍ, y esto costó una corrida.
-- `sistema.matriz_permisos` tiene llave foránea a `sistema.modulos`, y
-- los módulos los crea un SEED, que corre DESPUÉS de las migraciones.
-- Una migración que los referencia aborta, y al abortar no corren los
-- seeds: se queda la base a medias y el banco de pruebas ni arranca.
--
-- 👉 Regla: las migraciones definen la ESTRUCTURA; los seeds, el
-- CONTENIDO que depende de catálogos. Los permisos de este rol están en
-- `db/seeds/008_director_rocakids.sql`.

COMMENT ON TABLE identidad.roles IS
  'Catálogo extensible. Cada módulo nuevo trae los roles que necesita: '
  'no se predicen todos de antemano ni se fuerza a uno genérico a subir de techo.';
