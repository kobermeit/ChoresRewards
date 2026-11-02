import { Chore } from '../../types';

/**
 * "How much can each member earn in a full week?"
 *
 * Pure helpers for the All Chores catalog summary. The rules are deliberately
 * simple and match what a parent would work out on paper:
 *
 *  - only real assigned chores count — the extra bonus pool (`is_extra`) and
 *    `bonus_points` are ignored, because neither is guaranteed;
 *  - a daily chore is worth `points × scheduled days` (Mon–Sun; an unrestricted
 *    daily chore counts 7);
 *  - a one-off chore counts once;
 *  - nothing is discounted for chores already done today — this is the *potential*,
 *    i.e. "if they complete everything, every day, Monday to Sunday".
 */

const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/** Human schedule label; tolerates a CSV string or an array (older payloads). */
export function scheduleLabel(raw: string | string[] | null | undefined, isDaily: boolean): string {
  const days = (Array.isArray(raw) ? raw : raw ? String(raw).split(',') : [])
    .map((d) => String(d).trim().toLowerCase())
    .filter(Boolean);
  if (days.length >= 7) return 'Every day';
  if (days.length === 5 && ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].every((d) => days.includes(d))) {
    return 'Mon – Fri';
  }
  if (days.length === 2 && ['saturday', 'sunday'].every((d) => days.includes(d))) return 'Weekends';
  if (days.length > 0) {
    const short: Record<string, string> = {
      monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
    };
    return days.map((d) => short[d] || d.slice(0, 3)).join(', ');
  }
  return isDaily ? 'Every day' : 'Once-off';
}

/** How many times this chore is scheduled in a Mon–Sun week. */
export function scheduledDaysPerWeek(chore: Chore): number {
  if (!chore.is_daily) return 1;
  const raw = chore.days_of_week as unknown;
  const days = (Array.isArray(raw) ? raw : raw ? String(raw).split(',') : [])
    .map((d: unknown) => String(d).trim().toLowerCase())
    .filter((d: string) => WEEKDAYS.includes(d));
  if (days.length === 0 || days.length >= 7) return 7;
  return new Set(days).size;
}

export interface WeeklyChoreLine {
  id: number;
  title: string;
  icon: string | null;
  /** Points for a single completion (bonus points excluded). */
  pointsPerDay: number;
  /** Scheduled occurrences in a Mon–Sun week. */
  daysPerWeek: number;
  weeklyPoints: number;
  schedule: string;
}

export interface MemberWeeklyPotential {
  choreCount: number;
  /** Best-case earnings if every scheduled chore is completed Mon–Sun. */
  weeklyPoints: number;
  /** Highest-value chore first. */
  lines: WeeklyChoreLine[];
}

export const emptyWeeklyPotential: MemberWeeklyPotential = { choreCount: 0, weeklyPoints: 0, lines: [] };

/** Weekly earning potential for one member (matches on the chore's assigned_to name). */
export function computeWeeklyPotential(chores: Chore[], memberName: string): MemberWeeklyPotential {
  if (!memberName) return emptyWeeklyPotential;

  const lines: WeeklyChoreLine[] = chores
    .filter(
      (chore) =>
        !chore.deleted &&
        !chore.is_extra &&
        chore.assigned_to === memberName &&
        Number(chore.points) > 0
    )
    .map((chore) => {
      const pointsPerDay = Number(chore.points) || 0;
      const daysPerWeek = scheduledDaysPerWeek(chore);
      return {
        id: chore.id,
        title: chore.title,
        icon: chore.icon || null,
        pointsPerDay,
        daysPerWeek,
        weeklyPoints: Math.round(pointsPerDay * daysPerWeek * 100) / 100,
        schedule: scheduleLabel(chore.days_of_week, Boolean(chore.is_daily)),
      };
    })
    .sort((a, b) => b.weeklyPoints - a.weeklyPoints || a.title.localeCompare(b.title));

  const weeklyPoints =
    Math.round(lines.reduce((sum, line) => sum + line.weeklyPoints, 0) * 100) / 100;

  return { choreCount: lines.length, weeklyPoints, lines };
}

/** `70 pts` / `12.5 pts` — compact, stable formatting for chips and totals. */
export function formatPoints(value: number): string {
  return `${Number(value) % 1 === 0 ? Number(value).toFixed(0) : Number(value).toFixed(1)} pts`;
}

/** `$35.00` from a points amount using the household's point value. */
export function pointsToCash(points: number, pointValue: number): string {
  return `$${(Number(points) * (Number(pointValue) || 0)).toFixed(2)}`;
}
