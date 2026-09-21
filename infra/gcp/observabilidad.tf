# =====================================================================
# Registros, alertas y presupuesto.
#
# Retención de registros según el plan: 7 días (fase 0), 30 (fase 1),
# 90 (fase 2). Pasar de 30 días tiene costo de retención: está incluido
# en la cifra de la fase 2.
# =====================================================================
resource "google_logging_project_bucket_config" "por_omision" {
  project        = var.proyecto
  location       = "global"
  bucket_id      = "_Default"
  retention_days = local.f.logs_dias

  depends_on = [google_project_service.apis]
}

# Un canal por correo. Lo usan el presupuesto (todas las fases) y las
# alertas (fase 2).
resource "google_monitoring_notification_channel" "correo" {
  for_each     = toset(var.correos_alertas)
  display_name = "CasaRoca · ${each.value}"
  type         = "email"
  labels = {
    email_address = each.value
  }

  depends_on = [google_project_service.apis]
}

locals {
  canales       = [for c in google_monitoring_notification_channel.correo : c.id]
  hay_alertas   = local.f.monitoreo && length(var.correos_alertas) > 0
  id_base_datos = "${var.proyecto}:${google_sql_database_instance.principal.name}"
}

# ── Alertas (fase 2: «Cloud Monitoring con alertas») ───────────────────
resource "google_monitoring_alert_policy" "api_5xx" {
  count                 = local.hay_alertas ? 1 : 0
  display_name          = "CasaRoca · la API responde errores 5xx"
  combiner              = "OR"
  notification_channels = local.canales

  conditions {
    display_name = "Más de 5 errores 5xx por minuto durante 5 minutos"
    condition_threshold {
      filter          = "resource.type = \"cloud_run_revision\" AND resource.labels.service_name = \"${google_cloud_run_v2_service.api.name}\" AND metric.type = \"run.googleapis.com/request_count\" AND metric.labels.response_code_class = \"5xx\""
      comparison      = "COMPARISON_GT"
      threshold_value = 5
      duration        = "300s"
      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_SUM"
        cross_series_reducer = "REDUCE_SUM"
      }
    }
  }
}

resource "google_monitoring_alert_policy" "sql_cpu" {
  count                 = local.hay_alertas ? 1 : 0
  display_name          = "CasaRoca · Cloud SQL con CPU alta"
  combiner              = "OR"
  notification_channels = local.canales

  conditions {
    display_name = "CPU de la base por encima del 80 % durante 10 minutos"
    condition_threshold {
      filter          = "resource.type = \"cloudsql_database\" AND resource.labels.database_id = \"${local.id_base_datos}\" AND metric.type = \"cloudsql.googleapis.com/database/cpu/utilization\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.8
      duration        = "600s"
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }
}

resource "google_monitoring_alert_policy" "sql_disco" {
  count                 = local.hay_alertas ? 1 : 0
  display_name          = "CasaRoca · disco de Cloud SQL casi lleno"
  combiner              = "OR"
  notification_channels = local.canales

  conditions {
    display_name = "Disco de la base por encima del 85 %"
    condition_threshold {
      filter          = "resource.type = \"cloudsql_database\" AND resource.labels.database_id = \"${local.id_base_datos}\" AND metric.type = \"cloudsql.googleapis.com/database/disk/utilization\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.85
      duration        = "300s"
      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }
}

# Una migración fallida deja la API sin desplegar (Cloud Build se detiene):
# alguien tiene que enterarse aunque no esté mirando el build.
resource "google_monitoring_alert_policy" "migrador_fallo" {
  count                 = local.hay_alertas ? 1 : 0
  display_name          = "CasaRoca · falló una migración de la base"
  combiner              = "OR"
  notification_channels = local.canales

  conditions {
    display_name = "Ejecución del migrador terminada en fallo"
    condition_threshold {
      filter          = "resource.type = \"cloud_run_job\" AND resource.labels.job_name = \"${google_cloud_run_v2_job.migrador.name}\" AND metric.type = \"run.googleapis.com/job/completed_execution_count\" AND metric.labels.result = \"failed\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0
      duration        = "0s"
      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }
}

# ── Presupuesto: la cifra del plan, con avisos al 50, 90 y 100 % ───────
# Es la forma de cumplir la regla del modelo financiero («ningún
# componente se enciende si no está en la tabla») sin depender de que
# alguien revise la factura.
resource "google_billing_budget" "fase" {
  count           = var.cuenta_facturacion != "" ? 1 : 0
  billing_account = var.cuenta_facturacion
  display_name    = "CasaRoca · fase ${var.fase}"

  budget_filter {
    projects = ["projects/${data.google_project.este.number}"]
  }

  amount {
    specified_amount {
      currency_code = var.moneda_facturacion
      # El plan está en USD. Si la cuenta factura en pesos, se convierte con
      # la tasa del modelo financiero (4.050 COP/USD).
      units = tostring(var.moneda_facturacion == "USD" ? local.f.presupuesto_usd : ceil(local.f.presupuesto_usd * var.tasa_cop_usd))
    }
  }

  threshold_rules {
    threshold_percent = 0.5
  }
  threshold_rules {
    threshold_percent = 0.9
  }
  threshold_rules {
    threshold_percent = 1.0
  }
  threshold_rules {
    threshold_percent = 1.0
    spend_basis       = "FORECASTED_SPEND"
  }

  dynamic "all_updates_rule" {
    for_each = length(local.canales) > 0 ? [1] : []
    content {
      monitoring_notification_channels = local.canales
    }
  }

  depends_on = [google_project_service.apis]
}

# ── Sonda externa de disponibilidad ───────────────────────────────────
#
# ⛔ Esto FALTABA, y es el agujero más tonto de todo el monitoreo: las
#    alertas de arriba viven DENTRO del mismo proyecto que vigilan. Si
#    Cloud Run se cae entero, o el proyecto se queda sin cuota, no hay
#    quien avise; el sistema se apaga en silencio y nos enteramos un
#    domingo a las 9:05 por la fila de RocaKids.
#
#    Una sonda de disponibilidad llama a `/salud` desde fuera, cada minuto,
#    desde varias regiones del mundo. Es lo que responde a «¿está caído o
#    es mi internet?» sin discusión.
#
#    Solo se puede apuntar a un nombre público, así que se enciende cuando
#    hay dominio. Sin dominio no hay nada que sondear desde fuera.
resource "google_monitoring_uptime_check_config" "api" {
  count        = var.dominio_api != "" ? 1 : 0
  display_name = "CasaRoca · API viva"
  timeout      = "10s"
  period       = "60s"

  http_check {
    path         = "/salud"
    port         = 443
    use_ssl      = true
    validate_ssl = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.proyecto
      host       = var.dominio_api
    }
  }

  depends_on = [google_project_service.apis]
}

resource "google_monitoring_alert_policy" "api_caida" {
  count        = var.dominio_api != "" && length(local.canales) > 0 ? 1 : 0
  display_name = "CasaRoca · la API no responde desde fuera"
  combiner     = "OR"
  # ⛔ A diferencia de las demás, esta NO depende de `local.hay_alertas`:
  #    no tiene sentido decir «en la fase 0 no nos enteramos de que está
  #    caído». Si hay dominio y hay a quién avisar, se avisa.
  notification_channels = local.canales

  conditions {
    display_name = "La sonda de disponibilidad falla"
    condition_threshold {
      filter = join(" AND ", [
        "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\"",
        "resource.type=\"uptime_url\"",
        "metric.label.check_id=\"${google_monitoring_uptime_check_config.api[0].uptime_check_id}\"",
      ])
      comparison      = "COMPARISON_GT"
      threshold_value = 1
      duration        = "120s"

      aggregations {
        alignment_period     = "1200s"
        per_series_aligner   = "ALIGN_NEXT_OLDER"
        cross_series_reducer = "REDUCE_COUNT_FALSE"
        group_by_fields      = ["resource.label.host"]
      }

      trigger {
        count = 1
      }
    }
  }

  documentation {
    content   = "La API no contesta /salud desde fuera del proyecto. Siga docs/RUNBOOK.md punto 8."
    mime_type = "text/markdown"
  }

  depends_on = [google_project_service.apis]
}
