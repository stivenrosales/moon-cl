# syntax=docker/dockerfile:1

# Imagen para el VPS con EasyPanel. GitHub Actions es quien construye y publica
# esta imagen a GHCR (ver .github/workflows/docker.yml) — el VPS solo hace
# `pull`, nunca build. Traefik (parte de EasyPanel) resuelve TLS y proxy hacia
# el contenedor; acá no hay nada de eso.
#
# next.config.ts ya tiene `output: "standalone"`: el build de Next deja en
# .next/standalone un server.js autocontenido con solo las dependencias que
# el file-tracing detectó como usadas en runtime. Por eso el stage final NO
# copia node_modules completo, y por eso hay que reforzar a mano lo que ese
# tracing suele perderse (el cliente de Prisma, ver más abajo).

# ---------------------------------------------------------------------------
# Stage 1: deps — instala dependencias con el lockfile exacto del repo.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app

# Alpine no trae OpenSSL instalado. Sin él, `prisma generate` (que corre acá
# mismo vía postinstall) no puede detectar la versión y genera el motor de
# consultas apuntando a "openssl-1.1.x" por defecto — un motor que después
# no carga en runtime porque el Alpine moderno de node:20-alpine ya no trae
# libssl.so.1.1, solo OpenSSL 3.x.
RUN apk add --no-cache openssl

# package.json trae "postinstall": "prisma generate", así que el schema tiene
# que existir ANTES de `npm ci` — si no, el postinstall falla buscando un
# archivo que todavía no llegó a la imagen.
COPY package.json package-lock.json ./
COPY prisma ./prisma

# node:20-alpine trae npm 10.8.2. El lockfile de este repo quedó limpio con
# npm 11.x, que resuelve peerDependencies opcionales distinto (next-auth
# pide nodemailer@^7 como peer opcional; con npm 10 eso se marca como
# "missing" y `npm ci` revienta con EUSAGE aunque package.json y el lock
# estén perfectamente sincronizados). Se fija la misma mayor de npm que
# generó el lock para que la instalación sea reproducible.
RUN npm install -g npm@11

RUN npm ci

# ---------------------------------------------------------------------------
# Stage 2: builder — compila la app (prisma generate ya corrió arriba, pero
# `npm run build` = "prisma generate && next build" lo repite; es idempotente).
# ---------------------------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# Cada stage parte de una imagen base limpia: el openssl instalado en `deps`
# no viaja acá solo. `npm run build` vuelve a correr `prisma generate` y
# necesita poder detectarlo igual que en el stage anterior.
RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# No mandamos telemetría de Next durante el build de CI.
ENV NEXT_TELEMETRY_DISABLED=1

# El host público del storage tiene que estar disponible DURANTE el build:
# next.config.ts arma images.remotePatterns a partir de él, y esa lista queda
# horneada en la imagen. Si falta, el patrón se arma vacío y <Image> bloquea
# en producción todas las portadas y avatares que vienen de R2 — el archivo
# existe y responde 200, pero Next se niega a servirlo. No es un secreto: la
# URL viaja en el HTML de cualquier portada.
ARG STORAGE_PUBLIC_URL
ENV STORAGE_PUBLIC_URL=$STORAGE_PUBLIC_URL

# El repo no tiene carpeta public/ (no la necesita hoy). El Dockerfile no
# debe asumir que siga así: si el stage final intenta copiar /app/public y
# no existe, el build entero revienta. Crearla vacía acá la vuelve a prueba
# de ese caso sin tener que tocar el repo para agregar un .gitkeep.
RUN mkdir -p public

RUN npm run build

# ---------------------------------------------------------------------------
# Stage 3: runner — imagen final, mínima y sin privilegios de root.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# El motor de consultas de Prisma hace dlopen de libssl en tiempo de
# ejecución, no solo al generarse. Sin esto, la primera query a Postgres
# revienta con "Error loading shared library libssl.so.3".
RUN apk add --no-cache openssl

# Usuario no-root: si el contenedor se compromete, no corre como root del host.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# El output de `output: "standalone"` trae su propio server.js y un
# node_modules recortado por file-tracing.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# El file-tracing de Next es conocido por perder los binarios del query
# engine de Prisma porque no son JS puro y el tracer no siempre los detecta
# como dependencia real. Se copian a mano para no depender de que el
# tracing haya adivinado bien — si igual los incluyó, esto los pisa con lo
# mismo y no pasa nada.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

USER nextjs

# El standalone de Next escucha en localhost por defecto. Sin HOSTNAME=0.0.0.0
# el proceso queda sordo a cualquier IP que no sea la del propio contenedor,
# y Traefik (que le pega desde afuera del contenedor) nunca lo alcanza — es
# el error clásico de este tipo de despliegue.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

# Este Dockerfile NUNCA corre `prisma db push` ni migraciones al arrancar:
# el schema se aplica a mano contra la base (ver docs/MIGRATIONS.md). Si el
# contenedor lo hiciera solo, un rollout con un schema a medio aplicar podría
# escribir contra columnas que todavía no existen en producción.
CMD ["node", "server.js"]
