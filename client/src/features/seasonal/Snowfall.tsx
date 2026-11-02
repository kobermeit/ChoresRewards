import React, { useMemo } from 'react';
import { makeRng } from './scene/terrain';
import './snowfall.css';

interface SnowfallProps {
  /** density multiplier (0.5 – 2). 0 hides the layer. */
  density?: number;
}

/**
 * Falling snow, on TOP of the app (not part of the backdrop).
 *
 * This is how it originally looked and it is the version that reads best: the
 * flakes drift across the cards instead of being hidden behind them. It is a
 * pure CSS overlay — no canvas, no rAF — and it is gated on the seasonal theme
 * being active, never on the idle phase, so it keeps falling while you use the app.
 */
export const Snowfall: React.FC<SnowfallProps> = React.memo(({ density = 1 }) => {
  const flakes = useMemo(() => {
    const rng = makeRng(4242);
    const count = Math.round(52 * Math.max(0, Math.min(2, density)));
    return Array.from({ length: count }, (_, i) => {
      const size = 1.6 + rng() * 2.4;
      return {
        key: i,
        style: {
          left: `${(rng() * 100).toFixed(2)}%`,
          width: `${size.toFixed(1)}px`,
          height: `${size.toFixed(1)}px`,
          opacity: (0.24 + rng() * 0.55).toFixed(2),
          ['--dur' as string]: `${(11 + rng() * 16).toFixed(1)}s`,
          ['--delay' as string]: `${(-rng() * 27).toFixed(1)}s`,
          ['--drift' as string]: `${(-4 + rng() * 12).toFixed(1)}vw`,
          ['--size' as string]: `${size.toFixed(1)}px`,
        } as React.CSSProperties,
      };
    });
  }, [density]);

  if (!density) return null;

  return (
    <div className="cr-snowfall" aria-hidden="true">
      {flakes.map((f) => (
        <i key={f.key} style={f.style} />
      ))}
    </div>
  );
});

Snowfall.displayName = 'Snowfall';
export default Snowfall;
