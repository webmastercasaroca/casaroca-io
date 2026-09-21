# =====================================================================
# Red privada y Memorystore Redis · solo desde la fase 1.
#
# Redis no tiene IP pública: vive en una VPC. La API llega a él por
# «Direct VPC egress» (sin conector de pago) y SOLO el tráfico a rangos
# privados sale por la VPC; el resto (Cloud SQL por el conector, APIs de
# terceros) sigue su camino normal.
#
# ⚠️ Hoy la API no usa Redis (no hay caché ni colas en el código). Se
#    crea porque el plan lo trae en la fase 1; REDIS_HOST y REDIS_PUERTO
#    quedan como variables de entorno para cuando el código lo use.
# ⚠️ Pasar de BASIC (fase 1) a STANDARD_HA (fase 2) REEMPLAZA la
#    instancia: se pierde lo que tenga. Es caché; no debe importar.
# =====================================================================
resource "google_compute_network" "privada" {
  count                   = local.hay_redis ? 1 : 0
  name                    = "${var.prefijo}-vpc"
  auto_create_subnetworks = false

  depends_on = [google_project_service.apis]
}

resource "google_compute_subnetwork" "run" {
  count                    = local.hay_redis ? 1 : 0
  name                     = "${var.prefijo}-run-${var.region}"
  region                   = var.region
  network                  = google_compute_network.privada[0].id
  ip_cidr_range            = "10.10.0.0/24" # Direct VPC egress toma IPs de aquí: /24 alcanza de sobra para 5 instancias
  private_ip_google_access = true
}

resource "google_redis_instance" "cache" {
  count          = local.hay_redis ? 1 : 0
  name           = "${var.prefijo}-redis"
  region         = var.region
  tier           = local.f.redis_tier
  memory_size_gb = local.f.redis_gb
  redis_version  = "REDIS_7_2"

  authorized_network = google_compute_network.privada[0].id
  connect_mode       = "DIRECT_PEERING"

  # ⛔ Con contraseña y con TLS. Sin esto, cualquier cosa dentro de la VPC
  #    podría leer la caché, y una caché de sesiones es una llave maestra.
  auth_enabled            = true
  transit_encryption_mode = "SERVER_AUTHENTICATION"
  customer_managed_key    = google_kms_crypto_key.datos.id

  maintenance_policy {
    weekly_maintenance_window {
      day = "TUESDAY"
      start_time {
        hours   = 8
        minutes = 0
      }
    }
  }

  depends_on = [google_kms_crypto_key_iam_member.agentes]
}
