-- Catálogos base. No son datos de la iglesia: son la estructura que la
-- base necesita para aceptar el primer dato real.

INSERT INTO org.paises VALUES
  ('CO','Colombia','ley_1581_co','America/Bogota'),
  ('PA','Panamá','otro','America/Panama'),
  ('ES','España','gdpr_eu','Europe/Madrid'),
  ('US','Estados Unidos','otro','America/New_York')
ON CONFLICT DO NOTHING;

-- 16 tipos de documento (multi-país).
INSERT INTO nucleo.tipos_documento (codigo,nombre,pais,de_menor) VALUES
  ('CC','Cédula de ciudadanía','CO',false),
  ('TI','Tarjeta de identidad','CO',true),
  ('RC','Registro civil','CO',true),
  ('CE','Cédula de extranjería','CO',false),
  ('PA','Pasaporte',NULL,false),
  ('PEP','Permiso especial de permanencia','CO',false),
  ('PPT','Permiso por protección temporal','CO',false),
  ('NIT','NIT','CO',false),
  ('DNI','DNI','ES',false),
  ('NIE','NIE','ES',false),
  ('SSN','Social Security Number','US',false),
  ('ITIN','ITIN','US',false),
  ('CIP','Cédula de identidad personal','PA',false),
  ('MEN','Documento de menor sin identificación',NULL,true),
  ('SIN','Sin documento',NULL,false),
  ('OTR','Otro',NULL,false)
ON CONFLICT DO NOTHING;

-- Tipos de vínculo. `confiere_custodia` es lo que habilita ser acudiente.
INSERT INTO nucleo.tipos_vinculo (codigo,nombre,confiere_custodia) VALUES
  ('PADRE','Padre',true), ('MADRE','Madre',true),
  ('HIJO','Hijo',false),  ('HIJA','Hija',false),
  ('CONYUGE','Cónyuge',false),
  ('ABUELO','Abuelo',true), ('ABUELA','Abuela',true),
  ('NIETO','Nieto',false),
  ('HERMANO','Hermano',false), ('HERMANA','Hermana',false),
  ('TIO','Tío',true), ('TIA','Tía',true),
  ('SOBRINO','Sobrino',false),
  ('TUTOR','Tutor legal',true),
  ('ACUDIENTE','Acudiente autorizado',true),
  ('CUIDADOR','Cuidador',true),
  ('PRIMO','Primo',false),
  ('SUEGRO','Suegro',false), ('SUEGRA','Suegra',false),
  ('YERNO','Yerno',false), ('NUERA','Nuera',false),
  ('PADRASTRO','Padrastro',true), ('MADRASTRA','Madrastra',true),
  ('OTRO','Otro vínculo',false)
ON CONFLICT DO NOTHING;

-- Los 14 roles. `nivel_maximo` es el techo: define quién puede ver un
-- diezmo (N3), una nota pastoral (N3) o la ficha de un menor (N4).
INSERT INTO identidad.roles (codigo,nombre,alcance_maximo,nivel_maximo,descripcion) VALUES
  ('PASTOR_DIRECTOR_GENERAL','Pastor Director General','organizacion',4,'Única persona con visibilidad de aporte por persona en toda la organización.'),
  ('PASTOR_CONGREGACIONAL','Pastor Congregacional','sede',2,'Opera su sede. Ve SI una familia aporta y con qué frecuencia, nunca el monto.'),
  ('DIRECTOR_MINISTERIO','Director de Ministerio','ministerio',2,'Dirige un ministerio dentro de su sede.'),
  ('COORDINADOR','Coordinador','ministerio',2,'Coordina equipos y grupos de un ministerio.'),
  ('LIDER_GRUPO','Líder de grupo','grupo',2,'Acompaña a los miembros de su grupo.'),
  ('CONSEJERO','Consejero','caso_propio',3,'Accede solo a los casos de consejería que le fueron asignados.'),
  ('MAESTRO_ROCAKIDS','Maestro RocaKids','ministerio',4,'Check-in y entrega segura de menores en su sede.'),
  ('TESORERIA','Tesorería','sede',3,'Ve el agregado de aportes de su sede, sin detalle por persona.'),
  ('CONTABILIDAD','Contabilidad','organizacion',3,'Conciliación contable. Ve montos, no notas pastorales.'),
  ('TALENTO_HUMANO','Talento Humano','organizacion',3,'Empleados y contratos. Separado de lo pastoral por diseño.'),
  ('SECRETARIA','Secretaría','sede',2,'Gestión administrativa y certificados.'),
  ('MIEMBRO','Miembro','persona_propia',2,'Ve y corrige su propia ficha.'),
  ('ACUDIENTE','Acudiente','persona_propia',4,'Ve la ficha de los menores a su cargo, y solo la de ellos.'),
  ('INTEGRACION_TECNICA','Integración técnica','organizacion',1,'Cuentas de servicio. Jamás accede a datos sensibles.')
ON CONFLICT DO NOTHING;

INSERT INTO crm.tipos_hecho (codigo,nombre,modulo,nivel) VALUES
  ('PRIMERA_VISITA','Primera visita','crm',2),
  ('LLAMADA','Llamada de seguimiento','crm',2),
  ('VISITA_PASTORAL','Visita pastoral','crm',2),
  ('CAMBIO_ETAPA','Cambio de etapa del recorrido 4C','crm',2),
  ('INGRESO_GRUPO','Ingreso a un grupo','grupos',2),
  ('ASISTENCIA','Asistencia a un servicio','asistencia',2),
  ('CURSO_INICIADO','Inicio de curso','formacion',2),
  ('CURSO_CERTIFICADO','Certificación de curso','formacion',2),
  ('NOTA_PASTORAL','Nota pastoral','crm',3),
  ('CASO_CONSEJERIA','Apertura de caso de consejería','consejeria',3),
  ('APORTE','Aporte registrado','aportes',3),
  ('CHECKIN_ROCAKIDS','Check-in de menor','rocakids',4),
  ('ENTREGA_ROCAKIDS','Entrega de menor a acudiente','rocakids',4)
ON CONFLICT DO NOTHING;
