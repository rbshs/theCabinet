-- Preserve existing records and the storage_location CHECK constraint.
ALTER TABLE public.inventory_items
  ALTER COLUMN storage_location DROP NOT NULL,
  ALTER COLUMN category DROP NOT NULL;
