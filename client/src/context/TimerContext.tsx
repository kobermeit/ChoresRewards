import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { playSoundCategory, speakAnnouncement } from '../services/soundService';
import { fireChoreConfetti } from '../services/celebrationService';
import { useAppDispatch, useAppSelector } from '../store';
import { setActiveTimers as setReduxTimers } from '../store/uiSlice';
import { useSoundTheme } from '../hooks/useSettings';

export interface ActiveChoreTimer {
  choreId: number;
  choreTitle: string;
  assignedName?: string;
  assignedAvatar?: string;
  totalSeconds: number;
  remainingSeconds: number;
  startTime: number;
  endTime: number;
  isRunning: boolean;
  pausedRemaining?: number;
}

interface TimerContextValue {
  activeTimers: Record<number, ActiveChoreTimer>;
  startChoreTimer: (chore: { id: number; title: string; assigned_to?: string; duration_seconds?: number | null }) => void;
  pauseChoreTimer: (choreId: number) => void;
  resumeChoreTimer: (choreId: number) => void;
  resetChoreTimer: (choreId: number) => void;
  stopChoreTimer: (choreId: number) => void;
  getChoreTimer: (choreId: number) => ActiveChoreTimer | undefined;
  activeTimerList: ActiveChoreTimer[];
}

const TimerContext = createContext<TimerContextValue | undefined>(undefined);

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useAppDispatch();
  const persistedTimers = useAppSelector((s) => s.ui.activeTimers);
  const { effective: soundTheme } = useSoundTheme();

  const [activeTimers, setActiveTimers] = useState<Record<number, ActiveChoreTimer>>(() => {
    try {
      const now = Date.now();
      const restored: Record<number, ActiveChoreTimer> = {};

      Object.entries(persistedTimers || {}).forEach(([key, timer]: [string, any]) => {
        const choreId = Number(key);
        if (!timer.isRunning) {
          restored[choreId] = timer;
        } else {
          const remaining = Math.max(0, Math.round((timer.endTime - now) / 1000));
          if (remaining > 0) {
            restored[choreId] = {
              ...timer,
              remainingSeconds: remaining,
            };
          }
        }
      });
      return restored;
    } catch {
      return {};
    }
  });

  // Track announcements made to avoid repeated voice prompts
  const announcedMilestonesRef = useRef<Record<number, { half?: boolean; oneMin?: boolean }>>({});

  // Sync to Redux store (persisted via redux-persist) whenever timers change
  useEffect(() => {
    dispatch(setReduxTimers(activeTimers));
  }, [activeTimers, dispatch]);

  // High-precision countdown interval using real clock time (no drift on tab backgrounding)
  useEffect(() => {
    const runningEntries = Object.values(activeTimers).filter((t) => t.isRunning);
    if (runningEntries.length === 0) return;

    const interval = setInterval(() => {
      const now = Date.now();

      setActiveTimers((prev) => {
        let changed = false;
        const next = { ...prev };

        Object.entries(prev).forEach(([key, timer]) => {
          if (!timer.isRunning) return;
          const choreId = Number(key);
          const remaining = Math.max(0, Math.round((timer.endTime - now) / 1000));

          if (remaining !== timer.remainingSeconds) {
            changed = true;

            // Milestones & TTS announcements
            const milestones = announcedMilestonesRef.current[choreId] || {};
            const total = timer.totalSeconds;

            // 50% milestone
            if (total >= 60 && remaining <= Math.round(total / 2) && !milestones.half) {
              milestones.half = true;
              announcedMilestonesRef.current[choreId] = milestones;
              playSoundCategory('timer_alert');
              speakAnnouncement(`${timer.choreTitle}: halfway there! Keep going!`);
            }

            // 1-minute milestone
            if (total > 90 && remaining <= 60 && remaining > 55 && !milestones.oneMin) {
              milestones.oneMin = true;
              announcedMilestonesRef.current[choreId] = milestones;
              playSoundCategory('timer_alert', { theme: soundTheme });
              speakAnnouncement(`One minute remaining for ${timer.choreTitle}!`);
            }

            // Timer Done
            if (remaining === 0) {
              playSoundCategory('timer_done', { theme: soundTheme });
              speakAnnouncement(`Time is up for ${timer.choreTitle}! Great job!`);
              try {
                fireChoreConfetti();
              } catch {}
              // Automatically reset to totalSeconds so the timer isn't stuck at 0:00
              next[choreId] = {
                ...timer,
                remainingSeconds: timer.totalSeconds,
                isRunning: false,
              };
            } else {
              next[choreId] = {
                ...timer,
                remainingSeconds: remaining,
              };
            }
          }
        });

        return changed ? next : prev;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [activeTimers]);

  const startChoreTimer = useCallback((chore: { id: number; title: string; assigned_to?: string; duration_seconds?: number | null }) => {
    const total = chore.duration_seconds && chore.duration_seconds >= 10 ? chore.duration_seconds : 120;
    const now = Date.now();
    const endTime = now + total * 1000;

    announcedMilestonesRef.current[chore.id] = {};
    playSoundCategory('ding');

    setActiveTimers((prev) => ({
      ...prev,
      [chore.id]: {
        choreId: chore.id,
        choreTitle: chore.title,
        assignedName: chore.assigned_to,
        totalSeconds: total,
        remainingSeconds: total,
        startTime: now,
        endTime,
        isRunning: true,
      },
    }));
  }, []);

  const pauseChoreTimer = useCallback((choreId: number) => {
    setActiveTimers((prev) => {
      const existing = prev[choreId];
      if (!existing || !existing.isRunning) return prev;
      return {
        ...prev,
        [choreId]: {
          ...existing,
          isRunning: false,
          pausedRemaining: existing.remainingSeconds,
        },
      };
    });
  }, []);

  const resumeChoreTimer = useCallback((choreId: number) => {
    setActiveTimers((prev) => {
      const existing = prev[choreId];
      if (!existing || existing.isRunning) return prev;
      let remaining = existing.pausedRemaining || existing.remainingSeconds || existing.totalSeconds;
      // Guard against resuming an expired timer: if remaining <= 0, reset to full duration
      if (remaining <= 0) {
        remaining = existing.totalSeconds;
      }
      const now = Date.now();
      return {
        ...prev,
        [choreId]: {
          ...existing,
          isRunning: true,
          endTime: now + remaining * 1000,
          remainingSeconds: remaining,
          pausedRemaining: undefined,
        },
      };
    });
  }, []);

  const resetChoreTimer = useCallback((choreId: number) => {
    setActiveTimers((prev) => {
      const existing = prev[choreId];
      if (!existing) return prev;
      announcedMilestonesRef.current[choreId] = {};
      return {
        ...prev,
        [choreId]: {
          ...existing,
          isRunning: false,
          remainingSeconds: existing.totalSeconds,
          pausedRemaining: undefined,
        },
      };
    });
  }, []);

  const stopChoreTimer = useCallback((choreId: number) => {
    setActiveTimers((prev) => {
      const next = { ...prev };
      delete next[choreId];
      delete announcedMilestonesRef.current[choreId];
      return next;
    });
  }, []);

  const getChoreTimer = useCallback((choreId: number) => {
    return activeTimers[choreId];
  }, [activeTimers]);

  const activeTimerList = Object.values(activeTimers);

  return (
    <TimerContext.Provider
      value={{
        activeTimers,
        startChoreTimer,
        pauseChoreTimer,
        resumeChoreTimer,
        resetChoreTimer,
        stopChoreTimer,
        getChoreTimer,
        activeTimerList,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
};

export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimer must be used within TimerProvider');
  return ctx;
}
