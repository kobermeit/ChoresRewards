import { AppSetting, db } from '../db';
import { getAppTimezone, getFamilyToday, addDays } from '../utils/time';
import { parseIcsContent } from '../utils/icalParser';

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

export function isGoogleCalendarFeatureEnabled(): boolean {
  const val = (process.env.ENABLE_GOOGLE_CALENDAR ?? 'true').trim().toLowerCase();
  return !['0', 'false', 'no', 'off'].includes(val);
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

let cachedGcalResult: {
  timestamp: number;
  events: any[];
  today_events: any[];
  weekColumns: any[];
  embed_url: string;
  ical_url: string;
  error: string | null;
  last_sync: string | null;
} | null = null;

export async function getGoogleCalendarData(forceRefresh = false): Promise<{
  featureEnabled: boolean;
  enabled: boolean;
  events: any[];
  today_events: any[];
  weekColumns: any[];
  hourLabels: string[];
  embed_url: string;
  ical_url: string;
  error: string | null;
  last_sync: string | null;
}> {
  const featureEnabled = isGoogleCalendarFeatureEnabled();
  const icalUrl = (AppSetting.get('gcal_ical_url', '') || AppSetting.get('google_calendar_ical_url', '') || '').trim();
  const embedUrl = (AppSetting.get('gcal_embed_url', '') || AppSetting.get('google_calendar_embed_url', '') || '').trim();
  const explicitEnabled = (AppSetting.get('google_calendar_enabled', '') || '').toLowerCase();
  const isExplicitlyDisabled = explicitEnabled === 'false' || explicitEnabled === '0' || explicitEnabled === 'off';

  const hasAnyConfig = Boolean(icalUrl || embedUrl);
  const enabled = featureEnabled && hasAnyConfig && !isExplicitlyDisabled;

  const hourLabels = Array.from({ length: 24 }, (_, h) => {
    const suffix = h < 12 ? 'AM' : 'PM';
    const hr = h % 12 === 0 ? 12 : h % 12;
    return `${hr} ${suffix}`;
  });

  const localToday = getFamilyToday();
  const weekDates = Array.from({ length: 7 }, (_, idx) => addDays(localToday, idx));

  if (!enabled) {
    return {
      featureEnabled,
      enabled: false,
      events: [],
      today_events: [],
      weekColumns: buildWeekColumns(weekDates, localToday, []),
      hourLabels,
      embed_url: embedUrl,
      ical_url: icalUrl,
      error: null,
      last_sync: null,
    };
  }

  const refreshMinutes = Math.max(1, Number(AppSetting.get('google_calendar_refresh_minutes', '15')) || 15);
  if (!forceRefresh && cachedGcalResult && Date.now() - cachedGcalResult.timestamp < refreshMinutes * 60 * 1000) {
    return {
      featureEnabled,
      enabled,
      events: cachedGcalResult.events,
      today_events: cachedGcalResult.today_events,
      weekColumns: cachedGcalResult.weekColumns,
      hourLabels,
      embed_url: cachedGcalResult.embed_url,
      ical_url: cachedGcalResult.ical_url,
      error: cachedGcalResult.error,
      last_sync: cachedGcalResult.last_sync,
    };
  }

  const tz = getAppTimezone();
  const colorRules = parseManualColorRules(AppSetting.get('google_calendar_color_rules', '') || '');
  const peopleColors = (db.prepare('SELECT name, color FROM person').all() as Array<{ name: string; color: string }>).map(
    (p) => ({ name: p.name.toLowerCase(), color: p.color || '#3b82f6' })
  );

  // If iCal URL is provided, fetch and parse directly
  if (icalUrl) {
    try {
      let fetchUrl = icalUrl;
      if (fetchUrl.startsWith('webcal://')) {
        fetchUrl = 'https://' + fetchUrl.slice(9);
      }
      const res = await fetch(fetchUrl, {
        headers: { 'User-Agent': 'ChoresRewards-CalendarSync/1.0' },
        signal: AbortSignal.timeout(12000),
      });

      if (!res.ok) {
        throw new Error(`Google Calendar returned HTTP ${res.status} (${res.statusText})`);
      }

      const icsText = await res.text();
      const icsEvents = parseIcsContent(icsText, tz);

      const allEvents: any[] = [];
      for (const item of icsEvents) {
        let color = item.color || '#3b82f6';
        const titleLower = item.summary.toLowerCase();
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

        const [y, mo, da] = item.start_date_iso.split('-').map(Number);
        const dateObj = new Date(Date.UTC(y, mo - 1, da));
        const weekdayShort = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(dateObj);
        const dateLabel = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(dateObj);

        let startMinutes = 0;
        let durationMinutes = 60;
        if (!item.all_day && item.start_time) {
          const [h, m] = item.start_time.split(':').map(Number);
          startMinutes = (h || 0) * 60 + (m || 0);
          if (item.end_time) {
            const [eh, em] = item.end_time.split(':').map(Number);
            durationMinutes = Math.max(15, ((eh || 0) * 60 + (em || 0)) - startMinutes);
          }
        }

        allEvents.push({
          id: item.id,
          title: item.summary,
          summary: item.summary,
          location: item.location || '',
          description: item.description || '',
          all_day: item.all_day,
          start_date_iso: item.start_date_iso,
          end_date_iso: item.end_date_iso || item.start_date_iso,
          weekday_short: weekdayShort,
          date_label: dateLabel,
          time_display: item.time_display,
          start_time_display: item.all_day ? 'All day' : item.time_display.split(' - ')[0],
          end_time_display: item.all_day ? '' : (item.time_display.split(' - ')[1] || ''),
          start_time_sort: item.start_time_sort,
          start_minutes: startMinutes,
          duration_minutes: durationMinutes,
          top_px: Math.round((startMinutes / 60) * 48),
          height_px: Math.max(22, Math.round((durationMinutes / 60) * 48)),
          color,
          emoji: item.emoji || '📅',
        });
      }

      allEvents.sort((a, b) => {
        if (a.start_date_iso !== b.start_date_iso) return a.start_date_iso.localeCompare(b.start_date_iso);
        if (a.all_day !== b.all_day) return a.all_day ? -1 : 1;
        return a.start_time_sort.localeCompare(b.start_time_sort);
      });

      const todayEvents = allEvents.filter((e) => e.start_date_iso === localToday);
      const weekColumns = buildWeekColumns(weekDates, localToday, allEvents);
      const nowIso = new Date().toISOString();

      cachedGcalResult = {
        timestamp: Date.now(),
        events: allEvents,
        today_events: todayEvents,
        weekColumns,
        embed_url: embedUrl,
        ical_url: icalUrl,
        error: null,
        last_sync: nowIso,
      };

      return {
        featureEnabled,
        enabled: true,
        events: allEvents,
        today_events: todayEvents,
        weekColumns,
        hourLabels,
        embed_url: embedUrl,
        ical_url: icalUrl,
        error: null,
        last_sync: nowIso,
      };
    } catch (err: any) {
      console.error('[GCal iCal Sync Error]:', err);
      const lastError = err?.message || 'Failed to fetch calendar from iCal URL';
      return {
        featureEnabled,
        enabled: true,
        events: cachedGcalResult?.events || [],
        today_events: cachedGcalResult?.today_events || [],
        weekColumns: cachedGcalResult?.weekColumns || buildWeekColumns(weekDates, localToday, []),
        hourLabels,
        embed_url: embedUrl,
        ical_url: icalUrl,
        error: lastError,
        last_sync: cachedGcalResult?.last_sync || null,
      };
    }
  }

  // Embed-only mode (no iCal URL specified)
  const nowIso = new Date().toISOString();
  cachedGcalResult = {
    timestamp: Date.now(),
    events: [],
    today_events: [],
    weekColumns: buildWeekColumns(weekDates, localToday, []),
    embed_url: embedUrl,
    ical_url: '',
    error: null,
    last_sync: nowIso,
  };

  return {
    featureEnabled,
    enabled: true,
    events: [],
    today_events: [],
    weekColumns: cachedGcalResult.weekColumns,
    hourLabels,
    embed_url: embedUrl,
    ical_url: '',
    error: null,
    last_sync: nowIso,
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
