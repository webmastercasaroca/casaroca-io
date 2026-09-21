# =====================================================================
# Artifact Registry (imágenes) y Cloud Storage (archivos).
# =====================================================================
resource "google_artifact_registry_repository" "imagenes" {
  location      = var.region
  repository_id = var.prefijo
  format        = "DOCKER"
  description   = "Imágenes de la API, el migrador y, cuando existan, frontend y trabajadores."

  # Sin limpieza, el registro crece con cada push a main y se paga.
  cleanup_policy_dry_run = false
  cleanup_policies {
    id     = "conservar-ultimas-15"
    action = "KEEP"
    most_recent_versions {
      keep_count = 15
    }
  }
  cleanup_policies {
    id     = "borrar-viejas"
    action = "DELETE"
    condition {
      older_than = "2592000s" # 30 días
    }
  }

  depends_on = [google_project_service.apis]
}

# ---------------------------------------------------------------------
# Un bucket, con prefijos:
#   certificados/   PDFs que expide el sistema (fase 2: ~500 GB)
#   respaldos/      exportes de la base
#   importaciones/  CSV de carga. Datos personales: se borran solos.
#
# ⛔ Acceso uniforme y prevención de acceso público OBLIGATORIA: ningún
#    objeto puede quedar público por error, ni siquiera con una ACL.
#    Un certificado se entrega por la API o con URL firmada, nunca por
#    enlace abierto.
# ---------------------------------------------------------------------
resource "google_storage_bucket" "archivos" {
  name                        = "${var.proyecto}-${var.prefijo}-archivos"
  location                    = upper(var.region)
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  versioning {
    enabled = true
  }

  encryption {
    default_kms_key_name = google_kms_crypto_key.datos.id
  }

  # Papelera de 7 días: un borrado por error se recupera.
  soft_delete_policy {
    retention_duration_seconds = 604800
  }

  lifecycle_rule {
    condition {
      matches_prefix = ["importaciones/"]
      age            = var.dias_retencion_importaciones
    }
    action {
      type = "Delete"
    }
  }

  # Versiones viejas (sobrescritas o borradas): 30 días y fuera.
  lifecycle_rule {
    condition {
      days_since_noncurrent_time = 30
      with_state                 = "ARCHIVED"
    }
    action {
      type = "Delete"
    }
  }

  # Los respaldos se leen poco: a Nearline al mes.
  lifecycle_rule {
    condition {
      matches_prefix = ["respaldos/"]
      age            = 30
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  depends_on = [google_kms_crypto_key_iam_member.agentes]
}
