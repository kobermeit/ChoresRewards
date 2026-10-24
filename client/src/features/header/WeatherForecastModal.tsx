import React from 'react';
import { Overlay } from '../../components/ui';
import { weatherInfo } from './weatherUtils';

export interface WeatherForecastModalProps {
  open: boolean;
  onClose: () => void;
  weatherDaily: any;
  isThemed: boolean;
  seasonAccent: string;
}

export const WeatherForecastModal: React.FC<WeatherForecastModalProps> = ({
  open,
  onClose,
  weatherDaily,
  isThemed,
  seasonAccent,
}) => {
  return (
    <Overlay
      open={open}
      onClose={onClose}
      backdropBlur
      lockScroll
      className="weather-backdrop-overlay"
      style={{ alignItems: 'flex-start', paddingTop: '75px' }}
    >
      <div
        id="weather-forecast-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(940px, calc(100vw - 32px))',
          background: isThemed
            ? `linear-gradient(135deg, ${seasonAccent}22 0%, var(--cr-header-bg-2) 100%)`
            : 'linear-gradient(135deg, var(--cr-header-bg-1) 0%, var(--cr-header-bg-2) 100%)',
          borderRadius: '16px',
          border: isThemed
            ? `1px solid ${seasonAccent}55`
            : '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: isThemed
            ? `0 20px 45px -8px rgba(0, 0, 0, 0.75), 0 0 25px ${seasonAccent}33`
            : '0 20px 45px -8px rgba(0, 0, 0, 0.75), 0 0 25px rgba(59, 130, 246, 0.25)',
          overflow: 'hidden',
        }}
      >
        {isThemed && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '12px 22px 0',
              fontSize: '0.86rem',
              fontWeight: 700,
              color: seasonAccent,
              borderBottom: `1px solid ${seasonAccent}25`,
              paddingBottom: 8,
              margin: '0 4px',
            }}
          >
            <span>7-Day Weather Forecast</span>
          </div>
        )}
        <div
          id="weather-forecast-days"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))',
            gap: 12,
            padding: '16px 22px',
          }}
        >
          {(weatherDaily?.time || []).map((dateStr: string, idx: number) => {
            const d = new Date(`${dateStr}T00:00:00`);
            const dayLabel = idx === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' });
            const info = weatherInfo(weatherDaily.weathercode?.[idx] ?? 0);
            const max = Math.round(weatherDaily.temperature_2m_max?.[idx] ?? 0);
            const min = Math.round(weatherDaily.temperature_2m_min?.[idx] ?? 0);
            return (
              <div
                key={dateStr}
                style={{
                  textAlign: 'center',
                  padding: '10px 8px',
                  borderRadius: 12,
                  background: idx === 0 ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.06)',
                  border: idx === 0 ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div style={{ color: 'var(--cr-text-primary)', fontSize: '0.9em', fontWeight: 700, marginBottom: 6 }}>
                  {dayLabel}
                </div>
                <i className={`fas ${info.icon}`} style={{ fontSize: '1.8em', color: info.color }} />
                <div style={{ color: 'var(--cr-text-primary)', fontSize: '1em', fontWeight: 700, marginTop: 6 }}>
                  {max}° <span style={{ opacity: 0.65, fontWeight: 500 }}>{min}°</span>
                </div>
                <div style={{ color: 'var(--cr-text-secondary)', fontSize: '0.75em', marginTop: 4 }}>
                  {info.desc}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Overlay>
  );
};
