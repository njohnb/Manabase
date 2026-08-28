# Track C — Slice 18: Automated release on merge to main — the P-08 switchover, automated

> Self-contained implementation spec. You do not need to read the PRDs to build this slice;
> everything binding is inlined. PRD references are pointers for deeper context only.

> **On the number 18.** Slice numbers are allocated chronologically, not grouped by phase. This is
> Phase 1 release work (Track C) and it is numbered after Phase 2's
> [Slices 15–17](../DEV-ROADMAP.md#7-phase-2-slices--combo-discovery) because those were allocated
> first. Phase 1 is still open; closing it is [Slice 13](./TrackC-Slice13.md)'s remnant, not this
> slice's.

**Goal.** `plugin.json` gains an explicit version for the first time, that version increments itself
from the commit range, and a merge to `main` publishes both artifacts — the versioned plugin and the
`.mcpb` — with no number typed by a human anywhere. This slice **absorbs
[Slice 13](./TrackC-Slice13.md)'s requirements 3 and 7–9** (the switchover and the three
update-semantics tests) and leaves that slice its
[`PQ-05`](../PLUGIN-PRD.md#pq-05--should-the-plugin-be-submitted-to-the-community-marketplace-once-it-is-stable)
disposition and its Phase 1 closing row. Promoted from
[`IDEAS.md`](../../IDEAS.md#idea-02--auto-release-on-merge-to-main).

## Why this slice exists and why it moved ahead of Slice 12

**Read this before acting on anything below; it inverts an existing gate deliberately.**

[Slice 12](./TrackC-Slice12.md)'s cold run has gated
[Slice 13](./TrackC-Slice13.md)'s [`P-08`](../PLUGIN-PRD.md#p-08--version-scheme) switchover since
both were written, and the reason was sound: a public version cannot be withdrawn, so a stranger
should read the README before the irreversible act. **Three things changed that calculation, and
none of them is impatience.**

1. **The gate's premise was the cost of being wrong, and this slice lowers it.** The switchover was
   dangerous because a defect shipped after it needed a hand-cut release to fix —
   [Slice 13](./TrackC-Slice13.md) requirement 13 describes exactly that recovery. Automating the
   release is what makes the recovery cheap. The gate protects against a cost this slice removes.
2. **The friend is not the instrument for this slice's proof.**
   [Slice 13](./TrackC-Slice13.md)'s requirements 7–9 — SHA→semver picked up, a push without a bump
   ships nothing, a bump ships and carries the withheld commit — all run on the **author's
   already-installed** machine. A cold reader cannot perform them; they require a machine that had
   the plugin installed *before* the switchover.
3. **The artifact the friend should be testing does not exist yet.** `v0.1.0` and `v0.1.1` both
   predate [Slices 15–17](../DEV-ROADMAP.md#7-phase-2-slices--combo-discovery), so a cold run today
   installs a bundle carrying **one** tool while `main` already registers two and
   [PR #53](https://github.com/njohnb/Manabase/pull/53) makes it three. Sending a stranger at a
   knowingly stale artifact spends the one thing this project cannot buy twice.

**So the order is: this slice, then [Slice 12](./TrackC-Slice12.md)'s run against what this slice
released, then [Slice 13](./TrackC-Slice13.md)'s remnant.** That reordering is recorded in
[`docs/DEV-ROADMAP.md` §5](../DEV-ROADMAP.md#5-order-and-parallelism) and in an amendment block at
the top of both affected slice specs. **What it does not do is lower a gate by skipping it** — every
pre-flight check [Slice 13](./TrackC-Slice13.md) requires before the switchover is reproduced in
requirement 1 below, unchanged.

## Preconditions

- **[Slice 11](./TrackC-Slice11.md) — the `dist/` honesty mechanism (done).**
  [`.github/workflows/ci.yml`](../../.github/workflows/ci-release.yml) must be green on the exact commit
  this slice releases from. This slice adds an irreversible publish step downstream of that gate; a
  gate that has not run is not a gate.
- **[Slice 13](./TrackC-Slice13.md)'s [`PC-03`](../PLUGIN-PRD.md#pc-03--mcpb-bundle-for-the-chat-tab)
  half (done, 2026-08-10).** [`scripts/pack-mcpb.mjs`](../../scripts/pack-mcpb.mjs) exists, stamps
  the version, and asserts the packed `server/index.js` is byte-identical to the committed
  [`dist/index.js`](../../dist/index.js). This slice **calls** that script and never reimplements
  its assertion.
- **A machine with the plugin already installed at a SHA-resolved version.** Requirement 8's
  positive test A is a one-time transition and it is unobservable if nothing was installed
  beforehand. Confirm this **before** writing the switchover commit; afterwards it cannot be
  recreated without uninstalling and reinstalling from an older commit.
- **`main` is not branch-protected.** Verified 2026-08-25 — the branch-protection API returns 404.
  Requirement 5's write-back to `main` depends on it. **If protection is ever added, this slice's
  mechanism breaks silently in CI**, so requirement 5 states the failure mode rather than assuming
  the condition holds forever.

## Context

Manabase is a Magic: The Gathering MCP server (Scryfall-backed card search) that ships two ways from
one source ([`P-14`](../PLUGIN-PRD.md#p-14--two-distribution-targets-one-source)): a Claude Code
plugin, and an `.mcpb` bundle for the Claude Desktop Chat tab.

**Releasing is currently a hand-pushed tag, and the evidence that this is a defect is the tag list.**
[`release.yml`](../../.github/workflows/ci-release.yml) fires only on `push: tags: v*`;
[`ci.yml`](../../.github/workflows/ci-release.yml) runs on every push to `main` and never releases. Two tags
exist, `v0.1.0` and `v0.1.1`, both from 2026-08-10, and everything merged since has reached nobody —
including [Slice 16](./TrackA-Slice16.md)'s `combo_search`, half of
[`CAP-02`](../MCP-PRD.md#cap-02--combo-discovery). An installed `.mcpb` never re-pulls, so nothing
corrects that over time.

**The version and the release trigger are one problem, not two.** A workflow that releases on merge
needs to know *what version this is*, and the repo has no number that moves: `package.json` is
`0.0.0`, the MCPB manifest is stamped from the tag, and `plugin.json` deliberately carries none
under [`P-08`](../PLUGIN-PRD.md#p-08--version-scheme). This slice makes `plugin.json`'s `version` the
one release number — which is the number
[`P-08`](../PLUGIN-PRD.md#p-08--version-scheme) already requires a public release to write — and
computes it from the commit range so no human types it.

**That choice corrects what
[`IDEA-02`](../../IDEAS.md#idea-02--auto-release-on-merge-to-main) recorded.** The entry named
`package.json` as the version source. [Slice 13](./TrackC-Slice13.md) requirement 5 forbids syncing
`package.json` to the plugin version — stated twice on purpose — because
[`P-09`](../PLUGIN-PRD.md#p-09--server-ships-as-committed-built-javascript) rejected `npx` precisely
to avoid two numbers bumped in lockstep. Sourcing from `plugin.json` keeps `package.json`
independent at `0.0.0`, keeps `APP_VERSION` mirroring it, and dissolves
[`PQ-09`](../PLUGIN-PRD.md#pq-09--how-does-the-mcpb-manifest-version-relate-to-p-08)'s
"fourth hand-synced copy" objection instead of arguing past it: there is **one** authored number and
a script authors it.

## Deliverables

| File | Action |
|---|---|
| `scripts/bump-version.mjs` | new — computes the next version from the commit range, writes `plugin.json`, `--dry-run` and `--set` |
| `.github/workflows/release.yml` | modify — trigger becomes `push: branches: [main]`; the tag trigger is **removed** (requirement 6) |
| `.claude-plugin/plugin.json` | modify — gains `version`, written by the script, not by hand. The **only** file that gets one |
| `mcpb/manifest.json` | modify — the `tools` array declares all three registered tools (requirement 2) |
| `tests/manifest.test.ts` | new — the manifest tool list and `APP_VERSION` cannot drift again (requirement 3) |
| `package.json` | modify — one `scripts` entry for the bump script. `version` stays `0.0.0` |
| `docs/slices/TrackC-Slice18-results.md` | new — the recorded release, all three update-semantics tests, the first automated version and why |
| [`docs/PLUGIN-PRD.md`](../PLUGIN-PRD.md) | modify — [`PC-03`](../PLUGIN-PRD.md#pc-03--mcpb-bundle-for-the-chat-tab) gains a dated amendment and new criteria; one appended [§9](../PLUGIN-PRD.md#9-revision-log) row |
| [`docs/DEV-ROADMAP.md`](../DEV-ROADMAP.md) | modify — Slice 18 entry and status; [§5](../DEV-ROADMAP.md#5-order-and-parallelism)'s reordered edges |
| [`IDEAS.md`](../../IDEAS.md) | modify — [`IDEA-02`](../../IDEAS.md#idea-02--auto-release-on-merge-to-main) status → `promoted`, and the version-source correction appended |

## Requirements

1. **Pre-flight, in this order, before a single character of the switchover is written.** This is
   [Slice 13](./TrackC-Slice13.md) requirement 1 reproduced, because moving the switchover into this
   slice moves its gate too. Stop at the first failure; never carry one forward "to fix after
   releasing."
   - **(a)** `git status` clean, on a branch off current `main`, local and remote agree.
   - **(b)** `npm run lint:docs && npm run typecheck && npm test && npm run build`, then
     `git status` again — still clean means `dist/` was already current.
   - **(c)** [Slice 11](./TrackC-Slice11.md)'s CI check is green on the exact commit being released,
     not on an ancestor and not on a branch that has since moved.
   - **(d)** `npm run acceptance` — one fresh live pass, every check PASS, exit 0. Politeness binds:
     ≥600 ms between calls, no retries, and **never** provoke a 429
     ([`MCP-PRD.md` §3.4](../MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance)).
   - **(e)** `claude plugin validate . --strict` — **expected to fail on exactly one warning today**,
     [`P-08`](../PLUGIN-PRD.md#p-08--version-scheme)'s unset `version`. Record the output *before*
     the switchover, because that warning disappearing is
     [`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) criterion 9's evidence and this is the
     only slice positioned to capture both sides of it.
   - **(f)** The Fan Content disclaimer verbatim on all three surfaces —
     [`plugin.json`](../../.claude-plugin/plugin.json)'s `description`, the marketplace entry's, and
     [`README.md`](../../README.md) ([§3.5](../PLUGIN-PRD.md#35-what-the-user-must-see-and-must-not)).
     Compare the strings to each other, character by character; reading them for sense is how a
     reworded copy survives a review.
   - **(g)** `dist/index.js` completes an `initialize` handshake from a directory containing no
     `node_modules`. The offline-start property is what makes the server start with no network.
   - **(h)** `APP_VERSION`'s contact URL is real. **Verified 2026-08-25 as already discharged** —
     [`src/config.ts`](../../src/config.ts) builds
     `manabase-mtg/${APP_VERSION} (+https://github.com/njohnb/manabase)` and the `OWNER` placeholder
     [Slice 13](./TrackC-Slice13.md) pre-flight 1(h) warned about is gone. Re-check rather than
     trust this line.

2. **Fix the two defects that would otherwise ship on the first automated release, before writing
   the automation.** Both are live today and both are invisible until someone installs.
   - **[`mcpb/manifest.json`](../../mcpb/manifest.json)'s `tools` array declares one tool**,
     `card_search`, while [`src/tools/register.ts`](../../src/tools/register.ts) registers more.
     **The count is moving under this slice and must not be hardcoded anywhere:** `main` registers
     **two** as of 2026-08-25 — `card_search` and `combo_search` —
     and [PR #53](https://github.com/njohnb/Manabase/pull/53) adds `combo_find_deck` for a third.
     Declare whatever `register.ts` exports at the commit being built, with descriptions matching the
     registered ones. **Do not assume the field is decorative:** Claude Desktop renders it, so an
     under-declared list is a user-facing claim that the bundle does less than it does. Whether it
     also affects function is unverified and does not need to be — the list is wrong either way.
   - **`APP_VERSION` stays `0.0.0` and stays coupled to `package.json`, not to the release version.**
     This is deliberate and it is [Slice 13](./TrackC-Slice13.md) requirement 5 applied, not an
     oversight: an automated *plugin* release does not change the npm artifact, so `package.json`
     does not move, so `APP_VERSION` does not move. Record the consequence plainly in the results
     doc — the `User-Agent` Scryfall sees names the npm artifact's version, which is not the
     plugin's, and there is no rule relating them
     ([`MCP-PRD.md` D-02](../MCP-PRD.md#d-02--runtime-nodejs--typescript),
     [`P-09`](../PLUGIN-PRD.md#p-09--server-ships-as-committed-built-javascript)).

3. **Make both defects unable to recur, with a test rather than a note.** `tests/manifest.test.ts`
   asserts two things: every name in [`mcpb/manifest.json`](../../mcpb/manifest.json)'s `tools`
   array is a registered tool name and every registered tool name appears in it — **a set equality
   in both directions, never a count**, so a tool added on either side without the other fails
   `npm test`. That property is what makes the test survive
   [PR #53](https://github.com/njohnb/Manabase/pull/53) landing a third tool underneath it; and
   `APP_VERSION` equals `package.json`'s `version`, which turns the hand-sync rule
   [Slice 13](./TrackC-Slice13.md) requirement 6 describes into a check instead of a memory.
   Read `package.json` with `readFileSync` rather than importing it, per the existing convention that
   tests behave identically under type stripping and under the bundle.

4. **`scripts/bump-version.mjs` is the single implementation of "what version is next," and it must
   be runnable locally and on the runner with identical behavior.** That is
   [`scripts/pack-mcpb.mjs`](../../scripts/pack-mcpb.mjs)'s own pattern and its stated reason —
   [`PC-03`](../PLUGIN-PRD.md#pc-03--mcpb-bundle-for-the-chat-tab) criterion 7 lives in the script so
   there is no second copy to drift. Node builtins only; no dependency, and nothing that reaches the
   network.
   - **Range: the last `v*` tag to `HEAD`**, not the push range. Three `docs:` merges followed by one
     `feat:` merge must produce **one** release covering all four, and a push-range job would decide
     each merge in isolation and miss the accumulation. With no tag at all, fall back to the root
     commit.
   - **Mapping, and it is a decision this spec makes rather than inherits:** `feat:` → **minor**;
     `fix:` and `perf:` → **patch**; `docs:`, `chore:`, `ci:`, `test:`, `refactor:`, `style:` →
     **no release**; a commit with **no conventional prefix** → **no release**, and it must be
     `log`ged by subject rather than silently ignored, because `662604c` proves unprefixed commits
     happen here. Highest wins across the range.
   - **A breaking marker (`!` or a `BREAKING CHANGE` footer) maps to MINOR while the version is
     `0.x`, not major.** Semver permits it and the alternative ships a `1.0.0` as a side effect of a
     commit message. State this in the script's header comment; a future session will otherwise read
     the mapping as a bug.
   - **Base version:** `plugin.json`'s `version` when present. On the **first** run it is absent, so
     the base is the newest existing tag's version, `0.1.1` — which makes the first automated release
     `0.2.0`, since [Slices 15–17](../DEV-ROADMAP.md#7-phase-2-slices--combo-discovery) are `feat:`.
     Do not hardcode `0.1.1`; read the tag.
   - **Validate the computed string against real semver, never against `\d+`.**
     [`scripts/pack-mcpb.mjs`](../../scripts/pack-mcpb.mjs)'s guard is `^\d+\.\d+\.\d+(?:[-+].+)?$`,
     which accepts `0.1.01`; that near-miss is recorded from the `v0.1.1` session and this script must
     not repeat it. Reject a leading zero in any numeric component.
   - **Refuse a version that already exists as a tag.** `v0.1.0` and `v0.1.1` are spent, a released
     bundle cannot be withdrawn, and a reused version string reads to the harness as "already
     current" and ships nothing ([§4.3](../PLUGIN-PRD.md#43-versioning-and-updates)).
   - **`--dry-run` writes nothing** and prints the range, the commits that drove the decision, the
     current version and the computed one. **`--set <semver>` overrides the computation** and is
     still validated and still tag-checked — that is the manual escape hatch, and it is the reason
     this is a script rather than inline workflow YAML.
   - **"No release" is not a failure.** Exit 0 and report the decision on stdout in a form the
     workflow can read (a `GITHUB_OUTPUT` line when the variable is present, stdout otherwise). A
     non-zero exit on a documentation-only merge would turn every docs PR red, which is the failure
     the skip path exists to prevent.
   - **Preserve the file exactly.** [`plugin.json`](../../.claude-plugin/plugin.json) is
     2-space-indented with a trailing newline and its key order is meaningful to a reader. Write the
     version in place; do not reserialize the whole object from a re-ordered map. **The working tree
     is CRLF (`core.autocrlf=true`) and only `dist/index.js` is pinned to LF by
     `.gitattributes`** — a whole-file rewrite normalizes line endings and shows every line as
     changed, burying the one-line edit.

5. **The workflow: one job, on `push: branches: [main]`, with everything irreversible last.** Order
   is binding, not stylistic.
   1. `npm ci` → `npm run lint:docs` → `npm run typecheck` → `npm test`
   2. rebuild `dist/` and fail on `git status --porcelain -- dist/` being non-empty — the
      [Slice 11](./TrackC-Slice11.md) gate, **ahead of every publishing step**
   3. `node scripts/bump-version.mjs`. **No release warranted → the job ends successfully here**, and
      nothing after this point runs
   4. commit the bumped [`plugin.json`](../../.claude-plugin/plugin.json) and push it to `main`
   5. create and push the tag `v<version>`
   6. `npm run pack:mcpb` with `MANABASE_BUNDLE_VERSION` set to the tag
   7. `gh release create` with the bundle attached
   - **The write-back to `main` uses `GITHUB_TOKEN`, and that token's pushes do not trigger
     workflows.** This is load-bearing in two directions: it means **no `[skip ci]` marker is
     needed**, and it means **a tag pushed by this job cannot trigger a second workflow** — which is
     exactly why steps 5–7 live in this job rather than in a tag-triggered one. Confirm the behavior
     in-session and write down what was observed; do not assert it from this spec.
   - **`concurrency` with a group and `cancel-in-progress: false`.** Two merges landing close
     together must not race the same tag, and cancelling a run mid-publish is worse than queueing it.
   - **`permissions: contents: write`.** Nothing more.
   - **Do not add `npm run acceptance` to this workflow, under any trigger.** It calls live Scryfall
     and [`MCP-PRD.md` §3.4](../MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance) makes
     rate limits a hard constraint;
     [`ci.yml`](../../.github/workflows/ci-release.yml) already says so in a comment and the reason is
     unchanged. **State in the results doc that automated releases therefore ship without a live
     pass** — by design, and it removes the human who currently runs one before a deliberate release.

6. **Remove `release.yml`'s tag trigger, and say why in the file.** Two producers in one `v*`
   namespace is the trap: `claude plugin tag` writes into it
   ([§4.3](../PLUGIN-PRD.md#43-versioning-and-updates)), and so would this job. If both the merge job
   and a tag trigger are live, a tag pushed by hand cuts a *second* release of a version the merge
   job already published. Keep `workflow_dispatch` as the recovery path. **Never move or delete
   `v0.1.0` or `v0.1.1`.**

7. **Setting `version` in [`plugin.json`](../../.claude-plugin/plugin.json) executes
   [`P-08`](../PLUGIN-PRD.md#p-08--version-scheme); it does not amend it.** No new `P-` decision is
   minted, [`P-08`](../PLUGIN-PRD.md#p-08--version-scheme)'s text does not change, and §2 and §3 of
   both PRDs are untouched. **The marketplace entry must not carry a version, for any reason
   including "for clarity"** — `plugin.json` wins **silently**, so a divergent marketplace version is
   not an error the harness reports but an invisible wrong answer.
   `grep -n '"version"' .claude-plugin/marketplace.json` must print nothing, before and after.

8. **The three update-semantics tests, absorbed from [Slice 13](./TrackC-Slice13.md) requirements
   7–9. They are this slice's proof and they run on the author's installed machine, not a friend's.**
   - **Positive test A — the switchover is picked up.** On a machine where the plugin is already
     installed at a SHA-resolved version, `/plugin update` after the first automated release. Expect
     an update, because the resolved version changes from a commit SHA to a semver string and the
     cache key therefore differs. Record what `/plugin` reported before and after, and that a new
     directory appeared under `~/.claude/plugins/cache`.
   - **Negative test — a merge with no releasable commits ships nothing.** Merge a `docs:`-only
     change. Expect: the workflow runs, the bump script reports no release, **no tag, no Release, no
     new bundle**, and `/plugin update` on the installed machine reports already current. **Verify
     the absence positively** — read the installed copy under `~/.claude/plugins/cache` and name, in
     the results doc, the file and the exact string you searched for. "The command printed nothing
     alarming" is not evidence, and this is the test that distinguishes "the switchover worked" from
     "the harness never picked the version up at all."
   - **Positive test B — a releasable merge ships and carries the withheld commit.** Merge a `fix:`
     or `feat:` change. Expect a patch or minor release, and expect the update to bring the negative
     test's `docs:` commit with it. That arrival is the proof the earlier merge was **withheld**
     rather than lost. This is a different transition from test A: A proves SHA→semver once, B proves
     semver→semver, which is the semantics every user lives with from now on.
   - **Do not batch the merges or the updates.** One `/plugin update` per test, in order. The
     boundary between them is the entire experiment.

9. **Record the run in `docs/slices/TrackC-Slice18-results.md`**, following
   [`TrackC-Slice13-results.md`](./TrackC-Slice13-results.md)'s shape: the pre-flight results in
   order, the first automated version and the commit range that produced it, the bump script's
   `--dry-run` output verbatim, all three update-semantics tests with the harness's exact wording,
   what the `GITHUB_TOKEN` write-back and tag push were observed to do, the released bundle's byte
   size and its `server/index.js` sha256 against the committed
   [`dist/index.js`](../../dist/index.js), and the `--strict` output on both sides of the switchover.

10. **Close the loop in [`docs/PLUGIN-PRD.md`](../PLUGIN-PRD.md), and only where this slice may.**
    [`PC-03`](../PLUGIN-PRD.md#pc-03--mcpb-bundle-for-the-chat-tab) gains a dated amendment bullet
    and the criteria the automation adds; [§9](../PLUGIN-PRD.md#9-revision-log) gains **one** appended
    row. §2 and §3 are **locked** and §4 is a dated research record that is appended to, never
    overwritten. **If this slice finds itself needing to change
    [`P-08`](../PLUGIN-PRD.md#p-08--version-scheme)'s text, it has found scope belonging to a
    decision session — stop and report.**

11. **Do not close [`PQ-06`](../PLUGIN-PRD.md#pq-06--what-keeps-the-committed-dist-honest) and do not
    imply it moved.** Its commit half was [Slice 11](./TrackC-Slice11.md)'s. Its **user-facing half
    stays open and this slice sharpens it**: automation produces more bundles that never
    self-update, and a staleness signal is still the thing no mechanism in this repo provides.
    Append that observation to the results doc, not to [§7](../PLUGIN-PRD.md#7-open-questions) —
    the question's disposition is unchanged.

12. **The live sequence is three merges, in this order, and requirement 8's three tests fall out of
    them.** This is planned rather than improvised because the first one is irreversible and its
    version number is already determined by history.

    **Know this before merging anything: the first automated release is `v0.2.0`, and it fires on
    this slice's own merge.** The bump range is the last `v*` tag to `HEAD`, and `v0.1.1` predates
    [Slices 15–17](../DEV-ROADMAP.md#7-phase-2-slices--combo-discovery) — **three `feat:` commits
    from Slices 15–16 are already sitting unreleased on `main`** (`d08777b`, `4bf697d`, `0794bce`,
    verified 2026-08-25). So the range is a minor regardless of what this slice's own commits are
    prefixed with, and `0.1.1` + minor is `0.2.0`. **Do not prefix this slice's commits to
    manipulate that** — the honest prefix for each change is the right one, and the range decides.

    | # | Merge | Expected | Which test |
    |---|---|---|---|
    | 1 | **This slice's PR** | `v0.2.0` — tag, Release, bundle carrying `combo_search`. `plugin.json` gains `version` for the first time | **Positive test A**, SHA→semver, on the machine already installed at a SHA |
    | 2 | **A `docs:`-only PR** — the [Slice 12](./TrackC-Slice12.md) and [Slice 13](./TrackC-Slice13.md) amendment commits are the natural candidate | Green run, **no tag, no Release, no bundle** | **Negative test** — and the withheld commit for test B |
    | 3 | **[PR #53](https://github.com/njohnb/Manabase/pull/53)**, `feat: add combo_find_deck and close CAP-02` plus two `docs:` commits | `v0.3.0` — carrying `combo_find_deck` **and** merge 2's withheld `docs:` commit | **Positive test B**, semver→semver |

    Three things about merge 3 specifically. **Rebase it after merge 1** — it branched from
    `cd5fa8a`, before this slice and before the bot's `plugin.json` commit; the rebase is routine and
    there is no `dist/` conflict, because this slice changes no `src/`. **Its arrival is what makes
    merge 2's absence meaningful** — a withheld commit that never arrives is indistinguishable from
    a lost one, which is the whole point of ordering the negative test between two positives. And
    **`v0.3.0` is the artifact [Slice 12](./TrackC-Slice12.md)'s cold reader installs**, which is
    the reason that slice waits on this one: it is the first bundle in existence carrying all three
    tools.

    **Pull before every local action after merge 1.** The workflow commits `plugin.json` to `main`,
    so a clone that has not fetched is behind by a commit it did not write, and the next push
    rejects.

## Interface contracts

**The four version-bearing surfaces, after this slice.** This table supersedes
[Slice 13](./TrackC-Slice13.md)'s only in the first row's authorship; the couplings are unchanged.

| Surface | Written by | Coupled to | Consumer |
|---|---|---|---|
| `.claude-plugin/plugin.json` `version` | **`scripts/bump-version.mjs`** — never a human | nothing | Claude Code's version resolution; the `/plugin update` cache key; the tag name |
| `.claude-plugin/marketplace.json` entry | nobody — **must stay absent** | would be silently overridden by `plugin.json` | resolution step 2, never reached once step 1 exists |
| `package.json` `version` | a human, only if the npm artifact changed | `APP_VERSION`, and now a test | the npm/`npx` route ([`D-02`](../MCP-PRD.md#d-02--runtime-nodejs--typescript), secondary channel) |
| `mcpb/manifest.json` `version` | `scripts/pack-mcpb.mjs`, from the tag | the tag, therefore `plugin.json` | the Chat-tab install dialog |

- **Coupled:** `package.json` ↔ `APP_VERSION` ↔ `dist/`. Move one, move all three, in that order.
- **Newly coupled by this slice:** `plugin.json` `version` → the tag → the bundle's stamped version.
  One authored number reaches all three, which is what dissolves
  [`PQ-09`](../PLUGIN-PRD.md#pq-09--how-does-the-mcpb-manifest-version-relate-to-p-08)'s
  fourth-copy objection.
- **Still independent by design:** the plugin version and `package.json`'s. There is no rule relating
  them; inventing one is a regression dressed as tidiness.

**Resolution order the harness uses** (verified,
[§4.3](../PLUGIN-PRD.md#43-versioning-and-updates)): `plugin.json` `version` → marketplace entry
`version` → the git commit SHA of the plugin's source → the literal `unknown`. After this slice
resolution stops at step one. Leave [`P-11`](../PLUGIN-PRD.md#p-11--the-repo-is-its-own-marketplace)
and the source type alone — the SHA condition still governs anyone who forks the repo without a
version.

**The registered tool names** are exported from
[`src/tools/register.ts`](../../src/tools/register.ts) as `CARD_SEARCH_TOOL_NAME`,
`COMBO_SEARCH_TOOL_NAME` and — after
[PR #53](https://github.com/njohnb/Manabase/pull/53) — `COMBO_FIND_DECK_TOOL_NAME`. **Requirement
3's test reads those exports; it never restates the names and never asserts a count**, because the
set is changing under this slice. **Never write a scoped form into the manifest or a test** — the
scoped name is constructed per surface and is not a property of the server
([`P-12`](../PLUGIN-PRD.md#p-12--plugin-name-and-server-key)).

## Out of scope — do NOT

- **No cold run with a third party.** That is [Slice 12](./TrackC-Slice12.md)'s, and it comes
  **after** this slice so the friend installs what this slice released. Do not recruit anyone here,
  and do not treat the author's own install as a substitute.
- **No [`PQ-05`](../PLUGIN-PRD.md#pq-05--should-the-plugin-be-submitted-to-the-community-marketplace-once-it-is-stable)
  disposition and no Phase 1 closing row.** Both remain
  [Slice 13](./TrackC-Slice13.md)'s. This slice does **not** close Phase 1 —
  [`PC-01`](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) criterion 2 is still
  ambiguous-because-scaled and [Slice 12](./TrackC-Slice12.md) is still open, and Phase 1 is
  [`PC-01`](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) plus
  [`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) together.
- **No npm publish.** The npm route survives
  [`P-09`](../PLUGIN-PRD.md#p-09--server-ships-as-committed-built-javascript) as the secondary
  channel with an independent version and its own release decision. It must not ride along.
- **No syncing `package.json` to the plugin version.** Listed twice on purpose, here and in
  requirement 2, because it looks like housekeeping and it is the thing
  [`P-09`](../PLUGIN-PRD.md#p-09--server-ships-as-committed-built-javascript) rejected `npx` to
  avoid.
- **No `version` in the marketplace entry.**
- **No new `P-` or `D-` decision**, and no edit to §2, §3, or §4 of either PRD beyond requirement
  10's two appends.
- **No feature work.** No new capability, no skill edit, no server behavior change. A release slice
  that also changes behavior is not a gate. `src/` changes only if requirement 2's `APP_VERSION`
  finding or pre-flight 1(h) forces one — and then the pre-flight restarts at 1(a).
- **No moved or deleted tags, and no force-push to `main`.**
- **Never `sed -i` or any stream editor against a tracked file**, and never a scripted
  `String.replace` with a replacement *string* — `$` sequences in the replacement argument splice
  the file into itself, silently, as insertions with zero deletions.
- **No `npm run acceptance` in any workflow.**

## Acceptance criteria

1. `scripts/bump-version.mjs` exists, uses Node builtins only, and its `--dry-run` on the current
   `main` prints the range, the driving commits, the current version and the computed next one.
2. The mapping is exercised in both directions on real ranges: a `docs:`-only range reports **no
   release** and exits 0; a range containing `feat:` reports a **minor**. Both outputs are in the
   results doc.
3. The script refuses `0.1.0` and `0.1.1` as already-tagged, and refuses `0.1.01` as non-semver.
   Both refusals are demonstrated, not asserted.
4. `.claude-plugin/plugin.json` carries an explicit semver `version` written by the script, and
   `grep -n '"version"' .claude-plugin/marketplace.json` returns nothing.
5. `mcpb/manifest.json` declares exactly the tool names `src/tools/register.ts` exports at the
   released commit — two on `main` today, three after
   [PR #53](https://github.com/njohnb/Manabase/pull/53) — and `tests/manifest.test.ts` fails when a
   name is removed from either side, demonstrated by removing one and observing the failure.
6. `tests/manifest.test.ts` also asserts `APP_VERSION` equals `package.json`'s `version`, and
   `package.json` `version` is still `0.0.0` at the end of the slice.
7. A merge to `main` whose range contains no releasable commit produces **no tag, no Release, and no
   bundle**, and the workflow run is green. The run URL is recorded.
8. A merge to `main` whose range contains a releasable commit produces a `v<version>` tag, a
   published Release carrying `manabase.mcpb`, and a `plugin.json` on `main` whose version matches
   the tag — all from one workflow run, with the `dist/` gate having passed before any of it.
9. Positive test A recorded: `/plugin update` on an already-installed machine picked the switchover
   up, with the before and after versions written down and the new cache directory named.
10. Negative test recorded: after the requirement 8 no-release merge, `/plugin update` reported
    already current and the installed copy demonstrably does **not** contain the change — with the
    file and the exact string searched for named.
11. Positive test B recorded: after a releasable merge, the update landed **and** carried the
    withheld `docs:` commit.
12. The released bundle's `server/index.js` sha256 matches the committed `dist/index.js`, checked
    against the **downloaded asset** rather than the local pack.
13. `claude plugin validate . --strict` output is recorded on both sides of the switchover, and
    passes afterwards — which is
    [`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) criterion 9's evidence.
14. `docs/slices/TrackC-Slice18-results.md` exists with everything requirement 9 lists.
15. [`docs/PLUGIN-PRD.md`](../PLUGIN-PRD.md) carries the
    [`PC-03`](../PLUGIN-PRD.md#pc-03--mcpb-bundle-for-the-chat-tab) amendment and exactly one new
    [§9](../PLUGIN-PRD.md#9-revision-log) row; `git diff docs/PLUGIN-PRD.md` shows those and nothing
    else.
16. Tree committed clean, `dist/` rebuilt in the same commit as any `src/` change, and
    `npm run lint:docs` OK.
17. Requirement 12's three merges happened in that order, each workflow run URL is recorded, and the
    released versions are `v0.2.0` → *(no release)* → `v0.3.0`. If any observed version differs from
    that, the discrepancy is written down and explained rather than the table quietly corrected — a
    version that came out other than predicted is a finding about the bump script.

## Testing requirements

- **The bump script needs unit tests over the commit-range parser, not over git.** Pass the parser
  an array of subjects and assert the computed bump. A test that shells out to `git log` is testing
  the repository's history, which changes under it.
- **Both the positive and the negative workflow outcomes must be observed on a real run.** A skip
  path that has never skipped is not known to work — [Slice 11](./TrackC-Slice11.md)'s rule, and it
  applied there to a check nobody had watched fail.
- **The update-semantics tests need the installed copy, not the working tree.** A working tree is
  always current with itself and can never demonstrate that an update did or did not ship. Read
  `~/.claude/plugins/cache`; each installed version is a separate directory.
- **The negative test's evidence is an absence**, the easiest kind to fake by not looking. Name the
  file and the exact string.
- **A previous version's cache directory staying present is expected**, not a failed uninstall — it
  is marked orphaned and removed 14 days later ([§4.3](../PLUGIN-PRD.md#43-versioning-and-updates)).
- **`npm test` does not typecheck.** `--experimental-strip-types` strips types without checking
  them, so `npm run typecheck` is a separate and non-optional step — a lesson from
  [Slice 15](./TrackA-Slice15.md), where a changed shared interface left three test fakes broken
  with `npm test` still green.
- **Rehearse the workflow with `workflow_dispatch` on the branch before merging it.**
  [Slice 13](./TrackC-Slice13.md) did exactly this — three dispatch runs before the tag — and it is
  how the publishing steps get exercised without publishing.

## Verification steps

```bash
# --- pre-flight, in this order; stop at the first failure --------------------
git status --porcelain                        # must be empty
npm run lint:docs && npm run typecheck && npm test && npm run build
git status --porcelain                        # still empty => dist/ was current
npm run acceptance                            # live, all PASS, exit 0
claude plugin validate . --strict              # expect the ONE P-08 warning; record it
grep -n '"version"' .claude-plugin/marketplace.json   # must print NOTHING
grep -rn "Fan Content" .claude-plugin/ README.md      # three surfaces, verbatim
grep -n "OWNER" src/config.ts                 # must find nothing

# --- the bump script, before it is wired to anything ------------------------
node scripts/bump-version.mjs --dry-run       # record the range and the decision
node scripts/bump-version.mjs --set 0.1.1     # must REFUSE: tag already exists
node scripts/bump-version.mjs --set 0.1.01    # must REFUSE: not semver

# --- rehearse the workflow without publishing -------------------------------
gh workflow run release.yml --ref <this-branch>
gh run watch

# --- merge, then observe both outcomes --------------------------------------
#  1. merge a docs:-only PR   => green run, NO tag, NO release
gh release list && git ls-remote --tags origin
#  2. merge a feat:/fix: PR   => tag + Release + bundle, one run
gh run view --log | tail -40

# --- the installed machine, one /plugin update per test ---------------------
#  A: /plugin update  => picks the switchover up
#  negative: /plugin update => "already current"
grep -r "<known string from the docs commit>" ~/.claude/plugins/cache/   # must MISS
#  B: /plugin update  => lands, and carries the docs commit

# --- prove the released bundle carries the committed server -----------------
gh release download v<version> -p manabase.mcpb
# unpack and sha256 server/index.js against dist/index.js
```

Those `grep` lines are Git Bash; the PowerShell equivalents are `Select-String` and the checks are
identical. The `/plugin` commands are typed inside a Claude Code session on the installed machine,
not in this repo's shell.

## References

- [`docs/DEV-ROADMAP.md` §4](../DEV-ROADMAP.md#4-phase-1-slices) (Track C),
  [§5](../DEV-ROADMAP.md#5-order-and-parallelism) (the reordered edges this slice introduces),
  [§3](../DEV-ROADMAP.md#3-standing-rules--apply-to-every-slice-never-restated-per-slice) (standing
  rules — never restated per slice, and they apply here unchanged).
- [`docs/PLUGIN-PRD.md`](../PLUGIN-PRD.md):
  [`P-08`](../PLUGIN-PRD.md#p-08--version-scheme) (the version scheme this slice executes),
  [`P-09`](../PLUGIN-PRD.md#p-09--server-ships-as-committed-built-javascript) (committed build
  output; npm as the secondary channel and why two lockstep numbers were rejected),
  [`P-11`](../PLUGIN-PRD.md#p-11--the-repo-is-its-own-marketplace),
  [`P-12`](../PLUGIN-PRD.md#p-12--plugin-name-and-server-key),
  [`P-13`](../PLUGIN-PRD.md#p-13--no-user-configuration-in-phase-1),
  [`P-14`](../PLUGIN-PRD.md#p-14--two-distribution-targets-one-source),
  [`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) (criterion 9, which the switchover clears),
  [`PC-03`](../PLUGIN-PRD.md#pc-03--mcpb-bundle-for-the-chat-tab) (the component this slice amends),
  [§3.5](../PLUGIN-PRD.md#35-what-the-user-must-see-and-must-not),
  [§4.2](../PLUGIN-PRD.md#42-marketplace-and-install-path),
  [§4.3](../PLUGIN-PRD.md#43-versioning-and-updates) (resolution order, update semantics, cache
  directories, `claude plugin tag`),
  [`PQ-05`](../PLUGIN-PRD.md#pq-05--should-the-plugin-be-submitted-to-the-community-marketplace-once-it-is-stable)
  (**not** this slice's),
  [`PQ-06`](../PLUGIN-PRD.md#pq-06--what-keeps-the-committed-dist-honest) (user-facing half, which
  this slice sharpens and does not close),
  [`PQ-09`](../PLUGIN-PRD.md#pq-09--how-does-the-mcpb-manifest-version-relate-to-p-08) (the
  fourth-copy objection this slice's version source dissolves),
  [§7](../PLUGIN-PRD.md#7-open-questions), [§9](../PLUGIN-PRD.md#9-revision-log) (append-only).
- [`docs/MCP-PRD.md`](../MCP-PRD.md):
  [`D-02`](../MCP-PRD.md#d-02--runtime-nodejs--typescript) (the npm route this slice does not
  exercise), [`D-10`](../MCP-PRD.md#d-10--tool-handlers-never-throw),
  [§3.4](../MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance) (binding on pre-flight
  1(d), and the reason no workflow runs acceptance).
- [`docs/slices/TrackC-Slice11.md`](./TrackC-Slice11.md) (the `dist/` gate this slice publishes
  behind, and the rule that a check never observed failing is not known to work),
  [`docs/slices/TrackC-Slice12.md`](./TrackC-Slice12.md) (the cold run that follows this slice),
  [`docs/slices/TrackC-Slice13.md`](./TrackC-Slice13.md) (requirements 3 and 7–9 are absorbed here;
  its pre-flight is reproduced in requirement 1),
  [`docs/slices/TrackC-Slice13-results.md`](./TrackC-Slice13-results.md) (the results shape, and the
  `workflow_dispatch` rehearsal pattern),
  [`docs/slices/TrackA-Slice15.md`](./TrackA-Slice15.md) (`npm test` does not typecheck).
- [`IDEAS.md`](../../IDEAS.md#idea-02--auto-release-on-merge-to-main) — the pre-triage entry this
  slice promotes, including the version-source reading it corrects.
