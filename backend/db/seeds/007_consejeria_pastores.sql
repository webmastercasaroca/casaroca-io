-- =====================================================================
-- Consejería anclada a los pastores · catálogo.
-- El rol nuevo y las filas de matriz son DATOS, no esquema: la función y
-- la columna viven en la migración 0030.
-- =====================================================================

INSERT INTO identidad.roles (codigo,nombre,alcance_maximo,nivel_maximo,descripcion) VALUES
 ('PASTOR_PRINCIPAL','Pastor Principal','organizacion',3,
  'Liderazgo pastoral general. Acompaña a los pastores congregacionales y ve la consejería de toda la organización. No accede a aportes.')
ON CONFLICT (codigo) DO NOTHING;


INSERT INTO sistema.matriz_permisos (rol, modulo, accion, nivel_max, acta_ref) VALUES
 ('PASTOR_CONGREGACIONAL','consejeria','ver',                       3,'Consejería anclada a pastores'),
 ('PASTOR_CONGREGACIONAL','consejeria','VER_NOTAS_CONFIDENCIALES',  3,'Consejería anclada a pastores'),
 ('PASTOR_PRINCIPAL','consejeria','ver',                            3,'Consejería anclada a pastores'),
 ('PASTOR_PRINCIPAL','consejeria','VER_NOTAS_CONFIDENCIALES',       3,'Consejería anclada a pastores'),
 ('PASTOR_DIRECTOR_GENERAL','consejeria','VER_NOTAS_CONFIDENCIALES',4,'Consejería anclada a pastores')
ON CONFLICT DO NOTHING;

INSERT INTO sistema.matriz_permisos (rol, modulo, accion, acta_ref)
SELECT 'PASTOR_PRINCIPAL', d.modulo, unnest(d.acciones), 'Consejería anclada a pastores'
FROM (VALUES
 ('personas',    ARRAY['ver','editar']),
 ('organizacion',ARRAY['ver']),
 ('crm',         ARRAY['ver','REGISTRAR_CONTACTO']),
 ('grupos',      ARRAY['ver']),
 ('asistencia',  ARRAY['ver']),
 ('formacion',   ARRAY['ver']),
 ('cumplimiento',ARRAY['ver'])
) AS d(modulo,acciones)
ON CONFLICT DO NOTHING;

