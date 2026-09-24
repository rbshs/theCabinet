'use client';

import { useEffect, useState } from 'react';
import {
  fetchInventory as fetchInventoryItems,
  updateInventoryItem,
  deleteInventoryItem,
} from '../../lib/inventory';
import type { InventoryItem } from '../../src/types/inventory';
import AddInventoryForm from './AddInventoryForm';

export default function InventoryPage() {
  const [adding, setAdding] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState('');
  const [search, setSearch] = useState('');

  const searchTerm = search.trim().toLowerCase();
  const filteredInventoryItems = inventoryItems.filter((item) =>
    item.name.toLowerCase().includes(searchTerm)
  );

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  async function fetchInventory() {
    setInventoryLoading(true);
    setInventoryError('');

    try {
      const { data, error } = await fetchInventoryItems();
      if (error) {
        throw new Error(error.message);
      }
      setInventoryItems(data ?? []);
    } catch (err) {
      console.error(err);
      setInventoryError(err instanceof Error
        ? `Failed to load inventory: ${err.message}`
        : 'Failed to load inventory.');
      setInventoryItems([]);
    } finally {
      setInventoryLoading(false);
    }
  }

  async function handleItemsAdded() {
    // The current search must not hide an item the user just added.
    setSearch('');
    await fetchInventory();
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

    setEditLoading(true);

    try {
      const { data, error } = await updateInventoryItem(itemId, {
        name: editName.trim(),
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

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <button type="button" onClick={() => setAdding((current) => !current)}
          aria-expanded={adding} aria-controls="addInventorySection"
          className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">
          {adding ? 'Hide add form' : 'Add Item'}
        </button>
      </div>
      <div id="addInventorySection" hidden={!adding} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <AddInventoryForm onAdded={handleItemsAdded} />
      </div>

      <div className="mt-4">
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
      </div>
      <button
        type="button"
        onClick={() => {
          setSearch('');
        }}
        className="mt-4 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50"
      >
        Clear search
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
          <button type="button" onClick={() => void fetchInventory()} disabled={inventoryLoading}
            className="ml-2 font-medium underline disabled:opacity-50">Retry loading inventory</button>
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
            No food items match your search.
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
                    <h3 className="break-words text-lg font-semibold">
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
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {item.name}
                      </h3>

                      <div className="mt-2 space-y-1 text-sm text-gray-700">
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
  );
}
