# Track C — Slice 11: dist/ honesty mechanism

> Self-contained implementation spec. You do not need to read the PRDs to build this slice;
> everything binding is inlined. PRD references are pointers for deeper context only.

**Goal.** Make it impossible to land a commit whose `dist/index.js` does not match `src/`. The
committed bundle is what the plugin actually starts, and a stale or absent `dist/` produces a
plugin whose tools are simply **absent** — no error in `/mcp`, no stack trace, nothing in the
transcript. That is the least debuggable failure this project can ship, and it is the one
`PLUGIN-PRD.md` [P-09](../PLUGIN-PRD.md#p-09--server-ships-as-committed-built-javascript) knowingly created when it chose committed build output. This slice adds
the repo's first CI workflow to detect it on every path into `main`, and closes open question
[PQ-06](../PLUGIN-PRD.md#pq-06--what-keeps-the-committed-dist-honest) with the mechanism and the reasoning.

## Preconditions (deliverables of Slice 1)

Slice 11 depends on [Slice 1](./TrackA-Slice1.md) and nothing else — `DEV-ROADMAP.md` [§5](../DEV-ROADMAP.md#5-order-and-parallelism)'s graph has `S1 --> S11`.
[Slice 1](./TrackA-Slice1.md) is what produced a real build to check:

- `package.json` with the esbuild bundle script and a committed `package-lock.json`.
- `dist/index.js` built, committed, and deliberately not in `.gitignore`.
- `tsconfig.json` with `noEmit` — `tsc` typechecks, esbuild builds.

Track A being closed raises the stakes rather than changing the dependency. `dist/index.js` is
now 573 KB of real bundled output — the MCP SDK, `ajv`, the client, the price logic and the
handler are all inlined into it — rebuilt by hand across six merged PRs with nothing verifying
that any of those rebuilds actually happened. Every commit from here is an opportunity for the
drift, and the roadmap says so: Slice 11 is "now more urgent than when it was scheduled."

## Context

Manabase is a Magic: The Gathering MCP server (Scryfall-backed card search) that ships inside a
Claude Code plugin; `.mcp.json` starts it as `node ${CLAUDE_PLUGIN_ROOT}/dist/index.js` with no
install step, no package fetch, and no build on the user's machine. Track C is the measurement
and release track: 10 (context cost) · **11 (dist honesty)** · 12 (docs and friend dry-run) ·
13 (release gate). Slice 11 feeds [Slice 13](./TrackC-Slice13.md) and is otherwise independent — it can land now, in
parallel with Slices 7, 8, and 10.

This is the repo's **first** CI workflow. There is no `.github/` directory, no existing job, no
convention to match and none to inherit. Everything the workflow does is established here.

## Deliverables

| File | Action |
|---|---|
| `.github/workflows/ci.yml` | new — typecheck, unit tests, rebuild-and-diff `dist/` |
| `.gitattributes` | new — pin `dist/index.js` to LF; scoped to `dist/` only |
| `.nvmrc` | new — the one Node major CI and the author both build with |
| `package.json` | modify — quote the test glob (requirement 9; one line) |
| `docs/slices/TrackC-Slice11-results.md` | new — the recorded failing run and the recorded pass |
| [`docs/PLUGIN-PRD.md`](../PLUGIN-PRD.md) | modify — close [PQ-06](../PLUGIN-PRD.md#pq-06--what-keeps-the-committed-dist-honest) in [§7](../PLUGIN-PRD.md#7-open-questions); append one [§9](../PLUGIN-PRD.md#9-revision-log) revision-log row |
| [`docs/DEV-ROADMAP.md`](../DEV-ROADMAP.md) | modify — retire standing rule 5; flip Slice 11 to ☑ |

No file under `src/`, `tests/`, or `dist/` changes as part of this slice. If `dist/index.js`
turns out to be stale on the first green run, that is a finding: rebuild and commit it in its
own commit, and say so in the results document.

## Requirements

1. **State the failure the check exists to prevent, in the workflow itself.** Put a comment at
   the top of `ci.yml` naming it: a stale or absent `dist/index.js` makes the plugin's tools
   *absent* with no error anywhere — the harness reports nothing, `/mcp` shows nothing useful,
   and the first symptom is a user saying the plugin "doesn't do anything." Someone reading the
   workflow in six months needs to know why it is worth the minutes.

2. **The mechanism is a CI rebuild-and-diff, and that decision closes [PQ-06](../PLUGIN-PRD.md#pq-06--what-keeps-the-committed-dist-honest).** PQ-06 offers
   three candidates: a CI check that rebuilds and diffs, a pre-commit hook, or folding the
   build into the `claude plugin tag` release step. Adopt CI, and record the reasoning — a
   closed open question needs its rationale, not just its verdict:
   - **CI catches every path.** It runs on the author's PRs, on a direct push to `main`, and on
     a PR from a friend's fork — the case [P-11](../PLUGIN-PRD.md#p-11--the-repo-is-its-own-marketplace)'s `owner/repo` marketplace makes reachable. It
     depends on no local setup on any contributor's machine.
   - **A pre-commit hook was not chosen** because it is per-clone state. Git does not
     distribute hooks; a fresh clone, a second machine, a `--no-verify`, or any contributor who
     never ran the install step gets no protection at all, and the gap is silent. It also runs
     a full bundle on every commit, which makes `--no-verify` attractive.
   - **Folding the build into `claude plugin tag` was not chosen** because it checks at release
     time only. [P-08](../PLUGIN-PRD.md#p-08--version-scheme) leaves `plugin.json` `version` unset during development, so every commit
     is an update the moment a friend has the plugin installed (the SHA fallback). Drift is
     shipped continuously, not at tags — a release-time gate is the right idea aimed at the
     wrong moment. It is not incompatible with this slice and may be added at [Slice 13](./TrackC-Slice13.md); it is
     not a substitute.
   - [PQ-06](../PLUGIN-PRD.md#pq-06--what-keeps-the-committed-dist-honest) is an **implementation** decision that [§7](../PLUGIN-PRD.md#7-open-questions) records because [P-09](../PLUGIN-PRD.md#p-09--server-ships-as-committed-built-javascript) created the risk. Do
     **not** mint a new `P-` decision for it. §2 is locked; adding P-14 for a CI file would be
     a duplication, not a decision.

3. **Workflow shape.** One workflow, one job, four steps. Minimal and correct:

   ```yaml
   name: CI

   on:
     push:
       branches: [main]
     pull_request:

   permissions:
     contents: read

   concurrency:
     group: ${{ github.workflow }}-${{ github.ref }}
     cancel-in-progress: true

   jobs:
     verify:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@<pin the current major>
         - uses: actions/setup-node@<pin the current major>
           with:
             node-version-file: .nvmrc
             cache: npm
         - run: npm ci
         - run: npm run typecheck
         - run: npm test
         - name: Rebuild dist/ and verify it matches src/
           run: |
             npm run build
             if [ -n "$(git status --porcelain -- dist/)" ]; then
               echo "::error title=dist/ is stale::dist/ does not match src/ — run 'npm run build' and commit dist/index.js"
               git --no-pager diff --stat -- dist/
               git status --porcelain -- dist/
               exit 1
             fi
   ```

   **Do not copy an action version from this document.** Look up the current major for
   `actions/checkout` and `actions/setup-node` when you write the file and pin that; pinning to
   a commit SHA is stricter and also fine. A version guessed from a spec is a version that was
   already wrong when the spec was written.

4. **Triggers: `push` to `main` plus every `pull_request`.** Together those cover every path
   into `main` exactly once — a PR runs on its head, and the merge runs again on `main` as the
   last line of defense if a PR was ever merged around the check. `on: push` with no branch
   filter also works and gives feedback before a PR exists, at the cost of double-running every
   same-repo PR; that trade is the only reason to change this.
   - A `pull_request` from a fork **does** run, with a read-only `GITHUB_TOKEN` and no access
     to secrets. This check needs neither — it reads the repo, runs `npm ci`, and compares
     files. That is precisely why the recommendation was made for the friend's-PR case.
   - Repository settings may require a maintainer to approve the first run from a new
     contributor. That is a repo setting, not something the workflow controls; do not try to
     work around it, and do not use `pull_request_target` to avoid it — that trigger runs with
     the base repository's permissions against the fork's code, which is a privilege
     escalation, not a convenience.
   - Keep `permissions: contents: read` at the workflow level. The job writes nothing back.

5. **Line endings are the false-positive this check dies of, and they must be pinned.** This is
   a Windows dev machine with `core.autocrlf=true` and no `.gitattributes`: the working tree is
   CRLF while git blobs are LF. Measured on the current tree, `dist/index.js` is **100% CRLF**
   (15,797 CRLF pairs, zero lone CR, zero lone LF) while esbuild always emits LF. A comparison
   that is not git-aware — `cmp`, `sha256sum`, `diff` against a saved copy — therefore reports
   a mismatch on a CRLF checkout that has nothing to do with `src/`, and a check that
   false-positives once gets disabled.
   - Add `.gitattributes` at the repo root with a single scoped rule and a comment saying why:

     ```gitattributes
     # The committed bundle is compared byte-for-byte by CI (docs/slices/TrackC-Slice11.md).
     # Pin it to LF so a CRLF working tree on Windows can never disagree with a Linux runner.
     # Deliberately scoped to dist/ — see that document, requirement 5, before widening this.
     dist/index.js text eol=lf
     ```
   - **Adding `.gitattributes` at all has repo-wide consequences the implementer must consider
     before adding it.** Today git classifies `dist/index.js` as text by a *content heuristic*
     (it contains no NUL bytes — verified) and normalizes it accordingly; that heuristic is not
     a guarantee, and a future bundle carrying a NUL byte would flip it to binary and break the
     check in a way nobody would connect to line endings. The rule above replaces the heuristic
     with a declaration for that one path. What it must **not** do is grow: adding `* text=auto`
     or any `*.md` rule renormalizes every tracked text file in one commit, and the docs are
     CRLF in the working tree — the whole-tree diff that would produce is the exact noise the
     environment note in `CLAUDE.md` warns about. One line, one path, this commit.
   - After adding the file, run `npm run build` once. esbuild writes LF, the working tree and
     the blob then agree on every platform, and the blob itself does not change (it was already
     LF). No `git add --renormalize` of anything outside `dist/` is part of this slice.

6. **`npm ci`, never `npm install`.** The bundle inlines its dependencies — 174 `node_modules`
   references and the whole of `ajv` and the MCP SDK are in the output — so the installed
   dependency tree is a direct input to the bytes. `package.json` declares caret ranges
   (`@modelcontextprotocol/sdk ^1.30.0`, `esbuild ^0.28.1`); `npm install` may resolve them
   upward and rewrite the lockfile, producing a bundle that differs from the author's for
   reasons that have nothing to do with `src/`. `npm ci` installs exactly `package-lock.json`
   (lockfileVersion 3, esbuild pinned at 0.28.1, SDK at 1.30.0) and fails loudly if the lockfile
   and `package.json` disagree. It is the single most load-bearing line in the workflow.
   - **Corollary, and state it in the results document:** a legitimate dependency bump changes
     `dist/index.js`. The check will demand the rebuild in the same commit as the lockfile
     change. That is correct behavior, not a bug to work around.

7. **Pin Node in one place and let CI be the authority.** Create `.nvmrc` containing the major
   version the author actually builds with; the workflow reads it via
   `node-version-file: .nvmrc`, and the author can point `nvm`/`fnm` at the same file. One
   number, one file, no drift.
   - Be precise about what the pin buys. **The Node version does not determine the bundle's
     bytes** — esbuild is a native Go binary and Node only launches its CLI wrapper. The pin
     exists because `npm test` runs the `.ts` test files directly through `node --test`, which
     needs a Node with native TypeScript type-stripping (the [Slice 1](./TrackA-Slice1.md) spec fixes that floor at
     Node ≥23), and because a toolchain version that drifts under the author is how
     "works on my machine" begins.
   - `package.json` `engines.node: ">=18"` and the build's `--target=node18` describe the
     **shipped bundle's** runtime and syntax level. Neither is the toolchain version. Do not
     set CI to Node 18 by reading them.

8. **The comparison is `git status --porcelain -- dist/`, not `git diff`.** After the rebuild,
   any non-empty output fails the step. `git diff --exit-code` alone is not sufficient: if
   `dist/index.js` were *absent* from the commit, the rebuild recreates it as an untracked file
   and `git diff` reports nothing at all — and absent-`dist` is the exact failure [P-09](../PLUGIN-PRD.md#p-09--server-ships-as-committed-built-javascript) fears,
   the one that yields a plugin with no tools and no error. `git status --porcelain` catches
   the modified case (` M`), the deleted case, and the untracked case (`??`) with one
   invocation. Use `git diff --stat -- dist/` only to *show* the damage, never to decide.
   - Do not compare hashes and do not stash a copy aside. Both bypass git's normalization and
     reintroduce requirement 5's false positive.
   - `actions/checkout`'s default shallow fetch is fine — the comparison is working tree against
     the index, not against history.

9. **Fix the test glob before wiring tests into CI; a Linux shell silently drops a suite.** The
   current script is `node --test tests/**/*.test.ts`. On Windows, npm runs scripts through
   `cmd.exe`, which does not glob, so Node receives the literal pattern and expands it itself —
   all five suites run. On Linux, npm runs scripts through `sh`, which has no `globstar`, so
   `**` degrades to `*` and the shell expands the pattern to `tests/*/*.test.ts` **before** Node
   sees it. Verified on this tree:

   ```
   $ sh -c 'for f in tests/**/*.test.ts; do echo "$f"; done'
   tests/scryfall/client.test.ts
   tests/scryfall/prices.test.ts
   tests/tools/card-search.test.ts
   tests/tools/register.test.ts
   ```

   `tests/config.test.ts` is missing. A CI job that runs `npm test` unchanged would report green
   while never executing the config suite — a check that lies is worse than no check. Quote the
   pattern so it reaches Node: `"test": "node --test \"tests/**/*.test.ts\""`. If quoting
   misbehaves on any platform, fall back to `node --test tests/`, which is what the [Slice 1](./TrackA-Slice1.md) spec
   originally specified and which discovers `*.test.ts` recursively. Confirm the fix by
   comparing suite and test counts (see acceptance criterion 5).

10. **Run typecheck and unit tests here too, in that order, with the `dist/` gate last.** This
    is the repo's only workflow and the natural home for both; they are fast, hermetic, and
    catch what the diff cannot. Ordering matters for legibility: a broken `src/` should report
    as a type error or a failing test, not as "dist is stale," which it would also technically
    be. Gate last.

11. **`npm run acceptance` must never run in CI. This is the one thing a well-meaning
    implementer would add.** It hits live Scryfall. `MCP-PRD.md` [§3.4](../MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance) makes rate limits a hard
    constraint: a 429 locks access for ~30 seconds and sustained overage risks Scryfall banning
    the application **for every user of it**, not just the runner. The harness is deliberately
    slow (≥600 ms between calls) and is meant to be run by a human, once, deliberately — the
    [Slice 6](./TrackA-Slice6.md) spec already rules out CI-wiring it in its own out-of-scope list. It stays a local
    `npm run acceptance`. Do not add it behind a `workflow_dispatch`, a schedule, or a label.

12. **`claude plugin validate . --strict` stays a local pre-push step.** It needs Claude Code on
    the machine, which a runner does not have and which this slice is not going to install.
    Roadmap standing rule 7 already binds it; leave it there and do not weaken it by implying
    CI covers it.

13. **The failure must be legible without reading the workflow.** On a mismatch the run must
    emit, in this order: the `::error title=dist/ is stale::` annotation carrying the literal
    remedy `run 'npm run build' and commit dist/index.js`, then `git diff --stat -- dist/` so
    the size of the drift is visible, then the porcelain status so an untracked or deleted file
    is named explicitly. A bare non-zero exit is not acceptable — the annotation is what appears
    in the PR's checks summary, and it is the only thing most people will read.

14. **Demonstrate the failure deliberately, and record it. This is an acceptance criterion, not
    a formality** — a check that has never been observed failing is not known to work. The
    procedure, on a throwaway branch only:
    - Branch (`chore/ci-dist-check-demo`). Make one real `src/` edit that provably changes the
      bundle — changing a string literal in `src/config.ts` is enough. Commit it **without**
      running `npm run build`, so `dist/index.js` is genuinely stale.
    - Open a PR from that branch. This exercises the `pull_request` trigger, which is the one
      the mechanism was chosen for. Confirm the run **fails** at the `dist/` step and that the
      annotation reads as requirement 13 specifies. Record the run URL and paste the annotation
      and `--stat` output verbatim into the results document.
    - Then run `npm run build`, commit the rebuilt `dist/index.js` to the same branch, and
      confirm the **same** workflow on the **same** branch goes green. A check that fails is
      only half the evidence; one that fails and then passes on the fix is proof it
      discriminates rather than just failing.
    - Close the PR without merging and delete the branch. The deliberate breakage must never
      reach `main`, and the `src/` edit must not survive into any other branch.

15. **Close the loop in [`docs/PLUGIN-PRD.md`](../PLUGIN-PRD.md) — this is a deliverable, not follow-up.** [§7](../PLUGIN-PRD.md#7-open-questions) open
    questions are never deleted; they gain a dated answer the way [PQ-06](../PLUGIN-PRD.md#pq-06--what-keeps-the-committed-dist-honest)'s own
    "**Escalated 2026-08-04**" paragraph does. Append to the [PQ-06](../PLUGIN-PRD.md#pq-06--what-keeps-the-committed-dist-honest) block:

    ```
    **Answered <date>.** A CI workflow (`.github/workflows/ci.yml`) reinstalls from the
    lockfile, rebuilds `dist/`, and fails the run if `git status --porcelain -- dist/` is
    non-empty, on every pull request and every push to `main`. Chosen over a pre-commit hook
    (per-clone state git does not distribute, bypassable with `--no-verify`) and over folding
    the build into `claude plugin tag` (release-time only, while P-08 makes every commit an
    update). Demonstrated failing and then passing on a throwaway branch:
    docs/slices/TrackC-Slice11-results.md.
    ```

    Then append **one** row to the [§9](../PLUGIN-PRD.md#9-revision-log) revision-log table. §9 is **append-only** — add a row,
    change nothing else in the file:

    ```
    | <date> | Closed PQ-06: the committed dist/ is kept honest by a CI rebuild-and-diff
    (.github/workflows/ci.yml), which also runs typecheck and the unit tests. Recorded the two
    rejected alternatives and the byte-reproducibility constraints the check rests on
    (npm ci against the lockfile, a pinned Node in .nvmrc, and dist/index.js pinned to LF in
    .gitattributes). Evidence: docs/slices/TrackC-Slice11-results.md. | Track C Slice 11
    (docs/DEV-ROADMAP.md) — P-09 traded a build step for a silent-drift risk and this is the
    detector it was traded against. |
    ```

16. **Retire roadmap standing rule 5.** `DEV-ROADMAP.md` [§3](../DEV-ROADMAP.md#3-standing-rules--apply-to-every-slice-never-restated-per-slice) rule 5 currently reads that `dist/`
    "must be rebuilt with every `src/` change **until Slice 11 automates the check**." That
    clause is this slice. The manual-rebuild discipline stays binding right up until the check
    is green on `main` — not when the workflow file is written, not when the PR is open.
    Once it is green, instruct the same session to rewrite rule 5 so it points at the automated
    check rather than at a promise, and to flip Slice 11's row in [§4](../DEV-ROADMAP.md#4-phase-1-slices) to ☑ with the PR number.
    The roadmap owns sequencing only; if it and the PRD ever disagree, the PRD wins.

## Interface contracts

The check has exactly one contract, and it is the build's:

```
npm run build
  = esbuild src/index.ts --bundle --platform=node --target=node18 --format=esm \
      --outfile=dist/index.js
output: dist/index.js   (currently 573,094 bytes, 15,798 lines)
```

The output bytes are a pure function of three inputs, and nothing else:

1. **The contents of `src/`** — the whole reachable import graph from `src/index.ts`.
2. **The installed dependency tree**, because `--bundle` inlines it. Held fixed by `npm ci`
   against the committed `package-lock.json`.
3. **The esbuild version**, also held fixed by the lockfile (0.28.1).

Verified properties that make a cross-platform byte comparison legitimate: the bundle carries
**no absolute paths** (zero occurrences of a Windows drive prefix), **no backslash path
separators** in its generated module comments (they read `// node_modules/ajv/dist/...`), and
**no `sourceMappingURL`** — the build emits no source map. A Linux runner and a Windows author
running the same esbuild over the same inputs therefore produce the same bytes. The only
remaining difference between the two is line endings, which requirement 5 pins.

Not inputs, and not to be treated as such: the Node version, the operating system, the working
directory, and the wall clock. That is why one `ubuntu-latest` job is sufficient and a
Linux/Windows matrix would only buy runtime coverage of the *server*, which is not this slice's
job.

Repo layout is unchanged from the [Slice 1](./TrackA-Slice1.md) doc. This slice adds only `.github/`, `.gitattributes`,
and `.nvmrc` at the root.

## Out of scope — do NOT

- **No `npm run acceptance` in CI**, under any trigger — see requirement 11. This is the hard
  one; it will look like an obvious win.
- No release automation, no publishing, no tagging, no `claude plugin tag` step. [Slice 13](./TrackC-Slice13.md) owns
  the release gate and the [P-08](../PLUGIN-PRD.md#p-08--version-scheme) switchover.
- No Dependabot, no CodeQL, no coverage reporting, no badge in the README, no lint job — the
  repo has no linter. Each is a separate decision and none is [PQ-06](../PLUGIN-PRD.md#pq-06--what-keeps-the-committed-dist-honest)'s answer.
- No OS or Node matrix. One job, one runner (interface contracts, above).
- No changes to `src/`, `tests/`, `dist/`, `tsconfig.json`, `.mcp.json`, `.claude-plugin/`,
  `skills/`, or `README.md`. The only `package.json` change is the quoted test glob.
- No pre-commit hook alongside the CI check. Two mechanisms for one invariant means the weaker
  one rots; the rejection is recorded in [PQ-06](../PLUGIN-PRD.md#pq-06--what-keeps-the-committed-dist-honest)'s answer, not implemented as a belt-and-braces.
- No widening of `.gitattributes` beyond the single `dist/` rule (requirement 5).
- No new npm dependencies, dev or runtime.
- No edits to [`docs/PLUGIN-PRD.md`](../PLUGIN-PRD.md) beyond the [PQ-06](../PLUGIN-PRD.md#pq-06--what-keeps-the-committed-dist-honest) answer paragraph and the single [§9](../PLUGIN-PRD.md#9-revision-log) row; no
  edits to §2, §3, or §4 of either PRD.

## Acceptance criteria

1. `.github/workflows/ci.yml` exists and a run on `main` is green with all four steps — `npm
   ci`, `npm run typecheck`, `npm test`, and the rebuild-and-diff — executed in that order.
2. **[Roadmap done-when]** A PR carrying a real `src/` change with an un-rebuilt `dist/` **fails
   the check**, demonstrated once deliberately per requirement 14. The failing run's URL and its
   annotation text are recorded.
3. Committing the rebuilt `dist/index.js` to that same branch turns the same workflow green.
   Both run URLs are in `docs/slices/TrackC-Slice11-results.md`.
4. The deliberate breakage never reached `main`: the demo PR is closed unmerged and the branch
   deleted.
5. The CI `npm test` step reports the **same** suite and test counts as a local run on Windows
   (19 suites, 67 tests as of 2026-08-04). A lower count means the shell ate a suite and
   requirement 9's fix did not take.
6. `.gitattributes` exists with exactly the one `dist/index.js text eol=lf` rule, and the commit
   that adds it renormalizes no other file — `git status` after `npm run build` shows a clean
   tree.
7. `git grep -n acceptance -- .github/` returns nothing, and no workflow contains a
   `workflow_dispatch`, `schedule`, or label-gated path to the live harness.
8. `docs/PLUGIN-PRD.md` [§7](../PLUGIN-PRD.md#7-open-questions) [PQ-06](../PLUGIN-PRD.md#pq-06--what-keeps-the-committed-dist-honest) carries a dated answer naming the mechanism and both rejected
   alternatives; [§9](../PLUGIN-PRD.md#9-revision-log) has exactly one new row. `git diff docs/PLUGIN-PRD.md` shows the appended
   paragraph and the appended row and nothing else. No new `P-` decision was created.
9. `docs/DEV-ROADMAP.md` [§3](../DEV-ROADMAP.md#3-standing-rules--apply-to-every-slice-never-restated-per-slice) rule 5 no longer says "until Slice 11 automates the check," and [§4](../DEV-ROADMAP.md#4-phase-1-slices)'s
   Slice 11 row reads ☑ with the PR number.
10. `docs/slices/TrackC-Slice11-results.md` records: date, the pinned Node version, both run
    URLs, the failing annotation verbatim, the `git diff --stat` output from the failing run,
    and the CI test counts from criterion 5.

## Testing requirements

There is no unit test for a workflow, and no test file is added by this slice. The
demonstration in requirement 14 **is** the test, and criteria 2 and 3 are its two halves — the
failing run proves the check fires, the passing run on the fix proves it discriminates. Neither
half alone is evidence.

Before pushing anything, dry-run the gate locally so the first CI run is not the first time the
logic executes. From a clean tree, in Git Bash:

```bash
npm ci                                   # exactly the lockfile, as CI will
npm run build
git status --porcelain -- dist/          # must print nothing on a healthy tree
```

Then prove the gate's teeth locally before you prove them in CI: touch a string in
`src/config.ts`, re-run the three lines above, and confirm the porcelain output is non-empty.
Revert. `act` or any local Actions emulator is not required and not expected.

Do not run `npm run acceptance` as part of this slice at all. Nothing here touches the server's
behavior, and the harness is a live third-party call.

## Verification steps

```bash
# 1) the glob fix — sh must no longer decide which suites run
sh -c 'for f in tests/**/*.test.ts; do echo "$f"; done'   # before: 4 files, config missing
npm test                                                   # after: 19 suites, 67 tests

# 2) the gate, locally, exactly as CI runs it
npm ci && npm run typecheck && npm test && npm run build
git status --porcelain -- dist/        # empty == honest

# 3) prove the teeth locally, then revert
#    (edit a string in src/config.ts, do NOT rebuild)
git status --porcelain -- dist/        # still empty — dist is stale, which is the point
npm run build && git status --porcelain -- dist/   # now non-empty
git checkout -- src/config.ts && npm run build

# 4) push the branch, open the PR, watch the green run
# 5) the deliberate failure: see requirement 14 — throwaway branch, PR, fail, fix, green,
#    close unmerged, delete branch, record both URLs
git add -A && git status               # workflow + .gitattributes + .nvmrc + docs committed
```

## References

- `docs/DEV-ROADMAP.md` [§4](../DEV-ROADMAP.md#4-phase-1-slices), Slice 11 (goal and done-when source); [§3](../DEV-ROADMAP.md#3-standing-rules--apply-to-every-slice-never-restated-per-slice) rule 5 (the standing rule
  this slice retires); [§5](../DEV-ROADMAP.md#5-order-and-parallelism) (the graph — `S1 --> S11 --> S13`, and the note that Slice 11 is more
  urgent than originally scheduled).
- `docs/PLUGIN-PRD.md` [P-09](../PLUGIN-PRD.md#p-09--server-ships-as-committed-built-javascript) (server ships as committed built JavaScript — the decision that
  created this risk and named it the cheaper cost), [PQ-06](../PLUGIN-PRD.md#pq-06--what-keeps-the-committed-dist-honest) (the open question this slice closes,
  including its three candidate mechanisms and its 2026-08-04 escalation), [P-08](../PLUGIN-PRD.md#p-08--version-scheme) (unset `version`
  means every commit is an update — why release-time checking is too late), [P-11](../PLUGIN-PRD.md#p-11--the-repo-is-its-own-marketplace) (`owner/repo`
  marketplace — why a friend's fork PR is a real path), [§9](../PLUGIN-PRD.md#9-revision-log) (revision-log format, append-only).
- [`docs/slices/TrackA-Slice1.md`](./TrackA-Slice1.md) (the build command, the committed-`dist/` rule, and the repo
  layout this slice adds to).
- [`docs/slices/TrackA-Slice6.md`](./TrackA-Slice6.md), out-of-scope list (the existing, binding refusal to CI-wire
  the live acceptance harness) and requirement 7 (the §9 row template this document mirrors).
- `docs/MCP-PRD.md` [§3.4](../MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance) (rate limits are hard constraints — why requirement 11 is not
  negotiable).
- `CLAUDE.md`, "Environment" (`core.autocrlf=true`, no `.gitattributes`, CRLF working tree over
  LF blobs — the fact requirement 5 is built on).
