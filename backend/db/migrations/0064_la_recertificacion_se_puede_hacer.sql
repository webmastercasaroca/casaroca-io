-- =====================================================================
-- 0064 · LA RECERTIFICACIÓN SE PUEDE HACER, Y EL NÚMERO DICE LA VERDAD
--
-- ⛔ TRES COSAS QUE UNA AUDITORÍA DE ACCESOS MIRA PRIMERO, Y QUE ESTABAN
--    MAL las tres. Salieron de la auditoría interna del 20 de septiembre
--    de 2026.
--
-- 1. EL NÚMERO ERA FALSO. La vista `v_accesos_por_recertificar` se llama
--    «por recertificar» y su comentario dice que es la lista de trabajo
--    del comité trimestral, pero su WHERE solo excluía lo revocado y lo
--    vencido: devolvía TODOS los accesos vigentes. El tablero pintaba ese
--    total bajo la etiqueta «Por recertificar» y la API escribía encima
--    «N accesos llevan más del plazo sin revisarse». Con un acceso
--    otorgado hoy, ya contaba. Es la clase de cifra que un auditor
--    contrasta contra la base en treinta segundos.
--
-- 2. NO SE PODÍA RECERTIFICAR. La tabla `identidad.recertificaciones`
--    existe desde la migración 0045 y NADIE escribe en ella: no hay una
--    sola ruta ni función que lo haga. La pantalla del comité era una
--    lista que no se podía tachar, así que `dias_sin_revisar` solo podía
--    crecer y el número nunca iba a bajar.
--
-- 3. EL TIEMPO RESTANTE DE UNA SESIÓN LLEGABA COMO `[object Object]`.
--    `le_queda` es un `interval`, y el controlador de Postgres lo
--    convierte en un objeto de JavaScript que no sabe convertirse en
--    texto. En la pantalla de sesiones activas, TODAS las filas decían
--    «[object Object]».
-- =====================================================================
BEGIN;

-- ── 1 · La vista dice cuál está vencido, y quien pregunte puede filtrar.
CREATE OR REPLACE VIEW identidad.v_accesos_por_recertificar
WITH (security_invoker = true) AS
SELECT a.id AS asignacion_id, a.persona_id,
       p.primer_nombre||' '||p.primer_apellido AS persona,
       a.rol, a.alcance_tipo, a.nivel_max, a.vigente_desde,
       (SELECT max(r.revisada_en) FROM identidad.recertificaciones r
         WHERE r.asignacion_id = a.id) AS ultima_revision,
       COALESCE(
         (CURRENT_DATE - (SELECT max(r.revisada_en) FROM identidad.recertificaciones r
                           WHERE r.asignacion_id = a.id)::date),
         (CURRENT_DATE - a.vigente_desde)) AS dias_sin_revisar,
       CASE WHEN a.nivel_max >= 3 THEN 90 ELSE 180 END AS tope_dias,
       /* ⛔ LA COLUMNA QUE FALTABA. Sin ella, «por recertificar» era
          «todos». Un acceso N3 o N4 se revisa cada 90 días; el resto,
          cada 180. */
       COALESCE(
         (CURRENT_DATE - (SELECT max(r.revisada_en) FROM identidad.recertificaciones r
                           WHERE r.asignacion_id = a.id)::date),
         (CURRENT_DATE - a.vigente_desde))
         > (CASE WHEN a.nivel_max >= 3 THEN 90 ELSE 180 END) AS vencido
FROM identidad.asignaciones a
JOIN nucleo.personas p ON p.id = a.persona_id
WHERE a.revocada_en IS NULL
  AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE);

COMMENT ON VIEW identidad.v_accesos_por_recertificar IS
  'Accesos vigentes con su antigüedad sin revisar. `vencido` marca los que pasaron su plazo (90 dias si tocan N3 o N4, 180 el resto): ESOS son la lista de trabajo del comite trimestral. Sin ese filtro, el contador contaba todos los accesos de la red.';

-- ── 2 · Recertificar de verdad: la puerta que no existía.
CREATE OR REPLACE FUNCTION identidad.recertificar(
  p_asignacion uuid,
  p_veredicto  text,          -- 'se_mantiene' | 'se_reduce' | 'se_revoca'
  p_nota       text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = identidad, nucleo, plataforma, public, pg_temp AS $$
DECLARE
  v_a     identidad.asignaciones%ROWTYPE;
  v_quien uuid := plataforma.ctx_persona_id();
BEGIN
  /* ⛔ Los tres valores que admite la tabla desde la migración 0045. Se
     comprueban AQUÍ para dar una frase que se entienda, en vez de dejar
     que reviente la restricción con su nombre interno. */
  IF p_veredicto NOT IN ('se_mantiene', 'se_reduce', 'se_revoca') THEN
    RAISE EXCEPTION 'El veredicto tiene que ser «se_mantiene», «se_reduce» o «se_revoca».'
      USING ERRCODE = 'check_violation';
  END IF;
  /* ⛔ Revisar sin dejar constancia de POR QUÉ se mantiene un permiso es
     firmar en blanco: es justo lo que el comité tiene que poder enseñar. */
  IF p_nota IS NULL OR length(btrim(p_nota)) < 5 THEN
    RAISE EXCEPTION 'Escriba por qué se mantiene o se quita el acceso: la revisión queda firmada con su nombre.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_a FROM identidad.asignaciones WHERE id = p_asignacion;
  IF v_a.id IS NULL THEN
    RAISE EXCEPTION 'No existe esa asignación.' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_a.revocada_en IS NOT NULL THEN
    RAISE EXCEPTION 'Ese acceso ya estaba revocado: no hay nada que recertificar.'
      USING ERRCODE = 'no_data_found';
  END IF;

  PERFORM identidad.exigir_admin_de(v_a.persona_id);

  INSERT INTO identidad.recertificaciones
    (asignacion_id, revisada_en, revisada_por, veredicto, nota)
  VALUES (p_asignacion, now(), v_quien, p_veredicto, btrim(p_nota));

  /* Un veredicto de «revocar» NO se queda en una nota: se ejecuta. */
  IF p_veredicto = 'se_revoca' THEN
    PERFORM identidad.revocar_asignacion(p_asignacion,
      'Revocado en la recertificación: ' || btrim(p_nota));
  END IF;

  RETURN jsonb_build_object('asignacion', p_asignacion, 'veredicto', p_veredicto,
                            'revisada_por', v_quien, 'revisada_en', now());
END $$;

REVOKE ALL ON FUNCTION identidad.recertificar(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identidad.recertificar(uuid, text, text) TO casaroca_app;

-- ── 3 · El tiempo restante, como TEXTO.
DROP FUNCTION IF EXISTS identidad.ver_sesiones_activas(int);
CREATE OR REPLACE FUNCTION identidad.ver_sesiones_activas(p_limite int DEFAULT 200)
RETURNS TABLE (sesion uuid, usuario text, persona_id uuid, persona text,
               emitida_en timestamptz, expira_en timestamptz, ip inet, agente text,
               le_queda text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = identidad, nucleo, plataforma, public, pg_temp AS $$
BEGIN
  PERFORM identidad.exigir_admin_de(NULL);
  RETURN QUERY SELECT v.sesion, v.usuario::text, v.persona_id, v.persona::text,
                      v.emitida_en, v.expira_en, v.ip, v.agente,
                      /* ⛔ Un `interval` viaja a JavaScript como un objeto
                         que no sabe convertirse en texto: la pantalla
                         mostraba «[object Object]» en todas las filas.
                         Se formatea aquí, en castellano. */
                      CASE
                        WHEN v.le_queda <= interval '0' THEN 'vencida'
                        WHEN v.le_queda < interval '1 minute' THEN 'menos de un minuto'
                        WHEN v.le_queda < interval '1 hour'
                          THEN (EXTRACT(epoch FROM v.le_queda)/60)::int || ' min'
                        ELSE (EXTRACT(epoch FROM v.le_queda)/3600)::int || ' h '
                             || (EXTRACT(epoch FROM v.le_queda)::int % 3600 / 60) || ' min'
                      END::text
                 FROM identidad.v_sesiones_activas v
                ORDER BY v.emitida_en DESC
                LIMIT GREATEST(1, LEAST(p_limite, 500));
END $$;

REVOKE ALL ON FUNCTION identidad.ver_sesiones_activas(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identidad.ver_sesiones_activas(int) TO casaroca_app;

COMMIT;
