-- =====================================================================
-- CasaRoca System · Fase 1 · Migración 0000 — FUNDACIÓN
-- Esquemas, extensiones, roles de base y el contexto de sesión (GUC)
-- sobre el que se apoya la segunda cerradura (RLS).
--
-- Referencia: Documento 1 «Arquitectura Backend», pilares 01 y 02.
-- SQL plano y revisable línea a línea (criterio del Comité de Tecnología).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid + cifrado por columna
CREATE EXTENSION IF NOT EXISTS citext;     -- correo insensible a mayúsculas
CREATE EXTENSION IF NOT EXISTS unaccent;   -- deduplicación por nombre

-- ---------------------------------------------------------------------
-- Esquemas. Un módulo dueño por esquema; nadie más escribe en él.
-- ---------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS plataforma;  -- transversal: clasificación, consentimiento, auditoría
CREATE SCHEMA IF NOT EXISTS org;         -- 01 Organización: sedes, ministerios, organigrama
CREATE SCHEMA IF NOT EXISTS nucleo;      -- Núcleo: registro maestro de persona
CREATE SCHEMA IF NOT EXISTS identidad;   -- 02 Identidad y acceso: roles, alcances, vigencias
CREATE SCHEMA IF NOT EXISTS crm;         -- 04 CRM Pastoral + 11 Línea de tiempo

COMMENT ON SCHEMA plataforma IS 'Servicios transversales: clasificación del dato N0-N4, Habeas Data, auditoría, bitácora de lectura.';
COMMENT ON SCHEMA org        IS 'Esquema 01. Sedes, ministerios activos por sede y organigrama. Etapa 1: ninguna fila del sistema existe sin su sede.';
COMMENT ON SCHEMA nucleo     IS 'Registro maestro de persona. Es la raíz: todos los demás esquemas la referencian.';
COMMENT ON SCHEMA identidad  IS 'Esquema 02. No se migra: se declara en el taller H-01. Permiso efectivo = rol x alcance x sensibilidad x vigencia.';
COMMENT ON SCHEMA crm        IS 'Esquema 04 y 11. Seguimiento de nuevos (recorrido 4C) y línea de tiempo polimórfica.';

-- ---------------------------------------------------------------------
-- Roles de base de datos.
-- ⛔ La aplicación NUNCA se conecta como propietario ni como superusuario:
--    RLS no se aplica al dueño de la tabla (BYPASSRLS implícito), así que
--    conectarse como propietario anularía la segunda cerradura sin avisar.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'casaroca_owner') THEN
    CREATE ROLE casaroca_owner NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'casaroca_app') THEN
    CREATE ROLE casaroca_app NOLOGIN;   -- la API. Sujeta a RLS, sin excepción.
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'casaroca_migrador') THEN
    CREATE ROLE casaroca_migrador NOLOGIN; -- carga inicial; puede saltar RLS de forma explícita
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'casaroca_lectura') THEN
    CREATE ROLE casaroca_lectura NOLOGIN;  -- analítica. Jamás ve N3/N4 en claro.
  END IF;
END
$$;

GRANT USAGE ON SCHEMA plataforma, org, nucleo, identidad, crm TO casaroca_app, casaroca_lectura, casaroca_migrador;

-- ---------------------------------------------------------------------
-- Contexto de sesión. La API abre transacción y hace:
--     SET LOCAL app.persona_id = '...';
--     SET LOCAL app.sede_ids   = '{uuid,uuid}';
--     SET LOCAL app.nivel_max  = 2;
-- Las políticas RLS leen ESTO. Si el programador olvida el WHERE de sede,
-- la base sigue sin devolver filas ajenas.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION plataforma.ctx_persona_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.persona_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION plataforma.ctx_sede_ids() RETURNS uuid[]
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('app.sede_ids', true), '')::uuid[], '{}'::uuid[])
$$;

-- Nivel máximo de sensibilidad que la sesión puede leer (0..4).
-- Ausente = 0. Nunca se asume permiso por omisión.
CREATE OR REPLACE FUNCTION plataforma.ctx_nivel_max() RETURNS smallint
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('app.nivel_max', true), '')::smallint, 0::smallint)
$$;

-- Alcance de organización completa (Pastor Director General).
CREATE OR REPLACE FUNCTION plataforma.ctx_es_global() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('app.alcance_global', true), '')::boolean, false)
$$;

COMMENT ON FUNCTION plataforma.ctx_sede_ids() IS
  'Sedes que la sesión puede tocar. Vacío = ninguna. La ausencia de contexto NO abre la base: la cierra.';

-- ---------------------------------------------------------------------
-- Marca de tiempo estándar y trigger de actualización.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION plataforma.tg_set_actualizado_en() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END
$$;
