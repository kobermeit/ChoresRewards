import React, { useEffect, useRef, useState } from 'react';

export interface WheelPickerOverlayProps {
  open: boolean;
  onClose: () => void;
  value: number | string;
  min?: number;
  max?: number;
  step?: number;
  showZeroAsTrash?: boolean;
  onSelect: (val: number) => void;
}

export const WheelPickerOverlay: React.FC<WheelPickerOverlayProps> = ({
  open,
  onClose,
  value,
  min = 0,
  max = 15,
  step = 1,
  showZeroAsTrash = true,
  onSelect,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const parsedVal = Math.round(Number(value)) || 0;
  const [activeVal, setActiveVal] = useState<number>(parsedVal);
  const dragStartY = useRef<number | null>(null);
  const isDragging = useRef<boolean>(false);
  const scrollTimeout = useRef<any>(null);

  const ITEM_HEIGHT = 54;

  // Generate range of numbers
  const items = React.useMemo(() => {
    const arr: number[] = [];
    for (let i = min; i <= max; i += step) {
      arr.push(i);
    }
    return arr;
  }, [min, max, step]);

  // Sync activeVal and scroll position when opened
  useEffect(() => {
    if (!open) return;
    const numVal = Math.round(Number(value)) || 0;
    setActiveVal(numVal);
    const targetIdx = items.indexOf(numVal);
    if (targetIdx !== -1) {
      const el = scrollRef.current;
      if (el) {
        el.style.scrollSnapType = 'none';
        el.scrollTop = targetIdx * ITEM_HEIGHT;
      }
      const tid = setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = targetIdx * ITEM_HEIGHT;
          scrollRef.current.style.scrollSnapType = 'y mandatory';
        }
      }, 40);
      return () => clearTimeout(tid);
    }
  }, [open, value, items]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const st = scrollRef.current.scrollTop;
    const idx = Math.round(st / ITEM_HEIGHT);
    const clampedIdx = Math.max(0, Math.min(items.length - 1, idx));
    setActiveVal(items[clampedIdx]);

    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      // Auto-snap to exact slot center
      if (scrollRef.current) {
        scrollRef.current.scrollTo({
          top: clampedIdx * ITEM_HEIGHT,
          behavior: 'smooth',
        });
      }
    }, 120);
  };

  const handleItemClick = (val: number) => {
    // If user dragged, don't trigger direct tap
    if (isDragging.current) return;
    onSelect(val);
    onClose();
  };

  return (
    <div
      className="wheel-picker-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="wheel-picker-drum"
        style={{
          width: 140,
          height: 230,
          background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
          border: '1.5px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 22,
          boxShadow: '0 20px 48px rgba(0, 0, 0, 0.8), 0 0 24px rgba(59, 130, 246, 0.15)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          userSelect: 'none',
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={() => {
          isDragging.current = false;
        }}
        onTouchMove={() => {
          isDragging.current = true;
        }}
        onMouseDown={(e) => {
          dragStartY.current = e.clientY;
          isDragging.current = false;
        }}
        onMouseMove={(e) => {
          if (dragStartY.current !== null && Math.abs(e.clientY - dragStartY.current) > 6) {
            isDragging.current = true;
          }
        }}
        onMouseUp={() => {
          dragStartY.current = null;
          // Short delay so click handler knows if it was a drag
          setTimeout(() => {
            isDragging.current = false;
          }, 50);
        }}
      >
        {/* Subtle center slot highlight rails (Google Clock style) */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 12,
            right: 12,
            height: ITEM_HEIGHT,
            transform: 'translateY(-50%)',
            borderTop: '1.5px solid rgba(255, 255, 255, 0.25)',
            borderBottom: '1.5px solid rgba(255, 255, 255, 0.25)',
            borderRadius: 8,
            background: 'rgba(255, 255, 255, 0.04)',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />

        {/* Top Fade Gradient Mask */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 70,
            background: 'linear-gradient(to bottom, #0f172a 10%, rgba(15, 23, 42, 0) 100%)',
            pointerEvents: 'none',
            zIndex: 3,
          }}
        />

        {/* Bottom Fade Gradient Mask */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 70,
            background: 'linear-gradient(to top, #0f172a 10%, rgba(15, 23, 42, 0) 100%)',
            pointerEvents: 'none',
            zIndex: 3,
          }}
        />

        {/* Scrollable Number Column */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{
            width: '100%',
            height: '100%',
            overflowY: 'auto',
            scrollSnapType: 'y mandatory',
            scrollbarWidth: 'none',
            paddingTop: (230 - ITEM_HEIGHT) / 2,
            paddingBottom: (230 - ITEM_HEIGHT) / 2,
            boxSizing: 'border-box',
          }}
        >
          {items.map((num) => {
            const isCenter = num === activeVal;
            const isZero = num === 0;

            return (
              <div
                key={num}
                onClick={() => handleItemClick(num)}
                style={{
                  height: ITEM_HEIGHT,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  scrollSnapAlign: 'center',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, opacity 0.15s ease',
                  transform: isCenter ? 'scale(1.15)' : 'scale(0.85)',
                  opacity: isCenter ? 1 : 0.35,
                  zIndex: 4,
                }}
              >
                {isZero && showZeroAsTrash ? (
                  <span
                    style={{
                      color: isCenter ? '#ef4444' : 'rgba(239, 68, 68, 0.5)',
                      fontSize: isCenter ? '1.5rem' : '1.1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                    title="Remove item"
                  >
                    <i className="fas fa-trash-alt" />
                  </span>
                ) : (
                  <span
                    style={{
                      color: isCenter ? '#ffffff' : 'rgba(255, 255, 255, 0.45)',
                      fontSize: isCenter ? '2.1rem' : '1.4rem',
                      fontWeight: isCenter ? 800 : 600,
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {num}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
