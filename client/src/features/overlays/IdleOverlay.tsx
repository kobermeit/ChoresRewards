import React, { useEffect, useState } from 'react';
import type { IdlePhase } from '../../hooks/useIdlePhase';

interface IdleOverlayProps {
  phase: IdlePhase;
  onWake: () => void;
}

/**
 * The two sleep states of the app, in one place.
 *
 * - `ambient`: everything is ghosted behind a single full-screen wake layer, so
 *   the first tap wakes the screen instead of hitting an invisible card.
 * - `screensaver`: the living scene alone, with a big clock. Any interaction
 *   wakes it. Running timers stay visible because `.cr-keep-solid` is exempt
 *   from the fade (see styles/idlePhases.css).
 *
 * The wake itself is owned by `useIdlePhase()`: it captures the first contact
 * and swallows the gesture (plus the click the browser synthesises after it),
 * so waking never also activates whatever card sits under the finger. This
 * layer stays as the visible hit target / affordance.
 */
export const IdleOverlay: React.FC<IdleOverlayProps> = React.memo(({ phase, onWake }) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (phase !== 'screensaver') return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [phase]);

  if (phase === 'active') return null;

  return (
    <>
      <div className="cr-idle-wake" onClick={onWake} aria-hidden="true" />
      {phase === 'screensaver' && (
        <div className="cr-idle-clock" aria-hidden="true">
          <div className="cr-idle-clock__time">
            {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="cr-idle-clock__date">
            {now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>
      )}
    </>
  );
});

IdleOverlay.displayName = 'IdleOverlay';
export default IdleOverlay;
