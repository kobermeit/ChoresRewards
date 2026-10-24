import { Router, Request, Response } from 'express';
import { db, AppSetting } from '../db';
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

seasonalRouter.get('/seasonal', (_req: Request, res: Response) => {
  res.json({ success: true, ...getActiveSeasonal() });
});

seasonalRouter.put('/seasonal/settings', requireAdult, (req: Request, res: Response) => {
  const { seasonal_themes_enabled, hemisphere, sound_theme, forced_theme, falling_snow_enabled } = req.body || {};
  if (seasonal_themes_enabled !== undefined) AppSetting.set('seasonal_themes_enabled', String(Boolean(seasonal_themes_enabled)));
  if (falling_snow_enabled !== undefined) AppSetting.set('falling_snow_enabled', String(Boolean(falling_snow_enabled)));
  if (hemisphere !== undefined) {
    if (hemisphere !== 'south' && hemisphere !== 'north') {
      res.status(400).json({ success: false, error: 'hemisphere must be south or north' });
      return;
    }
    AppSetting.set('hemisphere', hemisphere);
  }
  if (sound_theme !== undefined) {
    if (!(SOUND_THEMES as readonly string[]).includes(sound_theme)) {
      res.status(400).json({ success: false, error: 'Unknown sound theme' });
      return;
    }
    AppSetting.set('sound_theme', sound_theme);
  }
  if (forced_theme !== undefined) {
    AppSetting.set('forced_theme', String(forced_theme || ''));
  }
  res.json({ success: true, ...getActiveSeasonal() });
});

seasonalRouter.put('/seasonal/seasons/:id', requireAdult, (req: Request, res: Response) => {
  const { enabled, start_md, end_md } = req.body || {};
  if ((start_md && !MD_RE.test(start_md)) || (end_md && !MD_RE.test(end_md))) {
    res.status(400).json({ success: false, error: 'Dates must be MM-DD' });
    return;
  }
  db.prepare(
    `UPDATE seasons SET
       enabled = COALESCE(?, enabled),
       start_md = COALESCE(?, start_md),
       end_md = COALESCE(?, end_md)
     WHERE id = ?`
  ).run(enabled === undefined ? null : enabled ? 1 : 0, start_md || null, end_md || null, Number(req.params.id));
  res.json({ success: true, ...getActiveSeasonal() });
});

seasonalRouter.put('/seasonal/events/:id', requireAdult, (req: Request, res: Response) => {
  const { enabled, month_day, days_before, days_after } = req.body || {};
  if (month_day && !MD_RE.test(month_day)) {
    res.status(400).json({ success: false, error: 'Date must be MM-DD' });
    return;
  }
  const clampDays = (v: unknown) => (v === undefined || v === null ? null : Math.max(0, Math.min(14, Math.round(Number(v) || 0))));
  db.prepare(
    `UPDATE seasonal_events SET
       enabled = COALESCE(?, enabled),
       month_day = CASE WHEN rule_type = 'fixed' THEN COALESCE(?, month_day) ELSE month_day END,
       days_before = COALESCE(?, days_before),
       days_after = COALESCE(?, days_after)
     WHERE id = ?`
  ).run(
    enabled === undefined ? null : enabled ? 1 : 0,
    month_day || null,
    clampDays(days_before),
    clampDays(days_after),
    Number(req.params.id)
  );
  res.json({ success: true, ...getActiveSeasonal() });
});

// --- Household preferences (previously localStorage) -----------------------

seasonalRouter.get('/prefs', (_req: Request, res: Response) => {
  res.json({ success: true, prefs: readPrefs() });
});

seasonalRouter.put('/prefs', (req: Request, res: Response) => {
  const body = req.body || {};
  for (const key of HOUSEHOLD_PREF_KEYS) {
    if (body[key] === undefined) continue;
    if (key === 'chore_suggestions') {
      const list = Array.isArray(body[key]) ? body[key].map((s: unknown) => String(s).slice(0, 80)).slice(0, 200) : [];
      AppSetting.set(key, JSON.stringify(list));
    } else {
      AppSetting.set(key, String(Boolean(body[key])));
    }
  }
  res.json({ success: true, prefs: readPrefs() });
});
