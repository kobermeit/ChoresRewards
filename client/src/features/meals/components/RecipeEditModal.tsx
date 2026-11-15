import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../../context/AppContext';
import { Modal } from '../../../components/common/Modal';
import { Button, IconButton, Input, Textarea } from '../../../components/ui';
import { ItemQuickAddBar, getCleanStoreName } from '../../../components/common/ItemQuickAddBar';
import { RecipeItem, RecipeIngredient, ShoppingStore } from '../../../types';
import { apiGet } from '../../../api';

export interface RecipeEditModalProps {
  recipe: RecipeItem | null;
  open: boolean;
  onClose: () => void;
  stores: ShoppingStore[];
  onSave: (updated: RecipeItem) => Promise<void>;
  onDelete?: (mealKey: string) => Promise<void>;
  onTranscribePhoto?: (file: File) => void;
  onNavigateToSettings?: () => void;
}

export const RecipeEditModal: React.FC<RecipeEditModalProps> = ({
  recipe,
  open,
  onClose,
  stores,
  onSave,
  onDelete,
  onTranscribePhoto,
  onNavigateToSettings,
}) => {
  const { data } = useApp();
  const [title, setTitle] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [servings, setServings] = useState('');
  const [instructions, setInstructions] = useState('');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [newIngStore, setNewIngStore] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState<boolean | null>(null);

  const lastRecipeKeyRef = useRef<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize state only when the modal is opened or a different recipe is selected.
  // Never re-initialize during background data/store refetches so added items are never wiped.
  useEffect(() => {
    if (open) {
      apiGet<{ success: boolean; has_key: boolean }>('settings/gemini')
        .then((res) => setHasGeminiKey(Boolean(res?.has_key)))
        .catch(() => setHasGeminiKey(false));
    }
    if (open && recipe) {
      const currentKey = `${recipe.meal_key || 'new'}_${recipe.id || 0}`;
      if (lastRecipeKeyRef.current !== currentKey) {
        lastRecipeKeyRef.current = currentKey;
        setTitle(recipe.title || '');
        setPrepTime(recipe.prep_time || '25 mins');
        setServings(recipe.servings || '4 servings');
        setInstructions(recipe.instructions || '');
        setIngredients(
          (recipe.ingredients || []).map((i: any) => ({
            name: typeof i === 'string' ? i : i.name || '',
            qty: typeof i === 'object' ? (i.qty || '1') : '1',
            store: typeof i === 'object' ? i.store || 'aldi' : 'aldi',
            prep: typeof i === 'object' ? i.prep || '' : '',
            raw_name: typeof i === 'object' ? i.raw_name || '' : '',
            uncataloged: typeof i === 'object' ? Boolean(i.uncataloged) : false,
            in_pantry: typeof i === 'object' ? Boolean(i.in_pantry) : false,
          }))
        );
        setNewIngStore(stores[0]?.id || 'aldi');
      }
    } else if (!open) {
      lastRecipeKeyRef.current = null;
    }
  }, [open, recipe?.meal_key, recipe?.id]);

  const handleUpdateIngredient = (index: number, patch: Partial<RecipeIngredient>) => {
    setIngredients((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
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

  const handleDelete = async () => {
    if (!recipe?.meal_key || !onDelete) return;
    const confirmName = title.trim() || recipe.title || 'this recipe';
    if (!window.confirm(`Are you sure you want to delete the recipe "${confirmName}"? This cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    try {
      await onDelete(recipe.meal_key);
      onClose();
    } finally {
      setDeleting(false);
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            {recipe.meal_key && onDelete && (
              <Button
                variant="danger"
                size="sm"
                icon="fas fa-trash-can"
                disabled={saving || deleting}
                isLoading={deleting}
                onClick={handleDelete}
              >
                Delete Recipe
              </Button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Button variant="ghost" onClick={onClose} disabled={saving || deleting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              icon="fas fa-check"
              isLoading={saving}
              disabled={!title.trim() || saving || deleting}
              onClick={handleSave}
            >
              Save Recipe
            </Button>
          </div>
        </div>
      }
    >
      {/* Hidden file pickers for AI photo upload */}
      {onTranscribePhoto && (
        <>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onClose();
                onTranscribePhoto(file);
              }
              e.target.value = '';
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onClose();
                onTranscribePhoto(file);
              }
              e.target.value = '';
            }}
          />
        </>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Gemini AI Photo Banner for new recipes */}
        {!recipe?.meal_key && onTranscribePhoto && hasGeminiKey === false && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: 10,
              padding: '10px 14px',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 200, flex: 1 }}>
              <i className="fas fa-triangle-exclamation" style={{ color: '#fbbf24', fontSize: '1.1rem' }} />
              <div style={{ fontSize: '0.84rem', color: '#fef3c7', lineHeight: 1.35 }}>
                <span style={{ fontWeight: 700 }}>Gemini API key required for photo import</span>
                <span style={{ display: 'block', fontSize: '0.76rem', color: '#fde68a' }}>
                  Configure your free Gemini key in Connected Integrations to enable AI recipe photo OCR.
                </span>
              </div>
            </div>
            {onNavigateToSettings && (
              <Button
                variant="secondary"
                size="sm"
                icon="fas fa-sliders"
                onClick={() => {
                  onClose();
                  onNavigateToSettings();
                }}
              >
                Configure Gemini
              </Button>
            )}
          </div>
        )}

        {!recipe?.meal_key && onTranscribePhoto && hasGeminiKey !== false && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(99, 102, 241, 0.15) 100%)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: 10,
              padding: '10px 14px',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 200, flex: 1 }}>
              <i className="fas fa-wand-magic-sparkles" style={{ color: '#818cf8', fontSize: '1.1rem' }} />
              <div style={{ fontSize: '0.84rem', color: '#e2e8f0', lineHeight: 1.35 }}>
                <span style={{ fontWeight: 700 }}>Have a photo of this recipe?</span>
                <span style={{ display: 'block', fontSize: '0.76rem', color: '#94a3b8' }}>
                  Gemini AI will read title, ingredients, servings, and instructions.
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                variant="secondary"
                size="sm"
                icon="fas fa-camera"
                onClick={() => cameraInputRef.current?.click()}
              >
                Camera
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon="fas fa-image"
                onClick={() => fileInputRef.current?.click()}
              >
                Upload
              </Button>
            </div>
          </div>
        )}

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
            placeholder="e.g. 25 mins"
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

        {/* Ingredients Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '0.84rem', fontWeight: 700, color: '#f8fafc' }}>
              Ingredients ({ingredients.length})
            </label>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Click an item to add · Adjust Qty on row
            </span>
          </div>

          <div
            style={{
              maxHeight: 240,
              overflowY: 'auto',
              borderRadius: 'var(--input-radius, 10px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              background: 'rgba(15, 23, 42, 0.4)',
              padding: '4px 6px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {ingredients.length === 0 ? (
              <div style={{ padding: '12px 8px', textAlign: 'center', fontSize: '0.84rem', color: '#94a3b8' }}>
                No ingredients yet. Search staples or type a new item below!
              </div>
            ) : (
              ingredients.map((ing, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    fontSize: '0.82rem',
                  }}
                >
                  <input
                    type="text"
                    className="modern-input"
                    value={ing.qty || '1'}
                    onChange={(e) => handleUpdateIngredient(idx, { qty: e.target.value })}
                    placeholder="Qty"
                    title="Recipe quantity (e.g. 1, 80ml, 250g, 1 can)"
                    style={{
                      width: 66,
                      height: 26,
                      padding: '1px 6px',
                      fontSize: '0.82rem',
                      textAlign: 'center',
                      borderRadius: 5,
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.14)',
                      color: '#93c5fd',
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontWeight: 600, color: '#f8fafc', flex: 1, minWidth: 100 }}>
                    {ing.name}
                  </span>
                  {ing.prep && (
                    <span style={{ fontSize: '0.74rem', color: '#94a3b8', fontStyle: 'italic' }}>
                      ({ing.prep})
                    </span>
                  )}
                  {ing.in_pantry && (
                    <span
                      style={{
                        fontSize: '0.70rem',
                        fontWeight: 600,
                        color: '#34d399',
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        padding: '1px 6px',
                        borderRadius: 10,
                        flexShrink: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                      title="Pantry staple (in stock)"
                    >
                      <i className="fas fa-box" style={{ fontSize: '0.64rem' }} /> Pantry
                    </span>
                  )}
                  {ing.uncataloged && !ing.in_pantry && (
                    <span
                      style={{
                        fontSize: '0.70rem',
                        fontWeight: 600,
                        color: '#fbbf24',
                        background: 'rgba(245, 158, 11, 0.15)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        padding: '1px 6px',
                        borderRadius: 10,
                        flexShrink: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                      title="New item (not currently in catalog)"
                    >
                      <i className="fas fa-sparkles" style={{ fontSize: '0.64rem' }} /> New
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: '0.72rem',
                      color: '#94a3b8',
                      background: 'rgba(255, 255, 255, 0.06)',
                      padding: '2px 8px',
                      borderRadius: 4,
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      flexShrink: 0,
                    }}
                  >
                    {getCleanStoreName(ing.store, stores)}
                  </span>
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

          {/* Shared ItemQuickAddBar - exact same component used on Shopping List */}
          <ItemQuickAddBar
            placeholder="Search staples (e.g. Milk, Onions, 2 cloves garlic) or type new ingredient…"
            buttonLabel="Add"
            stores={stores}
            selectedStore={newIngStore}
            onStoreChange={(s) => setNewIngStore(s)}
            onAdd={({ name, qty, store, isStaple }) => {
              const isPantry = Boolean(
                isStaple ||
                (data?.shopping?.pantry || []).some(
                  (p: string) => p.toLowerCase() === name.toLowerCase()
                )
              );
              setIngredients((prev) => [
                ...prev,
                {
                  name,
                  qty: qty || '1',
                  store: store || newIngStore || 'aldi',
                  prep: '',
                  raw_name: name,
                  uncataloged: false,
                  in_pantry: isPantry,
                },
              ]);
            }}
          />
        </div>

        <Textarea
          label="Cooking Instructions / Method"
          rows={10}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder={'Step 1: Chop garlic and onion...\nStep 2: Sauté in olive oil...'}
        />
      </div>
    </Modal>
  );
};

export default RecipeEditModal;
