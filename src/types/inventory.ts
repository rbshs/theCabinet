export type StorageLocation =
  | 'pantry'
  | 'refrigerator'
  | 'freezer';

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  storageLocation: StorageLocation;
  category: string;
  expirationDate: string | null;
  note: string | null;
}