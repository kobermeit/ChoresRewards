import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { apiGet, resolveAssetUrl, resolveAvatarUrl } from '../api';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { Modal } from './common/Modal';
import { ChoreModal } from './ChoreModal';
import { DurationStepper, TimerRing } from './ui';

export const Overlays: React.FC = () => {
  return (
    <>
      <SyncSplashOverlay />
      <ScreensaverOverlay />
      <VisualTimerModal />
      <KidsPlayWidgetModal />
      <ChoreModal />
    </>
  );
};

const SyncSplashOverlay: React.FC = () => {
  const { isSyncing } = useApp();
  if (!isSyncing) return null;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(15, 23, 42, 0.94)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div style={{ fontSize: '3rem' }}>🏠</div>
      <div style={{ fontWeight: 700, fontSize: '1.2rem', color: '#f8fafc' }}>
        Refreshing Family Hub...
      </div>
      <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
        Checking chores & household updates
      </div>
    </div>
  );
};

// ============================================================================
// 1. SCREENSAVER OVERLAY
// ============================================================================
const ScreensaverOverlay: React.FC = () => {
  const { screensaverOpen, setScreensaverOpen, data } = useApp();
  useBodyScrollLock(screensaverOpen);
  const [config, setConfig] = useState<any>(null);
  const [summary, setSummary] = useState<any[]>([]);
  const [slideIdx, setSlideIdx] = useState(0);
  const [now, setNow] = useState(new Date());

  // Fetch config and set up idle listener
  useEffect(() => {
    let mounted = true;
    apiGet<any>('screensaver/config')
      .then((res) => {
        if (mounted && res?.success) setConfig(res);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [screensaverOpen]);

  // Idle timer
  useEffect(() => {
    if (!config?.enabled) return;
    const idleMs = Math.max(1, Number(config.idle_minutes || 5)) * 60 * 1000;
    let timer: any;

    const resetIdle = () => {
      clearTimeout(timer);
      if (!screensaverOpen) {
        timer = setTimeout(() => {
          setScreensaverOpen(true);
        }, idleMs);
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, resetIdle, { passive: true }));
    resetIdle();

    return () => {
      clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, resetIdle));
    };
  }, [config?.enabled, config?.idle_minutes, screensaverOpen, setScreensaverOpen]);

  // Clock & slideshow ticker while open
  useEffect(() => {
    if (!screensaverOpen) return;

    apiGet<{ success: boolean; people: any[] }>('screensaver/chore_summary')
      .then((res) => {
        if (res?.people) setSummary(res.people);
      })
      .catch(() => {});

    const clockInterval = setInterval(() => setNow(new Date()), 1000);
    const slideSec = Math.max(5, Number(config?.slide_seconds || 15));
    const slideInterval = setInterval(() => {
      setSlideIdx((prev) => prev + 1);
    }, slideSec * 1000);

    return () => {
      clearInterval(clockInterval);
      clearInterval(slideInterval);
    };
  }, [screensaverOpen, config?.slide_seconds]);

  if (!screensaverOpen) return null;

  const mediaFiles: Array<{ url: string; type: string }> = config?.media || [];
  const currentMedia = mediaFiles.length > 0 ? mediaFiles[slideIdx % mediaFiles.length] : null;
  const peopleList = summary.length > 0 ? summary : data?.family || [];

  const handleDismissScreensaver = () => {
    setScreensaverOpen(false);
    // Refresh family hub data freshness upon waking from screensaver
    refresh(false);
  };

  return (
    <div
      id="screensaver-overlay"
      onClick={handleDismissScreensaver}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: '#090d16',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '52px 64px',
        cursor: 'pointer',
        userSelect: 'none',
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Background ambient media or default ambient gradient */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        {currentMedia ? (
          currentMedia.type === 'video' ? (
            <video
              src={resolveAssetUrl(currentMedia.url)}
              autoPlay
              muted
              loop
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <img
              src={resolveAssetUrl(currentMedia.url)}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              background: 'radial-gradient(ellipse at 80% 20%, #1e3a5f 0%, #0f172a 45%, #020617 100%)',
            }}
          />
        )}
        {/* Cinematic Chromecast Vignette Gradient */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to top, rgba(2, 6, 23, 0.88) 0%, rgba(2, 6, 23, 0.4) 40%, rgba(2, 6, 23, 0.2) 70%, rgba(2, 6, 23, 0.6) 100%)',
          }}
        />
      </div>

      {/* Top Bar: Family Hub status & ambient hint */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.2rem' }}>🏡</span>
          <span style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '0.04em', color: 'rgba(255, 255, 255, 0.85)' }}>
            Family Hub Ambient
          </span>
        </div>
        <div
          style={{
            fontSize: '0.82rem',
            color: 'rgba(255, 255, 255, 0.6)',
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(10px)',
            padding: '6px 14px',
            borderRadius: 999,
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          Tap anywhere to wake
        </div>
      </div>

      {/* Bottom Area: Google TV / Chromecast style layout */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: 24,
        }}
      >
        {/* Bottom Left: Huge Ambient Clock & Clean Date */}
        <div>
          <div
            style={{
              fontSize: '6.5rem',
              fontWeight: 300,
              lineHeight: 0.95,
              letterSpacing: '-3px',
              textShadow: '0 4px 24px rgba(0,0,0,0.5)',
            }}
          >
            {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div
            style={{
              fontSize: '1.45rem',
              color: 'rgba(255, 255, 255, 0.9)',
              marginTop: 14,
              fontWeight: 500,
              letterSpacing: '0.02em',
              textShadow: '0 2px 10px rgba(0,0,0,0.5)',
            }}
          >
            {now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {/* Bottom Right: Family Chore Progress Pills */}
        {config?.show_chores !== false && (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            {peopleList.map((p: any, idx: number) => {
              const total = p.total ?? data?.family_progress?.[p.name]?.total ?? 0;
              const completed = p.completed ?? data?.family_progress?.[p.name]?.completed ?? 0;
              const allDone = total > 0 && completed >= total;
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 18px',
                    borderRadius: 999,
                    background: 'rgba(15, 23, 42, 0.72)',
                    backdropFilter: 'blur(16px)',
                    border: allDone ? '1.5px solid #22c55e' : '1px solid rgba(255, 255, 255, 0.16)',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
                  }}
                >
                  <img
                    src={resolveAvatarUrl(p.avatar)}
                    alt={p.name}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = resolveAvatarUrl(null);
                    }}
                    style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.98rem', color: '#f8fafc' }}>{p.name}</div>
                    <div style={{ fontSize: '0.8rem', color: allDone ? '#4ade80' : '#94a3b8', fontWeight: 600 }}>
                      {allDone ? '🎉 All Done!' : `${completed}/${total} chores`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 2. VISUAL TIMER MODAL (CONNECTED TO GLOBAL TIMER STATE)
// ============================================================================
const VisualTimerModal: React.FC = () => {
  const {
    visualTimerOpen,
    setVisualTimerOpen,
    timerTotalSeconds,
    timerRemainingSeconds,
    timerRunning,
    startTimer,
    pauseTimer,
    resetTimer,
    setTimerDurationSeconds,
  } = useApp();
  useBodyScrollLock(visualTimerOpen);

  const mins = Math.floor(timerRemainingSeconds / 60);
  const secs = timerRemainingSeconds % 60;
  const pct = timerTotalSeconds > 0 ? timerRemainingSeconds / timerTotalSeconds : 0;
  const strokeColor = pct > 0.35 ? '#0097a7' : pct > 0.15 ? '#f59e0b' : '#ef4444';
  const radius = 95;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct);

  const handleDurationChange = (newTotal: number) => {
    const clamped = Math.max(0, newTotal);
    setTimerDurationSeconds(clamped);
  };

  return (
    <>
      {/* Floating Always-On-Top Mini Timer Pill when active in background */}
      {timerRunning && !visualTimerOpen && (
        <div
          onClick={() => setVisualTimerOpen(true)}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 99990,
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95))',
            border: `2px solid ${strokeColor}`,
            borderRadius: '24px',
            padding: '8px 16px',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            boxShadow: `0 8px 24px ${strokeColor}44`,
            backdropFilter: 'blur(10px)',
            transition: 'all 0.25s ease',
          }}
          title="Visual Timer is running — tap to open"
        >
          <i className="fas fa-stopwatch" style={{ color: strokeColor, fontSize: '1.1rem' }} />
          <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1.05rem', letterSpacing: '1px' }}>
            {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
          </span>
          <span style={{ fontSize: '0.72rem', color: strokeColor, textTransform: 'uppercase', fontWeight: 800 }}>
            {timerRemainingSeconds === 0 ? "Time's Up!" : 'Active'}
          </span>
        </div>
      )}

      {visualTimerOpen && (
        <Modal
          open={visualTimerOpen}
          onClose={() => setVisualTimerOpen(false)}
          title="Timer"
          icon="fas fa-stopwatch"
          maxWidth={380}
        >
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Unified Duration Stepper (-30s, MM:SS, +30s) */}
            <div style={{ marginBottom: 16 }}>
              <DurationStepper
                totalSeconds={timerTotalSeconds}
                onChange={handleDurationChange}
                minSeconds={0}
                stepSeconds={30}
              />
            </div>

            {/* Circular SVG Ring & Time Digits (Unified TimerRing) */}
            <div
              style={{
                width: 240,
                height: 240,
                margin: '0 auto 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TimerRing
                fraction={pct}
                color={strokeColor}
                label={`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`}
                caption={timerRemainingSeconds === 0 && timerTotalSeconds > 0 ? "TIME'S UP!" : timerRunning ? 'ACTIVE' : 'READY'}
                strokeWidth={5}
              />
            </div>

            {/* Windows Clock Style Icon-Only Controls: Large Play/Pause + Reset */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  if (timerRunning) {
                    pauseTimer();
                  } else {
                    startTimer();
                  }
                }}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  border: 'none',
                  background: timerRunning ? '#f59e0b' : '#0097a7',
                  color: '#ffffff',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: timerRunning
                    ? '0 4px 16px rgba(245, 158, 11, 0.4)'
                    : '0 4px 16px rgba(0, 151, 167, 0.45)',
                  transition: 'all 0.15s ease',
                }}
                title={timerRunning ? 'Pause timer' : 'Start timer'}
                aria-label={timerRunning ? 'Pause timer' : 'Start timer'}
              >
                <i className={timerRunning ? 'fas fa-pause' : 'fas fa-play'} style={{ marginLeft: timerRunning ? 0 : 2 }} />
              </button>

              <button
                type="button"
                onClick={resetTimer}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: 'rgba(255, 255, 255, 0.85)',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
                title="Reset to beginning"
                aria-label="Reset to beginning"
              >
                <i className="fas fa-rotate-left" />
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

// ============================================================================
// 3. KIDS PLAY WIDGET MODAL
// ============================================================================
const COLOUR_ITEMS = [
  { name: 'Red', hex: '#ef4444' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Orange', hex: '#f97316' },
];

const PATTERN_SETS = [
  { seq: ['🍎', '🍌', '🍎', '🍌', '🍎'], ans: '🍌', options: ['🍌', '🍎', '🍇'] },
  { seq: ['🐶', '🐱', '🐶', '🐱', '🐶'], ans: '🐱', options: ['🐭', '🐱', '🐶'] },
  { seq: ['⭐', '⭐', '🌙', '⭐', '⭐'], ans: '🌙', options: ['☀️', '⭐', '🌙'] },
  { seq: ['🔴', '🔵', '🟢', '🔴', '🔵'], ans: '🟢', options: ['🟢', '🔴', '🟡'] },
];

const MEMORY_EMOJIS = ['🐶', '🐱', '🦊', '🐼', '🐸', '🦁'];

const KidsPlayWidgetModal: React.FC = () => {
  const { playWidgetOpen, setPlayWidgetOpen, playWidgetInitialGame, playSound } = useApp();
  useBodyScrollLock(playWidgetOpen);
  const [tab, setTab] = useState<'maths' | 'colours' | 'patterns' | 'memory'>('maths');
  const [score, setScore] = useState(0);

  // Maths state
  const [mathA, setMathA] = useState(3);
  const [mathB, setMathB] = useState(4);
  const [mathFeedback, setMathFeedback] = useState<string | null>(null);

  // Colours state
  const [targetColour, setTargetColour] = useState(COLOUR_ITEMS[0]);
  const [colourFeedback, setColourFeedback] = useState<string | null>(null);

  // Patterns state
  const [patternIdx, setPatternIdx] = useState(0);
  const [patternFeedback, setPatternFeedback] = useState<string | null>(null);

  // Memory state
  const [cards, setCards] = useState<Array<{ id: number; emoji: string; flipped: boolean; matched: boolean }>>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);

  const generateMath = useCallback(() => {
    setMathA(Math.floor(Math.random() * 9) + 1);
    setMathB(Math.floor(Math.random() * 9) + 1);
    setMathFeedback(null);
  }, []);

  const generateColour = useCallback(() => {
    setTargetColour(COLOUR_ITEMS[Math.floor(Math.random() * COLOUR_ITEMS.length)]);
    setColourFeedback(null);
  }, []);

  const initMemory = useCallback(() => {
    const deck = [...MEMORY_EMOJIS, ...MEMORY_EMOJIS]
      .sort(() => Math.random() - 0.5)
      .map((emoji, id) => ({ id, emoji, flipped: false, matched: false }));
    setCards(deck);
    setFlippedIndices([]);
  }, []);

  useEffect(() => {
    if (playWidgetOpen) {
      setTab(playWidgetInitialGame);
      generateMath();
      generateColour();
      initMemory();
    }
  }, [playWidgetOpen, playWidgetInitialGame, generateMath, generateColour, initMemory]);

  if (!playWidgetOpen) return null;

  const mathAnswer = mathA + mathB;
  const mathOptions = Array.from(new Set([mathAnswer, mathAnswer + 1, Math.max(1, mathAnswer - 2), mathAnswer + 3]))
    .slice(0, 4)
    .sort((a, b) => a - b);

  const handleCardFlip = (idx: number) => {
    if (flippedIndices.length >= 2 || cards[idx].flipped || cards[idx].matched) return;
    const nextCards = cards.map((c, i) => (i === idx ? { ...c, flipped: true } : c));
    const nextFlipped = [...flippedIndices, idx];
    setCards(nextCards);
    setFlippedIndices(nextFlipped);

    if (nextFlipped.length === 2) {
      const [first, second] = nextFlipped;
      if (nextCards[first].emoji === nextCards[second].emoji) {
        playSound();
        setScore((s) => s + 1);
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c, i) => (i === first || i === second ? { ...c, matched: true } : c))
          );
          setFlippedIndices([]);
        }, 400);
      } else {
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c, i) => (i === first || i === second ? { ...c, flipped: false } : c))
          );
          setFlippedIndices([]);
        }, 800);
      }
    }
  };

  const currentPattern = PATTERN_SETS[patternIdx % PATTERN_SETS.length];

  return (
    <Modal
      open={playWidgetOpen}
      onClose={() => setPlayWidgetOpen(false)}
      title={`Play & Learn (⭐ ${score})`}
      icon="fas fa-gamepad"
      maxWidth={520}
    >
      <div style={{ textAlign: 'center' }}>

        {/* Game Tabs */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { id: 'maths', label: '🔢 Maths' },
            { id: 'colours', label: '🎨 Colours' },
            { id: 'patterns', label: '🔷 Patterns' },
            { id: 'memory', label: '🃏 Memory' },
          ].map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setTab(g.id as any)}
              style={{
                padding: '8px 14px',
                borderRadius: 12,
                border: tab === g.id ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.14)',
                background: tab === g.id ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.06)',
                color: 'inherit',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* MATHS GAME */}
        {tab === 'maths' && (
          <div>
            <div style={{ fontSize: '2.6rem', fontWeight: 900, margin: '16px 0' }}>
              {mathA} + {mathB} = ?
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {mathOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    if (opt === mathAnswer) {
                      playSound();
                      setScore((s) => s + 1);
                      setMathFeedback('🎉 Correct!');
                      setTimeout(generateMath, 800);
                    } else {
                      setMathFeedback('Try again! 💪');
                    }
                  }}
                  style={{
                    padding: '16px',
                    fontSize: '1.5rem',
                    fontWeight: 800,
                    borderRadius: 14,
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.08)',
                    color: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
            {mathFeedback && <p style={{ fontWeight: 700, marginTop: 14, color: '#fbbf24' }}>{mathFeedback}</p>}
          </div>
        )}

        {/* COLOURS GAME */}
        {tab === 'colours' && (
          <div>
            <div style={{ fontSize: '1.3rem', marginBottom: 16 }}>
              Tap the colour: <strong style={{ fontSize: '1.6rem' }}>{targetColour.name}</strong>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {COLOUR_ITEMS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => {
                    if (c.name === targetColour.name) {
                      playSound();
                      setScore((s) => s + 1);
                      setColourFeedback('🎉 Great job!');
                      setTimeout(generateColour, 700);
                    } else {
                      setColourFeedback('Not quite, try again!');
                    }
                  }}
                  style={{
                    height: 75,
                    borderRadius: 16,
                    background: c.hex,
                    border: '3px solid rgba(255,255,255,0.35)',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
            {colourFeedback && <p style={{ fontWeight: 700, marginTop: 14, color: '#fbbf24' }}>{colourFeedback}</p>}
          </div>
        )}

        {/* PATTERNS GAME */}
        {tab === 'patterns' && (
          <div>
            <div style={{ fontSize: '1.1rem', opacity: 0.85, marginBottom: 10 }}>What comes next?</div>
            <div style={{ fontSize: '2.4rem', letterSpacing: 8, marginBottom: 20 }}>
              {currentPattern.seq.join(' ')} ❓
            </div>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
              {currentPattern.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    if (opt === currentPattern.ans) {
                      playSound();
                      setScore((s) => s + 1);
                      setPatternFeedback('🎉 You got it!');
                      setTimeout(() => {
                        setPatternIdx((p) => p + 1);
                        setPatternFeedback(null);
                      }, 800);
                    } else {
                      setPatternFeedback('Try another one!');
                    }
                  }}
                  style={{
                    fontSize: '2.2rem',
                    padding: '12px 22px',
                    borderRadius: 14,
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.08)',
                    cursor: 'pointer',
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
            {patternFeedback && <p style={{ fontWeight: 700, marginTop: 14, color: '#fbbf24' }}>{patternFeedback}</p>}
          </div>
        )}

        {/* MEMORY GAME */}
        {tab === 'memory' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {cards.map((card, idx) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => handleCardFlip(idx)}
                  style={{
                    height: 68,
                    fontSize: '1.9rem',
                    borderRadius: 12,
                    border: card.matched ? '2px solid #22c55e' : '1px solid rgba(255,255,255,0.2)',
                    background:
                      card.flipped || card.matched ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.08)',
                    cursor: 'pointer',
                  }}
                >
                  {card.flipped || card.matched ? card.emoji : '❓'}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={initMemory}
              style={{
                marginTop: 14,
                padding: '6px 14px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.08)',
                color: 'inherit',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              🔄 Shuffle Again
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};
