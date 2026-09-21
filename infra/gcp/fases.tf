# =====================================================================
# LA TABLA DEL PLAN, en código.
#
# Cada cifra sale del documento «PLAN DE COSTOS GCP» de Jhon Chávez.
# Donde GCP no admite exactamente lo que dice el plan, se anota el ajuste
# con ⚠️ y va también en el README para que Jhon lo decida.
#
# Regla heredada del modelo financiero: ningún componente se enciende si
# no aparece en esta tabla con su costo. Por eso Redis, Cloud Armor, CDN
# y las alertas cuelgan de la fase y no de una variable suelta.
# =====================================================================
locals {
  fases = {
    # ── FASE 0 · maqueta · 35 USD/mes ─────────────────────────────────
    0 = {
      presupuesto_usd = 35

      sql_tier           = "db-f1-micro" # núcleo compartido: sin SLA de Cloud SQL
      sql_ha             = false
      sql_disco_gb       = 10
      sql_pitr           = false
      sql_respaldos_dias = 7

      api_cpu = 0.25
      api_mem = "512Mi"
      api_min = 1 # «1 instancia»: encendida para no esperar el arranque en frío
      api_max = 1

      # ⛔ Conexiones por instancia. Suman contra `max_connections` de la
      #    base, y por eso viven en la MISMA tabla que el número de
      #    instancias: es la única forma de que no se contradigan.
      #    db-f1-micro tiene 0,6 GB: su `max_connections` de fábrica es 25
      #    y subirlo lo mata. Por eso aquí los pozos son pequeños.
      pozo_negocio       = 8
      pozo_auth          = 4
      sql_max_conexiones = 0 # 0 = se deja el valor de fábrica

      front_cpu = 0.25
      front_mem = "512Mi"
      front_min = 0
      front_max = 1

      pastoral_cpu = 0 # no existe en esta fase
      pastoral_mem = "512Mi"

      redis_tier = null # sin Redis
      redis_gb   = 0

      logs_dias = 7
      armor     = false
      cdn       = false
      monitoreo = false
      workers   = false
    }

    # ── FASE 1 · pruebas · 218 USD/mes ────────────────────────────────
    1 = {
      presupuesto_usd = 218

      sql_tier           = "db-n1-standard-1" # 1 vCPU · 3,75 GB, en alta disponibilidad
      sql_ha             = true
      sql_disco_gb       = 20
      sql_pitr           = false
      sql_respaldos_dias = 14

      api_cpu = 1
      api_mem = "2Gi"
      api_min = 2
      api_max = 4 # ⚠️ el plan fija el mínimo (2), no el máximo

      pozo_negocio = 20
      pozo_auth    = 8
      # 4 instancias x (20 + 8 + 2) = 120, más 30 de margen para el
      # migrador, las copias y una sesión de mantenimiento.
      sql_max_conexiones = 150

      front_cpu = 0.5
      front_mem = "1Gi"
      front_min = 0
      front_max = 2

      pastoral_cpu = 0
      pastoral_mem = "512Mi"

      redis_tier = "BASIC"
      redis_gb   = 1

      logs_dias = 30
      armor     = true # Cloud Armor estándar con reglas OWASP
      cdn       = false
      monitoreo = false
      workers   = false
    }

    # ── FASE 2 · producción · 526 USD/mes (473 con compromiso de 1 año)
    2 = {
      presupuesto_usd = 526

      sql_tier     = "db-n1-standard-2" # 2 vCPU · 7,5 GB, como dice el plan
      sql_ha       = true
      sql_disco_gb = 100
      # ⚠️ El plan pide PITR de 35 días. En Cloud SQL Enterprise (la
      #    edición de db-n1-*) el registro de transacciones guarda como
      #    máximo 7 días; 35 exige Enterprise Plus, que es otro precio.
      #    Aquí: PITR fino de 7 días + 35 respaldos diarios. Se puede
      #    volver a cualquier día de los últimos 35 y a cualquier segundo
      #    de los últimos 7.
      sql_pitr           = true
      sql_respaldos_dias = 35

      # ⚠️ El plan dice 1,5 vCPU. Cloud Run no acepta 1,5: por encima de 1
      #    solo admite enteros (1, 2, 4, 6, 8). Se usa 2 para no quedar por
      #    debajo del plan; con facturación por petición la diferencia es
      #    pequeña, pero hay que confirmarla con el calculador.
      api_cpu = 2
      api_mem = "2Gi"
      api_min = 2
      api_max = 5

      pozo_negocio = 25
      pozo_auth    = 10
      # 5 instancias x (25 + 10 + 2) = 185, más 40 de margen.
      sql_max_conexiones = 225

      front_cpu = 1
      front_mem = "2Gi"
      front_min = 2
      front_max = 4 # ⚠️ el plan dice «2 instancias»; se toma como mínimo

      pastoral_cpu = 0.5
      pastoral_mem = "1Gi"

      redis_tier = "STANDARD_HA"
      redis_gb   = 2

      logs_dias = 90
      armor     = true
      cdn       = true
      monitoreo = true
      workers   = true
    }
  }

  f = local.fases[var.fase]

  etiquetas = {
    sistema        = "casaroca"
    fase           = tostring(var.fase)
    gestionado_por = "terraform"
  }

  # Nombres y rutas que se repiten.
  repo_imagenes = "${var.region}-docker.pkg.dev/${var.proyecto}/${google_artifact_registry_repository.imagenes.repository_id}"
  conexion_sql  = google_sql_database_instance.principal.connection_name

  # Imágenes de relleno para el primer apply: Cloud Build despliega la
  # real y Terraform ignora la imagen desde entonces (ver run.tf).
  imagen_relleno_servicio = "us-docker.pkg.dev/cloudrun/container/hello"
  imagen_relleno_trabajo  = "us-docker.pkg.dev/cloudrun/container/job:latest"

  hay_balanceador = var.dominio_api != ""
  hay_frontend    = var.imagen_frontend != ""
  hay_pastoral    = var.imagen_pastoral != "" && local.f.pastoral_cpu > 0
  hay_redis       = local.f.redis_tier != null
}
