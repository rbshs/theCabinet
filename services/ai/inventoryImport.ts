import type { InventoryImportResponse } from './index';

const fields = ['name', 'quantity', 'unit', 'storage_location', 'category', 'expiration_date', 'note'];
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
          quantity: { type: ['number', 'null'], minimum: 0 },
          unit: nullableString,
          storage_location: { enum: ['pantry', 'refrigerator', 'freezer', null] },
          category: nullableString,
          expiration_date: nullableString,
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
    const quantity = item.quantity ?? null;
    if (quantity !== null && (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity < 0)) {
      throw new Error('Quantity must be a nonnegative number or blank.');
    }
    const storage = item.storage_location ?? null;
    if (storage !== null && storage !== 'pantry' && storage !== 'refrigerator' && storage !== 'freezer') {
      throw new Error('Invalid storage location.');
    }
    const expiration = optionalText(item.expiration_date);
    if (expiration && (!/^\d{4}-\d{2}-\d{2}$/.test(expiration) ||
      !Number.isFinite(Date.parse(expiration)) || new Date(expiration).toISOString().slice(0, 10) !== expiration)) {
      throw new Error('Expiration must be a valid YYYY-MM-DD date or blank.');
    }
    return {
      name: item.name.trim(), quantity, unit: optionalText(item.unit), storage_location: storage,
      category: optionalText(item.category), expiration_date: expiration, note: optionalText(item.note),
    };
  }) };
}
