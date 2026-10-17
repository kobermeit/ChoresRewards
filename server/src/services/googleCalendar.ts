import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { AppSetting, db } from '../db';
import { DATA_DIR } from '../config';
import { getAppTimezone, getFamilyToday, addDays } from '../utils/time';

const NAMED_GOOGLE_COLORS: Record<string, string> = {
  lavender: '#7986cb',
  sage: '#33b679',
  grape: '#8e24aa',
  flamingo: '#e67c73',
  banana: '#f6bf26',
  tangerine: '#f4511e',
  peacock: '#039be5',
  graphite: '#616161',
  blueberry: '#3f51b5',
  basil: '#0b8043',
  tomato: '#d50000',
  yellow: '#f6bf26',
  purple: '#8e24aa',
  blue: '#4285f4',
  green: '#33b679',
  red: '#d50000',
};

const GCAL_EVENT_COLORS: Record<string, string> = {
  '1': '#7986cb',
  '2': '#33b679',
  '3': '#8e24aa',
  '4': '#e67c73',
  '5': '#f6bf26',
  '6': '#f4511e',
  '7': '#039be5',
  '8': '#616161',
  '9': '#3f51b5',
  '10': '#0b8043',
  '11': '#d50000',
};

export function isGoogleCalendarFeatureEnabled(): boolean {
  const val = (process.env.ENABLE_GOOGLE_CALENDAR ?? 'true').trim().toLowerCase();
  return !['0', 'false', 'no', 'off'].includes(val);
}

export function getServiceAccountPath(): string {
  return path.join(DATA_DIR, 'gcal_service_account.json');
}

export function getServiceAccountEmail(): string | null {
  const saPath = getServiceAccountPath();
  if (!fs.existsSync(saPath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(saPath, 'utf-8'));
    return data.client_email || null;
  } catch {
    return null;
  }
}

async function getServiceAccountAccessToken(): Promise<string | null> {
  const saPath = getServiceAccountPath();
  if (!fs.existsSync(saPath)) return null;
  try {
    const sa = JSON.parse(fs.readFileSync(saPath, 'utf-8'));
    if (!sa.client_email || !sa.private_key) return null;
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claim = Buffer.from(
      JSON.stringify({
        iss: sa.client_email,
        scope: 'https://www.googleapis.com/auth/calendar.readonly',
        aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
      })
    ).toString('base64url');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${header}.${claim}`);
    const signature = sign.sign(sa.private_key, 'base64url');
    const assertion = `${header}.${claim}.${signature}`;

    const res = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { access_token?: string };
    return json.access_token || null;
  } catch (err) {
    console.error('[GCal] Service account token error:', err);
    return null;
  }
}

function normalizeColorValue(val: string | null | undefined): string | null {
  if (!val) return null;
  const v = val.trim().toLowerCase();
  if (NAMED_GOOGLE_COLORS[v]) return NAMED_GOOGLE_COLORS[v];
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^[0-9a-f]{6}$/.test(v)) return `#${v}`;
  return null;
}

function parseManualColorRules(raw: string): Array<{ keyword: string; color: string }> {
  const rules: Array<{ keyword: string; color: string }> = [];
  if (!raw) return rules;
  for (const line of raw.split(/\r?\n/)) {
    const entry = line.trim();
    if (!entry || entry.startsWith('#') || !entry.includes('=')) continue;
    const [k, c] = entry.split('=', 2);
    const keyword = k.trim().toLowerCase();
    const color = normalizeColorValue(c);
    if (keyword && color) {
      rules.push({ keyword, color });
    }
  }
  return rules;
}

function layoutDayEvents(events: any[]): any[] {
  if (!events.length) return [];
  const sorted = [...events].sort((a, b) => (a.start_minutes ?? 0) - (b.start_minutes ?? 0));
  for (let i = 0; i < sorted.length; i++) {
    sorted[i].col_index = 0;
    sorted[i].col_count = 1;
  }
  return sorted;
}

let cachedGcalResult: { timestamp: number; events: any[]; weekColumns: any[]; error: string | null } | null = null;

export async function getGoogleCalendarData(forceRefresh = false): Promise<{
  featureEnabled: boolean;
  enabled: boolean;
  events: any[];
  weekColumns: any[];
  hourLabels: string[];
  error: string | null;
}> {
  const featureEnabled = isGoogleCalendarFeatureEnabled();
  const enabled = featureEnabled && (AppSetting.get('google_calendar_enabled', 'false') || 'false').toLowerCase() === 'true';
  const hourLabels = Array.from({ length: 24 }, (_, h) => {
    const suffix = h < 12 ? 'AM' : 'PM';
    const hr = h % 12 === 0 ? 12 : h % 12;
    return `${hr} ${suffix}`;
  });

  if (!enabled) {
    return { featureEnabled, enabled: false, events: [], weekColumns: [], hourLabels, error: null };
  }

  const refreshMinutes = Math.max(1, Number(AppSetting.get('google_calendar_refresh_minutes', '15')) || 15);
  if (!forceRefresh && cachedGcalResult && Date.now() - cachedGcalResult.timestamp < refreshMinutes * 60 * 1000) {
    return {
      featureEnabled,
      enabled,
      events: cachedGcalResult.events,
      weekColumns: cachedGcalResult.weekColumns,
      hourLabels,
      error: cachedGcalResult.error,
    };
  }

  const calendarIdsRaw = (AppSetting.get('google_calendar_id', '') || '').trim();
  const apiKey = (AppSetting.get('google_calendar_api_key', '') || '').trim();
  const daysAhead = Math.max(1, Number(AppSetting.get('google_calendar_days_ahead', '14')) || 14);
  const maxResults = Math.max(1, Number(AppSetting.get('google_calendar_max_results', '20')) || 20);
  const colorRules = parseManualColorRules(AppSetting.get('google_calendar_color_rules', '') || '');
  const peopleColors = (db.prepare('SELECT name, color FROM person').all() as Array<{ name: string; color: string }>).map(
    (p) => ({ name: p.name.toLowerCase(), color: p.color || '#3b82f6' })
  );

  const calendarIds = calendarIdsRaw
    .split(/[\r\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const localToday = getFamilyToday();
  const weekDates = Array.from({ length: 7 }, (_, idx) => addDays(localToday, idx));

  if (calendarIds.length === 0) {
    return {
      featureEnabled,
      enabled,
      events: [],
      weekColumns: buildWeekColumns(weekDates, localToday, []),
      hourLabels,
      error: 'No Calendar ID configured in Settings.',
    };
  }

  const accessToken = await getServiceAccountAccessToken();
  if (!accessToken && !apiKey) {
    return {
      featureEnabled,
      enabled,
      events: [],
      weekColumns: buildWeekColumns(weekDates, localToday, []),
      hourLabels,
      error: 'Upload a Google Service Account JSON file or configure an API key in Settings.',
    };
  }

  const timeMin = new Date(`${localToday}T00:00:00Z`).toISOString();
  const timeMax = new Date(`${addDays(localToday, daysAhead)}T23:59:59Z`).toISOString();
  const tz = getAppTimezone();

  const allEvents: any[] = [];
  let lastError: string | null = null;

  for (const calId of calendarIds) {
    try {
      const params = new URLSearchParams({
        singleEvents: 'true',
        orderBy: 'startTime',
        timeMin,
        timeMax,
        maxResults: String(maxResults),
      });
      if (!accessToken && apiKey) {
        params.set('key', apiKey);
      }
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?${params.toString()}`;
      const headers: Record<string, string> = {};
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        lastError = `Google Calendar HTTP ${res.status}`;
        continue;
      }
      const data = (await res.json()) as { items?: any[] };
      for (const item of data.items || []) {
        const title = String(item.summary || 'Untitled event');
        const startRaw = item.start?.dateTime || item.start?.date;
        const endRaw = item.end?.dateTime || item.end?.date;
        if (!startRaw) continue;
        const allDay = Boolean(item.start?.date && !item.start?.dateTime);

        let color = '#3b82f6';
        if (item.colorId && GCAL_EVENT_COLORS[String(item.colorId)]) {
          color = GCAL_EVENT_COLORS[String(item.colorId)];
        }
        const titleLower = title.toLowerCase();
        for (const p of peopleColors) {
          if (titleLower.includes(p.name)) {
            color = p.color;
            break;
          }
        }
        for (const r of colorRules) {
          if (titleLower.includes(r.keyword)) {
            color = r.color;
            break;
          }
        }

        let startDateIso = String(startRaw).slice(0, 10);
        let startMinutes = 0;
        let durationMinutes = 60;
        let startTimeDisplay = 'All day';
        let endTimeDisplay = '';
        let startTimeSort = '00:00';

        if (!allDay) {
          const startDt = new Date(startRaw);
          const endDt = endRaw ? new Date(endRaw) : new Date(startDt.getTime() + 3600000);
          const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }).formatToParts(startDt);
          const get = (t: string) => parts.find((p) => p.type === t)?.value || '00';
          startDateIso = `${get('year')}-${get('month')}-${get('day')}`;
          const h = Number(get('hour')) % 24;
          const m = Number(get('minute'));
          startMinutes = h * 60 + m;
          durationMinutes = Math.max(30, Math.round((endDt.getTime() - startDt.getTime()) / 60000));
          startTimeSort = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          startTimeDisplay = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            hour: 'numeric',
            minute: '2-digit',
          }).format(startDt);
          endTimeDisplay = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            hour: 'numeric',
            minute: '2-digit',
          }).format(endDt);
        }

        const [y, mo, da] = startDateIso.split('-').map(Number);
        const dateObj = new Date(Date.UTC(y, mo - 1, da));
        const weekdayShort = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(dateObj);
        const dateLabel = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(dateObj);

        allEvents.push({
          id: item.id,
          title,
          location: item.location || '',
          description: item.description || '',
          all_day: allDay,
          start_date_iso: startDateIso,
          weekday_short: weekdayShort,
          date_label: dateLabel,
          start_time_display: startTimeDisplay,
          end_time_display: endTimeDisplay,
          start_time_sort: startTimeSort,
          start_minutes: startMinutes,
          duration_minutes: durationMinutes,
          top_px: Math.round((startMinutes / 60) * 48),
          height_px: Math.max(22, Math.round((durationMinutes / 60) * 48)),
          color,
        });
      }
    } catch (err: any) {
      lastError = err?.message || 'Failed to fetch Google Calendar';
    }
  }

  allEvents.sort((a, b) => {
    if (a.start_date_iso !== b.start_date_iso) return a.start_date_iso.localeCompare(b.start_date_iso);
    if (a.all_day !== b.all_day) return a.all_day ? -1 : 1;
    return a.start_time_sort.localeCompare(b.start_time_sort);
  });

  const weekColumns = buildWeekColumns(weekDates, localToday, allEvents);
  cachedGcalResult = {
    timestamp: Date.now(),
    events: allEvents,
    weekColumns,
    error: allEvents.length === 0 ? lastError : null,
  };

  return {
    featureEnabled,
    enabled,
    events: allEvents,
    weekColumns,
    hourLabels,
    error: cachedGcalResult.error,
  };
}

function buildWeekColumns(weekDates: string[], localToday: string, events: any[]): any[] {
  const byDay: Record<string, any[]> = {};
  for (const d of weekDates) byDay[d] = [];
  for (const ev of events) {
    if (byDay[ev.start_date_iso]) {
      byDay[ev.start_date_iso].push(ev);
    }
  }

  return weekDates.map((dayIso) => {
    const [y, m, d] = dayIso.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(dt);
    const dayFull = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(dt);
    const dateLabel = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(dt);
    const dayEventsAll = byDay[dayIso] || [];
    const timedEvents = layoutDayEvents(dayEventsAll.filter((e) => !e.all_day));
    const allDayEvents = dayEventsAll.filter((e) => e.all_day);
    return {
      day_name: dayName,
      day_full: dayFull,
      date_label: dateLabel,
      date_iso: dayIso,
      is_today: dayIso === localToday,
      events: timedEvents,
      all_day_events: allDayEvents,
    };
  });
}

export function invalidateGcalCache(): void {
  cachedGcalResult = null;
}
