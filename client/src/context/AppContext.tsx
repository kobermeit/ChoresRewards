import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { BootstrapData } from '../types';
import { apiGet, resolveAssetUrl } from '../api';

export interface ToastItem {
  id: string;
  message: string;
  type?: 'success' | 'error' | 'info' | 'badge';
  undoAction?: () => void;
}

export type ActiveView =
  | 'dashboard'
  | 'settings'
  | 'activity_log'
  | 'chore_history';

interface AppContextValue {
  data: BootstrapData | null;
  loading: boolean;
  refresh: () => Promise<void>;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  muted: boolean;
  toggleMute: () => void;
  adultMode: boolean;
  setAdultMode: (val: boolean) => void;
  openAdultPinModal: (onSuccess?: () => void) => void;
  playSound: (customUrl?: string) => void;
  showToast: (message: string, options?: { type?: ToastItem['type']; undoAction?: () => void }) => void;
  activeView: ActiveView;
  setActiveView: (v: ActiveView) => void;
  scrollToSection: (sectionId: string) => void;
  screensaverOpen: boolean;
  setScreensaverOpen: (open: boolean) => void;
  visualTimerOpen: boolean;
  setVisualTimerOpen: (open: boolean) => void;
  playWidgetOpen: boolean;
  setPlayWidgetOpen: (open: boolean) => void;
  playWidgetInitialGame: 'maths' | 'colours' | 'patterns' | 'memory';
  openPlayGame: (game: 'maths' | 'colours' | 'patterns' | 'memory') => void;
  formatRewardValue: (val: number) => string;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export const AppProvider: React.FC<{
  children: React.ReactNode;
  onRequestAdultPin: (cb?: () => void) => void;
}> = ({ children, onRequestAdultPin }) => {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('cr-theme') as 'dark' | 'light') || 'dark';
  });
  const [muted, setMuted] = useState<boolean>(() => {
    return localStorage.getItem('globalMute') === 'true';
  });
  const [adultMode, setAdultMode] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [screensaverOpen, setScreensaverOpen] = useState(false);
  const [visualTimerOpen, setVisualTimerOpen] = useState(false);
  const [playWidgetOpen, setPlayWidgetOpen] = useState(false);
  const [playWidgetInitialGame, setPlayWidgetInitialGame] = useState<'maths' | 'colours' | 'patterns' | 'memory'>('maths');
  const soundsListRef = useRef<string[]>([]);

  const refresh = useCallback(async () => {
    try {
      const res = await apiGet<BootstrapData>('bootstrap');
      if (res && res.success) {
        setData(res);
        setAdultMode(Boolean(res.auth?.adult_mode));
      }
    } catch (err) {
      console.error('Failed to load bootstrap data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    apiGet<{ success: boolean; sounds: Array<{ url: string }> }>('sounds')
      .then((res) => {
        if (res?.sounds?.length) {
          soundsListRef.current = res.sounds.map((s) => s.url);
        }
      })
      .catch(() => {});
  }, [refresh]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cr-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle('adult-mode', adultMode);
    document.documentElement.classList.toggle('child-mode', !adultMode);
  }, [adultMode]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      localStorage.setItem('globalMute', String(next));
      return next;
    });
  }, []);

  const playSound = useCallback(
    (customUrl?: string) => {
      if (muted) return;
      try {
        let target = customUrl;
        if (!target) {
          const list = soundsListRef.current;
          if (list.length > 0) {
            target = list[Math.floor(Math.random() * list.length)];
          } else {
            target = '/static/sounds/ta-da_yrvBrlS.mp3';
          }
        }
        const audio = new Audio(resolveAssetUrl(target));
        audio.volume = 0.7;
        audio.play().catch(() => {});
      } catch {
        // ignore audio error
      }
    },
    [muted]
  );

  const showToast = useCallback(
    (message: string, options?: { type?: ToastItem['type']; undoAction?: () => void }) => {
      const id = `${Date.now()}_${Math.random()}`;
      setToasts((prev) => [...prev, { id, message, type: options?.type || 'success', undoAction: options?.undoAction }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    },
    []
  );

  const scrollToSection = useCallback(
    (sectionId: string) => {
      if (activeView !== 'dashboard') {
        setActiveView('dashboard');
        setTimeout(() => {
          const el = document.getElementById(sectionId);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      } else {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [activeView]
  );

  const openPlayGame = useCallback((game: 'maths' | 'colours' | 'patterns' | 'memory') => {
    setPlayWidgetInitialGame(game);
    setPlayWidgetOpen(true);
  }, []);

  const formatRewardValue = useCallback(
    (val: number) => {
      const num = Number(val || 0);
      const formatted = Number.isInteger(num) ? String(num) : num.toFixed(2).replace(/\.?0+$/, '');
      if (data?.reward_system === 'cash') {
        return `$${Number(val || 0).toFixed(2)}`;
      }
      return `${formatted} pts`;
    },
    [data?.reward_system]
  );

  return (
    <AppContext.Provider
      value={{
        data,
        loading,
        refresh,
        theme,
        toggleTheme,
        muted,
        toggleMute,
        adultMode,
        setAdultMode,
        openAdultPinModal: onRequestAdultPin,
        playSound,
        showToast,
        activeView,
        setActiveView,
        scrollToSection,
        screensaverOpen,
        setScreensaverOpen,
        visualTimerOpen,
        setVisualTimerOpen,
        playWidgetOpen,
        setPlayWidgetOpen,
        playWidgetInitialGame,
        openPlayGame,
        formatRewardValue,
      }}
    >
      {children}
      {/* Global Toast Container */}
      <div
        id="toast-container"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxWidth: 380,
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              background:
                t.type === 'error'
                  ? 'linear-gradient(135deg, #ef4444, #b91c1c)'
                  : t.type === 'badge'
                    ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                    : 'linear-gradient(135deg, #1e293b, #0f172a)',
              color: '#fff',
              padding: '12px 18px',
              borderRadius: 12,
              boxShadow: '0 10px 25px rgba(0,0,0,0.35)',
              border: '1px solid rgba(255,255,255,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 14,
              fontSize: '0.95rem',
              fontWeight: 600,
            }}
          >
            <span>{t.message}</span>
            {t.undoAction && (
              <button
                type="button"
                onClick={() => {
                  t.undoAction?.();
                  setToasts((prev) => prev.filter((item) => item.id !== t.id));
                }}
                style={{
                  background: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '5px 12px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                }}
              >
                Undo
              </button>
            )}
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
