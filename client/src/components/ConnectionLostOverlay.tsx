import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Button } from './ui';
import { resolveApiUrl } from '../api';

export const ConnectionLostOverlay: React.FC = () => {
  const { refresh, showToast } = useApp();
  const [isOffline, setIsOffline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [isChecking, setIsChecking] = useState(false);
  const consecutiveFailuresRef = useRef(0);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(resolveApiUrl('bootstrap'), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: typeof AbortSignal !== 'undefined' && typeof (AbortSignal as any).timeout === 'function'
          ? (AbortSignal as any).timeout(2000)
          : undefined,
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  const handleRetry = async () => {
    setIsChecking(true);
    const ok = await checkConnection();
    setIsChecking(false);
    if (ok) {
      setIsOffline(false);
      consecutiveFailuresRef.current = 0;
      showToast('Back online — connected to Home Assistant!', { type: 'success' });
      await refresh();
    } else {
      showToast('Still offline — waiting for connection...', { type: 'error' });
    }
  };

  // Listen to browser network events
  useEffect(() => {
    const handleOnline = async () => {
      const ok = await checkConnection();
      if (ok) {
        setIsOffline(false);
        consecutiveFailuresRef.current = 0;
        showToast('Back online — connected to Home Assistant!', { type: 'success' });
        await refresh();
      }
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('cr:connection_lost', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('cr:connection_lost', handleOffline);
    };
  }, [checkConnection, refresh, showToast]);

  // Periodic ping when offline to auto-reconnect as soon as WiFi / HA resumes
  useEffect(() => {
    if (!isOffline) return;

    const interval = setInterval(async () => {
      const ok = await checkConnection();
      if (ok) {
        setIsOffline(false);
        consecutiveFailuresRef.current = 0;
        showToast('Back online — connected to Home Assistant!', { type: 'success' });
        await refresh();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isOffline, checkConnection, refresh, showToast]);

  if (!isOffline) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Connection Lost"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.94)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        animation: 'crDrawerFadeIn 0.25s ease-out',
      }}
    >
      <div
        style={{
          maxWidth: 380,
          width: '100%',
          padding: '32px 24px',
          borderRadius: 24,
          background: 'var(--cr-surface-1, #1e293b)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(245, 158, 11, 0.15)',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'rgba(245, 158, 11, 0.15)',
            border: '2px solid rgba(245, 158, 11, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            color: '#f59e0b',
          }}
        >
          <i className="fas fa-wifi fa-pulse" />
        </div>

        <div>
          <h3 style={{ margin: '0 0 6px', fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>
            Connection Lost
          </h3>
          <p style={{ margin: 0, fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.45 }}>
            Reconnecting to Home Assistant... Please wait while your connection restores.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <Button
            variant="primary"
            size="md"
            icon="fas fa-rotate"
            isLoading={isChecking}
            onClick={handleRetry}
          >
            {isChecking ? 'Checking...' : 'Retry Now'}
          </Button>
        </div>
      </div>
    </div>
  );
};
