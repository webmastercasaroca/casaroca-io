-- =====================================================================
-- Banco: CENTRAL, REGIONES Y EQUIPOS (migración 0044)
--
-- La pregunta que este banco contesta: ¿el permiso de un equipo cae solo
-- el día que alguien sale del equipo? Si la respuesta depende de que
-- alguien se acuerde, no es un control.
-- =====================================================================
\set ON_ERROR_STOP on
CREATE TEMP TABLE o_res(n int, caso text, esperado text, obtenido text, pasa boolean);
CREATE FUNCTION pg_temp.rg(a int, b text, c text, d text, e boolean) RETURNS void
LANGUAGE sql AS $$ INSERT INTO o_res VALUES (a,b,c,d,e) $$;
CREATE TEMP TABLE olab(k text PRIMARY KEY, v uuid);

-- O1 · Una sola central, sin padre.
DO $$
DECLARE n int; con_padre int;
BEGIN
  SELECT count(*) INTO n FROM org.unidades WHERE clase='central';
  SELECT count(*) INTO con_padre FROM org.unidades WHERE clase='central' AND padre_id IS NOT NULL;
  PERFORM pg_temp.rg(1,'Hay una sola central y no cuelga de nadie','1 sin padre',
    n||' central(es), '||con_padre||' con padre', n=1 AND con_padre=0);
END $$;

-- O2 · Dos centrales se rechazan.
DO $$
DECLARE ok boolean := false;
BEGIN
  BEGIN INSERT INTO org.unidades (codigo,nombre,clase) VALUES ('CENTRAL2','Otra central','central');
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation
                 OR insufficient_privilege OR raise_exception OR no_data_found
                 THEN ok := true; END;
  PERFORM pg_temp.rg(2,'Se puede crear una segunda central','RECHAZADO como debe',
    CASE WHEN ok THEN 'RECHAZADO como debe' ELSE 'ACEPTADO (mal)' END, ok);
END $$;

-- O3 · Un ciclo en el organigrama se rechaza.
DO $$
DECLARE ok boolean := false; a uuid; b uuid;
BEGIN
  INSERT INTO org.unidades (codigo,nombre,clase) VALUES ('T-A','Prueba A','equipo') RETURNING id INTO a;
  INSERT INTO org.unidades (codigo,nombre,clase,padre_id) VALUES ('T-B','Prueba B','equipo',a) RETURNING id INTO b;
  BEGIN UPDATE org.unidades SET padre_id = b WHERE id = a;
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation
                 OR insufficient_privilege OR raise_exception OR no_data_found
                 THEN ok := true; END;
  DELETE FROM org.unidades WHERE codigo IN ('T-B','T-A');
  PERFORM pg_temp.rg(3,'Un equipo puede depender de si mismo (ciclo)','RECHAZADO como debe',
    CASE WHEN ok THEN 'RECHAZADO como debe' ELSE 'ACEPTADO (mal)' END, ok);
END $$;

-- O4 · Toda sede activa cuelga de una unidad.
DO $$
DECLARE huerfanas text;
BEGIN
  SELECT string_agg(codigo,', ') INTO huerfanas FROM org.sedes WHERE activa AND unidad_id IS NULL;
  PERFORM pg_temp.rg(4,'Sede activa sin region ni central','ninguna',
    COALESCE(huerfanas,'ninguna'), huerfanas IS NULL);
END $$;

-- O5 · El alcance de una region llega SOLO a sus sedes.
DO $$
DECLARE n_bog int; n_int int; solapan int;
BEGIN
  SELECT array_length(org.sedes_de_unidad((SELECT id FROM org.unidades WHERE codigo='REG-BOG')),1) INTO n_bog;
  SELECT array_length(org.sedes_de_unidad((SELECT id FROM org.unidades WHERE codigo='REG-INT')),1) INTO n_int;
  SELECT count(*) INTO solapan FROM (
    SELECT unnest(org.sedes_de_unidad((SELECT id FROM org.unidades WHERE codigo='REG-BOG')))
    INTERSECT
    SELECT unnest(org.sedes_de_unidad((SELECT id FROM org.unidades WHERE codigo='REG-INT')))) x;
  PERFORM pg_temp.rg(5,'Dos regiones alcanzan la misma sede',
    'sin solape', n_bog||' + '||n_int||' sedes, '||solapan||' solapadas', solapan=0 AND n_bog>0 AND n_int>0);
END $$;

-- O6 · La central alcanza todas las sedes activas (es su trabajo).
DO $$
DECLARE n_central int; n_total int;
BEGIN
  SELECT array_length(org.sedes_de_unidad((SELECT id FROM org.unidades WHERE codigo='CENTRAL')),1) INTO n_central;
  SELECT count(*) INTO n_total FROM org.sedes WHERE activa AND unidad_id IS NOT NULL;
  PERFORM pg_temp.rg(6,'La central no alcanza toda la red', n_total||' sedes', n_central||' sedes', n_central = n_total);
END $$;

-- O7 · Un equipo no recibe un rol por encima del techo del rol.
DO $$
DECLARE ok boolean := false;
BEGIN
  BEGIN
    INSERT INTO identidad.asignaciones_unidad (unidad_id, rol, alcance_tipo, nivel_max)
    VALUES ((SELECT id FROM org.unidades WHERE codigo='EQ-COM'), 'GERENCIA_ADMINISTRATIVA','organizacion',4);
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation
                 OR insufficient_privilege OR raise_exception OR no_data_found
                 THEN ok := true; END;
  PERFORM pg_temp.rg(7,'Un equipo se pasa el techo de su rol','RECHAZADO como debe',
    CASE WHEN ok THEN 'RECHAZADO como debe' ELSE 'ACEPTADO (mal)' END, ok);
END $$;

-- ═══ EL CICLO DE VIDA DE UN PERMISO HEREDADO ═══
DO $$
DECLARE v_p uuid;
BEGIN
  INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido, fecha_nacimiento)
  VALUES ((SELECT id FROM org.sedes WHERE codigo='BOG-CHICO'),'Tesorero','DePrueba','1985-01-01')
  RETURNING id INTO v_p;
  INSERT INTO olab VALUES ('persona', v_p);
END $$;

-- O8 · Sin equipo y sin asignacion, no alcanza ninguna sede.
DO $$
DECLARE n int;
BEGIN
  SELECT COALESCE(array_length(identidad.sedes_de((SELECT v FROM olab WHERE k='persona')),1),0) INTO n;
  PERFORM pg_temp.rg(8,'Alguien sin permiso alcanza sedes','0 sedes', n||' sedes', n=0);
END $$;

-- O9 · ⭐ Entra al equipo de Finanzas y HEREDA el permiso, sin que nadie
--      se lo asigne a el.
DO $$
DECLARE n int; origen text;
BEGIN
  INSERT INTO org.unidad_miembros (unidad_id, persona_id, rol_en_unidad)
  VALUES ((SELECT id FROM org.unidades WHERE codigo='EQ-FIN'), (SELECT v FROM olab WHERE k='persona'), 'integrante');
  SELECT COALESCE(array_length(identidad.sedes_de((SELECT v FROM olab WHERE k='persona')),1),0) INTO n;
  SELECT string_agg(DISTINCT pe.origen,',') INTO origen FROM identidad.v_permiso_efectivo pe
   WHERE pe.persona_id=(SELECT v FROM olab WHERE k='persona') AND pe.vigente;
  PERFORM pg_temp.rg(9,'Entrar al equipo NO da el permiso del equipo',
    'alcanza la red, origen equipo', n||' sedes, origen '||COALESCE(origen,'ninguno'),
    n > 0 AND origen = 'equipo');
END $$;

-- O10 · ⭐ Sale del equipo y lo PIERDE EN EL INSTANTE, no manana.
DO $$
DECLARE n int;
BEGIN
  -- ⛔ Con un UPDATE a mano, el acceso seguiria vivo hasta manana (o la
  --    base rechazaria la fecha). `sacar_del_equipo` lo corta en el instante.
  PERFORM org.sacar_del_equipo(
    (SELECT id FROM org.unidades WHERE codigo='EQ-FIN'),
    (SELECT v FROM olab WHERE k='persona'),
    'Fin de su servicio en el equipo');
  SELECT COALESCE(array_length(identidad.sedes_de((SELECT v FROM olab WHERE k='persona')),1),0) INTO n;
  PERFORM pg_temp.rg(10,'Salir del equipo deja el permiso puesto hasta manana','0 sedes', n||' sedes', n=0);
END $$;

-- O11 · El supervisor regional ve SU region y no la ajena.
DO $$
DECLARE v_p uuid; sedes uuid[]; ve_bog boolean; ve_int boolean;
BEGIN
  INSERT INTO nucleo.personas (sede_id, primer_nombre, primer_apellido, fecha_nacimiento)
  VALUES ((SELECT id FROM org.sedes WHERE codigo='BOG-NORTE'),'Supervisor','Regional','1975-01-01')
  RETURNING id INTO v_p;
  INSERT INTO org.unidad_miembros (unidad_id, persona_id, rol_en_unidad)
  VALUES ((SELECT id FROM org.unidades WHERE codigo='REG-BOG'), v_p, 'lider');

  sedes := identidad.sedes_de(v_p);
  ve_bog := (SELECT id FROM org.sedes WHERE codigo='BOG-CHICO') = ANY(sedes);
  ve_int := (SELECT id FROM org.sedes WHERE codigo='BCN') = ANY(sedes);

  PERFORM pg_temp.rg(11,'El supervisor regional ve sedes de otra region',
    've Bogota, no ve Barcelona',
    CASE WHEN ve_bog AND NOT ve_int THEN 've Bogota, no ve Barcelona'
         ELSE 've_bog='||ve_bog||' ve_bcn='||ve_int END,
    ve_bog AND NOT ve_int);
  INSERT INTO olab VALUES ('supervisor', v_p);
END $$;

-- O12 · La vista de auditoria dice QUIEN puede QUE y POR QUE.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM identidad.v_quien_tiene_que
   WHERE persona_id=(SELECT v FROM olab WHERE k='supervisor') AND origen='equipo' AND equipo IS NOT NULL;
  PERFORM pg_temp.rg(12,'No se puede responder de donde viene un permiso','>= 1 fila con equipo',
    n||' fila(s)', n >= 1);
END $$;

-- O13 · Sacar a alguien sin motivo escrito se rechaza.
DO $$
DECLARE ok boolean := false;
BEGIN
  BEGIN PERFORM org.sacar_del_equipo(
    (SELECT id FROM org.unidades WHERE codigo='REG-BOG'), (SELECT v FROM olab WHERE k='supervisor'), 'x');
  EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation
                 OR insufficient_privilege OR raise_exception OR no_data_found
                 THEN ok := true; END;
  PERFORM pg_temp.rg(13,'Sacar a alguien de un equipo sin motivo','RECHAZADO como debe',
    CASE WHEN ok THEN 'RECHAZADO como debe' ELSE 'ACEPTADO (mal)' END, ok);
END $$;

-- O14 · Un acceso N3 o N4 sin revisar en 90 dias sale en la lista del comite.
DO $$
DECLARE existe boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM identidad.v_accesos_por_recertificar) INTO existe;
  PERFORM pg_temp.rg(14,'No hay lista de accesos por recertificar','hay lista',
    CASE WHEN existe THEN 'hay lista' ELSE 'vacia' END, existe);
END $$;

-- Limpieza.
-- ⛔ `nucleo.personas` tiene la regla `personas_no_delete`: un DELETE se
--    ignora EN SILENCIO (borrado logico unicamente, que es lo correcto).
--    La primera version de estas limpiezas borraba la membresia y creia
--    haber borrado la persona: quedaban personas vivas sin membresia y el
--    banco 1 se ponia rojo dos bancos despues. Aqui se borra como manda el
--    modelo: marcando.
DELETE FROM org.unidad_miembros WHERE persona_id IN (SELECT v FROM olab);
UPDATE nucleo.membresias_sede SET hasta = CURRENT_DATE, es_principal = false
 WHERE persona_id IN (SELECT v FROM olab) AND hasta IS NULL;
UPDATE nucleo.personas SET eliminado_en = now(), estado = 'inactiva'
 WHERE id IN (SELECT v FROM olab);

\echo ''
\echo '===== CENTRAL, REGIONES Y EQUIPOS ====='
SELECT n AS "#", caso AS invariante, obtenido AS resultado,
       CASE WHEN pasa THEN 'PASA' ELSE 'FALLA' END AS veredicto
FROM o_res ORDER BY n;
SELECT count(*) FILTER (WHERE pasa) AS pasan,
       count(*) FILTER (WHERE NOT pasa) AS fallan, count(*) AS total FROM o_res;

DO $$
DECLARE v int;
BEGIN
  SELECT count(*) FILTER (WHERE NOT pasa) INTO v FROM o_res;
  IF v > 0 THEN RAISE EXCEPTION 'BANCO EN ROJO: % invariante(s) rota(s) en organizacion_central.sql', v; END IF;
END $$;
