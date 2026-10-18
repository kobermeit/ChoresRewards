import React from 'react';
import { resolveAvatarUrl } from '../../api';

export interface UserAvatarProps {
  avatar?: string | null;
  name?: string;
  color?: string | null;
  size?: number; // Size in px, default 40
  borderWidth?: number; // Border ring width in px, default 2.5
  className?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  avatar,
  name = '',
  color,
  size = 40,
  borderWidth = 2.5,
  className = '',
  style = {},
  onClick,
  title,
}) => {
  const accentColor = color || '#38bdf8';

  return (
    <div
      className={`user-avatar-wrap ${className}`.trim()}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        borderRadius: '50%',
        padding: borderWidth,
        background: `radial-gradient(circle, ${accentColor} 0%, ${accentColor}ee 100%)`,
        boxShadow: `0 2px 8px ${accentColor}40`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'default',
        boxSizing: 'border-box',
        flexShrink: 0,
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        ...style,
      }}
      onClick={onClick}
      title={title || name}
    >
      <img
        src={resolveAvatarUrl(avatar)}
        alt={name}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = resolveAvatarUrl(null);
        }}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          objectFit: 'cover',
          display: 'block',
        }}
      />
    </div>
  );
};

export default UserAvatar;
