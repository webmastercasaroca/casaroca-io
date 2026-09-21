# ARQUITECTURA · CasaRoca System AI
### Ficha de fase 0 · la lámina que un lector ajeno tiene que entender

> Versión 2.0 · 19 de septiembre de 2026. Reemplaza la ficha implícita que vivía repartida entre cuatro PDF del Drive.
> Norma: `docs/CHECKLIST-CREACION.md` · Estado real: `docs/AUDITORIA-19sep2026.md`

---

## 1 · El problema, en una frase

Una red de **36 iglesias y cerca de 25.000 congregantes**, administrada desde una central, lleva su información en plataformas distintas, hojas de cálculo y cuadernos. Nadie puede responder con certeza quién asiste, quién sirve, quién se perdió, ni cuánto aportó una sede, y los datos más delicados (menores, consejería, salud) viven donde no hay permisos ni rastro.

**El trabajo que el sistema hace:** que cada sede opere su domingo sin papel, que la central vea la red sin entrar a lo que no le corresponde, y que ningún dato sensible se toque sin dejar huella.

## 2 · Quién lo usa

| Perfil | Cuántos (orden de magnitud) | Qué hace un domingo |
|---|---|---|
| Congregante | 25.000 | Se registra, aporta, inscribe a sus hijos |
| Voluntario / servidor | ~4.000 | Recibe, cuenta, enseña, acompaña |
| Líder de grupo | ~800 | Registra su grupo y su gente |
| Maestro de niños | ~400 | Check-in y entrega de menores |
| Recepción / secretaría | ~70 | Registra visitantes |
| Tesorería de sede | ~40 | Registra y concilia aportes |
| Pastor de sede | 36 | Ve su sede completa |
| Supervisor regional | 3 a 6 | Ve su región |
| Equipos de la central | ~60, en 10 equipos | Ven la red por su función, no por su cargo |

## 3 · Volumetría y pico

| Medida | Hoy | A tres años |
|---|---|---|
| Personas | 25.000 | 40.000 |
| Sedes | 36 | 50 |
| Servicios por semana | ~150 | ~220 |
| Check-ins de menores por domingo | ~2.500 | ~4.000 |
| Aportes por mes | ~18.000 | ~30.000 |
| Hechos en la línea de tiempo por mes | ~120.000 | ~200.000 |

**⛔ El pico manda sobre el promedio.** El domingo entre las 9:00 y las 11:00 concentra más del 70 % del uso de la semana: 36 sedes registrando asistencia y entregando niños **a la misma hora**. El sistema se dimensiona contra esa ventana, no contra el promedio semanal. La prueba de carga que la valida es `scripts/probar-carga.js`.

## 4 · Perfil de infraestructura elegido

**Perfil D · plataforma del cliente (Google Cloud).** Elegido por escrito en `docs/DECISIONES/ADR-001`.

```
                        Internet
                            │
              ┌─────────────▼─────────────┐
              │  Balanceador + Cloud Armor │  TLS, WAF, redirección 301
              └───────┬───────────┬────────┘
                      │           │
        ┌─────────────▼──┐   ┌────▼─────────────┐
        │ Cloud Run · API│   │ Cloud Run · Front│
        │  NestJS        │   │  estático        │
        └───────┬────────┘   └──────────────────┘
                │ (red privada, sin IP pública)
        ┌───────▼────────┐  ┌──────────────┐  ┌──────────────┐
        │ Cloud SQL      │  │ Memorystore  │  │ Secret Mgr   │
        │ PostgreSQL 16  │  │ Redis (colas)│  │ + Cloud KMS  │
        │ RLS + auditoría│  └──────────────┘  └──────────────┘
        └────────────────┘
```

**Por qué no un perfil más ligero:** los datos de menores y de consejería exigen llave gestionada, red privada y bitácora de lectura. Un gestionado ligero (Netlify + base compartida) no da control sobre dónde vive la llave ni permite cerrar la base al mundo.

## 5 · Costo

| Concepto | USD/mes | COP/mes (4.050) |
|---|---|---|
| Producción | 488 | 1.976.400 |
| Preproducción | 18 | 72.900 |
| **Total** | **506** | **2.049.300** |
| **Presupuesto con colchón** | | **2.500.000** |

**Peor caso** (pico sostenido y tasa a 4.400): ~2.400.000 COP/mes. El presupuesto lleva alerta automática al 80 % y al 100 % (`infra/gcp/fases.tf`).

**Decisión pendiente de la mesa:** la región. São Paulo en vez de `us-east1` cuesta unos **575.000 COP/mes más** y depende de la cláusula de residencia de datos que se firme. Hasta que se decida, el perfil queda en `us-east1` y así está escrito.

## 6 · SLA objetivo, por módulo

| Módulo | Disponibilidad | Por qué |
|---|---|---|
| Check-in de RocaKids | 99,9 % en la ventana dominical | Si falla, hay 2.500 niños y ninguna forma segura de entregarlos |
| Asistencia y nuevos | 99,5 % | Se puede registrar después, no se pierde |
| Aportes | 99,9 % | Involucra dinero de terceros |
| Consejería | 99,5 % | Uso bajo y disperso |
| Analítica y reportes | 99,0 % | Nadie decide nada un domingo con un reporte |

**RPO 15 minutos · RTO 4 horas.** Copia continua de Cloud SQL más copia lógica diaria cifrada. Quien asume la pérdida de hasta 15 minutos de escrituras es la mesa administrativa; queda firmado en el acta de entrega.

## 7 · Los datos, por nivel de sensibilidad

| Nivel | Qué | Ejemplos | Quién puede |
|---|---|---|---|
| **N0** | Público | Catálogos, sedes, roles | Cualquier sesión |
| **N1** | Interno | Grupos, asistencia agregada | La sede |
| **N2** | Personal | Nombre, contacto, membresía | La sede, con permiso del módulo |
| **N3** | Sensible | Aportes con monto, notas de consejería, contratos | Rol con techo N3, con bitácora de lectura |
| **N4** | Crítico | Menores, acudientes, salud, códigos de entrega | Rol con techo N4, cifrado por columna, nadie exporta |

La clasificación vive **columna por columna** en `plataforma.clasificacion_columna` y es consultable. No es un anexo de un documento: es una tabla.

## 8 · Multi-tenancy

**Base compartida con seguridad por fila y doble cerradura.** Justificado en `docs/DECISIONES/ADR-001`.

- Toda tabla de negocio lleva `sede_id`. Sin excepción, y verificado por `plataforma.v_control_rls`, no por memoria.
- La visibilidad de una persona la da su **membresía** (`nucleo.membresias_sede`), no una columna mutable: ver `docs/DECISIONES/ADR-002`.
- La organización tiene cuatro niveles: **red → región → sede → campus**, más las unidades que no son congregación (central, direcciones, equipos) en `org.unidades`.
- El permiso efectivo es **rol × alcance × nivel × vigencia**, y puede venir de una asignación personal o **heredado de un equipo**.

## 9 · Lo que el sistema se niega a hacer

Esto no es una lista de deseos: son reglas que la base rechaza, cada una con su prueba.

1. Un menor sin acudiente autorizado no se registra.
2. Nadie exporta datos de menores. Ni el administrador.
3. No se asigna un rol de menores sin antecedentes vigentes.
4. No se contacta a nadie sin consentimiento registrado para ese canal.
5. La aplicación no puede subirse su propio techo de permisos.
6. La sede de una persona no se cambia con un `UPDATE`: se traslada, con fecha y motivo.
7. Un módulo con compuerta legal no se enciende sin evidencia registrada.
8. La auditoría no se altera ni se borra.

## 10 · Definición de terminado

El producto está listo cuando **la sede de Chía lo usa un domingo sin llamar a nadie**, y cuando quien lo construyó puede desaparecer sin que el sistema se caiga. No cuando funciona en una máquina.
