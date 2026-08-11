# Track C — Slice 12 results: **a partial dry run** — the install path is surface-dependent

> **Read this heading literally. [Slice 12](./TrackC-Slice12.md) does not close on this run.** An
> install by a non-author did happen, it succeeded, and it produced three real defects — two of them
> now fixed in [`README.md`](../../README.md), one of them contradicting a `[verified]` claim in a
> binding document. That is a genuine result and it is why this file exists.
>
> What it is **not** is the cold read the slice specifies. The author was on a conference call
> throughout, intervened two or three times, and captured none of the four observations the slice
> exists to buy: the handover message, the friend's questions and whether tools fired, their
> hesitations in their own words, and the `/context` output that
> [`PQ-04`](../PLUGIN-PRD.md#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed)
> needs. **Acceptance criterion 8 fails outright; criteria 6 and 7 are partial.**
> [Slice 13](./TrackC-Slice13.md)'s [`P-08`](../PLUGIN-PRD.md#p-08--version-scheme) switchover stays
> gated.

Date: **2026-08-11**. Spec: [`TrackC-Slice12.md`](./TrackC-Slice12.md).

**Outcome.** The plugin was installed on Claude Desktop by someone who did not build this project,
and card searches worked afterwards on **both** Desktop tabs. Getting there took a path the README
did not describe, required a prerequisite the README did not list, and needed a second artifact the
README said was unnecessary on that surface. Three GitHub issues: **#43**, **#44**, **#45**.

## Conditions block

| | |
|---|---|
| Installer | One person, not the author, who did not watch this project get built |
| OS | Windows 11 |
| Claude Code | **2.1.219** — above [`P-10`](../PLUGIN-PRD.md#p-10--minimum-supported-claude-code-version)'s 2.1.207 floor, so this is a supported configuration |
| Surface | Claude Desktop — both tabs |
| Node beforehand | **Present.** Provenance inferred ("probably from the Claude Desktop installation"), not established |
| Git beforehand | **Absent** — installed during the run, see #44 |
| Plugin source | This repo's marketplace, added through Claude Desktop's UI by repository address |
| Server source | `manabase.mcpb` from the **`v0.1.1`** GitHub Release, via Settings → Extensions |
| Author interventions | **2 or 3** — count is the author's recollection, not a contemporaneous log |
| Observation method | Conference call, watched rather than transcribed |

## What happened

Reconstructed from the author's account after the fact. **It is not a contemporaneous timeline**,
which is the difference between this file and what
[`TrackC-Slice12.md`](./TrackC-Slice12.md) requirement 11 asks for.

1. **Git.** Installing Claude Code itself required git, which the README's *Requirements* list did
   not mention. In the installer's words, relayed: *"having to install and setup git was a hassle."*
   → **#44**
2. **`/plugin` was not there.** The README's install instruction is two slash commands "typed at the
   Claude Code prompt — not in a shell." **`/plugin` does not exist in Claude Code on Claude
   Desktop**; it is the standalone `claude` CLI's. The README offered no alternative path.
   → **#43**
3. **The Desktop UI route, found with the author's help.** Customize → Plugins → Add → Add
   Marketplace → Add from a Repository → paste `https://github.com/njohnb/Manabase` → Sync. The
   plugin installed.
4. **The tools were still absent.** The plugin install delivered the skill and **did not start the
   MCP server** — on the *Code* tab, which
   [`PLUGIN-PRD.md` §4.2](../PLUGIN-PRD.md#42-marketplace-and-install-path) records as needing no
   second artifact. → **#45**
5. **The bundle.** `manabase.mcpb` from the `v0.1.1` release, installed through Settings →
   Extensions — the same route the Chat tab requires.
6. **Working.** Card searches ran on both Desktop tabs.

## The three findings

| # | Finding | Label | Status |
|---|---|---|---|
| [#43](https://github.com/njohnb/Manabase/issues/43) | `/plugin` does not exist in Claude Code on Claude Desktop — the README gave a terminal-only install path | *fix here* | Fixed in this slice |
| [#44](https://github.com/njohnb/Manabase/issues/44) | git is required before installing Claude Code, and the Requirements list never said so | *fix here* | Fixed in this slice |
| [#45](https://github.com/njohnb/Manabase/issues/45) | Claude Desktop needs the MCPB bundle on the Code tab too — contradicts [§4.2](../PLUGIN-PRD.md#42-marketplace-and-install-path)'s `[verified]` claim | *filed for later* | README half fixed; PRD half filed |

### Why #45 is filed rather than fixed

[`PLUGIN-PRD.md` §4.2](../PLUGIN-PRD.md#42-marketplace-and-install-path)'s 2026-08-04 addendum says,
marked `[verified]`, that the Desktop Code tab "works there unmodified — same marketplace, same
`.mcp.json`, same scoped tool name. No second artifact is needed for it."

**The two records may describe two different install paths rather than disagreeing, and this run
cannot tell them apart.** The 2026-08-04 verification was made with the plugin installed from the
terminal CLI, which shares its plugin directory with the Desktop Code tab. This run never used the
terminal path. What it establishes is that a plugin installed through **Claude Desktop's own UI**
does not carry its server to either tab — so the *unqualified* form of the claim is false for the
path a Desktop user actually reaches, given #43. The CLI-into-Code-tab branch is **untested and not
contradicted**, and should be settled before [§4.2](../PLUGIN-PRD.md#42-marketplace-and-install-path)
is amended.

[`TrackC-Slice12.md`](./TrackC-Slice12.md) requirement 9 forbids this slice from making that edit,
and [§4](../PLUGIN-PRD.md#4-harness-and-delivery) is a dated research record that is appended to and
never overwritten. It also reaches
[`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) criterion 1, which is written as
`/plugin marketplace add` → `/mcp` connected with "no additional command, no file edit, and no
restart" — true in the terminal CLI, and describing no reachable path on Claude Desktop.

## What was not observed, and what each gap costs

**This section is the point of this file.** Requirement 8 is explicit that a remembered friction
decays into "it was fine, they figured it out," and four things here were never captured at all.

| Not observed | What it was for | Consequence |
|---|---|---|
| The handover message | Requirement 7 wants it verbatim so a later reader can judge how much help was baked in | Nobody can now assess whether the run started cold |
| The questions asked, and whether tools fired | [`PC-01`](../PLUGIN-PRD.md#pc-01--scryfall-query-craft)'s single most valuable observation — does the skill fire unprompted on someone else's phrasing, against [Slice 9](./TrackB-Slice9.md)'s baseline | The one thing only a non-author can supply was not collected |
| Hesitations in the friend's own words | Requirement 8's ten-second frictions — the adoption risk | Only the three blocking frictions survive; the small ones are gone |
| `/context` output | [`PQ-04`](../PLUGIN-PRD.md#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed)'s confirmation step | The question cannot be closed by this run — see below |
| Any prompt at install time | [`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) criterion 2, and [`PC-03`](../PLUGIN-PRD.md#pc-03--mcpb-bundle-for-the-chat-tab) criterion **8**, its last unverified one | `PC-03` criterion 8 stays unverified. A released bundle was installed by a non-author and nobody recorded whether it asked anything |

That last row is the most frustrating: the run passed through the exact configuration
[`PC-03`](../PLUGIN-PRD.md#pc-03--mcpb-bundle-for-the-chat-tab) criterion 8 has been waiting for, and
the observation was not made. **It is not recorded as verified.**

## [`PQ-04`](../PLUGIN-PRD.md#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed) — unconfirmed, stays open

[`TrackC-Slice12.md`](./TrackC-Slice12.md) requirement 4 lists three recordable outcomes, all of
which assume the friend ran the diagnostic. **They did not.** The README line exists and is correct;
what has not happened is anyone watching a non-author use it.

Requirement 4's closing instruction is binding here: *"Do not close
[`PQ-04`](../PLUGIN-PRD.md#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed)
by asserting the README line is sufficient without having watched a non-author use it."* So the
disposition appended to [§7](../PLUGIN-PRD.md#7-open-questions) is **unconfirmed** — neither
*answered* nor *reopened*, because the confirmation step did not run. The question keeps its
existing 2026-08-07 answer and its 2026-08-08 amendment; only the confirmation is outstanding.

**One thing this run does add to it.** The friend landed on Claude Desktop, where `/plugin` is absent
and `/context` is unconfirmed. If the mitigation's diagnostic clause is unreachable on the surface a
first-time installer actually reaches, that is a sharper form of the question than the one
[§7](../PLUGIN-PRD.md#7-open-questions) currently records. It is **not** established here — nobody
tried `/context` on Desktop — and it is written down so the next run tests it deliberately.

## Acceptance criteria

| # | Criterion | Status |
|---|---|---|
| 1 | Four-mode troubleshooting section, `/mcp` and `claude --debug` named, silent-start-failure stated | **Met** — landed `d161064`; extended today with a Desktop entry and a terminal-CLI scoping note |
| 2 | Budget-trim line with the mechanism stated | **Met** — landed `d161064`, naming `/context` and the by-name recovery |
| 3 | Disclaimer parity across three surfaces | **Met** — script reports `OK` on all four comparisons, re-run 2026-08-11 |
| 4 | Install path in `owner/repo` form; no `marketplace.json` URL anywhere | **Met** — the Desktop route pastes the *repository* address, which is not [`P-11`](../PLUGIN-PRD.md#p-11--the-repo-is-its-own-marketplace)'s trap; the blockquote now distinguishes the two without showing the bad form |
| 5 | No statement made false by Slices 7–10 | **Met** — and this slice removed statements made false by *this run* |
| 6 | Friend installed following only the README, `/mcp` connected, one successful card search, zero unfiled interventions | **Partial.** Install succeeded and searches worked; but not "only the README" (2–3 interventions), `/mcp` connected was never observed as such, and the interventions are filed retroactively by reconstruction |
| 7 | Every friction filed as an issue with requirement 8's five elements, labeled | **Partial.** Three issues carry all five elements, but they are reconstructed rather than contemporaneous, and the ten-second frictions were never captured |
| 8 | Results doc with handover message, timeline in the friend's words, verbatim `/context`, issue index, `PQ-04` evidence | **Not met.** Three of five elements are unavailable. This file records their absence instead |
| 9 | [§7](../PLUGIN-PRD.md#7-open-questions) dated disposition + exactly one [§9](../PLUGIN-PRD.md#9-revision-log) row | **Met** — disposition is *unconfirmed* |
| 10 | `claude plugin validate . --strict` passes; every relative link resolves | **Met in its achievable form** — links clean (`npm run lint:docs`); `--strict` fails on exactly one warning, [`P-08`](../PLUGIN-PRD.md#p-08--version-scheme)'s deliberately unset `version`, which is [Slice 13](./TrackC-Slice13.md)'s to clear |
| 11 | Tree committed clean, `dist/` untouched | **Met** — no `src/` or `dist/` change in this slice |

## What the README got wrong

**Fixed here** — all three are wording, ordering or omission defects, which requirement 9 puts in
scope:

- *Requirements* listed Claude Code and Node as though complete. A **git** bullet now leads the
  list, ordered ahead of Claude Code because that is when it bites, and attributed to Claude Code's
  install rather than to Manabase, which never calls git.
- *Install* gave two slash commands for a surface that has no `/plugin`. It is now split into
  **Claude Code in a terminal** and **Claude Desktop — either tab**, the second carrying the UI path
  verbatim.
- *Where it runs* claimed the Desktop Code tab needed no second artifact. Both Desktop rows now say
  two installs, the bundle section is retitled for both tabs, and the untested CLI-into-Code-tab
  branch is stated as untested rather than dropped or asserted.
- A new troubleshooting entry, **"You are on Claude Desktop and no card search ever runs"**, is
  placed above every other entry, because after this run it is the likeliest first-install failure.
  The section also now says `/mcp`, `/plugin` and `claude --debug` are the terminal CLI's.

**Filed, not fixed:** #45's PRD half — the
[§4.2](../PLUGIN-PRD.md#42-marketplace-and-install-path) addendum and the
[`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) criterion 1 scoping question.

## What a second run needs

The first installer is **spent as a cold reader** — they now know the answers, which is
[`TrackC-Slice12.md`](./TrackC-Slice12.md) requirement 9's stated reason for using a different person
on a re-run. A second run is now much cheaper than the first, because the three blocking defects are
fixed, and it needs only what this one did not collect:

1. The handover message, sent and kept.
2. Three or four Magic questions in the friend's own words, and whether a tool call appeared.
3. `/context` once, pasted back — on whichever surface they are on, which is the
   [`PQ-04`](../PLUGIN-PRD.md#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed)
   sharpening above.
4. Whether **anything** prompted at either install —
   [`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) criterion 2 and
   [`PC-03`](../PLUGIN-PRD.md#pc-03--mcpb-bundle-for-the-chat-tab) criterion 8.
5. Hesitations written down as they happen, including the ten-second ones.

Nothing on that list needs the author on a call. Every one of them needs the author **not** to be.
