import React, { useState, useRef } from 'react';
import { MealPlannerSection } from '../features/meals/MealPlannerSection';
import { ShoppingListSection } from '../features/shopping/ShoppingListSection';
import { RecipeLibrarySection } from '../features/meals/RecipeLibrarySection';
import { RecipeViewModal } from '../features/meals/components/RecipeViewModal';
import { RecipeEditModal } from '../features/meals/components/RecipeEditModal';
import { ImportingRecipeModal } from '../features/meals/components/ImportingRecipeModal';
import { Modal } from './common/Modal';
import { RecipeItem, ShoppingStore } from '../types';
import { useApp } from '../context/AppContext';
import { useNavigation } from '../hooks/useSettings';
import { apiPost } from '../api';

export interface MealAndShoppingSectionProps {
  subView?: 'all' | 'meals' | 'shopping' | 'library';
  isStandalonePage?: boolean;
}

export const MealAndShoppingSection: React.FC<MealAndShoppingSectionProps> = ({
  subView = 'all',
  isStandalonePage = false,
}) => {
  const { data, refresh, showToast, isChild } = useApp();
  const { navigate: setActiveView } = useNavigation();
  const [activeRecipe, setActiveRecipe] = useState<RecipeItem | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<RecipeItem | null>(null);
  const [addChoiceModalOpen, setAddChoiceModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importInitialKeys, setImportInitialKeys] = useState<Set<string>>(new Set());
  const [importJobId, setImportJobId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stores: ShoppingStore[] = React.useMemo(() => {
    return data?.shopping_list?.stores && data.shopping_list.stores.length > 0
      ? data.shopping_list.stores
      : [
          { id: 'aldi', name: 'Aldi', icon: '🛒' },
          { id: 'coles', name: 'Coles', icon: '🏪' },
          { id: 'woolies', name: 'Woolworths', icon: '🍎' },
        ];
  }, [data?.shopping_list?.stores]);

  const recipesRecord: Record<string, RecipeItem> = React.useMemo(() => {
    const map: Record<string, RecipeItem> = {};
    const list = Array.isArray(data?.recipes) ? data.recipes : [];
    list.forEach((r) => {
      if (r.meal_key) map[r.meal_key.toLowerCase()] = r;
      if (r.title) map[r.title.toLowerCase()] = r;
    });
    return map;
  }, [data?.recipes]);

  const handleOpenRecipe = (card: { title: string; meal_key?: string; id?: string }, dateIso?: string) => {
    const key = (card.meal_key || card.title).toLowerCase();
    const existing = recipesRecord[key];
    const recipeObj: RecipeItem = existing ? { ...existing } : {
      meal_key: key,
      title: card.title,
      image_url: null,
      ingredients: (data?.meal_ingredients || {})[key] || [],
      instructions: '',
      servings: '4',
      prep_time: '25 mins',
    };
    (recipeObj as any)._cardId = card.id;
    (recipeObj as any)._dateIso = dateIso;
    setActiveRecipe(recipeObj);
  };

  const handlePhotoUpload = async (file: File) => {
    if (!file) return;
    try {
      setAddChoiceModalOpen(false);
      setEditingRecipe(null);
      const keys = new Set(Object.keys(recipesRecord));
      setImportInitialKeys(keys);
      setImportJobId(null);
      setImportError(null);
      setImportModalOpen(true);

      const fd = new FormData();
      fd.append('image', file);

      const res = await apiPost<{ success: boolean; status?: string; job_id?: string; message?: string; error?: string }>(
        'recipes/transcribe_photo',
        fd
      );

      if (!res.success) {
        setImportError(res.error || 'Failed to start transcription');
      } else if (res.job_id) {
        setImportJobId(res.job_id);
      }
    } catch (err: any) {
      setImportError(err?.message || 'Failed to upload recipe photo');
    }
  };

  const handleDeletePlannerCard = async (dateIso: string, cardId: string) => {
    try {
      await apiPost('meal_planner/card/delete', {
        date_iso: dateIso,
        card_id: cardId,
      });
      showToast('Removed meal from planner');
      await refresh();
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('meal_planner_refresh'));
    } catch (err: any) {
      showToast(err?.message || 'Failed to remove meal', { type: 'error' });
    }
  };

  const handleAddRecipeIngredientsToShopping = async (recipe: RecipeItem) => {
    const ings = recipe.ingredients || [];
    if (ings.length === 0) {
      showToast('No ingredients listed for this recipe', { type: 'warning' });
      return;
    }
    try {
      await apiPost('shopping/batch_add', {
        items: ings.map((i: any) => ({
          name: i.raw_name || i.name,
          qty: i.qty || '',
          store: i.store || stores[0]?.id || 'aldi',
        })),
      });
      showToast(`Added ${ings.length} ingredients from "${recipe.title}" to shopping list!`);
      await refresh();
    } catch (err: any) {
      showToast(err?.message || 'Failed to add ingredients', { type: 'error' });
    }
  };

  const handleSaveRecipeEdits = async (updated: RecipeItem) => {
    try {
      const res = await apiPost<{ success: boolean; error?: string }>('recipes/save', {
        meal_key: updated.meal_key,
        title: updated.title,
        prep_time: updated.prep_time,
        servings: updated.servings,
        instructions: updated.instructions,
        ingredients: updated.ingredients,
      });
      if (res.success) {
        showToast(`Saved recipe "${updated.title}"!`, { type: 'success' });
        setEditingRecipe(null);
        await refresh();
      } else {
        showToast(res.error || 'Failed to save recipe', { type: 'error' });
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to save recipe', { type: 'error' });
    }
  };

  const handleDeleteRecipe = async (mealKey: string) => {
    try {
      const res = await apiPost<{ success: boolean; error?: string }>('recipes/delete', {
        meal_key: mealKey,
      });
      if (res.success) {
        showToast('Recipe deleted successfully');
        setEditingRecipe(null);
        if (activeRecipe?.meal_key === mealKey) {
          setActiveRecipe(null);
        }
        await refresh();
      } else {
        showToast(res.error || 'Failed to delete recipe', { type: 'error' });
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete recipe', { type: 'error' });
    }
  };

  return (
    <>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handlePhotoUpload(file);
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
          if (file) handlePhotoUpload(file);
          e.target.value = '';
        }}
      />

      {(subView === 'all' || subView === 'meals') && (
        <MealPlannerSection
          isStandalonePage={isStandalonePage}
          onOpenRecipeModal={handleOpenRecipe}
          onAddRecipe={() => setAddChoiceModalOpen(true)}
        />
      )}

      {(subView === 'all' || subView === 'shopping') && (
        <ShoppingListSection isStandalonePage={isStandalonePage} />
      )}

      {(subView === 'all' || subView === 'library') && (
        <RecipeLibrarySection isStandalonePage={isStandalonePage} />
      )}

      <Modal
        open={addChoiceModalOpen}
        onClose={() => setAddChoiceModalOpen(false)}
        title="Add Recipe"
        icon="fas fa-utensils"
        maxWidth={460}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            type="button"
            onClick={() => {
              setAddChoiceModalOpen(false);
              cameraInputRef.current?.click();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 16px',
              borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.25) 100%)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              color: '#f8fafc',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'transform 0.12s ease',
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                background: 'rgba(59, 130, 246, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                color: '#60a5fa',
                flexShrink: 0,
              }}
            >
              <i className="fas fa-camera" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.94rem' }}>Take Photo (Camera)</div>
              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                Snap a picture of a cookbook, magazine, or handwritten recipe card.
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setAddChoiceModalOpen(false);
              fileInputRef.current?.click();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 16px',
              borderRadius: 10,
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#f8fafc',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.15s ease',
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                color: '#e2e8f0',
                flexShrink: 0,
              }}
            >
              <i className="fas fa-image" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.94rem' }}>Upload Photo / Screenshot</div>
              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                Upload an existing photo from your gallery or screenshot folder.
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setAddChoiceModalOpen(false);
              setEditingRecipe({
                meal_key: '',
                title: '',
                image_url: null,
                ingredients: [],
                instructions: '',
                servings: '4',
                prep_time: '25 mins',
              });
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 16px',
              borderRadius: 10,
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#f8fafc',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.15s ease',
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                color: '#e2e8f0',
                flexShrink: 0,
              }}
            >
              <i className="fas fa-pen-to-square" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.94rem' }}>Create Blank Recipe</div>
              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                Type out title, ingredients, and instructions manually.
              </div>
            </div>
          </button>
        </div>
      </Modal>

      <RecipeViewModal
        recipe={activeRecipe}
        onClose={() => setActiveRecipe(null)}
        isChild={Boolean(isChild)}
        onAddToShopping={handleAddRecipeIngredientsToShopping}
        onEdit={(r) => setEditingRecipe(r)}
        onDeleteCard={handleDeletePlannerCard}
      />

      <RecipeEditModal
        recipe={editingRecipe}
        open={Boolean(editingRecipe)}
        onClose={() => setEditingRecipe(null)}
        stores={stores}
        onSave={handleSaveRecipeEdits}
        onDelete={handleDeleteRecipe}
        onTranscribePhoto={handlePhotoUpload}
        onNavigateToSettings={() => setActiveView('settings')}
      />

      <ImportingRecipeModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        jobId={importJobId}
        initialRecipeKeys={importInitialKeys}
        errorMessage={importError}
        onRecipeReady={(newRecipe) => {
          showToast(`✨ Recipe "${newRecipe.title}" transcribed and ready!`, { type: 'success' });
          setActiveRecipe(newRecipe);
          refresh();
        }}
        onNavigateToSettings={() => setActiveView('settings')}
      />
    </>
  );
};

export default MealAndShoppingSection;
