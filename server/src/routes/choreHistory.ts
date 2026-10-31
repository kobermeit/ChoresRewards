import { Router, Request, Response } from 'express';
import { db } from '../db';
import { addDays, getFamilyToday } from '../utils/time';

/**
 * Per-chore completion history for the tap-to-open detail modal.
 * Source of truth is `chore_log` (immutable completion entries), not the live
 * `chore` row (which resets daily).
 *
 *   GET /api/chore_history/:choreId  → totals, streak, 14-day series, recent list
 */
export const choreHistoryRouter = Router();

const SERIES_DAYS = 14;

function handleChoreHistory(req: Request, res: Response): void {
  const choreId = Number(req.params.choreId);
  if (!choreId || Number.isNaN(choreId)) {
    res.status(400).json({ success: false, error: 'Invalid chore id' });
    return;
  }

  const chore = db.prepare('SELECT id, title FROM chore WHERE id = ?').get(choreId) as
    | { id: number; title: string }
    | undefined;
  if (!chore) {
    res.status(404).json({ success: false, error: 'Chore not found' });
    return;
  }

  const logs = db
    .prepare(
      'SELECT for_date, completed_at, person_name, points_awarded, was_overdue, actual_seconds, timer_status ' +
        'FROM chore_log WHERE chore_id = ? ORDER BY for_date DESC, id DESC'
    )
    .all(choreId) as Array<any>;

  const today = getFamilyToday();
  const dayKeys = Array.from({ length: SERIES_DAYS }, (_, i) => addDays(today, -(SERIES_DAYS - 1 - i)));
  const perDay: Record<string, number> = {};
  for (const key of dayKeys) perDay[key] = 0;

  const daySet = new Set<string>();
  for (const log of logs) {
    const day = String(log.for_date).slice(0, 10);
    daySet.add(day);
    if (day in perDay) perDay[day] += 1;
  }

  let streak = 0;
  let cursor = daySet.has(today) ? today : addDays(today, -1);
  while (daySet.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  const total = logs.length;
  const onTime = logs.filter((log) => !Number(log.was_overdue)).length;
  const pointsSum = logs.reduce((sum, log) => sum + Number(log.points_awarded || 0), 0);

  res.json({
    success: true,
    chore_id: choreId,
    title: chore.title,
    total,
    streak,
    on_time_pct: total > 0 ? Math.round((onTime / total) * 100) : 0,
    avg_points: total > 0 ? Number((pointsSum / total).toFixed(2)) : 0,
    day_keys: dayKeys,
    per_day: perDay,
    recent: logs.slice(0, 8).map((log) => ({
      for_date: String(log.for_date).slice(0, 10),
      completed_at: log.completed_at,
      person_name: log.person_name,
      points: Number(log.points_awarded || 0),
      was_overdue: Boolean(log.was_overdue),
    })),
  });
}

choreHistoryRouter.get(
  ['/api/chore_history/:choreId', '/chore_history/:choreId'],
  handleChoreHistory
);
