CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  quantity NUMERIC,
  unit TEXT,
  storage_location TEXT NOT NULL
  CHECK (storage_location IN ('pantry', 'refrigerator', 'freezer')),
  category TEXT NOT NULL,
  expiration_date DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);