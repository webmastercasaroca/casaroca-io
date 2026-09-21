-- =====================================================================
-- Migración 0024 — EL CONSENTIMIENTO QUE SE DA ANTES DE SER PERSONA
--
-- Lo destapó la API al escribir el registro público: alguien marca en el
-- formulario «sí, escríbanme al correo», pero todavía NO es una persona
-- del registro maestro, y `plataforma.consentimientos` exige persona.
--
-- Guardarlo «después», al convertir, sería perder la FECHA ORIGINAL — y
-- esa fecha es justo el requisito de la Ley 1581: un consentimiento
-- recapturado hoy no cubre el tratamiento de ayer.
--
-- Solución: la autorización se guarda en la bandeja con su momento, y al
-- convertir se traslada a la tabla de consentimientos CON SU FECHA
-- ORIGINAL, no con la de la conversión.
-- =====================================================================

ALTER TABLE crm.nuevos_registros
  ADD COLUMN canales_autorizados plataforma.canal_contacto[],
  ADD COLUMN autorizado_en timestamptz,
  ADD CONSTRAINT nuevo_autorizacion_coherente
    CHECK ((canales_autorizados IS NULL) = (autorizado_en IS NULL));

COMMENT ON COLUMN crm.nuevos_registros.autorizado_en IS
  'El momento en que la persona marcó la casilla en el formulario. Es la fecha que viaja al registro de consentimientos en la conversión.';

-- Se reescribe la conversión para trasladar el consentimiento.
CREATE OR REPLACE FUNCTION crm.convertir_en_miembro(
  p_nuevo_id uuid, p_convertido_por uuid, p_nota text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE n record; v_persona uuid; v_canal plataforma.canal_contacto;
BEGIN
  SELECT * INTO n FROM crm.nuevos_registros WHERE id = p_nuevo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe ese registro en la bandeja' USING ERRCODE = 'no_data_found';
  END IF;
  IF n.estado = 'convertido' THEN
    RAISE EXCEPTION 'Ese registro ya fue convertido' USING ERRCODE = 'check_violation';
  END IF;

  SELECT id INTO v_persona FROM nucleo.personas
   WHERE eliminado_en IS NULL AND n.email IS NOT NULL AND email_principal = n.email
   LIMIT 1;

  IF v_persona IS NULL THEN
    INSERT INTO nucleo.personas
      (sede_id, primer_nombre, primer_apellido, email_principal, telefono_movil,
       source_system, source_id)
    VALUES (n.sede_id,
            split_part(btrim(n.nombre),' ',1),
            COALESCE(NULLIF(btrim(substr(btrim(n.nombre),
                     length(split_part(btrim(n.nombre),' ',1))+1)),''), '(sin apellido)'),
            n.email, n.telefono, 'bandeja_nuevos', p_nuevo_id::text)
    RETURNING id INTO v_persona;
  END IF;

  -- ⭐ El consentimiento viaja CON SU FECHA ORIGINAL.
  IF n.canales_autorizados IS NOT NULL THEN
    FOREACH v_canal IN ARRAY n.canales_autorizados LOOP
      INSERT INTO plataforma.consentimientos
        (persona_id, sede_id, finalidad, canal, acto, ocurrido_en, evidencia_tipo, evidencia_ref)
      VALUES (v_persona, n.sede_id, 'convocatoria', v_canal, 'otorgado',
              n.autorizado_en, 'formulario_web', 'bandeja:'||p_nuevo_id::text);
    END LOOP;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM crm.recorrido WHERE persona_id = v_persona AND salio_en IS NULL) THEN
    INSERT INTO crm.recorrido (persona_id, sede_id, etapa, entro_en, puerta_entrada, responsable_id)
    VALUES (v_persona, n.sede_id, 'conoce', n.registrado_en,
            COALESCE(n.como_supo,'formulario web'), p_convertido_por);
  END IF;

  INSERT INTO crm.linea_tiempo
    (persona_id, sede_id, ocurrido_en, tipo, entidad_modulo, entidad_tipo, entidad_id,
     resumen, registrado_por)
  VALUES (v_persona, n.sede_id, now(), 'CAMBIO_ETAPA','nuevos','nuevo_registro',p_nuevo_id::text,
          COALESCE(p_nota,'Convertido desde la bandeja de nuevos'), p_convertido_por);

  UPDATE crm.nuevos_registros
     SET estado = 'convertido', persona_id = v_persona, convertido_en = now()
   WHERE id = p_nuevo_id;

  RETURN v_persona;
END
$$;
