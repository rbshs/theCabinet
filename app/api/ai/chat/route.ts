import { NextResponse } from 'next/server';
import { fetchInventory } from '../../../../lib/inventory';
import type { ChatApiResponse, ChatProvider, InventoryContext } from '../../../../services/ai';
import { llamaCppChatProvider } from '../../../../services/ai/llamaCppChat';
import { validateChatRequest, validateChatResponse } from '../../../../services/ai/chat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const provider: ChatProvider = llamaCppChatProvider;
const headers = { 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
  let messages;
  try { messages = validateChatRequest(await request.json()); } catch {
    return NextResponse.json({ error: 'Provide a valid conversation ending with a non-blank user message.' }, { status: 400, headers });
  }
  let inventory: InventoryContext[];
  try {
    const { data, error } = await fetchInventory();
    if (error || data === null) throw new Error('Inventory unavailable.');
    inventory = data.map(({ id, name, quantity, unit, storage_location, category, expiration_date, note }) =>
      ({ id, name, quantity, unit, storage_location, category, expiration_date, note }));
  } catch {
    return NextResponse.json({ error: 'Unable to load your Cabinet inventory. Please try again.' }, { status: 500, headers });
  }
  const inventoryIds = new Set(inventory.map((item) => item.id));
  const lastMessage = messages[messages.length - 1];
  const mode = lastMessage.role === 'user' ? lastMessage.responseMode : undefined;
  try {
    const result = validateChatResponse(await provider.chat({ messages, inventory }), inventoryIds, mode);
    return NextResponse.json<ChatApiResponse>({ ...result, inventory }, { headers });
  } catch {
    return NextResponse.json({ error: 'Unable to reply. Check the local AI server and try again.' }, { status: 502, headers });
  }
}
