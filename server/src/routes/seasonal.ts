import { Router, Request, Response } from 'express';
import { eq, sql } from 'drizzle-orm';
import { AppSetting } from '../db';
import { getDb } from '../db/client';
import { seasons as seasonsTable, seasonalEvents as eventsTable } from '../db/schema';
import { requireAdult } from './auth';
import { getActiveSeasonal, SOUND_THEMES } from '../services/seasons';

export const seasonalRouter = Router();

const MD_RE = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** Household-wide preferences that used to live in browser localStorage. */
const HOUSEHOLD_PREF_KEYS = ['global_mute', 'chore_suggestions'] as const;

function readPrefs() {
  const raw = AppSetting.get('chore_suggestions', '[]') || '[]';
  let suggestions: string[] = [];
  try {
    suggestions = JSON.parse(raw);
  } catch {
    suggestions = [];
  }
  return {
    global_mute: AppSetting.get('global_mute', 'false') === 'true',
    chore_suggestions: Array.isArray(suggestions) ? suggestions : [],
  };
}

// --- Seasonal themes -------------------------------------------------------

seasonalRouter.get('/seasonal', async (_req: Request, res: Response) => {
  res.json({ success: true, ...(await getActiveSeasonal()) });
});

seasonalRouter.put('/seasonal/settings', requireAdult, async (req: Request, res: Response) => {
  const { seasonal_themes_enabled, hemisphere, sound_theme, forced_theme, falling_snow_enabled } = req.body || {};
  if (seasonal_themes_enabled !== undefined) {
    await AppSetting.set('seasonal_themes_enabled', String(Boolean(seasonal_themes_enabled)));
  }
  if (falling_snow_enabled !== undefined) {
    await AppSetting.set('falling_snow_enabled', String(Boolean(falling_snow_enabled)));
  }
  if (hemisphere !== undefined) {
    if (hemisphere !== 'south' && hemisphere !== 'north') {
      res.status(400).json({ success: false, error: 'hemisphere must be south or north' });
      return;
    }
    await AppSetting.set('hemisphere', hemisphere);
  }
  if (sound_theme !== undefined) {
    if (!(SOUND_THEMES as readonly string[]).includes(sound_theme)) {
      res.status(400).json({ success: false, error: 'Unknown sound theme' });
      return;
    }
    await AppSetting.set('sound_theme', sound_theme);
  }
  if (forced_theme !== undefined) {
    await AppSetting.set('forced_theme', String(forced_theme || ''));
  }
  res.json({ success: true, ...(await getActiveSeasonal()) });
});

seasonalRouter.put('/seasonal/seasons/:id', requireAdult, async (req: Request, res: Response) => {
  const { enabled, start_md, end_md } = req.body || {};
  if ((start_md && !MD_RE.test(start_md)) || (end_md && !MD_RE.test(end_md))) {
    res.status(400).json({ success: false, error: 'Dates must be MM-DD' });
    return;
  }
  const patch: Record<string, unknown> = {};
  if (enabled !== undefined) patch.enabled = enabled ? 1 : 0;
  if (start_md) patch.startMd = start_md;
  if (end_md) patch.endMd = end_md;
  if (Object.keys(patch).length > 0) {
    await getDb().update(seasonsTable).set(patch).where(eq(seasonsTable.id, Number(req.params.id)));
  }
  res.json({ success: true, ...(await getActiveSeasonal()) });
});

seasonalRouter.put('/seasonal/events/:id', requireAdult, async (req: Request, res: Response) => {
  const { enabled, month_day, days_before, days_after } = req.body || {};
  if (month_day && !MD_RE.test(month_day)) {
    res.status(400).json({ success: false, error: 'Date must be MM-DD' });
    return;
  }
  const clampDays = (v: unknown): number | undefined =>
    v === undefined || v === null ? undefined : Math.max(0, Math.min(14, Math.round(Number(v) || 0)));

  const patch: Record<string, unknown> = {};
  if (enabled !== undefined) patch.enabled = enabled ? 1 : 0;
  if (month_day) {
    // Only fixed-date events carry a month/day; Easter is computed.
    patch.monthDay = sql`CASE WHEN ${eventsTable.ruleType} = 'fixed' THEN ${month_day} ELSE ${eventsTable.monthDay} END`;
  }
  const before = clampDays(days_before);
  if (before !== undefined) patch.daysBefore = before;
  const after = clampDays(days_after);
  if (after !== undefined) patch.daysAfter = after;

  if (Object.keys(patch).length > 0) {
    await getDb().update(eventsTable).set(patch).where(eq(eventsTable.id, Number(req.params.id)));
  }
  res.json({ success: true, ...(await getActiveSeasonal()) });
});

// --- Household preferences (previously localStorage) -----------------------

seasonalRouter.get('/prefs', (_req: Request, res: Response) => {
  res.json({ success: true, prefs: readPrefs() });
});

seasonalRouter.put('/prefs', async (req: Request, res: Response) => {
  const body = req.body || {};
  for (const key of HOUSEHOLD_PREF_KEYS) {
    if (body[key] === undefined) continue;
    if (key === 'chore_suggestions') {
      const list = Array.isArray(body[key]) ? body[key].map((s: unknown) => String(s).slice(0, 80)).slice(0, 200) : [];
      await AppSetting.set(key, JSON.stringify(list));
    } else {
      await AppSetting.set(key, String(Boolean(body[key])));
    }
  }
  res.json({ success: true, prefs: readPrefs() });
});
