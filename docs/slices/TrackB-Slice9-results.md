# Track B — Slice 9 results: [PC-01](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) measured against a without-skill baseline

**Run date:** 2026-08-04
**Node:** v22.17.1 (unchanged since [Slice 6](./TrackA-Slice6-results.md))
**Claude Code:** 2.1.222
**OS:** Windows 11 Pro 10.0.26200
**Repo HEAD:** `be28394`, clean; `npm run typecheck` clean, 73/73 tests, `npm run build` leaves
`dist/index.js` byte-identical to the committed blob.
**Plugin under measurement:** installed from the marketplace at `be2839453a11` — the same commit as
HEAD. `diff -r` confirms the installed `skills/` tree is identical to the repo's.
**Deliverables:** [`evals/evals.json`](../../evals/evals.json) (17 behavioral cases),
[`evals/trigger-evals.json`](../../evals/trigger-evals.json) (20 trigger queries), this document.
**Result:** [PC-01](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) criteria **5–11 and 13 measured
with a baseline**; **criterion 12 measured in the baseline only** and recorded as *not measured*
with the skill, for the reason in [Criterion 12](#criterion-12--structured-failure--revised-retry).
The compact-description split **holds, but not because the skill carries the operator families** —
see the [OQ-01 verdict](#oq-01-verdict).
**Scryfall traffic:** ≈93 live `card_search` calls, strictly sequential, one subagent at a time,
never more than one call per second. 4 deliberate HTTP 400s (cases 13–14 and two exploratory regex
probes). **No HTTP 429 was observed or provoked** ([MCP-PRD §3.4](../MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance)
honored).
**Skill changes:** none. Both trigger rates were perfect, so no description tuning was triggered,
so no run was voided and every number below comes from **one single full run** per configuration.

## How this was run

`skill-creator`'s schema was re-read in-session from
`~/.claude/plugins/marketplaces/claude-plugins-official/plugins/skill-creator/skills/skill-creator/`
before any JSON was written ([spec](./TrackB-Slice9.md) requirement 3).

**The `expectations` vs `assertions` question is settled.** `references/schemas.md` defines
`evals.json` with **`expectations`**, and `agents/grader.md` — the component that actually reads
them — takes `expectations` as input and emits `grading.json` with `{text, passed, evidence}`.
`assertions` appears only in `eval_metadata.json`, which the aggregator reads for `eval_id` alone.
`expectations` is the key; that is what [`evals/evals.json`](../../evals/evals.json) uses.

The grader's stated stance — binary, no partial credit, **burden of proof on the expectation** —
was adopted for the hand-grading here.

### Held-out check ([spec](./TrackB-Slice9.md) requirement 5)

`SKILL.md` and both `reference/` files were grepped for each of the 37 prompts' distinctive
phrasing before the first run. **Four behavioral prompts collided** with mappings the skill teaches
verbatim, and were replaced. The replacements are what
[`evals/evals.json`](../../evals/evals.json) carries:

| # | Spec prompt | Collides with | Replacement used |
|---|---|---|---|
| 4 | rules text *starts* with tapping for mana | `SKILL.md` worked example 3 **and** `recipes.md` regex row 1 (`o:/^{T}: Add/`) | text whose first words are "whenever you cast" |
| 5 | "draw a card" as the last thing in the text | `recipes.md` regex row 3 (`o:/draw a card\.$/`) | text ending with "you gain that much life" |
| 7 | ramping in green | `description` + `SKILL.md` worked example 1 + three `recipes.md` rows (`otag:ramp`) | a white deck answering an artifact |
| 10 | squirrels in the artwork | `description` ("cards with squirrel art") + `recipes.md` artwork row 1 (`art:squirrel`) | frogs in the artwork |

Cases 1 and 8 touch families the skill necessarily teaches (budget-commander, `function:removal`)
but reuse none of its phrasing, so they were kept. That is a judgment call and is recorded as one.

Behavioral prompts and trigger queries are disjoint.

### Configurations

Both configurations had the search tool available under the **same** scoped name,
`mcp__plugin_manabase_mtg__card_search` — the server was never run standalone, so there is **no
tool-name confound** in this run. Each case ran in its own fresh isolated subagent; no subagent was
reused between cases or configurations, and no case ran in a session that had edited `SKILL.md`.

- **with_skill** — the subagent was pointed at the installed `SKILL.md` and told to follow it.
- **without_skill** — the same prompt with that paragraph removed.

### The baseline mechanism, and the attempt that failed

**Attempt 1 — omit the skill path from the subagent prompt** (`skill-creator`'s own shape).
**This failed, exactly as the plan's Finding 4 predicted.** The first baseline case's *first tool
call* was `Skill{"skill": "manabase:scryfall-query-craft"}`. The skill is in the subagent's
available-skills listing whether or not the prompt mentions it, and it auto-invoked. That case was
**voided and re-run**, not caveated.

**Attempt 2 — a subagent type with no `Skill` tool.** A `.claude/agents/slice9-baseline.md` with a
`tools:` list omitting `Skill` was written, but the agent registry resolves at session start, so a
file created mid-session is not dispatchable. The file was deleted and `.claude/` verified clean.
**Recorded because the next session should not re-derive it:** this is the clean mechanism, and it
works only if the agent file exists *before* the session that measures.

**Attempt 3 — used for every baseline case below.** Omit the skill path **and** add an explicit
prohibition: *do not invoke the `Skill` tool, and do not read any SKILL.md or skill reference
file.* Every baseline transcript reports `SKILL_CONSULTED`, and **all 17 report `no`**.

**The confound, stated plainly.** The prohibition tells the baseline that some skill exists. It
conveys no Scryfall syntax, no operator, and no query shape, so the surface being measured — what
the model can do from the tool description alone — is unchanged. It is a weaker mechanism than a
tool-level disable and it is the reason attempt 2 is written down.

## Behavioral results — every emitted `q`, both configurations

Graded on the emitted `q` from the transcript, never on the prose answer.

### Criterion 6 — combined legality + type + cost + price

| # | with_skill `q` | without_skill `q` |
|---|---|---|
| 1 | `t:creature id:g mv<=2 f:commander usd<=1 game:paper` | `t:creature id<=g cmc<=2 usd<=1 f:commander` |
| 2 | `t:artifact t:creature f:modern mv<=3 usd<=2 game:paper` | `t:artifact t:creature mv<=3 f:modern usd<2` |
| 3 | `t:instant mv=1 f:pioneer usd<=0.5 game:paper` | `f:pioneer t:instant mv=1 usd<0.50` |

**3/3 vs 3/3 — delta 0.** Both configurations put all four constraints in one `q` on every case,
with no client-side filtering and no request to narrow. The with-skill runs added `game:paper`
consistently; the baseline did not, which is a correctness nuance the skill teaches but not one
this criterion measures.

### Criterion 7 — regex

| # | with_skill `q` | without_skill `q` |
|---|---|---|
| 4 | `o:/^whenever you cast/` → `o:/^whenever you cast/ -o:/\nwhenever you cast/` | `o:/^whenever you cast/`, then **paged all 849 and filtered in Python to 377** |
| 5 | `o:/you gain that much life\.$/` | `o:/you gain that much life\.$/ -o:/you gain that much life\.\n/` |
| 6 | `o:/[0-9]+\s+counters/` | `o:/[0-9]+ counters/` |

**3/3 vs 3/3 — delta 0** on emitting regex. The difference is *how the query was finished*: on
case 4 the with-skill run expressed the whole constraint inside `q` in 3 calls, while the baseline
took 8 calls, paged the full result set, and filtered client-side — the one behavior
`SKILL.md`'s "Narrow, don't page" section exists to prevent. That is a real quality delta that
criterion 7 does not capture.

**Live finding, both configurations independently:** Scryfall's `^` and `$` anchor to a **line** of
oracle text, not to the text box, and `\A` / `\z` / `(?-m:…)` are unsupported (0 matches, or a
`bad_request`). Neither the skill nor `reference/operators.md` says this today.

### Criterion 8 — `otag:` / `function:` — the only family with a delta

| # | with_skill `q` | without_skill `q` |
|---|---|---|
| 7 | `c:w function:removal o:artifact mv<=3` | **no tag operator** — `(o:"destroy target artifact" or o:"exile target artifact")` |
| 8 | `id:b function:removal -o:destroy` | `id:b otag:removal -o:destroy -t:land` |
| 9 | `otag:tutor` → `otag:tutor -otag:ramp` | `otag:tutor` → `otag:tutor -o:land` |

**3/3 vs 2/3 — delta +1.** Case 7 is the whole finding. The baseline reached for a tag operator on
cases 8 and 9, where the user's own word maps onto a tag name ("removal", and "find a card out of
my library" → the well-known `tutor` tag). On case 7 the user described the *effect* without ever
naming it — "what actually deals with an artifact… not cards that just happen to say the word
artifact" — and the baseline fell straight into oracle-substring matching, which is precisely the
failure mode this criterion exists to detect.

**With-skill case 7 is graded 3/4, not 4/4.** It used `function:removal` correctly, but the
transcript then shows it pulling `oracle_text` for 27 candidates and sorting real answers from
lookalikes in the prose. The expectation as written forbids that, so it fails.
*Eval feedback (per the grader's own Step 6): that expectation is probably over-broad.* The user's
stated constraint **was** expressed in `q`; the oracle read was recommendation quality-control on
top, not a substitute for a query constraint. A future revision should separate "implemented the
constraint client-side" from "curated the returned set".

### Criterion 9 — artwork

| # | with_skill `q` | without_skill `q` |
|---|---|---|
| 10 | `atag:frog` | `art:frog` |
| 11 | `atag:dragon -t:dragon f:commander` | `art:dragon -type:dragon legal:commander` |
| 12 | `art:ruins (art:city or art:cityscape or art:town)` | `art:ruins art:city` / `art:ruins art:cityscape` |

**3/3 vs 3/3 — delta 0.**

### Criterion 13 — card facts come from tool calls

| # | with_skill `q` | without_skill `q` |
|---|---|---|
| 15 | `!"Gaea's Cradle" game:paper` (`unique: prints`) | `!"Gaea's Cradle"` (`unique: prints`) |
| 16 | `!"Sol Ring"` | `!"Sol Ring"` |
| 17 | `!"Rhystic Study"` | `!"Rhystic Study"` |

**3/3 vs 3/3 — delta 0.** Every price, legality and oracle-text claim in both configurations was
preceded by a `card_search` call and appears in that call's payload. The cross-set scan agrees: no
transcript in either configuration asserted a card fact absent from a payload. The `UNSOURCED`
lines the transcripts self-reported are strategy, rules explanation and arithmetic on payload
values — never a card fact.

### Criterion 12 — structured failure → revised retry

**with_skill: not measured. without_skill: 4/4.**

Cases 13 and 14 hand the model `illustrationtag:`, chosen by the spec because it reliably returns
HTTP 400. **With the skill loaded, the model never emitted it** — `SKILL.md` names
`illustrationtag:` as not real, so both runs went straight to `atag:dragon` / `atag:squirrel` and
told the user the operator does not exist. That is the best available behavior and it is why the
probe cannot work in that configuration: **no error is produced, so there is no retry to observe.**
Recording this as 0/2 would misreport correct behavior as a failure; it is recorded as *not
measured*, and the spec's choice of probe is the thing that needs revising, not the skill.

The baseline produced four `isError: true` / `bad_request` events and followed **every one** with a
revised `card_search` rather than a message to the user:

| Case | Failing `q` | `details` | Next action |
|---|---|---|---|
| 4 | `o:/(?-m:^whenever you cast)/` | "All of your terms were ignored." | `o:/\bwhenever you cast/` |
| 5 | `o:/you gain that much life\.\z/` | "All of your terms were ignored." | `o:/you gain that much life\.\n/` |
| 13 | `illustrationtag:dragon` | "All of your terms were ignored." | `art:dragon` |
| 14 | `illustrationtag:squirrel` | "All of your terms were ignored." | `art:squirrel` |

Two of those four are cross-set events the spec anticipated (requirement 8) rather than the direct
probes, so the criterion has evidence beyond cases 13–14.

Cases 9 and 12 each produced a `total_cards: 0` success and both configurations treated it as a
search outcome and loosened the query — never as an error. Case 9's baseline reported `isError` on
two calls that were **harness output-size overflows, not Scryfall errors**; those are excluded.

### Criterion 10 — `illustrationtag:` never emitted unprompted

**0 occurrences in both configurations.**

**Denominator: 15 cases per configuration — cases 1–12 and 15–17.** Cases 13 and 14 are excluded
because their prompts hand the operator to the model, and both baseline runs did emit it there
(which is the point of those cases, not a criterion-10 failure). 30 transcripts scanned, 93 emitted
`q` strings, zero unprompted occurrences.

### Criterion 5 — valid query rate

**15/15 vs 15/15 — delta 0** at the case level: every case in both configurations ended with a
valid query answering the request.

At the expectation level across the 15 comparable cases: **with_skill 78/79, without_skill 75/79.**
Case level: with_skill 14/15 cases clean, without_skill 13/15.

## Criterion 11 — trigger rates

Run as 20 bare user queries, one isolated subagent each, no tool hints, graded on **skill
invocation** rather than on tool calls.

**Should-trigger: 10/10. Should-not-trigger: 10/10.**

All ten positives invoked `manabase:scryfall-query-craft` as their first action. None of the ten
near-misses did — including the ones deliberately loaded with shared vocabulary: "shuffle a **deck**
of 52 **cards** in python", "my yugioh **deck** keeps bricking, how many one-of **tutors**",
"the **mana cost** mechanic in hearthstone", "a slide **deck** … on q3 **art** licensing **costs**",
"write a **regex** that matches semver", "every file under src/ that mentions **legality**",
"cheapest flight to seattle **under $300**".

Judged jointly, the description neither under- nor over-triggers on this set. **No tuning was
performed**, so there is no tuning history, no voided run, and the frontmatter is unchanged from
the [Slice 8](./TrackB-Slice8.md) follow-up fix.

### Frontmatter budget (re-measured, [spec](./TrackB-Slice9.md) requirement 9)

Measured by parsing the frontmatter and taking string lengths after unquoting:

| Field | Characters |
|---|---|
| `name` | 20 |
| `description` | 269 |
| `when_to_use` | 494 |
| **`description` + `when_to_use`** | **763** / 1,536 |
| `name` + `description` + `when_to_use` | 783 / 1,536 |

**This resolves the discrepancy [`CLAUDE.md`](../../CLAUDE.md) currently records as unresolved.**
The two standing figures differ only in whether `name` is counted: 783 − 763 = 20 =
`len("scryfall-query-craft")`. Slice 8's "764" is a one-off arithmetic slip — its own components,
269 and 494, sum to 763. No measurement was wrong; the labels were. Reconciling the two documents
is a factual correction outside this slice's permitted edits, so it is recorded here and handed to
`doc-sync` rather than applied.

## Aggregate

| [PC-01](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) criterion | with | without | delta | N |
|---|---|---|---|---|
| 5 — valid query | 15/15 | 15/15 | 0 | 15 cases |
| 6 — legality+type+cost+price | 3/3 | 3/3 | 0 | 3 |
| 7 — regex | 3/3 | 3/3 | 0 | 3 |
| 8 — `otag:` / `function:` | 3/3 | 2/3 | **+1** | 3 |
| 9 — artwork | 3/3 | 3/3 | 0 | 3 |
| 10 — `illustrationtag:` unprompted | 0 emitted | 0 emitted | 0 | 15 cases each |
| 11 — trigger | 10/10 should-trigger; 10/10 should-not | — | — | 20 |
| 12 — failure → revised retry | **not measured** | 4/4 | — | 4 error events |
| 13 — card fact → tool call | 3/3 | 3/3 | 0 | 3 |
| *expectation level (15 cases)* | *78/79* | *75/79* | *+3* | 79 |

**Every criterion 5–13 carries a baseline except 12**, which is recorded as not measured with the
skill for a stated structural reason rather than left blank.

## OQ-01 verdict

**The observed outcome is [spec](./TrackB-Slice9.md) requirement 11's second: with-skill ≈ baseline
on nearly every family.** Not the third, and emphatically not the fourth.

The reason is visible in `src/tools/register.ts`: the shipped compact description **already names
`t:`, `o:`, `f:`, `cmc`, `usd`, `otag:`, `art:` and regex `o:/…/` by name**. The without-skill
baseline is therefore not a model with no Scryfall knowledge — it is a model that has been handed
the operator families and has to supply only the argument. On five of six families it did exactly
that, and scored identically.

The skill's measured contribution is narrower and sharper than "it teaches the operators":

1. **It wins where the user names an effect the tag vocabulary does not echo** (case 7). The
   baseline reaches for `otag:` when the user says "removal"; it does not when the user says
   "what actually deals with an artifact". That is a +1/3 delta on criterion 8 and the only
   family-level delta in the run.
2. **It prevents a known-bad operator from ever being emitted** (cases 13–14), converting a
   guaranteed HTTP 400 plus a retry into a correct first call.
3. **It keeps the constraint inside `q`** instead of paging and filtering client-side (case 4:
   3 calls versus 8).

None of those three argue for growing the tool description. (1) is what a skill is for; (2) and (3)
are prose too long for a schema that is paid for in every session forever
([PQ-01](../PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports)).
And requirement 11's fourth outcome — the one that *would* force the description to grow — requires
a realistic path where the skill never fires; criterion 11 measured 10/10 should-trigger, so no
such path was observed here.

**The compact-description split holds. No change to `src/tools/register.ts` is indicated, and none
was made.**

The honest qualification: this run shows the split works, but it does **not** show the skill is
carrying the operator families. Most of what a user gets on those families they would get from the
tool description alone. That argues for a *shorter* skill body, not a longer tool description —
recorded, and deliberately not acted on in this slice.

## Harness deviations, and why

1. **The trigger loop was hand-run**, not driven by `skill-creator`'s `run_eval.py` / `run_loop.py`.
   Those scripts use `select.select()` on a pipe file descriptor, which does not work on non-socket
   handles on Windows. Hand-running also avoided their defaults (`--num-workers 10`,
   `--runs-per-query 3` → up to 60 concurrent `claude -p` processes), which would have violated the
   politeness rule outright, and avoided `run_eval.py` writing a transient command file into the
   repo's `.claude/commands/`.
2. **Execution was strictly sequential**, overriding `skill-creator`'s documented instruction to
   spawn all runs in the same turn ([MCP-PRD §3.4](../MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance)).
3. **One run per configuration.** `benchmark.json`'s `runs_per_configuration` is descriptive
   metadata that nothing reads; it would be `1`. Raising it multiplies Scryfall traffic linearly.
4. **`improve_description.py` was not used** even had it run: it caps its rewrite at 1,024
   characters and rewrites `description` only, never `when_to_use`. With `when_to_use` at 494, a
   1,024-character description totals 1,518 — inside the 1,536 cap by 18 characters. That margin is
   too thin to hand to a script. Moot here, since no tuning was triggered.
5. **The baseline mechanism** is the prohibition described above rather than a tool-level disable,
   for the session-timing reason recorded there.

`evals/` ships in every installed copy, because `marketplace.json` uses `"source": "./"` — the same
as the already-shipped `docs/`, `tests/` and `scripts/`. Consistent with existing practice; no
gitignore change was made.

## Findings for later slices

- **Cases 13–14 cannot measure criterion 12 against a skill that names the operator.** If criterion
  12 is to be measured with the skill loaded, the probe needs a malformed query the skill does not
  inoculate against — an unbalanced quote or paren, which `recipes.md`'s failure table already
  covers as a *recovery* case without naming a specific bad operator.
- **Scryfall regex anchors are per-line, not per-text-box**, and `\A` / `\z` / `(?-m:…)` are
  unsupported. Both configurations discovered this live, at the cost of a call each. It belongs in
  `reference/operators.md` — a [Slice 8](./TrackB-Slice8.md)-owned edit, not made here.

  **Follow-up, same day: addressed.** Re-verified with four confirmatory calls before recording —
  `o:/^whenever you cast/` 849 versus 361 with newline-preceded matches excluded, and the three
  escapes retested. The asymmetry the eval run only glimpsed is the important part: `\z` and
  `(?-m:…)` return HTTP 400, but **`\A` returns HTTP 200 with `total_cards: 0`**, which is
  indistinguishable from a genuine no-match and so produces a silent wrong answer rather than a
  correctable error. Recorded as a dated addendum in [`docs/MCP-PRD.md`](../MCP-PRD.md)
  [§4.1.1](../MCP-PRD.md#411-search-endpoint) with a [§9](../MCP-PRD.md#9-revision-log) row, and
  taught in the skill's `reference/operators.md` and `reference/recipes.md`. `SKILL.md` itself was
  deliberately left untouched — the correction is reachable through the two pointers the body
  already carries, and editing the body would change the artifact this document measured.
- **The baseline's auto-invocation** ([Attempt 1](#the-baseline-mechanism-and-the-attempt-that-failed))
  means any future eval that needs a clean baseline must define its no-`Skill` subagent **before**
  the measuring session starts.
- **Whether [PC-01](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) needs a loads-in-a-harness
  criterion** is still open and untouched here. This run is nonetheless evidence the skill loads:
  it was invoked by name, `manabase:scryfall-query-craft`, in 11 independent fresh subagents.
