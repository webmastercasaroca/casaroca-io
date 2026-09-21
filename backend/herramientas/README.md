# Herramientas

## `md-a-html.py` — entregables a PDF

Convierte un Markdown a un HTML de registro corporativo neutro (sin marca de
proveedor, por indicación de la mesa de trabajo) y de ahí a PDF con Chrome.

```bash
python3 herramientas/md-a-html.py entrada.md salida.html "Título del documento"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-pdf-header-footer --hide-scrollbars \
  --run-all-compositor-stages-before-draw --virtual-time-budget=8000 \
  --print-to-pdf=salida.pdf "file://$PWD/salida.html"
```

Soporta encabezados, listas, tablas, negrita, cursiva y `código`.
