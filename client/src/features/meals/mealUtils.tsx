import React from 'react';
import { resolveAssetUrl } from '../../api';

export const MEAL_KEYS: Array<'breakfast' | 'lunch' | 'dinner'> = ['breakfast', 'lunch', 'dinner'];

export const MEAL_EMOJI_MAP: Record<string, string> = {
  lunch: '🍱',
  lunchbox: '🍱',
  takeout: '🛵',
  'take out': '🛵',
  delivery: '🛵',
  ordered: '🛵',
  'rice paper rolls': '🥟',
  'spring rolls': '🥟',
  pho: '🍜',
  ramen: '🍜',
  udon: '🍜',
  noodles: '🍝',
  'pad thai': '🍝',
  'fried rice': '🍚',
  rice: '🍚',
  dumpling: '🥟',
  gyoza: '🥟',
  sushi: '🍣',
  curry: '🍛',
  teriyaki: '🍗',
  katsu: '🍗',
  taco: '🌮',
  tacos: '🌮',
  burrito: '🌯',
  quesadilla: '🧀',
  nachos: '🧀',
  salad: '🥗',
  pizza: '🍕',
  pasta: '🍝',
  spaghetti: '🍝',
  lasagna: '🍝',
  lasanga: '🍝',
  risotto: '🍚',
  kebab: '🍗',
  schnitzel: '🍗',
  stew: '🍲',
  stroganoff: '🍝',
  burger: '🍔',
  'hot dog': '🌭',
  bbq: '🍖',
  'mac and cheese': '🧀',
  wings: '🍗',
  salmon: '🐟',
  fish: '🐟',
  prawn: '🍤',
  broccoli: '🥦',
  potato: '🥔',
  fries: '🍟',
  eggs: '🥚',
  bacon: '🥓',
  sausage: '🌭',
  pancake: '🥞',
  waffle: '🧇',
  cereal: '🥣',
  toast: '🍞',
  sandwich: '🥪',
  wrap: '🌯',
  soup: '🍲',
  chicken: '🍗',
  beef: '🍖',
  pork: '🍖',
  lamb: '🐑',
  steak: '🥩',
};

export function getMealEmoji(name: string): string {
  if (!name) return '🍽️';
  const n = name.toLowerCase().trim();
  if (MEAL_EMOJI_MAP[n]) return MEAL_EMOJI_MAP[n];
  for (const [k, v] of Object.entries(MEAL_EMOJI_MAP)) {
    if (n.includes(k)) return v;
  }
  return '🍽️';
}

export function formatWeekRangeLabel(weekStartIso: string, weeksCount: number = 1): string {
  if (!weekStartIso) return '';
  try {
    const start = new Date(`${weekStartIso}T00:00:00`);
    const end = new Date(start);
    end.setDate(start.getDate() + (weeksCount * 7 - 1));
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const showYear = start.getFullYear() !== now.getFullYear() || end.getFullYear() !== now.getFullYear();
    const yearStr = showYear ? ` ${end.getFullYear()}` : '';
    return `${start.getDate()} ${months[start.getMonth()]} – ${end.getDate()} ${months[end.getMonth()]}${yearStr}`;
  } catch {
    return weekStartIso;
  }
}

export function shiftWeekIso(weekStartIso: string, deltaDays: number): string {
  try {
    const d = new Date(`${weekStartIso}T00:00:00`);
    d.setDate(d.getDate() + deltaDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch {
    return weekStartIso;
  }
}

export interface DayInfo {
  date_iso: string;
  day_name: string;
  day_short: string;
  day_full: string;
  date_label: string;
  day_num: number;
  is_today: boolean;
}

export function computeWeekDays(weekStartIso: string): DayInfo[] {
  try {
    const days: DayInfo[] = [];
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dayShorts = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const start = new Date(`${weekStartIso}T00:00:00`);
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const iso = `${y}-${m}-${day}`;
      days.push({
        date_iso: iso,
        day_name: dayNames[i],
        day_short: dayShorts[i],
        day_full: dayNames[i],
        date_label: `${d.getDate()} ${months[d.getMonth()]}`,
        day_num: d.getDate(),
        is_today: iso === todayIso,
      });
    }
    return days;
  } catch {
    return [];
  }
}

export function renderStoreIcon(icon?: string): React.ReactNode {
  if (icon && (icon.startsWith('/') || icon.startsWith('./'))) {
    return (
      <img
        src={resolveAssetUrl(icon)}
        alt=""
        className="shopping-store-icon-img"
        draggable={false}
      />
    );
  }
  return <>{icon || '🛒'}</>;
}
