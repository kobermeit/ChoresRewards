# ChoresRewards

A modern, self-hosted family hub for chores, rewards, weekly meal planning, smart shopping lists, and household organization. Built for always-on wall-mounted tablets (e.g. on the fridge), desktop browsers, and a single Docker container deployed with **Coolify**. Home Assistant OS is still supported as an optional add-on.

---

## Architecture & Tech Stack

- **Frontend:** React 19 + TypeScript + Vite (`/client`)
- **Backend:** Node.js + Express + `better-sqlite3` (`/server`)
- **Database:** SQLite, kept in `DATA_DIR` (`/data/database.db` in Docker, `./instance/database.db` in local dev)
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
  npm start
  ```
  Open `http://localhost:8099`. Data is written to `./instance` unless you set `DATA_DIR`/`DB_PATH`.

- **Development mode (with hot reloading):**
  - Backend: `npm run dev:server` (runs with `tsx watch` on port 8099)
  - Frontend: `npm run dev` (Vite dev server with API proxy on port 5173)

- **Container mode (mirrors the Coolify build exactly):**
  ```bash
  cp .env.example .env && docker compose up -d --build
  ```

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
| `CR_SECRET_KEY` | 64-char hex | Stable session-cookie key across rebuilds: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ENABLE_GOOGLE_CALENDAR` | `true` / `false` | Google Calendar integration toggle |

Optional: `DB_PATH`, `UPLOADS_DIR` (fine-grained paths) and `APP_VERSION` (overrides the version shown in the header, which otherwise comes from `choresrewards/config.yaml`).

### 4. Healthcheck & auto deploy

- **Healthcheck path:** `/api/health` → `200 {"status":"ok","version":"…","database":"ok"}` when healthy, `503` when SQLite cannot be opened. The image already declares a Docker `HEALTHCHECK`, so Coolify shows the container as unhealthy instead of silently broken.
- Enable **Auto Deploy** for `main`. Each push rebuilds the image, and because `npm run verify` + the client/server builds run **inside** the Docker build, a broken build never replaces the running container.

### 5. Moving an existing household over

Open your **old** server, go to **Settings → Backup & Restore**, tick *Include uploaded photos, sounds & screensaver media* and press **Download backup**. You get one file: `choresrewards-backup-<version>-<date>.tar.gz`.

On the **new** (Coolify) server, open **Settings → Backup & Restore**, press **Choose backup file**, pick that archive and confirm with **Yes, replace my data**. The app validates the archive, saves a safety copy of the current database, swaps everything in and restarts itself — reload the page after ~15 seconds.

Because the archive also contains `secret_key`, existing device logins and the household PIN keep working after the move.

> [!IMPORTANT]
> The restore restarts the app process, so the container needs a restart policy. Coolify's default (`unless-stopped`) is correct; in plain Docker use `--restart unless-stopped` (the bundled `docker-compose.yml` already sets it). If the app does not come back on its own, press **Restart** in Coolify and reload.

Manual alternative (no UI), if you prefer copying files yourself:

```bash
docker cp ./database.db choresrewards:/data/database.db
docker cp ./secret_key  choresrewards:/data/secret_key
docker cp ./uploads/.   choresrewards:/data/uploads/
docker restart choresrewards
```

### 6. Backups

- **In-app:** Settings → Backup & Restore → **Download backup** produces a single `.tar.gz` (database + secret + media). Keep one somewhere off the server.
- **Volume:** the `/data` volume is the single source of truth — schedule a Coolify volume backup too.
- **On the host:** `sqlite3 /data/database.db ".backup '/backups/choresrewards-$(date +%F).db'"`.

Safety copies created automatically during a restore are written to `backups/` inside the data volume (`/data/backups/pre-restore-<timestamp>.db`).

---

## Docker Compose (plain Docker, no Coolify)

The bundled [`docker-compose.yml`](./docker-compose.yml) builds the same image for a non-Coolify host:

```bash
cp .env.example .env          # optional: TZ, CR_SECRET_KEY, ...
docker compose up -d --build  # → http://localhost:8099
```

State persists in the `choresrewards-data` named volume. To inspect or reset it: `docker volume inspect choresrewards_choresrewards-data`.

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
