'use client';

import { useRef, useState } from 'react';
import type { InventoryImportItem } from '../../services/ai';
import { validateInventoryImport } from '../../services/ai/inventoryImport';
import { createReviewRows, saveReviewedItems } from '../../lib/inventoryImportReview';
import type { InventoryReviewRow } from '../../lib/inventoryImportReview';

const inputClass = 'mt-1 w-full rounded-md border border-gray-300 px-3 py-2';
const buttonClass = 'rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50';

export default function InventoryImportReview({ onAdded }: { onAdded: () => Promise<void> }) {
  const [text, setText] = useState('');
  const [rows, setRows] = useState<InventoryReviewRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const busy = useRef(false);

  async function importText(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || !text.trim()) return;
    busy.current = true;
    setImporting(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/ai/import-inventory', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      });
      if (!response.ok) throw new Error('Import failed.');
      const result = validateInventoryImport(await response.json());
      setRows(createReviewRows(result.items));
    } catch {
      setError('We could not extract food items. Check that the local AI server is running and try again. Your text has been kept.');
    } finally {
      setImporting(false);
      busy.current = false;
    }
  }

  function updateItem(key: number, patch: Partial<InventoryImportItem>) {
    setRows((current) => current?.map((row) => row.key === key ? { ...row, item: { ...row.item, ...patch } } : row) ?? null);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || !rows?.some((row) => row.selected)) return;
    busy.current = true;
    setSaving(true);
    setError('');
    setSuccess('');
    let saved = 0;
    try {
      await saveReviewedItems(rows, (key) => {
        saved++;
        setRows((current) => current?.filter((row) => row.key !== key) ?? null);
      });
      setSuccess(`${saved} item${saved === 1 ? '' : 's'} added to inventory.`);
      setText('');
      setRows(null);
    } catch {
      setError(`${saved ? `${saved} item${saved === 1 ? '' : 's'} saved and removed from this list. ` : ''}Unable to finish saving. Check the remaining selected names, then retry. If your connection dropped, check Inventory before retrying.`);
    } finally {
      // Refresh even when only part of the reviewed batch was saved.
      if (saved > 0) await onAdded();
      setSaving(false);
      busy.current = false;
    }
  }

  return (
    <section aria-labelledby="textImportHeading" className="mt-10 border-t border-gray-200 pt-8">
      <h2 id="textImportHeading" className="text-2xl font-semibold">Import from text</h2>
      <p className="mt-2 text-sm text-gray-600">Paste a food list, then review the proposed items. Nothing is saved until you choose Add selected items.</p>
      <form onSubmit={importText} className="mt-4 space-y-4">
        <label className="block text-sm font-medium">
          Food list
          <textarea value={text} onChange={(event) => setText(event.target.value)} required rows={5}
            disabled={importing || saving} className={inputClass}
            placeholder={'chicken thighs\neggs\nbagels\nshredded cheddar cheese\nfrozen broccoli'} />
        </label>
        <button type="submit" disabled={importing || saving || !text.trim() || Boolean(rows?.length)} className={buttonClass}>
          {importing ? 'Extracting items...' : 'Review imported items'}
        </button>
        {Boolean(rows?.length) && <p className="text-sm text-gray-600">Save or remove the current proposals before importing another list.</p>}
      </form>

      {error && <p role="alert" className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-red-700">{error}</p>}
      {success && <p role="status" className="mt-4 rounded-md border border-green-300 bg-green-50 p-3 text-green-700">{success}</p>}
      {importing && <p role="status" className="mt-4 text-gray-600">Extracting food items. This may take a moment.</p>}
      {rows?.length === 0 && <p role="status" className="mt-4 text-gray-600">No proposed items to review. Enter a food list and try again.</p>}

      {Boolean(rows?.length) && (
        <form onSubmit={save} noValidate className="mt-6 space-y-4">
          <h3 className="text-lg font-semibold">Proposed items — not yet saved</h3>
          {rows?.map((row, index) => (
            <fieldset key={row.key} disabled={saving || importing} className="rounded-md border border-gray-300 p-4">
              <legend className="px-1 text-sm font-medium">Item {index + 1}</legend>
              <div className="mb-4 flex items-center justify-between gap-4">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={row.selected} onChange={(event) => {
                    const selected = event.target.checked;
                    setRows((current) => current?.map((entry) => entry.key === row.key ? { ...entry, selected } : entry) ?? null);
                  }} /> Add this item
                </label>
                <button type="button" onClick={() => setRows((current) => current?.filter((entry) => entry.key !== row.key) ?? null)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50">Remove</button>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <label className="text-sm font-medium">Name *
                  <input className={inputClass} value={row.item.name} required={row.selected}
                    onChange={(event) => updateItem(row.key, { name: event.target.value })} />
                </label>
                <label className="text-sm font-medium">Note
                  <textarea className={inputClass} rows={2} value={row.item.note ?? ''} onChange={(event) => updateItem(row.key, { note: event.target.value || null })} />
                </label>
              </div>
            </fieldset>
          ))}
          <button type="submit" disabled={saving || importing || !rows?.some((row) => row.selected)} className={buttonClass}>
            {saving ? 'Adding selected items...' : 'Add selected items'}
          </button>
        </form>
      )}
    </section>
  );
}
