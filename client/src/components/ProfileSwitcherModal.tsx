import React, { useState } from 'react';
import { Person } from '../types';
import { useApp } from '../context/AppContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { resolveAssetUrl } from '../api';

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
          src={resolveAssetUrl(`uploads/${p.avatar}`)}
          alt={p.name}
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
          borderRadius: '24px',
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

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '14px',
              }}
            >
              {people.map((p) => {
                const isActive = activeUser?.id === p.id;
                const isFamilyUser = p.role === 'family' || p.name.toLowerCase() === 'family';

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
                      padding: '18px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '10px',
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
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '8px',
                        }}
                      >
                        ACTIVE
                      </span>
                    )}

                    {renderAvatar(p, 64)}

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                        {p.name}
                      </span>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          color: p.role === 'parent' ? '#f59e0b' : isFamilyUser ? '#60a5fa' : '#34d399',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}
                      >
                        {p.role === 'parent' ? 'Parent' : isFamilyUser ? 'Family Hub' : `${p.points} pts`}
                      </span>
                    </div>

                    {p.has_pin && (
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <i className="fas fa-lock" style={{ fontSize: '0.68rem' }} /> PIN
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
              <button
                type="button"
                onClick={() => {
                  onClose();
                  openEditMemberModal();
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#93c5fd',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 8px',
                }}
              >
                <i className="fas fa-user-plus" /> Add Family Member
              </button>

              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#cbd5e1',
                  borderRadius: '10px',
                  padding: '7px 16px',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
