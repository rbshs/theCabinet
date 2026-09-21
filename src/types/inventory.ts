export type StorageLocation =
  | 'pantry'
  | 'refrigerator'
  | 'freezer';

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  storage_location: StorageLocation;
  category: string;
  expiration_date: string | null;
  note: string | null;
}
