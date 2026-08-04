# Track B — Slice 7 results: [PC-02](../PLUGIN-PRD.md#pc-02--bundled-mcp-server)'s install surface, verified for the first time

**Run date:** 2026-08-04
**OS:** Microsoft Windows 11 Pro, 10.0.26200.0
**Claude Code:** 2.1.221 (floor is 2.1.207, [P-10](../PLUGIN-PRD.md#p-10--minimum-supported-claude-code-version) — clears it)
**Node:** v22.17.1 (same as [Slice 6](./TrackA-Slice6-results.md); no version move)
**Profile:** **cold** — verified immediately before the install (see [Cold-profile proof](#cold-profile-proof)). Not a warm-cache approximation.
**Plugin id:** `manabase@manabase`, marketplace source `njohnb/Manabase` in `owner/repo` form ([P-11](../PLUGIN-PRD.md#p-11--the-repo-is-its-own-marketplace))
**Versions observed:** `ab2286e1a846` → `edeea588bc01` across a real push
**Result:** criteria 1, 2, 3, 4, 6 and 7 **observed and met**; criterion 9 **not met as written** and not marked passed; criteria 5, 8 and 10 out of scope. Six drift items recorded.
**Scryfall traffic:** 1 call (H2) + 4 calls (H3), strictly sequential, no loops, no 429 provoked. The offline `tools/call` reached nothing by construction.

This slice's deliverable is the record, not code. The one code change is requirement 12's
`OWNER` substitution, which doubled as the update-loop payload.

## Check matrix — observed values

| [PC-02](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) criterion | Produced by | Observed | Result |
|---|---|---|---|
| 1 — connected after two commands, no extra command, file edit, or restart | `/plugin marketplace add njohnb/Manabase` → `/plugin install manabase@manabase` → `/mcp`, one session (human) | `plugin:manabase:mtg · √ connected · 1 tool`, in the **same session**, no restart | **MET** |
| 2 — zero configuration prompts | full install transcript (human) | No `userConfig` prompt of any kind. One harness-level install-**scope** selection (user vs project) — not a configuration prompt | **MET**, qualified |
| 3 — tools callable as `mcp__plugin_manabase_mtg__*` | session in a scratch dir (human) | `mcp__plugin_manabase_mtg__card_search`, 4 live calls succeeded | **MET** |
| 4 — starts and serves with no network | `offline-check.mjs` against the installed copy, network physically down (human-run, agent-verified) | handshake OK, `tools/list` → `["card_search"]`, both bracketing probes `ENOTFOUND` | **MET** |
| 6 — no file created or modified under `${CLAUDE_PLUGIN_ROOT}` | SHA-256 sweep before/after a real calls session (agent) | 3,819 → 3,818 files; **zero created, zero modified**; one harness lock file removed | **MET**, qualified |
| 7 — standalone cache path resolves with `CLAUDE_PLUGIN_DATA` unset | `resolveConfig` capture ×2 + offline standalone start (agent + human) | `C:\Users\User\AppData\Local\manabase`, no throw, **no directory created** | **MET** |
| 9 — `claude plugin validate . --strict` passes | both validate forms, verbatim (agent) | plain: 1 warning, exit 0. `--strict`: **fails**, exit 1, on that same warning | **NOT MET — see [The criterion 9 disposition](#the-criterion-9-disposition)** |

## Criteria evidence

Provenance is marked throughout: **(human)** = pasted session text, **(agent)** = machine-captured
CLI output. Criteria 1, 2 and 3 are claims about what a user types and is shown, so they can only
be the former.

### Cold-profile proof

Captured immediately before the install **(agent)**. `claude plugin list --json` contained one
unrelated entry (`dotnet-plugin@dotnet-plugin`) and no `manabase`;
`~/.claude/plugins/cache/` held only `dotnet-plugin`; `~/.claude/plugins/data/` held only
`lutz-data-inline`; `claude plugin marketplace list` had no `manabase`; and
`%LOCALAPPDATA%\manabase` did not exist.

This is a genuinely cold observation, and it is spent. The second belongs to
[Slice 12](./TrackC-Slice12.md)'s friend dry-run.

### Criterion 1 — two commands, connected, no restart

**(human)** In a session started in `C:\Users\User\manabase-scratch` — outside the working tree,
so requirement 7's trap is avoided; cwd confirmed in-transcript via `/status`:

```
> /plugin marketplace add njohnb/Manabase
  ⎿  Successfully added marketplace: manabase
```

No trust dialog and no prompt appeared. Between the add and the install, **(agent)**
`claude plugin marketplace list` confirmed the resolved marketplace *name* rather than assuming
it, and `claude plugin list --json` confirmed that adding a marketplace installs nothing:

```
  ❯ manabase
    Source: GitHub (njohnb/Manabase)
```

```
> /plugin install manabase@manabase
  ⎿  ✓ Installed Manabase. Plugin is now active.
```

Then, immediately, in the same session with no restart:

```
   Manage MCP servers
   6 servers

     Built-in MCPs (always available)
     plugin:manabase:mtg · √ connected · 1 tool
```

**Criterion 1 is met as written.** The half most likely to fail quietly — "no restart" — did not
fail: the server was connected in the installing session. Cross-checked outside the session
**(agent)** with `claude mcp list`:

```
plugin:manabase:mtg: node C:/Users/User/.claude/plugins/cache/manabase/manabase/ab2286e1a846/dist/index.js - ✔ Connected
```

### Criterion 2 — zero configuration prompts

**(human)** The evidence is negative, so it is stated rather than omitted: **no configuration
prompt of any kind appeared** during install or enable. `plugin.json` declares no `userConfig`
([P-13](../PLUGIN-PRD.md#p-13--no-user-configuration-in-phase-1)), so there was nothing to ask.
`--config` was never passed to any CLI installer, which would have invalidated the observation.

One prompt did appear and is recorded rather than suppressed: the installer **asked for the
install scope** (user vs project) before installing. That is a harness-level placement choice
present for every plugin, not a request for plugin configuration — no value, credential, or
setting of this plugin's was solicited. Criterion 2 is met on its own terms, with the scope
prompt disclosed.

### Criterion 3 — the scoped tool name

**(human)** Reported by the harness exactly as:

```
mcp__plugin_manabase_mtg__card_search
```

Precisely the `mcp__plugin_<plugin>_<serverkey>__<tool>` form
[P-12](../PLUGIN-PRD.md#p-12--plugin-name-and-server-key) fixes. The server registers the bare
`card_search` — confirmed independently by the offline `tools/list` — so the scoping is the
harness's doing, as designed.

Four live calls succeeded in a scratch-dir session (see
[criterion 6](#criterion-6--no-writes-under-claude_plugin_root)). Incidental corroboration of the
price traps through the installed plugin: `set:khm t:legendary` returned the five Alchemy
rebalanced printings labeled `digital-only` rather than as missing price data, and absent prices
rendered as `—`, never `$0`.

### Criterion 4 — offline start, against the installed copy

**(human-executed, agent-staged and agent-verified.)** Run against the **post-update**
`installPath`, not the repo working tree, with the machine's network physically off:

```
  installPath (arg)  C:\Users\User\.claude\plugins\cache\manabase\manabase\edeea588bc01
  dist SHA256        2806D8D31C9777C673D4F689F71A9CC363A6FB68C432CA2F7D584401BDF5FF68
  User-Agent marker  github.com/OWNER x0, github.com/njohnb x1
  CLAUDE_PLUGIN_DATA in spawn env:    false (deleted)

probe(before)  FAILED   TypeError: fetch failed  |  cause=Error: getaddrinfo ENOTFOUND api.scryfall.com  |  code(s)=ENOTFOUND
initialize   OK — server manabase-mtg@0.0.0, protocol 2025-06-18
initialized  sent
tools/list   ["card_search"]
             exactly one tool named card_search? true
tools/call   isError=true
{"error":{"code":"network","message":"Could not reach Scryfall: fetch failed"}}
             -> structured failure: code=network
tools/list   ["card_search"]
             server still alive after the call above: true
probe(after)   FAILED   TypeError: fetch failed  |  cause=Error: getaddrinfo ENOTFOUND api.scryfall.com  |  code(s)=ENOTFOUND

  NETWORK WAS DOWN FOR THE WHOLE WINDOW: true
  card_search listed with network down: true
```

**Criterion 4 is met.** Nothing in the startup path fetches — as
[P-09](../PLUGIN-PRD.md#p-09--server-ships-as-committed-built-javascript) says by construction
(esbuild `--bundle`, SDK a devDependency, bare `node` with no install step); this run is the
demonstration rather than the argument.

Two things make the capture trustworthy rather than merely asserted. The probes run in the same
runtime and against the same host a real `tools/call` would use, and they **bracket** the run, so
the network is proven down for the whole window rather than sampled once. And the probe was
validated online beforehand: in the Phase 0 dry run it **REACHED** `https://api.scryfall.com/`
(HTTP 400 from a HEAD, 177 ms) and the script correctly refused to call that capture a valid
offline one. A probe that never succeeds proves nothing; this one demonstrably does.

The `dist` SHA-256 in the log matches what `claude plugin list --json` reports for the installed
copy, tying the offline evidence to the shipped artifact.

### Criterion 6 — no writes under `${CLAUDE_PLUGIN_ROOT}`

**(agent)** Content-hash sweeps, taken with the identical literal
`$root = C:\Users\User\.claude\plugins\cache\manabase\manabase\ab2286e1a846`. The before-sweep
was deliberately taken *after* `claude mcp list` had spawned the server, and the after-sweep
after `/exit`, so the pair brackets a complete session lifecycle. That session **(human)** made
four real `card_search` calls, sequentially: `c:blue t:instant cmc<=2` (519 matches),
`t:goblin r:rare` (155), `o:"draw a card" t:enchantment` (354), `set:khm t:legendary` (42).

| Sweep | Files |
|---|---|
| before | **3,819** |
| after | **3,818** |

`Compare-Object` returned exactly one line — the complete delta:

```
InputObject                                                                        SideIndicator
-----------                                                                        -------------
\.in_use\36376	48	7652B4A5BB59D065443CCBF5FD8D864850FD789768BA574E0CF8D7546820AC58 <=
```

`<=` means present in *before* only: the file was **removed**, not added. It is a 48-byte
`.in_use\` lock file named for the exited session's PID — Claude Code's own reference counting,
released on session exit, written by the harness rather than by this server.

**Zero files were created and zero were modified.** Every one of the 3,818 surviving files
carried an identical SHA-256 across both sweeps, `dist\index.js` included. The substance of
criterion 6 — and of [P-06](../PLUGIN-PRD.md#p-06--cached-data-lives-in-the-plugin-data-directory)
— holds: the server writes nothing under `${CLAUDE_PLUGIN_ROOT}`.

Recorded precisely because this slice's own acceptance criterion 4 asks for an *empty*
`Compare-Object` and this one is not empty. It is one harness-owned deletion, not a write, and is
reported that way rather than rounded in either direction.

### Criterion 7 — standalone cache resolution, `CLAUDE_PLUGIN_DATA` unset

Resolution only; Phase 1 writes no cache, and nothing was added to `src/` to observe this.

**(agent)** Evidence part 1, the same resolution the entry point runs, importing the source
directly. Captured twice — before the `OWNER` fix and again after, as final-state evidence:

```json
{
  "userAgent": "manabase-mtg/0.0.0 (+https://github.com/njohnb/manabase)",
  "cacheDir": "C:\\Users\\User\\AppData\\Local\\manabase",
  "scryfallBaseUrl": "https://api.scryfall.com"
}
```

The `%LOCALAPPDATA%\manabase` branch resolved — not a throw, not a path beside the code — and
`Test-Path` after each run returned `False`: **no directory was created, because nothing creates
it.**

**(human)** Evidence part 2: the installed bundle started standalone with the variable deleted
from the spawn environment completed the handshake and listed tools (the criterion-4 run above),
so resolution does not abort startup. `%LOCALAPPDATA%\manabase` was ABSENT both before and after
that run too.

The durable evidence for the other platform branches remains `tests/config.test.ts`, which covers
`win32`, `darwin` and the XDG/`~/.cache` fallbacks against injected platform strings. The suite
was re-run in this session: **67 tests, 19 suites, 67 pass, 0 fail** (see
[Drift](#drift) item 4 on how it had to be invoked).

### The criterion 9 disposition

**(agent)** Both forms, verbatim. Plain — **exit 0**:

```
Validating marketplace manifest: C:\Projects\Manabase\.claude-plugin\marketplace.json

⚠ Found 1 warning:

  ❯ plugins[0] plugin.json → version: No version specified. Consider adding a version following semver (e.g., "1.0.0")

✔ Validation passed with warnings
```

`--strict` — **exit 1**:

```
Validating marketplace manifest: C:\Projects\Manabase\.claude-plugin\marketplace.json

⚠ Found 1 warning:

  ❯ plugins[0] plugin.json → version: No version specified. Consider adding a version following semver (e.g., "1.0.0")

✘ Validation failed (--strict treats warnings as errors)
```

**Disposition: no errors, exactly one warning, and that warning is the decision itself.** The
unset `version` is [P-08](../PLUGIN-PRD.md#p-08--version-scheme) working as intended, and it stays
unset until [Slice 13](./TrackC-Slice13.md). So
[PC-02](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) criterion 9 and
[P-08](../PLUGIN-PRD.md#p-08--version-scheme) are in direct conflict for the whole of Phase 1, as
is `CLAUDE.md`'s standing rule to run `--strict` before any push — that rule could not pass on
either PR in this slice, and was not engineered around.

**Criterion 9 is not marked passed.** A done-when has been added to
[Slice 13](./TrackC-Slice13.md) to re-run `--strict` once semver is set and expect a clean pass.

Whether criterion 9 should be reworded to exempt the pre-release window is **a question for this
PRD's owner, raised here and deliberately not answered** — no [§5](../PLUGIN-PRD.md#5-components)
criterion was edited by this slice.

## The [P-08](../PLUGIN-PRD.md#p-08--version-scheme) update loop

The payload was requirement 12's `OWNER` substitution, which makes "the new bytes actually
landed" a string check rather than a judgement call.

**The finding — no marketplace refresh was required.** First and only attempt, deliberately run
with no prior `claude plugin marketplace update` **(human)**:

```
> /plugin update manabase
  ⎿  √ Updated Manabase. Run /reload-plugins to apply.
```

The pushed commit was picked up directly. `claude plugin marketplace update manabase` was never
run by anyone at any point in this slice. Whether a refresh is a precondition of the SHA loop is
not stated in PLUGIN-PRD [§4.3](../PLUGIN-PRD.md#43-versioning-and-updates); for a `github`
source it is now answered in the negative, on this version.

**(agent)** Before and after, machine-captured from `claude plugin list --json`:

| | before | after |
|---|---|---|
| `version` | `ab2286e1a846` | `edeea588bc01` |
| `installPath` | `…\cache\manabase\manabase\ab2286e1a846` | `…\cache\manabase\manabase\edeea588bc01` |
| `dist\index.js` SHA-256 | `D2FE841AF7EF812159B032B1010529E988C931F4AD6883A773540CA33B87A5F2` | `2806D8D31C9777C673D4F689F71A9CC363A6FB68C432CA2F7D584401BDF5FF68` |
| `github.com/njohnb` in installed `dist` | 0 | **1** |
| `github.com/OWNER` in installed `dist` | 1 | **0** |

Both versions are commit SHAs and neither is `unknown`, so
[P-08](../PLUGIN-PRD.md#p-08--version-scheme)'s conditional fallback is **confirmed live** —
[P-11](../PLUGIN-PRD.md#p-11--the-repo-is-its-own-marketplace)'s relative `./` source inside a
git-hosted marketplace is what keeps this repo in the set where that fallback applies. The new
version equals `git rev-parse --short=12` of merge commit
`edeea588bc01d56c002fa86981821d634174471e`. **The width is 12 characters, not 40** — see
[Drift](#drift) item 1.

The bytes moved, not just the metadata. The previous `installPath` remains on disk, orphaned;
per [§4.3](../PLUGIN-PRD.md#43-versioning-and-updates) it is removed ~14 days later.

**Mid-session semantics** (requirement 11.5, observed rather than fought): the update output
itself said `Run /reload-plugins to apply`, and the reload was performed **(human)**:

```
> /reload-plugins
  ⎿  Reloaded: 2 plugins · 0 skills · 16 agents · 0 hooks · 1 plugin MCP server · 0 plugin LSP servers
```

`0 skills` is correct and expected: the `skills/scryfall-query-craft/` placeholder ships empty
until [Slice 8](./TrackB-Slice8.md).

**This observation is not permanent.** At [Slice 13](./TrackC-Slice13.md), explicit semver becomes
the cache key and a push *without* a bump ships nothing — correct then, wrong now. A future
reader must not treat today's every-commit-is-an-update behavior as the steady state.

## Who ran what

The slice is genuinely half interactive, and pretending otherwise would misreport the evidence.

| Half | Items | Instrument |
|---|---|---|
| Automatable, agent-run | criteria 6, 7, 9; all `claude plugin …` / `claude mcp list` captures; the sweeps; build, test, typecheck | shell |
| Human-in-the-loop | criteria 1, 2, 3; the [P-08](../PLUGIN-PRD.md#p-08--version-scheme) update loop; `/reload-plugins` | Claude Code session |

**Two deviations, both recorded rather than smoothed over:**

- **Criterion 4 was human-executed, not agent-executed.** The agent needs the network to think,
  so it cannot be running while the network is down. The script was agent-staged, dry-run online
  twice beforehand (once with zero Scryfall traffic to validate the pipeline, once as the
  positive control above), human-run offline, and agent-verified afterward from its self-written
  log. The script logs every line to a timestamped file as it goes, so a missed shell redirect
  could not lose the evidence.
- **PR A was opened by the human, not the agent.** `gh` is not installed on this machine, so
  `gh pr create` was unavailable; the agent pushed the branch and the human opened PR #13 from
  the branch-push URL. Every merge in this slice was the human's, as intended — the agent merged
  nothing.

## Not claimed by this slice

A reader must not conclude [PC-02](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) is done. Three of
its ten criteria are out of scope here.

- **Criterion 5** (`${CLAUDE_PLUGIN_DATA}` contents survive an update and are *still used*) —
  **not claimed.** Unverifiable while Phase 1 writes nothing: "still used" has no observer. Since
  the update loop ran anyway, a sentinel file was placed in
  `~/.claude/plugins/data/manabase-manabase/` and **survived the update byte-identical**
  (SHA-256 `D6F0770B60A54D3C59DB39697F41BC49CDD6BC48EB722929B0FE9128F424423D` before and after).
  That is a **supplementary harness observation, not criterion 5**, and the directory was created
  *manually* — see [Drift](#drift) item 3 for what was observed about its real creation.
- **Criterion 8** (unreachable upstream → structured failure, not a dead server) — **not
  claimed.** The offline `tools/call` returned `isError=true` with a structured
  `{"error":{"code":"network","message":"Could not reach Scryfall: fetch failed"}}`, and the
  server answered a further `tools/list` afterward. That is evidence *toward* criterion 8 and is
  recorded as such; no Phase 1 slice claims the criterion, and the box stays unticked.
- **Criterion 10** (`claude plugin details manabase` as the context-cost baseline) — **owned by
  [Slice 10](./TrackC-Slice10.md)**, with [PQ-01](../PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports)
  and [PQ-02](../PLUGIN-PRD.md#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed).
  The command was **never run** in this slice: a baseline taken before `SKILL.md` exists is one
  [Slice 8](./TrackB-Slice8.md) would immediately invalidate.

## Drift

Divergences from the 2026-07-29 harness research in PLUGIN-PRD
[§4](../PLUGIN-PRD.md#4-harness-and-delivery) and from this slice's own spec.
**[§4](../PLUGIN-PRD.md#4-harness-and-delivery) is a dated research record and was not
overwritten**; the divergences live here.

1. **The resolved plugin version is a 12-character abbreviated SHA, not 40.** Observed
   `ab2286e1a846` and `edeea588bc01`; both are correct prefixes of the corresponding 40-character
   commit SHAs, and the abbreviated form is also the cache directory name. Requirement 11.1 and
   this slice's acceptance criterion 3 both specify "a 40-character commit SHA", so that wording
   cannot be satisfied as written on Claude Code 2.1.221. The *substance* —
   [P-08](../PLUGIN-PRD.md#p-08--version-scheme)'s SHA fallback rather than the literal `unknown`
   — is confirmed. The `"version": "unknown"` failure mode could not be corroborated on this
   machine: the only other installed plugin reports a real semver.
2. **The installed plugin root contains `node_modules/` — the install path fetches
   dependencies.** The before-sweep's 3,819 files are 3,759 under `node_modules\`, 57 of repo
   content, and 3 harness lock files. `node_modules/` is line 1 of the repo's `.gitignore` and
   `git ls-files node_modules` returns 0 tracked files, so these cannot have come from the source
   tree. This does **not** contradict
   [P-09](../PLUGIN-PRD.md#p-09--server-ships-as-committed-built-javascript), whose claim is about
   the *startup* path — proven offline above — and the bundle remains self-contained. But "the
   SDK stays a devDependency so the server starts with no `node_modules`" describes the runtime,
   not the install, and the installed tree is ~66× larger in file count than the repo content it
   ships. Worth a decision before [Slice 12](./TrackC-Slice12.md)'s friend dry-run. No `.git`
   directory is present in the installed copy.
3. **`${CLAUDE_PLUGIN_DATA}` is created by the harness at install time, not on first reference.**
   PLUGIN-PRD [§4.5](../PLUGIN-PRD.md#45-persistent-data) and the interface-contract table say
   "created on first reference". Observed: absent at the cold check, then present with a
   directory creation time of `2026-08-04T18:05:34.101Z` — **four seconds after** the install's
   `installedAt` of `2026-08-04T18:05:30.224Z` — and **empty**. Nothing in this server referenced
   it. Benign, but the mechanism is not what the document describes.
4. **`npm test` does not run on this machine's Node.** The script is bare
   `node --test tests/**/*.test.ts`, and Node v22.17.1 does not strip TypeScript types without a
   flag (unflagged stripping lands in v22.18), so every test file fails with
   `ERR_UNKNOWN_FILE_EXTENSION`. Invoked as
   `node --experimental-strip-types --test "tests/**/*.test.ts"` it is clean: **67 tests, 19
   suites, 67 pass**. `package.json` declares `engines: >=18.0.0`, which understates the real
   floor for the test script. All test evidence in this document was taken via the flagged
   invocation. Not a product defect — the shipped bundle is unaffected — but a contributor
   running the documented command on a supported Node sees a wall of failures.
5. **The live `validate` warning prints as one unwrapped line**, not the two-line wrap quoted at
   `TrackB-Slice7.md:96-98`. Cosmetic; noted so a future session does not read the difference as
   a behavior change.
6. **The CRLF build-gate false alarm reproduced.** With `core.autocrlf=true` and no
   `.gitattributes`, `npm run build` writes LF into a CRLF checkout, so `git status` reports
   `dist/index.js` modified when the content is identical — the git blob hash was unchanged
   (`d8d49109f57d970f3d661f09d83b4c449cf7e330` before and after). `git diff` being empty is the
   discriminator; the checkout copy was restored rather than a no-op committed. Relevant to
   [PQ-06](../PLUGIN-PRD.md#pq-06--what-keeps-the-committed-dist-honest) and
   [Slice 11](./TrackC-Slice11.md).

Additionally, and not drift but documentation inconsistency worth closing: **PLUGIN-PRD
[§4.5](../PLUGIN-PRD.md#45-persistent-data) says criteria 5 *and* 7 "still require Slice 7", while
`docs/DEV-ROADMAP.md` assigns only 7 to this slice.** The roadmap is right — criterion 5 has no
observer while Phase 1 writes nothing. Flagged for the PRD's owner, not edited here.

## Harness notes

Things worth knowing that are nobody's acceptance criterion.

- **`/pwd` does not exist** in Claude Code 2.1.221 (`Unknown command: /pwd. Did you mean /cd?`).
  Session cwd was confirmed in-transcript with `/status`, which reports it.
- **`/plugin update manabase` ignores its argument.** It opened the plugin selector UI, and the
  update had to be driven by navigating *installed → manabase → update now*. The command
  completed correctly; it simply is not the non-interactive form its syntax suggests.
- **The marketplace clone lands in `~/.claude/plugins/marketplaces/<name>/`**, a sibling of
  `cache/`, not underneath it. The spec described only the
  `cache/<marketplace>/<plugin>/<version>/` layout for installed versions, which is accurate as
  far as it goes.
- **`/mcp` files the plugin server under the heading "Built-in MCPs (always available)"**
  alongside the harness's own servers, rather than in a plugin-specific group.
- **A `PostToolUse` hook fired and errored on the scoped tool name** during the criterion-6
  session: `PostToolUse:mcp__plugin_manabase_mtg__card_search hook error / Failed with
  non-blocking status code: No stderr output`. It is a pre-existing hook on this machine, not
  part of the plugin, and it was non-blocking — the call returned normally. It does independently
  corroborate [P-12](../PLUGIN-PRD.md#p-12--plugin-name-and-server-key)'s rule that the **scoped**
  name is what hook matchers bind to.
- **`claude mcp list` run from inside the working tree shows the expected project-scoped
  warning** — `[mtg] mcpServers.mtg: Missing environment variables: CLAUDE_PLUGIN_ROOT` — because
  the repo's own root `.mcp.json` declares a server keyed `mtg` that cannot start outside plugin
  context. Correct and expected; it is also exactly why every criterion-3 observation was taken
  from a scratch directory.
- **The `OWNER` substitution was minimal:** only the token was replaced, leaving the path segment
  lowercase (`https://github.com/njohnb/manabase`) while the repo's canonical name is
  `njohnb/Manabase`. GitHub resolves `owner/repo` case-insensitively, so the User-Agent gives a
  working contactable identity, but the two strings are not byte-identical.
- **This slice's final docs merge leaves the installed plugin one commit behind `main`.** That is
  expected under [P-08](../PLUGIN-PRD.md#p-08--version-scheme) and needs no action.
