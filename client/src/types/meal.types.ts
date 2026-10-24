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
