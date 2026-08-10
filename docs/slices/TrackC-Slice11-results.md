# Track C — Slice 11 results: the `dist/` honesty mechanism

Date: **2026-08-09**. Spec: [`TrackC-Slice11.md`](./TrackC-Slice11.md). Landed as **PR #32**
(merge `6c45b2c`, commit `9a103ac`). The deliberate-failure demonstration ran on **PR #33**, which
was closed unmerged and its branch deleted.

**Outcome.** `.github/workflows/ci.yml` runs on every pull request and every push to `main`:
`npm ci` → `npm run typecheck` → `npm test` → rebuild `dist/` and fail on a non-empty
`git status --porcelain -- dist/`. It has been observed **failing** on a deliberately stale
`dist/` and then going **green** on the rebuild, on the same branch and the same workflow.
[`PQ-06`](../PLUGIN-PRD.md#pq-06--what-keeps-the-committed-dist-honest)'s commit half is answered;
its user-facing half stays open and CI cannot close it.

Acceptance criteria 1–7 are verified below. Criteria 8, 9 and 10 are the document edits this file
accompanies.

## How this was run

Windows 11 dev machine, `core.autocrlf=true`, no `.gitattributes` before this slice. Local Node
**v22.17.1**, npm 11.12.1. `gh` 2.97.0 authed as `njohnb` with the `workflow` scope. Runner:
`ubuntu-latest`, Node from `.nvmrc` (**22**).

Every figure below is measured on the day. Where the spec quoted a number, the spec's figure and
the measured one are both given.

## Conditions block

| | |
|---|---|
| Branch that landed | `chore/slice11-ci-dist-honesty` → PR #32 → `main` |
| Demo branch | `chore/ci-dist-check-demo` → PR #33, closed unmerged, deleted |
| `dist/index.js`, committed blob | `1f06b68d26a8ae124c889ea380b822d313a48433` |
| `dist/index.js`, on disk after build | **557,298 bytes**, **15,797 lines**, pure LF |
| `dist/index.js`, on disk before `.gitattributes` | 573,095 bytes (same 15,797 lines, CRLF) |
| esbuild reported size | 544.2 kb |
| Local test counts | **21 suites, 73 tests, 73 pass, 0 fail** |
| CI test counts | **21 suites, 73 tests, 73 pass, 0 fail** — identical |

The spec's interface-contract figures (573,094 bytes / 15,798 lines) are off by one in each
direction against the tree as measured; the byte figure is also a CRLF measurement, and the file
is 557,298 bytes once `.gitattributes` pins it to LF. Neither difference is drift — the committed
blob was already LF and its hash did not change.

## Measurement 1 — the spec's premises, checked before building on them

Three of the spec's stated premises were false by the time it ran. All three are recorded because
each would have produced a wrong action.

**`.github/` already existed.** The spec calls `ci.yml` "the repo's **first** CI workflow… no
`.github/` directory, no existing job, no convention to match and none to inherit." That was true
when it was written and stopped being true with the unplanned MCPB work on 2026-08-04:
`.github/workflows/release.yml` has been present since. `ci.yml` is still new; the
no-convention-to-inherit claim is not, and `release.yml` is what supplied the in-repo action-pin
precedent that turned out to need checking (measurement 2).

**Requirement 9 was already satisfied — do not "fix" it.** The spec's most detailed requirement
asks for the test glob to be quoted, from `node --test tests/**/*.test.ts` to a quoted form,
because POSIX `sh` without `globstar` degrades `**` to `*` and silently drops a suite. The script
already reads:

```
"test": "node --experimental-strip-types --test \"tests/**/*.test.ts\""
```

`package.json` was **not** modified by this slice; its row in the spec's deliverables table is a
no-op. The hazard is real and still reproducible — raw `sh` sees four of six files:

```
$ sh -c 'for f in tests/**/*.test.ts; do echo "$f"; done'
tests/scryfall/client.test.ts
tests/scryfall/prices.test.ts
tests/tools/card-search.test.ts
tests/tools/register.test.ts
```

`tests/config.test.ts` and `tests/skills.test.ts` are missing from that expansion. Because the
glob is quoted, `sh` passes the literal pattern through and Node expands it, so nothing is lost —
confirmed by criterion 5 below, where CI and Windows report identical counts. The spec's "all five
suites" is also stale; there are six test files.

**The spec's test counts are stale.** Criterion 5 names "19 suites, 67 tests as of 2026-08-04".
Measured today, locally and in CI: **21 suites, 73 tests**. The criterion is satisfied by the two
figures *matching each other*, which they do, not by matching the spec's.

## Measurement 2 — the action pins the spec told us not to copy

The spec says: "Do not copy an action version from this document. Look up the current major…
A version guessed from a spec is a version that was already wrong when the spec was written." That
instruction earned itself.

```
$ gh api repos/actions/checkout/releases/latest --jq .tag_name    -> v7.0.1
$ gh api repos/actions/setup-node/releases/latest --jq .tag_name  -> v7.0.0
```

Both are at **v7**. The in-repo precedent — `release.yml`'s `@v4` — is two majors behind, so
"match the existing convention" would have been the wrong move here too. `ci.yml` pins `@v7` for
both and the green runs below confirm it works.

**`release.yml` still carries `@v4` and was deliberately left alone.** It has never executed (no
tag has been pushed), so bumping it would be an unverified change to an unverified workflow, and
it is outside this slice's two agreed one-line fixes. It belongs to
[Slice 13](./TrackC-Slice13.md), which owns the release gate and will be the first thing to run
that file.

## Measurement 3 — `.gitattributes`, and what the local false positive actually is

The spec's requirement 5 predicts the false positive this check "dies of" and attributes it to
line endings: the working tree is CRLF, esbuild emits LF, so a non-git-aware comparison reports a
mismatch that has nothing to do with `src/`.
[`PQ-06`](../PLUGIN-PRD.md#pq-06--what-keeps-the-committed-dist-honest)'s 2026-08-07 entry says the
same, calling it "the local CRLF false alarm… a working-tree artifact of `core.autocrlf=true`."

`.gitattributes` was added exactly as specified — one path, one rule, three comment lines. Then
`npm run build`. **The false positive did not go away.**

```
$ git status --porcelain -- dist/
 M dist/index.js

$ git --no-pager diff --stat -- dist/          # nothing at all
$ git diff --exit-code -- dist/ && echo CLEAN  # CLEAN
```

Diagnosis:

```
$ git ls-files --eol dist/index.js
i/lf    w/lf    attr/text eol=lf        dist/index.js

$ git hash-object dist/index.js
1f06b68d26a8ae124c889ea380b822d313a48433
$ git ls-files -s dist/index.js
100644 1f06b68d26a8ae124c889ea380b822d313a48433 0    dist/index.js
```

**The working-tree file hashes identically to the index blob.** Index and worktree are both LF,
the attribute is applied, the content is the same object. There is no line-ending disagreement and
no content difference. `git status` reports ` M` from a **stale stat cache** — `diff-files` emits
an all-zero destination hash, which is git saying "the stat data changed, I have not compared the
content."

It is stubborn. `git update-index -q --really-refresh` exits 0 and does **not** clear it. What
clears it is:

```
$ git add --renormalize dist/index.js   # stages nothing; content is identical
$ git status --porcelain -- dist/       # empty
```

Three consequences worth carrying forward:

1. **The recorded cause was wrong; the recorded conclusion was right.** `PQ-06` reasoned that the
   alarm "does not reach a Linux runner that checks out LF," and three green runs on healthy trees
   confirm the runner does not reproduce it — but not for the stated reason. It is a stat cache,
   not CRLF.
2. **`.gitattributes` is still correct and still worth having**, just not for this. It replaces
   git's content heuristic (`dist/index.js` is classified text because it contains no NUL bytes)
   with a declaration, so a future bundle carrying a NUL byte cannot silently flip the path to
   binary and break the check in a way nobody would connect to line endings.
3. **The spec's local dry-run needs one extra line on Windows.** `git add --renormalize
   dist/index.js` before `git status --porcelain -- dist/`, or the healthy tree reads dirty. This
   does not change the workflow: CI is the authority, and adding a renormalize step there would be
   defending against a condition the runner does not have.

Criterion 6 holds: the `.gitattributes` commit renormalized no other file. PR #32's diff is
`.gitattributes` (4 lines), `ci.yml` (67), `release.yml` (13 changed), `.nvmrc` (1) — **81
insertions, 4 deletions, and `dist/index.js` untouched.**

## Measurement 4 — the gate proven locally, then in CI

Locally, from a clean tree, exactly as CI runs it:

```
npm ci && npm run typecheck && npm test && npm run build
git status --porcelain -- dist/     # empty
```

Then the teeth, editing a string literal in `src/config.ts`:

```
# src/ changed, dist/ NOT rebuilt
git status --porcelain -- dist/     # empty — dist is stale, which is the point
npm run build
git status --porcelain -- dist/     #  M dist/index.js
git --no-pager diff --stat -- dist/ #  dist/index.js | 2 +-
```

**A trap found while doing this: never use `sed -i` on this tree.** A first attempt at the local
edit used `sed -i` and matched nothing, yet left `src/config.ts` reporting modified. It had
rewritten the whole file to LF. `git diff` showed only
`warning: in the working copy of 'src/config.ts', LF will be replaced by CRLF the next time Git
touches it` and no content change. This is the same class as the scripted-`String.replace` hazard
`CLAUDE.md` already records for the markdown files: a silent whole-file rewrite that does not read
as corruption. Use the editor, not stream tools.

**CI, PR #32:** <https://github.com/njohnb/Manabase/actions/runs/31320763973> — success, all steps
in the specified order:

```
4. Run npm ci                                    -> success
5. Run npm run typecheck                         -> success
6. Run npm test                                  -> success
7. Rebuild dist/ and verify it matches src/      -> success
```

**CI, `push: main` after merge:**
<https://github.com/njohnb/Manabase/actions/runs/31320814188> — success. Criterion 1 satisfied.

CI's `npm test` output: `# suites 21`, `# tests 73`, `# pass 73`, `# fail 0` — identical to the
Windows run. Criterion 5 satisfied; the shell ate nothing.

## Measurement 5 — the deliberate failure, and the first attempt that proved nothing

Requirement 14, on throwaway branch `chore/ci-dist-check-demo`, PR #33.

### Attempt 1 — failed, but not at the gate

The spec suggests "changing a string literal in `src/config.ts` is enough." It changes the bundle,
but `tests/config.test.ts` asserts the `User-Agent` string it builds. Run
<https://github.com/njohnb/Manabase/actions/runs/31320874800>:

```
5. Run npm run typecheck                      -> success
6. Run npm test                               -> failure     (# pass 72, # fail 1)
7. Rebuild dist/ and verify it matches src/   -> skipped
```

The run went red, and **the gate never executed**. That is requirement 10's ordering working
exactly as designed — a broken `src/` reports as a failing test rather than as "dist is stale" —
but a red run at the wrong step is not evidence about the gate. Recorded because anyone repeating
this exercise from the spec's suggested edit will hit it: **the breakage must be in a module no
test covers.**

### Attempt 2 — the gate, observed failing

The demo edits `src/index.ts` instead (the MCP server name, `manabase-mtg` →
`manabase-mtg-SLICE11-DEMO`). No test imports `src/index.ts`. Verified locally before pushing:
typecheck clean, 73/73 pass, and the edit changes `dist/index.js` by one line. Committed with
`dist/` deliberately not rebuilt.

Run <https://github.com/njohnb/Manabase/actions/runs/31320956406> — **failure**, at the right step:

```
5. Run npm run typecheck                      -> success
6. Run npm test                               -> success
7. Rebuild dist/ and verify it matches src/   -> failure
```

Annotation, verbatim:

```
level: failure
title:   dist/ is stale
message: dist/ does not match src/ — run 'npm run build' and commit dist/index.js
```

Step output, verbatim, in requirement 13's specified order — annotation, then `--stat`, then
porcelain:

```
  dist/index.js  544.2kb
⚡ Done in 41ms
##[error]dist/ does not match src/ — run 'npm run build' and commit dist/index.js
 dist/index.js | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
 M dist/index.js
##[error]Process completed with exit code 1.
```

Criterion 2 satisfied.

### Attempt 2, fixed — the same workflow goes green

`npm run build`, commit the rebuilt `dist/index.js` to the same branch. Run
<https://github.com/njohnb/Manabase/actions/runs/31321009612> — **success**. Same workflow, same
branch, same job; the only change is the rebuild. Criterion 3 satisfied: the check discriminates
rather than merely failing.

PR #33 was closed unmerged and the branch deleted locally and on the remote. `grep -rn
"SLICE11\|DEMO" src/` returns nothing on `main`. Criterion 4 satisfied.

## Measurement 6 — the comparison, and why it is not the one that was decided

[`PQ-06`](../PLUGIN-PRD.md#pq-06--what-keeps-the-committed-dist-honest)'s 2026-08-07 entry, the
[roadmap](../DEV-ROADMAP.md#4-phase-1-slices) block, and `release.yml` all name
`git diff --exit-code -- dist/`. The check shipped uses `git status --porcelain -- dist/`, per the
spec's requirement 8, and the difference matters:

- **Modified** — both catch it.
- **Absent from the commit** — the rebuild recreates `dist/index.js` as an **untracked** file.
  `git diff` reports nothing at all and the gate passes. `git status --porcelain` reports `??`.
- **Deleted** — porcelain reports ` D`.

Absent-`dist/` is precisely the failure
[`P-09`](../PLUGIN-PRD.md#p-09--server-ships-as-committed-built-javascript) fears: a plugin whose
tools are simply absent, with no error anywhere. A gate that cannot see it is not the gate that
was wanted. `release.yml`'s own step was upgraded to the same form in the same commit, so the two
workflows no longer disagree about what "stale" means.

Hash comparison and stashing a copy aside were **not** used — both bypass git's normalization and
would reintroduce the class of false positive requirement 5 warns about. Note that
`git hash-object` (used above only as a diagnostic) *does* apply the clean filter and is not in
that class; `cmp` and `sha256sum` are.

## Measurement 7 — the corollary the spec asks to be stated

**A legitimate dependency bump changes `dist/index.js`, and the check will demand the rebuild in
the same commit as the lockfile change. That is correct behavior, not a bug to work around.**

`--bundle` inlines the dependency tree into the output, so the installed tree is a direct input to
the bytes. `package.json` declares caret ranges (`@modelcontextprotocol/sdk ^1.30.0`, `esbuild
^0.28.1`); `npm install` may resolve them upward and rewrite the lockfile, producing a bundle that
differs from the author's for reasons unrelated to `src/`. `npm ci` installs exactly
`package-lock.json` and fails loudly if it and `package.json` disagree. It is the single most
load-bearing line in the workflow.

## Criterion 7 — the live harness is not reachable from CI

```
$ git grep -n acceptance -- .github/     # no output
$ grep -nE "workflow_dispatch|schedule" .github/workflows/ci.yml   # no output
```

`npm run acceptance` appears nowhere under `.github/`, and `ci.yml` has no `workflow_dispatch`, no
`schedule`, and no label-gated path. `release.yml` retains its own `workflow_dispatch` — it packs
and releases a bundle and does not call the harness, so criterion 7's prohibition is not engaged
by it.

`claude plugin validate . --strict` stays a local pre-push step (requirement 12). Run before the
push, it fails on exactly one warning — `plugin.json` has no `version`, which is
[`P-08`](../PLUGIN-PRD.md#p-08--version-scheme)'s deliberate unset value and
[Slice 13](./TrackC-Slice13.md)'s to settle. Unchanged by this slice.

## `PQ-06` verdict

**The commit half is answered. The user-facing half is not, and CI cannot answer it.**

The mechanism is a CI rebuild-and-diff, chosen over the two alternatives the question lists:

- **A pre-commit hook was not chosen.** Git does not distribute hooks, so a fresh clone, a second
  machine, a `--no-verify`, or a contributor who never ran an install step gets no protection at
  all — and the gap is silent. It also runs a full bundle on every commit, which is what makes
  `--no-verify` attractive.
- **Folding the build into `claude plugin tag` was not chosen.** It checks at release time only,
  and [`P-08`](../PLUGIN-PRD.md#p-08--version-scheme) leaves `plugin.json` `version` unset during
  development, so every commit is an update the moment a friend has the plugin installed. Drift
  ships continuously, not at tags. It is not incompatible with this slice and may be added at
  [Slice 13](./TrackC-Slice13.md); it is not a substitute.

No new `P-` decision was minted. This is an implementation choice recorded in
[`PLUGIN-PRD.md`](../PLUGIN-PRD.md) [§7](../PLUGIN-PRD.md#7-open-questions) because
[`P-09`](../PLUGIN-PRD.md#p-09--server-ships-as-committed-built-javascript) created the risk;
§2 is locked and a CI file is not a decision.

**What stays open.** A released `.mcpb` carries whatever `dist/` it was packed with until someone
reinstalls, because Desktop has no update path. CI can guarantee that what was packed matched
`src/` at pack time and says nothing about what a user is running today. The release gate has
still never executed against a real tag.

## Scope narrowed, with the author

[`DEV-ROADMAP.md`](../DEV-ROADMAP.md)'s Slice 11 block predates both
[`PQ-06`](../PLUGIN-PRD.md#pq-06--what-keeps-the-committed-dist-honest)'s 2026-08-07 narrowing and
[the slice spec](./TrackC-Slice11.md)'s out-of-scope list, and demanded four further things. All
four are **deferred, not dropped**, and the roadmap block now records this:

| Deferred item | Now owned by |
|---|---|
| `scripts/check-doc-links.mjs` / `npm run lint:docs` | **Unscheduled** — its own decision. **Landed 2026-08-10**, PR #36 — see below |
| Packed `.mcpb` byte-identity vs the committed `dist/` | [Slice 13](./TrackC-Slice13.md) |
| Cutting the first `v*` release | [Slice 13](./TrackC-Slice13.md) |
| `README.md`'s Chat-tab download line | [Slice 12](./TrackC-Slice12.md) |

**Updated 2026-08-10 — the first row landed.** PR #36 (`e6b2279`) added
[`scripts/check-doc-links.mjs`](../../scripts/check-doc-links.mjs), the `npm run lint:docs` script,
and one step in [`ci.yml`](../../.github/workflows/ci.yml) between `npm ci` and the typecheck, with
the `dist/` gate still last. It is recorded as this slice's deferral and carries no slice number of
its own; nothing in this document is reopened by it, and the other three rows stand. The dated
record above is left as written.

## Findings for later slices

1. **The gate is `git status --porcelain`, not `git diff`.** Anything that re-derives this check —
   the pack step, a release gate — should use the same comparison, or it cannot see an absent
   `dist/`.
2. **The Windows local false positive is a stat cache, not CRLF**, and `.gitattributes` does not
   clear it. `git add --renormalize dist/index.js` does. Any local dry-run of the gate needs that
   line; CI does not.
3. **Never use `sed -i` (or any stream editor) on this tree.** It rewrites CRLF to LF silently and
   reports as a modified file with no content diff.
4. **A `src/` edit meant to break the bundle must be in a module no test covers** — `src/index.ts`
   works, `src/config.ts` does not. Otherwise `npm test` fails first and the gate never runs.
5. **`release.yml` is still pinned to `actions/checkout@v4` and `actions/setup-node@v4`** while
   `ci.yml` is on `@v7`. It has never run. [Slice 13](./TrackC-Slice13.md) should bump it as part
   of executing it for the first time.
6. **Action majors move faster than this repo's specs.** Look them up at write time; both the
   spec's implied version and the in-repo precedent were stale on the same day.
