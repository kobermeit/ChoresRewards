import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// --- Types -------------------------------------------------------------------

export interface Season {
  id: number;
  key: string;
  name: string;
  enabled: boolean;
  start_md: string;
  end_md: string;
  effective_start_md: string;
  effective_end_md: string;
  emoji: string;
  accent: string;
  sound_key: string | null;
}

export interface SeasonalEvent {
  id: number;
  key: string;
  name: string;
  enabled: boolean;
  rule_type: 'fixed' | 'easter';
  month_day: string | null;
  days_before: number;
  days_after: number;
  emoji: string;
  accent: string;
  sound_key: string | null;
  date: string | null;
  window_start: string | null;
  window_end: string | null;
}

export type SoundTheme = 'auto' | 'default' | 'fantasy' | 'christmas' | 'spooky' | 'chimes' | 'fanfare';

export interface SeasonalSettings {
  seasonal_themes_enabled: boolean;
  hemisphere: 'south' | 'north';
  sound_theme: SoundTheme;
  forced_theme?: string | null;
  falling_snow_enabled?: boolean;
}

export interface SeasonalResponse {
  settings: SeasonalSettings;
  seasons: Season[];
  events: SeasonalEvent[];
  active: { season: Season | null; event: SeasonalEvent | null; today: string };
}

export interface HouseholdPrefs {
  global_mute: boolean;
  chore_suggestions: string[];
}

// --- API ---------------------------------------------------------------------

/**
 * RTK Query API for server-owned data. The base URL is relative ('./api/') so it
 * works standalone, behind sub-path proxies and under Home Assistant Ingress.
 */
export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: './api/', credentials: 'include' }),
  tagTypes: ['Seasonal', 'Prefs'],
  endpoints: (build) => ({
    getSeasonal: build.query<SeasonalResponse, void>({
      query: () => 'seasonal',
      providesTags: ['Seasonal'],
    }),
    updateSeasonalSettings: build.mutation<SeasonalResponse, Partial<SeasonalSettings>>({
      query: (body) => ({ url: 'seasonal/settings', method: 'PUT', body }),
      invalidatesTags: ['Seasonal'],
    }),
    updateSeason: build.mutation<SeasonalResponse, { id: number } & Partial<Pick<Season, 'enabled' | 'start_md' | 'end_md'>>>({
      query: ({ id, ...body }) => ({ url: `seasonal/seasons/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Seasonal'],
    }),
    updateSeasonalEvent: build.mutation<
      SeasonalResponse,
      { id: number } & Partial<Pick<SeasonalEvent, 'enabled' | 'month_day' | 'days_before' | 'days_after'>>
    >({
      query: ({ id, ...body }) => ({ url: `seasonal/events/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Seasonal'],
    }),
    getPrefs: build.query<HouseholdPrefs, void>({
      query: () => 'prefs',
      transformResponse: (res: { prefs: HouseholdPrefs }) => res.prefs,
      providesTags: ['Prefs'],
    }),
    updatePrefs: build.mutation<HouseholdPrefs, Partial<HouseholdPrefs>>({
      query: (body) => ({ url: 'prefs', method: 'PUT', body }),
      transformResponse: (res: { prefs: HouseholdPrefs }) => res.prefs,
      // Optimistic update so toggles (e.g. mute) feel instant
      async onQueryStarted(patch, { dispatch, queryFulfilled }) {
        const result = dispatch(api.util.updateQueryData('getPrefs', undefined, (draft) => Object.assign(draft, patch)));
        try {
          await queryFulfilled;
        } catch {
          result.undo();
        }
      },
      invalidatesTags: ['Prefs'],
    }),
  }),
});

export const {
  useGetSeasonalQuery,
  useUpdateSeasonalSettingsMutation,
  useUpdateSeasonMutation,
  useUpdateSeasonalEventMutation,
  useGetPrefsQuery,
  useUpdatePrefsMutation,
} = api;
