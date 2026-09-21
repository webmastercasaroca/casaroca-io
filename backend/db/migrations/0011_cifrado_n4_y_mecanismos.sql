-- =====================================================================
-- Migración 0011 — MECANISMO DE PROTECCIÓN POR COLUMNA + CIFRADO N4 REAL
--
-- Origen: el banco de invariantes (P14) marcó dos hallazgos legítimos.
-- Se habían clasificado `nucleo.acudientes.menor_id` y `.acudiente_id`
-- como N4 con exigencia de cifrado. Es incorrecto, y no por comodidad:
--
--   Una clave foránea cifrada deja de poder unirse. Se pierde la
--   integridad referencial, que es justamente el control que impide
--   que un menor quede sin acudiente. Cifrar ahí destruye una garantía
--   más fuerte que la que aporta.
--
-- La protección correcta de un identificador N4 es RLS + bitácora de
-- lectura + prohibición de exportación. El cifrado por columna es para
-- el CONTENIDO sensible. Este archivo separa ambos mecanismos y añade
-- un dato N4 realmente cifrado: el código de entrega segura de RocaKids.
-- =====================================================================

ALTER TABLE plataforma.clasificacion_columna
  ADD COLUMN mecanismo text NOT NULL DEFAULT 'cifrado_columna'
    CHECK (mecanismo IN ('cifrado_columna','rls_y_bitacora','enmascarado'));

COMMENT ON COLUMN plataforma.clasificacion_columna.mecanismo IS
  'Cómo se protege esta columna. Una clave de unión no se cifra: se protege con RLS y bitácora.';

-- Reclasificación de los dos hallazgos.
UPDATE plataforma.clasificacion_columna
   SET mecanismo = 'rls_y_bitacora'
 WHERE esquema='nucleo' AND tabla='acudientes' AND columna IN ('menor_id','acudiente_id');

-- La vista de control ahora exige cifrado SOLO donde el mecanismo es cifrado.
-- CREATE OR REPLACE no admite insertar una columna en medio: hay que soltarla.
DROP VIEW plataforma.v_control_clasificacion;
CREATE VIEW plataforma.v_control_clasificacion AS
SELECT c.esquema, c.tabla, c.columna, c.nivel, n.codigo, c.mecanismo,
       n.exige_cifrado, c.cifrada,
       (n.exige_cifrado AND c.mecanismo = 'cifrado_columna' AND NOT c.cifrada) AS incumple_cifrado
FROM plataforma.clasificacion_columna c
JOIN plataforma.niveles_sensibilidad n USING (nivel);

-- ---------------------------------------------------------------------
-- CÓDIGO DE ENTREGA SEGURA (N4, cifrado de verdad).
-- En desarrollo la llave viene de un GUC. En producción viene del gestor
-- de llaves (KMS) — nunca del código ni de una tabla de la propia base.
-- ---------------------------------------------------------------------
ALTER TABLE nucleo.acudientes
  ADD COLUMN codigo_entrega_cifrado bytea;

CREATE OR REPLACE FUNCTION plataforma.llave_n4() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('app.llave_n4', true), ''),
                  -- Sin llave no se cifra ni se descifra: falla ruidosamente.
                  NULL)
$$;

CREATE OR REPLACE FUNCTION nucleo.fijar_codigo_entrega(p_acudiente_row uuid, p_codigo text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_llave text := plataforma.llave_n4();
BEGIN
  IF v_llave IS NULL THEN
    RAISE EXCEPTION 'No hay llave N4 en la sesión: no se puede cifrar el código de entrega'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE nucleo.acudientes
     SET codigo_entrega_cifrado = pgp_sym_encrypt(p_codigo, v_llave)
   WHERE id = p_acudiente_row;
END
$$;

-- Verificar NO descifra para mostrar: compara. El código nunca se devuelve.
CREATE OR REPLACE FUNCTION nucleo.verificar_codigo_entrega(p_acudiente_row uuid, p_codigo text)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE v_llave text := plataforma.llave_n4(); v_cifrado bytea; v_ok boolean;
BEGIN
  IF v_llave IS NULL THEN
    RAISE EXCEPTION 'No hay llave N4 en la sesión' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT codigo_entrega_cifrado INTO v_cifrado FROM nucleo.acudientes WHERE id = p_acudiente_row;
  IF v_cifrado IS NULL THEN RETURN false; END IF;

  v_ok := pgp_sym_decrypt(v_cifrado, v_llave) = p_codigo;

  -- Toda comprobación de un dato N4 queda en la bitácora de lectura.
  PERFORM plataforma.registrar_lectura('nucleo','acudientes',p_acudiente_row::text,4::smallint,
          'Verificación de código de entrega de menor');
  RETURN v_ok;
END
$$;

INSERT INTO plataforma.clasificacion_columna (esquema,tabla,columna,nivel,finalidad,cifrada,mecanismo)
VALUES ('nucleo','acudientes','codigo_entrega_cifrado',4,
        'Entrega segura de menores en RocaKids', true, 'cifrado_columna')
ON CONFLICT (esquema,tabla,columna) DO UPDATE
  SET cifrada = true, mecanismo = 'cifrado_columna';

COMMENT ON COLUMN nucleo.acudientes.codigo_entrega_cifrado IS
  'N4 cifrado con pgp_sym_encrypt. Nunca se devuelve en claro: solo se verifica por comparación.';
