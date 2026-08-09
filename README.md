# Manabase

Magic: The Gathering card research for Claude Code. A bundled MCP server plus the skills that
let Claude write real Scryfall queries from plain English — including the operators nobody
remembers, like regex and the Tagger tags.

**Status: pre-release.** Phase 1 is card search
([CAP-01](./docs/MCP-PRD.md#cap-01--card-search)) delivered as a bundled MCP server
([PC-02](./docs/PLUGIN-PRD.md#pc-02--bundled-mcp-server)) and a Scryfall query-craft skill
([PC-01](./docs/PLUGIN-PRD.md#pc-01--scryfall-query-craft)).

The server half is done. `card_search` runs against live Scryfall, and all twelve of
[CAP-01](./docs/MCP-PRD.md#cap-01--card-search)'s acceptance criteria are verified (2026-08-03).
The two commands below are now a verified path, not merely the intended one: the install was
performed end to end on a machine that had never installed it, and the server was connected and
answering in the same session (2026-08-04,
[`docs/slices/TrackB-Slice7-results.md`](./docs/slices/TrackB-Slice7-results.md)). The
query-craft skill is now written and passes its static checks — it fits the listing budget, fits
the compaction window, and asserts no card facts (2026-08-04,
[`docs/slices/TrackB-Slice8-results.md`](./docs/slices/TrackB-Slice8-results.md)). Those checks
all read the file rather than loading it, and a same-day fix (`ed82ceb`) was needed before the
skill loaded at all: its YAML frontmatter was unparsable, so the harness listed **no** skill for
the plugin and said nothing about why. Since then the skill has been run through fresh-session
evals against a without-skill baseline, and
[PC-01](./docs/PLUGIN-PRD.md#pc-01--scryfall-query-craft)'s behavioral criteria are measured
(2026-08-04, [`docs/slices/TrackB-Slice9-results.md`](./docs/slices/TrackB-Slice9-results.md)) —
it loads, it triggers on Magic questions and not on look-alikes, and it keeps the model off
operators that do not exist. The cost is measured too: installing Manabase adds **about 270
tokens** to every session on the Claude Code surface — the skill's listing entry, and nothing
else, because the server's tool schema is fetched on demand rather than kept resident (2026-08-08,
[`docs/slices/TrackC-Slice10-results.md`](./docs/slices/TrackC-Slice10-results.md)).
[`docs/DEV-ROADMAP.md`](./docs/DEV-ROADMAP.md) tracks what remains.

**One known limitation, open and unfixed:** a `card_search` result for a broad query can exceed
the harness's tool-result size ceiling before it reaches a full page of matches (issue #25; 111
cards measured 116,626 characters). Narrow the query. The fix is **decided but not built**
(2026-08-07): legalities trimmed to the format the query names, plus a page cap that reports
itself — [`docs/MCP-PRD.md` OQ-02](./docs/MCP-PRD.md#oq-02--how-verbose-should-a-search-result-be).

## Where it runs

Manabase is a Claude Code plugin, and a plugin does not reach every surface the same way. Verified
2026-08-04:

| Surface | Works today | What you get |
|---|---|---|
| **Claude Code in a terminal** | **Yes** — install below | Tools and skill. The supported configuration |
| **Claude Desktop — Code tab** | **Yes** — same install, unmodified | The Code tab *is* Claude Code. No second artifact, no extra step |
| **Claude Desktop — Chat tab** | **Experimental** — plugin **and** a bundle you build yourself | Installing the plugin alone delivers the **skill only**; the MCP server does **not** start there. Adding the bundle below gets you the tools |
| **Claude on the web** | **No, and not planned** | Serving it would need a hosted server. Deliberately out of scope — [`docs/PLUGIN-PRD.md` §8](./docs/PLUGIN-PRD.md#8-out-of-scope) |

On the Chat tab the skill is present and its tool is not, which used to make Manabase *worse* than
no Manabase: the model quietly answered from a web search of Scryfall's pages instead of saying the
tool was missing. The skill now refuses to substitute — it stops and tells you the tool is
unavailable. Serving that surface properly needs a second artifact, an MCPB bundle, specified as
[`docs/PLUGIN-PRD.md` PC-03](./docs/PLUGIN-PRD.md#pc-03--mcpb-bundle-for-the-chat-tab) under
[P-14](./docs/PLUGIN-PRD.md#p-14--two-distribution-targets-one-source). A Chat-tab user needs
**both** the plugin and the bundle; either alone is a degraded state.

### Chat tab — experimental

**The Chat tab needs two installs, and neither one alone is the product.** The MCPB manifest
format has no way to carry a skill, so the bundle ships the server and the plugin ships the skill.
Install the plugin with the two commands under [Install](#install) — that gets you the skill — then
add the bundle below for the tools.

**There is no release to download yet.** The build pipeline exists
([`.github/workflows/release.yml`](./.github/workflows/release.yml)) but no version has been tagged,
so for now you build the bundle from a checkout:

```
git clone https://github.com/njohnb/Manabase && cd Manabase
npm ci && npm run build
npm run pack:mcpb
```

That writes `build/manabase.mcpb`. It refuses to pack a `dist/` older than `src/`, and with no tag
it stamps the version `0.0.0-dev+<commit>` so an ad-hoc bundle cannot be mistaken for a release.

Install it through **Settings → Extensions → Advanced settings → Install Extension…**, then
**restart Claude Desktop**. Anthropic's documentation also lists double-clicking the `.mcpb` and
dragging it onto the window; **double-click is not reliable** and the Settings route is the one
verified to work here (2026-08-04).

Verify by asking Claude in the Chat tab to list its available tools; you want `Manabase:card_search`.
That name differs from the Claude Code form and is not portable
([P-12](./docs/PLUGIN-PRD.md#p-12--plugin-name-and-server-key)).

Known rough edges, all tracked. **An installed extension has no update path** — Claude Desktop will
not tell you a newer bundle exists and will not fetch one, so every upgrade means packing or
downloading again and reinstalling through the same Settings route. An installed bundle never
re-pulls, so a stale build is invisible
([PQ-06](./docs/PLUGIN-PRD.md#pq-06--what-keeps-the-committed-dist-honest)). And the Chat tab has no
shell, so an oversized result cannot be recovered there the way it can in Claude Code (see the
limitation above).

## Requirements

- **Claude Code 2.1.207 or later.** This is a hard floor, not a recommendation — see
  [`docs/PLUGIN-PRD.md` P-10](./docs/PLUGIN-PRD.md#p-10--minimum-supported-claude-code-version).
- **Node on `PATH`.** That is the only runtime prerequisite, and it applies to the **plugin**:
  no build toolchain, no `npm install`, no Python, no shell. It is the first thing to check if the
  tools do not appear ([`docs/PLUGIN-PRD.md` §3.4](./docs/PLUGIN-PRD.md#34-cross-platform-reach)).
- **The MCPB bundle needs nothing.** Claude Desktop ships its own Node on macOS and Windows, so a
  Chat-tab install has no runtime prerequisite at all. Building the bundle yourself does need
  Node, but only until there is a release to download.

## Install

```
/plugin marketplace add njohnb/Manabase
/plugin install manabase@manabase
```

Two commands. No config file to edit, no credential prompt, no restart.

> **Add the marketplace as `owner/repo`, not as a URL to `marketplace.json`.** Adding it by
> direct URL downloads only that one file, and the plugin's relative source path will not
> resolve. This is a partial, confusing failure rather than a clean one.
> ([`docs/PLUGIN-PRD.md` P-11](./docs/PLUGIN-PRD.md#p-11--the-repo-is-its-own-marketplace).)

## Repository layout

```
.claude-plugin/
  plugin.json          plugin manifest — the only file that lives in .claude-plugin/
  marketplace.json     this repo is its own marketplace (P-11)
.claude/
  agents/doc-sync.md   dev-only doc reconciler — NOT a plugin component
.github/
  workflows/release.yml  builds and publishes the MCPB bundle on a `v*` tag
.mcp.json              bundled stdio MCP server, key `mtg` (P-09, P-12)
mcpb/
  manifest.json        MCPB manifest — the Chat tab's artifact (PC-03, P-14)
skills/
  scryfall-query-craft/  PC-01 — SKILL.md plus reference/ files read on demand
src/                   MCP server source (TypeScript)
dist/                  committed build output — NOT gitignored (P-09)
tests/                 handlers called as plain functions, no server (MCP-PRD D-03)
scripts/               cap01-live.mjs (live CAP-01 harness), pack-mcpb.mjs (bundle packer)
evals/                 PC-01 behavioral and trigger eval cases (Slice 9)
docs/
  MCP-PRD.md           what the server does — tools, data sources, capabilities
  PLUGIN-PRD.md        what the user installs — packaging, install, skills
  DEV-ROADMAP.md       sequencing only — the 13 Phase 1 slices and their status
  slices/              per-slice specs, and the live acceptance results
  prompts/             planning prompts for Claude Code sessions
CLAUDE.md              working agreements for Claude Code sessions in this repo
```

Component directories sit at the **plugin root**. Only `plugin.json` and
`marketplace.json` live inside `.claude-plugin/` — a *component* placed there silently fails
to load.

**In Claude Code**, tools are callable as `mcp__plugin_manabase_mtg__<tool-name>`; the server
registers as `plugin:manabase:mtg`. That full scoped form is what permission rules,
`allowed-tools` entries, and hook matchers must use — a matcher written against the bare server
key never fires ([`docs/PLUGIN-PRD.md` P-12](./docs/PLUGIN-PRD.md#p-12--plugin-name-and-server-key)).
The scoped name is built by the surface, not by the server, so it is **not portable**: the same
registered `card_search` appears under a different prefix elsewhere, and
[P-12](./docs/PLUGIN-PRD.md#p-12--plugin-name-and-server-key)'s form governs Claude Code only
([P-14](./docs/PLUGIN-PRD.md#p-14--two-distribution-targets-one-source)).

## Development

```
npm install
npm run build       # esbuild bundle -> dist/index.js, self-contained
npm run typecheck   # tsc --noEmit
npm test            # node --test, with TypeScript stripped at runtime
npm run acceptance  # 13 live checks against real Scryfall — slow on purpose
npm run pack:mcpb   # stage + stamp + pack build/manabase.mcpb (PC-03)
```

The tests run `.ts` files directly, so **development needs Node 22.6 or newer** — that is where
`--experimental-strip-types` landed. The published server has no such floor: it ships as the
plain-JavaScript `dist/` bundle, which is why `engines` stays at `>=18.0.0`.

`dist/` is committed and is what the plugin actually starts, so **rebuild it with every `src/`
change**. A stale bundle does not error; the tools are simply absent. Keeping it honest
automatically is open question
[PQ-06](./docs/PLUGIN-PRD.md#pq-06--what-keeps-the-committed-dist-honest).

`npm run acceptance` talks to live Scryfall. It waits at least 600 ms between calls and never
retries a failed check — Scryfall's rate limits are a hard constraint, and a sustained overage
risks the application being banned for everyone using it
([`docs/MCP-PRD.md` §3.4](./docs/MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance)).

## Data on disk

Caches live under `${CLAUDE_PLUGIN_DATA}`, which survives plugin updates. Nothing is written
under `${CLAUDE_PLUGIN_ROOT}`, which is replaced on every update and garbage-collected about
two weeks later ([`docs/PLUGIN-PRD.md` P-06](./docs/PLUGIN-PRD.md#p-06--cached-data-lives-in-the-plugin-data-directory)).

Phase 1 caches nothing — every card search goes to Scryfall — but the directory rule is already
implemented and settled, so the first capability that needs persistence inherits it.

## If something is wrong

- **The tools are missing.** A server that fails to start is nearly invisible — the tools are
  just absent. Check `/mcp` first, then run `claude --debug` to read why.
- **Claude stops reaching for Magic tools on its own.** The skill listing is capped at a
  fraction of the context window and silently drops descriptions when it overflows. Run
  `/context` — its Skills row reports the listing size after the cap is applied, and lists every
  skill with its cost. (Not `/doctor`, which is a health check and does not price the listing —
  measured 2026-08-08,
  [`docs/slices/TrackC-Slice10-results.md`](./docs/slices/TrackC-Slice10-results.md).)
- **Claude says the Magic tool is unavailable.** That is the skill working as designed, not a
  bug — it will not fill the gap with a web search. Check which surface you are on: on the Claude
  Desktop **Chat tab** the plugin delivers the skill but no server, which is the **Experimental**
  row above — you need the bundle as well.
- **A search errors out on size.** The result exceeded the harness's tool-result ceiling — add
  constraints to the query rather than paging (issue #25).
- **Scryfall is down.** That is a total outage for card search; there is no second source for
  Scryfall query syntax. You should get a clear structured failure, not a stack trace.

## Attribution

Card data and prices via [Scryfall](https://scryfall.com).

Prices are Scryfall's TCGplayer-derived market price — one number per printing, synced every
24 hours. Directionally useful, not a shopping cart. A missing price is reported as missing,
never as $0, and a digital-only printing says so rather than claiming no price data exists.

Some paper printings carry no USD price at all, only EUR — as of 2026-08-03 that includes every
paper Black Lotus, and at most 3.15% of paper printings overall. Those report as missing today.
**There will be no EUR fallback** — a price that could silently be in either currency is worse than
none — but the report will get more precise: a distinct "no USD price" reason carrying the EUR
figure, decided 2026-08-07 and not yet built
([OQ-09](./docs/MCP-PRD.md#oq-09--should-price-resolution-fall-back-to-eur-when-no-usd-price-exists)).

**Planned sources**, for capabilities that are queued and unassigned — none of these are
reached today: [Commander Spellbook](https://commanderspellbook.com) for combo data,
[Archidekt](https://archidekt.com) and [Moxfield](https://moxfield.com) for deck data, and
Scryfall's Tags API for tag discovery. Deck reading is planned for Archidekt first and Moxfield
second ([`docs/MCP-PRD.md` D-13](./docs/MCP-PRD.md#d-13--deck-platform-order-archidekt-first-moxfield-second)); neither
needs an account, and reading a private deck is not something the plugin will be able to do.
Comprehensive Rules text is © Wizards of the Coast; when rules lookup lands, the plugin will
resolve and fetch the official published file at runtime rather than redistribute a copy
([`docs/MCP-PRD.md` D-08](./docs/MCP-PRD.md#d-08--comprehensive-rules-fetched-at-runtime-never-bundled)).

---

Manabase is unofficial Fan Content permitted under the Fan Content Policy. Not
approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the
Coast. ©Wizards of the Coast LLC.
