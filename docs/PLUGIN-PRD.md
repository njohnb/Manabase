# MTG Claude Plugin — PRD

> **Reading this cold?** Read [§1](#1-overview)'s boundary rule first — it tells you which of the two PRDs
> owns the question you arrived with. Sections 2 and 3 are binding. Section 4 is the dated
> research record; every claim is marked verified or inferred. Section 5 opens with the
> component template; adding a component means appending a PC block and updating sections 6,
> 7, and 9. Nothing else.

**Document status:** foundation established 2026-07-29. Two components specified ([PC-01](#pc-01--scryfall-query-craft),
[PC-02](#pc-02--bundled-mcp-server)). Two components queued and unassigned. The roadmap past Phase 1 is deliberately open.

**Component status 2026-08-11 — supersedes the count in the line above, which is dated and left as
written.** **Four** components are specified: [PC-01](#pc-01--scryfall-query-craft) and
[PC-02](#pc-02--bundled-mcp-server), plus [PC-03](#pc-03--mcpb-bundle-for-the-chat-tab) (2026-08-04,
the MCPB bundle) and [PC-04](#pc-04--card-viewer) (2026-08-11, the card viewer — `proposed` earlier
the same day, promoted when
[PQ-10](#pq-10--does-cap-01-gain-an-image-uri-and-what-does-that-cost) closed). Phase 1 is
unchanged and is still [PC-01](#pc-01--scryfall-query-craft) plus
[PC-02](#pc-02--bundled-mcp-server) — **`specified` is not a phase assignment**, and neither of the
two newer components has one.

**Build status 2026-08-04:** the server [PC-02](#pc-02--bundled-mcp-server) declares now exists —
`dist/index.js` is built and committed per [P-09](#p-09--server-ships-as-committed-built-javascript),
and `.mcp.json` points at it. **Nothing on this document's side has been verified.** The plugin
has never been installed from a marketplace, `SKILL.md` is unwritten, and
`claude plugin details` has never been run, so every PC-01 and PC-02 acceptance criterion and
every PQ remains open. Tracked as Tracks B and C in `docs/DEV-ROADMAP.md`.

**Build status 2026-08-08 — supersedes the block above, every clause of which is now false.** The
dated block is left as written, per this document's handling of dated records; read this one for
current state. The plugin **has** been installed from a marketplace on a cold profile
([Slice 7](./slices/TrackB-Slice7.md)); `SKILL.md` **is** written and verified loading in a real
harness ([Slice 8](./slices/TrackB-Slice8.md), [Slice 9](./slices/TrackB-Slice9.md)); and
`claude plugin details` **has** been run ([Slice 10](./slices/TrackC-Slice10.md)). Verified so far:
[PC-01](#pc-01--scryfall-query-craft) criteria 1, 3–11, 13 and 15, and
[PC-02](#pc-02--bundled-mcp-server) criteria 1, 2, 3, 4, 6, 7 and 10. Three
[PC-01](#pc-01--scryfall-query-craft) criteria are **not** verified and each for a different reason:
**2** is measured and not met (~260/~270 against a ≤250 gate, recorded ambiguous-because-scaled
rather than as a pass or a clean fail); **12** was *not measured* with the skill — never a fail,
but its probe hands over an operator `SKILL.md` names as unreal, so no error was produced to retry
from; and **14** has no recorded result since it was added 2026-08-04, after the run that would
have covered it. [PC-02](#pc-02--bundled-mcp-server)'s criteria 5 and 8 remain open, and 9 is
deliberately not met while [P-08](#p-08--version-scheme) leaves `version` unset. [PQ-01](#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports),
[PQ-02](#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed),
[PQ-03](#pq-03--what-triggers-a-refresh-of-the-bulk-data-and-the-comprehensive-rules-cache-and-should-it-ever-be-a-sessionstart-hook),
[PQ-04](#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed) and
[PQ-09](#pq-09--how-does-the-mcpb-manifest-version-relate-to-p-08) are answered; the rest stay open.
Three components are now specified, not two — [PC-03](#pc-03--mcpb-bundle-for-the-chat-tab) was
added 2026-08-04 with [P-14](#p-14--two-distribution-targets-one-source). [§9](#9-revision-log) is
authoritative where this summary and it disagree.

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

**Note added 2026-08-07.** This decision is unchanged; what changed is the set of credentials it
is waiting on. `docs/MCP-PRD.md` adopted Moxfield as a second deck platform that day, and the
mechanism here would serve a Moxfield credential exactly as it serves an Archidekt one. It will
not be asked to: [`docs/MCP-PRD.md` D-15](./MCP-PRD.md#d-15--moxfield-writes-are-blocked-upstream-not-merely-last) records that Moxfield has **no working
third-party authentication path at all** — its token endpoints challenge even callers whose
`User-Agent` Moxfield support whitelisted — so there is no credential to collect, rather than a
credential deferred. The distinction matters here specifically, because this decision's failure
mode is declaring a `userConfig` field early: a prompt for a Moxfield password would be worse
than [P-13](#p-13--no-user-configuration-in-phase-1)'s rejected case, since the value could not be
used even in principle.

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

**Extended 2026-08-07 to Moxfield, and the case there is stronger.** No Moxfield `userConfig`
field is declared either, for the reason in [P-05](#p-05--credentials-collected-through-userconfig)'s note:
[`docs/MCP-PRD.md` D-15](./MCP-PRD.md#d-15--moxfield-writes-are-blocked-upstream-not-merely-last) establishes that no third-party
authentication path to Moxfield currently works. A prompt for a credential that cannot be
exchanged for a token is not a premature prompt — it is one that could never pay off.

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

**Addendum — what the first hook component actually needs, researched because one arrived.
[verified 2026-08-11]** The paragraph above names the two traps and stops there, which was right
while no component needed a hook. [PC-04](#pc-04--card-viewer) does, so the mechanics are recorded
here rather than in its block. Verified against `code.claude.com/docs/en/hooks` and
`/plugins-reference` on 2026-08-11.

- **Declaration.** `hooks/hooks.json` at the plugin root, or inline in `plugin.json`. Shape is a
  top-level `hooks` object keyed by event name, each holding an array of `{ matcher, hooks: [...] }`.
- **Exec form is selected by the presence of `args`**, not by a mode flag: `{"type": "command",
  "command": "node", "args": ["…"]}` spawns directly, while omitting `args` makes `command` a shell
  string. A `shell` field (`"bash"` | `"powershell"`) exists and is **ignored when `args` is set**,
  which is the property [§3.4](#34-cross-platform-reach)'s exec-form rule depends on.
- **`${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` substitute in a hook's `command` and in
  every element of `args`** — not only in stdio server configs as [§4.1](#41-harness-features-relied-on) above records — and both are
  additionally exported as environment variables on the spawned process. **This is what makes
  [P-06](#p-06--cached-data-lives-in-the-plugin-data-directory) reachable from a hook**, which was
  not established anywhere in this document before today.
- **`async: true`** runs a hook in the background without blocking the turn. `asyncRewake` is the
  variant that wakes Claude on exit code 2 and surfaces the hook's stderr to the model — which a
  component wanting zero model context cost must **not** use.
- **Default `command`-hook timeout is 600 seconds**, lowered to 30 under `UserPromptSubmit` and 10
  under `MessageDisplay`; `SessionEnd` hooks share a 1.5-second budget.
- **Matchers are regular expressions** over the tool name, so an MCP tool is matched as
  `mcp__plugin_manabase_mtg__card_search` exactly or `mcp__plugin_manabase_mtg__.*` for the server
  ([P-12](#p-12--plugin-name-and-server-key)).
- **`PostToolUse` input** arrives on stdin as JSON carrying `session_id`, `transcript_path`, `cwd`,
  `permission_mode`, `hook_event_name`, `tool_name`, `tool_input`, `tool_use_id` and
  `tool_response`. **What `tool_response` holds for an *MCP* tool — the content array or a
  string — is not stated and is unverified**; the documented example is a `Bash` call.

**One thing this addendum does not license.** [PQ-03](#pq-03--what-triggers-a-refresh-of-the-bulk-data-and-the-comprehensive-rules-cache-and-should-it-ever-be-a-sessionstart-hook)
still forbids this plugin shipping a `SessionStart` hook, and knowing the mechanics better does not
reopen it. The event this records against is `PostToolUse`, which costs nothing in a session that
never calls the tool — which is the entire basis of that constraint.

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

#### Addendum 2026-08-04 — what the Chat tab install actually costs a user

The addendum above establishes *that* the Chat tab needs two artifacts. This one records what
that install is like, because three of its properties bear on whether a friend can be handed this
at all. The first is from the MCPB specification; the other two are measured.

- **The MCPB manifest format cannot carry a skill.** Its top-level fields are
  `manifest_version`, `name`, `version`, `description`, `author` and `server` as required, with
  `display_name`, `long_description`, `icon`/`icons`, `repository`, `homepage`, `documentation`,
  `support`, `screenshots`, `tools`, `prompts`, `tools_generated`, `prompts_generated`,
  `keywords`, `license`, `privacy_policies`, `compatibility`, `user_config`, `localization` and
  `_meta` optional. There is no `skills` field and no equivalent. **[verified 2026-08-04 against
  the published manifest specification]** The two-artifact install is therefore a property of
  the format, not a sequencing choice this project can engineer away, and no amount of packaging
  work reduces the Chat tab to one click.
- **Double-clicking a `.mcpb` is not a reliable install route.** Anthropic's documentation lists
  three — double-click, drag onto the Claude Desktop window, and Settings → Extensions →
  Advanced settings → Install Extension. Only the Settings route worked here. **[verified
  2026-08-04]** Documentation that leads with double-click sends a user into a failure that
  looks like a broken download rather than a wrong route, so the Settings route is the one this
  project documents and the others are mentioned as alternatives at most.
- **An installed extension has no update path.** Claude Desktop does not report that a newer
  bundle exists and does not fetch one; upgrading is a fresh download and a reinstall through
  the same Settings route. **[verified 2026-08-04]** This is the concrete form of the asymmetry
  [PQ-06](#pq-06--what-keeps-the-committed-dist-honest) names: the plugin target re-pulls on
  `/plugin update`, and this one never does.

**Node is not a prerequisite on this target.** Claude Desktop ships its own Node runtime on
macOS and Windows, which is why the specification recommends Node for bundled servers at all.
**[verified 2026-08-04 against the published MCPB build guide]** [§3.4](#34-cross-platform-reach)
already records this; it is repeated here because it is the one respect in which the harder
install path has the *lighter* requirement, and it is easy to state backwards.

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
Archidekt capability will need it. **Note 2026-08-07:** Archidekt remains the only credential
this mechanism is waiting on. Moxfield joined `docs/MCP-PRD.md` as a second deck platform that
day, but its writes are blocked upstream rather than deferred
([`docs/MCP-PRD.md` D-15](./MCP-PRD.md#d-15--moxfield-writes-are-blocked-upstream-not-merely-last)), so it adds nothing to collect here.
Moxfield deck *reads* are anonymous, the same as Archidekt's.

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

#### 4.6.1 Addendum, 2026-08-08 — measured on Claude Code 2.1.226

Everything above stands as written on the date it was written; this appends what
[Slice 10](./slices/TrackC-Slice10.md) measured and does not overwrite it. Full record:
[`docs/slices/TrackC-Slice10-results.md`](./slices/TrackC-Slice10-results.md). **[verified
2026-08-08]**

**The grounding measurement reproduces exactly.** `claude plugin details
dotnet-plugin@dotnet-plugin` on 2.1.226 returns **~1,722 always-on across the same 20 skills** —
identical to the 2.1.220 figure above. The accounting was stable across six patch versions, so
the table above is still a usable reference point.

**The `[inferred]` above is confirmed, with a stronger reason than it supposed.** MCP tool schemas
are not counted — but not merely because the server is not running. They are **deferred**:
`/context` reports them "loaded on-demand" at `0 tokens` resident, and the inventory row now
annotates itself `tool schemas resolved at runtime; not counted`. The A/B is in [PQ-01](#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports).
[PC-02](#pc-02--bundled-mcp-server)'s always-on cost — "the one number [§5](#5-components) cannot currently state" — is **0**.

**Three corrections to the instrument picture, all learned by using it.**

- **`/doctor` is not a listing-cost report.** On 2.1.226 it is a health-check workflow
  (installation diagnostics, unused-extension detection, memory trimming, permission proposals).
  It neither prices the skill listing against a budget nor names contributors. [PQ-02](#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed) and
  [PQ-04](#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed) both name it in that role; **`/context` is the instrument that actually does this
  job**, and a future question should name it instead.
- **A per-component figure can exceed the plugin total.** Observed: `scryfall-query-craft` ~260
  against a whole-plugin ~258. The proportional-scaling caveat above is not theoretical, and any
  acceptance criterion phrased as a threshold on a per-component number inherits the imprecision.
- **The two instruments disagree by ~9%** on the same plugins (`plugin details` ~1,980 combined,
  `/context` ~1,810). Each is authoritative for a different question — isolated contribution
  versus live post-budget residency. Record both; do not average them.

**One thing [§3.1](#31-context-budget) states that this measurement makes consequential.** The listing budget is a
*fraction* of the context window, so the model moves the **budget** as well as the measurement —
the same install is at ~42% of budget on a 1M-context model and would exceed it on a 200k one.
The instruction above to re-run at each phase boundary should therefore record the **model and
its window**, not only the version.

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
  - **Always-on: ~150–250 tokens estimated; measured 2026-08-08 at ~260 (`claude plugin
    details`) and ~270 (`/context`).** Basis: this needs a richer-than-average description,
    because it must match requests phrased as plain Magic questions that never say "Scryfall"
    or "search syntax". Against [§4.6](#46-context-cost-accounting)'s measured range of ~30–230 per skill, that puts it at or
    slightly above the top of the observed band. Hard ceiling: 1,536 characters of
    `description` plus `when_to_use` ([§3.1](#31-context-budget)), which is a cap on what the harness will show, not
    a target; the shipped text uses 763 of it. **The measurement confirms the "at or slightly
    above the top of the observed band" prediction and lands above the estimate's ceiling** —
    criterion 2's ≤250 gate is therefore *not demonstrated as met*, with both instruments
    reporting above it and neither reporting a precise figure. Full record and the
    ambiguous-because-scaled verdict:
    [`docs/slices/TrackC-Slice10-results.md`](./slices/TrackC-Slice10-results.md).
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
  - **Always-on: 0 tokens. Measured 2026-08-08.** Basis: on the Claude Code surface MCP tool
    schemas are **deferred** — `/context` reports the server's tools as "loaded on-demand" at
    `0 tokens` resident, and `claude plugin details` annotates the inventory row `tool schemas
    resolved at runtime; not counted`. The reversible A/B [PQ-01](#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports) called for confirms it: with
    `.mcp.json` ~258, without ~258, restored ~258. This was [§5](#5-components)'s one genuine unknown and
    it now has a value. Record:
    [`docs/slices/TrackC-Slice10-results.md`](./slices/TrackC-Slice10-results.md).
  - **On-demand: ~398 tokens for `card_search`**, paid when the schema is actually fetched
    rather than every session. That is the per-tool figure a future capability budgets against.
  - **The "cannot be budget-trimmed" concern does not arise, because there is no resident cost
    to trim.** [§3.1](#31-context-budget)'s degradation applies to the skill listing and not to tool definitions —
    which would have made a resident schema a fixed, unbudgetable per-session cost, and that is
    why [PQ-01](#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports) was raised. Deferral removes the premise. Two limits: deferral is the
    harness default and a server that opts out pays the ~398 every session, and the behavior is
    **unmeasured on the Chat tab** ([P-14](#p-14--two-distribution-targets-one-source)), where [P-12](#p-12--plugin-name-and-server-key) has already shown per-surface
    behavior to differ. So tool count and description length remain ordinary prudence for
    `docs/MCP-PRD.md`, not a context-budget constraint; that decision still belongs there.
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
- **Status:** in progress
- **Phase:** [Slice 13](./slices/TrackC-Slice13.md) — **reassigned 2026-08-09**, from
  [Slice 11](./slices/TrackC-Slice11.md). The build and release path landed 2026-08-04; at that
  point no version was tagged and no bundle was released.
  [Slice 11](./slices/TrackC-Slice11.md) closed
  [PQ-06](#pq-06--what-keeps-the-committed-dist-honest)'s commit half without cutting a release —
  the release cut and the packed-bundle byte-identity assertion were deferred to
  [Slice 13](./slices/TrackC-Slice13.md) — so this component now follows the criteria it still
  needs. Criteria status was unchanged by the reassignment: 1–6, 9 and 11 verified.
  **Both deferred criteria were executed 2026-08-10:** tag `v0.1.0`, the first run of
  [`.github/workflows/release.yml`](../.github/workflows/release.yml), and a published Release
  carrying `manabase.mcpb`, which verifies criteria 7 and 10. **Criterion 8 is the only one left
  unverified.** That was [Slice 13](./slices/TrackC-Slice13.md)'s
  [PC-03](#pc-03--mcpb-bundle-for-the-chat-tab) half **only** — the
  [P-08](#p-08--version-scheme) plugin switchover did not happen, stays gated on
  [Slice 12](./slices/TrackC-Slice12.md)'s friend dry-run, and the tag names the **bundle**
  ([PQ-09](#pq-09--how-does-the-mcpb-manifest-version-relate-to-p-08)), so
  [Slice 13](./slices/TrackC-Slice13.md) is **not** closed and neither is
  [§6](#6-roadmap)'s Phase 1. Evidence:
  [`docs/slices/TrackC-Slice13-results.md`](./slices/TrackC-Slice13-results.md)
- **A second release, `v0.1.1`, 2026-08-10 — and no criterion changed status.** Cut after
  [Slice 14](./slices/TrackA-Slice14.md) merged (PR #41), to carry its issue-#25 fix to this
  surface; `manabase.mcpb`, 113,631 bytes. **Criterion 7 held on a second, independently produced
  artifact** — the released `server/index.js` sha256-matches the committed
  [`dist/index.js`](../dist/index.js), checked against the downloaded asset rather than the local
  pack — which is corroboration, not a status change, since the criterion was already verified.
  **Criterion 8 is still the only unverified one:** `v0.1.1` has not been installed on Desktop.
  `v0.1.0` was **not moved or deleted** — a released bundle cannot be withdrawn, so a defect ships
  as a new version and a new tag, which is what this was, and this component now has two live
  releases of which **one is known stale with nothing telling its users so**
  ([PQ-06](#pq-06--what-keeps-the-committed-dist-honest)'s user-facing half, sharpened). The tag
  again names the **bundle** ([PQ-09](#pq-09--how-does-the-mcpb-manifest-version-relate-to-p-08)):
  [P-08](#p-08--version-scheme) is untouched and
  [PC-02](#pc-02--bundled-mcp-server) criterion 9 stays open. Evidence:
  [`docs/slices/TrackA-Slice14-results.md`](./slices/TrackA-Slice14-results.md)
- **Amended 2026-08-25 — the release path is automated and the release trigger moves off the tag
  ([Slice 18](./slices/TrackC-Slice18.md), executing [P-08](#p-08--version-scheme), not amending
  it).** [`release.yml`](../.github/workflows/release.yml) now fires on **merge to `main`**, not on a
  `v*` tag; the tag trigger is removed so the two producers of the `v*` namespace
  (`claude plugin tag` and this job) cannot double-cut. A new
  [`scripts/bump-version.mjs`](../scripts/bump-version.mjs) computes the next version from the
  conventional-commit range (last `v*` tag → `HEAD`) and writes it into
  [`plugin.json`](../.claude-plugin/plugin.json), which gains a `version` for the first time — one
  authored number reaching the plugin, the tag and the bundle, which dissolves
  [PQ-09](#pq-09--how-does-the-mcpb-manifest-version-relate-to-p-08)'s fourth-copy objection rather
  than arguing past it. A releasable merge writes `plugin.json`, tags `v<version>`, packs, and
  publishes in one job (the `GITHUB_TOKEN` write-back does not re-trigger the workflow, so the tag
  it pushes cannot cut a second release); a documentation-only merge publishes nothing and the run
  is green. [`mcpb/manifest.json`](../mcpb/manifest.json)'s `tools` list was corrected in the same
  slice to declare every registered tool, and [`tests/manifest.test.ts`](../tests/manifest.test.ts)
  now fails if it drifts from [`register.ts`](../src/tools/register.ts) in either direction. **Status is build-and-rehearse as of
  this date; the three-merge live sequence that publishes `v0.2.0` → *(no release)* → `v0.3.0` and
  the three `/plugin update` tests are the author's, and criteria 12–14 below track them.** The tag
  still names the **bundle** as well ([PQ-09](#pq-09--how-does-the-mcpb-manifest-version-relate-to-p-08)),
  so [P-08](#p-08--version-scheme)'s text is unchanged. Evidence:
  [`docs/slices/TrackC-Slice18-results.md`](./slices/TrackC-Slice18-results.md)
- **User need:** I use the Claude Desktop Chat tab, not a terminal. I installed the plugin and
  it answered my Magic question from a web search without telling me. I want the same tools my
  friends get in Claude Code, and if I can't have them I want to be told.
- **Surface:** tool call, as `Manabase:card_search` — the prefix comes from the MCPB manifest's
  `display_name`, not its `name` ([§4.2](#42-marketplace-and-install-path)). Installed through
  Settings → Extensions → Advanced settings → Install Extension — the route verified to work.
  Anthropic's documentation also lists double-clicking the `.mcpb` and dragging it onto the
  Claude Desktop window; double-click did **not** reliably open the installer here, so the
  Settings route is what this component documents ([§4.2](#42-marketplace-and-install-path)).
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
  - **Delivers the server only, and cannot do otherwise.** The MCPB manifest format has no
    `skills` field — its top-level fields are `manifest_version`, `name`, `version`,
    `description`, `author` and `server`, with `display_name`, `icon`, `tools`, `prompts`,
    `user_config`, `compatibility` and others optional. The skill reaches that surface through
    the plugin ([§4.2](#42-marketplace-and-install-path)). A Chat-tab user therefore installs
    **both**, and either one alone is a degraded state — the bundle alone loses the query craft,
    the plugin alone loses the tools and is the configuration that produced the silent
    web-search substitution. One-click is not reachable for this surface without a format change.
  - **Is built by CI and downloaded, never hand-packed by the user.** The pack step is
    `npm run pack:mcpb`, and a `v*` tag runs it in GitHub Actions and attaches the result to a
    Release. Hand-packing is how a released artifact acquires a server nobody reviewed, which is
    [PQ-06](#pq-06--what-keeps-the-committed-dist-honest)'s failure mode on the target that has
    no update path.
  - **`version` is required by the MCPB manifest** where [P-08](#p-08--version-scheme) deliberately leaves
    `plugin.json`'s unset. Answered and implemented: the pack step stamps it
    ([PQ-09](#pq-09--how-does-the-mcpb-manifest-version-relate-to-p-08)). A tagged build takes
    the tag with its leading `v` stripped; an untagged one is stamped `0.0.0-dev+<commit>`, so an
    ad-hoc bundle cannot be mistaken for a release. The tag names the **bundle**, not the plugin,
    which leaves [P-08](#p-08--version-scheme) untouched.
  - **Has no update path once installed.** Claude Desktop neither reports that a newer bundle
    exists nor fetches one; upgrading means downloading again and reinstalling through the same
    Settings route. This is the user-visible cost of
    [PQ-06](#pq-06--what-keeps-the-committed-dist-honest) on this target and must be stated
    wherever the install is documented, not left to be discovered.
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
  3. On a machine where it has never been installed, installing the `.mcpb` installs it and
     the Chat tab lists the tool. **[verified 2026-08-04 — `Manabase:card_search`, installed
     through Settings → Extensions → Advanced settings → Install Extension. This criterion said
     "double-clicking" when it was written, from Anthropic's documented install routes rather
     than from the run; double-click did not reliably open the installer, so the wording was
     corrected to match what was actually verified]**
  4. A card question in the Chat tab results in a tool call, not a web search. **[verified
     2026-08-04]**
  5. The bundle's `description` carries the Fan Content disclaimer verbatim, and it is visible
     in the install dialog before the user approves. **[verified 2026-08-04 — the disclaimer
     rendered in the dialog]**
  6. With the bundle **not** installed and [PC-01](#pc-01--scryfall-query-craft) present, a card question produces a plain
     statement that the tool is unavailable and no substituted answer. **[verified 2026-08-04 —
     the same question that previously produced a silent web search now stops]**
  7. The bundled `dist/index.js` is byte-identical to the one [PC-02](#pc-02--bundled-mcp-server) ships from the same
     commit ([P-14](#p-14--two-distribution-targets-one-source), [PQ-06](#pq-06--what-keeps-the-committed-dist-honest)). **[verified 2026-08-10 — asserted inside
     [`scripts/pack-mcpb.mjs`](../scripts/pack-mcpb.mjs) rather than as a workflow step, so
     [`release.yml`](../.github/workflows/release.yml) inherits it through `npm run pack:mcpb` and
     there is no second copy to drift. It unpacks the archive it just wrote and compares that
     `server/index.js` against the committed `dist/index.js` by sha256 — *the archive, never the
     staging tree*, which is `cpSync`'d from `dist/` a few lines earlier and would make the check
     a tautology. A mismatch exits 1, prints both hashes, and deletes the bundle, because a
     rejected archive left on disk is one somebody installs. Demonstrated in both directions
     before landing, per [Slice 11](./slices/TrackC-Slice11.md)'s rule that a check never observed
     failing is not known to work; confirmed again on the published `v0.1.0` asset, sha256
     `c93080b3…`]**
  8. Installing the bundle asks for no configuration, matching [P-13](#p-13--no-user-configuration-in-phase-1) on the other target.
  9. `npm run pack:mcpb` refuses to pack when `dist/index.js` is older than `src/`, and stamps a
     tagged build with the tag and an untagged one with `0.0.0-dev+<commit>`. **[verified
     2026-08-04 — the guard fires on a touched source file; `MANABASE_BUNDLE_VERSION=v0.1.0`
     stamps `0.1.0`; the packed archive contains exactly `manifest.json` and `server/index.js`
     and passes the CLI's manifest schema validation]**
  10. Pushing a `v*` tag produces a GitHub Release with `manabase.mcpb` attached, built by CI
      from a clean checkout, and the job fails if rebuilding `dist/` differs from what is
      committed. **[verified 2026-08-10 — tag `v0.1.0` on `2c7196c`, run `31421682409`; Release
      published 2026-08-10T18:57:43Z, not draft and not prerelease, carrying `manabase.mcpb` at
      111,760 bytes. The first execution of
      [`release.yml`](../.github/workflows/release.yml) on a tag, and its `dist/` gate was clean.
      Three `workflow_dispatch` rehearsals on the branch ran every step first — the *Attach to the
      Release* step correctly skipped on all three and fired on the tag. The published asset was
      then downloaded and checked independently of CI]** *Why it stood unverified until then,
      kept because it is the reason the criterion waited: the workflow existed and no tag had been
      pushed. The rebuild-diff gate could not be exercised on the author's machine, where
      `core.autocrlf=true` makes `dist/index.js` report as modified with an empty diff after every
      build.* Evidence:
      [`docs/slices/TrackC-Slice13-results.md`](./slices/TrackC-Slice13-results.md).
  11. The documented install path states that an installed bundle has no update path, before the
      user installs rather than after. **[verified 2026-08-04 — `README.md` "Chat tab —
      experimental"]**
  12. The release trigger is a merge to `main`, not a `v*` tag. A merge whose commit range contains
      a releasable commit produces, in **one** workflow run, a `v<version>` tag, a published Release
      carrying `manabase.mcpb`, and a [`plugin.json`](../.claude-plugin/plugin.json) on `main` whose
      `version` matches the tag — with the `dist/` staleness gate having passed before any of it. A
      merge whose range contains no releasable commit produces **no** tag, Release, or bundle, and
      the run is green. **[built and rehearsed 2026-08-25 ([Slice 18](./slices/TrackC-Slice18.md));
      live-merge verification pending the author's release sequence]**
  13. [`plugin.json`](../.claude-plugin/plugin.json) carries an explicit semver `version` written by
      [`scripts/bump-version.mjs`](../scripts/bump-version.mjs) and never by hand — executing
      [P-08](#p-08--version-scheme) — while [`marketplace.json`](../.claude-plugin/marketplace.json)
      carries none, so resolution stops at `plugin.json` and cannot be silently overridden. The
      script refuses an already-tagged version and a non-semver one (e.g. `0.1.01`). **[script built
      and both refusals demonstrated 2026-08-25; the first written `version` lands with the live
      switchover, which is also [PC-02](#pc-02--bundled-mcp-server) criterion 9's evidence]**
  14. On the author's already-installed machine, `/plugin update` picks up the SHA→semver switchover
      once and semver→semver thereafter, and a no-release merge reports already current — verified
      positively by reading the installed copy under `~/.claude/plugins/cache`, not by a quiet
      command. **[pending the author's release sequence — Slice 18 requirement 8]**
- **Open questions:** [PQ-06](#pq-06--what-keeps-the-committed-dist-honest) (two ways to ship a stale build now; the
  commit half now has a CI gate, the pack half is covered only by criterion 9's staleness guard).
  [PQ-09](#pq-09--how-does-the-mcpb-manifest-version-relate-to-p-08) is answered and implemented.

---

### PC-04 — Card viewer

- **Type:** hook
- **Status:** specified (2026-08-11 — `proposed` earlier the same day; see the addendum under
  **Behavior**)
- **Phase:** unassigned, and explicitly **not** Phase 1 — see [§6](#6-roadmap)
- **User need:** I want to see the actual card while I'm working in a session, without opening a
  browser and navigating to Scryfall. When a search comes back with twelve cards I want to look at
  them — the art, the frame, whether it's the card I meant — not read twelve type lines and take
  Claude's word for it.
- **Surface:** a `PostToolUse` hook matched on the scoped search tool
  (`mcp__plugin_manabase_mtg__card_search`, [P-12](#p-12--plugin-name-and-server-key) — the Claude
  Code form, which is the only surface that has hook matchers). The hook renders nothing. The user
  reaches the result through a page served on `127.0.0.1` by a local daemon, in a tab they keep open.
- **Behavior:**

  **Addendum 2026-08-11 — the prerequisite below is answered and this block is now `specified`.**
  [PQ-10](#pq-10--does-cap-01-gain-an-image-uri-and-what-does-that-cost) is closed by
  [`docs/MCP-PRD.md` OQ-13](./MCP-PRD.md#oq-13--should-a-card-search-result-carry-image-uris-and-at-what-cost):
  [CAP-01](./MCP-PRD.md#cap-01--card-search) gains `images: "none" | "normal"`, defaulting to
  `"none"`, returning an **array** of Scryfall `normal` URIs — one per face — as its acceptance
  criterion 15. The paragraph immediately below is left exactly as written and is true of its own
  date; read this one for current state. **Three consequences bind the build**, and the first is a
  new blocker of a smaller kind. The opt-in defaults to `"none"`, and a `PostToolUse` hook
  **observes a call it did not make** — it cannot add a parameter to a request that has already
  gone out — so something has to cause `images: "normal"` to be set when the viewer is enabled and
  nothing currently does. That is
  [PQ-13](#pq-13--what-sets-images-normal-when-the-viewer-is-enabled), and it is a known cost rather
  than a discovery: it was weighed when the opt-in was chosen over an always-on field. The response
  field is an **array**, because a
  transform card carries no top-level `image_uris` at all
  ([`docs/MCP-PRD.md` §4.1.4](./MCP-PRD.md#414-card-image-uris)), which is what makes this block's
  both-faces criterion 9 cheap. And the hook **never assembles an image URL from a card `id`** —
  that route is verified to work and deliberately not taken upstream, so reinventing it here would
  reintroduce exactly what was rejected. **Not buildable yet for a different reason than before:**
  criterion 15 is unimplemented and unscheduled, which is a build blocker rather than a
  specification one.

  **This block is `proposed` and not buildable as written.** The prerequisite is stated first
  because everything below assumes it:
  [PQ-10](#pq-10--does-cap-01-gain-an-image-uri-and-what-does-that-cost) — the hook needs a stable
  per-card handle and [CAP-01](./MCP-PRD.md#cap-01--card-search) returns none. Its behavior block
  lists fifteen fields and no identifier, and
  [`src/scryfall/types.ts`](../src/scryfall/types.ts) models no `id`, no image field and no artist
  field, so the gap is in the wire types as well as the spec. Per
  [§1](#1-overview)'s third consequence that is a `CAP` in
  [`docs/MCP-PRD.md`](./MCP-PRD.md), not something this document specifies around.

  **Why an `id` is not enough, which is the part that is easy to get wrong.** Exchanging an id for
  an image URL means a call to a card endpoint, and those are the 2/second lane in
  [`docs/MCP-PRD.md` §3.4](./MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance). The
  daemon is a second process outside the server's two rate-limit lanes, so a search and a push
  overlapping puts the application over its own budget — and that section is explicit that each
  local copy must be well-behaved on its own, because there is no central throttle to fix it later.
  **An image URI resolves this rather than mitigating it:** those are served from `*.scryfall.io`
  file origins, which the same section rates **unlimited**, so the daemon never touches a
  rate-limited endpoint at all. The prerequisite is therefore an image URI per result, not an
  identifier.

  What the component does, once it has one:

  - **Three pieces and a one-way path.** The hook is a short-lived Node process the harness spawns
    after a search; it parses the tool response, ensures the daemon is up, pushes the card set, and
    exits. The daemon is long-lived, holds the current set in memory, caches images on disk, and
    serves the page. The path runs search → hook → daemon → page and **no arrow points back into
    the model's context** — nothing the daemon produces returns through the hook. That is what
    makes the cost figures below structural rather than optimistic.
  - **Opt-in and default off** ([§3.3](#33-trust-and-sandboxing) — a background process binding a
    socket is precisely what "nothing the user would be surprised by" is about). A hook ships
    enabled with its plugin and the harness has no per-hook toggle, so the switch is the hook's own
    first instruction: a `userConfig` boolean `viewer_enabled` defaulting to false, read from
    `CLAUDE_PLUGIN_OPTION_VIEWER_ENABLED` ([§4.4](#44-user-configuration)), checked before parsing
    and before any spawn. Rejected alternatives, so they are not re-proposed: a marker file the
    user creates by hand ([P-05](#p-05--credentials-collected-through-userconfig)'s failure mode
    wearing a hat), a skill that starts the daemon (always-on description tokens in every session
    in every project, spent to hold a switch — which would destroy this component's only strong
    argument), and inferring consent from the page being open (circular; the daemon must already
    run for the page to exist). **The cost is
    [PQ-12](#pq-12--does-a-userconfig-boolean-with-a-default-prompt-at-enable-time) and is not
    waved through.**
  - **Exec form, and no shell anywhere.** Declared in `hooks/hooks.json` as `{"type": "command",
    "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/viewer/hook.js"], "async": true}`. This is
    the problem [§6](#6-roadmap) says the first hook component owns rather than inherits, and
    [§4.1](#41-harness-features-relied-on)'s 2026-08-11 addendum is where it is solved: `args`
    present selects exec form, `${CLAUDE_PLUGIN_ROOT}` substitutes inside `args`, and `async`
    keeps the turn unblocked. **The second launch is the one a session will get wrong** — the hook
    spawns the daemon with `process.execPath`, never the string `"node"`, because the hook is
    already running under a Node the harness located and re-resolving `node` through `PATH` with no
    shell is where Windows fails. `detached`, `stdio: "ignore"`, `windowsHide`, then unreferenced.
  - **One daemon, enforced by the port bind itself.** The hook always attempts a spawn; a second
    daemon takes `EADDRINUSE` and exits cleanly. No lockfile — a lockfile is a thing that survives a
    crash and a bound port is not. It binds `127.0.0.1` explicitly and never `0.0.0.0`, on a fixed
    port so the URL is a constant the README can print, and it shuts down after an idle period with
    no page connected. It carries no authentication and needs none: the only thing it holds is
    public card data on the user's own machine, which is worth saying plainly rather than inventing
    a token that protects Scryfall images from their viewer.
  - **Full card face, artist identifiable, nothing else** —
    [`docs/MCP-PRD.md` §3.3](./MCP-PRD.md#33-legal-and-terms-of-service) governs this component
    directly. No `art_crop`, no filter, no watermark, no overlay, no rounding that clips the border;
    scaling preserves aspect ratio. This is the cheap path as much as the compliant one, since an
    unmodified card image already carries the artist name and copyright line in its own border. The
    artist string is rendered beside the image so it stays identifiable at scales where the printed
    line is not. **A double-faced card shows both faces** — `image_uris` sits on `card_faces` rather
    than on the card **[inferred; [`src/scryfall/types.ts`](../src/scryfall/types.ts) already models
    `card_faces` and no image field, so the shape is half-known]** — because a viewer that silently
    shows one face is the wrong-card failure this component exists to prevent.
  - **No terminal front-end in the first version.** A character-cell renderer is filtering under the
    rule above, the artist line does not survive it, and it is the only reason this component would
    need a prerequisite other than Node on `PATH` ([§3.4](#34-cross-platform-reach)). Recorded as a
    possible later addition rather than as a cut feature.
  - **Marketplace hyperlinks are consistent with
    [`docs/MCP-PRD.md` D-06](./MCP-PRD.md#d-06--pricing-from-scryfall), and are deliberately not
    shipped yet.** Recorded as reasoned rather than assumed, because the question is adjacent enough
    to a locked decision to be worth settling once. That decision fixes where a price *number* comes
    from; an outbound link is not a price source — the page displays no figure obtained from the
    target and issues no request to it — and D-06's two prohibitions are a paid price provider and
    scraping TCGplayer, neither of which a link is. Scryfall's data-use terms are satisfied for the
    same reason: no implied endorsement, no gate, and additive rather than a repackaging of their
    data. **The sharp edge is referral parameters:** those URLs carry Scryfall's own, and they are
    passed through byte-for-byte — never rewritten, never given the author's affiliate code, which
    would monetize fan content against
    [`docs/MCP-PRD.md` §3.3](./MCP-PRD.md#33-legal-and-terms-of-service). Not in the first version
    regardless, because the field is absent from
    [CAP-01](./MCP-PRD.md#cap-01--card-search) too and shipping links would widen
    [PQ-10](#pq-10--does-cap-01-gain-an-image-uri-and-what-does-that-cost) from one field to two.
  - **What is written to disk, and what is not.** Images only, under
    `${CLAUDE_PLUGIN_DATA}/viewer/` and nowhere else
    ([P-06](#p-06--cached-data-lives-in-the-plugin-data-directory),
    [PC-02](#pc-02--bundled-mcp-server) criterion 6), keyed by a hash of the URL and bounded by
    count or bytes with least-recently-used eviction. **Nothing recording the query, the result set,
    or a history of what was searched is persisted** — that is a privacy surface this component was
    not asked to create, and holding the current set in memory only is what keeps it from existing.
    Uninstalling the plugin removes the directory ([§4.5](#45-persistent-data)), so there is no
    cleanup step to document.
  - **Says nothing about query construction.** That is [PC-01](#pc-01--scryfall-query-craft)'s, and
    this component ships no skill and no instruction text at all.
- **Depends on:** a revised [CAP-01](./MCP-PRD.md#cap-01--card-search) returning an image URI per
  result — **blocking**, and [`docs/MCP-PRD.md`](./MCP-PRD.md)'s to make.
  [PC-02](#pc-02--bundled-mcp-server), whose scoped tool name the matcher names and whose server
  produces the response the hook reads. Harness features: plugin `hooks/hooks.json`, `PostToolUse`,
  exec form, `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` substitution in hook `args`, and
  `userConfig` reaching a hook process — all in [§4.1](#41-harness-features-relied-on)'s 2026-08-11
  addendum and [§4.4](#44-user-configuration). Runtime prerequisite: Node on `PATH`, unchanged.
  No other PC.
- **Context cost:**
  - **Always-on: 0 tokens.** Basis: [§4.6](#46-context-cost-accounting) records hooks as
    "harness-only — no model context cost", and this component ships no skill, no agent and no
    command, so it adds nothing to the listing [§3.1](#31-context-budget) budgets. It is one of the
    few components that cannot be argued against on budget grounds, and that should be stated rather
    than left implicit.
  - **On-invoke: 0 tokens.** Basis: the hook runs outside the model loop and returns nothing to
    Claude. `async: true` and the deliberate avoidance of `asyncRewake` are what hold this — the
    rewake variant surfaces a hook's stderr to the model as a system reminder
    ([§4.1](#41-harness-features-relied-on)), which would convert a zero-cost component into a
    per-fire one.
  - **The figure to check rather than trust** is criterion 10 below: measured, not asserted.
- **Acceptance criteria:**
  1. With `viewer_enabled` false or unset, a card search spawns no process and leaves no port bound.
     The default-off state is the one most likely to rot, because nobody exercises it.
  2. With it true, the cards from a search are visible on the page without the user leaving the
     session or running a command.
  3. The hook is declared in exec form — `args` present — and fires on Windows, macOS and Linux with
     no shell invoked ([§3.4](#34-cross-platform-reach)).
  4. No file is created or modified under `${CLAUDE_PLUGIN_ROOT}`
     ([P-06](#p-06--cached-data-lives-in-the-plugin-data-directory)).
  5. Everything written lands under `${CLAUDE_PLUGIN_DATA}/viewer/`, and **no artifact anywhere
     records the query text or the result set.**
  6. The daemon accepts connections on `127.0.0.1` and refuses them from another host on the same
     network.
  7. A second and third card search in the same session leave exactly one daemon running.
  8. Each card is rendered as an unmodified full card face with the artist identifiable in the same
     interface — no `art_crop`, no filter, no overlay
     ([`docs/MCP-PRD.md` §3.3](./MCP-PRD.md#33-legal-and-terms-of-service)).
  9. A double-faced card shows both faces.
  10. `claude plugin details manabase` reports the same always-on total with this component present
      as without it, confirming the 0 above by measurement
      ([§4.6](#46-context-cost-accounting)).
  11. The daemon exits after its idle period with no page connected, so it does not outlive the work
      that started it.
  12. Every image fetch goes to a `*.scryfall.io` file origin and **no request is issued to a
      rate-limited card endpoint**, verified by observing the daemon's outbound traffic
      ([`docs/MCP-PRD.md` §3.4](./MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance)).
      No outbound request reaches a host outside those
      [`docs/MCP-PRD.md` §4](./MCP-PRD.md#4-external-dependencies) enumerates
      ([§3.3](#33-trust-and-sandboxing)).
  13. **Given a tool response carrying no image URI — the pre-prerequisite world, and any future
      response shape change — the hook exits cleanly and displays nothing.** It never falls back to
      resolving a card by name. This is the negative criterion, and it exists because the failure it
      guards against is showing a confidently wrong printing rather than showing nothing.
- **Open questions:**
  ~~[PQ-10](#pq-10--does-cap-01-gain-an-image-uri-and-what-does-that-cost) (**blocking** — the
  [CAP-01](./MCP-PRD.md#cap-01--card-search) prerequisite)~~ **answered and closed 2026-08-11**;
  [PQ-13](#pq-13--what-sets-images-normal-when-the-viewer-is-enabled) replaces it as this block's
  blocker and is a **smaller** one — it blocks building, not specifying, and lives one layer down in
  [`docs/MCP-PRD.md`](./MCP-PRD.md),
  [PQ-11](#pq-11--does-an-explicit-push-command-justify-reopening-the-bin-executables-rejection)
  (an explicit push versus [§8](#8-out-of-scope)'s `bin/` rejection),
  [PQ-12](#pq-12--does-a-userconfig-boolean-with-a-default-prompt-at-enable-time) (what the opt-in
  switch costs [PC-02](#pc-02--bundled-mcp-server) criterion 2). Plus two verification items that
  are not judgment calls and so are not `PQ`s: what `tool_response` contains for an MCP tool
  ([§4.1](#41-harness-features-relied-on)), and whether the daemon should also stop on `SessionEnd`
  via a second hook rather than on idle timeout alone.

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

**[PC-03](#pc-03--mcpb-bundle-for-the-chat-tab) is assigned to [Slice 13](./slices/TrackC-Slice13.md) — reassigned there 2026-08-09 from [Slice 11](./slices/TrackC-Slice11.md), matching its block's `Phase:` field — and it is still not a Phase 1 dependency.** Added 2026-08-04
with [P-14](#p-14--two-distribution-targets-one-source). It serves a surface, not a capability, so it changes
who can install rather than what the plugin does. Phase 1 remains [PC-01](#pc-01--scryfall-query-craft) and [PC-02](#pc-02--bundled-mcp-server): that pair
is still the smallest thing that is both shippable and useful, and adding a second install
target to it would widen the phase without making it more useful to anyone already in it.

Two things had to be settled before it could be assigned, and neither was technical. Both were,
2026-08-04. [PQ-09](#pq-09--how-does-the-mcpb-manifest-version-relate-to-p-08) is answered and
implemented — the pack step stamps the version, and a tag names the bundle rather than the
plugin, so [P-08](#p-08--version-scheme) is untouched. [PQ-06](#pq-06--what-keeps-the-committed-dist-honest) is
half-answered rather than closed: the release job rebuilds `dist/` and fails on a diff, and the
pack step refuses a `dist/` older than `src/`, but the CI gate has never run and neither
mechanism watches an ordinary commit. **That is why the assignment is to Slice 11 specifically**
— the slice that owns [PQ-06](#pq-06--what-keeps-the-committed-dist-honest) is the slice that
should cut the first release, so a second artifact is never built from a `dist/` nothing checked.
Shipping one before that doubles the exposure to the failure [P-09](#p-09--server-ships-as-committed-built-javascript) knowingly
accepted, on the target that has no update path to correct it.

**Superseded 2026-08-09 — the paragraph above is left as written and corrected here.** Two of its
clauses are now false. The CI gate **has** run and an ordinary commit **is** watched:
[Slice 11](./slices/TrackC-Slice11.md) landed `.github/workflows/ci.yml` on `pull_request` and
`push: main`, which rebuilds `dist/` and fails on a non-empty `git status --porcelain -- dist/`,
and it was observed failing on a deliberately stale bundle and green on the rebuild
([`docs/slices/TrackC-Slice11-results.md`](./slices/TrackC-Slice11-results.md)).
[PQ-06](#pq-06--what-keeps-the-committed-dist-honest)'s **commit half is answered**; its
user-facing half stays open, so the argument's conclusion — never build a second artifact from a
`dist/` nothing checked — still holds and is now satisfiable rather than aspirational.

**What that changes is the assignment, not the reasoning.** "The slice that owns
[PQ-06](#pq-06--what-keeps-the-committed-dist-honest) is the slice that should cut the first
release" was written when one slice was expected to do both.
[Slice 11](./slices/TrackC-Slice11.md) closed the commit half and deferred the release cut and the
packed-bundle byte-identity assertion to [Slice 13](./slices/TrackC-Slice13.md), so
[PC-03](#pc-03--mcpb-bundle-for-the-chat-tab) was reassigned there on 2026-08-09 — the same
principle, now pointing at the slice that can still act on it. No
[PC-03](#pc-03--mcpb-bundle-for-the-chat-tab) criterion changed status.

**[PC-04](#pc-04--card-viewer) is `proposed` and unassigned, added 2026-08-11, and it is not Phase 1
for two independent reasons.** Either would be sufficient. This section's Phase 1 is
[PC-01](#pc-01--scryfall-query-craft) and [PC-02](#pc-02--bundled-mcp-server) together and nothing
else, and that pairing is an argument about the smallest thing that is both shippable and useful —
a viewer changes neither half of it. Separately, [§3.5](#35-what-the-user-must-see-and-must-not)
requires Phase 1 to produce **zero prompts and zero local state**, and this component is a
background daemon behind an enable-time prompt with an on-disk image cache. It is three for three
against a constraint Phase 1 states as an absolute.

**It is also not merely unscheduled — it is blocked**, which is a different status and should not be
collapsed into the queue below.
[PQ-10](#pq-10--does-cap-01-gain-an-image-uri-and-what-does-that-cost) has to be answered in
[`docs/MCP-PRD.md`](./MCP-PRD.md) before this component can move to `specified`, and per
[§1](#1-overview)'s third consequence that is not this document's call to make. Assigning it a
phase now would be scheduling work whose prerequisite has no owner yet.

**Addendum 2026-08-11 — the condition named above was met the same day, and the component is now
`specified`.** [PQ-10](#pq-10--does-cap-01-gain-an-image-uri-and-what-does-that-cost) was answered
in [`docs/MCP-PRD.md`](./MCP-PRD.md) as
[OQ-13](./MCP-PRD.md#oq-13--should-a-card-search-result-carry-image-uris-and-at-what-cost), so the
paragraph above has done its job and is left as written. **Neither half of the phase reasoning
moves.** Phase 1 is still [PC-01](#pc-01--scryfall-query-craft) and
[PC-02](#pc-02--bundled-mcp-server) and nothing else, and
[§3.5](#35-what-the-user-must-see-and-must-not)'s zero-prompts-zero-local-state requirement still
rules this component out of it three ways over — a specified component is not a Phase 1 component,
and the two were never the same claim. **It stays unscheduled**, and the blocker is now a build
blocker rather than a specification one:
[CAP-01](./MCP-PRD.md#cap-01--card-search)'s criterion 15 is unimplemented with no slice, and
[PQ-13](#pq-13--what-sets-images-normal-when-the-viewer-is-enabled) is open. The ordering that
follows is worth stating because it is easy to get backwards: **criterion 15 ships first, and this
component cannot be scheduled ahead of it.**

**What it does settle, regardless of when it ships.** This section has carried a standing note that
"the first component that needs a hook raises the cross-platform bar
([§3.4](#34-cross-platform-reach)): Phase 1 deliberately ships no hook, so the first one to arrive
owns the exec-form and Windows-shell problem rather than inheriting a solution." The first one has
arrived and **the problem is solved rather than deferred** — exec form selected by the presence of
`args`, `${CLAUDE_PLUGIN_ROOT}` verified to substitute inside `args`, and `process.execPath` rather
than `"node"` for the process the hook itself spawns. That work is recorded in
[§4.1](#41-harness-features-relied-on)'s 2026-08-11 addendum, where the *next* hook component
inherits it, rather than inside a block that may sit `proposed` for some time. The note above is
therefore discharged by this component even if this component never ships.

### Queued and unassigned

| Component | Type (expected) | Blocked on |
|---|---|---|
| Deck analysis | skill | **A CAP, not a PC.** Analyzing a deck requires reading one, and deck reading is a queued capability in [`docs/MCP-PRD.md` §6](./MCP-PRD.md#6-phases) with no phase assigned — for **both** platforms as of 2026-08-07, Archidekt first and Moxfield second ([`docs/MCP-PRD.md` D-13](./MCP-PRD.md#d-13--deck-platform-order-archidekt-first-moxfield-second)). Per [§1](#1-overview)'s third consequence, this component cannot be specified until that capability is. It waits on the *first* platform, not both: the skill consumes the normalized deck shape ([`docs/MCP-PRD.md` OQ-12](./MCP-PRD.md#oq-12--what-is-the-normalized-deck-shape-and-does-one-tool-serve-both-platforms-or-two)) rather than a platform's payload, so the second platform reaches it for free. |
| Deck optimize | skill (possibly agent) | Deck analysis, above. Also the first component where the skill-versus-agent question is genuine — see [PQ-07](#pq-07--is-deck-optimization-a-skill-or-an-agent). |

**The rest of the roadmap is deliberately undecided.** Not an omission. `docs/MCP-PRD.md` has
ten queued capabilities and no phase assignments past Phase 1; committing plugin phases to
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

**Answered 2026-08-08: they do not count, because on this surface they are not resident at
all.** The A/B was run as prescribed, on Claude Code 2.1.226: with `.mcp.json` **~258**, without
**~258** (inventory `MCP servers (0)`, so the change registered), restored **~258** — the control
`A₂ = A₁` holds and no run was voided. Two other instruments agree for one underlying reason:
`claude plugin details` annotates the inventory row `tool schemas resolved at runtime; not
counted`, and `/context` reports the server's tools as "loaded on-demand" at **0 tokens**
resident, with `card_search`'s schema costing **~398 tokens** only when fetched.

**This retires the concern rather than merely answering the question.** The stake above is that a
tool schema *cannot* be budget-trimmed, so a resident schema would be a fixed unbudgetable cost
in every session. Deferral removes the premise: there is no resident cost to trim. Tool count and
description length in `docs/MCP-PRD.md` stay a formatting concern, and [`OQ-01`](./MCP-PRD.md#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) does **not**
gain the cost side it would have gained had the answer gone the other way.

**Two limits, so this is not over-read.** Deferral is the harness default, not a guarantee — a
server that opts out pays the ~398 every session. And this is the **Claude Code surface only**;
whether the Chat tab defers an MCPB bundle's schemas is unmeasured, and [P-12](#p-12--plugin-name-and-server-key) has already
shown per-surface behavior to differ. Record and full conditions:
[`docs/slices/TrackC-Slice10-results.md`](./slices/TrackC-Slice10-results.md).

### PQ-02 — What is this plugin's measured always-on cost, and does it fit alongside what the author already has installed?

[§3.1](#31-context-budget)'s budget is shared, and the author's `dotnet-plugin` already spends ~1,722 always-on
tokens across 20 skills ([§4.6](#46-context-cost-accounting)). The plugin's own footprint looks small; the aggregate is the
question, and it is the one that determines whether [§3.1](#31-context-budget)'s silent degradation is a live risk
or a theoretical one.
*Resolves by:* `/doctor`, which estimates the skill listing's cost against the budget and names
its biggest contributors, plus `/context`, whose Skills row reports the listing size after the
budget is applied. Both are available now; run them once Phase 1 is installed.

**Answered 2026-08-08: ~270 tokens, and it fits with room to spare — but the risk verdict is
model-dependent, and that qualifier is load-bearing.** Measured with the author's full load
enabled (two plugins: `dotnet-plugin@dotnet-plugin` 1.0.38 and `manabase@manabase`
`be2839453a11`) on Claude Code 2.1.226, model `claude-opus-5[1m]`.

The listing sits at **4.2k tokens across 47 skills against a ~10,000-token budget (~42%), with
nothing trimmed** — every skill shows its full description, which is the positive signal, not the
absence of an error. Manabase contributes **~270** of that (~2.7% of budget); its tool schema
contributes **0**, per [PQ-01](#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports). So **[§3.1](#31-context-budget)'s silent degradation is theoretical on this
machine**, and removing Manabase entirely would not change that.

**The qualifier: `skillListingBudgetFraction` is 1% of the *context window*, and the window is a
property of the active model.** The same install on a 200k-context model faces a ~2,000-token
budget against a ~4,200-token listing — trimming would be *certain*. A future session that
re-runs this on a smaller-window model and finds trimming has not contradicted this answer. Never
quote the headroom without the model beside it.

**Two findings that change how a later reader should use this number.** First, **~52% of the
listing (~2,180 tokens across 16 entries) is built-in skills** that no plugin controls and that
grow with each Claude Code release — the headroom available to installed plugins is smaller than
the raw budget suggests. Second, **`/doctor` is not the instrument named above**: on 2.1.226 it is
a health-check workflow that neither prices the listing against a budget nor names contributors.
`/context` is the instrument that works; see the [§4.6](#46-context-cost-accounting) addendum. Record:
[`docs/slices/TrackC-Slice10-results.md`](./slices/TrackC-Slice10-results.md).

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

**Hook half answered 2026-08-07: never a `SessionStart` hook.** Recorded as a standing constraint
rather than left to be re-argued by whichever capability first wants a refresh trigger. Three
reasons converge and nothing was found opposing them: the every-project cost stated above, for
5–20 people, in projects overwhelmingly unrelated to Magic; Phase 1 ships no hook deliberately
([§4.1](#41-harness-features-relied-on), [P-07](#p-07--skills-not-commands)); and
[§3.4](#34-cross-platform-reach) makes the first component to need a hook the owner of the
exec-form and Windows-shell problem rather than the inheritor of a solution. Deciding it now costs
nothing and pre-empts nothing.

**State the constraint at its true width, because it is easy to over-read.** It rules out **this
plugin shipping a `SessionStart` hook** — not hooks in general, and not background refresh in
general. A capability that needs fresh bulk data may still refresh lazily on first use, on an
explicit user-invoked action, or on a staleness check inside the tool call, all of which cost
nothing in a project that has nothing to do with Magic, which is the entire objection. It
forecloses one mechanism, not the goal that mechanism would have served.

**The rest of the question stays open** — storage layout, and whether first use blocks on a
download. Nothing was implemented and no [§5](#5-components) criterion changed status.
*Resolves by:* unchanged — the capability that first needs local persistence, tag discovery or
rules lookup.

### PQ-04 — How would the author detect that a friend's skill listing has been budget-trimmed?

[§3.1](#31-context-budget)'s degradation is silent and `/doctor` is local. A friend whose listing overflowed would
experience [PC-01](#pc-01--scryfall-query-craft) as "sometimes it doesn't seem to know about Magic" and would probably not
report it as a bug at all.
*Resolves by:* deciding whether a documented "run `/doctor` if the plugin stops firing" line in
the README is sufficient, or whether [PC-01](#pc-01--scryfall-query-craft) needs to be robust to having no description — which
it cannot be, since the description *is* the invocation mechanism. Likely a documentation
answer, but confirm it rather than assuming.

**Answered 2026-08-07: a README line is sufficient, and it names the by-name fallback.** The
mitigation is what makes documentation sufficient rather than resigned. [§3.1](#31-context-budget)
records that trimming drops descriptions and **keeps names**, so a trimmed skill is still
invocable: the user is un-prompted rather than stuck, which turns an undetectable degradation into
a recoverable one. The line leads with the symptom, because that is what a friend actually
notices, then the recovery, then the diagnosis:

> If Claude does not reach for Magic knowledge on its own, invoke
> `manabase:scryfall-query-craft` by name — it still works when the skill listing has been trimmed.
> Run `/doctor` to confirm whether trimming is what happened.

Two things it deliberately does not do. It does not claim `/doctor` will name this plugin among the
contributors — unverified until [Slice 10](./slices/TrackC-Slice10.md) measures it, and the line
reads correctly either way. And it does not attempt to make
[PC-01](#pc-01--scryfall-query-craft) robust to having no description, which is impossible for the
reason this question already gives.

**The line is not written yet.** [`README.md`](../README.md) is unchanged and no
[PC-01](#pc-01--scryfall-query-craft) criterion changed status.
*Resolves by:* adding the line to [`README.md`](../README.md) — [Slice 12](./slices/TrackC-Slice12.md)
already carries that task — and confirming at [Slice 10](./slices/TrackC-Slice10.md) whether
`/doctor` names this plugin, which sharpens the last sentence but gates neither of the first two.

**Amended 2026-08-08 — [Slice 10](./slices/TrackC-Slice10.md) measured it, and the drafted line's
third sentence does not survive.** The caution recorded above was justified, and by a wider margin
than it supposed: `/doctor` on Claude Code 2.1.226 does not merely fail to name this plugin among
the contributors — **it does not price the skill listing against a budget and does not name
contributors at all.** It is a health-check workflow (installation diagnostics, unused-extension
detection, memory trimming, permission proposals). See [§4.6.1](#461-addendum-2026-08-08--measured-on-claude-code-21226).

**The first two sentences stand unchanged.** They never depended on `/doctor`: the symptom is what
a friend notices, and the by-name recovery rests on [§3.1](#31-context-budget)'s trimming keeping
names, which [Slice 10](./slices/TrackC-Slice10.md) did not touch. Only the diagnosis clause moves.
The line to write is now:

> If Claude does not reach for Magic knowledge on its own, invoke
> `manabase:scryfall-query-craft` by name — it still works when the skill listing has been trimmed.
> Run `/context` to confirm whether trimming is what happened: its Skills row reports the listing
> size after the cap is applied, and lists every skill with its cost.

**One limit on that last clause, stated so it is not over-read.**
[Slice 10](./slices/TrackC-Slice10.md) measured a listing with **nothing trimmed** — 4.2k of a
~10,000-token budget — so what a *trimmed* entry looks like in `/context` was not observed. That a
trimmed skill would show as a surviving row with a much smaller cost beside it follows from
[§3.1](#31-context-budget)'s described behavior and is **[inferred]**, not verified. Whoever writes
the line should not promise more than that, and a session that ever sees a genuinely trimmed
listing should record what the row actually looks like.

**[`README.md`](../README.md) is no longer unchanged**, which the block above asserts. Its existing
troubleshooting bullet already told the reader to run `/doctor` for exactly this, so it was
carrying the false claim outright rather than merely lacking the new line; it was corrected in place
on 2026-08-08 to name `/context`. **The by-name recovery clause — this question's actual
contribution — is still unwritten**, and remains [Slice 12](./slices/TrackC-Slice12.md)'s task.
No [PC-01](#pc-01--scryfall-query-craft) criterion changed status.
*Resolves by:* [Slice 12](./slices/TrackC-Slice12.md) adding the recovery clause to the corrected
bullet. Nothing about this question is now blocked on a measurement.

**Amended 2026-08-11 — the clause is written; the confirmation did not happen. Disposition:
unconfirmed.** [Slice 12](./slices/TrackC-Slice12.md) added the by-name recovery clause to
[`README.md`](../README.md), so this question's actual contribution now exists on the page. What the
slice did **not** produce is the confirmation this question has demanded since 2026-08-07: the friend
dry-run ran on 2026-08-11 and the installer never ran `/context`, so **nobody has yet watched a
non-author use the mitigation.** The disposition is therefore neither *answered* nor *reopened* —
the step that would decide between them did not run. The 2026-08-07 answer and its 2026-08-08
amendment both stand unchanged. Evidence:
[`docs/slices/TrackC-Slice12-results.md`](./slices/TrackC-Slice12-results.md).

**The run does sharpen the question, and that is its contribution here.** The installer landed on
**Claude Desktop**, where `/plugin` does not exist **[verified 2026-08-11]** and where `/context` is
**unverified — nobody tried it there.** If the diagnosis clause turns out to be unreachable on the
surface a first-time installer actually reaches, the mitigation is thinner than
[§3.1](#31-context-budget)'s recovery argument assumes and the by-name invocation carries it alone.
That is **[inferred]** and deliberately not asserted; the point of writing it down is so the next run
tests it on purpose rather than rediscovering it.
*Resolves by:* a second dry-run — necessarily a **different** person, since the first is no longer a
cold reader — running `/context` once on whichever surface they installed on and pasting the output
back, and recording whether `/context` exists there at all.

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

**Half-answered 2026-08-04; the question stays open.** Both halves now have a mechanism. The
commit half is a job step in `.github/workflows/release.yml` that rebuilds `dist/` and fails the
release if the result differs from what is committed. The pack half is a guard in
`scripts/pack-mcpb.mjs` that refuses to pack when `dist/index.js` is older than anything under
`src/`. Two reasons not to call this resolved. The CI gate **has never run** — no tag has been
pushed, and it cannot be exercised on the author's machine, where `core.autocrlf=true` makes
`dist/index.js` report as modified with an empty diff after every build, so a local run proves
nothing about the CI one. And both mechanisms fire at *release* time, which leaves every ordinary
commit in exactly the drift this question describes; nothing yet checks `dist/` on a pull request.
The user-facing half is untouched either way: a released bundle still carries its `dist/` until
someone reinstalls, because there is no update path
([§4.2](#42-marketplace-and-install-path)).

**Remedy for the ordinary-commit half decided 2026-08-07: add `ci.yml` on `pull_request` and
`push: main`, running typecheck → test → build → `git diff --exit-code -- dist/`.** This is the
remedy the paragraph above already worked out; recording it as decided means
[Slice 11](./slices/TrackC-Slice11.md) implements it rather than re-arguing it. It closes the half
that leaves every ordinary commit unchecked and, as a side effect, runs the rebuild-and-diff
mechanism for the first time on any commit rather than on a tag — the local CRLF false alarm is a
working-tree artifact of `core.autocrlf=true` and does not reach a Linux runner that checks out LF.
It needs no harness: a branch and a push.

**The user-facing half stays open and CI cannot close it.** A released `.mcpb` carries whatever
`dist/` it was packed with until someone reinstalls, because Desktop has no update path
([§4.2](#42-marketplace-and-install-path)). CI can guarantee that what was packed matched `src/`
**at pack time** and says nothing about what a user is running today. The `0.0.0-dev+<commit>`
stamp remains the only mitigation, and it distinguishes a hand-packed artifact from a release
rather than detecting staleness.

**Nothing was implemented on 2026-08-07** — `.github/workflows/` still holds `release.yml` alone.
*Resolves by:* [Slice 11](./slices/TrackC-Slice11.md), which is unblocked, adding `ci.yml`, plus
the release gate actually executing once against a real tag.

**The commit half is answered 2026-08-09.** A CI workflow (`.github/workflows/ci.yml`) reinstalls
from the lockfile, rebuilds `dist/`, and fails the run if `git status --porcelain -- dist/` is
non-empty, on every pull request and every push to `main`. Chosen over a pre-commit hook
(per-clone state git does not distribute, bypassable with `--no-verify`, and a full bundle on
every commit is what makes `--no-verify` attractive) and over folding the build into `claude
plugin tag` (release-time only, while [P-08](#p-08--version-scheme) makes every commit an update
the moment a friend has the plugin installed). No new `P-` decision was minted: this is an
implementation choice recorded here because [P-09](#p-09--server-ships-as-committed-built-javascript)
created the risk. Demonstrated failing and then passing on a throwaway branch, closed unmerged:
[`docs/slices/TrackC-Slice11-results.md`](./slices/TrackC-Slice11-results.md).

**Two corrections to what the 2026-08-07 decision above recorded.** The comparison shipped is
`git status --porcelain -- dist/`, **not** the `git diff --exit-code -- dist/` that decision
named. `git diff` cannot see the failure [P-09](#p-09--server-ships-as-committed-built-javascript)
actually fears: if `dist/index.js` were *absent* from a commit, the rebuild recreates it as an
untracked file and `git diff` reports nothing at all. Porcelain catches modified, deleted and
untracked in one invocation. `release.yml`'s own gate was upgraded to the same form in the same
commit, so the two workflows no longer disagree about what "stale" means. And the local false
alarm is **not** a CRLF artifact, as the paragraph above assumed: measured on the author's machine,
the rebuilt working-tree file hashes *identically* to the index blob (`git diff` reports clean)
while `git status` still reports ` M`, and it survives both `.gitattributes` and `git update-index
--really-refresh`. It is a stale stat cache, cleared by `git add --renormalize dist/index.js`. The
conclusion that decision drew from the wrong premise nevertheless held: three green Linux runs on
healthy trees show the runner does not reproduce it.

**The user-facing half stays open, and this slice does not touch it.** The release gate has still
never executed against a real tag; [Slice 13](./slices/TrackC-Slice13.md) owns that. *Resolves by:*
a released `.mcpb` gaining any staleness signal at all, which no mechanism in this repo currently
provides.

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

**Deliberately not widened to Moxfield, 2026-08-07.** Moxfield became a second deck platform that
day, and the obvious move is to generalize this question to "a deck-platform credential." That
would be wrong: [`docs/MCP-PRD.md` D-15](./MCP-PRD.md#d-15--moxfield-writes-are-blocked-upstream-not-merely-last) records that Moxfield
has no working third-party authentication path, so **there is no Moxfield credential to be
missing, expired, or rejected** — no `userConfig` field is declared for one
([P-13](#p-13--no-user-configuration-in-phase-1)), and none will be until that changes. If
[`docs/MCP-PRD.md` OQ-10](./MCP-PRD.md#oq-10--will-moxfield-grant-this-application-approved-access-and-under-what-terms)
comes back yes, this question widens then and not before. A component that pre-writes
credential-failure wording for a credential that cannot exist is specifying against a
capability's absence.

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

**Implemented 2026-08-04 in `scripts/pack-mcpb.mjs`, and one thing the answer left open is now
settled.** The stamp reads a `MANABASE_BUNDLE_VERSION` override first, then an exact git tag,
and falls back to `0.0.0-dev+<short-sha>`; a leading `v` is stripped and a non-semver result is
refused rather than packed. The open piece was what a *tag* means once tags exist, since a
release needs one and [P-08](#p-08--version-scheme) deliberately withholds a plugin version until
Slice 13. **The tag versions the bundle only.** `plugin.json` stays version-less, Slice 13 keeps
the plugin-version question intact, and the fourth-copy trap is still avoided because no human
writes the number anywhere. The dev fallback matters as much as the tag path: it means an
untagged bundle announces itself as one, so a hand-packed artifact can never be mistaken for a
release in an install dialog that shows the version.

### PQ-10 — Does `CAP-01` gain an image URI, and what does that cost?

**Blocking [PC-04](#pc-04--card-viewer).** Opened 2026-08-11. The hook needs a stable per-card
handle and [CAP-01](./MCP-PRD.md#cap-01--card-search) returns none — no `id`, no image field, no
artist field, in the spec and in [`src/scryfall/types.ts`](../src/scryfall/types.ts) alike. Per
[§1](#1-overview)'s third consequence that makes it a `CAP` in
[`docs/MCP-PRD.md`](./MCP-PRD.md) rather than something specifiable here, and this question exists
so the plugin-side blocker persists rather than living only in a component block.

**Two things this question must not be allowed to lose.** First, **an identifier alone does not
unblock the component.** Exchanging an id for an image URL is a call to a card endpoint, the
2/second lane in
[`docs/MCP-PRD.md` §3.4](./MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance), issued by a
daemon that sits outside the server's two rate-limit lanes — two independently throttled clients in
one application, against a section that is explicit each local copy must be well-behaved on its own.
An image URI on a `*.scryfall.io` file origin is rated **unlimited** by that same section, so it
removes the problem instead of managing it. Second, **it is not free.**
[`docs/MCP-PRD.md` OQ-02](./MCP-PRD.md#oq-02--how-verbose-should-a-search-result-be) was answered
and implemented on 2026-08-10 with a legality trim and an 88-card page cap, after a payload breached
a harness tool-result ceiling at 111 cards. A URL per card pushes against a budget that was settled
three days ago and settled expensively, so "add one field" is the wrong frame for it.

*Resolves by:* running `docs/prompts/02-add-capability-prompt.md` against
[`docs/MCP-PRD.md`](./MCP-PRD.md) and deciding there whether
[CAP-01](./MCP-PRD.md#cap-01--card-search) returns an image URI, behind what default, and at what
measured cost to a full page. Not by any edit to this document. Two Scryfall field-level facts that
decision needs are **unverified here and deliberately so** — the key set of `purchase_uris`, and
whether `image_uris` sits on `card_faces` for double-faced cards — because `scryfall.com` returned
HTTP 403 to an honestly identified fetcher on 2026-08-11 and
[`docs/MCP-PRD.md` §3.7](./MCP-PRD.md#37-undocumented-and-bot-protected-third-party-apis) makes a
block an answer rather than an obstacle to route around.

**Answered 2026-08-11, upstream and the same day, by
[`docs/MCP-PRD.md` OQ-13](./MCP-PRD.md#oq-13--should-a-card-search-result-carry-image-uris-and-at-what-cost).
Yes — behind an opt-in, at a measured +21.6%.** [CAP-01](./MCP-PRD.md#cap-01--card-search) gains
`images: "none" | "normal"` defaulting to `"none"`, returning an **array** of Scryfall `normal`
URIs, one per face, plus an acceptance criterion 15. **It is not implemented**, and
[CAP-01](./MCP-PRD.md#cap-01--card-search) stays delivered against criteria 1–14 — so what this
answer removes is the *specification* blocker, not the build one.
[PC-04](#pc-04--card-viewer) moves `proposed` → `specified` because
[§6](#6-roadmap) already named that the condition, and it moves no further because criterion 15 has
no slice.

**Both things this question refused to lose survived the answer**, which is the point of having
written them down. The identifier route was rejected *despite* being measurably cheaper — a bare
`id` costs +8.5% against the image array's +21.6% — and rejected on exactly the
[§3.4](./MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance) grounds recorded above rather
than on bytes. And the cost was real: the array is +9,888 characters on an 88-card page, which is
why it is off by default rather than simply added.

**Three things the answer establishes that this component's block predates.** A transform card
carries **no top-level `image_uris` at all** — the object sits on each `card_faces` entry — which is
why the field is an array and why [PC-04](#pc-04--card-viewer)'s both-faces criterion is cheap
rather than an extra lookup. The image URL **is** derivable from a card `id` and the `?timestamp`
is optional, verified live; that route is recorded and deliberately not taken, so the hook must
never assemble one. And `purchase_uris` carries exactly three keys — `tcgplayer`, `cardmarket`,
`cardhoarder` — which settles the fact
[PQ-11](#pq-11--does-an-explicit-push-command-justify-reopening-the-bin-executables-rejection)'s
neighbouring marketplace-link reasoning was written without. Details and method:
[`docs/MCP-PRD.md` §4.1.4](./MCP-PRD.md#414-card-image-uris).

**Closed.** No follow-up question is opened here: what remains is implementation, which
[`docs/MCP-PRD.md` OQ-13](./MCP-PRD.md#oq-13--should-a-card-search-result-carry-image-uris-and-at-what-cost)
owns, and one thing that document states as unsettled — whether an opted-in page needs its own cap,
since the 88-card cap was sized against a payload with no images.

### PQ-11 — Does an explicit push command justify reopening the `bin/` executables rejection?

Opened 2026-08-11 with [PC-04](#pc-04--card-viewer). That component's hook covers the case that
motivated it — cards appear after a search. It does not cover "show me these three cards" said
mid-conversation, which would want a command on the Bash tool's `PATH` and is therefore a reopening
of [§8](#8-out-of-scope)'s `bin/` rejection rather than a detail of this component.

**Recorded rather than taken.** [§8](#8-out-of-scope) rejects `bin/` because adding names to a
user's `PATH` is a larger imposition than the feature repays, and that reasoning still holds for
everyone who does not want the viewer — which, given [PC-04](#pc-04--card-viewer) is default-off, is
everyone by default. A component reopening a rejection on its first outing should have to earn it,
and the honest sequence is to ship the hook, find out whether it is insufficient in practice, and
then argue from that rather than from anticipation.
*Resolves by:* [PC-04](#pc-04--card-viewer) shipping and the author finding the search-triggered
path genuinely inadequate. Until then the answer is no, and it is no for a reason rather than by
default.

### PQ-12 — Does a `userConfig` boolean with a default prompt at enable time?

Opened 2026-08-11 with [PC-04](#pc-04--card-viewer), whose opt-in switch is a `userConfig` boolean
`viewer_enabled` defaulting to false ([§4.4](#44-user-configuration)). The mechanism is right — it
is harness-native, it costs no context, and the rejected alternatives are worse — but its price is
paid by people who will never turn the viewer on.

**The stake is a criterion, not a preference.** [PC-02](#pc-02--bundled-mcp-server) criterion 2 is
"enabling the plugin produces zero configuration prompts", and
[P-01](#p-01--plugin-is-the-distribution-unit) treats the empty enable-time prompt as the strongest
available demonstration of its claim. [P-13](#p-13--no-user-configuration-in-phase-1) scopes the
zero-prompt rule to Phase 1, so shipping this violates no decision — but it changes the install
story for every user, and a criterion that quietly stops being true is worse than one deliberately
retired. The documentation says `userConfig` values are "prompted at enable time" and distinguishes
`required` only by whether validation fails on empty; **whether a non-required boolean carrying a
`default` is skipped is not stated.** `claude plugin install --config viewer_enabled=true` exists
and makes the prompt avoidable for anyone scripted, which is a mitigation and not an answer.
*Resolves by:* declaring one non-required defaulted boolean on a scratch plugin and enabling it on a
cold profile to observe whether a dialog appears — cheap, and it needs no part of
[PC-04](#pc-04--card-viewer) to exist. If it does prompt, the follow-up question is whether
[PC-02](#pc-02--bundled-mcp-server) criterion 2 is reworded, scoped to a viewer-less install, or
retired, and that is this document's owner's call rather than a component's.

### PQ-13 — What sets `images: "normal"` when the viewer is enabled?

Opened 2026-08-11 when
[PQ-10](#pq-10--does-cap-01-gain-an-image-uri-and-what-does-that-cost) closed. Its answer is an
**opt-in defaulting to `"none"`**, so a `card_search` call carries image URIs only when something
asked for them — and [PC-04](#pc-04--card-viewer)'s hook cannot be that something. A `PostToolUse`
hook runs *after* a call it did not compose; it observes a response and cannot retroactively add a
parameter to the request that produced it. Nothing currently causes the parameter to be set, so the
viewer as specified displays nothing on an ordinary search.

**This is a known cost, not a discovery**, and it should not be re-litigated as though the opt-in
were a mistake. It was weighed against an always-on field and against an install-level switch when
[`docs/MCP-PRD.md` OQ-13](./MCP-PRD.md#oq-13--should-a-card-search-result-carry-image-uris-and-at-what-cost)
was decided: an always-on image array costs **+21.6%** on every page for every user forever,
including the overwhelming majority who will never enable a viewer, and that is the cost the
default-off choice declines to impose. What was not settled in the same breath is how the minority
who *do* enable it get the field, and that omission is this question.

**Three candidate mechanisms, none chosen.** [PC-01](#pc-01--scryfall-query-craft)'s skill could
teach the model to set it — rejected on sight, because a skill travels to every surface and would
ask for images on installs with no viewer and no hook
([§3.6](#36-skills-carry-instructions-never-facts) is about card facts, but the same
surface-independence argument applies). An install-level switch read once at the server's entry
point ([`docs/MCP-PRD.md` D-03](./MCP-PRD.md#d-03--testability-handlers-callable-as-plain-functions))
and driven by the same `userConfig` value as the hook would need no model cooperation at all, at the
price of the same query returning different shapes on different machines — and it is a
[`docs/MCP-PRD.md`](./MCP-PRD.md) change, not this document's to make. Or the viewer accepts that it
fires only on calls that happened to ask, which makes it unreliable in exactly the case that
motivated it.
*Resolves by:* whichever session schedules [CAP-01](./MCP-PRD.md#cap-01--card-search)'s criterion
15, because the second candidate changes what that criterion has to assert. **It blocks
[PC-04](#pc-04--card-viewer) from being built and does not block it from being `specified`** — the
component's behavior, surface and criteria are settled; what is unsettled is a mechanism one layer
down, in the document that owns it.

---

## 8. Out of scope

Explicitly rejected, with reasons, so these do not resurface.

**Everything already rejected in [`docs/MCP-PRD.md` §8](./MCP-PRD.md#8-out-of-scope)** — TCGplayer, hosted deployment, SSE,
embeddings for rules, reimplementing Scryfall's search engine, a transport abstraction layer,
the npm `archidekt` and `moxfield-api` packages, bundling the Comprehensive Rules, any paywall or
access gate, any technique for defeating a third party's bot protection, deck platforms beyond
Archidekt and Moxfield, and writing to Moxfield while its authentication is unreachable.
Referenced, not restated. That list governs here unchanged, and it is that document's to amend —
the 2026-08-07 additions and the one amendment are logged in
[`docs/MCP-PRD.md` §9](./MCP-PRD.md#9-revision-log).

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
| 2026-08-04 | **[PC-03](#pc-03--mcpb-bundle-for-the-chat-tab) moves from `specified`/unassigned to `in progress`/Slice 11, gains criteria 9, 10 and 11, and criterion 5 is verified.** The build path is committed: `mcpb/manifest.json`, `scripts/pack-mcpb.mjs` (`npm run pack:mcpb`), and `.github/workflows/release.yml` — the repo's first `.github/` — which on a `v*` tag typechecks, tests, rebuilds `dist/` and fails on a diff, packs, and attaches `manabase.mcpb` to a Release. **[PQ-09](#pq-09--how-does-the-mcpb-manifest-version-relate-to-p-08) implemented**, and the piece its answer left open is settled: **a tag versions the bundle, not the plugin**, so [P-08](#p-08--version-scheme) is untouched and Slice 13 still owns the plugin-version question; an untagged pack stamps `0.0.0-dev+<commit>`. **[PQ-06](#pq-06--what-keeps-the-committed-dist-honest) half-answered and deliberately left open** — both halves now have a mechanism, but the CI gate has never run, it cannot be exercised on a machine where `core.autocrlf=true` makes `dist/index.js` report modified with an empty diff, and neither mechanism watches an ordinary commit. [§4.2](#42-marketplace-and-install-path) gains a second dated addendum recording three properties of the Chat-tab install: **the MCPB manifest format has no `skills` field**, verified against the published specification; **double-click is not a reliable install route** and Settings → Extensions → Advanced settings → Install Extension is; and **an installed extension has no update path**. Criterion 3's wording corrected from "double-clicking the `.mcpb`" to "installing the `.mcpb`" — it was written from the documented routes rather than from the run. | The question driving the session was whether a friend can be handed this. The answer for Claude Code is yes and was already; for the Chat tab it is **two installs, permanently** — the format cannot carry a skill, so one-click is not a packaging problem this project can engineer away, and the honest move is to document the pair as one procedure rather than imply a future where it collapses to one. The other two findings are both cases where following the vendor documentation would have produced a broken instruction: double-click is listed first and did not work, and the absence of an update path is stated nowhere, which makes it something a user discovers by silently running a stale server. Recording them in [§4.2](#42-marketplace-and-install-path) rather than only in `README.md` is what keeps a later session from re-deriving them. Criterion 10 is entered **unverified on purpose**: the workflow's value is entirely in a run that has not happened, and marking it verified because the file exists would repeat the [PC-01](#pc-01--scryfall-query-craft) static-criteria failure this document has now recorded twice. |
| 2026-08-07 | **Moxfield recorded as a second deck platform on this document's side — as pointers only, per [§1](#1-overview)'s boundary rule.** No component was added, no `PC` block was written, no [PC-01](#pc-01--scryfall-query-craft)/[PC-02](#pc-02--bundled-mcp-server)/[PC-03](#pc-03--mcpb-bundle-for-the-chat-tab) criterion changed status, and Phase 1 is untouched. What changed: [P-05](#p-05--credentials-collected-through-userconfig) and [P-13](#p-13--no-user-configuration-in-phase-1) gain dated notes recording that Moxfield adds **no** credential to collect; [§4.4](#44-user-configuration) says the same about the mechanism it documents; [PQ-08](#pq-08--what-does-a-user-see-when-the-archidekt-credential-is-missing-expired-or-rejected) is explicitly **not** widened to Moxfield and says why; [§6](#6-roadmap)'s Deck analysis row now names both platforms and records that it waits on the first, not both; [§8](#8-out-of-scope)'s reference to the other document's rejection list is brought current. The substance — [D-13](./MCP-PRD.md#d-13--deck-platform-order-archidekt-first-moxfield-second), [D-14](./MCP-PRD.md#d-14--no-npm-moxfield-api-dependency), [D-15](./MCP-PRD.md#d-15--moxfield-writes-are-blocked-upstream-not-merely-last), [§3.7](./MCP-PRD.md#37-undocumented-and-bot-protected-third-party-apis), [§4.8](./MCP-PRD.md#48-moxfield), [OQ-10](./MCP-PRD.md#oq-10--will-moxfield-grant-this-application-approved-access-and-under-what-terms)–[OQ-12](./MCP-PRD.md#oq-12--what-is-the-normalized-deck-shape-and-does-one-tool-serve-both-platforms-or-two) — is all in [`docs/MCP-PRD.md`](./MCP-PRD.md), which owns it. | A data source is server behavior, so the boundary rule puts every Moxfield decision in the other document and leaves this one with the consequences: what the user is prompted for, and what a component may assume exists. Both consequences turned out to be **negative findings**, which is why they are recorded rather than skipped as "nothing changed." The tempting errors here are symmetrical and both silent — declaring a Moxfield `userConfig` field to match Archidekt's shape, which prompts for a credential that cannot be exchanged for a token; and widening [PQ-08](#pq-08--what-does-a-user-see-when-the-archidekt-credential-is-missing-expired-or-rejected) to cover a credential-failure path that does not exist. A future session that finds Moxfield in the MCP PRD and nothing here would reasonably assume this document had not caught up, and would then make one of those two edits. |
| 2026-08-07 | **[PQ-03](#pq-03--what-triggers-a-refresh-of-the-bulk-data-and-the-comprehensive-rules-cache-and-should-it-ever-be-a-sessionstart-hook)'s hook half answered: never a `SessionStart` hook**, recorded as a standing constraint. The entry states the constraint at its true width — it rules out **this plugin shipping** such a hook, not hooks in general and not background refresh in general, so lazy first-use refresh, an explicit user-invoked action, and an in-tool staleness check all remain available. Storage layout and whether first use blocks on a download stay open and stay with the capability that first needs persistence, which is the other half of [`docs/MCP-PRD.md` OQ-03](./MCP-PRD.md#oq-03--what-is-the-bulk-data-storage-strategy-and-when-is-it-introduced). No component was added and no [§5](#5-components) criterion changed status. | The question was recorded in 2026-07-29 as a *disagreement* with the brief rather than a gap, and the three reasons against the hook — the every-project network call for 5–20 users, Phase 1's deliberate absence of any hook, and [§3.4](#34-cross-platform-reach) making the first hook component own the exec-form and Windows-shell problem — converge with nothing found opposing them. Deciding it now costs nothing and pre-empts nothing, and it stops the next capability that wants a refresh trigger from re-arguing it from scratch. The width caveat is in the entry because the failure mode of an over-read constraint is a capability that concludes it may not refresh at all. |
| 2026-08-07 | **[PQ-04](#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed) answered: a README line is sufficient, and it names invoking `manabase:scryfall-query-craft` by name before it names `/doctor`.** The drafted wording is recorded in the entry. **The line is not written** — [`README.md`](../README.md) is unchanged and no [PC-01](#pc-01--scryfall-query-craft) criterion changed status; [Slice 12](./slices/TrackC-Slice12.md) already carries the task. | What makes documentation sufficient here rather than resigned is a fact this question was framed without: [§3.1](#31-context-budget) records that trimming drops descriptions and **keeps names**, so a trimmed skill is still invocable and the degradation is recoverable rather than merely detectable. That is a materially different thing to document than "run `/doctor`". The line deliberately does not assert that `/doctor` names this plugin among the contributors — unverified until [Slice 10](./slices/TrackC-Slice10.md) — and deliberately does not try to make [PC-01](#pc-01--scryfall-query-craft) robust to having no description, which is impossible because the description *is* the invocation mechanism. |
| 2026-08-07 | **[PQ-06](#pq-06--what-keeps-the-committed-dist-honest)'s remaining commit-half remedy decided: a `ci.yml` on `pull_request` and `push: main` running typecheck → test → build → `git diff --exit-code -- dist/`.** [Slice 11](./slices/TrackC-Slice11.md) implements it. **The user-facing half stays open and is not closable by CI** — a released `.mcpb` carries its `dist/` until someone reinstalls, so CI can only guarantee that what was packed matched `src/` at pack time. **Nothing was implemented**: `.github/workflows/` still holds `release.yml` alone, and the question stays open. | The remedy was already worked out inside the question on 2026-08-04 and left unrecorded as a decision, which is the state that invites a slice to re-argue it or to pick a different mechanism. Recording it converts [Slice 11](./slices/TrackC-Slice11.md)'s "recommended" CI check into its assignment. The side effect matters as much as the fix: this is also what runs the rebuild-and-diff mechanism for the first time, since the release gate has never executed and cannot be exercised on a machine where `core.autocrlf=true` makes `dist/index.js` report modified with an empty diff. Splitting the two halves explicitly is what keeps a future session from closing this question the moment CI goes green. |
| 2026-08-08 | **Context-cost measurement ([Slice 10](./slices/TrackC-Slice10.md)) on Claude Code 2.1.226, model `claude-opus-5[1m]`, under the author's full two-plugin load.** Plugin always-on **~258 tokens** across 1 skill and 1 MCP server; [PC-01](#pc-01--scryfall-query-craft) always-on **~260** by `claude plugin details` and **~270** by `/context`, so **criterion 2 is ambiguous-because-scaled against ≤250 and is *not* recorded as met** — no instrument reports it under the gate, and neither reports a precise figure. [PC-02](#pc-02--bundled-mcp-server) **criterion 10 satisfied**: the complete `claude plugin details` output is recorded in [`docs/slices/TrackC-Slice10-results.md`](./slices/TrackC-Slice10-results.md) and pointed to from here by path rather than pasted into this table, following the precedent [Slice 6](./slices/TrackA-Slice6.md) set for [CAP-01](./MCP-PRD.md#cap-01--card-search). **[PQ-01](#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports) answered:** MCP tool schemas **do not** count toward the reported always-on total — with `.mcp.json` ~258, without ~258 (inventory `MCP servers (0)`), restored ~258, control `A₂ = A₁` holding — because on this surface they are **deferred** rather than merely unreported: `/context` prices them at **0 resident**, ~398 on demand for `card_search`. **[PQ-02](#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed) answered:** the skill listing is **4.2k of a ~10,000-token budget (~42%) across 47 skills with nothing trimmed**, of which Manabase is ~270 (~2.7%), so [§3.1](#31-context-budget)'s silent degradation is **theoretical on this machine on this model** — and would be certain on a 200k-context window, since the budget is 1% of the window rather than a constant. [§4.6](#46-context-cost-accounting) gains a dated addendum (4.6.1) recording that the 2.1.220 grounding measurement **reproduces exactly** at ~1,722 on 2.1.226, that a per-component figure can exceed the plugin total, that the two instruments disagree by ~9%, and that **`/doctor` is a health-check workflow, not the listing-cost report** three places in this document describe. [PC-01](#pc-01--scryfall-query-craft) and [PC-02](#pc-02--bundled-mcp-server)'s Context cost bullets carry the measured figures. No [§5](#5-components) criterion other than [PC-02](#pc-02--bundled-mcp-server)'s 10 changed status; no `P-` decision was added; §2 and §3 untouched. | [Slice 10](./slices/TrackC-Slice10.md) (`docs/DEV-ROADMAP.md`) — establishes the measured baseline [§3.1](#31-context-budget) and [PQ-02](#pq-02--what-is-this-plugins-measured-always-on-cost-and-does-it-fit-alongside-what-the-author-already-has-installed) are checked against, and gives [PC-02](#pc-02--bundled-mcp-server)'s one genuinely unknown cost figure a value. **[PQ-01](#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports) retires rather than merely answers its own stake.** That question mattered because a tool schema, unlike a skill description, cannot be budget-trimmed, so a resident schema would have been a fixed unbudgetable per-session cost and would have made tool count and description length a context-budget constraint in [`docs/MCP-PRD.md`](./MCP-PRD.md). Deferral removes the premise, so [OQ-01](./MCP-PRD.md#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) does **not** gain the cost side it would have gained had the answer gone the other way, and nothing in this slice edits that document. Two limits are recorded with the answer so it is not over-read: deferral is the harness default and an opted-out server pays ~398 every session, and the behavior is unmeasured on the Chat tab, where [P-12](#p-12--plugin-name-and-server-key) has already shown per-surface behavior to differ. **The method finding is the durable one.** The installed plugin is a pinned clone in the plugin cache keyed by commit SHA, not the working tree — moving the repo's `.mcp.json` would have changed nothing the instrument reads and returned A = B for a reason unrelated to token accounting, which is the same silent-wrong-answer class as the unparsed frontmatter and the dropped invalid term. The A/B was run against the installed copy and restored byte-exactly. **[PQ-04](#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed)'s follow-up is answered negatively and needs no rework:** it asked this slice to confirm whether `/doctor` names this plugin among the listing's contributors, and it does not name contributors at all. That answer had explicitly declined to assume otherwise and wrote its README line to read correctly either way, so the line [Slice 12](./slices/TrackC-Slice12.md) carries is unaffected and only its closing `/doctor` sentence is stale, which is that slice's call. **One existing [`README.md`](../README.md) troubleshooting bullet did assert the false capability outright** — "Run `/doctor` — it estimates the listing cost against the budget and names the biggest contributors" — and was corrected in place to name `/context`, decided with the author rather than deferred, because [Slice 12](./slices/TrackC-Slice12.md) *is* the friend dry-run and is therefore exactly where a friend would have hit it. |
| 2026-08-08 | **This document's build-status header is superseded; every clause of the 2026-08-04 block was false.** That block said the plugin had never been installed from a marketplace, `SKILL.md` was unwritten, `claude plugin details` had never been run, and therefore every [PC-01](#pc-01--scryfall-query-craft)/[PC-02](#pc-02--bundled-mcp-server) criterion and every `PQ` remained open. [Slice 7](./slices/TrackB-Slice7.md), [Slice 8](./slices/TrackB-Slice8.md) and [Slice 10](./slices/TrackC-Slice10.md) each falsified one of those in turn. The dated block is **left exactly as written** and a **Build status 2026-08-08** block is appended beside it carrying current state: [PC-01](#pc-01--scryfall-query-craft) criteria 1, 3–11, 13 and 15 verified and [PC-02](#pc-02--bundled-mcp-server) criteria 1, 2, 3, 4, 6, 7 and 10; [PC-01](#pc-01--scryfall-query-craft)'s 2, 12 and 14 each unverified for a *different* reason, stated individually; three components specified rather than two, since [PC-03](#pc-03--mcpb-bundle-for-the-chat-tab) was added 2026-08-04. No criterion changed status in this row and [§5](#5-components) is unedited. | A status header is the one paragraph every cold reader trusts without checking, which makes a stale one more expensive than no header at all — and this one had been contradicted by its own [§9](#9-revision-log) for four days across five landed slices. It is superseded rather than rewritten because the block is dated and this document does not overwrite dated records, the same handling [CAP-01](./MCP-PRD.md#cap-01--card-search)'s delivery note gets in the companion document. The three unverified [PC-01](#pc-01--scryfall-query-craft) criteria are enumerated with their individual reasons deliberately: 2 is measured and missed, 12 was never measured with the skill, and 14 postdates the run that would have covered it — collapsing those into one count would reproduce exactly the "all twelve" flattening the companion row corrects. |
| 2026-08-08 | **[PQ-04](#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed) amended — the line it drafted cannot be written as drafted.** Its 2026-08-07 answer ends "Run `/doctor` to confirm whether trimming is what happened", and [Slice 10](./slices/TrackC-Slice10.md) established that `/doctor` on 2.1.226 neither prices the skill listing against a budget nor names contributors. The dated answer is left as written and an **Amended 2026-08-08** block appended: the **first two sentences stand** — the symptom clause and the by-name recovery, which rest on [§3.1](#31-context-budget)'s trimming keeping names and never depended on `/doctor` — and only the diagnosis clause moves, to `/context`. The last clause carries an explicit **[inferred]** marker: [Slice 10](./slices/TrackC-Slice10.md) measured a listing with **nothing trimmed**, so what a trimmed row looks like in `/context` was reasoned from [§3.1](#31-context-budget), not observed. Also corrected: the block's claim that [`README.md`](../README.md) is unchanged — its troubleshooting bullet already told the reader to run `/doctor` for exactly this and was fixed in place the same day. **The by-name recovery clause is still unwritten and remains [Slice 12](./slices/TrackC-Slice12.md)'s.** No [PC-01](#pc-01--scryfall-query-craft) criterion changed status. | The question was answered and its answer had a dependency nobody had checked — the 2026-08-07 entry was explicit that it declined to claim `/doctor` would name the plugin, but it still assumed `/doctor` reported on the listing at all. Being right about the smaller uncertainty concealed the larger one, which is why the amendment records what actually failed rather than quietly swapping a command name. Splitting the drafted line into the part that survives and the part that does not is the useful output: [Slice 12](./slices/TrackC-Slice12.md) inherits a line it can write today instead of a question reopened, and the recovery clause — the thing that makes documentation a mitigation rather than a shrug — was never what broke. The `[inferred]` marker is there because the alternative is a README sentence promising a diagnostic nobody has watched work, which is the failure mode this document has now recorded three times. |
| 2026-08-09 | **[PQ-06](#pq-06--what-keeps-the-committed-dist-honest)'s commit half closed: the committed `dist/` is kept honest by a CI rebuild-and-diff (`.github/workflows/ci.yml`), which also runs typecheck and the unit tests, on every pull request and every push to `main`.** Recorded the two rejected alternatives  a pre-commit hook (per-clone state git does not distribute, bypassable with `--no-verify`) and folding the build into `claude plugin tag` (release-time only, while [P-08](#p-08--version-scheme) makes every commit an update)  and the byte-reproducibility constraints the check rests on: `npm ci` against the committed lockfile, a toolchain Node pinned once in `.nvmrc` and read by both workflows, and `dist/index.js` pinned to LF in a `.gitattributes` scoped to that one path. **Two corrections to the 2026-08-07 decision this implements.** The comparison shipped is `git status --porcelain -- dist/`, not the `git diff --exit-code` that decision named, because an *absent* `dist/index.js` is recreated by the rebuild as an untracked file that `git diff` does not report at all; `release.yml`'s own gate was upgraded to the same form. And the local false alarm is a stale **stat cache**, not a CRLF artifact  the rebuilt file hashes identically to the index blob while `git status` still reports ` M`, surviving both `.gitattributes` and `git update-index --really-refresh`. **The user-facing half stays open** and no `P-` decision was minted. Evidence: [`docs/slices/TrackC-Slice11-results.md`](./slices/TrackC-Slice11-results.md). | [Slice 11](./slices/TrackC-Slice11.md) (`docs/DEV-ROADMAP.md`)  [P-09](#p-09--server-ships-as-committed-built-javascript) traded a build step for a silent-drift risk and this is the detector it was traded against. The evidence requirement is the point of the row: a check that has never been observed failing is not known to work, and this one was demonstrated failing on a deliberately stale `dist/` and then going green on the rebuild, on the same branch and the same workflow, before the question was touched. **The first attempt at that demonstration failed to demonstrate anything**  it edited `src/config.ts`, which `tests/config.test.ts` asserts, so `npm test` failed and the gate step never ran. That is requirement 10's ordering working exactly as designed, and it is also the trap for anyone repeating the exercise: the breakage must be in a module no test covers, which is why the demo edits `src/index.ts`. |
| 2026-08-10 | **The first MCPB bundle release — [PC-03](#pc-03--mcpb-bundle-for-the-chat-tab) criteria 7 and 10 verified, and nothing else moved.** Tag `v0.1.0` on `2c7196c` (PR #37) ran [`.github/workflows/release.yml`](../.github/workflows/release.yml) for the first time it has ever executed, and published a Release carrying `manabase.mcpb` at 111,760 bytes — the first artifact this project has produced that a user downloads rather than builds. **Criterion 7** is asserted inside [`scripts/pack-mcpb.mjs`](../scripts/pack-mcpb.mjs) rather than as a workflow step, so CI inherits it through `npm run pack:mcpb` and there is no second copy to drift: it unpacks the archive it just wrote and compares that `server/index.js` to the committed `dist/index.js` by sha256, deleting the bundle on mismatch, and it was demonstrated failing before it was trusted. **Criterion 8 — installing asks for no configuration — is now the only [PC-03](#pc-03--mcpb-bundle-for-the-chat-tab) criterion unverified.** Criteria 3 and 4 were re-confirmed against the *released* artifact rather than the 2026-08-04 hand-packed one — the bundle was downloaded from the Release and installed on Claude Desktop, and a card question called the tool; they keep their existing dates and status, recorded as corroboration and not as a status change, because the artifact under test differed rather than the criterion. **This is [Slice 13](./slices/TrackC-Slice13.md)'s [PC-03](#pc-03--mcpb-bundle-for-the-chat-tab) half and no more.** The tag names the **bundle**, not the plugin ([PQ-09](#pq-09--how-does-the-mcpb-manifest-version-relate-to-p-08)): `.claude-plugin/plugin.json` still carries **no** `version`, [P-08](#p-08--version-scheme) is untouched, `claude plugin validate . --strict` still fails on that one warning, and [PC-02](#pc-02--bundled-mcp-server) criterion 9 stays open. No [PC-01](#pc-01--scryfall-query-craft), [PC-02](#pc-02--bundled-mcp-server) or [CAP-01](./MCP-PRD.md#cap-01--card-search) criterion changed status. **[PQ-06](#pq-06--what-keeps-the-committed-dist-honest) did not move in either half**, and **[PQ-05](#pq-05--should-the-plugin-be-submitted-to-the-community-marketplace-once-it-is-stable) has no disposition, so [§6](#6-roadmap)'s Phase 1 is *not* closed** and neither is [Slice 13](./slices/TrackC-Slice13.md). [`release.yml`](../.github/workflows/release.yml)'s action pins were bumped `@v4` → `@v7` before that first run rather than after it. Evidence: [`docs/slices/TrackC-Slice13-results.md`](./slices/TrackC-Slice13-results.md). | [Slice 13](./slices/TrackC-Slice13.md) partially executed, attributed that way with the author ([`docs/DEV-ROADMAP.md`](./DEV-ROADMAP.md)) — the slice bundles two things **by schedule, not by dependency**, and only the half that does not need [Slice 12](./slices/TrackC-Slice12.md) was run. The bundle release is not gated on the friend dry-run because the tag moves nothing a plugin user experiences; the [P-08](#p-08--version-scheme) switchover is gated on it, because [§6](#6-roadmap)'s Phase 1 closes on [PC-01](#pc-01--scryfall-query-craft) and [PC-02](#pc-02--bundled-mcp-server) verified and [PC-02](#pc-02--bundled-mcp-server)'s remaining evidence *is* that dry-run. **Criterion 10's whole value was in a run that had not happened** — the 2026-08-04 row entered it unverified on purpose, refusing to mark it verified because the file existed — so this row is what that entry was waiting for. Criterion 7's placement is the same reasoning one level down: comparing the staging tree, which is a copy of `dist/`, would have passed forever and detected nothing. **Two traps for whoever runs the other half.** `v0.1.0` is spent, and `claude plugin tag` writes into the same `v*` namespace [`release.yml`](../.github/workflows/release.yml) watches — if it emits `v<semver>` it will fire the release workflow and cut a second bundle release, so discover its format with `--dry-run` first and pick a version string that has not been used. And **a released bundle cannot be withdrawn**, because it has no update path: a defect ships as a new version and a new tag, and `v0.1.0` is never moved or deleted. Shipping an artifact real people install arguably **sharpens** [PQ-06](#pq-06--what-keeps-the-committed-dist-honest)'s user-facing half rather than easing it. |
| 2026-08-10 | **A second bundle release, `v0.1.1` — and no [PC-03](#pc-03--mcpb-bundle-for-the-chat-tab) criterion changed status.** Cut after [`docs/MCP-PRD.md` CAP-01](./MCP-PRD.md#cap-01--card-search)'s [Slice 14](./slices/TrackA-Slice14.md) merged (PR #41), to carry the issue-#25 result-size fix to the Chat tab, which is the surface that **cannot** recover an oversized result because it has no shell. `manabase.mcpb`, 113,631 bytes, on the merge commit. **Criterion 7 held on a second, independently produced artifact** — the *downloaded* asset's `server/index.js` sha256-matches the committed [`dist/index.js`](../dist/index.js) — recorded as corroboration, not a status change. **Criterion 8 remains the only unverified one**: `v0.1.1` has not been installed on Desktop. `v0.1.0` was **not moved or deleted**, so this component now has **two live releases, one of them known stale**. [P-08](#p-08--version-scheme) untouched, `plugin.json` still version-less, [PC-02](#pc-02--bundled-mcp-server) criterion 9 still open, [§6](#6-roadmap)'s Phase 1 still not closed. Evidence: [`docs/slices/TrackA-Slice14-results.md`](./slices/TrackA-Slice14-results.md). | The 2026-08-04 finding that an installed extension has no update path is what makes this row worth writing rather than filing under "we released again": **shipping the fix did not deliver it.** Every `v0.1.0` install still carries the payload that breaks on a reasonable query, and nothing in Claude Desktop will say so — so [PQ-06](#pq-06--what-keeps-the-committed-dist-honest)'s user-facing half is now not merely open but *demonstrated*, with a concrete stale artifact in the wild rather than a hypothetical one. That is a stronger case for whatever answers it than the question had yesterday. One trap surfaced in the cutting and belongs here because the next person will hit it: the version first chosen was `0.1.01`, which is **not valid semver** — a leading zero in a numeric identifier is forbidden — and [`scripts/pack-mcpb.mjs`](../scripts/pack-mcpb.mjs)'s guard, `^\d+\.\d+\.\d+(?:[-+].+)?$`, **accepts it**, because `\d+` matches `01`. It would have stamped a malformed version into an artifact that cannot be recalled. Validate a candidate against real semver rather than that regex; widening the guard is an obvious follow-up and was deliberately **not** folded into a release cut. |
| 2026-08-11 | **Docs polish and the friend dry-run — a *partial* run, and [Slice 12](./slices/TrackC-Slice12.md) does not close on it.** One non-author installed the plugin on **Windows 11, Claude Code 2.1.219**: the install **succeeded** and card search worked on **both** Claude Desktop tabs, but by a path [`README.md`](../README.md) did not describe. **Three friction issues filed — #43, #44, #45 — and two or three author interventions.** The four observations this slice exists to buy were **not captured**: the handover message, the friend's questions and whether tools fired, their hesitations verbatim, and the `/context` output. Acceptance criterion 8 **fails**; criteria 6 and 7 are **partial**. **[PQ-04](#pq-04--how-would-the-author-detect-that-a-friends-skill-listing-has-been-budget-trimmed) is unconfirmed** — the by-name recovery clause is written, and nobody has yet watched a non-author use it. [`README.md`](../README.md) gained a **git** prerequisite ordered ahead of Claude Code, an Install section split into terminal-CLI and Claude Desktop routes, both Desktop rows corrected to **two installs**, and a Desktop-first troubleshooting entry. Fan Content disclaimer re-verified byte-identical (whitespace-normalized) across `plugin.json`, the marketplace entry and the README. Results: [`docs/slices/TrackC-Slice12-results.md`](./slices/TrackC-Slice12-results.md). | Track C [Slice 12](./slices/TrackC-Slice12.md) ([`docs/DEV-ROADMAP.md`](./DEV-ROADMAP.md)) — the last gate before the [P-08](#p-08--version-scheme) switchover, which **stays gated**. [PC-02](#pc-02--bundled-mcp-server)'s "what the user sees when something is wrong" now has a documented surface corrected by someone who did not write it, which is the part that worked. Two things are filed rather than fixed because this slice may edit neither [§4](#4-harness-and-delivery) nor a PC block: **#45 contradicts [§4.2](#42-marketplace-and-install-path)'s `[verified 2026-08-04]` claim that the Desktop Code tab needs no second artifact**, and [PC-02](#pc-02--bundled-mcp-server) criterion 1 describes no reachable path on Claude Desktop, where `/plugin` does not exist. [PC-03](#pc-03--mcpb-bundle-for-the-chat-tab) criterion 8 stays unverified — a non-author installed the released bundle and nobody recorded whether it prompted. |
| 2026-08-11 | **[PC-04](#pc-04--card-viewer) appended (card viewer, hook) with `Status: proposed` and a blocking prerequisite — the first hook component this plugin has specified, and nothing was built.** It is `proposed` rather than `specified` because [CAP-01](./MCP-PRD.md#cap-01--card-search) returns no per-card handle — no `id`, no image field, no artist field, in its behavior block and in [`src/scryfall/types.ts`](../src/scryfall/types.ts) alike — so per [§1](#1-overview)'s third consequence the work is a `CAP` in [`docs/MCP-PRD.md`](./MCP-PRD.md) and this document says so and stops. Three questions opened: **[PQ-10](#pq-10--does-cap-01-gain-an-image-uri-and-what-does-that-cost)** (blocking — the [CAP-01](./MCP-PRD.md#cap-01--card-search) prerequisite), **[PQ-11](#pq-11--does-an-explicit-push-command-justify-reopening-the-bin-executables-rejection)** (an explicit push command versus [§8](#8-out-of-scope)'s `bin/` rejection, recorded rather than taken), and **[PQ-12](#pq-12--does-a-userconfig-boolean-with-a-default-prompt-at-enable-time)** (whether the opt-in switch costs [PC-02](#pc-02--bundled-mcp-server) criterion 2). [§4.1](#41-harness-features-relied-on) gains a dated addendum recording the hook mechanics researched for it, and [§6](#6-roadmap) records the phase reasoning. **[§2](#2-locked-decisions), [§3](#3-constraints) and [§8](#8-out-of-scope) are untouched, no `P-` decision was added or amended, and no [PC-01](#pc-01--scryfall-query-craft), [PC-02](#pc-02--bundled-mcp-server) or [PC-03](#pc-03--mcpb-bundle-for-the-chat-tab) criterion changed status.** Phase 1 is unmoved and [Slice 12](./slices/TrackC-Slice12.md) is still the open gate. | The component was requested with its own analysis, and two things that analysis did not contain are the reason this row exists. **An identifier would not have unblocked it.** Exchanging an id for an image URL is a call to a card endpoint — the 2/second lane — issued by a daemon sitting outside the server's two rate-limit lanes, which is two independently throttled clients in one application against a section stating that each local copy must be well-behaved on its own ([`docs/MCP-PRD.md` §3.4](./MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance)). An **image URI** is served from a `*.scryfall.io` file origin, rated unlimited there, so it removes the conflict instead of managing it — which changes what [PQ-10](#pq-10--does-cap-01-gain-an-image-uri-and-what-does-that-cost) has to ask for. And **[`docs/MCP-PRD.md` §3.3](./MCP-PRD.md#33-legal-and-terms-of-service)'s image-handling rules govern this component directly** and were not cited: no cropping away artist or copyright, no distortion or filtering, and `art_crop` only where both stay identifiable. Deciding on the unmodified full card face satisfies them almost for free, since the image already carries both in its own border — and it is what removes the character-cell terminal front-end, which is filtering, loses the artist line, and was the sole reason this component would have needed a prerequisite beyond Node on `PATH`. **The standing [§6](#6-roadmap) note that the first hook component owns the exec-form and Windows-shell problem is discharged**, and deliberately discharged into [§4.1](#41-harness-features-relied-on) rather than into a block that may sit `proposed` for a while: exec form is selected by the presence of `args`, `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` **do** substitute inside a hook's `args` (which is what makes [P-06](#p-06--cached-data-lives-in-the-plugin-data-directory) reachable from a hook at all, and was recorded nowhere before today), and the daemon must be spawned with `process.execPath` rather than the string `"node"`. Two Scryfall field-level facts are marked **[inferred]** rather than verified — `purchase_uris`' key set, and whether `image_uris` sits on `card_faces` — because `scryfall.com` returned **HTTP 403** to an honestly identified fetcher and [`docs/MCP-PRD.md` §3.7](./MCP-PRD.md#37-undocumented-and-bot-protected-third-party-apis) makes a block an answer. They belong to the [CAP-01](./MCP-PRD.md#cap-01--card-search) session regardless. |
| 2026-08-11 | **[PQ-10](#pq-10--does-cap-01-gain-an-image-uri-and-what-does-that-cost) closed, and [PC-04](#pc-04--card-viewer) promoted `proposed` → `specified` the same day it was appended.** The prerequisite was answered upstream as [`docs/MCP-PRD.md` OQ-13](./MCP-PRD.md#oq-13--should-a-card-search-result-carry-image-uris-and-at-what-cost): [CAP-01](./MCP-PRD.md#cap-01--card-search) gains `images: "none" \| "normal"` defaulting to `"none"`, returning an **array** of Scryfall `normal` URIs one per face, as an acceptance criterion 15. Edits here: [PQ-10](#pq-10--does-cap-01-gain-an-image-uri-and-what-does-that-cost) gains a dated answer, [PC-04](#pc-04--card-viewer)'s `Status` line and a **Behavior** addendum record the promotion, its `Open questions` line strikes [PQ-10](#pq-10--does-cap-01-gain-an-image-uri-and-what-does-that-cost), [§6](#6-roadmap) gains an addendum, and the document-status block gains a dated component count. **One question opened — [PQ-13](#pq-13--what-sets-images-normal-when-the-viewer-is-enabled).** **[§2](#2-locked-decisions), [§3](#3-constraints) and [§8](#8-out-of-scope) are untouched, no `P-` decision was added or amended, and no [PC-01](#pc-01--scryfall-query-craft), [PC-02](#pc-02--bundled-mcp-server), [PC-03](#pc-03--mcpb-bundle-for-the-chat-tab) or [PC-04](#pc-04--card-viewer) acceptance criterion changed status.** Phase 1 is unmoved; [Slice 12](./slices/TrackC-Slice12.md) is still the open gate and nothing was built. | [§6](#6-roadmap) had already named the promotion condition — "[PQ-10](#pq-10--does-cap-01-gain-an-image-uri-and-what-does-that-cost) has to be answered in [`docs/MCP-PRD.md`](./MCP-PRD.md) before this component can move to `specified`" — so this row applies a condition the document set for itself rather than making a fresh judgment. **The two facts this question refused to lose both survived it**, which is the return on having written them down: a bare card `id` was measured at **+8.5%** against the image array's **+21.6%** and rejected anyway, on [`docs/MCP-PRD.md` §3.4](./MCP-PRD.md#34-rate-limits-are-hard-constraints-not-guidance) grounds rather than byte grounds, because exchanging an id for a URL is a 2/second-lane call from a daemon outside the server's lanes; and the cost was real enough that the field is off by default. The two `[inferred]` facts are now **verified** — the 403 was on `scryfall.com`'s documentation pages and the API itself answered normally, which is a distinction the earlier row could not draw. [PQ-13](#pq-13--what-sets-images-normal-when-the-viewer-is-enabled) exists because a default of `"none"` and a `PostToolUse` hook do not compose: the hook observes a call it did not make and cannot add a parameter to a request already sent, so **the viewer as specified would display nothing on an ordinary search**. That is a known cost of the opt-in rather than a defect discovered late — it was weighed against an always-on field costing every user +21.6% forever — but it was not settled in the same breath, and an unsettled mechanism recorded as a parenthetical inside a component block is how this project's other invisible failures started. It blocks building, not specifying, which is why the status still moves. |
| 2026-08-25 | **[PC-03](#pc-03--mcpb-bundle-for-the-chat-tab) gains a dated amendment and three criteria (12–14): the release path is automated and its trigger moves from a `v*` tag to merge-on-`main` ([Slice 18](./slices/TrackC-Slice18.md), executing [P-08](#p-08--version-scheme)).** [`release.yml`](../.github/workflows/release.yml) is rewritten to one merge-triggered job; the tag trigger is removed so `claude plugin tag` and the job cannot both cut the same `v*`. [`scripts/bump-version.mjs`](../scripts/bump-version.mjs) computes the version from the conventional-commit range (last `v*` tag → `HEAD`) and writes it into [`plugin.json`](../.claude-plugin/plugin.json), which becomes version-bearing for the first time — one authored number reaching the plugin, the tag and the bundle. [`mcpb/manifest.json`](../mcpb/manifest.json)'s `tools` list was corrected to declare both registered tools and [`tests/manifest.test.ts`](../tests/manifest.test.ts) makes that drift fail `npm test`, along with `APP_VERSION` ≠ `package.json`. **Status is build-and-rehearse: the script, the manifest fix, the tests and the workflow are built and verified locally (13/13 live acceptance, 237/237 tests, both bump refusals demonstrated); the three-merge live sequence publishing `v0.2.0` → *(no release)* → `v0.3.0` and the three `/plugin update` tests are the author's and are pending.** [§2](#2-locked-decisions), [§3](#3-constraints) and [§4](#4-harness-and-delivery) are untouched, no `P-` decision was added or amended, [P-08](#p-08--version-scheme)'s text is unchanged (this executes it), and [PQ-06](#pq-06--what-keeps-the-committed-dist-honest) moves in **neither** half — its user-facing half is sharpened, not closed. Evidence: [`docs/slices/TrackC-Slice18-results.md`](./slices/TrackC-Slice18-results.md). | Track C [Slice 18](./slices/TrackC-Slice18.md) ([`docs/DEV-ROADMAP.md`](./DEV-ROADMAP.md)). The version and the release trigger were one problem, not two: a merge-triggered release needs a number that moves, and the only honest source is the one [P-08](#p-08--version-scheme) already reserves — [`plugin.json`](../.claude-plugin/plugin.json)'s `version` — computed rather than typed, which dissolves [PQ-09](#pq-09--how-does-the-mcpb-manifest-version-relate-to-p-08)'s fourth-copy objection instead of arguing past it. Recorded as a component amendment rather than a new decision because setting `version` **executes** [P-08](#p-08--version-scheme) and does not amend it; the criteria are added now, at build-and-rehearse, and flip to verified as the live sequence runs, so a criterion's status is never claimed ahead of the merge that proves it — the reporting failure [Slice 12](./slices/TrackC-Slice12.md) paid for. |

---

*Manabase is unofficial Fan Content permitted under the Fan Content Policy. Not
approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the
Coast. ©Wizards of the Coast LLC. Card data and prices via [Scryfall](https://scryfall.com).
Combo data via [Commander Spellbook](https://commanderspellbook.com).*
