# ADR-001 · Modelo de aislamiento entre sedes y perfil de infraestructura

- **Estado:** Aceptado
- **Fecha:** 31 de agosto de 2026 (documentado retroactivamente el 19 de septiembre de 2026)
- **Decide:** mesa técnica del proyecto 100p

## Contexto
36 sedes, cerca de 25.000 congregantes, una central con varios equipos, y datos de menores y de consejería en la misma plataforma. Había que elegir cómo se aíslan los datos de una sede de los de otra.

## Opciones consideradas
1. **Base compartida con seguridad por fila.** Una sola base, una columna de sede en toda tabla, políticas del motor.
2. **Un esquema por sede.** 36 esquemas con la misma estructura.
3. **Una base por sede.** Aislamiento físico total.

## Decisión
**Base compartida con seguridad por fila y doble cerradura** (opción 1), sobre PostgreSQL 16, con perfil de infraestructura **D · plataforma del cliente** (Google Cloud: Cloud Run, Cloud SQL, KMS, Keycloak).

## Razones
- Un reporte de red que cruce las 36 sedes es una consulta, no 36 consultas más un consolidado.
- 36 esquemas multiplican por 36 el costo de cada migración: 41 migraciones serían 1.476 aplicaciones.
- Una base por sede hace imposible la persona única en la red, que es requisito por los traslados.
- El riesgo de la opción 1 (una tabla sin política deja ver todo) se mitiga con `plataforma.v_control_rls`, que delata sola cualquier tabla legible sin política, y con pruebas que corren **como el rol de la aplicación** y no como superusuario.

## Consecuencias
- Toda tabla de negocio lleva la columna de sede. Sin excepción.
- Las pruebas de aislamiento son obligatorias en cada migración.
- Una falla en la política del motor expone todas las sedes a la vez: por eso la doble cerradura y por eso la auditoría de agosto y la de septiembre (migración `0031`).

## Revisar si
La red supera las 150 sedes, o si una sede internacional exige residencia de datos en su propio país.
