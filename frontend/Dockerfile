# syntax=docker/dockerfile:1

# ===== Builder =====
FROM node:20-alpine AS builder
WORKDIR /app

# Instala dependencias de forma reproduzivel (usa o package-lock.json).
COPY package.json package-lock.json ./
RUN npm ci

# Copia o codigo e gera o build standalone.
COPY . .
# ATENCAO: NEXT_PUBLIC_* e embutido em BUILD TIME. Para trocar a URL da API
# (ex.: outro dominio white-label), passe --build-arg NEXT_PUBLIC_API_URL=...
# No Coolify, marque essa env var como "Build Variable".
ARG NEXT_PUBLIC_API_URL=https://api-alchemypet.tudomudou.com.br
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

# ===== Runner =====
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Usuario nao-root.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Artefatos do build standalone.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
