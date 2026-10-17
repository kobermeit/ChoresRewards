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
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 24px 64px' }}>
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
                  borderRadius: 18,
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔒</div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc', marginBottom: 8 }}>
                  Parent Authorisation Required
                </h2>
                <p style={{ color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.5, marginBottom: 24 }}>
                  System settings and configuration can only be accessed by a Parent profile.
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setProfileSwitcherOpen(true)}
                    style={{ padding: '10px 20px', borderRadius: 10 }}
                  >
                    Switch to Parent
                  </button>
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={() => setActiveView('dashboard')}
                    style={{ padding: '10px 20px', borderRadius: 10 }}
                  >
                    Return to Dashboard
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : activeView === 'activity_log' ? (
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 24px 64px' }}>
            <ActivityLogView />
          </div>
        ) : activeView === 'chore_history' ? (
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 24px 64px' }}>
            <ChoreHistoryView />
          </div>
        ) : activeView === 'help' ? (
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 24px 64px' }}>
            <HelpView />
          </div>
        ) : activeView === 'calendar' ? (
          <CalendarView />
        ) : (
          <>
            <DashboardSection />
            <ChoresKanbanSection />
            <RewardsSection />
            <RedeemedRewardsSection />
            <MealAndShoppingSection />
            <NotesSection />
            <OrganiseSection />
          </>
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
