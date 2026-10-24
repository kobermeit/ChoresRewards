import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { BootstrapData, Person } from '../types';
import { apiGet, apiPost, resolveAssetUrl } from '../api';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { ProfileSwitcherModal } from '../components/ProfileSwitcherModal';
import { FamilyMemberModal } from '../components/FamilyMemberModal';
import { playSoundCategory, speakAnnouncement, SoundCategory } from '../services/soundService';
import { fireCelebrationFireworks } from '../services/celebrationService';
import { useHouseholdPrefs, useUiPref, useSoundTheme } from '../hooks/useSettings';

export interface ToastItem {
  id: string;
  message: string;
  type?: 'success' | 'error' | 'info' | 'badge';
  undoAction?: () => void;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

export type ActiveView =
  | 'dashboard'
  | 'chores'
  | 'rewards'
  | 'redeemed'
  | 'meals'
  | 'shopping'
  | 'library'
  | 'notes'
  | 'organise'
  | 'calendar'
  | 'settings'
  | 'activity_log'
  | 'chore_history'
  | 'help';

interface AppContextValue {
  data: BootstrapData | null;
  loading: boolean;
  isSyncing: boolean;
  lastFetchedAt: Date | null;
  refresh: (showOverlay?: boolean) => Promise<void>;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  muted: boolean;
  toggleMute: () => void;
  adultMode: boolean;
  setAdultMode: (val: boolean) => void;
  openAdultPinModal: (onSuccess?: () => void) => void;
  playSound: (categoryOrUrl?: SoundCategory | string) => void;
  speak: (text: string) => void;
  showToast: (message: string, options?: { type?: ToastItem['type']; undoAction?: () => void }) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  activeUser: Person | null;
  switchUser: (personId: number, pin?: string) => Promise<{ success: boolean; error?: string }>;
  isParent: boolean;
  isChild: boolean;
  isFamily: boolean;
  profileSwitcherOpen: boolean;
  setProfileSwitcherOpen: (open: boolean) => void;
  openEditMemberModal: (person?: Person | null) => void;
  activeView: ActiveView;
  setActiveView: (v: ActiveView) => void;
  scrollToSection: (sectionId: string) => void;
  selectedChorePersonId: number | null;
  setSelectedChorePersonId: (personId: number | null) => void;
  screensaverOpen: boolean;
  setScreensaverOpen: (open: boolean) => void;
  visualTimerOpen: boolean;
  setVisualTimerOpen: (open: boolean) => void;
  playWidgetOpen: boolean;
  setPlayWidgetOpen: (open: boolean) => void;
  playWidgetInitialGame: 'maths' | 'colours' | 'patterns' | 'memory';
  openPlayGame: (game: 'maths' | 'colours' | 'patterns' | 'memory') => void;
  formatRewardValue: (val: number) => string;
  timerTotalSeconds: number;
  timerRemainingSeconds: number;
  timerRunning: boolean;
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  setTimerPreset: (minutes: number) => void;
  setTimerDurationSeconds: (seconds: number) => void;
  editingChoreModalItem: Chore | null | undefined;
  openEditChoreModal: (chore?: Chore | null, initialPersonId?: number) => void;
  closeEditChoreModal: () => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export const SLUG_TO_SECTION: Record<string, string> = {
  dashboard: 'dashboard-section',
  chores: 'chores-section',
  rewards: 'rewards-section',
  redeemed: 'redeemed-section',
  meals: 'meal-planner-section',
  'meal-planner': 'meal-planner-section',
  shopping: 'shopping-list-section',
  'shopping-list': 'shopping-list-section',
  library: 'meal-library-section',
  'meal-library': 'meal-library-section',
  notes: 'notes-kanban-section',
  organise: 'organise-section',
};

export const SECTION_TO_SLUG: Record<string, string> = {
  'dashboard-section': 'dashboard',
  'chores-section': 'chores',
  'rewards-section': 'rewards',
  'redeemed-section': 'redeemed',
  'meal-planner-section': 'meals',
  'shopping-list-section': 'shopping',
  'meal-library-section': 'library',
  'notes-kanban-section': 'notes',
  'organise-section': 'organise',
};

function getInitialView(): ActiveView {
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  if (hash === 'calendar') return 'calendar';
  if (hash === 'chores') return 'chores';
  if (hash === 'rewards') return 'rewards';
  if (hash === 'redeemed') return 'redeemed';
  if (hash === 'meals' || hash === 'meal-planner') return 'meals';
  if (hash === 'shopping' || hash === 'shopping-list') return 'shopping';
  if (hash === 'library' || hash === 'meal-library') return 'library';
  if (hash === 'notes') return 'notes';
  if (hash === 'organise') return 'organise';
  if (hash === 'settings') return 'settings';
  if (hash === 'activity-log' || hash === 'activity_log') return 'activity_log';
  if (hash === 'chore-history' || hash === 'chore_history') return 'chore_history';
  if (hash === 'help') return 'help';
  return 'dashboard';
}

export const AppProvider: React.FC<{
  children: React.ReactNode;
  onRequestAdultPin: (cb?: () => void) => void;
}> = ({ children, onRequestAdultPin }) => {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme] = useState<'dark' | 'light'>('dark');
  const { muted, setMuted } = useHouseholdPrefs();
  const [, setActivePersonId] = useUiPref('activePersonId');
  const { effective: soundTheme } = useSoundTheme();
  const [adultMode, setAdultModeState] = useState<boolean>(() => {
    return sessionStorage.getItem('cr_adult_unlocked') === 'true';
  });
  const setAdultMode = useCallback((val: boolean) => {
    setAdultModeState(val);
    if (val) {
      sessionStorage.setItem('cr_adult_unlocked', 'true');
    } else {
      sessionStorage.removeItem('cr_adult_unlocked');
    }
  }, []);

  const [activeUser, setActiveUser] = useState<Person | null>(null);
  const [profileSwitcherOpen, setProfileSwitcherOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Person | null | undefined>(undefined);

  // In-app Confirm modal state
  const [confirmConfig, setConfirmConfig] = useState<(ConfirmOptions & { resolve: (val: boolean) => void }) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmConfig({
        ...options,
        resolve,
      });
    });
  }, []);

  const handleConfirmAction = useCallback(() => {
    if (confirmConfig) {
      confirmConfig.resolve(true);
      setConfirmConfig(null);
    }
  }, [confirmConfig]);

  const handleCancelAction = useCallback(() => {
    if (confirmConfig) {
      confirmConfig.resolve(false);
      setConfirmConfig(null);
    }
  }, [confirmConfig]);

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [activeView, setActiveViewState] = useState<ActiveView>(getInitialView);

  const setActiveView = useCallback((v: ActiveView) => {
    setActiveViewState(v);
    const slug =
      v === 'dashboard'
        ? ''
        : v === 'activity_log'
          ? 'activity-log'
          : v === 'chore_history'
            ? 'chore-history'
            : v;
    const hash = slug ? `#/${slug}` : '#/';
    if (window.location.hash !== hash) {
      window.history.pushState(null, '', hash);
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);
  const [selectedChorePersonId, setSelectedChorePersonId] = useState<number | null>(null);
  const [screensaverOpen, setScreensaverOpen] = useState(false);
  const [visualTimerOpen, setVisualTimerOpen] = useState(false);
  const [playWidgetOpen, setPlayWidgetOpen] = useState(false);
  const [playWidgetInitialGame, setPlayWidgetInitialGame] = useState<'maths' | 'colours' | 'patterns' | 'memory'>('maths');
  const soundsListRef = useRef<string[]>([]);

  // Global Visual Timer State (running persistently across views & modals)
  const [timerTotalSeconds, setTimerTotalSeconds] = useState(300);
  const [timerRemainingSeconds, setTimerRemainingSeconds] = useState(300);
  const [timerRunning, setTimerRunning] = useState(false);

  // Global Add/Edit Chore Modal State
  const [editingChoreModalItem, setEditingChoreModalItem] = useState<Chore | null | undefined>(undefined);

  const openEditChoreModal = useCallback((chore?: Chore | null, initialPersonId?: number) => {
    if (chore !== undefined && chore !== null) {
      setEditingChoreModalItem(chore);
    } else if (initialPersonId != null) {
      setEditingChoreModalItem({ assigned_to_id: initialPersonId } as Chore);
    } else {
      setEditingChoreModalItem(null);
    }
  }, []);

  useEffect(() => {
    (window as any).__openEditChoreModal = openEditChoreModal;
  }, [openEditChoreModal]);

  const closeEditChoreModal = useCallback(() => {
    setEditingChoreModalItem(undefined);
  }, []);

  const startTimer = useCallback(() => {
    // If starting from 00:00, default to 5 minutes (300s)
    setTimerRemainingSeconds((prev) => {
      if (prev <= 0) {
        setTimerTotalSeconds(300);
        return 300;
      }
      return prev;
    });
    setTimerRunning(true);
  }, []);

  const pauseTimer = useCallback(() => {
    setTimerRunning(false);
  }, []);

  const resetTimer = useCallback(() => {
    // If currently running, reset to beginning of total duration and keep running
    // If not running / stopped, reset timer to 00:00
    if (timerRunning) {
      setTimerRemainingSeconds(timerTotalSeconds);
    } else {
      setTimerRemainingSeconds(0);
      setTimerTotalSeconds(0);
    }
  }, [timerRunning, timerTotalSeconds]);

  const setTimerPreset = useCallback((minutes: number) => {
    const s = Math.max(10, Math.round(minutes * 60));
    setTimerTotalSeconds(s);
    setTimerRemainingSeconds(s);
  }, []);

  const setTimerDurationSeconds = useCallback((seconds: number) => {
    const s = Math.max(10, Math.round(seconds));
    setTimerTotalSeconds(s);
    setTimerRemainingSeconds(s);
  }, []);

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const lastFetchedAtRef = useRef<Date | null>(null);
  const lastActiveTimestampRef = useRef<number>(Date.now());
  const activeDateRef = useRef<string>(new Date().toISOString().slice(0, 10));

  const refresh = useCallback(async (showOverlay = false) => {
    let syncTimer: any = null;
    if (showOverlay) {
      setIsSyncing(true);
      // Hard cap: Never block the screen for more than 2 seconds
      syncTimer = setTimeout(() => setIsSyncing(false), 2000);
    }
    try {
      const res = await apiGet<BootstrapData>('bootstrap');
      if (res && res.success) {
        setData(res);
        const fetchDate = new Date();
        setLastFetchedAt(fetchDate);
        lastFetchedAtRef.current = fetchDate;
        if (res.auth?.active_user) {
          setActiveUser(res.auth.active_user);
          if (res.auth.active_user.role === 'parent') {
            setAdultMode(true);
          }
        } else if (res.auth?.adult_mode) {
          setAdultMode(true);
        }
        activeDateRef.current = new Date().toISOString().slice(0, 10);
      }
    } catch (err) {
      console.error('Failed to load bootstrap data:', err);
    } finally {
      setLoading(false);
      if (showOverlay) {
        if (syncTimer) clearTimeout(syncTimer);
        setTimeout(() => setIsSyncing(false), 250);
      }
    }
  }, [setAdultMode]);

  // Session keepalive heartbeat every 4 minutes for kiosk/tablet persistence
  useEffect(() => {
    const heartbeat = setInterval(() => {
      apiGet('keep_alive').catch(() => {});
    }, 4 * 60 * 1000);
    return () => clearInterval(heartbeat);
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

    // Multi-device poll every 20 seconds when visible
    const interval = setInterval(() => {
      if (!document.hidden) {
        refresh();
      }
    }, 20 * 1000);

    // Midnight rollover & stale-focus watcher (like Slack / Discord)
    const checkMidnightAndStaleness = () => {
      const now = Date.now();
      const currentDateStr = new Date().toISOString().slice(0, 10);
      const isDateRollover = currentDateStr !== activeDateRef.current;
      const isStale = now - lastActiveTimestampRef.current > 15 * 60 * 1000; // 15+ minutes idle

      lastActiveTimestampRef.current = now;

      if (!document.hidden) {
        if (isDateRollover || isStale) {
          // Trigger smooth full-sync overlay
          refresh(true);
        } else {
          refresh(false);
        }
      }
    };

    // Hardware sleep/wake watchdog: checks wall-clock delta to detect OS sleep instantly (0ms upon wake)
    let lastTick = Date.now();
    const watchdogInterval = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTick;
      lastTick = now;

      // If more than 5 seconds elapsed during a 1-second interval, device/tab was suspended/sleeping
      if (delta > 5000) {
        console.log(`[ChoresRewards] Device wake detected (suspended for ~${Math.round(delta / 1000)}s). Refreshing...`);
        const currentDateStr = new Date().toISOString().slice(0, 10);
        const isDateRollover = currentDateStr !== activeDateRef.current;
        const isVeryStale = delta > 60 * 60 * 1000; // 1hr+ suspended
        refresh(isDateRollover || isVeryStale);
        showToast('✨ Family Hub refreshed');
      }
    }, 1000);

    // Wake touch handler: user touches the screen after being idle
    const handleUserWakeTouch = () => {
      const now = Date.now();
      if (lastFetchedAtRef.current && now - lastFetchedAtRef.current.getTime() > 5 * 60 * 1000) {
        refresh(false);
      }
    };

    // Check on visibility change, page show, and focus
    document.addEventListener('visibilitychange', checkMidnightAndStaleness);
    window.addEventListener('focus', checkMidnightAndStaleness);
    window.addEventListener('pageshow', checkMidnightAndStaleness);
    window.addEventListener('pointerdown', handleUserWakeTouch, { passive: true });

    // 1-minute ticker to auto-detect midnight even if left untouched on screen
    const midnightInterval = setInterval(() => {
      const currentDateStr = new Date().toISOString().slice(0, 10);
      if (currentDateStr !== activeDateRef.current) {
        refresh(true);
      }
    }, 60 * 1000);

    return () => {
      clearInterval(interval);
      clearInterval(watchdogInterval);
      clearInterval(midnightInterval);
      document.removeEventListener('visibilitychange', checkMidnightAndStaleness);
      window.removeEventListener('focus', checkMidnightAndStaleness);
      window.removeEventListener('pageshow', checkMidnightAndStaleness);
      window.removeEventListener('pointerdown', handleUserWakeTouch);
    };
  }, [refresh]);

  // Sync activeUser & adultMode strictly from server session (data.auth)
  useEffect(() => {
    if (data?.auth?.active_user) {
      setActiveUser(data.auth.active_user);
    } else if (!activeUser && data?.family && data.family.length > 0) {
      const defaultUser = data.family.find((p) => p.role === 'family') || data.family[0];
      setActiveUser(defaultUser);
    }
    if (data?.auth) {
      setAdultModeState(Boolean(data.auth.adult_mode));
    }
  }, [data]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  // Strict server authority: isParent requires server adult_mode (or an open system without PINs)
  const isParent = Boolean(
    data?.auth?.adult_mode ||
    (!data?.master_pin_set && !data?.family?.some((p) => p.has_pin) && (activeUser?.role === 'parent' || activeUser?.is_admin))
  );
  const isChild = activeUser?.role === 'child';
  const isFamily = activeUser?.role === 'family' || (!isParent && !isChild);

  useEffect(() => {
    document.documentElement.classList.toggle('adult-mode', isParent);
    document.documentElement.classList.toggle('child-mode', isChild);
    document.body.classList.toggle('adult-mode', isParent);
    document.body.classList.toggle('child-mode', isChild);
    document.body.classList.toggle('adult-unlocked', isParent);
  }, [isParent, isChild]);

  const switchUser = useCallback(
    async (personId: number, pin?: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await apiPost<{ success: boolean; active_user: Person; error?: string }>('switch_user', {
          person_id: personId,
          pin,
        });
        if (res && res.success && res.active_user) {
          setActivePersonId(res.active_user.id);
          setActiveUser(res.active_user);
          if (res.active_user.role === 'parent') {
            setAdultMode(true);
          } else {
            setAdultMode(false);
          }
          await refresh();
          return { success: true };
        }
        return { success: false, error: res?.error || 'Failed to switch user' };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to switch user' };
      }
    },
    [refresh, setAdultMode]
  );

  const openEditMemberModal = useCallback((person?: Person | null) => {
    setEditingMember(person === undefined ? null : person);
  }, []);

  const closeEditMemberModal = useCallback(() => {
    setEditingMember(undefined);
  }, []);

  const toggleTheme = useCallback(() => {
    // Theme switching disabled; dark mode forced as default
  }, []);

  const toggleMute = useCallback(() => {
    setMuted(!muted);
  }, [muted, setMuted]);

  const playSound = useCallback(
    (categoryOrUrl?: SoundCategory | string) => {
      if (muted) return;
      if (categoryOrUrl && (categoryOrUrl.startsWith('/') || categoryOrUrl.startsWith('http') || categoryOrUrl.includes('.'))) {
        playSoundCategory('chore_done', { customUrl: categoryOrUrl, theme: soundTheme });
      } else {
        playSoundCategory((categoryOrUrl as SoundCategory) || 'chore_done', { theme: soundTheme });
      }
    },
    [muted, soundTheme]
  );

  const speak = useCallback(
    (text: string) => {
      if (muted) return;
      speakAnnouncement(text);
    },
    [muted]
  );

  const showToast = useCallback(
    (message: string, options?: { type?: ToastItem['type']; undoAction?: () => void }) => {
      const id = `${Date.now()}_${Math.random()}`;
      const item: ToastItem = {
        id,
        message,
        type: options?.type || 'info',
        undoAction: options?.undoAction,
      };
      setToasts((prev) => [...prev, item]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3500);
    },
    []
  );

  // Persistent Timer Countdown Interval
  useEffect(() => {
    if (!timerRunning) return;
    const timerInterval = setInterval(() => {
      setTimerRemainingSeconds((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          playSound();
          try {
            fireCelebrationFireworks();
          } catch {}
          showToast('⏰ Visual Timer Finished!', { type: 'success' });
          // Automatically reset to original total seconds so it doesn't stay stuck at 0:00
          return timerTotalSeconds;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerInterval);
  }, [timerRunning, timerTotalSeconds, playSound, showToast]);

  const scrollToSection = useCallback((sectionId: string) => {
    const slug = SECTION_TO_SLUG[sectionId] || sectionId;
    if (slug === 'dashboard') {
      setActiveView('dashboard');
    } else if (slug === 'chores') {
      setActiveView('chores');
    } else if (slug === 'rewards') {
      setActiveView('rewards');
    } else if (slug === 'redeemed') {
      setActiveView('redeemed');
    } else if (slug === 'meals' || slug === 'meal-planner') {
      setActiveView('meals');
    } else if (slug === 'shopping' || slug === 'shopping-list') {
      setActiveView('shopping');
    } else if (slug === 'library' || slug === 'meal-library') {
      setActiveView('library');
    } else if (slug === 'notes') {
      setActiveView('notes');
    } else if (slug === 'organise') {
      setActiveView('organise');
    } else {
      setActiveView('dashboard');
    }
  }, [setActiveView]);

  // Listen to browser Back/Forward (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const rawHash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
      if (rawHash === 'calendar') setActiveViewState('calendar');
      else if (rawHash === 'chores') setActiveViewState('chores');
      else if (rawHash === 'rewards') setActiveViewState('rewards');
      else if (rawHash === 'redeemed') setActiveViewState('redeemed');
      else if (rawHash === 'meals' || rawHash === 'meal-planner') setActiveViewState('meals');
      else if (rawHash === 'shopping' || rawHash === 'shopping-list') setActiveViewState('shopping');
      else if (rawHash === 'library' || rawHash === 'meal-library') setActiveViewState('library');
      else if (rawHash === 'notes') setActiveViewState('notes');
      else if (rawHash === 'organise') setActiveViewState('organise');
      else if (rawHash === 'settings') setActiveViewState('settings');
      else if (rawHash === 'help') setActiveViewState('help');
      else if (rawHash === 'activity-log' || rawHash === 'activity_log') setActiveViewState('activity_log');
      else if (rawHash === 'chore-history' || rawHash === 'chore_history') setActiveViewState('chore_history');
      else setActiveViewState('dashboard');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Initial deep link scroll on boot
  useEffect(() => {
    if (loading) return;
    const rawHash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
    if (!rawHash) return;
    const sectionId = SLUG_TO_SECTION[rawHash];
    if (sectionId) {
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) {
          const header = document.querySelector('.dashboard-header-sticky');
          const headerHeight = header ? header.getBoundingClientRect().height : 70;
          const targetY = el.getBoundingClientRect().top + window.scrollY - headerHeight - 16;
          window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
        }
      }, 250);
    }
  }, [loading]);

  const openPlayGame = useCallback((game: 'maths' | 'colours' | 'patterns' | 'memory') => {
    setPlayWidgetInitialGame(game);
    setPlayWidgetOpen(true);
  }, []);

  const formatRewardValue = useCallback(
    (val: number): string => {
      const system = data?.reward_system || 'points';
      if (system === 'cash') {
        return `$${val.toFixed(2)}`;
      }
      return `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)} pts`;
    },
    [data?.reward_system]
  );

  return (
    <AppContext.Provider
      value={{
        data,
        loading,
        isSyncing,
        lastFetchedAt,
        refresh,
        theme,
        toggleTheme,
        muted,
        toggleMute,
        adultMode,
        setAdultMode,
        openAdultPinModal: onRequestAdultPin,
        playSound,
        speak,
        showToast,
        confirm,
        activeUser,
        switchUser,
        isParent,
        isChild,
        isFamily,
        profileSwitcherOpen,
        setProfileSwitcherOpen,
        openEditMemberModal,
        activeView,
        setActiveView,
        scrollToSection,
        selectedChorePersonId,
        setSelectedChorePersonId,
        screensaverOpen,
        setScreensaverOpen,
        visualTimerOpen,
        setVisualTimerOpen,
        playWidgetOpen,
        setPlayWidgetOpen,
        playWidgetInitialGame,
        openPlayGame,
        formatRewardValue,
        timerTotalSeconds,
        timerRemainingSeconds,
        timerRunning,
        startTimer,
        pauseTimer,
        resetTimer,
        setTimerPreset,
        setTimerDurationSeconds,
        editingChoreModalItem,
        openEditChoreModal,
        closeEditChoreModal,
      }}
    >
      {children}

      {/* Global In-App Confirm Modal */}
      {confirmConfig && (
        <ConfirmModal
          isOpen={Boolean(confirmConfig)}
          title={confirmConfig.title}
          message={confirmConfig.message}
          confirmText={confirmConfig.confirmText}
          cancelText={confirmConfig.cancelText}
          danger={confirmConfig.danger}
          onConfirm={handleConfirmAction}
          onCancel={handleCancelAction}
        />
      )}

      {/* Profile Switcher Modal */}
      <ProfileSwitcherModal
        isOpen={profileSwitcherOpen}
        onClose={() => setProfileSwitcherOpen(false)}
      />

      {/* Edit Family Member Modal */}
      <FamilyMemberModal
        isOpen={editingMember !== undefined}
        member={editingMember || null}
        onClose={closeEditMemberModal}
      />

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
