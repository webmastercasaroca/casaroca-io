# Estructura de datos · Observaciones al modelo de personas

**Para:** equipo Sistema 100p Casa Roca Global
**Sobre:** *ESTRUCTURA DE DATOS – USUARIOS (PERSONAS)* v1.1
**Estado:** cada punto viene con la corrección ya implementada y probada en
`casaroca-backend/db/migrations/`. No es una lista de reparos: es código que corre.

---

## Resumen

El modelo v1.1 acierta en lo difícil: auditoría append-only con valor anterior y
nuevo, borrado lógico con `DELETE` prohibido, el menor exigiendo acudiente como
regla de integridad, deduplicación por documento, y módulos que consultan pero no
escriben sobre `personas`. Esos principios coinciden con el Documento 1 y se
conservan tal cual.

Hay **catorce puntos** que conviene resolver antes de la primera carga. Los diez
primeros salieron del primer cotejo; los cuatro del anexo, de releer la v1.1
completa el 24 de agosto. Tres son bloqueantes: el 1, el 2 y el 11.

---

## 🔴 1. `personas` no tiene `sede_id` — bloqueante

El modelo guarda `ciudad_residencia`, `zona` y `pais_residencia`, pero no la sede a
la que la persona pertenece. Son cosas distintas: alguien puede vivir en Chía y
congregarse en Chicó.

Sin columna de sede no hay forma de escribir la política que impide que Panamá lea
Barcelona. No es que sea difícil: es que no hay sobre qué escribirla. Se cae el
aislamiento multi-sede y con él la doble cerradura del Documento 1.

**Corregido en:** `0002_organizacion.sql`, `0003_nucleo_persona.sql`,
`0008_rls_doble_cerradura.sql`.
**Probado en:** `db/tests/aislamiento_rls.sql` — nueve escenarios, incluido el de
una sesión de Panamá pidiendo *todas* las personas sin filtro y recibiendo solo
las suyas.

## 🔴 2. No hay linaje de migración

Falta `source_system` y `source_id`. Sin ellos no se puede responder «esta persona
vino del registro 48211» y la reconciliación contra la plataforma actual deja de
ser auditable. El criterio de aceptación de aportes es que las sumas cuadren al
peso; eso exige poder rastrear cada fila hasta su origen.

**Corregido en:** todas las tablas migrables llevan `source_system`, `source_id` y,
en `personas`, `source_payload jsonb` con la fila cruda tal como llegó.

## 🔴 3. Permisos por fila persona × usuario

`permisos_personas` no escala: con 25.000 personas y varios cientos de usuarios, el
producto es inmanejable, y sobre todo no permite responder «¿qué puede ver un
Pastor Congregacional?» sin recorrer millones de filas.

El Documento 1 define el permiso efectivo como **rol × alcance × sensibilidad ×
vigencia**. Catorce roles, no seis niveles.

**Corregido en:** `0006_identidad_permisos.sql`. Incluye el techo por rol: una
asignación no puede otorgar más sensibilidad de la que el rol admite, aunque
alguien la escriba a mano.

## 🟠 4. `email_principal` obligatorio y único

En una congregación con menores y adultos mayores, mucha gente no tiene correo.
Exigirlo bloquea el registro de las dos poblaciones más sensibles del sistema.

**Corregido en:** el correo es opcional; la unicidad es un índice parcial
`WHERE email_principal IS NOT NULL`. La deduplicación real va por documento.

## 🔴 5. No existe tabla de consentimiento

Se resuelve con banderas booleanas (`puede_recibir_email`, `puede_recibir_sms`).
Una bandera no guarda **cuándo** se otorgó, **para qué finalidad**, ni **con qué
evidencia** — y esos tres datos son exactamente el requisito de la Ley 1581.

El punto fino: un consentimiento recapturado hoy no cubre el tratamiento de ayer.
Si la bandera se sobrescribe, la fecha original se pierde para siempre.

**Corregido en:** `0005_consentimiento_habeas_data.sql`. Tabla append-only con
finalidad, canal, acto (otorgado/revocado), fecha original, tipo de evidencia y
referencia. Revocar es insertar, nunca borrar.

## 🟠 6. Dice «GDPR» donde en Colombia manda la Ley 1581/2012

El campo se llama `consentimiento_gdpr`. El GDPR aplica a Barcelona; el resto de
las sedes se rige por Habeas Data. Conviene que el nombre no induzca al error de
aplicar el régimen equivocado.

**Corregido en:** `org.paises.regimen_datos` distingue `ley_1581_co` de `gdpr_eu`
por sede, y las sedes internacionales quedan en la última ola de migración.

## 🟠 7. `edad` se almacena como entero

Una columna `edad INT` nace correcta y se pudre sola: cada cumpleaños convierte en
mentira una fila que nadie volvió a tocar. Y de la edad depende si una persona es
menor, que es lo que activa la protección N4.

**Corregido en:** `edad` y `es_menor` son funciones sobre `fecha_nacimiento`. No
existe columna almacenada — hay una prueba que lo verifica.

## 🟠 8. Falta la clasificación N0–N4

Hay un booleano `datos_sensibles`. Un booleano no puede activar controles
distintos: los aportes (N3) piden cifrado y bitácora de lectura; los menores (N4)
piden además prohibición de exportación.

**Corregido en:** `0001` y `0011`. El registro es columna por columna y verificable
por consulta: «enséñame toda columna N3 que no cumpla su control» debe dar cero.

## 🟡 9. GCP en vez de AWS — no es un error, pero mueve las cifras

El Documento 1 dimensionó Fargate; ustedes van con Cloud Run. El diseño es portable
a propósito y la decisión es razonable. Lo que sí hay que rehacer es el modelo
financiero: los **1.502.550 COP/mes** están calculados sobre precios de AWS.

**Pendiente:** recalcular el Documento 2 sobre precios de GCP.

## ✏️ 10. La tabla se llama `minores`

En español es `menores`. Un nombre de tabla vive para siempre y se copia a cada
consulta, cada informe y cada integración. Cuesta cinco minutos hoy.

**Corregido en:** `nucleo.acudientes` y toda referencia usa `menores`.

---

## Lo que ya está construido y se puede revisar

12 migraciones de SQL plano sobre PostgreSQL 16, sin ORM de por medio, pensadas
para leerse línea a línea. Y 25 pruebas que demuestran cada garantía:

- **16 invariantes** — entre ellas: un menor sin acudiente hace fallar la
  transacción; sin consentimiento registrado no se puede contactar; el registro de
  consentimiento resiste un borrado; la auditoría se escribe sola y es inmutable;
  el código de entrega de RocaKids se cifra y solo se verifica, nunca se devuelve.
- **9 de aislamiento** — corridas *como la aplicación*, no como administrador,
  porque un superusuario salta RLS siempre y probar el aislamiento desde una
  sesión de administrador no demuestra nada.

Una que vale la pena mirar: el contexto de sede no sobrevive a la transacción. Es
la defensa contra el fallo clásico de multi-tenancy — que una petición herede el
tenant de la anterior porque comparten conexión en el pool.

---

# Anexo · Cuatro puntos más, tras leer la v1.1 completa (24 ago 2026)

Verificado directamente sobre el documento del Drive, última modificación 18 ago.
Los diez puntos anteriores siguen todos vigentes: `personas` continúa sin `sede_id`,
la tabla sigue llamándose `minores`, `edad` sigue siendo `INT` almacenado y
`consentimiento_gdpr` sigue siendo un booleano.

## 🔴 11. El acudiente está escrito en TRES sitios a la vez

El mismo hecho —quién responde por un menor— aparece en:

1. `personas.acudiente_id`
2. `minores.acudiente_principal_id`
3. `vinculos_personas` con `tipo_relacion = ACUDIENTE`

Cuando el mismo dato vive en tres columnas, tarde o temprano dicen cosas distintas,
y no hay forma de saber cuál manda. Y el dato en discordia es precisamente el que
autoriza entregar a un niño a un adulto.

**Sugerencia:** un solo lugar. La relación de custodia va en la tabla de acudientes,
con vigencia; `personas` no guarda ninguna copia. Implementado así en
`0004_menores_acudientes.sql`.

## 🟠 12. `es_mayor_18 BOOLEAN` almacenado en `minores`

Es el mismo problema de `edad INT`, pero con peor consecuencia. Un booleano
almacenado se queda en `false` para siempre: el niño cumple 18 y el sistema sigue
tratándolo como menor, o alguien corre un proceso de actualización masiva y de él
depende la protección N4. Debe derivarse de `fecha_nacimiento` en cada lectura.

## 🟠 13. Solo cinco tipos de documento

`tipo_documento` admite `CC, PP, TI, CE, PE`. Con sedes en Panamá, Barcelona y Boca
Ratón, faltan al menos el DNI y el NIE españoles, la cédula panameña, el registro
civil (que es el documento real de los niños pequeños en Colombia) y el PPT
venezolano. La plataforma actual maneja dieciséis.

El efecto práctico: la migración de las sedes internacionales se atasca en la
validación, y no en la semana 16 sino cuando ya no hay margen.

**Corregido en:** `db/seeds/001_catalogos.sql`, dieciséis tipos con su país.

## 🟠 14. `ip_usuario VARCHAR(20)` no cabe una dirección IPv6

Una IPv6 ocupa hasta 45 caracteres. En `VARCHAR(20)` se trunca o se rechaza, y en
los dos casos se pierde justo la evidencia que la auditoría existe para conservar.
Colombia ya asigna IPv6 en redes móviles, así que no es un caso hipotético.

**Sugerencia:** el tipo nativo `INET` de PostgreSQL. Ocupa menos, valida solo y
permite consultar por rango de red. Usado en `plataforma.auditoria.actor_ip`.

## Una observación sobre la regla de consentimiento

El documento dice: *«Se rechazará cualquier registro con `consentimiento_gdpr =
false»*. Conviene separar dos cosas que ahí quedan juntas:

- **Aceptar los términos de uso** de la web es condición para usar la web.
- **Autorizar el tratamiento de datos para convocatoria** no puede ser condición
  para existir en el registro de la iglesia.

Si se rechaza la creación de la persona, quien no autoriza correos simplemente no
puede ser registrado — y la Ley 1581 no exige eso; exige poder demostrar para qué
finalidad se autorizó cada canal. Por eso el consentimiento va en tabla aparte y
por finalidad, no como un portero a la entrada.
