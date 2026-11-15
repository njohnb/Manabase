# 06: Rules eval run — measure the skill with and without

**What to build:** evidence that the rules tools and skill produce correctly cited answers. It is
measured the same way the [OQ-14 combo eval](../../../slices/OQ14-combo-eval-results.md) was: a
set of known-answer rules questions run with the skill and against a clean-room baseline, with the
results written up and the acceptance criteria of CAP-03, CAP-04 and PC-05 marked verified.

**Blocked by:** 04, 05.

**Status:** ready-for-agent

- [ ] An eval file holds known-answer cases in the existing eval schema. It covers rule-number
      lookups, keyword lookups, two- and three-card interactions, a misspelled card, a stale-cache
      answer, and a "tool unavailable" case.
- [ ] A clean-room baseline agent with no `Skill` tool exists **before** the measuring session
      starts, because the agent registry resolves at session start.
- [ ] Every case runs in a fresh subagent, one at a time, in both configurations. Live calls are
      spaced and no 429 is provoked.
- [ ] The scored expectations are a correct rule or ruling citation, zero uncited rules claims,
      the CR version stated, and the ruling source labelled.
- [ ] A results document records per-case tallies, the axes where the skill helps and where it
      doesn't, and any confounds.
- [ ] Verified criteria are marked in the CAP-03, CAP-04 and PC-05 blocks with dated evidence, by
      `doc-sync`. Nothing is marked from this run that it didn't measure.
