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
import { NotesSection, CalendarSection } from './components/CalendarAndNotesSection';
import { OrganiseSection } from './components/OrganiseSection';
import { SettingsView, ActivityLogView, ChoreHistoryView } from './components/SettingsAndLogsViews';
import { HelpView } from './components/HelpTooltipAndView';
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

  const versionBadge = data?.app_version ? (
    <div
      style={{
        position: 'fixed',
        bottom: 8,
        right: 12,
        fontSize: '0.74rem',
        color: '#94a3b8',
        opacity: 0.6,
        pointerEvents: 'none',
        zIndex: 9000,
        fontWeight: 500,
        letterSpacing: '0.3px',
      }}
    >
      v{data.app_version}
    </div>
  ) : null;

  if (data?.needs_setup) {
    return (
      <>
        <SetupWizard />
        {versionBadge}
      </>
    );
  }

  return (
    <>
      <SideNav />
      <div id="site-content">
        <Header />
        {activeView === 'settings' ? (
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 24px 64px' }}>
            <SettingsView />
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
        ) : (
          <>
            <DashboardSection />
            <NotesSection />
            <RewardsSection />
            <CalendarSection />
            <MealAndShoppingSection />
            <ChoresKanbanSection />
            <RedeemedRewardsSection />
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
      {versionBadge}
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
