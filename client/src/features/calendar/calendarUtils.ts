import { CalendarEvent } from '../../types';

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const DAY_NAMES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export interface CalendarCell {
  dateIso: string;
  dayNum: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}

export function buildCalendarCells(
  currentYear: number,
  currentMonth: number,
  events: CalendarEvent[],
  localToday: string
): CalendarCell[] {
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const mondayOffset = (firstDay + 6) % 7;
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

  const calendarCells: CalendarCell[] = [];

  // Previous month trailing days
  for (let i = mondayOffset - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const prevMonthIdx = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const mStr = String(prevMonthIdx + 1).padStart(2, '0');
    const dStr = String(dayNum).padStart(2, '0');
    const dateIso = `${prevYear}-${mStr}-${dStr}`;
    calendarCells.push({
      dateIso,
      dayNum,
      isCurrentMonth: false,
      isToday: dateIso === localToday,
      events: events.filter((e) => e.start_date_iso === dateIso),
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const mStr = String(currentMonth + 1).padStart(2, '0');
    const dStr = String(d).padStart(2, '0');
    const dateIso = `${currentYear}-${mStr}-${dStr}`;
    calendarCells.push({
      dateIso,
      dayNum: d,
      isCurrentMonth: true,
      isToday: dateIso === localToday,
      events: events.filter((e) => e.start_date_iso === dateIso),
    });
  }

  // Next month leading days to complete grid (up to 35 or 42 cells)
  const totalCellsNeeded = calendarCells.length > 35 ? 42 : 35;
  const remaining = totalCellsNeeded - calendarCells.length;
  for (let d = 1; d <= remaining; d++) {
    const nextMonthIdx = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    const mStr = String(nextMonthIdx + 1).padStart(2, '0');
    const dStr = String(d).padStart(2, '0');
    const dateIso = `${nextYear}-${mStr}-${dStr}`;
    calendarCells.push({
      dateIso,
      dayNum: d,
      isCurrentMonth: false,
      isToday: dateIso === localToday,
      events: events.filter((e) => e.start_date_iso === dateIso),
    });
  }

  return calendarCells;
}

export function buildScheduleGroups(
  events: CalendarEvent[],
  localToday: string
): { scheduleEvents: CalendarEvent[]; scheduleGroups: Record<string, CalendarEvent[]> } {
  const scheduleEvents = [...events]
    .filter((e) => e.start_date_iso >= localToday)
    .sort((a, b) => {
      if (a.start_date_iso !== b.start_date_iso) return a.start_date_iso.localeCompare(b.start_date_iso);
      if (a.all_day !== b.all_day) return a.all_day ? -1 : 1;
      return (a.start_time_sort || '00:00').localeCompare(b.start_time_sort || '00:00');
    });

  const scheduleGroups: Record<string, CalendarEvent[]> = {};
  for (const ev of scheduleEvents) {
    if (!scheduleGroups[ev.start_date_iso]) scheduleGroups[ev.start_date_iso] = [];
    scheduleGroups[ev.start_date_iso].push(ev);
  }

  return { scheduleEvents, scheduleGroups };
}
