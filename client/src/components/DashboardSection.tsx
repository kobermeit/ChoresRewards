import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { apiGet, apiPost, resolveAssetUrl, resolveAvatarUrl } from '../api';
import { DashboardStickyNote } from '../types';
import { SectionHelpTip } from './HelpTooltipAndView';
import { Button, Input } from './ui';

const STICKY_COLORS = ['#fef08a', '#fed7aa', '#bbf7d0', '#bae6fd', '#e9d5ff', '#fbcfe8'];

export const DashboardSection: React.FC = () => {
  const {
    data,
    refresh,
    scrollToSection,
    setSelectedChorePersonId,
    setScreensaverOpen,
    setVisualTimerOpen,
    openPlayGame,
    formatRewardValue,
    showToast,
    setActiveView,
  } = useApp();

  const [screensaverMedia, setScreensaverMedia] = useState<Array<{ filename: string; url: string; type: string }>>([]);
  const [photoIdx, setPhotoIdx] = useState(0);

  // Sticky note creation/editing state
  const [addingNote, setAddingNote] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteColor, setNewNoteColor] = useState(STICKY_COLORS[0]);

  useEffect(() => {
    apiGet<{ success: boolean; media: Array<{ filename: string; url: string; type: string }> }>('screensaver/config')
      .then((res) => {
        if (res?.media) {
          setScreensaverMedia(res.media.filter((m) => m.type === 'image'));
        }
      })
      .catch(() => {});
  }, []);

  if (!data) return null;

  const todayIso = data.current_date;
  const todayEvents = data.google_calendar?.today_events || [];
  const rawTodayMeals: any = data.meal_planner?.plan?.[todayIso];
  const todayMealCards: Array<{ label: string; name: string }> = Array.isArray(rawTodayMeals)
    ? rawTodayMeals.map((m: any) => ({
        label: m.audience && m.audience !== 'Everyone' ? m.audience : 'Dinner',
        name: m.title || '',
      })).filter((m) => m.name)
    : [
        rawTodayMeals?.breakfast ? { label: 'Breakfast', name: rawTodayMeals.breakfast } : null,
        rawTodayMeals?.lunch ? { label: 'Lunch', name: rawTodayMeals.lunch } : null,
        rawTodayMeals?.dinner ? { label: 'Dinner', name: rawTodayMeals.dinner } : null,
      ].filter(Boolean) as Array<{ label: string; name: string }>;

  const activeRewards = (data.rewards || [])
    .filter((r) => !r.completed)
    .sort((a, b) => b.points_required - a.points_required)
    .slice(0, 4);
  const stickyNotes: DashboardStickyNote[] = data.dashboard_notes || [];
  const currentPhoto = screensaverMedia.length > 0 ? screensaverMedia[photoIdx % screensaverMedia.length] : null;

  const handleAddStickyNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim() && !newNoteTitle.trim()) return;
    try {
      await apiPost('add_dashboard_note', {
        title: newNoteTitle.trim(),
        text: newNoteText.trim(),
        color: newNoteColor,
      });
      setNewNoteTitle('');
      setNewNoteText('');
      setAddingNote(false);
      await refresh();
    } catch (err: any) {
      showToast(err?.message || 'Failed to add sticky note', { type: 'error' });
    }
  };

  const handleDeleteStickyNote = async (id: string) => {
    try {
      await apiPost('delete_dashboard_note', { id });
      await refresh();
    } catch {
      // ignore
    }
  };

  return (
    <section className="rewards-section dashboard-section" id="dashboard-section">
      <h2 className="section-title dashboard-section-title">
        <i className="fas fa-gauge-high" style={{ color: '#38bdf8' }} /> <span>Today at a Glance</span>
        <SectionHelpTip
          title="Today at a Glance"
          tips={[
            "Tap any family member in Today's Tasks to open their full-screen Chore Grid.",
            'Tap Meals Today or Top Rewards to jump straight to that section.',
            'Use Arrange to customize tile sizes on your tablet.',
          ]}
        />
        <span className="dash-layout-actions">
          <button type="button" className="dash-arrange-btn" id="dash-arrange-btn" title="Rearrange and resize dashboard cards">
            <i className="fas fa-up-down-left-right" /> Arrange
          </button>
          <button type="button" className="dash-layout-reset-btn" id="dash-layout-reset-btn">
            Reset layout
          </button>
        </span>
      </h2>

      <div className="dashboard-grid" id="dashboard-grid">
        {/* 1. Today's Tasks */}
        <div
          className="dashboard-card dash-tile"
          data-dash-id="tasks"
          style={{ '--dash-cols': 4, '--dash-rows': 12 } as React.CSSProperties}
          onClick={() => {
            setSelectedChorePersonId(null);
            scrollToSection('kanban');
          }}
        >
          <h3 className="dashboard-card-title">
            <button type="button" className="dash-tile-handle" title="Drag to move" aria-label="Move Today's Tasks">
              <i className="fas fa-grip-vertical" />
            </button>
            <i className="fas fa-list-check" style={{ color: '#4ade80' }} /> Today&apos;s Tasks
          </h3>

          {data.family.map((person) => {
            const pChores = data.chores.filter((c) => c.assigned_to === person.name && !c.deleted);
            const incomplete = pChores.filter((c) => !c.completed);
            const done = pChores.filter((c) => c.completed);

            return (
              <div
                key={person.id}
                className="dash-person-row"
                style={{ cursor: 'pointer', borderRadius: 8, padding: '6px 6px' }}
                title={`View ${person.name}'s chores in full grid`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedChorePersonId(person.id);
                  scrollToSection('chores-section-root');
                }}
              >
                <img
                  className="dash-person-avatar"
                  src={resolveAvatarUrl(person.avatar)}
                  alt={person.name}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = resolveAvatarUrl(null);
                  }}
                />
                <div className="dash-person-info">
                  <div className="dash-person-name">{person.name}</div>
                  <div className="dash-person-chores">
                    {incomplete.length > 0
                      ? `${incomplete
                          .slice(0, 2)
                          .map((c) => c.title)
                          .join(', ')}${incomplete.length > 2 ? ` +${incomplete.length - 2} more` : ''}`
                      : done.length > 0
                        ? 'All done today! 🎉'
                        : 'No chores today'}
                  </div>
                </div>
                <span
                  className={`dash-person-badge${
                    done.length > 0 && incomplete.length === 0
                      ? ' dash-all-done'
                      : incomplete.length === 0
                        ? ' dash-free-day'
                        : ''
                  }`}
                >
                  {incomplete.length > 0 ? (
                    `${incomplete.length} left`
                  ) : done.length > 0 ? (
                    <i className="fas fa-check" />
                  ) : (
                    'Free'
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {/* 2. Meals Today */}
        <div
          className="dashboard-card dash-tile"
          data-dash-id="meals"
          style={{ '--dash-cols': 4, '--dash-rows': 8 } as React.CSSProperties}
          onClick={() => scrollToSection('meal-planner-section')}
        >
          <h3 className="dashboard-card-title">
            <button type="button" className="dash-tile-handle" title="Drag to move" aria-label="Move Meals Today">
              <i className="fas fa-grip-vertical" />
            </button>
            <i className="fas fa-utensils" style={{ color: '#fb923c' }} /> Meals Today
          </h3>
          {todayMealCards.map((m, idx) => (
            <div key={idx} className="dash-meal-row">
              <span className="dash-meal-label">{m.label}</span>
              <span className="dash-meal-name">{m.name}</span>
            </div>
          ))}
          {todayMealCards.length === 0 && (
            <p className="dash-empty-hint">No meals planned for today yet.</p>
          )}
        </div>

        {/* 3. What's on Today (Google Calendar) */}
        <div
          className="dashboard-card dash-tile"
          data-dash-id="calendar-today"
          style={{ '--dash-cols': 4, '--dash-rows': 8 } as React.CSSProperties}
          onClick={() => setActiveView('calendar')}
        >
          <h3 className="dashboard-card-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button type="button" className="dash-tile-handle" title="Drag to move" aria-label="Move What's on Today">
                <i className="fas fa-grip-vertical" />
              </button>
              <i className="fas fa-calendar-day" style={{ color: '#38bdf8' }} /> What&apos;s on Today
            </span>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 600 }}>
              Full &rarr;
            </span>
          </h3>

          {todayEvents.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 8px', textAlign: 'center', gap: 4 }}>
              <span style={{ fontSize: '1.6rem' }}>☀️</span>
              <p className="dash-empty-hint" style={{ margin: 0 }}>
                No events scheduled for today.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              {todayEvents.slice(0, 4).map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '6px 10px',
                    borderRadius: 8,
                    background: 'rgba(255, 255, 255, 0.04)',
                    borderLeft: `3px solid ${ev.color || '#38bdf8'}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: '1.1rem' }}>{ev.emoji || '📅'}</span>
                    <span
                      style={{
                        fontSize: '0.86rem',
                        fontWeight: 600,
                        color: '#f8fafc',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {ev.title}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: ev.all_day ? '#4ade80' : '#38bdf8',
                      background: 'rgba(0,0,0,0.25)',
                      padding: '2px 6px',
                      borderRadius: 4,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {ev.time_display || 'All Day'}
                  </span>
                </div>
              ))}
              {todayEvents.length > 4 && (
                <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600, textAlign: 'center' }}>
                  +{todayEvents.length - 4} more events on calendar
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. Top Rewards */}
        <div
          className="dashboard-card dash-tile"
          data-dash-id="rewards"
          style={{ '--dash-cols': 4, '--dash-rows': 9 } as React.CSSProperties}
          onClick={() => scrollToSection('rewards-section')}
        >
          <h3 className="dashboard-card-title">
            <button type="button" className="dash-tile-handle" title="Drag to move" aria-label="Move Top Rewards">
              <i className="fas fa-grip-vertical" />
            </button>
            <i className="fas fa-trophy" style={{ color: '#a78bfa' }} /> Top Rewards
          </h3>
          {activeRewards.length === 0 ? (
            <p className="dash-empty-hint">No rewards yet.</p>
          ) : (
            activeRewards.map((r) => (
              <div key={r.id} className="dash-reward-row">
                {r.image_url ? (
                  <img className="dash-reward-thumb" src={resolveAssetUrl(r.image_url)} alt="" />
                ) : (
                  <span
                    className="dash-reward-thumb"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <i className="fas fa-gift" style={{ color: '#a78bfa' }} />
                  </span>
                )}
                <span>{r.title}</span>
                <span className="dash-reward-points">{formatRewardValue(r.points_required)}</span>
              </div>
            ))
          )}
        </div>

        {/* 4. Family Photos */}
        <div
          className="dashboard-card dashboard-card-photos dash-tile"
          id="dash-photos-card"
          data-dash-id="photos"
          title="Tap a photo for full-screen slideshow"
          style={{ '--dash-cols': 4, '--dash-rows': 12 } as React.CSSProperties}
        >
          <h3 className="dashboard-card-title">
            <button type="button" className="dash-tile-handle" title="Drag to move" aria-label="Move Family Photos">
              <i className="fas fa-grip-vertical" />
            </button>
            <i className="fas fa-images" style={{ color: '#f472b6' }} /> Family Photos
          </h3>
          <div className="dash-photo-slideshow" id="dash-photo-slideshow">
            {currentPhoto ? (
              <>
                <img
                  src={resolveAssetUrl(currentPhoto.url)}
                  alt="Family"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10, cursor: 'pointer' }}
                  onClick={() => setScreensaverOpen(true)}
                />
                {screensaverMedia.length > 1 && (
                  <>
                    <button
                      type="button"
                      className="dash-photo-nav dash-photo-nav-prev"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPhotoIdx((prev) => (prev - 1 + screensaverMedia.length) % screensaverMedia.length);
                      }}
                    >
                      <i className="fas fa-chevron-left" />
                    </button>
                    <button
                      type="button"
                      className="dash-photo-nav dash-photo-nav-next"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPhotoIdx((prev) => (prev + 1) % screensaverMedia.length);
                      }}
                    >
                      <i className="fas fa-chevron-right" />
                    </button>
                  </>
                )}
              </>
            ) : (
              <p className="dash-empty-hint" id="dash-photo-empty">
                No photos yet — add some in Settings &rarr; Screensaver.
              </p>
            )}
          </div>
        </div>

        {/* 5. Compact Visual Timer */}
        <div
          className="dashboard-card dashboard-card-timer dash-tile"
          id="dashboard-timer-panel"
          data-dash-id="timer"
          style={{ '--dash-cols': 2, '--dash-rows': 8 } as React.CSSProperties}
        >
          <h3 className="dashboard-card-title">
            <button type="button" className="dash-tile-handle" title="Drag to move" aria-label="Move Visual Timer">
              <i className="fas fa-grip-vertical" />
            </button>
            <i className="fas fa-hourglass-half" style={{ color: '#f97316' }} /> Timer
          </h3>
          <button
            type="button"
            className="visual-timer-launcher"
            id="visual-timer-open"
            title="Open timer"
            aria-label="Open visual timer"
            onClick={() => setVisualTimerOpen(true)}
          >
            <svg className="visual-timer-mini-svg" viewBox="0 0 220 220" aria-hidden="true">
              <circle className="visual-timer-disc" cx="110" cy="110" r="100" />
              <path
                id="visual-timer-mini-pie"
                className="visual-timer-pie"
                fill="#ef4444"
                d="M 110 110 L 110 10 A 100 100 0 1 1 109.99 10 Z"
              />
              <circle className="visual-timer-hub" cx="110" cy="110" r="10" />
            </svg>
            <span className="visual-timer-mini-digits" id="visual-timer-mini-digits">
              05:00
            </span>
            <span className="visual-timer-mini-hint">Tap to open</span>
          </button>
        </div>

        {/* 6. Play — Maths, Colours, Patterns, Memory */}
        <div
          className="dashboard-card dashboard-card-play dash-tile"
          id="dashboard-play-panel"
          data-dash-id="play"
          style={{ '--dash-cols': 4, '--dash-rows': 11 } as React.CSSProperties}
        >
          <h3 className="dashboard-card-title">
            <button type="button" className="dash-tile-handle" title="Drag to move" aria-label="Move Play">
              <i className="fas fa-grip-vertical" />
            </button>
            <i className="fas fa-star" style={{ color: '#fbbf24' }} /> Play
          </h3>
          <div className="play-launch-row">
            <button
              type="button"
              className="play-launch play-launch-maths"
              id="play-open-maths"
              aria-label="Play maths"
              onClick={() => openPlayGame('maths')}
            >
              <span className="play-launch-mark" aria-hidden="true">
                ×
              </span>
              <span className="play-launch-label">Maths</span>
            </button>
            <button
              type="button"
              className="play-launch play-launch-colours"
              id="play-open-colours"
              aria-label="Play colours"
              onClick={() => openPlayGame('colours')}
            >
              <span className="play-launch-swatches" aria-hidden="true">
                <i style={{ background: '#ef4444' }} />
                <i style={{ background: '#facc15' }} />
                <i style={{ background: '#3b82f6' }} />
                <i style={{ background: '#22c55e' }} />
              </span>
              <span className="play-launch-label">Colours</span>
            </button>
            <button
              type="button"
              className="play-launch play-launch-patterns"
              id="play-open-patterns"
              aria-label="Play patterns"
              onClick={() => openPlayGame('patterns')}
            >
              <span className="play-launch-mark play-launch-mark-sm" aria-hidden="true">
                2 4 6
              </span>
              <span className="play-launch-label">Patterns</span>
            </button>
            <button
              type="button"
              className="play-launch play-launch-memory"
              id="play-open-memory"
              aria-label="Play memory"
              onClick={() => openPlayGame('memory')}
            >
              <span className="play-launch-cards" aria-hidden="true">
                <i />
                <i />
              </span>
              <span className="play-launch-label">Memory</span>
            </button>
          </div>
        </div>

        {/* 7. Sticky Notes */}
        <div
          className="dashboard-card dashboard-card-photos dashboard-card-notes dash-tile"
          id="dashboard-notes-panel"
          data-dash-id="notes"
          style={{ '--dash-cols': 12, '--dash-rows': 16 } as React.CSSProperties}
        >
          <h3 className="dashboard-card-title">
            <button type="button" className="dash-tile-handle" title="Drag to move" aria-label="Move Sticky Notes">
              <i className="fas fa-grip-vertical" />
            </button>
            <i className="fas fa-note-sticky" style={{ color: '#fbbf24' }} /> Sticky Notes
            <button
              type="button"
              className="dash-note-add-btn"
              id="dash-note-add-btn"
              title="Add note"
              onClick={() => setAddingNote((v) => !v)}
            >
              <i className="fas fa-plus" />
            </button>
          </h3>

          {addingNote && (
            <form
              onSubmit={handleAddStickyNote}
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                flexWrap: 'wrap',
                marginBottom: 12,
                padding: 10,
                borderRadius: 10,
                background: 'rgba(0,0,0,0.2)',
              }}
            >
              <div style={{ width: 160 }}>
                <Input
                  inputSize="sm"
                  type="text"
                  placeholder="Title (optional)"
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                />
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <Input
                  inputSize="sm"
                  type="text"
                  placeholder="Write a sticky note..."
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {STICKY_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewNoteColor(c)}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: c,
                      border: newNoteColor === c ? '2px solid #fff' : '1px solid rgba(0,0,0,0.3)',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
              <Button type="submit" variant="primary" size="sm">
                Post
              </Button>
            </form>
          )}

          <div className="dash-notes-grid" id="dash-notes-grid">
            {stickyNotes.length === 0 ? (
              <p className="dash-empty-hint">No notes yet — tap + to add one.</p>
            ) : (
              stickyNotes.map((n) => (
                <div
                  key={n.id}
                  style={{
                    background: n.color || '#fef08a',
                    color: '#1e293b',
                    padding: 14,
                    borderRadius: 10,
                    minWidth: 180,
                    position: 'relative',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleDeleteStickyNote(n.id)}
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 8,
                      background: 'none',
                      border: 'none',
                      color: '#475569',
                      cursor: 'pointer',
                    }}
                  >
                    ✕
                  </button>
                  {n.title && <div style={{ fontWeight: 800, marginBottom: 4 }}>{n.title}</div>}
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}>{n.text}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
