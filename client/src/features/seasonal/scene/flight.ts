import { streetY, type Pt } from './terrain';

export const ease = {
  linear: (t: number) => t,
  sine: (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t),
  in: (t: number) => t * t,
  in3: (t: number) => t * t * t,
  out: (t: number) => 1 - (1 - t) * (1 - t),
  out3: (t: number) => 1 - Math.pow(1 - t, 3),
};

export type EaseName = keyof typeof ease;

/** A point on a cubic bezier, with the tangent angle (banking for free). */
export interface BezierPoint {
  x: number;
  y: number;
  angle: number;
}

export const bezier = (p0: Pt, p1: Pt, p2: Pt, p3: Pt) => (t: number): BezierPoint => {
  const u = 1 - t;
  const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
  const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
  const dx = 3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]);
  const dy = 3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]);
  return { x, y, angle: (Math.atan2(dy, dx) * 180) / Math.PI };
};

/* ------------------------------------------------------------------ flight */

export const SLEIGH_BOX = { w: 340, h: 121 }; // 340 × (150 / 420)
/** Where the rig touches the ground, as a fraction of its box height (runners + hooves). */
export const GROUND_LINE = 0.72;

export type BeatTag = 'cruise' | 'dive' | 'roll' | 'rest' | 'launch' | 'dash';

export interface Beat {
  ms: number;
  easeName: EaseName;
  fn: (t: number) => BezierPoint;
  tag: BeatTag;
}

/** Leg gallop speed per beat — flat out on the dive, a walk at rest. */
export const LEG_SPEED: Record<BeatTag, number> = {
  cruise: 0.44, dive: 0.34, roll: 0.5, rest: 0.95, launch: 0.3, dash: 0.32,
};

export interface FlightPlan {
  beats: Beat[];
  total: number;
  dir: 1 | -1;
}

/**
 * One pass. Every number is jittered, so no two passes look the same: a slow
 * cruise, a diving approach, a landing that rolls to a stop, a rest on the
 * road, a vertical launch and a flat-out dash off screen.
 */
export const planFlight = (dir: 1 | -1, rand: () => number, vw: number, vh: number): FlightPlan => {
  const W = vw;
  const minY = Math.max(90, vh * 0.1);
  const startX = dir > 0 ? -280 : W + 280;
  const exitX = dir > 0 ? W + 320 : -320;
  const sky = minY + rand() * 110;                       // cruising altitude (pivot)
  const landX = W * (0.2 + rand() * 0.6);
  const landY = streetY(landX) - 4;                       // runners on the street
  const roll = dir * (150 + rand() * 130);                // rolls forward after touchdown
  const approach = landX - dir * (200 + rand() * 260);    // where the dive starts
  const launchY = minY + 40 + rand() * 80;                // stays inside the sky band
  const restY = streetY(landX + roll) - 4;

  const seg = (min: number, max: number, easeName: EaseName, fn: Beat['fn'], tag: BeatTag): Beat => ({
    ms: min + rand() * (max - min),
    easeName,
    fn,
    tag,
  });

  // Nearly half the passes never land: he just crosses the sky, undulating like a
  // plane. Which of the two happens is random, so it is never predictable.
  if (rand() < 0.45) {
    const midX = (startX + exitX) / 2;
    const flypast: Beat[] = [
      seg(5000, 7500, 'sine', bezier(
        [startX, sky + 20],
        [startX + dir * W * 0.28, sky - 36],
        [midX - dir * W * 0.12, sky + 42],
        [midX, sky],
      ), 'cruise'),
      seg(5000, 7500, 'sine', bezier(
        [midX, sky],
        [midX + dir * W * 0.12, sky - 42],
        [exitX - dir * W * 0.28, sky + 36],
        [exitX, sky + 16],
      ), 'cruise'),
    ];
    return { beats: flypast, total: flypast.reduce((sum, b) => sum + b.ms, 0), dir };
  }

  const beats: Beat[] = [
    // 1 — a long, lazy cruise with a gentle swell
    seg(7000, 11000, 'sine', bezier(
      [startX, sky + 26],
      [startX + dir * W * 0.3, sky - 30],
      [approach - dir * W * 0.22, sky + 34],
      [approach, sky],
    ), 'cruise'),

    // 2 — the dive: accelerating, nose dipping, toward the street
    seg(2300, 3200, 'in', bezier(
      [approach, sky],
      [approach + dir * 190, sky + 105],
      [landX - dir * 330, landY - 120],
      [landX, landY],
    ), 'dive'),

    // 3 — touchdown, rolling along the road and slowing to a stop
    seg(1700, 2500, 'out', (t) => {
      const x = landX + roll * t;
      return { x, y: streetY(x) - 4, angle: 0 };
    }, 'roll'),

    // 4 — standing on the road, catching his breath
    seg(1500, 2600, 'sine', (t) => ({
      x: landX + roll,
      y: restY + Math.sin(t * Math.PI * 2) * 1.8,
      angle: Math.sin(t * Math.PI * 2) * 1.2,
    }), 'rest'),

    // 5 — rearing up and rocketing skyward
    seg(1900, 2500, 'in3', bezier(
      [landX + roll, landY],
      [landX + roll - dir * 40, landY - 230],
      [landX + roll + dir * 50, landY - 430],
      [landX + roll + dir * 170, launchY],
    ), 'launch'),

    // 6 — flat out, easing off as he leaves frame
    seg(3100, 4300, 'out', bezier(
      [landX + roll + dir * 170, launchY],
      [landX + roll + dir * 340, launchY + 34],
      [exitX - dir * 300, launchY + 96],
      [exitX, launchY + 44],
    ), 'dash'),
  ];

  return { beats, total: beats.reduce((sum, b) => sum + b.ms, 0), dir };
};

/** Which beat of the plan are we in? */
export const beatAt = (plan: FlightPlan, elapsed: number) => {
  let acc = 0;
  for (const beat of plan.beats) {
    if (elapsed < acc + beat.ms) {
      return { beat, localT: Math.max(0, Math.min(1, (elapsed - acc) / beat.ms)) };
    }
    acc += beat.ms;
  }
  const last = plan.beats[plan.beats.length - 1];
  return { beat: last, localT: 1 };
};

/**
 * Target pitch for the rig, in degrees (positive = clockwise on screen).
 *
 * The **nose always leads** — think of a plane: it climbs nose-up, dives
 * nose-down, and lands nose-down. Two things a naive `rotation = tangent` gets
 * wrong, though:
 *
 * 1. **It snaps.** The art faces left, so for leftward travel the raw tangent
 *    sits near ±180°; clamping *that* flips sign between frames, which is the
 *    "flat to 45° in an instant" jump. Measuring the climb over a short step
 *    gives a continuous value instead.
 * 2. It has to be applied per travel direction (the art is mirrored when flying
 *    the other way), which the caller does.
 */
export const rigPitch = (beat: Beat, eased: number): number => {
  const a = beat.fn(eased);
  const b = beat.fn(Math.min(1, eased + 0.02));
  const dy = b.y - a.y;
  const dx = b.x - a.x;
  const v = Math.hypot(dx, dy);
  if (v < 0.5) return 0; // standing still → level

  const climb = Math.max(-1, Math.min(1, -dy / v)); // +1 = climbing straight up
  const climbAngle = (Math.asin(climb) * 180) / Math.PI; // + = climbing
  return Math.max(-34, Math.min(34, climbAngle * 0.5));
};
