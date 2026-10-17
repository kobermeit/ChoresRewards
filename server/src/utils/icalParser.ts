export interface ParsedCalendarEvent {
  id: string;
  summary: string;
  description: string;
  location: string;
  start_date_iso: string; // YYYY-MM-DD
  end_date_iso: string; // YYYY-MM-DD
  start_time: string; // HH:MM or ''
  end_time: string; // HH:MM or ''
  time_display: string; // e.g. '10:00 AM - 11:30 AM' or 'All Day'
  start_time_sort: string;
  all_day: boolean;
  color: string;
  emoji: string;
}

function parseIcalDate(rawVal: string, tz: string): { dateIso: string; time: string; allDay: boolean } {
  // rawVal could be:
  // 20261018
  // 20261018T103000Z
  // 20261018T103000
  const clean = rawVal.replace(/[^0-9TZ]/gi, '');
  if (clean.length === 8) {
    // All day: YYYYMMDD
    const y = clean.slice(0, 4);
    const m = clean.slice(4, 6);
    const d = clean.slice(6, 8);
    return { dateIso: `${y}-${m}-${d}`, time: '', allDay: true };
  }

  if (clean.length >= 15) {
    const y = Number(clean.slice(0, 4));
    const m = Number(clean.slice(4, 6)) - 1;
    const d = Number(clean.slice(6, 8));
    const hh = Number(clean.slice(9, 11));
    const mm = Number(clean.slice(11, 13));
    const ss = Number(clean.slice(13, 15));

    let dt: Date;
    if (clean.endsWith('Z')) {
      dt = new Date(Date.UTC(y, m, d, hh, mm, ss));
    } else {
      dt = new Date(y, m, d, hh, mm, ss);
    }

    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(dt);

      const partMap: Record<string, string> = {};
      for (const p of parts) partMap[p.type] = p.value;

      const dateIso = `${partMap.year}-${partMap.month}-${partMap.day}`;
      const time = `${partMap.hour}:${partMap.minute}`;
      return { dateIso, time, allDay: false };
    } catch {
      const dateIso = `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
      const time = `${clean.slice(9, 11)}:${clean.slice(11, 13)}`;
      return { dateIso, time, allDay: false };
    }
  }

  return { dateIso: new Date().toISOString().slice(0, 10), time: '', allDay: true };
}

function formatTimeDisplay(start: string, end: string, allDay: boolean): string {
  if (allDay) return 'All Day';
  if (!start) return '';

  const formatAmPm = (t: string) => {
    const [hhStr, mmStr] = t.split(':');
    let hh = parseInt(hhStr, 10);
    const mm = mmStr || '00';
    const ampm = hh >= 12 ? 'PM' : 'AM';
    hh = hh % 12 || 12;
    return `${hh}:${mm} ${ampm}`;
  };

  const startFmt = formatAmPm(start);
  if (end && end !== start) {
    return `${startFmt} - ${formatAmPm(end)}`;
  }
  return startFmt;
}

function detectEventEmoji(title: string, loc: string): { emoji: string; color: string } {
  const t = `${title} ${loc}`.toLowerCase();
  if (t.includes('swim') || t.includes('pool')) return { emoji: '🏊', color: '#06b6d4' };
  if (t.includes('soccer') || t.includes('footy') || t.includes('football')) return { emoji: '⚽', color: '#10b981' };
  if (t.includes('gym') || t.includes('workout') || t.includes('training')) return { emoji: '💪', color: '#f59e0b' };
  if (t.includes('dance') || t.includes('ballet')) return { emoji: '🩰', color: '#ec4899' };
  if (t.includes('music') || t.includes('piano') || t.includes('guitar')) return { emoji: '🎵', color: '#8b5cf6' };
  if (t.includes('dentist') || t.includes('teeth')) return { emoji: '🦷', color: '#38bdf8' };
  if (t.includes('doctor') || t.includes('medical') || t.includes('hospital') || t.includes('clinic')) return { emoji: '🩺', color: '#ef4444' };
  if (t.includes('birthday') || t.includes('party')) return { emoji: '🎂', color: '#f43f5e' };
  if (t.includes('school') || t.includes('excursion') || t.includes('class')) return { emoji: '🎒', color: '#3b82f6' };
  if (t.includes('movie') || t.includes('cinema')) return { emoji: '🍿', color: '#a855f7' };
  if (t.includes('dinner') || t.includes('lunch') || t.includes('bbq') || t.includes('picnic')) return { emoji: '🍽️', color: '#f97316' };
  if (t.includes('flight') || t.includes('airport') || t.includes('travel') || t.includes('holiday')) return { emoji: '✈️', color: '#0ea5e9' };
  if (t.includes('vet') || t.includes('dog') || t.includes('cat') || t.includes('pet')) return { emoji: '🐾', color: '#14b8a6' };
  if (t.includes('clean') || t.includes('bin') || t.includes('mow') || t.includes('garden')) return { emoji: '🏡', color: '#84cc16' };
  return { emoji: '📅', color: '#3b82f6' };
}

function expandRecurrences(
  base: ParsedCalendarEvent,
  rruleStr: string,
  windowStartIso: string,
  windowEndIso: string
): ParsedCalendarEvent[] {
  const result: ParsedCalendarEvent[] = [];
  try {
    const parts = rruleStr.split(';');
    const ruleMap: Record<string, string> = {};
    for (const p of parts) {
      const [k, v] = p.split('=');
      if (k && v) ruleMap[k.toUpperCase()] = v.toUpperCase();
    }

    const freq = ruleMap.FREQ;
    if (!freq || (freq !== 'WEEKLY' && freq !== 'DAILY' && freq !== 'MONTHLY')) {
      return result;
    }

    const interval = parseInt(ruleMap.INTERVAL || '1', 10) || 1;
    const until = ruleMap.UNTIL ? ruleMap.UNTIL.slice(0, 8) : null;
    const count = ruleMap.COUNT ? parseInt(ruleMap.COUNT, 10) : 100;

    const byDays = ruleMap.BYDAY ? ruleMap.BYDAY.split(',') : null;
    const dayMap: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

    const startDate = new Date(`${base.start_date_iso}T00:00:00Z`);
    const winStart = new Date(`${windowStartIso}T00:00:00Z`);
    const winEnd = new Date(`${windowEndIso}T23:59:59Z`);

    let cur = new Date(startDate.getTime());
    let generated = 0;
    const maxIterations = 500;
    let iterations = 0;

    while (iterations < maxIterations && generated < count) {
      iterations++;
      const curIso = cur.toISOString().slice(0, 10);
      const curCompact = curIso.replace(/-/g, '');

      if (until && curCompact > until) break;
      if (cur > winEnd) break;

      if (cur >= winStart) {
        if (!byDays || byDays.some((d) => dayMap[d] === cur.getUTCDay())) {
          if (curIso !== base.start_date_iso) {
            result.push({
              ...base,
              id: `${base.id}_${curIso}`,
              start_date_iso: curIso,
              end_date_iso: curIso,
            });
            generated++;
          }
        }
      }

      if (freq === 'DAILY') {
        cur.setUTCDate(cur.getUTCDate() + interval);
      } else if (freq === 'WEEKLY') {
        if (byDays && byDays.length > 1) {
          cur.setUTCDate(cur.getUTCDate() + 1);
        } else {
          cur.setUTCDate(cur.getUTCDate() + 7 * interval);
        }
      } else if (freq === 'MONTHLY') {
        cur.setUTCMonth(cur.getUTCMonth() + interval);
      }
    }
  } catch {
    // ignore parsing errors
  }
  return result;
}

export function parseIcsContent(
  icsContent: string,
  tz: string = 'Australia/Brisbane',
  windowStartIso?: string,
  windowEndIso?: string
): ParsedCalendarEvent[] {
  if (!icsContent) return [];

  // Default window: 30 days ago to 90 days ahead
  const now = new Date();
  const defStart = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
  const defEnd = new Date(now.getTime() + 90 * 86400000).toISOString().slice(0, 10);
  const winStart = windowStartIso || defStart;
  const winEnd = windowEndIso || defEnd;

  // Unfold wrapped lines in RFC 5545 (lines beginning with space or tab)
  const unfolded = icsContent.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  const events: ParsedCalendarEvent[] = [];
  const recurringEvents: Array<{ base: ParsedCalendarEvent; rrule: string }> = [];
  let currentEvent: Record<string, string> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'BEGIN:VEVENT') {
      currentEvent = {};
      continue;
    }

    if (trimmed === 'END:VEVENT') {
      if (currentEvent && currentEvent.SUMMARY) {
        const startRaw = currentEvent.DTSTART || '';
        const endRaw = currentEvent.DTEND || startRaw;

        const startParsed = parseIcalDate(startRaw, tz);
        const endParsed = parseIcalDate(endRaw, tz);

        const summary = currentEvent.SUMMARY.replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/gi, '\n');
        const desc = (currentEvent.DESCRIPTION || '').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/gi, '\n');
        const loc = (currentEvent.LOCATION || '').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/gi, '\n');

        const { emoji, color } = detectEventEmoji(summary, loc);
        const timeDisplay = formatTimeDisplay(startParsed.time, endParsed.time, startParsed.allDay);

        const eventItem: ParsedCalendarEvent = {
          id: currentEvent.UID || `cal_${Math.random().toString(36).slice(2, 9)}`,
          summary,
          description: desc,
          location: loc,
          start_date_iso: startParsed.dateIso,
          end_date_iso: endParsed.dateIso,
          start_time: startParsed.time,
          end_time: endParsed.time,
          time_display: timeDisplay,
          start_time_sort: startParsed.time || '00:00',
          all_day: startParsed.allDay,
          color,
          emoji,
        };

        if (eventItem.start_date_iso >= winStart && eventItem.start_date_iso <= winEnd) {
          events.push(eventItem);
        }

        if (currentEvent.RRULE) {
          recurringEvents.push({ base: eventItem, rrule: currentEvent.RRULE });
        }
      }
      currentEvent = null;
      continue;
    }

    if (currentEvent) {
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx > 0) {
        let propName = trimmed.slice(0, colonIdx).toUpperCase();
        const propVal = trimmed.slice(colonIdx + 1);

        // Strip parameters like DTSTART;TZID=... -> DTSTART
        if (propName.includes(';')) {
          propName = propName.split(';')[0];
        }
        currentEvent[propName] = propVal;
      }
    }
  }

  // Expand recurring events
  for (const rec of recurringEvents) {
    const expanded = expandRecurrences(rec.base, rec.rrule, winStart, winEnd);
    events.push(...expanded);
  }

  // Deduplicate by ID
  const seenIds = new Set<string>();
  const deduped: ParsedCalendarEvent[] = [];
  for (const ev of events) {
    if (!seenIds.has(ev.id)) {
      seenIds.add(ev.id);
      deduped.push(ev);
    }
  }

  // Sort events chronologically
  deduped.sort((a, b) => {
    if (a.start_date_iso !== b.start_date_iso) {
      return a.start_date_iso.localeCompare(b.start_date_iso);
    }
    if (a.all_day !== b.all_day) {
      return a.all_day ? -1 : 1;
    }
    return a.start_time_sort.localeCompare(b.start_time_sort);
  });

  return deduped;
}
