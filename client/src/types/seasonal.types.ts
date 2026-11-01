export interface SeasonalScenePrefs {
  seasonalScene: boolean;
  snowDensity: number; // 0.5 to 2
  seasonalCalmMode: boolean;
}

export interface EventCountdownTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isToday: boolean;
  isPast: boolean;
  targetDate: string;
}
