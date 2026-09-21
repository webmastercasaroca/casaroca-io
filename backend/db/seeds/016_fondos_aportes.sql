-- =====================================================================
-- Seed 016 — LOS FONDOS · sin esto no se puede recibir un peso
--
-- ⛔ HALLAZGO (15 sep 2026): `aportes.fondos` estaba VACÍA. `fondo_id` es
--    NOT NULL en `aportes.aportes` y en `pasarela_transacciones`, así que
--    con la tabla vacía NO SE PUEDE REGISTRAR NINGÚN APORTE: ni a mano ni
--    por pasarela. Lo descubrí al probar un diezmo de punta a punta.
--    Es el mismo patrón del catálogo de ministerios: la tabla bien
--    diseñada y sin contenido.
--
-- ⭐ El fondo es una ENTIDAD y no un texto por una razón contable: un
--    aporte dirigido a un proyecto no puede convertirse en ofrenda
--    general al migrar. Y `cuenta_contable` es lo que permite cruzar con
--    el sistema contable corporativo sin re-mapear a mano.
-- =====================================================================
INSERT INTO aportes.fondos (codigo, nombre, tipo, cuenta_contable) VALUES
  ('GENERAL',      'Fondo general',                 'general',       '4135-01'),
  ('DIEZMOS',      'Diezmos',                       'general',       '4135-02'),
  ('MISIONES',     'Misiones',                      'misiones',      '4135-10'),
  ('CONSTRUCCION', 'Construcción y sedes',          'construccion',  '4135-20'),
  ('BENEFICENCIA', 'Beneficencia y ayuda social',   'beneficencia',  '4135-30'),
  ('ROCAKIDS',     'RocaKids',                      'proyecto',      '4135-41'),
  ('TMT',          'tMt · jóvenes',                 'proyecto',      '4135-42'),
  ('INSTITUTO',    'Instituto bíblico',             'proyecto',      '4135-43')
ON CONFLICT (codigo) DO UPDATE
  SET nombre = EXCLUDED.nombre, tipo = EXCLUDED.tipo,
      cuenta_contable = EXCLUDED.cuenta_contable;

DO $$
DECLARE v int;
BEGIN
  SELECT count(*) INTO v FROM aportes.fondos;
  IF v = 0 THEN RAISE EXCEPTION 'Los fondos quedaron vacíos: no se podrá registrar ningún aporte'; END IF;
  RAISE NOTICE 'Fondos sembrados: %', v;
END $$;
