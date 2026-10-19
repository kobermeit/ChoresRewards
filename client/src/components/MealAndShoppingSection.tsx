import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { apiGet, apiPost, resolveAssetUrl } from '../api';
import { MealIngredient, ShoppingStore, RecipeItem, ShoppingCatalogItem } from '../types';
import { SectionHelpTip } from './HelpTooltipAndView';
import { Modal } from './common/Modal';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { FallbackImage } from './common/FallbackImage';
import { PageContainer, Button, IconButton, PillButton, Badge, Input, Select, Textarea, FormField } from './ui';

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

function formatWeekRangeLabel(weekStartIso: string, weeksCount: number = 1): string {
  if (!weekStartIso) return '';
  try {
    const start = new Date(`${weekStartIso}T00:00:00`);
    const end = new Date(start);
    end.setDate(start.getDate() + (weeksCount * 7 - 1));
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const showYear = start.getFullYear() !== now.getFullYear() || end.getFullYear() !== now.getFullYear();
    const yearStr = showYear ? ` ${end.getFullYear()}` : '';
    return `${start.getDate()} ${months[start.getMonth()]} – ${end.getDate()} ${months[end.getMonth()]}${yearStr}`;
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

function computeWeekDays(weekStartIso: string) {
  try {
    const days = [];
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dayShorts = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const start = new Date(`${weekStartIso}T00:00:00`);
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const iso = `${y}-${m}-${day}`;
      days.push({
        date_iso: iso,
        day_name: dayNames[i],
        day_short: dayShorts[i],
        day_full: dayNames[i],
        date_label: `${d.getDate()} ${months[d.getMonth()]}`,
        day_num: d.getDate(),
        is_today: iso === todayIso,
      });
    }
    return days;
  } catch {
    return [];
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

export interface MealAndShoppingSectionProps {
  subView?: 'all' | 'meals' | 'shopping' | 'library';
  isStandalonePage?: boolean;
}

export const MealAndShoppingSection: React.FC<MealAndShoppingSectionProps> = ({
  subView = 'all',
  isStandalonePage = false,
}) => {
  const { data, refresh, showToast, confirm, isChild } = useApp();

  // Accordion states matching original index.html
  const [plannerCollapsed, setPlannerCollapsed] = useState(false);
  const [suggestedMealsCollapsed, setSuggestedMealsCollapsed] = useState(true);
  const [shoppingCollapsed, setShoppingCollapsed] = useState(false);
  const [archivedCollapsed, setArchivedCollapsed] = useState(true);
  const [libraryCollapsed, setLibraryCollapsed] = useState(true);

  // Week navigation & 2-week view state with cache for instant 0ms switching
  const [plannerViewMode, setPlannerViewMode] = useState<'1week' | '2weeks'>(() => {
    try {
      return (localStorage.getItem('cr_planner_view_mode') as '1week' | '2weeks') || '2weeks';
    } catch {
      return '2weeks';
    }
  });
  const [activeWeekStart, setActiveWeekStart] = useState<string>('');
  const [weekDaysState, setWeekDaysState] = useState<any[]>([]);
  const [weekPlanState, setWeekPlanState] = useState<Record<string, any>>({});
  const [navLoading, setNavLoading] = useState(false);
  const weekCacheRef = useRef<Record<string, { week_days: any[]; plan: Record<string, any> }>>({});

  const togglePlannerViewMode = (mode: '1week' | '2weeks') => {
    setPlannerViewMode(mode);
    try {
      localStorage.setItem('cr_planner_view_mode', mode);
    } catch {
      // ignore
    }
  };

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
  const [planComboboxOpen, setPlanComboboxOpen] = useState(false);
  const planComboboxRef = useRef<HTMLDivElement>(null);

  // Recipe View & Edit Modals
  const [activeRecipe, setActiveRecipe] = useState<RecipeItem | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<RecipeItem | null>(null);
  const [editRecipeTitle, setEditRecipeTitle] = useState('');
  const [editRecipePrepTime, setEditRecipePrepTime] = useState('');
  const [editRecipeServings, setEditRecipeServings] = useState('');
  const [editRecipeInstructions, setEditRecipeInstructions] = useState('');
  const [editRecipeIngredients, setEditRecipeIngredients] = useState<RecipeIngredient[]>([]);
  const [editNewIngName, setEditNewIngName] = useState('');
  const [editNewIngQty, setEditNewIngQty] = useState('');
  const [editNewIngStore, setEditNewIngStore] = useState('');

  // Notion Sync in Library
  const [notionSyncing, setNotionSyncing] = useState(false);
  const comboboxRef = useRef<HTMLDivElement>(null);

  // Lock body scroll whenever any meal modal is open
  useBodyScrollLock(
    Boolean(
      planModalOpen ||
      activeRecipe ||
      frequentlyModalOpen ||
      suggestedModalOpen ||
      recentlyPurchasedOpen
    )
  );

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

  // Shopping quick-add & store modal state
  const [quickItemName, setQuickItemName] = useState('');
  const [quickItemStore, setQuickItemStore] = useState('');
  const [newStoreModalOpen, setNewStoreModalOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreIcon, setNewStoreIcon] = useState('🛒');

  // Meal Library add ingredient state
  const [selectedMealKey, setSelectedMealKey] = useState('');
  const [newMealCustomName, setNewMealCustomName] = useState('');
  const [newIngName, setNewIngName] = useState('');
  const [newIngQty, setNewIngQty] = useState('');
  const [newIngStore, setNewIngStore] = useState('');
  const [cardQuickIngName, setCardQuickIngName] = useState<Record<string, string>>({});
  const [cardQuickIngQty, setCardQuickIngQty] = useState<Record<string, string>>({});
  const [cardQuickIngStore, setCardQuickIngStore] = useState<Record<string, string>>({});

  const currentWeekStart = activeWeekStart || data?.meal_planner?.week_start || '';

  useEffect(() => {
    if (data?.meal_planner) {
      weekCacheRef.current[data.meal_planner.week_start] = {
        week_days: data.meal_planner.week_days || [],
        plan: data.meal_planner.plan || {},
      };
      if (!activeWeekStart) {
        setActiveWeekStart(data.meal_planner.week_start);
        setWeekDaysState(data.meal_planner.week_days || []);
        setWeekPlanState(data.meal_planner.plan || {});
      } else if (activeWeekStart === data.meal_planner.week_start) {
        setWeekDaysState(data.meal_planner.week_days || []);
        setWeekPlanState(data.meal_planner.plan || {});
      }
    }
  }, [data?.meal_planner, activeWeekStart]);

  // When switching to 2-week view, ensure Week 2 is loaded and merged into plan state
  useEffect(() => {
    if (plannerViewMode === '2weeks' && currentWeekStart) {
      const nextWeekStart = shiftWeekIso(currentWeekStart, 7);
      if (!weekCacheRef.current[nextWeekStart]) {
        apiGet<{
          success: boolean;
          week_start: string;
          week_days: any[];
          plan: Record<string, any>;
        }>(`meal_planner?week=${encodeURIComponent(nextWeekStart)}`)
          .then((res) => {
            if (res && res.success) {
              weekCacheRef.current[res.week_start] = {
                week_days: res.week_days || [],
                plan: res.plan || {},
              };
              setWeekPlanState((prev) => ({ ...prev, ...(res.plan || {}) }));
            }
          })
          .catch(() => {});
      } else {
        const cached = weekCacheRef.current[nextWeekStart];
        setWeekPlanState((prev) => ({ ...prev, ...(cached.plan || {}) }));
      }
    }
  }, [plannerViewMode, currentWeekStart]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setShoppingComboboxOpen(false);
      }
      if (planComboboxRef.current && !planComboboxRef.current.contains(e.target as Node)) {
        setPlanComboboxOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  if (!data) return null;

  const mp = data.meal_planner;
  const shop = data.shopping;
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
    const targetWeek2 = shiftWeekIso(targetWeek, 7);
    const cached1 = weekCacheRef.current[targetWeek];
    const cached2 = weekCacheRef.current[targetWeek2];

    // Immediate 0ms transition: update label and week columns synchronously
    setActiveWeekStart(targetWeek);
    if (cached1 && (plannerViewMode === '1week' || cached2)) {
      setWeekDaysState(cached1.week_days);
      setWeekPlanState({ ...(cached1.plan || {}), ...(cached2?.plan || {}) });
    } else if (cached1) {
      setWeekDaysState(cached1.week_days);
      setWeekPlanState(cached1.plan || {});
    } else {
      setWeekDaysState(computeWeekDays(targetWeek));
      setWeekPlanState({});
    }

    setNavLoading(true);
    try {
      const weeksToFetch = [targetWeek];
      if (plannerViewMode === '2weeks') {
        weeksToFetch.push(targetWeek2);
      }
      const results = await Promise.all(
        weeksToFetch.map((w) =>
          apiGet<{
            success: boolean;
            week_start: string;
            week_days: any[];
            plan: Record<string, any>;
          }>(`meal_planner?week=${encodeURIComponent(w)}`).catch(() => null)
        )
      );

      let mergedPlan: Record<string, any> = {};
      results.forEach((res) => {
        if (res && res.success) {
          weekCacheRef.current[res.week_start] = {
            week_days: res.week_days || [],
            plan: res.plan || {},
          };
          mergedPlan = { ...mergedPlan, ...(res.plan || {}) };
        }
      });

      // Update states only if user is still on this target week
      setActiveWeekStart((latest) => {
        if (latest === targetWeek) {
          setWeekDaysState(results[0]?.week_days || computeWeekDays(targetWeek));
          setWeekPlanState((prev) => ({ ...prev, ...mergedPlan }));
        }
        return latest;
      });
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

  const handleCreateNewStore = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newStoreName.trim();
    if (!name) return;
    const id =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') +
      '-' +
      Math.floor(Math.random() * 9000 + 1000);
    const nextStores = [...stores, { id, name, icon: newStoreIcon || '🛒' }];
    await apiPost('save_shopping_stores', { stores: nextStores });
    setShoppingStore(id);
    setNewStoreName('');
    setNewStoreIcon('🛒');
    setNewStoreModalOpen(false);
    showToast(`Added store "${name}"`, { type: 'success' });
    await refresh();
  };

  const handleUpdateQuantity = async (key: string, qtyVal: string) => {
    try {
      await apiPost('update_shopping_item', {
        key,
        qty: qtyVal,
      });
      await refresh();
    } catch {
      // ignore
    }
  };

  const handleDeleteStore = async (store: ShoppingStore) => {
    const ok = await confirm({
      title: `Delete "${store.name}"?`,
      message: `Delete "${store.name}"? Items assigned to it will remain in the Meals library.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    const nextStores = stores.filter((s) => s.id !== store.id);
    await apiPost('save_shopping_stores', { stores: nextStores });
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
      ...(Array.isArray(suggestions) ? suggestions : []),
      ...Object.keys(ingredientsMap || {}).map((k) => (k ? k.charAt(0).toUpperCase() + k.slice(1) : '')).filter(Boolean),
      ...Object.values(recipesRecord || {}).map((r) => r?.title || '').filter(Boolean),
    ])
  );

  const allLibraryRecipes = useMemo(() => {
    const map = new Map<string, { meal_key: string; title: string; prep_time?: string; servings?: string; image_url?: string }>();
    Object.keys(recipesRecord || {}).forEach((k) => {
      const r = recipesRecord[k];
      if (!r || typeof r !== 'object') return;
      map.set(k.toLowerCase(), {
        meal_key: k,
        title: r.title || (k ? k.charAt(0).toUpperCase() + k.slice(1) : 'Untitled Meal'),
        prep_time: r.prep_time || '',
        servings: r.servings || '',
        image_url: r.image_url || '',
      });
    });
    Object.keys(ingredientsMap || {}).forEach((k) => {
      if (!k) return;
      if (!map.has(k.toLowerCase())) {
        map.set(k.toLowerCase(), {
          meal_key: k,
          title: k.charAt(0).toUpperCase() + k.slice(1),
          prep_time: '',
          servings: '',
          image_url: mealImages[k] || '',
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  }, [recipesRecord, ingredientsMap, mealImages]);

  const filteredPlanRecipes = useMemo(() => {
    if (!planMealTitle.trim()) return allLibraryRecipes.slice(0, 15);
    const q = planMealTitle.toLowerCase().trim();
    return allLibraryRecipes
      .filter((r) => r.title.toLowerCase().includes(q) || r.meal_key.toLowerCase().includes(q))
      .slice(0, 15);
  }, [allLibraryRecipes, planMealTitle]);

  const totalShoppingItems = useMemo(() => {
    const generalCount = (shop?.general || []).length;
    let ingredientCount = 0;
    Object.entries(ingredientsMap).forEach(([mealKey, ings]) => {
      const isPlannedOrActive =
        Boolean(plannedMealsMap[mealKey.toLowerCase()]) || (shop?.active || []).includes(mealKey);
      if (isPlannedOrActive) {
        ingredientCount += (ings || []).length;
      }
    });
    return generalCount + ingredientCount;
  }, [shop, ingredientsMap, plannedMealsMap]);

  const catalogPool = intel.catalog || [];
  const filteredCatalog = shoppingSearch.trim()
    ? catalogPool
        .filter((item) => item.name.toLowerCase().includes(shoppingSearch.toLowerCase().trim()))
        .slice(0, 10)
    : catalogPool.slice(0, 8);

  const handleSyncNotion = async () => {
    setNotionSyncing(true);
    try {
      const res = await apiPost<{ success: boolean; synced_count?: number; synced?: number; error?: string }>(
        'recipes/sync_notion',
        {}
      );
      if (res.success) {
        const count = res.synced_count ?? res.synced ?? 0;
        showToast(`✨ Synced ${count} recipes from Notion!`, { type: 'success' });
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
    // Smart near-term check: default unchecked if > 7 days out
    const diffDays = Math.round(
      (new Date(`${defaultDateIso}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24)
    );
    setPlanAddShopping(diffDays >= 0 && diffDays <= 7);
    setPlanComboboxOpen(false);
    setPlanModalOpen(true);
  };

  const handlePostMutationRefresh = async () => {
    try {
      const w1 = currentWeekStart;
      const w2 = shiftWeekIso(currentWeekStart, 7);
      delete weekCacheRef.current[w1];
      delete weekCacheRef.current[w2];
      const weeksToFetch = [w1];
      if (plannerViewMode === '2weeks') {
        weeksToFetch.push(w2);
      }
      const results = await Promise.all(
        weeksToFetch.map((w) =>
          apiGet<{ success: boolean; week_start: string; week_days: any[]; plan: Record<string, any> }>(
            `meal_planner?week=${encodeURIComponent(w)}`
          ).catch(() => null)
        )
      );
      let mergedPlan: Record<string, any> = {};
      results.forEach((res) => {
        if (res && res.success) {
          weekCacheRef.current[res.week_start] = {
            week_days: res.week_days || [],
            plan: res.plan || {},
          };
          mergedPlan = { ...mergedPlan, ...(res.plan || {}) };
        }
      });
      setWeekPlanState((prev) => ({ ...prev, ...mergedPlan }));
      await refresh();
    } catch {
      await refresh();
    }
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
              name: i.raw_name || i.name,
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
      await handlePostMutationRefresh();
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
      await handlePostMutationRefresh();
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
  };

  const handleOpenEditRecipeModal = (recipe: RecipeItem) => {
    setEditingRecipe(recipe);
    setEditRecipeTitle(recipe.title || '');
    setEditRecipePrepTime(recipe.prep_time || '');
    setEditRecipeServings(recipe.servings || '');
    setEditRecipeInstructions(recipe.instructions || '');
    const rawIngs = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
    setEditRecipeIngredients(
      rawIngs.map((it: any) =>
        typeof it === 'string'
          ? { name: it, qty: '', store: '' }
          : it && typeof it === 'object'
          ? { name: it.name || '', qty: it.qty || '', store: it.store || '' }
          : { name: '', qty: '', store: '' }
      )
    );
    setEditNewIngName('');
    setEditNewIngQty('');
    setEditNewIngStore(stores[0]?.id || 'aldi');
  };

  const handleSaveRecipeEdits = async () => {
    if (!editingRecipe || !editRecipeTitle.trim()) {
      showToast('Recipe title is required', { type: 'warning' });
      return;
    }
    try {
      const res = await apiPost<{ success: boolean; error?: string; recipe?: RecipeItem }>('save_recipe', {
        meal_key: editingRecipe.meal_key,
        title: editRecipeTitle.trim(),
        prep_time: editRecipePrepTime.trim(),
        servings: editRecipeServings.trim(),
        instructions: editRecipeInstructions.trim(),
        ingredients: editRecipeIngredients,
      });
      if (res.success) {
        showToast(`Saved recipe "${editRecipeTitle.trim()}"!`, { type: 'success' });
        setEditingRecipe(null);
        if (activeRecipe && activeRecipe.meal_key === editingRecipe.meal_key) {
          setActiveRecipe(res.recipe || null);
        }
        await refresh();
      } else {
        showToast(res.error || 'Failed to save recipe', { type: 'error' });
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
          name: i.raw_name || i.name,
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
      {(subView === 'all' || subView === 'meals') && (
        <PageContainer
          title="Weekly Meal Planner"
          icon="fas fa-utensils"
          iconClass="section-icon-meals"
          boxed={!isStandalonePage}
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* 1 Week vs 2 Weeks View Mode Toggle */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 'var(--radius-pill, 999px)',
                  padding: 2,
                }}
              >
                <button
                  type="button"
                  onClick={() => togglePlannerViewMode('1week')}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 'var(--radius-pill, 999px)',
                    border: 'none',
                    background: plannerViewMode === '1week' ? 'var(--color-primary, #3b82f6)' : 'transparent',
                    color: plannerViewMode === '1week' ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  1 Week
                </button>
                <button
                  type="button"
                  onClick={() => togglePlannerViewMode('2weeks')}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 'var(--radius-pill, 999px)',
                    border: 'none',
                    background: plannerViewMode === '2weeks' ? 'var(--color-primary, #3b82f6)' : 'transparent',
                    color: plannerViewMode === '2weeks' ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  2 Weeks
                </button>
              </div>

              {/* Prev / Range / Next Controls */}
              <div className="meal-week-nav" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Button
                  variant="secondary"
                  size="sm"
                  icon="fas fa-chevron-left"
                  onClick={() => handleNavigateWeek(plannerViewMode === '2weeks' ? -14 : -7)}
                >
                  Prev
                </Button>
                <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 200, gap: 8 }}>
                  <span className="meal-week-nav-label" style={{ flex: 'none', margin: 0 }}>
                    {formatWeekRangeLabel(currentWeekStart, plannerViewMode === '2weeks' ? 2 : 1)}
                  </span>
                  {isThisWeek ? (
                    <span className="meal-this-week-badge" id="meal-this-week-badge">
                      Current
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      style={{ fontSize: '0.72rem', height: 22, padding: '0 8px', borderRadius: 'var(--radius-pill)' }}
                      onClick={() => {
                        if (mp?.week_start) {
                          const target = mp.week_start;
                          const cached = weekCacheRef.current[target];
                          setActiveWeekStart(target);
                          if (cached) {
                            setWeekDaysState(cached.week_days);
                            setWeekPlanState(cached.plan);
                          } else {
                            setWeekDaysState(mp.week_days || computeWeekDays(target));
                            setWeekPlanState(mp.plan || {});
                          }
                        }
                      }}
                    >
                      Current
                    </Button>
                  )}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  icon="fas fa-chevron-right"
                  iconPosition="right"
                  onClick={() => handleNavigateWeek(plannerViewMode === '2weeks' ? 14 : 7)}
                >
                  Next
                </Button>
                {navLoading && (
                  <span className="meal-nav-spinner" style={{ width: 14 }}>
                    <i className="fas fa-spinner fa-spin" />
                  </span>
                )}
              </div>
            </div>
          }
        >
          {/* Kanban Days Display: 1-Week (single row) or 2-Weeks (two distinct rows) */}
          {(() => {
            const week1Days = weekDays.slice(0, 7);
            const week2StartIso = shiftWeekIso(currentWeekStart, 7);
            const week2Days = computeWeekDays(week2StartIso);

            const renderKanbanDay = (day: any) => {
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

              const defaultSuggestions = [
                'Spaghetti Bolognese',
                'Chicken Stir Fry',
                'Tacos',
                'Homemade Pizza',
                'Salmon & Veggies',
                'Beef Burgers',
                'Roast Chicken',
              ];
              const pool = allSuggestionsPool.length > 0 ? allSuggestionsPool : defaultSuggestions;
              const dayNum = parseInt(day.date_iso.replace(/-/g, ''), 10) || 0;
              const suggestedTitle = pool[dayNum % pool.length];

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
                        await handlePostMutationRefresh();
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
                      /* Redesigned Clean Suggestion Card with Lightbulb Icon */
                      <div
                        className="meal-kanban-card meal-kanban-suggestion-card"
                        onClick={() => {
                          setPlanMealTitle(suggestedTitle);
                          setPlanAudience('Everyone');
                          setPlanSelectedDays([day.date_iso]);
                          setPlanEditingCardId(null);
                          const diffDays = Math.round(
                            (new Date(`${day.date_iso}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24)
                          );
                          setPlanAddShopping(diffDays >= 0 && diffDays <= 7);
                          setPlanComboboxOpen(false);
                          setPlanModalOpen(true);
                        }}
                        title={`Click to plan "${suggestedTitle}" for ${day.day_full}`}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                          padding: '6px 8px',
                          border: '1.5px dashed rgba(245, 158, 11, 0.45)',
                          background: 'rgba(245, 158, 11, 0.06)',
                          borderRadius: 'var(--card-radius, 10px)',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                          <span style={{ fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}>💡</span>
                          <span
                            className="meal-kanban-card-title"
                            style={{
                              fontSize: '0.82rem',
                              color: '#fbbf24',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontWeight: 600,
                            }}
                          >
                            {suggestedTitle}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.66rem', color: 'rgba(255, 255, 255, 0.45)', paddingLeft: 22 }}>
                          + Plan Suggestion
                        </div>
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
                            style={{ position: 'relative', padding: '6px 8px' }}
                          >
                            {/* Floating Top-Right Corner Delete Button */}
                            {!isChild && (
                              <button
                                type="button"
                                className="meal-kanban-delete-corner"
                                aria-label="Delete meal"
                                title="Delete meal"
                                onClick={(e) => handleDeleteCard(day.date_iso, card.id, e)}
                              >
                                ✕
                              </button>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', minWidth: 0 }}>
                              {customImg ? (
                                <FallbackImage
                                  src={resolveAssetUrl(customImg)}
                                  alt=""
                                  fallbackEmoji={getMealEmoji(card.title)}
                                  style={{ width: 22, height: 22, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                                />
                              ) : (
                                <span style={{ fontSize: '1.05rem', lineHeight: 1, flexShrink: 0 }}>{getMealEmoji(card.title)}</span>
                              )}
                              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', flex: 1, lineHeight: 1.15 }}>
                                <span
                                  className="meal-kanban-card-title"
                                  style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    fontWeight: 600,
                                    fontSize: '0.82rem',
                                  }}
                                >
                                  {card.title}
                                </span>
                                <span style={{ fontSize: '0.62rem', color: card.audience && card.audience !== 'Everyone' ? '#93c5fd' : '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {card.audience ? card.audience : 'All family'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {!isChild && (
                    <Button
                      variant="ghost"
                      size="sm"
                      fullWidth
                      icon="fas fa-plus"
                      className="meal-kanban-add-btn"
                      onClick={() => handleOpenAddMealModal(day.date_iso)}
                    >
                      Add Meal
                    </Button>
                  )}
                </div>
              );
            };

            if (plannerViewMode === '2weeks') {
              return (
                <div className="meal-week-display-2weeks">
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#93c5fd', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>📅 Week 1: {formatWeekRangeLabel(currentWeekStart, 1)}</span>
                    </div>
                    <div id="meal-planner-editable-w1" className="meal-week-display">
                      {week1Days.map(renderKanbanDay)}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#a78bfa', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>📅 Week 2: {formatWeekRangeLabel(week2StartIso, 1)}</span>
                    </div>
                    <div id="meal-planner-editable-w2" className="meal-week-display">
                      {week2Days.map(renderKanbanDay)}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div id="meal-planner-editable" className="meal-week-display">
                {week1Days.map(renderKanbanDay)}
              </div>
            );
          })()}
        </PageContainer>
      )}

      {/* ===================================================================
          2. SHOPPING LIST (SMART CATALOG & DEDUPLICATED)
         =================================================================== */}
      {(subView === 'all' || subView === 'shopping') && (
        <PageContainer
          title="Shopping List"
          icon="fas fa-cart-shopping"
          iconClass="section-icon-shopping"
          badge={totalShoppingItems}
          boxed={!isStandalonePage}
          actions={
            <Button
              variant="secondary"
              size="sm"
              icon="fas fa-box-archive"
              onClick={handleArchiveChecked}
              title="Archive checked items as purchased and save to history"
            >
              Archive Checked
            </Button>
          }
          toolbar={
            <div className="shopping-smart-toolbar" style={{ margin: 0 }}>
              <Button
                variant="secondary"
                size="sm"
                icon="fas fa-star"
                className="shopping-toolbar-btn shopping-toolbar-btn-frequent"
                onClick={() => setFrequentlyModalOpen(true)}
                title="Add frequently purchased staples"
              >
                Frequently Added ({intel.frequently_added?.length || 0})
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon="fas fa-lightbulb"
                className="shopping-toolbar-btn shopping-toolbar-btn-suggested"
                onClick={() => setSuggestedModalOpen(true)}
                title="Items predicted to restock based on purchase frequency"
              >
                Suggested Restock ({intel.suggested?.length || 0})
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon="fas fa-clock-rotate-left"
                className="shopping-toolbar-btn shopping-toolbar-btn-history"
                onClick={() => setRecentlyPurchasedOpen(true)}
                title="View purchased history"
              >
                History
              </Button>
              <IconButton
                shape="circle"
                variant={hideChecked ? 'primary' : 'ghost'}
                size="sm"
                className={`shopping-toolbar-btn shopping-icon-btn${hideChecked ? ' active' : ''}`}
                onClick={() => setHideChecked((h) => !h)}
                icon={hideChecked ? 'fas fa-eye-slash' : 'fas fa-eye'}
                aria-label={hideChecked ? 'Show Checked Items' : 'Hide Checked Items'}
                title={hideChecked ? 'Show Checked Items' : 'Hide Checked Items'}
              />
            </div>
          }
        >

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
              onChange={(e) => {
                if (e.target.value === '__add_new_store__') {
                  setNewStoreModalOpen(true);
                } else {
                  setShoppingStore(e.target.value);
                }
              }}
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              <option value="__add_new_store__">+ Add store…</option>
            </select>
            <Button
              variant="primary"
              size="md"
              icon="fas fa-plus"
              className="shopping-add-btn"
              onClick={() => {
                if (shoppingSearch.trim()) {
                  handleSelectComboboxItem(shoppingSearch.trim());
                }
              }}
            >
              Add Item
            </Button>
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
                    <IconButton
                      size="sm"
                      variant="ghost"
                      icon="fas fa-trash"
                      className="shopping-store-delete-btn"
                      title="Delete store"
                      aria-label="Delete store"
                      onClick={() => handleDeleteStore(store)}
                    />
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
                              const savedQty = (shop as any)?.quantities?.[itemKey];
                              const numericQty = savedQty !== undefined ? savedQty : (/^\d+$/.test(String(ing.qty || '').trim()) ? String(ing.qty).trim() : '1');

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
                                    <input
                                      type="number"
                                      min={1}
                                      className="shopping-item-qty-input"
                                      value={numericQty}
                                      onChange={(e) => handleUpdateQuantity(itemKey, e.target.value)}
                                      onClick={(e) => e.stopPropagation()}
                                      title="Quantity to buy"
                                    />
                                    <span className="shopping-item-name">
                                      {ing.name}
                                      {ing.qty && <span className="shopping-item-recipe-detail">({ing.qty})</span>}
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
                      const savedQty = (shop as any)?.quantities?.[itemKey] || g.qty;
                      const numericQty = /^\d+$/.test(String(savedQty || '').trim()) ? String(savedQty).trim() : '1';
                      const recipeDetail = !/^\d+$/.test(String(g.qty || '').trim()) && g.qty ? g.qty : null;

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
                            <input
                              type="number"
                              min={1}
                              className="shopping-item-qty-input"
                              value={numericQty}
                              onChange={(e) => handleUpdateQuantity(itemKey, e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              title="Quantity to buy"
                            />
                            <span className="shopping-item-name">
                              {g.name}
                              {recipeDetail && <span className="shopping-item-recipe-detail">({recipeDetail})</span>}
                            </span>
                          </label>
                          <IconButton
                            size="sm"
                            variant="ghost"
                            icon="fas fa-times"
                            className="shopping-remove-btn"
                            aria-label="Delete"
                            title="Delete permanently"
                            style={{ width: 26, height: 26 }}
                            onClick={() => handleRemoveGeneralItem(g.name, g.id)}
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add New Store Modal */}
        {newStoreModalOpen && (
          <Modal
            open={newStoreModalOpen}
            onClose={() => setNewStoreModalOpen(false)}
            title="Add New Store"
          >
            <form onSubmit={handleCreateNewStore} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FormField label="Store Name" required>
                <Input
                  placeholder="e.g. Costco, Coles, Chemist Warehouse"
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  autoFocus
                />
              </FormField>
              <FormField label="Store Icon">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: '1.6rem' }}>{newStoreIcon}</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {['🛒', '🏪', '🥦', '🥩', '💊', '🥖', '🏬', '🛍️', '🍎', '🐟'].map((emoji) => (
                      <Button
                        key={emoji}
                        variant={newStoreIcon === emoji ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => setNewStoreIcon(emoji)}
                        style={{
                          fontSize: '1.2rem',
                          padding: '4px 8px',
                          border: newStoreIcon === emoji ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
                        }}
                      >
                        {emoji}
                      </Button>
                    ))}
                  </div>
                </div>
              </FormField>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <Button variant="ghost" onClick={() => setNewStoreModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={!newStoreName.trim()}>
                  Save Store
                </Button>
              </div>
            </form>
          </Modal>
        )}
      </PageContainer>
      )}

      {/* ===================================================================
          3. MEAL LIBRARY & RECIPES
         =================================================================== */}
      {(subView === 'all' || subView === 'library') && (
        <PageContainer
          title="Meal Library & Recipes"
          icon="fas fa-book-open"
          iconClass="section-icon-library"
          badge={allLibraryRecipes.length}
          boxed={!isStandalonePage}
          actions={
            <Button
              variant="secondary"
              size="sm"
              icon={notionSyncing ? 'fas fa-spinner fa-spin' : 'fas fa-arrows-rotate'}
              onClick={(e) => {
                e.stopPropagation();
                handleSyncNotion();
              }}
              disabled={notionSyncing}
              title="Sync recipes directly from Notion database"
            >
              {notionSyncing ? 'Syncing...' : 'Sync from Notion'}
            </Button>
          }
        >

        {/* Meal Cards Grid */}
        <div className="shopping-ingredients-library" id="shopping-ingredients-library">
          {allLibraryRecipes.length === 0 ? (
            <div className="shopping-empty-msg" style={{ margin: '8px 0' }}>
              No meals in library yet. Sync from Notion or plan a custom meal above.
            </div>
          ) : (
            <div className="meal-card-grid">
              {allLibraryRecipes.map((recipe) => {
                const mealKey = recipe.meal_key;
                const fullRecipe = recipesRecord[mealKey];
                const rawItems = fullRecipe?.ingredients || ingredientsMap[mealKey] || [];
                const items: MealIngredient[] = Array.isArray(rawItems)
                  ? rawItems
                      .map((it: any) =>
                        typeof it === 'string'
                          ? { name: it, qty: '', store: '' }
                          : it && typeof it === 'object'
                          ? { name: it.name || '', qty: it.qty || '', store: it.store || '' }
                          : null
                      )
                      .filter(Boolean) as MealIngredient[]
                  : [];
                const imageUrl = recipe.image_url || mealImages[mealKey] || '';
                const displayName = recipe.title || mealKey;
                const isSynced = Boolean(fullRecipe?.notion_id);

                return (
                  <div
                    key={mealKey}
                    className="meal-card"
                    data-meal={mealKey}
                    onClick={() => handleOpenRecipeModal({ title: displayName, meal_key: mealKey })}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="meal-card-img-area">
                      <FallbackImage
                        src={imageUrl ? resolveAssetUrl(imageUrl) : ''}
                        alt={displayName}
                        className="meal-card-img"
                        fallbackEmoji={getMealEmoji(mealKey)}
                        fallbackIcon="fa-utensils"
                      />
                    </div>
                    <div className="meal-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <span className="meal-card-title" style={{ flex: 1, minWidth: 0 }}>{displayName}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        {isSynced ? (
                          <span
                            title="Synced from Notion (read-only)"
                            style={{
                              fontSize: '0.7rem',
                              color: '#c4b5fd',
                              background: 'rgba(167, 139, 250, 0.16)',
                              border: '1px solid rgba(167, 139, 250, 0.3)',
                              borderRadius: 'var(--radius-pill)',
                              padding: '1px 6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            <i className="fas fa-arrows-rotate" style={{ fontSize: '0.65rem' }} /> Notion
                          </span>
                        ) : !isChild ? (
                          <IconButton
                            size="sm"
                            variant="ghost"
                            icon="fas fa-pencil-alt"
                            aria-label="Edit recipe"
                            title="Edit manual recipe"
                            style={{ width: 26, height: 26 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditRecipeModal(
                                fullRecipe || {
                                  meal_key: mealKey,
                                  title: displayName,
                                  image_url: imageUrl || null,
                                  ingredients: items,
                                  instructions: '',
                                  servings: '4',
                                  prep_time: '25 mins',
                                }
                              );
                            }}
                          />
                        ) : null}
                      </div>
                    </div>
                    <div className="meal-card-ing-list">
                      {items.slice(0, 4).map((item: MealIngredient, idx: number) => {
                        const itemStore = item.store || '';
                        const storeObj = stores.find(
                          (s) =>
                            s &&
                            s.id &&
                            (s.id.toLowerCase() === itemStore.toLowerCase() ||
                              (s.name && s.name.toLowerCase() === itemStore.toLowerCase()))
                        );
                        return (
                          <div key={idx} className="meal-card-ing-row">
                            <span className="meal-card-ing-name">{item.name || 'Ingredient'}</span>
                            <span className="meal-card-ing-qty">{item.qty || ''}</span>
                            <span
                              className="shopping-lib-store-icon-badge meal-card-ing-store"
                              title={storeObj?.name || itemStore || 'Supermarket'}
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
                      {items.length === 0 && (
                        <div style={{ padding: '2px 8px', fontSize: '0.72rem', opacity: 0.5, fontStyle: 'italic' }}>
                          {recipe.prep_time || 'Tap to view recipe method'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PageContainer>
      )}

      {/* ===================================================================
          MODALS
         =================================================================== */}

      {/* 1. Add / Edit Meal Modal (Multi-day support!) */}
      <Modal
        open={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        title="Plan a Meal"
        icon="fas fa-calendar-plus"
        maxWidth={620}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
            <Button variant="ghost" size="sm" onClick={() => setPlanModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon="fas fa-check"
              onClick={handleSaveMealCard}
            >
              Save to Plan
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Meal Name Input + Recipe Thumbnail Preview */}
          <div ref={planComboboxRef} style={{ position: 'relative' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 4, display: 'block' }}>
              Meal Name (Search Library or type custom)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="text"
                  className="modern-input"
                  placeholder="Search meal library (e.g. Butter Chicken, Pizza) or type new meal…"
                  value={planMealTitle}
                  onChange={(e) => {
                    setPlanMealTitle(e.target.value);
                    setPlanComboboxOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setPlanComboboxOpen(false);
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (filteredPlanRecipes.length > 0 && planMealTitle.trim().toLowerCase() === filteredPlanRecipes[0].title.toLowerCase()) {
                        setPlanMealTitle(filteredPlanRecipes[0].title);
                        setPlanComboboxOpen(false);
                      } else {
                        setPlanComboboxOpen(false);
                      }
                    }
                  }}
                  style={{ paddingRight: planMealTitle ? 32 : 12 }}
                />
                {planMealTitle && (
                  <button
                    type="button"
                    onClick={() => {
                      setPlanMealTitle('');
                      setPlanComboboxOpen(false);
                    }}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'rgba(255,255,255,0.45)',
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      padding: 2,
                      lineHeight: 1,
                    }}
                    title="Clear meal title"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Recipe Thumbnail Preview on Right */}
              {(() => {
                const matchKey = planMealTitle.trim().toLowerCase();
                const matchedRecipe = recipesRecord[matchKey];
                const customImg = matchedRecipe?.image_url || mealImages[matchKey];
                return (
                  <div
                    style={{
                      width: 52,
                      height: 42,
                      borderRadius: 8,
                      overflow: 'hidden',
                      flexShrink: 0,
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      background: 'rgba(255, 255, 255, 0.04)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {customImg ? (
                      <FallbackImage
                        src={resolveAssetUrl(customImg)}
                        alt=""
                        fallbackEmoji={getMealEmoji(planMealTitle)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>{getMealEmoji(planMealTitle)}</span>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Combobox Dropdown */}
            {planComboboxOpen && (
              <div
                className="shopping-combobox-dropdown"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 62,
                  maxHeight: 220,
                  overflowY: 'auto',
                  zIndex: 10001,
                  marginTop: 4,
                  boxShadow: '0 12px 30px rgba(0,0,0,0.6)',
                }}
              >
                {filteredPlanRecipes.map((r) => (
                  <div
                    key={r.meal_key}
                    className="shopping-combobox-item"
                    onClick={() => {
                      setPlanMealTitle(r.title);
                      setPlanComboboxOpen(false);
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '1.2rem' }}>{getMealEmoji(r.meal_key)}</span>
                      <span style={{ fontWeight: 700 }}>{r.title}</span>
                    </div>
                    <span className="shopping-combobox-times">
                      {r.prep_time || 'recipe'} · {r.servings || '4 serv'}
                    </span>
                  </div>
                ))}
                {planMealTitle.trim() &&
                  !allLibraryRecipes.some(
                    (r) => r.title.toLowerCase() === planMealTitle.trim().toLowerCase()
                  ) && (
                    <div
                      className="shopping-combobox-item shopping-combobox-item-custom"
                      onClick={() => setPlanComboboxOpen(false)}
                    >
                      <span>+ Use custom meal &ldquo;{planMealTitle.trim()}&rdquo;</span>
                      <span className="shopping-combobox-times">custom</span>
                    </div>
                  )}
              </div>
            )}
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 6, display: 'block' }}>
              Audience
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Everyone', 'Kids', 'Adults'].map((aud) => {
                const active = planAudience === aud;
                return (
                  <button
                    key={aud}
                    type="button"
                    onClick={() => setPlanAudience(aud)}
                    style={{
                      padding: '7px 16px',
                      borderRadius: 999,
                      border: active ? '1.5px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                      background: active ? '#2563eb' : 'rgba(255, 255, 255, 0.06)',
                      color: active ? '#ffffff' : 'rgba(255, 255, 255, 0.75)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {aud === 'Everyone' ? '🌟 Everyone' : aud === 'Kids' ? '🧒 Kids' : '🧑 Adults'}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 6, display: 'block' }}>
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
              <span>
                Add meal ingredients to Shopping List
                {planSelectedDays.length > 0 && (() => {
                  const firstDate = planSelectedDays[0];
                  const diff = Math.round(
                    (new Date(`${firstDate}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24)
                  );
                  return diff > 7 ? ' (Future week — unchecked by default)' : '';
                })()}
              </span>
            </label>
          </div>
        </div>
      </Modal>

      {/* 2. Recipe View & Edit Modal */}
      <Modal
        open={Boolean(activeRecipe)}
        onClose={() => setActiveRecipe(null)}
        title={activeRecipe?.title || 'Recipe Details'}
        icon="fas fa-book-open"
        maxWidth={640}
        footer={
          activeRecipe ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <Button
                variant="primary"
                size="sm"
                icon="fas fa-cart-plus"
                onClick={() => handleAddRecipeIngredientsToShopping(activeRecipe)}
              >
                Add to Shopping List
              </Button>
              <div style={{ display: 'flex', gap: 8 }}>
                {!activeRecipe.notion_id && !isChild && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="fas fa-pencil-alt"
                    onClick={() => {
                      const recipeToEdit = activeRecipe;
                      setActiveRecipe(null);
                      handleOpenEditRecipeModal(recipeToEdit);
                    }}
                  >
                    Edit
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setActiveRecipe(null)}>
                  Close
                </Button>
              </div>
            </div>
          ) : undefined
        }
      >
        {activeRecipe && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {activeRecipe.image_url ? (
              <FallbackImage
                src={resolveAssetUrl(activeRecipe.image_url)}
                alt={activeRecipe.title}
                className="recipe-modal-img"
                fallbackEmoji={getMealEmoji(activeRecipe.meal_key || activeRecipe.title)}
                fallbackIcon="fa-utensils"
                style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 12, marginBottom: 12 }}
              />
            ) : null}
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
                      {ing.qty ? (
                        <span style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.88rem' }}>{ing.qty}</span>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <strong style={{ fontSize: '0.9rem', color: '#f8fafc' }}>Instructions / Method</strong>
              <div className="recipe-instructions-box">
                {activeRecipe.instructions || 'No instructions specified.'}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* 2b. Edit Recipe Modal (Manual recipes only) */}
      <Modal
        open={Boolean(editingRecipe)}
        onClose={() => setEditingRecipe(null)}
        title={editingRecipe?.title ? `Edit Recipe: ${editingRecipe.title}` : 'Edit Recipe'}
        icon="fas fa-pencil-alt"
        maxWidth={640}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
            <Button variant="ghost" size="sm" onClick={() => setEditingRecipe(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon="fas fa-check"
              onClick={handleSaveRecipeEdits}
            >
              Save Recipe
            </Button>
          </div>
        }
      >
        {editingRecipe && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Input
              label="Recipe Title"
              value={editRecipeTitle}
              onChange={(e) => setEditRecipeTitle(e.target.value)}
              placeholder="e.g. Spaghetti Bolognese"
              autoFocus
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input
                label="Prep Time"
                value={editRecipePrepTime}
                onChange={(e) => setEditRecipePrepTime(e.target.value)}
                placeholder="e.g. 25 mins"
              />
              <Input
                label="Servings"
                value={editRecipeServings}
                onChange={(e) => setEditRecipeServings(e.target.value)}
                placeholder="e.g. 4 servings"
              />
            </div>

            <div>
              <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 6, display: 'block' }}>
                Ingredients List ({editRecipeIngredients.length})
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto', marginBottom: 10 }}>
                {editRecipeIngredients.length === 0 ? (
                  <div style={{ fontSize: '0.82rem', opacity: 0.5, fontStyle: 'italic', padding: '6px 0' }}>
                    No ingredients added yet. Add some below.
                  </div>
                ) : (
                  editRecipeIngredients.map((ing, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        padding: '6px 10px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: 'var(--radius-sm, 8px)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                        <span style={{ fontSize: '0.86rem', color: '#f8fafc', fontWeight: 600 }}>{ing.name}</span>
                        {ing.qty && (
                          <span style={{ fontSize: '0.78rem', color: '#93c5fd', background: 'rgba(59, 130, 246, 0.15)', padding: '1px 6px', borderRadius: 4 }}>
                            {ing.qty}
                          </span>
                        )}
                        <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>{ing.store || 'aldi'}</span>
                      </div>
                      <IconButton
                        size="sm"
                        variant="ghost"
                        icon="fas fa-trash-alt"
                        aria-label="Remove ingredient"
                        title="Remove ingredient"
                        style={{ width: 26, height: 26, color: '#f87171' }}
                        onClick={() => {
                          setEditRecipeIngredients((prev) => prev.filter((_, i) => i !== idx));
                        }}
                      />
                    </div>
                  ))
                )}
              </div>

              {/* Add ingredient row */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 2 }}>
                  <Input
                    inputSize="sm"
                    placeholder="Ingredient name (e.g. Garlic)"
                    value={editNewIngName}
                    onChange={(e) => setEditNewIngName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (editNewIngName.trim()) {
                          setEditRecipeIngredients((prev) => [
                            ...prev,
                            { name: editNewIngName.trim(), qty: editNewIngQty.trim(), store: editNewIngStore || 'aldi' }
                          ]);
                          setEditNewIngName('');
                          setEditNewIngQty('');
                        }
                      }
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <Input
                    inputSize="sm"
                    placeholder="Qty (e.g. 2 cloves)"
                    value={editNewIngQty}
                    onChange={(e) => setEditNewIngQty(e.target.value)}
                  />
                </div>
                <div style={{ width: 110 }}>
                  <Select
                    value={editNewIngStore}
                    onChange={(e) => setEditNewIngStore(e.target.value)}
                    style={{ height: 32, fontSize: '0.82rem', padding: '0 8px' }}
                  >
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  icon="fas fa-plus"
                  onClick={() => {
                    if (editNewIngName.trim()) {
                      setEditRecipeIngredients((prev) => [
                        ...prev,
                        { name: editNewIngName.trim(), qty: editNewIngQty.trim(), store: editNewIngStore || 'aldi' }
                      ]);
                      setEditNewIngName('');
                      setEditNewIngQty('');
                    }
                  }}
                >
                  Add
                </Button>
              </div>
            </div>

            <Textarea
              label="Cooking Instructions / Method"
              rows={4}
              value={editRecipeInstructions}
              onChange={(e) => setEditRecipeInstructions(e.target.value)}
              placeholder="Step 1: Chop garlic and onion...&#10;Step 2: Sauté in olive oil..."
            />
          </div>
        )}
      </Modal>

      {/* 3. Frequently Added Modal */}
      <Modal
        open={frequentlyModalOpen}
        onClose={() => setFrequentlyModalOpen(false)}
        title="Frequently Added Staples"
        icon="fas fa-star"
        maxWidth={540}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFrequentlyModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon="fas fa-cart-plus"
              onClick={() => handleBatchAddFromKeys(selectedFrequentKeys, intel.frequently_added)}
            >
              Add Selected to Shopping List
            </Button>
          </div>
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
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSuggestedModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon="fas fa-cart-plus"
              onClick={() => handleBatchAddFromKeys(selectedSuggestedKeys, intel.suggested)}
            >
              Add Selected to Shopping List
            </Button>
          </div>
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
          <Button
            variant="ghost"
            onClick={() => setRecentlyPurchasedOpen(false)}
          >
            Close
          </Button>
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
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.88rem', color: '#f8fafc', fontWeight: 600 }}>{item.name}</div>
                  <div style={{ fontSize: '0.72rem', opacity: 0.5 }}>
                    {item.store} · {new Date(item.purchased_at).toLocaleDateString()}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  icon="fas fa-plus"
                  style={{ height: 28, fontSize: '0.75rem', padding: '0 10px' }}
                  onClick={() => handleSelectComboboxItem(item.name, item.store)}
                >
                  Re-add
                </Button>
              </div>
            ))
          )}
        </div>
      </Modal>
    </>
  );
};
