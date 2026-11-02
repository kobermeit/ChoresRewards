/**
 * Scene geometry + Santa's flight plan. Pure math, no DOM, no React — so the
 * choreography can be reasoned about (and unit-tested) on its own.
 *
 * Everything is authored in a 1440 × 900 user space and mapped to CSS pixels by
 * the samplers, which is what keeps characters welded to the ground they are
 * drawn on.
 */

export const VB = { w: 1440, h: 900 };

/** A point on a terrain line, in user space. */
export type Pt = [number, number];

/** The ski mountain ridge (behind the village). */
export const RIDGE: Pt[] = [
  [1520, 352], [1440, 360], [1360, 374], [1280, 392], [1200, 408],
  [1130, 418], [1050, 408], [970, 422], [890, 436], [810, 448],
  [730, 454], [650, 444], [570, 458], [490, 466], [410, 474],
  [330, 478], [250, 484], [170, 492], [90, 498], [10, 504], [-80, 510],
];

/** Irregular, asymmetric peaks — a sawtooth reads as clipart, real ranges don't. */
export const FAR: Pt[] = [
  [-80, 300], [30, 288], [92, 258], [148, 296], [238, 306], [300, 266],
  [356, 228], [424, 288], [472, 302], [566, 280], [634, 246], [704, 294],
  [772, 304], [842, 260], [902, 220], [982, 276], [1042, 300], [1122, 270],
  [1184, 236], [1252, 288], [1322, 302], [1392, 254], [1452, 230], [1520, 284],
];

/** The street the villagers walk / ride along (bottom of the village art). */
export const STREET: Pt[] = [
  [-80, 806], [110, 800], [330, 806], [560, 800], [790, 806],
  [1020, 800], [1250, 806], [1520, 800],
];

/** The skier keeps to the open snow on the left of the square. */
export const SKI_RUN: Pt[] = [[760, 800], [560, 800], [330, 806], [110, 800], [-90, 806]];

export const pathFrom = (pts: Pt[], closeTo: number | null = null): string => {
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) d += ` L${pts[i][0]} ${pts[i][1]}`;
  if (closeTo !== null) d += ` L${pts[pts.length - 1][0]} ${closeTo} L${pts[0][0]} ${closeTo} Z`;
  return d;
};

/** The street's y at any x — so a landing lands on something. */
export const streetY = (x: number): number => {
  for (let i = 1; i < STREET.length; i++) {
    if (x <= STREET[i][0]) {
      const [x0, y0] = STREET[i - 1];
      const [x1, y1] = STREET[i];
      return y0 + (y1 - y0) * (x1 === x0 ? 0 : (x - x0) / (x1 - x0));
    }
  }
  return STREET[STREET.length - 1][1];
};

/** Seeded RNG so a scene looks identical on every reload. */
export const makeRng = (seed = 20241225) => {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
};
