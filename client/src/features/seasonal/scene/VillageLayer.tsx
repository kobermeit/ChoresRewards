import React from 'react';
import { resolveAssetUrl } from '../../../api';

/**
 * Google's Santa Tracker village, graded from daylight to moonlight.
 *
 * The grade is one filter — `brightness .30 / saturate .5 / contrast 1.15`.
 * Multiply/screen blend grades were tried first and all washed the art out;
 * this keeps its own contrast. Warm radial gradients then read as lit windows.
 */
export const VillageLayer: React.FC = React.memo(() => (
  <div className="cr-scene__village" aria-hidden="true">
    <img src={resolveAssetUrl('static/images/seasonal/christmas/village/3.svg')} alt="" />
    <div className="cr-scene__spill" />
  </div>
));

VillageLayer.displayName = 'VillageLayer';
export default VillageLayer;
