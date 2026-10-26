import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ActiveView } from '../types';

/**
 * Per-device UI preferences. These are intentionally device-local (a wall tablet and a phone
 * can have different layouts), so they live in Redux and are persisted via redux-persist.
 * This is the ONLY state persisted to browser storage.
 */
export interface PersistedChoreTimer {
  choreId: number;
  choreTitle: string;
  assignedName?: string;
  assignedAvatar?: string;
  totalSeconds: number;
  remainingSeconds: number;
  startTime: number;
  endTime: number;
  isRunning: boolean;
  pausedRemaining?: number;
}

export interface QueuedOfflineMutation {
  id: string;
  /** Idempotency key sent as X-Client-Mutation-Id so replays never double-apply. */
  mutationId: string;
  endpoint: string;
  body: any;
  timestamp: number;
}

export interface UiState {
  activeView: ActiveView;
  sideNavCollapsed: boolean;
  mobileDrawerOpen: boolean;
  headerMinimized: boolean;
  hideCompletedChores: boolean;
  plannerViewMode: '1week' | '2weeks';
  activePersonId: number | null;
  parentManageMode: boolean;
  activeTimers: Record<number, PersistedChoreTimer>;
  offlineQueue: QueuedOfflineMutation[];
  /** User collapsed the offline banner down to the compact pill. Reset on reconnect. */
  offlineBannerDismissed: boolean;
  /**
   * Shopping ticks applied locally but not yet confirmed by the server.
   * Persisted so ticks survive tab navigation, reloads and offline restarts.
   */
  shoppingCheckedOverrides: Record<string, boolean>;
}

/** Stable, collision-free idempotency key for an offline-replayable mutation. */
export const generateMutationId = (): string =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

const getInitialActiveView = (): ActiveView => {
  const hash = typeof window !== 'undefined' ? window.location.hash.replace(/^#\/?/, '').toLowerCase() : '';
  if (hash === 'calendar') return 'calendar';
  if (hash === 'chores') return 'chores';
  if (hash === 'rewards') return 'rewards';
  if (hash === 'redeemed') return 'redeemed';
  if (hash === 'meals' || hash === 'meal-planner') return 'meals';
  if (hash === 'shopping' || hash === 'shopping-list') return 'shopping';
  if (hash === 'library' || hash === 'meal-library') return 'library';
  if (hash === 'notes') return 'notes';
  if (hash === 'organise') return 'organise';
  if (hash === 'settings') return 'settings';
  if (hash === 'help') return 'help';
  if (hash === 'activity-log' || hash === 'activity_log') return 'activity_log';
  if (hash === 'chore-history' || hash === 'chore_history') return 'chore_history';
  return 'dashboard';
};

const initialState: UiState = {
  activeView: getInitialActiveView(),
  sideNavCollapsed: false,
  mobileDrawerOpen: false,
  headerMinimized: false,
  hideCompletedChores: false,
  plannerViewMode: '2weeks',
  activePersonId: null,
  parentManageMode: true,
  activeTimers: {},
  offlineQueue: [],
  offlineBannerDismissed: false,
  shoppingCheckedOverrides: {},
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setActiveView(state, action: PayloadAction<ActiveView>) {
      state.activeView = action.payload;
    },
    setSideNavCollapsed(state, action: PayloadAction<boolean>) {
      state.sideNavCollapsed = action.payload;
    },
    setMobileDrawerOpen(state, action: PayloadAction<boolean>) {
      state.mobileDrawerOpen = action.payload;
    },
    toggleMobileDrawer(state) {
      state.mobileDrawerOpen = !state.mobileDrawerOpen;
    },
    setHeaderMinimized(state, action: PayloadAction<boolean>) {
      state.headerMinimized = action.payload;
    },
    setHideCompletedChores(state, action: PayloadAction<boolean>) {
      state.hideCompletedChores = action.payload;
    },
    setPlannerViewMode(state, action: PayloadAction<'1week' | '2weeks'>) {
      state.plannerViewMode = action.payload;
    },
    setActivePersonId(state, action: PayloadAction<number | null>) {
      state.activePersonId = action.payload;
    },
    setParentManageMode(state, action: PayloadAction<boolean>) {
      state.parentManageMode = action.payload;
    },
    setActiveTimers(state, action: PayloadAction<Record<number, PersistedChoreTimer>>) {
      state.activeTimers = action.payload;
    },
    enqueueOfflineMutation(
      state,
      action: PayloadAction<{ endpoint: string; body: any; mutationId?: string }>
    ) {
      const { endpoint, body, mutationId } = action.payload;
      const id = mutationId || generateMutationId();

      // Merge repeated writes for the same shopping item into a single queued call
      // (e.g. a qty edit followed by a tick) instead of replaying them separately.
      if (endpoint === 'update_shopping_item' && body && typeof body.key === 'string') {
        const existing = state.offlineQueue.find(
          (m) => m.endpoint === endpoint && m.body && m.body.key === body.key
        );
        if (existing) {
          existing.body = { ...existing.body, ...body };
          existing.timestamp = Date.now();
          // Fresh idempotency key: the merged payload may contain data the earlier
          // attempt never sent, so it must not be swallowed by the dedupe ledger.
          existing.id = id;
          existing.mutationId = id;
          return;
        }
      }

      state.offlineQueue.push({ id, mutationId: id, endpoint, body, timestamp: Date.now() });
    },
    dequeueOfflineMutation(state, action: PayloadAction<string>) {
      state.offlineQueue = state.offlineQueue.filter((m) => m.id !== action.payload);
    },
    clearOfflineQueue(state) {
      state.offlineQueue = [];
    },
    setOfflineBannerDismissed(state, action: PayloadAction<boolean>) {
      state.offlineBannerDismissed = action.payload;
    },
    setShoppingCheckedOverride(state, action: PayloadAction<{ key: string; checked: boolean }>) {
      state.shoppingCheckedOverrides[action.payload.key] = action.payload.checked;
    },
    clearShoppingCheckedOverride(state, action: PayloadAction<string>) {
      delete state.shoppingCheckedOverrides[action.payload];
    },
    /** Drop local overrides the server now agrees with (they are no longer pending). */
    pruneShoppingCheckedOverrides(state, action: PayloadAction<Record<string, boolean> | undefined>) {
      const serverChecked = action.payload || {};
      for (const key of Object.keys(state.shoppingCheckedOverrides)) {
        if (serverChecked[key] === state.shoppingCheckedOverrides[key]) {
          delete state.shoppingCheckedOverrides[key];
        }
      }
    },
  },
});

export const {
  setActiveView,
  setSideNavCollapsed,
  setMobileDrawerOpen,
  toggleMobileDrawer,
  setHeaderMinimized,
  setHideCompletedChores,
  setPlannerViewMode,
  setActivePersonId,
  setParentManageMode,
  setActiveTimers,
  enqueueOfflineMutation,
  dequeueOfflineMutation,
  clearOfflineQueue,
  setOfflineBannerDismissed,
  setShoppingCheckedOverride,
  clearShoppingCheckedOverride,
  pruneShoppingCheckedOverrides,
} = uiSlice.actions;
export default uiSlice.reducer;
