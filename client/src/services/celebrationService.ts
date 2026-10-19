import confetti from 'canvas-confetti';

/**
 * Fires full-screen celebratory fireworks celebration.
 * Multiple bursts from different positions across the screen for 2.5 seconds.
 */
export function fireCelebrationFireworks() {
  const duration = 2.5 * 1000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 };

  function randomInRange(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  const interval: any = setInterval(() => {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const particleCount = 50 * (timeLeft / duration);

    // Burst 1 (left side)
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      colors: ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff'],
    });

    // Burst 2 (right side)
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      colors: ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff'],
    });
  }, 250);
}

/**
 * Fires a single energetic confetti cannon burst from the center/bottom of the screen.
 * Ideal for individual chore completion or timer finish.
 */
export function fireChoreConfetti(originX = 0.5, originY = 0.6) {
  confetti({
    particleCount: 80,
    spread: 100,
    origin: { x: originX, y: originY },
    zIndex: 10000,
    colors: ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#38bdf8'],
    scalar: 1.2,
  });
}
