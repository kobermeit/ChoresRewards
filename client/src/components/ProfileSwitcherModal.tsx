import React, { useState } from 'react';
import { Person } from '../types';
import { useApp } from '../context/AppContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { resolveAvatarUrl } from '../api';
import { Button } from './ui';

interface ProfileSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileSwitcherModal: React.FC<ProfileSwitcherModalProps> = ({ isOpen, onClose }) => {
  useBodyScrollLock(isOpen);
  const { data, activeUser, switchUser, showToast, openEditMemberModal, isParent } = useApp();

  const [pinTargetPerson, setPinTargetPerson] = useState<Person | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  if (!isOpen) return null;

  const people = data?.family || [];

  const handleSelectPerson = async (p: Person) => {
    if (p.has_pin) {
      setPinTargetPerson(p);
      setPinInput('');
      setPinError(null);
    } else {
      setSwitching(true);
      const res = await switchUser(p.id);
      setSwitching(false);
      if (res.success) {
        showToast(`Switched profile to ${p.name}`);
        onClose();
      } else {
        showToast(res.error || 'Failed to switch profile', { type: 'error' });
      }
    }
  };

  const handlePinSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pinTargetPerson) return;
    if (!pinInput.trim()) {
      setPinError('Enter PIN');
      return;
    }

    setSwitching(true);
    setPinError(null);
    const res = await switchUser(pinTargetPerson.id, pinInput);
    setSwitching(false);
    if (res.success) {
      showToast(`Switched profile to ${pinTargetPerson.name}`);
      setPinTargetPerson(null);
      setPinInput('');
      onClose();
    } else {
      setPinError(res.error || 'Incorrect PIN');
      setPinInput('');
    }
  };

  const handleKeypadPress = (val: string) => {
    setPinError(null);
    if (pinInput.length < 8) {
      const next = pinInput + val;
      setPinInput(next);
      if (next.length === 4 && pinTargetPerson) {
        // Auto-submit on 4 digits
        (async () => {
          setSwitching(true);
          const res = await switchUser(pinTargetPerson.id, next);
          setSwitching(false);
          if (res.success) {
            showToast(`Switched profile to ${pinTargetPerson.name}`);
            setPinTargetPerson(null);
            setPinInput('');
            onClose();
          } else {
            setPinError(res.error || 'Incorrect PIN');
            setPinInput('');
          }
        })();
      }
    }
  };

  const handleKeypadBackspace = () => {
    setPinError(null);
    setPinInput((p) => p.slice(0, -1));
  };

  const renderAvatar = (p: Person, size = 64) => {
    const isFamilyUser = p.role === 'family' || p.name.toLowerCase() === 'family';
    if (isFamilyUser) {
      return (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: `${size * 0.44}px`,
            color: '#fff',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)',
          }}
        >
          👨‍👩‍👧‍👦
        </div>
      );
    }

    if (p.avatar && p.avatar !== 'default_avatar.png') {
      return (
        <img
          src={resolveAvatarUrl(p.avatar)}
          alt={p.name}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = resolveAvatarUrl(null);
          }}
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            objectFit: 'cover',
            border: `3px solid ${p.color || '#3b82f6'}`,
            boxShadow: `0 4px 14px ${(p.color || '#3b82f6')}55`,
          }}
        />
      );
    }

    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: p.color || '#64748b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: `${size * 0.38}px`,
          fontWeight: 700,
          color: '#fff',
          textTransform: 'uppercase',
          border: '2px solid rgba(255,255,255,0.2)',
          boxShadow: `0 4px 14px ${(p.color || '#3b82f6')}44`,
        }}
      >
        {p.name.slice(0, 2)}
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(10px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          if (pinTargetPerson) {
            setPinTargetPerson(null);
          } else {
            onClose();
          }
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
          borderRadius: 'var(--modal-radius)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8)',
          padding: '28px',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          animation: 'crModalFadeIn 0.2s ease-out',
        }}
      >
        {pinTargetPerson ? (
          /* PIN Entry Screen */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <button
                type="button"
                onClick={() => setPinTargetPerson(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <i className="fas fa-arrow-left" /> Back
              </button>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>Enter PIN</h3>
              <div style={{ width: 40 }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              {renderAvatar(pinTargetPerson, 72)}
              <span style={{ fontSize: '1.15rem', fontWeight: 700 }}>{pinTargetPerson.name}</span>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                {pinTargetPerson.role === 'parent' ? 'Parent PIN Required' : 'PIN Required'}
              </span>
            </div>

            {/* PIN Dots Display */}
            <div style={{ display: 'flex', gap: '14px', margin: '8px 0' }}>
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: pinInput.length > idx ? '#3b82f6' : 'rgba(255, 255, 255, 0.15)',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    transition: 'all 0.15s ease',
                    transform: pinInput.length > idx ? 'scale(1.2)' : 'scale(1)',
                  }}
                />
              ))}
            </div>

            {pinError && (
              <span style={{ color: '#f87171', fontSize: '0.9rem', fontWeight: 600 }}>
                {pinError}
              </span>
            )}

            {/* Keypad */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 72px)',
                gap: '12px',
                marginTop: '8px',
              }}
            >
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  disabled={switching}
                  onClick={() => handleKeypadPress(digit)}
                  style={{
                    height: '62px',
                    borderRadius: '16px',
                    background: 'rgba(255, 255, 255, 0.07)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#fff',
                    fontSize: '1.5rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'background 0.1s ease, transform 0.1s ease',
                  }}
                  onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.94)')}
                  onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPinInput('')}
                style={{
                  height: '62px',
                  borderRadius: '16px',
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Clear
              </button>
              <button
                type="button"
                disabled={switching}
                onClick={() => handleKeypadPress('0')}
                style={{
                  height: '62px',
                  borderRadius: '16px',
                  background: 'rgba(255, 255, 255, 0.07)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#fff',
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                0
              </button>
              <button
                type="button"
                onClick={handleKeypadBackspace}
                style={{
                  height: '62px',
                  borderRadius: '16px',
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                }}
              >
                <i className="fas fa-backspace" />
              </button>
            </div>
          </div>
        ) : (
          /* Profile Picker Grid */
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: '#f8fafc' }}>
                  Who's Using the Tablet?
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: '#94a3b8' }}>
                  Select your profile to view your personal dashboard
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                <i className="fas fa-times" />
              </button>
            </div>

            {/* Family Kiosk (Shared Display) Hero Card */}
            {(() => {
              const kiosk = data?.kiosk || {
                id: -1,
                name: 'Family Kiosk',
                role: 'family' as const,
                points: 0,
                bonus_points: 0,
                avatar: 'default_avatar.png',
                color: '#3b82f6',
                order: 0,
                is_admin: false,
                has_pin: false,
                age: null,
                streak: { current_streak: 0, longest_streak: 0, last_completed_date: null },
                badges: [],
                total_completed: 0,
              };
              const isKioskActive = !activeUser || activeUser.role === 'family' || activeUser.id === kiosk.id;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => handleSelectPerson(kiosk)}
                    style={{
                      background: isKioskActive
                        ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.28) 0%, rgba(30, 58, 138, 0.35) 100%)'
                        : 'rgba(255, 255, 255, 0.04)',
                      border: isKioskActive
                        ? '2px solid #3b82f6'
                        : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '18px',
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      position: 'relative',
                      boxShadow: isKioskActive
                        ? '0 8px 24px rgba(59, 130, 246, 0.35)'
                        : '0 4px 12px rgba(0, 0, 0, 0.2)',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isKioskActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isKioskActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                    }}
                  >
                    <div
                      style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '14px',
                        background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.6rem',
                        boxShadow: '0 4px 14px rgba(59, 130, 246, 0.45)',
                        flexShrink: 0,
                      }}
                    >
                      🏠
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.02rem', fontWeight: 700, color: '#f8fafc' }}>
                          Family Kiosk
                        </span>
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: '6px',
                            background: 'rgba(59, 130, 246, 0.2)',
                            color: '#93c5fd',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}
                        >
                          Shared Display
                        </span>
                      </div>
                      <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.3 }}>
                        Wall tablet shared dashboard for everyone
                      </p>
                    </div>

                    {isKioskActive ? (
                      <span
                        style={{
                          background: '#10b981',
                          color: '#fff',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          letterSpacing: '0.5px',
                        }}
                      >
                        ACTIVE
                      </span>
                    ) : (
                      <i className="fas fa-chevron-right" style={{ color: '#64748b', fontSize: '0.85rem' }} />
                    )}
                  </button>
                </div>
              );
            })()}

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '2px 0 -8px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Individual Profiles
              </span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '14px',
              }}
            >
              {people.filter((p) => p.role !== 'family').map((p) => {
                const isActive = activeUser?.id === p.id;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPerson(p)}
                    style={{
                      background: isActive
                        ? 'rgba(59, 130, 246, 0.22)'
                        : 'rgba(255, 255, 255, 0.05)',
                      border: isActive
                        ? '2px solid #3b82f6'
                        : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '18px',
                      padding: '16px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      position: 'relative',
                      boxShadow: isActive
                        ? '0 8px 24px rgba(59, 130, 246, 0.3)'
                        : '0 4px 12px rgba(0,0,0,0.2)',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.09)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    }}
                  >
                    {isActive && (
                      <span
                        style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          background: '#10b981',
                          color: '#fff',
                          fontSize: '0.62rem',
                          fontWeight: 700,
                          padding: '2px 5px',
                          borderRadius: '6px',
                        }}
                      >
                        ACTIVE
                      </span>
                    )}

                    {renderAvatar(p, 60)}

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', width: '100%' }}>
                      <span style={{ fontSize: '0.98rem', fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                        {p.name}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            color: p.role === 'parent' ? '#f59e0b' : '#34d399',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}
                        >
                          {p.role === 'parent' ? 'Parent' : `${p.points} pts`}
                        </span>
                        {p.age !== null && p.age !== undefined && (
                          <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                            • {p.age}y
                          </span>
                        )}
                      </div>
                      {p.birthday_info?.isToday && (
                        <span style={{ fontSize: '0.65rem', background: '#ec4899', color: '#fff', padding: '1px 5px', borderRadius: '4px', fontWeight: 700, marginTop: '2px' }}>
                          🎂 Birthday!
                        </span>
                      )}
                    </div>

                    {p.has_pin && (
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                        <i className="fas fa-lock" style={{ fontSize: '0.62rem' }} /> PIN
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Quick footer to manage members if Parent or Family */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '8px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <Button
                variant="ghost"
                size="sm"
                icon="fas fa-user-plus"
                onClick={() => {
                  onClose();
                  openEditMemberModal();
                }}
                style={{ color: '#93c5fd' }}
              >
                Add Family Member
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={onClose}
              >
                Close
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
