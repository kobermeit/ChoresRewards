import { AppSetting } from '../db';

export function getAppTimezone(): string {
  const tz = (AppSetting.get('timezone', 'UTC') || 'UTC').trim();
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

export function getConfiguredTimezone(): string | null {
  const stored = (AppSetting.get('timezone') || '').trim();
  if (!stored) {
    const envTz = (process.env.TZ || '').trim();
    if (envTz) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: envTz });
        return envTz;
      } catch {
        return null;
      }
    }
    return null;
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: stored });
    return stored;
  } catch {
    return null;
  }
}

export function formatDateInTz(date: Date, tz: string | null): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz || undefined,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value || '1970';
  const m = parts.find((p) => p.type === 'month')?.value || '01';
  const d = parts.find((p) => p.type === 'day')?.value || '01';
  return `${y}-${m}-${d}`;
}

export function getLocalNowNaive(tz: string | null = getAppTimezone()): {
  isoNaive: string;
  dateStr: string;
  hour: number;
  weekdayLower: string;
} {
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: tz || undefined,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'long',
  };
  const parts = new Intl.DateTimeFormat('en-US', opts).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  const year = get('year');
  const month = get('month');
  const day = get('day');
  let hourStr = get('hour');
  if (hourStr === '24') hourStr = '00';
  const minute = get('minute');
  const second = get('second');
  const weekdayLower = get('weekday').toLowerCase();
  const dateStr = `${year}-${month}-${day}`;
  const isoNaive = `${dateStr} ${hourStr}:${minute}:${second}`;
  return {
    isoNaive,
    dateStr,
    hour: Number(hourStr),
    weekdayLower,
  };
}

export function getFamilyToday(): string {
  const tz = getConfiguredTimezone();
  return formatDateInTz(new Date(), tz);
}

export function addDays(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function getMondayOfWeek(dateIso?: string | null): string {
  const base = dateIso && /^\d{4}-\d{2}-\d{2}$/.test(dateIso) ? dateIso : getFamilyToday();
  const [y, m, d] = base.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay(); // 0=Sun..6=Sat
  const diffToMon = day === 0 ? -6 : 1 - day;
  dt.setUTCDate(dt.getUTCDate() + diffToMon);
  return dt.toISOString().slice(0, 10);
}

export function isChoreOverdue(
  chore: { due_datetime?: string | null; due_date?: string | null },
  whenNaiveOrIso?: string | null
): boolean {
  const currentLocal = whenNaiveOrIso
    ? whenNaiveOrIso.replace('T', ' ').slice(0, 19)
    : getLocalNowNaive(getAppTimezone()).isoNaive;

  if (chore.due_datetime) {
    const dueNorm = String(chore.due_datetime).replace('T', ' ').slice(0, 19);
    return currentLocal > dueNorm;
  }
  if (chore.due_date) {
    const dayStr = currentLocal.slice(0, 10);
    const dueDayStr = String(chore.due_date).slice(0, 10);
    return dayStr > dueDayStr;
  }
  return false;
}
