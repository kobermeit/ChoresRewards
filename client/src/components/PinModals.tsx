import React, { useState, useEffect } from 'react';
import { apiPost } from '../api';
import { useApp } from '../context/AppContext';

export const PinModals: React.FC<{
  adultPinOpen: boolean;
  onCloseAdultPin: () => void;
  onAdultPinSuccess?: () => void;
}> = ({ adultPinOpen, onCloseAdultPin, onAdultPinSuccess }) => {
  const { data, refresh, setAdultMode, showToast } = useApp();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState(0);

  const needsMasterLogin = Boolean(data && data.master_pin_set && !data.auth?.authenticated);
  const isOpen = needsMasterLogin || adultPinOpen;

  useEffect(() => {
    if (!isOpen) {
      setPin('');
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (retryAfter <= 0) return;
    const t = setInterval(() => {
      setRetryAfter((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [retryAfter]);

  const submitPin = async (enteredPin: string) => {
    if (retryAfter > 0) return;
    setError(null);
    try {
      const endpoint = needsMasterLogin ? 'login' : 'adult_login';
      const res = await apiPost(endpoint, { pin: enteredPin });
      if (res?.success) {
        setPin('');
        setAdultMode(true);
        showToast(`Unlocked Adult Mode (${res.adult_name || 'Admin'}) 🔓`);
        if (needsMasterLogin) {
          await refresh();
        }
        onCloseAdultPin();
        onAdultPinSuccess?.();
      } else {
        setPin('');
        if (res?.retry_after) {
          setRetryAfter(Number(res.retry_after));
        }
        setError(res?.error || 'Incorrect PIN');
      }
    } catch (err: any) {
      setPin('');
      setError(err?.message || 'PIN verification failed');
    }
  };

  const handleDigit = (digit: string) => {
    if (retryAfter > 0 || pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === 4) {
      submitPin(next);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  if (!isOpen) return null;

  return (
    <div
      id={needsMasterLogin ? 'pin-overlay' : 'adult-pin-overlay'}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99990,
      }}
    >
      <div
        style={{
          background: 'var(--cr-surface-1)',
          border: '1px solid var(--cr-surface-border)',
          borderRadius: 20,
          padding: 28,
          width: '92%',
          maxWidth: 360,
          textAlign: 'center',
          boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ fontSize: '2.2rem', marginBottom: 8 }}>🔒</div>
        <h3 style={{ margin: '0 0 6px', color: 'var(--cr-text-primary)', fontSize: '1.3rem' }}>
          {needsMasterLogin ? 'Enter Family PIN' : 'Adult Authorisation'}
        </h3>
        <p style={{ margin: '0 0 18px', color: 'var(--cr-text-secondary)', fontSize: '0.9rem' }}>
          Enter your 4-digit PIN to continue
        </p>

        {/* PIN Dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginBottom: 18 }}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: i < pin.length ? '#3b82f6' : 'transparent',
                border: '2px solid #3b82f6',
                transition: 'background 0.15s',
              }}
            />
          ))}
        </div>

        {(error || retryAfter > 0) && (
          <div style={{ color: '#f87171', fontSize: '0.88rem', fontWeight: 600, marginBottom: 14 }}>
            {retryAfter > 0 ? `Locked out — try again in ${retryAfter}s` : error}
          </div>
        )}

        {/* Numeric Keypad */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
            marginBottom: 16,
          }}
        >
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleDigit(d)}
              style={{
                padding: '14px 0',
                fontSize: '1.25rem',
                fontWeight: 700,
                borderRadius: 12,
                background: 'var(--cr-surface-2)',
                color: 'var(--cr-text-primary)',
                border: '1px solid var(--cr-surface-border)',
                cursor: 'pointer',
              }}
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPin('')}
            style={{
              padding: '14px 0',
              fontSize: '0.9rem',
              fontWeight: 700,
              borderRadius: 12,
              background: 'var(--cr-surface-2)',
              color: 'var(--cr-text-secondary)',
              border: '1px solid var(--cr-surface-border)',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            style={{
              padding: '14px 0',
              fontSize: '1.25rem',
              fontWeight: 700,
              borderRadius: 12,
              background: 'var(--cr-surface-2)',
              color: 'var(--cr-text-primary)',
              border: '1px solid var(--cr-surface-border)',
              cursor: 'pointer',
            }}
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            style={{
              padding: '14px 0',
              fontSize: '1.1rem',
              fontWeight: 700,
              borderRadius: 12,
              background: 'var(--cr-surface-2)',
              color: 'var(--cr-text-secondary)',
              border: '1px solid var(--cr-surface-border)',
              cursor: 'pointer',
            }}
          >
            ⌫
          </button>
        </div>

        {!needsMasterLogin && (
          <button
            type="button"
            onClick={onCloseAdultPin}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: 10,
              background: 'transparent',
              color: 'var(--cr-text-secondary)',
              border: '1px solid var(--cr-surface-border)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};
