const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const root = path.join(__dirname, '..');
function load(file, { overrides = {}, globals = {} } = {}) {
  const filename = path.resolve(root, file);
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = {
    exports: {}, URL, AbortController, setTimeout, clearTimeout,
    process: { env: { AI_SERVICE_ENDPOINT: 'http://127.0.0.1:8080' } },
    fetch: () => assert.fail('Unexpected network request'),
    ...globals,
    require(name) {
      if (name === 'server-only') return require('next/dist/compiled/server-only/empty');
      if (name === 'next/server') return require('next/server');
      const target = path.relative(root, path.resolve(path.dirname(filename), name)).replaceAll('\\', '/') + '.ts';
      if (Object.hasOwn(overrides, target)) return overrides[target];
      if (!name.startsWith('.')) throw new Error(`Unexpected dependency: ${name}`);
      return load(target, { overrides, globals });
    },
  };
  vm.runInNewContext(code, context, { filename });
  return context.exports;
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const { validateInventoryImport } = load('services/ai/inventoryImport.ts');
const item = { name: 'chicken thighs', quantity: 2, unit: 'lb', storage_location: null, category: null, expiration_date: null, note: null };
const result = { items: [item] };
const envelope = (content, finish_reason = 'stop') => Response.json({ choices: [{ finish_reason, message: { content } }] });
const makeRequest = (body) => new Request('http://localhost/api/ai/import-inventory', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
function route(provider) {
  return load('app/api/ai/import-inventory/route.ts', {
    overrides: { 'services/ai/llamaCppInventoryImport.ts': { llamaCppInventoryImportProvider: { importInventory: provider } } },
  });
}

test('import validator accepts valid items and normalizes omitted metadata without IDs', () => {
  assert.deepEqual(plain(validateInventoryImport(result)), result);
  assert.deepEqual(plain(validateInventoryImport({ items: [{ name: ' bagels ' }] })), {
    items: [{ ...item, name: 'bagels', quantity: null, unit: null }],
  });
  assert.deepEqual(plain(validateInventoryImport({ items: [] })), { items: [] });
});

test('rejects invalid fields, IDs, extra properties, quantities, storage and dates', () => {
  for (const value of [null, [], {}, { items: null }, { items: [], id: 'x' },
    ...[null, [], {}, { name: ' ' }, { ...item, id: 'injected' }, { ...item, recipe: 'x' },
      { ...item, quantity: '2' }, { ...item, quantity: -1 }, { ...item, quantity: Infinity },
      { ...item, storage_location: 'cupboard' }, { ...item, unit: 2 }, { ...item, note: {} },
      { ...item, category: false }, { ...item, expiration_date: '2026-02-30' },
      { ...item, expiration_date: 'tomorrow' }].map((value) => ({ items: [value] })),
  ]) assert.throws(() => validateInventoryImport(value));
});

test('valid endpoint request calls import provider with text only and no-store', async () => {
  const { POST, runtime, dynamic } = route(async (request) => {
    assert.deepEqual(plain(request), { text: '2 lbs chicken thighs' });
    return result;
  });
  assert.equal(runtime, 'nodejs'); assert.equal(dynamic, 'force-dynamic');
  const response = await POST(makeRequest({ text: ' 2 lbs chicken thighs ' }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), result);
});

test('endpoint rejects blank, missing, malformed and client-injected inventory', async () => {
  const { POST } = route(() => assert.fail('Provider must not be called'));
  for (const body of [null, [], {}, { text: '' }, { text: ' ' }, { text: 1 }, { text: 'eggs', items: [{ id: 'x' }] }]) {
    assert.equal((await POST(makeRequest(body))).status, 400);
  }
  assert.equal((await POST(new Request('http://localhost', { method: 'POST', body: '{' }))).status, 400);
});

test('endpoint rejects provider errors and invalid provider output without leaking details', async () => {
  for (const provider of [async () => { throw new Error('private endpoint'); },
    async () => ({ items: [{ ...item, id: 'injected' }] }), async () => ({ wrong: [] })]) {
    const response = await route(provider).POST(makeRequest({ text: 'eggs' }));
    assert.equal(response.status, 502);
    assert.equal((await response.text()).includes('private endpoint'), false);
  }
});

test('endpoint returns zero extracted items normally', async () => {
  const response = await route(async () => ({ items: [] })).POST(makeRequest({ text: 'paper towels' }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { items: [] });
});

test('local import adapter sends schema-constrained extraction to configured Qwen endpoint', async () => {
  const { llamaCppInventoryImportProvider: provider } = load('services/ai/llamaCppInventoryImport.ts', {
    globals: { fetch: async (url, options) => {
      assert.equal(String(url), 'http://127.0.0.1:8080/v1/chat/completions');
      assert.equal(options.method, 'POST'); assert.equal(options.cache, 'no-store');
      const body = JSON.parse(options.body);
      assert.equal(body.model, 'qwen3-general'); assert.equal(body.stream, false);
      assert.equal(body.response_format.schema.properties.items.items.additionalProperties, false);
      assert.deepEqual(JSON.parse(body.messages[1].content), { text: '2 lbs chicken thighs' });
      return envelope(JSON.stringify(result));
    } },
  });
  assert.deepEqual(plain(await provider.importInventory({ text: '2 lbs chicken thighs' })), result);
});

test('local adapter rejects malformed, truncated and invalid model responses and HTTP failures', async () => {
  for (const fetch of [
    async () => new Response('private details', { status: 500 }),
    async () => { throw new Error('private connection details'); },
    async () => new Response('not JSON'),
    async () => Response.json({ choices: [] }),
    async () => envelope('not JSON'),
    async () => envelope(JSON.stringify(result), 'length'),
    async () => envelope(JSON.stringify({ items: [{ ...item, id: 'x' }] })),
  ]) {
    const { llamaCppInventoryImportProvider: provider } = load('services/ai/llamaCppInventoryImport.ts', { globals: { fetch } });
    await assert.rejects(provider.importInventory({ text: 'eggs' }), /Unable to extract valid inventory items/);
  }
});

test('review saves only selected edited items and never local keys or IDs', async () => {
  const writes = [], saved = [];
  const { createReviewRows, saveReviewedItems } = load('lib/inventoryImportReview.ts', {
    overrides: { 'lib/inventory.ts': { insertInventoryItem: async (item) => { writes.push(plain(item)); return { error: null }; } } },
  });
  const rows = createReviewRows([item, { ...item, name: 'bagels', quantity: null }]);
  assert.equal(writes.length, 0);
  rows[0].selected = false;
  rows[0].item = { ...rows[0].item, name: '' };
  rows[0].quantityText = '-1';
  rows[1].quantityText = '3';
  rows[1].item.name = 'plain bagels';
  await saveReviewedItems(rows, (key) => saved.push(key));
  assert.deepEqual(writes, [{ ...item, name: 'plain bagels', quantity: 3 }]);
  assert.deepEqual(saved, [1]);
  await saveReviewedItems([], () => assert.fail('No selection'));
  assert.equal(writes.length, 1);
});

test('review validates all selected rows before any write and reports only confirmed saves', async () => {
  let writes = 0;
  const { createReviewRows, saveReviewedItems } = load('lib/inventoryImportReview.ts', {
    overrides: { 'lib/inventory.ts': { insertInventoryItem: async () => ({ error: ++writes === 2 ? {} : null }) } },
  });
  const invalid = createReviewRows([item, { ...item, name: ' ' }]);
  await assert.rejects(saveReviewedItems(invalid, () => assert.fail('No write')));
  assert.equal(writes, 0);
  const injected = createReviewRows([{ ...item, id: 'x' }]);
  await assert.rejects(saveReviewedItems(injected, () => assert.fail('No write')));
  const rows = createReviewRows([item, item, item]);
  const saved = [];
  await assert.rejects(saveReviewedItems(rows, (key) => saved.push(key)));
  assert.deepEqual(saved, [0]);
  assert.equal(writes, 2);
});
