import React, { useMemo } from 'react';
import { Modal } from '../../../components/common/Modal';
import { Button } from '../../../components/ui';
import { FallbackImage } from '../../../components/common/FallbackImage';
import { resolveAssetUrl } from '../../../api';
import { RecipeItem } from '../../../types';

export interface RecipeViewModalProps {
  recipe: RecipeItem | null;
  onClose: () => void;
  isChild: boolean;
  onAddToShopping: (recipe: RecipeItem) => Promise<void>;
  onEdit: (recipe: RecipeItem) => void;
  onDeleteCard?: (dateIso: string, cardId: string) => Promise<void>;
}

export const RecipeViewModal: React.FC<RecipeViewModalProps> = ({
  recipe,
  onClose,
  isChild,
  onAddToShopping,
  onEdit,
  onDeleteCard,
}) => {
  if (!recipe) return null;

  const dayLabel = useMemo(() => {
    const iso = (recipe as any)?._dateIso;
    if (!iso) return 'day';
    const [y, m, d] = String(iso).split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    return dateObj.toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'long' });
  }, [(recipe as any)?._dateIso]);

  const createdDateLabel = useMemo(() => {
    if (!recipe?.created_at) return null;
    try {
      const dt = new Date(recipe.created_at);
      return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return null;
    }
  }, [recipe?.created_at]);

  return (
    <Modal
      open={Boolean(recipe)}
      onClose={onClose}
      title={recipe.title || 'Recipe Details'}
      icon="fas fa-book-open"
      maxWidth={1000}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <Button
            variant="primary"
            size="sm"
            icon="fas fa-cart-plus"
            onClick={() => onAddToShopping(recipe)}
          >
            Add to Shopping List
          </Button>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {(recipe as any)._cardId && (recipe as any)._dateIso && !isChild && onDeleteCard && (
              <Button
                size="sm"
                variant="secondary"
                icon="fas fa-calendar-minus"
                onClick={async () => {
                  const dateIso = (recipe as any)._dateIso;
                  const cardId = (recipe as any)._cardId;
                  onClose();
                  await onDeleteCard(dateIso, cardId);
                }}
              >
                Remove from {dayLabel}
              </Button>
            )}
            {!isChild && (
              <Button
                variant="secondary"
                size="sm"
                icon="fas fa-pencil-alt"
                onClick={() => {
                  const r = recipe;
                  onClose();
                  onEdit(r);
                }}
              >
                Edit
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      }
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          height: 'calc(80vh - 140px)',
          maxHeight: 620,
          minHeight: 400,
          overflow: 'hidden',
        }}
      >
        {/* Top metadata & image preview */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            flexShrink: 0,
            paddingBottom: 8,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="recipe-meta-row" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: '#e2e8f0' }}>
              <i className="fas fa-clock" style={{ color: '#60a5fa' }} /> {recipe.prep_time || '25 mins'}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: '#e2e8f0' }}>
              <i className="fas fa-users" style={{ color: '#34d399' }} /> {recipe.servings || '4 servings'}
            </span>
            {createdDateLabel && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.84rem', color: '#94a3b8' }}>
                <i className="fas fa-calendar" style={{ color: '#a78bfa' }} /> Added {createdDateLabel}
              </span>
            )}
            {recipe.image_url && (
              <a
                href={resolveAssetUrl(recipe.image_url)}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: '#93c5fd',
                  textDecoration: 'none',
                  background: 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  padding: '3px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
                title="Open original uploaded recipe photo in a new tab"
              >
                <i className="fas fa-camera" /> View Original Photo{' '}
                <i className="fas fa-arrow-up-right-from-square" style={{ fontSize: '0.68rem', marginLeft: 2 }} />
              </a>
            )}
          </div>
        </div>

        {/* Side-by-side columns on tablet/desktop, stacked single-column on mobile */}
        <div className="recipe-view-grid">
          {/* Left Column: Ingredients */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              height: '100%',
              overflow: 'hidden',
            }}
          >
            <div style={{ marginBottom: 10, flexShrink: 0 }}>
              <strong style={{ fontSize: '0.84rem', color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Ingredients ({(recipe.ingredients || []).length})
              </strong>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                minHeight: 0,
                paddingRight: 6,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {(recipe.ingredients || []).length === 0 ? (
                <div style={{ fontSize: '0.82rem', opacity: 0.5, fontStyle: 'italic', padding: '12px 0' }}>
                  No ingredients specified.
                </div>
              ) : (
                (recipe.ingredients || []).map((ing, idx) => (
                  <div
                    key={idx}
                    className="recipe-ing-item"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '8px 10px',
                      background: 'rgba(30, 41, 59, 0.55)',
                      borderRadius: 8,
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <span
                      title={ing.name}
                      style={{
                        fontSize: '0.84rem',
                        color: '#f1f5f9',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                      }}
                    >
                      {ing.name}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {ing.in_pantry && (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            color: '#34d399',
                            background: 'rgba(16, 185, 129, 0.15)',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                            padding: '1px 6px',
                            borderRadius: 10,
                          }}
                          title="Pantry staple (in stock)"
                        >
                          Pantry
                        </span>
                      )}
                      {ing.uncataloged && !ing.in_pantry && (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            color: '#fbbf24',
                            background: 'rgba(245, 158, 11, 0.15)',
                            border: '1px solid rgba(245, 158, 11, 0.25)',
                            padding: '1px 6px',
                            borderRadius: 10,
                          }}
                          title="New uncataloged item"
                        >
                          New
                        </span>
                      )}
                      {ing.qty ? (
                        <span
                          style={{
                            fontWeight: 700,
                            color: '#93c5fd',
                            fontSize: '0.82rem',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {ing.qty}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Column: Instructions */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              height: '100%',
              overflow: 'hidden',
            }}
          >
            <div style={{ marginBottom: 10, flexShrink: 0 }}>
              <strong style={{ fontSize: '0.84rem', color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Instructions / Method
              </strong>
            </div>

            <div
              className="recipe-instructions-box"
              style={{
                flex: 1,
                overflowY: 'auto',
                minHeight: 0,
                paddingRight: 8,
                fontSize: '0.92rem',
                lineHeight: 1.6,
                color: '#e2e8f0',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {recipe.instructions || 'No instructions specified.'}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
