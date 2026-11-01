import { Router, Request, Response } from 'express';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { chore as choreTable, choreLog } from '../db/schema';
import { addDays, getFamilyToday } from '../utils/time';

/**
 * Per-chore completion history for the tap-to-open detail modal.
 * Source of truth is `chore_log` (immutable completion entries), not the live
 * `chore` row (which resets daily).
 *
 *   GET /api/chore_history/:choreId  → totals, streak, 14-day series, recent list
 *
 * Reference implementation for the SQLite → Drizzle port: async handler, typed
 * select projections (camelCase), real booleans, identical JSON contract.
 */
export const choreHistoryRouter = Router();

const SERIES_DAYS = 14;

async function handleChoreHistory(req: Request, res: Response): Promise<void> {
  const choreId = Number(req.params.choreId);
  if (!choreId || Number.isNaN(choreId)) {
    res.status(400).json({ success: false, error: 'Invalid chore id' });
    return;
  }

  try {
    const db = getDb();

    const [found] = await db
      .select({ id: choreTable.id, title: choreTable.title })
      .from(choreTable)
      .where(eq(choreTable.id, choreId))
      .limit(1);

    if (!found) {
      res.status(404).json({ success: false, error: 'Chore not found' });
      return;
    }

    const logs = await db
      .select({
        forDate: choreLog.forDate,
        completedAt: choreLog.completedAt,
        personName: choreLog.personName,
        pointsAwarded: choreLog.pointsAwarded,
        wasOverdue: choreLog.wasOverdue,
        actualSeconds: choreLog.actualSeconds,
        timerStatus: choreLog.timerStatus,
      })
      .from(choreLog)
      .where(eq(choreLog.choreId, choreId))
      .orderBy(desc(choreLog.forDate), desc(choreLog.id));

    const today = getFamilyToday();
    const dayKeys = Array.from({ length: SERIES_DAYS }, (_, i) => addDays(today, -(SERIES_DAYS - 1 - i)));
    const perDay: Record<string, number> = {};
    for (const key of dayKeys) perDay[key] = 0;

    const daySet = new Set<string>();
    for (const log of logs) {
      const day = String(log.forDate || '').slice(0, 10);
      if (!day) continue;
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
    const onTime = logs.filter((log) => !log.wasOverdue).length;
    const pointsSum = logs.reduce((sum, log) => sum + Number(log.pointsAwarded || 0), 0);

    res.json({
      success: true,
      chore_id: choreId,
      title: found.title,
      total,
      streak,
      on_time_pct: total > 0 ? Math.round((onTime / total) * 100) : 0,
      avg_points: total > 0 ? Number((pointsSum / total).toFixed(2)) : 0,
      day_keys: dayKeys,
      per_day: perDay,
      recent: logs.slice(0, 8).map((log) => ({
        for_date: String(log.forDate || '').slice(0, 10),
        completed_at: log.completedAt,
        person_name: log.personName,
        points: Number(log.pointsAwarded || 0),
        was_overdue: Boolean(log.wasOverdue),
      })),
    });
  } catch (err: any) {
    console.error('[chore_history] Failed:', err?.message || err);
    res.status(500).json({ success: false, error: err?.message || 'Could not load chore history' });
  }
}

choreHistoryRouter.get(['/api/chore_history/:choreId', '/chore_history/:choreId'], handleChoreHistory);
