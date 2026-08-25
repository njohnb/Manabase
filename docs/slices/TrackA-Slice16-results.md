# Track A — Slice 16 results: `combo_search`

**Date:** 2026-08-25
**Spec:** [`TrackA-Slice16.md`](./TrackA-Slice16.md)
**Commits:** `4bf697d` (the tool), plus the page-cap amendment recorded in §2a
**Delivers:** [CAP-02](../MCP-PRD.md#cap-02--combo-discovery) criteria **2, 6 and 7** in full, the
**handler half** of criterion 3, and the **`combo_search` half** of criteria 1, 8 and 14.
**No criterion is marked delivered and `Status` stays `specified`** — the capability is delivered
when [Slice 17](./TrackA-Slice17.md) lands.
**Closes no open question.** [OQ-05](../MCP-PRD.md#oq-05--do-commander-spellbook-or-archidekt-impose-rate-limits)
and [OQ-14](../MCP-PRD.md#oq-14--how-should-commander-spellbook-query-syntax-be-surfaced-to-the-model)
are both unmoved.

Environment: Windows 11, Node 26.7.0 locally (`.nvmrc` pins 22 for CI).

| | before | after |
|---|---|---|
| `npm test` | 39 suites / 150 tests | **56 suites / 210 tests** |
| `npm run typecheck` | clean | clean |
| `npm run acceptance` | 13/13 | **13/13**, no 429 |
| `npm run lint:docs` | OK | OK |
| `tools/list` on the rebuilt bundle | 1 tool | **2 tools** |

---

## 1. The live ordering probe — CAP-02's third cap bullet, discharged

[CAP-02](../MCP-PRD.md#cap-02--combo-discovery)'s third cap bullet gates the upstream-paging path
on `/variants/` ordering being stable across calls, and binds **the implementing slice** to confirm
it live. The 2026-08-24 capture recorded in
[`tests/fixtures/spellbook/README.md`](../../tests/fixtures/spellbook/README.md) already showed it;
this run repeats it against the shipped client and handler, so the evidence is dated to the slice
that ships the path.

Two calls, `card:"Thassa's Oracle"`, pages 1 and 2, spaced by the client's own 500 ms lane:

```
page 1 ids: 40   page 2 ids: 40
distinct across both: 80 in 80 slots
overlap: 0
duplicate ids within a page: 0 / 0
total_combos: 96 / 96      has_more: true / true      format: commander
call 1 took 561 ms; call 2 finished 94 ms later; total elapsed 655 ms
```

**Ordering is stable.** The path ships as specified and neither fallback — an explicit `ordering`
parameter, or one fetch and a client-side slice — is needed.

The same run swept the **live** payload for the two forbidden field families and for the legality
map. `tcgplayer`, `cardkingdom`, `cardmarket`, `prices`, `imageUri` and `legalities`: all **absent**.

## 2. The trim, measured — and one figure that contradicts the spec

Shaping to combo id, cards used, what it produces, colour identity, mana needed, popularity,
bracket tag, prerequisites and description:

| Payload | Raw | Shaped | Per combo |
|---|---|---|---|
| `variants-page1.json`, 40 variants (fixture) | 173,135 | **40,096** | **1,001** |
| `card:"Thassa's Oracle"` page 1, live | — | **40,202** | **1,005** |
| `card:"Thassa's Oracle"` page 2, live | — | **63,688** | **1,592** |

**Only the fixture row supports a reduction percentage**, because it is the only one of the three
with a raw figure beside it: 173,135 → 40,096 is **76.8%**, inside the 76–78% band
[§4.4.1](../MCP-PRD.md#441-the-combo-payload-is-enormous--measured) measured 2026-08-24. Do **not**
compute a reduction against that section's **533,840**-character figure — that is the *whole*
96-variant response for the query, and these pages carry 40 variants each, so the two are not
comparable. `description` is **36.5%** of the trimmed form, consistent with the ~40% that section
records, and it is kept.

**Page 2 is the finding.** At **1,592 characters per combo** it sits above
[§4.4.1](../MCP-PRD.md#441-the-combo-payload-is-enormous--measured)'s measured **930–1,236** band,
and its **63,688**-character page is above
[CAP-02](../MCP-PRD.md#cap-02--combo-discovery)'s stated "under 50,000" page budget. Nothing is
broken by it — 63,688 is 55% of the **116,626** that breached a harness ceiling in issue #25 — but
the 50,000 figure is an estimate derived from one query and **must not be quoted as a guarantee**.
The cause is visible in the fixtures: per-combo cost tracks how many cards a combo uses.

| Fixture | n | min | median | max | mean | cards/combo |
|---|---|---|---|---|---|---|
| `variants-page1.json` | 40 | 546 | 993 | 1,709 | 1,000 | 2.9 |
| `variants-page2.json` (derived, 8 verbatim variants) | 8 | 897 | 1,179 | 1,838 | **1,340** | 3.4 |

The byte tests assert the **issue #25 ceiling** as the bound that matters, with the 50,000 figure
kept only as a fixture-level regression guard and commented as such. An exact assertion was
deliberately not written: it would fail on a fixture refresh for no real reason.

**That finding was then chased down, and it changed the cap. See §2a.**

## 2a. The page cap was re-sized from 40 to 20, on a sampled distribution

Page 2 being above the band was a symptom, so the distribution was sampled deliberately rather than
inferred: **577 combos across 15 queries**, shaped through the delivered shaper, each query chosen
to stress one driver of shaped size. Commander Spellbook's `cards>N`, `steps>N`, `results>N` and
`prerequisites>N` operators were all confirmed real against `/explain-query` first, so no call was
spent on a guessed operator.

| | per combo |
|---|---|
| min / p50 / p90 | 547 / **1,390** / 2,043 |
| p95 / p99 / max | 2,296 / **2,530** / **4,421** |
| sampled mean | **1,393** |

**`card:"Thassa's Oracle"` is a cheap query, not a representative one.** Its ~1,001 characters per
combo sits near the bottom of that distribution, and
[§4.4.1](../MCP-PRD.md#441-the-combo-payload-is-enormous--measured)'s 930–1,236 band is *below the
sampled mean*. Cost tracks how many cards a combo uses: a 10-card combo shapes to 4,421 characters
where a 2-card one shapes to 547.

Worst real 40-combo pages, measured: `cards>5 steps>5` **99,311**, `cards>5` 98,017,
`cards>4 prerequisites>2` 81,887, `cards>4` 71,295, `steps>8` 67,748. The first was confirmed
**end to end through the shipped tool**, not projected — 85% of the 116,626 that breached a harness
ceiling, from a query any user can type.

| cap | typical page (1,393) | worst page mean (2,913) | every combo at max (4,421) |
|---|---|---|---|
| 40 (as specified) | 55,720 | **116,640** | 176,840 |
| 25 | 34,825 | 72,945 | 110,525 |
| **20 (chosen)** | **27,860** | **58,380** | **88,420** |
| 15 | 20,895 | 43,815 | 66,315 |

**Sizing is by margin, not to a target.** 116,626 is a value known to **fail**, not the ceiling —
the true limit is unknown and lower. The question was therefore not "what fits 50,000" but "what
still fits when every combo on the page is a 10-card one". That rejected 25, whose maximum-cost page
reaches 95% of a known-bad figure. It also means the realistic worst page at 20 (~58,000) is
**accepted despite exceeding the original 50,000 aspiration**: a fixed count cap cannot honour that
aspiration against 5.7× cost variance without dropping to 15 and tripling the page count.

Re-measured through the shipped tool after the change:

| query | at 40 | at 20 |
|---|---|---|
| `cards>5 steps>5` | **99,311** | **58,240** |
| `card:"Thassa's Oracle"` | 40,141 (page 1) | **16,903** |

**Re-sizing was safe only because Commander Spellbook exposes a true `offset`.** Every combo stays
reachable at any cap, so changing the number strands nothing — the same change against Scryfall's
offsetless `page` would have, which is precisely why [Slice 14](./TrackA-Slice14.md) could not
simply pick a smaller number and had to use a half-page.

A **byte-aware** cap was considered here and deferred on the grounds that it costs a contract
change. **That decision was reversed the same day — see §2b**, which is why the cap of 20 above
never reached a PR even though it was really committed.

## 2b. The fixed cap was replaced by a byte budget, before Slice 17 could build on it

Two probes retired the objection that deferred this in §2a.

**`/variants/` ignores field selection.** `fields=`, `fields[]=`, `only=` and `omit=` are accepted
and silently ignored; the variant always carries all 20 keys including `prices` and the ten
`imageUri*`. So the 41.9% this tool discards **cannot be avoided by asking for less**, and
fetching more variants adds no new class of waste.

**Responses are gzipped**, which is the fact I failed to check when calling wire traffic a
drawback:

| variants fetched | raw | on the wire |
|---|---|---|
| 20 | 76,421 | **7.1 KB** |
| 40 | 173,192 | 14.4 KB |
| 60 | 249,561 | **20.4 KB** |

At ~12:1, over-fetching costs **13 KB per call**, and it *reduces* the quantity
[§3.4](../MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance) and
[§3.7](../MCP-PRD.md#37-undocumented-and-bot-protected-third-party-apis) actually constrain —
request **rate**. An argument retired by measurement is worth recording: the objection was stated
without checking compression, and once checked it points the other way.

**What shipped.** A page is filled to **50,000 characters**, fetching **60** variants upstream.
`ComboSearchParams.page` became `offset`; `ComboSearchData` gained **`next_offset`**, absent on
the last page. Measured live through the shipped bundle:

| query | pages | combos per page | largest page |
|---|---|---|---|
| `card:"Thassa's Oracle"` (96 combos) | **3** (5 at cap 20) | 47, 30, 19 | 49,473 |
| `cards>5 steps>5` (41 combos) | 3 | 16, 23, 2 | **49,366** (99,311 at cap 40) |

Every combo reached exactly once, none repeated. **Page size varies within a single query** — 47,
then 30, then 19, as later combos in the same result use more cards. That is the observation that
makes a fixed count indefensible rather than merely suboptimal, and no count could have produced
it.

**One guard is load-bearing.** A combo larger than the whole budget is **still returned**. Return
zero and `next_offset` equals `offset`, so the caller pages forever on an empty result: an
oversized response is a bad page, a non-advancing offset is an infinite loop. A test drives it
with a combo twice the budget.

**Done now because [Slice 17](./TrackA-Slice17.md) had not yet built on the page-number shape.**
Changing it today touched one tool; after 17 lands it would touch two plus both test suites. Its
spec is updated so it builds the final shape rather than the retired one.

## 3. `requires` costs almost nothing, on the fixtures this repo holds

[Slice 16](./TrackA-Slice16.md) requirement 10 cites **13.5 characters per variant** across the
**260** captured variants, with only **39 of 260** carrying a template at all. That figure is the
spec's and is **cited, not recomputed** — the committed fixtures are a subset and two of them are
truncated.

Measured over the 49 variants actually committed under `tests/fixtures/spellbook/` for the
`/variants/` path: **3 of 49** carry a template, costing **6.5 characters per variant** averaged.
Same conclusion, smaller sample: keeping `requires` does not meaningfully move the per-combo band,
and dropping it would lose a component the combo genuinely needs.

## 4. Where CAP-01's rules deliberately do not apply

Four inversions, each pinned by a test:

- **Zero matches is HTTP 200**, not 404, and is a successful empty result. **A 404 stays a
  failure** — porting [CAP-01](../MCP-PRD.md#cap-01--card-search)'s 404-as-empty mapping would
  report "no combos match" for a bad path.
- **[Slice 14](./TrackA-Slice14.md)'s 88-card half-page arithmetic does not transfer.**
  A true `offset` is what lets a page end wherever the byte budget runs out, stranding nothing.
- **`format` always names the format requested.** Requirement 7 refuses anything this source cannot
  judge, so there is no applied-versus-requested gap of the kind
  [CAP-01](../MCP-PRD.md#cap-01--card-search)'s `legalities_mode` has. Nobody should add one.
- **Legality values are booleans**, not `"legal"` / `"not_legal"` strings, and there is one boolean
  named `legal` rather than a map of 16 keys.

One rule **does** transfer, and it is the decision this slice took with the document's owner: a
page past the end returns `bad_request` naming the valid range, with **no `status`**, exactly as
`outOfRangeFailure` does in [`src/tools/card-search.ts`](../../src/tools/card-search.ts). Upstream
answers an out-of-range offset with a 200 whose `results` is empty and whose `count` is unchanged,
so a non-zero total beside an empty page is the signal that separates it from zero matches.

## 5. The `§3.6` guard nobody asked for

`ComboSummary.legal` is a required boolean, and `noUncheckedIndexedAccess` types
`variant.legalities[formatKey]` as `boolean | undefined`. Writing `=== true` alone would turn a key
upstream had dropped into `legal: false` — an absent key read as a claim, which
[§3.6](../MCP-PRD.md#36-error-surface) forbids and which this capability exists partly to avoid.

`resolveFormat`'s refusal makes the *format* safe; it says nothing about the *payload*. So the
handler checks the resolved key is actually present on the first returned variant and returns a
structured `unexpected` naming the format if it is not — **one check per call, not per combo**, and
`toComboSummary` keeps the signature the spec states. Every fixture variant carries all 16 keys, so
the check is currently always satisfied; a test drives it by stripping one.

## 6. Two spec verification steps are wrong as written

Both are recorded rather than worked around, because a check whose failures cannot be trusted gets
deleted — the lesson [Slice 11](./TrackC-Slice11.md)'s doc-link checker already paid for.

**Step 2**, `grep -ri "imageuri\|tcgplayer\|cardkingdom\|cardmarket" src/` "must print nothing",
**cannot pass**, because requirement 1 *requires* the header comment in
`src/spellbook/types.ts` to name those exact fields and explain why they are absent. The two
instructions contradict each other. The check's intent is "no **code** reads these fields", and in
that form it passes: **0 hits** outside comment lines.

**Step 3**, `grep -rn "mcp__plugin\|Manabase:" src/ skills/` "must print nothing", **could never
have passed**, on this slice or any other. `src/tools/register.ts` has carried a comment naming
`mcp__plugin_manabase_mtg__card_search` since the tool was first registered — it is present at
line 46 of the file on `main` before this slice. The claim the step is reaching for is that no tool
**description** carries a scoped name ([P-12](../PLUGIN-PRD.md#p-12--plugin-name-and-server-key)),
and `tests/tools/register.test.ts` asserts exactly that, over every tool definition, in both the
`mcp__plugin` and `Manabase:` forms. Code hits outside comments: **0**.

## 7. What did not change

- **No `CAP-02` criterion is marked delivered** and `Status` stays `specified`. Criteria 3, 8 and
  10 are explicitly **not** claimed outright: 3's client half was
  [Slice 15](./TrackA-Slice15.md)'s, and 8 and 10 cover both tools.
- **No [CAP-01](../MCP-PRD.md#cap-01--card-search), [PC-01](../PLUGIN-PRD.md#pc-01--scryfall-query-craft),
  [PC-02](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) or
  [PC-03](../PLUGIN-PRD.md#pc-03--mcpb-bundle-for-the-chat-tab)
  criterion changed status.** `npm run acceptance` is 13/13 live.
- **`PQ-06` did not move in either half.**
- **No `D-` decision minted**; [§2](../MCP-PRD.md#2-locked-decisions) and
  [§3](../MCP-PRD.md#3-constraints) are untouched.
- **No new npm dependency**, dev or runtime; the SDK stays a devDependency and the tool schema is
  hand-written JSON Schema `as const`.
- **No new `FailureCode`** — the six in [`src/result.ts`](../../src/result.ts) covered everything.
- **Nothing under `skills/`, `.claude-plugin/`, `mcpb/` or `.github/` changed.** In particular no
  skill edit, so [Slice 9](./TrackB-Slice9.md)'s 10/10 trigger accuracy on the current frontmatter
  stands.
- **No Scryfall call, no price field, no `imageUri*` field, no caching, no auto-paging, and no
  `combo_find_deck`.** `cacheDir` stays unused.

## 8. Traps confirmed in the doing

- **`npm test` does not typecheck.** Changing `dispatchToolCall`'s signature to take the `Clients`
  bundle is precisely the shared-interface change that goes green while broken;
  `npm run typecheck` was run before the suite was trusted, every time.
- **A substring sweep for a format name is a false-alarm generator.** `must_be_commander` contains
  `commander`, and combo descriptions carry format words in prose. The first version of the
  no-other-format assertion failed on the shaper's own field name. The claim is about JSON
  **keys**, and the sweep now matches `"key":`.
- **The stray-file artifact from [Slice 15](./TrackA-Slice15.md) recurred.** Two zero-byte files,
  `500` and `{,+`, appeared from shell redirects and were removed before staging.
  `git status --porcelain` before `git add` is the check.
- **`variants-page1.json` carries no templated variant**, no `faces > 1` card and no null
  popularity. The `requires` round-trip is driven from the **derived** `variants-page2.json`, which
  carries three; the other two cases are synthesized by spreading a real variant, the pattern
  `upstreamPage()` already uses in `tests/tools/card-search.test.ts`. Never assert a count against
  page 2 — it holds 8 results with `count` still 96.

## 9. Acceptance criteria

| # | Criterion | Result |
|---|---|---|
| 1 | `comboSearch` invoked directly, no server, no transport | **met** |
| 2 | `q` byte-identical, invented operator + quotes/spaces/colon | **met** |
| 3 | Invalid query → structured failure, verbatim message, no throw | **met** |
| 4 | No Commander Spellbook price field | **met** — sweep + typecheck, and live |
| 5 | No `imageUri*` field | **met** — sweep + typecheck, and live |
| 6 | page held to the byte budget, states `total_combos`/`has_more`/`next_offset` | **met** |
| 7 | Format stated once, one `legal` boolean, no other format's legality | **met** |
| 8 | `historic` / `standardbrawl` / `notaformat` refused with no upstream call; `EDH` and `Commander` resolve | **met, with one correction** — see below |
| 9 | Empty 200 → successful empty result; 404 stays a failure | **met** |
| 10 | Every request carries `count=true`; null count never reports `total_combos: 0` beside combos | **met** |
| 11 | A 41-result envelope returns 40 | **met** |
| 12 | `requires`, `prerequisites`, `popularity` round-trip or are omitted | **met** |
| 13 | Dispatch routes each tool to one client; `tools/list` reports two; unknown name throws | **met** |
| 14 | Missing/non-string `q` → `bad_request`, no call; wrong-typed `page`/`format` dropped | **met** |
| 15 | `npm test` passes, totals recorded | **met** — 56 / 210, from 39 / 150 |
| 16 | `npm run typecheck` clean | **met** |
| 17 | `npm run acceptance` still 13/13 | **met**, no 429 |
| 18 | `npm run build` leaves `dist/` clean, same commit | **met** — `4bf697d` |
| 19 | `lint:docs`, one §9 row, no criterion delivered, results doc | **met** |

**Criterion 8 contradicts requirement 7, and requirement 7 wins.** Requirement 7's rule is
"lowercase the input and match case-insensitively against those 16", which **resolves**
`standardbrawl` to the canonical `standardBrawl` — the case difference is exactly what
case-insensitive matching exists to absorb. Criterion 8 lists `standardbrawl` among the values that
must be refused, which is only reachable by matching case-**sensitively**, and that would refuse a
question this source can answer perfectly well. The implementation follows requirement 7: refused
are `historic`, `notaformat`, and every Scryfall-only key (`timeless`, `penny`, `duel`, `future`,
`gladiator`, `oldschool`, `tlr`); resolved are all 16 keys in any case, plus the `edh` alias. Tests
pin both halves. **The spec's criterion 8 is the line to fix**, and it is
[Slice 16](./TrackA-Slice16.md)'s own text rather than a `CAP-` criterion, so nothing binding
moved.
