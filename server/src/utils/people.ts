export interface BirthdayInfo {
  dob: string;
  birthdayDisplay: string;
  daysUntil: number;
  isToday: boolean;
}

export function calculateAge(dobIso?: string | null, fallbackAge?: number | null): number | null {
  if (!dobIso) return fallbackAge !== undefined && fallbackAge !== null ? Number(fallbackAge) : null;
  const match = String(dobIso).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return fallbackAge !== undefined && fallbackAge !== null ? Number(fallbackAge) : null;

  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  const d = Number(match[3]);

  const now = new Date();
  let age = now.getFullYear() - y;
  const curMonth = now.getMonth();
  const curDate = now.getDate();

  if (curMonth < m || (curMonth === m && curDate < d)) {
    age--;
  }
  return Math.max(0, age);
}

export function getBirthdayInfo(dobIso?: string | null): BirthdayInfo | null {
  if (!dobIso) return null;
  const match = String(dobIso).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const m = Number(match[2]) - 1;
  const d = Number(match[3]);

  const now = new Date();
  const currentYear = now.getFullYear();

  let nextBday = new Date(currentYear, m, d);
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (nextBday.getTime() < todayMidnight.getTime()) {
    nextBday = new Date(currentYear + 1, m, d);
  }

  const diffMs = nextBday.getTime() - todayMidnight.getTime();
  const daysUntil = Math.round(diffMs / (1000 * 60 * 60 * 24));

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return {
    dob: match[0],
    birthdayDisplay: `${d} ${monthNames[m]}`,
    daysUntil,
    isToday: daysUntil === 0,
  };
}

export interface HouseholdGroup {
  id: 'everyone' | 'kids' | 'parents';
  name: string;
  label: string;
  emoji: string;
  member_ids: number[];
  color: string;
}

export function buildHouseholdGroups(realPeople: Array<{ id: number; name: string; role?: string }>): HouseholdGroup[] {
  const kidIds = realPeople.filter((p) => p.role === 'child').map((p) => p.id);
  const parentIds = realPeople.filter((p) => p.role === 'parent').map((p) => p.id);
  const allIds = realPeople.map((p) => p.id);

  return [
    {
      id: 'everyone',
      name: 'Everyone',
      label: 'Everyone / All',
      emoji: '🏠',
      member_ids: allIds,
      color: '#eab308',
    },
    {
      id: 'kids',
      name: 'Kids',
      label: 'All Kids',
      emoji: '👧',
      member_ids: kidIds,
      color: '#38bdf8',
    },
    {
      id: 'parents',
      name: 'Parents',
      label: 'Parents / Adults',
      emoji: '👩‍👧',
      member_ids: parentIds,
      color: '#a855f7',
    },
  ];
}
