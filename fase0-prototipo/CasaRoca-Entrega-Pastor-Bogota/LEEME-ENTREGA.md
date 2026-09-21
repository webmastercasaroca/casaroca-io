# Casa Roca · Entrega — Pastor de Bogotá (sistema en 0)

Este es el **primer sistema a repartir**: el del **Pastor de Bogotá**, arrancando **totalmente vacío**.
Es una **copia aparte** del sistema; el build demo queda intacto en `~/Desktop/CasaRocaSystem Ai`.

## Qué tiene
- Todo en **0**: CRM, finanzas, asistencia, organigrama, grupos, equipo, sirve, oración, requerimientos,
  temáticas, cursos, directorio y ministerios (catálogo vacío). Consejería también vacía.
- Se conserva la **estructura** para operar: sede Bogotá, usuario pastor, espacios y equipos administrativos.
- El pastor empieza a llenar todo desde el organigrama y los formularios.

## Cómo se logró (técnico)
- Interruptor `window.CASAROCA_ENTREGA = true` inyectado como primer script en cada `.html`.
- Los archivos de datos (`store.js`, `pastor-data.js`, `director-data.js`, `rocakids-data.js`) detectan el
  flag y **nacen en 0** (sin datos demo). Lo que el pastor cree luego persiste normal en su navegador.
- El demo (carpeta original) NO se modifica en comportamiento: sin el flag, sigue con sus datos.

## Previsualizar
Doble clic en `iniciar-servidor.command` (usa el puerto **5174**), o en Terminal:

    cd ~/Desktop/CasaRoca-Entrega-Pastor-Bogota && python3 -m http.server 5174

Luego abre: http://localhost:5174/pastor.html

## Notas de entrega
- Los datos del pastor viven en el **navegador** de su equipo (localStorage). Cada navegador/equipo es
  independiente hasta la Fase 1 (backend real con sincronización).
- Para empezar de cero de nuevo: borrar los datos del sitio en el navegador (localStorage).
- Al subir a Netlify, incluir **toda** la carpeta (incluye `consejeria-*.html` para el panel anidado).

## Verificación
- jsdom en modo entrega: 17 vistas renderizan sin errores ni NaN; MIN_DEFS/CRM/cursos/PSTORE en 0. ✅
