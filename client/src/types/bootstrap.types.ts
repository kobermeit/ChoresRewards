import { Person, BadgeItem, PersonStreak, HouseholdGroup } from './user.types';
import { Chore, ExtraChore } from './chore.types';
import { Reward } from './reward.types';
import { MealDayInfo, MealIngredient, RecipeItem } from './meal.types';
import { ShoppingStore, ShoppingCatalogItem, ShoppingPurchaseLogItem } from './shopping.types';
import { NoteColumn, KanbanNote, TextPad, DashboardStickyNote } from './notes.types';
import { CalendarEvent } from './calendar.types';

export interface BootstrapData {
  success: boolean;
  app_version?: string;
  needs_setup: boolean;
  current_date: string;
  timezone: string;
  reward_system: 'points' | 'cash';
  point_value?: number;
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
  kiosk?: Person | null;
  groups?: HouseholdGroup[];
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
  recipes?: RecipeItem[];
  recipe_map?: Record<string, RecipeItem>;
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
