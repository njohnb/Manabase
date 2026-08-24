# Track A — Slice 16: `combo_search`

> Self-contained implementation spec. You do not need to read the PRDs to build this slice;
> everything binding is inlined. PRD references are pointers for deeper context only.

**Goal.** Ship the first half of [CAP-02](../MCP-PRD.md#cap-02--combo-discovery): a tool that takes
a Commander Spellbook query string, returns the combos matching it, and does not blow the harness
tool-result ceiling doing it. One popular card's combos measure **533,840 characters** in a single
response with `next: null` — `/variants/` applies no default page cap — and Dockside Extortionist
appears in **476** combos, projecting past **2.6 MB**. A passthrough is not on the table at any
size.

**This slice sets the normalized combo shape.** [Slice 17](./TrackA-Slice17.md) consumes it
unchanged; every later consumer — deck analysis, pricing, anything that reads a combo — reads this
shape and never a Commander Spellbook payload. Getting it wrong here is expensive later, which is
why the wire types and the summary type are two separate things and the wire types are deliberately
incomplete.

## Preconditions (deliverables of [Slice 15](./TrackA-Slice15.md))

- `src/http/client.ts` with `createHttpClient(spec, deps)`, the `HttpClient` interface carrying
  **both** `get` and `post`, and the plain-data `SourceSpec` / `LaneSpec`.
- `src/spellbook/client.ts` with `createSpellbookClient(config, deps)` — one lane at 500 ms, the
  field-error-map `detailsFrom`, exercised by tests and **called by no production code**. This
  slice is what calls it.
- [`src/config.ts`](../../src/config.ts) carrying `spellbookBaseUrl`.
- [CAP-02](../MCP-PRD.md#cap-02--combo-discovery) criteria 11 and 12 verified, and criterion 3's
  client half — a 400 returning `bad_request` with Commander Spellbook's message verbatim.
- `tests/fixtures/spellbook/` with `variants-page1.json` (verbatim, 40 variants, `count` 96),
  `variants-page2.json` (**derived** — the real `offset=40` response truncated to 8 variants),
  `variants-single.json`, `variants-empty.json`, and `variants-invalid-query-400.json`.
  `tests/fixtures/spellbook/README.md` records which are verbatim and exactly what was removed from
  the two that are not.

## Context

Track A is the server track: 1 (skeleton) · 2 (client) · 3 (handler) · 4 (prices) · 5 (wiring) · 6
(live pass) · 14 (trim and cap) · 15 (transport) · **16 (this slice)** · 17
(`combo_find_deck`).

Four measured facts shape this tool, and three of them are the opposite of what
[CAP-01](../MCP-PRD.md#cap-01--card-search) taught:

- **A malformed query fails loudly here.** Scryfall silently drops an unrecognized term whenever a
  recognized one remains and answers from fewer constraints
  ([§4.1.1](../MCP-PRD.md#411-search-endpoint)). Commander Spellbook rejects the whole query with
  HTTP 400 naming the offending character's position. That is precisely the self-correction
  contract [D-10](../MCP-PRD.md#d-10--tool-handlers-never-throw) is built on, and it is why
  [OQ-14](../MCP-PRD.md#oq-14--how-should-commander-spellbook-query-syntax-be-surfaced-to-the-model)
  does not block this slice.
- **Zero matches is HTTP 200, not 404** — `{"count":0,"next":null,"previous":null,"results":[]}`,
  verified 2026-08-24. [CAP-01](../MCP-PRD.md#cap-01--card-search) maps Scryfall's 404 to a
  successful empty result; porting that rule here would be wrong on day one.
- **`count` is `null` unless the request sends `count=true`,** and the key is always present, so a
  missing total does not announce itself as missing — it reads as a total of nothing.
- **Ordering *is* stable across calls.** Page 1 and page 2 of one query returned 40 ids each, zero
  overlap, 80 distinct in 80 slots. [CAP-02](../MCP-PRD.md#cap-02--combo-discovery)'s third cap
  bullet gated the upstream-paging path on this check; it passed, so that path ships as specified
  and neither fallback is needed.

## Deliverables

| File | Action |
|---|---|
| `src/spellbook/types.ts` | new — hand-written wire shapes that **omit** `prices` and every `imageUri*` field |
| `src/spellbook/combos.ts` | new — `ComboSummary`, `toComboSummary`, the bucket vocabulary, format resolution |
| `src/tools/combo-search.ts` | new — `comboSearch(client, params)` |
| [`src/tools/register.ts`](../../src/tools/register.ts) | modify — a `Clients` bundle, the `combo_search` definition and schema, dispatch |
| [`src/index.ts`](../../src/index.ts) | modify — builds both clients and passes the bundle |
| `dist/index.js` | rebuild and commit — [P-09](../PLUGIN-PRD.md#p-09--server-ships-as-committed-built-javascript), enforced by CI |
| `tests/spellbook/combos.test.ts` | new — the summary shape, the trim, format resolution |
| `tests/tools/combo-search.test.ts` | new — paging, the cap, passthrough, failures |
| `tests/tools/register.test.ts` | modify — the `Clients` bundle, the second tool, `EXPECTED_DESCRIPTION` |
| [`docs/MCP-PRD.md`](../MCP-PRD.md) | modify — one [§9](../MCP-PRD.md#9-revision-log) row |
| [`docs/DEV-ROADMAP.md`](../DEV-ROADMAP.md) | modify — [§7](../DEV-ROADMAP.md#7-phase-2-slices--combo-discovery) status only |
| `docs/slices/TrackA-Slice16-results.md` | new |

No file under `skills/`, `.claude-plugin/`, `mcpb/`, or `.github/` changes. No
[CAP-02](../MCP-PRD.md#cap-02--combo-discovery) delivery note is written — that is
[Slice 17](./TrackA-Slice17.md)'s, when the capability is complete.

## Requirements

1. **The wire types omit `prices` and every `imageUri*` field, and that omission is the mechanism,
   not a tidiness preference.** `Variant.prices` carries `tcgplayer`, `cardkingdom` and
   `cardmarket`; [D-06](../MCP-PRD.md#d-06--pricing-from-scryfall) makes Scryfall the price source.
   `uses[].card` carries **ten** `imageUri*` fields worth **41.9%** of the upstream payload
   ([§4.4.1](../MCP-PRD.md#441-the-combo-payload-is-enormous--measured)). Declaring neither makes
   [CAP-02](../MCP-PRD.md#cap-02--combo-discovery) criteria 6 and 7 **unviolatable at compile
   time** rather than merely tested — code cannot read a field the type does not declare. That is
   the same discipline that keeps `eur_etched` out of
   [§4.1.3](../MCP-PRD.md#413-price-fields--three-verified-traps)'s model, and it is one of the
   four grounds [D-16](../MCP-PRD.md#d-16--no-npm-commander-spellbook-client-dependency) rejected
   the generated types on **even type-only**.

   **Put that reasoning in the file's header comment**, not only here. A later reader adding a
   field "for completeness" needs to meet the argument in the file they are editing.

2. **`q` passes through byte-identically.** No parse, no validate, no rewrite, no normalization,
   no quote-fixing — Commander Spellbook evaluates the query and this server does not, exactly as
   [CAP-01](../MCP-PRD.md#cap-01--card-search) treats Scryfall
   ([D-07](../MCP-PRD.md#d-07--three-way-cache-split)). A query carrying an operator this server
   has never heard of goes out unchanged and its 400 comes back as a structured failure. Assert
   this with an invented operator, because "we pass it through" is the kind of claim that quietly
   stops being true.

3. **Paging goes upstream, and the arithmetic is a true offset.** Page *n* sends
   `limit=40` and `offset=(n - 1) * 40`.

   **[CAP-01](../MCP-PRD.md#cap-01--card-search)'s 88-card half-page arithmetic does not
   transfer.** That shape exists because Scryfall's `page` is in units of 175 with no offset, so a
   cap below 175 would strand cards behind no `page` value at all. Commander Spellbook exposes a
   real `offset`, so there is no half-page trick, no upstream-page anchoring, and
   `ourPages = ceil(total / 40)` is simply correct here where its analogue was wrong there.
   Reproducing [Slice 14](./TrackA-Slice14.md)'s arithmetic would be a bug.

4. **Always send `count=true`, and treat a `null` count as a failure of ours, not a total of
   zero.** Verified 2026-08-24: without it the response carries `count: null` with the key
   present. Criterion 8 requires the response to state the total, so the parameter is not
   optional. If `count` comes back `null` or non-numeric anyway, fall back to a total derived from
   what was returned and say so in `note` — never report `total_combos: 0` alongside a non-empty
   `combos` array.

5. **Zero matches is a successful empty result, and it arrives as a 200.** `count: 0`,
   `results: []` returns `ok: true` with `combos: []`, `total_combos: 0`, `has_more: false`. **Do
   not add a 404-to-empty mapping.** A 404 from this host means a bad path and must stay a
   failure — the opposite of [CAP-01](../MCP-PRD.md#cap-01--card-search)'s deliberate mapping, and
   the single easiest thing in this slice to get backwards.

6. **Cap defensively at 40 even though the cap is sent upstream.** `limit=40` is the mechanism;
   `results.slice(0, 40)` is the guarantee. An upstream that ignores or changes the meaning of
   `limit` must not turn into a 400,000-character tool result. The slice costs one line and
   removes a whole failure mode.

7. **A `format` this source cannot judge is a structured failure, issued before any upstream
   call.** Commander Spellbook returns **16** legality keys and they are **not** Scryfall's 23:

   ```
   alchemy  brawl  commander  competitiveBrawl  legacy  modern  oathbreaker  pauper
   pauperCommander  pauperCommanderMain  pioneer  predh  premodern  standard
   standardBrawl  vintage
   ```

   Resolution: lowercase the input and match case-insensitively against those 16; map the single
   known alias `edh` → `commander`; **otherwise return `bad_request` naming the valid keys.**

   The trap this closes is specific and near-invisible. `standardBrawl` and Scryfall's
   `standardbrawl` differ only in case, and `historic`, `timeless`, `penny`, `duel`, `future`,
   `gladiator`, `oldschool` and `tlr` are Scryfall keys that **do not exist here at all**. A model
   that learned [CAP-01](../MCP-PRD.md#cap-01--card-search)'s key set and passes `historic` would
   otherwise receive a normal-looking answer computed from nothing — the silent-wrong-answer class
   this document keeps paying for. A loud refusal is the whole point, so do **not** fall back to
   `commander`: that answers a different question than the one asked and
   [§3.6](../MCP-PRD.md#36-error-surface) forbids presenting it as the one asked.

   Like `card-search.ts`'s `outOfRangeFailure`, this failure carries **no `status`** — it is our
   determination from the parameters, not an HTTP outcome.

8. **The applied format is stated once per response and each combo carries one boolean.**
   `format: string` at the top level, `legal: boolean` per combo. Never emit a map of 16 keys, and
   never omit `format` — an absent key must never read as "not legal"
   ([§3.6](../MCP-PRD.md#36-error-surface)), which is the discipline
   [CAP-01](../MCP-PRD.md#cap-01--card-search)'s `legalities_mode` established. Because requirement
   7 refuses anything it cannot judge, `format` always names the format actually requested — there
   is no "applied versus requested" gap here, which is a real difference from
   [Slice 14](./TrackA-Slice14.md) and worth stating so nobody adds one.

   Note the values are **booleans** upstream, not Scryfall's `"legal"` / `"not_legal"` strings. Do
   not reuse `CardSummary.legalities`'s `Record<string, string>` shape.

9. **The normalized shape is the trim, and `description` stays.** Shaping to combo id, the cards it
   uses, what it produces, colour identity, mana needed, popularity, bracket tag, prerequisites and
   description measured **76–78% smaller** at **930–1,236 characters per combo**
   ([§4.4.1](../MCP-PRD.md#441-the-combo-payload-is-enormous--measured)). `description` is roughly
   **40% of the trimmed form** and is deliberately kept: it is the step-by-step line explaining how
   the combo executes, which is what the model reasons from — the same argument
   [OQ-02](../MCP-PRD.md#oq-02--how-verbose-should-a-search-result-be) used to keep `oracle_text`.

   At the worst measured per-combo cost a full 40-combo page is under **50,000** characters, inside
   [CAP-01](../MCP-PRD.md#cap-01--card-search)'s delivered band and well under the **116,626** that
   breached a harness ceiling.

10. **`requires` is kept, and it is a deliberate addition to the measured trim.** `requires[]`
    holds **templates** — `{ template: { name, scryfallQuery }, quantity, zoneLocations }`, e.g.
    "Permanent Castable for {C}" — not cards, so it cannot be folded into `uses`. Dropping it loses
    a component the combo genuinely needs. Audited across the 260 captured variants it costs
    **13.5 characters per variant on average**; only **39 of 260** carry one at all. Record that
    figure in the results doc so the 930–1,236 band is not silently overstated.

11. **Omit `requires`, `prerequisites` and `popularity` when they are empty**, using the
    conditional-spread idiom `...(x !== undefined ? { x } : {})` that
    `exactOptionalPropertyTypes` forces. `easyPrerequisites` and `notablePrerequisites` are
    **strings**, not arrays, and are `""` far more often than not — 19 and 151 of 260 non-empty
    respectively. Join the two with a separator when both are present.

12. **`register.ts` gains a `Clients` bundle rather than a second positional argument.**

    ```ts
    export interface Clients { scryfall: HttpClient; spellbook: HttpClient }
    ```

    `registerTools(server, clients)` and `dispatchToolCall(clients, name, args)`. Each handler
    still receives the **one** client it needs — `cardSearch(clients.scryfall, params)`,
    `comboSearch(clients.spellbook, params)` — so no handler can reach a source it has no business
    calling, and [D-03](../MCP-PRD.md#d-03--testability-handlers-callable-as-plain-functions)'s
    plain-function testability is untouched. Threading a third positional client through every
    call site is what this avoids;
    [Slice 17](./TrackA-Slice17.md) needs **two** clients in one handler and takes the bundle.

13. **Validation stays minimal and handlers never throw.** A wrong-typed `page` or `format` is
    silently dropped and the default applies, exactly as `dispatchToolCall` treats `unique` and
    `legalities` today ([D-07](../MCP-PRD.md#d-07--three-way-cache-split)). A **missing or
    non-string `q`** is the one rejection, matching `card_search`'s existing hand-built
    `bad_request`. Every other failure is a returned `Failure`
    ([D-10](../MCP-PRD.md#d-10--tool-handlers-never-throw)); the only throw in the codebase stays
    the unknown-tool-name case, which is harness misuse.

14. **The tool description must earn its bytes and must not name a scoped tool name.** It is
    resident context on every surface. State the query language's source, the page size, the
    `format` parameter and its refusal behaviour, in the shortest form that is true.
    **Never write `mcp__plugin_manabase_mtg__combo_search` or `Manabase:combo_search` into it** —
    the scoped name is constructed per surface and is not a property of the server
    ([P-12](../PLUGIN-PRD.md#p-12--plugin-name-and-server-key)), so a hardcoded one is wrong
    somewhere by construction. `tests/tools/register.test.ts` asserts the description **exactly**
    against a local constant; update that constant deliberately, not to make a test pass.

15. **No new npm dependency**, dev or runtime, and the SDK stays a devDependency. The tool schema
    is hand-written JSON Schema `as const`, like `CARD_SEARCH_INPUT_SCHEMA` — the low-level SDK
    server takes plain JSON Schema, so no schema library is needed.

16. **Rebuild and commit `dist/index.js` in the same commit as the `src/` change.**
    [P-09](../PLUGIN-PRD.md#p-09--server-ships-as-committed-built-javascript);
    [Slice 11](./TrackC-Slice11.md)'s CI gate fails the PR otherwise.

17. **Append one [§9](../MCP-PRD.md#9-revision-log) row and no more.** No `CAP-02` criterion is
    marked delivered by this slice — the capability is delivered when
    [Slice 17](./TrackA-Slice17.md) lands, and a half-built capability with ticked criteria is
    exactly the reporting failure [Slice 12](./TrackC-Slice12.md) paid for. Do **not** mint a
    `D-` decision; [§2](../MCP-PRD.md#2-locked-decisions) is locked and this implements an
    existing answer.

## Interface contracts

```ts
// src/spellbook/combos.ts — the normalized shape. Slice 17 consumes this unchanged.

export type ComboBucket =
  | "included" | "includedByChangingCommanders"
  | "almostIncluded" | "almostIncludedByAddingColors"
  | "almostIncludedByChangingCommanders"
  | "almostIncludedByAddingColorsAndChangingCommanders";

export interface ComboCard {
  name: string;
  oracle_id: string;              // the join back to Scryfall
  quantity: number;
  zones: string[];                // upstream zoneLocations: H B G E L C
  must_be_commander: boolean;
}

export interface ComboTemplate {
  template: string;               // e.g. "Permanent Castable for {C}"
  quantity: number;
  zones: string[];
}

export interface ComboSummary {
  id: string;
  bucket?: ComboBucket;           // combo_find_deck only; absent on combo_search
  uses: ComboCard[];
  requires?: ComboTemplate[];     // absent when the combo needs no template
  produces: string[];             // feature names
  color_identity: string;         // e.g. "UB"
  mana_needed: string;            // e.g. "{U}{U}{B}"
  mana_value_needed: number;
  popularity?: number;            // absent when upstream reports null
  bracket_tag: string;
  prerequisites?: string;         // easy + notable, joined; absent when both empty
  description: string;
  legal: boolean;                 // for the one format named at the top level
}

export const SPELLBOOK_LEGALITY_KEYS: readonly string[];   // the 16, requirement 7
export function resolveFormat(requested: string | undefined): string | undefined;  // undefined = reject
export function toComboSummary(variant: SpellbookVariant, formatKey: string, bucket?: ComboBucket): ComboSummary;
```

```ts
// src/tools/combo-search.ts

export interface ComboSearchParams {
  q: string;                      // passed upstream byte-identically
  page?: number;                   // 1-based; default 1
  format?: string;                 // default "commander"
}

export interface ComboSearchData {
  combos: ComboSummary[];          // <= 40, never carrying `bucket`
  total_combos: number;
  page: number;
  has_more: boolean;
  format: string;                  // the format applied — always the one requested
  note?: string;
}

export async function comboSearch(
  client: HttpClient,
  params: ComboSearchParams,
): Promise<Result<ComboSearchData>>;
```

The upstream call is exactly one request per tool call:

```
GET /variants/?q=<verbatim>&limit=40&offset=<(page-1)*40>&count=true
```

The tool's input schema, hand-written JSON Schema `as const`:

```
q:      { type: "string" }                      // required
page:   { type: "integer", minimum: 1 }         // default 1, defended in the handler anyway
format: { type: "string" }                      // default "commander"; rejected if unknown
```

`format` is a **string, not an enum**, deliberately: sixteen values in a schema is a large resident
cost for a parameter almost nobody sets, and requirement 7's failure already names the valid set at
the moment it matters.

## Out of scope — do NOT

- **No `combo_find_deck`, no decklist input, no `POST /find-my-combos`.**
  [Slice 17](./TrackA-Slice17.md) owns all of it, including the `include` parameter and the six
  buckets. `ComboBucket` and `bucket?` exist here only because the shape is set here.
- **No Scryfall call.** This tool touches one source. Name resolution
  ([§4.1.2](../MCP-PRD.md#412-batch-resolution)) exists for the decklist path and has no meaning
  for a query string.
- **No price field of any kind**, from Commander Spellbook or Scryfall
  ([D-06](../MCP-PRD.md#d-06--pricing-from-scryfall)). Not a passthrough, not a lookup, not a
  "cheapest card" convenience.
- **No `imageUri*` field**, and **never assemble an image URL from an id or `oracleId`**. That
  route is verified to work and deliberately not taken — the same argument
  [OQ-13](../MCP-PRD.md#oq-13--should-a-card-search-result-carry-image-uris-and-at-what-cost)
  settled for [CAP-01](../MCP-PRD.md#cap-01--card-search).
- **No client-side query parsing, validation, rewriting, or syntax teaching.**
  [OQ-14](../MCP-PRD.md#oq-14--how-should-commander-spellbook-query-syntax-be-surfaced-to-the-model)
  is open and its resolution method needs this tool to exist first. `/explain-query` is recorded
  as available and is **not** consumed here.
- **No skill edit and no second reference file.**
  [PC-01](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) teaches Scryfall syntax; whether a second
  query language gets a reference file or a skill of its own belongs to
  [`docs/PLUGIN-PRD.md`](../PLUGIN-PRD.md) and costs context budget measured there.
  [Slice 9](./TrackB-Slice9.md) measured 10/10 trigger accuracy on the current frontmatter and
  touching it invalidates that rate.
- **No auto-paging.** One tool call is one upstream request, always.
- **No caching, no bulk data, no persistence.** The gzipped 26.1 MB `variants.json.gz` is recorded
  in [§4.4](../MCP-PRD.md#44-commander-spellbook) and rejected: `/find-my-combos` matches
  server-side, and a single JSON object needs a streaming parser this project has no dependency
  for. `cacheDir` stays unused.
- **No new `FailureCode` member.** The six in [`src/result.ts`](../../src/result.ts) cover
  everything here.
- **No edits to [§2](../MCP-PRD.md#2-locked-decisions) or
  [§3](../MCP-PRD.md#3-constraints) of either PRD**, and no rewriting of
  [§4](../MCP-PRD.md#4-external-dependencies) — a new measurement is appended as a dated addendum.

## Acceptance criteria

1. **[[CAP-02](../MCP-PRD.md#cap-02--combo-discovery) criterion 1, half]** `comboSearch` is invoked
   directly in a test with no MCP server started and no transport constructed.
2. **[[CAP-02](../MCP-PRD.md#cap-02--combo-discovery) criterion 2]** The `q` sent upstream is
   byte-identical to the `q` received, asserted against a fake client — including a query carrying
   an operator this server has never heard of, and one carrying quotes, spaces and a colon.
3. **[[CAP-02](../MCP-PRD.md#cap-02--combo-discovery) criterion 3]** An invalid query returns a
   structured failure carrying Commander Spellbook's verbatim message — driven from
   `tests/fixtures/spellbook/variants-invalid-query-400.json`, whose body is
   `{"q":["Invalid search query: unexpected character : at position 34."]}` — and the handler does
   not throw.
4. **[[CAP-02](../MCP-PRD.md#cap-02--combo-discovery) criterion 6]** No response carries a
   Commander Spellbook price field. Asserted by serializing a shaped page built from
   `variants-page1.json` and matching for `tcgplayer`, `cardkingdom`, `cardmarket` and `prices` —
   and `npm run typecheck` is the real gate, since the wire type does not declare them.
5. **[[CAP-02](../MCP-PRD.md#cap-02--combo-discovery) criterion 7]** No response carries an
   `imageUri*` field. Same method: serialize and match for `imageUri`, case-insensitively, over a
   shaped page built from a fixture whose raw form is **41.9%** those fields.
6. **[[CAP-02](../MCP-PRD.md#cap-02--combo-discovery) criterion 8]** A response reports at most 40
   combos and states `total_combos` and `has_more`; page 1 of a 96-combo query returns 40 with
   `has_more: true`, and page 2 sends `offset=40` and returns different ids. Assert the outgoing
   query parameters, not only the returned data.
7. **[[CAP-02](../MCP-PRD.md#cap-02--combo-discovery) criterion 14, `combo_search` half]** A
   response states the format applied, each combo carries a single `legal` boolean, and no other
   format's legality appears anywhere in the serialized result.
8. **[requirement 7]** `format: "historic"`, `format: "standardbrawl"` and `format: "notaformat"`
   each return a `bad_request` naming the valid keys, with **no upstream call made** — asserted by
   counting calls on the fake client. `format: "EDH"` and `format: "Commander"` both resolve to
   `commander` and do call upstream.
9. **[requirement 5]** `variants-empty.json` returns `ok: true` with `combos: []`,
   `total_combos: 0`, `has_more: false`. A **404** from the client stays a failure and is not
   converted to an empty success.
10. **[requirement 4]** Every outgoing request carries `count=true`; a response whose `count` is
    `null` does not report `total_combos: 0` alongside a non-empty `combos` array.
11. **[requirement 6]** A fixture-derived envelope carrying 41 results returns 40 combos.
12. **[requirement 10]** A variant with `requires` round-trips its template name, quantity and
    zones; a variant without one omits the key entirely. Same for `prerequisites` and `popularity`.
13. **[requirement 12]** `dispatchToolCall` routes `card_search` to `clients.scryfall` and
    `combo_search` to `clients.spellbook`, asserted by giving the two fakes distinguishable
    responses. `tools/list` reports **two** tools. An unknown tool name still throws.
14. **[requirement 13]** A missing or non-string `q` returns a `bad_request` and makes no upstream
    call; a wrong-typed `page` or `format` is dropped and the default applies.
15. `npm test` passes and the suite/test totals are recorded against the current 27 / 101.
16. `npm run typecheck` is clean under `exactOptionalPropertyTypes`,
    `noUncheckedIndexedAccess` and `verbatimModuleSyntax`.
17. `npm run acceptance` is still **13/13** live against real Scryfall — this slice must not
    disturb [CAP-01](../MCP-PRD.md#cap-01--card-search).
18. `npm run build` leaves `git status --porcelain -- dist/` empty, in the same commit as the
    `src/` change.
19. `npm run lint:docs` passes, [`docs/MCP-PRD.md`](../MCP-PRD.md) shows exactly one new
    [§9](../MCP-PRD.md#9-revision-log) row and **no criterion marked delivered**, and
    `docs/slices/TrackA-Slice16-results.md` records the date, the shaped-page character count
    beside the 533,840 raw figure, the per-combo cost measured on these fixtures, and the
    `requires` cost from requirement 10.

## Testing requirements

Handlers are called as plain functions against a fake client
([D-03](../MCP-PRD.md#d-03--testability-handlers-callable-as-plain-functions)). Reuse
`makeFakeClient` and `makeScriptedClient` from `tests/tools/card-search.test.ts` rather than
inventing new ones — and keep `makeScriptedClient`'s deliberate behaviour that an **unscripted call
rejects** rather than returning something plausible. An extra upstream request is exactly the
auto-paging bug requirement 3 must not introduce, and a lenient fake hides it.

Both fakes need a `post` method now that `HttpClient` carries one, even though this slice never
calls it — a fake that silently lacks `post` will not typecheck, which is the desired outcome.

Fixtures load with `readFileSync` via the `new URL("../fixtures/…", import.meta.url)` helper, never
a JSON import. **Two of the Commander Spellbook fixtures are derived**, which is new to this repo —
`variants-page2.json` is the real `offset=40` response truncated to 8 variants, and
`find-my-combos-deck.json` is 164 variants reduced to 14 with `count` adjusted to match.
`tests/fixtures/spellbook/README.md` records both derivations field by field; cite the
[§4.4.1](../MCP-PRD.md#441-the-combo-payload-is-enormous--measured) measurements from the PRD and
never recompute them from a truncated fixture.

Suites to add:

- **Shape and trim** — every `ComboSummary` field from `variants-page1.json`; the price and image
  sweeps (criteria 4, 5); optional-key omission (criterion 12); a transform card, whose
  `uses[].card` carries `faces: 2`.
- **Paging and the cap** — outgoing `limit`/`offset`/`count` per page; the 40-cap; `has_more`
  across the 96-combo boundary; the defensive slice; a page past the end.
- **Query passthrough and failures** — the invented operator; the 400 with verbatim `details`; the
  empty 200; a 404 staying a failure.
- **Format resolution** — the 16 keys, case-insensitivity, the `edh` alias, and the three
  refusals, each asserting zero upstream calls.
- **Byte measurement** — shape a full 40-combo page and assert the character count is a **bound**,
  not an equality. Per-combo cost varies with how many cards a combo uses, so an exact assertion
  becomes a test that fails on a fixture refresh for no real reason.

No live call is required by this slice. `npm run acceptance` is run once to confirm
[CAP-01](../MCP-PRD.md#cap-01--card-search) is undisturbed, and stays a deliberate, human-run,
local step — never wired into CI
([§3.4](../MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance)).

## Verification steps

```bash
# 1) unit level
npm test                       # record suite/test counts for the results doc
npm run typecheck              # the compile-time guard for criteria 6 and 7 lives here

# 2) the omission is real, not just untested
grep -ri "imageuri\|tcgplayer\|cardkingdom\|cardmarket" src/     # must print nothing

# 3) the scoped tool name is nowhere in the description
grep -rn "mcp__plugin\|Manabase:" src/ skills/                   # must print nothing

# 4) build honesty — Slice 11's gate, run before CI runs it for you
npm run build
git status --porcelain -- dist/          # must print nothing

# 5) docs
npm run lint:docs

# 6) CAP-01 is undisturbed
npm run acceptance                       # 13/13; >=600 ms between calls; must not provoke a 429

# 7) pre-push
claude plugin validate . --strict
```

## References

- [`docs/MCP-PRD.md`](../MCP-PRD.md) [CAP-02](../MCP-PRD.md#cap-02--combo-discovery) — the fourteen
  criteria, the two cap bullets requirement 3 implements, and the "loudly correctable" bullet the
  Context section paraphrases. Read the two paging bullets together; they were split from one
  self-contradicting bullet and the split is the point.
- [`docs/MCP-PRD.md`](../MCP-PRD.md) [§4.4](../MCP-PRD.md#44-commander-spellbook) — the endpoint
  record, the 16 legality keys, the HTTP 400 shape, and the 2026-08-24 probe addendum establishing
  stable ordering, the empty-200, and the `count=true` requirement.
- [`docs/MCP-PRD.md`](../MCP-PRD.md)
  [§4.4.1](../MCP-PRD.md#441-the-combo-payload-is-enormous--measured) — the 640,684-character deck
  read, the 533,840-character single-card response, the 41.9% image share, and the 930–1,236
  chars/combo trimmed band requirement 9 rests on.
- [`docs/MCP-PRD.md`](../MCP-PRD.md)
  [D-16](../MCP-PRD.md#d-16--no-npm-commander-spellbook-client-dependency) — the fourth rejection
  ground is requirement 1 stated as a decision, including why the type-only middle path was
  refused.
- [`docs/MCP-PRD.md`](../MCP-PRD.md) [D-06](../MCP-PRD.md#d-06--pricing-from-scryfall),
  [D-07](../MCP-PRD.md#d-07--three-way-cache-split),
  [D-10](../MCP-PRD.md#d-10--tool-handlers-never-throw),
  [D-11](../MCP-PRD.md#d-11--tool-naming-convention),
  [§3.6](../MCP-PRD.md#36-error-surface) (never claim more than is known — why requirements 7 and 8
  exist).
- [`docs/slices/TrackA-Slice15.md`](./TrackA-Slice15.md) — the client this slice calls and the lane
  it rides.
- [`docs/slices/TrackA-Slice14.md`](./TrackA-Slice14.md) — the page-cap arithmetic that
  **does not transfer**, and why it exists there. Read requirement 7 of that document before
  writing any paging code here.
- `tests/fixtures/spellbook/README.md` — which fixtures are verbatim, which are derived, and
  exactly what was removed from the two that are not.
