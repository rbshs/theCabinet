import { NextResponse } from 'next/server';
import { fetchInventory } from '../../../../lib/inventory';
import { llamaCppProvider } from '../../../../services/ai/llamaCpp';
import type {
  InventoryContext,
  MealSuggestionProvider,
  MealSuggestionResponse,
} from '../../../../services/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const provider: MealSuggestionProvider = llamaCppProvider;
const responseHeaders = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, {
      status: 400, headers: responseHeaders,
    });
  }

  if (
    typeof body !== 'object' || body === null ||
    !('userRequest' in body) || typeof body.userRequest !== 'string' ||
    !body.userRequest.trim()
  ) {
    return NextResponse.json({ error: 'A non-blank userRequest is required.' }, {
      status: 400, headers: responseHeaders,
    });
  }

  let inventory: InventoryContext[];
  try {
    const { data, error } = await fetchInventory();
    if (error || data === null) throw new Error('Inventory fetch failed.');
    inventory = data.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      storage_location: item.storage_location,
      category: item.category,
      expiration_date: item.expiration_date,
      note: item.note,
    }));
  } catch {
    return NextResponse.json({ error: 'Unable to load inventory.' }, {
      status: 500, headers: responseHeaders,
    });
  }

  if (inventory.length === 0) {
    return NextResponse.json<MealSuggestionResponse>({ suggestions: [] }, {
      headers: responseHeaders,
    });
  }

  // Keep the actual fetched IDs for a final check before returning provider output.
  const inventoryIds = new Set(inventory.map((item) => item.id));
  try {
    const result = await provider.suggestMeals({
      inventory,
      userRequest: body.userRequest.trim(),
    });
    if (result.suggestions.some((suggestion) =>
      suggestion.inventoryItemIds.some((id) => !inventoryIds.has(id))
    )) {
      throw new Error('Suggestion references an unknown inventory item.');
    }
    return NextResponse.json<MealSuggestionResponse>(result, { headers: responseHeaders });
  } catch {
    // Do not expose provider configuration, database details, or raw model output.
    return NextResponse.json({ error: 'Unable to generate valid meal suggestions. Check the local AI server and try again.' }, {
      status: 502, headers: responseHeaders,
    });
  }
}
