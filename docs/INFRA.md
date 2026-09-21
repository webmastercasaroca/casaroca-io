# INFRA · Inventario de recursos
### Qué corre dónde, con qué identificador y cuánto cuesta

> 19 de septiembre de 2026 · **Documento vivo.** Si un recurso no está aquí, no existe para la operación: nadie sabe que hay que pagarlo, vigilarlo ni apagarlo.
> ⛔ **Estado: la infraestructura está ESCRITA y NO APLICADA.** Ver «Estado real» al final.

---

## 1 · Ambientes

| Ambiente | Para qué | Proyecto GCP | Estado |
|---|---|---|---|
| `desarrollo` | El portátil de quien construye | ninguno (PostgreSQL local, puerto 5433) | ✅ funciona |
| `staging` | Igual que producción, con datos sintéticos | `casaroca-staging` | 🔴 sin crear |
| `produccion` | La red real | `casaroca-prod` | 🔴 sin crear |

**⛔ «Staging es producción» no es un ambiente.** Los tres son reales y separados, con secretos distintos y sin una sola persona real fuera de producción.

## 2 · Recursos declarados en Terraform (`infra/gcp/`)

> **Corregido el 19 de septiembre de 2026.** La versión anterior de esta tabla cobraba un
> **Keycloak que no existe** en ningún `.tf`, se saltaba el servicio **Pastoral** que sí existe,
> afirmaba que la base **no tiene IP pública** (la tiene: `ipv4_enabled = true`) y daba unos
> umbrales de presupuesto que no son los aplicados. Un inventario que no coincide con el código
> es peor que no tenerlo: se presupuesta y se vigila lo que no hay.
>
> **La cifra que manda no es esta tabla: es `local.fases[<fase>].presupuesto_usd` en
> `infra/gcp/fases.tf`, que es la que Terraform convierte en el presupuesto con alerta.**
> Fase 0 = 35 · Fase 1 = 218 · **Fase 2 (producción) = 526 USD/mes**.

**16 archivos `.tf`** en `infra/gcp/` (más `cloudbuild.yaml`, `terraform.tfvars.example`, `README.md` y `tests/`).

| Recurso | Dónde está declarado | Para qué | Fase en que se enciende |
|---|---|---|---|
| Cloud SQL PostgreSQL 16 | `sql.tf` · `google_sql_database_instance.principal` | La base. RLS, auditoría, particiones | 0 (crece por fase) |
| Cloud Run · API | `run.tf` · `google_cloud_run_v2_service.api` | La API NestJS | 0 |
| Cloud Run · Frontend | `run.tf` · `google_cloud_run_v2_service.frontend` | El sitio | 0 |
| Cloud Run · Pastoral | `run.tf` · `google_cloud_run_v2_service.pastoral` | Portal pastoral | **2** (antes `pastoral_cpu = 0`) |
| Memorystore Redis | `red_y_redis.tf` · `google_redis_instance.cache` | Colas y caché | 1 (`BASIC`), 2 (`STANDARD_HA`) |
| Red privada y acceso de servicio | `red_y_redis.tf` · `google_compute_network.privada` | Salida privada hacia Redis y Cloud SQL | 1 |
| Balanceador HTTPS | `balanceador.tf` · `google_compute_*` | TLS, dominio, redirección 301 | Cuando haya dominio |
| Cloud Armor | `balanceador.tf` · `google_compute_security_policy.armor` | OWASP + límite de tasa | 1 |
| Cloud KMS | `kms.tf` · `google_kms_crypto_key.datos` | **La llave que cifra los datos N4** | 0 |
| Secret Manager | `secretos.tf` · `google_secret_manager_secret.s` | Contraseñas, secretos, llaves de terceros | 0 |
| Artifact Registry | `almacenamiento.tf` · `google_artifact_registry_repository.imagenes` | Imágenes de contenedor | 0 |
| Cloud Build | `ci.tf` · `google_cloudbuild_trigger.main` | Construcción y despliegue | 0 |
| Logging | `observabilidad.tf` · `google_logging_project_bucket_config` | Logs centralizados (7 / 30 / 90 días) | 0 |
| Alertas | `observabilidad.tf` · `google_monitoring_alert_policy.*` | 5xx de la API, CPU y disco de la base, fallo del migrador | **2** (`monitoreo = true`) |
| Presupuesto con alerta | `observabilidad.tf` · `google_billing_budget.fase` | Avisos al **50 %, 90 %, 100 % y 100 % previsto** | Cualquiera, si hay `cuenta_facturacion` |

**⛔ Lo que este inventario NO tiene, y conviene decirlo:**

- **No hay Keycloak.** La identidad la resuelve la propia API (contraseña con `scrypt`, JWT corto
  y segundo factor TOTP para los roles N4). Si algún día se mete un proveedor externo, entra aquí
  con su costo antes de encenderse.
- **La base SÍ tiene IP pública** (`sql.tf`, `ipv4_enabled = true`). Lo que la protege no es la
  ausencia de IP: es que exige **certificado de cliente de confianza**
  (`ssl_mode = "TRUSTED_CLIENT_CERTIFICATE_REQUIRED"`) y que **no hay ninguna red autorizada**.
  Es una decisión defendible, pero hay que decirla como es. Cerrar la IP pública del todo
  (`ipv4_enabled = false`, solo IP privada) es el siguiente paso y está anotado en el estado real.
- **Las alertas no existen en fase 0 ni en fase 1.** `monitoreo` solo es `true` en la fase 2. En
  las dos primeras fases nadie se entera de un 5xx ni de un disco lleno salvo mirando. Si el
  arranque real va a estar semanas en fase 1, hay que encender `monitoreo` a mano en esa fase.

## 3 · Alertas configuradas

| Alerta | Umbral | A dónde | Quién responde | Estado |
|---|---|---|---|---|
| 5xx de la API | tasa sostenida | `correos_alertas` | Guardia de Sistemas | ✅ escrita (fase 2) |
| CPU de Cloud SQL | > 80 % por 10 min | `correos_alertas` | Guardia de Sistemas | ✅ escrita (fase 2) |
| Disco de Cloud SQL | > 85 % | `correos_alertas` | Guardia de Sistemas | ✅ escrita (fase 2) |
| Fallo del migrador | cualquier fallo | `correos_alertas` | Quien desplegó | ✅ escrita (fase 2) |
| Presupuesto | **50 %, 90 %, 100 % y 100 % previsto** | canales de `correos_alertas` | Dirección Administrativa | ✅ escrita (toda fase) |
| Particiones con hueco | `v_salud_particiones` ≠ BIEN | 🔴 pendiente de cablear | Sistemas | vista lista |
| Fugas de lectura | `v_control_rls` > 0 | 🔴 pendiente de cablear | Sistemas | vista lista |
| Peticiones de titular vencidas | > 0 | 🔴 pendiente de cablear | Legal | vista lista |
| Antecedentes por vencer | < 30 días | 🔴 pendiente de cablear | RocaKids Global | vista lista |
| **Sonda externa de disponibilidad** | `/salud` no responde | 🔴 **no existe** | Sistemas | falta el `uptime_check` |

Las cinco últimas: las cuatro primeras tienen su vista en la base y falta cablearlas al canal
(`infra/gcp/observabilidad.tf`); la sonda externa no está escrita en ninguna parte. Sin ella,
si Cloud Run se cae entero, no hay quien avise: las alertas viven dentro del mismo proyecto que
se cayó.

## 3b · El estado de Terraform

> 🔴 **Hoy el `backend "gcs"` está COMENTADO** en `infra/gcp/versions.tf`. Eso significa que el
> estado se guardaría en el portátil de quien corra `terraform apply`. Con estado local:
> dos personas aplicando pisan la infraestructura la una de la otra, no hay bloqueo, y si se
> pierde el portátil se pierde el mapa de lo que existe en la nube.

Antes del primer `apply` de verdad:

1. Crear el bucket del estado, con versiones:
   ```bash
   gsutil mb -p "$PROYECTO" -l us-east1 "gs://$PROYECTO-tfstate"
   gsutil versioning set on "gs://$PROYECTO-tfstate"
   ```
2. Descomentar el bloque `backend "gcs"` en `versions.tf` (o dejarlo como configuración parcial
   y pasar el bucket en el `init`):
   ```bash
   terraform init -backend-config="bucket=$PROYECTO-tfstate" -backend-config="prefix=casaroca/gcp"
   ```
3. Comprobar que `terraform state list` responde desde otra máquina antes de seguir.

## 4 · Secretos y dónde viven

| Secreto | Dónde debe vivir | Hoy |
|---|---|---|
| `APP_LLAVE_N4` (cifra datos críticos) | **Cloud KMS**, envuelto | 🟠 variable de entorno; la aplicación **se niega a arrancar** en producción con un valor de desarrollo |
| `APP_JWT_SECRETO` | Secret Manager | 🟠 igual |
| Contraseña de la base | Secret Manager | 🔴 sin aplicar |
| Llave de la pasarela de pagos | Secret Manager | 🔴 sin aplicar |
| `CASAROCA_LLAVE_RESPALDO` | Secret Manager | 🔴 sin aplicar |

**⛔ Regla:** toda credencial recibida de un tercero se rota el mismo día.

## 5 · Copias de seguridad

| Qué | Cómo | Retención | Probado |
|---|---|---|---|
| Cloud SQL, copias automáticas | `sql.tf` · `backup_configuration` | 7 / 14 / 30 días según la fase | 🔴 sin aplicar |
| Cloud SQL, punto en el tiempo (PITR) | `sql.tf` · `sql_pitr` | Solo **fase 2** | 🔴 sin aplicar |
| Copia lógica diaria | `scripts/respaldar.sh` | 30 días | ⚠️ ejecutada **en desarrollo y SIN cifrar** |
| **Restauración** | `scripts/restaurar.sh` | | ✅ **ejecutada el 19 sep 2026** · ver `backend/docs/EVIDENCIA-restauracion.txt` |

> ⚠️ **El cifrado de la copia lógica no es automático.** `respaldar.sh` cifra solo si está
> `CASAROCA_LLAVE_RESPALDO`; sin esa variable deja el volcado en claro y lo avisa por pantalla.
> En desarrollo eso es aceptable y es lo que se ejecutó. **En staging y producción el guion se
> planta** y no deja un volcado con datos N3 y N4 sin cifrar. Decir «copia cifrada ✅ ejecutada»
> mezclaba las dos cosas: lo ejecutado fue una copia de desarrollo sin cifrar.
>
> `CASAROCA_LLAVE_RESPALDO` es **otra llave**, distinta de la N4, y no se guarda en el mismo
> sitio: si las dos viven juntas, tener dos no sirve de nada.

## 6 · Dominios y TLS

> 🟠 **El dominio todavía no está decidido, y este documento lo daba por decidido.**
> `infra/gcp/README.md` (punto 2 de sus pendientes) deja abierta la compra de `casaroca.io` y la
> elección entre `app.casaroca.io` y `100p.casaroca.org`. Es una decisión de Daniel y la
> Dirección, no técnica. Mientras no se cierre, `dominio_api` y `dominio_app` van vacíos y **no
> se crea balanceador ni certificado**: Terraform está escrito para que eso no rompa nada.

| Dominio | A dónde | Estado |
|---|---|---|
| `api.<dominio elegido>` | Cloud Run · API | 🔴 sin decidir ni crear |
| `app.<dominio elegido>` o `100p.casaroca.org` | Cloud Run · Frontend | 🔴 sin decidir ni crear |
| `casaroca-system.netlify.app` | El sitio actual | ✅ en línea |

Cuando haya dominio: certificado gestionado por Google, política TLS moderna, HSTS y redirección
301 desde HTTP. Todo eso ya está escrito en `balanceador.tf` y se enciende solo al rellenar la
variable.

## 7 · Estado real, sin suavizarlo

**Lo que está listo:** 16 archivos de Terraform con la infraestructura completa, una prueba de Terraform (`infra/gcp/tests/fases.tftest.hcl`), integración continua escrita, y los scripts de copia, restauración, despliegue y verificación **probados en local**.

**Lo que falta, y es trabajo de una tarde con las llaves en la mano:**
1. Crear los proyectos de GCP (`casaroca-staging` y `casaroca-prod`) y habilitar la facturación. **Lo hace Daniel o la mesa: exige una cuenta de facturación.**
2. `terraform apply` sobre staging y comprobar `docs/INFRA.md` contra lo creado.
3. Cargar los secretos en Secret Manager y envolver la llave N4 con KMS.
4. Apuntar los dominios.
5. Cablear las cuatro alertas que faltan **y añadir la sonda externa de disponibilidad**, que hoy no existe.
6. Crear el bucket del estado de Terraform y activar el `backend "gcs"` (punto 3b) **antes** del primer `apply`.
7. Primer despliegue a staging, corrida de carga y luego producción.

**Los dos bloqueos que `infra/gcp/README.md` declaraba como impedimentos para producción quedaron cerrados el 19 de septiembre de 2026:**
- «La API no puede abrirse a internet: toma la identidad de la cabecera `X-Persona-Id`» → **cerrado**, hay autenticación real con token, sesión revocable y segundo factor obligatorio para N3 y N4, con 19 pruebas de punta a punta.
- «Seis catálogos quedan vacíos con las semillas de producción» → **cerrado**, los cinco catálogos bloqueantes están sembrados (seed 019) y hay una prueba que falla si alguno vuelve a quedar vacío.

Con esos dos cerrados, `api_publica = true` deja de estar prohibido. Lo que queda antes de abrirla es la prueba de intrusión externa de la compuerta G5.
