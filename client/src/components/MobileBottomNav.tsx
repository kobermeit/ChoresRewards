import React from 'react';
import { useNavigation, useSeason } from '../hooks/useSettings';
import { ActiveView } from '../types';

interface NavTab {
  id: ActiveView;
  label: string;
  icon: string;
}

const TABS: NavTab[] = [
  { id: 'dashboard', label: 'Today', icon: 'fas fa-house' },
  { id: 'chores', label: 'Chores', icon: 'fas fa-list-check' },
  { id: 'rewards', label: 'Rewards', icon: 'fas fa-trophy' },
  { id: 'shopping', label: 'Shopping', icon: 'fas fa-cart-shopping' },
  { id: 'meals', label: 'Meals', icon: 'fas fa-utensils' },
  { id: 'library', label: 'Recipes', icon: 'fas fa-book-open' },
];

export const MobileBottomNav: React.FC = () => {
  const { activeView, navigate } = useNavigation();
  const seasonInfo = useSeason();
  const activeColor = seasonInfo.enabled && seasonInfo.accent ? seasonInfo.accent : '#38bdf8';

  return (
    <nav
      className="mobile-bottom-nav"
      aria-label="Mobile Navigation"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'var(--mobile-nav-height, 58px)',
        zIndex: 9000,
        background: 'rgba(15, 23, 42, 0.96)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '0 4px env(safe-area-inset-bottom, 0px)',
        boxSizing: 'border-box',
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.45)',
      }}
    >
      {TABS.map((tab) => {
        const isActive = activeView === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => navigate(tab.id)}
            style={{
              flex: 1,
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
            {/* Active Top Highlight Indicator */}
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
    </nav>
  );
};
