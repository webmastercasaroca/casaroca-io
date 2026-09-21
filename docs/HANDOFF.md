# HANDOFF · CasaRoca System AI
### Lo que se entrega, cómo se opera y qué falta

> 19 de septiembre de 2026 · Para la mesa (Ps. Carlos Ricardo), desarrollo (Jhon) y calidad (Manuel).

---

## 1 · La tabla de tres columnas, sin suavizarla

| Columna | Estado | Evidencia |
|---|---|---|
| **Backend · datos** | ✅ | 60 migraciones + 22 semillas, aplicadas desde cero en máquina limpia · **16 bancos, 219 invariantes en verde** · `scripts/probar.sh` |
| **Backend · API** | ✅ | Autenticación real con segundo factor · **21 pruebas de autenticación + 50 de la API** (humo, Drive 100p y extremo a extremo), las tres dentro de la compuerta · `openapi.yaml` con **70 rutas**, todas descritas · validación, límite de peticiones, cabeceras, traza y `/salud` · la API **se niega a arrancar** con un rol que pueda saltarse RLS |
| **Frontend** | 🟠 | Aplicación real con entrada, segundo factor, navegación **por permiso**, búsqueda, check-in **sin conexión** y consola de catálogos. Verificada en navegador, móvil y escritorio, contraste AA medido. **Cubre 3 de los 22 módulos declarados** |
| **Infraestructura** | 🔴 | **16 archivos de Terraform, validados de verdad** (`validate`, `fmt -check`, `test`: 6 casos) y **sin aplicar**. Copia y **restauración ejecutadas** (`backend/docs/EVIDENCIA-restauracion.txt`), integración continua escrita, **once compuertas** en `scripts/verificar.sh`. **Falta crear los proyectos de GCP y aplicar** |

**Cómo se dice en la mesa:** el modelo de datos y la API están listos para producción. **El frontend NO está completo: tiene tres pantallas de veintidós módulos.** Cubre lo que se usa un domingo (buscar personas, check-in de RocaKids) y la consola de catálogos; lo demás se opera todavía por API o no se opera.

> ⚠️ **Esta tabla decía antes «faltan las pantallas de Aportes, Consejería, Formación y Analítica»,
> como si fueran cuatro.** Son diecinueve. Se corrige aquí porque un informe de entrega que
> minimiza lo que falta es exactamente lo que un auditor busca, y con razón: la diferencia entre
> «faltan cuatro pantallas» y «hay tres de veintidós» es la diferencia entre un remate y medio
> proyecto de frontend.

**La infraestructura está escrita y no aplicada, así que el sistema todavía no está en producción**, y eso no se suaviza. Aplicarla es media jornada con las llaves de Google Cloud en la mano, y el paso a paso está en `docs/PUESTA-EN-MARCHA-GCP.md`.

## 2 · Lo que se cerró el 19 de septiembre de 2026

| # | Hallazgo | Cómo se cerró |
|---|---|---|
| H-01 | **La API identificaba con una cabecera de texto plano** | Autenticación con token firmado, sesión revocable en la base, segundo factor obligatorio para N3 y N4, bloqueo por intentos, rotación de refresco. 19 pruebas |
| H-02 | **La sede de una persona era una columna mutable** | `nucleo.membresias_sede` con vigencia. Trasladar ya no reescribe el pasado ni entrega la historia a la sede nueva. 14 pruebas |
| H-03 | **El sistema dejaba de escribir el 1 de enero de 2028** | Particiones automáticas, partición por defecto, rescate y prueba que exige dos años de colchón. 10 pruebas |
| H-04 | **26 enumerados rígidos** | 12 catálogos de negocio convertidos a datos editables; los 16 restantes registrados como cerrados **con su motivo escrito**. 11 pruebas |
| H-05 | **La central no existía** | `org.unidades` (central, regiones, direcciones, equipos), permisos heredados del equipo y revocación inmediata. 14 pruebas |
| H-07 | **La API sin defensas** | Validación, límite de peticiones, cabeceras, errores centralizados, traza por petición, `/salud` que comprueba de verdad |
| H-08 | **La llave de cifrado en una variable** | La aplicación **se niega a arrancar** en producción con un secreto de desarrollo |
| H-09 | **Se podía asignar un maestro de niños sin verificar nada** | Antecedentes con vigencia, la base rechaza el rol sin ellos, regla de dos adultos, y peticiones de Habeas Data con plazos contados. 10 pruebas |
| H-10 | **La búsqueda no toleraba erratas** | Trigramas: «Pstor Medelin» encuentra a «Pastor Medellin». Fusión de duplicados que mueve todas las referencias. 11 pruebas |
| H-11 | **Nadie sabía qué pasa el domingo** | Prueba de carga: 36 sedes en paralelo, 2.293 peticiones/s, p95 de 21 ms, cero errores |
| H-12 | **No había frontend** | Aplicación real, móvil primero, con modo sin conexión |
| H-13 | **La suite era un informe, no una compuerta** | 7 de 8 bancos imprimían los fallos y devolvían éxito. Ahora rompen la corrida, y la suite arranca de base limpia |

**Y tres que aparecieron al construir, que nadie había visto:**

| Hallazgo | Por qué importa |
|---|---|
| **Toda tabla nueva nacía legible por la aplicación** (`ALTER DEFAULT PRIVILEGES` de la migración 0023) | Es la causa raíz de las fugas de agosto y del 11 de septiembre. Se corrigieron las tablas; nunca se corrigió la regla que las hacía nacer abiertas. Ahora nacen cerradas y exponerlas es un acto firmado en `plataforma.registro_exposicion` |
| **Cinco catálogos bloqueantes vacíos** | Consejería, Formación y RocaKids **no se podían usar**: no se abría un caso, no se inscribía a nadie y **no se hacía el check-in de un solo niño** |
| **Revocar un acceso solo surtía efecto al día siguiente** | Sacar a alguien del equipo de Finanzas a las 10:00 lo dejaba dentro hasta la medianoche |

## 2b · Lo que apareció en la madrugada del 20 de septiembre, al revivir las pruebas muertas

Tres bancos de la API (42 comprobaciones) se identificaban con la cabecera `X-Persona-Id`, que se
eliminó al cerrar H-01. Quedaron **muertos y fuera de la compuerta**, y los README seguían
afirmando su resultado. Al hacerlos entrar por la puerta de verdad aparecieron **fallos que
estaban en el producto, no en las pruebas**:

| # | Hallazgo | Por qué importa | Cómo se cerró |
|---|---|---|---|
| H-14 | **Toda donación devolvía 500** | El código seguía escribiendo `::aportes.tipo_aporte`, un enumerado que la migración 0046 convirtió en catálogo y **borró**. TypeScript no mira dentro de una cadena de SQL. El módulo de Aportes estaba roto entero | Se quitó el cast y hay una **compuerta nueva** que compara cada tipo citado por la API contra los tipos vivos de la base |
| H-15 | **Quien no autorizaba correo no podía ser miembro** | Convertir disparaba el aviso de bienvenida, el aviso exigía consentimiento, y al no haberlo **se deshacía la transacción entera**: la persona no llegaba a existir. Además se exigía consentimiento para finalidades cuya base legal **no** es el consentimiento (Ley 1581, art. 10): un certificado que la persona misma pidió | Migración 0055: el consentimiento se exige donde la ley lo exige, y lo que no se puede enviar **queda escrito** en `plataforma.avisos_no_enviados` con su motivo en vez de tumbar la operación |
| H-16 | **La API podía arrancar como superusuario** | Si heredaba `PGUSER` del entorno se conectaba como `postgres`, que **se salta todas las políticas**. Medellín veía la bandeja de Bogotá y nada fallaba a la vista. Pasaba dentro de la propia compuerta | La API **se niega a levantar** con un rol superusuario o con `BYPASSRLS` |
| H-17 | **La salvaguarda de menores no llegaba por la API** | Quedaban dos `registrar_checkin` vivas: la vieja (5 argumentos) y la endurecida (6). **La API llamaba con cinco.** Por la aplicación se podía entregar a un niño sin figurar como acudiente, y una sala con un solo adulto recibía sin decir nada. El banco probaba una puerta y el producto entraba por la otra | Se tumbó la sobrecarga vieja y la API llama a la endurecida |
| H-18 | **El check-in reventaba un domingo por una salida de la semana anterior** | Un ingreso que se quedó abierto hacía que el del domingo siguiente chocara con el índice único: error en crudo, en la pantalla, a las nueve, con la fila de padres | El ingreso abierto **se cierra dejando dicho por qué**. El modelo pasa a tres estados: abierto · entregado · cerrado por el sistema |
| H-19 | **El procedimiento de rotar la llave N4 destruía los datos** | El RUNBOOK decía que no hacía falta recifrar. El sistema cifra con **una** llave simétrica sin versión: rotar sin recifrar deja ilegibles los códigos de entrega de los menores, y si se destruye la versión anterior en KMS, para siempre | `plataforma.recifrar_n4()` + `scripts/rotar-llave-n4.sh`, probado de ida y vuelta, y el guion se planta si queda una fila ilegible |
| H-20 | **El estado de Terraform iba a quedar en un portátil** | El `backend "gcs"` estaba comentado. Dos personas aplicando se pisan, no hay bloqueo, y perder el portátil es perder el mapa de la nube | Backend parcial activo: el bucket se pasa en el `init` |
| H-21 | **Nadie se enteraba de una caída completa** | Todas las alertas viven dentro del proyecto que vigilan. Y la sonda de arranque de Cloud Run era TCP: puerto abierto bastaba, aunque la base estuviera caída | Sonda **externa** de disponibilidad con su alerta, y sondas de arranque y de vida contra `/salud` |
| H-22 | **El domingo se podía desplegar, y sin copia previa** | Un push a `main` llegaba a producción cualquier día, y las migraciones corrían sin una copia hecha a propósito | Freno de domingo con escape explícito y registrado, y copia bajo demanda etiquetada con el build, antes de migrar |
| H-24 | **Los derechos del titular no tenían ni una ruta** | La Ley 1581 estaba implementada en la base desde la 0053 (plazos en días hábiles, prórroga con motivo, supresión real) y solo se podía ejercer con `psql`. Un derecho que solo ejerce quien sabe SQL no es un derecho, y ante la Superintendencia «está en la base» no es una respuesta | Ocho rutas (`/api/v1/cumplimiento`), la bandeja avisa de las vencidas y responder dice si fue fuera de plazo |
| H-25 | **Revocar el consentimiento fallaba entero desde la API** | `revocar_consentimiento` cancela lo ya encolado y la aplicación solo tiene `SELECT` sobre esa cola: la revocación no se registraba y el correo salía igual. Y revocaba TODO, también lo que se apoya en contrato u obligación legal, que la ley no deja renunciar | `SECURITY DEFINER` con la comprobación de alcance por dentro, y solo revoca lo revocable (migración 0058) |
| H-26 | **El volcado del modelo 100p ignoraba el nivel** | `GET /modelo100p/<tabla>` devuelve `SELECT *`: todas las columnas, incluidas salud, menores y consejería. La RLS acotaba la sede y **nadie acotaba la sensibilidad**: una sesión N1 podía pedir `/modelo100p/menores` y llevarse el volcado de su sede | Cada tabla exige el nivel de su columna más sensible, que lo dice la base y no una lista escrita a mano |
| H-23 | **Las conexiones no daban para el domingo** | 10 de negocio y 5 de autenticación por instancia; la puerta era más angosta que la casa. Con 36 sedes a la vez las peticiones no fallan: **se encolan**, justo en la pantalla de check-in | Los pozos salen de la tabla de fases, igual que el número de instancias, y Cloud SQL declara `max_connections` con la misma cuenta. La API avisa al arrancar cuántas instancias caben |

**Y cuatro pruebas que habían dejado de probar lo que decían** (una sala sembrada compartida, un
líder elegido con `LIMIT 1` sin orden, una invariante que registraba `ACEPTADO` sin mirar nada y
otra que dependía de cómo quedó la semilla). Todas pasaban en base nueva y fallaban en base
usada, que es la peor clase de prueba: la que da confianza sin darla.

## 3 · Cómo se opera

Todo está en **`docs/RUNBOOK.md`**, escrito para que lo siga alguien que no construyó esto. Los cinco comandos que hay que conocer:

```bash
cd backend
./scripts/arrancar.sh    # levanta la base local
./scripts/migrar.sh      # recrea desde cero
./scripts/probar.sh      # 16 bancos, 219 invariantes
./scripts/verificar.sh   # LA COMPUERTA: once verificaciones
./scripts/desplegar.sh staging
```

## 4 · Credenciales y accesos

**Nada de esto va por correo ni por mensaje.** Se entrega por canal seguro y a nombre de la **organización**, no de una persona:

| Qué | A quién | Canal |
|---|---|---|
| Proyecto de Google Cloud | Dirección de Tecnología | Invitación a la cuenta de la organización |
| Repositorio `100p-NANO/ecosistema-cr` | Jhon (`jhonchavez-creator`) | Invitación de GitHub |
| Secretos de producción | Nadie los ve: viven en Secret Manager | Acceso por rol, no por persona |
| Llave de cifrado N4 | Nadie la ve: vive en Cloud KMS | Rol de la aplicación |
| Correo del proyecto | `100p@casaroca.org` | Ya asignado |

## 5 · Lo que falta, en orden

**Ola 1 · para que exista en producción (media jornada, necesita las llaves de GCP)**
1. Crear `casaroca-staging` y `casaroca-prod` con facturación.
2. `terraform apply` sobre staging y contrastar con `docs/INFRA.md`.
3. Cargar los secretos y envolver la llave N4 con KMS.
4. Primer despliegue, prueba de carga contra staging, despliegue a producción.

**Ola 2 · para que se pueda entregar a las 36 sedes**
5. **Las pantallas que faltan: 19 de 22 módulos.** Por orden de uso real, no de tamaño:
   Aportes y Asistencia (todas las semanas), CRM Pastoral · 4C y Grupos (el seguimiento),
   Consejería y Talento (con datos sensibles, exigen cuidado extra), Formación, Calendario,
   Comunicaciones, Analítica, y el resto. **No es un remate: es un frente de trabajo completo**,
   y conviene decirlo con ese nombre al presupuestarlo.
6. Cablear las cuatro alertas que ya tienen su vista en la base.
7. **Prueba de intrusión externa** (compuerta G5). Lo diseñado cubre los controles; esto certifica lo construido.
8. Registro de las bases ante la SIC y publicación del aviso de privacidad.

**Ola 3 · para que sobreviva**
9. Capacitación con **una persona entrenada por sede**.
10. Mesa de ayuda con horario y tiempo de respuesta.
11. **Bus factor:** hoy es 1. Al menos una persona más tiene que poder levantar esto.

## 6 · Decisiones que esperan a la mesa

1. **Región de la nube.** São Paulo cuesta ~575.000 COP/mes más que `us-east1` y depende de la cláusula de residencia de datos.
2. **Traslados** (`docs/DECISIONES/ADR-002`): ¿quién aprueba, el pastor que recibe o el que entrega? ¿La consejería viaja con la persona? La recomendación técnica es que **no viaje** sin consentimiento nuevo.
3. **Quién es el Responsable del Tratamiento** ante la ley: la corporación central o cada iglesia. Cambia el modelo de consentimiento completo.
4. **Quién asume el RPO de 15 minutos.** Es una decisión de la mesa, no del ingeniero.

## 7 · La advertencia que sigue vigente

Esto certifica que **lo diseñado** cubre los controles y que **lo construido** pasa 219 invariantes de base, 21 pruebas de autenticación, 50 de la API y una prueba de carga. **No certifica que lo desplegado los cumpla en producción**, porque todavía no hay producción. Eso lo certifica la prueba de intrusión externa de la compuerta G5, sobre la infraestructura aplicada.
