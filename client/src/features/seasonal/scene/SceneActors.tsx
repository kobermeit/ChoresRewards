import React from 'react';
import { resolveAssetUrl } from '../../../api';
import { SKIER_FRAMES, type WalkerSpec } from './actors';

interface SceneActorsProps {
  walkers: WalkerSpec[];
}

interface ActorFramesProps {
  frames: string[];
  /** sprite art faces right — mirror it for left-moving actors */
  flip?: boolean;
}

/**
 * Every frame of a sprite is rendered up-front and stacked, and the motion loop
 * only toggles the `is-on` class. Rewriting `<img src>` every ~300 ms made the
 * browser log a request per frame change and cancel any load still in flight,
 * so nothing here ever touches `src` after mount.
 */
const ActorFrames: React.FC<ActorFramesProps> = React.memo(({ frames, flip }) => (
  <>
    {frames.map((frame, i) => (
      <img
        key={frame}
        className={i === 0 ? 'cr-frame is-on' : 'cr-frame'}
        src={resolveAssetUrl(frame)}
        alt=""
        aria-hidden="true"
        decoding="async"
        draggable={false}
        style={flip ? { transform: 'scaleX(-1)' } : undefined}
      />
    ))}
  </>
));
ActorFrames.displayName = 'ActorFrames';

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
      <ActorFrames frames={SKIER_FRAMES} />
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
        <ActorFrames frames={w.frames} flip={w.flip} />
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
