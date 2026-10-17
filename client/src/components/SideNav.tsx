import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { apiPost } from '../api';

export const SideNav: React.FC = () => {
  const { adultMode, setAdultMode, openAdultPinModal, activeView, setActiveView, scrollToSection, showToast } =
    useApp();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('sideNavCollapsed') === 'true';
  });

  useEffect(() => {
    document.body.classList.toggle('side-nav-body-collapsed', collapsed);
  }, [collapsed]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sideNavCollapsed', String(next));
      return next;
    });
  };

  const handleLockToggle = async () => {
    if (adultMode) {
      await apiPost('adult_logout', {});
      setAdultMode(false);
      showToast('Locked Adult Mode 🔒');
    } else {
      openAdultPinModal();
    }
  };

  return (
    <>
      <button
        id="side-nav-toggle"
        className={collapsed ? 'side-nav-toggle-collapsed' : ''}
        title={collapsed ? 'Open sidebar' : 'Close sidebar'}
        aria-label="Toggle sidebar"
        onClick={toggleCollapsed}
      >
        <i className={`fas ${collapsed ? 'fa-chevron-right' : 'fa-chevron-left'}`} />
      </button>

      <nav id="side-nav" className={collapsed ? 'side-nav-collapsed' : ''} aria-label="Section navigation">
        <button
          type="button"
          className="side-nav-btn"
          title="Dashboard"
          onClick={() => scrollToSection('dashboard-section')}
        >
          <i className="fas fa-gauge-high" />
        </button>

        <div className="side-nav-divider" style={{ marginTop: 8 }} />

        <button
          type="button"
          className="side-nav-btn"
          title="Notes"
          onClick={() => scrollToSection('notes-kanban-section')}
        >
          <i className="fas fa-sticky-note" />
        </button>
        <button
          type="button"
          className="side-nav-btn"
          title="Available Rewards"
          onClick={() => scrollToSection('rewards-section')}
        >
          <i className="fas fa-trophy" />
        </button>
        <button
          type="button"
          className="side-nav-btn"
          title="Family Events"
          onClick={() => scrollToSection('events-section')}
        >
          <i className="fas fa-calendar-alt" />
        </button>
        <button
          type="button"
          className="side-nav-btn"
          title="Weekly Meal Plan"
          onClick={() => scrollToSection('meal-planner-section')}
        >
          <i className="fas fa-utensils" />
        </button>
        <button
          type="button"
          className="side-nav-btn"
          title="Shopping List"
          onClick={() => scrollToSection('shopping-list-section')}
        >
          <i className="fas fa-cart-shopping" />
        </button>
        <button
          type="button"
          className="side-nav-btn"
          title="Meal Library"
          onClick={() => scrollToSection('meal-library-section')}
        >
          <i className="fas fa-book-open" />
        </button>
        <button
          type="button"
          className="side-nav-btn"
          title="Family Members Chores"
          onClick={() => scrollToSection('kanban')}
        >
          <i className="fas fa-house" />
        </button>

        <div className="side-nav-divider" />

        {adultMode && (
          <>
            <button
              type="button"
              className="side-nav-btn"
              title="Add Chores"
              onClick={() => scrollToSection('add-chores-section')}
            >
              <i className="fas fa-tasks" />
            </button>
            <button
              type="button"
              className="side-nav-btn"
              title="Create Reward"
              onClick={() => scrollToSection('create-reward-section')}
            >
              <i className="fas fa-gift" />
            </button>
          </>
        )}
        <button
          type="button"
          className="side-nav-btn"
          title="Redeemed Rewards"
          onClick={() => scrollToSection('redeemed-section')}
        >
          <i className="fas fa-medal" />
        </button>
        {adultMode && (
          <button
            type="button"
            className="side-nav-btn"
            title="Organise"
            onClick={() => scrollToSection('organise-section')}
          >
            <i className="fas fa-folder-open" />
          </button>
        )}

        <div className="side-nav-divider" />

        <button
          type="button"
          className={`side-nav-btn side-nav-link ${activeView === 'activity_log' ? 'side-nav-active' : ''}`}
          title="Activity Log"
          onClick={() => setActiveView('activity_log')}
        >
          <i className="fas fa-history" />
        </button>
        <button
          type="button"
          className={`side-nav-btn side-nav-link ${activeView === 'chore_history' ? 'side-nav-active' : ''}`}
          title="Chore History"
          onClick={() => setActiveView('chore_history')}
        >
          <i className="fas fa-chart-bar" />
        </button>
        {adultMode && (
          <button
            type="button"
            className={`side-nav-btn side-nav-link ${activeView === 'settings' ? 'side-nav-active' : ''}`}
            title="Settings"
            onClick={() => setActiveView('settings')}
          >
            <i className="fas fa-cog" />
          </button>
        )}
        <button
          type="button"
          className={`side-nav-btn ${adultMode ? 'unlocked' : ''}`}
          id="side-nav-lock-btn"
          title="Admin lock / unlock"
          onClick={handleLockToggle}
        >
          <i className={`fas ${adultMode ? 'fa-lock-open' : 'fa-lock'}`} />
        </button>
      </nav>
    </>
  );
};
