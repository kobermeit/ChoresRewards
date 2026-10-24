import React, { useState, useRef, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { SideNav } from './components/SideNav';
import { SetupWizard } from './components/SetupWizard';
import { PinModals } from './components/PinModals';
import { DashboardSection } from './components/DashboardSection';
import { ChoresKanbanSection } from './components/ChoresKanbanSection';
import { RewardsSection, RedeemedRewardsSection } from './components/RewardsSection';
import { MealAndShoppingSection } from './components/MealAndShoppingSection';
import { NotesSection } from './components/CalendarAndNotesSection';
import { CalendarView } from './components/CalendarView';
import { OrganiseSection } from './components/OrganiseSection';
import { SettingsView, ActivityLogView, ChoreHistoryView } from './components/SettingsAndLogsViews';
import { HelpView } from './components/HelpTooltipAndView';
import { Overlays } from './components/Overlays';
import { Container, Button } from './components/ui';

const MainShell: React.FC<{
  adultPinOpen: boolean;
  onCloseAdultPin: () => void;
  onAdultPinSuccess?: () => void;
}> = ({ adultPinOpen, onCloseAdultPin, onAdultPinSuccess }) => {
  const { data, loading, isSyncing, activeView, isParent, setProfileSwitcherOpen, setActiveView } = useApp();

  const [visitedViews, setVisitedViews] = useState<Record<string, boolean>>(() => ({
    [activeView || 'dashboard']: true,
  }));

  useEffect(() => {
    if (activeView) {
      setVisitedViews((prev) => (prev[activeView] ? prev : { ...prev, [activeView]: true }));
    }
  }, [activeView]);

  if (loading && !data) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
        }}
      >
        <div style={{ fontSize: '3rem' }}>🏠</div>
        <div style={{ fontWeight: 700, fontSize: '1.1rem', opacity: 0.8 }}>Loading Family Hub...</div>
      </div>
    );
  }

  if (data?.needs_setup) {
    return <SetupWizard />;
  }

  return (
    <>
      <SideNav />
      <div id="site-content">
        <Header />

        {/* Cached Views for Instant 0ms Tab Transitions */}
        {visitedViews['dashboard'] && (
          <div style={{ display: activeView === 'dashboard' ? 'block' : 'none' }}>
            <DashboardSection />
          </div>
        )}

        {visitedViews['chores'] && (
          <div style={{ display: activeView === 'chores' ? 'block' : 'none' }}>
            <ChoresKanbanSection isStandalonePage />
          </div>
        )}

        {visitedViews['rewards'] && (
          <div style={{ display: activeView === 'rewards' ? 'block' : 'none' }}>
            <RewardsSection isStandalonePage />
          </div>
        )}

        {visitedViews['redeemed'] && (
          <div style={{ display: activeView === 'redeemed' ? 'block' : 'none' }}>
            <RedeemedRewardsSection isStandalonePage />
          </div>
        )}

        {visitedViews['meals'] && (
          <div style={{ display: activeView === 'meals' ? 'block' : 'none' }}>
            <MealAndShoppingSection subView="meals" isStandalonePage />
          </div>
        )}

        {visitedViews['shopping'] && (
          <div style={{ display: activeView === 'shopping' ? 'block' : 'none' }}>
            <MealAndShoppingSection subView="shopping" isStandalonePage />
          </div>
        )}

        {visitedViews['library'] && (
          <div style={{ display: activeView === 'library' ? 'block' : 'none' }}>
            <MealAndShoppingSection subView="library" isStandalonePage />
          </div>
        )}

        {visitedViews['notes'] && (
          <div style={{ display: activeView === 'notes' ? 'block' : 'none' }}>
            <NotesSection isStandalonePage />
          </div>
        )}

        {visitedViews['calendar'] && (
          <div style={{ display: activeView === 'calendar' ? 'block' : 'none' }}>
            <CalendarView />
          </div>
        )}

        {visitedViews['organise'] && (
          <div style={{ display: activeView === 'organise' ? 'block' : 'none' }}>
            <OrganiseSection isStandalonePage />
          </div>
        )}

        {visitedViews['settings'] && (
          <div style={{ display: activeView === 'settings' ? 'block' : 'none' }}>
            <Container maxWidth={1200} style={{ paddingBottom: 64 }}>
              {isParent ? (
                <SettingsView />
              ) : (
                <div
                  style={{
                    maxWidth: 580,
                    margin: '60px auto',
                    padding: '36px 24px',
                    textAlign: 'center',
                    background: 'rgba(15, 23, 42, 0.8)',
                    borderRadius: 'var(--modal-radius)',
                    border: '1px solid var(--color-border-subtle)',
                    boxShadow: 'var(--shadow-lg)',
                  }}
                >
                  <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔒</div>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 8 }}>
                    Parent Authorisation Required
                  </h2>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.92rem', lineHeight: 1.5, marginBottom: 24 }}>
                    System settings and configuration can only be accessed by a Parent profile.
                  </p>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                    <Button
                      variant="primary"
                      onClick={() => setProfileSwitcherOpen(true)}
                    >
                      Switch to Parent
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setActiveView('dashboard')}
                    >
                      Return to Dashboard
                    </Button>
                  </div>
                </div>
              )}
            </Container>
          </div>
        )}

        {visitedViews['activity_log'] && (
          <div style={{ display: activeView === 'activity_log' ? 'block' : 'none' }}>
            <Container maxWidth={1200} style={{ paddingBottom: 64 }}>
              <ActivityLogView />
            </Container>
          </div>
        )}

        {visitedViews['chore_history'] && (
          <div style={{ display: activeView === 'chore_history' ? 'block' : 'none' }}>
            <Container maxWidth={1200} style={{ paddingBottom: 64 }}>
              <ChoreHistoryView />
            </Container>
          </div>
        )}

        {visitedViews['help'] && (
          <div style={{ display: activeView === 'help' ? 'block' : 'none' }}>
            <Container maxWidth={1200} style={{ paddingBottom: 64 }}>
              <HelpView />
            </Container>
          </div>
        )}
      </div>

      <PinModals
        adultPinOpen={adultPinOpen}
        onCloseAdultPin={onCloseAdultPin}
        onAdultPinSuccess={onAdultPinSuccess}
      />
      <Overlays />

      {/* Slack / Discord style seamless fast-sync toast indicator */}
      {isSyncing && (
        <div
          style={{
            position: 'fixed',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 16px',
            borderRadius: 999,
            background: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(59, 130, 246, 0.4)',
            color: '#93c5fd',
            fontSize: '0.82rem',
            fontWeight: 700,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <i className="fas fa-arrows-rotate fa-spin" style={{ color: '#3b82f6', fontSize: '0.8rem' }} />
          <span>Syncing Family Hub…</span>
        </div>
      )}
    </>
  );
};

import { TimerProvider } from './context/TimerContext';
import { ActiveTimersMiniDock } from './components/ActiveTimersMiniDock';

export const App: React.FC = () => {
  const [adultPinOpen, setAdultPinOpen] = useState(false);
  const adultSuccessCallbackRef = useRef<(() => void) | undefined>(undefined);

  const handleRequestAdultPin = (cb?: () => void) => {
    adultSuccessCallbackRef.current = cb;
    setAdultPinOpen(true);
  };

  return (
    <AppProvider onRequestAdultPin={handleRequestAdultPin}>
      <TimerProvider>
        <MainShell
          adultPinOpen={adultPinOpen}
          onCloseAdultPin={() => setAdultPinOpen(false)}
          onAdultPinSuccess={() => {
            const cb = adultSuccessCallbackRef.current;
            adultSuccessCallbackRef.current = undefined;
            cb?.();
          }}
        />
        <ActiveTimersMiniDock />
      </TimerProvider>
    </AppProvider>
  );
};

export default App;
