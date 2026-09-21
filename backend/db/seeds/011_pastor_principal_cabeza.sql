-- =====================================================================
-- Seed 011 — EL PASTOR PRINCIPAL ES LA CABEZA, Y EL MODELO NO LO DECÍA
--
-- Daniel, 11 de septiembre de 2026: «quiero crear al pastor Carlos
-- Ricardo, que es la cabeza de todo y todos, es el pastor principal; él
-- debería tener acceso a todo y a toda la información, ¿por qué no puedo?».
--
-- La respuesta era que el modelo tenía la jerarquía al revés respecto de
-- la iglesia real:
--
--   PASTOR_DIRECTOR_GENERAL   techo N4 · 22 módulos
--   PASTOR_CONGREGACIONAL     techo N4 · 20 módulos
--   PASTOR_PRINCIPAL          techo N3 · 10 módulos   ← la «cabeza»
--
-- El nombre decía «principal» pero el rol estaba por debajo. Nadie lo
-- había notado porque todavía no existía la persona que lo ocupa.
--
-- ⚠️ Esto no es solo subir un número: el Pastor Principal pasa a ver
-- TODA la información de las 36 iglesias, incluidos aportes por persona,
-- notas de consejería y datos de menores. Es lo que corresponde a quien
-- responde por la organización entera, y queda escrito con acta.
-- =====================================================================

UPDATE identidad.roles
   SET nivel_maximo  = 4,
       alcance_maximo = 'organizacion',
       descripcion    = 'Cabeza de la organización. Responde por las 36 iglesias, y por eso '
                        'alcanza N4 en toda la red. [11 sep 2026] Techo elevado de N3 a N4: el '
                        'modelo lo tenía por debajo del Director General, al revés de la iglesia real.'
 WHERE codigo = 'PASTOR_PRINCIPAL';

-- Todos los módulos, con los verbos generales. Las acciones NOMBRADAS
-- (entregar un menor, anular un certificado) se dejan fuera a propósito:
-- gobernar no es operar. Eso lo hace quien está en el puesto.
INSERT INTO sistema.matriz_permisos (rol, modulo, accion, acta_ref)
SELECT 'PASTOR_PRINCIPAL', m.codigo, a.accion, 'ACTA-DIR-2026-035'
FROM sistema.modulos m
CROSS JOIN LATERAL (VALUES ('ver'),('crear'),('editar'),('exportar'),('administrar')) AS a(accion)
-- ⛔ Menores fuera del verbo `exportar`. Lo impide ademas el disparador de
-- la migracion 0035, pero se excluye aqui tambien para no depender de que
-- salte una excepcion en medio de un seed.
WHERE NOT (a.accion = 'exportar' AND m.nivel_dato >= 4)
ON CONFLICT DO NOTHING;
