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

# Pick up patched Alpine packages (libssl3/libcrypto3, ...).
RUN apk upgrade --no-cache

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
COPY apps/backend/package.json ./apps/backend/package.json

# npm is only needed to install; the container just runs node. Dropping it
# removes the npm-bundled dependencies (tar, glob, cross-spawn...) from the image.
RUN npm ci --omit=dev \
  && npm cache clean --force \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
    /usr/local/lib/node_modules/corepack /usr/local/bin/corepack

COPY --from=builder /app/apps/backend/dist ./apps/backend/dist

EXPOSE 3001

CMD ["node", "apps/backend/dist/main"]
