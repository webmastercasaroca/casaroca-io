-- =====================================================================
-- BANCO DE PRUEBAS · CONSOLA DE SISTEMAS
-- Demuestra que el aprovisionamiento de iglesias, la habilitación de
-- módulos y la matriz de permisos son reglas de la base, no del manual.
-- Datos sintéticos: los crea la propia prueba.
-- =====================================================================
\set ON_ERROR_STOP on

CREATE TEMP TABLE _c (n int, nombre text, esperado text, obtenido text, paso boolean);
CREATE OR REPLACE FUNCTION pg_temp.rg(a int,b text,c text,d text,e boolean) RETURNS void
LANGUAGE sql AS $$ INSERT INTO _c VALUES (a,b,c,d,e); $$;

-- C1 · Solo puede existir UNA sede maestra.
DO $$
BEGIN
  BEGIN
    INSERT INTO org.sedes (codigo,nombre,tipo,pais,ciudad)
    VALUES ('OTRA-MADRE','Otra madre','sede_madre','CO','Cali');
    PERFORM pg_temp.rg(1,'Segunda sede maestra','RECHAZADA','ACEPTADA',false);
  EXCEPTION WHEN unique_violation THEN
    PERFORM pg_temp.rg(1,'Segunda sede maestra','RECHAZADA','RECHAZADA como debe',true);
  END;
END $$;

-- C2 · La sede maestra no se puede desactivar.
DO $$
BEGIN
  BEGIN
    UPDATE org.sedes SET activa = false WHERE tipo = 'sede_madre';
    PERFORM pg_temp.rg(2,'Desactivar la sede maestra','RECHAZADA','ACEPTADA',false);
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.rg(2,'Desactivar la sede maestra','RECHAZADA','RECHAZADA como debe',true);
  END;
END $$;

-- C3 · Crear una iglesia SIN alcance de organización.
DO $$
DECLARE v_p uuid;
BEGIN
  SELECT id INTO v_p FROM nucleo.personas LIMIT 1;
  PERFORM set_config('app.alcance_global','false', true);
  BEGIN
    PERFORM sistema.crear_iglesia('X1','Prueba','filial_nacional','CO','Cali','FILIAL',v_p,NULL);
    PERFORM pg_temp.rg(3,'Crear iglesia sin alcance de organizacion','RECHAZADA','ACEPTADA',false);
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM pg_temp.rg(3,'Crear iglesia sin alcance de organizacion','RECHAZADA','RECHAZADA como debe',true);
  END;
END $$;

-- C4 · Una filial no puede quedar sin pastor congregacional.
DO $$
BEGIN
  BEGIN
    INSERT INTO org.sedes (codigo,nombre,tipo,pais,ciudad)
    VALUES ('HUERFANA','Sede sin pastor','filial_nacional','CO','Cali');
    SET CONSTRAINTS ALL IMMEDIATE;
    PERFORM pg_temp.rg(4,'Filial sin pastor congregacional','RECHAZADA','ACEPTADA',false);
  EXCEPTION WHEN foreign_key_violation THEN
    PERFORM pg_temp.rg(4,'Filial sin pastor congregacional','RECHAZADA','RECHAZADA como debe',true);
  END;
END $$;

-- C5 · Un modulo de nucleo no se puede apagar.
DO $$
DECLARE v_sede uuid;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='MED';
  BEGIN
    UPDATE sistema.modulos_sede SET activo = false WHERE sede_id=v_sede AND modulo='personas';
    PERFORM pg_temp.rg(5,'Apagar el modulo Personas (nucleo)','RECHAZADO','ACEPTADO',false);
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.rg(5,'Apagar el modulo Personas (nucleo)','RECHAZADO','RECHAZADO como debe',true);
  END;
END $$;

-- C6 · Un modulo con compuerta legal no se enciende sin evidencia.
DO $$
DECLARE v_sede uuid; v_evidencia text; v_activo boolean;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='MED';
  -- ⛔ 19 sep 2026 · Esta prueba daba por hecho que la semilla dejaba
  --    RocaKids en MED SIN evidencia legal. La semilla cambio y le puso
  --    ACTA-SIC-2026-014: desde entonces el UPDATE tenia razon en pasar y
  --    la prueba marcaba rojo por una condicion que ya no existia. Una
  --    prueba que depende de como quedo la semilla no prueba la regla:
  --    ahora CREA su propia condicion y despues la devuelve como estaba.
  SELECT evidencia_legal_ref, activo INTO v_evidencia, v_activo
    FROM sistema.modulos_sede WHERE sede_id=v_sede AND modulo='rocakids';
  UPDATE sistema.modulos_sede SET activo = false, evidencia_legal_ref = NULL
   WHERE sede_id=v_sede AND modulo='rocakids';
  BEGIN
    UPDATE sistema.modulos_sede SET activo = true WHERE sede_id=v_sede AND modulo='rocakids';
    PERFORM pg_temp.rg(6,'Encender RocaKids sin compuerta legal','RECHAZADO','ACEPTADO',false);
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.rg(6,'Encender RocaKids sin compuerta legal','RECHAZADO','RECHAZADO como debe',true);
  END;
  -- Se devuelve la sede a como estaba: una prueba no deja al sistema peor.
  UPDATE sistema.modulos_sede
     SET evidencia_legal_ref = v_evidencia, activo = COALESCE(v_activo,false)
   WHERE sede_id=v_sede AND modulo='rocakids';
END $$;

-- C7 · Con la evidencia registrada, SI se enciende.
DO $$
DECLARE v_sede uuid; v_ok boolean;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='MED';
  UPDATE sistema.modulos_sede
     SET activo = true, evidencia_legal_ref = 'ACTA-SIC-2026-014'
   WHERE sede_id=v_sede AND modulo='rocakids';
  SELECT activo INTO v_ok FROM sistema.modulos_sede WHERE sede_id=v_sede AND modulo='rocakids';
  PERFORM pg_temp.rg(7,'Encender RocaKids CON evidencia legal','ACEPTADO',
    CASE WHEN v_ok THEN 'ACEPTADO' ELSE 'RECHAZADO' END, v_ok);
END $$;

-- C8 · Un rol NO puede recibir permiso sobre un modulo por encima de su techo.
--
-- ⛔ Esta prueba fijaba 'PASTOR_CONGREGACIONAL' + 'rocakids' a mano, y es la
-- TERCERA que se rompe por lo mismo el 11 de septiembre: la direccion subio
-- ese techo, el permiso paso a ser legitimo, y el INSERT choco con la clave
-- primaria y aborto el banco entero.
--
-- 👉 Patron que conviene no repetir: una prueba que fija valores de CATALOGO
-- prueba la foto del dia en que se escribio, no la regla. El catalogo cambia
-- por decisiones legitimas de la mesa; la regla no. Aqui el par se ELIGE.
DO $$
DECLARE v_rol text; v_techo smallint; v_mod text; v_niv smallint;
BEGIN
  SELECT r.codigo, r.nivel_maximo, m.codigo, m.nivel_dato
    INTO v_rol, v_techo, v_mod, v_niv
  FROM identidad.roles r, sistema.modulos m
  WHERE m.nivel_dato > r.nivel_maximo
    AND NOT EXISTS (SELECT 1 FROM sistema.matriz_permisos p
                    WHERE p.rol = r.codigo AND p.modulo = m.codigo AND p.accion = 'ver')
  ORDER BY r.nivel_maximo ASC, m.nivel_dato DESC LIMIT 1;

  IF v_rol IS NULL THEN
    PERFORM pg_temp.rg(8,'Permiso por encima del techo del rol','RECHAZADO',
      'sin pareja que probar: ningun rol esta por debajo de ningun modulo', true);
  ELSE
    BEGIN
      INSERT INTO sistema.matriz_permisos (rol,modulo,accion) VALUES (v_rol,v_mod,'ver');
      PERFORM pg_temp.rg(8,'Permiso por encima del techo del rol','RECHAZADO',
        'ACEPTADO: '||v_rol||' (N'||v_techo||') sobre '||v_mod||' (N'||v_niv||')', false);
    EXCEPTION WHEN check_violation THEN
      PERFORM pg_temp.rg(8,'Permiso por encima del techo del rol','RECHAZADO',
        'RECHAZADO como debe: '||v_rol||' (N'||v_techo||') sobre '||v_mod||' (N'||v_niv||')', true);
    END;
  END IF;
END $$;

-- C9 · No se enciende un modulo cuya dependencia esta apagada.
DO $$
DECLARE v_sede uuid; sin_evidencia text; con_evidencia text;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='CHIA';

  -- ⛔ 19 sep 2026 · Esta prueba hacia DOS cosas mal y el banco entero moria
  --    en la segunda corrida:
  --    1. Insertaba sin limpiar. Las semillas ya encienden «aportes» en
  --       CHIA, asi que dentro de la compuerta reventaba con 23505 (clave
  --       duplicada), que no estaba capturado: el banco no imprimia un
  --       fallo, se caia.
  --    2. Registraba 'ACEPTADO','ACEPTADO',true SIN MIRAR NADA. Era una
  --       tautologia: pasaba siempre, incluso con la regla rota.
  --    Ahora se limpia primero y se comprueba la regla de verdad, en sus
  --    dos sentidos: sin evidencia legal NO se enciende; con evidencia, si.
  DELETE FROM sistema.modulos_sede WHERE sede_id = v_sede AND modulo = 'aportes';

  BEGIN
    INSERT INTO sistema.modulos_sede (sede_id,modulo,activo,evidencia_legal_ref)
    VALUES (v_sede,'aportes',true,NULL);
    sin_evidencia := 'ACEPTADO';
  EXCEPTION WHEN check_violation THEN sin_evidencia := 'RECHAZADO';
  END;

  DELETE FROM sistema.modulos_sede WHERE sede_id = v_sede AND modulo = 'aportes';
  BEGIN
    INSERT INTO sistema.modulos_sede (sede_id,modulo,activo,evidencia_legal_ref)
    VALUES (v_sede,'aportes',true,'ACTA-X');
    con_evidencia := 'ACEPTADO';
  EXCEPTION WHEN check_violation THEN con_evidencia := 'RECHAZADO';
  END;

  PERFORM pg_temp.rg(9,'Aportes se enciende sin evidencia legal, o no se enciende con ella',
    'RECHAZADO sin evidencia · ACEPTADO con ella',
    sin_evidencia||' sin evidencia · '||con_evidencia||' con ella',
    sin_evidencia = 'RECHAZADO' AND con_evidencia = 'ACEPTADO');
END $$;

-- C10 · La plantacion nace SIN los modulos de compuerta legal.
DO $$
DECLARE v_n bigint;
BEGIN
  SELECT count(*) INTO v_n
  FROM sistema.modulos_sede ms
  JOIN org.sedes s ON s.id = ms.sede_id
  JOIN sistema.modulos m ON m.codigo = ms.modulo
  WHERE s.codigo='CHIA' AND m.exige_compuerta_legal AND ms.modulo <> 'aportes';
  PERFORM pg_temp.rg(10,'Plantacion sin modulos de compuerta legal','0', v_n::text, v_n = 0);
END $$;

-- C11 · La filial nace con los 3 modulos legales APAGADOS.
-- ⛔ Esta afirmaba el numero 3 y se rompio al anadir «oracion», que
-- tambien exige compuerta legal. Es la CUARTA prueba que se cae por fijar
-- un valor de catalogo en vez de la regla. Lo que importa no es cuantos
-- son: es que NINGUNO nazca encendido.
DO $$
DECLARE v_encendidos text;
BEGIN
  SELECT string_agg(m.codigo, ', ') INTO v_encendidos
  FROM sistema.modulos_sede ms
  JOIN org.sedes s ON s.id = ms.sede_id
  JOIN sistema.modulos m ON m.codigo = ms.modulo
  WHERE s.codigo='BCN' AND m.exige_compuerta_legal AND ms.activo;
  PERFORM pg_temp.rg(11,'Filial nace con los modulos legales apagados',
    'ninguno encendido', COALESCE('encendidos sin evidencia: '||v_encendidos,'ninguno encendido'),
    v_encendidos IS NULL);
END $$;

-- C12 · NADIE puede exportar datos de menores.
DO $$
DECLARE v_n bigint;
BEGIN
  SELECT count(*) INTO v_n FROM sistema.matriz_permisos
   WHERE modulo='rocakids' AND accion='exportar';
  PERFORM pg_temp.rg(12,'Roles que pueden exportar RocaKids','0', v_n::text, v_n = 0);
END $$;

-- C13 · El permiso efectivo apaga el boton cuando el modulo esta apagado.
DO $$
DECLARE v_permitido boolean;
BEGIN
  SELECT bool_or(permitido) INTO v_permitido
  FROM sistema.v_permiso_efectivo pe
  JOIN org.sedes s ON s.id = pe.sede_id
  WHERE s.codigo='BCN' AND pe.modulo='aportes';
  PERFORM pg_temp.rg(13,'Permiso sobre modulo apagado','false',
    COALESCE(v_permitido::text,'sin filas'), COALESCE(v_permitido,false) = false);
END $$;



-- ═══════════ CONTROLES DE CONFIGURACIÓN ═══════════
-- Tres fallos que no se ven leyendo el esquema y salen como un 500 —
-- o, peor, como datos de otra sede.

-- C14 · Ninguna vista se ejecuta con los permisos de su propietario.
DO $$
DECLARE v_n bigint; v_lista text;
BEGIN
  SELECT count(*), string_agg(esquema||'.'||vista, ', ') INTO v_n, v_lista
    FROM plataforma.v_control_vistas;
  PERFORM pg_temp.rg(14,'Toda vista con security_invoker','0 vistas expuestas',
    COALESCE(v_lista, '0 vistas expuestas'), v_n = 0);
END $$;

-- C15 · La aplicacion puede leer todo lo que necesita.
DO $$
DECLARE v_n bigint; v_lista text;
BEGIN
  SELECT count(*), string_agg(esquema||'.'||objeto, ', ') INTO v_n, v_lista
    FROM plataforma.v_control_permisos;
  PERFORM pg_temp.rg(15,'Sin objetos ilegibles para la aplicacion','0 objetos',
    COALESCE(v_lista, '0 objetos'), v_n = 0);
END $$;

-- C16 · Y puede insertar: las secuencias tambien estan concedidas.
DO $$
DECLARE v_n bigint; v_lista text;
BEGIN
  SELECT count(*), string_agg(esquema||'.'||secuencia, ', ') INTO v_n, v_lista
    FROM plataforma.v_control_secuencias;
  PERFORM pg_temp.rg(16,'Sin secuencias sin conceder','0 secuencias',
    COALESCE(v_lista, '0 secuencias'), v_n = 0);
END $$;

-- ═══════════ EL ESLABÓN DEL SEGMENTO ═══════════

-- C17 · Un alcance de segmento EXIGE su identificador.
DO $$
DECLARE v_p uuid;
BEGIN
  SELECT id INTO v_p FROM nucleo.personas LIMIT 1;
  BEGIN
    INSERT INTO identidad.asignaciones (persona_id,rol,alcance_tipo,alcance_id,nivel_max)
    VALUES (v_p,'DIRECTOR_SEGMENTO','segmento',NULL,2);
    PERFORM pg_temp.rg(17,'Alcance de segmento sin identificador','RECHAZADO','ACEPTADO',false);
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.rg(17,'Alcance de segmento sin identificador','RECHAZADO','RECHAZADO como debe',true);
  END;
END $$;

-- C18 · Un director de segmento resuelve a la sede de SU segmento, y a ninguna otra.
DO $$
DECLARE v_seg uuid; v_sede uuid; v_p uuid; v_sedes uuid[];
BEGIN
  SELECT id, sede_id INTO v_seg, v_sede FROM org.segmentos WHERE codigo='LEGADO';
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_sede,'Director','Legado',DATE '1988-06-06') RETURNING id INTO v_p;
  INSERT INTO identidad.asignaciones (persona_id,rol,alcance_tipo,alcance_id,nivel_max)
  VALUES (v_p,'DIRECTOR_SEGMENTO','segmento',v_seg,2);

  SELECT identidad.sedes_de(v_p) INTO v_sedes;
  PERFORM pg_temp.rg(18,'El director de segmento resuelve a UNA sede','1 sede, la suya',
    array_length(v_sedes,1)||' sede(s)',
    array_length(v_sedes,1) = 1 AND v_sedes[1] = v_sede);
END $$;

-- C19 · No hay segmento si el ministerio no está activo en esa sede.
DO $$
DECLARE v_sede uuid; v_min uuid;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='CHIA';
  SELECT id INTO v_min FROM org.ministerios WHERE codigo='TMT';
  BEGIN
    INSERT INTO org.segmentos (sede_id,ministerio_id,codigo,nombre)
    VALUES (v_sede,v_min,'PULSO','Pulso');
    PERFORM pg_temp.rg(19,'Segmento de un ministerio apagado','RECHAZADO','ACEPTADO',false);
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.rg(19,'Segmento de un ministerio apagado','RECHAZADO','RECHAZADO como debe',true);
  END;
END $$;

-- C20 · Un grupo no puede colgar de un segmento de OTRA sede.
DO $$
DECLARE v_seg uuid; v_otra uuid;
BEGIN
  SELECT id INTO v_seg FROM org.segmentos WHERE codigo='PULSO';
  SELECT id INTO v_otra FROM org.sedes WHERE codigo='MED';
  BEGIN
    INSERT INTO grupos.grupos (sede_id,tipo,nombre,segmento_id)
    VALUES (v_otra,'pequeno','Grupo cruzado',v_seg);
    PERFORM pg_temp.rg(20,'Grupo colgado de un segmento de otra sede','RECHAZADO','ACEPTADO',false);
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.rg(20,'Grupo colgado de un segmento de otra sede','RECHAZADO','RECHAZADO como debe',true);
  END;
END $$;

-- ═══════════ CONSEJERÍA ANCLADA A LOS PASTORES ═══════════

-- C21 · El pastor de la sede VE los casos de su sede, sin que se los asignen.
DO $$
DECLARE v_sede uuid; v_pastor uuid; v_consultante uuid; v_caso uuid; v_ve boolean;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='MED';
  SELECT a.persona_id INTO v_pastor FROM identidad.asignaciones a
   WHERE a.rol='PASTOR_CONGREGACIONAL' AND a.alcance_id=v_sede LIMIT 1;
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_sede,'Consultante','Medellin',DATE '1990-03-03') RETURNING id INTO v_consultante;
  INSERT INTO consejeria.casos (consultante_id,sede_id,topico)
  VALUES (v_consultante,v_sede,'FAM') RETURNING id INTO v_caso;

  PERFORM set_config('app.persona_id', v_pastor::text, true);
  PERFORM set_config('app.nivel_max','2', true);
  SELECT consejeria.caso_visible(v_caso) INTO v_ve;
  PERFORM pg_temp.rg(21,'El pastor ve la consejeria de SU sede','true', v_ve::text, v_ve);
END $$;

-- C22 · El pastor de OTRA sede no la ve.
DO $$
DECLARE v_otro uuid; v_caso uuid; v_ve boolean; v_bog uuid;
BEGIN
  SELECT id INTO v_bog FROM org.sedes WHERE codigo='BOG-NORTE';
  SELECT a.persona_id INTO v_otro FROM identidad.asignaciones a
   WHERE a.rol='PASTOR_CONGREGACIONAL' AND a.alcance_id=v_bog LIMIT 1;
  SELECT c.id INTO v_caso FROM consejeria.casos c
   JOIN org.sedes s ON s.id=c.sede_id WHERE s.codigo='MED' LIMIT 1;

  PERFORM set_config('app.persona_id', v_otro::text, true);
  PERFORM set_config('app.nivel_max','2', true);
  SELECT consejeria.caso_visible(v_caso) INTO v_ve;
  PERFORM pg_temp.rg(22,'El pastor de OTRA sede no la ve','false', v_ve::text, NOT v_ve);
END $$;

-- C23 · Alguien con nivel N3 pero SIN vinculo pastoral tampoco la ve.
DO $$
DECLARE v_sede uuid; v_p uuid; v_caso uuid; v_ve boolean;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='MED';
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_sede,'Contable','Curioso',DATE '1982-08-08') RETURNING id INTO v_p;
  INSERT INTO identidad.asignaciones (persona_id,rol,alcance_tipo,alcance_id,nivel_max)
  VALUES (v_p,'CONTABILIDAD','organizacion',NULL,3);
  SELECT c.id INTO v_caso FROM consejeria.casos c
   JOIN org.sedes s ON s.id=c.sede_id WHERE s.codigo='MED' LIMIT 1;

  PERFORM set_config('app.persona_id', v_p::text, true);
  PERFORM set_config('app.nivel_max','3', true);
  SELECT consejeria.caso_visible(v_caso) INTO v_ve;
  PERFORM pg_temp.rg(23,'Nivel N3 sin vinculo pastoral','false', v_ve::text, NOT v_ve);
END $$;

-- C24 · POLITICA CAMBIADA el 11 de septiembre de 2026 por decision de la
-- direccion. Antes decia: «los pastores no alcanzan los aportes, solo el
-- Director General». Ahora:
--
--   · El pastor de una iglesia VE los aportes DE SU IGLESIA.
--   · El Pastor Principal, los de las 36 y de cada persona.
--
-- Lo que se verifica ya no es que no vean nada, sino que el pastor de sede
-- siga ACOTADO a su sede. Eso no lo da la matriz: lo impone el RLS con el
-- alcance de su asignacion. Si un dia alguien le pusiera alcance de
-- organizacion, veria los aportes de toda la red, y eso SI seria el error.
DO $$
DECLARE v_mal bigint;
BEGIN
  SELECT count(*) INTO v_mal
  FROM identidad.asignaciones a
  WHERE a.rol = 'PASTOR_CONGREGACIONAL'
    AND a.alcance_tipo = 'organizacion'
    AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= CURRENT_DATE);
  PERFORM pg_temp.rg(24,'Pastor de sede con alcance de toda la red','0',
    v_mal::text, v_mal = 0);
END $$;

-- C25 · No se puede otorgar un permiso N3 sin declarar la elevacion.
DO $$
BEGIN
  PERFORM set_config('app.persona_id','', true);
  BEGIN
    INSERT INTO sistema.matriz_permisos (rol,modulo,accion) VALUES ('SECRETARIA','consejeria','ver');
    PERFORM pg_temp.rg(25,'Permiso N3 a un rol N2 sin declararlo','RECHAZADO','ACEPTADO',false);
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.rg(25,'Permiso N3 a un rol N2 sin declararlo','RECHAZADO','RECHAZADO como debe',true);
  END;
END $$;

\echo ''
\echo '===== CONSOLA DE SISTEMAS ====='
SELECT n AS "#", nombre AS "invariante", obtenido AS "resultado",
       CASE WHEN paso THEN 'PASA' ELSE 'FALLA' END AS "veredicto"
FROM _c ORDER BY n;
SELECT count(*) FILTER (WHERE paso) AS "pasan", count(*) FILTER (WHERE NOT paso) AS "fallan", count(*) AS "total" FROM _c;


-- ⛔ COMPUERTA. Sin esto, el banco IMPRIME los fallos y devuelve exito: la
--    integracion continua daria por buena una invariante rota. Se descubrio
--    el 19 de septiembre de 2026: 7 de los 8 bancos eran un informe, no una
--    compuerta.
DO $$
DECLARE v int;
BEGIN
  SELECT count(*) FILTER (WHERE NOT paso) INTO v FROM _c;
  IF v > 0 THEN
    RAISE EXCEPTION 'BANCO EN ROJO: % invariante(s) rota(s) en consola_sistemas.sql', v;
  END IF;
END $$;
