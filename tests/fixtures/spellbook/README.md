# Commander Spellbook fixtures

Captured live against `https://backend.commanderspellbook.com` (API version 6.2.6) on the dates
below, with the app-naming `User-Agent` and an `Accept` header, calls spaced by hand. No 429 was
encountered.

**Read the Kind column before trusting a number.** Every other fixture in this repo is a verbatim
capture; two of the files here are **derived** — a real envelope whose `results` array was
truncated so the fixture stays reviewable. A derived envelope looks exactly like a real one, so
what was removed is recorded here and nowhere else.

| File | Kind | Captured | Source |
|---|---|---|---|
| `variants-page1.json` | verbatim | 2026-08-24 | `GET /variants/?q=card:"Thassa's Oracle"&limit=40&offset=0&count=true` |
| `variants-page2.json` | **derived** | 2026-08-24 | `GET /variants/?q=card:"Thassa's Oracle"&limit=40&offset=40&count=true` |
| `variants-single.json` | verbatim | 2026-08-24 | `GET /variants/?q=card:"Thassa's Oracle"&limit=1&count=true` |
| `variants-empty.json` | verbatim | 2026-08-24 | `GET /variants/?q=card:"Zzzz Not A Real Card 9999"&limit=40&count=true` |
| `variants-invalid-query-400.json` | verbatim | 2026-08-24 | `GET /variants/` with an unrecognized operator — the HTTP 400 body |
| `find-my-combos-deck.json` | **derived** | 2026-08-24 | `POST /find-my-combos`, a real 94-card Commander deck |
| `find-my-combos-limit5.json` | verbatim | 2026-08-24 | the same deck at `limit=5` |
| `find-my-combos-bogus-name.json` | verbatim | 2026-08-24 | `POST /find-my-combos`, three cards, one of them invented |

`tests/fixtures/collection-not-found.json` is a sibling rather than a member of this directory:
it is Scryfall's `POST /cards/collection`, captured 2026-08-24, and belongs to
[§4.1.2](../../../docs/MCP-PRD.md#412-batch-resolution) rather than to Commander Spellbook.

## The two derivations, exactly

### `variants-page2.json`

The capture held **40** variants. `results` is truncated to the **first 8**, in capture order.
Nothing else is edited — `count` stays at the captured **96**, and `next` / `previous` are the
URLs the API returned.

Why: page 1 and page 2 together were 425,694 characters for one query, and page 2's only job in a
test is to prove that `offset=40` returns *different* combos from `offset=0`. Eight is enough for
that. The 40-combo page cap is asserted against `variants-page1.json`, which is verbatim.

The eight retained ids: `1295-1779-2177`, `1295-1986-2503`, `1295-2503-2726`, `1295-2177-5120`,
`218-1295-1368-3734--39`, `1295-2177-5962`, `218-1295-1368-3668--39`, `218-1295-1368-2719--39`.
None of them appears in `variants-page1.json`.

### `find-my-combos-deck.json`

The capture was **640,946 bytes** holding **164** variants across the six buckets. Two edits:

- `results` is truncated to **14** variants — all **8** `included` (untouched, this is the answer
  the tool exists to return), the first **4** of 106 `almostIncluded`, the first **1** of 49
  `almostIncludedByAddingColors`, and the **1** `almostIncludedByChangingCommanders`. The two
  empty buckets are kept as empty arrays, because a consumer must handle all six.
- `count` is changed from **164** to **14**, so the envelope stays internally consistent with the
  `results` it carries. This is the one field whose value is not what the API returned.

`results.identity` is `"UBR"`, as captured.

The full 164-variant measurement — 640,684 characters, the per-bucket byte table, and the
5.4% / 94.6% split — is recorded in
[§4.4.1](../../../docs/MCP-PRD.md#441-the-combo-payload-is-enormous--measured) and must be cited
from there, never recomputed from this fixture.

## Four things these captures establish

1. **`/variants/` ordering is stable across calls.** Page 1 and page 2 of the same query returned
   40 ids each, **zero overlap**, 80 distinct ids in 80 slots. This is what
   [CAP-02](../../../docs/MCP-PRD.md#cap-02--combo-discovery)'s third cap bullet gates the
   upstream-paging path on.
2. **A valid query with no matches is HTTP 200 with `{"count":0,...,"results":[]}`, not a 404.**
   The opposite of Scryfall, which
   [CAP-01](../../../docs/MCP-PRD.md#cap-01--card-search) maps 404-as-empty for. Do not port that
   mapping here.
3. **`count` is `null` unless the request sends `count=true`.** The key is always present, so a
   missing total does not announce itself. `next` is populated either way and cannot substitute
   for a total.
4. **Scryfall's `POST /cards/collection` reports misses in `not_found`** as the identifier objects
   submitted — `[{"name":"Zzzz Not A Real Card 9999"}]` — not as bare strings.
