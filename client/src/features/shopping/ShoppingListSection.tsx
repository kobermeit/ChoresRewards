import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAppDispatch, useAppSelector } from '../../store';
import { pruneShoppingCheckedOverrides, setShoppingCheckedOverride } from '../../store/uiSlice';
import { apiPost } from '../../api';
import { ShoppingStore, ShoppingCatalogItem, MealIngredient } from '../../types';
import { PageContainer, Button, IconButton, CustomDropdown, WheelPickerOverlay } from '../../components/ui';
import { ShoppingStoreLane } from './components/ShoppingStoreLane';
import { NewStoreModal } from './components/NewStoreModal';
import { ShoppingHistoryModal } from './components/ShoppingHistoryModal';
import { ShoppingPopularModal } from './components/ShoppingPopularModal';
import { ShoppingSuggestedModal } from './components/ShoppingSuggestedModal';
import { ManageCatalogModal } from './components/ManageCatalogModal';

/** Shared empty fallback so a missing/repaired field never creates a new object identity each render. */
const EMPTY_CHECKS: Record<string, boolean> = {};

export interface ShoppingListSectionProps {
  isStandalonePage?: boolean;
}

export const ShoppingListSection: React.FC<ShoppingListSectionProps> = ({
  isStandalonePage = false,
}) => {
  const { data, refresh, showToast, confirm } = useApp();
  const dispatch = useAppDispatch();
  // Ticks are kept in the persisted ui slice so they survive navigation, reloads and offline restarts
  const optimisticChecked = useAppSelector(
    (state) => state.ui.shoppingCheckedOverrides || EMPTY_CHECKS
  );

  const [shoppingSearch, setShoppingSearch] = useState('');
  const [shoppingStore, setShoppingStore] = useState('');
  const [shoppingComboboxOpen, setShoppingComboboxOpen] = useState(false);
  const [hideChecked, setHideChecked] = useState(false);
  const [frequentlyModalOpen, setFrequentlyModalOpen] = useState(false);
  const [suggestedModalOpen, setSuggestedModalOpen] = useState(false);
  const [recentlyPurchasedOpen, setRecentlyPurchasedOpen] = useState(false);
  const [manageCatalogModalOpen, setManageCatalogModalOpen] = useState(false);
  const [newStoreModalOpen, setNewStoreModalOpen] = useState(false);
  const [quantityPickerTarget, setQuantityPickerTarget] = useState<{
    key: string;
    name: string;
    currentQty: number | string;
    onRemove?: () => void;
  } | null>(null);

  const comboboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setShoppingComboboxOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const shop = data?.shopping || data?.shopping_list;
  // Defensive: an older/partial bootstrap payload must not reach Object.entries() below.
  const serverShopChecked =
    shop?.checked && typeof shop.checked === 'object' ? shop.checked : undefined;

  // Once the server agrees with a local tick the override is redundant — drop it so
  // another device's later change is not masked forever.
  useEffect(() => {
    if (!serverShopChecked) return;
    dispatch(pruneShoppingCheckedOverrides(serverShopChecked));
  }, [serverShopChecked, dispatch]);

  const intel = data?.shopping_intelligence || shop?.intelligence || {
    suggested: [],
    frequently_added: [],
    recently_purchased: [],
    catalog: [],
  };

  const isMealActive = (mealKey: string): boolean => {
    if (!shop?.active) return false;
    if (Array.isArray(shop.active)) return shop.active.includes(mealKey);
    return Boolean((shop.active as Record<string, any>)[mealKey]);
  };

  const stores: ShoppingStore[] = useMemo(() => {
    return shop?.stores && shop.stores.length > 0
      ? shop.stores
      : [
          { id: 'aldi', name: 'Aldi', icon: '🛒' },
          { id: 'coles', name: 'Coles', icon: '🏪' },
          { id: 'woolies', name: 'Woolworths', icon: '🍎' },
        ];
  }, [shop?.stores]);

  const ingredientsMap: Record<string, any> = data?.meal_planner?.ingredients || data?.meal_ingredients || {};

  const plannedMealsMap = useMemo(() => {
    const planned: Record<string, string> = {};
    const plan = data?.meal_planner?.plan || {};
    const activeDates = new Set<string>();
    (data?.meal_planner?.week_days || []).forEach((d: any) => {
      if (d?.date_str) activeDates.add(d.date_str);
    });

    const todayStr = data?.current_date || new Date().toISOString().slice(0, 10);
    Object.entries(plan).forEach(([dateStr, daySlots]: [string, any]) => {
      // Only include today or upcoming dates (ignore past dates that have already occurred)
      if (dateStr < todayStr) return;
      if (activeDates.size > 0 && !activeDates.has(dateStr)) return;
      if (Array.isArray(daySlots)) {
        daySlots.forEach((c: any) => {
          const title = (c?.title || c?.name || '').trim();
          const mealKey = (c?.meal_key || title).toLowerCase().trim();
          if (mealKey) {
            planned[mealKey] = title || mealKey;
          }
        });
      } else if (daySlots && typeof daySlots === 'object') {
        ['breakfast', 'lunch', 'dinner'].forEach((k) => {
          const v = (daySlots[k] || '').trim();
          if (v) {
            planned[v.toLowerCase()] = v;
          }
        });
      }
    });
    return planned;
  }, [data?.meal_planner?.plan, data?.meal_planner?.week_days]);

  const catalogPool: ShoppingCatalogItem[] = useMemo(() => {
    if (intel.catalog && intel.catalog.length > 0) return intel.catalog;
    const items: Record<string, ShoppingCatalogItem> = {};
    (intel.frequently_added || []).forEach((f) => {
      items[f.normalized_key] = f;
    });
    (intel.suggested || []).forEach((s) => {
      if (!items[s.normalized_key]) items[s.normalized_key] = s;
    });
    return Object.values(items);
  }, [intel]);

  const filteredCatalog = useMemo(() => {
    const q = shoppingSearch.trim().toLowerCase();
    if (!q) return catalogPool.slice(0, 8);
    return catalogPool
      .filter((c) => c.name.toLowerCase().includes(q) || (c.default_store || '').toLowerCase().includes(q))
      .slice(0, 10);
  }, [catalogPool, shoppingSearch]);

  const storeItemsMap = useMemo(() => {
    const map: Record<string, Array<{ name: string; qty?: string }>> = {};
    const getItemName = (item: any): string => {
      if (typeof item === 'string') return item.trim();
      return (item?.name || item?.item_name || '').trim();
    };
    const getItemQty = (item: any): string => {
      if (typeof item === 'object' && item?.qty) return String(item.qty).trim();
      return '';
    };

    stores.forEach((store) => {
      const itemsByName = new Map<string, { name: string; qty?: string }>();
      (intel.catalog || []).forEach((c) => {
        if ((c.default_store || '').toLowerCase() === store.id.toLowerCase()) {
          const name = getItemName(c);
          if (name) itemsByName.set(name.toLowerCase(), { name, qty: '' });
        }
      });

      map[store.id] = Array.from(itemsByName.values()).sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      );
    });

    return map;
  }, [stores, intel]);

  const effectiveShopChecked = useMemo(() => {
    return { ...(shop?.checked || {}), ...optimisticChecked };
  }, [shop?.checked, optimisticChecked]);

  const totalShoppingItems = useMemo(() => {
    let count = 0;
    // 1. General items
    (shop?.general || []).forEach((g: any) => {
      const key = `general::${String(g.name).toLowerCase()}`;
      if (!g.checked && !effectiveShopChecked[key]) count++;
    });

    // 2. Meal ingredients for active planned meals only
    Object.entries(ingredientsMap).forEach(([mealKey, ings]) => {
      const isPlannedOrActive =
        Boolean(plannedMealsMap[mealKey.toLowerCase()]) || isMealActive(mealKey);
      if (isPlannedOrActive) {
        const ingList: MealIngredient[] = Array.isArray(ings)
          ? ings
          : ings && typeof ings === 'object'
          ? Object.values(ings)
          : [];
        ingList.forEach((ing) => {
          const key = `meal::${mealKey.toLowerCase()}::${ing.name.toLowerCase()}`;
          if (!effectiveShopChecked[key] && !shop?.hidden?.[key]) count++;
        });
      }
    });
    return count;
  }, [ingredientsMap, plannedMealsMap, shop, effectiveShopChecked]);

  const handleSelectComboboxItem = async (itemName: string, preferredStore?: string) => {
    const trimmed = itemName.trim();
    if (!trimmed) return;
    setShoppingSearch('');
    setShoppingComboboxOpen(false);
    try {
      const storeToUse = shoppingStore || preferredStore || stores[0]?.id || 'aldi';
      await apiPost('add_general_shopping_item', {
        name: trimmed,
        qty: '',
        store: storeToUse,
      });
      const storeName = stores.find((s) => s.id === storeToUse)?.name || storeToUse;
      showToast(`Added "${trimmed}" to ${storeName}`);
      await refresh();
    } catch (err: any) {
      showToast(err?.message || 'Failed to add item', { type: 'error' });
    }
  };

  const handleQuickAddStoreItem = async (storeId: string, itemName: string) => {
    if (!itemName) return;
    const storeItems = storeItemsMap[storeId] || [];
    const item = storeItems.find((i) => i.name === itemName);
    const qty = item?.qty || '';
    try {
      await apiPost('add_general_shopping_item', {
        name: itemName,
        qty: qty,
        store: storeId,
      });
      const storeName = stores.find((s) => s.id === storeId)?.name || storeId;
      showToast(`Added "${itemName}"${qty ? ` (${qty})` : ''} to ${storeName}`);
      await refresh();
    } catch (err: any) {
      showToast(err?.message || 'Failed to add item', { type: 'error' });
    }
  };

  const handleToggleShopCheck = async (itemKey: string, currentChecked: boolean) => {
    const nextState = !currentChecked;
    // Optimistic instantaneous UI update (0ms lag, works offline, survives navigation)
    dispatch(setShoppingCheckedOverride({ key: itemKey, checked: nextState }));
    try {
      await apiPost('update_shopping_item', {
        key: itemKey,
        checked: nextState,
      });
      await refresh();
    } catch {
      // Revert if explicitly rejected by the server
      dispatch(setShoppingCheckedOverride({ key: itemKey, checked: currentChecked }));
    }
  };

  const handleUpdateQuantity = async (key: string, qtyVal: string) => {
    try {
      await apiPost('update_shopping_item', { key, qty: qtyVal });
      await refresh();
    } catch {
      // ignore
    }
  };

  const handleRemoveGeneralItem = async (itemName: string, itemId?: string) => {
    await apiPost('remove_shopping_item', {
      id: itemId,
      name: itemName,
      source: 'general',
    });
    await refresh();
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

  const handleSaveNewStore = async (store: { id: string; name: string; icon: string }) => {
    const nextStores = [...stores, store];
    await apiPost('save_shopping_stores', { stores: nextStores });
    setShoppingStore(store.id);
    showToast(`Added store "${store.name}"`, { type: 'success' });
    await refresh();
  };

  const handleBatchAddPool = async (keysRecord: Record<string, boolean>, pool: ShoppingCatalogItem[]) => {
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
      await refresh();
    } catch (err: any) {
      showToast(err?.message || 'Failed to batch add items', { type: 'error' });
    }
  };

  return (
    <PageContainer
      className="shopping-page-container"
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
          collapseOnMobile
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
            title="Add popular staples"
          >
            <span className="shopping-btn-label">Popular ({intel.frequently_added?.length || 0})</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon="fas fa-lightbulb"
            className="shopping-toolbar-btn shopping-toolbar-btn-suggested"
            onClick={() => setSuggestedModalOpen(true)}
            title="Suggested restock based on purchase frequency"
          >
            <span className="shopping-btn-label">Suggested ({intel.suggested?.length || 0})</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon="fas fa-clock-rotate-left"
            className="shopping-toolbar-btn shopping-toolbar-btn-history"
            onClick={() => setRecentlyPurchasedOpen(true)}
            title="View purchased history"
          >
            <span className="shopping-btn-label">History</span>
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
          <CustomDropdown
            value={shoppingStore || stores[0]?.id || ''}
            onChange={(val) => {
              if (val === '__add_new_store__') {
                setNewStoreModalOpen(true);
              } else {
                setShoppingStore(val);
              }
            }}
            options={[
              ...stores.map((s) => ({ value: s.id, label: s.name, icon: s.icon })),
              { value: '__add_new_store__', label: '+ Add store…', action: true },
            ]}
            showFilter={false}
            height={38}
            className="shopping-store-dropdown"
            style={{ flex: '0 0 auto', width: 170, minWidth: 140 }}
            ariaLabel="Select store"
          />
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
              Boolean(plannedMealsMap[mealKey.toLowerCase()]) || isMealActive(mealKey);
            const ingList: MealIngredient[] = Array.isArray(ings)
              ? ings
              : ings && typeof ings === 'object'
              ? Object.values(ings)
              : [];
            return (
              isPlannedOrActive &&
              ingList.some(
                (i: MealIngredient) =>
                  ((i.store || '').toLowerCase() === store.id.toLowerCase() ||
                  (i.store || '').toLowerCase() === store.name.toLowerCase()) &&
                  !shop?.hidden?.[`meal::${mealKey.toLowerCase()}::${i.name.toLowerCase()}`]
              )
            );
          });

          const storeGeneral = (shop?.general || []).filter(
            (g) =>
              (g.store || '').toLowerCase() === store.id.toLowerCase() ||
              (g.store || '').toLowerCase() === store.name.toLowerCase()
          );

          return (
            <ShoppingStoreLane
              key={store.id}
              store={store}
              storesCount={stores.length}
              mealGroups={mealGroupsForStore}
              plannedMealsMap={plannedMealsMap}
              generalItems={storeGeneral}
              shopChecked={effectiveShopChecked}
              shopQuantities={(shop as any)?.quantities}
              hideChecked={hideChecked}
              storeQuickItems={storeItemsMap[store.id] || []}
              onDeleteStore={handleDeleteStore}
              onQuickAdd={handleQuickAddStoreItem}
              onToggleCheck={handleToggleShopCheck}
              onOpenQuantityPicker={setQuantityPickerTarget}
              onRemoveGeneralItem={handleRemoveGeneralItem}
            />
          );
        })}
      </div>

      <NewStoreModal
        open={newStoreModalOpen}
        onClose={() => setNewStoreModalOpen(false)}
        stores={stores}
        onSaveStore={handleSaveNewStore}
      />

      <ShoppingHistoryModal
        open={recentlyPurchasedOpen}
        onClose={() => setRecentlyPurchasedOpen(false)}
        history={intel.recently_purchased || []}
        onReAdd={handleSelectComboboxItem}
        onOpenManageCatalog={() => {
          setRecentlyPurchasedOpen(false);
          setManageCatalogModalOpen(true);
        }}
      />

      <ManageCatalogModal
        open={manageCatalogModalOpen}
        onClose={() => setManageCatalogModalOpen(false)}
        catalog={intel.catalog || []}
      />

      <ShoppingPopularModal
        open={frequentlyModalOpen}
        onClose={() => setFrequentlyModalOpen(false)}
        frequentlyAdded={intel.frequently_added || []}
        onBatchAdd={(keys) => handleBatchAddPool(keys, intel.frequently_added || [])}
      />

      <ShoppingSuggestedModal
        open={suggestedModalOpen}
        onClose={() => setSuggestedModalOpen(false)}
        suggested={intel.suggested || []}
        onBatchAdd={(keys) => handleBatchAddPool(keys, intel.suggested || [])}
      />

      {quantityPickerTarget && (
        <WheelPickerOverlay
          open={Boolean(quantityPickerTarget)}
          onClose={() => setQuantityPickerTarget(null)}
          value={quantityPickerTarget.currentQty}
          min={0}
          max={15}
          showZeroAsTrash={true}
          onSelect={(n) => {
            if (quantityPickerTarget) {
              if (n === 0) {
                if (quantityPickerTarget.onRemove) {
                  quantityPickerTarget.onRemove();
                }
              } else {
                handleUpdateQuantity(quantityPickerTarget.key, String(n));
              }
            }
          }}
        />
      )}
    </PageContainer>
  );
};

export default ShoppingListSection;
