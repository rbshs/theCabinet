import type { InventoryImportResponse } from './index';

const fields = ['name', 'note'];
const nullableString = { type: ['string', 'null'] };

export const inventoryImportSchema = {
  type: 'object', additionalProperties: false, required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: fields,
        properties: {
          name: { type: 'string', minLength: 1 },
          note: nullableString,
        },
      },
    },
  },
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') throw new Error('Invalid inventory text field.');
  return value.trim() || null;
}

// Shared by the provider, endpoint and review flow. Only allowlisted fields leave here.
export function validateInventoryImport(value: unknown): InventoryImportResponse {
  if (!isObject(value) || Object.keys(value).length !== 1 || !Array.isArray(value.items)) {
    throw new Error('Invalid inventory import envelope.');
  }
  return { items: value.items.map((item: unknown) => {
    if (!isObject(item) || Object.keys(item).some((key) => !fields.includes(key)) ||
        typeof item.name !== 'string' || !item.name.trim()) {
      throw new Error('Invalid inventory import item.');
    }
    return {
      name: item.name.trim(),
      note: optionalText(item.note),
    };
  }) };
}
