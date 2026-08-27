# OQ-14 combo-search eval — results

**Run date.** 2026-08-25. Executed per [`OQ14-combo-eval-protocol.md`](./OQ14-combo-eval-protocol.md).
Subject agent `oq14-baseline` (no `Skill` tool, by construction). 12 cases from
[`evals/combo-evals.json`](../../evals/combo-evals.json) × 2 configurations = 24 runs, each in its
own fresh subagent, dispatched **strictly one at a time**. Skill under test:
[`skills/spellbook-combo-craft/`](../../skills/spellbook-combo-craft/SKILL.md). Grading is binary,
no partial credit, burden of proof on the expectation, read from each run's `TOOL_CALLS` block and
**not** its prose (Slice 9 grader stance).

## Headline

| | `without_skill` | `with_skill` |
|---|---|---|
| Expectations passed | **37 / 46** | **45 / 46** |
| Cases fully passed (all expectations) | **7 / 12** | **11 / 12** |

The skill measurably helps, and the help is **concentrated on two axes** — query craft beyond
`card:` (axis 2) and error recovery (axis 4). It changes **nothing** on tool selection (axis 1) or
paging discipline (axis 3): the baseline was already perfect there, exactly as `OQ-01` found
`card_search`'s baseline well-equipped by the tool description. Four cases flipped fail→pass with
the skill (**4, 5, 6, 10**); the one remaining `with_skill` miss (case 7, expectation 2) is a soft,
arguable over-specification that the baseline missed identically.

## Per-axis with-vs-without delta

| Axis | Cases | `without_skill` | `with_skill` | Verdict |
|---|---|---|---|---|
| **1. Tool selection** (combo vs card vs both) | 1, 2, 3, 12 | 4/4 cases pass | 4/4 cases pass | **No difference** — both configs route every case correctly |
| **2. Query craft beyond `card:`** (`result:`, `steps:`, `commander:`, `ci:`, in-query) | 4, 5, 6, 9 | **1/4 cases pass** | **4/4 cases pass** | **Skill wins decisively** — 3 flips (4, 5, 6) |
| **3. Paging discipline** (`next_offset`, never compute, don't walk) | 7, 8 | 1/2 cases pass | 1/2 cases pass | **No difference** — both page correctly; both soft-miss the browse case identically |
| **4. Recovery / empty** (loud failure is correctable; empty is a success) | 10, 11 | **1/2 cases pass** | **2/2 cases pass** | **Skill wins decisively** — the case-10 flip is the single largest |

## Did the skill load and get followed?

Yes. All 12 `with_skill` runs reported `SKILL_CONSULTED: yes` **and** exhibited behavior the
baseline did not: the operators `result:`, `steps:`, `commander:`, `ci:`, the `oracleid:` join to
price pieces, the `legal:` filter, and the "read `details`, fix the character, call again"
recovery loop all appear only in the `with_skill` transcripts. Several runs cited the skill by name
in prose ("per the skill's decision table", "per the skill's zero-match guidance"). Because the
subject reads the file by path, `SKILL_CONSULTED: yes` **plus** these behavior deltas is the
evidence the skill was actually followed, not merely opened — the Slice 8 lesson (a `SKILL.md` that
parses is not a skill that works) is satisfied here by the behavior change, not by the parse.

## Live-traffic note

- **~48 live upstream calls total** (~25 `without_skill`, ~23 `with_skill`; combo + card searches),
  every run's tool calls made sequentially inside a single subagent, and the 24 subagents dispatched
  one at a time.
- **No HTTP 429 and no rate-limit error was reported by any subagent.** The politeness rule held.
- The only 400s were the two deliberate bad-operator probes in cases 4 and 10 (`produces:` /
  `produces=`), which are the point of the error-recovery axis, not rate-limit events.

---

## Per-case detail

Legend: q / `format` / `offset` are the emitted arguments. ✓ = expectation met, ✗ = not met.

### Axis 1 — tool selection

**Case 1** — "what can I do with Thassa's Oracle?"
- `without`: `combo_search {q:"card:\"Thassa's Oracle\""}` → 96 combos. **4/4 ✓** (combo not card; `card:` names it; answered from combo payload; named Demonic Consultation/Tainted Pact/Doomsday from payload).
- `with`: identical query. **4/4 ✓**.

**Case 2** — "cheap red creatures, 1–2 mana, under a dollar, standard aggro"
- `without`: `card_search {q:"t:creature c:r cmc<=2 usd<1 f:standard"}`. **3/3 ✓** (card not combo; no combo_search; red + mv + USD ceiling all present).
- `with`: `card_search` with `c:r` then `c=r`, same constraints; cited the skill's combo-vs-card table explicitly. **3/3 ✓**.

**Case 3** — "two-card Kiki-Jiki combos, and what the second piece costs"
- `without`: `combo_search {q:"card:\"Kiki-Jiki, Mirror Breaker\""}` → 756; then `card_search` (by name) for prices. **4/4 ✓**.
- `with`: `combo_search {q:"card:\"Kiki-Jiki, Mirror Breaker\" cards<=2"}` → 78; then `card_search` by `oracleid:` join. **4/4 ✓** — tighter craft (pre-filtered to two-card; `oracleid:` join).

**Case 12** — "does Demonic Consultation combo to win on the spot, legal in commander?"
- `without`: `combo_search {q:"card:\"Demonic Consultation\""}` → 9. **4/4 ✓** (legality read from `legal` field, default commander).
- `with`: `combo_search {q:"card:\"Demonic Consultation\" result:\"win the game\""}` → 5. **4/4 ✓** — `result:` tightened the set.

### Axis 2 — query craft beyond `card:`

**Case 4** — "cheapest simplest two-card infinite mana combos, no setup" — **FLIP**
- `without`: **2/4 ✗** on expectations 3 & 4. Six combo calls: tried `produces:"infinite mana"` (400), bare `infinite mana` (matched card names, 25), `infinite mana cards=2` (0), landed on bare `cards=2` (3993) and **hand-filtered for infinite mana** — never found a working `result:` term, never constrained the produced result in-query.
- `with`: **4/4 ✓**. `combo_search {q:"cards<=2 result:\"infinite mana\" steps<=2"}` (2), then `{q:"cards<=2 result:\"infinite mana\" pre<=1"}` (324). Both `cards<=2` and `result:"infinite mana"` inside q.

**Case 5** — "Temur, win outright, two or three steps max" — **FLIP**
- `without`: **3/5 ✗** on expectations 4 & 5. `combo_search {q:"id:temur result:win cards<=3"}` — color identity ✓ (`id:` alias), `result:` ✓, but constrained **`cards<=3` instead of `steps<=3`** — conflated pieces with steps; no steps operator emitted.
- `with`: **5/5 ✓**. `combo_search {q:"ci:temur result:\"win the game\" steps<=3"}` — all three constraints (`ci:`, `result:`, `steps<=3`) in q.

**Case 6** — "combos built around commander Kenrith" — **FLIP**
- `without`: **2/3 ✗** on expectation 2. `combo_search {q:"card:\"Kenrith, the Returned King\""}` — used only a generic `card:` term, never the `commander:` operator.
- `with`: **3/3 ✓**. Emitted `combo_search {q:"commander:\"Kenrith, the Returned King\""}` (→ 0, a valid empty; Spellbook flags no combo commander-scoped to Kenrith), then correctly broadened to `card:` (→ 380). The `commander:` term was emitted; the zero-match was handled as success, not error.

**Case 9** — "Isochron Scepter combos actually legal in pioneer?"
- `without`: **4/4 ✓**. `combo_search {q:"card:\"Isochron Scepter\"", format:"pioneer"}` → 304, all `legal:false`; corroborated with a `card_search`. The `format` parameter is named in the tool description, so the baseline had it.
- `with`: **4/4 ✓**. Added the `legal:pioneer` filter operator alongside `format:"pioneer"` — more sophisticated, same result.

### Axis 3 — paging discipline

**Case 7** — "browse infinite-token combos, sense of what's out there" — **no tally difference**
- `without`: **3/4** — soft-✗ on expectation 2. Flailed on syntax (`infinite tokens`→0, `tokens`→0, then `result:tokens`→27,829) before landing a `result:` term; then presented page 1 and offered to narrow. Never computed an offset, never walked pages (✓ 3, 4).
- `with`: **3/4** — soft-✗ on expectation 2. Cleaner: `result:"infinite tokens"`→0 (recognized as empty), loosened to `result:"infinite token"`→113 per the skill's zero-match rule; presented page 1, offered narrowing operators.
- **Both configs neither narrowed the live query nor paged** on this pure-browse request — they presented one page and offered to narrow. Expectation 2 lists *narrow OR page* as the only satisfying actions, so under the strict stance both soft-fail identically. Arguably the expectation over-specifies for a "just browsing" request, where presenting one organized page and offering to narrow is the ideal. **The skill still improved craft** (2 calls vs 3, reached `result:` immediately, cleanly handled the empty), just not the pass/fail tally.

**Case 8** — "full list of every Thassa's Oracle combo, all pages"
- `without`: **4/4 ✓**. `card:"Thassa's Oracle"` → offset 47 → offset 77 → stop. Each offset echoed from the prior `next_offset`; stopped on `has_more:false`.
- `with`: **4/4 ✓**. Identical paging.

### Axis 4 — recovery / empty

**Case 10** — "run this exactly: `card:\"Thassa's Oracle\" produces:win`" — **FLIP (largest)**
- `without`: **1/4 ✗** on expectations 2, 3 & 4. Ran the query (400, `unexpected character : at position 32`), then **stopped and asked the user how to proceed** — no revised call, no results presented. Over-indexed on "run this exactly."
- `with`: **4/4 ✓**. Ran it verbatim (400), then immediately issued `combo_search {q:"card:\"Thassa's Oracle\" result:\"win the game\""}` (96), replacing `produces:` with the valid `result:`, and answered from the successful call. The skill's "fail loudly → read `details` → fix that character → call again" guidance is exactly what produced the recovery.

**Case 11** — "two-card combos that win for zero mana, literally free"
- `without`: **3/3 ✓**. `combo_search {q:"cards=2 mv=0"}` (77) then `{q:"cards=2 mv=0 result:\"win the game\""}` (2); reported the 2 real combos honestly, no fabrication.
- `with`: **3/3 ✓**. `combo_search {q:"cards=2 result:\"win the game\""}` (163), paged offset 59; read `mana_value_needed` from payloads and reported honestly with caveats.
- *Note:* neither run actually received `total_combos:0`, so the empty-result branch of this axis was not exercised here — but cases 6 and 7 `with_skill` **did** hit genuine zero-match results and the skill handled both as successes (loosen, don't error), a bonus not captured in the case-11 tally.

---

## OQ-14 verdict

**The `spellbook-combo-craft` skill measurably helps, on axes 2 and 4 specifically.** It flips four
cases (4, 5, 6, 10) from fail to pass, lifting fully-passed cases from 7/12 to 11/12 and
expectations from 37/46 to 45/46. The wins are all cases where the user names a combo property the
**`combo_search` tool description does not name an operator for** — a produced result
(`result:`), a step count (`steps:`), a commander scope (`commander:`) — or where a query must be
**recovered** from a loud upstream rejection. This mirrors `OQ-01` precisely: the skill wins where
the surface vocabulary falls short of the user's phrasing and where a failure must be turned into a
retry, and it wins **nowhere else**.

**Where the skill does *not* earn its keep:**

- **Axis 1 (tool selection)** — the skill's billed "clearest expected contribution" (it is
  cross-tool, so the tool description structurally cannot teach it) — showed **no measurable
  effect**: the baseline routed all four cases correctly on model priors plus the two tool
  descriptions. The combo-vs-card decision table is defensive insurance, not a demonstrated lift in
  these 12 cases.
- **Axis 3 (paging)** — the `combo_search` description already carries the
  `total_combos`/`has_more`/`next_offset` contract, and the baseline executed it perfectly (case 8)
  and avoided every offset-computation antipattern (cases 7, 8). The skill's paging prose changed
  no tally.

**What this argues for (the `OQ-01` question, applied to combos):**

1. **The strongest lever is the MCP-PRD half of `OQ-14`, not the skill.** The four flips are all
   operator/recovery knowledge. `card_search`'s tool description names its operators (`t:`, `o:`,
   `f:`, `cmc`, `usd`, `otag:`, `art:`, regex) and that is *why* its baseline was well-equipped.
   `combo_search`'s description names `card:"…"` as the common case but **does not name `result:`,
   `steps:`, `commander:`, or `ci:`**. Adding those four operator names to the `combo_search`
   description in [`src/tools/register.ts`](../../src/tools/register.ts) would plausibly close cases
   4, 5 and 6 for the baseline — the same shorter-skill/richer-description trade `OQ-01` surfaced.
   This is a concrete, testable recommendation for the tool-description half of `OQ-14` and the one
   the data speaks to most directly.
2. **Even with a richer description, the skill retains a distinct contribution the description
   cannot absorb:** the case-10 recovery loop (fail loudly → fix → retry, bounded) and the
   zero-match-is-success handling (cases 6, 7). A one-line schema description is the wrong place for
   a multi-step recovery procedure; that content justifies the skill's continued existence.
3. **The tool-selection and paging sections are candidates for trimming, not expansion.** They
   showed no measured lift here. Before cutting, weigh that the trigger/description frontmatter is
   what makes the skill fire at all — do not shorten frontmatter without re-measuring trigger
   accuracy (the Slice 9 precedent: shortening the body is a separate edit that can invalidate the
   trigger rate).

**Bottom line:** the skill works, is followed when loaded, and earns its keep on query craft and
recovery. The most cost-effective *next* move suggested by the data is to enrich the `combo_search`
tool description with the `result:` / `steps:` / `commander:` / `ci:` operator names and re-run this
protocol — the skill's remaining, irreducible value would then be the recovery and empty-result
discipline, which points toward a leaner skill body rather than a longer one.

## Scope

This is measurement, not a status change. It informs the plugin-side (skill) half of `OQ-14` and
does **not** resolve the MCP-PRD half (the tool-description question) — though recommendation 1
above is exactly the input that half needs. No `CAP`, `PC`, or slice acceptance criterion changes
status from this run.
