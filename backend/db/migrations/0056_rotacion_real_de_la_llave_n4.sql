-- =====================================================================
-- 0056 · ROTAR LA LLAVE N4 SIN PERDER LOS DATOS
--
-- ⛔ HALLAZGO DEL 19 DE SEPTIEMBRE DE 2026. El `RUNBOOK.md`, punto 4,
--    decía literalmente:
--
--      «3. **No** hay que recifrar los datos: la envoltura usa la versión
--          con la que se cifró cada fila.»
--
--    Eso describe un cifrado de sobre (envelope) con versión por fila.
--    El sistema NO hace eso. Hace `pgp_sym_encrypt(dato, llave)` con UNA
--    llave simétrica que la aplicación pasa en `app.llave_n4`. No hay
--    versión guardada en ninguna parte.
--
--    Es decir: quien siguiera ese runbook al pie de la letra rotaría la
--    llave, desplegaría, y TODO lo cifrado quedaría ilegible. Y lo
--    cifrado es lo más delicado que tiene el sistema: los códigos de
--    entrega de los menores de RocaKids. Si además se destruye la versión
--    anterior en KMS, la pérdida es DEFINITIVA.
--
--    Un procedimiento equivocado es peor que no tener procedimiento: se
--    sigue con confianza. Esta migración da el procedimiento de verdad,
--    ejecutable, repetible y verificable:
--
--      · `recifrar_n4(vieja, nueva)`  descifra con la vieja y vuelve a
--        cifrar con la nueva, fila por fila, SIN tocar lo que ya esté con
--        la nueva (se puede cortar a la mitad y volver a correr).
--      · `verificar_cifrado_n4(llave)` cuenta qué se puede leer y qué no,
--        ANTES de dejar de usar la llave vieja.
--
--    Las dos columnas cifradas hoy (y la prueba lo vigila):
--      · nucleo.acudientes.codigo_entrega_cifrado
--      · rocakids.checkins.codigo_cifrado
-- =====================================================================

BEGIN;

-- ── Qué columnas son N4 cifradas. Una sola lista, y el resto la lee ──
CREATE TABLE IF NOT EXISTS plataforma.columnas_cifradas (
  esquema   text NOT NULL,
  tabla     text NOT NULL,
  columna   text NOT NULL,
  anotacion text NOT NULL,
  PRIMARY KEY (esquema, tabla, columna)
);

INSERT INTO plataforma.columnas_cifradas (esquema,tabla,columna,anotacion) VALUES
  ('nucleo','acudientes','codigo_entrega_cifrado','Codigo con el que un acudiente retira a un menor'),
  ('rocakids','checkins','codigo_cifrado','Codigo de entrega emitido en el ingreso a la sala')
ON CONFLICT (esquema,tabla,columna) DO NOTHING;

SELECT plataforma.publicar_tabla('plataforma.columnas_cifradas','cerrada',
  'Inventario de columnas cifradas: solo lo necesita el mantenimiento, nunca la aplicacion',
  'migracion 0056 · 19 sep 2026');

-- ── ¿Se puede leer lo cifrado con esta llave? ────────────────────────
CREATE OR REPLACE FUNCTION plataforma.verificar_cifrado_n4(p_llave text)
RETURNS TABLE (objeto text, filas bigint, legibles bigint, ilegibles bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = plataforma, pg_temp AS $$
DECLARE c record; v_filas bigint; v_ok bigint;
BEGIN
  IF p_llave IS NULL OR btrim(p_llave) = '' THEN
    RAISE EXCEPTION 'Sin llave no se comprueba nada: pase la llave a verificar';
  END IF;
  FOR c IN SELECT * FROM plataforma.columnas_cifradas ORDER BY esquema, tabla LOOP
    EXECUTE format(
      'SELECT count(*), count(*) FILTER (WHERE plataforma.se_descifra(%I, $1)) FROM %I.%I WHERE %I IS NOT NULL',
      c.columna, c.esquema, c.tabla, c.columna)
      INTO v_filas, v_ok USING p_llave;
    objeto := c.esquema||'.'||c.tabla||'.'||c.columna;
    filas := v_filas; legibles := v_ok; ilegibles := v_filas - v_ok;
    RETURN NEXT;
  END LOOP;
END $$;

-- Auxiliar: intenta descifrar y responde si pudo, sin propagar el error.
CREATE OR REPLACE FUNCTION plataforma.se_descifra(p_dato bytea, p_llave text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM pgp_sym_decrypt(p_dato, p_llave);
  RETURN true;
EXCEPTION WHEN others THEN RETURN false;
END $$;

-- ── El recifrado de verdad ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION plataforma.recifrar_n4(p_vieja text, p_nueva text)
RETURNS TABLE (objeto text, recifradas bigint, ya_estaban bigint, ilegibles bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = plataforma, public, pg_temp AS $$
DECLARE c record; v_sql text; v_rec bigint; v_ya bigint; v_mal bigint;
BEGIN
  IF p_vieja IS NULL OR btrim(p_vieja) = '' OR p_nueva IS NULL OR btrim(p_nueva) = '' THEN
    RAISE EXCEPTION 'Hacen falta LAS DOS llaves: la que cifro los datos y la nueva';
  END IF;
  IF p_vieja = p_nueva THEN
    RAISE EXCEPTION 'La llave nueva es la misma que la vieja: no hay rotacion que hacer';
  END IF;

  FOR c IN SELECT * FROM plataforma.columnas_cifradas ORDER BY esquema, tabla LOOP
    -- Solo se toca lo que se puede descifrar con la VIEJA. Lo que ya esta
    -- con la nueva se cuenta aparte, y por eso esto se puede repetir.
    v_sql := format(
      'WITH m AS (UPDATE %I.%I SET %I = pgp_sym_encrypt(pgp_sym_decrypt(%I, $1), $2) '
      ||'WHERE %I IS NOT NULL AND plataforma.se_descifra(%I, $1) RETURNING 1) '
      ||'SELECT count(*) FROM m',
      c.esquema, c.tabla, c.columna, c.columna, c.columna, c.columna);
    EXECUTE v_sql INTO v_rec USING p_vieja, p_nueva;

    EXECUTE format('SELECT count(*) FILTER (WHERE plataforma.se_descifra(%I,$1)), '
                 ||'count(*) FILTER (WHERE NOT plataforma.se_descifra(%I,$1)) '
                 ||'FROM %I.%I WHERE %I IS NOT NULL',
                   c.columna, c.columna, c.esquema, c.tabla, c.columna)
      INTO v_ya, v_mal USING p_nueva;

    objeto := c.esquema||'.'||c.tabla||'.'||c.columna;
    recifradas := v_rec; ya_estaban := v_ya - v_rec; ilegibles := v_mal;
    RETURN NEXT;
  END LOOP;
END $$;

COMMENT ON FUNCTION plataforma.recifrar_n4 IS
  'Recifra las columnas N4 de la llave vieja a la nueva. Se puede cortar y '
  'volver a correr. ⛔ No se destruye la version anterior de la llave en KMS '
  'hasta que verificar_cifrado_n4(nueva) devuelva CERO ilegibles.';

-- La aplicación NO rota llaves: esto es mantenimiento, con la llave en mano.
REVOKE ALL ON FUNCTION plataforma.recifrar_n4(text,text) FROM PUBLIC, casaroca_app, casaroca_lectura;
REVOKE ALL ON FUNCTION plataforma.verificar_cifrado_n4(text) FROM PUBLIC, casaroca_app, casaroca_lectura;

COMMIT;
