# The Cabinet Project

This is the initial project structure for The Cabinet application.

## Features
- Next.js application structure
- TypeScript configuration
- Tailwind CSS integration
- Supabase placeholder configuration
- AI service interface
- Environment variable configuration

## Getting Started
1. Install dependencies: `npm install`
2. Start development server: `npm run dev`
3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Inventory

Manage available foods on `/inventory`; name is the only required field, with an
optional note. Text import extracts foods and discards stock amounts, units,
storage locations, categories and expiration dates rather than storing them in
other fields. Recipe ingredient amounts remain unchanged.

Apply `migrations/006_remove_inventory_amounts_and_location.sql` after the earlier
inventory migrations. It drops `quantity`, `unit` and `storage_location` from
`inventory_items`, permanently discarding their values. It preserves item IDs,
names and remaining details, and does not change `saved_recipes`. Earlier
migrations are intentionally unchanged; new installations should apply them in
order as well.

Then apply `migrations/007_remove_inventory_category_and_expiration.sql` to drop
`category` and `expiration_date`, permanently discarding those values. If 006 is
already applied, apply only 007. Inventory API records now contain `id`, `name`
and nullable `note`; database creation/update timestamps remain internal metadata.
Saved Recipes and all earlier migrations remain unchanged.

## Saved recipes

Apply saved-recipe migrations in order: `003_create_saved_recipes.sql`,
`004_grant_saved_recipes_access.sql`, then `005_saved_recipes_shared_policies.sql`
from `migrations/`. If the table already exists and SELECT, INSERT and DELETE
have already been granted to `anon`, run only 005. It adds the shared-access RLS
policies without recreating the table or changing saved recipes. Like the existing
inventory migrations, these SQL migrations are applied manually; the app does not
run them on startup.

Saved recipes use the existing shared Supabase client and shared Cabinet model.
There is no application authentication, user ownership or per-user isolation.
Migration 004 explicitly grants select, insert and delete on `saved_recipes` to
the `anon` role used by the app's `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Successful
creation in the SQL Editor does not itself grant this role access. No update
grant is needed: duplicate saves use `ON CONFLICT DO NOTHING`. SQL grants alone
do not override RLS. Migration 005 explicitly enables RLS and adds SELECT, INSERT
and DELETE policies for `anon`, allowing shared access without requiring a user
ID or introducing authentication. These policies intentionally apply to all saved
recipes in this shared Cabinet. They do not authorize updates, alter inventory
policies or remove policies configured separately in the database.

Complete AI recipe responses retain their existing text and also include a
validated `recipe` object with `title`, nullable `description` and `yield`,
`ingredients` (`name`, nullable text `quantity` and `unit`), ordered `steps`, and
`notes`. A clarification-only recipe response has `recipe: null` and cannot be
saved. Suggestions and conversational replies keep their existing schemas.
Quantity text preserves fractions, ranges and expressions such as "to taste".

Saving stores those structured fields directly, plus a UUID, database-generated
`created_at` timestamp and `source: ai_generated`. The source field is open-ended
for future integrations. Saved recipes are independent of current inventory.
Repeated clicks and retries for the same chat response use one UUID, so a lost
save response cannot create a duplicate. Separately generated recipes are separate
saves. The Saved Recipes page reads Supabase directly and supports viewing full
details and deleting a saved recipe with confirmation.
