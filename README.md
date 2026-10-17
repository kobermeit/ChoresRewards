# ChoresRewards

A modern, self-hosted family hub for chores, rewards, weekly meal planning, smart shopping lists, and household organization. Built for always-on wall-mounted tablets (e.g. on the fridge), desktop browsers, and Home Assistant OS (HAOS).

---

## Architecture & Tech Stack

- **Frontend:** React 19 + TypeScript + Vite (`/client`)
- **Backend:** Node.js + Express + `better-sqlite3` (`/server`)
- **Database:** SQLite (`/data/choresrewards.db` or `/app/instance/choresrewards.db` in Docker)
- **Deployment:** Home Assistant OS Add-on (`/choresrewards`) and Standalone Docker Container

---

## Local Development & Setup

### Prerequisites

- **Node.js:** v18.0.0 or higher
- **npm:** v9.0.0 or higher

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
  Open `http://localhost:8099`.

- **Development mode (with hot reloading):**
  - Backend: `npm run dev:server` (runs with `tsx watch` on port 8099)
  - Frontend: `npm run dev` (Vite dev server with API proxy on port 5173)

---

## Home Assistant OS (HAOS) Add-on Integration

This repository is configured as a native Home Assistant OS add-on in the `/choresrewards` directory.

### Important: Triggering Add-on Updates in HAOS

> [!IMPORTANT]
> **Home Assistant OS detects add-on updates strictly by comparing the `version` string in `choresrewards/config.yaml`.**
>
> If you make changes to the codebase and push to GitHub, **you must increment the version string in `choresrewards/config.yaml`** (for example, bumping `1.0.3` to `1.1.0`). If the version string is unchanged, Home Assistant will not prompt the user to update or rebuild the container image.

### Building the Add-on Docker Container

The container compiles the React client and Node.js server inside a multi-stage Alpine build:

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
