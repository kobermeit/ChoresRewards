import React from 'react';
import { SyncSplashOverlay } from '../features/overlays/SyncSplashOverlay';
import { ScreensaverOverlay } from '../features/overlays/ScreensaverOverlay';
import { VisualTimerModal } from '../features/overlays/VisualTimerModal';
import { KidsPlayWidgetModal } from '../features/overlays/KidsPlayWidgetModal';
import { ChoreModal } from './ChoreModal';
import { SeasonalFallingSnow } from './SeasonalFallingSnow';

export const Overlays: React.FC = () => {
  return (
    <>
      <SyncSplashOverlay />
      <ScreensaverOverlay />
      <VisualTimerModal />
      <KidsPlayWidgetModal />
      <ChoreModal />
      <SeasonalFallingSnow />
    </>
  );
};
