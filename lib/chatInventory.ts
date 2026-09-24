import type { InventoryContext } from '../services/ai';
import { deleteInventoryItem } from './inventory';

export async function removeChatInventoryItem(
  item: InventoryContext,
  confirm: (message: string) => boolean
): Promise<boolean> {
  const details = item.note;
  if (!confirm(`Remove "${item.name}"${details ? ` (${details})` : ''} from your Cabinet? This deletes this inventory item.`)) return false;
  const { error } = await deleteInventoryItem(item.id);
  if (error) throw new Error('Unable to remove this inventory item.');
  return true;
}
