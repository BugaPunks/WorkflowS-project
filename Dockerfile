# Imagen de producción para WorkflowS: compila el SPA (Rsbuild) y arranca el
# API de Express en el MISMO origen, de modo que la cookie de sesión
# (SameSite=Lax) viaje sin depender de CORS ni de subdominios distintos.
#
# La base de datos es PostgreSQL (Neon en el despliegue gratuito) y se conecta
# por DATABASE_URL en tiempo de ejecución; no hay secretos horneados aquí.
#
# Construir y probar en WSL:
#   docker build -t workflows .
#   docker run --rm -p 10000:10000 \
#     -e DATABASE_URL="postgresql://..." \
#     -e JWT_SECRET="<32+ caracteres>" \
#     -e CORS_ORIGINS="http://localhost:10000" \
#     -e NODE_ENV=development workflows

# ---------- Etapa 1: dependencias y build ----------
FROM node:22-bookworm-slim AS builder

# better-sqlite3 compila un módulo nativo si no encuentra binario precompilado;
# se instalan las herramientas solo en esta etapa.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Primero los manifiestos: así la capa de node_modules se cachea mientras no
# cambien las dependencias.
COPY package.json package-lock.json ./

RUN npm ci

# El cliente de Prisma necesita el schema y la config para generarse.
COPY prisma ./prisma
COPY prisma.config.ts ./

# `prisma generate` no se conecta a la base, pero prisma.config.ts declara el
# datasource con env(), así que se define un valor de relleno.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"

RUN npx prisma generate

# Resto del código y build del frontend (genera ./dist).
COPY . .

RUN npm run build

# ---------- Etapa 2: ejecución ----------
FROM node:22-bookworm-slim AS runner

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
# Render inyecta PORT; se deja 10000 como valor por defecto (su convención).
ENV PORT=10000

WORKDIR /app

# Dependencias ya compiladas (incluye el cliente Prisma generado, tsx y la CLI
# de Prisma, que se usan en el arranque para aplicar migraciones).
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Los archivos subidos se guardan en disco. En el plan gratuito de Render el
# disco es efímero: los adjuntos se pierden al redeploy (los datos de la BD en
# Neon no). Se aísla en su propio directorio para poder montar un volumen.
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
ENV UPLOADS_DIR=/app/uploads

USER node

EXPOSE 10000

# `start` aplica las migraciones pendientes y levanta el API con tsx.
CMD ["npm", "start"]
