import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { apiGet, resolveAssetUrl, resolveAvatarUrl } from '../../api';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

export const ScreensaverOverlay: React.FC = () => {
  const { screensaverOpen, setScreensaverOpen, data, refresh } = useApp();
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
        {/* Cinematic Vignette Gradient */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to top, rgba(2, 6, 23, 0.88) 0%, rgba(2, 6, 23, 0.4) 40%, rgba(2, 6, 23, 0.2) 70%, rgba(2, 6, 23, 0.6) 100%)',
          }}
        />
      </div>

      {/* Top Bar: Family Hub status */}
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

      {/* Bottom Area: Ambient Clock & Family summary */}
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
              fontSize: '1.5rem',
              fontWeight: 500,
              color: 'rgba(255, 255, 255, 0.85)',
              marginTop: 10,
              textShadow: '0 2px 12px rgba(0,0,0,0.4)',
            }}
          >
            {now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>

        {/* Bottom Right: Family Chore Progress Cards */}
        {config?.show_summary !== false && peopleList.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: 16,
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(16px)',
              padding: '16px 20px',
              borderRadius: 24,
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
            }}
          >
            {peopleList.map((person) => {
              const pending = person.pending_chores ?? 0;
              const completed = person.completed_chores ?? 0;
              const total = pending + completed;
              const pctDone = total > 0 ? Math.round((completed / total) * 100) : 100;

              return (
                <div
                  key={person.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 12px',
                    borderRadius: 16,
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <img
                    src={resolveAvatarUrl(person.avatar)}
                    alt={person.name}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: `2px solid ${person.color || '#3b82f6'}`,
                    }}
                  />
                  <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
                      {person.name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.7)', marginTop: 2 }}>
                      {total === 0 ? (
                        'All done! ✨'
                      ) : (
                        `${completed}/${total} chores (${pctDone}%)`
                      )}
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
