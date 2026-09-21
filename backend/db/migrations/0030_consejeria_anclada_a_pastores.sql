-- =====================================================================
-- Migración 0030 — CONSEJERÍA ANCLADA A LOS PASTORES
--
-- Al implementarlo aparece una tensión que conviene dejar escrita, porque
-- va a volver con cada módulo N3:
--
--   El techo de sensibilidad es UN NÚMERO, pero la sensibilidad tiene
--   DOMINIOS. Un pastor congregacional debe ver la consejería de su sede
--   (N3) y NO debe ver los aportes (N3 también). Con un solo escalar no
--   se puede decir eso: o sube a N3 y alcanza las dos cosas, o se queda
--   en N2 y no alcanza ninguna.
--
-- La salida no es subirle el techo. Es reconocer que el acceso pastoral
-- a la consejería no se justifica por un nivel, sino por una RELACIÓN:
-- se es pastor DE esa sede. Eso sí se puede expresar, y además es lo que
-- de verdad ocurre en la iglesia.
--
--   · El CONSEJERO ve los casos que le fueron asignados.
--   · El PASTOR de la sede ve los casos de SU sede, por ser su pastor.
--   · El PASTOR PRINCIPAL y el DIRECTOR GENERAL, los de la organización.
--   · Los aportes siguen fuera del alcance de todos ellos salvo del
--     Director General, porque ahí el techo N2 sigue mandando.
-- =====================================================================

-- ¿Es esta persona pastor de esta sede?
-- SECURITY DEFINER porque se llama desde una política de RLS, donde leer
-- `identidad.asignaciones` chocaría con su propio RLS. Solo responde sí o
-- no sobre la pareja que se le pasa.
CREATE OR REPLACE FUNCTION identidad.es_pastor_de(p_persona_id uuid, p_sede_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT EXISTS (
    SELECT 1 FROM identidad.asignaciones a
    WHERE a.persona_id = p_persona_id
      AND a.rol IN ('PASTOR_DIRECTOR_GENERAL','PASTOR_PRINCIPAL','PASTOR_CONGREGACIONAL')
      AND a.vigente_desde <= CURRENT_DATE
      AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)
      AND (a.alcance_tipo = 'organizacion'
           OR (a.alcance_tipo = 'sede' AND a.alcance_id = p_sede_id))
  );
$$;

COMMENT ON FUNCTION identidad.es_pastor_de IS
  'El acceso pastoral a la consejería no se justifica por un nivel de sensibilidad, sino por una relación: se es pastor DE esa sede. Esta función es esa relación.';

REVOKE ALL ON FUNCTION identidad.es_pastor_de(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identidad.es_pastor_de(uuid,uuid) TO casaroca_app;

CREATE OR REPLACE FUNCTION consejeria.caso_visible(p_caso_id uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT
    (plataforma.ctx_nivel_max() >= 3
     AND EXISTS (SELECT 1 FROM consejeria.asignaciones a
                  WHERE a.caso_id = p_caso_id
                    AND a.consejero_id = plataforma.ctx_persona_id()
                    AND a.hasta IS NULL))
    OR
    EXISTS (SELECT 1 FROM consejeria.casos c
             WHERE c.id = p_caso_id
               AND identidad.es_pastor_de(plataforma.ctx_persona_id(), c.sede_id))
$$;

COMMENT ON FUNCTION consejeria.caso_visible IS
  'Dos caminos, y solo dos: el consejero asignado, o el pastor de esa sede. Nadie más, ni siquiera con nivel N3.';

-- La matriz: el permiso declarado, con su nivel ACOTADO AL MÓDULO.
ALTER TABLE sistema.matriz_permisos
  ADD COLUMN nivel_max smallint REFERENCES plataforma.niveles_sensibilidad(nivel);

COMMENT ON COLUMN sistema.matriz_permisos.nivel_max IS
  'Elevación acotada a ESTE módulo. NULL = se usa el techo del rol. Permite que un pastor alcance la consejería sin alcanzar los aportes.';

CREATE OR REPLACE FUNCTION sistema.tg_permiso_respeta_nivel() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_techo smallint; v_nivel smallint; v_mod text; v_efectivo smallint;
BEGIN
  SELECT nivel_maximo INTO v_techo FROM identidad.roles WHERE codigo = NEW.rol;
  SELECT nivel_dato, nombre INTO v_nivel, v_mod FROM sistema.modulos WHERE codigo = NEW.modulo;
  v_efectivo := COALESCE(NEW.nivel_max, v_techo);
  IF v_efectivo < v_nivel THEN
    RAISE EXCEPTION 'El rol % alcanza N% y el módulo «%» maneja dato N%: el permiso no es otorgable',
      NEW.rol, v_efectivo, v_mod, v_nivel
      USING ERRCODE = 'check_violation',
            HINT = 'Si la excepción es legítima, decláre la en nivel_max de esta fila — nunca subiendo el techo del rol, que la extendería a TODOS los módulos.';
  END IF;
  RETURN NEW;
END
$$;

-- ⛔ Lo que NO se hace, y queda escrito para que nadie lo "arregle":
--    al Pastor Congregacional NO se le sube el techo a N3. Sigue en N2.
--    Su acceso a consejería es la excepción declarada de arriba; los
--    aportes le siguen quedando fuera, que es lo que se defendió en la
--    mesa y lo que la vista `aportes.v_habito_aporte` hace posible.
