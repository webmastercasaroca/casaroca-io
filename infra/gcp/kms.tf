# =====================================================================
# Cloud KMS: la llave maestra con rotación (fase 0 del plan).
#
# Cifra EN REPOSO, con llave propia (CMEK), la base de datos, el bucket,
# los secretos y Redis. Si la iglesia revoca esta llave, Google deja de
# poder leer esos datos: esa es la garantía que da CMEK frente al cifrado
# por omisión.
#
# ⛔ Una llave de KMS no se puede borrar de verdad (solo sus versiones, con
#    espera), y destruirla deja ilegible TODO lo que cifró. prevent_destroy
#    obliga a que borrarla sea una decisión escrita, no un efecto
#    secundario de un `terraform destroy`.
#
# ⚠️ La rotación crea versiones nuevas para lo que se cifre desde ese día;
#    NO rota APP_LLAVE_N4 (la llave con que pgcrypto cifra los campos N4
#    dentro de la base). Esa vive en Secret Manager y rotarla exige
#    recifrar los datos. Ver README, «decisiones abiertas».
# =====================================================================
resource "google_kms_key_ring" "principal" {
  name     = "${var.prefijo}-${var.region}"
  location = var.region

  depends_on = [google_project_service.apis]
}

resource "google_kms_crypto_key" "datos" {
  name            = "${var.prefijo}-datos"
  key_ring        = google_kms_key_ring.principal.id
  purpose         = "ENCRYPT_DECRYPT"
  rotation_period = "7776000s" # 90 días

  lifecycle {
    prevent_destroy = true
  }
}

# Las identidades de servicio de Google que usan la llave. Cada servicio
# cifra con SU agente; ninguna cuenta de la aplicación toca la llave.
resource "google_project_service_identity" "sql" {
  provider = google-beta
  project  = var.proyecto
  service  = "sqladmin.googleapis.com"

  depends_on = [google_project_service.apis]
}

resource "google_project_service_identity" "secretos" {
  provider = google-beta
  project  = var.proyecto
  service  = "secretmanager.googleapis.com"

  depends_on = [google_project_service.apis]
}

resource "google_project_service_identity" "redis" {
  count    = local.hay_redis ? 1 : 0
  provider = google-beta
  project  = var.proyecto
  service  = "redis.googleapis.com"

  depends_on = [google_project_service.apis]
}

data "google_storage_project_service_account" "gcs" {
  project = var.proyecto

  depends_on = [google_project_service.apis]
}

locals {
  agentes_cmek = merge(
    {
      sql      = "serviceAccount:${google_project_service_identity.sql.email}"
      secretos = "serviceAccount:${google_project_service_identity.secretos.email}"
      gcs      = "serviceAccount:${data.google_storage_project_service_account.gcs.email_address}"
    },
    local.hay_redis ? { redis = "serviceAccount:${google_project_service_identity.redis[0].email}" } : {},
  )
}

resource "google_kms_crypto_key_iam_member" "agentes" {
  for_each      = local.agentes_cmek
  crypto_key_id = google_kms_crypto_key.datos.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = each.value
}
