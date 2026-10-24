import { createSlice, PayloadAction } from '@reduxjs/toolkit';

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

export interface UiState {
  sideNavCollapsed: boolean;
  headerMinimized: boolean;
  hideCompletedChores: boolean;
  plannerViewMode: '1week' | '2weeks';
  activePersonId: number | null;
  parentManageMode: boolean;
  activeTimers: Record<number, PersistedChoreTimer>;
}

const initialState: UiState = {
  sideNavCollapsed: false,
  headerMinimized: false,
  hideCompletedChores: false,
  plannerViewMode: '2weeks',
  activePersonId: null,
  parentManageMode: true,
  activeTimers: {},
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setSideNavCollapsed(state, action: PayloadAction<boolean>) {
      state.sideNavCollapsed = action.payload;
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
  },
});

export const {
  setSideNavCollapsed,
  setHeaderMinimized,
  setHideCompletedChores,
  setPlannerViewMode,
  setActivePersonId,
  setParentManageMode,
  setActiveTimers,
} = uiSlice.actions;
export default uiSlice.reducer;
