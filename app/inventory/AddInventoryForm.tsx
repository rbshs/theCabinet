'use client';

import { useRef, useState } from 'react';
import { insertInventoryItem } from '../../lib/inventory';
import InventoryImportReview from './InventoryImportReview';

export default function AddInventoryForm({ onAdded }: { onAdded: () => Promise<void> }) {
  const nameInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
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

    setLoading(true);

    const data = {
      name: name.trim(),
      note: note.trim() || null,
    };

    try {
      const { error } = await insertInventoryItem(data);

      if (error) {
        throw error;
      }

      setSuccess('Food added successfully. You can add another item below.');

      setName('');
      setNote('');

      nameInput.current?.focus();
      await onAdded();
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
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Add Item</h2>

      {error && (
        <div className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div role="status" className="mt-4 rounded-md border border-green-300 bg-green-50 p-3 text-green-700">
          {success}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="mt-6 grid grid-cols-1 gap-4"
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
            ref={nameInput}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2"
          />
        </div>

        <div className="min-w-0">
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

        <div className="min-w-0">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Adding...' : 'Add Food'}
          </button>
        </div>
      </form>
      <InventoryImportReview onAdded={onAdded} />
    </section>
  );
}
