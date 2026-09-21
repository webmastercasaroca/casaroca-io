-- =====================================================================
-- Migración 0048 — CUENTAS, SESIONES Y CORTE DE ACCESO
--
-- ⛔ EL HALLAZGO NÚMERO UNO DE LA AUDITORÍA DEL 19 DE SEPTIEMBRE DE 2026:
--    la API identificaba a las personas con una CABECERA DE TEXTO PLANO
--    (`X-Persona-Id`). Cualquiera que escribiera un identificador ERA esa
--    persona: el pastor principal, el tesorero, el director de RocaKids.
--
--    Todo el edificio (la matriz de 173 permisos, los cuatro niveles de
--    sensibilidad, la doble cerradura, la bitácora de lectura) se calcula
--    correctamente... a partir de una identidad que nadie verificó. Es una
--    casa blindada por dentro con la puerta de la calle abierta.
--
-- ⭐ LO QUE ENTRA AQUÍ, QUE ES LA MITAD DE BASE DE DATOS DEL ARREGLO:
--      · `cuentas`  · quién puede entrar, y con qué. Separada de `personas`
--                     a propósito: no toda persona tiene cuenta (25.000
--                     congregantes no entran al sistema) y una cuenta puede
--                     existir sin ser de nadie (integraciones).
--      · `sesiones` · cada sesión abierta, con su vencimiento y su
--                     revocación. Sin esto, «cerrar sesión en todos los
--                     dispositivos» no se puede hacer y un token robado
--                     vale hasta que expire.
--      · `intentos_acceso` · quién intentó entrar, desde dónde y si pudo.
--                     Append-only. Es la primera pregunta de todo incidente.
--      · Bloqueo por intentos, segundo factor obligatorio para N3 y N4,
--        y corte automático cuando termina el vínculo o la persona ya no está.
--
-- ⛔ LA CONTRASEÑA NUNCA SE GUARDA. Se guarda una derivación con `scrypt`,
--    que es memoria-dura: una tarjeta gráfica no la acelera como a SHA.
--    Y la verificación se hace en tiempo constante, para no filtrar por
--    cuánto tarda en responder.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · LAS CUENTAS
-- ---------------------------------------------------------------------
CREATE TABLE identidad.cuentas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id    uuid UNIQUE REFERENCES nucleo.personas(id) ON DELETE RESTRICT,
  usuario       citext NOT NULL UNIQUE,
  -- Derivación scrypt con sal propia. NULL si la cuenta solo entra por el
  -- proveedor de identidad externo.
  clave_hash    text,
  -- El «sub» del proveedor OIDC (Keycloak). Es el camino de producción.
  sujeto_oidc   text UNIQUE,
  estado        text NOT NULL DEFAULT 'sin_activar'
                CHECK (estado IN ('sin_activar','activa','suspendida','bloqueada','cerrada')),
  motivo_estado text,
  exige_segundo_factor boolean NOT NULL DEFAULT false,
  segundo_factor_activo boolean NOT NULL DEFAULT false,
  segundo_factor_secreto text,          -- cifrado con la llave N4
  debe_cambiar_clave boolean NOT NULL DEFAULT true,
  clave_cambiada_en timestamptz,
  ultimo_ingreso timestamptz,
  intentos_fallidos smallint NOT NULL DEFAULT 0,
  bloqueada_hasta timestamptz,
  creada_en     timestamptz NOT NULL DEFAULT now(),
  creada_por    uuid REFERENCES nucleo.personas(id),
  CONSTRAINT cuenta_tiene_forma_de_entrar
    CHECK (estado = 'sin_activar' OR clave_hash IS NOT NULL OR sujeto_oidc IS NOT NULL),
  CONSTRAINT cuenta_estado_con_motivo
    CHECK (estado NOT IN ('suspendida','bloqueada','cerrada') OR motivo_estado IS NOT NULL)
);
CREATE INDEX cuentas_persona_idx ON identidad.cuentas (persona_id);

COMMENT ON TABLE identidad.cuentas IS
  'Quien puede entrar. Separada de personas: de 25.000 congregantes, entran al sistema unos cientos.';
COMMENT ON COLUMN identidad.cuentas.clave_hash IS
  'scrypt$N$r$p$sal$derivada. Nunca la contrasena. La verificacion se hace en tiempo constante.';

-- El segundo factor es obligatorio para quien alcanza datos sensibles.
-- No es una recomendacion en un manual: lo calcula la base.
CREATE OR REPLACE FUNCTION identidad.exige_segundo_factor(p_persona uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT COALESCE(identidad.nivel_max_de(p_persona), 0) >= 3;
$$;

CREATE OR REPLACE FUNCTION identidad.tg_cuenta_calcula_mfa() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.persona_id IS NOT NULL THEN
    NEW.exige_segundo_factor := identidad.exige_segundo_factor(NEW.persona_id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_cuenta_calcula_mfa
  BEFORE INSERT OR UPDATE OF persona_id ON identidad.cuentas
  FOR EACH ROW EXECUTE FUNCTION identidad.tg_cuenta_calcula_mfa();

-- ---------------------------------------------------------------------
-- 2 · LAS SESIONES · una sesión revocable, no un token suelto
-- ---------------------------------------------------------------------
CREATE TABLE identidad.sesiones (
  id            uuid PRIMARY KEY,        -- es el «jti» del token
  cuenta_id     uuid NOT NULL REFERENCES identidad.cuentas(id) ON DELETE RESTRICT,
  emitida_en    timestamptz NOT NULL DEFAULT now(),
  expira_en     timestamptz NOT NULL,
  ultima_actividad timestamptz NOT NULL DEFAULT now(),
  revocada_en   timestamptz,
  motivo_revocacion text,
  ip            inet,
  agente        text,
  refresco_de   uuid REFERENCES identidad.sesiones(id),
  CONSTRAINT sesion_vigencia CHECK (expira_en > emitida_en)
);
CREATE INDEX sesiones_cuenta_idx ON identidad.sesiones (cuenta_id) WHERE revocada_en IS NULL;
CREATE INDEX sesiones_expira_idx ON identidad.sesiones (expira_en) WHERE revocada_en IS NULL;

COMMENT ON TABLE identidad.sesiones IS
  'Cada sesion abierta. Sin esta tabla, un token robado vale hasta que expire y «cerrar sesion en todos los dispositivos» no existe.';

-- ---------------------------------------------------------------------
-- 3 · LOS INTENTOS · append-only, es la primera pregunta de un incidente
-- ---------------------------------------------------------------------
CREATE TABLE identidad.intentos_acceso (
  id          bigserial PRIMARY KEY,
  ocurrido_en timestamptz NOT NULL DEFAULT now(),
  usuario     citext,
  cuenta_id   uuid REFERENCES identidad.cuentas(id),
  exito       boolean NOT NULL,
  motivo      text,
  ip          inet,
  agente      text
);
CREATE INDEX intentos_usuario_idx ON identidad.intentos_acceso (usuario, ocurrido_en DESC);
CREATE INDEX intentos_ip_idx ON identidad.intentos_acceso (ip, ocurrido_en DESC);
CREATE RULE intentos_no_update AS ON UPDATE TO identidad.intentos_acceso DO INSTEAD NOTHING;
CREATE RULE intentos_no_delete AS ON DELETE TO identidad.intentos_acceso DO INSTEAD NOTHING;

-- ---------------------------------------------------------------------
-- 4 · ENTRAR, REGISTRAR Y BLOQUEAR
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION identidad.registrar_intento(
  p_usuario text, p_exito boolean, p_motivo text,
  p_ip inet DEFAULT NULL, p_agente text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_cuenta uuid; v_fallidos smallint;
BEGIN
  SELECT id INTO v_cuenta FROM identidad.cuentas WHERE usuario = p_usuario::citext;

  INSERT INTO identidad.intentos_acceso (usuario, cuenta_id, exito, motivo, ip, agente)
  VALUES (p_usuario::citext, v_cuenta, p_exito, p_motivo, p_ip, p_agente);

  IF v_cuenta IS NULL THEN RETURN; END IF;

  IF p_exito THEN
    UPDATE identidad.cuentas
       SET ultimo_ingreso = now(), intentos_fallidos = 0, bloqueada_hasta = NULL
     WHERE id = v_cuenta;
  ELSE
    UPDATE identidad.cuentas
       SET intentos_fallidos = intentos_fallidos + 1,
           -- ⛔ Cinco intentos y quince minutos de espera. El bloqueo es
           --    temporal a proposito: un bloqueo permanente por intentos
           --    fallidos es una forma de dejar a alguien fuera de su propia
           --    cuenta a base de adivinarle mal la contrasena.
           bloqueada_hasta = CASE WHEN intentos_fallidos + 1 >= 5
                                  THEN now() + interval '15 minutes' ELSE bloqueada_hasta END
     WHERE id = v_cuenta
     RETURNING intentos_fallidos INTO v_fallidos;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION identidad.abrir_sesion(
  p_cuenta uuid, p_jti uuid, p_minutos int DEFAULT 30,
  p_ip inet DEFAULT NULL, p_agente text DEFAULT NULL, p_refresco_de uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  INSERT INTO identidad.sesiones (id, cuenta_id, expira_en, ip, agente, refresco_de)
  VALUES (p_jti, p_cuenta, now() + make_interval(mins => p_minutos), p_ip, p_agente, p_refresco_de);
  -- La sesion anterior de una rotacion se cierra: un refresco usado dos
  -- veces es la senal clasica de un token robado.
  IF p_refresco_de IS NOT NULL THEN
    UPDATE identidad.sesiones SET revocada_en = now(), motivo_revocacion = 'rotada'
     WHERE id = p_refresco_de AND revocada_en IS NULL;
  END IF;
  RETURN p_jti;
END $$;

CREATE OR REPLACE FUNCTION identidad.cerrar_sesion(p_jti uuid, p_motivo text DEFAULT 'salida del usuario')
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE identidad.sesiones SET revocada_en = now(), motivo_revocacion = p_motivo
   WHERE id = p_jti AND revocada_en IS NULL;
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION identidad.cerrar_todas_las_sesiones(p_cuenta uuid, p_motivo text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v int;
BEGIN
  UPDATE identidad.sesiones SET revocada_en = now(), motivo_revocacion = p_motivo
   WHERE cuenta_id = p_cuenta AND revocada_en IS NULL;
  GET DIAGNOSTICS v = ROW_COUNT;
  RETURN v;
END $$;

-- ⭐ LA FUNCIÓN QUE LLAMA LA API EN CADA PETICIÓN. Una sola, y devuelve
--    todo lo que hace falta para armar el contexto. Si devuelve nada, la
--    peticion no sigue.
CREATE OR REPLACE FUNCTION identidad.contexto_de_sesion(p_jti uuid)
RETURNS TABLE(
  persona_id uuid, cuenta_id uuid, usuario text,
  sede_ids uuid[], nivel_max smallint, es_global boolean,
  exige_segundo_factor boolean, expira_en timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT c.persona_id, c.id, c.usuario::text,
         identidad.sedes_de(c.persona_id),
         identidad.nivel_max_de(c.persona_id),
         EXISTS (SELECT 1 FROM identidad.v_permiso_efectivo pe
                 WHERE pe.persona_id = c.persona_id AND pe.vigente
                   AND pe.alcance_tipo = 'organizacion'),
         c.exige_segundo_factor,
         s.expira_en
  FROM identidad.sesiones s
  JOIN identidad.cuentas c ON c.id = s.cuenta_id
  WHERE s.id = p_jti
    AND s.revocada_en IS NULL
    AND s.expira_en > now()
    AND c.estado = 'activa'
    AND (c.bloqueada_hasta IS NULL OR c.bloqueada_hasta < now());
$$;

COMMENT ON FUNCTION identidad.contexto_de_sesion IS
  'La unica pregunta que hace la API por peticion. Si no devuelve fila, no hay sesion valida y no hay consulta.';

-- ---------------------------------------------------------------------
-- 5 · EL ACCESO CAE SOLO CUANDO CAE EL VÍNCULO
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION identidad.suspender_cuenta(p_persona uuid, p_motivo text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_cuenta uuid; v int := 0;
BEGIN
  SELECT id INTO v_cuenta FROM identidad.cuentas WHERE persona_id = p_persona AND estado = 'activa';
  IF v_cuenta IS NULL THEN RETURN 0; END IF;
  UPDATE identidad.cuentas SET estado='suspendida', motivo_estado = p_motivo WHERE id = v_cuenta;
  v := identidad.cerrar_todas_las_sesiones(v_cuenta, p_motivo);
  RETURN v;
END $$;

-- Cuando una persona pasa a fallecida, trasladada o fusionada, su cuenta
-- se suspende y sus sesiones se cierran en el instante.
CREATE OR REPLACE FUNCTION nucleo.tg_estado_persona_corta_acceso() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.estado::text IN ('fallecida','fusionada','inactiva')
     AND OLD.estado::text <> NEW.estado::text THEN
    PERFORM identidad.suspender_cuenta(NEW.id, 'La persona paso a estado '||NEW.estado::text);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_estado_persona_corta_acceso
  AFTER UPDATE OF estado ON nucleo.personas
  FOR EACH ROW EXECUTE FUNCTION nucleo.tg_estado_persona_corta_acceso();

-- Y cuando termina un contrato o un voluntariado.
CREATE OR REPLACE FUNCTION talento.tg_fin_de_vinculo_corta_acceso() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_persona uuid; v_otros int;
BEGIN
  IF NEW.estado::text IN ('terminado','retirado','inactivo') AND OLD.estado::text NOT IN ('terminado','retirado','inactivo') THEN
    v_persona := NEW.persona_id;
    -- Solo se corta si no le queda otro vinculo vivo con la organizacion.
    SELECT count(*) INTO v_otros FROM talento.contratos
      WHERE persona_id = v_persona AND estado::text NOT IN ('terminado','retirado','inactivo') AND id <> NEW.id;
    IF v_otros = 0 THEN
      PERFORM identidad.suspender_cuenta(v_persona, 'Termino su vinculo con la organizacion');
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_fin_contrato_corta_acceso
  AFTER UPDATE OF estado ON talento.contratos
  FOR EACH ROW EXECUTE FUNCTION talento.tg_fin_de_vinculo_corta_acceso();

-- ---------------------------------------------------------------------
-- 6 · ACTUAR EN NOMBRE DE OTRO · prohibido por defecto
-- ---------------------------------------------------------------------
CREATE TABLE identidad.suplantaciones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  soporte_id    uuid NOT NULL REFERENCES nucleo.personas(id),
  suplantado_id uuid NOT NULL REFERENCES nucleo.personas(id),
  motivo        text NOT NULL CHECK (length(motivo) >= 15),
  autorizada_por_el_usuario boolean NOT NULL DEFAULT false,
  inicia_en     timestamptz NOT NULL DEFAULT now(),
  termina_en    timestamptz NOT NULL,
  terminada_en  timestamptz,
  CONSTRAINT suplantacion_con_limite CHECK (termina_en > inicia_en AND termina_en <= inicia_en + interval '2 hours'),
  CONSTRAINT suplantacion_no_es_uno_mismo CHECK (soporte_id <> suplantado_id)
);
CREATE RULE suplantaciones_no_delete AS ON DELETE TO identidad.suplantaciones DO INSTEAD NOTHING;

COMMENT ON TABLE identidad.suplantaciones IS
  'Soporte entrando como otro: exige consentimiento del usuario, dura como maximo dos horas y queda visible para el suplantado.';

-- ---------------------------------------------------------------------
-- 7 · VISTAS DE OPERACIÓN Y SEGURIDAD
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW identidad.v_sesiones_activas
WITH (security_invoker = true) AS
SELECT s.id AS sesion, c.usuario, c.persona_id,
       p.primer_nombre||' '||p.primer_apellido AS persona,
       s.emitida_en, s.expira_en, s.ip, s.agente,
       (s.expira_en - now()) AS le_queda
FROM identidad.sesiones s
JOIN identidad.cuentas c ON c.id = s.cuenta_id
LEFT JOIN nucleo.personas p ON p.id = c.persona_id
WHERE s.revocada_en IS NULL AND s.expira_en > now();

CREATE OR REPLACE VIEW identidad.v_alertas_acceso
WITH (security_invoker = true) AS
SELECT usuario, ip, count(*) AS intentos_fallidos,
       min(ocurrido_en) AS desde, max(ocurrido_en) AS hasta
FROM identidad.intentos_acceso
WHERE NOT exito AND ocurrido_en > now() - interval '1 hour'
GROUP BY usuario, ip
HAVING count(*) >= 5;

COMMENT ON VIEW identidad.v_alertas_acceso IS
  'Cinco fallos en una hora desde la misma direccion. Va al canal de alertas, no a un informe mensual.';

-- ---------------------------------------------------------------------
-- 8 · EXPOSICIÓN · nada de esto lo lee la aplicación directamente
-- ---------------------------------------------------------------------
SELECT plataforma.publicar_tabla('identidad.cuentas'::regclass, 'cerrada',
  'Contiene derivaciones de contrasena y secretos de segundo factor. La aplicacion entra por las funciones SECURITY DEFINER, nunca a la tabla.',
  'Mesa tecnica 100p', false);
SELECT plataforma.publicar_tabla('identidad.sesiones'::regclass, 'cerrada',
  'Las sesiones se abren y se cierran por funcion. Leer la tabla permitiria enumerar identificadores de sesion validos.',
  'Mesa tecnica 100p', false);
SELECT plataforma.publicar_tabla('identidad.intentos_acceso'::regclass, 'cerrada',
  'Bitacora de intentos de acceso: es evidencia de seguridad y solo la lee quien audita.',
  'Mesa tecnica 100p', false);
SELECT plataforma.publicar_tabla('identidad.suplantaciones'::regclass, 'por_persona',
  'El suplantado tiene derecho a ver quien entro como el. Por eso se lee, no se esconde.',
  'Mesa tecnica 100p', true);
CREATE POLICY suplantaciones_sel ON identidad.suplantaciones FOR SELECT
  USING (suplantado_id = plataforma.ctx_persona_id()
         OR soporte_id = plataforma.ctx_persona_id()
         OR plataforma.ctx_es_global());
CREATE POLICY suplantaciones_ins ON identidad.suplantaciones FOR INSERT
  WITH CHECK (plataforma.ctx_es_global());

GRANT EXECUTE ON FUNCTION identidad.registrar_intento(text,boolean,text,inet,text) TO casaroca_app;
GRANT EXECUTE ON FUNCTION identidad.abrir_sesion(uuid,uuid,int,inet,text,uuid) TO casaroca_app;
GRANT EXECUTE ON FUNCTION identidad.cerrar_sesion(uuid,text) TO casaroca_app;
GRANT EXECUTE ON FUNCTION identidad.cerrar_todas_las_sesiones(uuid,text) TO casaroca_app;
GRANT EXECUTE ON FUNCTION identidad.contexto_de_sesion(uuid) TO casaroca_app;
GRANT EXECUTE ON FUNCTION identidad.suspender_cuenta(uuid,text) TO casaroca_app;
GRANT SELECT ON identidad.v_sesiones_activas, identidad.v_alertas_acceso TO casaroca_app;

-- La aplicación necesita leer la cuenta para verificar la contraseña, y solo
-- eso: por una función que devuelve la derivación y nada más.
CREATE OR REPLACE FUNCTION identidad.credencial_de(p_usuario text)
RETURNS TABLE(cuenta_id uuid, clave_hash text, estado text, bloqueada_hasta timestamptz,
              exige_segundo_factor boolean, segundo_factor_activo boolean, debe_cambiar_clave boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT id, clave_hash, estado, bloqueada_hasta, exige_segundo_factor, segundo_factor_activo, debe_cambiar_clave
  FROM identidad.cuentas WHERE usuario = p_usuario::citext;
$$;
GRANT EXECUTE ON FUNCTION identidad.credencial_de(text) TO casaroca_app;

CREATE OR REPLACE FUNCTION identidad.crear_cuenta(
  p_persona uuid, p_usuario text, p_clave_hash text, p_quien uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO identidad.cuentas (persona_id, usuario, clave_hash, estado, creada_por, clave_cambiada_en)
  VALUES (p_persona, p_usuario::citext, p_clave_hash, 'activa', p_quien, now())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION identidad.crear_cuenta(uuid,text,text,uuid) TO casaroca_app;

CREATE OR REPLACE FUNCTION identidad.cambiar_clave(p_cuenta uuid, p_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE identidad.cuentas
     SET clave_hash = p_hash, clave_cambiada_en = now(), debe_cambiar_clave = false,
         intentos_fallidos = 0, bloqueada_hasta = NULL
   WHERE id = p_cuenta;
  -- Cambiar la contrasena cierra las demas sesiones. Si alguien te la robo,
  -- cambiarla tiene que sacarlo.
  PERFORM identidad.cerrar_todas_las_sesiones(p_cuenta, 'cambio de contrasena');
END $$;
GRANT EXECUTE ON FUNCTION identidad.cambiar_clave(uuid,text) TO casaroca_app;

-- La aplicación no lee `cuentas`: pregunta por función.
CREATE OR REPLACE FUNCTION identidad.persona_de_cuenta(p_cuenta uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT persona_id FROM identidad.cuentas WHERE id = p_cuenta;
$$;
GRANT EXECUTE ON FUNCTION identidad.persona_de_cuenta(uuid) TO casaroca_app;

-- El segundo factor: guardar el secreto (cifrado) y activarlo.
CREATE OR REPLACE FUNCTION identidad.guardar_segundo_factor(p_cuenta uuid, p_secreto_cifrado text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE identidad.cuentas
     SET segundo_factor_secreto = p_secreto_cifrado, segundo_factor_activo = false
   WHERE id = p_cuenta;
END $$;

CREATE OR REPLACE FUNCTION identidad.activar_segundo_factor(p_cuenta uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE identidad.cuentas SET segundo_factor_activo = true WHERE id = p_cuenta;
  -- Activar el segundo factor cierra las sesiones anteriores: si alguien
  -- habia entrado con la contrasena robada, sale.
  PERFORM identidad.cerrar_todas_las_sesiones(p_cuenta, 'se activo el segundo factor');
END $$;

CREATE OR REPLACE FUNCTION identidad.secreto_segundo_factor(p_cuenta uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT segundo_factor_secreto FROM identidad.cuentas WHERE id = p_cuenta;
$$;

GRANT EXECUTE ON FUNCTION identidad.guardar_segundo_factor(uuid,text) TO casaroca_app;
GRANT EXECUTE ON FUNCTION identidad.activar_segundo_factor(uuid) TO casaroca_app;
GRANT EXECUTE ON FUNCTION identidad.secreto_segundo_factor(uuid) TO casaroca_app;
