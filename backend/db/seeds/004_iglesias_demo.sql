-- =====================================================================
-- Crear iglesias DESDE LA MAESTRA — el flujo real, no un INSERT.
-- Cada una nace con su plantilla de módulos, su pastor y su registro
-- en la bitácora de aprovisionamiento.
-- =====================================================================

DO $$
DECLARE
  v_maestra uuid := sistema.sede_maestra();
  v_dir uuid; v_p1 uuid; v_p2 uuid; v_p3 uuid; v_p4 uuid;
  v_norte uuid; v_med uuid; v_pty uuid; v_bcn uuid;
BEGIN
  SELECT persona_id INTO v_dir FROM identidad.asignaciones
   WHERE rol='PASTOR_DIRECTOR_GENERAL' LIMIT 1;

  -- La consola se opera CON el contexto del Director General.
  PERFORM set_config('app.persona_id', v_dir::text, true);
  PERFORM set_config('app.alcance_global','true', true);
  PERFORM set_config('app.nivel_max','4', true);

  -- Los pastores enviados salen de la iglesia madre.
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento) VALUES
    (v_maestra,'Pastor','Norte',      DATE '1980-05-10'),
    (v_maestra,'Pastor','Medellin',   DATE '1978-09-22'),
    (v_maestra,'Pastor','Panama',     DATE '1983-02-14'),
    (v_maestra,'Pastor','Barcelona',  DATE '1975-11-30');
  SELECT id INTO v_p1 FROM nucleo.personas WHERE primer_apellido='Norte';
  SELECT id INTO v_p2 FROM nucleo.personas WHERE primer_apellido='Medellin';
  SELECT id INTO v_p3 FROM nucleo.personas WHERE primer_apellido='Panama';
  SELECT id INTO v_p4 FROM nucleo.personas WHERE primer_apellido='Barcelona';

  v_norte := sistema.crear_iglesia('BOG-NORTE','Bogotá Norte','filial_nacional','CO','Bogotá','FILIAL',v_p1,2::smallint);
  v_med   := sistema.crear_iglesia('MED','Medellín','filial_nacional','CO','Medellín','FILIAL',v_p2,3::smallint);
  v_pty   := sistema.crear_iglesia('PTY','Panamá','filial_internacional','PA','Ciudad de Panamá','INTERNAC',v_p3,5::smallint);
  v_bcn   := sistema.crear_iglesia('BCN','Barcelona','filial_internacional','ES','Barcelona','INTERNAC',v_p4,5::smallint);

  -- Una plantación: arranque mínimo, sin aportes ni menores.
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_maestra,'Pastor','Chia', DATE '1988-07-03');
  PERFORM sistema.crear_iglesia('CHIA','Chía','plantacion','CO','Chía','PLANTACION',
          (SELECT id FROM nucleo.personas WHERE primer_apellido='Chia'), 4::smallint);

  SET CONSTRAINTS ALL IMMEDIATE;
END $$;
