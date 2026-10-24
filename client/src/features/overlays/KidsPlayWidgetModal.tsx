import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { Modal } from '../../components/common/Modal';

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

export const KidsPlayWidgetModal: React.FC = () => {
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
