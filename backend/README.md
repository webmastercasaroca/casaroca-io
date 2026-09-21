# CasaRoca System · Backend Fase 1 — Base de datos

Implementación **ejecutable** de la arquitectura aprobada en la mesa de trabajo
(Documentos 1 a 4, julio–agosto 2026). No es un diseño en papel: son migraciones
SQL que corren, con un banco de pruebas que demuestra cada garantía.

## Qué hay aquí

```
db/migrations/   41 migraciones SQL planas, en orden, revisables línea a línea
db/seeds/        catálogos (16 tipos de documento, 24 vínculos, 14 roles) + sedes demo
db/tests/        6 bancos: invariantes, aislamiento, módulos, consola y empalme 100p
api/             API NestJS del Módulo de Nuevos, sobre el contrato del equipo 100p
scripts/         arrancar / migrar / probar
entregas-drive/  documentos listos para subir al Drive «Sistema 100p», por carpeta
```

## Cómo se corre (3 comandos)

```bash
./scripts/arrancar.sh    # levanta PostgreSQL 16 local en el puerto 5433
./scripts/migrar.sh      # recrea casaroca_dev y aplica las 41 migraciones + seeds
./scripts/probar.sh      # corre las 104 pruebas de la base
```

Requiere PostgreSQL 16 (Postgres.app). No hay dependencias de red ni de nube.

## Las decisiones que están codificadas

| Decisión | Dónde vive |
|---|---|
| PostgreSQL 16, SQL plano, sin ORM propietario en las migraciones | `db/migrations/` |
| Doble cerradura: motor de políticas + RLS con `SET LOCAL app.*` | `0008_rls_doble_cerradura.sql` |
| Clasificación N0–N4 que **activa** controles, no que los describe | `0001`, `0011` |
| Bitácora de **lectura** sobre N3/N4 | `0007_auditoria_bitacora.sql` |
| Permiso = rol × alcance × sensibilidad × vigencia (14 roles) | `0006_identidad_permisos.sql` |
| Habeas Data (Ley 1581) append-only con finalidad, canal y evidencia | `0005` |
| Menor sin acudiente hace fallar la transacción | `0004_menores_acudientes.sql` |
| Linaje de migración (`source_system` + `source_id`) en todo lo migrable | `0002`, `0003`, `0005`, `0009`, `0010` |

## Estado

**18 de septiembre de 2026 · todo lo del Drive «Sistema 100p» quedó en el sistema** (migración
`0040`, seed `018`). Base desde cero: **41 migraciones, 104 pruebas, 104 pasan** en 7 bancos
(el nuevo, `modelo_drive_100p`, prueba cada renglón del Drive). API: `probar-api.sh` 5/5 y
`probar-api-drive.sh` 22/22 contra la API corriendo.

- El modelo del Drive se lee con SUS nombres en el esquema `modelo100p` (15 tablas, solo
  lectura, con la RLS de siempre) y por HTTP en `GET /api/v1/modelo100p/<tabla>`.
- Donaciones: `GET/POST /api/v1/aportes`, `POST /aportes/:id/confirmar`,
  `POST /aportes/certificados`, `GET /aportes/certificados/:id/documento`, `POST …/anular`.
- Avisos (bienvenida, coordinador, miembro, pago, certificado): se encolan en la base y los
  envía `POST /api/v1/notificaciones/procesar` por SendGrid (`SENDGRID_API_KEY`, `NOTIFICACIONES_TOKEN`).
- Despliegue en GCP según el plan de costos de Jhon: `infra/gcp/` (sin aplicar).
- ⛔ `api/node_modules` es un enlace a `node_modules.nosync`: iCloud vaciaba las dependencias
  del Escritorio y la API se quedaba colgada al arrancar sin decir nada.

**Histórico:**

**Reverificado el 11 de septiembre de 2026 corriendo los tres scripts, no leyendo el código:**

- **32 migraciones** aplican limpias sobre PostgreSQL 16.14, sin un solo `ERROR`.
- **89 pruebas, 89 pasan, 0 fallan**, repartidas en seis bancos:

  | Banco | Qué demuestra | Pasan |
  |---|---|---|
  | `invariantes` | Las garantías del núcleo: menores, consentimiento, clasificación | 16 / 16 |
  | `aislamiento_rls` | La segunda cerradura: una sede no ve a otra, corriendo como `casaroca_app` | 9 / 9 |
  | `invariantes_modulos` | Esquemas 03 a 10 (grupos, asistencia, RocaKids, consejería, aportes, formación, talento) | 21 / 21 |
  | `consola_sistemas` | Módulos, habilitación por iglesia y matriz de permisos | 25 / 25 |
  | `empalme_100p` | El contrato con los módulos de Roles, Nuevos y Donaciones del equipo | 12 / 12 |
  | `rls_tablas_hijas` | La tercera cerradura: las tablas hijas y el techo de permisos (ver 0031) | 6 / 6 |

- **Los 12 esquemas están construidos**, no faltan los siete que decía esta línea antes:
  Núcleo, 01 Organización, 02 Identidad, 03 Grupos, 04 CRM, 05 Asistencia, 06 RocaKids,
  07 Consejería, 08 Aportes, 09 Formación, 10 Talento y 11 Línea de tiempo.
- La llave de cifrado N4 en desarrollo viene de un GUC. **En producción debe venir
  del gestor de llaves (KMS), nunca del código ni de una tabla de la propia base.**

## Advertencia que va escrita en el Documento 1 y sigue vigente

Esto certifica que **lo diseñado** cubre los controles. No certifica que lo
construido los cumpla en producción: eso lo verifica la prueba de intrusión
externa de la compuerta G5.
