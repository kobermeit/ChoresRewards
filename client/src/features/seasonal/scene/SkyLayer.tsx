import React, { useMemo } from 'react';
import { makeRng } from './terrain';

/** Sky, stars, moon and aurora. Snow is a separate on-top overlay (see Snowfall). */
export const SkyLayer: React.FC = React.memo(() => {
  const stars = useMemo(() => {
    const rng = makeRng(77123);
    return Array.from({ length: 96 }, (_, i) => {
      const size = rng() < 0.13 ? 3 : 2;
      return {
        key: i,
        style: {
          left: `${(rng() * 100).toFixed(2)}%`,
          top: `${(rng() * 52).toFixed(2)}%`,
          width: size,
          height: size,
          ['--dur' as string]: `${(3.5 + rng() * 5.5).toFixed(2)}s`,
          ['--delay' as string]: `${(-rng() * 9).toFixed(2)}s`,
        } as React.CSSProperties,
      };
    });
  }, []);

  return (
    <>
      <div className="cr-scene__sky" />
      <div className="cr-scene__aurora">
        <span />
        <span />
        <span />
      </div>
      <div className="cr-scene__layer cr-scene__stars" aria-hidden="true">
        {stars.map((s) => (
          <i key={s.key} style={s.style} />
        ))}
      </div>
      <div className="cr-scene__moon" aria-hidden="true" />
    </>
  );
});

SkyLayer.displayName = 'SkyLayer';
export default SkyLayer;
