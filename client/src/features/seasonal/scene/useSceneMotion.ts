import { useEffect } from 'react';
import { makeRng, streetY, VB } from './terrain';
import { beatAt, ease, GROUND_LINE, LEG_SPEED, planFlight, rigPitch, SLEIGH_BOX, type FlightPlan } from './flight';
import { SKIER_FRAMES, type WalkerSpec } from './actors';

interface MotionOptions {
  rootRef: React.RefObject<HTMLDivElement | null>;
  walkers: WalkerSpec[];
  enabled: boolean;
  calm: boolean;
}

const SKI_RUN_MS = 8200;
const SKI_GAP_MS = 1400;

const actor = (root: HTMLElement, id: string) =>
  root.querySelector<HTMLElement>(`[data-actor="${id}"]`);

/**
 * One rAF loop for the whole scene. It only ever writes `transform` / `src`
 * (composited) and never React state, so a busy village costs no re-renders.
 *
 * All coordinates are the scene's own 1440 × 900 space — the stage element is
 * scaled as a single unit, so characters stay welded to the art at any size.
 */
export function useSceneMotion({ rootRef, walkers, enabled, calm }: MotionOptions) {
  useEffect(() => {
    const root = rootRef.current;
    if (!enabled || !root) return;

    // --- scale the whole composed scene to cover the viewport
    const fitStage = () => {
      const scale = Math.max(window.innerWidth / VB.w, window.innerHeight / VB.h);
      root.style.setProperty('--scene-scale', scale.toFixed(4));
    };
    fitStage();

    const rand = makeRng();
    let raf = 0;
    let last = performance.now();
    let clock = 0;

    const skiPath = root.querySelector<SVGPathElement>('#cr-ski-line');
    const trail = root.querySelector<SVGPathElement>('#cr-ski-trail');
    const skiLen = skiPath?.getTotalLength() ?? 0;
    if (trail && skiLen) trail.style.strokeDasharray = `${skiLen} ${skiLen}`;

    let plan: FlightPlan = planFlight(-1, rand, VB.w, VB.h);
    let flightElapsed = 0;
    let flightDir: 1 | -1 = -1;
    let smoothPitch = 0; // eased, so the rig never snaps between beats

    /**
     * Flip-book frame swap. Every frame already lives in the DOM (SceneActors
     * stacks them), so this only toggles a class: no image request, no re-decode,
     * no cancelled loads. It bails out when the frame has not changed.
     */
    const setFrame = (el: HTMLElement | null, frames: string[], ms: number) => {
      if (!el || frames.length < 2) return;
      const idx = Math.floor(clock / ms) % frames.length;
      const key = String(idx);
      if (el.dataset.frame === key) return;
      el.dataset.frame = key;
      el.querySelectorAll<HTMLImageElement>('img').forEach((img, i) => {
        img.classList.toggle('is-on', i === idx);
      });
    };

    // --- skier: rides the measured snow line and leaves a track behind him
    const frameSkier = () => {
      const el = actor(root, 'skier');
      if (!el || !skiPath) return;
      const cycle = SKI_RUN_MS + SKI_GAP_MS;
      const t = clock % cycle;
      const skiing = t < SKI_RUN_MS;
      const p = skiing ? Math.pow(t / SKI_RUN_MS, 0.82) : 1;
      const here = skiPath.getPointAtLength(p * skiLen);
      const ahead = skiPath.getPointAtLength(Math.min(1, p + 0.004) * skiLen);
      const angle = (Math.atan2(ahead.y - here.y, ahead.x - here.x) * 180) / Math.PI;

      el.style.opacity = skiing ? '1' : '0';
      el.style.transform =
        `translate3d(${(here.x - 24).toFixed(1)}px, ${(here.y - 56).toFixed(1)}px, 0) rotate(${angle.toFixed(2)}deg)`;
      const spray = el.querySelector<HTMLElement>('.cr-scene__spray');
      if (spray) spray.style.opacity = skiing ? '' : '0';
      if (trail && skiLen) {
        trail.style.strokeDashoffset = String(skiLen * (1 - p));
        trail.style.opacity = skiing ? '1' : '0';
      }
      // no frame swapping while he is parked behind the snow (1.4 s gap)
      if (skiing) setFrame(el, SKIER_FRAMES, 260);
    };


    // --- walkers: continuous traffic along the street (1440-wide wrap)
    const wrap = (v: number) => {
      const span = VB.w + 260;
      return ((((v + 130) % span) + span) % span) - 130;
    };

    const frameWalkers = () => {
      for (const w of walkers) {
        const el = actor(root, w.id);
        if (!el) continue;
        const x = wrap(w.phase * (VB.w + 260) + w.dir * w.speed * (clock / 1000));
        const y = streetY(x) + w.lane;
        el.style.transform = `translate3d(${(x - w.size[0] / 2).toFixed(1)}px, ${(y - w.size[1]).toFixed(1)}px, 0)`;
        if (w.frames.length > 1) {
          setFrame(el, w.frames, w.frameMs);
        }
      }
    };

    // --- Santa: cruise, dive, land, rest, launch, dash
    const frameSleigh = (dt: number) => {
      const el = actor(root, 'sleigh');
      if (!el) return;
      flightElapsed += dt;
      if (flightElapsed >= plan.total) {
        flightElapsed = 0;
        flightDir = flightDir === 1 ? -1 : 1;
        plan = planFlight(flightDir, rand, VB.w, VB.h);
      }
      const { beat, localT } = beatAt(plan, flightElapsed);
      const eased = ease[beat.easeName](localT);
      const p = beat.fn(eased);

      // grounded beats stay level; airborne beats pitch with the climb (see rigPitch)
      const grounded = beat.tag === 'roll' || beat.tag === 'rest';
      const target = grounded ? 0 : rigPitch(beat, eased);
      smoothPitch += (target - smoothPitch) * Math.min(1, dt / 110);

      const face = plan.dir > 0 ? -1 : 1;
      const angle = smoothPitch * (face === -1 ? -1 : 1);
      const depth = grounded ? 1.06 : 1;

      el.style.transform =
        `translate3d(${(p.x - SLEIGH_BOX.w / 2).toFixed(1)}px, ${(p.y - SLEIGH_BOX.h * GROUND_LINE).toFixed(1)}px, 0) ` +
        `rotate(${angle.toFixed(2)}deg) scale(${depth})`;
      el.style.setProperty('--face', String(face));
      el.style.setProperty('--legs', `${LEG_SPEED[beat.tag]}s`);
      el.classList.toggle('is-landed', grounded);
      el.classList.toggle('is-dusting', beat.tag === 'roll' || (beat.tag === 'launch' && localT < 0.35));
    };

    // --- pointer parallax (skipped in calm mode)
    let px = 0, py = 0, cx = 0, cy = 0;
    const onPointer = (e: PointerEvent) => {
      px = (e.clientX / window.innerWidth) * 2 - 1;
      py = (e.clientY / window.innerHeight) * 2 - 1;
    };
    if (!calm) window.addEventListener('pointermove', onPointer, { passive: true });

    const tick = (now: number) => {
      const dt = Math.min(now - last, 64);
      last = now;
      clock += dt;
      try {
        frameSkier();
        frameWalkers();
        frameSleigh(dt);
        if (!calm) {
          cx += (px - cx) * 0.05;
          cy += (py - cy) * 0.05;
          root.style.setProperty('--par-x', `${(cx * -1).toFixed(3)}px`);
          root.style.setProperty('--par-y', `${(cy * -1).toFixed(3)}px`);
        }
      } catch {
        // a single bad frame must never kill the scene
      }
      raf = requestAnimationFrame(tick);
    };

    const onResize = () => fitStage();
    window.addEventListener('resize', onResize);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointer);
    };
  }, [enabled, calm, walkers, rootRef]);
}
