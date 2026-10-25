import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Modal } from '../../../components/common/Modal';
import { Button } from '../../../components/ui';
import { AssigneeSelect } from '../../../components/ui/AssigneeSelect';
import { FallbackImage } from '../../../components/common/FallbackImage';
import { resolveAssetUrl } from '../../../api';
import { RecipeItem, Person } from '../../../types';
import { DayInfo, getMealEmoji } from '../mealUtils';

export interface PlanMealModalProps {
  open: boolean;
  onClose: () => void;
  planMealTitle: string;
  setPlanMealTitle: (val: string) => void;
  planAudience: string;
  setPlanAudience: (val: string) => void;
  planSelectedDays: string[];
  setPlanSelectedDays: React.Dispatch<React.SetStateAction<string[]>>;
  planAddShopping: boolean;
  setPlanAddShopping: (val: boolean) => void;
  weekDays: DayInfo[];
  allLibraryRecipes: RecipeItem[];
  recipesRecord: Record<string, RecipeItem>;
  mealImages: Record<string, string>;
  family?: Person[];
  onSave: () => Promise<void>;
}

export const PlanMealModal: React.FC<PlanMealModalProps> = ({
  open,
  onClose,
  planMealTitle,
  setPlanMealTitle,
  planAudience,
  setPlanAudience,
  planSelectedDays,
  setPlanSelectedDays,
  planAddShopping,
  setPlanAddShopping,
  weekDays,
  allLibraryRecipes,
  recipesRecord,
  mealImages,
  family = [],
  onSave,
}) => {
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const comboboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setComboboxOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const filteredRecipes = useMemo(() => {
    const q = planMealTitle.trim().toLowerCase();
    if (!q) return allLibraryRecipes.slice(0, 8);
    return allLibraryRecipes
      .filter((r) => r.title.toLowerCase().includes(q))
      .slice(0, 10);
  }, [allLibraryRecipes, planMealTitle]);

  const matchKey = planMealTitle.trim().toLowerCase();
  const matchedRecipe = recipesRecord[matchKey];
  const customImg = matchedRecipe?.image_url || mealImages[matchKey];

  const handleCommitSave = async () => {
    if (!planMealTitle.trim() || planSelectedDays.length === 0) return;
    setSaving(true);
    try {
      await onSave();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Plan a Meal"
      icon="fas fa-calendar-plus"
      maxWidth={520}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon="fas fa-check"
            onClick={handleCommitSave}
            disabled={saving || !planMealTitle.trim() || planSelectedDays.length === 0}
          >
            Save to Plan
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Meal Name Input + Recipe Thumbnail Preview */}
        <div ref={comboboxRef} style={{ position: 'relative' }}>
          <label
            htmlFor="plan-meal-input"
            style={{ fontSize: '0.84rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 6, display: 'block' }}
          >
            Meal Name
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                id="plan-meal-input"
                type="text"
                className="cr-input"
                placeholder="Search recipe library or type new meal…"
                value={planMealTitle}
                onChange={(e) => {
                  setPlanMealTitle(e.target.value);
                  setComboboxOpen(true);
                }}
                onFocus={() => setComboboxOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setComboboxOpen(false);
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filteredRecipes.length > 0 && planMealTitle.trim().toLowerCase() === filteredRecipes[0].title.toLowerCase()) {
                      setPlanMealTitle(filteredRecipes[0].title);
                      setComboboxOpen(false);
                    } else {
                      setComboboxOpen(false);
                    }
                  }
                }}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  paddingRight: planMealTitle ? 32 : 12,
                }}
              />
              {planMealTitle && (
                <button
                  type="button"
                  onClick={() => {
                    setPlanMealTitle('');
                    setComboboxOpen(false);
                  }}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255,255,255,0.45)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    padding: 4,
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Clear meal name"
                  aria-label="Clear meal name"
                >
                  <i className="fas fa-times" />
                </button>
              )}
            </div>

            {/* Thumbnail preview */}
            <div
              style={{
                width: 48,
                height: 40,
                borderRadius: 'var(--input-radius, 10px)',
                overflow: 'hidden',
                flexShrink: 0,
                border: '1px solid rgba(255, 255, 255, 0.12)',
                background: 'rgba(255, 255, 255, 0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {customImg ? (
                <FallbackImage
                  src={resolveAssetUrl(customImg)}
                  alt=""
                  fallbackEmoji={getMealEmoji(planMealTitle)}
                  fallbackContent={
                    <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{getMealEmoji(planMealTitle)}</span>
                  }
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{getMealEmoji(planMealTitle)}</span>
              )}
            </div>
          </div>

          {/* Combobox Dropdown */}
          {comboboxOpen && (
            <div
              className="shopping-combobox-dropdown"
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 58,
                maxHeight: 220,
                overflowY: 'auto',
                zIndex: 10001,
                marginTop: 4,
                boxShadow: '0 12px 30px rgba(0,0,0,0.6)',
              }}
            >
              {filteredRecipes.map((r) => (
                <div
                  key={r.meal_key}
                  className="shopping-combobox-item"
                  onClick={() => {
                    setPlanMealTitle(r.title);
                    setComboboxOpen(false);
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '1.2rem' }}>{getMealEmoji(r.meal_key)}</span>
                    <span style={{ fontWeight: 700 }}>{r.title}</span>
                  </div>
                  <span className="shopping-combobox-times">
                    {r.prep_time || 'recipe'} · {r.servings || '4 serv'}
                  </span>
                </div>
              ))}
              {planMealTitle.trim() &&
                !allLibraryRecipes.some(
                  (r) => r.title.toLowerCase() === planMealTitle.trim().toLowerCase()
                ) && (
                  <div
                    className="shopping-combobox-item shopping-combobox-item-custom"
                    onClick={() => setComboboxOpen(false)}
                  >
                    <span>+ Use custom meal &ldquo;{planMealTitle.trim()}&rdquo;</span>
                    <span className="shopping-combobox-times">custom</span>
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Audience using shared AssigneeSelect */}
        <AssigneeSelect
          label="Audience"
          value={planAudience}
          onChange={(val) => setPlanAudience(val)}
          family={family}
          allowGroups={true}
          helperText="Select which family member or group this meal is planned for"
        />

        {/* Days selector matching ChoreModal sleek Day Pills */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-text-primary, #e2e8f0)' }}>
              Plan for Days
            </span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setPlanSelectedDays(weekDays.map((d) => d.date_iso))}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#38bdf8',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '2px 4px',
                }}
              >
                All
              </button>
              <span style={{ opacity: 0.4, fontSize: '0.74rem' }}>•</span>
              <button
                type="button"
                onClick={() =>
                  setPlanSelectedDays(
                    weekDays
                      .filter((d) => !['Sat', 'Sun'].includes(d.day_short))
                      .map((d) => d.date_iso)
                  )
                }
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#38bdf8',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '2px 4px',
                }}
              >
                Mon–Fri
              </button>
              <span style={{ opacity: 0.4, fontSize: '0.74rem' }}>•</span>
              <button
                type="button"
                onClick={() =>
                  setPlanSelectedDays(
                    weekDays
                      .filter((d) => ['Sat', 'Sun'].includes(d.day_short))
                      .map((d) => d.date_iso)
                  )
                }
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#38bdf8',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '2px 4px',
                }}
              >
                Weekends
              </button>
            </div>
          </div>

          {/* Touch-Friendly Day Pills */}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
            {weekDays.map((d) => {
              const active = planSelectedDays.includes(d.date_iso);
              return (
                <button
                  key={d.date_iso}
                  type="button"
                  onClick={() => {
                    if (active) {
                      setPlanSelectedDays((prev) => prev.filter((iso) => iso !== d.date_iso));
                    } else {
                      setPlanSelectedDays((prev) => [...prev, d.date_iso]);
                    }
                  }}
                  style={{
                    flex: 1,
                    height: 38,
                    borderRadius: 'var(--btn-radius, 10px)',
                    border: active
                      ? '1.5px solid #38bdf8'
                      : '1px solid rgba(255, 255, 255, 0.12)',
                    background: active
                      ? 'rgba(56, 189, 248, 0.25)'
                      : 'rgba(255, 255, 255, 0.05)',
                    color: active ? '#ffffff' : '#94a3b8',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1.1,
                  }}
                  title={d.day_full}
                >
                  <span>{d.day_short}</span>
                  {d.is_today && (
                    <span style={{ fontSize: '0.58rem', color: active ? '#bae6fd' : '#38bdf8' }}>•</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Add ingredients checkbox */}
        <div style={{ paddingTop: 4 }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              fontSize: '0.88rem',
              color: '#f8fafc',
            }}
          >
            <input
              type="checkbox"
              checked={planAddShopping}
              onChange={(e) => setPlanAddShopping(e.target.checked)}
              style={{ accentColor: '#38bdf8', width: 16, height: 16 }}
            />
            <span>
              Add meal ingredients to Shopping List
              {planSelectedDays.length > 0 && (() => {
                const firstDate = planSelectedDays[0];
                const diff = Math.round(
                  (new Date(`${firstDate}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24)
                );
                return diff > 7 ? ' (Future week — unchecked by default)' : '';
              })()}
            </span>
          </label>
        </div>
      </div>
    </Modal>
  );
};
