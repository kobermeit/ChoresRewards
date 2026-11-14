import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
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
  const { data } = useApp();
  const [title, setTitle] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [servings, setServings] = useState('');
  const [instructions, setInstructions] = useState('');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [newIngName, setNewIngName] = useState('');
  const [newIngQty, setNewIngQty] = useState('');
  const [newIngStore, setNewIngStore] = useState('');
  const [saving, setSaving] = useState(false);
  const [comboboxOpen, setComboboxOpen] = useState(false);

  const catalogPool = useMemo(() => {
    return (data?.shopping?.intelligence?.catalog || []) as Array<{ name: string; default_store?: string }>;
  }, [data?.shopping?.intelligence?.catalog]);

  const filteredCatalog = useMemo(() => {
    const q = newIngName.trim().toLowerCase();
    if (!q) return [];
    return catalogPool.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [catalogPool, newIngName]);

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
      {
        name,
        qty: newIngQty.trim(),
        store: newIngStore || stores[0]?.id || 'aldi',
      },
    ]);
    setNewIngName('');
    setNewIngQty('');
    setComboboxOpen(false);
  };

  const handleRemoveIngredient = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        ...(recipe || { meal_key: '' }),
        meal_key: recipe?.meal_key || title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        title: title.trim(),
        prep_time: prepTime.trim() || '25 mins',
        servings: servings.trim() || '4 servings',
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
      title={recipe.meal_key ? `Edit Recipe: ${recipe.title}` : 'Add New Recipe'}
      icon="fas fa-pencil-alt"
      maxWidth={680}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon="fas fa-check"
            isLoading={saving}
            disabled={!title.trim() || saving}
            onClick={handleSave}
          >
            Save Recipe
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Input
          label="Recipe Title"
          required
          placeholder="e.g. Spaghetti Bolognese"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input
            label="Prep / Cook Time"
            placeholder="e.g. 30 mins"
            value={prepTime}
            onChange={(e) => setPrepTime(e.target.value)}
          />
          <Input
            label="Servings"
            placeholder="e.g. 4 servings"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
          />
        </div>

        {/* Ingredients Builder */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: '0.84rem', fontWeight: 700, color: '#f8fafc' }}>
            Ingredients ({ingredients.length})
          </label>

          <div
            style={{
              maxHeight: 180,
              overflowY: 'auto',
              borderRadius: 'var(--input-radius, 10px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              background: 'rgba(15, 23, 42, 0.4)',
              padding: 6,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {ingredients.length === 0 ? (
              <div style={{ padding: '12px 8px', textAlign: 'center', fontSize: '0.82rem', color: '#94a3b8' }}>
                No ingredients yet. Add them below!
              </div>
            ) : (
              ingredients.map((ing, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 8px',
                    borderRadius: 6,
                    background: 'rgba(255, 255, 255, 0.04)',
                    fontSize: '0.86rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                    <span style={{ fontWeight: 600, color: '#f8fafc' }}>{ing.name}</span>
                    {ing.qty && (
                      <span style={{ fontSize: '0.78rem', color: '#93c5fd', background: 'rgba(59, 130, 246, 0.15)', padding: '1px 6px', borderRadius: 4 }}>
                        {ing.qty}
                      </span>
                    )}
                    {ing.store && (
                      <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                        {ing.store}
                      </span>
                    )}
                  </div>
                  <IconButton
                    icon="fas fa-times"
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove ${ing.name}`}
                    onClick={() => handleRemoveIngredient(idx)}
                  />
                </div>
              ))
            )}
          </div>

          {/* Add ingredient row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 2, position: 'relative' }}>
              <Input
                inputSize="sm"
                placeholder="Ingredient name (e.g. Garlic)"
                value={newIngName}
                onChange={(e) => {
                  setNewIngName(e.target.value);
                  setComboboxOpen(true);
                }}
                onFocus={() => setComboboxOpen(true)}
                onBlur={() => setTimeout(() => setComboboxOpen(false), 200)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddIngredient();
                  }
                }}
              />
              {comboboxOpen && filteredCatalog.length > 0 && (
                <div
                  className="shopping-combobox-dropdown"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    maxHeight: 180,
                    overflowY: 'auto',
                    zIndex: 10001,
                    marginTop: 4,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                  }}
                >
                  {filteredCatalog.map((item) => (
                    <div
                      key={item.name}
                      className="shopping-combobox-item"
                      style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setNewIngName(item.name);
                        if (item.default_store) setNewIngStore(item.default_store);
                        setComboboxOpen(false);
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{item.name}</span>
                      {item.default_store && (
                        <span className="shopping-combobox-times">{item.default_store}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
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
