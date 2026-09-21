-- =====================================================================
-- Seed 014 — La casilla de ejemplo de la migración 0037
--
-- Va en un SEED y no en la migración porque depende de `sistema.modulos`,
-- que llena el seed 009. Una migración que referencia un catálogo
-- sembrado después aborta, y al abortar los seeds no corren y el banco
-- ni arranca. Es la lección de la 0033, aprendida dos veces.
--
-- Esto es el ejemplo vivo de lo que pidió Daniel: añadir «qué le gusta
-- comer» es UNA LÍNEA, sin migración, sin despliegue, y la casilla nace
-- ya con su nivel de dato y su privacidad aplicada.
-- =====================================================================
SELECT sistema.crear_atributo(
  'comida_favorita', 'Qué le gusta comer', 'personas',
  'texto', 2::smallint, NULL,
  'Casilla añadida sin migración. Sirve al cuidado pastoral: recordar qué le gusta a alguien es una forma concreta de conocerlo.');

-- Y una de opción cerrada, para que se vea el patrón limpio: un
-- desplegable se puede agrupar después; un texto libre, no.
SELECT sistema.crear_atributo(
  'alergias_alimentarias', 'Alergias alimentarias', 'personas',
  'multiopcion', 3::smallint,
  '["ninguna","gluten","lactosa","frutos secos","mariscos","otra"]'::jsonb,
  'N3 a propósito: una alergia es dato de salud. Nace restringida sin que nadie tenga que acordarse.');
