import React, { memo } from 'react';
import { Button } from '../../../components/ui';
import { FallbackImage } from '../../../components/common/FallbackImage';
import { resolveAssetUrl } from '../../../api';
import { RecipeItem } from '../../../types';
import { DayInfo, getMealEmoji } from '../mealUtils';

export interface MealDayColumnProps {
  day: DayInfo;
  isToday: boolean;
  dayCards: any[];
  suggestedTitle: string;
  recipesRecord: Record<string, RecipeItem>;
  mealImages: Record<string, string>;
  isChild: boolean;
  onCardClick: (card: any, dateIso: string) => void;
  onSuggestionClick: (dateIso: string, suggestedTitle: string) => void;
  onAddMealClick: (dateIso: string) => void;
  onDragStart: (cardId: string, dateIso: string) => void;
  onDragEnd: () => void;
  onDrop: (toDateIso: string) => void;
}

export const MealDayColumn: React.FC<MealDayColumnProps> = memo(({
  day,
  isToday,
  dayCards,
  suggestedTitle,
  recipesRecord,
  mealImages,
  isChild,
  onCardClick,
  onSuggestionClick,
  onAddMealClick,
  onDragStart,
  onDragEnd,
  onDrop,
}) => {
  return (
    <div
      className={`meal-day-card${isToday ? ' meal-day-card-today' : ''}`}
      data-day={day.date_iso}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => onDrop(day.date_iso)}
    >
      <div className="meal-day-header">
        <strong>{day.day_full}</strong>
        <span>{day.date_label}</span>
      </div>

      <div className="meal-kanban-cards">
        {dayCards.length === 0 ? (
          <div
            className="meal-kanban-card meal-kanban-suggestion-card"
            onClick={() => onSuggestionClick(day.date_iso, suggestedTitle)}
            title={`Click to plan "${suggestedTitle}" for ${day.day_full}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 10px',
              border: '1.5px dashed rgba(245, 158, 11, 0.45)',
              background: 'rgba(245, 158, 11, 0.06)',
              borderRadius: 'var(--card-radius, 10px)',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: '1.05rem', lineHeight: 1, flexShrink: 0 }}>💡</span>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
                overflow: 'hidden',
                flex: 1,
                lineHeight: 1.2,
                textAlign: 'left',
              }}
            >
              <span
                className="meal-kanban-card-title"
                style={{
                  fontSize: '0.84rem',
                  color: '#fbbf24',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  whiteSpace: 'normal',
                  fontWeight: 700,
                  textAlign: 'left',
                }}
              >
                {suggestedTitle}
              </span>
              <span
                style={{
                  fontSize: '0.62rem',
                  color: 'rgba(251, 191, 36, 0.75)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  textAlign: 'left',
                }}
              >
                Suggested meal
              </span>
            </div>
          </div>
        ) : (
          dayCards.map((card) => {
            const recipeObj = recipesRecord[card.meal_key] || recipesRecord[card.title.toLowerCase()];
            const customImg = recipeObj?.image_url || mealImages[card.meal_key];

            return (
              <div
                key={card.id}
                className="meal-kanban-card"
                draggable
                onDragStart={() => onDragStart(card.id, day.date_iso)}
                onDragEnd={onDragEnd}
                onClick={() => onCardClick(card, day.date_iso)}
                title="Click to view recipe, method & ingredients"
                style={{ position: 'relative', padding: '6px 8px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', minWidth: 0 }}>
                  {customImg ? (
                    <FallbackImage
                      src={resolveAssetUrl(customImg)}
                      alt=""
                      fallbackEmoji={getMealEmoji(card.title)}
                      fallbackContent={
                        <span style={{ fontSize: '1.05rem', lineHeight: 1, flexShrink: 0 }}>
                          {getMealEmoji(card.title)}
                        </span>
                      }
                      style={{ width: 22, height: 22, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                    />
                  ) : (
                    <span style={{ fontSize: '1.05rem', lineHeight: 1, flexShrink: 0 }}>
                      {getMealEmoji(card.title)}
                    </span>
                  )}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      minWidth: 0,
                      overflow: 'hidden',
                      flex: 1,
                      lineHeight: 1.2,
                    }}
                  >
                    <span
                      className="meal-kanban-card-title"
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        whiteSpace: 'normal',
                        fontWeight: 600,
                        fontSize: '0.82rem',
                        lineHeight: 1.25,
                      }}
                    >
                      {card.title}
                    </span>
                    <span
                      style={{
                        fontSize: '0.62rem',
                        color: card.audience && card.audience !== 'Everyone' ? '#93c5fd' : '#94a3b8',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {card.audience ? card.audience : 'All family'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {!isChild && (
        <Button
          variant="ghost"
          size="sm"
          fullWidth
          icon="fas fa-plus"
          className="meal-kanban-add-btn"
          onClick={() => onAddMealClick(day.date_iso)}
        >
          Add Meal
        </Button>
      )}
    </div>
  );
});

MealDayColumn.displayName = 'MealDayColumn';
