# Track C — Slice 13: Release gate — the P-08 switchover

> Self-contained implementation spec. You do not need to read the PRDs to build this slice;
> everything binding is inlined. PRD references are pointers for deeper context only.

**Goal.** Declare the plugin public: set explicit semver in `plugin.json` for the first time,
prove that the update semantics inverted in both directions, push the release tag, and close
Phase 1 in [`docs/PLUGIN-PRD.md`](../PLUGIN-PRD.md) — [§7](../PLUGIN-PRD.md#7-open-questions) with an explicit disposition for [`PQ-05`](../PLUGIN-PRD.md#pq-05--should-the-plugin-be-submitted-to-the-community-marketplace-once-it-is-stable), [§9](../PLUGIN-PRD.md#9-revision-log) with the row
that marks the phase closed. Nothing is built. The entire output is a version string, a tag,
and two records — and this is the only slice in the roadmap whose mistakes other people
install.

## Preconditions

Slice 13 happens when Slices 1–12 are **done and stable, not merely done**. That distinction is
the whole reason this slice exists as a gate rather than a chore, so it is written below as a
mechanical checklist. Work it top to bottom. **If any line cannot be checked, the gate is
closed: stop, and finish the slice that owns it.** A gate passed by lowering the gate is the
failure mode.

**A. The server (Slices 1–6) — recorded, then re-proven once.**

- ☐ [`CAP-01`](../MCP-PRD.md#cap-01--card-search)'s twelve acceptance criteria all have a recorded pass; [`docs/slices/TrackA-Slice6-results.md`](./TrackA-Slice6-results.md)
  exists and `docs/MCP-PRD.md` [§9](../MCP-PRD.md#9-revision-log) carries the [Slice 6](./TrackA-Slice6.md) row.
- ☐ No `src/` change since that recorded pass — or requirement 1(d) below re-runs it live.
- ☐ Criteria 1, 10, 11, 12 are unit-level by design and stay that way. Criterion 12 (429 →
  backoff) rests on a mock permanently: deliberately provoking a real 429 is forbidden, not
  merely discouraged. Do not "prove it properly" for the release.

**B. The plugin (Slices 7–9) — every `PC` criterion has a recorded disposition.**

- ☐ [`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) criteria **1, 2, 3, 4, 6, 7, 9** verified live in [Slice 7](./TrackB-Slice7.md), with a date, on a machine
  or profile that had never installed the plugin.
- ☐ [`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) criterion **10** (`claude plugin details manabase`) recorded in `PLUGIN-PRD.md` [§9](../PLUGIN-PRD.md#9-revision-log) by
  [Slice 10](./TrackC-Slice10.md).
- ☐ [`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) criterion **8** (unreachable upstream → structured failure, not a dead server) —
  evidence is unit-level: `tests/scryfall/client.test.ts` maps a fetch rejection to a `network`
  failure with no status, and `tests/tools/card-search.test.ts` passes `network` /
  `upstream_unavailable` / `rate_limited` through unchanged. Confirm that is *recorded* as the
  evidence rather than assumed by everyone.
- ☐ [`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) criterion **5** (`${CLAUDE_PLUGIN_DATA}` survives a `/plugin update`) — **not
  exercisable in Phase 1**: nothing writes to that directory, which `PLUGIN-PRD.md` [§9](../PLUGIN-PRD.md#9-revision-log)'s
  2026-08-04 row already states. This criterion needs a recorded disposition — "not exercisable
  in Phase 1, nothing writes there, first exercised by the capability that needs persistence" —
  not a pass. Recording it is the gate condition; passing it is not.
- ☐ [`PC-01`](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) criteria **1–4** (static: description length, always-on cost, `SKILL.md` token
  budget, no card facts) checked against the files in [Slice 8](./TrackB-Slice8.md).
- ☐ [`PC-01`](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) criteria **5–13** measured in [Slice 9](./TrackB-Slice9.md) in **fresh sessions**, each against a recorded
  without-skill baseline, results in `PLUGIN-PRD.md` [§9](../PLUGIN-PRD.md#9-revision-log). A criterion whose baseline was assumed
  rather than run is not verified.
- ☐ `docs/MCP-PRD.md` [`OQ-01`](../MCP-PRD.md#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) answered in that document's [§7](../MCP-PRD.md#7-open-questions) and logged in its [§9](../MCP-PRD.md#9-revision-log) — [Slice 9](./TrackB-Slice9.md) owns
  it, and it is the one open question that lives in the *other* PRD but closes on plugin
  evidence.

**C. The release track (Slices 10–12).**

- ☐ [Slice 10](./TrackC-Slice10.md): [`PQ-01`](../PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports) and [`PQ-02`](../PLUGIN-PRD.md#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed) have **measured** answers in `PLUGIN-PRD.md` [§7](../PLUGIN-PRD.md#7-open-questions), and the
  `plugin details` output is in [§9](../PLUGIN-PRD.md#9-revision-log).
- ☐ [Slice 11](./TrackC-Slice11.md): [`PQ-06`](../PLUGIN-PRD.md#pq-06--what-keeps-the-committed-dist-honest) closed in [§7](../PLUGIN-PRD.md#7-open-questions); the `dist/` honesty mechanism exists, was demonstrated to
  fail once against a deliberately stale `dist/`, and is **green on the exact commit being
  released**. A mechanism that has never failed has never been shown to work.
- ☐ [Slice 12](./TrackC-Slice12.md): a friend installed from scratch following only the README, without author
  intervention; [`PQ-04`](../PLUGIN-PRD.md#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed) recorded as answered or reopened with what the dry run revealed; the
  README's troubleshooting and `/doctor` lines are present.
- ☐ Every point of friction the friend hit is either fixed or filed. "Filed and knowingly
  shipped" is acceptable; "noticed and forgotten" is not.

**D. Open questions — every Phase 1 question has a disposition, and none is silent.**

- ☐ Answered during Phase 1 and confirmed still current: [`PQ-01`](../PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports), [`PQ-02`](../PLUGIN-PRD.md#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed) ([Slice 10](./TrackC-Slice10.md)), [`PQ-04`](../PLUGIN-PRD.md#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed)
  ([Slice 12](./TrackC-Slice12.md)), [`PQ-06`](../PLUGIN-PRD.md#pq-06--what-keeps-the-committed-dist-honest) ([Slice 11](./TrackC-Slice11.md)), and `MCP-PRD.md` [`OQ-01`](../MCP-PRD.md#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) ([Slice 9](./TrackB-Slice9.md)).
- ☐ Deliberately deferred past Phase 1 by their own *Resolves by* clauses, and **re-read to
  confirm each still says so**: [`PQ-03`](../PLUGIN-PRD.md#pq-03--what-triggers-a-refresh-of-the-bulk-data-and-the-comprehensive-rules-cache-and-should-it-ever-be-a-sessionstart-hook), [`PQ-07`](../PLUGIN-PRD.md#pq-07--is-deck-optimization-a-skill-or-an-agent), [`PQ-08`](../PLUGIN-PRD.md#pq-08--what-does-a-user-see-when-the-archidekt-credential-is-missing-expired-or-rejected), and `MCP-PRD.md` [`OQ-02`](../MCP-PRD.md#oq-02--how-verbose-should-a-search-result-be)–[`OQ-12`](../MCP-PRD.md#oq-12--what-is-the-normalized-deck-shape-and-does-one-tool-serve-both-platforms-or-two). A
  question whose resolver has since happened but whose entry still reads "deferred" is drift,
  and this is the last session that will notice. **Range extended 2026-08-07** from `OQ-09` to
  `OQ-12` — [`OQ-10`](../MCP-PRD.md#oq-10--will-moxfield-grant-this-application-approved-access-and-under-what-terms)–[`OQ-12`](../MCP-PRD.md#oq-12--what-is-the-normalized-deck-shape-and-does-one-tool-serve-both-platforms-or-two)
  arrived with Moxfield and are all deck-platform questions that resolve well past Phase 1. They
  are named here rather than left out because this checklist works by enumerating a range, and a
  question added after the range was written is exactly the silent kind it exists to catch.
- ☐ [`PQ-05`](../PLUGIN-PRD.md#pq-05--should-the-plugin-be-submitted-to-the-community-marketplace-once-it-is-stable) is this slice's to dispose of (requirement 11). It is the only one that must move.

**E. Stability, which is not a slice and therefore has no status column.**

- ☐ On `main`, working tree clean, HEAD pushed, local and remote agree.
- ☐ The repo has been left alone long enough that the last change is not still settling. "Stable"
  means nobody is mid-thought, not that CI is green.

## Context

Manabase is a Magic: The Gathering MCP server (Scryfall-backed card search) that ships inside a
Claude Code plugin. This is slice 13 of 13 — the terminal node of the dependency graph, needing
Slices 11 and 12, and needed by nothing.

**This is a phase boundary, not a task inside Phase 1.** `PLUGIN-PRD.md` [§6](../PLUGIN-PRD.md#6-roadmap) and [`P-08`](../PLUGIN-PRD.md#p-08--version-scheme) both say
so explicitly: `version` stays unset while the author iterates, and setting explicit semver *is*
the act of declaring the plugin public. Phase 1 is [`PC-01`](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) and [`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) together — a server
nobody has installed is shippable but useless — so the phase does not close when the code is
written, it closes when the thing a user installs has been verified and versioned.

**And it is irreversible in a way no other slice is.** A bad handler is a fix, a bad skill is a
rewrite, a bad README is a commit. A pushed tag and a public version are things other people
install, and they cannot be quietly withdrawn. That is why the ordering in Requirements is
binding rather than stylistic: everything is checked **before** the tag is pushed, never after.

**What opens next: nothing.** Closing Phase 1 does not schedule Phase 2 — `docs/DEV-ROADMAP.md`
[§6](../DEV-ROADMAP.md#6-beyond-phase-1--queued-slice-packs)'s queued packs are *shapes* of future work, each of which starts with its own spec slice that
does the research and appends a `CAP` or `PC` block, and phase assignment happens in those
sessions. The boundary is a boundary, not a to-do list.

## Deliverables

| File | Action |
|---|---|
| `.claude-plugin/plugin.json` | modify — add `version`, explicit semver. The **only** file that gets one. |
| `.claude-plugin/marketplace.json` | verify unchanged — it carries no `version` today and must carry none when this slice ends |
| `docs/slices/TrackC-Slice13-results.md` | new — the recorded release (pre-flight in order, version and why, both update-semantics tests, tag behavior, [`PQ-05`](../PLUGIN-PRD.md#pq-05--should-the-plugin-be-submitted-to-the-community-marketplace-once-it-is-stable) reasoning) |
| [`docs/PLUGIN-PRD.md`](../PLUGIN-PRD.md) | [§7](../PLUGIN-PRD.md#7-open-questions) — append a dated disposition paragraph to [`PQ-05`](../PLUGIN-PRD.md#pq-05--should-the-plugin-be-submitted-to-the-community-marketplace-once-it-is-stable); [§9](../PLUGIN-PRD.md#9-revision-log) — append **one** revision-log row (template below) |
| `README.md` | modify — the "Status: pre-release" paragraph only. Nothing else; [Slice 12](./TrackC-Slice12.md) owns docs polish. |
| [`docs/DEV-ROADMAP.md`](../DEV-ROADMAP.md) | mark Slice 13 ☑ with a Landed note and update [§2](../DEV-ROADMAP.md#2-current-state-verified-2026-08-04)'s current-state statement. Status tracking only — [§9](../PLUGIN-PRD.md#9-revision-log) is the binding record. |
| the release tag | pushed via `claude plugin tag --push`, **last**, after everything above passes |

## Requirements

1. **Pre-flight, in this order, before a single character of the switchover is written.** Stop at
   the first failure; do not carry a failure forward "to fix after tagging."
   - **(a)** `git status` clean, on `main`, HEAD pushed, local and remote agree.
   - **(b)** `npm run typecheck && npm test && npm run build`, then `git status` again — still
     clean means `dist/` was already current. This is the local half of the same question
     [Slice 11](./TrackC-Slice11.md)'s CI check asks; run both, they fail differently.
   - **(c)** [Slice 11](./TrackC-Slice11.md)'s check is **green on the exact commit SHA being released**, not on an
     ancestor and not on a branch that has since moved.
   - **(d)** `npm run acceptance` — one fresh live pass, every check PASS, exit 0. This is the
     only check that proves the artifact being released still works against reality, and drift
     since the [Slice 6](./TrackA-Slice6.md) record is a finding to write down, not a formality to wave through.
     Politeness still binds: ≥600 ms between calls, no retries, and **never** provoke a 429.
   - **(e)** `claude plugin validate . --strict` passes. **Before tagging, not after** — a tag
     pushed on a manifest that fails validation is a public artifact that cannot install, and it
     is the one class of defect that no user can work around.
   - **(f)** The Fan Content disclaimer appears **verbatim** on all three user-facing surfaces —
     `plugin.json`'s `description`, the marketplace entry's `description`, and the README:
     > Manabase is unofficial Fan Content permitted under the Fan Content Policy. Not
     > approved/endorsed by Wizards. Portions of the materials used are property of Wizards of
     > the Coast. ©Wizards of the Coast LLC.

     Compare the three strings to each other character by character. Reading them for sense is
     how a reworded copy survives a review.
   - **(g)** `dist/index.js` completes an initialize handshake from a directory containing no
     `node_modules` — the offline-start property is what makes the plugin start with no network,
     and it is cheap to re-check once.
   - **(h)** **`APP_VERSION`'s contact URL is real.** `src/config.ts` builds the `User-Agent` as
     `manabase-mtg/${APP_VERSION} (+https://github.com/OWNER/manabase)`. As of this spec,
     `OWNER` is the literal placeholder string. Scryfall requires a `User-Agent` that names the
     app **and gives them a way to reach the author**; a public release whose contact URL 404s
     fails that on the first release where request volume stops being one developer. If it is
     still `OWNER`, that is a defect this gate caught: fix it in `src/config.ts`, `npm run build`,
     commit `dist/`, and **restart the pre-flight from (a)**.

2. **Choosing the version number is the author's call; these are the constraints it must
   satisfy.** This spec does not pick it.
   - Explicit semver, `MAJOR.MINOR.PATCH`, a plain JSON string. No leading `v`, no range, no
     placeholder. If you want a pre-release suffix, verify in-session that the harness accepts it
     and record the result — the documented behavior is string **equality** as a cache key, not
     semver ordering, so a suffix is untested here rather than known-good.
   - **Never reuse a version string.** Version is the update cache key: if the resolved version
     matches what is installed, `/plugin update` skips and reports already current. Equality, not
     ordering — so a reused string is indistinguishable from "nothing to do" and ships nothing.
   - `0.x` versus `1.0.0` is a claim about stability made to 5–20 people, not a technical
     constraint. Record which you chose and why.
   - Requirements 7–9 will consume at least one more version after the one you pick. Budget for
     it: version numbers are free, a bad tag is not.

3. **Set `version` in `.claude-plugin/plugin.json`, and only there.** That single line is the
   switchover ([`P-08`](../PLUGIN-PRD.md#p-08--version-scheme)). With `version` unset, Claude Code falls back to the git commit SHA and
   **every commit is an update** — right for the phase where the author is iterating. With it
   set, users get changes **only** on a bump, and forgetting to bump silently ships nothing —
   wrong then, right once other people depend on it.

4. **The marketplace entry must not carry a version.** Verified against the tree as this spec was
   written: `.claude-plugin/marketplace.json`'s single `plugins[0]` entry has **no** `version`
   field. Keep it that way. `plugin.json` wins **silently, with no warning**, so a divergent
   marketplace version is not an error the harness reports — it is an invisible wrong answer that
   gives "what version are you running" two defensible replies. Check it mechanically:
   `grep -n '"version"' .claude-plugin/marketplace.json` must print nothing, before and after.

5. **`package.json`'s `version` is independent by design. Do not sync it.** It is `0.0.0` today
   and it may stay `0.0.0` through this release. It serves the npm/`npx` route
   (`MCP-PRD.md` [`D-02`](../MCP-PRD.md#d-02--runtime-nodejs--typescript)), which [`P-09`](../PLUGIN-PRD.md#p-09--server-ships-as-committed-built-javascript) deliberately kept alive as the **secondary channel** for
   anyone wiring the server into a non-Claude MCP client by hand — a different audience on a
   different cadence. Syncing the two numbers is the obvious-looking move and it is exactly what
   [`P-09`](../PLUGIN-PRD.md#p-09--server-ships-as-committed-built-javascript) rejected `npx` to avoid: two numbers that must be bumped in lockstep is the same
   problem wearing a hat. Bump `package.json` here only if the **npm artifact** changed, never
   because the plugin version changed.

6. **If `package.json` does move, `APP_VERSION` and `dist/` move with it, in that order.**
   `APP_VERSION` in `src/config.ts` is kept in sync with `package.json` **by hand** — the bundle
   cannot read `package.json` at runtime. It is not decorative: it is interpolated into the
   `User-Agent` Scryfall sees on every outbound request. Change one without the other and the app
   names itself with a version that does not exist; change either without rebuilding and
   committing `dist/` and the drift is invisible to everything except [Slice 11](./TrackC-Slice11.md)'s check — which is
   precisely the drift that check exists to catch, so expect it to catch you. Sequence:
   `package.json` → `APP_VERSION` → `npm run build` → commit `dist/` → CI green → restart
   pre-flight at 1(a).

7. **Positive test A — the switchover is picked up.** Push the version-setting commit. On a
   machine or profile where the plugin is **already installed** at a SHA-resolved version, run
   `/plugin update`. Expect it to update, because the resolved version changes from the commit
   SHA to the semver string and the cache key therefore differs. **Confirm, do not assume** —
   record what `/plugin` reported before and after, and that a new directory appeared under
   `~/.claude/plugins/cache` (each installed version is a separate directory there).

8. **Negative test — a push without a bump ships nothing. This is the test that proves the
   switchover actually happened, and it is the one people skip.**
   - Push a **doc-only** commit that changes nothing anyone needs — a README typo, a comment.
     Never `src/`, `dist/`, `.mcp.json`, `skills/`, or a manifest: the whole point is that this
     commit will *not* reach users, and an unshipped fix is worse than no fix because it looks
     shipped.
   - On the same installed machine, `/plugin update`. Expect: reports already current, nothing
     changes. Record the harness's exact wording.
   - **Verify the absence positively.** Read the installed copy under `~/.claude/plugins/cache`
     and confirm the change is not there. "The command printed nothing alarming" is not evidence.
   - Skip this and you cannot distinguish "the switchover worked" from "the harness never picked
     the version up at all" — the same observation from outside, until a user reports a missing
     fix months later.

9. **Positive test B — a bump ships, and carries the withheld commit.** Bump the patch version in
   `plugin.json` (a **new** string, never a reused one), push, `/plugin update`. Expect the update
   to land **and** to bring requirement 8's doc commit with it. That arrival is the proof the
   earlier push was *withheld* rather than lost. Note this is a different transition from
   requirement 7: 7 proves SHA→semver, a one-time event; 9 proves semver→semver, which is the
   semantics every user lives with from now on.

10. **Tag last, and dry-run first.** `PLUGIN-PRD.md` [§4.3](../PLUGIN-PRD.md#43-versioning-and-updates) records (verified) only that
    `claude plugin tag` creates a release git tag for a plugin and supports `--push`,
    `--dry-run`, and a `%s` version placeholder in the message. It does **not** record the tag
    name format, where the command reads the version from, or whether it validates or builds
    anything on the way. Do not assert any of that from this spec: run `claude plugin tag --help`
    and `claude plugin tag --dry-run`, **confirm in-session what the command actually does, and
    write it down in the results doc** — the record is a deliverable, because the next release
    session should not have to rediscover it. Then, and only then, `claude plugin tag --push`.
    Check three things afterward: the tag names the **final** released version from requirement 9
    (never an intermediate), it points at the commit actually released, and it is the last write
    of the session.

11. **[`PQ-05`](../PLUGIN-PRD.md#pq-05--should-the-plugin-be-submitted-to-the-community-marketplace-once-it-is-stable) gets an explicit disposition, and "still open" is an acceptable one.** `PQ-05` asks
    whether the plugin should be submitted to Anthropic's `claude-plugins-community` marketplace
    once it is stable. The gate is not "decide yes or no" — it is **decide deliberately and write
    the reasoning down**. An open question that is silently left alone at a phase boundary is the
    failure mode: the phase closes, the context that would have answered it evaporates, and a
    later session cannot tell whether it was weighed and deferred or simply forgotten. Append a
    dated paragraph to the existing [§7](../PLUGIN-PRD.md#7-open-questions) entry — append, never rewrite; the original framing is the
    record of what was known then. Acceptable dispositions, and what each must state:
    - **Deliberately still open** — say what would change the answer and when it gets revisited.
      The argument against is already in the entry: a public listing invites an audience larger
      than 5–20, and every constraint in that document was written for 5–20. Deferring on that
      basis is a decision. Deferring silently is not.
    - **Yes** — note that it is reversible in one direction only, and that it changes *which*
      marketplace users add, not the two-command install.
    - **No** — record the reasoning; the question is then answered and stops being open. Do not
      restructure [§8](../PLUGIN-PRD.md#8-out-of-scope) to accommodate it; the [§7](../PLUGIN-PRD.md#7-open-questions) entry plus the [§9](../PLUGIN-PRD.md#9-revision-log) row is the record.

12. **Close Phase 1 in `docs/PLUGIN-PRD.md` [§9](../PLUGIN-PRD.md#9-revision-log).** Append **one** row. §9 is **append-only**; §2
    and §3 are **locked** and are not touched by this slice. Setting a version *executes* [`P-08`](../PLUGIN-PRD.md#p-08--version-scheme)
    — it does not amend it, so [`P-08`](../PLUGIN-PRD.md#p-08--version-scheme)'s text does not change and no new `P-` decision is created.

    ```
    | <date> | **P-08 switchover — the plugin is public.** Set `version` <semver> in
    `plugin.json`, the first explicit version and the only place one is set; the marketplace
    entry still carries none (`plugin.json` wins silently, §4.3). Update semantics verified in
    both directions: a bump is picked up, and a push without a bump ships nothing. Release tag
    <tag> pushed via `claude plugin tag --push` (<what the command did, observed>). PQ-05:
    <answered yes/no | deliberately still open> — see §7. `package.json` `version` deliberately
    left at <value>, independent by design (MCP-PRD D-02 / P-09). Record:
    docs/slices/TrackC-Slice13-results.md. | Track C Slice 13 (docs/DEV-ROADMAP.md) — **closes
    Phase 1.** PC-01 and PC-02 are both verified, which is what §6 defines Phase 1 as, and the
    switchover is the phase boundary §6 and P-08 both name rather than a task inside the phase. |
    ```

    **This row is the one that marks Phase 1 closed.** Nothing else does — the roadmap's status
    column is a progress tracker, not the record.

13. **After the tag is pushed there is no quiet fix.** If a defect surfaces post-tag, ship a **new
    patch version**: new string in `plugin.json`, new tag. Never move or delete a pushed tag and
    never reuse a version string — a reused string reads as "already current" and the fix reaches
    nobody, which is worse than the original defect because it looks fixed. If a friend needs
    holding at a known-good commit while the fix lands, plugin sources accept a full
    40-character `sha` that wins over `ref` ([§4.2](../PLUGIN-PRD.md#42-marketplace-and-install-path)); pinning is available on **plugin** sources,
    not on the marketplace source. Unused here, recorded because this is the situation it exists
    for.

## Interface contracts

Four version-bearing surfaces exist in this repo. They are not four copies of one number: they
are three independent numbers and one hand-maintained mirror.

| Surface | Set in this slice? | Coupled to | Consumer |
|---|---|---|---|
| `.claude-plugin/plugin.json` `version` | **Yes — first time, and only here** | nothing | Claude Code's version resolution; the `/plugin update` cache key |
| `.claude-plugin/marketplace.json` entry | **No — must stay absent** | would be silently overridden by `plugin.json` | resolution step 2, never reached once step 1 exists |
| `package.json` `version` | Only if the npm artifact changed | `APP_VERSION`, by hand | the npm/`npx` route ([`D-02`](../MCP-PRD.md#d-02--runtime-nodejs--typescript), secondary channel per [`P-09`](../PLUGIN-PRD.md#p-09--server-ships-as-committed-built-javascript)) |
| `APP_VERSION` in `src/config.ts` | Only alongside `package.json` | `package.json`, and `dist/` | the `User-Agent` Scryfall sees on every request |

- **Coupled:** `package.json` ↔ `APP_VERSION` ↔ `dist/`. Move one, move all three, in that order,
  in one commit.
- **Independent by design:** the plugin version and `package.json`'s. There is no rule relating
  them; inventing one is a regression dressed as tidiness.
- **Must not exist:** a `version` in the marketplace entry.

**Resolution order the harness uses** (verified, [§4.3](../PLUGIN-PRD.md#43-versioning-and-updates)): `plugin.json` `version` → marketplace
entry `version` → the git commit SHA of the plugin's source → the literal `unknown`. The SHA step
is **conditional** — it applies to `github`, `url`, `git-subdir`, and relative-path sources
**inside a git-hosted marketplace**, and an npm source or a non-git local directory resolves to
`unknown` instead. This repo qualifies because [`P-11`](../PLUGIN-PRD.md#p-11--the-repo-is-its-own-marketplace) keeps the source a relative `./` path in a
git-hosted marketplace. After this slice, resolution stops at step one and the condition stops
mattering *for this plugin* — but it still governs anyone who forks the repo without a version,
so leave [`P-11`](../PLUGIN-PRD.md#p-11--the-repo-is-its-own-marketplace) and the source type alone.

Nothing in `src/`, `tests/`, `skills/`, `.mcp.json`, or `dist/` changes in this slice unless
pre-flight 1(h) or requirement 6 forced it.

## Out of scope — do NOT

- **No npm publish.** The npm route survives [`P-09`](../PLUGIN-PRD.md#p-09--server-ships-as-committed-built-javascript) as the secondary channel for non-Claude MCP
  clients (`MCP-PRD.md` [`D-02`](../MCP-PRD.md#d-02--runtime-nodejs--typescript)) and **its version is independent by design**. Publishing it is an
  optional, unscheduled follow-up with its own audience and its own release decision. It is not
  part of declaring the plugin public and it must not ride along on this session's tag.
- **No community-marketplace submission in this session**, even if [`PQ-05`](../PLUGIN-PRD.md#pq-05--should-the-plugin-be-submitted-to-the-community-marketplace-once-it-is-stable) is answered "yes." The
  *answer* is the deliverable; the submission is separate work with someone else's review and
  automated safety screening in the loop.
- **No feature work.** No new capability, no skill edits, no server behavior changes. A release
  gate that also changes behavior is not a gate. If pre-flight finds a defect, fix it in the slice
  that owns it, land it normally, and re-open the gate from 1(a).
- **No edits to [`docs/PLUGIN-PRD.md`](../PLUGIN-PRD.md)** beyond the appended [`PQ-05`](../PLUGIN-PRD.md#pq-05--should-the-plugin-be-submitted-to-the-community-marketplace-once-it-is-stable) paragraph in [§7](../PLUGIN-PRD.md#7-open-questions) and the single
  [§9](../PLUGIN-PRD.md#9-revision-log) row. §2 and §3 are locked. [`P-08`](../PLUGIN-PRD.md#p-08--version-scheme)'s text does not change.
- **No new decision block.** Nothing here is a new `P-`; if this session finds itself drafting
  one, it has found scope belonging to a different slice.
- **No syncing `package.json` to the plugin version.** Listed twice on purpose (requirement 5),
  because it looks like housekeeping.
- **No `version` in the marketplace entry**, for any reason, including "for clarity."
- **No moved or deleted tags, no force-push to `main`.**
- **No scheduling of Phase 2.** See Context.

## Acceptance criteria

1. `.claude-plugin/plugin.json` carries an explicit semver `version`, and
   `grep -n '"version"' .claude-plugin/marketplace.json` returns nothing.
2. `package.json` `version` and `APP_VERSION` are equal to each other; their relationship to the
   plugin version is *none*. If either moved, `dist/` was rebuilt in the same commit and Slice
   11's check is green on it.
3. Positive test A recorded: after the version-setting push, `/plugin update` on an
   already-installed machine picked the change up, with the before/after versions written down.
4. Negative test recorded: after a doc-only push with no bump, `/plugin update` reported already
   current, and the installed copy under `~/.claude/plugins/cache` demonstrably does **not**
   contain the change — with the file and the string that was searched for named in the record.
5. Positive test B recorded: after a patch bump, the update landed **and** carried the withheld
   commit with it.
6. `claude plugin validate . --strict`, `npm test`, `npm run acceptance` (all PASS, exit 0), and
   [Slice 11](./TrackC-Slice11.md)'s CI check all passed **before** the tag was pushed, and the results doc shows that
   ordering rather than merely listing the outcomes.
7. The release tag exists on the remote, names the final released version, and the observed
   behavior of `claude plugin tag` — dry-run output, tag name format, where it read the version
   from — is written down.
8. The Fan Content disclaimer is verbatim identical across `plugin.json` `description`, the
   marketplace entry's `description`, and the README.
9. `docs/PLUGIN-PRD.md` [§7](../PLUGIN-PRD.md#7-open-questions)'s [`PQ-05`](../PLUGIN-PRD.md#pq-05--should-the-plugin-be-submitted-to-the-community-marketplace-once-it-is-stable) has a dated disposition paragraph, and
   `git diff docs/PLUGIN-PRD.md` shows exactly that paragraph plus one appended [§9](../PLUGIN-PRD.md#9-revision-log) row —
   nothing else.
10. `docs/slices/TrackC-Slice13-results.md` exists and records, in order: the pre-flight results,
    the version chosen and why, both update-semantics tests with the harness's exact wording, the
    tag command's observed behavior, and the [`PQ-05`](../PLUGIN-PRD.md#pq-05--should-the-plugin-be-submitted-to-the-community-marketplace-once-it-is-stable) reasoning.
11. Tree clean and pushed; [`docs/DEV-ROADMAP.md`](../DEV-ROADMAP.md) Slice 13 marked ☑ with a Landed note and [§2](../DEV-ROADMAP.md#2-current-state-verified-2026-08-04)'s
    current-state statement updated.

## Testing requirements

There is no code in this slice and therefore no unit test. The tests **are** the two
update-semantics observations, and they are only evidence if they are made **from outside**:

- **Both tests need the installed copy, not the working tree.** A working tree is always current
  with itself and can never demonstrate that an update did or did not ship. Read
  `~/.claude/plugins/cache` — each installed version is a separate directory there — and check
  for the presence or absence of a specific known string from the test commit.
- **The negative test's evidence is an absence**, which is the easiest kind of evidence to fake by
  not looking. Name the file and the exact string you searched for in the results doc; "it didn't
  update" is an assertion, not a finding.
- **Do not batch the commits or the updates.** One `/plugin update` per test, in order. The
  boundary between them is the entire experiment.
- **`npm test` and `npm run acceptance` are pre-flight, not this slice's testing.** They prove the
  artifact still works; they say nothing about whether the switchover happened.
- The previous version's cache directory is marked **orphaned and removed 14 days later** ([§4.3](../PLUGIN-PRD.md#43-versioning-and-updates)),
  which is a grace period for sessions that already loaded it. Finding an old version's directory
  still present is expected, not a failed uninstall.

## Verification steps

```bash
# --- pre-flight, in this order; stop at the first failure --------------------
git status --porcelain                        # must be empty
git log --oneline -1                          # HEAD, and it must be pushed
npm run typecheck && npm test && npm run build
git status --porcelain                        # still empty => dist/ was current
npm run acceptance                            # live, ~1 min, all PASS, exit 0
claude plugin validate . --strict
grep -n '"version"' .claude-plugin/marketplace.json   # must print NOTHING
grep -rn "Fan Content" .claude-plugin/ README.md      # three surfaces, verbatim
grep -n "OWNER" src/config.ts                 # must find nothing — see 1(h)
# and: Slice 11's CI check green on this exact SHA

# --- the switchover ----------------------------------------------------------
# edit .claude-plugin/plugin.json -> "version": "<semver>"
claude plugin validate . --strict
git add -A && git commit && git push
#   installed machine: /plugin update   => picked up            (positive A)

# --- the negative test: the one that proves it -------------------------------
# doc-only commit, NO version bump, push
#   installed machine: /plugin update   => "already current"
grep -r "<known string from that commit>" ~/.claude/plugins/cache/   # must MISS

# --- bump, and confirm the withheld commit arrives ---------------------------
# bump the patch version in plugin.json, push
#   installed machine: /plugin update   => lands, carries the doc commit  (B)

# --- last write of the session, and only now ---------------------------------
claude plugin tag --help
claude plugin tag --dry-run        # record exactly what it reports
claude plugin tag --push
git ls-remote --tags origin        # the tag is on the remote, naming the final version
```

Those `grep` lines are Git Bash; the PowerShell equivalents are `Select-String`, and the checks
are identical. The `/plugin` commands are typed inside a Claude Code session on the installed
machine, not in this repo's shell.

## References

- `docs/DEV-ROADMAP.md` [§4](../DEV-ROADMAP.md#4-phase-1-slices) Slice 13 (the work), [§5](../DEV-ROADMAP.md#5-order-and-parallelism) (Slice 13 is the terminal node, needing 11 and
  12), [§6](../DEV-ROADMAP.md#6-beyond-phase-1--queued-slice-packs) (the queued packs that this boundary does *not* schedule), [§3](../DEV-ROADMAP.md#3-standing-rules--apply-to-every-slice-never-restated-per-slice) (standing rules).
- `docs/PLUGIN-PRD.md` [`P-08`](../PLUGIN-PRD.md#p-08--version-scheme) (version scheme, the SHA fallback and its condition, the
  never-both-places prohibition), [`P-09`](../PLUGIN-PRD.md#p-09--server-ships-as-committed-built-javascript) (committed build output; npm as the secondary channel),
  [`P-11`](../PLUGIN-PRD.md#p-11--the-repo-is-its-own-marketplace) (relative source in a git-hosted marketplace — what keeps the SHA fallback legal),
  [§3.5](../PLUGIN-PRD.md#35-what-the-user-must-see-and-must-not) (the three disclaimer surfaces), [§4.2](../PLUGIN-PRD.md#42-marketplace-and-install-path) (marketplace precedence, `sha` pinning, `validate
  --strict`), [§4.3](../PLUGIN-PRD.md#43-versioning-and-updates) (resolution order, update semantics, cache directories, release tagging),
  [§6](../PLUGIN-PRD.md#6-roadmap) (the switchover as phase boundary), [`PQ-05`](../PLUGIN-PRD.md#pq-05--should-the-plugin-be-submitted-to-the-community-marketplace-once-it-is-stable) (community marketplace), [`PQ-06`](../PLUGIN-PRD.md#pq-06--what-keeps-the-committed-dist-honest) (the `dist/`
  honesty mechanism [Slice 11](./TrackC-Slice11.md) closed), [§9](../PLUGIN-PRD.md#9-revision-log) (revision log — append-only).
- `docs/MCP-PRD.md` [`D-02`](../MCP-PRD.md#d-02--runtime-nodejs--typescript) (Node runtime; the npm/`npx` route this slice does not exercise),
  [§3.4](../MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance) (rate limits are hard constraints — binding on pre-flight 1(d)), [§6](../MCP-PRD.md#6-phases) (phases).
- [`docs/slices/TrackA-Slice6.md`](./TrackA-Slice6.md) — the closing-verification pattern this slice follows.
