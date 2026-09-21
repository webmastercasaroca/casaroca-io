-- =====================================================================
-- Seed 012 - PASTOR PRINCIPAL Y PASTOR DIRECTOR GENERAL SON EL MISMO
--
-- Daniel, 11 de septiembre de 2026: «Pastor Principal y Pastor Director
-- General son lo mismo».
--
-- Tenia razon, y explica por que el modelo tenia dos cuspides peleando:
-- alguien tradujo el mismo cargo dos veces, una por su nombre pastoral
-- («Pastor Principal») y otra por su funcion administrativa («Director
-- General»). Al no existir todavia la persona que lo ocupa, nadie lo
-- noto, y el resultado fue que el rol de la cabeza quedo por debajo.
--
-- Se conserva el CODIGO `PASTOR_DIRECTOR_GENERAL` porque esta
-- referenciado en migraciones, semillas, pruebas y en la cadena de
-- delegacion del master: renombrarlo obligaria a tocarlo todo por un
-- cambio de etiqueta. Lo que cambia es el NOMBRE que se muestra, que es
-- el que la iglesia usa de verdad.
-- =====================================================================

UPDATE identidad.roles
   SET nombre      = 'Pastor Principal',
       descripcion = 'La cabeza de la organizacion. Responde por las 36 iglesias. '
                     'Es el mismo cargo que antes aparecia partido en dos roles; '
                     'se unificaron el 11 de septiembre de 2026.'
 WHERE codigo = 'PASTOR_DIRECTOR_GENERAL';

-- Lo que tuviera el rol duplicado pasa al que queda, sin perder nada.
INSERT INTO sistema.matriz_permisos (rol, modulo, accion, nivel_max, acta_ref)
SELECT 'PASTOR_DIRECTOR_GENERAL', modulo, accion, nivel_max, acta_ref
FROM sistema.matriz_permisos WHERE rol = 'PASTOR_PRINCIPAL'
ON CONFLICT DO NOTHING;

UPDATE identidad.asignaciones SET rol = 'PASTOR_DIRECTOR_GENERAL'
 WHERE rol = 'PASTOR_PRINCIPAL';

DELETE FROM sistema.matriz_permisos WHERE rol = 'PASTOR_PRINCIPAL';
DELETE FROM identidad.roles         WHERE codigo = 'PASTOR_PRINCIPAL';
