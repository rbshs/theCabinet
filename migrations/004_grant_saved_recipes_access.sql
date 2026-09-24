-- Migration 003 created the table but relied on project-specific default grants.
-- The shared Cabinet app uses the public anon key without a signed-in user.
-- Grant only the operations used by lib/recipes.ts. Its duplicate-safe insert
-- uses ON CONFLICT DO NOTHING, so it does not need UPDATE privileges.
-- Like inventory_items, migration 003 does not enable RLS; no user policies apply.
-- This migration is safe to apply again and does not change existing recipes.
GRANT SELECT, INSERT, DELETE ON TABLE public.saved_recipes TO anon;
