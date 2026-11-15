# Rules eval — results

**Run date.** 2026-11-15, on `test/rules-eval` at `482151c`. Executed per
[ticket 06](../plans/2026-11-15-mtg-rules-prd/slices/06-rules-eval-run.md). 11 known-answer cases
from [`evals/rules-evals.json`](../../evals/rules-evals.json) × 2 configurations = 22 runs, each in
its own fresh subagent, **dispatched strictly one at a time**, case prompt verbatim and nothing
else. Baseline: [`rules-baseline`](../../.claude/agents/rules-baseline.md), with no `Skill` tool.
With the skill: [`rules-subject`](../../.claude/agents/rules-subject.md), with the `Skill` tool and
the same five Manabase tools. The skill under test is
[`skills/mtg-rules/SKILL.md`](../../skills/mtg-rules/SKILL.md). Grading is binary with no partial
credit and the burden of proof on the expectation, read from each run's `TOOL_CALLS` and
`FINAL_ANSWER` blocks (the [Slice 9](./TrackB-Slice9.md) grader stance, as in the
[OQ-14 combo eval](./OQ14-combo-eval-results.md)).

## Headline

| | baseline (no skill) | with skill |
|---|---|---|
| Expectations passed | **35 / 48** | **41 / 48** |
| Cases fully passed | **1 / 11** | **5 / 11** |

The skill helps, and the help sits almost entirely on **one** of the four scored expectations:
**zero uncited rules claims** (2/11 → 6/11). It also makes the **no-fallback** rule hold where the
baseline broke it (case 11). Both configurations were already at or near ceiling on the other three
scored expectations (correct citation, CR version stated, ruling source labelled), because the tool
descriptions already teach them. That is the pattern [OQ-14](./OQ14-combo-eval-results.md) and
[Slice 9](./TrackB-Slice9-results.md) found: a well-described tool leaves the skill a narrow but
real job.

**The skill did not reach "zero uncited rules claims" as an absolute.** With the skill, 5 of 11
answers still carried at least one claim that no tool result in the transcript supports.

## The four scored expectations

| Scored expectation | Cases | baseline | with skill | Verdict |
|---|---|---|---|---|
| **Correct rule or ruling citation** | 1–10 (11 expectations) | 10 / 11 | **11 / 11** | Near ceiling. The one baseline miss (case 8) quoted a ruling with no date |
| **Zero uncited rules claims** | all 11 | **2 / 11** | **6 / 11** | **The skill's main contribution**: four flips (2, 4, 6, 7), but not met in full |
| **CR version stated** | 1, 2, 3, 4, 5, 8, 10 | 7 / 7 | 7 / 7 | No difference. The tool description asks for it and both configs complied |
| **Ruling source labelled** | 6, 7, 8, 9 | 4 / 4 | 4 / 4 | No difference. Both said "official Wizards ruling" every time |

The other expectations: tool selection and arguments **10/11 vs 10/11**. Case 9's first expectation
failed in both configs, for the reason in Confounds below. A stale copy disclosed: **1/1 vs 1/1**.
Case 11, tournament policy declined: **1/2 vs 2/2**. Case 9, an assumed spelling correction
disclosed: **0/1 vs 0/1**.

## Per-case tallies

| # | Category | baseline | with skill | Flip |
|---|---|---|---|---|
| 1 | rule number (903.4) | 5/5 | 5/5 | — |
| 2 | rule number (702.19c) | 3/4 | **4/4** | ✓ |
| 3 | keyword (ward) | 3/4 | 3/4 | — |
| 4 | keyword (cascade) | 3/4 | **4/4** | ✓ |
| 5 | keyword (mana value with X) | 3/4 | 3/4 | — |
| 6 | two-card (Rest in Peace + Blood Artist) | 3/4 | **4/4** | ✓ |
| 7 | two-card (Humility + Opalescence) | 3/4 | **4/4** | ✓ |
| 8 | three-card (Torpor Orb + Panharmonicon + Mulldrifter) | 4/6 | 5/6 | partial |
| 9 | misspelled card ("Laboratory Manaic") | 3/5 | 3/5 | — |
| 10 | stale cache (deathtouch + trample) | 4/5 | 4/5 | — |
| 11 | tool unavailable (IPG penalty) | 1/3 | 2/3 | partial |

## Where the skill helps

- **It looks up the rule it is about to contrast or lean on, rather than asserting it.** Case 2:
  the baseline described normal trample's planeswalker behaviour without looking it up. The skill
  run called `rules_lookup {rule:"702.19b"}` and quoted it. Case 7: the skill run looked up 613.1,
  613.6 and 613.7, where the baseline looked up only 613.6.
- **It reaches for a ruling to support a general mechanic.** Case 4: unprompted, the skill run
  called `card_rulings` on Bloodbraid Elf, a cascade card the user never named, to cite "a
  countered spell's cascade still resolves" (2021-06-18, official Wizards ruling). The baseline
  stated the same thing with no source.
- **It attributes before it explains.** Case 7: the skill run named the 2009-10-01 ruling *before*
  its layer walk-through and cited each step. The baseline gave the same walk-through and only
  attributed it later, and only in part.
- **It discloses its own inferences.** In 7 of 11 skill runs (cases 3, 4, 6, 7, 8, 9, 10), the answer said that a link between
  a ruling and a rule was "my reading of" the cited sources, the wording the skill's procedure step
  5 asks for. No baseline answer did this.
- **It holds the no-fallback rule.** Case 11: the baseline said its tools did not cover the IPG,
  then stated "Hidden Card Error (IPG 2.3), the penalty is a Warning" and a remedy procedure, all
  from memory. The skill run named no penalty, cited CR 104.3k and 100.6 for where penalties come
  from, and pointed the user to the current IPG.
- **It avoided a wrong answer the baseline gave.** Case 6: the baseline added that Blood Artist
  still triggers for creatures destroyed at the same moment as Rest in Peace, and cited 603.10a
  for it. That conclusion is not supported: Rest in Peace's replacement effect applies to the
  simultaneous event, and 603.10a's look-back does not send the creatures to a graveyard. The skill
  run made no such claim. This is not separately scored, and it is the clearest case of a citation
  attached to an unsupported inference.

## Where it does not help

- **Citation format and the CR version.** Both configs met these on every applicable case. The
  `rules_lookup` and `card_rulings` descriptions already say to cite the rule number and the
  version, and to tell `wotc` from `scryfall`. That is enough.
- **Plain mechanics claims between citations.** Cases 3 and 5 failed identically in both configs.
  In case 3 the ward trigger "resolves first" was stated without a stack rule; in case 5 "a cost
  reducer still lets you choose any X" was stated without a rule. The skill says to cite each
  claim, but the model treats ordinary stack and cost mechanics as background rather than as
  claims.
- **Stale disclosure, with a hedge.** Case 10: both configs disclosed the stale copy and its date,
  then both reassured the user from memory ("these rules haven't changed in a long time", "this
  part of the rules rarely changes"). A stale copy cannot vouch for that. The skill's Freshness
  section does not forbid the hedge, so this is **a gap in the skill text**, not a failure to
  follow it.
- **A ruling older than the CR.** Case 7: both configs cited 2009 rulings against the 2026-11-06 CR
  without saying the ruling is older. The skill teaches this, but only "when the two seem to
  disagree", and here they did not. Arguably correct; noted rather than scored.
- **The misspelled card.** Case 9: both configs silently corrected "laboratory manaic" to
  Laboratory Maniac *before* calling `card_rulings`. So `unresolved_cards` was empty, the skill's
  procedure step 3 was never reached, and neither answer told the user a correction had been
  assumed.

## Did the skill load and get followed?

**Loaded: yes, 11 of 11 subject runs**, each opening with
`Skill {"skill":"manabase:mtg-rules"}`, auto-invoked from the description, because the prompt never
mentioned it. **Followed: yes, by behaviour absent from the baseline**: the "my reading"
disclosures, rulings sought for general mechanics, a rephrased empty query (case 9's
`"can't win the game"` → 0 matches → rule lookups), and the case 11 decline. The baseline agent
has no `Skill` tool, so it is clean by construction, not by instruction. That is the confound
[Slice 9](./TrackB-Slice9-results.md) recorded and this run does not carry.

**The skill also appears in this session's skill listing as `manabase:mtg-rules`.** The installed
plugin was `0.5.0` at `4959da5`, updated 2026-11-15T21:17Z, and its `skills/mtg-rules/SKILL.md` is
identical to the tested commit's apart from line endings. That is the harness-load observation
[PC-06](../PLUGIN-PRD.md#pc-06--rules-and-rulings) criterion 7 asks for. The profile was updated,
not cold.

## Confounds

1. **The runner wrote the cases and graded them, and the grading was not blind.** The
   configuration was visible on every transcript. Expectations were fixed before any run, and every
   grading call is recorded per case below, so the grading can be audited.
2. **One run per configuration per case, n = 11.** A one-case difference is one sample. The
   zero-uncited flips (four) and the case 11 decline are the only differences worth reading.
3. **"Uncited" needed one interpretation, applied to both configs.** The rubric accepts a
   citation in the same sentence or the one before. In case 5 both configs placed the cost-reducer
   claim right after a 107.3b citation that does not support it. The ruling: an adjacent citation
   counts only when the cited text supports the claim. Card *text* (Mulldrifter's draw being an
   enters trigger) was treated as a card fact, not a rules claim, in both configs.
4. **The misspelling was too easy.** "Manaic" is a typo a model fixes from its own knowledge, so
   `unresolved_cards` was never exercised. The case measured whether an assumed correction is
   disclosed. That is harmless here and harmful only when the guess is wrong. A name the model
   cannot guess is needed to test the skill's step 3.
5. **The stale state was staged locally.** For case 10 only, a failed check was written into the
   cache's `meta.json` (`failedAt` plus a realistic reason; Wizards was not contacted). The
   installed server then served the cache with `stale: true` and its note, which a runner lookup
   confirmed before the runs. The file was restored byte-for-byte from a backup afterwards. This
   exercises the stale *answer* path end to end through the real server. It is **not** evidence of
   a real failed revalidation, which
   [CAP-04](../MCP-PRD.md#cap-04--comprehensive-rules-lookup) criterion 11 keeps on fakes for good
   reason.
6. **"Tool unavailable" was staged as an out-of-scope question.** Both agent types carry every
   Manabase tool, and the agent registry is fixed at session start, so no run could have a tool
   removed. A question that neither tool covers (tournament policy) is the closest honest proxy.
   It tests the skill's "say so, do not answer from memory" rule, not "the server is absent".
7. **Neither subject agent has web search.** So "no web fallback" was never a temptation. Only
   "no fallback to memory" was measured.

## Live-traffic note

- **Wizards: 2 requests**, the first-use landing page and TXT download, made by the runner's own
  first `rules_lookup` while fixing the expected answers. All 22 subject runs, and the stale case,
  were served from that cache.
- **Scryfall: 13 `card_rulings` calls**, 4 by the runner fixing the answers and 9 by subjects
  (cases 6–9 in both configs, plus case 4 with the skill). Each call is one `POST /cards/collection`
  and then one rulings `GET` per card, on the server's own lanes. **No HTTP 429 and no rate-limit
  error was reported by any run.** No `card_search` or combo tool was called by any run.

## Per-case detail

Calls are as each subagent reported them in `TOOL_CALLS`. ✗ marks a failed expectation.

**Case 1.** Rule 903.4.
- *Baseline:* `rules_lookup {rule:"903.4"}`, `{rule:"903.5"}`. All five pass.
- *With skill:* `Skill`, `rules_lookup {rule:"903.4"}`, `{rule:"903.5c"}`. All five pass. The two
  answers were near-identical.

**Case 2.** Rule 702.19c.
- *Baseline:* `rules_lookup {rule:"702.19c"}`. ✗ zero-uncited: normal trample's behaviour against a
  planeswalker is asserted, and 702.19b was never looked up.
- *With skill:* adds `{rule:"702.19b"}` and quotes it. 4/4.

**Case 3.** Ward.
- *Baseline:* `rules_lookup {rule:"702.21"}`, `{rule:"701.6"}`. ✗ zero-uncited: the trigger "goes on
  the stack above your spell … resolves first" has no rule.
- *With skill:* `{query:"ward"}`, `{rule:"702.21"}`, `{query:"counter a spell"}`. ✗ on the same
  stack-order claim. It labelled the no-refund point as its own reading.

**Case 4.** Cascade.
- *Baseline:* `rules_lookup {rule:"702.85"}`, `{rule:"603.3"}`, `{rule:"117.3c"}`. ✗ zero-uncited:
  "countering the cascade spell doesn't stop the cascade" has no source.
- *With skill:* `{rule:"702.85"}`, `{rule:"603.3"}`, `{rule:"117.3"}`, `{rule:"405.5"}`,
  `card_rulings {cards:["Bloodbraid Elf"]}`, which it used to cite that exact claim. 4/4.

**Case 5.** Mana value with X.
- *Baseline:* `rules_lookup {rule:"202.3"}`, `{rule:"107.3"}`. ✗ zero-uncited: the cost-reducer
  sentence (see Confound 3).
- *With skill:* the same calls, the same answer and the same ✗.

**Case 6.** Rest in Peace + Blood Artist.
- *Baseline:* `card_rulings {cards:["Rest in Peace","Blood Artist"]}`, `rules_lookup
  {query:"dies"}`. ✗ zero-uncited: "abilities that trigger on leaving the battlefield or being
  sacrificed still trigger". It also made the unsupported 603.10a board-wipe claim.
- *With skill:* the same two calls. Every claim traces to the 2018-03-16 and 2016-06-08 rulings or
  to 700.4, with Scryfall links. 4/4.

**Case 7.** Humility + Opalescence, Humility first.
- *Baseline:* `card_rulings {cards:["Humility","Opalescence"]}`, `rules_lookup {rule:"613.6"}`.
  Correct: Humility is 4/4. ✗ zero-uncited: the layer 4 and 7b bullets are attributed only later,
  and only in part.
- *With skill:* adds `{rule:"613.7"}` and `{rule:"613.1"}`. It attributes the walk-through first
  and cites each step. 4/4.

**Case 8.** Torpor Orb + Panharmonicon + evoked Mulldrifter.
- *Baseline:* `card_rulings` (all three), `rules_lookup {rule:"702.74a"}`. Correct: no draw, no
  sacrifice. ✗ citation: the Torpor Orb ruling is quoted undated. ✗ zero-uncited: the Panharmonicon
  mechanics, and "the second sacrifice trigger would just do nothing".
- *With skill:* `card_rulings` (all three), `{rule:"702.74"}`. The Torpor Orb ruling is dated
  2024-04-12 and the Panharmonicon ruling 2021-03-19, both cited in place. ✗ on the same "second
  sacrifice does nothing" sentence.

**Case 9.** "Laboratory Manaic" + Platinum Angel.
- *Baseline:* `card_rulings {cards:["Platinum Angel","Laboratory Maniac"]}`, already corrected,
  then `{rule:"104.3"}`. ✗ the typed name was never submitted. ✗ the correction was never told to
  the user. Correct answer: no win and no loss.
- *With skill:* also pre-corrected. It then called `{query:"can't win the game"}` (no matches,
  rephrased), `{rule:"121.3"}`, `{rule:"104.2"}` and `{rule:"101.2"}`. The same two ✗.

**Case 10.** Deathtouch + trample, served stale.
- *Baseline:* `rules_lookup {rule:"702.19"}`, `{rule:"702.2"}`, both `stale: true`. It disclosed the
  stale copy and its date. ✗ zero-uncited: "these rules haven't changed in a long time".
- *With skill:* the same calls. Every bullet is cited (702.19a/b/d, 702.2b/c). ✗ on "this part of
  the rules rarely changes".

**Case 11.** Penalty for drawing an extra card at Competitive REL.
- *Baseline:* no calls. It said the tools do not cover the IPG, then stated the infraction and the
  penalty anyway. ✗ penalty stated. ✗ zero-uncited.
- *With skill:* `rules_lookup {query:"penalty"}` (104.3k) and `{rule:"100.6"}`. It named no
  penalty. ✗ zero-uncited: tournament-procedure advice from memory ("don't fix it yourself", "look
  in the Game Play Errors section").

## What it argues for

1. **PC-06 criterion 9 is measured and not met in full.** With the skill, the correct citation,
   the CR version and the ruling source are met on every applicable case. **Zero uncited rules
   claims is met on 6 of 11.** The criterion lists it as a requirement, so it should not be
   recorded as passed.
2. **Two skill-text edits are suggested by the data and not made here.** First, the Freshness
   section should tell the model not to vouch for a stale copy ("rarely changes") beyond what the
   tool said. Second, the procedure should say to submit card names **as the user typed them**, so
   that `unresolved_cards` can do its job instead of the model's guess. A third, "cite stack and
   priority mechanics too", would target cases 3 and 5. Any edit to the body changes what this run
   measured, and an edit to the frontmatter would also invalidate trigger behaviour, so each needs
   a re-run.
3. **No tool description change is indicated.** The scored expectations that the tool descriptions
   teach were at ceiling in the baseline.

## Scope

This is measurement. It changes no code and no skill. It supports
[PC-06](../PLUGIN-PRD.md#pc-06--rules-and-rulings) criteria 7 (loaded in a real session) and 9
(behavioural, run). It adds live, end-to-end usage evidence for
[CAP-03](../MCP-PRD.md#cap-03--card-rulings) and
[CAP-04](../MCP-PRD.md#cap-04--comprehensive-rules-lookup), both already delivered. It moves none
of their criteria, and the staged stale case does **not** move CAP-04 criterion 11 off its fakes.
No open question is resolved.
