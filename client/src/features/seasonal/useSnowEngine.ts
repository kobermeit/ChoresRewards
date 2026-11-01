import { useEffect, useRef } from 'react';

interface Flake {
  x: number;
  y: number;
  r: number;
  vy: number;
  drift: number;
  a: number;
  phase: number;
  spin: number;
}

const BANDS = [
  { count: 90, size: [1.3, 2.6], speed: [16, 30], drift: 9, alpha: [0.30, 0.55] }, // far
  { count: 52, size: [2.8, 5.0], speed: [30, 52], drift: 15, alpha: [0.45, 0.72] }, // mid
  { count: 18, size: [5.5, 9.5], speed: [52, 88], drift: 22, alpha: [0.55, 0.85] }, // near
];

const SPRITE_SIZE = 32;

/**
 * Creates and renders the single pre-rendered canvas snowflake radial sprite.
 */
function createFlakeSprite(): HTMLCanvasElement {
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = SPRITE_SIZE;
  const sc = sprite.getContext('2d');
  if (sc) {
    const half = SPRITE_SIZE / 2;
    const g = sc.createRadialGradient(half, half, 0, half, half, half);
    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
    g.addColorStop(0.42, 'rgba(255, 255, 255, 0.9)');
    g.addColorStop(0.78, 'rgba(233, 244, 255, 0.35)');
    g.addColorStop(1, 'rgba(233, 244, 255, 0)');
    sc.fillStyle = g;
    sc.beginPath();
    sc.arc(half, half, half, 0, Math.PI * 2);
    sc.fill();
  }
  return sprite;
}

export function useSnowEngine(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  density: number = 2.0,
  enabled: boolean = true
) {
  const spriteRef = useRef<HTMLCanvasElement | null>(null);
  const flakesRef = useRef<Flake[]>([]);
  const densityRef = useRef(density);
  densityRef.current = density;

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    if (!spriteRef.current) {
      spriteRef.current = createFlakeSprite();
    }
    const sprite = spriteRef.current;

    let W = window.innerWidth;
    let H = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const rnd = (() => {
      let seed = 20241225;
      return () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    })();
    const rndRange = (a: number, b: number) => a + rnd() * (b - a);

    const buildFlakes = () => {
      const arr: Flake[] = [];
      const scale = Math.max(0.6, Math.min(1.6, W / 1280));
      const curDensity = densityRef.current;

      for (const band of BANDS) {
        const n = Math.round(band.count * scale * curDensity);
        for (let i = 0; i < n; i++) {
          arr.push({
            x: rndRange(-40, W + 40),
            y: rndRange(-H, H),
            r: rndRange(band.size[0], band.size[1]),
            vy: rndRange(band.speed[0], band.speed[1]),
            drift: band.drift,
            a: rndRange(band.alpha[0], band.alpha[1]),
            phase: rndRange(0, Math.PI * 2),
            spin: rndRange(0.4, 1.2),
          });
        }
      }
      flakesRef.current = arr;
    };

    const handleResize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildFlakes();
    };

    handleResize();

    let animId: number;
    let lastTime = performance.now();
    let isTabVisible = !document.hidden;

    const render = (now: number) => {
      if (!isTabVisible) {
        animId = requestAnimationFrame(render);
        return;
      }

      const dtRaw = now - lastTime;
      lastTime = now;
      const dt = Math.min(dtRaw, 50); // clamp so tab-switching doesn't teleport flakes
      const t = now / 1000;

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      const flakes = flakesRef.current;
      const len = flakes.length;
      for (let i = 0; i < len; i++) {
        const f = flakes[i];
        f.y += (f.vy * dt) / 1000;
        const sway = Math.sin(t * f.spin + f.phase) * f.drift;
        if (f.y > H + 30) {
          f.y = -30;
          f.x = rndRange(-40, W + 40);
        }
        ctx.globalAlpha = f.a;
        const d = f.r;
        ctx.drawImage(sprite, f.x + sway - d / 2, f.y - d / 2, d, d);
      }
      ctx.globalAlpha = 1;

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    const onVisibilityChange = () => {
      isTabVisible = !document.hidden;
      if (isTabVisible) {
        lastTime = performance.now();
      }
    };

    let resizeTimer: any = 0;
    const debouncedResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(handleResize, 160);
    };

    window.addEventListener('resize', debouncedResize, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelAnimationFrame(animId);
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', debouncedResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [enabled, density, canvasRef]);
}
