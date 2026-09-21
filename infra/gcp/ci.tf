# =====================================================================
# Disparador de Cloud Build: cada push a main de 100p-NANO/ecosistema-cr
# que toque el backend construye, migra y despliega (infra/gcp/cloudbuild.yaml).
#
# ⚠️ Requisito manual previo (una vez): instalar la app «Google Cloud
#    Build» en la organización 100p-NANO de GitHub y conectar el
#    repositorio al proyecto. Eso exige autorización en GitHub y no se
#    puede hacer desde Terraform. Por eso el disparador nace apagado
#    (var.crear_disparador_github = false).
# =====================================================================
# ⛔ 19 sep 2026 · LO QUE ESTE DISPARADOR NO PUEDE COMPROBAR SOLO.
#
#    Cloud Build se entera del push, no de si la compuerta paso. Es decir:
#    un `git push` a main llega a produccion aunque `verificar.sh` este en
#    rojo, porque son dos sistemas distintos mirando el mismo commit.
#
#    Lo que SI protege hoy, dentro de `cloudbuild.yaml`:
#      · freno de domingo (el dia de mas uso), con escape explicito;
#      · copia de la base ANTES de migrar, etiquetada con el build;
#      · el despliegue de la API espera a que el migrador termine bien.
#
#    Lo que falta, y es una decision de Daniel porque toca la cuenta de
#    GitHub, no el codigo:
#      · Activar «Require status checks to pass before merging» en la rama
#        main de 100p-NANO/ecosistema-cr, exigiendo el flujo `verificar`.
#        Con eso, a main solo llega lo que ya paso la compuerta, y este
#        disparador hereda esa garantia sin necesitar ninguna credencial.
#      · Y, mientras no este activado: nadie empuja a main directamente.
#        Se trabaja por rama y se fusiona con la comprobacion en verde.
#
#    Esta escrito aqui, y no solo en un documento, porque quien lea este
#    archivo para cambiar el despliegue es exactamente quien tiene que
#    saberlo.
resource "google_cloudbuild_trigger" "main" {
  count       = var.crear_disparador_github ? 1 : 0
  name        = "${var.prefijo}-main"
  location    = "global"
  description = "Push a main: imágenes, migraciones y despliegue de la API."

  github {
    owner = var.github_propietario
    name  = var.github_repositorio
    push {
      branch = "^main$"
    }
  }

  filename        = "infra/gcp/cloudbuild.yaml"
  service_account = google_service_account.construccion.id

  # Solo lo que cambia la imagen o el despliegue. Un cambio en el
  # prototipo (Netlify) o en los documentos no dispara nada.
  included_files = ["backend/api/**", "backend/db/migrations/**", "backend/db/seeds/**", "backend/scripts/migrar-produccion.sh", "backend/Dockerfile.migrador", "infra/gcp/cloudbuild.yaml"]

  substitutions = {
    _REGION  = var.region
    _PREFIJO = var.prefijo
  }

  depends_on = [google_project_service.apis]
}
