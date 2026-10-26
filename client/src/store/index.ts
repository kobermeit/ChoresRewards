import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import {
  persistStore,
  persistReducer,
  createMigrate,
  MigrationManifest,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { api } from './api';
import uiReducer, { initialUiState, repairUiState } from './uiSlice';
import connectivityReducer from './connectivitySlice';
import { mergePersistedDefaults } from './persistReconciler';

const rootReducer = combineReducers({
  ui: uiReducer,
  connectivity: connectivityReducer,
  [api.reducerPath]: api.reducer,
});

type RootAppState = ReturnType<typeof rootReducer>;

/**
 * Storage migrations. Bump `version` in the persist config whenever the persisted
 * shape changes, and add the upgrade step here.
 *
 * v2 — repairs device-local `ui` payloads written by older releases. Before the
 * offline work the payload had no `shoppingCheckedOverrides` / `offlineQueue`, so
 * after rehydration those fields were `undefined` and reducers that enumerated
 * them threw "Cannot convert undefined or null to object" — which used to brick
 * the whole app on load (only clearing site storage recovered).
 */
const migrations: MigrationManifest = {
  2: (state: any) => {
    if (!state || typeof state !== 'object') return state;
    const persistedUi = state.ui && typeof state.ui === 'object' ? state.ui : {};
    return { ...state, ui: repairUiState({ ...initialUiState, ...persistedUi }) };
  },
};

/**
 * Only the `ui` slice is persisted. Server data (RTK Query cache) always comes from the API,
 * so the database remains the single source of truth. `connectivity` is runtime-only.
 *
 * `autoMergeLevel2` merges the persisted slice over the current defaults (instead of the
 * default `autoMergeLevel1`, which replaces `state.ui` wholesale and therefore silently
 * drops any field added in a newer release).
 */
const persistedReducer = persistReducer(
  {
    key: 'choresrewards',
    version: 2,
    storage,
    whitelist: ['ui'],
    // Bind the root state type explicitly so the reconciler cannot widen it to `unknown`.
    stateReconciler: mergePersistedDefaults<RootAppState>,
    migrate: createMigrate(migrations, { debug: false }),
  },
  rootReducer
);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefault) =>
    getDefault({
      serializableCheck: { ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER] },
    }).concat(api.middleware),
});

export const persistor = persistStore(store);
setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
