'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { saveRecipe } from '../lib/recipes';
import type { Recipe } from '../src/types/recipe';

export default function SaveRecipeButton({ recipe }: { recipe: Recipe }) {
  const saveId = useRef<string | null>(null);
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (busy.current || saved) return;
    busy.current = true;
    setSaving(true);
    setError('');
    try {
      saveId.current ??= crypto.randomUUID();
      const { error: saveError } = await saveRecipe(saveId.current, recipe);
      if (saveError) throw saveError;
      setSaved(true);
    } catch {
      setError('We could not save this recipe. Please try again.');
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 space-y-2">
      <button type="button" onClick={handleSave} disabled={saving || saved}
        className="rounded-md border border-blue-600 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50">
        {saved ? 'Recipe saved' : saving ? 'Saving...' : 'Save Recipe'}
      </button>
      {saved && <p role="status" className="text-sm text-green-800">
        Saved to <Link href="/recipes" className="underline">Saved Recipes</Link>.
      </p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
