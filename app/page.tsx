'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChatApiResponse, ChatMessage, InventoryContext } from '../services/ai';
import { validateChatResponse } from '../services/ai/chat';
import { removeChatInventoryItem } from '../lib/chatInventory';
import SaveRecipeButton from './SaveRecipeButton';

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [inventory, setInventory] = useState<InventoryContext[]>([]);
  const [records, setRecords] = useState<Record<string, InventoryContext>>({});
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [inventoryStatus, setInventoryStatus] = useState('');
  const busy = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const availableIds = new Set(inventory.map((item) => item.id));

  useEffect(() => {
    if (messages.length || loading) bottom.current?.scrollIntoView({ block: 'nearest' });
  }, [messages, loading]);

  async function send(content: string, responseMode?: 'recipe' | 'suggestions') {
    if (busy.current || !content.trim()) return;
    busy.current = true;
    setLoading(true);
    setError('');
    setInput(content);
    const history: ChatMessage[] = [...messages, { role: 'user', content: content.trim(), ...(responseMode ? { responseMode } : {}) }];
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });
      if (!response.ok) throw new Error('Chat request failed.');
      const data: ChatApiResponse = await response.json();
      if (!Array.isArray(data.inventory)) throw new Error('Invalid inventory snapshot.');
      const { inventory: currentInventory, ...assistantResponse } = data;
      const reply = validateChatResponse(assistantResponse, new Set(currentInventory.map((item) => item.id)), responseMode);
      setInventory(data.inventory);
      setRecords((current) => ({ ...current, ...Object.fromEntries(data.inventory.map((item) => [item.id, item])) }));
      setMessages([...history, { role: 'assistant', ...reply }]);
      setInput('');
    } catch {
      setError('We could not get a reply. Check your connection and that the local AI server is running, then send again. Your message has been kept.');
    } finally {
      setLoading(false);
      busy.current = false;
      composer.current?.focus();
    }
  }

  async function removeItem(item: InventoryContext) {
    if (busy.current || !availableIds.has(item.id)) return;
    busy.current = true;
    setDeletingId(item.id);
    setError('');
    setInventoryStatus('');
    try {
      const removed = await removeChatInventoryItem(item, (message) => window.confirm(message));
      if (removed) {
        setInventory((current) => current.filter((entry) => entry.id !== item.id));
        setInventoryStatus(`${item.name} was removed from your Cabinet. Earlier suggestions may need a substitution; the next reply will use your updated inventory.`);
      }
    } catch {
      setError('We could not remove that item. Please try again.');
    } finally {
      setDeletingId(null);
      busy.current = false;
    }
  }

  return (
    <section aria-labelledby="chatHeading" className="space-y-6">
      <div>
        <h1 id="chatHeading" className="text-2xl font-semibold">Your meal assistant</h1>
        <p className="mt-2 text-sm text-gray-600">Find ideas from your Cabinet, choose a meal, and talk through how to make it.</p>
      </div>
      {messages.length === 0 && !loading && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-5 text-gray-700">
          <p>What can you make with what you have?</p>
          <p className="mt-2 text-sm">Try “What can I make for dinner?” Then ask about ingredients, substitutions, or cooking instructions.</p>
        </div>
      )}
      <div role="log" aria-label="Conversation" aria-live="polite" className="space-y-6">
        {messages.map((message, messageIndex) => (
          <article key={messageIndex} className={message.role === 'user'
            ? 'ml-4 rounded-lg bg-blue-50 p-4 sm:ml-12'
            : 'rounded-lg border border-gray-200 bg-white p-4'}>
            <p className="mb-2 text-sm font-semibold text-gray-600">{message.role === 'user' ? 'You' : 'Cabinet assistant'}</p>
            <p className="whitespace-pre-wrap break-words text-gray-900">{message.content}</p>
            {message.role === 'assistant' && message.type === 'recipe' && message.recipe && (
              <SaveRecipeButton recipe={message.recipe} />
            )}
            {message.role === 'assistant' && message.type === 'suggestions' && message.suggestions.length > 0 && (
              <div className="mt-4 space-y-4">
                {message.suggestions.map((suggestion, index) => (
                  <section key={index} className="rounded-md border border-gray-200 bg-gray-50 p-4">
                    <h2 className="break-words text-lg font-semibold">{index + 1}. {suggestion.name}</h2>
                    <p className="mt-2 text-sm text-gray-700">{suggestion.description}</p>
                    <h3 className="mt-4 text-sm font-semibold">Uses from your Cabinet</h3>
                    {suggestion.inventoryItemIds.length === 0 && <p className="mt-1 text-sm text-gray-600">No current inventory items used.</p>}
                    <ul className="mt-2 space-y-3">
                      {suggestion.inventoryItemIds.map((id) => {
                        const item = records[id];
                        const available = availableIds.has(id);
                        return (
                          <li key={id} className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0 break-words">
                              <span className="font-medium">{item?.name ?? 'Inventory item'}</span>
                              {!available && <span className="block font-medium text-amber-800">No longer in your Cabinet</span>}
                            </div>
                            {available && item && (
                              <button type="button" onClick={() => removeItem(item)} disabled={loading || deletingId !== null}
                                aria-label={`Remove ${item.name} from Cabinet`}
                                className="shrink-0 self-start rounded border border-red-300 px-1 py-0 text-[11px] leading-5 text-red-700 hover:bg-red-50 disabled:opacity-50">
                                {deletingId === id ? 'Removing...' : 'Remove from Cabinet'}
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    <button type="button" disabled={loading || deletingId !== null}
                      onClick={() => send(`Let's make "${suggestion.name}" from your suggestions. How should I cook it?`, 'recipe')}
                      className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                      Let’s make this
                    </button>
                  </section>
                ))}
              </div>
            )}
          </article>
        ))}
        {loading && <div className="space-y-3">
          <div className="ml-4 whitespace-pre-wrap break-words rounded-lg bg-blue-50 p-4 sm:ml-12"><p className="mb-2 text-sm font-semibold">You</p>{input}</div>
          <p role="status" className="text-sm text-gray-600">Thinking with your current inventory…</p>
        </div>}
        <div ref={bottom} />
      </div>
      {inventoryStatus && <p role="status" className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800">{inventoryStatus}</p>}
      {error && <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-red-700">{error}</p>}
      <form onSubmit={(event) => { event.preventDefault(); void send(input); }} className="space-y-3 border-t border-gray-200 pt-4">
        <label htmlFor="chatMessage" className="block text-sm font-medium">Message your meal assistant</label>
        <textarea
          ref={composer}
          id="chatMessage"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          rows={3}
          required
          readOnly={loading}
          placeholder="What can I make for dinner?"
          className="w-full rounded-md border border-gray-300 px-3 py-2"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void send('What can I make for breakfast?')}
            disabled={loading || deletingId !== null}
            className="rounded-md border border-blue-600 px-5 py-2 font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Breakfast
          </button>

          <button
            type="button"
            onClick={() => void send('What can I make for lunch?')}
            disabled={loading || deletingId !== null}
            className="rounded-md border border-blue-600 px-5 py-2 font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Lunch
          </button>

          <button
            type="button"
            onClick={() => void send('What can I make for dinner?')}
            disabled={loading || deletingId !== null}
            className="rounded-md border border-blue-600 px-5 py-2 font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Dinner
          </button>

          <button
            type="button"
            onClick={() => void send('What can I make for a snack?')}
            disabled={loading || deletingId !== null}
            className="rounded-md border border-blue-600 px-5 py-2 font-medium text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Snack
          </button>

          <button
            type="submit"
            disabled={loading || deletingId !== null || !input.trim()}
            className="rounded-md bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Thinking...' : 'Send'}
          </button>
        </div>
        <p className="text-xs text-gray-500">Conversation stays on this page and resets when you leave or refresh.</p>
      </form>
    </section>
  );
}
