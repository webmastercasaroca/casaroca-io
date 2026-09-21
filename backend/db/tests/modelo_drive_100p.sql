-- =====================================================================
-- BANCO DE PRUEBAS · TODO LO DEL DRIVE «SISTEMA 100p» (migración 0040)
-- Lo que se agregó no se da por hecho porque compile: cada renglón del
-- Drive que entró al sistema tiene aquí su prueba.
-- Datos sintéticos, con sufijo aleatorio para que la batería se repita.
-- =====================================================================
\set ON_ERROR_STOP on
-- ⛔ AYUDA DE LABORATORIO. Desde la migracion 0053, encolar un aviso EXIGE
--    consentimiento vigente de esa persona para ese canal y esa finalidad.
--    Los datos de prueba tienen que ser tan legales como los de verdad: si
--    el banco pudiera saltarse el consentimiento, estaria probando un
--    sistema que no existe.
CREATE OR REPLACE FUNCTION pg_temp.consentir(p_persona uuid) RETURNS void
LANGUAGE sql AS $$
  INSERT INTO plataforma.consentimientos
    (persona_id, sede_id, finalidad, canal, acto, ocurrido_en, evidencia_tipo, evidencia_ref)
  SELECT p_persona, p.sede_id, f.codigo, c.canal, 'otorgado', now(), 'formulario_web', 'banco de pruebas'
  FROM nucleo.personas p
  CROSS JOIN plataforma.finalidades f
  CROSS JOIN (SELECT unnest(enum_range(NULL::plataforma.canal_contacto)) AS canal) c
  WHERE p.id = p_persona
    -- ⛔ Sin ON CONFLICT: `consentimientos` es append-only con REGLAS, y
    --    PostgreSQL no admite ON CONFLICT sobre una tabla con reglas.
    AND NOT EXISTS (SELECT 1 FROM plataforma.consentimientos x
                    WHERE x.persona_id = p_persona AND x.canal = c.canal
                      AND x.finalidad = f.codigo);
$$;

CREATE TEMP TABLE _d (n int, nombre text, esperado text, obtenido text, paso boolean);
CREATE OR REPLACE FUNCTION pg_temp.rg(a int,b text,c text,d text,e boolean) RETURNS void
LANGUAGE sql AS $$ INSERT INTO _d VALUES (a,b,c,d,e); $$;

-- D1 · Todas las columnas del documento de Usuarios v1.2 existen con su nombre.
DO $$
DECLARE faltan text;
BEGIN
  SELECT string_agg(c, ', ') INTO faltan
    FROM unnest(ARRAY['id','documento','tipo_documento','nombre_completo','nombre_corto','genero',
      'fecha_nacimiento','edad','estado_civil','nacionalidad','pais_residencia','ciudad_residencia','zona',
      'email_principal','email_secundario','telefono_celular','telefono_fijo','telefono_emergencia',
      'permite_whatsapp','direccion_calle','direccion_ciudad','es_cristiano','fecha_conversion',
      'iglesia_anterior','ha_sido_bautizado','fecha_bautismo','es_ministro','nivel_compromiso','foto_url',
      'conyuge_id','acudiente_id','estado_persona','consentimiento_gdpr','fecha_consentimiento_gdpr',
      'fecha_registro','ultima_actualizacion']) c
   WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema='modelo100p' AND table_name='personas' AND column_name=c);
  PERFORM pg_temp.rg(1,'Personas tiene todas las columnas del Drive','ninguna falta',
    COALESCE(faltan,'ninguna falta'), faltan IS NULL);
END $$;

-- D2 · Las tablas de los cuatro documentos existen en modelo100p.
DO $$
DECLARE faltan text;
BEGIN
  SELECT string_agg(t, ', ') INTO faltan
    FROM unnest(ARRAY['personas','vinculos_personas','auditoria_personas','minores','roles','usuario_roles',
      'permisos_por_rol','auditoria_roles','nuevos_registros','contactos_nuevos','seguimiento_nuevos',
      'integracion_personas','donaciones','certificados','auditoria_donaciones']) t
   WHERE NOT EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='modelo100p' AND table_name=t);
  PERFORM pg_temp.rg(2,'Las 15 tablas del Drive existen','ninguna falta',
    COALESCE(faltan,'ninguna falta'), faltan IS NULL);
END $$;

-- D3 · Los 9 roles iniciales del documento resuelven (por código o por alias).
DO $$
DECLARE faltan text;
BEGIN
  SELECT string_agg(r, ', ') INTO faltan
    FROM unnest(ARRAY['PROPIETARIO','DIRECTOR_GENERAL','PASTOR_PRINCIPAL','PASTOR_CONGREGACIONAL',
      'COORDINADOR_NUEVOS','TESORERIA','DIGITADOR_APORTES','ASISTENCIA_REGISTRO','VISITANTE',
      'CONSEJERO','LIDER_DE_ORACION','PERSONA_QUE_ORA','SECRETARIA_ADMINISTRATIVA','LIDER_DE_GRUPO',
      'GERENCIA_ADMINISTRATIVA','RESPONSABLE_ROCAKIDS','AUDITOR','CONTABILIDAD']) r
   WHERE NOT EXISTS (SELECT 1 FROM identidad.roles WHERE codigo = r)
     AND NOT EXISTS (SELECT 1 FROM identidad.roles_alias WHERE alias = r);
  PERFORM pg_temp.rg(3,'Todos los roles del Drive existen','ninguno falta',
    COALESCE(faltan,'ninguno falta'), faltan IS NULL);
END $$;

-- D4 · Todos los permisos que nombra el documento resuelven.
DO $$
DECLARE faltan text;
BEGIN
  SELECT string_agg(a, ', ') INTO faltan
    FROM unnest(ARRAY['CREAR_NUEVO','REGISTRAR_CONTACTO','CONVERTIR_MIEMBRO','VER_REPORTES_NUEVOS',
      'REGISTRAR_APORTE','APROBAR_APORTE','GENERAR_CERTIFICADO','VER_REPORTES_FINANCIEROS','EXPORTAR_APORTES',
      'REGISTRAR_CONVERSACION_PASTORAL','VER_NOTAS_CONFIDENCIALES','REGISTRAR_PETICION_ORACION',
      'REPORTAR_RESPUESTA_ORACION','REGISTRAR_EVENTO','TOMAR_ASISTENCIA','VER_REPORTES_ASISTENCIA',
      'GENERAR_ACTA_EVENTO']) a
   WHERE NOT EXISTS (SELECT 1 FROM sistema.acciones WHERE codigo = a)
     AND NOT EXISTS (SELECT 1 FROM sistema.acciones_alias WHERE alias = a);
  PERFORM pg_temp.rg(4,'Todos los permisos del Drive existen','ninguno falta',
    COALESCE(faltan,'ninguno falta'), faltan IS NULL);
END $$;

-- D5 · El nuevo recibe coordinador de SU sede, contacto mañana, y dos avisos en cola.
DO $$
DECLARE v_sede uuid; v_coord uuid; v_n record; v_avisos int; sx text := substr(md5(clock_timestamp()::text),1,8);
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='MED';
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,email_principal,fecha_nacimiento)
  VALUES (v_sede,'Coordinadora','Medellin','coord.'||sx||'@example.org',DATE '1980-01-01') RETURNING id INTO v_coord;
  PERFORM pg_temp.consentir(v_coord);
  INSERT INTO identidad.asignaciones (persona_id,rol,alcance_tipo,alcance_id,nivel_max,vigente_desde)
  VALUES (v_coord,'COORDINADOR_NUEVOS','sede',v_sede,2,CURRENT_DATE);

  INSERT INTO crm.nuevos_registros (sede_id,nombre,email,como_supo,canales_autorizados,autorizado_en) VALUES (v_sede,'Juan Formulario','juan.'||sx||'@example.org','amigo',ARRAY['email','whatsapp']::plataforma.canal_contacto[],now())
  RETURNING coordinador_id, proximo_contacto, id INTO v_n;

  SELECT count(*) INTO v_avisos FROM plataforma.notificaciones
   WHERE origen_id = v_n.id::text AND plantilla IN ('Bienvenida_nuevo','Notificacion_coordinador');
  PERFORM pg_temp.rg(5,'Nuevo: coordinador, mañana y 2 avisos','coordinador · hoy+1 · 2 avisos',
    (v_n.coordinador_id = v_coord)::text||' · '||(v_n.proximo_contacto = CURRENT_DATE+1)::text||' · '||v_avisos,
    v_n.coordinador_id = v_coord AND v_n.proximo_contacto = CURRENT_DATE + 1 AND v_avisos = 2);
END $$;

-- D6 · Convertir con grupo y padrino: queda en el grupo y el padrino acompaña el 4C.
DO $$
DECLARE v_sede uuid; v_grupo uuid; v_padrino uuid; v_nuevo uuid; v_p uuid;
        v_miembro boolean; v_resp uuid; v_vista text; sx text := substr(md5(clock_timestamp()::text),1,8);
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='MED';
  INSERT INTO grupos.grupos (sede_id,tipo,nombre) VALUES (v_sede,'pequeno','Grupo Crecimiento '||sx) RETURNING id INTO v_grupo;
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_sede,'Padrino','Pastor',DATE '1975-05-05') RETURNING id INTO v_padrino;
  PERFORM pg_temp.consentir(v_padrino);
  INSERT INTO crm.nuevos_registros (sede_id,nombre,email,como_supo,es_cristiano,canales_autorizados,autorizado_en) VALUES (v_sede,'Maria Decidida','maria.'||sx||'@example.org','evento','duda',ARRAY['email','whatsapp']::plataforma.canal_contacto[],now()) RETURNING id INTO v_nuevo;

  v_p := crm.convertir_en_miembro(v_nuevo, v_padrino, 'Decidió en el grupo', v_grupo, v_padrino, CURRENT_DATE);

  SELECT EXISTS (SELECT 1 FROM grupos.membresias WHERE grupo_id=v_grupo AND persona_id=v_p) INTO v_miembro;
  SELECT responsable_id INTO v_resp FROM crm.recorrido WHERE persona_id=v_p AND salio_en IS NULL;
  SELECT grupo_asignado INTO v_vista FROM modelo100p.integracion_personas WHERE nuevo_id=v_nuevo;
  PERFORM pg_temp.rg(6,'Convertir con grupo y padrino','en el grupo · padrino responsable · visible',
    v_miembro::text||' · '||(v_resp = v_padrino)::text||' · '||COALESCE(v_vista,'sin grupo'),
    v_miembro AND v_resp = v_padrino AND v_vista LIKE 'Grupo Crecimiento%'
    AND (SELECT es_cristiano FROM nucleo.personas WHERE id=v_p) = 'en_proceso');
END $$;

-- D7 · Un grupo de OTRA sede se rechaza.
DO $$
DECLARE v_med uuid; v_bog uuid; v_grupo uuid; v_nuevo uuid; ok boolean := false;
BEGIN
  SELECT id INTO v_med FROM org.sedes WHERE codigo='MED';
  SELECT id INTO v_bog FROM org.sedes WHERE codigo='BOG-CHICO';
  INSERT INTO grupos.grupos (sede_id,tipo,nombre) VALUES (v_bog,'pequeno','Grupo Bogota D7') RETURNING id INTO v_grupo;
  INSERT INTO crm.nuevos_registros (sede_id,nombre,telefono,canales_autorizados,autorizado_en) VALUES (v_med,'Pedro Otra Sede','+57 3001112233',ARRAY['email','whatsapp']::plataforma.canal_contacto[],now()) RETURNING id INTO v_nuevo;
  BEGIN
    PERFORM crm.convertir_en_miembro(v_nuevo, NULL, NULL, v_grupo, NULL, NULL);
  EXCEPTION WHEN check_violation THEN ok := true;
  END;
  PERFORM pg_temp.rg(7,'Grupo de otra sede','RECHAZADO', CASE WHEN ok THEN 'RECHAZADO como debe' ELSE 'ACEPTADO' END, ok);
END $$;

-- D8 · La nota privada la ve su autor; otra persona de la MISMA sede no.
DO $$
DECLARE v_sede uuid; v_autor uuid; v_otro uuid; v_nuevo uuid; ve_autor int; ve_otro int;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-NORTE';
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_sede,'Autor','Nota',DATE '1990-01-01') RETURNING id INTO v_autor;
  PERFORM pg_temp.consentir(v_autor);
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_sede,'Otro','Curioso',DATE '1990-01-01') RETURNING id INTO v_otro;
  PERFORM pg_temp.consentir(v_otro);
  INSERT INTO crm.nuevos_registros (sede_id,nombre,telefono,coordinador_id,canales_autorizados,autorizado_en) VALUES (v_sede,'Con Nota','+57 3009998877', v_otro,ARRAY['email','whatsapp']::plataforma.canal_contacto[],now()) RETURNING id INTO v_nuevo;
  -- El coordinador es «Otro»; se lo quitamos para probar a un tercero sin relación.
  UPDATE crm.nuevos_registros SET coordinador_id = NULL WHERE id = v_nuevo;

  SET LOCAL ROLE casaroca_app;
  PERFORM set_config('app.sede_ids','{'||v_sede||'}',true);
  PERFORM set_config('app.nivel_max','2',true);
  PERFORM set_config('app.persona_id', v_autor::text, true);
  INSERT INTO crm.notas_privadas_nuevos (nuevo_id,autor_id,nota) VALUES (v_nuevo,v_autor,'Muy receptivo');
  SELECT count(*) INTO ve_autor FROM crm.notas_privadas_nuevos WHERE nuevo_id = v_nuevo;
  PERFORM set_config('app.persona_id', v_otro::text, true);
  SELECT count(*) INTO ve_otro FROM crm.notas_privadas_nuevos WHERE nuevo_id = v_nuevo;
  RESET ROLE;
  PERFORM pg_temp.rg(8,'Nota privada: la ve el autor, no un tercero','autor 1 · tercero 0',
    'autor '||ve_autor||' · tercero '||ve_otro, ve_autor = 1 AND ve_otro = 0);
END $$;

-- D9 · 🔴 Hallazgo cerrado: una sesión N2 ya no lee certificados (llevan el total anual).
DO $$
DECLARE v_sede uuid; n2 int; n3 int;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-CHICO';
  SET LOCAL ROLE casaroca_app;
  PERFORM set_config('app.sede_ids','{'||v_sede||'}',true);
  PERFORM set_config('app.nivel_max','2',true);
  SELECT count(*) INTO n2 FROM aportes.certificados;
  PERFORM set_config('app.nivel_max','3',true);
  SELECT count(*) INTO n3 FROM aportes.certificados;
  RESET ROLE;
  PERFORM pg_temp.rg(9,'Certificados: N2 no los ve, N3 sí','N2 0 · N3 >0',
    'N2 '||n2||' · N3 '||n3, n2 = 0 AND n3 > 0);
END $$;

-- D10 · Anular exige motivo; al anular se liberan los aportes y se puede re-expedir.
DO $$
DECLARE v_sede uuid; v_f uuid; v_p uuid; v_c1 uuid; v_c2 uuid; v_liberados int; sin_motivo boolean := false;
        sx text := substr(md5(clock_timestamp()::text),1,6);
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-CHICO';
  INSERT INTO aportes.fondos (codigo,nombre,tipo) VALUES ('ANU-'||sx,'Fondo anulacion','general') RETURNING id INTO v_f;
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_sede,'Donante','Corregido',DATE '1970-07-07') RETURNING id INTO v_p;
  PERFORM pg_temp.consentir(v_p);
  INSERT INTO aportes.aportes (sede_id,persona_id,fondo_id,tipo,monto,medio,fecha) VALUES
    (v_sede,v_p,v_f,'diezmo',100000,'transferencia',DATE '2026-02-01'),
    (v_sede,v_p,v_f,'diezmo',100000,'transferencia',DATE '2026-03-01');
  v_c1 := aportes.expedir_certificado(v_p, DATE '2026-01-01', DATE '2026-12-31', 'CERT-ANU-'||sx||'-1', v_p);

  BEGIN
    PERFORM aportes.anular_certificado(v_c1, '  ', v_p);
  EXCEPTION WHEN check_violation THEN sin_motivo := true;
  END;

  v_liberados := aportes.anular_certificado(v_c1, 'Faltaba un aporte de enero', v_p);
  v_c2 := aportes.expedir_certificado(v_p, DATE '2026-01-01', DATE '2026-12-31', 'CERT-ANU-'||sx||'-2', v_p);
  PERFORM pg_temp.rg(10,'Anular: exige motivo, libera y se re-expide','motivo exigido · 2 liberados · nuevo certificado',
    sin_motivo::text||' · '||v_liberados||' · '||(v_c2 IS NOT NULL)::text,
    sin_motivo AND v_liberados = 2 AND v_c2 IS NOT NULL
    AND (SELECT estado FROM aportes.certificados WHERE id = v_c1) = 'anulado');
END $$;

-- D11 · Fuera de la anulación, un aporte certificado sigue congelado.
DO $$
DECLARE v_a uuid; ok boolean := false;
BEGIN
  SELECT id INTO v_a FROM aportes.aportes WHERE estado = 'certificado' LIMIT 1;
  BEGIN
    UPDATE aportes.aportes SET estado = 'confirmado', certificado_id = NULL WHERE id = v_a;
  EXCEPTION WHEN check_violation THEN ok := true;
  END;
  PERFORM pg_temp.rg(11,'Liberar un aporte sin anular el certificado','RECHAZADO',
    CASE WHEN ok THEN 'RECHAZADO como debe' ELSE 'ACEPTADO' END, ok);
END $$;

-- D12 · Un rol desactivado no admite asignaciones nuevas.
DO $$
DECLARE v_p uuid; v_sede uuid; ok boolean := false;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-CHICO';
  SELECT id INTO v_p FROM nucleo.personas WHERE sede_id = v_sede LIMIT 1;
  UPDATE identidad.roles SET activo = false WHERE codigo = 'VISITANTE';
  BEGIN
    INSERT INTO identidad.asignaciones (persona_id,rol,alcance_tipo,alcance_id,nivel_max,vigente_desde)
    VALUES (v_p,'VISITANTE','persona_propia',v_p,2,CURRENT_DATE);
  EXCEPTION WHEN check_violation THEN ok := true;
  END;
  UPDATE identidad.roles SET activo = true WHERE codigo = 'VISITANTE';
  PERFORM pg_temp.rg(12,'Otorgar un rol desactivado','RECHAZADO',
    CASE WHEN ok THEN 'RECHAZADO como debe' ELSE 'ACEPTADO' END, ok);
END $$;

-- D13 · `identidad.puede` entiende los nombres del Drive.
DO $$
DECLARE v_sede uuid; v_t uuid; v_d uuid; t_gen boolean; t_apr boolean; d_apr boolean; d_reg boolean;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='PTY';
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_sede,'Tesorera','Panama',DATE '1982-02-02') RETURNING id INTO v_t;
  PERFORM pg_temp.consentir(v_t);
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_sede,'Digitador','Panama',DATE '1992-02-02') RETURNING id INTO v_d;
  PERFORM pg_temp.consentir(v_d);
  INSERT INTO identidad.asignaciones (persona_id,rol,alcance_tipo,alcance_id,nivel_max,vigente_desde)
  VALUES (v_t,'TESORERIA','sede',v_sede,3,CURRENT_DATE),
         (v_d,'DIGITADOR_APORTES','sede',v_sede,3,CURRENT_DATE);
  t_gen := identidad.puede(v_t,'aportes','GENERAR_CERTIFICADO');
  t_apr := identidad.puede(v_t,'aportes','APROBAR_APORTE');
  d_reg := identidad.puede(v_d,'aportes','REGISTRAR_APORTE');
  d_apr := identidad.puede(v_d,'aportes','APROBAR_APORTE');
  PERFORM pg_temp.rg(13,'Permisos con nombres del Drive','tesorería genera y aprueba · digitador registra, no aprueba',
    t_gen::text||'/'||t_apr::text||' · '||d_reg::text||'/'||d_apr::text,
    t_gen AND t_apr AND d_reg AND NOT d_apr);
END $$;

-- D14 · El modelo del Drive respeta el aislamiento: Panamá no ve personas de Bogotá.
DO $$
DECLARE v_pty uuid; ajenas int; propias int;
BEGIN
  SELECT id INTO v_pty FROM org.sedes WHERE codigo='PTY';
  SET LOCAL ROLE casaroca_app;
  PERFORM set_config('app.sede_ids','{'||v_pty||'}',true);
  PERFORM set_config('app.nivel_max','2',true);
  SELECT count(*) FILTER (WHERE sede_id <> v_pty), count(*) FILTER (WHERE sede_id = v_pty)
    INTO ajenas, propias FROM modelo100p.personas;
  RESET ROLE;
  PERFORM pg_temp.rg(14,'modelo100p.personas respeta la sede','0 ajenas · propias >0',
    ajenas||' ajenas · '||propias||' propias', ajenas = 0 AND propias > 0);
END $$;

-- D15 · La auditoría de personas sale como la pide el Drive: una fila por campo.
DO $$
DECLARE v_p uuid; v_campo text; v_ant text; v_nue text;
BEGIN
  SELECT id INTO v_p FROM nucleo.personas WHERE primer_nombre='Tesorera' AND primer_apellido='Panama' LIMIT 1;
  UPDATE nucleo.personas SET zona = 'Zona Norte' WHERE id = v_p;
  UPDATE nucleo.personas SET zona = 'Zona Sur'   WHERE id = v_p;
  -- La puerta de auditoría exige contexto: sin nivel ni sede no devuelve nada.
  PERFORM set_config('app.sede_ids','{'||(SELECT sede_id FROM nucleo.personas WHERE id=v_p)||'}',true);
  PERFORM set_config('app.nivel_max','2',true);
  SELECT campo_modificado, valor_anterior, valor_nuevo INTO v_campo, v_ant, v_nue
    FROM modelo100p.auditoria_personas
   WHERE persona_id = v_p AND tipo_cambio = 'ACTUALIZACION'
   ORDER BY fecha_cambio DESC, id DESC LIMIT 1;
  PERFORM pg_temp.rg(15,'Auditoría por campo','zona: Zona Norte → Zona Sur',
    COALESCE(v_campo,'sin fila')||': '||COALESCE(v_ant,'∅')||' → '||COALESCE(v_nue,'∅'),
    v_campo = 'zona' AND v_ant = 'Zona Norte' AND v_nue = 'Zona Sur');
END $$;

\echo ''
\echo '===== TODO LO DEL DRIVE 100p ====='
SELECT n AS "#", nombre AS "invariante", obtenido AS "resultado",
       CASE WHEN paso THEN 'PASA' ELSE 'FALLA' END AS "veredicto"
FROM _d ORDER BY n;
SELECT count(*) FILTER (WHERE paso) AS "pasan", count(*) FILTER (WHERE NOT paso) AS "fallan", count(*) AS "total" FROM _d;


-- ⛔ COMPUERTA. Sin esto, el banco IMPRIME los fallos y devuelve exito: la
--    integracion continua daria por buena una invariante rota. Se descubrio
--    el 19 de septiembre de 2026: 7 de los 8 bancos eran un informe, no una
--    compuerta.
DO $$
DECLARE v int;
BEGIN
  SELECT count(*) FILTER (WHERE NOT paso) INTO v FROM _d;
  IF v > 0 THEN
    RAISE EXCEPTION 'BANCO EN ROJO: % invariante(s) rota(s) en modelo_drive_100p.sql', v;
  END IF;
END $$;
