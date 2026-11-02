import { useEffect, useRef, useState } from 'react';
import { useUiPref } from './useSettings';

/** The three stages of a quiet screen. */
export type IdlePhase = 'active' | 'ambient' | 'screensaver';

const ACTIVITY_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

/**
 * ONE idle timer for the whole app.
 *
 * Historically two independent timers existed — `useAmbientIdle` (ghost-faded the
 * cards) and `ScreensaverOverlay`'s own config timer — and they fought: the ghost
 * timer always fired first (2 min vs 5 min) so the screensaver never appeared on
 * its own. This hook replaces both with a single ladder:
 *
 *   active ──(ambientIdleMinutes)──▶ ambient ──(+screensaverMinutes)──▶ screensaver
 *
 * Any interaction drops straight back to `active`. The caller decides what each
 * phase *looks* like; this hook only owns the timing.
 */
export function useIdlePhase(): { phase: IdlePhase; wake: () => void } {
  const [enabled] = useUiPref('ambientIdleEnabled');
  const [minutes] = useUiPref('ambientIdleMinutes');
  const [screensaverMinutes] = useUiPref('screensaverMinutes');
  const [phase, setPhase] = useState<IdlePhase>('active');
  const phaseRef = useRef<IdlePhase>('active');
  const ambientTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screensaverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  phaseRef.current = phase;

  useEffect(() => {
    const clearAll = () => {
      if (ambientTimer.current) clearTimeout(ambientTimer.current);
      if (screensaverTimer.current) clearTimeout(screensaverTimer.current);
      ambientTimer.current = null;
      screensaverTimer.current = null;
    };

    if (!enabled) {
      clearAll();
      setPhase('active');
      return;
    }

    const arm = () => {
      clearAll();
      const ambientMs = Math.max(0.5, minutes || 2) * 60 * 1000;
      const screensaverMs = Math.max(1, screensaverMinutes || 5) * 60 * 1000;
      ambientTimer.current = setTimeout(() => {
        setPhase('ambient');
        screensaverTimer.current = setTimeout(() => setPhase('screensaver'), screensaverMs);
      }, ambientMs);
    };

    // throttle so a pointer that never stops moving does not thrash timers
    let lastActivity = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastActivity < 500) return;
      lastActivity = now;
      // any interaction drops straight back to the live UI
      if (phaseRef.current !== 'active') setPhase('active');
      arm();
    };

    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
    arm();

    return () => {
      clearAll();
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, onActivity));
    };
  }, [enabled, minutes, screensaverMinutes]);

  const wake = () => setPhase('active');

  return { phase, wake };
}

export default useIdlePhase;
