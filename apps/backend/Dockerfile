FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace manifests (package-lock.json lives here)
COPY package*.json ./
COPY apps/backend/package.json ./apps/backend/package.json

RUN npm ci

COPY apps/backend/ ./apps/backend/
RUN npm run build --workspace=apps/backend

# ---- Production image ----
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
COPY apps/backend/package.json ./apps/backend/package.json

RUN npm ci --omit=dev

COPY --from=builder /app/apps/backend/dist ./apps/backend/dist

EXPOSE 3001

CMD ["node", "apps/backend/dist/main"]
