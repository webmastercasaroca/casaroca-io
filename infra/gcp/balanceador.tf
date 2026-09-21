# =====================================================================
# Balanceador HTTPS (todas las fases), Cloud Armor (fase 1 en adelante)
# y Cloud CDN (fase 2). Solo se crea si hay dominio: sin dominio no hay
# certificado que emitir.
#
# ⚠️ El dominio de la iglesia es casaroca.org. El certificado gestionado queda en
#    PROVISIONING hasta que el DNS del dominio apunte a la IP de salida
#    `ip_balanceador`; mientras tanto el balanceador no sirve HTTPS.
#
# casaroca.org (la web pública en cPanel) NO pasa por aquí: sus
# formularios llaman a la API en el dominio de la API.
# =====================================================================
locals {
  dominios_cert = compact([var.dominio_api, local.hay_frontend ? var.dominio_app : ""])

  # Reglas OWASP preconfiguradas de Cloud Armor (familia v33).
  # Sensibilidad 1: la menos ruidosa. Subirla es decisión tras leer los
  # registros de la semana en modo vista previa.
  reglas_owasp = {
    1000 = "sqli-v33-stable"
    1001 = "xss-v33-stable"
    1002 = "lfi-v33-stable"
    1003 = "rfi-v33-stable"
    1004 = "rce-v33-stable"
    1005 = "methodenforcement-v33-stable"
    1006 = "scannerdetection-v33-stable"
    1007 = "protocolattack-v33-stable"
    1008 = "sessionfixation-v33-stable"
  }
}

resource "google_compute_global_address" "lb" {
  count = local.hay_balanceador ? 1 : 0
  name  = "${var.prefijo}-lb-ip"

  depends_on = [google_project_service.apis]
}

# ── Cloud Armor ────────────────────────────────────────────────────────
resource "google_compute_security_policy" "armor" {
  count       = local.hay_balanceador && local.f.armor ? 1 : 0
  name        = "${var.prefijo}-armor"
  description = "OWASP Top 10 + límite de tasa. Plan de costos, fase 1."
  type        = "CLOUD_ARMOR"

  dynamic "rule" {
    for_each = local.reglas_owasp
    content {
      priority = rule.key
      action   = "deny(403)"
      preview  = var.armor_solo_observar
      match {
        expr {
          expression = "evaluatePreconfiguredWaf('${rule.value}', {'sensitivity': 1})"
        }
      }
      description = "OWASP: ${rule.value}"
    }
  }

  # El formulario público de nuevos es lo único que se llama sin sesión:
  # es lo primero que un bot va a martillar.
  rule {
    priority = 900
    action   = "throttle"
    preview  = var.armor_solo_observar
    match {
      expr {
        expression = "request.path.startsWith('/api/v1/nuevos/registrar')"
      }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"
      rate_limit_threshold {
        count        = 20
        interval_sec = 60
      }
    }
    description = "Formulario de nuevos: 20 por minuto por IP"
  }

  # Techo general por IP. El plan dimensiona un pico de 120 peticiones por
  # segundo para TODA la iglesia; una sola IP a más de 10 por segundo
  # sostenidos no es una persona.
  rule {
    priority = 2000
    action   = "throttle"
    preview  = var.armor_solo_observar
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"
      rate_limit_threshold {
        count        = 600
        interval_sec = 60
      }
    }
    description = "Techo general: 600 por minuto por IP"
  }

  rule {
    priority = 2147483647
    action   = "allow"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Por omisión: permitir"
  }
}

# ── API detrás del balanceador ─────────────────────────────────────────
resource "google_compute_region_network_endpoint_group" "api" {
  count                 = local.hay_balanceador ? 1 : 0
  name                  = "${var.prefijo}-api-neg"
  region                = var.region
  network_endpoint_type = "SERVERLESS"
  cloud_run {
    service = google_cloud_run_v2_service.api.name
  }
}

resource "google_compute_backend_service" "api" {
  count                 = local.hay_balanceador ? 1 : 0
  name                  = "${var.prefijo}-api"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  protocol              = "HTTP"
  port_name             = "http"
  security_policy       = local.f.armor ? google_compute_security_policy.armor[0].id : null

  backend {
    group = google_compute_region_network_endpoint_group.api[0].id
  }

  # Fase 2: CDN para los PDF. USE_ORIGIN_HEADERS = solo se guarda en caché
  # lo que la API marque con Cache-Control público.
  # ⛔ Un certificado lleva datos personales: la API NUNCA debe marcarlo
  #    como público. Cachear PDFs exige URLs firmadas (decisión abierta).
  enable_cdn = local.f.cdn
  dynamic "cdn_policy" {
    for_each = local.f.cdn ? [1] : []
    content {
      cache_mode = "USE_ORIGIN_HEADERS"
      # La consulta entra en la llave: /certificado?id=1 y ?id=2 son
      # objetos distintos, nunca el mismo PDF servido a dos personas.
      cache_key_policy {
        include_host         = true
        include_protocol     = true
        include_query_string = true
      }
    }
  }

  log_config {
    enable      = true
    sample_rate = 1.0
  }
}

# ── Frontend detrás del balanceador (si existe) ────────────────────────
resource "google_compute_region_network_endpoint_group" "frontend" {
  count                 = local.hay_balanceador && local.hay_frontend && var.dominio_app != "" ? 1 : 0
  name                  = "${var.prefijo}-frontend-neg"
  region                = var.region
  network_endpoint_type = "SERVERLESS"
  cloud_run {
    service = google_cloud_run_v2_service.frontend[0].name
  }
}

resource "google_compute_backend_service" "frontend" {
  count                 = length(google_compute_region_network_endpoint_group.frontend)
  name                  = "${var.prefijo}-frontend"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  protocol              = "HTTP"
  port_name             = "http"
  security_policy       = local.f.armor ? google_compute_security_policy.armor[0].id : null

  backend {
    group = google_compute_region_network_endpoint_group.frontend[0].id
  }
}

# ── Rutas, certificado y reglas de reenvío ─────────────────────────────
resource "google_compute_url_map" "https" {
  count           = local.hay_balanceador ? 1 : 0
  name            = "${var.prefijo}-https"
  default_service = google_compute_backend_service.api[0].id

  dynamic "host_rule" {
    for_each = length(google_compute_backend_service.frontend) > 0 ? [1] : []
    content {
      hosts        = [var.dominio_app]
      path_matcher = "app"
    }
  }

  dynamic "path_matcher" {
    for_each = length(google_compute_backend_service.frontend) > 0 ? [1] : []
    content {
      name            = "app"
      default_service = google_compute_backend_service.frontend[0].id
    }
  }
}

resource "google_compute_managed_ssl_certificate" "principal" {
  count = local.hay_balanceador ? 1 : 0
  # El nombre cambia con los dominios: un certificado gestionado no se
  # edita, se reemplaza, y create_before_destroy evita quedar sin HTTPS.
  name = "${var.prefijo}-cert-${substr(md5(join(",", local.dominios_cert)), 0, 8)}"
  managed {
    domains = local.dominios_cert
  }
  lifecycle {
    create_before_destroy = true
  }
}

resource "google_compute_ssl_policy" "moderna" {
  count           = local.hay_balanceador ? 1 : 0
  name            = "${var.prefijo}-tls"
  profile         = "MODERN"
  min_tls_version = "TLS_1_2"
}

resource "google_compute_target_https_proxy" "principal" {
  count            = local.hay_balanceador ? 1 : 0
  name             = "${var.prefijo}-https"
  url_map          = google_compute_url_map.https[0].id
  ssl_certificates = [google_compute_managed_ssl_certificate.principal[0].id]
  ssl_policy       = google_compute_ssl_policy.moderna[0].id
}

resource "google_compute_global_forwarding_rule" "https" {
  count                 = local.hay_balanceador ? 1 : 0
  name                  = "${var.prefijo}-https"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  ip_address            = google_compute_global_address.lb[0].id
  port_range            = "443"
  target                = google_compute_target_https_proxy.principal[0].id
}

# HTTP → HTTPS. Nada viaja en claro, ni siquiera el primer salto.
resource "google_compute_url_map" "redireccion" {
  count = local.hay_balanceador ? 1 : 0
  name  = "${var.prefijo}-a-https"
  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

resource "google_compute_target_http_proxy" "redireccion" {
  count   = local.hay_balanceador ? 1 : 0
  name    = "${var.prefijo}-a-https"
  url_map = google_compute_url_map.redireccion[0].id
}

resource "google_compute_global_forwarding_rule" "http" {
  count                 = local.hay_balanceador ? 1 : 0
  name                  = "${var.prefijo}-http"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  ip_address            = google_compute_global_address.lb[0].id
  port_range            = "80"
  target                = google_compute_target_http_proxy.redireccion[0].id
}
