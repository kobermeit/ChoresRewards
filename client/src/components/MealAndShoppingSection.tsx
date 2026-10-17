import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { apiPost, resolveAssetUrl } from '../api';
import { MealIngredient, ShoppingStore } from '../types';

const MEAL_SLOTS: Array<{ key: 'breakfast' | 'lunch' | 'dinner'; label: string; icon: string }> = [
  { key: 'breakfast', label: 'Breakfast', icon: '🥣' },
  { key: 'lunch', label: 'Lunch', icon: '🥪' },
  { key: 'dinner', label: 'Dinner', icon: '🍽️' },
];

export const MealAndShoppingSection: React.FC = () => {
  const { data, refresh, showToast } = useApp();

  // Meal slot editor modal
  const [editingSlot, setEditingSlot] = useState<{
    dateIso: string;
    dayLabel: string;
    slot: 'breakfast' | 'lunch' | 'dinner';
    value: string;
    recurring: boolean;
  } | null>(null);

  // Swap mode
  const [swapSource, setSwapSource] = useState<{ date_iso: string; slot: 'breakfast' | 'lunch' | 'dinner' } | null>(null);

  // Shopping list add item state
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('');
  const [newItemStore, setNewItemStore] = useState('');
  const [showStoreManager, setShowStoreManager] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreIcon, setNewStoreIcon] = useState('🛒');

  // Meal Library state
  const [newMealName, setNewMealName] = useState('');
  const [selectedMealForEdit, setSelectedMealForEdit] = useState<string | null>(null);
  const [mealIngredientsDraft, setMealIngredientsDraft] = useState<MealIngredient[]>([]);
  const [ingName, setIngName] = useState('');
  const [ingQty, setIngQty] = useState('');
  const [ingStore, setIngStore] = useState('General');
  const [mealImageUrlDraft, setMealImageUrlDraft] = useState('');

  if (!data) return null;

  const mp = data.meal_planner;
  const shop = data.shopping;
  const weekDays = mp?.week_days || [];
  const plan = mp?.plan || {};
  const recurringMap = mp?.recurring || {};
  const suggestions = mp?.suggestions || [];
  const ingredientsMap = mp?.ingredients || {};
  const mealImages = mp?.images || {};
  const stores: ShoppingStore[] = shop?.stores?.length
    ? shop.stores
    : [
        { id: 'general', name: 'General', icon: '🛒' },
        { id: 'supermarket', name: 'Supermarket', icon: '🏪' },
      ];

  // Open slot editor
  const handleSlotClick = (dateIso: string, dayLabel: string, slot: 'breakfast' | 'lunch' | 'dinner') => {
    if (swapSource) {
      if (swapSource.date_iso === dateIso && swapSource.slot === slot) {
        setSwapSource(null);
        return;
      }
      apiPost('swap_meal_slots', {
        source_date: swapSource.date_iso,
        source_slot: swapSource.slot,
        target_date: dateIso,
        target_slot: slot,
      })
        .then(() => {
          showToast('Swapped meal slots!');
          setSwapSource(null);
          refresh();
        })
        .catch(() => setSwapSource(null));
      return;
    }

    const currentVal = plan[dateIso]?.[slot] || '';
    const dayObj = weekDays.find((d) => d.date_iso === dateIso);
    const weekdayKey = dayObj?.day_short?.toLowerCase() || '';
    const isRec = Boolean(recurringMap[weekdayKey]?.[slot]?.enabled);

    setEditingSlot({
      dateIso,
      dayLabel,
      slot,
      value: currentVal,
      recurring: isRec,
    });
  };

  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlot) return;
    try {
      await apiPost('save_meal_plan', {
        week_start: mp.week_start,
        date_iso: editingSlot.dateIso,
        slot: editingSlot.slot,
        value: editingSlot.value.trim(),
        recurring: editingSlot.recurring,
      });
      setEditingSlot(null);
      showToast('Meal plan updated');
      await refresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to save meal slot', { type: 'error' });
    }
  };

  // Build combined shopping items (from planned meals + general items)
  const plannedMealNames = new Set<string>();
  Object.values(plan).forEach((daySlots) => {
    if (!daySlots) return;
    ['breakfast', 'lunch', 'dinner'].forEach((s) => {
      const val = (daySlots as any)[s]?.trim();
      if (val) plannedMealNames.add(val);
    });
  });

  interface CombinedShopItem {
    key: string;
    name: string;
    qty: string;
    store: string;
    checked: boolean;
    source: 'meal' | 'general';
    mealName?: string;
    generalId?: string;
  }

  const combinedItems: CombinedShopItem[] = [];
  plannedMealNames.forEach((mealName) => {
    const ings = ingredientsMap[mealName] || [];
    ings.forEach((ing) => {
      const itemKey = `meal::${mealName}::${ing.name}`;
      if (shop?.hidden?.[itemKey]) return;
      combinedItems.push({
        key: itemKey,
        name: ing.name,
        qty: ing.qty || '',
        store: ing.store || stores[0]?.name || 'General',
        checked: Boolean(shop?.checked?.[itemKey]),
        source: 'meal',
        mealName,
      });
    });
  });

  (shop?.general || []).forEach((g, idx) => {
    const itemKey = g.id || `gen::${g.name}::${idx}`;
    combinedItems.push({
      key: itemKey,
      name: g.name,
      qty: g.qty || '',
      store: g.store || stores[0]?.name || 'General',
      checked: Boolean(g.checked || shop?.checked?.[itemKey]),
      source: 'general',
      generalId: g.id,
    });
  });

  const handleAddShoppingItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    try {
      await apiPost('add_general_shopping_item', {
        name: newItemName.trim(),
        qty: newItemQty.trim(),
        store: newItemStore || stores[0]?.name || 'General',
      });
      setNewItemName('');
      setNewItemQty('');
      await refresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to add shopping item', { type: 'error' });
    }
  };

  const handleToggleShopItem = async (item: CombinedShopItem) => {
    try {
      await apiPost('update_shopping_item', {
        key: item.key,
        id: item.generalId,
        name: item.name,
        checked: !item.checked,
      });
      await refresh();
    } catch {
      // ignore
    }
  };

  const handleRemoveShopItem = async (item: CombinedShopItem) => {
    try {
      await apiPost('remove_shopping_item', {
        key: item.key,
        id: item.generalId,
        name: item.name,
        source: item.source,
      });
      await refresh();
    } catch {
      // ignore
    }
  };

  const handleClearCheckedShopping = async () => {
    try {
      await apiPost('clear_shopping_checked', {});
      showToast('Cleared checked shopping items');
      await refresh();
    } catch {
      // ignore
    }
  };

  const handleAddStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoreName.trim()) return;
    const nextStores = [
      ...stores,
      {
        id: newStoreName.trim().toLowerCase().replace(/\s+/g, '_'),
        name: newStoreName.trim(),
        icon: newStoreIcon || '🛒',
      },
    ];
    await apiPost('save_shopping_stores', { stores: nextStores });
    setNewStoreName('');
    await refresh();
  };

  const handleDeleteStore = async (storeId: string) => {
    const nextStores = stores.filter((s) => s.id !== storeId);
    await apiPost('save_shopping_stores', { stores: nextStores });
    await refresh();
  };

  // Meal Library handlers
  const handleAddMealSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMealName.trim()) return;
    try {
      await apiPost('add_meal_suggestion', { meal: newMealName.trim() });
      setNewMealName('');
      showToast(`Added "${newMealName.trim()}" to Meal Library`);
      await refresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to add meal', { type: 'error' });
    }
  };

  const handleDeleteMealSuggestion = async (meal: string) => {
    try {
      await apiPost('delete_meal_suggestion', { meal });
      showToast(`Removed "${meal}" from Meal Library`);
      await refresh();
    } catch {
      // ignore
    }
  };

  const openMealIngredientsEditor = (meal: string) => {
    setSelectedMealForEdit(meal);
    setMealIngredientsDraft([...(ingredientsMap[meal] || [])]);
    setMealImageUrlDraft(mealImages[meal] || '');
  };

  const handleSaveMealDetails = async () => {
    if (!selectedMealForEdit) return;
    try {
      await apiPost('save_meal_ingredients', {
        meal: selectedMealForEdit,
        ingredients: mealIngredientsDraft,
      });
      if (mealImageUrlDraft !== (mealImages[selectedMealForEdit] || '')) {
        await apiPost('upload_meal_image', {
          meal: selectedMealForEdit,
          image_url: mealImageUrlDraft.trim(),
        });
      }
      setSelectedMealForEdit(null);
      showToast(`Saved recipe details for "${selectedMealForEdit}"`);
      await refresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to save meal details', { type: 'error' });
    }
  };

  return (
    <>
      {/* ===================================================================
          1. WEEKLY MEAL PLANNER
         =================================================================== */}
      <section className="section-heading" id="meal-planner-section" style={{ marginTop: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2>🍽️ Weekly Meal Planner</h2>
            <p className="section-subtitle">
              Click any meal slot to edit or choose from your Meal Library. Ingredients automatically sync to your Shopping List!
            </p>
          </div>
          {swapSource && (
            <button
              type="button"
              onClick={() => setSwapSource(null)}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                background: 'rgba(245,158,11,0.2)',
                color: '#fbbf24',
                border: '1px solid #fbbf24',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              🔄 Swapping {swapSource.slot} ({swapSource.date_iso}) — Click target or Cancel
            </button>
          )}
        </div>
      </section>

      <div
        className="meal-planner-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
          gap: 12,
        }}
      >
        {weekDays.map((day) => {
          const isToday = day.date_iso === data.current_date;
          const daySlots = plan[day.date_iso] || { breakfast: '', lunch: '', dinner: '' };

          return (
            <div
              key={day.date_iso}
              className="card"
              style={{
                padding: 14,
                borderRadius: 16,
                border: isToday ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                background: isToday ? 'rgba(59,130,246,0.1)' : undefined,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 10,
                  paddingBottom: 6,
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <span style={{ fontWeight: 800, fontSize: '1rem' }}>{day.day_full}</span>
                <span style={{ fontSize: '0.78rem', opacity: 0.7 }}>{day.date_label}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {MEAL_SLOTS.map((s) => {
                  const val = daySlots[s.key] || '';
                  const img = val ? mealImages[val] : null;
                  const isSwapSelected = swapSource?.date_iso === day.date_iso && swapSource?.slot === s.key;

                  return (
                    <div
                      key={s.key}
                      onClick={() => handleSlotClick(day.date_iso, day.day_full, s.key)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 10,
                        background: isSwapSelected
                          ? 'rgba(245,158,11,0.25)'
                          : val
                            ? 'rgba(255,255,255,0.07)'
                            : 'rgba(255,255,255,0.03)',
                        border: isSwapSelected
                          ? '1px solid #fbbf24'
                          : val
                            ? '1px solid rgba(255,255,255,0.14)'
                            : '1px dashed rgba(255,255,255,0.12)',
                        cursor: 'pointer',
                        position: 'relative',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', opacity: 0.7, fontWeight: 700, textTransform: 'uppercase' }}>
                          {s.icon} {s.label}
                        </span>
                        {val && (
                          <button
                            type="button"
                            title="Swap this meal with another slot"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSwapSource({ date_iso: day.date_iso, slot: s.key });
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'inherit',
                              opacity: 0.6,
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              padding: 2,
                            }}
                          >
                            ⇄
                          </button>
                        )}
                      </div>

                      {img && (
                        <img
                          src={resolveAssetUrl(img)}
                          alt={val}
                          style={{
                            width: '100%',
                            height: 56,
                            objectFit: 'cover',
                            borderRadius: 6,
                            marginTop: 4,
                          }}
                        />
                      )}

                      <div
                        style={{
                          marginTop: 4,
                          fontWeight: val ? 700 : 400,
                          fontSize: '0.9rem',
                          opacity: val ? 1 : 0.45,
                        }}
                      >
                        {val || '+ Add meal'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ===================================================================
          2. SHOPPING LIST
         =================================================================== */}
      <section className="section-heading" id="shopping-list-section" style={{ marginTop: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2>🛒 Shopping List</h2>
            <p className="section-subtitle">Grouped by store — combines meal ingredients and household items.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setShowStoreManager((prev) => !prev)}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.08)',
                color: 'inherit',
                border: '1px solid rgba(255,255,255,0.14)',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              🏪 Manage Stores
            </button>
            <button
              type="button"
              onClick={handleClearCheckedShopping}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                background: 'rgba(239,68,68,0.15)',
                color: '#f87171',
                border: '1px solid rgba(239,68,68,0.35)',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              🧹 Clear Checked
            </button>
          </div>
        </div>
      </section>

      {showStoreManager && (
        <div className="card" style={{ padding: 16, borderRadius: 14, marginBottom: 16 }}>
          <h4 style={{ marginTop: 0, marginBottom: 10 }}>🏪 Shopping Stores</h4>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {stores.map((s) => (
              <span
                key={s.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.08)',
                  fontSize: '0.88rem',
                }}
              >
                {s.icon} {s.name}
                {stores.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteStore(s.id)}
                    style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                )}
              </span>
            ))}
          </div>
          <form onSubmit={handleAddStore} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="text"
              value={newStoreIcon}
              onChange={(e) => setNewStoreIcon(e.target.value)}
              style={{ width: 54, textAlign: 'center', padding: 8, borderRadius: 8 }}
            />
            <input
              type="text"
              placeholder="New store name (e.g. Aldi, Costco)..."
              value={newStoreName}
              onChange={(e) => setNewStoreName(e.target.value)}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 8 }}
            />
            <button type="submit" className="btn-primary" style={{ padding: '8px 16px', borderRadius: 8 }}>
              + Add Store
            </button>
          </form>
        </div>
      )}

      {/* Quick Add Shopping Item */}
      <form
        onSubmit={handleAddShoppingItem}
        className="card"
        style={{
          padding: 14,
          borderRadius: 14,
          marginBottom: 16,
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <input
          type="text"
          placeholder="Add item to shopping list (e.g. Milk, Bread)..."
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          style={{ flex: 2, minWidth: 180, padding: '10px 12px', borderRadius: 10 }}
        />
        <input
          type="text"
          placeholder="Qty (optional)"
          value={newItemQty}
          onChange={(e) => setNewItemQty(e.target.value)}
          style={{ width: 120, padding: '10px 12px', borderRadius: 10 }}
        />
        <select
          value={newItemStore || stores[0]?.name || 'General'}
          onChange={(e) => setNewItemStore(e.target.value)}
          style={{ padding: '10px 12px', borderRadius: 10 }}
        >
          {stores.map((s) => (
            <option key={s.id} value={s.name}>
              {s.icon} {s.name}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-primary" style={{ padding: '10px 20px', borderRadius: 10, fontWeight: 700 }}>
          + Add Item
        </button>
      </form>

      {/* Store Columns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 14,
        }}
      >
        {stores.map((store) => {
          const storeItems = combinedItems.filter(
            (i) => i.store.toLowerCase() === store.name.toLowerCase()
          );
          return (
            <div key={store.id} className="card" style={{ padding: 16, borderRadius: 16 }}>
              <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: '1.05rem' }}>
                {store.icon} {store.name}{' '}
                <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>({storeItems.length})</span>
              </h3>
              {storeItems.length === 0 ? (
                <div style={{ fontSize: '0.85rem', opacity: 0.5, fontStyle: 'italic' }}>No items for {store.name}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {storeItems.map((item) => (
                    <div
                      key={item.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        padding: '8px 10px',
                        borderRadius: 10,
                        background: 'rgba(255,255,255,0.05)',
                        opacity: item.checked ? 0.55 : 1,
                      }}
                    >
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          cursor: 'pointer',
                          flex: 1,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => handleToggleShopItem(item)}
                        />
                        <span style={{ textDecoration: item.checked ? 'line-through' : 'none', fontWeight: 600 }}>
                          {item.name}
                          {item.qty && (
                            <span style={{ opacity: 0.7, fontWeight: 400, marginLeft: 6 }}>({item.qty})</span>
                          )}
                        </span>
                      </label>
                      {item.mealName && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '2px 6px',
                            borderRadius: 6,
                            background: 'rgba(59,130,246,0.2)',
                            color: '#93c5fd',
                          }}
                        >
                          🍽️ {item.mealName}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveShopItem(item)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#f87171',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ===================================================================
          3. MEAL LIBRARY
         =================================================================== */}
      <section className="section-heading" id="meal-library-section" style={{ marginTop: 36 }}>
        <h2>📖 Family Meal Library</h2>
        <p className="section-subtitle">Save favourite family meals and their ingredients for 1-click meal planning.</p>
      </section>

      <div className="card" style={{ padding: 20, borderRadius: 16 }}>
        <form onSubmit={handleAddMealSuggestion} style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          <input
            type="text"
            placeholder="Add a meal to library (e.g. Spaghetti Bolognese, Tacos)..."
            value={newMealName}
            onChange={(e) => setNewMealName(e.target.value)}
            style={{ flex: 1, padding: '10px 14px', borderRadius: 10 }}
          />
          <button type="submit" className="btn-primary" style={{ padding: '10px 20px', borderRadius: 10, fontWeight: 700 }}>
            + Add Meal
          </button>
        </form>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {suggestions.map((meal) => {
            const ings = ingredientsMap[meal] || [];
            const img = mealImages[meal];
            return (
              <div
                key={meal}
                style={{
                  borderRadius: 14,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  {img && (
                    <img
                      src={resolveAssetUrl(img)}
                      alt={meal}
                      style={{ width: '100%', height: 110, objectFit: 'cover' }}
                    />
                  )}
                  <div style={{ padding: 12 }}>
                    <div style={{ fontWeight: 800, fontSize: '1rem' }}>{meal}</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: 4 }}>
                      🥕 {ings.length} ingredient{ings.length === 1 ? '' : 's'}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: '8px 12px',
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => openMealIngredientsEditor(meal)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#60a5fa',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                    }}
                  >
                    ✏️ Ingredients & Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteMealSuggestion(meal)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#f87171',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Meal Slot Modal */}
      {editingSlot && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setEditingSlot(null)}
        >
          <div
            className="card"
            style={{ maxWidth: 460, width: '100%', padding: 24, borderRadius: 18 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>
              🍽️ {editingSlot.dayLabel} — {editingSlot.slot.toUpperCase()}
            </h3>
            <form onSubmit={handleSaveSlot} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="text"
                placeholder="What's on the menu?"
                value={editingSlot.value}
                onChange={(e) => setEditingSlot({ ...editingSlot, value: e.target.value })}
                autoFocus
                style={{ padding: '10px 14px', borderRadius: 10 }}
              />

              {suggestions.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.78rem', opacity: 0.75, marginBottom: 6 }}>Quick pick from Meal Library:</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxHeight: 140, overflowY: 'auto' }}>
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setEditingSlot({ ...editingSlot, value: s })}
                        style={{
                          padding: '5px 10px',
                          borderRadius: 999,
                          border: '1px solid rgba(255,255,255,0.16)',
                          background:
                            editingSlot.value === s ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.06)',
                          color: 'inherit',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={editingSlot.recurring}
                  onChange={(e) => setEditingSlot({ ...editingSlot, recurring: e.target.checked })}
                />
                📌 Repeat every {editingSlot.dayLabel}
              </label>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setEditingSlot({ ...editingSlot, value: '' })}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 10,
                    background: 'rgba(239,68,68,0.18)',
                    color: '#f87171',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Clear Slot
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setEditingSlot(null)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 10,
                      background: 'rgba(255,255,255,0.08)',
                      color: 'inherit',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ padding: '8px 18px', borderRadius: 10, fontWeight: 700 }}
                  >
                    Save
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Meal Library Ingredients & Image Modal */}
      {selectedMealForEdit && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setSelectedMealForEdit(null)}
        >
          <div
            className="card"
            style={{ maxWidth: 520, width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: 24, borderRadius: 18 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>📖 {selectedMealForEdit} — Ingredients & Photo</h3>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.82rem', opacity: 0.8, marginBottom: 4 }}>
                Photo URL (optional)
              </label>
              <input
                type="text"
                placeholder="https://..."
                value={mealImageUrlDraft}
                onChange={(e) => setMealImageUrlDraft(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8 }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '0.82rem', opacity: 0.8, marginBottom: 6 }}>
                Ingredients ({mealIngredientsDraft.length})
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                {mealIngredientsDraft.map((ing, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 10px',
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.06)',
                    }}
                  >
                    <span>
                      <strong>{ing.name}</strong> {ing.qty && `(${ing.qty})`} — <em>{ing.store}</em>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setMealIngredientsDraft((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Ingredient name"
                  value={ingName}
                  onChange={(e) => setIngName(e.target.value)}
                  style={{ flex: 2, padding: '8px 10px', borderRadius: 8 }}
                />
                <input
                  type="text"
                  placeholder="Qty"
                  value={ingQty}
                  onChange={(e) => setIngQty(e.target.value)}
                  style={{ width: 80, padding: '8px 10px', borderRadius: 8 }}
                />
                <select
                  value={ingStore}
                  onChange={(e) => setIngStore(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: 8 }}
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (!ingName.trim()) return;
                    setMealIngredientsDraft((prev) => [
                      ...prev,
                      { name: ingName.trim(), qty: ingQty.trim(), store: ingStore || 'General' },
                    ]);
                    setIngName('');
                    setIngQty('');
                  }}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'rgba(59,130,246,0.25)',
                    color: '#60a5fa',
                    border: 'none',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  + Add
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setSelectedMealForEdit(null)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.08)',
                  color: 'inherit',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveMealDetails}
                className="btn-primary"
                style={{ padding: '8px 18px', borderRadius: 10, fontWeight: 700 }}
              >
                Save Recipe
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
