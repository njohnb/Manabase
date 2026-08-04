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
[`docs/slices/TrackB-Slice7-results.md`](./docs/slices/TrackB-Slice7-results.md)). The plugin half
is still incomplete — the query-craft skill is unwritten.
[`docs/DEV-ROADMAP.md`](./docs/DEV-ROADMAP.md) tracks what remains.

## Requirements

- **Claude Code 2.1.207 or later.** This is a hard floor, not a recommendation — see
  [`docs/PLUGIN-PRD.md` P-10](./docs/PLUGIN-PRD.md#p-10--minimum-supported-claude-code-version).
- **Node on `PATH`.** That is the only runtime prerequisite. No build toolchain, no
  `npm install`, no Python, no shell.

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
.mcp.json              bundled stdio MCP server, key `mtg` (P-09, P-12)
skills/
  scryfall-query-craft/  PC-01 — SKILL.md plus a reference/ file read on demand
                         (placeholder — not written yet)
src/                   MCP server source (TypeScript)
dist/                  committed build output — NOT gitignored (P-09)
tests/                 handlers called as plain functions, no server (MCP-PRD D-03)
scripts/               cap01-live.mjs — the live CAP-01 acceptance harness
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

Tools are callable as `mcp__plugin_manabase_mtg__<tool-name>`; the server registers as
`plugin:manabase:mtg`. That full scoped form is what permission rules, `allowed-tools`
entries, and hook matchers must use — a matcher written against the bare server key never
fires ([`docs/PLUGIN-PRD.md` P-12](./docs/PLUGIN-PRD.md#p-12--plugin-name-and-server-key)).

## Development

```
npm install
npm run build       # esbuild bundle -> dist/index.js, self-contained
npm run typecheck   # tsc --noEmit
npm test            # node --test, with TypeScript stripped at runtime
npm run acceptance  # 13 live checks against real Scryfall — slow on purpose
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
  `/doctor` — it estimates the listing cost against the budget and names the biggest
  contributors.
- **Scryfall is down.** That is a total outage for card search; there is no second source for
  Scryfall query syntax. You should get a clear structured failure, not a stack trace.

## Attribution

Card data and prices via [Scryfall](https://scryfall.com).

Prices are Scryfall's TCGplayer-derived market price — one number per printing, synced every
24 hours. Directionally useful, not a shopping cart. A missing price is reported as missing,
never as $0, and a digital-only printing says so rather than claiming no price data exists.

Some paper printings carry no USD price at all, only EUR — as of 2026-08-03 that includes every
paper Black Lotus. Those report as missing today. Whether to fall back to EUR is
[open question OQ-09](./docs/MCP-PRD.md#oq-09--should-price-resolution-fall-back-to-eur-when-no-usd-price-exists).

**Planned sources**, for capabilities that are queued and unassigned — none of these are
reached today: [Commander Spellbook](https://commanderspellbook.com) for combo data,
[Archidekt](https://archidekt.com) for deck data, and Scryfall's Tags API for tag discovery.
Comprehensive Rules text is © Wizards of the Coast; when rules lookup lands, the plugin will
resolve and fetch the official published file at runtime rather than redistribute a copy
([`docs/MCP-PRD.md` D-08](./docs/MCP-PRD.md#d-08--comprehensive-rules-fetched-at-runtime-never-bundled)).

---

Manabase is unofficial Fan Content permitted under the Fan Content Policy. Not
approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the
Coast. ©Wizards of the Coast LLC.
