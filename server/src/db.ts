import Database from 'better-sqlite3';
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
      date_completed DATETIME
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
  `);

  // Safe migrations for existing databases
  ensureColumn('person', 'age', 'INTEGER');
  ensureColumn('chore', 'icon', 'VARCHAR(20)');
  ensureColumn('chore', 'is_extra', 'BOOLEAN DEFAULT 0');
  ensureColumn('chore', 'extra_id', 'VARCHAR(32)');

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
