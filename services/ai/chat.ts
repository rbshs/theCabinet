import type { ChatMessage, ChatMealSuggestion, ChatResponse } from './index';

const suggestionResponseSchema = {
  type: 'object', additionalProperties: false, required: ['type', 'content', 'suggestions'],
  properties: {
    type: { const: 'suggestions' },
    content: { type: 'string', minLength: 1,
      description: 'One short introductory sentence only. Put all meal names, descriptions, and ingredient lists in suggestions; do not repeat them here or include a numbered or bulleted meal list. If no meals can be suggested, briefly explain why.' },
    suggestions: {
      type: 'array', maxItems: 3,
      items: {
        type: 'object', additionalProperties: false,
        required: ['name', 'description', 'inventoryItemIds', 'missingIngredients'],
        properties: {
          name: { type: 'string', minLength: 1 },
          description: { type: 'string', minLength: 1 },
          inventoryItemIds: { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1 } },
          missingIngredients: { type: 'array', items: { type: 'string', minLength: 1 } },
        },
      },
    },
  },
};

function textResponseSchema(type: 'recipe' | 'conversation') {
  return {
    type: 'object', additionalProperties: false, required: ['type', 'content', 'suggestions'],
    properties: {
      type: { const: type }, content: { type: 'string', minLength: 1 },
      suggestions: { type: 'array', maxItems: 0, items: { type: 'string' } },
    },
  };
}

export function responseSchemaFor(mode?: 'recipe' | 'suggestions') {
  if (mode === 'recipe') return textResponseSchema('recipe');
  if (mode === 'suggestions') return suggestionResponseSchema;
  return { oneOf: [suggestionResponseSchema, textResponseSchema('recipe'), textResponseSchema('conversation')] };
}
export const chatResponseSchema = responseSchemaFor();

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function nonblank(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim());
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(nonblank);
}
function suggestions(value: unknown, inventoryIds?: Set<string>): ChatMealSuggestion[] {
  if (!Array.isArray(value) || value.length > 3) throw new Error('Invalid suggestions.');
  return value.map((item: unknown) => {
    if (!object(item) || Object.keys(item).length !== 4 || !nonblank(item.name) ||
      !nonblank(item.description) || !strings(item.inventoryItemIds) || !strings(item.missingIngredients) ||
      new Set(item.inventoryItemIds).size !== item.inventoryItemIds.length ||
      (inventoryIds && item.inventoryItemIds.some((id) => !inventoryIds.has(id)))) {
      throw new Error('Invalid suggestion or inventory reference.');
    }
    return { name: item.name, description: item.description,
      inventoryItemIds: item.inventoryItemIds, missingIngredients: item.missingIngredients };
  });
}

export function validateChatResponse(value: unknown, inventoryIds?: Set<string>, mode?: 'recipe' | 'suggestions'): ChatResponse {
  if (!object(value) || Object.keys(value).length !== 3 || !nonblank(value.content) ||
    (mode !== undefined && value.type !== mode)) {
    throw new Error('Invalid assistant response.');
  }
  const items = suggestions(value.suggestions, inventoryIds);
  if (value.type === 'suggestions') return { type: value.type, content: value.content, suggestions: items };
  if ((value.type === 'recipe' || value.type === 'conversation') && items.length === 0) {
    return { type: value.type, content: value.content, suggestions: [] };
  }
  throw new Error('Invalid response type or suggestions in a text response.');
}

export function validateChatRequest(value: unknown): ChatMessage[] {
  if (!object(value) || Object.keys(value).length !== 1 || !Array.isArray(value.messages) || !value.messages.length) {
    throw new Error('Provide conversation messages only.');
  }
  const messages: ChatMessage[] = value.messages.map((message: unknown) => {
    if (!object(message) || !nonblank(message.content)) throw new Error('Invalid message.');
    if (message.role === 'user' && (Object.keys(message).length === 2 ||
      (Object.keys(message).length === 3 && (message.responseMode === 'recipe' || message.responseMode === 'suggestions')))) {
      return { role: 'user', content: message.content,
        ...(message.responseMode ? { responseMode: message.responseMode as 'recipe' | 'suggestions' } : {}) };
    }
    if (message.role === 'assistant' && Object.keys(message).length === 4) {
      // Historical references may have been deleted; they are not current inventory.
      return { role: 'assistant', ...validateChatResponse({ type: message.type, content: message.content, suggestions: message.suggestions }) };
    }
    throw new Error('Invalid message role or fields.');
  });
  if (messages[0].role !== 'user' || messages[messages.length - 1].role !== 'user') {
    throw new Error('Conversation must start and end with a user message.');
  }
  return messages;
}
