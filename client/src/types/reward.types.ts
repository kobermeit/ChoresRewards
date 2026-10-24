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
