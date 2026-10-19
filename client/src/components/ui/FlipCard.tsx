import React from 'react';

export interface FlipCardProps {
  /**
   * Whether the card is currently flipped to show its back face.
   */
  isFlipped: boolean;
  /**
   * Content rendered on the front of the card.
   */
  front: React.ReactNode;
  /**
   * Optional content rendered on the back of the card.
   */
  back?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Reusable 3D Perspective Flip Card component following modern UI standards.
 * Smooth 60fps CSS transform (preserve-3d + backface-visibility: hidden)
 * with zero layout shifts or height discrepancies.
 */
export const FlipCard: React.FC<FlipCardProps> = ({
  isFlipped,
  front,
  back,
  className = '',
  style,
}) => {
  if (!back) {
    return (
      <div className={`cr-flip-card-wrapper ${className}`} style={style}>
        {front}
      </div>
    );
  }

  return (
    <div
      className={`cr-flip-card-wrapper ${className}`}
      style={{
        perspective: '1000px',
        ...style,
      }}
    >
      <div
        className="cr-flip-card-inner"
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.55s cubic-bezier(0.25, 1, 0.5, 1)',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* Front Face */}
        <div
          className="cr-flip-card-front"
          style={{
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
          {front}
        </div>

        {/* Back Face */}
        <div
          className="cr-flip-card-back"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          {back}
        </div>
      </div>
    </div>
  );
};
