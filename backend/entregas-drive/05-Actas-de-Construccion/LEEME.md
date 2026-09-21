# 05 · Actas de construcción

Constancia formal de qué se construyó y qué quedó publicado en el repositorio de la iglesia,
por componente.

| Documento | Componente | Corte |
|---|---|---|
| `Acta-Construccion-Backend.pdf` | Base de datos y servicios | 11 sep 2026 |
| `Acta-Construccion-Frontend.pdf` | Prototipo navegable y sitio web | 11 sep 2026 |
| `Acta-Correccion-Control-Tower.pdf` | Sistema Master: regresión encontrada y corregida | **15 sep 2026** |

⚠️ **Léase el acta del 15 de septiembre junto a la del frontend.** La del 11 da por publicado el
prototipo, y lo estaba; pero cuatro días después se encontró que el Sistema Master no podía crear
nada desde el commit `ff1a761`. El acta de corrección explica qué pasó, qué se arregló y cómo
comprobarlo.

Cada acta va con su fuente en Markdown, por si hay que corregirla. Para regenerar el PDF:

```
python3 herramientas/md-a-html.py ACTA-BACKEND.md salida.html "Título"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --no-pdf-header-footer --hide-scrollbars --run-all-compositor-stages-before-draw \
  --virtual-time-budget=8000 --print-to-pdf=salida.pdf "file://$PWD/salida.html"
```
