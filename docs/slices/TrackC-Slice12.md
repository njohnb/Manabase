# Track C — Slice 12: Docs polish & friend dry-run

> Self-contained implementation spec. You do not need to read the PRDs to build this slice;
> everything binding is inlined. PRD references are pointers for deeper context only.

> **Amended 2026-08-25 — this slice is re-pointed, and it now runs AFTER
> [Slice 18](./TrackC-Slice18.md). Read this before the 2026-08-09 block below.**
>
> The 2026-08-11 partial run is recorded in
> [`TrackC-Slice12-results.md`](./TrackC-Slice12-results.md) and stands as written. It closed the
> docs half — **acceptance criteria 1–5, 9, 10 and 11 are met** — and left criterion 8 failing
> outright with 6 and 7 partial. **What remains of this slice is one cold run and nothing else.**
>
> **Four things change, and none of them is a change of intent.**
>
> 1. **The run moves behind [Slice 18](./TrackC-Slice18.md), which did not exist when this was
>    written.** The reason is the artifact: `v0.1.0` and `v0.1.1` both predate
>    [Slices 15–17](../DEV-ROADMAP.md#7-phase-2-slices--combo-discovery), so a cold run today
>    installs a bundle carrying **one** tool while `main` already registers two and
>    [PR #53](https://github.com/njohnb/Manabase/pull/53) makes it three. Sending a stranger at a
>    knowingly stale artifact spends the one resource this project cannot buy twice. After
>    [Slice 18](./TrackC-Slice18.md) and that PR there is a `v0.3.0` bundle carrying all three,
>    produced by the automated pipeline, and **that** is what the cold reader installs.
> 2. **This slice no longer gates [Slice 13](./TrackC-Slice13.md)'s
>    [`P-08`](../PLUGIN-PRD.md#p-08--version-scheme) switchover.**
>    [Slice 18](./TrackC-Slice18.md) absorbs it, deliberately inverting the order, and that slice's
>    *Why this slice exists* section carries the argument. The Goal paragraph below still says the
>    dry run gates [Slice 13](./TrackC-Slice13.md); **that sentence is superseded.** What this slice
>    still gates is [Slice 13](./TrackC-Slice13.md)'s Phase 1 closing row, which cannot honestly be
>    written while a `PC` criterion is unverified for want of a cold reader.
> 3. **Requirement 4 and acceptance criterion 2 read `/doctor`; the friend runs `/context`.** The
>    2026-08-09 block below already made that substitution and the README already says `/context`.
>    Restated here because the 2026-08-11 run never collected it and it is the single most
>    forgettable item on the list.
> 4. **Acceptance criterion 10's `--strict` clause changes meaning.** It has been failing on exactly
>    one warning — [`P-08`](../PLUGIN-PRD.md#p-08--version-scheme)'s unset `version`. After
>    [Slice 18](./TrackC-Slice18.md) that warning is gone, so criterion 10 becomes achievable in
>    full and must be re-run rather than assumed. That also clears
>    [`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) criterion 9, which
>    [Slice 18](./TrackC-Slice18.md) records.
>
> **What the re-run must collect**, from
> [`TrackC-Slice12-results.md`](./TrackC-Slice12-results.md)'s own closing list, plus two items
> [Slice 18](./TrackC-Slice18.md) adds:
>
> 1. The handover message, sent and kept **verbatim**.
> 2. Three or four Magic questions in the friend's own words, and whether a tool call appeared.
> 3. `/context` once, pasted back — on whichever surface they are on.
> 4. Whether **anything** prompted at either install —
>    [`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) criterion 2 and
>    [`PC-03`](../PLUGIN-PRD.md#pc-03--mcpb-bundle-for-the-chat-tab) criterion **8**, the latter
>    still the only unverified criterion on that component.
> 5. Hesitations written down **as they happen**, including the ten-second ones.
> 6. **New — whether the two installed artifacts report the same version**, now that the plugin
>    carries an explicit one. A friend who can read a version is the first person who could ever
>    notice a stale bundle, which is
>    [`PQ-06`](../PLUGIN-PRD.md#pq-06--what-keeps-the-committed-dist-honest)'s open user-facing half.
> 7. **New — whether a combo question reaches `combo_search` or `combo_find_deck`.** The skill
>    ([`PC-01`](../PLUGIN-PRD.md#pc-01--scryfall-query-craft)) teaches Scryfall query craft and says
>    nothing about combos, so this observes an unskilled tool on a stranger's phrasing.
>
> **Two conditions that have not changed.** The first installer is **spent as a cold reader** —
> requirement 9's re-run clause requires a different person. And **the author must not be on a
> call**: that is what cost the 2026-08-11 run criteria 6, 7 and 8, and nothing on the list above
> needs the author present.

> **Amended 2026-08-09 — read this before acting on the requirements below.** This spec was written
> 2026-08-04 and five slices landed between then and the session that opened it. Its original text is
> left exactly as written; five things about it are no longer true, and none of them is a change of
> intent. Checking a spec's premises before building on them is [Slice 11](./TrackC-Slice11.md)'s
> precedent.
>
> 1. **Requirement 1 was already done.** `unwritten`, `nobody has yet` and `placeholder` return zero
>    matches in [`README.md`](../../README.md); the status text and the repository-layout line were
>    corrected by earlier reconciliation commits, which also cite Slices 7–10 by results path.
>    **Acceptance criterion 5 was satisfied before this slice opened.** So were criterion 3 (the
>    disclaimer script reports `OK` on all four comparisons; the two JSON `description` fields are
>    byte-identical) and criterion 4 (the raw-URL blockquote already states the rule without showing
>    a URL). Requirement 6's review still applies to whatever this slice *adds*.
> 2. **`/doctor` is superseded by `/context` throughout — requirement 2.3, requirement 4, and
>    acceptance criterion 2.** [Slice 10](./TrackC-Slice10.md) measured `/doctor` on Claude Code
>    2.1.226 as a health-check workflow that **neither prices the skill listing against a budget nor
>    names contributors**; [`docs/PLUGIN-PRD.md`](../PLUGIN-PRD.md) [§4.6.1](../PLUGIN-PRD.md#461-addendum-2026-08-08--measured-on-claude-code-21226)
>    records it and [PQ-04](../PLUGIN-PRD.md#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed)'s
>    *Amended 2026-08-08* block moves the diagnosis clause to `/context`, leaving its first two
>    sentences standing. [`README.md`](../../README.md)'s bullet was corrected in place on
>    2026-08-08. **The friend runs `/context`, and criterion 2 reads `/context`.** What
>    [PQ-04](../PLUGIN-PRD.md#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed)
>    still owed this slice is the **by-name recovery clause** — invoke
>    `/manabase:scryfall-query-craft`, which survives trimming because trimming keeps names — and
>    that is the part this slice actually writes.
> 3. **Acceptance criterion 10's `claude plugin validate . --strict` clause cannot pass here.** It
>    fails on exactly one warning: [P-08](../PLUGIN-PRD.md#p-08--version-scheme)'s deliberately unset
>    `version`. That is the same reason [PC-02](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) criterion
>    9 is deliberately open, and it closes at [Slice 13](./TrackC-Slice13.md). Non-strict validation
>    passing, plus that single known warning, is the achievable form. The link half of criterion 10
>    is met and must be re-checked after every edit.
> 4. **The Chat-tab download line inherited from [Slice 11](./TrackC-Slice11.md) re-defers to
>    [Slice 13](./TrackC-Slice13.md).** `docs/DEV-ROADMAP.md` [§4](../DEV-ROADMAP.md#4-phase-1-slices)
>    deferred "`README.md`'s Chat-tab instructions point at that download instead of a local build"
>    to this slice as the owner of the README. No `v*` tag exists, `release.yml` has never run, and
>    cutting the first release is [Slice 13](./TrackC-Slice13.md)'s. Pointing a cold reader at a
>    download that does not exist is the class of false claim this project keeps correcting, so the
>    build-it-yourself text stays — it is currently true.
> 5. **The troubleshooting section had already grown past the three bullets requirement 2 describes.**
>    It carried five when this slice opened, including the `/context` correction and a Chat-tab
>    surface entry. Requirement 2's four failure modes are written as full symptom / check / next
>    action entries and the three surviving bullets are kept, so the section gains structure rather
>    than replacing what was there.
>
> **What was genuinely left, and is what this slice does:** requirement 2's four-mode
> troubleshooting section, [PQ-04](../PLUGIN-PRD.md#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed)'s
> unwritten by-name recovery clause, whatever the cold read exposes — and the dry run itself, which
> is the acceptance gate and cannot be performed by the author.

**Goal.** Make `README.md` sufficient for a non-author, and prove it with one real install
performed by someone who is not the author and who receives no help. Everything else in this
slice — the troubleshooting section, the `/doctor` line, the three-place disclaimer check — is
preparation for that single test. The dry run is the acceptance gate, and [Slice 13](./TrackC-Slice13.md) (the [P-08](../PLUGIN-PRD.md#p-08--version-scheme)
release switchover) does not open until its result is recorded in [`docs/PLUGIN-PRD.md`](../PLUGIN-PRD.md).

## Preconditions

`docs/DEV-ROADMAP.md` [§5](../DEV-ROADMAP.md#5-order-and-parallelism) puts three edges into this slice — 6 → 12, 9 → 12, 10 → 12. Each is a
genuine prerequisite, not a courtesy ordering.

- **[Slice 6](./TrackA-Slice6.md) — live [CAP-01](../MCP-PRD.md#cap-01--card-search) acceptance (done, PR #7).** Every claim the README makes about what
  the server actually returns rests on [`docs/slices/TrackA-Slice6-results.md`](./TrackA-Slice6-results.md). Without it the
  README is asserting behavior nobody has watched, and a friend's "it gave me a weird answer"
  cannot be separated from "the server is wrong."
- **[Slice 9](./TrackB-Slice9.md) — [PC-01](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) evals.** `skills/scryfall-query-craft/SKILL.md` must exist *and* have been
  measured against a without-skill baseline. **A friend cannot dry-run a plugin whose skill has
  not been evaluated:** the single most valuable observation the dry run can make is whether the
  skill fires unprompted on someone else's machine, on their phrasing — and that observation is
  uninterpretable without a recorded baseline to compare it against. Absent [Slice 9](./TrackB-Slice9.md), "Claude
  didn't reach for it" is indistinguishable between a budget-trimmed listing, a weak
  `description`, and a prompt the skill was never meant to catch.
- **[Slice 10](./TrackC-Slice10.md) — context-cost measurement.** The docs cannot state a context cost that has not
  been measured. More pointedly, [PQ-04](../PLUGIN-PRD.md#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed)'s chosen mitigation is a README line telling the user to
  run `/doctor`, and that line is only worth writing if [Slice 10](./TrackC-Slice10.md) established what a *healthy*
  listing looks like on the author's own machine ([PQ-02](../PLUGIN-PRD.md#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed)). Otherwise the friend runs `/doctor`,
  reads a number, and has nothing to compare it to.
- **Inherited from [Slice 7](./TrackB-Slice7.md) via [Slice 9](./TrackB-Slice9.md) — name it anyway.** The plugin must already have been
  installed from the marketplace at least once, by the author, on a profile that had never seen
  it. This slice must not be the first time anyone installs the plugin. If it is, a failed
  friend install cannot be attributed: documentation defect and packaging defect look identical
  from the outside.

## Context

Manabase is a Magic: The Gathering MCP server (Scryfall-backed card search) that ships inside a
Claude Code plugin. Track A built the server, Track B built the thing a user installs, Track C
measures and releases it. This is slice 12 of 13 — the last gate before the [P-08](../PLUGIN-PRD.md#p-08--version-scheme) switchover.

**A README that is correct for the author is not the test.** The author has a warm plugin cache,
Node already on `PATH`, a machine that has resolved `${CLAUDE_PLUGIN_DATA}` before, and — the
expensive part — every unstated assumption already satisfied inside their own head. Every slice
before this one was verified by the person who wrote it, which was fine because every one of them
had a mechanical pass/fail. This one does not and cannot: the deliverable is evidence produced by
someone who does not already know the answer. That is the reason this slice exists instead of a
careful self-review of the README.

## Deliverables

| File | Action |
|---|---|
| `README.md` | modify — troubleshooting section, `/doctor` line, stale status text, disclaimer and install form verified |
| `docs/slices/TrackC-Slice12-results.md` | new — the recorded dry run, the friend's verbatim outputs, the issue index |
| GitHub issues on `njohnb/Manabase` | new — one per point of friction, filed during or immediately after the run |
| [`docs/PLUGIN-PRD.md`](../PLUGIN-PRD.md) | modify — [PQ-04](../PLUGIN-PRD.md#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed)'s disposition appended to its [§7](../PLUGIN-PRD.md#7-open-questions) entry; one appended [§9](../PLUGIN-PRD.md#9-revision-log) revision-log row |

## Requirements

1. **Bring the README's status text current before anything else.** As of this writing it says
   the query-craft skill "is unwritten and nobody has yet installed this from a marketplace, so
   the two commands below are the intended path rather than a verified one," and the repository
   layout block marks `skills/scryfall-query-craft/` as "(placeholder — not written yet)." After
   Slices 7–10 both statements are false. Correct them to what those slices actually recorded,
   citing the results docs. **Keep "Status: pre-release."** — declaring the plugin public is
   [Slice 13](./TrackC-Slice13.md)'s act, not this one's.

2. **The troubleshooting section is the substantive writing in this slice.** The README already
   has an *If something is wrong* section with three bullets; expand it to cover the four failure
   modes below. Each entry must carry three things, in this order: **the symptom the user
   actually observes** (in a user's words, not a maintainer's), **the check that distinguishes
   this case from the others**, and **what to do next**. A troubleshooting section that lists
   causes without a discriminating check is a list of things to worry about.

   1. **The server is not connected.** Symptom: Claude answers Magic questions from memory, or
      says it cannot look anything up, and no tool call ever appears. Check: `/mcp` — the
      manabase server appears there with a plugin indicator. Three distinct states hide behind
      one symptom and the section must separate them: absent from `/mcp` entirely (the plugin is
      not installed or not enabled — check `/plugin`), present but not connected (a start
      failure — go to `claude --debug` and read the startup output), or present and deliberately
      toggled off (a user can disable a plugin's server in `/mcp` without uninstalling the
      plugin; the fix is to toggle it back on, not to reinstall).
   2. **The tools are absent even though the plugin is installed.** This is the nearly invisible
      one and it needs the plainest writing in the file: **a server that fails to start produces
      no error the user will ever see — the tools are simply missing.** Say that outright. A user
      who does not know it will spend their time hunting for an error message that does not
      exist. Phase 1 can only document this (PLUGIN-PRD [PC-02](../PLUGIN-PRD.md#pc-02--bundled-mcp-server), *what the user sees when something
      is wrong*); do not spec a fix here. Checks, cheapest first: `node --version` in a terminal,
      because Node on `PATH` is the plugin's only runtime prerequisite and its absence produces
      exactly this symptom on a fresh machine; then `/mcp` for connected-vs-not; then
      `claude --debug` for the reason.
   3. **The skill stops firing.** Symptom, and phrase it the way a user would: *"sometimes it
      doesn't seem to know about Magic"* — the tools work when Claude is told to search, but it
      no longer reaches for them on its own. Check: `/doctor`, which estimates the skill
      listing's cost against the budget and names the biggest contributors; `/context`'s Skills
      row reports the listing size after the budget is applied. State the mechanism, because
      without it the advice reads as superstition: the skill listing is capped at a fraction of
      the context window, and when it overflows Claude Code drops the descriptions of the
      least-used skills while keeping their names — the skill stays invocable, nothing errors,
      but automatic invocation stops (PLUGIN-PRD [§3.1](../PLUGIN-PRD.md#31-context-budget)). Give the two honest remedies: invoke it
      explicitly as `/manabase:scryfall-query-craft`, or reduce what else is installed. Say that
      **this plugin cannot raise the budget on the user's behalf** — a plugin's root
      `settings.json` supports only the `agent` and `subagentStatusLine` keys — so nobody goes
      looking for a setting Manabase could have shipped.
   4. **A stale install.** Symptom: a fix that is supposedly shipped is not present, or the
      behavior changed halfway through a session. Checks: `/plugin` shows the installed version —
      during development `version` is unset, so it resolves to the source commit SHA and every
      commit is an update ([P-08](../PLUGIN-PRD.md#p-08--version-scheme)); `/plugin update` pulls it. The trap this entry exists to
      pre-empt: **a mid-session plugin update leaves the running server on the old
      `${CLAUDE_PLUGIN_ROOT}` until `/reload-plugins`**, so an update can be installed and not yet
      in effect, which reads to the user as "the update did nothing."

   Keep the existing Scryfall-outage bullet. An unreachable upstream is a structured failure the
   model can act on, not a dead server and not a stack trace ([PC-02](../PLUGIN-PRD.md#pc-02--bundled-mcp-server), MCP-PRD [D-10](../MCP-PRD.md#d-10--tool-handlers-never-throw)), and Scryfall
   being down is a total outage for Phase 1 — the README should keep saying so plainly.

3. **Invent no commands.** `/mcp`, `/doctor`, `/context`, `/plugin`, `/plugin update`,
   `/reload-plugins`, `/manabase:scryfall-query-craft`, and `claude --debug` are all named in
   [`docs/PLUGIN-PRD.md`](../PLUGIN-PRD.md) or [`docs/MCP-PRD.md`](../MCP-PRD.md); `node --version` is plain shell. Anything beyond
   that list you must confirm in-session against live documentation or your own terminal before
   it goes in the README, or phrase it as something the reader checks rather than something you
   assert. A troubleshooting section that names a flag that does not exist is worse than no
   troubleshooting section, because it burns the reader's trust at the exact moment they are
   already stuck.

4. **[PQ-04](../PLUGIN-PRD.md#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed)'s answer is "documentation is the chosen mitigation" — and this slice confirms it
   rather than assumes it.** [PQ-04](../PLUGIN-PRD.md#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed) asks how the author would detect that a *friend's* skill
   listing has been budget-trimmed; the degradation is silent and `/doctor` is local, so the
   author cannot observe it remotely. The concrete artifact is requirement 2.3's line: run
   `/doctor` if the plugin stops firing. **The dry run is the confirmation step.** The friend is
   asked to run `/doctor` once and paste the output back whether or not anything appears wrong —
   that paste is the only way this project ever observes someone else's budget. Three outcomes,
   and all three are recordable results:
   - The friend's listing is healthy and `/doctor` reports it legibly → **[PQ-04](../PLUGIN-PRD.md#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed) answered.**
     Documentation is the chosen mitigation; the README line is the artifact; the friend's output
     is the evidence.
   - The friend's listing is trimmed and `/doctor` surfaces it → **[PQ-04](../PLUGIN-PRD.md#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed) answered**, and more
     strongly: the mitigation was exercised in anger rather than in theory. Record what they saw.
   - The friend's listing is trimmed and `/doctor` does *not* surface it — or the friend cannot
     tell from the output whether it is trimmed — → **[PQ-04](../PLUGIN-PRD.md#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed) reopens**, in `docs/PLUGIN-PRD.md`
     [§7](../PLUGIN-PRD.md#7-open-questions), with the specific gap the dry run revealed written down.

   Reopening is not a slice failure. **Only an unrecorded outcome is a failure.** Do not close
   [PQ-04](../PLUGIN-PRD.md#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed) by asserting the README line is sufficient without having watched a non-author use it.

5. **The disclaimer surface check is a three-place verbatim check, and it is mechanical.**
   PLUGIN-PRD [§3.5](../PLUGIN-PRD.md#35-what-the-user-must-see-and-must-not) requires the Fan Content disclaimer on `plugin.json`'s `description`, the
   marketplace entry, and the README. The canonical string is reproduced under *Interface
   contracts* below. Compare by normalizing runs of whitespace to a single space and then
   comparing the resulting strings — the README wraps the disclaimer across three lines and the
   JSON files carry it on one, so a naive byte comparison fails for the wrong reason. Read every
   file as UTF-8: `©` is U+00A9, not `(c)`, and "©Wizards" has no space after the symbol. The
   check script is in *Verification steps*; run it, do not eyeball it. "Looks correct" has
   already failed this class of check in other projects.

   One thing to check and **record rather than change**: `marketplace.json` carries the
   disclaimer on `plugins[0].description` but not on the catalog's own top-level `description`.
   [§3.5](../PLUGIN-PRD.md#35-what-the-user-must-see-and-must-not) names "the marketplace entry," which is the plugin entry, so the requirement is met.
   [§3.5](../PLUGIN-PRD.md#35-what-the-user-must-see-and-must-not) is locked; if you believe the catalog description also needs it, that is a PRD question,
   not a quiet edit.

6. **The raw-URL trap must never appear in the README, in any framing.** Adding the marketplace
   by a direct URL to `marketplace.json` downloads only that one file and the plugin's relative
   source silently fails to resolve — a partial, confusing failure rather than a clean one
   ([P-11](../PLUGIN-PRD.md#p-11--the-repo-is-its-own-marketplace)). The README's current warning blockquote states the rule *without showing a URL*, which
   is correct and must stay that way. **Review the finished README specifically for this**,
   because the natural instinct when documenting a trap is to demonstrate it, and a "don't do
   this" example is a copyable example. Always `owner/repo`.

7. **The friend dry-run protocol, and its one hard rule: no author intervention.**

   - **What the friend is given:** a link to the repository. Nothing else. No walkthrough, no
     "you'll need Node first," no pre-flight check of their machine, no screen share, no
     standing by on a call. **Reproduce the handover message verbatim in the results doc**, so a
     later reader can judge for themselves how much help was baked into it.
   - **Who the friend is:** someone who did not watch this project get built and has not read
     the PRDs. A colleague who has seen the roadmap is a warm reader and produces a warm result.
     Confirm before starting that they are on Claude Code **2.1.207 or later** ([P-10](../PLUGIN-PRD.md#p-10--minimum-supported-claude-code-version)) — below the
     floor the plugin is unsupported, not merely degraded, and the run would be data about a
     configuration this project does not claim to serve.
   - **What they are asked to do**, in this order:
     1. Install the plugin following only the README.
     2. Ask three or four ordinary Magic questions in their own words, without naming Scryfall,
        an operator, or a tool.
     3. Run `/doctor` once and paste the output back (requirement 4).
     4. Say — in writing, as it happens — every moment they were unsure what to do next,
        **including the ones they resolved themselves in ten seconds.**
   - **What is recorded:** their OS and Claude Code version; whether Node was already installed;
     the two install commands exactly as they typed them; whether `/mcp` showed the server
     connected in the first session; whether *any* prompt appeared at enable time ([PC-02](../PLUGIN-PRD.md#pc-02--bundled-mcp-server)
     criterion 2 says zero, and this run is the first time a non-author has been in a position
     to observe it); the questions they asked and whether the tools were called; the `/doctor`
     output verbatim; and every hesitation in their own words, ordered so the sequence is
     recoverable afterward.
   - **The hard rule.** The moment the author explains something over chat, **that point of
     friction is a defect in the README.** The run is not invalidated by the explanation — it is
     invalidated only if the friction is not captured as an issue. File it first, then help,
     then continue. An intervention that is filed is data. An intervention that is not filed is
     this slice failing silently, which is the exact failure mode the rest of this project keeps
     designing against.
   - **Pass:** the friend reached an `/mcp`-connected server and at least one successful card
     search using only the README, with every intervention filed. **Fail:** the friend could not
     complete the install at all, or an intervention happened and was not written down. A pass
     with four filed friction issues is a *better* outcome than a pass with none — it means the
     run was observed honestly rather than remembered charitably.
   - **Sample size is one, deliberately.** One non-author is incomparably more information than
     the author re-reading the README. Do not stall the slice hunting for a second friend.

8. **Capture every point of friction as a GitHub issue on `njohnb/Manabase`.** Not a bullet list
   in the results doc — issues, filed during or immediately after the run. A good friction issue
   contains: the exact README step, quoted; what the friend expected and what happened; the
   verbatim text they saw (command output, error message, or the words "nothing happened"); their
   OS and Claude Code version; and whether they resolved it themselves or the author intervened.
   **The issues are the deliverable evidence — not a summary the author writes afterward from
   memory.** A remembered friction reliably decays into "it was fine, they figured it out," and
   that sentence is precisely the information this slice is spending a friend's afternoon to buy.
   File the ten-second ones too: a ten-second friction repeated across 5–20 installs is the
   adoption risk PLUGIN-PRD [§1](../PLUGIN-PRD.md#1-overview) names as the primary one. The results doc indexes the issues by
   number; the issue is the record, the results doc is the index.

9. **Draw the fix-here / file-for-later line so the slice can actually close.**
   - **Fixed in this slice:** anything that is a wording, ordering, or omission defect in
     `README.md` — a missing prerequisite, an ambiguous command, a step in the wrong order, a
     term used before it is defined, a relative link that does not resolve. These land in the
     same commit as the results doc. They do not need re-verifying with the friend; they are
     documentation, and the friend is spent.
   - **Filed, not fixed:** anything requiring a change to `src/`, `dist/`, `.claude-plugin/`,
     `.mcp.json`, or the skill. Those are a new slice or a [Slice 13](./TrackC-Slice13.md) blocker, and the issue must
     say which. The reason is not bureaucratic: a code change reopens [Slice 6](./TrackA-Slice6.md)'s or [Slice 9](./TrackB-Slice9.md)'s
     recorded evidence, and this slice has no harness to re-run it against. A packaging defect
     fixed quietly inside a docs slice is a change nothing verified.
   - **The judgment call, stated explicitly:** if the friend's install failed outright for a
     packaging reason, this slice does **not** pass by fixing the packaging and declaring
     victory. File it, fix it in its owning slice, then re-run the dry run — **with a different
     friend**, because the first one now knows the answer and is no longer a cold reader.

10. **Close the loop in [`docs/PLUGIN-PRD.md`](../PLUGIN-PRD.md), in the same session.** Two edits, and only two.
    - **[§7](../PLUGIN-PRD.md#7-open-questions):** append [PQ-04](../PLUGIN-PRD.md#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed)'s dated disposition to its existing entry. §7's preamble is binding —
      "Questions stay here until answered — they are not dropped" — so the question text stays
      and the answer is appended beneath it, whether that answer is *answered* or *reopened with
      what the dry run revealed*.
    - **[§9](../PLUGIN-PRD.md#9-revision-log):** append exactly one row. The table is **append-only**; §2 and §3 are locked; §4 is a
      dated research record that is appended to, never overwritten. Row template:

    ```
    | <date> | Docs polish and friend dry-run. README gains a four-case troubleshooting
    section naming `/mcp` as where to look, `claude --debug` as where to read why, and
    `/doctor` for a skill listing that has stopped firing. Fan Content disclaimer verified
    byte-identical (whitespace-normalized) across plugin.json, the marketplace entry, and the
    README. Dry run by one non-author on <OS>, Claude Code <version>, following only the
    README: install <succeeded | failed>, <n> friction issues filed (#<n>, #<n>), <n>
    author interventions. **PQ-04 <answered — documentation is the chosen mitigation,
    confirmed by the friend's own /doctor output | reopened — the dry run revealed
    <gap>>.** Results: docs/slices/TrackC-Slice12-results.md. | Track C Slice 12
    (docs/DEV-ROADMAP.md) — the last gate before the P-08 switchover. PC-02's "what the user
    sees when something is wrong" now has a documented surface, verified by someone who did
    not write it rather than self-reviewed. |
    ```

11. **Record the run in `docs/slices/TrackC-Slice12-results.md`**, following the shape of
    [`docs/slices/TrackA-Slice6-results.md`](./TrackA-Slice6-results.md): a header block (date, friend's OS and Claude Code
    version, Node present beforehand yes/no, result), the handover message verbatim, a
    step-by-step timeline of the install with the friend's own words quoted, the `/doctor` output
    verbatim in a fenced block, a table of friction issues with links, the [PQ-04](../PLUGIN-PRD.md#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed) disposition and
    the evidence for it, and a *What the README got wrong* section listing what was fixed here
    versus what was filed under requirement 9. Quote the friend; do not paraphrase them. Their
    phrasing is the finding.

## Interface contracts

No code interfaces. For a docs slice the contracts are canonical strings that must appear
verbatim in specific places, reproduced here exactly as they exist in the repository so the
checks are mechanical rather than interpretive.

**1. The Fan Content disclaimer** — required verbatim by MCP-PRD [§3.3](../MCP-PRD.md#33-legal-and-terms-of-service) and required on three
plugin surfaces by PLUGIN-PRD [§3.5](../PLUGIN-PRD.md#35-what-the-user-must-see-and-must-not). One line, as stored:

```
Manabase is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.
```

Where it appears, and how it is embedded:

| Surface | Location | Embedding |
|---|---|---|
| Plugin manifest | `.claude-plugin/plugin.json` → `description` | trailing sentence after the product blurb — compare with `endsWith` |
| Marketplace entry | `.claude-plugin/marketplace.json` → `plugins[0].description` | same trailing form, byte-identical to the manifest's |
| README | `README.md`, final paragraph | its own paragraph, hard-wrapped across three lines — normalize whitespace, then `includes` |

`approved/endorsed` has no spaces around the slash; `©` is U+00A9 and is followed immediately by
`Wizards` with no space. Do not "improve" the punctuation — verbatim means verbatim.

**2. The install commands.** Exactly two, `owner/repo` form, never a raw URL ([P-11](../PLUGIN-PRD.md#p-11--the-repo-is-its-own-marketplace)):

```
/plugin marketplace add njohnb/Manabase
/plugin install manabase@manabase
```

The second is `<plugin-name>@<marketplace-name>`; both are `manabase` here — the plugin's `name`
in `plugin.json` and the marketplace's `name` in `marketplace.json`.

**3. The version floor.** "Claude Code 2.1.207 or later" — a hard floor, not a recommendation
([P-10](../PLUGIN-PRD.md#p-10--minimum-supported-claude-code-version)). The README already states it this way and links P-10; keep both the wording and the
link. Below the floor the plugin is unsupported rather than degraded.

**4. The scoped tool name.** `mcp__plugin_manabase_mtg__card_search`, server registered as
`plugin:manabase:mtg` ([P-12](../PLUGIN-PRD.md#p-12--plugin-name-and-server-key)). That scoped form is what permission rules, `allowed-tools` entries,
and hook matchers must use — a matcher written against the bare server key never fires. The
README already says this; it must survive any editing done here.

## Out of scope — do NOT

- **No source, build, or manifest changes.** Nothing under `src/`, `dist/`, `.claude-plugin/`,
  `.mcp.json`, `skills/`, `tests/`, or `scripts/`. If the dry run demands one, requirement 9 says
  file it, do not fix it here.
- **Do not rewrite the README wholesale.** It is currently accurate about the things it covers.
  This slice adds the troubleshooting depth [PC-02](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) requires, corrects the stale status text, and
  fixes what the dry run exposes. A rewrite destroys the artifact under test, and a rewrite
  *mid-run* invalidates the run outright.
- **No edits to [`docs/PLUGIN-PRD.md`](../PLUGIN-PRD.md) beyond requirement 10's two.** No edits at all to
  [`docs/MCP-PRD.md`](../MCP-PRD.md) — this slice answers no OQ. Update [`docs/DEV-ROADMAP.md`](../DEV-ROADMAP.md)'s Slice 12 status
  row and nothing else in that file; if the roadmap and the PRD ever disagree, the PRD wins.
- **No new documentation surfaces.** No CONTRIBUTING, no issue templates, no wiki, no docs site,
  no quickstart video. The deliverable is one README that works for a cold reader.
- **Never document, demonstrate, or "warn by example" the raw-URL marketplace add** (requirement
  6).
- **Do not coach the friend, pre-install anything on their machine, or pick someone who watched
  the project get built.** Each of those converts the one test this slice has into a
  demonstration.
- **Do not open the release gate.** Setting `version` in `plugin.json` is [Slice 13](./TrackC-Slice13.md)'s act ([P-08](../PLUGIN-PRD.md#p-08--version-scheme));
  doing it here would make every subsequent commit ship nothing to anyone already installed.
- No CI work ([Slice 11](./TrackC-Slice11.md)), no context-cost re-measurement ([Slice 10](./TrackC-Slice10.md)), no eval re-runs ([Slice 9](./TrackB-Slice9.md)).

## Acceptance criteria

1. `README.md`'s troubleshooting section covers all four failure modes of requirement 2, each
   with a stated symptom, a discriminating check, and a next action; it names `/mcp` as where to
   look and `claude --debug` as where to read why; and it states outright that a server that
   fails to start surfaces no error — the tools are simply absent.
2. `README.md` contains a "run `/doctor` if the plugin stops firing" line with the budget-trim
   mechanism stated ([PQ-04](../PLUGIN-PRD.md#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed)'s artifact).
3. The disclaimer check script in *Verification steps* reports OK for all three surfaces.
4. `README.md` gives the install path only in `owner/repo` form; a review of the finished file
   finds no `marketplace.json` URL anywhere in it, including inside warnings and examples.
5. `README.md` contains no statement made false by Slices 7–10 — specifically the "skill is
   unwritten / nobody has installed this" status text and the skills-directory placeholder note.
6. **One friend, who did not build this project and is on Claude Code 2.1.207 or later, installed
   the plugin from scratch following only the README, reached `/mcp` showing the server
   connected, and got at least one successful card search — with zero unfiled author
   interventions.**
7. Every point of friction observed during the run exists as a GitHub issue on `njohnb/Manabase`
   containing the five elements of requirement 8, and each issue is labeled *fix here* or *filed
   for later* per requirement 9.
8. `docs/slices/TrackC-Slice12-results.md` exists with the handover message, the timeline in the
   friend's own words, the verbatim `/doctor` output, the issue index, and the [PQ-04](../PLUGIN-PRD.md#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed) evidence.
9. `docs/PLUGIN-PRD.md` [§7](../PLUGIN-PRD.md#7-open-questions)'s [PQ-04](../PLUGIN-PRD.md#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed) entry carries a dated disposition — answered or reopened —
   and [§9](../PLUGIN-PRD.md#9-revision-log) has exactly one new appended row. `git diff docs/PLUGIN-PRD.md` shows those two changes
   and nothing else.
10. `claude plugin validate . --strict` passes, and every relative link in `README.md` resolves.
11. Tree committed clean, with `dist/` untouched by this slice.

## Testing requirements

**The friend is the test.** There is no harness here, and inventing one would be measuring the
author's model of a cold reader rather than a cold reader. What can be checked mechanically must
be, so that the friend's time is spent on the part only a human can supply:

- **Disclaimer parity** — the script below, not a visual comparison.
- **Link resolution** — every relative link in `README.md` (`./docs/...`, `#anchor` forms).
  `docs/` is densely cross-linked with GitHub heading anchors and the slug rules are unforgiving:
  em dashes become a doubled hyphen, e.g. `#d-01--distribution-local-package-over-stdio`. If a
  heading was renamed anywhere in `docs/` since the README's links were written, they are broken
  now. Verify; do not assume.
- **Manifest validity** — `claude plugin validate . --strict`, which is required before any push
  a friend might install from and is therefore required *before* the dry run, not after.
- **A cold-read pass by the author before the friend sees it** — read the README top to bottom as
  a sequence of instructions and stop at the first thing that assumes knowledge not on the page.
  This is a filter to keep the friend's run from burning on something obvious. **It is not a
  substitute for the run** and its findings do not count as dry-run evidence.

Everything else — whether the writing is clear, whether the order matches how someone actually
proceeds, whether the troubleshooting section is reachable at the moment it is needed — is what
the dry run measures, and it measures it exactly once.

## Verification steps

```bash
# 0) Before the friend sees anything: the manifest must be valid.
claude plugin validate . --strict

# 1) Disclaimer parity across the three surfaces — mechanical, run from the repo root.
node -e '
const fs = require("fs");
const norm = s => s.replace(/\s+/g, " ").trim();
const D = "Manabase is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC.";
const plugin = norm(JSON.parse(fs.readFileSync(".claude-plugin/plugin.json", "utf8")).description);
const market = norm(JSON.parse(fs.readFileSync(".claude-plugin/marketplace.json", "utf8")).plugins[0].description);
const readme = norm(fs.readFileSync("README.md", "utf8"));
console.log("plugin.json      ", plugin.endsWith(D) ? "OK" : "MISMATCH");
console.log("marketplace entry", market.endsWith(D) ? "OK" : "MISMATCH");
console.log("README           ", readme.includes(D) ? "OK" : "MISMATCH");
console.log("manifest == entry", plugin === market ? "OK" : "MISMATCH");
'

# 2) The raw-URL trap must not appear in the README in any form.
grep -n "marketplace.json" README.md   # expect: no hit that is a URL a reader could paste

# 3) The dry run. Send the repo link, and nothing else. Then wait.
#    Record as it happens; do not reconstruct afterward.

# 4) After the run: issues filed, results doc written, PRD updated.
git diff --stat
git add -A && git status
```

## References

- `docs/DEV-ROADMAP.md` [§4](../DEV-ROADMAP.md#4-phase-1-slices), Slice 12; [§5](../DEV-ROADMAP.md#5-order-and-parallelism) (Slice 12 needs 6, 9, and 10, and gates [Slice 13](./TrackC-Slice13.md)); [§2](../DEV-ROADMAP.md#2-current-state-verified-2026-08-04)
  and [§3](../DEV-ROADMAP.md#3-standing-rules--apply-to-every-slice-never-restated-per-slice) (standing rules — never restated per slice, and they apply here unchanged).
- `docs/PLUGIN-PRD.md` [PC-02](../PLUGIN-PRD.md#pc-02--bundled-mcp-server), *what the user sees when something is wrong* (the troubleshooting
  section's owning behavior); [PQ-04](../PLUGIN-PRD.md#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed) (the question this slice disposes of); [§3.1](../PLUGIN-PRD.md#31-context-budget) (the silent
  skill-listing degradation and why `/doctor` is the instrument); [§3.5](../PLUGIN-PRD.md#35-what-the-user-must-see-and-must-not) (the three disclaimer
  surfaces and the zero-prompt requirement); [§4.1](../PLUGIN-PRD.md#41-harness-features-relied-on) (`/reload-plugins` semantics, server toggling
  in `/mcp`, scoped tool names); [§4.2](../PLUGIN-PRD.md#42-marketplace-and-install-path) (the install path and the raw-URL trap); [§4.3](../PLUGIN-PRD.md#43-versioning-and-updates) (version
  resolution and update semantics); [§7](../PLUGIN-PRD.md#7-open-questions) (append, never drop); [§9](../PLUGIN-PRD.md#9-revision-log) (append-only revision log).
- `docs/PLUGIN-PRD.md` [P-08](../PLUGIN-PRD.md#p-08--version-scheme) (version stays unset until [Slice 13](./TrackC-Slice13.md)), [P-10](../PLUGIN-PRD.md#p-10--minimum-supported-claude-code-version) (2.1.207 floor), [P-11](../PLUGIN-PRD.md#p-11--the-repo-is-its-own-marketplace)
  (`owner/repo`, never a raw URL), [P-12](../PLUGIN-PRD.md#p-12--plugin-name-and-server-key) (scoped tool name), [P-13](../PLUGIN-PRD.md#p-13--no-user-configuration-in-phase-1) (zero prompts at enable time).
- `docs/MCP-PRD.md` [§3.3](../MCP-PRD.md#33-legal-and-terms-of-service) (the disclaimer, verbatim, and its origin), [D-10](../MCP-PRD.md#d-10--tool-handlers-never-throw) (structured failures,
  which is what the Scryfall-outage bullet is describing).
- [`docs/slices/TrackA-Slice6.md`](./TrackA-Slice6.md) and [`docs/slices/TrackA-Slice6-results.md`](./TrackA-Slice6-results.md) — the format this
  slice's results doc follows, and the evidence the README's server claims rest on.
