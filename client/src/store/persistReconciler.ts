/**
 * Level-2 state reconciler for redux-persist (a typed port of its `autoMergeLevel2`,
 * which v6 does not re-export from the package root).
 *
 * Why not the default? redux-persist's `autoMergeLevel1` hard-sets every top-level key
 * from storage. `state.ui` is therefore *replaced* by whatever the device wrote on the
 * day it was last used, so any field added in a later release is `undefined` after
 * rehydrate. That is exactly how `shoppingCheckedOverrides` bricked the app: the reducer
 * ran `Object.keys(undefined)` → "Cannot convert undefined or null to object" on load.
 *
 * Level 2 shallow-merges one level deeper, so stored values win but new defaults survive.
 */
const isPlainObject = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export function mergePersistedDefaults<S>(
  inboundState: any,
  originalState: S,
  reducedState: S,
  _config?: unknown
): S {
  const reduced = (reducedState || {}) as Record<string, any>;
  const original = (originalState || {}) as Record<string, any>;
  const next: Record<string, any> = { ...reduced };
  if (!isPlainObject(inboundState)) return next as S;

  for (const key of Object.keys(inboundState)) {
    if (key === '_persist') continue;
    // If the reducer already touched this slice during boot, its value wins.
    if (original[key] !== reduced[key]) continue;

    next[key] = isPlainObject(reduced[key])
      ? { ...reduced[key], ...(inboundState[key] || {}) }
      : inboundState[key];
  }

  return next as S;
}
