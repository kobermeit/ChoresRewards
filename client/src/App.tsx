import React, { useState, useRef } from 'react';
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
  const { data, loading, activeView, isParent, setProfileSwitcherOpen, setActiveView } = useApp();

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
        {activeView === 'settings' ? (
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
        ) : activeView === 'activity_log' ? (
          <Container maxWidth={1200} style={{ paddingBottom: 64 }}>
            <ActivityLogView />
          </Container>
        ) : activeView === 'chore_history' ? (
          <Container maxWidth={1200} style={{ paddingBottom: 64 }}>
            <ChoreHistoryView />
          </Container>
        ) : activeView === 'help' ? (
          <Container maxWidth={1200} style={{ paddingBottom: 64 }}>
            <HelpView />
          </Container>
        ) : activeView === 'calendar' ? (
          <CalendarView />
        ) : activeView === 'chores' ? (
          <ChoresKanbanSection isStandalonePage />
        ) : activeView === 'rewards' ? (
          <RewardsSection isStandalonePage />
        ) : activeView === 'redeemed' ? (
          <RedeemedRewardsSection isStandalonePage />
        ) : activeView === 'meals' ? (
          <MealAndShoppingSection subView="meals" isStandalonePage />
        ) : activeView === 'shopping' ? (
          <MealAndShoppingSection subView="shopping" isStandalonePage />
        ) : activeView === 'library' ? (
          <MealAndShoppingSection subView="library" isStandalonePage />
        ) : activeView === 'notes' ? (
          <NotesSection isStandalonePage />
        ) : activeView === 'organise' ? (
          <OrganiseSection isStandalonePage />
        ) : (
          <DashboardSection />
        )}
      </div>

      <PinModals
        adultPinOpen={adultPinOpen}
        onCloseAdultPin={onCloseAdultPin}
        onAdultPinSuccess={onAdultPinSuccess}
      />
      <Overlays />
    </>
  );
};

export const App: React.FC = () => {
  const [adultPinOpen, setAdultPinOpen] = useState(false);
  const adultSuccessCallbackRef = useRef<(() => void) | undefined>(undefined);

  const handleRequestAdultPin = (cb?: () => void) => {
    adultSuccessCallbackRef.current = cb;
    setAdultPinOpen(true);
  };

  return (
    <AppProvider onRequestAdultPin={handleRequestAdultPin}>
      <MainShell
        adultPinOpen={adultPinOpen}
        onCloseAdultPin={() => setAdultPinOpen(false)}
        onAdultPinSuccess={() => {
          const cb = adultSuccessCallbackRef.current;
          adultSuccessCallbackRef.current = undefined;
          cb?.();
        }}
      />
    </AppProvider>
  );
};

export default App;
