import React, { useMemo } from 'react';
import { Modal } from '../../../components/common/Modal';
import { Button } from '../../../components/ui';
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
            {!recipe.notion_id && !isChild && (
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
        {/* Top metadata */}
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
            {recipe.notion_id && (
              <span style={{ color: '#c4b5fd', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <i className="fas fa-arrows-rotate" /> Synced from Notion
              </span>
            )}
          </div>
        </div>

        {/* Side-by-side columns: Ingredients & Method (Flat, Full Height) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(240px, 300px) 1fr',
            gap: 20,
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
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
                        maxWidth: 190,
                      }}
                    >
                      {ing.name}
                    </span>
                    {ing.qty ? (
                      <span
                        style={{
                          fontWeight: 700,
                          color: '#93c5fd',
                          fontSize: '0.82rem',
                          flexShrink: 0,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {ing.qty}
                      </span>
                    ) : null}
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
