export function weatherInfo(code: number): { icon: string; color: string; desc: string } {
  if (code === 0) return { icon: 'fa-sun', color: '#fbbf24', desc: 'Clear Sky' };
  if (code <= 2) return { icon: 'fa-cloud-sun', color: '#fbbf24', desc: 'Partly Cloudy' };
  if (code === 3) return { icon: 'fa-cloud', color: '#94a3b8', desc: 'Overcast' };
  if (code <= 48) return { icon: 'fa-smog', color: '#94a3b8', desc: 'Foggy' };
  if (code <= 55) return { icon: 'fa-cloud-rain', color: '#93c5fd', desc: 'Drizzle' };
  if (code <= 67) return { icon: 'fa-cloud-rain', color: '#60a5fa', desc: 'Rain' };
  if (code <= 77) return { icon: 'fa-snowflake', color: '#bae6fd', desc: 'Snow' };
  if (code <= 82) return { icon: 'fa-cloud-showers-heavy', color: '#3b82f6', desc: 'Showers' };
  if (code <= 86) return { icon: 'fa-snowflake', color: '#bae6fd', desc: 'Snow Showers' };
  if (code <= 99) return { icon: 'fa-bolt', color: '#fbbf24', desc: 'Thunderstorm' };
  return { icon: 'fa-cloud', color: '#94a3b8', desc: 'Unknown' };
}
