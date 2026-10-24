import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/common/Modal';
import { Button, IconButton, Input, Select, Textarea } from '../../../components/ui';
import { RecipeItem, RecipeIngredient, ShoppingStore } from '../../../types';

export interface RecipeEditModalProps {
  recipe: RecipeItem | null;
  open: boolean;
  onClose: () => void;
  stores: ShoppingStore[];
  onSave: (updated: RecipeItem) => Promise<void>;
}

export const RecipeEditModal: React.FC<RecipeEditModalProps> = ({
  recipe,
  open,
  onClose,
  stores,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [servings, setServings] = useState('');
  const [instructions, setInstructions] = useState('');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [newIngName, setNewIngName] = useState('');
  const [newIngQty, setNewIngQty] = useState('');
  const [newIngStore, setNewIngStore] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (recipe) {
      setTitle(recipe.title || '');
      setPrepTime(recipe.prep_time || '25 mins');
      setServings(recipe.servings || '4 servings');
      setInstructions(recipe.instructions || '');
      setIngredients(
        (recipe.ingredients || []).map((i: any) => ({
          name: typeof i === 'string' ? i : i.name || '',
          qty: typeof i === 'object' ? i.qty || '' : '',
          store: typeof i === 'object' ? i.store || 'aldi' : 'aldi',
        }))
      );
      setNewIngStore(stores[0]?.id || 'aldi');
    }
  }, [recipe, stores]);

  const handleAddIngredient = () => {
    const name = newIngName.trim();
    if (!name) return;
    setIngredients((prev) => [
      ...prev,
      { name, qty: newIngQty.trim(), store: newIngStore || stores[0]?.id || 'aldi' },
    ]);
    setNewIngName('');
    setNewIngQty('');
  };

  const handleCommitSave = async () => {
    if (!title.trim() || !recipe) return;
    setSaving(true);
    try {
      await onSave({
        ...recipe,
        title: title.trim(),
        prep_time: prepTime.trim(),
        servings: servings.trim(),
        instructions: instructions.trim(),
        ingredients,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!recipe) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={recipe.title ? `Edit Recipe: ${recipe.title}` : 'Edit Recipe'}
      icon="fas fa-pencil-alt"
      maxWidth={640}
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
            disabled={saving || !title.trim()}
          >
            Save Recipe
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input
          label="Recipe Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Spaghetti Bolognese"
          autoFocus
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input
            label="Prep Time"
            value={prepTime}
            onChange={(e) => setPrepTime(e.target.value)}
            placeholder="e.g. 25 mins"
          />
          <Input
            label="Servings"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            placeholder="e.g. 4 servings"
          />
        </div>

        <div>
          <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 6, display: 'block' }}>
            Ingredients List ({ingredients.length})
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto', marginBottom: 10 }}>
            {ingredients.length === 0 ? (
              <div style={{ fontSize: '0.82rem', opacity: 0.5, fontStyle: 'italic', padding: '6px 0' }}>
                No ingredients added yet. Add some below.
              </div>
            ) : (
              ingredients.map((ing, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '6px 10px',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 'var(--radius-sm, 8px)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: '0.86rem', color: '#f8fafc', fontWeight: 600 }}>{ing.name}</span>
                    {ing.qty && (
                      <span style={{ fontSize: '0.78rem', color: '#93c5fd', background: 'rgba(59, 130, 246, 0.15)', padding: '1px 6px', borderRadius: 4 }}>
                        {ing.qty}
                      </span>
                    )}
                    <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>{ing.store || 'aldi'}</span>
                  </div>
                  <IconButton
                    size="sm"
                    variant="ghost"
                    icon="fas fa-trash-alt"
                    aria-label="Remove ingredient"
                    title="Remove ingredient"
                    style={{ width: 26, height: 26, color: '#f87171' }}
                    onClick={() => {
                      setIngredients((prev) => prev.filter((_, i) => i !== idx));
                    }}
                  />
                </div>
              ))
            )}
          </div>

          {/* Add ingredient row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 2 }}>
              <Input
                inputSize="sm"
                placeholder="Ingredient name (e.g. Garlic)"
                value={newIngName}
                onChange={(e) => setNewIngName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddIngredient();
                  }
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <Input
                inputSize="sm"
                placeholder="Qty (e.g. 2 cloves)"
                value={newIngQty}
                onChange={(e) => setNewIngQty(e.target.value)}
              />
            </div>
            <div style={{ width: 110 }}>
              <Select
                value={newIngStore}
                onChange={(e) => setNewIngStore(e.target.value)}
                options={stores.map((s) => ({ value: s.id, label: s.name }))}
                style={{ height: 32, fontSize: '0.82rem', padding: '0 8px' }}
              />
            </div>
            <Button
              size="sm"
              variant="secondary"
              icon="fas fa-plus"
              onClick={handleAddIngredient}
            >
              Add
            </Button>
          </div>
        </div>

        <Textarea
          label="Cooking Instructions / Method"
          rows={4}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder={'Step 1: Chop garlic and onion...\nStep 2: Sauté in olive oil...'}
        />
      </div>
    </Modal>
  );
};
