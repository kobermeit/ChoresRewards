import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { AppSetting, logActivity, normalizeShoppingKey } from '../db';
import { sqlAll, sqlOne, sqlRun } from '../db/sql';
import { UPLOADS_DIR } from '../config';
import { downloadAndStoreImage } from '../services/imageDownloader';
import { getMondayOfWeek, addDays } from '../utils/time';
import {
  getGeminiApiKey,
  getGeminiModel,
  testGeminiConnection,
  transcribeRecipeImage,
} from '../services/gemini';

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
  uncataloged?: boolean;
  in_pantry?: boolean;
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

  // 8. Remove measurement units / words only when preceded by a quantity or followed by 'of'
  // (e.g. "1 cup flour" -> "flour", but preserve "Fruit cup", "Reese's cup")
  text = text.replace(/(^|\s)\b(tsp|tbsp|tbs|tablespoons?|teaspoons?|cloves?|pinch|pinches|dash|handfuls?|sprigs?)\b/gi, ' ').trim();
  text = text.replace(/(^|\s)\bcups?\s+of\b/gi, ' ').trim();

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

export function resolveShoppingQuantity(rawQty: string): string {
  const trimmed = String(rawQty || '').trim();
  if (!trimmed) return '1';

  const measurementUnits = /^(?:(?:\d+\s+)?[¼½¾⅓⅔⅛⅜⅝⅞]|\d+(?:[\/.\d]+)?|\.\d+)\s*(?:g|grams?|kg|kilos?|kilograms?|ml|mls|mils?|milliliters?|millilitres?|l|liters?|litres?|oz|ounces?|lbs?|pounds?|cups?|tbsp?|tbs?|tablespoons?|teaspoons?|tsp?|tsps?|pinch(?:es)?|dash(?:es)?|handfuls?|sprigs?|stalks?|slices?)$/i;

  if (measurementUnits.test(trimmed)) {
    return '1';
  }

  const containerMatch = trimmed.match(/^(\d+(?:[\/.\d]+)?)\s*(cans?|tins?|pkts?|packets?|punnets?|bunches?|heads?|bags?|bottles?|boxes?)$/i);
  if (containerMatch) {
    return `${containerMatch[1]} ${containerMatch[2]}`.trim();
  }

  const countMatch = trimmed.match(/^(\d+(?:[\/.\d]+)?)(?:\s+(?:large|medium|small|cloves?|x|pcs?|pieces?|count|ea|each))?$/i);
  if (countMatch && countMatch[1]) {
    if (/cloves?/i.test(trimmed)) {
      return '1';
    }
    return countMatch[1];
  }

  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }

  return '1';
}

let pantryStaplesCache: string[] | null = null;

export async function hydratePantryCache(): Promise<string[]> {
  try {
    const rows = await sqlAll('SELECT name FROM shopping_catalog WHERE is_staple = true ORDER BY name ASC') as Array<{ name: string }>;
    pantryStaplesCache = rows.map((r) => r.name);
  } catch {
    pantryStaplesCache = [];
  }
  return pantryStaplesCache;
}

export function invalidatePantryCache(): void {
  pantryStaplesCache = null;
}

export function getPantryItems(): string[] {
  if (pantryStaplesCache !== null) return pantryStaplesCache;
  return [];
}

export function isPantryItem(name: string): boolean {
  if (!name) return false;
  const clean = normalizeShoppingKey(name);
  const items = getPantryItems().map((p) => normalizeShoppingKey(p));
  return items.some((p) => clean === p || clean.includes(p) || p.includes(clean));
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

export function getMealPlanForWeek(weekStartIso: string, numWeeks = 2) {
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

  const totalDays = Math.max(7, numWeeks * 7);
  for (let i = 0; i < totalDays; i++) {
    const dateIso = addDays(weekStartIso, i);
    const dayCards = normalizeDayCards(storedPlan[dateIso]);
    cardsByDay[dateIso] = dayCards;
    // Keep backwards-compatible summary in plan[dateIso] while also exposing cards_by_day
    plan[dateIso] = dayCards;
  }

  return { plan, cards_by_day: cardsByDay, recurring };
}

export async function getAllRecipes(): Promise<Record<string, RecipeItem>> {
  let rows: Array<any> = [];
  try {
    rows = await sqlAll('SELECT * FROM recipes ORDER BY title') as Array<any>;
  } catch {
    rows = [];
  }
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

export async function upsertRecipe(input: {
  meal_key?: string;
  title: string;
  image_url?: string | null;
  ingredients?: RecipeIngredient[];
  instructions?: string;
  servings?: string;
  prep_time?: string;
  notion_id?: string | null;
}): Promise<RecipeItem> {
  const title = String(input.title || '').trim() || 'Untitled Recipe';
  const mealKey = String(input.meal_key || title).toLowerCase().trim();
  let existing: any = null;
  try {
    existing = await sqlOne('SELECT * FROM recipes WHERE meal_key = ?', [mealKey]) as any;
  } catch {
    existing = null;
  }

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
  let imageUrl =
    input.image_url !== undefined ? input.image_url : existing?.image_url || getMealImages()[mealKey] || null;
  if (imageUrl && /^https?:\/\//i.test(imageUrl)) {
    imageUrl = await downloadAndStoreImage(imageUrl, 'meals');
  }
  const servings = input.servings !== undefined ? String(input.servings) : existing?.servings || '';
  const prepTime = input.prep_time !== undefined ? String(input.prep_time) : existing?.prep_time || '';
  const notionId = input.notion_id !== undefined ? input.notion_id : existing?.notion_id || null;

  try {
    await sqlRun(`
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
    `, [mealKey, title, imageUrl, JSON.stringify(cleanedIngs), instructions, servings, prepTime, notionId]);
  } catch (err: any) {
    console.warn('[recipes] Database unavailable, falling back to JSON settings:', err?.message || err);
  }

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

export async function touchCatalogItemOnAdd(rawName: string, store = 'aldi', incrementCount = true) {
  const { buyName } = cleanIngredientBuyName(rawName);
  const cleanName = buyName || String(rawName || '').trim();
  if (!cleanName) return null;
  const norm = normalizeShoppingKey(cleanName);
  const nowIso = new Date().toISOString();
  try {
    const existing = await sqlOne('SELECT * FROM shopping_catalog WHERE normalized_key = ?', [norm]) as any;
    if (existing) {
      if (incrementCount) {
        await sqlRun(`
          UPDATE shopping_catalog
          SET times_added = COALESCE(times_added, 0) + 1,
              last_added_at = ?,
              default_store = COALESCE(?, default_store)
          WHERE id = ?
        `, [nowIso, store || existing.default_store, existing.id]);
      }
      return await sqlOne('SELECT * FROM shopping_catalog WHERE id = ?', [existing.id]) as any;
    } else {
      const info = await sqlRun(`
        INSERT INTO shopping_catalog (name, normalized_key, default_store, times_added, times_purchased, last_added_at)
        VALUES (?, ?, ?, 1, 0, ?)
      `, [cleanName, norm, store || 'aldi', nowIso]);
      return await sqlOne('SELECT * FROM shopping_catalog WHERE id = ?', [info.lastInsertRowid]) as any;
    }
  } catch (err: any) {
    return { name: cleanName, default_store: store || 'aldi' };
  }
}

/**
 * Calculates the average purchase interval in days for a catalog item based on its historical
 * purchase events in `shopping_purchase_log`. Purchases within the same 12-hour window are clustered
 * as a single shopping trip. Returns an exponential moving average (EMA) or null if fewer than 2 trips.
 */
export async function calculateCatalogInterval(catalogId: number): Promise<number | null> {
  try {
    const logs = await sqlAll(`
      SELECT purchased_at
      FROM shopping_purchase_log
      WHERE catalog_id = ?
      ORDER BY purchased_at ASC
    `, [catalogId]) as Array<{ purchased_at: string }>;

    if (!logs || logs.length < 2) return null;

    const tripTimes: number[] = [];
    for (const row of logs) {
      if (!row.purchased_at) continue;
      const t = new Date(row.purchased_at).getTime();
      if (isNaN(t)) continue;
      if (tripTimes.length === 0) {
        tripTimes.push(t);
      } else {
        const lastT = tripTimes[tripTimes.length - 1];
        if (t - lastT >= 12 * 3600 * 1000) {
          tripTimes.push(t);
        }
      }
    }

    if (tripTimes.length < 2) return null;

    let runningAvg: number | null = null;
    for (let i = 1; i < tripTimes.length; i++) {
      const gapDays = (tripTimes[i] - tripTimes[i - 1]) / (1000 * 86400);
      if (gapDays >= 0.5 && gapDays <= 180) {
        if (runningAvg === null) {
          runningAvg = gapDays;
        } else {
          runningAvg = runningAvg * 0.65 + gapDays * 0.35;
        }
      }
    }

    return runningAvg !== null ? Number(runningAvg.toFixed(1)) : null;
  } catch (err) {
    console.warn('[household] calculateCatalogInterval error:', err);
    return null;
  }
}

export async function recordCatalogPurchase(rawName: string, store = 'aldi', qty = '') {
  const cleanName = String(rawName || '').trim();
  if (!cleanName) return;
  const norm = normalizeShoppingKey(cleanName);
  const now = new Date();
  const nowIso = now.toISOString();

  let cat = await sqlOne('SELECT * FROM shopping_catalog WHERE normalized_key = ?', [norm]) as any;
  if (!cat) {
    const info = await sqlRun(`
      INSERT INTO shopping_catalog (name, normalized_key, default_store, times_added, times_purchased, last_added_at, last_purchased_at, created_at, updated_at)
      VALUES (?, ?, ?, 1, 1, ?, ?, ?, ?)
    `, [cleanName, norm, store || 'aldi', nowIso, nowIso, nowIso, nowIso]);
    cat = await sqlOne('SELECT * FROM shopping_catalog WHERE id = ?', [info.lastInsertRowid]) as any;
  }

  // Insert purchase log record
  await sqlRun(`
    INSERT INTO shopping_purchase_log (catalog_id, purchased_at, store, qty, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [cat.id, nowIso, store || cat.default_store || 'aldi', qty || '', nowIso, nowIso]);

  // Derive exact purchase count and interval from purchase log
  const countRow = await sqlOne(`
    SELECT COUNT(*) as count, MAX(purchased_at) as last_p
    FROM shopping_purchase_log
    WHERE catalog_id = ?
  `, [cat.id]) as any;

  const totalPurchases = Number(countRow?.count || 1);
  const computedInterval = await calculateCatalogInterval(cat.id);
  const finalInterval = computedInterval ?? cat.avg_interval_days ?? null;

  await sqlRun(`
    UPDATE shopping_catalog
    SET times_purchased = ?,
        last_purchased_at = ?,
        avg_interval_days = ?,
        default_store = COALESCE(?, default_store),
        updated_at = ?
    WHERE id = ?
  `, [totalPurchases, nowIso, finalInterval, store || cat.default_store, nowIso, cat.id]);
}

export async function getShoppingIntelligence(activeGeneralItems: Array<{ name: string }>) {
  const activeNorms = new Set(activeGeneralItems.map((g) => normalizeShoppingKey(g.name)));

  // Self-heal: calculate interval for any catalog items with 2+ purchases in log but no avg_interval_days
  try {
    const uncomputed = await sqlAll(`
      SELECT c.id
      FROM shopping_catalog c
      WHERE c.avg_interval_days IS NULL
        AND (
          SELECT COUNT(*) FROM shopping_purchase_log l WHERE l.catalog_id = c.id
        ) >= 2
      LIMIT 25
    `) as Array<{ id: number }>;

    for (const u of uncomputed) {
      const interval = await calculateCatalogInterval(u.id);
      if (interval !== null) {
        await sqlRun('UPDATE shopping_catalog SET avg_interval_days = ? WHERE id = ?', [interval, u.id]);
      }
    }
  } catch {
    // Non-blocking self-healing
  }

  const catalog = await sqlAll('SELECT * FROM shopping_catalog ORDER BY times_added DESC, times_purchased DESC, name ASC') as Array<any>;

  const nowMs = Date.now();

  // Frequently added / popular staples
  // Items added or bought multiple times that are NOT already active on the list
  const frequentlyAdded = catalog
    .filter((c) => {
      if (activeNorms.has(c.normalized_key)) return false;
      const score = (c.times_purchased || 0) * 2 + (c.times_added || 0);
      return score >= 2;
    })
    .sort((a, b) => {
      const scoreB = (b.times_purchased || 0) * 2 + (b.times_added || 0);
      const scoreA = (a.times_purchased || 0) * 2 + (a.times_added || 0);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 100);

  // Suggested restock: items whose purchase cycle is >= 80% due
  const suggested = catalog
    .map((c) => {
      if (activeNorms.has(c.normalized_key)) return null;
      const avgDays = c.avg_interval_days || (c.times_purchased >= 3 ? 7 : c.times_added >= 3 ? 7 : 14);
      const lastRef = c.last_purchased_at || c.last_added_at;
      let daysSince = 0;
      if (lastRef) {
        daysSince = Math.max(0, Math.round((nowMs - new Date(lastRef).getTime()) / (1000 * 86400)));
      }
      const cycleRatio = avgDays > 0 ? (daysSince / avgDays) : 0;
      const isDue = lastRef ? (cycleRatio >= 0.8) : ((c.times_added || 0) >= 2);
      if (!isDue) return null;

      const cyclePct = Math.round(cycleRatio * 100);
      let reason: string;
      if (c.last_purchased_at) {
        reason = `Last bought ${daysSince}d ago (usually every ~${Math.round(avgDays)}d — ${cyclePct}% of cycle)`;
      } else if (c.last_added_at) {
        reason = `Added ${c.times_added}× previously (${daysSince}d ago)`;
      } else {
        reason = `Added ${c.times_added}× previously`;
      }

      return {
        ...c,
        days_since_last: daysSince,
        avg_interval_days: avgDays,
        cycle_percent: cyclePct,
        cycle_ratio: cycleRatio,
        reason,
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => (b.cycle_ratio || 0) - (a.cycle_ratio || 0))
    .slice(0, 100);

  // Full catalog decorated with status metadata for ManageCatalogModal
  const decoratedCatalog = catalog.map((c) => {
    const isActive = activeNorms.has(c.normalized_key);
    const avgDays = c.avg_interval_days || (c.times_purchased >= 3 ? 7 : c.times_added >= 3 ? 7 : 14);
    const lastRef = c.last_purchased_at || c.last_added_at;
    let daysSince: number | null = null;
    let cycleRatio = 0;
    if (lastRef) {
      daysSince = Math.max(0, Math.round((nowMs - new Date(lastRef).getTime()) / (1000 * 86400)));
      cycleRatio = avgDays > 0 ? daysSince / avgDays : 0;
    }
    const isDue = !isActive && (lastRef ? cycleRatio >= 0.8 : (c.times_added || 0) >= 2);
    const isStaple = Boolean(c.is_staple);
    const cyclePct = lastRef && avgDays > 0 ? Math.round(cycleRatio * 100) : null;

    return {
      ...c,
      is_active: isActive,
      is_due: isDue,
      is_staple: isStaple,
      days_since_last: daysSince,
      cycle_percent: cyclePct,
    };
  });

  const recentlyPurchased = await sqlAll(`
      SELECT l.id, l.purchased_at, l.store, l.qty, c.name, c.normalized_key, c.default_store
      FROM shopping_purchase_log l
      JOIN shopping_catalog c ON c.id = l.catalog_id
      ORDER BY l.purchased_at DESC, l.id DESC
      LIMIT 120
    `) as Array<any>;

  return {
    catalog: decoratedCatalog,
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
  if (/\b(fruit\s*(?:&|and)\s*veg(?:etables?)?|produce\s*market|green\s*grocer|bakery|butcher)\b/i.test(t)) {
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
    quantities: raw?.quantities && typeof raw.quantities === 'object' ? raw.quantities : {},
    hidden: raw?.hidden && typeof raw.hidden === 'object' ? raw.hidden : {},
    active: Array.isArray(raw?.active)
      ? raw.active
      : raw?.active && typeof raw.active === 'object'
      ? Object.keys(raw.active)
      : [],
    meal_order: Array.isArray(raw?.meal_order) ? raw.meal_order : [],
    pantry: getPantryItems(),
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

export async function addIngredientsToShoppingBatch(rawItems: any[]): Promise<number> {
  const current = getShoppingData();
  const stores = getShoppingStores();
  let addedCount = 0;

  for (const it of rawItems) {
    const rawInput = String(typeof it === 'string' ? it : it?.name || '').trim().slice(0, 120);
    if (!rawInput) continue;
    const cleanName = cleanShoppingItemName(rawInput) || rawInput;

    // Skip pantry staples (in-stock items) when planning/batch-adding to shopping list
    if (it?.in_pantry || isPantryItem(cleanName)) {
      continue;
    }

    const storeInput = typeof it === 'object' && it?.store ? String(it.store).trim() : '';
    const detectedStore = detectStoreFromText(rawInput, stores);
    const targetStore = storeInput || detectedStore || '';

    let rawQty = typeof it === 'object' && it?.qty ? String(it.qty).trim() : '';
    if (!rawQty) {
      const qMatch = rawInput.match(
        /^((?:(?:\d+\s+)?[¼½¾⅓⅔⅛⅜⅝⅞]|\d+\s+\d+\/\d+|\d+(?:[\/.]\d+)?|\.\d+)\s*(?:g|kg|ml|l|oz|lb|cups?|tbsp?|tbs?|tablespoons?|teaspoons?|cloves?|cans?|tins?|pkts?|packets?|punnets?|pinch(?:es)?|bunch(?:es)?|slices?|stalks?|heads?)?)\s+/i
      );
      if (qMatch && qMatch[1]) {
        rawQty = qMatch[1].trim();
      }
    }
    const qty = resolveShoppingQuantity(rawQty);

    const norm = normalizeShoppingKey(cleanName);
    const catEntry = await touchCatalogItemOnAdd(cleanName, targetStore || undefined, true);
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
  return addedCount;
}

export const householdRouter = Router();

householdRouter.get('/api/meal_planner', async (req: Request, res: Response) => {
  const weekParam = String(req.query.week_start || req.query.week || '');
  const weeksCount = parseInt(String(req.query.weeks || '2'), 10) || 2;
  const weekStart = getMondayOfWeek(weekParam);
  const weekDays = getWeekDaysList(weekStart);
  const { plan, cards_by_day, recurring } = getMealPlanForWeek(weekStart, weeksCount);
  const suggestions = getMealSuggestions();
  res.json({
    success: true,
    week_start: weekStart,
    week_days: weekDays,
    plan,
    cards_by_day,
    recurring,
    suggestions,
    recipes: await getAllRecipes(),
  });
});

// Add or update a meal card on one or more days (e.g., Monday & Tuesday)
householdRouter.post(['/api/meal_planner/card', '/api/meal_planner/card/save'], async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const title = String(body.title || body.value || '').trim();
    const audience = String(body.audience || 'Everyone').trim() || 'Everyone';
    const cardId = body.card_id ? String(body.card_id).trim() : '';
    const addToShopping = Boolean(body.add_to_shopping);
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
        const idx = currentCards.findIndex((c) => c.id === cardId || c.meal_key === cardId.toLowerCase());
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

    // If requested, add recipe ingredients to shopping list
    if (addToShopping) {
      const recipes = await getAllRecipes();
      const rec = recipes[mealKey];
      const ingredients = rec?.ingredients && rec.ingredients.length > 0
        ? rec.ingredients
        : (getMealIngredients() || {})[mealKey] || [];
      if (ingredients.length > 0) {
        await addIngredientsToShoppingBatch(ingredients);
      } else {
        await addIngredientsToShoppingBatch([{ name: title, qty: '', store: 'aldi' }]);
      }
    }

    logActivity('settings_updated', `Planned meal "${title}" (${audience}) for ${daysInput.join(', ')}`);
    const weekStart = getMondayOfWeek(daysInput[0]);
    const { plan, cards_by_day } = getMealPlanForWeek(weekStart, 2);
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
    const targetId = cardId.toLowerCase();
    const currentCards = normalizeDayCards(storedPlan[dateIso]).filter(
      (c) => c.id !== cardId && c.id.toLowerCase() !== targetId && c.meal_key !== targetId && c.title.toLowerCase() !== targetId
    );
    if (currentCards.length > 0) {
      storedPlan[dateIso] = currentCards;
    } else {
      delete storedPlan[dateIso];
    }
    AppSetting.set('meal_planner_plan_json', JSON.stringify(storedPlan));
    const weekStart = getMondayOfWeek(dateIso);
    const { plan, cards_by_day } = getMealPlanForWeek(weekStart, 2);
    res.json({ success: true, plan, cards_by_day });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message });
  }
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
householdRouter.get('/api/recipes', async (_req: Request, res: Response) => {
  res.json({ success: true, recipes: await getAllRecipes() });
});

householdRouter.post(['/api/recipes', '/api/recipes/save', '/api/save_recipe'], async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    if (!body.title) {
      res.status(400).json({ success: false, error: 'Recipe title is required' });
      return;
    }
    const saved = await upsertRecipe({
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
    res.json({ success: true, recipe: saved, recipes: await getAllRecipes() });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err?.message || 'Failed to save recipe' });
  }
});

householdRouter.post('/api/recipes/delete', async (req: Request, res: Response) => {
  const mealKey = String(req.body?.meal_key || '').trim().toLowerCase();
  if (mealKey) {
    await sqlRun('DELETE FROM recipes WHERE meal_key = ?', [mealKey]);
    const ingMap = getMealIngredients();
    delete ingMap[mealKey];
    AppSetting.set('meal_ingredients_json', JSON.stringify(ingMap));
  }
  res.json({ success: true, recipes: await getAllRecipes() });
});

// Webhook endpoint for Google Apps Script / Discord Recipe Transcriber
householdRouter.post('/api/recipes/import', async (req: Request, res: Response) => {
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
      const rec = await upsertRecipe({
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

householdRouter.post('/api/save_meal_ingredients', async (req: Request, res: Response) => {
  const mealKey = String(req.body?.meal || '').trim().toLowerCase().slice(0, 80);
  const items = Array.isArray(req.body?.ingredients) ? req.body.ingredients : [];
  if (!mealKey) {
    res.status(400).json({ success: false, error: 'Meal key required' });
    return;
  }
  const existingRecipes = await getAllRecipes();
  const existingRec = existingRecipes[mealKey];
  upsertRecipe({
    meal_key: mealKey,
    title: existingRec?.title || mealKey.charAt(0).toUpperCase() + mealKey.slice(1),
    ingredients: items,
    instructions: req.body?.instructions !== undefined ? String(req.body.instructions) : existingRec?.instructions,
  });
  res.json({ success: true, ingredients: getMealIngredients() });
});

householdRouter.post('/api/save_recipe', async (req: Request, res: Response) => {
  const title = String(req.body?.title || '').trim().slice(0, 120);
  if (!title) {
    res.status(400).json({ success: false, error: 'Recipe title required' });
    return;
  }
  const mealKey = String(req.body?.meal_key || title).toLowerCase().trim().slice(0, 80);
  const existingRecipes = await getAllRecipes();
  const existingRec = existingRecipes[mealKey];

  const items = Array.isArray(req.body?.ingredients) ? req.body.ingredients : [];
  const instructions = req.body?.instructions !== undefined ? String(req.body.instructions).trim() : existingRec?.instructions;
  const prepTime = req.body?.prep_time !== undefined ? String(req.body.prep_time).trim() : existingRec?.prep_time;
  const servings = req.body?.servings !== undefined ? String(req.body.servings).trim() : existingRec?.servings;

  const saved = upsertRecipe({
    meal_key: mealKey,
    title,
    ingredients: items,
    instructions,
    prep_time: prepTime,
    servings,
  });

  logActivity('settings_updated', `Updated recipe "${title}"`);
  res.json({ success: true, recipe: saved, recipes: await getAllRecipes() });
});

householdRouter.post(
  '/api/recipes/transcribe_photo',
  mealImageUpload.single('image'),
  async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No image uploaded' });
      return;
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {}
      res.status(400).json({
        success: false,
        error: 'Gemini API key is not configured. Please add your key in Settings.',
      });
      return;
    }

    const filePath = req.file.path;
    const filename = req.file.filename;
    const mimeType = req.file.mimetype || 'image/jpeg';
    const relativeImageUrl = `/static/uploads/meals/${filename}`;
    const jobId = `transcribe_${Date.now()}`;

    // Respond immediately so user is never blocked in the UI
    res.json({
      success: true,
      status: 'processing',
      job_id: jobId,
      message: 'Recipe photo received. Processing with Gemini AI in the background...',
    });

    // Background processing
    setImmediate(async () => {
      try {
        const buffer = fs.readFileSync(filePath);
        const extracted = await transcribeRecipeImage(buffer, mimeType);
        const stores = getShoppingStores();

        // Parse and match ingredients with shopping catalog & pantry
        const ingredients: RecipeIngredient[] = [];
        for (const ing of extracted.ingredients || []) {
          const rawText = String(ing.raw || ing.name || '').trim();
          const buyName = String(ing.name || cleanShoppingItemName(rawText) || rawText).trim();
          const norm = normalizeShoppingKey(buyName);
          const inPantry = isPantryItem(buyName) || Boolean((ing as any).pantry_guess);

          let store = 'aldi';
          let uncataloged = true;
          try {
            const cat = (await sqlOne('SELECT * FROM shopping_catalog WHERE normalized_key = ?', [norm])) as any;
            if (cat) {
              store = cat.default_store || 'aldi';
              uncataloged = false;
            } else {
              const detected = detectStoreFromText(rawText + ' ' + buyName, stores);
              store = detected || 'aldi';
            }
          } catch {
            // fallback
          }

          ingredients.push({
            name: buyName,
            raw_name: rawText,
            qty: String(ing.qty || '').trim(),
            store,
            prep: String(ing.prep || '').trim(),
            uncataloged,
            in_pantry: inPantry,
          });
        }

        // Generate unique meal_key
        const baseKey =
          extracted.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 50) || `recipe_${Date.now()}`;

        let mealKey = baseKey;
        const existing = await sqlOne('SELECT id FROM recipes WHERE meal_key = ?', [mealKey]);
        if (existing) {
          mealKey = `${baseKey}_${Math.random().toString(36).slice(2, 6)}`;
        }

        const instructionsText = (extracted.instructions || []).join('\n\n');

        await upsertRecipe({
          meal_key: mealKey,
          title: extracted.title,
          image_url: relativeImageUrl,
          ingredients,
          instructions: instructionsText,
          servings: extracted.servings || '',
          prep_time: extracted.prep_time || '',
        });

        logActivity('recipe_transcribed', `Transcribed recipe "${extracted.title}" from photo with Gemini AI`);
      } catch (err: any) {
        console.error('[gemini] Background recipe transcription failed:', err?.message || err);
        logActivity('error', `Recipe photo transcription failed: ${err?.message || err}`);
      }
    });
  }
);

// Gemini AI Settings Endpoints
householdRouter.get('/api/settings/gemini', (_req: Request, res: Response) => {
  res.json({
    success: true,
    has_key: Boolean(getGeminiApiKey()),
    model: getGeminiModel(),
  });
});

householdRouter.post('/api/settings/gemini', (req: Request, res: Response) => {
  const apiKey = req.body?.api_key !== undefined ? String(req.body.api_key).trim() : undefined;
  const model = req.body?.model !== undefined ? String(req.body.model).trim() : undefined;

  if (apiKey !== undefined) {
    AppSetting.set('gemini_api_key', apiKey);
  }
  if (model !== undefined) {
    AppSetting.set('gemini_model', model || 'gemini-2.0-flash');
  }

  res.json({
    success: true,
    has_key: Boolean(getGeminiApiKey()),
    model: getGeminiModel(),
  });
});

householdRouter.post('/api/settings/test_gemini', async (req: Request, res: Response) => {
  const apiKey = req.body?.api_key !== undefined ? String(req.body.api_key).trim() : undefined;
  const model = req.body?.model !== undefined ? String(req.body.model).trim() : undefined;
  const result = await testGeminiConnection(apiKey, model);
  res.json(result);
});

// Household Pantry Endpoints (backed by shopping_catalog.is_staple)
householdRouter.get('/api/pantry', async (_req: Request, res: Response) => {
  try {
    const items = await sqlAll('SELECT * FROM shopping_catalog WHERE is_staple = true ORDER BY name ASC') as Array<any>;
    res.json({
      success: true,
      items: items.map((i) => i.name),
      catalog_items: items,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to fetch pantry' });
  }
});

householdRouter.post('/api/pantry/toggle', async (req: Request, res: Response) => {
  const id = req.body?.id ? Number(req.body.id) : null;
  const name = String(req.body?.name || '').trim();
  const store = String(req.body?.store || '').trim();

  let item;
  if (id) {
    item = await sqlOne('UPDATE shopping_catalog SET is_staple = NOT COALESCE(is_staple, false), updated_at = NOW() WHERE id = ? RETURNING *', [id]);
  } else if (name) {
    const norm = normalizeShoppingKey(name);
    const existing = await sqlOne('SELECT * FROM shopping_catalog WHERE normalized_key = ?', [norm]);
    if (existing) {
      item = await sqlOne('UPDATE shopping_catalog SET is_staple = NOT COALESCE(is_staple, false), updated_at = NOW() WHERE id = ? RETURNING *', [existing.id]);
    } else {
      item = await sqlOne(
        'INSERT INTO shopping_catalog (name, normalized_key, default_store, is_staple, times_added, times_purchased) VALUES (?, ?, ?, true, 1, 0) RETURNING *',
        [name, norm, store || 'aldi']
      );
    }
  }

  await hydratePantryCache();
  if (!item) {
    res.status(400).json({ success: false, error: 'Item not found or name missing' });
    return;
  }
  res.json({ success: true, item });
});

householdRouter.post('/api/pantry/add', async (req: Request, res: Response) => {
  const name = String(req.body?.name || '').trim();
  const store = String(req.body?.store || '').trim();
  if (!name) {
    res.status(400).json({ success: false, error: 'Item name required' });
    return;
  }
  const norm = normalizeShoppingKey(name);
  let item = await sqlOne('SELECT * FROM shopping_catalog WHERE normalized_key = ?', [norm]);
  if (item) {
    item = await sqlOne('UPDATE shopping_catalog SET is_staple = true, updated_at = NOW() WHERE id = ? RETURNING *', [item.id]);
  } else {
    item = await sqlOne(
      'INSERT INTO shopping_catalog (name, normalized_key, default_store, is_staple, times_added, times_purchased) VALUES (?, ?, ?, true, 1, 0) RETURNING *',
      [name, norm, store || 'aldi']
    );
  }
  await hydratePantryCache();
  res.json({ success: true, item });
});

// Update/set pantry items (supports { items: string[] } or { name: string })
householdRouter.post('/api/pantry', async (req: Request, res: Response) => {
  try {
    const rawItems = Array.isArray(req.body?.items) ? req.body.items : null;
    if (rawItems) {
      const cleanNames = rawItems.map((n: string) => String(n || '').trim()).filter(Boolean);
      // Reset all staples
      await sqlRun('UPDATE shopping_catalog SET is_staple = false');
      for (const name of cleanNames) {
        const norm = normalizeShoppingKey(name);
        const existing = (await sqlOne('SELECT id FROM shopping_catalog WHERE normalized_key = ?', [norm])) as any;
        if (existing) {
          await sqlRun('UPDATE shopping_catalog SET is_staple = true, updated_at = NOW() WHERE id = ?', [existing.id]);
        } else {
          await sqlRun(
            'INSERT INTO shopping_catalog (name, normalized_key, default_store, is_staple, times_added, times_purchased) VALUES (?, ?, ?, true, 1, 0)',
            [name, norm, 'aldi']
          );
        }
      }
      await hydratePantryCache();
      const updated = (await sqlAll('SELECT * FROM shopping_catalog WHERE is_staple = true ORDER BY name ASC')) as Array<any>;
      res.json({ success: true, items: updated.map((i) => i.name), catalog_items: updated });
      return;
    }

    const name = String(req.body?.name || '').trim();
    if (name) {
      const norm = normalizeShoppingKey(name);
      let item = (await sqlOne('SELECT * FROM shopping_catalog WHERE normalized_key = ?', [norm])) as any;
      if (item) {
        item = await sqlOne('UPDATE shopping_catalog SET is_staple = true, updated_at = NOW() WHERE id = ? RETURNING *', [item.id]);
      } else {
        item = await sqlOne(
          'INSERT INTO shopping_catalog (name, normalized_key, default_store, is_staple, times_added, times_purchased) VALUES (?, ?, ?, true, 1, 0) RETURNING *',
          [name, norm, 'aldi']
        );
      }
      await hydratePantryCache();
      res.json({ success: true, item });
      return;
    }

    res.status(400).json({ success: false, error: 'items array or item name required' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to update pantry' });
  }
});

// Toggle staple status on any catalog item
householdRouter.post('/api/shopping/catalog/toggle_staple', async (req: Request, res: Response) => {
  const id = Number(req.body?.id);
  if (!id || isNaN(id)) {
    res.status(400).json({ success: false, error: 'Valid catalog ID required' });
    return;
  }
  const explicit = req.body?.is_staple;
  let updated;
  if (typeof explicit === 'boolean') {
    updated = await sqlOne('UPDATE shopping_catalog SET is_staple = ?, updated_at = NOW() WHERE id = ? RETURNING *', [explicit, id]);
  } else {
    updated = await sqlOne('UPDATE shopping_catalog SET is_staple = NOT COALESCE(is_staple, false), updated_at = NOW() WHERE id = ? RETURNING *', [id]);
  }
  await hydratePantryCache();
  if (!updated) {
    res.status(404).json({ success: false, error: 'Catalog item not found' });
    return;
  }
  logActivity('catalog_staple_toggle', `Toggled staple status for "${updated.name}" to ${Boolean(updated.is_staple)}`);
  res.json({ success: true, item: updated });
});

// Smart Shopping List Endpoints (Deduplication, Frequently Added, Suggested, Archive Checked, Recently Purchased)
householdRouter.post('/api/add_general_shopping_item', async (req: Request, res: Response) => {
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

  const targetStore = storeInput || detectedStore || '';
  const norm = normalizeShoppingKey(cleanName);
  const catEntry = await touchCatalogItemOnAdd(cleanName, targetStore || undefined, true);
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

householdRouter.post('/api/shopping/batch_add', async (req: Request, res: Response) => {
  const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
  const addedCount = await addIngredientsToShoppingBatch(rawItems);
  res.json({ success: true, added_count: addedCount, ...getShoppingData() });
});

householdRouter.post('/api/update_shopping_item', (req: Request, res: Response) => {
  const key = String(req.body?.key || '').trim();
  const hasChecked = req.body?.checked !== undefined;
  const checked = Boolean(req.body?.checked);
  const qty = req.body?.qty !== undefined ? String(req.body.qty).trim() : undefined;
  const current = getShoppingData();
  if (key) {
    if (hasChecked) {
      if (checked) current.checked[key] = true;
      else delete current.checked[key];
    }
    if (qty !== undefined) {
      current.quantities[key] = qty;
    }

    if (key.startsWith('general::')) {
      const lowerName = key.slice('general::'.length).toLowerCase();
      current.general = current.general.map((g: any) => {
        if (String(g.name || '').toLowerCase() === lowerName) {
          const updated = { ...g };
          if (hasChecked) updated.checked = checked;
          if (qty !== undefined) updated.qty = qty;
          return updated;
        }
        return g;
      });
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
  delete current.quantities[itemKey];
  AppSetting.set('shopping_list_json', JSON.stringify(current));
  res.json({ success: true, ...current });
});

// Archive all checked items (marks them as Purchased in relational SQLite purchase log, increments stats, and clears from active list)
async function handleArchiveCheckedShopping(_req: Request, res: Response) {
  const current = getShoppingData();
  const remainingGeneral: any[] = [];
  let purchasedCount = 0;

  for (const g of current.general) {
    const itemKey = `general::${String(g.name || '').toLowerCase()}`;
    const isChecked = Boolean(g.checked || current.checked[itemKey]);
    if (isChecked) {
      await recordCatalogPurchase(g.name, g.store || 'aldi', g.qty || '');
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
      await recordCatalogPurchase(displayName, store, matchIng?.qty || '');
      // Hide checked meal ingredient until unchecked or re-added
      current.hidden[chkKey] = true;
      delete current.checked[chkKey];
      purchasedCount++;
    }
  }

  current.general = remainingGeneral;
  delete (current as any).archived;
  AppSetting.set('shopping_list_json', JSON.stringify(current));
  res.json({ success: true, purchased_count: purchasedCount, archived_count: purchasedCount, ...current });
}

householdRouter.post('/api/shopping/archive_checked', handleArchiveCheckedShopping);
householdRouter.post('/api/clear_shopping_checked', handleArchiveCheckedShopping);

householdRouter.post('/api/shopping/catalog/add', async (req: Request, res: Response) => {
  const name = String(req.body?.name || '').trim();
  const store = String(req.body?.store || 'aldi').trim();
  if (!name) {
    res.status(400).json({ success: false, error: 'Name required' });
    return;
  }
  const cat = await touchCatalogItemOnAdd(name, store, false);
  res.json({ success: true, item: cat });
});

householdRouter.post('/api/shopping/catalog/delete', async (req: Request, res: Response) => {
  const rawIds = Array.isArray(req.body?.ids)
    ? req.body.ids
    : req.body?.id !== undefined
    ? [req.body.id]
    : [];

  const ids = rawIds
    .map((x: any) => Number(x))
    .filter((n: number) => !isNaN(n) && n > 0);

  if (ids.length === 0) {
    res.status(400).json({ success: false, error: 'No item IDs provided' });
    return;
  }

  const placeholders = ids.map(() => '?').join(',');
  // Find names/keys of deleted items to also remove them from active shopping list if present
  const itemsToDelete = await sqlAll(`SELECT id, name, normalized_key FROM shopping_catalog WHERE id IN (${placeholders})`, [...ids]) as any[];
  const deletedNormKeys = new Set(itemsToDelete.map((it) => it.normalized_key));

  await sqlRun(`DELETE FROM shopping_purchase_log WHERE catalog_id IN (${placeholders})`, [...ids]);
  const result = await sqlRun(`DELETE FROM shopping_catalog WHERE id IN (${placeholders})`, [...ids]);

  logActivity('shopping_catalog_deleted', `Deleted ${result.changes} items from shopping catalog`);
  const shopping = getShoppingData();
  shopping.general = (shopping.general || []).filter((g: any) => !deletedNormKeys.has(normalizeShoppingKey(g.name)));
  delete (shopping as any).archived;
  AppSetting.set('shopping_list_json', JSON.stringify(shopping));
  const intelligence = await getShoppingIntelligence(shopping.general || []);

  res.json({ success: true, deleted: result.changes, catalog: intelligence.catalog, intelligence });
});

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
  nk.notes = nk.notes.map((n: any) => {
    if (n.id !== noteId) return n;
    const updated = { ...n };
    if (req.body?.checked !== undefined) updated.checked = Boolean(req.body.checked);
    if (req.body?.text !== undefined) updated.text = String(req.body.text).trim().slice(0, 10000);
    return updated;
  });
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
    color: req.body?.color || '#fef08a',
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
          color: req.body?.color !== undefined ? String(req.body.color) : (p.color || '#fef08a'),
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

householdRouter.post('/api/update_dashboard_note', (req: Request, res: Response) => {
  const noteId = String(req.body?.id || '').trim();
  const notes = getDashboardNotes().map((n: any) => {
    if (n.id !== noteId) return n;
    return {
      ...n,
      title: req.body?.title !== undefined ? String(req.body.title).trim().slice(0, 120) : n.title,
      text: req.body?.text !== undefined ? String(req.body.text).trim().slice(0, 10000) : n.text,
      color: ALLOWED_STICKY_COLORS.includes(req.body?.color) ? req.body.color : n.color,
    };
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
export async function migrateExistingRecipeIngredients() {
  try {
    const rows = await sqlAll('SELECT id, meal_key, ingredients_json FROM recipes') as any[];
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
          await sqlRun('UPDATE recipes SET ingredients_json = ? WHERE id = ?', [JSON.stringify(restored),
            row.id]);
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

