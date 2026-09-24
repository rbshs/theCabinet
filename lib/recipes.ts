import { supabase } from './supabaseClient';
import { validateRecipe } from './recipe';
import type { Recipe, SavedRecipe } from '../src/types/recipe';

const recipeColumns = 'id, title, description, yield, ingredients, steps, notes, source, created_at';

export async function fetchSavedRecipes() {
  return supabase.from('saved_recipes').select(recipeColumns)
    .order('created_at', { ascending: false }).returns<SavedRecipe[]>();
}

export async function saveRecipe(id: string, recipe: Recipe) {
  // Reuse the same ID on retries. A lost success response must not create a second row.
  return supabase.from('saved_recipes').upsert(
    { id, ...validateRecipe(recipe), source: 'ai_generated' },
    { onConflict: 'id', ignoreDuplicates: true },
  );
}

export async function deleteSavedRecipe(id: string) {
  return supabase.from('saved_recipes').delete().eq('id', id).select('id').single<{ id: string }>();
}
