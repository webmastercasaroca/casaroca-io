# PUESTA EN MARCHA EN GOOGLE CLOUD
### De «acabo de pagar la cuenta» a «el sistema está en línea», en orden

> 19 de septiembre de 2026 · Para Daniel y para quien opere la central.
> Este documento es el **camino**. El de referencia, con el detalle de cada recurso y cada
> decisión, es `infra/gcp/README.md`; el inventario de lo que existe y cuánto cuesta es
> `docs/INFRA.md`; lo que se hace cuando algo se rompe es `docs/RUNBOOK.md`.
>
> ⛔ **Nada de esto se ha aplicado todavía.** La infraestructura está escrita y probada con
> proveedores simulados (`terraform test`), no contra una cuenta real. Este documento existe
> justamente para que el día que se active la cuenta no haya que inventar nada.

---

## 0 · Lo que hay que tener antes de empezar

**En la mano (esto es tuyo, no del código):**

| Qué | Dónde se consigue | Sin esto |
|---|---|---|
| Una **cuenta de facturación** de Google Cloud | console.cloud.google.com/billing · tarjeta o convenio | No se crea nada |
| Rol **«Administrador de presupuestos»** en esa cuenta | La misma consola, pestaña de permisos | Se crea todo menos la alarma de gasto, que es justo la que evita el susto |
| Decidir el **dominio** | `casaroca.io` (por comprar) o `100p.casaroca.org` (ya se tiene) | No hay balanceador, ni certificado, ni sonda externa |
| El **nombre del guardia dominical** y de la segunda persona que sabe operar | Decisión de la iglesia | El sistema queda con un punto único de fallo que ninguna nube arregla |

**En la máquina desde la que se aplica:**

```bash
gcloud --version          # SDK de Google Cloud
terraform -version        # 1.11 o superior
psql --version            # PostgreSQL 16 (cliente)
node --version            # 20 o superior
```

> ✅ **El código de Terraform está validado de verdad**, no solo escrito: el 19 de septiembre de
> 2026 se corrieron `terraform validate`, `terraform fmt -check -recursive` y `terraform test`
> (6 casos, proveedores simulados) con Terraform 1.13.3, y pasaron los tres. Lo que **no** se ha
> hecho es un `plan` o un `apply` contra una cuenta real, porque no existe todavía: esa es la
> diferencia entre «el código es correcto» y «la infraestructura está creada».
>
> En macOS sin Homebrew, el binario se baja directo:
> `curl -LO https://releases.hashicorp.com/terraform/1.13.3/terraform_1.13.3_darwin_arm64.zip`

**Presupuesto:** la fase 2 (producción) está calculada en **526 USD/mes** ≈ 2.130.300 COP a
4.050 COP/USD. El colchón aprobado es de 2.500.000 COP/mes. Las fases 0 y 1 cuestan 35 y 218
USD/mes: se empieza por ahí a propósito, no por ahorrar, sino para que un error de configuración
cueste 35 dólares y no 526.

---

## 1 · Crear el proyecto y encender la facturación

```bash
export PROYECTO="casaroca-system-prod"        # el nombre queda para siempre
export FACTURACION="XXXXXX-XXXXXX-XXXXXX"     # de la consola de facturación
export REGION="us-east1"

gcloud projects create "$PROYECTO" --name="CasaRoca System"
gcloud billing projects link "$PROYECTO" --billing-account="$FACTURACION"
gcloud config set project "$PROYECTO"
gcloud auth application-default login
```

**Cómo sé que funcionó:**

```bash
gcloud billing projects describe "$PROYECTO" --format="value(billingEnabled)"   # → True
```

> 💡 **Haz esto DOS veces**: una para `casaroca-system-staging` y otra para
> `casaroca-system-prod`. «Staging es producción» no es un ambiente; es la forma más común de
> probar cosas con datos de personas reales.

---

## 2 · El bucket del estado de Terraform (una sola vez por proyecto)

El estado describe toda la infraestructura. Si vive en un portátil, dos personas aplicando se
pisan y si se pierde el portátil se pierde el mapa.

```bash
gcloud storage buckets create "gs://$PROYECTO-tfstate" \
  --location="$REGION" --uniform-bucket-level-access --public-access-prevention
gcloud storage buckets update "gs://$PROYECTO-tfstate" --versioning
```

**Cómo sé que funcionó:**

```bash
gcloud storage buckets describe "gs://$PROYECTO-tfstate" --format="value(versioning.enabled)"  # → True
```

---

## 3 · Validar antes de tocar nada

```bash
cd infra/gcp

# Sin backend: no toca el estado remoto, no toca GCP, no cuesta nada.
terraform init -backend=false
terraform fmt -check
terraform validate
terraform test          # proveedores simulados: 6 casos de las fases
```

**Si `terraform validate` marca un error, PARE aquí.** Es exactamente lo que este paso existe
para encontrar, y es gratis. No siga al paso 4 con un error de sintaxis pendiente.

Lo que tiene que salir (es lo que salió el 19 de septiembre de 2026):

```
Success! The configuration is valid.
...
Success! 6 passed, 0 failed.
```

---

## 4 · Las variables del proyecto

```bash
cp terraform.tfvars.example terraform.tfvars
```

Lo mínimo que hay que rellenar:

```hcl
proyecto           = "casaroca-system-prod"
region             = "us-east1"
fase               = 0                       # ⛔ se EMPIEZA en 0, siempre
prefijo            = "casaroca"

cuenta_facturacion = "XXXXXX-XXXXXX-XXXXXX"  # sin esto no hay alarma de gasto
moneda_facturacion = "USD"
correos_alertas    = ["100p@casaroca.org"]   # a un buzón que alguien LEA

api_publica        = false                   # se abre al final, no ahora
dominio_api        = ""                      # vacío hasta decidir el dominio
dominio_app        = ""
armor_solo_observar = false                  # el cortafuegos bloquea, no mira
proteger_borrado   = true                    # en producción, SIEMPRE
```

> ⛔ `terraform.tfvars` **no se versiona**. Lleva identificadores de facturación.

---

## 5 · El primer `apply`, en fase 0

```bash
terraform init \
  -backend-config="bucket=$PROYECTO-tfstate" \
  -backend-config="prefix=casaroca/gcp"

terraform plan -out=fase0.tfplan
```

**Lea el plan.** No es una formalidad: es el único momento en que se ve lo que se va a crear
antes de que exista y de que empiece a costar. Busque tres cosas:

1. Que **no** diga `destroy` en nada (es la primera vez: todo debería ser `create`).
2. Que el `google_sql_database_instance` sea `db-f1-micro` (fase 0), no algo más grande.
3. Que aparezca `google_billing_budget.fase`. Si no aparece, falta `cuenta_facturacion` y se
   estaría creando infraestructura sin alarma de gasto.

```bash
terraform apply fase0.tfplan
```

Tarda entre 10 y 20 minutos, casi todo Cloud SQL.

**Cómo sé que funcionó:**

```bash
terraform output                     # fase, urls, conexión, secretos por cargar
gcloud sql instances list
gcloud run services list
```

---

## 6 · Los secretos

Terraform **genera solo** los cuatro secretos internos (la contraseña del administrador de la
base, la del rol de la API, la llave N4 y el token de notificaciones) con un recurso efímero:
el valor nunca pasa por el estado, ni por un archivo, ni por los ojos de nadie.

Los de terceros los carga una persona, cuando existan:

```bash
terraform output secretos_por_cargar      # dice cuáles faltan

printf '%s' "EL-VALOR-REAL" | gcloud secrets versions add recaptcha-secreto --data-file=-
printf '%s' "EL-VALOR-REAL" | gcloud secrets versions add sendgrid-api-key  --data-file=-
printf '%s' "EL-VALOR-REAL" | gcloud secrets versions add payu-api-key      --data-file=-
```

Y luego se declaran como cargados, para que la API los monte:

```hcl
secretos_cargados = ["recaptcha-secreto", "sendgrid-api-key"]
```

```bash
terraform apply
```

> ⛔ **Toda credencial recibida de un tercero se rota el mismo día.** La que le pasen por
> WhatsApp ya no es secreta.

---

## 7 · Construir la imagen y migrar la base

Desde la raíz del repositorio:

```bash
gcloud builds submit --config=infra/gcp/cloudbuild.yaml \
  --substitutions=_REGION="$REGION"
```

La primera migración pide la **sede maestra con datos reales** (producción no lleva la semilla
que inventa una iglesia y una persona con N4 sobre toda la red):

```bash
gcloud run jobs execute "$(terraform -chdir=infra/gcp output -raw job_migrador)" --wait
```

**Cómo sé que funcionó:**

```bash
gcloud run jobs executions list --job="$(terraform -chdir=infra/gcp output -raw job_migrador)"
```

El migrador deja en su registro el número de migraciones aplicadas y avisa si algún catálogo
bloqueante quedó vacío.

---

## 8 · El primer Pastor Director General

No lo crea una semilla: lo crea una persona, a mano, y es la única cuenta que después crea a las
demás.

```bash
node backend/scripts/crear-cuenta.js "Nombre Apellido" "correo@casaroca.org" "una frase larga y propia"
```

La primera vez que entre, el sistema **le exigirá configurar el segundo factor** (es rol N4).
Que lo haga en ese momento, con la aplicación de autenticación ya instalada en el teléfono.

---

## 9 · Probar SIN abrir la API a internet

```bash
gcloud run services proxy casaroca-api --region="$REGION" --port=8080
# en otra terminal:
curl -s localhost:8080/salud/detalle | jq
```

Lo que tiene que decir: `estado: "sano"`, la base respondiendo, las particiones en `BIEN` y
`fugasDeLectura: 0`. Si `fugasDeLectura` no es cero, **eso se atiende antes que cualquier otra
cosa**: hay una tabla legible sin política.

---

## 10 · Subir de fase, cuando toque

No se salta de la 0 a la 2. Cada salto se mira en el plan antes de aplicarse.

```hcl
fase = 1        # y luego, cuando el uso lo pida, fase = 2
```

```bash
terraform plan -out=fase1.tfplan     # LEER
terraform apply fase1.tfplan
```

| Fase | Qué añade | USD/mes |
|---|---|---|
| 0 | Base mínima, API y frontend, una instancia | 35 |
| 1 | Alta disponibilidad en la base, Redis, Cloud Armor, más instancias | 218 |
| 2 | Base más grande, PITR, portal Pastoral, **alertas**, Redis en alta disponibilidad | 526 |

> 🟠 **Las alertas solo se encienden en la fase 2.** Si el arranque real va a pasar semanas en la
> fase 1, hay que encender `monitoreo` a mano en esa fase: estar sin alertas «un ratito» suele
> durar meses.

---

## 11 · El dominio, y solo entonces internet

```hcl
dominio_api = "api.casaroca.org"      # o el que se decida
dominio_app = "app.casaroca.org"
```

```bash
terraform apply
terraform output ip_balanceador       # → registro A en el DNS
```

Al rellenar el dominio se encienden además, solos: el certificado gestionado, HSTS, la
redirección 301 desde HTTP y **la sonda externa de disponibilidad**, que es la única alerta que
sigue viva si el proyecto entero se cae.

**Abrir la API a internet es el ÚLTIMO paso**, y solo con estas tres casillas marcadas:

- [ ] `recaptcha-secreto` cargado
- [ ] Cloud Armor bloqueando de verdad (`armor_solo_observar = false`)
- [ ] Prueba de intrusión externa hecha por alguien de fuera (compuerta G5)

```hcl
api_publica = true
```

---

## 12 · Antes de decir que está en producción

| Comprobación | Cómo |
|---|---|
| La compuerta completa en verde | `cd backend && ./scripts/verificar.sh` |
| Copia **y restauración** ejecutadas de verdad | `./scripts/respaldar.sh && ./scripts/restaurar.sh` |
| La alarma de gasto existe | `gcloud billing budgets list --billing-account="$FACTURACION"` |
| La sonda externa responde | Consola → Monitoring → Uptime checks |
| Un check-in y una entrega reales en RocaKids | Con una familia de prueba, en una sede, un domingo cualquiera |
| El nombre del guardia dominical está escrito | `docs/RUNBOOK.md`, punto 10 |

---

## 13 · Si hay que deshacerlo

```bash
terraform plan -destroy -out=deshacer.tfplan     # LEER, con calma
terraform apply deshacer.tfplan
```

`proteger_borrado = true` impide que Cloud SQL se borre por accidente: hay que ponerlo en
`false` a propósito y aplicar antes. Es deliberado.

> ⛔ **Un `destroy` en producción borra la base.** Antes de escribir ese comando: copia hecha,
> copia **restaurada** en otro sitio y comprobada, y una segunda persona mirando la pantalla.

---

## 14 · Lo que sigue sin depender de la nube

Cuatro cosas que ninguna noche de trabajo cambia, porque no son código:

1. **Aplicar Terraform** necesita la cuenta de facturación activa. Es el paso 1 de este
   documento y es de Daniel.
2. **La prueba de intrusión externa** la hace un tercero. La nuestra no cuenta: es la nuestra.
3. **El registro ante la SIC** como Responsable de Tratamiento (Ley 1581). Es trámite, y tiene
   plazo legal.
4. **Una segunda persona que sepa operar esto.** Mientras sea una sola, el sistema tiene un
   punto único de fallo que ningún respaldo arregla. Este documento está escrito para que esa
   segunda persona pueda seguirlo sin haber estado aquí.
