# Track C — Slice 19 results: combine CI + Release into one gated pipeline, and auto-commit the version bump

> **Status: build + local verification complete; the live pipeline behavior is the author's to
> observe on the first PR and merge, and is not run here.** GitHub Actions cannot be exercised on the
> developer machine, so every claim below that depends on a runner — the PR auto-commit, the merge
> release, the concurrency behavior — is an **author-TODO**, to be confirmed on the first real PR
> against this branch's merged form. Everything that can be verified locally (the `--pr` mode, the
> workflow's YAML/structure, the full check suite, zero broken links) is verified and recorded.

## What this slice is

One workflow where the release is gated by the **same** run that checks the code, and the version
bump is written **automatically** onto the PR branch — with the bump *criteria* unchanged
(conventional-commit prefixes) and every binding release constraint preserved. It **evolves**
[Slice 18](./TrackC-Slice18.md)'s mechanism ("the author runs `bump-version` and commits") into "a
PR job runs it and commits," with the same end state, so it **executes** [P-08](../PLUGIN-PRD.md#p-08--version-scheme)
and does not amend it. No new `P-`/`D-`; §2/§3/§4 of both PRDs untouched.

## How this was run

- Repo `C:\Projects\Manabase`, branch `feat/slice19-combine-ci-release`, off `main` at `9b216bc`
  (the PR #59 merge; newest tag `v0.3.0`, `plugin.json` version `0.3.0`).
- Claude Code session on the author's Windows 11 machine, Node `v22.17.1`, `core.autocrlf=true`.
- No push, no PR, no tag, no Release in this pass — all deferred (see the status note above).

## Decisions taken with the author (planning session)

- **A — Combine:** one workflow, a `verify` gate with a `bump` job (PR) and a `release` job
  (push/dispatch), both `needs: verify`. Per-job `permissions` and per-job `concurrency`, not a
  reusable/composite-action split.
- **B criteria — unchanged:** conventional-commit prefixes. The bump algorithm in
  [`bump-version.mjs`](../../scripts/bump-version.mjs) is not changed; only a new write mode is added.
- **B write — auto-commit to the PR branch:** a PR-triggered job computes the bump and commits
  `plugin.json` onto the PR's own head branch, never `main`.
- **Token — plain `GITHUB_TOKEN`**, no PAT/App token. Branch protection on `main` has no required
  status checks (`required_status_checks: null`, `required_approving_review_count: 0`,
  `enforce_admins: false`), so a bump commit that does not re-trigger `verify` cannot block merge —
  and `GITHUB_TOKEN`'s non-re-triggering property *prevents* an auto-commit → `synchronize` →
  auto-commit loop for free (a PAT would reintroduce it).

## What was built

| File | Action | State |
|---|---|---|
| [`scripts/bump-version.mjs`](../../scripts/bump-version.mjs) | added the `--pr` write mode; header doc updated | default/`--dry-run`/`--set`/`--check`/`--advise` paths **untouched** |
| [`tests/bump-version.test.ts`](../../tests/bump-version.test.ts) | added `--pr` idempotency + `writePluginVersion` byte-safety cases (import now includes `writePluginVersion`) | +5 tests |
| [`.github/workflows/ci-release.yml`](../../.github/workflows/ci-release.yml) | new combined workflow: `verify` → `bump` (PR) / `release` (push, dispatch) | done |
| `.github/workflows/ci.yml` | deleted (folded into the combined file) | removed |
| `.github/workflows/release.yml` | deleted (folded into the combined file) | removed |
| [`README.md`](../../README.md) | current-state prose repointed to `ci-release.yml`; repo-tree line collapsed to one workflow | done |
| `docs/**` (roadmap, PLUGIN-PRD, five slice docs) | 33 dead links to the two deleted workflows repointed to `ci-release.yml` (**target only** — historical wording preserved) | done |

`scripts/pack-mcpb.mjs` and the `package.json` script names are **unchanged** — the workflow calls
them exactly as before. `src/` is untouched, so `dist/` needs no rebuild-commit (verified clean).

## The one code change — `--pr` (idempotent PR write)

`--pr` mirrors `--advise`'s computation but writes: base is the **newest tag** (not `plugin.json`'s
current value), range `<newest v* tag>..HEAD`, bump by `classifyBump`, `expected =
nextVersion(base, bump)`. Then:

- `expected === null` (no releasable commit) → log, exit 0, **write nothing**.
- `readPluginVersion() === expected` → log "already at", exit 0, **write nothing** (the idempotent
  no-op — this is what makes a per-push job safe).
- else → `writePluginVersion` (the existing byte-preserving replacement-*function* writer) and write;
  the workflow decides whether to commit via `git status --porcelain`.

**Why the tag base, not `plugin.json`:** the default author path uses `base = plugin.json ?? newestTag`,
correct for a once-per-cycle run. A per-push job using that base would read `base = 0.4.0` after the
bump commit lands and compute `0.5.0` — a double-bump. Basing on the tag (which does not move as the
commit lands) makes re-runs recompute the **same** number. Because `--pr` and `--advise` share this
computation, the advisory warning and the auto-commit can never disagree.

### Local verification of `--pr`

| Case | Range | Result |
|---|---|---|
| A — empty range (HEAD == `v0.3.0`) | *(none)* | "no releasable commit … nothing to write", exit 0, `plugin.json` unchanged |
| B — one `feat:` in range | `feat: …` | wrote `0.4.0` (minor) from base `0.3.0`/`v0.3.0`, exit 0 |
| B re-run (idempotent) | same | "already at 0.4.0 … no write, no commit", exit 0, `git status` shows `plugin.json` modified **once** |
| C — docs-only range | `docs: …` | "no releasable commit … nothing to write", exit 0, `plugin.json` unchanged |

(Exercised with throwaway `--allow-empty` commits, then reset; working tree restored to `9b216bc`.)

## The combined workflow — `ci-release.yml`

Workflow default `permissions: contents: read`. Triggers: `pull_request` + `push: branches: [main]`
+ `workflow_dispatch`. Three jobs:

- **`verify`** — the pre-flight lifted verbatim from the old `ci.yml` (checkout → setup-node →
  `npm ci` → `lint:docs` → `typecheck` → `test` → rebuild-and-gate `dist/` → PR-only `--advise`).
  Inherits `contents: read`. Concurrency
  `group: verify-${{ github.event_name == 'pull_request' && github.ref || github.run_id }}`,
  `cancel-in-progress: true` — cancels superseded **PR** runs but never cancels on `main`/dispatch
  (the `run_id` key makes the group unique there). **Mandatory:** without it, a second merge would
  cancel the first's `verify` and, via `needs`, silently drop its release.
- **`bump`** — `if: pull_request` **and** same-repo (`head.repo.full_name == github.repository`);
  `needs: verify`; job-scoped `permissions: contents: write`. Checks out the PR head branch, `npm ci`,
  runs `--pr`, and commits+pushes `plugin.json` to `github.head_ref` via `GITHUB_TOKEN` **only** when
  `git status --porcelain -- .claude-plugin/plugin.json` is non-empty. Subject
  `chore(release): set plugin version <v>` (a `chore:`, so it never contributes to a future bump).
  On a fork PR the token is read-only, so the same-repo guard **skips** the job (the `--advise`
  warning still fires) rather than failing on a rejected push.
- **`release`** — `if: != pull_request`; `needs: verify`; job-scoped `contents: write`; concurrency
  `group: release-main`, `cancel-in-progress: false`. Lifted from the old `release.yml` body:
  rebuild-and-prove `dist/` → `--check` → tag → `pack:mcpb` → `upload-artifact` → `gh release
  create`, with tag/publish gated on `github.event_name == 'push'`. It does **not** repeat
  lint/typecheck/test — `needs: verify` already ran them on this commit.

Behavior per trigger: `pull_request` → `verify` then `bump`; `push: main` → `verify` then `release`;
`workflow_dispatch` → `verify` then `release` as a rehearsal (empty `MANABASE_BUNDLE_VERSION`, dev
bundle, no tag, no Release).

### Local verification of the workflow

- Parses as YAML (`yaml` package). Structure confirmed programmatically: workflow `permissions:
  contents: read`; `verify` inherits read; `bump` and `release` each declare their own
  `contents: write`; the three `if`/`needs`/`concurrency` values are exactly as above.
- No `npm run acceptance` under any trigger (the only occurrence is the comment forbidding it).

## Binding constraints — all preserved

1. **No push to `main`, no `v*` tag trigger.** `release` is read-only (`--check`) + tag-only; `bump`
   writes only to the PR's feature branch. (GH006 / [Slice 18](./TrackC-Slice18.md) precedent.)
2. **`dist/` gate is `git status --porcelain -- dist/`**, ahead of every publishing step;
   `release` also `needs: verify`.
3. **No `npm run acceptance`** in any workflow.
4. **Single tag producer**; `workflow_dispatch` kept as the rehearsal/recovery path; the three spent
   tags (`v0.1.0`/`v0.1.1`/`v0.2.0`, and now `v0.3.0`) are never moved.
5. **`contents: write` only on `bump`/`release`**; `verify` is provably read-only.
6. **`cancel-in-progress: false`** on `release-main`.
7. **Byte-identity (PC-03 crit 7) stays inside `pack-mcpb.mjs`** — the workflow calls
   `npm run pack:mcpb`.
8. **P-08 executed, not amended.**

## Known edges (accepted, documented — not blocking)

- **Multi-open-PR version collision:** two PRs off the same tag both compute the same next version;
  the first merges/tags, the second still carries it → at merge `--check` sees it already tagged →
  **silent no-release**. Resolution: push to the second PR (re-runs `bump`, recomputes from the now-
  newer tag). Rare for a single maintainer.
- **The bump commit is not re-verified:** the `GITHUB_TOKEN` push does not re-trigger `verify`, so
  the PR's checks reflect the pre-bump commit. Harmless — the bump touches only `plugin.json`
  (nothing `verify` inspects) and there are no required status checks; the merge-time `--check` is
  the authority.
- **Write-scoped job on the PR path** (`bump`) widens the PR path's token slightly. Mitigated by
  job-scoping the write (the workflow default stays read) and the same-repo guard; **not**
  `pull_request_target` (which would run the base branch's script, not the PR's).

## Local check suite (this pass)

| Check | Result |
|---|---|
| `npm run typecheck` | clean |
| `npm test` | **330/330**, 79 suites (was 325/77 — the five new `--pr`/writer cases) |
| `npm run build` + `dist/` gate | `dist/` clean (no `src/` change) |
| `npm run lint:docs` | 37 files, 4731 links, **0 broken** (after repointing the 35 workflow links) |

## Author-TODO — live behavior to confirm on the first PR/merge

1. Open a PR with a `feat:`/`fix:` commit and no manual bump → `verify` passes, then `bump` commits
   `plugin.json` onto the PR branch; a docs-only PR → `bump` makes no commit.
2. Merge a releasable PR → the single run gates then tags `v<next>`, packs, publishes; the released
   `server/index.js` sha256-matches the committed `dist/index.js`. Merge a docs-only PR → green, no
   tag/Release/bundle.
3. `workflow_dispatch` rehearsal → `verify` then `release` produce a dev bundle, no tag, no Release.
4. Confirm the concurrency behavior: a superseding PR push cancels the old `verify`; two close merges
   to `main` each keep their own `verify` and serialize through `release-main`.
5. `claude plugin validate . --strict` after this lands — `plugin.json` already carries a `version`
   (`0.3.0`), so the one [P-08](../PLUGIN-PRD.md#p-08--version-scheme) warning should be gone; that
   pass is [PC-02](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) criterion 9's evidence (still open).
