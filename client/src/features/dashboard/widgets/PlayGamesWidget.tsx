import React, { memo } from 'react';
import { SeasonalCardWatermark } from '../SeasonalCardWatermark';

export interface PlayGamesWidgetProps {
  onOpenPlayGame: (gameType: 'maths' | 'colours' | 'patterns' | 'memory') => void;
}

export const PlayGamesWidget: React.FC<PlayGamesWidgetProps> = memo(({ onOpenPlayGame }) => {
  return (
    <div
      className="dashboard-card dashboard-card-play"
      id="dashboard-play-panel"
      style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', overflow: 'hidden' }}
    >
      <SeasonalCardWatermark variant={6} />
      <h3 className="dashboard-card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <i className="fas fa-star" style={{ color: '#fbbf24' }} />
        <span>Play Games</span>
      </h3>
      <div
        className="play-launch-row"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 10,
          maxWidth: 280,
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <button
          type="button"
          className="play-launch play-launch-maths"
          id="play-open-maths"
          aria-label="Play maths"
          style={{ aspectRatio: '1 / 1', minHeight: 0, width: '100%' }}
          onClick={() => onOpenPlayGame('maths')}
        >
          <span className="play-launch-mark" aria-hidden="true">
            ×
          </span>
          <span className="play-launch-label">Maths</span>
        </button>
        <button
          type="button"
          className="play-launch play-launch-colours"
          id="play-open-colours"
          aria-label="Play colours"
          style={{ aspectRatio: '1 / 1', minHeight: 0, width: '100%' }}
          onClick={() => onOpenPlayGame('colours')}
        >
          <span className="play-launch-swatches" aria-hidden="true">
            <i style={{ background: '#ef4444' }} />
            <i style={{ background: '#facc15' }} />
            <i style={{ background: '#3b82f6' }} />
            <i style={{ background: '#22c55e' }} />
          </span>
          <span className="play-launch-label">Colours</span>
        </button>
        <button
          type="button"
          className="play-launch play-launch-patterns"
          id="play-open-patterns"
          aria-label="Play patterns"
          style={{ aspectRatio: '1 / 1', minHeight: 0, width: '100%' }}
          onClick={() => onOpenPlayGame('patterns')}
        >
          <span className="play-launch-mark play-launch-mark-sm" aria-hidden="true">
            2 4 6
          </span>
          <span className="play-launch-label">Patterns</span>
        </button>
        <button
          type="button"
          className="play-launch play-launch-memory"
          id="play-open-memory"
          aria-label="Play memory"
          style={{ aspectRatio: '1 / 1', minHeight: 0, width: '100%' }}
          onClick={() => onOpenPlayGame('memory')}
        >
          <span className="play-launch-cards" aria-hidden="true">
            <i />
            <i />
          </span>
          <span className="play-launch-label">Memory</span>
        </button>
      </div>
    </div>
  );
});

PlayGamesWidget.displayName = 'PlayGamesWidget';
