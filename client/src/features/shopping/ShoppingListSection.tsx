import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAppDispatch, useAppSelector } from '../../store';
import { pruneShoppingCheckedOverrides, setShoppingCheckedOverride } from '../../store/uiSlice';
import { apiPost } from '../../api';
import { ShoppingStore, ShoppingCatalogItem } from '../../types';
import { PageContainer, Button, IconButton, WheelPickerOverlay } from '../../components/ui';
import { ItemQuickAddBar } from '../../components/common/ItemQuickAddBar';
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

  const [shoppingStore, setShoppingStore] = useState('');
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

  const stores: ShoppingStore[] = useMemo(() => {
    return shop?.stores && shop.stores.length > 0
      ? shop.stores
      : [
          { id: 'aldi', name: 'Aldi', icon: '🛒' },
          { id: 'coles', name: 'Coles', icon: '🏪' },
          { id: 'woolies', name: 'Woolworths', icon: '🍎' },
        ];
  }, [shop?.stores]);

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
    (shop?.general || []).forEach((g: any) => {
      const key = `general::${String(g.name).toLowerCase()}`;
      if (!g.checked && !effectiveShopChecked[key]) count++;
    });
    return count;
  }, [shop, effectiveShopChecked]);

  const handleSelectComboboxItem = async (itemName: string, preferredStore?: string, qty?: string) => {
    const trimmed = itemName.trim();
    if (!trimmed) return;
    try {
      const storeToUse = shoppingStore || preferredStore || stores[0]?.id || 'aldi';
      await apiPost('add_general_shopping_item', {
        name: trimmed,
        qty: qty || '',
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
      <ItemQuickAddBar
        placeholder="Search staples (e.g. Paper Towel, Milk, Bread) or type new item…"
        buttonLabel="Add Item"
        stores={stores}
        selectedStore={shoppingStore || stores[0]?.id || ''}
        onStoreChange={(s) => setShoppingStore(s)}
        onAddNewStore={() => setNewStoreModalOpen(true)}
        onAdd={({ name, qty, store }) => handleSelectComboboxItem(name, store, qty)}
      />

      {/* Stores Columns */}
      <div className="shopping-stores-row" id="shopping-stores-row">
        {stores.map((store) => {
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
