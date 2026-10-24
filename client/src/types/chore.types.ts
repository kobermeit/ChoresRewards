export interface Chore {
  id: number;
  title: string;
  description?: string | null;
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
  image_url?: string | null;
  is_extra: boolean;
  extra_id: string | null;
  duration_seconds?: number | null;
  is_overdue?: boolean;
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
