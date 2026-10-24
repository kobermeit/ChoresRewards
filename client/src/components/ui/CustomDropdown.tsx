import React, { useState, useRef, useEffect, useMemo } from 'react';

export interface CustomDropdownOption {
  value: string;
  label: string;
  icon?: string | React.ReactNode;
  qty?: string;
  action?: boolean;
}

export interface CustomDropdownProps {
  value?: string;
  placeholder?: string;
  options: CustomDropdownOption[];
  onChange: (value: string) => void;
  showFilter?: boolean;
  filterPlaceholder?: string;
  height?: number | string;
  style?: React.CSSProperties;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
  allowCustomValue?: boolean;
  customValueLabel?: (text: string) => string;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  value,
  placeholder = 'Select…',
  options,
  onChange,
  showFilter = false,
  filterPlaceholder = 'Type to filter…',
  height = 36,
  style,
  className = '',
  ariaLabel,
  disabled = false,
  allowCustomValue = false,
  customValueLabel,
}) => {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  // Reset filter when closed
  useEffect(() => {
    if (!open) {
      setFilter('');
    }
  }, [open]);

  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.value === value);
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    let list = options;
    if (showFilter && filter.trim()) {
      const q = filter.trim().toLowerCase();
      list = options.filter((opt) => opt.label.toLowerCase().includes(q));
    }
    if (allowCustomValue && filter.trim() && list.length === 0) {
      const trimmed = filter.trim();
      const customOpt: CustomDropdownOption = {
        value: trimmed,
        label: customValueLabel ? customValueLabel(trimmed) : `Add "${trimmed}"`,
        action: true,
        icon: 'fas fa-plus',
      };
      return [customOpt];
    }
    return list;
  }, [options, filter, showFilter, allowCustomValue, customValueLabel]);

  const handleSelect = (optValue: string) => {
    onChange(optValue);
    setOpen(false);
    setFilter('');
  };

  const renderIcon = (icon?: string | React.ReactNode) => {
    if (!icon) return null;
    if (typeof icon === 'string') {
      if (icon.startsWith('fa') || icon.includes(' ')) {
        return <i className={icon} style={{ fontSize: '0.85rem', marginRight: 6 }} />;
      }
      return <span style={{ marginRight: 6, fontSize: '1rem', lineHeight: 1 }}>{icon}</span>;
    }
    return <span style={{ marginRight: 6 }}>{icon}</span>;
  };

  return (
    <div
      ref={containerRef}
      className={`cr-custom-dropdown ${className}`.trim()}
      style={{
        position: 'relative',
        display: 'inline-block',
        width: '100%',
        boxSizing: 'border-box',
        zIndex: open ? 60 : undefined,
        ...style,
      }}
    >
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className="cr-select"
        style={{
          width: '100%',
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          fontSize: '0.88rem',
          color: selectedOption ? 'var(--color-text-primary, #f8fafc)' : 'var(--color-text-muted, #94a3b8)',
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid var(--color-border-medium, rgba(255, 255, 255, 0.16))',
          borderRadius: 'var(--radius-md, 8px)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          textAlign: 'left',
          userSelect: 'none',
          boxSizing: 'border-box',
          opacity: disabled ? 0.6 : 1,
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel || placeholder}
      >
        <span style={{ display: 'flex', alignItems: 'center', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedOption ? (
            <>
              {renderIcon(selectedOption.icon)}
              <span style={{ fontWeight: 600 }}>{selectedOption.label}</span>
            </>
          ) : (
            <span style={{ color: 'var(--color-text-muted, #94a3b8)' }}>{placeholder}</span>
          )}
        </span>
        <i
          className="fas fa-chevron-down"
          style={{
            fontSize: '0.72rem',
            opacity: 0.6,
            marginLeft: 8,
            flexShrink: 0,
            transition: 'transform 0.18s ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {/* Floating Popover Menu */}
      {open && (
        <div
          className="cr-custom-dropdown-popover"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            minWidth: '100%',
            zIndex: 300,
            background: 'rgba(15, 23, 42, 0.98)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            borderRadius: 'var(--radius-md, 10px)',
            boxShadow: '0 14px 34px rgba(0, 0, 0, 0.75)',
            padding: 6,
            maxHeight: 280,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            animation: 'dropdownFadeDown 0.12s ease-out',
            boxSizing: 'border-box',
          }}
        >
          {/* Optional Filter Input (Explicitly NO auto-focus so mobile keyboards don't pop up unprompted) */}
          {showFilter && (
            <div style={{ padding: '2px 4px 6px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <input
                type="text"
                placeholder={filterPlaceholder}
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

          {/* Options List */}
          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: 12, fontSize: '0.8rem', opacity: 0.5, textAlign: 'center' }}>
                No matching options.
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <div
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: '0.88rem',
                      color: opt.action ? '#93c5fd' : isSelected ? '#60a5fa' : '#f1f5f9',
                      fontWeight: isSelected || opt.action ? 700 : 500,
                      background: isSelected
                        ? 'rgba(59, 130, 246, 0.18)'
                        : opt.action
                        ? 'rgba(59, 130, 246, 0.08)'
                        : 'transparent',
                      border: opt.action ? '1px dashed rgba(96, 165, 250, 0.3)' : '1px solid transparent',
                      marginTop: opt.action ? 4 : 0,
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = opt.action
                        ? 'rgba(59, 130, 246, 0.22)'
                        : 'rgba(59, 130, 246, 0.18)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isSelected
                        ? 'rgba(59, 130, 246, 0.18)'
                        : opt.action
                        ? 'rgba(59, 130, 246, 0.08)'
                        : 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {renderIcon(opt.icon)}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{opt.label}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                      {opt.qty && (
                        <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>
                          {opt.qty}
                        </span>
                      )}
                      {isSelected && !opt.action && (
                        <i className="fas fa-check" style={{ fontSize: '0.75rem', color: '#60a5fa' }} />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
