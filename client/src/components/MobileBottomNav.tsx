import React, { useState } from 'react';
import { useNavigation, useSeason } from '../hooks/useSettings';
import { ActiveView } from '../types';

interface PrimaryTab {
  id: ActiveView;
  label: string;
  icon: string;
}

interface MoreTab {
  id: ActiveView;
  label: string;
  icon: string;
  color?: string;
  description?: string;
}

const PRIMARY_TABS: PrimaryTab[] = [
  { id: 'dashboard', label: 'Today', icon: 'fas fa-house' },
  { id: 'chores', label: 'Chores', icon: 'fas fa-list-check' },
  { id: 'rewards', label: 'Rewards', icon: 'fas fa-trophy' },
  { id: 'shopping', label: 'Shopping', icon: 'fas fa-cart-shopping' },
];

const MORE_TABS: MoreTab[] = [
  { id: 'meals', label: 'Meal Planner', icon: 'fas fa-utensils', color: '#f59e0b', description: 'Weekly meal plan & slots' },
  { id: 'library', label: 'Recipes Library', icon: 'fas fa-book-open', color: '#ec4899', description: 'Family recipe collection' },
  { id: 'calendar', label: 'Family Calendar', icon: 'fas fa-calendar-days', color: '#3b82f6', description: 'Events & synced schedules' },
  { id: 'notes', label: 'Sticky Notes', icon: 'fas fa-sticky-note', color: '#eab308', description: 'Household notes & reminders' },
  { id: 'activity_log', label: 'Activity Log', icon: 'fas fa-clock-rotate-left', color: '#10b981', description: 'Points & completion history' },
  { id: 'settings', label: 'Settings', icon: 'fas fa-gear', color: '#94a3b8', description: 'Profiles, themes & system setup' },
];

export const MobileBottomNav: React.FC = () => {
  const { activeView, navigate } = useNavigation();
  const seasonInfo = useSeason();
  const [moreOpen, setMoreOpen] = useState(false);
  const activeColor = seasonInfo.enabled && seasonInfo.accent ? seasonInfo.accent : '#38bdf8';

  const isMoreActive = MORE_TABS.some((t) => t.id === activeView);

  const handleSelectView = (v: ActiveView) => {
    navigate(v);
    setMoreOpen(false);
  };

  return (
    <>
      {/* More Bottom Sheet Backdrop */}
      {moreOpen && (
        <div
          onClick={() => setMoreOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 8990,
          }}
          aria-hidden="true"
        />
      )}

      {/* More Bottom Sheet Drawer */}
      {moreOpen && (
        <div
          role="dialog"
          aria-label="More Navigation Options"
          style={{
            position: 'fixed',
            bottom: 'var(--mobile-nav-height, 58px)',
            left: 0,
            right: 0,
            background: 'rgba(15, 23, 42, 0.98)',
            borderTop: '1px solid rgba(255, 255, 255, 0.16)',
            borderRadius: '20px 20px 0 0',
            padding: '16px 16px 20px',
            zIndex: 8995,
            boxShadow: '0 -8px 30px rgba(0, 0, 0, 0.7)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            maxHeight: '75vh',
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 6 }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>
              More Sections
            </span>
            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              aria-label="Close sheet"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: '#cbd5e1',
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <i className="fas fa-times" />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
            {MORE_TABS.map((tab) => {
              const isSelected = activeView === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleSelectView(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: isSelected ? 'rgba(56, 189, 248, 0.14)' : 'rgba(255, 255, 255, 0.04)',
                    border: isSelected ? `1.5px solid ${activeColor}` : '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#f8fafc',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    outline: 'none',
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: isSelected ? `${activeColor}25` : `${tab.color || '#3b82f6'}1a`,
                      border: `1px solid ${isSelected ? activeColor : (tab.color || '#3b82f6') + '40'}`,
                      color: tab.color || activeColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.15rem',
                      flexShrink: 0,
                    }}
                  >
                    <i className={tab.icon} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: isSelected ? activeColor : '#f8fafc' }}>
                      {tab.label}
                    </div>
                    {tab.description && (
                      <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: 1 }}>
                        {tab.description}
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <i className="fas fa-check" style={{ color: activeColor, fontSize: '0.9rem' }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Primary Fixed Bottom Nav (5 Slots) */}
      <nav
        className="mobile-bottom-nav"
        aria-label="Mobile Navigation"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          width: '100%',
          maxWidth: '100vw',
          height: 'var(--mobile-nav-height, 58px)',
          zIndex: 9000,
          background: 'rgba(15, 23, 42, 0.97)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          padding: '0 4px env(safe-area-inset-bottom, 0px)',
          boxSizing: 'border-box',
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.45)',
          overflow: 'hidden',
        }}
      >
        {PRIMARY_TABS.map((tab) => {
          const isActive = activeView === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleSelectView(tab.id)}
              style={{
                flex: 1,
                maxWidth: '20%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                padding: '4px 2px',
                cursor: 'pointer',
                color: isActive ? activeColor : 'rgba(255, 255, 255, 0.55)',
                position: 'relative',
                transition: 'color 0.15s ease',
                outline: 'none',
                WebkitTapHighlightColor: 'transparent',
              }}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    width: '50%',
                    height: 3,
                    borderRadius: '0 0 3px 3px',
                    background: activeColor,
                    boxShadow: `0 0 10px ${activeColor}`,
                  }}
                />
              )}
              <i
                className={tab.icon}
                style={{
                  fontSize: '1.18rem',
                  marginBottom: 3,
                  transform: isActive ? 'scale(1.1)' : 'scale(1)',
                  transition: 'transform 0.15s ease',
                }}
              />
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: isActive ? 700 : 500,
                  letterSpacing: '0.01em',
                  lineHeight: 1,
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}

        {/* 5th Slot: More Button */}
        <button
          type="button"
          onClick={() => setMoreOpen((p) => !p)}
          style={{
            flex: 1,
            maxWidth: '20%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            padding: '4px 2px',
            cursor: 'pointer',
            color: isMoreActive || moreOpen ? activeColor : 'rgba(255, 255, 255, 0.55)',
            position: 'relative',
            transition: 'color 0.15s ease',
            outline: 'none',
            WebkitTapHighlightColor: 'transparent',
          }}
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
        >
          {(isMoreActive || moreOpen) && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                width: '50%',
                height: 3,
                borderRadius: '0 0 3px 3px',
                background: activeColor,
                boxShadow: `0 0 10px ${activeColor}`,
              }}
            />
          )}
          <i
            className={moreOpen ? 'fas fa-times' : 'fas fa-ellipsis'}
            style={{
              fontSize: '1.18rem',
              marginBottom: 3,
              transform: isMoreActive || moreOpen ? 'scale(1.1)' : 'scale(1)',
              transition: 'transform 0.15s ease',
            }}
          />
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: isMoreActive || moreOpen ? 700 : 500,
              letterSpacing: '0.01em',
              lineHeight: 1,
            }}
          >
            More
          </span>
        </button>
      </nav>
    </>
  );
};
