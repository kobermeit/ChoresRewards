import React, { useMemo, useRef } from 'react';
import SleighArtDefs from './scene/SleighArtDefs';
import SkyLayer from './scene/SkyLayer';
import TerrainLayer from './scene/TerrainLayer';
import VillageLayer from './scene/VillageLayer';
import SceneActors from './scene/SceneActors';
import SceneStills from './SceneStills';
import { useSceneMotion } from './scene/useSceneMotion';
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
 * Sky (decoration) → terrain (the ground everything stands on) → Google's
 * village, night-graded → actors → one rAF loop driving the lot.
 * Choreography lives in `scene/useSceneMotion.ts`, geometry in `scene/terrain.ts`.
 */
export const ChristmasScene: React.FC<ChristmasSceneProps> = React.memo(
  ({ density = 2, calmMode = false, lively = false, showStills = true }) => {
    const rootRef = useRef<HTMLDivElement | null>(null);

    // baseline traffic always; the idle-only crowd joins once the screen is quiet
    const walkers = useMemo(
      () => (calmMode ? WALKERS.slice(0, 1) : WALKERS.filter((w) => !w.idleOnly || lively)),
      [calmMode, lively]
    );

    useSceneMotion({ rootRef, walkers, enabled: !calmMode, calm: calmMode });

    return (
      <div className="cr-scene" ref={rootRef} aria-hidden="true">
        <div className="cr-scene__stage">
          <SleighArtDefs />
          <SkyLayer />
          <TerrainLayer />
          <VillageLayer />
          <SceneActors walkers={walkers} />
        </div>
        {/* the gutter vignette lives in the viewport, not the scaled stage */}
        {showStills && <SceneStills />}
      </div>
    );
  }
);

ChristmasScene.displayName = 'ChristmasScene';
export default ChristmasScene;
