import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { DB_PATH, UPLOADS_DIR } from './config';

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

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

function ensureColumn(tableName: string, columnName: string, columnDef: string) {
  const cols = db.pragma(`table_info(${tableName})`) as Array<{ name: string }>;
  if (!cols.some((c) => c.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN "${columnName}" ${columnDef}`);
  }
}

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key VARCHAR(100) NOT NULL UNIQUE,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS person (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(50) NOT NULL,
      points FLOAT DEFAULT 0.0,
      bonus_points FLOAT DEFAULT 0.0,
      last_reset DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_bonus_awarded DATETIME,
      last_daily_chores_added DATETIME DEFAULT CURRENT_TIMESTAMP,
      avatar VARCHAR(100) DEFAULT 'default_avatar.png',
      color VARCHAR(7) DEFAULT '#ffffff',
      "order" INTEGER DEFAULT 0,
      pin VARCHAR(100),
      is_admin BOOLEAN DEFAULT 0,
      age INTEGER
    );

    CREATE TABLE IF NOT EXISTS chore (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title VARCHAR(100) NOT NULL,
      assigned_to_id INTEGER REFERENCES person(id),
      assigned_to VARCHAR(50),
      points FLOAT DEFAULT 1.0,
      completed BOOLEAN DEFAULT 0,
      date_completed DATETIME,
      is_daily BOOLEAN DEFAULT 0,
      days_of_week VARCHAR(64),
      due_date DATE,
      due_datetime DATETIME,
      deleted BOOLEAN DEFAULT 0,
      icon VARCHAR(20),
      is_extra BOOLEAN DEFAULT 0,
      extra_id VARCHAR(32)
    );

    CREATE TABLE IF NOT EXISTS reward (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title VARCHAR(100) NOT NULL,
      points_required FLOAT NOT NULL,
      image_url VARCHAR(255),
      description TEXT,
      assigned_to_id INTEGER REFERENCES person(id),
      assigned_to VARCHAR(50),
      completed BOOLEAN DEFAULT 0,
      date_completed DATETIME,
      is_recurring BOOLEAN DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      type VARCHAR(50) NOT NULL,
      description VARCHAR(500) NOT NULL,
      user_name VARCHAR(100)
    );

    CREATE TABLE IF NOT EXISTS person_streak (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL UNIQUE REFERENCES person(id),
      current_streak INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0,
      last_completed_date DATE
    );

    CREATE TABLE IF NOT EXISTS person_badge (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL REFERENCES person(id),
      badge_key VARCHAR(50) NOT NULL,
      earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_person_badge UNIQUE (person_id, badge_key)
    );

    CREATE TABLE IF NOT EXISTS organise_item (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category VARCHAR(80) NOT NULL DEFAULT 'General',
      title VARCHAR(200) NOT NULL,
      provider VARCHAR(200),
      notes TEXT,
      due_date DATE,
      last_date DATE,
      paid BOOLEAN DEFAULT 0,
      cost FLOAT,
      reminder_days INTEGER DEFAULT 30,
      icon VARCHAR(20),
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      photo_filename VARCHAR(255),
      vehicle_make VARCHAR(100),
      vehicle_model VARCHAR(100),
      vehicle_year INTEGER,
      vehicle_rego VARCHAR(20),
      current_odometer INTEGER,
      next_service_date DATE,
      next_service_mileage INTEGER,
      parent_id INTEGER REFERENCES organise_item(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS vehicle_service (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organise_item_id INTEGER NOT NULL REFERENCES organise_item(id) ON DELETE CASCADE,
      service_type VARCHAR(200) NOT NULL,
      service_date DATE,
      next_service_date DATE,
      next_service_mileage INTEGER,
      mileage INTEGER,
      cost FLOAT,
      provider VARCHAR(200),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shopping_catalog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(120) NOT NULL,
      normalized_key VARCHAR(120) NOT NULL UNIQUE,
      default_store VARCHAR(60) DEFAULT 'aldi',
      times_added INTEGER DEFAULT 1,
      times_purchased INTEGER DEFAULT 0,
      last_added_at DATETIME,
      last_purchased_at DATETIME,
      avg_interval_days FLOAT
    );

    CREATE TABLE IF NOT EXISTS shopping_purchase_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      catalog_id INTEGER NOT NULL REFERENCES shopping_catalog(id) ON DELETE CASCADE,
      purchased_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      store VARCHAR(60),
      qty VARCHAR(40)
    );

    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meal_key VARCHAR(120) NOT NULL UNIQUE,
      title VARCHAR(160) NOT NULL,
      image_url VARCHAR(500),
      ingredients_json TEXT NOT NULL DEFAULT '[]',
      instructions TEXT NOT NULL DEFAULT '',
      servings VARCHAR(40),
      prep_time VARCHAR(40),
      notion_id VARCHAR(120),
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Safe migrations for existing databases
  ensureColumn('person', 'age', 'INTEGER');
  ensureColumn('person', 'dob', 'DATE');
  ensureColumn('person', 'role', "VARCHAR(20) DEFAULT 'child'");
  ensureColumn('person', 'calendar_ical_url', 'TEXT');
  ensureColumn('chore', 'icon', 'VARCHAR(20)');
  ensureColumn('chore', 'is_extra', 'BOOLEAN DEFAULT 0');
  ensureColumn('chore', 'extra_id', 'VARCHAR(32)');
  ensureColumn('reward', 'is_recurring', 'BOOLEAN DEFAULT 1');

  const orgNewCols: Array<[string, string]> = [
    ['photo_filename', 'VARCHAR(255)'],
    ['vehicle_make', 'VARCHAR(100)'],
    ['vehicle_model', 'VARCHAR(100)'],
    ['vehicle_year', 'INTEGER'],
    ['vehicle_rego', 'VARCHAR(20)'],
    ['current_odometer', 'INTEGER'],
    ['next_service_date', 'DATE'],
    ['next_service_mileage', 'INTEGER'],
    ['parent_id', 'INTEGER'],
  ];
  for (const [col, type] of orgNewCols) {
    ensureColumn('organise_item', col, type);
  }

  ensureColumn('vehicle_service', 'next_service_date', 'DATE');
  ensureColumn('vehicle_service', 'next_service_mileage', 'INTEGER');

  // Ensure roles are populated and Family user exists
  try {
    db.prepare("UPDATE person SET role = 'parent' WHERE is_admin = 1 AND (role IS NULL OR role = '' OR role = 'child')").run();
    db.prepare("UPDATE person SET role = 'child' WHERE (is_admin = 0 OR is_admin IS NULL) AND (role IS NULL OR role = '')").run();
    const familyRow = db.prepare("SELECT id FROM person WHERE role = 'family' OR name = 'Family'").get();
    if (!familyRow) {
      db.prepare(`
        INSERT INTO person (name, role, points, bonus_points, avatar, color, "order", is_admin)
        VALUES ('Family', 'family', 0, 0, 'default_avatar.png', '#3b82f6', 99, 0)
      `).run();
    }
  } catch (err) {
    console.error('[startup] Error syncing person roles:', err);
  }

  // Clear stale upload references on startup
  try {
    const people = db.prepare('SELECT id, avatar FROM person').all() as Array<{ id: number; avatar: string | null }>;
    let changed = 0;
    for (const p of people) {
      if (p.avatar && p.avatar !== 'default_avatar.png') {
        const filePath = path.join(UPLOADS_DIR, p.avatar);
        if (!fs.existsSync(filePath)) {
          db.prepare('UPDATE person SET avatar = NULL WHERE id = ?').run(p.id);
          changed++;
        }
      }
    }
    const rewards = db.prepare('SELECT id, image_url FROM reward').all() as Array<{ id: number; image_url: string | null }>;
    for (const r of rewards) {
      if (r.image_url && r.image_url.includes('/static/uploads/')) {
        const rel = r.image_url.split('/static/uploads/').pop()!;
        const filePath = path.join(UPLOADS_DIR, rel);
        if (!fs.existsSync(filePath)) {
          db.prepare('UPDATE reward SET image_url = NULL WHERE id = ?').run(r.id);
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

  // Auto-seed household data migrated from http://homeassistant.local:8081 if DB is empty
  try {
    const countRow = db.prepare('SELECT COUNT(id) as cnt FROM person').get() as { cnt: number };
    if (countRow.cnt === 0) {
      console.log('[startup] Seeding migrated household data (Sarah, Abby, Gee)...');
      const pinHash = bcrypt.hashSync('0212', 10);

      const insPerson = db.prepare(
        'INSERT INTO person (id, name, points, bonus_points, avatar, color, "order", is_admin, pin) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)'
      );
      insPerson.run(1, 'Sarah', 0, 'default_avatar.png', '#04201a', 0, 1, pinHash);
      insPerson.run(2, 'Abby', 56, 'default_avatar.png', '#53234c', 1, 0, null);
      insPerson.run(3, 'Gee', 6, 'default_avatar.png', '#3e1688', 2, 0, null);

      const insStreak = db.prepare(
        'INSERT INTO person_streak (person_id, current_streak, longest_streak, last_completed_date) VALUES (?, ?, ?, ?)'
      );
      insStreak.run(1, 0, 0, null);
      insStreak.run(2, 2, 2, null);
      insStreak.run(3, 1, 1, null);

      const insChore = db.prepare(
        'INSERT INTO chore (title, assigned_to_id, assigned_to, points, completed, is_daily, deleted, icon, is_extra) VALUES (?, ?, ?, ?, 0, 1, 0, ?, 0)'
      );
      insChore.run('Make bed', 2, 'Abby', 1.0, '🛏️');
      insChore.run('Brush teeth: Morning', 2, 'Abby', 0.0, '🦷');
      insChore.run('Brush teeth: before bed', 2, 'Abby', 0.0, '🦷');
      insChore.run('Brush Teeth before bed', 3, 'Gee', 1.0, '🦷');

      AppSetting.set('person_ages_json', JSON.stringify({ '1': 37, '2': 6 }));
      AppSetting.set('app_timezone', 'Australia/Brisbane');
      AppSetting.set('reward_system', 'points');
      AppSetting.set(
        'meal_suggestions_json',
        JSON.stringify(['Pancakes', 'Sandwiches', 'Spaghetti Bolognese', 'Tacos', 'Stir Fry', 'sausage & veg'])
      );
      AppSetting.set(
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
      AppSetting.set(
        'shopping_stores_json',
        JSON.stringify([
          { icon: '/static/images/rewards/store_aldi.svg', id: 'aldi', name: 'Aldi' },
          { icon: '/static/images/rewards/store_woolworths.svg', id: 'woolworths', name: 'Woolworths' },
          { icon: '🛒', id: 'coles-7129', name: 'coles' },
          { icon: '🛒', id: 'fruit-an-vege-4537', name: 'fruit an vege' },
        ])
      );
    } else {
      const sarah = db.prepare('SELECT id, pin FROM person WHERE name = ?').get('Sarah') as { id: number; pin: string | null } | undefined;
      if (sarah?.pin && bcrypt.compareSync('1234', sarah.pin)) {
        db.prepare('UPDATE person SET pin = ?, is_admin = 1 WHERE id = ?').run(bcrypt.hashSync('0212', 10), sarah.id);
      }
    }

    // Ensure migrated badges & meal plan are present
    const badgeCnt = (db.prepare('SELECT COUNT(id) as cnt FROM person_badge').get() as { cnt: number }).cnt;
    if (badgeCnt === 0) {
      const nowIso = new Date().toISOString();
      const insBadge = db.prepare('INSERT OR IGNORE INTO person_badge (person_id, badge_key, earned_at) VALUES (?, ?, ?)');
      insBadge.run(2, 'first_chore', nowIso);
      insBadge.run(2, 'perfect_day', nowIso);
      insBadge.run(3, 'first_chore', nowIso);
      insBadge.run(3, 'perfect_day', nowIso);
    }

    if (!AppSetting.get('meal_planner_plan_json')) {
      AppSetting.set(
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
      AppSetting.set(
        'meal_planner_suggestions_json',
        JSON.stringify(['Pancakes', 'Sandwiches', 'Spaghetti Bolognese', 'Tacos', 'Stir Fry', 'sausage & veg'])
      );
    }
    if (!AppSetting.get('timezone')) {
      AppSetting.set('timezone', AppSetting.get('app_timezone') || 'Australia/Brisbane');
    }
    if (!AppSetting.get('daily_reset_hour')) {
      AppSetting.set('daily_reset_hour', '0');
    }

    // Seed shopping_catalog with household staples and existing meal ingredients if empty
    const catCnt = (db.prepare('SELECT COUNT(id) as cnt FROM shopping_catalog').get() as { cnt: number }).cnt;
    if (catCnt === 0) {
      const nowIso = new Date().toISOString();
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
      const fifteenDaysAgo = new Date(Date.now() - 15 * 86400 * 1000).toISOString();
      const staples: Array<{
        name: string;
        store: string;
        added: number;
        purchased: number;
        lastPurchased: string | null;
        avgDays: number | null;
      }> = [
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
      const insCat = db.prepare(`
        INSERT OR IGNORE INTO shopping_catalog
        (name, normalized_key, default_store, times_added, times_purchased, last_added_at, last_purchased_at, avg_interval_days)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const s of staples) {
        insCat.run(
          s.name,
          normalizeShoppingKey(s.name),
          s.store,
          s.added,
          s.purchased,
          nowIso,
          s.lastPurchased,
          s.avgDays
        );
      }
    }

    // Seed recipes table from existing meal_ingredients_json and starter meals if empty
    const recCnt = (db.prepare('SELECT COUNT(id) as cnt FROM recipes').get() as { cnt: number }).cnt;
    if (recCnt === 0) {
      const insRec = db.prepare(`
        INSERT OR IGNORE INTO recipes (meal_key, title, image_url, ingredients_json, instructions, servings, prep_time)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      insRec.run(
        'sausage & veg',
        'Sausage & Veg',
        null,
        JSON.stringify([
          { name: 'Beef sausages', qty: '1 pack', store: 'aldi' },
          { name: 'Potato', qty: '3', store: 'fruit-an-vege-4537' },
          { name: 'Broccoli', qty: '1 head', store: 'fruit-an-vege-4537' },
          { name: 'Carrot', qty: '2', store: 'fruit-an-vege-4537' },
        ]),
        '1. Peel and chop potatoes into chunks; boil in salted water for 15 mins until tender, then mash with butter and milk.\n2. Pan-fry or grill the beef sausages over medium heat for 12–15 mins, turning until golden brown and cooked through.\n3. Slice carrots and broccoli florets; steam or microwave for 4–5 mins until tender-crisp.\n4. Serve sausages over warm mash with steamed greens and gravy.',
        '4',
        '25 mins'
      );
      insRec.run(
        'lasanga',
        'Lasagna',
        null,
        JSON.stringify([
          { name: 'Beef mince', qty: '500g', store: 'aldi' },
          { name: 'Lasagna sheets', qty: '1 box', store: 'aldi' },
          { name: 'Passata / Pasta sauce', qty: '700g', store: 'aldi' },
          { name: 'Mozzarella cheese', qty: '250g', store: 'aldi' },
        ]),
        '1. Preheat oven to 190°C.\n2. Brown the beef mince with onion and garlic, then stir in passata and simmer for 10 mins.\n3. Layer meat sauce, lasagna sheets, and béchamel/cheese in a baking dish.\n4. Top with mozzarella and bake for 35–40 mins until golden and bubbling.',
        '6',
        '50 mins'
      );
      insRec.run(
        'pizza',
        'Homemade Pizza',
        null,
        JSON.stringify([
          { name: 'Pizza bases', qty: '2', store: 'aldi' },
          { name: 'Pizza sauce', qty: '1 jar', store: 'aldi' },
          { name: 'Shredded mozzarella', qty: '200g', store: 'aldi' },
          { name: 'Ham or Pepperoni', qty: '150g', store: 'aldi' },
        ]),
        '1. Preheat oven to 220°C.\n2. Spread pizza sauce evenly over the bases.\n3. Scatter toppings and shredded mozzarella across each pizza.\n4. Bake for 10–12 mins until crust is crisp and cheese is melted.',
        '4',
        '20 mins'
      );
      insRec.run(
        'spaghetti bolognese',
        'Spaghetti Bolognese',
        null,
        JSON.stringify([
          { name: 'Spaghetti', qty: '500g', store: 'aldi' },
          { name: 'Beef mince', qty: '500g', store: 'aldi' },
          { name: 'Tomato passata', qty: '700g', store: 'aldi' },
          { name: 'Parmesan cheese', qty: '100g', store: 'aldi' },
        ]),
        '1. Brown beef mince with diced onion, garlic, and Italian herbs.\n2. Pour in passata and simmer gently for 15–20 mins.\n3. Cook spaghetti in salted boiling water until al dente, drain, and serve topped with bolognese and grated parmesan.',
        '4',
        '25 mins'
      );
    }
  } catch (err) {
    console.error('[startup] Error seeding migrated household data:', err);
  }
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

export const AppSetting = {
  get(key: string, defaultValue: string | null = null): string | null {
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row !== undefined ? row.value : defaultValue;
  },
  set(key: string, value: string): void {
    db.prepare(`
      INSERT INTO app_settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, String(value));
  },
  getRewardSystem(): 'points' | 'cash' {
    const val = AppSetting.get('reward_system', 'points');
    return val === 'cash' ? 'cash' : 'points';
  },
  setRewardSystem(system: string): void {
    if (system !== 'points' && system !== 'cash') {
      throw new Error('Invalid reward system');
    }
    AppSetting.set('reward_system', system);
  },
};

export function logActivity(type: string, description: string, userName: string | null = null): void {
  try {
    const nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19);
    db.prepare('INSERT INTO activity_log (date, type, description, user_name) VALUES (?, ?, ?, ?)').run(
      nowIso,
      type,
      description,
      userName
    );
    console.log(`[ActivityLog] type=${type} user=${userName} desc=${description}`);
  } catch (err) {
    console.error('Error logging activity:', err);
  }
}

export function roundPoints(val: unknown): number {
  const num = Number(val);
  if (Number.isNaN(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}
