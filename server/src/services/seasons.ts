import { db, AppSetting } from '../db';
import { getFamilyToday } from '../utils/time';

export interface SeasonRow {
  id: number;
  key: string;
  name: string;
  enabled: number;
  start_md: string;
  end_md: string;
  emoji: string;
  accent: string;
  sound_key: string | null;
}

export interface SeasonalEventRow {
  id: number;
  key: string;
  name: string;
  enabled: number;
  rule_type: 'fixed' | 'easter';
  month_day: string | null;
  days_before: number;
  days_after: number;
  emoji: string;
  accent: string;
  sound_key: string | null;
}

export type Hemisphere = 'south' | 'north';
export const SOUND_THEMES = ['auto', 'default', 'fantasy', 'christmas', 'spooky', 'chimes', 'fanfare'] as const;

/** Anonymous Gregorian algorithm (Meeus/Jones/Butcher) for Easter Sunday. */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const toUtc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const DAY = 86400000;

/** Shift a MM-DD by six months (used for northern hemisphere seasons). */
function shiftMd(md: string): string {
  const m = ((+md.slice(0, 2) + 5) % 12) + 1;
  // Clamp to the last valid day of the shifted month (e.g. 08-31 -> 02-29)
  const maxDay = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  return `${String(m).padStart(2, '0')}-${String(Math.min(+md.slice(3, 5), maxDay)).padStart(2, '0')}`;
}

/** True when MM-DD `md` falls in the (possibly year-wrapping) range start..end inclusive. */
function mdInRange(md: string, start: string, end: string): boolean {
  return start <= end ? md >= start && md <= end : md >= start || md <= end;
}

/** Event date for the year closest to `today`, so windows spanning New Year work. */
function eventDateNear(ev: SeasonalEventRow, todayIso: string): string | null {
  const y = +todayIso.slice(0, 4);
  const candidates = [y - 1, y, y + 1].map((yr) =>
    ev.rule_type === 'easter' ? easterSunday(yr) : ev.month_day ? `${yr}-${ev.month_day}` : null
  ).filter(Boolean) as string[];
  if (!candidates.length) return null;
  const t = toUtc(todayIso);
  return candidates.sort((a, b) => Math.abs(toUtc(a) - t) - Math.abs(toUtc(b) - t))[0];
}

export function getSeasonalSettings() {
  return {
    seasonal_themes_enabled: AppSetting.get('seasonal_themes_enabled', 'true') === 'true',
    hemisphere: (AppSetting.get('hemisphere', 'south') === 'north' ? 'north' : 'south') as Hemisphere,
    sound_theme: AppSetting.get('sound_theme', 'auto') || 'auto',
  };
}

export function listSeasons(hemisphere: Hemisphere) {
  const rows = db.prepare('SELECT * FROM seasons ORDER BY id').all() as SeasonRow[];
  return rows.map((r) => ({
    ...r,
    enabled: Boolean(r.enabled),
    // Effective dates for the configured hemisphere (stored values are southern)
    effective_start_md: hemisphere === 'north' ? shiftMd(r.start_md) : r.start_md,
    effective_end_md: hemisphere === 'north' ? shiftMd(r.end_md) : r.end_md,
  }));
}

export function listEvents(todayIso = getFamilyToday()) {
  const rows = db.prepare('SELECT * FROM seasonal_events ORDER BY id').all() as SeasonalEventRow[];
  return rows.map((r) => {
    const date = eventDateNear(r, todayIso);
    return {
      ...r,
      enabled: Boolean(r.enabled),
      date,
      window_start: date ? new Date(toUtc(date) - r.days_before * DAY).toISOString().slice(0, 10) : null,
      window_end: date ? new Date(toUtc(date) + r.days_after * DAY).toISOString().slice(0, 10) : null,
    };
  });
}

/** Resolve the currently active season + event (respecting enabled flags and the global toggle). */
export function getActiveSeasonal(todayIso = getFamilyToday()) {
  const settings = getSeasonalSettings();
  const seasons = listSeasons(settings.hemisphere);
  const events = listEvents(todayIso);
  if (!settings.seasonal_themes_enabled) return { settings, seasons, events, active: { season: null, event: null, today: todayIso } };

  const md = todayIso.slice(5, 10);
  const season = seasons.find((s) => s.enabled && mdInRange(md, s.effective_start_md, s.effective_end_md)) || null;
  const event = events.find((e) => e.enabled && e.window_start && e.window_end && todayIso >= e.window_start && todayIso <= e.window_end) || null;
  return { settings, seasons, events, active: { season, event, today: todayIso } };
}
