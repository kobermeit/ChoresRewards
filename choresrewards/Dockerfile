# =============================================================================
# Stage 1: Clone repo & build React Frontend + Node/TypeScript Backend
# (HAOS Supervisor sets build context to choresrewards/ and passes BUILD_VERSION)
# =============================================================================
FROM node:22-bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    git ca-certificates python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

ARG BUILD_VERSION=1.0.1
WORKDIR /build

RUN git clone --depth 1 https://github.com/kobermeit/ChoresRewards.git .

# Build React + Vite Frontend (client/dist)
WORKDIR /build/client
RUN npm install --include=dev && npm run build

# Build Express + better-sqlite3 Backend (server/dist)
WORKDIR /build/server
RUN npm install --include=dev && npm run build && npm prune --omit=dev

# =============================================================================
# Stage 2: Production Runtime Image (Port 8099 + HAOS /data persistence)
# =============================================================================
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8099
ENV DATA_DIR=/data

COPY --from=builder /build/server/package.json ./server/package.json
COPY --from=builder /build/server/index.js ./server/index.js
COPY --from=builder /build/server/node_modules ./server/node_modules
COPY --from=builder /build/server/dist ./server/dist
COPY --from=builder /build/client/dist ./client/dist
COPY --from=builder /build/static ./static

RUN mkdir -p /data/uploads

EXPOSE 8099

CMD ["node", "server/index.js"]
