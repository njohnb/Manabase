# MTG Claude Plugin — PRD Foundation Session

**Your output is a single file: `docs/PLUGIN-PRD.md`. Do not write implementation code.**
Research first, ask me questions, then write the document. If you find yourself writing a
`plugin.json`, a `SKILL.md`, or a hook script, stop.

This session establishes the foundation for the *plugin* — the thing people actually install.
It specifies exactly two components, as worked examples that prove the template. More are
queued and will be added in later sessions using a separate prompt, so the document's job is
to make that cheap.

**The PRD must be self-sufficient.** I will open new sessions, point Claude Code at
`docs/PLUGIN-PRD.md` alone, and ask it to add a component or start building a phase. Nothing
that matters can live only in this conversation. Every decision goes in the document *with
its rationale*, so a future session doesn't re-open a settled question because it can't see
why it was settled.

---

## Product context

A Claude Code plugin that packages the MTG MCP server together with the skills, agents, and
hooks that make it usable without me explaining how to drive it. Users are me plus roughly
5–20 friends and colleagues — technically capable, but not infinitely patient with setup.

The MCP server alone is a set of tools. The plugin is the product: it installs the server,
prompts for the credentials it needs, puts the cache somewhere that survives updates, and
ships the instructions that let Claude use the tools well on the first try.

## Relationship to `docs/MCP-PRD.md` — read this before anything else

**Read `docs/MCP-PRD.md` in full first.** It is the PRD for the MCP server and it is already
written. This document is its parent, not its replacement.

The boundary, which goes in §1 of the new document verbatim:

> `docs/MCP-PRD.md` owns what the server can do — tools, data sources, capability behavior,
> acceptance criteria for tool output. `docs/PLUGIN-PRD.md` owns what the user installs and
> experiences — packaging, install, configuration, the skills and agents that shape how
> Claude uses the tools, and the harness features both rely on. A tool spec never appears in
> the plugin PRD. An install step never appears in the MCP PRD.

Consequences you must honor:

- **Never duplicate a decision from `docs/MCP-PRD.md`.** Reference it by section. Duplicated
  decisions drift, and a future session can't tell which copy is current.
- **Locked decisions and constraints in `docs/MCP-PRD.md` are inherited, not re-litigated.**
  Local install over stdio, Scryfall as sole price source, bulk data for gameplay text and
  live API for prices, Archidekt writes last, skip SSE, tool handlers directly callable in
  tests with no abstraction layer built to achieve it.
- **The runtime is already chosen** in `docs/MCP-PRD.md` §2. Read it, record that the plugin
  inherits it, and do not re-open it.
- **If a component you want would require the server to do something it doesn't do yet**,
  that is a CAP in `docs/MCP-PRD.md`, not a PC here. Say so and stop; don't spec around it.

## Decisions already made

These are settled. Record each in §2 with its rationale so future sessions inherit the
reasoning rather than re-deriving it. Tell me now if you think any is wrong — but don't
quietly design around one.

**The plugin is the distribution unit; the MCP server ships inside it.** Not a separate
`npx` incantation people paste into their MCP config. Plugin-bundled MCP servers start
automatically when the plugin is enabled, which turns setup into two commands. Install
friction is the primary adoption risk named in `docs/MCP-PRD.md`, and this is the single largest
lever on it.

**One repo. Plugin manifest and component directories at the repo root, server source under
`src/`.** One clone, one version number, one tag. A split repo means two things to keep in
sync for no benefit at this scale.

**`docs/PLUGIN-PRD.md` is the parent document; `docs/MCP-PRD.md` is the deep spec for server
behavior.** Stated above. Without an explicit boundary the plugin PRD slowly absorbs tool
specs and the two documents start disagreeing.

**Component IDs are `PC-0N`, flat, with type as a field rather than a prefix.** Not `SKL-`
/ `AGT-` / `HOOK-`. A component that changes type — a skill that becomes an agent — should
not change identity, and phase tables read better against one sequence. IDs are stable and
never reused.

**Credentials are collected through `userConfig` with `sensitive: true`, never by asking
anyone to hand-edit a settings file.** Claude Code prompts at enable time and stores the
value in the OS keychain, then substitutes it into the MCP server config. "Solving install
friction by moving work to the user" is the failure mode this project exists to avoid. This
is how the Archidekt session cookie and `X-CSRFToken` reach the server.

**Cached data lives in `${CLAUDE_PLUGIN_DATA}`, never `${CLAUDE_PLUGIN_ROOT}`.**
`CLAUDE_PLUGIN_ROOT` changes on every plugin update and the previous directory is garbage
collected roughly two weeks later. `CLAUDE_PLUGIN_DATA` persists across updates. The bulk
Scryfall data and the rules index are exactly the kind of thing that must not be re-downloaded
on every version bump.

**New instruction-bearing components are skills, not commands.** The docs now direct new
plugins to `skills/` and treat flat `commands/` markdown as the older form. Pick one so the
repo doesn't end up with both.

**Version is left unset in `plugin.json` during development and set to explicit semver at
first public release.** With `version` unset, Claude Code falls back to the git commit SHA
and every commit is an update — right for the phase where I'm iterating. With it set, users
only get changes when I bump it, and forgetting to bump silently ships nothing — wrong for
now, right once other people depend on it. Record both halves; the switchover is a phase
boundary.

## Research to do before writing

Fetch and read live documentation. Don't rely on training-data recall; this surface moves
fast. Record findings in §4 with the date you verified them and the risk if the feature
changes.

- **Plugins reference** — https://code.claude.com/docs/en/plugins-reference. Component types,
  manifest schema, path behavior rules, `userConfig`, environment variables, persistent data
  directory, caching, path traversal limits, CLI commands, `plugin details` token accounting.
- **Plugin marketplaces** — the `marketplace.json` schema, source types, commit pinning with
  `sha`, and precedence between marketplace entry and `plugin.json`. This is the install path
  people will actually type; get it exactly right.
- **Skills** — `SKILL.md` frontmatter, how descriptions drive automatic invocation, supporting
  files, live change detection, and what a skill costs in context when it never fires.
- **Subagents** — agent frontmatter fields available to plugin-shipped agents, and what is
  *not* available to them for security reasons. Note the restrictions even though no agent is
  being specified this session; the queued components include work an agent may be the right
  shape for.
- **Hooks** — the lifecycle event list, hook types, exec form versus shell form, and how a
  hook targets the plugin's own bundled MCP server (the scoped-name rule; a matcher written
  against the bare server key never fires).
- **MCP** — plugin-provided servers specifically: startup, scoped tool naming, and what
  `/reload-plugins` does and doesn't reconnect.
- **Settings** — `pluginConfigs`, `enabledPlugins`, and configuration scopes, including which
  settings sources are read for plugin config and which are deliberately ignored.

### Findings already verified on 2026-07-29 — confirm each is still true, record your own date

Recorded here so you don't miss them, not so you can skip checking them.

- Plugin components: skills, commands, agents, hooks, MCP servers, LSP servers, workflows,
  output-styles, `bin/` executables, plus experimental monitors and themes.
- `userConfig` prompts at enable time; `sensitive: true` routes to the OS keychain, which is
  shared with OAuth tokens and has roughly a 2 KB total budget. Values substitute as
  `${user_config.KEY}` into MCP and LSP configs and hook commands, and export to hook
  processes as `CLAUDE_PLUGIN_OPTION_<KEY>`.
- Shell-form hook commands and monitor commands **reject** `${user_config.*}` rather than
  substituting it. There are documented alternatives per field. This changed in v2.1.207.
- `${CLAUDE_PLUGIN_DATA}` resolves to `~/.claude/plugins/data/{id}/` and survives updates.
  Deleted when the plugin is uninstalled from its last scope unless `--keep-data` is passed.
- Installed plugins cannot reference files outside their own directory; `../` paths break
  after install because those files are never copied into the cache.
- `claude plugin details <name>` reports an always-on token cost paid by every session plus
  per-component on-invoke cost.
- Several fields have version floors — `displayName` v2.1.143, `defaultEnabled` v2.1.154, the
  `userConfig` shell-rejection behavior v2.1.207. **Establish a minimum supported Claude Code
  version and record it**, since with 5–20 installers this becomes a support question.

If you have plugins installed locally, running `claude plugin details` on one is a cheap way
to ground the context-cost numbers in §3 rather than guessing them.

## The two components to specify this session

**PC-01 — Scryfall query craft (type: skill).** The instructions that let Claude construct
good Scryfall queries without me spelling out syntax — regex, the Tagger operators
`otag:`/`function:` and `art:`/`atag:`, and the operator vocabulary generally. This is the
plugin-side complement to CAP-01 in `docs/MCP-PRD.md`; CAP-01 makes the search possible, this
makes it good. Specify it carefully — it's the hardest of the two and it proves the template
for the type that most future components will be.

Two things to get right, because they generalize: a skill is instructions loaded into
context, not code, so **acceptance criteria have to be about what Claude reliably does, not
what a function returns**. And a skill that restates card data is a hallucination source —
it must route to the MCP tools rather than carry facts.

**PC-02 — Bundled MCP server (type: mcp-server).** The server itself as a plugin component.
This block is mostly a pointer: behavior lives in `docs/MCP-PRD.md`, and what belongs here is the
install and configuration surface — how it starts, what `userConfig` it declares, where its
data goes, what the user sees when a credential is missing or expired. It exists this session
to prove the template holds for a non-skill type, which a skill-only example wouldn't
demonstrate.

For context when assigning phases, two components are queued and unspecified: a deck-analysis
skill and a deck-optimize skill that builds on it. The rest of the roadmap is deliberately
undecided. Leave room and say so in §6.

## Required PRD structure

Follow this exactly. Numbering deliberately parallels `docs/MCP-PRD.md` so both documents read the
same way. The structure matters more than the prose — it's what makes the document extensible
across sessions.

```
# MTG Claude Plugin — PRD

## 1. Overview
Problem, audience, what success looks like, and the boundary rule against
docs/MCP-PRD.md reproduced verbatim. Short.

## 2. Locked decisions
Table: decision | rationale | date. Settled unless I explicitly reopen one.
Note which are inherited from docs/MCP-PRD.md §2 rather than restating them.

## 3. Constraints
Context budget, trust and sandboxing, cross-platform reach, minimum harness
version, anything non-negotiable. Distinct from decisions: constraints are
boundaries, decisions are choices made within them.

## 4. Harness and delivery
One subsection per thing the plugin depends on or exposes: harness features
relied on, marketplace and install path, versioning and updates, user
configuration, persistent data. Each with date verified and risk if it changes.

## 5. Components
The template below, stated once at the top of the section, then one block per
component. Only PC-01 and PC-02 exist after this session.

## 6. Roadmap
Which components land when, and why. Phase 1 must be the smallest genuinely
useful install — not the smallest shippable one. Note that deck-analysis and
deck-optimize are queued and that the rest of the roadmap is open.

## 7. Open questions
Numbered, each with what would resolve it. Questions persist here until
answered — they do not get dropped.

## 8. Out of scope
Explicitly rejected, with reasons, so it doesn't resurface.

## 9. Revision log
Date, what changed, why.
```

Component block template — reproduce this verbatim at the top of section 5, so future sessions
have the schema in front of them:

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

IDs are stable and never reused. Adding a component later means appending a PC block,
updating sections 6, 7, and 9, and nothing else. Design the document so that's true.

`Context cost` is not decoration. Every skill and agent description is paid in every session
whether or not it fires, and this plugin is going to want a lot of them. A component that
can't justify its always-on cost is a component that should be merged into another one.

## Things to put in §8, out of scope

Each with a reason, so it doesn't resurface:

- **LSP servers.** Nothing here is a language.
- **Themes.** Experimental schema, zero product value.
- **Monitors** for set-release watching. Tempting and wrong for now: experimental schema,
  unavailable on some hosts, runs unsandboxed, and a refresh-on-session-start hook covers the
  actual need.
- **A hosted marketplace or web installer.** Same reasoning as the hosted-service rejection
  in `docs/MCP-PRD.md` §8.
- Anything already rejected in `docs/MCP-PRD.md` §8 — reference it, don't restate it.

## Scope boundary for the PRD itself

Product-level, not design-level. What and why, not how. Directory layout, `SKILL.md` prose,
hook scripts, and manifest JSON are for implementation — **except** where something is
genuinely a product constraint, like the context budget or the credential-collection
mechanism, which belong in §3 and §4.

## How to work

1. Read `docs/MCP-PRD.md` in full, then do the research above.
2. Come back with findings and batched questions **before** writing anything. Flag anything
   that contradicts my assumptions or that `docs/MCP-PRD.md` already settles differently.
3. Write `docs/PLUGIN-PRD.md` after we've talked.

Where you disagree with something above, say so directly. Distinguish clearly between what
you verified in live docs and what you're inferring. No code.
