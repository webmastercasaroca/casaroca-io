-- =====================================================================
-- Seed 010 — El techo del Pastor Congregacional sube a N4
-- Va en un seed y no en la migración 0034 porque depende de
-- `identidad.roles`, que también es un seed. Ver la nota en la 0034.
-- =====================================================================

UPDATE identidad.roles SET nivel_maximo = 2 WHERE codigo = 'PASTOR_CONGREGACIONAL';
-- =====================================================================

UPDATE identidad.roles
   SET nivel_maximo = 4,
       descripcion  = descripcion ||
         ' [11 sep 2026] Techo elevado de N2 a N4 por decisión de la dirección, '
         'para que el pastor gobierne RocaKids de su sede. Arrastra acceso a '
         'aportes, talento, oración y legal de su sede.'
 WHERE codigo = 'PASTOR_CONGREGACIONAL';

-- Ahora que el techo lo permite, se le dan los permisos de RocaKids que
-- motivaron el cambio. Sin esto el techo subiría sin que viera nada.
INSERT INTO sistema.matriz_permisos (rol, modulo, accion, acta_ref) VALUES
  ('PASTOR_CONGREGACIONAL','rocakids','ver',         'ACTA-DIR-2026-034'),
  ('PASTOR_CONGREGACIONAL','rocakids','administrar', 'ACTA-DIR-2026-034'),
  ('PASTOR_CONGREGACIONAL','aportes','ver',          'ACTA-DIR-2026-034'),
  ('PASTOR_CONGREGACIONAL','talento','ver',          'ACTA-DIR-2026-034'),
  ('PASTOR_CONGREGACIONAL','oracion','ver',          'ACTA-DIR-2026-034')
ON CONFLICT DO NOTHING;
