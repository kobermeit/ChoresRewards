import React, { useMemo } from 'react';
import SkyLayer from './scene/SkyLayer';
import TerrainLayer from './scene/TerrainLayer';
import VillageLayer from './scene/VillageLayer';
import LivingSceneCanvas from './scene/LivingSceneCanvas';
import SceneStills from './SceneStills';
import { WALKERS } from './scene/actors';
import './scene/scene.css';

interface ChristmasSceneProps {
  /** snow density multiplier */
  density?: number;
  /** calm mode: no Santa, no parallax, no extra traffic */
  calmMode?: boolean;
  /** extra life (ambient / screensaver) */
  lively?: boolean;
  /** render the gutter vignette (always-on stills) */
  showStills?: boolean;
}

/**
 * "Santa Tracker, but dark" — the living backdrop.
 *
 * Sky (decoration) → terrain (mountains) → Google's village, night-graded →
 * high-performance single-layer Canvas actors (Santa flight, skier trail, walkers).
 */
export const ChristmasScene: React.FC<ChristmasSceneProps> = React.memo(
  ({ calmMode = false, lively = false, showStills = true }) => {
    // baseline traffic always; the idle-only crowd joins once the screen is quiet
    const walkers = useMemo(
      () => (calmMode ? WALKERS.slice(0, 1) : WALKERS.filter((w) => !w.idleOnly || lively)),
      [calmMode, lively]
    );

    return (
      <div className="cr-scene" aria-hidden="true">
        <div className="cr-scene__stage">
          <SkyLayer />
          <TerrainLayer />
          <VillageLayer />
          <LivingSceneCanvas walkers={walkers} enabled={!calmMode} calm={calmMode} />
        </div>
        {/* the gutter vignette lives in the viewport, not the scaled stage */}
        {showStills && <SceneStills />}
      </div>
    );
  }
);

ChristmasScene.displayName = 'ChristmasScene';
export default ChristmasScene;
