# Track C — Slice 10: Context-cost measurement

> Self-contained implementation spec. You do not need to read the PRDs to build this slice;
> everything binding is inlined. PRD references are pointers for deeper context only.

**Goal.** Replace this project's two *estimated* context-cost figures with measured numbers, and
record them with the conditions that make them reproducible. Three outcomes: the `claude plugin
details` baseline that [`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) criterion 10 requires, a verdict on [`PC-01`](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) criterion 2 (the
≤250-token always-on cost), and definite answers to [`PQ-01`](../PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports) (do an MCP server's tool schemas
count toward the reported always-on total?) and [`PQ-02`](../PLUGIN-PRD.md#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed) (does this plugin fit alongside
everything the author already has installed?). Nothing is built. The deliverable is numbers,
their conditions, and the two open questions closed in the owning PRD.

## Preconditions (deliverables of Slices 7 and 8)

**[Slice 7](./TrackB-Slice7.md) — install verification.** Binding. Every instrument in this slice reads an *installed*
plugin: `/plugin marketplace add <owner>/manabase` then `/plugin install manabase@manabase` have
succeeded, `/mcp` shows the server connected, and `claude plugin validate . --strict` passes.
With nothing installed there is nothing for `claude plugin details` to report and no skill
listing for `/doctor` to price. [Slice 7](./TrackB-Slice7.md) also fixes the marketplace and plugin names this slice
must type on the command line.

**[Slice 8](./TrackB-Slice8.md) — [`PC-01`](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) `SKILL.md` authoring.** Not drawn in the roadmap's [§5](../DEV-ROADMAP.md#5-order-and-parallelism) graph (which draws only
7 → 10), and the graph is right that this slice is *runnable* without it: a plugin with zero
skills and one MCP server still reports an always-on total, so the [`PQ-01`](../PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports) A/B and the [`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server)
baseline are both obtainable before `skills/scryfall-query-craft/SKILL.md` exists. Be honest
about what such a measurement is and is not worth:

- It **is** worth the [`PQ-01`](../PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports) answer. That experiment varies `.mcp.json` and nothing else; the
  presence or absence of a skill is not a variable in it.
- It **is** worth a [`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server)-only baseline — the cost of the plugin shell (`plugin.json`
  description, keywords) plus whatever the server contributes.
- It is **not** worth [`PC-01`](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) criterion 2. Before `SKILL.md` exists there is no always-on skill
  cost to compare against ≤250 tokens; the criterion is vacuous, not passed.
- It is **not** worth [`PQ-02`](../PLUGIN-PRD.md#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed)'s answer. `PQ-02` asks whether *this plugin's* contribution fits in
  the shared skill-listing budget alongside the author's real load. Manabase's contribution to
  that listing is exactly zero until a skill has a `description`, so a pre-Slice-8 run measures
  the author's other plugins and calls it an answer.

Two legal orders, therefore. Either run the whole slice after [Slice 8](./TrackB-Slice8.md), or run it in two passes:
**pass 1** before the skill ([`PQ-01`](../PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports) + the [`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) shell baseline), **pass 2** after it ([`PC-01`](../PLUGIN-PRD.md#pc-01--scryfall-query-craft)
criterion 2 + [`PQ-02`](../PLUGIN-PRD.md#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed)). If two passes, each records its own conditions block and pass 1's totals
are never presented as *the* baseline — they are a different plugin.

## Context

Manabase is a Magic: The Gathering MCP server (Scryfall-backed card search) shipping inside a
Claude Code plugin. This is the first slice of Track C — measurement and release. Track A proved
the server ([`CAP-01`](../MCP-PRD.md#cap-01--card-search) delivered, live, 2026-08-03); Track B proves the install and writes the
skill; Track C measures what the pair costs every session, keeps the committed `dist/` honest
([Slice 11](./TrackC-Slice11.md)), and ships (Slices 12–13). Slice 10 feeds [Slice 12](./TrackC-Slice12.md), whose README work documents
`/doctor` as the answer to [`PQ-04`](../PLUGIN-PRD.md#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed) — the "how would a friend notice their listing was trimmed?"
question — and that documentation is only credible if this slice has established what the budget
actually looks like under load.

Three facts from [`PLUGIN-PRD.md`](../PLUGIN-PRD.md) that make this slice necessary rather than bookkeeping, inlined
because they shape every number below:

- **The skill listing is capped and the failure is silent** ([§3.1](../PLUGIN-PRD.md#31-context-budget)). `skillListingBudgetFraction`
  defaults to `0.01` — 1% of the context window — for the listing of every skill name and
  description the model sees each turn. On overflow, Claude Code drops descriptions starting
  with the least-used skills, keeping only their names: the skill stays invocable but the model
  can no longer see what it is for, so auto-invocation stops. Nothing errors. The budget is
  shared with everything else the user has installed, and a plugin **cannot** raise it — a
  plugin's root `settings.json` supports only the `agent` and `subagentStatusLine` keys.
- **`claude plugin details <name>` is the only instrument** ([§4.6](../PLUGIN-PRD.md#46-context-cost-accounting)). It reports a component
  inventory and two figures per component: *always-on* (tokens added to every session by listing
  text, whether or not anything fires) and *on-invoke* (tokens a component costs each time it
  fires).
- **The instrument's numbers are uneven in quality** ([§4.6](../PLUGIN-PRD.md#46-context-cost-accounting)). The always-on total is computed via
  the `count_tokens` API for the active model; **per-component numbers are proportionally scaled
  from that total, not measured independently**, and if the API is unreachable the command falls
  back to a character-based estimate. The plugin total is the trustworthy number; per-component
  figures indicate relative weight.

The grounding measurement [§4.6](../PLUGIN-PRD.md#46-context-cost-accounting) already records, for scale: `claude plugin details
dotnet-plugin@dotnet-plugin` on Claude Code 2.1.220 — 20 skills, 0 agents, 0 hooks, 0 MCP
servers; ~1,722 always-on for the whole plugin; ~30–230 always-on per skill; ~560–2,900 on-invoke
per skill. That is the number [`PQ-02`](../PLUGIN-PRD.md#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed) asks Manabase to fit alongside.

## Deliverables

| File | Action |
|---|---|
| `docs/slices/TrackC-Slice10-results.md` | new — every instrument's verbatim output, each under its own conditions block, plus the extracted matrix and the two `PQ` answers |
| `docs/PLUGIN-PRD.md` [§7](../PLUGIN-PRD.md#7-open-questions) | modify — [`PQ-01`](../PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports) and [`PQ-02`](../PLUGIN-PRD.md#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed) closed with their measured answers (or rewritten to say what was measured and why it did not resolve) |
| `docs/PLUGIN-PRD.md` [§5](../PLUGIN-PRD.md#5-components) | modify — [`PC-01`](../PLUGIN-PRD.md#pc-01--scryfall-query-craft)'s and [`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server)'s **Context cost** bullets gain the measured figures beside their estimates. Nothing else in §5 changes |
| `docs/PLUGIN-PRD.md` [§9](../PLUGIN-PRD.md#9-revision-log) | append exactly one revision-log row (template in requirement 10) |
| `docs/DEV-ROADMAP.md` [§4](../DEV-ROADMAP.md#4-phase-1-slices) Slice 10 + §4 status table | modify — status ☑, both done-when boxes ticked, one **Landed:** note. Sequencing only; the PRD holds the substance |
| `.mcp.json` | **temporarily moved and restored** during the [`PQ-01`](../PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports) experiment — net zero change. `git status` must show it unmodified when the slice ends |

No source file, no `dist/` rebuild, no plugin manifest edit, no skill text edit. If this slice
produces a diff under `src/`, something has gone wrong.

## Requirements

1. **This slice measures; it does not fix.** No behavior changes. If a measured number fails a
   gate, the fix belongs to the slice that owns the surface — [`PC-01`](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) criterion 2 is a property
   of the skill's `description` + `when_to_use`, which is [Slice 8](./TrackB-Slice8.md)'s deliverable, and tool
   description length is [Slice 5](./TrackA-Slice5.md)'s. A fix there invalidates the measurement, so the loop is
   **measure → tune → re-measure**, with every iteration recorded separately. Do not write this
   slice's results as though measurement always succeeds on the first pass.

2. **Every recorded number carries its conditions.** A bare token count is unreproducible and
   cannot be compared against a later run — which matters, because [§4.6](../PLUGIN-PRD.md#46-context-cost-accounting) says to re-run at each
   phase boundary rather than treating the figures as durable. Each measurement in the results
   doc gets a conditions block stating: **date**; **`claude --version`** (the [§3.2](../PLUGIN-PRD.md#32-minimum-harness-version) floor is
   2.1.207; the `/context` skill-listing accounting is correct only from 2.1.196, so the version
   is load-bearing, not decorative); **the active model** (the always-on total is computed with
   `count_tokens` *for the active model*, so a different model is a different number); **OS**;
   **every plugin and marketplace enabled at the time**; **the Manabase commit SHA installed**
   (`version` is deliberately unset during development per [`P-08`](../PLUGIN-PRD.md#p-08--version-scheme), so the SHA *is* the version);
   and **whether `skills/scryfall-query-craft/SKILL.md` existed**, with its SHA if so.

3. **Record verbatim, then extract — never the reverse.** Paste each invocation's complete output
   into a fenced block in the results doc, then pull the fields into the matrix. This spec
   deliberately does **not** name the labels `claude plugin details`, `/doctor`, or `/context`
   print; it names the *quantities* to find. Read the real labels off the real output and record
   them as they appear. If a quantity the matrix asks for is not present in the output, write
   "not reported" — never infer, compute, or estimate a number the instrument did not print.

4. **The measurement matrix.**

   | # | Measurement | How it is taken | What is recorded | Answers |
   |---|---|---|---|---|
   | 1 | Plugin baseline | `claude plugin details` for the installed Manabase plugin, in a terminal | Full verbatim output; component inventory (counts by type, including the MCP-server count); plugin-level always-on total; per-component always-on and on-invoke; any sign the character-based fallback was used | [`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) criterion 10; supplies **A₁** for measurement 4 |
   | 2 | [`PC-01`](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) always-on cost | The `PC-01` skill's always-on row in measurement 1's output | The figure, and an explicit verdict against ≤250 tokens: pass / fail / ambiguous-because-scaled | `PC-01` criterion 2 |
   | 3 | Skill listing text size | Count the characters of `description` + `when_to_use` in `SKILL.md`'s frontmatter — **characters, not tokens**; the 1,536 cap is a character cap | The count, and its margin under 1,536 | Corroborates [`PC-01`](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) criterion 1 (owned by [Slice 8](./TrackB-Slice8.md)) and explains measurement 2's figure |
   | 4 | [`PQ-01`](../PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports) A/B | The reversible controlled experiment of requirement 5 | **A₁** (with `.mcp.json`), **B** (without), **A₂** (restored); the refresh step that made the harness notice; the MCP-server count in each inventory | `PQ-01` |
   | 5 | Skill-listing budget under real load | `/doctor`, typed into a running Claude Code session with the author's **full** plugin load enabled | Verbatim skill-listing section: estimated listing cost, the budget it is measured against, the named biggest contributors, and whether any description is reported as trimmed | [`PQ-02`](../PLUGIN-PRD.md#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed) |
   | 6 | Post-budget listing size | `/context`, same session | Verbatim Skills row (listing size *after* the budget is applied) plus the overall breakdown for scale | [`PQ-02`](../PLUGIN-PRD.md#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed) |
   | 7 | Manabase-only control *(optional)* | Disable every other plugin, re-run `/doctor` and `/context` | The delta against measurements 5–6 | A **control** for [`PQ-02`](../PLUGIN-PRD.md#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed), explicitly not its answer |

   **Human-in-the-loop versus automatable, stated plainly because this is a verification slice.**
   Measurements 1–4 are `claude` CLI invocations run in a terminal: scriptable, agent-runnable,
   pipeable. Measurements 5–7 use `/doctor` and `/context`, which are **interactive session
   commands** — they are typed into a running Claude Code session and rendered to that session's
   UI. They are not shell commands, they do not exist as `claude doctor` subprocesses to pipe,
   and an agent cannot run them. Whoever executes this slice must either be a human at a session
   for those steps, or hand them to one and paste the output back verbatim.

5. **The [`PQ-01`](../PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports) experiment is a reversible, controlled A/B.** It is the delicate part of this
   slice and the part most likely to produce a number that looks like evidence and is not.
   Execute it exactly in this order:

   1. **Record the before state.** `git status` clean. Run measurement 1 in full. Note the
      plugin-level always-on total as **A₁**, and note what the inventory says about MCP servers
      — [§4.6](../PLUGIN-PRD.md#46-context-cost-accounting)'s grounding measurement shows the inventory reports counts by component type
      (`0 MCP servers` there), so Manabase's should read 1.
   2. **Make exactly one change.** Move `.mcp.json` out of the plugin — to the scratch directory,
      not the recycle bin. Do not edit its contents, do not delete it, do not touch
      `plugin.json`, do not disable anything else, do not switch models.
   3. **Make the harness notice, and find out what that takes.** This is the trap. The installed
      plugin is a *copy in the plugin cache*, not the working tree, so removing `.mcp.json` from
      the source may not be visible to `plugin details` at all until the installed copy is
      refreshed — plausibly `/reload-plugins`, plausibly `/plugin update`, plausibly a full
      uninstall-and-reinstall. **This spec does not assert which.** Determine it in-session and
      record what was actually required; that finding is itself a result worth writing down. The
      evidence that the change registered is the inventory: the MCP-server count must have
      dropped to 0. **If the inventory still lists the server, the measurement did not happen** —
      do not report a delta computed from it.
   4. **Re-measure.** Full output; plugin-level always-on total as **B**.
   5. **Restore.** Move `.mcp.json` back byte-for-byte; `git status` clean again. Repeat whatever
      refresh step (3) required. Re-measure: total as **A₂**.
   6. **A₂ must equal A₁.** This is the experiment's own control. If it does not, some other
      variable moved — a model switch, another plugin enabled or updated, a Claude Code update, a
      cache in a different state — and **the run is not evidence.** Record the discarded run and
      why, then re-run. A measurement whose baseline was not re-confirmed after the restore does
      not go in the PRD.

   **What the answer means, either way — record the implication, not just the number.**

   - **If A ≠ B** (removing the server lowered the reported total), tool schemas *do* count.
     [`PQ-01`](../PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports) says why that matters: unlike a skill description, a tool schema **cannot** be
     budget-trimmed ([§3.1](../PLUGIN-PRD.md#31-context-budget)'s degradation applies to the skill listing, not to tool definitions),
     so this becomes a fixed, unbudgetable always-on cost paid in full by every session in every
     project — including sessions with nothing to do with Magic. That converts the roadmap's
     [Slice 5](./TrackA-Slice5.md) warning ("keep tool count and description length lean") from prudence into a
     standing constraint on every future capability, and gives `MCP-PRD.md` [`OQ-01`](../MCP-PRD.md#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) (should the
     tool description grow?) a cost side it currently lacks. Record the delta **per tool** —
     Manabase registers exactly one — so the next CAP can budget before it adds a second.
   - **If A = B**, `plugin details` does not account for tool schemas. This is the outcome [§4.6](../PLUGIN-PRD.md#46-context-cost-accounting)
     already guesses at (`[inferred: … the server is not running when the command executes, which
     suggests they are not counted]`), so it is a *result*, not a failed experiment, and the
     results doc must not present it as one. But state the consequence precisely: **it does not
     mean the schemas are free.** They are still serialized into the model's context at runtime;
     it means the instrument cannot see them, so [`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server)'s always-on figure stays
     unknown-by-this-instrument and any future budget claim about tool schemas must come from
     `/context` or from token-counting the actual `tools/list` payload. Name that alternative
     instrument in the answer so a later session does not re-run this same experiment expecting a
     different result.

6. **[`PQ-02`](../PLUGIN-PRD.md#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed) is measured under the author's real load, not a clean profile.** Run `/doctor` and
   `/context` with everything the author normally has enabled. The question is aggregate: [§3.1](../PLUGIN-PRD.md#31-context-budget)'s
   budget is *shared*, and `dotnet-plugin` alone already spends ~1,722 always-on tokens across 20
   skills. A run with only Manabase enabled answers a different question — "what does Manabase
   cost?" — which measurement 1 already answered, more precisely. Record the full enabled-plugin
   list alongside the numbers; without it the aggregate figure means nothing and cannot be
   compared to a later run after the author installs something else.

   The deliverable here is a **judgment stated in words**, not just a ratio: how much headroom
   remains in the skill listing, whether any skill's description is currently being trimmed (and
   whether any of them is Manabase's), and — [`PQ-02`](../PLUGIN-PRD.md#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed)'s own phrasing — whether [§3.1](../PLUGIN-PRD.md#31-context-budget)'s silent
   degradation is **a live risk or a theoretical one** on this machine. Answer that clause
   literally. If a control run (measurement 7) is taken, label it a control; it is not the
   answer.

7. **[`PC-01`](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) criterion 2 is a gate this slice can fail.** ≤250 tokens always-on. Three things
   follow, and the spec is written assuming failure is a real outcome:

   - **The fix is not here.** [`PC-01`](../PLUGIN-PRD.md#pc-01--scryfall-query-craft)'s always-on cost *is* its `description` + `when_to_use`
     text; the only lever is shortening that text, and that text is [Slice 8](./TrackB-Slice8.md)'s deliverable. On a
     fail, re-open [Slice 8](./TrackB-Slice8.md), tune, and re-run measurements 1–3. Each iteration is a new
     measurement with its own conditions block — not a correction of the previous one. Do not
     quietly re-tune the description inside this slice and record the passing number as if it had
     been the first.
   - **[Slice 9](./TrackB-Slice9.md) tunes the same text for a different objective.** Its eval loop adjusts the
     description on should-trigger versus should-not-trigger hit rate. A description shortened for
     budget can lose trigger accuracy; one lengthened for accuracy can breach the budget. Whoever
     runs second holds the final number. Record which slice you are and whether the other has
     already run, so a later reader can tell whether the recorded figure is the last word.
   - **A figure hovering at the line is ambiguous, not a pass.** Per [§4.6](../PLUGIN-PRD.md#46-context-cost-accounting), per-component
     always-on numbers are proportionally scaled from the plugin total rather than measured, so
     [`PC-01`](../PLUGIN-PRD.md#pc-01--scryfall-query-craft)'s reported figure is indicative. Say so in the results doc, and treat anything within
     a plausible scaling error of 250 as ambiguous — with the plugin-level total, which *is*
     trustworthy, recorded beside it.

8. **Reject a fallback measurement.** [§4.6](../PLUGIN-PRD.md#46-context-cost-accounting): if the `count_tokens` API is unreachable, the command
   falls back to a character-based estimate. Such a run is not comparable to a `count_tokens` run,
   is not comparable to [§4.6](../PLUGIN-PRD.md#46-context-cost-accounting)'s grounding measurement, and must never be mixed into the [`PQ-01`](../PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports)
   A/B (where a silent switch between methods mid-experiment would manufacture a delta out of
   nothing). If the output indicates a fallback, record that it happened and re-run with
   connectivity.

9. **Get the argument form right and write it down.** [§4.6](../PLUGIN-PRD.md#46-context-cost-accounting)'s grounding measurement used the
   qualified `plugin@marketplace` form (`claude plugin details dotnet-plugin@dotnet-plugin`),
   while [`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) criterion 10 and the roadmap both write the bare `claude plugin details
   manabase`. Try the bare name; if it is ambiguous or not found, use the qualified form —
   [`P-11`](../PLUGIN-PRD.md#p-11--the-repo-is-its-own-marketplace) makes the repo its own marketplace, so the marketplace name is also `manabase`. Record
   the **exact command line** that worked. Every subsequent measurement in the A/B must use the
   identical command; a re-run at the next phase boundary must be able to use it too.

10. **Close the loop in [`docs/PLUGIN-PRD.md`](../PLUGIN-PRD.md), in the same session.** Both [`PQ-01`](../PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports) and [`PQ-02`](../PLUGIN-PRD.md#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed)
    resolve by exactly the work this slice does, so both should close — unless a measurement was
    inconclusive, in which case rewrite the entry to state what was measured, why it did not
    resolve, and what would. [§7](../PLUGIN-PRD.md#7-open-questions)'s own rule: *questions stay here until answered — they are not
    dropped.* Do not delete either heading and do not renumber. **Do not reword either heading
    either**: the two PRDs are densely cross-linked by GitHub heading anchors, [`PQ-01`](../PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports)'s anchor is
    long, and it is referenced from [`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server), [§4.6](../PLUGIN-PRD.md#46-context-cost-accounting), [§9](../PLUGIN-PRD.md#9-revision-log), and the roadmap. Renaming it breaks every
    one of those links silently.

    [`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server)'s **Context cost** bullet currently reads "magnitude currently unverified. Basis: none
    available" — once [`PQ-01`](../PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports) is answered it has a basis, so update it. [`PC-01`](../PLUGIN-PRD.md#pc-01--scryfall-query-craft)'s bullet gains the
    measured always-on figure beside its ~150–250 estimate. **§2 and §3 are locked** — inherited,
    not re-litigated — and §4 is a dated research record: if reality diverged from [§4.6](../PLUGIN-PRD.md#46-context-cost-accounting), append a
    dated addendum rather than overwriting it. A measured answer to an open question is a [§7](../PLUGIN-PRD.md#7-open-questions)
    update plus a [§9](../PLUGIN-PRD.md#9-revision-log) row; it is **not** a new `P-` decision and **not** a new `PC` block. Never
    duplicate a decision's text — reference the ID.

    Then append exactly one row to [§9](../PLUGIN-PRD.md#9-revision-log) (append-only; change nothing else in that table):

    ```
    | <date> | Context-cost measurement (Slice 10) on Claude Code <version>, model <model>:
    plugin always-on <n> tokens across <k> skills and <m> MCP servers; PC-01 always-on <n>
    (criterion 2 <pass|fail|ambiguous> against ≤250); PC-02 criterion 10 satisfied — full
    `claude plugin details` output recorded in docs/slices/TrackC-Slice10-results.md and
    pointed to from here rather than pasted into this table. **PQ-01 answered:** MCP tool
    schemas <do|do not> count toward the reported always-on total — with .mcp.json <A₁>,
    without <B>, restored <A₂>. **PQ-02 answered:** skill listing <n>/<budget> tokens under
    the author's full plugin load (<k> plugins enabled); <no description trimmed|trimmed:
    …>, so §3.1's silent degradation is <live|theoretical> on this machine. | Track C
    Slice 10 (docs/DEV-ROADMAP.md) — establishes the measured baseline §3.1 and PQ-02 are
    checked against, and gives PC-02's one genuinely unknown cost figure a value. <If
    PQ-01 counted: names a standing always-on budget constraint on future tool count and
    description length, which is a fact for docs/MCP-PRD.md to act on in its own session.> |
    ```

11. **Where the full CLI dump goes — resolve this tension explicitly, do not paper over it.**
    [`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) criterion 10 says `claude plugin details manabase` "runs and its output is recorded in
    [§9](../PLUGIN-PRD.md#9-revision-log)." Read literally that puts a multi-line CLI dump inside a three-column markdown table whose
    every other row is a paragraph of prose. [§9](../PLUGIN-PRD.md#9-revision-log)'s rows are one-line summaries with a Why column; a
    pasted terminal dump breaks both the table and the log's shape. The resolution, and it is
    stated in the [§9](../PLUGIN-PRD.md#9-revision-log) row itself so no later reader mistakes it for a shortcut:

    - The **verbatim output** lives in `docs/slices/TrackC-Slice10-results.md`, in fenced blocks,
      one per invocation, each under its conditions block. That document is the record.
    - The **[§9](../PLUGIN-PRD.md#9-revision-log) row** carries the figures that matter — totals, the pass/fail verdict, the two `PQ`
      answers — and points at the results document **by path**.
    - This is the precedent [Slice 6](./TrackA-Slice6.md) set for the [`CAP-01`](../MCP-PRD.md#cap-01--card-search) live pass, whose 13-check matrix lives in
      [`docs/slices/TrackA-Slice6-results.md`](./TrackA-Slice6-results.md) while `MCP-PRD.md` [§9](../MCP-PRD.md#9-revision-log) carries one summarizing row.
    - Criterion 10's substance — the measured baseline exists, is recorded verbatim, and is
      findable from the PRD — is satisfied. Its letter is satisfied by the pointer. If a future
      session disagrees and wants the dump inline in [§9](../PLUGIN-PRD.md#9-revision-log), that is a PRD edit belonging to whoever
      makes it, not something this slice does silently in either direction.

## Interface contracts

Nothing new is created. This slice adds no module, no script, no schema, and no dependency; it
consumes the output of four instruments. What follows is the **quantity** to extract from each —
not a claim about the label the tool prints. Field names are to be read off the real output and
recorded as they actually appear (requirement 3).

- **`claude plugin details <plugin>`** *(terminal)* — component inventory with counts by type
  including MCP servers; plugin-level always-on total; per-component always-on; per-component
  on-invoke; any indication the character-based fallback was used instead of `count_tokens`.
- **`/doctor`** *(interactive session)* — the skill-listing section: the listing's estimated cost,
  the budget it is measured against, the biggest contributors it names, and any statement that
  descriptions have been trimmed.
- **`/context`** *(interactive session)* — the Skills row: the listing size *after* the budget is
  applied, plus the overall context breakdown for scale.
- **`skills/scryfall-query-craft/SKILL.md`** frontmatter — `description` and `when_to_use`,
  measured in **characters** against the 1,536 cap.

The artifacts whose cost is being measured, as they exist in the repo today:

- `.claude-plugin/plugin.json` — `name: manabase`, a `displayName`, a `description` carrying the
  verbatim Fan Content disclaimer, an `author`, and five `keywords`. No `version` ([`P-08`](../PLUGIN-PRD.md#p-08--version-scheme)), no
  `userConfig` ([`P-13`](../PLUGIN-PRD.md#p-13--no-user-configuration-in-phase-1)).
- `.claude-plugin/marketplace.json` — one plugin entry, `source: "./"` ([`P-11`](../PLUGIN-PRD.md#p-11--the-repo-is-its-own-marketplace)), the same
  disclaimer, a `category`, five `tags`.
- `.mcp.json` — one stdio server, key `mtg`, `node ${CLAUDE_PLUGIN_ROOT}/dist/index.js`. **This is
  the single file the [`PQ-01`](../PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports) experiment moves and restores.**
- `src/tools/register.ts` — one tool, `card_search`: a five-line description naming the operator
  families and the pagination contract, and a hand-written JSON Schema with five properties (`q`,
  `unique`, `order`, `dir`, `page`) of which only `q` is required. **This is the entire payload
  [`PQ-01`](../PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports) is asking about.** Whatever the answer, it is the cost of exactly one tool with one
  required string parameter — so state the recorded figure per-tool, because the number's whole
  value is letting a future CAP estimate before it adds the second.

## Out of scope — do NOT

- **Do not delete `.mcp.json`.** Move it and move it back. The tree ends this slice
  byte-identical to how it started, and `git status` proves it before the results doc is written.
- No source changes, no `dist/` rebuild, no schema edit, no skill-text edit, no manifest edit. A
  failed gate is re-opened [Slice 8](./TrackB-Slice8.md) (skill description) or [Slice 5](./TrackA-Slice5.md) (tool description) — not an
  edit smuggled into a measurement slice.
- Do not leave the harness modified. Plugins disabled for the optional control get re-enabled;
  the model is not switched mid-run; the plugin is left installed exactly as [Slice 7](./TrackB-Slice7.md) left it.
- No changes to §2 or §3 of either PRD — locked, inherited, not re-litigated. No new `PC` block,
  no new `P-` decision. A measured answer is a §7 update and a §9 row.
- No edits to [`docs/MCP-PRD.md`](../MCP-PRD.md). If [`PQ-01`](../PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports) comes back "schemas count," that is a real constraint
  on future tool count and description length — but recording it there is that document's own
  session. Name the implication in `PLUGIN-PRD.md` [§9](../PLUGIN-PRD.md#9-revision-log)'s Why column and stop; do not spec around
  it, and do not reopen [`OQ-01`](../MCP-PRD.md#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) from here.
- No CI wiring and no automated cost-regression check. [Slice 11](./TrackC-Slice11.md) owns CI, and a recurring cost
  check is not scheduled — [§4.6](../PLUGIN-PRD.md#46-context-cost-accounting)'s instruction is to re-run at each phase boundary by hand.
- No attempt to raise `skillListingBudgetFraction` on a user's behalf. [§3.1](../PLUGIN-PRD.md#31-context-budget): a plugin's root
  `settings.json` supports only `agent` and `subagentStatusLine`. The plugin cannot, and must not
  appear to try.
- No Scryfall calls. This slice never starts the server or exercises a tool; nothing here touches
  the rate limit.

## Acceptance criteria

1. `docs/slices/TrackC-Slice10-results.md` exists and, for every measurement taken, contains the
   instrument's verbatim output under a conditions block carrying date, Claude Code version,
   active model, OS, the full enabled-plugin list, the installed Manabase commit SHA, and whether
   `SKILL.md` existed.
2. **[`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) criterion 10 satisfied:** `claude plugin details` ran against the installed plugin,
   its complete output is recorded, and `PLUGIN-PRD.md` [§9](../PLUGIN-PRD.md#9-revision-log) points to it by path — with the row
   itself saying that is where the dump lives.
3. **[`PC-01`](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) criterion 2 has an explicit verdict** — pass, fail, or ambiguous-because-scaled —
   stated with the measured number and the plugin-level total beside it. Not "looks fine."
4. **[`PQ-01`](../PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports) has a definite answer** backed by three measurements — A₁ with `.mcp.json`, B
   without, A₂ after restore — with **A₂ = A₁** recorded, the MCP-server inventory count shown
   dropping to 0 in the B run, and the refresh step that made the harness notice documented. The
   results doc states what the answer implies for future capabilities in the branch that
   occurred.
5. **[`PQ-02`](../PLUGIN-PRD.md#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed) has an answer stated as a judgment** about headroom under the author's full load,
   with the enabled-plugin list recorded, and it says in words whether [§3.1](../PLUGIN-PRD.md#31-context-budget)'s silent degradation
   is live or theoretical on this machine.
6. [`docs/PLUGIN-PRD.md`](../PLUGIN-PRD.md): [§7](../PLUGIN-PRD.md#7-open-questions)'s [`PQ-01`](../PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports) and [`PQ-02`](../PLUGIN-PRD.md#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed) updated or closed; [`PC-01`](../PLUGIN-PRD.md#pc-01--scryfall-query-craft)'s and [`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server)'s
   context-cost bullets carry measured figures; [§9](../PLUGIN-PRD.md#9-revision-log) has exactly one new appended row. `git diff
   docs/PLUGIN-PRD.md` shows those edits and nothing else — no §2/§3 change, no heading renamed,
   no ID renumbered, no row rewritten.
7. `git status` shows `.mcp.json` unmodified and no change under `src/`, `dist/`, `skills/`, or
   `.claude-plugin/`. The only changed files are the results doc, the PRD, and the roadmap.
8. `docs/DEV-ROADMAP.md` [§4](../DEV-ROADMAP.md#4-phase-1-slices)'s Slice 10 entry is ☑ with both done-when boxes ticked and a
   **Landed:** note, and the §4 status table row matches.

## Testing requirements

There is no code, so there is no suite. The discipline that replaces one is reproducibility, and
it is checkable:

- **Every number is reproducible from the results doc alone.** A reader on the same Claude Code
  version, same model, and same plugin set must be able to re-run the exact command lines written
  down and land on the same figures. Write the command lines out literally; do not describe them
  in prose.
- **The A/B is self-testing.** `A₂ = A₁` is the assertion. A run that fails it is discarded, not
  patched — and the discarded run is still recorded, with why, because a control that failed is
  evidence about the instrument's stability and [§4.6](../PLUGIN-PRD.md#46-context-cost-accounting) already warns these numbers are only as
  durable as the accounting behind them.
- **Confirm the tree that was measured is a working tree.** Run `npm test` and `npm run typecheck`
  once (67 tests, 19 suites — seconds) and record the result in the conditions block. Measuring
  the context cost of a broken build is measuring nothing, and the installed SHA is the only thing
  tying the numbers to a state of the repo.

## Verification steps

**Automatable — a terminal, no interactive session required.**

```bash
claude --version                       # record; §3.2 floor is 2.1.207
claude plugin list                     # record every enabled plugin and marketplace
claude plugin details manabase         # A₁ — full output into the results doc
#   if the bare name is ambiguous or not found, use manabase@manabase and record which worked

# --- PQ-01 A/B: one variable, fully reversible ---
git status                             # must be clean before starting
mv .mcp.json "$SCRATCH/.mcp.json"      # MOVE, never delete
#   then whatever the harness needs to notice — /reload-plugins, /plugin update, or a
#   reinstall. Determine in-session; record what was actually required.
claude plugin details manabase         # B — the inventory's MCP-server count must now read 0
mv "$SCRATCH/.mcp.json" .mcp.json      # restore
git status                             # must be clean again, byte-identical
#   repeat the same refresh step
claude plugin details manabase         # A₂ — must equal A₁, or the run is void

npm test && npm run typecheck          # confirm the measured tree is a working tree
```

**Human-in-the-loop — typed into a running Claude Code session with the author's full plugin
load.** These render to the session UI; they cannot be piped, scripted, or run by an agent.

```
/doctor      # skill-listing cost against the budget, biggest contributors, any trimming
/context     # the Skills row — listing size after the budget is applied
```

Copy both outputs into the results doc verbatim — the text, not a summary. Then the document
edits, then:

```bash
git diff docs/PLUGIN-PRD.md   # §7 PQ-01/PQ-02, PC-01/PC-02 cost bullets, one appended §9 row
git add -A && git status      # results doc + PRD + roadmap only; .mcp.json unmodified
```

## References

- `docs/DEV-ROADMAP.md` [§4](../DEV-ROADMAP.md#4-phase-1-slices) Slice 10 (goal and done-when), [§5](../DEV-ROADMAP.md#5-order-and-parallelism) (the graph: 7 → 10 → 12), [§3](../DEV-ROADMAP.md#3-standing-rules--apply-to-every-slice-never-restated-per-slice)
  (standing rules, never restated per slice), [§2](../DEV-ROADMAP.md#2-current-state-verified-2026-08-04) (current state).
- `docs/PLUGIN-PRD.md` [§3.1](../PLUGIN-PRD.md#31-context-budget) (the context budget and its silent failure), [§3.2](../PLUGIN-PRD.md#32-minimum-harness-version) (version floor;
  `/context` skill accounting correct from 2.1.196), [§4.6](../PLUGIN-PRD.md#46-context-cost-accounting) (what `plugin details` reports, the
  proportional scaling of per-component figures, the character-based fallback, and the
  `dotnet-plugin` grounding measurement), [`PC-01`](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) criterion 2, [`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) criterion 10, [`PQ-01`](../PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports),
  [`PQ-02`](../PLUGIN-PRD.md#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed), [§7](../PLUGIN-PRD.md#7-open-questions) (questions are never dropped), [§9](../PLUGIN-PRD.md#9-revision-log) (append-only revision log).
- [`docs/slices/TrackA-Slice6.md`](./TrackA-Slice6.md) and [`docs/slices/TrackA-Slice6-results.md`](./TrackA-Slice6-results.md) — the precedent for a
  measurement slice: an inlined matrix, a separate results document holding the raw record, and
  one summarizing revision-log row in the owning PRD.
- `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `.mcp.json`,
  `src/tools/register.ts` — the artifacts whose always-on cost is being measured.
- `docs/MCP-PRD.md` [`OQ-01`](../MCP-PRD.md#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) (how Scryfall syntax should reach the model) — [`PQ-01`](../PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports)'s answer gives
  that question a cost side. Acting on it there is that document's session, not this slice's.
