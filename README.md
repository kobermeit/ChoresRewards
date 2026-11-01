# ChoresRewards

A modern, self-hosted family hub for chores, rewards, weekly meal planning, smart shopping lists, and household organization. Built for always-on wall-mounted tablets (e.g. on the fridge), desktop browsers, and a single Docker container deployed with **Coolify**. Home Assistant OS is still supported as an optional add-on.

---

## Architecture & Tech Stack

- **Frontend:** React 19 + TypeScript + Vite (`/client`)
- **Backend:** Node.js + Express + `better-sqlite3` (`/server`)
- **Database:** **Postgres via Drizzle ORM** (`DATABASE_URL`; schema in `server/src/db/schema.ts`, migrations in `server/drizzle/`, applied automatically on boot). Sessions live in the same database, so redeploys keep every device logged in. SQLite is gone from the request path — `better-sqlite3` survives only to import v1 `.tar.gz` archives after the cutover.
- **Deployment:** One container built from the root [`Dockerfile`](./Dockerfile) — deploy with **Coolify** (or plain Docker Compose). Optional Home Assistant OS add-on lives in `/choresrewards`.

---

## Local Development & Setup

### Prerequisites

- **Node.js:** v22 or higher (see `.nvmrc`; the container is built on Node 22)
- **npm:** v9.0.0 or higher
- **Docker** (optional) — only needed to run the container locally

### 1. Installation

Install dependencies across the root, backend, and frontend:

```bash
npm run install:all
```

*(Or run `npm install` inside `/server` and `/client` individually).*

### 2. Building

Build both the client SPA and backend TypeScript:

```bash
npm run build
```

This compiles client assets into `client/dist/` and backend code into `server/dist/`.

### 3. Running Locally

- **Production mode (serves frontend from backend on port 8099):**
  ```bash
  export DATABASE_URL=postgres://choresrewards:choresrewards@127.0.0.1:55432/choresrewards
  npm start
  ```
  Open `http://localhost:8099`. The server creates/updates the Postgres schema on boot; uploads and the session secret are written to `./instance` unless you set `DATA_DIR`.

- **Development mode (with hot reloading):**
  - Backend: `npm run dev:server` (runs with `tsx watch` on port 8099)
  - Frontend: `npm run dev` (Vite dev server with API proxy on port 5173)

- **Container mode (mirrors the Coolify build exactly):**
  ```bash
  cp .env.example .env && docker compose up -d --build
  ```

> [!NOTE]
> `http://localhost:8099` served from Docker is the **production image** — code is compiled inside the image at build time, so edits do not hot-reload and a browser refresh shows the previous build. After finishing a batch of changes, rebuild once (`docker compose up -d --build`) before reviewing. For live reload use `npm run dev` (Vite) + `npm run dev:server`.

### 4. Verifying before you push

```bash
npm run verify   # ingress/path-safety audit (also runs inside the Docker build)
npm run build    # client bundle + server type-check
```

---

## Deploy with Coolify

The app ships as **one container**: Coolify builds the root [`Dockerfile`](./Dockerfile), the Express server serves the prebuilt React SPA on port **8099**, and every byte of household state lives on a mounted volume.

### 1. Create the application

1. **+ New** → **Application** → **Public Repository** (or private + deploy key) → this repo, branch `main`.
2. **Build Pack:** `Dockerfile` (not Nixpacks). Dockerfile location stays `/Dockerfile`.
3. **Ports Exposes:** `8099`.
4. Set a domain — Coolify provisions Let's Encrypt TLS for you. HTTPS also enables the PWA service worker (offline mode is a no-op over plain HTTP).

### 2. Add the persistent volume (required)

| Type | Name | Mount path |
| :--- | :--- | :--- |
| Volume | `choresrewards-data` | `/data` |

`/data` holds the SQLite database, the session `secret_key`, and all uploaded photos, sounds, and screensaver media. **Without this mount the container boots empty after every redeploy.**

### 3. Environment variables

Add these in the app's **Environment Variables** panel — the commented template lives in [`.env.example`](./.env.example):

| Variable | Value | Purpose |
| :--- | :--- | :--- |
| `DATA_DIR` | `/data` | Points the DB, secret and uploads at the volume |
| `TZ` | e.g. `Australia/Brisbane` | Fallback timezone until one is saved in Settings → General |
| `CR_SECRET_KEY` | *leave empty* | Session-cookie signing key. Empty = auto-generated into `/data/secret_key`. **When migrating, keep it empty** — the backup already carries the old `secret_key`, and an explicit value here overrides it (forcing every device to log in again). To pin your own: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ENABLE_GOOGLE_CALENDAR` | `true` / `false` | Google Calendar integration toggle |

Required: **`DATABASE_URL`** (the Postgres internal URL). Optional: `UPLOADS_DIR` (uploads root) and `APP_VERSION` (overrides the version shown in the header, which otherwise comes from `choresrewards/config.yaml`).

### 4. Healthcheck & auto deploy

- **Healthcheck path:** `/api/health` → `200 {"status":"ok","version":"…","database":"ok"}` when healthy, `503` when Postgres cannot be reached. The image already declares a Docker `HEALTHCHECK`, so Coolify shows the container as unhealthy instead of silently broken.
- Enable **Auto Deploy** for `main`. Each push rebuilds the image, and because `npm run verify` + the client/server builds run **inside** the Docker build, a broken build never replaces the running container.

### 5. Moving an existing household over

Open your **old** server, go to **Settings → Backup & Restore**, tick *Include uploaded photos, sounds & screensaver media* and press **Download backup**. You get one file: `choresrewards-backup-<version>-<date>.tar.gz`.

On the **new** (Coolify) server, open **Settings → Backup & Restore**, press **Choose backup file**, pick that archive and confirm with **Yes, replace my data**. The app validates the archive, writes a safety copy of the current data to `/data/backups/pre-restore-<ts>.json`, replaces every household table inside Postgres in one transaction and copies the media back. No restart is needed — reload the page.

Because the archive also contains `secret_key`, existing device logins and the household PIN keep working after the move.

> [!TIP]
> The restore accepts **both** archive formats: the new logical `database.json` dump and the older SQLite `database.db` payload, so the backup you took before the Postgres cutover can be restored directly.

### 6. Backups

- **In-app:** Settings → Backup & Restore → **Download backup** produces a single `.tar.gz` (logical database dump + secret + media). Keep one somewhere off the server.
- **Postgres:** use Coolify's Postgres backup/scheduled dump as the server-side safety net; the app's own export is the portable, human-verifiable copy.
- **Volume:** `/data` still holds uploads, sounds, screensaver media and the session secret — include it in volume backups.

Safety copies created automatically during a restore are written to `backups/` inside the data volume (`/data/backups/pre-restore-<timestamp>.json`).

---

## Postgres (Drizzle ORM)

The database lives in Postgres (Coolify Postgres resource / bundled `db` service), never inside the app container. Schema changes are authored from `server/src/db/schema.ts` and applied by migrations on boot.

```bash
# 1. a throwaway Postgres for local work
docker run -d --name cr-pg -p 55432:5432 \
  -e POSTGRES_USER=choresrewards -e POSTGRES_PASSWORD=choresrewards \
  -e POSTGRES_DB=choresrewards postgres:16-alpine

# 2. point the server at it
export DATABASE_URL=postgres://choresrewards:choresrewards@127.0.0.1:55432/choresrewards   # PowerShell: $env:DATABASE_URL='…'

# 3. schema + data
npm --prefix server run db:generate                        # schema.ts -> server/drizzle/*.sql
npm --prefix server run db:migrate                         # apply pending migrations
npm --prefix server run db:import -- instance/database.db   # one-off SQLite -> Postgres load
```

The importer is idempotent (`ON CONFLICT DO NOTHING`), resets identity sequences and prints a per-table sqlite/postgres count comparison.

### Code rules for this layer

- All runtime DB access is **async** and goes through `getDb()` (`server/src/db/client.ts`).
- Straightforward CRUD uses the typed Drizzle builder — `many()` / `one()` in `db/client.ts` return rows with **snake_case** columns so the JSON contract the React client consumes stays unchanged.
- The handful of complex handlers (joins, aggregates, batch updates) use the parameterised helpers in `server/src/db/sql.ts` (`sqlAll` / `sqlOne` / `sqlRun`); values are always bound, never interpolated.
- Booleans are real Postgres booleans — never write `0`/`1`, and compare with `= true` / `= false`.
- Dates stay `'YYYY-MM-DD'` / `'YYYY-MM-DD HH:MM:SS'` strings; use `CAST(? AS date)` and `INTERVAL` instead of SQLite's `date('now', …)`.
- `AppSetting.get()` is synchronous (an in-process cache hydrated at boot); `AppSetting.set()` writes through to Postgres.

### 7. Cutover to Postgres (one-time)

1. **Create the database**: Coolify → **+ New** → **Database** → **PostgreSQL** (same server/project as the app). Deploy it, then copy its **internal** connection URL (not the public one).
2. **Add it to the app**: Application → **Environment Variables** → `DATABASE_URL` = that internal URL. Optionally `PG_POOL_MAX=10`.
3. **Redeploy the app** — the image runs the migrations on boot.
4. **Bring the household data across**: open **Settings → Backup & Restore** and restore the `.tar.gz` you downloaded from the old (SQLite) install. The restore understands the old archive format and loads it into Postgres. CLI fallback for a raw `database.db` on the volume (Coolify → app → **Terminal**):
   ```bash
   npm --prefix server run db:import -- /data/database.db
   ```
5. Verify: people/chores/points/photos look right and `GET /api/health` reports `database: "ok"`.
6. Keep the `/data` volume mounted — uploads, sounds, screensaver media and `secret_key` still live there; only the database moved.

---

## Docker Compose (plain Docker, no Coolify)

The bundled [`docker-compose.yml`](./docker-compose.yml) builds the same image for a non-Coolify host and brings up a Postgres alongside it:

```bash
cp .env.example .env          # optional: TZ, CR_SECRET_KEY, ... (DATABASE_URL defaults to the bundled db service)
docker compose up -d --build  # → http://localhost:8099
```

State persists in two named volumes: `choresrewards-data` (`/data`: uploads, secret, backups) and `choresrewards-db` (Postgres). To inspect or reset them: `docker volume inspect choresrewards_choresrewards-data` / `…_choresrewards-db`.

---

## Home Assistant OS (HAOS) Add-on (optional)

This repository is also configured as a native Home Assistant OS add-on in the `/choresrewards` directory.

### Important: Triggering Add-on Updates in HAOS

> [!IMPORTANT]
> **Home Assistant OS detects add-on updates strictly by comparing the `version` string in `choresrewards/config.yaml`.**
>
> If you make changes to the codebase and push to GitHub, **you must increment the version string in `choresrewards/config.yaml`** (for example, bumping `1.0.3` to `1.1.0`). If the version string is unchanged, Home Assistant will not prompt the user to update or rebuild the container image.

### Building the Add-on Docker Container

The add-on container compiles the React client and Node.js server from the upstream repository inside a multi-stage Debian-slim build (Debian keeps `better-sqlite3`'s prebuilt native binaries working, unlike Alpine/musl):

```dockerfile
# Context: repo root
docker build -f choresrewards/Dockerfile -t choresrewards:local .
```

---

## Key Features

- **Chores & Rewards:** Daily midnight auto-reset (Brisbane/configurable timezone), Kanban columns with streaks, badges, points or pocket-money mode, and single-user chore grid filter.
- **Kanban Meal Planner:** Plan dinners with unlimited tiles per day (e.g. Kids vs Adults). Multi-day scheduling allows planning a meal across multiple nights. Click any meal tile to view full recipe ingredients & method.
- **Smart Shopping List:** Case-insensitive catalog intelligence with plural normalization (`Paper Towels` == `papertowel`). Includes quick-add search combobox, `⭐ Frequently Added` modal, `💡 Suggested Restock` predictions, `👁️ Hide Checked` toggle, and `📦 Archive Checked` which marks items as purchased and logs them to history.
- **Recipe Library & Notion Sync:**
  - **Notion Database Sync:** Sync recipes from your Notion recipe database (`POST /api/recipes/sync_notion`).
  - **Discord / Apps Script Webhook:** Direct HTTP endpoint (`POST /api/recipes/import`) to push transcribed recipes from photo bots or external scripts directly into your library.
- **Compact Tablet Layout:** Slim 48px fixed sidebar and collapsible header (~80px height) optimized for 1280px tablet screens, with smooth scroll offset.
- **Security & Setup:** Master 4-digit PIN lock for settings, and Setup Wizard accessible directly inside Settings without duplicating existing members.

---

## License

MIT
