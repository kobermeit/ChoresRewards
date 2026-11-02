import React from 'react';
import { resolveAssetUrl } from '../../../api';
import { SKIER_FRAMES, type WalkerSpec } from './actors';

interface SceneActorsProps {
  walkers: WalkerSpec[];
}

/**
 * Every moving character. Each one is a single positioned `<div>` that the
 * motion loop transforms — no React state changes while the scene runs. The
 * loop finds them with `[data-actor]`, so no ref plumbing is needed.
 */
export const SceneActors: React.FC<SceneActorsProps> = React.memo(({ walkers }) => (
  <>
    {/* the skier who leaves a track down the snow */}
    <div className="cr-scene__actor cr-scene__skier" data-actor="skier" style={{ width: 48, height: 56 }}>
      <span className="cr-scene__spray" />
      <img src={resolveAssetUrl(SKIER_FRAMES[0])} alt="" aria-hidden="true" />
    </div>

    {/* villagers walking / riding / rolling along the street */}
    {walkers.map((w) => (
      <div
        key={w.id}
        data-actor={w.id}
        className={`cr-scene__actor cr-scene__walker${w.far ? ' cr-scene__walker--far' : ''}`}
        style={{ width: w.size[0], height: w.size[1] }}
      >
        <span className="cr-scene__shadow" />
        <img
          src={resolveAssetUrl(w.frames[0])}
          alt=""
          aria-hidden="true"
          style={w.flip ? { transform: 'scaleX(-1)' } : undefined}
        />
      </div>
    ))}

    {/* Santa. The rig pivots on its runners (see GROUND_LINE) so landings plant. */}
    <div className="cr-scene__sleigh" data-actor="sleigh">
      <span className="cr-scene__contact" />
      <span className="cr-scene__dust" />
      <svg viewBox="0 0 420 150" aria-hidden="true">
        <use href="#sleigh-art" />
      </svg>
    </div>
  </>
));

SceneActors.displayName = 'SceneActors';
export default SceneActors;
