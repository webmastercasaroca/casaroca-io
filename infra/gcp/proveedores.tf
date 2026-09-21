provider "google" {
  project = var.proyecto
  region  = var.region

  # Todas las piezas llevan estas etiquetas: permiten leer la factura por
  # fase y saber qué creó Terraform y qué alguien a mano.
  default_labels = local.etiquetas
}

provider "google-beta" {
  project        = var.proyecto
  region         = var.region
  default_labels = local.etiquetas
}

data "google_project" "este" {
  project_id = var.proyecto
}
