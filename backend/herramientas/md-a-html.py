import re, html, sys
src, out, titulo = sys.argv[1], sys.argv[2], sys.argv[3]
nota = sys.argv[4] if len(sys.argv) > 4 else ''   # nota al pie opcional, por documento
md = open(src, encoding='utf-8').read()

def inline(t):
    t = html.escape(t)
    t = re.sub(r'`([^`]+)`', r'<code>\1</code>', t)
    t = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'(?<!\*)\*([^*\n]+)\*(?!\*)', r'<em>\1</em>', t)
    return t

L = md.split('\n'); sal=[]; i=0; lista=None
def cerrar():
    global lista
    if lista: sal.append('</ol>' if lista=='ol' else '</ul>'); lista=None

def es_sep(s):
    return bool(re.match(r'^\|[\s:|-]+\|$', s)) and '-' in s

while i < len(L):
    s = L[i].strip()
    if not s: cerrar(); i+=1; continue

    # tabla
    if s.startswith('|') and i+1 < len(L) and es_sep(L[i+1].strip()):
        cerrar()
        cab = [c.strip() for c in s.strip('|').split('|')]
        i += 2
        filas = []
        while i < len(L) and L[i].strip().startswith('|'):
            filas.append([c.strip() for c in L[i].strip().strip('|').split('|')]); i += 1
        sal.append('<table><thead><tr>' + ''.join(f'<th>{inline(c)}</th>' for c in cab) + '</tr></thead><tbody>')
        for f in filas:
            sal.append('<tr>' + ''.join(f'<td>{inline(c)}</td>' for c in f) + '</tr>')
        sal.append('</tbody></table>')
        continue

    # bloque de codigo cercado con ``` : se respeta tal cual, sin interpretar
    if s.startswith('```'):
        cerrar(); i += 1; lineas = []
        while i < len(L) and not L[i].strip().startswith('```'):
            lineas.append(L[i]); i += 1
        i += 1
        sal.append('<pre><code>' + html.escape('\n'.join(lineas)) + '</code></pre>')
        continue

    if re.match(r'^-{3,}$', s): cerrar(); sal.append('<hr>'); i+=1; continue
    m = re.match(r'^(#{1,4})\s+(.*)$', s)
    if m: cerrar(); n=len(m.group(1)); sal.append(f'<h{n}>{inline(m.group(2))}</h{n}>'); i+=1; continue
    def continuacion(j):
        # lineas sueltas que pertenecen al item anterior, no a un parrafo nuevo
        cuerpo = []
        while (j+1 < len(L) and L[j+1].strip()
               and not re.match(r'^(#{1,4}\s|[-*]\s|\d+\.\s|-{3,}$|\||```)', L[j+1].strip())):
            j += 1; cuerpo.append(L[j].strip())
        return j, cuerpo

    m = re.match(r'^(\d+)\.\s+(.*)$', s)
    if m:
        if lista!='ol': cerrar(); sal.append('<ol>'); lista='ol'
        i, extra = continuacion(i)
        sal.append(f'<li>{inline(" ".join([m.group(2)] + extra))}</li>'); i+=1; continue
    m = re.match(r'^[-*]\s+(.*)$', s)
    if m:
        if lista!='ul': cerrar(); sal.append('<ul>'); lista='ul'
        i, extra = continuacion(i)
        sal.append(f'<li>{inline(" ".join([m.group(1)] + extra))}</li>'); i+=1; continue
    buf=[s]
    # una linea que arranca en negrita NO es un bloque nuevo: es el mismo parrafo
    while i+1 < len(L) and L[i+1].strip() and not re.match(r'^(#{1,4}\s|[-*]\s|\d+\.\s|-{3,}$|\||```)', L[i+1].strip()):
        i+=1; buf.append(L[i].strip())
    cerrar(); sal.append('<p>'+inline(' '.join(buf))+'</p>'); i+=1
cerrar()

plantilla = """<!doctype html><html lang="es"><head><meta charset="utf-8"><title>%s</title><style>
@page { size: A4; margin: 20mm 18mm; }
* { print-color-adjust: exact; -webkit-print-color-adjust: exact; box-sizing: border-box; }
body { font-family: Georgia,"Times New Roman",serif; font-size:10.2pt; line-height:1.55; color:#1a1a1a; margin:0; }
h1 { font-family:-apple-system,"Helvetica Neue",Arial,sans-serif; font-size:18pt; font-weight:600;
     color:#0d2b4e; border-bottom:2px solid #0d2b4e; padding-bottom:.3em; margin:0 0 .6em; page-break-after:avoid; }
h2 { font-family:-apple-system,"Helvetica Neue",Arial,sans-serif; font-size:12.6pt; font-weight:600;
     color:#0d2b4e; margin:1.7em 0 .45em; page-break-after:avoid; }
h3 { font-family:-apple-system,"Helvetica Neue",Arial,sans-serif; font-size:10.8pt; font-weight:600;
     color:#24405e; margin:1.3em 0 .35em; page-break-after:avoid; }
p { margin:0 0 .75em; text-align:justify; hyphens:auto; orphans:3; widows:3; }
ul,ol { margin:0 0 .85em; padding-left:1.4em; } li { margin-bottom:.25em; }
code { font-family:"SF Mono",Menlo,Consolas,monospace; font-size:.86em; background:#f2f4f7;
       padding:.08em .3em; border-radius:3px; color:#12355b; }
strong { font-weight:700; color:#000; }
hr { border:none; border-top:1px solid #d4d9e0; margin:1.9em 0; }
table { width:100%%; border-collapse:collapse; margin:.6em 0 1.1em; font-size:9pt;
        font-family:-apple-system,Arial,sans-serif; page-break-inside:avoid; }
th { background:#0d2b4e; color:#fff; text-align:left; padding:.45em .6em; font-weight:600; }
td { padding:.4em .6em; border-bottom:1px solid #e3e7ec; vertical-align:top; }
tbody tr:nth-child(even) td { background:#f7f9fb; }
td:not(:first-child) { text-align:right; } th:not(:first-child) { text-align:right; }
pre { background:#f7f9fb; border:1px solid #e3e7ec; border-left:3px solid #0d2b4e;
      padding:.7em .9em; margin:.6em 0 1.1em; border-radius:3px; overflow:hidden;
      page-break-inside:avoid; }
pre code { font-family:"SF Mono",Menlo,Consolas,monospace; font-size:8.6pt; line-height:1.45;
      background:none; padding:0; color:#12355b; white-space:pre-wrap; word-break:break-word; }
.pie { margin-top:2.2em; padding-top:.7em; border-top:1px solid #d4d9e0; font-size:8.4pt;
       color:#5a6472; font-family:-apple-system,Arial,sans-serif; }
</style></head><body>
%s
<p class="pie">Documento de la mesa de trabajo · CasaRoca System · Fase 1.%s</p>
</body></html>"""
open(out,'w',encoding='utf-8').write(
    plantilla % (html.escape(titulo), '\n'.join(sal), (' ' + html.escape(nota)) if nota else ''))
print("HTML:", out)
