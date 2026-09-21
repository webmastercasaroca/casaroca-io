# Casa Roca · Entrega — Pastor Director General (sistema en 0)

Copia aparte **vacía** del sistema del **Pastor Director General** (app `central.html`): dirige toda la
red desde la sede madre (tablero de red, CRM master, 8 equipos ERP, organigrama corporativo, instituto,
calendario empresarial, requerimientos y peticiones internas). Arranca **totalmente en 0**.

## Qué tiene
- Todo en **0**: red de sedes, CRM master, equipo central, finanzas de red, organigrama corporativo,
  eventos, requerimientos, peticiones y datos de los equipos ERP (Contabilidad, Tesorería, RRHH, Legal,
  Instituto, Comunicaciones, Construcción).
- Se conserva la **estructura** para operar: usuario director, catálogo de equipos ERP y espacios corporativos.
- El director empieza a construir la red (crear pastores de sede, organigrama, etc.).

## Bugs de estado vacío corregidos (auditoría)
Al vaciar el central aparecieron y se corrigieron 4 bugs que rompían con datos en 0:
`genRequerimientos` (elegía sede inexistente), `red()` (división por 0 y `SEDES[0]`),
`delta()` de gráficos (serie vacía) y `Tesorería` (flujo vacío). Ahora las 16 vistas cargan sin errores ni NaN.

## Previsualizar
Doble clic en `iniciar-servidor.command` (usa el puerto **5175** o el siguiente libre), o en Terminal:

    cd ~/Desktop/CasaRoca-Entrega-Pastor-Director && python3 -m http.server 5175

Luego abre: http://localhost:5175/central.html

## Notas
- Mismo mecanismo que la entrega del pastor: interruptor `window.CASAROCA_ENTREGA`.
- Los datos del director viven en su navegador (localStorage) hasta la Fase 1 (backend).
- Al subir a Netlify va **toda** la carpeta.

## Verificación
- jsdom en modo entrega: 16 vistas sin errores ni NaN; SEDES/CRM master/organigrama/ERP en 0. ✅
- Demo (sin flag): intacto, 16 vistas sin errores.
