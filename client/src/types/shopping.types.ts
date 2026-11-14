export interface ShoppingStore {
  id: string;
  name: string;
  icon: string;
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
  days_since_last?: number | null;
  reason?: string;
  is_active?: boolean;
  is_due?: boolean;
  is_staple?: boolean;
  cycle_percent?: number | null;
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
