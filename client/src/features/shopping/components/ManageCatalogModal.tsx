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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const stores: ShoppingStore[] = useMemo(() => {
    return (data?.shopping?.stores || data?.shopping_list?.stores || []) as ShoppingStore[];
  }, [data?.shopping?.stores, data?.shopping_list?.stores]);

  const storeMap = useMemo(() => {
    const map: Record<string, string> = {};
    stores.forEach((s) => {
      map[s.id.toLowerCase()] = s.name;
    });
    return map;
  }, [stores]);

  const filteredCatalog = useMemo(() => {
    let list = catalog;
    if (storeFilter !== 'all') {
      list = list.filter(
        (item) => (item.default_store || 'aldi').toLowerCase() === storeFilter.toLowerCase()
      );
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
  }, [catalog, searchTerm, storeFilter]);

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
      title="Manage Shopping Catalog"
      icon="fas fa-trash-can"
      maxWidth={680}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 10 }}>
          <span style={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.6)' }}>
            {selectedIds.size > 0 ? `${selectedIds.size} item${selectedIds.size > 1 ? 's' : ''} selected` : `${filteredCatalog.length} item${filteredCatalog.length === 1 ? '' : 's'} (${catalog.length} total)`}
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ margin: 0, fontSize: '0.84rem', color: 'rgba(255,255,255,0.65)' }}>
          Permanently remove mis-typed or obsolete items so they never reappear in history or smart suggestions.
        </p>

        {/* Filter Input, Store Filter & Select All Toolbar */}
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
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              options={[
                { value: 'all', label: 'All Stores' },
                ...stores.map((s) => ({ value: s.id, label: s.name })),
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
            maxHeight: 380,
            overflowY: 'auto',
            borderRadius: 'var(--radius-md, 8px)',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(0,0,0,0.2)',
          }}
        >
          {filteredCatalog.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', opacity: 0.5, fontSize: '0.88rem' }}>
              {searchTerm || storeFilter !== 'all' ? 'No items matched your filters.' : 'Catalog is currently empty.'}
            </div>
          ) : (
            filteredCatalog.map((item) => {
              const isChecked = selectedIds.has(item.id);
              const storeName = storeMap[(item.default_store || '').toLowerCase()] || item.default_store;
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
                    background: isChecked ? 'rgba(239, 68, 68, 0.12)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleItem(item.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ cursor: 'pointer', width: 16, height: 16 }}
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
                        ) : null}
                        {lastBoughtLabel ? (
                          <span>Last: {lastBoughtLabel}</span>
                        ) : lastAddedLabel ? (
                          <span>Added: {lastAddedLabel}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    {storeName && (
                      <Badge variant="neutral" size="sm">
                        {storeName}
                      </Badge>
                    )}
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
