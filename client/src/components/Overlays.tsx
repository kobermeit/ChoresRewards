import React from 'react';
import { SyncSplashOverlay } from '../features/overlays/SyncSplashOverlay';
import { VisualTimerModal } from '../features/overlays/VisualTimerModal';
import { KidsPlayWidgetModal } from '../features/overlays/KidsPlayWidgetModal';
import { ChoreModal } from './ChoreModal';

/**
 * The legacy photo/video `ScreensaverOverlay` is gone: the "Screensaver" menu
 * item now forces the living-scene screensaver (`IdleOverlay` + `useIdlePhase`),
 * so there is exactly one screensaver and one idle timer.
 */
export const Overlays: React.FC = () => {
  return (
    <>
      <SyncSplashOverlay />
      <VisualTimerModal />
      <KidsPlayWidgetModal />
      <ChoreModal />
    </>
  );
};
