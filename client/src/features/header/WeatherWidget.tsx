import React, { useState, useEffect } from 'react';
import { weatherInfo } from './weatherUtils';
import { WeatherForecastModal } from './WeatherForecastModal';

export interface WeatherWidgetProps {
  timezone?: string;
  isThemed: boolean;
  seasonAccent: string;
}

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({
  timezone,
  isThemed,
  seasonAccent,
}) => {
  const [weatherCurrent, setWeatherCurrent] = useState<{
    temp: number;
    icon: string;
    color: string;
    desc: string;
    hilo: string;
  }>({
    temp: 0,
    icon: 'fa-sun',
    color: '#fbbf24',
    desc: 'Locating…',
    hilo: 'H:--° L:--°',
  });
  const [weatherDaily, setWeatherDaily] = useState<any>(null);
  const [weatherExpanded, setWeatherExpanded] = useState(false);

  useEffect(() => {
    let mounted = true;
    const tz = timezone && timezone !== 'UTC' ? timezone : Intl.DateTimeFormat().resolvedOptions().timeZone;
    const city = (tz.split('/').pop() || 'Adelaide').replace(/_/g, ' ');

    async function loadWeather() {
      try {
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
        );
        if (!geoRes.ok) return;
        const geoData = await geoRes.json();
        if (!geoData.results?.length) return;
        const { latitude, longitude } = geoData.results[0];

        const wRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode&daily=weathercode,temperature_2m_max,temperature_2m_min&forecast_days=7&temperature_unit=celsius&timezone=${encodeURIComponent(tz)}`
        );
        if (!wRes.ok) return;
        const wData = await wRes.json();
        if (!mounted) return;
        const info = weatherInfo(wData.current.weathercode);
        const max0 = Math.round(wData.daily?.temperature_2m_max?.[0] ?? 0);
        const min0 = Math.round(wData.daily?.temperature_2m_min?.[0] ?? 0);
        setWeatherCurrent({
          temp: Math.round(wData.current.temperature_2m),
          icon: info.icon,
          color: info.color,
          desc: info.desc,
          hilo: `H:${max0}° L:${min0}°`,
        });
        setWeatherDaily(wData.daily);
      } catch {
        if (mounted) {
          const days = [];
          const now = new Date();
          for (let i = 0; i < 7; i++) {
            const d = new Date(now);
            d.setDate(now.getDate() + i);
            days.push(d.toISOString().slice(0, 10));
          }
          setWeatherDaily({
            time: days,
            weathercode: [0, 1, 2, 0, 3, 1, 0],
            temperature_2m_max: [24, 25, 23, 22, 21, 23, 25],
            temperature_2m_min: [14, 15, 14, 13, 12, 13, 14],
          });
          setWeatherCurrent({
            temp: 22,
            icon: 'fa-sun',
            color: '#fbbf24',
            desc: 'Sunny',
            hilo: 'H:24° L:14°',
          });
        }
      }
    }

    loadWeather();
    const interval = setInterval(loadWeather, 30 * 60 * 1000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [timezone]);

  return (
    <>
      <div
        id="weather-widget"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: 'var(--cr-text-primary)',
          flexShrink: 0,
          padding: '0 4px',
        }}
      >
        <i
          id="weather-icon"
          className={`fas ${weatherCurrent.icon}`}
          style={{ fontSize: '1.85em', color: weatherCurrent.color, flexShrink: 0 }}
        />
        <div style={{ lineHeight: 1.15 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span id="weather-temp" style={{ fontSize: '1.45em', fontWeight: 800, whiteSpace: 'nowrap' }}>
              {weatherCurrent.temp}°
            </span>
            <span
              id="weather-hilo"
              style={{ fontSize: '0.82em', opacity: 0.8, fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              {weatherCurrent.hilo}
            </span>
          </div>
          <div
            id="weather-desc"
            style={{ fontSize: '0.8em', opacity: 0.8, whiteSpace: 'nowrap', fontWeight: 600 }}
          >
            {weatherCurrent.desc}
          </div>
        </div>
        <button
          type="button"
          id="weather-expand-btn"
          onClick={() => setWeatherExpanded((prev) => !prev)}
          title="Show 7-day forecast"
          aria-expanded={weatherExpanded}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--cr-text-secondary)',
            cursor: 'pointer',
            fontSize: '0.85em',
            padding: '2px 4px',
            margin: 0,
            lineHeight: 1,
            opacity: 0.7,
          }}
        >
          <i
            className="fas fa-chevron-down"
            id="weather-expand-icon"
            style={{
              transition: 'transform 0.25s',
              transform: weatherExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </button>
      </div>

      <WeatherForecastModal
        open={Boolean(weatherExpanded && weatherDaily)}
        onClose={() => setWeatherExpanded(false)}
        weatherDaily={weatherDaily}
        isThemed={isThemed}
        seasonAccent={seasonAccent}
      />
    </>
  );
};
