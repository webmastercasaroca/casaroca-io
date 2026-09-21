-- =====================================================================
-- PRUEBA · NINGÚN CATÁLOGO BLOQUEANTE PUEDE QUEDAR VACÍO
--
-- ⛔ POR QUÉ EXISTE, CON FECHA Y TRES CASOS
--    El 15 de septiembre de 2026 el mismo fallo apareció TRES veces:
--      · org.ministerios ... 2 filas de 27 → el panel de cualquier pastor
--                            salía vacío
--      · aportes.fondos ... 0 filas, y fondo_id es NOT NULL → NO SE PODÍA
--                            REGISTRAR NI UN APORTE, ni a mano ni por
--                            pasarela. Solo se vio al probar un diezmo
--                            de punta a punta
--      · talento.cargos ... 0 filas, y contratos.cargo_id es NOT NULL →
--                            no se podía registrar un contrato
--
--    Es un fallo silencioso: la migración pasa, las pruebas de permisos
--    pasan, el despliegue sale verde, y la aplicación simplemente no deja
--    hacer nada. Una tabla bien diseñada y vacía se ve igual que una
--    tabla que funciona, hasta que alguien intenta usarla.
--
-- ⭐ LA REGLA: si otra tabla la referencia con una columna NOT NULL, es
--    un catálogo BLOQUEANTE y no puede estar vacío. Las transaccionales
--    (aportes, entradas, membresías) sí pueden, y deben, empezar vacías.
-- =====================================================================
DO $$
DECLARE r record; n bigint; vacios text := ''; cuantos int := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT (k.confrelid::regclass)::text AS catalogo
    FROM pg_constraint k
    JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = ANY(k.conkey)
    WHERE k.contype = 'f' AND a.attnotnull
      AND (k.confrelid::regclass::text) !~ '^(pg_|information_schema)'
      /* ⛔ QUÉ CUENTA COMO CATÁLOGO, Y POR QUÉ HACE FALTA LA DISTINCIÓN.
         La primera versión de esta prueba marcaba también a
         `grupos.grupos`, `aportes.desembolsos` y `pasarela_transacciones`,
         que son PADRES TRANSACCIONALES: están vacíos porque todavía nadie
         creó un grupo ni hubo un desembolso, y eso es correcto.
         Un CATÁLOGO se reconoce porque tiene una columna `codigo` ÚNICA:
         es una lista cerrada que alguien declara, no algo que la
         operación produce. Los tres casos reales (ministerios, fondos,
         cargos) la tienen; ninguno de los falsos positivos. */
      AND EXISTS (
        SELECT 1 FROM pg_attribute ca
        JOIN pg_constraint uq ON uq.conrelid = k.confrelid
                             AND uq.contype IN ('u','p')
                             AND ca.attnum = ANY(uq.conkey)
        WHERE ca.attrelid = k.confrelid AND ca.attname = 'codigo')
    ORDER BY 1
  LOOP
    EXECUTE format('SELECT count(*) FROM %s', r.catalogo) INTO n;
    IF n = 0 THEN
      vacios := vacios || '  · ' || r.catalogo || E'\n';
      cuantos := cuantos + 1;
    END IF;
  END LOOP;

  IF cuantos > 0 THEN
    RAISE EXCEPTION E'CATÁLOGOS BLOQUEANTES VACÍOS (%):\n%\nOtra tabla los referencia con NOT NULL, así que con ellos vacíos esa operación es IMPOSIBLE. Siémbrelos en db/seeds/ antes de desplegar.', cuantos, vacios;
  END IF;

  RAISE NOTICE 'Catálogos bloqueantes: todos con contenido.';
END $$;

SELECT 'catalogos_no_vacios' AS prueba, 'PASA' AS resultado;
