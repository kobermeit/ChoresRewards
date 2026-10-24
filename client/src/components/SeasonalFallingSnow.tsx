import React, { useMemo } from 'react';
import { useSeason } from '../hooks/useSettings';

interface FlakeData {
  id: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
  isSnowflakeChar: boolean;
}

export const SeasonalFallingSnow: React.FC = () => {
  const seasonInfo = useSeason();

  const isWinterOrChristmas = useMemo(() => {
    if (!seasonInfo.enabled || !seasonInfo.fallingSnowEnabled) return false;
    const eventKey = (seasonInfo.event?.key || '').toLowerCase();
    const seasonKey = (seasonInfo.season?.key || '').toLowerCase();
    const forced = (seasonInfo.forcedTheme || '').toLowerCase();

    return (
      eventKey.includes('christ') ||
      eventKey.includes('xmas') ||
      seasonKey.includes('winter') ||
      forced.includes('christ') ||
      forced.includes('winter')
    );
  }, [seasonInfo]);

  // Deterministic snowflake array to prevent recalculations
  const flakes = useMemo<FlakeData[]>(() => {
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: Math.round(((i * 3.33 + (i % 5) * 2) % 98) * 10) / 10,
      size: 4 + (i % 5) * 1.5,
      duration: 7 + (i % 6) * 1.5,
      delay: -(i % 8) * 1.2,
      opacity: 0.25 + (i % 4) * 0.15,
      isSnowflakeChar: i % 7 === 0,
    }));
  }, []);

  if (!isWinterOrChristmas) return null;

  return (
    <div
      className="cr-snow-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9998,
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      {flakes.map((f) => (
        <span
          key={f.id}
          className="cr-snowflake"
          style={{
            position: 'absolute',
            top: -24,
            left: `${f.left}%`,
            width: f.size,
            height: f.size,
            opacity: f.opacity,
            animationDuration: `${f.duration}s`,
            animationDelay: `${f.delay}s`,
            pointerEvents: 'none',
            fontSize: f.isSnowflakeChar ? `${f.size + 4}px` : undefined,
            color: f.isSnowflakeChar ? 'rgba(255, 255, 255, 0.7)' : undefined,
            background: f.isSnowflakeChar
              ? 'transparent'
              : 'radial-gradient(circle, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.4) 70%, transparent 100%)',
            borderRadius: f.isSnowflakeChar ? undefined : '50%',
            filter: f.isSnowflakeChar ? undefined : 'blur(0.4px)',
          }}
        >
          {f.isSnowflakeChar ? '❄' : null}
        </span>
      ))}
    </div>
  );
};
