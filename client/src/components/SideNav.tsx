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

  const [activeSection, setActiveSection] = useState<string>('dashboard-section');

  useEffect(() => {
    if (activeView !== 'dashboard') return;

    const sections = [
      'dashboard-section',
      'chores-section',
      'rewards-section',
      'redeemed-section',
      'meal-planner-section',
      'shopping-list-section',
      'meal-library-section',
      'events-section',
      'notes-kanban-section',
      'organise-section',
    ];

    const handleScroll = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      if (scrollY < 80) {
        setActiveSection('dashboard-section');
        return;
      }

      let current = 'dashboard-section';
      for (const id of sections) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 220) {
            current = id;
          }
        }
      }
      setActiveSection(current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeView]);

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
          className={`side-nav-btn ${activeView === 'dashboard' && activeSection === 'dashboard-section' ? 'side-nav-active' : ''}`}
          title="Dashboard"
          onClick={() => {
            setActiveSection('dashboard-section');
            scrollToSection('dashboard-section');
          }}
        >
          <i className="fas fa-gauge-high" />
        </button>

        <div className="side-nav-divider" style={{ marginTop: 8 }} />

        <button
          type="button"
          className={`side-nav-btn ${activeView === 'dashboard' && activeSection === 'chores-section' ? 'side-nav-active' : ''}`}
          title="Family Members Chores"
          onClick={() => {
            setActiveSection('chores-section');
            scrollToSection('chores-section');
          }}
        >
          <i className="fas fa-house" />
        </button>
        <button
          type="button"
          className={`side-nav-btn ${activeView === 'dashboard' && activeSection === 'rewards-section' ? 'side-nav-active' : ''}`}
          title="Available Rewards"
          onClick={() => {
            setActiveSection('rewards-section');
            scrollToSection('rewards-section');
          }}
        >
          <i className="fas fa-trophy" />
        </button>
        <button
          type="button"
          className={`side-nav-btn ${activeView === 'dashboard' && activeSection === 'redeemed-section' ? 'side-nav-active' : ''}`}
          title="Redeemed Rewards"
          onClick={() => {
            setActiveSection('redeemed-section');
            scrollToSection('redeemed-section');
          }}
        >
          <i className="fas fa-medal" />
        </button>
        <button
          type="button"
          className={`side-nav-btn ${activeView === 'dashboard' && activeSection === 'meal-planner-section' ? 'side-nav-active' : ''}`}
          title="Weekly Meal Plan"
          onClick={() => {
            setActiveSection('meal-planner-section');
            scrollToSection('meal-planner-section');
          }}
        >
          <i className="fas fa-utensils" />
        </button>
        <button
          type="button"
          className={`side-nav-btn ${activeView === 'dashboard' && activeSection === 'shopping-list-section' ? 'side-nav-active' : ''}`}
          title="Shopping List"
          onClick={() => {
            setActiveSection('shopping-list-section');
            scrollToSection('shopping-list-section');
          }}
        >
          <i className="fas fa-cart-shopping" />
        </button>
        <button
          type="button"
          className={`side-nav-btn ${activeView === 'dashboard' && activeSection === 'meal-library-section' ? 'side-nav-active' : ''}`}
          title="Meal Library"
          onClick={() => {
            setActiveSection('meal-library-section');
            scrollToSection('meal-library-section');
          }}
        >
          <i className="fas fa-book-open" />
        </button>
        <button
          type="button"
          className={`side-nav-btn ${activeView === 'dashboard' && activeSection === 'events-section' ? 'side-nav-active' : ''}`}
          title="Family Events"
          onClick={() => {
            setActiveSection('events-section');
            scrollToSection('events-section');
          }}
        >
          <i className="fas fa-calendar-alt" />
        </button>
        <button
          type="button"
          className={`side-nav-btn ${activeView === 'dashboard' && activeSection === 'notes-kanban-section' ? 'side-nav-active' : ''}`}
          title="Notes & Text Pads"
          onClick={() => {
            setActiveSection('notes-kanban-section');
            scrollToSection('notes-kanban-section');
          }}
        >
          <i className="fas fa-sticky-note" />
        </button>

        {adultMode && (
          <button
            type="button"
            className={`side-nav-btn ${activeView === 'dashboard' && activeSection === 'organise-section' ? 'side-nav-active' : ''}`}
            title="Organise"
            onClick={() => {
              setActiveSection('organise-section');
              scrollToSection('organise-section');
            }}
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
        <button
          type="button"
          className={`side-nav-btn side-nav-link ${activeView === 'help' ? 'side-nav-active' : ''}`}
          title="Help & Guide"
          onClick={() => setActiveView('help')}
        >
          <i className="fas fa-circle-question" />
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
