import { useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { useGetPrefsQuery, useGetSeasonalQuery, useUpdatePrefsMutation, SoundTheme } from '../store/api';
import { UiState, setSideNavCollapsed, setHeaderMinimized, setHideCompletedChores, setPlannerViewMode, setActivePersonId, setParentManageMode } from '../store/uiSlice';

/** Household preferences stored in the DB (mute, chore suggestions). */
export function useHouseholdPrefs() {
  const { data } = useGetPrefsQuery();
  const [update] = useUpdatePrefsMutation();
  return {
    muted: data?.global_mute ?? false,
    choreSuggestions: data?.chore_suggestions ?? [],
    setMuted: useCallback((v: boolean) => update({ global_mute: v }), [update]),
    setChoreSuggestions: useCallback((v: string[]) => update({ chore_suggestions: v }), [update]),
  };
}

/** Per-device UI preferences (Redux, persisted). */
export function useUiPref<K extends keyof UiState>(key: K): [UiState[K], (v: UiState[K]) => void] {
  const dispatch = useAppDispatch();
  const value = useAppSelector((s) => s.ui[key]);
  const setter = useCallback(
    (v: UiState[K]) => {
      const actions: { [P in keyof UiState]: (v: any) => any } = {
        sideNavCollapsed: setSideNavCollapsed,
        headerMinimized: setHeaderMinimized,
        hideCompletedChores: setHideCompletedChores,
        plannerViewMode: setPlannerViewMode,
        activePersonId: setActivePersonId,
        parentManageMode: setParentManageMode,
      };
      dispatch(actions[key](v));
    },
    [dispatch, key]
  );
  return [value, setter];
}

/** Active season/event (null when seasonal themes are off). Re-checks every hour. */
export function useSeason() {
  const { data } = useGetSeasonalQuery(undefined, { pollingInterval: 60 * 60 * 1000 });
  return useMemo(() => {
    const season = data?.active.season ?? null;
    const event = data?.active.event ?? null;
    // An event (e.g. Halloween) always takes precedence over the base season
    const theme = event ?? season;
    return {
      season,
      event,
      theme,
      enabled: data?.settings.seasonal_themes_enabled ?? false,
      accent: theme?.accent || null,
      emoji: theme?.emoji || null,
    };
  }, [data]);
}

/**
 * Effective sound theme. If the user picked 'auto', the active event's (then season's) sound is used,
 * falling back to the default sounds.
 */
export function useSoundTheme(): { chosen: SoundTheme; effective: Exclude<SoundTheme, 'auto'> } {
  const { data } = useGetSeasonalQuery();
  const chosen = (data?.settings.sound_theme ?? 'auto') as SoundTheme;
  if (chosen !== 'auto') return { chosen, effective: chosen };
  const seasonal = (data?.active.event?.sound_key || data?.active.season?.sound_key) as Exclude<SoundTheme, 'auto'> | null;
  return { chosen, effective: seasonal || 'default' };
}
