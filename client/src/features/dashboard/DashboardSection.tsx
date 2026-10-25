import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { apiPost } from '../../api';
import { DashboardStickyNote } from '../../types';
import { PageContainer, PillButton } from '../../components/ui';
import { useNavigation } from '../../hooks/useSettings';
import { FamilyTasksWidget } from './widgets/FamilyTasksWidget';
import { VisualTimerWidget } from './widgets/VisualTimerWidget';
import { PlannedMealsWidget } from './widgets/PlannedMealsWidget';
import { CalendarEventsWidget } from './widgets/CalendarEventsWidget';
import { ShoppingPreviewWidget } from './widgets/ShoppingPreviewWidget';
import { TopRewardsWidget } from './widgets/TopRewardsWidget';
import { PlayGamesWidget } from './widgets/PlayGamesWidget';
import { FamilyPhotosWidget } from './widgets/FamilyPhotosWidget';
import { StickyNotesWidget } from './widgets/StickyNotesWidget';

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
    timerTotalSeconds,
    timerRemainingSeconds,
    timerRunning,
    startTimer,
    pauseTimer,
    resetTimer,
  } = useApp();

  const { navigate } = useNavigation();
  const [dateFilter, setDateFilter] = useState<'today' | 'tomorrow' | 'week'>('today');

  const stickyNotes: DashboardStickyNote[] = data?.sticky_notes || [];

  const handleAddStickyNote = async (title: string, text: string, color: string) => {
    try {
      await apiPost('sticky_notes', { title, text, color });
      showToast('Pinned sticky note!');
      await refresh();
    } catch (err: any) {
      showToast(err?.message || 'Failed to pin note', { type: 'error' });
    }
  };

  const handleUpdateStickyNote = async (note: DashboardStickyNote) => {
    try {
      await apiPost(`sticky_notes/${note.id}`, {
        title: note.title,
        text: note.text,
        color: note.color,
      });
      showToast('Updated sticky note!');
      await refresh();
    } catch (err: any) {
      showToast(err?.message || 'Failed to update note', { type: 'error' });
    }
  };

  const handleDeleteStickyNote = async (id: number) => {
    try {
      await apiPost(`sticky_notes/${id}/delete`, {});
      showToast('Deleted note');
      await refresh();
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete note', { type: 'error' });
    }
  };

  // Timer calculations
  const timerPct = timerTotalSeconds > 0 ? timerRemainingSeconds / timerTotalSeconds : 0;
  const timerMinutes = Math.floor(timerRemainingSeconds / 60);
  const timerSeconds = timerRemainingSeconds % 60;
  const timerDigits = `${timerMinutes}:${timerSeconds.toString().padStart(2, '0')}`;
  const timerPieColor =
    timerPct > 0.5 ? '#10b981' : timerPct > 0.2 ? '#f59e0b' : '#ef4444';

  // Planned meals calculation
  const targetMealCards = useMemo(() => {
    const todayIso = data?.current_date || new Date().toISOString().slice(0, 10);
    const [tYear, tMonth, tDay] = todayIso.split('-').map(Number);
    const baseDate = new Date(tYear, tMonth - 1, tDay);
    const tomorrowDate = new Date(baseDate);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowIso = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`;

    const dateIso = dateFilter === 'tomorrow' ? tomorrowIso : todayIso;
    const plan = data?.meal_planner?.plan || {};
    const dayData = plan[dateIso];
    const list: Array<{ label: string; name: string }> = [];

    if (Array.isArray(dayData)) {
      dayData.forEach((c: any) => {
        list.push({ label: c.audience || 'Dinner', name: c.title || '' });
      });
    } else if (typeof dayData === 'object' && dayData !== null) {
      ['breakfast', 'lunch', 'dinner'].forEach((k) => {
        const v = (dayData[k] || '').trim();
        if (v) {
          list.push({ label: k.charAt(0).toUpperCase() + k.slice(1), name: v });
        }
      });
    }
    return list;
  }, [data?.current_date, data?.meal_planner?.plan, dateFilter]);

  // Calendar events calculation
  const filteredEvents = useMemo(() => {
    const todayIso = data?.current_date || new Date().toISOString().slice(0, 10);
    const [tYear, tMonth, tDay] = todayIso.split('-').map(Number);
    const baseDate = new Date(tYear, tMonth - 1, tDay);
    const tomorrowDate = new Date(baseDate);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowIso = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`;

    const events = data?.calendar_events || [];
    if (dateFilter === 'tomorrow') {
      return events.filter((e) => e.start_date_iso === tomorrowIso);
    }
    if (dateFilter === 'today') {
      return events.filter((e) => e.start_date_iso === todayIso);
    }
    return events.slice(0, 6);
  }, [data?.calendar_events, data?.current_date, dateFilter]);

  // Shopping preview - synchronize with ShoppingListSection (only count active general items + ingredients for active planned meals)
  const uncheckedShopping = useMemo(() => {
    const list: Array<{ name: string; qty?: string; store?: string }> = [];
    const shop = data?.shopping || data?.shopping_list;
    const ingMap = (data?.meal_planner?.ingredients || data?.meal_ingredients || {}) as Record<string, any>;
    const checked = (shop?.checked || {}) as Record<string, boolean>;
    const hidden = (shop?.hidden || {}) as Record<string, boolean>;

    // Build map of planned meals for this ACTIVE week only
    const activeDates = new Set<string>();
    (data?.meal_planner?.week_days || []).forEach((d: any) => {
      if (d?.date_str) activeDates.add(d.date_str);
    });

    const todayStr = data?.current_date || new Date().toISOString().slice(0, 10);
    const plannedMealsMap: Record<string, boolean> = {};
    const plan = data?.meal_planner?.plan || {};
    Object.entries(plan).forEach(([dateStr, daySlots]: [string, any]) => {
      // Only include today or upcoming dates (ignore past dates from earlier this week or previous weeks)
      if (dateStr < todayStr) return;
      if (activeDates.size > 0 && !activeDates.has(dateStr)) return;

      if (Array.isArray(daySlots)) {
        daySlots.forEach((c: any) => {
          if (c && (c.meal_key || c.title)) {
            const k = (c.meal_key || c.title).toLowerCase().trim();
            plannedMealsMap[k] = true;
          }
        });
      } else if (daySlots && typeof daySlots === 'object') {
        Object.values(daySlots).forEach((name: any) => {
          if (typeof name === 'string' && name.trim()) {
            plannedMealsMap[name.trim().toLowerCase()] = true;
          }
        });
      }
    });

    // 1. General items first (user's primary shopping list items)
    const generalList = Array.isArray(shop?.general) ? shop.general : [];
    generalList.forEach((g: any) => {
      if (!g || typeof g !== 'object' || !g.name) return;
      const k = `general::${String(g.name).toLowerCase()}`;
      if (!g.checked && !checked[k]) {
        list.push({ name: g.name, qty: g.qty, store: g.store });
      }
    });

    // 2. Meal ingredients only for active week's planned meals
    Object.entries(ingMap).forEach(([mealKey, ings]) => {
      if (!plannedMealsMap[mealKey.toLowerCase()]) return;
      const ingList: any[] = Array.isArray(ings) ? ings : ings && typeof ings === 'object' ? Object.values(ings) : [];
      ingList.forEach((i) => {
        if (!i || typeof i !== 'object' || !i.name) return;
        const k = `meal::${mealKey.toLowerCase()}::${String(i.name).toLowerCase()}`;
        if (!checked[k] && !hidden[k]) {
          list.push({ name: i.name, qty: i.qty, store: i.store });
        }
      });
    });

    return list;
  }, [data?.shopping, data?.shopping_list, data?.meal_planner?.plan, data?.meal_planner?.week_days, data?.meal_planner?.ingredients, data?.meal_ingredients]);

  const activeRewards = useMemo(() => {
    return (data?.rewards || []).filter((r) => !r.completed && !r.redeemed && !r.archived && !r.is_hidden).slice(0, 5);
  }, [data?.rewards]);

  if (!data) return null;

  const filterActionButtons = (
    <div className="dashboard-filter-pills" style={{ display: 'inline-flex', gap: 6 }}>
      {(['today', 'tomorrow', 'week'] as const).map((filterKey) => {
        const isSelected = dateFilter === filterKey;
        const labels = { today: 'Today', tomorrow: 'Tomorrow', week: 'This Week' };
        return (
          <PillButton
            key={filterKey}
            size="sm"
            selected={isSelected}
            onClick={() => setDateFilter(filterKey)}
          >
            {labels[filterKey]}
          </PillButton>
        );
      })}
    </div>
  );

  return (
    <PageContainer
      id="dashboard-section"
      title={
        dateFilter === 'today'
          ? 'Today at a Glance'
          : dateFilter === 'tomorrow'
          ? 'Tomorrow at a Glance'
          : 'This Week at a Glance'
      }
      icon="fas fa-gauge-high"
      iconClass="section-icon-dashboard"
      boxed={false}
      actions={filterActionButtons}
    >
      <div
        className="dashboard-tiles-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16,
          marginTop: 8,
          alignItems: 'stretch',
        }}
      >
        <FamilyTasksWidget
          dateFilter={dateFilter}
          family={data.family || []}
          chores={data.chores || []}
          onSelectPerson={(pid) => {
            setSelectedChorePersonId(pid);
            navigate('chores');
          }}
          onOpenChores={() => {
            setSelectedChorePersonId(null);
            navigate('chores');
          }}
        />

        <VisualTimerWidget
          timerPct={timerPct}
          timerPieColor={timerPieColor}
          timerDigits={timerDigits}
          timerRemainingSeconds={timerRemainingSeconds}
          timerRunning={timerRunning}
          onStart={startTimer}
          onPause={pauseTimer}
          onReset={resetTimer}
          onOpenModal={() => setVisualTimerOpen(true)}
        />

        <PlannedMealsWidget
          dateFilter={dateFilter}
          meals={targetMealCards}
          onOpenPlanner={() => navigate('meals')}
        />

        <CalendarEventsWidget
          dateFilter={dateFilter}
          events={filteredEvents}
          onOpenCalendar={() => navigate('calendar')}
        />

        <ShoppingPreviewWidget
          items={uncheckedShopping.slice(0, 5)}
          totalUnchecked={uncheckedShopping.length}
          stores={data.shopping_list?.stores || []}
          onOpenShopping={() => navigate('shopping')}
        />

        <TopRewardsWidget
          rewards={activeRewards}
          formatRewardValue={formatRewardValue}
          onOpenRewards={() => navigate('rewards')}
        />

        <PlayGamesWidget onOpenPlayGame={openPlayGame} />

        <FamilyPhotosWidget onOpenScreensaver={() => setScreensaverOpen(true)} />

        <StickyNotesWidget
          stickyNotes={stickyNotes}
          onAddNote={handleAddStickyNote}
          onUpdateNote={handleUpdateStickyNote}
          onDeleteNote={handleDeleteStickyNote}
        />
      </div>
    </PageContainer>
  );
};

export default DashboardSection;
