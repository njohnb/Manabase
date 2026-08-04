# Track A — Slice 3: `card_search` handler

> Self-contained implementation spec. You do not need to read the PRDs to build this slice;
> everything binding is inlined. PRD references are pointers for deeper context only.

**Goal.** The core of the product as a plain, directly-testable function: `cardSearch` takes a
Scryfall query string, evaluates it via the live `GET /cards/search` endpoint, and returns
shaped per-card results with honest pagination reporting. No MCP wiring yet (Slice 5), and
price resolution is deliberately naive (Slice 4 makes it correct).

## Preconditions (deliverables of Slice 2)

- `src/result.ts` exports the canonical `Result` union (`FailureCode`, `Failure`,
  `Success<T>`, `Result<T>`).
- `src/scryfall/client.ts` exports `ScryfallClient` / `createScryfallClient(config, deps?)` —
  rate-limited, required headers, 429 backoff, never throws, 4xx `details` preserved verbatim.
- `tests/scryfall/client.test.ts` passes; `dist/index.js` current and committed.
- Slice 1 base: `.ts`-extension imports, `node --test tests/`, entry-point-only env reads.

## Context

Manabase is a Magic: The Gathering MCP server (Scryfall-backed card search) that ships inside a
Claude Code plugin. This is slice 3 of 6 in Track A: skeleton → HTTP client → **search
handler** → price correctness → tool wiring → live acceptance.

## Deliverables

| File | Action |
|---|---|
| `src/scryfall/types.ts` | new — minimal Scryfall wire types |
| `src/scryfall/prices.ts` | new — `PriceInfo` + deliberately naive `resolvePrice` |
| `src/tools/card-search.ts` | new — the `cardSearch` handler |
| `tests/tools/card-search.test.ts` | new |
| `tests/fixtures/search-page-1.json` | new — realistic `/cards/search` page fixture |
| `tests/fixtures/search-error-400.json` | new — Scryfall 400 error body |
| `dist/index.js` | rebuilt and committed |

## Requirements

1. **Full query passthrough — no parsing, no validation, no rewriting.** Scryfall's query
   language (including regex `o:/…/`, tag operators `otag:`/`function:`/`art:`/`atag:`,
   legality and price filters) is evaluated **server-side by Scryfall**; it cannot be
   reproduced locally and must not be second-guessed (MCP-PRD D-07). Send `q` exactly as
   received. A malformed query is Scryfall's call to make, and its error text comes back to
   the model via the `Failure.details` passthrough.
2. **Parameters and defaults.** `unique` defaults to `"cards"` (one row per card, not per
   printing — deckbuilding defaults, not collecting). `page` defaults to `1` (Scryfall pages
   are 1-based, 175 cards per page). `order` and `dir` pass through when present; omit them
   from the request otherwise (the client already skips `undefined` params).
3. **Request.** `client.get("/cards/search", { q, unique, order, dir, page: String(page) })`.
   The success payload is a Scryfall list object: `{ object: "list", total_cards, has_more,
   data: [...] }`.
4. **Shaping.** Map each card to `CardSummary` (contract below). Rules:
   - Copy optional fields only when present — `exactOptionalPropertyTypes` is on, so omit
     keys rather than assigning `undefined` (conditional spread is the idiom).
   - **Multi-faced cards:** when the top-level `oracle_text` (or `mana_cost`) is absent and
     `card_faces` is present, join the faces' values with `" // "`. Scryfall puts gameplay
     text on faces for double-faced and split cards; dropping it would return blank oracle
     text for a large class of cards.
   - `legalities` passes through as-is (format → `"legal" | "not_legal" | "restricted" |
     "banned"`). Result verbosity tuning is an open question (MCP-PRD OQ-02) — do not trim.
   - `price` comes from `resolvePrice(card)` — naive in this slice (requirement 7).
5. **Pagination is reported, never resolved.** Populate `total_cards`, `page`, `has_more`
   from the response. When `has_more` is true, set `note` to a short sentence stating the
   total, the current page, and that the caller should narrow the query or request the next
   page explicitly — **never auto-fetch further pages, never silently truncate** (a 6,000-card
   result is the model's cue to narrow, not a download job).
6. **Zero-match searches.** Scryfall returns **HTTP 404** (`code: "not_found"`, details like
   "Your query didn't match any cards…") for a valid query with no results. *(Decision made
   here — not in the PRDs; flagged for live verification in Slice 6.)* Map a `not_found`
   failure from this endpoint to a **success**: `{ cards: [], total_cards: 0, page, has_more:
   false, note: <Scryfall's details verbatim> }`. No cards matching is a search outcome, not
   an error the model should treat as a dead end.
7. **Naive price stub** (`src/scryfall/prices.ts`): `prices.usd` non-null →
   `{ available: true, usd, finish: "nonfoil" }`; otherwise `{ available: false, reason:
   "no-price-data" }`. This is **knowingly wrong** for foil-only, etched-only, and digital
   printings — Slice 4 replaces the implementation (the `PriceInfo` type is final now and
   does not change). Mark the naive body with a comment saying exactly that.
8. **Every other failure passes through unchanged.** `bad_request` (with Scryfall's verbatim
   `details`), `rate_limited`, `upstream_unavailable`, `network` — return the client's
   `Failure` as-is. The handler never throws (MCP-PRD D-10) and adds no interpretation.
9. Rebuild `dist/` and commit.

## Interface contracts

This slice **creates** (canonical — consumed verbatim by Slices 4–6):

```ts
// src/scryfall/types.ts — minimal wire shapes; only fields the code reads
export interface ScryfallPrices {
  usd: string | null;
  usd_foil: string | null;
  usd_etched: string | null;
  eur: string | null;
  eur_foil: string | null;
  tix: string | null;
  // NOTE: eur_etched does not exist in the live API even though Scryfall's docs list it. Do not add it.
}

export interface ScryfallCardFace {
  name: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  colors?: string[];
  power?: string;
  toughness?: string;
  loyalty?: string;
}

export interface ScryfallCard {
  name: string;
  mana_cost?: string;
  cmc: number;
  type_line: string;
  oracle_text?: string;
  colors?: string[];
  color_identity: string[];
  power?: string;
  toughness?: string;
  loyalty?: string;
  rarity: string;
  set: string;
  set_name: string;
  digital: boolean;
  games: string[];
  legalities: Record<string, string>;
  prices: ScryfallPrices;
  card_faces?: ScryfallCardFace[];
}

export interface ScryfallList {
  object: "list";
  total_cards: number;
  has_more: boolean;
  data: ScryfallCard[];
}
```

```ts
// src/scryfall/prices.ts
export type PriceInfo =
  | { available: true; usd: string; finish: "nonfoil" | "foil" | "etched" }
  | { available: false; reason: "digital-only" | "no-price-data" };

export function resolvePrice(card: ScryfallCard): PriceInfo;
```

```ts
// src/tools/card-search.ts
export interface CardSearchParams {
  q: string;
  unique?: "cards" | "prints" | "art";   // default "cards"
  order?: string;
  dir?: "auto" | "asc" | "desc";
  page?: number;                          // 1-based; default 1
}

export interface CardSummary {
  name: string;
  mana_cost?: string;
  cmc: number;
  type_line: string;
  oracle_text?: string;
  colors?: string[];
  color_identity: string[];
  power?: string;
  toughness?: string;
  loyalty?: string;
  rarity: string;
  set: string;
  set_name: string;
  legalities: Record<string, string>;
  price: PriceInfo;
}

export interface CardSearchData {
  cards: CardSummary[];
  total_cards: number;
  page: number;
  has_more: boolean;
  /** Present when the model should act: e.g. zero matches, or more pages exist. */
  note?: string;
}

export function cardSearch(client: ScryfallClient, params: CardSearchParams): Promise<Result<CardSearchData>>;
```

This slice **consumes**: `Result`/`Failure` (Slice 2), `ScryfallClient` (Slice 2). Repo layout
is unchanged from the Slice 1 doc.

## Out of scope — do NOT

- No MCP registration, no tool schema, no changes to `src/index.ts` (Slice 5).
- No correct price-trap handling — the naive stub is deliberate; do not partially implement
  Slice 4.
- No query construction help, syntax validation, or query rewriting (D-07; the plugin skill
  owns syntax teaching).
- No trimming of result fields to save tokens (OQ-02 is open — decide nothing here).
- No new dependencies; no plugin-file changes; no network calls in tests.

## Acceptance criteria

Unit-level ownership of CAP-01 criteria 1, 8, 9 (MCP-PRD §5; Slice 6 re-checks live):

1. **[CAP-01 #1]** `cardSearch` is invoked directly in tests with a hand-built fake
   `ScryfallClient` — no MCP server started, no transport constructed, no network.
2. **[CAP-01 #9]** A fixture page with `total_cards` > 175 and `has_more: true` yields a
   result reporting the true total, `has_more: true`, and a `note` that names the total and
   directs narrowing or explicit next-page — with exactly 175 (fixture-length) cards, none
   auto-fetched.
3. **[CAP-01 #8]** A `bad_request` failure from the client (fixture: Scryfall's real 400 body
   for `illustrationtag:dragon`, details `"All of your terms were ignored."`) passes through
   with `details` verbatim, and nothing throws.
4. Zero-match: a `not_found` failure from the client maps to `ok: true` with `cards: []`,
   `total_cards: 0`, and Scryfall's details in `note`.
5. Shaping: a double-faced-card fixture yields joined `" // "` oracle text; optional fields
   absent on the wire are absent keys (not `undefined`) on `CardSummary`.
6. Defaults: `unique` omitted → request carries `unique=cards`; `page` omitted → `page=1`.
7. `npm run typecheck`, `npm test`, `npm run build` pass; `dist/index.js` recommitted.

## Testing requirements

`tests/tools/card-search.test.ts`, `node:test` + `node:assert/strict`, invoking `cardSearch`
directly with a fake client (an object literal implementing `ScryfallClient` whose `get`
records its arguments and returns canned `Result`s — no mocking library).

Fixtures (realistic subsets, not full payloads):

- `tests/fixtures/search-page-1.json` — a `ScryfallList` with `total_cards: 1197`,
  `has_more: true`, and a handful of `data` entries that include: an ordinary creature (all
  scalar fields), a planeswalker (`loyalty`), and a double-faced card (no top-level
  `oracle_text`, two `card_faces`). Realistic field values; `prices` present on each.
- `tests/fixtures/search-error-400.json` — `{"object":"error","code":"bad_request",
  "status":400,"warnings":["Invalid expression \"illustrationtag:dragon\" was ignored…"],
  "details":"All of your terms were ignored."}`

## Verification steps

```bash
npm run typecheck && npm test && npm run build
git add -A && git status   # clean after commit, dist/index.js current
```

## References

- `docs/DEV-ROADMAP.md` §4, Slice 3.
- `docs/MCP-PRD.md` §5 CAP-01 (behavior bullets — field list, pagination, defaults), §4.1.1
  (search endpoint facts), D-03 (direct-call testability), D-07 (server-side query engine),
  D-10 (never throw), D-11 (tool naming, relevant in Slice 5).
