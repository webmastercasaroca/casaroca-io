-- =====================================================================
-- Catálogo del empalme con los módulos del equipo 100p.
-- Son DATOS (permisos nombrados, rol nuevo, filas de matriz), no esquema:
-- por eso viven en un seed y no en la migración.
-- =====================================================================

-- Los permisos nombrados que traen los módulos ya especificados.
INSERT INTO sistema.acciones (codigo,nombre,orden,es_sensible,modulo,descripcion) VALUES
 ('REGISTRAR_CONTACTO',       'Registrar contacto de seguimiento', 10,false,'crm',
  'Deja constancia de una llamada, visita o mensaje en la línea de tiempo.'),
 ('CONVERTIR_MIEMBRO',        'Convertir un nuevo en miembro',     11,false,'crm',
  'Pasa a la persona de la bandeja de nuevos al registro maestro.'),
 ('VER_METRICAS_NUEVOS',      'Ver métricas de crecimiento',       12,false,'crm',
  'Tablero agregado del embudo. No expone fichas individuales.'),
 ('REGISTRAR_APORTE',         'Registrar un aporte',               20,false,'aportes',
  'Digitar un diezmo, ofrenda o donación recibida.'),
 ('CONFIRMAR_APORTE',         'Confirmar un aporte',               21,true ,'aportes',
  'Validar contra el extracto o la pasarela. Separado de digitar a propósito.'),
 ('EXPEDIR_CERTIFICADO',      'Expedir certificado tributario',    22,true ,'aportes',
  'Emite el documento legal y CONGELA los aportes incluidos.'),
 ('ANULAR_CERTIFICADO',       'Anular certificado',                23,true ,'aportes',
  'Solo Tesorería, y siempre con motivo escrito.'),
 ('VER_NOTAS_CONFIDENCIALES', 'Ver notas de consejería',           30,true ,'consejeria',
  'Solo sobre los casos asignados al consejero.'),
 ('ENTREGAR_MENOR',           'Entregar un menor a su acudiente',  40,true ,'rocakids',
  'Exige acudiente autorizado y código verificado.');


-- El rol que su documento define y a nosotros nos faltaba.
INSERT INTO identidad.roles (codigo,nombre,alcance_maximo,nivel_maximo,descripcion) VALUES
 ('COORDINADOR_NUEVOS','Coordinador de Nuevos','sede',2,
  'Recibe la bandeja de nuevos de su sede, los contacta y los acompaña hasta la decisión.')
ON CONFLICT DO NOTHING;

INSERT INTO sistema.matriz_permisos (rol,modulo,accion,acta_ref) VALUES
 ('COORDINADOR_NUEVOS','crm','ver','Empalme M-Nuevos'),
 ('COORDINADOR_NUEVOS','crm','crear','Empalme M-Nuevos'),
 ('COORDINADOR_NUEVOS','crm','REGISTRAR_CONTACTO','Empalme M-Nuevos'),
 ('COORDINADOR_NUEVOS','crm','CONVERTIR_MIEMBRO','Empalme M-Nuevos'),
 ('COORDINADOR_NUEVOS','personas','ver','Empalme M-Nuevos'),
 ('PASTOR_CONGREGACIONAL','crm','CONVERTIR_MIEMBRO','Empalme M-Nuevos'),
 ('PASTOR_DIRECTOR_GENERAL','crm','VER_METRICAS_NUEVOS','Empalme M-Nuevos'),
 ('TESORERIA','aportes','REGISTRAR_APORTE','Empalme M-Donaciones'),
 ('TESORERIA','aportes','EXPEDIR_CERTIFICADO','Empalme M-Donaciones'),
 ('TESORERIA','aportes','ANULAR_CERTIFICADO','Empalme M-Donaciones'),
 ('CONTABILIDAD','aportes','CONFIRMAR_APORTE','Empalme M-Donaciones'),
 ('CONSEJERO','consejeria','VER_NOTAS_CONFIDENCIALES','Empalme M-Roles'),
 ('MAESTRO_ROCAKIDS','rocakids','ENTREGAR_MENOR','Empalme M-Roles');

