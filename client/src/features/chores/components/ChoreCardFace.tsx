import React from 'react';
import { CardShell } from '../../../components/ui';
import { resolveAssetUrl } from '../../../api';

export interface ChoreCardFaceProps {
  title: string;
  imageUrl?: string | null;
  fallbackIcon?: string | null;
  /** Rendered in the top-left corner (PointsBadge from the caller). */
  pointsBadge: React.ReactNode;
  minutes?: number | null;
  streak?: number;
  /** Small line under the title, e.g. "Abby · Daily". */
  meta: string;
  accentColor?: string | null;
  isDone?: boolean;
  isOverdue?: boolean;
  /** The complete / undo / start-timer button. */
  cta: React.ReactNode;
  onOpen: () => void;
}

/**
 * Full-bleed chore card ("Variant A"): the image fills the whole card and the
 * title + action button sit on top of it.
 *
 * Tap behaviour:
 *  - The whole card opens the chore (edit modal for parents, read-only detail modal otherwise).
 *  - The CTA keeps its own action — the caller wraps it with `stopPropagation`.
 *  - Every overlay (scrim, badges, title block) is `pointer-events: none`, so nothing
 *    steals the tap away from the card body.
 */
export const ChoreCardFace: React.FC<ChoreCardFaceProps> = ({
  title,
  imageUrl,
  fallbackIcon,
  pointsBadge,
  minutes,
  streak,
  meta,
  accentColor,
  isDone = false,
  isOverdue = false,
  cta,
  onOpen,
}) => {
  const image = imageUrl ? resolveAssetUrl(imageUrl) : null;

  return (
    <CardShell
      accentColor={accentColor}
      tone={isDone ? 'completed' : isOverdue ? 'overdue' : 'default'}
      className={isOverdue && !isDone ? 'cr-chore-face--late' : ''}
    >
      <div
        className={`cr-chore-face ${isDone ? 'cr-chore-face--done' : ''}`.trim()}
        role="button"
        tabIndex={0}
        aria-label={`${title} — open details`}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpen();
          }
        }}
      >
        {image ? (
          <img className="cr-chore-face__img" src={image} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="cr-chore-face__emoji" aria-hidden="true">
            {fallbackIcon || '⭐'}
          </span>
        )}
        <div className="cr-chore-face__scrim" aria-hidden="true" />

        <div className="cr-chore-face__top">
          {pointsBadge}
          {streak && streak > 1 ? (
            <span className="cr-chore-face__streak" title={`${streak} days in a row`}>
              🔥 {streak}
            </span>
          ) : null}
          {minutes ? (
            <span className="cr-chore-face__ring" aria-hidden="true">
              <span>{minutes}m</span>
            </span>
          ) : null}
        </div>

        <div className="cr-chore-face__bottom">
          <h3 className="cr-chore-face__title">{title}</h3>
          <div className="cr-chore-face__meta">
            <span className="cr-chore-face__dot" style={{ background: accentColor || '#fbbf24' }} />
            <span>{meta}</span>
          </div>
          {cta}
        </div>
      </div>
    </CardShell>
  );
};

export default ChoreCardFace;
