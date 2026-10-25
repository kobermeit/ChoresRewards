import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useNavigation } from '../../hooks/useSettings';
import { Button, Select, WipBanner } from '../../components/ui';
import { SetupWizard } from '../../components/SetupWizard';
import { SeasonalSettingsView } from '../../components/SeasonalSettingsView';
import { GeneralSettingsTab } from './tabs/GeneralSettingsTab';
import { FamilySettingsTab } from './tabs/FamilySettingsTab';
import { ChoresSettingsTab } from './tabs/ChoresSettingsTab';
import { ExtraChoresSettingsTab } from './tabs/ExtraChoresSettingsTab';
import { SoundsSettingsTab } from './tabs/SoundsSettingsTab';
import { NotificationsSettingsTab } from './tabs/NotificationsSettingsTab';
import { CalendarSettingsTab } from './tabs/CalendarSettingsTab';
import { ScreensaverSettingsTab } from './tabs/ScreensaverSettingsTab';
import { QuizSettingsTab } from './tabs/QuizSettingsTab';
import { NotionSettingsTab } from './tabs/NotionSettingsTab';

export type SettingsTabId =
  | 'general'
  | 'family'
  | 'chores'
  | 'extra'
  | 'setup'
  | 'seasonal'
  | 'sounds'
  | 'discord'
  | 'calendar'
  | 'screensaver'
  | 'quiz'
  | 'notion';

export const SettingsView: React.FC = () => {
  const { data } = useApp();
  const { navigate: setActiveView } = useNavigation();
  const [tab, setTab] = useState<SettingsTabId>('general');

  // Listen for custom tab navigation events (e.g. from SetupWizard or shortcut links)
  useEffect(() => {
    const handleNavigate = (e: any) => {
      if (e.detail) setTab(e.detail);
    };
    window.addEventListener('navigate-settings-tab', handleNavigate);
    return () => window.removeEventListener('navigate-settings-tab', handleNavigate);
  }, []);

  const navGroups = [
    {
      group: 'System & Preferences',
      items: [
        { id: 'general', label: 'General & Security', icon: 'fas fa-sliders', badge: null },
        { id: 'setup', label: 'System Defaults', icon: 'fas fa-wand-magic-sparkles', badge: null },
        { id: 'seasonal', label: 'Seasonal Themes', icon: 'fas fa-wand-magic-sparkles', badge: null },
        { id: 'screensaver', label: 'Screensaver', icon: 'fas fa-image', badge: null },
        { id: 'sounds', label: 'Sound FX', icon: 'fas fa-volume-high', badge: null },
      ],
    },
    {
      group: 'Household & Tasks',
      items: [
        { id: 'family', label: 'Family Members', icon: 'fas fa-users', badge: data?.family?.length ? `${data.family.length}` : null },
        { id: 'chores', label: 'All Chores Catalog', icon: 'fas fa-broom', badge: null },
        { id: 'extra', label: 'Extra Bonus Pool', icon: 'fas fa-bolt', badge: null },
        { id: 'quiz', label: 'Daily Brain Quiz', icon: 'fas fa-brain', badge: null },
      ],
    },
    {
      group: 'Connected Integrations',
      items: [
        { id: 'calendar', label: 'Google Calendar', icon: 'fas fa-calendar-days', badge: data?.google_calendar?.enabled ? 'Connected' : 'Off' },
        { id: 'discord', label: 'Discord Webhook', icon: 'fab fa-discord', badge: null },
        { id: 'notion', label: 'Notion Recipes', icon: 'fas fa-book-open', badge: data?.notion?.configured ? 'Linked' : null },
      ],
    },
  ];

  return (
    <div style={{ padding: '16px 0 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '1.6rem', fontWeight: 800 }}>⚙️ Household Settings</h2>
          <p style={{ margin: 0, color: 'var(--cr-text-secondary)', fontSize: '0.88rem' }}>
            Manage family profiles, task schedules, integrations, and display preferences.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setActiveView('dashboard')}
          variant="secondary"
          size="sm"
          icon="fas fa-arrow-left"
        >
          Back to Dashboard
        </Button>
      </div>

      {/* Mobile Category Dropdown Selector (Active on screens <= 768px) */}
      <div className="settings-mobile-category-picker" style={{ marginBottom: 16 }}>
        <Select
          label="Category"
          value={tab}
          onChange={(e) => setTab(e.target.value as SettingsTabId)}
          aria-label="Settings Category"
        >
          {navGroups.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label} {item.badge ? `(${item.badge})` : ''}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(220px, 260px) 1fr',
          gap: 24,
          alignItems: 'flex-start',
        }}
        className="settings-layout-grid"
      >
        {/* Left Navigation Sidebar (Hidden on mobile via CSS) */}
        <div
          className="settings-nav-sidebar"
          style={{
            background: 'var(--cr-surface-1)',
            border: '1px solid var(--cr-surface-border)',
            borderRadius: 18,
            padding: '14px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            position: 'sticky',
            top: 80,
          }}
        >
          {navGroups.map((g, gIdx) => (
            <div key={gIdx} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--cr-text-secondary)',
                  padding: '4px 10px 6px',
                  opacity: 0.8,
                }}
              >
                {g.group}
              </div>
              {g.items.map((item) => {
                const isActive = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id as any)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: '9px 12px',
                      borderRadius: 10,
                      border: 'none',
                      background: isActive ? 'var(--color-primary-subtle, rgba(2, 132, 199, 0.18))' : 'transparent',
                      color: isActive ? '#ffffff' : 'var(--color-text-secondary)',
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '0.86rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      outline: 'none',
                      borderLeft: isActive ? '3px solid var(--color-primary-highlight, #38bdf8)' : '3px solid transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <i
                        className={item.icon}
                        style={{
                          width: 16,
                          textAlign: 'center',
                          color: isActive ? 'var(--color-primary-highlight, #38bdf8)' : 'var(--color-text-muted)',
                        }}
                      />
                      <span style={{ color: isActive ? '#ffffff' : 'inherit' }}>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          padding: '2px 7px',
                          borderRadius: 999,
                          fontWeight: 700,
                          background:
                            item.badge === 'Connected' || item.badge === 'Active' || item.badge === 'Linked'
                              ? 'rgba(34, 197, 94, 0.2)'
                              : 'rgba(255, 255, 255, 0.08)',
                          color:
                            item.badge === 'Connected' || item.badge === 'Active' || item.badge === 'Linked'
                              ? '#4ade80'
                              : 'var(--cr-text-secondary)',
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Right Content Column */}
        <div style={{ minWidth: 0, width: '100%' }}>
          <WipBanner />

          {tab === 'setup' && <SetupWizard embedded />}
          {tab === 'seasonal' && <SeasonalSettingsView />}
          {tab === 'general' && <GeneralSettingsTab />}
          {tab === 'family' && <FamilySettingsTab />}
          {tab === 'chores' && <ChoresSettingsTab />}
          {tab === 'extra' && <ExtraChoresSettingsTab />}
          {tab === 'sounds' && <SoundsSettingsTab onNavigateToSeasonal={() => setTab('seasonal')} />}
          {tab === 'discord' && <NotificationsSettingsTab />}
          {tab === 'calendar' && <CalendarSettingsTab />}
          {tab === 'screensaver' && <ScreensaverSettingsTab />}
          {tab === 'quiz' && <QuizSettingsTab />}
          {tab === 'notion' && <NotionSettingsTab />}
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
