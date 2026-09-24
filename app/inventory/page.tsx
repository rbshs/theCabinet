'use client';

import { useEffect, useState } from 'react';
import {
  fetchInventory as fetchInventoryItems,
  updateInventoryItem,
  deleteInventoryItem,
} from '../../lib/inventory';
import type { InventoryItem, StorageLocation } from '../../src/types/inventory';
import AddInventoryForm from './AddInventoryForm';

export default function InventoryPage() {
  const [adding, setAdding] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState('');
  const [search, setSearch] = useState('');
  const [storageFilter, setStorageFilter] = useState<StorageLocation | ''>('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const categories = Array.from(new Set([
    ...inventoryItems.map((item) => item.category).filter((category): category is string => Boolean(category)),
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
    useState<StorageLocation | ''>('');
  const [editCategory, setEditCategory] = useState('');
  const [editExpirationDate, setEditExpirationDate] = useState('');
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
    // Existing filters must not hide an item the user just added.
    setSearch('');
    setStorageFilter('');
    setCategoryFilter('');
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
    setEditQuantity(item.quantity !== null ? String(item.quantity) : '');
    setEditUnit(item.unit ?? '');
    setEditStorageLocation(item.storage_location ?? '');
    setEditCategory(item.category ?? '');
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

    setEditLoading(true);

    try {
      const { data, error } = await updateInventoryItem(itemId, {
        name: editName.trim(),
        quantity: editQuantity ? Number(editQuantity) : null,
        unit: editUnit.trim() || null,
        storage_location: editStorageLocation || null,
        category: editCategory.trim() || null,
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
                          Storage Location
                        </label>
                        <select
                          value={editStorageLocation}
                          onChange={(e) =>
                            setEditStorageLocation(
                              e.target.value as StorageLocation | ''
                            )
                          }
                          className="w-full rounded-md border border-gray-300 px-3 py-2"
                        >
                          <option value="">Not specified</option>
                          <option value="pantry">Pantry</option>
                          <option value="refrigerator">
                            Refrigerator
                          </option>
                          <option value="freezer">Freezer</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-sm font-medium">
                          Category
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
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
                          {item.storage_location ?? 'Not specified'}
                        </p>

                        <p>
                          <span className="font-medium">
                            Category:
                          </span>{' '}
                          {item.category ?? 'Not specified'}
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
  );
}
