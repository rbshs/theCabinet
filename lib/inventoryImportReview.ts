import type { InventoryImportItem } from '../services/ai';
import { validateInventoryImport } from '../services/ai/inventoryImport';
import { insertInventoryItem } from './inventory';

export interface InventoryReviewRow {
  // Local UI key only; never included in an inventory insert.
  key: number;
  selected: boolean;
  item: InventoryImportItem;
}

export function createReviewRows(items: InventoryImportItem[]): InventoryReviewRow[] {
  return items.map((item, key) => ({ key, selected: true, item }));
}

export async function saveReviewedItems(rows: InventoryReviewRow[], onSaved: (key: number) => void): Promise<void> {
  const selected = rows.filter((row) => row.selected);
  // Validate every selected row before starting any writes. No IDs or UI keys are saved.
  const { items } = validateInventoryImport({ items: selected.map(({ item }) => item) });
  for (let index = 0; index < items.length; index++) {
    const { error } = await insertInventoryItem(items[index]);
    if (error) throw new Error('Unable to save an inventory item.');
    onSaved(selected[index].key);
  }
}
