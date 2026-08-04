# Track A — Slice 6 results: live CAP-01 acceptance pass

**Run date:** 2026-08-03
**Node:** v22.17.1
**Server under test:** `dist/index.js` (built from `src/` at this commit), driven over real stdio
**Harness:** `scripts/cap01-live.mjs` (`npm run acceptance`)
**Result:** 13 of 13 checks PASS, exit 0. Two upstream drifts recorded (see [Drift](#drift)).
**Handshake:** `initialize` (protocol `2025-06-18`) → `manabase-mtg@0.0.0` → `notifications/initialized`
**Politeness:** ≥ 600 ms between successive `tools/call`s, strictly sequential, 15 calls total,
no retries, no 429 provoked.

## Check matrix — observed values

Assertions run on `JSON.parse(content[0].text)` — the actual tool payload — never on raw stdout.

| # | Query / action | CAP-01 criterion | 2026-07-29 baseline | Observed 2026-08-03 | Result |
|---|---|---|---|---|---|
| 1 | `o:/^{T}: Add/` | 2 (regex unmangled) | 1,554 | `total_cards=1555` | PASS |
| 2 | `otag:ramp` | 3 | 2,260 | `total_cards=2274` | PASS |
| 3 | `function:removal` | 3 | 6,386 | `total_cards=6405` | PASS |
| 4 | `art:squirrel` | 3 | 192 | `total_cards=194` | PASS |
| 5 | `atag:squirrel` (alias of #4) | 3 | 192 | `total_cards=194` — identical to `art:squirrel` | PASS |
| 6 | `f:commander t:creature cmc=1` | 9 (pagination reported, not resolved) | 1,197 | `total_cards=1197`, `has_more=true`, `cards.length=175` (exactly one page), `note="1197 cards match; showing page 1. Narrow the query or request a specific page for more."` | PASS |
| 7 | `usd<1 t:land` | 9 | 803 | `total_cards=802`, `has_more=true`, `cards.length=175`, note present | PASS |
| 8 | `illustrationtag:dragon` | 8 (structured failure, D-10) | HTTP 400 | `isError=true`, `error.code="bad_request"`, `error.status=400`, `error.details="All of your terms were ignored."` — and the **next** `tools/call` on the same server process succeeded (`total_cards=1`), so a failure does not wedge the connection | PASS |
| 9 | `!"Gaea's Cradle" set:jgp`, `unique=prints` | 4 (foil-only price) | `usd_foil "3999.00"` | `total_cards=1`, `price={"available":true,"usd":"3999.00","finish":"foil"}` | PASS |
| 10 | `is:etched`, `unique=prints` | 5 (etched price) | 1,074 etched-only cards | `total_cards=1205`; 137 of the 175 first-page cards resolved `finish:"etched"`; first = Abaddon the Despoiler (40k) `{"available":true,"usd":"0.42","finish":"etched"}` | PASS |
| 11 | `!"Black Lotus"` | 6 (paper vs. MTGO printing) | LEA paper printing, `usd` populated | **Drifted** — default rollup returned Vintage Masters (vma): `{"available":false,"reason":"digital-only"}` (correct: never a bare no-price). `!"Black Lotus" game:paper` → Unlimited Edition (2ed): `{"available":false,"reason":"no-price-data"}` — no paper Lotus printing carries USD upstream any more. Substitute probe `t:land usd>=1 game:paper unique=prints` → Abandoned Air Temple (tla) `{"available":true,"usd":"5.72","finish":"nonfoil"}` | PASS (with drift) |
| 12 | `game:arena -game:paper t:creature` | 7 (digital-only stated) | all prices null | `total_cards=1832`; first card A-Acererak the Archlich (afr) `{"available":false,"reason":"digital-only"}` | PASS |
| 13 | `name:"xyzzynocardhasthisname"` | supplementary (Slice 3 404→success) | Scryfall 404 for zero matches | `cards=[]`, `total_cards=0`, `note="Your query didn't match any cards. Adjust your search terms or refer to the syntax guide at https://scryfall.com/docs/reference"` | PASS |

## Criteria evidence split

Three of the twelve CAP-01 criteria are proven at unit level rather than live, by design:

- **Criterion 1** (handler callable with no MCP server started and no transport constructed,
  D-03) — `tests/tools/card-search.test.ts`. Re-run in this session: pass.
- **Criterion 10** (`User-Agent` and `Accept` headers on every request) and **criterion 11**
  (≤ 2 requests/second spacing) — `tests/scryfall/client.test.ts`, asserted against the mock
  transport. The harness's own ≥ 600 ms spacing is operational politeness, not the evidence.
- **Criterion 12** (429 → backoff, structured failure, never an immediate retry) —
  `tests/scryfall/client.test.ts`. **No real 429 was provoked.** Deliberately exceeding
  Scryfall's rate limit to observe the response is precisely what the rate-limit constraint
  (§3.4) prohibits; a sustained overage risks a ban affecting every user of the application.

Criteria 2–9 are the live evidence in the table above.

**Unit suite, same session:** `npm test` → **67 tests, 67 pass, 0 fail** (19 suites), and
`npm run typecheck` clean, both before the build and after the run.

## Drift

Two divergences from the 2026-07-29 research record. Both are upstream changes at Scryfall;
neither is a defect in this server, and neither required a code change.

1. **`!"Black Lotus"` no longer returns a paper printing by default.** The 2026-07-29 record
   states that search excludes digital-only printings by default and that a bare
   `!"Black Lotus"` yields the LEA paper printing. Live, the `unique=cards` rollup returns the
   MTGO **Vintage Masters (vma)** printing. The server handled it exactly as §4.1.3 trap 3
   requires: `{"available":false,"reason":"digital-only"}` — the reason is stated, and it is
   never reported as a bare "no price". CAP-01 criterion 6's substance (a digital printing must
   not be silently priced as unavailable-without-reason) therefore holds.
2. **No paper Black Lotus printing carries a USD price any more.** All three paper printings
   return `usd`, `usd_foil` and `usd_etched` as `null`, with only EUR populated:
   `2ed eur 11658.96`, `leb eur 22454.09`, `lea eur 38719.86`. The 2026-07-29 record had the
   LEA `usd` populated. `no-price-data` is therefore the honest answer for paper Black Lotus,
   and it is correctly distinguished from `digital-only`. Because this makes Black Lotus
   unusable as live proof that a *paper USD* price resolves, check 11 adds a substitute probe —
   `t:land usd>=1 game:paper` with `unique=prints`, which by construction can only match
   printings that carry a `usd` value — confirming `{"available":true,"usd":"5.72",
   "finish":"nonfoil"}`. USD price resolution is intact; the Black Lotus data is not.
   *(Adding EUR fallback to `PriceInfo` would be a new feature and is out of scope for this
   slice; if paper USD coverage for Reserved List cards stays absent, it is worth an open
   question.)*

Ordinary numeric drift in the operator baselines (all within the deliberately loose
thresholds, all in the expected direction of a growing card pool):

| Query | 2026-07-29 | 2026-08-03 | Δ |
|---|---|---|---|
| `o:/^{T}: Add/` | 1,554 | 1,555 | +1 |
| `otag:ramp` | 2,260 | 2,274 | +14 |
| `function:removal` | 6,386 | 6,405 | +19 |
| `art:squirrel` / `atag:squirrel` | 192 | 194 | +2 |
| `f:commander t:creature cmc=1` | 1,197 | 1,197 | 0 |
| `usd<1 t:land` | 803 | 802 | −1 |
| `is:etched` (unique prints) | 1,074 etched-only cards | `total_cards=1205` | +131 |

No drift in behavior for checks 1–10, 12 and 13: every operator, the alias equivalence, the
pagination contract, the structured-failure shape and its `details` text, and the zero-match
404 → empty-success mapping all behave exactly as the 2026-07-29 record describes.

## Harness notes

- `unique:prints` in checks 9 and 10 is sent as the tool's `unique` parameter (the documented
  API parameter the tool exposes), not as a token inside `q`. Same semantics, no reliance on
  the query parser accepting display options inline.
- Check 8 issues check 9's query itself, immediately after asserting the `isError` shape, so
  that "the server survived a structured failure" is proven on the same process by the very
  call check 9 then asserts against. No duplicate request is made.
- 15 `tools/call`s total (13 checks; check 11 makes three). Run wall time ≈ 25 s.
- A failed check is recorded and the run continues; a failed check is never retried within a
  run.
