# =====================================================================
# Cloud SQL · PostgreSQL 16
#
# Conexión: SOLO por el conector de Cloud SQL (el socket /cloudsql/... de
# Cloud Run). La instancia tiene IP pública, pero SIN redes autorizadas y
# exigiendo certificado de cliente: nadie entra por IP. El conector llega
# con identidad de Google (cloudsql.client) y TLS, y encima pide la
# contraseña del rol. Así la fase 0 no necesita VPC.
# ⚠️ Pasar a IP privada es posible y está en «decisiones abiertas»; exige
#    VPC con acceso a servicios privados desde la fase 0.
#
# ⛔ La API NUNCA entra como `postgres`. Entra como `casaroca_api`, que
#    crea el migrador con SQL (no Terraform: los usuarios que crea Cloud
#    SQL nacen en cloudsqlsuperuser). Ver backend/scripts/migrar-produccion.sh.
# =====================================================================
resource "google_sql_database_instance" "principal" {
  name                = "${var.prefijo}-pg"
  database_version    = "POSTGRES_16"
  region              = var.region
  encryption_key_name = google_kms_crypto_key.datos.id
  deletion_protection = var.proteger_borrado

  settings {
    tier              = local.f.sql_tier
    edition           = "ENTERPRISE"
    availability_type = local.f.sql_ha ? "REGIONAL" : "ZONAL"

    disk_type             = "PD_SSD"
    disk_size             = local.f.sql_disco_gb
    disk_autoresize       = true
    disk_autoresize_limit = local.f.sql_disco_gb * 5

    deletion_protection_enabled = var.proteger_borrado
    user_labels                 = local.etiquetas

    ip_configuration {
      ipv4_enabled = true
      ssl_mode     = "TRUSTED_CLIENT_CERTIFICATE_REQUIRED"
      # Sin authorized_networks, a propósito.
    }

    backup_configuration {
      enabled                        = true
      location                       = var.region # los respaldos tampoco salen de us-east1
      start_time                     = "07:00"    # UTC = 2:00 a. m. en Bogotá
      point_in_time_recovery_enabled = local.f.sql_pitr
      transaction_log_retention_days = local.f.sql_pitr ? 7 : null

      backup_retention_settings {
        retained_backups = local.f.sql_respaldos_dias
        retention_unit   = "COUNT"
      }
    }

    # ⛔ Nunca domingo: es el día de más uso (check-in de RocaKids,
    #    asistencia, formularios de nuevos). Martes 3:00 a. m. de Bogotá.
    maintenance_window {
      day          = 2
      hour         = 8
      update_track = "stable"
    }

    insights_config {
      query_insights_enabled = true
      # La dirección del cliente y las etiquetas de la aplicación no
      # aportan al diagnóstico y sí son rastro: fuera.
      record_client_address   = false
      record_application_tags = false
    }

    # Banderas. Sirven para diagnosticar sin exponer datos.
    # ⛔ NO poner log_statement = 'ddl' ni 'all': el migrador fija la
    #    contraseña de la API con ALTER ROLE ... PASSWORD, y esas opciones
    #    la escribirían en claro en Cloud Logging.
    # ⛔ Cuántas conexiones admite la base. Sale de la tabla de fases, con
    #    la misma cuenta que los pozos de la API: instancias x (negocio +
    #    auth + salud) + margen para el migrador y el mantenimiento.
    #    Sin esto se dependía del valor de fábrica, y en la fase 2 (hasta 5
    #    instancias) las peticiones se habrían quedado esperando conexión
    #    justo en el pico del domingo, sin un solo error que lo explicara.
    dynamic "database_flags" {
      for_each = local.f.sql_max_conexiones > 0 ? [1] : []
      content {
        name  = "max_connections"
        value = tostring(local.f.sql_max_conexiones)
      }
    }

    database_flags {
      name  = "log_min_duration_statement"
      value = "1000" # consultas de más de 1 s
    }
    database_flags {
      name  = "log_connections"
      value = "on"
    }
    database_flags {
      name  = "log_disconnections"
      value = "on"
    }
    database_flags {
      name  = "log_lock_waits"
      value = "on"
    }
    database_flags {
      name  = "log_temp_files"
      value = "0"
    }
  }

  depends_on = [google_kms_crypto_key_iam_member.agentes]
}

resource "google_sql_database" "casaroca" {
  name     = "casaroca"
  instance = google_sql_database_instance.principal.name
  # Si alguien quita este recurso de Terraform, la base NO se borra.
  deletion_policy = "ABANDON"
}

# El administrador. Su contraseña es la misma que se guardó en el secreto,
# en el mismo apply, y ninguna de las dos pasa por el estado.
resource "google_sql_user" "postgres" {
  name                = "postgres"
  instance            = google_sql_database_instance.principal.name
  password_wo         = ephemeral.random_password.postgres.result
  password_wo_version = var.version_claves_bd
  deletion_policy     = "ABANDON"
}
