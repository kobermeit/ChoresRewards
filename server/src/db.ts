import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { count, eq, sql } from 'drizzle-orm';
import { getDb } from './db/client';
import { runMigrations } from './db/migrate';
import {
  activityLog,
  appSettings,
  chore,
  person,
  personBadge,
  personStreak,
  recipes,
  reward,
  seasons,
  seasonalEvents,
  shoppingCatalog,
} from './db/schema';
import { UPLOADS_DIR } from './config';
import { cleanTitle, cleanDescription, decodeEntities } from './services/scraper';

/**
 * Household data layer (Postgres / Drizzle).
 *
 * Everything here is async and backed by `getDb()` (server/src/db/client.ts).
 * The only synchronous surface is `AppSetting.get()`, which reads a small
 * in-process cache hydrated at boot by `initDatabase()` — household settings are
 * a couple of dozen rows and are only written by this single server process, so
 * the cache can never go stale (every `set()` updates it before touching the DB).
 */

export const BADGE_DEFINITIONS: Record<string, { emoji: string; name: string; desc: string }> = {
  first_chore: { emoji: '⭐', name: 'First Steps', desc: 'Completed your very first chore!' },
  chores_10: { emoji: '💪', name: '10 Chores!', desc: 'Completed 10 chores in total!' },
  chores_50: { emoji: '🥇', name: 'Chore Champion', desc: 'Completed 50 chores!' },
  chores_100: { emoji: '👑', name: 'Centurion', desc: '100 chores completed!' },
  perfect_day: { emoji: '🌟', name: 'Perfect Day', desc: 'All chores done in one day!' },
  early_bird: { emoji: '🌅', name: 'Early Bird', desc: 'All chores finished before noon!' },
  streak_3: { emoji: '🔥', name: '3-Day Streak', desc: '3 days in a row!' },
  streak_7: { emoji: '🏅', name: 'On Fire!', desc: '7 days in a row!' },
  streak_30: { emoji: '🏆', name: 'Legend', desc: '30-day streak!' },
};

/** Timestamps stay naive 'YYYY-MM-DD HH:MM:SS' strings (UTC), matching the imported SQLite data. */
export function nowNaive(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function roundPoints(val: unknown): number {
  const num = Number(val);
  if (Number.isNaN(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function normalizeShoppingKey(raw: string): string {
  let s = String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
  if (s.length > 3 && s.endsWith('oes')) {
    s = s.slice(0, -2); // potatoes -> potato, tomatoes -> tomato
  } else if (s.length > 3 && s.endsWith('ies')) {
    s = s.slice(0, -3) + 'y'; // berries -> berry
  } else if (s.length > 3 && s.endsWith('s') && !s.endsWith('ss')) {
    s = s.slice(0, -1); // paper towels -> papertowel, eggs -> egg
  }
  return s || 'item';
}

/* ------------------------------------------------------------------ *
 * Household settings (app_settings key/value store, cache-backed)
 * ------------------------------------------------------------------ */

const settingsCache = new Map<string, string>();
/** Writes are serialised so a burst of `set()` calls lands in order. */
let writeChain: Promise<void> = Promise.resolve();

export const AppSetting = {
  /** Hydrate the cache from Postgres (called once during boot). */
  async load(): Promise<void> {
    const rows = await getDb().select({ key: appSettings.key, value: appSettings.value }).from(appSettings);
    settingsCache.clear();
    for (const row of rows) settingsCache.set(row.key, row.value);
    writeChain = Promise.resolve();
  },

  get(key: string, defaultValue: string | null = null): string | null {
    const value = settingsCache.get(key);
    return value !== undefined ? value : defaultValue;
  },

  /** Writes are queued behind each other; the cache is updated synchronously. */
  set(key: string, value: string): Promise<void> {
    const stringValue = String(value);
    settingsCache.set(key, stringValue);
    const write = writeChain
      .then(async () => {
        await getDb()
          .insert(appSettings)
          .values({ key, value: stringValue })
          .onConflictDoUpdate({ target: appSettings.key, set: { value: stringValue, updatedAt: nowNaive() } });
      })
      .catch((err) => {
        // Never surface a rejected write to a handler that did not await it.
        console.error(`[settings] Failed to persist '${key}':`, err?.message || err);
      });
    writeChain = write;
    return write;
  },

  /** Fire-and-forget variant for synchronous helpers (e.g. seeding the bonus-chore pool). */
  setLazy(key: string, value: string): void {
    void AppSetting.set(key, value).catch((err) => console.error('[settings] write failed:', err));
  },

  async delete(keys: string[]): Promise<void> {
    for (const key of keys) settingsCache.delete(key);
    if (!keys.length) return;
    await getDb().delete(appSettings).where(sql`${appSettings.key} IN ${keys}`);
  },

  getRewardSystem(): 'points' | 'cash' {
    const val = AppSetting.get('reward_system', 'points');
    return val === 'cash' ? 'cash' : 'points';
  },

  async setRewardSystem(system: string): Promise<void> {
    if (system !== 'points' && system !== 'cash') {
      throw new Error('Invalid reward system');
    }
    await AppSetting.set('reward_system', system);
  },
};

/* ------------------------------------------------------------------ *
 * Activity log
 * ------------------------------------------------------------------ */

/** Fire-and-forget so log lines never block a request or throw into a handler. */
export function logActivity(type: string, description: string, userName: string | null = null): void {
  void (async () => {
    try {
      await getDb().insert(activityLog).values({ date: nowNaive(), type, description, userName });
      console.log(`[ActivityLog] type=${type} user=${userName} desc=${description}`);
    } catch (err) {
      console.error('Error logging activity:', err);
    }
  })();
}

/* ------------------------------------------------------------------ *
 * Boot: migrations + one-time seeding
 * ------------------------------------------------------------------ */

/** Advance an identity sequence that was seeded with explicit ids. */
async function resetIdentitySequence(tableName: string): Promise<void> {
  await getDb().execute(
    sql.raw(
      `SELECT setval(pg_get_serial_sequence('"${tableName}"', 'id'), GREATEST((SELECT COALESCE(MAX(id), 0) FROM "${tableName}"), 1))`
    )
  );
}

export async function initDatabase(): Promise<void> {
  await runMigrations();
  await AppSetting.load();
  await seedHouseholdIfEmpty();
  await seedSeasonalData();
  await syncPersonRoles();
  await cleanStaleUploadReferences();
  await cleanRewardEntities();
}


/** First run on an empty database: demo household, starter chores and settings. */
async function seedHouseholdIfEmpty(): Promise<void> {
  const db = getDb();
  try {
    const [{ value: peopleCount }] = await db.select({ value: count() }).from(person);
    if (Number(peopleCount) === 0) {
      console.log('[startup] Seeding starter household (Sarah, Abby, Gee)…');
      const pinHash = bcrypt.hashSync('0212', 10);
      await db.insert(person).values([
        { id: 1, name: 'Sarah', points: 0, bonusPoints: 0, avatar: 'default_avatar.png', color: '#04201a', order: 0, isAdmin: true, pin: pinHash, role: 'parent' },
        { id: 2, name: 'Abby', points: 56, bonusPoints: 0, avatar: 'default_avatar.png', color: '#53234c', order: 1, isAdmin: false, role: 'child' },
        { id: 3, name: 'Gee', points: 6, bonusPoints: 0, avatar: 'default_avatar.png', color: '#3e1688', order: 2, isAdmin: false, role: 'child' },
      ]);
      await resetIdentitySequence('person');

      await db.insert(personStreak).values([
        { personId: 1, currentStreak: 0, longestStreak: 0 },
        { personId: 2, currentStreak: 2, longestStreak: 2 },
        { personId: 3, currentStreak: 1, longestStreak: 1 },
      ]);

      await db.insert(chore).values([
        { title: 'Make bed', assignedToId: 2, assignedTo: 'Abby', points: 1, isDaily: true, icon: '🛏️' },
        { title: 'Brush teeth: Morning', assignedToId: 2, assignedTo: 'Abby', points: 0, isDaily: true, icon: '🦷' },
        { title: 'Brush teeth: before bed', assignedToId: 2, assignedTo: 'Abby', points: 0, isDaily: true, icon: '🦷' },
        { title: 'Brush Teeth before bed', assignedToId: 3, assignedTo: 'Gee', points: 1, isDaily: true, icon: '🦷' },
      ]);

      await AppSetting.set('person_ages_json', JSON.stringify({ '1': 37, '2': 6 }));
      await AppSetting.set('app_timezone', 'Australia/Brisbane');
      await AppSetting.set('reward_system', 'points');
      await AppSetting.set(
        'meal_suggestions_json',
        JSON.stringify(['Pancakes', 'Sandwiches', 'Spaghetti Bolognese', 'Tacos', 'Stir Fry', 'sausage & veg'])
      );
      await AppSetting.set(
        'meal_ingredients_json',
        JSON.stringify({
          'sausage & veg': [
            { name: 'Beef sausages', qty: '1', store: 'Aldi' },
            { name: 'Potato', qty: '3', store: 'fruit an vege' },
            { name: 'Broccoli', qty: '1', store: 'fruit an vege' },
            { name: 'Carrot', qty: '2', store: 'fruit an vege' },
          ],
        })
      );
      await AppSetting.set(
        'shopping_stores_json',
        JSON.stringify([
          { icon: './static/images/rewards/store_aldi.svg', id: 'aldi', name: 'Aldi' },
          { icon: './static/images/rewards/store_woolworths.svg', id: 'woolworths', name: 'Woolworths' },
          { icon: '🛒', id: 'coles-7129', name: 'coles' },
          { icon: '🛒', id: 'fruit-an-vege-4537', name: 'fruit an vege' },
        ])
      );
    } else {
      const [sarah] = await db.select({ id: person.id, pin: person.pin }).from(person).where(eq(person.name, 'Sarah')).limit(1);
      if (sarah?.pin && bcrypt.compareSync('1234', sarah.pin)) {
        await db
          .update(person)
          .set({ pin: bcrypt.hashSync('0212', 10), isAdmin: true })
          .where(eq(person.id, sarah.id));
      }
    }

    // Legacy household defaults carried over from the original SQLite install.
    const [{ value: badgeCount }] = await db.select({ value: count() }).from(personBadge);
    if (Number(badgeCount) === 0) {
      await db
        .insert(personBadge)
        .values([
          { personId: 2, badgeKey: 'first_chore' },
          { personId: 2, badgeKey: 'perfect_day' },
          { personId: 3, badgeKey: 'first_chore' },
          { personId: 3, badgeKey: 'perfect_day' },
        ])
        .onConflictDoNothing();
    }

    if (!AppSetting.get('meal_planner_plan_json')) {
      await AppSetting.set(
        'meal_planner_plan_json',
        JSON.stringify({
          '2026-10-12': { breakfast: '', lunch: 'Abby : lasanga', dinner: 'Lasanga' },
          '2026-10-13': { breakfast: '', lunch: '', dinner: 'Lasanga' },
          '2026-10-14': { breakfast: '', lunch: 'Abby : Pizza', dinner: 'Pizza' },
          '2026-10-15': { breakfast: '', lunch: '', dinner: 'Sausage and veg' },
          '2026-10-16': { breakfast: '', lunch: '', dinner: 'Sausage and vege' },
        })
      );
    }
    if (!AppSetting.get('meal_planner_suggestions_json')) {
      await AppSetting.set(
        'meal_planner_suggestions_json',
        JSON.stringify(['Pancakes', 'Sandwiches', 'Spaghetti Bolognese', 'Tacos', 'Stir Fry', 'sausage & veg'])
      );
    }
    if (!AppSetting.get('timezone')) {
      await AppSetting.set('timezone', AppSetting.get('app_timezone') || 'Australia/Brisbane');
    }
    if (!AppSetting.get('daily_reset_hour')) {
      await AppSetting.set('daily_reset_hour', '0');
    }
    if (!AppSetting.get('point_value')) {
      await AppSetting.set('point_value', '0.50');
    }

    await seedShoppingCatalogIfEmpty();
    await seedRecipesIfEmpty();
  } catch (err) {
    console.error('[startup] Error seeding household data:', err);
  }
}


async function seedShoppingCatalogIfEmpty(): Promise<void> {
  const db = getDb();
  const [{ value: catalogCount }] = await db.select({ value: count() }).from(shoppingCatalog);
  if (Number(catalogCount) > 0) return;

  const nowIso = nowNaive();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString().replace('T', ' ').slice(0, 19);
  const fifteenDaysAgo = new Date(Date.now() - 15 * 86400 * 1000).toISOString().replace('T', ' ').slice(0, 19);
  const staples = [
    { name: 'Milk', store: 'aldi', added: 8, purchased: 7, lastPurchased: sevenDaysAgo, avgDays: 5 },
    { name: 'Bread', store: 'aldi', added: 7, purchased: 6, lastPurchased: sevenDaysAgo, avgDays: 5 },
    { name: 'Eggs', store: 'aldi', added: 6, purchased: 5, lastPurchased: sevenDaysAgo, avgDays: 7 },
    { name: 'Paper Towel', store: 'aldi', added: 4, purchased: 4, lastPurchased: fifteenDaysAgo, avgDays: 14 },
    { name: 'Butter', store: 'aldi', added: 4, purchased: 3, lastPurchased: fifteenDaysAgo, avgDays: 14 },
    { name: 'Cheese', store: 'aldi', added: 5, purchased: 4, lastPurchased: sevenDaysAgo, avgDays: 7 },
    { name: 'Bananas', store: 'fruit-an-vege-4537', added: 6, purchased: 5, lastPurchased: sevenDaysAgo, avgDays: 6 },
    { name: 'Apples', store: 'fruit-an-vege-4537', added: 5, purchased: 4, lastPurchased: sevenDaysAgo, avgDays: 7 },
    { name: 'Toilet Paper', store: 'aldi', added: 3, purchased: 3, lastPurchased: fifteenDaysAgo, avgDays: 14 },
    { name: 'Laundry Powder', store: 'aldi', added: 2, purchased: 2, lastPurchased: fifteenDaysAgo, avgDays: 21 },
    { name: 'Beef sausages', store: 'aldi', added: 3, purchased: 2, lastPurchased: sevenDaysAgo, avgDays: 7 },
    { name: 'Potato', store: 'fruit-an-vege-4537', added: 4, purchased: 3, lastPurchased: sevenDaysAgo, avgDays: 7 },
    { name: 'Broccoli', store: 'fruit-an-vege-4537', added: 4, purchased: 3, lastPurchased: sevenDaysAgo, avgDays: 7 },
    { name: 'Carrot', store: 'fruit-an-vege-4537', added: 4, purchased: 3, lastPurchased: sevenDaysAgo, avgDays: 7 },
  ];

  await db
    .insert(shoppingCatalog)
    .values(
      staples.map((s) => ({
        name: s.name,
        normalizedKey: normalizeShoppingKey(s.name),
        defaultStore: s.store,
        timesAdded: s.added,
        timesPurchased: s.purchased,
        lastAddedAt: nowIso,
        lastPurchasedAt: s.lastPurchased,
        avgIntervalDays: s.avgDays,
      }))
    )
    .onConflictDoNothing();
}

async function seedRecipesIfEmpty(): Promise<void> {
  const db = getDb();
  const [{ value: recipeCount }] = await db.select({ value: count() }).from(recipes);
  if (Number(recipeCount) > 0) return;

  await db
    .insert(recipes)
    .values([
      {
        mealKey: 'sausage & veg',
        title: 'Sausage & Veg',
        ingredientsJson: JSON.stringify([
          { name: 'Beef sausages', qty: '1 pack', store: 'aldi' },
          { name: 'Potato', qty: '3', store: 'fruit-an-vege-4537' },
          { name: 'Broccoli', qty: '1 head', store: 'fruit-an-vege-4537' },
          { name: 'Carrot', qty: '2', store: 'fruit-an-vege-4537' },
        ]),
        instructions:
          '1. Peel and chop potatoes into chunks; boil in salted water for 15 mins until tender, then mash with butter and milk.\n2. Pan-fry or grill the beef sausages over medium heat for 12–15 mins, turning until golden brown and cooked through.\n3. Slice carrots and broccoli florets; steam or microwave for 4–5 mins until tender-crisp.\n4. Serve sausages over warm mash with steamed greens and gravy.',
        servings: '4',
        prepTime: '25 mins',
      },
      {
        mealKey: 'lasanga',
        title: 'Lasagna',
        ingredientsJson: JSON.stringify([
          { name: 'Beef mince', qty: '500g', store: 'aldi' },
          { name: 'Lasagna sheets', qty: '1 box', store: 'aldi' },
          { name: 'Passata / Pasta sauce', qty: '700g', store: 'aldi' },
          { name: 'Mozzarella cheese', qty: '250g', store: 'aldi' },
        ]),
        instructions:
          '1. Preheat oven to 190°C.\n2. Brown the beef mince with onion and garlic, then stir in passata and simmer for 10 mins.\n3. Layer meat sauce, lasagna sheets, and béchamel/cheese in a baking dish.\n4. Top with mozzarella and bake for 35–40 mins until golden and bubbling.',
        servings: '6',
        prepTime: '50 mins',
      },
      {
        mealKey: 'pizza',
        title: 'Homemade Pizza',
        ingredientsJson: JSON.stringify([
          { name: 'Pizza bases', qty: '2', store: 'aldi' },
          { name: 'Pizza sauce', qty: '1 jar', store: 'aldi' },
          { name: 'Shredded mozzarella', qty: '200g', store: 'aldi' },
          { name: 'Ham or Pepperoni', qty: '150g', store: 'aldi' },
        ]),
        instructions:
          '1. Preheat oven to 220°C.\n2. Spread pizza sauce evenly over the bases.\n3. Scatter toppings and shredded mozzarella across each pizza.\n4. Bake for 10–12 mins until crust is crisp and cheese is melted.',
        servings: '4',
        prepTime: '20 mins',
      },
      {
        mealKey: 'spaghetti bolognese',
        title: 'Spaghetti Bolognese',
        ingredientsJson: JSON.stringify([
          { name: 'Spaghetti', qty: '500g', store: 'aldi' },
          { name: 'Beef mince', qty: '500g', store: 'aldi' },
          { name: 'Tomato passata', qty: '700g', store: 'aldi' },
          { name: 'Parmesan cheese', qty: '100g', store: 'aldi' },
        ]),
        instructions:
          '1. Brown beef mince with diced onion, garlic, and Italian herbs.\n2. Pour in passata and simmer gently for 15–20 mins.\n3. Cook spaghetti in salted boiling water until al dente, drain, and serve topped with bolognese and grated parmesan.',
        servings: '4',
        prepTime: '25 mins',
      },
    ])
    .onConflictDoNothing();
}


/**
 * Default seasons are stored for the Southern Hemisphere (Australia). When the household
 * hemisphere setting is 'north', the season service shifts these dates by six months.
 * Events use a +/- day window so each theme lasts roughly a week around the date.
 */
async function seedSeasonalData(): Promise<void> {
  const db = getDb();
  try {
    await db
      .insert(seasons)
      .values([
        { key: 'summer', name: 'Summer', startMd: '12-01', endMd: '02-29', emoji: '☀️', accent: '#f59e0b' },
        { key: 'autumn', name: 'Autumn', startMd: '03-01', endMd: '05-31', emoji: '🍂', accent: '#ea580c' },
        { key: 'winter', name: 'Winter', startMd: '06-01', endMd: '08-31', emoji: '❄️', accent: '#38bdf8' },
        { key: 'spring', name: 'Spring', startMd: '09-01', endMd: '11-30', emoji: '🌸', accent: '#ec4899' },
      ])
      .onConflictDoNothing();

    await db
      .insert(seasonalEvents)
      .values([
        { key: 'new_year', name: "New Year's", ruleType: 'fixed', monthDay: '01-01', daysBefore: 1, daysAfter: 0, emoji: '🎆', accent: '#a855f7', soundKey: 'fanfare' },
        { key: 'easter', name: 'Easter', ruleType: 'easter', monthDay: null, daysBefore: 7, daysAfter: 1, emoji: '🐣', accent: '#a3e635', soundKey: 'chimes' },
        { key: 'halloween', name: 'Halloween', ruleType: 'fixed', monthDay: '10-31', daysBefore: 7, daysAfter: 1, emoji: '🎃', accent: '#f97316', soundKey: 'spooky' },
        { key: 'christmas', name: 'Christmas', ruleType: 'fixed', monthDay: '12-25', daysBefore: 24, daysAfter: 1, emoji: '❄️', accent: '#38bdf8', soundKey: 'christmas' },
      ])
      .onConflictDoNothing();

    // Seasons pick up a default sound theme unless the household chose one.
    const seasonSoundDefaults: Record<string, string> = {
      winter: 'christmas',
      spring: 'chimes',
      autumn: 'chimes',
      summer: 'default',
    };
    for (const [key, soundKey] of Object.entries(seasonSoundDefaults)) {
      await db.execute(
        sql`UPDATE seasons SET sound_key = ${soundKey} WHERE key = ${key} AND (sound_key IS NULL OR sound_key = '')`
      );
    }

    // Obsolete legacy keys that duplicated the meal planner.
    await AppSetting.delete(['meal_plan_json', 'meal_suggestions_json']);

    const defaults: Record<string, string> = {
      seasonal_themes_enabled: 'true',
      hemisphere: 'south',
      sound_theme: 'auto',
    };
    for (const [k, v] of Object.entries(defaults)) {
      if (AppSetting.get(k) === null) await AppSetting.set(k, v);
    }
  } catch (err) {
    console.error('[startup] Error seeding seasonal data:', err);
  }
}

/** Keep person.role in sync with is_admin and guarantee the shared 'Family' profile exists. */
async function syncPersonRoles(): Promise<void> {
  const db = getDb();
  try {
    await db.execute(
      sql`UPDATE person SET role = 'parent' WHERE is_admin = true AND (role IS NULL OR role = '' OR role = 'child')`
    );
    await db.execute(
      sql`UPDATE person SET role = 'child' WHERE (is_admin = false OR is_admin IS NULL) AND (role IS NULL OR role = '')`
    );
    const [family] = await db
      .select({ id: person.id })
      .from(person)
      .where(sql`role = 'family' OR name = 'Family'`)
      .limit(1);
    if (!family) {
      await db.insert(person).values({
        name: 'Family',
        role: 'family',
        points: 0,
        bonusPoints: 0,
        avatar: 'default_avatar.png',
        color: '#3b82f6',
        order: 99,
        isAdmin: false,
      });
    }
  } catch (err) {
    console.error('[startup] Error syncing person roles:', err);
  }
}

/** Clear avatar / reward image references whose upload no longer exists on disk. */
async function cleanStaleUploadReferences(): Promise<void> {
  const db = getDb();
  try {
    let changed = 0;
    const people = await db.select({ id: person.id, avatar: person.avatar }).from(person);
    for (const p of people) {
      if (p.avatar && p.avatar !== 'default_avatar.png' && !fs.existsSync(path.join(UPLOADS_DIR, p.avatar))) {
        await db.update(person).set({ avatar: null }).where(eq(person.id, p.id));
        changed++;
      }
    }
    const rewards = await db.select({ id: reward.id, imageUrl: reward.imageUrl }).from(reward);
    for (const r of rewards) {
      if (r.imageUrl && r.imageUrl.includes('/static/uploads/')) {
        const rel = r.imageUrl.split('/static/uploads/').pop()!;
        if (!fs.existsSync(path.join(UPLOADS_DIR, rel))) {
          await db.update(reward).set({ imageUrl: null }).where(eq(reward.id, r.id));
          changed++;
        }
      }
    }
    if (changed > 0) {
      console.log(`[startup] Cleared ${changed} stale upload reference(s) from DB.`);
    }
  } catch (err) {
    console.error('[startup] Error checking stale uploads:', err);
  }
}

/** Strip HTML entities / scraper artifacts that older reward rows were saved with. */
async function cleanRewardEntities(): Promise<void> {
  const db = getDb();
  try {
    const rows = await db
      .select({
        id: reward.id,
        title: reward.title,
        description: reward.description,
        sourceName: reward.sourceName,
        sourceUrl: reward.sourceUrl,
      })
      .from(reward);
    let cleaned = 0;
    for (const r of rows) {
      const cleanTitleValue = r.sourceUrl ? cleanTitle(r.title, r.sourceName || 'Store') : decodeEntities(r.title);
      const cleanDescriptionValue = r.description ? cleanDescription(r.description) : r.description;
      if (cleanTitleValue !== r.title || cleanDescriptionValue !== r.description) {
        await db.update(reward).set({ title: cleanTitleValue, description: cleanDescriptionValue }).where(eq(reward.id, r.id));
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`[startup] Cleaned HTML entities in ${cleaned} existing reward record(s).`);
    }
  } catch (err) {
    console.warn('[startup] Warning cleaning HTML entities on existing rewards:', err);
  }
}

