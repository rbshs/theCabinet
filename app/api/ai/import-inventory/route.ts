import { NextResponse } from 'next/server';
import type { InventoryImportProvider } from '../../../../services/ai';
import { llamaCppInventoryImportProvider } from '../../../../services/ai/llamaCppInventoryImport';
import { validateInventoryImport } from '../../../../services/ai/inventoryImport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const provider: InventoryImportProvider = llamaCppInventoryImportProvider;
const headers = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400, headers });
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body) ||
      Object.keys(body).length !== 1 || !('text' in body) || typeof body.text !== 'string' || !body.text.trim()) {
    return NextResponse.json({ error: 'Provide a non-blank text field only.' }, { status: 400, headers });
  }
  try {
    const result = await provider.importInventory({ text: body.text.trim() });
    return NextResponse.json(validateInventoryImport(result), { headers });
  } catch {
    return NextResponse.json({ error: 'Unable to import food items. Check the local AI server and try again.' }, { status: 502, headers });
  }
}
