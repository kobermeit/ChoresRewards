import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { apiGet, apiPost, resolveAssetUrl } from '../api';
import { MealIngredient, ShoppingStore } from '../types';

const MEAL_KEYS: Array<'breakfast' | 'lunch' | 'dinner'> = ['breakfast', 'lunch', 'dinner'];

const MEAL_EMOJI_MAP: Record<string, string> = {
  lunch: '🍱',
  lunchbox: '🍱',
  takeout: '🛵',
  'take out': '🛵',
  delivery: '🛵',
  ordered: '🛵',
  'rice paper rolls': '🥟',
  'spring rolls': '🥟',
  pho: '🍜',
  ramen: '🍜',
  udon: '🍜',
  noodles: '🍝',
  'pad thai': '🍝',
  'fried rice': '🍚',
  rice: '🍚',
  dumpling: '🥟',
  gyoza: '🥟',
  sushi: '🍣',
  curry: '🍛',
  teriyaki: '🍗',
  katsu: '🍗',
  taco: '🌮',
  tacos: '🌮',
  burrito: '🌯',
  quesadilla: '🧀',
  nachos: '🧀',
  salad: '🥗',
  pizza: '🍕',
  pasta: '🍝',
  spaghetti: '🍝',
  lasagna: '🍝',
  lasanga: '🍝',
  risotto: '🍚',
  kebab: '🍗',
  schnitzel: '🍗',
  stew: '🍲',
  stroganoff: '🍝',
  burger: '🍔',
  'hot dog': '🌭',
  bbq: '🍖',
  'mac and cheese': '🧀',
  wings: '🍗',
  salmon: '🐟',
  fish: '🐟',
  prawn: '🍤',
  broccoli: '🥦',
  potato: '🥔',
  fries: '🍟',
  eggs: '🥚',
  bacon: '🥓',
  sausage: '🌭',
  pancake: '🥞',
  waffle: '🧇',
  cereal: '🥣',
  toast: '🍞',
  sandwich: '🥪',
  wrap: '🌯',
  soup: '🍲',
  chicken: '🍗',
  beef: '🍖',
  pork: '🍖',
  lamb: '🐑',
  steak: '🥩',
};

function getMealEmoji(name: string): string {
  if (!name) return '🍽️';
  const n = name.toLowerCase().trim();
  if (MEAL_EMOJI_MAP[n]) return MEAL_EMOJI_MAP[n];
  for (const [k, v] of Object.entries(MEAL_EMOJI_MAP)) {
    if (n.includes(k)) return v;
  }
  return '🍽️';
}

function formatWeekRangeLabel(weekStartIso: string): string {
  if (!weekStartIso) return '';
  try {
    const start = new Date(`${weekStartIso}T00:00:00`);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${start.getDate()} ${months[start.getMonth()]} – ${end.getDate()} ${months[end.getMonth()]} ${end.getFullYear()}`;
  } catch {
    return weekStartIso;
  }
}

function shiftWeekIso(weekStartIso: string, deltaDays: number): string {
  try {
    const d = new Date(`${weekStartIso}T00:00:00`);
    d.setDate(d.getDate() + deltaDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch {
    return weekStartIso;
  }
}

function renderStoreIcon(icon?: string) {
  if (icon && (icon.startsWith('/') || icon.startsWith('./'))) {
    return (
      <img
        src={resolveAssetUrl(icon)}
        alt=""
        className="shopping-store-icon-img"
        draggable={false}
      />
    );
  }
  return <>{icon || '🛒'}</>;
}

export const MealAndShoppingSection: React.FC = () => {
  const { data, refresh, showToast } = useApp();

  // Accordion states matching original index.html
  const [plannerCollapsed, setPlannerCollapsed] = useState(false);
  const [suggestedMealsCollapsed, setSuggestedMealsCollapsed] = useState(true);
  const [shoppingCollapsed, setShoppingCollapsed] = useState(true);
  const [archivedCollapsed, setArchivedCollapsed] = useState(true);
  const [libraryCollapsed, setLibraryCollapsed] = useState(true);

  // Week navigation state
  const [activeWeekStart, setActiveWeekStart] = useState<string>('');
  const [weekDaysState, setWeekDaysState] = useState<any[]>([]);
  const [weekPlanState, setWeekPlanState] = useState<Record<string, any>>({});
  const [navLoading, setNavLoading] = useState(false);

  // Inline slot picker state
  const [openSlotKey, setOpenSlotKey] = useState<string | null>(null);
  const [pickerValue, setPickerValue] = useState('');
  const [pickerRecurring, setPickerRecurring] = useState(false);

  // Drag meal slot swap state
  const [draggedSlot, setDraggedSlot] = useState<{ dateIso: string; mealKey: 'breakfast' | 'lunch' | 'dinner' } | null>(
    null
  );

  // Suggested meals input
  const [newSuggestionText, setNewSuggestionText] = useState('');

  // Shopping quick-add state
  const [quickItemName, setQuickItemName] = useState('');
  const [quickItemStore, setQuickItemStore] = useState('');

  // Meal Library add ingredient state
  const [selectedMealKey, setSelectedMealKey] = useState('');
  const [newMealCustomName, setNewMealCustomName] = useState('');
  const [newIngName, setNewIngName] = useState('');
  const [newIngQty, setNewIngQty] = useState('');
  const [newIngStore, setNewIngStore] = useState('');
  const [cardQuickIngName, setCardQuickIngName] = useState<Record<string, string>>({});
  const [cardQuickIngQty, setCardQuickIngQty] = useState<Record<string, string>>({});
  const [cardQuickIngStore, setCardQuickIngStore] = useState<Record<string, string>>({});

  useEffect(() => {
    if (data?.meal_planner) {
      setActiveWeekStart(data.meal_planner.week_start);
      setWeekDaysState(data.meal_planner.week_days || []);
      setWeekPlanState(data.meal_planner.plan || {});
    }
  }, [data?.meal_planner]);

  if (!data) return null;

  const mp = data.meal_planner;
  const shop = data.shopping;
  const currentWeekStart = activeWeekStart || mp?.week_start || '';
  const isThisWeek = currentWeekStart === mp?.week_start;
  const weekDays = weekDaysState.length ? weekDaysState : mp?.week_days || [];
  const plan = Object.keys(weekPlanState).length ? weekPlanState : mp?.plan || {};
  const recurringMap = mp?.recurring || {};
  const suggestions = mp?.suggestions || [];
  const ingredientsMap = mp?.ingredients || {};
  const mealImages = mp?.images || {};
  const stores: ShoppingStore[] = shop?.stores?.length
    ? shop.stores
    : [
        { id: 'aldi', name: 'Aldi', icon: '/static/images/rewards/store_aldi.svg' },
        { id: 'woolworths', name: 'Woolworths', icon: '/static/images/rewards/store_woolworths.svg' },
      ];

  const handleNavigateWeek = async (deltaDays: number) => {
    const targetWeek = shiftWeekIso(currentWeekStart, deltaDays);
    setNavLoading(true);
    try {
      const res = await apiGet<{
        success: boolean;
        week_start: string;
        week_days: any[];
        plan: Record<string, any>;
      }>(`meal_planner?week=${encodeURIComponent(targetWeek)}`);
      if (res.success) {
        setActiveWeekStart(res.week_start);
        setWeekDaysState(res.week_days || []);
        setWeekPlanState(res.plan || {});
      }
    } catch {
      // ignore
    } finally {
      setNavLoading(false);
    }
  };

  const handleOpenPicker = (
    dateIso: string,
    mealKey: 'breakfast' | 'lunch' | 'dinner',
    weekdayLower: string
  ) => {
    const key = `${dateIso}::${mealKey}`;
    if (openSlotKey === key) {
      setOpenSlotKey(null);
      return;
    }
    const currentVal = plan[dateIso]?.[mealKey] || '';
    const recEnabled = Boolean(recurringMap[weekdayLower]?.[mealKey]?.enabled);
    setPickerValue(currentVal);
    setPickerRecurring(recEnabled);
    setOpenSlotKey(key);
  };

  const handleCommitPicker = async (
    dateIso: string,
    mealKey: 'breakfast' | 'lunch' | 'dinner',
    valOverride?: string
  ) => {
    const val = (valOverride !== undefined ? valOverride : pickerValue).trim();
    setOpenSlotKey(null);
    try {
      await apiPost('save_meal_plan', {
        week_start: currentWeekStart,
        date_iso: dateIso,
        slot: mealKey,
        value: val,
        recurring: pickerRecurring,
      });
      setWeekPlanState((prev) => ({
        ...prev,
        [dateIso]: {
          ...(prev[dateIso] || { breakfast: '', lunch: '', dinner: '' }),
          [mealKey]: val,
        },
      }));
      await refresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to save meal slot', { type: 'error' });
    }
  };

  const handleSwapSlots = async (
    sourceDate: string,
    sourceMeal: 'breakfast' | 'lunch' | 'dinner',
    targetDate: string,
    targetMeal: 'breakfast' | 'lunch' | 'dinner'
  ) => {
    if (sourceDate === targetDate && sourceMeal === targetMeal) return;
    try {
      await apiPost('swap_meal_slots', {
        source_date: sourceDate,
        source_slot: sourceMeal,
        target_date: targetDate,
        target_slot: targetMeal,
      });
      await refresh();
    } catch {
      // ignore
    }
  };

  const handleAddMealSuggestion = async () => {
    const trimmed = newSuggestionText.trim();
    if (!trimmed) return;
    try {
      await apiPost('add_meal_suggestion', { meal: trimmed });
      setNewSuggestionText('');
      showToast(`Added "${trimmed}" to Suggested Meals`);
      await refresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to add suggestion', { type: 'error' });
    }
  };

  const handleDeleteMealSuggestion = async (meal: string) => {
    try {
      await apiPost('delete_meal_suggestion', { meal });
      await refresh();
    } catch {
      // ignore
    }
  };

  // Planned meals map (lowercase key -> display name)
  const plannedMealsMap: Record<string, string> = {};
  Object.values(plan).forEach((daySlots) => {
    if (!daySlots) return;
    MEAL_KEYS.forEach((k) => {
      const v = (daySlots[k] || '').trim();
      if (v) {
        const lower = v.toLowerCase();
        if (!plannedMealsMap[lower]) plannedMealsMap[lower] = v;
      }
    });
  });

  const handleQuickAddShopping = async () => {
    const name = quickItemName.trim();
    if (!name) return;
    const storeId = quickItemStore || stores[0]?.id || 'aldi';
    try {
      await apiPost('add_general_shopping_item', {
        name,
        qty: '',
        store: storeId,
      });
      setQuickItemName('');
      await refresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to add shopping item', { type: 'error' });
    }
  };

  const handleAddStorePrompt = async () => {
    const name = window.prompt('Enter store name:')?.trim();
    if (!name) return;
    const id =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') +
      '-' +
      Math.floor(Math.random() * 9000 + 1000);
    const nextStores = [...stores, { id, name, icon: '🛒' }];
    await apiPost('save_shopping_stores', { stores: nextStores });
    await refresh();
  };

  const handleDeleteStore = async (store: ShoppingStore) => {
    if (!window.confirm(`Delete "${store.name}"? Items assigned to it will remain in the Meals library.`)) {
      return;
    }
    const nextStores = stores.filter((s) => s.id !== store.id);
    await apiPost('save_shopping_stores', { stores: nextStores });
    await refresh();
  };

  const handleClearCheckedShopping = async () => {
    await apiPost('clear_shopping_checked', {});
    await refresh();
  };

  const handleToggleShopCheck = async (itemKey: string, currentChecked: boolean) => {
    await apiPost('update_shopping_item', {
      key: itemKey,
      checked: !currentChecked,
    });
    await refresh();
  };

  const handleRemoveGeneralItem = async (itemName: string, itemId?: string) => {
    await apiPost('remove_shopping_item', {
      id: itemId,
      name: itemName,
      source: 'general',
    });
    await refresh();
  };

  const handleAddLibraryIngredient = async (
    mealKeyRaw: string,
    ingNameRaw: string,
    ingQtyRaw: string,
    storeIdRaw: string
  ) => {
    const mealKey = mealKeyRaw.trim().toLowerCase();
    const name = ingNameRaw.trim();
    if (!mealKey || !name) return;
    const qty = ingQtyRaw.trim();
    const store = storeIdRaw || stores[0]?.id || 'aldi';
    const existing = ingredientsMap[mealKey] || [];
    if (existing.some((i: MealIngredient) => i.name.toLowerCase() === name.toLowerCase())) return;
    const nextList = [...existing, { name, qty, store }];
    await apiPost('save_meal_ingredients', {
      meal: mealKey,
      ingredients: nextList,
    });
    await refresh();
  };

  const handleRemoveLibraryIngredient = async (mealKey: string, idx: number) => {
    const existing = [...(ingredientsMap[mealKey] || [])];
    existing.splice(idx, 1);
    await apiPost('save_meal_ingredients', {
      meal: mealKey,
      ingredients: existing,
    });
    await refresh();
  };

  const allSuggestionsPool = Array.from(
    new Set([...suggestions, ...Object.keys(ingredientsMap).map((k) => k.charAt(0).toUpperCase() + k.slice(1))])
  );

  return (
    <>
      {/* ===================================================================
          1. WEEKLY MEAL PLANNER
         =================================================================== */}
      <section
        className={`meal-planner-section collapsible-section${plannerCollapsed ? ' collapsed' : ''}`}
        id="meal-planner-section"
      >
        <h2
          className="section-title section-toggle meal-planner-title"
          onClick={() => setPlannerCollapsed((p) => !p)}
        >
          <i className="fas fa-utensils" /> <span>Weekly Meal Planner</span>
          <i className="fas fa-chevron-down section-chevron" />
        </h2>
        <div className="meal-planner-subtitle">
          Drag meals to swap. Click <i className="fas fa-pencil" style={{ fontSize: '0.8em', opacity: 0.75 }} /> to
          change a meal.
        </div>

        <div className="meal-week-nav">
          <button
            type="button"
            className="meal-nav-btn meal-prev-week-btn"
            onClick={() => handleNavigateWeek(-7)}
          >
            <i className="fas fa-chevron-left" /> Prev
          </button>
          <span className="meal-week-nav-label">{formatWeekRangeLabel(currentWeekStart)}</span>
          {isThisWeek && (
            <span className="meal-this-week-badge" id="meal-this-week-badge">
              This week
            </span>
          )}
          <button
            type="button"
            className="meal-nav-btn meal-next-week-btn"
            onClick={() => handleNavigateWeek(7)}
          >
            Next <i className="fas fa-chevron-right" />
          </button>
          {navLoading && (
            <span className="meal-nav-spinner">
              <i className="fas fa-spinner fa-spin" />
            </span>
          )}
        </div>

        <div id="meal-planner-editable" className="meal-week-display">
          {weekDays.map((day) => {
            const isToday = day.date_iso === data.current_date;
            const daySlots = plan[day.date_iso] || { breakfast: '', lunch: '', dinner: '' };
            const weekdayLower = (day.day_full || '').toLowerCase();

            return (
              <div
                key={day.date_iso}
                className={`meal-day-card${isToday ? ' meal-day-card-today' : ''}`}
                data-day={day.date_iso}
              >
                <div className="meal-day-header">
                  <strong>{day.day_full}</strong>
                  <span>{day.date_label}</span>
                </div>
                <div className="meal-day-items">
                  {MEAL_KEYS.map((mealKey) => {
                    const cellValue = (daySlots[mealKey] || '').trim();
                    const recEnabled = Boolean(recurringMap[weekdayLower]?.[mealKey]?.enabled);
                    const slotKey = `${day.date_iso}::${mealKey}`;
                    const isPickerOpen = openSlotKey === slotKey;
                    const customImg = cellValue ? mealImages[cellValue.toLowerCase()] || mealImages[cellValue] : '';

                    return (
                      <div
                        key={mealKey}
                        className="meal-slot"
                        data-day={day.date_iso}
                        data-meal={mealKey}
                        data-weekday={weekdayLower}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (draggedSlot) {
                            handleSwapSlots(draggedSlot.dateIso, draggedSlot.mealKey, day.date_iso, mealKey);
                            setDraggedSlot(null);
                          }
                        }}
                      >
                        <div
                          className={`meal-slot-row${isPickerOpen ? ' meal-slot-picker-open' : ''}`}
                          draggable
                          onDragStart={() => setDraggedSlot({ dateIso: day.date_iso, mealKey })}
                          onDragEnd={() => setDraggedSlot(null)}
                          onClick={() => handleOpenPicker(day.date_iso, mealKey, weekdayLower)}
                        >
                          <span className="meal-slot-icon">
                            {customImg ? (
                              <img
                                src={resolveAssetUrl(customImg)}
                                alt=""
                                style={{
                                  width: 26,
                                  height: 26,
                                  objectFit: 'cover',
                                  borderRadius: 4,
                                  verticalAlign: 'middle',
                                }}
                              />
                            ) : cellValue ? (
                              getMealEmoji(cellValue)
                            ) : (
                              '🍽️'
                            )}
                          </span>
                          <span
                            className={`meal-display-value${!cellValue ? ' meal-display-empty' : ''}`}
                            data-day={day.date_iso}
                            data-meal={mealKey}
                          >
                            {cellValue || '—'}
                          </span>
                          <div className="meal-slot-tools">
                            <span
                              className={`meal-recurring-badge${!recEnabled || !cellValue ? ' hidden' : ''}`}
                              title="Repeats weekly"
                            >
                              <i className="fas fa-repeat" />
                            </span>
                            <i className="fas fa-grip-lines meal-drag-cue" title="Drag to swap" />
                            <button
                              type="button"
                              className="meal-edit-btn"
                              title="Change meal"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenPicker(day.date_iso, mealKey, weekdayLower);
                              }}
                            >
                              <i className="fas fa-pencil" />
                            </button>
                          </div>
                        </div>

                        {isPickerOpen && (
                          <div className="meal-inline-picker">
                            <div className="meal-picker-header">
                              <label className="meal-picker-recurring-wrap" title="Repeat weekly">
                                <i className="fas fa-repeat" />
                                <input
                                  type="checkbox"
                                  className="meal-picker-recurring"
                                  checked={pickerRecurring}
                                  onChange={(e) => setPickerRecurring(e.target.checked)}
                                />
                                <span>Weekly</span>
                              </label>
                            </div>
                            <input
                              type="text"
                              className="meal-picker-input"
                              placeholder="Search meals, or type anything…"
                              value={pickerValue}
                              maxLength={120}
                              autoFocus
                              onChange={(e) => setPickerValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleCommitPicker(day.date_iso, mealKey);
                                }
                                if (e.key === 'Escape') {
                                  setOpenSlotKey(null);
                                }
                              }}
                            />
                            <div className="meal-picker-hint">Enter saves · Esc closes</div>
                            {allSuggestionsPool.length > 0 && (
                              <div className="meal-picker-results" role="listbox">
                                {allSuggestionsPool
                                  .filter((s) => !pickerValue || s.toLowerCase().includes(pickerValue.toLowerCase()))
                                  .slice(0, 8)
                                  .map((s) => (
                                    <div
                                      key={s}
                                      className="meal-picker-option"
                                      onClick={() => handleCommitPicker(day.date_iso, mealKey, s)}
                                    >
                                      <span>{getMealEmoji(s)}</span> <span>{s}</span>
                                    </div>
                                  ))}
                              </div>
                            )}
                            <div className="meal-picker-btns">
                              <button
                                type="button"
                                className="meal-picker-ok"
                                onClick={() => handleCommitPicker(day.date_iso, mealKey)}
                              >
                                ✓ Set
                              </button>
                              <button
                                type="button"
                                className="meal-picker-clear"
                                onClick={() => handleCommitPicker(day.date_iso, mealKey, '')}
                              >
                                Clear
                              </button>
                              <button
                                type="button"
                                className="meal-picker-cancel"
                                onClick={() => setOpenSlotKey(null)}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div
          className={`meal-suggestions-panel collapsible-section${suggestedMealsCollapsed ? ' collapsed' : ''}`}
        >
          <h3
            className="meal-suggestions-toggle section-toggle"
            onClick={() => setSuggestedMealsCollapsed((p) => !p)}
          >
            <i className="fas fa-utensils" /> Suggested Meals
            <i className="fas fa-chevron-down section-chevron" />
          </h3>
          <div className="meal-suggestion-add-row">
            <input
              type="text"
              id="meal-suggestion-input"
              className="modern-input"
              placeholder="Add suggested meal..."
              maxLength={80}
              value={newSuggestionText}
              onChange={(e) => setNewSuggestionText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddMealSuggestion();
                }
              }}
            />
            <button
              type="button"
              className="edit-btn"
              id="meal-suggestion-add-btn"
              onClick={handleAddMealSuggestion}
            >
              Add
            </button>
          </div>
          <div id="meal-suggestions-list" className="meal-suggestions-list">
            {suggestions.map((meal) => (
              <span key={meal} className="meal-suggestion-chip">
                <span>
                  {getMealEmoji(meal)} {meal}
                </span>
                <button
                  type="button"
                  className="meal-suggestion-del"
                  onClick={() => handleDeleteMealSuggestion(meal)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================================
          2. SHOPPING LIST
         =================================================================== */}
      <section
        className={`meal-planner-section shopping-list-section collapsible-section${shoppingCollapsed ? ' collapsed' : ''}`}
        id="shopping-list-section"
      >
        <h2
          className="section-title section-toggle meal-planner-title"
          onClick={() => setShoppingCollapsed((p) => !p)}
        >
          <i className="fas fa-cart-shopping" /> <span>Shopping List</span>
          <i className="fas fa-chevron-down section-chevron" />
        </h2>
        <p className="meal-planner-subtitle">
          Items needed for your planned meals this week plus general weekly shopping — split by store.
        </p>

        <div className="shopping-stores-row" id="shopping-stores-row">
          {stores.map((store) => {
            // Find meal groups that have ingredients for this store
            const mealGroupsForStore = Object.entries(ingredientsMap).filter(([mealKey, ings]) => {
              const isPlannedOrActive =
                Boolean(plannedMealsMap[mealKey.toLowerCase()]) ||
                (shop?.active || []).includes(mealKey);
              return (
                isPlannedOrActive &&
                (ings || []).some(
                  (i: MealIngredient) =>
                    (i.store || '').toLowerCase() === store.id.toLowerCase() ||
                    (i.store || '').toLowerCase() === store.name.toLowerCase()
                )
              );
            });

            const storeGeneral = (shop?.general || []).filter(
              (g) =>
                (g.store || '').toLowerCase() === store.id.toLowerCase() ||
                (g.store || '').toLowerCase() === store.name.toLowerCase()
            );

            let uncheckedCount = 0;
            mealGroupsForStore.forEach(([mealKey, ings]) => {
              (ings || [])
                .filter(
                  (i: MealIngredient) =>
                    (i.store || '').toLowerCase() === store.id.toLowerCase() ||
                    (i.store || '').toLowerCase() === store.name.toLowerCase()
                )
                .forEach((ing: MealIngredient) => {
                  const key = `meal::${mealKey}::${ing.name.toLowerCase()}`;
                  if (!shop?.checked?.[key]) uncheckedCount++;
                });
            });
            storeGeneral.forEach((g) => {
              const key = `general::${g.name.toLowerCase()}`;
              if (!g.checked && !shop?.checked?.[key]) uncheckedCount++;
            });

            const totalItemsCount =
              mealGroupsForStore.reduce((acc, [, ings]) => acc + (ings?.length || 0), 0) +
              storeGeneral.length;

            return (
              <div key={store.id} className="shopping-store-col" data-store={store.id}>
                <div className="shopping-store-header">
                  <span className="shopping-store-icon shopping-store-icon-btn">
                    {renderStoreIcon(store.icon)}
                  </span>
                  <span className="shopping-store-name">{store.name}</span>
                  {stores.length > 1 && (
                    <button
                      type="button"
                      className="shopping-store-delete-btn"
                      title="Delete store"
                      onClick={() => handleDeleteStore(store)}
                    >
                      <i className="fas fa-trash" aria-hidden="true" />
                    </button>
                  )}
                  <span
                    className={`shopping-store-badge${uncheckedCount === 0 && totalItemsCount > 0 ? ' shopping-store-badge-done' : ''}`}
                  >
                    {uncheckedCount ? `${uncheckedCount} to get` : '✓ All done'}
                  </span>
                </div>

                <div className="shopping-store-items">
                  {mealGroupsForStore.length > 0 && (
                    <div className="shopping-meal-groups-grid">
                      {mealGroupsForStore.map(([mealKey, allIngs]) => {
                        const storeIngs = (allIngs || []).filter(
                          (i: MealIngredient) =>
                            (i.store || '').toLowerCase() === store.id.toLowerCase() ||
                            (i.store || '').toLowerCase() === store.name.toLowerCase()
                        );
                        const isPlanned = Boolean(plannedMealsMap[mealKey.toLowerCase()]);
                        const displayName =
                          plannedMealsMap[mealKey.toLowerCase()] ||
                          mealKey.charAt(0).toUpperCase() + mealKey.slice(1);

                        return (
                          <div
                            key={mealKey}
                            className={`shopping-meal-group${isPlanned ? ' shopping-meal-group-planned' : ''}`}
                          >
                            <div className="shopping-meal-group-header">
                              <span>{getMealEmoji(displayName)}</span>
                              <span className="shopping-meal-group-name">{displayName}</span>
                              {isPlanned && <span className="shopping-planned-badge">This week</span>}
                            </div>
                            {storeIngs.map((ing: MealIngredient) => {
                              const itemKey = `meal::${mealKey}::${ing.name.toLowerCase()}`;
                              const checked = Boolean(shop?.checked?.[itemKey]);
                              return (
                                <div
                                  key={itemKey}
                                  className={`shopping-item${checked ? ' shopping-item-checked' : ''}`}
                                >
                                  <label className="shopping-item-label">
                                    <input
                                      type="checkbox"
                                      className="shopping-checkbox"
                                      checked={checked}
                                      onChange={() => handleToggleShopCheck(itemKey, checked)}
                                    />
                                    <span className="shopping-item-name">
                                      {ing.name}
                                      {ing.qty && <span className="shopping-item-qty">{ing.qty}</span>}
                                    </span>
                                  </label>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="shopping-general-section">
                    <div className="shopping-section-header">
                      <i className="fas fa-list-check" aria-hidden="true" />
                      &ensp;General Shopping
                    </div>
                    {storeGeneral.length === 0 ? (
                      <div className="shopping-empty-msg">No general items yet — add some below.</div>
                    ) : (
                      storeGeneral.map((g) => {
                        const itemKey = `general::${g.name.toLowerCase()}`;
                        const checked = Boolean(g.checked || shop?.checked?.[itemKey]);
                        return (
                          <div
                            key={itemKey}
                            className={`shopping-item${checked ? ' shopping-item-checked' : ''}`}
                          >
                            <label className="shopping-item-label">
                              <input
                                type="checkbox"
                                className="shopping-checkbox"
                                checked={checked}
                                onChange={() => handleToggleShopCheck(itemKey, checked)}
                              />
                              <span className="shopping-item-name">{g.name}</span>
                            </label>
                            <button
                              type="button"
                              className="shopping-remove-btn"
                              aria-label="Delete"
                              title="Delete permanently"
                              onClick={() => handleRemoveGeneralItem(g.name, g.id)}
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="shopping-action-row">
          <button
            type="button"
            className="edit-btn"
            id="clear-checked-shopping-btn"
            onClick={handleClearCheckedShopping}
          >
            <i className="fas fa-broom" /> Clear Checked
          </button>
          <button type="button" className="edit-btn" id="add-store-btn" onClick={handleAddStorePrompt}>
            <i className="fas fa-plus" /> Add Store
          </button>
        </div>

        <div className="shopping-manage-block" style={{ margin: '10px 0 4px 0' }}>
          <label className="shopping-manage-label">
            <i className="fas fa-list-check" />
            &ensp;Add General Shopping Item
          </label>
          <div className="shopping-add-row">
            <input
              type="text"
              id="shopping-quick-input"
              className="modern-input"
              placeholder="e.g. Bread, Milk..."
              maxLength={80}
              value={quickItemName}
              onChange={(e) => setQuickItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleQuickAddShopping();
                }
              }}
            />
            <select
              id="shopping-quick-store"
              className="meal-quick-add shopping-store-select shopping-dynamic-store-select"
              value={quickItemStore || stores[0]?.id || ''}
              onChange={(e) => setQuickItemStore(e.target.value)}
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="edit-btn"
              id="shopping-quick-add-btn"
              onClick={handleQuickAddShopping}
            >
              Add
            </button>
          </div>
        </div>

        <div
          className={`shopping-archived-wrap collapsible-section${archivedCollapsed ? ' collapsed' : ''}`}
          id="shopping-archived-section"
        >
          <h3
            className="section-toggle shopping-archived-toggle"
            onClick={() => setArchivedCollapsed((p) => !p)}
          >
            <i className="fas fa-box-archive" /> Old Shopping List
            <span id="shopping-archived-count" className="shopping-archived-count">
              {(shop?.archived || []).length || ''}
            </span>
            <i className="fas fa-chevron-down section-chevron" />
          </h3>
          <div id="shopping-archived-list">
            {(shop?.archived || []).length === 0 && (
              <div className="shopping-empty-msg" style={{ padding: '8px 12px' }}>
                No archived items yet.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===================================================================
          3. MEAL LIBRARY
         =================================================================== */}
      <section
        className={`meal-planner-section collapsible-section${libraryCollapsed ? ' collapsed' : ''}`}
        id="meal-library-section"
      >
        <h2
          className="section-title section-toggle meal-planner-title"
          onClick={() => setLibraryCollapsed((p) => !p)}
        >
          <i className="fas fa-book-open" /> <span>Meal Library</span>
          <i className="fas fa-chevron-down section-chevron" />
        </h2>
        <p className="meal-planner-subtitle">
          Build your collection of meals and their ingredients. Leave a comment, drop a YouTube cooking link, or give a
          meal a like.
        </p>

        <div className="shopping-manage-block" style={{ marginBottom: 12 }}>
          <label className="shopping-manage-label">
            <i className="fas fa-utensils" />
            &ensp;Add Ingredients to a Meal
          </label>
          <div className="shopping-add-row">
            <select
              id="shopping-meal-select"
              className="meal-quick-add shopping-store-select"
              style={{ flex: '1 1 140px' }}
              value={selectedMealKey}
              onChange={(e) => setSelectedMealKey(e.target.value)}
            >
              <option value="">— Select meal —</option>
              <option value="__new__">＋ New meal…</option>
              {Object.keys(ingredientsMap)
                .sort()
                .map((k) => (
                  <option key={k} value={k}>
                    {getMealEmoji(k)} {k.charAt(0).toUpperCase() + k.slice(1)}
                  </option>
                ))}
            </select>
            {selectedMealKey === '__new__' && (
              <input
                type="text"
                id="shopping-meal-new-name"
                className="modern-input"
                placeholder="New meal name…"
                maxLength={80}
                style={{ flex: '1 1 140px' }}
                value={newMealCustomName}
                onChange={(e) => setNewMealCustomName(e.target.value)}
              />
            )}
          </div>
          <div className="shopping-add-row" style={{ marginTop: 6 }}>
            <input
              type="text"
              id="shopping-ingredient-input"
              className="modern-input"
              placeholder="Ingredient…"
              maxLength={80}
              value={newIngName}
              onChange={(e) => setNewIngName(e.target.value)}
            />
            <input
              type="text"
              id="shopping-ingredient-qty"
              className="modern-input shopping-qty-input"
              placeholder="Qty"
              maxLength={40}
              value={newIngQty}
              onChange={(e) => setNewIngQty(e.target.value)}
            />
            <label className="shopping-field-label" htmlFor="shopping-ingredient-store">
              <i className="fas fa-store" /> Store
            </label>
            <select
              id="shopping-ingredient-store"
              className="meal-quick-add shopping-store-select shopping-dynamic-store-select"
              value={newIngStore || stores[0]?.id || ''}
              onChange={(e) => setNewIngStore(e.target.value)}
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="edit-btn"
              id="shopping-add-ingredient-btn"
              onClick={async () => {
                const targetMeal =
                  selectedMealKey === '__new__' ? newMealCustomName.trim().toLowerCase() : selectedMealKey;
                if (!targetMeal || !newIngName.trim()) return;
                await handleAddLibraryIngredient(
                  targetMeal,
                  newIngName,
                  newIngQty,
                  newIngStore || stores[0]?.id || 'aldi'
                );
                setNewIngName('');
                setNewIngQty('');
                if (selectedMealKey === '__new__') {
                  setSelectedMealKey(targetMeal);
                  setNewMealCustomName('');
                }
              }}
            >
              Add
            </button>
          </div>
        </div>

        <div className="shopping-ingredients-library" id="shopping-ingredients-library">
          {Object.keys(ingredientsMap).length === 0 ? (
            <div className="shopping-empty-msg" style={{ margin: '8px 0' }}>
              No meals yet - add ingredients above.
            </div>
          ) : (
            <div className="meal-card-grid">
              {Object.keys(ingredientsMap)
                .sort()
                .map((mealKey) => {
                  const items = ingredientsMap[mealKey] || [];
                  const imageUrl = mealImages[mealKey] || '';
                  const displayName = mealKey.charAt(0).toUpperCase() + mealKey.slice(1);

                  return (
                    <div key={mealKey} className="meal-card" data-meal={mealKey}>
                      <div className="meal-card-img-area">
                        {imageUrl ? (
                          <img src={resolveAssetUrl(imageUrl)} alt={displayName} className="meal-card-img" />
                        ) : (
                          <div className="meal-card-img-placeholder">
                            <span className="meal-card-emoji">{getMealEmoji(mealKey)}</span>
                          </div>
                        )}
                      </div>
                      <div className="meal-card-header">
                        <span className="meal-card-title">{displayName}</span>
                      </div>
                      <div className="meal-card-ing-list">
                        {items.map((item: MealIngredient, idx: number) => {
                          const storeObj = stores.find(
                            (s) =>
                              s.id.toLowerCase() === (item.store || '').toLowerCase() ||
                              s.name.toLowerCase() === (item.store || '').toLowerCase()
                          );
                          return (
                            <div key={idx} className="meal-card-ing-row">
                              <span className="meal-card-ing-name">{item.name}</span>
                              <span className="meal-card-ing-qty">{item.qty || ''}</span>
                              <span
                                className="shopping-lib-store-icon-badge meal-card-ing-store"
                                title={storeObj?.name || item.store}
                              >
                                {renderStoreIcon(storeObj?.icon)}
                              </span>
                              <button
                                type="button"
                                className="meal-card-ing-btn meal-card-ing-btn--remove"
                                title="Remove"
                                onClick={() => handleRemoveLibraryIngredient(mealKey, idx)}
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      <div className="meal-card-quick-add">
                        <input
                          type="text"
                          className="meal-card-qa-input"
                          placeholder="Add ingredient..."
                          maxLength={80}
                          value={cardQuickIngName[mealKey] || ''}
                          onChange={(e) =>
                            setCardQuickIngName((prev) => ({ ...prev, [mealKey]: e.target.value }))
                          }
                        />
                        <input
                          type="text"
                          className="meal-card-qa-qty"
                          placeholder="Qty"
                          maxLength={40}
                          value={cardQuickIngQty[mealKey] || ''}
                          onChange={(e) =>
                            setCardQuickIngQty((prev) => ({ ...prev, [mealKey]: e.target.value }))
                          }
                        />
                        <select
                          className="meal-card-qa-store shopping-dynamic-store-select"
                          value={cardQuickIngStore[mealKey] || stores[0]?.id || ''}
                          onChange={(e) =>
                            setCardQuickIngStore((prev) => ({ ...prev, [mealKey]: e.target.value }))
                          }
                        >
                          {stores.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="meal-card-qa-btn"
                          title="Add ingredient"
                          onClick={async () => {
                            const n = (cardQuickIngName[mealKey] || '').trim();
                            if (!n) return;
                            await handleAddLibraryIngredient(
                              mealKey,
                              n,
                              cardQuickIngQty[mealKey] || '',
                              cardQuickIngStore[mealKey] || stores[0]?.id || 'aldi'
                            );
                            setCardQuickIngName((prev) => ({ ...prev, [mealKey]: '' }));
                            setCardQuickIngQty((prev) => ({ ...prev, [mealKey]: '' }));
                          }}
                        >
                          <i className="fas fa-plus" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </section>
    </>
  );
};
