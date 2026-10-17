import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { apiGet, apiPost, resolveAssetUrl } from '../api';
import { MealIngredient, ShoppingStore, RecipeItem, ShoppingCatalogItem } from '../types';
import { SectionHelpTip } from './HelpTooltipAndView';
import { Modal } from './common/Modal';

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
  const [shoppingCollapsed, setShoppingCollapsed] = useState(false);
  const [archivedCollapsed, setArchivedCollapsed] = useState(true);
  const [libraryCollapsed, setLibraryCollapsed] = useState(true);

  // Week navigation state
  const [activeWeekStart, setActiveWeekStart] = useState<string>('');
  const [weekDaysState, setWeekDaysState] = useState<any[]>([]);
  const [weekPlanState, setWeekPlanState] = useState<Record<string, any>>({});
  const [navLoading, setNavLoading] = useState(false);

  // Shopping intelligence states
  const [shoppingSearch, setShoppingSearch] = useState('');
  const [shoppingStore, setShoppingStore] = useState('');
  const [shoppingComboboxOpen, setShoppingComboboxOpen] = useState(false);
  const [hideChecked, setHideChecked] = useState(false);
  const [frequentlyModalOpen, setFrequentlyModalOpen] = useState(false);
  const [suggestedModalOpen, setSuggestedModalOpen] = useState(false);
  const [recentlyPurchasedOpen, setRecentlyPurchasedOpen] = useState(false);
  const [selectedFrequentKeys, setSelectedFrequentKeys] = useState<Record<string, boolean>>({});
  const [selectedSuggestedKeys, setSelectedSuggestedKeys] = useState<Record<string, boolean>>({});

  // Kanban Meal Planner Add/Edit Modal
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planMealTitle, setPlanMealTitle] = useState('');
  const [planAudience, setPlanAudience] = useState('Everyone');
  const [planSelectedDays, setPlanSelectedDays] = useState<string[]>([]);
  const [planEditingCardId, setPlanEditingCardId] = useState<string | null>(null);

  // Recipe View / Edit Modal
  const [activeRecipe, setActiveRecipe] = useState<RecipeItem | null>(null);
  const [editingRecipe, setEditingRecipe] = useState(false);
  const [recipeFormTitle, setRecipeFormTitle] = useState('');
  const [recipeFormPrep, setRecipeFormPrep] = useState('');
  const [recipeFormServings, setRecipeFormServings] = useState('');
  const [recipeFormInstructions, setRecipeFormInstructions] = useState('');

  // Notion Sync in Library
  const [notionSyncing, setNotionSyncing] = useState(false);
  const comboboxRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setShoppingComboboxOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

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

  const [planAddShopping, setPlanAddShopping] = useState(true);

  const recipesRecord: Record<string, RecipeItem> = data.recipes || {};
  const intel = shop?.intelligence || {
    catalog: [],
    frequently_added: [],
    suggested: [],
    recently_purchased: [],
  };

  const allSuggestionsPool = Array.from(
    new Set([
      ...suggestions,
      ...Object.keys(ingredientsMap).map((k) => k.charAt(0).toUpperCase() + k.slice(1)),
      ...Object.values(recipesRecord).map((r) => r.title),
    ])
  );

  const catalogPool = intel.catalog || [];
  const filteredCatalog = shoppingSearch.trim()
    ? catalogPool
        .filter((item) => item.name.toLowerCase().includes(shoppingSearch.toLowerCase().trim()))
        .slice(0, 10)
    : catalogPool.slice(0, 8);

  const handleSyncNotion = async () => {
    setNotionSyncing(true);
    try {
      const res = await apiPost<{ success: boolean; synced: number; error?: string }>('recipes/sync_notion', {});
      if (res.success) {
        showToast(`Synced ${res.synced} recipes from Notion!`, { type: 'success' });
        await refresh();
      } else {
        showToast(res.error || 'Notion sync failed', { type: 'error' });
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to sync with Notion', { type: 'error' });
    } finally {
      setNotionSyncing(false);
    }
  };

  const handleOpenAddMealModal = (defaultDateIso: string) => {
    setPlanMealTitle('');
    setPlanAudience('Everyone');
    setPlanSelectedDays([defaultDateIso]);
    setPlanEditingCardId(null);
    setPlanAddShopping(true);
    setPlanModalOpen(true);
  };

  const handleSaveMealCard = async () => {
    const title = planMealTitle.trim();
    if (!title || planSelectedDays.length === 0) {
      showToast('Please enter a meal title and select at least one day', { type: 'warning' });
      return;
    }
    try {
      await apiPost('meal_planner/card', {
        title,
        audience: planAudience,
        days: planSelectedDays,
        card_id: planEditingCardId || undefined,
      });

      if (planAddShopping) {
        const mealKey = title.toLowerCase();
        const recipeMatch = recipesRecord[mealKey];
        const ings = recipeMatch?.ingredients?.length ? recipeMatch.ingredients : ingredientsMap[mealKey] || [];
        if (ings.length > 0) {
          await apiPost('shopping/batch_add', {
            items: ings.map((i: any) => ({
              name: i.name,
              qty: i.qty || '',
              store: i.store || stores[0]?.id || 'aldi',
            })),
          });
          showToast(`Planned "${title}" and added ${ings.length} ingredients to shopping list!`);
        } else {
          showToast(`Planned "${title}" for ${planSelectedDays.length} day(s)!`);
        }
      } else {
        showToast(`Planned "${title}" for ${planSelectedDays.length} day(s)!`);
      }

      setPlanModalOpen(false);
      setPlanMealTitle('');
      await refresh();
    } catch (err: any) {
      showToast(err?.message || 'Failed to save meal card', { type: 'error' });
    }
  };

  const handleDeleteCard = async (dateIso: string, cardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiPost('meal_planner/card/delete', {
        date_iso: dateIso,
        card_id: cardId,
      });
      await refresh();
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete card', { type: 'error' });
    }
  };

  const handleOpenRecipeModal = (card: { title: string; meal_key?: string }) => {
    const key = (card.meal_key || card.title).toLowerCase().trim();
    const existing = recipesRecord[key] || {
      meal_key: key,
      title: card.title,
      image_url: mealImages[key] || null,
      ingredients: ingredientsMap[key] || [],
      instructions: '',
      servings: '4',
      prep_time: '25 mins',
    };
    setActiveRecipe(existing);
    setRecipeFormTitle(existing.title);
    setRecipeFormPrep(existing.prep_time || '');
    setRecipeFormServings(existing.servings || '');
    setRecipeFormInstructions(existing.instructions || '');
    setEditingRecipe(false);
  };

  const handleSaveRecipeForm = async () => {
    if (!activeRecipe) return;
    try {
      await apiPost('recipes', {
        title: recipeFormTitle || activeRecipe.title,
        prep_time: recipeFormPrep,
        servings: recipeFormServings,
        instructions: recipeFormInstructions,
        ingredients: activeRecipe.ingredients || [],
        image_url: activeRecipe.image_url || undefined,
      });
      showToast('Recipe saved!');
      setEditingRecipe(false);
      await refresh();
      if (activeRecipe.meal_key) {
        setActiveRecipe((prev) =>
          prev
            ? {
                ...prev,
                title: recipeFormTitle || prev.title,
                prep_time: recipeFormPrep,
                servings: recipeFormServings,
                instructions: recipeFormInstructions,
              }
            : null
        );
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to save recipe', { type: 'error' });
    }
  };

  const handleAddRecipeIngredientsToShopping = async (recipe: RecipeItem) => {
    const ings = recipe.ingredients || [];
    if (ings.length === 0) {
      showToast('No ingredients listed for this recipe', { type: 'warning' });
      return;
    }
    try {
      await apiPost('shopping/batch_add', {
        items: ings.map((i) => ({
          name: i.name,
          qty: i.qty || '',
          store: i.store || stores[0]?.id || 'aldi',
        })),
      });
      showToast(`Added ${ings.length} ingredients from "${recipe.title}" to shopping list!`);
      await refresh();
    } catch (err: any) {
      showToast(err?.message || 'Failed to add ingredients', { type: 'error' });
    }
  };

  const handleBatchAddFromKeys = async (keysRecord: Record<string, boolean>, pool: ShoppingCatalogItem[]) => {
    const selected = pool.filter((item) => keysRecord[item.normalized_key]);
    if (selected.length === 0) {
      showToast('No items selected', { type: 'warning' });
      return;
    }
    try {
      await apiPost('shopping/batch_add', {
        items: selected.map((s) => ({
          name: s.name,
          qty: '',
          store: s.default_store || stores[0]?.id || 'aldi',
        })),
      });
      showToast(`Added ${selected.length} items to shopping list!`);
      setSelectedFrequentKeys({});
      setSelectedSuggestedKeys({});
      setFrequentlyModalOpen(false);
      setSuggestedModalOpen(false);
      await refresh();
    } catch (err: any) {
      showToast(err?.message || 'Failed to batch add items', { type: 'error' });
    }
  };

  const handleArchiveChecked = async () => {
    try {
      const res = await apiPost<{ success: boolean; archived_count: number }>('shopping/archive_checked', {});
      showToast(`Archived ${res.archived_count || 'checked'} items as purchased! Recorded to history.`);
      await refresh();
    } catch (err: any) {
      showToast(err?.message || 'Failed to archive checked items', { type: 'error' });
    }
  };

  const handleSelectComboboxItem = async (itemName: string, preferredStore?: string) => {
    const trimmed = itemName.trim();
    if (!trimmed) return;
    setShoppingSearch('');
    setShoppingComboboxOpen(false);
    try {
      await apiPost('add_general_shopping_item', {
        name: trimmed,
        qty: '',
        store: preferredStore || shoppingStore || stores[0]?.id || 'aldi',
      });
      showToast(`Added "${trimmed}" to list`);
      await refresh();
    } catch (err: any) {
      showToast(err?.message || 'Failed to add item', { type: 'error' });
    }
  };

  return (
    <>
      {/* ===================================================================
          1. WEEKLY MEAL PLANNER (KANBAN DAYS)
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
          <SectionHelpTip
            title="Weekly Meal Planner"
            text="Plan meals as Kanban columns with multiple tiles per day (e.g. Kids vs Adults). Click any meal tile to open recipe instructions and ingredients, or add them straight to shopping. Select multiple days when cooking big meals to last multiple nights!"
          />
          <i className="fas fa-chevron-down section-chevron" />
        </h2>

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

        {/* 7-Day Kanban Display */}
        <div id="meal-planner-editable" className="meal-week-display">
          {weekDays.map((day) => {
            const isToday = day.date_iso === data.current_date;
            const rawDayData = plan[day.date_iso];
            const dayCards: any[] = Array.isArray(rawDayData)
              ? rawDayData
              : typeof rawDayData === 'object' && rawDayData !== null
                ? Object.entries(rawDayData)
                    .filter(([, v]) => Boolean(v))
                    .map(([k, v]) => ({
                      id: `${day.date_iso}_${k}`,
                      title: String(v),
                      audience: 'Everyone',
                      meal_key: String(v).toLowerCase(),
                    }))
                : [];

            return (
              <div
                key={day.date_iso}
                className={`meal-day-card${isToday ? ' meal-day-card-today' : ''}`}
                data-day={day.date_iso}
                onDragOver={(e) => e.preventDefault()}
                onDrop={async () => {
                  if (draggedSlot) {
                    try {
                      await apiPost('meal_planner/card/move', {
                        card_id: draggedSlot.mealKey,
                        from_date_iso: draggedSlot.dateIso,
                        to_date_iso: day.date_iso,
                      });
                      setDraggedSlot(null);
                      await refresh();
                    } catch {
                      // ignore
                    }
                  }
                }}
              >
                <div className="meal-day-header">
                  <strong>{day.day_full}</strong>
                  <span>{day.date_label}</span>
                </div>

                <div className="meal-kanban-cards">
                  {dayCards.length === 0 ? (
                    <div className="meal-day-empty" style={{ textAlign: 'center', opacity: 0.5, fontSize: '0.8rem' }}>
                      No meals planned
                    </div>
                  ) : (
                    dayCards.map((card) => {
                      const recipeObj = recipesRecord[card.meal_key] || recipesRecord[card.title.toLowerCase()];
                      const customImg = recipeObj?.image_url || mealImages[card.meal_key];

                      return (
                        <div
                          key={card.id}
                          className="meal-kanban-card"
                          draggable
                          onDragStart={() => setDraggedSlot({ dateIso: day.date_iso, mealKey: card.id as any })}
                          onDragEnd={() => setDraggedSlot(null)}
                          onClick={() => handleOpenRecipeModal(card)}
                          title="Click to view recipe & ingredients"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                            {customImg ? (
                              <img
                                src={resolveAssetUrl(customImg)}
                                alt=""
                                style={{ width: 20, height: 20, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                              />
                            ) : (
                              <span style={{ fontSize: '1.05rem', lineHeight: 1, flexShrink: 0 }}>{getMealEmoji(card.title)}</span>
                            )}
                            <span
                              className="meal-kanban-card-title"
                              style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                fontWeight: 600,
                                fontSize: '0.84rem',
                              }}
                            >
                              {card.title}
                            </span>
                            {card.audience && card.audience !== 'Everyone' && (
                              <span className={`meal-audience-pill meal-audience-${card.audience}`}>
                                {card.audience}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            className="meal-kanban-card-del"
                            title="Delete meal"
                            onClick={(e) => handleDeleteCard(day.date_iso, card.id, e)}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                <button
                  type="button"
                  className="meal-kanban-add-btn"
                  onClick={() => handleOpenAddMealModal(day.date_iso)}
                >
                  <i className="fas fa-plus" /> Add Meal
                </button>
              </div>
            );
          })}
        </div>

        {/* Suggested Meals Pool */}
        <div
          className={`meal-suggestions-panel collapsible-section${suggestedMealsCollapsed ? ' collapsed' : ''}`}
        >
          <h3
            className="meal-suggestions-toggle section-toggle"
            onClick={() => setSuggestedMealsCollapsed((p) => !p)}
          >
            <i className="fas fa-utensils" /> Quick Suggested Meals ({suggestions.length})
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
          2. SHOPPING LIST (SMART CATALOG & DEDUPLICATED)
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
          <SectionHelpTip
            title="Smart Shopping List"
            text="Catalog tracks frequent items and purchase frequency. Use 'Frequently Added' or 'Suggested' to restock items in bulk with one click. 'Hide Checked' clears ticked items while shopping, and 'Archive Checked' records purchases to history."
          />
          <i className="fas fa-chevron-down section-chevron" />
        </h2>

        {/* Smart Toolbar */}
        <div className="shopping-smart-toolbar">
          <button
            type="button"
            className="shopping-toolbar-btn"
            onClick={() => setFrequentlyModalOpen(true)}
            title="Add frequently purchased staples"
          >
            <i className="fas fa-star" /> Frequently Added ({intel.frequently_added?.length || 0})
          </button>
          <button
            type="button"
            className="shopping-toolbar-btn"
            onClick={() => setSuggestedModalOpen(true)}
            title="Items predicted to restock based on purchase frequency"
          >
            <i className="fas fa-lightbulb" /> Suggested Restock ({intel.suggested?.length || 0})
          </button>
          <button
            type="button"
            className="shopping-toolbar-btn"
            onClick={() => setRecentlyPurchasedOpen(true)}
            title="View purchased history"
          >
            <i className="fas fa-clock-rotate-left" /> History
          </button>
          <button
            type="button"
            className={`shopping-toolbar-btn shopping-icon-btn${hideChecked ? ' active' : ''}`}
            onClick={() => setHideChecked((h) => !h)}
            title={hideChecked ? 'Show Checked Items' : 'Hide Checked Items'}
            aria-label={hideChecked ? 'Show Checked Items' : 'Hide Checked Items'}
          >
            <i className={hideChecked ? 'fas fa-eye-slash' : 'fas fa-eye'} />
          </button>
          <button
            type="button"
            className="shopping-toolbar-btn shopping-archive-btn"
            style={{ marginLeft: 'auto' }}
            onClick={handleArchiveChecked}
            title="Archive checked items as purchased and save to history"
          >
            <i className="fas fa-box-archive" /> Archive Checked
          </button>
        </div>

        {/* Smart Search Combobox */}
        <div className="shopping-manage-block" style={{ margin: '10px 0 14px 0' }}>
          <div className="shopping-add-row" style={{ position: 'relative' }}>
            <div className="shopping-combobox-wrap" ref={comboboxRef}>
              <input
                type="text"
                className="modern-input"
                placeholder="Search staples (e.g. Paper Towel, Milk, Bread) or type new item…"
                value={shoppingSearch}
                onFocus={() => setShoppingComboboxOpen(true)}
                onChange={(e) => {
                  setShoppingSearch(e.target.value);
                  setShoppingComboboxOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (
                      filteredCatalog.length > 0 &&
                      shoppingSearch.trim().toLowerCase() === filteredCatalog[0].name.toLowerCase()
                    ) {
                      handleSelectComboboxItem(filteredCatalog[0].name, filteredCatalog[0].default_store);
                    } else if (shoppingSearch.trim()) {
                      handleSelectComboboxItem(shoppingSearch.trim());
                    }
                  } else if (e.key === 'Escape') {
                    setShoppingComboboxOpen(false);
                  }
                }}
              />
              {shoppingComboboxOpen && (
                <div className="shopping-combobox-dropdown">
                  {filteredCatalog.map((item) => (
                    <div
                      key={item.normalized_key}
                      className="shopping-combobox-item"
                      onClick={() => handleSelectComboboxItem(item.name, item.default_store)}
                    >
                      <span>{item.name}</span>
                      <span className="shopping-combobox-times">
                        {item.times_added ? `${item.times_added}× added` : ''} · {item.default_store || 'aldi'}
                      </span>
                    </div>
                  ))}
                  {shoppingSearch.trim() &&
                    !catalogPool.some(
                      (c) => c.name.toLowerCase() === shoppingSearch.trim().toLowerCase()
                    ) && (
                      <div
                        className="shopping-combobox-item shopping-combobox-item-custom"
                        onClick={() => handleSelectComboboxItem(shoppingSearch.trim())}
                      >
                        <span>+ Add &ldquo;{shoppingSearch.trim()}&rdquo; to shopping list</span>
                        <span className="shopping-combobox-times">new item</span>
                      </div>
                    )}
                </div>
              )}
            </div>
            <select
              className="meal-quick-add shopping-store-select shopping-dynamic-store-select"
              value={shoppingStore || stores[0]?.id || ''}
              onChange={(e) => setShoppingStore(e.target.value)}
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="shopping-add-btn"
              onClick={() => {
                if (shoppingSearch.trim()) {
                  handleSelectComboboxItem(shoppingSearch.trim());
                }
              }}
            >
              Add
            </button>
          </div>
        </div>

        {/* Stores Columns */}
        <div className="shopping-stores-row" id="shopping-stores-row">
          {stores.map((store) => {
            const mealGroupsForStore = Object.entries(ingredientsMap).filter(([mealKey, ings]) => {
              const isPlannedOrActive =
                Boolean(plannedMealsMap[mealKey.toLowerCase()]) || (shop?.active || []).includes(mealKey);
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
                    className={`shopping-store-badge${
                      uncheckedCount === 0 ? ' shopping-store-badge-done' : ''
                    }`}
                  >
                    {uncheckedCount > 0 ? `${uncheckedCount} to get` : '✓ All done'}
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

                        // If hideChecked is true, check if all items are checked
                        const visibleIngs = hideChecked
                          ? storeIngs.filter((ing) => {
                              const itemKey = `meal::${mealKey}::${ing.name.toLowerCase()}`;
                              return !shop?.checked?.[itemKey];
                            })
                          : storeIngs;

                        if (visibleIngs.length === 0) return null;

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
                            {visibleIngs.map((ing: MealIngredient) => {
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

                  {storeGeneral.length === 0 && mealGroupsForStore.length === 0 ? (
                    <div className="shopping-empty-msg" style={{ padding: '8px 4px', fontSize: '0.82rem', opacity: 0.6 }}>No items yet.</div>
                  ) : (
                    storeGeneral.map((g) => {
                      const itemKey = `general::${g.name.toLowerCase()}`;
                      const checked = Boolean(g.checked || shop?.checked?.[itemKey]);
                      if (hideChecked && checked) return null;

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
            );
          })}
        </div>

        <div className="shopping-action-row" style={{ marginTop: 10 }}>
          <button
            type="button"
            className="edit-btn"
            id="clear-checked-shopping-btn"
            onClick={handleClearCheckedShopping}
          >
            <i className="fas fa-eraser" /> Uncheck All
          </button>
          <button type="button" className="edit-btn" id="add-store-btn" onClick={handleAddStorePrompt}>
            <i className="fas fa-plus" /> Add Store
          </button>
        </div>

        {/* Archived History */}
        <div
          className={`shopping-archived-wrap collapsible-section${archivedCollapsed ? ' collapsed' : ''}`}
          id="shopping-archived-section"
        >
          <h3
            className="section-toggle shopping-archived-toggle"
            onClick={() => setArchivedCollapsed((p) => !p)}
          >
            <i className="fas fa-box-archive" /> Old Archived Shopping List
            <span id="shopping-archived-count" className="shopping-archived-count">
              {(shop?.archived || []).length || ''}
            </span>
            <i className="fas fa-chevron-down section-chevron" />
          </h3>
          <div id="shopping-archived-list">
            {(shop?.archived || []).length === 0 ? (
              <div className="shopping-empty-msg" style={{ padding: '8px 12px' }}>
                No archived items yet.
              </div>
            ) : (
              (shop?.archived || []).slice(0, 30).map((item, idx) => (
                <div key={idx} className="shopping-archived-row">
                  <span className="shopping-archived-name">{item.name}</span>
                  <span className="shopping-archived-store">{item.store}</span>
                  {item.purchased_at && (
                    <span style={{ fontSize: '0.72rem', opacity: 0.5 }}>
                      {new Date(item.purchased_at).toLocaleDateString()}
                    </span>
                  )}
                  <button
                    type="button"
                    className="shopping-restore-btn"
                    onClick={() => handleSelectComboboxItem(item.name, item.store)}
                  >
                    + Re-add
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ===================================================================
          3. MEAL LIBRARY & RECIPES
         =================================================================== */}
      <section
        className={`meal-planner-section collapsible-section${libraryCollapsed ? ' collapsed' : ''}`}
        id="meal-library-section"
      >
        <h2
          className="section-title section-toggle meal-planner-title"
          onClick={() => setLibraryCollapsed((p) => !p)}
        >
          <i className="fas fa-book-open" /> <span>Meal Library & Recipes</span>
          <SectionHelpTip
            title="Meal Library & Notion Sync"
            text="Build recipes with ingredients, prep time, servings, and method. Use 'Sync from Notion' to pull recipes directly from your Notion recipe database, or use the webhook API for your Discord/Google Apps Script recipe bot."
          />
          <i className="fas fa-chevron-down section-chevron" />
        </h2>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <button
            type="button"
            className="edit-btn"
            onClick={handleSyncNotion}
            disabled={notionSyncing}
            style={{
              background: 'rgba(99,102,241,0.18)',
              borderColor: 'rgba(99,102,241,0.45)',
              color: '#c7d2fe',
            }}
          >
            <i className={notionSyncing ? 'fas fa-spinner fa-spin' : 'fas fa-arrows-rotate'} />{' '}
            {notionSyncing ? 'Syncing Notion Recipes…' : 'Sync from Notion'}
          </button>
        </div>

        {/* Add Ingredients to a Meal */}
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

        {/* Meal Cards Grid */}
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
                  const recipeObj = recipesRecord[mealKey];
                  const imageUrl = recipeObj?.image_url || mealImages[mealKey] || '';
                  const displayName = mealKey.charAt(0).toUpperCase() + mealKey.slice(1);

                  return (
                    <div
                      key={mealKey}
                      className="meal-card"
                      data-meal={mealKey}
                      onClick={() => handleOpenRecipeModal({ title: displayName, meal_key: mealKey })}
                      style={{ cursor: 'pointer' }}
                    >
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
                        <span style={{ fontSize: '0.72rem', opacity: 0.65 }}>View Recipe &rarr;</span>
                      </div>
                      <div className="meal-card-ing-list">
                        {items.slice(0, 4).map((item: MealIngredient, idx: number) => {
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
                            </div>
                          );
                        })}
                        {items.length > 4 && (
                          <div style={{ padding: '2px 8px', fontSize: '0.72rem', opacity: 0.5 }}>
                            +{items.length - 4} more ingredients
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </section>

      {/* ===================================================================
          MODALS
         =================================================================== */}

      {/* 1. Add / Edit Meal Modal (Multi-day support!) */}
      {planModalOpen && (
        <div className="cr-modal-overlay" onClick={() => setPlanModalOpen(false)}>
          <div className="cr-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="cr-modal-header">
              <h3>
                <i className="fas fa-calendar-plus" /> Plan a Meal
              </h3>
              <button type="button" className="cr-modal-close" onClick={() => setPlanModalOpen(false)}>
                ✕
              </button>
            </div>
            <div className="cr-modal-body">
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
                  Meal Name
                </label>
                <input
                  type="text"
                  className="modern-input"
                  placeholder="e.g. Spaghetti Bolognese, Pizza, Tacos..."
                  value={planMealTitle}
                  onChange={(e) => setPlanMealTitle(e.target.value)}
                  autoFocus
                />
                {allSuggestionsPool.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {allSuggestionsPool.slice(0, 6).map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="edit-btn"
                        style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                        onClick={() => setPlanMealTitle(s)}
                      >
                        {getMealEmoji(s)} {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
                  Audience
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['Everyone', 'Kids', 'Adults'].map((aud) => (
                    <button
                      key={aud}
                      type="button"
                      className={`edit-btn${planAudience === aud ? ' active' : ''}`}
                      onClick={() => setPlanAudience(aud)}
                    >
                      {aud}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>
                  Select Days (Plan across multiple nights)
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 6 }}>
                  {weekDays.map((d) => {
                    const checked = planSelectedDays.includes(d.date_iso);
                    return (
                      <label
                        key={d.date_iso}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          background: checked ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${checked ? '#3b82f6' : 'rgba(255,255,255,0.1)'}`,
                          borderRadius: 8,
                          padding: '6px 8px',
                          cursor: 'pointer',
                          fontSize: '0.82rem',
                          color: '#f8fafc',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPlanSelectedDays((prev) => [...prev, d.date_iso]);
                            } else {
                              setPlanSelectedDays((prev) => prev.filter((iso) => iso !== d.date_iso));
                            }
                          }}
                        />
                        <span>{d.day_short}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    fontSize: '0.88rem',
                    color: '#f8fafc',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={planAddShopping}
                    onChange={(e) => setPlanAddShopping(e.target.checked)}
                  />
                  <span>Add meal ingredients to Shopping List</span>
                </label>
              </div>
            </div>
            <div className="cr-modal-footer">
              <button type="button" className="edit-btn" onClick={() => setPlanModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="edit-btn"
                style={{ background: '#3b82f6', borderColor: '#2563eb', color: '#fff' }}
                onClick={handleSaveMealCard}
              >
                Save to Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Recipe View & Edit Modal */}
      {activeRecipe && (
        <div className="cr-modal-overlay" onClick={() => setActiveRecipe(null)}>
          <div className="cr-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="cr-modal-header">
              <h3>
                <i className="fas fa-book-open" /> {activeRecipe.title}
              </h3>
              <button type="button" className="cr-modal-close" onClick={() => setActiveRecipe(null)}>
                ✕
              </button>
            </div>
            <div className="cr-modal-body">
              {editingRecipe ? (
                <>
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
                      Title
                    </label>
                    <input
                      type="text"
                      className="modern-input"
                      value={recipeFormTitle}
                      onChange={(e) => setRecipeFormTitle(e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
                        Prep Time
                      </label>
                      <input
                        type="text"
                        className="modern-input"
                        placeholder="e.g. 25 mins"
                        value={recipeFormPrep}
                        onChange={(e) => setRecipeFormPrep(e.target.value)}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
                        Servings
                      </label>
                      <input
                        type="text"
                        className="modern-input"
                        placeholder="e.g. 4 people"
                        value={recipeFormServings}
                        onChange={(e) => setRecipeFormServings(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
                      Instructions / Method
                    </label>
                    <textarea
                      className="modern-input"
                      rows={6}
                      placeholder="Step by step instructions..."
                      value={recipeFormInstructions}
                      onChange={(e) => setRecipeFormInstructions(e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <>
                  {activeRecipe.image_url && (
                    <img
                      src={resolveAssetUrl(activeRecipe.image_url)}
                      alt={activeRecipe.title}
                      className="recipe-modal-img"
                    />
                  )}
                  <div className="recipe-meta-row">
                    <span>
                      <i className="fas fa-clock" /> {activeRecipe.prep_time || '25 mins'}
                    </span>
                    <span>
                      <i className="fas fa-users" /> {activeRecipe.servings || '4 servings'}
                    </span>
                    {activeRecipe.notion_id && (
                      <span style={{ color: '#a78bfa' }}>
                        <i className="fas fa-arrows-rotate" /> Synced from Notion
                      </span>
                    )}
                  </div>

                  <div>
                    <strong style={{ fontSize: '0.9rem', color: '#f8fafc' }}>Ingredients</strong>
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {(activeRecipe.ingredients || []).length === 0 ? (
                        <div style={{ fontSize: '0.82rem', opacity: 0.5, fontStyle: 'italic' }}>
                          No ingredients specified.
                        </div>
                      ) : (
                        (activeRecipe.ingredients || []).map((ing, idx) => (
                          <div key={idx} className="recipe-ing-item">
                            <span>{ing.name}</span>
                            <span style={{ opacity: 0.6 }}>{ing.qty}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    <strong style={{ fontSize: '0.9rem', color: '#f8fafc' }}>Instructions / Method</strong>
                    <div className="recipe-instructions-box">
                      {activeRecipe.instructions || 'No instructions written yet. Click Edit to add them!'}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="cr-modal-footer">
              {editingRecipe ? (
                <>
                  <button type="button" className="edit-btn" onClick={() => setEditingRecipe(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="edit-btn"
                    style={{ background: '#3b82f6', borderColor: '#2563eb', color: '#fff' }}
                    onClick={handleSaveRecipeForm}
                  >
                    Save Recipe
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="edit-btn"
                    onClick={() => handleAddRecipeIngredientsToShopping(activeRecipe)}
                    style={{ background: 'rgba(34,197,94,0.18)', borderColor: 'rgba(34,197,94,0.4)', color: '#86efac' }}
                  >
                    <i className="fas fa-cart-plus" /> Add all to Shopping List
                  </button>
                  <button type="button" className="edit-btn" onClick={() => setEditingRecipe(true)}>
                    <i className="fas fa-pencil" /> Edit
                  </button>
                  <button type="button" className="edit-btn" onClick={() => setActiveRecipe(null)}>
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Frequently Added Modal */}
      <Modal
        open={frequentlyModalOpen}
        onClose={() => setFrequentlyModalOpen(false)}
        title="Frequently Added Staples"
        icon="fas fa-star"
        maxWidth={540}
        footer={
          <>
            <button
              type="button"
              className="btn-cancel"
              onClick={() => setFrequentlyModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => handleBatchAddFromKeys(selectedFrequentKeys, intel.frequently_added)}
            >
              Add Selected to Shopping List
            </button>
          </>
        }
      >
        <p style={{ margin: '0 0 10px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
          Select staples you need this week. Click &lsquo;Add Selected&rsquo; to add them all at once.
        </p>

        {/* Standard Select All Checkbox */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '6px 10px',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 8,
            cursor: 'pointer',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <input
            type="checkbox"
            checked={
              (intel.frequently_added || []).length > 0 &&
              (intel.frequently_added || []).every((item) => selectedFrequentKeys[item.normalized_key])
            }
            onChange={(e) => {
              const checked = e.target.checked;
              const next: Record<string, boolean> = {};
              if (checked) {
                (intel.frequently_added || []).forEach((item) => {
                  next[item.normalized_key] = true;
                });
              }
              setSelectedFrequentKeys(next);
            }}
          />
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc' }}>
            Select All ({intel.frequently_added?.length || 0})
          </span>
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
          {(intel.frequently_added || []).map((item) => {
            const checked = Boolean(selectedFrequentKeys[item.normalized_key]);
            return (
              <label
                key={item.normalized_key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  background: checked ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${checked ? '#3b82f6' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      setSelectedFrequentKeys((prev) => ({
                        ...prev,
                        [item.normalized_key]: e.target.checked,
                      }));
                    }}
                  />
                  <span style={{ fontSize: '0.88rem', color: '#f8fafc', fontWeight: 600 }}>{item.name}</span>
                </div>
                <span style={{ fontSize: '0.74rem', opacity: 0.6 }}>
                  {item.times_added}× added · {item.default_store || 'aldi'}
                </span>
              </label>
            );
          })}
        </div>
      </Modal>

      {/* 4. Suggested Restock Modal */}
      <Modal
        open={suggestedModalOpen}
        onClose={() => setSuggestedModalOpen(false)}
        title="Suggested Restock"
        icon="fas fa-lightbulb"
        maxWidth={540}
        footer={
          <>
            <button
              type="button"
              className="btn-cancel"
              onClick={() => setSuggestedModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => handleBatchAddFromKeys(selectedSuggestedKeys, intel.suggested)}
            >
              Add Selected to Shopping List
            </button>
          </>
        }
      >
        <p style={{ margin: '0 0 10px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
          Items predicted to need restocking based on your historical purchase frequency.
        </p>

        {/* Standard Select All Checkbox */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '6px 10px',
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 8,
            cursor: 'pointer',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <input
            type="checkbox"
            checked={
              (intel.suggested || []).length > 0 &&
              (intel.suggested || []).every((item) => selectedSuggestedKeys[item.normalized_key])
            }
            onChange={(e) => {
              const checked = e.target.checked;
              const next: Record<string, boolean> = {};
              if (checked) {
                (intel.suggested || []).forEach((item) => {
                  next[item.normalized_key] = true;
                });
              }
              setSelectedSuggestedKeys(next);
            }}
          />
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc' }}>
            Select All ({intel.suggested?.length || 0})
          </span>
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
          {(intel.suggested || []).length === 0 ? (
            <div style={{ fontSize: '0.85rem', opacity: 0.6, fontStyle: 'italic', padding: 12 }}>
              No suggested items due right now!
            </div>
          ) : (
            (intel.suggested || []).map((item) => {
              const checked = Boolean(selectedSuggestedKeys[item.normalized_key]);
              return (
                <label
                  key={item.normalized_key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 10px',
                    background: checked ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${checked ? '#3b82f6' : 'rgba(255,255,255,0.07)'}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setSelectedSuggestedKeys((prev) => ({
                          ...prev,
                          [item.normalized_key]: e.target.checked,
                        }));
                      }}
                    />
                    <div>
                      <div style={{ fontSize: '0.88rem', color: '#f8fafc', fontWeight: 600 }}>{item.name}</div>
                      <div style={{ fontSize: '0.72rem', color: '#93c5fd' }}>{item.reason}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.74rem', opacity: 0.6 }}>{item.default_store || 'aldi'}</span>
                </label>
              );
            })
          )}
        </div>
      </Modal>

      {/* 5. Recently Purchased Modal */}
      <Modal
        open={recentlyPurchasedOpen}
        onClose={() => setRecentlyPurchasedOpen(false)}
        title="Purchased History"
        icon="fas fa-clock-rotate-left"
        maxWidth={540}
        footer={
          <button
            type="button"
            className="btn-cancel"
            onClick={() => setRecentlyPurchasedOpen(false)}
          >
            Close
          </button>
        }
      >
        <p style={{ margin: '0 0 10px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
          Items ticked and archived as purchased from your shopping trips.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
          {(intel.recently_purchased || []).length === 0 ? (
            <div style={{ fontSize: '0.85rem', opacity: 0.6, fontStyle: 'italic', padding: 12 }}>
              No purchase history logged yet.
            </div>
          ) : (
            (intel.recently_purchased || []).map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 8,
                }}
              >
                <div>
                  <div style={{ fontSize: '0.88rem', color: '#f8fafc', fontWeight: 600 }}>{item.name}</div>
                  <div style={{ fontSize: '0.72rem', opacity: 0.5 }}>
                    {item.store} · {new Date(item.purchased_at).toLocaleDateString()}
                  </div>
                </div>
                <button
                  type="button"
                  className="shopping-toolbar-btn"
                  style={{ height: 28, fontSize: '0.75rem', padding: '0 8px' }}
                  onClick={() => handleSelectComboboxItem(item.name, item.store)}
                >
                  + Re-add
                </button>
              </div>
            ))
          )}
        </div>
      </Modal>
    </>
  );
};
