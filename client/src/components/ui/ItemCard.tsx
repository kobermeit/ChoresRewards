import React from 'react';
import { resolveAssetUrl } from '../../api';
import { CardShell } from './CardShell';

export interface ItemCardProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  imageUrl?: string | null;
  icon?: React.ReactNode;
  fallbackIcon?: string;
  heroHeight?: number;
  pointsBadge?: React.ReactNode;
  statusBadges?: React.ReactNode;
  progress?: React.ReactNode;
  primaryAction?: React.ReactNode;
  secondaryActions?: React.ReactNode;
  isOverdue?: boolean;
  isCompleted?: boolean;
  accentColor?: string | null;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({
  title,
  subtitle,
  description,
  imageUrl,
  icon,
  fallbackIcon = 'fa-star',
  heroHeight = 110,
  pointsBadge,
  statusBadges,
  progress,
  primaryAction,
  secondaryActions,
  isOverdue = false,
  isCompleted = false,
  accentColor,
  className = '',
  style = {},
  onClick,
}) => {
  const circleSize = Math.max(56, Math.min(84, Math.round(heroHeight * 0.68)));
  const emojiSize = heroHeight <= 100 ? '2.5rem' : '3.3rem';

  return (
    <CardShell
      className={className}
      accentColor={accentColor}
      tone={isOverdue ? 'overdue' : isCompleted ? 'completed' : 'default'}
      style={style}
      onClick={onClick}
    >
      {/* Edge-to-Edge Hero Banner */}
      <div
        className="cr-item-card-hero"
        style={{
          position: 'relative',
          height: heroHeight,
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {imageUrl ? (
          <>
            <img
              src={resolveAssetUrl(imageUrl)}
              alt={typeof title === 'string' ? title : ''}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  const span = document.createElement('span');
                  span.style.fontSize = emojiSize;
                  span.innerText = '⭐';
                  parent.appendChild(span);
                }
              }}
            />
            {/* Gradient shadow for images */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to top, rgba(15, 23, 42, 0.92) 0%, rgba(15, 23, 42, 0.2) 50%, transparent 100%)',
                pointerEvents: 'none',
              }}
            />
          </>
        ) : icon ? (
          <div
            style={{
              width: circleSize,
              height: circleSize,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.02) 70%, transparent 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {typeof icon === 'string' && icon.length <= 4 ? (
              <span style={{ fontSize: emojiSize, filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.5))', lineHeight: 1 }}>
                {icon}
              </span>
            ) : (
              icon
            )}
          </div>
        ) : (
          <div
            style={{
              width: circleSize,
              height: circleSize,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <i
              className={`fas ${fallbackIcon}`}
              style={{ fontSize: '2.2rem', color: 'rgba(255,255,255,0.4)' }}
            />
          </div>
        )}

        {/* Top-Right Points Currency Pill */}
        {pointsBadge && (
          <div
            className="cr-item-card-points-badge"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 2,
            }}
          >
            {pointsBadge}
          </div>
        )}

        {/* Top-Left Status / Tags Badges */}
        {statusBadges && (
          <div
            className="cr-item-card-status-badges"
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              zIndex: 2,
            }}
          >
            {statusBadges}
          </div>
        )}
      </div>

      {/* Card Content Body */}
      <div
        className="cr-item-card-body"
        style={{
          padding: '15px 15px 15px',
          display: 'flex',
          flexDirection: 'column',
          gap: 13,
          flex: 1,
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
            <h3
              className="cr-item-card-title"
              style={{
                margin: '0 0 4px',
                fontSize: '1rem',
                fontWeight: 800,
                color: '#f8fafc',
                lineHeight: 1.3,
                wordBreak: 'break-word',
                flex: 1,
              }}
              title={typeof title === 'string' ? title : undefined}
            >
              {title}
            </h3>

            {secondaryActions && (
              <div
                className="cr-item-card-secondary-actions"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  flexShrink: 0,
                }}
              >
                {secondaryActions}
              </div>
            )}
          </div>

          {description && (
            <div
              className="cr-item-card-description"
              style={{
                fontSize: '0.82rem',
                color: 'var(--color-text-secondary, #94a3b8)',
                lineHeight: 1.35,
                marginTop: 2,
                marginBottom: 6,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={typeof description === 'string' ? description : undefined}
            >
              {description}
            </div>
          )}

          {subtitle && (
            <div className="cr-item-card-subtitle" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              {subtitle}
            </div>
          )}

          {progress && (
            <div className="cr-item-card-progress" style={{ marginTop: 6 }}>
              {progress}
            </div>
          )}
        </div>

        {/* Bottom Actions Row */}
        {primaryAction && (
          <div
            className="cr-item-card-actions"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 'auto',
              paddingTop: 8,
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              width: '100%',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>{primaryAction}</div>
          </div>
        )}
      </div>
    </CardShell>
  );
};

export default ItemCard;
