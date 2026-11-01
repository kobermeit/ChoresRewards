import { useEffect } from 'react';

const FLIGHT_MS = 15000; // time spent crossing screen
const GAP_MS = 4000;     // time off-screen between passes

/**
 * Hook driving Santa's flight path via JS transform matrix on the compositor.
 * Alternates direction, wanders vertically between high and low passes,
 * banks into climbs and dives, and ramps opacity at the edges.
 */
export function useSleighFlight(
  sleighRef: React.RefObject<HTMLDivElement | null>,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) {
      if (sleighRef.current) sleighRef.current.style.opacity = '0';
      return;
    }

    const el = sleighRef.current;
    if (!el) return;

    let animId: number;
    let lastTime = performance.now();
    let isTabVisible = !document.hidden;

    const flight = {
      phase: 'gap' as 'gap' | 'fly',
      t: 0,
      dir: 1, // 1: left to right, -1: right to left
    };

    const loop = (now: number) => {
      if (!isTabVisible) {
        animId = requestAnimationFrame(loop);
        return;
      }

      const dt = Math.min(now - lastTime, 50);
      lastTime = now;

      flight.t += dt;

      if (flight.phase === 'gap') {
        el.style.opacity = '0';
        if (flight.t >= GAP_MS) {
          flight.t = 0;
          flight.phase = 'fly';
          flight.dir *= -1; // alternate direction
        }
      } else {
        const W = window.innerWidth;
        const H = window.innerHeight;
        const p = Math.min(1, flight.t / FLIGHT_MS);
        const pad = 300;
        const startX = flight.dir === 1 ? -pad : W + pad;
        const endX = flight.dir === 1 ? W + pad : -pad;
        const x = startX + (endX - startX) * p;

        // Vertical wandering: high pass then lower pass (dipping behind top of cards)
        const bandBase = H * (flight.dir === 1 ? 0.15 : 0.26);
        const swell = H * 0.10;
        const wobble = H * 0.02;
        const y = Math.max(
          24,
          bandBase + Math.sin(p * Math.PI * 2.1) * swell + Math.sin(p * Math.PI * 6.3) * wobble
        );

        // Bank into turns
        const slope = Math.cos(p * Math.PI * 2.1) + 0.35 * Math.cos(p * Math.PI * 6.3);
        const rot = slope * 7 * flight.dir;
        const scaleX = flight.dir === 1 ? 1 : -1;

        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${rot.toFixed(2)}deg) scaleX(${scaleX})`;

        // Ramp opacity at edges (first/last 5%) so Santa does not pop
        const edge = 0.05;
        const opacity =
          p < edge ? (p / edge).toFixed(2) : p > 1 - edge ? ((1 - p) / edge).toFixed(2) : '1';
        el.style.opacity = opacity;

        if (p >= 1) {
          flight.phase = 'gap';
          flight.t = 0;
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    const onVisibilityChange = () => {
      isTabVisible = !document.hidden;
      if (isTabVisible) lastTime = performance.now();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelAnimationFrame(animId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (el) el.style.opacity = '0';
    };
  }, [enabled, sleighRef]);
}
