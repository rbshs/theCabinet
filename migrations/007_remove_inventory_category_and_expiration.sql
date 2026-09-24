-- Inventory keeps item names and optional notes, without category/date tracking.
-- Discard these values rather than transferring them to other fields.
-- Existing inventory IDs, names, notes and saved_recipes are unaffected.
ALTER TABLE public.inventory_items
  DROP COLUMN category,
  DROP COLUMN expiration_date;
