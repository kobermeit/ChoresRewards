# ChoresRewards Codebase Index & Map (CODEMAP)

*A rapid architectural lookup and feature index designed for fast navigation, vibe coding, and agent comprehension. Keep this map updated whenever modules are added, refactored, or rearranged.*

---

## 1. Directory Structure Overview

```
choresrewards/
├── client/                     # React 18 + Vite + TypeScript Frontend
│   ├── src/
│   │   ├── features/           # Domain feature modules (Pure UI, hooks, subcomponents)
│   │   │   ├── chores/         # Chores kanban, cards, timer reverse face, celebrations
│   │   │   ├── meals/          # 1/2-week meal planner, recipe cards, view/edit modals
│   │   │   ├── shopping/       # Store columns, quick add, history, suggestions
│   │   │   ├── rewards/        # Reward cards, claim modal, edit modal, redeemed pool
│   │   │   ├── dashboard/      # Family stats, visual timer widget, quick shortcuts, mini widgets
│   │   │   ├── calendar/       # Month grid, upcoming schedule view, event modal
│   │   │   ├── notes/          # Rich text sticky notes, Reddit-style note feed, view/edit modal
│   │   │   ├── settings/       # Settings tabs (General, Family, Chores, Seasonal, Sounds, etc.)
│   │   │   ├── overlays/       # Screensaver ambient clock, visual timer modal, kids play games, sync splash
│   │   │   ├── offline/        # Connectivity monitor (wake/reconnect probe) + non-blocking offline banner
│   │   │   └── header/         # Weather widget, clock widget, forecast modal
│   │   ├── components/         # Top-level coordinators, legacy backward-compat shims, & shared UI
│   │   │   ├── ui/             # Design system primitives: Button, Card, CardShell, TimerRing, Input, Select, AssigneeSelect, CustomDropdown, Badge
│   │   │   └── common/         # Common dialogs, Modal, ColorPicker
│   │   ├── context/            # Global React contexts (AppContext, TimerContext)
│   │   ├── store/              # Redux Toolkit, RTK Query (api.ts), uiSlice.ts (redux-persist), connectivitySlice.ts (runtime)
│   │   ├── hooks/              # Custom hooks (useSettings, useNavigation, useBodyScrollLock)
│   │   ├── types/              # Domain TypeScript types (*.types.ts)
│   │   ├── services/           # Web Audio synth (soundService.ts), service worker registration (serviceWorker.ts)
│   │   └── styles/             # Design tokens (tokens.css) & global styles (components.css)
│   ├── public/                 # Copied verbatim into dist: sw.js (offline shell/snapshot cache), manifest.json
│   └── package.json
├── server/                     # Node.js + Express + TypeScript Backend
│   ├── src/
│   │   ├── db.ts               # SQLite schema, migrations, connection pool (better-sqlite3)
│   │   ├── routes/             # Express API route handlers (health.ts = /api/ping probe)
│   │   └── services/           # Background services (gotify push, seasons/Easter engine, scraper, mutationDedupe)
│   └── package.json
├── config.yaml                 # Home Assistant Add-On manifest (CRITICAL: version must match package.json)
├── AGENTS.md                   # Agent working memory, rules, and development guidelines
├── DESIGN_SYSTEM.md            # Tokens, UI primitives, and styling constraints
└── CODEMAP.md                  # This file
```

---

## 2. Feature & File Registry

| User Feature / Page | Primary Frontend Feature Module | Compatibility Shim | Backend Route / Database |
| :--- | :--- | :--- | :--- |
| **Chores Kanban & Cards** | `client/src/features/chores/ChoresKanbanSection.tsx`<br>`features/chores/components/ChoreCard.tsx`<br>`features/chores/components/ChoreKanbanColumn.tsx`<br>`features/chores/components/ChoreCelebrationModal.tsx` | `components/ChoresKanbanSection.tsx` | `/api/chores` (`server/src/routes/chores.ts`)<br>Table: `chore` |
| **Chore Timer (Card Reverse)** | `client/src/components/ChoreTimerCardBack.tsx` | - | `client/src/context/TimerContext.tsx` |
| **Add / Edit Chore Modal** | `client/src/components/ChoreModal.tsx` | - | `/api/add_chore`, `/api/update_chore` |
| **Meal Planner & Recipes** | `client/src/features/meals/MealPlannerSection.tsx`<br>`features/meals/RecipeLibrarySection.tsx`<br>`features/meals/components/MealDayColumn.tsx`<br>`features/meals/components/RecipeCard.tsx` | `components/MealAndShoppingSection.tsx` | `/api/meals` (`server/src/routes/meals.ts`)<br>Tables: `meal_plan`, `recipe` |
| **Smart Shopping List** | `client/src/features/shopping/ShoppingListSection.tsx`<br>`features/shopping/components/ShoppingStoreLane.tsx`<br>`features/shopping/components/ShoppingHistoryModal.tsx`<br>`features/shopping/components/ManageCatalogModal.tsx`<br>`features/shopping/components/LaneQuickAddDropdown.tsx` | `components/MealAndShoppingSection.tsx` | `/api/shopping`, `/api/shopping/catalog/delete`<br>Tables: `shopping_catalog`, `shopping_purchase_log` |
| **Mobile Navigation** | `client/src/components/MobileBottomNav.tsx`<br>`client/src/components/MobileDrawer.tsx` | - | Redux `uiSlice.ts` (`mobileDrawerOpen`) |
| **Offline Mode, Reconnect & PWA** | `client/src/features/offline/ConnectivityMonitor.tsx` (wake / visibility / backoff probe, ingress-token reload)<br>`client/src/features/offline/OfflineStatusBanner.tsx` (non-blocking banner + dismissable pill)<br>`client/src/components/OfflineSyncManager.tsx` (headless replay engine)<br>`client/public/sw.js` (app-shell + bootstrap snapshot cache)<br>`client/public/manifest.json`<br>`client/src/services/serviceWorker.ts` | - | `/api/ping` (`server/src/routes/health.ts`)<br>Replay dedupe: `server/src/services/mutationDedupe.ts` — table `applied_mutation`<br>Client state: `connectivitySlice.ts` + `uiSlice.ts` (`offlineQueue`, `shoppingCheckedOverrides`, `offlineBannerDismissed`) |
| **Rewards & Redemption** | `client/src/features/rewards/RewardsSection.tsx`<br>`features/rewards/components/RewardCard.tsx`<br>`features/rewards/components/RewardEditModal.tsx`<br>`features/rewards/components/ClaimRewardModal.tsx` | `components/RewardsSection.tsx` | `/api/rewards`, `/api/rewards/import_url`, `/api/rewards/sync_reward`<br>Daily price sync cron (`server/src/routes/rewards.ts`)<br>Table: `reward` |
| **Family Dashboard** | `client/src/features/dashboard/DashboardSection.tsx`<br>`features/dashboard/widgets/*` (8 memoized widgets) | `components/DashboardSection.tsx` | Aggregated via `/api/data` |
| **Family Calendar** | `client/src/features/calendar/CalendarView.tsx`<br>`features/calendar/components/CalendarMonthView.tsx`<br>`features/calendar/components/CalendarScheduleView.tsx` | `components/CalendarView.tsx` | `/api/sync_calendar`<br>Table: `google_calendar_settings` |
| **Household Notes** | `client/src/features/notes/NotesSection.tsx`<br>`features/notes/components/NoteRowCard.tsx`<br>`features/notes/components/NoteEditModal.tsx` | `components/CalendarAndNotesSection.tsx` | `/api/text_pads`<br>Table: `text_pad` |
| **System Settings** | `client/src/features/settings/*` (12 tabs: General, Family, Chores, Seasonal, Sounds, etc.) | `components/SettingsAndLogsViews.tsx` | `/api/prefs`, `/api/seasonal`, `/api/settings` |
| **Full-Screen Overlays** | `client/src/features/overlays/ScreensaverOverlay.tsx`<br>`features/overlays/VisualTimerModal.tsx`<br>`features/overlays/KidsPlayWidgetModal.tsx`<br>`features/overlays/SyncSplashOverlay.tsx` | `components/Overlays.tsx` | Redux / `TimerRing.tsx` |
| **Header, Weather & Clock** | `client/src/features/header/WeatherWidget.tsx`<br>`features/header/ClockWidget.tsx`<br>`features/header/WeatherForecastModal.tsx` | `components/Header.tsx` | Open-Meteo API + device clock |
| **Notification Bell (Alerts)** | `client/src/components/Header.tsx` (`header-notif-*`, mark read / dismiss; panel is a direct child of `.header-nav-actions` so the tablet burger menu can open it at 769–1400px) | - | `/api/notifications`, `/api/notifications/mark_read`, `/api/notifications/delete` (`server/src/routes/organise.ts`)<br>Table: `notifications` (`dedupe_key`, `read_at`, `dismissed_at`) |

---

## 3. Types Registry (`client/src/types/`)

All domain types are cleanly separated:
- `chore.types.ts`: `Chore`, `ChoreCelebration`, `ChoreDayTag`, `ChoreLogEntry`
- `reward.types.ts`: `Reward`, `RedeemedReward`
- `meal.types.ts`: `MealPlan`, `Recipe`, `MealType`
- `shopping.types.ts`: `ShoppingItem`, `ShoppingStore`
- `user.types.ts`: `Person`, `UserRole`, `ParentPinAuth`
- `calendar.types.ts`: `CalendarEvent`, `CalendarMonthCell`
- `notes.types.ts`: `NoteItem`, `KanbanNote`, `DashboardStickyNote`
- `navigation.types.ts`: `ViewMode`, `AppTab`
- `bootstrap.types.ts`: `AppData`, `HouseholdConfig`, `FamilySummary`

---

## 4. State Management Architecture

- **Redux Toolkit & Persistence** (`client/src/store/`):
  - `uiSlice.ts`: Fast local device preferences (`activeView`, `sideNavCollapsed`, `parentManageMode`, `activeTimers`). Also owns the persisted `offlineQueue` (each entry carries a `mutationId` idempotency key) and `shoppingCheckedOverrides` (ticks that survive navigation / reload / offline). Changes here do NOT re-render the monolithic app context.
  - `connectivitySlice.ts`: Runtime-only (never persisted) connectivity truth (`status`, failure count, cached-snapshot timestamp) shared by the banner, sync manager and probe.
  - `api.ts`: RTK Query for caching and invalidating household preferences and seasonal themes.
  - `persistReconciler.ts`: Typed `mergePersistedDefaults` reconciler (equivalent of `autoMergeLevel2`) used as the redux-persist `stateReconciler`. Deep-merges the persisted payload over `initialUiState` so slices shipped after a device last saved its state cannot arrive as `undefined`. Bump `persistConfig.version` + add a `createMigrate` step whenever the persisted shape changes.
  - **Persistence guard rails**: every `uiSlice` reducer that touches a record/array runs through `repairUiState()`; `initialUiState` and `UI_VIEWS` are exported for migration/reconciliation; an unknown persisted `activeView` falls back to a valid view instead of rendering nothing.
- **Resilience & Recovery** (`client/src/services/`):
  - `deviceReset.ts`: `clearDeviceCache()` / `resetDeviceAndReload()` — removes only app-local storage (`persist:choresrewards`, `cr:`, `cr-`) and `cr-` service-worker caches. Never blanket-clears localStorage (HA Ingress shares the origin with `hassTokens`/Lovelace).
  - `globalErrorLog.ts`: `installGlobalErrorHandlers()` (window `error` + `unhandledrejection`), `recordLastError()`, `readLastError()`, `clearLastError()` on the `cr:lastError` key, surfaced by `ErrorBoundary`'s "Technical details".
  - `components/common/ErrorBoundary.tsx`: two levels — `level="section"` (per-view, keeps shell/nav alive) and root (full-screen fallback with Try Again / Reload Page / Clear device cache & reload).
  - `client/src/api.ts`: fetch wrapper — dispatches connectivity results, attaches `X-Client-Mutation-Id`, suppresses duplicate offline toasts, and detects service-worker cache replays (`X-CR-From-Cache`).
- **Context API** (`client/src/context/`):
  - `AppContext.tsx`: Household server payload (`data`), session role gating (`isParent`, `isChild`), toasts, and confirmation dialogs.
  - `TimerContext.tsx`: High-precision choreography timer tick engine synced to Redux storage.
- **Backend Session Persistence** (`server/src/services/sessionStore.ts`):
  - `SqliteSessionStore`: Custom SQLite-persisted session store (`session_store` table). Ensures parent unlock sessions survive backend restarts, reloads, and multi-device sync without dropping back to kiosk mode.
- **Rules**:
  - ZERO direct `localStorage` calls.
  - Mobile Navigation: Thumb-reachable bottom bar (`[ Today | Chores | Rewards | Shopping | ☰ Menu ]`) opens unified `MobileDrawer` containing primary/secondary navigation, quick tools (Timer, Clock, Sound), and active profile card with switcher.
  - Keep components pure; memoize cards and kanban lanes with `React.memo`.
  - Use `useMemo` for derived datasets and `useCallback` for stable handlers.
