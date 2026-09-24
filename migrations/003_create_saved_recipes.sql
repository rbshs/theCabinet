-- Shared Cabinet data, matching inventory_items: the application has no user/auth context.
-- Recipes are snapshots, independent of inventory changes or deleted inventory records.
CREATE TABLE public.saved_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (length(btrim(title)) > 0),
  description TEXT CHECK (description IS NULL OR length(btrim(description)) > 0),
  yield TEXT CHECK (yield IS NULL OR length(btrim(yield)) > 0),
  ingredients JSONB NOT NULL
    CHECK (jsonb_typeof(ingredients) = 'array' AND jsonb_array_length(ingredients) > 0),
  steps TEXT[] NOT NULL
    CHECK (cardinality(steps) > 0 AND array_position(steps, NULL) IS NULL),
  notes TEXT[] NOT NULL DEFAULT '{}' CHECK (array_position(notes, NULL) IS NULL),
  -- Open-ended provenance; only ai_generated is written by the initial feature.
  source TEXT NOT NULL DEFAULT 'ai_generated' CHECK (length(btrim(source)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX saved_recipes_created_at_idx ON public.saved_recipes (created_at DESC);
