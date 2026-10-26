import { createSlice, PayloadAction } from '@reduxjs/toolkit';

/**
 * Single source of truth for "are we talking to Home Assistant right now?".
 *
 * Before this slice existed, two components each tracked connectivity with
 * their own listener sets, which let them disagree and blocked the UI behind a
 * full-screen modal. Runtime only — deliberately NOT persisted (see store/index.ts).
 */
export type ConnectivityStatus = 'online' | 'offline';

export interface ConnectivityState {
  status: ConnectivityStatus;
  consecutiveFailures: number;
  lastOnlineAt: number | null;
  lastFailureAt: number | null;
  /** Server timestamp of the snapshot the service worker replayed while offline. */
  servedFromCacheAt: number | null;
}

const initialState: ConnectivityState = {
  status: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'online',
  consecutiveFailures: 0,
  lastOnlineAt: null,
  lastFailureAt: null,
  servedFromCacheAt: null,
};

const connectivitySlice = createSlice({
  name: 'connectivity',
  initialState,
  reducers: {
    reportNetworkSuccess(state) {
      state.status = 'online';
      state.consecutiveFailures = 0;
      state.lastOnlineAt = Date.now();
      state.servedFromCacheAt = null;
    },
    /** Two consecutive failures => treat as offline (a single slow request is not an outage). */
    reportNetworkFailure(state) {
      state.consecutiveFailures += 1;
      state.lastFailureAt = Date.now();
      if (state.consecutiveFailures >= 2) {
        state.status = 'offline';
      }
    },
    markOffline(state) {
      state.status = 'offline';
    },
    markOnline(state) {
      state.status = 'online';
      state.consecutiveFailures = 0;
      state.lastOnlineAt = Date.now();
    },
    /**
     * The service worker answered a GET from its snapshot cache, which means the
     * live request failed. Keep the UI honest: show as offline, and remember how
     * old the replayed data is so the banner can say "showing data from 3:42 pm".
     */
    markServedFromCache(state, action: PayloadAction<number | null>) {
      state.status = 'offline';
      state.lastFailureAt = Date.now();
      state.servedFromCacheAt = action.payload;
    },
  },
});

export const {
  reportNetworkSuccess,
  reportNetworkFailure,
  markOffline,
  markOnline,
  markServedFromCache,
} = connectivitySlice.actions;

export default connectivitySlice.reducer;
