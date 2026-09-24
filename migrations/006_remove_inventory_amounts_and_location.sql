-- Inventory tracks which foods are available, not amounts or storage locations.
-- Existing values in these columns are intentionally discarded, not moved to notes.
-- Recipe ingredient quantities and saved_recipes are unaffected.
ALTER TABLE public.inventory_items
  DROP COLUMN quantity,
  DROP COLUMN unit,
  DROP COLUMN storage_location;
