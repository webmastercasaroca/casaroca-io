# Acta de construcción y publicación · Frontend

| Campo | Dato |
|---|---|
| Proyecto | CasaRoca System · Sistema 100p |
| Componente | Frontend (prototipo navegable y sitio web) |
| Fecha de corte | 11 de septiembre de 2026 |
| Repositorio | `github.com/100p-NANO/ecosistema-cr`, carpetas `fase0-prototipo/` y `web/` |
| Estado | Construido y publicado |

---

## 1. Objeto de este documento

Dejar constancia formal de qué se construyó en la capa visible del Sistema 100p y qué quedó
publicado en el repositorio de la iglesia.

A diferencia del backend, esta capa no se mide en pruebas automáticas sino en **pantallas que se
pueden abrir y recorrer**. Por eso el criterio de esta acta es distinto: lo que se afirma aquí se
comprueba navegando, y la sección 6 explica cómo hacerlo en cualquier computador.

## 2. Por qué existe esta capa

El prototipo no es una maqueta decorativa. Cumple tres funciones concretas en el proyecto:

1. **Es el acuerdo visual con la iglesia.** Las 19 modificaciones que pidió el pastor sobre el
   prototipo quedaron implementadas y verificadas una a una. El prototipo es el documento donde
   se ve qué se acordó, sin necesidad de leer una especificación.
2. **Es lo que permite que la dirección evalúe el sistema sin ser técnica.** El Pastor Director
   General puede abrir la aplicación y recorrerla, en lugar de opinar sobre un diagrama.
3. **Es la referencia de comportamiento para el desarrollo.** Cuando se construya la interfaz
   definitiva sobre el backend, el prototipo dice qué debe hacer cada pantalla.

## 3. Publicación en el repositorio

| Concepto | Dato |
|---|---|
| Repositorio | `github.com/100p-NANO/ecosistema-cr` |
| Carpetas | `fase0-prototipo/` (231 archivos) y `web/` (77 archivos) |
| Visibilidad | Privado, por invitación |
| Commit del corte | `745b20f` |
| Estado posterior | ⚠️ Ver `ACTA-CORRECCION-CONTROL-TOWER.md` (15 sep 2026, commit `da8f6eb`): el Sistema Master arrastraba una regresión desde `ff1a761` |

**Este es el punto más importante de esta acta.** Hasta el 11 de septiembre de 2026, el
prototipo era la única pieza del proyecto que **no tenía copia en ningún servidor**: existía
solamente en un computador. Un daño de disco lo habría borrado por completo, con las 19
modificaciones del pastor incluidas. Con esta publicación, esa exposición quedó cerrada.

## 4. Qué quedó construido

### 4.1 El prototipo navegable

| Elemento | Cantidad |
|---|---|
| Pantallas HTML | 48 |
| Archivos JavaScript | 127 |
| Hojas de estilo | 45 |
| Líneas del motor (`assets/js`) | 26.075 en 42 archivos |

Está construido en HTML, CSS y JavaScript sin marcos de trabajo ni compilación: se abre
directamente en el navegador. Es una decisión deliberada de la Fase 0, para que cualquiera de la
mesa pueda abrirlo sin instalar nada.

### 4.2 Las pantallas por rol

La aplicación reproduce la jerarquía pastoral, de la sede madre al grupo pequeño:

| Pantalla | Rol al que sirve |
|---|---|
| `central.html` | Pastor Director General. Administración de las 36 sedes |
| `pastor.html` | Pastor Congregacional. Operación completa de su sede |
| `director.html` | Director de Ministerio |
| `lider.html` | Líder de grupo |
| `nicodemo.html` | Seguimiento de personas nuevas |
| `rocakids-domingo.html` y `rocakids-director.html` | Ministerio de niños: entrada, entrega y dirección |
| `consejeria-solicitud / -consejero / -coordinador / -director` | Los cuatro roles del proceso de consejería |
| `experiencia.html`, `-v2`, `-v3` | Páginas públicas. El recorrido Conoce, Conéctate, Crece, Sirve |
| `hub.html` | Mapa de entrada a todo el sistema |

Los motores principales, por si la revisión técnica quiere entrar directo:

```
assets/js/pastor.js                 3.036 líneas · 17 vistas
assets/js/director.js               1.426 líneas
assets/js/consejeria-coordinador.js 1.332 líneas
assets/js/landing-v2.js             1.104 líneas
assets/js/central.js                1.100 líneas
assets/js/landing-v3.js             1.098 líneas
assets/js/pastor-data.js              975 líneas
```

### 4.3 El sitio web

En `web/publico/`: 17 páginas HTML, 42 archivos JavaScript y 15 hojas de estilo. Reúne en un solo
despliegue lo que antes vivía en dos sitios separados.

La unificación resolvió un defecto real: el panel del pastor abre la consejería dentro de un
marco del mismo origen, pero las páginas de consejería estaban en otro despliegue, de modo que el
marco devolvía «página no encontrada». Apuntar a otro dominio tampoco funcionaba, porque el
navegador bloquea el marco cruzado. Publicarlas juntas era la única salida.

### 4.4 Las dos copias de entrega

El repositorio incluye dos versiones preparadas para entregar a la iglesia con la aplicación
**vacía**, sin datos de demostración: una para el Pastor Congregacional y otra para la Dirección
General. Sirven para que el sistema se pueble con datos reales desde cero.

## 5. Estado actual y límites de esta capa

Debe quedar explícito para que nadie tome el prototipo por más de lo que es:

- **Los datos son de demostración y no salen del navegador.** El prototipo guarda su información
  en el almacenamiento local del navegador de cada persona. No hay servidor detrás, no se comparte
  entre equipos y no se sincroniza.
- **El ingreso es una selección de rol, no una autenticación.** No hay contraseñas reales ni
  control de sesión. La privacidad que se ve en pantalla es de presentación, no está impuesta por
  un motor.
- **La conexión con el backend está pendiente.** El backend descrito en el acta correspondiente
  ya impone las reglas de verdad (aislamiento por sede, protección de menores, consentimiento).
  El paso siguiente del proyecto es que esta capa consuma esos servicios en lugar de sus datos de
  demostración.

Ninguno de estos tres puntos es un defecto: son el alcance acordado para la Fase 0. Se dejan
escritos para que la mesa evalúe el prototipo por lo que es.

## 6. Cómo abrirlo y recorrerlo

**Opción sencilla, sin instalar nada.** Descargar la carpeta `fase0-prototipo` del repositorio y
abrir el archivo `hub.html` con doble clic. Desde ahí se llega a las 48 pantallas.

**Opción con servidor local**, recomendada para revisión técnica porque reproduce el
comportamiento real de las páginas anidadas:

```
cd fase0-prototipo
python3 -m http.server 5300 --bind 127.0.0.1
```

Luego abrir `http://127.0.0.1:5300/hub.html` en el navegador.

Para revisar el sitio web, el mismo procedimiento sobre la carpeta `web/publico`.

El código no se compila: al guardar un archivo basta recargar el navegador para ver el cambio.

## 7. Asuntos abiertos que requieren decisión de la mesa

1. **Conectar el prototipo con el backend.** Es el paso natural del proyecto y define el
   cronograma de la Fase 1. Requiere decidir qué pantallas se conectan primero.
2. **Identidad y autenticación.** El ingreso por selección de rol debe reemplazarse por
   autenticación real antes de cualquier uso con datos de personas.
3. **Alcance de la interfaz definitiva.** Hay que decidir si la interfaz de producción se
   construye sobre este código o se rehace con el marco de trabajo que adopte el equipo. El
   prototipo conserva su valor como referencia de comportamiento en cualquiera de los dos casos.
