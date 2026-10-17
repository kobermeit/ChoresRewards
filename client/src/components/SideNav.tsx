import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { apiPost } from '../api';

export const SideNav: React.FC = () => {
  const { data, adultMode, setAdultMode, openAdultPinModal, activeView, setActiveView, scrollToSection, showToast } =
    useApp();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('sideNavCollapsed') === 'true';
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sideNavCollapsed', String(next));
      return next;
    });
  };

  const navItems: Array<{
    id: string;
    label: string;
    icon: string;
    color: string;
    adminOnly?: boolean;
    conditional?: boolean;
  }> = [
    { id: 'dashboard-section', label: 'Today', icon: 'fa-home', color: '#38bdf8' },
    { id: 'kanban', label: 'Chores', icon: 'fa-check-circle', color: '#4ade80' },
    { id: 'rewards-section', label: 'Rewards', icon: 'fa-trophy', color: '#fbbf24' },
    {
      id: 'events-section',
      label: 'Family Events',
      icon: 'fa-calendar-alt',
      color: '#60a5fa',
      conditional: Boolean(data?.google_calendar?.enabled),
    },
    { id: 'meal-planner-section', label: 'Meal Planner', icon: 'fa-utensils', color: '#fb923c' },
    { id: 'shopping-list-section', label: 'Shopping List', icon: 'fa-shopping-cart', color: '#34d399' },
    { id: 'meal-library-section', label: 'Meal Library', icon: 'fa-book-open', color: '#f472b6' },
    { id: 'notes-kanban-section', label: 'Notes', icon: 'fa-sticky-note', color: '#fde047' },
    { id: 'add-chores-section', label: 'Add Chores', icon: 'fa-plus-circle', color: '#e879f9', adminOnly: true },
    { id: 'create-reward-section', label: 'Create Reward', icon: 'fa-gift', color: '#c084fc', adminOnly: true },
    { id: 'redeemed-section', label: 'Redeemed', icon: 'fa-history', color: '#94a3b8', adminOnly: true },
    { id: 'organise-section', label: 'Organise', icon: 'fa-car', color: '#f59e0b', adminOnly: true },
  ];

  const handleLockToggle = async () => {
    if (adultMode) {
      await apiPost('adult_logout');
      setAdultMode(false);
      showToast('Switched to Child Mode 🔒', { type: 'info' });
    } else {
      openAdultPinModal();
    }
  };

  return (
    <aside
      id="side-nav"
      className={`side-nav ${collapsed ? 'collapsed' : ''}`}
      style={{
        width: collapsed ? 64 : 220,
        transition: 'width 0.2s ease',
        flexShrink: 0,
        background: 'var(--cr-surface-1)',
        borderRight: '1px solid var(--cr-surface-border)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '12px 8px',
      }}
    >
      <div>
        <button
          type="button"
          id="side-nav-toggle"
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            width: '100%',
            background: 'var(--cr-surface-2)',
            border: '1px solid var(--cr-surface-border)',
            color: 'var(--cr-text-primary)',
            borderRadius: 10,
            padding: '8px 10px',
            cursor: 'pointer',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
          }}
        >
          {!collapsed && <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Navigation</span>}
          <i className={`fas ${collapsed ? 'fa-chevron-right' : 'fa-chevron-left'}`} />
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {navItems.map((item) => {
            if (item.conditional === false) return null;
            if (item.adminOnly && !adultMode) return null;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                title={item.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--cr-text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontWeight: 600,
                  fontSize: '0.92rem',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                }}
              >
                <i className={`fas ${item.icon}`} style={{ color: item.color, width: 20, textAlign: 'center' }} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}

          <hr style={{ borderColor: 'var(--cr-surface-border)', margin: '8px 0' }} />

          <button
            type="button"
            onClick={() => setActiveView('activity_log')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
              borderRadius: 10,
              background: activeView === 'activity_log' ? 'var(--cr-surface-2)' : 'transparent',
              border: 'none',
              color: 'var(--cr-text-primary)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.92rem',
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}
          >
            <i className="fas fa-list-alt" style={{ color: '#38bdf8', width: 20, textAlign: 'center' }} />
            {!collapsed && <span>Activity Log</span>}
          </button>

          <button
            type="button"
            onClick={() => setActiveView('chore_history')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
              borderRadius: 10,
              background: activeView === 'chore_history' ? 'var(--cr-surface-2)' : 'transparent',
              border: 'none',
              color: 'var(--cr-text-primary)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.92rem',
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}
          >
            <i className="fas fa-chart-pie" style={{ color: '#a855f7', width: 20, textAlign: 'center' }} />
            {!collapsed && <span>Chore History</span>}
          </button>

          {adultMode && (
            <button
              type="button"
              onClick={() => setActiveView('settings')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                borderRadius: 10,
                background: activeView === 'settings' ? 'var(--cr-surface-2)' : 'transparent',
                border: 'none',
                color: 'var(--cr-text-primary)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.92rem',
                justifyContent: collapsed ? 'center' : 'flex-start',
              }}
            >
              <i className="fas fa-cog" style={{ color: '#94a3b8', width: 20, textAlign: 'center' }} />
              {!collapsed && <span>Settings</span>}
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        id="side-nav-lock-btn"
        onClick={handleLockToggle}
        style={{
          marginTop: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 10,
          padding: '10px 12px',
          borderRadius: 10,
          background: adultMode ? 'rgba(34, 197, 94, 0.15)' : 'var(--cr-surface-2)',
          color: adultMode ? '#4ade80' : 'var(--cr-text-primary)',
          border: '1px solid var(--cr-surface-border)',
          cursor: 'pointer',
          fontWeight: 700,
        }}
      >
        <i className={`fas ${adultMode ? 'fa-lock-open' : 'fa-lock'}`} />
        {!collapsed && <span>{adultMode ? 'Adult Mode' : 'Unlock Admin'}</span>}
      </button>
    </aside>
  );
};
