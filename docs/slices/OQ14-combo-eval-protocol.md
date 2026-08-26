# OQ-14 combo-search eval — run protocol

**Purpose.** Measure whether Claude writes valid Commander Spellbook combo queries from plain
English, and whether the `spellbook-combo-craft` skill helps beyond the `combo_search` tool
description alone. This is the plugin-side half of `OQ-14`, run the same way Slice 9 measured
`OQ-01` for `card_search`. **Not yet run** — this file is the executable plan; results go in
`OQ14-combo-eval-results.md`.

## Preconditions (why this needs a fresh session)

- The subject agent `.claude/agents/oq14-baseline.md` (`oq14-baseline`) has **no `Skill` tool** by
  construction, so no installed skill can auto-invoke and skew tool-selection. The agent registry
  resolves at session start, so **this agent is only dispatchable in a session started after the
  file existed** — do not try to run this in the session that created it.
- The Manabase plugin must be connected (both `combo_search` and `card_search` reachable). The
  skill under test is `skills/spellbook-combo-craft/` in the working tree — it does **not** need to
  be installed, because the `with_skill` config hands the subject the file path to read.
- **Politeness (binding).** Live third-party APIs. Dispatch **one subagent at a time, strictly
  sequential** — never spawn cases in parallel. Never provoke an HTTP 429. If any run reports a
  429 or a rate-limit error, stop and wait before continuing.

## The two configurations

Each of the 12 cases in `evals/combo-evals.json` runs once per configuration, each in its own fresh
`oq14-baseline` subagent (never reuse a subagent between cases or configs).

### without_skill dispatch prompt

> You are running eval case `<ID>` in configuration **without_skill**. You were given no syntax
> help — work from the tool descriptions alone, and do not read any file under `skills/`.
>
> The user's request is:
>
> `<prompt from combo-evals.json>`
>
> Do the task for real, then end with the CASE_ID / CONFIG / SKILL_CONSULTED / TOOL_CALLS / ANSWER
> report block exactly as your instructions specify. SKILL_CONSULTED must be `no`.

### with_skill dispatch prompt

> You are running eval case `<ID>` in configuration **with_skill**. First read
> `skills/spellbook-combo-craft/SKILL.md` and, if it points you there,
> `skills/spellbook-combo-craft/reference/combo-operators.md`, and follow them. Then do the task.
>
> The user's request is:
>
> `<prompt from combo-evals.json>`
>
> End with the CASE_ID / CONFIG / SKILL_CONSULTED / TOOL_CALLS / ANSWER report block exactly as your
> instructions specify. SKILL_CONSULTED must be `yes`.

Recommended order: run all 12 `without_skill` first, then all 12 `with_skill` (or interleave per
case) — either way, one subagent in flight at a time.

## Grading

Grade from each subagent's `TOOL_CALLS` block against that case's `expectations` array, **not** from
the prose answer. Binary, no partial credit, **burden of proof on the expectation** (Slice 9's
grader stance). Record every emitted tool call and its arguments verbatim, both configs, so the
evidence is auditable.

The discriminating axes (what `OQ-14` actually asks):

1. **Tool selection** (cases 1, 2, 3, 12) — combo questions to `combo_search`, card questions to
   `card_search`, priced-combo questions to both. The tool description cannot teach this; it is
   cross-tool, so it is the skill's clearest expected contribution.
2. **Query craft beyond `card:`** (cases 4, 5, 6, 9) — `cards<=N`, `result:`, `ci:`, `commander:`,
   `steps<=N`, and the `format` parameter. The description names only `card:`, so a gap here is the
   skill's second contribution.
3. **Paging discipline** (cases 7, 8) — narrow a huge result or follow `next_offset`; never compute
   an offset; never walk every page into context.
4. **Recovery / empty** (cases 10, 11) — `combo_search` fails loudly (verbatim `details`), so a
   guess is correctable; zero matches is a successful empty result, not an error.

## What a result must state

- Per-case, per-config pass/fail on each expectation, with the emitted `q` / `format` / `offset`.
- A per-axis with-vs-without delta table (mirror Slice 9's aggregate table).
- The `OQ-14` verdict: does the skill measurably help, and on which axes — and, per Slice 9's
  precedent, whether any part of it argues for a shorter skill body or a change to the
  `combo_search` tool description in `src/tools/register.ts` rather than the skill.
- Live-traffic note: total `combo_search` / `card_search` calls, sequential, and confirmation no
  429 was observed.
- Whether the skill demonstrably **loaded and was followed** in the `with_skill` runs (the Slice 8
  lesson: a SKILL.md that parses is not a skill that works). Here the subject reads it by path, so
  `SKILL_CONSULTED: yes` plus behavior change is the evidence.

## After the run

This is measurement, not a status change. Hand the results to `doc-sync` to record `OQ-14`'s
plugin-side progress against `PC-01` / the new skill component — it does not resolve the MCP-PRD
half of `OQ-14`, which is the tool-description question, unless the data speaks to it.
