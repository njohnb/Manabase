# Manabase

Magic: The Gathering research for Claude Code: a bundled stdio MCP server (Node + TypeScript)
plus the skills that let Claude write real Scryfall queries from plain English. Distributed as a
Claude Code plugin, and — since `P-14` — as an MCPB bundle for the Claude Desktop Chat tab, both
built from this one source tree. This repo is also its own marketplace.

## The documents are binding — read them before deciding anything

Three documents in `docs/`, and they outrank this file and the code:

| Document | Owns |
|---|---|
| `docs/MCP-PRD.md` | What the server does — tools, data sources, capability behavior, acceptance criteria. Decisions `D-01`…`D-12`, capabilities `CAP-0N`, open questions `OQ-0N`. |
| `docs/PLUGIN-PRD.md` | What the user installs — packaging, install, config, skills. Decisions `P-01`…`P-13`, components `PC-0N`, open questions `PQ-0N`. |
| `docs/DEV-ROADMAP.md` | Sequencing **only** — 14 slices, dependency graph, status. If it disagrees with a PRD, the PRD wins; fix the roadmap. |

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
npm run lint:docs   # scripts/check-doc-links.mjs — every link and anchor in docs/ + README.md
npm test            # node --experimental-strip-types --test  (101 tests, 27 suites)
npm run acceptance  # scripts/cap01-live.mjs — 13 LIVE checks against real Scryfall
npm run pack:mcpb   # stage + stamp + pack build/manabase.mcpb (PC-03)
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

**Never defeat a third party's bot protection.** (MCP-PRD §3.7, added `D-13`–`D-15`.) No
`cloudscraper` or Cloudflare-challenge solver, no headless browser, no browser-impersonating or
rotating `User-Agent`, no TLS spoofing — and no exception for "it was the only thing that
worked." Archidekt and Moxfield are both undocumented and publish no terms; that is not
permission. A block is an answer: degrade and report it. This is easy to violate because the
top search result for Moxfield's API is a working `cloudscraper` proxy, and because Moxfield
grants `User-Agent` whitelists through support — so identify honestly, and ask (`OQ-10`) rather
than route around. Live probes during research obey the same rule: single spaced calls.

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
simply *absent* with no error — the least debuggable failure this project has. Since Slice 11
(2026-08-09) `.github/workflows/ci.yml` enforces it on every pull request and every push to
`main` — `npm ci` → `lint:docs` → typecheck → test → rebuild → fail on a non-empty
`git status --porcelain -- dist/`. CI reports the omission, it does not repair it, so the rule
still binds; a forgotten rebuild is now a red run rather than a silent one. That closes `PQ-06`'s
commit half only — its user-facing half stays open, because an installed `.mcpb` carries its
`dist/` until someone reinstalls.

**Keep the MCP SDK a devDependency.** The build bundles it; that is what makes the server start
with no network and no `node_modules`.

**Never document or demonstrate adding the marketplace by raw URL to `marketplace.json`**
(`P-11`'s trap). It downloads only that one file and the relative plugin source silently fails to
resolve. Always `owner/repo`.

**The Fan Content disclaimer is required verbatim** on every user-facing surface: `plugin.json`
`description`, the marketplace entry, and the README (MCP-PRD §3.3, PLUGIN-PRD §3.5).

**Skills carry instructions, never card facts** (PLUGIN-PRD §3.6). No oracle text, prices,
legality, or combo claims asserted in a skill — those are reached by calling the server.

**Skill frontmatter is YAML, so quote any value containing a colon-space.** An unquoted YAML
plain scalar cannot contain `": "` — `description: Magic: The Gathering …` does not parse, and a
skill whose frontmatter fails to parse is dropped with no error on any surface. `/reload-plugins`
reports `0 skills` in the working state too, so its count proves nothing; the session skill
listing is the only signal. `npm test` now parses every `skills/**/SKILL.md` and is the check
that catches this.

**Only `plugin.json` and `marketplace.json` live in `.claude-plugin/`.** Component directories
(`skills/`, etc.) sit at the repo root; a component placed inside `.claude-plugin/` silently fails
to load. Installed plugins also cannot reference `../` paths.

**The scoped tool name is built per surface and is not a property of the server** (`P-12`, as
amended by `P-14`). In Claude Code it is `mcp__plugin_manabase_mtg__card_search`, and that form is
what permission rules, `allowed-tools`, and hook matchers must use — a matcher written against the
bare server key never fires. Arriving by MCPB it is `Manabase:card_search`, scoped from the
manifest's `display_name`. Same registered `card_search` either way; the code registers the bare
name and scoping is the harness's job. Two traps follow: never write the scoped string into a
skill or anything else that travels between surfaces, and never use it to test whether the tool is
present — that test reports "absent" on a surface where the tool works.

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

## Current state (2026-08-10)

Track A is complete: Slices 1–6 shipped as PRs #2–#7 and `CAP-01` (card search) is **delivered
against criteria 1–14**. Criteria 1–12 were verified 2026-08-03, nine live against real Scryfall;
criterion 13 was added 2026-08-04 and stayed unimplemented until Slice 14 landed both of `OQ-02`'s
levers on 2026-08-10, adding a criterion 14 for the page cap — see the Slice 14 note below.

Track B has started. Slice 7 (install verification) landed 2026-08-04 as PRs #13 and #14: the
plugin **has** now been installed from a marketplace on a cold profile, and six of `PC-02`'s ten
acceptance criteria (1, 2, 3, 4, 6, 7) are verified against a real harness. Criterion 9 is
deliberately not met — `claude plugin validate . --strict` fails on the one warning that is
`P-08`'s unset `version`, so it stays open until Slice 13. Evidence:
`docs/slices/TrackB-Slice7-results.md`.

Slice 8 (skill authoring) landed 2026-08-04 as PR #19: `skills/scryfall-query-craft/SKILL.md` and
its `reference/operators.md` and `reference/recipes.md` are written, and `PC-01`'s static criteria
1, 3 and 4 are verified — 2,169 of 5,000 body tokens, and a no-card-facts review by a fresh
reviewer with no authoring context that returned zero flags. Evidence:
`docs/slices/TrackB-Slice8-results.md`.

**Qualify all three of those ticks.** A same-day follow-up (`fix/skill-frontmatter-yaml`,
`ed82ceb`, PR #22) found that `SKILL.md`'s YAML frontmatter did not parse: `description` and
`when_to_use` both carried the unquoted `Magic: The Gathering`, and an unquoted YAML plain scalar
cannot contain a colon-space, so the block threw and `/reload-plugins` reported `0 skills` for an
installed plugin with all three files present on disk. **The skill loaded in no harness.** Quoting
both values fixes it, verified loaded as `manabase:scryfall-query-craft`; line endings were tested
and ruled out. **Never treat `/reload-plugins`' skill count as the signal** — it reads `0 skills`
in the working state too. The session skill listing is what discriminates. Criteria 1, 3 and 4 are all
satisfiable by reading and measuring the file, so a skill that never loaded passed all three —
they are static checks, not evidence the skill works. **The 763 / 783 / 764 spread is resolved**
(Slice 9): `description` 269 + `when_to_use` 494 = **763**, which is what criterion 1 measures;
adding `name` (20) gives 783; Slice 8's 764 is a one-off arithmetic slip on its own 269 + 494. No
measurement was wrong, the labels were — and the dated Slice 8 results and PRD rows keep their
figures as written. Slice 9 confirmed the skill actually loads before recording numbers; Slice 10
must still do the same. Whether `PC-01` needs a loads-in-a-harness criterion, or a new `PQ`, is
open and undecided — `docs/PLUGIN-PRD.md` §9 raises it.

Slice 8 also verified live that **Scryfall
silently drops an invalid term whenever at least one valid term remains** — the "All of your terms
were ignored." 400 fires only when every term is invalid, so a hallucinated operator returns an
ordinary-looking result computed from fewer constraints. The skill files teach that; never emit an
operator you have not seen work.

Slice 9 (evals) landed 2026-08-04 on `main`: `evals/evals.json` (17 behavioral cases,
`skill-creator` schema, key `expectations`) and `evals/trigger-evals.json` (20 queries), each case
in a fresh isolated subagent, sequential, one run per configuration, 93 live Scryfall calls and no
429. Evidence: `docs/slices/TrackB-Slice9-results.md`. `PC-01` criteria 5–11 and 13 are verified
with a without-skill baseline — valid query 15/15 vs 15/15, legality+type+cost+price 3/3 vs 3/3,
regex 3/3 vs 3/3, `otag:`/`function:` **3/3 vs 2/3**, artwork 3/3 vs 3/3, `illustrationtag:`
unprompted 0 in both over 15 cases each, trigger 10/10 and 10/10, card fact → tool call 3/3 vs 3/3.
**Criterion 12 is *not measured* with the skill** — never a fail: its probe hands over
`illustrationtag:`, `SKILL.md` names that unreal, so no error was produced to retry from; the
baseline scored 4/4. The description was tuned 0 times, so the frontmatter is unchanged.

**That answers `OQ-01`: the compact-description split holds and `src/tools/register.ts` is
unchanged.** Do not overstate it. The shipped description already names `t:`, `o:`, `f:`, `cmc`,
`usd`, `otag:`, `art:` and regex, so the baseline was well-equipped and the skill's measured
contribution is narrower than "it carries the operator families" — it wins where the user names an
effect the tag vocabulary does not echo, it prevents a known-bad operator, and it keeps constraints
inside `q` instead of paging. That argues for a *shorter* skill body, not a longer tool
description.

Two durable findings from that run. **A baseline that merely omits the skill path is
contaminated** — the first attempt's opening tool call was `Skill{manabase:scryfall-query-craft}`,
auto-invoked though never mentioned. A clean baseline needs a subagent type with no `Skill` tool,
and the agent registry resolves at session start, so that file must exist *before* the measuring
session. This run used an explicit prohibition instead and records it as a confound. And
**Scryfall's regex anchors `^` and `$` bind to a line of oracle text, not to the card** — measured
849 vs 361 on the same pattern once newline-preceded matches were excluded. The stricter escapes
are unavailable and **fail two different ways**: `\z` and `(?-m:…)` return HTTP 400, while **`\A`
returns a normal 200 with zero matches** — a silent wrong answer of the same class as the
dropped-term behavior, because it makes the model report "no cards match" instead of retrying. Both
recorded 2026-08-04 in `docs/MCP-PRD.md` §4.1.1 and taught in the skill's `reference/operators.md`
and `reference/recipes.md`.

**Unplanned work, 2026-08-04 — the MCPB / Chat-tab distribution work.** It came from a bug report
rather than the roadmap, and it changed what "installed" means. Measured live on Claude Desktop: a
plugin installed from this repo's marketplace onto the **Chat tab delivers `skills/` and does not
start its MCP server there**; the Desktop **Code tab is Claude Code** and needs no second artifact;
and an **MCPB bundle** does expose the server to the Chat tab, as `Manabase:card_search` — a prefix
taken from the manifest's `display_name`, not its `name`. `PLUGIN-PRD.md` now carries `P-14` (two
distribution targets from one source, amending `P-01`) and `PC-03` (the bundle).

**The build path landed the same day and `PC-03` is now assigned to Slice 11**, status `in
progress`, criteria 1–6, 9 and 11 verified. Committed: `mcpb/manifest.json`,
`scripts/pack-mcpb.mjs` (`npm run pack:mcpb`), and `.github/workflows/release.yml` — the repo's
first `.github/` — which on a `v*` tag typechecks, tests, rebuilds `dist/` and fails on a diff,
packs, and attaches `manabase.mcpb` to a Release. At the time no version was tagged, so that
workflow had never run, there was nothing to download, and the README's Chat-tab path was
build-it-yourself. **All three inverted on 2026-08-10 — see the Slice 13 note below.**

Four things about that surface bind every session. **The MCPB manifest format has no `skills`
field** — verified against the published spec — so the Chat tab needs *two* installs permanently,
the plugin for the skill and the bundle for the server, and one-click is not a packaging problem
this project can solve. **Double-clicking a `.mcpb` is not a reliable install route**; Settings →
Extensions → Advanced settings → Install Extension is what works, so never write double-click as
the instruction even though Anthropic's docs list it first. **An installed extension has no update
path** — Desktop neither reports nor fetches a newer bundle — which is why the pack step stamps an
untagged build `0.0.0-dev+<commit>` rather than leaving `0.0.0`. And **Claude Desktop ships its own
Node**, so the bundle has no runtime prerequisite at all where the plugin needs Node on `PATH`;
that asymmetry is easy to state backwards.

`PQ-09` is answered *and* implemented, and **a tag versions the bundle, not the plugin** — `P-08`
is untouched and Slice 13 still owns the plugin version. `PQ-06` was **half-answered** that day:
both halves had a mechanism, but the CI gate had never run, it could not be exercised on this
machine (`dist/index.js` reports modified with an empty diff after every build), and neither
mechanism watched an ordinary commit. **Slice 11 closed the commit half on 2026-08-09 — see
below**; the user-facing half is still open.

Three things that bind every session follow. **`P-12`'s scoped tool name governs the Claude Code
surface only.** The scoped form is constructed per surface and is not a property of the server: the
same registered `card_search` is `mcp__plugin_manabase_mtg__card_search` there and
`Manabase:card_search` via MCPB. Never write either into a skill body. **A skill that loads is not
a skill that works** — on the Chat tab the skill loaded while the tool was absent, and the model
answered from a silent web search of Scryfall's pages, so an installed Manabase made answers *less*
grounded than no Manabase. PR #24 (`49edd8b`) fixed that with a **no-fallback rule** in the skill.
**Do not repeat that PR's causal claim:** the stale hardcoded tool string did not cause the
routing-around — the tool being *absent* did, and with the tool present the model resolves the real
one regardless. De-hardcoding the name was correct and was not the fix. Whether `PC-01` needs a
loads-*and*-fires criterion is open and undecided. No `PC-01` criterion changed status; the
frontmatter is byte-identical, so Slice 9's numbers stand.

**Issue #25 — a `card_search` payload exceeding the harness tool-result ceiling below one page, at
111 cards and 116,626 characters with `legalities` 54.5% of the bytes and `oracle_text` 25.1% — is
fixed as of 2026-08-10 (Slice 14, below).** That measurement was the first `OQ-02` ever had and it
confirmed the untrimmed-`legalities` inference. There is still **no verbose mode and no
`oracle_text` trim**; what shipped is the trim and the cap, and nothing more.

**Moxfield joined Archidekt as a deck platform, 2026-08-07 — docs only, nothing built.** `D-13`
orders them: Archidekt first because the author uses it, Moxfield second, neither blocking the
other's spec. Both deck-reading rows are **one capability shape served twice**, so the first one
specified sets the normalized shape (`OQ-12`) and everything downstream — analysis, Arena export,
deck pricing — consumes that shape, never a platform payload. `D-14` rejects the npm
`moxfield-api` package: it is actively maintained, unlike the `archidekt` one, but covers a single
endpoint, sets no `User-Agent`, throws where `D-10` wants a returned failure, and brings `zod`.
`D-15` is the one most easily got wrong: **Moxfield writes are blocked upstream, not merely last
like `D-09`'s Archidekt writes.** Its token endpoints challenge even support-whitelisted callers
and the report has sat unanswered since 2025-11-23, so the capability is not buildable by any
means §3.7 allows — never schedule the two write capabilities together. Reads are anonymous and
unchallenged on both platforms. And **one Moxfield deck read measured 1.63 MB** (`tokens` +
`tokenMappings` alone are 33.6% of it), ~14× the payload that already blew the harness ceiling in
issue #25 — so a passthrough is off the table from the first line of that spec, and every card
carrying `scryfall_id` is what makes the trim obvious. Ten capabilities are now queued, not eight.

**A decision-only session, 2026-08-07 — eight open questions settled and nothing implemented.** No
slice, no PR, no code, and **no `CAP` or `PC` acceptance criterion changed status**; every item here
is decided and unwritten. `OQ-02` is answered in full and carries **two** levers: a
`legalities: "queried" | "default" | "all"` enum defaulting to `"queried"`, whose default set is the
seven paper constructed formats (standard, pioneer, modern, legacy, vintage, commander, pauper),
**plus** a server-enforced page cap near 120 cards reported through the existing `has_more`/`note`
fields so it is never a silent truncation. **That cap shipped at 88, not 120 — see the Slice 14
note below.** The cap exists because a full 175-card page was finally
measured — 169,504 characters, and the best available trim still reaches 88,953 against the 116,626
that already failed, so the trim alone is refuted rather than confirmed. `OQ-09` is **no EUR
fallback**: USD-only stands, `D-06` is untouched, and a new `no-usd-price` reason carries the EUR
figure; at most 3,047 paper printings (3.15%) lack a USD price. `OQ-12` is **one tool, `deck_read`**,
over one thin shape — `{ platform, name, format, color_identity, cards: [{ name, quantity, board,
finish, scryfall_id }] }`, no `D-11` amendment needed, and Archidekt's `deckFormat` integer→name
table is still missing. `OQ-03`'s location half is recorded as already shipped in `config.ts`, its
refresh trigger still open. `OQ-08` is half answered — one `.txt` on the CR page that day, and the
scraper must still take the most recent **by date stamp**, never the first match. `PQ-03` is **never
a `SessionStart` hook**, scoped to this plugin shipping one rather than to background refresh
generally. `PQ-04`: a README line is sufficient, and it names invoking
`manabase:scryfall-query-craft` by name before `/doctor`, because trimming keeps names. `PQ-06`'s
commit half gets a `ci.yml` on `pull_request` and `push: main` running typecheck → test → build →
a `dist/` comparison (Slice 11 implemented it 2026-08-09, with `git status --porcelain` rather than
the `git diff --exit-code` this decision named — see below), while its **user-facing half stays
open and CI cannot close it**.

Two live findings from that session bind future queries, both in `MCP-PRD.md` §4.1.1. **A negated
numeric comparison is unusable and fails silently two ways** — a bare `-usd>=0.01` is dropped for an
HTTP 200 with an unchanged count, while `-(usd>=0.01)` and `usd<0.01` match nothing, so Scryfall
cannot express "this field is null"; it is a third member of the family holding the
dropped-invalid-term behavior and the `\A` zero-match trap, and trusting it would have reported that
96% of paper printings lack a USD price. And **Scryfall returns 23 legality keys, not 21.** §4.6
separately records the CR page turning over to `MagicCompRules 20260807.txt`.

**That conflict was settled 2026-08-08 and the stale copies are corrected.** `CAP-01`'s delivery
note reads "All twelve acceptance criteria are verified" while the block carries thirteen; the
block's own 2026-08-07 addendum already resolved it — delivered against 1–12, criterion 13 not
implemented — but four summaries still said "all twelve" flatly. `MCP-PRD.md`'s header,
`DEV-ROADMAP.md` §2, `README.md` and this file now all say 1–12 and name 13 as outstanding. The
dated notes themselves are untouched. Whether criterion 13 is widened for `OQ-02`'s page cap, or a
fourteenth added, still belongs to the slice that implements the trim.

Track C has started. `PC-03` does not change what Phase 1 is — it serves a surface, not a
capability, and Phase 1 is still `PC-01` plus `PC-02`; assigning it to Slice 11 gives it a
schedule slot, not a place in the dependency graph.

**Slice 10 (context-cost measurement) landed 2026-08-08 — measurement only, no code.** Claude
Code 2.1.226, model `claude-opus-5[1m]`, installed plugin `be2839453a11`, the author's full
two-plugin load. Evidence: `docs/slices/TrackC-Slice10-results.md`. `PC-02` criterion 10 is
**verified** and its always-on cost — the one genuine unknown in PLUGIN-PRD §5 — is **0**.
`PC-02`'s criteria 5 and 8 stay unverified. **`PC-01` criterion 2 is measured and NOT met, and is
not a clean fail either:** ~260 by `claude plugin details`, ~270 by `/context`, against a ≤250
gate — verdict **ambiguous-because-scaled**, because per-component figures are proportionally
scaled, not measured (this run saw a per-component ~260 exceed the whole-plugin ~258, which cannot
be literal). No instrument reports it under the gate and none reports a precise figure, so never
record it as passed and never as a clean fail. **The skill text was deliberately not shortened**
(decided with the author): Slice 9 measured 10/10 trigger accuracy on this exact frontmatter, and
shortening it is Slice 8's edit and would invalidate that rate.

**`PQ-01` is answered and its stake is retired.** MCP tool schemas do not count toward the
always-on total — A/B with `.mcp.json` ~258, without ~258, restored ~258, control holding — and
the reason is stronger than "unreported": on the Claude Code surface schemas are **deferred**,
0 tokens resident and ~398 on demand for `card_search`. The question mattered because a resident
schema *cannot* be budget-trimmed; deferral removes the premise, so tool count and description
length are ordinary prudence rather than a context-budget constraint, and `OQ-01` gains no cost
side — `MCP-PRD.md` is untouched by that slice. Two limits: deferral is the harness default, not a
guarantee (a server that opts out pays ~398 every session), and it is **unmeasured on the Chat
tab**. **`PQ-02` is answered:** the skill listing is 4.2k of a ~10,000-token budget across 47
skills with nothing trimmed; Manabase is ~270 of it (~2.7%). **Never quote that headroom without
the model** — the budget is 1% of the *context window*, so the same install on a 200k-context
model would face certain trimming. Over half the listing (~52%) is built-in skills no plugin
controls. `/doctor` on 2.1.226 is a health-check workflow: it neither prices the listing against a
budget nor names contributors, so `/context` is the instrument; three places in `PLUGIN-PRD.md`
still describe `/doctor` in that role and its §4.6.1 addendum records the correction. That answers
`PQ-04`'s follow-up negatively, and `PQ-04` itself stays answered — the README line Slice 12 owns
is unaffected; only its closing `/doctor` sentence is stale, which is Slice 12's call.

Two method findings bind anything that measures or perturbs "the installed plugin": it is a
**pinned clone in the plugin cache keyed by commit SHA**, not the working tree — acting on the
repo instead returns a plausible number that means nothing — and `claude plugin details` **re-reads
from disk every invocation**, so no reload, update or reinstall is needed for a change to register.

**Slice 11 (the `dist/` honesty mechanism) landed 2026-08-09 as PR #32.**
`.github/workflows/ci.yml` runs on `pull_request` and `push: main`: `npm ci` → `npm run typecheck`
→ `npm test` → rebuild `dist/` and fail if the tree moved, gate last. With it came `.nvmrc` (Node
`22`, the toolchain pinned once and read by both workflows) and a `.gitattributes` holding exactly
one rule, `dist/index.js text eol=lf`. Evidence: `docs/slices/TrackC-Slice11-results.md`. **The
gate is `git status --porcelain -- dist/`, not `git diff`** — an absent `dist/index.js` is
recreated by the rebuild as an *untracked* file that `git diff` does not report at all, and
absent-`dist/` is exactly the failure `P-09` fears; `release.yml`'s gate was upgraded to the same
form. The check was observed **failing** on a deliberately stale `dist/` and then green on the
rebuild, same branch and same workflow (PR #33, closed unmerged), which is what makes it known to
work. `PQ-06`'s commit half is answered; **never say `PQ-06` is closed flatly** — its user-facing
half stays open and a released `.mcpb` carries its `dist/` until reinstall. (The release gate had
still never run against a tag when that was written; it ran 2026-08-10 and was clean, which moves
neither half of `PQ-06`.) **No `PC-01`, `PC-02` or `PC-03` criterion changed status**, and
`PC-03` was reassigned from Slice 11 to Slice 13 later the same day (`86769ca`), moving no
criterion. Scope was narrowed with the author and four items were
**deferred, not dropped** — **all four landed 2026-08-10**: the doc-link checker
(`scripts/check-doc-links.mjs`, `npm run lint:docs`) was unscheduled and landed as PR #36 — see
below; packed-bundle byte-identity and the first `v*` release landed as Slice 13's `PC-03` half;
and the README Chat-tab download line, deferred to Slice 12 and re-deferred to Slice 13 for want of
a release, landed in `710f569` once there was one. **That closes no slice** — 12's friend dry-run,
its acceptance gate, is still outstanding, and 13 is partially executed. One trap follows. **A `src/` edit meant to
demonstrate the gate must be in a module no test covers** — `src/index.ts` works; `src/config.ts`
trips `tests/config.test.ts`, so `npm test` fails first and the gate step never runs.
**`.github/` holds two workflows**, and `release.yml`'s `@v4` pins were bumped to `@v7` before its
first run, which retires the item this paragraph used to leave for Slice 13.

**Unscheduled work landed 2026-08-10 — the doc-link checker, PR #36 (`e6b2279`).** It is Slice
11's deferred item and **is not a slice**; the branch it landed on,
`docs/slice12-link-and-disclaimer-recheck`, was opened for unrelated Slice 12 re-checks and reused,
so the name misattributes it. `scripts/check-doc-links.mjs` (`npm run lint:docs`) resolves every
relative link and heading anchor in `README.md` and `docs/**` minus `docs/prompts/**`, with the
fenced-code carve-out, and fails any file under `skills/` that links outside its own skill
directory — the one link defect this repo could not otherwise see. Node builtins, no network, by
design. `ci.yml` runs it between `npm ci` and the typecheck, so CI is now `npm ci` → `lint:docs` →
typecheck → test → rebuild-and-gate. Green on Linux in 14 s — 23 files, 2,666 links, 0 broken —
byte-identical to the local Windows run. **Nothing else moved:** no `CAP-01`, `PC-01`, `PC-02` or
`PC-03` criterion changed status, no open question was resolved, `PQ-06` is untouched in both
halves, Slice 11 stays closed and Slice 12 is unmoved. One trap, learned in its own making:
**model the slug rule, never hand-roll a punctuation list.** The first version stripped the em dash
but not the arrow in `Criterion 12 — structured failure → revised retry` and raised a false alarm
on a working link; a checker whose failures cannot be trusted gets deleted.

**Slice 13 was partially executed 2026-08-10 — its `PC-03` half only, and the slice is not
closed.** PR #37 (`2c7196c`) added the criterion 7 assertion to `scripts/pack-mcpb.mjs` and bumped
`release.yml`'s action pins to `@v7`; tag `v0.1.0` on that commit ran the release workflow for the
first time it has ever executed and published `manabase.mcpb` (111,760 bytes), which was installed
on Claude Desktop from the released artifact and observed calling the tool. Evidence:
`docs/slices/TrackC-Slice13-results.md`. `PC-03` criteria **7 and 10 are verified**, leaving 8 as
its only unverified one; 3 and 4 were re-confirmed against the released artifact rather than the
hand-packed one and keep their 2026-08-04 dates. **Criterion 7 lives in the pack script, not a
workflow step** — it unpacks the archive it just wrote and sha256-compares `server/index.js`
against the committed `dist/index.js`, never the staging tree, which is a `cpSync` of `dist/` and
would be a tautology that passes forever; a mismatch exits 1 and deletes the bundle. **Do not read
any of this as Slice 13 done or Phase 1 closed.** The `P-08` switchover did not happen and stays
gated on Slice 12's friend dry-run: `plugin.json` still carries no `version`, `package.json` is
still `0.0.0`, `claude plugin validate . --strict` still fails on that one warning so `PC-02`
criterion 9 stays open, and `PQ-05` has no disposition. The tag versions the **bundle** (`PQ-09`).
**`PQ-06` did not move in either half** — its commit half was already Slice 11's, and shipping a
bundle real people install sharpens the user-facing half rather than easing it. No `CAP-01`,
`PC-01` or `PC-02` criterion changed status. Three things to carry: **`v0.1.0` is spent, and
`claude plugin tag` writes into the same `v*` namespace `release.yml` watches**, so the remaining
half can accidentally cut a second bundle release — `--dry-run` its tag format first and pick a
version string that has not been used; **a released bundle cannot be withdrawn**, so a defect ships
as a new tag and `v0.1.0` is never moved or deleted; and **`upload-artifact@v5` is still `node20`**
— `@v6` is the first major on `node24`, so bumping a major is not evidence the runtime moved with
it.

**Slice 14 (the result trim and page cap) landed 2026-08-10 as commit `031a501` on
`feat/slice14-trim-and-page-cap`, PR #41.** It implements both of `OQ-02`'s levers in
`src/tools/card-search.ts` and `src/tools/register.ts`, **closes `OQ-02`** (a dated §7 answer and
one §9 row in `MCP-PRD.md`), and **fixes issue #25**: the same query measures 53,043 characters
against 116,626, 88 cards with `has_more: true`, page 2 returning the remaining 23, all 111
reachable. `CAP-01` criterion 13 is verified and a criterion 14 was added and verified, so the block
is **delivered against criteria 1–14**. Tests 73 → 101, suites 21 → 27; `npm run acceptance` 13/13
live, no 429. Evidence: `docs/slices/TrackA-Slice14-results.md`. The trim is a
`legalities: "queried" | "default" | "all"` parameter defaulting to `"queried"`, chosen by a **scan**
of `q` that never parses or rewrites it (`D-07` intact) and degrades to the seven paper formats on
any miss, so **the map is never empty**. Two new required top-level fields, `legalities_mode` and
`legalities_included`, report the scope, because an absent key must never read as "not legal"
(§3.6) — and **`legalities_mode` names the scope *applied*, not the one requested**: a `"queried"`
call whose scan found no format reports `"default"`.

Five traps from that slice bind future work. **The cap is 88 because of reachability, not bytes.**
Scryfall's `page` is in units of 175 with no offset, so the ~120 the decision estimated would strand
cards 121–175 behind no `page` value at all — a silent loss worse than the payload problem; 88 is
half an upstream page, so every card is reachable at one upstream request per call. **Two
arithmetic traps follow, both tested:** the page count anchors to *upstream* pages, so 176 cards is
**3** pages and not `ceil(176/88)`; and the card range in the note is not `(page-1)*88+1`, which
drifts one card per upstream page and is already wrong on page 3. **`format:` and `legal:` are real
format operators**, synonyms for `f:`, so the scan matches five — `f:`, `format:`, `legal:`,
`banned:`, `restricted:` — not the three the skill's `reference/operators.md` had. **`f:edh` is
accepted by Scryfall but `edh` is not a legality key**, so a scanner treating a scanned token as a
key emits an empty legalities map from a perfectly good query — a normal-looking 200 carrying a
wrong answer, which is why the fallback exists. And **a page past the end is HTTP 422, not 404**:
it misses the 404-as-empty mapping and falls through to `unexpected`, which reads as a server fault
and discourages the retry that fixes it, so the handler re-codes it to `bad_request` naming the
valid range — distinct from zero matches, which stays a successful empty result with
`total_cards: 0`. **No tag and no `.mcpb` release**, deliberately: `v0.1.0` is spent and a released
bundle cannot be withdrawn, so anyone on that bundle carries the old payload until a new one is cut
and reinstalled. Two `SKILL.md` lines changed 175 to 88; the frontmatter is byte-identical, so
Slice 9's 10/10 trigger accuracy stands and **no `PC-01`, `PC-02` or `PC-03` criterion changed
status.** `PQ-06` did not move in either half.

Slice 12 is now the **only unblocked slice** and next on the critical path: it waited on 6, 9 and
10, and on 14 once that was scoped, and all four have landed. 13's remaining `P-08` half waits on
12 alone. `docs/DEV-ROADMAP.md` §5 has the graph.

Pre-triage feature ideas live in `IDEAS.md` at the repo root — non-binding, `IDEA-0N` IDs, captured
by `/idea`. It is upstream of triage: an idea there has no `CAP`, `PC`, or slice yet. Questions
arising *inside* triaged work are the other lane — `OPEN-QUESTIONS.md` and §7.

## Price handling — the three traps

`resolvePrice` exists because reading `usd` alone is wrong:

1. **`eur_etched` does not exist** in the live API even though the docs list it. Do not model it.
2. **`usd` null while `usd_foil` or `usd_etched` is populated is common** (7,599 and 1,074 cards),
   not an edge case. Resolution order is `usd` → `usd_foil` → `usd_etched`, with the finish
   labeled.
3. **Digital printings win name lookups and search rollups** and carry no paper prices — a plain
   `!"Black Lotus"` returns the MTGO printing. Digital is checked *first* and reported as
   `digital-only`, never as "no price data".

Prices stay strings. A missing price is reported as missing, never as `$0`. **`OQ-09` was answered
2026-08-07: no EUR fallback.** USD-only stands, `D-06` is untouched, and a distinct `no-usd-price`
reason carries the EUR figure instead — so a currency gap is never reported as missing data. At most
3,047 paper printings (3.15%) lack a USD price. **Not implemented:** `prices.ts` is unchanged, and
as of 2026-08-03 no paper Black Lotus printing carries a USD price at all.

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
  greps rather than clicks. Context budget is measured here, not guessed (`PQ-01` and `PQ-02`,
  answered by Slice 10), so this is a measured trade, not an oversight — and this file is the
  single largest resident item on the author's machine at 11.9k tokens, against ~270 for the
  whole shipped plugin. Cite by ID and let the reader search.

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

Windows dev machine with `core.autocrlf=true`: the working tree is CRLF while git blobs are LF.
Since Slice 11 there is a `.gitattributes`, but it carries **one** rule — `dist/index.js text
eol=lf` — so every markdown and source file is still governed by `autocrlf` alone. Scripted edits
to the markdown files must preserve CRLF, or the diff shows the whole file as changed.

**Never run `sed -i` — or any stream editor — against a tracked file here.** It rewrites the whole
file to LF, which shows up as a modified file with no content diff: the same silent, hard-to-read
corruption class as the `String.replace` hazard below. Use targeted edits.

**`dist/index.js` reporting ` M` right after a clean build is a stale stat cache, not CRLF.**
Measured: the rebuilt working-tree file hashes *identically* to the index blob and `git diff`
reports clean, while `git status` still says ` M`; it survives `.gitattributes` and
`git update-index --really-refresh`, and `git add --renormalize dist/index.js` clears it. Earlier
notes blamed `core.autocrlf` for this — the observation was right and the cause was wrong. The
conclusion drawn from it held anyway: three green Linux CI runs show the runner does not reproduce
it.

**Scripting an edit in JavaScript: pass a replacement *function*, never a replacement string.**
`String.replace`/`replaceAll` interpret `$` sequences in the replacement argument — `` $` `` splices
in everything *before* the match, `$&` the match itself, `$'` everything after. These documents are
dense with `$` inside backticks (`usd<=1`, price prose, the §9 rows), so a string replacement can
duplicate most of the file into itself. It fails silently and does not read as corruption: the
result is insertions with **zero deletions**, exactly what a clean append looks like. Use
`t.replace(anchor, () => anchor + addition)`, which disables `$` substitution outright, and check
`git diff --stat` against the number of lines you meant to add before committing.
