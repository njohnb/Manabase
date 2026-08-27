# Track C — Slice 18 results: automated release on merge to main (the P-08 switchover, automated)

> **Status: build + rehearse complete; the live release sequence is the author's, and is not run
> here.** This pass produced every buildable, reversible artifact — the bump script, the manifest
> fix, the two test files, and the merge-triggered `release.yml` — and verified them locally. The
> three merges of [requirement 12](./TrackC-Slice18.md) (which publish `v0.2.0` → *(no release)* →
> `v0.3.0`) and the three `/plugin update` tests of
> [requirement 8](./TrackC-Slice18.md) are **irreversible and interactive**, deferred to the author
> by an explicit scope decision. Their rows below are left as author-TODO placeholders, to be filled
> as the sequence runs.

## How this was run

- Repo `C:\Projects\Manabase`, branch `docs/slice18-auto-release`, off `main` at `c33f735`.
- Claude Code session on the author's Windows 11 machine, Node `v22.17.1`, `core.autocrlf=true`.
- No push, no tag, no Release, no `/plugin` command in this pass — all deferred (see the status note
  above).

## What was built

| File | Action | State |
|---|---|---|
| [`scripts/bump-version.mjs`](../../scripts/bump-version.mjs) | new | pure parser behind a main-guard; `--dry-run`, `--set`, `GITHUB_OUTPUT` |
| [`mcpb/manifest.json`](../../mcpb/manifest.json) | `tools` now declares `card_search` **and** `combo_search`, descriptions matching the registered ones | fixed |
| [`tests/manifest.test.ts`](../../tests/manifest.test.ts) | new | tool-name set equality both directions; `APP_VERSION` == `package.json` version |
| [`tests/bump-version.test.ts`](../../tests/bump-version.test.ts) | new | 20 cases over the subject parser; never shells out to `git log` |
| [`.github/workflows/release.yml`](../../.github/workflows/release.yml) | rewritten | trigger `push: branches: [main]` + `workflow_dispatch`; tag trigger removed |
| [`package.json`](../../package.json) | one `scripts` entry `bump-version`; `version` still `0.0.0` | done |
| [`tsconfig.json`](../../tsconfig.json) | `allowJs: true`, `checkJs: false` — so the test can import the `.mjs` script without deep-checking its plain-JS body | done |

`src/` was **not** touched: pre-flight 1(h) confirmed `APP_VERSION`'s contact URL is real and there
is no `OWNER` placeholder, and requirement 2's `APP_VERSION` finding requires no code change, so the
"restart the pre-flight at 1(a)" branch was never entered. `dist/` therefore needs no rebuild-commit
beyond confirming it is current.

## Pre-flight, in the spec's order (requirement 1)

| Step | Result |
|---|---|
| **1(a)** git clean, branch off `main` | Branch `docs/slice18-auto-release` at `c33f735`. |
| **1(b)** `lint:docs && typecheck && test && build`, then git status | `lint:docs` OK (33 files, 4381 links, 0 broken). `typecheck` clean. `test` 237/237 (was 210 — the two new files add 27). `build` produced a `dist/` that git reports clean. |
| **1(c)** CI green on the exact commit | **Author-TODO** — CI runs on push/PR; confirm green on the commit this releases from before the live merge. |
| **1(d)** `npm run acceptance` | **13/13 PASS, exit 0, no 429.** One recorded drift, expected: no paper Black Lotus printing carries a USD price upstream any more (EUR only) — check 11 reports `no-price-data`, correctly, not a bare failure. |
| **1(e)** `claude plugin validate . --strict` | **Author-TODO — capture BOTH sides.** Expected to fail today on exactly one warning: [`P-08`](../PLUGIN-PRD.md#p-08--version-scheme)'s unset `version`. After the first automated release writes `version` into `plugin.json`, `--strict` is expected to pass — that pass is [`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) criterion 9's evidence, and this slice is the only one positioned to record both sides. |
| **1(f)** Fan Content disclaimer on all three surfaces | **Character-identical.** `plugin.json`'s `description`, the marketplace entry, and `README.md` (lines 436–438, line-wrapped) all carry the same string byte-for-byte. |
| **1(g)** offline `initialize` from a `node_modules`-free directory | **PASS.** `dist/index.js` copied to an empty scratch dir answered `initialize` → `serverInfo {name: "manabase-mtg", version: "0.0.0"}`. |
| **1(h)** `APP_VERSION` contact URL real, no `OWNER` | **PASS.** `grep OWNER src/config.ts` finds nothing; the User-Agent is `manabase-mtg/${APP_VERSION} (+https://github.com/njohnb/manabase)`. |

## The two ship-blocking defects (requirement 2)

- **Manifest `tools`:** was one entry (`card_search`, a one-line description); now declares the two
  tools [`src/tools/register.ts`](../../src/tools/register.ts) exports today — `card_search` and
  `combo_search` — with the descriptions matching the registered `CARD_SEARCH_DESCRIPTION` and
  `COMBO_SEARCH_DESCRIPTION`. No count is hardcoded anywhere; the test guards drift.
- **`APP_VERSION` stays `0.0.0`, coupled to `package.json`.** No `src/` change. **Consequence, stated
  plainly:** the `User-Agent` Scryfall sees names the **npm artifact's** version (`package.json`'s
  `0.0.0`), which is not the plugin's release version and has no rule relating it to one
  ([`D-02`](../MCP-PRD.md#d-02--runtime-nodejs--typescript),
  [`P-09`](../PLUGIN-PRD.md#p-09--server-ships-as-committed-built-javascript)). An automated *plugin*
  release does not change the npm artifact, so `package.json` does not move, so `APP_VERSION` does
  not move. This is [Slice 13](./TrackC-Slice13.md) requirement 5 applied, not an oversight.

## The defects cannot recur (requirement 3)

`tests/manifest.test.ts` asserts tool-name **set equality in both directions** between
`register.ts`'s `toolDefinitions` and the manifest's `tools` — never a count — so it survives
[PR #53](https://github.com/njohnb/Manabase/pull/53) landing a third tool, and it also asserts
`APP_VERSION` equals `package.json`'s `version`.

**Guard demonstrated failing, then restored** (acceptance criterion 5): with `combo_search` removed
from the manifest, `npm test` on the file failed with `manifest is missing registered tool:
combo_search` (2 of 4 assertions failed); after restoring, 4/4 pass and the manifest diff is back to
the intended `5 insertions(+), 1 deletion(-)`.

## The bump script (requirement 4)

`--dry-run` on the current branch, verbatim:

```
bump-version: range v0.1.1..HEAD
bump-version: 25 commit(s) in range
bump-version:   [minor] feat: fill combo_search pages to a byte budget, paged by offset
bump-version:   [patch] fix: re-size the combo_search page cap from 40 to 20, on measurement
bump-version:   [minor] feat: add combo_search and the normalized combo shape — Slice 16
bump-version:   [minor] feat: extract the HTTP transport and add POST — Slice 15
bump-version:   [no prefix — no release contribution] Merge pull request #52 ...
bump-version:   ... (merge commits and the unprefixed 662604c all contribute nothing)
bump-version: current version 0.1.1 (from tag; plugin.json has none yet)
bump-version: computed version 0.2.0 (minor)
bump-version: --dry-run, wrote nothing.
```

The unprefixed `662604c` ("prompt to setup card viewer project") is **logged by subject**, not
silently dropped. The base is read from the newest tag (`v0.1.1`) because `plugin.json` has no
`version` on the first run — `0.1.1` is not hardcoded.

**Both refusals demonstrated** (acceptance criterion 3):

- `--set 0.1.1` → *"v0.1.1 already exists as a tag — that version is spent…"*, exit 1.
- `--set 0.1.01` → *"refusing a non-semver version: 0.1.01 (a leading zero in a component is
  rejected)."*, exit 1. The strict-semver regex `^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)…$`
  rejects the leading-zero component that [`pack-mcpb.mjs`](../../scripts/pack-mcpb.mjs)'s looser
  `\d+` guard would accept.

**Mapping, both directions, on real ranges** (acceptance criterion 2): the release-warranted range
above computes a **minor**; a `docs:`-only range reports **no release** and exits 0 (covered by the
unit tests, and to be observed live as merge 2). The 0.x clamp (a breaking marker → minor, never
major, while the base is `0.x`) lives in `nextVersion` and is unit-tested.

## The workflow (requirements 5 & 6)

[`release.yml`](../../.github/workflows/release.yml) is now one merge-triggered job. Trigger
`push: branches: [main]` + `workflow_dispatch`; the **`v*` tag trigger is removed**, with the reason
in the file header: two producers in one `v*` namespace (`claude plugin tag` and this job) would
double-cut. `permissions: contents: write`; `concurrency: { group: release-main,
cancel-in-progress: false }`.

Step order, irreversible last: `npm ci` → `lint:docs` → `typecheck` → `test` → rebuild-and-gate
`dist/` → `bump-version.mjs` (`id: bump`) → **commit+push `plugin.json` to `main`** → **tag+push
`v<version>`** → `pack:mcpb` → `upload-artifact` → `gh release create`. Every step after the bump is
gated on `steps.bump.outputs.release == 'true'`; the write-back and Release steps additionally gate
on `github.event_name == 'push'`, so a `workflow_dispatch` rehearsal exercises build/bump/pack
without publishing. `MANABASE_BUNDLE_VERSION` is `v<version>` on push and empty on dispatch (a dev
bundle).

**Author-TODO — the `GITHUB_TOKEN` observation (requirement 5).** The spec requires confirming
*in-session* that the `GITHUB_TOKEN` write-back to `main` does **not** trigger a second workflow
run, and that the tag this job pushes does not fire one either. That can only be observed on a real
run; record here what the Actions log showed after the first live merge.

**Automated releases ship without a live pass — by design.** `npm run acceptance` is deliberately
absent from this workflow under every trigger ([`§3.4`](../MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance)),
which removes the human who currently runs one before a deliberate release. The pre-flight above is
where the live pass happens instead.

## Rehearsal (author-TODO)

Not run in this pass (it needs a branch push and Actions minutes). The command is
`gh workflow run release.yml --ref docs/slice18-auto-release` then `gh run watch`. Expect: green,
with *Commit*, *Tag*, and *Attach to the Release* **skipped** (dispatch is not a `push`), and the
pack step producing a `0.0.0-dev+<commit>` bundle uploaded as an artifact for inspection. Confirm
both a release-warranted dispatch (this branch) and a no-release outcome are observed — a skip path
never skipped is not known to work ([Slice 11](./TrackC-Slice11.md)'s rule).

## The live sequence (requirement 12) — author-TODO

| # | Merge | Expected | Test | Run URL | Observed |
|---|---|---|---|---|---|
| 1 | This slice's PR | `v0.2.0` — tag, Release, bundle carrying `combo_search`; `plugin.json` gains `version` | Positive A (SHA→semver) | _TODO_ | _TODO_ |
| 2 | A `docs:`-only PR | Green run, **no** tag/Release/bundle | Negative | _TODO_ | _TODO_ |
| 3 | [PR #53](https://github.com/njohnb/Manabase/pull/53), rebased after merge 1 | `v0.3.0` — `combo_find_deck` + merge 2's withheld `docs:` commit | Positive B (semver→semver) | _TODO_ | _TODO_ |

**The three update-semantics tests (requirement 8)** run on the author's already-installed machine,
one `/plugin update` per test, in order, reading `~/.claude/plugins/cache`:

- **Positive A** — `/plugin update` picks the switchover up (SHA→semver); record before/after
  versions and the new cache directory. _TODO_
- **Negative** — after merge 2, `/plugin update` reports already current; **prove the absence
  positively** by naming the file and exact string searched under the installed cache. _TODO_
- **Positive B** — after merge 3, the update lands **and** carries merge 2's withheld `docs:`
  commit. _TODO_

**Downloaded-asset byte-identity (acceptance criterion 12):** for each release, `gh release download
v<version> -p manabase.mcpb`, unpack, and sha256 `server/index.js` against the committed
[`dist/index.js`](../../dist/index.js). _TODO_

## `PQ-06`, sharpened not moved (requirement 11)

Automation produces **more** bundles that never self-update — an installed `.mcpb` has no update
path, and this slice adds a release on every releasable merge. A staleness signal remains the thing
no mechanism in this repo provides. [`PQ-06`](../PLUGIN-PRD.md#pq-06--what-keeps-the-committed-dist-honest)'s
user-facing half is **unchanged in disposition** — this observation lives here, not in
[`§7`](../PLUGIN-PRD.md#7-open-questions).

## Criteria status (of [Slice 18](./TrackC-Slice18.md)'s 17)

- **Built and locally verified here:** 1, 2, 3 (unit + guard-demo), 4, 5 (guard demonstrated), 6,
  13's *before* side, 14 (this doc), 15 (PLUGIN-PRD amendment + one §9 row), 16.
- **Verified by the live `v0.2.0` release (2026-08-26 — see the addendum below):** 8, and criterion
  **17's merge 1** — `v0.2.0` came out as the range predicted, with the recorded discrepancy that it
  fired from the fix PR (#55) rather than the slice PR (#54).
- **Awaiting the remaining live sequence (author):** 7 (the canonical no-release merge 2 —
  corroborated green by [PR #56](https://github.com/njohnb/Manabase/pull/56)'s merge, but not the
  sequence's own docs-only merge), 9, 10, 11, 12 (only the in-CI sha256 assertion has run, not a
  downloaded-asset check by a human), 13's *after* side, and criterion **17's merges 2 and 3**.

## Addendum 2026-08-25 — first live merge failed on branch protection; the mechanism was revised

**What happened.** This slice's PR (#54) merged, the release job ran on `push: main`, computed
`v0.2.0`, committed `plugin.json` locally in the runner, and then **failed pushing that commit to
`main`**: `remote: error: GH006: Protected branch update failed … Changes must be made through a
pull request … [remote rejected] HEAD -> main (protected branch hook declined)`. The steps after the
push (tag, pack, Release) never ran, so **nothing was partially published** — no `v0.2.0` tag, no
Release, no bundle; `v0.1.0`/`v0.1.1` untouched; `main` left at the PR-54 merge with `plugin.json`
still version-less. A clean, fully recoverable failure.

**Why.** The [precondition](./TrackC-Slice18.md) "`main` is not branch-protected" (the
branch-protection API returned 404 when the slice was scoped) **no longer holds** — protection with
`required_pull_request_reviews` was added between scoping and merge. Requirement 5 wrote this exact
failure mode down rather than assuming the condition held forever, which is why it was diagnosable in
one read.

**The fix (author's decision: "version rides in the PR").** The release job no longer pushes to
`main` at all. The author runs `npm run bump-version` on the release branch — it computes the version
and writes [`plugin.json`](../../.claude-plugin/plugin.json), and that write is committed **into the
PR**, so the version reaches `main` through the normal protected-PR flow. On merge, the job runs
[`scripts/bump-version.mjs`](../../scripts/bump-version.mjs) **`--check`**, which reads the committed
version and decides releasable (present, valid semver, not already tagged, ahead of the newest tag)
without writing or pushing anything, then tags + packs + publishes. **Tags are not
branch-protected**, so tagging needs no bypass. "No human types the number" is preserved — the script
computes it (requirement 4).

Requirement 5's step 4 ("commit the bumped `plugin.json` and push it to `main`") is **removed** by
this revision; the version is on `main` before the job runs. Everything else in requirement 5 — order,
the `dist/` gate first, `concurrency`, `contents: write`, no `acceptance` — is unchanged. Verified
locally: `--check` reports `0.2.0` releasable (newest tag `v0.1.1`); an already-tagged version and an
absent version both report **no release, exit 0** (the documentation-only-merge path); typecheck
clean, `npm test` 240/240, `lint:docs` OK.

**Recovery.** This fix PR also carries [`plugin.json`](../../.claude-plugin/plugin.json) at `0.2.0`
(written by the script), so merging it both installs the revised workflow and, via the same merge,
lets the job read `0.2.0` and cut the withheld **`v0.2.0`** release. The live update-semantics tests
(requirement 8) then run against that release exactly as the table above lays out.

## Addendum 2026-08-26 — `v0.2.0` shipped: the recovery happened

The prediction above played out. Recorded here as the outcome — the mechanism is the 2026-08-25
addendum above and the [`PC-03`](../PLUGIN-PRD.md#pc-03--mcpb-bundle-for-the-chat-tab)
"Corrected 2026-08-25" bullet, not restated.

**The failed run first.** [PR #54](https://github.com/njohnb/Manabase/pull/54)'s merge ran
[`release.yml`](../../.github/workflows/release.yml) on `push: main` (run `32917489462`,
2026-08-26T01:03Z) and **failed** — `GH006`, the protected-branch push of the bumped
[`plugin.json`](../../.claude-plugin/plugin.json) rejected. No tag, no Release, no bundle; a clean
failure, `v0.1.0`/`v0.1.1` untouched.

**Then `v0.2.0`.** [PR #55](https://github.com/njohnb/Manabase/pull/55)
(`fix/release-branch-protection`, merge commit `ddbfd4c`) carried
[`plugin.json`](../../.claude-plugin/plugin.json) at `0.2.0`, written by the script and merged
through the protected-PR flow. Its merge ran [`release.yml`](../../.github/workflows/release.yml)
(run `32918776980`, `push: main`, **success**) and published the first automated release: tag
**`v0.2.0`** on `ddbfd4c`, GitHub Release published **2026-08-26T01:23:37Z**, `targetCommitish`
`main`, **not** draft, **not** prerelease, marked **Latest**, asset **`manabase.mcpb` = 117,883
bytes**. [`plugin.json`](../../.claude-plugin/plugin.json) on `main` now carries `version: 0.2.0` —
the [`P-08`](../PLUGIN-PRD.md#p-08--version-scheme) switchover, the first time `plugin.json` is
version-bearing. The pack step's byte-identity assertion
([`PC-03`](../PLUGIN-PRD.md#pc-03--mcpb-bundle-for-the-chat-tab) criterion 7) passed inside CI, or
the job would have failed before publishing — corroboration, not a status change.

**The skip path, observed live.** [PR #56](https://github.com/njohnb/Manabase/pull/56)
(`ci/release-advisory`, merge `b4b2b34`, run `32919514504`, `push: main`, **success**) carried only
ci/docs changes and no version bump, and correctly produced **no** new tag, Release or bundle —
`v0.2.0` was already tagged and the range was non-releasable. This is real evidence the skip path
works on a live merge; it is **not** the sequence's canonical docs-only merge 2, which is still to
come.

**Criteria this moves** (the status section above is updated to match): criterion **8** is verified —
one run produced the tag, the Release carrying `manabase.mcpb`, and a
[`plugin.json`](../../.claude-plugin/plugin.json) on `main` matching the tag, with the `dist/` gate
ahead of all of it. Criterion **17's merge 1** is verified with its discrepancy written down rather
than smoothed over: the release fired from the **fix PR (#55)**, not the original slice PR (#54),
because #54's run failed on branch protection — a finding about the deployment, not the bump script,
which computed `0.2.0` correctly.

**Still author-TODO:** the canonical no-release merge 2 (criterion 7) and the withheld-`v0.3.0`
merge 3 (criterion 17's remainder); the three `/plugin update` update-semantics tests below
(criteria 9–11); the downloaded-asset sha256 by hand (criterion 12 — only the in-CI assertion has
run); and `claude plugin validate . --strict` on the *after* side (criterion 13's second half, which
is [`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) criterion 9's evidence —
[`plugin.json`](../../.claude-plugin/plugin.json) now has a `version` so the one warning should be
gone, but nobody has run `--strict` yet, so it stays unobserved). The Positive A / Negative /
Positive B rows in the table above stay author-TODO.
