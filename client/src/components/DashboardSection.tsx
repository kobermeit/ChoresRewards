import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { apiGet, apiPost, resolveAvatarUrl, resolveAssetUrl } from '../api';
import { DashboardStickyNote } from '../types';

const STICKY_COLORS = [
  { label: 'Yellow', hex: '#fef08a' },
  { label: 'Pink', hex: '#fecaca' },
  { label: 'Mint', hex: '#bbf7d0' },
  { label: 'Sky', hex: '#bfdbfe' },
  { label: 'Lavender', hex: '#e9d5ff' },
  { label: 'Peach', hex: '#fed7aa' },
];

export const DashboardSection: React.FC = () => {
  const {
    data,
    scrollToSection,
    setScreensaverOpen,
    setVisualTimerOpen,
    openPlayGame,
    formatRewardValue,
    showToast,
  } = useApp();

  const [stickyNotes, setStickyNotes] = useState<DashboardStickyNote[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoIdx, setPhotoIdx] = useState(0);

  useEffect(() => {
    if (data?.dashboard_notes) {
      setStickyNotes(data.dashboard_notes);
    }
  }, [data?.dashboard_notes]);

  useEffect(() => {
    apiGet('screensaver/config')
      .then((res) => {
        if (res?.photos?.length) {
          setPhotos(res.photos);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (photos.length <= 1) return;
    const t = setInterval(() => {
      setPhotoIdx((prev) => (prev + 1) % photos.length);
    }, 8000);
    return () => clearInterval(t);
  }, [photos.length]);

  if (!data) return null;

  const todayIso = data.current_date;
  const weekdayName = new Date(`${todayIso}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

  const todayMeals = data.meal_planner?.plan?.[todayIso] || { breakfast: '', lunch: '', dinner: '' };
  const uncompletedRewards = data.rewards.filter((r) => !r.completed).slice(0, 4);
  const upcomingEvents = (data.google_calendar?.events || []).slice(0, 5);

  const saveStickyNotes = async (nextNotes: DashboardStickyNote[]) => {
    setStickyNotes(nextNotes);
    try {
      await apiPost('dashboard_notes', { notes: nextNotes });
    } catch {
      showToast('Failed to save sticky notes', { type: 'error' });
    }
  };

  const addStickyNote = () => {
    const newNote: DashboardStickyNote = {
      id: `note_${Date.now()}`,
      title: 'Note',
      text: '',
      color: STICKY_COLORS[stickyNotes.length % STICKY_COLORS.length].hex,
      text_size: 'md',
      pinned: false,
    };
    saveStickyNotes([newNote, ...stickyNotes]);
  };

  const updateStickyNote = (id: string, patch: Partial<DashboardStickyNote>) => {
    const next = stickyNotes.map((n) => (n.id === id ? { ...n, ...patch } : n));
    saveStickyNotes(next);
  };

  const deleteStickyNote = (id: string) => {
    saveStickyNotes(stickyNotes.filter((n) => n.id !== id));
  };

  return (
    <section
      id="dashboard-section"
      style={{
        padding: '16px 20px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.35rem', color: 'var(--cr-text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fas fa-compass" style={{ color: '#38bdf8' }} />
          Today at a Glance
        </h2>
      </div>

      {/* Dashboard Grid */}
      <div
        id="dashboard-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
          gap: 16,
        }}
      >
        {/* 1. Today's Tasks */}
        <div
          className="dash-tile"
          onClick={() => scrollToSection('kanban')}
          style={{
            background: 'var(--cr-surface-1)',
            border: '1px solid var(--cr-surface-border)',
            borderRadius: 16,
            padding: 18,
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--cr-text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fas fa-check-double" style={{ color: '#4ade80' }} />
              Today's Tasks
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--cr-text-secondary)' }}>View Board →</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {data.family.map((person) => {
              const personChores = data.chores.filter((c) => {
                if (c.completed) return false;
                if (c.assigned_to_id !== person.id && c.assigned_to !== person.name) return false;
                if (!c.days_of_week || !c.days_of_week.trim()) return true;
                return c.days_of_week
                  .split(',')
                  .map((d) => d.trim().toLowerCase())
                  .includes(weekdayName);
              });

              return (
                <div
                  key={person.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: 'var(--cr-surface-2)',
                    padding: '8px 12px',
                    borderRadius: 12,
                    borderLeft: `4px solid ${person.color || '#3b82f6'}`,
                  }}
                >
                  <img
                    src={resolveAvatarUrl(person.avatar)}
                    alt={person.name}
                    style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--cr-text-primary)' }}>
                      {person.name}
                    </div>
                    {personChores.length === 0 ? (
                      <div style={{ fontSize: '0.8rem', color: '#4ade80', fontWeight: 600 }}>🌟 All done today!</div>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: 'var(--cr-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {personChores.map((c) => `${c.icon || '•'} ${c.title}`).join(', ')}
                      </div>
                    )}
                  </div>
                  <span
                    style={{
                      background: personChores.length === 0 ? 'rgba(74,222,128,0.2)' : 'rgba(59,130,246,0.2)',
                      color: personChores.length === 0 ? '#4ade80' : '#60a5fa',
                      padding: '4px 10px',
                      borderRadius: 999,
                      fontSize: '0.8rem',
                      fontWeight: 700,
                    }}
                  >
                    {personChores.length === 0 ? 'Done' : `${personChores.length} left`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Meals Today */}
        <div
          className="dash-tile"
          onClick={() => scrollToSection('meal-planner-section')}
          style={{
            background: 'var(--cr-surface-1)',
            border: '1px solid var(--cr-surface-border)',
            borderRadius: 16,
            padding: 18,
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--cr-text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fas fa-utensils" style={{ color: '#fb923c' }} />
              Meals Today
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--cr-text-secondary)' }}>Meal Planner →</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { key: 'breakfast', label: 'Breakfast', icon: '🥐', val: todayMeals.breakfast },
              { key: 'lunch', label: 'Lunch', icon: '🥪', val: todayMeals.lunch },
              { key: 'dinner', label: 'Dinner', icon: '🍽️', val: todayMeals.dinner },
            ].map((slot) => (
              <div
                key={slot.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--cr-surface-2)',
                  padding: '10px 14px',
                  borderRadius: 12,
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--cr-text-secondary)', fontSize: '0.88rem' }}>
                  {slot.icon} {slot.label}
                </span>
                <span style={{ fontWeight: 700, color: slot.val ? 'var(--cr-text-primary)' : 'var(--cr-text-secondary)' }}>
                  {slot.val || 'Not planned'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Top Rewards */}
        <div
          className="dash-tile"
          onClick={() => scrollToSection('rewards-section')}
          style={{
            background: 'var(--cr-surface-1)',
            border: '1px solid var(--cr-surface-border)',
            borderRadius: 16,
            padding: 18,
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--cr-text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fas fa-trophy" style={{ color: '#fbbf24' }} />
              Top Rewards
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--cr-text-secondary)' }}>All Rewards →</span>
          </div>
          {uncompletedRewards.length === 0 ? (
            <p style={{ color: 'var(--cr-text-secondary)', margin: '16px 0' }}>No active rewards yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {uncompletedRewards.map((r) => {
                const person = data.family.find((p) => p.id === r.assigned_to_id || p.name === r.assigned_to);
                const currentPts = person ? person.points + person.bonus_points : 0;
                const pct = Math.min(100, Math.round((currentPts / Math.max(1, r.points_required)) * 100));
                return (
                  <div
                    key={r.id}
                    style={{
                      background: 'var(--cr-surface-2)',
                      padding: '10px 12px',
                      borderRadius: 12,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', fontWeight: 700, marginBottom: 6 }}>
                      <span>
                        🎁 {r.title} <span style={{ opacity: 0.65 }}>({r.assigned_to})</span>
                      </span>
                      <span style={{ color: '#fbbf24' }}>{formatRewardValue(r.points_required)}</span>
                    </div>
                    <div style={{ height: 7, background: 'rgba(255,255,255,0.1)', borderRadius: 999, overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: '100%',
                          background: pct >= 100 ? '#4ade80' : 'linear-gradient(90deg, #3b82f6, #a855f7)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. Upcoming Events */}
        <div
          className="dash-tile"
          onClick={() => scrollToSection('events-section')}
          style={{
            background: 'var(--cr-surface-1)',
            border: '1px solid var(--cr-surface-border)',
            borderRadius: 16,
            padding: 18,
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--cr-text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fas fa-calendar-day" style={{ color: '#60a5fa' }} />
              Upcoming Events
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--cr-text-secondary)' }}>Calendar →</span>
          </div>
          {!data.google_calendar?.enabled ? (
            <p style={{ color: 'var(--cr-text-secondary)', fontSize: '0.88rem' }}>
              Google Calendar is not enabled. Enable it in Settings to view family events.
            </p>
          ) : upcomingEvents.length === 0 ? (
            <p style={{ color: 'var(--cr-text-secondary)', fontSize: '0.88rem' }}>No upcoming events scheduled.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {upcomingEvents.map((ev, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--cr-surface-2)',
                    padding: '8px 12px',
                    borderRadius: 10,
                    borderLeft: `4px solid ${ev.color || '#3b82f6'}`,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{ev.title}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--cr-text-secondary)', whiteSpace: 'nowrap' }}>
                    {ev.weekday_short} • {ev.start_time_display}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 5. Family Photos / Screensaver Card */}
        <div
          id="dash-photos-card"
          className="dash-tile"
          onClick={() => setScreensaverOpen(true)}
          style={{
            background: 'var(--cr-surface-1)',
            border: '1px solid var(--cr-surface-border)',
            borderRadius: 16,
            padding: 18,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--cr-text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fas fa-images" style={{ color: '#f472b6' }} />
              Family Photos
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--cr-text-secondary)' }}>Start Slideshow ⛶</span>
          </div>
          {photos.length > 0 ? (
            <div style={{ position: 'relative', height: 150, borderRadius: 12, overflow: 'hidden', background: '#000' }}>
              <img
                src={resolveAssetUrl(photos[photoIdx % photos.length])}
                alt="Family memory"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          ) : (
            <div
              style={{
                height: 140,
                borderRadius: 12,
                background: 'var(--cr-surface-2)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--cr-text-secondary)',
                gap: 8,
              }}
            >
              <i className="fas fa-camera-retro" style={{ fontSize: '2rem', opacity: 0.6 }} />
              <span style={{ fontSize: '0.85rem' }}>Upload photos in Settings → Screensaver</span>
            </div>
          )}
        </div>

        {/* 6. Visual Timer & Kids Play Zone */}
        <div
          style={{
            background: 'var(--cr-surface-1)',
            border: '1px solid var(--cr-surface-border)',
            borderRadius: 16,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--cr-text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fas fa-gamepad" style={{ color: '#a855f7' }} />
              Timer & Brain Games
            </h3>
            <button
              type="button"
              onClick={() => setVisualTimerOpen(true)}
              style={{
                background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '6px 12px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.82rem',
              }}
            >
              ⏱️ Open Visual Timer
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { id: 'maths' as const, label: '🔢 Maths', color: '#3b82f6' },
              { id: 'colours' as const, label: '🎨 Colours', color: '#ec4899' },
              { id: 'patterns' as const, label: '🧩 Patterns', color: '#10b981' },
              { id: 'memory' as const, label: '🃏 Memory', color: '#f59e0b' },
            ].map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => openPlayGame(g.id)}
                style={{
                  background: 'var(--cr-surface-2)',
                  color: 'var(--cr-text-primary)',
                  border: `1px solid ${g.color}55`,
                  borderRadius: 12,
                  padding: '12px 10px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  textAlign: 'center',
                }}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Dashboard Sticky Notes Board */}
      <div
        id="dashboard-notes-panel"
        style={{
          marginTop: 18,
          background: 'var(--cr-surface-1)',
          border: '1px solid var(--cr-surface-border)',
          borderRadius: 16,
          padding: 18,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--cr-text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fas fa-thumbtack" style={{ color: '#fde047' }} />
            Fridge Sticky Notes
          </h3>
          <button
            type="button"
            onClick={addStickyNote}
            style={{
              background: '#eab308',
              color: '#0f172a',
              border: 'none',
              borderRadius: 10,
              padding: '7px 14px',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '0.85rem',
            }}
          >
            + Add Sticky Note
          </button>
        </div>

        {stickyNotes.length === 0 ? (
          <p style={{ color: 'var(--cr-text-secondary)', fontSize: '0.9rem', margin: 0 }}>
            No sticky notes on the fridge yet. Click "+ Add Sticky Note" to post one!
          </p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            {stickyNotes.map((note) => (
              <div
                key={note.id}
                style={{
                  background: note.color || '#fef08a',
                  color: '#1e293b',
                  width: note.width || 240,
                  minHeight: note.height || 170,
                  borderRadius: 14,
                  padding: 14,
                  boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <textarea
                  value={note.text}
                  placeholder="Write a note…"
                  onChange={(e) => updateStickyNote(note.id, { text: e.target.value })}
                  style={{
                    width: '100%',
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    resize: 'none',
                    color: '#0f172a',
                    fontWeight: 600,
                    fontSize: note.text_size === 'lg' ? '1.15rem' : note.text_size === 'sm' ? '0.85rem' : '0.98rem',
                    fontFamily: 'inherit',
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {STICKY_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => updateStickyNote(note.id, { color: c.hex })}
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          background: c.hex,
                          border: note.color === c.hex ? '2px solid #0f172a' : '1px solid rgba(0,0,0,0.3)',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() =>
                        updateStickyNote(note.id, {
                          text_size: note.text_size === 'sm' ? 'md' : note.text_size === 'md' ? 'lg' : 'sm',
                        })
                      }
                      title="Change text size"
                      style={{
                        background: 'rgba(0,0,0,0.1)',
                        color: '#0f172a',
                        border: 'none',
                        borderRadius: 6,
                        padding: '2px 6px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                      }}
                    >
                      Aa
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteStickyNote(note.id)}
                      title="Delete note"
                      style={{
                        background: 'rgba(239,68,68,0.2)',
                        color: '#991b1b',
                        border: 'none',
                        borderRadius: 6,
                        padding: '2px 7px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
