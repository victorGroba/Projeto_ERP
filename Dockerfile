# ============================================================
#  C.A. BI Dashboard — build em container único
#  O backend (Express) serve a API E o frontend buildado.
# ============================================================

# ---- Stage 1: build do frontend (React/Vite) ----
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build          # gera /app/frontend/dist

# ---- Stage 2: build do backend (TypeScript) ----
FROM node:20-alpine AS backend
WORKDIR /app/backend
# openssl: necessário para o Prisma detectar a engine correta no Alpine
RUN apk add --no-cache openssl
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npx prisma generate     # gera o Prisma Client
RUN npm run build           # tsc -> /app/backend/dist

# ---- Stage 3: imagem final de produção ----
FROM node:20-alpine
WORKDIR /app/backend
ENV NODE_ENV=production
# openssl + libc6-compat: runtime do Prisma no Alpine
RUN apk add --no-cache openssl libc6-compat

# Reaproveita node_modules (com Prisma Client gerado) e o build do backend
COPY --from=backend /app/backend/node_modules ./node_modules
COPY --from=backend /app/backend/dist ./dist
COPY --from=backend /app/backend/package.json ./package.json
COPY backend/prisma ./prisma

# Frontend buildado vai para /public (servido pelo Express)
COPY --from=frontend /app/frontend/dist ./public

# Pasta de dados (SQLite) — montada como volume no compose
RUN mkdir -p /app/data

EXPOSE 3001

# Cria/atualiza as tabelas no volume e sobe o servidor
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/server.js"]
