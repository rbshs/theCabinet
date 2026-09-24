-- Table grants (004) and RLS policies are separate requirements. The live table
-- has RLS enabled; without an applicable INSERT policy, anon saves fail with
-- "new row violates row-level security policy" even after INSERT is granted.
-- This application intentionally shares Cabinet data without user accounts.
-- These policies allow only its existing read, insert and delete operations.
BEGIN;

ALTER TABLE public.saved_recipes ENABLE ROW LEVEL SECURITY;

-- Replace only this migration's named policies so it is safe to reapply.
DROP POLICY IF EXISTS saved_recipes_shared_select ON public.saved_recipes;
CREATE POLICY saved_recipes_shared_select
  ON public.saved_recipes FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS saved_recipes_shared_insert ON public.saved_recipes;
CREATE POLICY saved_recipes_shared_insert
  ON public.saved_recipes FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS saved_recipes_shared_delete ON public.saved_recipes;
CREATE POLICY saved_recipes_shared_delete
  ON public.saved_recipes FOR DELETE TO anon
  USING (true);

-- No UPDATE policy is needed: saveRecipe uses ON CONFLICT DO NOTHING.
COMMIT;
