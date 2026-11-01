import {
  boolean,
  bigint,
  date,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * Postgres schema (Drizzle), ported 1:1 from the SQLite schema captured out of the
 * live database (`instance/schema-snapshot.json`).
 *
 * Mapping: INTEGER PK AUTOINCREMENT -> identity (BY DEFAULT, so the importer can keep
 * ids) · BOOLEAN(0/1) -> boolean · DATETIME -> timestamp(string) · DATE -> date(string)
 * · FLOAT -> double precision · VARCHAR(n) -> varchar(n) · TEXT -> text.
 */

export const activityLog = pgTable(
  'activity_log',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    date: timestamp('date', { mode: 'string' }),
    type: varchar('type', { length: 255 }),
    description: text('description'),
    userName: varchar('user_name', { length: 255 }),
    createdAt: timestamp('created_at', { mode: 'string' }),
    updatedAt: timestamp('updated_at', { mode: 'string' }),
  },
  (t) => ({ dateIdx: index('idx_activity_log_date').on(t.date) })
);

export const appSettings = pgTable(
  'app_settings',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    key: varchar('key', { length: 255 }).notNull(),
    value: text('value').notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }),
    updatedAt: timestamp('updated_at', { mode: 'string' }),
  },
  (t) => ({ keyIdx: uniqueIndex('uq_app_settings_key').on(t.key) })
);

export const appliedMutation = pgTable('applied_mutation', {
  mutationId: text('mutation_id').primaryKey(),
  endpoint: text('endpoint'),
  appliedAt: timestamp('applied_at', { mode: 'string' }).defaultNow(),
});

export const person = pgTable('person', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  name: varchar('name', { length: 255 }).notNull(),
  points: doublePrecision('points').default(0),
  bonusPoints: doublePrecision('bonus_points').default(0),
  lastReset: timestamp('last_reset', { mode: 'string' }),
  lastBonusAwarded: timestamp('last_bonus_awarded', { mode: 'string' }),
  lastDailyChoresAdded: timestamp('last_daily_chores_added', { mode: 'string' }),
  avatar: varchar('avatar', { length: 255 }).default('default_avatar.png'),
  color: varchar('color', { length: 7 }).default('#ffffff'),
  order: integer('order').default(0),
  pin: varchar('pin', { length: 100 }),
  isAdmin: boolean('is_admin').default(false),
  age: integer('age'),
  role: varchar('role', { length: 20 }),
  calendarIcalUrl: text('calendar_ical_url'),
  dob: date('dob', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }),
  updatedAt: timestamp('updated_at', { mode: 'string' }),
});

export const chore = pgTable(
  'chore',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    title: varchar('title', { length: 255 }).notNull(),
    assignedToId: integer('assigned_to_id').references(() => person.id),
    assignedTo: varchar('assigned_to', { length: 255 }),
    points: doublePrecision('points').default(1),
    completed: boolean('completed').default(false),
    dateCompleted: timestamp('date_completed', { mode: 'string' }),
    isDaily: boolean('is_daily').default(false),
    daysOfWeek: varchar('days_of_week', { length: 255 }),
    dueDate: date('due_date', { mode: 'string' }),
    dueDatetime: timestamp('due_datetime', { mode: 'string' }),
    deleted: boolean('deleted').default(false),
    icon: varchar('icon', { length: 20 }),
    isExtra: boolean('is_extra').default(false),
    extraId: varchar('extra_id', { length: 255 }),
    imageUrl: text('image_url'),
    durationSeconds: integer('duration_seconds'),
    description: text('description'),
    createdAt: timestamp('created_at', { mode: 'string' }),
    updatedAt: timestamp('updated_at', { mode: 'string' }),
  },
  (t) => ({ assigneeIdx: index('idx_chore_assigned_to').on(t.assignedToId) })
);

export const choreLog = pgTable(
  'chore_log',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    choreId: integer('chore_id').references(() => chore.id),
    choreTitle: varchar('chore_title', { length: 255 }).notNull(),
    personId: integer('person_id').references(() => person.id),
    personName: varchar('person_name', { length: 255 }).notNull(),
    completedById: integer('completed_by_id').references(() => person.id),
    completedByName: varchar('completed_by_name', { length: 255 }).notNull(),
    pointsAwarded: doublePrecision('points_awarded').default(1).notNull(),
    forDate: date('for_date', { mode: 'string' }).notNull(),
    completedAt: timestamp('completed_at', { mode: 'string' }).defaultNow().notNull(),
    targetSeconds: integer('target_seconds'),
    actualSeconds: integer('actual_seconds').default(0),
    secondsSaved: integer('seconds_saved').default(0),
    timerStatus: varchar('timer_status', { length: 30 }).default('untimed'),
    wasOverdue: boolean('was_overdue').default(false),
    notes: text('notes'),
    createdAt: timestamp('created_at', { mode: 'string' }),
    updatedAt: timestamp('updated_at', { mode: 'string' }),
  },
  (t) => ({
    choreIdx: index('idx_chore_log_chore_id').on(t.choreId),
    dateIdx: index('idx_chore_log_for_date').on(t.forDate),
    personIdx: index('idx_chore_log_person_id').on(t.personId),
  })
);

export const reward = pgTable('reward', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  title: varchar('title', { length: 255 }).notNull(),
  pointsRequired: doublePrecision('points_required').default(1),
  imageUrl: text('image_url'),
  description: text('description'),
  assignedToId: integer('assigned_to_id').references(() => person.id),
  assignedTo: varchar('assigned_to', { length: 255 }),
  completed: boolean('completed').default(false),
  dateCompleted: timestamp('date_completed', { mode: 'string' }),
  isRecurring: boolean('is_recurring').default(false),
  sourceUrl: text('source_url'),
  sourceName: varchar('source_name', { length: 255 }),
  createdAt: timestamp('created_at', { mode: 'string' }),
  updatedAt: timestamp('updated_at', { mode: 'string' }),
  lastSyncedAt: timestamp('last_synced_at', { mode: 'string' }),
  syncErrorCount: integer('sync_error_count').default(0),
});

export const seasons = pgTable(
  'seasons',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    key: varchar('key', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    enabled: integer('enabled').default(1).notNull(),
    startMd: varchar('start_md', { length: 5 }).notNull(),
    endMd: varchar('end_md', { length: 5 }).notNull(),
    emoji: varchar('emoji', { length: 16 }).default('').notNull(),
    accent: varchar('accent', { length: 16 }).default('').notNull(),
    soundKey: varchar('sound_key', { length: 255 }),
    createdAt: timestamp('created_at', { mode: 'string' }),
    updatedAt: timestamp('updated_at', { mode: 'string' }),
  },
  (t) => ({ keyIdx: uniqueIndex('uq_seasons_key').on(t.key) })
);

export const seasonalEvents = pgTable(
  'seasonal_events',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    key: varchar('key', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    enabled: integer('enabled').default(1).notNull(),
    ruleType: varchar('rule_type', { length: 16 }).default('fixed').notNull(),
    monthDay: varchar('month_day', { length: 5 }),
    daysBefore: integer('days_before').default(3).notNull(),
    daysAfter: integer('days_after').default(3).notNull(),
    emoji: varchar('emoji', { length: 16 }).default('').notNull(),
    accent: varchar('accent', { length: 16 }).default('').notNull(),
    soundKey: varchar('sound_key', { length: 255 }),
    createdAt: timestamp('created_at', { mode: 'string' }),
    updatedAt: timestamp('updated_at', { mode: 'string' }),
  },
  (t) => ({ keyIdx: uniqueIndex('uq_seasonal_events_key').on(t.key) })
);

export const personStreak = pgTable('person_streak', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  personId: integer('person_id').references(() => person.id).notNull(),
  currentStreak: integer('current_streak').default(0),
  longestStreak: integer('longest_streak').default(0),
  lastCompletedDate: date('last_completed_date', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }),
  updatedAt: timestamp('updated_at', { mode: 'string' }),
});

export const personBadge = pgTable('person_badge', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  personId: integer('person_id').references(() => person.id).notNull(),
  badgeKey: varchar('badge_key', { length: 255 }).notNull(),
  earnedAt: timestamp('earned_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }),
  updatedAt: timestamp('updated_at', { mode: 'string' }),
});

export const organiseItem = pgTable('organise_item', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  category: varchar('category', { length: 255 }),
  title: varchar('title', { length: 255 }),
  provider: varchar('provider', { length: 255 }),
  notes: text('notes'),
  dueDate: date('due_date', { mode: 'string' }),
  lastDate: date('last_date', { mode: 'string' }),
  paid: boolean('paid').default(false),
  cost: doublePrecision('cost'),
  reminderDays: integer('reminder_days'),
  icon: varchar('icon', { length: 20 }),
  sortOrder: integer('sort_order'),
  photoFilename: varchar('photo_filename', { length: 255 }),
  vehicleMake: varchar('vehicle_make', { length: 255 }),
  vehicleModel: varchar('vehicle_model', { length: 255 }),
  vehicleYear: integer('vehicle_year'),
  vehicleRego: varchar('vehicle_rego', { length: 255 }),
  currentOdometer: integer('current_odometer'),
  nextServiceDate: date('next_service_date', { mode: 'string' }),
  nextServiceMileage: integer('next_service_mileage'),
  parentId: integer('parent_id'),
  createdAt: timestamp('created_at', { mode: 'string' }),
  updatedAt: timestamp('updated_at', { mode: 'string' }),
});

export const vehicleService = pgTable('vehicle_service', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  organiseItemId: integer('organise_item_id').references(() => organiseItem.id),
  serviceType: varchar('service_type', { length: 255 }),
  serviceDate: date('service_date', { mode: 'string' }),
  nextServiceDate: date('next_service_date', { mode: 'string' }),
  nextServiceMileage: integer('next_service_mileage'),
  mileage: integer('mileage'),
  cost: doublePrecision('cost'),
  provider: varchar('provider', { length: 255 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { mode: 'string' }),
  updatedAt: timestamp('updated_at', { mode: 'string' }),
});

export const shoppingCatalog = pgTable(
  'shopping_catalog',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    name: varchar('name', { length: 255 }).notNull(),
    normalizedKey: varchar('normalized_key', { length: 255 }),
    defaultStore: varchar('default_store', { length: 255 }),
    timesAdded: integer('times_added').default(0),
    timesPurchased: integer('times_purchased').default(0),
    lastAddedAt: timestamp('last_added_at', { mode: 'string' }),
    lastPurchasedAt: timestamp('last_purchased_at', { mode: 'string' }),
    avgIntervalDays: doublePrecision('avg_interval_days'),
    createdAt: timestamp('created_at', { mode: 'string' }),
    updatedAt: timestamp('updated_at', { mode: 'string' }),
  },
  (t) => ({ keyIdx: index('idx_shopping_catalog_normalized').on(t.normalizedKey) })
);

export const shoppingPurchaseLog = pgTable('shopping_purchase_log', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  catalogId: integer('catalog_id').references(() => shoppingCatalog.id),
  purchasedAt: timestamp('purchased_at', { mode: 'string' }),
  store: varchar('store', { length: 255 }),
  qty: varchar('qty', { length: 255 }),
  createdAt: timestamp('created_at', { mode: 'string' }),
  updatedAt: timestamp('updated_at', { mode: 'string' }),
});

export const recipes = pgTable(
  'recipes',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    mealKey: varchar('meal_key', { length: 255 }),
    title: varchar('title', { length: 255 }),
    imageUrl: text('image_url'),
    ingredientsJson: text('ingredients_json'),
    instructions: text('instructions'),
    servings: varchar('servings', { length: 255 }),
    prepTime: varchar('prep_time', { length: 255 }),
    notionId: varchar('notion_id', { length: 255 }),
    createdAt: timestamp('created_at', { mode: 'string' }),
    updatedAt: timestamp('updated_at', { mode: 'string' }),
  },
  (t) => ({ keyIdx: uniqueIndex('uq_recipes_meal_key').on(t.mealKey) })
);

export const notifications = pgTable(
  'notifications',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    dedupeKey: varchar('dedupe_key', { length: 255 }).notNull(),
    kind: varchar('kind', { length: 255 }).notNull(),
    severity: varchar('severity', { length: 16 }).default('due_soon').notNull(),
    days: integer('days').default(0).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    detail: text('detail').default('').notNull(),
    target: varchar('target', { length: 255 }).default('kanban').notNull(),
    adminOnly: boolean('admin_only').default(false).notNull(),
    readAt: timestamp('read_at', { mode: 'string' }),
    dismissedAt: timestamp('dismissed_at', { mode: 'string' }),
    createdAt: timestamp('created_at', { mode: 'string' }),
    updatedAt: timestamp('updated_at', { mode: 'string' }),
  },
  (t) => ({ dedupeIdx: uniqueIndex('uq_notifications_dedupe').on(t.dedupeKey) })
);

/** express-session store (connect-pg-simple compatible). */
export const session = pgTable(
  'session',
  {
    sid: varchar('sid', { length: 255 }).primaryKey(),
    sess: text('sess').notNull(),
    expire: timestamp('expire', { withTimezone: false }).notNull(),
  },
  (t) => ({ expireIdx: index('idx_session_expire').on(t.expire) })
);



