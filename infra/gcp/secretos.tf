# =====================================================================
# Secret Manager: siete secretos (el plan pide menos de diez).
#
#   db-postgres-clave   administrador de Cloud SQL. Solo lo lee el migrador.
#   db-api-clave        el rol casaroca_api. Lo leen el migrador (lo fija
#                       en la base) y la API (se conecta con él).
#   app-llave-n4        la llave con que pgcrypto cifra los campos N4.
#   notificaciones-token  protege POST /api/v1/notificaciones/procesar, la
#                       ruta que llama una máquina (sin sesión de persona)
#                       para vaciar la bandeja de correos.
#   recaptcha-secreto   } de terceros: Terraform crea el contenedor y una
#   sendgrid-api-key    } persona carga el valor con gcloud (README). No se
#   payu-api-key        } montan en la API hasta que están en
#                       } var.secretos_cargados.
#
# ⛔ Los cuatro primeros los GENERA Terraform con un recurso efímero y los
#    escribe en atributos de solo escritura: el valor nunca llega al
#    estado ni a un archivo. Nadie los teclea, nadie los ve.
# =====================================================================
locals {
  secretos_generados = ["db-postgres-clave", "db-api-clave", "app-llave-n4", "notificaciones-token"]
  secretos_terceros  = ["recaptcha-secreto", "sendgrid-api-key", "payu-api-key"]
}

resource "google_secret_manager_secret" "s" {
  for_each  = toset(concat(local.secretos_generados, local.secretos_terceros))
  secret_id = "${var.prefijo}-${each.value}"

  # Réplica en la MISMA región que la base, cifrada con la llave propia:
  # el secreto no sale de us-east1.
  replication {
    user_managed {
      replicas {
        location = var.region
        customer_managed_encryption {
          kms_key_name = google_kms_crypto_key.datos.id
        }
      }
    }
  }

  depends_on = [google_kms_crypto_key_iam_member.agentes]
}

# ── Contraseñas y llave N4, generadas sin pasar por el estado ─────────
ephemeral "random_password" "postgres" {
  length  = 40
  special = false # va en PGPASSWORD; sin símbolos se evita cualquier escape
}

ephemeral "random_password" "api" {
  length  = 40
  special = false
}

ephemeral "random_password" "notificaciones" {
  length  = 48
  special = false
}

ephemeral "random_password" "llave_n4" {
  length  = 64
  special = false
}

resource "google_secret_manager_secret_version" "postgres" {
  secret                 = google_secret_manager_secret.s["db-postgres-clave"].id
  secret_data_wo         = ephemeral.random_password.postgres.result
  secret_data_wo_version = var.version_claves_bd
}

resource "google_secret_manager_secret_version" "api" {
  secret                 = google_secret_manager_secret.s["db-api-clave"].id
  secret_data_wo         = ephemeral.random_password.api.result
  secret_data_wo_version = var.version_claves_bd
}

resource "google_secret_manager_secret_version" "notificaciones" {
  secret                 = google_secret_manager_secret.s["notificaciones-token"].id
  secret_data_wo         = ephemeral.random_password.notificaciones.result
  secret_data_wo_version = var.version_claves_bd
}

resource "google_secret_manager_secret_version" "llave_n4" {
  secret         = google_secret_manager_secret.s["app-llave-n4"].id
  secret_data_wo = ephemeral.random_password.llave_n4.result
  # ⛔ Versión FIJA en 1, a propósito, y sin variable: cambiar la llave N4
  #    deja ilegible todo lo cifrado con la anterior (códigos de entrega de
  #    menores, notas de consejería). Rotarla es un procedimiento de datos,
  #    no un cambio de infraestructura.
  secret_data_wo_version = 1

  lifecycle {
    prevent_destroy = true
  }
}
