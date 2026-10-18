import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { apiGet, apiPost, resolveAssetUrl } from '../api';
import { DashboardStickyNote } from '../types';
import { PageContainer, Button, Input, UserAvatar } from './ui';

const STICKY_COLORS = ['#fef08a', '#fed7aa', '#bbf7d0', '#bae6fd', '#e9d5ff', '#fbcfe8'];

export const DashboardSection: React.FC = () => {
  const {
    data,
    refresh,
    setSelectedChorePersonId,
    setScreensaverOpen,
    setVisualTimerOpen,
    openPlayGame,
    formatRewardValue,
    showToast,
    setActiveView,
    timerTotalSeconds,
    timerRemainingSeconds,
    timerRunning,
    startTimer,
    pauseTimer,
    resetTimer,
  } = useApp();

  const [dateFilter, setDateFilter] = useState<'today' | 'tomorrow' | 'week'>('today');
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

  // Calculate target dates based on filter
  const todayIso = data.current_date || new Date().toISOString().slice(0, 10);
  const [tYear, tMonth, tDay] = todayIso.split('-').map(Number);
  const baseDate = new Date(tYear, tMonth - 1, tDay);

  const tomorrowDate = new Date(baseDate);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowIso = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`;

  // Monday-first week calculations (Monday = 0, Sunday = 6)
  const dayIndex = (baseDate.getDay() + 6) % 7;
  const mondayDate = new Date(baseDate);
  mondayDate.setDate(mondayDate.getDate() - dayIndex);
  const mondayIso = `${mondayDate.getFullYear()}-${String(mondayDate.getMonth() + 1).padStart(2, '0')}-${String(mondayDate.getDate()).padStart(2, '0')}`;

  const sundayDate = new Date(mondayDate);
  sundayDate.setDate(sundayDate.getDate() + 6);
  const sundayIso = `${sundayDate.getFullYear()}-${String(sundayDate.getMonth() + 1).padStart(2, '0')}-${String(sundayDate.getDate()).padStart(2, '0')}`;

  const selectedIso = dateFilter === 'tomorrow' ? tomorrowIso : todayIso;

  // Calendar events filtered
  const allEvents = data.google_calendar?.events || [];
  const todayEvents = data.google_calendar?.today_events || [];
  const filteredEvents = dateFilter === 'today'
    ? todayEvents
    : dateFilter === 'tomorrow'
    ? allEvents.filter((ev) => ev.start_date_iso === tomorrowIso)
    : allEvents.filter((ev) => {
        const d = ev.start_date_iso;
        return d && d >= mondayIso && d <= sundayIso;
      });

  // Meals for selected date / period
  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  let targetMealCards: Array<{ label: string; name: string }> = [];

  if (dateFilter === 'week') {
    const weekMeals: Array<{ label: string; name: string }> = [];
    const cur = new Date(mondayDate);
    for (let i = 0; i < 7; i++) {
      const dIso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
      const dayLabel = DAY_NAMES[i];
      const dayPlan = data.meal_planner?.plan?.[dIso];
      if (Array.isArray(dayPlan)) {
        dayPlan.forEach((m: any) => {
          if (m?.title) {
            weekMeals.push({
              label: `${dayLabel} ${m.audience && m.audience !== 'Everyone' ? m.audience : 'Dinner'}`,
              name: m.title,
            });
          }
        });
      } else if (dayPlan && typeof dayPlan === 'object') {
        if (dayPlan.dinner) weekMeals.push({ label: `${dayLabel} Dinner`, name: dayPlan.dinner });
        else if (dayPlan.lunch) weekMeals.push({ label: `${dayLabel} Lunch`, name: dayPlan.lunch });
        else if (dayPlan.breakfast) weekMeals.push({ label: `${dayLabel} Breakfast`, name: dayPlan.breakfast });
      }
      cur.setDate(cur.getDate() + 1);
    }
    targetMealCards = weekMeals.slice(0, 5);
  } else {
    const rawTargetMeals: any = data.meal_planner?.plan?.[selectedIso];
    targetMealCards = Array.isArray(rawTargetMeals)
      ? rawTargetMeals
          .map((m: any) => ({
            label: m.audience && m.audience !== 'Everyone' ? m.audience : 'Dinner',
            name: m.title || '',
          }))
          .filter((m) => m.name)
      : [
          rawTargetMeals?.breakfast ? { label: 'Breakfast', name: rawTargetMeals.breakfast } : null,
          rawTargetMeals?.lunch ? { label: 'Lunch', name: rawTargetMeals.lunch } : null,
          rawTargetMeals?.dinner ? { label: 'Dinner', name: rawTargetMeals.dinner } : null,
        ].filter(Boolean) as Array<{ label: string; name: string }>;
  }

  const activeRewards = (data.rewards || [])
    .filter((r) => !r.completed)
    .sort((a, b) => b.points_required - a.points_required)
    .slice(0, 4);

  const stickyNotes: DashboardStickyNote[] = data.dashboard_notes || [];
  const currentPhoto = screensaverMedia.length > 0 ? screensaverMedia[photoIdx % screensaverMedia.length] : null;

  // General Shopping list preview (first 8 unchecked items)
  const uncheckedShopping = (data.shopping?.general || []).filter((g) => {
    const itemKey = `general::${g.name.toLowerCase()}`;
    return !g.checked && !data.shopping?.checked?.[itemKey];
  });
  const previewShoppingItems = uncheckedShopping.slice(0, 8);

  const handleToggleShopItem = async (g: { name: string; id?: string }) => {
    const itemKey = `general::${g.name.toLowerCase()}`;
    try {
      await apiPost('update_shopping_item', {
        key: itemKey,
        checked: true,
      });
      await refresh();
    } catch {
      // ignore
    }
  };

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

  // Timer calculations
  const timerMins = Math.floor(timerRemainingSeconds / 60);
  const timerSecs = timerRemainingSeconds % 60;
  const timerDigits = `${String(timerMins).padStart(2, '0')}:${String(timerSecs).padStart(2, '0')}`;
  const timerPct = timerTotalSeconds > 0 ? timerRemainingSeconds / timerTotalSeconds : 0;
  const timerPieColor = timerPct > 0.5 ? '#22c55e' : timerPct > 0.2 ? '#f59e0b' : '#ef4444';

  const describeArc = (x: number, y: number, radius: number, fraction: number) => {
    if (fraction <= 0) return '';
    if (fraction >= 0.999) return `M ${x} ${y} m -${radius}, 0 a ${radius},${radius} 0 1,0 ${radius * 2},0 a ${radius},${radius} 0 1,0 -${radius * 2},0`;
    const angle = fraction * 2 * Math.PI;
    const endX = x + radius * Math.sin(angle);
    const endY = y - radius * Math.cos(angle);
    const largeArcFlag = fraction > 0.5 ? 1 : 0;
    return `M ${x} ${y} L ${x} ${y - radius} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
  };

  const filterActionButtons = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Button
        variant={dateFilter === 'today' ? 'primary' : 'secondary'}
        size="sm"
        icon="fas fa-calendar-day"
        onClick={() => setDateFilter('today')}
      >
        Today
      </Button>
      <Button
        variant={dateFilter === 'tomorrow' ? 'primary' : 'secondary'}
        size="sm"
        icon="fas fa-calendar-plus"
        onClick={() => setDateFilter('tomorrow')}
      >
        Tomorrow
      </Button>
      <Button
        variant={dateFilter === 'week' ? 'primary' : 'secondary'}
        size="sm"
        icon="fas fa-calendar-week"
        onClick={() => setDateFilter('week')}
      >
        This Week
      </Button>
    </div>
  );

  return (
    <PageContainer
      id="dashboard-section"
      title={dateFilter === 'today' ? 'Today at a Glance' : dateFilter === 'tomorrow' ? 'Tomorrow at a Glance' : 'This Week at a Glance'}
      icon="fas fa-gauge-high"
      iconClass="section-icon-dashboard"
      boxed={false}
      actions={filterActionButtons}
      helpTip={{
        title: 'Today at a Glance',
        tips: [
          "Tap any family member in Today's Tasks to open their chore list.",
          'Tap Meals, Shopping, or Top Rewards to jump directly to those pages.',
          'Start or pause the visual timer right from the tile or tap to open full controls.',
        ],
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16,
          marginTop: 8,
          alignItems: 'stretch',
        }}
      >
        {/* 1. Tasks Card */}
        <div
          className="dashboard-card"
          style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12 }}
          onClick={() => {
            setSelectedChorePersonId(null);
            setActiveView('chores');
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 className="dashboard-card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fas fa-list-check" style={{ color: '#4ade80' }} />
              <span>{dateFilter === 'tomorrow' ? "Tomorrow's Tasks" : dateFilter === 'week' ? "This Week's Tasks" : "Today's Tasks"}</span>
            </h3>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>Chores &rarr;</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.family.map((person) => {
              const pChores = data.chores.filter((c) => c.assigned_to === person.name && !c.deleted);
              const incomplete = pChores.filter((c) => !c.completed);
              const done = pChores.filter((c) => c.completed);

              return (
                <div
                  key={person.id}
                  className="dash-person-row"
                  style={{
                    cursor: 'pointer',
                    borderRadius: 10,
                    padding: '8px 10px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                  title={`View ${person.name}'s chores`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedChorePersonId(person.id);
                    setActiveView('chores');
                  }}
                >
                  <UserAvatar
                    avatar={person.avatar}
                    name={person.name}
                    color={person.accent_color}
                    size={38}
                    borderWidth={2}
                  />
                  <div className="dash-person-info" style={{ flex: 1, minWidth: 0 }}>
                    <div className="dash-person-name" style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                      {person.name}
                    </div>
                    <div
                      className="dash-person-chores"
                      style={{ fontSize: '0.78rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {incomplete.length > 0
                        ? `${incomplete.slice(0, 2).map((c) => c.title).join(', ')}${incomplete.length > 2 ? ` +${incomplete.length - 2} more` : ''}`
                        : done.length > 0
                        ? 'All done today! 🎉'
                        : 'No chores'}
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
        </div>

        {/* 2. Visual Timer Tile */}
        <div
          className="dashboard-card dashboard-card-timer"
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 className="dashboard-card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fas fa-hourglass-half" style={{ color: '#f97316' }} />
              <span>Visual Timer</span>
            </h3>
            {timerRunning && (
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#22c55e',
                  background: 'rgba(34, 197, 94, 0.15)',
                  padding: '2px 8px',
                  borderRadius: 999,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', animation: 'pulse 1.5s infinite' }} />
                Ticking
              </span>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '12px 0 6px',
            }}
          >
            <div
              style={{ cursor: 'pointer', textAlign: 'center' }}
              onClick={() => setVisualTimerOpen(true)}
              title="Click to open full timer modal"
            >
              <svg className="visual-timer-mini-svg" viewBox="0 0 220 220" aria-hidden="true" style={{ width: 96, height: 96 }}>
                <circle className="visual-timer-disc" cx="110" cy="110" r="100" />
                <path
                  className="visual-timer-pie"
                  fill={timerPieColor}
                  d={describeArc(110, 110, 100, timerPct)}
                />
                <circle className="visual-timer-hub" cx="110" cy="110" r="10" />
              </svg>

              <div
                className="visual-timer-mini-digits"
                style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: 4 }}
              >
                {timerDigits}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              {timerRunning ? (
                <Button size="sm" variant="secondary" onClick={pauseTimer}>
                  <i className="fas fa-pause" /> Pause
                </Button>
              ) : (
                <Button size="sm" variant="primary" onClick={startTimer}>
                  <i className="fas fa-play" /> Start
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={resetTimer}>
                <i className="fas fa-rotate-left" /> Reset
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setVisualTimerOpen(true)}>
                <i className="fas fa-expand" /> Full
              </Button>
            </div>
          </div>
        </div>

        {/* 3. Meals Card */}
        <div
          className="dashboard-card"
          style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12 }}
          onClick={() => setActiveView('meals')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 className="dashboard-card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fas fa-utensils" style={{ color: '#fb923c' }} />
              <span>{dateFilter === 'tomorrow' ? 'Meals Tomorrow' : dateFilter === 'week' ? 'Meals This Week' : 'Meals Today'}</span>
            </h3>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>Planner &rarr;</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {targetMealCards.map((m, idx) => (
              <div
                key={idx}
                className="dash-meal-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'rgba(255, 255, 255, 0.04)',
                }}
              >
                <span className="dash-meal-label" style={{ fontWeight: 700, fontSize: '0.82rem', color: '#fb923c' }}>
                  {m.label}
                </span>
                <span className="dash-meal-name" style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                  {m.name}
                </span>
              </div>
            ))}
            {targetMealCards.length === 0 && (
              <p className="dash-empty-hint" style={{ textAlign: 'center', margin: '14px 0' }}>
                No meals planned for {dateFilter === 'tomorrow' ? 'tomorrow' : 'today'} yet.
              </p>
            )}
          </div>
        </div>

        {/* 4. Calendar Events Card */}
        <div
          className="dashboard-card"
          style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12 }}
          onClick={() => setActiveView('calendar')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 className="dashboard-card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fas fa-calendar-day" style={{ color: '#38bdf8' }} />
              <span>{dateFilter === 'tomorrow' ? "What's on Tomorrow" : dateFilter === 'week' ? "What's on This Week" : "What's on Today"}</span>
            </h3>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>Calendar &rarr;</span>
          </div>

          {filteredEvents.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 8px', textAlign: 'center', gap: 4 }}>
              <span style={{ fontSize: '1.6rem' }}>☀️</span>
              <p className="dash-empty-hint" style={{ margin: 0 }}>
                No events scheduled for {dateFilter}.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredEvents.slice(0, 4).map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '8px 10px',
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
              {filteredEvents.length > 4 && (
                <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600, textAlign: 'center' }}>
                  +{filteredEvents.length - 4} more events on calendar
                </div>
              )}
            </div>
          )}
        </div>

        {/* 5. Shopping List Preview Card */}
        <div
          className="dashboard-card"
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3
              className="dashboard-card-title"
              style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
              onClick={() => setActiveView('shopping')}
            >
              <i className="fas fa-cart-shopping" style={{ color: '#38bdf8' }} />
              <span>Shopping List</span>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#38bdf8',
                  background: 'rgba(56, 189, 248, 0.15)',
                  padding: '2px 8px',
                  borderRadius: 999,
                }}
              >
                {uncheckedShopping.length} left
              </span>
            </h3>
            <span
              style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, cursor: 'pointer' }}
              onClick={() => setActiveView('shopping')}
            >
              Full List &rarr;
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {previewShoppingItems.length === 0 ? (
              <p className="dash-empty-hint" style={{ textAlign: 'center', margin: '14px 0' }}>
                Shopping list is all clear! 🎉
              </p>
            ) : (
              previewShoppingItems.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: 8,
                    background: 'rgba(255, 255, 255, 0.04)',
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1, minWidth: 0 }}>
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => handleToggleShopItem(item)}
                      style={{ cursor: 'pointer', width: 16, height: 16, accentColor: '#38bdf8' }}
                    />
                    <span
                      style={{
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        color: '#f8fafc',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.name}
                    </span>
                    {item.qty && (
                      <span style={{ fontSize: '0.76rem', color: '#94a3b8', fontWeight: 500 }}>
                        ({item.qty})
                      </span>
                    )}
                  </label>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: 'rgba(255, 255, 255, 0.5)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {item.store}
                  </span>
                </div>
              ))
            )}
            {uncheckedShopping.length > 8 && (
              <div
                style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600, textAlign: 'center', cursor: 'pointer', marginTop: 4 }}
                onClick={() => setActiveView('shopping')}
              >
                +{uncheckedShopping.length - 8} more items on shopping list
              </div>
            )}
          </div>
        </div>

        {/* 6. Top Rewards */}
        <div
          className="dashboard-card"
          style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12 }}
          onClick={() => setActiveView('rewards')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 className="dashboard-card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fas fa-trophy" style={{ color: '#a78bfa' }} />
              <span>Top Rewards</span>
            </h3>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>Rewards &rarr;</span>
          </div>

          {activeRewards.length === 0 ? (
            <p className="dash-empty-hint" style={{ textAlign: 'center', margin: '14px 0' }}>
              No rewards yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {activeRewards.map((r) => (
                <div
                  key={r.id}
                  className="dash-reward-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '6px 10px',
                    borderRadius: 8,
                    background: 'rgba(255, 255, 255, 0.04)',
                  }}
                >
                  {r.image_url ? (
                    <img className="dash-reward-thumb" src={resolveAssetUrl(r.image_url)} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} />
                  ) : (
                    <span
                      className="dash-reward-thumb"
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: 'rgba(167, 139, 250, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <i className="fas fa-gift" style={{ color: '#a78bfa', fontSize: '0.85rem' }} />
                    </span>
                  )}
                  <span style={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.title}
                  </span>
                  <span className="dash-reward-points" style={{ fontWeight: 800, color: '#facc15', fontSize: '0.85rem' }}>
                    {formatRewardValue(r.points_required)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 7. Play — Maths, Colours, Patterns, Memory */}
        <div
          className="dashboard-card dashboard-card-play"
          id="dashboard-play-panel"
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <h3 className="dashboard-card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fas fa-star" style={{ color: '#fbbf24' }} />
            <span>Play Games</span>
          </h3>
          <div className="play-launch-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            <button
              type="button"
              className="play-launch play-launch-maths"
              id="play-open-maths"
              aria-label="Play maths"
              onClick={() => openPlayGame('maths')}
            >
              <span className="play-launch-mark" aria-hidden="true">×</span>
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
              <span className="play-launch-mark play-launch-mark-sm" aria-hidden="true">2 4 6</span>
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

        {/* 8. Family Photos */}
        <div
          className="dashboard-card dashboard-card-photos"
          id="dash-photos-card"
          title="Tap photo for slideshow"
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <h3 className="dashboard-card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fas fa-images" style={{ color: '#f472b6' }} />
            <span>Family Photos</span>
          </h3>
          <div className="dash-photo-slideshow" id="dash-photo-slideshow" style={{ height: 200, position: 'relative' }}>
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
              <p className="dash-empty-hint" id="dash-photo-empty" style={{ textAlign: 'center', padding: '40px 0' }}>
                No photos yet — add some in Settings &rarr; Screensaver.
              </p>
            )}
          </div>
        </div>

        {/* 9. Sticky Notes */}
        <div
          className="dashboard-card dashboard-card-notes"
          id="dashboard-notes-panel"
          style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 className="dashboard-card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fas fa-note-sticky" style={{ color: '#fbbf24' }} />
              <span>Sticky Notes</span>
            </h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAddingNote((v) => !v)}
            >
              <i className="fas fa-plus" /> Add Note
            </Button>
          </div>

          {addingNote && (
            <form
              onSubmit={handleAddStickyNote}
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                flexWrap: 'wrap',
                padding: 12,
                borderRadius: 10,
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
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
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {STICKY_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewNoteColor(c)}
                    style={{
                      width: 24,
                      height: 24,
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

          <div
            className="dash-notes-grid"
            id="dash-notes-grid"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}
          >
            {stickyNotes.length === 0 ? (
              <p className="dash-empty-hint">No notes yet — tap &lsquo;Add Note&rsquo; to pin one here.</p>
            ) : (
              stickyNotes.map((n) => (
                <div
                  key={n.id}
                  style={{
                    background: n.color || '#fef08a',
                    color: '#1e293b',
                    padding: 14,
                    borderRadius: 10,
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
                      fontSize: '0.9rem',
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
    </PageContainer>
  );
};
