'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type StorageLocation = 'pantry' | 'refrigerator' | 'freezer';

export default function Home() {
  console.log(
  'SUPABASE ENV:',
  process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING'
);
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
      const { error } = await supabase
        .from('inventory_items')
        .insert(data);

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
      </div>
    </main>
  );
}