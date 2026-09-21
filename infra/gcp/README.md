# CasaRoca System en Google Cloud

Infraestructura como código para llevar el backend a GCP **según el documento
«PLAN DE COSTOS GCP» del equipo 100p (Jhon Chávez)**: Terraform para la
infraestructura, Cloud Build para CI/CD y un migrador de base que aplica solo lo
nuevo.

> **Estado al 18 sep 2026: NADA está desplegado.** No existe todavía el proyecto de
> GCP, y nada de esto se ha aplicado contra Google Cloud. Lo que sí se validó en
> local está al final, en «Qué se validó y qué NO».

---

## Antes de todo: qué bloqueaba producción y qué queda

> **Al 19 de septiembre de 2026 los dos primeros bloqueos están CERRADOS.** Se dejan escritos
> con su historia porque explican por qué varias variables vienen como vienen.

1. ✅ **«La API no puede abrirse a internet: toma la identidad de la cabecera `X-Persona-Id`».**
   **Cerrado.** Esa cabecera se eliminó. Hoy la identidad va en un token firmado con `jti`,
   sesión revocable en el instante, y segundo factor TOTP obligatorio para los roles N3 y N4.
   Hay 19 pruebas de punta a punta de autenticación y 42 más de la API, todas dentro de la
   compuerta. `api_publica` sigue en `false` por omisión, pero ya no por esto.
2. ✅ **«Seis catálogos quedan vacíos con las semillas de producción».** **Cerrado.** Los cinco
   bloqueantes (`consejeria.topicos`, `formacion.programas`, `formacion.cursos`,
   `formacion.cohortes`, `rocakids.salas`) los siembra `019_catalogos_que_faltaban.sql`, y
   `db/tests/catalogos_no_vacios.sql` falla si alguno vuelve a quedar vacío. `sistema.atributos`
   queda vacío **a propósito**: son los campos que cada sede define, no un catálogo de red.
3. 🟠 **La sede maestra real.** Sigue abierto, y es de la iglesia, no técnico. Producción no
   lleva la semilla 002 (inventa una persona con N4 sobre toda la organización). El migrador
   pide la sede maestra con datos reales en la primera corrida (paso 6), y el primer Pastor
   Director General con acceso se crea a mano con `scripts/crear-cuenta.js`.

**Lo que queda antes de poner `api_publica = true`:**

| Falta | Quién | Por qué bloquea |
|---|---|---|
| `recaptcha-secreto` cargado | Sistemas | El formulario público sin validar es un grifo abierto de registros falsos |
| Prueba de intrusión externa (compuerta G5) | Tercero contratado | Es la única mirada que no es la nuestra |
| `armor_solo_observar = false` | Sistemas | Ya es el valor por omisión; hay que confirmarlo en el `tfvars` real |

---

## Qué crea cada fase y cuánto cuesta según el plan

Las cifras son **las del plan de Jhon, sin recalcular**. La fase se elige con una
sola variable, `fase = 0 | 1 | 2`, y los tamaños salen de la tabla en `fases.tf`:
nadie enciende una pieza de la fase 2 en la maqueta sin darse cuenta.

| Componente | Fase 0 · maqueta | Fase 1 · pruebas | Fase 2 · producción |
|---|---|---|---|
| **Costo del plan** | **35 USD/mes** | **218 USD/mes** | **526 USD/mes** (473 con compromiso de 1 año) |
| Cloud SQL PostgreSQL 16 | `db-f1-micro` | `db-n1-standard-1`, HA | 2 vCPU · 7,5 GB (`db-n1-standard-2`), HA, PITR ⚠️ |
| Cloud Run API | 0,25 vCPU · 512 MB · 1 instancia | 1 vCPU · 2 GB · mín. 2 | 1,5 vCPU ⚠️ · 2 GB · 2 a 5 |
| Cloud Run Frontend | 0,25 vCPU · 512 MB | 0,5 vCPU · 1 GB | 1 vCPU · 2 GB · 2 instancias |
| Cloud Run Pastoral | | | 0,5 vCPU · 1 GB |
| Cloud Run Jobs (correos, exportes) | | | sí |
| Memorystore Redis | | básico 1 GB | estándar 2 GB |
| Cloud Storage | 10 GB (CSV, respaldos) | 50 GB | 500 GB (certificados) |
| Cloud Logging | 7 días | 30 días | 90 días |
| Balanceador HTTPS | sí | sí + Cloud Armor (OWASP) | sí + Cloud Armor |
| Cloud CDN | | | para PDF |
| Cloud KMS con rotación | sí | sí | sí |
| Secret Manager | menos de 10 secretos | igual | igual |
| Correo | | SendGrid | SendGrid |
| Cloud Monitoring con alertas | | | sí |

En todas las fases, además: Artifact Registry, las cuentas de servicio, el bucket,
el Job del migrador y, si se da la cuenta de facturación, un **presupuesto con
avisos al 50, 90 y 100 %** de la cifra de la fase.

### Dónde el código NO puede seguir el plan al pie de la letra (⚠️)

| El plan dice | GCP admite | Qué hace este Terraform |
|---|---|---|
| API de 1,5 vCPU (fase 2) | Por encima de 1 vCPU, Cloud Run solo acepta enteros | Usa **2 vCPU**. Confirmar el costo en el calculador |
| PITR de 35 días (fase 2) | Cloud SQL Enterprise guarda el registro de transacciones 7 días como máximo; 35 exige Enterprise Plus (otro precio y otros tipos de máquina) | **PITR de 7 días + 35 respaldos diarios**: cualquier segundo de los últimos 7 días, cualquier día de los últimos 35 |
| 0,25 vCPU (fase 0) | Con menos de 1 vCPU, Cloud Run exige 1.ª generación y **una petición a la vez** por instancia | Así queda. La maqueta atiende de a una petición: sirve para mostrar, no para un domingo |
| API «mín. 2» (fase 1) | Hay que fijar un máximo | 4, decisión nuestra |
| Frontend «2 instancias» (fase 2) | | Mínimo 2, máximo 4 |
| Cloud CDN para PDF | Un certificado lleva datos personales | CDN en modo `USE_ORIGIN_HEADERS`: no se guarda en caché nada que la API no marque como público. Cachear certificados exige URLs firmadas (decisión abierta) |
| Disco de Cloud SQL | El plan no lo fija | 10 / 20 / 100 GB con crecimiento automático |

### Lo que el plan trae y todavía no se crea

- **Frontend y Pastoral:** no hay imagen. El frontend actual es el prototipo HTML
  en Netlify y el React del plan está por construir. Se encienden solos al dar
  `imagen_frontend` / `imagen_pastoral`.
- **Trabajadores (fase 2):** el envío de correos ya existe, pero como ruta de la
  API (`POST /api/v1/notificaciones/procesar`), no como programa aparte; falta
  quién la llame (decisión 13). Los exportes no tienen código. Un Job se declara en
  `trabajadores` cuando exista su imagen.
- **Redis:** se crea desde la fase 1 porque el plan lo trae, pero la API no lo usa
  todavía. Queda con contraseña, TLS y llave propia.

### Diferencias con el MODELO-FINANCIERO-GCP (Documento 2 recalculado)

Ese documento (`backend/entregas-drive/04-Infraestructura-Operacion/`) da 488 USD
de producción y trae piezas que el plan de Jhon no tiene: **Keycloak** (58 USD),
una instancia `e2-micro` como NAT (7 USD) y recomienda **no usar SendGrid** por
precio (SES, Brevo o Mailjet). Este Terraform sigue el plan de Jhon; las tres
diferencias van a «Decisiones abiertas».

---

## Cómo está armado

```
casaroca.org (cPanel) ──formularios──┐
                                     ▼
              Balanceador HTTPS (IP fija, certificado gestionado, TLS 1.2+)
              └─ Cloud Armor desde la fase 1 (OWASP + límite de tasa)
                     │
                     ▼
            Cloud Run «casaroca-api»  ──socket /cloudsql──►  Cloud SQL PostgreSQL 16
            (cuenta casaroca-api)          (conector)       (sin redes autorizadas,
               │        │                                    certificado de cliente
               │        └──Direct VPC egress (fase 1+)──► Redis     obligatorio)
               │
               └── Secret Manager (su clave de base, llave N4, terceros)

Cloud Build (push a main) ─► imágenes ─► Job «casaroca-migrador» ─► despliegue de la API
Cloud KMS: una llave con rotación de 90 días cifra Cloud SQL, el bucket, los secretos y Redis
```

| Archivo | Qué hay |
|---|---|
| `fases.tf` | La tabla del plan en código |
| `sql.tf` | Cloud SQL, base `casaroca`, usuario `postgres` |
| `run.tf` | API, Job del migrador, frontend, Pastoral, trabajadores |
| `secretos.tf` | Los 7 secretos y la generación de contraseñas |
| `identidades.tf` | Cuentas de servicio y permisos, uno por uno |
| `kms.tf` | Llave con rotación y los agentes que la usan |
| `almacenamiento.tf` | Artifact Registry y el bucket |
| `red_y_redis.tf` | VPC y Redis (fase 1+) |
| `balanceador.tf` | Balanceador, certificado, Cloud Armor, CDN |
| `observabilidad.tf` | Retención de registros, alertas, presupuesto |
| `ci.tf` + `cloudbuild.yaml` | El disparador de GitHub y el pipeline |
| `tests/fases.tftest.hcl` | Prueba de la tabla del plan, sin tocar GCP |
| `../../backend/api/Dockerfile` | Imagen de la API |
| `../../backend/Dockerfile.migrador` | Imagen del migrador |
| `../../backend/scripts/migrar-produccion.sh` | El migrador de producción |

### Decisiones de seguridad que ya van en el código

- **La API entra a la base como `casaroca_api`, nunca como `postgres`.** Ese rol lo
  crea el migrador con SQL y no Terraform: los usuarios que crea Cloud SQL nacen
  dentro de `cloudsqlsuperuser`. El migrador verifica en cada corrida que el rol no
  tenga SUPERUSER, BYPASSRLS, CREATEROLE, que no herede de `casaroca_owner` ni de
  `casaroca_migrador` y que no sea dueño de tablas (RLS no aplica al dueño).
- **Ninguna contraseña pasa por el estado de Terraform.** Se generan con recursos
  efímeros y se escriben en atributos de solo escritura (`*_wo`, Terraform 1.11+).
  La excepción es la contraseña interna de Redis, que el proveedor sí guarda en el
  estado: por eso el estado va en un bucket con acceso restringido.
- **Siete secretos, ninguno tecleado por una persona salvo los de terceros.**
  Terraform genera la clave de `postgres`, la de `casaroca_api`, la llave N4 y
  `NOTIFICACIONES_TOKEN` (protege `POST /api/v1/notificaciones/procesar`, la ruta
  que vacía la bandeja de correos). reCAPTCHA (`RECAPTCHA_SECRET`), SendGrid y
  PayU los carga una persona (paso 4).
- **La llave N4 (`APP_LLAVE_N4`) tiene versión fija y `prevent_destroy`.**
  Cambiarla deja ilegible lo cifrado (códigos de entrega de menores, notas de
  consejería).
- **Cloud SQL no acepta conexiones por IP.** IP pública sin redes autorizadas y
  certificado de cliente obligatorio: solo entra el conector, con identidad de
  Google y la contraseña del rol.
- **Bucket sin acceso público posible** (`public_access_prevention = enforced`),
  versionado, papelera de 7 días, y los CSV de `importaciones/` se borran solos a
  los 30 días (Ley 1581, finalidad).
- **Nada sale de `us-east1`:** secretos, respaldos de Cloud SQL y bucket en la
  misma región.
- **Mantenimiento de Cloud SQL y Redis los martes a las 3:00 a. m. de Bogotá.**
  Nunca domingo.
- **Registros de la base sin `log_statement = ddl`:** escribiría en claro la
  contraseña que el migrador fija con `ALTER ROLE ... PASSWORD`.

---

## Pasos para aplicarlo (Jhon)

Requisitos en la máquina: `gcloud`, Terraform 1.11 o superior y, opcional, Docker.
Permisos: propietario del proyecto y, para el presupuesto, «Administrador de
presupuestos» en la cuenta de facturación.

### 1. Proyecto y facturación

```bash
gcloud projects create casaroca-system-XXXX --name="CasaRoca System"
gcloud billing projects link casaroca-system-XXXX --billing-account=XXXXXX-XXXXXX-XXXXXX
gcloud config set project casaroca-system-XXXX
gcloud auth application-default login
```

### 2. Bucket del estado de Terraform (una sola vez)

```bash
gcloud storage buckets create gs://casaroca-system-XXXX-tfstate \
  --location=us-east1 --uniform-bucket-level-access --public-access-prevention
gcloud storage buckets update gs://casaroca-system-XXXX-tfstate --versioning
```

`versions.tf` ya declara `backend "gcs" {}` como configuración parcial: **no hay que descomentar
nada**, el bucket se pasa en el `init` del paso siguiente.

### 3. Variables, prueba y plan

```bash
cd infra/gcp
cp terraform.tfvars.example terraform.tfvars   # llenar proyecto y fase
# ⛔ El estado NO se guarda en el Mac. `versions.tf` declara el backend de
#    GCS como configuración parcial, así que el bucket se pasa aquí:
terraform init \
  -backend-config="bucket=$PROYECTO-tfstate" \
  -backend-config="prefix=casaroca/gcp"

# (Para solo validar o correr las pruebas, sin tocar el estado remoto:
#    terraform init -backend=false && terraform validate && terraform test)
terraform test                                  # no toca GCP: proveedores simulados
terraform plan -out=fase0.tfplan                # LEER el plan antes de seguir
terraform apply fase0.tfplan
```

El primer `apply` activa las APIs del proyecto. Si algún recurso falla con «API
not enabled» es la propagación de Google: esperar un minuto y repetir el `apply`.

### 4. Secretos de terceros (cuando existan)

Terraform crea los contenedores `casaroca-recaptcha-secreto`,
`casaroca-sendgrid-api-key` y `casaroca-payu-api-key` vacíos. El valor lo carga una
persona, sin que pase por un archivo:

```bash
read -rs VALOR && printf '%s' "$VALOR" | \
  gcloud secrets versions add casaroca-payu-api-key --data-file=- ; unset VALOR
```

Luego añadirlo a `secretos_cargados` en `terraform.tfvars` y `terraform apply`.
Un secreto sin valor no se monta: si se montara, el despliegue fallaría.

⛔ Sin `RECAPTCHA_SECRET` la API **no valida** el formulario público (modo
desarrollo, `src/comun/recaptcha.ts`). Tiene que estar cargado antes de abrir la
API. Sin `SENDGRID_API_KEY` los avisos quedan pendientes en la base y no se pierden.

### 5. Primer build (desde la raíz del repositorio)

```bash
gcloud builds submit --config infra/gcp/cloudbuild.yaml \
  --service-account=projects/casaroca-system-XXXX/serviceAccounts/casaroca-build@casaroca-system-XXXX.iam.gserviceaccount.com \
  --substitutions=_REGION=us-east1,_PREFIJO=casaroca .
```

**La primera vez este build se detiene en el paso `migrar`, y es lo esperado:** el
migrador aplica las migraciones y la semilla 001 y pide los datos de la sede
maestra. El mensaje lo dice con esas palabras.

### 6. Sede maestra y primera migración completa

Con los datos **reales** que entregue la Dirección General (nada de ejemplo):

```bash
gcloud run jobs execute casaroca-migrador --region=us-east1 --wait \
  --update-env-vars="SEDE_MAESTRA_CODIGO=XXX,SEDE_MAESTRA_NOMBRE=Nombre real,SEDE_MAESTRA_CIUDAD=Bogotá"
```

`--update-env-vars` en `execute` vale solo para esa ejecución; Terraform no ve
diferencias. Después, repetir el build del paso 5: el migrador dirá «0 archivos
aplicados» y la API se despliega.

Para ver qué aplicaría el migrador sin tocar nada:

```bash
gcloud run jobs execute casaroca-migrador --region=us-east1 --wait --args=--plan
```

La salida queda en Cloud Logging, en el Job.

### 7. Probar la API sin abrirla a internet

```bash
gcloud run services proxy casaroca-api --region=us-east1 --port=8080
# en otra terminal:
curl -i http://localhost:8080/api/v1/organizacion/sedes
```

El proxy usa la identidad de quien lo corre; la URL `*.run.app` sigue cerrada.

### 8. CI/CD desde GitHub

1. En la consola: Cloud Build → Repositorios (1.ª gen.) → Conectar repositorio →
   GitHub (app de Cloud Build) → autorizar en la organización **100p-NANO** y elegir
   `ecosistema-cr`. Esto exige una persona con permiso en GitHub; Terraform no puede.
2. `crear_disparador_github = true` y `terraform apply`.

Desde ahí, cada push a `main` que toque `backend/api/`, las migraciones, las
semillas, el migrador o `cloudbuild.yaml` construye, migra y despliega. El
prototipo (Netlify) y los documentos no disparan nada.

### 9. Dominio

1. Comprar `casaroca.io`.
2. `dominio_api = "api.casaroca.io"` y `terraform apply`.
3. Registro A de `api.casaroca.io` → la salida `ip_balanceador`.
4. Esperar el certificado (de 15 minutos a unas horas):
   `gcloud compute ssl-certificates list`. Mientras esté en `PROVISIONING` el
   balanceador no sirve HTTPS.

⚠️ Con balanceador, la API deja de aceptar tráfico directo en `*.run.app`: todo
entra por el balanceador. `casaroca.org` (cPanel) llama a `https://api.casaroca.io`;
su origen ya está en `cors_origenes`.

### 10. Cambiar de fase

`fase = 1` en `terraform.tfvars`, `terraform plan`, **leer**, `terraform apply`.

- Cambiar el tipo de máquina o activar la alta disponibilidad de Cloud SQL
  **reinicia la instancia** (minutos sin base). Hacerlo un martes en la noche.
- La fase 1 crea la VPC y Redis, y pone Cloud Armor **en modo vista previa**
  (`armor_solo_observar = true`): registra lo que bloquearía sin bloquear. Tras una
  semana leyendo los registros, pasarlo a `false`.
- Pasar a la fase 2 **reemplaza** Redis (básico → estándar): se pierde la caché.
- El compromiso de uso de 1 año (526 → 473 USD) se contrata en la consola, no en
  Terraform, y según el modelo financiero **después de tres meses estables**.

---

## El migrador de producción

`backend/scripts/migrar-produccion.sh`, empaquetado en `backend/Dockerfile.migrador`
y ejecutado como el Cloud Run Job `casaroca-migrador`.

⛔ **`backend/scripts/migrar.sh` NO se usa en producción: borra la base y la
recrea.** Este otro jamás borra nada.

- Aplica `backend/db/migrations/*.sql` y luego las semillas de producción, en el
  mismo orden que `migrar.sh`.
- Cada archivo corre en **una transacción junto con su registro** en
  `migraciones.historial` (tipo, archivo, huella SHA-256, fecha, ejecución). Si
  falla, se revierte ese archivo entero y los anteriores quedan; la siguiente
  corrida sigue desde ahí.
- **Se detiene sin aplicar nada si:** un archivo ya aplicado cambió de contenido;
  un archivo nuevo ordena antes del último aplicado; un archivo registrado
  desapareció del repositorio; o hay una semilla sin clasificar.
- Candado consultivo para que dos builds seguidos no apliquen el mismo archivo, y
  `lock_timeout` de 15 s para no quedarse colgado detrás de la API.
- Al final crea o actualiza el rol `casaroca_api` (con la clave del secreto) y lo
  verifica; y corre `db/tests/catalogos_no_vacios.sql` en una transacción que se
  revierte, como aviso.

### Semillas: qué va a producción y qué no

La lista es **explícita** dentro del script, no una convención de nombres. Una
semilla nueva que no esté clasificada detiene el migrador: así nadie sube una
demostración por olvido ni deja fuera un catálogo real.

| Va a producción | Por qué |
|---|---|
| 001, 003, 005 a 013, 015 a 018 | Catálogos, roles, matriz de permisos, fondos, cargos: la estructura que la base necesita para aceptar el primer dato real |
| `@sede_maestra` (en el lugar de la 002) | Solo la sede, con datos reales por variables de entorno. Sin personas |

| NO va a producción | Por qué |
|---|---|
| 002 `sedes_demo` | Crea un «Director General» inventado (nacido el 1970-01-01) con N4 sobre toda la organización |
| 004 `iglesias_demo` | Iglesias de ejemplo |
| 014 `atributo_ejemplo` | La casilla de ejemplo «qué le gusta comer» |

⚠️ Tres semillas de producción merecen revisión de quien lleva `backend/db/`:

- **006** mezcla catálogo (los roles de segmento) con los segmentos de RocaKids y
  tMt que su propio comentario llama «de demostración», cargados en la sede
  maestra. Además **aborta si no hay sede maestra** (por eso el paso
  `@sede_maestra` va antes). Conviene partirla en dos.
- **003** enciende en la sede maestra **todos** los módulos, incluidos los que
  exigen compuerta legal (RocaKids, aportes, consejería), con evidencia
  `PENDIENTE-H02 · demostración`. En producción hay que apagarlos desde el centro
  de mando hasta tener la evidencia real.
- **015** activa los ministerios solo en una sede cuyo nombre contenga «chic». Si
  la sede maestra real se llama distinto, se activan desde el centro de mando.

### Si un archivo aplicado cambió solo en un comentario

El migrador se detiene igual, a propósito. Re-sellarlo es un acto humano, con
alguien que revisó el diferencial:

```sql
-- conectado como postgres, con la huella del archivo actual (shasum -a 256 archivo.sql)
UPDATE migraciones.historial SET sha256 = '<huella nueva>'
 WHERE tipo = 'migracion' AND archivo = '00XX_nombre.sql';
```

Si cambió algo más que un comentario, no se re-sella: se escribe una migración nueva.

---

## Decisiones abiertas (Daniel y Jhon)

| # | Decisión | Quién | Por qué importa |
|---|---|---|---|
| 1 | **Autenticación real en la API** antes de `api_publica = true` | Daniel + desarrollo | Hoy la identidad es una cabecera que cualquiera escribe |
| 2 | **Comprar `casaroca.io`** (y decidir si el sistema central va en `app.casaroca.io` o `100p.casaroca.org`) | Daniel / Dirección | Sin dominio no hay balanceador ni certificado |
| 3 | **Contrato de procesador de datos (Ley 1581)** con Google para tratar datos en EE. UU. | Dirección + legal | El plan se apoya en él para usar `us-east1`; debe estar firmado antes del primer dato real, y la transferencia internacional declarada donde corresponda |
| 4 | **Quién paga la cuenta de GCP** y en qué moneda factura | Dirección financiera | Sin cuenta no hay presupuesto con alertas; si es en COP, el presupuesto se convierte a 4.050 |
| 5 | **Proveedor de correo:** SendGrid (plan de Jhon) o SES / Brevo / Mailjet (modelo financiero, por precio) | Jhon + finanzas | Terraform solo crea el secreto; el código de envío no existe |
| 6 | **Keycloak:** está en el modelo financiero (58 USD) y en el README de la API, no en el plan de Jhon | Jhon + Daniel | Es la pieza que cierra el punto 1 |
| 7 | **1,5 vCPU → 2** y **PITR 35 días → 7 + 35 respaldos** | Jhon | GCP no admite lo que dice el plan (tabla de ajustes) |
| 8 | **IP privada para Cloud SQL** | Jhon | Hoy entra solo por el conector (sin redes autorizadas); IP privada exige VPC desde la fase 0 |
| 9 | **Rotación de la llave N4** | Daniel + desarrollo | KMS rota la llave maestra; la llave N4 de pgcrypto no rota sola y rotarla exige recifrar |
| 10 | **Semillas:** los 6 catálogos vacíos, partir la 006, la sede maestra real y el primer Pastor Director General | quien lleva `backend/db/` | Sin eso la base migra pero no deja operar |
| 11 | **URLs firmadas para certificados** si se quiere CDN real para los PDF | Jhon | Un certificado lleva datos personales |
| 12 | **Retención de importaciones** (30 días por omisión) | Daniel / legal | Son CSV con datos personales |
| 13 | **Quién llama a `POST /api/v1/notificaciones/procesar`** cada minuto (Cloud Scheduler con identidad, o el Cloud Run Job de correos de la fase 2) | Jhon | Sin eso los correos se encolan y no salen. Cloud Scheduler no está en la tabla del plan; el token ya está en Secret Manager |

---

## Qué se validó y qué NO

**Validado en el Mac (18 sep 2026):**

- `terraform fmt -check`, `terraform init -backend=false` y `terraform validate`
  (Terraform 1.16.3, proveedor google 7.46.1): sin errores.
- `terraform test`: 6 casos con proveedores simulados, sin credenciales ni
  llamadas a GCP. Comprueban la tabla de cada fase, que la API no quede pública,
  que Redis y Cloud Armor no aparezcan en la fase 0, que una fase inexistente se
  rechace, y todas las ramas opcionales encendidas a la vez. Esta prueba encontró un
  error que `validate` no ve (la política de CDN exigía una llave de caché).
- `shellcheck` sobre el migrador y `hadolint` sobre los dos Dockerfile: limpios.
- **El migrador contra PostgreSQL 16 local**, en una base de prueba desechable:
  base vacía (se detiene pidiendo la sede maestra), aplicación completa (41
  migraciones + 16 pasos de semilla), segunda corrida (0 pendientes), migración
  aplicada que cambia, migración intercalada, migración que falla (se revierte),
  semilla sin clasificar y archivo registrado que desaparece. Además: el rol de la
  API no puede `SET ROLE casaroca_migrador` ni leer `migraciones.historial`.
- **Las etapas del Dockerfile de la API, sin Docker:** `npm ci`, compilación sin
  `test/`, dependencias solo de producción (23 MB) y arranque de `dist/src/main.js`
  contra la base de prueba.

**NO validado:**

- **Nada contra Google Cloud.** Ni `terraform plan` real, ni `apply`, ni Cloud
  Build, ni el socket `/cloudsql`, ni el certificado, ni Cloud Armor, ni las
  alertas. No hay proyecto ni `gcloud` en el Mac.
- **`docker build`**: no hay Docker en el Mac. Se simularon las etapas con npm.
- **El migrador en Cloud SQL.** Se probó como superusuario local; en Cloud SQL
  `postgres` NO es superusuario. Riesgo concreto: la migración 0008 hace
  `ALTER ROLE casaroca_migrador BYPASSRLS` y `ALTER ROLE casaroca_app NOBYPASSRLS`,
  y en PostgreSQL 16 tocar ese atributo exige tenerlo. Si Cloud SQL lo rechaza, el
  migrador se detiene en la 0008 con el error de PostgreSQL y hay que decidir cómo
  darle ese atributo al rol migrador. Las extensiones que usa la 0000 (pgcrypto,
  citext, unaccent) están en la lista de Cloud SQL. **Probar primero en la maqueta.**
- **Los costos.** Son las cifras del plan de Jhon, no recalculadas. Piezas que este
  Terraform crea y conviene sumar en el calculador: Artifact Registry (el modelo
  financiero estima 2 USD), 12 reglas de Cloud Armor, los minutos de Cloud Build y
  el disco de Cloud SQL.
