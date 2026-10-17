import React, { useState, useRef } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { SideNav } from './components/SideNav';
import { SetupWizard } from './components/SetupWizard';
import { PinModals } from './components/PinModals';
import { DashboardSection } from './components/DashboardSection';
import { ChoresKanbanSection } from './components/ChoresKanbanSection';
import { RewardsSection } from './components/RewardsSection';
import { MealAndShoppingSection } from './components/MealAndShoppingSection';
import { CalendarAndNotesSection } from './components/CalendarAndNotesSection';
import { OrganiseSection } from './components/OrganiseSection';
import { SettingsView, ActivityLogView, ChoreHistoryView } from './components/SettingsAndLogsViews';
import { Overlays } from './components/Overlays';

const MainShell: React.FC<{
  adultPinOpen: boolean;
  onCloseAdultPin: () => void;
  onAdultPinSuccess?: () => void;
}> = ({ adultPinOpen, onCloseAdultPin, onAdultPinSuccess }) => {
  const { data, loading, activeView } = useApp();

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
    <div className="app-wrapper">
      <SideNav />
      <div className="main-content" style={{ flex: 1, minWidth: 0 }}>
        <Header />
        <main className="container" style={{ maxWidth: 1600, margin: '0 auto', padding: '16px 24px 64px' }}>
          {activeView === 'settings' ? (
            <SettingsView />
          ) : activeView === 'activity_log' ? (
            <ActivityLogView />
          ) : activeView === 'chore_history' ? (
            <ChoreHistoryView />
          ) : (
            <>
              <DashboardSection />
              <ChoresKanbanSection />
              <RewardsSection />
              <MealAndShoppingSection />
              <CalendarAndNotesSection />
              <OrganiseSection />
            </>
          )}
        </main>
      </div>

      <PinModals
        adultPinOpen={adultPinOpen}
        onCloseAdultPin={onCloseAdultPin}
        onAdultPinSuccess={onAdultPinSuccess}
      />
      <Overlays />
    </div>
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
