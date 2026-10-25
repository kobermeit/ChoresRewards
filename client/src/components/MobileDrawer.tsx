import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { setMobileDrawerOpen } from '../store/uiSlice';
import { useApp } from '../context/AppContext';
import { useNavigation, useSeason } from '../hooks/useSettings';
import { ActiveView } from '../types';
import { resolveAvatarUrl } from '../api';

interface DrawerItem {
  id: ActiveView;
  label: string;
  icon: string;
  parentOnly?: boolean;
  hideForChild?: boolean;
}

const PRIMARY_ITEMS: DrawerItem[] = [
  { id: 'dashboard', label: 'Today (Dashboard)', icon: 'fas fa-gauge-high' },
  { id: 'chores', label: 'Chores Hub', icon: 'fas fa-list-check' },
  { id: 'rewards', label: 'Family Rewards', icon: 'fas fa-trophy' },
  { id: 'meals', label: 'Meal Planner', icon: 'fas fa-utensils' },
  { id: 'shopping', label: 'Shopping List', icon: 'fas fa-cart-shopping' },
  { id: 'library', label: 'Recipe Library', icon: 'fas fa-book-open' },
  { id: 'notes', label: 'Notes & Text Pads', icon: 'fas fa-sticky-note' },
  { id: 'organise', label: 'Organise & Bills', icon: 'fas fa-folder-open', hideForChild: true },
];

const SECONDARY_ITEMS: DrawerItem[] = [
  { id: 'calendar', label: 'Family Calendar', icon: 'fas fa-calendar-alt' },
  { id: 'activity_log', label: 'Activity Log', icon: 'fas fa-history' },
  { id: 'chore_history', label: 'Chore History', icon: 'fas fa-chart-bar' },
  { id: 'help', label: 'Help & Guide', icon: 'fas fa-circle-question' },
  { id: 'settings', label: 'Household Settings', icon: 'fas fa-cog', parentOnly: true },
];

export const MobileDrawer: React.FC = () => {
  const dispatch = useAppDispatch();
  const open = useAppSelector((state) => state.ui.mobileDrawerOpen);
  const {
    isParent,
    isChild,
    activeUser,
    setProfileSwitcherOpen,
    setVisualTimerOpen,
    setScreensaverOpen,
    toggleMute,
    muted,
  } = useApp();
  const { activeView, navigate } = useNavigation();
  const seasonInfo = useSeason();
  const activeColor = seasonInfo.enabled && seasonInfo.accent ? seasonInfo.accent : '#38bdf8';

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (open) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [open]);

  if (!open) return null;

  const handleSelect = (id: ActiveView) => {
    navigate(id);
    dispatch(setMobileDrawerOpen(false));
  };

  return (
    <div
      className="mobile-drawer-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        animation: 'crDrawerFadeIn 0.2s ease-out',
      }}
      onClick={() => dispatch(setMobileDrawerOpen(false))}
    >
      <div
        className="mobile-drawer-panel"
        style={{
          width: 300,
          maxWidth: '85vw',
          height: '100%',
          background: 'var(--cr-header-bg-1, #0f172a)',
          borderRight: '1px solid rgba(255, 255, 255, 0.14)',
          boxShadow: '4px 0 24px rgba(0, 0, 0, 0.7)',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          animation: 'crDrawerSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 18px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(255, 255, 255, 0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img
              src="./static/images/mascot-transp.png"
              alt="Chores & Rewards"
              style={{ width: 34, height: 34, objectFit: 'contain' }}
            />
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#f8fafc' }}>
              Chores & Rewards
            </div>
          </div>
          <button
            type="button"
            onClick={() => dispatch(setMobileDrawerOpen(false))}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.6)',
              fontSize: '1.25rem',
              cursor: 'pointer',
              padding: 4,
            }}
            aria-label="Close menu"
          >
            <i className="fas fa-times" />
          </button>
        </div>

        {/* Profile Card Header */}
        {activeUser && (
          <div
            style={{
              padding: '12px 14px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(255, 255, 255, 0.02)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
              <img
                src={resolveAvatarUrl(activeUser.avatar)}
                alt={activeUser.name}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: `2px solid ${activeUser.color || '#3b82f6'}`,
                  flexShrink: 0,
                }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activeUser.name}
                </div>
                <div style={{ fontSize: '0.72rem', color: isParent ? '#f59e0b' : isChild ? '#34d399' : '#60a5fa', fontWeight: 600 }}>
                  {isParent ? 'Parent Mode 🛡️' : isChild ? 'Child View ⭐' : 'Family Kiosk 👨‍👩‍👧‍👦'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                dispatch(setMobileDrawerOpen(false));
                setProfileSwitcherOpen(true);
              }}
              style={{
                background: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.35)',
                borderRadius: 8,
                padding: '6px 12px',
                color: '#93c5fd',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Switch
            </button>
          </div>
        )}

        {/* Quick Tools */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 6,
            padding: '10px 14px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(255, 255, 255, 0.015)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              dispatch(setMobileDrawerOpen(false));
              setVisualTimerOpen(true);
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: '8px 4px',
              borderRadius: 8,
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#cbd5e1',
              cursor: 'pointer',
              fontSize: '0.72rem',
              fontWeight: 600,
            }}
          >
            <i className="fas fa-stopwatch" style={{ fontSize: '1.05rem', color: '#38bdf8' }} />
            <span>Timer</span>
          </button>

          <button
            type="button"
            onClick={() => {
              dispatch(setMobileDrawerOpen(false));
              setScreensaverOpen(true);
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: '8px 4px',
              borderRadius: 8,
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#cbd5e1',
              cursor: 'pointer',
              fontSize: '0.72rem',
              fontWeight: 600,
            }}
          >
            <i className="fas fa-tv" style={{ fontSize: '1.05rem', color: '#a855f7' }} />
            <span>Clock</span>
          </button>

          <button
            type="button"
            onClick={toggleMute}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              padding: '8px 4px',
              borderRadius: 8,
              background: muted ? 'rgba(239, 68, 68, 0.14)' : 'rgba(16, 185, 129, 0.12)',
              border: `1px solid ${muted ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.3)'}`,
              color: muted ? '#f87171' : '#4ade80',
              cursor: 'pointer',
              fontSize: '0.72rem',
              fontWeight: 600,
            }}
          >
            <i className={`fas ${muted ? 'fa-volume-xmark' : 'fa-volume-high'}`} style={{ fontSize: '1.05rem' }} />
            <span>{muted ? 'Muted' : 'Sound'}</span>
          </button>
        </div>

        {/* Drawer Body Navigation */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', padding: '6px 10px 2px' }}>
            Main Navigation
          </div>

          {PRIMARY_ITEMS.map((item) => {
            if (item.hideForChild && isChild) return null;
            if (item.parentOnly && !isParent) return null;
            const isActive = activeView === item.id || (item.id === 'rewards' && activeView === 'redeemed');

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md, 8px)',
                  background: isActive ? 'rgba(59, 130, 246, 0.18)' : 'transparent',
                  border: isActive ? `1px solid ${activeColor}55` : '1px solid transparent',
                  color: isActive ? activeColor : '#e2e8f0',
                  fontSize: '0.92rem',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease',
                  width: '100%',
                }}
              >
                <i className={item.icon} style={{ width: 22, textAlign: 'center', fontSize: '1rem', color: isActive ? activeColor : 'rgba(255,255,255,0.6)' }} />
                <span>{item.label}</span>
              </button>
            );
          })}

          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '8px 6px' }} />

          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', padding: '6px 10px 2px' }}>
            More & Settings
          </div>

          {SECONDARY_ITEMS.map((item) => {
            if (item.parentOnly && !isParent) return null;
            const isActive = activeView === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md, 8px)',
                  background: isActive ? 'rgba(59, 130, 246, 0.18)' : 'transparent',
                  border: isActive ? `1px solid ${activeColor}55` : '1px solid transparent',
                  color: isActive ? activeColor : '#e2e8f0',
                  fontSize: '0.92rem',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease',
                  width: '100%',
                }}
              >
                <i className={item.icon} style={{ width: 22, textAlign: 'center', fontSize: '1rem', color: isActive ? activeColor : 'rgba(255,255,255,0.6)' }} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
