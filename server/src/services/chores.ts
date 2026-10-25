import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db, AppSetting, BADGE_DEFINITIONS, logActivity } from '../db';
import { DATA_DIR } from '../config';
import { getFamilyToday, getMondayOfWeek, addDays, isDayOfWeekScheduled, getNextScheduledDate } from '../utils/time';
import { sendGotifyNotification, shouldNotifyPerson } from './gotify';
import { defaultQuizQuestions } from '../defaultQuizQuestions';

import { calculateAge } from '../utils/people';

export interface ExtraChoreItem {
  id: string;
  title: string;
  points: number;
  min_age: number;
  max_age: number | null;
  icon: string;
  enabled: boolean;
  sort_order: number;
}

export const EXTRA_CHORES_DEFAULTS = [
  { title: 'Put toys in the toy box', points: 1, min_age: 3, icon: '🧸' },
  { title: 'Make your bed extra neat', points: 1, min_age: 4, icon: '🛏️' },
  { title: 'Wipe the kitchen table', points: 1, min_age: 4, icon: '🧽' },
  { title: 'Water the plants', points: 1, min_age: 4, icon: '🌱' },
  { title: 'Clean the toy room', points: 2, min_age: 5, icon: '🎮' },
  { title: 'Help fold laundry', points: 2, min_age: 5, icon: '👕' },
  { title: 'Vacuum a room', points: 2, min_age: 6, icon: '🧹' },
  { title: 'Empty the dishwasher', points: 2, min_age: 6, icon: '🍽️' },
  { title: 'Clean up dog poo outside', points: 2, min_age: 6, icon: '🐶' },
  { title: 'Take out the rubbish', points: 2, min_age: 7, icon: '🗑️' },
  { title: 'Clean the bathroom', points: 3, min_age: 8, icon: '🚿' },
  { title: 'Cook dinner for the family', points: 5, min_age: 10, icon: '🍳' },
];

export function normaliseExtraChore(raw: any, sortOrder = 0): ExtraChoreItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const title = String(raw.title || '').trim().slice(0, 100);
  if (!title) return null;
  let extraId = String(raw.id || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 32);
  if (!extraId) {
    extraId = crypto.randomBytes(8).toString('hex');
  }
  let points = Number(raw.points ?? 1);
  if (Number.isNaN(points) || points <= 0) points = 1.0;
  let minAge = parseInt(String(raw.min_age ?? 0), 10);
  if (Number.isNaN(minAge)) minAge = 0;
  minAge = Math.max(0, Math.min(minAge, 18));

  let maxAge: number | null = null;
  if (raw.max_age !== null && raw.max_age !== undefined && raw.max_age !== '' && raw.max_age !== false) {
    const parsedMax = parseInt(String(raw.max_age), 10);
    if (!Number.isNaN(parsedMax)) {
      maxAge = Math.max(minAge, Math.min(parsedMax, 18));
    }
  }
  const icon = String(raw.icon || '').trim().slice(0, 20);
  let enabled = true;
  if (typeof raw.enabled === 'string') {
    enabled = !['0', 'false', 'off', 'no'].includes(raw.enabled.trim().toLowerCase());
  } else if (raw.enabled !== undefined) {
    enabled = Boolean(raw.enabled);
  }
  return {
    id: extraId,
    title,
    points,
    min_age: minAge,
    max_age: maxAge,
    icon,
    enabled,
    sort_order: Number(raw.sort_order ?? sortOrder) || sortOrder,
  };
}

export function seedExtraChores(): ExtraChoreItem[] {
  return EXTRA_CHORES_DEFAULTS.map((item, idx) => normaliseExtraChore(item, idx)!).filter(Boolean);
}

export function saveExtraChores(extras: ExtraChoreItem[]): void {
  AppSetting.set('extra_chores_json', JSON.stringify(Array.isArray(extras) ? extras : []));
}

export function getExtraChores(): ExtraChoreItem[] {
  const raw = AppSetting.get('extra_chores_json', '');
  if (!raw) {
    const seeded = seedExtraChores();
    saveExtraChores(seeded);
    return seeded;
  }
  let data: any[] = [];
  try {
    data = JSON.parse(raw);
  } catch {
    data = [];
  }
  if (!Array.isArray(data) || data.length === 0) {
    const seeded = seedExtraChores();
    saveExtraChores(seeded);
    return seeded;
  }
  const cleaned: ExtraChoreItem[] = [];
  const seen = new Set<string>();
  data.forEach((item, index) => {
    const extra = normaliseExtraChore(item, index);
    if (extra && !seen.has(extra.id)) {
      seen.add(extra.id);
      cleaned.push(extra);
    }
  });
  cleaned.sort((a, b) => (a.sort_order - b.sort_order) || a.title.localeCompare(b.title));
  return cleaned;
}

export function getPersonAgeValue(person: { id?: number; age?: number | null; dob?: string | null } | null | undefined): number {
  if (!person) return 6;
  if (person.age !== null && person.age !== undefined) {
    const n = Number(person.age);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  if (person.dob) {
    const calc = calculateAge(person.dob, null);
    if (calc !== null && calc > 0) return calc;
  }
  try {
    const rawAges = AppSetting.get('person_ages_json', '');
    if (rawAges && person.id) {
      const parsed = JSON.parse(rawAges);
      if (parsed[String(person.id)]) {
        return Number(parsed[String(person.id)]) || 6;
      }
    }
  } catch {}
  return 6;
}

export function extraMatchesAge(extra: ExtraChoreItem, age: number): boolean {
  const minAge = Number(extra.min_age || 0);
  if (age < minAge) return false;
  if (extra.max_age !== null && extra.max_age !== undefined && age > Number(extra.max_age)) {
    return false;
  }
  return true;
}

export function getExtrasForPerson(person: { age?: number | null } | null | undefined): ExtraChoreItem[] {
  const age = getPersonAgeValue(person);
  return getExtraChores().filter((e) => e.enabled && extraMatchesAge(e, age));
}

// Quiz questions storage
const QUIZ_QUESTIONS_PATH = path.join(DATA_DIR, 'quiz_questions.json');

export function loadQuizQuestions(): any[] {
  if (fs.existsSync(QUIZ_QUESTIONS_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(QUIZ_QUESTIONS_PATH, 'utf-8'));
      if (Array.isArray(data)) return data;
    } catch {
      // fall through
    }
  }
  try {
    saveQuizQuestions(defaultQuizQuestions);
  } catch {
    // ignore
  }
  return [...defaultQuizQuestions];
}

export function saveQuizQuestions(questions: any[]): void {
  fs.writeFileSync(QUIZ_QUESTIONS_PATH, JSON.stringify(questions, null, 2), 'utf-8');
}

export function calculateWeeklyProgress(personName: string): { completed: number; total: number } {
  const weekStart = getMondayOfWeek();
  const rows = db
    .prepare('SELECT completed FROM chore WHERE assigned_to = ? AND date_completed >= ?')
    .all(personName, weekStart) as Array<{ completed: number }>;
  const total = rows.length;
  const completed = rows.filter((r) => Boolean(r.completed)).length;
  return { completed, total };
}

export function resetDailyChores(): void {
  const today = getFamilyToday();
  console.log(`[reset_daily_chores] Running daily chore reset for ${today}`);

  const dailyChores = db
    .prepare('SELECT * FROM chore WHERE is_daily = 1 AND deleted = 0')
    .all() as Array<any>;

  let resetCount = 0;
  const overdueChores: any[] = [];
  const nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19);

  for (const chore of dailyChores) {
    const choreDate = chore.due_date ? String(chore.due_date).slice(0, 10) : null;
    const wasIncomplete = !chore.completed;

    let completed = Boolean(chore.completed);
    let dueDate = choreDate;
    let dueDatetime = chore.due_datetime ? String(chore.due_datetime) : null;
    let rowChanged = false;

    const isDueToday = isDayOfWeekScheduled(today, chore.days_of_week);
    const targetDate = isDueToday ? today : getNextScheduledDate(today, chore.days_of_week);

    if (!choreDate || choreDate < today || (choreDate === today && !isDueToday)) {
      completed = false;
      dueDate = targetDate;
      rowChanged = true;
      if (isDueToday) resetCount++;
    }

    if (!completed && dueDatetime) {
      const dtDate = dueDatetime.slice(0, 10);
      if (dtDate < today || (dtDate === today && !isDueToday)) {
        dueDatetime = `${targetDate}${dueDatetime.slice(10)}`;
        rowChanged = true;
      }
    }

    if (rowChanged) {
      db.prepare('UPDATE chore SET completed = ?, due_date = ?, due_datetime = ? WHERE id = ?').run(
        completed ? 1 : 0,
        dueDate,
        dueDatetime,
        chore.id
      );
    }

    if (wasIncomplete && dueDatetime && dueDatetime.replace('T', ' ') < nowIso) {
      overdueChores.push(chore);
    }
  }

  if (resetCount > 0) {
    logActivity('daily_chores_reset', `${resetCount} daily chores were reset for today`);
  }

  // Send overdue notifications asynchronously if configured
  const notifyExpired = AppSetting.get('gotify_notify_due_chores_expired', 'false') === 'true';
  if (notifyExpired && overdueChores.length > 0) {
    for (const chore of overdueChores) {
      const assignedTo = chore.assigned_to || 'Unassigned';
      if (shouldNotifyPerson(assignedTo) || shouldNotifyPerson(chore.assigned_to_id)) {
        sendGotifyNotification(
          'Chore Overdue',
          `Chore '${chore.title}' assigned to ${assignedTo} was not completed before its due date (${chore.due_date}).`
        ).catch(() => {});
      }
    }
  }
}

export function ensureDailyReset(): string {
  const familyToday = getFamilyToday();
  if (AppSetting.get('last_daily_reset', '') !== familyToday) {
    resetDailyChores();
    AppSetting.set('last_daily_reset', familyToday);
  }
  return familyToday;
}

export function checkAndAwardBadges(
  personId: number,
  todayStr: string,
  hour: number,
  weekdayLower: string
): { newBadges: Array<{ key: string; emoji: string; name: string; desc: string }>; currentStreak: number } {
  const newlyEarned: string[] = [];

  // Total chore count badges
  const countRow = db
    .prepare('SELECT COUNT(*) as cnt FROM chore WHERE assigned_to_id = ? AND completed = 1')
    .get(personId) as { cnt: number };
  const totalCompleted = countRow?.cnt || 0;

  const thresholds: Array<[string, number]> = [
    ['first_chore', 1],
    ['chores_10', 10],
    ['chores_50', 50],
    ['chores_100', 100],
  ];

  const hasBadgeStmt = db.prepare('SELECT 1 FROM person_badge WHERE person_id = ? AND badge_key = ?');
  const addBadgeStmt = db.prepare('INSERT OR IGNORE INTO person_badge (person_id, badge_key) VALUES (?, ?)');

  for (const [key, threshold] of thresholds) {
    if (totalCompleted >= threshold && !hasBadgeStmt.get(personId, key)) {
      addBadgeStmt.run(personId, key);
      newlyEarned.push(key);
    }
  }

  // Check if all of today's chores for this person are done
  const remainingRows = db
    .prepare(
      'SELECT * FROM chore WHERE assigned_to_id = ? AND completed = 0 AND deleted = 0 AND (is_daily = 0 OR due_date <= ?)'
    )
    .all(personId, todayStr) as Array<any>;

  const remainingFiltered = remainingRows.filter((c) => {
    if (!c.days_of_week || !String(c.days_of_week).trim()) return true;
    const days = String(c.days_of_week)
      .split(',')
      .map((d) => d.trim().toLowerCase());
    return days.includes(weekdayLower);
  });

  const allDoneToday = remainingFiltered.length === 0;

  let streakRow = db
    .prepare('SELECT * FROM person_streak WHERE person_id = ?')
    .get(personId) as { id: number; current_streak: number; longest_streak: number; last_completed_date: string | null } | undefined;

  if (!streakRow) {
    db.prepare('INSERT INTO person_streak (person_id, current_streak, longest_streak) VALUES (?, 0, 0)').run(personId);
    streakRow = db.prepare('SELECT * FROM person_streak WHERE person_id = ?').get(personId) as any;
  }

  let cur = streakRow?.current_streak || 0;
  let best = streakRow?.longest_streak || 0;
  let currentStreak = cur;

  if (allDoneToday) {
    const yesterdayStr = addDays(todayStr, -1);
    const lastDate = streakRow?.last_completed_date ? String(streakRow.last_completed_date).slice(0, 10) : null;
    if (lastDate === todayStr) {
      // already updated today
    } else if (lastDate === yesterdayStr) {
      cur += 1;
    } else {
      cur = 1;
    }
    best = Math.max(best, cur);
    currentStreak = cur;

    db.prepare(
      'UPDATE person_streak SET current_streak = ?, longest_streak = ?, last_completed_date = ? WHERE person_id = ?'
    ).run(cur, best, todayStr, personId);

    if (!hasBadgeStmt.get(personId, 'perfect_day')) {
      addBadgeStmt.run(personId, 'perfect_day');
      newlyEarned.push('perfect_day');
    }

    if (hour < 12 && !hasBadgeStmt.get(personId, 'early_bird')) {
      addBadgeStmt.run(personId, 'early_bird');
      newlyEarned.push('early_bird');
    }

    const streakMilestones: Array<[string, number]> = [
      ['streak_3', 3],
      ['streak_7', 7],
      ['streak_30', 30],
    ];
    for (const [key, threshold] of streakMilestones) {
      if (cur >= threshold && !hasBadgeStmt.get(personId, key)) {
        addBadgeStmt.run(personId, key);
        newlyEarned.push(key);
      }
    }
  }

  return {
    newBadges: newlyEarned.map((k) => ({ key: k, ...BADGE_DEFINITIONS[k] })),
    currentStreak,
  };
}
