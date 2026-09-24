import type { Recipe } from '../src/types/recipe';

const nullableTextSchema = { type: ['string', 'null'], minLength: 1 };

export const recipeSchema = {
  type: 'object', additionalProperties: false,
  required: ['title', 'description', 'yield', 'ingredients', 'steps', 'notes'],
  properties: {
    title: { type: 'string', minLength: 1 },
    description: nullableTextSchema,
    yield: nullableTextSchema,
    ingredients: {
      type: 'array', minItems: 1,
      items: {
        type: 'object', additionalProperties: false,
        required: ['name', 'quantity', 'unit'],
        properties: {
          name: { type: 'string', minLength: 1 },
          quantity: nullableTextSchema,
          unit: nullableTextSchema,
        },
      },
    },
    steps: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } },
    notes: { type: 'array', items: { type: 'string', minLength: 1 } },
  },
};

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonblank(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim());
}

function nullableText(value: unknown): value is string | null {
  return value === null || nonblank(value);
}

function textArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(nonblank);
}

export function validateRecipe(value: unknown): Recipe {
  if (!object(value) || Object.keys(value).length !== 6 || !nonblank(value.title) ||
    !nullableText(value.description) || !nullableText(value.yield) ||
    !Array.isArray(value.ingredients) || value.ingredients.length === 0 ||
    !textArray(value.steps) || value.steps.length === 0 || !textArray(value.notes)) {
    throw new Error('Invalid recipe.');
  }
  const ingredients = value.ingredients.map((ingredient: unknown) => {
    if (!object(ingredient) || Object.keys(ingredient).length !== 3 ||
      !nonblank(ingredient.name) || !nullableText(ingredient.quantity) || !nullableText(ingredient.unit)) {
      throw new Error('Invalid recipe ingredient.');
    }
    return { name: ingredient.name, quantity: ingredient.quantity, unit: ingredient.unit };
  });
  return {
    title: value.title, description: value.description, yield: value.yield,
    ingredients, steps: [...value.steps], notes: [...value.notes],
  };
}
