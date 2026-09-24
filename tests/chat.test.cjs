const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(file, deps = {}, globals = {}) {
  const filename = path.join(__dirname, '..', file);
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const context = { exports: {}, require: (name) => name in deps ? deps[name] : require(name),
    AbortController, setTimeout, clearTimeout, ...globals };
  vm.runInNewContext(compiled, context, { filename });
  return context.exports;
}
const validation = load('services/ai/chat.ts');
const item = { id: 'bacon-id', name: 'Bacon', note: 'Use opened package first' };
const meal = { name: 'Bacon sandwich', description: 'A sandwich', inventoryItemIds: [item.id], missingIngredients: ['Bun'] };
const ideas = { type: 'suggestions', content: 'Here are a few breakfast ideas using your current inventory:', suggestions: [meal] };
const recipe = { type: 'recipe', content: '1. Cook the bacon.\n2. Assemble.', suggestions: [] };
const user = (content, responseMode) => ({ role: 'user', content, ...(responseMode ? { responseMode } : {}) });
const assistant = (response) => ({ role: 'assistant', ...response });
const plain = (value) => JSON.parse(JSON.stringify(value));
const envelope = (value) => Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] });
function provider(fetch) {
  return load('services/ai/llamaCppChat.ts', {
    'server-only': {}, './llamaCpp': { completionUrl: () => 'http://localhost:8080/v1/chat/completions' }, './chat': validation,
  }, { fetch }).llamaCppChatProvider;
}
function route(chat, fetchInventory = async () => ({ data: [item], error: null })) {
  return load('app/api/ai/chat/route.ts', {
    '../../../../lib/inventory': { fetchInventory },
    '../../../../services/ai/llamaCppChat': { llamaCppChatProvider: { chat } },
    '../../../../services/ai/chat': validation,
  });
}
const request = (messages, extra = {}) => new Request('http://localhost/api/ai/chat', { method: 'POST', body: JSON.stringify({ messages, ...extra }) });

test('provider requests a short introduction with meals only in structured suggestions for explicit and free-text requests', async () => {
  for (const mode of ['suggestions', undefined]) {
    const chat = provider(async (_, options) => {
      const body = JSON.parse(options.body);
      const schema = mode ? body.response_format.schema : body.response_format.schema.oneOf[0];
      assert.match(schema.properties.content.description, /One short introductory sentence only/);
      assert.match(schema.properties.content.description, /do not repeat them here/);
      assert.match(body.messages[0].content, /structured suggestions array is the actual answer/);
      assert.match(body.messages[0].content, /do not include a numbered or bulleted meal list in content/);
      assert.deepEqual(JSON.parse(body.messages[1].content).currentInventory, [item]);
      return envelope(ideas);
    });
    const reply = await chat.chat({ inventory: [item], messages: [user('What should I make?', mode)] });
    assert.deepEqual(plain(reply), ideas);
    const markup = page([assistant(reply)]).markup();
    assert.ok(markup.includes(ideas.content));
    assert.equal((markup.match(/Bacon sandwich/g) || []).length, 1);
    assert.match(markup, /Uses from your Cabinet/);
  }
});

test('suggestion inventory displays names only while retaining full records and real deletion IDs', async () => {
  let removed;
  const ui = page([assistant(ideas)], undefined, async entry => { removed = entry; return false; });
  const markup = ui.markup();
  assert.match(markup, /Bacon/);
  assert.doesNotMatch(markup, /Use opened package first/);
  assert.match(markup, /Remove from Cabinet/);
  await ui.buttons().find(b => b.props['aria-label'] === 'Remove Bacon from Cabinet').props.onClick();
  assert.deepEqual(removed, item);
  assert.equal(removed.id, 'bacon-id');
  assert.deepEqual(ui.state[2], [item]);
  const response = await route(async () => ideas).POST(request([user('Ideas?', 'suggestions')]));
  assert.deepEqual((await response.json()).inventory, [item]);
});

test('strict response types reject recipe cards, unknown IDs, duplicate IDs and extra fields', () => {
  assert.deepEqual(plain(validation.validateChatResponse(ideas, new Set([item.id]))), ideas);
  for (const value of [ { ...recipe, suggestions: [meal] }, { ...recipe, type: 'unknown' },
    { content: recipe.content, suggestions: [] }, { ...recipe, extra: true },
    ...[['invented'], [item.id, item.id]].map(ids => ({ ...ideas, suggestions: [{ ...meal, inventoryItemIds: ids }] })) ]) {
    assert.throws(() => validation.validateChatResponse(value, new Set([item.id])));
  }
  assert.throws(() => validation.validateChatResponse(ideas, new Set([item.id]), 'recipe'));
});

test('provider constrains selected meals to recipe schema and preserves typed history across cooking and new ideas', async () => {
  const history = [user('Breakfast?'), assistant(ideas), user('Let us make the sandwich', 'recipe')];
  let turn = 0;
  const outputs = [recipe, { ...recipe, content: 'About 3–4 minutes.' }, ideas];
  const chat = provider(async (_, options) => {
    const body = JSON.parse(options.body);
    if (turn === 0) {
      assert.equal(body.response_format.schema.properties.type.const, 'recipe');
      assert.equal(body.response_format.schema.properties.suggestions.maxItems, 0);
    } else assert.equal(body.response_format.schema.oneOf.length, 3);
    assert.ok(body.messages[0].content.includes('follow-up cooking questions'));
    assert.ok(body.messages.some(m => m.role === 'assistant' && JSON.parse(m.content).type === 'suggestions'));
    return envelope(outputs[turn++]);
  });
  for (const question of [null, 'How long should I cook the eggs?', 'What else can I make?']) {
    if (question) history.push(user(question));
    const reply = await chat.chat({ inventory: [item], messages: history });
    assert.deepEqual(plain(reply), outputs[turn - 1]);
    history.push(assistant(reply));
  }
  await assert.rejects(provider(async () => envelope(ideas)).chat({ inventory: [item], messages: history.slice(0, 3) }));
});

test('API enforces recipe intent, fresh snapshots and current IDs while retaining deleted historical IDs', async () => {
  const history = [user('Breakfast?'), assistant(ideas), user('Make it', 'recipe')];
  let calls = 0;
  const api = route(async ({ messages, inventory }) => {
    assert.deepEqual(plain(messages), history);
    assert.equal(inventory.length, calls === 1 ? 1 : 0);
    return recipe;
  }, async () => ({ data: ++calls === 1 ? [item] : [], error: null }));
  for (let i = 0; i < 2; i++) {
    const response = await api.POST(request(history));
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.type, 'recipe');
    assert.equal(data.inventory.length, i === 0 ? 1 : 0);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
  assert.equal((await route(async () => ideas).POST(request(history))).status, 502);
  assert.equal((await route(async () => ({ ...ideas, suggestions: [{ ...meal, inventoryItemIds: ['invented'] }] })).POST(request([user('Ideas?')]))).status, 502);
  for (const messages of [[user('Hi', 'bad')], [user('Hi'), { ...assistant(recipe), suggestions: [meal] }, user('Hi')]]) {
    assert.equal((await api.POST(request(messages))).status, 400);
  }
  assert.equal((await api.POST(request([user('Hi')], { inventory: [item] }))).status, 400);
});

// Exercise the real page handlers and rendered markup without adding a browser/test dependency.
function page(initialMessages, fetch, removeChatInventoryItem) {
  const state = [initialMessages, '', [item], { [item.id]: item }, false, null, '', ''];
  let cursor = 0;
  const Home = load('app/page.tsx', {
    react: { ...React, useState: () => { const i = cursor++; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }]; }, useEffect: () => {}, useRef: () => ({ current: null }) },
    '../services/ai/chat': validation, '../lib/chatInventory': { removeChatInventoryItem },
  }, { fetch, window: { confirm: () => true } }).default;
  const tree = () => { cursor = 0; return Home(); };
  const buttons = (node) => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(buttons) : [...(node.type === 'button' ? [node] : []), ...buttons(node.props?.children)];
  return { state, markup: () => renderToStaticMarkup(tree()), buttons: () => buttons(tree()) };
}

test('meal cards render inventory actions; selecting a meal sends recipe intent and appends a plain reply', async () => {
  let sent;
  const ui = page([user('Breakfast?'), assistant(ideas)], async (_, options) => {
    sent = JSON.parse(options.body);
    return Response.json({ ...recipe, inventory: [item] });
  });
  assert.match(ui.markup(), /Uses from your Cabinet/);
  assert.match(ui.markup(), /Remove from Cabinet/);
  await ui.buttons().find(b => typeof b.props.children === 'string' && b.props.children.endsWith('make this')).props.onClick();
  assert.equal(sent.messages.at(-1).responseMode, 'recipe');
  assert.match(sent.messages.at(-1).content, /Bacon sandwich/);
  assert.equal(ui.state[0].length, 4);
  assert.equal(ui.state[0].at(-1).type, 'recipe');
  assert.equal((ui.markup().match(/Uses from your Cabinet/g) || []).length, 1);
});

test('recipe and follow-up messages render no suggestion cards or inventory/selection actions', () => {
  for (const response of [recipe, { ...recipe, content: 'Cook the eggs for 3–4 minutes.' }, { ...recipe, type: 'conversation' }]) {
    const ui = page([assistant(response)]);
    assert.doesNotMatch(ui.markup(), /Uses from your Cabinet|Remove from Cabinet|Let’s make this|You’d need/);
    assert.match(ui.markup(), new RegExp(response.content.split('\n')[0]));
  }
});

test('actual suggestion deletion preserves confirmation, exact ID, state updates, cancellation and errors', async () => {
  for (const scenario of ['success', 'cancel', 'error']) {
    const deleted = [];
    const helper = load('lib/chatInventory.ts', { './inventory': { deleteInventoryItem: async id => {
      deleted.push(id); return { error: scenario === 'error' ? new Error('failure') : null };
    } } }).removeChatInventoryItem;
    const ui = page([assistant(ideas)], undefined, (entry) => helper(entry, text => {
      assert.match(text, /Bacon/); assert.match(text, /Use opened package first/); return scenario !== 'cancel';
    }));
    await ui.buttons().find(b => b.props['aria-label'] === 'Remove Bacon from Cabinet').props.onClick();
    assert.deepEqual(deleted, scenario === 'cancel' ? [] : [item.id]);
    assert.equal(ui.state[2].length, scenario === 'success' ? 0 : 1);
    if (scenario === 'success') { assert.match(ui.markup(), /No longer in your Cabinet/); assert.doesNotMatch(ui.markup(), /aria-label="Remove Bacon/); }
    if (scenario === 'error') assert.match(ui.markup(), /We could not remove that item/);
  }
});

