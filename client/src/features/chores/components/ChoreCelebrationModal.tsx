import React from 'react';
import { Button } from '../../../components/ui';
import { Person } from '../../../types';

export interface ChoreCelebrationModalProps {
  person: Person | null;
  step: 'intro' | 'quiz' | 'body' | 'bonus';
  activeQuizQuestion: any;
  selectedQuizAnswer: number | null;
  quizFeedback: string | null;
  bodyChallengeText: string;
  bonusAwarded: number | null;
  spinningBonus: boolean;
  formatRewardValue: (val: number | string) => string;
  onClose: () => void;
  onStartQuizOrBody: () => void;
  onAnswerQuiz: (idx: number) => void;
  onGoToBody: () => void;
  onGoToBonus: () => void;
  onSpinBonus: () => void;
}

export const ChoreCelebrationModal: React.FC<ChoreCelebrationModalProps> = ({
  person,
  step,
  activeQuizQuestion,
  selectedQuizAnswer,
  quizFeedback,
  bodyChallengeText,
  bonusAwarded,
  spinningBonus,
  formatRewardValue,
  onClose,
  onStartQuizOrBody,
  onAnswerQuiz,
  onGoToBody,
  onGoToBonus,
  onSpinBonus,
}) => {
  if (!person) return null;

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.82)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          maxWidth: 480,
          width: '100%',
          padding: 28,
          borderRadius: 22,
          textAlign: 'center',
          background: 'linear-gradient(145deg, #1e293b, #0f172a)',
          border: '2px solid rgba(245,158,11,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {step === 'intro' && (
          <>
            <div style={{ fontSize: '3.5rem', marginBottom: 8 }}>🎉🌟🎉</div>
            <h2 style={{ margin: '0 0 8px' }}>Amazing Job, {person.name}!</h2>
            <p style={{ opacity: 0.85, marginBottom: 20 }}>
              You finished all your chores for today! Ready for your daily Brain &amp; Body Bonus?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Button
                variant="primary"
                size="lg"
                onClick={onStartQuizOrBody}
                style={{ fontWeight: 800 }}
              >
                🚀 Let&apos;s Go!
              </Button>
              <Button variant="ghost" size="lg" onClick={onClose}>
                Close
              </Button>
            </div>
          </>
        )}

        {step === 'quiz' && activeQuizQuestion && (
          <>
            <div style={{ fontSize: '2.2rem', marginBottom: 6 }}>🧠 Brain Boost</div>
            <h3 style={{ marginBottom: 16 }}>{activeQuizQuestion.q || activeQuizQuestion.question}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(activeQuizQuestion.options || []).map((opt: string, idx: number) => {
                const chosen = selectedQuizAnswer === idx;
                return (
                  <Button
                    key={idx}
                    variant={chosen ? 'primary' : 'secondary'}
                    size="md"
                    fullWidth
                    onClick={() => onAnswerQuiz(idx)}
                    disabled={selectedQuizAnswer !== null}
                    style={{
                      textAlign: 'left',
                      justifyContent: 'flex-start',
                      padding: '12px 16px',
                      border: chosen ? '2px solid #fbbf24' : '1px solid rgba(255,255,255,0.18)',
                      fontWeight: 700,
                    }}
                  >
                    {opt}
                  </Button>
                );
              })}
            </div>
            {quizFeedback && (
              <div style={{ marginTop: 16 }}>
                <p style={{ fontWeight: 700, color: '#fbbf24' }}>{quizFeedback}</p>
                <Button variant="primary" onClick={onGoToBody} style={{ fontWeight: 700 }}>
                  Next: Body Challenge 🏃
                </Button>
              </div>
            )}
          </>
        )}

        {step === 'body' && (
          <>
            <div style={{ fontSize: '2.6rem', marginBottom: 8 }}>🏃‍♂️ Body Challenge!</div>
            <p style={{ fontSize: '1.15rem', fontWeight: 700, margin: '14px 0 22px', color: '#4ade80' }}>
              {bodyChallengeText}
            </p>
            <Button variant="primary" size="lg" onClick={onGoToBonus} style={{ fontWeight: 800 }}>
              ✅ Done! Spin for Bonus Points 🎰
            </Button>
          </>
        )}

        {step === 'bonus' && (
          <>
            <div style={{ fontSize: '2.8rem', marginBottom: 8 }}>🎰 Bonus Wheel</div>
            {bonusAwarded === null ? (
              <>
                <p style={{ opacity: 0.85, marginBottom: 18 }}>
                  Spin to win extra bonus points for finishing everything today!
                </p>
                <Button
                  variant="primary"
                  size="lg"
                  disabled={spinningBonus}
                  onClick={onSpinBonus}
                  style={{
                    padding: '14px 28px',
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: '#0f172a',
                    border: 'none',
                    fontWeight: 900,
                    fontSize: '1.1rem',
                  }}
                >
                  {spinningBonus ? '🎲 Spinning...' : '🎲 SPIN NOW!'}
                </Button>
              </>
            ) : (
              <>
                <h2 style={{ color: '#fbbf24', margin: '12px 0' }}>
                  🎉 You won +{formatRewardValue(bonusAwarded)}!
                </h2>
                <Button variant="primary" onClick={onClose} style={{ fontWeight: 700, marginTop: 10 }}>
                  Awesome! 🙌
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
