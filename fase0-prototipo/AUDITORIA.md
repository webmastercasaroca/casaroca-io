# Casa Roca · AI System — Auditoría (arquitectura, tecnología y bugs)

> Fase de auditoría previa al reparto del sistema. Primer sistema a entregar: **Pastor de Bogotá**.
> Base: repo local `~/Desktop/CasaRocaSystem Ai` (mirror de Netlify + modificaciones). Fecha: 08 jul 2026.
> Método: recorrido en navegador (17 vistas + modales), pruebas con node/jsdom, y revisión de código.

## 0. Resumen ejecutivo
El sistema del pastor es sólido a nivel de producto y no arroja errores de render ni excepciones JS
al recorrer las 17 vistas. Los riesgos relevantes para el **reparto** son: (1) robustez con datos
**vacíos** (crítico porque se entrega en 0), (2) que es un prototipo **sin backend** (datos en
`localStorage`, sin identidad real ni permisos en el motor), y (3) la **dependencia de despliegue**
del sistema de Consejería embebido. Ninguno impide entregar una demo; sí condicionan una entrega real.

## 1. Estado del recorrido (pasada 1)
- 17 vistas recorridas (Analítica, Tareas, CRM, Finanzas, Asistencia, Organigrama, Calendario,
  Grupos, Equipo, Sirve, RocaKids, Temáticas, Cursos, Oración, Consejería, Requerimientos, Directorio).
- **0 errores de render, 0 excepciones JS.** Modales probados (diezmo, etc.) sin fallos.
- Suite jsdom (todas las vistas + perfiles + inscripción + organigrama): **TODO OK**.

## 2. Bugs encontrados y corregidos (arreglo sobre la marcha)
| # | Severidad | Hallazgo | Estado |
|---|---|---|---|
| B1 | Media | Analítica: `promedio dominical` dividía por `asis.length` → **NaN** si la lista está vacía (caso entrega en 0). | ✅ Corregido (guarda `asis.length ?`) |
| B2 | Media | KPI drill "domingo": misma división por 0 → NaN con datos vacíos. | ✅ Corregido |
| B3 | Baja | Finanzas/Asistencia: acceso a `[length-1]` del último domingo. | ✅ Ya tenía guarda `|| {…}` |

## 3. Riesgos de arquitectura y tecnología (registro)
| ID | Severidad | Tema | Detalle | Recomendación |
|---|---|---|---|---|
| A1 | **Alta** | Sin backend / identidad | Datos en `localStorage` por navegador; el "login" es selección de rol; PIN en cliente. La privacidad depende de la UI, no del motor. | Fase 1: Postgres + Auth + **RLS** (ya diseñado en ARQUITECTURA.md). Para el reparto demo, comunicar que los datos viven en el navegador de cada quien. |
| A2 | **Alta** | Sincronización multi-dispositivo | La sync es por evento `storage` entre pestañas del **mismo** navegador. Entre equipos/usuarios distintos NO hay sync hasta el backend. | Igual que A1: Realtime en Fase 1. |
| A3 | Media | Consejería embebida | El Panel Anidado carga `consejeria-*.html` por iframe **mismo origen** con auto-entrada. Requiere que esos archivos se desplieguen **junto** al sitio. En el deploy actual de `ecosistemacr` daban 404. | Incluir `consejeria-*.html/js/css` en el mismo deploy (ya están en el repo). Verificar tras subir. |
| A4 | Media | Privacidad de diezmos | El monto por persona NO se muestra al pastor (se reemplazó por checklist sí/no de 3 meses). Pero el dato `ultimoDiezmoMonto` sigue existiendo en los seeds. | En backend, el monto vive en tabla aparte con RLS solo Dirección (§7.4). En demo, no exponerlo en ninguna vista del pastor. ✔ hoy no se expone. |
| A5 | Media | Menores (RocaKids) | Protección reforzada y código de entrega ya en el esquema; en el pastor se delega al módulo. | Mantener; revisar en la entrega de RocaKids. |
| A6 | Baja | QR de inscripción | Se genera vía `api.qrserver.com` (tercero); envía la URL de inscripción del curso a ese servicio y requiere internet. | Aceptable para demo. Opcional: generar QR local (librería) para no depender de terceros. |
| A7 | Baja | Archivos monolíticos | `pastor.js` ~2.5k líneas; sin build. Mantenible pero grande. | OK para Fase 0. Modularizar en Fase 1 (Next.js). |
| A8 | Baja | Duplicación de seed | Datos demo repetidos entre `data.js`, `pastor-data.js`, `director-data.js`, etc. (deuda ya documentada). | Se resuelve con fuente única en Fase 1. Para la entrega en 0, hay que vaciar **todas** las fuentes. |

## 4. Preparación para la ENTREGA EN 0 (crítico)
Decisiones del proyecto: **copia aparte vacía** + **vacío total** (incluidos ministerios y cursos base).

### 4.1 Fuentes de datos a vaciar (todas)
- `window.PASTOR` (pastor-data.js): `MIN_DEFS` (ministerios + rosters), `FINANZAS` (series), `DIRECTORIO_PASTORES/ADMIN`, `ASISTENCIA`, `CONSEJERIAS`, `AYUDAS_MAS`.
- `window.PSTORE` (pastor-data.js): organigrama, sistemas, espacios, eventos, peticiones, temáticas, presupuesto, gastos, diezmosDomingo, asistenciaDomingo, requerimientos.
- `window.STORE` (store.js): grupos/inscritos, cursos, crmPersonas.
- `window.DB` (data.js), `window.DIRECTOR` (director-data.js), `window.RKSTORE` (rocakids), `window.LANDING`.

### 4.2 Qué se conserva
- Identidad de la sede (Bogotá) y usuario pastor (para poder entrar).
- Estructura de la app y catálogos como **cascarón** (para que el pastor cree desde el organigrama).

### 4.3 Riesgo asociado
Con todo vacío, muchas vistas quedan en 0 y algunos cálculos pueden romperse (medias, gráficos).
Ya se blindaron B1/B2; se hará una **pasada de estado vacío** completa sobre el build de entrega.

### 4.4 Checklist de entrega
- [ ] Build de entrega en carpeta aparte, vacío total.
- [ ] Recorrer las 17 vistas vacías sin errores ni NaN; textos de "sin datos" correctos.
- [ ] Consejería: `consejeria-*` incluidos y también vacíos.
- [ ] Reset/borrado de `localStorage` en el primer arranque del pastor (empezar limpio de verdad).
- [ ] Verificar en el navegador Casaroca (local) antes de subir a Netlify.

## 5. Próximos pasos
1. Construir el build de entrega en 0 (carpeta aparte) y correr la pasada de estado vacío.
2. Pasadas adicionales de auditoría: accesibilidad (foco/teclado en modales), rendimiento, y revisión
   por rol (director, líder, central) cuando toque repartirlos.
3. Cerrar la decisión de residencia de datos (§5 ARQUITECTURA) antes de la Fase 1.

*Documento vivo — se actualiza en cada pasada de auditoría.*
