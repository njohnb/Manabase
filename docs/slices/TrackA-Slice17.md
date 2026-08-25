# Track A — Slice 17: `combo_find_deck` — closing [CAP-02](../MCP-PRD.md#cap-02--combo-discovery)

> Self-contained implementation spec. You do not need to read the PRDs to build this slice;
> everything binding is inlined. PRD references are pointers for deeper context only.

**Goal.** Answer the question the capability exists for: *what combos are already in the deck I
built, and which am I one card away from?* This is the half with all the traps. The upstream
endpoint returns **164 variants across six buckets for one 94-card deck**, of which **8** are
combos the deck actually contains — **5.4%** of a **640,684-character** response. It **silently
ignores** a card name it does not recognize, returns HTTP 200, and no endpoint it serves will
tell you. And its own `limit` parameter **drops the combos you have in favour of ones you do
not**.

**This slice closes [CAP-02](../MCP-PRD.md#cap-02--combo-discovery)** — a dated delivery note, the
[§6](../MCP-PRD.md#6-phases) update, one [§9](../MCP-PRD.md#9-revision-log) row, a dated paragraph
on two open questions, and then `doc-sync`.

## Preconditions (deliverables of [Slice 16](./TrackA-Slice16.md))

- `src/spellbook/types.ts` — wire shapes omitting `prices` and every `imageUri*` field.
- `src/spellbook/combos.ts` — `ComboSummary`, `ComboBucket`, `toComboSummary(variant, formatKey,
  bucket?)`, `resolveFormat`, `SPELLBOOK_LEGALITY_KEYS`. **This slice consumes that shape
  unchanged** and is the reason it carries an optional `bucket`.
- `src/tools/combo-search.ts` and a `Clients` bundle in
  [`src/tools/register.ts`](../../src/tools/register.ts) carrying both `scryfall` and `spellbook`.
- `src/http/client.ts` with `post` on `HttpClient` — from [Slice 15](./TrackA-Slice15.md), and
  still uncalled by production code until this slice.
- [CAP-02](../MCP-PRD.md#cap-02--combo-discovery) criteria 2, 3, 6, 7, 8, 11, 12 and 14's
  `combo_search` half verified.
- Fixtures: `tests/fixtures/spellbook/find-my-combos-deck.json` (**derived** — 164 variants reduced
  to 14, `count` adjusted to match), `find-my-combos-limit5.json` (**verbatim** — 4 `included` and
  1 `almostIncluded`), `find-my-combos-bogus-name.json` (verbatim), and
  `tests/fixtures/collection-not-found.json` (verbatim Scryfall `POST /cards/collection`).

## Context

Track A: 1 (skeleton) · 2 (client) · 3 (handler) · 4 (prices) · 5 (wiring) · 6 (live pass) · 14
(trim and cap) · 15 (transport) · 16 (`combo_search`) · **17 (this slice)**.

Four measured behaviours decide this tool's shape. Three are silent failures and the fourth is the
guard against one of them:

- **`limit` does not prioritize the combos the deck contains.** At `limit=5` the response holds
  **4 `included` and 1 `almostIncluded`**, while the full result's first eight flattened entries
  are **all `included`** and at `limit=20` all eight appear. The same request twice was
  byte-identical, so this is deterministic, not flaky. A capped upstream request therefore returns
  a plausible answer missing the user's actual combos, and reports nothing about it
  ([§4.4](../MCP-PRD.md#44-commander-spellbook)).
- **An unrecognized card name is silently ignored.** HTTP 200, no warning, no unresolved list, no
  echo of the input. A three-card deck carrying one invented name returned the two-card combo
  among the real cards as though nothing were missing. `/card-list-from-text` is a **pure text
  parser** and hands the invented string straight back, so there is **no server-side remedy** —
  the guard has to come from Scryfall.
- **A `GET` with no deck returns HTTP 200 carrying the entire combo corpus** as near-misses, with
  `identity: "C"` and `included: []`. It does not present as an error. It is the form a session
  reaching for `curl` tries first.
- **Scryfall's `POST /cards/collection` reports misses in `not_found`,** as the identifier objects
  submitted — `[{"name":"Zzzz Not A Real Card 9999"}]` — not as bare strings. Verified 2026-08-24.
  75 identifiers per request, so a 100-card deck costs **2** requests.

## Deliverables

| File | Action |
|---|---|
| `src/scryfall/collection.ts` | new — `resolveNames(client, names)`, batching at 75 |
| `src/scryfall/types.ts` | modify — the `POST /cards/collection` response shape |
| `src/tools/combo-find-deck.ts` | new — `comboFindDeck(clients, params)` |
| [`src/tools/register.ts`](../../src/tools/register.ts) | modify — the `combo_find_deck` definition, schema and dispatch |
| `dist/index.js` | rebuild and commit — [P-09](../PLUGIN-PRD.md#p-09--server-ships-as-committed-built-javascript), enforced by CI |
| `tests/scryfall/collection.test.ts` | new — batching, `not_found`, failure propagation |
| `tests/tools/combo-find-deck.test.ts` | new — classification, the cap, the near-miss opt-in, refusals |
| `tests/tools/register.test.ts` | modify — the third tool, `EXPECTED_DESCRIPTION` |
| [`docs/MCP-PRD.md`](../MCP-PRD.md) | modify — [CAP-02](../MCP-PRD.md#cap-02--combo-discovery) delivery note, [§6](../MCP-PRD.md#6-phases), a dated [§7](../MCP-PRD.md#7-open-questions) paragraph on [OQ-05](../MCP-PRD.md#oq-05--do-commander-spellbook-or-archidekt-impose-rate-limits) and [OQ-06](../MCP-PRD.md#oq-06--is-commander-spellbooks-combo-data-licensed-as-distinct-from-its-code), one [§9](../MCP-PRD.md#9-revision-log) row |
| [`docs/DEV-ROADMAP.md`](../DEV-ROADMAP.md) | modify — [§7](../DEV-ROADMAP.md#7-phase-2-slices--combo-discovery) status, [§2](../DEV-ROADMAP.md#2-current-state-verified-2026-08-04) current state |
| `docs/slices/TrackA-Slice17-results.md` | new |

No file under `skills/`, `.claude-plugin/`, `mcpb/`, or `.github/` changes, and **no tag and no
`.mcpb` release**. Shipping this to the Chat tab is a separate, deliberate act — `claude plugin
tag` writes into the same `v*` namespace `release.yml` watches, and a released bundle cannot be
withdrawn.

## Requirements

1. **Resolve every submitted name through Scryfall before the combo call, and report what did not
   resolve.** `POST /cards/collection` with `{ identifiers: [{ name }, …] }`, **75 per request**,
   never a loop over `/cards/named` ([§4.1.2](../MCP-PRD.md#412-batch-resolution)). Read the
   response's `not_found` array — the identifier objects submitted, so `.name` is the field to
   read — into `unresolved_cards`.

   This is the **only** reason this capability touches Scryfall, and it exists solely because
   Commander Spellbook will never tell you a name matched nothing. Without it a decklist with one
   typo returns fewer combos than the deck really holds, with no signal anywhere
   ([CAP-02](../MCP-PRD.md#cap-02--combo-discovery) criterion 5).

2. **`unresolved_cards` is always present, even when empty.** An absent key lets "we checked and
   found no typos" and "we did not check" read identically, which
   [§3.6](../MCP-PRD.md#36-error-surface) forbids. It is a required field, not an optional one, so
   no conditional spread applies.

3. **Send the resolved names upstream, and send the unresolved ones too.** Dropping a name we could
   not resolve would change the deck the user asked about, silently, on our own initiative. Pass
   the list through as submitted, report the misses, and let the user decide. The failure mode this
   avoids is subtle: a name Scryfall rejects that Commander Spellbook would have matched — its card
   names are matched against Scryfall's canonical names, but that is recorded as **inferred, not
   verified** ([§4.4](../MCP-PRD.md#44-commander-spellbook)), so silently dropping on Scryfall's say
   so would be acting on an unverified premise.

4. **A name-resolution failure is not a combo-search failure.** If the Scryfall batch call itself
   fails — network, 5xx, rate limit — return that `Failure` rather than proceeding blind. But a
   *successful* resolution that finds misses proceeds normally with the misses reported. The two
   are different outcomes and must not collapse.

5. **Never send `limit` or `offset` upstream on `/find-my-combos`.** Fetch the **full** result,
   classify into the six buckets, and cap **after**. This is the requirement most likely to be
   "optimized" away by someone reading the payload sizes, so the reason is worth holding: at
   `limit=5` the endpoint returns 4 matched and 1 near, while the true first eight are all
   matched. A capped upstream request is not a smaller correct answer — it is a **wrong** answer
   that looks right.

   **The wire budget and the model budget are different budgets.** 640,684 characters crossed the
   network in 1.66 seconds on the measured deck. The ceiling this capability is designed around
   constrains what reaches the model, not what crosses the wire, and conflating the two is exactly
   what would push the cap upstream.

6. **Classify from the six buckets by name, and pass the bucket name through verbatim.**

   ```
   matched:  included, includedByChangingCommanders
   near:     almostIncluded, almostIncludedByAddingColors,
             almostIncludedByChangingCommanders,
             almostIncludedByAddingColorsAndChangingCommanders
   ```

   Emit the upstream camelCase string unchanged as `ComboSummary.bucket`.
   `includedByChangingCommanders` and `almostIncludedByChangingCommanders` differ by one word and
   mean opposite things; a translation layer here would surface a correctly-shaped,
   **wrongly-labelled** result — the same failure mode
   [§4.4](../MCP-PRD.md#44-commander-spellbook) rejects local deck matching for.

   Handle all six explicitly, including the two that were empty in every capture. An unknown
   seventh bucket appearing upstream must be ignored rather than crash or be guessed into a
   category.

7. **`include` defaults to `"matched"` and near-misses are absent unless asked for.**
   `include: "matched" | "matched+near"`. Matched combos are **5.4%** of the payload and
   near-misses **94.6%** ([§4.4.1](../MCP-PRD.md#441-the-combo-payload-is-enormous--measured)), so
   the default answers the question asked and the opt-in buys the "add one card" answer
   deliberately. The parameter is **additive and defaults to cheap** — forgetting it returns a
   smaller true answer rather than failing a call invisibly, which is the direction
   [OQ-13](../MCP-PRD.md#oq-13--should-a-card-search-result-carry-image-uris-and-at-what-cost)
   established is safe and the direction
   [OQ-02](../MCP-PRD.md#oq-02--how-verbose-should-a-search-result-be) rejected a subtractive
   parameter for.

   Report the value actually applied as a required `include` field, for the same reason
   requirement 2 exists.

8. **Flatten matched buckets first, always, in bucket order.** `included`, then
   `includedByChangingCommanders`, then — only under `"matched+near"` — the four near buckets in
   the order listed in requirement 6. This makes it **structurally impossible** for the 40-cap to
   drop a matched combo on page 1, which is belt and braces on criterion 10 and costs nothing.

9. **The cap is 40, applied after classification, and `has_more` is ours.**
   `total_combos` is the count after classification and filtering — not upstream's `count`, which
   counts everything in all six buckets regardless of `include`. Then:

   ```
   page      = 1-based, default 1
   slice     = flattened.slice((page - 1) * 40, (page - 1) * 40 + 40)
   has_more  = total_combos > page * 40
   ```

   One upstream combo request per tool call, always — paging here re-fetches and re-classifies
   rather than holding state, because this server keeps no per-user state
   ([D-03](../MCP-PRD.md#d-03--testability-handlers-callable-as-plain-functions)). Say so in the
   tool description so nobody expects a cursor.

10. **An empty or missing decklist is a structured failure and issues no upstream combo request.**
    Empty `cards` array, absent `cards`, an array of only empty strings — all `bad_request`, and
    **no call to either source**, not even name resolution. The behaviour this prevents is a
    well-formed meaningless answer: a `GET` with no deck returns HTTP 200 carrying the entire combo
    corpus as things this deck could almost reach
    ([CAP-02](../MCP-PRD.md#cap-02--combo-discovery) criterion 13).

11. **`cards` is `string[]` — names only, no quantities and no objects.** Measured across the 260
    captured variants: **762** `uses`/`requires` entries and **zero** with `quantity !== 1`, so
    quantity carries no combo information. A pasted `"1 Sol Ring"` will not resolve and surfaces in
    `unresolved_cards`, which is loud and correct — **say that in the tool description** so the
    model strips leading counts rather than discovering it by failure. Do **not** add
    quantity-stripping to the handler: that is parsing the user's input on their behalf, and the
    reporting path already handles it honestly.

12. **`commanders` is separate, optional, and defaults to empty.** The upstream body is
    `{ main: [{ card }], commanders: [{ card }] }`, capped at **600 main and 12 commanders**.
    Refuse over-cap input as a `bad_request` before the call rather than letting upstream decide;
    a 600-card list is a mistake, not a deck.

13. **Report the deck's colour identity from `results.identity`, and read it from the right
    place.** `identity` sits **inside `results`**, alongside the six buckets — not at the envelope
    top level. Verified against the capture: the response's top-level keys are
    `count`, `next`, `previous`, `results`, and `response.identity` is `undefined`. This is easy to
    get backwards from prose and produces `undefined` rather than an error.

14. **Format handling is [Slice 16](./TrackA-Slice16.md)'s, reused unchanged.** `resolveFormat`,
    the 16 keys, the `edh` alias, the refusal on anything else, the single top-level `format` and
    the per-combo `legal` boolean. Do not add a second implementation and do not soften the refusal
    for this tool.

15. **No price and no `imageUri*` field**, guaranteed by the same wire types
    ([D-06](../MCP-PRD.md#d-06--pricing-from-scryfall)). The Scryfall cards fetched for name
    resolution are used **only** to read `not_found` and nothing else — do not surface them, do not
    price them, do not attach oracle text. `resolvePrice` is not in scope.

16. **Close [CAP-02](../MCP-PRD.md#cap-02--combo-discovery) in the same session — this is a
    deliverable, not follow-up.** Append a dated delivery note to the capability block naming which
    criteria are verified and by what evidence, update [§6](../MCP-PRD.md#6-phases)'s Phase 2 entry
    from "specified, not built", and append **one** [§9](../MCP-PRD.md#9-revision-log) row. Do
    **not** mint a `D-` decision; [§2](../MCP-PRD.md#2-locked-decisions) is locked.

17. **Give [OQ-05](../MCP-PRD.md#oq-05--do-commander-spellbook-or-archidekt-impose-rate-limits) and
    [OQ-06](../MCP-PRD.md#oq-06--is-commander-spellbooks-combo-data-licensed-as-distinct-from-its-code)
    a dated paragraph each, saying the capability shipped with them open.** Both stay open by
    explicit decision — they resolve only when a third party replies, and one message to the
    Commander Spellbook admins via their Discord covers both. State plainly that the 2/second lane
    is a **conservative guess and not a measured fit**, and that the combo data carries no stated
    licence while the backend is MIT. [§7](../MCP-PRD.md#7-open-questions) questions are never
    deleted; they gain a dated paragraph.

    [OQ-14](../MCP-PRD.md#oq-14--how-should-commander-spellbook-query-syntax-be-surfaced-to-the-model)
    stays open and **does not block**: its resolution method is an eval run that needs the tool to
    exist first, so it is post-`CAP-02` work, not a build task. Note that in its entry, and note
    that it has a plugin-side half [`docs/PLUGIN-PRD.md`](../PLUGIN-PRD.md) owns.

18. **Rebuild and commit `dist/index.js` in the same commit as the `src/` change**
    ([P-09](../PLUGIN-PRD.md#p-09--server-ships-as-committed-built-javascript)), and **dispatch
    `doc-sync` as the final step** before reporting the slice complete. Dispatch it even if you
    believe nothing changed, and **review its diff before committing** — it appends and updates
    status, it decides nothing, and a plausible paraphrase landing unread in a binding document is
    the failure it exists to prevent.

## Interface contracts

```ts
// src/scryfall/collection.ts

export interface NameResolution {
  resolved: string[];      // canonical Scryfall names, in response order
  unresolved: string[];    // the submitted names Scryfall matched nothing for
}

/** Batches at 75 identifiers per POST /cards/collection. Never throws. */
export async function resolveNames(
  client: HttpClient,
  names: string[],
): Promise<Result<NameResolution>>;
```

```ts
// src/scryfall/types.ts — added
export interface ScryfallCollection {
  object: "list";
  not_found: Array<{ name?: string }>;   // the identifier objects submitted
  data: ScryfallCard[];
}
```

```ts
// src/tools/combo-find-deck.ts

export type ComboInclude = "matched" | "matched+near";

export interface ComboFindDeckParams {
  cards: string[];                 // main-deck names; required, non-empty
  commanders?: string[];           // default []
  include?: ComboInclude;          // default "matched"
  page?: number;                    // 1-based; default 1
  format?: string;                  // default "commander"
}

export interface ComboFindDeckData {
  combos: ComboSummary[];          // <= 40, each carrying `bucket`
  total_combos: number;            // after classification and filtering, not upstream's count
  page: number;
  has_more: boolean;
  include: ComboInclude;           // the value applied
  format: string;
  color_identity: string;          // results.identity — inside results, requirement 13
  unresolved_cards: string[];      // always present; [] when none
  note?: string;
}

export async function comboFindDeck(
  clients: Clients,
  params: ComboFindDeckParams,
): Promise<Result<ComboFindDeckData>>;
```

This is the one handler that takes the **bundle** rather than a single client, because it is the
one that legitimately needs two sources. Upstream calls per tool call:

```
POST /cards/collection      x ceil(names / 75)      (Scryfall card lane, 500 ms)
POST /find-my-combos        x 1, no limit, no offset (Commander Spellbook lane, 500 ms)
```

The tool's input schema, hand-written JSON Schema `as const`:

```
cards:      { type: "array", items: { type: "string" }, minItems: 1 }   // required
commanders: { type: "array", items: { type: "string" } }
include:    { type: "string", enum: ["matched", "matched+near"] }        // default "matched"
page:       { type: "integer", minimum: 1 }                             // default 1
format:     { type: "string" }                                          // default "commander"
```

`minItems: 1` is **not** relied on — requirement 10's check lives in the handler, exactly as
`card-search.ts`'s `normalizePage` defends itself against a schema `minimum` the SDK does not
enforce.

## Out of scope — do NOT

- **No deck URL, no `/card-list-from-url`, no `/card-list-from-text`.** Resolving an Archidekt or
  Moxfield URL through a third party would route the user's deck through a party that is not the
  deck's host and would serve deck resolution twice — once here and once in the capability
  [D-13](../MCP-PRD.md#d-13--deck-platform-order-archidekt-first-moxfield-second) already orders.
  This tool composes with [OQ-12](../MCP-PRD.md#oq-12--what-is-the-normalized-deck-shape-and-does-one-tool-serve-both-platforms-or-two)'s
  `deck_read` when it lands, and works today against a pasted list.
- **No `deck_read`, no Archidekt, no Moxfield.** This slice has no dependency on deck reading and
  must not acquire one.
- **No upstream `limit` or `offset` on `/find-my-combos`** — requirement 5. Not as an optimization,
  not behind a flag, not "just for the near buckets."
- **No `/estimate-bracket`.** It is recorded as available and is a different capability.
- **No price field and no image field** — requirement 15.
- **No quantity parsing, no decklist-text parsing, no fuzzy name matching.** Names in, names out,
  misses reported.
- **No caching of resolved names**, no persistence, no `cacheDir` use. Two Scryfall requests for a
  100-card deck is the measured cost and it is acceptable.
- **No auto-paging and no cursor.** Paging re-fetches; the server holds no per-user state.
- **No new npm dependency**, dev or runtime, and the SDK stays a devDependency.
- **No skill edit.** [Slice 9](./TrackB-Slice9.md) measured 10/10 trigger accuracy on the current
  [PC-01](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) frontmatter and editing it invalidates that
  rate. Whether a second query language earns a reference file belongs to
  [`docs/PLUGIN-PRD.md`](../PLUGIN-PRD.md).
- **No tag, no `.mcpb` release, no `plugin.json` version.** [P-08](../PLUGIN-PRD.md#p-08--version-scheme)
  is [Slice 13](./TrackC-Slice13.md)'s and still gated on [Slice 12](./TrackC-Slice12.md)'s friend
  dry-run.
- **No edits to [§2](../MCP-PRD.md#2-locked-decisions) or
  [§3](../MCP-PRD.md#3-constraints) of either PRD**, and no rewriting of
  [§4](../MCP-PRD.md#4-external-dependencies) — measurements are appended as dated addenda.

## Acceptance criteria

1. **[[CAP-02](../MCP-PRD.md#cap-02--combo-discovery) criterion 1, remainder]** `comboFindDeck` and
   `resolveNames` are invoked directly in tests with no MCP server started and no transport
   constructed.
2. **[[CAP-02](../MCP-PRD.md#cap-02--combo-discovery) criterion 4]** A decklist containing Demonic
   Consultation and Thassa's Oracle returns that combo, labelled `bucket: "included"` — driven from
   `find-my-combos-deck.json`.
3. **[[CAP-02](../MCP-PRD.md#cap-02--combo-discovery) criterion 5]** A deliberately invented name in
   an otherwise valid decklist appears in `unresolved_cards`, the real cards still resolve, and the
   call still returns combos. Driven from `tests/fixtures/collection-not-found.json`, whose
   `not_found` is `[{"name":"Zzzz Not A Real Card 9999"}]`.
4. **[requirement 2]** `unresolved_cards` is present and `[]` on a decklist with no typos.
5. **[[CAP-02](../MCP-PRD.md#cap-02--combo-discovery) criterion 10]** **The cap is never sent
   upstream as `limit`.** Asserted two ways: the outgoing `POST /find-my-combos` carries no `limit`
   and no `offset` in its query, and — against `find-my-combos-limit5.json`, whose first five
   upstream entries are four matched and one near — **all matched combos are returned**. Kept
   separate from criterion 8 because the two fail differently: a broken cap returns too much, a cap
   pushed upstream returns a plausible answer missing the combos the user actually has.
6. **[[CAP-02](../MCP-PRD.md#cap-02--combo-discovery) criterion 9]** `include` defaults to
   `"matched"` and **no near-miss combo appears** in a response that did not ask for one.
   `"matched+near"` returns near-misses, each labelled with the bucket it came from. Assert against
   all four near buckets, not just `almostIncluded`.
7. **[[CAP-02](../MCP-PRD.md#cap-02--combo-discovery) criterion 8, `combo_find_deck` half]** A
   response fills a page to the **byte budget** rather than to a combo count, states
   `total_combos` and `has_more`, and reports **`next_offset`** so following it reaches every
   combo exactly once — with `total_combos` counting after classification and filtering, not
   upstream's `count`.

   **This changed twice on 2026-08-25 and the final shape is the one to build.** The cap was
   specified as 40 combos, amended to 20 on measurement, then replaced entirely by a 50,000
   character budget with offset paging, because per-combo cost spans 547–4,421 characters and no
   single count serves both ends ([CAP-02](../MCP-PRD.md#cap-02--combo-discovery),
   [§4.4.1](../MCP-PRD.md#441-the-combo-payload-is-enormous--measured)'s three addenda).
   `combo_search` ships this shape today: `offset` in, `next_offset` out, absent on the last page,
   and **one combo larger than the whole budget is still returned** so the offset always advances.
   Match it — a second paging idiom across two tools of one capability is exactly the drift
   [OQ-12](../MCP-PRD.md#oq-12--what-is-the-normalized-deck-shape-and-does-one-tool-serve-both-platforms-or-two)
   set the normalized-shape rule to prevent.

   **The budget is applied after classification here, not sent upstream** — that distinction is
   untouched by the change and is still the point of the two paging bullets.
8. **[[CAP-02](../MCP-PRD.md#cap-02--combo-discovery) criterion 13]** An empty `cards`, an absent
   `cards`, and an array of only empty strings each return a `bad_request` and make **zero**
   upstream calls to either source — asserted by counting calls on both fakes.
9. **[[CAP-02](../MCP-PRD.md#cap-02--combo-discovery) criterion 14, remainder]** Legality is
   returned for the format named by `format`, that format is stated once, and no other format's
   legality appears in the serialized response. An unknown format is refused before any call.
10. **[requirement 1]** A 100-name decklist issues exactly **2** `POST /cards/collection` requests;
    a 75-name list issues **1**; a 76-name list issues **2**. Asserted by counting calls.
11. **[requirement 4]** A failing Scryfall batch call returns that `Failure` and makes **no**
    Commander Spellbook call. A successful call that reports misses proceeds.
12. **[requirement 8]** With a fixture whose matched and near combos together exceed 40 under
    `"matched+near"`, page 1 contains **every** matched combo.
13. **[requirement 13]** `color_identity` reads `results.identity` and is `"UBR"` on the deck
    fixture — not `undefined`, which is what reading the envelope top level produces.
14. **[requirement 6]** All six bucket names round-trip verbatim, and an unknown seventh bucket in
    a synthesized payload is ignored without throwing.
15. **[requirement 12]** 601 main cards or 13 commanders returns a `bad_request` before any call.
16. **[[CAP-02](../MCP-PRD.md#cap-02--combo-discovery) criteria 6 and 7, re-asserted]** No price
    field and no `imageUri*` field in a serialized `combo_find_deck` response.
17. `tools/list` reports **three** tools, `dispatchToolCall` routes each to the right client, and
    an unknown tool name still throws.
18. `npm test` passes and the suite/test totals are recorded against the current 27 / 101.
19. `npm run typecheck` is clean under `exactOptionalPropertyTypes`,
    `noUncheckedIndexedAccess` and `verbatimModuleSyntax`.
20. `npm run acceptance` is still **13/13** live against real Scryfall.
21. `npm run build` leaves `git status --porcelain -- dist/` empty, in the same commit as the
    `src/` change.
22. **One live confirmation, and only one.** Run a real decklist — the 94-card deck of
    [§4.4.1](../MCP-PRD.md#441-the-combo-payload-is-enormous--measured), including one deliberately
    invented name — through the built server against both live APIs. Record the **shaped** response
    character count beside the **640,684** raw figure, and confirm the invented name appears in
    `unresolved_cards`. Calls stay ≥ 600 ms apart and **never provoke a 429**.
23. `npm run lint:docs` passes and [`docs/MCP-PRD.md`](../MCP-PRD.md) shows: a dated
    [CAP-02](../MCP-PRD.md#cap-02--combo-discovery) delivery note naming criteria 1–14 with their
    evidence, the [§6](../MCP-PRD.md#6-phases) Phase 2 update, dated paragraphs on
    [OQ-05](../MCP-PRD.md#oq-05--do-commander-spellbook-or-archidekt-impose-rate-limits),
    [OQ-06](../MCP-PRD.md#oq-06--is-commander-spellbooks-combo-data-licensed-as-distinct-from-its-code)
    and [OQ-14](../MCP-PRD.md#oq-14--how-should-commander-spellbook-query-syntax-be-surfaced-to-the-model),
    and exactly one new [§9](../MCP-PRD.md#9-revision-log) row. No new `D-` decision;
    [§2](../MCP-PRD.md#2-locked-decisions) and [§3](../MCP-PRD.md#3-constraints) untouched.
24. **[requirement 18]** `doc-sync` was dispatched and its diff reviewed before committing.
25. `docs/slices/TrackA-Slice17-results.md` records: the date, the live run from criterion 22 with
    both character counts, the suite/test counts, a per-criterion table for all fourteen
    [CAP-02](../MCP-PRD.md#cap-02--combo-discovery) criteria, and a "what this slice deliberately
    did not do" section.

## Testing requirements

Handlers are called as plain functions against fakes
([D-03](../MCP-PRD.md#d-03--testability-handlers-callable-as-plain-functions)). This slice needs a
**two-client fake bundle**, since `comboFindDeck` takes `Clients`: give the Scryfall and Commander
Spellbook fakes independent scripts and independent call logs, because half the criteria here are
assertions about **which** source was called and **how many times**.

Keep `makeScriptedClient`'s rule that an **unscripted call rejects**. Criteria 8 and 11 are
"no call was made" assertions, and a lenient fake turns them vacuous.

Fixtures load with `readFileSync` via `new URL("../fixtures/…", import.meta.url)`, never a JSON
import. **`find-my-combos-deck.json` is derived** — 164 variants reduced to 14 (all 8 `included`,
4 `almostIncluded`, 1 `almostIncludedByAddingColors`, 1 `almostIncludedByChangingCommanders`) with
`count` adjusted from 164 to 14. `find-my-combos-limit5.json` is **verbatim** and is criterion 5's
fixture precisely as the criterion describes it. `tests/fixtures/spellbook/README.md` records both.
Cite [§4.4.1](../MCP-PRD.md#441-the-combo-payload-is-enormous--measured)'s measurements from the
PRD; never recompute them from a truncated fixture.

Tests needing more combos in a bucket than a fixture holds synthesize them in-test by repeating a fixture
variant with distinct ids, rather than committing a larger fixture. Say so in a comment — a
synthesized payload is derived data too.

Suites to add:

- **`tests/scryfall/collection.test.ts`** — batch boundaries at 74/75/76/100/150 names; `not_found`
  read into `unresolved`; an empty `not_found`; a failing batch propagating; a batch whose
  `not_found` entry lacks `name`.
- **Classification** — all six buckets; the matched/near split; the unknown-bucket case; verbatim
  bucket names.
- **The `include` opt-in** — the default, the explicit `"matched"`, `"matched+near"`, and a
  wrong-typed value falling back to the default.
- **The cap and paging** — the after-classification cap; matched-first ordering under the cap;
  `total_combos` versus upstream `count`; page 2; a page past the end.
- **Refusals** — empty and missing decklists, the 600/12 caps, the unknown format — each asserting
  zero upstream calls.
- **Sweeps** — price and `imageUri*` absence on a serialized response, as
  [Slice 16](./TrackA-Slice16.md) does.

`npm run acceptance` stays a deliberate, human-run, local step, and criterion 22's live run is a
separate one-off. Neither is wired into CI under any trigger — [Slice 6](./TrackA-Slice6.md) and
[Slice 11](./TrackC-Slice11.md) both refuse this and
[§3.4](../MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance) is why.

## Verification steps

```bash
# 1) unit level
npm test                       # record suite/test counts for the results doc
npm run typecheck

# 2) the omissions are real, not just untested
grep -ri "imageuri\|tcgplayer\|cardkingdom\|cardmarket" src/     # must print nothing
grep -rn "mcp__plugin\|Manabase:" src/ skills/                   # must print nothing

# 3) build honesty — Slice 11's gate, run before CI runs it for you
npm run build
git status --porcelain -- dist/          # must print nothing

# 4) docs
npm run lint:docs

# 5) live, deliberate, spaced — CAP-01 undisturbed, then the one CAP-02 run
npm run acceptance                       # 13/13; >=600 ms between calls
#    then the 94-card deck with one invented name, through the built server;
#    record the shaped character count beside 640,684

# 6) closeout
#    dispatch the doc-sync subagent, review its diff, THEN commit

# 7) pre-push
claude plugin validate . --strict
```

## References

- [`docs/MCP-PRD.md`](../MCP-PRD.md) [CAP-02](../MCP-PRD.md#cap-02--combo-discovery) — all fourteen
  criteria, the two paging bullets, the near-miss opt-in bullet, and the empty-decklist bullet.
  Read criterion 10's own explanation of why it is separate from criterion 8 before writing the
  cap.
- [`docs/MCP-PRD.md`](../MCP-PRD.md) [§4.4](../MCP-PRD.md#44-commander-spellbook) — the three
  behaviours that decide this tool's shape (the `limit` trap, the silently-ignored name, the
  loud 400), the no-deck `GET` addendum, the six-bucket structure, and the 2026-08-24 probe
  addendum with Scryfall's `not_found` shape.
- [`docs/MCP-PRD.md`](../MCP-PRD.md)
  [§4.4.1](../MCP-PRD.md#441-the-combo-payload-is-enormous--measured) — the 640,684-character deck
  read, the per-bucket table, the 5.4% / 94.6% split, and the trimmed per-combo band.
- [`docs/MCP-PRD.md`](../MCP-PRD.md) [§4.1.2](../MCP-PRD.md#412-batch-resolution) — 75 identifiers
  per request and "never a loop over `/cards/named`".
- [`docs/MCP-PRD.md`](../MCP-PRD.md) [§3.6](../MCP-PRD.md#36-error-surface) (never claim more than
  is known — why requirements 2 and 7 report what was applied),
  [D-10](../MCP-PRD.md#d-10--tool-handlers-never-throw),
  [D-06](../MCP-PRD.md#d-06--pricing-from-scryfall).
- [`docs/slices/TrackA-Slice16.md`](./TrackA-Slice16.md) — the `ComboSummary` shape this slice
  consumes unchanged, the format resolution it reuses, and the wire types that make the price and
  image criteria compile-time facts.
- [`docs/slices/TrackA-Slice15.md`](./TrackA-Slice15.md) — the POST verb and the two lanes.
- [`docs/slices/TrackA-Slice14.md`](./TrackA-Slice14.md) — the after-the-fact `has_more` reasoning,
  which transfers here even though its page arithmetic does not.
- `tests/fixtures/spellbook/README.md` — which fixtures are verbatim, which are derived, and what
  was removed.
- `CLAUDE.md`, "Closing out a slice" — `doc-sync` is the mandatory final step, it decides nothing,
  and its diff is reviewed before committing.
