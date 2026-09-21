# =====================================================================
# APIs de Google que el sistema usa. Activarlas no cuesta; lo que cuesta
# es lo que se crea encima.
# ⛔ disable_on_destroy = false: un `terraform destroy` parcial no debe
#    apagar una API de la que dependen recursos que siguen vivos.
# =====================================================================
locals {
  apis = toset(concat(
    [
      "artifactregistry.googleapis.com",
      "cloudbuild.googleapis.com",
      "cloudkms.googleapis.com",
      "cloudresourcemanager.googleapis.com",
      "compute.googleapis.com",
      "iam.googleapis.com",
      "logging.googleapis.com",
      "monitoring.googleapis.com",
      "run.googleapis.com",
      "secretmanager.googleapis.com",
      "sqladmin.googleapis.com",
      "storage.googleapis.com",
    ],
    local.hay_redis ? ["redis.googleapis.com"] : [],
    var.cuenta_facturacion != "" ? ["billingbudgets.googleapis.com"] : [],
  ))
}

resource "google_project_service" "apis" {
  for_each           = local.apis
  project            = var.proyecto
  service            = each.value
  disable_on_destroy = false
}
