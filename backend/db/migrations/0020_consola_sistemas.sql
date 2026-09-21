-- =====================================================================
-- Migración 0020 — CONSOLA DE SISTEMAS · MÓDULOS, HABILITACIÓN Y MATRIZ
--
-- Es el plano de aprovisionamiento del ecosistema. Todo lo demás se crea
-- desde aquí, y por eso esta pieza va antes que cualquier otra carga:
--
--   Bogotá Chicó es la SEDE MAESTRA. Desde ella se crean las demás
--   iglesias, se decide qué módulos tiene cada una, y se declara qué
--   puede hacer cada rol en cada módulo.
--
-- Tres cosas que este esquema separa a propósito, y que suelen venir
-- mezcladas en los sistemas de iglesia:
--   1. QUÉ MÓDULOS tiene encendidos una sede        → habilitación
--   2. QUÉ PUEDE HACER un rol en un módulo          → matriz de permisos
--   3. HASTA QUÉ DATO alcanza ese rol               → nivel N0–N4
-- Un permiso efectivo exige las tres. Tener el botón no basta si el
-- módulo está apagado, y tener el módulo no basta si el dato es N4.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS sistema;
COMMENT ON SCHEMA sistema IS
  'Consola de administración. Módulos, habilitación por sede, matriz de permisos y aprovisionamiento de iglesias nuevas.';
GRANT USAGE ON SCHEMA sistema TO casaroca_app, casaroca_lectura, casaroca_migrador;

-- ---------------------------------------------------------------------
-- 1 · EL CATÁLOGO DE MÓDULOS
-- ---------------------------------------------------------------------
CREATE TABLE sistema.modulos (
  codigo          text PRIMARY KEY,
  nombre          text NOT NULL,
  esquema         text NOT NULL,
  orden           smallint NOT NULL,
  descripcion     text NOT NULL,
  -- El dato más sensible que el módulo maneja. Marca el piso de acceso.
  nivel_dato      smallint NOT NULL REFERENCES plataforma.niveles_sensibilidad(nivel),
  -- Un módulo de núcleo no se puede apagar: el sistema deja de funcionar.
  es_nucleo       boolean NOT NULL DEFAULT false,
  -- Módulos que no se encienden hasta que existan los instrumentos
  -- jurídicos (H-02). Es la compuerta legal, hecha columna.
  exige_compuerta_legal boolean NOT NULL DEFAULT false,
  depende_de      text REFERENCES sistema.modulos(codigo)
);

COMMENT ON COLUMN sistema.modulos.exige_compuerta_legal IS
  'Aportes y RocaKids no se habilitan sin evidencia legal registrada. No es una recomendación del manual: la base lo rechaza.';

-- ---------------------------------------------------------------------
-- 2 · LAS ACCIONES
-- ---------------------------------------------------------------------
CREATE TABLE sistema.acciones (
  codigo      text PRIMARY KEY,
  nombre      text NOT NULL,
  orden       smallint NOT NULL,
  es_sensible boolean NOT NULL DEFAULT false
);
INSERT INTO sistema.acciones VALUES
  ('ver',         'Ver',            1, false),
  ('crear',       'Crear',          2, false),
  ('editar',      'Editar',         3, false),
  ('anular',      'Anular',         4, true),
  ('exportar',    'Exportar',       5, true),
  ('administrar', 'Administrar',    6, true);

COMMENT ON COLUMN sistema.acciones.es_sensible IS
  'Exportar es la acción que el taller H-01 debe decidir con más cuidado: es la que saca el dato del sistema.';

-- ---------------------------------------------------------------------
-- 3 · LA MATRIZ · qué puede hacer cada rol en cada módulo
--     Este es el documento que se firma en el taller H-01, vuelto tabla.
-- ---------------------------------------------------------------------
CREATE TABLE sistema.matriz_permisos (
  rol        text NOT NULL REFERENCES identidad.roles(codigo) ON DELETE RESTRICT,
  modulo     text NOT NULL REFERENCES sistema.modulos(codigo) ON DELETE RESTRICT,
  accion     text NOT NULL REFERENCES sistema.acciones(codigo) ON DELETE RESTRICT,
  -- Trazabilidad de la decisión: quién la firmó y cuándo.
  acta_ref   text,
  definido_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (rol, modulo, accion)
);

-- ⛔ Un rol no puede recibir permiso sobre un módulo cuyo dato no alcanza.
--    Da igual lo que diga la matriz: si el techo del rol es N2 y el módulo
--    es N4, el permiso no se puede escribir.
CREATE OR REPLACE FUNCTION sistema.tg_permiso_respeta_nivel() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_techo smallint; v_nivel smallint; v_mod text;
BEGIN
  SELECT nivel_maximo INTO v_techo FROM identidad.roles WHERE codigo = NEW.rol;
  SELECT nivel_dato, nombre INTO v_nivel, v_mod FROM sistema.modulos WHERE codigo = NEW.modulo;
  IF v_techo < v_nivel THEN
    RAISE EXCEPTION 'El rol % tiene techo N% y el módulo «%» maneja dato N%: el permiso no es otorgable',
      NEW.rol, v_techo, v_mod, v_nivel
      USING ERRCODE = 'check_violation',
            HINT = 'Suba el techo del rol en el taller de permisos, o no le asigne este módulo.';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER trg_permiso_respeta_nivel BEFORE INSERT OR UPDATE ON sistema.matriz_permisos
  FOR EACH ROW EXECUTE FUNCTION sistema.tg_permiso_respeta_nivel();

-- ---------------------------------------------------------------------
-- 4 · HABILITACIÓN POR SEDE · qué módulos tiene encendidos cada iglesia
-- ---------------------------------------------------------------------
CREATE TABLE sistema.modulos_sede (
  sede_id       uuid NOT NULL REFERENCES org.sedes(id) ON DELETE RESTRICT,
  modulo        text NOT NULL REFERENCES sistema.modulos(codigo) ON DELETE RESTRICT,
  activo        boolean NOT NULL DEFAULT false,
  activado_en   timestamptz,
  activado_por  uuid REFERENCES nucleo.personas(id),
  -- Evidencia de la compuerta legal para los módulos que la exigen.
  evidencia_legal_ref text,
  nota          text,
  PRIMARY KEY (sede_id, modulo)
);

-- ⛔ Dos reglas que la base impone sola al encender un módulo.
CREATE OR REPLACE FUNCTION sistema.tg_habilitacion_valida() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_nucleo boolean; v_legal boolean; v_dep text; v_nombre text;
BEGIN
  SELECT es_nucleo, exige_compuerta_legal, depende_de, nombre
    INTO v_nucleo, v_legal, v_dep, v_nombre
  FROM sistema.modulos WHERE codigo = NEW.modulo;

  -- (a) un módulo de núcleo no se puede apagar
  IF v_nucleo AND NOT NEW.activo THEN
    RAISE EXCEPTION 'El módulo «%» es de núcleo: no se puede desactivar', v_nombre
      USING ERRCODE = 'check_violation';
  END IF;

  -- (b) compuerta legal: sin evidencia registrada, no se enciende
  IF NEW.activo AND v_legal AND (NEW.evidencia_legal_ref IS NULL OR btrim(NEW.evidencia_legal_ref) = '') THEN
    RAISE EXCEPTION 'El módulo «%» exige la compuerta legal: registre la referencia del instrumento jurídico', v_nombre
      USING ERRCODE = 'check_violation',
            HINT = 'Política de datos, registro SIC y contrato de encargo (hallazgo H-02).';
  END IF;

  -- (c) dependencias: no se enciende un módulo si su base está apagada
  IF NEW.activo AND v_dep IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM sistema.modulos_sede ms
                    WHERE ms.sede_id = NEW.sede_id AND ms.modulo = v_dep AND ms.activo) THEN
      RAISE EXCEPTION 'El módulo «%» depende de «%», que está apagado en esta sede', v_nombre, v_dep
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.activo AND NEW.activado_en IS NULL THEN NEW.activado_en := now(); END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER trg_habilitacion_valida BEFORE INSERT OR UPDATE ON sistema.modulos_sede
  FOR EACH ROW EXECUTE FUNCTION sistema.tg_habilitacion_valida();

-- ---------------------------------------------------------------------
-- 5 · LA SEDE MAESTRA · una sola, y no se puede tocar
-- ---------------------------------------------------------------------
CREATE UNIQUE INDEX sede_maestra_unica ON org.sedes ((tipo = 'sede_madre')) WHERE tipo = 'sede_madre';
COMMENT ON INDEX org.sede_maestra_unica IS
  'Solo puede existir UNA sede madre. Todo el aprovisionamiento cuelga de ella; dos raíces serían dos ecosistemas.';

CREATE OR REPLACE FUNCTION sistema.sede_maestra() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT id FROM org.sedes WHERE tipo = 'sede_madre' $$;

-- La sede maestra no se desactiva ni cambia de tipo.
CREATE OR REPLACE FUNCTION sistema.tg_proteger_sede_maestra() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.tipo = 'sede_madre' THEN
    IF NOT NEW.activa THEN
      RAISE EXCEPTION 'La sede maestra no se puede desactivar' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.tipo <> 'sede_madre' THEN
      RAISE EXCEPTION 'La sede maestra no puede cambiar de tipo mientras existan filiales' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER trg_proteger_sede_maestra BEFORE UPDATE ON org.sedes
  FOR EACH ROW EXECUTE FUNCTION sistema.tg_proteger_sede_maestra();

-- ---------------------------------------------------------------------
-- 6 · PLANTILLAS DE APROVISIONAMIENTO
--     Con qué módulos nace una iglesia según su tipo.
-- ---------------------------------------------------------------------
CREATE TABLE sistema.plantillas (
  codigo      text PRIMARY KEY,
  nombre      text NOT NULL,
  tipo_sede   org.tipo_sede NOT NULL,
  descripcion text NOT NULL
);
CREATE TABLE sistema.plantilla_modulos (
  plantilla text NOT NULL REFERENCES sistema.plantillas(codigo) ON DELETE CASCADE,
  modulo    text NOT NULL REFERENCES sistema.modulos(codigo) ON DELETE RESTRICT,
  PRIMARY KEY (plantilla, modulo)
);

-- ---------------------------------------------------------------------
-- 7 · BITÁCORA DE APROVISIONAMIENTO · append-only
-- ---------------------------------------------------------------------
CREATE TABLE sistema.bitacora_aprovisionamiento (
  id          bigserial PRIMARY KEY,
  ocurrido_en timestamptz NOT NULL DEFAULT now(),
  actor_id    uuid REFERENCES nucleo.personas(id),
  accion      text NOT NULL CHECK (accion IN
                ('sede_creada','modulo_encendido','modulo_apagado','permiso_otorgado',
                 'permiso_revocado','rol_asignado','rol_retirado')),
  sede_id     uuid REFERENCES org.sedes(id),
  detalle     jsonb NOT NULL
);
CREATE INDEX bitacora_aprov_sede_idx ON sistema.bitacora_aprovisionamiento (sede_id, ocurrido_en DESC);
CREATE RULE bit_aprov_no_update AS ON UPDATE TO sistema.bitacora_aprovisionamiento DO INSTEAD NOTHING;
CREATE RULE bit_aprov_no_delete AS ON DELETE TO sistema.bitacora_aprovisionamiento DO INSTEAD NOTHING;

-- ---------------------------------------------------------------------
-- 8 · CREAR UNA IGLESIA DESDE LA MAESTRA
--     Es la operación que da sentido a todo lo anterior.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sistema.crear_iglesia(
  p_codigo      text,
  p_nombre      text,
  p_tipo        org.tipo_sede,
  p_pais        char(2),
  p_ciudad      text,
  p_plantilla   text,
  p_pastor_id   uuid,
  p_ola         smallint DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_sede uuid; v_maestra uuid; v_actor uuid := plataforma.ctx_persona_id(); v_n int;
BEGIN
  -- (a) solo se crea desde la maestra, y solo con alcance de organización
  v_maestra := sistema.sede_maestra();
  IF v_maestra IS NULL THEN
    RAISE EXCEPTION 'No existe sede maestra: no hay desde dónde crear iglesias'
      USING ERRCODE = 'check_violation';
  END IF;
  IF p_tipo = 'sede_madre' THEN
    RAISE EXCEPTION 'Ya existe una sede maestra. Una iglesia nueva nace como filial o plantación'
      USING ERRCODE = 'check_violation';
  END IF;
  IF NOT plataforma.ctx_es_global() THEN
    RAISE EXCEPTION 'Crear una iglesia exige alcance de organización (Pastor Director General)'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- (b) la sede, colgada de la maestra
  INSERT INTO org.sedes (codigo, nombre, tipo, pais, ciudad, sede_padre_id, ola_migracion)
  VALUES (p_codigo, p_nombre, p_tipo, p_pais, p_ciudad, v_maestra, p_ola)
  RETURNING id INTO v_sede;

  -- (c) los módulos de la plantilla; los de compuerta legal quedan APAGADOS
  --     a propósito: se encienden cuando exista la evidencia jurídica.
  INSERT INTO sistema.modulos_sede (sede_id, modulo, activo, activado_por)
  SELECT v_sede, pm.modulo, NOT m.exige_compuerta_legal, v_actor
  FROM sistema.plantilla_modulos pm
  JOIN sistema.modulos m ON m.codigo = pm.modulo
  WHERE pm.plantilla = p_plantilla
  ORDER BY m.orden;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'La plantilla «%» no existe o no tiene módulos', p_plantilla USING ERRCODE = 'no_data_found';
  END IF;

  -- (d) el pastor congregacional. Una sede sin pastor no se opera sola.
  INSERT INTO identidad.asignaciones
    (persona_id, rol, alcance_tipo, alcance_id, nivel_max, otorgado_por, acta_referencia)
  VALUES (p_pastor_id, 'PASTOR_CONGREGACIONAL', 'sede', v_sede, 2, v_actor,
          'Aprovisionamiento de '||p_codigo);

  INSERT INTO sistema.bitacora_aprovisionamiento (actor_id, accion, sede_id, detalle)
  VALUES (v_actor, 'sede_creada', v_sede,
          jsonb_build_object('codigo',p_codigo,'nombre',p_nombre,'tipo',p_tipo,
                             'plantilla',p_plantilla,'modulos',v_n,'pastor',p_pastor_id));

  RETURN v_sede;
END
$$;

COMMENT ON FUNCTION sistema.crear_iglesia IS
  'Única vía para crear una iglesia. Nace colgada de la maestra, con sus módulos, su pastor y su registro en la bitácora. Los módulos de compuerta legal nacen apagados.';

-- ⛔ Una sede filial no puede quedarse sin pastor. Se evalúa al COMMIT,
--    para que crear la sede y asignar al pastor quepan en una transacción.
CREATE OR REPLACE FUNCTION sistema.tg_sede_exige_pastor() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tipo <> 'sede_madre' AND NEW.activa AND NOT EXISTS (
    SELECT 1 FROM identidad.asignaciones a
    WHERE a.alcance_tipo = 'sede' AND a.alcance_id = NEW.id
      AND a.rol = 'PASTOR_CONGREGACIONAL'
      AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)
  ) THEN
    RAISE EXCEPTION 'La sede «%» no tiene pastor congregacional vigente', NEW.nombre
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NULL;
END
$$;
CREATE CONSTRAINT TRIGGER trg_sede_exige_pastor
  AFTER INSERT OR UPDATE ON org.sedes
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION sistema.tg_sede_exige_pastor();

-- ---------------------------------------------------------------------
-- 9 · LO QUE LA CONSOLA MUESTRA
-- ---------------------------------------------------------------------

-- 9a · El permiso EFECTIVO: matriz × habilitación × nivel × vigencia.
CREATE OR REPLACE VIEW sistema.v_permiso_efectivo AS
SELECT a.persona_id,
       s.id   AS sede_id,
       s.codigo AS sede,
       mp.rol,
       mp.modulo,
       m.nombre AS modulo_nombre,
       mp.accion,
       m.nivel_dato,
       LEAST(a.nivel_max, r.nivel_maximo) AS nivel_efectivo,
       ms.activo AS modulo_habilitado,
       (a.vigente_desde <= CURRENT_DATE
        AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)) AS asignacion_vigente,
       -- El permiso solo existe si se cumplen las cuatro condiciones.
       (ms.activo
        AND LEAST(a.nivel_max, r.nivel_maximo) >= m.nivel_dato
        AND a.vigente_desde <= CURRENT_DATE
        AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)) AS permitido
FROM identidad.asignaciones a
JOIN identidad.roles r        ON r.codigo = a.rol
JOIN sistema.matriz_permisos mp ON mp.rol = a.rol
JOIN sistema.modulos m        ON m.codigo = mp.modulo
JOIN org.sedes s              ON (a.alcance_tipo = 'organizacion' OR s.id = a.alcance_id)
LEFT JOIN sistema.modulos_sede ms ON ms.sede_id = s.id AND ms.modulo = mp.modulo;

COMMENT ON VIEW sistema.v_permiso_efectivo IS
  'La respuesta a «¿por qué este usuario no ve este botón?». Cada fila dice cuál de las cuatro condiciones falló.';

-- 9b · Tablero de iglesias: qué tiene encendido cada una.
CREATE OR REPLACE VIEW sistema.v_iglesias AS
SELECT s.id, s.codigo, s.nombre, s.tipo, s.pais, s.ciudad, s.activa, s.ola_migracion,
       (s.tipo = 'sede_madre') AS es_maestra,
       count(*) FILTER (WHERE ms.activo)  AS modulos_activos,
       count(*) FILTER (WHERE NOT ms.activo) AS modulos_apagados,
       count(*) FILTER (WHERE NOT ms.activo AND m.exige_compuerta_legal) AS esperando_compuerta_legal,
       (SELECT count(*) FROM identidad.asignaciones a
         WHERE a.alcance_tipo = 'sede' AND a.alcance_id = s.id
           AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE)) AS personas_con_rol
FROM org.sedes s
LEFT JOIN sistema.modulos_sede ms ON ms.sede_id = s.id
LEFT JOIN sistema.modulos m ON m.codigo = ms.modulo
GROUP BY s.id;

-- 9c · La matriz tal como se presenta en el taller H-01.
CREATE OR REPLACE VIEW sistema.v_matriz AS
SELECT r.codigo AS rol, r.nombre AS rol_nombre, r.nivel_maximo, r.alcance_maximo,
       m.codigo AS modulo, m.nombre AS modulo_nombre, m.nivel_dato, m.orden,
       array_agg(mp.accion ORDER BY ac.orden) AS acciones,
       bool_or(ac.es_sensible) AS incluye_accion_sensible
FROM sistema.matriz_permisos mp
JOIN identidad.roles r ON r.codigo = mp.rol
JOIN sistema.modulos m ON m.codigo = mp.modulo
JOIN sistema.acciones ac ON ac.codigo = mp.accion
GROUP BY r.codigo, r.nombre, r.nivel_maximo, r.alcance_maximo, m.codigo, m.nombre, m.nivel_dato, m.orden;

-- 9d · Quién puede EXPORTAR qué. La pregunta que el taller H-01 debe
--      contestar por escrito, sacada del modelo en una consulta.
CREATE OR REPLACE VIEW sistema.v_quien_exporta AS
SELECT m.nombre AS modulo, m.nivel_dato,
       array_agg(r.nombre ORDER BY r.nivel_maximo DESC) AS roles_que_exportan
FROM sistema.matriz_permisos mp
JOIN sistema.modulos m ON m.codigo = mp.modulo
JOIN identidad.roles r ON r.codigo = mp.rol
WHERE mp.accion = 'exportar'
GROUP BY m.nombre, m.nivel_dato;

GRANT SELECT ON ALL TABLES IN SCHEMA sistema TO casaroca_app, casaroca_lectura;
GRANT INSERT, UPDATE ON sistema.modulos_sede, sistema.matriz_permisos TO casaroca_app;
GRANT INSERT ON sistema.bitacora_aprovisionamiento TO casaroca_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA sistema TO casaroca_app;
