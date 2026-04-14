FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace manifests (package-lock.json lives here)
COPY package*.json ./
COPY apps/frontend/package.json ./apps/frontend/package.json

RUN npm ci

COPY apps/frontend/ ./apps/frontend/
RUN npm run build --workspace=apps/frontend

# ---- Production image (nginx) ----
FROM nginx:alpine AS runner

COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html

# SPA fallback: serve index.html for all routes
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
