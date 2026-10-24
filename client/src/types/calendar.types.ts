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
  person_id?: number | null;
  person_name?: string | null;
  person_avatar?: string | null;
  is_family?: boolean;
}
