export type UserRole = 'parent' | 'child' | 'family';

export interface BadgeItem {
  key: string;
  emoji: string;
  name: string;
  desc: string;
  earned?: boolean;
  earned_date?: string | null;
}

export interface PersonStreak {
  current_streak: number;
  longest_streak: number;
  last_completed_date: string | null;
}

export interface Person {
  id: number;
  name: string;
  points: number;
  bonus_points: number;
  avatar: string;
  color: string;
  order: number;
  is_admin: boolean;
  role?: UserRole;
  has_pin?: boolean;
  age: number | null;
  dob?: string | null;
  birthday_info?: {
    dob: string;
    birthdayDisplay: string;
    daysUntil: number;
    isToday: boolean;
  } | null;
  calendar_ical_url?: string | null;
  streak: PersonStreak;
  badges: BadgeItem[];
  total_completed: number;
}

export interface HouseholdGroup {
  id: 'everyone' | 'kids' | 'parents';
  name: string;
  label: string;
  emoji: string;
  member_ids: number[];
  color: string;
}
