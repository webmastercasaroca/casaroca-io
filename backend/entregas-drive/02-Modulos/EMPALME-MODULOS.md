# Empalme de los módulos con la base de datos

**Para:** equipo Sistema 100p Casa Roca Global
**Sobre:** los tres documentos de `02 Módulos` — Roles (24 ago), Nuevos y Donaciones (25 ago)
**Estado:** lo que se pudo adoptar ya está implementado y probado. Lo que queda
es una decisión que no podemos tomar solos.

---

## Lo primero, porque condiciona todo lo demás

**Las dos escalas de sensibilidad no coinciden, y solo puede haber una.**

| Nivel | Documento de Roles (100p) | Documento 1 (arquitectura aprobada) |
|---|---|---|
| N0 | Pública — nombre | Público |
| N1 | Contacto privado — teléfono | Interno: sedes, catálogos, sin dato personal |
| N2 | **Financiero — aportes, diezmos** | Dato personal ordinario — nombre, contacto |
| N3 | Pastoral — consejería, crisis | **Sensible — aportes, notas pastorales, consejería** |
| N4 | Crítico — menores, RocaKids | Menores |

No es que una sea mejor. Es que **toda la matriz de permisos y todos los controles
automáticos cuelgan de la escala**, y si conviven dos, cada módulo aplicará la que
tenga más a mano. Estas son las consecuencias concretas de la diferencia:

**Los aportes.** En su escala son N2; en la nuestra, N3. Y N3 no es una etiqueta:
es lo que activa cifrado por columna, enmascarado por defecto y bitácora de
lectura. Con los aportes en N2 no reciben ninguno de los tres.

**El Pastor Congregacional.** El Documento 1 le fija techo N2 precisamente para que
**no vea montos** — ve si una familia aporta y con qué frecuencia, nunca cuánto.
Ese fue uno de los puntos que se discutieron y se aceptaron en la mesa. En la
escala de Roles, techo N2 significa exactamente lo contrario: ve el dato financiero.

**El teléfono.** Para ustedes es N1; para nosotros, N2. Un rol de integración
técnica con techo N1 vería teléfonos de toda la congregación.

**Sugerencia:** conservar la escala del Documento 1, porque ya fue sustentada ante
el comité y porque sigue el criterio de la Ley 1581, que distingue *dato personal*
de *dato sensible* — y los aportes de una persona son dato sensible.

Lo que su escala aporta y vale la pena guardar: la distinción entre «nombre
público» y «contacto privado» es útil de verdad. Cabe como subclasificación dentro
de N2, sin mover los cinco niveles.

---

## Lo que adoptamos de ustedes · ya está implementado

### 1. Permisos nombrados por módulo

Su modelo progresivo tiene razón en algo que nosotros no teníamos: nuestros seis
verbos —ver, crear, editar, anular, exportar, administrar— describen operaciones
de tabla, no acciones de la iglesia. `REGISTRAR_CONVERSACION_PASTORAL` dice algo
que «editar consejería» no dice.

No sustituimos una cosa por otra: **se suman**. El verbo genérico para lo que es
CRUD de verdad; el permiso nombrado para la acción de negocio que alguien va a
discutir en el taller de permisos.

Implementado con una regla añadida: **un permiso nombrado solo puede otorgarse
sobre su propio módulo**. Sin eso, `EXPEDIR_CERTIFICADO` se podría conceder sobre
Consejería y la matriz dejaría de significar algo.

También añadimos el rol **`COORDINADOR_NUEVOS`** que ustedes definen y a nosotros
nos faltaba.

### 2. Certificados tributarios

No los teníamos, y no es un detalle: en Colombia el certificado de donación es el
documento con el que la persona deduce. Además traen una regla **mejor que la
nuestra**: certificar congela.

Nosotros teníamos «un aporte no se corrige, se anula y se vuelve a registrar». Eso
sigue valiendo, pero solo mientras no esté certificado. Después ni eso: el
documento ya salió firmado.

Una cosa que cambiamos al implementarlo: **el total del certificado no se recibe
como parámetro, se calcula**. Un certificado cuyo total lo escribe una persona
puede no cuadrar con sus propios renglones — y ese documento va a la DIAN. Hay una
vista de control que compara los dos y una prueba que la verifica.

Y dos rechazos que salieron al construirlo: un certificado **no puede mezclar
monedas** (Panamá y Barcelona) ni **mezclar sedes** — cada sede certifica lo que
recibió, que es lo que permite conciliar contra su propio cierre.

### 3. La bandeja de nuevos

Tienen razón: quien llena un formulario web no es todavía una persona verificada,
y meterlo directo al registro maestro lo contamina. Adoptamos `nuevos_registros`
como paso previo, con su tabla de contactos y su tablero de coordinador.

Dos cosas que añadimos:

- **La conversión abre el recorrido 4C con la fecha real de llegada, no la de
  hoy.** Si se abriera hoy, todo el mundo tendría cero días en la etapa «Conoce» y
  la métrica del embudo sería un adorno.
- **El linaje apunta al registro de la bandeja**, para poder responder «esta
  persona vino del formulario del 3 de agosto» igual que se responde «vino del
  registro 48211 de la plataforma actual».

Y una regla que la base ahora impone: **un registro sin correo ni teléfono se
rechaza**. Un nuevo al que no se puede volver a contactar no es un nuevo.

---

## Lo que encontramos en cada módulo

### Módulo de Donaciones

🔴 **`donaciones` no tiene `sede_id`.** Es el mismo punto que en `personas`, y aquí
duele más: el criterio de aceptación de la migración de aportes es que la suma
cuadre **por sede y mes** contra el cierre de tesorería. Sin sede no hay
reconciliación posible.

🔴 **No existe la tabla de cierre de control.** No hay contra qué cuadrar. Es el
único juez de si la migración quedó bien, y es aritmético: al peso.

🔴 **No hay fondos ni proyectos.** `tipo_aporte` solo distingue DIEZMO / DONACION /
OTRO. Un aporte dirigido a misiones o a construcción se convierte en ofrenda
general al migrar, y eso no se puede deshacer.

🔴 **No hay aportes anónimos** — `persona_id` es obligatorio. Pero los anónimos
existen y **entran en la suma de control**: si no se pueden registrar, o se pierden
o se les inventa una persona. Las dos cosas rompen la reconciliación.

🟠 **Falta la moneda.** Con sedes en Panamá, Barcelona y Boca Ratón, sumar sin
moneda es sumar peras con manzanas.

🟠 **El registro temporal preliminar.** Para una donación online cuyo correo no
existe, el documento dice que se «crea un registro temporal preliminar» en
`personas`. Eso mete en el maestro registros que no son personas verificadas — que
es exactamente lo que su módulo de Nuevos evita con acierto. La bandeja resuelve
los dos casos: la donación online sin persona conocida entra ahí, no al maestro.

### Módulo de Nuevos

🔴 **`email` y `telefono` obligatorios y únicos.** Contradice su propio documento de
Personas, que dice que los teléfonos «se recomiendan únicos pero NO es
restrictivo, una familia puede compartir teléfono». Aquí sí lo es, y bloquea el
registro del segundo hermano.

🔴 **La encriptación AES-256 de nombre, correo y teléfono choca con el paso 8 del
propio flujo.** Ese paso pregunta «¿el email ya existe?». Sobre una columna cifrada
no se puede buscar por igualdad, salvo con cifrado determinista —que revela cuándo
dos valores son iguales— o con índice ciego. Hay que elegir una de las tres; como
está escrito, la validación de duplicados no puede funcionar.

🟠 **«Derecho a ser olvidado» junto a «no se puede borrar».** Ambas son correctas y
se resuelven con anonimización, no con borrado: se conserva la fila y el histórico
contable, se destruyen los identificadores. Vale la pena escribirlo así.

❓ **«Pastor: ✗ Registrar contactos (solo coordinador)».** Es una decisión de
gobierno razonable, pero conviene confirmarla: en nuestra matriz el pastor sí puede
registrar seguimiento. Dígannos cuál manda y la ajustamos.

### Módulo de Roles

🟠 **`usuario_roles.sede_id` es `VARCHAR(50)` con valores como `'bogota'`.** Sin
clave foránea, `'Bogota'`, `'bogotá'` y `'BOG'` son tres sedes distintas y el
aislamiento se rompe en silencio. En nuestro esquema es un `uuid` con FK.

🟠 **Falta el alcance por caso.** El documento dice «Consejero = SEDE (solo ve su
sede)» y, tres líneas antes, «NO ve datos de otros consejeros». Las dos cosas no
pueden ser ciertas a la vez: con alcance de sede sí los vería. Hace falta un
alcance `caso_propio`, que es como lo tenemos implementado.

🟠 **Persona no es lo mismo que usuario.** La regla «todo usuario tiene al menos un
rol vigente» es correcta, pero `usuario_roles.usuario_id` apunta a `personas`, y la
inmensa mayoría de las 25.000 personas nunca entrará al sistema. Conviene separar
los dos conceptos antes de que un proceso empiece a exigir rol a todo el mundo.

✏️ **`ip_usuario VARCHAR(20)`** aparece otra vez, ahora en `auditoria_donaciones`.
Una IPv6 ocupa hasta 45 caracteres. Es el mismo punto que ya estaba en `personas`:
conviene corregirlo en los tres documentos a la vez, antes de que se copie a un
cuarto.

---

## El contrato de la API

Estamos construyendo la API sobre este esquema y **vamos a adoptar sus rutas y sus
cuerpos tal como los especificaron**: `POST /api/v1/nuevos/registrar`,
`GET /api/v1/nuevos/dashboard`, `POST /api/v1/nuevos/:id/registrar-contacto`,
`POST /api/v1/nuevos/:id/convertir-miembro` y `GET /api/v1/nuevos/:id/historial`.

El reparto natural es ese: **el contrato es suyo, porque ustedes construyen el
frontend; la garantía es nuestra, porque vive en la base.** Ninguna de las reglas
de arriba depende de que la aplicación se acuerde de aplicarlas.

---

## Dónde está lo construido

Todo lo descrito está en un repositorio de GitHub privado, en SQL plano y pensado
para leerse línea por línea, con **71 pruebas que demuestran cada garantía**. Falta
solo el usuario de GitHub de Jhon para dar acceso.

Las pruebas que respaldan este empalme son doce, entre ellas: el certificado cuadra
con sus renglones; un aporte certificado no se puede modificar ni anular; un
permiso nombrado no se puede otorgar fuera de su módulo; convertir a alguien que ya
existe no lo duplica; y el recorrido 4C arranca en la fecha de llegada.
