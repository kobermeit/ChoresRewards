import React, { useState } from 'react';
import { Modal } from '../../../components/common/Modal';
import { Button } from '../../../components/ui';
import { ShoppingCatalogItem } from '../../../types';

export interface ShoppingSuggestedModalProps {
  open: boolean;
  onClose: () => void;
  suggested: ShoppingCatalogItem[];
  onBatchAdd: (selectedKeys: Record<string, boolean>) => Promise<void>;
}

export const ShoppingSuggestedModal: React.FC<ShoppingSuggestedModalProps> = ({
  open,
  onClose,
  suggested,
  onBatchAdd,
}) => {
  const [selectedKeys, setSelectedKeys] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);

  const allSelected =
    suggested.length > 0 &&
    suggested.every((item) => selectedKeys[item.normalized_key]);

  const handleToggleAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    if (checked) {
      suggested.forEach((item) => {
        next[item.normalized_key] = true;
      });
    }
    setSelectedKeys(next);
  };

  const handleCommit = async () => {
    setAdding(true);
    try {
      await onBatchAdd(selectedKeys);
      setSelectedKeys({});
      onClose();
    } finally {
      setAdding(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Suggested Restock"
      icon="fas fa-lightbulb"
      maxWidth={540}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={adding}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon="fas fa-cart-plus"
            onClick={handleCommit}
            disabled={adding || Object.values(selectedKeys).filter(Boolean).length === 0}
          >
            Add Selected to Shopping List
          </Button>
        </div>
      }
    >
      <p style={{ margin: '0 0 10px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
        Items predicted to need restocking based on your historical purchase frequency.
      </p>

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
          marginBottom: 8,
        }}
      >
        <input
          type="checkbox"
          checked={allSelected}
          onChange={(e) => handleToggleAll(e.target.checked)}
        />
        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc' }}>
          Select All ({suggested.length})
        </span>
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
        {suggested.length === 0 ? (
          <div style={{ fontSize: '0.85rem', opacity: 0.6, fontStyle: 'italic', padding: 12 }}>
            No suggested items due right now!
          </div>
        ) : (
          suggested.map((item) => {
            const checked = Boolean(selectedKeys[item.normalized_key]);
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
                      setSelectedKeys((prev) => ({
                        ...prev,
                        [item.normalized_key]: e.target.checked,
                      }));
                    }}
                  />
                  <div>
                    <div style={{ fontSize: '0.88rem', color: '#f8fafc', fontWeight: 600 }}>{item.name}</div>
                    {item.reason && <div style={{ fontSize: '0.72rem', color: '#93c5fd' }}>{item.reason}</div>}
                  </div>
                </div>
                <span style={{ fontSize: '0.74rem', opacity: 0.6 }}>{item.default_store || 'aldi'}</span>
              </label>
            );
          })
        )}
      </div>
    </Modal>
  );
};
