import type { InventoryItem } from '../../src/types/inventory';

// Preserve inventory field names and null values, including unknown quantities.
export type InventoryContext = Readonly<Pick<InventoryItem,
  | 'id'
  | 'name'
  | 'quantity'
  | 'unit'
  | 'storage_location'
  | 'category'
  | 'expiration_date'
  | 'note'
>>;

export interface MealSuggestionRequest {
  inventory: readonly InventoryContext[];
  userRequest: string;
}

export interface MealSuggestion {
  name: string;
  description: string;
  // IDs of inventory items relevant to this suggestion, from the request.
  inventoryItemIds: string[];
}

export interface MealSuggestionResponse {
  suggestions: MealSuggestion[];
}

// Future adapters implement this contract and handle provider-specific details.
// Failures reject the promise; an empty suggestions array is a valid result.
export interface MealSuggestionProvider {
  suggestMeals(request: MealSuggestionRequest): Promise<MealSuggestionResponse>;
}
