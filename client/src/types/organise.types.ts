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
