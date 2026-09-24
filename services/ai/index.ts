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

export interface InventoryImportRequest {
  text: string;
}

export type InventoryImportItem = Omit<InventoryItem, 'id'>;

export interface InventoryImportResponse {
  items: InventoryImportItem[];
}

export interface InventoryImportProvider {
  importInventory(request: InventoryImportRequest): Promise<InventoryImportResponse>;
}

export interface ChatMealSuggestion extends MealSuggestion {
  missingIngredients: string[];
}

export type ChatMessage =
  | { role: 'user'; content: string; responseMode?: 'recipe' | 'suggestions' }
  | ({ role: 'assistant' } & ChatResponse);

export interface ChatRequest {
  messages: ChatMessage[];
  inventory: readonly InventoryContext[];
}

export type ChatResponse = { content: string } & (
  | { type: 'suggestions'; suggestions: ChatMealSuggestion[] }
  | { type: 'recipe' | 'conversation'; suggestions: [] }
);

// Inventory here comes from the database, never from the model.
export type ChatApiResponse = ChatResponse & {
  inventory: InventoryContext[];
}

export interface ChatProvider {
  chat(request: ChatRequest): Promise<ChatResponse>;
}
