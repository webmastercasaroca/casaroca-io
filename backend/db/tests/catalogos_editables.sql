-- =====================================================================
-- Banco: CATÁLOGOS EDITABLES (migración 0046)
--
-- La prueba que pidió Daniel, textual: «si más adelante creo una casilla
-- de qué le gusta comer, debe ser fácil». Aquí es el equivalente para las
-- listas: agregar «culto de jóvenes» tiene que ser una llamada, no un
-- despliegue. Y lo contrario también se prueba: una máquina de estados
-- NO se puede ampliar desde la consola, y dice por qué.
-- =====================================================================
\set ON_ERROR_STOP on
CREATE TEMP TABLE c_res(n int, caso text, esperado text, obtenido text, pasa boolean);
CREATE FUNCTION pg_temp.rg(a int, b text, c text, d text, e boolean) RETURNS void
LANGUAGE sql AS $$ INSERT INTO c_res VALUES (a,b,c,d,e) $$;

-- C1 · ⭐ «Culto de jovenes», sin migracion y sin despliegue.
DO $$
DECLARE existe boolean;
BEGIN
  PERFORM sistema.agregar_valor('tipo_servicio','culto_jovenes','Culto de jovenes',
    'Viernes 7 pm', 35::smallint, (SELECT id FROM org.sedes WHERE codigo='CHIA'));
  SELECT EXISTS (SELECT 1 FROM sistema.catalogo_valores
                 WHERE catalogo='tipo_servicio' AND codigo='culto_jovenes' AND vigente) INTO existe;
  PERFORM pg_temp.rg(1,'Agregar un tipo de servicio exige desplegar','agregado sin DDL',
    CASE WHEN existe THEN 'agregado sin DDL' ELSE 'no se pudo' END, existe);
END $$;

-- C2 · Y se puede usar de inmediato en una fila real.
DO $$
DECLARE v_id uuid; ok boolean := false;
BEGIN
  INSERT INTO asistencia.servicios (sede_id, tipo, fecha, hora_inicio, nombre)
  VALUES ((SELECT id FROM org.sedes WHERE codigo='CHIA'),'culto_jovenes', CURRENT_DATE, '19:00', 'Culto de jovenes de prueba')
  RETURNING id INTO v_id;
  ok := v_id IS NOT NULL;
  DELETE FROM asistencia.servicios WHERE id = v_id;
  PERFORM pg_temp.rg(2,'El valor nuevo no se puede usar todavia','usable de inmediato',
    CASE WHEN ok THEN 'usable de inmediato' ELSE 'no usable' END, ok);
END $$;

-- C3 · Un valor que no existe se rechaza. El catalogo no es texto libre.
DO $$
DECLARE ok boolean := false;
BEGIN
  BEGIN
    INSERT INTO asistencia.servicios (sede_id, tipo, fecha, hora_inicio, nombre)
    VALUES ((SELECT id FROM org.sedes WHERE codigo='CHIA'),'lo_que_sea', CURRENT_DATE, '19:00', 'x');
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation
                 OR insufficient_privilege OR raise_exception OR no_data_found
                 THEN ok := true; END;
  PERFORM pg_temp.rg(3,'Se acepta un valor que no esta en el catalogo','RECHAZADO como debe',
    CASE WHEN ok THEN 'RECHAZADO como debe' ELSE 'ACEPTADO (mal)' END, ok);
END $$;

-- C4 · ⭐ Una MAQUINA DE ESTADOS no se amplia desde la consola, y dice por que.
DO $$
DECLARE ok boolean := false; msg text;
BEGIN
  BEGIN PERFORM sistema.agregar_valor('estado_aporte','medio_conciliado','Medio conciliado');
  EXCEPTION WHEN others THEN ok := true; msg := SQLERRM; END;
  PERFORM pg_temp.rg(4,'Se puede inventar un estado desde la consola','RECHAZADO con motivo',
    CASE WHEN ok AND msg ~ 'cerrado a proposito' THEN 'RECHAZADO con motivo' ELSE COALESCE(msg,'ACEPTADO (mal)') END,
    ok AND msg ~ 'cerrado a proposito');
END $$;

-- C5 · Todo catalogo cerrado tiene su motivo escrito.
DO $$
DECLARE sin_motivo int;
BEGIN
  SELECT count(*) INTO sin_motivo FROM sistema.catalogos
   WHERE cerrado AND (motivo_cerrado IS NULL OR length(trim(motivo_cerrado)) < 20);
  PERFORM pg_temp.rg(5,'Catalogo cerrado sin explicar por que','0', sin_motivo||'', sin_motivo=0);
END $$;

-- C6 · Un codigo con espacios o acentos se rechaza: es una llave, no una etiqueta.
DO $$
DECLARE ok boolean := false;
BEGIN
  BEGIN PERFORM sistema.agregar_valor('tipo_grupo','grupo de jóvenes','Grupo de jovenes');
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation
                 OR insufficient_privilege OR raise_exception OR no_data_found
                 THEN ok := true; END;
  PERFORM pg_temp.rg(6,'Se acepta un codigo con espacios y acentos','RECHAZADO como debe',
    CASE WHEN ok THEN 'RECHAZADO como debe' ELSE 'ACEPTADO (mal)' END, ok);
END $$;

-- C7 · Un valor de UNA sede solo se permite si el catalogo lo admite.
DO $$
DECLARE ok boolean := false;
BEGIN
  BEGIN PERFORM sistema.agregar_valor('tipo_grupo','celula_x','Celula X', NULL, 100::smallint,
    (SELECT id FROM org.sedes WHERE codigo='CHIA'));
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation
                 OR insufficient_privilege OR raise_exception OR no_data_found
                 THEN ok := true; END;
  PERFORM pg_temp.rg(7,'Una sede mete valores en un catalogo de la red','RECHAZADO como debe',
    CASE WHEN ok THEN 'RECHAZADO como debe' ELSE 'ACEPTADO (mal)' END, ok);
END $$;

-- C8 · Retirar exige motivo.
DO $$
DECLARE ok boolean := false;
BEGIN
  BEGIN PERFORM sistema.retirar_valor('tipo_servicio','culto_jovenes','x');
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation
                 OR insufficient_privilege OR raise_exception OR no_data_found
                 THEN ok := true; END;
  PERFORM pg_temp.rg(8,'Retirar un valor sin motivo','RECHAZADO como debe',
    CASE WHEN ok THEN 'RECHAZADO como debe' ELSE 'ACEPTADO (mal)' END, ok);
END $$;

-- C9 · ⭐ Retirado: la historia sigue legible, pero no se usa en filas nuevas.
DO $$
DECLARE v_id uuid; historico int; ok_nuevo boolean := false;
BEGIN
  INSERT INTO asistencia.servicios (sede_id, tipo, fecha, hora_inicio, nombre)
  VALUES ((SELECT id FROM org.sedes WHERE codigo='CHIA'),'culto_jovenes', CURRENT_DATE - 30, '19:00', 'Historico')
  RETURNING id INTO v_id;

  PERFORM sistema.retirar_valor('tipo_servicio','culto_jovenes','Se fusiono con el culto del domingo');

  SELECT count(*) INTO historico FROM asistencia.servicios WHERE id = v_id;
  BEGIN
    INSERT INTO asistencia.servicios (sede_id, tipo, fecha, hora_inicio, nombre)
    VALUES ((SELECT id FROM org.sedes WHERE codigo='CHIA'),'culto_jovenes', CURRENT_DATE, '19:00', 'Nuevo');
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation
                 OR insufficient_privilege OR raise_exception OR no_data_found
                 THEN ok_nuevo := true; END;

  DELETE FROM asistencia.servicios WHERE id = v_id;
  PERFORM pg_temp.rg(9,'Retirar un valor rompe la historia o deja crear filas nuevas',
    'historia intacta, fila nueva rechazada',
    'historia '||historico||', nueva '||CASE WHEN ok_nuevo THEN 'rechazada' ELSE 'ACEPTADA (mal)' END,
    historico = 1 AND ok_nuevo);
END $$;

-- C10 · ⭐ No queda ningun enumerado de negocio sin decidir. Si alguien crea
--       uno nuevo manana y no lo registra, esta prueba lo caza.
DO $$
DECLARE sueltos text;
BEGIN
  SELECT string_agg(n.nspname||'.'||t.typname, ', ') INTO sueltos
  FROM pg_type t
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE t.typtype = 'e'
    AND n.nspname IN ('nucleo','org','crm','identidad','plataforma','grupos','asistencia',
                      'rocakids','consejeria','aportes','formacion','talento','sistema')
    AND NOT EXISTS (SELECT 1 FROM sistema.catalogos c WHERE c.codigo = t.typname AND c.cerrado);
  PERFORM pg_temp.rg(10,'Enumerado del motor sin registrar como cerrado',
    'ninguno', COALESCE(sueltos,'ninguno'), sueltos IS NULL);
END $$;

-- C11 · Las vistas que dependian de las columnas convertidas siguen ahi.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
   WHERE c.relkind='v' AND ns.nspname='aportes'
     AND c.relname IN ('v_detalle_por_persona','v_agregado_sede','v_pagos_sin_dueno');
  PERFORM pg_temp.rg(11,'La conversion se llevo vistas por delante','3 vistas', n||' vistas', n = 3);
END $$;

-- Limpieza del laboratorio: el valor de prueba no se queda en el catalogo.
DELETE FROM sistema.catalogo_valores WHERE catalogo='tipo_servicio' AND codigo='culto_jovenes';

\echo ''
\echo '===== CATALOGOS EDITABLES: SE AGREGA SIN DESPLEGAR ====='
SELECT n AS "#", caso AS invariante, obtenido AS resultado,
       CASE WHEN pasa THEN 'PASA' ELSE 'FALLA' END AS veredicto
FROM c_res ORDER BY n;
SELECT count(*) FILTER (WHERE pasa) AS pasan,
       count(*) FILTER (WHERE NOT pasa) AS fallan, count(*) AS total FROM c_res;

DO $$
DECLARE v int;
BEGIN
  SELECT count(*) FILTER (WHERE NOT pasa) INTO v FROM c_res;
  IF v > 0 THEN RAISE EXCEPTION 'BANCO EN ROJO: % invariante(s) rota(s) en catalogos_editables.sql', v; END IF;
END $$;
