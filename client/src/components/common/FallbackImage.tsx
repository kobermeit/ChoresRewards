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
    return (
      <div
        className={className}
        style={{
          width: '100%',
          height: '100%',
          minHeight: 80,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))',
          color: 'rgba(255, 255, 255, 0.45)',
          userSelect: 'none',
          ...style,
        }}
      >
        {fallbackEmoji ? (
          <span style={{ fontSize: '2rem', lineHeight: 1 }}>{fallbackEmoji}</span>
        ) : (
          <i className={`fas ${fallbackIcon}`} style={{ fontSize: '1.6rem', opacity: 0.6 }} />
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
