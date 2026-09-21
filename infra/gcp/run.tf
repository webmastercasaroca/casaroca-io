# =====================================================================
# Cloud Run: la API, el Job del migrador y, cuando existan sus imágenes,
# frontend, Pastoral y trabajadores.
#
# Terraform crea cada pieza con una imagen de relleno y Cloud Build
# despliega la real. Desde entonces Terraform IGNORA la imagen: si no, cada
# `terraform apply` devolvería la API a la imagen de relleno.
# =====================================================================
locals {
  # Cloud Run: por debajo de 1 vCPU, solo 1.ª generación y una petición a
  # la vez por instancia. Por encima de 1, solo enteros. El plan de la
  # fase 0 (0,25 vCPU) cae en el primer caso: la maqueta atiende de a una
  # petición. Es suficiente para mostrar; no para un domingo.
  cpu_texto = {
    api      = local.f.api_cpu < 1 ? format("%dm", floor(local.f.api_cpu * 1000)) : tostring(local.f.api_cpu)
    front    = local.f.front_cpu < 1 ? format("%dm", floor(local.f.front_cpu * 1000)) : tostring(local.f.front_cpu)
    pastoral = local.f.pastoral_cpu < 1 ? format("%dm", floor(local.f.pastoral_cpu * 1000)) : tostring(local.f.pastoral_cpu)
  }

  # ⛔ PGPORT = 5432. El código trae 5433 por omisión (el Postgres del Mac)
  #    y el socket de Cloud SQL se llama .s.PGSQL.5432: sin esto la API no
  #    encuentra la base y el error no dice por qué.
  entorno_bd = {
    PGHOST     = "/cloudsql/${local.conexion_sql}"
    PGPORT     = "5432"
    PGDATABASE = google_sql_database.casaroca.name
  }
}

# ---------------------------------------------------------------------
# API
# ---------------------------------------------------------------------
resource "google_cloud_run_v2_service" "api" {
  name                = "${var.prefijo}-api"
  location            = var.region
  deletion_protection = var.proteger_borrado
  # Con balanceador, la URL *.run.app deja de aceptar tráfico de internet:
  # todo entra por el balanceador y, desde la fase 1, por Cloud Armor.
  ingress = local.hay_balanceador ? "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER" : "INGRESS_TRAFFIC_ALL"

  template {
    service_account                  = google_service_account.api.email
    execution_environment            = local.f.api_cpu < 1 ? "EXECUTION_ENVIRONMENT_GEN1" : "EXECUTION_ENVIRONMENT_GEN2"
    max_instance_request_concurrency = local.f.api_cpu < 1 ? 1 : 80
    timeout                          = "60s"

    scaling {
      min_instance_count = local.f.api_min
      max_instance_count = local.f.api_max
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [local.conexion_sql]
      }
    }

    dynamic "vpc_access" {
      for_each = local.hay_redis ? [1] : []
      content {
        egress = "PRIVATE_RANGES_ONLY"
        network_interfaces {
          network    = google_compute_network.privada[0].id
          subnetwork = google_compute_subnetwork.run[0].id
        }
      }
    }

    containers {
      image = local.imagen_relleno_servicio

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = local.cpu_texto.api
          memory = local.f.api_mem
        }
        cpu_idle          = true # se cobra CPU solo mientras atiende
        startup_cpu_boost = local.f.api_cpu >= 1
      }

      dynamic "env" {
        for_each = merge(local.entorno_bd, {
          PGUSER           = "casaroca_api"
          NODE_ENV         = "production"
          CORS_ORIGENES    = join(",", var.cors_origenes)
          CORREO_REMITENTE = var.correo_remitente
          # ⛔ El tamaño de los pozos lo manda la TABLA DE FASES, no un valor
          #    por omisión dentro del código. Es la única forma de que el
          #    número de conexiones por instancia y el número de instancias
          #    no se contradigan: los dos salen de la misma fila.
          PG_POZO_NEGOCIO = tostring(local.f.pozo_negocio)
          PG_POZO_AUTH    = tostring(local.f.pozo_auth)
        })
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = var.payu_merchant_id != "" ? { PAYU_MERCHANT_ID = var.payu_merchant_id } : {}
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = local.hay_redis ? {
          REDIS_HOST   = google_redis_instance.cache[0].host
          REDIS_PUERTO = tostring(google_redis_instance.cache[0].port)
        } : {}
        content {
          name  = env.key
          value = env.value
        }
      }

      # Secretos: siempre los tres propios; los de terceros solo si ya
      # tienen valor cargado (un secreto vacío tumba el despliegue).
      dynamic "env" {
        for_each = merge(
          {
            PGPASSWORD           = "db-api-clave"
            APP_LLAVE_N4         = "app-llave-n4"
            NOTIFICACIONES_TOKEN = "notificaciones-token"
          },
          # ⛔ Sin RECAPTCHA_SECRET la API NO valida el formulario público
          #    (modo desarrollo, ver src/comun/recaptcha.ts). Antes de abrir
          #    la API, este secreto tiene que estar cargado.
          contains(var.secretos_cargados, "recaptcha-secreto") ? { RECAPTCHA_SECRET = "recaptcha-secreto" } : {},
          contains(var.secretos_cargados, "sendgrid-api-key") ? { SENDGRID_API_KEY = "sendgrid-api-key" } : {},
          contains(var.secretos_cargados, "payu-api-key") ? { PAYU_API_KEY = "payu-api-key" } : {},
        )
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.s[env.value].secret_id
              version = "latest"
            }
          }
        }
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }

      # ⛔ Antes esto era un `tcp_socket`: bastaba con que el puerto abriera.
      #    Un proceso puede tener el puerto abierto y la base caída, y Cloud
      #    Run le mandaba tráfico igual. `/salud` SÍ consulta la base, así que
      #    una revisión que no puede trabajar no recibe peticiones.
      #    NestJS en 0,25 vCPU tarda unos segundos: margen de 60 s.
      startup_probe {
        http_get {
          path = "/salud"
          port = 8080
        }
        period_seconds    = 3
        failure_threshold = 20
      }

      # Y si la base se cae DESPUÉS de arrancar, la revisión se reinicia en
      # vez de contestar 500 en silencio durante horas.
      liveness_probe {
        http_get {
          path = "/salud"
          port = 8080
        }
        period_seconds    = 30
        timeout_seconds   = 5
        failure_threshold = 3
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
      client,
      client_version,
    ]
  }

  depends_on = [
    google_secret_manager_secret_iam_member.acceso,
    google_secret_manager_secret_version.api,
    google_secret_manager_secret_version.llave_n4,
    google_secret_manager_secret_version.notificaciones,
    google_project_iam_member.sql_cliente,
  ]
}

# ⛔ Abrir la API a internet es una decisión, no un valor por omisión.
#    Ver var.api_publica: hoy la identidad viaja en una cabecera que
#    cualquiera puede escribir.
resource "google_cloud_run_v2_service_iam_member" "api_publica" {
  count    = var.api_publica ? 1 : 0
  name     = google_cloud_run_v2_service.api.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ---------------------------------------------------------------------
# Migrador (Cloud Run Job). Lo ejecuta Cloud Build ANTES de desplegar la
# API, con la imagen de backend/Dockerfile.migrador.
# ---------------------------------------------------------------------
resource "google_cloud_run_v2_job" "migrador" {
  name                = "${var.prefijo}-migrador"
  location            = var.region
  deletion_protection = var.proteger_borrado

  template {
    task_count  = 1
    parallelism = 1

    template {
      service_account = google_service_account.migrador.email
      # ⛔ Sin reintentos automáticos: si una migración falla, una persona
      #    lee el error antes de volver a intentarlo.
      max_retries = 0
      timeout     = "1800s"

      volumes {
        name = "cloudsql"
        cloud_sql_instance {
          instances = [local.conexion_sql]
        }
      }

      containers {
        image = local.imagen_relleno_trabajo

        resources {
          limits = {
            cpu    = "1"
            memory = "512Mi"
          }
        }

        dynamic "env" {
          for_each = merge(local.entorno_bd, {
            PGUSER         = google_sql_user.postgres.name
            API_DB_USUARIO = "casaroca_api"
          })
          content {
            name  = env.key
            value = env.value
          }
        }

        env {
          name = "PGPASSWORD"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.s["db-postgres-clave"].secret_id
              version = "latest"
            }
          }
        }

        env {
          name = "API_DB_PASSWORD"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.s["db-api-clave"].secret_id
              version = "latest"
            }
          }
        }

        volume_mounts {
          name       = "cloudsql"
          mount_path = "/cloudsql"
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].template[0].containers[0].image,
      client,
      client_version,
    ]
  }

  depends_on = [
    google_secret_manager_secret_iam_member.acceso,
    google_secret_manager_secret_version.postgres,
    google_secret_manager_secret_version.api,
    google_project_iam_member.sql_cliente,
  ]
}

# ---------------------------------------------------------------------
# Frontend (fases 0 a 2 del plan). Solo si hay imagen: hoy no la hay.
# No toca la base ni los secretos; habla con la API como cualquier
# navegador.
# ---------------------------------------------------------------------
resource "google_cloud_run_v2_service" "frontend" {
  count               = local.hay_frontend ? 1 : 0
  name                = "${var.prefijo}-frontend"
  location            = var.region
  deletion_protection = var.proteger_borrado
  ingress             = local.hay_balanceador ? "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER" : "INGRESS_TRAFFIC_ALL"

  template {
    service_account                  = google_service_account.frontend.email
    execution_environment            = local.f.front_cpu < 1 ? "EXECUTION_ENVIRONMENT_GEN1" : "EXECUTION_ENVIRONMENT_GEN2"
    max_instance_request_concurrency = local.f.front_cpu < 1 ? 1 : 80

    scaling {
      min_instance_count = local.f.front_min
      max_instance_count = local.f.front_max
    }

    containers {
      image = var.imagen_frontend
      resources {
        limits = {
          cpu    = local.cpu_texto.front
          memory = local.f.front_mem
        }
        cpu_idle = true
      }
    }
  }

  lifecycle {
    ignore_changes = [template[0].containers[0].image, client, client_version]
  }
}

resource "google_cloud_run_v2_service_iam_member" "frontend_publico" {
  count    = local.hay_frontend ? 1 : 0
  name     = google_cloud_run_v2_service.frontend[0].name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers" # es la interfaz; los datos siguen detrás de la API
}

# ---------------------------------------------------------------------
# Pastoral (fase 2 del plan). Privado hasta que se decida quién lo usa.
# ⚠️ Corre con la cuenta del frontend (sin base ni secretos). Si necesita
#    la base, se le da una cuenta propia; no se reutiliza la de la API.
# ---------------------------------------------------------------------
resource "google_cloud_run_v2_service" "pastoral" {
  count               = local.hay_pastoral ? 1 : 0
  name                = "${var.prefijo}-pastoral"
  location            = var.region
  deletion_protection = var.proteger_borrado
  ingress             = "INGRESS_TRAFFIC_ALL"

  template {
    service_account                  = google_service_account.frontend.email
    execution_environment            = "EXECUTION_ENVIRONMENT_GEN1"
    max_instance_request_concurrency = 1

    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }

    containers {
      image = var.imagen_pastoral
      resources {
        limits = {
          cpu    = local.cpu_texto.pastoral
          memory = local.f.pastoral_mem
        }
        cpu_idle = true
      }
    }
  }

  lifecycle {
    ignore_changes = [template[0].containers[0].image, client, client_version]
  }
}

# ---------------------------------------------------------------------
# Trabajadores (fase 2): correos y exportes como Cloud Run Jobs, que no
# cobran mientras no corren (palanca del modelo financiero: −14 USD/mes
# frente a un servicio encendido).
# Corren con la cuenta de la API: necesitan la base y SendGrid.
# ---------------------------------------------------------------------
resource "google_cloud_run_v2_job" "trabajador" {
  for_each            = local.f.workers ? var.trabajadores : {}
  name                = "${var.prefijo}-${each.key}"
  location            = var.region
  deletion_protection = var.proteger_borrado

  template {
    template {
      service_account = google_service_account.api.email
      max_retries     = 1
      timeout         = "3600s"

      volumes {
        name = "cloudsql"
        cloud_sql_instance {
          instances = [local.conexion_sql]
        }
      }

      containers {
        image = each.value.imagen
        args  = each.value.argumentos

        resources {
          limits = {
            cpu    = "1"
            memory = "1Gi"
          }
        }

        dynamic "env" {
          for_each = merge(local.entorno_bd, { PGUSER = "casaroca_api", NODE_ENV = "production" })
          content {
            name  = env.key
            value = env.value
          }
        }

        dynamic "env" {
          for_each = { PGPASSWORD = "db-api-clave", APP_LLAVE_N4 = "app-llave-n4" }
          content {
            name = env.key
            value_source {
              secret_key_ref {
                secret  = google_secret_manager_secret.s[env.value].secret_id
                version = "latest"
              }
            }
          }
        }

        volume_mounts {
          name       = "cloudsql"
          mount_path = "/cloudsql"
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [template[0].template[0].containers[0].image, client, client_version]
  }
}
