import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useUiPref, useNavigation } from '../hooks/useSettings';

export const SideNav: React.FC = () => {
  const { isParent, isChild } = useApp();
  const { activeView, navigate: setActiveView } = useNavigation();
  const [collapsed, setCollapsed] = useUiPref('sideNavCollapsed');

  useEffect(() => {
    document.body.classList.toggle('side-nav-body-collapsed', Boolean(collapsed));
  }, [collapsed]);

  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
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
          className={`side-nav-btn ${activeView === 'dashboard' ? 'side-nav-active' : ''}`}
          title="Dashboard"
          onClick={() => setActiveView('dashboard')}
        >
          <i className="fas fa-gauge-high" />
        </button>

        <div className="side-nav-divider" style={{ marginTop: 8 }} />

        <button
          type="button"
          className={`side-nav-btn ${activeView === 'chores' ? 'side-nav-active' : ''}`}
          title="Family Members Chores"
          onClick={() => setActiveView('chores')}
        >
          <i className="fas fa-house" />
        </button>
        <button
          type="button"
          className={`side-nav-btn ${activeView === 'rewards' || activeView === 'redeemed' ? 'side-nav-active' : ''}`}
          title="Family Rewards"
          onClick={() => setActiveView('rewards')}
        >
          <i className="fas fa-trophy" />
        </button>
        <button
          type="button"
          className={`side-nav-btn ${activeView === 'meals' ? 'side-nav-active' : ''}`}
          title="Weekly Meal Plan"
          onClick={() => setActiveView('meals')}
        >
          <i className="fas fa-utensils" />
        </button>
        <button
          type="button"
          className={`side-nav-btn ${activeView === 'shopping' ? 'side-nav-active' : ''}`}
          title="Shopping List"
          onClick={() => setActiveView('shopping')}
        >
          <i className="fas fa-cart-shopping" />
        </button>
        <button
          type="button"
          className={`side-nav-btn ${activeView === 'library' ? 'side-nav-active' : ''}`}
          title="Meal Library"
          onClick={() => setActiveView('library')}
        >
          <i className="fas fa-book-open" />
        </button>
        <button
          type="button"
          className={`side-nav-btn ${activeView === 'notes' ? 'side-nav-active' : ''}`}
          title="Notes & Text Pads"
          onClick={() => setActiveView('notes')}
        >
          <i className="fas fa-sticky-note" />
        </button>

        {!isChild && (
          <button
            type="button"
            className={`side-nav-btn ${activeView === 'organise' ? 'side-nav-active' : ''}`}
            title="Organise & Bills"
            onClick={() => setActiveView('organise')}
          >
            <i className="fas fa-folder-open" />
          </button>
        )}

        <div className="side-nav-divider" />

        <button
          type="button"
          className={`side-nav-btn side-nav-link ${activeView === 'calendar' ? 'side-nav-active' : ''}`}
          title="Family Calendar"
          onClick={() => setActiveView('calendar')}
        >
          <i className="fas fa-calendar-alt" />
        </button>
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
        {isParent && (
          <button
            type="button"
            className={`side-nav-btn side-nav-link ${activeView === 'settings' ? 'side-nav-active' : ''}`}
            title="Settings"
            onClick={() => setActiveView('settings')}
          >
            <i className="fas fa-cog" />
          </button>
        )}
      </nav>
    </>
  );
};
