# Track B — Slice 9: [PC-01](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) evals

> Self-contained implementation spec. You do not need to read the PRDs to build this slice;
> everything binding is inlined. PRD references are pointers for deeper context only.

**Goal.** Measure [PC-01](../PLUGIN-PRD.md#pc-01--scryfall-query-craft)'s behavioral acceptance criteria 5–13 against a **without-skill
baseline**, in **fresh sessions**, and record both numbers — then use that measurement to
answer the empirical half of [`docs/MCP-PRD.md`](../MCP-PRD.md) [OQ-01](../MCP-PRD.md#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model). [Slice 5](./TrackA-Slice5.md) made a bet: keep the
`card_search` tool description compact and put the deep Scryfall teaching in the skill. Nothing
has tested it. This slice is where that bet is allowed to lose. Track B's plugin half of Phase 1
closes when the results are recorded in [`docs/PLUGIN-PRD.md`](../PLUGIN-PRD.md) [§9](../PLUGIN-PRD.md#9-revision-log) and [OQ-01](../MCP-PRD.md#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) carries a dated,
measured answer.

## Preconditions

**Deliverables of [Slice 7](./TrackB-Slice7.md) (plugin install verification):**

- The plugin installed from the marketplace in `owner/repo` form (`njohnb/Manabase`) on a
  machine or profile that had never installed it; `/mcp` shows the server connected.
- Tools reachable under the scoped name `mcp__plugin_manabase_mtg__card_search` ([P-12](../PLUGIN-PRD.md#p-12--plugin-name-and-server-key)). That
  exact string is what an eval assertion matches on; a grader written against the bare
  `card_search` will mis-grade every case.
- `claude plugin validate . --strict` passes; enabling produced zero configuration prompts.

**Deliverables of [Slice 8](./TrackB-Slice8.md) (`SKILL.md` authoring):**

- `skills/scryfall-query-craft/SKILL.md` exists, with the exhaustive operator catalog in
  `skills/scryfall-query-craft/reference/`.
- [PC-01](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) criteria 1–4 recorded as passing: `description` + `when_to_use` ≤ 1,536 characters,
  `SKILL.md` ≤ 5,000 tokens, no card facts asserted anywhere in the skill files, tool
  references in the scoped form.

**Independently:**

- `dist/index.js` is current and committed (`npm run build` leaves `git status` clean). A stale
  bundle means the evals measured a server that is not the one in `src/` — the whole run is then
  worthless and the failure is invisible. Check this **before** the first run, not after.

## Context

Manabase is a Magic: The Gathering MCP server (Scryfall-backed card search) shipped inside a
Claude Code plugin. Track A delivered the server: [CAP-01](../MCP-PRD.md#cap-01--card-search) is `delivered`, all twelve criteria
verified, nine of them live ([`docs/slices/TrackA-Slice6-results.md`](./TrackA-Slice6-results.md)). Track B delivers the thing
a user installs — [Slice 7](./TrackB-Slice7.md) proves it installs, [Slice 8](./TrackB-Slice8.md) writes the skill, and this slice is the
only one that produces evidence the skill actually *works*.

Slice 9 needs **both** [Slice 7](./TrackB-Slice7.md) (an installed plugin exposing the scoped tool) and [Slice 8](./TrackB-Slice8.md) (a
skill to measure). It sits on the critical path `1 → 2 → 3 → 4 → 5 → 7 → 9 → 12 → 13`: [Slice 12](./TrackC-Slice12.md)'s
friend dry-run and [Slice 13](./TrackC-Slice13.md)'s release gate are both downstream, so a stalled Slice 9 stalls the
release.

Two things this slice is *not*. It is not skill authoring — [Slice 8](./TrackB-Slice8.md) owns the prose, though
tuning the `description` is in scope here because tuning is only meaningful against measured
trigger rates (requirement 9). And it is not context-cost measurement — [PC-01](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) criterion 2,
`claude plugin details`, `/context`, `/doctor`, [PQ-01](../PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports) and [PQ-02](../PLUGIN-PRD.md#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed) all belong to [Slice 10](./TrackC-Slice10.md).

## Deliverables

| File | Action |
|---|---|
| `evals/evals.json` | new — the 17 behavioral eval cases, conforming to `skill-creator`'s schema |
| `evals/trigger-evals.json` | new — the 20-query should-trigger / should-not-trigger set (flat array; `skill-creator`'s description-optimization shape) |
| `docs/slices/TrackB-Slice9-results.md` | new — both runs, case by case, with the tuning history and the [OQ-01](../MCP-PRD.md#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) verdict |
| [`docs/PLUGIN-PRD.md`](../PLUGIN-PRD.md) | append **one** [§9](../PLUGIN-PRD.md#9-revision-log) revision-log row (template below). Nothing else. |
| [`docs/MCP-PRD.md`](../MCP-PRD.md) | append **one** dated status paragraph under [§7](../MCP-PRD.md#7-open-questions) [OQ-01](../MCP-PRD.md#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) **and one** [§9](../MCP-PRD.md#9-revision-log) row. Nothing else. |
| [`docs/DEV-ROADMAP.md`](../DEV-ROADMAP.md) | tick Slice 9's two done-when boxes, set the [§4](../DEV-ROADMAP.md#4-phase-1-slices) status cell, add a `Landed:` line — sequencing only |
| `skills/scryfall-query-craft/SKILL.md` | modify **only if** a measured failure forces it (requirement 9); any edit voids every preceding run |

## Requirements

1. **The baseline comparison is the deliverable, not the pass rate.** Every criterion 5–13
   needs a recorded result *with* its without-skill baseline. A skill that scores 90% where the
   baseline already scored 88% has not been shown to work — it has been shown to be a rounding
   error on top of the tool description. A criterion recorded with a with-skill number and no
   baseline is recorded as **not measured**, not as passed. Report every rate as a pair
   (`with / without`) and a delta, never as a single figure.

2. **Two artifacts, because the first-party loop has two shapes.** `skill-creator` runs
   *task-execution* evals (one subagent per case, with-skill and without-skill, graded against
   written expectations) from `evals/evals.json`, and it runs *description optimization* from a
   separate flat array of `{query, should_trigger}` items. Criteria 5–10, 12 and 13 are measured
   by the first; criterion 11 and any description tuning are measured by the second. [PC-01](../PLUGIN-PRD.md#pc-01--scryfall-query-craft)'s
   eval-method preamble names only `evals/evals.json` because that is where the *cases* live —
   it does not forbid the second file, and the trigger loop cannot read the first file's shape.

3. **Conform to `skill-creator`'s actual schema; verify it in-session.** As read on 2026-08-04
   from the local marketplace cache at
   `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/skill-creator/skills/skill-creator/references/schemas.md`,
   `evals.json` is `{ "skill_name", "evals": [ { "id" (unique int), "prompt", "expected_output",
   "files" (optional), "expectations" (list of verifiable statements) } ] }`, and the trigger set
   is a bare array of `{"query": "...", "should_trigger": true|false}`. **Re-read both before
   writing anything** — the cache can be stale, and the first-party docs already disagree with
   each other: `schemas.md` calls the per-case assertion list `expectations`, while the
   `skill-creator` `SKILL.md` refers to "the `assertions` field" and writes `assertions` into its
   `eval_metadata.json`. Find out which key the grader actually reads and use that one. Do not
   ship a schema you have not opened in this session.

4. **Fresh sessions only, and a deviation invalidates the run rather than annotating it.** Each
   case executes in its own fresh context — one isolated subagent per case, which is the shape
   the first-party loop already has. A session that just wrote or edited the skill emits good
   queries whether or not the skill fired, because the authoring conversation is still in
   context; that session cannot measure anything. Concretely: do not run a case in the session
   that edited `SKILL.md`, do not run a case twice in the same subagent, and do not reuse a
   subagent between the with-skill and without-skill configurations. If any of this happens, the
   affected cases are void — re-run them, do not caveat them.

5. **Held-out means held out.** Before the first run, search `SKILL.md` and every file under
   `skills/scryfall-query-craft/reference/` for each prompt's distinctive phrasing. Any hit means
   the prompt is an example the skill was written against, not a held-out probe — replace it.
   Keep the behavioral prompts (requirement 6) and the trigger queries (requirement 7) disjoint:
   `run_loop` trains a description on 60% of the trigger set, and a description tuned on a prompt
   then graded on the same prompt measures nothing.

6. **The behavioral eval matrix.** Prompts are written the way a real user types — specific,
   with backstory, sometimes lowercase and sloppy — because a thin one-step prompt does not
   trigger *any* skill regardless of description quality, and would measure the harness rather
   than this skill. **No prompt names an operator, a tool, or Scryfall**, except the two failure-
   loop cases, where the user hands the model an invalid operator on purpose. Pass conditions
   are graded from the transcript, on the emitted `q` — never from the prose answer.

   | # | Prompt (verbatim in `evals.json`) | Exercises | Pass condition | [PC-01](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) criterion |
   |---|---|---|---|---|
   | 1 | "im building my first commander deck (mono green, azusa) and im broke. what creatures could i run that cost 2 mana or less and are like a buck or less each? needs to actually be legal in the format" | legality + type + cost + price, combined | one `card_search` call whose `q` carries a format operator, a type operator, a mana-value comparison **and** a USD comparison together; no client-side filtering of a broad result; no "narrow it down for me" reply | 6 (and 5) |
   | 2 | "putting together a modern budget artifact deck for FNM next week. artifact creatures, mana value 3 or under, under $2 each — ive got maybe $60 total" | same, different format and thresholds | as above | 6 (and 5) |
   | 3 | "my pioneer deck needs cheap interaction. one-mana instants, pioneer legal, under 50 cents apiece. whats out there?" | same, third phrasing | as above | 6 (and 5) |
   | 4 | "i want every card whose rules text *starts* with tapping for mana — the very first thing on the card is the tap symbol and then it adds mana. not cards that mention adding mana somewhere in the middle" | anchored text pattern; only regex answers it | `q` contains a regex literal of the `o:/…/` form (`oracle:/…/` counts); a plain `o:"…"` substring search is a fail even if the results look reasonable | 7 (and 5) |
   | 5 | "is there a way to find cards where 'draw a card' is the last thing in the rules text? i keep getting cards that say it in the middle and thats not what i want" | end-anchored pattern | as above | 7 (and 5) |
   | 6 | "looking for cards whose text has a number right before the word 'counters' — the pattern, any number. searching the phrase doesnt work" | character-class pattern | as above | 7 (and 5) |
   | 7 | "my commander list is stalling on mana. what are my options for ramping in green — and i mean cards that actually function as ramp, not cards that happen to say 'land' somewhere" | function, not wording | `q` uses `otag:` or `function:`; a plain oracle-text search is a fail | 8 (and 5) |
   | 8 | "i need more ways to deal with an opposing creature in a mono-black deck. removal of any kind, doesnt have to be destroy" | function, not wording | as above | 8 (and 5) |
   | 9 | "what cards let me go find a specific card out of my library? i dont care what the text says exactly, i care what they do" | function, not wording | as above. If the first tag guess returns zero matches, a revised second call still passes — record both queries | 8 (and 5) |
   | 10 | "my playgroup does a themed cube and this year its squirrels. i need cards with squirrels in the ARTWORK — doesnt matter if the card mentions squirrels at all, i just want the picture to have one" | artwork, not oracle text | `q` uses `art:` or `atag:`; searching oracle text for the subject is a fail | 9 (and 5) |
   | 11 | "building a dragon-art commander deck for the aesthetic. what cards have a dragon painted in the art but arent dragons mechanically?" | artwork vs. type line | as above, and the type exclusion does not collapse into an oracle-text search | 9 (and 5) |
   | 12 | "i want cards where the art shows a ruined city. the art, not the type line" | artwork | as above | 9 (and 5) |
   | 13 | "use the illustrationtag: operator to pull up cards with dragon art — i read about it on a forum" | the failure loop | the first call returns `isError: true`, `error.code: "bad_request"`, `details` containing "All of your terms were ignored"; the model's **next action is another `card_search` call with a revised query**, and the user-facing answer is results. Reporting the failure, asking the user what to do, or answering without retrying are all fails | 12 |
   | 14 | "search illustrationtag:squirrel for me, i want the squirrel art cards" | the failure loop, second shape | as above | 12 |
   | 15 | "how much is a gaea's cradle going for these days? the judge promo one specifically" | card fact → tool call | a `card_search` call **precedes** any stated price, and the figure stated appears in that call's payload. Answering from memory is a fail even if the number is right. If the payload says unavailable, the answer says so with the reason — never `$0`, never a guess | 13 |
   | 16 | "quick sanity check before i sleeve up — is sol ring actually legal in modern or am i thinking of legacy" | card fact → tool call | as above, on `legalities` | 13 |
   | 17 | "what does rhystic study say word for word? i keep misremembering the wording when i explain it to new players" | card fact → tool call | as above, on oracle text | 13 |

   Cases 13 and 14 are the only ones that name an operator, and they name the one the repo has
   verified returns HTTP 400 — `illustrationtag:` (MCP-PRD [§4.1.1](../MCP-PRD.md#411-search-endpoint), re-verified 2026-08-03).
   That is deliberate: criterion 12 needs a *reliably* malformed first query, and inventing a
   second invalid operator to vary the shape is forbidden. If a third failure case is wanted,
   confirm the 400 with **one** polite live call before the run; never guess an operator into
   the set.

7. **The trigger matrix — over-triggering is a failure, not a rounding error.** Criterion 11 and
   the description tuning are measured on 20 queries, ten each way, per the first-party loop's
   own sizing. Pass conditions are uniform: a `should_trigger: true` query passes when the skill
   is consulted; a `should_trigger: false` query passes when it is **not**. Both rates are
   reported, and the description is judged on them jointly — a description that fires on
   everything spends its on-invoke cost for nothing and trains the author to ignore it.

   | # | Query | `should_trigger` | Why this one is in the set |
   |---|---|---|---|
   | 1 | "whats a good two-card package for my simic commander deck that ramps and draws, under about $5 total" | true | budget + function, casual |
   | 2 | "i need to fill out the last 8 slots of a mono-red aggro list for standard, cheap creatures only" | true | format + type + cost |
   | 3 | "help me find enchantments that punish my opponents for drawing cards, must be legal in commander" | true | effect-shaped |
   | 4 | "what white cards exile a creature at instant speed for three mana or less" | true | function + cost |
   | 5 | "i keep seeing cards with cats in the art and i want to build a cube around that" | true | artwork-shaped |
   | 6 | "find me every card whose text matches the pattern of adding two mana of any one color" | true | regex-shaped |
   | 7 | "cheapest way to get a board wipe into my pauper deck" | true | function + price, terse |
   | 8 | "which legendary creatures could be a commander for a lands-matter deck under $20" | true | legality + type + price |
   | 9 | "im drafting a set review, what one-mana green creatures are worth mentioning" | true | type + cost, indirect framing |
   | 10 | "gimme artifacts that make treasure tokens, commander legal, i dont care about price" | true | function, price-free |
   | 11 | "shuffle a deck of 52 cards in python, im writing a blackjack sim for a class project" | false | near-miss: "deck", "cards" |
   | 12 | "whats a good starter deck for my nephew who wants to get into pokemon tcg" | false | near-miss: adjacent TCG |
   | 13 | "my yugioh deck keeps bricking, how many one-of tutors is too many" | false | near-miss: "deck", "tutor" |
   | 14 | "how does the mana cost mechanic in hearthstone differ from paper card games" | false | near-miss: "mana", "card" |
   | 15 | "im making a slide deck for a board meeting on q3 art licensing costs" | false | near-miss: "deck", "art", cost |
   | 16 | "write a regex that matches semver strings in our changelog" | false | near-miss: regex-shaped |
   | 17 | "find every file under src/ that mentions legality and rename the symbol" | false | near-miss: "legality" |
   | 18 | "cheapest flight to seattle under $300 in april, i can be flexible on dates" | false | near-miss: price-ceiling shape |
   | 19 | "summarize the termination clause in ~/docs/lease.pdf for me" | false | genuinely unrelated |
   | 20 | "explain tcp slow start like im five, im debugging a throughput issue" | false | genuinely unrelated |

   The should-not-trigger half is deliberately loaded with near-misses. A set full of obviously
   unrelated prompts scores perfectly and proves nothing; the queries that share "deck", "cards",
   "mana", "art", "tutor", "legality", a price ceiling or a regex request are the only ones that
   can catch a description that matches on keywords instead of intent.

8. **The negative checks run across the full set, not as separate cases.** Three criteria are
   scans over every transcript in both runs, and each needs its observation method written down:
   - **Criterion 10 — `illustrationtag:` never emitted.** Collect every emitted `q` from every
     case in both configurations and scan for the literal string. The denominator is the
     **unprompted** set — cases 1–12 and 15–17 — because cases 13 and 14 hand the operator to the
     model in the prompt. State that exclusion explicitly in the results doc; a "0 occurrences"
     figure with an unstated denominator is not evidence.
   - **Criterion 13 — card facts come from tool calls.** Cases 15–17 are the direct probes, but
     the rule is cross-set: in *any* case, a stated price, legality or oracle text must be
     preceded by a `card_search` call whose payload contains it. A model that answers case 7 with
     a list of card names it never searched for fails criterion 13 there too. This is PLUGIN-PRD
     [§3.6](../PLUGIN-PRD.md#36-skills-carry-instructions-never-facts) measured behaviorally rather than reviewed statically — criterion 4 read the files,
     this reads the behavior.
   - **Criterion 12 — a structured failure produces a revised retry.** Cases 13 and 14 are the
     direct probes, but the rule is cross-set: any call anywhere in the run that comes back
     `isError: true` must be followed by a revised `card_search` call, not by a message to the
     user. Zero matches is **not** a failure — it is a success with `cards: []` and a `note`, and
     grading it as a failed call will mis-score criteria 5, 8 and 12 at once.

9. **Description tuning is in scope, and it invalidates whatever it follows.** The
   `description` + `when_to_use` frontmatter is [PC-01](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) criterion 1's surface, authored in [Slice 8](./TrackB-Slice8.md),
   and requirement 7's rates are the only honest basis for changing it. Rules:
   - Tune on both rates jointly. `run_loop` selects on the held-out test score rather than the
     train score precisely to avoid a description that memorizes the trigger set; do not override
     that with a hand-picked winner that scores better on train.
   - **Re-check the ≤ 1,536-character budget after every tune, before the next run.** The cap is
     the harness's truncation point for `description` + `when_to_use` combined (PLUGIN-PRD [§3.1](../PLUGIN-PRD.md#31-context-budget));
     an optimizer that produces a longer description has produced one whose tail the model never
     sees, and nothing errors.
   - **Any change to the skill — description or body — voids every run that preceded it.** Re-run
     the full behavioral set in fresh sessions and report only post-change numbers. Record each
     tuning iteration with its before/after rates in the results doc, but report a single final
     run to the PRDs. Never assemble a headline number out of two different skill versions.
   - If criteria 6–9 fail in a way tuning cannot fix, that is a **[Slice 8](./TrackB-Slice8.md) defect surfaced here**:
     fix the body, record the fix, re-run everything. Do not accumulate body edits between runs.

10. **Politeness still binds, and parallelism is the wrong shape here.** Every behavioral case
    drives real `card_search` calls at live Scryfall. Card endpoints are capped at 2/sec and
    **deliberately provoking a 429 is forbidden** (MCP-PRD [§3.4](../MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance)) — a 429 locks access for ~30
    seconds and sustained overage risks a ban affecting every user of the application. Specifics:
    - `skill-creator`'s documented loop says to *spawn all runs, with-skill and baseline, in the
      same turn*. **Override that for this skill.** Run cases sequentially, one configuration at
      a time.
    - The client's two rate-limit lanes are **per server process**. Subagents inside one Claude
      Code session share one server and therefore one limiter, which serializes them safely but
      inflates latency until queued calls start timing out — and a timeout gets graded as a
      failed query, which is a measurement artifact masquerading as a skill failure. Separate
      `claude` processes are worse: each starts its own server with its own lanes, so N processes
      means N× the outbound rate and nothing in the server can see it.
    - Budget: 17 cases × 2 configurations × 1–3 calls ≈ 50–100 live calls per full run. If
      `skill-creator` offers a `runs_per_configuration` above 1, leave it at 1 for the first pass
      — it multiplies Scryfall traffic linearly. Raise it only for a named subset, and say so.
    - Cases 13 and 14 provoke an HTTP 400. That is a single deliberate malformed query, which is
      allowed and is the point; it is not rate abuse and must not be confused with a 429.
    - The trigger loop (requirement 7) measures invocation, not execution, so it should generate
      no Scryfall traffic at all. Confirm that in-session; if it turns out to execute the skill,
      the same politeness rules apply to it.

11. **What would mean the compact description has to grow — and where that reopens work.**
    [OQ-01](../MCP-PRD.md#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) asked how Scryfall syntax reaches the model. [Slice 5](./TrackA-Slice5.md) took the compact side: the shipped
    description in `src/tools/register.ts` names the operator *families* (`t:`, `o:`, `f:`,
    `cmc`, `usd`, `otag:`, `art:`, regex) and the pagination contract, and nothing more. Read it
    before designing the grading, because it is exactly what the without-skill baseline has.
    Four outcomes, and only one of them is "grow the description":
    - **With-skill measurably above baseline across families → the split works.** [OQ-01](../MCP-PRD.md#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) answers
      yes; the description stays.
    - **With-skill ≈ baseline on a family → the skill adds nothing there.** The tool description
      is already sufficient for that family. That argues for a *shorter* skill, not a longer
      description. Record it; do not act on it in this slice.
    - **With-skill high, baseline near zero → the skill is doing the work.** Still yes: the split
      works, and that is the delta the whole slice exists to produce.
    - **With-skill high, baseline near zero, *and* a realistic path where the skill never
      fires** — the description had to be narrowed to control over-triggering, or the skill
      listing gets budget-trimmed on a loaded machine (PLUGIN-PRD [§3.1](../PLUGIN-PRD.md#31-context-budget), [PQ-04](../PLUGIN-PRD.md#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed)). Then the tool
      description is the only surface left and it has to carry more. **That reopens work in the
      server, not just the skill**: `src/tools/register.ts`, a rebuilt and recommitted
      `dist/index.js`, and MCP-PRD's own note that tool-description length is a product concern.
      It is also not free — a tool schema cannot be budget-trimmed the way a skill description
      can ([PQ-01](../PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports)), so every character is paid in every session forever. **This slice does not
      make that change.** Record the finding, say plainly in the [OQ-01](../MCP-PRD.md#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) status paragraph that the
      description must grow, and let it be its own slice.

12. **Both PRDs are updated in the same session.** A slice that resolves an open question updates
    the owning PRD's §7 entry and appends a §9 revision-log row; the roadmap's status column is
    not a substitute. **Both §9 tables are append-only** — do not edit an existing row, reorder,
    renumber, or reword a rationale.

    [`docs/PLUGIN-PRD.md`](../PLUGIN-PRD.md) [§9](../PLUGIN-PRD.md#9-revision-log) — one appended row:

    ```
    | <date> | **PC-01 behavioral criteria 5–13 measured** against a without-skill baseline in
    fresh sessions: <n> behavioral cases (combined legality/type/cost/price, regex, otag/function,
    art, failure-loop, card-fact) plus <n> trigger queries. With-skill vs. baseline — valid-query
    rate <x>/<n> vs <y>/<n>; regex <x>/<n> vs <y>/<n>; otag|function <x>/<n> vs <y>/<n>;
    art <x>/<n> vs <y>/<n>; combined legality+type+cost+price <x>/<n> vs <y>/<n>; failure-loop
    retry <x>/<n> vs <y>/<n>; card-fact tool call <x>/<n> vs <y>/<n>. Should-trigger <x>/10,
    should-not-trigger <x>/10. `illustrationtag:` emitted unprompted <n> times across <n>
    transcripts. Description tuned <n> times; final `description` + `when_to_use` = <n>
    characters (≤1,536). Results: docs/slices/TrackB-Slice9-results.md. | Track B Slice 9
    (docs/DEV-ROADMAP.md) — the measurement PC-01's eval-method preamble prescribes, and the
    evidence `docs/MCP-PRD.md` OQ-01 was waiting on. |
    ```

    [`docs/MCP-PRD.md`](../MCP-PRD.md) [§7](../MCP-PRD.md#7-open-questions), [OQ-01](../MCP-PRD.md#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) — one appended dated paragraph, **below** the existing
    "Status 2026-08-03" paragraph, which stays exactly as written. [§7](../MCP-PRD.md#7-open-questions)'s rule is that questions
    stay until answered, and [§4](../MCP-PRD.md#4-external-dependencies)'s discipline is dated addenda rather than overwrites:

    ```
    **Status <date>: measured.** <One or two sentences: with-skill vs. without-skill rates on the
    operator families the compact description names.> The compact-description split <holds | does
    not hold>: <what the numbers say>. <If it holds: the description stays as shipped and this
    question is answered. If it does not: what has to change in src/tools/register.ts, that
    changing it requires a rebuilt dist/, and that a longer tool description is an unbudgetable
    always-on cost (PLUGIN-PRD PQ-01).> Evidence: docs/slices/TrackB-Slice9-results.md and
    docs/PLUGIN-PRD.md §9.
    ```

    [`docs/MCP-PRD.md`](../MCP-PRD.md) [§9](../MCP-PRD.md#9-revision-log) — one appended row:

    ```
    | <date> | **OQ-01 answered empirically.** PC-01's behavioral criteria measured with and
    without the `scryfall-query-craft` skill in fresh sessions. The compact `card_search`
    description plus the skill <is | is not> sufficient for Claude to emit valid regex, `otag:`
    and `art:` queries from plain-English requests (<x>% vs <y>% baseline). <No change to
    src/tools/register.ts | The description must grow — see the OQ-01 status paragraph.>
    Results: docs/slices/TrackB-Slice9-results.md. | Track B Slice 9 (docs/DEV-ROADMAP.md) — the
    measurement OQ-01's "resolves by" clause called for. The 2026-08-03 half-committed status is
    superseded by a dated result rather than overwritten. |
    ```

    **Do not change [PC-01](../PLUGIN-PRD.md#pc-01--scryfall-query-craft)'s `Status` field.** PLUGIN-PRD [§5](../PLUGIN-PRD.md#5-components)'s component-block template is
    reproduced verbatim for every component and says "Do not modify it"; its status vocabulary is
    `proposed | specified | deferred` and has no `delivered` value. Record delivery in [§9](../PLUGIN-PRD.md#9-revision-log) instead.
    A short dated "Measurement note" bullet appended to [PC-01](../PLUGIN-PRD.md#pc-01--scryfall-query-craft)'s block is permitted — [CAP-01](../MCP-PRD.md#cap-01--card-search)'s
    "Delivery note (2026-08-03)" is the precedent — but extending the status enum would be its
    own decision needing its own §9 row, exactly as MCP-PRD's 2026-08-04 row did for CAP blocks.

13. **One documentation discrepancy to notice, not to silently patch.** [PC-01](../PLUGIN-PRD.md#pc-01--scryfall-query-craft)'s eval-method
    preamble says "Criteria 5–11 are behavioral" while the criteria list runs to 13 and criteria
    12–13 are plainly behavioral; [`docs/DEV-ROADMAP.md`](../DEV-ROADMAP.md) [§4](../DEV-ROADMAP.md#4-phase-1-slices) says 5–13. **Measure 5–13.** If the
    session chooses to correct the preamble's "5–11" to "5–13", that is a factual correction, not
    a reopened decision, and it needs its own §9 row saying so — the same way the 2026-07-30 rows
    in both documents record presentation-only changes.

## Interface contracts

This slice creates no code and changes no interface. What it consumes, all of it established in
Slices 3 and 5 and unchanged here:

- **Tool name:** `mcp__plugin_manabase_mtg__card_search` when running inside the installed
  plugin ([P-12](../PLUGIN-PRD.md#p-12--plugin-name-and-server-key)); the server itself registers the bare `card_search`. Which string a transcript
  shows depends on how the baseline is run (requirement below) — record which.
- **Arguments:** required `q` (string); optional `unique` (`cards`|`prints`|`art`), `order`,
  `dir` (`auto`|`asc`|`desc`), `page` (integer ≥ 1). **Trap:** `unique` can be expressed either
  as a token inside `q` or as the parameter. A grader that reads only `q` will miss the parameter
  form and mis-grade. Read both.
- **Success payload:** `JSON.parse(content[0].text)` → `CardSearchData` — `cards[]` (each with
  `price` as `PriceInfo`), `total_cards`, `has_more`, and `note` when more pages exist.
- **Failure payload:** `isError: true` with `{ error: { code, message, details?, status? } }`.
  `code: "bad_request"` plus Scryfall's verbatim `details` is what criterion 12's retry must be a
  response to.
- **Zero matches is a success**, not a failure: `cards: []`, `total_cards: 0`, plus a `note`.
  Scryfall answers a valid zero-match query with HTTP 404 and the handler maps it to an empty
  success on purpose. Grading it as a failure corrupts three criteria at once.

**How the baseline is run is itself a contract, and it has a trap.** The without-skill run must
have the search tool available and the skill unavailable *at the same time*. Disabling the whole
plugin removes both, and a baseline with no tool measures nothing. Worse, a plugin left enabled
puts the skill in `available_skills` for every session including the baseline subagent, so a
"no skill path" baseline can still be contaminated by auto-invocation. Verify the mechanism
in-session — candidates are `skill-creator`'s own baseline configuration and any per-component
toggle the harness offers — and record which was used. If the only workable route is running the
server standalone outside the plugin, note that the tool then appears under a different scoped
name, which is a confound that must be written into the results doc, and **do not edit the repo's
`.mcp.json` to achieve it**: it is the plugin's shipped declaration and uses
`${CLAUDE_PLUGIN_ROOT}`, which does not substitute outside a plugin context. Use a throwaway
config outside the repo.

## Out of scope — do NOT

- **No server changes.** `src/`, `dist/`, `tests/`, `scripts/` are untouched. If the measurement
  says the tool description must grow, that is a finding recorded here and a separate slice.
- **No `SKILL.md` rewrite.** Description tuning and defects forced by a measured failure are in
  scope (requirement 9); rewriting the body because it reads better is [Slice 8](./TrackB-Slice8.md)'s job.
- **No context-cost measurement** — [PC-01](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) criterion 2, `claude plugin details`, `/context`,
  `/doctor`, [PQ-01](../PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports), [PQ-02](../PLUGIN-PRD.md#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed) are [Slice 10](./TrackC-Slice10.md).
- **No re-derivation of [PC-01](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) criteria 1–4**, beyond the ≤ 1,536-character re-check after a tune.
- **No parallel eval execution, no 429 provocation, no extra query sweeps "for more data."**
- **No edits to [`docs/PLUGIN-PRD.md`](../PLUGIN-PRD.md) or [`docs/MCP-PRD.md`](../MCP-PRD.md)** beyond the appended rows and the
  [OQ-01](../MCP-PRD.md#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) status paragraph named in requirement 12. No [`docs/DEV-ROADMAP.md`](../DEV-ROADMAP.md) edits beyond the
  status cell, the two done-when boxes and a `Landed:` line.
- **No new npm dependencies and no CI wiring for evals** — they hit a third party and consume
  model time; CI work is a Track C slice.

## Acceptance criteria

1. `evals/evals.json` exists, conforms to the schema verified in-session, and carries all 17
   behavioral cases with prompts verbatim and per-case expectations a grader can apply
   mechanically. `evals/trigger-evals.json` carries the 20 trigger queries with their
   `should_trigger` values.
2. Both configurations ran to completion, sequentially, in fresh per-case sessions, with the
   search tool available in **both** — and the results doc names the mechanism that made the
   skill unavailable in the baseline.
3. [PC-01](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) criteria 5–13 each have a recorded result **and** its baseline, expressed as a pair
   with a delta. Any criterion evidenced by a single prompt is recorded as *not measured*.
4. Criterion 10's cross-set scan is reported with its denominator and the cases 13–14 exclusion
   stated explicitly.
5. If the description was tuned: the final `description` + `when_to_use` character count is
   recorded and ≤ 1,536, and every reported number comes from one single post-tune full run.
6. [`docs/PLUGIN-PRD.md`](../PLUGIN-PRD.md) [§9](../PLUGIN-PRD.md#9-revision-log) has exactly one new row — `git diff` shows one appended table row and
   nothing else. [PC-01](../PLUGIN-PRD.md#pc-01--scryfall-query-craft)'s `Status` field is unchanged.
7. [`docs/MCP-PRD.md`](../MCP-PRD.md) shows exactly one appended [§9](../MCP-PRD.md#9-revision-log) row plus one appended dated paragraph under
   [OQ-01](../MCP-PRD.md#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model), and nothing else. The 2026-08-03 OQ-01 status paragraph is intact.
8. `docs/slices/TrackB-Slice9-results.md` exists with per-case evidence, the aggregate
   with/without table, the tuning history, the call count and elapsed time, and an explicit
   [OQ-01](../MCP-PRD.md#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) verdict naming which of requirement 11's four outcomes was observed.
9. No HTTP 429 was observed or provoked at any point in the slice.
10. Tree committed clean; `git status` shows no change under `src/`, `dist/`, `tests/`.

## Testing requirements

There is no unit test here. The eval set is the test and the transcripts are the evidence, so
the discipline has to come from how grading is done:

- **Grade from the transcript, not the prose answer.** A model that answers case 16 correctly
  from its own knowledge fails criterion 13 even though the answer is right. Correctness of the
  answer is not what any of these criteria measure.
- **Record every emitted `q` verbatim, for every call, in both configurations.** A pass with no
  recorded query is unfalsifiable and is worth nothing to the next session.
- **Grade should-not-trigger on skill invocation, not on tool calls.** The model may call
  `card_search` without the skill firing, or fire the skill and never call the tool. Those are
  different outcomes and both must be recorded separately.
- **State N per criterion.** [PC-01](../PLUGIN-PRD.md#pc-01--scryfall-query-craft)'s preamble requires results phrased as "on N held-out prompts
  of this shape" precisely because one passing prompt is not evidence about a skill.
- **Record failures as findings, not as noise.** A criterion that fails is the slice working;
  what makes the run worthless is a criterion recorded without its baseline.

## Verification steps

```bash
# 0) the server under measurement must be the one in src/ — check before the first run
npm run typecheck && npm test && npm run build
git status --porcelain dist/          # must be empty; a stale dist/ silently invalidates the run

# 1) read the first-party schema and loop in this session, before writing any JSON
#    ~/.claude/plugins/marketplaces/claude-plugins-official/plugins/skill-creator/
#      skills/skill-creator/references/schemas.md      <- evals.json + benchmark.json shapes
#      skills/skill-creator/SKILL.md                   <- the run loop and description optimization

# 5) exactly what changed in the PRDs, and nothing more
git diff docs/PLUGIN-PRD.md           # one appended §9 row
git diff docs/MCP-PRD.md              # one appended §9 row + one appended OQ-01 paragraph
git status --porcelain src/ dist/ tests/   # must be empty
```

In Claude Code, between steps 1 and 5:

```
/plugin marketplace add njohnb/Manabase   # owner/repo form ONLY — never a raw URL to
                                          # marketplace.json; it fetches only that file and the
                                          # relative plugin source silently fails to resolve
/plugin install manabase@manabase
/mcp                                      # confirm the server is connected before measuring
```

2. Run the behavioral set with the skill available — sequential, fresh session per case.
3. Run the same set as the baseline — skill unavailable, **tool still available**.
4. Run the trigger loop for criterion 11; if it tunes the description, re-check the 1,536-char
   budget and re-run steps 2 and 3 in full before reporting anything.

## References

- [`docs/DEV-ROADMAP.md`](../DEV-ROADMAP.md) [§4](../DEV-ROADMAP.md#4-phase-1-slices) Slice 9 (goal and done-when), [§5](../DEV-ROADMAP.md#5-order-and-parallelism) (the graph — Slice 9 needs 7 and 8
  and is on the critical path), [§3](../DEV-ROADMAP.md#3-standing-rules--apply-to-every-slice-never-restated-per-slice) (standing rules, never restated per slice).
- [`docs/PLUGIN-PRD.md`](../PLUGIN-PRD.md) [PC-01](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) — behavior, the eval-method preamble, and criteria 5–13, which are
  the contract this slice closes; [§3.1](../PLUGIN-PRD.md#31-context-budget) (context budget: the 1,536-character cap, the 5,000-token
  compaction window, and the silent degradation that makes requirement 11's fourth outcome
  real); [§3.6](../PLUGIN-PRD.md#36-skills-carry-instructions-never-facts) (skills carry instructions, never facts — criterion 13 measured); [§4.1](../PLUGIN-PRD.md#41-harness-features-relied-on) (skill
  mechanics and the scoped tool name); [§9](../PLUGIN-PRD.md#9-revision-log) (revision log, append-only).
- [`docs/MCP-PRD.md`](../MCP-PRD.md) [OQ-01](../MCP-PRD.md#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) (the question this slice answers, with its 2026-08-03 half-committed
  status); [CAP-01](../MCP-PRD.md#cap-01--card-search) (what the tool guarantees and how failures are shaped); [§4.1.1](../MCP-PRD.md#411-search-endpoint) (the verified
  operators the prompts exercise, and `illustrationtag:` as the known HTTP 400); [§3.4](../MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance) (rate
  limits are hard constraints, not guidance); [§9](../MCP-PRD.md#9-revision-log) (revision log).
- `src/tools/register.ts` — the shipped compact description and input schema. This is exactly
  what the without-skill baseline has and nothing more; read it before grading anything.
- [`docs/slices/TrackA-Slice6.md`](./TrackA-Slice6.md) and [`docs/slices/TrackA-Slice6-results.md`](./TrackA-Slice6-results.md) — the measurement-
  slice precedent: an inlined check matrix, a results document, and a single appended §9 row.
