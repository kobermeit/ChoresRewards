# =============================================================================
# ChoresRewards — single-container image (Coolify / Docker / Portainer)
#
#   docker build -t choresrewards:local .
#   docker run -d --name choresrewards -p 8099:8099 \
#     -v choresrewards-data:/data choresrewards:local
#
# The Coolify application builds THIS file ("Dockerfile" build pack) and exposes
# port 8099. All state (SQLite DB, uploads, session secret) lives in DATA_DIR
# (/data) and MUST be a mounted volume, otherwise data is lost on redeploy.
# =============================================================================

# =============================================================================
# Stage 1: Build the React client and the Express/TypeScript server
# =============================================================================
# NOTE: better-sqlite3 is a native module. Keep this stage glibc-based (Debian
# slim) and compile it here — never Alpine/musl, otherwise the runtime image
# needs a full toolchain or the binary fails to load.
FROM node:22-bookworm-slim AS build
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install from lockfiles for reproducible builds (cache-friendly ordering)
COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci

COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci

# Copy sources (node_modules / dist / instance / .env are excluded by .dockerignore)
COPY package.json ./
COPY scripts ./scripts
COPY client ./client
COPY server ./server
COPY static ./static
COPY choresrewards/config.yaml ./choresrewards/config.yaml

# Fail the image build on ingress/path violations, then produce both bundles
RUN npm run verify && npm run build

# Drop dev dependencies from the server before the runtime stage copies them
RUN cd server && npm prune --omit=dev

# =============================================================================
# Stage 2: Production runtime (port 8099, persistent state in /data)
# =============================================================================
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8099 \
    DATA_DIR=/data

# Server entry, compiled bundle and production-only node_modules
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/index.js ./server/index.js
COPY --from=build /app/server/node_modules ./server/node_modules
COPY --from=build /app/server/dist ./server/dist

# Built Vite client (served by Express at /)
COPY --from=build /app/client/dist ./client/dist

# Bundled static assets (default avatar, chore/reward images, sound clips)
# plus the add-on manifest, which is the single source of the app version.
COPY --from=build /app/static ./static
COPY --from=build /app/choresrewards/config.yaml ./choresrewards/config.yaml

# Persistent volume mount point, owned by the unprivileged runtime user
RUN mkdir -p /data/uploads /data/chores /data/rewards /data/library /data/meals \
      /data/organise /data/sounds /data/screensaver \
    && chown -R node:node /data /app

USER node

EXPOSE 8099

# Node's built-in fetch — the slim image ships neither curl nor wget
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8099)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]