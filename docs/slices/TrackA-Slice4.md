# Track A — Slice 4: Price correctness

> Self-contained implementation spec. You do not need to read the PRDs to build this slice;
> everything binding is inlined. PRD references are pointers for deeper context only.

**Goal.** Replace the deliberately naive `resolvePrice` from Slice 3 with the trap-correct
implementation. Price correctness is part of the search capability itself, not a refinement:
three verified Scryfall behaviors each silently produce wrong prices for thousands of cards —
including some of the most expensive cards in Magic — if handled naively.

## Preconditions (deliverables of [Slice 3](./TrackA-Slice3.md))

- `src/scryfall/types.ts` exports `ScryfallPrices`, `ScryfallCard`, `ScryfallCardFace`,
  `ScryfallList` (wire types; `ScryfallCard` carries `digital: boolean`, `games: string[]`,
  `prices: ScryfallPrices`).
- `src/scryfall/prices.ts` exports the final `PriceInfo` type and a naive `resolvePrice`
  (usd-or-nothing) marked as knowingly wrong.
- `src/tools/card-search.ts` exports `cardSearch` (plain function, fake-client-testable),
  which calls `resolvePrice(card)` for every shaped card.
- `tests/tools/card-search.test.ts` and fixtures pass; `dist/index.js` current and committed.

## Context

Manabase is a Magic: The Gathering MCP server (Scryfall-backed card search) that ships inside a
Claude Code plugin. This is slice 4 of 6 in Track A: skeleton → HTTP client → search handler →
**price correctness** → tool wiring → live acceptance.

## The three verified traps (MCP-PRD [§4.1.3](../MCP-PRD.md#413-price-fields--three-verified-traps), verified live 2026-07-29)

1. **The price object is exactly** `usd`, `usd_foil`, `usd_etched`, `eur`, `eur_foil`, `tix`
   — all string-or-null. **`eur_etched` does not exist** in the live API even though
   Scryfall's card-object documentation lists it. Do not model it, do not read it.
2. **`usd` null while `usd_foil` is populated is common, not an edge case — 7,599 cards.**
   Foil-only printings (judge promos, From the Vault, etc.). Example: Gaea's Cradle, set
   `jgp`, returns `usd: null, usd_foil: "3999.00"`. Similarly, `is:etched` printings (1,074
   cards) carry only `usd_etched` with `usd` and `usd_foil` both null. A resolver that reads
   only `usd` reports "no price" for thousands of cards, including a $4,000 one.
3. **Digital printings have null paper prices.** MTGO printings (`digital: true`,
   `games: ["mtgo"]`) carry only `tix`; Arena-only cards have every price null. Scryfall's
   exact-name lookup for Black Lotus returns the **MTGO** printing — every paper price null.
   A price path that does not distinguish "digital printing" from "no price data" reports
   "no price available" for some of the most valuable cards in the game, with no explanation.

## Deliverables

| File | Action |
|---|---|
| `src/scryfall/prices.ts` | rewrite the `resolvePrice` body (the `PriceInfo` type does not change) |
| `tests/scryfall/prices.test.ts` | new |
| `tests/fixtures/prices/gaeas-cradle-jgp.json` | new |
| `tests/fixtures/prices/etched-only.json` | new |
| `tests/fixtures/prices/black-lotus-mtgo.json` | new |
| `tests/fixtures/prices/arena-only.json` | new |
| `tests/fixtures/prices/ordinary-nonfoil.json` | new |
| `tests/fixtures/prices/paper-no-price.json` | new |
| `dist/index.js` | rebuilt and committed |

## Requirements

1. **Resolution algorithm** (`resolvePrice(card: ScryfallCard): PriceInfo`):
   1. **Digital first.** If the printing is not available on paper — `card.digital === true`,
      or `card.games` does not include `"paper"` — return
      `{ available: false, reason: "digital-only" }`. The *reason* is the point: the model
      must be able to tell the user "digital-only", not just "no price" ([CAP-01](../MCP-PRD.md#cap-01--card-search) criterion 7).
   2. Otherwise resolve in order, returning the first non-null with its finish labeled:
      `prices.usd` → `{ available: true, usd, finish: "nonfoil" }`;
      `prices.usd_foil` → `{ …, finish: "foil" }`;
      `prices.usd_etched` → `{ …, finish: "etched" }`.
   3. All three null on a paper printing → `{ available: false, reason: "no-price-data" }`.
2. **Prices stay strings.** Scryfall serves `"3999.00"`; pass it through. No float parsing,
   no rounding, no currency math.
3. **The finish label is not optional.** `"$3999.00 (foil)"` versus a nonfoil price is a
   real distinction the model needs; `PriceInfo.finish` is how it travels.
4. **No behavior change anywhere else.** `cardSearch` already calls `resolvePrice` per card;
   this slice changes only the resolver body and its tests. If the Slice 3 handler tests
   asserted naive-stub outputs, update those assertions to the correct outputs — nothing else.
5. **A search default worth knowing** (context, not code): Scryfall's search API excludes
   digital-only printings from results unless the query asks for them (e.g. `game:mtgo`,
   `game:arena`). The digital branch therefore fires mainly when a query explicitly targets
   digital — which is exactly when the "digital-only" explanation matters. Slice 6 verifies
   this live; nothing in this slice depends on it.
6. Rebuild `dist/` and commit.

## Interface contracts

Unchanged — this slice fills in an existing contract. For reference (canonical, from Slice 3):

```ts
// src/scryfall/prices.ts
export type PriceInfo =
  | { available: true; usd: string; finish: "nonfoil" | "foil" | "etched" }
  | { available: false; reason: "digital-only" | "no-price-data" };

export function resolvePrice(card: ScryfallCard): PriceInfo;
```

Consumes `ScryfallCard` / `ScryfallPrices` from `src/scryfall/types.ts` (Slice 3). Repo layout
is unchanged from the [Slice 1](./TrackA-Slice1.md) doc.

## Out of scope — do NOT

- No `eur`/`tix` surfacing, no currency selection, no per-condition pricing, no price
  history — Scryfall carries one number per printing per finish and that limitation is
  accepted (MCP-PRD [D-06](../MCP-PRD.md#d-06--pricing-from-scryfall)). `tix` exists on the wire type; the resolver ignores it.
- No `eur_etched` field anywhere (it does not exist — trap 1).
- No query rewriting to force `game:paper` — the handler passes queries through untouched
  (Slice 3 requirement 1); paper-vs-digital is handled at *price resolution*, not by editing
  the user's query.
- No changes to `CardSummary`, `CardSearchData`, the client, or `src/index.ts`.
- No new dependencies; no plugin-file changes; no network calls in tests.

## Acceptance criteria

Unit-level ownership of [CAP-01](../MCP-PRD.md#cap-01--card-search) criteria 4–7 (MCP-PRD [§5](../MCP-PRD.md#5-capabilities); Slice 6 re-checks them live):

1. **[[CAP-01](../MCP-PRD.md#cap-01--card-search) #4]** The Gaea's Cradle `jgp` fixture (`usd: null, usd_foil: "3999.00"`)
   resolves to `{ available: true, usd: "3999.00", finish: "foil" }` — not "no price".
2. **[[CAP-01](../MCP-PRD.md#cap-01--card-search) #5]** The etched-only fixture (only `usd_etched` non-null) resolves to
   `finish: "etched"`.
3. **[[CAP-01](../MCP-PRD.md#cap-01--card-search) #6]** The Black Lotus MTGO fixture (`digital: true`, `games: ["mtgo"]`, only
   `tix` non-null) resolves to `{ available: false, reason: "digital-only" }` — the resolver
   never mistakes a digital printing's null paper prices for missing data.
4. **[[CAP-01](../MCP-PRD.md#cap-01--card-search) #7]** The Arena-only fixture (all prices null, `games: ["arena"]`) resolves to
   `reason: "digital-only"` — the reason is stated, not just the absence.
5. The ordinary-nonfoil fixture resolves to `finish: "nonfoil"`; the paper-no-price fixture
   (paper printing, all three null) resolves to `reason: "no-price-data"` — the two
   unavailable reasons never blur.
6. Resolution order is proven: a fixture with both `usd` and `usd_foil` non-null resolves to
   `nonfoil` (order is usd → usd_foil → usd_etched, first hit wins).
7. `npm run typecheck`, `npm test`, `npm run build` pass; `dist/index.js` recommitted.

## Testing requirements

`tests/scryfall/prices.test.ts`, `node:test` + `node:assert/strict`, calling `resolvePrice`
directly with fixture-loaded `ScryfallCard` objects (JSON via `fs.readFileSync` +
`JSON.parse`, or direct `import … with { type: "json" }` if the toolchain accepts it — either
is fine).

Fixture contents (realistic subsets modeled on the live API, not full payloads):

| Fixture | Key fields |
|---|---|
| `gaeas-cradle-jgp.json` | `name: "Gaea's Cradle"`, `set: "jgp"`, `digital: false`, `games: ["paper"]`, `prices: { usd: null, usd_foil: "3999.00", usd_etched: null, … }` |
| `etched-only.json` | any real etched printing shape: `usd: null, usd_foil: null, usd_etched: "<value>"`, paper games |
| `black-lotus-mtgo.json` | `name: "Black Lotus"`, `digital: true`, `games: ["mtgo"]`, all paper prices null, `tix: "45.98"` |
| `arena-only.json` | `digital: true`, `games: ["arena"]`, every price null |
| `ordinary-nonfoil.json` | `usd` and `usd_foil` both non-null, paper games |
| `paper-no-price.json` | `digital: false`, `games: ["paper"]`, all six price fields null |

## Verification steps

```bash
npm run typecheck && npm test && npm run build
git add -A && git status   # clean after commit, dist/index.js current
```

## References

- [`docs/DEV-ROADMAP.md`](../DEV-ROADMAP.md) [§4](../DEV-ROADMAP.md#4-phase-1-slices), [Slice 4](../DEV-ROADMAP.md#slice-4--price-correctness).
- [`docs/MCP-PRD.md`](../MCP-PRD.md) [§4.1.3](../MCP-PRD.md#413-price-fields--three-verified-traps) (the three verified traps — the authoritative record), [§5](../MCP-PRD.md#5-capabilities) [CAP-01](../MCP-PRD.md#cap-01--card-search)
  criteria 4–7, [D-06](../MCP-PRD.md#d-06--pricing-from-scryfall) (Scryfall as sole price source, limitation accepted).
