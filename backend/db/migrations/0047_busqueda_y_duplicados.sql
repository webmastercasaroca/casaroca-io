-- =====================================================================
-- Migración 0047 — BUSCAR SIN SABER ESCRIBIR EL NOMBRE, Y FUSIONAR
--
-- ⛔ EL PROBLEMA. La base tenía `unaccent` pero NO `pg_trgm`, y el índice
--    de nombre servía para exacto y para prefijo. Resultado: quien busca
--    «Jon Chavez» no encuentra a «Jhon Chávez», y crea el duplicado.
--
--    Con 25.000 personas llegando desde 36 fuentes distintas, los
--    duplicados no son un riesgo: son una certeza. Y un duplicado en el
--    maestro de personas se multiplica por trece módulos: dos fichas de
--    aportes, dos certificados, dos historias pastorales, y una familia
--    que recibe el mismo mensaje dos veces.
--
-- ⭐ LO QUE ENTRA:
--    1 · Búsqueda que tolera errores de digitación, tildes y orden de los
--        nombres, y que además busca por documento, teléfono y correo.
--    2 · Detección de candidatos a duplicado, con puntaje y motivo.
--    3 · Fusión REVERSIBLE en lo que importa: la persona duplicada no se
--        borra, queda como lápida apuntando a la principal, y todas las
--        referencias se mueven. La fusión queda registrada con quién y
--        por qué.
--
-- ⛔ La búsqueda corre como el invocador: lo que no alcanza la sesión, no
--    sale en los resultados. Una búsqueda que se salta la seguridad por
--    fila es la forma más cómoda de leer los datos de otra sede.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------
-- 1 · EL NOMBRE NORMALIZADO, INDEXADO PARA SIMILITUD
-- ---------------------------------------------------------------------
ALTER TABLE nucleo.personas
  ADD COLUMN nombre_busqueda text
  GENERATED ALWAYS AS (
    nucleo.normalizar(
      coalesce(primer_nombre,'')||' '||coalesce(segundo_nombre,'')||' '||
      coalesce(primer_apellido,'')||' '||coalesce(segundo_apellido,''))
  ) STORED;

CREATE INDEX personas_busqueda_trgm ON nucleo.personas
  USING gin (nombre_busqueda gin_trgm_ops) WHERE eliminado_en IS NULL;

COMMENT ON COLUMN nucleo.personas.nombre_busqueda IS
  'Nombre completo normalizado (sin tildes, minusculas) con indice de trigramas. Es lo que hace que «Jon» encuentre a «Jhon».';

-- ---------------------------------------------------------------------
-- 2 · BUSCAR · un solo cuadro de texto para todo
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION nucleo.buscar_personas(
  p_texto text, p_limite int DEFAULT 20, p_umbral real DEFAULT 0.25
) RETURNS TABLE(
  id uuid, nombre text, documento text, sede_codigo text,
  estado text, parecido real, por_que text
) LANGUAGE sql STABLE AS $$
  WITH q AS (SELECT nucleo.normalizar(p_texto) AS t,
                    regexp_replace(coalesce(p_texto,''), '[^0-9]', '', 'g') AS digitos)
  SELECT p.id,
         trim(concat_ws(' ', p.primer_nombre, p.segundo_nombre, p.primer_apellido, p.segundo_apellido)),
         nullif(concat_ws(' ', p.tipo_documento, p.numero_documento), ' '),
         s.codigo,
         p.estado::text,
         GREATEST(
           similarity(p.nombre_busqueda, q.t),
           CASE WHEN length(q.digitos) >= 5 AND p.numero_documento = q.digitos THEN 1.0 ELSE 0 END,
           CASE WHEN length(q.digitos) >= 7 AND p.telefono_movil IS NOT NULL
                     AND regexp_replace(p.telefono_movil,'[^0-9]','','g') LIKE '%'||q.digitos||'%'
                THEN 0.95 ELSE 0 END,
           CASE WHEN p_texto ~ '@' AND lower(p.email_principal::text) = lower(p_texto) THEN 1.0 ELSE 0 END
         )::real,
         CASE
           WHEN length(q.digitos) >= 5 AND p.numero_documento = q.digitos THEN 'documento exacto'
           WHEN p_texto ~ '@' AND lower(p.email_principal::text) = lower(p_texto) THEN 'correo exacto'
           WHEN length(q.digitos) >= 7 AND p.telefono_movil IS NOT NULL
                AND regexp_replace(p.telefono_movil,'[^0-9]','','g') LIKE '%'||q.digitos||'%' THEN 'telefono'
           ELSE 'nombre parecido'
         END
  FROM nucleo.personas p
  CROSS JOIN q
  LEFT JOIN org.sedes s ON s.id = p.sede_id
  WHERE p.eliminado_en IS NULL
    AND (
      p.nombre_busqueda % q.t
      OR (length(q.digitos) >= 5 AND p.numero_documento = q.digitos)
      OR (length(q.digitos) >= 7 AND p.telefono_movil IS NOT NULL
          AND regexp_replace(p.telefono_movil,'[^0-9]','','g') LIKE '%'||q.digitos||'%')
      OR (p_texto ~ '@' AND lower(p.email_principal::text) = lower(p_texto))
    )
  ORDER BY 6 DESC, 2
  LIMIT p_limite;
$$;

COMMENT ON FUNCTION nucleo.buscar_personas IS
  'Un solo cuadro: nombre con errores, documento, telefono o correo. Corre como el invocador, asi que respeta la seguridad por fila.';

-- ---------------------------------------------------------------------
-- 3 · CANDIDATOS A DUPLICADO · con puntaje y motivo
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION nucleo.candidatos_duplicado(
  p_persona uuid, p_umbral real DEFAULT 0.45
) RETURNS TABLE(
  candidata_id uuid, nombre text, sede_codigo text, puntaje real, motivos text
) LANGUAGE sql STABLE AS $$
  WITH yo AS (SELECT * FROM nucleo.personas WHERE id = p_persona)
  SELECT o.id,
         trim(concat_ws(' ', o.primer_nombre, o.segundo_nombre, o.primer_apellido, o.segundo_apellido)),
         s.codigo,
         (similarity(o.nombre_busqueda, yo.nombre_busqueda)
          + CASE WHEN o.numero_documento IS NOT NULL AND o.numero_documento = yo.numero_documento THEN 1.0 ELSE 0 END
          + CASE WHEN o.fecha_nacimiento IS NOT NULL AND o.fecha_nacimiento = yo.fecha_nacimiento THEN 0.5 ELSE 0 END
          + CASE WHEN o.email_principal IS NOT NULL AND o.email_principal = yo.email_principal THEN 0.8 ELSE 0 END
          + CASE WHEN o.telefono_movil IS NOT NULL AND o.telefono_movil = yo.telefono_movil THEN 0.6 ELSE 0 END
         )::real,
         concat_ws(' · ',
           CASE WHEN similarity(o.nombre_busqueda, yo.nombre_busqueda) > 0.4
                THEN 'nombre '||round(similarity(o.nombre_busqueda, yo.nombre_busqueda)::numeric*100)||'%' END,
           CASE WHEN o.numero_documento = yo.numero_documento THEN 'MISMO DOCUMENTO' END,
           CASE WHEN o.fecha_nacimiento = yo.fecha_nacimiento THEN 'misma fecha de nacimiento' END,
           CASE WHEN o.email_principal = yo.email_principal THEN 'mismo correo' END,
           CASE WHEN o.telefono_movil = yo.telefono_movil THEN 'mismo telefono' END)
  FROM nucleo.personas o CROSS JOIN yo
  LEFT JOIN org.sedes s ON s.id = o.sede_id
  WHERE o.id <> p_persona
    AND o.eliminado_en IS NULL
    AND o.estado::text <> 'fusionada'
    AND (o.nombre_busqueda % yo.nombre_busqueda
         OR o.numero_documento = yo.numero_documento
         OR o.email_principal = yo.email_principal
         OR o.telefono_movil = yo.telefono_movil)
  ORDER BY 4 DESC
  LIMIT 20;
$$;

-- ---------------------------------------------------------------------
-- 4 · FUSIONAR · mover TODAS las referencias, sin saber cuáles son
--     El recorrido es por las claves foráneas reales: una tabla nueva
--     que apunte a personas queda cubierta sin tocar esta función.
-- ---------------------------------------------------------------------
CREATE TABLE nucleo.fusiones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  principal_id  uuid NOT NULL REFERENCES nucleo.personas(id),
  duplicada_id  uuid NOT NULL REFERENCES nucleo.personas(id),
  motivo        text NOT NULL,
  fusionada_por uuid REFERENCES nucleo.personas(id),
  fusionada_en  timestamptz NOT NULL DEFAULT now(),
  referencias_movidas jsonb NOT NULL DEFAULT '{}'::jsonb,
  conflictos    jsonb NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT fusion_no_es_la_misma CHECK (principal_id <> duplicada_id)
);
CREATE RULE fusiones_no_update AS ON UPDATE TO nucleo.fusiones DO INSTEAD NOTHING;
CREATE RULE fusiones_no_delete AS ON DELETE TO nucleo.fusiones DO INSTEAD NOTHING;

CREATE OR REPLACE FUNCTION nucleo.fusionar(
  p_principal uuid, p_duplicada uuid, p_motivo text, p_quien uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  r record; v_movidas jsonb := '{}'::jsonb; v_conf jsonb := '[]'::jsonb;
  v_n bigint; v_id uuid; v_estado text;
BEGIN
  IF p_principal = p_duplicada THEN
    RAISE EXCEPTION 'No se puede fusionar una persona consigo misma' USING ERRCODE='check_violation';
  END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) < 10 THEN
    RAISE EXCEPTION 'Una fusion exige un motivo escrito: es irreversible para quien la lee despues'
      USING ERRCODE='check_violation';
  END IF;
  SELECT estado::text INTO v_estado FROM nucleo.personas WHERE id = p_duplicada;
  IF v_estado = 'fusionada' THEN
    RAISE EXCEPTION 'Esa persona ya fue fusionada en otra' USING ERRCODE='check_violation';
  END IF;

  -- Toda tabla que apunte a nucleo.personas, descubierta por sus claves
  -- foraneas. No hay lista que mantener.
  FOR r IN
    SELECT n.nspname AS esq, c.relname AS tabla, a.attname AS col
    FROM pg_constraint k
    JOIN pg_class c ON c.oid = k.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1]
    WHERE k.contype = 'f'
      AND k.confrelid = 'nucleo.personas'::regclass
      AND array_length(k.conkey,1) = 1
      AND NOT (n.nspname = 'nucleo' AND c.relname IN ('personas','fusiones'))
    ORDER BY 1,2
  LOOP
    BEGIN
      EXECUTE format('UPDATE %I.%I SET %I = $1 WHERE %I = $2', r.esq, r.tabla, r.col, r.col)
        USING p_principal, p_duplicada;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      IF v_n > 0 THEN
        v_movidas := v_movidas || jsonb_build_object(r.esq||'.'||r.tabla||'.'||r.col, v_n);
      END IF;
    EXCEPTION WHEN unique_violation OR check_violation THEN
      -- La fila chocaria con una que la principal ya tiene (por ejemplo,
      -- las dos personas son miembros de la misma sede). Se deja donde
      -- esta, apuntando a la lapida, y se registra el conflicto.
      v_conf := v_conf || jsonb_build_object(
        'objeto', r.esq||'.'||r.tabla||'.'||r.col, 'razon', SQLERRM);
    END;
  END LOOP;

  UPDATE nucleo.personas
     SET estado = 'fusionada', fusionada_en_id = p_principal, eliminado_en = now()
   WHERE id = p_duplicada;

  INSERT INTO nucleo.fusiones (principal_id, duplicada_id, motivo, fusionada_por, referencias_movidas, conflictos)
  VALUES (p_principal, p_duplicada, p_motivo, p_quien, v_movidas, v_conf)
  RETURNING id INTO v_id;

  PERFORM crm.anotar_hecho(p_principal, (SELECT sede_id FROM nucleo.personas WHERE id = p_principal),
    now(), 'FUSION_PERSONAS', 'personas', 'fusion', v_id::text,
    'Se fusiono un registro duplicado: '||p_motivo,
    jsonb_build_object('duplicada', p_duplicada, 'movidas', v_movidas, 'conflictos', v_conf));

  RETURN v_id;
END $$;

COMMENT ON FUNCTION nucleo.fusionar IS
  'Mueve todas las referencias por clave foranea, deja la duplicada como lapida apuntando a la principal, y registra que se movio y que choco.';

INSERT INTO crm.tipos_hecho (codigo, nombre, modulo, nivel)
SELECT 'FUSION_PERSONAS','Fusion de registros duplicados','personas',1
WHERE NOT EXISTS (SELECT 1 FROM crm.tipos_hecho WHERE codigo='FUSION_PERSONAS');

-- ---------------------------------------------------------------------
-- 5 · TABLERO DE CALIDAD DEL DATO (checklist B13.06)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW nucleo.v_calidad_datos
WITH (security_invoker = true) AS
SELECT s.codigo AS sede,
       count(*)                                                        AS personas,
       count(*) FILTER (WHERE p.numero_documento IS NULL)              AS sin_documento,
       count(*) FILTER (WHERE p.email_principal IS NULL
                          AND p.telefono_movil IS NULL)                AS sin_forma_de_contacto,
       count(*) FILTER (WHERE p.fecha_nacimiento IS NULL)              AS sin_fecha_nacimiento,
       count(*) FILTER (WHERE p.source_system IS NULL)                 AS sin_linaje,
       count(*) FILTER (WHERE p.estado::text = 'fusionada')            AS fusionadas,
       round(100.0 * count(*) FILTER (WHERE p.numero_documento IS NOT NULL) / NULLIF(count(*),0), 1) AS pct_con_documento
FROM nucleo.personas p
LEFT JOIN org.sedes s ON s.id = p.sede_id
WHERE p.eliminado_en IS NULL OR p.estado::text = 'fusionada'
GROUP BY s.codigo;

SELECT plataforma.publicar_tabla('nucleo.fusiones'::regclass, 'por_persona',
  'Registro de fusiones. Se lee para auditar que paso con un duplicado; nadie lo altera.',
  'Mesa tecnica 100p', true);
CREATE POLICY fusiones_sel ON nucleo.fusiones FOR SELECT
  USING (EXISTS (SELECT 1 FROM nucleo.personas p WHERE p.id = nucleo.fusiones.principal_id
                   AND plataforma.sede_visible(p.sede_id)));
CREATE POLICY fusiones_ins ON nucleo.fusiones FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM nucleo.personas p WHERE p.id = nucleo.fusiones.principal_id
                        AND plataforma.sede_visible(p.sede_id)));
GRANT SELECT ON nucleo.v_calidad_datos TO casaroca_app, casaroca_lectura;
