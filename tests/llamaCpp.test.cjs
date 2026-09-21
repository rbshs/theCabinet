const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const filename = path.join(__dirname, '../services/ai/llamaCpp.ts');
const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

// Run the actual adapter in Node without adding a TypeScript runner dependency.
// Next normally resolves this marker to its empty module for server execution.
function loadProvider(overrides = {}) {
  const context = {
    exports: {},
    require(name) {
      assert.equal(name, 'server-only');
      return require('next/dist/compiled/server-only/empty');
    },
    process: { env: { AI_SERVICE_ENDPOINT: 'http://127.0.0.1:8080' } },
    URL, AbortController, setTimeout, clearTimeout, fetch,
    ...overrides,
  };
  vm.runInNewContext(compiled, context, { filename });
  return context.exports.llamaCppProvider;
}

const request = {
  userRequest: 'What should I make for dinner?',
  inventory: [{
    id: 'test-chicken', name: 'Chicken thighs', quantity: null, unit: null,
    storage_location: 'refrigerator', category: 'Meat', expiration_date: null, note: null,
  }],
};
const meal = {
  name: 'Chicken dinner', description: 'A chicken-based dinner; available quantity is unknown.',
  inventoryItemIds: ['test-chicken'],
};
const envelope = (value, finish_reason = 'stop') => Response.json({
  choices: [{ finish_reason, message: { content: JSON.stringify(value) } }],
});

if (process.argv.includes('--live')) {
  require('@next/env').loadEnvConfig(path.join(__dirname, '..'));
  loadProvider({ process }).suggestMeals(request).then(
    (result) => console.log(JSON.stringify(result, null, 2)),
    (error) => { console.error(error.message); process.exitCode = 1; },
  );
} else {
  const { test } = require('node:test');

  test('sends structured inventory and request; validates a successful completion', async () => {
    const provider = loadProvider({ fetch: async (url, options) => {
      assert.equal(String(url), 'http://127.0.0.1:8080/v1/chat/completions');
      assert.equal(options.method, 'POST');
      assert.equal(options.cache, 'no-store');
      assert.equal(options.redirect, 'error');
      assert.equal(options.headers.Authorization, undefined);
      const body = JSON.parse(options.body);
      assert.equal(body.model, 'qwen3-general');
      assert.equal(body.stream, false);
      assert.equal(body.chat_template_kwargs.enable_thinking, false);
      assert.equal(body.response_format.type, 'json_object');
      assert.deepEqual(body.response_format.schema.required, ['suggestions']);
      assert.deepEqual(JSON.parse(body.messages[1].content), request);
      return envelope({ suggestions: [meal] });
    } });
    assert.equal(JSON.stringify(await provider.suggestMeals(request)), JSON.stringify({ suggestions: [meal] }));
  });

  test('allows an empty suggestions response', async () => {
    const provider = loadProvider({ fetch: async () => envelope({ suggestions: [] }) });
    assert.equal((await provider.suggestMeals(request)).suggestions.length, 0);
  });

  test('rejects missing/invalid configuration and blank requests before fetching', async () => {
    for (const endpoint of ['', 'invalid', 'file:///tmp', 'http://localhost:8080/v1', 'http://user:secret@localhost:8080']) {
      const provider = loadProvider({
        process: { env: { AI_SERVICE_ENDPOINT: endpoint } },
        fetch: () => assert.fail('must not fetch'),
      });
      await assert.rejects(provider.suggestMeals(request), /AI_SERVICE_ENDPOINT/);
    }
    await assert.rejects(loadProvider().suggestMeals({ ...request, userRequest: ' ' }), /request is required/);
  });

  test('reports HTTP and connection errors without leaking server data', async () => {
    const http = loadProvider({ fetch: async () => new Response('private server detail', { status: 503 }) });
    await assert.rejects(http.suggestMeals(request), { message: 'Local AI request failed (HTTP 503).' });
    const offline = loadProvider({ fetch: async () => { throw new Error('private connection detail'); } });
    await assert.rejects(offline.suggestMeals(request), /Could not communicate with the local AI server/);
  });

  test('times out and clears the timeout', async () => {
    let cleared = false;
    const provider = loadProvider({
      setTimeout: (callback) => { queueMicrotask(callback); return 1; },
      clearTimeout: () => { cleared = true; },
      fetch: async (_, { signal }) => new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')));
      }),
    });
    await assert.rejects(provider.suggestMeals(request), /timed out/);
    assert.equal(cleared, true);
  });

  test('rejects invalid envelopes, truncated output, invalid fields and invented IDs', async () => {
    const responses = [
      () => new Response('not JSON'),
      () => Response.json({ choices: [] }),
      () => envelope({ suggestions: [meal] }, 'length'),
      () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'not JSON' } }] }),
      () => envelope({ suggestions: 'wrong type' }),
      () => envelope({ suggestions: [{ ...meal, name: ' ' }] }),
      () => envelope({ suggestions: [{ ...meal, description: 1 }] }),
      () => envelope({ suggestions: [{ ...meal, inventoryItemIds: ['invented'] }] }),
      () => envelope({ suggestions: [{ ...meal, extra: true }] }),
      () => envelope({ suggestions: [], extra: true }),
    ];
    for (const response of responses) {
      const provider = loadProvider({ fetch: async () => response() });
      await assert.rejects(provider.suggestMeals(request), /Local AI returned/);
    }
  });
}
