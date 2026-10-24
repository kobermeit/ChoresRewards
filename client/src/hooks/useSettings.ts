import { useCallback, useMemo, useEffect } from 'react';
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
  const result = useMemo(() => {
    const season = data?.active.season ?? null;
    const event = data?.active.event ?? null;
    // An event (e.g. Halloween) always takes precedence over the base season
    const theme = event ?? season;
    const enabled = data?.settings.seasonal_themes_enabled ?? false;
    const accent = enabled && theme?.accent ? theme.accent : null;
    const emoji = enabled && theme?.emoji ? theme.emoji : null;

    let greetingSuffix = '';
    if (enabled && event) {
      if (event.key === 'halloween') greetingSuffix = '🎃 Spooky Season!';
      else if (event.key === 'christmas') greetingSuffix = '🎄 Merry Christmas & Happy Holidays!';
      else if (event.key === 'easter') greetingSuffix = '🐰 Happy Easter!';
      else if (event.key === 'new_year') greetingSuffix = '🎆 Happy New Year!';
    } else if (enabled && season) {
      if (season.key === 'spring') greetingSuffix = '🌸 Springtime!';
      else if (season.key === 'summer') greetingSuffix = '☀️ Summer vibes!';
      else if (season.key === 'autumn') greetingSuffix = '🍂 Cozy Autumn!';
      else if (season.key === 'winter') greetingSuffix = '❄️ Crisp Winter!';
    }

    return {
      season,
      event,
      theme: enabled ? theme : null,
      enabled,
      accent,
      emoji,
      greetingSuffix,
      forcedTheme: data?.settings.forced_theme || null,
    };
  }, [data]);

  useEffect(() => {
    if (result.accent) {
      document.documentElement.style.setProperty('--cr-season-accent', result.accent);
    } else {
      document.documentElement.style.removeProperty('--cr-season-accent');
    }
  }, [result.accent]);

  return result;
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
