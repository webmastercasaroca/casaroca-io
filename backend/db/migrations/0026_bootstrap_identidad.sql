-- =====================================================================
-- Migración 0026 — EL ARRANQUE DE LA IDENTIDAD
--
-- Consecuencia directa de cerrar la fuga de las vistas (0025), y hay que
-- entenderla bien porque es un círculo:
--
--   Para fijar el contexto de la sesión hay que saber qué sedes puede
--   tocar la persona. Eso está en `identidad.asignaciones`, que tiene
--   RLS. Y la política de RLS pregunta por el contexto... que es
--   justamente lo que todavía no se ha fijado.
--
-- Antes «funcionaba» porque las vistas corrían como su propietario y se
-- saltaban RLS. Eso no era una solución: era el agujero.
--
-- La salida correcta es una puerta estrecha y declarada: dos funciones
-- SECURITY DEFINER que SOLO responden sobre la persona que se les pasa,
-- y nada más. No devuelven filas: devuelven un arreglo de sedes y un
-- número. Es el mínimo necesario para arrancar la sesión.
--
-- ⛔ `search_path` fijo: sin él, una función SECURITY DEFINER se puede
--    secuestrar creando un objeto con el mismo nombre en otro esquema.
-- =====================================================================

CREATE OR REPLACE FUNCTION identidad.sedes_de(p_persona_id uuid) RETURNS uuid[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT COALESCE(array_agg(DISTINCT s.id), '{}'::uuid[])
  FROM identidad.asignaciones a
  JOIN identidad.roles r ON r.codigo = a.rol
  JOIN org.sedes s ON (a.alcance_tipo = 'organizacion' OR s.id = a.alcance_id)
  WHERE a.persona_id = p_persona_id
    AND a.vigente_desde <= CURRENT_DATE
    AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE);
$$;

CREATE OR REPLACE FUNCTION identidad.nivel_max_de(p_persona_id uuid) RETURNS smallint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT COALESCE(MAX(LEAST(a.nivel_max, r.nivel_maximo)), 0)::smallint
  FROM identidad.asignaciones a
  JOIN identidad.roles r ON r.codigo = a.rol
  WHERE a.persona_id = p_persona_id
    AND a.vigente_desde <= CURRENT_DATE
    AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE);
$$;

CREATE OR REPLACE FUNCTION identidad.es_global(p_persona_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT EXISTS (
    SELECT 1 FROM identidad.asignaciones a
    WHERE a.persona_id = p_persona_id
      AND a.alcance_tipo = 'organizacion'
      AND a.vigente_desde <= CURRENT_DATE
      AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE));
$$;

/**
 * El contexto completo de una persona, en una sola llamada.
 * Es lo único que la aplicación necesita para abrir su transacción, y
 * la única puerta por la que se puede preguntar «¿quién es este?».
 */
CREATE OR REPLACE FUNCTION identidad.contexto_de(p_persona_id uuid)
RETURNS TABLE (sedes uuid[], nivel_max smallint, es_global boolean, tiene_acceso boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT identidad.sedes_de(p_persona_id),
         identidad.nivel_max_de(p_persona_id),
         identidad.es_global(p_persona_id),
         -- Sin ninguna asignación vigente NO hay acceso. Es la regla que
         -- el documento de Roles del equipo 100p pide, y aquí se cumple
         -- sola: quien pierde su último rol deja de entrar.
         EXISTS (SELECT 1 FROM identidad.asignaciones a
                  WHERE a.persona_id = p_persona_id
                    AND a.vigente_desde <= CURRENT_DATE
                    AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE));
$$;

COMMENT ON FUNCTION identidad.contexto_de IS
  'Puerta estrecha de arranque. SECURITY DEFINER a propósito: es lo único que puede leer las asignaciones sin contexto previo, y solo responde sobre la persona que se le pasa.';

REVOKE ALL ON FUNCTION identidad.contexto_de(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identidad.contexto_de(uuid) TO casaroca_app;
REVOKE ALL ON FUNCTION identidad.sedes_de(uuid), identidad.nivel_max_de(uuid),
                       identidad.es_global(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identidad.sedes_de(uuid), identidad.nivel_max_de(uuid),
                          identidad.es_global(uuid) TO casaroca_app;
