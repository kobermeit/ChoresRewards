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
│   │   │   └── header/         # Weather widget, clock widget, forecast modal
│   │   ├── components/         # Top-level coordinators, legacy backward-compat shims, & shared UI
│   │   │   ├── ui/             # Design system primitives: Button, Card, CardShell, TimerRing, Input, Select, CustomDropdown, Badge
│   │   │   └── common/         # Common dialogs, Modal, ColorPicker
│   │   ├── context/            # Global React contexts (AppContext, TimerContext)
│   │   ├── store/              # Redux Toolkit, RTK Query (api.ts), uiSlice.ts (with redux-persist)
│   │   ├── hooks/              # Custom hooks (useSettings, useNavigation, useBodyScrollLock)
│   │   ├── types/              # Domain TypeScript types (*.types.ts)
│   │   ├── services/           # Procedural Web Audio synthesizer (soundService.ts)
│   │   └── styles/             # Design tokens (tokens.css) & global styles (components.css)
│   └── package.json
├── server/                     # Node.js + Express + TypeScript Backend
│   ├── src/
│   │   ├── db.ts               # SQLite schema, migrations, connection pool (better-sqlite3)
│   │   ├── routes/             # Express API route handlers
│   │   └── services/           # Background services (gotify push, seasons/Easter engine)
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
| **Mobile Navigation & Offline** | `client/src/components/MobileBottomNav.tsx`<br>`client/src/components/MobileDrawer.tsx`<br>`client/src/components/OfflineSyncManager.tsx` | - | Redux `uiSlice.ts` (`offlineQueue`, `mobileDrawerOpen`) |
| **Rewards & Redemption** | `client/src/features/rewards/RewardsSection.tsx`<br>`features/rewards/components/RewardCard.tsx`<br>`features/rewards/components/ClaimRewardModal.tsx` | `components/RewardsSection.tsx` | `/api/rewards` (`server/src/routes/rewards.ts`)<br>Table: `reward` |
| **Family Dashboard** | `client/src/features/dashboard/DashboardSection.tsx`<br>`features/dashboard/widgets/*` (8 memoized widgets) | `components/DashboardSection.tsx` | Aggregated via `/api/data` |
| **Family Calendar** | `client/src/features/calendar/CalendarView.tsx`<br>`features/calendar/components/CalendarMonthView.tsx`<br>`features/calendar/components/CalendarScheduleView.tsx` | `components/CalendarView.tsx` | `/api/sync_calendar`<br>Table: `google_calendar_settings` |
| **Household Notes** | `client/src/features/notes/NotesSection.tsx`<br>`features/notes/components/NoteRowCard.tsx`<br>`features/notes/components/NoteEditModal.tsx` | `components/CalendarAndNotesSection.tsx` | `/api/text_pads`<br>Table: `text_pad` |
| **System Settings** | `client/src/features/settings/*` (12 tabs: General, Family, Chores, Seasonal, Sounds, etc.) | `components/SettingsAndLogsViews.tsx` | `/api/prefs`, `/api/seasonal`, `/api/settings` |
| **Full-Screen Overlays** | `client/src/features/overlays/ScreensaverOverlay.tsx`<br>`features/overlays/VisualTimerModal.tsx`<br>`features/overlays/KidsPlayWidgetModal.tsx`<br>`features/overlays/SyncSplashOverlay.tsx` | `components/Overlays.tsx` | Redux / `TimerRing.tsx` |
| **Header, Weather & Clock** | `client/src/features/header/WeatherWidget.tsx`<br>`features/header/ClockWidget.tsx`<br>`features/header/WeatherForecastModal.tsx` | `components/Header.tsx` | Open-Meteo API + device clock |

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
  - `uiSlice.ts`: Fast local device preferences (`activeView`, `sideNavCollapsed`, `parentManageMode`, `activeTimers`). Changes here do NOT re-render the monolithic app context.
  - `api.ts`: RTK Query for caching and invalidating household preferences and seasonal themes.
- **Context API** (`client/src/context/`):
  - `AppContext.tsx`: Household server payload (`data`), session role gating (`isParent`, `isChild`), toasts, and confirmation dialogs.
  - `TimerContext.tsx`: High-precision choreography timer tick engine synced to Redux storage.
- **Rules**:
  - ZERO direct `localStorage` calls.
  - Keep components pure; memoize cards and kanban lanes with `React.memo`.
  - Use `useMemo` for derived datasets and `useCallback` for stable handlers.
