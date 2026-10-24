import React from 'react';
import { Modal } from '../../../components/common/Modal';
import { Button } from '../../../components/ui';
import { ShoppingPurchaseLogItem } from '../../../types';

export interface ShoppingHistoryModalProps {
  open: boolean;
  onClose: () => void;
  history: ShoppingPurchaseLogItem[];
  onReAdd: (itemName: string, preferredStore?: string) => void;
  onOpenManageCatalog?: () => void;
}

export const ShoppingHistoryModal: React.FC<ShoppingHistoryModalProps> = ({
  open,
  onClose,
  history,
  onReAdd,
  onOpenManageCatalog,
}) => {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Purchased History"
      icon="fas fa-clock-rotate-left"
      maxWidth={540}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          {onOpenManageCatalog ? (
            <Button
              variant="secondary"
              size="sm"
              icon="fas fa-trash-can"
              onClick={onOpenManageCatalog}
              title="Delete items permanently from catalog"
            >
              Manage Catalog
            </Button>
          ) : <div />}
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <p style={{ margin: '0 0 10px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
        Items ticked and archived as purchased from your shopping trips.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
        {history.length === 0 ? (
          <div style={{ fontSize: '0.85rem', opacity: 0.6, fontStyle: 'italic', padding: 12 }}>
            No purchase history logged yet.
          </div>
        ) : (
          history.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 10px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div>
                <div style={{ fontSize: '0.88rem', color: '#f8fafc', fontWeight: 600 }}>{item.name}</div>
                <div style={{ fontSize: '0.72rem', opacity: 0.5 }}>
                  {item.store} · {new Date(item.purchased_at).toLocaleDateString()}
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                icon="fas fa-plus"
                style={{ height: 28, fontSize: '0.75rem', padding: '0 10px' }}
                onClick={() => onReAdd(item.name, item.store)}
              >
                Re-add
              </Button>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
};
