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
npm test            # node --experimental-strip-types --test  (73 tests, 21 suites)
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

## Current state (2026-08-04)

Track A is complete: Slices 1–6 shipped as PRs #2–#7 and `CAP-01` (card search) is **delivered**,
with all twelve acceptance criteria verified — nine live against real Scryfall.

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
packs, and attaches `manabase.mcpb` to a Release. **No version is tagged, so that workflow has
never run and there is nothing to download**; the README's Chat-tab path is still
build-it-yourself. Do not describe a release that does not exist.

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
is untouched and Slice 13 still owns the plugin version. `PQ-06` is only **half-answered and stays
open**: both halves have a mechanism now, but the CI gate has never run, it cannot be exercised on
this machine (`core.autocrlf=true` makes `dist/index.js` report modified with an empty diff after
every build), and neither mechanism watches an ordinary commit.

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

**Issue #25 is open and unfixed:** a `card_search` payload exceeds the harness tool-result ceiling
below one page — 111 cards, 116,626 characters, `legalities` 54.5% of the bytes and `oracle_text`
25.1%. That is the first payload measurement `OQ-02` has ever had and it confirms the
untrimmed-`legalities` inference. `OQ-02` was answered in full on 2026-08-07 (below), but
**nothing has been trimmed, there is no cap and no verbose mode**, so the defect is unchanged.

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
fields so it is never a silent truncation. The cap exists because a full 175-card page was finally
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
`git diff --exit-code -- dist/` (Slice 11 implements), while its **user-facing half stays open and
CI cannot close it**.

Two live findings from that session bind future queries, both in `MCP-PRD.md` §4.1.1. **A negated
numeric comparison is unusable and fails silently two ways** — a bare `-usd>=0.01` is dropped for an
HTTP 200 with an unchanged count, while `-(usd>=0.01)` and `usd<0.01` match nothing, so Scryfall
cannot express "this field is null"; it is a third member of the family holding the
dropped-invalid-term behavior and the `\A` zero-match trap, and trusting it would have reported that
96% of paper printings lack a USD price. And **Scryfall returns 23 legality keys, not 21.** §4.6
separately records the CR page turning over to `MagicCompRules 20260807.txt`.

**One conflict is open and is the session's call, not `doc-sync`'s:** `CAP-01` is delivered under a
note reading "All twelve acceptance criteria are verified" while the block carries thirteen, and
`OQ-02`'s answer now adds a page cap on top of criterion 13's trim.

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

Slice 12 is now **unblocked** and next on the critical path: it waited on 6, 9 and 10, and all
three have landed. The unblocked set is 11 and 12; 13 waits on both. `docs/DEV-ROADMAP.md` §5 has
the graph.

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

Windows dev machine with `core.autocrlf=true` and no `.gitattributes`: the working tree is CRLF
while git blobs are LF. Scripted edits to the markdown files must preserve CRLF, or the diff shows
the whole file as changed.

**Scripting an edit in JavaScript: pass a replacement *function*, never a replacement string.**
`String.replace`/`replaceAll` interpret `$` sequences in the replacement argument — `` $` `` splices
in everything *before* the match, `$&` the match itself, `$'` everything after. These documents are
dense with `$` inside backticks (`usd<=1`, price prose, the §9 rows), so a string replacement can
duplicate most of the file into itself. It fails silently and does not read as corruption: the
result is insertions with **zero deletions**, exactly what a clean append looks like. Use
`t.replace(anchor, () => anchor + addition)`, which disables `$` substitution outright, and check
`git diff --stat` against the number of lines you meant to add before committing.
