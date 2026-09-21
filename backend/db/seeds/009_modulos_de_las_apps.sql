-- =====================================================================
-- Seed 009 — LOS 10 MÓDULOS QUE LAS APPS YA TENÍAN Y EL SISTEMA NO
--
-- Hallazgo del 11 de septiembre de 2026. Daniel lo dijo así: «revisa lo
-- que ya tienen los sistemas, esos son módulos que debemos tener
-- contemplados en el sistema de activación».
--
-- Al cruzar las pestañas reales de las cinco apps por rol (pastor 17,
-- central 16, director 9, lider 9, nicodemo 6) contra los 12 módulos
-- del backend, salieron 28 pestañas de las cuales 18 estaban cubiertas
-- y DIEZ no existían como módulo. Es decir: funcionalidad viva que
-- ninguna iglesia podía encender ni apagar, porque el sistema de
-- activación no sabía que existía.
--
-- Esto importa de verdad: una plantación no debería ver «Construcción»
-- ni «Legal», y hasta ahora no había forma de quitárselos.
-- =====================================================================

-- ⚠️ `esquema` es NOT NULL y eso destapa el dato honesto: ninguno de
-- estos diez tiene todavía tablas en el backend. Viven en el frontend y
-- nada más. Se declara el esquema donde VIVIRÁN cuando se construyan, y
-- así queda escrito el trabajo pendiente en vez de esconderlo.
INSERT INTO sistema.modulos
  (codigo, nombre, esquema, orden, nivel_dato, exige_compuerta_legal, descripcion) VALUES
  ('analitica',      'Analítica y tableros', 'plataforma', 20, 2, false,
   'Agregados de la operación. Es N2 porque un agregado de dato personal sigue siendo dato personal: un conteo de tres personas identifica a las tres. SIN TABLAS todavía: hoy solo existe en el frontend.'),
  ('tareas',         'Tareas',               'plataforma', 21, 1, false,
   'Trabajo interno asignado. Sin dato de la congregación. SIN TABLAS todavía.'),
  ('calendario',     'Calendario',           'org',        22, 1, false,
   'Agenda de servicios, reuniones y eventos. SIN TABLAS todavía.'),
  ('tematicas',      'Temáticas y enseñanza','formacion',  23, 1, false,
   'Material de enseñanza y series. Contenido, no personas. SIN TABLAS todavía.'),
  ('oracion',        'Peticiones de oración','crm',        24, 3, true,
   'SENSIBLE. Una petición de oración cuenta una enfermedad, un duelo o una crisis familiar: es dato de salud y de vida privada, y va al mismo nivel que la consejería. SIN TABLAS todavía, y es el más urgente de construir bien.'),
  ('requerimientos', 'Requerimientos',       'sistema',    25, 1, false,
   'Mesa de servicio entre sedes y dirección. SIN TABLAS todavía.'),
  ('peticiones',     'Peticiones internas',  'sistema',    26, 2, false,
   'Solicitudes del equipo a la dirección. Llevan nombre de quien pide. SIN TABLAS todavía.'),
  ('legal',          'Legal',                'plataforma', 27, 3, true,
   'SENSIBLE. Asuntos jurídicos que involucran a personas concretas. SIN TABLAS todavía.'),
  ('comunicaciones', 'Comunicaciones',       'crm',        28, 2, false,
   'Envíos y campañas. Toca datos de contacto, y por eso depende del consentimiento de la Ley 1581. SIN TABLAS todavía.'),
  ('construccion',   'Construcción',         'org',        29, 1, false,
   'Obra y sedes físicas. Sin dato de personas. SIN TABLAS todavía.')
ON CONFLICT (codigo) DO NOTHING;

-- ---------------------------------------------------------------------
-- Quién los alcanza. Se sigue la jerarquía que ya está en la app: lo
-- corporativo es del Director General, lo local del pastor de sede.
-- ---------------------------------------------------------------------
INSERT INTO sistema.matriz_permisos (rol, modulo, accion, acta_ref)
SELECT r.rol, r.modulo, a.accion, 'ACTA-MOD-2026-002'
FROM (VALUES
  -- Dirección General: todo
  ('PASTOR_DIRECTOR_GENERAL','analitica'),('PASTOR_DIRECTOR_GENERAL','tareas'),
  ('PASTOR_DIRECTOR_GENERAL','calendario'),('PASTOR_DIRECTOR_GENERAL','tematicas'),
  ('PASTOR_DIRECTOR_GENERAL','oracion'),('PASTOR_DIRECTOR_GENERAL','requerimientos'),
  ('PASTOR_DIRECTOR_GENERAL','peticiones'),('PASTOR_DIRECTOR_GENERAL','legal'),
  ('PASTOR_DIRECTOR_GENERAL','comunicaciones'),('PASTOR_DIRECTOR_GENERAL','construccion'),
  -- Pastor de sede: su operación. NO legal (es corporativo) y NO construcción.
  ('PASTOR_CONGREGACIONAL','analitica'),('PASTOR_CONGREGACIONAL','tareas'),
  ('PASTOR_CONGREGACIONAL','calendario'),('PASTOR_CONGREGACIONAL','tematicas'),
  ('PASTOR_CONGREGACIONAL','requerimientos'),('PASTOR_CONGREGACIONAL','peticiones'),
  ('PASTOR_CONGREGACIONAL','comunicaciones'),
  -- Director de ministerio
  ('DIRECTOR_MINISTERIO','analitica'),('DIRECTOR_MINISTERIO','tareas'),
  ('DIRECTOR_MINISTERIO','calendario'),('DIRECTOR_MINISTERIO','tematicas'),
  ('DIRECTOR_MINISTERIO','peticiones'),
  -- Líder de grupo: lo justo
  ('LIDER_GRUPO','calendario'),('LIDER_GRUPO','tematicas'),('LIDER_GRUPO','peticiones'),
  -- Coordinador de nuevos
  ('COORDINADOR_NUEVOS','analitica'),('COORDINADOR_NUEVOS','calendario'),
  ('COORDINADOR_NUEVOS','peticiones'),
  -- Secretaría
  ('SECRETARIA','calendario'),('SECRETARIA','tareas'),('SECRETARIA','requerimientos')
) AS r(rol, modulo)
CROSS JOIN LATERAL (VALUES ('ver'),('crear'),('editar')) AS a(accion)
JOIN sistema.modulos m ON m.codigo = r.modulo
ON CONFLICT DO NOTHING;

-- Oración es N3: solo quien tenga techo para ello.
INSERT INTO sistema.matriz_permisos (rol, modulo, accion, acta_ref) VALUES
  ('PASTOR_PRINCIPAL','oracion','ver',    'ACTA-MOD-2026-002'),
  ('PASTOR_PRINCIPAL','oracion','crear',  'ACTA-MOD-2026-002'),
  ('PASTOR_PRINCIPAL','oracion','editar', 'ACTA-MOD-2026-002'),
  ('CONSEJERO','oracion','ver',           'ACTA-MOD-2026-002'),
  ('PASTOR_PRINCIPAL','legal','ver',      'ACTA-MOD-2026-002')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- Y a las PLANTILLAS. Una plantación no necesita Legal ni Construcción.
-- ---------------------------------------------------------------------
INSERT INTO sistema.plantilla_modulos (plantilla, modulo)
SELECT p.plantilla, p.modulo FROM (VALUES
  ('MAESTRA','analitica'),('MAESTRA','tareas'),('MAESTRA','calendario'),('MAESTRA','tematicas'),
  ('MAESTRA','oracion'),('MAESTRA','requerimientos'),('MAESTRA','peticiones'),('MAESTRA','legal'),
  ('MAESTRA','comunicaciones'),('MAESTRA','construccion'),
  ('FILIAL','analitica'),('FILIAL','tareas'),('FILIAL','calendario'),('FILIAL','tematicas'),
  ('FILIAL','oracion'),('FILIAL','requerimientos'),('FILIAL','peticiones'),('FILIAL','comunicaciones'),
  ('INTERNAC','analitica'),('INTERNAC','tareas'),('INTERNAC','calendario'),('INTERNAC','tematicas'),
  ('INTERNAC','oracion'),('INTERNAC','requerimientos'),('INTERNAC','peticiones'),('INTERNAC','comunicaciones'),
  -- La plantación arranca con lo mínimo: agenda, enseñanza y peticiones.
  ('PLANTACION','calendario'),('PLANTACION','tematicas'),('PLANTACION','peticiones')
) AS p(plantilla, modulo)
JOIN sistema.modulos m ON m.codigo = p.modulo
ON CONFLICT DO NOTHING;
