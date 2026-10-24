import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { apiGet, apiPost } from '../../api';
import { RecipeItem } from '../../types';
import { PageContainer, Button } from '../../components/ui';
import { useUiPref } from '../../hooks/useSettings';
import { DayInfo, formatWeekRangeLabel, shiftWeekIso, computeWeekDays } from './mealUtils';
import { MealDayColumn } from './components/MealDayColumn';
import { PlanMealModal } from './components/PlanMealModal';

export interface MealPlannerSectionProps {
  isStandalonePage?: boolean;
  onOpenRecipeModal?: (card: { title: string; meal_key?: string; id?: string }, dateIso?: string) => void;
}

export const MealPlannerSection: React.FC<MealPlannerSectionProps> = ({
  isStandalonePage = false,
  onOpenRecipeModal,
}) => {
  const { data, showToast, isChild } = useApp();

  const [plannerViewMode, setPlannerViewMode] = useUiPref('plannerViewMode');
  const [activeWeekStart, setActiveWeekStart] = useState<string>('');
  const [weekDaysState, setWeekDaysState] = useState<DayInfo[]>([]);
  const [weekPlanState, setWeekPlanState] = useState<Record<string, any>>({});
  const [navLoading, setNavLoading] = useState(false);
  const weekCacheRef = useRef<Record<string, { week_days: DayInfo[]; plan: Record<string, any> }>>({});

  // Plan meal modal state
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planMealTitle, setPlanMealTitle] = useState('');
  const [planAudience, setPlanAudience] = useState('Everyone');
  const [planSelectedDays, setPlanSelectedDays] = useState<string[]>([]);
  const [planAddShopping, setPlanAddShopping] = useState(true);
  const [draggedSlot, setDraggedSlot] = useState<{ dateIso: string; mealKey: string } | null>(null);

  const mp = data?.meal_planner;
  const currentWeekStart = activeWeekStart || mp?.week_start || '';

  useEffect(() => {
    if (mp) {
      weekCacheRef.current[mp.week_start] = {
        week_days: mp.week_days || [],
        plan: mp.plan || {},
      };
      if (!activeWeekStart) {
        setActiveWeekStart(mp.week_start);
        setWeekDaysState(mp.week_days || []);
        setWeekPlanState(mp.plan || {});
      } else if (activeWeekStart === mp.week_start) {
        setWeekDaysState(mp.week_days || []);
        setWeekPlanState(mp.plan || {});
      }
    }
  }, [mp, activeWeekStart]);

  useEffect(() => {
    if (plannerViewMode === '2weeks' && currentWeekStart) {
      const nextWeekStart = shiftWeekIso(currentWeekStart, 7);
      if (!weekCacheRef.current[nextWeekStart]) {
        apiGet<{ success: boolean; week_start: string; week_days: any[]; plan: Record<string, any> }>(
          `meal_planner?week=${encodeURIComponent(nextWeekStart)}`
        )
          .then((res) => {
            if (res && res.success) {
              weekCacheRef.current[nextWeekStart] = {
                week_days: res.week_days || computeWeekDays(nextWeekStart),
                plan: res.plan || {},
              };
              setWeekPlanState((prev) => ({ ...prev, ...(res.plan || {}) }));
            }
          })
          .catch(() => {});
      } else {
        setWeekPlanState((prev) => ({
          ...prev,
          ...(weekCacheRef.current[nextWeekStart]?.plan || {}),
        }));
      }
    }
  }, [plannerViewMode, currentWeekStart]);

  const handleNavigateWeek = async (deltaDays: number) => {
    const nextWeekStart = shiftWeekIso(currentWeekStart, deltaDays);
    const cached = weekCacheRef.current[nextWeekStart];
    if (cached) {
      setActiveWeekStart(nextWeekStart);
      setWeekDaysState(cached.week_days);
      setWeekPlanState((prev) => ({ ...prev, ...cached.plan }));
    } else {
      setNavLoading(true);
      try {
        const res = await apiGet<{ success: boolean; week_start: string; week_days: any[]; plan: Record<string, any> }>(
          `meal_planner?week=${encodeURIComponent(nextWeekStart)}`
        );
        if (res && res.success) {
          const fetchedDays = res.week_days || computeWeekDays(nextWeekStart);
          const fetchedPlan = res.plan || {};
          weekCacheRef.current[nextWeekStart] = { week_days: fetchedDays, plan: fetchedPlan };
          setActiveWeekStart(nextWeekStart);
          setWeekDaysState(fetchedDays);
          setWeekPlanState((prev) => ({ ...prev, ...fetchedPlan }));
        }
      } catch {
        const fallbackDays = computeWeekDays(nextWeekStart);
        setActiveWeekStart(nextWeekStart);
        setWeekDaysState(fallbackDays);
      } finally {
        setNavLoading(false);
      }
    }
  };

  const handlePostMutationRefresh = async () => {
    try {
      const w1 = currentWeekStart;
      const w2 = shiftWeekIso(currentWeekStart, 7);
      delete weekCacheRef.current[w1];
      delete weekCacheRef.current[w2];
      const weeksToFetch = [w1];
      if (plannerViewMode === '2weeks') weeksToFetch.push(w2);

      const results = await Promise.all(
        weeksToFetch.map((w) =>
          apiGet<{ success: boolean; week_start: string; week_days: any[]; plan: Record<string, any> }>(
            `meal_planner?week=${encodeURIComponent(w)}`
          ).catch(() => null)
        )
      );

      const mergedPlan: Record<string, any> = {};
      results.forEach((res) => {
        if (res && res.success) {
          weekCacheRef.current[res.week_start] = {
            week_days: res.week_days || computeWeekDays(res.week_start),
            plan: res.plan || {},
          };
          Object.assign(mergedPlan, res.plan || {});
        }
      });
      if (results[0]?.week_days) {
        setWeekDaysState(results[0].week_days);
      }
      setWeekPlanState((prev) => ({ ...prev, ...mergedPlan }));
    } catch {
      // ignore
    }
  };

  const weekDays = weekDaysState.length > 0 ? weekDaysState : computeWeekDays(currentWeekStart);
  const plan = weekPlanState;

  const totalMealsPlanned = useMemo(() => {
    let count = 0;
    Object.values(plan).forEach((daySlots: any) => {
      if (!daySlots) return;
      if (Array.isArray(daySlots)) {
        count += daySlots.length;
      } else if (typeof daySlots === 'object') {
        ['breakfast', 'lunch', 'dinner'].forEach((k) => {
          if ((daySlots[k] || '').trim()) count++;
        });
      }
    });
    return count;
  }, [plan]);

  const allSuggestionsPool = useMemo(() => {
    const suggestions: string[] = [];
    const rawSugg = data?.meal_suggestions || data?.meal_planner?.suggestions;
    const suggList: any[] = Array.isArray(rawSugg) ? rawSugg : rawSugg && typeof rawSugg === 'object' ? Object.values(rawSugg) : [];
    suggList.forEach((s: any) => {
      const name = typeof s === 'string' ? s : s?.meal || s?.name;
      if (name && !suggestions.includes(name)) suggestions.push(name);
    });
    return suggestions;
  }, [data?.meal_suggestions, data?.meal_planner?.suggestions]);

  const allLibraryRecipes: RecipeItem[] = useMemo(() => {
    return Array.isArray(data?.recipes) ? data.recipes : [];
  }, [data?.recipes]);

  const recipesRecord: Record<string, RecipeItem> = useMemo(() => {
    const map: Record<string, RecipeItem> = {};
    allLibraryRecipes.forEach((r) => {
      if (r.meal_key) map[r.meal_key.toLowerCase()] = r;
      if (r.title) map[r.title.toLowerCase()] = r;
    });
    return map;
  }, [allLibraryRecipes]);

  const mealImages: Record<string, string> = data?.meal_images || {};

  const handleOpenAddMealModal = (defaultDateIso: string) => {
    setPlanMealTitle('');
    setPlanAudience('Everyone');
    setPlanSelectedDays([defaultDateIso]);
    const diffDays = Math.round(
      (new Date(`${defaultDateIso}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24)
    );
    setPlanAddShopping(diffDays >= 0 && diffDays <= 7);
    setPlanModalOpen(true);
  };

  const handleSuggestionClick = (dateIso: string, suggestedTitle: string) => {
    setPlanMealTitle(suggestedTitle);
    setPlanAudience('Everyone');
    setPlanSelectedDays([dateIso]);
    const diffDays = Math.round(
      (new Date(`${dateIso}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24)
    );
    setPlanAddShopping(diffDays >= 0 && diffDays <= 7);
    setPlanModalOpen(true);
  };

  const handleSaveMealCard = async () => {
    const title = planMealTitle.trim();
    if (!title || planSelectedDays.length === 0) return;
    try {
      await apiPost('meal_planner/card/save', {
        title,
        audience: planAudience,
        days: planSelectedDays,
        add_to_shopping: planAddShopping,
      });
      showToast(`Planned "${title}" for ${planSelectedDays.length} day(s)!`);
      setPlanModalOpen(false);
      await handlePostMutationRefresh();
    } catch (err: any) {
      showToast(err?.message || 'Failed to save meal plan', { type: 'error' });
    }
  };

  const handleDropMeal = async (toDateIso: string) => {
    if (draggedSlot) {
      try {
        await apiPost('meal_planner/card/move', {
          card_id: draggedSlot.mealKey,
          from_date_iso: draggedSlot.dateIso,
          to_date_iso: toDateIso,
        });
        setDraggedSlot(null);
        await handlePostMutationRefresh();
      } catch {
        // ignore
      }
    }
  };

  const isThisWeek = currentWeekStart === mp?.week_start;
  const week1Days = weekDays.slice(0, 7);
  const week2StartIso = shiftWeekIso(currentWeekStart, 7);
  const week2Days = computeWeekDays(week2StartIso);

  const getDayCards = (dateIso: string): any[] => {
    const raw = plan[dateIso];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'object' && raw !== null) {
      return Object.entries(raw)
        .filter(([, v]) => Boolean(v))
        .map(([k, v]) => ({
          id: `${dateIso}_${k}`,
          title: String(v),
          audience: 'Everyone',
          meal_key: String(v).toLowerCase(),
        }));
    }
    return [];
  };

  return (
    <PageContainer
      title="Weekly Meal Planner"
      icon="fas fa-utensils"
      iconClass="section-icon-meals"
      badge={`${totalMealsPlanned} planned`}
      boxed={!isStandalonePage}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* 1 Week vs 2 Weeks View Mode Toggle */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 'var(--radius-pill, 999px)',
              padding: 2,
            }}
          >
            <button
              type="button"
              onClick={() => setPlannerViewMode('1week')}
              style={{
                padding: '4px 12px',
                borderRadius: 'var(--radius-pill, 999px)',
                border: 'none',
                background: plannerViewMode === '1week' ? 'var(--color-primary, #3b82f6)' : 'transparent',
                color: plannerViewMode === '1week' ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              1 Week
            </button>
            <button
              type="button"
              onClick={() => setPlannerViewMode('2weeks')}
              style={{
                padding: '4px 12px',
                borderRadius: 'var(--radius-pill, 999px)',
                border: 'none',
                background: plannerViewMode === '2weeks' ? 'var(--color-primary, #3b82f6)' : 'transparent',
                color: plannerViewMode === '2weeks' ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              2 Weeks
            </button>
          </div>

          {/* Prev / Range / Next Controls */}
          <div className="meal-week-nav" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Button
              variant="secondary"
              size="sm"
              icon="fas fa-chevron-left"
              onClick={() => handleNavigateWeek(plannerViewMode === '2weeks' ? -14 : -7)}
            >
              Prev
            </Button>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 200, gap: 8 }}>
              <span className="meal-week-nav-label" style={{ flex: 'none', margin: 0 }}>
                {formatWeekRangeLabel(currentWeekStart, plannerViewMode === '2weeks' ? 2 : 1)}
              </span>
              {isThisWeek ? (
                <span className="meal-this-week-badge" id="meal-this-week-badge">
                  Current
                </span>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  style={{ fontSize: '0.72rem', height: 22, padding: '0 8px', borderRadius: 'var(--radius-pill)' }}
                  onClick={() => {
                    if (mp?.week_start) {
                      const target = mp.week_start;
                      const cached = weekCacheRef.current[target];
                      setActiveWeekStart(target);
                      if (cached) {
                        setWeekDaysState(cached.week_days);
                        setWeekPlanState(cached.plan);
                      } else {
                        setWeekDaysState(mp.week_days || computeWeekDays(target));
                        setWeekPlanState(mp.plan || {});
                      }
                    }
                  }}
                >
                  Current
                </Button>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon="fas fa-chevron-right"
              iconPosition="right"
              onClick={() => handleNavigateWeek(plannerViewMode === '2weeks' ? 14 : 7)}
            >
              Next
            </Button>
            {navLoading && (
              <span className="meal-nav-spinner" style={{ width: 14 }}>
                <i className="fas fa-spinner fa-spin" />
              </span>
            )}
          </div>
        </div>
      }
    >
      {plannerViewMode === '2weeks' ? (
        <div className="meal-week-display-2weeks">
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#93c5fd', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>📅 Week 1: {formatWeekRangeLabel(currentWeekStart, 1)}</span>
            </div>
            <div id="meal-planner-editable-w1" className="meal-week-display">
              {week1Days.map((d) => {
                const dayNum = parseInt(d.date_iso.replace(/-/g, ''), 10) || 0;
                const pool = allSuggestionsPool.length > 0 ? allSuggestionsPool : ['Pizza', 'Tacos', 'Burgers', 'Pasta'];
                const suggestedTitle = pool[dayNum % pool.length];
                return (
                  <MealDayColumn
                    key={d.date_iso}
                    day={d}
                    isToday={d.date_iso === data?.current_date}
                    dayCards={getDayCards(d.date_iso)}
                    suggestedTitle={suggestedTitle}
                    recipesRecord={recipesRecord}
                    mealImages={mealImages}
                    isChild={Boolean(isChild)}
                    onCardClick={(c) => onOpenRecipeModal?.(c, d.date_iso)}
                    onSuggestionClick={handleSuggestionClick}
                    onAddMealClick={handleOpenAddMealModal}
                    onDragStart={(cardId, dateIso) => setDraggedSlot({ dateIso, mealKey: cardId })}
                    onDragEnd={() => setDraggedSlot(null)}
                    onDrop={handleDropMeal}
                  />
                );
              })}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#a78bfa', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>📅 Week 2: {formatWeekRangeLabel(week2StartIso, 1)}</span>
            </div>
            <div id="meal-planner-editable-w2" className="meal-week-display">
              {week2Days.map((d) => {
                const dayNum = parseInt(d.date_iso.replace(/-/g, ''), 10) || 0;
                const pool = allSuggestionsPool.length > 0 ? allSuggestionsPool : ['Pizza', 'Tacos', 'Burgers', 'Pasta'];
                const suggestedTitle = pool[dayNum % pool.length];
                return (
                  <MealDayColumn
                    key={d.date_iso}
                    day={d}
                    isToday={d.date_iso === data?.current_date}
                    dayCards={getDayCards(d.date_iso)}
                    suggestedTitle={suggestedTitle}
                    recipesRecord={recipesRecord}
                    mealImages={mealImages}
                    isChild={Boolean(isChild)}
                    onCardClick={(c) => onOpenRecipeModal?.(c, d.date_iso)}
                    onSuggestionClick={handleSuggestionClick}
                    onAddMealClick={handleOpenAddMealModal}
                    onDragStart={(cardId, dateIso) => setDraggedSlot({ dateIso, mealKey: cardId })}
                    onDragEnd={() => setDraggedSlot(null)}
                    onDrop={handleDropMeal}
                  />
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div id="meal-planner-editable" className="meal-week-display meal-week-display-1week">
          {week1Days.map((d) => {
            const dayNum = parseInt(d.date_iso.replace(/-/g, ''), 10) || 0;
            const pool = allSuggestionsPool.length > 0 ? allSuggestionsPool : ['Pizza', 'Tacos', 'Burgers', 'Pasta'];
            const suggestedTitle = pool[dayNum % pool.length];
            return (
              <MealDayColumn
                key={d.date_iso}
                day={d}
                isToday={d.date_iso === data?.current_date}
                dayCards={getDayCards(d.date_iso)}
                suggestedTitle={suggestedTitle}
                recipesRecord={recipesRecord}
                mealImages={mealImages}
                isChild={Boolean(isChild)}
                onCardClick={(c) => onOpenRecipeModal?.(c, d.date_iso)}
                onSuggestionClick={handleSuggestionClick}
                onAddMealClick={handleOpenAddMealModal}
                onDragStart={(cardId, dateIso) => setDraggedSlot({ dateIso, mealKey: cardId })}
                onDragEnd={() => setDraggedSlot(null)}
                onDrop={handleDropMeal}
              />
            );
          })}
        </div>
      )}

      <PlanMealModal
        open={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        planMealTitle={planMealTitle}
        setPlanMealTitle={setPlanMealTitle}
        planAudience={planAudience}
        setPlanAudience={setPlanAudience}
        planSelectedDays={planSelectedDays}
        setPlanSelectedDays={setPlanSelectedDays}
        planAddShopping={planAddShopping}
        setPlanAddShopping={setPlanAddShopping}
        weekDays={weekDays}
        allLibraryRecipes={allLibraryRecipes}
        recipesRecord={recipesRecord}
        mealImages={mealImages}
        onSave={handleSaveMealCard}
      />
    </PageContainer>
  );
};

export default MealPlannerSection;
