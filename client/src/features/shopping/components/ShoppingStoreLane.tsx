import React, { memo } from 'react';
import { IconButton } from '../../../components/ui';
import { MealIngredient, ShoppingStore } from '../../../types';
import { getMealEmoji, renderStoreIcon } from '../../meals/mealUtils';
import { LaneQuickAddDropdown } from './LaneQuickAddDropdown';

export interface ShoppingStoreLaneProps {
  store: ShoppingStore;
  storesCount: number;
  mealGroups: Array<[string, MealIngredient[]]>;
  plannedMealsMap: Record<string, string>;
  generalItems: any[];
  shopChecked?: Record<string, boolean>;
  shopQuantities?: Record<string, any>;
  hideChecked: boolean;
  storeQuickItems: Array<{ name: string; qty?: string }>;
  onDeleteStore: (store: ShoppingStore) => void;
  onQuickAdd: (storeId: string, itemName: string) => void;
  onToggleCheck: (itemKey: string, currentChecked: boolean) => void;
  onOpenQuantityPicker: (target: {
    key: string;
    name: string;
    currentQty: string | number;
    onRemove?: () => void;
  }) => void;
  onRemoveGeneralItem: (name: string, id?: string) => void;
}

export const ShoppingStoreLane: React.FC<ShoppingStoreLaneProps> = memo(({
  store,
  storesCount,
  mealGroups,
  plannedMealsMap,
  generalItems,
  shopChecked = {},
  shopQuantities = {},
  hideChecked,
  storeQuickItems,
  onDeleteStore,
  onQuickAdd,
  onToggleCheck,
  onOpenQuantityPicker,
  onRemoveGeneralItem,
}) => {
  let uncheckedCount = 0;
  mealGroups.forEach(([mealKey, allIngs]) => {
    const ingList: MealIngredient[] = Array.isArray(allIngs)
      ? allIngs
      : allIngs && typeof allIngs === 'object'
      ? Object.values(allIngs)
      : [];
    ingList
      .filter(
        (i: MealIngredient) =>
          (i.store || '').toLowerCase() === store.id.toLowerCase() ||
          (i.store || '').toLowerCase() === store.name.toLowerCase()
      )
      .forEach((ing: MealIngredient) => {
        const key = `meal::${mealKey}::${ing.name.toLowerCase()}`;
        if (!shopChecked[key]) uncheckedCount++;
      });
  });
  generalItems.forEach((g) => {
    const key = `general::${g.name.toLowerCase()}`;
    if (!g.checked && !shopChecked[key]) uncheckedCount++;
  });

  return (
    <div className="shopping-store-col" data-store={store.id}>
      <div className="shopping-store-header">
        <span className="shopping-store-icon shopping-store-icon-btn">
          {renderStoreIcon(store.icon)}
        </span>
        <span className="shopping-store-name">{store.name}</span>
        {storesCount > 1 && (
          <IconButton
            size="sm"
            variant="ghost"
            icon="fas fa-trash"
            className="shopping-store-delete-btn"
            title="Delete store"
            aria-label="Delete store"
            onClick={() => onDeleteStore(store)}
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

      {/* In-lane Quick Add Dropdown */}
      <div className="shopping-lane-quick-add">
        <LaneQuickAddDropdown
          storeId={store.id}
          storeName={store.name}
          items={storeQuickItems}
          onSelect={(itemName) => onQuickAdd(store.id, itemName)}
        />
      </div>

      <div className="shopping-store-items">
        {mealGroups.length > 0 && (
          <div className="shopping-meal-groups-grid">
            {mealGroups.map(([mealKey, allIngs]) => {
              const ingList: MealIngredient[] = Array.isArray(allIngs)
                ? allIngs
                : allIngs && typeof allIngs === 'object'
                ? Object.values(allIngs)
                : [];
              const storeIngs = ingList.filter(
                (i: MealIngredient) =>
                  (i.store || '').toLowerCase() === store.id.toLowerCase() ||
                  (i.store || '').toLowerCase() === store.name.toLowerCase()
              );
              const isPlanned = Boolean(plannedMealsMap[mealKey.toLowerCase()]);
              const displayName =
                plannedMealsMap[mealKey.toLowerCase()] ||
                mealKey.charAt(0).toUpperCase() + mealKey.slice(1);

              const visibleIngs = hideChecked
                ? storeIngs.filter((ing) => {
                    const itemKey = `meal::${mealKey}::${ing.name.toLowerCase()}`;
                    return !shopChecked[itemKey];
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
                    const checked = Boolean(shopChecked[itemKey]);
                    const savedQty = shopQuantities[itemKey];
                    const numericQty =
                      savedQty !== undefined
                        ? savedQty
                        : /^\d+$/.test(String(ing.qty || '').trim())
                        ? String(ing.qty).trim()
                        : '1';

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
                            onChange={() => onToggleCheck(itemKey, checked)}
                          />
                          <button
                            type="button"
                            className="shopping-item-qty-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              onOpenQuantityPicker({
                                key: itemKey,
                                name: ing.name,
                                currentQty: numericQty,
                                onRemove: undefined,
                              });
                            }}
                            title="Change quantity"
                            aria-label={`Change quantity for ${ing.name}`}
                          >
                            {numericQty}×
                          </button>
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

        {generalItems.length === 0 && mealGroups.length === 0 ? (
          <div className="shopping-empty-msg" style={{ padding: '8px 4px', fontSize: '0.82rem', opacity: 0.6 }}>
            No items yet.
          </div>
        ) : (
          generalItems.map((g) => {
            const itemKey = `general::${g.name.toLowerCase()}`;
            const checked = Boolean(g.checked || shopChecked[itemKey]);
            if (hideChecked && checked) return null;
            const savedQty = shopQuantities[itemKey] || g.qty;
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
                    onChange={() => onToggleCheck(itemKey, checked)}
                  />
                  <button
                    type="button"
                    className="shopping-item-qty-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onOpenQuantityPicker({
                        key: itemKey,
                        name: g.name,
                        currentQty: numericQty,
                        onRemove: () => onRemoveGeneralItem(g.name, g.id),
                      });
                    }}
                    title="Change quantity"
                    aria-label={`Change quantity for ${g.name}`}
                  >
                    {numericQty}×
                  </button>
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
                  onClick={() => onRemoveGeneralItem(g.name, g.id)}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});

ShoppingStoreLane.displayName = 'ShoppingStoreLane';
