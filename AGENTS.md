# Project Guidelines for ChoresRewards

## Architecture & Technology Stack
- **Backend**: Node.js + Express + TypeScript (`server/`).
  - Database: SQLite via `better-sqlite3` (`server/src/db.ts`).
  - Auth: Session-based role auth (`parent`, `child`, `family`) with PIN verification.
  - File Uploads: `multer` (`server/uploads/` mounted to `/static/uploads`).
  - Notifications: Gotify push service (`server/src/services/gotify.ts`).
  - Seasons & Holidays: Anonymous Gregorian Easter calculation & hemisphere date adjustments (`server/src/services/seasons.ts`).
- **Frontend**: React 18 + TypeScript + Vite (`client/`).
  - State & Persistence: Redux Toolkit + RTK Query (`client/src/store/api.ts`) + `redux-persist` (`whitelist: ['ui']`).
  - **Storage Architecture Rule**: Zero direct `localStorage` calls. Device-local UI preferences (`sideNavCollapsed`, `parentManageMode`, `activeTimers`, `activeView`) live in Redux `uiSlice.ts`. Household settings (`global_mute`, `chore_suggestions`) live in SQLite via `/api/prefs`.
  - Audio Engine: Zero-latency procedural Web Audio synthesis (`soundService.ts`) with theme support (Zelda Fantasy, Christmas Bells, Spooky, Zen Chimes, Fanfare) + bundled fallback audio clips.
  - Visuals & Celebrations: Canvas-confetti + custom celebration fireworks.
  - **Code Map Maintenance**: Always consult and keep [CODEMAP.md](file:///d:/projects/choresrewards/CODEMAP.md) updated whenever components, features, or routes are added or refactored.
- **Deployment Targets**: Runs standalone on port `8099` AND inside Home Assistant OS via dynamic Ingress proxy tokens (`/api/hassio_ingress/<token>/`).

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
| **App Bar, Clock, Weather** | `client/src/components/Header.tsx`, `SideNav.tsx` | Open-Meteo API + device clock |
| **Household Settings & Prefs** | `client/src/components/SettingsAndLogsViews.tsx`, `hooks/useSettings.ts` | `server/src/routes/seasonal.ts` (`/api/prefs`), `settings.ts` |

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
    ├── db.ts                         # SQLite schema, tables (person, chore, reward, seasons, seasonal_events, settings)
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
- **Seasons & Events**: Database-backed in SQLite (`seasons` and `seasonal_events` tables).
  - Supports dynamic dates (e.g. Easter calculated via Gregorian algorithm) and fixed holidays (Halloween, Christmas, New Year's) with active celebration windows (typically ±7 days).
  - Hemisphere toggle adjusts meteorological season dates (Southern Hemisphere default: Dec–Feb Summer, Sep–Nov Spring).
- **Sound Themes**: Configurable in Settings (`auto`, `default`, `fantasy` [Zelda-style secret chime], `christmas` [bell chime chords], `spooky` [Halloween theremin arpeggio], `chimes` [zen wind chimes], `fanfare` [royal brass]). Synthesized purely via Web Audio API (zero external assets required).

---

## Plan of Action First
- **Provide a Plan of Action First**: When the user sends a message with feedback or changes without an explicit "go and fix this now" instruction, respond quickly with a clear plan of action detailing how the message was interpreted and the intended implementation steps, so the user can review and confirm before work begins.

## Local Server & Process Lifecycle
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
- **Batch-End Safety Checks Only (Token & Latency Conservation)**:
  - Do NOT run verification audits (`npm run verify`), TypeScript builds (`npm run build`), or test commands between individual incremental edits within a batch.
  - Run verification and build commands **ONLY ONCE at the end of the entire batch** when all planned edits are finished, right before reporting completion to the user.
- **Mandatory Ingress & Environment Portability Audit**:
  - Run `npm run verify` (`node scripts/verify_ingress.js`) before every deploy or commit.
  - Zero tolerance for hardcoded absolute paths (`/static/...` or `/api/...`). All paths must be relative (`./static/...`) or passed through `resolveAssetUrl(url)`.
  - Ensure the client runs seamlessly in standalone mode (direct port `8099`), sub-path proxies, and Home Assistant Ingress dynamic token prefixes (`/api/hassio_ingress/<token>/`).
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

## Component Modularization & Performance Standards
- **Single Component Per File**: Each file should represent a single component or cohesive unit, aiming for < 150–250 lines. Large monolithic files (1,000+ lines) are forbidden.
- **JSX-First Components**: Components should primarily contain JSX rendering and layout. Complex business logic, date calculations, and API orchestration belong in custom hooks, utils, or RTK slices.
- **Dedicated Domain Types**: Never declare large inline TypeScript interfaces inside component files. Place domain interfaces in `client/src/types/<domain>.types.ts` and re-export via `client/src/types.ts`.
- **Pure Rendering & Memoization**: Use `React.memo` on list cards, kanban lanes, and dashboard widgets to eliminate cascading re-renders when parent states update. Use `useMemo` for derived data filters/groupings and `useCallback` for event handlers passed down to child components.
- **Decoupled Local UI State**: Keep navigation (`activeView`), panel toggles, and view options in Redux `uiSlice.ts` to avoid re-rendering unrelated pages.
- **Always Update Code Map**: Whenever files or features are added or rearranged, update [CODEMAP.md](file:///d:/projects/choresrewards/CODEMAP.md).

## Production Resource & Ingress Path Safety (CRITICAL)
- **Home Assistant Ingress Path Routing**: In production, Home Assistant serves the application behind a dynamic path prefix (e.g. `/api/hassio_ingress/<token>/`).
- **NEVER use Absolute Root Paths in the Client**: Absolute paths like `/static/...` or `/api/...` break in production because the browser requests `http://<ha-ip>:8123/static/...` bypassing the Ingress session token completely (yielding 404/401).
- **Mandatory Relative Resolution (`resolveAssetUrl` & `resolveAvatarUrl`)**:
  - Always wrap any static image, uploaded photo, avatar, audio, or resource URL through `resolveAssetUrl(url)` or `resolveAvatarUrl(avatar)`.
  - When declaring stock asset catalogs or audio clip arrays in frontend code, always specify them as `./static/...` (never `/static/...`).
  - Audio playback must pass `resolveAssetUrl(url)` to `new Audio(...)`.
- **Backend Dual-Path Mounting**: The Express server must continue to serve both `/static` and `/api/static`, as well as `/` and `/api`, guaranteeing both direct port 8099 and Ingress reverse-proxy traffic find all files.
- **Automated Verification**: Run `npm run verify` to automatically scan all source files for path violations before building production bundles.
