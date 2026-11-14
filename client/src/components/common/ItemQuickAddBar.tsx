import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Button } from '../ui';
import { CustomDropdown } from '../ui/CustomDropdown';
import { ShoppingStore, ShoppingCatalogItem } from '../../types';

export function getCleanStoreName(storeId?: string, storeList?: ShoppingStore[]): string {
  if (!storeId) return 'Aldi';
  const id = storeId.toLowerCase().trim();
  const found = (storeList || []).find(
    (s) => s.id.toLowerCase() === id || s.name.toLowerCase() === id
  );
  if (found) return found.name;
  // Clean fallback e.g. fruit-an-vege-4537 -> Fruit An Vege
  const clean = id.replace(/[-_]\d+$/, '').replace(/[-_]+/g, ' ');
  return clean.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function parseQuickAddInput(input: string): { qty: string; name: string } {
  const trimmed = input.trim();
  if (!trimmed) return { qty: '1', name: '' };
  const qMatch = trimmed.match(
    /^((?:(?:\d+\s+)?[¼½¾⅓⅔⅛⅜⅝⅞]|\d+\s+\d+\/\d+|\d+(?:[\/.]\d+)?|\.\d+)\s*(?:g|kg|ml|l|oz|lb|cups?|tbsp?|tbs?|tablespoons?|teaspoons?|cloves?|cans?|tins?|pkts?|packets?|punnets?|pinch(?:es)?|bunch(?:es)?|slices?|stalks?|heads?)?)\s+(.*)$/i
  );
  if (qMatch && qMatch[1] && qMatch[2]) {
    return { qty: qMatch[1].trim(), name: qMatch[2].trim() };
  }
  return { qty: '1', name: trimmed };
}

export interface ItemQuickAddBarProps {
  placeholder?: string;
  buttonLabel?: string;
  selectedStore?: string;
  onStoreChange?: (storeId: string) => void;
  stores?: ShoppingStore[];
  onAdd: (item: { name: string; qty: string; store: string; isStaple?: boolean }) => void;
  onAddNewStore?: () => void;
  className?: string;
}

export const ItemQuickAddBar: React.FC<ItemQuickAddBarProps> = ({
  placeholder = 'Search staples (e.g. Paper Towel, Milk, Bread) or type new item…',
  buttonLabel = 'Add Item',
  selectedStore: controlledStore,
  onStoreChange,
  stores: propStores,
  onAdd,
  onAddNewStore,
  className = '',
}) => {
  const { data } = useApp();
  const [search, setSearch] = useState('');
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [internalStore, setInternalStore] = useState('');

  const comboboxRef = useRef<HTMLDivElement>(null);

  const stores: ShoppingStore[] = useMemo(() => {
    if (propStores && propStores.length > 0) return propStores;
    const s = data?.shopping?.stores || data?.shopping_list?.stores;
    if (s && s.length > 0) return s;
    return [
      { id: 'aldi', name: 'Aldi', icon: '🛒' },
      { id: 'coles', name: 'Coles', icon: '🏪' },
      { id: 'woolies', name: 'Woolworths', icon: '🍎' },
    ];
  }, [propStores, data?.shopping?.stores, data?.shopping_list?.stores]);

  const activeStore = controlledStore !== undefined ? controlledStore : (internalStore || stores[0]?.id || 'aldi');

  const handleSetStore = (newStore: string) => {
    if (onStoreChange) onStoreChange(newStore);
    else setInternalStore(newStore);
  };

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setComboboxOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const intel = (data?.shopping_intelligence ||
    data?.shopping?.intelligence ||
    (data as any)?.shopping_list?.intelligence || {
      catalog: [],
      frequently_added: [],
      suggested: [],
    }) as any;

  const catalogPool: ShoppingCatalogItem[] = useMemo(() => {
    if (intel.catalog && intel.catalog.length > 0) return intel.catalog;
    const items: Record<string, ShoppingCatalogItem> = {};
    (intel.frequently_added || []).forEach((f: any) => {
      const key = (f.normalized_key || f.name || '').toLowerCase();
      if (key) items[key] = f;
    });
    (intel.suggested || []).forEach((s: any) => {
      const key = (s.normalized_key || s.name || '').toLowerCase();
      if (key && !items[key]) items[key] = s;
    });
    return Object.values(items);
  }, [intel]);

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalogPool.slice(0, 8);
    const parsed = parseQuickAddInput(q);
    const qName = (parsed.name || q).toLowerCase();
    return catalogPool
      .filter((c) => c.name.toLowerCase().includes(qName) || (c.default_store || '').toLowerCase().includes(qName))
      .slice(0, 10);
  }, [catalogPool, search]);

  const handleSelectItem = (item: ShoppingCatalogItem) => {
    const parsed = parseQuickAddInput(search);
    const qtyToUse = parsed.qty || '1';
    const storeToUse = item.default_store || activeStore || 'aldi';
    onAdd({
      name: item.name,
      qty: qtyToUse,
      store: storeToUse,
      isStaple: Boolean(item.is_staple),
    });
    setSearch('');
    setComboboxOpen(false);
  };

  const handleAddTyped = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const parsed = parseQuickAddInput(trimmed);
    const finalName = parsed.name || trimmed;
    const finalQty = parsed.qty || '1';

    const matched = catalogPool.find(
      (c) => c.name.toLowerCase() === finalName.toLowerCase()
    );

    const storeToUse = matched?.default_store || activeStore || 'aldi';
    onAdd({
      name: matched?.name || finalName,
      qty: finalQty,
      store: storeToUse,
      isStaple: Boolean(matched?.is_staple),
    });
    setSearch('');
    setComboboxOpen(false);
  };

  return (
    <div className={`shopping-manage-block ${className}`} style={{ margin: '8px 0 12px 0' }}>
      <div className="shopping-add-row" style={{ position: 'relative' }}>
        <div className="shopping-combobox-wrap" ref={comboboxRef}>
          <input
            type="text"
            className="modern-input"
            placeholder={placeholder}
            value={search}
            onFocus={() => setComboboxOpen(true)}
            onChange={(e) => {
              setSearch(e.target.value);
              setComboboxOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (
                  filteredCatalog.length > 0 &&
                  search.trim().toLowerCase() === filteredCatalog[0].name.toLowerCase()
                ) {
                  handleSelectItem(filteredCatalog[0]);
                } else if (search.trim()) {
                  handleAddTyped(search);
                }
              } else if (e.key === 'Escape') {
                setComboboxOpen(false);
              }
            }}
          />
          {comboboxOpen && (
            <div className="shopping-combobox-dropdown">
              {filteredCatalog.map((item) => (
                <div
                  key={item.normalized_key || item.name}
                  className="shopping-combobox-item"
                  onClick={() => handleSelectItem(item)}
                >
                  <span style={{ fontWeight: 600 }}>{item.name}</span>
                  <span className="shopping-combobox-times">
                    {getCleanStoreName(item.default_store, stores)}
                  </span>
                </div>
              ))}
              {search.trim() &&
                !catalogPool.some(
                  (c) => c.name.toLowerCase() === (parseQuickAddInput(search).name || search).trim().toLowerCase()
                ) && (
                  <div
                    className="shopping-combobox-item shopping-combobox-item-custom"
                    onClick={() => handleAddTyped(search)}
                  >
                    <span>+ Add &ldquo;{search.trim()}&rdquo;</span>
                    <span className="shopping-combobox-times">new item</span>
                  </div>
                )}
            </div>
          )}
        </div>
        <CustomDropdown
          value={activeStore}
          onChange={(val) => {
            if (val === '__add_new_store__') {
              if (onAddNewStore) onAddNewStore();
            } else {
              handleSetStore(val);
            }
          }}
          options={[
            ...stores.map((s) => ({ value: s.id, label: s.name, icon: s.icon })),
            ...(onAddNewStore ? [{ value: '__add_new_store__', label: '+ Add store…', action: true }] : []),
          ]}
          showFilter={false}
          height={38}
          className="shopping-store-dropdown"
          style={{ flex: '0 0 auto', width: 160, minWidth: 130 }}
          ariaLabel="Select store"
        />
        <Button
          variant="primary"
          size="md"
          icon="fas fa-plus"
          className="shopping-add-btn"
          onClick={() => {
            if (search.trim()) {
              handleAddTyped(search);
            }
          }}
        >
          {buttonLabel}
        </Button>
      </div>
    </div>
  );
};

export default ItemQuickAddBar;
