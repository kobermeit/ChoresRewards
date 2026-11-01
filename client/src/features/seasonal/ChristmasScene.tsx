import React, { useRef, useMemo, useEffect } from 'react';
import { useSnowEngine } from './useSnowEngine';
import { useSleighFlight } from './useSleighFlight';
import { resolveAssetUrl } from '../../api';
import './christmasScene.css';

interface ChristmasSceneProps {
  density?: number;
  calmMode?: boolean;
}

const HOUSES = [
  [96, 314, 104, 74],
  [214, 330, 76, 58],
  [300, 296, 122, 92],
  [436, 324, 84, 64],
  [534, 284, 140, 104],
  [688, 318, 92, 70],
  [796, 332, 72, 56],
  [882, 300, 116, 88],
  [1012, 326, 80, 62],
  [1106, 288, 132, 100],
  [1252, 322, 88, 66],
  [1336, 292, 86, 96],
];

export const ChristmasScene: React.FC<ChristmasSceneProps> = React.memo(({ density = 2, calmMode = false }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sleighRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<HTMLDivElement | null>(null);

  // Engines
  useSnowEngine(canvasRef, density, true);
  useSleighFlight(sleighRef, !calmMode);

  // Parallax pointer handler (unless calmMode)
  useEffect(() => {
    if (calmMode) return;
    const scene = sceneRef.current;
    if (!scene) return;

    let px = 0, py = 0, cx = 0, cy = 0;
    let animId: number;

    const onPointerMove = (e: PointerEvent) => {
      px = (e.clientX / window.innerWidth) * 2 - 1;
      py = (e.clientY / window.innerHeight) * 2 - 1;
    };

    const updateParallax = () => {
      cx += (px - cx) * 0.055;
      cy += (py - cy) * 0.055;
      scene.style.setProperty('--par-x', (cx * -18).toFixed(2) + 'px');
      scene.style.setProperty('--par-y', (cy * -10).toFixed(2) + 'px');
      animId = requestAnimationFrame(updateParallax);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    animId = requestAnimationFrame(updateParallax);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      cancelAnimationFrame(animId);
      if (scene) {
        scene.style.setProperty('--par-x', '0px');
        scene.style.setProperty('--par-y', '0px');
      }
    };
  }, [calmMode]);

  // Seeded deterministic stars
  const stars = useMemo(() => {
    let seed = 20241225;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const rndRange = (a: number, b: number) => a + rnd() * (b - a);

    return Array.from({ length: 74 }, (_, i) => {
      const size = rnd() < 0.14 ? 3 : 2;
      return {
        id: i,
        left: rndRange(0, 100).toFixed(2) + '%',
        top: rndRange(0, 62).toFixed(2) + '%',
        size,
        dur: rndRange(3, 8).toFixed(2) + 's',
        delay: (-rndRange(0, 8)).toFixed(2) + 's',
      };
    });
  }, []);

  // Seeded deterministic village lights and windows
  const { windows, bulbs } = useMemo(() => {
    let seed = 20241225;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const rndRange = (a: number, b: number) => a + rnd() * (b - a);

    const winList: Array<{
      id: string;
      haloX: number;
      haloY: number;
      haloW: number;
      haloH: number;
      rects: Array<{ x: number; y: number; w: number; h: number }>;
      dur: string;
      delay: string;
    }> = [];

    const bulbList: Array<{
      id: string;
      cx: number;
      cy: number;
      r: number;
      color: string;
      dur: string;
      delay: string;
    }> = [];

    const bulbColors = ['#f59e0b', '#ef4444', '#10b981', '#38bdf8', '#fbbf24', '#a855f7'];

    HOUSES.forEach(([hx, hy, hw, hh], hIdx) => {
      // 1-3 windows per house
      const numWindows = 1 + Math.floor(rnd() * 3);
      for (let w = 0; w < numWindows; w++) {
        const wx = hx + 10 + (w * (hw - 20)) / numWindows;
        const wy = hy + 18 + (w % 2) * 16;
        winList.push({
          id: `w-${hIdx}-${w}`,
          haloX: wx - 6,
          haloY: wy - 6,
          haloW: 20,
          haloH: 22,
          rects: [
            { x: wx, y: wy, w: 4, h: 5 },
            { x: wx + 5, y: wy, w: 4, h: 5 },
            { x: wx, y: wy + 6, w: 4, h: 5 },
            { x: wx + 5, y: wy + 6, w: 4, h: 5 },
          ],
          dur: rndRange(3, 7).toFixed(2) + 's',
          delay: (-rndRange(0, 6)).toFixed(2) + 's',
        });
      }

      // Roof string lights (3-5 bulbs per house)
      const numBulbs = 3 + Math.floor(rnd() * 3);
      for (let b = 0; b < numBulbs; b++) {
        const bx = hx + 4 + (b * (hw - 8)) / Math.max(1, numBulbs - 1);
        const by = hy - 4 + (b % 2) * 4;
        bulbList.push({
          id: `b-${hIdx}-${b}`,
          cx: bx,
          cy: by,
          r: 2.2,
          color: bulbColors[(hIdx + b) % bulbColors.length],
          dur: rndRange(1.8, 3.8).toFixed(2) + 's',
          delay: (-rndRange(0, 3)).toFixed(2) + 's',
        });
      }
    });

    return { windows: winList, bulbs: bulbList };
  }, []);

  // Character SVG URLs resolved relative to deployment base URL
  const skierUrl = resolveAssetUrl('static/images/seasonal/christmas/village/elfski1.svg');
  const bikerUrl = resolveAssetUrl('static/images/seasonal/christmas/village/elfbike1.svg');
  const snowmanBaseUrl = resolveAssetUrl('static/images/seasonal/christmas/village/snowman-build-bottom.svg');
  const snowmanHeadUrl = resolveAssetUrl('static/images/seasonal/christmas/village/snowman-build-top.svg');
  const treeElfUrl = resolveAssetUrl('static/images/seasonal/christmas/village/tree-elf.svg');

  return (
    <div className="cr-christmas-scene" ref={sceneRef} aria-hidden="true">
      {/* Sky backdrop */}
      <div className="layer sky" />

      {/* Stars */}
      <div className="layer stars">
        {stars.map((s) => (
          <i
            key={s.id}
            style={{
              left: s.left,
              top: s.top,
              width: s.size,
              height: s.size,
              ['--dur' as any]: s.dur,
              ['--delay' as any]: s.delay,
            }}
          />
        ))}
      </div>

      {/* Horizon glow */}
      <div className="layer horizon" />

      {/* Crescent Moon with gentle halo */}
      <div className="moon" />

      {/* Northern Lights / Aurora Ribbon */}
      <div className="layer aurora" />

      {/* Far mountains */}
      <div className="layer range range--far">
        <svg viewBox="0 0 1440 320" preserveAspectRatio="none" role="presentation">
          <path
            fill="#0a1626"
            d="M0 240l80-36 120 20 100-50 140 40 120-60 160 50 100-30 140 50 120-70 140 40 120-30 100 46V320H0z"
          />
          <path
            fill="#e8f2ff"
            opacity=".55"
            d="M80 204l12 10-24 4zM300 174l18 14-34 4zM560 154l22 18-42 6zM820 164l16 12-30 4zM1080 144l24 16-44 6zM1340 174l18 12-32 4z"
          />
        </svg>
      </div>

      {/* Mid mountains */}
      <div className="layer range range--mid">
        <svg viewBox="0 0 1440 320" preserveAspectRatio="none" role="presentation">
          <path
            fill="#0c1d32"
            d="M0 260l90-48 130 30 110-60 130 40 150-70 130 46 110-36 130 50 140-80 130 50 90-30 100 58V320H0z"
          />
          <path
            fill="#e8f2ff"
            opacity=".7"
            d="M90 212l16 14-30 6zM330 182l20 16-38 6zM610 152l26 22-48 8zM850 168l18 16-36 6zM1120 138l28 20-52 8zM1340 168l20 14-38 6z"
          />
        </svg>
      </div>

      {/* Near mountain ridge with Village & warm window lights */}
      <div className="layer range range--near">
        <svg viewBox="0 0 1440 380" preserveAspectRatio="none" role="presentation">
          <defs>
            <radialGradient id="crWinHalo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffec99" stopOpacity="0.45" />
              <stop offset="60%" stopColor="#ffb703" stopOpacity="0.16" />
              <stop offset="100%" stopColor="#ffb703" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="crBulbHalo" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
              <stop offset="40%" stopColor="#f59e0b" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Near snow hill ridge */}
          <path
            fill="#0f243d"
            d="M0 320c120-30 260-20 400-50s280 40 420 10 280-30 420-10c70 10 130 30 200 40V380H0z"
          />
          <path
            fill="#e8f2ff"
            opacity=".75"
            d="M0 320c120-30 260-20 400-50s280 40 420 10 280-30 420-10c70 10 130 30 200 40v-4c-70-10-130-30-200-40-140-20-280 20-420 10s-280-40-420-10-280 20-400 50z"
          />

          {/* Procedural Village Houses */}
          {HOUSES.map(([hx, hy, hw, hh], i) => (
            <g key={i}>
              {/* House walls */}
              <rect x={hx} y={hy} width={hw} height={hh} fill="#0a192b" />
              {/* Triangular / Gabled Roof */}
              <polygon
                points={`${hx - 8},${hy} ${hx + hw / 2},${hy - 24} ${hx + hw + 8},${hy}`}
                fill="#0d2138"
              />
              {/* Snow cap on roof */}
              <polygon
                points={`${hx - 10},${hy} ${hx + hw / 2},${hy - 27} ${hx + hw + 10},${hy} ${hx + hw / 2},${hy - 21}`}
                fill="#e8f2ff"
                opacity="0.85"
              />
              {/* Chimney with cozy glowing smoke */}
              <rect x={hx + hw * 0.7} y={hy - 32} width={hw * 0.16} height={20} fill="#091524" />
              <circle cx={hx + hw * 0.78} cy={hy - 36} r={3} fill="#ffec99" opacity="0.4" />
              <circle cx={hx + hw * 0.81} cy={hy - 44} r={5} fill="#ffec99" opacity="0.25" />
            </g>
          ))}

          {/* Window glow halos */}
          {windows.map((w) => (
            <g key={w.id} className="window-glow" style={{ ['--dur' as any]: w.dur, ['--delay' as any]: w.delay }}>
              <rect x={w.haloX} y={w.haloY} width={w.haloW} height={w.haloH} fill="url(#crWinHalo)" />
              {w.rects.map((r, rIdx) => (
                <rect key={rIdx} x={r.x} y={r.y} width={r.w} height={r.h} fill="#fde047" rx="1" />
              ))}
            </g>
          ))}

          {/* Roof String Lights */}
          {bulbs.map((b) => (
            <g key={b.id} className="bulb-glow" style={{ ['--dur' as any]: b.dur, ['--delay' as any]: b.delay }}>
              <circle cx={b.cx} cy={b.cy} r={b.r * 2.2} fill={b.color} opacity="0.3" />
              <circle cx={b.cx} cy={b.cy} r={b.r} fill={b.color} />
            </g>
          ))}
        </svg>
      </div>

      {/* Pine trees framing */}
      <div className="layer trees">
        <svg className="t1 pine" viewBox="0 0 120 210" style={{ ['--delay' as any]: '-1.1s' }} role="presentation">
          <rect x="55" y="170" width="10" height="40" fill="#08131f" />
          <path fill="#0c1e33" d="M60 10l30 52H30zM60 44l38 62H22zM60 82l46 76H14z" />
          <path fill="#1d3a5c" opacity=".85" d="M60 10l-30 52h18zM60 44l-38 62h22zM60 82l-46 76h26z" />
          <path fill="#e8f2ff" opacity=".7" d="M60 10l-14 24h10zM60 44l-18 28h12zM60 82l-22 34h14z" />
        </svg>
        <svg className="t2 pine" viewBox="0 0 120 210" style={{ ['--delay' as any]: '-2.6s' }} role="presentation">
          <path fill="#0a1a2b" d="M60 22l26 46H34zM60 56l32 54H28zM60 96l40 66H20z" />
        </svg>
        <svg className="t3 pine" viewBox="0 0 120 210" style={{ ['--delay' as any]: '-3.9s' }} role="presentation">
          <rect x="55" y="172" width="11" height="38" fill="#08131f" />
          <path fill="#0b1c30" d="M60 6l28 50H32zM60 40l36 58H24zM60 78l44 72H16z" />
          <path fill="#1b3555" opacity=".8" d="M60 6l-28 50h17zM60 40l-36 58h21zM60 78l-44 72h24z" />
          <path fill="#e8f2ff" opacity=".65" d="M60 6l-13 23h9zM60 40l-17 27h11zM60 78l-21 33h13z" />
        </svg>
        <svg className="t4 pine" viewBox="0 0 120 210" style={{ ['--delay' as any]: '-5.2s' }} role="presentation">
          <path fill="#0a1a2b" d="M60 18l27 48H33zM60 52l33 56H27zM60 94l42 68H18z" />
          <path fill="#e8f2ff" opacity=".4" d="M60 18l-14 25h9zM60 52l-18 30h11z" />
        </svg>
      </div>

      {/* Snow canvas */}
      <canvas className="snow-canvas" ref={canvasRef} />

      {/* Santa Tracker Animated Inhabitants (with explicit resolveAssetUrl backgrounds) */}
      {!calmMode && (
        <div className="cr-st-inhabitants">
          <div className="cr-st-skier" style={{ backgroundImage: `url("${skierUrl}")` }} />
          <div className="cr-st-biker" style={{ backgroundImage: `url("${bikerUrl}")` }} />
          <div className="cr-st-snowman">
            <div className="cr-st-snowman-base" style={{ backgroundImage: `url("${snowmanBaseUrl}")` }} />
            <div className="cr-st-snowman-head" style={{ backgroundImage: `url("${snowmanHeadUrl}")` }} />
          </div>
          <div className="cr-st-peekaboo">
            <div className="cr-st-peekaboo-elf" style={{ backgroundImage: `url("${treeElfUrl}")` }} />
          </div>
        </div>
      )}

      {/* Sleigh */}
      <div className="sleigh" ref={sleighRef}>
        <div className="sleigh__trail" />
        <svg viewBox="0 0 200 86" role="presentation">
          <g stroke="#ffd391" strokeOpacity=".55" strokeWidth="1.1" strokeLinejoin="round" strokeLinecap="round">
            <path d="M66 40q32-9 68-2" fill="none" strokeOpacity=".35" strokeWidth="1" />
            {/* Reindeer 1 */}
            <g fill="#8f431f">
              <ellipse cx="36" cy="42" rx="14" ry="6.6" />
              <ellipse cx="55" cy="33" rx="5" ry="3.6" />
              <path d="M47 38q7-8 12-6l1 5q-4 1-6 5z" />
            </g>
            <path d="M55 29l-1-7 3.5 3 2-4.5 1.5 6.5M52 29l-4-4" fill="none" strokeWidth="1.3" />
            <path d="M30 46q-8 6-14 14M44 45q6 6 10 15" fill="none" strokeWidth="2.6" />
            <path d="M23 41q-6 0-9 3" fill="none" strokeWidth="1.5" />
            {/* Reindeer 2 */}
            <g fill="#8f431f">
              <ellipse cx="74" cy="34" rx="13" ry="6.2" />
              <ellipse cx="92" cy="26" rx="4.7" ry="3.4" />
              <path d="M85 30q6-7 11-5l1 5q-4 1-6 4z" />
            </g>
            <path d="M92 22l-1-6.5 3.5 2.8 2-4.3 1.5 6.2M89 22l-4-4" fill="none" strokeWidth="1.3" />
            <path d="M68 38q-8 6-14 14M82 37q6 6 10 15" fill="none" strokeWidth="2.6" />
            {/* Sleigh body */}
            <path d="M104 44q20-1 32-8 8-5 13 0 4 4 0 9-6 6-17 7-20 2-28-8z" fill="#b8362c" />
            <path d="M100 53q24 7 50 0" fill="none" strokeWidth="2.4" stroke="#ffd391" strokeOpacity=".9" />
            <path d="M112 41q10-1 20-5" fill="none" strokeOpacity=".5" />
            {/* Santa */}
            <circle cx="124" cy="31" r="4.6" fill="#c0392b" />
            <rect x="119" y="25.5" width="10" height="2.4" rx="1.2" fill="#f8fafc" stroke="none" />
            <circle cx="128.5" cy="24.5" r="1.8" fill="#f8fafc" stroke="none" />
            {/* Gift sack */}
            <path d="M114 34q5-6 11-3 4 2 1 7-6 4-11 0z" fill="#1f7a45" />
          </g>
          <g fill="#fff1c9">
            <circle className="spark" cx="170" cy="34" r="2.2" />
            <circle className="spark" cx="182" cy="26" r="1.6" style={{ ['--delay' as any]: '-.5s' }} />
            <circle className="spark" cx="190" cy="40" r="1.2" style={{ ['--delay' as any]: '-1s' }} />
            <circle className="spark" cx="176" cy="48" r="1" style={{ ['--delay' as any]: '-1.4s' }} />
          </g>
        </svg>
      </div>
    </div>
  );
});

ChristmasScene.displayName = 'ChristmasScene';
