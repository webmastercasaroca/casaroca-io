# frontend · La aplicación

Aplicación web de la red. JavaScript de módulos nativos, sin paso de
construcción: se sirve tal cual. Es deliberado, y la razón es el traspaso:
quien mantenga esto dentro de dos años abre un archivo y lo entiende, sin
tener que resucitar una cadena de herramientas.

## Cómo se corre

```bash
# la API, en otra terminal
cd ../backend && node api/dist/src/main.js

# el frontend
python3 -m http.server 5199 --directory .
# http://localhost:5199
```

## Cómo está organizado

```
index.html              la única página
src/app.js              armazón: menú POR PERMISO y enrutado
src/api.js              cliente: token, renovación automática, errores
src/ui.js               las piezas compartidas y los TRES estados
src/offline.js          la cola de lo que no se pudo enviar
src/vistas/             una vista por pantalla
src/styles/variables.css   los tokens de marca (no se tocan a la ligera)
src/styles/editorial.css   la capa de estética
```

## Las cuatro reglas que gobiernan esta carpeta

1. **El menú se pinta contra la BASE**, nunca contra una lista escrita aquí.
   `/api/v1/sesion/yo` dice qué módulos alcanza la sesión; lo que no alcanza
   no aparece, y entrar por la URL tampoco lo abre. En el prototipo la lista
   estaba cableada en el cliente y se podía abrir una pestaña que el permiso
   ya negaba.
2. **Toda vista tiene sus tres estados**: cargando, vacío y error. El error
   muestra el código de la petición, que es lo que el usuario le lee al
   soporte por teléfono.
3. **El check-in funciona sin conexión.** El domingo a las 10 el wifi del
   templo es exactamente lo que falla, y una sala con 40 niños no puede
   esperar. Se encola, se entrega el comprobante, y se envía al reconectar.
4. **Accesibilidad AA medida, no supuesta.** Contraste calculado, foco
   visible, 44 px de área táctil, `lang="es"`, y ningún control sin nombre.

## El estilo

Remix deliberado: la **estructura editorial de Terracotta** (superficie crema
cálida, titulares en serif de display, etiquetas en monoespaciada) sobre la
**paleta institucional de la iglesia** (azul de confianza #134291 y mostaza
#E3A52C), que ya era suya. Nada de gradiente morado ni de tipografía por
defecto: esto tiene que parecer de esta iglesia y de ninguna otra.

**Nota sobre las fuentes:** `Geomanist` es comercial (Atipo Foundry) y sus
archivos no van en el repositorio. Mientras la iglesia no ponga la licencia
en `/fonts`, el navegador pide tres archivos, recibe 404 y cae a la fuente
del sistema sin romper nada. Los titulares usan Fraunces, que es libre.

## Lo que falta

Aportes, Consejería, Formación y Analítica. Siguen el mismo patrón que
`vistas/personas.js`: pedir, pintar los tres estados, y no inventarse
permisos que la base no dio.
