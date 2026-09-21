# =====================================================================
# Cuentas de servicio con MÍNIMO privilegio. Una por pieza, para que el
# compromiso de una no abra las otras.
#
#   api        se conecta a la base como casaroca_api y lee SUS secretos.
#   migrador   se conecta como administrador; lee la clave de postgres y
#              la de la API (para fijarla). No sirve tráfico.
#   frontend   no toca la base ni los secretos. Solo existe para no usar
#              la cuenta por omisión de Compute, que es Editor del proyecto.
#   construccion   Cloud Build: sube imágenes, actualiza el Job y el
#              servicio. No lee secretos.
# =====================================================================
resource "google_service_account" "api" {
  account_id   = "${var.prefijo}-api"
  display_name = "CasaRoca · API (Cloud Run)"
}

resource "google_service_account" "migrador" {
  account_id   = "${var.prefijo}-migrador"
  display_name = "CasaRoca · migrador de base (Cloud Run Job)"
}

resource "google_service_account" "frontend" {
  account_id   = "${var.prefijo}-frontend"
  display_name = "CasaRoca · frontend y servicios sin base (Cloud Run)"
}

resource "google_service_account" "construccion" {
  account_id   = "${var.prefijo}-build"
  display_name = "CasaRoca · Cloud Build (CI/CD)"
}

# ── Base de datos ──────────────────────────────────────────────────────
# ⚠️ cloudsql.client no se puede conceder por instancia; va a nivel de
#    proyecto. Solo permite ABRIR el túnel del conector: entrar exige
#    además la contraseña del rol, que cada cuenta lee de su secreto.
resource "google_project_iam_member" "sql_cliente" {
  for_each = {
    api      = google_service_account.api.member
    migrador = google_service_account.migrador.member
  }
  project = var.proyecto
  role    = "roles/cloudsql.client"
  member  = each.value
}

# ── Secretos, uno por uno, nunca a nivel de proyecto ───────────────────
locals {
  acceso_secretos = merge(
    {
      "api/db-api-clave"           = { secreto = "db-api-clave", cuenta = google_service_account.api.member }
      "api/app-llave-n4"           = { secreto = "app-llave-n4", cuenta = google_service_account.api.member }
      "api/notificaciones-token"   = { secreto = "notificaciones-token", cuenta = google_service_account.api.member }
      "migrador/db-postgres-clave" = { secreto = "db-postgres-clave", cuenta = google_service_account.migrador.member }
      "migrador/db-api-clave"      = { secreto = "db-api-clave", cuenta = google_service_account.migrador.member }
    },
    { for s in local.secretos_terceros : "api/${s}" => { secreto = s, cuenta = google_service_account.api.member } },
  )
}

resource "google_secret_manager_secret_iam_member" "acceso" {
  for_each  = local.acceso_secretos
  secret_id = google_secret_manager_secret.s[each.value.secreto].id
  role      = "roles/secretmanager.secretAccessor"
  member    = each.value.cuenta
}

# ── Cloud Build ────────────────────────────────────────────────────────
resource "google_artifact_registry_repository_iam_member" "construccion_sube" {
  location   = google_artifact_registry_repository.imagenes.location
  repository = google_artifact_registry_repository.imagenes.name
  role       = "roles/artifactregistry.writer"
  member     = google_service_account.construccion.member
}

# Actualizar la imagen del Job, ejecutarlo y desplegar la API.
# ⚠️ run.developer es de proyecto; acotarlo por recurso exige condiciones
#    de IAM que conviene añadir cuando haya más servicios en el proyecto.
resource "google_project_iam_member" "construccion_run" {
  project = var.proyecto
  role    = "roles/run.developer"
  member  = google_service_account.construccion.member
}

# `gcloud builds submit` (build manual) sube el código a PROYECTO_cloudbuild
# y el build lo lee con SU cuenta. Solo ese bucket: sin la condición, la
# cuenta de Cloud Build podría leer los certificados del bucket de archivos.
resource "google_project_iam_member" "construccion_fuente" {
  project = var.proyecto
  role    = "roles/storage.objectViewer"
  member  = google_service_account.construccion.member
  condition {
    title      = "solo-fuente-de-cloud-build"
    expression = "resource.name.startsWith(\"projects/_/buckets/${var.proyecto}_cloudbuild\")"
  }
}

resource "google_project_iam_member" "construccion_registros" {
  project = var.proyecto
  role    = "roles/logging.logWriter"
  member  = google_service_account.construccion.member
}

# Desplegar un servicio que corre como otra cuenta exige «actuar como» esa
# cuenta. Se concede solo sobre las cuentas que Cloud Build despliega.
resource "google_service_account_iam_member" "construccion_actua_como" {
  for_each = {
    api      = google_service_account.api.name
    migrador = google_service_account.migrador.name
    frontend = google_service_account.frontend.name
  }
  service_account_id = each.value
  role               = "roles/iam.serviceAccountUser"
  member             = google_service_account.construccion.member
}

# ── Bucket ─────────────────────────────────────────────────────────────
# La API escribe y lee certificados, respaldos y CSV. objectUser no
# permite cambiar los permisos del bucket ni borrarlo.
resource "google_storage_bucket_iam_member" "api_archivos" {
  bucket = google_storage_bucket.archivos.name
  role   = "roles/storage.objectUser"
  member = google_service_account.api.member
}
