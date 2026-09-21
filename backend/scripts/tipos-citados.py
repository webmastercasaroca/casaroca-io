#!/usr/bin/env python3
"""
Tipos que el codigo de la API cita con un cast `::esquema.tipo`.

⛔ Se escribio el 19 de septiembre de 2026 porque la compuerta de
   `verificar.sh` daba rojo por un cast que estaba DENTRO DE UN COMENTARIO
   (el que explica por que se quito el cast de verdad). Una compuerta que
   confunde un comentario con codigo se acaba apagando, y entonces no
   protege nada. Aqui se quitan comentarios y cadenas de plantilla no son
   problema: el SQL vive precisamente en cadenas, asi que solo se descartan
   los comentarios.
"""
import re, sys, pathlib

RAIZ = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'api/src')
BLOQUE = re.compile(r'/\*.*?\*/', re.S)
LINEA  = re.compile(r'(?<!:)//[^\n]*')
CAST   = re.compile(r'::([a-z_]+\.[a-z_]+)')

tipos = set()
for f in RAIZ.rglob('*.ts'):
    t = f.read_text(encoding='utf-8', errors='replace')
    t = BLOQUE.sub(' ', t)
    t = LINEA.sub(' ', t)
    tipos.update(CAST.findall(t))
print('\n'.join(sorted(tipos)))
