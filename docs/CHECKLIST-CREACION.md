# CHECKLIST DE CREACIÓN · Sistema eclesial multisede con central

> Norma de construcción para un sistema administrado desde una central, con 36 sedes y 25.000 congregantes.
> Versión 1.0 · 19 de septiembre de 2026 · Aivor para Casa Sobre la Roca.
> Este documento NO describe lo que hay: describe lo que **debe haber**. El estado real se audita contra él en `AUDITORIA-19sep2026.md`.

---

## Cómo se usa este checklist

Cada ítem tiene un código (`B3.10`) para que una auditoría lo pueda citar. Cada ítem se marca:

| Marca | Significa |
|---|---|
| ✅ | Cumplido **con evidencia**: una prueba que falla si alguien lo rompe, o un documento con fecha y responsable |
| 🟠 | Cumplido con hueco, y el hueco está **justificado por escrito** en `docs/DECISIONES/` |
| 🔴 | No existe |

**Tres reglas que no se negocian:**

1. Una afirmación no es evidencia. «Está seguro» no vale; vale la corrida con fecha.
2. Un 🔴 en los bloques **B1, B2, B4, B5, B6 o B11** bloquea el go-live, aunque el sistema funcione.
3. Lo que no está escrito, no existe. Si no está el runbook, el sistema no se puede operar aunque hoy funcione.

**Definición de terminado:** el producto no está listo cuando funciona en la máquina de quien lo construyó. Está listo cuando la sede de Chía lo usa un domingo sin llamar a nadie, y cuando quien lo construyó puede desaparecer sin que el sistema se caiga.

---

## B0 · FICHA FUNDACIONAL
*Las decisiones que cuestan caro cambiar después. Se toman ANTES de la primera línea de código.*

- **B0.01** Problema y trabajo a resolver, escritos en una frase que un pastor entienda sin traducción.
- **B0.02** Censo de perfiles de usuario con cuántos hay de cada uno: pastor principal, pastor de sede, líder de grupo, maestro de niños, tesorero, recepción, voluntario, congregante. Un sistema para 40 pastores y otro para 4.000 voluntarios no son el mismo sistema.
- **B0.03** Volumetría declarada: personas, sedes, servicios por semana, check-ins por domingo, aportes por mes, crecimiento a tres años. Toda decisión de índice, partición y costo sale de aquí.
- **B0.04** **Pico declarado.** El domingo a las 10:00 no es el promedio: son 36 sedes registrando a la misma hora. El sistema se dimensiona contra el pico, no contra el promedio.
- **B0.05** Perfil de infraestructura elegido por escrito (A gestionado ligero · B servidor propio · C serverless · D plataforma del cliente) con el costo del peor caso al mes.
- **B0.06** Residencia del dato decidida (región de nube) y el costo diferencial de esa decisión, firmado por quien lo paga.
- **B0.07** SLA objetivo **por módulo**. El check-in de niños un domingo no tolera lo que tolera un reporte de fin de mes.
- **B0.08** RPO y RTO declarados en horas y firmados por quien asume la pérdida. «Cuántos datos podemos perder» es una decisión de la mesa, no del ingeniero.
- **B0.09** Quién es el **Responsable del Tratamiento** ante la ley: la corporación central o cada iglesia. Cambia el modelo de consentimiento completo y quién responde ante la autoridad.
- **B0.10** Presupuesto anual de operación y **quién lo paga**. Un sistema sin dueño del costo se apaga solo a los seis meses.
- **B0.11** Diagrama de arquitectura de una sola lámina, que un ajeno entienda: qué corre dónde y cuánto cuesta.
- **B0.12** Registro de decisiones (ADR) abierto desde el día uno. Toda decisión irreversible con fecha, alternativas descartadas y razón.
- **B0.13** Definición de terminado escrita y aceptada por la mesa antes de empezar.
- **B0.14** **Bus factor.** Quién más, con nombre propio, puede levantar esto si quien lo construye desaparece mañana.

---

## B1 · TENANCY Y ORGANIZACIÓN
*36 sedes y una central con muchos equipos. Aquí se decide si el sistema crece o se rompe en la sede 37.*

- **B1.01** Unidad de aislamiento definida y justificada por escrito: base compartida con seguridad por fila, esquema por sede, o base por sede. Con el costo de cada opción a 36 y a 100 sedes.
- **B1.02** Sede como entidad de primera clase: código estable, tipo, país, huso horario, estado, y clave foránea obligatoria en todo lo demás.
- **B1.03** **Jerarquía de más de dos niveles:** red → región o distrito → sede → campus. Con 36 sedes, el rol «supervisor de ocho iglesias» aparece el primer año. Si el modelo solo tiene sede, ese rol no existe y se resuelve dando acceso a toda la red, que es exactamente la fuga.
- **B1.04** **La central modelada como central**, no como una sede más. Sus equipos (finanzas, comunicaciones, TI, legal, formación, talento humano, misiones, construcción) son unidades organizativas con líder, miembros y alcance declarado.
- **B1.05** **El equipo es sujeto de permiso:** un rol se puede otorgar sobre un equipo de la central, no solo sobre una sede o un ministerio.
- **B1.06** Membresía de equipo con vigencia. Quien sale del equipo pierde el acceso sin que nadie se acuerde de quitárselo.
- **B1.07** Toda tabla de negocio lleva la columna de sede. Sin excepción, y verificado por una vista de control, no por memoria.
- **B1.08** **Dato de red contra dato de sede**, escrito tabla por tabla: catálogos, plantillas, roles y contenido formativo son de la red; personas, aportes y asistencia son de la sede.
- **B1.09** Alta de una sede nueva en un solo acto, desde plantilla y con bitácora. Nadie crea una iglesia a mano.
- **B1.10** **Plantilla de arranque por tipo de sede:** con qué módulos, qué roles y qué catálogos nace. Esto es «todas las iglesias con el mismo sistema inicial», hecho dato y no costumbre.
- **B1.11** Baja, fusión y cierre de sede resueltos: qué pasa con las personas, los aportes y los casos abiertos. Una sede nunca se borra: se marca y se conserva.
- **B1.12** Cuotas por sede (almacenamiento, usuarios, envíos) y qué ocurre cuando se superan.
- **B1.13** Cambio de nombre o de código de una sede sin romper el linaje histórico.
- **B1.14** **Prueba automática:** una sede sin una sola persona registrada no ve ni una fila de otra, en ninguna tabla, corriendo como el rol de la aplicación.

---

## B2 · LA PERSONA
*El dato maestro. Todo lo demás lo referencia, así que un error aquí se multiplica por trece módulos.*

- **B2.01** Una persona, un identificador, en toda la red. No un registro por sede.
- **B2.02** ⭐ **Membresía persona × sede en TABLA, con vigencia, tipo (miembro, visitante, en traslado, servidor) y motivo.** Nunca en una columna mutable: una columna de sede **reescribe el pasado** cada vez que alguien se muda, y cambia retroactivamente quién puede ver su historia.
- **B2.03** Asistencia a más de una sede soportada: el que congrega en una y sirve en otra existe y es común.
- **B2.04** **Traslado como proceso:** quién lo solicita, quién lo aprueba, qué historia viaja y qué historia **no** viaja. La consejería no viaja sin consentimiento nuevo.
- **B2.05** **Deduplicación** con regla de coincidencia declarada (documento, nombre normalizado, fecha de nacimiento, teléfono) y búsqueda por similitud, no solo por igualdad exacta. Con 36 fuentes, los duplicados son certeza.
- **B2.06** Fusión de duplicados reversible, con bitácora, y con supervivencia de las referencias (aportes, certificados, asistencia, casos).
- **B2.07** **Persona sin documento soportada:** menores, extranjeros, visitantes. Si el documento es obligatorio, medio censo no entra al sistema.
- **B2.08** **Persona sin correo y sin celular soportada.** Si el contacto es obligatorio, los adultos mayores y los niños quedan fuera, y alguien los pondrá en un Excel aparte.
- **B2.09** Nombre legal y nombre preferido separados. Apellidos compuestos y de casada soportados.
- **B2.10** Vínculos familiares como grafo con vigencia (padre, madre, cónyuge, acudiente, hermano), no como columnas.
- **B2.11** Hogar o núcleo familiar como entidad con dirección, y miembros que entran y salen.
- **B2.12** Ciclo de vida declarado con sus transiciones: visitante, nuevo, en proceso, miembro, servidor, líder, inactivo, trasladado, fallecido.
- **B2.13** **Fallecimiento tratado con dignidad:** se conserva, no se borra, y deja de recibir comunicaciones automáticamente. Un mensaje de cumpleaños a un difunto cuesta la confianza de una familia.
- **B2.14** Borrado lógico en todas partes, con quién y cuándo. El borrado físico solo por orden legal y con acta.
- **B2.15** Linaje: de qué sistema y con qué identificador llegó cada fila.
- **B2.16** **Búsqueda útil:** por nombre parcial, sin tildes, tolerando errores de digitación, por teléfono y por documento, en menos de 300 ms sobre el censo completo. Una búsqueda que no encuentra a «Jhon» cuando escriben «Jon» genera el duplicado.

---

## B3 · MODELO DE DATOS MODULAR
*Que agregar una casilla o un módulo no obligue a una migración y un despliegue. Esto es lo que separa un producto de un proyecto.*

- **B3.01** **Registro de módulos (manifiesto):** código, esquema, nivel de dato, si es de núcleo, de qué depende y si exige compuerta legal.
- **B3.02** Activación por sede, con evidencia y bitácora. Un módulo apagado no deja datos visibles ni huérfanos.
- **B3.03** **Un módulo nuevo se declara, no se programa en el núcleo.** Prueba: dar de alta un módulo de ejemplo sin tocar una línea del núcleo.
- **B3.04** **Casillas propias con gobierno:** cada atributo nuevo declara su módulo dueño, su tipo y su nivel de sensibilidad. Sin nivel declarado no se crea. Una tabla de campos extra sin gobierno es el cajón donde termina el dato sensible sin etiqueta.
- **B3.05** ⭐ **Catálogos de negocio en TABLA, no en tipo enumerado del motor.** Un enumerado obliga a migración y despliegue para agregar «culto de jóvenes» como tipo de servicio, y no deja borrar ni renombrar un valor. Reservar el enumerado solo para lo estructural que no cambia nunca.
- **B3.06** Todo catálogo con código estable, etiqueta editable, orden, vigencia, y marca de si es de red o de sede.
- **B3.07** **Línea de tiempo única de la persona:** todo módulo publica ahí lo que pasa. Es lo que evita que cada módulo invente su propio historial y que nadie pueda contar la historia completa de alguien.
- **B3.08** Contrato de evento versionado: qué publica cada módulo y qué garantiza.
- **B3.09** Tablas de alto volumen particionadas desde el día uno: auditoría, línea de tiempo, asistencia, notificaciones.
- **B3.10** ⭐ **Creación automática de la próxima partición y partición por defecto.** Una partición que se acaba es una caída total con fecha exacta en el calendario, y ocurre a la medianoche del 1 de enero, cuando no hay nadie.
- **B3.11** Política de retención por tabla, con archivado y purga automatizados y probados.
- **B3.12** Índices justificados por consulta real. Lista escrita de las veinte consultas que se corren mil veces al día.
- **B3.13** Migraciones numeradas, idempotentes, con reversión escrita, probadas desde cero en máquina limpia.
- **B3.14** Diccionario de datos publicado y **generado desde la base**, no mantenido a mano.
- **B3.15** Clasificación de sensibilidad columna por columna, consultable.
- **B3.16** Las invariantes del negocio se rechazan en el motor, no solo en la aplicación. Lo que la base no impide, tarde o temprano entra.
- **B3.17** Cero valores mágicos y cero texto libre donde debe haber catálogo.
- **B3.18** Dinero jamás en punto flotante. Cantidad, moneda y fecha con el tipo correcto.
- **B3.19** Todo instante se almacena con zona horaria y se muestra en la de la sede.

---

## B4 · IDENTIDAD, AUTENTICACIÓN Y ACCESO
*Si esta capa falla, todo el trabajo de las otras trece es decorativo.*

- **B4.01** ⭐ **Proveedor de identidad real.** La identidad **nunca** llega en una cabecera de la petición ni en el almacenamiento del navegador. Un permiso que se puede editar con el inspector no es un permiso.
- **B4.02** Vínculo cuenta ↔ persona explícito. No toda persona tiene cuenta, y no toda cuenta es una persona.
- **B4.03** **Segundo factor obligatorio** para la central, tesorería, menores y todo rol con nivel alto de sensibilidad.
- **B4.04** Sesión con expiración corta, refresco rotado y revocación efectiva, incluido «cerrar sesión en todos los dispositivos».
- **B4.05** Contraseñas con derivación moderna, longitud mínima y bloqueo por intentos.
- **B4.06** **Permiso efectivo = rol × alcance × nivel de sensibilidad × vigencia.** Los cuatro, siempre. Tres no bastan.
- **B4.07** Matriz de permisos explícita módulo × acción × rol, consultable y auditable.
- **B4.08** Techo por rol: ninguna asignación supera el nivel del rol, ni escribiéndola a mano en la base.
- **B4.09** **La aplicación no puede subirse su propio techo:** el rol con el que corre la API no escribe la matriz de permisos.
- **B4.10** **Doble cerradura:** política en la aplicación más seguridad por fila en la base, con el contexto fijado por transacción.
- **B4.11** Las pruebas de aislamiento corren **como el rol de la aplicación**. Probarlo como superusuario no demuestra nada, porque el superusuario salta la seguridad por fila.
- **B4.12** Vista de control que delata cualquier tabla legible sin una sola política. El control se pone donde están todos los datos, no donde se está mirando.
- **B4.13** Delegación temporal (suplencia por vacaciones) con fecha de fin obligatoria.
- **B4.14** Actuar en nombre de otro prohibido por defecto. Si se habilita para soporte: con consentimiento, tiempo límite y bitácora visible para el suplantado.
- **B4.15** Ruptura de cristal documentada, con alerta inmediata a un tercero.
- **B4.16** Acceso atado al voluntariado o al contrato: cuando termina, el acceso cae solo.
- **B4.17** **Recertificación de accesos cada trimestre**, con evidencia de quién revisó y qué quitó.
- **B4.18** Separación de funciones: quien otorga permisos no es quien audita los permisos.
- **B4.19** Cuenta de servicio por integración, con permiso mínimo y llave rotada.
- **B4.20** **Prueba de abuso ejecutada:** intentar ver otra sede, subir de nivel, leer un caso de consejería ajeno, exportar menores. Con el resultado guardado.

---

## B5 · PRIVACIDAD, MENORES Y CUMPLIMIENTO
*Una iglesia guarda lo que la gente no le cuenta a nadie más. Y la mitad de sus usuarios son menores.*

- **B5.01** Niveles de sensibilidad declarados (de público a crítico) y aplicados columna por columna.
- **B5.02** Consentimiento por **finalidad y canal**, solo de agregar, con evidencia y fecha. Sin registro, no se contacta.
- **B5.03** Revocación del consentimiento efectiva en **todos** los canales, no solo en el que se revocó.
- **B5.04** Aviso de privacidad y política de tratamiento publicados y versionados, guardando qué versión aceptó cada titular.
- **B5.05** ⭐ **Registro de las bases de datos ante la autoridad** (en Colombia, el RNBD de la SIC) con fecha y constancia. Es obligación legal para quien trata datos de 25.000 titulares, no una recomendación.
- **B5.06** Procedimiento de **consulta y reclamo del titular** con los plazos de ley y un responsable con nombre y correo publicado.
- **B5.07** Derecho de supresión resuelto técnicamente: qué se borra, qué se anonimiza y qué se conserva por obligación contable.
- **B5.08** **Menores: acudiente obligatorio y verificado.** Un menor sin acudiente hace fallar la transacción, no genera una advertencia.
- **B5.09** Entrega de menores con código de un solo uso, cifrado, que nunca se devuelve en una consulta.
- **B5.10** **Nadie exporta datos de menores.** Ni el administrador del sistema. Con prueba que lo demuestre.
- **B5.11** ⭐ **Política de salvaguarda de menores:** verificación de antecedentes de todo voluntario que sirve con niños, con vigencia y renovación, registrada en el sistema **como requisito para poder asignar el rol**. El sistema debe impedir asignar un maestro de niños sin antecedentes vigentes.
- **B5.12** Regla de dos adultos por sala y registro de quién estuvo en cada sala, cada servicio.
- **B5.13** Salud, discapacidad y alergias tratadas como categoría especial: acceso nominal y bitácora de lectura.
- **B5.14** Consejería aislada del resto: ni el pastor de otra sede ni el administrador de sistemas leen las notas.
- **B5.15** **Bitácora de lectura** sobre los datos sensibles, no solo de escritura. Saber quién miró importa tanto como saber quién cambió.
- **B5.16** Auditoría solo de agregar e inmutable, que ni la aplicación ni el administrador alteran.
- **B5.17** Transferencia internacional evaluada para las sedes fuera del país, con su régimen propio.
- **B5.18** Contratos con encargados (nube, mensajería, pasarela) con cláusula de tratamiento de datos firmada.
- **B5.19** Plan de respuesta a incidentes con el deber de notificación, y **un simulacro hecho**.
- **B5.20** Cláusula explícita de uso de inteligencia artificial y datos del usuario, y aviso visible cuando quien responde es una IA.

---

## B6 · SEGURIDAD TÉCNICA

- **B6.01** HTTPS en todo, con redirección permanente y HSTS.
- **B6.02** Cabeceras de seguridad completas y CORS con lista blanca. **Jamás asterisco** en una API que mueve datos sensibles.
- **B6.03** Validación estricta de toda entrada, en el borde, con esquema declarado.
- **B6.04** Las diez de OWASP marcadas una por una, con quién lo verificó.
- **B6.05** Referencias directas inseguras cerradas: pedir el identificador de otro no devuelve su fila.
- **B6.06** Límite de tasa por usuario y por dirección, con límite especial en las puertas públicas.
- **B6.07** Protección contra automatización en los formularios públicos.
- **B6.08** Cifrado en reposo y en tránsito. Los campos críticos, cifrados por columna.
- **B6.09** ⭐ **La llave de cifrado vive en el gestor de llaves.** Nunca en el código, nunca en una variable de entorno, y nunca en la propia base que cifra.
- **B6.10** Rotación de llaves y secretos con procedimiento escrito y fecha de la última rotación.
- **B6.11** Secretos fuera del repositorio, con escaneo automático que impide subirlos.
- **B6.12** Dependencias auditadas y actualizadas, con alerta automática.
- **B6.13** Archivos subidos validados por tipo real, tamaño y antivirus, guardados en almacenamiento privado y servidos con URL firmada.
- **B6.14** Exportaciones controladas: quién puede, qué campos salen, con marca de agua y bitácora.
- **B6.15** Copias de seguridad cifradas.
- **B6.16** **Prueba de intrusión externa antes del go-live.** Lo diseñado cubriendo los controles no certifica que lo construido los cumpla.
- **B6.17** Superficie mínima: cero puertos innecesarios y cero endpoints de depuración en producción.
- **B6.18** Mensajes de error que no filtran la estructura interna.

---

## B7 · BACKEND Y CONTRATO DE API

- **B7.01** Capas separadas: controladores, servicios, repositorios. Un servicio por integración externa.
- **B7.02** API versionada y documentada con especificación **generada**, no escrita a mano.
- **B7.03** El frontend jamás habla directo con un tercero.
- **B7.04** Identificador de traza por petición, en todo log y devuelto al cliente para soporte.
- **B7.05** Errores centralizados, con códigos estables y mensaje en humano con la acción siguiente.
- **B7.06** Paginación, filtro y orden en toda lista. Ninguna respuesta abierta.
- **B7.07** **Idempotencia** en toda escritura repetible. Un doble clic no crea dos aportes.
- **B7.08** Colas para lo pesado (envíos, certificados, exportaciones, importaciones) con máquina de estados y reintento.
- **B7.09** Webhooks entrantes con verificación de firma y ventana de tiempo.
- **B7.10** Endpoint de salud que valide base, cache y dependencias, no que devuelva «ok» siempre.
- **B7.11** Tareas programadas con registro de ejecución y **alerta si no corren**. Una rutina que deja de correr en silencio es peor que una que falla.
- **B7.12** Zona horaria y calendario de servicios por sede resueltos en el servidor.
- **B7.13** Ninguna ruptura del contrato sin versión nueva y sin aviso.

---

## B8 · FRONTEND Y EXPERIENCIA

- **B8.01** Estética elegida a propósito y coherente con la identidad de la iglesia.
- **B8.02** Móvil primero de verdad: el líder registra desde el celular, de pie, en el pasillo, con una mano.
- **B8.03** Rutas y menús **por permiso**, no contra una lista cableada en el cliente.
- **B8.04** Estados de vacío, carga y error en cada vista, con la acción siguiente.
- **B8.05** Accesibilidad AA: contraste, foco visible, teclado, lectores de pantalla.
- **B8.06** ⭐ **Funciona con mala señal.** El check-in del domingo no puede depender del wifi del templo: cola local y sincronización al reconectar.
- **B8.07** Tolerancia a la doble pulsación y a la conexión intermitente.
- **B8.08** Impresión de etiquetas y escaneo de código probados con el **hardware real** de las sedes.
- **B8.09** Tiempo de registro medido en segundos. Si registrar a un visitante toma más de 30 segundos, nadie lo usará y volverá el papel.
- **B8.10** Textos en el idioma de la gente, sin jerga técnica.
- **B8.11** Un solo lugar para cada cosa. Dos pantallas que hacen lo mismo se vuelven dos verdades.
- **B8.12** Versión visible en pantalla, para que el soporte sepa qué está mirando el usuario.

---

## B9 · MÓDULOS DEL DOMINIO
*El catálogo mínimo, y lo que cada módulo exige de propio. Un módulo que no declara esto no está diseñado.*

- **B9.01** **Personas y familias.** Exige deduplicación, vínculos y hogar.
- **B9.02** **Nuevos y seguimiento.** Exige que nadie se pierda: bandeja con atrasados y un responsable con nombre, no una lista.
- **B9.03** **Asistencia.** Exige conteo rápido y agregado por servicio, sin obligar a registrar persona por persona.
- **B9.04** **Grupos y hogares.** Exige jerarquía de liderazgo y multiplicación: un grupo que nace de otro conserva su origen.
- **B9.05** **Niños.** Exige acudiente, código de entrega, sala, condiciones médicas y proporción adulto/niño.
- **B9.06** **Formación.** Exige cohortes, prerrequisitos, certificados y quién enseña.
- **B9.07** **Consejería.** Exige aislamiento fuerte, consentimiento propio y retención distinta al resto.
- **B9.08** **Aportes y donaciones.** Exige conciliación al peso, certificados anuales, fondos con destinación, y **segregación de funciones**: quien recibe no es quien registra ni quien concilia.
- **B9.09** **Talento y voluntariado.** Exige cargo, vigencia, antecedentes y baja automática del acceso.
- **B9.10** **Comunicaciones.** Exige consentimiento por canal, plantilla versionada y registro de envío.
- **B9.11** **Calendario y recursos.** Exige reserva de espacios sin choque.
- **B9.12** **Tareas y peticiones internas.** Exige responsable y fecha, o es una lista de deseos.
- **B9.13** **Analítica.** Exige vistas sin dato sensible y cifras que cuadren con el módulo de origen.
- **B9.14** **Consola de sistemas.** Exige que encender un módulo sea un acto con bitácora, no un despliegue.
- **B9.15** **Todo módulo declara**, antes de construirse: su nivel de dato, su retención, quién lo ve, qué publica en la línea de tiempo y qué pasa si se apaga.

---

## B10 · DINERO E INTEGRACIONES

- **B10.01** Pasarela con conciliación diaria y estado de cada transacción.
- **B10.02** Eventos de pasarela idempotentes y firmados.
- **B10.03** Reembolsos y contracargos modelados, no improvisados.
- **B10.04** Certificado de donación anual con los requisitos fiscales del país.
- **B10.05** Fondos con destinación específica y control de que no se mezclen.
- **B10.06** Cierre contable por período, que se congela y no se reabre sin acta.
- **B10.07** Integración contable definida y conciliada.
- **B10.08** Mensajería con costo por envío visible y tope por sede.
- **B10.09** Toda integración con tiempo de espera, reintento, disyuntor y modo degradado.
- **B10.10** Ninguna integración guarda su llave en el código.

---

## B11 · INFRAESTRUCTURA Y OPERACIÓN
*Un proyecto sin esta columna no está terminado aunque funcione.*

- **B11.01** Tres ambientes reales y separados. «Staging es producción» no es un ambiente.
- **B11.02** Infraestructura como código, **aplicada**, con estado remoto y bloqueo. Escrita y sin aplicar es documentación, no infraestructura.
- **B11.03** Inventario de recursos con identificador y costo, en un documento vivo.
- **B11.04** Despliegue en un comando y reversión en menos de cinco minutos, ensayada.
- **B11.05** Integración continua con lint, pruebas y migraciones en cada cambio. Sin pasar, no hay fusión.
- **B11.06** ⭐ Copias diarias con retención declarada **y una restauración ejecutada de verdad**, con fecha y duración. Una copia que nunca se restauró no es una copia.
- **B11.07** Plan de recuperación ante desastre probado, no escrito.
- **B11.08** Logs centralizados con retención, y sin dato sensible en claro.
- **B11.09** Alertas a un canal que alguien lee, con umbral y responsable.
- **B11.10** Monitoreo externo de disponibilidad, fuera de la propia infraestructura.
- **B11.11** Tablero de negocio y tablero técnico, separados.
- **B11.12** Presupuesto con alerta de costo, y costo por sede visible.
- **B11.13** ⭐ **Capacidad probada contra el pico real:** las 36 sedes el domingo a las 10:00.
- **B11.14** ⭐ **Guardia declarada para el domingo.** Si el sistema falla a las 9:00 a.m., quién contesta y en cuánto tiempo.
- **B11.15** Runbook que un ajeno puede seguir: arrancar, parar, restaurar, rotar la llave, agregar una sede, atender una caída.
- **B11.16** Ventana de mantenimiento que jamás cae en domingo.
- **B11.17** Estado del servicio visible para las sedes, sin tener que preguntar.

---

## B12 · CALIDAD Y EVIDENCIA

- **B12.01** Cada garantía del diseño tiene una prueba que **falla** si alguien la rompe.
- **B12.02** Pruebas de aislamiento por sede corriendo como la aplicación.
- **B12.03** Pruebas de integración de la API sobre base real.
- **B12.04** Pruebas de punta a punta de los cinco flujos que sostienen el domingo.
- **B12.05** Pruebas de carga con el pico declarado en B0.04.
- **B12.06** Pruebas de accesibilidad automáticas.
- **B12.07** Regresión obligatoria antes de cada entrega.
- **B12.08** **Datos de prueba sintéticos.** Jamás personas reales en un ambiente que no es producción.
- **B12.09** Cobertura declarada, con el umbral que bloquea la entrega.
- **B12.10** Evidencia guardada con fecha: la corrida, no la afirmación.

---

## B13 · MIGRACIÓN Y CORTE

- **B13.01** Inventario de fuentes: qué sistema, qué hoja de cálculo y qué cuaderno tienen datos hoy.
- **B13.02** Mapa campo a campo de cada fuente al modelo, con las divergencias escritas y decididas.
- **B13.03** Olas de migración por sede, con criterio y orden.
- **B13.04** Carga con linaje: toda fila sabe de dónde vino.
- **B13.05** **Reconciliación aritmética:** una vista dice si lo migrado cuadra, al peso y a la persona.
- **B13.06** Tablero de calidad de dato: completitud, duplicados, huérfanos.
- **B13.07** Ensayo de migración completo sobre copia, cronometrado.
- **B13.08** Plan de corte con congelamiento, ventana y criterio de reversión escrito **antes** del corte.
- **B13.09** Convivencia con el sistema anterior definida: cuánto tiempo y cuál manda mientras tanto.
- **B13.10** Apagado del sistema anterior con acta y copia final conservada.

---

## B14 · GOBIERNO, ADOPCIÓN Y SOSTENIBILIDAD

- **B14.01** Dueño del producto con nombre y tiempo asignado.
- **B14.02** **Comité de datos que decide qué se recoge y qué no.** La disciplina de no recoger es la que protege.
- **B14.03** Registro de decisiones al día.
- **B14.04** Capacitación por rol, con una persona entrenada **por sede**.
- **B14.05** Manual de la sede y guía rápida de una página por rol.
- **B14.06** Mesa de ayuda con canal, horario y tiempo de respuesta comprometido.
- **B14.07** Changelog visible para las sedes.
- **B14.08** Métricas de adopción por sede: si una sede dejó de usarlo, se sabe en una semana.
- **B14.09** Canal de mejoras y encuesta de satisfacción.
- **B14.10** Traspaso documentado: credenciales por canal seguro y accesos a nombre de la **organización**, no de una persona.
- **B14.11** Propiedad del código y de los datos escrita en el contrato.
- **B14.12** **Continuidad: el sistema sobrevive a quien lo construyó.**

---

## COMPUERTAS · no se avanza sin cumplirlas

| Compuerta | Se cierra cuando |
|---|---|
| **G0 Ficha** | Un lector ajeno entiende qué corre dónde y cuánto cuesta |
| **G1 Datos** | La migración corre desde cero en máquina limpia y el aislamiento se prueba como la aplicación |
| **G2 Infra base** | Un comando levanta el ambiente de pruebas y el inventario lista cada recurso con costo |
| **G3 Backend** | Integración en verde, salud en verde, y el frontend no habla con ningún tercero |
| **G4 Frontend** | Probado en navegador real, móvil y escritorio, con consola limpia |
| **G5 Seguridad** | OWASP marcado, prueba de intrusión sin hallazgos críticos, prueba de abuso ejecutada |
| **G6 IA** | Evaluación con casos reales y degradación de proveedor probada |
| **G7 Operación** | La restauración se hizo de verdad, con fecha, y el runbook lo siguió alguien ajeno |
| **G8 Migración** | Reconciliación al peso y plan de reversión escrito antes del corte |
| **G9 Entrega** | Las 14 secciones auditadas. Una con huecos y no se entrega |

---

## LAS 15 PREGUNTAS CON LAS QUE UN AUDITOR TUMBA EL PROYECTO

Si alguna no tiene respuesta **con evidencia en la mano**, el proyecto no pasa.

| # | Pregunta | Ítem |
|---|---|---|
| 1 | Muéstreme el login. ¿Cómo sabe el sistema quién está pidiendo? | B4.01 |
| 2 | Entre como la sede de Chía y demuéstreme que no ve una fila de Chicó, corriendo como la aplicación y no como administrador | B4.11 |
| 3 | Una persona se traslada de sede. ¿Qué pasa con su historia y con quién puede verla? | B2.02 |
| 4 | ¿Dónde vive la llave que cifra los datos críticos? | B6.09 |
| 5 | Muéstreme la última restauración de una copia: fecha y duración | B11.06 |
| 6 | ¿Qué pasa el 1 de enero del año para el que no hay partición? | B3.10 |
| 7 | Agrégueme una casilla nueva y un tipo de servicio nuevo, ahora, sin desplegar | B3.04 · B3.05 |
| 8 | ¿Quién leyó ayer la ficha de consejería de esta persona? | B5.15 |
| 9 | Exporte la lista de niños. Debe ser imposible, y quiero ver la prueba | B5.10 |
| 10 | ¿Están registradas las bases de datos ante la autoridad? | B5.05 |
| 11 | Un titular pide que lo borren: ¿qué se borra, qué se conserva y en cuántos días? | B5.06 · B5.07 |
| 12 | ¿Cuánto aguanta el domingo a las 10:00 con las 36 sedes? Muéstreme la prueba de carga | B11.13 |
| 13 | Si usted desaparece mañana, ¿quién levanta esto? | B0.14 · B14.12 |
| 14 | ¿Cuánto cuesta al mes y quién lo paga? | B0.10 · B11.12 |
| 15 | ¿Qué hay corriendo en producción que no esté en el repositorio? | B11.02 |

---

## REPORTE OBLIGATORIO EN TODA ENTREGA

| Columna | Estado | Evidencia |
|---|---|---|
| Backend | ✅ 🟠 🔴 | migraciones, pruebas X/Y, especificación, salud |
| Frontend | ✅ 🟠 🔴 | verificación en navegador, móvil y escritorio |
| Infraestructura | ✅ 🟠 🔴 | inventario, ambientes, copia restaurada el ‹fecha›, alerta, costo real |

**Un 🔴 en infraestructura se reporta como «no terminado», sin suavizarlo.**

---

*Norma de Aivor. Toda construcción se mide contra este documento antes de considerarse terminada.*
