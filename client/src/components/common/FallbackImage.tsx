import React, { useState, useEffect } from 'react';

export interface FallbackImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackEmoji?: string;
  fallbackIcon?: string;
  fallbackContent?: React.ReactNode;
}

export const FallbackImage: React.FC<FallbackImageProps> = ({
  src,
  alt,
  fallbackEmoji,
  fallbackIcon = 'fa-utensils',
  fallbackContent,
  className,
  style,
  ...rest
}) => {
  const [error, setError] = useState(false);

  // Reset error when src changes
  useEffect(() => {
    setError(false);
  }, [src]);

  if (!src || error) {
    if (fallbackContent) {
      return <>{fallbackContent}</>;
    }
    const isSmall =
      (typeof style?.height === 'number' && style.height <= 40) ||
      (typeof style?.width === 'number' && style.width <= 40);
    const minH = style?.minHeight !== undefined ? style.minHeight : isSmall ? (style?.height ?? 'auto') : 80;
    const emojiSize = isSmall ? (style?.fontSize ? style.fontSize : '1.15rem') : '2rem';
    const iconSize = isSmall ? '0.9rem' : '1.6rem';

    return (
      <div
        className={className}
        style={{
          width: '100%',
          height: '100%',
          minHeight: minH,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: isSmall ? 'transparent' : 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))',
          color: 'rgba(255, 255, 255, 0.45)',
          userSelect: 'none',
          ...style,
        }}
      >
        {fallbackEmoji ? (
          <span style={{ fontSize: emojiSize, lineHeight: 1 }}>{fallbackEmoji}</span>
        ) : (
          <i className={`fas ${fallbackIcon}`} style={{ fontSize: iconSize, opacity: 0.6 }} />
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      style={style}
      onError={() => setError(true)}
      {...rest}
    />
  );
};
