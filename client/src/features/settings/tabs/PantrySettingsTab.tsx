import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../../../context/AppContext';
import { apiGet, apiPost } from '../../../api';
import { Button, Input } from '../../../components/ui';

export const PantrySettingsTab: React.FC = () => {
  const { data, refresh, showToast } = useApp();
  const [items, setItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSuggestionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const loadPantry = async () => {
    try {
      setLoading(true);
      const res = await apiGet<{ success: boolean; items: string[] }>('pantry');
      if (res?.success && Array.isArray(res.items)) {
        setItems(res.items);
      } else if (Array.isArray(data?.shopping?.pantry)) {
        setItems(data.shopping.pantry);
      }
    } catch {
      if (Array.isArray(data?.shopping?.pantry)) {
        setItems(data.shopping.pantry);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPantry();
  }, [data?.shopping?.pantry]);

  const intel = (data?.shopping_intelligence ||
    data?.shopping?.intelligence ||
    (data as any)?.shopping_list?.intelligence || {
      catalog: [],
    }) as any;

  const catalogPool: Array<{ name: string; default_store?: string; times_added?: number }> = useMemo(() => {
    if (intel.catalog && intel.catalog.length > 0) {
      return intel.catalog;
    }
    return [];
  }, [intel]);

  const suggestedCatalog = useMemo(() => {
    const q = newItem.trim().toLowerCase();
    const existing = new Set(items.map((i) => i.toLowerCase()));
    if (!q) {
      return catalogPool.filter((c) => !existing.has(c.name.toLowerCase())).slice(0, 8);
    }
    return catalogPool
      .filter((c) => c.name.toLowerCase().includes(q) && !existing.has(c.name.toLowerCase()))
      .slice(0, 8);
  }, [catalogPool, newItem, items]);

  const handleAddStaple = async (nameToAdd: string) => {
    const clean = nameToAdd.trim();
    if (!clean) return;

    if (items.some((it) => it.toLowerCase() === clean.toLowerCase())) {
      showToast(`"${clean}" is already in your Pantry.`, { type: 'warning' });
      setNewItem('');
      setSuggestionsOpen(false);
      return;
    }

    try {
      setSaving(true);
      const res = await apiPost<{ success: boolean; item?: any }>('pantry/add', { name: clean });
      if (res.success) {
        setItems((prev) => [...prev, clean].sort((a, b) => a.localeCompare(b)));
        setNewItem('');
        setSuggestionsOpen(false);
        showToast(`Added "${clean}" to Pantry staples!`);
        await refresh();
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to add pantry staple', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveStaple = async (target: string) => {
    try {
      setSaving(true);
      await apiPost('pantry/toggle', { name: target });
      setItems((prev) => prev.filter((it) => it.toLowerCase() !== target.toLowerCase()));
      showToast(`Removed "${target}" from Pantry`);
      await refresh();
    } catch (err: any) {
      showToast(err?.message || 'Failed to remove pantry item', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 680, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fas fa-box-archive" style={{ color: '#38bdf8' }} />
          Pantry Staples & Always-In-Stock Items
        </h3>
        <p style={{ margin: 0, fontSize: '0.84rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.45 }}>
          Items your household always keeps on hand or grows in the garden (e.g. olive oil, salt, black pepper, water, fresh herbs).
          When recipes or meals are planned, these ingredients are automatically recognized as <strong>In Stock</strong> and excluded
          from your shopping list so they never clutter your grocery runs.
        </p>
      </div>

      {/* Add New Item with Autocomplete */}
      <div style={{ position: 'relative' }} ref={containerRef}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAddStaple(newItem);
          }}
          style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}
        >
          <div style={{ flex: 1, position: 'relative' }}>
            <Input
              label="Add Pantry Item"
              placeholder="Search catalog or type staple (e.g. Olive oil, Sea salt, Rosemary)…"
              value={newItem}
              onChange={(e) => {
                setNewItem(e.target.value);
                setSuggestionsOpen(true);
              }}
              onFocus={() => setSuggestionsOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setSuggestionsOpen(false);
              }}
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            icon="fas fa-plus"
            disabled={!newItem.trim() || saving}
            style={{ height: 42, whiteSpace: 'nowrap' }}
          >
            Add to Pantry
          </Button>
        </form>

        {suggestionsOpen && suggestedCatalog.length > 0 && (
          <div
            className="shopping-combobox-dropdown"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 140,
              maxHeight: 220,
              overflowY: 'auto',
              zIndex: 10001,
              marginTop: 4,
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            }}
          >
            {suggestedCatalog.map((c) => (
              <div
                key={c.name}
                className="shopping-combobox-item"
                style={{
                  padding: '7px 12px',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleAddStaple(c.name);
                }}
              >
                <span style={{ fontWeight: 600, color: '#f8fafc' }}>{c.name}</span>
                <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                  {c.default_store || 'catalog'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chips Container */}
      <div
        style={{
          padding: 16,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 'var(--radius-md, 10px)',
          minHeight: 120,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Current Pantry Staples ({items.length})
          </span>
          {saving && (
            <span style={{ fontSize: '0.75rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="fas fa-spinner fa-spin" /> Saving...
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', opacity: 0.6, fontSize: '0.85rem' }}>
            <i className="fas fa-spinner fa-spin" style={{ marginRight: 8 }} /> Loading pantry list...
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', opacity: 0.5, fontStyle: 'italic', fontSize: '0.86rem' }}>
            No pantry items configured yet. Add basic staples above.
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {items.map((item) => (
              <div
                key={item}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 10px',
                  borderRadius: 20,
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  color: '#e0f2fe',
                  fontSize: '0.86rem',
                  fontWeight: 500,
                }}
              >
                <span>⭐ {item}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveStaple(item)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#93c5fd',
                    cursor: 'pointer',
                    padding: '0 2px',
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '0.78rem',
                    lineHeight: 1,
                  }}
                  title={`Remove "${item}" from pantry`}
                  aria-label={`Remove "${item}" from pantry`}
                >
                  <i className="fas fa-times" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PantrySettingsTab;
