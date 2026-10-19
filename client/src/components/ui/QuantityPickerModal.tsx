import React from 'react';
import { Modal } from '../common/Modal';

export interface QuantityPickerModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  currentQty: number | string;
  onSelectQty: (qty: number) => void;
  onRemoveItem?: () => void;
  maxQty?: number;
}

/**
 * Sleek compact quantity select overlay (inspired by modern iOS/Google mobile commerce pickers).
 * Displays a clean vertical touch list of quantities (1..max) with direct selection,
 * active indicator, and quick trash/remove action.
 */
export const QuantityPickerModal: React.FC<QuantityPickerModalProps> = ({
  open,
  onClose,
  title,
  currentQty,
  onSelectQty,
  onRemoveItem,
  maxQty = 15,
}) => {
  const currentNum = parseInt(String(currentQty), 10) || 1;
  const numbers = Array.from({ length: maxQty }, (_, i) => i + 1);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title || 'Select Quantity'}
      icon="fas fa-hashtag"
      maxWidth={340}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 10 }}>
          {onRemoveItem ? (
            <button
              type="button"
              onClick={() => {
                onRemoveItem();
                onClose();
              }}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#f87171',
                borderRadius: 'var(--btn-radius, 8px)',
                width: 42,
                height: 40,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
                transition: 'all 0.15s ease',
              }}
              title="Remove item from shopping list"
              aria-label="Remove item"
            >
              <i className="fas fa-trash-alt" />
            </button>
          ) : <div />}

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              color: '#cbd5e1',
              borderRadius: 'var(--btn-radius, 8px)',
              padding: '8px 18px',
              height: 40,
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: '340px', overflowY: 'auto', padding: '4px 0' }}>
        {numbers.map((n) => {
          const isSelected = n === currentNum;
          return (
            <button
              key={n}
              type="button"
              onClick={() => {
                onSelectQty(n);
                onClose();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px 16px',
                height: 44,
                borderRadius: 'var(--radius-sm, 8px)',
                border: isSelected ? '1px solid rgba(59, 130, 246, 0.6)' : '1px solid transparent',
                background: isSelected ? 'rgba(59, 130, 246, 0.22)' : 'rgba(255, 255, 255, 0.03)',
                color: isSelected ? '#60a5fa' : '#f8fafc',
                fontSize: '1.05rem',
                fontWeight: isSelected ? 800 : 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                position: 'relative',
              }}
            >
              <span>{n}</span>
              {isSelected && (
                <i
                  className="fas fa-check"
                  style={{
                    position: 'absolute',
                    right: 18,
                    fontSize: '0.9rem',
                    color: '#60a5fa',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </Modal>
  );
};
