-- =====================================================================
-- Migración 0007 — AUDITORÍA DE ESCRITURA Y BITÁCORA DE LECTURA
--
-- La auditoría de escritura (valor anterior / nuevo / IP) coincide con lo
-- que el equipo 100p ya definió, y está bien.
--
-- Lo que NO existe en ningún diseño previo es la BITÁCORA DE LECTURA
-- sobre datos N3. Responde la pregunta que hoy es imposible de contestar:
--        «¿quién vio el aporte de esta familia en marzo?»
-- =====================================================================

CREATE TABLE plataforma.auditoria (
  id            bigserial,
  ocurrido_en   timestamptz NOT NULL DEFAULT now(),
  esquema       text NOT NULL,
  tabla         text NOT NULL,
  fila_id       text NOT NULL,
  operacion     char(1) NOT NULL CHECK (operacion IN ('I','U','D')),
  actor_id      uuid,
  actor_ip      inet,
  valor_anterior jsonb,
  valor_nuevo    jsonb,
  -- En una tabla particionada la clave primaria debe incluir la columna de
  -- partición. No es un capricho de Postgres: es lo que permite que el índice
  -- viva por partición y que borrar un año sea soltar una tabla, no un DELETE
  -- de millones de filas.
  PRIMARY KEY (id, ocurrido_en)
) PARTITION BY RANGE (ocurrido_en);

-- ~50.000 filas/mes según el dimensionamiento. Particionada desde el día 1:
-- añadir particiones después obliga a reescribir la tabla en producción.
CREATE TABLE plataforma.auditoria_2026 PARTITION OF plataforma.auditoria
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
CREATE TABLE plataforma.auditoria_2027 PARTITION OF plataforma.auditoria
  FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');

CREATE INDEX auditoria_fila_idx  ON plataforma.auditoria (esquema, tabla, fila_id, ocurrido_en DESC);
CREATE INDEX auditoria_actor_idx ON plataforma.auditoria (actor_id, ocurrido_en DESC);

CREATE RULE auditoria_no_update AS ON UPDATE TO plataforma.auditoria DO INSTEAD NOTHING;
CREATE RULE auditoria_no_delete AS ON DELETE TO plataforma.auditoria DO INSTEAD NOTHING;

COMMENT ON TABLE plataforma.auditoria IS
  'Append-only y particionada por año. Ni la aplicación ni el administrador pueden alterarla.';

-- Trigger genérico: se engancha a cualquier tabla sin escribir código nuevo.
CREATE OR REPLACE FUNCTION plataforma.tg_auditar() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id  text;
  v_ant jsonb;
  v_nue jsonb;
  v_op  char(1);
BEGIN
  IF    TG_OP = 'INSERT' THEN v_op:='I'; v_nue:=to_jsonb(NEW); v_id:=(to_jsonb(NEW)->>'id');
  ELSIF TG_OP = 'UPDATE' THEN v_op:='U'; v_ant:=to_jsonb(OLD); v_nue:=to_jsonb(NEW); v_id:=(to_jsonb(NEW)->>'id');
  ELSE                        v_op:='D'; v_ant:=to_jsonb(OLD); v_id:=(to_jsonb(OLD)->>'id');
  END IF;

  INSERT INTO plataforma.auditoria (esquema,tabla,fila_id,operacion,actor_id,actor_ip,valor_anterior,valor_nuevo)
  VALUES (TG_TABLE_SCHEMA, TG_TABLE_NAME, v_id, v_op,
          plataforma.ctx_persona_id(),
          NULLIF(current_setting('app.ip', true),'')::inet,
          v_ant, v_nue);
  RETURN NULL;
END
$$;

CREATE TRIGGER trg_auditar_personas   AFTER INSERT OR UPDATE OR DELETE ON nucleo.personas
  FOR EACH ROW EXECUTE FUNCTION plataforma.tg_auditar();
CREATE TRIGGER trg_auditar_acudientes AFTER INSERT OR UPDATE OR DELETE ON nucleo.acudientes
  FOR EACH ROW EXECUTE FUNCTION plataforma.tg_auditar();
CREATE TRIGGER trg_auditar_asignaciones AFTER INSERT OR UPDATE OR DELETE ON identidad.asignaciones
  FOR EACH ROW EXECUTE FUNCTION plataforma.tg_auditar();

-- ---------------------------------------------------------------------
-- BITÁCORA DE LECTURA — el concepto que ganó la discusión en la mesa.
-- Se invoca desde la capa de acceso a datos al leer cualquier N3/N4.
-- ---------------------------------------------------------------------
CREATE TABLE plataforma.bitacora_lectura (
  id           bigserial PRIMARY KEY,
  ocurrido_en  timestamptz NOT NULL DEFAULT now(),
  actor_id     uuid,
  actor_ip     inet,
  esquema      text NOT NULL,
  tabla        text NOT NULL,
  fila_id      text,
  nivel        smallint NOT NULL REFERENCES plataforma.niveles_sensibilidad(nivel),
  motivo       text NOT NULL,
  filas_leidas integer NOT NULL DEFAULT 1
);
CREATE INDEX bitacora_lectura_fila_idx  ON plataforma.bitacora_lectura (esquema, tabla, fila_id, ocurrido_en DESC);
CREATE INDEX bitacora_lectura_actor_idx ON plataforma.bitacora_lectura (actor_id, ocurrido_en DESC);
CREATE RULE bitacora_lectura_no_update AS ON UPDATE TO plataforma.bitacora_lectura DO INSTEAD NOTHING;
CREATE RULE bitacora_lectura_no_delete AS ON DELETE TO plataforma.bitacora_lectura DO INSTEAD NOTHING;

CREATE OR REPLACE FUNCTION plataforma.registrar_lectura(
  p_esquema text, p_tabla text, p_fila_id text, p_nivel smallint, p_motivo text, p_filas integer DEFAULT 1
) RETURNS void
LANGUAGE sql SECURITY DEFINER AS $$
  INSERT INTO plataforma.bitacora_lectura (actor_id,actor_ip,esquema,tabla,fila_id,nivel,motivo,filas_leidas)
  VALUES (plataforma.ctx_persona_id(), NULLIF(current_setting('app.ip', true),'')::inet,
          p_esquema,p_tabla,p_fila_id,p_nivel,p_motivo,p_filas);
$$;

COMMENT ON FUNCTION plataforma.registrar_lectura IS
  'Obligatoria antes de devolver cualquier dato N3 o N4. Sin motivo declarado no hay lectura.';

-- La respuesta a «¿quién vio el aporte de esta familia en marzo?»
CREATE OR REPLACE VIEW plataforma.v_quien_vio AS
SELECT b.ocurrido_en, b.actor_id, b.esquema, b.tabla, b.fila_id, b.nivel, b.motivo, b.actor_ip
FROM plataforma.bitacora_lectura b
WHERE b.nivel >= 3
ORDER BY b.ocurrido_en DESC;
