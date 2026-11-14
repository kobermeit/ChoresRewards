import React, { useState, useMemo } from 'react';
import { Modal } from '../../../components/common/Modal';
import { Button, IconButton, Badge, Select } from '../../../components/ui';
import { ShoppingCatalogItem, ShoppingStore } from '../../../types';
import { apiPost } from '../../../api';
import { useApp } from '../../../context/AppContext';

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

  const allFilteredSelected =
    filteredCatalog.length > 0 &&
    filteredCatalog.every((it) => selectedIds.has(it.id));

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      const next = new Set(selectedIds);
      filteredCatalog.forEach((it) => next.add(it.id));
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
      maxWidth={720}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 10 }}>
          <span style={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.6)' }}>
            {selectedIds.size > 0
              ? `${selectedIds.size} item${selectedIds.size > 1 ? 's' : ''} selected`
              : `${filteredCatalog.length} item${filteredCatalog.length === 1 ? '' : 's'} (${catalog.length} total)`}
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

          <div style={{ width: 140 }}>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              options={[
                { value: 'all', label: 'All Items' },
                { value: 'staples', label: '⭐ Staples Only' },
                { value: 'non-staples', label: 'Non-Staples' },
              ]}
              style={{ height: 36, fontSize: '0.82rem' }}
            />
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

        {/* Catalog Table */}
        <div
          style={{
            maxHeight: 400,
            overflowY: 'auto',
            borderRadius: 'var(--radius-md, 8px)',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(0,0,0,0.25)',
          }}
        >
          {filteredCatalog.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', opacity: 0.5, fontSize: '0.88rem' }}>
              {searchTerm || storeFilter !== 'all' || statusFilter !== 'all'
                ? 'No items matched your filters.'
                : 'Catalog is currently empty.'}
            </div>
          ) : (
            filteredCatalog.map((item) => {
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

                    <Badge variant="neutral" size="sm">
                      {storeInfo.icon} {storeInfo.name}
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
