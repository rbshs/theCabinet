export interface RecipeIngredient {
  name: string;
  // Text preserves useful ranges, fractions and amounts such as "to taste".
  quantity: string | null;
  unit: string | null;
}

export interface Recipe {
  title: string;
  description: string | null;
  yield: string | null;
  ingredients: RecipeIngredient[];
  steps: string[];
  notes: string[];
}

export interface SavedRecipe extends Recipe {
  id: string;
  source: string;
  created_at: string;
}
