# CasaRoca System · Backend Fase 1 — Base de datos

Implementación **ejecutable** de la arquitectura aprobada en la mesa de trabajo
(Documentos 1 a 4, julio–agosto 2026). No es un diseño en papel: son migraciones
SQL que corren, con un banco de pruebas que demuestra cada garantía.

## Qué hay aquí

```
db/migrations/   12 migraciones SQL planas, en orden, revisables línea a línea
db/seeds/        catálogos (16 tipos de documento, 24 vínculos, 14 roles) + sedes demo
db/tests/        banco de invariantes + prueba de aislamiento entre sedes
scripts/         arrancar / migrar / probar
entregas-drive/  documentos listos para subir al Drive «Sistema 100p», por carpeta
```

## Cómo se corre (3 comandos)

```bash
./scripts/arrancar.sh    # levanta PostgreSQL 16 local en el puerto 5433
./scripts/migrar.sh      # recrea casaroca_dev y aplica las 12 migraciones + seeds
./scripts/probar.sh      # corre las 25 pruebas
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

- 12 migraciones aplican limpias sobre PostgreSQL 16.14.
- 25 pruebas, 25 pasan (16 de invariantes + 9 de aislamiento).
- Cubre los esquemas **Núcleo, 01 Organización, 02 Identidad, 04 CRM, 11 Línea de
  tiempo y Plataforma transversal**. Faltan por construir: 03 Grupos, 05 Asistencia,
  06 RocaKids, 07 Consejería, 08 Aportes, 09 Formación, 10 Talento.
- La llave de cifrado N4 en desarrollo viene de un GUC. **En producción debe venir
  del gestor de llaves (KMS), nunca del código ni de una tabla de la propia base.**

## Advertencia que va escrita en el Documento 1 y sigue vigente

Esto certifica que **lo diseñado** cubre los controles. No certifica que lo
construido los cumpla en producción: eso lo verifica la prueba de intrusión
externa de la compuerta G5.
