import React, { useRef, useEffect } from 'react';
import { Modal } from '../../../components/common/Modal';
import { Button } from '../../../components/ui';
import { FallbackImage } from '../../../components/common/FallbackImage';
import { resolveAssetUrl } from '../../../api';
import { RecipeItem } from '../../../types';
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
  onSave,
}) => {
  const [comboboxOpen, setComboboxOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
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

  const filteredRecipes = React.useMemo(() => {
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Meal Name Input + Recipe Thumbnail Preview */}
        <div ref={comboboxRef} style={{ position: 'relative' }}>
          <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 4, display: 'block' }}>
            Meal Name (Search Library or type custom)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                className="modern-input"
                placeholder="Search meal library (e.g. Butter Chicken, Pizza) or type new meal…"
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
                style={{ paddingRight: planMealTitle ? 32 : 12 }}
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
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255,255,255,0.45)',
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    padding: 2,
                    lineHeight: 1,
                  }}
                  title="Clear meal title"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Thumbnail preview */}
            <div
              style={{
                width: 52,
                height: 42,
                borderRadius: 8,
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
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ fontSize: '1.4rem', lineHeight: 1 }}>{getMealEmoji(planMealTitle)}</span>
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
                right: 62,
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

        {/* Audience */}
        <div>
          <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 6, display: 'block' }}>
            Audience
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['Everyone', 'Kids', 'Adults'].map((aud) => {
              const active = planAudience === aud;
              return (
                <button
                  key={aud}
                  type="button"
                  onClick={() => setPlanAudience(aud)}
                  style={{
                    padding: '7px 16px',
                    borderRadius: 999,
                    border: active ? '1.5px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                    background: active ? '#2563eb' : 'rgba(255, 255, 255, 0.06)',
                    color: active ? '#ffffff' : 'rgba(255, 255, 255, 0.75)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {aud === 'Everyone' ? '🌟 Everyone' : aud === 'Kids' ? '🧒 Kids' : '🧑 Adults'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Days selector */}
        <div>
          <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 6, display: 'block' }}>
            Select Days (Plan across multiple nights)
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 6 }}>
            {weekDays.map((d) => {
              const checked = planSelectedDays.includes(d.date_iso);
              return (
                <label
                  key={d.date_iso}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: checked ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${checked ? '#3b82f6' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 8,
                    padding: '6px 8px',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    color: '#f8fafc',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setPlanSelectedDays((prev) => [...prev, d.date_iso]);
                      } else {
                        setPlanSelectedDays((prev) => prev.filter((iso) => iso !== d.date_iso));
                      }
                    }}
                  />
                  <span>{d.day_short}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Add ingredients checkbox */}
        <div>
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
