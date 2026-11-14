import React, { useEffect, useRef } from 'react';
import { resolveAssetUrl } from '../../../api';
import { makeRng, streetY, SKI_RUN, Pt, VB } from './terrain';
import { beatAt, ease, GROUND_LINE, LEG_SPEED, planFlight, rigPitch, SLEIGH_BOX, type FlightPlan } from './flight';
import { SKIER_FRAMES, type WalkerSpec } from './actors';
import { SLEIGH_ART } from './SleighArtDefs';

interface LivingSceneCanvasProps {
  walkers: WalkerSpec[];
  enabled: boolean;
  calm: boolean;
}

interface SkiPoint {
  x: number;
  y: number;
  angle: number;
}

const SKI_RUN_MS = 8200;
const SKI_GAP_MS = 1400;

/** Pre-sample the ski path so we never call getPointAtLength() in the rAF loop */
function precomputeSkiRun(pts: Pt[], samples = 200): SkiPoint[] {
  const cumLengths: number[] = [0];
  let totalLen = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    totalLen += Math.hypot(dx, dy);
    cumLengths.push(totalLen);
  }

  const result: SkiPoint[] = [];
  for (let s = 0; s <= samples; s++) {
    const targetDist = (s / samples) * totalLen;
    let segIdx = 0;
    while (segIdx < cumLengths.length - 2 && cumLengths[segIdx + 1] < targetDist) {
      segIdx++;
    }
    const segStartDist = cumLengths[segIdx];
    const segEndDist = cumLengths[segIdx + 1];
    const segLen = segEndDist - segStartDist;
    const segT = segLen > 0 ? (targetDist - segStartDist) / segLen : 0;

    const p0 = pts[segIdx];
    const p1 = pts[segIdx + 1];
    const x = p0[0] + (p1[0] - p0[0]) * segT;
    const y = p0[1] + (p1[1] - p0[1]) * segT;
    const angle = (Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) * 180) / Math.PI;
    result.push({ x, y, angle });
  }
  return result;
}

const PRECOMPUTED_SKI = precomputeSkiRun(SKI_RUN, 200);

/** Generate self-contained data URI for Santa's sleigh with alternating reindeer legs */
function createSleighDataUri(angleA: number, angleB: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 150" width="420" height="150" stroke-linecap="round" stroke-linejoin="round">
    ${SLEIGH_ART}
    <g fill="none" stroke="#f2c14e" stroke-width="1.6" stroke-opacity=".6">
      <path d="M229 67 Q150 42 58 48" /><path d="M229 71 Q180 68 136 62" />
    </g>
    <g fill="#ffe9b0">
      <circle cx="352" cy="74" r="2.4" /><circle cx="374" cy="56" r="1.6" />
      <circle cx="392" cy="80" r="1.2" /><circle cx="368" cy="92" r="1" />
    </g>
    <g transform="translate(178 122) rotate(${angleA})"><use href="#deer" /></g>
    <g transform="translate(74 102) rotate(${angleB})"><use href="#deer" /></g>
    <g transform="translate(220 34)">
      <path d="M-6 62 q-12 0 -12 -10 q0 -7 7 -8" fill="none" stroke="#cfe0f5" stroke-width="3.4" />
      <path d="M-6 62 L72 62 q12 0 12 -11" fill="none" stroke="#cfe0f5" stroke-width="3.4" />
      <path d="M-14 51 L-14 59" fill="none" stroke="#9fb6d4" stroke-width="2.2" />
      <path d="M40 62 L40 46" fill="none" stroke="#9fb6d4" stroke-width="2.2" />
      <path d="M-8 46 C-14 30 -8 12 4 10 L58 6 C74 5 84 16 82 30 C80 42 71 47 58 47 Z" fill="#c0392b" />
      <path d="M-8 46 C-14 30 -8 12 4 10 L18 9 C6 14 2 30 6 40 C9 46 14 47 20 47 Z" fill="#9c281c" />
      <path d="M-2 20 C18 8 56 6 78 12" fill="none" stroke="#f2c14e" stroke-width="2.4" opacity=".9" />
      <path d="M6 12 C24 4 52 4 70 10" fill="none" stroke="#7d1f16" stroke-width="3" />
      <path d="M56 12 q13 -5 17 5 q4 11 -8 14 q-12 2 -14 -7 q-1 -8 5 -12z" fill="#2f6a41" />
      <path d="M56 19 q6 -5 12 -2" fill="none" stroke="#f2c14e" stroke-width="2" />
      <circle cx="73" cy="14" r="2.6" fill="#f2c14e" />
      <g transform="translate(18 8)">
        <path d="M-4 32 q-4 -19 12 -22 q15 -3 18 11 q2 10 -6 13z" fill="#e0453a" />
        <path d="M-4 26 q15 6 30 -1 l1 6 q-16 7 -31 1z" fill="#26303f" />
        <circle cx="12" cy="29" r="2.6" fill="#f2c14e" />
        <path d="M4 8 q-12 5 -16 15" fill="none" stroke="#e0453a" stroke-width="6.5" />
        <circle cx="-12" cy="24" r="3.2" fill="#fff2e6" />
        <path d="M-1 5 q8 12 19 8 q8 -3 4 -11 q-11 -4 -22 3z" fill="#fff2e6" />
        <circle cx="13" cy="-5" r="4.8" fill="#f7c9a3" />
        <path d="M5 -7 q1 -9 10 -9 q8 0 8 8 l-3 2z" fill="#e0453a" />
        <path d="M5 -7 q8 -4 18 -1" fill="none" stroke="#fff2e6" stroke-width="2.8" />
        <circle cx="24" cy="-15" r="2.8" fill="#fff2e6" />
        <circle cx="15.5" cy="-5.5" r="1.2" fill="#26303f" />
      </g>
    </g>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// Module-level image cache so we never re-fetch or re-parse SVGs
const imgCache = new Map<string, HTMLImageElement>();
function getCachedImage(src: string | undefined | null): HTMLImageElement | null {
  if (!src) return null;
  const url = src.startsWith('data:') ? src : resolveAssetUrl(src);
  let img = imgCache.get(url);
  if (!img) {
    img = new Image();
    img.src = url;
    imgCache.set(url, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

export const LivingSceneCanvas: React.FC<LivingSceneCanvasProps> = React.memo(
  ({ walkers, enabled, calm }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!enabled || !canvas) return;

      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) return;

      // Fit stage scale to cover the viewport
      const fitStage = () => {
        const root = canvas.closest('.cr-scene') as HTMLElement | null;
        if (root) {
          const scale = Math.max(window.innerWidth / VB.w, window.innerHeight / VB.h);
          root.style.setProperty('--scene-scale', scale.toFixed(4));
        }
      };
      fitStage();
      window.addEventListener('resize', fitStage);

      // Preload Santa rig images
      const sleighUriA = createSleighDataUri(-6, 8);
      const sleighUriB = createSleighDataUri(8, -6);
      getCachedImage(sleighUriA);
      getCachedImage(sleighUriB);

      // Preload all walker frames
      for (const w of walkers) {
        for (const f of w.frames) {
          getCachedImage(f);
        }
      }
      for (const f of SKIER_FRAMES) {
        getCachedImage(f);
      }

      const rand = makeRng();
      let raf = 0;
      let last = performance.now();
      let clock = 0;

      let plan: FlightPlan = planFlight(-1, rand, VB.w, VB.h);
      let flightElapsed = 0;
      let flightDir: 1 | -1 = -1;
      let smoothPitch = 0;

      const wrap = (v: number) => {
        const span = VB.w + 260;
        return ((((v + 130) % span) + span) % span) - 130;
      };

      const tick = (now: number) => {
        const dt = Math.min(now - last, 64);
        last = now;
        clock += dt;

        ctx.clearRect(0, 0, VB.w, VB.h);

        // -------------------------------------------------------------
        // 1. Skier (runs down snow on left, leaves carving trail)
        // -------------------------------------------------------------
        const cycle = SKI_RUN_MS + SKI_GAP_MS;
        const skiT = clock % cycle;
        const skiing = skiT < SKI_RUN_MS;
        const skiP = skiing ? Math.pow(skiT / SKI_RUN_MS, 0.82) : 1;

        if (skiing && skiP > 0.02) {
          // Draw snow carving track
          const targetIndex = Math.min(PRECOMPUTED_SKI.length - 1, Math.round(skiP * (PRECOMPUTED_SKI.length - 1)));
          ctx.save();
          ctx.strokeStyle = 'rgba(47, 85, 115, 0.28)';
          ctx.lineWidth = 2.2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(PRECOMPUTED_SKI[0].x, PRECOMPUTED_SKI[0].y);
          for (let i = 1; i <= targetIndex; i++) {
            ctx.lineTo(PRECOMPUTED_SKI[i].x, PRECOMPUTED_SKI[i].y);
          }
          ctx.stroke();
          ctx.restore();

          // Draw skier
          const skiPt = PRECOMPUTED_SKI[targetIndex];
          const frameIdx = Math.floor(clock / 260) % SKIER_FRAMES.length;
          const skierImg = getCachedImage(SKIER_FRAMES[frameIdx]);

          ctx.save();
          ctx.translate(skiPt.x - 24, skiPt.y - 56);
          ctx.rotate((skiPt.angle * Math.PI) / 180);
          ctx.scale(-1, 1); // sprite faces right, mirror it down-mountain

          if (skierImg) {
            ctx.drawImage(skierImg, -24, -28, 48, 56);
          }

          // Subtle snow spray puff behind skis
          const sprayAlpha = 0.4 + 0.3 * Math.sin((clock / 120) * Math.PI);
          ctx.fillStyle = `rgba(255, 255, 255, ${sprayAlpha.toFixed(2)})`;
          ctx.beginPath();
          ctx.ellipse(-8, 14, 5, 2.5, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }

        // -------------------------------------------------------------
        // 2. Walkers / Cyclists / Street Traffic
        // -------------------------------------------------------------
        for (const w of walkers) {
          const x = wrap(w.phase * (VB.w + 260) + w.dir * w.speed * (clock / 1000));
          const y = streetY(x) + w.lane;

          // Shadow under walker
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(x, y - 1, w.size[0] * 0.45, 3.5, 0, 0, Math.PI * 2);
          ctx.fillStyle = w.far ? 'rgba(6, 16, 30, 0.45)' : 'rgba(6, 16, 30, 0.65)';
          ctx.fill();
          ctx.restore();

          // Walker sprite frame
          const fIdx = Math.floor(clock / w.frameMs) % w.frames.length;
          const img = getCachedImage(w.frames[fIdx]);
          if (img) {
            ctx.save();
            ctx.translate(x, y);
            if (w.flip || w.dir === -1) {
              ctx.scale(-1, 1);
            }
            if (w.far) {
              ctx.globalAlpha = 0.85;
            }
            ctx.drawImage(img, -w.size[0] / 2, -w.size[1], w.size[0], w.size[1]);
            ctx.restore();
          }
        }

        // -------------------------------------------------------------
        // 3. Santa: Cruise, Dive, Land on street, Rest, Launch, Dash
        // -------------------------------------------------------------
        if (!calm) {
          flightElapsed += dt;
          if (flightElapsed >= plan.total) {
            flightElapsed = 0;
            flightDir = flightDir === 1 ? -1 : 1;
            plan = planFlight(flightDir, rand, VB.w, VB.h);
          }

          const { beat, localT } = beatAt(plan, flightElapsed);
          const eased = ease[beat.easeName](localT);
          const p = beat.fn(eased);

          const grounded = beat.tag === 'roll' || beat.tag === 'rest';
          const target = grounded ? 0 : rigPitch(beat, eased);
          smoothPitch += (target - smoothPitch) * Math.min(1, dt / 110);

          const face = plan.dir > 0 ? -1 : 1;
          const angle = smoothPitch * (face === -1 ? -1 : 1);
          const depth = grounded ? 1.06 : 1.0;

          // Grounded contact shadow
          if (grounded) {
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(p.x, p.y + 2, 85, 6, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(4, 12, 24, 0.65)';
            ctx.fill();
            ctx.restore();

            // Snow dusting particles during roll or rocket launch
            if (beat.tag === 'roll' || (beat.tag === 'launch' && localT < 0.35)) {
              ctx.save();
              const dustCount = 4;
              for (let d = 0; d < dustCount; d++) {
                const dx = p.x - face * (40 + d * 22) + Math.sin(clock / 80 + d) * 8;
                const dy = p.y + Math.cos(clock / 80 + d) * 3;
                ctx.fillStyle = `rgba(220, 235, 255, ${(0.35 - d * 0.07).toFixed(2)})`;
                ctx.beginPath();
                ctx.arc(dx, dy, 4 + d * 2, 0, Math.PI * 2);
                ctx.fill();
              }
              ctx.restore();
            }
          }

          // Alternating reindeer leg frames for animated gallop
          const legSpeed = LEG_SPEED[beat.tag] || 0.4;
          const legCycle = legSpeed * 1000;
          const isLegFrameA = Math.floor(clock / legCycle) % 2 === 0;
          const sleighImg = getCachedImage(isLegFrameA ? sleighUriA : sleighUriB);

          if (sleighImg) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate((angle * Math.PI) / 180);
            if (face === -1) {
              ctx.scale(-1, 1);
            }
            if (depth !== 1.0) {
              ctx.scale(depth, depth);
            }
            ctx.drawImage(
              sleighImg,
              -SLEIGH_BOX.w / 2,
              -SLEIGH_BOX.h * GROUND_LINE,
              SLEIGH_BOX.w,
              SLEIGH_BOX.h
            );
            ctx.restore();
          }
        }

        raf = requestAnimationFrame(tick);
      };

      raf = requestAnimationFrame(tick);

      return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', fitStage);
      };
    }, [enabled, calm, walkers]);

    return (
      <canvas
        ref={canvasRef}
        width={VB.w}
        height={VB.h}
        className="cr-scene__canvas"
        aria-hidden="true"
      />
    );
  }
);

LivingSceneCanvas.displayName = 'LivingSceneCanvas';
export default LivingSceneCanvas;
