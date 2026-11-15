import React, { useState, useMemo } from 'react';
import { Modal } from '../../../components/common/Modal';
import { Button, IconButton, Badge, Select } from '../../../components/ui';
import { ShoppingCatalogItem, ShoppingStore } from '../../../types';
import { apiPost } from '../../../api';
import { useApp } from '../../../context/AppContext';
import { renderStoreIcon } from '../../meals/mealUtils';

export interface ManageCatalogModalProps {
  open: boolean;
  onClose: () => void;
  catalog: ShoppingCatalogItem[];
  onDeleted?: () => void;
}

export const ManageCatalogModal: React.FC<ManageCatalogModalProps> = ({
  open,
  onClose,
  catalog,
  onDeleted,
}) => {
  const { data, showToast, confirm, refresh } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [storeFilter, setStoreFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'staples' | 'non-staples'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [sortField, setSortField] = useState<'name' | 'store' | 'staple' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);

  const handleSort = (field: 'name' | 'store' | 'staple') => {
    if (sortField !== field) {
      setSortField(field);
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else if (sortDirection === 'desc') {
      setSortField(null);
      setSortDirection(null);
    } else {
      setSortDirection('asc');
    }
  };

  const stores: ShoppingStore[] = useMemo(() => {
    return (data?.shopping?.stores || data?.shopping_list?.stores || []) as ShoppingStore[];
  }, [data?.shopping?.stores, data?.shopping_list?.stores]);

  const storeMap = useMemo(() => {
    const map: Record<string, { name: string; icon?: string }> = {};
    stores.forEach((s) => {
      map[s.id.toLowerCase()] = { name: s.name, icon: s.icon };
    });
    return map;
  }, [stores]);

  const getStoreDisplay = (storeId?: string) => {
    const id = (storeId || 'aldi').toLowerCase();
    if (storeMap[id]) {
      return { name: storeMap[id].name, icon: storeMap[id].icon || '🛒' };
    }
    // Clean friendly fallback for old slugs e.g. fruit-an-vege-4537 -> Fruit An Vege
    const clean = id.replace(/[-_]\d+$/, '').replace(/[-_]+/g, ' ');
    const words = clean.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1));
    return { name: words.join(' '), icon: '🏪' };
  };

  const filteredCatalog = useMemo(() => {
    let list = catalog;
    if (storeFilter !== 'all') {
      list = list.filter(
        (item) => (item.default_store || 'aldi').toLowerCase() === storeFilter.toLowerCase()
      );
    }
    if (statusFilter === 'staples') {
      list = list.filter((item) => Boolean(item.is_staple));
    } else if (statusFilter === 'non-staples') {
      list = list.filter((item) => !item.is_staple);
    }
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          (item.default_store || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [catalog, searchTerm, storeFilter, statusFilter]);

  const sortedCatalog = useMemo(() => {
    if (!sortField || !sortDirection) return filteredCatalog;
    const factor = sortDirection === 'asc' ? 1 : -1;
    return [...filteredCatalog].sort((a, b) => {
      if (sortField === 'name') {
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) * factor;
      }
      if (sortField === 'store') {
        const sa = (a.default_store || 'aldi').toLowerCase();
        const sb = (b.default_store || 'aldi').toLowerCase();
        return sa.localeCompare(sb) * factor;
      }
      if (sortField === 'staple') {
        const va = a.is_staple ? 1 : 0;
        const vb = b.is_staple ? 1 : 0;
        return (va - vb) * factor;
      }
      return 0;
    });
  }, [filteredCatalog, sortField, sortDirection]);

  const allFilteredSelected =
    sortedCatalog.length > 0 &&
    sortedCatalog.every((it) => selectedIds.has(it.id));

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      const next = new Set(selectedIds);
      sortedCatalog.forEach((it) => next.add(it.id));
      setSelectedIds(next);
    }
  };

  const handleToggleItem = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleToggleStaple = async (item: ShoppingCatalogItem) => {
    try {
      await apiPost('shopping/catalog/toggle_staple', { id: item.id });
      showToast(
        `${item.is_staple ? 'Removed' : 'Marked'} "${item.name}" ${
          item.is_staple ? 'from' : 'as'
        } pantry staple`,
        { type: 'success' }
      );
      await refresh();
    } catch (err: any) {
      showToast(err?.message || 'Failed to update staple status', { type: 'error' });
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    const ok = await confirm({
      title: `Delete ${count} item${count > 1 ? 's' : ''}?`,
      message: `Permanently delete ${count} item${
        count > 1 ? 's' : ''
      } from the shopping catalog? They will not appear in suggestions or history.`,
      confirmText: 'Delete Permanently',
      danger: true,
    });
    if (!ok) return;

    try {
      setIsDeleting(true);
      await apiPost('shopping/catalog/delete', { ids: Array.from(selectedIds) });
      showToast(`Deleted ${count} item${count > 1 ? 's' : ''} from catalog`);
      setSelectedIds(new Set());
      if (onDeleted) onDeleted();
      await refresh();
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete items', { type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteSingle = async (item: ShoppingCatalogItem) => {
    const ok = await confirm({
      title: `Delete "${item.name}"?`,
      message: `Permanently delete "${item.name}" from the catalog?`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;

    try {
      await apiPost('shopping/catalog/delete', { ids: [item.id] });
      showToast(`Deleted "${item.name}" from catalog`);
      const next = new Set(selectedIds);
      next.delete(item.id);
      setSelectedIds(next);
      if (onDeleted) onDeleted();
      await refresh();
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete item', { type: 'error' });
    }
  };

  const formatLastDate = (isoStr: string | null | undefined) => {
    if (!isoStr) return null;
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return null;
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Manage Shopping Catalog & Staples"
      icon="fas fa-boxes-stacked"
      maxWidth={780}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 10 }}>
          <span style={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.6)' }}>
            {selectedIds.size > 0
              ? `${selectedIds.size} item${selectedIds.size > 1 ? 's' : ''} selected`
              : `${sortedCatalog.length} item${sortedCatalog.length === 1 ? '' : 's'} (${catalog.length} total)`}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button variant="ghost" onClick={onClose}>
              Done
            </Button>
            <Button
              variant="danger"
              icon="fas fa-trash"
              disabled={selectedIds.size === 0 || isDeleting}
              isLoading={isDeleting}
              onClick={handleDeleteSelected}
            >
              Delete Selected ({selectedIds.size})
            </Button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ margin: 0, fontSize: '0.84rem', color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>
          Toggle pantry staples (always in stock), view purchase history, or remove obsolete items so they never reappear in history or smart suggestions.
        </p>

        {/* Filter Input, Store Filter & Status Filter Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 180px', minWidth: 160 }}>
            <input
              type="text"
              className="cr-input"
              placeholder="Search catalog..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: 34, height: 36, fontSize: '0.88rem' }}
            />
            <i
              className="fas fa-magnifying-glass"
              style={{
                position: 'absolute',
                left: 11,
                top: '50%',
                transform: 'translateY(-50%)',
                opacity: 0.45,
                fontSize: '0.82rem',
              }}
            />
          </div>

          {/* Status Pill Toggle: All | ⭐ Staples | Non-Staples */}
          <div
            style={{
              display: 'inline-flex',
              background: 'rgba(0, 0, 0, 0.4)',
              padding: '3px',
              borderRadius: 'var(--radius-md, 8px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              gap: '3px',
            }}
          >
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              style={{
                border: 'none',
                background: statusFilter === 'all' ? 'var(--color-primary, #3b82f6)' : 'transparent',
                color: statusFilter === 'all' ? '#ffffff' : 'rgba(255, 255, 255, 0.65)',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: statusFilter === 'all' ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('staples')}
              style={{
                border: 'none',
                background: statusFilter === 'staples' ? 'var(--color-primary, #3b82f6)' : 'transparent',
                color: statusFilter === 'staples' ? '#ffffff' : 'rgba(255, 255, 255, 0.65)',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: statusFilter === 'staples' ? 600 : 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s ease',
              }}
            >
              <span>⭐</span> Staples
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('non-staples')}
              style={{
                border: 'none',
                background: statusFilter === 'non-staples' ? 'var(--color-primary, #3b82f6)' : 'transparent',
                color: statusFilter === 'non-staples' ? '#ffffff' : 'rgba(255, 255, 255, 0.65)',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: statusFilter === 'non-staples' ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Non-Staples
            </button>
          </div>

          <div style={{ width: 140 }}>
            <Select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              options={[
                { value: 'all', label: 'All Stores' },
                ...stores.map((s) => ({ value: s.id, label: `${s.icon || '🏪'} ${s.name}` })),
              ]}
              style={{ height: 36, fontSize: '0.82rem' }}
            />
          </div>

          <Button
            size="sm"
            variant="secondary"
            onClick={handleToggleSelectAll}
            style={{ height: 36, fontSize: '0.8rem', whiteSpace: 'nowrap' }}
          >
            {allFilteredSelected ? 'Deselect All' : 'Select All'}
          </Button>
        </div>

        {/* Catalog Table with Sticky Sortable Headers */}
        <div
          style={{
            maxHeight: 400,
            overflowY: 'auto',
            borderRadius: 'var(--radius-md, 8px)',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(0,0,0,0.25)',
          }}
        >
          {/* Sticky Table Header with 3-State Clickable Sorting */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              background: 'rgba(15, 23, 42, 0.95)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              position: 'sticky',
              top: 0,
              zIndex: 2,
              fontSize: '0.72rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'rgba(255, 255, 255, 0.55)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={handleToggleSelectAll}
                style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#3b82f6', flexShrink: 0 }}
                title={allFilteredSelected ? 'Deselect All' : 'Select All'}
              />
              <button
                type="button"
                onClick={() => handleSort('name')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: sortField === 'name' ? '#60a5fa' : 'inherit',
                  fontSize: 'inherit',
                  fontWeight: 'inherit',
                  letterSpacing: 'inherit',
                  textTransform: 'inherit',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
                title="Sort by item name (A-Z -> Z-A -> Default)"
              >
                <span>Item Name & History</span>
                <i
                  className={
                    sortField === 'name'
                      ? sortDirection === 'asc'
                        ? 'fas fa-sort-up'
                        : 'fas fa-sort-down'
                      : 'fas fa-sort'
                  }
                  style={{ opacity: sortField === 'name' ? 1 : 0.4 }}
                />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => handleSort('staple')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: sortField === 'staple' ? '#60a5fa' : 'inherit',
                  fontSize: 'inherit',
                  fontWeight: 'inherit',
                  letterSpacing: 'inherit',
                  textTransform: 'inherit',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  width: 90,
                  justifyContent: 'center',
                }}
                title="Sort by pantry staple status"
              >
                <span>Staple</span>
                <i
                  className={
                    sortField === 'staple'
                      ? sortDirection === 'asc'
                        ? 'fas fa-sort-up'
                        : 'fas fa-sort-down'
                      : 'fas fa-sort'
                  }
                  style={{ opacity: sortField === 'staple' ? 1 : 0.4 }}
                />
              </button>

              <button
                type="button"
                onClick={() => handleSort('store')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: sortField === 'store' ? '#60a5fa' : 'inherit',
                  fontSize: 'inherit',
                  fontWeight: 'inherit',
                  letterSpacing: 'inherit',
                  textTransform: 'inherit',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  minWidth: 80,
                  justifyContent: 'center',
                }}
                title="Sort by store"
              >
                <span>Store</span>
                <i
                  className={
                    sortField === 'store'
                      ? sortDirection === 'asc'
                        ? 'fas fa-sort-up'
                        : 'fas fa-sort-down'
                      : 'fas fa-sort'
                  }
                  style={{ opacity: sortField === 'store' ? 1 : 0.4 }}
                />
              </button>

              <span style={{ width: 28 }}></span>
            </div>
          </div>

          {sortedCatalog.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', opacity: 0.5, fontSize: '0.88rem' }}>
              {searchTerm || storeFilter !== 'all' || statusFilter !== 'all'
                ? 'No items matched your filters.'
                : 'Catalog is currently empty.'}
            </div>
          ) : (
            sortedCatalog.map((item) => {
              const isSelected = selectedIds.has(item.id);
              const storeInfo = getStoreDisplay(item.default_store);
              const lastBoughtLabel = formatLastDate(item.last_purchased_at);
              const lastAddedLabel = formatLastDate(item.last_added_at);

              return (
                <div
                  key={item.id}
                  onClick={() => handleToggleItem(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    background: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                    cursor: 'pointer',
                    gap: 12,
                    transition: 'background 0.12s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleItem(item.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#3b82f6', flexShrink: 0 }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.9rem',
                          fontWeight: 600,
                          color: '#f8fafc',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.name}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.48)', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 1 }}>
                        <span>Added: {item.times_added || 1}×</span>
                        <span>Bought: {item.times_purchased || 0}×</span>
                        {item.avg_interval_days ? (
                          <span style={{ color: '#93c5fd' }}>Every ~{Math.round(item.avg_interval_days)}d</span>
                        ) : (
                          <span style={{ opacity: 0.45 }}>No cycle yet</span>
                        )}
                        {lastBoughtLabel ? (
                          <span>
                            Last: {lastBoughtLabel}
                            {item.days_since_last !== null && item.days_since_last !== undefined
                              ? ` (${item.days_since_last}d ago)`
                              : ''}
                          </span>
                        ) : lastAddedLabel ? (
                          <span>Added: {lastAddedLabel}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    {/* Interactive 1-click Staple Toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggleStaple(item)}
                      style={{
                        border: item.is_staple
                          ? '1px solid rgba(245, 158, 11, 0.45)'
                          : '1px solid rgba(255, 255, 255, 0.12)',
                        background: item.is_staple
                          ? 'rgba(245, 158, 11, 0.18)'
                          : 'rgba(255, 255, 255, 0.05)',
                        color: item.is_staple ? '#fcd34d' : '#94a3b8',
                        borderRadius: 999,
                        padding: '3px 10px',
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        transition: 'all 0.15s ease',
                      }}
                      title={
                        item.is_staple
                          ? 'Pantry staple (in stock). Click to remove staple status'
                          : 'Click to mark as pantry staple (always in stock)'
                      }
                    >
                      <i
                        className={item.is_staple ? 'fas fa-star' : 'far fa-star'}
                        style={{ color: item.is_staple ? '#fbbf24' : '#64748b' }}
                      />
                      <span>{item.is_staple ? 'Staple' : 'Not Staple'}</span>
                    </button>

                    {item.is_active && (
                      <Badge variant="info" size="sm" title="Currently on shopping list">
                        In List
                      </Badge>
                    )}

                    <Badge variant="neutral" size="sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 90, justifyContent: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', width: 14, height: 14, flexShrink: 0 }}>
                        {renderStoreIcon(storeInfo.icon)}
                      </span>
                      <span>{storeInfo.name}</span>
                    </Badge>

                    <IconButton
                      size="sm"
                      variant="ghost"
                      icon="fas fa-trash-can"
                      title={`Delete "${item.name}"`}
                      aria-label={`Delete "${item.name}"`}
                      onClick={() => handleDeleteSingle(item)}
                      style={{ color: 'rgba(239, 68, 68, 0.7)' }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ManageCatalogModal;
