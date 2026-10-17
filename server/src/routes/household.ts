import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { db, AppSetting, logActivity } from '../db';
import { UPLOADS_DIR } from '../config';
import { getMondayOfWeek, addDays } from '../utils/time';

const WEEKDAYS_LOWER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner'] as const;

const DEFAULT_MEAL_SUGGESTIONS = [
  'Spaghetti Bolognese',
  'Chicken Tacos',
  'Homemade Pizza',
  'Stir Fry & Rice',
  'Sausages & Mash',
  'Roast Chicken',
  'Burgers & Chips',
  'Fish & Veggies',
  'Pancakes',
  'Toasties',
  'Mac & Cheese',
  'Lasagna',
];

const DEFAULT_SHOPPING_STORES = [
  { id: 'aldi', name: 'Aldi', icon: '/static/images/rewards/aldi.svg' },
  { id: 'woolworths', name: 'Woolworths', icon: '/static/images/rewards/woolworths.svg' },
  { id: 'coles', name: 'Coles', icon: '🛒' },
  { id: 'general', name: 'General', icon: '🛍️' },
];

const DEFAULT_NOTES_COLUMNS = [
  { id: 'col-todo', title: 'To Do', color: '#fef08a' },
  { id: 'col-house', title: 'Around the House', color: '#bbf7d0' },
  { id: 'col-reminders', title: 'Reminders', color: '#93c5fd' },
];

const ALLOWED_STICKY_COLORS = ['#fef08a', '#fecaca', '#bbf7d0', '#bfdbfe', '#e9d5ff', '#fed7aa'];

const mealImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, path.join(UPLOADS_DIR, 'meals'));
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `meal_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}${ext}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 },
});

function parseJsonSetting<T>(key: string, fallback: T): T {
  const raw = AppSetting.get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getWeekDaysList(weekStartIso: string) {
  return Array.from({ length: 7 }, (_, idx) => {
    const dateIso = addDays(weekStartIso, idx);
    const [y, m, d] = dateIso.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    const dayShort = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(dt);
    const dayFull = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(dt);
    const dateLabel = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(dt);
    return {
      date_iso: dateIso,
      day_short: dayShort,
      day_full: dayFull,
      date_label: dateLabel,
    };
  });
}

export function getRecurringMeals() {
  const raw = parseJsonSetting<Record<string, any>>('meal_planner_recurring_json', {});
  const out: Record<string, Record<string, { enabled: boolean; value: string }>> = {};
  for (const day of WEEKDAYS_LOWER) {
    out[day] = {};
    const dayObj = raw && typeof raw[day] === 'object' ? raw[day] : {};
    for (const slot of MEAL_SLOTS) {
      const sObj = dayObj && typeof dayObj[slot] === 'object' ? dayObj[slot] : {};
      out[day][slot] = {
        enabled: Boolean(sObj?.enabled),
        value: String(sObj?.value || '').trim().slice(0, 120),
      };
    }
  }
  return out;
}

export function getMealPlanForWeek(weekStartIso: string) {
  const storedPlan = parseJsonSetting<Record<string, any>>('meal_planner_plan_json', {});
  const recurring = getRecurringMeals();
  const plan: Record<string, { breakfast: string; lunch: string; dinner: string }> = {};

  for (let i = 0; i < 7; i++) {
    const dateIso = addDays(weekStartIso, i);
    const dayName = WEEKDAYS_LOWER[i];
    const dayStored = storedPlan && typeof storedPlan[dateIso] === 'object' ? storedPlan[dateIso] : {};
    const slotValues: any = {};
    for (const slot of MEAL_SLOTS) {
      const overrideVal = String(dayStored?.[slot] ?? '').trim().slice(0, 120);
      const rec = recurring[dayName]?.[slot];
      if (overrideVal) {
        slotValues[slot] = overrideVal;
      } else if (rec?.enabled && rec.value) {
        slotValues[slot] = rec.value;
      } else {
        slotValues[slot] = '';
      }
    }
    plan[dateIso] = slotValues;
  }

  return { plan, recurring };
}

export function getMealSuggestions(): string[] {
  const raw = parseJsonSetting<string[] | null>('meal_planner_suggestions_json', null);
  if (!Array.isArray(raw) || raw.length === 0) return [...DEFAULT_MEAL_SUGGESTIONS];
  return raw;
}

export function getMealIngredients(): Record<string, Array<{ name: string; store: string; qty: string }>> {
  const raw = parseJsonSetting<Record<string, any>>('meal_ingredients_json', {});
  if (!raw || typeof raw !== 'object') return {};
  return raw;
}

export function getMealImages(): Record<string, string> {
  const raw = parseJsonSetting<Record<string, string>>('meal_images_json', {});
  return raw && typeof raw === 'object' ? raw : {};
}

export function getMealSocial(): Record<
  string,
  { comments: Array<{ id: string; author: string; text: string; created_at: string }>; votes: Record<string, string> }
> {
  const raw = parseJsonSetting<Record<string, any>>('meal_social_json', {});
  return raw && typeof raw === 'object' ? raw : {};
}

export function getShoppingStores() {
  const raw = parseJsonSetting<Array<{ id: string; name: string; icon: string }> | null>('shopping_stores_json', null);
  if (!Array.isArray(raw) || raw.length === 0) return [...DEFAULT_SHOPPING_STORES];
  return raw;
}

export function getShoppingData() {
  const raw = parseJsonSetting<any>('shopping_list_json', {});
  return {
    checked: raw?.checked && typeof raw.checked === 'object' ? raw.checked : {},
    general: Array.isArray(raw?.general) ? raw.general : [],
    hidden: raw?.hidden && typeof raw.hidden === 'object' ? raw.hidden : {},
    active: Array.isArray(raw?.active) ? raw.active : [],
    meal_order: Array.isArray(raw?.meal_order) ? raw.meal_order : [],
    archived: Array.isArray(raw?.archived) ? raw.archived : [],
  };
}

export function getNotesKanban() {
  const raw = parseJsonSetting<{ columns?: any[]; notes?: any[] }>('notes_kanban_json', {});
  const columns =
    Array.isArray(raw?.columns) && raw.columns.length > 0 ? raw.columns : [...DEFAULT_NOTES_COLUMNS];
  const notes = Array.isArray(raw?.notes) ? raw.notes : [];
  return { columns, notes };
}

export function getTextPads() {
  const raw = parseJsonSetting<any[]>('text_pads_json', []);
  return Array.isArray(raw) ? raw : [];
}

export function getDashboardNotes() {
  const raw = parseJsonSetting<any[]>('dashboard_notes_json', []);
  return Array.isArray(raw) ? raw : [];
}

export const householdRouter = Router();

householdRouter.get('/api/meal_planner', (req: Request, res: Response) => {
  const weekStart = getMondayOfWeek(String(req.query.week_start || ''));
  const weekDays = getWeekDaysList(weekStart);
  const { plan, recurring } = getMealPlanForWeek(weekStart);
  const suggestions = getMealSuggestions();
  res.json({
    success: true,
    week_start: weekStart,
    week_days: weekDays,
    plan,
    recurring,
    suggestions,
  });
});

householdRouter.post('/api/meal_planner', (req: Request, res: Response) => {
  try {
    const data = req.body || {};
    const weekStart = getMondayOfWeek(data.week_start);
    const incomingPlan = data.plan && typeof data.plan === 'object' ? data.plan : {};
    const incomingRecurring = data.recurring && typeof data.recurring === 'object' ? data.recurring : {};

    const normalizedRecurring: Record<string, Record<string, { enabled: boolean; value: string }>> = {};
    for (const day of WEEKDAYS_LOWER) {
      normalizedRecurring[day] = {};
      for (const slot of MEAL_SLOTS) {
        const sObj = incomingRecurring?.[day]?.[slot];
        normalizedRecurring[day][slot] = {
          enabled: Boolean(sObj?.enabled),
          value: String(sObj?.value || '').trim().slice(0, 120),
        };
      }
    }

    const storedPlan = parseJsonSetting<Record<string, any>>('meal_planner_plan_json', {});
    for (let i = 0; i < 7; i++) {
      const dateIso = addDays(weekStart, i);
      const dayName = WEEKDAYS_LOWER[i];
      const dayIncoming = incomingPlan[dateIso] || {};
      const toStore: Record<string, string> = {};
      for (const slot of MEAL_SLOTS) {
        const val = String(dayIncoming[slot] || '').trim().slice(0, 120);
        const rec = normalizedRecurring[dayName][slot];
        if (val && !(rec.enabled && rec.value === val)) {
          toStore[slot] = val;
        }
      }
      if (Object.keys(toStore).length > 0) {
        storedPlan[dateIso] = toStore;
      } else {
        delete storedPlan[dateIso];
      }
    }

    AppSetting.set('meal_planner_plan_json', JSON.stringify(storedPlan));
    AppSetting.set('meal_planner_recurring_json', JSON.stringify(normalizedRecurring));
    logActivity('settings_updated', 'Meal planner updated');

    const { plan } = getMealPlanForWeek(weekStart);
    res.json({ success: true, plan, recurring: normalizedRecurring });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message });
  }
});

householdRouter.post('/api/meal_planner_suggestions', (req: Request, res: Response) => {
  const raw = Array.isArray(req.body?.suggestions) ? req.body.suggestions : [];
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const item of raw) {
    const val = String(item || '').trim().slice(0, 80);
    if (!val || seen.has(val.toLowerCase())) continue;
    seen.add(val.toLowerCase());
    cleaned.push(val);
  }
  AppSetting.set('meal_planner_suggestions_json', JSON.stringify(cleaned));
  logActivity('settings_updated', 'Meal suggestions updated');
  res.json({ success: true, suggestions: cleaned });
});

householdRouter.get('/api/meal_ingredients', (_req: Request, res: Response) => {
  res.json({ success: true, ingredients: getMealIngredients() });
});

householdRouter.post('/api/meal_ingredients', (req: Request, res: Response) => {
  const raw = req.body?.ingredients;
  const cleaned: Record<string, Array<{ name: string; store: string; qty: string }>> = {};
  if (raw && typeof raw === 'object') {
    for (const [k, items] of Object.entries(raw)) {
      const mealKey = String(k || '').trim().toLowerCase().slice(0, 80);
      if (!mealKey || !Array.isArray(items)) continue;
      cleaned[mealKey] = items
        .map((it: any) => {
          const name = String(it?.name || '').trim().slice(0, 80);
          const store =
            String(it?.store || 'aldi')
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9-]/g, '')
              .slice(0, 50) || 'aldi';
          const qty = String(it?.qty || '').trim().slice(0, 40);
          return name ? { name, store, qty } : null;
        })
        .filter(Boolean) as Array<{ name: string; store: string; qty: string }>;
    }
  }
  AppSetting.set('meal_ingredients_json', JSON.stringify(cleaned));
  logActivity('settings_updated', 'Meal ingredients updated');
  res.json({ success: true, ingredients: cleaned });
});

householdRouter.post('/api/meal_image', mealImageUpload.single('image'), (req: Request, res: Response) => {
  const mealKey = String(req.body?.meal_key || '').trim().toLowerCase().slice(0, 80);
  if (!req.file) {
    res.status(400).json({ success: false, error: 'No image uploaded' });
    return;
  }
  const imageUrl = `/static/uploads/meals/${req.file.filename}`;
  if (mealKey) {
    const images = getMealImages();
    images[mealKey] = imageUrl;
    AppSetting.set('meal_images_json', JSON.stringify(images));
  }
  res.json({ success: true, image_url: imageUrl });
});

householdRouter.post('/api/meal_image_url', (req: Request, res: Response) => {
  const mealKey = String(req.body?.meal_key || '').trim().toLowerCase().slice(0, 80);
  const url = String(req.body?.url || '').trim().slice(0, 2048);
  if (!mealKey || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    res.status(400).json({ success: false, error: 'Valid meal_key and http(s) URL required' });
    return;
  }
  const images = getMealImages();
  images[mealKey] = url;
  AppSetting.set('meal_images_json', JSON.stringify(images));
  res.json({ success: true, image_url: url });
});

householdRouter.post('/api/meal_image/delete', (req: Request, res: Response) => {
  const mealKey = String(req.body?.meal_key || '').trim().toLowerCase().slice(0, 80);
  if (mealKey) {
    const images = getMealImages();
    delete images[mealKey];
    AppSetting.set('meal_images_json', JSON.stringify(images));
  }
  res.json({ success: true });
});

householdRouter.get('/api/meal_social', (_req: Request, res: Response) => {
  res.json({ success: true, social: getMealSocial() });
});

function resolveCanonicalFamilyName(rawName: string): string | null {
  const trimmed = String(rawName || '').trim().slice(0, 50);
  if (!trimmed) return null;
  const people = db.prepare('SELECT name FROM person').all() as Array<{ name: string }>;
  const match = people.find((p) => p.name.trim().toLowerCase() === trimmed.toLowerCase());
  return match ? match.name.trim() : null;
}

householdRouter.post('/api/meal_comment', (req: Request, res: Response) => {
  const mealKey = String(req.body?.meal_key || '').trim().toLowerCase().slice(0, 80);
  const text = String(req.body?.text || '').trim().slice(0, 500);
  const author = resolveCanonicalFamilyName(req.body?.author);
  if (!mealKey || !text) {
    res.status(400).json({ success: false, error: 'meal_key and text are required' });
    return;
  }
  if (!author) {
    res.status(400).json({ success: false, error: 'Pick who is commenting' });
    return;
  }

  const social = getMealSocial();
  const entry = social[mealKey] || { comments: [], votes: {} };
  if (entry.comments.length >= 80) {
    res.status(400).json({ success: false, error: 'Maximum comments reached for this meal' });
    return;
  }
  const comment = {
    id: crypto.randomBytes(8).toString('hex'),
    author,
    text,
    created_at: new Date().toISOString().slice(0, 19) + 'Z',
  };
  entry.comments.push(comment);
  social[mealKey] = entry;
  AppSetting.set('meal_social_json', JSON.stringify(social));
  logActivity('settings_updated', `${author} commented on meal '${mealKey}'`, author);
  res.json({ success: true, comment, social: entry });
});

householdRouter.post('/api/meal_comment/delete', (req: Request, res: Response) => {
  const mealKey = String(req.body?.meal_key || '').trim().toLowerCase().slice(0, 80);
  const commentId = String(req.body?.comment_id || '').trim();
  const social = getMealSocial();
  const entry = social[mealKey];
  if (!entry) {
    res.status(404).json({ success: false, error: 'Comment not found' });
    return;
  }
  const before = entry.comments.length;
  entry.comments = entry.comments.filter((c) => c.id !== commentId);
  if (entry.comments.length === before) {
    res.status(404).json({ success: false, error: 'Comment not found' });
    return;
  }
  if (entry.comments.length === 0 && Object.keys(entry.votes || {}).length === 0) {
    delete social[mealKey];
  } else {
    social[mealKey] = entry;
  }
  AppSetting.set('meal_social_json', JSON.stringify(social));
  res.json({ success: true, social: social[mealKey] || { comments: [], votes: {} } });
});

householdRouter.post('/api/meal_vote', (req: Request, res: Response) => {
  const mealKey = String(req.body?.meal_key || '').trim().toLowerCase().slice(0, 80);
  const author = resolveCanonicalFamilyName(req.body?.author);
  const vote = String(req.body?.vote || '').trim().toLowerCase();
  if (!mealKey || !author) {
    res.status(400).json({ success: false, error: 'Valid meal_key and author required' });
    return;
  }
  if (!['like', 'dislike', ''].includes(vote)) {
    res.status(400).json({ success: false, error: 'Invalid vote' });
    return;
  }
  const social = getMealSocial();
  const entry = social[mealKey] || { comments: [], votes: {} };
  if (!vote || entry.votes[author] === vote) {
    delete entry.votes[author];
  } else {
    entry.votes[author] = vote;
  }
  if (entry.comments.length === 0 && Object.keys(entry.votes).length === 0) {
    delete social[mealKey];
  } else {
    social[mealKey] = entry;
  }
  AppSetting.set('meal_social_json', JSON.stringify(social));
  res.json({ success: true, social: social[mealKey] || { comments: [], votes: {} } });
});

householdRouter.post('/api/meal_social/delete', (req: Request, res: Response) => {
  const mealKey = String(req.body?.meal_key || '').trim().toLowerCase().slice(0, 80);
  if (mealKey) {
    const social = getMealSocial();
    delete social[mealKey];
    AppSetting.set('meal_social_json', JSON.stringify(social));
  }
  res.json({ success: true });
});

householdRouter.get('/api/shopping_list', (_req: Request, res: Response) => {
  res.json({ success: true, ...getShoppingData() });
});

householdRouter.post('/api/shopping_list', (req: Request, res: Response) => {
  const data = req.body || {};
  const current = getShoppingData();
  const updated = {
    checked: data.checked !== undefined && typeof data.checked === 'object' ? data.checked : current.checked,
    general: Array.isArray(data.general) ? data.general : current.general,
    hidden: data.hidden !== undefined && typeof data.hidden === 'object' ? data.hidden : current.hidden,
    active: Array.isArray(data.active) ? data.active : current.active,
    meal_order: Array.isArray(data.meal_order) ? data.meal_order : current.meal_order,
    archived: Array.isArray(data.archived) ? data.archived : current.archived,
  };
  AppSetting.set('shopping_list_json', JSON.stringify(updated));
  res.json({ success: true, ...updated });
});

householdRouter.get('/api/shopping_stores', (_req: Request, res: Response) => {
  res.json({ success: true, stores: getShoppingStores() });
});

householdRouter.post('/api/shopping_stores', (req: Request, res: Response) => {
  const rawStores = Array.isArray(req.body?.stores) ? req.body.stores : [];
  const cleaned = rawStores
    .map((s: any) => {
      const id = String(s?.id || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '')
        .slice(0, 50);
      const name = String(s?.name || '').trim().slice(0, 80);
      const icon = String(s?.icon || '🛒').trim();
      return id && name ? { id, name, icon } : null;
    })
    .filter(Boolean) as Array<{ id: string; name: string; icon: string }>;

  if (cleaned.length === 0) {
    res.status(400).json({ success: false, error: 'At least one store is required' });
    return;
  }
  AppSetting.set('shopping_stores_json', JSON.stringify(cleaned));
  logActivity('settings_updated', 'Shopping stores updated');
  res.json({ success: true, stores: cleaned });
});

householdRouter.get('/api/notes', (_req: Request, res: Response) => {
  res.json({ success: true, ...getNotesKanban() });
});

householdRouter.post('/api/notes', (req: Request, res: Response) => {
  const data = req.body || {};
  const columns = Array.isArray(data.columns) ? data.columns : [];
  const notes = Array.isArray(data.notes) ? data.notes : [];
  const payload = { columns, notes };
  AppSetting.set('notes_kanban_json', JSON.stringify(payload));
  res.json({ success: true, ...payload });
});

householdRouter.get('/api/text_pads', (_req: Request, res: Response) => {
  res.json({ success: true, pads: getTextPads() });
});

householdRouter.post('/api/text_pads', (req: Request, res: Response) => {
  const rawPads = Array.isArray(req.body?.pads) ? req.body.pads : [];
  const cleaned = rawPads
    .map((p: any) => ({
      id: String(p?.id || crypto.randomUUID()).slice(0, 80),
      title: String(p?.title || 'Untitled').slice(0, 80),
      content: String(p?.content || '').slice(0, 100000),
      created_at: String(p?.created_at || new Date().toISOString()).slice(0, 30),
    }));
  AppSetting.set('text_pads_json', JSON.stringify(cleaned));
  res.json({ success: true, pads: cleaned });
});

householdRouter.get('/api/dashboard_notes', (_req: Request, res: Response) => {
  res.json({ success: true, notes: getDashboardNotes() });
});

householdRouter.post('/api/dashboard_notes', (req: Request, res: Response) => {
  const rawNotes = Array.isArray(req.body?.notes) ? req.body.notes : [];
  const cleaned = rawNotes
    .map((n: any) => {
      const id = String(n?.id || crypto.randomUUID()).slice(0, 60);
      const title = n?.title !== undefined ? String(n.title).slice(0, 120) : undefined;
      const text = String(n?.text ?? n?.body ?? '').slice(0, 2000);
      const color = ALLOWED_STICKY_COLORS.includes(n?.color) ? n.color : '#fef08a';
      const width = n?.width ? Math.max(160, Math.min(640, Number(n.width))) : undefined;
      const height = n?.height ? Math.max(140, Math.min(560, Number(n.height))) : undefined;
      const text_size = ['sm', 'md', 'lg'].includes(n?.text_size) ? n.text_size : 'md';
      const pinned = Boolean(n?.pinned);
      return { id, title, text, color, width, height, text_size, pinned };
    });
  AppSetting.set('dashboard_notes_json', JSON.stringify(cleaned));
  res.json({ success: true, notes: cleaned });
});
