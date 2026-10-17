# =============================================================================
# Stage 1: Build React + Vite Frontend (client/dist)
# =============================================================================
FROM node:22-bookworm-slim AS client-builder
WORKDIR /app/client

COPY client/package*.json ./
RUN npm install --include=dev

COPY client/ ./
RUN npm run build

# =============================================================================
# Stage 2: Build Node.js + Express + better-sqlite3 Backend (server/dist)
# =============================================================================
FROM node:22-bookworm-slim AS server-builder
WORKDIR /app/server

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY server/package*.json ./
RUN npm install --include=dev

COPY server/ ./
RUN npm run build && npm prune --omit=dev

# =============================================================================
# Stage 3: Production Runtime Image (Port 8099 + HAOS /data persistence)
# =============================================================================
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8099
ENV DATA_DIR=/data

# Copy backend build and production node_modules
COPY --from=server-builder /app/server/package.json ./server/package.json
COPY --from=server-builder /app/server/index.js ./server/index.js
COPY --from=server-builder /app/server/node_modules ./server/node_modules
COPY --from=server-builder /app/server/dist ./server/dist

# Copy built Vite frontend
COPY --from=client-builder /app/client/dist ./client/dist

# Copy static assets (default avatars, sounds, images)
COPY static/ ./static/

# Ensure /data exists for Home Assistant OS persistent volume
RUN mkdir -p /data/uploads

EXPOSE 8099

CMD ["node", "server/index.js"]
