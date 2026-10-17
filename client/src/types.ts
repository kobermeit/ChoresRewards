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

export type UserRole = 'parent' | 'child' | 'family';

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
  streak: PersonStreak;
  badges: BadgeItem[];
  total_completed: number;
}

export interface Chore {
  id: number;
  title: string;
  assigned_to_id: number | null;
  assigned_to: string;
  points: number;
  completed: boolean;
  date_completed: string | null;
  is_daily: boolean;
  days_of_week: string | null;
  due_date: string | null;
  due_datetime: string | null;
  deleted: boolean;
  icon: string | null;
  is_extra: boolean;
  extra_id: string | null;
  is_overdue?: boolean;
}

export interface Reward {
  id: number;
  title: string;
  points_required: number;
  image_url: string | null;
  description: string | null;
  assigned_to_id: number | null;
  assigned_to: string;
  completed: boolean;
  date_completed: string | null;
  is_recurring?: boolean;
}

export interface ExtraChore {
  id: string;
  title: string;
  points: number;
  min_age: number;
  max_age: number | null;
  icon: string;
  enabled: boolean;
  sort_order: number;
}

export interface MealDayInfo {
  date_iso: string;
  day_short: string;
  day_full: string;
  date_label: string;
}

export interface MealSlotMap {
  breakfast: string;
  lunch: string;
  dinner: string;
}

export interface MealIngredient {
  name: string;
  store: string;
  qty: string;
}

export interface ShoppingStore {
  id: string;
  name: string;
  icon: string;
}

export interface NoteColumn {
  id: string;
  title: string;
  color: string;
}

export interface KanbanNote {
  id: string;
  column_id: string;
  text: string;
  checked?: boolean;
  order?: number;
  deleted?: boolean;
  deleted_at?: string;
}

export interface TextPad {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

export interface DashboardStickyNote {
  id: string;
  title?: string;
  text: string;
  color: string;
  width?: number;
  height?: number;
  text_size?: 'sm' | 'md' | 'lg';
  pinned?: boolean;
}

export interface OrganiseItem {
  id: number;
  category: string;
  title: string;
  provider: string | null;
  notes: string | null;
  due_date: string | null;
  last_date: string | null;
  paid: boolean;
  cost: number | null;
  reminder_days: number;
  icon: string | null;
  sort_order: number;
  status: 'ok' | 'due_soon' | 'overdue';
  days_until_due: number | null;
  photo_url: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_year: number | null;
  vehicle_rego: string | null;
  current_odometer: number | null;
  next_service_date: string | null;
  next_service_mileage: number | null;
  parent_id: number | null;
}

export interface VehicleService {
  id: number;
  organise_item_id: number;
  service_type: string;
  service_date: string | null;
  next_service_date: string | null;
  next_service_mileage: number | null;
  mileage: number | null;
  cost: number | null;
  provider: string | null;
  notes: string | null;
}

export interface RecipeIngredient {
  name: string;
  store: string;
  qty: string;
  prep?: string;
  raw_name?: string;
}

export interface RecipeItem {
  id?: number;
  meal_key: string;
  title: string;
  image_url: string | null;
  ingredients: RecipeIngredient[];
  instructions: string;
  servings: string;
  prep_time: string;
  notion_id?: string | null;
}

export interface ShoppingCatalogItem {
  id: number;
  name: string;
  normalized_key: string;
  default_store: string;
  times_added: number;
  times_purchased: number;
  last_added_at: string | null;
  last_purchased_at: string | null;
  avg_interval_days: number | null;
  days_since_last?: number;
  reason?: string;
}

export interface ShoppingPurchaseLogItem {
  id: number;
  name: string;
  normalized_key: string;
  default_store: string;
  store: string;
  qty: string;
  purchased_at: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  summary: string;
  location?: string;
  description?: string;
  all_day: boolean;
  start_date_iso: string;
  end_date_iso?: string;
  weekday_short?: string;
  date_label?: string;
  time_display?: string;
  start_time_display?: string;
  end_time_display?: string;
  start_time_sort?: string;
  start_minutes?: number;
  duration_minutes?: number;
  color?: string;
  emoji?: string;
}

export interface BootstrapData {
  success: boolean;
  app_version?: string;
  needs_setup: boolean;
  current_date: string;
  timezone: string;
  reward_system: 'points' | 'cash';
  master_pin_set: boolean;
  auth: {
    authenticated: boolean;
    adult_mode: boolean;
    adult_name: string | null;
    person_id: number | null;
    person_name: string | null;
    active_user?: Person | null;
  };
  family: Person[];
  chores: Chore[];
  overdue_chore_ids: number[];
  rewards: Reward[];
  family_progress: Record<string, { completed: number; total: number }>;
  person_ages: Record<string, number>;
  person_streaks: Record<number, PersonStreak>;
  person_badges: Record<number, BadgeItem[]>;
  person_earned_keys: Record<string, string[]>;
  person_total_completed: Record<string, number>;
  badge_definitions: BadgeItem[];
  extra_chores: ExtraChore[];
  quiz_questions_enabled: boolean;
  quiz_questions: any[];
  meal_planner: {
    week_start: string;
    week_days: MealDayInfo[];
    plan: Record<string, any>;
    recurring: Record<string, Record<string, { enabled: boolean; value: string }>>;
    suggestions: string[];
    ingredients: Record<string, MealIngredient[]>;
    images: Record<string, string>;
    social: Record<string, { comments: Array<{ id: string; author: string; text: string; created_at: string }>; votes: Record<string, string> }>;
  };
  recipes?: Record<string, RecipeItem>;
  shopping: {
    checked: Record<string, boolean>;
    general: Array<{ id?: string; name: string; store: string; qty?: string; checked?: boolean }>;
    hidden: Record<string, boolean>;
    active: string[];
    meal_order: string[];
    archived: Array<{ name: string; store: string; qty?: string; purchased_at?: string }>;
    stores: ShoppingStore[];
    intelligence?: {
      catalog: ShoppingCatalogItem[];
      frequently_added: ShoppingCatalogItem[];
      suggested: ShoppingCatalogItem[];
      recently_purchased: ShoppingPurchaseLogItem[];
    };
  };
  notes_kanban: {
    columns: NoteColumn[];
    notes: KanbanNote[];
  };
  text_pads: TextPad[];
  dashboard_notes: DashboardStickyNote[];
  google_calendar: {
    feature_enabled: boolean;
    enabled: boolean;
    events: CalendarEvent[];
    today_events: CalendarEvent[];
    week_columns: any[];
    hour_labels: string[];
    embed_url?: string;
    ical_url?: string;
    last_sync?: string | null;
    error: string | null;
  };
  notion?: {
    configured: boolean;
    database_id: string;
    has_token: boolean;
  };
}
