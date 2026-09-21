# docs · Gobierno del CasaRoca System AI

| Documento | Para qué sirve |
|---|---|
| [`CHECKLIST-CREACION.md`](CHECKLIST-CREACION.md) | La norma. 14 bloques, 200 ítems, 10 compuertas y las 15 preguntas con las que un auditor tumba el proyecto. Describe lo que **debe** haber |
| [`AUDITORIA-19sep2026.md`](AUDITORIA-19sep2026.md) | El estado **real** medido contra la norma, con 13 hallazgos citando archivo y línea, y el plan en tres olas |
| [`DECISIONES/`](DECISIONES/) | Registro de decisiones (ADR). Toda decisión irreversible con fecha, alternativas y razón |
| [`ARQUITECTURA.md`](ARQUITECTURA.md) | La ficha de fase 0: problema, volumetría, **pico dominical**, perfil de nube, costo, SLA por módulo y niveles de dato |
| [`INFRA.md`](INFRA.md) | Inventario vivo: qué recurso, con qué identificador y cuánto cuesta. Y qué está aplicado y qué no |
| [`RUNBOOK.md`](RUNBOOK.md) | Cómo se opera: arrancar, restaurar, rotar la llave, agregar una sede, quitar un acceso **ahora**, y qué hacer un domingo a las 9 |
| [`HANDOFF.md`](HANDOFF.md) | La entrega: tabla de tres columnas, lo que se cerró, lo que falta y las decisiones que esperan a la mesa |

## Cómo se usa
1. Antes de construir cualquier cosa, se abre el checklist y se marca qué ítems toca.
2. Nada se da por terminado sin la tabla de tres columnas (backend, frontend, infraestructura) con evidencia.
3. La auditoría se vuelve a correr en cada cierre de fase, no una sola vez.

## Regla de oro
Una afirmación no es evidencia. Vale la corrida con fecha, la prueba que falla si alguien rompe la garantía, o el documento firmado. Nada más.
