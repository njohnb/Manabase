# Track A — Slice 2: Scryfall client

> Self-contained implementation spec. You do not need to read the PRDs to build this slice;
> everything binding is inlined. PRD references are pointers for deeper context only.

**Goal.** The one HTTP module every current and future capability reuses: a Scryfall client
with the required headers, enforced rate limits, disciplined 429 backoff, and never-throw
structured results. After this slice, no other module in the codebase ever calls `fetch`.

## Preconditions (deliverables of [Slice 1](./TrackA-Slice1.md))

- `package-lock.json` committed; `npm install` works.
- `tsconfig.json` has `allowImportingTsExtensions: true`; relative imports use `.ts`
  extensions; `package.json` test script is `node --test tests/`.
- `src/config.ts` exports the canonical `Config` + `resolveConfig`.
- `src/index.ts` starts a stdio MCP server (`manabase-mtg`, low-level `Server`, empty
  `tools/list`). stdout is the protocol channel — `console.log` is forbidden in server code.
- `tests/config.test.ts` passes; `dist/index.js` committed and self-contained.

## Context

Manabase is a Magic: The Gathering MCP server (Scryfall-backed card search) that ships inside a
Claude Code plugin. This is slice 2 of 6 in Track A: skeleton → **HTTP client** → search
handler → price correctness → tool wiring → live acceptance.

## Deliverables

| File | Action |
|---|---|
| `src/result.ts` | new — canonical `Result` union |
| `src/scryfall/client.ts` | new — `createScryfallClient` |
| `tests/scryfall/client.test.ts` | new |
| `dist/index.js` | rebuilt and committed (unchanged output is fine; rebuild anyway) |

## Requirements

1. **Never throw.** The client returns a `Result` for every outcome — HTTP errors, network
   failures, JSON parse failures, everything. A thrown exception higher up becomes an opaque
   MCP protocol error, which the model cannot correct from (MCP-PRD [D-10](../MCP-PRD.md#d-10--tool-handlers-never-throw)). Wrap the entire
   request path; the `unexpected` code is the backstop, never a rethrow.
2. **Required headers on every request** (Scryfall enforces these; MCP-PRD [§3.4](../MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance)):
   - `User-Agent: config.userAgent`
   - `Accept: application/json`
3. **Rate limits are hard constraints, not guidance.** Scryfall enforces per-endpoint limits
   and explicitly states ignoring 429 risks a temporary or permanent ban:
   - **2/second** for paths starting `/cards/search`, `/cards/named`, `/cards/random`,
     `/cards/collection` → minimum **500 ms** spacing between requests in this class.
   - **10/second** for all other endpoints → minimum **100 ms** spacing.
   - Enforce spacing per class (two classes, tracked independently; requests within a class
     are serialized). Implementation is free as long as observable spacing holds under
     concurrent calls.
4. **429 handling.** A 429 locks the caller out for ~30 seconds. On 429: wait **30,000 ms**
   (via the injected `sleep`), retry **once**; if the retry also 429s, return a failure with
   code `rate_limited` and a message telling the caller to wait before retrying. **Never
   retry immediately.**
5. **Status → code mapping**, with the response body's `details` field preserved **verbatim**
   whenever Scryfall supplies one — Scryfall's error text (e.g. `400 → "All of your terms
   were ignored"`) is the model's correction signal:
   | Outcome | `code` |
   |---|---|
   | HTTP 400 | `bad_request` |
   | HTTP 404 | `not_found` |
   | HTTP 429 after backoff+retry | `rate_limited` |
   | HTTP 5xx | `upstream_unavailable` |
   | fetch rejected (DNS, refused, timeout) | `network` |
   | anything else (parse failure, unknown status) | `unexpected` |
   Scryfall 4xx bodies are JSON objects with `object: "error"`, `status`, `code`, `details`,
   and sometimes `warnings`. If the body is not parseable JSON, still return the mapped code
   with a message; omit `details`.
6. **Success path.** 2xx → parse JSON body → `{ ok: true, value: <parsed body> }` typed as
   `unknown`. The client does not know about cards; shaping is Slice 3's job.
7. **Injected dependencies, no globals.** `fetchImpl`, `now`, and `sleep` are injectable so
   tests are deterministic and never touch the network or real timers. Defaults:
   `globalThis.fetch`, `Date.now`, promisified `setTimeout`.
8. **Query assembly.** `get(path, query)` builds `config.scryfallBaseUrl + path` with
   URL-encoded params, skipping entries whose value is `undefined`.
9. Rebuild `dist/` and commit (standing rule — even though `index.ts` does not import the
   client yet, keep the committed build current with `src/`).

## Interface contracts

This slice **creates** (canonical — consumed verbatim by Slices 3–5):

```ts
// src/result.ts
export type FailureCode =
  | "bad_request"          // HTTP 400 — malformed query; details carries Scryfall's text
  | "not_found"            // HTTP 404
  | "rate_limited"         // HTTP 429 persisted through one backoff-retry
  | "upstream_unavailable" // HTTP 5xx or Scryfall unreachable
  | "network"              // fetch rejected (DNS, timeout, refused)
  | "unexpected";          // anything else; never a rethrow

export interface Failure {
  ok: false;
  error: {
    code: FailureCode;
    message: string;   // one-sentence human/model-readable summary
    details?: string;  // Scryfall's own `details` text, verbatim, when the body carried one
    status?: number;   // HTTP status when applicable
  };
}

export interface Success<T> { ok: true; value: T; }
export type Result<T> = Success<T> | Failure;
```

```ts
// src/scryfall/client.ts
export interface ClientDeps {
  fetchImpl?: typeof fetch;                 // default: globalThis.fetch
  now?: () => number;                       // default: Date.now
  sleep?: (ms: number) => Promise<void>;    // default: setTimeout wrapper
}

export interface ScryfallClient {
  /** GET config.scryfallBaseUrl + path. Never throws. */
  get(path: string, query?: Record<string, string | undefined>): Promise<Result<unknown>>;
}

export function createScryfallClient(config: Config, deps?: ClientDeps): ScryfallClient;
```

This slice **consumes**: `Config` from `src/config.ts` (Slice 1). Repo layout is unchanged
from the [Slice 1](./TrackA-Slice1.md) doc.

## Out of scope — do NOT

- No card types, no result shaping, no `card_search` (Slice 3).
- No POST support — `/cards/collection` arrives with a later capability; adding it now is
  speculative abstraction (MCP-PRD [D-04](../MCP-PRD.md#d-04--no-transport-abstraction-layer)).
- No caching, no persistence, no reading `process.env` (config arrives as a parameter).
- No new npm dependencies. No changes to `src/index.ts` or plugin files.

## Acceptance criteria

Unit-level ownership of [CAP-01](../MCP-PRD.md#cap-01--card-search) criteria 10–12 (MCP-PRD [§5](../MCP-PRD.md#5-capabilities); Slice 6 re-checks them live):

1. **[[CAP-01](../MCP-PRD.md#cap-01--card-search) #10]** Every request carries `User-Agent` (containing `manabase-mtg/`) and
   `Accept` headers — asserted from the mock's captured requests.
2. **[[CAP-01](../MCP-PRD.md#cap-01--card-search) #11]** Two back-to-back card-endpoint calls are spaced ≥500 ms apart (asserted
   via injected `now`/`sleep`, not wall-clock).
3. **[[CAP-01](../MCP-PRD.md#cap-01--card-search) #12]** A 429 produces one 30,000 ms backoff then a retry; a second 429 returns
   `{ ok: false, error: { code: "rate_limited", ... } }`. No immediate retry ever occurs.
4. A 400 response body's `details` text survives verbatim into `error.details`.
5. 5xx → `upstream_unavailable`; a rejecting `fetchImpl` → `network`; no test observes a
   thrown exception from any client call.
6. `npm run typecheck`, `npm test`, `npm run build` pass; `dist/index.js` recommitted.

## Testing requirements

`tests/scryfall/client.test.ts`, `node:test` + `node:assert/strict`. Build a mock `fetchImpl`
that records `(url, init)` per call and returns scripted `Response` objects (`new Response(body,
{ status })` is available in Node ≥18). Inject a virtual clock: `now` returns a controlled
timestamp; `sleep(ms)` records `ms` and advances the clock without waiting. Cases:

- headers present on every request (criterion 1)
- spacing: two card-endpoint calls → second waits ≥500 ms of virtual time; two non-card calls
  → ≥100 ms; classes tracked independently (criterion 2)
- 429 → sleep(30000) → retry → 200 succeeds (one backoff, then success)
- 429 → 429 → `rate_limited` failure (criterion 3)
- 400 with Scryfall error body `{"object":"error","code":"bad_request","status":400,
  "details":"All of your terms were ignored."}` → `bad_request` + verbatim details (criterion 4)
- 500 → `upstream_unavailable`; fetch rejection → `network`; non-JSON 200 body → `unexpected`
  (criterion 5)
- query assembly: `undefined` params skipped, values URL-encoded

## Verification steps

```bash
npm run typecheck && npm test && npm run build
git add -A && git status   # dist/index.js current, tree clean after commit
```

## References

- [`docs/DEV-ROADMAP.md`](../DEV-ROADMAP.md) [§4](../DEV-ROADMAP.md#4-phase-1-slices), [Slice 2](../DEV-ROADMAP.md#slice-2--scryfall-client).
- [`docs/MCP-PRD.md`](../MCP-PRD.md) [§3.4](../MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance) (rate limits, 429, headers — the binding table), [§4.1](../MCP-PRD.md#41-scryfall-rest-api) (endpoint
  facts), [D-10](../MCP-PRD.md#d-10--tool-handlers-never-throw) (never throw, structured failures).
