const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const filename = path.join(__dirname, '../app/api/ai/suggest-meals/route.ts');
const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function loadRoute(fetchInventory, suggestMeals) {
  const context = {
    exports: {},
    require(name) {
      if (name === 'next/server') return require('next/server');
      if (name === '../../../../lib/inventory') return { fetchInventory };
      if (name === '../../../../services/ai/llamaCpp') return { llamaCppProvider: { suggestMeals } };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  };
  vm.runInNewContext(compiled, context, { filename });
  return context.exports;
}

const inventory = [{
  id: '2c89a5fc-a9d3-421d-9848-a2e1a3e24ad8', name: 'Chicken thighs',
  note: null,
}, {
  id: '66a94385-cc7d-449b-a070-48f35ca4bbd1', name: 'Rice',
  note: null,
}];
const output = { suggestions: [{
  name: 'Chicken dinner', description: 'Consider a chicken-based dinner.',
  inventoryItemIds: [inventory[0].id],
}] };
const makeRequest = (body) => new Request('http://localhost/api/ai/suggest-meals', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const mustNotCall = () => assert.fail('This dependency must not be called');

test('fetches current inventory for each request and preserves all context fields', async () => {
  let fetches = 0;
  const received = [];
  const route = loadRoute(async () => {
    fetches++;
    return { data: fetches === 1 ? inventory : inventory.slice(1), error: null };
  }, async (request) => {
    received.push(JSON.parse(JSON.stringify(request)));
    return fetches === 1 ? output : { suggestions: [] };
  });
  assert.equal(route.runtime, 'nodejs');
  assert.equal(route.dynamic, 'force-dynamic');
  const response = await route.POST(makeRequest({
    userRequest: '  What should I make for dinner?  ',
    inventory: [{ id: 'client-invented-id', name: 'Invented food' }],
  }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), output);
  assert.deepEqual(received[0], { inventory, userRequest: 'What should I make for dinner?' });
  await route.POST(makeRequest({ userRequest: 'Another meal?' }));
  assert.equal(fetches, 2);
  assert.deepEqual(received[1].inventory, inventory.slice(1));
});

test('rejects malformed JSON and missing, blank or non-string requests before fetching', async () => {
  const { POST } = loadRoute(mustNotCall, mustNotCall);
  for (const body of [null, [], {}, { userRequest: null }, { userRequest: 1 }, { userRequest: ' \n ' }]) {
    assert.equal((await POST(makeRequest(body))).status, 400);
  }
  const malformed = new Request('http://localhost/api/ai/suggest-meals', { method: 'POST', body: '{' });
  assert.equal((await POST(malformed)).status, 400);
});

test('empty inventory returns the response shape without invoking AI', async () => {
  const { POST } = loadRoute(async () => ({ data: [], error: null }), mustNotCall);
  const response = await POST(makeRequest({ userRequest: 'Dinner?' }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { suggestions: [] });
});

test('name-only inventory preserves every null metadata field in AI context', async () => {
  const item = {
    id: inventory[0].id, name: 'Chicken thighs',
    note: null,
  };
  const { POST } = loadRoute(async () => ({ data: [item], error: null }), async (request) => {
    assert.deepEqual(JSON.parse(JSON.stringify(request.inventory)), [item]);
    return output;
  });
  const response = await POST(makeRequest({ userRequest: 'Dinner?' }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), output);
});

test('database errors and missing data fail without calling AI or exposing details', async () => {
  for (const fetchInventory of [
    async () => ({ data: null, error: { message: 'private database detail' } }),
    async () => ({ data: null, error: null }),
    async () => { throw new Error('private database detail'); },
  ]) {
    const { POST } = loadRoute(fetchInventory, mustNotCall);
    const response = await POST(makeRequest({ userRequest: 'Dinner?' }));
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'Unable to load inventory.' });
  }
});

test('provider errors and unknown inventory IDs fail without exposing internal details', async () => {
  for (const suggestMeals of [
    async () => { throw new Error('private endpoint and model output'); },
    async () => ({ suggestions: [{ ...output.suggestions[0], inventoryItemIds: ['invented'] }] }),
  ]) {
    const { POST } = loadRoute(async () => ({ data: inventory, error: null }), suggestMeals);
    const response = await POST(makeRequest({ userRequest: 'Dinner?' }));
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), {
      error: 'Unable to generate valid meal suggestions. Check the local AI server and try again.',
    });
  }
});
