# ── stage 1: instalação de dependências ──────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# instala apenas o necessário para compilar módulos nativos se houver
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./

# ci garante install reproduzível a partir do lockfile
RUN npm ci


# ── stage 2: build da aplicação ───────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* são embutidas em tempo de build — passar via --build-arg
ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
ARG NEXT_PUBLIC_STORAGE_URL=http://localhost:8000/uploads

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_STORAGE_URL=$NEXT_PUBLIC_STORAGE_URL \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build


# ── stage 3: imagem de produção ───────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# standalone inclui o servidor Node minimal sem node_modules completo
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

ENV PORT=3000 \
    HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
