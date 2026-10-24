import React, { useState } from 'react';
import { MealPlannerSection } from '../features/meals/MealPlannerSection';
import { ShoppingListSection } from '../features/shopping/ShoppingListSection';
import { RecipeLibrarySection } from '../features/meals/RecipeLibrarySection';
import { RecipeViewModal } from '../features/meals/components/RecipeViewModal';
import { RecipeEditModal } from '../features/meals/components/RecipeEditModal';
import { RecipeItem, ShoppingStore } from '../types';
import { useApp } from '../context/AppContext';
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
  const [activeRecipe, setActiveRecipe] = useState<RecipeItem | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<RecipeItem | null>(null);

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
    const recipeObj = recipesRecord[key] || {
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

  const handleDeletePlannerCard = async (dateIso: string, cardId: string) => {
    try {
      await apiPost('meal_planner/card/delete', {
        date_iso: dateIso,
        card_id: cardId,
      });
      showToast('Removed meal from planner');
      await refresh();
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

  return (
    <>
      {(subView === 'all' || subView === 'meals') && (
        <MealPlannerSection
          isStandalonePage={isStandalonePage}
          onOpenRecipeModal={handleOpenRecipe}
        />
      )}

      {(subView === 'all' || subView === 'shopping') && (
        <ShoppingListSection isStandalonePage={isStandalonePage} />
      )}

      {(subView === 'all' || subView === 'library') && (
        <RecipeLibrarySection isStandalonePage={isStandalonePage} />
      )}

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
      />
    </>
  );
};

export default MealAndShoppingSection;
