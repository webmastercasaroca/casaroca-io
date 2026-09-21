-- =====================================================================
-- Migración 0046 — LOS CATÁLOGOS DE NEGOCIO DEJAN DE SER ENUMERADOS
--
-- ⛔ EL PROBLEMA, EN PALABRAS DE UNA SEDE: «queremos registrar el culto de
--    jóvenes del viernes». Hoy eso es una migración, una revisión, un
--    despliegue y una ventana de mantenimiento, porque `tipo_servicio` es
--    un tipo enumerado del motor. Y un valor de un enumerado no se puede
--    borrar NUNCA ni renombrar sin reescribir la columna.
--
--    Con 36 sedes pidiendo variantes, eso genera una cola de cambios que
--    termina, como siempre, en un Excel aparte. Un dato que vive fuera del
--    sistema no tiene permisos, ni bitácora, ni Habeas Data.
--
-- ⭐ LA DISTINCIÓN QUE HAY QUE HACER, Y QUE CASI NADIE HACE:
--
--    · Un CATÁLOGO DE NEGOCIO (tipo de servicio, tipo de grupo, medio de
--      pago, estado civil) es una lista abierta. Que crezca es lo normal.
--      Estos pasan a ser DATOS y se editan desde la consola.
--
--    · Una MÁQUINA DE ESTADOS (estado de un aporte, de un caso, de una
--      inscripción) es una lista CERRADA a propósito: cada estado tiene
--      código que lo produce y transiciones que lo gobiernan. Agregar un
--      estado SIN escribir código sería un error, no una facilidad.
--      Estos se quedan como enumerados, y aquí queda escrito POR QUÉ.
--
--    Convertirlo todo habría sido tan malo como no convertir nada.
--
-- ⭐ Y se deja el CONVERTIDOR, no solo la conversión: `convertir_a_catalogo()`
--    se encarga de las vistas que dependen de la columna, que es la parte
--    que hace que este trabajo se posponga para siempre.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · EL REGISTRO DE CATÁLOGOS
-- ---------------------------------------------------------------------
CREATE TABLE sistema.catalogos (
  codigo            text PRIMARY KEY,
  nombre            text NOT NULL,
  descripcion       text NOT NULL,
  editable_por_sede boolean NOT NULL DEFAULT false,
  cerrado           boolean NOT NULL DEFAULT false,
  motivo_cerrado    text,
  CONSTRAINT catalogo_cerrado_con_motivo CHECK (NOT cerrado OR motivo_cerrado IS NOT NULL)
);
COMMENT ON COLUMN sistema.catalogos.cerrado IS
  'Una maquina de estados esta cerrada a proposito y el motivo queda escrito. No es una limitacion: es una decision.';

CREATE TABLE sistema.catalogo_valores (
  catalogo    text NOT NULL REFERENCES sistema.catalogos(codigo) ON DELETE RESTRICT,
  codigo      text NOT NULL,
  etiqueta    text NOT NULL,
  descripcion text,
  orden       smallint NOT NULL DEFAULT 100,
  vigente     boolean NOT NULL DEFAULT true,
  -- Un valor puede ser de la red o de UNA sede: «culto de jovenes» puede
  -- existir solo en Chia sin ensuciar el catalogo de las otras 35.
  sede_id     uuid REFERENCES org.sedes(id),
  retirado_en timestamptz,
  motivo_retiro text,
  creado_en   timestamptz NOT NULL DEFAULT now(),
  creado_por  uuid REFERENCES nucleo.personas(id),
  PRIMARY KEY (catalogo, codigo),
  CONSTRAINT valor_retiro_coherente CHECK (vigente OR retirado_en IS NOT NULL)
);
CREATE INDEX catalogo_valores_vigentes ON sistema.catalogo_valores (catalogo, orden) WHERE vigente;

COMMENT ON TABLE sistema.catalogo_valores IS
  'Los valores de cada catalogo. Un valor NO se borra nunca: se retira. Borrarlo dejaria filas historicas apuntando al vacio.';

-- ---------------------------------------------------------------------
-- 2 · AGREGAR Y RETIRAR · sin migración, sin despliegue
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sistema.agregar_valor(
  p_catalogo text, p_codigo text, p_etiqueta text,
  p_descripcion text DEFAULT NULL, p_orden smallint DEFAULT 100,
  p_sede uuid DEFAULT NULL, p_quien uuid DEFAULT NULL
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_cerrado boolean; v_motivo text; v_por_sede boolean;
BEGIN
  SELECT cerrado, motivo_cerrado, editable_por_sede
    INTO v_cerrado, v_motivo, v_por_sede
  FROM sistema.catalogos WHERE codigo = p_catalogo;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe el catalogo «%»', p_catalogo USING ERRCODE='no_data_found';
  END IF;
  IF v_cerrado THEN
    RAISE EXCEPTION 'El catalogo «%» esta cerrado a proposito: %', p_catalogo, v_motivo
      USING ERRCODE='check_violation';
  END IF;
  IF p_sede IS NOT NULL AND NOT v_por_sede THEN
    RAISE EXCEPTION 'El catalogo «%» es de la red: sus valores no son de una sola sede', p_catalogo
      USING ERRCODE='check_violation';
  END IF;
  IF p_codigo !~ '^[A-Za-z0-9_]{2,40}$' THEN
    RAISE EXCEPTION 'El codigo «%» debe ser corto y sin espacios ni acentos: es una llave, no una etiqueta', p_codigo
      USING ERRCODE='check_violation';
  END IF;

  INSERT INTO sistema.catalogo_valores (catalogo, codigo, etiqueta, descripcion, orden, sede_id, creado_por)
  VALUES (p_catalogo, p_codigo, p_etiqueta, p_descripcion, p_orden, p_sede, p_quien);
END $$;

CREATE OR REPLACE FUNCTION sistema.retirar_valor(
  p_catalogo text, p_codigo text, p_motivo text
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_motivo IS NULL OR length(trim(p_motivo)) < 5 THEN
    RAISE EXCEPTION 'Retirar un valor de catalogo exige un motivo escrito' USING ERRCODE='check_violation';
  END IF;
  UPDATE sistema.catalogo_valores
     SET vigente = false, retirado_en = now(), motivo_retiro = p_motivo
   WHERE catalogo = p_catalogo AND codigo = p_codigo AND vigente;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El valor %.% no existe o ya estaba retirado', p_catalogo, p_codigo USING ERRCODE='no_data_found';
  END IF;
END $$;

COMMENT ON FUNCTION sistema.retirar_valor IS
  'Retira, no borra. Las filas historicas que ya usaban ese valor siguen siendo legibles; lo que se impide es usarlo en filas nuevas.';

-- Un valor retirado no se puede usar en filas nuevas. El disparador lo
-- aplica igual para todas las columnas convertidas.
CREATE OR REPLACE FUNCTION sistema.tg_valor_de_catalogo_vigente() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE v_cat text; v_col text; v_val text; v_vig boolean;
BEGIN
  v_cat := TG_ARGV[0]; v_col := TG_ARGV[1];
  EXECUTE format('SELECT ($1).%I::text', v_col) INTO v_val USING NEW;
  IF v_val IS NULL THEN RETURN NEW; END IF;
  SELECT vigente INTO v_vig FROM sistema.catalogo_valores
   WHERE catalogo = v_cat AND codigo = v_val;
  IF v_vig IS NULL THEN
    RAISE EXCEPTION 'El valor «%» no existe en el catalogo «%»', v_val, v_cat USING ERRCODE='foreign_key_violation';
  END IF;
  IF NOT v_vig THEN
    RAISE EXCEPTION 'El valor «%» del catalogo «%» fue retirado: no se puede usar en filas nuevas', v_val, v_cat
      USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END $$;

-- ---------------------------------------------------------------------
-- 3 · EL CONVERTIDOR · se hace cargo de las vistas que dependen
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sistema.convertir_a_catalogo(
  p_esquema text, p_tabla text, p_columna text,
  p_catalogo text, p_nombre text, p_descripcion text,
  p_editable_por_sede boolean DEFAULT false
) RETURNS int LANGUAGE plpgsql AS $$
DECLARE
  v_tipo text; v_vistas jsonb := '[]'::jsonb; r record; v_n int := 0; v_col_cat text;
  v_vistas_antes text[]; v_vistas_despues text[]; v_perdidas text[]; v_usos int;
  v_checks jsonb := '[]'::jsonb; v_def text; v_tipo_completo text; v_default text;
BEGIN
  SELECT quote_ident(nt.nspname)||'.'||quote_ident(t.typname), t.typname
    INTO v_tipo_completo, v_tipo
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_type t ON t.oid = a.atttypid
  JOIN pg_namespace nt ON nt.oid = t.typnamespace
  WHERE n.nspname = p_esquema AND c.relname = p_tabla AND a.attname = p_columna;

  IF v_tipo IS NULL THEN
    RAISE EXCEPTION 'No existe %.%.%', p_esquema, p_tabla, p_columna;
  END IF;

  -- 3.a · el catálogo y sus valores actuales, tomados del enumerado
  INSERT INTO sistema.catalogos (codigo, nombre, descripcion, editable_por_sede)
  VALUES (p_catalogo, p_nombre, p_descripcion, p_editable_por_sede)
  ON CONFLICT (codigo) DO NOTHING;

  INSERT INTO sistema.catalogo_valores (catalogo, codigo, etiqueta, orden)
  SELECT p_catalogo, e.enumlabel,
         initcap(replace(e.enumlabel, '_', ' ')),
         (e.enumsortorder * 10)::smallint
  FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
  WHERE t.typname = v_tipo
  ON CONFLICT (catalogo, codigo) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  -- ⛔ Red de seguridad: se guarda la lista de TODAS las vistas de la base
  --    antes de tocar nada. Si al final falta alguna, se aborta. Un DROP
  --    CASCADE puede llevarse por delante una vista que dependia de otra,
  --    y eso no se nota hasta que alguien abre la pantalla que la usaba.
  SELECT array_agg(n.nspname||'.'||c.relname ORDER BY 1) INTO v_vistas_antes
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE c.relkind='v' AND n.nspname NOT IN ('pg_catalog','information_schema');

  -- 3.b · ⛔ las vistas que dependen de la columna. Esta es la parte que
  --       hace que una conversión así se posponga para siempre: se guardan
  --       sus definiciones, se sueltan, y se vuelven a crear igual.
  FOR r IN
    SELECT DISTINCT dv.oid, nv.nspname AS esq, dv.relname AS vista,
           pg_get_viewdef(dv.oid, true) AS definicion
    FROM pg_depend d
    JOIN pg_rewrite rw ON rw.oid = d.objid
    JOIN pg_class dv ON dv.oid = rw.ev_class AND dv.relkind = 'v'
    JOIN pg_namespace nv ON nv.oid = dv.relnamespace
    JOIN pg_class ct ON ct.oid = d.refobjid
    JOIN pg_namespace nt ON nt.oid = ct.relnamespace
    JOIN pg_attribute at ON at.attrelid = ct.oid AND at.attnum = d.refobjsubid
    WHERE nt.nspname = p_esquema AND ct.relname = p_tabla AND at.attname = p_columna
  LOOP
    v_vistas := v_vistas || jsonb_build_object('esq', r.esq, 'vista', r.vista, 'def', r.definicion);
    EXECUTE format('DROP VIEW %I.%I CASCADE', r.esq, r.vista);
  END LOOP;

  -- ⛔ Y las restricciones CHECK que comparan contra el enumerado. Si se
  --    dejan puestas, el ALTER falla con «operator does not exist: text <>
  --    talento.tipo_contrato», que no dice nada de lo que pasa. Se guardan,
  --    se sueltan, y vuelven con el casteo al enumerado quitado.
  FOR r IN
    SELECT conname, pg_get_constraintdef(oid) AS definicion
    FROM pg_constraint
    WHERE conrelid = format('%I.%I', p_esquema, p_tabla)::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ~ ('\m'||p_columna||'\M')
  LOOP
    v_checks := v_checks || jsonb_build_object('nombre', r.conname, 'def', r.definicion);
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', p_esquema, p_tabla, r.conname);
  END LOOP;

  -- ⛔ Y el valor por defecto de la columna, que lleva el casteo al
  --    enumerado pegado («DEFAULT 'integrante'::grupos.rol_membresia»).
  --    Si se deja, el tipo no se puede soltar y el error que sale
  --    («cannot drop type because other objects depend on it») no dice
  --    cual es el objeto.
  SELECT pg_get_expr(ad.adbin, ad.adrelid) INTO v_default
  FROM pg_attrdef ad
  JOIN pg_attribute a ON a.attrelid = ad.adrelid AND a.attnum = ad.adnum
  JOIN pg_class c ON c.oid = ad.adrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = p_esquema AND c.relname = p_tabla AND a.attname = p_columna;

  IF v_default IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I DROP DEFAULT', p_esquema, p_tabla, p_columna);
  END IF;

  -- 3.c · la columna pasa a texto y se ata al catálogo con clave foránea
  EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I TYPE text USING %I::text',
                 p_esquema, p_tabla, p_columna, p_columna);

  IF v_default IS NOT NULL THEN
    v_default := regexp_replace(v_default, '::[a-z_]+\.'||v_tipo, '', 'g');
    v_default := regexp_replace(v_default, '::'||v_tipo, '', 'g');
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT %s',
                   p_esquema, p_tabla, p_columna, v_default);
  END IF;

  v_col_cat := 'cat_' || p_columna;
  EXECUTE format(
    'ALTER TABLE %I.%I ADD COLUMN %I text GENERATED ALWAYS AS (%L) STORED',
    p_esquema, p_tabla, v_col_cat, p_catalogo);
  EXECUTE format(
    'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I, %I) REFERENCES sistema.catalogo_valores(catalogo, codigo)',
    p_esquema, p_tabla, p_tabla||'_'||p_columna||'_cat_fk', v_col_cat, p_columna);

  EXECUTE format(
    'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF %I ON %I.%I FOR EACH ROW EXECUTE FUNCTION sistema.tg_valor_de_catalogo_vigente(%L, %L)',
    'trg_'||p_tabla||'_'||p_columna||'_vigente', p_columna, p_esquema, p_tabla, p_catalogo, p_columna);

  -- las restricciones vuelven, ya sin el casteo al tipo que dejo de existir
  FOR r IN SELECT * FROM jsonb_array_elements(v_checks) AS x(v) LOOP
    v_def := regexp_replace(r.v->>'def', '::[a-z_]+\.'||v_tipo, '', 'g');
    v_def := regexp_replace(v_def, '::'||v_tipo, '', 'g');
    EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I %s',
                   p_esquema, p_tabla, r.v->>'nombre', v_def);
  END LOOP;

  -- 3.d · las vistas vuelven, con seguridad de invocador como manda 0025
  FOR r IN SELECT * FROM jsonb_array_elements(v_vistas) AS x(v) LOOP
    EXECUTE format('CREATE VIEW %I.%I WITH (security_invoker = true) AS %s',
                   r.v->>'esq', r.v->>'vista', r.v->>'def');
    EXECUTE format('GRANT SELECT ON %I.%I TO casaroca_app', r.v->>'esq', r.v->>'vista');
  END LOOP;

  -- 3.e · el enumerado se suelta SOLO si ya no lo usa ninguna columna.
  --       Varias tablas comparten el mismo tipo (medio_pago lo usan
  --       `aportes` y `pasarela_transacciones`): soltarlo al convertir la
  --       primera dejaria la segunda rota.
  SELECT count(*) INTO v_usos
  FROM pg_attribute a JOIN pg_type t ON t.oid = a.atttypid
  JOIN pg_class c ON c.oid = a.attrelid
  WHERE t.typname = v_tipo AND a.attnum > 0 AND NOT a.attisdropped AND c.relkind IN ('r','v');
  IF v_usos = 0 THEN
    -- ⛔ Con el nombre SIN esquema, «DROP TYPE IF EXISTS» no encuentra el
    --    tipo y no hace nada, sin avisar. El banco lo cazo: los once tipos
    --    convertidos seguian vivos despues de la conversion.
    EXECUTE format('DROP TYPE IF EXISTS %s', v_tipo_completo);
  END IF;

  -- 3.f · ninguna vista se quedo por el camino
  SELECT array_agg(n.nspname||'.'||c.relname ORDER BY 1) INTO v_vistas_despues
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE c.relkind='v' AND n.nspname NOT IN ('pg_catalog','information_schema');
  SELECT array_agg(x) INTO v_perdidas
  FROM (SELECT unnest(v_vistas_antes) EXCEPT SELECT unnest(v_vistas_despues)) q(x);
  IF v_perdidas IS NOT NULL THEN
    RAISE EXCEPTION 'La conversion de %.%.% se llevo por delante estas vistas: %',
      p_esquema, p_tabla, p_columna, array_to_string(v_perdidas, ', ');
  END IF;

  INSERT INTO plataforma.bitacora_mantenimiento (tarea, objeto, detalle)
  VALUES ('enum_a_catalogo', p_esquema||'.'||p_tabla||'.'||p_columna,
          jsonb_build_object('catalogo', p_catalogo, 'valores', v_n,
                             'vistas_rehechas', jsonb_array_length(v_vistas)));
  RETURN v_n;
END $$;

COMMENT ON FUNCTION sistema.convertir_a_catalogo IS
  'Convierte un enumerado del motor en un catalogo editable, rehaciendo las vistas que dependian de la columna. Reusable para el proximo.';

-- ---------------------------------------------------------------------
-- 4 · LO QUE SE CONVIERTE · los catálogos de negocio
-- ---------------------------------------------------------------------
SELECT sistema.convertir_a_catalogo('asistencia','servicios','tipo','tipo_servicio',
  'Tipo de servicio','Culto dominical, oracion, jovenes, celula... Cada sede puede tener los suyos.', true);
SELECT sistema.convertir_a_catalogo('grupos','grupos','tipo','tipo_grupo',
  'Tipo de grupo','Celula, discipulado, ministerio, red. Lista de la red.', false);
SELECT sistema.convertir_a_catalogo('grupos','membresias','rol','rol_membresia',
  'Rol dentro de un grupo','Lider, anfitrion, integrante, aprendiz.', false);
SELECT sistema.convertir_a_catalogo('formacion','cohortes','modalidad','modalidad_formacion',
  'Modalidad de formacion','Presencial, virtual, mixta.', false);
SELECT sistema.convertir_a_catalogo('nucleo','personas','estado_civil','estado_civil',
  'Estado civil','Lista abierta: cambia con la ley y con la realidad de la gente.', false);
SELECT sistema.convertir_a_catalogo('nucleo','personas','nivel_compromiso','nivel_compromiso',
  'Nivel de compromiso','El recorrido de alguien en la iglesia. La red lo ajusta sin desplegar.', false);
SELECT sistema.convertir_a_catalogo('talento','contratos','tipo','tipo_contrato',
  'Tipo de contrato','Laboral, prestacion de servicios, aprendizaje... cambia con la ley.', false);
SELECT sistema.convertir_a_catalogo('aportes','aportes','medio','medio_pago',
  'Medio de pago','Efectivo, transferencia, PSE, Nequi, Daviplata, tarjeta. Aparecen medios nuevos cada ano.', false);
SELECT sistema.convertir_a_catalogo('aportes','pasarela_transacciones','medio','medio_pago',
  'Medio de pago','Mismo catalogo que los aportes manuales.', false);
SELECT sistema.convertir_a_catalogo('aportes','aportes','tipo','tipo_aporte',
  'Tipo de aporte','Diezmo, ofrenda, primicia, pacto, donacion con destinacion.', false);
SELECT sistema.convertir_a_catalogo('aportes','pasarela_transacciones','tipo','tipo_aporte',
  'Tipo de aporte','Mismo catalogo que los aportes manuales.', false);
SELECT sistema.convertir_a_catalogo('crm','contactos_nuevos','reaccion','reaccion_contacto',
  'Reaccion al contacto','Como respondio la persona cuando la contactaron. La lista crece con la practica.', false);

-- ---------------------------------------------------------------------
-- 5 · LO QUE NO SE CONVIERTE, Y POR QUÉ
--     Queda REGISTRADO, no solo decidido. Un auditor que pregunte «¿por
--     qué esto sigue siendo un enumerado?» tiene la respuesta en la base.
-- ---------------------------------------------------------------------
INSERT INTO sistema.catalogos (codigo, nombre, descripcion, cerrado, motivo_cerrado) VALUES
 ('estado_aporte','Estado de un aporte','Maquina de estados.',true,
  'Cada estado lo produce codigo (registrado, conciliado, anulado) y tiene transiciones. Agregar uno sin escribir codigo dejaria aportes en un estado que nadie sabe procesar.'),
 ('estado_caso','Estado de un caso de consejeria','Maquina de estados.',true,
  'Abrir, asignar y cerrar un caso son operaciones con reglas. Un estado nuevo sin codigo detras es un caso que se queda colgado.'),
 ('estado_nuevo','Estado de un registro de nuevo','Maquina de estados.',true,
  'La bandeja de seguimiento y el calculo de atrasados dependen de estos estados exactos.'),
 ('estado_inscripcion','Estado de una inscripcion','Maquina de estados.',true,
  'Gobierna la certificacion: un estado nuevo sin codigo emitiria o bloquearia certificados sin control.'),
 ('estado_pago','Estado de pago de una inscripcion','Maquina de estados.',true,
  'Se concilia con la pasarela. Un estado inventado rompe la conciliacion al peso.'),
 ('estado_pasarela','Estado en la pasarela','Maquina de estados.',true,
  'Lo define el proveedor de pagos, no la iglesia.'),
 ('estado_persona','Estado de una persona','Maquina de estados.',true,
  'activa, inactiva, trasladada, fallecida y fusionada tienen consecuencias en comunicaciones y en reportes.'),
 ('estado_vinculo','Estado de un vinculo laboral o de voluntariado','Maquina de estados.',true,
  'Gobierna el corte automatico de accesos al terminar el vinculo.'),
 ('estado_notificacion','Estado de una notificacion','Maquina de estados.',true,
  'Lo mueve la cola de envios: pendiente, enviada, fallida.'),
 ('tipo_alcance','Tipo de alcance de un permiso','Estructural del modelo de permisos.',true,
  'Cada alcance tiene una forma distinta de resolverse a sedes en identidad.sedes_de(). Un alcance nuevo sin esa funcion no alcanzaria nada, en silencio.'),
 ('tipo_sede','Tipo de sede','Estructural.',true,
  'Determina la plantilla de aprovisionamiento y la ola de migracion. Un tipo nuevo exige decidir con que modulos nace.'),
 ('tipo_dato_atributo','Tipo de dato de una casilla','Estructural.',true,
  'Cada tipo tiene validacion y forma de pintarse. Uno nuevo exige codigo en el frontend.'),
 ('etapa_4c','Etapa del recorrido 4C','Estructural del modelo pastoral.',true,
  'El recorrido 4C es el modelo de la iglesia, no una lista de opciones.'),
 ('genero','Genero','Cerrado por decision pastoral y de reporteria.',true,
  'Se decidio en la mesa del 31 de agosto de 2026. Cambiarlo es una decision de la mesa, no de la consola.'),
 ('canal_contacto','Canal de contacto','Cerrado: cada canal exige integracion.',true,
  'Agregar un canal sin integracion de envio crearia consentimientos para un canal por el que nadie puede escribir.'),
 ('acto_consentimiento','Acto de consentimiento','Cerrado por la Ley 1581.',true,
  'otorga y revoca son los dos actos que reconoce la ley. No hay un tercero.'),
 ('es_cristiano','Confesion de fe','Cerrado por decision pastoral.',true,
  'si, no y en proceso son las tres respuestas que la iglesia decidio registrar. Ampliarlo es una decision de la mesa pastoral, no de la consola.')
ON CONFLICT (codigo) DO NOTHING;

-- ---------------------------------------------------------------------
-- 6 · LA VISTA DE LA CONSOLA
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW sistema.v_catalogos
WITH (security_invoker = true) AS
SELECT c.codigo, c.nombre, c.descripcion, c.editable_por_sede, c.cerrado, c.motivo_cerrado,
       count(v.codigo) FILTER (WHERE v.vigente) AS valores_vigentes,
       count(v.codigo) FILTER (WHERE NOT v.vigente) AS valores_retirados
FROM sistema.catalogos c
LEFT JOIN sistema.catalogo_valores v ON v.catalogo = c.codigo
GROUP BY c.codigo, c.nombre, c.descripcion, c.editable_por_sede, c.cerrado, c.motivo_cerrado;

SELECT plataforma.publicar_tabla('sistema.catalogos'::regclass, 'catalogo_red',
  'Registro de catalogos de la red. Metadato del modelo, sin datos de persona.', 'Mesa tecnica 100p', false);
SELECT plataforma.publicar_tabla('sistema.catalogo_valores'::regclass, 'catalogo_red',
  'Los valores de los catalogos. Toda pantalla los necesita para pintar desplegables.', 'Mesa tecnica 100p', false);
GRANT SELECT ON sistema.v_catalogos TO casaroca_app;
