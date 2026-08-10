# Track C — Slice 13 results: **the `PC-03` half only** — the first MCPB release

> **Read this heading literally.** [Slice 13](./TrackC-Slice13.md) is the release gate and it has
> **two halves**. This file records one of them. The
> [`P-08`](../PLUGIN-PRD.md#p-08--version-scheme) plugin switchover — `version` in `plugin.json`,
> the three update-semantics tests, `claude plugin tag --push`,
> [`PQ-05`](../PLUGIN-PRD.md#pq-05--should-the-plugin-be-submitted-to-the-community-marketplace-once-it-is-stable),
> and the [§9](../PLUGIN-PRD.md#9-revision-log) row that closes Phase 1 — **did not happen and is
> not recorded here.** It stays gated on [Slice 12](./TrackC-Slice12.md)'s friend dry-run.
> **Slice 13 is not closed.** Do not read this file as the release gate having passed.

Date: **2026-08-10**. Spec: [`TrackC-Slice13.md`](./TrackC-Slice13.md). Landed as **PR #37**
(merge `2c7196c`), released as tag **`v0.1.0`**.

**Outcome.** `https://github.com/njohnb/Manabase/releases/tag/v0.1.0` exists and carries
`manabase.mcpb`. It is the first downloadable artifact this project has ever produced, and the
first time [`.github/workflows/release.yml`](../../.github/workflows/release.yml) has executed at
all. [`PC-03`](../PLUGIN-PRD.md#pc-03--mcpb-bundle-for-the-chat-tab) criteria **7** and **10** are
verified. The bundle was installed on Claude Desktop from the released artifact and answered a card
question with a tool call.

**The tag names the bundle, not the plugin** — the distinction
[`PQ-09`](../PLUGIN-PRD.md#pq-09--how-does-the-mcpb-manifest-version-relate-to-p-08) settled and
[`docs/DEV-ROADMAP.md` §4](../DEV-ROADMAP.md#4-phase-1-slices) states. `.claude-plugin/plugin.json`
still carries **no** `version`, `package.json` is still `0.0.0`, and no plugin update semantics
changed. [Slice 12](./TrackC-Slice12.md) is undisturbed and its friend dry-run is unaffected.

## Why this ran before [Slice 12](./TrackC-Slice12.md)

The author wanted a downloadable bundle a friend could try on the Claude Desktop Chat tab without
waiting for the dry-run. [Slice 13](./TrackC-Slice13.md) bundles two things **by schedule, not by
dependency**:

| Half | Gated on [Slice 12](./TrackC-Slice12.md)? | Why |
|---|---|---|
| [`PC-03`](../PLUGIN-PRD.md#pc-03--mcpb-bundle-for-the-chat-tab) bundle release | **No** | The tag names the bundle. `plugin.json` is untouched, so nothing a plugin user experiences moves |
| [`P-08`](../PLUGIN-PRD.md#p-08--version-scheme) plugin switchover | **Yes** | [Slice 13](./TrackC-Slice13.md) Preconditions C requires the friend install recorded; Phase 1 closes on [`PC-01`](../PLUGIN-PRD.md#pc-01--scryfall-query-craft) + [`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) verified, and [`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server)'s evidence *is* the dry-run |

Attribution was decided with the author: this is **[Slice 13](./TrackC-Slice13.md) partially
executed**, not unscheduled work and not a new slice number.

## How this was run

Windows 11 dev machine, `core.autocrlf=true`. Local Node **v26.5.1**, npm **11.17.0**, `gh`
**2.95.0**, Claude Code **2.1.219**, `@anthropic-ai/mcpb` **2.1.2**. Runner: `ubuntu-latest`, Node
from [`.nvmrc`](../../.nvmrc) (**22**).

## Conditions block

| | |
|---|---|
| Branch that landed | `chore/pc03-first-release` → PR #37 → `main` |
| Released commit | `2c7196c` |
| Tag object | `525796a0edef848171fd9e313836da534585232c` → `2c7196c` |
| `dist/index.js`, committed blob | `1f06b68d26a8ae124c889ea380b822d313a48433` |
| `dist/index.js`, on disk | **557,298 bytes**, 15,798 lines |
| `dist/index.js`, sha256 | `c93080b369a713de4446a530cefc8a8d0bf17e42c085254f19dc60636ffce8c4` |
| `manabase.mcpb`, released | **111,760 bytes**, 2 files |
| Manifest `version` stamped | `0.1.0` |
| Test counts | **21 suites, 73 tests, 73 pass, 0 fail** |

## What was built

### `PC-03` criterion 7 — the packed-bundle byte-identity assertion

Criterion 7 was deferred out of [Slice 11](./TrackC-Slice11.md) and had no implementation. It now
lives in [`scripts/pack-mcpb.mjs`](../../scripts/pack-mcpb.mjs), not in a workflow step.

**The comparison is against the archive, never the staging tree.** `build/mcpb/server/index.js` is
`cpSync`'d from `dist/index.js` a few lines earlier in the same script, so comparing it would
assert that a copy equals its source — a tautology that would pass forever and detect nothing. The
script therefore unpacks the `.mcpb` it just wrote and hashes what came out.

Three properties of that placement, each deliberate:

- **One implementation, not two.** [`release.yml`](../../.github/workflows/release.yml) calls
  `npm run pack:mcpb`, so CI gets the assertion for free and there is no second copy to drift.
- **It runs on Windows.** `@anthropic-ai/mcpb`'s own `unpack` subcommand does the extraction, so no
  zip reader and no runner-provided `unzip` is involved. This matters because criterion 10 was
  CI-only *by necessity* — it could not be exercised on the author's machine — and criterion 7 is
  not subject to that limit.
- **A failed check deletes the bundle.** An installed `.mcpb` has no update path, so a rejected
  archive left on disk is a rejected archive somebody installs.

**Demonstrated in both directions before landing**, per [Slice 11](./TrackC-Slice11.md)'s rule that
a mechanism which has never failed has never been shown to work. A throwaway copy of the script
under gitignored `build/`, patched to stage `mcpb/manifest.json` as `server/index.js`:

```
pack-mcpb: the packed server/index.js is not the committed dist/index.js (PC-03 criterion 7).
  packed:    e7037242ffbe2691a117e87dc178d487dd60bf764e094c657c9c440b9ef9dc7a
  committed: c93080b369a713de4446a530cefc8a8d0bf17e42c085254f19dc60636ffce8c4
  the bundle has been deleted.
```

Exit **1**, and `build/manabase.mcpb` was absent afterward. An honest pack on the same commit
reported the matching sha256 and wrote the artifact.

### `release.yml` action pins

`checkout` and `setup-node` `@v4` → `@v7` (matching [`ci.yml`](../../.github/workflows/ci.yml),
which [Slice 11](./TrackC-Slice11.md) left on `@v7`), and `upload-artifact` → `@v7`. Bumped
**before** the workflow's first execution rather than after, so the run that cut the release was
not also the run that discovered a toolchain problem.

**One finding, learned the hard way.** `upload-artifact` was first bumped `@v4` → `@v5` to clear a
Node-20 deprecation annotation, and the rehearsal returned the identical annotation naming `@v5`.
Checked upstream: **v4 and v5 both declare `using: node20`; v6 is the first major on `node24`**, v7
is current. *Bumping a major is not evidence the runtime moved with it.* Corrected forward rather
than amended, so the wrong claim and its correction both stay in history.

## Rehearsing a workflow that had never run

[`release.yml`](../../.github/workflows/release.yml) had **never executed once** — not on a tag,
not manually. Its `workflow_dispatch` trigger plus the `if: github.ref_type == 'tag'` guard on the
*Attach to the Release* step make a branch dispatch a complete rehearsal: every step runs, nothing
irreversible is created.

| Run | Ref | `upload-artifact` | Result |
|---|---|---|---|
| `31420444992` | `chore/pc03-first-release` | `@v4` | success, **Attach skipped**, Node-20 annotation |
| `31420597276` | same | `@v5` | success, Attach skipped, **same annotation** |
| `31420745969` | same | `@v7` | success, Attach skipped, **zero annotations** |

Each stamped a dev version, confirming the untagged path: `MANABASE_BUNDLE_VERSION` empty →
`git describe` finds no tag → `0.0.0-dev+<shortSha>`.

The artifact from the clean rehearsal was downloaded and unpacked: exactly `manifest.json` and
`server/index.js`, and `server/index.js` sha256-identical to the local Windows `dist/index.js`.
**That is also an independent confirmation of [Slice 11](./TrackC-Slice11.md)'s `.gitattributes`
rule** — `dist/index.js text eol=lf` holds across the Windows working tree and the Linux runner, or
the two hashes could not match.

## Pre-flight, in the spec's order

[Slice 13](./TrackC-Slice13.md) requirement 1, run against the released commit `2c7196c`. An
installed `.mcpb` has no update path, so this artifact was gated exactly as the plugin tag would be.

| Ref | Check | Result |
|---|---|---|
| 1(a) | tree clean, on `main`, local == remote | ✅ |
| 1(b) | `typecheck && test && build`, then `git status` | ✅ 73 tests; `dist/` empty porcelain after rebuild — it was already current |
| 1(c) | [Slice 11](./TrackC-Slice11.md)'s check green on the exact SHA | ✅ run `31421343281` on `2c7196c` |
| 1(d) | `npm run acceptance` | ✅ **13/13 PASS, exit 0**, live, no 429 |
| 1(e) | **adapted** — see below | ✅ / known failure |
| 1(f) | disclaimer verbatim | ✅ **four** surfaces |
| 1(g) | offline `initialize` with no `node_modules` | ✅ three artifacts |
| 1(h) | `APP_VERSION` contact URL real | ✅ already satisfied |

### 1(b) — the stale-stat-cache quirk did not appear

`git status --porcelain -- dist/` was **empty** immediately after `npm run build`, on every run this
session. The ` M`-with-empty-diff behavior [`CLAUDE.md`](../../CLAUDE.md) records is intermittent,
not constant; `git diff` remains the discriminator.

### 1(d) — live acceptance, and one recorded drift

13/13 PASS against real Scryfall at `2026-08-10T18:49:46Z`, protocol `2025-06-18`, ≥600 ms spacing,
strictly sequential, no 429.

Check 11 reports **DRIFT** and still passes: no paper Black Lotus printing carries a USD price
upstream any more — the default printing resolves digital-only (Vintage Masters), and the paper
printing via `game:paper` (Unlimited Edition) returns `no-price-data` with EUR only. This is the
condition [`CLAUDE.md`](../../CLAUDE.md) already records as of 2026-08-03, **not new drift**, and
the check passes precisely because the reason is reported honestly rather than as missing data.

### 1(e) — the adaptation, and the failure that is correct

The spec's 1(e) is `claude plugin validate . --strict`. **That gates the plugin release, not the
bundle**, and it fails today on exactly one warning:

```
❯ plugins[0] plugin.json → version: No version specified.
```

That is [`P-08`](../PLUGIN-PRD.md#p-08--version-scheme)'s deliberately unset `version` and the same
reason [`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) criterion 9 is open. It closes with the
other half of this slice, not here. Non-strict validation **passes with that single warning**.

The bundle's equivalent gate is `mcpb validate mcpb/manifest.json`, which **passes**.

### 1(f) — the disclaimer has a fourth surface

[`PLUGIN-PRD.md` §3.5](../PLUGIN-PRD.md#35-what-the-user-must-see-and-must-not) names three
surfaces and [Slice 12](./TrackC-Slice12.md)'s script checks three.
[`mcpb/manifest.json`](../../mcpb/manifest.json)'s `description` is a **fourth** user-facing
surface — Claude Desktop renders it in the install dialog the user approves
([`PC-03`](../PLUGIN-PRD.md#pc-03--mcpb-bundle-for-the-chat-tab) criterion 5). All four verbatim,
whitespace-normalized:

```
plugin.json description            OK
marketplace entry description      OK
mcpb/manifest.json description     OK
README                             OK
manifest == marketplace entry      OK
bundle desc == plugin desc         OK
```

The three JSON `description` fields are **byte-identical to each other**, which is a stronger result
than [§3.5](../PLUGIN-PRD.md#35-what-the-user-must-see-and-must-not) requires. This is recorded, not
proposed as a requirement change — [§3.5](../PLUGIN-PRD.md#35-what-the-user-must-see-and-must-not)
is locked.

### 1(g) — offline start, three artifacts

An `initialize` handshake plus `tools/list` against a server spawned with its working directory set
to a fresh temp directory containing no `node_modules`. Run against the committed `dist/index.js`,
the CI rehearsal artifact's server, and **the downloaded public release asset**. All three:
`protocolVersion` `2024-11-05`, `serverInfo` `manabase-mtg@0.0.0`, `tools` `["card_search"]`.

## The release

Tag `v0.1.0` pushed to `2c7196c`; run **`31421682409`**.

*Attach to the Release* **ran** — the step skipped on all three rehearsals and fired on the tag,
which is the guard behaving as designed in both directions.

| | |
|---|---|
| Release | `v0.1.0`, published `2026-08-10T18:57:43Z`, not draft, not prerelease |
| Asset | `manabase.mcpb`, 111,760 bytes |
| `MANABASE_BUNDLE_VERSION` | `v0.1.0` → manifest `"version": "0.1.0"` (leading `v` stripped) |
| Criterion 7 in the release run | passed, `c93080b3…` |

The **published asset** was then downloaded and checked independently of CI: exactly
`manifest.json` + `server/index.js`; `display_name` `"Manabase"`, which is where the Chat tab's
`Manabase:card_search` prefix comes from; disclaimer verbatim; and `server/index.js` sha256-identical
to the committed `dist/index.js`.

**The bundle's `serverInfo.version` reports `0.0.0` while its manifest says `0.1.0`, and that is
correct.** `APP_VERSION` tracks `package.json`, which is independent of the bundle version by design
([`D-02`](../MCP-PRD.md#d-02--runtime-nodejs--typescript),
[`P-09`](../PLUGIN-PRD.md#p-09--server-ships-as-committed-built-javascript)). Two of the four
version-bearing surfaces in [Slice 13](./TrackC-Slice13.md)'s interface-contracts table, behaving as
specified. It looks like a mismatch and is not one.

## Installed on Claude Desktop, from the released artifact

`manabase.mcpb` downloaded from the release and installed through **Settings → Extensions →
Advanced settings → Install Extension…**. `Manabase:card_search` appears in the Chat tab and a card
question **called the tool**.

[`PC-03`](../PLUGIN-PRD.md#pc-03--mcpb-bundle-for-the-chat-tab) criteria 3–6 were verified
2026-08-04 against a **hand-packed** bundle. This run re-confirms 3 and 4 against the **released**
one — the artifact a friend actually downloads. **No criterion changes status or date on that
basis**; it is corroboration of an existing pass, recorded here because the artifact under test was
not the same artifact.

## Criteria status

| Criterion | Before | After |
|---|---|---|
| [`PC-03`](../PLUGIN-PRD.md#pc-03--mcpb-bundle-for-the-chat-tab) 7 — packed bundle byte-identical to committed `dist/` | unverified | **verified 2026-08-10** |
| [`PC-03`](../PLUGIN-PRD.md#pc-03--mcpb-bundle-for-the-chat-tab) 10 — `v*` tag produces a Release with the asset, built by CI, gated on a `dist/` rebuild | unverified | **verified 2026-08-10** |

Nothing else moved. [`PC-01`](../PLUGIN-PRD.md#pc-01--scryfall-query-craft),
[`PC-02`](../PLUGIN-PRD.md#pc-02--bundled-mcp-server) and
[`CAP-01`](../MCP-PRD.md#cap-01--card-search) are untouched.

## What did **not** happen

- **No [`P-08`](../PLUGIN-PRD.md#p-08--version-scheme) switchover.**
  `.claude-plugin/plugin.json` carries no `version`; `grep '"version"'
  .claude-plugin/marketplace.json` still returns nothing; `package.json` is still `0.0.0` and
  `APP_VERSION` still matches it.
- **No update-semantics tests** ([Slice 13](./TrackC-Slice13.md) requirements 7–9). They require the
  switchover.
- **No `claude plugin tag`.** Its tag-name format remains unrecorded.
- **[`PQ-05`](../PLUGIN-PRD.md#pq-05--should-the-plugin-be-submitted-to-the-community-marketplace-once-it-is-stable)
  has no disposition**, and Phase 1 is **not** closed.
- **[`PQ-06`](../PLUGIN-PRD.md#pq-06--what-keeps-the-committed-dist-honest) did not move in either
  half.** Its commit half was already answered by [Slice 11](./TrackC-Slice11.md). Its user-facing
  half — an installed `.mcpb` carries its `dist/` until someone reinstalls — is **untouched**, and
  shipping a bundle that real people install arguably sharpens it rather than easing it.

## Traps for the next session

1. **`v0.1.0` is spent.** [Slice 13](./TrackC-Slice13.md) requirement 10's `claude plugin tag`
   writes into the same `v*` namespace [`release.yml`](../../.github/workflows/release.yml)
   watches. If that command emits `v<semver>`, **it will fire the release workflow and cut a second
   bundle release.** Discover its tag format with `--dry-run` before pushing, as the spec already
   requires, and pick a version string that has not been used.
2. **This file is not a Slice 13 closeout.** The [§9](../PLUGIN-PRD.md#9-revision-log) row that
   closes Phase 1 is still unwritten and belongs to the other half.
3. **`upload-artifact@v6` is the floor for `node24`**, not `@v5`. See above.
4. **A released bundle cannot be withdrawn.** A defect ships as a new version and a new tag; never
   move or delete `v0.1.0`.

## References

- Spec: [`TrackC-Slice13.md`](./TrackC-Slice13.md). Deferrals inherited from
  [`TrackC-Slice11.md`](./TrackC-Slice11.md) and its
  [results](./TrackC-Slice11-results.md).
- [`PC-03`](../PLUGIN-PRD.md#pc-03--mcpb-bundle-for-the-chat-tab),
  [`P-14`](../PLUGIN-PRD.md#p-14--two-distribution-targets-one-source),
  [`PQ-09`](../PLUGIN-PRD.md#pq-09--how-does-the-mcpb-manifest-version-relate-to-p-08),
  [`PQ-06`](../PLUGIN-PRD.md#pq-06--what-keeps-the-committed-dist-honest),
  [`P-08`](../PLUGIN-PRD.md#p-08--version-scheme),
  [`P-09`](../PLUGIN-PRD.md#p-09--server-ships-as-committed-built-javascript).
- [`docs/DEV-ROADMAP.md` §4](../DEV-ROADMAP.md#4-phase-1-slices) — Slice 11's deferral list, three
  items of which this session closed.
