-- Solo la SEDE MAESTRA y su Pastor Director General.
-- Las demás iglesias NO se insertan a mano: se crean desde la maestra
-- con sistema.crear_iglesia(), que es la única vía válida. Ver seed 004.
-- ⚠️ Datos de demostración. El listado real de las 36 sedes es entrega
--    de la Dirección General (esquema 01, etapa 1).

INSERT INTO org.sedes (codigo,nombre,tipo,pais,ciudad,ola_migracion)
VALUES ('BOG-CHICO','Bogotá Chicó','sede_madre','CO','Bogotá',1)
ON CONFLICT DO NOTHING;

-- El Pastor Director General vive en la maestra y tiene alcance de organización.
DO $$
DECLARE v_sede uuid; v_p uuid;
BEGIN
  SELECT id INTO v_sede FROM org.sedes WHERE codigo='BOG-CHICO';
  INSERT INTO nucleo.personas (sede_id,primer_nombre,primer_apellido,fecha_nacimiento)
  VALUES (v_sede,'Director','General', DATE '1970-01-01') RETURNING id INTO v_p;
  INSERT INTO identidad.asignaciones
    (persona_id,rol,alcance_tipo,alcance_id,nivel_max,acta_referencia)
  VALUES (v_p,'PASTOR_DIRECTOR_GENERAL','organizacion',NULL,4,'Constitución del ecosistema');
END $$;
