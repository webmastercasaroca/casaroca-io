# ADR-002 · La sede de una persona deja de ser una columna y pasa a ser una membresía con vigencia

- **Estado:** Propuesto (espera decisión de la mesa)
- **Fecha:** 19 de septiembre de 2026
- **Origen:** hallazgo H-02 de `AUDITORIA-19sep2026.md`

## Contexto
`nucleo.personas.sede_id` es hoy una columna obligatoria y mutable (`0003_nucleo_persona.sql:26`). Cuando una persona se traslada, cambiar esa columna:
- entrega a la sede nueva toda la historia de la anterior, incluidos los aportes;
- borra a esa persona de los reportes históricos de la sede anterior;
- no deja fecha de llegada ni de salida;
- y hace imposible representar a quien congrega en una sede y sirve en otra, que en una red de 36 sedes es común.

## Opciones
1. **Dejarlo como está** y resolver el traslado con un procedimiento manual.
2. **Tabla de membresía** persona × sede con vigencia, tipo y motivo. La columna queda como sede de origen o se elimina.
3. **Duplicar la persona** por sede. Se descarta: rompe la persona única en la red y multiplica los duplicados.

## Decisión propuesta
Opción 2. Migración `0041`:

- `nucleo.membresias_sede` (`persona_id`, `sede_id`, `tipo`, `desde`, `hasta`, `motivo`, `aprobado_por`), con una sola membresía vigente de tipo principal por persona.
- Vista `nucleo.v_sede_actual` para lo que hoy lee `personas.sede_id`.
- La seguridad por fila pasa a resolver la sede desde la membresía **vigente en la fecha del hecho**, no desde la sede de hoy.
- Carga inicial desde el `sede_id` actual, con la fecha de creación de la persona como `desde`.
- Prueba nueva: trasladar a una persona **no** cambia quién puede ver su historia anterior.

## Consecuencias
- Toca las políticas de todas las tablas que hoy resuelven la sede por la persona. Es el cambio más invasivo del modelo, y por eso se hace ahora y no con dos años de datos encima.
- Habilita el traslado como proceso con aprobación, la doble pertenencia, y los reportes históricos estables.

## Pendiente de decidir por la mesa
- ¿Quién aprueba un traslado: el pastor que recibe, el que entrega, o los dos?
- ¿La historia de consejería viaja con la persona, o se queda y exige consentimiento nuevo? La recomendación técnica es que **no viaje**.
