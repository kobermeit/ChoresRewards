# Project Guidelines for ChoresRewards

## Architecture & Technology Stack
- **Backend**: Node.js + Express + TypeScript (`server/`).
  - Database: **Postgres via Drizzle ORM** (`server/src/db/`: `schema.ts`, `client.ts`, `migrate.ts`, `sql.ts`). Every route is ported — **SQLite is gone entirely**; the server links no SQLite driver.
  - Auth: Session-based role auth (`parent`, `child`, `family`) with PIN verification.
  - File Uploads: `multer` (`server/uploads/` mounted to `/static/uploads`).
  - Notifications: Gotify push service (`server/src/services/gotify.ts`).
  - Seasons & Holidays: Anonymous Gregorian Easter calculation & hemisphere date adjustments (`server/src/services/seasons.ts`).
- **Frontend**: React 18 + TypeScript + Vite (`client/`).
  - State & Persistence: Redux Toolkit + RTK Query (`client/src/store/api.ts`) + `redux-persist` (`whitelist: ['ui']`).
  - **Storage Architecture Rule**: Zero direct `localStorage` calls. Device-local UI preferences (`sideNavCollapsed`, `parentManageMode`, `activeTimers`, `activeView`) live in Redux `uiSlice.ts`. Household settings (`global_mute`, `chore_suggestions`) live in the `app_settings` table via `/api/prefs`.
  - **Toasts vs. the offline queue**: toasts are ephemeral `AppContext` state (never persisted) — 3.5 s lifetime, a hard 30 s ceiling and an ✕ on every toast. The blue "Syncing N changes…" notice is *derived from the persisted* `ui.offlineQueue`, so that queue must always be able to drain: replays use a 20 s timeout, an item is dropped after 4 failed attempts or 12 h, and the banner always offers Retry **and** Discard. Never add a code path that can leave an item in `offlineQueue` forever.
  - Audio Engine: Zero-latency procedural Web Audio synthesis (`soundService.ts`) with theme support (Zelda Fantasy, Christmas Bells, Spooky, Zen Chimes, Fanfare) + bundled fallback audio clips.
  - Visuals & Celebrations: Canvas-confetti + custom celebration fireworks.
  - **Code Map Maintenance**: Always consult and keep [CODEMAP.md](file:///d:/projects/choresrewards/CODEMAP.md) updated whenever components, features, or routes are added or refactored.
- **Deployment Targets**: Primary target is a **single Docker container deployed by Coolify** (root `Dockerfile`, port `8099`, persistent volume at `/data`, Postgres resource via `DATABASE_URL`). Also runs standalone on port `8099` (bundled Postgres in `docker-compose.yml`) and inside Home Assistant OS via dynamic Ingress proxy tokens (`/api/hassio_ingress/<token>/`).

---

## Feature Registry (Quick Feature-to-File Cheat Sheet)
*Use this lookup to jump directly to the right files without scanning the codebase.*

| User Feature / UI Element | Key Frontend Component | Backend Route / Database |
| :--- | :--- | :--- |
| **Chores Hub & Columns** | `client/src/components/ChoresKanbanSection.tsx` | `server/src/routes/chores.ts` (`chore` table) |
| **Timed Chore Card (Back)** | `client/src/components/ChoreTimerCardBack.tsx` | `client/src/context/TimerContext.tsx` |
| **Add / Edit Chore Modal** | `client/src/components/ChoreModal.tsx` | `server/src/routes/chores.ts` |
| **Chore & Reward Primitives** | `client/src/components/ui/ItemCard.tsx`, `CardShell.tsx`, `TimerRing.tsx` | Design system (`client/src/styles/tokens.css`) |
| **Rewards & Redemption** | `client/src/components/RewardsSection.tsx`, `Overlays.tsx` | `server/src/routes/rewards.ts` (`reward` table) |
| **Meal Planner (1 / 2 Weeks)** | `client/src/components/MealAndShoppingSection.tsx` | `server/src/routes/meals.ts` (`meal_plan` table) |
| **Smart Shopping List** | `client/src/components/MealAndShoppingSection.tsx` | `server/src/routes/shopping.ts` (`shopping_item` table) |
| **Visual Timer (Tile & Modal)** | `client/src/components/DashboardSection.tsx`, `Overlays.tsx` | Redux / `TimerRing.tsx` |
| **Parent Mode & Permissions** | `client/src/context/AppContext.tsx`, `ChoresKanbanSection.tsx` | `server/src/routes/auth.ts`, `server/src/routes/chores.ts` |
| **Seasonal Themes & Dates** | `client/src/components/SeasonalSettingsView.tsx`, `Header.tsx` | `server/src/routes/seasonal.ts`, `server/src/services/seasons.ts` |
| **Sound Themes & Audio FX** | `client/src/services/soundService.ts`, `SeasonalSettingsView.tsx` | Web Audio synth + `server/src/routes/settings.ts` (`/static/sounds/`) |
| **Family Profiles & Points** | `client/src/components/FamilyMemberModal.tsx`, `ProfileSwitcherModal.tsx` | `server/src/routes/settings.ts` (`person` table) |
| **Extra Bonus Chores Pool** | `client/src/components/SettingsAndLogsViews.tsx` (`tab === 'extra'`) | `server/src/routes/chores.ts` (`is_extra = 1`) |
| **Seasonal Scene & Idle Phases** | `client/src/features/seasonal/ChristmasScene.tsx` + `features/seasonal/scene/*` (terrain, flight plan, actors, layers), `features/seasonal/SceneStills.tsx`, `features/overlays/IdleOverlay.tsx`, `hooks/useIdlePhase.ts` | `styles/idlePhases.css` | Living "Santa Tracker, but dark" backdrop: Google's village night-graded, characters placed on measured terrain paths, Santa's 6-beat flight (cruise → dive → **land on the street** → rest → launch → dash), always-on gutter vignette. One idle ladder (`active` → `ambient` → `screensaver` via `data-idle-phase` on `<html>`) replaces the old `useAmbientIdle` + screensaver double-timer; ghosted content is inert, and the waking tap is **consumed** by `useIdlePhase()` (capture-phase `pointerdown`/`touchstart` + a 900 ms click guard) so waking never also clicks the invisible card that reappears under the finger. |
| **App Bar, Clock, Weather** | `client/src/components/Header.tsx`, `SideNav.tsx` | Open-Meteo API + device clock |
| **Household Settings & Prefs** | `client/src/components/SettingsAndLogsViews.tsx`, `hooks/useSettings.ts` | `server/src/routes/seasonal.ts` (`/api/prefs`), `settings.ts` |
| **Backup & Restore** | `client/src/features/settings/tabs/BackupSettingsTab.tsx` (`tab === 'backup'`) | `server/src/routes/backup.ts` → `server/src/services/backup.ts` (`/api/backup/info`, `/export`, `/import`) |
| **Health Probes** | - | `server/src/routes/health.ts` (`/api/health` for containers, `/api/ping` for client reconnect) |

---

## Directory Layout & Key Modules
```
choresrewards/
├── CODEMAP.md                        # Master index & rapid feature lookup for vibe coding & agents
├── client/src/
│   ├── features/                     # Small, pure domain components (< 200 LOC per file)
│   │   ├── chores/                   # Kanban hub, ChoreCard, celebration modal, kanban columns
│   │   ├── meals/                    # Meal planner, recipe cards, view/edit modals
│   │   ├── shopping/                 # Shopping list, store lanes, history & quick add modals
│   │   ├── rewards/                  # Reward cards, claim modal, edit modal, redeemed pool
│   │   ├── dashboard/                # Memoized dashboard widgets & family progress summary
│   │   ├── calendar/                 # Month grid, upcoming schedule view, event modal
│   │   ├── notes/                    # Rich text sticky notes, Reddit-style note feed, view/edit modal
│   │   ├── settings/                 # 12 focused settings tabs (General, Family, Chores, Seasonal, etc.)
│   │   ├── overlays/                 # Screensaver ambient clock, visual timer modal, kids play games
│   │   └── header/                   # Weather widget, clock widget, forecast modal
│   ├── components/                   # Top-level coordinators, legacy shims, design primitives
│   │   ├── ui/                       # Design system primitives: Button, Card, CardShell, TimerRing, Input, Select, Badge, FlipCard
│   │   ├── ChoreTimerCardBack.tsx    # Timed chore reverse face using CardShell & dynamic TimerRing
│   │   ├── Header.tsx & SideNav.tsx  # App bar with seasonal badge, clock, weather, view switcher
│   │   └── Overlays.tsx              # Full-screen overlay coordinator
│   ├── context/
│   │   ├── AppContext.tsx            # Household session, role gating, toast manager, playSound dispatcher
│   │   └── TimerContext.tsx          # High-precision chore countdown interval engine synced to Redux
│   ├── store/
│   │   ├── index.ts                  # Redux store with redux-persist & RTK Query middleware
│   │   ├── api.ts                    # RTK Query endpoints for seasonal themes & household prefs
│   │   └── uiSlice.ts                # Per-device UI preferences (navigation, clean view, active timers)
│   ├── types/                        # Domain-specific TypeScript interfaces (*.types.ts)
│   ├── hooks/useSettings.ts          # Typed hooks: useHouseholdPrefs, useUiPref, useSeason, useSoundTheme
│   └── services/soundService.ts      # Web Audio procedural synthesizers & audio clip dispatcher
└── server/src/
    ├── db.ts                         # Household data layer: boot (migrations + seeds), AppSetting cache, logActivity
    ├── db/                           # Postgres + Drizzle: schema.ts, client.ts (pool + many/one), migrate.ts, sql.ts
    ├── routes/                       # Express routes (chores, rewards, seasonal, auth, meals, shopping, settings)
    └── services/seasons.ts           # Dynamic Easter computation, seasonal window resolution, hemisphere logic
```

---

## Core Subsystems & Business Rules

### 1. Parent Mode & Role Permissions
- **Roles**:
  - `parent`: Full administrative capability. Protected by PIN. When switching to a parent profile, parent mode remains active for the session (no repetitive PIN re-prompts).
  - `child`: Clean restricted dashboard. Can only start timers and complete their own chores.
  - `family`: Unlocked shared wall-tablet kiosk view.
- **Parent Manage Controls**: Parents have a toggle button (`parentManageMode`) in the chores toolbar. When toggled OFF, edit and delete icons are hidden for a clean view while still allowing parents to start or complete chores.
- **Acting on Child's Chores**: When a parent completes a child's chore ("Complete for Abby"), points are credited to the child and activity logs record who completed it (`Chore 'X' was completed by Parent for Child`). Parents can also have their own chores assigned to them.

### 2. Card Shell & Timer Synchronization
- All cards (chores, rewards, timed chore reverse faces) share `CardShell` (`client/src/components/ui/CardShell.tsx`) with consistent padding, gap, and action row heights.
- Timers use `TimerRing` (`client/src/components/ui/TimerRing.tsx`) with CSS Container Queries (`min(100cqw, 100cqh)`). The SVG circle expands dynamically to fill whatever card height or modal container is allocated without manual hardcoding or layout shifts.

### 3. Seasonal Themes & Sound Themes
- **Seasons & Events**: Database-backed in Postgres (`seasons` and `seasonal_events` tables).
  - Supports dynamic dates (e.g. Easter calculated via Gregorian algorithm) and fixed holidays (Halloween, Christmas, New Year's) with active celebration windows (typically ±7 days).
  - Hemisphere toggle adjusts meteorological season dates (Southern Hemisphere default: Dec–Feb Summer, Sep–Nov Spring).
- **Sound Themes**: Configurable in Settings (`auto`, `default`, `fantasy` [Zelda-style secret chime], `christmas` [bell chime chords], `spooky` [Halloween theremin arpeggio], `chimes` [zen wind chimes], `fanfare` [royal brass]). Synthesized purely via Web Audio API (zero external assets required).
- **Windows open and close by themselves**: `useSeason()` polls every 10 minutes *and* `AppContext` invalidates the RTK Query `Seasonal` tag on midnight rollover and device wake. Never rely on a single fetch — a wall tablet can stay open for weeks, and "Halloween was still on the day after it ended" was exactly this bug.


### 4. Backup & Restore (household migration)
- **Export** (`GET /api/backup/export?media=1`, parent-only) streams one `.tar.gz` (format v2): `manifest.json` + `database.json` (a logical dump of every household table) + `secret_key` + `uploads/**`.
- **Import** (`POST /api/backup/import`, parent-only) accepts *only* format-v2 archives this app wrote. The tar is extracted against a strict whitelist (`manifest.json`, `database.json`, `secret_key`, `uploads/…`); symlinks, absolute paths, `..` traversal, unknown files and foreign manifests are rejected. **The archive is never parsed or executed as SQL** — rows are written through parameterised inserts against the fixed table whitelist.
- **Legacy v1 (SQLite) archives are rejected** with a pointer to `scripts/convert-v1-backup.js` — a standalone offline converter that rewrites a v1 archive (SQLite `database.db`) into a v2 one (`database.json`, real booleans, Postgres column names). The app itself links no SQLite driver.
- Restore is a **logical, transactional replace** inside Postgres: a safety copy lands in `DATA_DIR/backups/pre-restore-<ts>.json`, then every household table is deleted and re-inserted (FK-safe order, identity sequences reset), `AppSetting` reloads its cache, media is copied back and `secret_key` restored. **No process restart, no lost sessions.** The COMMIT tag is checked and every row count is re-verified after COMMIT, because Postgres answers a COMMIT on an aborted transaction with a silent ROLLBACK.
- Keep the in-app export as the supported migration path between HAOS, Docker and Coolify — it carries `secret_key`, so existing device logins and the PIN survive the move.
- **Never set `CR_SECRET_KEY` when restoring a backup**: the env var overrides `DATA_DIR/secret_key` (the restore logs a warning and keeps the env value), so an explicit value logs every device out.

---

## Postgres Data Layer (COMPLETE — read before touching the DB)
- **Target:** Postgres only. Coolify hosts a Postgres resource; the app gets `DATABASE_URL`. There is **no dual-driver** design and no SQLite driver in the image — `scripts/convert-v1-backup.js` is a standalone offline tool for old archives.
- **Where the Postgres layer lives:**
  - `server/src/db/schema.ts` — Drizzle schema for all 18 tables + `session` (types mapped from the live SQLite DB: identity PKs *BY DEFAULT* so ids survive import, `BOOLEAN`→`boolean`, `DATETIME`→`timestamp(string)`, `DATE`→`date(string)`, `FLOAT`→`double precision`; free-text columns are `varchar(255)` or `text`, since SQLite never enforced `VARCHAR(n)`).
  - `server/src/db/client.ts` — pooled `pg` connection + `getDb()`; throws a clear error when `DATABASE_URL` is missing.
  - `server/src/db/migrate.ts` + `runMigrationsCli.ts` — apply `server/drizzle/*.sql` (generated by `drizzle-kit`).
- **Commands:** `npm --prefix server run db:generate` (author migrations from `schema.ts`) · `run db:migrate` (apply).
- **Query helper:** `server/src/db/sql.ts` (`sqlAll` / `sqlOne` / `sqlRun` / `sqlExec`) runs parameterised SQL (`?` → `$n`) on the same pool, for handlers whose queries are too dynamic for the builder. `sqlRun` appends `RETURNING id` to inserts, so `lastInsertRowid` still works.
- **Legacy row shape:** `many()` / `one()` in `db/client.ts` run a Drizzle builder query and hand back rows with snake_case keys (`assigned_to_id`, `is_admin`, …) — that shape is also the client's JSON contract, so **keep using them when a handler previously consumed raw SQLite rows**.
- **Rules for new/changed code:**
  1. All DB access is `async` — never read a Promise's properties (`const x = someAsyncFn(); x.id` is a bug, and JSON-serialising an un-awaited promise yields `{}`).
  2. Real booleans: never write `0`/`1`, compare with `= true` / `= false`, and use `Boolean(row.flag)` in JS (never `row.flag !== 0`, which is always true for `false`).
  3. Dates stay `'YYYY-MM-DD'` / `'YYYY-MM-DD HH:MM:SS'` strings; use `CAST(? AS date)` + `INTERVAL` — there is no `date('now', …)`.
  4. Wrap async handlers in try/catch (Express 4 does not await them); a global `unhandledRejection` logger keeps one bad request from killing the container.
  5. `AppSetting.get()` is synchronous (cache hydrated at boot); `AppSetting.set()` persists and never rejects.
- **State:** the whole cutover is **done and verified against the real household database** (4 people, 11 chores, 195 catalog items, 209 activity rows). Verified end-to-end on Postgres: bootstrap, chore CRUD + points/badges, reward redemption, shopping add/update/remove, meal cards, notes, sessions (login persists across restarts), settings, and the health probe.

---

## Plan of Action First
- **Provide a Plan of Action First**: When the user sends a message with feedback or changes without an explicit "go and fix this now" instruction, respond quickly with a clear plan of action detailing how the message was interpreted and the intended implementation steps, so the user can review and confirm before work begins.

## Local Server & Process Lifecycle
- **The local container is a production image, not a dev server**: `localhost:8099` (Docker) serves the client bundle and server code compiled *inside the image at build time*. Editing files does **not** hot-reload it — a refresh shows the old build. Live reload only exists in dev mode (`npm run dev` + `npm run dev:server`).
- **Rebuild the local container once per batch, not per edit**: when a batch of changes is finished and you are about to tell the user it's done, rebuild + restart the local container (`docker compose up -d --build`, or `docker build -t choresrewards:local . && docker rm -f choresrewards-local && docker run …`) so the user can refresh and see everything. Never rebuild after each individual edit (slow, wasteful).
- **Never bump versions during development previews**: version bumps happen only at deploy time (see Versioning Protocol) to avoid micro-bumps between releases.
- **Keep server running while actively collaborating**: Do NOT kill the local server while pair programming / actively working with the user unless the user explicitly indicates they are stepping away or concluding the session.
- **Sleep & Power Management**: When the user states they are finishing, leaving, or stepping away, clean up and terminate background server processes so the host PC can sleep.
- **Sleep Sequence Order**: When asked to put the PC to sleep, ALWAYS send your final complete summary / status message to the user FIRST so they can read what was done. Only after the final response has been delivered should the OS sleep command be executed (e.g. giving a slight delay or executing as the final action after messaging), never cutting off or suspending mid-turn before the user sees the summary.

## Versioning Protocol
- **Strict Deploy Command Requirement (NEVER Deploy Automatically)**: NEVER bump versions, push commits, or deploy unless the user EXPLICITLY uses the word `"deploy"` or commands `"deploy this"`. Standard feedback, feature requests, or UI bug fixes are strictly local development work until the user explicitly commands a deploy.
- **Only increment version on deploy/push**: Do NOT bump versions multiple times during local development. Only increment when preparing to deploy/push to git upon user request, and use a single bump (e.g., `1.2.0` -> `1.2.1` or `1.3.0` depending on release scope).
- **Update All 4 Version Files in Lockstep**: When bumping versions, you MUST update all 4 of these files together:
  1. `choresrewards/config.yaml` (`version: "X.Y.Z"`) — **CRITICAL**: Home Assistant Supervisor reads this exact file to detect updates in HAOS. If omitted, Home Assistant will report "No updates available".
  2. `package.json` (Root workspace `version`)
  3. `client/package.json` (Frontend client `version`)
  4. `server/package.json` (Backend server `version`)
- **Always build production bundles before push**: Run `npm run build` (`npm run build:client` + `npm run build:server`) before committing.

## Shared Branch Collaboration & Git Pull Protocol
- **Single-Branch Shared Workstation Protocol**: When multiple workstations (or users) are developing on the same branch (e.g. `main`) without Pull Requests:
  - **Always Pull Before Starting**: At the start of every session or task, check for incoming remote commits via `git pull --rebase origin main` (or `git fetch origin main`).
  - **Always Pull Before Pushing**: Right before pushing commits, run `git pull --rebase origin main`. If new commits were integrated, re-run `npm run build` to guarantee zero integration regressions.
  - **Never Overwrite with Force Push**: Never use `git push --force`. Always use standard `git push`.
  - **Linear History**: Use `--rebase` to avoid cluttering git history with merge commits. If conflicts occur, resolve them carefully preserving both contributors' changes.

## Quality Standards & Live Browser Verification
- **Test Effort Proportionality (Match Effort to Risk)**: See [TESTING.md](file:///d:/projects/choresrewards/TESTING.md) for the full verification ladder. In short:
  - **Tier 1 – Cosmetic / copy / docs / CSS-only change**: read the diff, run `npm run build:client` once. No browser harness, no scripts.
  - **Tier 2 – Single-view UI logic**: `npm run build` + a quick manual click-through of the affected view on `:8099`.
  - **Tier 3 – Shared state, store/slice, reducers, persistence, routing, auth, or cross-view primitives**: `npm run verify` + `npm run build` + a temporary scripted browser check (see TESTING.md) covering the touched flow *and* its neighbours.
  - Never build a bespoke harness for a Tier 1 change; never ship a Tier 3 change on a build alone.
- **MANDATORY Automated Headless Browser Smoke Check**:
  - Before declaring any task complete or notifying the user that a build is ready to test, you MUST execute a temporary headless browser smoke test using `puppeteer-core` against the live local application (http://localhost:8099/).
  - The check must verify that the page loads with **ZERO console errors** and **ZERO uncaught page exceptions / ReferenceErrors**.
  - Never tell the user work is ready without this check passing. Clean up temporary test scripts before concluding.

- **Batch-End Safety Checks Only (Token & Latency Conservation)**:
  - Do NOT run verification audits (`npm run verify`), TypeScript builds (`npm run build`), or test commands between individual incremental edits within a batch.
  - Run verification and build commands **ONLY ONCE at the end of the entire batch** when all planned edits are finished, right before reporting completion to the user.
- **Mandatory Ingress & Environment Portability Audit**:
  - Run `npm run verify` (`node scripts/verify_ingress.js`) before every deploy or commit.
  - Zero tolerance for hardcoded absolute paths (`/static/...` or `/api/...`). All paths must be relative (`./static/...`) or passed through `resolveAssetUrl(url)`.
  - Ensure the client runs seamlessly in standalone mode (direct port `8099`), sub-path proxies, and Home Assistant Ingress dynamic token prefixes (`/api/hassio_ingress/<token>/`).
- **Mandatory Container Deploy Verification**:
  - Run `npm run verify:deploy` (`scripts/verify_deploy.js`) before **every version bump or push to `main`**.
  - `npm run verify` and `npm run build` both run *inside* the Docker build and still cannot catch a container that fails to boot — that is exactly how v1.20.0 was rolled back (Postgres hostname unresolvable at boot → crash loop → Coolify judged the container unhealthy).
  - The script builds the real root `Dockerfile`, boots it on an isolated network against a throwaway Postgres under a Coolify-style UUID hostname, and fails the run on any boot/health/manifest regression (see TESTING.md tier 1.5).

- **Full UI Regression Test Before Deploy**: Before doing a version push or deploy, run a comprehensive regression test in the local UI across every screen. Verify:
  - Adding, editing, and redeeming rewards
  - Adding, completing, and undoing chores
  - Adding, checking off, and removing shopping list items and meals
  - Notes full-length feed, inline expand/collapse, and full view modal
  - Extra bonus chores pool in settings with add, edit, and delete flow
  - Profile switcher modal and active user transitions
  - Visual polish: NO broken images, broken avatars, layout shifts, or horizontal scrollbars
  - Never modify user-configured external configs (like Calendar iCal/Embed URLs or Notion tokens).
- Maintain a high bar of visual polish, alignment, and responsiveness.

## Design System & Component Library Standards
- **Strict Compliance with [DESIGN_SYSTEM.md](file:///d:/projects/choresrewards/DESIGN_SYSTEM.md)**: All frontend development MUST adhere to the design tokens and UI primitives documented in `DESIGN_SYSTEM.md`.
- **UI Primitives Requirement**: Use `<Button>`, `<Input>`, `<Select>`, `<Card>`, and `<Badge>` from `@/components/ui`. Never add raw unstyled `<button>` or `<input>` tags for UI actions.
- **Forbid Arbitrary Inline Styles**: Inline styles for design attributes (colors, corner radius, borders, shadows) are forbidden unless required for dynamic data-driven values (e.g. person accent colors). Use CSS variables (`var(--btn-radius)`, `var(--card-radius)`, `var(--modal-radius)`) instead.
- **Single-Line Reskinning Guarantee**: The design system must maintain single-variable theme overrides in `tokens.css` so buttons, modals, and card styles can be reskinned in 1 line.
- **Touch-first by default**: the primary device is a wall tablet with no mouse or keyboard. Never make a control discoverable *only* through `:hover` — either gate hover-reveal CSS behind `@media (hover: hover) and (pointer: fine)` or give it a coarse-pointer fallback in the `@media (hover: none), (pointer: coarse)` block at the end of `components.css` (`cr-avatar-edit-overlay`, `chore-upload-overlay` and `cr-hover-only` already live there).

## Component Modularization & Performance Standards
- **Single Component Per File**: Each file should represent a single component or cohesive unit, aiming for < 150–250 lines. Large monolithic files (1,000+ lines) are forbidden.
- **JSX-First Components**: Components should primarily contain JSX rendering and layout. Complex business logic, date calculations, and API orchestration belong in custom hooks, utils, or RTK slices.
- **Dedicated Domain Types**: Never declare large inline TypeScript interfaces inside component files. Place domain interfaces in `client/src/types/<domain>.types.ts` and re-export via `client/src/types.ts`.
- **Pure Rendering & Memoization**: Use `React.memo` on list cards, kanban lanes, and dashboard widgets to eliminate cascading re-renders when parent states update. Use `useMemo` for derived data filters/groupings and `useCallback` for event handlers passed down to child components.
- **Decoupled Local UI State**: Keep navigation (`activeView`), panel toggles, and view options in Redux `uiSlice.ts` to avoid re-rendering unrelated pages.
- **Always Update Code Map**: Whenever files or features are added or rearranged, update [CODEMAP.md](file:///d:/projects/choresrewards/CODEMAP.md).

## Docker & Coolify Deployment Contract
- **One production build path**: the root `Dockerfile` (capital D — Coolify's default Dockerfile location). `npm run verify` + client/server builds run *inside* the build stage, so a failing build never replaces the running container. Do not add a second prod Dockerfile for Coolify.
- **Base image stays Debian slim** (`node:22-bookworm-slim`). No native modules are linked any more (SQLite support was removed), so the build stage needs no compiler toolchain.
- **Port `8099`** is what Coolify exposes (`Ports Exposes = 8099`). `NODE_ENV`, `PORT` and `DATA_DIR` are image `ENV`s and may be overridden by Coolify environment variables.
- **Database (Postgres) is a Coolify resource, not a container**: add a PostgreSQL resource and set the app's `DATABASE_URL` to its internal URL. Migrations run on boot (`server/src/db/migrate.ts`) and the Dockerfile copies `server/drizzle/` into the runtime image — **any new migration must be committed or the container boots against an old schema**.
- **Persistent state lives in `DATA_DIR`** (`/data` in containers): `secret_key`, `uploads/`, `backups/` (pre-restore safety copies). The household database itself lives in Postgres, so it survives a lost volume — but uploads/secret do not. Never write state into the image, `client/dist`, or `server/`.
- **Healthcheck** is `/api/health` (`server/src/routes/health.ts`, `200` healthy / `503` when the boot is
  still in progress or the Postgres probe fails). `/ping` (`204`) remains the client's lightweight reconnect
  probe — do not merge the two, and keep the health payload free of filesystem paths and household data
  (driver **codes** like `EAI_AGAIN` are allowed, driver messages and hostnames are not).
- **Boot must never be fatal on the first database hiccup.** The port is bound before migrations
  (`server/src/index.ts` → `bootDatabase()`), the whole DB step is retried by `withDbRetry()`
  (`server/src/db/retry.ts`, budget `DB_BOOT_TIMEOUT_MS`, default 45 s) and only then does the process
  exit. `Dockerfile`'s `HEALTHCHECK --start-period` (60 s) must stay **above** that budget: Coolify waits
  the start period once and judges the deploy on that single health status, so a slow-but-healthy boot must
  never be reported unhealthy. This is exactly how v1.20.0 was rolled back.
- **Migrations take a Postgres advisory lock** (`server/src/db/migrate.ts`), so two containers may boot at
  the same time (rolling deploy, blue/green, a manual `docker run` next to the live one) without racing on
  DDL. Do not remove it, and do not add a retry loop inside `runMigrations()` — the outer `withDbRetry()`
  owns retries.
- **Verify the deploy, not just the build**: `npm run verify:deploy` builds the real image and boots it
  against a throwaway Postgres (see [TESTING.md](file:///d:/projects/choresrewards/TESTING.md) tier 1.5).
  Run it before any version bump. It reproduces the "Postgres down at boot" and "Postgres vanishes while
  serving" cases that `npm run build` cannot see.

- **Runtime runs as `USER node`** (uid 1000). Any new persistent directory must be created and `chown`ed to `node` in the Dockerfile, otherwise SQLite/uploads fail with EACCES.
- **Config template**: `.env.example` is committed (`.gitignore` and `.dockerignore` both re-include it). Add every new `process.env.*` variable there with a comment, and wire it into `docker-compose.yml` for local runs.
- `docker-compose.yml` is for **local / self-hosted Docker only**; production is Coolify and does not use it.
- The optional HAOS add-on (`choresrewards/`) builds from the public GitHub repo, so it stays independent of the Coolify image. `choresrewards/config.yaml` is still the version source for both (bundled into the image for `APP_VERSION`).

---

## Production Resource & Ingress Path Safety (CRITICAL)
- **Home Assistant Ingress Path Routing**: In production, Home Assistant serves the application behind a dynamic path prefix (e.g. `/api/hassio_ingress/<token>/`).
- **NEVER use Absolute Root Paths in the Client**: Absolute paths like `/static/...` or `/api/...` break in production because the browser requests `http://<ha-ip>:8123/static/...` bypassing the Ingress session token completely (yielding 404/401).
- **Mandatory Relative Resolution (`resolveAssetUrl` & `resolveAvatarUrl`)**:
  - Always wrap any static image, uploaded photo, avatar, audio, or resource URL through `resolveAssetUrl(url)` or `resolveAvatarUrl(avatar)`.
  - When declaring stock asset catalogs or audio clip arrays in frontend code, always specify them as `./static/...` (never `/static/...`).
  - Audio playback must pass `resolveAssetUrl(url)` to `new Audio(...)`.
- **Backend Dual-Path Mounting**: The Express server must continue to serve both `/static` and `/api/static`, as well as `/` and `/api`, guaranteeing both direct port 8099 and Ingress reverse-proxy traffic find all files.
- **Automated Verification**: Run `npm run verify` to automatically scan all source files for path violations before building production bundles.
