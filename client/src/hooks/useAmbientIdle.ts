import { useState, useEffect, useRef } from 'react';
import { useUiPref } from '../hooks/useSettings';

/**
 * Hook to detect user inactivity on the dashboard / chores view.
 * When user is idle for ambientIdleMinutes, isAmbientIdle becomes true,
 * smoothly transitioning cards to high transparency while preserving full clickability.
 * Any touch or mouse interaction immediately wakes the UI.
 */
export function useAmbientIdle(): { isAmbientIdle: boolean; resetIdle: () => void } {
  const [enabled] = useUiPref('ambientIdleEnabled');
  const [minutes] = useUiPref('ambientIdleMinutes');
  const [isAmbientIdle, setIsAmbientIdle] = useState(false);
  const timerRef = useRef<any>(null);

  const resetIdle = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsAmbientIdle(false);

    if (!enabled) return;

    const ms = Math.max(0.5, minutes || 2) * 60 * 1000;
    timerRef.current = setTimeout(() => {
      setIsAmbientIdle(true);
    }, ms);
  };

  useEffect(() => {
    if (!enabled) {
      setIsAmbientIdle(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const events = ['pointerdown', 'touchstart', 'mousedown', 'keydown', 'wheel'];
    const handleActivity = () => {
      resetIdle();
    };

    events.forEach((ev) => window.addEventListener(ev, handleActivity, { passive: true }));
    resetIdle();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((ev) => window.removeEventListener(ev, handleActivity));
    };
  }, [enabled, minutes]);

  return { isAmbientIdle, resetIdle };
}
