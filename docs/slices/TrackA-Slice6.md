# Track A — Slice 6: Live CAP-01 acceptance pass

> Self-contained implementation spec. You do not need to read the PRDs to build this slice;
> everything binding is inlined. PRD references are pointers for deeper context only.

**Goal.** Exercise all 12 CAP-01 acceptance criteria against **live Scryfall**, at polite
rates, through the real built server over real stdio — and record the results. The research
record behind the implementation is dated 2026-07-29; this slice is where drift between that
record and reality gets caught and written down. Track A is done when this slice's results are
recorded in `docs/MCP-PRD.md` §9.

## Preconditions (deliverables of Slice 5)

- `src/tools/register.ts` — `card_search` registered with compact description and JSON
  Schema; `dispatchToolCall` returns handler failures as `isError` tool results, never
  protocol errors.
- `src/index.ts` wired: config → client → `registerTools` → stdio transport.
- `tests/` all green (config, client, handler, prices, register); `dist/index.js` current,
  committed, self-contained, and serving `card_search` end-to-end.

## Context

Manabase is a Magic: The Gathering MCP server (Scryfall-backed card search) that ships inside a
Claude Code plugin. This is slice 6 of 6 in Track A — the closing verification slice. Nothing
new is built except the harness that proves what was built.

## Deliverables

| File | Action |
|---|---|
| `scripts/cap01-live.mjs` | new — live acceptance harness (plain JS, no build step) |
| `package.json` | add script `"acceptance": "node scripts/cap01-live.mjs"` |
| `docs/slices/TrackA-Slice6-results.md` | new — the recorded run |
| `docs/MCP-PRD.md` | append one revision-log row to §9 (template below) |

## Requirements

1. **The harness drives the real server over real stdio.** `scripts/cap01-live.mjs` spawns
   `node dist/index.js`, speaks newline-delimited JSON-RPC on its stdin/stdout, performs the
   initialize handshake (`initialize` → `notifications/initialized`), then issues one
   `tools/call` per check. Match responses to requests by `id`; 60-second per-call timeout
   (a 429 backoff inside the server legitimately takes 30 s). Plain Node ≥18 JS, no
   dependencies, no TypeScript, no build step.
2. **Politeness is part of the spec.** ≥600 ms between successive `tools/call`s (under the
   2/sec limit with margin). The full run is ~14 calls — about a minute. On a failed check,
   record and continue; never tight-loop, never retry a failed check in the same run.
3. **The check matrix.** Expected values are the 2026-07-29 baselines from `MCP-PRD.md`
   §4.1.1; thresholds are deliberately loose so ordinary drift passes while breakage fails.

   | # | Query / action | Pass condition | CAP-01 criterion | 2026-07-29 baseline |
   |---|---|---|---|---|
   | 1 | `o:/^{T}: Add/` | success, `total_cards` > 1,000 | 2 (regex unmangled) | 1,554 |
   | 2 | `otag:ramp` | success, `total_cards` > 0 | 3 | 2,260 |
   | 3 | `function:removal` | success, `total_cards` > 0 | 3 | 6,386 |
   | 4 | `art:squirrel` | success, `total_cards` > 0 | 3 | 192 |
   | 5 | `atag:squirrel` | success, same `total_cards` as check 4 (alias) | 3 | 192 |
   | 6 | `f:commander t:creature cmc=1` | success, `total_cards` > 175, `has_more: true`, `note` present, exactly one page of cards returned | 9 (pagination reported, not resolved) | 1,197 |
   | 7 | `usd<1 t:land` | success, `total_cards` > 175, pagination reported | 9 | 803 |
   | 8 | `illustrationtag:dragon` | `isError: true`, parsed body `error.code === "bad_request"`, `error.details` contains "All of your terms were ignored" — and the *next* check still succeeds (server survived) | 8 (structured failure, D-10) | HTTP 400 |
   | 9 | `!"Gaea's Cradle" set:jgp unique:prints` | a returned card's `price` is `{ available: true, finish: "foil" }` (usd null on the wire, usd_foil populated) | 4 | usd_foil "3999.00" |
   | 10 | `is:etched unique:prints` | at least one first-page card resolves `finish: "etched"` | 5 | 1,074 etched-only cards exist |
   | 11 | `!"Black Lotus"` | success; returned card's price `available: true` (search excludes digital-only printings by default, so this is the paper printing — **verify**; if a digital printing comes back instead, that is drift: record it, and the price must then say `digital-only`, never bare "no price") | 6 | LEA paper printing, usd populated |
   | 12 | `game:arena -game:paper t:creature` | first card's price is `{ available: false, reason: "digital-only" }` | 7 | Arena-only cards have all prices null |
   | 13 | `name:"xyzzynocardhasthisname"` | success with `cards: []`, `total_cards: 0`, `note` present — validates the Slice 3 decision that Scryfall's zero-match 404 maps to an empty success | (supplementary — not a CAP-01 criterion) | Scryfall returns HTTP 404 for zero matches |

4. **Criteria evidence split.** Three criteria are proven at unit level, not live — the
   results document states where each criterion's evidence lives:
   - **#1** (handler callable with no server/transport): `tests/tools/card-search.test.ts` —
     re-run `npm test` as part of this slice and record the pass.
   - **#10** (User-Agent + Accept on every request) and **#11** (≤2/sec spacing):
     `tests/scryfall/client.test.ts` (asserted against the mock). The harness's own ≥600 ms
     spacing is operational politeness, not the evidence.
   - **#12** (429 → backoff, structured failure): `tests/scryfall/client.test.ts`. Do **not**
     try to trigger a real 429 — deliberately exceeding the limit to test it is exactly what
     the rate-limit constraint prohibits.
5. **Output.** The harness prints one PASS/FAIL line per check with the observed value
   (e.g. `total_cards`), a summary count, and exits non-zero if any check fails.
6. **Record the run** in `docs/slices/TrackA-Slice6-results.md`: date, Node version, the
   full check table with observed values, the unit-evidence note from requirement 4, and a
   **Drift** section listing every divergence from the 2026-07-29 baselines (or "none").
7. **Close the loop in the PRD.** Append one row to the `docs/MCP-PRD.md` §9 revision-log
   table (append-only — change nothing else in that file):

   ```
   | <date> | CAP-01 live acceptance pass: criteria 1–12 verified (criteria 1, 10, 11, 12 at
   unit level; 2–9 live via scripts/cap01-live.mjs). Live totals: regex <n>, otag:ramp <n>,
   function:removal <n>, art:squirrel <n>. Drift from the 2026-07-29 research record:
   <none | list>. Results: docs/slices/TrackA-Slice6-results.md. | Track A Slice 6
   (docs/DEV-ROADMAP.md) — closes the server half of Phase 1. |
   ```

8. **If a check fails**, fix the code in the slice that owns it (client → Slice 2 spec,
   handler → Slice 3, prices → Slice 4, wiring → Slice 5), rebuild `dist/`, and re-run the
   whole harness. If *reality* changed (Scryfall behavior differs from the 2026-07-29
   record), the Drift section is the deliverable — record what is true now, adjust the code
   to reality, and say so in the §9 row.

## Interface contracts

Nothing new. The harness consumes the server's wire behavior established in Slice 5:
`tools/call` → `card_search` → `content[0].text` is JSON — `CardSearchData` on success
(`cards[].price` is `PriceInfo`), `{ error: { code, message, details?, status? } }` with
`isError: true` on failure. Canonical shapes are in the Slice 3 and Slice 5 docs. Repo layout
is unchanged from the Slice 1 doc; this slice adds only `scripts/cap01-live.mjs`.

## Out of scope — do NOT

- No new server features, no fixes beyond what failing checks demand.
- No 429-provocation, no load testing, no parallel calls — politeness is binding
  (a sustained overage risks Scryfall banning the application for every user).
- No CI wiring for the live harness (it hits a third party; CI work is a Track C slice).
- No edits to `docs/MCP-PRD.md` beyond the single appended §9 row; no plugin-file changes.
- No new dependencies.

## Acceptance criteria

1. `npm run acceptance` runs the full matrix in one invocation, ≥600 ms between calls, and
   exits 0 with every check PASS.
2. `npm test` passes in the same session (unit evidence for criteria 1, 10, 11, 12).
3. `docs/slices/TrackA-Slice6-results.md` exists with the recorded table, observed values,
   evidence split, and Drift section.
4. `docs/MCP-PRD.md` §9 has the new row; `git diff docs/MCP-PRD.md` shows exactly one
   appended table row and nothing else.
5. Tree committed clean; `dist/index.js` unchanged by this slice unless a check forced a fix
   (in which case the fix, rebuild, and a fresh all-PASS run are all in the commit).

## Testing requirements

The harness *is* the test. Keep it honest: assertions parse the actual JSON payloads
(`JSON.parse(content[0].text)`) rather than grepping stdout; check 8 must assert both the
`isError` shape *and* that the subsequent check still succeeds against the same server
process (proving a failure does not wedge the connection).

## Verification steps

```bash
npm test                 # unit evidence: criteria 1, 10, 11, 12
npm run build            # ensure dist/ matches src/ before the live run
npm run acceptance       # the live matrix; expect all PASS, exit 0
git add -A && git status # results doc + PRD row + package.json committed
```

## References

- `docs/DEV-ROADMAP.md` §4, Slice 6.
- `docs/MCP-PRD.md` §5 CAP-01 (the 12 criteria — the contract this slice closes), §4.1.1
  (operator baselines), §4.1.3 (price traps), §3.4 (politeness is binding), §9 (revision log).
