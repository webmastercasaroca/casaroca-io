# Casa Roca · Modificaciones al rol PASTOR PRINCIPAL — Memoria de trabajo

> Guardado a pedido de Daniel (08 jul 2026). Base: mirror exacto del deploy de Netlify
> `https://ecosistemacr.netlify.app` traído a este repo local. Editar aquí y redeployar a Netlify.

## Contexto del repo
- Repo local: `~/Desktop/CasaRocaSystem Ai` (mirror de Netlify, git inicializado).
- Sitio estático vanilla JS. La app del pastor = `pastor.html` + `assets/js/pastor.js` (+ `pastor-data.js`, `pastor-rocakids.js`, `data.js`, `store.js`, `pastor.css`).
- Solo diferían de Netlify (ya actualizados): `pastor.js`, `data-filial.js`, `landing.css`, `hub.html`, `pastor.html`.
- Consejería (`consejeria-*.js/html`) NO está desplegada en este sitio (404 en Netlify); es un deploy aparte.

## REGLA GLOBAL (clave)
1. **Todos los CRM conectados a un CRM central.** Ningún módulo actúa como ente independiente.
   Cada formulario, sin importar la pestaña donde se recoja, debe **centralizarse en el CRM general**.

## Cambios por módulo

### CRM (pastor)
2. Corregir el botón de búsqueda: hoy es un **cuadrado gigante**; debe ser una **barra de búsqueda**.

### Finanzas y Asistencia
3. Añadir botón **"Añadir diezmo"**: el pastor sube el monto del diezmo de su iglesia cada domingo.
4. **Quitar** la ventana/pestaña **"Ahorro y fondos"**.
5. Añadir nueva ventana **"Asistencia"**: registrar la asistencia del domingo y **gráfico de tracking** de asistencia.

### Organigrama (aquí el pastor agrega personas y accesos)
6. Añadir botón de **zoom** (el panel crecerá mucho).
7. Añadir botones **expandir / contraer** (los mapas crecerán muchísimo).

### Equipo
8. Vista en **lista** (con los mismos filtros actuales).
9. Al hacer click en una persona que sirve: ver toda su info **más un checklist de diezmo de los últimos 3 meses** (check sí/no, **no el monto**).

### Provisión de director (desde el organigrama)
10. Cada vez que el pastor crea un cuadro en el organigrama, se activa el **sistema del director** con pestañas
    **en 0**: analítica, CRM, grupos pequeños, equipo, nuevos, organigrama, temáticas, peticiones, calendario.
11. Al crear **RocaKids** → debe quedar **anclado 100% a la app de RocaKids** ya creada.
    El resto de ministerios/creaciones → anclados **100% al sistema del pastor**.

### Servidores (perfil de persona que sirve / cursos)
12. Tener todos los **cursos** activados. Los que están en orden: **ADN, Bautizo, Llaves del Poder, Madurez Espiritual**,
    **IBLI** (al dar click, mostrar en qué curso va, de **1 a 4**), **FACTER** (al click, muestra si va de **5 a 8**).
    FACTER **no se activa si no se hizo IBLI**.
13. Botón de **Consejería** anclado a ver la información de las consejerías: cuándo, quién la tomó, cuántas veces —
    todo lo que vincule a esa persona con consejería.
14. **Sirve**: totalmente sincronizado con el organigrama.
15. **RocaKids**: totalmente sincronizado con la app.

### Cursos
16. Cursos está bien. Pero al **crear un curso**, crear también un **formulario de inscripción básico**:
    nombre, correo, cumpleaños, si está activo en un ministerio o es nuevo, si es mujer u hombre.
    Este formulario **totalmente sincronizado con el CRM general**.

### Oración y Peticiones
17. Para el pastor: **fusionar** peticiones locales + directivas (son las mismas). Dejarla con nombre **"Oración"**.
    Totalmente sincronizada con cada director de ministerio que se cree.

### Directorio
18. Vista tipo **CRM**. Corregir el cuadro de búsqueda → **barra de búsqueda** como en los demás.
19. Añadir la pestaña de **Consejería** (la misma de directores, debe estar anclada).

## Entorno de trabajo (memoria operativa)
- **Navegador:** usar SIEMPRE el navegador **"Casaroca"** (Daniel tiene otros navegadores en otras tareas — NO tocarlos).
- **Repo:** `~/Desktop/CasaRocaSystem Ai` (git). Fuente de verdad = Netlify; editar aquí y redeployar.
- **Cómo se trajo la base:** los `.js` de Netlify se sirven como binario para web_fetch y la consola del navegador
  tiene límite de salida (~1.9 KB), así que se descargó un paquete único desde el navegador y se verificó por SHA-256.
  Para futuras traídas de archivos grandes: empaquetar en el navegador → descargar → dividir/verificar localmente.
- **Verificación de render:** cargar los JS con node/jsdom y probar cada vista del pastor antes de dar por hecho un cambio.
- **Deploy:** Daniel arrastra la carpeta a Netlify (o deja que se despliegue). Consejería es un deploy aparte.

## Estado — TODOS los puntos implementados y verificados (jsdom) · 08 jul 2026
- [x] Base traída de Netlify y verificada; repo en Escritorio; memoria guardada.
- [x] 1. CRM central (STORE.crmAgregar/crmPersonas; registroSede lo integra).
- [x] 2. Búsqueda CRM y Directorio → barra (CSS reset de apariencia nativa).
- [x] 3. Finanzas: botón "Añadir diezmo" (persiste) + "Ahorro y fondos" eliminado.
- [x] 4. Asistencia: nueva ventana + gráfico de tracking (asistencia y nuevos por domingo).
- [x] 5. Organigrama: zoom (−/%/＋) + expandir/contraer (por nodo y global).
- [x] 6. Equipo: vista lista (tabla) + perfil con checklist de diezmo 3 meses (sin monto).
- [x] 7. Provisión de director: sistema con 9 pestañas en 0; RocaKids anclado a su app; resto al pastor.
- [x] 8. Servidores: cursos + IBLI (1–4) + FACTER (5–8, bloqueado sin IBLI) + botón Consejería.
- [x] 9. Cursos: formulario de inscripción por curso (📲) + enlace/WhatsApp, sync CRM.
- [x] 10. Oración: fusiona Peticiones (incl. internas); ítem "Peticiones" eliminado del menú.
- [x] 11. Directorio: vista CRM (tabla) + barra de búsqueda + pestaña Consejería.
- [x] Fix reportado en preview: scroll del menú lateral (nav scrollable en escritorio).

### Verificación
- `node verificar-render.js` y pruebas jsdom: 15 vistas renderizan sin error; todos los marcadores OK.
- Archivos tocados: `assets/js/pastor.js`, `assets/js/pastor-data.js`, `assets/js/store.js`, `assets/css/pastor.css`.

## Ronda 2 de ajustes (feedback del preview) — implementada y verificada
- [x] P1. Diezmos y asistencia POR SERVICIO (7:00 am / 9:00 am / 11:30 am / Miércoles 7:00 pm);
  gráficos agregados por domingo + desglose por servicio. Scope: el pastor solo ve SU sede.
- [x] P2. Gráfico de asistencia ya no se ve gigante (línea + barras en grid de 2 columnas).
- [x] P3. Organigrama: cada cuadro de director con ministerio tiene botón 👥 "Equipo (N)" para
  desplegar/contraer el equipo (roster) de ese ministerio; abre el perfil al tocar una persona.
- [x] P4. Equipo: tabla ordenada (celdas alineadas, ancho de columnas).
- [x] P5. Sirve: el pastor local solo ve su iglesia (se quitó el selector de sedes).
- [x] P6. Cursos: QR automático + enlace/WhatsApp en el formulario de inscripción; y campos
  personalizados creables por curso (editar curso → agregar/quitar campos), que viajan al CRM.
- [x] Consejería anclada en el nav del pastor (mismo acceso que el director): hub y apps de
  `consejeriacr.netlify.app` (Dirección/Coordinación/Consejero/Solicitud) + equipo. Cache: pastor.html v=mods2.

## Patrón "PANEL ANIDADO" (nombre oficial — reutilizable)
Cuando una pestaña base del pastor es un MINISTERIO con su propio sistema (Consejería, y a
futuro otros), al hacer clic se despliega una **segunda columna de pestañas** = las mismas del
director de ese ministerio. El pastor (jerarquía superior) ve y gestiona TODO como el director:
lo que hace el director le aparece al pastor, aunque el pastor no opere a diario.
- Implementación: helper `panelAnidado(titulo, lead, extraHead, subtabs, activoId, accion)` en `pastor.js`.
- Estado por panel: una variable de sub-pestaña (ej. `consSub`) + una acción (ej. `cons-sub`).
- CSS: `.ps-nested` (grid 210px + contenido en escritorio; columna scrollable en móvil).
- Primer uso: **Consejería** (sub-pestañas: Analítica, Solicitudes, Consejerías, CRM, Equipo, Base de conocimiento).
- Para replicarlo en otro ministerio: definir sus `subtabs` con su contenido y llamar `panelAnidado(...)`.
- **Consejería (versión final):** las sub-pestañas cargan el **sistema REAL del director** vía iframe
  (`consejeria-director.html`, `consejeria-coordinador.html`, `consejeria-consejero.html`, `consejeria-solicitud.html`),
  con **auto-entrada** (`bindConsejeriaEmbed` clickea `.dr-google` del iframe). Así el pastor ve TODO con el
  mismo detalle y las mismas pestañas del director. Requiere que esos archivos se desplieguen junto al sitio (mismo origen).
- La barra de sub-pestañas es una **barra superior fija** (sticky top:56, bloque apilado — no columna de grid,
  porque en grid la columna medía igual que su contenedor y no se pegaba).

## Pestaña "Tareas" (nueva, debajo de Analítica)
Panel que reúne TODO lo pendiente para mantener el sistema al día, con acceso directo a resolverlo:
registrar diezmo/asistencia del domingo, nuevos sin contactar, cumpleaños de la semana,
requerimientos abiertos, peticiones de oración por atender, accesos de director sin repartir, cursos
sin publicar. `vistaTareas()` en pastor.js; los botones usan `kpi-go` para saltar (y filtrar el CRM).

### Pendiente para publicar
- Revisar en local (`iniciar-servidor.command` → hub) y, cuando esté aprobado, subir a Netlify.
