import React from 'react';
import { useNavigation, useSeason } from '../hooks/useSettings';
import { useAppDispatch, useAppSelector } from '../store';
import { setMobileDrawerOpen } from '../store/uiSlice';
import { ActiveView } from '../types';

interface PrimaryTab {
  id: ActiveView;
  label: string;
  icon: string;
}

const PRIMARY_TABS: PrimaryTab[] = [
  { id: 'dashboard', label: 'Today', icon: 'fas fa-house' },
  { id: 'chores', label: 'Chores', icon: 'fas fa-list-check' },
  { id: 'rewards', label: 'Rewards', icon: 'fas fa-trophy' },
  { id: 'shopping', label: 'Shopping', icon: 'fas fa-cart-shopping' },
];

export const MobileBottomNav: React.FC = () => {
  const dispatch = useAppDispatch();
  const mobileDrawerOpen = useAppSelector((state) => state.ui.mobileDrawerOpen);
  const { activeView, navigate } = useNavigation();
  const seasonInfo = useSeason();
  const activeColor = seasonInfo.enabled && seasonInfo.accent ? seasonInfo.accent : '#38bdf8';

  const isOtherActive = !PRIMARY_TABS.some((t) => t.id === activeView);

  const handleSelectView = (v: ActiveView) => {
    navigate(v);
    if (mobileDrawerOpen) {
      dispatch(setMobileDrawerOpen(false));
    }
  };

  const handleToggleMenu = () => {
    dispatch(setMobileDrawerOpen(!mobileDrawerOpen));
  };

  return (
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
        const isActive = activeView === tab.id && !mobileDrawerOpen;
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

      {/* 5th Slot: Menu Button (Opens unified MobileDrawer) */}
      <button
        type="button"
        onClick={handleToggleMenu}
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
          color: mobileDrawerOpen || isOtherActive ? activeColor : 'rgba(255, 255, 255, 0.55)',
          position: 'relative',
          transition: 'color 0.15s ease',
          outline: 'none',
          WebkitTapHighlightColor: 'transparent',
        }}
        aria-expanded={mobileDrawerOpen}
        aria-label="Open Full Navigation Menu"
      >
        {(mobileDrawerOpen || isOtherActive) && (
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
          className={mobileDrawerOpen ? 'fas fa-xmark' : 'fas fa-bars'}
          style={{
            fontSize: '1.18rem',
            marginBottom: 3,
            transform: mobileDrawerOpen || isOtherActive ? 'scale(1.1)' : 'scale(1)',
            transition: 'transform 0.15s ease',
          }}
        />
        <span
          style={{
            fontSize: '0.68rem',
            fontWeight: mobileDrawerOpen || isOtherActive ? 700 : 500,
            letterSpacing: '0.01em',
            lineHeight: 1,
          }}
        >
          Menu
        </span>
      </button>
    </nav>
  );
};
