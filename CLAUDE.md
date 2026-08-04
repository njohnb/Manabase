# Manabase

Magic: The Gathering research for Claude Code: a bundled stdio MCP server (Node + TypeScript)
plus the skills that let Claude write real Scryfall queries from plain English. Distributed as a
Claude Code plugin; this repo is also its own marketplace.

## The documents are binding — read them before deciding anything

Three documents in `docs/`, and they outrank this file and the code:

| Document | Owns |
|---|---|
| `docs/MCP-PRD.md` | What the server does — tools, data sources, capability behavior, acceptance criteria. Decisions `D-01`…`D-12`, capabilities `CAP-0N`, open questions `OQ-0N`. |
| `docs/PLUGIN-PRD.md` | What the user installs — packaging, install, config, skills. Decisions `P-01`…`P-13`, components `PC-0N`, open questions `PQ-0N`. |
| `docs/DEV-ROADMAP.md` | Sequencing **only** — 13 slices, dependency graph, status. If it disagrees with a PRD, the PRD wins; fix the roadmap. |

**The boundary rule** (PLUGIN-PRD §1, reproduced verbatim there and paraphrased nowhere):
MCP-PRD owns what the server can do; PLUGIN-PRD owns what the user installs and experiences. A
tool spec never appears in the plugin PRD; an install step never appears in the MCP PRD.

Consequences that bind every session:

- **Never duplicate a decision — reference it by ID.** Duplicated decisions drift and a later
  session cannot tell which copy is current.
- **§2 and §3 of both PRDs are locked.** Inherited, not re-litigated. §4 is a dated research
  record: every claim is marked verified or inferred. Do not overwrite it when reality changes —
  append a dated addendum, as `§4.1.3` does.
- **Adding a capability means appending a `CAP` block and updating §6, §7, §9. Nothing else.**
  Same for a `PC` block in PLUGIN-PRD. The templates are at the top of each §5.
- **If a slice resolves an open question, update the owning PRD in the same session** — its §7
  entry and a §9 revision-log row. The roadmap's status column is not a substitute.
- **If a plugin component would need the server to do something it doesn't do yet, that is a CAP
  in MCP-PRD, not a PC.** Say so and stop; do not spec around it.

`docs/slices/` holds per-slice specs and the Slice 6 live-acceptance results. `docs/prompts/`
holds the planning prompts that generated the PRDs.

## Commands

```
npm run build       # esbuild bundle -> dist/index.js (self-contained, no runtime deps)
npm run typecheck   # tsc --noEmit
npm test            # node --experimental-strip-types --test  (67 tests, 19 suites)
npm run acceptance  # scripts/cap01-live.mjs — 13 LIVE checks against real Scryfall
```

`claude plugin validate . --strict` before any push a friend might install from.

`npm run acceptance` hits the real API. It is deliberately slow (≥600 ms between calls) and must
stay that way — see the rate-limit rule below.

## Architecture

```
src/index.ts            entry point — the ONLY module that may read process.env/process.platform
src/config.ts           resolveConfig(env, platform) — User-Agent, cacheDir, base URL
src/result.ts           Result<T> = Success<T> | Failure; FailureCode union
src/scryfall/client.ts  the one HTTP module: headers, two rate-limit lanes, 429 backoff
src/scryfall/prices.ts  resolvePrice() — the three price traps
src/scryfall/types.ts   minimal wire shapes; only fields actually read
src/tools/card-search.ts  cardSearch() — query in, shaped CardSearchData out
src/tools/register.ts     tool definitions + dispatchToolCall + registerTools
tests/                  handlers called as plain functions; fixtures under tests/fixtures/
dist/index.js           committed build output — NOT gitignored
```

Data flows one way: `index.ts` builds config → creates the client → `registerTools` wires the SDK
handlers to `dispatchToolCall` → `cardSearch` → `client.get`. Nothing below `index.ts` touches
global state, so every layer is testable by passing a fake.

## Rules that are easy to violate by accident

**Never deliberately provoke an HTTP 429 against Scryfall.** (MCP-PRD §3.4.) A 429 locks access
for 30 seconds and sustained overage risks banning the application for every user of it. Card
endpoints (`/cards/search|named|random|collection`) are capped at 2/sec, everything else at
10/sec; the client enforces this with two lanes and a 30-second backoff-then-one-retry. The
CAP-01 criterion covering 429 handling therefore rests on a mock permanently — that is correct,
not a gap.

**Every outbound request carries the app-naming `User-Agent` and an `Accept` header.** Default
library agents are explicitly disallowed by Scryfall.

**Handlers never throw** (`D-10`). Every failure is a structured `Failure` carrying Scryfall's
verbatim `details` so the model can fix a bad query and retry. The single deliberate exception is
an unknown tool name in `dispatchToolCall`, which is harness misuse rather than a model error.

**Config is read once at the entry point and passed down** (`D-03`, MCP-PRD §3.2). No
`process.env` below `index.ts`, no per-user state in module-level variables, and no abstraction
layer built to achieve this (`D-04` — the SDK's transport object is already the abstraction).

**`dist/` is committed on purpose and must be rebuilt with every `src/` change** (`P-09`). It is
what `.mcp.json` starts. Shipping a stale or absent `dist/` produces a plugin whose tools are
simply *absent* with no error — the least debuggable failure this project has. Keeping it honest
is open question `PQ-06` (Slice 11).

**Keep the MCP SDK a devDependency.** The build bundles it; that is what makes the server start
with no network and no `node_modules`.

**Never document or demonstrate adding the marketplace by raw URL to `marketplace.json`**
(`P-11`'s trap). It downloads only that one file and the relative plugin source silently fails to
resolve. Always `owner/repo`.

**The Fan Content disclaimer is required verbatim** on every user-facing surface: `plugin.json`
`description`, the marketplace entry, and the README (MCP-PRD §3.3, PLUGIN-PRD §3.5).

**Skills carry instructions, never card facts** (PLUGIN-PRD §3.6). No oracle text, prices,
legality, or combo claims asserted in a skill — those are reached by calling the server.

**Only `plugin.json` and `marketplace.json` live in `.claude-plugin/`.** Component directories
(`skills/`, etc.) sit at the repo root; a component placed inside `.claude-plugin/` silently fails
to load. Installed plugins also cannot reference `../` paths.

**Tools are exposed to the harness as `mcp__plugin_manabase_mtg__card_search`** (`P-12`). That
scoped form is what permission rules, `allowed-tools`, and hook matchers must use — a matcher
written against the bare server key never fires. The code itself registers the bare
`card_search`; scoping is the harness's job.

**`package.json` `version` and the plugin version are independent by design.** Do not sync them.
`plugin.json` deliberately has no `version` during development (`P-08`). `APP_VERSION` in
`config.ts` does have to be kept in sync with `package.json` by hand — the bundle cannot read
`package.json` at runtime.

## TypeScript conventions

`tsconfig.json` is strict in ways that shape the code:

- **`exactOptionalPropertyTypes`** — an optional property must be *absent*, never assigned
  `undefined`. Hence the conditional-spread idiom throughout (`...(x !== undefined ? { x } : {})`)
  rather than plain assignment.
- **`allowImportingTsExtensions`** — intra-project imports carry the `.ts` extension
  (`./config.ts`). SDK imports keep `.js`.
- **`verbatimModuleSyntax`** — type-only imports must say `import type`.
- **`noUncheckedIndexedAccess`**, **`noEmit`** — `tsc` only typechecks; esbuild does the build.

Tests use `node:test` + `node:assert/strict`, and load fixtures with `readFileSync` rather than
importing JSON, so they behave identically under type stripping and under the bundle.

## Current state (2026-08-04)

Track A is complete: Slices 1–6 shipped as PRs #2–#7 and `CAP-01` (card search) is **delivered**,
with all twelve acceptance criteria verified — nine live against real Scryfall.

Track B has started. Slice 7 (install verification) landed 2026-08-04 as PRs #13 and #14: the
plugin **has** now been installed from a marketplace on a cold profile, and six of `PC-02`'s ten
acceptance criteria (1, 2, 3, 4, 6, 7) are verified against a real harness. Criterion 9 is
deliberately not met — `claude plugin validate . --strict` fails on the one warning that is
`P-08`'s unset `version`, so it stays open until Slice 13. Evidence:
`docs/slices/TrackB-Slice7-results.md`.

Track C has not started, and the rest of what a user installs is still missing.
`skills/scryfall-query-craft/SKILL.md` is unwritten and no context-cost measurement exists — so
every `PC-01` criterion, and `PC-02`'s criteria 5, 8 and 10, are still unverified.

Next on the critical path is Slice 9 (evals), which needs Slice 8. Three slices are unblocked — 8,
10 and 11 — but 10 should wait for 8, since a context baseline measured before `SKILL.md` exists is
one Slice 8 immediately invalidates. `docs/DEV-ROADMAP.md` §5 has the graph.

## Price handling — the three traps

`resolvePrice` exists because reading `usd` alone is wrong:

1. **`eur_etched` does not exist** in the live API even though the docs list it. Do not model it.
2. **`usd` null while `usd_foil` or `usd_etched` is populated is common** (7,599 and 1,074 cards),
   not an edge case. Resolution order is `usd` → `usd_foil` → `usd_etched`, with the finish
   labeled.
3. **Digital printings win name lookups and search rollups** and carry no paper prices — a plain
   `!"Black Lotus"` returns the MTGO printing. Digital is checked *first* and reported as
   `digital-only`, never as "no price data".

Prices stay strings. A missing price is reported as missing, never as `$0`. Whether to fall back
to EUR when no USD exists is open question `OQ-09` — as of 2026-08-03 no paper Black Lotus
printing carries a USD price at all.

Also non-obvious: **Scryfall answers a valid query with zero matches as HTTP 404.** `cardSearch`
maps that to a successful empty result, because "no cards match" is a search outcome, not a
failure.

## Editing the docs

The three documents are densely cross-linked (`724` internal links, `673` of them to a heading
anchor; measured 2026-08-04) using GitHub heading anchors:
same-file as `#anchor`, cross-file as `./MCP-PRD.md#anchor`. **Renaming a heading breaks every
link pointing at it.** If you rename one or add links in bulk, verify the anchors resolve rather
than assuming — the slug rules are unforgiving (em dashes become a doubled hyphen, e.g.
`#d-01--distribution-local-package-over-stdio`).

**Every reference inside `docs/` and `README.md` is navigable.** A `§`, an ID (`D-`, `P-`, `CAP-`,
`PC-`, `OQ-`, `PQ-`), a slice number, or a repo path mentioned in prose is a markdown link to the
thing it names — same-file `#anchor`, cross-file `./MCP-PRD.md#anchor`, and a slice always to its
spec, `[Slice 8](./slices/TrackB-Slice8.md)` (`./TrackB-Slice8.md` from inside `docs/slices/`,
`./docs/slices/…` from `README.md`). Backticks are not a link. Adding a reference and linking it
are the same edit, never a follow-up. Inside those files there are two carve-outs and no others:
fenced code blocks, and `docs/prompts/**`, which are verbatim historical artifacts carrying zero
links by design.

**The rule is scoped to what a human navigates, and it stops at two hard edges.** It is not a
project-wide style preference, and extending it to the whole repo would be wrong in both
directions:

- **`skills/` must not link out of the skill directory.** An installed plugin cannot reference
  files outside its own directory — `../` paths break after install (PLUGIN-PRD §3.3, §4.1). A
  link to `../../docs/MCP-PRD.md` resolves in the repo and is dead in every installed copy, which
  is the invisible-failure class this project already pays for elsewhere. Skills cite by ID in
  plain text, and their supporting files live *inside* the skill directory.
- **`CLAUDE.md` stays bare on purpose.** This file is loaded whole into every session, so every
  character is always-on context cost — and a link costs roughly `73` characters against a `6`
  character ID. Linking its references would grow it by about a fifth to serve a reader that
  greps rather than clicks. Context budget is a live question here (`PQ-01`, `PQ-02`, Slice 10),
  so this is a measured trade, not an oversight. Cite by ID and let the reader search.

A few `§` references are deliberately left unlinked where the sentence means "the owning PRD" or
"both PRDs" — linking them would assert a specific document and be wrong. Leave them bare. That
carve-out covers a bare `§` and nothing else — an ID, a slice number, or a path always names one
file and is always linked.

## Closing out a slice

**A slice is not finished until the documents say so — dispatch the `doc-sync` subagent as the
final step.** When a slice or plan completes and its own artifacts are written, launch `doc-sync`
(`.claude/agents/doc-sync.md`) before reporting back. Hand it the slice or plan identifier, the
commits or PRs, which acceptance criteria are now verified and with what evidence, and any open
question the work resolved. It reconciles `docs/DEV-ROADMAP.md`, `docs/MCP-PRD.md`,
`docs/PLUGIN-PRD.md`, this file, and `README.md`.

**It appends and updates status; it decides nothing.** It may not edit §2 or §3 of either PRD, may
not rewrite §4, and may not rename a heading or change an ID. Where the work implies a change only
a locked section can express, it stops and reports — that is the session's call with the user.

**Dispatch it even when you believe nothing changed, and review its diff before committing.** The
failure this prevents is a verified criterion surviving only in a transcript; the second is a
subagent's plausible paraphrase landing unread in a binding document.

`.claude/` is dev-only config, not a plugin component surface — the agent lives there deliberately.
A subagent under a root `agents/` would install into every user's harness (`P-07`).

## Environment

Windows dev machine with `core.autocrlf=true` and no `.gitattributes`: the working tree is CRLF
while git blobs are LF. Scripted edits to the markdown files must preserve CRLF, or the diff shows
the whole file as changed.
