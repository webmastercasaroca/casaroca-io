#!/usr/bin/env python3
"""
Busca secretos escritos en el repositorio.

⛔ 20 de septiembre de 2026. La version anterior era una linea de `grep` con
   cuatro defectos, y cada uno la dejaba ciega en un sitio distinto:

   1. Solo miraba `backend/`. `infra/`, `.github/`, `frontend/`, `docs/` y
      `web/` quedaban fuera, que es justo donde vive la configuracion.
   2. El patron exigia `NOMBRE = valor`. En YAML se escribe `nombre: valor`,
      asi que un secreto en `cloudbuild.yaml` o en un flujo de GitHub era
      invisible.
   3. La lista blanca (`desarrollo|laboratorio|ejemplo`) se aplicaba a la
      LINEA ENTERA: un secreto de verdad en una linea que dijera «ejemplo»
      en un comentario pasaba sin que nadie lo viera.
   4. Solo conocia cuatro nombres de variable. Una llave de Google, un token
      de GitHub o una clave privada no los detectaba nadie.

   Aqui se mira TODO el repositorio, las dos formas de escribir, la lista
   blanca se aplica al VALOR (no a la linea) y hay patrones genericos por
   la forma del secreto, no por su nombre.

   ⛔ Este guion NUNCA imprime el valor encontrado: imprime donde esta.
      Un informe que reproduce el secreto lo reparte.
"""
import re, sys, pathlib

RAIZ = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()

# ⛔ En iCloud las dependencias viven en `node_modules.nosync` (con un
#    enlace): si solo se salta «node_modules», el guion recorre 40.000
#    archivos ajenos y devuelve 160 falsos positivos. Un informe con ese
#    ruido se ignora entero, y entonces no protege de nada.
SALTAR_EXACTO = {'dist', '.git', 'build', '.terraform', 'coverage', '.next'}
SALTAR_PREFIJO = ('node_modules',)
EXTENSIONES = {'.ts', '.js', '.mjs', '.cjs', '.sh', '.yaml', '.yml', '.json',
               '.tf', '.tfvars', '.env', '.sql', '.py', '.md', '.html'}

# ⛔ En MAYUSCULAS y sin `re.I`. Con `re.I` esto casaba con identificadores
#    normales del codigo (`tokensToFunction`, `tokenizer`, `secretKey`) y
#    llenaba el informe de ruido.
NOMBRES = (r'\b(APP_JWT_SECRETO|APP_LLAVE_N4|PGPASSWORD|POSTGRES_PASSWORD|'
           r'CASAROCA_LLAVE_RESPALDO|RECAPTCHA_SECRETO|SENDGRID_API_KEY|PAYU_API_KEY|'
           r'[A-Z][A-Z0-9_]*(?:SECRET|SECRETO|TOKEN|PASSWORD|CLAVE|APIKEY|API_KEY)[A-Z0-9_]*)\b')

# ⛔ El valor tiene que ser un LITERAL entre comillas (o suelto en YAML o en
#    un .env). `const secreto = otraVariable` no es un secreto escrito: es
#    codigo. La version anterior no distinguia y marcaba auth.service.ts.
POR_NOMBRE = [
    re.compile(NOMBRES + r'\s*[:=]\s*["\']([A-Za-z0-9._\-/+]{12,})["\']'),
    re.compile(NOMBRES + r'\s*[:=]\s*([A-Za-z0-9._\-/+]{12,})\s*$'),
]

POR_FORMA = [
    ('clave privada',        re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----')),
    ('llave de Google',      re.compile(r'\bAIza[0-9A-Za-z_\-]{30,}')),
    ('token de GitHub',      re.compile(r'\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}')),
    ('llave de AWS',         re.compile(r'\bAKIA[0-9A-Z]{16}\b')),
    ('token de Slack',       re.compile(r'\bxox[baprs]-[A-Za-z0-9-]{10,}')),
    ('llave de SendGrid',    re.compile(r'\bSG\.[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{20,}')),
    ('cadena de conexion',   re.compile(r'\b(?:postgres|postgresql|mysql|mongodb)(?:\+\w+)?://[^:\s\'"]+:[^@\s\'"]{6,}@')),
]

# ⛔ Se mira el VALOR, no la linea: un comentario que diga «ejemplo» no
#    puede absolver a un secreto de verdad escrito al lado.
PLACEHOLDER = re.compile(
    r'desarrollo|laboratorio|ejemplo|example|no-usar|nousar|cambiar|placeholder|'
    r'xxx|yyy|zzz|\bfake\b|\bdummy\b|tu-|su-|<|\$\{|\$\(|process\.env|var\.|local\.|'
    r'secret_key_ref|versions/latest|TODO|PROYECTO|REGION', re.I)

NOMBRE_DE_RECURSO = re.compile(r'[a-z][a-z0-9]*(?:[-_][a-z0-9]+)+')

hallazgos = []
for f in RAIZ.rglob('*'):
    if not f.is_file() or f.suffix not in EXTENSIONES:            continue
    if any(p in SALTAR_EXACTO or p.startswith(SALTAR_PREFIJO) for p in f.parts): continue
    if f.name == 'buscar-secretos.py':                             continue
    try:    texto = f.read_text(encoding='utf-8', errors='replace')
    except Exception:                                              continue

    for n, linea in enumerate(texto.splitlines(), 1):
        for rx in POR_NOMBRE:
            for m in rx.finditer(linea):
                nombre, valor = m.group(1), m.group(2)
                if PLACEHOLDER.search(valor):                      continue
                if len(set(valor)) < 5:                            continue   # 'aaaaaaaaaaaa'
                # ⛔ En Terraform, `APP_LLAVE_N4 = "app-llave-n4"` NO es un
                #    secreto: es el NOMBRE del secreto en Secret Manager, que
                #    es justo lo que hay que versionar. Un valor en minusculas
                #    con guiones y sin un solo digito no es una llave: es un
                #    nombre de recurso. Las llaves de verdad tienen entropia.
                if NOMBRE_DE_RECURSO.fullmatch(valor):             continue
                hallazgos.append((f.relative_to(RAIZ), n, nombre))
        for etiqueta, rx in POR_FORMA:
            if rx.search(linea):
                hallazgos.append((f.relative_to(RAIZ), n, etiqueta))

if hallazgos:
    print(f'⛔ {len(hallazgos)} posible(s) secreto(s) versionado(s):')
    for ruta, n, que in hallazgos[:25]:
        print(f'   {ruta}:{n} · {que}')
    sys.exit(1)

print('ningún secreto con pinta de real versionado')
