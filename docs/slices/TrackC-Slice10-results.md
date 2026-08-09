# Track C — Slice 10 results: context-cost measurement

**Run date:** 2026-08-08
**Claude Code:** 2.1.226 — clears [§3.2](../PLUGIN-PRD.md#32-minimum-harness-version)'s 2.1.207 floor and the 2.1.196 floor for correct
`/context` skill-listing accounting
**Active model:** no `model` pin in user or project `settings.json` and `ANTHROPIC_MODEL` unset, so
each `claude plugin details` subprocess used the CLI default. The interactive session driving the
run reports **Opus 5 (1M context)**. Recorded as observed rather than asserted, because
[§4.6](../PLUGIN-PRD.md#46-context-cost-accounting) makes the always-on total a function of the active model
**OS:** Windows 11 Pro, 10.0.26200.8875
**Repo HEAD:** `10f3c9dc1899` on branch `docs/slice10-context-cost`
**Installed Manabase:** `be2839453a11` ([`P-08`](../PLUGIN-PRD.md#p-08--version-scheme) leaves `version` unset, so the SHA is the version).
Install path `C:\Users\User\.claude\plugins\cache\manabase\manabase\be2839453a11`
**`SKILL.md` existed:** yes — blob `fa028e778883ef20d586c436ab77d262c3977c45` in the installed copy,
byte-identical to the same path at `be2839453a11`
**Enabled plugins at the time:** exactly two, both user scope — `dotnet-plugin@dotnet-plugin`
(1.0.38) and `manabase@manabase` (`be2839453a11`)
**Tree health:** `npm test` 73 tests / 21 suites, all pass; `npm run typecheck` clean. (The spec's
[Testing requirements](./TrackC-Slice10.md) say "67 tests, 19 suites" — stale spec text, recorded
here as what actually ran and not patched from this slice.)
**Scryfall traffic:** none. This slice never starts the server or exercises a tool.

**Result:** [`PQ-01`](../PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports) **answered — MCP tool schemas do not count** toward the always-on total
`claude plugin details` reports: A₁ 258, B 258, A₂ 258, delta **0 tokens for one tool**
([Measurement 4](#measurement-4--the-pq-01-ab)). [`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) criterion 10 **satisfied**
([Measurement 1](#measurement-1--plugin-baseline-a1)). [`PC-01`](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) criterion 2 verdict:
**ambiguous-because-scaled** at ~260 against ≤250 ([Measurement 2](#measurement-2--pc-01-always-on-cost)).
[`PQ-02`](../PLUGIN-PRD.md#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed) **answered — Manabase costs ~270 resident tokens and fits with room to spare**:
the skill listing sits at 4.2k of a ~10k budget (~42%, nothing trimmed) on a 1M-context model, so
[§3.1](../PLUGIN-PRD.md#31-context-budget)'s silent degradation is **theoretical on this machine on this model** — and would be
certain on a 200k one ([PQ-02 verdict](#pq-02-verdict)).

## How this was run

**The command line that worked, verbatim and unqualified:**

```
claude plugin details manabase
```

The bare name resolved on the first attempt, exit 0. The qualified `manabase@manabase` form was
never needed. This settles the spec's requirement 9, which flagged that
[§4.6](../PLUGIN-PRD.md#46-context-cost-accounting)'s grounding measurement used the qualified form while
[`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) criterion 10 and the roadmap write the bare one. Every measurement below
used this identical line.

### The lever is the cache copy, not the working tree — and this changes the A/B

The spec's requirement 5 anticipated that "the installed plugin is a *copy in the plugin cache*,
not the working tree." It is, and more strictly than the spec assumed. `installed_plugins.json`
pins Manabase to:

```
C:\Users\User\.claude\plugins\cache\manabase\manabase\be2839453a11
  gitCommitSha: be2839453a11f3b70491261c2c09bd1125ff3727
```

That is a clone at a fixed commit, not a link to `C:\Projects\Manabase`. **Moving `.mcp.json` in
the repo would have changed nothing that `claude plugin details` reads**, and the A/B would have
reported A = B for a reason entirely unrelated to token accounting — a delta of zero manufactured
by touching the wrong file. The spec's step 2 ("move `.mcp.json` out of the plugin") therefore
means the cache copy, and that is what was moved.

Two consequences, both recorded rather than worked around:

- The repo working tree was **never modified at any point in this slice**. `git status` was clean
  before, during and after the A/B. The spec's acceptance criterion 7 is satisfied trivially rather
  than by careful restoration — but the restoration discipline still applied, to the cache copy.
- A separate full clone of the repo also exists at
  `C:\Users\User\.claude\plugins\marketplaces\manabase\` and carries its own `.mcp.json`. It was
  not touched. Only the `installPath` copy governs what the instrument reports.

### What made the harness notice: nothing

The spec's requirement 5 step 3 called this "the trap" and deliberately declined to assert whether
`/reload-plugins`, `/plugin update`, or a full reinstall would be required, asking that the answer
be determined in-session and written down.

**The answer is that no refresh step is required at all.** `claude plugin details` re-reads the
installed plugin directory from disk on every invocation. The B run was taken immediately after the
`mv`, in the next command, with no reload of any kind — and the inventory had already dropped to
`MCP servers (0)`. The spec's own evidence test for "the measurement actually happened" was met on
the first try.

This is worth carrying forward: it means the instrument is cheap to re-run at the phase boundaries
[§4.6](../PLUGIN-PRD.md#46-context-cost-accounting) asks for, with no harness state to reset between runs.

## Conditions block — shared by measurements 1–4

All four terminal measurements were taken in one uninterrupted sequence on 2026-08-08, under the
conditions in this document's preamble: Claude Code 2.1.226, no model pin, Windows 11 Pro
10.0.26200.8875, the two-plugin load above, installed Manabase `be2839453a11`, `SKILL.md` present
at blob `fa028e778883ef20d586c436ab77d262c3977c45`, `npm test` 73/21 green.

**No fallback occurred.** [§4.6](../PLUGIN-PRD.md#46-context-cost-accounting) warns that an unreachable `count_tokens` API makes the
command fall back to a character-based estimate, and the spec's requirement 8 rejects such a run.
No output carried any fallback indication, and the three A/B runs agreed exactly, which is the
condition a silent mid-experiment method switch would have broken.

## Measurement 1 — plugin baseline (A1)

Verbatim, complete:

```
Manabase (manabase)
  Magic: The Gathering card research for Claude — expressive Scryfall search with correct prices and legality. Manabase is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.
  Source: manabase@manabase

Component inventory
  Skills (1)  scryfall-query-craft
  Agents (0)
  Hooks (0)
  MCP servers (1)  mtg  (tool schemas resolved at runtime; not counted)
  LSP servers (0)

Projected token cost
  Always-on:   ~258 tok   added to every session

Per-component (rounded)
  component             always-on  on-invoke
  scryfall-query-craft       ~260      ~2.2k

  On-invoke cost is paid each time a skill or agent fires.
  Token counts are estimates and may differ from actual usage.
```

Extracted:

| Quantity | Value |
|---|---|
| Command line | `claude plugin details manabase` (bare name; exit 0) |
| Skills | 1 — `scryfall-query-craft` |
| Agents | 0 |
| Hooks | 0 |
| MCP servers | 1 — `mtg`, annotated `tool schemas resolved at runtime; not counted` |
| LSP servers | 0 |
| Plugin always-on total | **~258 tok** |
| `scryfall-query-craft` always-on | ~260 |
| `scryfall-query-craft` on-invoke | ~2.2k |
| Character-based fallback | no indication |

**[`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) criterion 10 is satisfied by this measurement**, with the dump living here and
[§9](../PLUGIN-PRD.md#9-revision-log) pointing at it by path — the resolution the spec's requirement 11 states explicitly
and the precedent [Slice 6](./TrackA-Slice6.md) set for the [`CAP-01`](../MCP-PRD.md#cap-01--card-search) live pass in
[`docs/slices/TrackA-Slice6-results.md`](./TrackA-Slice6-results.md).

**One label the spec did not anticipate.** The inventory annotates the MCP-server row in place:
`(tool schemas resolved at runtime; not counted)`. The instrument states its own accounting
behavior on its face. That is [`PQ-01`](../PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports)'s answer printed as documentation — it is recorded here
as an observation, and [Measurement 4](#measurement-4--the-pq-01-ab) tests it rather than trusting it.

**The on-invoke figure belongs to an older skill body.** The installed copy is `be2839453a11`
(PR #22) while HEAD is `10f3c9dc1899`; the drift is three files, all under `skills/` — `SKILL.md`
and the two `reference/` files, from PR #24's no-fallback rule. Verified this run: `.mcp.json`,
`.claude-plugin/`, `src/` and `dist/` are byte-identical between the two, and `SKILL.md`'s
`description` and `when_to_use` lines are identical. So **every always-on figure here is current**;
only `~2.2k` on-invoke corresponds to the shorter body. The plugin was deliberately not updated
before measuring, to avoid moving a variable inside an A/B whose only control is A₂ = A₁.

## Measurement 2 — [`PC-01`](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) always-on cost

| Quantity | Value |
|---|---|
| Reported always-on for `scryfall-query-craft` | **~260 tok** |
| Gate ([`PC-01`](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) criterion 2) | ≤250 tok |
| Plugin-level total, beside it | **~258 tok** |
| Verdict | **ambiguous-because-scaled** |

**Why ambiguous and not a pass, and not a clean fail.** [§4.6](../PLUGIN-PRD.md#46-context-cost-accounting) records that per-component
numbers are **proportionally scaled from the plugin total, not measured independently**; only the
plugin total is trustworthy. The spec's requirement 7 turns that into a rule: treat anything within
a plausible scaling error of 250 as ambiguous. ~260 is 4% over the gate and sits inside that band.

**This run supplies direct evidence for that caveat rather than merely inheriting it.** The
per-component always-on figure (~260) is **larger than the whole plugin's always-on total** (~258).
A component cannot cost more than the plugin containing it. The two numbers are not produced the
same way — one is a `count_tokens` result, the other a rounded proportional share — and this run
shows the discrepancy directly, at exactly the magnitude that decides criterion 2. Any verdict that
reads ~260 as a precise measurement is reading past what the instrument does.

**Two further notes, stated so a later reader can tell what this figure is worth.**

- **~260 exceeds even [`PC-01`](../PLUGIN-PRD.md#pc-01--scryfall-query-craft)'s own `~150–250` estimate**, at the top of which its Context cost
  bullet already placed it. The estimate is updated by this measurement, not confirmed.
- **[Slice 9](./TrackB-Slice9.md) ran first and holds the last word on the text.** The spec's requirement 7 asks
  whoever runs second to say so. Slice 9 measured a 10/10 trigger rate on this exact frontmatter and
  tuned it zero times; the frontmatter is unchanged since. **The text was deliberately not shortened
  in this slice** — decided with the author 2026-08-08. The fix, if one is wanted, is
  [Slice 8](./TrackB-Slice8.md)'s and would invalidate Slice 9's rate.

**A second instrument now agrees on the direction.** [Measurement 6](#measurement-6--the-context-breakdown)
reports `manabase:scryfall-query-craft` at **~270 tokens** in the live session listing — computed
independently of the per-component scaling that produced ~260. **No instrument available to this
slice reports the figure at or under 250; both report above it.** The verdict stays *ambiguous*
because neither number is a precise measurement, not because the evidence is balanced — criterion 2
is **not demonstrated as met**, and should not be recorded as passed.

**What a real answer would need.** A number measured for this component rather than scaled from the
total — either `count_tokens` run directly against the 763 characters of `description` +
`when_to_use`, or a `/context` reading that attributes the listing per skill. Neither is this
instrument, and neither is in this slice's scope.

## Measurement 3 — skill listing text size

Measured on the **installed** copy, in **characters** — the 1,536 cap is a character cap, not a
token cap.

| Field | Characters |
|---|---|
| `description` | 269 |
| `when_to_use` | 494 |
| **Total against the cap** | **763 of 1,536** |
| Margin | 773 |
| (`name`, not part of the cap) | 20 |

This corroborates [`PC-01`](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) criterion 1, which [Slice 8](./TrackB-Slice8.md) owns and
[Slice 9](./TrackB-Slice9.md) already recorded at 763 — the figure is reproduced here independently, from the
installed copy rather than the repo, and it agrees. No criterion-1 status changes from this slice.

It also explains [Measurement 2](#measurement-2--pc-01-always-on-cost): 763 characters against a reported ~260 tokens is
about 2.9 characters per token, which is an ordinary ratio for English prose and is consistent with
the listing text being the whole of the always-on cost. The skill is at **half** its character
budget while at or slightly over its token gate — the two limits are not proxies for each other,
and the character margin is not headroom against criterion 2.

## Measurement 4 — the [`PQ-01`](../PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports) A/B

One variable: `.mcp.json` present or absent in the installed copy. Nothing else moved — no model
switch, no plugin enabled or disabled, no Claude Code update, no edit to `plugin.json`, no edit to
the file's contents. It was **moved to scratch and moved back**, never deleted.

| Run | `.mcp.json` | Inventory: MCP servers | Plugin always-on |
|---|---|---|---|
| **A₁** | present | `1  mtg  (tool schemas resolved at runtime; not counted)` | **~258 tok** |
| **B** | moved out | **`0`** | **~258 tok** |
| **A₂** | restored | `1  mtg  (tool schemas resolved at runtime; not counted)` | **~258 tok** |

**The B run, verbatim in the part that differs** — the header, cost block and per-component table
were byte-identical to A₁:

```
Component inventory
  Skills (1)  scryfall-query-craft
  Agents (0)
  Hooks (0)
  MCP servers (0)
  LSP servers (0)

Projected token cost
  Always-on:   ~258 tok   added to every session
```

**The experiment's own control holds: A₂ = A₁ = ~258.** No run was discarded; there was no voided
attempt to record.

**The change registered.** The inventory dropped to `MCP servers (0)`, which is the spec's stated
evidence test. It did so with **no refresh step whatsoever** — see [How this was run](#what-made-the-harness-notice-nothing).

**The restore is byte-exact, not approximately.** `git hash-object` on the restored cache file
returns `0d8529b24bdb3ea7b0db0d7c92a53ac806e117eb`, identical to `git rev-parse
be2839453a11:.mcp.json`; size 132 bytes, as before. The repo working tree was never touched and
`git status` was clean throughout.

### [`PQ-01`](../PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports) verdict

**A = B. An MCP server's tool schemas do not count toward the always-on total `claude plugin
details` reports.** The delta is **0 tokens**, and because Manabase registers exactly one tool
(`card_search` — a five-line description plus a five-property JSON Schema of which only `q` is
required), that is **0 tokens per tool**, which is the form a future capability can budget against.

This is the outcome [§4.6](../PLUGIN-PRD.md#46-context-cost-accounting) already guessed at (`[inferred: … the server is not running when
the command executes, which suggests they are not counted]`). **It is a result, not a failed
experiment** — and this run upgrades the inference twice over: the instrument now states the
behavior on its own face (`tool schemas resolved at runtime; not counted`), and the controlled A/B
confirms the stated behavior matches the arithmetic.

**It does not mean the schemas are free.** They are still serialized into the model's context at
runtime, on every session in every project. It means **this instrument cannot see them**, so
[`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server)'s always-on figure remains unknown-by-this-instrument and any future budget claim
about tool schemas must come from a different one.

**The alternative instrument was then run, and it closes the question rather than leaving it open.**
[Measurement 6](#measurement-6--the-context-breakdown) reports the live session's own accounting:

```
MCP tools · /mcp (loaded on-demand)
└ 58 tools · 0 tokens

  mcp__plugin_manabase_mtg__card_search   plugin_manabase_mtg   398
```

**MCP tool schemas are deferred, not merely unreported.** They cost **0 tokens resident**; the
schema is fetched on demand, and `card_search`'s costs **398 tokens** when it is actually loaded.
So the two instruments agree for one underlying reason: `claude plugin details` reports 0 because
there is 0 always-on cost to report, exactly as its own `tool schemas resolved at runtime; not
counted` annotation says.

**This retires the concern [`PQ-01`](../PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports) was raised to test.** That question's stated stake was
that a tool schema, unlike a skill description, **cannot be budget-trimmed** — so if schemas were a
real always-on cost, tool count and description length would become a standing context-budget
constraint on every future capability. They are not an always-on cost at all: they are deferred, so
the trimming asymmetry never arises. The roadmap's [Slice 5](./TrackA-Slice5.md) warning to "keep
tool count and description length lean" reverts from a budget constraint to ordinary prudence about
the on-demand payload, and `MCP-PRD.md`'s [`OQ-01`](../MCP-PRD.md#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) does **not** gain the
cost side the spec's requirement 5 sketched for the A ≠ B branch. It stays answered as
[Slice 9](./TrackB-Slice9.md) left it.

**Two limits on that conclusion, stated so it is not over-read.**

- **Deferral is the default, not a guarantee.** A server can opt out and have its schemas loaded
  resident. Manabase does not, and a future capability must not, or 398 tokens per tool becomes a
  real always-on cost after all.
- **This is the Claude Code surface only.** Whether the Chat tab defers an MCPB bundle's schemas
  the same way is unmeasured, and [`P-12`](../PLUGIN-PRD.md#p-12--plugin-name-and-server-key)'s lesson is that per-surface behavior
  differs. Do not carry the 0 to that surface without measuring it there.

**The per-tool figure a future capability should budget against is therefore 398 on-demand tokens,
0 resident** — for one tool with a five-line description and a five-property schema of which only
`q` is required. That is the number the spec asked for, in the form it asked for it.

**What this means for future capabilities.** The branch that occurred is the benign one. The
roadmap's [Slice 5](./TrackA-Slice5.md) warning — "keep tool count and description length lean" — does **not**
become a standing always-on budget constraint on the strength of this measurement, because the cost
was never established, only shown to be invisible here. `MCP-PRD.md`'s
[`OQ-01`](../MCP-PRD.md#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) does not gain the cost side the spec's requirement 5 sketched for the A ≠ B branch;
it stays answered as [Slice 9](./TrackB-Slice9.md) left it. Nothing in this slice edits
[`docs/MCP-PRD.md`](../MCP-PRD.md), and nothing here reopens that question.

## Measurement 5 — the instrument PQ-02 names does not exist as described

**This is the slice's most consequential finding about its own method.**

[`PQ-02`](../PLUGIN-PRD.md#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed) says it resolves by "`/doctor`, which estimates the skill listing's cost against
the budget and names its biggest contributors." On Claude Code 2.1.226, **`/doctor` is a
health-check workflow** — installation diagnostics, unused-extension detection, `CLAUDE.md`
trimming proposals, permission-rule proposals. It contains a context-accounting check, but it does
not print a skill-listing cost against a budget, and it does not name listing contributors.

Two consequences, and neither is worked around:

- **[`PQ-02`](../PLUGIN-PRD.md#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed)'s stated resolution method is wrong as written**, and so is the same claim
  where [§4.6](../PLUGIN-PRD.md#46-context-cost-accounting) and [`PQ-04`](../PLUGIN-PRD.md#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed) repeat it. [§4.6](../PLUGIN-PRD.md#46-context-cost-accounting) is a dated research record and
  is not overwritten; this is recorded here and, per the spec's requirement 10, belongs there as a
  **dated addendum** rather than a correction.
- **[`PQ-04`](../PLUGIN-PRD.md#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed)'s follow-up is answered, and negatively.** That question asked this slice to
  confirm whether `/doctor` names this plugin among the listing's biggest contributors. **It does
  not name contributors at all.** [`PQ-04`](../PLUGIN-PRD.md#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed)'s answer already anticipated this exactly — it
  declined to claim `/doctor` would name the plugin and wrote the README line to read correctly
  either way. That caution was justified. The README line ([Slice 12](./TrackC-Slice12.md)'s task)
  needs no change; its final "Run `/doctor` to confirm whether trimming is what happened" sentence
  is the part that no longer holds, and sharpening it is that slice's call.

The health-check workflow was **not run** — decided with the author 2026-08-08. Its cleanup actions
edit settings, disable plugins and trim memory files, all of which would modify the harness
mid-slice and invalidate the measurements above. The spec's *Out of scope* is explicit: "Do not
leave the harness modified."

## Measurement 5a — aggregate always-on under the author's full load

The substitute instrument is the one this slice already trusts: `claude plugin details`, run
against every enabled plugin. This is a **pre-budget** figure — the cost of the listing text as
computed, before [§3.1](../PLUGIN-PRD.md#31-context-budget)'s cap is applied.

| Plugin | Skills | Always-on |
|---|---|---|
| `dotnet-plugin@dotnet-plugin` (1.0.38) | 20 | **~1,722 tok** |
| `manabase@manabase` (`be2839453a11`) | 1 | **~258 tok** |
| **Combined** | **21** | **~1,980 tok** |

**[§4.6](../PLUGIN-PRD.md#46-context-cost-accounting)'s grounding measurement reproduces exactly.** It recorded ~1,722 always-on across
20 skills for `dotnet-plugin` on Claude Code 2.1.220; this run gets **~1,722 on 2.1.226**, with the
same 20-skill inventory. [§4.6](../PLUGIN-PRD.md#46-context-cost-accounting) warns that its figures are only as durable as the accounting
behind them — on this evidence the accounting was stable across six patch versions. That is a
corroboration of the reference point, recorded because a later session may need to know whether
[§4.6](../PLUGIN-PRD.md#46-context-cost-accounting) still applies.

**Manabase is 13.0% of the installed plugin load while carrying 1 of 21 skills.** Its ~260 sits
above the top of `dotnet-plugin`'s observed ~30–230 per-skill band, making it the single most
expensive skill on this machine. That is by design, not a defect: [`PC-01`](../PLUGIN-PRD.md#pc-01--scryfall-query-craft)'s own Context
cost bullet predicted "at or slightly above the top of the observed band", because the skill must
match requests phrased as plain Magic questions that never say "Scryfall" or "search syntax". The
prediction is confirmed. It is also why [Measurement 2](#measurement-2--pc-01-always-on-cost)'s gate is tight.

**One correction to this document's own earlier claim about the command line.** The bare-name form
is not universal: `claude plugin details dotnet-plugin` fails with `Plugin "dotnet-plugin" not
found`, while `dotnet-plugin@dotnet-plugin` succeeds. Bare works for Manabase because the name is
unambiguous. The spec's requirement 9 is answered as **"bare works here"**, not "bare always
works" — which matters for a re-run at a later phase boundary on a machine with more plugins
installed.

### The budget is a fraction, not a constant

[§3.1](../PLUGIN-PRD.md#31-context-budget) records `skillListingBudgetFraction` as defaulting to `0.01` — **1% of the context
window**. The window is a property of the active model, so the same install sits in very different
places depending on which model is running:

| Context window | Listing budget (1%) | ~1,980 tok against it |
|---|---|---|
| 1M | ~10,000 tok | ~20% used — comfortable |
| 200k | ~2,000 tok | ~99% used — on the line |

[`PQ-02`](../PLUGIN-PRD.md#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed) asks whether [§3.1](../PLUGIN-PRD.md#31-context-budget)'s silent degradation is "a live risk or a theoretical
one" **on this machine**, and this measurement says the question is underspecified: on this machine
it is theoretical on a 1M-context model and marginal on a 200k one, with no change to what is
installed. Any answer written without naming the model is not reproducible. This also sharpens
[§4.6](../PLUGIN-PRD.md#46-context-cost-accounting)'s existing instruction that a different model is a different number — it is a
different number on *both sides* of the comparison, not only the numerator.

## Measurement 6 — the context breakdown

Taken by the author in a live session, 2026-08-08, same conditions as above. Verbatim summary rows
as rendered:

```
Context Usage                                    Opus 5 (1M context)
                                                 claude-opus-5[1m]
                                                 179.9k/1m tokens (18%)

Estimated usage by category
  System prompt:    4k tokens (0.4%)
  System tools:     22.1k tokens (2.2%)
  Custom agents:    2.5k tokens (0.2%)
  Memory files:     11.9k tokens (1.2%)
  Skills:           4.2k tokens (0.4%)
  Messages:         135.9k tokens (13.6%)
  Free space:       819.5k (82.0%)

MCP tools · /mcp (loaded on-demand)
└ 58 tools · 0 tokens

Custom agents · .claude/agents/
└ 11 agents · 2.5k tokens

Memory files · /memory
└ 1 file · 11.9k tokens

Skills · /skills
└ 47 skills · 4.2k tokens
```

Rows relevant to this slice, from the expanded tables:

```
Skills
  manabase:scryfall-query-craft   Plugin (manabase)   ~270

MCP Tools
  mcp__plugin_manabase_mtg__card_search   plugin_manabase_mtg   398

Memory Files
  Project   C:\Projects\Manabase\CLAUDE.md   11.9k

Custom Agents
  doc-sync   Project   110
```

### The Skills row against the budget

| Quantity | Value |
|---|---|
| Active model | `claude-opus-5[1m]` — **1M context window** |
| Skill listing, post-budget | **4.2k tokens** across **47 skills** |
| Budget ([§3.1](../PLUGIN-PRD.md#31-context-budget)'s `skillListingBudgetFraction` = 0.01 of the window) | **~10,000 tokens** |
| Fraction of budget used | **~42%** |
| Headroom | **~5.8k tokens** |
| Any description trimmed? | **No** |

**Nothing is trimmed, and that is a positive signal rather than an absent error.** All 47 skills
appear in the session listing carrying their full descriptions, and `/skills` reports every one
`on`. [§3.1](../PLUGIN-PRD.md#31-context-budget)'s degradation drops descriptions and keeps names, so a trimmed listing would
show name-only entries; none do. Pre-budget and post-budget listing size are therefore the same
number here.

### Where the listing budget actually goes

Summing the per-skill figures in the expanded table by source:

| Source | Skills | Tokens | Share of listing |
|---|---|---|---|
| Built-in (`dataviz`, `code-review`, `artifact-*`, …) | 16 | ~2,180 | **~52%** |
| `dotnet-plugin` | 20 | ~1,540 | ~36% |
| User skills (`plan`, `portfolio-*`, …) | 10 | ~250 | ~6% |
| **`manabase`** | **1** | **~270** | **~6%** |
| Project (`doc-sync`) | 1 | ~30 | ~1% |
| **Total** | **47** | **~4,270 ≈ 4.2k** | 100% |

**More than half the shared budget is consumed by built-in skills no plugin controls.** That is the
single most useful thing this measurement says about [§3.1](../PLUGIN-PRD.md#31-context-budget)'s budget: the headroom available
to installed plugins is materially smaller than the raw budget suggests, and it shrinks whenever
Claude Code ships more built-ins — without any user action and with no signal to the user.

### The two instruments disagree by about 9%, and neither is wrong

| Plugin | via `claude plugin details` | via `/context` |
|---|---|---|
| `dotnet-plugin` | ~1,722 | ~1,540 |
| `manabase` | ~258 (plugin) / ~260 (component) | ~270 |
| Combined | ~1,980 | ~1,810 |

Both are labelled estimates by their own output. `/context` is the authority on what is **resident
in a live session after the budget is applied**; `claude plugin details` is the authority on **what
a plugin contributes in isolation**, and it is the only one of the two that runs without a session.
Record both and do not average them. The spread is the practical size of "estimates and may differ
from actual usage."

## Measurement 7 — control — not taken

Optional in the spec, and explicitly a **control** rather than [`PQ-02`](../PLUGIN-PRD.md#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed)'s answer. Disabling
`dotnet-plugin` would have modified the harness, which this slice forbids, and
[Measurement 5a](#measurement-5a--aggregate-always-on-under-the-authors-full-load) already isolates
Manabase's contribution exactly (~258 of ~1,980, or ~270 of 4.2k in the live listing) without
disabling anything — the same delta the control would have produced, obtained by arithmetic on
independent per-plugin measurements rather than by perturbing the machine.

## PQ-02 verdict

**Manabase's measured always-on cost is ~270 tokens in a live session (~258 by the offline
instrument), and it fits alongside the author's existing load with room to spare.**

The complete resident cost a *user* pays for installing Manabase, on the Claude Code surface:

| Component | Resident cost | Note |
|---|---|---|
| [`PC-01`](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) skill listing entry | **~270 tok** | the whole of the always-on cost |
| [`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) tool schema (`card_search`) | **0 tok** | deferred — see [the PQ-01 verdict](#pq-01-verdict) |
| **Total** | **~270 tok** | ~2.7% of the ~10k listing budget on a 1M model |

The `doc-sync` custom agent (~110 tok) is **not** part of that total: it lives in `.claude/`, which
is dev-only config rather than a plugin component surface, so it costs this repo's author and no
user. `/context` attributes it to `.claude/agents/` and to source `Project`, which is the positive
confirmation that the dev-only placement works as intended — a subagent shipped under a root
`agents/` would instead install into every user's harness.

**Is [§3.1](../PLUGIN-PRD.md#31-context-budget)'s silent degradation live or theoretical on this machine? Theoretical — on this
model.** The listing sits at ~42% of budget with ~5.8k tokens of headroom and nothing trimmed.
Manabase's ~270 is ~2.7% of the budget; removing it entirely would not change whether trimming
occurs.

**The qualifier is load-bearing and must not be dropped when this is quoted.** The budget is 1% of
the *context window*, and the window is a property of the active model. The same install, unchanged,
on a 200k-context model would face a ~2,000-token budget against a ~4,200-token listing — **more
than double the budget, so trimming would be certain**, and the first descriptions dropped would be
the least-used skills. [`PQ-02`](../PLUGIN-PRD.md#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed) asks whether the risk is live "on this machine"; the honest
answer is that on this machine it depends on which model the session is running, and the 1M window
is what makes it theoretical. A future session that re-runs this on a 200k model and finds trimming
has not contradicted this result.

**What would change the answer.** Installing another plugin the size of `dotnet-plugin` (~1,540–1,722)
would put the listing near ~5.8k against ~10k — still clear on a 1M model. The realistic path to
overflow here is not another plugin but a smaller context window, and secondarily the growth of the
built-in set, which already holds ~52% of the listing and is outside any user's or plugin author's
control.

## Findings for later slices

1. **The installed plugin is a pinned clone in the plugin cache, keyed by commit SHA.** Anything
   that means to measure, probe, or perturb "the installed plugin" must act on
   `installed_plugins.json`'s `installPath`, not on the working tree. A measurement taken against
   the repo would look valid and mean nothing. This is the same class of silent-wrong-answer as the
   frontmatter defect and the dropped-invalid-term behavior.
2. **`claude plugin details` re-reads from disk every invocation** — no reload, update, or
   reinstall is needed for a change to the installed copy to show up. Re-running it at the phase
   boundaries [§4.6](../PLUGIN-PRD.md#46-context-cost-accounting) asks for is cheap and leaves no harness state to reset.
3. **A per-component always-on figure can exceed the plugin total.** Observed here: ~260 against
   ~258. [§4.6](../PLUGIN-PRD.md#46-context-cost-accounting)'s proportional-scaling caveat is not theoretical, and any criterion written
   as a threshold on a per-component figure inherits that imprecision. Worth knowing before a
   future criterion is written that way.
4. **Character budget and token gate are independent.** The skill sits at 763 of 1,536 characters —
   half its budget — while at or over its ≤250-token gate. Do not read character headroom as token
   headroom.
5. **The installed copy drifted from HEAD by two PRs of skill body without any always-on effect.**
   Body edits move on-invoke only. A slice that needs a current on-invoke figure must update the
   plugin first; a slice that needs always-on does not.
6. **MCP tool schemas are deferred on the Claude Code surface — 0 resident, 398 on demand for
   `card_search`.** This is why the [`PQ-01`](../PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports) A/B showed no delta. It is a property of the harness's
   default, not a guarantee: a server that opts out of deferral pays the 398 every session, and the
   behavior is unmeasured on the Chat tab. A future capability budgets **on-demand** tokens per
   tool, not always-on ones.
7. **Over half the skill-listing budget belongs to built-in skills** — ~2,180 of ~4,270 tokens, 16
   of 47 entries. The headroom available to installed plugins is smaller than the raw 1% budget
   suggests, and it shrinks whenever Claude Code ships more built-ins, silently and with no user
   action. Any future claim about listing headroom should be stated against the *remaining* budget,
   not the whole of it.
8. **The listing budget is a fraction of the context window, so the answer to "is trimming a live
   risk?" is model-dependent.** The same install is at ~42% of budget on a 1M model and would be at
   ~210% on a 200k one. Never record a headroom figure without the model beside it — and note that
   [§4.6](../PLUGIN-PRD.md#46-context-cost-accounting)'s existing "a different model is a different number" caveat understates this: the
   model moves the *budget* as well as the measurement.
9. **`claude plugin details` and `/context` disagree by about 9% on the same plugins**, and each is
   authoritative for a different question — isolated contribution versus live post-budget residency.
   Record both; do not average them, and do not treat a figure from one as refuting the other.
10. **`/doctor` is a health-check workflow, not a budget report.** Three places in
    [`docs/PLUGIN-PRD.md`](../PLUGIN-PRD.md) describe it as the instrument that prices the skill
    listing and names its contributors. It does neither. Any future question that proposes to
    resolve "by `/doctor`" needs a different instrument named — `/context` is the one that works.
