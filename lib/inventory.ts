import { supabase } from './supabaseClient';
import type { InventoryItem } from '../src/types/inventory';

type InventoryItemInput = Omit<InventoryItem, 'id'>;

const inventoryColumns =
  'id, name, quantity, unit, storage_location, category, expiration_date, note';

export async function fetchInventory() {
  return supabase
    .from('inventory_items')
    .select(inventoryColumns)
    .order('name', { ascending: true })
    .returns<InventoryItem[]>();
}

export async function insertInventoryItem(item: InventoryItemInput) {
  return supabase.from('inventory_items').insert(item);
}

export async function updateInventoryItem(
  itemId: string,
  item: InventoryItemInput
) {
  return supabase
    .from('inventory_items')
    .update(item)
    .eq('id', itemId)
    .select(inventoryColumns)
    .single<InventoryItem>();
}

export async function deleteInventoryItem(itemId: string) {
  return supabase.from('inventory_items').delete().eq('id', itemId);
}
