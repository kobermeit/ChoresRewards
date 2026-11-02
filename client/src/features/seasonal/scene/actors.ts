/**
 * The crowd. Each walker is one <div> + one <img>; everything is positioned by
 * transform from a single rAF loop, so even a dozen of them costs no layout and
 * no React re-renders.
 *
 * `lane` is the pixel offset below the street line: bigger = nearer the camera.
 * `idleOnly` walkers only appear once the screen goes ambient/screensaver, which
 * is how the scene gets busier the longer nobody touches it.
 */
export interface WalkerSpec {
  id: string;
  frames: string[];
  frameMs: number;
  lane: number;
  speed: number;      // px per second
  dir: 1 | -1;
  phase: number;      // 0..1 starting offset along the street
  size: [number, number];
  flip?: boolean;     // sprite art faces right
  idleOnly?: boolean;
  far?: boolean;
}

const V = 'static/images/seasonal/christmas/village';

export const WALKERS: WalkerSpec[] = [
  // baseline traffic — always on
  { id: 'cyclist', frames: [`${V}/elfbike1.svg`, `${V}/elfbike3.svg`], frameMs: 320, lane: 38, speed: 34, dir: 1, phase: 0.05, size: [58, 68] },
  { id: 'skierB', frames: [`${V}/elfski1.svg`, `${V}/elfski2.svg`], frameMs: 260, lane: 8, speed: 46, dir: -1, phase: 0.55, size: [48, 56], flip: true },
  { id: 'roller', frames: [`${V}/elfchair.svg`], frameMs: 400, lane: 54, speed: 24, dir: -1, phase: 0.72, size: [54, 44] },

  // extra life, only once the screen has gone quiet
  { id: 'cyclistB', frames: [`${V}/elfbike2.svg`, `${V}/elfbike4.svg`], frameMs: 340, lane: 62, speed: 27, dir: -1, phase: 0.33, size: [52, 61], far: true, idleOnly: true },
  { id: 'boarder', frames: [`${V}/elfboard1.svg`, `${V}/elfboard2.svg`], frameMs: 300, lane: 22, speed: 42, dir: 1, phase: 0.18, size: [54, 58], idleOnly: true },
  { id: 'cyclistC', frames: [`${V}/elfbike5.svg`, `${V}/elfbike6.svg`], frameMs: 300, lane: 12, speed: 38, dir: 1, phase: 0.86, size: [46, 54], far: true, idleOnly: true },
];

/** Sprites used by the skier who leaves a track down the snow. */
export const SKIER_FRAMES = [`${V}/elfski1.svg`, `${V}/elfski2.svg`];

/** The still vignette in the right gutter (always visible). */
export const STILLS = {
  elf: `${V}/tree-elf.svg`,
  tree: `${V}/tree.svg`,
  snowman: `${V}/snowman-build-top.svg`,
  snowmanBase: `${V}/snowman-build-bottom.svg`,
};
