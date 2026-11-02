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
  /** Claimed/redeemed into the redeemed pool. */
  redeemed?: boolean;
  /** Retired by a parent; hidden from the available grid but kept for history. */
  archived?: boolean;
  is_hidden?: boolean;
  is_recurring?: boolean;
  source_url?: string | null;
  source_name?: string | null;
  last_synced_at?: string | null;
  sync_error_count?: number;
}
