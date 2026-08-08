# MTG MCP Server — PRD

> **Reading this cold?** Sections 2 and 3 are binding. Section 4 is the research record —
> every claim there is dated and marked verified or inferred. Section 5 opens with the
> capability template; adding a capability means appending a CAP block and updating
> sections 6, 7, and 9. Nothing else.

**Document status:** foundation established 2026-07-29. One capability specified
([CAP-01](#cap-01--card-search)) and **delivered 2026-08-03** — all twelve acceptance criteria
verified ([§9](#9-revision-log)). Ten capabilities queued and unassigned — two of them added
2026-08-07 when Moxfield joined Archidekt as a deck platform ([D-13](#d-13--deck-platform-order-archidekt-first-moxfield-second), [§4.8](#48-moxfield)).

---

## 1. Overview

**Problem.** Magic: The Gathering deckbuilding research is spread across tools that don't talk
to each other. Card search lives on Scryfall, combos on Commander Spellbook, decklists on
Archidekt or Moxfield, rules in a 975 KB text file. Answering an ordinary question — "what one-mana
green creatures ramp, are legal in my Commander deck, and cost under a dollar" — means three
tabs and manual cross-referencing. An LLM with direct access to these sources can answer it
in one step, but only if the tools expose enough expressiveness to be worth calling.

**Audience.** The author plus roughly 5–20 friends and colleagues. Technically capable —
they can edit a JSON config file — but not infinitely patient with setup. Nobody will debug a
build failure to try this.

**What success looks like.**
- A new user goes from "I want this" to a working tool in one config-file paste and one
  restart, with no build step and no credentials.
- Claude constructs good Scryfall queries without the user knowing Scryfall syntax. The user
  asks in English; the tool surface is expressive enough that the model does the translation.
- Adding the next capability is an afternoon, because this document already settled the
  runtime, the data sources, and the testing shape.

**What this is not.** Not a deck-building autopilot, not a price tracker, not a rules
oracle that replaces a judge.

---

## 2. Locked decisions

Settled unless explicitly reopened. Each decision carries its rationale so later sessions inherit
the reasoning instead of re-deriving it.

| # | Decision | Date |
|---|---|---|
| [D-01](#d-01--distribution-local-package-over-stdio) | Distribution: a package people install and run locally over stdio | 2026-07-29 |
| [D-02](#d-02--runtime-nodejs--typescript) | Runtime: Node.js + TypeScript, published to npm, run via `npx -y` | 2026-07-29 |
| [D-03](#d-03--testability-handlers-callable-as-plain-functions) | Testability: any tool handler must be callable directly as a plain function in a test | 2026-07-29 |
| [D-04](#d-04--no-transport-abstraction-layer) | Do not build an abstraction layer to achieve [D-03](#d-03--testability-handlers-callable-as-plain-functions) | 2026-07-29 |
| [D-05](#d-05--transport-stdio-now-streamable-http-later-no-sse) | Transport: stdio now. Streamable HTTP later if needed. Skip SSE entirely | 2026-07-29 |
| [D-06](#d-06--pricing-from-scryfall) | Pricing comes from Scryfall, not a separate provider | 2026-07-29 |
| [D-07](#d-07--three-way-cache-split) | Cache split is three-way, not two-way | 2026-07-29 |
| [D-08](#d-08--comprehensive-rules-fetched-at-runtime-never-bundled) | Comprehensive Rules text is fetched at runtime from WotC and cached locally. It is never bundled in the package | 2026-07-29 |
| [D-09](#d-09--archidekt-writes-land-last) | Archidekt writes land last | 2026-07-29 |
| [D-10](#d-10--tool-handlers-never-throw) | Tool handlers never throw. They return structured results carrying success or failure | 2026-07-29 |
| [D-11](#d-11--tool-naming-convention) | Tool naming: `domain_verb_noun` in snake_case | 2026-07-29 |
| [D-12](#d-12--no-npm-archidekt-dependency) | No dependency on the npm `archidekt` package | 2026-07-29 |
| [D-13](#d-13--deck-platform-order-archidekt-first-moxfield-second) | Deck platform order: Archidekt first, Moxfield second. Both are in scope; neither blocks the other's spec | 2026-08-07 |
| [D-14](#d-14--no-npm-moxfield-api-dependency) | No dependency on the npm `moxfield-api` package. Use plain HTTP | 2026-08-07 |
| [D-15](#d-15--moxfield-writes-are-blocked-upstream-not-merely-last) | Moxfield writes are blocked upstream, not merely last. They stay queued and unspecified until Moxfield has a working third-party authentication path | 2026-08-07 |

### D-01 — Distribution: local package over stdio

**Decided 2026-07-29.**

**Distribution: a package people install and run locally over stdio.** Not a hosted service.

Keeps the author out of the business of holding other people's credentials, and nobody is
blocked when hosting falls over. Install friction is the primary adoption risk, so every design
decision weighs it heavily.

### D-02 — Runtime: Node.js + TypeScript

**Decided 2026-07-29.**

**Runtime: Node.js + TypeScript, published to npm, run via `npx -y`.** Runner-up rejected:
.NET 10 + `dnx`.

`npx` is the pattern every MCP client's documentation uses, so the config line is one users can
paste without thinking, and Node ≥18 is already present on most technical machines. The
TypeScript SDK is the MCP reference implementation and tracks spec revisions first.

.NET 10 + `dnx` was genuinely competitive — it matches the author's existing toolchain,
standards, and review tooling — but loses on the axis that matters most here: it needs a ~70 MB
runtime acquisition for friends who don't have .NET, and `dnx` is new enough that its failure
modes are unfamiliar to the people who'd hit them. Accepted cost: the author's .NET review
agents and coding-standards skills do not apply to this project.

### D-03 — Testability: handlers callable as plain functions

**Decided 2026-07-29.**

**Testability: any tool handler must be callable directly as a plain function in a test** — no
MCP server started, no transport involved.

If a test needs a running server to exercise logic, something has leaked upward. Falls out of
two habits: no per-user state in module-level variables, and no reading environment variables
from deep in the call stack — read config once at startup and pass it down.

### D-04 — No transport abstraction layer

**Decided 2026-07-29.**

**Do not build an abstraction layer to achieve [D-03](#d-03--testability-handlers-callable-as-plain-functions).** No `ITransport` interface, no transport
factory.

The SDK's transport object is already the abstraction. An interface with one implementation is
over-engineering. The payoff of [D-03](#d-03--testability-handlers-callable-as-plain-functions) is that adding Streamable HTTP later is a *new entry
point*, not a rewrite — that payoff does not require an indirection layer.

### D-05 — Transport: stdio now, Streamable HTTP later, no SSE

**Decided 2026-07-29.**

**Transport: stdio now. Streamable HTTP later if needed. Skip SSE entirely.**

SSE was deprecated in the 2025-06-18 spec revision. Building it would be work toward a dead
end.

### D-06 — Pricing from Scryfall

**Decided 2026-07-29.**

**Pricing comes from Scryfall, not a separate provider.**

TCGplayer no longer grants new API access. Scryfall carries `usd`, `usd_foil`, `usd_etched`,
`eur`, `eur_foil`, `tix`, synced every 24 hours from TCGplayer's market price. That is one
number per printing — no per-condition breakdown, no seller listings, no buylist. **That
tradeoff is accepted.** Do not propose a paid price provider. Do not scrape TCGplayer.

### D-07 — Three-way cache split

**Decided 2026-07-29.**

**Cache split is three-way, not two-way** (revised from "bulk for gameplay text, live API for
prices" — see note below). **Live `/cards/search`** for anything requiring query evaluation.
**Live `/cards/collection`** for resolving known card names in batches of 75. **Bulk files**
for corpora that would otherwise cost thousands of requests: `oracle_tags`, `art_tags`,
`rulings`.

The original two-way split was right about *why* — Scryfall's own docs say bulk prices are
dangerously stale after 24 hours while gameplay data needs only weekly or post-set-release
refresh. It was wrong about *what is possible*: regex, `otag:`, `function:`, `art:`/`atag:`,
and legality/price filters are **server-side query-engine features, not properties of card
objects** (verified 2026-07-29, [§4.1](#41-scryfall-rest-api)).

Full Scryfall syntax cannot be served from a local bulk file without reimplementing Scryfall's
search engine — a multi-month project that would stay permanently behind theirs. Prices
therefore arrive on whichever live response was already being fetched, which is simpler than a
separate price path.

### D-08 — Comprehensive Rules fetched at runtime, never bundled

**Decided 2026-07-29.**

**Comprehensive Rules text is fetched at runtime from WotC and cached locally. It is never
bundled in the package.**

The WotC Fan Content Policy prohibits "verbatim copying and reposting of Wizards' IP." Shipping
a 975 KB verbatim copy of WotC's document to other people is the shape of thing that clause
describes. Fetching on the user's own machine from WotC's own URL sidesteps it, and has the
bonus of never going stale across quarterly CR updates. [D-01](#d-01--distribution-local-package-over-stdio) (local distribution) is what makes
this cheap — a hosted service could not push the fetch to the user.

### D-09 — Archidekt writes land last

**Decided 2026-07-29.**

**Archidekt writes land last.**

Not a credential problem — [D-01](#d-01--distribution-local-package-over-stdio) solves that. The write API is undocumented, unstable, and the
operation is destructive. Every read-only capability should be delivered and stable before
anything can damage a user's deck.

**Scoped 2026-08-07 by [D-13](#d-13--deck-platform-order-archidekt-first-moxfield-second) and [D-15](#d-15--moxfield-writes-are-blocked-upstream-not-merely-last).** This decision is unchanged and still
governs Archidekt. What it did not anticipate is a second deck platform, so read it as naming
Archidekt specifically rather than as a general rule about deck writes. Moxfield writes are
blocked by something this decision has no view on — the absence of a working third-party
authentication path ([§4.8](#48-moxfield)) — and [D-15](#d-15--moxfield-writes-are-blocked-upstream-not-merely-last) records that separately. The distinction
matters: "last" is a scheduling choice this project makes, and "blocked" is a fact about
someone else's API that no amount of sequencing resolves.

### D-10 — Tool handlers never throw

**Decided 2026-07-29.**

**Tool handlers never throw. They return structured results carrying success or failure.**

A thrown exception becomes an opaque MCP protocol error. A structured failure that includes
Scryfall's own `details` message lets Claude correct a malformed query and retry — which is the
common case for a syntax as large as Scryfall's. Carried forward from the SpellStack reference
project.

### D-11 — Tool naming convention

**Decided 2026-07-29.**

**Tool naming: `domain_verb_noun` in snake_case** (e.g. `card_search`, `deck_read_archidekt`).

Carried forward from the SpellStack reference project. Tool names are shown to the model; this
reads well and groups related tools without a namespace mechanism.

### D-12 — No npm `archidekt` dependency

**Decided 2026-07-29.**

**No dependency on the npm `archidekt` package.** Use plain HTTP.

Version 0.0.14, last published seven years ago, zero dependents, and its own README states
Archidekt's API is undocumented and in open beta. It earns nothing over `fetch`. Its value is
as *documentation* of URL shapes, which [§4.5](#45-archidekt) now records directly.

### D-13 — Deck platform order: Archidekt first, Moxfield second

**Decided 2026-08-07.**

**Both Archidekt and Moxfield are in scope as deck sources. Archidekt is specified and built
first; Moxfield follows. Neither blocks the other's spec, and neither is a prerequisite for the
other's capability.**

Two reasons, one of them not technical. The author uses Archidekt and knows its payload shape,
its category convention, and its failure modes first-hand — [§4.5](#45-archidekt) is the
longest-standing research record in this document and [OQ-07](#oq-07--how-is-intentionallyskippedcarddata-populated-in-archidekt-deck-payloads-and-what-does-its-presence-mean-for-a-deck-read) is the only question left
standing between it and a spec. Moxfield's record starts today. Building the platform the author
can validate by eye is how a deck-read capability gets its shape right before a second platform
has to fit that shape.

The second reason is that **deck reading is one capability with two backends, not two unrelated
capabilities.** Both return the same thing to the model — a decklist with quantities, board
assignment, and commander designation. Archidekt first means the normalized shape is designed
against a real payload rather than in the abstract, and Moxfield second means it gets tested
against a payload the design did not come from. Specifying them simultaneously would produce
either one shape bent around two APIs or two tools that return different things for the same
question.

**What this does not decide.** It does not assign phases — [§6](#6-phases) still does that in the sessions
that specify each one — and it does not make Moxfield conditional on Archidekt shipping. If
Archidekt's research stalls on [OQ-07](#oq-07--how-is-intentionallyskippedcarddata-populated-in-archidekt-deck-payloads-and-what-does-its-presence-mean-for-a-deck-read), Moxfield reading is not held hostage to it.

### D-14 — No npm `moxfield-api` dependency

**Decided 2026-08-07.**

**No dependency on the npm `moxfield-api` package.** Use plain HTTP, the same as [D-12](#d-12--no-npm-archidekt-dependency) decided
for Archidekt.

This one was researched on its merits rather than assumed, because unlike the `archidekt`
package it is **not abandoned**: `moxfield-api` v2.1.0 is MIT-licensed, written in TypeScript,
and was last pushed 2026-08-03 — four days before this decision. **[verified 2026-08-07]** It
still does not earn the dependency, for reasons that have nothing to do with staleness:

- **Its entire API surface is one endpoint.** `src/api/` contains exactly one module,
  `deck-list`, exposing `decklist.findById()` over `GET /v3/decks/all/{id}`. **[verified]**
  There is no search, no user lookup, no authentication, and no write path — so it covers the
  one call this project would find easiest to write itself, and none of the parts that are
  actually hard.
- **It sets no `User-Agent`.** Its fetcher is a thin wrapper around global `fetch` that parses
  JSON, maps 404 to a typed error, and rethrows everything else. **[verified]** Identifying the
  application is a requirement here ([§3.7](#37-undocumented-and-bot-protected-third-party-apis)), so the one piece of HTTP behavior this
  project cannot compromise on is the piece the library omits.
- **It brings runtime dependencies for validation this project does differently.** `zod` and
  `zod-fetch`. **[verified]** [§4.1](#41-scryfall-rest-api)'s wire types are hand-written minimal
  shapes covering only the fields actually read; adopting a schema library for one endpoint would
  add a validation idiom used nowhere else in the codebase.
- **Its error model is the opposite of [D-10](#d-10--tool-handlers-never-throw)'s.** It throws
  `MoxfieldError` / `NotFoundMoxfieldError`. Every use would be wrapped in a try/catch that
  converts back to a `Result`, which is more code than the `fetch` call it replaces.

Its genuine value, exactly as with the `archidekt` package, is as **documentation of URL
shapes** — and that is transcribed into [§4.8](#48-moxfield) so the package can be ignored
entirely. Recorded as a decision rather than left implicit because the package is healthy enough
that a future session would reasonably reach for it.

### D-15 — Moxfield writes are blocked upstream, not merely last

**Decided 2026-08-07.**

**Moxfield writes stay queued and unspecified until Moxfield has a working third-party
authentication path. This is not a sequencing preference and it is not this project's to
schedule.**

[D-09](#d-09--archidekt-writes-land-last) puts Archidekt writes last, which is a choice — the write API exists, is reachable, and is
deferred because it is destructive. Moxfield is a different situation and must not be recorded
as the same one. Writing to Moxfield requires a token from `POST /v1/account/token` or
`POST /v2/account/token`, and those endpoints are reported to sit behind Cloudflare or reCAPTCHA
validation **even for callers whose `User-Agent` Moxfield support confirmed as whitelisted** —
filed on Moxfield's own issue tracker 2025-11-23, still open with zero maintainer comments as of
today. **[verified 2026-08-07, §4.8]** There is no documented alternative flow.

**The consequence that binds.** The only ways past a challenge of that kind are to solve it
programmatically or to drive a real browser session, and [§3.7](#37-undocumented-and-bot-protected-third-party-apis) forbids both outright. So the
honest position is that this capability is not currently buildable by any means this project
will use, and saying "last" would imply otherwise to a future session reading the queue.

**What unblocks it.** Moxfield publishing a third-party auth path, or resolving that issue, or
granting this application credentials that work. Any of those reopens this decision. Until then
the [§6](#6-phases) queue carries it as blocked with this ID attached, and no plugin-side credential is
declared for it ([`docs/PLUGIN-PRD.md` P-13](./PLUGIN-PRD.md#p-13--no-user-configuration-in-phase-1)).

> **Note on [D-07](#d-07--three-way-cache-split).** This revises the decision as originally stated. The original rationale is
> preserved above and still holds. The change is in scope of what bulk data is used *for*,
> forced by a verified fact about where Scryfall's query engine lives. Recorded here rather
> than left as an open question so that a future session building [CAP-01](#cap-01--card-search) does not architect
> against a local search engine.

---

## 3. Constraints

Boundaries, not choices. Decisions in [§2](#2-locked-decisions) are made *within* these.

### 3.1 Distribution and install friction

- **No build step for the end user.** They paste a config block and restart their client.
- **No credentials for read-only capabilities.** Every source in [§4](#4-external-dependencies) serves reads
  anonymously (verified). Nothing in Phase 1 may require a login, an API key, or a signup.
- **Install friction is a product requirement, not a nice-to-have.** It is the stated
  primary adoption risk. A capability that adds a setup step is more expensive than its
  code suggests.

### 3.2 Testability

- **Every tool handler is callable as a plain function.** No server, no transport, no
  process. ([D-03](#d-03--testability-handlers-callable-as-plain-functions))
- **No per-user state in module-level variables.** This is what makes a handler a function
  rather than a method on a hidden singleton.
- **No environment-variable reads below the entry point.** Config is read once at startup
  and passed down. A handler that reaches for `process.env` cannot be tested without
  arranging global state.
- **No abstraction layer built to satisfy the above.** ([D-04](#d-04--no-transport-abstraction-layer))

### 3.3 Legal and terms of service

**WotC Fan Content Policy** — this project operates under it, as Scryfall and Commander
Spellbook both do. The following disclaimer is required **verbatim** and must appear in the
README and the published package description:

> "[Title of your Fan Content] is unofficial Fan Content permitted under the Fan Content
> Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of
> Wizards of the Coast. ©Wizards of the Coast LLC."

The policy also prohibits verbatim redistribution of Wizards' IP (drives [D-08](#d-08--comprehensive-rules-fetched-at-runtime-never-bundled)), prohibits
selling fan content or licensing it for compensation, and permits donations/sponsorship only
where they don't gate community access.

**Scryfall data use** — there is **no attribution requirement** (verified 2026-07-29, [§4.1](#41-scryfall-rest-api)).
There are prohibitions, and these bind:

- May not use Scryfall's name or logos in a way implying endorsement.
- **May not paywall the data** — no payments, surveys, subscriptions, ratings, chat-server
  joins, or channel follows in exchange for access. If there is ever an account system,
  users must be able to reach card data anonymously or with a free account.
- May not use the data to create new games or imply it comes from another game.
- **May not simply repackage, republish, or proxy Scryfall data — the software must create
  additional value for end users.** A tool that is a thin passthrough of `/cards/search`
  arguably fails this. [CAP-01](#cap-01--card-search)'s value-add is query construction, result shaping for LLM
  reasoning, and the price-correctness handling in [§4.1.3](#413-price-fields--three-verified-traps).

Image handling, if images are ever surfaced: do not crop off the artist name or copyright,
do not distort or filter, do not add watermarks, and when using `art_crop` the artist and
copyright must be identifiable somewhere in the same interface.

### 3.4 Rate limits are hard constraints, not guidance

Scryfall's limits are enforced, and it is explicitly **not acceptable to ignore HTTP 429**.
A 429 locks access for 30 seconds; sustained overage risks a temporary or permanent ban of
the application. Because this ships to 5–20 people running independent local copies, each
copy must be well-behaved on its own — there is no central throttle to fix it later.

- `/cards/search`, `/cards/named`, `/cards/random`, `/cards/collection`: **2/second**
- all other endpoints: 10/second
- `*.scryfall.io` file origins: unlimited
- A `User-Agent` naming this application is **required**. Default HTTP-library agents are
  explicitly disallowed. An `Accept` header is required.

### 3.5 Community-sourced tag data

Scryfall tags come from the community-maintained Tagger project. Scryfall moderates but does
not guarantee the data is free of errors or abuse. Two constraints follow directly from their
docs:

- **Tag slugs are not stable identifiers.** Track tags by their `id` UUID.
- **Downstream applications must be able to temporarily disable display of individual
  tags.** Scryfall strongly recommends this; treat it as a requirement for any capability
  that surfaces tags.

### 3.6 Error surface

Handlers never throw ([D-10](#d-10--tool-handlers-never-throw)). Additionally, some upstream failures are **inherently
ambiguous** and the error text must not claim more than is known — see [§4.5](#45-archidekt), where Archidekt
returns an indistinguishable 404 for private, unlisted, and deleted decks.

**Moxfield returns 404 for an unknown deck ID too** ([§4.8](#48-moxfield)), as an RFC 9110 problem-details body
carrying no reason beyond `"Not Found"`. **[verified 2026-08-07]** Whether it *also* masks
private and unlisted decks behind that same 404 is untested ([OQ-11](#oq-11--does-moxfield-mask-private-and-unlisted-decks-behind-the-same-404-as-an-unknown-id)). Until that is known, error
text for a Moxfield deck read is held to the same standard as Archidekt's for the same
reason — the constraint is that the message must not assert a cause the response does not
establish, and an untested masking behavior is exactly the case where a confident message
would be a guess.

### 3.7 Undocumented and bot-protected third-party APIs

Scryfall publishes its limits, so [§3.4](#34-rate-limits-are-hard-constraints-not-guidance) can state them as numbers. Archidekt ([§4.5](#45-archidekt)) and Moxfield
([§4.8](#48-moxfield)) publish nothing: no documentation, no rate-limit headers, no terms addressing automated
reads. That absence is not permission, and it is the reason this section exists as a constraint
rather than as advice inside each dependency's subsection.

- **Identify honestly on every request.** The same app-naming `User-Agent` and `Accept` headers
  [§3.4](#34-rate-limits-are-hard-constraints-not-guidance) requires for Scryfall apply to every source in [§4](#4-external-dependencies), including these two. This is not
  only politeness: **Moxfield operates a `User-Agent` whitelist granted by support** ([§4.8](#48-moxfield)), so
  an identifiable agent is the prerequisite for ever being allowed to ask.
- **Never defeat bot protection.** No Cloudflare-challenge solver, no `cloudscraper` or
  equivalent, no headless-browser session, no rotating or browser-impersonating `User-Agent`, no
  TLS fingerprint spoofing. This is a hard line and it has no exception for "it was the only way
  that worked." A public third-party wrapper for Moxfield does exactly this ([§4.8](#48-moxfield)); that is a
  reason to cite it as evidence about the API's posture, and not a pattern to copy.
- **A block is an answer.** If a source starts returning 403s or challenges to an honestly
  identified caller, the capability degrades and reports the block. It does not work around it.
  Sustained circumvention risks the same outcome [§3.4](#34-rate-limits-are-hard-constraints-not-guidance) names for Scryfall — losing access for
  every user of this application at once — and here it would be forfeiting access that was never
  granted in the first place.
- **Self-throttle conservatively where no limit is published.** Absence of a documented limit is
  absence of evidence, not absence of a limit ([OQ-05](#oq-05--do-commander-spellbook-or-archidekt-impose-rate-limits)). Treat an undocumented source as the
  strictest lane in [§3.4](#34-rate-limits-are-hard-constraints-not-guidance) until told otherwise.
- **Ask before shipping, not after.** Where a source has a stated channel for requesting
  approved access, using it is part of the capability's spec work rather than a follow-up
  ([OQ-10](#oq-10--will-moxfield-grant-this-application-approved-access-and-under-what-terms)).

This constrains research sessions as much as shipped code. A live probe against an undocumented
API is a real request against someone else's infrastructure: keep it to single calls, spaced,
with an honest agent — which is how [§4.8](#48-moxfield)'s measurements were taken.

---

## 4. External dependencies

Every claim below is marked **[verified]** (observed live on the stated date) or
**[inferred]** (reasoned from documentation or policy wording, not directly observed).

### 4.1 Scryfall REST API

**Date verified:** 2026-07-29
**Base:** `https://api.scryfall.com` — HTTPS only, TLS 1.2+, UTF-8.

**Provides.** Card search with the full Scryfall query language, exact/fuzzy name lookup,
batch card resolution, rulings, sets, catalogs, card symbols, tags, card migrations.

**Auth.** None. No key, no signup. **[verified]**

**Required headers.** `User-Agent` naming this app (library defaults explicitly disallowed)
and `Accept` (may be generic, e.g. `*/*`). **[verified]**

**Rate limits.** Per-endpoint and hard. See [§3.4](#34-rate-limits-are-hard-constraints-not-guidance) for the table and the 429 consequences.
**[verified — this is stricter than the commonly assumed flat 10/sec; the four card
endpoints are 2/sec.]**

#### 4.1.1 Search endpoint

`GET /cards/search` — 2/second. Page size **175**, paginate via `next_page` / `has_more`.
Useful params: `unique` (`cards`|`prints`|`art`), `order`, `dir`, `page`, `include_extras`.
**[verified]**

**Operators confirmed working live** — all four the author asked about: **[verified]**

| Operator | Example tested | Result |
|---|---|---|
| regex | `o:/^{T}: Add/` | 1,554 cards |
| oracle tag | `otag:ramp` | 2,260 cards |
| oracle tag (alias) | `function:removal` | 6,386 cards |
| art tag | `art:squirrel` | 192 cards |
| art tag (alias) | `atag:squirrel` | 192 cards — identical, confirmed alias |
| legality + type + cost | `f:commander t:creature cmc=1` | 1,197 cards |
| price filter | `usd<1 t:land` | 803 cards |

**Re-verified 2026-08-03** during [CAP-01](#cap-01--card-search)'s acceptance pass. Every
operator behaves identically, including the `art:`/`atag:` alias equivalence; only the counts
moved — regex 1,555, `otag:ramp` 2,274, `function:removal` 6,405, `art:squirrel` and
`atag:squirrel` 194 each, `f:commander t:creature cmc=1` unchanged at 1,197, `usd<1 t:land` 802.
**[verified]** The 2026-07-29 figures above are left as recorded: they are a dated observation,
not a target. Drift of this size is normal and a future check should expect it.

`illustrationtag:` is **not** a valid operator — returns HTTP 400, "All of your terms were
ignored." **[verified, re-verified 2026-08-03]** Do not offer it.

**Addendum — the 400 above is a single-term behavior, and the general case is worse.
[verified 2026-08-04]** [Slice 8](./slices/TrackB-Slice8.md)'s operator verification
([`docs/slices/TrackB-Slice8-results.md`](./slices/TrackB-Slice8-results.md)) probed
`illustrationtag:` and a nonsense operator *inside otherwise-valid queries*, and Scryfall
**silently drops an unrecognized term whenever at least one recognized term remains**:
`t:creature illustrationtag:squirrel` returned HTTP 200 with a `total_cards` byte-identical to
bare `t:creature`, with no warning, note, or diagnostic of any kind. The
"All of your terms were ignored." 400 fires only when *every* term is invalid — which is why the
row above, tested as a single-term query, saw it. Two consequences, both recorded there:

- a hallucinated operator inside a real query produces an ordinary-looking result computed from
  fewer constraints than were asked for, with no signal that a filter was dropped;
- a 400 is a sound proof of an operator's non-existence **only for a single-term query**; any
  multi-term probe must compare its count against the same query without the term under test.
  Slice 8's log verified twelve further operators and four argument forms by exactly that
  baseline-comparison method.

The 2026-08-03 rows above are left as recorded — nothing in them is wrong, only narrower than
they read: each was a single-term or all-valid query, where the behaviors coincide.

**Addendum — regex anchors bind to a line of oracle text, not to the card. [verified 2026-08-04]**
[Slice 9](./slices/TrackB-Slice9.md)'s eval run
([`docs/slices/TrackB-Slice9-results.md`](./slices/TrackB-Slice9-results.md)) exercised the regex
row above from both configurations and pinned a semantic the earlier entries assumed rather than
tested. `oracle_text` carries one line per ability, and Scryfall evaluates `o:/…/` in **multi-line
mode**: `^` and `$` anchor to the start and end of *any* line, not of the whole text box.

Measured 2026-08-04: `o:/^whenever you cast/` returns **849** cards, while
`o:/^whenever you cast/ -o:/\nwhenever you cast/` returns **361**. **488 of the 849 therefore
matched on a line that was not the first** — the opposite of what "starts with" reads as. `$`
behaves the same way at the other end: `o:/you gain that much life\.$/` returns 35 and
`o:/you gain that much life\.\n/` returns 9, so 9 of the 35 closed a line that was not the last.

The escapes that would express the stricter, whole-text reading are unavailable, and they fail in
**two different ways** — which is the part worth carrying forward:

| Form | Observed 2026-08-04 |
|---|---|
| `\A` | HTTP 200, `total_cards: 0` — a well-formed query matching nothing, with no diagnostic |
| `\z` | HTTP 400, "All of your terms were ignored." |
| `(?-m:^…)` | HTTP 400, "All of your terms were ignored." |

`\A` is the dangerous one. A 400 is a loud, correctable signal; a zero-match 200 is
indistinguishable from a valid query that legitimately matched nothing, so the model reports "no
cards match" and the user believes it. That places `\A` in the same silent-wrong-answer class as
the dropped-term behavior in the addendum above. **[verified]** Whether Scryfall rejects the
escape or matches it literally is not determined. **[inferred]**

The practical workaround is the subtraction shown above — anchor with `^`, then exclude the
newline-preceded form. It is an approximation, not an equivalent: under
`o:/^whenever you cast/ -o:/\nwhenever you cast/`, 2 of the 175 cards on page 1 still did not
literally begin with the phrase, and it drops any card that leads with the phrase *and* repeats it
on a later line. **[verified]** Multi-faced cards are the likely cause, since a face boundary is
not a newline. **[inferred]**

The regex counts in the rows above stand; they were always line-anchored counts, and only the
reading of them was loose.

**Addendum — a negated numeric comparison is unusable, and it fails silently in two different
ways. [verified 2026-08-07]** Measured while settling
[OQ-09](#oq-09--should-price-resolution-fall-back-to-eur-when-no-usd-price-exists), whose
"resolves by" clause asks how many paper printings carry `eur` with `usd` null. The obvious query
for that — negate the USD comparison — does not work, and it does not say so.

| Query, `unique=prints` | `total_cards` | Observed |
|---|---|---|
| `game:paper` | 96,709 | baseline |
| `game:paper -usd>=0.01` | **96,709** | HTTP 200, identical to the baseline — the term was dropped |
| `game:paper eur>=0.01` | 92,688 | baseline |
| `game:paper eur>=0.01 -usd>=0.01` | **92,688** | HTTP 200, identical to its baseline — the term was dropped |
| `game:paper usd>=0.01` | 93,662 | — |
| `game:paper eur>=0.01 -(usd>=0.01)` | — | HTTP 404, zero matches |
| `game:paper eur>=0.01 usd<0.01` | — | HTTP 404, zero matches |

**Scryfall's syntax cannot express "this field is null."** The bare negated form is dropped like
any unrecognized term, per the dropped-term addendum recorded above, while the parenthesized and
`<`-form alternatives match nothing at all. This is a **third** member of the silent-wrong-answer
family this section already carries, alongside the dropped invalid term and the `\A` zero-match
regex trap: a query that looks like it worked, computed from fewer constraints than it names.
Trusting the bare negated form here would have reported that 96% of paper printings lack a USD
price.

The usable bound comes from subtracting non-negated counts instead: **96,709 − 93,662 = 3,047
paper printings, 3.15%, carry no USD price**, and EUR-only printings are a subset of that. Ground
truth is unchanged — all three paper Black Lotus printings still return `usd: null` with `eur`
populated ([§4.1.3](#413-price-fields--three-verified-traps)). **[verified]**

**Addendum — a full 175-card page measures 169,504 characters through the delivered shaping.
[verified 2026-08-07]** This is the measurement
[OQ-02](#oq-02--how-verbose-should-a-search-result-be) had never had. One real page was fed
through [`src/tools/card-search.ts`](../src/tools/card-search.ts) with a fake client, so these are
shaped bytes rather than wire bytes.

| | chars | per card | share |
|---|---|---|---|
| Full shaped page, 175 cards | 169,504 | 969 | — |
| of which `legalities` | 84,226 | 481 | 49.7% |
| of which `oracle_text` | 29,334 | 168 | 17.3% |
| of which `price` | 8,717 | 50 | 5.1% |
| Trimmed to the seven default formats | 109,059 | 623 | −35.7% |
| Trimmed to the queried format alone | 88,953 | 508 | −47.5% |

It **confirms the trim and refutes it as sufficient**: the best available trim, 88,953, still lands
in the same order of magnitude as the 116,626-character response that had already breached a
harness tool-result ceiling (issue #25). That is what forced the second lever in
[OQ-02](#oq-02--how-verbose-should-a-search-result-be)'s answer. Note also that per-card cost
varies with the cards a query returns — 969 characters here against issue #25's 1,050 — so a
budget derived from one page is an estimate and not a constant. **[verified]**

**Addendum — Scryfall returns 23 legality keys, not "roughly 21". [verified 2026-08-07]** The full
set as returned on a card object: `standard`, `future`, `historic`, `timeless`, `gladiator`,
`pioneer`, `modern`, `legacy`, `pauper`, `vintage`, `penny`, `commander`, `oathbreaker`,
`standardbrawl`, `brawl`, `competitivebrawl`, `alchemy`, `paupercommander`, `duel`, `oldschool`,
`premodern`, `predh`, `tlr`. [OQ-02](#oq-02--how-verbose-should-a-search-result-be)'s seven-format
default set is chosen from this list; the "roughly 21" it was framed against was an estimate rather
than an observation.

**Critical architectural fact.** These operators are evaluated **server-side**. They are not
fields on the card object and cannot be reproduced from bulk data without reimplementing
Scryfall's query engine. This is the fact behind [D-07](#d-07--three-way-cache-split). **[verified]**

#### 4.1.2 Batch resolution

`POST /cards/collection` — 2/second, **maximum 75 card references per request**,
`Content-Type: application/json`. Identifiers accept `id`, `oracle_id`, `mtgo_id`,
`multiverse_id`, `illustration_id`, `name`, or `set` + `collector_number`. **[verified]**

This is the pricing primitive: a 100-card decklist is 2 requests, ~1 second. Any queued
capability that prices a list should use this, never a loop over `/cards/named`.

#### 4.1.3 Price fields — three verified traps

The price object's live shape is exactly:
`usd`, `usd_foil`, `usd_etched`, `eur`, `eur_foil`, `tix`. **[verified]**

1. **`eur_etched` does not exist.** The card-object documentation lists it. The live API does
   not return it. Do not model it. **[verified — docs/reality discrepancy]**

2. **`usd` null while `usd_foil` populated is common, not an edge case — 7,599 cards.**
   Foil-only printings (judge promos, From the Vault, etc.). Example: Gaea's Cradle (`jgp`)
   returns `usd: null, usd_foil: "3999.00"`. Similarly `is:etched` printings (1,074 cards)
   carry `usd_etched` with `usd` and `usd_foil` both null. **A price lookup that reads only
   `usd` will report "no price" for thousands of cards, including expensive ones.**
   **[verified]**

3. **The worst one: name lookup can silently return a digital printing with no paper
   prices.** `GET /cards/named?exact=Black+Lotus` returns the **MTGO** printing —
   `digital: true`, `games: ["mtgo"]`, every paper price `null`, only `tix: "45.98"`. Mox
   Emerald behaves identically. Digital-only Arena cards have *all* prices null. **Any price
   path must constrain to paper printings** (e.g. `game:paper` / filtering on `games`), or it
   will report "no price available" for some of the most valuable cards in Magic.
   **[verified]**

**Addendum — trap 3 has widened. [verified 2026-08-03]**

- **The digital printing now wins a plain `/cards/search` rollup too**, not only
  `/cards/named`. A bare `!"Black Lotus"` at `unique=cards` returns the MTGO Vintage Masters
  printing. Constraining to paper is therefore required on the *search* path as well, which is
  broader than the original trap stated.
- **No paper Black Lotus printing carries a USD price any more.** `2ed`, `leb`, and `lea` all
  return `usd`, `usd_foil`, and `usd_etched` as `null`, with only `eur` populated
  (11658.96 / 22454.09 / 38719.86 respectively). The 2026-07-29 record had LEA's `usd`
  populated, so this is an upstream data change, not a misreading.

The first point is handled: the delivered price resolution reports the MTGO printing as
`digital-only` with the reason stated, never as a bare "no price". The second point is **not**
handled and is not merely cosmetic — it means the most valuable cards in paper Magic return no
price at all through this API surface. That is [OQ-09](#oq-09--should-price-resolution-fall-back-to-eur-when-no-usd-price-exists).

**ToS notes.** No attribution requirement. Prohibitions in [§3.3](#33-legal-and-terms-of-service) bind — especially the
no-paywall rule and the "must create additional value, not proxy" rule. Scryfall's own terms
state price data and card legality are informational only with no guarantees.

**Risk if it changes or disappears.** **Severe — this is the single point of failure.** Every
capability except Comprehensive Rules lookup depends on Scryfall, and [CAP-01](#cap-01--card-search) depends on it
for query evaluation specifically, which nothing else replaces. There is no second source for
Scryfall query syntax. Mitigations: be scrupulous about [§3.4](#34-rate-limits-are-hard-constraints-not-guidance) so access is never revoked for
cause; keep the `User-Agent` accurate so Scryfall can contact the author rather than block;
treat a Scryfall outage as total outage and fail with a clear message rather than a stack
trace. Migration to a bulk-only fallback would mean losing regex and tag operators entirely —
i.e. losing [CAP-01](#cap-01--card-search)'s core value.

### 4.2 Scryfall bulk data

**Date verified:** 2026-07-29
**Endpoint:** `GET https://api.scryfall.com/bulk-data` (10/second; files themselves served
from `data.scryfall.io`, unlimited).

**The object shape has changed and contradicts older references.** **[verified]** A
`bulk_data` object now has:

```
object, id, type, updated_at, uri, name, description,
jsonl_download_uri, compressed_size
```

**`download_uri` and `size` no longer exist.** Files are **gzipped JSONL**, not JSON arrays.
Anything written from memory of this API will reference the wrong fields. URLs carry a daily
timestamp and must be resolved programmatically from the `/bulk-data` endpoint, never
hardcoded.

**Available types, all refreshed daily:** **[verified]**

| Type | Compressed | Purpose here |
|---|---|---|
| `oracle_cards` | 24.4 MB | one card per Oracle ID; name→`oracle_id` resolution |
| `default_cards` | — | every card in English or its printed language |
| `all_cards` | — | every card in every language; almost certainly unnecessary |
| `unique_artwork` | — | one card per unique artwork |
| `rulings` | — | all rulings, joined by `oracle_id` |
| `art_tags` | — | **new** — all illustration tags from Tagger |
| `oracle_tags` | — | **new** — all Oracle tags from Tagger |

**Refresh cadence guidance from Scryfall.** Prices update once per day, so fetching card data
more often than 24 hours yields no new prices. Gameplay data changes far less often — weekly,
or right after a set release, is sufficient. Scryfall explicitly asks consumers to cache for
at least 24 hours, and states that bulk files are **required** (not merely preferred) if you
need to rapidly look up many names, prices, or images. **[verified]**

**Risk.** Low-moderate. The JSONL migration already happened, which suggests the shape is
current rather than mid-transition, but it demonstrates the endpoint does change
incompatibly. Always read `jsonl_download_uri` from the API response rather than constructing
it.

### 4.3 Scryfall Tags API

**Date verified:** 2026-07-29
**Docs:** `https://scryfall.com/docs/api/tags` (marked "New")

**Provides.** The tag corpus behind the `otag:`/`function:` and `art:`/`atag:` search
operators, as structured data with hierarchy. Delivered as the `oracle_tags` and `art_tags`
bulk files, updated daily.

**Tag object.** `id` (stable UUID), `slug` (URL-safe, **mutable**), `label`, `uri`, `type`
(`oracle` | `illustration`), `description`, `parent_ids`, `child_ids`, `aliases`, `taggings`.
**[verified]**

**Tagging object.** Joins a tag to cards — `oracle_id` for oracle tags, `illustration_id` for
art tags — plus a `weight` indicating how prominently the tag applies. **[verified]**

**Constraints this imposes.** See [§3.5](#35-community-sourced-tag-data). Track by `id`, not `slug`. Provide a way to disable
individual tags. Data is community-sourced and moderated but not guaranteed clean.

**Why this matters beyond tag discovery.** The `parent_ids`/`child_ids` hierarchy and
`aliases` are what let a capability answer "what tag means *ramp*?" and then hand a correct
`otag:` term to [CAP-01](#cap-01--card-search). Tag *discovery* is a bulk-data problem; tag *search* is a [CAP-01](#cap-01--card-search)
problem. Keeping those separate is why [D-07](#d-07--three-way-cache-split) is three-way.

**Risk.** Moderate. Newer than the rest of the API, so more likely to change shape.
Community-maintained, so individual tags can appear, vanish, or be renamed — which is
precisely why the `id` rule exists.

### 4.4 Commander Spellbook

**Date verified:** 2026-07-29
**Base:** `https://backend.commanderspellbook.com`

**There is a public API, and it is better documented than the syntax guide suggests.** Not
linked from `commanderspellbook.com/syntax-guide/`, but the About page links "Backend REST
API", and a full **OpenAPI 3.0.3 schema is served at
`https://backend.commanderspellbook.com/schema/`** — API version 5.7.5, 31 paths.
**[verified]**

**Auth.** **Anonymous access works.** The schema lists `basicAuth`/`cookieAuth`/`jwtAuth` on
every path, but that is `drf-spectacular` boilerplate — `/variants/`, `/find-my-combos`,
`/estimate-bracket`, and `/card-list-from-url` all returned HTTP 200 with no credentials.
JWT endpoints (`/token/`, `/token/refresh/`, `/token/verify/`) exist for the submission
workflows, which this project does not need. **[verified]**

**Endpoints most relevant here:** **[verified present]**

| Path | Why it matters |
|---|---|
| `/variants/` | the combo corpus; supports `q` search, `limit`/`offset`, `ordering`, `groupByCombo`, `count` |
| `/find-my-combos` | **the combo-discovery primitive** — submit a decklist, get the combos inside it |
| `/estimate-bracket` | EDH bracket estimation from a decklist (GET and POST) |
| `/card-list-from-url` | resolves a deck URL to a card list; returns a `Deck` schema, or `InvalidUrlResponse` on 400 |
| `/cards/`, `/features/`, `/templates/`, `/variant-aliases/` | supporting corpora |

**Variant object** carries `id`, `uses` (cards, with zone locations and
`mustBeCommander`), `produces`, `requires`, `includes`, `prices`, `identity`, `legalities`,
`popularity`, `bracketTag`, `description`, `manaNeeded`, `easyPrerequisites`,
`notablePrerequisites`. Card entries embed Scryfall `oracleId` and Scryfall image URLs.
**[verified]**

**Avoid** `https://json.commanderspellbook.com/variants.json` — **606 MB uncompressed**.
Use the paginated API. **[verified]**

**Terms of use.** There is **no ToS page** — `/terms`, `/legal`, and `/privacy` all 404 on
the site; only a Privacy Policy is linked in the footer. The **website and backend source are
MIT-licensed and open source**, and the project powers EDHREC's combo feature. **[verified]**
The MIT license covers the *code*; the combo *data* carries no stated license.
**[inferred: this is a residual ambiguity, not a blocker — the data is publicly served
without auth, by a community project that exists to distribute it, and is already consumed by
EDHREC. Treat as permitted, cache politely, credit the project.]**

**Rate limits.** None documented and none observed in headers. **[verified absent — meaning
unknown, not unlimited.]** Self-throttle conservatively.

**Risk.** Moderate. A volunteer-run community project with no ToS and no SLA. If it
disappears, combo discovery has no equivalent replacement — EDHREC consumes this data rather
than producing it. Because the backend is MIT and open source, a worst case could be
self-hosted, which is a meaningfully better position than a closed API.

### 4.5 Archidekt

**Date verified:** 2026-07-29
**Base:** `https://archidekt.com/api`

**Provides.** Deck read (and, eventually, write). Undocumented, self-described by third
parties as open beta.

**Auth for reads: none required for public decks.** `GET /api/decks/1/` → HTTP 200, 53 KB,
no credentials. **[verified]**

**Endpoints.** **[verified]**
- `GET /api/decks/{id}/` — full deck
- `GET /api/decks/{id}/small/` — **undocumented minified variant**, cheaper reads
- `GET /api/decks/cards/` — deck search by `name`, `colors`, `logicalAnd`, `owner`, `cards`

**Deck payload** carries `id`, `name`, `deckFormat` (integer, not a string `format`),
`edhBracket`, `private`, `unlisted`, `theorycrafted`, `owner`, `categories`, `deckTags`,
`cards`, `customCards`, and `intentionallySkippedCardData`. **[verified]**

Each card entry has `quantity`, `modifier`, `label`, `companion`, `customCmc`, `notes`, and
`categories` — **commander designation is expressed as `categories: ["Commander"]`**, not a
dedicated field. The nested `card.oracleCard` already includes `oTags`, `edhrecRank`, `salt`,
`gameChanger`, `legalities`, `manaProduction`, `twoCardComboIds`, `atomicCombos`, and
`potentialCombos` — Archidekt embeds its own combo and tag annotations. **[verified]**

**Non-public decks are masked as 404, not 403.** Tested against a real deck ID known to the
author (`24637224`): `GET /api/decks/24637224/` returns
`HTTP 404 {"error":"Deck not found."}`, and the web UI redirects to `/missing-deck`. Identical
result with a browser `User-Agent`, so this is not bot-blocking. **Private, unlisted, and
deleted decks are indistinguishable to an anonymous caller.** **[verified]** Error messaging
for any deck-reading capability must cover all three possibilities and must not assert which
one occurred ([§3.6](#36-error-surface)).

**Rate limits.** None documented; **no rate-limit, retry-after, or throttling headers exposed
at all**. **[verified absent — meaning unknown.]** Self-throttle conservatively.

**Write API — not investigated.** The author's questions about bulk import (replace vs.
append, preservation of categories / commander designation / companion / maybeboard, blast
radius on partial failure) are **unanswered**. Testing writes requires authentication and
would mutate a real deck; that was deliberately not done in a research session. This is
Open Question [OQ-04](#oq-04--what-is-the-behavior-and-blast-radius-of-archidekts-write-api) and is the reason [D-09](#d-09--archidekt-writes-land-last) exists.

**The npm `archidekt` package does not earn its dependency.** v0.0.14, published seven years
ago, zero dependents, and its README states: "Archidekt does not have documentation for their
API and is currently in open beta. Therefore everything herein is open to change."
**[verified]** See [D-12](#d-12--no-npm-archidekt-dependency). Its URL-shape documentation is transcribed into this section so the
package can be ignored entirely.

**Risk.** High for writes, moderate for reads. An undocumented open-beta API can change
without notice and has no versioning. Reads are simple enough to repair quickly. Writes are
destructive, which is why they are last.

### 4.6 Comprehensive Rules (Wizards of the Coast)

**Date verified:** 2026-07-29
**Landing page:** `https://magic.wizards.com/en/rules`

**Provides.** The authoritative rules document. Offered as DOCX, PDF, and TXT.

**TXT is the right format and it parses cleanly.** **[verified]** Current file:
`https://media.wizards.com/2026/downloads/MagicCompRules 20260619.txt` — effective
June 19, 2026.

- 975,632 bytes, **UTF-8 with BOM** (`EF BB BF`), **CRLF** line endings, 9,367 lines
- Table of contents, then **3,447 numbered-rule lines** (`100. General`, `101.1.`, …)
- Subrules **skip the letters `l` and `o`** to avoid confusion with `1` and `0` — e.g.
  `704.5k` → `704.5m` → `704.5n` → `704.5p`. A parser assuming contiguous letters is wrong.
- **Glossary** begins around line 7,083 in a regular term / definition / blank-line pattern
- Credits at the end

DOCX would need a document parser for no benefit; PDF is worst for text extraction.

**URL resolution.** There is **no API and no stable "latest" URL.** The filename carries a
date stamp and the path carries a year, and **the filename contains a literal space** that
must be encoded as `%20`. The current URL is resolved by fetching the landing page and
extracting the `.txt` href. **[verified]**

**Update cadence.** Tied to set releases and rules revisions — roughly quarterly.
**[inferred from the date-stamped release pattern; not stated on the page.]** The practical
consequence is that a cached copy must be revalidated against the landing page rather than
trusted indefinitely.

**Terms on redistribution.** The Fan Content Policy prohibits "verbatim copying and reposting
of Wizards' IP," citing freely distributing rules content as its example. The example given is
D&D rules content, and the policy does not name the Magic CR specifically. **[inferred: the
policy does not explicitly forbid bundling the Magic CR, but shipping a verbatim 975 KB copy
of a Wizards document to other people matches the described shape closely enough that the
low-cost alternative wins.]** This drives [D-08](#d-08--comprehensive-rules-fetched-at-runtime-never-bundled): fetch at runtime on the user's machine, cache
locally, revalidate on version change.

**Risk.** Low-moderate. The document is stable, free, and long-lived. The fragile part is
**URL resolution by scraping** — a redesign of the landing page breaks it. Mitigation: keep
the cached copy usable when resolution fails, and report staleness rather than failing hard.

**Addendum — the landing page listed exactly one `.txt` on 2026-08-07, and the file has turned
over since 2026-07-29. [verified 2026-08-07]** The single href was
`MagicCompRules 20260807.txt`, stamped the same day it was read, so this observation sits
immediately after an update rather than in the quiet middle of a cycle. The
2026-07-29 record above is left as written: `MagicCompRules 20260619.txt` was current then, and
the turnover is the roughly-quarterly cadence that record inferred, now observed once rather than
inferred. Scraping a single `.txt` href is therefore correct against today's page.

This is recorded as a half-answer to
[OQ-08](#oq-08--does-the-cr-landing-page-ever-offer-more-than-one-date-stamped-txt-and-how-are-mid-cycle-corrections-handled)
and **not** as a licence to write the scraper against one hypothesis. "Does the page *ever* list
two" is a claim about a year of behavior and one GET is the weakest possible evidence for it, so
the parser must still take the most recent `.txt` **by its date stamp** rather than the first match
in document order. **[verified for the single observation; the "ever" question stays open.]**

### 4.7 WotC Fan Content Policy

**Date verified:** 2026-07-29
**URL:** `https://company.wizards.com/en/legal/fancontentpolicy`

Not a data source — a constraint that governs the whole project, and the actual origin of the
attribution obligation. See [§3.3](#33-legal-and-terms-of-service) for the verbatim disclaimer and [§3.1](#31-distribution-and-install-friction)/[§3.3](#33-legal-and-terms-of-service) for the
non-commercial and non-paywall implications. Scryfall and Commander Spellbook both operate
under this policy and both carry the disclaimer, which is confirmation that it is the right
frame for this project too. **[verified]**

### 4.8 Moxfield

**Date verified:** 2026-08-07
**Base:** `https://api2.moxfield.com` (authentication endpoints also on `https://api.moxfield.com`)

Numbered 4.8 and appended after [§4.7](#47-wotc-fan-content-policy) rather than inserted beside [§4.5](#45-archidekt), because renaming or
renumbering a heading breaks every link pointing at it. Read it as a sibling of [§4.5](#45-archidekt); the
policy subsection sitting between them is an artifact of append-only numbering.

**Provides.** Deck read. Deck write exists but is unreachable — see the authentication finding
below and [D-15](#d-15--moxfield-writes-are-blocked-upstream-not-merely-last).

**There is no official public API and no published documentation.** **[verified — absence
confirmed, not merely unfound.]** Moxfield's own public repository, `moxfield/moxfield-public`,
is an issue tracker: its README identifies the product and carries the Wizards trademark
disclaimer, and documents no endpoint, no terms for automated access, and no rate limit. Every
URL shape below is therefore reverse-engineered — by this session where marked verified, and by
third-party wrappers where marked otherwise.

**Auth for reads: none required for public decks, and no bot challenge was encountered.**
`GET /v3/decks/all/{id}` with an app-naming `User-Agent` and `Accept: application/json` →
HTTP 200. **[verified]** No Cloudflare interstitial, no JavaScript challenge, no cookie
requirement. Measured from one machine on one date, so read it as "reads are not challenged by
default" and not as a guarantee — [§3.7](#37-undocumented-and-bot-protected-third-party-apis) governs what happens if that changes, and the answer
is not to work around it.

**Endpoints.**
- `GET /v3/decks/all/{id}` — full deck. **[verified]** `{id}` is the 22-character public ID from
  the deck's web URL, `https://moxfield.com/decks/{id}`.
- `POST /v1/account/token` and `POST /v2/account/token` — username/password authentication.
  **[reported on Moxfield's issue tracker; deliberately not exercised — see below.]**
- `GET /v2/decks/search`, `GET /v2/cards/search` — **[attributed to third-party wrappers, not
  verified here.]** Card search is served by [§4.1](#41-scryfall-rest-api) regardless; deck search is not a queued
  capability.

**Moxfield operates a `User-Agent` whitelist granted by support.** **[verified — reported by a
third-party developer on Moxfield's issue tracker, with support's confirmation quoted.]** This
is the closest thing to an access policy Moxfield publishes anywhere, and it means an
identifiable agent is a prerequisite rather than a courtesy ([§3.7](#37-undocumented-and-bot-protected-third-party-apis)). It also implies a channel
for asking, which is [OQ-10](#oq-10--will-moxfield-grant-this-application-approved-access-and-under-what-terms).

**Authentication is challenged even for whitelisted agents, and the report is unanswered.**
`moxfield/moxfield-public` issue #143, filed 2025-11-23: a developer whose `User-Agent` support
confirmed as whitelisted receives Cloudflare/reCAPTCHA validation from both token endpoints, and
cannot obtain a token at all. `POST /v1/account/token` returns HTTP 400 with an RFC 9110
problem-details body; `POST /v2/account/token` returns `{"token":["The Token field is
required."]}`. **The issue is open, unlabeled, and carries zero maintainer comments as of
2026-08-07** — roughly eight and a half months. **[verified]** This project did not attempt
authentication: there is no account to test with that is not the author's, and [§3.7](#37-undocumented-and-bot-protected-third-party-apis) forbids
the techniques that would get past a challenge anyway. This finding is the whole basis of
[D-15](#d-15--moxfield-writes-are-blocked-upstream-not-merely-last).

**An unknown deck ID returns HTTP 404** as an RFC 9110 problem-details body —
`{"type":"…rfc9110#section-15.5.5","title":"Not Found","status":404,"traceId":"…"}`, 162 bytes,
carrying no reason beyond the status. **[verified]** Whether private and unlisted decks are
masked behind that same 404, as [§4.5](#45-archidekt) found for Archidekt, is **not tested** —
[OQ-11](#oq-11--does-moxfield-mask-private-and-unlisted-decks-behind-the-same-404-as-an-unknown-id). Do not assume parity in either direction; [§3.6](#36-error-surface) is what constrains the message
until it is known.

**Rate limits.** None documented; no rate-limit, retry-after, or throttling headers observed.
**[verified absent — meaning unknown.]** Same posture as Archidekt: self-throttle
conservatively ([§3.7](#37-undocumented-and-bot-protected-third-party-apis)), and see [OQ-05](#oq-05--do-commander-spellbook-or-archidekt-impose-rate-limits).

#### 4.8.1 The deck payload is enormous — measured

This is the finding that shapes the capability, and it was measured rather than estimated.

**One public deck read returned 1,629,429 bytes** — 1.63 MB of JSON for a single request.
**[verified 2026-08-07]** The deck holds 250 mainboard cards and 5 maybeboard cards. Byte
distribution across top-level keys:

| Key | Bytes | Share |
|---|---|---|
| `boards` | 996,690 | 61.2% |
| `tokens` | 296,316 | 18.2% |
| `tokenMappings` | 251,240 | 15.4% |
| `authorTags` | 10,925 | 0.7% |
| everything else (44 more keys) | ~74,000 | ~4.5% |

**Two numbers matter more than the total.** First, **a single card entry is ~3,959 bytes**, so
the payload scales with deck size and an ordinary 100-card Commander deck's `boards` alone lands
near 400 KB. Second, **`tokens` plus `tokenMappings` is 33.6% of the response** — a third of
every Moxfield deck read is token data that no deckbuilding question asked for.

**Set that against the ceiling this project has already hit.** [OQ-02](#oq-02--how-verbose-should-a-search-result-be)'s answer records a
[CAP-01](#cap-01--card-search) response of 116,626 characters that **exceeded a harness tool-result ceiling** at well
under one page of results (issue #25). This deck read is roughly **fourteen times** that. The
consequence is not a preference: **a Moxfield deck-read capability cannot pass the upstream
payload through, at any deck size worth reading.** Trimming is load-bearing from the first line
of the spec, which is a different starting position from [CAP-01](#cap-01--card-search), where verbosity was
discovered as a problem after delivery.

**The trim is unusually obvious, because every card carries `scryfall_id`.** **[verified]** The
nested `card` object holds roughly seventy fields — including `legalities`, `prices`,
`oracle_text`, `card_faces`, `edhrec_rank`, `multiverse_ids`, and **twelve vendor and affiliate
URL fields** (`cardKingdomUrl`, `cardMarketUrl`, `tcgPlayerUrl`, `coolStuffIncUrl`,
`cardTraderUrl`, `starcitygames_url`, `manapool_url`, `cardHoarderUrl`, and their foil variants).
Almost all of it duplicates, less currently, what [§4.1](#41-scryfall-rest-api) already serves — and [D-06](#d-06--pricing-from-scryfall) makes Scryfall the
price source regardless, so Moxfield's embedded `prices` must not be read for price answers. A
deck read that returns name, quantity, board, finish, and `scryfall_id`, then resolves detail
through [§4.1.2](#412-batch-resolution) batch lookup, is both far smaller and more correct than passing the payload
through.

**Board structure differs from Archidekt's in a way that affects the normalized shape.**
`boards` is a map of twelve named boards — `mainboard`, `sideboard`, `maybeboard`, `commanders`,
`companions`, `signatureSpells`, `attractions`, `stickers`, `contraptions`, `planes`, `schemes`,
`tokens` — each with a `count` and a `cards` map. **[verified]** Empty boards are still present
and cost 22 bytes each, so the count is fixed rather than variable. **Commander designation is a
board here**, where [§4.5](#45-archidekt) found Archidekt expresses it as `categories: ["Commander"]` on the card.
Companion likewise. Neither platform's convention is more correct, and one of them will have to
be translated into whatever the tool returns — [OQ-12](#oq-12--what-is-the-normalized-deck-shape-and-does-one-tool-serve-both-platforms-or-two).

Per-card fields outside the nested card object: `quantity`, `boardType`, `finish`, `isFoil`,
`isAlter`, `isProxy`, `useCmcOverride`, `useManaCostOverride`, `useColorIdentityOverride`,
`excludedFromColor`. **[verified]** Deck-level fields worth naming: `name`, `format`,
`visibility`, `publicUrl`, `publicId`, `createdByUser`, `authors`, `hubs`, `colorIdentity`,
`bracket`, `createdAtUtc`, `lastUpdatedAtUtc`. **[verified]**

#### 4.8.2 The npm `moxfield-api` package

Researched because [D-14](#d-14--no-npm-moxfield-api-dependency) had to be decided on evidence rather than by analogy to [D-12](#d-12--no-npm-archidekt-dependency).
**[verified 2026-08-07]** v2.1.0, MIT, TypeScript, ESM-only, last pushed 2026-08-03 — genuinely
maintained, unlike the seven-year-stale `archidekt` package. Its `src/api/` holds exactly one
module, `deck-list`, exposing `decklist.findById()` over `GET /v3/decks/all/{id}`, accepting
either a bare ID or a full deck URL. No authentication, no writes, no search. Its fetcher wraps
global `fetch`, sets **no headers at all**, and throws typed errors. Runtime dependencies: `zod`
and `zod-fetch`.

Its URL-shape and input-parsing knowledge is transcribed above so the package can be ignored
entirely — the same treatment [§4.5](#45-archidekt) gives the `archidekt` package, and for a different reason:
that one is abandoned, this one is simply narrower than its name suggests. See [D-14](#d-14--no-npm-moxfield-api-dependency).

**A second wrapper is worth knowing about as evidence, not as a model.** A public FastAPI proxy
for Moxfield uses `cloudscraper` to bypass Cloudflare's JavaScript challenge. **[verified]** Two
things follow. It is corroboration that Moxfield's protection does bite some callers, which
makes the honest-`User-Agent` requirement in [§3.7](#37-undocumented-and-bot-protected-third-party-apis) load-bearing rather than decorative. And it
is precisely the technique [§3.7](#37-undocumented-and-bot-protected-third-party-apis) forbids — recorded here so that a future session that finds
it while searching recognizes it as a rejected approach rather than a solution.

**Risk.** Moderate for reads, and higher than Archidekt's. Both are undocumented and unversioned,
so both can change without notice; Moxfield adds an active bot-protection layer that this project
will not circumvent, which means a posture change upstream is a hard stop rather than a repair
job. Writes are not at risk because they are not reachable ([D-15](#d-15--moxfield-writes-are-blocked-upstream-not-merely-last)). Mitigation for reads is the
same as everywhere else here: identify honestly, throttle conservatively, keep the payload
handling tolerant of unknown fields, and treat a block as an answer.

---

## 5. Capabilities

### Capability block template

Reproduce this schema for every new capability. Do not modify it.

```
### CAP-0N — <short name>
- **Status:** proposed | specified | deferred | delivered
- **Phase:** N | unassigned
- **User need:** one or two sentences in my voice, not feature language
- **Behavior:** precise enough to build against
- **Depends on:** data sources and other CAP-IDs
- **Serves via:** proposed tool name(s), no signatures — those come later
- **Acceptance criteria:** checkable statements, not aspirations
- **Open questions:** or "none"
```

**IDs are stable and never reused.** Adding a capability means appending a CAP block and
updating [§6](#6-phases), [§7](#7-open-questions), and [§9](#9-revision-log) — nothing else.

---

### CAP-01 — Card search

- **Status:** delivered (2026-08-03)
- **Phase:** 1
- **User need:** I want to ask for cards in plain English and have Claude turn that into a
  real Scryfall query — including the parts I'd never type myself, like regex and the Tagger
  operators. And I want back enough about each card that I can actually reason about whether
  it belongs in a deck, without opening a browser tab to check its price or legality.
- **Behavior:**
  - Accepts a Scryfall query string and evaluates it against live `GET /cards/search` ([D-07](#d-07--three-way-cache-split)).
    The **full** query language is supported because Scryfall evaluates it — this capability
    does not parse, validate, or reimplement the syntax.
  - Supports the operators verified in [§4.1.1](#411-search-endpoint), explicitly including regex (`o:/…/`), oracle
    tags (`otag:` / `function:`), and art tags (`art:` / `atag:`). These are ordinary search
    operators, not a separate tag integration.
  - Exposes the search parameters that change result meaning: `unique`
    (`cards`|`prints`|`art`), `order`, `dir`. Defaults are chosen for deckbuilding, not for
    collecting — `unique=cards` so one row per card rather than per printing.
  - Returns per card: name, mana cost, converted mana cost, type line, oracle text, colors
    and color identity, power/toughness/loyalty where applicable, rarity, set, format
    legalities, and price.
  - **`legalities` is trimmed to the format the query names** (amended 2026-08-04, resolving
    [OQ-02](#oq-02--how-verbose-should-a-search-result-be)). When `q` carries `f:`, `banned:`, or
    `restricted:`, only that format's legality is returned; when it names no format, a small
    default set is. The full map is available behind an opt-in. Untrimmed passthrough measured
    **54.5%** of a real response's bytes — a majority of the payload spent on formats the user
    did not ask about, and enough to exceed a harness tool-result ceiling at well under one page.
  - **Price correctness is part of this capability, not deferred.** Results constrain to
    paper printings for price purposes, and surface `usd_foil` / `usd_etched` when `usd` is
    null rather than reporting no price ([§4.1.3](#413-price-fields--three-verified-traps)). A card with genuinely no paper price says
    so, and says why (digital-only).
  - **Paginates explicitly.** Page size is 175. When more results exist, the response says
    how many total and that more are available, so the model can decide between narrowing
    the query and fetching another page. It does not silently truncate, and it does not
    auto-fetch every page of a 6,000-card result.
  - **Malformed queries return a structured failure carrying Scryfall's own `details`
    message** ([D-10](#d-10--tool-handlers-never-throw)). Scryfall's error text is genuinely useful for correction — e.g. "All
    of your terms were ignored" for an invalid operator — and passing it through lets Claude
    self-correct on the next call.
  - **The Scryfall syntax is surfaced to the model, not assumed.** The tool description and
    an accompanying syntax reference carry enough of the query language — operators,
    comparison forms, regex form, tag operators — that Claude constructs good queries without
    the user spelling them out. This is a stated user need, so the reference is part of the
    capability rather than documentation.
  - Respects the 2/second limit for `/cards/search` and handles 429 by backing off, never by
    retrying immediately ([§3.4](#34-rate-limits-are-hard-constraints-not-guidance)).
- **Depends on:** Scryfall REST API ([§4.1](#41-scryfall-rest-api)) — `GET /cards/search`. No other data source. No
  other CAP. This is the foundation most queued capabilities build on.
- **Serves via:** `card_search`. Plus a syntax reference exposed as an MCP resource (and/or a
  `card_search_syntax` tool) — see [OQ-01](#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) for which.
- **Acceptance criteria:**
  1. A handler function for `card_search` is invoked directly in a test with no MCP server
     started and no transport constructed ([D-03](#d-03--testability-handlers-callable-as-plain-functions)).
  2. `o:/^{T}: Add/` returns results (>1,000 as of 2026-07-29), demonstrating regex reaches
     Scryfall unmangled.
  3. `otag:ramp`, `function:removal`, `art:squirrel`, and `atag:squirrel` each return
     results.
  4. A search matching Gaea's Cradle's judge printing reports a price from `usd_foil`, not
     "no price available" ([§4.1.3](#413-price-fields--three-verified-traps) trap 2).
  5. A search for an `is:etched` printing reports a price from `usd_etched`.
  6. A price for Black Lotus resolves against a paper printing, not the MTGO printing whose
     paper prices are all null ([§4.1.3](#413-price-fields--three-verified-traps) trap 3).
  7. A digital-only Arena card reports no paper price *and* states that the reason is
     digital-only.
  8. `illustrationtag:dragon` (invalid operator, HTTP 400) returns a structured failure
     containing Scryfall's `details` text — and does not throw ([D-10](#d-10--tool-handlers-never-throw)).
  9. A query with >175 matches reports the total count and that more results exist.
  10. Every outbound request carries a `User-Agent` naming this application and an `Accept`
      header ([§3.4](#34-rate-limits-are-hard-constraints-not-guidance)).
  11. Two searches issued back to back do not exceed 2 requests/second.
  12. An HTTP 429 results in a backoff, not an immediate retry, and surfaces a clear
      structured failure if it persists.
  13. **A query naming a format returns that format's legality and no other.** Added 2026-08-04
      with [OQ-02](#oq-02--how-verbose-should-a-search-result-be)'s answer. `f:commander` returns
      commander legality alone; a query naming no format returns the default set; the opt-in
      returns the full map. Checked against a real multi-card response, since the failure this
      addresses only appears at scale — a single card's untrimmed `legalities` is unremarkable
      and 111 cards' is the majority of the payload.
- **Open questions:** [OQ-01](#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) (how to surface syntax), [OQ-02](#oq-02--how-verbose-should-a-search-result-be) (result verbosity vs. context
  budget), [OQ-09](#oq-09--should-price-resolution-fall-back-to-eur-when-no-usd-price-exists) (EUR fallback when no USD price exists — opened by the acceptance pass).
- **Delivery note (2026-08-03).** All twelve acceptance criteria are verified: 2–9 live against
  Scryfall, and 1, 10, 11, 12 at unit level. Criterion 12 is unit-level permanently — provoking
  a real 429 to observe it is what [§3.4](#34-rate-limits-are-hard-constraints-not-guidance)
  forbids. `delivered` means the criteria as written are met, not that the capability is
  finished: [OQ-02](#oq-02--how-verbose-should-a-search-result-be) and
  [OQ-09](#oq-09--should-price-resolution-fall-back-to-eur-when-no-usd-price-exists) are both
  live against this block.
- **Delivery-note addendum (2026-08-07).** The note above is dated 2026-08-03 and is accurate for
  that date — criterion 13 was added 2026-08-04, after it was written. Read together they mislead,
  so state it plainly: **[CAP-01](#cap-01--card-search) is delivered against criteria 1–12, and
  criterion 13 is not implemented.** The dated note is left exactly as written, per this document's
  append-only handling of dated records.
  [OQ-02](#oq-02--how-verbose-should-a-search-result-be)'s completed answer has since added a
  server-enforced page cap on top of criterion 13's trim, so that criterion is now **narrower than
  the decision it serves**; whether it is widened or a fourteenth criterion is added belongs to the
  slice that implements the trim, not here. Neither the trim nor the cap is in
  [`src/`](../src/tools/card-search.ts).

---

## 6. Phases

**Phase 1 — Card search.** [CAP-01](#cap-01--card-search) alone. **Delivered 2026-08-03.**

This document's Phase 1 is complete: the capability is built and its acceptance criteria are
verified. That is not the same as the *product* being shippable — `docs/PLUGIN-PRD.md` §6 pairs
this phase with PC-01 and PC-02, and neither of those has been built or verified. A server whose
tools nobody has installed is exactly the "shippable but not useful" state that document's §6
warns about. The remaining work is tracked in `docs/DEV-ROADMAP.md` as Tracks B and C.

This is the smallest genuinely useful version, and it is useful on its own: expressive card
search with correct prices and legality answers real deckbuilding questions with no other
capability present. It is also the right first phase for three structural reasons — it
establishes the Scryfall client, the rate-limit discipline, and the never-throw error shape
that everything else reuses; it proves the capability template in [§5](#5-capabilities); and it is the dependency
most queued capabilities build on. Phase 1 requires no credentials, no bulk-data pipeline, and
no local storage, so it validates [D-01](#d-01--distribution-local-package-over-stdio)'s install-friction claim before any heavier machinery
exists.

**Ten capabilities are queued and unassigned.** Phase assignment happens in the sessions
that specify them, not here. They are, with the dependencies already visible from [§4](#4-external-dependencies):

| Queued capability | Primary source | Notes from research |
|---|---|---|
| Combo discovery | Commander Spellbook `/find-my-combos`, `/variants/` ([§4.4](#44-commander-spellbook)) | the primitive already exists and is anonymous |
| Archidekt deck reading | Archidekt `GET /api/decks/{id}/` ([§4.5](#45-archidekt)) | works unauth; must handle the 404 masking. **First of the two platforms** ([D-13](#d-13--deck-platform-order-archidekt-first-moxfield-second)) |
| Moxfield deck reading | Moxfield `GET /v3/decks/all/{id}` ([§4.8](#48-moxfield)) | works unauth; **second** ([D-13](#d-13--deck-platform-order-archidekt-first-moxfield-second)). Payload measured at 1.63 MB, so trimming is part of the spec, not a refinement ([§4.8.1](#481-the-deck-payload-is-enormous--measured)). Shares the normalized shape — [OQ-12](#oq-12--what-is-the-normalized-deck-shape-and-does-one-tool-serve-both-platforms-or-two) |
| Arena-format decklist export | none beyond [CAP-01](#cap-01--card-search) / deck reading | pure transformation |
| Decklist pricing | Scryfall `POST /cards/collection` ([§4.1.2](#412-batch-resolution)) | 75/request; inherits [§4.1.3](#413-price-fields--three-verified-traps) price traps |
| Budget alternatives | Scryfall search + collection | depends on [CAP-01](#cap-01--card-search) and pricing |
| Archidekt deck writing | Archidekt write API ([§4.5](#45-archidekt)) | **last** per [D-09](#d-09--archidekt-writes-land-last); [OQ-04](#oq-04--what-is-the-behavior-and-blast-radius-of-archidekts-write-api) unresolved |
| Moxfield deck writing | Moxfield write API ([§4.8](#48-moxfield)) | **blocked upstream, not scheduled** ([D-15](#d-15--moxfield-writes-are-blocked-upstream-not-merely-last)) — no working third-party auth path. Unblocks via [OQ-10](#oq-10--will-moxfield-grant-this-application-approved-access-and-under-what-terms) |
| Tag discovery | Scryfall `oracle_tags` / `art_tags` bulk ([§4.3](#43-scryfall-tags-api)) | first capability needing bulk + local storage |
| Comprehensive Rules lookup | WotC CR TXT ([§4.6](#46-comprehensive-rules-wizards-of-the-coast)) | first capability needing runtime fetch + cache ([D-08](#d-08--comprehensive-rules-fetched-at-runtime-never-bundled)) |

Four observations that should inform later phase assignment. **Tag discovery and Rules lookup
are the first capabilities that require local persistence** — everything before them is
stateless request/response, so they carry setup cost the earlier ones don't. And **Archidekt
deck writing should be strictly last** ([D-09](#d-09--archidekt-writes-land-last)), after deck reading has been stable long
enough to trust.

Added 2026-08-07 with [D-13](#d-13--deck-platform-order-archidekt-first-moxfield-second): **the two deck-reading rows are one capability shape served twice, not
two independent capabilities.** Whichever is specified first sets the returned shape, which is
why the order is a locked decision rather than a scheduling detail, and why [OQ-12](#oq-12--what-is-the-normalized-deck-shape-and-does-one-tool-serve-both-platforms-or-two) has to be
answered by the *first* of them. Everything downstream of deck reading — analysis, Arena export,
deck pricing — consumes that shape and not a platform's payload, so it inherits both platforms
for free or neither.

And **the two deck-writing rows are queued for different reasons and must not be collapsed.**
Archidekt writing is deferred by choice and is buildable today; Moxfield writing is not buildable
by any means [§3.7](#37-undocumented-and-bot-protected-third-party-apis) permits. A future session that reads "both are last" and schedules them
together will discover the difference at the worst possible moment.

---

## 7. Open questions

Numbered, persistent. Questions stay here until answered — they are not dropped. Each records
what would resolve it.

### OQ-01 — How should Scryfall syntax be surfaced to the model?

[CAP-01](#cap-01--card-search) requires that Claude write good queries unprompted, which means the syntax has to be
somewhere the model reads. Candidates: a long tool description; a separate
`card_search_syntax` tool; an MCP resource. This collides with the SpellStack convention of
tool descriptions under 200 characters ([§4](#4-external-dependencies) reference notes, [D-11](#d-11--tool-naming-convention)) — that rule was written for
tools whose usage is obvious, and Scryfall syntax is the opposite case.
*Resolves by:* testing whether Claude produces correct `otag:`/regex queries with a compact
description plus a resource, versus a long description alone. This is an empirical question,
not an architectural one.

**Status 2026-08-03: half-committed, unmeasured.** The delivered `card_search` registration
takes the compact-description side of the bet — roughly five lines naming the operator families
and the pagination contract, with the deep syntax teaching left to
[PC-01](./PLUGIN-PRD.md#pc-01--scryfall-query-craft). Nothing has measured whether that split
works. The question stays open until PC-01's behavioral criteria are run; if the split fails,
what changes is the description, not the architecture.

**Status 2026-08-04: measured.** Against a without-skill baseline in fresh sessions, the two
configurations scored **identically on five of six operator families** — combined
legality/type/cost/price 3/3 vs 3/3, regex 3/3 vs 3/3, artwork 3/3 vs 3/3, card-fact-via-tool-call
3/3 vs 3/3, valid-query 15/15 vs 15/15 — and differed only on `otag:`/`function:` (3/3 vs 2/3),
where the baseline fell back to oracle-substring matching when the user named an effect the tag
vocabulary does not echo. The compact-description split **holds**: the shipped description already
names `t:`, `o:`, `f:`, `cmc`, `usd`, `otag:`, `art:` and regex by name, so the baseline is a model
handed the operator families rather than one with no syntax knowledge, and it supplies the
arguments correctly. **The description stays as shipped and no change to**
[`src/tools/register.ts`](../src/tools/register.ts) **is indicated.** The qualification worth
carrying forward: this measures that the split works, **not** that the skill carries those
families — most of what a user gets on them comes from the tool description alone, which argues
for a shorter skill body rather than a longer tool description. Evidence:
[`docs/slices/TrackB-Slice9-results.md`](./slices/TrackB-Slice9-results.md) and
[`docs/PLUGIN-PRD.md`](./PLUGIN-PRD.md) [§9](./PLUGIN-PRD.md#9-revision-log).

### OQ-02 — How verbose should a search result be?

Full oracle text plus legalities plus all prices for 175 cards is a large amount of context.
Too little and the model can't reason; too much and it crowds out the conversation.
*Resolves by:* deciding a default field set plus an opt-in verbose mode, then checking real
result payload sizes against a realistic context budget.

**Status 2026-08-03: a default field set exists; neither half of the resolution is done.** The
delivered result shape is [CAP-01](#cap-01--card-search)'s stated field list, with `legalities`
passed through **untrimmed** — every format, on every card, on every page. That was a deliberate
deferral rather than a decision, and it is the single largest contributor to payload size. There
is no verbose mode, and no payload has been measured against a context budget. A full page is 175
cards, so this is the field most likely to be trimmed when the question is actually answered.

**Status 2026-08-04: a first payload measurement exists, and it confirms the inference above.**
One [CAP-01](#cap-01--card-search) response of **111 cards measured 116,626 characters**, of which
`legalities` accounted for **54.5%** of the bytes and `oracle_text` for **25.1%**. The untrimmed
`legalities` passthrough is therefore not merely "the single largest contributor" — it is the
majority of the payload, and the two fields together are four fifths of it. Measured incidentally
during the MCPB / Chat-tab distribution work ([§9](#9-revision-log)), which hit a harness
tool-result ceiling at well under one page. **This does not resolve the question**: no field set
has been trimmed, no verbose mode exists, and a full 175-card page has still never been measured.

**Answered 2026-08-04, on the strength of that measurement: `legalities` is trimmed to the
format the query names.** When `q` names a format — `f:`, `banned:`, or `restricted:` — the
result carries that format's legality and no other. When it names none, the result carries a
small default set rather than all of them. The full map moves behind an opt-in, which is the
verbose half this question always asked for. [CAP-01](#cap-01--card-search)'s field list changes
accordingly and gains an acceptance criterion.

**Why this and not the alternatives.** A parameter the model must remember to set does not help
the call that fails, because nothing in a well-formed query predicts that its result will be too
large — the failing call asked for 111 legendary creatures, which is a *reasonable* answer set
whose payload was heavy for reasons the model could not see. A server-side cap on result size
was rejected for a different reason: it discards cards the user asked for in order to fit a
budget, which is a worse answer rather than a smaller one. Trimming `legalities` is the only
option that removes bytes nobody asked for — a commander query carrying Pioneer, Alchemy and
Predh legality for 111 cards is answering a question that was never posed. It also happens to be
the largest single lever available, at **54.5%** of the measured payload.

**What this deliberately does not settle.** `oracle_text` at 25.1% is untouched and stays that
way: it is the field the model reasons from, and [§3.6](#36-error-surface)'s prohibition on
claiming more than is known applies to card text as much as to errors. A full 175-card page is
still unmeasured, so whether the trim alone brings a full page under a realistic budget is not
known — this answers the *field set* half of the resolution and the *verbose mode* half, not the
measurement half.

**Completed 2026-08-07 — the three gaps the 2026-08-04 answer left are closed, and the third one
closed against the design rather than for it.**

1. **The default set is the seven paper constructed formats** — `standard`, `pioneer`, `modern`,
   `legacy`, `vintage`, `commander`, `pauper` — used only when the query names no format. It drops
   the sixteen a paper deckbuilder never asks after: the digital-only ladder (`historic`,
   `timeless`, `alchemy`, `gladiator`, `brawl`, `standardbrawl`, `competitivebrawl`), the niche and
   historical (`oldschool`, `premodern`, `predh`, `penny`, `duel`, `oathbreaker`,
   `paupercommander`, `tlr`), and `future`, which is not a format anyone plays. The count this
   question was framed against was wrong: Scryfall returns **23** keys, not "roughly 21"
   ([§4.1.1](#411-search-endpoint), 2026-08-07).
2. **The opt-in is an enum — `legalities: "queried" | "default" | "all"`, defaulting to
   `"queried"`.** One field with three named states maps exactly onto the three behaviors already
   decided above, which neither a `verbose` boolean nor a `fields` list can do: a boolean cannot
   express "queried", and a `fields` list is a general mechanism invented to serve one specific
   need, which invites every future field into the same negotiation.
3. **A full 175-card page was measured, and the trim alone is not enough.** It shapes to 169,504
   characters; the seven-format trim reaches 109,059 and the queried-format trim 88,953, against a
   ceiling that 116,626 characters already breached. Figures and method in
   [§4.1.1](#411-search-endpoint) (2026-08-07).

**The answer therefore carries a second lever: a server-enforced page cap near 120 cards**, on top
of the queried-format default. The two are independent and they multiply — at 508 characters per
card under the queried default, a capped response lands near 61,000 characters, roughly half the
known-bad payload. That headroom is deliberate rather than timid: per-card cost measured 969
characters on the full page against issue #25's 1,050, so it varies by at least 8% with the cards a
query happens to return, and the ceiling itself is known only as an upper bound.

**The cap reports itself, so it is a stated boundary and never a silent truncation.**
[CAP-01](#cap-01--card-search) already returns the total count and whether more results exist, so a
capped response surfaces through the existing `has_more` / `note` fields and the model can narrow
or page deliberately. This is where the 2026-08-04 answer is *extended* rather than restated: a cap
was rejected there as discarding cards the user asked for, and that objection is answered by the
cap announcing itself — the reason it is taken now is that the largest available trim has since
been measured and shown insufficient on its own. The 2026-08-04 reasoning is kept as recorded.

**Nothing is implemented.** Neither the trim nor the cap exists in `src/`, no
[CAP-01](#cap-01--card-search) acceptance criterion changed status on 2026-08-07, and issue #25
stays open.
*Resolves by:* implementing the trim and the cap with unit tests, then one live search to confirm
the shaped page against a real harness rather than a local measurement.

### OQ-03 — What is the bulk-data storage strategy, and when is it introduced?

`oracle_tags`/`art_tags` (tag discovery) and the CR text (rules lookup) both need local
persistence. Where does it live on a user's machine, what is the refresh trigger, and does
first run block on a download? Under [D-01](#d-01--distribution-local-package-over-stdio) this is an install-friction question, so it is
product-relevant, not purely design.
*Resolves by:* specifying the tag-discovery capability, which is the first to need it.

**Split 2026-08-07: the location half is answered and shipped; the other two halves stay open.**
This records what already exists rather than choosing anything new.
[`src/config.ts`](../src/config.ts) resolves `CLAUDE_PLUGIN_DATA` when it is set and non-empty,
and otherwise `%LOCALAPPDATA%\manabase` on Windows, `~/Library/Caches/manabase` on macOS, and
`$XDG_CACHE_HOME/manabase` or `~/.cache/manabase` elsewhere — read once at the entry point per
[D-03](#d-03--testability-handlers-callable-as-plain-functions) and injectable so the branches are
testable. [`docs/PLUGIN-PRD.md` §4.5](./PLUGIN-PRD.md#45-persistent-data) has recorded this as
implemented since 2026-08-04; this entry's own text had not caught up, so a session reading this
section alone would have believed the location was undecided and could have re-decided it
differently.

**Still open: the refresh trigger, and whether first run blocks on a download.** Both stay with the
capability that first needs persistence. One half of the trigger question is now settled on the
plugin side — never a `SessionStart` hook,
[`docs/PLUGIN-PRD.md` PQ-03](./PLUGIN-PRD.md#pq-03--what-triggers-a-refresh-of-the-bulk-data-and-the-comprehensive-rules-cache-and-should-it-ever-be-a-sessionstart-hook)
— which forecloses one mechanism and leaves the trigger itself unanswered here.
*Resolves by:* unchanged — the tag-discovery capability spec. It should use the
bundled-manifest-comparison pattern rather than testing for file existence, and read
`jsonl_download_uri` from the API rather than constructing bulk URLs ([§4.2](#42-scryfall-bulk-data)).

### OQ-04 — What is the behavior and blast radius of Archidekt's write API?

Unresolved and deliberately untested ([§4.5](#45-archidekt)). Specifically: does bulk import replace or
append; does it preserve categories, commander designation, companion, and maybeboard; and
what is the state of the deck after a partial failure?
*Resolves by:* authenticated testing against a disposable deck, immediately before specifying
Archidekt deck writing. Not before — [D-09](#d-09--archidekt-writes-land-last) puts this last on purpose.

### OQ-05 — Do Commander Spellbook or Archidekt impose rate limits?

Neither documents limits and neither exposes rate-limit headers ([§4.4](#44-commander-spellbook), [§4.5](#45-archidekt)). Absence of
evidence is not absence of limits.
*Resolves by:* asking the Commander Spellbook admins via their Discord (the About page
directs API questions there), and by conservative self-throttling in the meantime.

**Widened 2026-08-07: Moxfield is a third source in the same position** and is covered by this
question despite not appearing in its heading, which cannot be renamed without breaking the links
that point at it. [§4.8](#48-moxfield) found no documented limit and no rate-limit headers there either. Moxfield
differs from the other two in having a plausible channel to ask — the `User-Agent` whitelist
implies a support contact — which is [OQ-10](#oq-10--will-moxfield-grant-this-application-approved-access-and-under-what-terms). Until any of the three answers, [§3.7](#37-undocumented-and-bot-protected-third-party-apis) is the
standing rule.

### OQ-06 — Is Commander Spellbook's combo *data* licensed, as distinct from its code?

The code is MIT; the data has no stated license and there is no ToS page ([§4.4](#44-commander-spellbook)).
*Resolves by:* asking the project admins. Low urgency — the data is served anonymously by a
project that exists to distribute it, and EDHREC already consumes it.

### OQ-07 — How is `intentionallySkippedCardData` populated in Archidekt deck payloads, and what does its presence mean for a deck read?

The field exists in the response ([§4.5](#45-archidekt)) and its name implies some card data can be
deliberately absent, which would affect completeness of a deck read.
*Resolves by:* reading decks containing tokens, custom cards, and unreleased spoilers, and
observing when the field is non-empty.

### OQ-08 — Does the CR landing page ever offer more than one date-stamped TXT, and how are mid-cycle corrections handled?

URL resolution depends on scraping a single `.txt` href ([§4.6](#46-comprehensive-rules-wizards-of-the-coast)). If two versions are ever
listed, "most recent" needs a rule.
*Resolves by:* re-checking the landing page across a set release boundary.

**Half answered 2026-08-07, and the half that is answered is the weaker one.** The landing page
listed **exactly one `.txt`** that day, `MagicCompRules 20260807.txt`, recorded with the
observation's caveats in [§4.6](#46-comprehensive-rules-wizards-of-the-coast). Scraping a single
`.txt` href is correct against today's page.

**The "ever" half stays open, and the scraper must be written as though it were open.** One GET is
the weakest possible evidence for a claim about a year of behavior, so the resolver takes the most
recent `.txt` **by its date stamp**, never the first match in document order. Writing it to assume
one href on the strength of having seen one href is the failure this half-answer exists to prevent.
Mid-cycle corrections are equally untouched.
*Resolves by:* unchanged — re-checking the landing page across a set release boundary.

### OQ-09 — Should price resolution fall back to EUR when no USD price exists?

Opened 2026-08-03 by [CAP-01](#cap-01--card-search)'s acceptance pass. The delivered price
resolution is USD-only — `usd` → `usd_foil` → `usd_etched`, then `no-price-data`
([§4.1.3](#413-price-fields--three-verified-traps)). That was correct against the spec as
written, and it now returns *no price* for all three paper printings of Black Lotus, which
carry EUR prices only. The same is likely true across other Reserved List cards; only Black
Lotus was checked.

This is a question rather than a bug because the answer is not obviously yes. A result mixing
currencies without saying which is worse than no price at all, and
[D-06](#d-06--pricing-from-scryfall) framed pricing as "one number per printing" — a fallback
makes it one number *in one of two currencies*, which is a different contract. The cheap
alternative is to keep USD-only and report the reason precisely enough that the model can say
"no USD price; this card trades in EUR."
*Resolves by:* first establishing how wide the gap is — how many paper cards have `eur`
populated and `usd` null — rather than generalizing from one card. Then either extending the
price shape with an explicit currency field, or deciding the honest `no-price-data` answer is
sufficient and recording that as settled.

**Answered 2026-08-07: no EUR fallback.** Price resolution stays USD-only and
[D-06](#d-06--pricing-from-scryfall)'s one-number-per-printing contract is untouched. What changes
is the *failure*: a distinct `no-usd-price` reason carrying the EUR figure, so the model can say
"no USD price; this card trades in EUR at €11,658.96" rather than the flatly wrong "no price data".
That is the cheap alternative this question already identified, taken rather than merely noted.

**The measurement supports taking it.** At most **3,047 paper printings — 3.15% — carry no USD
price**, and EUR-only printings are a subset of that; the counts and the method are in
[§4.1.1](#411-search-endpoint) (2026-08-07). A 3% tail does not justify changing what a price
*means*. Note what a fallback would have cost beyond the contract: every downstream consumer would
have had to read a currency field before comparing two numbers, and any that forgot would compare
euros to dollars and be wrong silently. A `no-usd-price` reason cannot be misread that way, because
it is not a price.

**The measurement method this question prescribed was tested and is invalid.** `eur>=0.01
-usd>=0.01 game:paper` returns the same count as `eur>=0.01 game:paper` — the negated term is
silently dropped — and the parenthesized and `<`-form alternatives return zero matches. The 3.15%
bound above comes from subtracting non-negated counts instead. Full table in
[§4.1.1](#411-search-endpoint); that finding outlives this question and is recorded there
regardless of what happens here.

**Nothing is implemented.** [`src/scryfall/prices.ts`](../src/scryfall/prices.ts) still returns
`no-price-data`, and no [CAP-01](#cap-01--card-search) acceptance criterion changed status on
2026-08-07.
*Resolves by:* adding the `no-usd-price` variant to `resolvePrice` with unit tests over a EUR-only
fixture, and teaching [PC-01](./PLUGIN-PRD.md#pc-01--scryfall-query-craft) to report it as a
currency gap rather than as missing data.

### OQ-10 — Will Moxfield grant this application approved access, and under what terms?

Opened 2026-08-07 by [§4.8](#48-moxfield). Moxfield operates a `User-Agent` whitelist granted by support — the
only access policy it publishes anywhere — so there is a channel to ask, which is more than
[§4.5](#45-archidekt) or [§4.4](#44-commander-spellbook) offer. What is unknown is everything that matters: whether an application of
this shape and size qualifies, what terms come attached, whether a whitelist covers reads only or
is a prerequisite for the token endpoints as well, and whether approval carries a rate limit that
[OQ-05](#oq-05--do-commander-spellbook-or-archidekt-impose-rate-limits) would otherwise have to guess at.

Asking is not optional politeness — [§3.7](#37-undocumented-and-bot-protected-third-party-apis) makes it part of the capability's spec work. Note the
likely answer is narrow: reads already work unchallenged without approval, so a whitelist may
change nothing for the read capability and everything for [D-15](#d-15--moxfield-writes-are-blocked-upstream-not-merely-last). It is also possible the
answer is no, or silence — issue #143 has had no maintainer comment in eight months, so a support
channel that answers cannot be assumed.
*Resolves by:* contacting Moxfield support before Moxfield deck reading ships, describing the
application honestly — local install, 5–20 users, one deck read per user request, no
redistribution — and recording the reply verbatim here, including a non-reply after a stated
interval. A no or a silence resolves this question just as much as a yes; what it changes is
[D-15](#d-15--moxfield-writes-are-blocked-upstream-not-merely-last)'s status, not whether reads ship.

### OQ-11 — Does Moxfield mask private and unlisted decks behind the same 404 as an unknown ID?

Opened 2026-08-07 by [§4.8](#48-moxfield). An unknown deck ID returns a bare RFC 9110 404 carrying no reason
**[verified]**, but no private or unlisted deck was tested, so it is unknown whether Moxfield
collapses those cases the way [§4.5](#45-archidekt) verified Archidekt does. The two plausible answers lead to
different error text: if private decks 404 identically, the message must cover all causes without
asserting one ([§3.6](#36-error-surface)); if Moxfield distinguishes them — a 403, or a body naming the reason — then
the capability can say something genuinely more useful than the Archidekt equivalent can, and
should.

Worth stating explicitly because the tempting move is to assume parity with [§4.5](#45-archidekt) and write one
error message for both platforms. That would either over-claim on Moxfield or under-claim on
Archidekt, and the failure is silent in both directions — a user reading "this deck is private or
was deleted" has no way to tell that the tool guessed.
*Resolves by:* reading three decks the author owns on Moxfield — one public, one unlisted, one
private — as an anonymous caller, and recording all three status codes and bodies. Cheap,
three requests, and it needs an account the author already has rather than any credential the
server would ever hold.

### OQ-12 — What is the normalized deck shape, and does one tool serve both platforms or two?

Opened 2026-08-07 by [D-13](#d-13--deck-platform-order-archidekt-first-moxfield-second). Archidekt and Moxfield answer the same user question and
disagree structurally about how to say so. Commander designation is `categories: ["Commander"]`
on a card in Archidekt ([§4.5](#45-archidekt)) and a dedicated `commanders` board in Moxfield ([§4.8.1](#481-the-deck-payload-is-enormous--measured));
Moxfield has twelve fixed boards where Archidekt has free-form categories; both embed card
detail that [D-06](#d-06--pricing-from-scryfall) and [§4.1](#41-scryfall-rest-api) say should come from Scryfall instead. Whatever the tool returns
has to be one shape, because every downstream capability — deck analysis, Arena export, deck
pricing — consumes the shape rather than the platform.

Two sub-questions, and the second is the one that bites. **What does the shape contain?** The
strong candidate from [§4.8.1](#481-the-deck-payload-is-enormous--measured) is deliberately thin — name, quantity, board, finish,
`scryfall_id`, plus deck-level format and identity — with card detail resolved through [§4.1.2](#412-batch-resolution)
rather than passed through, which is smaller *and* more correct than either platform's embedded
copy. **And is it one tool or two?** [D-11](#d-11--tool-naming-convention)'s `domain_verb_noun` convention suggests
`deck_read_archidekt` and `deck_read_moxfield`, which is honest about the URL the user pastes and
costs a second tool schema in every session ([`docs/PLUGIN-PRD.md` PQ-01](./PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports)). A single
`deck_read` that dispatches on the URL's host costs one schema and hides which platform failed
when one is down.
*Resolves by:* the Archidekt deck-reading spec session, which is first per [D-13](#d-13--deck-platform-order-archidekt-first-moxfield-second) and therefore
owns this. It must answer the shape question against a real Archidekt payload while explicitly
checking each field against [§4.8.1](#481-the-deck-payload-is-enormous--measured)'s Moxfield record — designing for one platform and
discovering the second does not fit is the outcome [D-13](#d-13--deck-platform-order-archidekt-first-moxfield-second)'s ordering exists to prevent.

**Answered 2026-08-07: one tool, `deck_read`, over one thin normalized shape.** Two tools would buy
the ability to document platform-specific error behavior per schema, and that is the only thing
they buy; it is not worth a second schema, a second name to keep in sync, and a second place for
the two shapes to drift apart. Per-platform error differences — including whatever
[OQ-11](#oq-11--does-moxfield-mask-private-and-unlisted-decks-behind-the-same-404-as-an-unknown-id)
finds — are expressible in one tool's failure surface under [§3.6](#36-error-surface).

`deck_read` takes either a deck URL or an explicit platform-and-id pair, and returns:

```
{ platform, name, format, color_identity,
  cards: [ { name, quantity, board, finish, scryfall_id } ] }
```

Thin by construction: no oracle text, no prices, and no embedded card detail from either platform.
`scryfall_id` on every card is what makes that affordable — detail is reached through
[§4.1.2](#412-batch-resolution) batch lookup, which is smaller *and* more correct than either
platform's copy, since [D-06](#d-06--pricing-from-scryfall) makes Scryfall the price source.
`board` is a normalized enum spanning Archidekt's free-form categories and Moxfield's twelve fixed
boards, and it is where the structural disagreement this question names gets absorbed: commander
designation becomes `board: "commander"` whether it arrived as an Archidekt category
([§4.5](#45-archidekt)) or a Moxfield board ([§4.8.1](#481-the-deck-payload-is-enormous--measured)).

This needs **no amendment to [D-11](#d-11--tool-naming-convention)** — `deck_read` satisfies
`domain_verb_noun`, and that decision's `deck_read_archidekt` is an example rather than a mandate —
and it does not wait on
[`docs/PLUGIN-PRD.md` PQ-01](./PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports),
since one schema beats two under either answer to it.

**One piece is still missing and it is not settleable at a desk.** Archidekt's `deckFormat` is an
integer and no integer→name mapping is recorded anywhere, so a normalized string `format` needs
that table and it can only come from live data. Nothing is specified and no CAP block was written.
*Resolves by:* unchanged — the Archidekt deck-reading spec session, which owns this per
[D-13](#d-13--deck-platform-order-archidekt-first-moxfield-second) and must still discover the
`deckFormat` table.

---

## 8. Out of scope

Explicitly rejected, with reasons, so these do not resurface.

**TCGplayer direct API integration.** They no longer grant new API access, so this is not a
tradeoff being made — it is unavailable. Scryfall's TCGplayer-derived market price is the
substitute ([D-06](#d-06--pricing-from-scryfall)).

**Scraping TCGplayer.** Rejected on terms-of-service grounds and on fragility. Do not
propose it.

**Per-condition pricing, seller listings, and buylist prices.** Not obtainable from Scryfall,
which carries one number per printing per finish. This limitation is accepted ([D-06](#d-06--pricing-from-scryfall)), not a
gap to be filled elsewhere.

**Hosted deployment.** Rejected by [D-01](#d-01--distribution-local-package-over-stdio). Holding other people's credentials and being the
single point of failure for 5–20 users are both costs this project declines to take on.
Streamable HTTP as a *local* transport remains a future option ([D-05](#d-05--transport-stdio-now-streamable-http-later-no-sse)); that is a different
thing from hosting.

**SSE transport.** Deprecated in the 2025-06-18 MCP spec revision ([D-05](#d-05--transport-stdio-now-streamable-http-later-no-sse)). Work toward a dead
end.

**Embeddings / vector search for rules.** The CR is a 9,367-line structured document with
numbered rules, a regular subrule scheme, and a clean glossary ([§4.6](#46-comprehensive-rules-wizards-of-the-coast)). Rules questions are
overwhelmingly lookups by rule number, by exact term, or by keyword — all of which
structured parsing and text search answer exactly, and answer *citably*. Embeddings would add
a model dependency, an index build step, and install friction ([§3.1](#31-distribution-and-install-friction)), in exchange for fuzzy
matching over a corpus whose value depends on precise citation. Wrong tool.

**Reimplementing Scryfall's search engine locally.** The reason [D-07](#d-07--three-way-cache-split) exists. Regex, `otag:`,
`function:`, `art:`/`atag:`, and legality/price filters are server-side ([§4.1.1](#411-search-endpoint)). Rebuilding
them would be a multi-month project that stayed permanently behind Scryfall's own, in
exchange for offline search nobody asked for.

**A transport abstraction layer.** Rejected by [D-04](#d-04--no-transport-abstraction-layer). The SDK transport is already the
abstraction; an interface with one implementation is over-engineering.

**The npm `archidekt` package as a dependency.** Rejected by [D-12](#d-12--no-npm-archidekt-dependency) — seven years stale, zero
dependents, and its own README disclaims the API's stability. Its URL documentation is
transcribed into [§4.5](#45-archidekt) so it can be ignored.

**The npm `moxfield-api` package as a dependency.** Rejected by [D-14](#d-14--no-npm-moxfield-api-dependency), on different grounds
from the one above — this package is actively maintained. It covers one endpoint, sets no
`User-Agent`, throws where [D-10](#d-10--tool-handlers-never-throw) requires a returned failure, and brings `zod` for one call.
[§4.8.2](#482-the-npm-moxfield-api-package) records it so a future session does not re-evaluate it from the package page alone,
where it looks like a much better fit than it is.

**Any technique for defeating a third party's bot protection.** Rejected by [§3.7](#37-undocumented-and-bot-protected-third-party-apis): no
Cloudflare-challenge solver, no `cloudscraper`, no headless browser, no browser-impersonating or
rotating `User-Agent`, no TLS fingerprint spoofing. Named here as well as in the constraint
because a public Moxfield wrapper does exactly this and is easy to find while researching
([§4.8.2](#482-the-npm-moxfield-api-package)) — encountering it is not a discovery that this is possible, it is an encounter with a
rejected approach. This has no exception for "it is the only thing that works," which is the
form the argument will take.

**Bundling the Comprehensive Rules text in the package.** Rejected by [D-08](#d-08--comprehensive-rules-fetched-at-runtime-never-bundled) on Fan Content
Policy grounds.

**Any paywall, subscription, survey, Discord-join, or channel-follow gate on card data.**
Prohibited by Scryfall's data-use rules ([§3.3](#33-legal-and-terms-of-service)) and by the Fan Content Policy's
non-commercial terms. Not a product option.

**Deck platforms other than Archidekt and Moxfield.** ~~No other deck platform is in scope.~~
**Amended 2026-08-07 by [D-13](#d-13--deck-platform-order-archidekt-first-moxfield-second).** The
entry as originally written rejected every platform but Archidekt, and Moxfield is now in scope
as the second — read [D-13](#d-13--deck-platform-order-archidekt-first-moxfield-second) for the reasoning and the ordering. What survives unchanged is the
rejection of a *third*: Deckstats, TappedOut, MTGGoldfish, Cube Cobra and the rest are not queued
and are not to be proposed. Two platforms already cost one normalized shape ([OQ-12](#oq-12--what-is-the-normalized-deck-shape-and-does-one-tool-serve-both-platforms-or-two)) plus two
undocumented APIs to keep working, and the audience for this project overwhelmingly uses these
two.

**Writing to Moxfield, for as long as its authentication is unreachable.** Rejected by
[D-15](#d-15--moxfield-writes-are-blocked-upstream-not-merely-last) — not a scheduling call like [D-09](#d-09--archidekt-writes-land-last)'s. Listed here rather than left in the [§6](#6-phases) queue
alone because the queue entry is easy to read as "later" when the accurate reading is "not by any
means this project will use." [OQ-10](#oq-10--will-moxfield-grant-this-application-approved-access-and-under-what-terms) is the only thing that moves it.

---

## 9. Revision log

| Date | What changed | Why |
|---|---|---|
| 2026-07-29 | Document created. Established [§1](#1-overview)–[§9](#9-revision-log). Recorded 12 locked decisions ([D-01](#d-01--distribution-local-package-over-stdio)–[D-12](#d-12--no-npm-archidekt-dependency)), constraints, and seven external-dependency subsections from live research. Specified [CAP-01](#cap-01--card-search) (card search). Assigned Phase 1. Opened [OQ-01](#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model)–[OQ-08](#oq-08--does-the-cr-landing-page-ever-offer-more-than-one-date-stamped-txt-and-how-are-mid-cycle-corrections-handled). | Foundation session. Eight capabilities queued and unassigned, to be appended in later sessions using the [§5](#5-capabilities) template. |
| 2026-07-29 | **[D-07](#d-07--three-way-cache-split) revised** from a two-way cache split ("bulk for gameplay text, live API for prices") to a three-way split. | Research established that regex, `otag:`, `function:`, and `art:`/`atag:` are server-side query-engine features, not card-object fields ([§4.1.1](#411-search-endpoint)). Full Scryfall syntax — a stated [CAP-01](#cap-01--card-search) requirement — cannot be served from local bulk data. The original rationale about price staleness still holds and is preserved in the [D-07](#d-07--three-way-cache-split) row. Recorded as a revision rather than an open question so future sessions do not architect against a local search engine. |
| 2026-07-29 | Recorded that Scryfall has **no attribution requirement**, and that the attribution obligation originates in the WotC Fan Content Policy with fixed verbatim wording ([§3.3](#33-legal-and-terms-of-service), [§4.1](#41-scryfall-rest-api), [§4.7](#47-wotc-fan-content-policy)). | The pre-session assumption was that Scryfall required credit. Reading the full "Use of Scryfall Data and Images" section and the ToS "Content License" section found prohibitions but no crediting requirement. Getting the source right matters because the Fan Content Policy's wording is mandatory and not editorial. |
| 2026-07-29 | Recorded that Scryfall bulk data now exposes `jsonl_download_uri` / `compressed_size` and **no longer** `download_uri` / `size`, and serves gzipped JSONL ([§4.2](#42-scryfall-bulk-data)). | Contradicts widely-held prior knowledge of this API. Any future session writing bulk-data code from recall will use the wrong field names. |
| 2026-07-29 | Recorded three verified price-field traps and made price correctness an explicit part of [CAP-01](#cap-01--card-search) rather than a later refinement ([§4.1.3](#413-price-fields--three-verified-traps), [CAP-01](#cap-01--card-search) criteria 4–7). | `usd` is null for 7,599 foil-only cards, `eur_etched` does not exist despite being documented, and `/cards/named` can return a digital printing with all paper prices null. Each would silently produce wrong output, so each became an acceptance criterion. |
| 2026-07-29 | Recorded that Archidekt masks non-public decks as HTTP 404, indistinguishable from deleted ([§4.5](#45-archidekt), [§3.6](#36-error-surface)). | Verified against a real private deck ID. Constrains error messaging for the queued deck-reading capability: it cannot claim which cause applies. |
| 2026-07-30 | [§2](#2-locked-decisions) converted from a single table to an index table plus one `###` heading per decision ([D-01](#d-01--distribution-local-package-over-stdio)–[D-12](#d-12--no-npm-archidekt-dependency)); [§7](#7-open-questions) open questions promoted from bold leads to `###` headings; every internal `§` and ID reference converted to a markdown link. | Navigation. Several hundred references were bare text that resolved nowhere on any surface, and [§2](#2-locked-decisions)'s paragraph-length table cells were the least readable part of the document. GitHub emits no anchor for a table cell, so the decisions had no link targets until they became headings. **Presentation only — no decision was reopened, no rationale was reworded, and no ID changed.** Recorded so a future session does not read the restructure as a substantive edit. |
| 2026-08-04 | **Added `delivered` to the [§5](#5-capabilities) capability-block `Status` vocabulary** and set [CAP-01](#cap-01--card-search) to it. The template is otherwise unchanged — this extends the status enum only, and no field was added, removed, or reordered. | The template's three states describe a capability's progress through *specification* and stop at the point where it gets built, so a delivered capability could only be recorded as `specified` — which reads as "not built yet" to exactly the future session the status field exists to inform. Extending the enum was preferred over adding a parallel field because a capability has one state, not a state plus a delivery flag. |
| 2026-08-04 | **[CAP-01](#cap-01--card-search) recorded as delivered** across Track A Slices 1–6 (PRs #2–#7), and the research record reconciled against what the build found. [§4.1.1](#411-search-endpoint) gains a dated re-verification of the operator counts (the 2026-07-29 figures are kept, not overwritten). [§4.1.3](#413-price-fields--three-verified-traps) gains an addendum widening trap 3: the digital printing now wins a plain `/cards/search` rollup, not only `/cards/named`, and no paper Black Lotus printing carries USD any more. Opened **[OQ-09](#oq-09--should-price-resolution-fall-back-to-eur-when-no-usd-price-exists)** (EUR fallback). Recorded status notes on [OQ-01](#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) (compact description shipped, unmeasured) and [OQ-02](#oq-02--how-verbose-should-a-search-result-be) (default field set exists; `legalities` passes through untrimmed). | The build is the first thing to test this document's claims against reality, and it found two upstream data changes and one gap the spec did not anticipate. Recording drift as dated addenda rather than edits keeps [§4](#4-external-dependencies)'s "every claim is dated" property intact — a future session can see both what was true in July and what is true now. OQ-09 exists because the honest `no-price-data` answer for Black Lotus is correct against the spec and unsatisfying to a user, which is a specification question rather than a defect. |
| 2026-08-03 | [CAP-01](#cap-01--card-search) live acceptance pass: criteria 1–12 verified (criteria 1, 10, 11, 12 at unit level; 2–9 live via `scripts/cap01-live.mjs`). Live totals: regex 1,555, `otag:ramp` 2,274, `function:removal` 6,405, `art:squirrel` 194. Drift from the 2026-07-29 research record: (a) `!"Black Lotus"` now returns the MTGO Vintage Masters printing by default rather than a paper printing — correctly reported as `digital-only`, not a bare no-price; (b) no paper Black Lotus printing carries a USD price any more (EUR only), so criterion 6's paper-price half is evidenced by a substitute `usd>=1 game:paper` probe. No code changes were required. Results: [`docs/slices/TrackA-Slice6-results.md`](./slices/TrackA-Slice6-results.md). | Track A [Slice 6](./slices/TrackA-Slice6.md) ([`docs/DEV-ROADMAP.md`](./DEV-ROADMAP.md)) — closes the server half of Phase 1. |
| 2026-08-04 | **[§4.1.1](#411-search-endpoint) gains a dated addendum scoping the `illustrationtag:` 400**: Scryfall silently drops an unrecognized term whenever at least one recognized term remains, and the "All of your terms were ignored." 400 fires only when *every* term is invalid. Verified live during [Slice 8](./slices/TrackB-Slice8.md)'s operator verification ([`docs/slices/TrackB-Slice8-results.md`](./slices/TrackB-Slice8-results.md)), which also added twelve operators and four argument forms to the verified set by baseline comparison. The 2026-07-29 and 2026-08-03 records are kept — they were single-term or all-valid queries, where the two behaviors coincide. | The prior record read as "an invalid operator returns 400," which is true only in the single-term case; the general case is a silent wrong answer, which is the more dangerous behavior and the one [PC-01](./PLUGIN-PRD.md#pc-01--scryfall-query-craft)'s skill now teaches against. Appended as a dated addendum, not an overwrite, per [§4](#4-external-dependencies)'s every-claim-is-dated property. |
| 2026-08-04 | Linkified this row's bare [CAP-01](#cap-01--card-search), slice, and document references, and backfilled [`docs/DEV-ROADMAP.md`](./DEV-ROADMAP.md)'s bare `Slice N` prose mentions and results-document paths into markdown links down into [`docs/slices/`](./slices/). No row was added, removed, or reworded beyond adding link syntax. | The navigable-reference convention was real but unwritten, so it drifted; it is now a binding rule in `CLAUDE.md`, and this row was the one place in either PRD where it had already lapsed. **Presentation only — no decision was reopened, no rationale was reworded, and no ID changed.** |
| 2026-08-04 | **[OQ-01](#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) answered empirically.** [PC-01](./PLUGIN-PRD.md#pc-01--scryfall-query-craft)'s behavioral criteria measured with and without the `scryfall-query-craft` skill in fresh sessions — 17 cases per configuration plus 20 trigger queries, one run each, sequential. The compact `card_search` description plus the skill **is** sufficient for Claude to emit valid regex, `otag:` and `art:` queries from plain-English requests — and so is the description alone on every family but one: with/without was 3/3 vs 3/3 on regex, 3/3 vs 3/3 on artwork, 3/3 vs 3/3 on combined legality+type+cost+price, 3/3 vs 3/3 on card-fact-via-tool-call, and **3/3 vs 2/3 on `otag:`/`function:`** — the single delta. **No change to [`src/tools/register.ts`](../src/tools/register.ts)**, and therefore no rebuilt `dist/`. Results: [`docs/slices/TrackB-Slice9-results.md`](./slices/TrackB-Slice9-results.md). | Track B [Slice 9](./slices/TrackB-Slice9.md) ([`docs/DEV-ROADMAP.md`](./DEV-ROADMAP.md)) — the measurement [OQ-01](#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model)'s "resolves by" clause called for. The 2026-08-03 half-committed status is superseded by a dated result rather than overwritten. The answer is narrower than the question assumed: it vindicates the compact description by showing the description is doing most of the work on these families, which is an argument for shortening [PC-01](./PLUGIN-PRD.md#pc-01--scryfall-query-craft)'s body rather than for growing a schema that is paid for in every session forever ([PQ-01](./PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports)). |
| 2026-08-04 | **[§4.1.1](#411-search-endpoint) gains a dated addendum pinning regex anchor semantics.** Scryfall evaluates `o:/…/` in multi-line mode: `^` and `$` bind to a line of `oracle_text`, not to the card. Measured live — `o:/^whenever you cast/` 849 cards versus 361 once newline-preceded matches are excluded, so 488 matched on a non-initial line. The stricter escapes are unavailable and **fail in two different ways**: `\z` and `(?-m:^…)` return HTTP 400, while **`\A` returns a well-formed HTTP 200 with `total_cards: 0`** — a silent wrong answer of the same class as the dropped-term behavior recorded in the addendum above. Surfaced by [Slice 9](./slices/TrackB-Slice9.md) ([`docs/slices/TrackB-Slice9-results.md`](./slices/TrackB-Slice9-results.md)) and re-verified with four confirmatory calls before recording. The regex counts in the existing rows stand — they were always line-anchored counts. | The document's regex rows recorded that regex *works* and never what its anchors *mean*, so "starts with" read as whole-text when it is per-line, and every session that wanted a true text-box anchor rediscovered this at the cost of a wasted call. Appended as a dated addendum rather than an edit, per [§4](#4-external-dependencies)'s every-claim-is-dated property. The `\A` asymmetry is the reason this needed recording at all: a 400 teaches the model to retry, a zero-match 200 teaches it to report "no cards match" and stop. |
| 2026-08-04 | **[OQ-02](#oq-02--how-verbose-should-a-search-result-be) gains a dated status note carrying its first payload measurement — and stays open.** One [CAP-01](#cap-01--card-search) response of 111 cards measured 116,626 characters, `legalities` 54.5% of the bytes and `oracle_text` 25.1%, which confirms the 2026-08-03 note's inference that untrimmed `legalities` is the largest contributor and sharpens it to *the majority*. No field set was trimmed, no verbose mode was added, and no 175-card page was measured, so nothing here answers the question's "resolves by" clause. Nothing else in this document changed: [§3.4](#34-rate-limits-are-hard-constraints-not-guidance) is now cited from [`docs/PLUGIN-PRD.md` §8](./PLUGIN-PRD.md#8-out-of-scope) as the reason a hosted remote MCP server is rejected, and that citation needs no edit here — the constraint it relies on is already stated. | The MCPB / Chat-tab distribution work, 2026-08-04 ([`docs/PLUGIN-PRD.md` P-14](./PLUGIN-PRD.md#p-14--two-distribution-targets-one-source), [PC-03](./PLUGIN-PRD.md#pc-03--mcpb-bundle-for-the-chat-tab)) — an unplanned session outside [`docs/DEV-ROADMAP.md`](./DEV-ROADMAP.md)'s slice sequence. The measurement is recorded because it arrived as a **user-visible failure** rather than as an experiment: `card_search` payloads exceeded the harness's tool-result ceiling below one page (issue #25, open and unfixed). That makes verbosity a delivery constraint and not only a context-budget preference, which is a fact this question was framed without. It is filed as a status note rather than an answer because a measurement is evidence, and [OQ-02](#oq-02--how-verbose-should-a-search-result-be) asks for a decision. |
| 2026-08-04 | **[OQ-02](#oq-02--how-verbose-should-a-search-result-be) answered: `legalities` is trimmed to the format the query names, with the full map behind an opt-in.** [CAP-01](#cap-01--card-search)'s field list is amended and it gains acceptance criterion 13 — a query naming a format returns that format's legality and no other; a query naming none returns a small default set. Taken on the strength of the same-day measurement in the row above: `legalities` was **54.5%** of a 116,626-character response covering 111 cards. Two alternatives are recorded as rejected. A `fields`/`verbose` parameter the model sets per call does not help the call that fails, because nothing in a well-formed query predicts an oversized result — the failing call asked for 111 legendary creatures, a reasonable answer set whose payload was heavy for reasons invisible at query time. A server-side result cap was rejected because it discards cards the user asked for, producing a worse answer rather than a smaller one. `oracle_text` at 25.1% is deliberately untouched. Unresolved and stated as such in [OQ-02](#oq-02--how-verbose-should-a-search-result-be): a full 175-card page has still never been measured, so whether the trim brings one under a realistic budget is unknown. | This is the only lever that removes bytes **nobody asked for**. A commander query returning Pioneer, Alchemy and Predh legality for every card is answering a question that was never posed, whereas trimming `oracle_text` would remove what the model reasons from. The decision was possible now and not before because [OQ-02](#oq-02--how-verbose-should-a-search-result-be) required a measurement against a real budget, and it finally arrived as a user-visible failure rather than as an estimate — the payload exceeded a harness tool-result ceiling at well under one page, and the recovery available in Claude Code was a shell and `jq`, which the Claude Desktop Chat tab does not have. Verbosity had been framed as crowding out a conversation; on a surface with no shell it makes a well-formed query simply unanswerable. Issue #25 stays open until the trim ships. |
| 2026-08-07 | **Moxfield adopted as a second deck platform, behind Archidekt.** Three decisions added — [D-13](#d-13--deck-platform-order-archidekt-first-moxfield-second) (Archidekt first, Moxfield second; both in scope, neither blocking the other), [D-14](#d-14--no-npm-moxfield-api-dependency) (no npm `moxfield-api` dependency), [D-15](#d-15--moxfield-writes-are-blocked-upstream-not-merely-last) (Moxfield writes blocked upstream, not merely last). New [§4.8](#48-moxfield) research record with subsections [§4.8.1](#481-the-deck-payload-is-enormous--measured) (payload measurement) and [§4.8.2](#482-the-npm-moxfield-api-package) (the npm package). New constraint [§3.7](#37-undocumented-and-bot-protected-third-party-apis) governing undocumented and bot-protected APIs, covering Archidekt as well as Moxfield. [§6](#6-phases) gains two queued rows (eight capabilities → ten) and two observations. [§7](#7-open-questions) gains [OQ-10](#oq-10--will-moxfield-grant-this-application-approved-access-and-under-what-terms)–[OQ-12](#oq-12--what-is-the-normalized-deck-shape-and-does-one-tool-serve-both-platforms-or-two); [OQ-05](#oq-05--do-commander-spellbook-or-archidekt-impose-rate-limits) widened by note to cover Moxfield without renaming its heading. [D-09](#d-09--archidekt-writes-land-last) scoped by note to Archidekt specifically. [§3.6](#36-error-surface) gains Moxfield's 404 finding. [§8](#8-out-of-scope) amended — see the row below. **No capability was specified and no phase was assigned**; [CAP-01](#cap-01--card-search) is untouched, as is every existing decision's rationale. | Requested directly: add Moxfield alongside Archidekt, Archidekt first because the author uses it. Queued at parity with Archidekt rather than specified, because Archidekt deck reading is itself only a [§6](#6-phases) row — writing CAP blocks for Moxfield would specify it *ahead* of the platform [D-13](#d-13--deck-platform-order-archidekt-first-moxfield-second) puts first, and [§5](#5-capabilities) requires a CAP block be precise enough to build against. Research was done live, per [§3.7](#37-undocumented-and-bot-protected-third-party-apis)'s own rule: three single spaced requests with an honest `User-Agent`, no authentication attempted. |
| 2026-08-07 | **[§8](#8-out-of-scope)'s "Deck editing outside Archidekt" entry amended** — its "no other deck platform is in scope" claim is struck and superseded by [D-13](#d-13--deck-platform-order-archidekt-first-moxfield-second), with the rejection of a *third* platform preserved and named. Two entries added: the npm `moxfield-api` package, and any technique for defeating bot protection. | The entry became false the moment Moxfield was adopted, and a stale rejection in [§8](#8-out-of-scope) is worse than none — the section exists so rejected ideas do not resurface, which means a future session is entitled to treat it as current. Struck rather than deleted so the change is visible as a reversal. The bot-protection entry is listed in [§8](#8-out-of-scope) as well as [§3.7](#37-undocumented-and-bot-protected-third-party-apis) because a working `cloudscraper`-based wrapper is one search result away from anyone researching this API, and it needs to read as rejected rather than as available. |
| 2026-08-07 | **The Moxfield deck payload measured at 1,629,429 bytes for one deck** — `boards` 61.2%, `tokens` 18.2%, `tokenMappings` 15.4%, one card entry ~3,959 bytes ([§4.8.1](#481-the-deck-payload-is-enormous--measured)). Recorded against [OQ-02](#oq-02--how-verbose-should-a-search-result-be)'s 116,626-character ceiling finding, which it exceeds by roughly fourteen times. [OQ-02](#oq-02--how-verbose-should-a-search-result-be) itself is **not** reopened and its answer is unchanged. | The measurement is the reason Moxfield deck reading cannot be specified as a passthrough, and it was available for the cost of one request, so it belongs in the record before the spec session rather than after it. It changes the starting position rather than a decision: [CAP-01](#cap-01--card-search) discovered its verbosity problem after delivery and paid for it with issue #25, and this is the same problem visible in advance. Every card carrying `scryfall_id` is what makes the trim obvious — the payload can be reduced to identifiers and resolved through [§4.1.2](#412-batch-resolution), which is both smaller and more correct than Moxfield's embedded copy, since [D-06](#d-06--pricing-from-scryfall) makes Scryfall the price source. |
| 2026-08-07 | **[§4.1.1](#411-search-endpoint) gains three dated addenda and [§4.6](#46-comprehensive-rules-wizards-of-the-coast) one.** (a) **A negated numeric comparison is unusable and fails silently in two different ways** — a bare `-usd>=0.01` is dropped, returning HTTP 200 with a count identical to the baseline, while `-(usd>=0.01)` and `usd<0.01` return zero matches, so **Scryfall's syntax cannot express "this field is null."** The usable bound comes from subtracting non-negated counts instead: 96,709 − 93,662 = **3,047 paper printings, 3.15%**, carry no USD price. (b) **A full 175-card page measures 169,504 characters** through the delivered shaping — `legalities` 49.7%, `oracle_text` 17.3% — against the 116,626 that already breached a harness tool-result ceiling; the seven-format trim reaches 109,059 and the queried-format trim 88,953. (c) **Scryfall returns 23 legality keys, not "roughly 21"**, listed in full. (d) The Comprehensive Rules landing page listed **exactly one `.txt`** that day, `MagicCompRules 20260807.txt`, and the 2026-07-29 record's `20260619` file has turned over. | A desk session settling open questions, which **implemented nothing** — see the rows below. Each measurement outlives the question that prompted it, which is why it is filed here rather than only in a [§7](#7-open-questions) entry. (a) is a third member of the silent-wrong-answer family this section already carries, alongside the dropped invalid term and the `\A` zero-match regex trap, and trusting the bare negated form would have reported that 96% of paper printings lack a USD price. (b) is the measurement [OQ-02](#oq-02--how-verbose-should-a-search-result-be) had asked for since 2026-08-03 and never had, and it **refutes the trim as sufficient** rather than confirming it. (c) corrects a count that had only ever been an estimate. All four appended as dated addenda, per [§4](#4-external-dependencies)'s every-claim-is-dated property — nothing already recorded there was edited, including the superseded `20260619` filename. |
| 2026-08-07 | **[OQ-02](#oq-02--how-verbose-should-a-search-result-be) completed — both levers.** The 2026-08-04 answer's three open gaps are closed: the small default set is the **seven paper constructed formats** (`standard`, `pioneer`, `modern`, `legacy`, `vintage`, `commander`, `pauper`), used only when the query names none; the opt-in is an enum, **`legalities: "queried" \| "default" \| "all"`, defaulting to `"queried"`**; and a full 175-card page was measured. The measurement closed the third gap **against** the design, so the answer gains a second lever the 2026-08-04 entry did not anticipate: a **server-enforced page cap near 120 cards**, surfaced through [CAP-01](#cap-01--card-search)'s existing `has_more` / `note` fields so it is a stated boundary and never a silent truncation. **Nothing was implemented and no [CAP-01](#cap-01--card-search) acceptance criterion changed status**; issue #25 stays open. | The 2026-08-04 answer rejected a server-side cap for discarding cards the user asked for, and that objection is answered by the cap announcing itself rather than by the objection being wrong — what changed is the evidence: the largest available trim has now been measured and lands in the same order of magnitude as a payload that already failed, so the trim cannot be the whole answer. The enum was preferred over the two alternatives this question named because the three behaviors were already decided and one field with three named states expresses exactly them: a `verbose` boolean cannot express "queried", and a `fields` list is a general mechanism invented for one need that then invites every future field into the same negotiation. **Raised for this document's owner and deliberately not resolved here:** [CAP-01](#cap-01--card-search)'s delivery note reads "All twelve acceptance criteria are verified" while the block carries thirteen, and this answer adds a page cap on top of criterion 13's trim — the note, the criteria list, and [§5](#5-capabilities) are untouched by this row. |
| 2026-08-07 | **[OQ-03](#oq-03--what-is-the-bulk-data-storage-strategy-and-when-is-it-introduced) split: the location half is recorded as answered and shipped; the refresh trigger and the first-run question stay open.** Nothing new was chosen — [`src/config.ts`](../src/config.ts) has implemented the `CLAUDE_PLUGIN_DATA`-else-platform-cache rule since [Slice 1](./slices/TrackA-Slice1.md), and [`docs/PLUGIN-PRD.md` §4.5](./PLUGIN-PRD.md#45-persistent-data) has recorded it as implemented since 2026-08-04. | This entry's text was unchanged from its original wording, so the two documents disagreed about whether a decision existed: a session reading this [§7](#7-open-questions) alone would have believed the cache location was undecided and could have re-decided it differently from what ships. Recorded as a split rather than an answer because two thirds of the question genuinely remain, and they stay with the capability that first needs persistence. |
| 2026-08-07 | **[OQ-08](#oq-08--does-the-cr-landing-page-ever-offer-more-than-one-date-stamped-txt-and-how-are-mid-cycle-corrections-handled) half answered.** Exactly one `.txt` was listed on 2026-08-07 ([§4.6](#46-comprehensive-rules-wizards-of-the-coast)), so scraping a single href is correct against today's page. The "ever" half and mid-cycle corrections stay open, and the entry now **binds the scraper to a most-recent-by-date rule rather than a first match**. | One GET is the weakest possible evidence for a claim about a year of behavior. The recorded half is therefore paired with an explicit constraint on the implementation, because the failure this question exists to prevent is a scraper written to assume one href on the strength of having seen one href — and that failure would be silent, returning a stale rules file rather than an error. |
| 2026-08-07 | **[OQ-09](#oq-09--should-price-resolution-fall-back-to-eur-when-no-usd-price-exists) answered: no EUR fallback.** Resolution stays USD-only and [D-06](#d-06--pricing-from-scryfall)'s one-number-per-printing contract is untouched. What changes is the failure — a distinct **`no-usd-price`** reason carrying the EUR figure, so the model reports a currency gap instead of the flatly wrong "no price data". Bounded at **at most 3,047 paper printings, 3.15%** ([§4.1.1](#411-search-endpoint)). This question's own prescribed measurement method is recorded as **invalid**: the negated term it depends on is silently dropped. **Not implemented** — [`src/scryfall/prices.ts`](../src/scryfall/prices.ts) is unchanged and no [CAP-01](#cap-01--card-search) criterion changed status. | A 3% tail does not justify changing what a price *means*. The fallback's real cost is downstream and silent: every consumer would have to read a currency field before comparing two numbers, and any that forgot would compare euros to dollars and be wrong with no signal — whereas a `no-usd-price` reason cannot be misread as a price, because it is not one. Recording the prescribed method as invalid matters as much as the verdict: a later session re-checking the bound would otherwise re-run the same negated query and get the same confidently wrong 96%. |
| 2026-08-07 | **[OQ-12](#oq-12--what-is-the-normalized-deck-shape-and-does-one-tool-serve-both-platforms-or-two) answered: one tool, `deck_read`, over one thin normalized shape** — `{ platform, name, format, color_identity, cards: [{ name, quantity, board, finish, scryfall_id }] }`, with `board` a normalized enum spanning Archidekt's free-form categories and Moxfield's twelve fixed boards, and card detail reached through [§4.1.2](#412-batch-resolution) rather than passed through. **No amendment to [D-11](#d-11--tool-naming-convention)** is needed and it does not wait on [`docs/PLUGIN-PRD.md` PQ-01](./PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports). **No CAP block was written and nothing is specified**; Archidekt's `deckFormat` integer→name table is still missing and still needs live data. | Two tools buy exactly one thing — per-schema documentation of platform-specific error behavior — which one tool's failure surface can express anyway under [§3.6](#36-error-surface), and they cost a second schema, a second name to keep in sync, and a second place for the shapes to drift apart. The shape is settled ahead of the spec session rather than by it because every downstream capability consumes the shape rather than the platform, and [D-13](#d-13--deck-platform-order-archidekt-first-moxfield-second)'s ordering exists precisely to stop the first platform's payload from becoming the shape by default. This is a decision, not a specification: the Archidekt spec session still owns the CAP block and must check each field above against [§4.8.1](#481-the-deck-payload-is-enormous--measured)'s Moxfield record. |

---

*Manabase MTG MCP Server is unofficial Fan Content permitted under the Fan Content Policy.
Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of
the Coast. ©Wizards of the Coast LLC. Card data and prices via
[Scryfall](https://scryfall.com). Combo data via
[Commander Spellbook](https://commanderspellbook.com).*
