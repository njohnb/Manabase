# Track A — Slice 5: Tool registration & wiring

> Self-contained implementation spec. You do not need to read the PRDs to build this slice;
> everything binding is inlined. PRD references are pointers for deeper context only.

**Goal.** Make `card_search` reachable over MCP. After this slice the server is genuinely
usable: `tools/list` advertises `card_search` with a compact description and a JSON Schema,
and `tools/call` dispatches to the Slice 3 handler — with every handler failure returned as a
structured tool *result* the model can read and correct from, never as an MCP protocol error.

## Preconditions (deliverables of [Slice 4](./TrackA-Slice4.md))

- `src/scryfall/prices.ts` — trap-correct `resolvePrice` (foil/etched fallback with finish
  labeled, digital-only reason); its tests and fixtures pass.
- `src/tools/card-search.ts` — `cardSearch(client, params)` complete: query passthrough,
  `unique=cards`/`page=1` defaults, shaped `CardSummary` list, pagination reporting,
  zero-match → empty success, failures passed through. Tests pass.
- `src/scryfall/client.ts`, `src/result.ts`, `src/config.ts` per Slices 1–2.
- `src/index.ts` still the Slice 1 skeleton: empty `tools/list`, no client constructed.
- `dist/index.js` current and committed.

## Context

Manabase is a Magic: The Gathering MCP server (Scryfall-backed card search) that ships inside a
Claude Code plugin. This is slice 5 of 6 in Track A: skeleton → HTTP client → search handler →
price correctness → **tool wiring** → live acceptance.

## Deliverables

| File | Action |
|---|---|
| `src/tools/register.ts` | new — tool definitions, dispatch, registration |
| `src/index.ts` | modify — construct client, wire real handlers |
| `tests/tools/register.test.ts` | new |
| `dist/index.js` | rebuilt and committed (now bundles the client and handler) |

## Requirements

1. **Tool name: `card_search`.** The naming convention is `domain_verb_noun` in snake_case
   (MCP-PRD [D-11](../MCP-PRD.md#d-11--tool-naming-convention)). The bare name is what the server registers; when running inside the
   plugin, the harness exposes it as `mcp__plugin_manabase_mtg__card_search` — that scoping
   is the harness's job, not this code's.
2. **Compact description.** Deep Scryfall-syntax teaching ships in the plugin's skill, not
   in the tool description — whether the description needs to grow is an open question that
   gets *measured* later (MCP-PRD [OQ-01](../MCP-PRD.md#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model)); do not front-load syntax now. Use exactly:
   > Search Magic: The Gathering cards using Scryfall query syntax, evaluated by Scryfall
   > itself — supports all operators including `t:`, `o:`, `f:`, `cmc`, `usd`, `otag:`,
   > `art:`, and regex (`o:/…/`). Returns per-card gameplay fields, format legalities, and a
   > USD price with finish. 175 cards per page; the response reports `total_cards` and
   > `has_more`.
3. **Input schema is hand-written JSON Schema** (the low-level SDK server takes plain JSON
   Schema in `tools/list`; this avoids adding any dependency):
   ```json
   {
     "type": "object",
     "properties": {
       "q": { "type": "string", "description": "Scryfall query string. Full Scryfall syntax; evaluated server-side." },
       "unique": { "type": "string", "enum": ["cards", "prints", "art"], "description": "Result rollup. Default: cards (one row per card)." },
       "order": { "type": "string", "description": "Sort field, e.g. name, cmc, usd, edhrec, released." },
       "dir": { "type": "string", "enum": ["auto", "asc", "desc"], "description": "Sort direction." },
       "page": { "type": "integer", "minimum": 1, "description": "1-based page; 175 cards per page." }
     },
     "required": ["q"]
   }
   ```
4. **Dispatch, separated from transport so it is directly testable** (MCP-PRD [D-03](../MCP-PRD.md#d-03--testability-handlers-callable-as-plain-functions)): all
   logic lives in `dispatchToolCall`, a plain function; `registerTools` only installs thin
   SDK request handlers that delegate to it.
   - **Argument validation is minimal:** `args` must be an object with a string `q`. If not,
     return an **error-shaped tool result** (below) with code `bad_request` — do not validate
     or interpret the query string itself (Scryfall evaluates syntax; MCP-PRD [D-07](../MCP-PRD.md#d-07--three-way-cache-split)).
     Optional params pass through when they have the right primitive type; ignore unknown keys.
   - **Success:** `{ content: [{ type: "text", text: JSON.stringify(result.value) }] }`.
   - **Handler failure:** `{ isError: true, content: [{ type: "text", text:
     JSON.stringify({ error: result.error }) }] }` — the full `Failure.error` object,
     including Scryfall's verbatim `details`, so the model can correct a malformed query and
     retry. **A handler failure is never thrown and never becomes a JSON-RPC error**
     (MCP-PRD [D-10](../MCP-PRD.md#d-10--tool-handlers-never-throw)); a protocol error is opaque to the model, a structured result is
     actionable.
   - **Unknown tool name:** the one case that *is* a protocol-level error — throw within the
     SDK handler (harness misuse, not a query failure the model should retry).
5. **Wiring** (`src/index.ts`): `resolveConfig(process.env, process.platform)` →
   `createScryfallClient(config)` → `registerTools(server, client)` → connect stdio
   transport. Replace the Slice 1 empty `tools/list` handler — `register.ts` now owns both
   `tools/list` (serving `toolDefinitions`) and `tools/call` (delegating to
   `dispatchToolCall`). `src/index.ts` remains the only file reading `process.env`.
6. **stdout stays clean.** stdout is the MCP protocol channel; diagnostics go to
   `console.error` only.
7. Rebuild `dist/` and commit — the bundle now contains the client and handler for the first
   time; the self-containment property (runs with no `node_modules`) must still hold.

## Interface contracts

This slice **creates**:

```ts
// src/tools/register.ts
export const toolDefinitions: Array<{ name: string; description: string; inputSchema: object }>;

export function dispatchToolCall(
  client: ScryfallClient,
  name: string,
  args: unknown,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }>;

export function registerTools(server: Server, client: ScryfallClient): void;
```

This slice **consumes** (canonical, from earlier slices): `Config`/`resolveConfig` (Slice 1),
`Result`/`Failure` and `ScryfallClient`/`createScryfallClient` (Slice 2),
`cardSearch`/`CardSearchParams`/`CardSearchData` (Slice 3). SDK imports:
`Server` from `@modelcontextprotocol/sdk/server/index.js`, `StdioServerTransport` from
`…/server/stdio.js`, `ListToolsRequestSchema` and `CallToolRequestSchema` from `…/types.js`.
Repo layout is unchanged from the [Slice 1](./TrackA-Slice1.md) doc.

## Out of scope — do NOT

- No second tool, no syntax-reference resource, no `outputSchema`/`structuredContent` — one
  tool, text-JSON results. (Whether a syntax resource is needed is [OQ-01](../MCP-PRD.md#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model), measured in Track B.)
- No zod or any schema library — the JSON Schema above is a literal.
- No long description, no examples-in-description, no query preprocessing.
- No changes to handler, client, or price logic. No plugin-file changes
  (`.claude-plugin/`, `.mcp.json`, `skills/`, `README.md` are Track B's).
- No new dependencies.

## Acceptance criteria

1. `tools/list` over stdio returns exactly one tool, `card_search`, with the description and
   schema above (smoke test below).
2. A live `tools/call` with a real query round-trips: request → shaped `CardSearchData` JSON
   in `content[0].text` (verification step 3 — one polite live call).
3. A malformed query (`illustrationtag:dragon`) over `tools/call` returns `isError: true`
   with `error.code: "bad_request"` and Scryfall's `details` verbatim in the JSON — and the
   server stays up. **Never a JSON-RPC error for a handler failure.**
4. `dispatchToolCall` with missing/non-string `q` returns an error-shaped result (not a
   throw); with an unknown tool name, `tools/call` yields a protocol error.
5. All unit tests pass with no server or transport constructed ([D-03](../MCP-PRD.md#d-03--testability-handlers-callable-as-plain-functions)), no network.
6. `npm run typecheck`, `npm test`, `npm run build` pass; `dist/index.js` recommitted and
   still runs from a directory with no `node_modules`.

## Testing requirements

`tests/tools/register.test.ts`, `node:test` + `node:assert/strict`, calling `dispatchToolCall`
directly with a fake `ScryfallClient` (object literal returning canned `Result`s):

- valid args → success result; `JSON.parse(content[0].text)` matches the fake's shaped data
- client returns `bad_request` failure with details → `isError: true`, parsed body carries
  `error.code === "bad_request"` and the verbatim `details`
- `args` missing `q` / `q` not a string / `args` not an object → `isError: true`,
  `bad_request`, no throw
- unknown tool name → rejects (assert via `assert.rejects`) — the protocol-error case
- `toolDefinitions`: exactly one entry named `card_search`; `required` includes `"q"`;
  description matches requirement 2 verbatim

## Verification steps

```bash
npm run typecheck && npm test && npm run build
# 1) tools/list smoke (Git Bash):
printf '%s\n' \
 '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' \
 '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
 '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
 | node dist/index.js
# 2) one polite live call (hits Scryfall once):
printf '%s\n' \
 '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' \
 '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
 '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"card_search","arguments":{"q":"t:goblin cmc=1 f:commander"}}}' \
 | node dist/index.js
# 3) self-containment: copy dist/index.js to an empty dir and repeat step 1 there
git add -A && git status
```

## References

- [`docs/DEV-ROADMAP.md`](../DEV-ROADMAP.md) [§4](../DEV-ROADMAP.md#4-phase-1-slices), [Slice 5](../DEV-ROADMAP.md#slice-5--tool-registration--wiring).
- [`docs/MCP-PRD.md`](../MCP-PRD.md) [D-03](../MCP-PRD.md#d-03--testability-handlers-callable-as-plain-functions) (dispatch testable without transport), [D-07](../MCP-PRD.md#d-07--three-way-cache-split) (no query validation),
  [D-10](../MCP-PRD.md#d-10--tool-handlers-never-throw) (failures as structured results, never protocol errors), [D-11](../MCP-PRD.md#d-11--tool-naming-convention) (tool naming), [OQ-01](../MCP-PRD.md#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model)
  (description stays compact until measured).
- [`docs/PLUGIN-PRD.md`](../PLUGIN-PRD.md) [P-12](../PLUGIN-PRD.md#p-12--plugin-name-and-server-key) (scoped tool name `mcp__plugin_manabase_mtg__card_search` — the
  harness's doing; register the bare name).
