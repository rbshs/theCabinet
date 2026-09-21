# Local meal suggestions

`llamaCppProvider` in `llamaCpp.ts` implements `MealSuggestionProvider`.
Import it only from server-side code. The `server-only` marker prevents importing
it into a Next.js client component. The shared types in `index.ts` stay provider-independent.
There is no UI or API route connected to the adapter yet.

Set `AI_SERVICE_ENDPOINT` in `.env.local` to the confirmed server base URL,
`http://127.0.0.1:8080`, without `/v1` or a completion path. No API key is required.
The adapter reads configuration when called, so a build does not require a running server.
The application does not start, stop, or select the loaded model.

The adapter posts to `/v1/chat/completions` using model alias `qwen3-general`,
non-streaming messages and `response_format: { type: 'json_object', schema: ... }`.
This format is supported by the inspected local llama.cpp source at
`C:/temp/AI/llama.cpp/tools/server/server-common.cpp` and documented in
[llama.cpp's server API](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md).
The structured inventory and user request are sent as JSON in the user message.
Qwen thinking is disabled through `chat_template_kwargs.enable_thinking`.
Output is limited to 2,048 tokens and the request times out after 120 seconds.

The adapter validates both the completion envelope and meal suggestion JSON,
including checking that referenced inventory IDs exist in the request.
Incomplete completions, invalid fields, HTTP failures and connection failures reject
the promise with an error. Raw response bodies and configuration values are not logged.
Schema validation does not guarantee culinary suitability or accurate interpretation
of every inventory field; those need review with the real model.

## Validation and manual test

Run the isolated adapter tests (HTTP responses are test fixtures, not an application provider):

```powershell
node --test tests/llamaCpp.test.cjs
npm.cmd run type-check
npm.cmd run build
```

To make a real request:

1. Manually start the Qwen3-14B-Q8_0 server with alias `qwen3-general`.
   Ensure the separate coding model is not the model currently serving port 8080.
2. Set `AI_SERVICE_ENDPOINT` in `.env.local` as described above.
3. Check the active alias with `Invoke-RestMethod http://127.0.0.1:8080/v1/models`.
4. Run `node tests/llamaCpp.test.cjs --live` from the project root.

The live mode invokes the actual adapter with a small chicken inventory and a dinner
request, prints validated suggestions, and exits unsuccessfully on an adapter error.
It makes no Supabase calls and does not modify inventory. Review the suggestion for
relevance and ensure it does not assume a known quantity. The script uses the existing
TypeScript compiler and Next.js server marker to run the adapter in Node; no runner
dependency is installed. This checks the adapter, not a user-facing application flow.
