# AUDITORÍA DE CREACIÓN · CasaRoca System AI
### Estado real contra el `CHECKLIST-CREACION.md`

> 19 de septiembre de 2026 · Revisión línea por línea del repositorio `ecosistema-cr` en el commit `e0f44df`.
> Auditor: Aivor. Cada hallazgo cita el archivo y la línea. Nada de lo que sigue es opinión: todo se puede verificar abriendo el archivo.

---

## VEREDICTO EN UNA PÁGINA

**La base de datos es de nivel profesional y está por encima de lo que se ve en el mercado eclesial.** El diseño de sensibilidad por columna, la doble cerradura, la auditoría inmutable, la bitácora de lectura, el manifiesto de módulos y las casillas extensibles con gobierno son decisiones de arquitecto senior, no de programador. Eso no hay que tocarlo: hay que protegerlo.

**El problema es que todo eso protege la casa por dentro y la puerta de la calle está abierta.** La API identifica a las personas con una cabecera de texto plano. Cualquiera que escriba `X-Persona-Id: <uuid>` **es** esa persona: el pastor principal, el tesorero, el director de RocaKids. La matriz de 173 permisos, los cuatro niveles de sensibilidad y la seguridad por fila se calculan a partir de una identidad que nadie verificó.

**Y hay una caída programada en el calendario:** el 1 de enero de 2028 a las 00:00, el sistema deja de poder escribir.

| Columna | Estado | Evidencia |
|---|---|---|
| **Backend · datos** | 🟠 | 41 migraciones, 76 tablas en 14 esquemas, 8 bancos de prueba. Sólido, con tres huecos estructurales (H-02, H-03, H-04) |
| **Backend · API** | 🔴 | Sin autenticación, sin validación, sin límite de tasa, sin especificación, sin `/health`. 6 módulos expuestos |
| **Frontend** | 🔴 | `frontend/src` contiene 5 hojas de estilo y ningún componente. Lo vivo es el prototipo y el sitio de Netlify |
| **Infraestructura** | 🔴 | 16 archivos de Terraform escritos y **ninguno aplicado**. Sin ambientes, sin CI, sin copia restaurada. La API corre en el Mac de Daniel |

**Cómo se reporta a la mesa, sin suavizarlo:** el modelo de datos está terminado a un 85 %. El producto está terminado a un 30 %. **Hoy esto no se puede poner en manos de 36 sedes.**

---

## LO QUE ESTÁ BIEN Y NO SE TOCA

Un auditor honesto empieza por aquí, porque destruir esto para «modernizar» sería el error más caro del proyecto.

1. **Sede como entidad de primera clase** con clave foránea obligatoria en todo (`0002`). Corrigió la divergencia más grave del modelo original.
2. **Doble cerradura**: política en la aplicación más seguridad por fila con contexto por transacción (`0008`).
3. **Permiso = rol × alcance × nivel × vigencia** (`0006`). Cuatro dimensiones, no dos. Es el diseño correcto.
4. **Techo por rol imposible de burlar**, con disparador en la base (`0006`), y la aplicación sin poder subirse su propio techo (`0031`).
5. **Auditoría solo de agregar e inmutable** más **bitácora de lectura** sobre datos sensibles (`0007`). Casi nadie hace la segunda.
6. **Menores blindados**: acudiente obligatorio, código de entrega cifrado que nunca se devuelve, y una regla que impide exportarlos (`0004`, `0019`, `0035`).
7. **Habeas Data real**: consentimiento por finalidad y canal, solo de agregar, con evidencia (`0005`).
8. **Manifiesto de módulos** con nivel de dato, dependencias y compuerta legal, más activación por sede con bitácora (`0020`).
9. **Casillas extensibles con gobierno**: cada atributo nuevo declara su nivel de sensibilidad y su módulo dueño (`0037`). Esto ya responde a «que agregar una casilla sea fácil».
10. **Vista de control de seguridad por fila** (`plataforma.v_control_rls`, `0031`): delata sola cualquier tabla futura que nazca sin política. El control puesto donde están los datos, no donde se estaba mirando.
11. **Plantillas de aprovisionamiento** (`sistema.plantillas`): una iglesia nueva nace con los módulos de su tipo. Esto ya es «el mismo sistema inicial para todas».
12. **Linaje de migración** (`source_system` + `source_id`) en las tablas núcleo, que hace posible la reconciliación.

---

## HALLAZGOS

### 🔴 H-01 · No existe autenticación. La identidad viaja en una cabecera
**Evidencia:** `backend/api/src/comun/identidad.helper.ts:26` toma `req.header('X-Persona-Id')` y con eso construye el contexto de seguridad. `main.ts:23` la declara como cabecera permitida en CORS.
**Qué significa:** todo el modelo de permisos es calculado correctamente **a partir de una identidad falsificable**. No hay contraseña, ni token, ni firma, ni expiración, ni segundo factor. El código dice «en producción, en el token de Keycloak», pero Keycloak no existe en ninguna parte del repositorio ni de la infraestructura.
**Ítems:** B4.01, B4.02, B4.03, B4.04, B4.05. Es la **pregunta 1** del auditor.
**Lo que está bien hecho:** el punto de sustitución está aislado en **una sola función**, y las sedes y el nivel **no** llegan del cliente: se derivan de la base. Cambiar a un proveedor de identidad toca un archivo, no seis.
**Arreglo:** proveedor OIDC (Keycloak en Cloud Run, ya previsto en el perfil D), verificación de firma y expiración del token, `sub` mapeado a `nucleo.personas`, segundo factor obligatorio para central, tesorería y menores, y prueba que rechace una petición sin token válido.

### 🔴 H-02 · La sede de una persona es una columna mutable. Al trasladarse, se reescribe el pasado
**Evidencia:** `backend/db/migrations/0003_nucleo_persona.sql:26` define `sede_id uuid NOT NULL` dentro de `nucleo.personas`. No existe ninguna tabla de membresía: la búsqueda de `membresia_sede`, `historial_sede` y `traslado` en las 41 migraciones no devuelve nada.
**Qué significa, con un caso real:** Ana congrega en Chicó ocho años, aporta, se forma y recibe consejería. Se muda a Chía y alguien actualiza su `sede_id`. En ese instante:
- Chía pasa a ver **toda** su historia de Chicó, incluidos sus aportes de ocho años.
- Chicó **deja de ver** a una persona que estuvo ahí ocho años, y sus reportes históricos cambian solos.
- Nadie puede responder «¿desde cuándo está en Chía?», porque la fecha no existe.
- Un líder que congrega en una sede y sirve en otra **no se puede representar**. Y en una red de 36 sedes eso no es la excepción.

Este es exactamente el «la base es rígida» que Daniel intuyó. Es el hallazgo número uno del modelo de datos.
**Ítems:** B2.02, B2.03, B2.04. Es la **pregunta 3** del auditor.
**Arreglo (migración 0041):** `nucleo.membresias_sede` (persona, sede, tipo, `desde`, `hasta`, motivo, quién aprobó), con una sola vigente de tipo «principal»; vista `v_sede_actual`; la seguridad por fila pasa a leer la membresía vigente; carga inicial desde el `sede_id` actual con fecha de creación; y `personas.sede_id` queda como sede de origen o se elimina. Más la prueba: trasladar a alguien **no** cambia quién puede ver su historia anterior.

### 🔴 H-03 · El sistema deja de escribir el 1 de enero de 2028
**Evidencia:** `0007_auditoria_bitacora.sql:32-35` crea particiones de `plataforma.auditoria` para 2026 y 2027 y nada más. `0009_linea_de_tiempo.sql:36-41`, igual para `crm.linea_tiempo`. No hay partición por defecto (`PARTITION ... DEFAULT` no aparece en ninguna migración) ni función ni tarea que cree la siguiente.
**Qué significa:** a las 00:00 del 1 de enero de 2028, una fila con fecha de 2028 no tiene partición donde caer y el `INSERT` falla. Como la auditoría se escribe por disparador en las operaciones del sistema, **falla la operación completa**, no solo la auditoría. Es una caída total, con fecha exacta, a una hora en la que no hay nadie mirando.
**Ítems:** B3.10. Es la **pregunta 6** del auditor.
**Arreglo:** función `plataforma.asegurar_particiones(p_anios int)` que crea las que falten, partición por defecto como red de seguridad, tarea programada mensual, y una prueba en el banco que **falla** si no existen al menos dos años de particiones por delante.

### 🟠 H-04 · 26 tipos enumerados del motor. Es la rigidez que Daniel describe
**Evidencia:** 26 `CREATE TYPE ... AS ENUM` en las migraciones, entre ellos `asistencia.tipo_servicio`, `grupos.tipo_grupo`, `aportes.tipo_aporte`, `formacion.modalidad`, `nucleo.estado_civil`, `nucleo.nivel_compromiso`, `consejeria.estado_caso`, `crm.estado_nuevo`.
**Qué significa:** cuando una sede pida «culto de jóvenes» como tipo de servicio, eso es **una migración, una revisión y un despliegue**. Un valor de un enumerado no se puede borrar nunca ni renombrar sin reescribir la columna. Con 36 sedes pidiendo variantes, esto genera una cola de cambios que termina, como siempre, en un Excel aparte.
**Ítems:** B3.05, B3.06. Es la **pregunta 7** del auditor.
**Arreglo:** pasar a catálogo los de negocio, con código estable, etiqueta editable, orden, `vigente` y marca de red o de sede. Dejar el enumerado solo para lo estructural que no cambia: `org.tipo_sede`, `identidad.tipo_alcance`, `sistema.tipo_dato_atributo`. Se hace con una tabla catálogo, una clave foránea y una carga desde los valores actuales: el dato existente no se toca.

### 🟠 H-05 · La central no está modelada como central, y no hay nivel de región
**Evidencia:** `org.sedes` tiene `tipo_sede` con cuatro valores y ninguno es `central`. Los equipos de la central serían hoy `org.ministerios` de clase `equipo_operativo` (5 sembrados), que no tienen líder, ni miembros con vigencia, ni presupuesto. `identidad.tipo_alcance` no incluye `equipo` ni `region`.
**Qué significa:** «la central tiene muchos equipos» no se puede representar. Un coordinador de comunicaciones de la central hoy solo puede recibir alcance de organización (ve las 36 sedes) o de una sede (ve una). No hay término medio, y el término medio es donde vive la central. Lo mismo con el supervisor regional de ocho iglesias: hoy se resuelve dándole toda la red, que es precisamente la fuga.
**Ítems:** B1.03, B1.04, B1.05, B1.06.
**Arreglo:** unidad organizativa jerárquica (red → región → sede → campus), `org.equipos` con líder y `org.equipo_miembros` con vigencia, y `tipo_alcance` ampliado con `equipo` y `region`. Nota: ampliar ese enumerado es justo el problema de H-04, así que los dos arreglos se hacen juntos.

### 🔴 H-06 · La infraestructura está escrita y no está aplicada
**Evidencia:** `infra/gcp/` tiene 16 archivos de Terraform (`sql.tf`, `kms.tf`, `run.tf`, `observabilidad.tf`, `red_y_redis.tf`, `balanceador.tf`, `ci.tf`) y una prueba `fases.tftest.hcl`. No hay estado aplicado, no existe `.github/`, y la API se conecta a `PGHOST=/tmp` con `PGPORT=5433`: un PostgreSQL local.
**Qué significa:** no hay tres ambientes, no hay integración continua, no hay copia de seguridad, no hay restauración probada, no hay alertas, no hay monitoreo externo. Lo que está «en línea» es el sitio de Netlify leyendo una API que corre en un portátil que se duerme al 1 % de batería. Para un auditor, esto es la diferencia entre un producto y una demostración.
**Ítems:** B11.01 a B11.14. Preguntas **5** y **15** del auditor.
**Arreglo por orden:** aplicar Terraform en `staging`, subir la API a Cloud Run, base gestionada con copia diaria, **ejecutar una restauración y anotar fecha y duración**, CI en GitHub Actions que corra las migraciones y los 8 bancos, y presupuesto con alerta.

### 🔴 H-07 · La API no tiene las defensas mínimas
**Evidencia:** `backend/api/package.json` declara exactamente seis dependencias: Nest, Express, `pg`, `reflect-metadata` y `rxjs`. No hay librería de validación, ni de límite de tasa, ni de cabeceras de seguridad, ni de especificación. Ninguna ruta `/health` en el código. Ningún identificador de traza por petición.
**Qué significa:** entrada sin validar en seis módulos, sin techo de peticiones, sin cabeceras de seguridad, sin documentación del contrato, sin poder decir si el servicio está sano, y sin poder rastrear un error que reporte un pastor.
**Ítems:** B6.03, B6.04, B6.06, B7.02, B7.04, B7.07, B7.10.
**Lo que está bien:** CORS ya es lista blanca y no asterisco (`main.ts:17-26`), con el razonamiento escrito en el código. Y el webhook de la pasarela ya verifica firma (`0039`).

### 🔴 H-08 · La llave que cifra los datos críticos sale de una variable de entorno
**Evidencia:** `backend/api/.env.example` define `APP_LLAVE_N4=llave-solo-de-desarrollo`, con el comentario «en producción esta llave viene del gestor de llaves». `infra/gcp/kms.tf` existe pero no está aplicado.
**Qué significa:** hoy, quien vea el entorno del proceso descifra los datos de nivel crítico, incluidos los códigos de entrega de los menores.
**Ítems:** B6.09, B6.10. Es la **pregunta 4** del auditor.

### 🔴 H-09 · El cumplimiento formal no existe, aunque el técnico sí
**Evidencia:** no hay registro de las bases ante la SIC, ni procedimiento de consulta y reclamo del titular con plazos, ni responsable publicado, ni control de antecedentes para voluntarios de menores. En `talento.voluntariados` no hay requisito de antecedentes vigentes para asignar el rol.
**Qué significa:** el sistema protege los datos de los menores mejor que la mayoría, **y al mismo tiempo permite asignar a un maestro de niños sin verificar nada**. Y una iglesia que trata datos de 25.000 titulares sin registrar sus bases está incumpliendo una obligación legal que cualquier auditoría detecta en la primera hora.
**Ítems:** B5.05, B5.06, B5.11, B5.12. Preguntas **10** y **11** del auditor.
**Arreglo:** registro ante la SIC; procedimiento del titular con plazos y responsable con nombre; y en el sistema, `talento.antecedentes` con vigencia, más una regla que **impida** asignar un rol de menores sin antecedentes vigentes.

### 🟠 H-10 · La búsqueda de personas no tolera errores de digitación
**Evidencia:** `0000_fundacion.sql:10-12` instala `pgcrypto`, `citext` y `unaccent`. **No instala `pg_trgm`.** El índice de nombre (`0003:85`) es sobre el texto normalizado: sirve para exacto y prefijo, no para similitud.
**Qué significa:** quien busca «Jon Chávez» no encuentra a «Jhon Chavez» y crea el duplicado. Con 36 fuentes migrando a la vez y 25.000 personas, los duplicados no son un riesgo: son una certeza.
**Ítems:** B2.05, B2.16.
**Arreglo:** `pg_trgm` más índice de similitud sobre el nombre normalizado, umbral de coincidencia declarado, y la función de candidatos a duplicado que la migración va a necesitar de todos modos.

### 🟠 H-11 · Nadie sabe qué pasa el domingo a las 10:00
**Evidencia:** no hay prueba de carga en el repositorio. No hay guardia declarada. El pico no está escrito en ningún documento.
**Qué significa:** el sistema se va a estrenar precisamente en su peor hora, con 36 sedes registrando a la vez, sin que nadie sepa si aguanta y sin nadie asignado para responder.
**Ítems:** B0.04, B11.13, B11.14. Es la **pregunta 12** del auditor.

### 🟠 H-12 · El frontend de producción no existe
**Evidencia:** `frontend/src` contiene cinco hojas de estilo y ningún componente. Lo que funciona es `fase0-prototipo` (JavaScript sin framework) y el sitio de Netlify.
**Qué significa:** no hay rutas protegidas por permiso real, ni estados de error, ni modo sin señal para el check-in del domingo, que es el flujo más crítico y el que peor conexión tiene.
**Ítems:** B8.03, B8.06, B8.08.

### 🟠 H-13 · Sin reversión de migraciones, sin registro de decisiones, y la evidencia está desactualizada
**Evidencia:** ninguna migración tiene reversión escrita. No existía `docs/DECISIONES/` (creada hoy). `docs/EVIDENCIA-pruebas.txt` documenta 5 bancos con 83 comprobaciones, mientras `scripts/probar.sh` corre **8** bancos: la evidencia guardada es de una corrida anterior.
**Ítems:** B3.13, B0.12, B12.10.

---

## TABLERO POR BLOQUE

| Bloque | Estado | Lo que falta para pasar a ✅ |
|---|---|---|
| B0 Ficha fundacional | 🟠 | Pico declarado, RPO/RTO firmados, bus factor, registro de decisiones |
| B1 Tenancy y organización | 🟠 | Central, región y equipos como sujetos de permiso (H-05) |
| B2 La persona | 🔴 | Membresía por sede con vigencia (H-02) y deduplicación por similitud (H-10) |
| B3 Modelo modular | 🟠 | Particiones automáticas (H-03) y catálogos en vez de enumerados (H-04) |
| B4 Identidad y acceso | 🔴 | **Autenticación real (H-01)**, segundo factor, recertificación trimestral |
| B5 Privacidad y menores | 🟠 | Registro SIC, procedimiento del titular, antecedentes de voluntarios (H-09) |
| B6 Seguridad técnica | 🔴 | Llave en gestor (H-08), validación, límite de tasa, cabeceras, intrusión |
| B7 Backend y API | 🔴 | Especificación, traza, idempotencia, salud (H-07) |
| B8 Frontend | 🔴 | Aplicación real con rutas por permiso y modo sin señal (H-12) |
| B9 Módulos del dominio | 🟠 | 13 módulos existen en datos; calendario, tareas y analítica sin construir |
| B10 Dinero e integraciones | 🟠 | Pasarela lista; falta conciliación contable y certificados anuales |
| B11 Infraestructura | 🔴 | Aplicar Terraform, tres ambientes, CI, **restauración con fecha** (H-06) |
| B12 Calidad | 🟠 | Carga, punta a punta, accesibilidad; y evidencia al día (H-13) |
| B13 Migración | 🟠 | Ensayo cronometrado, tablero de calidad, plan de corte |
| B14 Gobierno | 🔴 | Bus factor 1, sin mesa de ayuda, sin capacitación por sede |

---

## PLAN DE CORRECCIÓN, EN ORDEN DE RIESGO

**Ola 1 · Lo que impide entregar (se hace primero, sin discusión)**
1. **H-01 Autenticación real.** Todo lo demás vale poco sin esto.
2. **H-03 Particiones automáticas.** Son dos horas de trabajo y evitan una caída total con fecha puesta.
3. **H-08 Llave al gestor de llaves.**
4. **H-06 Aplicar la infraestructura en `staging` y ejecutar una restauración con fecha.**

**Ola 2 · Los cimientos del modelo (caro de cambiar después, barato ahora)**
5. **H-02 Membresía persona × sede.** Cada día que pasa son más filas atadas a una columna que hay que desatar.
6. **H-05 Central, región y equipos.**
7. **H-04 Catálogos en vez de enumerados** (se hace junto con H-05).
8. **H-10 Similitud para deduplicar**, antes de la primera ola de migración.

**Ola 3 · Producto**
9. **H-07 Defensas de la API** y especificación generada.
10. **H-12 Frontend real** con rutas por permiso y modo sin señal.
11. **H-09 Cumplimiento formal** y antecedentes de voluntarios.
12. **H-11 Prueba de carga del domingo** y guardia declarada.
13. **H-13 Reversiones, decisiones y evidencia al día.**

---

*Auditoría contra `CHECKLIST-CREACION.md` v1.0. Se vuelve a correr en cada cierre de fase.*

---

# CIERRE DE LA AUDITORÍA · mismo día, 19 de septiembre de 2026

> Lo que sigue no es un plan: es lo que se construyó y se verificó **después** de la auditoría, el mismo día.
> Entrega completa en `docs/HANDOFF.md`.

## Tablero por bloque · antes y después

| Bloque | Antes | Después | Qué cambió |
|---|---|---|---|
| B0 Ficha fundacional | 🟠 | ✅ | `docs/ARQUITECTURA.md`: pico declarado, RPO/RTO, costo, SLA por módulo, bus factor |
| B1 Tenancy y organización | 🟠 | ✅ | Central, regiones, direcciones y equipos; el permiso se hereda del equipo y cae al salir |
| B2 La persona | 🔴 | ✅ | Membresía con vigencia; traslado que no reescribe el pasado; búsqueda con erratas; fusión de duplicados |
| B3 Modelo modular | 🟠 | ✅ | Particiones automáticas con red de seguridad; 12 catálogos editables sin desplegar |
| B4 Identidad y acceso | 🔴 | ✅ | Autenticación real, segundo factor obligatorio N3/N4, revocación inmediata, recertificación |
| B5 Privacidad y menores | 🟠 | ✅ | Antecedentes exigidos por la base; regla de dos adultos; peticiones de titular con plazos |
| B6 Seguridad técnica | 🔴 | 🟠 | Cabeceras, validación, límite, secretos que impiden arrancar. Falta la prueba de intrusión (G5) |
| B7 Backend y API | 🔴 | ✅ | `openapi.yaml` generado, traza por petición, errores centralizados, `/salud` real |
| B8 Frontend | 🔴 | 🟠 | Aplicación real con menú por permiso y modo sin conexión. Faltan 4 pantallas |
| B9 Módulos del dominio | 🟠 | ✅ | Los cinco catálogos vacíos sembrados: Consejería, Formación y RocaKids ya se pueden usar |
| B10 Dinero e integraciones | 🟠 | 🟠 | Sin cambios: la pasarela ya estaba; falta la conciliación contable |
| B11 Infraestructura | 🔴 | 🟠 | Restauración **ejecutada**, integración continua, nueve compuertas, despliegue reversible. **Falta aplicar Terraform** |
| B12 Calidad | 🟠 | ✅ | De 104 invariantes que no rompían la corrida a **176 que sí la rompen**, más 19 de autenticación y carga |
| B13 Migración | 🟠 | 🟠 | Tablero de calidad del dato y deduplicación listos; falta el ensayo cronometrado |
| B14 Gobierno | 🔴 | 🟠 | Runbook, entrega y decisiones escritas. **Bus factor sigue en 1** |

## Las 15 preguntas del auditor, hoy

| # | Pregunta | Respuesta |
|---|---|---|
| 1 | Muéstreme el login | Token firmado + sesión viva en la base + segundo factor. 19 pruebas, incluida una que comprueba que la cabecera vieja **ya no sirve** |
| 2 | Que Chía no vea Chicó, como la aplicación | 176 invariantes, todas corriendo como `casaroca_app` |
| 3 | Una persona se traslada | Prueba M8: la sede destino ve **0** aportes de la anterior; la anterior sigue viendo el suyo |
| 4 | Dónde vive la llave | KMS. La aplicación **no arranca** en producción con una de desarrollo |
| 5 | La última restauración | `backend/docs/EVIDENCIA-restauracion.txt`, con fecha, duración y conteos |
| 6 | Qué pasa el 1 de enero | Nada: particiones automáticas, partición por defecto, y la prueba falla si baja de dos años |
| 7 | Agrégueme un tipo de servicio, ahora | `SELECT sistema.agregar_valor('tipo_servicio','culto_jovenes','Culto de jóvenes');` Sin desplegar |
| 8 | Quién leyó esa ficha de consejería | `plataforma.v_quien_vio` |
| 9 | Exporte los niños | Imposible, con prueba desde la migración 0035 |
| 10 | Registro ante la SIC | 🔴 **Pendiente.** El sistema ya lleva las peticiones con sus plazos; el registro es un trámite de la mesa |
| 11 | Un titular pide que lo borren | `plataforma.peticiones_titular`: 10 días hábiles para consulta, 15 para reclamo, contados por la base |
| 12 | Cuánto aguanta el domingo | 36 sedes en paralelo: 2.293 peticiones/s, p95 de 21 ms, 0 errores |
| 13 | Si usted desaparece | 🔴 **Sigue en rojo.** El runbook está escrito y probado, pero falta la segunda persona |
| 14 | Cuánto cuesta y quién paga | 506 USD/mes, presupuesto de 2.500.000 COP con alerta al 80 % |
| 15 | Qué hay en producción fuera del repositorio | 🟠 Nada, porque **todavía no hay producción** |

**Doce de quince contestadas con evidencia.** Las tres que faltan son trámites y decisiones de la mesa, no trabajo de ingeniería: el registro ante la SIC, la segunda persona que sepa operar esto, y aplicar la infraestructura.


---

# Apéndice · La madrugada del 20 de septiembre

Esta auditoría se escribió el 19. Lo que sigue pasó después, al revivir tres bancos de la API
que llevaban desde H-01 sin correr (42 comprobaciones que la documentación daba por buenas), y
al instalar Terraform por primera vez en la máquina para validarlo de verdad.

**No fueron fallos de las pruebas: fueron fallos del producto que nadie veía porque quien tenía
que verlos estaba apagado.** Están en `docs/HANDOFF.md`, sección 2b, como H-14 a H-23. Los tres
que más pesan:

1. **Toda donación devolvía 500.** El módulo de Aportes estaba roto entero desde la migración
   0046, que borró un enumerado que el código seguía citando dentro de una cadena de SQL.
2. **La salvaguarda de menores no llegaba por la API.** Dos versiones de `registrar_checkin`
   vivas; el banco probaba la endurecida y la API llamaba a la vieja. Por la aplicación se podía
   entregar a un niño sin figurar como acudiente.
3. **El procedimiento de rotar la llave N4 destruía los datos.** Un procedimiento equivocado es
   peor que no tener procedimiento: se sigue con confianza.

**Y una corrección de método**, que es la lección que queda: en esta auditoría se contaron
«21 archivos de Terraform» sin haberlos contado, y se dio por buena una infraestructura que
nunca había pasado por `terraform validate`. Son 16, y al validarlos aparecieron cuatro cosas
(estado local, sin sonda externa, sonda de arranque por puerto, Cloud Armor sin morder). Auditar
leyendo no es auditar: hay que correr la herramienta.
