# Track A — Slice 15: transport generalization and the POST verb

> Self-contained implementation spec. You do not need to read the PRDs to build this slice;
> everything binding is inlined. PRD references are pointers for deeper context only.

**Goal.** Make the HTTP client serve a second host without copying it. Today
[`src/scryfall/client.ts`](../../src/scryfall/client.ts) is the only module that touches `fetch`,
and every Scryfall-specific thing in it — the lane table, five message strings, the error-body
shape — is welded to the generic machinery around it: a queue with an enqueue-before-`await`
prefix, a stamp-before-fetch rule, a restamp-after-backoff rule, and a 30-second lockout written
into shared state on a persisted 429. [CAP-02](../MCP-PRD.md#cap-02--combo-discovery) needs that
machinery pointed at `backend.commanderspellbook.com`, and it needs a **POST** verb the codebase
does not have at all.

**This slice ships no capability and adds no tool.** It is infrastructure, and its whole
correctness claim is that nothing observable changes for Scryfall. Two facts carry that claim and
both are checkable in minutes: `tests/scryfall/client.test.ts` (4 suites, 21 tests) must pass with
**one** edit — adding `spellbookBaseUrl` to its `Config` literal — and `npm run acceptance` must
stay 13/13. If either needs more, the refactor is wrong and not merely inconvenient.

**Why a refactor rather than a second client.** [D-16](../MCP-PRD.md#d-16--no-npm-commander-spellbook-client-dependency)
rejected a first-party, MIT, zero-dependency npm client that clears four of five objections
levelled at its Moxfield counterpart — and the decisive ground was that adopting it would leave
"one source of three speaking a different error model, a different throttle, and a different test
harness, permanently." A hand-copied second client fails that test the same way. There is one
transport in this repo or the decision meant nothing.

## Preconditions (deliverables of [Slice 2](./TrackA-Slice2.md))

- [`src/scryfall/client.ts`](../../src/scryfall/client.ts) with `createScryfallClient`,
  `ScryfallClient`, `ClientDeps`, the two lanes, and the status-mapping table.
- [`src/config.ts`](../../src/config.ts) with `resolveConfig(env, platform)` returning
  `{ userAgent, cacheDir, scryfallBaseUrl }`.
- [`src/result.ts`](../../src/result.ts) with `Result<T>` and the six-member `FailureCode` union.
  It has no imports and needs no change.
- `tests/scryfall/client.test.ts` with `makeHarness` — a virtual clock where `sleep` advances
  `clock` and `fetchImpl` replays a scripted `Response[]`. That injection surface is what makes
  this refactor testable without waiting 30 real seconds, and it is preserved exactly.
- `scripts/cap01-live.mjs` (`npm run acceptance`), 13 live checks.

[CAP-02](../MCP-PRD.md#cap-02--combo-discovery) is specified and its
[§4.4](../MCP-PRD.md#44-commander-spellbook) research record is complete, including the
2026-08-24 probe addendum. Nothing else is required.

## Context

Manabase is a Magic: The Gathering MCP server that ships inside a Claude Code plugin and, since
[PC-03](../PLUGIN-PRD.md#pc-03--mcpb-bundle-for-the-chat-tab), as an MCPB bundle for the Claude
Desktop Chat tab. Track A is the server track: 1 (skeleton) · 2 (client) · 3 (handler) · 4
(prices) · 5 (wiring) · 6 (live pass) · 14 (trim and cap) · **15 (this slice)** · 16
(`combo_search`) · 17 (`combo_find_deck`).

Three things about the current client decide the shape of the extraction:

- **The lane is not a delay, it is a queue.** `lane.tail` is a promise chain swapped
  **synchronously**, before any `await`, so concurrent `get()` calls enqueue in invocation order.
  `nextAllowedAt` is stamped **before** the fetch because the upstream limit is on request
  *starts*. `release()` lives in a `finally`, so a failed request cannot wedge the lane, and the
  lane is held across the whole 30-second backoff so a 429 stalls the lane rather than one caller.
  Every one of those is load-bearing and none is obvious from reading the happy path.
- **`Config` has nowhere to hang a second host.** `userAgent` and `scryfallBaseUrl` are hard-coded
  locals inside `resolveConfig`; neither is env-overridable, and that stays true.
- **There is no POST anywhere.** `fetchImpl(url, { headers })` is the only call site and passes no
  `method` and no `body`. [CAP-02](../MCP-PRD.md#cap-02--combo-discovery) needs POST twice —
  `/find-my-combos` and Scryfall's `POST /cards/collection`. `/cards/collection` is already in the
  card-lane prefix table, anticipated by [Slice 2](./TrackA-Slice2.md) and unreachable ever since.

## Deliverables

| File | Action |
|---|---|
| `src/http/client.ts` | new — `createHttpClient(spec, deps)`, `HttpClient`, `SourceSpec`, `LaneSpec`, `ClientDeps` |
| [`src/scryfall/client.ts`](../../src/scryfall/client.ts) | modify — becomes the Scryfall `SourceSpec` plus a thin `createScryfallClient`; keeps every export it has today |
| `src/spellbook/client.ts` | new — `createSpellbookClient(config, deps)` |
| [`src/config.ts`](../../src/config.ts) | modify — adds `spellbookBaseUrl` |
| `dist/index.js` | rebuild and commit — [P-09](../PLUGIN-PRD.md#p-09--server-ships-as-committed-built-javascript), enforced by CI |
| `tests/http/client.test.ts` | new — the generic machinery, the POST verb, and the two-source lane independence |
| `tests/spellbook/client.test.ts` | new — the Spellbook lane spacing and its error-body reader |
| `tests/scryfall/client.test.ts` | modify — **one line**: `spellbookBaseUrl` in the `Config` literal |
| `tests/config.test.ts` | modify — the new `Config` field |
| [`docs/DEV-ROADMAP.md`](../DEV-ROADMAP.md) | modify — [§7](../DEV-ROADMAP.md#7-phase-2-slices--combo-discovery) status only |
| `docs/slices/TrackA-Slice15-results.md` | new |

No file under `skills/`, `.claude-plugin/`, `mcpb/`, or `.github/` changes, and no tool is
registered — [`src/index.ts`](../../src/index.ts) and
[`src/tools/register.ts`](../../src/tools/register.ts) are **untouched**.

## Requirements

1. **The extraction is behaviour-preserving for Scryfall, and the proof is mechanical.** All eight
   of the client's message strings become `${sourceName}` templates. At `sourceName: "Scryfall"`
   every one interpolates **byte-identically** to what ships today:

   ```
   `${sourceName} rate limit persisted after a 30 second backoff; wait at least 30 seconds before retrying.`
   `${sourceName} returned a non-JSON success body (status ${status}).`
   `${sourceName} rejected the request as malformed.`
   `${sourceName} found no match for the request.`
   `${sourceName} is currently unavailable.`
   `${sourceName} returned an unexpected status ${status}.`
   `Could not reach ${sourceName}: ${describe(err)}`
   `Unexpected failure in ${sourceName} client: ${describe(err)}`
   ```

   Check the last two by eye before you trust them — they are the two that do not begin with the
   source name and they are the two a careless template breaks.

2. **`tests/scryfall/client.test.ts` passes with exactly one edit and `npm run acceptance` stays
   13/13.** The one edit is adding `spellbookBaseUrl` to that file's `Config` literal. Those 21
   tests pin header capture, URL assembly and `undefined`-skipping, 500 ms card spacing, 100 ms
   other spacing, lane independence, `/cards/random` and `/cards/collection` lane membership,
   429→200 with no immediate retry, the post-retry restamp, 429→429 with no second retry, verbatim
   `details` on a persisted 429, the 30-second lane lockout for queued requests, and the whole
   status table. **If a second edit is needed, stop and work out why** — that file is the
   specification of the behaviour being preserved, and editing it to match new behaviour is how a
   refactor silently becomes a rewrite.

3. **Every timing rule survives verbatim.** Do not "clean up" any of these:
   - the synchronous prefix — `const previous = lane.tail` and the reassignment of `lane.tail`
     happen **before** the first `await`, so concurrent calls enqueue in invocation order;
   - `lane.nextAllowedAt = now() + spacingMs` is stamped **before** the fetch, not after;
   - the same stamp is **repeated after** the 30-second backoff, so spacing is relative to the
     retry;
   - a persisted 429 writes `now() + 30_000` into lane state, so a *queued* request waits out the
     lockout instead of firing into it;
   - `release()` is in a `finally`, and the lane is held for the whole request **including** the
     backoff;
   - `if (wait > 0) await sleep(wait)` — sleep only when strictly positive, or the virtual-clock
     tests record a spurious `0`.

   [D-16](../MCP-PRD.md#d-16--no-npm-commander-spellbook-client-dependency) calls this "the
   subtlest code in this repo" and rejected an otherwise-good npm client rather than rebuild it.
   Moving it is already the risk; changing it is not on the table.

4. **The lane table becomes plain data, and Scryfall's lanes are unchanged.**

   ```ts
   export interface LaneSpec {
     spacingMs: number;
     pathPrefixes?: readonly string[];   // absent -> reachable only as the default lane
   }
   ```

   Selection: walk `Object.entries(spec.lanes)` **in declaration order**, take the first lane one
   of whose `pathPrefixes` the path `startsWith`, else `spec.defaultLane`. Scryfall keeps `card` at
   **500 ms** over `/cards/search`, `/cards/named`, `/cards/random`, `/cards/collection` and
   `other` at **100 ms** as the default — the published 2/second and 10/second of
   [§3.4](../MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance).

   Do **not** keep the current `lane === lanes.card ? 500 : 100` identity comparison. It is the one
   piece of the original that does not survive generalization, and reproducing it with a two-lane
   assumption is the bug this requirement exists to prevent.

5. **Commander Spellbook gets its own client instance and one lane at 500 ms.**
   [§3.7](../MCP-PRD.md#37-undocumented-and-bot-protected-third-party-apis): treat an undocumented
   source as the strictest lane in [§3.4](../MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance)
   until told otherwise, and Commander Spellbook publishes no limit and exposes no rate-limit
   header ([§4.4](../MCP-PRD.md#44-commander-spellbook),
   [OQ-05](../MCP-PRD.md#oq-05--do-commander-spellbook-or-archidekt-impose-rate-limits)). It is a
   **different host**, so it gets a separate `createHttpClient` call with its own lane state —
   sharing Scryfall's lanes would throttle two hosts against one budget sized for neither. Lane
   state lives in the closure, so two instances cannot interfere; this requirement is really "call
   the factory twice", and the test in requirement 12 is what proves it.

6. **Add POST, riding the same lane discipline as GET.** Both verbs go through one internal
   `run(path, init, query)`; `attemptOnce(url)` becomes `attemptOnce(url, init)`. POST sends
   `method: "POST"`, `body: JSON.stringify(body)`, and `Content-Type: application/json` **in
   addition to** the `User-Agent` and `Accept` every request already carries
   ([§3.4](../MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance) requires both and
   forbids a default library agent). Queue, spacing, 429 backoff, restamp and lockout are shared
   code, not duplicated — a POST that skips the queue is a POST that is not rate-limited.

   `text/plain` bodies are **not** supported. `/find-my-combos` accepts one; this server has no use
   for it and an unused content-type is an untested branch.

7. **`detailsFrom` is per-source, because the two hosts do not report errors alike.** Scryfall
   returns `{ details: "…" }`. Commander Spellbook returns a Django-REST field-error map —
   `{"q":["Invalid search query: unexpected character : at position 34."]}` — so its reader
   flattens entries to `field: message`, joining multiples, and **preserves the upstream text
   verbatim**: [CAP-02](../MCP-PRD.md#cap-02--combo-discovery) criterion 3 requires the message to
   survive so the model self-corrects on the next call
   ([D-10](../MCP-PRD.md#d-10--tool-handlers-never-throw)). An unparseable or unexpected body drops
   `details` and keeps the mapped code, exactly as today. Never throw out of a `detailsFrom` —
   a reader that throws converts a clean `bad_request` into the `unexpected` backstop.

8. **Do not move the 422 re-code, and do not add a 404 policy to the transport.** Two mappings
   currently live above the client and both stay there:
   - `cardSearch` re-codes a 422 from `unexpected` to `bad_request`. It belongs to paging
     semantics, not to HTTP.
   - `cardSearch` turns Scryfall's 404 into a **successful empty result**, because zero matches is
     a search outcome ([§4.1.1](../MCP-PRD.md#411-search-endpoint)).

   The second matters more than it looks. **Commander Spellbook answers a valid query with no
   matches as HTTP 200 carrying `{"count":0,…,"results":[]}`, not a 404** — verified 2026-08-24 and
   recorded in [§4.4](../MCP-PRD.md#44-commander-spellbook). A 404-as-empty rule pushed down into
   the shared transport would be wrong for one of the two sources on day one. The transport maps
   status to code and nothing else.

9. **Config gains one field and stays a single read at the entry point.**
   `spellbookBaseUrl: "https://backend.commanderspellbook.com"`, a hard-coded local inside
   `resolveConfig` beside `scryfallBaseUrl`, not env-overridable. No `process.env` below
   [`src/index.ts`](../../src/index.ts) ([D-03](../MCP-PRD.md#d-03--testability-handlers-callable-as-plain-functions)).

10. **Nothing is wired, and the unused field is deliberate.**
    [`src/index.ts`](../../src/index.ts) and [`src/tools/register.ts`](../../src/tools/register.ts)
    do not change, no tool is registered, and `spellbookBaseUrl` is read by nothing until
    [Slice 16](./TrackA-Slice16.md). That is the same shape `cacheDir` has had since
    [Slice 1](./TrackA-Slice1.md) and it keeps this slice's diff reviewable as what it claims to
    be. `createSpellbookClient` ships **exercised by tests and called by no production code.**

11. **`src/scryfall/client.ts` keeps every export it has today.** `createScryfallClient(config,
    deps?)`, the `ScryfallClient` type, and `ClientDeps`. `ScryfallClient` becomes an alias of
    `HttpClient` — so it gains `post`, which is what [Slice 17](./TrackA-Slice17.md) needs for
    `POST /cards/collection` — and `ClientDeps` is re-exported from its new home so no importer
    breaks. Nothing outside this slice should have to learn a new import path.

12. **Two lanes on two hosts do not interfere, and that is a test, not an assertion.** Drive both
    clients off **one** shared virtual clock and assert that a Commander Spellbook request neither
    delays nor is delayed by a Scryfall card-lane request, while consecutive Commander Spellbook
    requests stay **≥ 500 ms** apart. This is [CAP-02](../MCP-PRD.md#cap-02--combo-discovery)
    criterion 12 and it is the one criterion this slice can fully discharge on its own.

13. **No new npm dependency, dev or runtime, and the SDK stays a devDependency.** The bundle is
    what makes the server start with no network and no `node_modules`. This slice adds files, not
    packages.

14. **Rebuild and commit `dist/index.js` in the same commit as the `src/` change.**
    [P-09](../PLUGIN-PRD.md#p-09--server-ships-as-committed-built-javascript): the committed bundle
    is what the plugin starts, and a stale or absent one produces a plugin whose tools are simply
    *absent* with no error. [Slice 11](./TrackC-Slice11.md)'s CI gate fails the PR otherwise; it
    reports the omission, it does not repair it. On this machine a freshly built `dist/index.js`
    reports ` M` with an empty diff — that is a stale stat cache, cleared by
    `git add --renormalize dist/index.js`, and it is not CRLF.

## Interface contracts

```ts
// src/http/client.ts

export interface ClientDeps {
  fetchImpl?: typeof fetch;                 // default: globalThis.fetch
  now?: () => number;                       // default: Date.now
  sleep?: (ms: number) => Promise<void>;    // default: setTimeout wrapper
}

export interface LaneSpec {
  spacingMs: number;
  pathPrefixes?: readonly string[];
}

export interface SourceSpec {
  sourceName: string;                       // interpolated into every message
  baseUrl: string;
  userAgent: string;
  lanes: Readonly<Record<string, LaneSpec>>;  // first prefix match wins, declaration order
  defaultLane: string;                        // must be a key of `lanes`
  detailsFrom: (text: string) => string | undefined;
}

export interface HttpClient {
  get(path: string, query?: Record<string, string | undefined>): Promise<Result<unknown>>;
  post(path: string, body: unknown, query?: Record<string, string | undefined>): Promise<Result<unknown>>;
}

export function createHttpClient(spec: SourceSpec, deps?: ClientDeps): HttpClient;
```

```ts
// src/scryfall/client.ts — surface unchanged
export type { ClientDeps };
export type ScryfallClient = HttpClient;          // gains `post`
export function createScryfallClient(config: Config, deps?: ClientDeps): ScryfallClient;

// src/spellbook/client.ts
export type SpellbookClient = HttpClient;
export function createSpellbookClient(config: Config, deps?: ClientDeps): SpellbookClient;
```

```ts
// src/config.ts
export interface Config {
  userAgent: string;
  cacheDir: string;
  scryfallBaseUrl: string;
  spellbookBaseUrl: string;   // new — https://backend.commanderspellbook.com
}
```

`Result<T>` and `FailureCode` are **unchanged**. [`src/result.ts`](../../src/result.ts) has no
imports and is already transport-agnostic; its doc comments name Scryfall, and rewording them is
optional and cosmetic. Do not add a `FailureCode` member for this slice — the six cover both hosts.

## Out of scope — do NOT

- **No tool, no handler, no registration.** [`src/tools/register.ts`](../../src/tools/register.ts)
  and [`src/index.ts`](../../src/index.ts) are untouched;
  [Slice 16](./TrackA-Slice16.md) owns the `Clients` bundle and the wiring.
- **No npm client.** [D-16](../MCP-PRD.md#d-16--no-npm-commander-spellbook-client-dependency)
  rejected `@space-cow-media/spellbook-client` on four grounds that this slice does not disturb,
  and its fifth — bundle cost — is recorded as **unmeasured, in those words**. Do not treat
  "unmeasured" as "small", and do not adopt it type-only: its generated variant type declares
  `prices` and every `imageUri*` field, which is exactly what
  [Slice 16](./TrackA-Slice16.md) makes unrepresentable.
- **No change to the retry policy.** One retry after one fixed 30-second backoff, no jitter, and
  **no `Retry-After` header read**. Adding one is a behaviour change, and
  [§3.4](../MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance) is unforgiving: a 429
  locks access for 30 seconds and sustained overage risks banning the application for every user.
- **Never deliberately provoke a 429** to see what happens. The 429 paths are tested against the
  virtual clock and mocked responses, permanently and correctly.
- **No timeout, no `AbortController`, no retry on `network`.** The current client has none; adding
  one here hides behind a refactor.
- **No caching, no persistence, no `cacheDir` use.** `spellbookBaseUrl` is configuration, not
  storage.
- **No transport abstraction beyond this.** [D-04](../MCP-PRD.md#d-04--no-transport-abstraction-layer)
  rejected a layer over the SDK's transport; this is a layer *under* the capability handlers, over
  `fetch`, which is a different thing — but it is also the last one. No middleware chain, no
  interceptors, no plugin hooks.
- **No `text/plain` request bodies**, no multipart, no streaming.
- **No edits to [§2](../MCP-PRD.md#2-locked-decisions) or
  [§3](../MCP-PRD.md#3-constraints) of either PRD**, and no rewriting of
  [§4](../MCP-PRD.md#4-external-dependencies).

## Acceptance criteria

1. **[requirement 2]** `tests/scryfall/client.test.ts` passes with exactly one changed line, and
   `git diff` on that file shows one insertion and one deletion.
2. **[requirement 1]** A test asserts each of the eight message templates at
   `sourceName: "Scryfall"` against the string literal that ships today.
3. **[requirement 6]** A POST carries `method: "POST"`, a `Content-Type: application/json` header,
   and `JSON.stringify(body)` as its body — asserted by capturing the `RequestInit` the fake
   `fetchImpl` receives.
4. **[[CAP-02](../MCP-PRD.md#cap-02--combo-discovery) criterion 11]** Every outbound request, GET
   and POST, on both sources, carries a `User-Agent` naming this application and an `Accept`
   header.
5. **[[CAP-02](../MCP-PRD.md#cap-02--combo-discovery) criterion 12, requirement 12]** Two
   Commander Spellbook requests issued back to back are ≥ 500 ms apart on the virtual clock, and
   interleaving a Scryfall card-lane request changes neither client's timing.
6. **[[CAP-02](../MCP-PRD.md#cap-02--combo-discovery) criterion 3, client half]** An HTTP 400
   whose body is `{"q":["Invalid search query: unexpected character : at position 34."]}` returns
   `code: "bad_request"`, `status: 400`, and `details` carrying that message **verbatim**. The
   handler does not throw.
7. **[requirement 7]** A Commander Spellbook error body that is not a field-error map, and one
   that is not JSON at all, each drop `details` and keep the mapped code. Neither throws.
8. **[requirement 4]** Lane selection is asserted per prefix: `/cards/search`, `/cards/named`,
   `/cards/random` and `/cards/collection` take the 500 ms lane; anything else takes 100 ms; and a
   single-lane spec routes every path to its default.
9. **[requirement 3]** The 429 suite still holds on the generic client: one retry and never two,
   `sleeps` reading `[30000, 500]` after a 429→200, and a queued request on the same lane
   observing the 30-second lockout after a persisted 429.
10. **[requirement 9]** `resolveConfig` returns `spellbookBaseUrl` as
    `https://backend.commanderspellbook.com` on every platform branch, and no `process.env` read
    exists below [`src/index.ts`](../../src/index.ts).
11. **[requirement 10]** `git diff` shows [`src/index.ts`](../../src/index.ts) and
    [`src/tools/register.ts`](../../src/tools/register.ts) unchanged, and `tools/list` still
    reports exactly one tool.
12. `npm test` passes, and the suite/test totals are recorded in the results doc against the
    current 27 suites / 101 tests.
13. `npm run typecheck` is clean under `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`
    and `verbatimModuleSyntax` — new intra-project imports carry the `.ts` extension and type-only
    imports say `import type`.
14. `npm run acceptance` is **13/13** live against real Scryfall, with no 429 and calls ≥ 600 ms
    apart.
15. `npm run build` leaves `git status --porcelain -- dist/` empty, and the rebuilt bundle is in
    the same commit as the `src/` change.
16. `npm run lint:docs` passes, and `docs/slices/TrackA-Slice15-results.md` records the date, the
    suite/test counts before and after, the acceptance result, and the one-line diff of
    `tests/scryfall/client.test.ts`.

## Testing requirements

Handlers and clients are called as plain functions, no server started and no transport constructed
([D-03](../MCP-PRD.md#d-03--testability-handlers-callable-as-plain-functions)). Extend the existing
patterns rather than inventing new ones.

**Reuse `makeHarness`.** `tests/scryfall/client.test.ts` builds a virtual clock where `sleep`
pushes onto `sleeps[]` and advances `clock`, and `fetchImpl` replays a scripted `Response[]` while
recording `{ url, at, headers }`. Lift that helper into `tests/http/client.test.ts` and extend the
recorded call to carry the `RequestInit` — `method` and `body` — which is what criterion 3 reads.
Zero real time elapses; a 30-second backoff test runs instantly. Keep it that way.

Suites to add:

- **`tests/http/client.test.ts`** — the eight message templates; lane selection by prefix and the
  single-lane default; POST verb, headers and body; the 429 suite re-driven through the generic
  factory; the `D-10` backstop (a `fetchImpl` resolving `undefined`); URL assembly and
  `undefined`-value skipping.
- **`tests/spellbook/client.test.ts`** — 500 ms spacing on the one lane; the field-error-map
  `detailsFrom` including a multi-field body and a multi-message field; the non-map and non-JSON
  bodies; and the header assertions for criterion 4.
- **Cross-source** (in `tests/http/client.test.ts`) — the two-client independence of criterion 5,
  on one shared clock.

Fixtures are loaded with `readFileSync` via the `new URL(…, import.meta.url)` helper, never a JSON
import, so they behave identically under type stripping and under the bundle.
`tests/fixtures/spellbook/variants-invalid-query-400.json` is the verbatim 400 body criterion 6
needs; `tests/fixtures/spellbook/README.md` records which fixtures are verbatim and which are
truncated.

`npm run acceptance` stays a deliberate, human-run, local step. Run it **once** after the change.
Do not wire it into CI under any trigger — [Slice 6](./TrackA-Slice6.md) and
[Slice 11](./TrackC-Slice11.md) both refuse this and
[§3.4](../MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance) is why.

## Verification steps

```bash
# 1) the behaviour-preservation gate — run this FIRST, before writing new tests
npm test -- --test-name-pattern="scryfall client"
git diff --stat tests/scryfall/client.test.ts   # must read 1 insertion, 1 deletion

# 2) full unit level
npm test                       # record suite/test counts for the results doc
npm run typecheck

# 3) the wiring is genuinely untouched
git diff --stat src/index.ts src/tools/register.ts   # must print nothing

# 4) build honesty — Slice 11's gate, run before CI runs it for you
npm run build
git status --porcelain -- dist/          # must print nothing
#   if it prints " M" with an empty `git diff`, it is a stale stat cache:
#   git add --renormalize dist/index.js

# 5) docs
npm run lint:docs

# 6) live, deliberate, spaced
npm run acceptance                       # 13/13; >=600 ms between calls; must not provoke a 429

# 7) pre-push
claude plugin validate . --strict
```

## References

- [`docs/MCP-PRD.md`](../MCP-PRD.md)
  [D-16](../MCP-PRD.md#d-16--no-npm-commander-spellbook-client-dependency) — why there is one
  transport and not two, and the description of the lane machinery this slice must not alter. Read
  its second bullet before touching `run()`.
- [`docs/MCP-PRD.md`](../MCP-PRD.md)
  [§3.4](../MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance) — the published Scryfall
  numbers, the `User-Agent` and `Accept` requirement, and the standing ban on provoking a 429;
  [§3.7](../MCP-PRD.md#37-undocumented-and-bot-protected-third-party-apis) — the strictest-lane
  rule for a source that publishes nothing.
- [`docs/MCP-PRD.md`](../MCP-PRD.md) [§4.4](../MCP-PRD.md#44-commander-spellbook) — the endpoint
  record, the HTTP 400 body shape requirement 7 parses, and the 2026-08-24 probe addendum
  establishing that zero matches is a 200 rather than a 404.
- [`docs/MCP-PRD.md`](../MCP-PRD.md) [CAP-02](../MCP-PRD.md#cap-02--combo-discovery) — criteria 3,
  11 and 12, which this slice discharges, and the lane bullet requirement 5 implements.
- [`docs/MCP-PRD.md`](../MCP-PRD.md)
  [D-03](../MCP-PRD.md#d-03--testability-handlers-callable-as-plain-functions) (config read once
  at the entry point, handlers callable as plain functions),
  [D-04](../MCP-PRD.md#d-04--no-transport-abstraction-layer) (the abstraction that was rejected,
  and why this is not it), [D-10](../MCP-PRD.md#d-10--tool-handlers-never-throw) (handlers never
  throw).
- [`docs/slices/TrackA-Slice2.md`](./TrackA-Slice2.md) — the client this slice extracts, including
  the reasoning behind the queue-not-delay design.
- [`docs/slices/TrackC-Slice11.md`](./TrackC-Slice11.md) — the CI gate that fails this PR if
  `dist/` is not rebuilt, and why absent-`dist/` is the failure that matters.
- `CLAUDE.md`, "Rules that are easy to violate by accident" and "Environment" — the 429 rule, the
  `User-Agent` rule, and the CRLF and stale-stat-cache traps requirement 14 names.
