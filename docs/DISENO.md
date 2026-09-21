# Regla de diseño · CasaRoca System

> Regla de Daniel, 20 de septiembre de 2026:
> *«Tiene que ser regla: el tema del diseño, colores, formas, encuadre, letra.»*
> Y el 19: *«mantengamos el visual que veníamos trabajando: columna de pestañas a
> la izquierda y el resto como trabajamos todos nuestros proyectos; esa uniformidad
> y ese encuadre fueron los que engancharon a la iglesia a optar por esto.»*
>
> ⛔ Este fichero manda sobre cualquier hoja de estilos del repositorio. Si algo se
> ve distinto de lo que dice aquí, lo que está mal es el código, no la regla.
> Cambiar la regla es una decisión de Daniel y se escribe en `docs/DECISIONES/`.

## Por qué existe

El producto son **dos plataformas**: la aplicación que usan los pastores y la
consola del Sistema Master, que administra la red. Su CONTENIDO es distinto a
propósito —quien entra al comando central tiene que saber dónde está—, pero su
**aspecto es el mismo**: tema, colores, formas, encuadre y letra.

Cuando se separaron, pasó esto: la consola quedó blanca y densa, y la aplicación
quedó en papel cálido con titulares en serif **y tema oscuro automático**. En la
misma iglesia, unos la veían blanca y otros marrón oscuro, según cómo tuvieran el
teléfono. Dos personas no podían ni hablar de la misma pantalla.

## 1 · Tema

**Uno solo, claro. Siempre.**

⛔ Nada de `@media (prefers-color-scheme: dark)`. El `index.html` de las dos
plataformas declara `<meta name="color-scheme" content="light">`.

No es una preferencia estética: es que el sistema tiene que verse igual para las
treinta y seis sedes, en el teléfono de cualquiera, sin que el aspecto dependa de
un ajuste personal.

## 2 · Colores

La paleta es de la iglesia y no se cambia.

| Papel | Valor | Para qué |
|---|---|---|
| Azul de marca | `#134291` | Acción principal, enlaces, lo seleccionado |
| Azul hover | `#0E367A` | El azul, al pasar por encima |
| Azul suave | `#E6ECF7` | Fondo de lo seleccionado |
| Mostaza | `#E3A52C` | Acento único: se usa POCO, o deja de acentuar |
| Navy | `#071D44` | Sobre mostaza, y en el emblema |
| Fondo | `#F7F7F8` | La página |
| Superficie | `#FFFFFF` | Tarjetas, tablas, diálogos |
| Filete | `#E8E8EA` | El relieve lo dan los filetes, no las sombras |
| Texto | `#17171A` · `#55555C` · `#75757E` | Normal, suave, tenue |

Estados: verde `#1E8A55`, aviso `#B5790F`, peligro `#C13A2B`, informativo `#1B53AD`,
cada uno con su fondo claro.

**Niveles de sensibilidad**, que son parte de la identidad del producto y se pintan
igual en las dos plataformas: N0 y N1 neutros, N2 azul, N3 morado `#7E57C2`
(consejería, finanzas), **N4 rojo `#C13A2B` (menores)**.

⛔ Nada de gradiente morado ni de Inter por defecto: esto tiene que parecer de esta
iglesia y de ninguna otra.

## 3 · Formas

- Radios: **6 px** lo normal, **8 px** las tarjetas y diálogos. Nada más redondo.
- **Cero sombras.** El relieve lo da un filete de 1 px. Un `box-shadow` solo en lo
  que flota de verdad (un diálogo sobre el fondo oscurecido).
- Botones de 32 px de alto; campos de 32 px. Densidad de trabajo, no de escaparate.
- Foco visible SIEMPRE: `outline: 2px solid` azul, con `outline-offset`. Nunca
  `outline: none`.

## 4 · Encuadre

**Columna de pestañas a la izquierda, agrupada por materia**, con el emblema y la
identidad de quien entró arriba, y el contenido a la derecha. Es el encuadre que
aprobó la iglesia.

- Las pestañas se agrupan bajo un rótulo pequeño en mayúsculas (Dirección,
  Identidad y accesos, Organización, Gobierno).
- Cada pestaña que toca datos delicados lleva su distintivo de nivel a la derecha.
- **En el teléfono** la columna pasa a una tira horizontal que se desplaza, o a una
  barra inferior con las cuatro más usadas y una hoja de «Más». Nunca desaparece.
- El contenido abre con un título, una línea que explica para qué sirve la pantalla,
  y después las cifras y las tablas.

## 5 · Letra

- Una sola familia: `Geomanist`, y si no está, `Inter`, `Segoe UI`, `system-ui`.
  ⛔ **Sin serif de display.** Lo que da carácter es la escala y el acento único,
  no una fuente distinta en cada mitad del producto.
- Monoespaciada (`ui-monospace`, `SFMono-Regular`, Menlo) para códigos,
  identificadores, direcciones IP y horas.
- **Cifras tabulares** (`font-variant-numeric: tabular-nums`) en toda cifra que se
  compare de una fila a otra.
- Rótulos de campo: 10,5 px, mayúsculas, con `letter-spacing`.
- ⛔ Ninguna tipografía se pide a un servidor de terceros. Un `@import` a Google
  Fonts manda la IP de quien abre la pantalla —una maestra de RocaKids, una
  secretaria mirando una ficha de consejería— a un tercero que nadie autorizó.
  Las fuentes se sirven desde aquí (`frontend/fonts/`) o se cae a la pila del
  sistema.

## 6 · Cómo se comprueba antes de entregar

1. Abrir las dos plataformas **una al lado de la otra**. Si parecen de dos
   productos distintos, está mal.
2. Poner el teléfono en **modo oscuro** y volver a abrir: tiene que verse igual.
3. A 375 px de ancho: ningún control fuera de la pantalla, ninguna barra que
   desaparezca. Ver `[[feedback-accion-en-la-ultima-columna]]`.
4. Recorrer con el tabulador: el foco se ve siempre.

## Dónde vive cada cosa

- Consola del Sistema Master: `frontend/master/estilo.css`
- Aplicación de los pastores: `frontend/src/styles/variables.css` (paleta y escala)
  y `frontend/src/styles/editorial.css` (tema y componentes)
- Las dos declaran `color-scheme: light` en su `index.html`
