# Track A — Slice 15 results: transport generalization and the POST verb

**Date:** 2026-08-25
**Spec:** [`TrackA-Slice15.md`](./TrackA-Slice15.md)
**Delivers:** [CAP-02](../MCP-PRD.md#cap-02--combo-discovery) criterion 12 in full, criterion 11 for
both sources, and the **client half** of criterion 3.
**Closes no open question.** [OQ-05](../MCP-PRD.md#oq-05--do-commander-spellbook-or-archidekt-impose-rate-limits)
is unmoved — the 500 ms lane is [§3.7](../MCP-PRD.md#37-undocumented-and-bot-protected-third-party-apis)'s
conservative rule applied, not a measured fit.

Environment: Windows 11, Node 26.7.0 locally (`.nvmrc` pins 22 for CI).

| | before | after |
|---|---|---|
| `npm test` | 27 suites / 101 tests | **39 suites / 150 tests** |
| `npm run typecheck` | clean | clean |
| `npm run acceptance` | 13/13 | **13/13** |
| `npm run lint:docs` | OK | OK |

---

## 1. The behaviour-preservation gate

Run **before** a single new test was written, which is the only order in which it proves anything:

```
$ npm test -- --test-name-pattern="scryfall client"
ℹ tests 101   ℹ suites 27   ℹ pass 101   ℹ fail 0

$ git diff --stat tests/scryfall/client.test.ts
 tests/scryfall/client.test.ts | 1 +
 1 file changed, 1 insertion(+)
```

The one changed line, in that file's `Config` literal:

```ts
  spellbookBaseUrl: "https://spellbook.test",
```

Those 21 tests pin header capture, URL assembly and `undefined`-skipping, 500 ms card spacing,
100 ms other spacing, lane independence, `/cards/random` and `/cards/collection` lane membership,
429→200 with no immediate retry, the post-retry restamp, 429→429 with no second retry, verbatim
`details` on a persisted 429, the 30-second lane lockout, and the whole status table. **All 101
passed against the extracted transport with no second edit**, which is the slice's whole correctness
claim.

**Acceptance criterion 1 asks for "one insertion and one deletion"; the real figure is one insertion
and zero deletions.** Adding a field to a five-line object literal cannot produce a deletion. The
criterion's substance — one line, and only one — is met, and the count above is recorded rather than
manufactured.

## 2. What moved

| File | Action |
|---|---|
| `src/http/client.ts` | **new** — `createHttpClient(spec, deps)`, `HttpClient`, `SourceSpec`, `LaneSpec`, `ClientDeps` |
| [`src/scryfall/client.ts`](../../src/scryfall/client.ts) | 162 → 43 lines: a `SourceSpec` plus a thin factory. Every export kept |
| `src/spellbook/client.ts` | **new** — `createSpellbookClient(config, deps)`, one lane at 500 ms |
| [`src/config.ts`](../../src/config.ts) | `spellbookBaseUrl` added |
| `tests/http/client.test.ts` | **new** — 7 suites / 32 tests |
| `tests/spellbook/client.test.ts` | **new** — 4 suites / 15 tests |
| [`tests/config.test.ts`](../../tests/config.test.ts) | one suite, 2 tests |
| `tests/scryfall/client.test.ts` | **one line** |
| `tests/tools/card-search.test.ts`, `tests/tools/register.test.ts` | a `post` stub on three fake clients — see [§6](#6-one-edit-the-spec-did-not-list) |
| `dist/index.js` | rebuilt and committed ([P-09](../PLUGIN-PRD.md#p-09--server-ships-as-committed-built-javascript)) |

Every timing rule moved character-for-character: the synchronous `lane.tail` prefix before any
`await`, `if (wait > 0) await sleep(wait)`, the stamp **before** the fetch, the **restamp** after the
30-second backoff, `now() + 30_000` written into lane state on a persisted 429, and `release()` in a
`finally` holding the lane across the whole request including the backoff.
[D-16](../MCP-PRD.md#d-16--no-npm-commander-spellbook-client-dependency) calls this the subtlest code
in the repo; moving it was the risk, and the 21 pinned tests are what says it survived.

## 3. Three things became data

**The lane table.** `LaneSpec` is `{ spacingMs, pathPrefixes? }`; selection walks
`Object.entries(spec.lanes)` in declaration order and takes the first lane one of whose prefixes the
path `startsWith`, else `defaultLane`. The old `lane === lanes.card ? 500 : 100` identity comparison
is **gone** — it is the one piece of the original that could not survive generalization. Scryfall's
lanes are unchanged: `card` at 500 ms over `/cards/search`, `/cards/named`, `/cards/random`,
`/cards/collection`, `other` at 100 ms as the default
([§3.4](../MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance)).

A test asserts first-match-in-declaration-order explicitly, because "most specific prefix wins" is
the plausible wrong reading: a spec declaring `/cards` at 700 ms before `/cards/search` at 50 ms
routes `/cards/search` to **700**.

**`sourceName`.** All eight message strings are `${sourceName}` templates, each asserted against the
literal that ships today. The two that do not begin with the source name are the two a careless
template breaks, and both are pinned:

```
Could not reach Scryfall: getaddrinfo ENOTFOUND api.scryfall.com
Unexpected failure in Scryfall client: clock exploded
```

The backstop message is triggered by a `now()` that throws, which makes the assertion exact rather
than dependent on whatever undici says when handed `undefined`.

**`detailsFrom`.** Per-source, because the two hosts do not report errors alike.

## 4. The Commander Spellbook reader

Scryfall returns `{ details: "…" }`. Commander Spellbook is Django REST framework and returns a
field-error map ([§4.4](../MCP-PRD.md#44-commander-spellbook), observed 2026-08-24). The reader
flattens entries to `field: message`, joins multiple messages with a space and multiple fields with
`"; "`, and preserves the upstream text verbatim.

| body | `details` |
|---|---|
| `{"q":["Invalid search query: unexpected character : at position 34."]}` | `q: Invalid search query: unexpected character : at position 34.` |
| `{"q":["First problem.","Second problem."]}` | `q: First problem. Second problem.` |
| `{"q":["Bad query."],"limit":["Too large."]}` | `q: Bad query.; limit: Too large.` |
| `{"detail":"Not found."}` | `detail: Not found.` |
| `{"count":0,"next":null,"results":[]}` | absent; mapped code kept |
| `["boom"]`, `{}`, `{"q":[]}`, `<html>…` | absent; mapped code kept |

A `string` value is read as one message and a `string[]` as many; **any** other value type drops
`details` for the whole body rather than reporting a half-understood error. The reader never throws —
one that did would convert a clean `bad_request` into the `unexpected` backstop, which reads as a
server fault and discourages the retry that fixes it
([D-10](../MCP-PRD.md#d-10--tool-handlers-never-throw)).

The first row is the verbatim fixture `tests/fixtures/spellbook/variants-invalid-query-400.json`,
and it is [CAP-02](../MCP-PRD.md#cap-02--combo-discovery) criterion 3's client half.

**No 404 policy went into the transport.** Commander Spellbook answers a valid query with no matches
as HTTP **200** carrying `{"count":0,…,"results":[]}` — a test drives the verbatim
`variants-empty.json` through the client and asserts a *successful* result — so
[CAP-01](../MCP-PRD.md#cap-01--card-search)'s deliberate 404-as-empty mapping stays in `cardSearch`
where it belongs, alongside the 422 re-code.

## 5. The POST verb, and the two lanes on one clock

POST sends `method: "POST"`, `Content-Type: application/json` **in addition to** the `User-Agent` and
`Accept` every request carries, and `JSON.stringify(body)`. It rides the same `run()` as GET: a test
issues a GET and a POST concurrently on the card lane and observes them 500 ms apart, and another
drives a POST through the 429 backoff. A body that cannot be serialized — a circular object — returns
`unexpected` from the [D-10](../MCP-PRD.md#d-10--tool-handlers-never-throw) backstop and **never
reaches the network** (`calls.length === 0`), because serialization happens inside the guard.

GET still passes `{ headers }` with no `method` key, exactly as it ships today.

[CAP-02](../MCP-PRD.md#cap-02--combo-discovery) **criterion 12** is discharged with the shipped
factories, not with hand-built specs. Both clients are built from one `Config` and driven off one
virtual clock:

| requests issued together | result |
|---|---|
| Spellbook, Scryfall card, Spellbook | `sleeps` is exactly `[500]`; the Scryfall call fires at `t=0`; the two Spellbook calls are 500 ms apart |
| the two Spellbook calls alone (control) | identical timings |
| Spellbook then Scryfall, sequentially | no sleep at all |

Lane state lives in each factory's closure, so the interleaved Scryfall request neither delays nor is
delayed by Commander Spellbook. **Criterion 11** is asserted by exact header equality on GET and POST
for both sources, not by an `includes` check.

## 6. One edit the spec did not list

`ScryfallClient` became an alias of `HttpClient` ([requirement 11](./TrackA-Slice15.md#requirements)),
so it gained a **required** `post`. Three object-literal fakes typed `ScryfallClient` —
`makeFakeClient` and `makeScriptedClient` in `tests/tools/card-search.test.ts`, `makeFakeClient` in
`tests/tools/register.test.ts` — then failed `tsc --noEmit`. The spec's deliverables table does not
list those files.

**`npm test` would have stayed green**: `--experimental-strip-types` does not typecheck, so only
`npm run typecheck` and CI would have caught it. Each fake gained a `post` that **rejects**, so an
accidental POST from `cardSearch` fails a test loudly instead of returning something plausible.

## 7. The acceptance run took three attempts, and the first two failures were not this change

Runs 1 and 2 failed **check 1** with `{"code":"network","message":"Could not reach Scryfall: fetch
failed"}` — a fetch rejection on the first call of a freshly spawned server, ~10.7 seconds before
giving up, with checks 2–13 passing in the same process. Run 3 was **13/13**.

Investigated rather than re-run until green:

- A plain `fetch` to check 1's exact URL with the same headers, from a cold Node process, returned
  HTTP 200 in 1,333 ms.
- The **same query through the spawned new bundle** reproduced the failure once (10.7 s), then
  succeeded twice in the same process.
- The **pre-change bundle** (`git show HEAD:dist/index.js`) succeeded on its first call — but so did
  the new bundle on the next two attempts, alternating new/old/new. **The failure is intermittent and
  the comparison does not implicate the refactor.**

The transport's GET path is byte-identical to what shipped: same URL assembly, same two headers, no
`method`, no timeout and no `AbortController` added. ~10.7 s is undici's default connect timeout, so
the most likely cause is a connection attempt failing on this machine and not a code path. Recorded
here because a one-off live failure that is silently re-run out of existence is exactly what these
results documents are for. **No 429 was provoked in any run**; calls stay ≥ 600 ms apart.

## 8. What did not change

- [`src/index.ts`](../../src/index.ts) and [`src/tools/register.ts`](../../src/tools/register.ts) —
  `git diff --stat` prints nothing for both. `tools/list` against the rebuilt bundle reports exactly
  **one** tool, `card_search`.
- [`src/result.ts`](../../src/result.ts) — untouched. The six `FailureCode` members cover both hosts;
  none was added.
- No npm dependency, dev or runtime. `package.json` and `package-lock.json` show no diff, and the SDK
  stays a devDependency.
- No file under `skills/`, `.claude-plugin/`, `mcpb/` or `.github/`.
- No retry-policy change: one retry after one fixed 30-second backoff, no jitter, no `Retry-After`
  read. Every 429 path is tested against the virtual clock and mocked responses; **no 429 was
  deliberately provoked** ([§3.4](../MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance)).
- `spellbookBaseUrl` is read by nothing in production and `createSpellbookClient` is called by no
  production code — both ship exercised by tests only, until
  [Slice 16](./TrackA-Slice16.md). That is the shape `cacheDir` has had since
  [Slice 1](./TrackA-Slice1.md).

## 9. Acceptance criteria

| # | Criterion | Evidence |
|---|---|---|
| 1 | one changed line in `tests/scryfall/client.test.ts` | met as one insertion, zero deletions — [§1](#1-the-behaviour-preservation-gate) |
| 2 | the eight message templates at `sourceName: "Scryfall"` | ✅ 8 tests, exact string equality |
| 3 | POST method, content type and body | ✅ asserted off the captured `RequestInit` |
| 4 | `User-Agent` and `Accept` on every request, both sources, both verbs | ✅ exact header equality, 4 tests |
| 5 | two hosts, one clock, no interference | ✅ 3 tests incl. a control — [§5](#5-the-post-verb-and-the-two-lanes-on-one-clock) |
| 6 | the verbatim 400 body returns `bad_request` with `details` intact | ✅ against the committed fixture |
| 7 | a non-map and a non-JSON body drop `details`, neither throws | ✅ 4 tests |
| 8 | lane selection per prefix; a single-lane spec | ✅ 5 tests incl. declaration order |
| 9 | the 429 suite on the generic client | ✅ 6 tests, `sleeps` `[30000, 500]`, the lockout |
| 10 | `spellbookBaseUrl` on every platform branch; no `process.env` below `index.ts` | ✅ 2 tests; the only match in `src/` is a comment in [`config.ts`](../../src/config.ts) |
| 11 | wiring untouched; `tools/list` reports one tool | ✅ empty diff; live `tools/list` → `card_search` |
| 12 | `npm test` passes, counts recorded | ✅ 39 suites / 150 tests, from 27 / 101 |
| 13 | `npm run typecheck` clean | ✅ |
| 14 | `npm run acceptance` 13/13 live, no 429 | ✅ on the third run — [§7](#7-the-acceptance-run-took-three-attempts-and-the-first-two-failures-were-not-this-change) |
| 15 | `npm run build` leaves `git status --porcelain -- dist/` empty | ✅ rebuilt in the same commit |
| 16 | `npm run lint:docs` passes; this document exists | ✅ |
