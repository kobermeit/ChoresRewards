import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { apiPost } from '../../api';
import { RecipeItem, MealIngredient, ShoppingStore } from '../../types';
import { PageContainer, Button } from '../../components/ui';
import { Modal } from '../../components/common/Modal';
import { RecipeCard } from './components/RecipeCard';
import { RecipeViewModal } from './components/RecipeViewModal';
import { RecipeEditModal } from './components/RecipeEditModal';
import { ImportingRecipeModal } from './components/ImportingRecipeModal';
import { useNavigation } from '../../hooks/useSettings';

export interface RecipeLibrarySectionProps {
  isStandalonePage?: boolean;
}

export const RecipeLibrarySection: React.FC<RecipeLibrarySectionProps> = ({
  isStandalonePage = false,
}) => {
  const { data, refresh, showToast, isChild } = useApp();
  const { navigate: setActiveView } = useNavigation();

  const [activeRecipe, setActiveRecipe] = useState<RecipeItem | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<RecipeItem | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importInitialKeys, setImportInitialKeys] = useState<Set<string>>(new Set());
  const [importJobId, setImportJobId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevRecipeKeysRef = useRef<Set<string>>(new Set());

  const stores: ShoppingStore[] = useMemo(() => {
    return data?.shopping_list?.stores && data.shopping_list.stores.length > 0
      ? data.shopping_list.stores
      : [
          { id: 'aldi', name: 'Aldi', icon: '🛒' },
          { id: 'coles', name: 'Coles', icon: '🏪' },
          { id: 'woolies', name: 'Woolworths', icon: '🍎' },
        ];
  }, [data?.shopping_list?.stores]);

  const ingredientsMap: Record<string, MealIngredient[]> = data?.meal_ingredients || {};

  const allLibraryRecipes: RecipeItem[] = useMemo(() => {
    return Array.isArray(data?.recipes) ? data.recipes : [];
  }, [data?.recipes]);

  // Notify when a background AI transcription completes and appears in the recipe list
  useEffect(() => {
    const currentKeys = new Set(allLibraryRecipes.map((r) => r.meal_key));
    if (prevRecipeKeysRef.current.size > 0) {
      for (const r of allLibraryRecipes) {
        if (!prevRecipeKeysRef.current.has(r.meal_key)) {
          showToast(`✨ Recipe "${r.title}" transcribed and ready!`, { type: 'success' });
          break;
        }
      }
    }
    prevRecipeKeysRef.current = currentKeys;
  }, [allLibraryRecipes, showToast]);

  const recipesRecord: Record<string, RecipeItem> = useMemo(() => {
    const map: Record<string, RecipeItem> = {};
    allLibraryRecipes.forEach((r) => {
      if (r.meal_key) map[r.meal_key.toLowerCase()] = r;
      if (r.title) map[r.title.toLowerCase()] = r;
    });
    return map;
  }, [allLibraryRecipes]);

  const mealImages: Record<string, string> = data?.meal_images || {};

  const handlePhotoUpload = async (file: File) => {
    if (!file) return;
    try {
      const keys = new Set(allLibraryRecipes.map((r) => String(r.meal_key || r.title || '').toLowerCase().trim()));
      setImportInitialKeys(keys);
      setImportJobId(null);
      setImportError(null);
      setImportModalOpen(true);
      setAddModalOpen(false);
      setIsUploading(true);

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
    } finally {
      setIsUploading(false);
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
          in_pantry: Boolean(i.in_pantry),
        })),
      });
      showToast(`Added ingredients from "${recipe.title}" to shopping list!`);
      await refresh();
    } catch (err: any) {
      showToast(err?.message || 'Failed to add ingredients', { type: 'error' });
    }
  };

  return (
    <PageContainer
      title="Meal Library & Recipes"
      icon="fas fa-book-open"
      iconClass="section-icon-library"
      badge={allLibraryRecipes.length}
      boxed={!isStandalonePage}
      actions={
        !isChild ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button
              variant="primary"
              size="sm"
              icon="fas fa-plus"
              onClick={(e) => {
                e.stopPropagation();
                setAddModalOpen(true);
              }}
              title="Add a new recipe"
            >
              Add Recipe
            </Button>
          </div>
        ) : null
      }
    >
      {/* Hidden Native Camera & File Upload Inputs */}
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

      <div className="shopping-ingredients-library" id="shopping-ingredients-library">
        {allLibraryRecipes.length === 0 ? (
          <div className="shopping-empty-msg" style={{ margin: '8px 0' }}>
            No meals in library yet. Add a recipe or plan a custom meal above.
          </div>
        ) : (
          <div className="meal-card-grid">
            {allLibraryRecipes.map((recipe) => {
              const mealKey = recipe.meal_key;
              const fullRecipe = recipesRecord[mealKey];
              const rawItems = fullRecipe?.ingredients || ingredientsMap[mealKey] || [];
              const items: MealIngredient[] = Array.isArray(rawItems)
                ? rawItems
                    .map((it: any) =>
                      typeof it === 'string'
                        ? { name: it, qty: '', store: '' }
                        : it && typeof it === 'object'
                        ? { name: it.name || '', qty: it.qty || '', store: it.store || '' }
                        : null
                    )
                    .filter(Boolean) as MealIngredient[]
                : [];
              const imageUrl = recipe.image_url || mealImages[mealKey] || '';
              const displayName = recipe.title || mealKey;

              return (
                <RecipeCard
                  key={mealKey}
                  recipe={recipe}
                  fullRecipe={fullRecipe}
                  items={items}
                  imageUrl={imageUrl}
                  displayName={displayName}
                  isChild={Boolean(isChild)}
                  stores={stores}
                  onClick={() => setActiveRecipe(fullRecipe || recipe)}
                  onEdit={(r) => setEditingRecipe(r)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Add Recipe Choice Modal */}
      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add Recipe"
        icon="fas fa-utensils"
        maxWidth={460}
      >
        <p style={{ margin: '0 0 16px', fontSize: '0.86rem', color: 'rgba(255,255,255,0.7)' }}>
          Snap a photo of a recipe book page or card, upload a screenshot, or type in a new recipe manually.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={isUploading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 16px',
              borderRadius: 10,
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
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
                background: 'rgba(56, 189, 248, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                color: '#38bdf8',
                flexShrink: 0,
              }}
            >
              <i className="fas fa-camera" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.94rem' }}>Take Photo (Camera)</div>
              <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                Launches your phone or tablet camera to snap a recipe.
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
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
                Pick an existing image from your photo library or files.
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setAddModalOpen(false);
              setEditingRecipe({
                meal_key: '',
                title: '',
                ingredients: [],
                instructions: '',
                prep_time: '25 mins',
                servings: '4 servings',
              } as any);
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
    </PageContainer>
  );
};

export default RecipeLibrarySection;
