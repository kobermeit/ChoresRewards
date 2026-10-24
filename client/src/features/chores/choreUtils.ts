export const CHORE_EMOJI_OPTIONS = [
  '', '✅', '🍽️', '🧺', '🗑️', '🧹', '🚿', '🦷', '👕', '🌱', '🍳', '🥗',
  '🎵', '📖', '🎓', '🎒', '🐶', '🐱', '🦮', '🐾', '💧', '💊', '📦', '🧽',
  '🛏️', '🚗', '🛒', '🎮', '📱', '🖥️', '😴', '🏋️', '⭐', '🔥', '🌟',
  '🧼', '🪣', '🪥', '🧻', '🛋️', '🪟', '🧴', '🧦', '👟', '🪴', '🌻',
  '🔨', '🔧', '🪛', '✂️', '🍲', '🍞', '🍎', '🥛', '☕', '🍕', '🦴',
  '🐟', '🦜', '🐹', '✏️', '📝', '🎨', '🧘', '🛁', '🏃', '🚲', '⚽',
  '🏀', '✉️', '📬', '🛍️', '💵', '📅', '🏆', '🥇', '🎯', '🎉', '⏰',
  '☀️', '🌙', '🧸', '🔒',
];

export const INITIAL_CHORE_SUGGESTIONS = [
  'Clean Room', 'Clean Desk', 'Pack Lunch', 'Clean Playroom',
  'Pack Water Bottle', 'Brush Teeth', 'Unstack Dishwasher',
  'Put Away Laundry', 'Do a workout', 'Take Dog For A Walk',
  'Reading', 'Go to Sleep without meltdown',
];

export const BODY_CHALLENGES = [
  'Do 10 star jumps!',
  'Hop on one foot 10 times!',
  'Do 5 push-ups or wall push-ups!',
  'Hold a plank or superhero pose for 15 seconds!',
  'Touch your toes 10 times!',
  'Do a 15-second happy victory dance!',
  'Balance on one leg with your eyes closed for 10 seconds!',
];

export function detectChoreIcon(title: string, customIcon?: string | null): string {
  if (customIcon && customIcon.trim()) return customIcon.trim();
  const t = (title || '').toLowerCase();
  if (t.includes('tooth') || t.includes('teeth') || t.includes('dental') || t.includes('brush')) return '🦷';
  if (t.includes('dishwasher') || t.includes('dishes') || t.includes('dish')) return '🍽️';
  if (t.includes('laundry') || t.includes('washing') || t.includes('fold') || t.includes('iron') || t.includes('clothes')) return '👕';
  if (t.includes('lawn') || t.includes('mow') || t.includes('grass') || t.includes('garden') || t.includes('weed') || t.includes('yard') || t.includes('plant')) return '🌱';
  if (t.includes('rubbish') || t.includes('garbage') || t.includes('recycl') || t.includes('bins') || t.includes('bin') || t.includes('trash')) return '🗑️';
  if (t.includes('workout') || t.includes('exercise') || t.includes('gym') || t.includes('fitness') || t.includes('sport')) return '🏋️';
  if (t.includes('shop') || t.includes('grocery') || t.includes('groceries') || t.includes('market') || t.includes('supermarket')) return '🛒';
  if (t.includes('cook') || t.includes('bake') || t.includes('dinner')) return '🍳';
  if (t.includes('bath') || t.includes('shower')) return '🚿';
  if (t.includes('vacuum') || t.includes('hoover') || t.includes('sweep') || t.includes('mop')) return '🧹';
  if (t.includes('music') || t.includes('piano') || t.includes('guitar') || t.includes('violin') || t.includes('instrument') || t.includes('practis') || t.includes('practice')) return '🎵';
  if (t.includes('cat')) return '🐱';
  if (t.includes('fish')) return '🐟';
  if (t.includes('bird')) return '🐦';
  if (t.includes('hamster') || t.includes('rabbit')) return '🐹';
  if (t.includes('feed') || t.includes('animal')) return '🐾';
  if (t.includes('medicine') || t.includes('pill') || t.includes('vitamin')) return '💊';
  if (t.includes('dog') || t.includes('sam')) return '🐶';
  if (t.includes('walk')) return '🦮';
  if (t.includes('sleep') || t.includes('meltdown') || t.includes('night')) return '😴';
  if (t.includes('lunch') || t.includes('breakfast') || t.includes('snack') || t.includes('meal') || t.includes('eat') || t.includes('food')) return '🥗';
  if (t.includes('pack')) return '🎒';
  if (t.includes('water') || t.includes('drink') || t.includes('bottle')) return '💧';
  if (t.includes('read') || t.includes('book')) return '📖';
  if (t.includes('homework') || t.includes('school') || t.includes('learn') || t.includes('study')) return '🎓';
  if (t.includes('tidy') || t.includes('organis') || t.includes('organiz')) return '📦';
  if (t.includes('wipe') || t.includes('clean') || t.includes('sort')) return '🧽';
  if (t.includes('playroom') || t.includes('play') || t.includes('game') || t.includes('toy')) return '🎮';
  if (t.includes('desk')) return '🖥️';
  if (t.includes('bedroom') || t.includes('room') || t.includes('bed')) return '🛏️';
  if (t.includes('car') || t.includes('drive')) return '🚗';
  if (t.includes('screen') || t.includes('ipad') || t.includes('computer') || t.includes('phone') || t.includes('tv')) return '📱';
  return '✅';
}

export function formatDaysTag(daysOfWeek: string | string[] | null | undefined, isDaily?: boolean): string | null {
  const raw = Array.isArray(daysOfWeek) ? daysOfWeek : daysOfWeek ? String(daysOfWeek).split(',') : [];
  const shortDays = raw.map((d) => d.trim().toLowerCase()).filter(Boolean);

  if (shortDays.length === 0) {
    return isDaily ? 'Every day' : null;
  }
  if (shortDays.length >= 7) {
    return 'Every day';
  }
  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  const weekends = ['saturday', 'sunday'];
  const sorted = [...shortDays].sort();
  if (sorted.length === 5 && sorted.every((d, i) => d === [...weekdays].sort()[i])) {
    return 'Mon – Fri';
  }
  if (sorted.length === 2 && sorted.every((d, i) => d === [...weekends].sort()[i])) {
    return 'Weekends';
  }
  const mapDay: Record<string, string> = {
    monday: 'Mon',
    tuesday: 'Tue',
    wednesday: 'Wed',
    thursday: 'Thu',
    friday: 'Fri',
    saturday: 'Sat',
    sunday: 'Sun',
  };
  return shortDays.map((d) => mapDay[d] || d.charAt(0).toUpperCase() + d.slice(1, 3)).join(', ');
}

export function formatPoints(pts: number | string, isCashMode = false): string {
  const n = Number(pts) || 0;
  if (isCashMode) return `$${n.toFixed(2)}`;
  return n % 1 === 0 ? `${n.toFixed(0)}` : `${n.toFixed(1)}`;
}

export function isChoreScheduledForDate(
  chore: { is_daily?: boolean | number; days_of_week?: string | string[] | null },
  dateIso?: string
): boolean {
  if (!chore.is_daily) return true;
  const raw = Array.isArray(chore.days_of_week)
    ? chore.days_of_week
    : chore.days_of_week
    ? String(chore.days_of_week).split(',')
    : [];
  const scheduled = raw.map((d) => d.trim().toLowerCase()).filter(Boolean);
  if (scheduled.length === 0 || scheduled.length >= 7) return true;

  const targetDate = dateIso && /^\d{4}-\d{2}-\d{2}$/.test(dateIso)
    ? new Date(dateIso + 'T12:00:00')
    : new Date();
  const dayIndex = targetDate.getDay(); // 0=Sun, 1=Mon...
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayShorts = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const currentLong = dayNames[dayIndex];
  const currentShort = dayShorts[dayIndex];

  return scheduled.some((d) => d === currentLong || d === currentShort);
}
