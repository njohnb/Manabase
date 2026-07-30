# Manabase

Magic: The Gathering card research for Claude Code. A bundled MCP server plus the skills that
let Claude write real Scryfall queries from plain English — including the operators nobody
remembers, like regex and the Tagger tags.

**Status: pre-release.** Phase 1 is card search (CAP-01) delivered as a bundled MCP server
(PC-02) and a Scryfall query-craft skill (PC-01). Nothing is implemented yet; this repo is the
scaffold and the specifications.

## Requirements

- **Claude Code 2.1.207 or later.** This is a hard floor, not a recommendation — see
  `docs/PLUGIN-PRD.md` P-10.
- **Node on `PATH`.** That is the only runtime prerequisite. No build toolchain, no
  `npm install`, no Python, no shell.

## Install

```
/plugin marketplace add <your-github-owner>/manabase
/plugin install manabase@manabase
```

Two commands. No config file to edit, no credential prompt, no restart.

> **Add the marketplace as `owner/repo`, not as a URL to `marketplace.json`.** Adding it by
> direct URL downloads only that one file, and the plugin's relative source path will not
> resolve. This is a partial, confusing failure rather than a clean one.
> (`docs/PLUGIN-PRD.md` P-11.)

## Repository layout

```
.claude-plugin/
  plugin.json          plugin manifest — the only file that lives in .claude-plugin/
  marketplace.json     this repo is its own marketplace (P-11)
.mcp.json              bundled stdio MCP server, key `mtg` (P-09, P-12)
skills/
  scryfall-query-craft/  PC-01 — SKILL.md plus a reference/ file read on demand
src/                   MCP server source (TypeScript)
dist/                  committed build output — NOT gitignored (P-09)
tests/                 handlers called as plain functions, no server (MCP-PRD D-03)
docs/
  MCP-PRD.md           what the server does — tools, data sources, capabilities
  PLUGIN-PRD.md        what the user installs — packaging, install, skills
  prompts/             planning prompts for Claude Code sessions
```

Component directories sit at the **plugin root**. Only `plugin.json` and
`marketplace.json` live inside `.claude-plugin/` — a *component* placed there silently fails
to load.

Tools are callable as `mcp__plugin_manabase_mtg__<tool-name>`; the server registers as
`plugin:manabase:mtg`. That full scoped form is what permission rules, `allowed-tools`
entries, and hook matchers must use — a matcher written against the bare server key never
fires (`docs/PLUGIN-PRD.md` P-12).

## Data on disk

Caches live under `${CLAUDE_PLUGIN_DATA}`, which survives plugin updates. Nothing is written
under `${CLAUDE_PLUGIN_ROOT}`, which is replaced on every update and garbage-collected about
two weeks later (`docs/PLUGIN-PRD.md` P-06).

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
never as $0.

**Planned sources**, for capabilities that are queued and unassigned — none of these are
reached today: [Commander Spellbook](https://commanderspellbook.com) for combo data,
[Archidekt](https://archidekt.com) for deck data, and Scryfall's Tags API for tag discovery.
Comprehensive Rules text is © Wizards of the Coast; when rules lookup lands, the plugin will
resolve and fetch the official published file at runtime rather than redistribute a copy
(`docs/MCP-PRD.md` D-08).

---

Manabase is unofficial Fan Content permitted under the Fan Content Policy. Not
approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the
Coast. ©Wizards of the Coast LLC.
