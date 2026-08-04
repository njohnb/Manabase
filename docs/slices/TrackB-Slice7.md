# Track B — Slice 7: Plugin install verification

> Self-contained implementation spec. You do not need to read the PRDs to build this slice;
> everything binding is inlined. PRD references are pointers for deeper context only.

**Goal.** Prove the two-command install end to end against the real public repo, and record
what was observed. Seven of PC-02's ten acceptance criteria — 1, 2, 3, 4, 6, 7 and 9 — are
install-surface claims that no unit test can reach: they are true or false only on a machine
that actually installed the plugin from a marketplace. Nothing in `docs/PLUGIN-PRD.md` has ever
been verified; this is the slice that changes that, and the deliverable is the record, not code.

## Preconditions (deliverables of Slice 5; Track A closed)

- `dist/index.js` current, committed, self-contained, and serving `card_search` end-to-end over
  stdio — verified 2026-08-04 from a directory containing no `node_modules`.
- `.claude-plugin/plugin.json`: `name: "manabase"`, `displayName: "Manabase"`, Fan Content
  disclaimer in `description`, **no `version`** (P-08), **no `userConfig`** (P-13).
- `.claude-plugin/marketplace.json`: `name: "manabase"`, one plugin entry, `source: "./"`
  (relative — P-11), disclaimer present.
- `.mcp.json` at the repo root: one stdio server, key `mtg`, `node`
  `${CLAUDE_PLUGIN_ROOT}/dist/index.js`.
- `README.md` carries the `owner/repo` install form and the raw-URL warning.
- `npm test` (67 tests, 19 suites) and `npm run typecheck` clean.
- The GitHub repo `njohnb/Manabase` exists and is **public** (verified 2026-08-04 via
  `gh repo view njohnb/Manabase --json visibility`). Default branch `main`.

Nothing in Slice 8 (`SKILL.md`) is required. The skill directory is an empty placeholder and
stays that way; a plugin with no skill installs and serves tools fine.

## Context

Manabase is a Magic: The Gathering MCP server (Scryfall-backed card search) that ships inside a
Claude Code plugin; the harness starts it as `node ${CLAUDE_PLUGIN_ROOT}/dist/index.js` when the
plugin is enabled. This is slice 1 of 3 in Track B: **install verification** → `SKILL.md`
authoring → PC-01 evals. It is the first slice in the project whose evidence comes from a
harness rather than from a test runner, and the first that touches `docs/PLUGIN-PRD.md` §9.

## Deliverables

| File | Action |
|---|---|
| `docs/slices/TrackB-Slice7-results.md` | new — the recorded run: date, environment, per-criterion observation, drift |
| `docs/PLUGIN-PRD.md` | append **one** revision-log row to §9 (template in requirement 15). Nothing else in that file changes |
| `docs/DEV-ROADMAP.md` | Slice 7 status ☐ → ☑; tick only the done-when boxes actually observed; add a **Landed** note in the Track A house style |
| `README.md` | modify — one sentence. The status paragraph currently says "nobody has yet installed this from a marketplace"; after this slice that is false |
| `src/config.ts`, `dist/index.js` | **a decision, not a mandate** — the `OWNER` placeholder, requirement 12 |

## Requirements

1. **This slice is largely interactive and cannot be fully automated. Say which half is
   which, and do not pretend otherwise in the results.** `/plugin marketplace add`,
   `/plugin install`, `/plugin update`, `/mcp` and `/reload-plugins` are Claude Code slash
   commands typed by a human inside a session; an agent cannot invoke them. Non-interactive
   `claude plugin …` CLI equivalents exist and are verified present on 2.1.219 —
   `claude plugin marketplace add <source>`, `claude plugin install <plugin> [-s scope]`,
   `claude plugin update <plugin>`, `claude plugin list [--json]`,
   `claude plugin validate <path> [--strict]`, and `claude mcp list` — but they are a *second*
   path, not the criterion's path. Criterion 1 is a claim about what a user types, and
   criterion 2 is a claim about what a user is shown, so both must be observed by a human in a
   real session. Split the work accordingly:

   | Half | Items | Instrument |
   |---|---|---|
   | Automatable | criterion 9 (validate), criterion 4 (offline start), criterion 6 (no writes under the plugin root), criterion 7 (standalone cache resolution) | shell, run by anyone including an agent |
   | Human-in-the-loop | criterion 1 (`/plugin marketplace add`, `/plugin install`, `/mcp`), criterion 2 (zero prompts), criterion 3 (calling the scoped tool from a session), the P-08 update loop | a Claude Code session on the author's machine |

2. **The cold-profile observation is available exactly once — do not burn it.** Criterion 1
   says *"on a machine with the plugin never installed."* The author's machine is currently in
   that state: `claude plugin list --json` contains no `manabase` entry and
   `~/.claude/plugins/cache/` holds only `claude-plugins-official` and
   `lutz-tech-marketplace` (verified 2026-08-04). Run the cold install deliberately, once, with
   the recorder open: capture the exact command text, every prompt shown (there should be
   none), and the `/mcp` output *before* doing anything else. A repeat after
   `claude plugin uninstall manabase` + `claude plugin marketplace remove manabase` + deleting
   `~/.claude/plugins/cache/manabase/` and `~/.claude/plugins/data/manabase-manabase/` is a
   *warm-cache approximation*, not the same observation — say so in the results if you have to
   fall back to it. The second genuinely cold observation belongs to Slice 12's friend dry-run;
   do not spend it here.

3. **Pre-flight, before any install.** Push `main` so the marketplace resolves current HEAD
   (the repo is already public — this is a push, not a publish). Confirm the marketplace source
   string is `njohnb/Manabase` in `owner/repo` form. **Never add the marketplace by a raw URL
   to `marketplace.json`** — that downloads only that one file, and `source: "./"` then
   resolves against nothing, producing a partial, confusing failure rather than a clean one
   (P-11's trap, PLUGIN-PRD §4.2). The results document must not contain a URL form even as a
   rejected alternative. After adding, confirm the resolved marketplace *name* with
   `claude plugin marketplace list` rather than assuming it: the install target is
   `manabase@<marketplace-name>`, and the name comes from `marketplace.json`'s `name` field,
   which is currently `manabase` — hence `/plugin install manabase@manabase`.

4. **Criterion 9 — `claude plugin validate . --strict` passes. It does not today, and that is
   the slice's first real finding.** Observed 2026-08-04 on Claude Code 2.1.219:

   ```
   Validating marketplace manifest: C:\Projects\Manabase\.claude-plugin\marketplace.json
   ⚠ Found 1 warning:
     ❯ plugins[0] plugin.json → version: No version specified. Consider adding a version
       following semver (e.g., "1.0.0")
   ✘ Validation failed (--strict treats warnings as errors)      # exit 1
   ```

   Without `--strict` the same run reports `✔ Validation passed with warnings`, exit 0. The
   single warning is P-08's **deliberate** unset `version`, which stays unset until Slice 13.
   So PC-02 criterion 9 and P-08 are in direct conflict for the whole of Phase 1, as is
   `CLAUDE.md`'s standing rule to run `--strict` before any push. **Do not mark criterion 9
   passed.** Re-run both forms, record both verbatim, and record the disposition: *no errors,
   exactly one warning, and that warning is the decision itself.* Then add a done-when to
   Slice 13 in the roadmap — re-run `--strict` after semver is set and expect a clean pass.
   Whether PC-02 criterion 9 should be reworded to exempt the pre-release window is a question
   for the PRD's owner; raise it, do not answer it by editing a §5 criterion in this slice.

5. **Criterion 1 — the server is connected after two commands, with no extra command, no file
   edit, and no restart.** In a Claude Code session, on the cold profile:
   `/plugin marketplace add njohnb/Manabase`, then `/plugin install manabase@manabase`. Then
   `/mcp` and record whether the entry appears **connected**. The "no restart" half is the part
   most likely to fail quietly: if `/mcp` shows nothing until a new session, criterion 1 is
   *not* met as written and the results must say so plainly rather than rounding it to a pass.
   Note that `claude plugin update` documents "restart required to apply" for *updates*; the
   criterion is about a fresh install, and the harness's behavior there must be observed, not
   inferred. Cross-check outside the session with `claude mcp list`, which health-checks and
   lists plugin servers by their registered key — expect a line beginning
   `plugin:manabase:mtg` with a connected marker (this form is verified: other installed
   plugins list exactly that way on this machine).

6. **Criterion 2 — enabling the plugin produces zero configuration prompts** (P-13; PLUGIN-PRD
   §3.5). `plugin.json` declares no `userConfig`, so there is nothing to ask. The evidence is
   negative and therefore easy to record sloppily: capture the full install/enable transcript
   and state explicitly that no prompt appeared, rather than omitting the topic. Do not pass
   `--config` to the CLI installer; using it at all would invalidate the observation.

7. **Criterion 3 — the tools are callable as `mcp__plugin_manabase_mtg__*`.** In the session
   that installed the plugin, call `mcp__plugin_manabase_mtg__card_search` with a real query
   (one call — Scryfall politeness still binds) and record the tool name exactly as the harness
   reports it. The server registers the bare `card_search`; the scoping is the harness's doing
   (P-12). **Trap: do this from a scratch directory outside the Manabase working tree.** This
   repo's own root `.mcp.json` declares a server keyed `mtg`, so a session started *inside*
   `C:\Projects\Manabase` also loads it as a **project-scoped** server — whose tools would be
   `mcp__mtg__card_search`, an entirely different name — and it cannot start there anyway.
   Observed 2026-08-04 in this working tree:

   ```
   [Contains warnings] Project config (shared via .mcp.json)
   Location: C:\Projects\Manabase\.mcp.json
    └ [Warning] [mtg] mcpServers.mtg: Missing environment variables: CLAUDE_PLUGIN_ROOT
   ```

   That warning is correct and expected — `CLAUDE_PLUGIN_ROOT` exists only in plugin context —
   but a criterion-3 observation taken in that directory proves the wrong thing.

8. **Criterion 4 — the server starts and serves with no network access, proving no package
   fetch in the startup path** (P-09). Run this against the **installed** copy at the path
   `claude plugin list --json` reports as `installPath`, not against the repo working tree —
   the shipped artifact is what the criterion is about. Turn the machine's network off the
   elevation-free way (Wi-Fi off / Ethernet unplugged; do not attempt an adapter or firewall
   change that needs admin), then drive the installed bundle over stdio exactly as Slice 1 and
   Slice 5 did: `initialize` → `notifications/initialized` → `tools/list`, and confirm
   `card_search` is listed. The bundle is self-contained by construction — esbuild `--bundle`,
   the MCP SDK stays a **devDependency**, and `.mcp.json` runs bare `node` with no install step
   — so there is nothing in the startup path to fetch; this run is the demonstration of it. As
   a bonus while the network is down, issue one `tools/call` and record the result: a
   structured failure with the server still alive is supplementary evidence toward criterion 8
   (**not** a claim of it — see requirement 13).

9. **Criterion 6 — no file is created or modified under `${CLAUDE_PLUGIN_ROOT}` during a
   session** (P-06). This needs a real before/after observation, not an assertion. The
   installed root is `installPath` from `claude plugin list --json`; on this machine the cache
   layout is `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`, so it will be
   `…/cache/manabase/manabase/<resolved-version>/`. Take a content hash sweep before and after
   a session in which `card_search` is actually called several times:

   ```powershell
   $root = (claude plugin list --json | ConvertFrom-Json |
            Where-Object id -eq 'manabase@manabase').installPath
   Get-ChildItem -Recurse -File -Force $root | Sort-Object FullName | ForEach-Object {
     "{0}`t{1}`t{2}" -f $_.FullName.Substring($root.Length), $_.Length,
                        (Get-FileHash $_.FullName -Algorithm SHA256).Hash
   } | Set-Content $env:TEMP\manabase-root-before.txt
   ```

   Re-run into `…-after.txt` after the session and `Compare-Object (Get-Content before)
   (Get-Content after)`. Hash rather than mtime alone — a rewrite with a preserved timestamp
   would slip past an mtime sweep, and the tree is small enough that hashing costs nothing.
   Empty `Compare-Object` output is the pass. Record the file count swept, so a future reader
   can tell the sweep actually saw the tree.

10. **Criterion 7 — standalone, with `CLAUDE_PLUGIN_DATA` unset, the cache path *resolves*
    rather than failing** (PLUGIN-PRD §4.5). **Resolution only. Phase 1 writes no cache — do
    not spec, add, or look for a cache write, and do not add logging to `src/` to observe
    this.** Two pieces of evidence, both cheap:
    - Run the same resolution the entry point runs, importing the source directly (the
      mechanism `npm test` already relies on). Verified working 2026-08-04 on Node v26.5.1
      with no flag; add `--experimental-strip-types` if the local Node needs it:

      ```bash
      node --input-type=module -e "import { resolveConfig } from './src/config.ts'; \
        const env = { ...process.env }; delete env.CLAUDE_PLUGIN_DATA; \
        console.log(JSON.stringify(resolveConfig(env, process.platform), null, 2));"
      ```

      Observed on Windows: `"cacheDir": "C:\\Users\\<user>\\AppData\\Local\\manabase"` — the
      `%LOCALAPPDATA%\manabase` branch, not a throw and not a path beside the code.
    - The installed bundle started standalone with the variable unset (requirement 8's offline
      run is exactly this process) completes the handshake and lists tools, i.e. resolution
      does not abort startup.

    The durable evidence for the other platform branches stays `tests/config.test.ts`, which
    covers `win32`, `darwin` and the XDG/`~/.cache` fallbacks against injected platform
    strings; re-run `npm test` in this session and record the pass. Note in the results that no
    directory was created, because nothing creates it.

11. **The P-08 update loop, while `version` is unset.** With no `version` in `plugin.json`,
    Claude Code falls back to the git commit SHA of the plugin source, so every pushed commit
    is an update — but only for `github`, `url`, `git-subdir` and relative-path sources inside
    a git-hosted marketplace; anything else resolves to the literal `unknown` and never
    updates. P-11's relative `./` source is what keeps this repo inside that set, and
    `claude plugin list --json` is where you can see it either way (an installed plugin whose
    fallback failed shows `"version": "unknown"` — that shape is present on this machine for an
    unrelated plugin, so it is a real failure mode, not a hypothetical). Verify the loop:
    1. Record `version` and `installPath` for `manabase@manabase` immediately after install;
       confirm `version` is a 40-character commit SHA equal to the pushed HEAD, **not**
       `unknown`.
    2. Push one real commit to `main` (requirement 12 supplies a good one).
    3. Run `/plugin update manabase`. If it reports the plugin is already current, refresh the
       marketplace clone first (`claude plugin marketplace update manabase`) and retry —
       **record which was required.** Whether a marketplace refresh is a precondition of the
       SHA loop is not stated in PLUGIN-PRD §4.3, and it is precisely the operational detail
       that makes "every commit is an update" true or false in practice.
    4. Confirm the reported `version` is now the new HEAD SHA and `installPath` has moved to a
       new directory (each version is its own cache directory; the previous one is orphaned and
       removed ~14 days later). Confirm the *bytes* moved, not just the metadata — grep the new
       `installPath\dist\index.js` for the string requirement 12's commit introduces.
    5. Note the mid-session semantics rather than fighting them: a plugin updated mid-session
       keeps the running server on the old `CLAUDE_PLUGIN_ROOT` until `/reload-plugins`, and a
       reload keeps the connection alive when the server configuration is unchanged.

    **This behavior changes at Slice 13.** Once `plugin.json` carries explicit semver, version
    becomes the cache key and a push *without* a bump ships nothing — correct then, wrong now.
    Say so in the results so the next reader does not treat today's observation as permanent.

12. **The `OWNER` placeholder in `src/config.ts` — decide it in this session; do not leave it
    undecided.** The outbound User-Agent is still
    `manabase-mtg/0.0.0 (+https://github.com/OWNER/manabase)`. Slice 1 deliberately left the
    owner unsubstituted and assigned the substitution to **Track B** before release, and
    Scryfall requires a User-Agent that names the application and gives it a contactable
    identity. This is the first slice where the owner is both known and verified public
    (`njohnb/Manabase`). Recommended: fix it here and make it the update-loop payload of
    requirement 11 — a one-line `src/config.ts` change, `npm run build`, `npm test`,
    `npm run typecheck`, commit the rebuilt `dist/index.js` (P-09: `dist/` is committed and
    must be rebuilt with every `src/` change), push. That makes step 4's "the new bytes
    actually landed" check concrete: the string `github.com/njohnb` is absent from the
    pre-update `dist/index.js` and present afterward. `tests/config.test.ts` asserts only that
    the agent contains `manabase-mtg/` and `APP_VERSION`, so nothing breaks; the literal in
    `tests/scryfall/client.test.ts` is a self-contained fixture, worth updating for tidiness
    but not load-bearing. `APP_VERSION` still tracks `package.json` by hand and is untouched.
    If you decide to defer instead, use any trivial commit for the update loop and record the
    deferral as an open item — but do not ship a friend an install whose User-Agent says
    `OWNER`.

13. **What this slice does *not* close. State it in the results; a reader must not conclude
    PC-02 is done.** Three of PC-02's ten criteria are out of scope here:
    - **Criterion 5** (contents of `${CLAUDE_PLUGIN_DATA}` survive a `/plugin update` and are
      *still used*): not assigned to this slice by the roadmap, and unverifiable while Phase 1
      writes nothing — "still used" has no observer. Since the update loop runs anyway, you may
      drop a sentinel file into `~/.claude/plugins/data/manabase-manabase/` and record whether
      it survived; label it **supplementary harness observation, not criterion 5**. Note also
      that PLUGIN-PRD §4.5 says criteria 5 *and* 7 "still require Slice 7" while the roadmap
      assigns only 7 — that is documentation drift and belongs in the results.
    - **Criterion 8** (unreachable upstream → structured failure, not a dead server): no Phase 1
      slice claims it. Requirement 8's offline `tools/call` is evidence toward it; record it as
      such without ticking the box.
    - **Criterion 10** (`claude plugin details manabase` recorded as the cost baseline):
      **owned by Slice 10**, together with PQ-01 and PQ-02. Do not run the measurement here —
      running it early with no `SKILL.md` present produces a baseline that Slice 8 immediately
      invalidates.

14. **Record the run** in `docs/slices/TrackB-Slice7-results.md`, mirroring
    `TrackA-Slice6-results.md`: run date; environment (OS, Claude Code version — the floor is
    2.1.207, P-10, and the author's machine reads 2.1.219 as of 2026-08-04 — Node version,
    whether the profile was cold or a warm-cache approximation); the resolved plugin id,
    version SHA and `installPath`; a per-criterion table covering 1, 2, 3, 4, 6, 7 and 9 with
    the **observed** evidence, not the claim restated; the update-loop record; an explicit
    **Not claimed by this slice** section for criteria 5, 8 and 10; and a **Drift** section
    listing every divergence from the 2026-07-29 harness research in PLUGIN-PRD §4 (or "none").
    The `--strict` conflict, and anything the raw command output contradicts, go in Drift.
    **Do not overwrite PLUGIN-PRD §4** — it is a dated research record; divergences are
    recorded here and summarized in the §9 row.

15. **Close the loop in the PRD.** Append **one** row to the `docs/PLUGIN-PRD.md` §9
    revision-log table. §9 is append-only and **nothing else in that file changes in this
    slice** — no §5 criterion edited, no §4 claim rewritten, no §7 question closed:

    ```
    | <date> | **PC-02's install surface verified for the first time.** Criteria 1, 2, 3, 4, 6
    and 7 observed on a <cold | warm-cache> profile installing `njohnb/Manabase` as
    `manabase@manabase` (Claude Code <version>, <OS>, Node <version>). Resolved plugin version
    <sha> — P-08's commit-SHA fallback confirmed live, and `/plugin update` picked up a pushed
    commit <with | without> a prior marketplace refresh. **Criterion 9 not met as written:**
    `claude plugin validate .` passes with exactly one warning, and `--strict` fails on that
    warning, which is P-08's deliberate unset `version` — the two are in conflict until the
    Slice 13 switchover. Criteria 5, 8 and 10 remain unverified (10 is Slice 10's; 5 has no
    observer while Phase 1 writes nothing). Results:
    docs/slices/TrackB-Slice7-results.md. | Track B Slice 7 (docs/DEV-ROADMAP.md) — the first
    verification of anything in this document's §5, and the point at which "the thing a user
    installs does not exist" stops being true. |
    ```

16. **Roadmap and README, minimally.** In `docs/DEV-ROADMAP.md`: flip Slice 7's status, tick
    only the done-when boxes actually observed (leave criterion 9's box unticked with a note if
    requirement 4 holds), add a **Landed** paragraph in the Track A house style, and add the
    `--strict` re-run to Slice 13's work list. Update §2's "the plugin has never been installed
    from a marketplace" line. In `README.md`, correct the status paragraph's claim that the two
    commands are "the intended path rather than a verified one" — **one sentence.** Full README
    work, including the troubleshooting section, is Slice 12's; do not start it here.

## Interface contracts

This slice creates no exported code. What it consumes and asserts against, all fixed by earlier
slices and by the harness, and all of it exact — a near-miss on any of these names is the whole
failure mode:

| Thing | Value | Owner |
|---|---|---|
| Marketplace source (as typed) | `njohnb/Manabase` — `owner/repo`, never a URL | P-11 |
| Marketplace name | `manabase` (`marketplace.json` `name`) — confirm with `claude plugin marketplace list` | P-11 |
| Plugin name / install id | `manabase` / `manabase@manabase` | P-12 |
| MCP server key | `mtg`; registers as `plugin:manabase:mtg` | P-12 |
| Scoped tool name | `mcp__plugin_manabase_mtg__card_search` | P-12 |
| Server command | `node ${CLAUDE_PLUGIN_ROOT}/dist/index.js` | P-09 |
| `${CLAUDE_PLUGIN_ROOT}` | `claude plugin list --json` → `installPath`; on this machine `~/.claude/plugins/cache/manabase/manabase/<version>/` | PLUGIN-PRD §4.3 |
| `${CLAUDE_PLUGIN_DATA}` | `~/.claude/plugins/data/manabase-manabase/`, created on first reference, survives updates | P-06, §4.5 |
| Standalone cache fallback | `%LOCALAPPDATA%\manabase` (win32), `~/Library/Caches/manabase` (darwin), `$XDG_CACHE_HOME/manabase` else `~/.cache/manabase` | §4.5 |
| Wire behavior asserted offline | `initialize` → `notifications/initialized` → `tools/list` returns exactly one tool, `card_search` | Slice 5 |

Repo layout is unchanged from the Slice 1 doc; this slice adds only `docs/slices/`
documents.

## Out of scope — do NOT

- **Do not write `skills/scryfall-query-craft/SKILL.md` or any part of it** — Slice 8. The
  placeholder directory ships empty and that is fine.
- **Do not run `claude plugin details`** or take any context-cost measurement — Slice 10, and a
  baseline taken before the skill exists is worse than none.
- **Do not set `version` in `plugin.json`**, and never set it in both `plugin.json` and the
  marketplace entry — `plugin.json` wins silently. The switchover is Slice 13 (P-08).
- **Do not add a CI check for `dist/`** — Slice 11 (PQ-06).
- **Do not declare `userConfig`, `defaultEnabled`, `settings.json`, hooks, agents, or a second
  MCP server.** Phase 1 is one skill and one server.
- **Do not edit `docs/PLUGIN-PRD.md` beyond the single appended §9 row**, and do not edit
  `docs/MCP-PRD.md` at all.
- **Do not demonstrate, document, or even mention as an option the raw-URL marketplace add**
  (P-11).
- **Do not provoke Scryfall.** The tool calls in this slice are a handful, for name and
  round-trip evidence only; ≥600 ms apart, no loops, no `npm run acceptance` re-run needed.
- No new dependencies, no new npm scripts, no changes to handler/client/price logic.

## Acceptance criteria

1. `docs/slices/TrackB-Slice7-results.md` exists and records, per criterion, the **observed**
   evidence for PC-02 criteria 1, 2, 3, 4, 6 and 7, plus the criterion 9 disposition — each
   with the command or session action that produced it.
2. The install was performed from `njohnb/Manabase` in `owner/repo` form; no URL form appears
   anywhere in the deliverables.
3. `claude plugin list --json` output for `manabase@manabase` is recorded before and after the
   update, showing a 40-character commit SHA (not `unknown`) both times, a changed
   `installPath`, and new bytes in the installed `dist/index.js`.
4. The criterion-6 sweep is recorded as an empty `Compare-Object` result with the number of
   files swept, taken around a session that actually called `card_search`.
5. The offline run is recorded against the **installed** `installPath` copy, showing
   `card_search` in `tools/list` with the network down.
6. `claude plugin validate .` and `claude plugin validate . --strict` are both recorded
   verbatim, with the conflict against P-08 stated and criterion 9 **not** marked passed.
7. `docs/PLUGIN-PRD.md` §9 has exactly one new row; `git diff docs/PLUGIN-PRD.md` shows one
   appended table row and nothing else.
8. `docs/DEV-ROADMAP.md` Slice 7 is ☑ with only the observed boxes ticked, and §2's
   "never been installed" statement is corrected. `README.md`'s stale status sentence is fixed.
9. `npm test` and `npm run typecheck` pass in this session. If requirement 12's fix landed,
   `npm run build` was re-run and `dist/index.js` is committed with it.
10. Tree committed clean. The results document names which observations were cold-profile and
    which were warm-cache approximations — no observation is reported at higher confidence
    than it was taken.

## Testing requirements

There is no new unit test in this slice, and there should not be: every claim here is about the
harness, and a test that mocks the harness would prove nothing. The existing suite is re-run as
evidence for criterion 7's platform branches (`tests/config.test.ts`) and as a regression gate
if requirement 12's `src/config.ts` change lands — `npm test` (67 tests, 19 suites) and
`npm run typecheck` must both be clean in the same session as the recorded run, and the number
recorded in the results.

Keep the record honest in the same way the Slice 6 harness is kept honest: paste actual command
output rather than paraphrasing it, and where a criterion was met by a *different* route than
the PRD's wording describes (CLI instead of slash command, warm cache instead of cold), record
the route, not the conclusion.

## Verification steps

```bash
# ---- pre-flight (shell) ----
npm run typecheck && npm test && npm run build   # bundle current before anything installs it
git status                                       # clean; push main so HEAD is what resolves
claude --version                                 # record it; floor is 2.1.207 (P-10)
claude plugin validate .                         # expect: passes with 1 warning, exit 0
claude plugin validate . --strict                # expect: FAILS on that warning — record it
claude plugin list --json                        # confirm no manabase entry: the cold state

# ---- human, in a Claude Code session started OUTSIDE C:\Projects\Manabase ----
#   /plugin marketplace add njohnb/Manabase      <- owner/repo. never a URL (P-11)
#   /plugin install manabase@manabase
#   /mcp                                          <- connected? no restart? record verbatim
#   (record: zero configuration prompts — criterion 2)
#   call mcp__plugin_manabase_mtg__card_search once with a real query (criterion 3)

# ---- back in the shell ----
claude plugin marketplace list                   # confirm the resolved marketplace name
claude mcp list                                  # expect a plugin:manabase:mtg connected line
claude plugin list --json                        # record version (40-char SHA) + installPath
```

```powershell
# ---- criterion 6: no writes under ${CLAUDE_PLUGIN_ROOT} ----
$root = (claude plugin list --json | ConvertFrom-Json |
         Where-Object id -eq 'manabase@manabase').installPath
function Sweep($out) {
  Get-ChildItem -Recurse -File -Force $root | Sort-Object FullName | ForEach-Object {
    "{0}`t{1}`t{2}" -f $_.FullName.Substring($root.Length), $_.Length,
                       (Get-FileHash $_.FullName -Algorithm SHA256).Hash
  } | Set-Content $out
}
Sweep "$env:TEMP\manabase-root-before.txt"
#   ... run a session that calls card_search several times ...
Sweep "$env:TEMP\manabase-root-after.txt"
Compare-Object (Get-Content "$env:TEMP\manabase-root-before.txt") `
               (Get-Content "$env:TEMP\manabase-root-after.txt")   # expect: no output
```

```bash
# ---- criterion 4: offline start, against the INSTALLED copy ----
# turn Wi-Fi off / unplug Ethernet first (no elevation needed)
printf '%s\n' \
 '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"0"}}}' \
 '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
 '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
 | node "<installPath>/dist/index.js"      # expect: handshake + card_search listed
# optional, same offline process: one tools/call -> structured failure, server alive
#   (evidence toward criterion 8; not a claim of it)

# ---- criterion 7: standalone cache resolution, CLAUDE_PLUGIN_DATA unset ----
node --input-type=module -e "import { resolveConfig } from './src/config.ts'; \
  const env = { ...process.env }; delete env.CLAUDE_PLUGIN_DATA; \
  console.log(JSON.stringify(resolveConfig(env, process.platform), null, 2));"
# expect a platform user-cache path, no throw, and no directory created

# ---- P-08 update loop ----
# commit + push (requirement 12's User-Agent fix is the recommended payload), then:
#   /plugin update manabase          <- if "already current", run:
claude plugin marketplace update manabase
#   /plugin update manabase          <- and record which was required
claude plugin list --json            # new SHA, new installPath
grep -c "github.com/njohnb" "<new installPath>/dist/index.js"   # new bytes actually landed

# ---- close out ----
npm test && npm run typecheck
git add -A && git status   # results doc + §9 row + roadmap + README (+ src/dist if fixed)
```

## References

- `docs/DEV-ROADMAP.md` §4, Slice 7 (goal, work, and the seven done-when items); §3 standing
  rules (never restated per slice); §5 dependency graph — Slice 7 needs only Slice 5, and gates
  Slices 9 and 10.
- `docs/PLUGIN-PRD.md` **PC-02** — the ten acceptance criteria; this slice claims 1, 2, 3, 4, 6,
  7 and qualifies 9. §9 revision log (append-only).
- `docs/PLUGIN-PRD.md` **P-06** (cache lives in `${CLAUDE_PLUGIN_DATA}`, never
  `${CLAUDE_PLUGIN_ROOT}`, which is replaced on update and GC'd ~14 days later), **P-08**
  (`version` unset during development → commit-SHA fallback; explicit semver at first release,
  after which a push without a bump ships nothing), **P-09** (committed built JS, started as
  `node` from the plugin root, no package fetch in the startup path, SDK stays a devDependency),
  **P-11** (repo is its own marketplace, added as `owner/repo`; the raw-URL trap), **P-12**
  (plugin name `manabase`, server key `mtg`, scoped tool
  `mcp__plugin_manabase_mtg__card_search`), **P-13** (no `userConfig` in Phase 1 → zero prompts).
- `docs/PLUGIN-PRD.md` §4.2 (install path, catalog schema, source types, precedence, the
  raw-URL trap, `validate --strict`), §4.3 (version resolution order, the conditional SHA
  fallback, update semantics and the per-version cache directory), §4.5 (persistent data,
  standalone fallback rule, and the note that criteria 5 and 7 await this slice), §3.5 (zero
  prompts; Fan Content disclaimer on `plugin.json`, the marketplace entry, and the README).
- `docs/slices/TrackA-Slice1.md` — canonical repo layout, the config contract, and the
  `OWNER`-substitution deferral referenced in requirement 12.
- `docs/slices/TrackA-Slice6-results.md` — the shape this slice's results document follows.
