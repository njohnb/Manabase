# 06: Rules eval run — measure the skill with and without

**What to build:** evidence that the rules tools and skill produce correctly cited answers. It is
measured the same way the [OQ-14 combo eval](../../../slices/OQ14-combo-eval-results.md) was: a
set of known-answer rules questions run with the skill and against a clean-room baseline, with the
results written up and the acceptance criteria of CAP-03, CAP-04 and PC-06 marked verified.

**Blocked by:** 04, 05.

**Status:** done 2026-11-15 — measured, not all met; see [the results](../../../slices/rules-eval-results.md)

- [x] An eval file holds known-answer cases in the existing eval schema. It covers rule-number
      lookups, keyword lookups, two- and three-card interactions, a misspelled card, a stale-cache
      answer, and a "tool unavailable" case.
- [x] A clean-room baseline agent with no `Skill` tool exists **before** the measuring session
      starts, because the agent registry resolves at session start.
- [x] Every case runs in a fresh subagent, one at a time, in both configurations. Live calls are
      spaced and no 429 is provoked.
- [x] The scored expectations are a correct rule or ruling citation, zero uncited rules claims,
      the CR version stated, and the ruling source labelled.
- [x] A results document records per-case tallies, the axes where the skill helps and where it
      doesn't, and any confounds.
- [x] Verified criteria are marked in the CAP-03, CAP-04 and PC-06 blocks with dated evidence, by
      `doc-sync`. Nothing is marked from this run that it didn't measure. *(2026-11-15: PC-06 criterion 7
      verified; criterion 9 measured and **not met** (zero uncited claims 6/11 with the skill); CAP-03
      and CAP-04 gained live-use notes and moved no criterion.)*

## How to run (prepared 2026-11-15)

The two subject agents exist as `.claude/agents/rules-baseline.md` (no `Skill` tool) and
`.claude/agents/rules-subject.md` (with `Skill`). They have identical Manabase tool lists and
nothing else, so the skill is the only variable. Both were committed before the measuring session
started, so the registry loads them.

1. Confirm both agent types appear in the session's agent list, and that `manabase:mtg-rules` appears
   in the skill listing. The second check also verifies PC-06's loads criterion, so record it.
2. Write `evals/rules-evals.json` in the `combo-evals.json` schema. Fix each expected rule number
   or ruling against a live `rules_lookup` or `card_rulings` call before freezing the case, never
   from memory.
3. Dispatch each case to `rules-baseline` and then to `rules-subject`, one at a time, each in a
   fresh subagent with the case prompt verbatim and nothing else.
4. Grade every run binary, from its `TOOL_CALLS` and `FINAL_ANSWER` blocks. Then write
   `docs/slices/rules-eval-results.md` and dispatch `doc-sync`.
