-- =====================================================================
-- Los roles de la jerarquía operativa que faltaban.
--
-- Cadena completa, de arriba abajo:
--   Pastor Director General → Pastor Congregacional → Director de
--   Ministerio → DIRECTOR DE SEGMENTO → COORDINADOR DE SEGMENTO → Líder
--
-- Los dos del medio son los que operan el día a día del ministerio, y
-- eran justamente los que no existían.
-- =====================================================================

INSERT INTO identidad.roles (codigo,nombre,alcance_maximo,nivel_maximo,descripcion) VALUES
 ('DIRECTOR_SEGMENTO','Director de Segmento','segmento',2,
  'Dirige una franja completa dentro de un ministerio — Aventureros en RocaKids, Legado en tMt. Responde por los coordinadores de su segmento.'),
 ('COORDINADOR_SEGMENTO','Coordinador de Segmento','segmento',2,
  'Coordina los grupos y los líderes de su segmento. Es quien conoce por nombre a la gente que atiende.')
ON CONFLICT (codigo) DO NOTHING;

-- «Líder» ya existía como LIDER_GRUPO; se aclara el nombre para que la
-- consola y el taller H-01 lo llamen igual que la iglesia.
UPDATE identidad.roles
   SET nombre = 'Líder',
       descripcion = 'Acompaña a los miembros de su grupo. Es el último eslabón de la cadena y el que más cerca está de las personas.'
 WHERE codigo = 'LIDER_GRUPO';

-- ── Sus permisos ──────────────────────────────────────────────────────
-- El director de segmento ve y opera su franja; el coordinador hace el
-- trabajo de campo. Ninguno de los dos alcanza dato sensible: su techo
-- es N2, igual que el del pastor congregacional.
INSERT INTO sistema.matriz_permisos (rol, modulo, accion, acta_ref)
SELECT d.rol, d.modulo, unnest(d.acciones), 'Jerarquía operativa · propuesta H-01'
FROM (VALUES
 ('DIRECTOR_SEGMENTO','personas',  ARRAY['ver','crear','editar']),
 ('DIRECTOR_SEGMENTO','crm',       ARRAY['ver','crear','editar','REGISTRAR_CONTACTO']),
 ('DIRECTOR_SEGMENTO','grupos',    ARRAY['ver','crear','editar']),
 ('DIRECTOR_SEGMENTO','asistencia',ARRAY['ver','crear']),
 ('DIRECTOR_SEGMENTO','formacion', ARRAY['ver','crear']),
 ('DIRECTOR_SEGMENTO','organizacion',ARRAY['ver']),

 ('COORDINADOR_SEGMENTO','personas',  ARRAY['ver','crear','editar']),
 ('COORDINADOR_SEGMENTO','crm',       ARRAY['ver','crear','REGISTRAR_CONTACTO']),
 ('COORDINADOR_SEGMENTO','grupos',    ARRAY['ver','editar']),
 ('COORDINADOR_SEGMENTO','asistencia',ARRAY['ver','crear'])
) AS d(rol,modulo,acciones)
ON CONFLICT DO NOTHING;

-- El líder también registra seguimiento: es quien más contacto tiene.
INSERT INTO sistema.matriz_permisos (rol,modulo,accion,acta_ref)
VALUES ('LIDER_GRUPO','crm','REGISTRAR_CONTACTO','Jerarquía operativa · propuesta H-01')
ON CONFLICT DO NOTHING;

-- ── Segmentos de DEMOSTRACIÓN ─────────────────────────────────────────
-- ⚠️ Los segmentos reales de cada sede los declara la Dirección de cada
--    ministerio. Estos son los que aparecen en la documentación de
--    RocaKids y tMt, cargados en la sede maestra para poder probar.
DO $$
DECLARE v_sede uuid; v_kids uuid; v_tmt uuid;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE tipo = 'sede_madre';

  INSERT INTO org.ministerios (codigo,nombre,clase,nivel_dato) VALUES
    ('ROCAKIDS','RocaKids','congregacional',4),
    ('TMT','tMt · jóvenes 11-25','congregacional',2)
  ON CONFLICT (codigo) DO NOTHING;
  SELECT id INTO v_kids FROM org.ministerios WHERE codigo='ROCAKIDS';
  SELECT id INTO v_tmt  FROM org.ministerios WHERE codigo='TMT';

  INSERT INTO org.ministerios_sede (sede_id,ministerio_id,activo,activado_en)
  VALUES (v_sede,v_kids,true,now()), (v_sede,v_tmt,true,now())
  ON CONFLICT DO NOTHING;

  INSERT INTO org.segmentos (sede_id,ministerio_id,codigo,nombre,orden,edad_min,edad_max) VALUES
    (v_sede,v_kids,'BEBES',      'Bebés',        1, 0, 2),
    (v_sede,v_kids,'PEQUENOS',   'Pequeños',     2, 3, 5),
    (v_sede,v_kids,'EXPLORADORES','Exploradores',3, 6, 8),
    (v_sede,v_kids,'AVENTUREROS','Aventureros',  4, 9,11),
    (v_sede,v_tmt, 'PULSO',      'Pulso',        1,11,14),
    (v_sede,v_tmt, 'ECO',        'Eco',          2,15,18),
    (v_sede,v_tmt, 'LEGADO',     'Legado',       3,19,25)
  ON CONFLICT DO NOTHING;
END $$;
