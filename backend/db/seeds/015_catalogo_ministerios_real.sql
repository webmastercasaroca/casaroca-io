-- =====================================================================
-- Seed 015 — EL CATÁLOGO REAL DE MINISTERIOS Y EQUIPOS
--
-- ⛔ EL HALLAZGO (15 sep 2026, medido):
--      SELECT codigo, nombre FROM org.ministerios;  →  2 filas
--    El sistema modelaba DOS ministerios (RocaKids y tMt) de los más de
--    veinte que tiene la iglesia, y además ninguno estaba activado en
--    ninguna sede. Consecuencia directa: el panel de cualquier pastor
--    mostraba cero ministerios, y la Dirección General veía una red sin
--    estructura.
--
-- La tabla estaba bien diseñada desde la 0002: cuatro clases, nivel de
-- dato por ministerio y activación por sede en `org.ministerios_sede`.
-- Lo que faltaba era el contenido. Esto lo llena.
--
-- ⭐ EL NIVEL VIAJA CON EL MINISTERIO, no con la pantalla. RocaKids nace
--    N4 porque produce datos de menores; AMEC y Consejería nacen N3
--    porque tocan salud y materia reservada; Tesorería, Contable, Legal
--    y Talento Humano nacen N3 por dinero y hoja de vida. Quien activa
--    el ministerio no tiene que acordarse de nada: el control va puesto.
--
-- ⛔ SE SIEMBRA EL CATÁLOGO, NO LA ACTIVACIÓN INDISCRIMINADA. Existir en
--    el catálogo no es estar encendido en una iglesia: una plantación no
--    abre con AMEC ni con Centuriones. La activación va por sede y aquí
--    solo se enciende la de la SEDE MADRE, que es la única que hoy los
--    tiene todos de verdad.
-- =====================================================================

INSERT INTO org.ministerios (codigo, nombre, clase, nivel_dato) VALUES
  -- ── Congregacionales · las personas ────────────────────────────────
  ('ROCAKIDS',       'RocaKids',                    'congregacional', 4),
  ('TMT',            'tMt · jóvenes 11-25',         'congregacional', 2),
  ('J25',            'J+25',                        'congregacional', 2),
  ('JOSUES',         'Josués',                      'congregacional', 2),
  ('CASA2',          'Casa2',                       'congregacional', 2),
  ('DORADOS',        'Años Dorados',                'congregacional', 2),
  ('MUJER_INTEGRAL', 'Mujer Integral',              'congregacional', 2),
  ('HOMBRES_BIEN',   'Hombres de Bien',             'congregacional', 2),
  ('AMEC',           'AMEC · salud',                'congregacional', 3),
  ('CENTURIONES',    'Centuriones · militares y policía', 'congregacional', 2),
  ('EJECUTIVOS',     'Ejecutivos y Empresarios',    'congregacional', 2),
  ('CONSEJERIA',     'Consejería',                  'congregacional', 3),
  ('NICODEMO',       'Nicodemo · nuevos',           'congregacional', 2),

  -- ── Equipos operativos · el domingo funciona ───────────────────────
  ('ALABANZA',       'Alabanza',                    'equipo_operativo', 2),
  ('VISA',           'VISA · técnica y sonido',     'equipo_operativo', 2),
  ('UJIERES',        'Ujieres',                     'equipo_operativo', 2),
  ('CREATIVO',       'Creativo',                    'equipo_operativo', 2),

  -- ── Formación ──────────────────────────────────────────────────────
  ('INSTITUTO',      'Instituto · IBLI y FACTER',   'formacion', 2),
  ('CURSOS_CORTOS',  'Cursos cortos · ADN, Bautizo, Madurez, Llaves', 'formacion', 2),

  -- ── ERP · los ocho equipos corporativos ────────────────────────────
  ('CONTABLE',       'Contable',                    'erp', 3),
  ('TESORERIA',      'Tesorería',                   'erp', 3),
  ('LEGAL',          'Legal',                       'erp', 3),
  ('TALENTO_HUMANO', 'Talento Humano',              'erp', 3),
  ('SEGURIDAD',      'Seguridad',                   'erp', 2),
  ('TECNOLOGIA',     'Tecnología',                  'erp', 2),
  ('CULTURA',        'Cultura',                     'erp', 2),
  ('COMUNICACIONES', 'Comunicaciones',              'erp', 2)
ON CONFLICT (codigo) DO UPDATE
  SET nombre = EXCLUDED.nombre,
      clase  = EXCLUDED.clase,
      nivel_dato = EXCLUDED.nivel_dato;

-- ---------------------------------------------------------------------
-- La sede madre los tiene todos encendidos. Las demás encienden lo suyo
-- desde el centro de mando, que es exactamente el flujo de activación
-- que pidió la iglesia: el pastor filial prende lo que necesita.
-- ---------------------------------------------------------------------
INSERT INTO org.ministerios_sede (sede_id, ministerio_id, activo, activado_en)
SELECT s.id, m.id, true, now()
FROM org.sedes s
CROSS JOIN org.ministerios m
WHERE s.nombre ILIKE '%chic%'
ON CONFLICT (sede_id, ministerio_id) DO UPDATE SET activo = true;

-- ---------------------------------------------------------------------
-- Comprobación en voz alta: si esto no cuadra, el seed grita.
-- ---------------------------------------------------------------------
DO $$
DECLARE v_cat int; v_madre int;
BEGIN
  SELECT count(*) INTO v_cat FROM org.ministerios;
  SELECT count(*) INTO v_madre FROM org.ministerios_sede WHERE activo;
  IF v_cat < 20 THEN
    RAISE EXCEPTION 'El catálogo de ministerios quedó en % y la iglesia tiene más de veinte', v_cat;
  END IF;
  RAISE NOTICE 'Catálogo: % ministerios · sede madre con % activados', v_cat, v_madre;
END $$;
