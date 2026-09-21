-- =====================================================================
-- 0061 · EL TIPO DE DOCUMENTO ES UN DATO, NO UNA SUPOSICIÓN
--
-- ⛔ QUÉ SE ROMPIÓ. El 20 de septiembre de 2026, el banco de conectores
--    intentó registrar a una persona como lo hace la consola: nombre,
--    apellido, sede y número de documento. La base lo rechazó con
--    «violates check constraint "personas_documento_completo"», que es
--    exactamente lo que le habría salido en pantalla al equipo de la
--    central. La restricción es correcta: un número de documento sin
--    decir DE QUÉ documento es no identifica a nadie. Lo que faltaba
--    era el otro lado: nadie podía elegir el tipo, porque no existía
--    la lista.
--
--    Aquí no se añade una lista escrita en el código de la aplicación.
--    Se añade al CATÁLOGO, que es dato: la central puede agregar o
--    retirar un tipo sin que nadie despliegue nada, y lo retirado deja
--    de aceptarse en registros nuevos SIN invalidar los viejos.
--
-- Contexto colombiano: Registraduría (RC, TI, CC, CE), Migración
-- Colombia (PEP, PPT), Cancillería (PA) y DIAN (NIT).
-- =====================================================================
BEGIN;

-- 1 · El catálogo
INSERT INTO sistema.catalogos (codigo, nombre, descripcion, editable_por_sede)
VALUES ('tipo_documento',
        'Tipo de documento de identidad',
        'Con qué documento se identifica a una persona. Lo mantiene la central: una sede no inventa tipos.',
        false)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO sistema.catalogo_valores (catalogo, codigo, etiqueta, descripcion, orden) VALUES
  ('tipo_documento','CC' ,'Cédula de ciudadanía',   'Mayores de edad colombianos.',                    10),
  ('tipo_documento','TI' ,'Tarjeta de identidad',   'De 7 a 17 años.',                                 20),
  ('tipo_documento','RC' ,'Registro civil',         'Menores de 7 años.',                              30),
  ('tipo_documento','CE' ,'Cédula de extranjería',  'Extranjeros residentes.',                         40),
  ('tipo_documento','PA' ,'Pasaporte',              'Extranjeros sin cédula de extranjería.',          50),
  ('tipo_documento','PEP','Permiso especial de permanencia', 'Migración Colombia.',                    60),
  ('tipo_documento','PPT','Permiso por protección temporal', 'Estatuto temporal de protección.',       70),
  ('tipo_documento','NIT','NIT',                    'Solo para personas jurídicas (donantes empresa).',80)
ON CONFLICT (catalogo, codigo) DO NOTHING;

-- 2 · Que el tipo que se guarda EXISTA en el catálogo y esté vigente.
--     ⛔ No se usa una restricción CHECK: una CHECK no puede consultar
--        otra tabla, y si se congela la lista dentro de la restricción
--        volvemos al problema de origen (una lista escondida en el
--        código que hay que desplegar para cambiar).
--     ⛔ Solo se exige en filas NUEVAS o cuando el tipo CAMBIA. Un valor
--        retirado el año pasado no puede invalidar de golpe a las
--        personas registradas con él; lo que no puede es volver a usarse.
CREATE OR REPLACE FUNCTION nucleo.tg_tipo_documento_del_catalogo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = nucleo, sistema, public AS $$
DECLARE v_etiquetas text;
BEGIN
  IF NEW.tipo_documento IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.tipo_documento IS NOT DISTINCT FROM OLD.tipo_documento THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM sistema.catalogo_valores
    WHERE catalogo = 'tipo_documento' AND codigo = NEW.tipo_documento
      AND vigente AND retirado_en IS NULL
  ) THEN
    SELECT string_agg(codigo, ', ' ORDER BY orden) INTO v_etiquetas
    FROM sistema.catalogo_valores
    WHERE catalogo = 'tipo_documento' AND vigente AND retirado_en IS NULL;
    RAISE EXCEPTION
      'El tipo de documento «%» no está en el catálogo. Los que se aceptan hoy son: %.',
      NEW.tipo_documento, COALESCE(v_etiquetas, '(ninguno)')
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_tipo_documento_del_catalogo ON nucleo.personas;
CREATE TRIGGER tg_tipo_documento_del_catalogo
  BEFORE INSERT OR UPDATE OF tipo_documento ON nucleo.personas
  FOR EACH ROW EXECUTE FUNCTION nucleo.tg_tipo_documento_del_catalogo();

-- 3 · Lo ya registrado tiene que caber en el catálogo. Si algo no cabe,
--     la migración SE PARA: es preferible verlo aquí que descubrirlo el
--     día que alguien edite esa ficha y no pueda guardarla.
DO $$
DECLARE v_huerfanos text;
BEGIN
  SELECT string_agg(DISTINCT p.tipo_documento, ', ') INTO v_huerfanos
  FROM nucleo.personas p
  WHERE p.tipo_documento IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sistema.catalogo_valores v
                    WHERE v.catalogo='tipo_documento' AND v.codigo = p.tipo_documento);
  IF v_huerfanos IS NOT NULL THEN
    RAISE EXCEPTION 'Hay personas con un tipo de documento fuera del catálogo: %. Añádalos al catálogo antes de seguir.', v_huerfanos;
  END IF;
END $$;

COMMIT;
