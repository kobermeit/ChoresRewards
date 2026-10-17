import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { db, AppSetting, logActivity, normalizeShoppingKey } from '../db';
import { UPLOADS_DIR } from '../config';
import { getMondayOfWeek, addDays } from '../utils/time';

export interface MealCardItem {
  id: string;
  title: string;
  audience: string;
  meal_key: string;
}

export interface RecipeIngredient {
  name: string;
  store: string;
  qty: string;
  prep?: string;
  raw_name?: string;
}

export interface RecipeItem {
  id?: number;
  meal_key: string;
  title: string;
  image_url: string | null;
  ingredients: RecipeIngredient[];
  instructions: string;
  servings: string;
  prep_time: string;
  notion_id?: string | null;
}

/**
 * Cleans an ingredient line specifically for the SHOPPING LIST.
 * Strips preparation notes, brands (Coles, Woolies, etc.), packaging words (pkt, can, etc.),
 * and measurement units/fractions (tsp, tbsp, 1/4 cup, 500g, etc.), leaving only the clean grocery item to buy.
 * NOTE: Recipes preserve their original full ingredient text; this is only used when items enter the shopping list.
 */
export function cleanShoppingItemName(raw: string): string {
  let text = String(raw || '').trim();
  if (!text) return '';

  // 1. Strip list markers (- , * , 1. , etc.)
  text = text.replace(/^[-*•☐☑]\s*|^\d+[\.\)]\s*/, '').trim();

  // 2. Split on comma - first segment is what to buy, rest is culinary prep
  if (text.includes(',')) {
    text = text.split(',')[0].trim();
  }

  // 3. Remove parenthetical details like (1L), (150g), (optional), (to serve), etc.
  text = text.replace(/\s*\([^)]*\)/g, ' ').trim();

  // 4. Remove trailing dash notes (- to serve, - finely chopped, etc.)
  text = text.replace(/\s*[-–]\s*(to serve|for serving|optional|to taste|finely chopped|chopped|sliced|grated|minced).*$/i, '').trim();

  // 5. Remove brand / supermarket names
  text = text.replace(/\b(coles|woolworths|woolies|aldi|made easy|community co)\b/gi, ' ').trim();

  // 6. Remove packaging words
  text = text.replace(/\b(pkt|pkts|packets?|boxes|box|bags?|jars?|cans?|tins?|punnets?|tubs?|bottles?|cartons?)\b/gi, ' ').trim();

  // 7. Remove fractions and numbers (e.g. 1/4, 1/2, ¼, ½, ¾, 0.5kg, 750g, 500ml, 2x)
  text = text.replace(/[¼½¾⅓⅔⅛⅜⅝⅞]/g, ' ');
  text = text.replace(/\b\d+\s*\/\s*\d+\b/g, ' ');
  text = text.replace(/(^|\s)\.?\d+(\.\d+)?\s*(g|kg|ml|l|oz|lb)?\b/gi, ' ');
  text = text.replace(/(^|\s)\d+(\.\d+)?\s*(x|\*|-)?\s*/gi, ' ');

  // 8. Remove measurement units / words
  text = text.replace(/\b(tsp|tbsp|tbs|tablespoons?|teaspoons?|cups?|slices?|stalks?|cloves?|pinch|pinches|dash|handfuls?|sprigs?|pieces?)\b/gi, ' ').trim();

  // 9. Remove leading prep words if followed by an ingredient (e.g. "coarsely chopped parsley" -> "parsley")
  text = text.replace(/^(finely|coarsely|thinly)?\s*(chopped|diced|minced|crushed)\s+/i, '').trim();

  // 10. Remove stray prepositions/fillers at beginning or end
  text = text.replace(/^\s*(of|to|for|and|&|-)\s+/i, '').trim();
  text = text.replace(/\s+(of|to|for|and|&|-)\s*$/i, '').trim();

  // Collapse multiple spaces
  text = text.replace(/\s{2,}/g, ' ').trim();

  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Parses an ingredient line and extracts preparation notes, raw name, and shopping buy name.
 */
export function cleanIngredientBuyName(raw: string): { buyName: string; prep?: string; rawName: string } {
  let text = String(raw || '').trim();
  if (!text) return { buyName: '', rawName: '' };

  // Strip list prefixes like "- ", "* ", "• ", "1. ", "1) "
  text = text.replace(/^[-*•☐☑]\s*|^\d+[\.\)]\s*/, '').trim();

  let prep = '';

  // 1. Comma separation: remaining segments are preparation
  if (text.includes(',')) {
    const parts = text.split(',');
    prep = parts.slice(1).map((p) => p.trim()).filter(Boolean).join(', ');
  }

  // 2. Trailing parenthetical preparation/serving notes, e.g. " (grated)", " (for serving)", " (optional)"
  const parenMatch = text.match(
    /\((optional|to taste|for serving|to serve|for garnish|room temp(?:erature)?|peeled|chopped|sliced|diced|melted|crushed|minced|grated|shredded)\)$/i
  );
  if (parenMatch && parenMatch[1] && !prep) {
    prep = parenMatch[1].trim();
  }

  // 3. Trailing hyphen / dash notes like " - finely chopped" or " - to serve"
  const dashMatch = text.match(
    /[-–]\s*(to serve|for serving|optional|to taste|finely chopped|chopped|sliced|grated|minced)$/i
  );
  if (dashMatch && dashMatch[1] && !prep) {
    prep = dashMatch[1].trim();
  }

  const buyName = cleanShoppingItemName(text);
  return { buyName, prep: prep || undefined, rawName: text };
}

const WEEKDAYS_LOWER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner'] as const;

const DEFAULT_MEAL_SUGGESTIONS = [
  'Spaghetti Bolognese',
  'Chicken Tacos',
  'Homemade Pizza',
  'Stir Fry & Rice',
  'Sausage & Veg',
  'Roast Chicken',
  'Burgers & Chips',
  'Fish & Veggies',
  'Pancakes',
  'Toasties',
  'Mac & Cheese',
  'Lasagna',
];

const DEFAULT_SHOPPING_STORES = [
  { id: 'aldi', name: 'Aldi', icon: '/static/images/rewards/store_aldi.svg' },
  { id: 'woolworths', name: 'Woolworths', icon: '/static/images/rewards/store_woolworths.svg' },
  { id: 'coles-7129', name: 'coles', icon: '🛒' },
  { id: 'fruit-an-vege-4537', name: 'fruit an vege', icon: '🛒' },
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

function parseLegacySlotToCard(rawText: string, defaultAudience = 'Everyone'): MealCardItem | null {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) return null;
  let audience = defaultAudience;
  let title = trimmed;
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    const maybeAud = parts[0].trim();
    const rest = parts.slice(1).join(':').trim();
    if (maybeAud && rest && maybeAud.length <= 24) {
      audience = maybeAud;
      title = rest;
    }
  }
  return {
    id: `card_${crypto.randomBytes(6).toString('hex')}`,
    title,
    audience,
    meal_key: title.toLowerCase().trim(),
  };
}

export function normalizeDayCards(rawDay: any): MealCardItem[] {
  if (!rawDay) return [];
  if (Array.isArray(rawDay)) {
    return rawDay
      .map((c: any) => {
        const title = String(c?.title || c?.name || '').trim();
        if (!title) return null;
        return {
          id: String(c?.id || `card_${crypto.randomBytes(6).toString('hex')}`),
          title,
          audience: String(c?.audience || 'Everyone').trim() || 'Everyone',
          meal_key: String(c?.meal_key || title.toLowerCase().trim()),
        };
      })
      .filter(Boolean) as MealCardItem[];
  }
  if (typeof rawDay === 'object') {
    const cards: MealCardItem[] = [];
    for (const slot of MEAL_SLOTS) {
      const val = String(rawDay[slot] || '').trim();
      if (val) {
        const card = parseLegacySlotToCard(val, 'Everyone');
        if (card) cards.push(card);
      }
    }
    return cards;
  }
  return [];
}

export function getMealPlanForWeek(weekStartIso: string) {
  const storedPlan = parseJsonSetting<Record<string, any>>('meal_planner_plan_json', {});
  const recurring = getRecurringMeals();
  const plan: Record<string, any> = {};
  const cardsByDay: Record<string, MealCardItem[]> = {};

  let migratedAny = false;
  for (const [dateKey, val] of Object.entries(storedPlan)) {
    if (val && !Array.isArray(val) && typeof val === 'object') {
      storedPlan[dateKey] = normalizeDayCards(val);
      migratedAny = true;
    }
  }
  if (migratedAny) {
    AppSetting.set('meal_planner_plan_json', JSON.stringify(storedPlan));
  }

  for (let i = 0; i < 7; i++) {
    const dateIso = addDays(weekStartIso, i);
    const dayCards = normalizeDayCards(storedPlan[dateIso]);
    cardsByDay[dateIso] = dayCards;
    // Keep backwards-compatible summary in plan[dateIso] while also exposing cards_by_day
    plan[dateIso] = dayCards;
  }

  return { plan, cards_by_day: cardsByDay, recurring };
}

export function getAllRecipes(): Record<string, RecipeItem> {
  const rows = db.prepare('SELECT * FROM recipes ORDER BY title').all() as Array<any>;
  const map: Record<string, RecipeItem> = {};
  const ingMap = getMealIngredients();
  const imgMap = getMealImages();

  for (const r of rows) {
    let parsedIngs: Array<{ name: string; store: string; qty: string }> = [];
    try {
      parsedIngs = JSON.parse(r.ingredients_json || '[]');
    } catch {
      parsedIngs = [];
    }
    const key = String(r.meal_key).toLowerCase().trim();
    map[key] = {
      id: r.id,
      meal_key: key,
      title: r.title,
      image_url: r.image_url || imgMap[key] || null,
      ingredients: parsedIngs.length > 0 ? parsedIngs : ingMap[key] || [],
      instructions: r.instructions || '',
      servings: r.servings || '',
      prep_time: r.prep_time || '',
      notion_id: r.notion_id || null,
    };
  }

  // Also include any meal in meal_ingredients_json not yet in recipes table
  for (const [k, ings] of Object.entries(ingMap)) {
    const key = k.toLowerCase().trim();
    if (!map[key]) {
      map[key] = {
        meal_key: key,
        title: key.charAt(0).toUpperCase() + key.slice(1),
        image_url: imgMap[key] || null,
        ingredients: ings || [],
        instructions: '',
        servings: '',
        prep_time: '',
      };
    }
  }

  return map;
}

export function upsertRecipe(input: {
  meal_key?: string;
  title: string;
  image_url?: string | null;
  ingredients?: RecipeIngredient[];
  instructions?: string;
  servings?: string;
  prep_time?: string;
  notion_id?: string | null;
}): RecipeItem {
  const title = String(input.title || '').trim() || 'Untitled Recipe';
  const mealKey = String(input.meal_key || title).toLowerCase().trim();
  const existing = db.prepare('SELECT * FROM recipes WHERE meal_key = ?').get(mealKey) as any;

  let ingredients = input.ingredients;
  if (!ingredients) {
    if (existing?.ingredients_json) {
      try {
        ingredients = JSON.parse(existing.ingredients_json);
      } catch {
        ingredients = [];
      }
    } else {
      ingredients = getMealIngredients()[mealKey] || [];
    }
  }

  const cleanedIngs: RecipeIngredient[] = (ingredients || [])
    .map((i: any) => {
      const name = String(i?.name || i?.raw_name || '').trim();
      const raw = String(i?.raw_name || i?.name || '').trim();
      const qty = String(i?.qty || '').trim();
      const { prep } = cleanIngredientBuyName(name);
      return {
        name,
        qty,
        store: String(i?.store || 'aldi').trim() || 'aldi',
        prep: prep || (i?.prep ? String(i.prep).trim() : undefined),
        raw_name: raw,
      };
    })
    .filter((i) => i.name);

  const instructions =
    input.instructions !== undefined ? String(input.instructions) : existing?.instructions || '';
  const imageUrl =
    input.image_url !== undefined ? input.image_url : existing?.image_url || getMealImages()[mealKey] || null;
  const servings = input.servings !== undefined ? String(input.servings) : existing?.servings || '';
  const prepTime = input.prep_time !== undefined ? String(input.prep_time) : existing?.prep_time || '';
  const notionId = input.notion_id !== undefined ? input.notion_id : existing?.notion_id || null;

  db.prepare(`
    INSERT INTO recipes (meal_key, title, image_url, ingredients_json, instructions, servings, prep_time, notion_id, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(meal_key) DO UPDATE SET
      title = excluded.title,
      image_url = COALESCE(excluded.image_url, recipes.image_url),
      ingredients_json = excluded.ingredients_json,
      instructions = excluded.instructions,
      servings = excluded.servings,
      prep_time = excluded.prep_time,
      notion_id = COALESCE(excluded.notion_id, recipes.notion_id),
      updated_at = CURRENT_TIMESTAMP
  `).run(mealKey, title, imageUrl, JSON.stringify(cleanedIngs), instructions, servings, prepTime, notionId);

  // Sync back to meal_ingredients_json and meal_planner_suggestions_json so shopping list & suggestions stay in sync
  const ingMap = getMealIngredients();
  ingMap[mealKey] = cleanedIngs;
  AppSetting.set('meal_ingredients_json', JSON.stringify(ingMap));

  if (imageUrl) {
    const imgMap = getMealImages();
    imgMap[mealKey] = imageUrl;
    AppSetting.set('meal_images_json', JSON.stringify(imgMap));
  }

  const suggestions = getMealSuggestions();
  if (!suggestions.some((s) => s.toLowerCase() === mealKey)) {
    suggestions.push(title);
    AppSetting.set('meal_planner_suggestions_json', JSON.stringify(suggestions));
  }

  // Also register ingredients in shopping_catalog
  for (const ing of cleanedIngs) {
    touchCatalogItemOnAdd(ing.name, ing.store, false);
  }

  return {
    meal_key: mealKey,
    title,
    image_url: imageUrl,
    ingredients: cleanedIngs,
    instructions,
    servings,
    prep_time: prepTime,
    notion_id: notionId,
  };
}

export function touchCatalogItemOnAdd(rawName: string, store = 'aldi', incrementCount = true) {
  const { buyName } = cleanIngredientBuyName(rawName);
  const cleanName = buyName || String(rawName || '').trim();
  if (!cleanName) return null;
  const norm = normalizeShoppingKey(cleanName);
  const nowIso = new Date().toISOString();
  const existing = db.prepare('SELECT * FROM shopping_catalog WHERE normalized_key = ?').get(norm) as any;
  if (existing) {
    if (incrementCount) {
      db.prepare(`
        UPDATE shopping_catalog
        SET times_added = COALESCE(times_added, 0) + 1,
            last_added_at = ?,
            default_store = COALESCE(?, default_store)
        WHERE id = ?
      `).run(nowIso, store || existing.default_store, existing.id);
    }
    return db.prepare('SELECT * FROM shopping_catalog WHERE id = ?').get(existing.id) as any;
  } else {
    const info = db.prepare(`
      INSERT INTO shopping_catalog (name, normalized_key, default_store, times_added, times_purchased, last_added_at)
      VALUES (?, ?, ?, 1, 0, ?)
    `).run(cleanName, norm, store || 'aldi', nowIso);
    return db.prepare('SELECT * FROM shopping_catalog WHERE id = ?').get(info.lastInsertRowid) as any;
  }
}

export function recordCatalogPurchase(rawName: string, store = 'aldi', qty = '') {
  const cleanName = String(rawName || '').trim();
  if (!cleanName) return;
  const norm = normalizeShoppingKey(cleanName);
  const now = new Date();
  const nowIso = now.toISOString();
  let cat = db.prepare('SELECT * FROM shopping_catalog WHERE normalized_key = ?').get(norm) as any;
  if (!cat) {
    const info = db.prepare(`
      INSERT INTO shopping_catalog (name, normalized_key, default_store, times_added, times_purchased, last_added_at, last_purchased_at)
      VALUES (?, ?, ?, 1, 1, ?, ?)
    `).run(cleanName, norm, store || 'aldi', nowIso, nowIso);
    cat = db.prepare('SELECT * FROM shopping_catalog WHERE id = ?').get(info.lastInsertRowid) as any;
  } else {
    let nextAvg = cat.avg_interval_days;
    if (cat.last_purchased_at) {
      const prevMs = new Date(cat.last_purchased_at).getTime();
      const diffDays = (now.getTime() - prevMs) / (1000 * 86400);
      if (diffDays >= 0.5 && diffDays <= 180) {
        nextAvg = nextAvg ? Number((nextAvg * 0.65 + diffDays * 0.35).toFixed(1)) : Number(diffDays.toFixed(1));
      }
    } else if (!nextAvg) {
      nextAvg = 14;
    }
    db.prepare(`
      UPDATE shopping_catalog
      SET times_purchased = COALESCE(times_purchased, 0) + 1,
          last_purchased_at = ?,
          avg_interval_days = ?,
          default_store = COALESCE(?, default_store)
      WHERE id = ?
    `).run(nowIso, nextAvg, store || cat.default_store, cat.id);
  }

  db.prepare(`
    INSERT INTO shopping_purchase_log (catalog_id, purchased_at, store, qty)
    VALUES (?, ?, ?, ?)
  `).run(cat.id, nowIso, store || cat.default_store || 'aldi', qty || '');
}

export function getShoppingIntelligence(activeGeneralItems: Array<{ name: string }>) {
  const activeNorms = new Set(activeGeneralItems.map((g) => normalizeShoppingKey(g.name)));
  const catalog = db
    .prepare('SELECT * FROM shopping_catalog ORDER BY times_added DESC, name ASC')
    .all() as Array<any>;

  const frequentlyAdded = catalog
    .filter((c) => (c.times_added || 0) >= 2)
    .slice(0, 30);

  const nowMs = Date.now();
  const suggested = catalog
    .map((c) => {
      if (activeNorms.has(c.normalized_key)) return null;
      const avgDays = c.avg_interval_days || (c.times_added >= 3 ? 7 : 14);
      const lastRef = c.last_purchased_at || c.last_added_at;
      let daysSince = 0;
      if (lastRef) {
        daysSince = Math.max(0, Math.round((nowMs - new Date(lastRef).getTime()) / (1000 * 86400)));
      }
      const isDue = lastRef ? daysSince >= Math.max(3, Math.floor(avgDays * 0.75)) : c.times_added >= 2;
      if (!isDue) return null;
      return {
        ...c,
        days_since_last: daysSince,
        avg_interval_days: avgDays,
        reason: lastRef
          ? `Last bought ${daysSince}d ago (usually every ~${Math.round(avgDays)}d)`
          : `Added ${c.times_added} times previously`,
      };
    })
    .filter(Boolean)
    .slice(0, 25);

  const recentlyPurchased = db
    .prepare(`
      SELECT l.id, l.purchased_at, l.store, l.qty, c.name, c.normalized_key, c.default_store
      FROM shopping_purchase_log l
      JOIN shopping_catalog c ON c.id = l.catalog_id
      ORDER BY l.purchased_at DESC, l.id DESC
      LIMIT 40
    `)
    .all() as Array<any>;

  return {
    catalog,
    frequently_added: frequentlyAdded,
    suggested,
    recently_purchased: recentlyPurchased,
  };
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

export function detectStoreFromText(
  text: string,
  stores?: Array<{ id: string; name: string }>
): string | null {
  const t = String(text || '').toLowerCase().trim();
  if (!t) return null;
  const list = stores && stores.length > 0 ? stores : getShoppingStores();

  // 1. Check for specific supermarket brands in text
  if (/\b(coles)\b/i.test(t)) {
    const match = list.find(
      (s) => s.id.toLowerCase().includes('coles') || s.name.toLowerCase().includes('coles')
    );
    if (match) return match.id;
  }
  if (/\b(woolworths|woolies)\b/i.test(t)) {
    const match = list.find(
      (s) => s.id.toLowerCase().includes('woolworths') || s.name.toLowerCase().includes('woolworths')
    );
    if (match) return match.id;
  }
  if (/\b(aldi)\b/i.test(t)) {
    const match = list.find(
      (s) => s.id.toLowerCase().includes('aldi') || s.name.toLowerCase().includes('aldi')
    );
    if (match) return match.id;
  }
  if (/\b(fruit|vege|produce|bakery|butcher)\b/i.test(t)) {
    const match = list.find((s) => {
      const id = s.id.toLowerCase();
      const name = s.name.toLowerCase();
      return (
        id.includes('fruit') ||
        name.includes('fruit') ||
        id.includes('vege') ||
        name.includes('vege') ||
        id.includes('produce') ||
        name.includes('produce')
      );
    });
    if (match) return match.id;
  }

  // 2. Generic check against store names or IDs if mentioned directly
  for (const store of list) {
    const sName = store.name.toLowerCase().trim();
    if (sName && sName.length >= 3 && new RegExp(`\\b${sName}\\b`, 'i').test(t)) {
      return store.id;
    }
  }

  return null;
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
  const weekParam = String(req.query.week_start || req.query.week || '');
  const weekStart = getMondayOfWeek(weekParam);
  const weekDays = getWeekDaysList(weekStart);
  const { plan, cards_by_day, recurring } = getMealPlanForWeek(weekStart);
  const suggestions = getMealSuggestions();
  res.json({
    success: true,
    week_start: weekStart,
    week_days: weekDays,
    plan,
    cards_by_day,
    recurring,
    suggestions,
    recipes: getAllRecipes(),
  });
});

// Add or update a meal card on one or more days (e.g., Monday & Tuesday)
householdRouter.post('/api/meal_planner/card', (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const title = String(body.title || body.value || '').trim();
    const audience = String(body.audience || 'Everyone').trim() || 'Everyone';
    const cardId = body.card_id ? String(body.card_id).trim() : '';
    const daysInput: string[] = Array.isArray(body.days)
      ? body.days.map((d: any) => String(d).trim()).filter(Boolean)
      : body.date_iso
        ? [String(body.date_iso).trim()]
        : [];

    if (!title || daysInput.length === 0) {
      res.status(400).json({ success: false, error: 'Meal title and at least one day are required' });
      return;
    }

    const storedPlan = parseJsonSetting<Record<string, any>>('meal_planner_plan_json', {});
    const mealKey = title.toLowerCase().trim();

    for (const dateIso of daysInput) {
      const currentCards = normalizeDayCards(storedPlan[dateIso]);
      if (cardId) {
        const idx = currentCards.findIndex((c) => c.id === cardId);
        if (idx >= 0) {
          currentCards[idx] = { id: cardId, title, audience, meal_key: mealKey };
        } else {
          currentCards.push({ id: cardId, title, audience, meal_key: mealKey });
        }
      } else {
        currentCards.push({
          id: `card_${crypto.randomBytes(6).toString('hex')}`,
          title,
          audience,
          meal_key: mealKey,
        });
      }
      storedPlan[dateIso] = currentCards;
    }

    AppSetting.set('meal_planner_plan_json', JSON.stringify(storedPlan));

    // Ensure meal is in suggestions
    const suggestions = getMealSuggestions();
    if (!suggestions.some((s) => s.toLowerCase() === mealKey)) {
      suggestions.push(title);
      AppSetting.set('meal_planner_suggestions_json', JSON.stringify(suggestions));
    }

    logActivity('settings_updated', `Planned meal "${title}" (${audience}) for ${daysInput.join(', ')}`);
    const weekStart = getMondayOfWeek(daysInput[0]);
    const { plan, cards_by_day } = getMealPlanForWeek(weekStart);
    res.json({ success: true, plan, cards_by_day });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'Failed to save meal card' });
  }
});

// Delete a meal card from a day
householdRouter.post('/api/meal_planner/card/delete', (req: Request, res: Response) => {
  try {
    const dateIso = String(req.body?.date_iso || '').trim();
    const cardId = String(req.body?.card_id || '').trim();
    if (!dateIso || !cardId) {
      res.status(400).json({ success: false, error: 'date_iso and card_id required' });
      return;
    }
    const storedPlan = parseJsonSetting<Record<string, any>>('meal_planner_plan_json', {});
    const currentCards = normalizeDayCards(storedPlan[dateIso]).filter((c) => c.id !== cardId);
    if (currentCards.length > 0) {
      storedPlan[dateIso] = currentCards;
    } else {
      delete storedPlan[dateIso];
    }
    AppSetting.set('meal_planner_plan_json', JSON.stringify(storedPlan));
    const weekStart = getMondayOfWeek(dateIso);
    const { plan, cards_by_day } = getMealPlanForWeek(weekStart);
    res.json({ success: true, plan, cards_by_day });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message });
  }
});

// Move / reorder a meal card between days via drag-and-drop
householdRouter.post('/api/meal_planner/card/move', (req: Request, res: Response) => {
  try {
    const sourceDate = String(req.body?.source_date || '').trim();
    const targetDate = String(req.body?.target_date || '').trim();
    const cardId = String(req.body?.card_id || '').trim();
    if (!sourceDate || !targetDate || !cardId || sourceDate === targetDate) {
      res.json({ success: true });
      return;
    }
    const storedPlan = parseJsonSetting<Record<string, any>>('meal_planner_plan_json', {});
    const srcCards = normalizeDayCards(storedPlan[sourceDate]);
    const cardIdx = srcCards.findIndex((c) => c.id === cardId);
    if (cardIdx < 0) {
      res.json({ success: true });
      return;
    }
    const [movedCard] = srcCards.splice(cardIdx, 1);
    const dstCards = normalizeDayCards(storedPlan[targetDate]);
    dstCards.push(movedCard);

    if (srcCards.length > 0) storedPlan[sourceDate] = srcCards;
    else delete storedPlan[sourceDate];
    storedPlan[targetDate] = dstCards;

    AppSetting.set('meal_planner_plan_json', JSON.stringify(storedPlan));
    const weekStart = getMondayOfWeek(targetDate);
    const { plan, cards_by_day } = getMealPlanForWeek(weekStart);
    res.json({ success: true, plan, cards_by_day });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message });
  }
});

// Legacy single-slot compatibility endpoint
householdRouter.post('/api/save_meal_plan', (req: Request, res: Response) => {
  const dateIso = String(req.body?.date_iso || '').trim();
  const value = String(req.body?.value || '').trim();
  const audience = String(req.body?.audience || 'Everyone').trim();
  const storedPlan = parseJsonSetting<Record<string, any>>('meal_planner_plan_json', {});
  const cards = normalizeDayCards(storedPlan[dateIso]);
  if (value) {
    cards.push({
      id: `card_${crypto.randomBytes(6).toString('hex')}`,
      title: value,
      audience,
      meal_key: value.toLowerCase().trim(),
    });
    storedPlan[dateIso] = cards;
  }
  AppSetting.set('meal_planner_plan_json', JSON.stringify(storedPlan));
  res.json({ success: true });
});

householdRouter.post('/api/add_meal_suggestion', (req: Request, res: Response) => {
  const meal = String(req.body?.meal || '').trim().slice(0, 80);
  if (!meal) {
    res.status(400).json({ success: false, error: 'Meal name required' });
    return;
  }
  const suggestions = getMealSuggestions();
  if (!suggestions.some((s) => s.toLowerCase() === meal.toLowerCase())) {
    suggestions.push(meal);
    AppSetting.set('meal_planner_suggestions_json', JSON.stringify(suggestions));
  }
  res.json({ success: true, suggestions });
});

householdRouter.post('/api/delete_meal_suggestion', (req: Request, res: Response) => {
  const meal = String(req.body?.meal || '').trim().toLowerCase();
  const suggestions = getMealSuggestions().filter((s) => s.toLowerCase() !== meal);
  AppSetting.set('meal_planner_suggestions_json', JSON.stringify(suggestions));
  res.json({ success: true, suggestions });
});

// Recipes CRUD + Notion Sync + Google Apps Script / Discord Webhook Import
householdRouter.get('/api/recipes', (_req: Request, res: Response) => {
  res.json({ success: true, recipes: getAllRecipes() });
});

householdRouter.post('/api/recipes', (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    if (!body.title) {
      res.status(400).json({ success: false, error: 'Recipe title is required' });
      return;
    }
    const saved = upsertRecipe({
      meal_key: body.meal_key,
      title: body.title,
      image_url: body.image_url,
      ingredients: Array.isArray(body.ingredients) ? body.ingredients : undefined,
      instructions: body.instructions,
      servings: body.servings,
      prep_time: body.prep_time,
      notion_id: body.notion_id,
    });
    logActivity('settings_updated', `Saved recipe "${saved.title}"`);
    res.json({ success: true, recipe: saved, recipes: getAllRecipes() });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'Failed to save recipe' });
  }
});

householdRouter.post('/api/recipes/delete', (req: Request, res: Response) => {
  const mealKey = String(req.body?.meal_key || '').trim().toLowerCase();
  if (mealKey) {
    db.prepare('DELETE FROM recipes WHERE meal_key = ?').run(mealKey);
    const ingMap = getMealIngredients();
    delete ingMap[mealKey];
    AppSetting.set('meal_ingredients_json', JSON.stringify(ingMap));
  }
  res.json({ success: true, recipes: getAllRecipes() });
});

// Webhook endpoint for Google Apps Script / Discord Recipe Transcriber
householdRouter.post('/api/recipes/import', (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const list = Array.isArray(body.recipes) ? body.recipes : [body];
    const imported: RecipeItem[] = [];
    for (const item of list) {
      const title = String(item?.title || item?.name || '').trim();
      if (!title) continue;
      let ings: Array<{ name: string; store: string; qty: string }> = [];
      if (Array.isArray(item.ingredients)) {
        ings = item.ingredients.map((i: any) => {
          if (typeof i === 'string') {
            return { name: i.trim(), qty: '', store: 'aldi' };
          }
          return {
            name: String(i?.name || i?.item || '').trim(),
            qty: String(i?.qty || i?.quantity || i?.amount || '').trim(),
            store: String(i?.store || 'aldi').trim() || 'aldi',
          };
        });
      } else if (typeof item.ingredients === 'string') {
        ings = item.ingredients
          .split(/\r?\n|,/)
          .map((line: string) => line.replace(/^[-*•]\s*/, '').trim())
          .filter(Boolean)
          .map((name: string) => ({ name, qty: '', store: 'aldi' }));
      }
      const instructions = Array.isArray(item.instructions)
        ? item.instructions.join('\n')
        : String(item.instructions || item.method || item.steps || '').trim();
      const rec = upsertRecipe({
        title,
        image_url: item.image_url || item.image || null,
        ingredients: ings,
        instructions,
        servings: String(item.servings || ''),
        prep_time: String(item.prep_time || ''),
        notion_id: item.notion_id || null,
      });
      imported.push(rec);
    }
    logActivity('settings_updated', `Imported ${imported.length} recipe(s) via webhook`);
    res.json({ success: true, imported_count: imported.length, recipes: imported });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'Recipe import failed' });
  }
});

// Helper to parse ingredient strings into structured { name, qty, store, prep, raw_name }
function parseNotionIngredientLine(raw: string): RecipeIngredient {
  let clean = String(raw || '').trim();
  // Strip bullet markers (- , * , 1. , 1) ) - requires whitespace after number dot to preserve decimals like 1.5kg
  clean = clean.replace(/^[-*•☐☑]\s*|^\d+[\.\)]\s+/, '').trim();
  if (!clean) return { name: '', qty: '', store: 'aldi' };

  // Match:
  // 1) Unicode fractions: ¼, ½, ¾, 1 ¼, etc.
  // 2) Standard fractions: 1/4, 1/2, 2 1/2
  // 3) Decimals & integers: 1.5, 0.5, 2, 750
  // Followed by optional measurement unit: g, kg, ml, l, oz, lb, cups?, tbs?, tbsp?, tsp?, cloves?, etc.
  const regex = /^((?:(?:\d+\s+)?[¼½¾⅓⅔⅛⅜⅝⅞]|\d+\s+\d+\/\d+|\d+(?:[\/.]\d+)?)\s*(?:g|kg|ml|l|oz|lb|cups?|tbsp?|tbs?|tablespoons?|teaspoons?|cloves?|cans?|tins?|pkts?|packets?|punnets?|pinch(?:es)?|bunch(?:es)?|slices?|stalks?|heads?)?)\s+(.*)$/i;
  const match = clean.match(regex);
  let qty = '';
  let name = clean;
  if (match && match[1] && match[2]) {
    qty = match[1].trim();
    name = match[2].trim();
  }

  if (name) name = name.charAt(0).toUpperCase() + name.slice(1);
  const { prep } = cleanIngredientBuyName(name);
  const detectedStore = detectStoreFromText(clean);

  return {
    name,
    qty,
    store: detectedStore || 'aldi',
    prep,
    raw_name: clean,
  };
}

// Helper to fetch all children blocks recursively expanding column_list and columns
async function fetchNotionBlocksExpanded(blockId: string, token: string): Promise<any[]> {
  const fetchChildren = async (id: string): Promise<any[]> => {
    const list: any[] = [];
    let cursor: string | undefined = undefined;
    do {
      const url = new URL(`https://api.notion.com/v1/blocks/${id}/children`);
      url.searchParams.set('page_size', '100');
      if (cursor) url.searchParams.set('start_cursor', cursor);

      const resp = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          'Notion-Version': '2022-06-28',
        },
      });
      if (!resp.ok) break;
      const data = (await resp.json()) as any;
      if (Array.isArray(data?.results)) list.push(...data.results);
      cursor = data?.has_more ? data.next_cursor : undefined;
    } while (cursor);
    return list;
  };

  const topBlocks = await fetchChildren(blockId);
  const flattened: any[] = [];

  for (const blk of topBlocks) {
    if (blk.type === 'column_list' && blk.has_children) {
      try {
        const columns = await fetchChildren(blk.id);
        for (const col of columns) {
          if (col.type === 'column' && col.has_children) {
            const colItems = await fetchChildren(col.id);
            flattened.push(...colItems);
          } else {
            flattened.push(col);
          }
        }
      } catch {
        flattened.push(blk);
      }
    } else {
      flattened.push(blk);
    }
  }

  return flattened;
}

// Notion Settings Endpoints
householdRouter.get('/api/settings/notion', (_req: Request, res: Response) => {
  const token = AppSetting.get('notion_api_token', '') || '';
  const rawDbId = AppSetting.get('notion_database_id', '') || '';
  res.json({
    success: true,
    configured: Boolean(token && rawDbId),
    has_token: Boolean(token),
    database_id: rawDbId,
    masked_token: token ? `${token.slice(0, 7)}••••••••${token.slice(-4)}` : '',
  });
});

householdRouter.post('/api/settings/notion', (req: Request, res: Response) => {
  try {
    const token = req.body?.notion_token !== undefined ? String(req.body.notion_token).trim() : null;
    const rawDbId = req.body?.database_id !== undefined ? String(req.body.database_id).trim() : null;

    if (token !== null && token !== '') AppSetting.set('notion_api_token', token);
    if (rawDbId !== null) AppSetting.set('notion_database_id', rawDbId);

    logActivity('settings_updated', 'Updated Notion Recipe integration settings');
    res.json({ success: true, message: 'Notion settings saved successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to save settings' });
  }
});

householdRouter.post('/api/settings/test_notion', async (req: Request, res: Response) => {
  try {
    const token = String(req.body?.notion_token || AppSetting.get('notion_api_token', '') || '').trim();
    const rawDbId = String(req.body?.database_id || AppSetting.get('notion_database_id', '') || '').trim();

    if (!token) {
      res.status(400).json({ success: false, error: 'Please enter a Notion Integration Token.' });
      return;
    }
    if (!rawDbId) {
      res.status(400).json({ success: false, error: 'Please enter a Notion Database ID or URL.' });
      return;
    }

    const matchId = rawDbId.match(/([a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
    const dbId = matchId ? matchId[1].replace(/-/g, '') : rawDbId.replace(/-/g, '');

    const dbResp = await fetch(`https://api.notion.com/v1/databases/${dbId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
      },
    });

    if (!dbResp.ok) {
      const errText = await dbResp.text();
      res.status(400).json({
        success: false,
        error: `Notion returned status ${dbResp.status}: ${errText.slice(0, 180)}`,
      });
      return;
    }

    const dbData = (await dbResp.json()) as any;
    const titleArr = dbData?.title || [];
    const dbTitle = titleArr.map((t: any) => t?.plain_text || '').join('') || 'Untitled Database';

    res.json({
      success: true,
      database_title: dbTitle,
      message: `Connected successfully to Notion database "${dbTitle}"!`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Connection test failed' });
  }
});

// Comprehensive Notion Database Sync endpoint
householdRouter.post('/api/recipes/sync_notion', async (req: Request, res: Response) => {
  try {
    const token = String(req.body?.notion_token ?? AppSetting.get('notion_api_token', '') ?? '').trim();
    const rawDbId = String(req.body?.database_id ?? AppSetting.get('notion_database_id', '') ?? '').trim();
    if (req.body?.notion_token !== undefined && String(req.body.notion_token).trim()) {
      AppSetting.set('notion_api_token', token);
    }
    if (req.body?.database_id !== undefined && String(req.body.database_id).trim()) {
      AppSetting.set('notion_database_id', rawDbId);
    }

    if (!token || !rawDbId) {
      res.status(400).json({
        success: false,
        error: 'Notion integration is not configured. Go to Settings -> Integrations to enter your Notion Token and Database ID.',
      });
      return;
    }

    // Extract 32-char hex ID if user pasted a full Notion URL
    const matchId = rawDbId.match(/([a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
    const dbId = matchId ? matchId[1].replace(/-/g, '') : rawDbId.replace(/-/g, '');

    // Query database with pagination support
    const allPages: any[] = [];
    let queryCursor: string | undefined = undefined;

    do {
      const queryResp = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          page_size: 100,
          ...(queryCursor ? { start_cursor: queryCursor } : {}),
        }),
      });

      if (!queryResp.ok) {
        const errText = await queryResp.text();
        res.status(400).json({
          success: false,
          error: `Notion API error (${queryResp.status}): ${errText.slice(0, 200)}`,
        });
        return;
      }

      const queryData = (await queryResp.json()) as any;
      if (Array.isArray(queryData?.results)) {
        allPages.push(...queryData.results);
      }
      queryCursor = queryData?.has_more ? queryData.next_cursor : undefined;
    } while (queryCursor);

    let syncedCount = 0;

    const extractRichText = (arr: any[]): string =>
      Array.isArray(arr) ? arr.map((t: any) => t?.plain_text || '').join('') : '';

    for (const page of allPages) {
      const props = page.properties || {};

      // 1. Title / Name
      let title = '';
      const nameProp = props['Name'] || Object.values(props).find((p: any) => p?.type === 'title');
      if (nameProp?.type === 'title') {
        title = extractRichText(nameProp.title).trim();
      }
      if (!title) continue;

      // 2. Cover / Image
      let imageUrl: string | null = page.cover?.external?.url || page.cover?.file?.url || null;
      if (!imageUrl && props['Image']?.type === 'files' && props['Image'].files?.length > 0) {
        imageUrl = props['Image'].files[0]?.external?.url || props['Image'].files[0]?.file?.url || null;
      }

      // 3. Servings
      let servings = '';
      if (props['Servings']?.type === 'number' && props['Servings'].number != null) {
        servings = `${props['Servings'].number} servings`;
      }

      // 4. Prep Time / Cuisine / Type tags
      const mealType = props['Type']?.type === 'select' ? props['Type'].select?.name : '';
      const cuisine = props['Cuisine']?.type === 'select' ? props['Cuisine'].select?.name : '';
      const tags = (props['Tags']?.type === 'multi_select' ? props['Tags'].multi_select : [])
        .map((t: any) => t?.name)
        .filter(Boolean);
      const metaParts = [mealType, cuisine, tags.slice(0, 2).join(', ')].filter(Boolean);
      const prepTime = metaParts.length > 0 ? metaParts.join(' • ') : '25 mins';

      // 5. Ingredients and Directions from Body Blocks
      let ingredients: Array<{ name: string; qty: string; store: string }> = [];
      let instructionsText = '';

      try {
        const blocks = await fetchNotionBlocksExpanded(page.id, token);
        let currentSection: 'ingredients' | 'directions' | 'notes' | 'none' = 'none';
        const parsedIngs: Array<{ name: string; qty: string; store: string }> = [];
        const dirSteps: string[] = [];
        const notesLines: string[] = [];

        for (const blk of blocks) {
          const bType = blk.type;
          const rich = blk[bType]?.rich_text;
          const line = extractRichText(rich).trim();

          // Image block check
          if (!line && bType === 'image' && !imageUrl) {
            imageUrl = blk.image?.external?.url || blk.image?.file?.url || null;
            continue;
          }

          if (bType.startsWith('heading_')) {
            const lower = line.toLowerCase();
            if (lower.includes('ingred')) {
              currentSection = 'ingredients';
            } else if (
              lower.includes('direct') ||
              lower.includes('step') ||
              lower.includes('method') ||
              lower.includes('instruct')
            ) {
              currentSection = 'directions';
            } else if (lower.includes('note')) {
              currentSection = 'notes';
            } else {
              currentSection = 'none';
            }
            continue;
          }

          if (!line) continue;

          if (currentSection === 'ingredients') {
            const item = parseNotionIngredientLine(line);
            if (item.name) parsedIngs.push(item);
          } else if (currentSection === 'directions') {
            dirSteps.push(line);
          } else if (currentSection === 'notes') {
            notesLines.push(line);
          } else {
            // If outside a detected heading, infer based on block type
            if (bType === 'bulleted_list_item' || bType === 'to_do') {
              const item = parseNotionIngredientLine(line);
              if (item.name) parsedIngs.push(item);
            } else if (bType === 'numbered_list_item') {
              dirSteps.push(line);
            } else {
              dirSteps.push(line);
            }
          }
        }

        ingredients = parsedIngs;
        if (dirSteps.length > 0) {
          instructionsText = dirSteps.map((s, idx) => `${idx + 1}. ${s}`).join('\n\n');
        }
        if (notesLines.length > 0) {
          instructionsText += (instructionsText ? '\n\nNotes:\n' : '') + notesLines.map((n) => `• ${n}`).join('\n');
        }
      } catch {
        // block read error fallback
      }

      upsertRecipe({
        title,
        image_url: imageUrl,
        ingredients,
        instructions: instructionsText,
        servings,
        prep_time: prepTime,
        notion_id: page.id,
      });
      syncedCount++;
    }

    logActivity('settings_updated', `Synced ${syncedCount} recipe(s) from Notion`);
    res.json({
      success: true,
      synced_count: syncedCount,
      recipes: getAllRecipes(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Notion sync failed' });
  }
});

householdRouter.post('/api/save_meal_ingredients', (req: Request, res: Response) => {
  const mealKey = String(req.body?.meal || '').trim().toLowerCase().slice(0, 80);
  const items = Array.isArray(req.body?.ingredients) ? req.body.ingredients : [];
  if (!mealKey) {
    res.status(400).json({ success: false, error: 'Meal key required' });
    return;
  }
  const existingRecipes = getAllRecipes();
  const existingRec = existingRecipes[mealKey];
  upsertRecipe({
    meal_key: mealKey,
    title: existingRec?.title || mealKey.charAt(0).toUpperCase() + mealKey.slice(1),
    ingredients: items,
    instructions: req.body?.instructions !== undefined ? String(req.body.instructions) : existingRec?.instructions,
  });
  res.json({ success: true, ingredients: getMealIngredients() });
});

// Smart Shopping List Endpoints (Deduplication, Frequently Added, Suggested, Archive Checked, Recently Purchased)
householdRouter.post('/api/add_general_shopping_item', (req: Request, res: Response) => {
  const rawInput = String(req.body?.name || '').trim().slice(0, 120);
  let qty = String(req.body?.qty || '').trim().slice(0, 40);
  if (qty.startsWith('.')) qty = '0' + qty;
  const storeInput = String(req.body?.store || '').trim();
  if (!rawInput) {
    res.status(400).json({ success: false, error: 'Item name required' });
    return;
  }

  const stores = getShoppingStores();
  const detectedStore = detectStoreFromText(rawInput, stores);
  const cleanName = cleanShoppingItemName(rawInput) || rawInput;

  if (!qty) {
    const qMatch = rawInput.match(
      /^((?:(?:\d+\s+)?[¼½¾⅓⅔⅛⅜⅝⅞]|\d+\s+\d+\/\d+|\d+(?:[\/.]\d+)?|\.\d+)\s*(?:g|kg|ml|l|oz|lb|cups?|tbsp?|tbs?|tablespoons?|teaspoons?|cloves?|cans?|tins?|pkts?|packets?|punnets?|pinch(?:es)?|bunch(?:es)?|slices?|stalks?|heads?)?)\s+/i
    );
    if (qMatch && qMatch[1]) {
      qty = qMatch[1].trim();
      if (qty.startsWith('.')) qty = '0' + qty;
    }
  }

  const targetStore = detectedStore || storeInput || 'aldi';
  const norm = normalizeShoppingKey(cleanName);
  const catEntry = touchCatalogItemOnAdd(cleanName, targetStore, true);
  const canonicalName = catEntry?.name || cleanName;
  const finalStore = targetStore || catEntry?.default_store || 'aldi';

  const current = getShoppingData();
  const existingIdx = current.general.findIndex(
    (g: any) => normalizeShoppingKey(g.name) === norm
  );

  let deduplicated = false;
  if (existingIdx >= 0) {
    current.general[existingIdx].checked = false;
    if (qty) current.general[existingIdx].qty = qty;
    if (finalStore) current.general[existingIdx].store = finalStore;
    const itemKey = `general::${String(current.general[existingIdx].name).toLowerCase()}`;
    delete current.checked[itemKey];
    deduplicated = true;
  } else {
    current.general.push({
      id: `shop_${crypto.randomBytes(6).toString('hex')}`,
      name: canonicalName,
      qty: qty || '',
      store: finalStore,
      checked: false,
    });
    const itemKey = `general::${canonicalName.toLowerCase()}`;
    delete current.checked[itemKey];
  }

  AppSetting.set('shopping_list_json', JSON.stringify(current));
  res.json({
    success: true,
    deduplicated,
    canonical_name: canonicalName,
    ...current,
  });
});

householdRouter.post('/api/shopping/batch_add', (req: Request, res: Response) => {
  const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
  const current = getShoppingData();
  const stores = getShoppingStores();
  let addedCount = 0;

  for (const it of rawItems) {
    const rawInput = String(typeof it === 'string' ? it : it?.name || '').trim().slice(0, 120);
    if (!rawInput) continue;
    const cleanName = cleanShoppingItemName(rawInput) || rawInput;

    // Detect store: priority to brand detected in ingredient text (e.g. Coles Australian Lamb -> Coles)
    const detectedStore = detectStoreFromText(rawInput, stores);
    const storeInput = typeof it === 'object' && it?.store ? String(it.store).trim() : '';
    const targetStore = detectedStore || storeInput || 'aldi';

    // Quantity extraction & normalization
    let qty = typeof it === 'object' && it?.qty ? String(it.qty).trim() : '';
    if (qty.startsWith('.')) qty = '0' + qty;
    if (!qty) {
      const qMatch = rawInput.match(
        /^((?:(?:\d+\s+)?[¼½¾⅓⅔⅛⅜⅝⅞]|\d+\s+\d+\/\d+|\d+(?:[\/.]\d+)?|\.\d+)\s*(?:g|kg|ml|l|oz|lb|cups?|tbsp?|tbs?|tablespoons?|teaspoons?|cloves?|cans?|tins?|pkts?|packets?|punnets?|pinch(?:es)?|bunch(?:es)?|slices?|stalks?|heads?)?)\s+/i
      );
      if (qMatch && qMatch[1]) {
        qty = qMatch[1].trim();
        if (qty.startsWith('.')) qty = '0' + qty;
      }
    }

    const norm = normalizeShoppingKey(cleanName);
    const catEntry = touchCatalogItemOnAdd(cleanName, targetStore, true);
    const canonicalName = catEntry?.name || cleanName;
    const finalStore = targetStore || catEntry?.default_store || 'aldi';

    const existingIdx = current.general.findIndex((g: any) => normalizeShoppingKey(g.name) === norm);
    if (existingIdx >= 0) {
      current.general[existingIdx].checked = false;
      if (qty && !current.general[existingIdx].qty) {
        current.general[existingIdx].qty = qty;
      }
      if (finalStore && current.general[existingIdx].store !== finalStore) {
        current.general[existingIdx].store = finalStore;
      }
      const itemKey = `general::${String(current.general[existingIdx].name).toLowerCase()}`;
      delete current.checked[itemKey];
    } else {
      current.general.push({
        id: `shop_${crypto.randomBytes(6).toString('hex')}`,
        name: canonicalName,
        qty: qty || '',
        store: finalStore,
        checked: false,
      });
      const itemKey = `general::${canonicalName.toLowerCase()}`;
      delete current.checked[itemKey];
      addedCount++;
    }
  }

  AppSetting.set('shopping_list_json', JSON.stringify(current));
  res.json({ success: true, added_count: addedCount, ...current });
});

householdRouter.post('/api/update_shopping_item', (req: Request, res: Response) => {
  const key = String(req.body?.key || '').trim();
  const checked = Boolean(req.body?.checked);
  const current = getShoppingData();
  if (key) {
    if (checked) current.checked[key] = true;
    else delete current.checked[key];

    if (key.startsWith('general::')) {
      const lowerName = key.slice('general::'.length).toLowerCase();
      current.general = current.general.map((g: any) =>
        String(g.name || '').toLowerCase() === lowerName ? { ...g, checked } : g
      );
    }
  }
  AppSetting.set('shopping_list_json', JSON.stringify(current));
  res.json({ success: true, ...current });
});

householdRouter.post('/api/remove_shopping_item', (req: Request, res: Response) => {
  const itemId = String(req.body?.id || '').trim();
  const itemName = String(req.body?.name || '').trim();
  const norm = normalizeShoppingKey(itemName);
  const current = getShoppingData();
  current.general = current.general.filter((g: any) => {
    if (itemId && g.id === itemId) return false;
    if (itemName && normalizeShoppingKey(g.name) === norm) return false;
    return true;
  });
  const itemKey = `general::${itemName.toLowerCase()}`;
  delete current.checked[itemKey];
  AppSetting.set('shopping_list_json', JSON.stringify(current));
  res.json({ success: true, ...current });
});

// Archive all checked items (marks them as Purchased in SQLite, logs purchase timestamp, and moves to archived list)
function handleArchiveCheckedShopping(_req: Request, res: Response) {
  const current = getShoppingData();
  const nowIso = new Date().toISOString();
  const remainingGeneral: any[] = [];
  let purchasedCount = 0;

  for (const g of current.general) {
    const itemKey = `general::${String(g.name || '').toLowerCase()}`;
    const isChecked = Boolean(g.checked || current.checked[itemKey]);
    if (isChecked) {
      recordCatalogPurchase(g.name, g.store || 'aldi', g.qty || '');
      current.archived.unshift({
        name: g.name,
        store: g.store || 'aldi',
        qty: g.qty || '',
        purchased_at: nowIso,
      });
      delete current.checked[itemKey];
      purchasedCount++;
    } else {
      remainingGeneral.push(g);
    }
  }

  // Also record meal ingredients that were checked off
  const ingMap = getMealIngredients();
  for (const [chkKey, isChk] of Object.entries(current.checked)) {
    if (!isChk) continue;
    if (chkKey.startsWith('meal::')) {
      const parts = chkKey.split('::');
      const mealKey = parts[1] || '';
      const ingLower = parts[2] || '';
      const matchIng = (ingMap[mealKey] || []).find((i) => i.name.toLowerCase() === ingLower);
      const displayName = matchIng?.name || ingLower;
      const store = matchIng?.store || 'aldi';
      recordCatalogPurchase(displayName, store, matchIng?.qty || '');
      current.archived.unshift({
        name: displayName,
        store,
        qty: matchIng?.qty || '',
        purchased_at: nowIso,
      });
      // Hide checked meal ingredient until unchecked or re-added
      current.hidden[chkKey] = true;
      delete current.checked[chkKey];
      purchasedCount++;
    }
  }

  current.general = remainingGeneral;
  current.archived = current.archived.slice(0, 80);
  AppSetting.set('shopping_list_json', JSON.stringify(current));
  res.json({ success: true, purchased_count: purchasedCount, archived_count: purchasedCount, ...current });
}

householdRouter.post('/api/shopping/archive_checked', handleArchiveCheckedShopping);
householdRouter.post('/api/clear_shopping_checked', handleArchiveCheckedShopping);

householdRouter.post('/api/save_shopping_stores', (req: Request, res: Response) => {
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
  if (cleaned.length > 0) {
    AppSetting.set('shopping_stores_json', JSON.stringify(cleaned));
  }
  res.json({ success: true, stores: getShoppingStores() });
});

// Notes, Text Pads & Dashboard Sticky Notes individual action endpoints
householdRouter.post('/api/add_kanban_note', (req: Request, res: Response) => {
  const columnId = String(req.body?.column_id || 'col-todo').trim();
  const text = String(req.body?.text || '').trim().slice(0, 1000);
  if (!text) {
    res.status(400).json({ success: false, error: 'Note text required' });
    return;
  }
  const nk = getNotesKanban();
  nk.notes.push({
    id: `note_${crypto.randomBytes(6).toString('hex')}`,
    column_id: columnId,
    text,
    checked: false,
    deleted: false,
  });
  AppSetting.set('notes_kanban_json', JSON.stringify(nk));
  res.json({ success: true, ...nk });
});

householdRouter.post('/api/update_kanban_note', (req: Request, res: Response) => {
  const noteId = String(req.body?.id || '').trim();
  const nk = getNotesKanban();
  nk.notes = nk.notes.map((n: any) =>
    n.id === noteId ? { ...n, checked: Boolean(req.body?.checked) } : n
  );
  AppSetting.set('notes_kanban_json', JSON.stringify(nk));
  res.json({ success: true, ...nk });
});

householdRouter.post('/api/delete_kanban_note', (req: Request, res: Response) => {
  const noteId = String(req.body?.id || '').trim();
  const permanent = Boolean(req.body?.permanent);
  const nk = getNotesKanban();
  if (permanent) {
    nk.notes = nk.notes.filter((n: any) => n.id !== noteId);
  } else {
    nk.notes = nk.notes.map((n: any) =>
      n.id === noteId ? { ...n, deleted: true, deleted_at: new Date().toISOString() } : n
    );
  }
  AppSetting.set('notes_kanban_json', JSON.stringify(nk));
  res.json({ success: true, ...nk });
});

householdRouter.post('/api/add_note_column', (req: Request, res: Response) => {
  const title = String(req.body?.title || '').trim().slice(0, 60);
  const color = String(req.body?.color || '#fef08a').trim();
  if (!title) {
    res.status(400).json({ success: false, error: 'Column title required' });
    return;
  }
  const nk = getNotesKanban();
  nk.columns.push({
    id: `col_${crypto.randomBytes(5).toString('hex')}`,
    title,
    color,
    order: nk.columns.length,
  });
  AppSetting.set('notes_kanban_json', JSON.stringify(nk));
  res.json({ success: true, ...nk });
});

householdRouter.post('/api/delete_note_column', (req: Request, res: Response) => {
  const colId = String(req.body?.id || '').trim();
  const nk = getNotesKanban();
  nk.columns = nk.columns.filter((c: any) => c.id !== colId);
  nk.notes = nk.notes.filter((n: any) => n.column_id !== colId);
  AppSetting.set('notes_kanban_json', JSON.stringify(nk));
  res.json({ success: true, ...nk });
});

householdRouter.post('/api/add_text_pad', (req: Request, res: Response) => {
  const pads = getTextPads();
  pads.push({
    id: `pad_${crypto.randomBytes(6).toString('hex')}`,
    title: String(req.body?.title || 'Untitled').trim().slice(0, 80),
    content: String(req.body?.content || '').slice(0, 100000),
    created_at: new Date().toISOString(),
  });
  AppSetting.set('text_pads_json', JSON.stringify(pads));
  res.json({ success: true, pads });
});

householdRouter.post('/api/update_text_pad', (req: Request, res: Response) => {
  const padId = String(req.body?.id || '').trim();
  const pads = getTextPads().map((p: any) =>
    p.id === padId
      ? {
          ...p,
          title: req.body?.title !== undefined ? String(req.body.title).slice(0, 80) : p.title,
          content: req.body?.content !== undefined ? String(req.body.content).slice(0, 100000) : p.content,
        }
      : p
  );
  AppSetting.set('text_pads_json', JSON.stringify(pads));
  res.json({ success: true, pads });
});

householdRouter.post('/api/delete_text_pad', (req: Request, res: Response) => {
  const padId = String(req.body?.id || '').trim();
  const pads = getTextPads().filter((p: any) => p.id !== padId);
  AppSetting.set('text_pads_json', JSON.stringify(pads));
  res.json({ success: true, pads });
});

householdRouter.post('/api/add_dashboard_note', (req: Request, res: Response) => {
  const notes = getDashboardNotes();
  notes.push({
    id: `dnote_${crypto.randomBytes(6).toString('hex')}`,
    title: String(req.body?.title || '').trim().slice(0, 120),
    text: String(req.body?.text || '').trim().slice(0, 2000),
    color: ALLOWED_STICKY_COLORS.includes(req.body?.color) ? req.body.color : '#fef08a',
  });
  AppSetting.set('dashboard_notes_json', JSON.stringify(notes));
  res.json({ success: true, notes });
});

householdRouter.post('/api/delete_dashboard_note', (req: Request, res: Response) => {
  const noteId = String(req.body?.id || '').trim();
  const notes = getDashboardNotes().filter((n: any) => n.id !== noteId);
  AppSetting.set('dashboard_notes_json', JSON.stringify(notes));
  res.json({ success: true, notes });
});

/**
 * Migration routine: Cleans existing recipe ingredients in the database to separate
 * the purchase item (e.g. "Fresh ginger") from preparation instructions (e.g. "grated"),
 * and standardizes active shopping list items.
 */
export function migrateExistingRecipeIngredients() {
  try {
    const rows = db.prepare('SELECT id, meal_key, ingredients_json FROM recipes').all() as any[];
    let recipesMigrated = 0;
    const ingMap = getMealIngredients();
    const stores = getShoppingStores();

    for (const row of rows) {
      if (!row.ingredients_json) continue;
      try {
        const ings = JSON.parse(row.ingredients_json);
        if (!Array.isArray(ings)) continue;
        let changed = false;
        const restored: RecipeIngredient[] = ings.map((i: any) => {
          const raw = String(i?.raw_name || i?.name || '').trim();
          let itemQty = String(i?.qty || '').trim();
          if (itemQty.startsWith('.')) itemQty = '0' + itemQty;

          const detectedStore = detectStoreFromText(raw + ' ' + (i.name || ''), stores);
          const targetStore = detectedStore || i.store || 'aldi';

          if (targetStore !== i.store || itemQty !== i.qty) {
            changed = true;
          }
          return {
            name: i.name || raw,
            qty: itemQty,
            store: targetStore,
            prep: i.prep,
            raw_name: raw || i.name,
          };
        });

        if (changed) {
          db.prepare('UPDATE recipes SET ingredients_json = ? WHERE id = ?').run(
            JSON.stringify(restored),
            row.id
          );
          if (row.meal_key) {
            ingMap[row.meal_key.toLowerCase().trim()] = restored;
          }
          recipesMigrated++;
        }
      } catch {
        // ignore parse error
      }
    }

    if (recipesMigrated > 0) {
      AppSetting.set('meal_ingredients_json', JSON.stringify(ingMap));
      console.log(`[household] Updated ${recipesMigrated} recipe(s) with store detection and quantity normalization.`);
    }

    // Clean active shopping list items using cleanShoppingItemName, store detection, and quantity normalization
    const shoppingData = getShoppingData();
    let shopChanged = false;
    shoppingData.general = (shoppingData.general || []).map((it: any) => {
      let cleanName = cleanShoppingItemName(it.name) || it.name;
      let itQty = String(it.qty || '').trim();
      let itStore = it.store || 'aldi';

      if (itQty.startsWith('.')) {
        itQty = '0' + itQty;
        shopChanged = true;
      }

      // Detect store from item name or raw_name
      const detectedStore = detectStoreFromText(it.name + ' ' + (it.raw_name || ''), stores);
      if (detectedStore && detectedStore !== itStore) {
        itStore = detectedStore;
        shopChanged = true;
      }

      // Check specifically for Australian Lamb leg
      if (
        (cleanName.toLowerCase().includes('lamb full leg') ||
          cleanName.toLowerCase().includes('australian lamb')) &&
        (itStore === 'aldi' || !itQty || itQty === '.8kg')
      ) {
        const colesStore =
          stores.find(
            (s) => s.id.toLowerCase().includes('coles') || s.name.toLowerCase().includes('coles')
          )?.id || 'coles-7129';
        itStore = colesStore;
        if (!itQty || itQty === '.8kg') itQty = '0.8kg';
        shopChanged = true;
      }

      if (cleanName !== it.name || itQty !== it.qty || itStore !== it.store) {
        shopChanged = true;
        return { ...it, name: cleanName, qty: itQty, store: itStore };
      }
      return it;
    });

    if (shopChanged) {
      AppSetting.set('shopping_list_json', JSON.stringify(shoppingData));
      console.log('[household] Cleaned active shopping list items with store and quantity.');
    }
  } catch (err) {
    console.error('[household] Migration error:', err);
  }
}

// Run migration on startup
migrateExistingRecipeIngredients();
