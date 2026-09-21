-- =====================================================================
-- Seed 017 — LOS CARGOS · sin esto no se puede contratar a nadie
--
-- ⛔ HALLAZGO (15 sep 2026): `talento.cargos` estaba VACÍA y
--    `talento.contratos.cargo_id` es NOT NULL. Con la tabla vacía no se
--    puede registrar UN SOLO contrato. Tercer caso del mismo patrón, tras
--    los ministerios y los fondos: la tabla bien diseñada, sin contenido.
--
-- ⭐ El nivel del dato viaja con el cargo. Un cargo pastoral o de
--    tesorería toca información N3, y eso queda declarado aquí, no en la
--    pantalla que lo muestre.
-- =====================================================================
INSERT INTO talento.cargos (codigo, nombre, area, nivel_dato) VALUES
  ('PASTOR_GENERAL',  'Pastor Director General',     'Pastoral',      3),
  ('PASTOR_SEDE',     'Pastor Congregacional',       'Pastoral',      3),
  ('PASTOR_ASOC',     'Pastor asociado',             'Pastoral',      3),
  ('DIR_MINISTERIO',  'Director de ministerio',      'Pastoral',      2),
  ('COORD_MIN',       'Coordinador de ministerio',   'Pastoral',      2),
  ('CONSEJERO',       'Consejero',                   'Pastoral',      3),
  ('MAESTRO_RK',      'Maestro de RocaKids',         'Pastoral',      4),
  ('DIR_ROCAKIDS',    'Director de RocaKids',        'Pastoral',      4),
  ('DOCENTE',         'Docente del Instituto',       'Formación',     2),
  ('CONTADOR',        'Contador',                    'Administrativa',3),
  ('TESORERO',        'Tesorero',                    'Administrativa',3),
  ('AUX_CONTABLE',    'Auxiliar contable',           'Administrativa',3),
  ('TALENTO_HUMANO',  'Analista de Talento Humano',  'Administrativa',3),
  ('ABOGADO',         'Abogado',                     'Administrativa',3),
  ('SECRETARIA',      'Secretaría',                  'Administrativa',2),
  ('SISTEMAS',        'Analista de tecnología',      'Tecnología',    2),
  ('SONIDO',          'Técnico de sonido',           'Operativa',     2),
  ('COMUNICACIONES',  'Comunicaciones',              'Operativa',     2),
  ('SERVICIOS_GEN',   'Servicios generales',         'Operativa',     2),
  ('SEGURIDAD',       'Seguridad',                   'Operativa',     2)
ON CONFLICT (codigo) DO UPDATE
  SET nombre = EXCLUDED.nombre, area = EXCLUDED.area, nivel_dato = EXCLUDED.nivel_dato;

DO $$
DECLARE v int;
BEGIN
  SELECT count(*) INTO v FROM talento.cargos;
  IF v = 0 THEN RAISE EXCEPTION 'Los cargos quedaron vacíos: no se podrá registrar ningún contrato'; END IF;
  RAISE NOTICE 'Cargos sembrados: %', v;
END $$;
