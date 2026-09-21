-- =====================================================================
-- Seed 008 — Permisos del Director de RocaKids
-- Va en un seed y no en la migración 0033 porque depende de
-- `sistema.modulos`, que también es un seed. Ver la nota en la 0033.
-- =====================================================================
-- Sus permisos. Alcanza RocaKids completo y lo justo de lo demás:
-- ve a las personas de su ministerio y el talento que sirve en él
-- (para comprobar antecedentes), pero NO aportes ni consejería.
INSERT INTO sistema.matriz_permisos (rol, modulo, accion, acta_ref) VALUES
  ('DIRECTOR_ROCAKIDS','rocakids','ver',            'ACTA-RK-2026-001'),
  ('DIRECTOR_ROCAKIDS','rocakids','crear',          'ACTA-RK-2026-001'),
  ('DIRECTOR_ROCAKIDS','rocakids','editar',         'ACTA-RK-2026-001'),
  ('DIRECTOR_ROCAKIDS','rocakids','administrar',    'ACTA-RK-2026-001'),
  ('DIRECTOR_ROCAKIDS','rocakids','ENTREGAR_MENOR', 'ACTA-RK-2026-001'),
  ('DIRECTOR_ROCAKIDS','personas','ver',            'ACTA-RK-2026-001'),
  ('DIRECTOR_ROCAKIDS','asistencia','ver',          'ACTA-RK-2026-001'),
  ('DIRECTOR_ROCAKIDS','talento','ver',             'ACTA-RK-2026-001'),
  ('DIRECTOR_ROCAKIDS','grupos','ver',              'ACTA-RK-2026-001')
ON CONFLICT DO NOTHING;

