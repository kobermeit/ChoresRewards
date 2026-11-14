import React, { useState, useMemo } from 'react';
import { Modal } from '../../../components/common/Modal';
import { Button, CustomDropdown, CustomDropdownOption } from '../../../components/ui';
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
  selectableWeeks?: DayInfo[][];
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
  selectableWeeks,
}) => {
  const [saving, setSaving] = useState(false);

  const matchKey = planMealTitle.trim().toLowerCase();
  const matchedRecipe = recipesRecord[matchKey];
  const customImg = matchedRecipe?.image_url || mealImages[matchKey];

  const recipeOptions: CustomDropdownOption[] = useMemo(() => {
    const opts: CustomDropdownOption[] = allLibraryRecipes.map((r) => ({
      value: r.title,
      label: r.title,
    }));

    const trimmed = planMealTitle.trim();
    if (trimmed && !opts.some((o) => o.value.toLowerCase() === trimmed.toLowerCase())) {
      opts.unshift({
        value: trimmed,
        label: trimmed,
      });
    }

    return opts;
  }, [allLibraryRecipes, planMealTitle]);

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
        {/* Meal Name Dropdown + Recipe Thumbnail Preview */}
        <div style={{ position: 'relative' }}>
          <label
            style={{ fontSize: '0.84rem', fontWeight: 700, color: '#e2e8f0', marginBottom: 6, display: 'block' }}
          >
            Meal Name
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <CustomDropdown
                value={planMealTitle}
                placeholder="Select recipe or search…"
                options={recipeOptions}
                onChange={(val) => setPlanMealTitle(val)}
                showFilter={true}
                filterPlaceholder="Type to filter or enter new meal…"
                allowCustomValue={true}
                customValueLabel={(text) => `Use custom meal "${text}"`}
                clearable={true}
                height={40}
                ariaLabel="Select or enter meal name"
              />
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-text-primary, #e2e8f0)' }}>
              Plan for Days
            </span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  const allVisibleDays = (selectableWeeks && selectableWeeks.length > 0 ? selectableWeeks.flat() : weekDays);
                  setPlanSelectedDays(allVisibleDays.map((d) => d.date_iso));
                }}
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
                onClick={() => {
                  const weeks = (selectableWeeks && selectableWeeks.length > 0 ? selectableWeeks : [weekDays]);
                  const targetWeek = weeks.find((w) => w.some((d) => planSelectedDays.includes(d.date_iso))) || weeks[0];
                  setPlanSelectedDays(targetWeek.filter((d) => !['Sat', 'Sun'].includes(d.day_short)).map((d) => d.date_iso));
                }}
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
                onClick={() => {
                  const weeks = (selectableWeeks && selectableWeeks.length > 0 ? selectableWeeks : [weekDays]);
                  const targetWeek = weeks.find((w) => w.some((d) => planSelectedDays.includes(d.date_iso))) || weeks[0];
                  setPlanSelectedDays(targetWeek.filter((d) => ['Sat', 'Sun'].includes(d.day_short)).map((d) => d.date_iso));
                }}
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
              <span style={{ opacity: 0.4, fontSize: '0.74rem' }}>•</span>
              <button
                type="button"
                onClick={() => setPlanSelectedDays([])}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '2px 4px',
                }}
              >
                Clear
              </button>
            </div>
          </div>

          {/* Touch-Friendly Day Pills with Date Numbers */}
          {((selectableWeeks && selectableWeeks.length > 0) ? selectableWeeks : [weekDays]).map((week, wIdx) => {
            const hasMultipleWeeks = Boolean(selectableWeeks && selectableWeeks.length > 1);
            return (
              <div key={week[0]?.date_iso || wIdx} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {hasMultipleWeeks && (
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: wIdx === 0 ? '#93c5fd' : '#a78bfa', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>📅 Week {wIdx + 1} ({week[0]?.day_short} {parseInt(week[0]?.date_iso.slice(8) || '0', 10)} – {week[6]?.day_short} {parseInt(week[6]?.date_iso.slice(8) || '0', 10)})</span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
                  {week.map((d) => {
                    const active = planSelectedDays.includes(d.date_iso);
                    const dayNum = parseInt(d.date_iso.slice(8), 10);
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
                          height: 42,
                          borderRadius: 'var(--btn-radius, 10px)',
                          border: active
                            ? '1.5px solid #38bdf8'
                            : '1px solid rgba(255, 255, 255, 0.12)',
                          background: active
                            ? 'rgba(56, 189, 248, 0.25)'
                            : 'rgba(255, 255, 255, 0.05)',
                          color: active ? '#ffffff' : '#94a3b8',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.12s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          lineHeight: 1.15,
                          gap: 1,
                        }}
                        title={`${d.day_full}, ${d.date_label}`}
                      >
                        <span style={{ fontSize: '0.76rem' }}>{d.day_short}</span>
                        <span style={{ fontSize: '0.72rem', opacity: active ? 1 : 0.75, fontWeight: active ? 800 : 600 }}>{dayNum}</span>
                        {d.is_today && (
                          <span style={{ fontSize: '0.52rem', color: active ? '#bae6fd' : '#38bdf8', lineHeight: 0.5 }}>•</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
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
            <span>Add meal ingredients to Shopping List</span>
          </label>
        </div>
      </div>
    </Modal>
  );
};
