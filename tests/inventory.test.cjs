const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');

const filename = path.join(__dirname, '../lib/inventory.ts');
const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

// Exercise the real data-access functions and Supabase SDK with intercepted HTTP.
// These tests verify requests and nullable responses, not a remote schema migration.
function loadInventory(fetch) {
  const supabase = createClient('http://localhost:54321', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch },
  });
  const context = {
    exports: {},
    require(name) {
      assert.equal(name, './supabaseClient');
      return { supabase };
    },
  };
  vm.runInNewContext(compiled, context, { filename });
  return context.exports;
}

const minimal = {
  id: 'test-chicken', name: 'Chicken thighs', quantity: null, unit: null,
  storage_location: null, category: null, expiration_date: null, note: null,
};
const populated = {
  id: 'test-rice', name: 'Rice', quantity: 2, unit: 'cups',
  storage_location: 'pantry', category: 'Grains', expiration_date: '2027-01-01', note: 'Brown rice',
};

test('name-only insert sends only the supplied name', async () => {
  const api = loadInventory(async (url, options) => {
    assert.equal(new URL(url).pathname, '/rest/v1/inventory_items');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { name: 'Chicken thighs' });
    return new Response(null, { status: 201 });
  });
  assert.equal((await api.insertInventoryItem({ name: 'Chicken thighs' })).error, null);
});

test('fetch returns null metadata and populated records unchanged', async () => {
  const api = loadInventory(async (url, options) => {
    assert.equal(options.method, 'GET');
    assert.equal(new URL(url).searchParams.get('order'), 'name.asc');
    return Response.json([minimal, populated]);
  });
  const result = await api.fetchInventory();
  assert.equal(result.error, null);
  assert.deepEqual(result.data, [minimal, populated]);
});

test('populated inserts and updates preserve metadata; updates can clear metadata', async () => {
  for (const record of [populated, minimal]) {
    const { id, ...input } = record;
    const api = loadInventory(async (url, options) => {
      assert.deepEqual(JSON.parse(options.body), input);
      if (options.method === 'PATCH') {
        assert.equal(new URL(url).searchParams.get('id'), `eq.${id}`);
        return Response.json(record);
      }
      assert.equal(options.method, 'POST');
      return new Response(null, { status: 201 });
    });
    assert.equal((await api.insertInventoryItem(input)).error, null);
    const updated = await api.updateInventoryItem(id, input);
    assert.equal(updated.error, null);
    assert.deepEqual(updated.data, record);
  }
});

test('delete remains scoped to the requested ID', async () => {
  const api = loadInventory(async (url, options) => {
    assert.equal(options.method, 'DELETE');
    assert.equal(new URL(url).searchParams.get('id'), `eq.${minimal.id}`);
    return new Response(null, { status: 204 });
  });
  assert.equal((await api.deleteInventoryItem(minimal.id)).error, null);
});
