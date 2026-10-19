import React from 'react';
import { resolveAssetUrl } from '../../api';

export interface ItemCardProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
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

  const memberBorder = accentColor ? `${accentColor}38` : 'rgba(255, 255, 255, 0.12)';
  const memberTopBorder = accentColor ? `${accentColor}cc` : 'rgba(255, 255, 255, 0.22)';

  return (
    <div
      className={`cr-item-card ${isCompleted ? 'cr-item-card-completed' : ''} ${className}`.trim()}
      style={{
        background: 'linear-gradient(150deg, #24344d 0%, #152238 100%)',
        border: isOverdue
          ? '1.5px solid rgba(239, 68, 68, 0.85)'
          : isCompleted
            ? '1.5px solid rgba(16, 185, 129, 0.55)'
            : `1.5px solid ${memberBorder}`,
        borderTop: isOverdue
          ? '2.5px solid #ef4444'
          : isCompleted
            ? '2.5px solid #10b981'
            : `2.5px solid ${memberTopBorder}`,
        borderRadius: 'var(--card-radius, 16px)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: accentColor
          ? `0 6px 20px rgba(0, 0, 0, 0.4), 0 0 16px ${accentColor}18`
          : '0 6px 20px rgba(0, 0, 0, 0.35)',
        boxSizing: 'border-box',
        width: '100%',
        position: 'relative',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
        ...style,
      }}
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
          padding: '12px 14px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
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
    </div>
  );
};

export default ItemCard;
