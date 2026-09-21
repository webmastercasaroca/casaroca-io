-- =====================================================================
-- Seed 020 — LA CENTRAL, SUS DIRECCIONES Y EQUIPOS, Y LAS REGIONES
--
-- Estructura de arranque. Los nombres se ajustan en la consola de sistemas
-- sin tocar una migración: son datos, no código.
-- =====================================================================

-- 1 · La central
INSERT INTO org.unidades (codigo, nombre, clase, proposito) VALUES
 ('CENTRAL', 'Casa Sobre la Roca · Central', 'central',
  'Administra la red completa: da servicios a las sedes y no las reemplaza.')
ON CONFLICT (codigo) DO NOTHING;

-- 2 · Las direcciones de la central
INSERT INTO org.unidades (codigo, nombre, clase, padre_id, proposito)
SELECT v.codigo, v.nombre, 'direccion', c.id, v.proposito
FROM (SELECT id FROM org.unidades WHERE codigo='CENTRAL') c
CROSS JOIN (VALUES
 ('DIR-ADMIN',  'Direccion Administrativa y Financiera', 'Finanzas, talento humano y lo juridico de la red.'),
 ('DIR-COM',    'Direccion de Comunicaciones',           'Marca, medios y produccion de la red.'),
 ('DIR-TEC',    'Direccion de Tecnologia',               'Sistemas, datos y soporte a las 36 sedes.'),
 ('DIR-PAST',   'Direccion Pastoral',                    'Formacion, misiones y acompanamiento pastoral de la red.'),
 ('DIR-PROY',   'Direccion de Proyectos',                'Construccion, sedes nuevas e infraestructura fisica.')
) AS v(codigo, nombre, proposito)
ON CONFLICT (codigo) DO NOTHING;

-- 3 · Los equipos, colgando de su dirección
INSERT INTO org.unidades (codigo, nombre, clase, padre_id, proposito)
SELECT v.codigo, v.nombre, 'equipo', d.id, v.proposito
FROM (VALUES
 ('EQ-FIN',    'Equipo de Finanzas',        'DIR-ADMIN', 'Aportes, presupuesto y conciliacion de toda la red.'),
 ('EQ-TH',     'Equipo de Talento Humano',  'DIR-ADMIN', 'Contratacion, voluntariado y bienestar.'),
 ('EQ-LEGAL',  'Equipo Legal',              'DIR-ADMIN', 'Contratos, habeas data y cumplimiento.'),
 ('EQ-COM',    'Equipo de Comunicaciones',  'DIR-COM',   'Contenido, redes y comunicacion interna.'),
 ('EQ-PROD',   'Equipo de Produccion',      'DIR-COM',   'Audio, video y transmision de los servicios.'),
 ('EQ-TI',     'Equipo de Sistemas',        'DIR-TEC',   'La plataforma, los datos y el soporte a las sedes.'),
 ('EQ-FORM',   'Equipo de Formacion',       'DIR-PAST',  'Instituto biblico, escuela de lideres y rutas.'),
 ('EQ-MIS',    'Equipo de Misiones',        'DIR-PAST',  'Plantacion de sedes y misiones.'),
 ('EQ-KIDS',   'Equipo RocaKids Global',    'DIR-PAST',  'Curriculo, salvaguarda y acreditacion de maestros de ninos.'),
 ('EQ-CONST',  'Equipo de Construccion',    'DIR-PROY',  'Obras y adecuacion de sedes.')
) AS v(codigo, nombre, padre, proposito)
JOIN org.unidades d ON d.codigo = v.padre
ON CONFLICT (codigo) DO NOTHING;

-- 4 · Las regiones, colgando de la central
INSERT INTO org.unidades (codigo, nombre, clase, padre_id, proposito)
SELECT v.codigo, v.nombre, 'region', c.id, v.proposito
FROM (SELECT id FROM org.unidades WHERE codigo='CENTRAL') c
CROSS JOIN (VALUES
 ('REG-BOG', 'Region Bogota y Sabana', 'Sedes de Bogota y municipios vecinos.'),
 ('REG-COL', 'Region Colombia',        'Sedes del resto del pais.'),
 ('REG-INT', 'Region Internacional',   'Sedes fuera de Colombia. Caen bajo el regimen de datos de su pais.')
) AS v(codigo, nombre, proposito)
ON CONFLICT (codigo) DO NOTHING;

-- 5 · Cada sede cuelga de su región
UPDATE org.sedes s SET unidad_id = u.id
FROM org.unidades u
WHERE u.codigo = CASE
    WHEN s.pais <> 'CO'                              THEN 'REG-INT'
    WHEN s.ciudad IN ('Bogota','Bogotá','Chia','Chía','Cajica','Cajicá','Cota','Soacha') THEN 'REG-BOG'
    ELSE 'REG-COL'
  END
  AND s.unidad_id IS NULL;

-- 6 · ⭐ EL PERMISO SE LE DA AL EQUIPO
--     Esto es lo que antes no existía. El equipo de Finanzas ve los aportes
--     de toda la red porque es SU trabajo; quien sale del equipo deja de
--     verlos ese mismo día, sin que nadie tenga que acordarse.
INSERT INTO identidad.asignaciones_unidad (unidad_id, rol, alcance_tipo, alcance_id, nivel_max, acta_referencia)
SELECT u.id, v.rol, v.alcance::identidad.tipo_alcance,
       CASE WHEN v.alcance = 'unidad' THEN u.id ELSE NULL END,
       v.nivel, 'Seed 020 · estructura de arranque de la central'
FROM (VALUES
 ('EQ-FIN',   'CONTABILIDAD',            'organizacion', 3::smallint),
 ('EQ-TH',    'TALENTO_HUMANO',          'organizacion', 3::smallint),
 ('EQ-LEGAL', 'AUDITOR',                 'organizacion', 3::smallint),
 ('EQ-TI',    'INTEGRACION_TECNICA',     'organizacion', 1::smallint),
 ('EQ-COM',   'GERENCIA_ADMINISTRATIVA', 'organizacion', 2::smallint),
 ('EQ-KIDS',  'DIRECTOR_ROCAKIDS',       'organizacion', 4::smallint)
) AS v(unidad, rol, alcance, nivel)
JOIN org.unidades u ON u.codigo = v.unidad
WHERE NOT EXISTS (
  SELECT 1 FROM identidad.asignaciones_unidad a
  WHERE a.unidad_id = u.id AND a.rol = v.rol AND a.vigente_hasta IS NULL);

-- 7 · Y el supervisor regional, que antes no se podía representar sin
--     darle la red entera: su alcance es SU region.
INSERT INTO identidad.asignaciones_unidad (unidad_id, rol, alcance_tipo, alcance_id, nivel_max, acta_referencia)
SELECT u.id, 'PASTOR_CONGREGACIONAL', 'unidad'::identidad.tipo_alcance, u.id, 4::smallint,
       'Seed 020 · supervision regional'
FROM org.unidades u
WHERE u.clase = 'region'
  AND NOT EXISTS (SELECT 1 FROM identidad.asignaciones_unidad a
                  WHERE a.unidad_id = u.id AND a.vigente_hasta IS NULL);

DO $$
DECLARE u int; e int; r int; s int; a int;
BEGIN
  SELECT count(*) INTO u FROM org.unidades;
  SELECT count(*) INTO e FROM org.unidades WHERE clase='equipo';
  SELECT count(*) INTO r FROM org.unidades WHERE clase='region';
  SELECT count(*) INTO s FROM org.sedes WHERE unidad_id IS NOT NULL;
  SELECT count(*) INTO a FROM identidad.asignaciones_unidad;
  RAISE NOTICE 'Organigrama: % unidades (% equipos, % regiones), % sedes ubicadas, % permisos de equipo', u,e,r,s,a;
END $$;
