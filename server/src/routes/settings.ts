import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db, AppSetting, logActivity, roundPoints } from '../db';
import { DATA_DIR, STATIC_DIR, UPLOADS_DIR } from '../config';
import { requireAdult, checkPinHash, hashPin } from './auth';
import { getFamilyToday, getLocalNowNaive, getAppTimezone, addDays } from '../utils/time';
import {
  getExtraChores,
  saveExtraChores,
  normaliseExtraChore,
  loadQuizQuestions,
  saveQuizQuestions,
} from '../services/chores';
import {
  getGoogleCalendarData,
  getServiceAccountEmail,
  getServiceAccountPath,
  isGoogleCalendarFeatureEnabled,
  invalidateGcalCache,
} from '../services/googleCalendar';
import { sendGotifyNotification } from '../services/gotify';

const SOUND_EXTENSIONS = ['.mp3', '.wav', '.ogg'];
const HIDDEN_SOUNDS_PATH = path.join(DATA_DIR, 'hidden_sounds.json');
const SCREENSAVER_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.mov', '.m4v', '.ogv'];

const soundUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, path.join(UPLOADS_DIR, 'sounds'));
    },
    filename: (_req, file, cb) => {
      const safe = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, safe);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const screensaverUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, path.join(UPLOADS_DIR, 'screensaver'));
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `ss_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}${ext}`);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
});

const gcalSaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

const formParser = multer();

function loadHiddenSounds(): Set<string> {
  if (!fs.existsSync(HIDDEN_SOUNDS_PATH)) return new Set();
  try {
    const arr = JSON.parse(fs.readFileSync(HIDDEN_SOUNDS_PATH, 'utf-8'));
    if (Array.isArray(arr)) return new Set(arr.map((s) => path.basename(String(s))));
  } catch {
    // ignore
  }
  return new Set();
}

function saveHiddenSounds(set: Set<string>): void {
  fs.writeFileSync(HIDDEN_SOUNDS_PATH, JSON.stringify([...set].sort()), 'utf-8');
}

export function listSoundEntries(): Array<{ name: string; url: string; custom: boolean }> {
  const hidden = loadHiddenSounds();
  const entries = new Map<string, { name: string; url: string; custom: boolean }>();

  const bundledDir = path.join(STATIC_DIR, 'sounds');
  if (fs.existsSync(bundledDir)) {
    for (const f of fs.readdirSync(bundledDir)) {
      if (SOUND_EXTENSIONS.includes(path.extname(f).toLowerCase()) && !hidden.has(f)) {
        entries.set(f, {
          name: f,
          url: `/static/sounds/${encodeURIComponent(f)}`,
          custom: false,
        });
      }
    }
  }

  const customDir = path.join(UPLOADS_DIR, 'sounds');
  if (fs.existsSync(customDir)) {
    for (const f of fs.readdirSync(customDir)) {
      if (SOUND_EXTENSIONS.includes(path.extname(f).toLowerCase())) {
        entries.set(f, {
          name: f,
          url: `/static/uploads/sounds/${encodeURIComponent(f)}`,
          custom: true,
        });
      }
    }
  }

  return [...entries.values()].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
}

function getScreensaverPhotosRaw(): Array<{ filename: string; uploaded_at?: number }> {
  const raw = AppSetting.get('screensaver_photos_json', '[]') || '[]';
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveScreensaverPhotosRaw(list: Array<{ filename: string; uploaded_at?: number }>): void {
  AppSetting.set('screensaver_photos_json', JSON.stringify(list));
}

export function syncScreensaverPhotos(): Array<{ filename: string; uploaded_at?: number }> {
  const folder = path.join(UPLOADS_DIR, 'screensaver');
  fs.mkdirSync(folder, { recursive: true });
  const existing = getScreensaverPhotosRaw();
  const kept: Array<{ filename: string; uploaded_at?: number }> = [];
  const seen = new Set<string>();

  for (const item of existing) {
    const fn = item?.filename ? path.basename(item.filename) : '';
    if (!fn || seen.has(fn)) continue;
    if (fs.existsSync(path.join(folder, fn))) {
      kept.push({ filename: fn, uploaded_at: item.uploaded_at || Math.floor(Date.now() / 1000) });
      seen.add(fn);
    }
  }

  for (const f of fs.readdirSync(folder)) {
    const ext = path.extname(f).toLowerCase();
    if (!SCREENSAVER_EXTENSIONS.includes(ext)) continue;
    if (!seen.has(f)) {
      kept.push({ filename: f, uploaded_at: Math.floor(Date.now() / 1000) });
      seen.add(f);
    }
  }

  saveScreensaverPhotosRaw(kept);
  return kept;
}

function screensaverPhotoUrls(list: Array<{ filename: string; uploaded_at?: number }>): string[] {
  return list.map((p) => `/static/uploads/screensaver/${encodeURIComponent(p.filename)}?v=${p.uploaded_at || 1}`);
}

export const settingsRouter = Router();

settingsRouter.get('/api/settings', (_req: Request, res: Response) => {
  const family = (db.prepare('SELECT * FROM person ORDER BY "order", id').all() as Array<any>).map((p) => ({
    id: p.id,
    name: p.name,
    points: roundPoints(p.points),
    bonus_points: roundPoints(p.bonus_points),
    avatar: p.avatar || 'default_avatar.png',
    color: p.color || '#ffffff',
    order: p.order || 0,
    is_admin: Boolean(p.is_admin),
    has_pin: Boolean(p.pin),
    age: p.age ?? null,
  }));

  const allChores = db.prepare('SELECT * FROM chore WHERE deleted = 0 ORDER BY id DESC').all() as Array<any>;

  res.json({
    success: true,
    reward_system: AppSetting.getRewardSystem(),
    master_pin_set: Boolean(AppSetting.get('master_pin')),
    bonus_mode: AppSetting.get('bonus_mode', 'static') || 'static',
    bonus_static: AppSetting.get('bonus_static', '10') || '10',
    bonus_min: AppSetting.get('bonus_min', '2') || '2',
    bonus_max: AppSetting.get('bonus_max', '8') || '8',
    bonus_once_per_day: (AppSetting.get('bonus_once_per_day', 'true') || 'true').toLowerCase() === 'true',
    quiz_questions_enabled: (AppSetting.get('quiz_questions_enabled', 'true') || 'true').toLowerCase() === 'true',
    timezone: AppSetting.get('timezone', process.env.TZ || 'UTC') || 'UTC',
    gotify_url: AppSetting.get('gotify_url', '') || '',
    gotify_token: AppSetting.get('gotify_token', '') || '',
    gotify_notify_people: (AppSetting.get('gotify_notify_people', '') || '').split(',').filter(Boolean),
    gotify_notify_chores_completed: AppSetting.get('gotify_notify_chores_completed', 'false') === 'true',
    gotify_notify_due_chores_expired: AppSetting.get('gotify_notify_due_chores_expired', 'false') === 'true',
    gotify_notify_rewards_added: AppSetting.get('gotify_notify_rewards_added', 'false') === 'true',
    gotify_notify_rewards_redeemed: AppSetting.get('gotify_notify_rewards_redeemed', 'false') === 'true',
    google_calendar_feature_enabled: isGoogleCalendarFeatureEnabled(),
    google_calendar_enabled: (AppSetting.get('google_calendar_enabled', 'false') || 'false').toLowerCase() === 'true',
    google_calendar_api_key: AppSetting.get('google_calendar_api_key', '') || '',
    google_calendar_id: AppSetting.get('google_calendar_id', '') || '',
    google_calendar_color_rules: AppSetting.get('google_calendar_color_rules', '') || '',
    google_calendar_max_results: Number(AppSetting.get('google_calendar_max_results', '20') || 20),
    google_calendar_days_ahead: Number(AppSetting.get('google_calendar_days_ahead', '14') || 14),
    google_calendar_refresh_minutes: Number(AppSetting.get('google_calendar_refresh_minutes', '15') || 15),
    gcal_sa_email: getServiceAccountEmail(),
    family,
    chores: allChores.map((c) => ({
      ...c,
      completed: Boolean(c.completed),
      is_daily: Boolean(c.is_daily),
      deleted: Boolean(c.deleted),
      is_extra: Boolean(c.is_extra),
    })),
    quiz_questions: loadQuizQuestions(),
    extra_chores: getExtraChores(),
  });
});

function handleSettingsPost(req: Request, res: Response) {
  try {
    const data = req.body || {};

    if (data.action === 'toggle_admin') {
      const personId = Number(data.person_id);
      const isAdmin = Boolean(data.is_admin);
      db.prepare('UPDATE person SET is_admin = ? WHERE id = ?').run(isAdmin ? 1 : 0, personId);
      res.json({ success: true, message: 'Admin status updated' });
      return;
    }

    if (data.action === 'set_person_pin' || 'set_person_pin' in data) {
      const personId = Number(data.person_id);
      const rawPin = String(data.new_pin ?? data.pin ?? '').trim();
      if (!/^\d{4}$/.test(rawPin)) {
        res.status(400).json({ success: false, error: 'PIN must be exactly 4 digits' });
        return;
      }
      const hashed = hashPin(rawPin);
      db.prepare('UPDATE person SET pin = ? WHERE id = ?').run(hashed, personId);
      res.json({ success: true, message: 'Personal PIN updated' });
      return;
    }

    if ('reward_system' in data) {
      AppSetting.setRewardSystem(String(data.reward_system));
      logActivity('settings_updated', `Reward system changed to ${data.reward_system}`);
    }

    if ('bonus_mode' in data) {
      AppSetting.set('bonus_mode', String(data.bonus_mode || 'static'));
      if (data.bonus_static !== undefined) AppSetting.set('bonus_static', String(data.bonus_static));
      if (data.bonus_min !== undefined) AppSetting.set('bonus_min', String(data.bonus_min));
      if (data.bonus_max !== undefined) AppSetting.set('bonus_max', String(data.bonus_max));
      const once =
        data.bonus_once_per_day === true ||
        data.bonus_once_per_day === 'true' ||
        data.bonus_once_per_day === 'on' ||
        data.bonus_once_per_day === '1';
      AppSetting.set('bonus_once_per_day', once ? 'true' : 'false');
      const quizEnabled =
        data.quiz_questions_enabled === true ||
        data.quiz_questions_enabled === 'true' ||
        data.quiz_questions_enabled === 'on' ||
        data.quiz_questions_enabled === '1';
      AppSetting.set('quiz_questions_enabled', quizEnabled ? 'true' : 'false');
      logActivity('settings_updated', 'Bonus settings updated');
    }

    if ('set_master_pin' in data) {
      const newPin = String(data.new_pin || '').trim();
      if (!/^\d{4}$/.test(newPin)) {
        res.status(400).json({ success: false, error: 'Master PIN must be 4 digits' });
        return;
      }
      AppSetting.set('master_pin', hashPin(newPin));
      logActivity('settings_updated', 'Master PIN set');
    }

    if ('change_pin' in data) {
      const currentPin = String(data.current_pin || '').trim();
      const newPin = String(data.new_pin || '').trim();
      const masterHash = AppSetting.get('master_pin');
      if (masterHash && !checkPinHash(currentPin, masterHash)) {
        res.status(400).json({ success: false, error: 'Current PIN is incorrect' });
        return;
      }
      if (!/^\d{4}$/.test(newPin)) {
        res.status(400).json({ success: false, error: 'New PIN must be 4 digits' });
        return;
      }
      AppSetting.set('master_pin', hashPin(newPin));
      logActivity('settings_updated', 'Master PIN changed');
    }

    if ('timezone' in data && !('bonus_mode' in data)) {
      AppSetting.set('timezone', String(data.timezone || 'UTC').trim());
      logActivity('settings_updated', `Timezone updated to ${data.timezone}`);
    }

    if ('google_calendar_settings' in data) {
      const gcalEnabled =
        data.google_calendar_enabled === true ||
        data.google_calendar_enabled === 'true' ||
        data.google_calendar_enabled === 'on';
      AppSetting.set('google_calendar_enabled', gcalEnabled ? 'true' : 'false');
      if (data.google_calendar_api_key !== undefined) {
        AppSetting.set('google_calendar_api_key', String(data.google_calendar_api_key).trim());
      }
      if (data.google_calendar_id !== undefined) {
        AppSetting.set('google_calendar_id', String(data.google_calendar_id).trim());
      }
      if (data.google_calendar_color_rules !== undefined) {
        AppSetting.set('google_calendar_color_rules', String(data.google_calendar_color_rules));
      }
      if (data.google_calendar_max_results !== undefined) {
        AppSetting.set('google_calendar_max_results', String(data.google_calendar_max_results));
      }
      if (data.google_calendar_days_ahead !== undefined) {
        AppSetting.set('google_calendar_days_ahead', String(data.google_calendar_days_ahead));
      }
      if (data.google_calendar_refresh_minutes !== undefined) {
        AppSetting.set('google_calendar_refresh_minutes', String(data.google_calendar_refresh_minutes));
      }
      invalidateGcalCache();
      logActivity('settings_updated', 'Google Calendar settings updated');
    }

    if ('save_ages' in data || data.ages) {
      if (data.ages && typeof data.ages === 'object') {
        const stmt = db.prepare('UPDATE person SET age = ? WHERE id = ?');
        for (const [idStr, ageVal] of Object.entries(data.ages)) {
          const parsed = ageVal === '' || ageVal === null ? null : parseInt(String(ageVal), 10);
          stmt.run(Number.isNaN(parsed as number) ? null : parsed, Number(idStr));
        }
      } else {
        const people = db.prepare('SELECT id FROM person').all() as Array<{ id: number }>;
        const stmt = db.prepare('UPDATE person SET age = ? WHERE id = ?');
        for (const p of people) {
          const k = `person_age_${p.id}`;
          if (k in data) {
            const raw = data[k];
            const parsed = raw === '' || raw === null ? null : parseInt(String(raw), 10);
            stmt.run(Number.isNaN(parsed as number) ? null : parsed, p.id);
          }
        }
      }
      logActivity('settings_updated', 'Family member ages updated');
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message });
  }
}

settingsRouter.post('/settings', formParser.none(), requireAdult, handleSettingsPost);
settingsRouter.post('/api/settings', formParser.none(), requireAdult, handleSettingsPost);

settingsRouter.post('/settings/notification', formParser.none(), requireAdult, (req: Request, res: Response) => {
  const data = req.body || {};
  if (data.gotify_url !== undefined) AppSetting.set('gotify_url', String(data.gotify_url).trim());
  if (data.gotify_token !== undefined) AppSetting.set('gotify_token', String(data.gotify_token).trim());

  let peopleList: string[] = [];
  if (Array.isArray(data.gotify_notify_people)) {
    peopleList = data.gotify_notify_people.map(String);
  } else if (typeof data.gotify_notify_people === 'string' && data.gotify_notify_people.trim()) {
    peopleList = data.gotify_notify_people.split(',').map((s: string) => s.trim());
  }
  AppSetting.set('gotify_notify_people', peopleList.join(','));

  const boolFlag = (v: any) => v === true || v === 'true' || v === 'on' || v === '1';
  AppSetting.set(
    'gotify_notify_chores_completed',
    boolFlag(data.gotify_notify_chores_completed ?? data.notify_chore_complete) ? 'true' : 'false'
  );
  AppSetting.set(
    'gotify_notify_rewards_added',
    boolFlag(data.gotify_notify_rewards_added) ? 'true' : 'false'
  );
  AppSetting.set(
    'gotify_notify_rewards_redeemed',
    boolFlag(data.gotify_notify_rewards_redeemed ?? data.notify_reward_redeemed) ? 'true' : 'false'
  );
  AppSetting.set(
    'gotify_notify_due_chores_expired',
    boolFlag(data.gotify_notify_due_chores_expired) ? 'true' : 'false'
  );

  logActivity('settings_updated', 'Gotify notification settings updated');
  res.json({ success: true });
});

settingsRouter.all('/settings/gotify/test', async (req: Request, res: Response) => {
  const gotifyUrl = String(req.body?.gotify_url || AppSetting.get('gotify_url', '') || '').trim();
  const gotifyToken = String(req.body?.gotify_token || AppSetting.get('gotify_token', '') || '').trim();
  if (gotifyUrl) AppSetting.set('gotify_url', gotifyUrl);
  if (gotifyToken) AppSetting.set('gotify_token', gotifyToken);

  const ok = await sendGotifyNotification(
    'Chores App Test',
    'This is a test notification from your Chores & Rewards app.',
    5
  );
  if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
    if (ok) res.status(200).send('Test notification sent!');
    else res.status(400).send('Failed to send test notification. Check URL and Token.');
    return;
  }
  res.json({
    success: ok,
    message: ok ? 'Test notification sent!' : 'Failed to send test notification.',
  });
});

settingsRouter.get('/api/sounds', (_req: Request, res: Response) => {
  res.json({ success: true, sounds: listSoundEntries() });
});

settingsRouter.post(
  '/api/sounds/upload',
  requireAdult,
  soundUpload.fields([
    { name: 'sound_file', maxCount: 1 },
    { name: 'file', maxCount: 1 },
  ]),
  (req: Request, res: Response) => {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const uploaded = files?.sound_file?.[0] || files?.file?.[0];
    if (!uploaded) {
      res.status(400).json({ success: false, error: 'No sound file uploaded' });
      return;
    }
    const hidden = loadHiddenSounds();
    if (hidden.has(uploaded.filename)) {
      hidden.delete(uploaded.filename);
      saveHiddenSounds(hidden);
    }
    res.json({
      success: true,
      filename: uploaded.filename,
      url: `/static/uploads/sounds/${encodeURIComponent(uploaded.filename)}`,
    });
  }
);

settingsRouter.post('/api/sounds/delete', requireAdult, (req: Request, res: Response) => {
  const rawName = String(req.body?.filename || '').trim();
  const base = path.basename(rawName);
  if (!base || !SOUND_EXTENSIONS.includes(path.extname(base).toLowerCase())) {
    res.status(400).json({ success: false, error: 'Invalid sound filename' });
    return;
  }

  const customPath = path.join(UPLOADS_DIR, 'sounds', base);
  const bundledPath = path.join(STATIC_DIR, 'sounds', base);
  let found = false;

  if (fs.existsSync(customPath)) {
    try {
      fs.unlinkSync(customPath);
      found = true;
    } catch {
      // ignore
    }
  }
  if (fs.existsSync(bundledPath)) {
    const hidden = loadHiddenSounds();
    hidden.add(base);
    saveHiddenSounds(hidden);
    found = true;
  }

  if (!found) {
    res.status(404).json({ success: false, error: 'Sound file not found' });
    return;
  }
  res.json({ success: true });
});

settingsRouter.get('/api/images', (_req: Request, res: Response) => {
  const imagesDir = path.join(STATIC_DIR, 'images');
  const exts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const list: string[] = [];
  if (fs.existsSync(imagesDir)) {
    for (const f of fs.readdirSync(imagesDir)) {
      if (exts.includes(path.extname(f).toLowerCase())) {
        list.push(`/static/images/${f}`);
      }
    }
  }
  list.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  res.json({ success: true, images: list });
});

settingsRouter.post('/settings/quiz', formParser.none(), requireAdult, (req: Request, res: Response) => {
  try {
    const raw = req.body?.quiz_questions_json ?? req.body?.questions;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) {
      res.status(400).json({ success: false, error: 'Invalid quiz questions array' });
      return;
    }
    saveQuizQuestions(parsed);
    logActivity('settings_updated', 'Quiz questions updated');
    res.json({ success: true, questions: parsed });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message });
  }
});

settingsRouter.post('/settings/extras', formParser.none(), requireAdult, (req: Request, res: Response) => {
  try {
    const raw = req.body?.extra_chores_json ?? req.body?.extras;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) {
      res.status(400).json({ success: false, error: 'Invalid extra chores list' });
      return;
    }
    const cleaned = parsed.map((item, idx) => normaliseExtraChore(item, idx)).filter(Boolean) as any[];
    if (cleaned.length === 0) {
      res.status(400).json({ success: false, error: 'Add at least one extra chore' });
      return;
    }
    saveExtraChores(cleaned);
    logActivity('settings_updated', 'Extra chores catalog updated');
    res.json({ success: true, extras: cleaned });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message });
  }
});

settingsRouter.post('/settings/screensaver', formParser.none(), requireAdult, (req: Request, res: Response) => {
  const data = req.body || {};
  const boolFlag = (v: any) => v === true || v === 'true' || v === 'on' || v === '1';
  AppSetting.set('screensaver_enabled', boolFlag(data.screensaver_enabled) ? 'true' : 'false');
  if (data.screensaver_idle_timeout !== undefined) {
    AppSetting.set('screensaver_idle_timeout', String(Math.max(15, Number(data.screensaver_idle_timeout) || 180)));
  }
  if (data.screensaver_slide_duration !== undefined) {
    AppSetting.set('screensaver_slide_duration', String(Math.max(3, Number(data.screensaver_slide_duration) || 8)));
  }
  if (data.screensaver_transition !== undefined) {
    AppSetting.set('screensaver_transition', String(data.screensaver_transition));
  }
  if (data.screensaver_order !== undefined) {
    AppSetting.set('screensaver_order', String(data.screensaver_order));
  }
  AppSetting.set('screensaver_overlay_clock', boolFlag(data.screensaver_overlay_clock) ? 'true' : 'false');
  AppSetting.set('screensaver_overlay_chores', boolFlag(data.screensaver_overlay_chores) ? 'true' : 'false');
  logActivity('settings_updated', 'Screensaver settings updated');
  res.json({ success: true });
});

settingsRouter.get('/api/screensaver/config', (_req: Request, res: Response) => {
  const photos = syncScreensaverPhotos();
  res.json({
    success: true,
    enabled: (AppSetting.get('screensaver_enabled', 'false') || 'false').toLowerCase() === 'true',
    idle_timeout: Number(AppSetting.get('screensaver_idle_timeout', '180') || 180),
    slide_duration: Number(AppSetting.get('screensaver_slide_duration', '8') || 8),
    transition: AppSetting.get('screensaver_transition', 'kenburns') || 'kenburns',
    order: AppSetting.get('screensaver_order', 'shuffle') || 'shuffle',
    overlay_clock: (AppSetting.get('screensaver_overlay_clock', 'true') || 'true').toLowerCase() === 'true',
    overlay_chores: (AppSetting.get('screensaver_overlay_chores', 'false') || 'false').toLowerCase() === 'true',
    photos: screensaverPhotoUrls(photos),
    photo_items: photos.map((p) => ({
      filename: p.filename,
      url: `/static/uploads/screensaver/${encodeURIComponent(p.filename)}?v=${p.uploaded_at || 1}`,
    })),
  });
});

settingsRouter.get('/api/screensaver/chore_summary', async (_req: Request, res: Response) => {
  const today = getFamilyToday();
  const { weekdayLower } = getLocalNowNaive(getAppTimezone());
  const peopleRows = db.prepare('SELECT * FROM person ORDER BY "order", id').all() as Array<any>;
  const openChores = db
    .prepare('SELECT * FROM chore WHERE completed = 0 AND deleted = 0 AND (is_daily = 0 OR due_date <= ?)')
    .all(today) as Array<any>;

  const people = peopleRows.map((p) => {
    const mine = openChores.filter((c) => {
      if (c.assigned_to_id !== p.id && c.assigned_to !== p.name) return false;
      if (!c.days_of_week || !String(c.days_of_week).trim()) return true;
      return String(c.days_of_week)
        .split(',')
        .map((d: string) => d.trim().toLowerCase())
        .includes(weekdayLower);
    });
    return {
      id: p.id,
      name: p.name,
      avatar: p.avatar || 'default_avatar.png',
      color: p.color || '#ffffff',
      remaining: mine.length,
      chores: mine.slice(0, 6).map((c) => c.title),
    };
  });

  const gcal = await getGoogleCalendarData();
  res.json({
    success: true,
    people,
    events: gcal.events.slice(0, 3),
  });
});

settingsRouter.post(
  '/api/screensaver/upload',
  requireAdult,
  screensaverUpload.any(),
  (req: Request, res: Response) => {
    const files = (req.files as Express.Multer.File[]) || [];
    const current = syncScreensaverPhotos();
    for (const f of files) {
      current.push({ filename: f.filename, uploaded_at: Math.floor(Date.now() / 1000) });
    }
    saveScreensaverPhotosRaw(current);
    res.json({
      success: true,
      photos: screensaverPhotoUrls(current),
      uploaded: files.map((f) => f.filename),
      added: files.length,
      errors: [],
    });
  }
);

settingsRouter.post('/api/screensaver/delete', requireAdult, (req: Request, res: Response) => {
  const filename = path.basename(String(req.body?.filename || '').trim());
  if (!filename) {
    res.status(400).json({ success: false, error: 'filename required' });
    return;
  }
  const photos = getScreensaverPhotosRaw();
  const remaining = photos.filter((p) => p.filename !== filename);
  saveScreensaverPhotosRaw(remaining);
  const filePath = path.join(UPLOADS_DIR, 'screensaver', filename);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // ignore
    }
  }
  res.json({ success: true, photos: screensaverPhotoUrls(remaining) });
});

settingsRouter.post('/api/screensaver/rescan', requireAdult, (_req: Request, res: Response) => {
  const before = new Set(getScreensaverPhotosRaw().map((p) => p.filename));
  const photos = syncScreensaverPhotos();
  const added = photos.filter((p) => !before.has(p.filename)).length;
  res.json({ success: true, photos: screensaverPhotoUrls(photos), added, count: photos.length });
});

settingsRouter.post('/api/screensaver/clear', requireAdult, (_req: Request, res: Response) => {
  const folder = path.join(UPLOADS_DIR, 'screensaver');
  const photos = getScreensaverPhotosRaw();
  for (const p of photos) {
    const filePath = path.join(folder, path.basename(p.filename));
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore
      }
    }
  }
  saveScreensaverPhotosRaw([]);
  res.json({ success: true, photos: [], deleted: photos.length });
});

settingsRouter.post(
  '/settings/gcal-service-account/upload',
  requireAdult,
  gcalSaUpload.fields([
    { name: 'gcal_sa_file', maxCount: 1 },
    { name: 'service_account_json', maxCount: 1 },
  ]),
  (req: Request, res: Response) => {
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const f = files?.gcal_sa_file?.[0] || files?.service_account_json?.[0];
    if (!f) {
      res.status(400).json({ success: false, error: 'No file received' });
      return;
    }
    try {
      const parsed = JSON.parse(f.buffer.toString('utf-8'));
      if (parsed.type !== 'service_account' || !parsed.client_email) {
        res.status(400).json({
          success: false,
          error: 'Invalid Google service account JSON file (missing type=service_account or client_email).',
        });
        return;
      }
      fs.writeFileSync(getServiceAccountPath(), JSON.stringify(parsed, null, 2), 'utf-8');
      invalidateGcalCache();
      logActivity('settings_updated', 'Google Calendar service account key uploaded');
      res.json({ success: true, email: parsed.client_email, client_email: parsed.client_email });
    } catch {
      res.status(400).json({ success: false, error: 'Invalid JSON file' });
    }
  }
);

settingsRouter.post('/settings/gcal-service-account/delete', requireAdult, (_req: Request, res: Response) => {
  const saPath = getServiceAccountPath();
  if (fs.existsSync(saPath)) {
    try {
      fs.unlinkSync(saPath);
    } catch {
      // ignore
    }
  }
  invalidateGcalCache();
  res.json({ success: true });
});

settingsRouter.get('/api/activity_log', (req: Request, res: Response) => {
  const typeFilter = String(req.query.type || '').trim();
  const userFilter = String(req.query.user || '').trim();

  let sql = 'SELECT * FROM activity_log WHERE 1=1';
  const params: any[] = [];
  if (typeFilter) {
    sql += ' AND type = ?';
    params.push(typeFilter);
  }
  if (userFilter) {
    sql += ' AND user_name = ?';
    params.push(userFilter);
  }
  sql += ' ORDER BY date DESC, id DESC LIMIT 500';
  const logs = db.prepare(sql).all(...params) as Array<any>;

  const people = db.prepare('SELECT name FROM person').all() as Array<{ name: string }>;
  const completedChores = db
    .prepare('SELECT assigned_to, points, date_completed, title FROM chore WHERE completed = 1 AND deleted = 0')
    .all() as Array<any>;

  const choresByPerson: Record<string, number> = {};
  const monthlyChoresByPerson: Record<string, number> = {};
  const monthPrefix = getFamilyToday().slice(0, 7);

  for (const p of people) {
    choresByPerson[p.name] = 0;
    monthlyChoresByPerson[p.name] = 0;
  }
  for (const c of completedChores) {
    if (c.assigned_to) {
      choresByPerson[c.assigned_to] = (choresByPerson[c.assigned_to] || 0) + 1;
      if (c.date_completed && String(c.date_completed).startsWith(monthPrefix)) {
        monthlyChoresByPerson[c.assigned_to] = (monthlyChoresByPerson[c.assigned_to] || 0) + 1;
      }
    }
  }

  const distinctTypes = (db.prepare('SELECT DISTINCT type FROM activity_log ORDER BY type').all() as Array<{ type: string }>).map(
    (r) => r.type
  );
  const distinctUsers = (
    db.prepare('SELECT DISTINCT user_name FROM activity_log WHERE user_name IS NOT NULL ORDER BY user_name').all() as Array<{
      user_name: string;
    }>
  ).map((r) => r.user_name);

  res.json({
    success: true,
    logs,
    types: distinctTypes,
    users: distinctUsers,
    chores_by_person: choresByPerson,
    monthly_chores_by_person: monthlyChoresByPerson,
  });
});

settingsRouter.get('/api/chore_history', (_req: Request, res: Response) => {
  const completedChores = db
    .prepare('SELECT * FROM chore WHERE completed = 1 AND deleted = 0 ORDER BY date_completed DESC')
    .all() as Array<any>;
  const people = db.prepare('SELECT * FROM person').all() as Array<any>;

  const choresByPerson: Record<string, number> = {};
  const pointsByPerson: Record<string, number> = {};
  for (const p of people) {
    choresByPerson[p.name] = 0;
    pointsByPerson[p.name] = 0;
  }
  for (const c of completedChores) {
    if (c.assigned_to) {
      choresByPerson[c.assigned_to] = (choresByPerson[c.assigned_to] || 0) + 1;
      pointsByPerson[c.assigned_to] = roundPoints((pointsByPerson[c.assigned_to] || 0) + Number(c.points || 0));
    }
  }

  const today = getFamilyToday();
  const dayKeys = Array.from({ length: 7 }, (_, i) => addDays(today, -(6 - i)));
  const choresPerDay: Record<string, number> = {};
  for (const dk of dayKeys) choresPerDay[dk] = 0;
  for (const c of completedChores) {
    const dk = c.date_completed ? String(c.date_completed).slice(0, 10) : '';
    if (dk && dk in choresPerDay) {
      choresPerDay[dk] += 1;
    }
  }

  res.json({
    success: true,
    completed_chores: completedChores,
    chores_by_person: choresByPerson,
    points_by_person: pointsByPerson,
    chores_per_day: choresPerDay,
    day_keys: dayKeys,
    reward_system: AppSetting.getRewardSystem(),
  });
});
