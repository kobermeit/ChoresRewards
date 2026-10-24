import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { apiPost } from '../../api';
import { RecipeItem, MealIngredient, ShoppingStore } from '../../types';
import { PageContainer, Button } from '../../components/ui';
import { RecipeCard } from './components/RecipeCard';
import { RecipeViewModal } from './components/RecipeViewModal';
import { RecipeEditModal } from './components/RecipeEditModal';

export interface RecipeLibrarySectionProps {
  isStandalonePage?: boolean;
}

export const RecipeLibrarySection: React.FC<RecipeLibrarySectionProps> = ({
  isStandalonePage = false,
}) => {
  const { data, refresh, showToast, isChild } = useApp();

  const [notionSyncing, setNotionSyncing] = useState(false);
  const [activeRecipe, setActiveRecipe] = useState<RecipeItem | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<RecipeItem | null>(null);

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

  const recipesRecord: Record<string, RecipeItem> = useMemo(() => {
    const map: Record<string, RecipeItem> = {};
    allLibraryRecipes.forEach((r) => {
      if (r.meal_key) map[r.meal_key.toLowerCase()] = r;
      if (r.title) map[r.title.toLowerCase()] = r;
    });
    return map;
  }, [allLibraryRecipes]);

  const mealImages: Record<string, string> = data?.meal_images || {};

  const handleSyncNotion = async () => {
    setNotionSyncing(true);
    try {
      const res = await apiPost<{ success: boolean; synced_count?: number; synced?: number; error?: string }>(
        'recipes/sync_notion',
        {}
      );
      if (res.success) {
        const count = res.synced_count ?? res.synced ?? 0;
        showToast(`✨ Synced ${count} recipes from Notion!`, { type: 'success' });
        await refresh();
      } else {
        showToast(res.error || 'Notion sync failed', { type: 'error' });
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to sync with Notion', { type: 'error' });
    } finally {
      setNotionSyncing(false);
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

  return (
    <PageContainer
      title="Meal Library & Recipes"
      icon="fas fa-book-open"
      iconClass="section-icon-library"
      badge={allLibraryRecipes.length}
      boxed={!isStandalonePage}
      actions={
        <Button
          variant="secondary"
          size="sm"
          icon={notionSyncing ? 'fas fa-spinner fa-spin' : 'fas fa-arrows-rotate'}
          onClick={(e) => {
            e.stopPropagation();
            handleSyncNotion();
          }}
          disabled={notionSyncing}
          title="Sync recipes directly from Notion database"
        >
          {notionSyncing ? 'Syncing...' : 'Sync from Notion'}
        </Button>
      }
    >
      <div className="shopping-ingredients-library" id="shopping-ingredients-library">
        {allLibraryRecipes.length === 0 ? (
          <div className="shopping-empty-msg" style={{ margin: '8px 0' }}>
            No meals in library yet. Sync from Notion or plan a custom meal above.
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
              const isSynced = Boolean(fullRecipe?.notion_id);

              return (
                <RecipeCard
                  key={mealKey}
                  recipe={recipe}
                  fullRecipe={fullRecipe}
                  items={items}
                  imageUrl={imageUrl}
                  displayName={displayName}
                  isSynced={isSynced}
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
      />
    </PageContainer>
  );
};

export default RecipeLibrarySection;
