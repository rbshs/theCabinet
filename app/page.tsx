'use client';

import { useEffect, useState } from 'react';
import {
  fetchInventory as fetchInventoryItems,
  insertInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
} from '../lib/inventory';
import type { InventoryItem, StorageLocation } from '../src/types/inventory';
import type { MealSuggestionResponse } from '../services/ai';

export default function Home() {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [storageLocation, setStorageLocation] =
    useState<StorageLocation>('pantry');
  const [category, setCategory] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [note, setNote] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState('');
  const [search, setSearch] = useState('');
  const [storageFilter, setStorageFilter] = useState<StorageLocation | ''>('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const categories = Array.from(new Set([
    ...inventoryItems.map((item) => item.category),
    ...(categoryFilter ? [categoryFilter] : []),
  ]));
  const searchTerm = search.trim().toLowerCase();
  const filteredInventoryItems = inventoryItems.filter((item) =>
    item.name.toLowerCase().includes(searchTerm) &&
    (!storageFilter || item.storage_location === storageFilter) &&
    (!categoryFilter || item.category === categoryFilter)
  );

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editStorageLocation, setEditStorageLocation] =
    useState<StorageLocation>('pantry');
  const [editCategory, setEditCategory] = useState('');
  const [editExpirationDate, setEditExpirationDate] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

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

  async function fetchInventory() {
    setInventoryLoading(true);
    setInventoryError('');

    const { data, error } = await fetchInventoryItems();

    if (error) {
      console.error(error);
      setInventoryError(`Failed to load inventory: ${error.message}`);
      setInventoryItems([]);
    } else {
      setInventoryItems(data ?? []);
    }

    setInventoryLoading(false);
  }

  useEffect(() => {
    fetchInventory();
  }, []);

  async function handleDelete(itemId: string) {
    const confirmed = window.confirm(
      'Are you sure you want to delete this item?'
    );

    if (!confirmed) {
      return;
    }

    setDeleteError('');
    setDeletingId(itemId);

    try {
      const { error } = await deleteInventoryItem(itemId);

      if (error) {
        throw error;
      }

      setInventoryItems((currentItems) =>
        currentItems.filter((item) => item.id !== itemId)
      );
    } catch (err) {
      console.error(err);
      setDeleteError(
        err instanceof Error
          ? `Failed to delete food item: ${err.message}`
          : 'Failed to delete food item.'
      );
    } finally {
      setDeletingId(null);
    }
  }

  function startEditing(item: InventoryItem) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditQuantity(item.quantity !== null ? String(item.quantity) : '');
    setEditUnit(item.unit ?? '');
    setEditStorageLocation(item.storage_location);
    setEditCategory(item.category);
    setEditExpirationDate(item.expiration_date ?? '');
    setEditNote(item.note ?? '');
    setEditError('');
  }

  function cancelEditing() {
    setEditingId(null);
    setEditError('');
  }

  async function handleUpdate(itemId: string) {
    setEditError('');

    if (!editName.trim()) {
      setEditError('Name is required.');
      return;
    }

    if (!editCategory.trim()) {
      setEditError('Category is required.');
      return;
    }

    setEditLoading(true);

    try {
      const { data, error } = await updateInventoryItem(itemId, {
        name: editName.trim(),
        quantity: editQuantity ? Number(editQuantity) : null,
        unit: editUnit.trim() || null,
        storage_location: editStorageLocation,
        category: editCategory.trim(),
        expiration_date: editExpirationDate || null,
        note: editNote.trim() || null,
      });

      if (error) {
        throw error;
      }

      setInventoryItems((items) =>
        items.map((item) =>
          item.id === itemId ? data : item
        )
      );

      setEditingId(null);
    } catch (err) {
      console.error(err);
      setEditError(
        err instanceof Error
          ? `Failed to update food item: ${err.message}`
          : 'Failed to update food item.'
      );
    } finally {
      setEditLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError('');
    setSuccess('');

    if (!name.trim()) {
      setError('Name is required.');
      return;
    }

    if (!category.trim()) {
      setError('Category is required.');
      return;
    }

    setLoading(true);

    const data = {
      name: name.trim(),
      quantity: quantity ? Number(quantity) : null,
      unit: unit.trim() || null,
      storage_location: storageLocation,
      category: category.trim(),
      expiration_date: expirationDate || null,
      note: note.trim() || null,
    };

    try {
      const { error } = await insertInventoryItem(data);

      if (error) {
        throw error;
      }

      setSuccess('Food added successfully.');

      setName('');
      setQuantity('');
      setUnit('');
      setStorageLocation('pantry');
      setCategory('');
      setExpirationDate('');
      setNote('');

      await fetchInventory();
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? `Failed to add food item: ${err.message}`
          : 'Failed to add food item.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold">The Cabinet</h1>
        <p className="mt-2 text-gray-600">
          Keep track of the food you have available.
        </p>

        <section className="mt-8" aria-labelledby="mealSuggestionsHeading">
          <h2 id="mealSuggestionsHeading" className="text-2xl font-semibold">
            Meal Suggestions
          </h2>
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

        <section className="mt-8">
          <h2 className="text-2xl font-semibold">Add Food</h2>

          {error && (
            <div className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-4 rounded-md border border-green-300 bg-green-50 p-3 text-green-700">
              {success}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            <div>
              <label
                htmlFor="name"
                className="mb-1 block text-sm font-medium"
              >
                Name *
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>

            <div>
              <label
                htmlFor="quantity"
                className="mb-1 block text-sm font-medium"
              >
                Quantity
              </label>
              <input
                id="quantity"
                type="number"
                min="0"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>

            <div>
              <label
                htmlFor="unit"
                className="mb-1 block text-sm font-medium"
              >
                Unit
              </label>
              <input
                id="unit"
                type="text"
                placeholder="lbs, cans, pieces..."
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>

            <div>
              <label
                htmlFor="storageLocation"
                className="mb-1 block text-sm font-medium"
              >
                Storage Location *
              </label>
              <select
                id="storageLocation"
                value={storageLocation}
                onChange={(e) =>
                  setStorageLocation(e.target.value as StorageLocation)
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              >
                <option value="pantry">Pantry</option>
                <option value="refrigerator">Refrigerator</option>
                <option value="freezer">Freezer</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="category"
                className="mb-1 block text-sm font-medium"
              >
                Category *
              </label>
              <input
                id="category"
                type="text"
                placeholder="Meat, dairy, produce..."
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>

            <div>
              <label
                htmlFor="expirationDate"
                className="mb-1 block text-sm font-medium"
              >
                Expiration Date
              </label>
              <input
                id="expirationDate"
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="note"
                className="mb-1 block text-sm font-medium"
              >
                Note
              </label>
              <textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? 'Adding...' : 'Add Food'}
              </button>
            </div>
          </form>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold">Inventory</h2>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label htmlFor="inventorySearch" className="mb-1 block text-sm font-medium">
                Search food names
              </label>
              <input
                id="inventorySearch"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name..."
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="storageFilter" className="mb-1 block text-sm font-medium">
                Filter by storage
              </label>
              <select
                id="storageFilter"
                value={storageFilter}
                onChange={(e) => setStorageFilter(e.target.value as StorageLocation | '')}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              >
                <option value="">All locations</option>
                <option value="pantry">Pantry</option>
                <option value="refrigerator">Refrigerator</option>
                <option value="freezer">Freezer</option>
              </select>
            </div>
            <div>
              <label htmlFor="categoryFilter" className="mb-1 block text-sm font-medium">
                Filter by category
              </label>
              <select
                id="categoryFilter"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2"
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setStorageFilter('');
              setCategoryFilter('');
            }}
            className="mt-4 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Clear filters
          </button>

          {deleteError && (
            <div className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-red-700">
              {deleteError}
            </div>
          )}

          {inventoryLoading && (
            <p className="mt-4 text-gray-600">Loading inventory...</p>
          )}

          {inventoryError && (
            <div className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-red-700">
              {inventoryError}
            </div>
          )}

          {!inventoryLoading &&
            !inventoryError &&
            inventoryItems.length === 0 && (
              <p className="mt-4 text-gray-600">
                No food items have been added yet.
              </p>
            )}

          {!inventoryLoading &&
            !inventoryError &&
            inventoryItems.length > 0 &&
            filteredInventoryItems.length === 0 && (
              <p className="mt-4 text-gray-600">
                No food items match your filters.
              </p>
            )}

          {!inventoryLoading &&
            !inventoryError &&
            filteredInventoryItems.length > 0 && (
              <div className="mt-4 space-y-4">
                {filteredInventoryItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-md border border-gray-300 p-4"
                  >
                    {editingId === item.id ? (
                      <div className="space-y-4">
                        <h3 className="text-lg font-semibold">
                          Edit Food
                        </h3>

                        {editError && (
                          <div className="rounded-md border border-red-300 bg-red-50 p-3 text-red-700">
                            {editError}
                          </div>
                        )}

                        <div>
                          <label className="mb-1 block text-sm font-medium">
                            Name *
                          </label>
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full rounded-md border border-gray-300 px-3 py-2"
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-sm font-medium">
                              Quantity
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={editQuantity}
                              onChange={(e) =>
                                setEditQuantity(e.target.value)
                              }
                              className="w-full rounded-md border border-gray-300 px-3 py-2"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-sm font-medium">
                              Unit
                            </label>
                            <input
                              type="text"
                              value={editUnit}
                              onChange={(e) => setEditUnit(e.target.value)}
                              className="w-full rounded-md border border-gray-300 px-3 py-2"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-sm font-medium">
                              Storage Location *
                            </label>
                            <select
                              value={editStorageLocation}
                              onChange={(e) =>
                                setEditStorageLocation(
                                  e.target.value as StorageLocation
                                )
                              }
                              className="w-full rounded-md border border-gray-300 px-3 py-2"
                            >
                              <option value="pantry">Pantry</option>
                              <option value="refrigerator">
                                Refrigerator
                              </option>
                              <option value="freezer">Freezer</option>
                            </select>
                          </div>

                          <div>
                            <label className="mb-1 block text-sm font-medium">
                              Category *
                            </label>
                            <input
                              type="text"
                              value={editCategory}
                              onChange={(e) =>
                                setEditCategory(e.target.value)
                              }
                              className="w-full rounded-md border border-gray-300 px-3 py-2"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-sm font-medium">
                              Expiration Date
                            </label>
                            <input
                              type="date"
                              value={editExpirationDate}
                              onChange={(e) =>
                                setEditExpirationDate(e.target.value)
                              }
                              className="w-full rounded-md border border-gray-300 px-3 py-2"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="mb-1 block text-sm font-medium">
                            Note
                          </label>
                          <textarea
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            rows={3}
                            className="w-full rounded-md border border-gray-300 px-3 py-2"
                          />
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdate(item.id)}
                            disabled={editLoading}
                            className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {editLoading ? 'Saving...' : 'Save Changes'}
                          </button>

                          <button
                            type="button"
                            onClick={cancelEditing}
                            disabled={editLoading}
                            className="rounded-md border border-gray-300 px-4 py-2 font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg font-semibold">
                            {item.name}
                          </h3>

                          <div className="mt-2 space-y-1 text-sm text-gray-700">
                            {(item.quantity !== null || item.unit) && (
                              <p>
                                <span className="font-medium">
                                  Quantity:
                                </span>{' '}
                                {item.quantity !== null
                                  ? item.quantity
                                  : ''}
                                {item.quantity !== null && item.unit
                                  ? ' '
                                  : ''}
                                {item.unit ?? ''}
                              </p>
                            )}

                            <p>
                              <span className="font-medium">
                                Storage:
                              </span>{' '}
                              {item.storage_location}
                            </p>

                            <p>
                              <span className="font-medium">
                                Category:
                              </span>{' '}
                              {item.category}
                            </p>

                            {item.expiration_date && (
                              <p>
                                <span className="font-medium">
                                  Expiration:
                                </span>{' '}
                                {item.expiration_date}
                              </p>
                            )}

                            {item.note && (
                              <p>
                                <span className="font-medium">
                                  Note:
                                </span>{' '}
                                {item.note}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEditing(item)}
                            disabled={deletingId === item.id}
                            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            disabled={deletingId === item.id}
                            className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingId === item.id
                              ? 'Deleting...'
                              : 'Delete'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
        </section>
      </div>
    </main>
  );
}
