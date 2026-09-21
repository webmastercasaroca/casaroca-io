output "fase" {
  description = "Fase aplicada y su cifra en el plan de Jhon."
  value       = "Fase ${var.fase} · ${local.f.presupuesto_usd} USD/mes según el plan"
}

output "api_url_run" {
  description = "URL directa de Cloud Run. Con balanceador no acepta tráfico de internet; sin api_publica exige identidad (usar `gcloud run services proxy`)."
  value       = google_cloud_run_v2_service.api.uri
}

output "ip_balanceador" {
  description = "IP a la que debe apuntar el registro A del dominio de la API (y del frontend). Vacío si no hay balanceador."
  value       = local.hay_balanceador ? google_compute_global_address.lb[0].address : ""
}

output "conexion_cloud_sql" {
  description = "Nombre de conexión de Cloud SQL (PROYECTO:REGION:INSTANCIA)."
  value       = local.conexion_sql
}

output "repositorio_imagenes" {
  description = "Ruta de Artifact Registry para las imágenes."
  value       = local.repo_imagenes
}

output "bucket_archivos" {
  description = "Bucket de certificados, respaldos e importaciones."
  value       = google_storage_bucket.archivos.name
}

output "job_migrador" {
  description = "Cloud Run Job que aplica las migraciones."
  value       = google_cloud_run_v2_job.migrador.name
}

output "redis" {
  description = "Host y puerto de Redis (fase 1 en adelante)."
  value       = local.hay_redis ? "${google_redis_instance.cache[0].host}:${google_redis_instance.cache[0].port}" : "sin Redis en la fase ${var.fase}"
}

output "cuentas_de_servicio" {
  description = "Cuentas de servicio por pieza."
  value = {
    api          = google_service_account.api.email
    migrador     = google_service_account.migrador.email
    frontend     = google_service_account.frontend.email
    construccion = google_service_account.construccion.email
  }
}

output "secretos_por_cargar" {
  description = "Secretos de terceros cuyo valor carga una persona con gcloud (README, paso 4)."
  value       = [for s in local.secretos_terceros : google_secret_manager_secret.s[s].secret_id]
}
