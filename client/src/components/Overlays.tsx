import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { apiGet, resolveAssetUrl, resolveAvatarUrl } from '../api';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { Modal } from './common/Modal';

export const Overlays: React.FC = () => {
  return (
    <>
      <ScreensaverOverlay />
      <VisualTimerModal />
      <KidsPlayWidgetModal />
    </>
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

  return (
    <div
      id="screensaver-overlay"
      onClick={() => setScreensaverOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: '#050811',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '48px 56px',
        cursor: 'pointer',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Background media if uploaded */}
      {currentMedia && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          {currentMedia.type === 'video' ? (
            <video
              src={resolveAssetUrl(currentMedia.url)}
              autoPlay
              muted
              loop
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.55 }}
            />
          ) : (
            <img
              src={resolveAssetUrl(currentMedia.url)}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.55 }}
            />
          )}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to bottom, rgba(5,8,17,0.6), rgba(5,8,17,0.3), rgba(5,8,17,0.85))',
            }}
          />
        </div>
      )}

      {/* Top Clock & Date */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: '5.5rem', fontWeight: 900, lineHeight: 1, letterSpacing: '-2px' }}>
          {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div style={{ fontSize: '1.6rem', opacity: 0.85, marginTop: 8, fontWeight: 600 }}>
          {now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Bottom Family Progress Pills */}
      {config?.show_chores !== false && (
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
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
                    padding: '12px 20px',
                    borderRadius: 20,
                    background: 'rgba(15, 23, 42, 0.75)',
                    backdropFilter: 'blur(12px)',
                    border: allDone ? '2px solid #22c55e' : '1px solid rgba(255,255,255,0.18)',
                  }}
                >
                  <img
                    src={resolveAvatarUrl(p.avatar)}
                    alt={p.name}
                    style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>{p.name}</div>
                    <div style={{ fontSize: '0.88rem', color: allDone ? '#4ade80' : '#94a3b8', fontWeight: 700 }}>
                      {allDone ? '🎉 All Done!' : `${completed}/${total} chores`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 18, fontSize: '0.85rem', opacity: 0.5 }}>Tap anywhere to wake</div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 2. VISUAL TIMER MODAL
// ============================================================================
const VisualTimerModal: React.FC = () => {
  const { visualTimerOpen, setVisualTimerOpen, playSound } = useApp();
  useBodyScrollLock(visualTimerOpen);
  const [totalSeconds, setTotalSeconds] = useState(300); // default 5 min
  const [remainingSeconds, setRemainingSeconds] = useState(300);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running || !visualTimerOpen) return;
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setRunning(false);
          playSound();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [running, visualTimerOpen, playSound]);

  if (!visualTimerOpen) return null;

  const setPreset = (minutes: number) => {
    const secs = minutes * 60;
    setRunning(false);
    setTotalSeconds(secs);
    setRemainingSeconds(secs);
  };

  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const pct = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
  const strokeColor = pct > 0.5 ? '#22c55e' : pct > 0.2 ? '#f59e0b' : '#ef4444';
  const radius = 95;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct);

  return (
    <Modal
      open={visualTimerOpen}
      onClose={() => setVisualTimerOpen(false)}
      title="Visual Timer"
      icon="fas fa-stopwatch"
      maxWidth={440}
    >
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Preset Buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
          {[1, 2, 5, 10, 15, 20, 30].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setPreset(m)}
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                border: totalSeconds === m * 60 ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.18)',
                background: totalSeconds === m * 60 ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.06)',
                color: 'inherit',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {m}m
            </button>
          ))}
        </div>

        {/* Circular SVG Ring */}
        <div style={{ position: 'relative', width: 230, height: 230, margin: '0 auto 20px' }}>
          <svg width="230" height="230" style={{ transform: 'rotate(-90deg)' }}>
            <circle
              cx="115"
              cy="115"
              r={radius}
              fill="transparent"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="16"
            />
            <circle
              cx="115"
              cy="115"
              r={radius}
              fill="transparent"
              stroke={strokeColor}
              strokeWidth="16"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.5s linear, stroke 0.3s ease' }}
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ fontSize: '3rem', fontWeight: 900, fontFamily: 'monospace' }}>
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </div>
            {remainingSeconds === 0 && (
              <div style={{ color: '#4ade80', fontWeight: 800, marginTop: 4 }}>🎉 Time's Up!</div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => {
              if (remainingSeconds === 0) setRemainingSeconds(totalSeconds);
              setRunning((prev) => !prev);
            }}
            style={{
              padding: '12px 28px',
              borderRadius: 12,
              border: 'none',
              background: running ? '#f59e0b' : '#22c55e',
              color: '#fff',
              fontWeight: 800,
              fontSize: '1.05rem',
              cursor: 'pointer',
            }}
          >
            {running ? '⏸ Pause' : '▶ Start'}
          </button>
          <button
            type="button"
            onClick={() => {
              setRunning(false);
              setRemainingSeconds(totalSeconds);
            }}
            style={{
              padding: '12px 20px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.08)',
              color: 'inherit',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ↺ Reset
          </button>
        </div>
      </div>
    </Modal>
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
