#!/usr/bin/env node
/**
 * Genera `api/openapi.yaml` a partir de las RUTAS REALES de la aplicación.
 *
 * ⛔ Por qué generado y no escrito a mano (checklist B7.02): una
 * especificación escrita a mano se desactualiza en la segunda semana, y
 * una especificación desactualizada es peor que ninguna, porque el que la
 * lee construye contra algo que no existe. Aquí se arranca la aplicación,
 * se le pregunta al enrutador qué rutas tiene de verdad, y se escribe eso.
 *
 * `scripts/verificar.sh` compara lo generado con lo versionado: si alguien
 * añade una ruta y no regenera, la verificación falla.
 */
const path = require('path');
const fs = require('fs');
const API = path.join(__dirname, '..', 'api');

process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.APP_JWT_SECRETO = process.env.APP_JWT_SECRETO || 'generacion-de-especificacion-no-usar-0000';
process.env.APP_LLAVE_N4 = process.env.APP_LLAVE_N4 || 'generacion-de-especificacion-no-usar-0000';
// ⛔ Este guion LEVANTA la aplicacion para leerle las rutas, asi que se
//    conecta a la base de verdad. Si hereda el PGUSER de quien lo invoca
//    (verificar.sh exporta el de administrador), arranca como superusuario
//    y la API se niega, con razon: con ese rol RLS no se aplica.
process.env.PGUSER = process.env.PGUSER_API || 'casaroca_api_dev';

const { NestFactory } = require(path.join(API, 'node_modules', '@nestjs', 'core'));
const { AppModule } = require(path.join(API, 'dist', 'src', 'app.module.js'));

/* Descripciones por ruta. Lo único escrito a mano, y si una ruta no la
   tiene, la especificación lo dice en vez de inventarla. */
const DESCRIPCIONES = {
  'POST /api/v1/administracion/recertificar/:asignacionId': ['Recertificar un acceso', 'La puerta que NO existia: `identidad.recertificaciones` llevaba desde la migracion 0045 sin que nadie escribiera en ella, asi que la pantalla del comite trimestral era una lista que no se podia tachar y los dias sin revisar solo podian crecer. Exige veredicto (se_mantiene, se_reduce, se_revoca) y una nota firmada. Un veredicto de «se_revoca» NO se queda en una nota: revoca de verdad.'],
  'POST /api/v1/administracion/sesiones/:id/cerrar': ['Cerrarle la sesion a alguien', '«Sesiones y alertas» era de SOLO LECTURA: se veia quien estaba dentro y no habia forma de echarlo. Exige motivo escrito y surte efecto en el instante, no cuando expire el token. Va por una funcion aparte con guardia, porque la que usa `/auth/salir` no comprueba quien llama (existe para cerrar la propia).'],
  // ── Gobierno de la red (consola del Sistema Master, 20 sep 2026) ──
  'GET /api/v1/administracion/catalogo': ['Catalogo de gobierno', 'Lo que la consola necesita en UNA peticion para pintar las casillas: modulos con su nivel de dato, acciones (las seis generales y las propias de cada modulo), roles con su techo y su alcance, niveles de sensibilidad y tipos de documento vigentes. Los tipos de documento salen del catalogo, no de una lista escrita en el frontend: la central los cambia sin desplegar.'],
  'GET /api/v1/administracion/matriz': ['Que puede hacer un rol, casilla por casilla', 'Devuelve TODAS las combinaciones posibles de modulo x accion para ese rol, marcadas o no. La columna `por_encima` avisa de un permiso que engana: existe en la tabla y no sirve, porque el modulo guarda datos mas sensibles que el techo del rol.'],
  'POST /api/v1/administracion/matriz': ['Marcar o desmarcar una casilla', 'Otorga o quita UNA cosa que un rol puede hacer. Desmarcar borra la fila: un permiso que no esta es un permiso que no existe, no uno apagado. Exige alcance de organizacion.'],
  'POST /api/v1/administracion/roles': ['Crear o cambiar un rol', 'Lo que no se manda NO SE TOCA: omitir la descripcion no la borra y omitir `activo` no resucita un rol descontinuado. Bajar el techo o descontinuar el rol queda escrito en la bitacora con a cuantas personas afecta.'],
  'GET /api/v1/administracion/personas/:id': ['Ficha completa de una persona', 'Su cuenta, sus roles vigentes con el acta que los autoriza y los equipos a los que pertenece. Es lo que se abre al pulsar a alguien en la consola.'],
  'GET /api/v1/administracion/sedes/:id': ['Ficha completa de una iglesia', 'Cuanta gente tiene, cuantos grupos, cuantos modulos encendidos, quien la pastorea y que unidades la alcanzan. Avisa en rojo si no tiene pastor: una sede sin pastor no se opera sola.'],
  'POST /api/v1/administracion/plantillas': ['Crear o renombrar una plantilla', 'Una plantilla responde a con que modulos nace una iglesia nueva de ese tipo.'],
  'POST /api/v1/administracion/plantillas/:codigo/modulos': ['Marcar un modulo en la plantilla', 'Se niega a quitar un modulo de nucleo: sin el, una iglesia nueva no podria ni registrar personas.'],
  'POST /api/v1/administracion/plantillas/:codigo/borrar': ['Borrar una plantilla', 'Se niega si ya se desplego alguna iglesia con ella: borrarla dejaria sin explicacion por que esa iglesia nacio como nacio.'],
  'POST /api/v1/auth/entrar': ['Entrar al sistema', 'Devuelve token de acceso y de refresco. Si el rol alcanza datos N3 o N4 y el segundo factor no esta activo, devuelve un token limitado que solo sirve para configurarlo.'],
  'POST /api/v1/auth/refrescar': ['Renovar el acceso', 'El token de refresco se ROTA: usarlo dos veces lo invalida, porque es la senal clasica de un token robado.'],
  'POST /api/v1/auth/salir': ['Cerrar esta sesion', 'Surte efecto en el instante, no cuando expire el token.'],
  'POST /api/v1/auth/salir-de-todo': ['Cerrar todas las sesiones', 'Para cuando alguien pierde el telefono.'],
  'POST /api/v1/auth/cambiar-clave': ['Cambiar la contrasena', 'Cierra las demas sesiones abiertas.'],
  'POST /api/v1/auth/segundo-factor/iniciar': ['Empezar a configurar el segundo factor', 'Devuelve el secreto y el texto del codigo QR.'],
  'POST /api/v1/auth/segundo-factor/activar': ['Activar el segundo factor', 'Confirma que el telefono y el servidor estan sincronizados.'],
  'GET /api/v1/auth/quien-soy': ['Quien soy y que alcanzo', 'El alcance se deriva de la base, nunca de lo que envie el cliente.'],
  'GET /api/v1/sesion/yo': ['Mi sesion y lo que alcanzo', 'Quien soy, que sedes alcanzo, hasta que nivel de sensibilidad y que modulos veo. El panel se pinta contra esto y no contra una lista cableada en el cliente.'],

  'GET /api/v1/organizacion/sedes': ['Las sedes que alcanzo', 'Solo las que el permiso vigente alcanza. Una sede que no alcanzo no aparece.'],
  'POST /api/v1/organizacion/sedes': ['Dar de alta una sede', 'Desde plantilla y con bitacora: nadie crea una iglesia a mano. Exige alcance de organizacion.'],
  'GET /api/v1/organizacion/ministerios': ['Catalogo de ministerios de la red', 'Cada ministerio arrastra su nivel de dato: RocaKids nace N4 y Consejeria N3.'],
  'GET /api/v1/organizacion/sedes/:id/ministerios': ['Ministerios encendidos en una sede', 'Lo que la sede tiene activo hoy.'],
  'PUT /api/v1/organizacion/sedes/:id/ministerios/:min': ['Encender o apagar un ministerio en una sede', 'Los modulos con compuerta legal (Aportes, RocaKids) exigen evidencia registrada: la base lo rechaza sin ella.'],

  'GET /api/v1/personas': ['Buscar personas', 'Tolera errores de digitacion, tildes, documento, telefono y correo. Respeta la seguridad por fila: lo que no alcanza la sesion no sale.'],
  'GET /api/v1/personas/:id': ['Ficha de una persona', 'Los campos por encima del nivel de la sesion no se devuelven, y la lectura de datos N3 o N4 queda en la bitacora.'],
  'PUT /api/v1/personas/:id': ['Actualizar una persona', 'Exige membresia VIGENTE en una sede alcanzada. La sede de origen puede ver a quien se traslado, pero ya no lo edita.'],
  'GET /api/v1/personas/:id/linea-tiempo': ['Historia de una persona', 'Todo lo que los modulos publicaron sobre ella, en orden. Filtrada por nivel de sensibilidad.'],
  'GET /api/v1/personas/:id/atributos': ['Casillas propias de una persona', 'Los atributos extensibles declarados desde la consola, con su nivel.'],
  'PUT /api/v1/personas/:id/atributos/:codigo': ['Escribir una casilla propia', 'El nivel de la casilla lo declaro quien la creo; escribir por encima del nivel de la sesion se rechaza.'],
  'GET /api/v1/personas/:id/duplicados': ['Quien podria ser la misma persona', 'Candidatos a duplicado con puntaje y motivo: mismo documento, misma fecha de nacimiento, nombre parecido. Con 36 fuentes migrando, los duplicados son certeza.'],
  'GET /api/v1/personas/por-atributo': ['Personas que cumplen una casilla', 'Es como se arrastra gente a un modulo nuevo sin migrar nada.'],

  'GET /api/v1/identidad/roles': ['Los roles de la red', 'Con su techo de nivel y su alcance maximo.'],
  'GET /api/v1/identidad/matriz': ['Matriz de permisos', 'Modulo por accion por rol. Se lee para pintar el menu; escribirla esta cerrado desde la migracion 0031.'],
  'GET /api/v1/identidad/modulos': ['Modulos del sistema', 'El manifiesto: nivel de dato, si es de nucleo, de que depende y si exige compuerta legal.'],
  'GET /api/v1/identidad/personas/:id/asignaciones': ['Permisos asignados a una persona', 'Los directos y los heredados de sus equipos, con la columna que dice de donde viene cada uno.'],
  'GET /api/v1/identidad/personas/:id/efectivo': ['Permiso efectivo', 'Rol por alcance por nivel por vigencia, ya resuelto.'],
  'POST /api/v1/identidad/personas/:id/otorgar': ['Otorgar un permiso', 'Exige alcance de organizacion. Un rol de menores se rechaza sin antecedentes vigentes.'],
  'DELETE /api/v1/identidad/asignaciones/:id': ['Revocar un permiso', 'Surte efecto en el instante, no al final del dia, y exige motivo escrito.'],
  'GET /api/v1/identidad/atributos': ['Catalogo de casillas propias', 'Cada una con su modulo dueno y su nivel de sensibilidad.'],
  'POST /api/v1/identidad/atributos': ['Declarar una casilla nueva', 'Sin migracion y sin despliegue. Quien la crea tiene que declarar que tan sensible es lo que va a guardar.'],

  'GET /api/v1/aportes': ['Aportes de la sede', 'El pastor congregacional ve habito de aporte SIN ninguna columna de monto: es una decision del modelo, no del frontend.'],
  'POST /api/v1/aportes': ['Registrar un aporte', 'Idempotente: un doble clic no crea dos aportes.'],
  'POST /api/v1/aportes/:id/confirmar': ['Confirmar un aporte', 'Parte de la conciliacion: quien recibe no es quien concilia.'],
  'GET /api/v1/aportes/certificados': ['Certificados de aporte', 'Anuales, con los requisitos fiscales del pais.'],
  'POST /api/v1/aportes/certificados': ['Emitir un certificado', 'Se emite contra la reconciliacion: si no cuadra al peso, no se emite.'],
  'GET /api/v1/aportes/certificados/:id': ['Un certificado'],
  'GET /api/v1/aportes/certificados/:id/documento': ['Documento del certificado', 'La descarga queda en la bitacora de lectura.'],
  'POST /api/v1/aportes/certificados/:id/anular': ['Anular un certificado', 'No se borra: se anula, con motivo.'],
  'GET /api/v1/aportes/pagos-sin-dueno': ['Pagos sin persona', 'Lo que entro por pasarela y todavia no se sabe de quien es. La cola de trabajo de tesoreria.'],
  'POST /api/v1/aportes/pagos/:id/emparejar': ['Emparejar un pago con su persona'],
  'POST /api/v1/aportes/pasarela/webhook': ['Aviso de la pasarela de pagos', 'Verifica la firma y la ventana de tiempo, y es idempotente: el mismo aviso dos veces no cobra dos veces.'],

  'POST /api/v1/nuevos/registrar': ['Registrar a alguien que llega', 'Puerta publica del formulario de la sede. Exige al menos una forma de contacto y deja el consentimiento registrado.'],
  'GET /api/v1/nuevos/dashboard': ['Bandeja de seguimiento', 'Con los atrasados marcados: que nadie se pierda es el trabajo del modulo.'],
  'GET /api/v1/nuevos/:id/historial': ['Historial de contactos con un nuevo'],
  'POST /api/v1/nuevos/:id/registrar-contacto': ['Registrar un contacto', 'Con la reaccion de la persona, que alimenta el recorrido.'],
  'POST /api/v1/nuevos/:id/convertir-miembro': ['Convertir un registro en persona', 'No duplica si la persona ya existe, y no se puede convertir dos veces.'],

  'GET /api/v1/modelo100p': ['Vistas del Drive «Sistema 100p»', 'Los mismos datos publicados con los nombres del documento del equipo.'],
  'GET /api/v1/modelo100p/:tabla': ['Una vista del modelo 100p'],
  'POST /api/v1/notificaciones/procesar': ['Procesar la cola de avisos', 'Tarea programada. Respeta el consentimiento por canal: sin registro, no se contacta.'],
  'GET /api/v1/rocakids/salas': ['Salas de ninos y su estado de ahora', 'Con cuantos ninos hay dentro y si se cumple la regla de dos adultos. Exige N4.'],
  'GET /api/v1/rocakids/salas/:id/roster': ['Censo de la sala', 'Quien puede entrar hoy: nombre, edad y si ya esta dentro. NO devuelve condiciones medicas ni codigos: esto se guarda en el equipo para trabajar sin conexion, y lo que se guarda en un equipo se pierde con el equipo.'],
  'GET /api/v1/rocakids/salas/:id/servidores': ['Quien sirve hoy en la sala', 'Es la respuesta a «quien estaba con los ninos ese dia», la primera pregunta de cualquier incidente.'],
  'POST /api/v1/rocakids/salas/:id/entrar-a-servir': ['Entrar a servir en una sala', 'La base rechaza a quien no tenga antecedentes de salvaguarda vigentes.'],
  'GET /api/v1/rocakids/menores/:id/acudientes': ['Quien puede entregar y retirar a este menor', 'La pantalla ofrece esta lista, no un campo de texto libre: un texto libre convierte la salvaguarda en una formalidad.'],
  'POST /api/v1/rocakids/checkin': ['Registrar la entrada de un menor', 'Devuelve el codigo UNA vez; despues solo existe cifrado. IDEMPOTENTE por menor, sala y dia: la cola sin conexion puede reintentar sin duplicar el ingreso.'],
  'POST /api/v1/rocakids/entregar': ['Entregar al menor', 'La base verifica acudiente autorizado Y codigo. Un intento fallido queda registrado con hora y nombre.'],
  // ⛔ 20 sep 2026 · EL COMANDO CENTRAL. Hasta hoy no habia panel de
  //    administracion: el primer Pastor Director General se creaba con un
  //    comando en la terminal y los roles de las 36 sedes se otorgaban por
  //    SQL o con curl. Una red de 36 iglesias no se administra asi.
  'GET /api/v1/administracion/cuentas': ['Las cuentas que uno alcanza', 'Con su estado, su segundo factor, su ultimo ingreso y sus roles. Avisa de las bloqueadas y de las que tienen el segundo factor sin activar.'],
  'POST /api/v1/administracion/cuentas': ['Crear una cuenta', 'Devuelve una contrasena provisional UNA vez y no se vuelve a mostrar: se entrega en persona o por canal seguro, y el sistema obliga a cambiarla al entrar.'],
  'POST /api/v1/administracion/cuentas/:id/reiniciar-clave': ['Reiniciar la contrasena', 'Genera una provisional nueva y CIERRA todas sus sesiones: si no, quien tuviera la sesion abierta con la clave vieja seguiria dentro.'],
  'POST /api/v1/administracion/cuentas/:id/desbloquear': ['Desbloquear una cuenta', 'Para quien se equivoco cinco veces.'],
  'POST /api/v1/administracion/cuentas/:id/reiniciar-segundo-factor': ['Reiniciar el segundo factor', 'Para quien perdio el telefono. ⛔ NO le quita la exigencia: su rol lo sigue necesitando.'],
  'GET /api/v1/administracion/sesiones': ['Quien esta dentro ahora', 'Sesiones abiertas, desde cuando, desde que direccion y cuanto les queda.'],
  'GET /api/v1/administracion/alertas': ['Quien esta probando contrasenas', 'Intentos fallidos agrupados por usuario y direccion.'],
  'GET /api/v1/administracion/recertificar': ['Accesos por recertificar', 'Un permiso que nadie revisa es un permiso que nadie quito.'],
  'GET /api/v1/administracion/organigrama': ['El organigrama', 'La central, sus regiones, sus direcciones y sus equipos, con cuantas sedes alcanza cada uno.'],
  'GET /api/v1/administracion/sedes/:id/modulos': ['Los modulos de una sede', 'Cuales estan encendidos y cual es su evidencia legal. Avisa de los encendidos con compuerta legal y sin referencia juridica.'],
  'POST /api/v1/administracion/sedes/:id/modulos': ['Encender o apagar un modulo', 'La base impone las reglas: un modulo de nucleo no se apaga, uno con compuerta legal no se enciende sin evidencia, y uno no se enciende si su dependencia esta apagada.'],
  'GET /api/v1/administracion/auditoria': ['Quien hizo que', 'La auditoria. ⛔ Se lee por funcion, no por permiso de tabla: conceder SELECT sobre la auditoria a la aplicacion la haria legible por cualquier sesion.'],
  'GET /api/v1/administracion/lecturas': ['Quien MIRO los datos sensibles', 'La bitacora de lectura existe para que mirar por curiosidad tenga nombre y hora.'],
  'GET /api/v1/administracion/plantillas': ['Las plantillas de iglesia', 'Que modulos trae una iglesia nueva segun su tipo. Los de compuerta legal nacen apagados.'],
  'POST /api/v1/administracion/iglesias': ['Desplegar una iglesia', 'Una sola operacion crea la sede colgada de la maestra, le aplica los modulos de su plantilla, deja apagados los de compuerta legal y le asigna su pastor. Exige alcance de organizacion: una sede no crea otra sede.'],
  'POST /api/v1/administracion/personas': ['Registrar a una persona', 'El otro despliegue del comando central. Despues se le crea cuenta y se le otorgan roles.'],
  'GET /api/v1/administracion/unidades': ['Los equipos de la central', 'Contabilidad, Tesoreria, Pastoral, regiones. Avisa de los equipos sin ningun rol: existen pero no pueden hacer nada.'],
  'POST /api/v1/administracion/unidades': ['Crear un equipo', 'El proposito es obligatorio: un equipo sin proposito escrito es un equipo que nadie sabe por que tiene los permisos que tiene.'],
  'GET /api/v1/administracion/unidades/:id': ['La ficha de un equipo', 'Sus integrantes, sus roles y las sedes que alcanza por esa via.'],
  'POST /api/v1/administracion/unidades/:id/roles': ['Otorgar un rol AL EQUIPO', 'Es la pieza que convierte «un grupo de personas» en «Tesoreria»: lo heredan sus integrantes mientras esten dentro y se les cae al salir. Exige el acta que lo autoriza.'],
  'POST /api/v1/administracion/unidades/roles/:asignacionId/revocar': ['Quitarle el rol al equipo', 'Se corta para todos sus integrantes en el instante.'],
  'POST /api/v1/administracion/unidades/:id/miembros': ['Meter a alguien en un equipo', 'Hereda los roles del equipo desde ese instante.'],
  'POST /api/v1/administracion/unidades/:id/miembros/:personaId/salir': ['Sacar a alguien de un equipo', 'Surte efecto ya, sin esperar a manana, y exige motivo.'],

  // ⛔ 20 sep 2026 · Cinco modulos que tenian TABLAS y ninguna ruta: el
  //    modulo existia en `sistema.modulos`, la sede lo tenia encendido y no
  //    se podia usar desde ninguna parte.
  'GET /api/v1/asistencia/servicios': ['Los servicios y su asistencia', 'Trae los DOS numeros: «contados» es el de la puerta y «marcados» es la lista. Una sede que cuenta 600 y marca 12 no esta fallando: esta contando como se puede.'],
  'POST /api/v1/asistencia/servicios': ['Abrir un servicio', 'Sin servicio abierto no se marca a nadie. Uno por sede, fecha, hora y tipo.'],
  'POST /api/v1/asistencia/servicios/:id/marcar': ['Marcar asistencia', 'IDEMPOTENTE: marcar dos veces a la misma persona no la cuenta dos veces.'],
  'GET /api/v1/asistencia/servicios/:id/marcados': ['Quien esta marcado', 'La lista, para el seguimiento pastoral.'],
  'POST /api/v1/asistencia/servicios/:id/conteo': ['Reportar el conteo de la puerta', 'Se puede corregir: el primer numero de un domingo siempre es el que alguien grito desde la puerta. Devuelve la diferencia con la lista y la explica.'],
  'GET /api/v1/grupos': ['Los grupos', 'Ordenados por el que lleva mas tiempo sin reportar reunion: lo que hay que mirar primero no es el grupo grande, es el callado.'],
  'POST /api/v1/grupos': ['Crear un grupo', 'Tipo, dia, hora y cupo. El ministerio y el segmento son opcionales.'],
  'GET /api/v1/grupos/:id': ['La ficha del grupo', 'Quien esta, quien se fue y con que motivo, y las ultimas veinticuatro reuniones.'],
  'POST /api/v1/grupos/:id/miembros': ['Agregar a alguien', 'Idempotente: si ya esta activo, lo dice y no duplica.'],
  'POST /api/v1/grupos/:id/miembros/:personaId/salir': ['Sacar a alguien', 'EXIGE motivo: «se fue» no le dice nada al que viene detras.'],
  'POST /api/v1/grupos/:id/reuniones': ['Reportar una reunion', 'Es lo que convierte una lista en un grupo vivo. Una por grupo y dia.'],
  'GET /api/v1/consejeria/topicos': ['Los topicos', 'Para que nadie escriba «problema familiar» de doce formas distintas. Marca los que exigen profesional.'],
  'GET /api/v1/consejeria/casos': ['La bandeja de casos', '⛔ SIN notas y SIN el detalle: solo lo que permite priorizar. Una lista que trae las notas de paso las reparte por accidente.'],
  'POST /api/v1/consejeria/casos': ['Abrir un caso', 'Consultante, sede y topico.'],
  'GET /api/v1/consejeria/casos/:id': ['La ficha del caso', 'Aqui SI van las notas, y entrar deja rastro en la bitacora de lectura, con nombre y hora. Saberlo es la mitad de la proteccion.'],
  'POST /api/v1/consejeria/casos/:id/asignar': ['Asignar un consejero', 'El caso pasa a «en proceso». Un caso sin nadie detras es una persona esperando.'],
  'POST /api/v1/consejeria/casos/:id/sesiones': ['Registrar una sesion', 'Fecha, duracion, modalidad y si la persona asistio.'],
  'POST /api/v1/consejeria/casos/:id/notas': ['Escribir una nota', 'Va aparte a proposito: no viaja en ninguna lista, solo se ve dentro de la ficha.'],
  'POST /api/v1/consejeria/casos/:id/cerrar': ['Cerrar o derivar', 'Derivar EXIGE decir a donde. Cerrar el caso cierra tambien las asignaciones vivas.'],
  'GET /api/v1/formacion/programas': ['Los programas de la red', 'El catalogo lo define la central una vez y lo usan las 36 sedes.'],
  'GET /api/v1/formacion/cursos': ['Los cursos', 'Con su programa, su semestre y su prerequisito.'],
  'GET /api/v1/formacion/cohortes': ['Las cohortes', 'Son de cada sede: cada una abre su grupo cuando puede y con el docente que tiene. Avisa de las que pasaron el cupo.'],
  'POST /api/v1/formacion/cohortes': ['Abrir una cohorte', 'Curso, sede, codigo, modalidad y fechas.'],
  'GET /api/v1/formacion/cohortes/:id': ['La ficha de la cohorte', 'Quien esta inscrito, como va y quien pago.'],
  'POST /api/v1/formacion/cohortes/:id/inscribir': ['Inscribir a alguien', 'Si pasa el cupo se inscribe IGUAL y se avisa: negarlo dejaria a la persona en la puerta por un numero, y quien decide si caben es el docente.'],
  'POST /api/v1/formacion/inscripciones/:id/calificar': ['Calificar', 'Nota final y estado (aprobado, reprobado, retirado…).'],
  'GET /api/v1/talento/cargos': ['Los cargos', 'Con su area y el nivel de dato que manejan.'],
  'GET /api/v1/talento/contratos': ['Los contratos', 'Avisa de los que vencen en menos de treinta dias.'],
  'GET /api/v1/talento/voluntariados': ['Los voluntariados', '⛔ Lo primero que se ve son los voluntarios ACTIVOS con menores y SIN antecedentes vigentes. No es una metrica: es una lista de salas que hay que cubrir antes del domingo.'],
  'POST /api/v1/talento/voluntariados': ['Registrar un voluntariado', 'Persona, sede, ministerio y funcion.'],
  'POST /api/v1/talento/voluntariados/:id/terminar': ['Terminar un voluntariado', 'Exige motivo.'],
  'GET /api/v1/talento/antecedentes/:personaId': ['Los antecedentes de alguien', 'Dice si esta apto para estar con menores y QUE le falta exactamente.'],
  'POST /api/v1/talento/antecedentes': ['Registrar un antecedente', 'Es lo que abre (o cierra) la puerta de RocaKids: la base rechaza el rol sin antecedentes vigentes.'],

  // ⛔ 20 sep 2026 · Los derechos del titular (Ley 1581) estaban en la base
  //    desde la migracion 0053 y NO TENIAN NI UNA RUTA. Un derecho que solo
  //    puede ejercer quien sabe SQL no es un derecho.
  'POST /api/v1/cumplimiento/peticiones': ['Radicar una peticion del titular', 'Consulta, reclamo, supresion, revocacion o actualizacion. La base calcula el vencimiento en DIAS HABILES con los festivos de Colombia y devuelve el radicado. Exige N3: una peticion trae nombre, documento y contacto de una persona.'],
  'GET /api/v1/cumplimiento/peticiones': ['La bandeja de peticiones', 'Lo abierto primero y lo vencido arriba. Si hay vencidas lo dice en un aviso: una peticion vencida es un incumplimiento en curso, no un dato de una columna.'],
  'POST /api/v1/cumplimiento/peticiones/:id/responder': ['Responder y cerrar', 'Deja la respuesta escrita y avisa si se respondio DESPUES del vencimiento. Una respuesta tardia sigue siendo un incumplimiento y el registro tiene que poder demostrarlo.'],
  'POST /api/v1/cumplimiento/peticiones/:id/prorrogar': ['Prorrogar el plazo', 'La base exige un motivo de verdad y recalcula el vencimiento. Avisa si la prorroga todavia NO se le ha informado al titular, que es lo que obliga la ley.'],
  'POST /api/v1/cumplimiento/peticiones/:id/suprimir': ['Ejecutar la supresion', 'Irreversible. Exige confirmacion explicita ("SUPRIMIR") y nivel N4, porque puede tocar datos de menores y de consejeria.'],
  'GET /api/v1/cumplimiento/consentimientos/:personaId': ['Que consentimientos tiene hoy una persona', 'Canal por canal y finalidad por finalidad, con su base legal, mas la historia completa de actos.'],
  'POST /api/v1/cumplimiento/consentimientos/revocar': ['Revocar un consentimiento', 'Sin canal ni finalidad revoca todo lo REVOCABLE. Lo que se apoya en contrato u obligacion legal no se revoca: decir que si seria mentirle al titular sobre su propio derecho. Ademas descarta lo que ya estaba encolado.'],
  'GET /api/v1/cumplimiento/no-atendido': ['Lo que el sistema decidio NO enviar', 'Con su motivo. Es la prueba de que no se contacto a quien no autorizo, y la bandeja de lo que quedo sin atender.'],
  'GET /api/v1/identidad/catalogos': ['Catalogos de la red', 'Los que se pueden ampliar y los cerrados a proposito, estos ultimos con su motivo escrito.'],
  'GET /api/v1/identidad/catalogos/:catalogo/valores': ['Valores de un catalogo', 'Incluye los retirados, que siguen siendo legibles para la historia.'],
  'POST /api/v1/identidad/catalogos/:catalogo/valores': ['Agregar un valor', 'Sin migracion y sin despliegue. Exige alcance de organizacion. Una maquina de estados lo rechaza y dice por que.'],
  'POST /api/v1/identidad/catalogos/:catalogo/valores/:codigo/retirar': ['Retirar un valor', 'Retira, no borra: las filas historicas siguen legibles y lo que se impide es usarlo en filas nuevas. Exige motivo.'],

  'GET /salud': ['Salud para el balanceador', 'Comprueba la base de verdad.'],
  'GET /salud/detalle': ['Salud detallada', 'Base, particiones, fugas de lectura y ultimo mantenimiento.'],
};

function esc(s) { return String(s).replace(/"/g, '\\"'); }

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.init();
  const servidor = app.getHttpAdapter().getInstance();
  const capa = servidor._router?.stack ?? [];

  const rutas = [];
  for (const c of capa) {
    if (!c.route) continue;
    for (const m of Object.keys(c.route.methods)) {
      if (m === '_all') continue;
      rutas.push({ metodo: m.toUpperCase(), ruta: c.route.path });
    }
  }
  rutas.sort((a, b) => (a.ruta + a.metodo).localeCompare(b.ruta + b.metodo));

  const porRuta = new Map();
  for (const r of rutas) {
    if (!porRuta.has(r.ruta)) porRuta.set(r.ruta, []);
    porRuta.get(r.ruta).push(r.metodo);
  }

  let y = '';
  y += 'openapi: 3.1.0\n';
  y += 'info:\n';
  y += '  title: CasaRoca System AI · API\n';
  y += '  version: "' + (process.env.APP_VERSION || '1.0.0') + '"\n';
  y += '  description: |\n';
  y += '    API del sistema eclesial de Casa Sobre la Roca: una central y 36 sedes.\n\n';
  y += '    ESTE ARCHIVO SE GENERA. No lo edite a mano: corra `scripts/generar-openapi.js`.\n';
  y += '    La verificacion de entrega compara lo generado con lo versionado.\n\n';
  y += '    Autenticacion: token de portador (Bearer). El token dice que sesion DICE ser;\n';
  y += '    quien decide es la base, que en cada peticion responde si esa sesion sigue viva.\n';
  y += '    Por eso cerrar una sesion surte efecto en el instante.\n';
  y += 'servers:\n';
  y += '  - url: https://api.casaroca.org\n    description: produccion\n';
  y += '  - url: https://api.staging.casaroca.org\n    description: pruebas\n';
  y += '  - url: http://127.0.0.1:3000\n    description: desarrollo\n';
  y += 'components:\n';
  y += '  securitySchemes:\n';
  y += '    portador:\n      type: http\n      scheme: bearer\n      bearerFormat: JWT\n';
  y += '  schemas:\n';
  y += '    Error:\n';
  y += '      type: object\n';
  y += '      properties:\n';
  y += '        error: { type: boolean }\n';
  y += '        mensaje: { type: string, description: "En castellano y con la accion siguiente. Nunca filtra la estructura interna." }\n';
  y += '        peticionId: { type: string, description: "Identificador de traza. El usuario lo lee por telefono al soporte." }\n';
  y += 'security:\n  - portador: []\n';
  y += 'paths:\n';

  const publicas = new Set(['/salud', '/salud/detalle', '/api/v1/auth/entrar', '/api/v1/auth/refrescar']);

  for (const [ruta, metodos] of porRuta) {
    y += '  ' + ruta + ':\n';
    for (const m of metodos) {
      const clave = m + ' ' + ruta;
      const d = DESCRIPCIONES[clave];
      y += '    ' + m.toLowerCase() + ':\n';
      y += '      summary: "' + esc(d ? d[0] : 'Sin descripcion declarada') + '"\n';
      if (d) y += '      description: "' + esc(d[1]) + '"\n';
      else   y += '      description: "⛔ Esta ruta no tiene descripcion en generar-openapi.js. Agreguela antes de entregar."\n';
      if (publicas.has(ruta)) y += '      security: []\n';
      y += '      responses:\n';
      y += '        "200": { description: correcto }\n';
      if (!publicas.has(ruta)) y += '        "401": { description: "sin sesion valida", content: { application/json: { schema: { $ref: "#/components/schemas/Error" } } } }\n';
      y += '        "429": { description: "demasiadas peticiones" }\n';
      y += '        "500": { description: "error inesperado", content: { application/json: { schema: { $ref: "#/components/schemas/Error" } } } }\n';
    }
  }

  const salida = process.env.OPENAPI_SALIDA || path.join(API, 'openapi.yaml');
  fs.writeFileSync(salida, y, 'utf8');
  const sinDescribir = rutas.filter(r => !DESCRIPCIONES[r.metodo + ' ' + r.ruta]).length;
  console.log(`✔ ${salida}`);
  console.log(`  ${rutas.length} rutas · ${sinDescribir} sin descripcion declarada`);
  await app.close();
}
main().catch(e => { console.error('⛔ ' + e.message); process.exit(1); });
