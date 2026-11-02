import React from 'react';
import { resolveAssetUrl } from '../../api';
import { STILLS } from './scene/actors';

/**
 * The still vignette in the right gutter: a waving elf, a pine and a
 * half-built snowman. These are always on — they are the scene's presence while
 * cards are in use, which is why they live in the gutter (the only full-height
 * space the cards never cover) and why they never fade in and out.
 *
 * Hidden below 1280px, where there is no gutter to stand in.
 */
export const SceneStills: React.FC = React.memo(() => (
  <div className="cr-scene__stills" aria-hidden="true">
    <img className="cr-still-snowman" src={resolveAssetUrl(STILLS.snowman)} alt="" />
    <img className="cr-still-tree" src={resolveAssetUrl(STILLS.tree)} alt="" />
    <img className="cr-still-elf" src={resolveAssetUrl(STILLS.elf)} alt="" />
  </div>
));

SceneStills.displayName = 'SceneStills';
export default SceneStills;
