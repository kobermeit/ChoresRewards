import React from 'react';
import { Person } from '../../types';
import { resolveAvatarUrl } from '../../api';

export interface AssigneeBadgeProps {
  assignee?: string | null;
  person?: Person | null;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Reusable high-contrast assignee pill for cards.
 * Displays member avatar + name or "🌟 Everyone".
 */
export const AssigneeBadge: React.FC<AssigneeBadgeProps> = ({
  assignee,
  person,
  className = '',
  style = {},
}) => {
  const isEveryone = !assignee || assignee === 'Everyone' || assignee === 'All';

  if (isEveryone) {
    return (
      <span
        className={`cr-assignee-badge cr-assignee-everyone ${className}`.trim()}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '3px 9px',
          borderRadius: 'var(--radius-pill, 999px)',
          background: 'rgba(126, 34, 206, 0.92)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1.5px solid rgba(192, 132, 252, 0.55)',
          color: '#ffffff',
          fontWeight: 800,
          fontSize: '0.76rem',
          letterSpacing: '0.2px',
          boxShadow: '0 3px 10px rgba(0, 0, 0, 0.45)',
          lineHeight: 1.2,
          ...style,
        }}
      >
        <span>🌟</span>
        <span>Everyone</span>
      </span>
    );
  }

  const name = person?.name || assignee || '';
  const avatarUrl = resolveAvatarUrl(person?.avatar);

  return (
    <div
      className={`cr-assignee-badge ${className}`.trim()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        padding: '2px 8px 2px 3px',
        borderRadius: 'var(--radius-pill, 999px)',
        border: person?.color
          ? `1.5px solid ${person.color}99`
          : '1.5px solid rgba(255, 255, 255, 0.25)',
        boxShadow: '0 3px 10px rgba(0, 0, 0, 0.5)',
        lineHeight: 1.2,
        ...style,
      }}
    >
      <img
        src={avatarUrl}
        alt={name}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = resolveAvatarUrl(null);
        }}
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          objectFit: 'cover',
          border: person?.color ? `1px solid ${person.color}` : '1px solid rgba(255, 255, 255, 0.4)',
        }}
      />
      <span style={{ fontWeight: 800, color: '#f8fafc', fontSize: '0.78rem' }}>
        {name}
      </span>
    </div>
  );
};

export default AssigneeBadge;
