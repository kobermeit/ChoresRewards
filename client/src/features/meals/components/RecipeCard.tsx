import React, { memo } from 'react';
import { IconButton } from '../../../components/ui';
import { FallbackImage } from '../../../components/common/FallbackImage';
import { resolveAssetUrl } from '../../../api';
import { MealIngredient, RecipeItem, ShoppingStore } from '../../../types';
import { getMealEmoji, renderStoreIcon } from '../mealUtils';

export interface RecipeCardProps {
  recipe: RecipeItem;
  fullRecipe?: RecipeItem;
  items: MealIngredient[];
  imageUrl: string;
  displayName: string;
  isSynced: boolean;
  isChild: boolean;
  stores: ShoppingStore[];
  onClick: () => void;
  onEdit: (recipe: RecipeItem) => void;
}

export const RecipeCard: React.FC<RecipeCardProps> = memo(({
  recipe,
  fullRecipe,
  items,
  imageUrl,
  displayName,
  isSynced,
  isChild,
  stores,
  onClick,
  onEdit,
}) => {
  const mealKey = recipe.meal_key;

  return (
    <div
      className="meal-card"
      data-meal={mealKey}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      <div className="meal-card-img-area" style={{ position: 'relative', height: 110, overflow: 'hidden' }}>
        <FallbackImage
          src={imageUrl ? resolveAssetUrl(imageUrl) : ''}
          alt={displayName}
          className="meal-card-img"
          fallbackEmoji={getMealEmoji(mealKey)}
          fallbackIcon="fa-utensils"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        {isSynced ? (
          <div style={{ position: 'absolute', top: 6, left: 6, zIndex: 3 }}>
            <span
              title="Synced from Notion (read-only)"
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                color: '#c4b5fd',
                background: 'rgba(15, 23, 42, 0.75)',
                backdropFilter: 'blur(4px)',
                border: '1px solid rgba(167, 139, 250, 0.4)',
                borderRadius: 'var(--radius-pill)',
                padding: '2px 7px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
              }}
            >
              <i className="fas fa-arrows-rotate" style={{ fontSize: '0.62rem' }} /> Notion
            </span>
          </div>
        ) : !isChild ? (
          <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 3 }}>
            <IconButton
              size="sm"
              variant="ghost"
              icon="fas fa-pencil-alt"
              aria-label="Edit recipe"
              title="Edit manual recipe"
              style={{
                width: 28,
                height: 28,
                background: 'rgba(15, 23, 42, 0.7)',
                backdropFilter: 'blur(4px)',
                borderRadius: '50%',
                color: '#f8fafc',
                border: '1px solid rgba(255,255,255,0.18)',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onEdit(
                  fullRecipe || {
                    meal_key: mealKey,
                    title: displayName,
                    image_url: imageUrl || null,
                    ingredients: items,
                    instructions: '',
                    servings: '4',
                    prep_time: '25 mins',
                  }
                );
              }}
            />
          </div>
        ) : null}

        {/* Recipe Name Overlay */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '16px 10px 6px',
            background:
              'linear-gradient(to top, rgba(15, 23, 42, 0.92) 0%, rgba(15, 23, 42, 0.6) 65%, transparent 100%)',
            zIndex: 2,
          }}
        >
          <span
            className="meal-card-title"
            style={{
              display: 'block',
              fontSize: '0.88rem',
              fontWeight: 700,
              color: '#ffffff',
              textShadow: '0 1px 3px rgba(0,0,0,0.85)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {displayName}
          </span>
        </div>
      </div>

      <div className="meal-card-ing-list">
        {items.slice(0, 4).map((item: MealIngredient, idx: number) => {
          const itemStore = item.store || '';
          const storeObj = stores.find(
            (s) =>
              s &&
              s.id &&
              (s.id.toLowerCase() === itemStore.toLowerCase() ||
                (s.name && s.name.toLowerCase() === itemStore.toLowerCase()))
          );
          return (
            <div key={idx} className="meal-card-ing-row">
              <span className="meal-card-ing-name">{item.name || 'Ingredient'}</span>
              <span className="meal-card-ing-qty">{item.qty || ''}</span>
              <span
                className="shopping-lib-store-icon-badge meal-card-ing-store"
                title={storeObj?.name || itemStore || 'Supermarket'}
              >
                {renderStoreIcon(storeObj?.icon)}
              </span>
            </div>
          );
        })}
        {items.length > 4 && (
          <div style={{ padding: '2px 8px', fontSize: '0.72rem', opacity: 0.5 }}>
            +{items.length - 4} more ingredients
          </div>
        )}
        {items.length === 0 && (
          <div style={{ padding: '2px 8px', fontSize: '0.72rem', opacity: 0.5, fontStyle: 'italic' }}>
            {recipe.prep_time || 'Tap to view recipe method'}
          </div>
        )}
      </div>
    </div>
  );
});

RecipeCard.displayName = 'RecipeCard';
