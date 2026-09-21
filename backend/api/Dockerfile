# =====================================================================
# Imagen de la API (Cloud Run «casaroca-api»). Contexto: backend/api/
#
#   docker build -t casaroca-api backend/api
#
# Tres etapas: compilar con todas las dependencias, instalar SOLO las de
# producción, y una imagen final que no tiene ni TypeScript ni npm cache.
# =====================================================================

# ── 1. Compilación ─────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS compilacion
WORKDIR /app
COPY package.json package-lock.json ./
# npm ci y no npm install: instala exactamente lo del lockfile o falla.
# TypeScript 7 trae el compilador nativo por plataforma; el lockfile ya
# incluye la variante linux-x64 que usa Cloud Build.
RUN npm ci
COPY tsconfig.json ./
COPY src/ src/
# test/ no entra: la imagen no corre pruebas. rootDir es «.», así que la
# salida sigue en dist/src/main.js aunque falte test/.
RUN npm run build

# ── 2. Dependencias de producción ──────────────────────────────────────
FROM node:22-bookworm-slim AS dependencias
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts: ninguna dependencia de producción necesita compilar
# nada al instalarse, y así un paquete comprometido no ejecuta código aquí.
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# ── 3. Imagen final ────────────────────────────────────────────────────
FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app
# Los archivos quedan de root y solo lectura para el usuario que corre:
# la aplicación no puede reescribirse a sí misma.
COPY --from=dependencias /app/node_modules ./node_modules
COPY --from=compilacion  /app/dist/src      ./dist/src
COPY package.json ./

# ⛔ Nunca como root. 1000 es el usuario «node» de la imagen oficial; va
#    en número para que Cloud Run no tenga que resolver el nombre.
USER 1000:1000
EXPOSE 8080
# node directo y no «npm start»: las señales de apagado (SIGTERM de Cloud
# Run) llegan al proceso y enableShutdownHooks() cierra el pool de pg.
CMD ["node", "dist/src/main.js"]
