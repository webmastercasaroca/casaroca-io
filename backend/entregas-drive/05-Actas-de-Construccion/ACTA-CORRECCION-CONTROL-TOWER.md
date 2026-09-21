# Acta de corrección · Sistema Master (Control Tower)

| Campo | Dato |
|---|---|
| Proyecto | CasaRoca System · Sistema 100p |
| Componente | Frontend · Sistema Master (`fase0-prototipo/master.html`) |
| Fecha de corte | 15 de septiembre de 2026 |
| Repositorio | `github.com/100p-NANO/ecosistema-cr` |
| Commit de la corrección | `da8f6eb` |
| Estado | Corregido y verificado en navegador |

---

## 1. Objeto de este documento

Dejar constancia de una **regresión encontrada en el Sistema Master y de su corrección**. Este
documento existe porque el fallo no era menor: durante cuatro días el Control Tower no pudo crear
nada, y crear es justamente aquello para lo que se construyó.

Se escribe con el mismo criterio que el acta del frontend: lo que se afirma aquí se comprueba
abriendo la aplicación, y la sección 5 dice cómo.

## 2. Qué estaba roto

El 11 de septiembre, el commit `ff1a761` retiró 423 líneas de `master.js` y dejó en pie tanto las
llamadas como el menú que apuntaban a ellas. Desde ese momento:

| Qué | Consecuencia |
|---|---|
| Las 6 entradas del menú «+ Crear» | Fallaban con error de programa. No se dibujaba la pantalla |
| 2 de los 4 botones de «Puesta en marcha» | «Crear equipo» y «Crear iglesia», muertos |
| La secuencia de arranque del sistema | **Imposible de completar** |
| El botón «comprobar cómo se ve» | Contestaba «este panel no tiene sesión» en cualquier equipo nuevo |
| La regla de los pastores en matrimonio | Implementada en el motor, inalcanzable desde la pantalla |

El fallo del puente merece explicación aparte, porque era circular: los paneles por rol leen el
censo del master para saber quién entra, y ese censo solo se escribía **al crear algo**. Como
crear estaba roto, el censo no podía nacer nunca. En un computador recién estrenado, todo panel
abierto desde el master respondía que no había sesión.

⚠️ **Por qué no se notó durante cuatro días:** el equipo donde se construyó el master ya tenía el
censo escrito en su navegador de una sesión anterior, así que allí el puente sí funcionaba. El
fallo solo aparecía en un computador nuevo, que es precisamente el de cualquier persona a quien se
le muestre el sistema.

## 3. Qué se corrigió

| # | Corrección | Dónde |
|---|---|---|
| 1 | Restauradas las 13 funciones retiradas: las 6 pantallas de creación y sus 7 auxiliares | `master.js` |
| 2 | El almacén graba su información de partida en cuanto la lee, no solo al crear | `master-store.js` |
| 3 | La vista previa dejó de depender del censo para poder abrirse | `permisos-panel.js` |
| 4 | El formulario de iglesia pide al pastor **y a su esposa**, como manda la regla de la iglesia | `master.js` |
| 5 | El techo del pastor sale del catálogo de roles y no de un valor fijo | `master-store.js` |
| 6 | El conteo de iglesias sale del dato real, no de una cifra escrita a mano | `master.js` |
| 7 | «Plantillas de iglesia» pasó a tener pantalla propia | `master.js` |
| 8 | Las pestañas sin operación explican que es a propósito y ofrecen el atajo | `master.js` |

Sobre la corrección 5 conviene detenerse: una iglesia creada desde el sistema nacía con sus
pastores limitados a nivel N2, mientras que las iglesias ya existentes los tenían en N4. El mismo
cargo quedaba con dos alcances distintos según cómo se hubiera creado la sede. La migración `0034`
ya lo había resuelto en la base; era la capa visible la que no se había enterado.

## 4. Sobre el nombramiento de pastores

Queda registrado, por indicación de la dirección, que **el término correcto es «esposa del
pastor»**. El sistema exige a los dos: una iglesia no se crea con un pastor solo, y ambos quedan
con el mismo acceso a la sede.

## 5. Cómo comprobarlo

1. Abrir el Sistema Master.
2. Menú **+ Crear**: las seis opciones abren su formulario.
3. **Puesta en marcha**: los cuatro botones llevan a su pantalla.
4. **Crear iglesia**: si se elige solo al pastor, el sistema se niega y explica la regla.
5. **Iglesias y sedes** → una iglesia → **comprobar cómo se ve**: el panel abre a nombre de esa
   iglesia y muestra únicamente los módulos que tiene encendidos.

Comprobación registrada el 15 de septiembre: se creó una iglesia de prueba con plantilla
Plantación, que enciende 10 de 22 módulos. El panel del pastor mostró **7 pestañas visibles y 10
ocultas**, correspondientes exactamente a los módulos concedidos. Aportes, RocaKids y Consejería
quedaron fuera, como corresponde a esa plantilla. Las 30 pantallas del master se recorrieron sin
un solo error.

## 6. Recomendación

La causa de fondo no fue un descuido puntual: fue el reemplazo de un archivo completo que se llevó
funciones por delante sin que nada avisara. El propio mensaje del commit `ff1a761` advertía de que
**ya había ocurrido antes** con otro auxiliar.

Se recomienda añadir una comprobación al procedimiento de sellado que falle cuando una pantalla
invocada no exista. Son pocas líneas, y convierte un fallo silencioso de cuatro días en un aviso
inmediato.

---

*Documento de la mesa de trabajo del Sistema 100p. Corte del 15 de septiembre de 2026.*
