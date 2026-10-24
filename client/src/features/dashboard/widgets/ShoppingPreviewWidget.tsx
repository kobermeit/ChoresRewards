import React, { memo } from 'react';
import { ShoppingStore } from '../../../types';

export interface ShoppingPreviewWidgetProps {
  items: Array<{ name: string; qty?: string; store?: string }>;
  totalUnchecked: number;
  stores: ShoppingStore[];
  onOpenShopping: () => void;
}

export const ShoppingPreviewWidget: React.FC<ShoppingPreviewWidgetProps> = memo(({
  items,
  totalUnchecked,
  stores,
  onOpenShopping,
}) => {
  return (
    <div
      className="dashboard-card"
      style={{ display: 'flex', flexDirection: 'column', gap: 12, cursor: 'pointer' }}
      onClick={onOpenShopping}
      title="Click to view full shopping list"
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3
          className="dashboard-card-title"
          style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <i className="fas fa-cart-shopping" style={{ color: '#38bdf8' }} />
          <span>Shopping List</span>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: '#38bdf8',
              background: 'rgba(56, 189, 248, 0.15)',
              padding: '2px 8px',
              borderRadius: 999,
            }}
          >
            {totalUnchecked} left
          </span>
        </h3>
        <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>
          Full List &rarr;
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.length === 0 ? (
          <p className="dash-empty-hint" style={{ textAlign: 'center', margin: '14px 0' }}>
            Shopping list is all clear! 🎉
          </p>
        ) : (
          items.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.04)',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                <i className="fas fa-circle-dot" style={{ fontSize: '0.65rem', color: '#38bdf8', opacity: 0.8 }} />
                <span
                  style={{
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    color: '#f8fafc',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {item.name}
                </span>
                {item.qty && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: '#38bdf8',
                      background: 'rgba(56, 189, 248, 0.12)',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                      padding: '1px 6px',
                      borderRadius: 6,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {item.qty}
                  </span>
                )}
              </div>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: 'rgba(255, 255, 255, 0.55)',
                  textTransform: 'capitalize',
                  letterSpacing: '0.02em',
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: '2px 8px',
                  borderRadius: 6,
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {(() => {
                  const storeMatch = stores.find(
                    (s) => s.id.toLowerCase() === (item.store || '').toLowerCase()
                  );
                  if (storeMatch?.name) return storeMatch.name;
                  return (item.store || 'General')
                    .replace(/-\d+$/, '')
                    .replace(/-/g, ' ')
                    .replace(/\b\w/g, (c) => c.toUpperCase());
                })()}
              </span>
            </div>
          ))
        )}
        {totalUnchecked > 8 && (
          <div
            style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600, textAlign: 'center', marginTop: 4 }}
          >
            +{totalUnchecked - 8} more items on shopping list
          </div>
        )}
      </div>
    </div>
  );
});

ShoppingPreviewWidget.displayName = 'ShoppingPreviewWidget';
