import React, { useMemo } from 'react';
import { FAR, makeRng, pathFrom, RIDGE, SKI_RUN } from './terrain';

/**
 * The landscape the scene is staged on.
 *
 * The two `<path>`s in the front layer are *measurement* paths — invisible, but
 * the skier is positioned by sampling them, so he can never leave the snow.
 */
export const TerrainLayer: React.FC = React.memo(() => {
  const back = useMemo(() => {
    const rng = makeRng();
    const pine = (x: number, y: number, h: number) => {
      const w = h * 0.42;
      return (
        `<path d="M${x} ${y - h} L${x + w * 0.52} ${y - h * 0.52} L${x - w * 0.52} ${y - h * 0.52} Z"/>` +
        `<path d="M${x} ${y - h * 0.78} L${x + w * 0.72} ${y - h * 0.2} L${x - w * 0.72} ${y - h * 0.2} Z"/>` +
        `<path d="M${x} ${y - h * 0.5} L${x + w} ${y} L${x - w} ${y} Z"/>`
      );
    };

    let pines = '';
    RIDGE.forEach(([x, y], i) => {
      if (i % 2 !== 0) return;
      pines += pine(x + (rng() * 28 - 14), y - 2, 20 + rng() * 24);
    });
    for (let i = 0; i < 20; i++) {
      const x = 20 + rng() * 1400;
      const t = 1 - (x + 80) / 1600;
      pines += pine(x, 380 + t * 130 + (20 + rng() * 110), 14 + rng() * 20);
    }

    // distant cottages: a few warm pinpricks that give the ranges scale
    const spots: Array<[number, number]> = [
      [1235, 372], [1248, 368], [1160, 395], [980, 404],
      [700, 420], [512, 424], [336, 436], [196, 444],
    ];
    const lamps = spots
      .map(([x, y], i) => {
        const r = 1.5 + rng() * 0.7;
        const o = (0.45 + rng() * 0.4).toFixed(2);
        const t = (3 + rng() * 4).toFixed(1);
        const dl = (-rng() * 5).toFixed(1);
        const dot = `<circle cx="${x}" cy="${y}" r="${r.toFixed(2)}" opacity="${o}"><animate attributeName="opacity" values="${o};.15;${o}" dur="${t}s" begin="${dl}s" repeatCount="indefinite"/></circle>`;
        return i % 2 === 0 ? dot + `<circle cx="${x + 5}" cy="${y + 1}" r="${(r * 0.7).toFixed(2)}" opacity=".5"/>` : dot;
      })
      .join('');

    return { pines, lamps };
  }, []);

  return (
    <>
      <svg className="cr-scene__terrain cr-scene__terrain--back" viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="crHillGrad" gradientUnits="userSpaceOnUse" x1="0" y1="330" x2="0" y2="860">
            <stop offset="0" stopColor="#22455f" />
            <stop offset=".05" stopColor="#193449" />
            <stop offset=".22" stopColor="#112638" />
            <stop offset="1" stopColor="#070f1b" />
          </linearGradient>
          <linearGradient id="crFarGrad" gradientUnits="userSpaceOnUse" x1="0" y1="225" x2="0" y2="330">
            <stop offset="0" stopColor="#5487b4" />
            <stop offset=".3" stopColor="#26506f" />
            <stop offset="1" stopColor="#0e2133" />
          </linearGradient>
        </defs>
        <path className="cr-range-far" d={pathFrom(FAR, 900)} />
        <path className="cr-range-far-rim" d={pathFrom(FAR)} />
        <path className="cr-range-mid" d={pathFrom(RIDGE, 900)} />
        <g className="cr-cottage" dangerouslySetInnerHTML={{ __html: back.lamps }} />
        <g className="cr-pines" dangerouslySetInnerHTML={{ __html: back.pines }} />
      </svg>

      <svg className="cr-scene__terrain cr-scene__terrain--front" viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden="true">
        <path id="cr-ski-line" className="cr-ski-line" d={pathFrom(SKI_RUN)} />
        <path id="cr-ski-trail" className="cr-ski-trail" d={pathFrom(SKI_RUN)} />
      </svg>
    </>
  );
});

TerrainLayer.displayName = 'TerrainLayer';
export default TerrainLayer;
