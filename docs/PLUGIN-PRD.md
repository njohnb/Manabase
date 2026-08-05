# MTG Claude Plugin — PRD

> **Reading this cold?** Read [§1](#1-overview)'s boundary rule first — it tells you which of the two PRDs
> owns the question you arrived with. Sections 2 and 3 are binding. Section 4 is the dated
> research record; every claim is marked verified or inferred. Section 5 opens with the
> component template; adding a component means appending a PC block and updating sections 6,
> 7, and 9. Nothing else.

**Document status:** foundation established 2026-07-29. Two components specified ([PC-01](#pc-01--scryfall-query-craft),
[PC-02](#pc-02--bundled-mcp-server)). Two components queued and unassigned. The roadmap past Phase 1 is deliberately open.

**Build status 2026-08-04:** the server [PC-02](#pc-02--bundled-mcp-server) declares now exists —
`dist/index.js` is built and committed per [P-09](#p-09--server-ships-as-committed-built-javascript),
and `.mcp.json` points at it. **Nothing on this document's side has been verified.** The plugin
has never been installed from a marketplace, `SKILL.md` is unwritten, and
`claude plugin details` has never been run, so every PC-01 and PC-02 acceptance criterion and
every PQ remains open. Tracked as Tracks B and C in `docs/DEV-ROADMAP.md`.

**Companion document:** `docs/MCP-PRD.md` (MTG MCP Server PRD, foundation established
2026-07-29, one capability specified and delivered 2026-08-03). This document is its parent.

---

## 1. Overview

**Problem.** The MCP server specified in `docs/MCP-PRD.md` is a set of tools. Tools alone are
not a product. Someone handed `card_search` with no guidance gets a search box for a query
language they don't know — which is the exact problem [`docs/MCP-PRD.md` §1](./MCP-PRD.md#1-overview) set out to solve,
reintroduced one layer up. The plugin is the thing people actually install: it starts the
server, puts the cache somewhere that survives updates, collects any credential it needs
without anyone hand-editing a settings file, and ships the instructions that let Claude drive
the tools well on the first try.

**Audience.** The author plus roughly 5–20 friends and colleagues. Technically capable, but
not infinitely patient with setup. Same audience as [`docs/MCP-PRD.md` §1](./MCP-PRD.md#1-overview), and install friction
is the same primary adoption risk.

**What success looks like.**
- Two commands from "I want this" to working tools: `/plugin marketplace add`, then
  `/plugin install`. No config file, no credential prompt, no restart, no build step.
- A friend who has never seen Scryfall syntax asks for cards in English and gets a correct
  query, because the plugin taught Claude the syntax rather than expecting the user to know
  it.
- Adding the next component is an afternoon, because this document already settled the
  packaging, the install path, the version scheme, and how a skill's cost is measured.

**What this is not.** Not a rewrite of `docs/MCP-PRD.md`. Not a place where tool behavior gets
respecified. Not a general-purpose Magic knowledge base — the plugin routes to tools, it does
not carry card facts.

### The boundary rule

This is the load-bearing rule of both documents. It is reproduced verbatim and is not
paraphrased anywhere else:

> `docs/MCP-PRD.md` owns what the server can do — tools, data sources, capability behavior,
> acceptance criteria for tool output. `docs/PLUGIN-PRD.md` owns what the user installs and
> experiences — packaging, install, configuration, the skills and agents that shape how
> Claude uses the tools, and the harness features both rely on. A tool spec never appears in
> the plugin PRD. An install step never appears in the MCP PRD.

Three consequences that bind every future session:

1. **Never duplicate a decision from `docs/MCP-PRD.md`.** Reference it by section. Duplicated
   decisions drift, and a future session cannot tell which copy is current.
2. **Locked decisions and constraints in [`docs/MCP-PRD.md` §2](./MCP-PRD.md#2-locked-decisions) and [§3](./MCP-PRD.md#3-constraints) are inherited, not
   re-litigated.** This includes the runtime, which is settled in [`docs/MCP-PRD.md` §2](./MCP-PRD.md#2-locked-decisions) and is
   not reopened here.
3. **If a component you want would require the server to do something it does not do yet,
   that is a CAP in `docs/MCP-PRD.md`, not a PC here.** Say so and stop. Do not spec around
   it. [§6](#6-roadmap) flags where this already applies.

---

## 2. Locked decisions

Settled unless explicitly reopened. Each decision carries its rationale so later sessions inherit
the reasoning instead of re-deriving it.

**Inherited from [`docs/MCP-PRD.md` §2](./MCP-PRD.md#2-locked-decisions) — recorded here as pointers only, deliberately not
restated:** local install over stdio ([D-01](./MCP-PRD.md#d-01--distribution-local-package-over-stdio)), the runtime ([D-02](./MCP-PRD.md#d-02--runtime-nodejs--typescript)), directly-callable handlers
with no abstraction layer built to achieve it ([D-03](./MCP-PRD.md#d-03--testability-handlers-callable-as-plain-functions), [D-04](./MCP-PRD.md#d-04--no-transport-abstraction-layer)), skip SSE ([D-05](./MCP-PRD.md#d-05--transport-stdio-now-streamable-http-later-no-sse)), Scryfall as sole
price source ([D-06](./MCP-PRD.md#d-06--pricing-from-scryfall)), the three-way cache split ([D-07](./MCP-PRD.md#d-07--three-way-cache-split)), Comprehensive Rules fetched at runtime
rather than bundled ([D-08](./MCP-PRD.md#d-08--comprehensive-rules-fetched-at-runtime-never-bundled)), Archidekt writes last ([D-09](./MCP-PRD.md#d-09--archidekt-writes-land-last)), never-throw structured results
([D-10](./MCP-PRD.md#d-10--tool-handlers-never-throw)), `domain_verb_noun` tool naming ([D-11](./MCP-PRD.md#d-11--tool-naming-convention)). The plugin inherits all of these. Where one has
a plugin-side consequence, the row below says so and points at it rather than repeating it.

| # | Decision | Date |
|---|---|---|
| [P-01](#p-01--plugin-is-the-distribution-unit) | The plugin is the distribution unit; the MCP server ships inside it | 2026-07-29 |
| [P-02](#p-02--one-repo-manifest-at-the-root) | One repo. Plugin manifest and component directories at the repo root, server source under `src/` | 2026-07-29 |
| [P-03](#p-03--document-hierarchy-and-the-boundary-rule) | `docs/PLUGIN-PRD.md` is the parent document; `docs/MCP-PRD.md` is the deep spec for server behavior | 2026-07-29 |
| [P-04](#p-04--component-id-scheme) | Component IDs are `PC-0N`, flat, with type as a field rather than a prefix | 2026-07-29 |
| [P-05](#p-05--credentials-collected-through-userconfig) | Credentials are collected through `userConfig` with `sensitive: true`, never by asking anyone to hand-edit a settings file | 2026-07-29 |
| [P-06](#p-06--cached-data-lives-in-the-plugin-data-directory) | Cached data lives in `${CLAUDE_PLUGIN_DATA}`, never `${CLAUDE_PLUGIN_ROOT}` | 2026-07-29 |
| [P-07](#p-07--skills-not-commands) | New instruction-bearing components are skills, not commands | 2026-07-29 |
| [P-08](#p-08--version-scheme) | `version` is left unset in `plugin.json` during development and set to explicit semver at first public release | 2026-07-29 |
| [P-09](#p-09--server-ships-as-committed-built-javascript) | The server ships as built JavaScript committed to the repo and is started with `node` from `${CLAUDE_PLUGIN_ROOT}` | 2026-07-29 |
| [P-10](#p-10--minimum-supported-claude-code-version) | Minimum supported Claude Code version is 2.1.207 | 2026-07-29 |
| [P-11](#p-11--the-repo-is-its-own-marketplace) | The repo is its own marketplace: `.claude-plugin/marketplace.json` at the repo root, with the plugin listed by relative path. Users add it as `owner/repo`, never as a raw URL to `marketplace.json` | 2026-07-29 |
| [P-12](#p-12--plugin-name-and-server-key) | Plugin name `manabase`; MCP server key `mtg` | 2026-07-29 |
| [P-13](#p-13--no-user-configuration-in-phase-1) | [PC-02](#pc-02--bundled-mcp-server) declares no `userConfig` in Phase 1. Enabling the plugin prompts for nothing | 2026-07-29 |
| [P-14](#p-14--two-distribution-targets-one-source) | Two distribution targets from one source: the Claude Code plugin, and an MCPB bundle for the Claude Desktop Chat tab. Amends [P-01](#p-01--plugin-is-the-distribution-unit) | 2026-08-04 |

### P-01 — Plugin is the distribution unit

**Decided 2026-07-29.**

**The plugin is the distribution unit; the MCP server ships inside it.** Not a separate `npx`
incantation people paste into their MCP config.

Plugin-bundled MCP servers start automatically when the plugin is enabled ([§4.1](#41-harness-features-relied-on)), which turns
setup into two commands with no file editing. Install friction is the primary adoption risk
named in [`docs/MCP-PRD.md` §3.1](./MCP-PRD.md#31-distribution-and-install-friction), and this is the single largest lever on it.

**Amended 2026-08-04 by [P-14](#p-14--two-distribution-targets-one-source).** This decision's reasoning is unchanged and its
mechanism still governs every Claude Code surface. What it got wrong was its scope: it assumed
one distribution unit reaches every surface a user might install onto. Measured, the plugin
delivers only its *skills* to the Claude Desktop Chat tab and does not start its MCP server
there ([§4.2](#42-marketplace-and-install-path)). "The plugin is the distribution unit" is therefore true of Claude Code and false
of that surface. [P-14](#p-14--two-distribution-targets-one-source) records the second target rather than restating this one.

### P-02 — One repo, manifest at the root

**Decided 2026-07-29.**

**One repo. Plugin manifest and component directories at the repo root, server source under
`src/`.**

One clone, one version number, one tag. A split repo means two things to keep in sync for no
benefit at this scale. Also required by the harness: installed plugins cannot reference files
outside their own directory, so `../` paths break after install ([§4.1](#41-harness-features-relied-on)).

### P-03 — Document hierarchy and the boundary rule

**Decided 2026-07-29.**

**`docs/PLUGIN-PRD.md` is the parent document; `docs/MCP-PRD.md` is the deep spec for server
behavior.** The boundary rule in [§1](#1-overview) governs.

Without an explicit boundary the plugin PRD slowly absorbs tool specs and the two documents
start disagreeing. A future session cannot tell which copy of a drifted decision is current.

### P-04 — Component ID scheme

**Decided 2026-07-29.**

**Component IDs are `PC-0N`, flat, with type as a field rather than a prefix.** Not `SKL-` /
`AGT-` / `HOOK-`. IDs are stable and never reused.

A component that changes type — a skill that becomes an agent — should not change identity.
Phase tables also read better against one sequence than three.

### P-05 — Credentials collected through `userConfig`

**Decided 2026-07-29.**

**Credentials are collected through `userConfig` with `sensitive: true`, never by asking anyone
to hand-edit a settings file.**

Claude Code prompts at enable time and stores the value in the OS keychain, then substitutes it
into the MCP server config ([§4.4](#44-user-configuration)). "Solving install friction by moving work to the user" is the
failure mode this project exists to avoid. This is how the Archidekt session cookie and
`X-CSRFToken` will reach the server when [`docs/MCP-PRD.md` D-09](./MCP-PRD.md#d-09--archidekt-writes-land-last) is finally lifted. See [P-13](#p-13--no-user-configuration-in-phase-1) for
what this means in Phase 1: nothing.

### P-06 — Cached data lives in the plugin data directory

**Decided 2026-07-29.**

**Cached data lives in `${CLAUDE_PLUGIN_DATA}`, never `${CLAUDE_PLUGIN_ROOT}`.**

`CLAUDE_PLUGIN_ROOT` changes on every plugin update and the previous directory is
garbage-collected roughly two weeks later ([§4.5](#45-persistent-data)). `CLAUDE_PLUGIN_DATA` persists across updates.
The bulk Scryfall data and the rules index ([`docs/MCP-PRD.md` D-07](./MCP-PRD.md#d-07--three-way-cache-split), [D-08](./MCP-PRD.md#d-08--comprehensive-rules-fetched-at-runtime-never-bundled)) are exactly the kind
of thing that must not be re-downloaded on every version bump.

### P-07 — Skills, not commands

**Decided 2026-07-29.**

**New instruction-bearing components are skills, not commands.**

Two reasons. The docs now direct new plugins to `skills/` and treat flat `commands/` markdown
as the older form — picking one keeps the repo from ending up with both. More decisively: **a
`CLAUDE.md` at the plugin root is not loaded as context at all**, and the docs state outright
that a skill is the channel for shipping instructions into Claude's context ([§4.1](#41-harness-features-relied-on), verified).
There is no alternative to argue about.

### P-08 — Version scheme

**Decided 2026-07-29.**

**`version` is left unset in `plugin.json` during development and set to explicit semver at
first public release.** The switchover is a phase boundary.

With `version` unset, Claude Code falls back to the git commit SHA and every commit is an
update — right for the phase where the author is iterating. With it set, users only get changes
on a bump, and forgetting to bump silently ships nothing — wrong now, right once other people
depend on it.

**Condition discovered in research:** the SHA fallback only applies to `github`, `url`,
`git-subdir`, and relative-path sources in a git-hosted marketplace; an npm source or a non-git
local directory resolves to `unknown` instead ([§4.3](#43-versioning-and-updates)). [P-11](#p-11--the-repo-is-its-own-marketplace) keeps the source type inside that
set. Never set `version` in both `plugin.json` and the marketplace entry — `plugin.json` wins
silently.

### P-09 — Server ships as committed built JavaScript

**Decided 2026-07-29.**

**The server ships as built JavaScript committed to the repo and is started with `node` from
`${CLAUDE_PLUGIN_ROOT}`.** Runner-up rejected: `npx -y` the published npm package from inside
the plugin.

`npx -y <package>` introduces a **second version number** — the plugin can say v1.2 while `npx`
pulled 1.3 — which is precisely what [P-02](#p-02--one-repo-manifest-at-the-root) exists to prevent, and with 5–20 independent installs
"what version are you running" has to have one answer. Pinning the package version instead
means bumping two numbers in lockstep, which is the same problem wearing a hat. It also puts an
npm download inside the MCP startup path, where a failure means the tools silently never appear
rather than reporting an error.

Committing `dist/` costs build output in git and a rebuild per release; that is the cheaper
cost. [`docs/MCP-PRD.md` D-02](./MCP-PRD.md#d-02--runtime-nodejs--typescript)'s npm/`npx` path is **not** revoked — it survives as the secondary
route for anyone wiring the server into a non-Claude MCP client by hand, which is a different
audience from this plugin's.

### P-10 — Minimum supported Claude Code version

**Decided 2026-07-29.**

**Minimum supported Claude Code version is 2.1.207.**

2.1.207 is where `${user_config.*}` stopped substituting into shell-form hook and monitor
commands ([§4.4](#44-user-configuration)). Choosing the security-behavior-change version means every rule stated in this
document is true for every supported user, with no "except on older versions" caveat — which
matters when the support channel is a group chat. Every harness feature this plugin depends on
exists at or below that floor: `userConfig` and `sensitive`, `${CLAUDE_PLUGIN_DATA}`,
`displayName` (2.1.143), `defaultEnabled` (2.1.154). Features above the floor are usable but
must not be depended on; [§3.2](#32-minimum-harness-version) lists them.

### P-11 — The repo is its own marketplace

**Decided 2026-07-29.**

**The repo is its own marketplace: `.claude-plugin/marketplace.json` at the repo root, with the
plugin listed by relative path. Users add it as `owner/repo`, never as a raw URL to
`marketplace.json`.**

Follows from [P-02](#p-02--one-repo-manifest-at-the-root) — one repo means the catalog and the plugin ship together. The URL
restriction is not stylistic: **if a marketplace is added by direct URL to `marketplace.json`,
only that one file is downloaded and relative plugin sources do not resolve** ([§4.2](#42-marketplace-and-install-path), verified).
Keeping the source a relative path inside a git-hosted marketplace is also what keeps [P-08](#p-08--version-scheme)'s
commit-SHA fallback working.

### P-12 — Plugin name and server key

**Decided 2026-07-29.**

**Plugin name `manabase`; MCP server key `mtg`.** Short, and deliberately different from each
other.

Plugin-bundled MCP tools are callable as `mcp__plugin_<plugin-name>_<server-name>__<tool>`
([§4.1](#41-harness-features-relied-on)). `mcp__plugin_manabase_mtg__card_search` is already long; a server key equal to the
plugin name would stutter it longer for nothing. This full form is what permission rules,
`allowed-tools` entries, and hook matchers must use — a matcher written against the bare server
key never fires — so the name is worth fixing once here rather than discovering per-component.
`name` is also the stable install identifier; changing it later breaks every existing install,
so `displayName` carries any cosmetic renaming.

**Amended 2026-08-04 by [P-14](#p-14--two-distribution-targets-one-source): the scoped form above is constructed by the Claude Code
harness and is not a property of the server.** The same registered `card_search` is reached as
`mcp__plugin_manabase_mtg__card_search` in Claude Code and as `Manabase:card_search` when the
server arrives by MCPB, where the prefix comes from the manifest's `display_name` ([§4.2](#42-marketplace-and-install-path)). The
sentence above therefore governs permission rules, `allowed-tools`, and hook matchers **on the
Claude Code surface**, which is the only surface that has them. Two consequences that this
decision as originally written invites getting wrong: the string must never be written into a
skill body or any other component that travels between surfaces ([§3.6](#36-skills-carry-instructions-never-facts)), and it cannot be used
to *detect* whether the tool is present — a component that tests for it concludes "absent" on a
surface where the tool is working.

### P-13 — No user configuration in Phase 1

**Decided 2026-07-29.**

**[PC-02](#pc-02--bundled-mcp-server) declares no `userConfig` in Phase 1. Enabling the plugin prompts for nothing.**

[`docs/MCP-PRD.md` §3.1](./MCP-PRD.md#31-distribution-and-install-friction) forbids credentials for read-only capabilities and Phase 1 is [CAP-01](./MCP-PRD.md#cap-01--card-search)
alone, so there is nothing to collect. An empty enable-time prompt is the strongest available
demonstration of [P-01](#p-01--plugin-is-the-distribution-unit)'s claim. Declaring the Archidekt fields early "to prove the shape" would
show every user a credential prompt for a capability that does not exist yet — moving work to
the user for a feature they cannot use, which is the failure mode [P-05](#p-05--credentials-collected-through-userconfig) exists to prevent. [P-05](#p-05--credentials-collected-through-userconfig)
still governs *how* credentials arrive when they do.

### P-14 — Two distribution targets, one source

**Decided 2026-08-04. Amends [P-01](#p-01--plugin-is-the-distribution-unit).**

**Two distribution targets are built from one source tree: the Claude Code plugin
([PC-02](#pc-02--bundled-mcp-server)), and an MCPB bundle for the Claude Desktop Chat tab ([PC-03](#pc-03--mcpb-bundle-for-the-chat-tab)). `src/`, `dist/`, and
`skills/` are shared and never forked.**

The two are different pipes, and a user on the Chat tab needs both. Measured 2026-08-04 ([§4.2](#42-marketplace-and-install-path)):
installing the plugin from the marketplace delivers `skills/` to that surface and does **not**
start the MCP server there, while an MCPB bundle installed into Claude Desktop does expose the
server there. Neither target reaches the surface alone.

**Why one source and not two repos.** The server is byte-identical across both, and so is the
skill. What differs is a manifest and a release artifact — packaging, not behavior. Forking the
repo would duplicate every decision in this document and in [`docs/MCP-PRD.md`](./MCP-PRD.md), including the three
price traps and the rate-limit lanes, with nothing enforcing that the copies stay in step. That
is the exact failure [P-03](#p-03--document-hierarchy-and-the-boundary-rule) and [P-02](#p-02--one-repo-manifest-at-the-root) are built to prevent, and the duplication would be silent.

**What this does not extend to.** Claude on the **web** is out of reach and stays out of scope
([§8](#8-out-of-scope)). No local process is reachable from a browser session, so serving it would mean a hosted
remote MCP server — which would also funnel every user's traffic through a single Scryfall
client identity, against an API whose rate limits are a hard constraint and whose ban risk
applies to the whole application ([`docs/MCP-PRD.md` §3.4](./MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance)). That is a different product, not a
third target.

**The cost this accepts.** A second artifact must be built and released, and [P-09](#p-09--server-ships-as-committed-built-javascript)'s stale-`dist/`
trap now has two ways to ship — tracked as [PQ-06](#pq-06--what-keeps-the-committed-dist-honest). MCPB also requires a `version` where [P-08](#p-08--version-scheme)
deliberately leaves one unset, which is [PQ-09](#pq-09--how-does-the-mcpb-manifest-version-relate-to-p-08).

---

## 3. Constraints

Boundaries, not choices. Decisions in [§2](#2-locked-decisions) are made *within* these.

[`docs/MCP-PRD.md` §3](./MCP-PRD.md#3-constraints) applies in full and is not restated: install friction as a product
requirement ([§3.1](./MCP-PRD.md#31-distribution-and-install-friction)), the testability rules ([§3.2](./MCP-PRD.md#32-testability)), the Fan Content Policy and Scryfall data-use
terms ([§3.3](./MCP-PRD.md#33-legal-and-terms-of-service)), rate limits as hard constraints ([§3.4](./MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance)), community tag data ([§3.5](./MCP-PRD.md#35-community-sourced-tag-data)), and the
never-over-claiming error surface ([§3.6](./MCP-PRD.md#36-error-surface)). The constraints below are the ones that exist only
because this is a plugin.

### 3.1 Context budget

This is the constraint most likely to be violated by accident, because **the failure is
silent**.

- **The skill listing is capped at a fraction of the context window.**
  `skillListingBudgetFraction` defaults to `0.01` — 1% — for the listing of every skill name
  and description the model sees each turn. **[verified 2026-07-29]**
- **When the listing overflows, Claude Code drops descriptions starting with the least-used
  skills, keeping only their names.** The skill remains invocable but the model can no longer
  see what it is for, so automatic invocation stops working. Nothing errors.
  **[verified 2026-07-29]**
- **Per-entry cap:** `description` plus `when_to_use` is truncated at 1,536 characters
  (`skillListingMaxDescChars`). Put the key use case first. **[verified 2026-07-29]**
- **The budget is shared with everything else the user has installed.** This plugin cannot
  fix that: a plugin's root `settings.json` supports only the `agent` and
  `subagentStatusLine` keys, so it **cannot** ship a raised `skillListingBudgetFraction` on
  the user's behalf. **[verified 2026-07-29]**
- **Invoked skill content persists for the whole session** and is never re-read from disk.
  After compaction, Claude Code re-attaches only the **first 5,000 tokens** of each skill's
  most recent invocation, within a **25,000-token combined budget** across all skills.
  **[verified 2026-07-29]** A `SKILL.md` body past ~5,000 tokens loses its tail at the first
  compaction, so bulk belongs in supporting files, not in the body.

**What this requires of every component.** Always-on cost is paid by every session in every
project whether the component fires or not, including sessions that have nothing to do with
Magic. A component that cannot justify its always-on cost should be merged into another one.
`disable-model-invocation: true` removes a skill's description from context entirely — that is
the lever for anything that should be free until explicitly invoked, at the price of Claude
never reaching for it unprompted.

### 3.2 Minimum harness version

**2.1.207** ([P-10](#p-10--minimum-supported-claude-code-version)). Below the floor the plugin is unsupported, not merely degraded — the
`${user_config.*}` shell-substitution behavior differs, which is a security-relevant
difference rather than a cosmetic one.

Features above the floor may be used but must not be depended on, and a component that needs
one is choosing to raise the floor:

| Feature | Floor | **[verified 2026-07-29]** |
|---|---|---|
| Skill-listing budget accounted correctly in `/context` | 2.1.196 | below this the reported number is inflated |
| `renames` map for migrating a changed plugin name | 2.1.193 | below this, plugin-not-found |
| LSP `restartOnCrash` / `shutdownTimeout` | 2.1.205 | not used — [§8](#8-out-of-scope) |
| Qualified `plugin-name@marketplace` uninstall precision | 2.1.212 | matters only with a name collision |
| Plugin skill frontmatter `name` keeps the plugin prefix | 2.1.216 | below this, `/manabase:x` does not autocomplete |
| `yes`/`no`/`on`/`off` boolean frontmatter aliases | 2.1.218 | avoid; write `true`/`false` |
| Forked skills with `background: false` | 2.1.218 | not used in Phase 1 |

Development reference: the author's machine is on 2.1.220. **[verified 2026-07-29]**

### 3.3 Trust and sandboxing

- **The plugin is trusted code running on the user's machine.** That is the same posture
  [`docs/MCP-PRD.md` D-01](./MCP-PRD.md#d-01--distribution-local-package-over-stdio) already implies, and it is the reason the credential story in [P-05](#p-05--credentials-collected-through-userconfig)
  is acceptable at all. It also means the plugin must not do anything a user would be
  surprised by: no telemetry, no outbound calls to hosts other than the ones enumerated in
  [`docs/MCP-PRD.md` §4](./MCP-PRD.md#4-external-dependencies).
- **At user scope, a plugin's MCP server starts with no separate per-server approval.** At
  project scope it goes through the same approval as a project `.mcp.json`, LSP servers wait
  on workspace trust, and monitors do not load at all. **[verified 2026-07-29]** This plugin
  targets user scope, which is the default.
- **Plugin-shipped agents cannot declare `hooks`, `mcpServers`, or `permissionMode`** — the
  harness withholds these for security reasons. **[verified 2026-07-29]** Any future agent
  component reaches the server through the normal scoped tool name ([P-12](#p-12--plugin-name-and-server-key)), not by declaring
  its own server.
- **Installed plugins cannot reference files outside their own directory.** `../` paths break
  after install because those files are never copied into the plugin cache.
  **[verified 2026-07-29]** This is the harness half of [P-02](#p-02--one-repo-manifest-at-the-root).

### 3.4 Cross-platform reach

The audience runs Windows, macOS, and Linux; the author's own machine is Windows. Two
consequences:

- **Hooks are the platform-fragile component.** A shell-form hook command runs under `sh -c`
  on macOS and Linux, **Git Bash on Windows, or PowerShell when Git Bash is not installed**.
  **[verified 2026-07-29]** A bash script is therefore a coin flip on a Windows machine. Any
  future hook component must use **exec form** — `command` plus `args`, spawned directly with
  no shell — or ship a script whose interpreter is guaranteed present. This is also part of
  why [P-09](#p-09--server-ships-as-committed-built-javascript) rejected the install-time hook approach.
- **The only runtime prerequisite is Node on `PATH`**, inherited from [`docs/MCP-PRD.md` D-02](./MCP-PRD.md#d-02--runtime-nodejs--typescript).
  [P-09](#p-09--server-ships-as-committed-built-javascript) keeps it at exactly that: no build toolchain, no `npm install`, no Python, no shell.

  **Amended 2026-08-04 by [P-14](#p-14--two-distribution-targets-one-source): this holds for the plugin target and not for the MCPB
  target.** Claude Desktop ships its own Node runtime on macOS and Windows, so a bundle
  installed per [PC-03](#pc-03--mcpb-bundle-for-the-chat-tab) has *no* runtime prerequisite at all. The asymmetry runs the useful
  direction — the target with the least technical audience is the one that needs least — but it
  means "does the user have Node?" is the first diagnostic question for one target and
  meaningless for the other. Any install troubleshooting the README carries must say which
  target it is talking about.

### 3.5 What the user must see, and must not

- **Enabling the plugin in Phase 1 must produce zero prompts** ([P-13](#p-13--no-user-configuration-in-phase-1)). An install that asks a
  question it does not need to ask has already lost the argument [P-01](#p-01--plugin-is-the-distribution-unit) was making.
- **The Fan Content Policy disclaimer required verbatim by [`docs/MCP-PRD.md` §3.3](./MCP-PRD.md#33-legal-and-terms-of-service) must appear
  on the plugin's user-facing surfaces**, which are broader than that document could name:
  the `description` in `plugin.json`, the marketplace entry, and the repo README. This is a
  plugin-side obligation because these surfaces exist only here.
  **Amended 2026-08-04 by [P-14](#p-14--two-distribution-targets-one-source):** the MCPB manifest's `description` is a fourth such
  surface, and the most prominent of them — Claude Desktop renders it in the install dialog the
  user approves ([PC-03](#pc-03--mcpb-bundle-for-the-chat-tab)). A second distribution target means a second place this can be omitted,
  and the list is now long enough that it is worth checking mechanically rather than by memory.
- **The plugin must not ship anything that gates card data** — no survey, no Discord join, no
  account. Prohibited by [`docs/MCP-PRD.md` §3.3](./MCP-PRD.md#33-legal-and-terms-of-service), restated here only because a plugin has
  install-time surfaces where such a gate would physically fit.

### 3.6 Skills carry instructions, never facts

A skill is text loaded into context. Card data inside a skill is a hallucination source that
also goes stale silently, and it cannot be corrected by a tool call because the model has no
reason to doubt it. Every factual claim about a card, price, legality, or rule must be reached
by calling the server. This constrains component content, not just [PC-01](#pc-01--scryfall-query-craft), and it is why
[PC-01](#pc-01--scryfall-query-craft)'s acceptance criteria in [§5](#5-components) include a negative check.

---

## 4. Harness and delivery

Every claim below is marked **[verified]** (read in live documentation or observed on the
author's machine on the stated date) or **[inferred]** (reasoned from documentation, not
directly observed).

**Date verified for this entire section:** 2026-07-29, against
`https://code.claude.com/docs/en/plugins-reference`, `/plugin-marketplaces`, `/plugins`,
`/skills`, `/sub-agents`, `/hooks`, `/mcp`, and `/settings`, plus `claude plugin details` run
locally on Claude Code 2.1.220.

### 4.1 Harness features relied on

**Component types available to a plugin.** Skills, commands, agents, hooks, MCP servers, LSP
servers, workflows, output styles, `bin/` executables, plus experimental monitors and themes.
**[verified]** This plugin uses skills and MCP servers; [§8](#8-out-of-scope) records why the rest are out.

**Component locations.** All component directories sit at the plugin root; only
`plugin.json` lives in `.claude-plugin/`. **[verified]** Components inside `.claude-plugin/`
silently fail to load, which is the single most common reported mistake.

**Skills.** `skills/<name>/SKILL.md`, with optional supporting files alongside.
**[verified]** The mechanics that matter to this plugin:

- `description` drives automatic invocation; `when_to_use` appends to it; both share the
  1,536-character cap ([§3.1](#31-context-budget)).
- **Supporting files are the progressive-disclosure mechanism** — `SKILL.md` stays focused
  and Claude reads the reference file only when needed. **[verified]** This is what makes a
  syntax-heavy skill affordable, and it is the shape [PC-01](#pc-01--scryfall-query-craft) takes.
- `${CLAUDE_SKILL_DIR}` and `${CLAUDE_PROJECT_DIR}` substitute in skill content and in
  `allowed-tools` Bash rules.
- Non-sensitive `userConfig` values substitute into skill and agent **content**, not just
  configs and hook commands. **[verified — broader than previously recorded.]**
- Live change detection: for a plugin installed from a marketplace, a component change
  requires `/reload-plugins`; only skills-directory plugins pick up `SKILL.md` edits
  immediately. **[verified]**

**Addendum — the frontmatter is parsed as YAML, and a skill whose frontmatter does not parse is
dropped in silence. [verified 2026-08-04]** The bullets above describe `description` and
`when_to_use` as text under a character cap and say nothing about their syntax. Both are YAML
values, and an unquoted YAML plain scalar **cannot contain `": "`** — a colon followed by a
space. [`skills/scryfall-query-craft/SKILL.md`](../skills/scryfall-query-craft/SKILL.md) carried
the unquoted string `Magic: The Gathering` in both values as written in
[Slice 8](./slices/TrackB-Slice8.md), and a real YAML parser rejects the block with
`Nested mappings are not allowed in compact mappings at line 2, column 14`. Observed
consequences, all machine-captured 2026-08-04:

- **The skill never loaded in any harness.** `/reload-plugins` reported **`0 skills`** for an
  installed plugin whose three skill files were all confirmed present on disk in the install
  cache directory. There is no error, no warning, and no diagnostic on any surface.
- **`/reload-plugins`' own skill count is not the signal, and must not be used as one.** It
  reported `0 skills` **after** the fix as well, in the same session in which the skill
  demonstrably loaded — so the count reads `0` in both the broken and the working state and
  discriminates nothing. What actually distinguishes them is **whether the skill appears in the
  session's skill listing**: absent while the frontmatter was unparsable, and present as
  `manabase:scryfall-query-craft` with its full `description` and `when_to_use` once quoted.
  Any check that a skill loaded must assert that positive listing.
- **The update mechanism was not at fault**, and was ruled out first: the installed plugin was
  confirmed updated across a real push, with all three skill files present under the new
  install path.
- **Line endings were not the cause**, though they were the leading hypothesis and are a
  documented hazard for this repo. The frontmatter fails **identically** CRLF and
  LF-normalized; parsing `description: Magic: The Gathering cards` in isolation fails and
  `description: "Magic: The Gathering cards"` parses. That the GitHub blob is LF while the
  harness's marketplace clone and install cache are CRLF under `core.autocrlf=true` is all
  true and all incidental here.

Fixed by double-quoting both values (branch `fix/skill-frontmatter-yaml`, `ed82ceb`, PR #22); the
prose is byte-identical otherwise and `Magic: The Gathering` is preserved. **Verified loaded after
the fix, 2026-08-04:** the skill appears in the session skill listing as
`manabase:scryfall-query-craft`. The bullets above are left as recorded — nothing in them is
wrong, only silent on the syntax that makes them loadable.

**MCP servers.** `.mcp.json` at the plugin root, or inline in `plugin.json`. **[verified]**

- **Servers for enabled plugins connect automatically at session startup.** **[verified]**
  This is the mechanism [P-01](#p-01--plugin-is-the-distribution-unit) depends on.
- **Scoped tool name:** `mcp__plugin_<plugin-name>_<server-name>__<tool-name>`, with any
  character outside `A-Z a-z 0-9 _ -` replaced by `_`. The server itself registers as
  `plugin:<plugin-name>:<server-name>`. **[verified]** See [P-12](#p-12--plugin-name-and-server-key). **A hook matcher or
  permission rule written against the bare server key never fires.**
- `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, and `${CLAUDE_PROJECT_DIR}` substitute in
  `command`, `args`, and `env` for stdio servers, and are also exported as environment
  variables to the server process. **[verified]**
- **`/reload-plugins` keeps the live connection of any plugin server whose configuration is
  unchanged**, and reconnects the rest. It does *not* restart monitors — those need a session
  restart. When a plugin updates mid-session, hooks and servers keep using the old
  `CLAUDE_PLUGIN_ROOT` until a reload. **[verified]**
- A user can toggle a plugin's server off in `/mcp` without uninstalling the plugin.
  **[verified]**

**Hooks — noted but unused in Phase 1.** The lifecycle event list is long (`SessionStart`,
`PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PreCompact`, `SessionEnd`, and roughly
twenty-five more) and hook types are `command`, `http`, `mcp_tool`, `prompt`, and `agent`.
**[verified]** Two facts a future hook component must not rediscover: exec form versus shell
form ([§3.4](#34-cross-platform-reach)), and that a hook targeting this plugin's own server needs the scoped names from
[P-12](#p-12--plugin-name-and-server-key).

**Agents — noted but unused.** Plugin agents support `name`, `description`, `model`, `effort`,
`maxTurns`, `tools`, `disallowedTools`, `skills`, `memory`, `background`, and `isolation`
(only value: `worktree`). `hooks`, `mcpServers`, and `permissionMode` are withheld for
security reasons. A subfolder inside a plugin's `agents/` becomes part of the scoped
identifier. **[verified]** Recorded now because a queued component may turn out to be
agent-shaped ([§6](#6-roadmap)).

**Settings the plugin can and cannot ship.** A `settings.json` at the plugin root applies
default configuration when the plugin is enabled, but **only the `agent` and
`subagentStatusLine` keys are currently supported**. **[verified]** The plugin cannot raise
the user's skill-listing budget ([§3.1](#31-context-budget)).

**Risk if these change.** Moderate, and unavoidable. The plugin surface is first-party and
moves fast — this research session found behavior changes at 2.1.196, 2.1.202, 2.1.205,
2.1.207, 2.1.210, 2.1.211, 2.1.212, 2.1.216, and 2.1.218, which is roughly one behavioral
change per two patch releases in the areas this plugin touches. Mitigation is [P-10](#p-10--minimum-supported-claude-code-version) (a stated
floor, so a report can be reproduced) and keeping the dependency surface small: skills and one
stdio MCP server are the two most stable component types, and both predate every version floor
in [§3.2](#32-minimum-harness-version). The features most likely to shift under this plugin are the skill-listing budget
mechanics, since they are the newest and the only ones with a silent failure mode.

### 4.2 Marketplace and install path

**The path a user actually types.** **[verified]**

```
/plugin marketplace add <owner>/<repo>
/plugin install manabase@<marketplace-name>
```

Two commands, no file editing, no restart. This is the claim [P-01](#p-01--plugin-is-the-distribution-unit) rests on and it is
confirmed.

**Catalog schema.** `.claude-plugin/marketplace.json` at the repo root. Requires `name` and
an `owner`, plus a `plugins` array where each entry needs at minimum `name` and `source`. An
entry may carry any field from the plugin manifest schema, plus the marketplace-only fields
`source`, `category`, `tags`, `strict`, and `relevance`. **[verified]**

**Source types.** `github` (`repo`, `ref?`, `sha?`), `url` (`url`, `ref?`, `sha?`),
`git-subdir`, `npm`, and relative paths. Relative paths resolve against the marketplace root
— the directory containing `.claude-plugin/` — and `../` outside the marketplace root is not
allowed. **[verified]** Per [P-11](#p-11--the-repo-is-its-own-marketplace) this plugin uses a relative path.

**Commit pinning.** `sha` takes a full 40-character commit SHA and wins over `ref` when both
are set. Pinning is available on **plugin** sources but not on the **marketplace** source,
which supports `ref` only. **[verified]** Not used here — [P-08](#p-08--version-scheme) wants every commit to be an
update during development — but recorded because it is the mechanism if a friend ever needs to
be held at a known-good commit while a regression is fixed.

**Precedence between the marketplace entry and `plugin.json`.** **[verified]**

| Field | Winner |
|---|---|
| `version` | `plugin.json`, silently, with no warning |
| `defaultEnabled` | the marketplace entry |
| component definitions | `plugin.json` when `strict` is `true` (the default); the marketplace entry can supplement it |
| plugin identity in `enabledPlugins` / `/plugin` | the marketplace entry's `name` |

**The trap that constrains the install instructions.** If a user adds the marketplace by a
**direct URL to `marketplace.json`**, only that file is downloaded and **relative plugin
sources do not resolve**. **[verified]** The README must give the `owner/repo` form and not
offer a URL alternative. This is why [P-11](#p-11--the-repo-is-its-own-marketplace) is a decision rather than an implementation detail.

**Validation.** `claude plugin validate .` checks `plugin.json`, skill and agent frontmatter,
and `hooks/hooks.json`. Unrecognized top-level manifest fields are warnings, not errors;
wrong-typed fields are errors. `--strict` promotes warnings, which is the form worth running
before every release. **[verified]**

**Risk if it changes or disappears.** Low. The install path is the most stable part of the
plugin surface and any change would be widely breaking. The real risk is *user* error rather
than platform change — specifically the raw-URL trap above, which produces a confusing partial
failure. Mitigation is documentation, and it is the reason that fact is recorded as a locked
decision.

#### Addendum 2026-08-04 — the install path is surface-dependent, and the plugin does not carry its server everywhere

Everything above was measured against Claude Code and remains true there. It is **not** the
whole install path, because a plugin now installs onto surfaces that run it differently.
Measured live on Claude Desktop, all **[verified 2026-08-04]**:

- **A plugin installed from this repo's marketplace onto the Desktop *Chat* tab delivers
  `skills/` and does not start the MCP server.** The Chat tab's tool catalog held only
  account-level connectors. The plugin's `.mcp.json` is a Claude Code mechanism; nothing on
  that surface starts a local stdio process from it.
- **The Desktop *Code* tab is Claude Code**, and the plugin works there unmodified — same
  marketplace, same `.mcp.json`, same scoped tool name. No second artifact is needed for it.
- **An MCPB bundle installed into Claude Desktop does expose the server to the Chat tab**, as
  `Manabase:card_search`. That prefix derives from the MCPB manifest's **`display_name`**
  (`Manabase`), **not** its `name` (`manabase-mtg`).
- **The scoped tool name is constructed per surface and is not a property of the server.**
  `mcp__plugin_manabase_mtg__card_search` in Claude Code ([P-12](#p-12--plugin-name-and-server-key)) and `Manabase:card_search`
  via MCPB are the same registered `card_search`. [P-12](#p-12--plugin-name-and-server-key) governs permission rules,
  `allowed-tools`, and hook matchers **on the Claude Code surface only**; it was never a
  portable identifier and must not be written into a skill body ([§3.6](#36-skills-carry-instructions-never-facts), [PC-01](#pc-01--scryfall-query-craft)).

**The failure this exposed, and why it is recorded here rather than as a bug.** A skill reaching
a surface where its tool does not exist does not fail visibly. Asked for commanders on the Chat
tab, the model correctly identified the tool as absent — naming the missing
`mcp__plugin_manabase_mtg__card_search` in its reasoning — and then answered from a **web search
of Scryfall's search pages** without telling the user. Ten plausible links; card claims grounded
in nothing the server returned. That is the silent-degradation class this project already pays
for elsewhere, arriving through the install path: an installed plugin made answers *less*
grounded than no plugin at all. The mitigation is a no-fallback rule in [PC-01](#pc-01--scryfall-query-craft)'s skill body,
not a packaging change.

**A skill that loads is not a skill that works.** Both propositions were true simultaneously on
that surface: the skill loaded and the capability was unreachable. Every [PC-01](#pc-01--scryfall-query-craft) criterion
satisfiable by reading or measuring the file passed there. Whether [PC-01](#pc-01--scryfall-query-craft) needs a
loads-*and*-fires criterion is raised in [§9](#9-revision-log) and still undecided.

### 4.3 Versioning and updates

**Version resolution order.** `version` in `plugin.json`, then `version` in the marketplace
entry, then the git commit SHA of the plugin's source, then the literal `unknown`.
**[verified]**

**The SHA fallback is conditional.** It applies to `github`, `url`, `git-subdir`, and
relative-path sources **inside a git-hosted marketplace**. For an **npm source, or a local
directory not inside a git repository, the version resolves to `unknown`**. **[verified]**
[P-08](#p-08--version-scheme)'s development-phase half therefore depends on the source type staying inside that set,
which [P-11](#p-11--the-repo-is-its-own-marketplace) guarantees. This is the mechanism by which "leave `version` unset" could quietly
stop working, so it belongs in the record rather than in someone's memory.

**Update semantics.** Version is the cache key. If the resolved version matches what is
installed, `/plugin update` and auto-update skip the plugin and report that it is already
current — so with an explicit `version` set, pushing commits without bumping it ships nothing.
**[verified]** Each installed version is a separate directory in `~/.claude/plugins/cache`;
the previous version's directory is marked orphaned and removed 14 days later, which is a
grace period for sessions that already loaded it. Glob and Grep skip orphaned directories.
**[verified]**

**Renaming.** `name` is the stable install identifier — users reference it in
`enabledPlugins`, `pluginConfigs`, and `/plugin install`. Changing it breaks every existing
install unless a top-level `renames` map migrates them, and that migration needs 2.1.193.
`displayName` changes the UI label with no such cost. **[verified]** [P-12](#p-12--plugin-name-and-server-key) fixes `name` once
for this reason.

**Release tagging.** `claude plugin tag` creates a release git tag for a plugin, with
`--push`, `--dry-run`, and a `%s` version placeholder in the message. **[verified]** Relevant
at the [P-08](#p-08--version-scheme) switchover, not before.

**Risk if it changes or disappears.** Low-moderate. The version scheme is well documented and
the failure modes are loud in both directions — a stale explicit `version` visibly ships
nothing, and `unknown` visibly never updates. The one genuinely quiet failure is the
`plugin.json`-wins-silently rule, which is why [P-08](#p-08--version-scheme) states it as a prohibition.

### 4.4 User configuration

Not used in Phase 1 ([P-13](#p-13--no-user-configuration-in-phase-1)). Recorded in full because [P-05](#p-05--credentials-collected-through-userconfig) commits to this mechanism and the
Archidekt capability will need it.

**How it works.** `userConfig` in `plugin.json` declares options that Claude Code prompts for
at enable time. Each option needs `type` (`string`, `number`, `boolean`, `directory`, or
`file`), `title`, and `description`; optional fields are `sensitive`, `required`, `default`,
`multiple`, and `min`/`max`. Keys must be valid identifiers. **[verified]**

**Where values go.** Non-sensitive values are stored under `pluginConfigs` in
`~/.claude/settings.json`. **Sensitive values go to the macOS Keychain, or to
`~/.claude/.credentials.json` on platforms with no supported keychain. Keychain storage is
shared with OAuth tokens and has an approximately 2 KB total limit**, so sensitive values must
stay small. **[verified]** An Archidekt session cookie is comfortably inside that; a long list
of them would not be.

**Where values can be read.** Substituted as `${user_config.KEY}` into MCP and LSP server
configs and hook commands; non-sensitive values also into skill and agent content. All values
are exported to hook processes as `CLAUDE_PLUGIN_OPTION_<KEY>`. **[verified]**

**Where they are rejected, and the alternative.** **[verified — the rejection list is longer
than previously recorded.]**

| Rejected field | How to pass the value instead |
|---|---|
| Shell-form hook commands | use exec form with `args`, or read `CLAUDE_PLUGIN_OPTION_<KEY>` from the hook's environment |
| Monitor commands | read it from a config file the script owns |
| MCP `headersHelper` | read it from a config file the script owns |

Substituting into a shell command would let the shell execute whatever the value contains, so
the component fails with an error rather than substituting. This changed in **2.1.207** and is
the reason that version is the floor ([P-10](#p-10--minimum-supported-claude-code-version)). Not a live concern for this plugin — an stdio
server substitutes in `command`, `args`, and `env`, none of which are rejected — but the
rejection is the kind of thing a future hook component would otherwise hit at the worst
moment.

**Which settings sources are read, and which are deliberately ignored.** `pluginConfigs` is
read from **only** three sources: user settings (`~/.claude/settings.json`, where the
enable-time prompt writes), the `--settings` flag or SDK inline settings, and managed
settings. Precedence is managed, then `--settings`, then user. **Entries in a project's
`.claude/settings.json` or `.claude/settings.local.json` are ignored** — both live in the
workspace, so a cloned repository could otherwise supply values that flow into hook commands
and server configs. This restriction is specific to `pluginConfigs`; `enabledPlugins` still
honors project and local scopes. **[verified]** Consequence for this plugin: a credential
cannot be committed to a repo for a teammate's convenience, and should not be attempted.

**Risk if it changes or disappears.** Moderate, and deferred. The mechanism is young — its
substitution semantics changed at 2.1.207 — and [P-05](#p-05--credentials-collected-through-userconfig) has no fallback that does not violate
itself, since the alternative is asking users to hand-edit a settings file. The exposure is
bounded by [P-13](#p-13--no-user-configuration-in-phase-1) and by [`docs/MCP-PRD.md` D-09](./MCP-PRD.md#d-09--archidekt-writes-land-last): nothing depends on this until Archidekt writing
is specified, at which point the mechanism should be re-verified rather than trusted from this
record.

### 4.5 Persistent data

**Resolution.** `${CLAUDE_PLUGIN_DATA}` resolves to `~/.claude/plugins/data/{id}/`, where
`{id}` is the plugin identifier with any character outside `a-z A-Z 0-9 _ -` replaced by `-`.
For a plugin installed as `manabase@<marketplace>`, that is
`~/.claude/plugins/data/manabase-<marketplace>/`. It is created on first reference and
**survives plugin updates**. **[verified]**

**Deletion.** Deleted automatically when the plugin is uninstalled from the last scope where
it is installed. `/plugin` shows the directory size and prompts first; the CLI deletes by
default and `--keep-data` preserves it. **[verified]**

**Why `CLAUDE_PLUGIN_ROOT` is wrong for this.** It changes on every update, and the previous
version's directory is removed roughly 14 days later. **[verified]** This is [P-06](#p-06--cached-data-lives-in-the-plugin-data-directory).

**A consequence for the server that this document is the right place to record.**
`CLAUDE_PLUGIN_DATA` is set only when the server runs as a plugin component. Since
[`docs/MCP-PRD.md` D-02](./MCP-PRD.md#d-02--runtime-nodejs--typescript) also makes the server runnable standalone, it needs a cache-directory
rule: **use `$CLAUDE_PLUGIN_DATA` when present, otherwise a platform-appropriate user cache
directory** — read once at the entry point and passed down, as [`docs/MCP-PRD.md` §3.2](./MCP-PRD.md#32-testability)
requires. **[inferred: the harness behavior is verified; the fallback rule is this document's
conclusion from it.]** This partially answers [`docs/MCP-PRD.md` OQ-03](./MCP-PRD.md#oq-03--what-is-the-bulk-data-storage-strategy-and-when-is-it-introduced), which asked where bulk
data lives on a user's machine; the remaining half of that question — refresh triggers and
whether first run blocks on a download — stays open there and is touched by [PQ-03](#pq-03--what-triggers-a-refresh-of-the-bulk-data-and-the-comprehensive-rules-cache-and-should-it-ever-be-a-sessionstart-hook) below.

**Implemented 2026-08-04** in the server's entry-point config, exactly as stated above:
`CLAUDE_PLUGIN_DATA` when set and non-empty, otherwise `%LOCALAPPDATA%\manabase` on Windows,
`~/Library/Caches/manabase` on macOS, and `$XDG_CACHE_HOME/manabase` or `~/.cache/manabase`
elsewhere. Resolved once and passed down, with the platform injectable so the branches are
testable. **The rule is exercised but not yet observed under the harness** — nothing writes to
the directory during Phase 1, and PC-02 criteria 5 and 7 (data surviving `/plugin update`, and
standalone resolution with the variable unset) are install-surface checks that still require
Slice 7.

**Risk if it changes or disappears.** Low. The directory contract is explicit and the
migration story is the point of the feature. The residual risk is the reverse: because the
directory outlives any single plugin version, a stale cache can survive an update that changed
what the cache should contain. The documented pattern is to compare a bundled manifest against
a copy in the data directory rather than testing for existence — worth remembering when the
bulk-data capability lands, not before.

### 4.6 Context cost accounting

**The measurement tool.** `claude plugin details <name>` reports a component inventory and two
figures per component: **always-on** (tokens added to every session by listing text — skill
descriptions, agent descriptions, command names — whether or not anything fires) and
**on-invoke** (tokens a component costs each time it fires). **[verified]**

**How the numbers are produced, which matters for how much to trust them.** The always-on
total is computed via the `count_tokens` API for the active model; **per-component numbers are
proportionally scaled from that total**, not measured independently. If the API is
unreachable, the command falls back to a character-based estimate. **[verified]** So
per-component figures are indicative of relative weight, and the plugin total is the
trustworthy number.

**Grounding measurement, taken on the author's machine.** `claude plugin details
dotnet-plugin@dotnet-plugin`, Claude Code 2.1.220: **[verified]**

| Measure | Value |
|---|---|
| Components | 20 skills, 0 agents, 0 hooks, 0 MCP servers |
| Always-on, whole plugin | ~1,722 tokens |
| Always-on, per skill | ~30 – ~230 tokens |
| On-invoke, per skill | ~560 – ~2,900 tokens |

This is the basis for every context-cost estimate in [§5](#5-components): a skill with a short description sits
near 30–60 always-on tokens, one with a rich multi-sentence description near 200, and a
substantial `SKILL.md` body lands in the 1–3k on-invoke range. Hooks are reported as
"harness-only — no model context cost". **[verified]**

**What is not accounted for.** The example output lists MCP servers in the inventory but the
documentation does not state whether an MCP server's tool schemas are counted in the always-on
total. Tool definitions do consume context, and unlike a skill description they cannot be
budget-trimmed. **[inferred: not stated either way in the docs; the server is not running when
the command executes, which suggests they are not counted.]** This is [PQ-01](#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports), and it matters
because [PC-02](#pc-02--bundled-mcp-server)'s true always-on cost is the one number [§5](#5-components) cannot currently state.

**Risk if it changes or disappears.** Low as a dependency — nothing at runtime relies on
`plugin details`. But it is the only instrument for [§3.1](#31-context-budget), so if its accounting changes, the
cost figures in [§5](#5-components) become unverifiable rather than merely stale. Re-run it at each phase
boundary and record the result in [§9](#9-revision-log) rather than treating the numbers here as durable.

---

## 5. Components

### Component block template

Reproduce this schema for every new component. Do not modify it.

```
### PC-0N — <short name>
- **Type:** skill | agent | hook | mcp-server | command | output-style | bin
- **Status:** proposed | specified | deferred
- **Phase:** N | unassigned
- **User need:** one or two sentences in my voice, not feature language
- **Surface:** how it is reached — auto-invoked by description, `/name`, `@mention`,
  lifecycle event, or tool call
- **Behavior:** precise enough to build against
- **Depends on:** other PC-IDs, CAP-IDs in docs/MCP-PRD.md, harness features
- **Context cost:** always-on and on-invoke estimates, with the basis for each
- **Acceptance criteria:** checkable statements, not aspirations
- **Open questions:** or "none"
```

**IDs are stable and never reused.** Adding a component means appending a PC block and
updating [§6](#6-roadmap), [§7](#7-open-questions), and [§9](#9-revision-log) — nothing else.

**`Context cost` is not decoration.** Every skill and agent description is paid in every
session whether or not it fires, against a shared budget that degrades silently ([§3.1](#31-context-budget)). A
component that cannot justify its always-on cost should be merged into another one. State the
basis, not just the number — [§4.6](#46-context-cost-accounting) has the measurement to compare against.

---

### PC-01 — Scryfall query craft

- **Type:** skill
- **Status:** specified
- **Phase:** 1
- **User need:** I want to ask for cards the way I'd ask a friend — "cheap green ramp that's
  legal in my commander deck" — and have Claude write the actual Scryfall query, including the
  operators I'd never remember, without me teaching it the syntax every session.
- **Surface:** auto-invoked by description when a request is about finding or filtering Magic
  cards. Also reachable as `/manabase:scryfall-query-craft`. Not
  `disable-model-invocation` — the entire point is that it fires without being asked, which is
  what makes its always-on cost worth paying.
- **Behavior:**
  - Teaches the Scryfall query language to Claude at the point of use: the operator
    vocabulary, comparison forms, boolean and grouping syntax, the regex form `o:/…/`, the
    oracle-tag operators `otag:` / `function:`, and the art-tag operators `art:` / `atag:`.
    These are ordinary search operators, not a separate integration — as established in
    [`docs/MCP-PRD.md` §4.1.1](./MCP-PRD.md#411-search-endpoint).
  - **Routes every factual claim to the server ([§3.6](#36-skills-carry-instructions-never-facts)).** The skill contains query syntax and
    query-construction strategy. It contains no card names as examples of *facts*, no oracle
    text, no prices, no legality assertions, and no combo claims. Where an example query
    needs a card name, it is unambiguously an illustration of syntax rather than a statement
    about the card.
  - **Structured as `SKILL.md` plus supporting reference files** ([§4.1](#41-harness-features-relied-on)). The body carries the
    high-frequency operators and the strategy for turning an English request into a query.
    The exhaustive operator reference lives in a sibling file that Claude reads only when a
    request needs an operator the body does not cover. This is what keeps the always-on cost
    at a description and the on-invoke cost bounded ([§3.1](#31-context-budget)'s 5,000-token compaction bound).
  - Teaches the **failure loop**, not just the syntax: the server returns Scryfall's own
    `details` text on a malformed query ([`docs/MCP-PRD.md` D-10](./MCP-PRD.md#d-10--tool-handlers-never-throw), [CAP-01](./MCP-PRD.md#cap-01--card-search)), and the skill directs
    Claude to read it and correct the query rather than reporting failure to the user.
  - Teaches which operators **do not exist**, where getting it wrong is plausible.
    `illustrationtag:` is the known case — a plausible-looking operator that returns HTTP 400
    ([`docs/MCP-PRD.md` §4.1.1](./MCP-PRD.md#411-search-endpoint)).
  - Directs Claude toward the search parameters that change result *meaning* rather than
    formatting — `unique`, `order`, `dir` — and toward narrowing an over-broad query instead
    of paging through it, since [CAP-01](./MCP-PRD.md#cap-01--card-search) reports totals rather than truncating.
  - References the server's tools by their scoped names ([P-12](#p-12--plugin-name-and-server-key)), because that is the form that
    works in `allowed-tools` and permission rules.
  - Says nothing about install, configuration, or credentials. That is [PC-02](#pc-02--bundled-mcp-server)'s block and [§4](#4-harness-and-delivery).
- **Depends on:** [PC-02](#pc-02--bundled-mcp-server) (the tools it teaches Claude to call). [CAP-01](./MCP-PRD.md#cap-01--card-search) in `docs/MCP-PRD.md` —
  this is the plugin-side complement to it: [CAP-01](./MCP-PRD.md#cap-01--card-search) makes the search possible, [PC-01](#pc-01--scryfall-query-craft) makes it
  good. Harness features: skill auto-invocation by description, skill supporting files, the
  scoped tool naming in [§4.1](#41-harness-features-relied-on). No other PC.
- **Context cost:**
  - **Always-on: ~150–250 tokens.** Basis: this needs a richer-than-average description,
    because it must match requests phrased as plain Magic questions that never say "Scryfall"
    or "search syntax". Against [§4.6](#46-context-cost-accounting)'s measured range of ~30–230 per skill, that puts it at or
    slightly above the top of the observed band. Hard ceiling: 1,536 characters of
    `description` plus `when_to_use` ([§3.1](#31-context-budget)), which is a cap on what the harness will show, not
    a target.
  - **On-invoke: target ≤2,000 tokens for `SKILL.md`, plus the reference file only when
    read.** Basis: [§4.6](#46-context-cost-accounting)'s measured on-invoke range is ~560–2,900 tokens for skills of
    comparable scope. The 2,000 target keeps the body well inside [§3.1](#31-context-budget)'s 5,000-token
    compaction re-attach window, so nothing is silently lost mid-session — which is the real
    constraint, not the token count itself.
  - **Justification for paying the always-on cost:** it is the only component that fires
    unprompted, and without it the tools require the user to know the thing the plugin exists
    to know for them.
- **Acceptance criteria:**

  Criteria 1–4 are static and checkable against the files. Criteria 5–11 are behavioral, and
  the method is the baseline comparison the harness documentation prescribes: run each prompt
  in a **fresh session** with the skill available and again with it disabled, and compare.
  A fresh session is required because context left over from authoring the skill masks gaps
  in the written instructions. The first-party `skill-creator` plugin automates this loop —
  eval cases in `evals/evals.json`, one isolated subagent per case, pass/fail grading with
  evidence, a with-skill versus without-skill benchmark, and description tuning that measures
  should-trigger against should-not-trigger hit rate. **[verified 2026-07-29]** Behavioral
  criteria are stated as "on N held-out prompts of this shape" rather than as single anecdotes,
  because one passing prompt is not evidence about a skill.

  1. `description` plus `when_to_use` measures ≤1,536 characters ([§3.1](#31-context-budget)).
  2. `claude plugin details manabase` reports [PC-01](#pc-01--scryfall-query-craft)'s always-on cost, and it is ≤250 tokens.
  3. `SKILL.md` renders to ≤5,000 tokens, so [§3.1](#31-context-budget)'s compaction re-attach preserves the whole
     body rather than truncating its tail.
  4. **The skill asserts no card facts.** A review of the file finds no oracle text, no price,
     no legality claim, and no combo claim presented as fact; every such claim in the skill's
     guidance is routed to a tool call ([§3.6](#36-skills-carry-instructions-never-facts)).
  5. On a set of held-out prompts phrased as ordinary Magic questions naming **no operator and
     no tool**, Claude calls the server's search tool with a syntactically valid query — at a
     measurably higher rate with the skill enabled than disabled. The without-skill baseline is
     recorded, not assumed.
  6. On a prompt combining format legality, card type, cost, and a price ceiling, the emitted
     query uses the corresponding operators together rather than filtering client-side or
     asking the user to narrow it.
  7. On a prompt describing a text pattern rather than a keyword — the kind of request only
     regex answers — the emitted query uses the `o:/…/` form.
  8. On a prompt describing what a card *does* functionally rather than what it says, the
     emitted query reaches for `otag:` or `function:` rather than a plain oracle-text search.
  9. On a prompt about card **artwork**, the emitted query uses `art:` or `atag:` rather than
     searching oracle text for the subject.
  10. **Negative: `illustrationtag:` never appears in an emitted query**, across the full eval
      set. It is invalid ([`docs/MCP-PRD.md` §4.1.1](./MCP-PRD.md#411-search-endpoint)) and plausible enough to be guessed.
  11. **Should-not-trigger: on a set of prompts unrelated to Magic card search, the skill does
      not fire.** A skill that fires on everything spends its on-invoke cost for nothing and
      trains the author to ignore it.
  12. Given a tool response that is a structured failure carrying Scryfall's `details` text,
      Claude revises the query and retries rather than reporting the failure to the user as a
      dead end.
  13. Asked a question whose answer is a card fact — a price, a legality, an oracle text —
      Claude calls a tool rather than answering from the skill's own content.
  14. **Loads *and* fires, in a real harness.** Added 2026-08-04. On the surface being claimed,
      the skill appears in the session's skill listing **and** a card question results in a tool
      call. Both halves are required and neither substitutes for the other. Criteria 1, 3 and 4
      are satisfiable by reading and measuring the file, and they have now passed twice on
      configurations where the skill did not work: once when its frontmatter failed to parse and
      it loaded in no harness at all, and once on the Chat tab where it loaded correctly while
      its tool was unreachable ([§4.2](#42-marketplace-and-install-path)). Note the deliberately weak signal in the first half —
      **`/reload-plugins`' skill count reads `0 skills` in the working state**, so the session
      listing is the only thing that discriminates.
  15. **Never substitutes another source for the tool.** Added 2026-08-04. With the server
      unreachable, a card question produces a plain statement that the tool is unavailable and
      **no answer assembled from a web search, a Scryfall page, or the model's own knowledge.**
      This is the negative half of criterion 13: 13 checks that a reachable tool gets called, and
      an unreachable one silently routing around it passes 13 by never arising. **[verified
      2026-08-04]**
- **Open questions:** [PQ-02](#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed) (measured always-on cost against the shared budget), [PQ-04](#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed)
  (detecting budget degradation on someone else's machine). Bears on [`docs/MCP-PRD.md` OQ-01](./MCP-PRD.md#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model),
  which asked how Scryfall syntax should reach the model: this component is the plugin-side
  answer, and the answer the harness makes available — a compact description plus supporting
  files — was not among the three candidates that question weighed. [OQ-01](./MCP-PRD.md#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) stays open in that
  document until criteria 5–11 have actually been measured.

---

### PC-02 — Bundled MCP server

- **Type:** mcp-server
- **Status:** specified
- **Phase:** 1
- **User need:** I want the server to just be there when the plugin is on. I don't want to
  paste a config block, I don't want to be asked for a credential I don't have yet, and I
  don't want to find out it failed to start by noticing the tools are missing.
- **Surface:** tool call. Tools are callable as
  `mcp__plugin_manabase_mtg__<tool-name>`; the server registers as `plugin:manabase:mtg`
  ([P-12](#p-12--plugin-name-and-server-key)). It appears in `/mcp` with a plugin indicator, where a user can toggle it off without
  uninstalling.
- **Behavior:**

  **What lives elsewhere.** Everything the server *does* — tools, their parameters, their
  output, data sources, rate-limit handling, error shapes — is specified in
  [`docs/MCP-PRD.md` §4](./MCP-PRD.md#4-external-dependencies) and [§5](./MCP-PRD.md#5-capabilities). This block does not restate any of it and must not grow to.
  What follows is the install and configuration surface only.

  - **Starts automatically at session startup whenever the plugin is enabled** ([§4.1](#41-harness-features-relied-on)). This is
    the whole mechanism behind [P-01](#p-01--plugin-is-the-distribution-unit) and the reason there is no config block to paste.
  - Declared in `.mcp.json` at the plugin root as a stdio server invoked as `node` with
    `${CLAUDE_PLUGIN_ROOT}/dist/index.js` ([P-09](#p-09--server-ships-as-committed-built-javascript)). No `npx`, no package manager, and no network
    access in the startup path.
  - **Declares no `userConfig` in Phase 1** ([P-13](#p-13--no-user-configuration-in-phase-1)). Enabling the plugin asks the user nothing.
  - **Writes nothing under `${CLAUDE_PLUGIN_ROOT}`.** All cache and state paths resolve under
    `${CLAUDE_PLUGIN_DATA}` ([P-06](#p-06--cached-data-lives-in-the-plugin-data-directory)), passed to the server as an environment variable and read
    once at the entry point per [`docs/MCP-PRD.md` §3.2](./MCP-PRD.md#32-testability). When the variable is absent — the
    standalone case in [§4.5](#45-persistent-data) — the server falls back to a platform user-cache directory rather
    than failing or writing beside its own code.
  - **What the user sees when something is wrong**, which is this block's job because these are
    install-surface failures rather than tool failures:
    - *Server fails to start:* the tools are simply absent, which is the harness's behavior and
      is nearly invisible. The plugin's README must name `/mcp` as the place to look and
      `claude --debug` as the place to read why. Phase 1 cannot improve on this; it can
      document it.
    - *An upstream source is down:* a structured failure per [`docs/MCP-PRD.md` D-10](./MCP-PRD.md#d-10--tool-handlers-never-throw), not a
      dead server and not a stack trace. Scryfall being unavailable is a total outage for
      Phase 1 ([`docs/MCP-PRD.md` §4.1](./MCP-PRD.md#41-scryfall-rest-api)) and should say so plainly.
    - *A credential is missing or expired:* deferred with the capability that needs one. Not
      Phase 1 ([P-13](#p-13--no-user-configuration-in-phase-1)), and the message wording is [PQ-08](#pq-08--what-does-a-user-see-when-the-archidekt-credential-is-missing-expired-or-rejected).
  - **Version and update behavior** follow [P-08](#p-08--version-scheme) and [§4.3](#43-versioning-and-updates): unset `version` during development so
    every commit is an update, explicit semver at first public release. A mid-session plugin
    update leaves the running server on the old `CLAUDE_PLUGIN_ROOT` until `/reload-plugins`,
    and a reload keeps the connection alive if the server configuration did not change ([§4.1](#41-harness-features-relied-on)).
- **Depends on:** every CAP in `docs/MCP-PRD.md` — this component *is* how they reach a user,
  so it depends on all of them and constrains none of them. Harness features: automatic plugin
  MCP startup, `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` substitution in `command`,
  `args`, and `env`, and the scoped tool naming in [§4.1](#41-harness-features-relied-on). Runtime prerequisite: Node on `PATH`
  ([`docs/MCP-PRD.md` D-02](./MCP-PRD.md#d-02--runtime-nodejs--typescript)). No other PC. [PC-01](#pc-01--scryfall-query-craft) depends on this, not the reverse.
- **Context cost:**
  - **Always-on: the server's tool schemas — magnitude currently unverified.** Basis: none
    available. [§4.6](#46-context-cost-accounting) establishes that `plugin details` reports an always-on figure computed from
    listing text, and does not state whether MCP tool schemas are included; the server is not
    running when the command executes, which suggests they are not. This is [PQ-01](#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports), and it is
    the one cost figure in [§5](#5-components) that is a genuine unknown rather than an estimate.
  - **Unlike a skill description, a tool schema cannot be budget-trimmed** — [§3.1](#31-context-budget)'s degradation
    applies to the skill listing, not to tool definitions. So this cost is fixed and paid in
    full in every session, which makes tool count and description length a real product concern
    for `docs/MCP-PRD.md` rather than a formatting one. That connection is worth naming here;
    the decision about it belongs there.
  - **On-invoke: not applicable.** A server does not fire; its tools return data, whose size is
    [`docs/MCP-PRD.md` OQ-02](./MCP-PRD.md#oq-02--how-verbose-should-a-search-result-be).
- **Acceptance criteria:**
  1. On a machine with the plugin never installed, `/plugin marketplace add <owner>/<repo>`
     followed by `/plugin install manabase@<marketplace>` results in `/mcp` showing the server
     connected — with no additional command, no file edit, and no restart.
  2. **Enabling the plugin produces zero configuration prompts** ([P-13](#p-13--no-user-configuration-in-phase-1)).
  3. The server's tools are callable under `mcp__plugin_manabase_mtg__*`, and that exact form
     is what the README, [PC-01](#pc-01--scryfall-query-craft), and any permission rule use ([P-12](#p-12--plugin-name-and-server-key)).
  4. **The server starts and serves a request with no network access available**, proving there
     is no package fetch in the startup path ([P-09](#p-09--server-ships-as-committed-built-javascript)).
  5. After a `/plugin update`, the contents of `${CLAUDE_PLUGIN_DATA}` from before the update
     are still present and still used ([P-06](#p-06--cached-data-lives-in-the-plugin-data-directory)).
  6. No file is created or modified under `${CLAUDE_PLUGIN_ROOT}` during a session.
  7. The server runs standalone, outside the plugin, with `CLAUDE_PLUGIN_DATA` unset, and
     resolves its cache to a platform user-cache directory ([§4.5](#45-persistent-data)).
  8. An unreachable upstream produces a structured failure the model can act on, not a
     disconnected server ([`docs/MCP-PRD.md` D-10](./MCP-PRD.md#d-10--tool-handlers-never-throw)).
  9. `claude plugin validate . --strict` passes.
  10. `claude plugin details manabase` runs and its output is recorded in [§9](#9-revision-log), establishing the
      measured baseline that [§3.1](#31-context-budget) and [PQ-02](#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed) are checked against.
- **Open questions:** [PQ-01](#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports) (whether MCP tool schemas count toward always-on), [PQ-06](#pq-06--what-keeps-the-committed-dist-honest) (keeping
  the committed build honest), [PQ-08](#pq-08--what-does-a-user-see-when-the-archidekt-credential-is-missing-expired-or-rejected) (credential-failure wording, deferred).

---

### PC-03 — MCPB bundle for the Chat tab

- **Type:** mcp-server
- **Status:** specified
- **Phase:** unassigned
- **User need:** I use the Claude Desktop Chat tab, not a terminal. I installed the plugin and
  it answered my Magic question from a web search without telling me. I want the same tools my
  friends get in Claude Code, and if I can't have them I want to be told.
- **Surface:** tool call, as `Manabase:card_search` — the prefix comes from the MCPB manifest's
  `display_name`, not its `name` ([§4.2](#42-marketplace-and-install-path)). Installed by double-clicking a `.mcpb`, dragging it onto
  the Claude Desktop window, or Settings → Extensions → Advanced settings → Install Extension.
- **Behavior:**

  **What lives elsewhere.** Server behavior is [`docs/MCP-PRD.md` §5](./MCP-PRD.md#5-capabilities), unchanged and not
  restated. The install surface for Claude Code is [PC-02](#pc-02--bundled-mcp-server); this block is the Desktop
  install surface only, and the two share every byte of `dist/` ([P-14](#p-14--two-distribution-targets-one-source)).

  - **Packages the same `dist/index.js` [PC-02](#pc-02--bundled-mcp-server) starts**, plus a `manifest.json`, built with the
    `@anthropic-ai/mcpb` CLI (`mcpb pack`). No second build and no server code that exists
    only for this target — that is what makes [P-14](#p-14--two-distribution-targets-one-source) a packaging decision rather than a fork.
  - **Requires no runtime prerequisite.** Claude Desktop ships Node on macOS and Windows, so
    the bundle needs no `PATH` entry and no install of anything ([§3.4](#34-cross-platform-reach)). This is the one
    respect in which this target is *easier* than [PC-02](#pc-02--bundled-mcp-server).
  - **Carries the Fan Content disclaimer verbatim in the manifest `description`** ([§3.5](#35-what-the-user-must-see-and-must-not)),
    which Claude Desktop renders in the install dialog the user approves.
  - **Delivers the server only.** It does not carry `skills/`; the skill reaches that surface
    through the plugin ([§4.2](#42-marketplace-and-install-path)). A Chat-tab user therefore installs **both**, and either one alone
    is a degraded state — the bundle alone loses the query craft, the plugin alone loses the
    tools and is the configuration that produced the silent web-search substitution.
  - **`version` is required by the MCPB manifest** where [P-08](#p-08--version-scheme) deliberately leaves
    `plugin.json`'s unset. Unresolved: [PQ-09](#pq-09--how-does-the-mcpb-manifest-version-relate-to-p-08).
  - **What the user sees when something is wrong.** A bundle that fails to install reports it
    in the install dialog, which is a genuine improvement over [PC-02](#pc-02--bundled-mcp-server)'s silent absence. A
    bundle that installs but whose server fails to start degrades to the same invisible
    failure, and the Chat tab has no `/mcp` and no `claude --debug` to inspect it with.
- **Depends on:** every CAP in `docs/MCP-PRD.md`, as [PC-02](#pc-02--bundled-mcp-server) does. [P-14](#p-14--two-distribution-targets-one-source). [PC-01](#pc-01--scryfall-query-craft) for the
  skill that reaches the same surface separately. The `@anthropic-ai/mcpb` CLI at build time
  only — never at runtime, and not a dependency of the repo.
- **Context cost:**
  - **Always-on: the same tool schemas [PC-02](#pc-02--bundled-mcp-server) pays for, on a different surface.** Basis: the
    server is identical, so the schema cost is identical; what differs is the budget it is paid
    against, which has never been measured on the Chat tab. [PQ-02](#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed) covers Claude Code only.
  - **On-invoke: not applicable**, as [PC-02](#pc-02--bundled-mcp-server).
- **Acceptance criteria:**
  1. `mcpb validate manifest.json` passes and `mcpb pack` produces a `.mcpb`. **[verified
     2026-08-04]**
  2. The packed bundle's entry point answers an MCP `initialize` and lists `card_search`, tested
     against the bundled copy rather than the repo's. **[verified 2026-08-04]**
  3. On a machine where it has never been installed, double-clicking the `.mcpb` installs it and
     the Chat tab lists the tool. **[verified 2026-08-04 — `Manabase:card_search`]**
  4. A card question in the Chat tab results in a tool call, not a web search. **[verified
     2026-08-04]**
  5. The bundle's `description` carries the Fan Content disclaimer verbatim, and it is visible
     in the install dialog before the user approves.
  6. With the bundle **not** installed and [PC-01](#pc-01--scryfall-query-craft) present, a card question produces a plain
     statement that the tool is unavailable and no substituted answer. **[verified 2026-08-04 —
     the same question that previously produced a silent web search now stops]**
  7. The bundled `dist/index.js` is byte-identical to the one [PC-02](#pc-02--bundled-mcp-server) ships from the same
     commit ([P-14](#p-14--two-distribution-targets-one-source), [PQ-06](#pq-06--what-keeps-the-committed-dist-honest)).
  8. Installing the bundle asks for no configuration, matching [P-13](#p-13--no-user-configuration-in-phase-1) on the other target.
- **Open questions:** [PQ-06](#pq-06--what-keeps-the-committed-dist-honest) (two ways to ship a stale build now),
  [PQ-09](#pq-09--how-does-the-mcpb-manifest-version-relate-to-p-08) (manifest `version` against [P-08](#p-08--version-scheme)).

---

## 6. Roadmap

**Phase 1 — [PC-01](#pc-01--scryfall-query-craft) and [PC-02](#pc-02--bundled-mcp-server) together.**

The brief asked for the smallest genuinely useful install rather than the smallest shippable
one, and those differ here in a way worth stating. [PC-02](#pc-02--bundled-mcp-server) alone is shippable: the plugin
installs, the server starts, the tools appear. It is also not useful, because a user who does
not know Scryfall syntax is back to the problem [`docs/MCP-PRD.md` §1](./MCP-PRD.md#1-overview) describes, one layer up.
[PC-01](#pc-01--scryfall-query-craft) alone is not shippable at all — it teaches Claude to call tools that would not exist.
**Neither is a phase. The pair is the smallest thing that is both.**

Phase 1 is also the right first phase structurally: it establishes the install path, the
version scheme, the data directory, and the context-cost measurement that every later
component is checked against, and it does so with **zero credentials, zero prompts, and zero
local state** — matching `docs/MCP-PRD.md` Phase 1, which is [CAP-01](./MCP-PRD.md#cap-01--card-search) alone and needs none of
those either. The two documents' first phases line up deliberately.

**The [P-08](#p-08--version-scheme) switchover is a phase boundary, not a Phase 1 task.** `version` stays unset while
the author iterates. Setting explicit semver is the act of declaring the plugin public, and it
happens when Phase 1 is stable enough for the 5–20 to install it.

**[PC-03](#pc-03--mcpb-bundle-for-the-chat-tab) is specified but unassigned, and it is not a Phase 1 dependency.** Added 2026-08-04
with [P-14](#p-14--two-distribution-targets-one-source). It is blocked on nothing — the bundle packs and installs today, and five of its
eight criteria are already verified — but it serves a surface, not a capability, so it changes
who can install rather than what the plugin does. Phase 1 remains [PC-01](#pc-01--scryfall-query-craft) and [PC-02](#pc-02--bundled-mcp-server): that pair
is still the smallest thing that is both shippable and useful, and adding a second install
target to it would widen the phase without making it more useful to anyone already in it.

Two things should be settled before it is assigned, and neither is technical. [PQ-09](#pq-09--how-does-the-mcpb-manifest-version-relate-to-p-08) has to
answer what version a released bundle carries, because unlike the plugin an installed `.mcpb`
never re-pulls. And [PQ-06](#pq-06--what-keeps-the-committed-dist-honest) should land first: shipping a second artifact built from an
unverified `dist/` doubles the exposure to the one failure [P-09](#p-09--server-ships-as-committed-built-javascript) knowingly accepted. Slice 11
already covers that and is unblocked.

### Queued and unassigned

| Component | Type (expected) | Blocked on |
|---|---|---|
| Deck analysis | skill | **A CAP, not a PC.** Analyzing a deck requires reading one, and Archidekt deck reading is a queued capability in [`docs/MCP-PRD.md` §6](./MCP-PRD.md#6-phases) with no phase assigned. Per [§1](#1-overview)'s third consequence, this component cannot be specified until that capability is. |
| Deck optimize | skill (possibly agent) | Deck analysis, above. Also the first component where the skill-versus-agent question is genuine — see [PQ-07](#pq-07--is-deck-optimization-a-skill-or-an-agent). |

**The rest of the roadmap is deliberately undecided.** Not an omission. `docs/MCP-PRD.md` has
eight queued capabilities and no phase assignments past Phase 1; committing plugin phases to
capabilities that have no phases would be inventing a schedule for both documents from the one
with less information.

Two observations that should inform later assignment. **The skill-versus-agent choice is a
context-budget question before it is an architectural one** — an agent's description is paid
always-on exactly like a skill's ([§4.6](#46-context-cost-accounting)), so the choice turns on whether the work needs its own
context window, not on whether it feels like an agent. And **the first component that needs a
hook raises the cross-platform bar** ([§3.4](#34-cross-platform-reach)): Phase 1 deliberately ships no hook, so the first
one to arrive owns the exec-form and Windows-shell problem rather than inheriting a solution.

---

## 7. Open questions

Numbered, persistent. Questions stay here until answered — they are not dropped. Each records
what would resolve it. The `PQ-` prefix keeps these unambiguous against the `OQ-` numbers in
[`docs/MCP-PRD.md` §7](./MCP-PRD.md#7-open-questions), which remain that document's to answer.

### PQ-01 — Do an MCP server's tool schemas count toward the always-on cost that `claude plugin details` reports?

[§4.6](#46-context-cost-accounting) could not establish this either way, and it is the one cost figure [PC-02](#pc-02--bundled-mcp-server) cannot state.
It matters more than a reporting detail: unlike a skill description, a tool schema cannot be
budget-trimmed ([§3.1](#31-context-budget)), so if tool schemas are a real always-on cost then tool count and
description length in `docs/MCP-PRD.md` become a context-budget decision rather than a
formatting one.
*Resolves by:* running `claude plugin details` on a plugin that bundles an MCP server and
comparing the reported always-on total against the same plugin with the server removed. Do
this during Phase 1 — [PC-02](#pc-02--bundled-mcp-server)'s criterion 10 already produces the first half of the measurement.

### PQ-02 — What is this plugin's measured always-on cost, and does it fit alongside what the author already has installed?

[§3.1](#31-context-budget)'s budget is shared, and the author's `dotnet-plugin` already spends ~1,722 always-on
tokens across 20 skills ([§4.6](#46-context-cost-accounting)). The plugin's own footprint looks small; the aggregate is the
question, and it is the one that determines whether [§3.1](#31-context-budget)'s silent degradation is a live risk
or a theoretical one.
*Resolves by:* `/doctor`, which estimates the skill listing's cost against the budget and names
its biggest contributors, plus `/context`, whose Skills row reports the listing size after the
budget is applied. Both are available now; run them once Phase 1 is installed.

### PQ-03 — What triggers a refresh of the bulk data and the Comprehensive Rules cache, and should it ever be a `SessionStart` hook?

Recording a disagreement rather than a gap. A session-start hook is the obvious mechanism, but
it fires on **every** session in **every** project — so for 5–20 people it means a network call
at every Claude Code launch, almost all of them in projects that have nothing to do with Magic.
Refreshing lazily on the first tool call that needs the data costs nothing when the plugin is
not used, and the plugin is not used most of the time. The lazy option looks right; it is not
settled because it interacts with whether first use blocks on a download.
*Resolves by:* deciding it as part of the capability that first needs local persistence — tag
discovery or rules lookup in [`docs/MCP-PRD.md` §6](./MCP-PRD.md#6-phases). This is the plugin-side half of that
document's [OQ-03](./MCP-PRD.md#oq-03--what-is-the-bulk-data-storage-strategy-and-when-is-it-introduced). Whichever way it goes, [§3.4](#34-cross-platform-reach) constrains the mechanism: a hook here must be
exec form.

### PQ-04 — How would the author detect that a friend's skill listing has been budget-trimmed?

[§3.1](#31-context-budget)'s degradation is silent and `/doctor` is local. A friend whose listing overflowed would
experience [PC-01](#pc-01--scryfall-query-craft) as "sometimes it doesn't seem to know about Magic" and would probably not
report it as a bug at all.
*Resolves by:* deciding whether a documented "run `/doctor` if the plugin stops firing" line in
the README is sufficient, or whether [PC-01](#pc-01--scryfall-query-craft) needs to be robust to having no description — which
it cannot be, since the description *is* the invocation mechanism. Likely a documentation
answer, but confirm it rather than assuming.

### PQ-05 — Should the plugin be submitted to the community marketplace once it is stable?

Anthropic maintains `claude-plugins-community`, where third-party submissions land after
review and automated safety screening; approved plugins are pinned to a commit SHA with CI
bumping the pin. **[verified 2026-07-29]** This is not the hosted marketplace rejected in [§8](#8-out-of-scope) —
it is someone else's marketplace, requiring no infrastructure from this project. It would not
reduce the two-command install, only change which marketplace users add. Against it: a public
listing invites an audience larger than 5–20, and every constraint in this document was written
for 5–20.
*Resolves by:* an explicit decision after Phase 1 is stable. Not urgent, and reversible in one
direction only — worth deciding deliberately rather than drifting into.

### PQ-06 — What keeps the committed `dist/` honest?

[P-09](#p-09--server-ships-as-committed-built-javascript) accepts committed build output as the cheaper cost, but the failure mode it creates is a
release where `dist/` does not match `src/` — and because the harness runs whatever is
committed, that failure is invisible until someone reports wrong behavior.
*Resolves by:* choosing one of a CI check that rebuilds and diffs, a pre-commit hook, or making
the build part of the `claude plugin tag` release step. An implementation decision, recorded
here because [P-09](#p-09--server-ships-as-committed-built-javascript) created the risk and should not be read as having ignored it.

**Escalated 2026-08-04 from theoretical to live.** `dist/index.js` is now real committed build
output that six merged PRs have rebuilt by hand, and it is what the harness would actually run.
Every commit from here is an opportunity for the drift this question describes, with nothing
detecting it. The roadmap schedules the answer as Slice 11 and recommends the CI check; that
slice depends only on Slice 1, so nothing prevents it from landing next.

**Widened 2026-08-04 by [P-14](#p-14--two-distribution-targets-one-source): there are now two ways to ship a stale build, and the
second is worse.** [PC-03](#pc-03--mcpb-bundle-for-the-chat-tab) copies `dist/index.js` into a `.mcpb` at pack time, so a bundle
freezes whatever was committed at that moment and carries it until it is repacked and
redistributed. The plugin target at least re-pulls on `/plugin update`; an installed bundle
does not, and no user of one has any signal that it is behind. Whatever answers this question
must cover the pack step, not only the commit — a CI check that rebuilds and diffs `dist/`
leaves a released `.mcpb` unverified.

### PQ-07 — Is deck optimization a skill or an agent?

Both are paid always-on for their description ([§4.6](#46-context-cost-accounting)), so the question is whether the work needs
its own context window — a long analysis that would otherwise crowd the conversation — rather
than which one it resembles. Note that a plugin-shipped agent cannot declare `hooks`,
`mcpServers`, or `permissionMode` ([§3.3](#33-trust-and-sandboxing)), though it reaches this plugin's server through the
normal scoped tool name regardless.
*Resolves by:* specifying the component, which cannot happen until the capability it depends on
exists ([§6](#6-roadmap)).

### PQ-08 — What does a user see when the Archidekt credential is missing, expired, or rejected?

Deferred deliberately. [P-13](#p-13--no-user-configuration-in-phase-1) means there is no credential in Phase 1, and
[`docs/MCP-PRD.md` D-09](./MCP-PRD.md#d-09--archidekt-writes-land-last) puts Archidekt writes last. Note that [`docs/MCP-PRD.md` §4.5](./MCP-PRD.md#45-archidekt) verified
that Archidekt masks non-public decks as an indistinguishable 404, and [§3.6](./MCP-PRD.md#36-error-surface) forbids error text
that claims more than is known — so "your credential expired" may be an unsupportable claim
even when it is the likely cause.
*Resolves by:* specifying the Archidekt write capability in `docs/MCP-PRD.md`, then the
component that surfaces it. Not before.

### PQ-09 — How does the MCPB manifest `version` relate to P-08?

[P-08](#p-08--version-scheme) leaves `plugin.json`'s `version` unset during development on purpose, so every commit
counts as an update. The MCPB manifest has no such option: `version` is required, and
[PC-03](#pc-03--mcpb-bundle-for-the-chat-tab) currently carries `0.0.0` as a spike placeholder that no decision stands behind.
Three fields now express "which build is this" — `package.json`, the unset `plugin.json`
`version`, and the MCPB manifest — and [P-08](#p-08--version-scheme) explicitly declares the first two independent by
design. Where the third sits is unanswered.

The user-visible stake is that an installed `.mcpb` never re-pulls ([PQ-06](#pq-06--what-keeps-the-committed-dist-honest)), so its version
string is the only thing a user could compare against a release — which argues it cannot stay
`0.0.0`, and argues against inheriting [P-08](#p-08--version-scheme)'s unset-during-development posture wholesale.
*Resolves by:* deciding whether the manifest tracks `package.json`, tracks the plugin release
version, or is stamped by the pack step from the commit — and recording which, because
`APP_VERSION` in `src/config.ts` is already hand-synced and a fourth unsynced copy is a
maintenance trap rather than a versioning scheme.

**Answered 2026-08-04: the pack step stamps the manifest `version` from the commit being
packed.** Nothing is hand-synced and no fourth copy is created, which was the trap this question
named. It also preserves [P-08](#p-08--version-scheme)'s development posture — every commit is a distinct build — without
leaving `0.0.0` in an artifact a user installs and cannot update. The alternatives were rejected
for concrete reasons rather than taste: tracking `package.json` adds the fourth hand-synced copy
directly; tracking the plugin release version leaves every pre-release bundle indistinguishable
from every other, which is exactly the staleness [PQ-06](#pq-06--what-keeps-the-committed-dist-honest) says a `.mcpb` user has no other signal
for. Implementation belongs to [PC-03](#pc-03--mcpb-bundle-for-the-chat-tab)'s pack step and is not built yet; the `0.0.0` in the spike
artifact is superseded by this answer, not endorsed by it.

---

## 8. Out of scope

Explicitly rejected, with reasons, so these do not resurface.

**Everything already rejected in [`docs/MCP-PRD.md` §8](./MCP-PRD.md#8-out-of-scope)** — TCGplayer, hosted deployment, SSE,
embeddings for rules, reimplementing Scryfall's search engine, a transport abstraction layer,
the npm `archidekt` package, bundling the Comprehensive Rules, any paywall or access gate, and
deck editing outside Archidekt. Referenced, not restated. That list governs here unchanged.

**LSP servers.** Nothing here is a language. The component exists to give Claude code
intelligence over a codebase; this plugin's subject is card data.

**Themes.** Experimental schema that may change between releases, and zero product value — a
color palette does not help anyone build a deck.

**Monitors for set-release watching.** Tempting and wrong for now, on four counts: the schema
is experimental, they are skipped entirely on hosts where the Monitor tool is unavailable, they
run unsandboxed at the same trust level as hooks, and they cannot read `${user_config.*}` at
all. A refresh triggered from inside the plugin covers the actual need. See [PQ-03](#pq-03--what-triggers-a-refresh-of-the-bulk-data-and-the-comprehensive-rules-cache-and-should-it-ever-be-a-sessionstart-hook) — the
*replacement* mechanism is not settled, but monitors are.

**A hosted marketplace or web installer.** Same reasoning as the hosted-service rejection in
[`docs/MCP-PRD.md` §8](./MCP-PRD.md#8-out-of-scope): it makes the author a single point of failure for 5–20 people in exchange
for removing nothing, since `/plugin marketplace add owner/repo` is already one line. Distinct
from [PQ-05](#pq-05--should-the-plugin-be-submitted-to-the-community-marketplace-once-it-is-stable), which is about listing in *someone else's* marketplace and requires no
infrastructure.

**Flat `commands/` markdown.** Rejected by [P-07](#p-07--skills-not-commands). Shipping both forms in one repo is the
specific outcome that decision exists to prevent.

**Claude on the web, and the remote MCP server it would require.** Added 2026-08-04 with
[P-14](#p-14--two-distribution-targets-one-source), which adopts a second *local* target and stops there. No local process is reachable
from a browser session, so reaching claude.ai would mean hosting the server — which fails the
same test the hosted-service rejection in [`docs/MCP-PRD.md` §8](./MCP-PRD.md#8-out-of-scope) already applies, and adds one this
document cannot wave through: every user's traffic would leave a single Scryfall client
identity, converting a per-user 2/second budget into a shared quota the author must manage,
against an API where sustained overage risks the application for everyone
([`docs/MCP-PRD.md` §3.4](./MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance)). For an audience of 5–20 that is a disproportionate liability. The
Desktop Chat tab is served by [PC-03](#pc-03--mcpb-bundle-for-the-chat-tab); web chat is not served.

**A `CLAUDE.md` at the plugin root.** Not a style preference — it is **not loaded as context**
([§4.1](#41-harness-features-relied-on)). Anyone reaching for it is looking for a skill.

**`bin/` executables.** Files in `bin/` become bare commands on the Bash tool's `PATH` while
the plugin is enabled. There is no command-line tool here worth exposing, and adding names to a
user's `PATH` is a larger imposition than the feature would repay.

**Channels.** The `channels` field binds an MCP server to a message channel — Telegram, Slack,
Discord. Nothing about card research needs to inject messages into a conversation from
outside, and it would require credentials for a third service.

**Output styles.** An output style applies automatically while the plugin is enabled and
changes how Claude writes **in every session**, not just Magic ones. Far too broad a footprint
for a domain plugin.

**`strict: false` in the marketplace entry.** That mode hands component definitions to the
marketplace entry instead of `plugin.json`. With one repo containing both ([P-02](#p-02--one-repo-manifest-at-the-root), [P-11](#p-11--the-repo-is-its-own-marketplace)) it would
split one source of truth into two for no gain, and the harness reports conflicting manifests
as an error.

**An `npm` marketplace source type.** It would break [P-08](#p-08--version-scheme)'s development-phase behavior: npm
sources resolve to version `unknown` rather than a commit SHA ([§4.3](#43-versioning-and-updates)), so "every commit is an
update" would silently become "never updates."

**A plugin-shipped agent in Phase 1.** Not rejected in principle — [PQ-07](#pq-07--is-deck-optimization-a-skill-or-an-agent) keeps it open for
deck optimization. Rejected for Phase 1: an agent's description costs always-on tokens exactly
like a skill's ([§4.6](#46-context-cost-accounting)), and Phase 1 has nothing that needs its own context window.

**Any component that requires the server to do something `docs/MCP-PRD.md` does not specify.**
Structurally out of scope by [§1](#1-overview)'s third consequence. Such a thing is a CAP in that document,
and the correct move is to say so and stop.

---

## 9. Revision log

| Date | What changed | Why |
|---|---|---|
| 2026-07-29 | Document created. Established [§1](#1-overview)–[§9](#9-revision-log). Recorded 13 locked decisions ([P-01](#p-01--plugin-is-the-distribution-unit)–[P-13](#p-13--no-user-configuration-in-phase-1)), constraints, and six harness-and-delivery subsections from live research against the Claude Code plugin, marketplace, skills, subagents, hooks, MCP, and settings documentation. Specified [PC-01](#pc-01--scryfall-query-craft) (Scryfall query craft, skill) and [PC-02](#pc-02--bundled-mcp-server) (bundled MCP server). Assigned Phase 1. Opened [PQ-01](#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports)–[PQ-08](#pq-08--what-does-a-user-see-when-the-archidekt-credential-is-missing-expired-or-rejected). | Foundation session. Two components queued and unassigned; the roadmap past Phase 1 is deliberately open. Inherited decisions from [`docs/MCP-PRD.md` §2](./MCP-PRD.md#2-locked-decisions) are referenced as pointers rather than restated, per the [§1](#1-overview) boundary rule. |
| 2026-07-29 | **Recorded [P-09](#p-09--server-ships-as-committed-built-javascript):** the server ships as committed built JavaScript run by `node` from `${CLAUDE_PLUGIN_ROOT}`, with `npx -y` from inside the plugin as the recorded runner-up. [`docs/MCP-PRD.md` D-02](./MCP-PRD.md#d-02--runtime-nodejs--typescript)'s npm path is explicitly not revoked; it becomes the secondary route for non-Claude MCP clients. | The pre-session assumption that the server ships inside the plugin was compatible with [D-02](./MCP-PRD.md#d-02--runtime-nodejs--typescript) in principle but not in practice: `npx -y <package>` creates a second version number, which directly contradicts [P-02](#p-02--one-repo-manifest-at-the-root)'s "one clone, one version number, one tag," and puts a network fetch in the MCP startup path where failure is silent. Resolved as a plugin-side packaging decision rather than a reopening of [D-02](./MCP-PRD.md#d-02--runtime-nodejs--typescript), since the two now describe different distribution channels for different audiences. |
| 2026-07-29 | Recorded the **skill-listing context budget and its silent degradation** as the primary [§3](#3-constraints) constraint: `skillListingBudgetFraction` defaults to 1% of the context window, per-entry text is capped at 1,536 characters, and on overflow Claude Code drops the descriptions of least-used skills while keeping their names. Also recorded that a plugin **cannot** raise this on the user's behalf. | This was not in the pre-session findings and it is the constraint most likely to be violated by accident, because the failure mode is a skill that quietly stops auto-invoking rather than an error. It also converts "context cost" in the [§5](#5-components) template from bookkeeping into a real budget with a shared pool and a known failure. |
| 2026-07-29 | Recorded that **[PC-01](#pc-01--scryfall-query-craft) is the plugin-side answer to [`docs/MCP-PRD.md` OQ-01](./MCP-PRD.md#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model)**, and that the mechanism the harness offers — a compact description plus supporting files read on demand — was not among the three candidates that question weighed. [OQ-01](./MCP-PRD.md#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) left open in that document pending measurement. | [OQ-01](./MCP-PRD.md#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) framed the choice as long tool description versus separate syntax tool versus MCP resource, and flagged a collision with the under-200-character description convention. Skills with supporting files dissolve that collision: the description no longer carries the syntax. Recorded as a pointer rather than an answer written into `docs/MCP-PRD.md`, per [§1](#1-overview)'s no-duplication rule, and left open because [PC-01](#pc-01--scryfall-query-craft)'s behavioral criteria have not been run yet. |
| 2026-07-29 | Recorded **[P-10](#p-10--minimum-supported-claude-code-version): minimum supported Claude Code version 2.1.207**, with a table of features above the floor that may be used but not depended on. | The brief asked for a floor to be established. 2.1.207 is where `${user_config.*}` stopped substituting into shell-form commands — a security-relevant behavior change rather than a cosmetic one — so choosing it makes every rule in this document true for every supported user with no version caveat. Research found behavior changes at nine distinct patch releases in the areas this plugin touches, which is why the floor is a constraint rather than a note. |
| 2026-07-29 | Recorded the condition on [P-08](#p-08--version-scheme): the commit-SHA fallback for an unset `version` applies only to git-based sources in a git-hosted marketplace; **npm sources and non-git local directories resolve to `unknown`**. Added [P-11](#p-11--the-repo-is-its-own-marketplace) (repo is its own marketplace, added as `owner/repo`) partly to guarantee that condition, and rejected npm as a marketplace source type in [§8](#8-out-of-scope). | The pre-session finding stated the SHA fallback without its precondition. Left unrecorded, a later change of source type would silently turn "every commit is an update" into "never updates," with no error. |
| 2026-07-29 | Recorded the **raw-URL marketplace trap** — adding a marketplace by direct URL to `marketplace.json` downloads only that file, so relative plugin sources do not resolve — and made the `owner/repo` install form part of [P-11](#p-11--the-repo-is-its-own-marketplace). | Verified in the marketplace documentation. It is a partial, confusing failure rather than a clean one, and it is reachable by a user trying to be helpful. Recording it as a decision rather than a README detail is what keeps a future session from offering a URL alternative. |
| 2026-07-29 | Recorded **[P-12](#p-12--plugin-name-and-server-key): plugin name `manabase`, server key `mtg`**, and that the scoped form `mcp__plugin_manabase_mtg__<tool>` is what permission rules, `allowed-tools`, and hook matchers must use. | Plugin-bundled MCP tool names embed both the plugin name and the server key, and a matcher written against the bare server key never fires. Fixing both names once, in a document future sessions read, is cheaper than each component rediscovering the rule. `name` is also the stable install identifier, so changing it later breaks every install. |
| 2026-07-29 | Recorded **[P-13](#p-13--no-user-configuration-in-phase-1): [PC-02](#pc-02--bundled-mcp-server) declares no `userConfig` in Phase 1**, keeping [P-05](#p-05--credentials-collected-through-userconfig) as the mechanism for when credentials are actually needed. | [`docs/MCP-PRD.md` §3.1](./MCP-PRD.md#31-distribution-and-install-friction) forbids credentials for read-only capabilities and Phase 1 is [CAP-01](./MCP-PRD.md#cap-01--card-search) alone. Declaring the Archidekt fields early to prove the shape would show every user a prompt for a capability that does not exist — the exact failure mode [P-05](#p-05--credentials-collected-through-userconfig) exists to prevent. |
| 2026-07-29 | Grounded every [§5](#5-components) context-cost figure in a **measurement taken on the author's machine** rather than an estimate: `claude plugin details dotnet-plugin@dotnet-plugin` on Claude Code 2.1.220 reports ~1,722 always-on tokens across 20 skills, ~30–230 always-on per skill, ~560–2,900 on-invoke per skill. Also recorded that per-component figures are proportionally scaled from the total, not measured independently. | The brief noted that running `plugin details` locally is a cheap way to ground the [§3](#3-constraints) numbers rather than guessing them. The scaling caveat matters because the [§5](#5-components) template asks for the basis of each estimate, and "derived from a plugin-level total" is a materially weaker basis than "measured." |
| 2026-07-29 | Recorded that **MCP tool schemas may be an unbudgetable always-on cost** and opened [PQ-01](#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports). | Unlike a skill description, a tool schema cannot be trimmed when the listing overflows. If schemas do count, tool count and description length in `docs/MCP-PRD.md` become a context-budget decision. This is the only cost figure in [§5](#5-components) stated as unknown rather than estimated. |
| 2026-07-29 | Recorded a **disagreement with the brief's replacement for monitors** as [PQ-03](#pq-03--what-triggers-a-refresh-of-the-bulk-data-and-the-comprehensive-rules-cache-and-should-it-ever-be-a-sessionstart-hook): a `SessionStart` refresh hook fires in every session in every project, so for 5–20 users it is a network call at every launch, mostly wasted. Monitors remain out of scope; the replacement mechanism does not. | The brief presented the session-start hook as settled when rejecting monitors. The rejection holds on its own reasoning; the alternative has a cost worth measuring against a lazy first-use refresh, and [§3.4](#34-cross-platform-reach) additionally constrains any hook here to exec form. |
| 2026-08-04 | Recorded that **the server [PC-02](#pc-02--bundled-mcp-server) declares now exists** — `dist/index.js` built and committed per [P-09](#p-09--server-ships-as-committed-built-javascript), verified to complete an MCP initialize handshake from a directory containing no `node_modules`, which is [P-09](#p-09--server-ships-as-committed-built-javascript)'s offline-start claim holding in practice. Marked the [§4.5](#45-persistent-data) cache-directory rule **implemented**, with its per-platform paths. Escalated [PQ-06](#pq-06--what-keeps-the-committed-dist-honest) from theoretical to live. Stated in the document status that **no [PC-01](#pc-01--scryfall-query-craft) or [PC-02](#pc-02--bundled-mcp-server) acceptance criterion has been verified**. | The companion document's Phase 1 is delivered while this document's is untouched, and that asymmetry is easy to misread as "Phase 1 is nearly done." It is not: [§6](#6-roadmap) defines Phase 1 as PC-01 and PC-02 *together* precisely because a server nobody has installed is shippable-but-useless. Recording the build without recording that nothing here is verified would have inverted the point that section exists to make. The [§4.5](#45-persistent-data) rule moves from inferred to implemented, but not to verified — nothing writes to that directory in Phase 1, so the harness has never exercised it. |
| 2026-07-30 | [§2](#2-locked-decisions) converted from a single table to an index table plus one `###` heading per decision ([P-01](#p-01--plugin-is-the-distribution-unit)–[P-13](#p-13--no-user-configuration-in-phase-1)); [§7](#7-open-questions) open questions promoted from bold leads to `###` headings; every internal `§` and ID reference converted to a markdown link, and every reference into `docs/MCP-PRD.md` converted to a relative-path link at the sibling file. | Navigation. Several hundred references across the two PRDs were bare text that resolved nowhere on any surface, and [§2](#2-locked-decisions)'s paragraph-length table cells were the least readable part of the document. GitHub emits no anchor for a table cell, so the decisions had no link targets until they became headings. **Presentation only — no decision was reopened, no rationale was reworded, and no ID changed.** Recorded so a future session does not read the restructure as a substantive edit. |
| 2026-08-04 | **[PC-02](#pc-02--bundled-mcp-server)'s install surface verified for the first time.** Criteria 1, 2, 3, 4, 6 and 7 observed on a **cold** profile installing `njohnb/Manabase` as `manabase@manabase` (Claude Code 2.1.221, Windows 11 Pro 10.0.26200, Node v22.17.1). Resolved plugin version `ab2286e1a846` → `edeea588bc01` across a real push — [P-08](#p-08--version-scheme)'s commit-SHA fallback confirmed live, and `/plugin update` picked up the pushed commit **without** a prior marketplace refresh, answering an operational detail [§4.3](#43-versioning-and-updates) leaves unstated. **Criterion 9 not met as written:** `claude plugin validate .` passes with exactly one warning and `--strict` fails on that same warning, which is [P-08](#p-08--version-scheme)'s deliberate unset `version` — the two are in conflict until the Slice 13 switchover, and whether the criterion should be reworded for the pre-release window is raised for this document's owner, not answered here. Six drift items recorded, of which two matter: the harness reports a **12-character** abbreviated SHA rather than the 40-character form the spec assumes, and the installed plugin root contains a fetched `node_modules/` — [P-09](#p-09--server-ships-as-committed-built-javascript)'s no-fetch claim covers the *startup* path, which was proven offline, but not the install path. Criteria 5, 8 and 10 remain unverified (10 is Slice 10's; 5 has no observer while Phase 1 writes nothing). Results: docs/slices/TrackB-Slice7-results.md. | Track B Slice 7 (docs/DEV-ROADMAP.md) — the first verification of anything in this document's [§5](#5-components), and the point at which "the thing a user installs does not exist" stops being true. Every criterion here is a claim about a harness rather than about code, so none of it could be reached by a unit test, and none of it was true or false until a machine actually installed the plugin. |
| 2026-08-04 | **[§4.1](#41-harness-features-relied-on) gains a dated addendum: skill frontmatter is YAML, and a skill whose frontmatter does not parse is dropped in silence.** [PC-01](#pc-01--scryfall-query-craft)'s `SKILL.md` as written in [Slice 8](./slices/TrackB-Slice8.md) carried the unquoted string `Magic: The Gathering` in both `description` and `when_to_use`; an unquoted YAML plain scalar cannot contain a colon-space, so the block failed to parse and `/reload-plugins` reported **`0 skills`** for an installed plugin whose three skill files were all present on disk. Fixed by quoting both values (branch `fix/skill-frontmatter-yaml`, `ed82ceb`, PR #22). Line endings were tested and **ruled out** — the frontmatter fails identically CRLF and LF-normalized. **[PC-01](#pc-01--scryfall-query-craft) criterion 1 re-measured after the fix: 783 of 1,536 characters** (`name` 20 + `description` 269 + `when_to_use` 494, taken from YAML-parsed field values), still far under the cap. That is **not** 764 + 4: [Slice 8](./slices/TrackB-Slice8.md)'s 764 came from a different counting method (frontmatter values only, space-joined, no `name`), so the two figures are not the same measurement and the discrepancy is recorded unresolved rather than reconciled. Both figures are kept. | Track B [Slice 8](./slices/TrackB-Slice8.md) follow-up ([`docs/DEV-ROADMAP.md`](./DEV-ROADMAP.md)). The addendum records a harness behavior [§4.1](#41-harness-features-relied-on) did not cover and whose failure mode is invisible — the same silent-absence class as a missing `dist/` ([P-09](#p-09--server-ships-as-committed-built-javascript)) — so a future skill component does not rediscover it. It also exposes an integrity gap this document cannot close on its own: criteria 1, 3 and 4 are all satisfiable by reading and measuring the file, so **a skill that never loaded passed all three**, and every static measurement Slice 8 recorded was taken against a file no harness had ever accepted. Whether [PC-01](#pc-01--scryfall-query-craft) needs a criterion that the skill actually loads, and whether that warrants a new PQ, is raised here for this document's owner and deliberately not answered — [§5](#5-components) and [§7](#7-open-questions) are untouched by this row. |
| 2026-08-04 | **[PC-01](#pc-01--scryfall-query-craft) behavioral criteria 5–13 measured** against a without-skill baseline in fresh sessions: 17 behavioral cases (combined legality/type/cost/price, regex, `otag:`/`function:`, artwork, failure-loop, card-fact) plus 20 trigger queries, one run per configuration, strictly sequential. With-skill vs. baseline — valid-query rate 15/15 vs 15/15; regex 3/3 vs 3/3; `otag:` \| `function:` **3/3 vs 2/3**; art 3/3 vs 3/3; combined legality+type+cost+price 3/3 vs 3/3; card-fact tool call 3/3 vs 3/3; expectation level 78/79 vs 75/79. **Failure-loop retry: 4/4 in the baseline and _not measured_ with the skill** — cases 13–14 probe with `illustrationtag:`, which `SKILL.md` names as unreal, so the skill never emitted it and no error existed to retry from. Should-trigger 10/10, should-not-trigger 10/10. `illustrationtag:` emitted unprompted **0** times across 30 transcripts and 93 emitted queries (denominator 15 cases per configuration; cases 13–14 excluded because their prompts hand over the operator). Description tuned **0** times — both trigger rates were perfect — so `description` + `when_to_use` is unchanged at **763** characters (≤ 1,536). Results: [`docs/slices/TrackB-Slice9-results.md`](./slices/TrackB-Slice9-results.md). | Track B [Slice 9](./slices/TrackB-Slice9.md) ([`docs/DEV-ROADMAP.md`](./DEV-ROADMAP.md)) — the measurement [PC-01](#pc-01--scryfall-query-craft)'s eval-method preamble prescribes, and the evidence [`docs/MCP-PRD.md`](./MCP-PRD.md) [OQ-01](./MCP-PRD.md#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) was waiting on. Two things the run establishes that the criteria themselves do not. First, **the baseline auto-invoked the skill when it was merely left unmentioned** — the first attempt's opening tool call was `Skill{manabase:scryfall-query-craft}` — so a clean baseline needs a subagent type carrying no `Skill` tool, defined *before* the measuring session starts, because the agent registry resolves at session start; this run used an explicit prohibition instead and records that as a confound. Second, the **763 / 783** character figures differ only in whether `name` is counted (783 − 763 = 20 = the length of `scryfall-query-craft`), and [Slice 8](./slices/TrackB-Slice8.md)'s 764 is a one-off arithmetic slip on its own 269 + 494 — recorded here as an observation for this document's owner, with the 2026-08-04 row that called the discrepancy unresolved left exactly as written. [PC-01](#pc-01--scryfall-query-craft)'s `Status` field is unchanged, per [§5](#5-components)'s template. |
| 2026-08-04 | **Recorded [P-14](#p-14--two-distribution-targets-one-source) — two distribution targets from one source — amending [P-01](#p-01--plugin-is-the-distribution-unit), and appended [PC-03](#pc-03--mcpb-bundle-for-the-chat-tab) (MCPB bundle for the Chat tab).** Measured live on Claude Desktop and appended to [§4.2](#42-marketplace-and-install-path) as a dated addendum: a plugin installed from this repo's marketplace onto the **Chat tab delivers `skills/` and does not start its MCP server there**, while an MCPB bundle does expose the server there as `Manabase:card_search` — a prefix derived from the manifest's `display_name`, not its `name`. The Desktop **Code tab is Claude Code** and needs no second artifact. Five of [PC-03](#pc-03--mcpb-bundle-for-the-chat-tab)'s eight criteria are verified (1, 2, 3, 4, 6), including a bundle packed and installed on a machine that had never had one, and criterion 6 — the configuration that produced the original silent substitution now stops instead. Two locked sections were amended rather than rewritten, with the author's explicit decision: [§3.4](#34-cross-platform-reach), because Claude Desktop ships its own Node and the MCPB target therefore has **no** runtime prerequisite where the plugin target requires Node on `PATH`; and [§3.5](#35-what-the-user-must-see-and-must-not), because the manifest `description` is a fourth surface owing the Fan Content disclaimer verbatim and the most prominent one, since Desktop renders it in the install dialog. [§8](#8-out-of-scope) gains an explicit rejection of Claude on the **web** and the remote MCP server it would require — a hosted server would funnel every user through one Scryfall client identity, converting a per-user 2/second budget into a shared quota against an API whose ban risk applies to the whole application ([`docs/MCP-PRD.md` §3.4](./MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance)). [PQ-06](#pq-06--what-keeps-the-committed-dist-honest) widened: an installed `.mcpb` never re-pulls, so a stale `dist/` frozen at pack time is undetectable by any user and a CI check that only rebuilds-and-diffs on commit leaves it unverified. [PQ-09](#pq-09--how-does-the-mcpb-manifest-version-relate-to-p-08) opened: MCPB requires a `version` where [P-08](#p-08--version-scheme) deliberately leaves one unset, and the spike's `0.0.0` is a placeholder no decision stands behind. | A plugin that reaches a surface where its server does not run is not a partial install; it is a **worse-than-nothing** one. Asked for commanders on the Chat tab, the model correctly identified the tool as absent — naming the missing `mcp__plugin_manabase_mtg__card_search` in its reasoning — and then answered from a web search of Scryfall's search pages without saying so. An installed Manabase made answers *less* grounded than no Manabase, silently, which is the same class as the dropped invalid term and the `\A` zero-match. The mitigation shipped in [PC-01](#pc-01--scryfall-query-craft)'s body rather than in packaging, and criterion 6 verifies it fired. The measurements also retire an assumption this document carried implicitly: [P-12](#p-12--plugin-name-and-server-key)'s scoped tool name is constructed **per surface** and is not a property of the server — the same registered `card_search` is `mcp__plugin_manabase_mtg__card_search` in Claude Code and `Manabase:card_search` via MCPB — so it governs permission rules and hook matchers on the Claude Code surface only and must never be written into a skill body. **Still undecided:** whether [PC-01](#pc-01--scryfall-query-craft) needs a loads-*and*-fires criterion. On the Chat tab the skill loaded and the capability was unreachable at the same time, and every criterion satisfiable by reading or measuring the file passed there. |
| 2026-08-04 | **Four decisions taken in the same session, closing what the row above left open.** **[PQ-09](#pq-09--how-does-the-mcpb-manifest-version-relate-to-p-08) answered:** the pack step stamps the MCPB manifest `version` from the commit being packed — nothing hand-synced, no fourth copy of a version string, and no `0.0.0` in an artifact a user installs and cannot update. **[PC-01](#pc-01--scryfall-query-craft) gains criteria 14 and 15**, resolving the loads-versus-fires question the previous row recorded as undecided: 14 requires the skill to appear in the session listing *and* produce a tool call on the surface being claimed; 15 requires that an unreachable tool yields a plain statement of unavailability and no substituted answer. 15 is **[verified 2026-08-04]** — the configuration that produced the original silent web search now stops. **[P-12](#p-12--plugin-name-and-server-key) amended** to say the scoped tool name is constructed per surface and is not a property of the server, with the two traps that follow: never write it into a component that travels between surfaces, and never use it to detect whether the tool is present. **[PC-03](#pc-03--mcpb-bundle-for-the-chat-tab) criteria corrected from four verified to five** — criterion 6 was verified after [§6](#6-roadmap) and the row above were drafted, and both said four. | Three of the four are the same failure seen from different angles: a check that passes without the thing it checks for actually working. [PC-01](#pc-01--scryfall-query-craft)'s static criteria passed twice on skills that did not work, so 14 and 15 exist to make the file-measurable checks insufficient on their own rather than to replace them. [P-12](#p-12--plugin-name-and-server-key) read as a universal fact and was a single-surface one, which is what let a skill body assert a tool name that does not exist where it was sent. [PQ-09](#pq-09--how-does-the-mcpb-manifest-version-relate-to-p-08)'s answer is chosen for the same reason: an installed `.mcpb` never re-pulls, so a version that does not identify its build gives its user no signal at all — the staleness half of [PQ-06](#pq-06--what-keeps-the-committed-dist-honest). The count correction is recorded rather than silently fixed because a criteria tally that drifts between the block and the sections summarizing it is exactly the divergence this document's no-duplicated-decisions rule exists to prevent. |

---

*Manabase is unofficial Fan Content permitted under the Fan Content Policy. Not
approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the
Coast. ©Wizards of the Coast LLC. Card data and prices via [Scryfall](https://scryfall.com).
Combo data via [Commander Spellbook](https://commanderspellbook.com).*
