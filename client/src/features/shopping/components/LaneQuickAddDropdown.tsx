import React, { useState, useRef, useEffect, useMemo } from 'react';

export interface LaneQuickAddDropdownProps {
  storeId: string;
  storeName: string;
  items: Array<{ name: string; qty?: string }>;
  onSelect: (itemName: string) => void;
}

export const LaneQuickAddDropdown: React.FC<LaneQuickAddDropdownProps> = ({
  storeName,
  items,
  onSelect,
}) => {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutsideClick);
      // Auto-focus search input if available
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  const filteredItems = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.name.toLowerCase().includes(q));
  }, [items, filter]);

  const handleItemClick = (name: string) => {
    onSelect(name);
    setOpen(false);
    setFilter('');
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Trigger Button mimicking Design System Select */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="cr-select"
        style={{
          width: '100%',
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          fontSize: '0.86rem',
          color: 'var(--color-text-muted, #94a3b8)',
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid var(--color-border-medium, rgba(255, 255, 255, 0.15))',
          borderRadius: 'var(--radius-md, 8px)',
          cursor: 'pointer',
          textAlign: 'left',
          userSelect: 'none',
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Add item to ${storeName}`}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="fas fa-plus" style={{ fontSize: '0.75rem', opacity: 0.7 }} />
          <span>Add item…</span>
        </span>
        <i
          className="fas fa-chevron-down"
          style={{
            fontSize: '0.72rem',
            opacity: 0.6,
            transition: 'transform 0.18s ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {/* Floating Popover Menu */}
      {open && (
        <div
          className="lane-quick-add-popover"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 150,
            background: 'rgba(15, 23, 42, 0.98)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            borderRadius: 'var(--radius-md, 10px)',
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.7)',
            padding: 6,
            maxHeight: 260,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            animation: 'dropdownFadeDown 0.12s ease-out',
          }}
        >
          {items.length > 5 && (
            <div style={{ padding: '2px 4px 6px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <input
                ref={inputRef}
                type="text"
                placeholder="Type to filter..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                style={{
                  width: '100%',
                  height: 30,
                  fontSize: '0.82rem',
                  padding: '0 8px',
                  borderRadius: 6,
                  border: '1px solid rgba(255,255,255,0.14)',
                  background: 'rgba(0,0,0,0.3)',
                  color: '#f8fafc',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {filteredItems.length === 0 ? (
              <div style={{ padding: 12, fontSize: '0.8rem', opacity: 0.5, textAlign: 'center' }}>
                No matching items.
              </div>
            ) : (
              filteredItems.map((item) => (
                <div
                  key={item.name}
                  onClick={() => handleItemClick(item.name)}
                  className="lane-dropdown-item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: '0.86rem',
                    color: '#f1f5f9',
                    fontWeight: 500,
                    transition: 'background 0.12s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.22)';
                    e.currentTarget.style.color = '#93c5fd';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#f1f5f9';
                  }}
                >
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.name}
                  </span>
                  {item.qty && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        color: 'rgba(255,255,255,0.5)',
                        marginLeft: 6,
                        flexShrink: 0,
                      }}
                    >
                      {item.qty}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
