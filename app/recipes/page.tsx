'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { deleteSavedRecipe, fetchSavedRecipes } from '../../lib/recipes';
import type { SavedRecipe } from '../../src/types/recipe';

export default function SavedRecipesPage() {
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deleting = useRef(false);

  async function loadRecipes() {
    setLoading(true);
    setLoadError('');
    try {
      const { data, error } = await fetchSavedRecipes();
      if (error || data === null) throw error ?? new Error('Recipes unavailable.');
      setRecipes(data);
    } catch {
      setLoadError('We could not load your saved recipes. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadRecipes(); }, []);

  async function handleDelete(recipe: SavedRecipe) {
    if (deleting.current || !window.confirm(`Delete "${recipe.title}" from Saved Recipes?`)) return;
    deleting.current = true;
    setDeletingId(recipe.id);
    setDeleteError('');
    try {
      const { error } = await deleteSavedRecipe(recipe.id);
      if (error) throw error;
      setRecipes((current) => current.filter((item) => item.id !== recipe.id));
    } catch {
      setDeleteError('We could not delete that recipe. Please try again.');
    } finally {
      deleting.current = false;
      setDeletingId(null);
    }
  }

  return (
    <section aria-labelledby="savedRecipesHeading" className="space-y-4">
      <div>
        <h1 id="savedRecipesHeading" className="text-2xl font-semibold">Saved Recipes</h1>
        <p className="mt-2 text-sm text-gray-600">Your saved recipes, ready to cook again.</p>
      </div>
      {loading && <p role="status" className="text-gray-600">Loading saved recipes...</p>}
      {loadError && <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-red-700">
        <p>{loadError}</p>
        <button type="button" onClick={loadRecipes} disabled={loading} className="mt-2 font-medium underline disabled:opacity-50">Try again</button>
      </div>}
      {deleteError && <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-red-700">{deleteError}</p>}
      {!loading && !loadError && recipes.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-5 text-gray-700">
          <p>No saved recipes yet.</p>
          <p className="mt-2 text-sm">Choose a meal with your assistant, then select Save Recipe to keep the cooking instructions here.</p>
          <Link href="/" className="mt-3 inline-block font-medium text-blue-700 underline">Find a meal to make</Link>
        </div>
      )}
      {!loading && !loadError && recipes.map((recipe) => (
        <article key={recipe.id} className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="break-words text-lg font-semibold">{recipe.title}</h2>
          {recipe.description && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-700">{recipe.description}</p>}
          <p className="mt-2 text-sm text-gray-500">Saved <time dateTime={recipe.created_at}>
            {new Date(recipe.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          </time></p>
          <details className="mt-4">
            <summary className="cursor-pointer font-medium text-blue-700">View full recipe</summary>
            <div className="mt-4 space-y-4 break-words">
              {recipe.yield && <p className="text-sm text-gray-700">{recipe.yield}</p>}
              <div>
                <h3 className="font-semibold">Ingredients</h3>
                <ul className="mt-2 list-disc space-y-1 pl-6">
                  {recipe.ingredients.map((ingredient, index) => (
                    <li key={index} className="whitespace-pre-wrap">
                      {[ingredient.quantity, ingredient.unit, ingredient.name].filter(Boolean).join(' ')}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold">Cooking instructions</h3>
                <ol className="mt-2 list-decimal space-y-3 pl-6">
                  {recipe.steps.map((step, index) => <li key={index} className="whitespace-pre-wrap">{step}</li>)}
                </ol>
              </div>
              {recipe.notes.length > 0 && <div>
                <h3 className="font-semibold">Cooking notes</h3>
                <ul className="mt-2 list-disc space-y-2 pl-6">
                  {recipe.notes.map((note, index) => <li key={index} className="whitespace-pre-wrap">{note}</li>)}
                </ul>
              </div>}
            </div>
          </details>
          <button type="button" onClick={() => handleDelete(recipe)} disabled={deletingId !== null}
            aria-label={`Delete saved recipe ${recipe.title}`}
            className="mt-4 rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">
            {deletingId === recipe.id ? 'Deleting...' : 'Delete recipe'}
          </button>
        </article>
      ))}
    </section>
  );
}
