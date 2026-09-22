'use client';

import { useState } from 'react';
import type { MealSuggestionResponse } from '../services/ai';

export default function Home() {
  const [mealRequest, setMealRequest] = useState('');
  const [mealResponse, setMealResponse] = useState<MealSuggestionResponse | null>(null);
  const [mealLoading, setMealLoading] = useState(false);
  const [mealError, setMealError] = useState('');

  async function handleMealSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (mealLoading) return;

    setMealError('');
    setMealResponse(null);
    const userRequest = mealRequest.trim();
    if (!userRequest) {
      setMealError('Enter a request for meal suggestions.');
      return;
    }

    setMealLoading(true);
    try {
      const response = await fetch('/api/ai/suggest-meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userRequest }),
      });
      if (!response.ok) {
        setMealError('We could not get meal suggestions. Please try again. If this continues, check that the local AI server is running.');
        return;
      }
      const data: MealSuggestionResponse = await response.json();
      if (!data || !Array.isArray(data.suggestions) || data.suggestions.some((suggestion) =>
        !suggestion || typeof suggestion.name !== 'string' || typeof suggestion.description !== 'string'
      )) {
        throw new Error('Invalid meal suggestions response.');
      }
      setMealResponse(data);
    } catch {
      setMealError('We could not load meal suggestions. Please check your connection and try again.');
    } finally {
      setMealLoading(false);
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="mealSuggestionsHeading">
      <h1 id="mealSuggestionsHeading" className="text-2xl font-semibold">
        Meal Suggestions
      </h1>
      <form onSubmit={handleMealSubmit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="mealRequest" className="mb-1 block text-sm font-medium">
            What would you like to make?
          </label>
          <textarea
            id="mealRequest"
            value={mealRequest}
            onChange={(e) => setMealRequest(e.target.value)}
            placeholder="What should I make for dinner?"
            required
            disabled={mealLoading}
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled={mealLoading || !mealRequest.trim()}
          className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mealLoading ? 'Getting suggestions...' : 'Get Meal Suggestions'}
        </button>
      </form>

      {mealError && (
        <div role="alert" className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-red-700">
          {mealError}
        </div>
      )}
      <div aria-live="polite" aria-busy={mealLoading}>
        {mealLoading && (
          <p className="mt-4 text-gray-600">Finding meal ideas from your inventory. This may take a moment.</p>
        )}
        {mealResponse && mealResponse.suggestions.length === 0 && (
          <p className="mt-4 text-gray-600">
            No meal suggestions were found. Try a different request or add more food to your inventory.
          </p>
        )}
        {mealResponse && mealResponse.suggestions.length > 0 && (
          <div className="mt-4 space-y-4">
            {mealResponse.suggestions.map((suggestion, index) => (
              <div key={index} className="rounded-md border border-gray-300 p-4">
                <h3 className="text-lg font-semibold">{suggestion.name}</h3>
                <p className="mt-2 text-sm text-gray-700">{suggestion.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
