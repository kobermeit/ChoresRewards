import React from 'react';
import { Modal } from '../../../components/common/Modal';
import { Button, IconButton } from '../../../components/ui';
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
              <IconButton
                size="sm"
                variant="danger"
                icon="fas fa-trash-alt"
                aria-label="Remove meal from day"
                title="Remove meal from this day"
                onClick={async () => {
                  const dateIso = (recipe as any)._dateIso;
                  const cardId = (recipe as any)._cardId;
                  onClose();
                  await onDeleteCard(dateIso, cardId);
                }}
              />
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
          maxHeight: 600,
          minHeight: 380,
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

        {/* Side-by-side columns: Ingredients & Method */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(220px, 270px) 1fr',
            gap: 16,
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
              background: 'rgba(15, 23, 42, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 12,
              padding: '12px 14px',
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexShrink: 0 }}>
              <strong style={{ fontSize: '0.88rem', color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Ingredients ({(recipe.ingredients || []).length})
              </strong>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                minHeight: 0,
                paddingRight: 4,
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
                      padding: '6px 8px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: 6,
                      border: '1px solid rgba(255, 255, 255, 0.04)',
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
                        maxWidth: 170,
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
              background: 'rgba(15, 23, 42, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 12,
              padding: '12px 16px',
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <div style={{ marginBottom: 8, flexShrink: 0 }}>
              <strong style={{ fontSize: '0.88rem', color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Instructions / Method
              </strong>
            </div>

            <div
              className="recipe-instructions-box"
              style={{
                flex: 1,
                overflowY: 'auto',
                minHeight: 0,
                paddingRight: 6,
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
