# ADR-003 · Qué se cifra por columna y qué no

- **Estado:** Aceptado
- **Fecha:** 19 de septiembre de 2026
- **Origen:** la auditoría interna corrigió la fórmula del control de cifrado y destapó 19 columnas que «exigen cifrado» y no están cifradas. Antes de cifrarlas había que decidir si eso era lo correcto.

## Contexto

El modelo marcaba `exige_cifrado` a nivel de NIVEL de sensibilidad: todo lo que fuera N3 o N4 debía ir cifrado por columna. Con la fórmula del control mal escrita, esas 19 columnas figuraban como conformes. Al corregir la fórmula aparecieron todas de golpe.

Cifrarlas todas habría sido peor que no cifrar ninguna:

- `aportes.aportes.persona_id` es una **clave foránea**. Cifrada deja de referenciar.
- `aportes.aportes.monto` hay que **sumarlo**. Cifrado con un esquema no homomórfico se pierde la reconciliación al peso, que es la garantía más citada del módulo.
- `consejeria.notas.contenido` hay que **buscarlo** dentro.
- `rocakids.checkins.menor_id` es clave foránea y se usa en toda política de seguridad por fila.

Cifrar eso no es más seguridad: es romper el sistema y llamarlo control.

## Decisión

Se distinguen dos cosas que el modelo confundía:

| | **SECRETO** | **DATO SENSIBLE** |
|---|---|---|
| Qué es | Un valor que **nunca** se consulta, se filtra ni se agrega | Un dato que se consulta, se filtra y se suma |
| Ejemplos | Código de entrega de un menor, secreto del segundo factor, derivación de la contraseña | Monto de un aporte, nota de consejería, identificador de un menor |
| Protección | **Cifrado por columna**, siempre | Seguridad por fila + bitácora de lectura + prohibición de exportar + **cifrado en reposo del disco** (KMS en Cloud SQL) |
| Cómo se marca | `clasificacion_columna.es_secreto = true` | `es_secreto = false` con su nivel N3 o N4 |

El control `plataforma.v_control_clasificacion` pasa a medir dos cosas distintas: `secreto_sin_cifrar` (incumplimiento, siempre) y `sin_lectura_registrada` (una bitácora que existe en el catálogo y no en la práctica).

## Consecuencias

- El cifrado en reposo deja de ser opcional: **sin KMS aplicado en Cloud SQL, los datos N3 no tienen su control**. Eso sube la prioridad de aplicar la infraestructura.
- La bitácora de lectura pasa a ser obligatoria de verdad para N3 y N4, no una casilla. El control la mide.
- Los tres secretos declarados (`codigo_cifrado`, `clave_hash`, `segundo_factor_secreto`) están cifrados, y dos de ellos con algo más fuerte que cifrado reversible: la contraseña es una derivación scrypt, que no se puede deshacer ni con la llave.

## Revisar si

Aparece una columna N4 que además haya que consultar. Ese caso exige cifrado que preserve el orden o la búsqueda, y es una decisión distinta.
