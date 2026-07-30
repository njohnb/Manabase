# MTG MCP Server — PRD Foundation Session

**Your output is a single file: `docs/MCP-PRD.md`. Do not write implementation code.** Research
first, ask me questions, then write the document. If you find yourself writing a class or a
tool handler, stop.

This session establishes the foundation: context, decisions, constraints, external
dependencies, and the document structure. It specifies exactly one capability, as a worked
example that proves the template. **Eight more are queued** and will be added in later
sessions using a separate prompt — so the document's job is to make that cheap.

**The PRD must be self-sufficient.** I will open new sessions, point Claude Code at
`docs/MCP-PRD.md` alone, and ask it to add a capability or start building a phase. Nothing that
matters can live only in this conversation. Every decision goes in the document *with its
rationale*, so a future session doesn't re-open a settled question because it can't see why
it was settled.

---

## Product context

A Magic: The Gathering MCP server for card research, combo discovery, deck analysis, and
eventually deck editing. Users are me plus roughly 5–20 friends and colleagues — technically
capable, but not infinitely patient with setup.

This is a fresh project. `@src/SpellStack.McpServer/` exists as a reference for conventions
and prior decisions, but nothing gets copied from it and its runtime does not constrain this
one. Skim it and tell me if anything is worth carrying forward; "nothing" is a fine answer.

## Decisions already made

These are settled. Record each in the PRD with its rationale so future sessions inherit the
reasoning rather than re-deriving it. Tell me now if you think any is wrong — but don't
quietly design around one.

**Distribution: a package people install and run locally over stdio.** Not a hosted service.
Keeps me out of the business of holding other people's credentials, and nobody is blocked
when my hosting falls over. Every design decision should weigh install friction heavily.

**Testability constraint: any tool handler must be callable directly as a plain function in
a test — no MCP server started, no transport involved.** If a test needs to spin up a server
to exercise logic, something has leaked upward. This falls out of two habits: no per-user
state in module-level variables, and no reading environment variables from deep in the call
stack — read config once at startup and pass it down. **Do not build an abstraction layer to
achieve this.** The SDK's transport object is already the abstraction; an `ITransport`
interface with one implementation or a transport factory would be over-engineering. The
payoff is that adding Streamable HTTP later is a new entry point, not a rewrite. Skip SSE —
deprecated in the 2025-06-18 spec revision.

**Pricing comes from Scryfall, not a separate provider.** TCGplayer no longer grants new API
access. Scryfall carries `prices[usd]`, `usd_foil`, `usd_etched`, `eur`, and `tix`, synced
every 24 hours using TCGplayer's market price. That's one number per printing — no
per-condition breakdown, no seller listings, no buylist — and that tradeoff is accepted. Do
not propose a paid price provider. Do not scrape TCGplayer.

**Cache split: bulk data for gameplay text, live API for prices.** Scryfall's own docs say
bulk prices are dangerously stale after 24 hours while gameplay data needs only a weekly or
post-set-release refresh.

**Archidekt writes land last.** Not a credential problem — running locally solves that — but
the write API is undocumented, unstable, and the operation is destructive.

## Research to do before writing

Fetch and read live documentation. Don't rely on training-data recall; these change. Record
findings in the PRD's external dependencies section with the date you verified them.

Research **all** of these now, even though only card search is being specified this session.
The queued capabilities touch every one of them, and a complete dependency section is what
makes later capability sessions cheap.

- **Scryfall** — https://scryfall.com/docs/syntax and https://scryfall.com/docs/api. Search
  syntax including regex, rate limits, required headers, bulk data mechanics. Confirm the
  price fields are current and populated, and flag surprises: null prices, digital-only
  printings, whether `usd` can be absent while `usd_foil` isn't. Also read the Tags API docs
  and https://scryfall.com/docs/tagger-tags, and check whether per-card Oracle rulings are
  exposed and how. Note their attribution requirement — I've seen that they ask apps using
  their data to credit them; confirm the current wording and where it has to appear.
- **Commander Spellbook** — https://commanderspellbook.com/syntax-guide/. Is there a
  documented public API, or does this need another approach? Terms of use.
- **Archidekt** — https://www.npmjs.com/package/archidekt. Does an unauthenticated
  `GET /api/decks/[deck_id]/` work on a public deck? What happens on a private one? Rate
  limits? Does the npm package earn its dependency over plain HTTP calls? For writes: does
  bulk import replace or append, does it preserve categories, commander designation,
  companion, and maybeboard, and what's the blast radius on a partial failure?
- **Comprehensive Rules** — https://magic.wizards.com/en/rules. Which format parses cleanest,
  how to resolve the current date-stamped download URL programmatically, and how often it
  updates. Check the terms on redistributing rules text inside a tool given to other people.
- **Terms of service** for each — anything constraining a tool distributed to other people:
  API access, caching or redistributing data, automated writes, attribution.

## The one capability to specify this session

**CAP-01 — Card search.** Search with the full expressiveness of Scryfall syntax, returning
enough detail (oracle text, mana cost, legality, price, printings) to reason about
deckbuilding. I want the syntax surfaced well enough that Claude constructs good queries
without me spelling them out — including regex, and the Tagger operators `otag:`/`function:`
and `art:`/`atag:`, which are ordinary search operators rather than a separate integration.

This is the foundation most queued capabilities build on, so specify it carefully. Use it to
prove the capability template works.

For context when assigning phases, the queued capabilities are: combo discovery, Archidekt
deck reading, Arena-format decklist export, decklist pricing, budget alternatives, Archidekt
deck writing, tag discovery, and Comprehensive Rules lookup. Don't specify them — just leave
room and note in the phase section that they're coming.

## Required PRD structure

Follow this exactly. The structure matters more than the prose — it's what makes the document
extensible across sessions.

```
# MTG MCP Server — PRD

## 1. Overview
Problem, audience, what success looks like. Short.

## 2. Locked decisions
Table: decision | rationale | date. Settled unless I explicitly reopen one.

## 3. Constraints
Distribution, testability, ToS, attribution, anything non-negotiable. Distinct from
decisions: constraints are boundaries, decisions are choices made within them.

## 4. External dependencies
One subsection per source: what it provides, auth, rate limits, ToS notes,
date verified, and risk if it changes or disappears.

## 5. Capabilities
The template below, stated once at the top of the section, then one block per
capability. Only CAP-01 exists after this session.

## 6. Phases
Which capabilities land when, and why. Phase 1 must be the smallest genuinely
useful version. Note that eight capabilities are queued and unassigned.

## 7. Open questions
Numbered, each with what would resolve it. Questions persist here until answered —
they do not get dropped.

## 8. Out of scope
Explicitly rejected, with reasons, so it doesn't resurface. TCGplayer direct API,
hosted deployment, and embeddings/vector search for rules all belong here.

## 9. Revision log
Date, what changed, why.
```

Capability block template — reproduce this verbatim at the top of section 5, so future
sessions have the schema in front of them:

```
### CAP-0N — <short name>
- **Status:** proposed | specified | deferred
- **Phase:** N | unassigned
- **User need:** one or two sentences in my voice, not feature language
- **Behavior:** precise enough to build against
- **Depends on:** data sources and other CAP-IDs
- **Serves via:** proposed tool name(s), no signatures — those come later
- **Acceptance criteria:** checkable statements, not aspirations
- **Open questions:** or "none"
```

IDs are stable and never reused. Adding a capability later means appending a CAP block,
updating sections 6, 7, and 9, and nothing else. Design the document so that's true.

## Scope boundary for the PRD itself

Product-level, not design-level. What and why, not how. Module layout, schemas, and
error-handling strategy are for a later design doc — **except** where something is genuinely
a product constraint, like the testability rule or local distribution, which belong in
section 3.

One exception: recommend a runtime and record it as a locked decision, with reasoning and the
runner-up you rejected. Install friction is the main adoption risk and runtime largely
determines it, so it's a product concern even though it looks technical.

## How to work

1. Skim the reference project and do the research above.
2. Come back with findings and batched questions **before** writing anything. Flag anything
   that contradicts my assumptions.
3. Write `docs/MCP-PRD.md` after we've talked.

Where you disagree with something above, say so directly. Distinguish clearly between what
you verified in live docs and what you're inferring. No code.
