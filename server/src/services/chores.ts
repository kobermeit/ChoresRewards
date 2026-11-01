import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { and, eq, sql } from 'drizzle-orm';
import { AppSetting, BADGE_DEFINITIONS, logActivity } from '../db';
import { getDb } from '../db/client';
import { chore as choreTable, personBadge, personStreak } from '../db/schema';
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
  // Settings are cache-backed, so the write can be fire-and-forget without a stale read.
  AppSetting.setLazy('extra_chores_json', JSON.stringify(Array.isArray(extras) ? extras : []));
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

export async function calculateWeeklyProgress(personName: string): Promise<{ completed: number; total: number }> {
  const weekStart = getMondayOfWeek();
  const rows = await getDb()
    .select({ completed: choreTable.completed })
    .from(choreTable)
    .where(and(eq(choreTable.assignedTo, personName), sql`${choreTable.dateCompleted} >= ${weekStart}`));
  const total = rows.length;
  const completed = rows.filter((r) => Boolean(r.completed)).length;
  return { completed, total };
}

export async function resetDailyChores(): Promise<void> {
  const today = getFamilyToday();
  console.log(`[reset_daily_chores] Running daily chore reset for ${today}`);

  const dailyChores = await getDb()
    .select()
    .from(choreTable)
    .where(and(eq(choreTable.isDaily, true), eq(choreTable.deleted, false)));

  let resetCount = 0;
  const overdueChores: Array<{ title: string; assignedTo: string; assignedToId: number | null; dueDate: string | null }> = [];
  const nowIso = new Date().toISOString().replace('T', ' ').slice(0, 19);

  for (const row of dailyChores) {
    const choreDate = row.dueDate ? String(row.dueDate).slice(0, 10) : null;
    const wasIncomplete = !row.completed;

    let completed = Boolean(row.completed);
    let dueDate = choreDate;
    let dueDatetime = row.dueDatetime ? String(row.dueDatetime) : null;
    let rowChanged = false;

    const isDueToday = isDayOfWeekScheduled(today, row.daysOfWeek);
    const targetDate = isDueToday ? today : getNextScheduledDate(today, row.daysOfWeek);

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
      await getDb().update(choreTable).set({ completed, dueDate, dueDatetime }).where(eq(choreTable.id, row.id));
    }

    if (wasIncomplete && dueDatetime && dueDatetime.replace('T', ' ') < nowIso) {
      overdueChores.push({
        title: row.title,
        assignedTo: row.assignedTo || 'Unassigned',
        assignedToId: row.assignedToId,
        dueDate,
      });
    }
  }

  if (resetCount > 0) {
    logActivity('daily_chores_reset', `${resetCount} daily chores were reset for today`);
  }

  // Send overdue notifications asynchronously if configured
  const notifyExpired = AppSetting.get('gotify_notify_due_chores_expired', 'false') === 'true';
  if (notifyExpired && overdueChores.length > 0) {
    for (const item of overdueChores) {
      if (shouldNotifyPerson(item.assignedTo) || shouldNotifyPerson(item.assignedToId)) {
        sendGotifyNotification(
          'Chore Overdue',
          `Chore '${item.title}' assigned to ${item.assignedTo} was not completed before its due date (${item.dueDate}).`
        ).catch(() => {});
      }
    }
  }
}

export async function ensureDailyReset(): Promise<string> {
  const familyToday = getFamilyToday();
  if (AppSetting.get('last_daily_reset', '') !== familyToday) {
    await resetDailyChores();
    await AppSetting.set('last_daily_reset', familyToday);
  }
  return familyToday;
}

export async function checkAndAwardBadges(
  personId: number,
  todayStr: string,
  hour: number,
  weekdayLower: string
): Promise<{ newBadges: Array<{ key: string; emoji: string; name: string; desc: string }>; currentStreak: number }> {
  const db = getDb();
  const newlyEarned: string[] = [];

  // Total chore count badges
  const countRow = await db
    .select({ cnt: sql<number>`COUNT(*)::int` })
    .from(choreTable)
    .where(and(eq(choreTable.assignedToId, personId), eq(choreTable.completed, true)));
  const totalCompleted = Number(countRow[0]?.cnt || 0);

  const thresholds: Array<[string, number]> = [
    ['first_chore', 1],
    ['chores_10', 10],
    ['chores_50', 50],
    ['chores_100', 100],
  ];

  const hasBadge = async (key: string): Promise<boolean> => {
    const rows = await db
      .select({ id: personBadge.id })
      .from(personBadge)
      .where(and(eq(personBadge.personId, personId), eq(personBadge.badgeKey, key)))
      .limit(1);
    return rows.length > 0;
  };
  const addBadge = async (key: string): Promise<void> => {
    await db.insert(personBadge).values({ personId, badgeKey: key }).onConflictDoNothing();
  };

  for (const [key, threshold] of thresholds) {
    if (totalCompleted >= threshold && !(await hasBadge(key))) {
      await addBadge(key);
      newlyEarned.push(key);
    }
  }

  // Check if all of today's chores for this person are done
  const remainingRows = await db
    .select()
    .from(choreTable)
    .where(
      and(
        eq(choreTable.assignedToId, personId),
        eq(choreTable.completed, false),
        eq(choreTable.deleted, false),
        sql`(is_daily = false OR due_date <= ${todayStr})`
      )
    );

  const remainingFiltered = remainingRows.filter((c) => {
    if (!c.daysOfWeek || !String(c.daysOfWeek).trim()) return true;
    const days = String(c.daysOfWeek)
      .split(',')
      .map((d) => d.trim().toLowerCase());
    return days.includes(weekdayLower);
  });

  const allDoneToday = remainingFiltered.length === 0;

  let streakRow = (
    await db.select().from(personStreak).where(eq(personStreak.personId, personId)).limit(1)
  )[0];

  if (!streakRow) {
    await db.insert(personStreak).values({ personId, currentStreak: 0, longestStreak: 0 });
    streakRow = (await db.select().from(personStreak).where(eq(personStreak.personId, personId)).limit(1))[0];
  }

  let cur = streakRow?.currentStreak || 0;
  let best = streakRow?.longestStreak || 0;
  let currentStreak = cur;

  if (allDoneToday) {
    const yesterdayStr = addDays(todayStr, -1);
    const lastDate = streakRow?.lastCompletedDate ? String(streakRow.lastCompletedDate).slice(0, 10) : null;
    if (lastDate === todayStr) {
      // already updated today
    } else if (lastDate === yesterdayStr) {
      cur += 1;
    } else {
      cur = 1;
    }
    best = Math.max(best, cur);
    currentStreak = cur;

    await db
      .update(personStreak)
      .set({ currentStreak: cur, longestStreak: best, lastCompletedDate: todayStr })
      .where(eq(personStreak.personId, personId));

    if (!(await hasBadge('perfect_day'))) {
      await addBadge('perfect_day');
      newlyEarned.push('perfect_day');
    }

    if (hour < 12 && !(await hasBadge('early_bird'))) {
      await addBadge('early_bird');
      newlyEarned.push('early_bird');
    }

    const streakMilestones: Array<[string, number]> = [
      ['streak_3', 3],
      ['streak_7', 7],
      ['streak_30', 30],
    ];
    for (const [key, threshold] of streakMilestones) {
      if (cur >= threshold && !(await hasBadge(key))) {
        await addBadge(key);
        newlyEarned.push(key);
      }
    }
  }

  return {
    newBadges: newlyEarned.map((k) => ({ key: k, ...BADGE_DEFINITIONS[k] })),
    currentStreak,
  };
}
