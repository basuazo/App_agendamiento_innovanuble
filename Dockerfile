# ─── Stage 1: Build del cliente ───────────────────────────────────────────────
FROM node:20-alpine AS client-builder
WORKDIR /workspace

COPY client/package*.json ./client/
RUN cd client && npm ci --silent

COPY client/ ./client/
# Vite buildea a /workspace/server/public según vite.config.ts
RUN cd client && npm run build

# ─── Stage 2: Build del servidor ──────────────────────────────────────────────
FROM node:20-alpine AS server-builder
WORKDIR /workspace

COPY prisma/ ./prisma/
COPY server/package*.json ./server/
RUN cd server && npm ci --silent

COPY server/src/ ./server/src/
COPY server/tsconfig.json ./server/
# Generar cliente Prisma y compilar TypeScript
RUN cd server && npx prisma generate && npm run build

# ─── Stage 3: Imagen de producción ────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

# Dependencias de producción solamente
COPY server/package*.json ./
RUN npm ci --omit=dev --silent

# Prisma: schema (para migrate deploy) + cliente generado
COPY prisma/ ./prisma/
COPY --from=server-builder /workspace/server/node_modules/.prisma ./node_modules/.prisma

# Build del servidor compilado
COPY --from=server-builder /workspace/server/dist ./dist

# Build del cliente (servido por Express en producción)
COPY --from=client-builder /workspace/server/public ./public

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["node", "dist/app.js"]
