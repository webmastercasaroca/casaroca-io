-- =====================================================================
-- Seed 013 - LAS IGLESIAS EXISTENTES NO RECIBIERON LOS MODULOS NUEVOS
--
-- Hallazgo del 11 de septiembre de 2026, al comprobar que apagar un
-- modulo en una sede no cambiaba nada en su panel. La causa no era el
-- interruptor: era que los diez modulos que se anadieron ese dia (seed
-- 009) entraron al CATALOGO y a las PLANTILLAS, pero nadie los encendio
-- en las iglesias que ya existian. Las sedes se habian creado antes de
-- que esos modulos existieran.
--
-- 👉 REGLA QUE CONVIENE NO OLVIDAR: anadir un modulo al catalogo NO lo
-- enciende en ninguna iglesia. Son dos cosas distintas a proposito (una
-- iglesia decide que usa), pero significa que cada modulo nuevo necesita
-- decidir explicitamente que pasa con las sedes que ya estan.
--
-- Aqui se resuelve por PLANTILLA: cada iglesia recibe lo que su propia
-- plantilla dice, ni mas ni menos. Una plantacion sigue sin aportes.
-- Los modulos con compuerta legal (N4, y N3 con exigencia) entran
-- APAGADOS aunque la plantilla los incluya: encenderlos exige evidencia.
-- =====================================================================

INSERT INTO sistema.modulos_sede (sede_id, modulo, activo, nota)
SELECT s.id, pm.modulo,
       NOT m.exige_compuerta_legal,
       'Alta automatica del 11 sep 2026: el modulo se anadio al catalogo '
       'despues de crearse esta iglesia. Se aplico su plantilla ' || p.codigo || '.'
FROM org.sedes s
JOIN sistema.plantillas p        ON p.tipo_sede = s.tipo
JOIN sistema.plantilla_modulos pm ON pm.plantilla = p.codigo
JOIN sistema.modulos m           ON m.codigo = pm.modulo
WHERE NOT EXISTS (
  SELECT 1 FROM sistema.modulos_sede ms
   WHERE ms.sede_id = s.id AND ms.modulo = pm.modulo)
ON CONFLICT DO NOTHING;
