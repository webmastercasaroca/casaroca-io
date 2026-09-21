# =====================================================================
# Prueba de la tabla del plan SIN tocar Google Cloud.
#
#   terraform init -backend=false && terraform test
#
# Los proveedores de Google van simulados (mock_provider): Terraform arma
# el plan de cada fase con las reglas reales del esquema, pero no llama a
# ninguna API ni necesita credenciales. No crea nada y no cuesta nada.
# `random` va real: corre en la máquina y los simulacros de Terraform aún
# no admiten recursos efímeros.
#
# Lo que se prueba es lo que duele si se rompe: que cada fase encienda lo
# que dice el plan de Jhon y NADA más, y que la API no quede pública.
# =====================================================================
mock_provider "google" {}
mock_provider "google-beta" {}

variables {
  proyecto = "casaroca-prueba"
}

run "fase_0_maqueta" {
  command = plan

  variables {
    fase = 0
  }

  assert {
    condition     = google_sql_database_instance.principal.settings[0].tier == "db-f1-micro"
    error_message = "La fase 0 del plan es Cloud SQL db-f1-micro."
  }
  assert {
    condition     = google_sql_database_instance.principal.settings[0].availability_type == "ZONAL"
    error_message = "La maqueta no lleva alta disponibilidad."
  }
  assert {
    condition     = google_cloud_run_v2_service.api.template[0].containers[0].resources[0].limits.cpu == "250m" && google_cloud_run_v2_service.api.template[0].containers[0].resources[0].limits.memory == "512Mi"
    error_message = "La API de la fase 0 es 0,25 vCPU y 512 MB."
  }
  assert {
    condition     = google_cloud_run_v2_service.api.template[0].execution_environment == "EXECUTION_ENVIRONMENT_GEN1" && google_cloud_run_v2_service.api.template[0].max_instance_request_concurrency == 1
    error_message = "Con menos de 1 vCPU, Cloud Run exige 1.ª generación y una petición a la vez."
  }
  assert {
    condition     = google_cloud_run_v2_service.api.template[0].scaling[0].max_instance_count == 1
    error_message = "La fase 0 es una instancia."
  }
  assert {
    condition     = length(google_redis_instance.cache) == 0 && length(google_compute_security_policy.armor) == 0
    error_message = "Redis y Cloud Armor no están en la fase 0 del plan."
  }
  assert {
    condition     = google_logging_project_bucket_config.por_omision.retention_days == 7
    error_message = "La fase 0 guarda registros 7 días."
  }
  assert {
    condition     = length(google_cloud_run_v2_service_iam_member.api_publica) == 0
    error_message = "⛔ La API NO puede quedar pública por omisión."
  }
  assert {
    condition     = google_cloud_run_v2_service.api.ingress == "INGRESS_TRAFFIC_ALL" && length(google_compute_global_forwarding_rule.https) == 0
    error_message = "Sin dominio no hay balanceador."
  }
  # ⛔ 19 sep 2026 · La sonda externa se apunta a un nombre público: sin
  #    dominio no hay nada que sondear desde fuera, y Terraform no debe
  #    intentar crearla.
  assert {
    condition     = length(google_monitoring_uptime_check_config.api) == 0
    error_message = "Sin dominio no se crea la sonda externa de disponibilidad."
  }
  # La sonda de arranque comprueba /salud, no que el puerto abra: un proceso
  # con el puerto abierto y la base caída NO debe recibir tráfico.
  assert {
    condition     = google_cloud_run_v2_service.api.template[0].containers[0].startup_probe[0].http_get[0].path == "/salud"
    error_message = "La sonda de arranque de la API tiene que preguntar por /salud."
  }
  assert {
    condition     = google_cloud_run_v2_service.api.template[0].containers[0].liveness_probe[0].http_get[0].path == "/salud"
    error_message = "Sin sonda de vida, una revisión con la base caída contesta 500 durante horas."
  }
}

run "fase_1_pruebas" {
  command = plan

  variables {
    fase        = 1
    dominio_api = "api.casaroca.io"
  }

  assert {
    condition     = google_sql_database_instance.principal.settings[0].tier == "db-n1-standard-1" && google_sql_database_instance.principal.settings[0].availability_type == "REGIONAL"
    error_message = "La fase 1 es db-n1-standard-1 en alta disponibilidad."
  }
  assert {
    condition     = google_cloud_run_v2_service.api.template[0].containers[0].resources[0].limits.cpu == "1" && google_cloud_run_v2_service.api.template[0].scaling[0].min_instance_count == 2
    error_message = "La API de la fase 1 es 1 vCPU con mínimo 2 instancias."
  }
  assert {
    condition     = google_redis_instance.cache[0].tier == "BASIC" && google_redis_instance.cache[0].memory_size_gb == 1
    error_message = "La fase 1 lleva Redis básico de 1 GB."
  }
  assert {
    condition     = length(google_compute_security_policy.armor) == 1 && google_compute_backend_service.api[0].enable_cdn == false
    error_message = "La fase 1 lleva Cloud Armor y todavía no CDN."
  }
  assert {
    condition     = google_cloud_run_v2_service.api.ingress == "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"
    error_message = "Con balanceador, la API solo acepta tráfico que pase por él (y por Cloud Armor)."
  }
  assert {
    condition     = google_logging_project_bucket_config.por_omision.retention_days == 30
    error_message = "La fase 1 guarda registros 30 días."
  }
  # ⭐ Con dominio SÍ hay sonda externa, y en cualquier fase: decir «en la
  #    fase 1 todavía no nos enteramos de que está caído» no tiene sentido.
  assert {
    condition     = length(google_monitoring_uptime_check_config.api) == 1 && google_monitoring_uptime_check_config.api[0].http_check[0].path == "/salud"
    error_message = "Con dominio tiene que existir la sonda externa contra /salud."
  }
  # ⭐ Las conexiones tienen que CABER: instancias x pozos + margen. Si
  #    alguien sube `api_max` sin tocar `sql_max_conexiones`, el domingo
  #    las peticiones se encolan sin un solo error que lo explique.
  assert {
    condition = (
      local.f.api_max * (local.f.pozo_negocio + local.f.pozo_auth + 2) + 25
      <= local.f.sql_max_conexiones
    )
    error_message = "Los pozos de todas las instancias no caben en max_connections de esta fase."
  }
  # Cloud Armor BLOQUEA por omisión. Si vuelve a nacer en modo vista previa,
  # el inventario contaría como protección algo que solo mira.
  # ⛔ No se puede mirar `google_compute_security_policy.armor[0].rule`: en
  #    `plan` es un conjunto con valores aún desconocidos (Google añade sus
  #    reglas por omisión). Se mira la variable, que es lo que de verdad se
  #    cambió y lo que alguien podría volver a poner en `true` sin querer.
  assert {
    condition     = var.armor_solo_observar == false
    error_message = "Cloud Armor no puede venir en modo vista previa por omisión."
  }
}

run "fase_2_produccion" {
  command = plan

  variables {
    fase            = 2
    dominio_api     = "api.casaroca.io"
    correos_alertas = ["alertas@example.org"]
  }

  assert {
    condition     = google_sql_database_instance.principal.settings[0].tier == "db-n1-standard-2"
    error_message = "La fase 2 es Cloud SQL de 2 vCPU y 7,5 GB."
  }
  assert {
    condition     = google_sql_database_instance.principal.settings[0].backup_configuration[0].point_in_time_recovery_enabled && google_sql_database_instance.principal.settings[0].backup_configuration[0].backup_retention_settings[0].retained_backups == 35
    error_message = "La fase 2 lleva PITR y 35 días de respaldos."
  }
  assert {
    condition     = google_cloud_run_v2_service.api.template[0].scaling[0].min_instance_count == 2 && google_cloud_run_v2_service.api.template[0].scaling[0].max_instance_count == 5
    error_message = "La API de la fase 2 escala de 2 a 5 instancias."
  }
  assert {
    condition     = google_redis_instance.cache[0].tier == "STANDARD_HA" && google_redis_instance.cache[0].memory_size_gb == 2
    error_message = "La fase 2 lleva Redis estándar de 2 GB."
  }
  assert {
    condition     = google_compute_backend_service.api[0].enable_cdn
    error_message = "La fase 2 lleva Cloud CDN."
  }
  assert {
    condition     = length(google_monitoring_alert_policy.api_5xx) == 1 && length(google_monitoring_alert_policy.migrador_fallo) == 1
    error_message = "La fase 2 lleva alertas."
  }
  assert {
    condition     = google_logging_project_bucket_config.por_omision.retention_days == 90
    error_message = "La fase 2 guarda registros 90 días."
  }
}

run "fase_que_no_existe" {
  command = plan

  variables {
    fase = 3
  }

  expect_failures = [var.fase]
}

# Todas las ramas opcionales encendidas a la vez: frontend, Pastoral,
# trabajadores, secretos de terceros, presupuesto y disparador de GitHub.
run "fase_2_con_todo" {
  command = plan

  variables {
    fase                    = 2
    dominio_api             = "api.casaroca.io"
    dominio_app             = "app.casaroca.io"
    imagen_frontend         = "us-east1-docker.pkg.dev/casaroca-prueba/casaroca/frontend:1"
    imagen_pastoral         = "us-east1-docker.pkg.dev/casaroca-prueba/casaroca/pastoral:1"
    trabajadores            = { correos = { imagen = "us-east1-docker.pkg.dev/casaroca-prueba/casaroca/api:1", argumentos = ["dist/src/trabajos/correos.js"] } }
    secretos_cargados       = ["payu-api-key", "recaptcha-secreto"]
    payu_merchant_id        = "508029"
    cuenta_facturacion      = "000000-000000-000000"
    moneda_facturacion      = "COP"
    correos_alertas         = ["alertas@example.org"]
    crear_disparador_github = true
  }

  assert {
    condition     = length(google_cloud_run_v2_service.frontend) == 1 && length(google_cloud_run_v2_service.pastoral) == 1 && length(google_cloud_run_v2_job.trabajador) == 1
    error_message = "Con imágenes declaradas, la fase 2 crea frontend, Pastoral y trabajadores."
  }
  assert {
    condition     = length(google_compute_url_map.https[0].host_rule) == 1
    error_message = "El dominio del frontend debe enrutar al frontend."
  }
  assert {
    condition     = google_billing_budget.fase[0].amount[0].specified_amount[0].units == "2130300"
    error_message = "526 USD a 4.050 COP/USD son 2.130.300 COP."
  }
}

run "trabajadores_no_existen_antes_de_la_fase_2" {
  command = plan

  variables {
    fase         = 1
    trabajadores = { correos = { imagen = "us-east1-docker.pkg.dev/casaroca-prueba/casaroca/api:1" } }
  }

  assert {
    condition     = length(google_cloud_run_v2_job.trabajador) == 0
    error_message = "Los Cloud Run Jobs de trabajadores son de la fase 2 del plan."
  }
}
