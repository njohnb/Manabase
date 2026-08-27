# MTG MCP Server — PRD

> **Reading this cold?** Sections 2 and 3 are binding. Section 4 is the research record —
> every claim there is dated and marked verified or inferred. Section 5 opens with the
> capability template; adding a capability means appending a CAP block and updating
> sections 6, 7, and 9. Nothing else.

**Document status:** foundation established 2026-07-29. **Two capabilities specified, one of them
built.** The first ([CAP-01](#cap-01--card-search)) is
**delivered against criteria 1–14** ([§9](#9-revision-log)):
1–12 on 2026-08-03, then criterion 13 (the `legalities` trim) and a new criterion 14 (the page cap)
on 2026-08-10, when [Slice 14](./slices/TrackA-Slice14.md) implemented both of
[OQ-02](#oq-02--how-verbose-should-a-search-result-be)'s levers and closed that question. **A
criterion 15 was added 2026-08-11 and is not implemented** — opt-in card images, answering
[OQ-13](#oq-13--should-a-card-search-result-carry-image-uris-and-at-what-cost); the block therefore
carries fifteen criteria and is delivered against fourteen. **A second capability was specified
2026-08-24 and is not built** — [CAP-02](#cap-02--combo-discovery), combo discovery, assigned
Phase 2. **Its first build slice landed 2026-08-25** ([Slice 15](./slices/TrackA-Slice15.md)): the
shared transport and a POST verb, no tool — criteria 11 and 12 and the client half of 3 are
verified, and the capability is still not built. **Its second landed the same day**
([Slice 16](./slices/TrackA-Slice16.md)): the `combo_search` tool and the normalized combo shape,
adding criteria 2, 6 and 7, criterion 3's handler half, and the `combo_search` half of 1, 8 and 14
— **`Status` is still `specified` and no criterion is marked delivered**, because the capability is
delivered when [Slice 17](./slices/TrackA-Slice17.md) lands `combo_find_deck`. Nine capabilities
queued and unassigned — two of them added 2026-08-07 when Moxfield joined Archidekt as a deck
platform ([D-13](#d-13--deck-platform-order-archidekt-first-moxfield-second), [§4.8](#48-moxfield)).

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
| [D-16](#d-16--no-npm-commander-spellbook-client-dependency) | No dependency on the npm `@space-cow-media/spellbook-client` package. Use the in-house HTTP client | 2026-08-24 |

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

### D-16 — No npm Commander Spellbook client dependency

**Decided 2026-08-24.**

**No dependency on the npm `@space-cow-media/spellbook-client` package.** Use the in-house HTTP
client, the same as [D-12](#d-12--no-npm-archidekt-dependency) and
[D-14](#d-14--no-npm-moxfield-api-dependency) decided for Archidekt and Moxfield — **but for
different reasons, and this package clears bars those two failed.** It is recorded as a decision
precisely because it is the strongest third-party client this project has evaluated, and a future
session reading the npm page alone would reasonably reach for it.

**What it clears. [verified 2026-08-24]** v6.2.6, **first-party** — published by SpaceCowMedia
from `SpaceCowMedia/commander-spellbook-backend`, generated from Commander Spellbook's own OpenAPI
schema. MIT, **zero runtime dependencies and zero peer dependencies**, version-locked to the live
API (the package version matches the API version exactly), 152 versions with the latest published
2026-08-23. Its `Configuration` accepts **`headers`**, so the app-naming `User-Agent`
[§3.7](#37-undocumented-and-bot-protected-third-party-apis) requires can be set — the one thing
[D-14](#d-14--no-npm-moxfield-api-dependency) found `moxfield-api` could not do — and accepts an
injectable **`fetchApi`**, which satisfies [D-03](#d-03--testability-handlers-callable-as-plain-functions)
directly. **Four of [D-14](#d-14--no-npm-moxfield-api-dependency)'s five objections do not apply.**

It still does not earn the dependency, on grounds particular to this codebase:

- **It would not replace the in-house client; it would add a second idiom beside it.** This is the
  decisive reason and it is structural rather than stylistic.
  [CAP-02](#cap-02--combo-discovery) resolves card names through
  [§4.1.2](#412-batch-resolution) on Scryfall, which no Commander Spellbook package serves, so the
  in-house transport is built regardless — and Archidekt ([§4.5](#45-archidekt)) and Moxfield
  ([§4.8](#48-moxfield)) have no first-party package at all. Adopting it means one source of three
  speaking a different error model, a different throttle, and a different test harness,
  permanently.
- **[§3.4](#34-rate-limits-are-hard-constraints-not-guidance)'s rate-limit lane cannot be reused
  through it.** The lane is not a per-request delay but a queue with an enqueue-before-await
  prefix, a stamp-before-fetch rule, a restamp-after-backoff rule, and a 30-second lockout written
  into shared state on a persisted 429. Rebuilding that inside the package's `middleware` hook is
  a second copy of the subtlest code in this repo; injecting the existing client through
  `fetchApi` inverts the layering, wrapping a returning client inside a throwing one.
- **Its error model is the opposite of [D-10](#d-10--tool-handlers-never-throw)'s**, exactly as
  [D-14](#d-14--no-npm-moxfield-api-dependency) found. It throws `ResponseError` on any non-2xx,
  and that error carries the **raw unread `Response`** — so recovering Commander Spellbook's
  positional 400 text ([§4.4](#44-commander-spellbook)) means an `await` on the body inside a
  catch, with its own failure mode when the body is unparseable.
- **Its generated variant type declares the fields
  [CAP-02](#cap-02--combo-discovery) is forbidden to return.** The hand-written shapes omit
  `prices` and every `imageUri*` field, which makes criteria 6 and 7 unviolatable at compile time
  rather than merely tested — the same discipline that keeps `eur_etched` out of
  [§4.1.3](#413-price-fields--three-verified-traps)'s model. A generated type carries all of them,
  because it is generated from a schema that has them. **This also rules out the one genuinely
  attractive middle path**: adopting the package as a *type-only* devDependency, which under
  `verbatimModuleSyntax` would cost zero bundle bytes and no runtime dependency, and which neither
  [D-12](#d-12--no-npm-archidekt-dependency) nor [D-14](#d-14--no-npm-moxfield-api-dependency) had
  available.
- **Bundle cost was not measured.** 1,434,296 bytes across 562 files, generated for all 32 API
  paths where two are used. esbuild tree-shakes ESM and it may shake down to very little — that is
  **recorded as unmeasured rather than asserted in either direction**. What makes the unknown
  expensive is the asymmetry already in this project: `dist/index.js` is 562,952 bytes and the
  released bundle 113,631, the MCP SDK is deliberately a devDependency to keep it small, and
  [`docs/PLUGIN-PRD.md` PQ-06](./PLUGIN-PRD.md#pq-06--what-keeps-the-committed-dist-honest) records
  that a released bundle never self-updates — so a regression ships and every install carries it
  until someone reinstalls. **The other four objections carry this decision on their own; this
  fifth one is stated as open.**

Its genuine value, exactly as with the other two packages, is as **documentation of request and
response shapes** — and that is transcribed into [§4.4](#44-commander-spellbook) and
[§4.4.1](#441-the-combo-payload-is-enormous--measured) so the package can be ignored entirely.

**What would reopen this.** The package returning results instead of throwing, or a second
Commander Spellbook capability large enough that 32 generated endpoints stop being surface area
and start being coverage.

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

**Addendum — five operators name a format, not three; and paginating past the end is a 422, not a
404. [verified 2026-08-10]** Measured while implementing
[OQ-02](#oq-02--how-verbose-should-a-search-result-be)'s trim, with single spaced calls
([§3.4](#34-rate-limits-are-hard-constraints-not-guidance)).

- **`format:` and `legal:` are real, and are synonyms for `f:`.** Against a two-card baseline of
  modern-illegal cards, both `legal:modern` and `format:modern` returned **0**, so each filtered
  rather than being silently dropped the way an unknown term is. The full list a format scan must
  match is therefore `f:`, `format:`, `legal:`, `banned:`, `restricted:` — the skill's
  `reference/operators.md` had recorded only three.
- **A format alias is accepted as a value but is not a legality key.** `f:edh` returns
  commander-legal cards, yet `edh` appears in no card's `legalities` map. A scanner that treats a
  scanned token as a key would produce an **empty** legalities map from a perfectly good query —
  a normal-looking 200 carrying a wrong answer, the same class as the `\A` trap above. This is why
  the trim falls back to the default set on a miss rather than trimming to nothing.
- **A page past the end returns HTTP 422**, with `details` reading "You have paginated beyond the
  end of these results…". It is *not* the 404 that zero matches returns, so it does not reach the
  404-as-empty mapping — but it does fall through the client's status table to `unexpected`, a code
  that reads as a server fault and discourages the retry that would fix it.
  [CAP-01](#cap-01--card-search) re-codes it as `bad_request` at the handler.

**Critical architectural fact.** These operators are evaluated **server-side**. They are not
fields on the card object and cannot be reproduced from bulk data without reimplementing
Scryfall's query engine. This is the fact behind [D-07](#d-07--three-way-cache-split). **[verified]**

#### 4.1.2 Batch resolution

`POST /cards/collection` — 2/second, **maximum 75 card references per request**,
`Content-Type: application/json`. Identifiers accept `id`, `oracle_id`, `mtgo_id`,
`multiverse_id`, `illustration_id`, `name`, or `set` + `collector_number`. **[verified]**

This is the pricing primitive: a 100-card decklist is 2 requests, ~1 second. Any queued
capability that prices a list should use this, never a loop over `/cards/named`.

**Addendum — a `name` identifier REJECTS the combined `Front // Back` form of a double-faced card,
and accepts either face name alone. [verified 2026-08-25]** Found by
[Slice 17](./slices/TrackA-Slice17.md)'s live run: four real cards in a 100-card deck landed in
`not_found` beside one deliberately invented name. A spaced follow-up probe isolated it — five
identifiers submitted, four cards returned in `data`, and `not_found` carrying exactly
`{"name":"Hengegate Pathway // Mistgate Pathway"}`, while both `Hengegate Pathway` and
`Mistgate Pathway` submitted alone each resolved to that same full card.

**The asymmetry is the trap, because a reader will assume parity and be wrong.** A card object's
own `name` field **is** the combined form, and [§4.1.1](#411-search-endpoint)'s search endpoint
accepts it; only this batch lookup refuses it. So a decklist pasted from a deck platform — where
the combined form is the ordinary export spelling — reports several real cards as unresolved.

That is loud rather than silent, which is the direction this document prefers, and
[CAP-02](#cap-02--combo-discovery) deliberately does **not** work around it: splitting `A // B` in a
handler is decklist parsing, and the names still go upstream as submitted so nothing is lost. What
it threatens is the honesty of the report — a caller reading "unresolved" as "typo" claims more
than the response establishes ([§3.6](#36-error-surface)) — so the remedy is to tell the model to
submit one face name, which `combo_find_deck`'s tool description now does.

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

#### 4.1.4 Card image URIs

**Date verified:** 2026-08-11. Researched for
[OQ-13](#oq-13--should-a-card-search-result-carry-image-uris-and-at-what-cost); two of the facts
below were carried as `[inferred]` by
[`docs/PLUGIN-PRD.md` PQ-10](./PLUGIN-PRD.md#pq-10--does-cap-01-gain-an-image-uri-and-what-does-that-cost)
because `scryfall.com`'s documentation pages returned HTTP 403 to an honestly identified fetcher
that day. They are verified here against the API itself, which answered normally — the block was
on the docs site, not the API, and [§3.7](#37-undocumented-and-bot-protected-third-party-apis) was
not tested by either.

**Images are served from `cards.scryfall.io`, which [§3.4](#34-rate-limits-are-hard-constraints-not-guidance)
rates unlimited.** This is the fact that makes an image URI cheap and a card `id` expensive: a
consumer holding a URI fetches from a file origin with no rate limit, while a consumer holding an
identifier must call `/cards/{id}` — the **2/second** lane — to turn it into one. **[verified]**

**`image_uris` carries eleven keys, not the six the documentation lists.** **[verified]** Live on
`Sol Ring` (`msc/211`): the documented `small`, `normal`, `large`, `png`, `art_crop`,
`border_crop`, plus five undocumented webp variants — `thumb`, `grid`, `display`, `art`, `crop`.
Do not model the undocumented five. They are recorded so a future session does not read their
presence as evidence the documentation is being tracked; this is the same class of
documentation/reality gap as `eur_etched` in [§4.1.3](#413-price-fields--three-verified-traps),
inverted — there a documented field does not exist, here five undocumented ones do.

**`image_uris` is absent at the top level on a multi-faced card and sits on each `card_faces`
entry instead.** **[verified]** Confirmed on
`Delver of Secrets // Insectile Aberration` (`inr/60`), where the top-level key is missing
entirely and both faces carry a full eleven-key object of their own. A consumer that reads
`card.image_uris.normal` unconditionally therefore gets `undefined` for every transform card and
must fall back to `card_faces`, not the other way round. Measured over one live 175-card page of
`f:commander t:creature` (2026-08-11): **169 cards carried top-level `image_uris`, 6 carried
faces-only, and 0 carried none** — so 175 cards need **181** image URLs. Layouts present were
`normal` 167, `transform` 6, and `prepare` 2, the last an undocumented layout that carries
top-level images normally.

**A `normal` URI is 93–94 characters and its length does not vary with the card.** **[verified]**
The path is composed entirely from the printing's `id`, so nothing about a card's name, set, or
text moves it.

**The `?timestamp` query parameter is optional and the URL is derivable from the `id`.**
**[verified]** `https://cards.scryfall.io/normal/front/9/1/<id>.jpg` and the same URL with
`?1783903215` both returned HTTP 200 with a byte-identical 71,336-byte JPEG, and a double-faced
card's second face is the *same* `id` under `back/` rather than a different identifier. A wrong
face path is not silent: `back/` on a single-faced card returns HTTP **404** with an HTML body.
**Recorded as an observation and deliberately not relied on** — Scryfall publishes the URIs so
that it can change how they are composed, and a client that assembles them instead is betting on
an undocumented scheme whose breakage would look like every card image failing at once. It is
recorded because it is the reason returning a bare `id` is not the cheap option it appears to be:
the byte saving is real and it buys a hardcoded URL template.

**`purchase_uris` carries exactly three keys** — `tcgplayer`, `cardmarket`, `cardhoarder` — each a
referral-tagged URL. **[verified]** Identical key set on both cards sampled. Adjacent and distinct:
`related_uris`, whose key set is **not** fixed (`gatherer` was present on one sample and absent on
the other). Nothing in this document consumes either field; they are recorded because
[`docs/PLUGIN-PRD.md` PQ-10](./PLUGIN-PRD.md#pq-10--does-cap-01-gain-an-image-uri-and-what-does-that-cost)
asked for the key set and because [D-06](#d-06--pricing-from-scryfall) makes the pricing
relationship with TCGplayer worth stating: these are Scryfall's referral links, and passing one on
means passing it **byte for byte** or not at all.

**Method.** Four requests total, spaced, with an app-naming `User-Agent` and an `Accept` header
([§3.4](#34-rate-limits-are-hard-constraints-not-guidance)): two `/cards/named` and one
`/cards/search` on the 2/second lane, and three `HEAD`-equivalent image fetches on the unlimited
file origin. No 429.

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

**Addendum — the API is on version 6.2.6, and the endpoint shapes are recorded for the first
time. [verified 2026-08-24]** Researched for [CAP-02](#cap-02--combo-discovery). The 2026-07-29
record above is accurate for its date and its conclusions are unchanged — anonymous access works,
`/find-my-combos` is the discovery primitive, `variants.json` stays rejected at 606 MB. What it
does not carry is any request or response shape, and a capability cannot be specified against a
list of endpoint names.

`/schema/` reports **API version 6.2.6** against the 5.7.5 recorded above, and **32 paths**
against 31. Three are new to this record: `/card-list-from-text`, `/explain-query`, and
`/properties/`. **[verified]**

**`/find-my-combos` accepts both `GET` and `POST`.** The `POST` body is a `DeckRequest` —
`{ main: [{ card, quantity }], commanders: [{ card, quantity }] }`, capped at **600 main and 12
commanders** — as `application/json`, or a plain decklist as `text/plain`. Query parameters are
`count`, `limit`, `offset`, `ordering`, `q`, `groupByCombo`, `variant`. **[verified]**

**The response's `results` is an object of six buckets, not a list.** `included`,
`includedByChangingCommanders`, `almostIncluded`, `almostIncludedByAddingColors`,
`almostIncludedByChangingCommanders`, `almostIncludedByAddingColorsAndChangingCommanders`, plus a
top-level `identity`. Only the first two name combos the deck actually contains; the other four
are near-misses. **[verified]** What that costs is [§4.4.1](#441-the-combo-payload-is-enormous--measured).

**Addendum — three behaviors that decide the shape of any combo capability.
[verified 2026-08-24]** Two of them are new members of the silent-wrong-answer family this
document already carries in [§4.1.1](#411-search-endpoint) — the dropped invalid term, the `\A`
zero-match regex, the negated numeric comparison. The third is the opposite, and is the reason
this source is pleasanter to build against than Scryfall.

| Behavior | Observed |
|---|---|
| `limit` on `/find-my-combos` | **Does not prioritize `included`.** At `limit=5`, 4 `included` + 1 `almostIncluded`; the same request twice, byte-identical. The full result's first eight flattened entries are all `included`, and at `limit=20` all eight appear. So a capped upstream request **omits combos the deck contains in favour of near-misses**, and reports nothing |
| An unrecognized card name in a submitted decklist | **Silently ignored.** HTTP 200, no warning, no unresolved list, no echo of the input. A three-card deck carrying one invented name returned the two-card combo among the real cards as though nothing were missing |
| An invalid search operator on `/variants/` | **HTTP 400** with `{"q":["Invalid search query: unexpected character : at position 34."]}` — loud, positional, and correctable |

**The name behavior has no server-side remedy.** `/card-list-from-text` is a *pure text parser*:
handed `1 Zzzz Not A Real Card 9999` it returns that string back as a `main` entry, resolving
nothing. **[verified]** No Commander Spellbook endpoint reports that a submitted name matched no
card, so a decklist with one typo returns fewer combos than the deck really has, with no signal
anywhere. [CAP-02](#cap-02--combo-discovery) resolves names through
[§4.1.2](#412-batch-resolution) before submitting for exactly this reason.

**The 400 is worth stating positively, because a reader will assume parity with Scryfall and be
wrong.** [§4.1.1](#411-search-endpoint) records that Scryfall silently drops an unrecognized term
whenever a recognized one remains; Commander Spellbook rejects the whole query and names the
offending character's position. A malformed combo query is therefore loudly correctable, which is
precisely the self-correction contract [D-10](#d-10--tool-handlers-never-throw) is built on.

**Addendum — a `GET /find-my-combos` with no deck returns HTTP 200 and a meaningless answer.
[verified 2026-08-24]** `identity: "C"`, `included: []`, and the **entire combo corpus**
paginated into `almostIncludedByAddingColors`. It is not an error and does not present as one — a
caller that omits the body gets a well-formed result describing every combo in Magic as one the
deck could almost reach. Recorded because the `GET` form is the one a session reaching for
`curl` will try first.

**Addendum — supporting fields that constrain what a capability may surface.
[verified 2026-08-24]**

- **`Variant.prices` carries `tcgplayer`, `cardkingdom`, and `cardmarket`.** This is a second
  price source inside a payload this project consumes, and
  [D-06](#d-06--pricing-from-scryfall) makes Scryfall the price source. It must never be
  surfaced as a price — the same treatment [§4.8.1](#481-the-deck-payload-is-enormous--measured)
  gives Moxfield's embedded `prices`.
- **`Variant.legalities` carries 16 keys, and the names differ from Scryfall's 23** — including
  `pauperCommanderMain`, `pauperCommander`, `standardBrawl`, and `competitiveBrawl`, none of
  which appear in the list [§4.1.1](#411-search-endpoint) recorded 2026-08-07. It is also a
  *combo-level* judgement rather than a card-level one. A consumer must not assume
  [CAP-01](#cap-01--card-search)'s key set.
- **`Variant.uses[].card` embeds `oracleId`**, which is the join back to Scryfall, alongside ten
  `imageUri*` fields whose cost is measured in [§4.4.1](#441-the-combo-payload-is-enormous--measured).
- **`/card-list-from-url?url=` resolves a deck URL to a `Deck`**, returning 400
  `InvalidUrlResponse` on one it cannot parse. Recorded as available and **deliberately not
  used** — see [CAP-02](#cap-02--combo-discovery), which takes a card list so that deck-URL
  resolution stays with [OQ-12](#oq-12--what-is-the-normalized-deck-shape-and-does-one-tool-serve-both-platforms-or-two)'s `deck_read` rather than being served twice.
- **`/explain-query?q=` validates and explains a query server-side**, returning a
  `QueryExplanation` or a 400 `QueryExplanationValidationError`. Not consumed by
  [CAP-02](#cap-02--combo-discovery); recorded against
  [OQ-14](#oq-14--how-should-commander-spellbook-query-syntax-be-surfaced-to-the-model).
- **Card names are matched against Scryfall's canonical names.** **[inferred — every name
  submitted during this research was already a canonical Scryfall name, so a divergent form was
  never tested.]**

**Addendum — there is a gzipped bulk file, and the "606 MB" framing above is incomplete.
[verified 2026-08-24]** `https://json.commanderspellbook.com/variants.json.gz` is **27,390,889
bytes (26.1 MB)** against the uncompressed file's 635,565,491 bytes. Both carry an `ETag` and a
`Last-Modified` and are served via CloudFront. **26.1 MB is directly comparable to
[§4.2](#42-scryfall-bulk-data)'s `oracle_cards` at 24.4 MB**, which this document already treats as
ordinary viable bulk data — so size alone is not a reason to avoid it, and the "Avoid … 606 MB"
line above must not be read as one. That line is left as written, per this section's append-only
handling; this addendum is the correction.

**It is nonetheless evaluated and not used, for reasons that survive the size correction.**
`/find-my-combos` performs deck matching **server-side** — that is computation, not lookup.
Reproducing it locally means reimplementing Commander Spellbook's matcher *including the exact
semantics of its six buckets*, and [§8](#8-out-of-scope) rejects precisely this one source over,
for Scryfall's search engine. The argument is stronger here than there: `includedByChangingCommanders`
and `almostIncludedByChangingCommanders` differ by one word and mean opposite things, so a
divergence would surface as a correctly-shaped, **wrongly-labelled** result — the silent-wrong-answer
class this document keeps paying for, rather than a visible gap. `combo_search` passes a
server-evaluated query string, which is the same argument one step down, and `/explain-query`
existing at all is evidence the language is non-trivial enough that its own authors ship an
explainer for it.

**The handling story is materially worse than [§4.2](#42-scryfall-bulk-data)'s precedent, which
inverts the size comparison.** The file is a **single JSON object, not JSONL**: it opens
`{"timestamp": …, "version": "6.2.6", "variants": […`. **[verified]**
[§4.2](#42-scryfall-bulk-data)'s files are gzipped **JSONL** and stream line-by-line with no parser
and no library; this one needs a streaming JSON parser — a runtime dependency, and this project
currently has zero — or 606 MB resident. So 26.1 MB compressed is comparable and 606 MB resident is
not, and the two facts belong in the same sentence or neither does.

**One thing it is genuinely good for.** The `timestamp` and `version` sit in the **first ~100
bytes**, so a `HEAD` or a `Range: bytes=0-199` GET is a **sub-kilobyte staleness check** without
downloading 26 MB — and because that `version` mirrors the live API version, the same read doubles
as an API-version drift check. Recorded against
[OQ-03](#oq-03--what-is-the-bulk-data-storage-strategy-and-when-is-it-introduced)'s still-open
refresh-trigger half. [CAP-02](#cap-02--combo-discovery) introduces no persistence and does not use
it.

**Addendum — there is a first-party npm client, and it is rejected by
[D-16](#d-16--no-npm-commander-spellbook-client-dependency). [verified 2026-08-24]**
`@space-cow-media/spellbook-client` v6.2.6, published by SpaceCowMedia from the Commander Spellbook
backend repository and generated from the OpenAPI schema this section describes. MIT, zero runtime
dependencies, version-locked to the API, actively maintained. It sets a configurable `User-Agent`
and accepts an injectable fetch, so it clears four of
[D-14](#d-14--no-npm-moxfield-api-dependency)'s five objections to the Moxfield package. It is
rejected anyway, on grounds recorded in full at
[D-16](#d-16--no-npm-commander-spellbook-client-dependency). Noted here — the same treatment
[§4.8.2](#482-the-npm-moxfield-api-package) gives `moxfield-api` — so a session researching this API
finds the verdict beside the endpoint documentation rather than re-evaluating the package from its
npm page, where it looks like a better fit than it is.

**Rate limits, re-checked.** No `X-RateLimit`, `Retry-After`, or throttling header of any kind on
any of the nine responses taken this date. **[verified absent — meaning unknown, not unlimited,
exactly as recorded 2026-07-29.]** [OQ-05](#oq-05--do-commander-spellbook-or-archidekt-impose-rate-limits) is unmoved.

**Method.** Nine requests, spaced by hand, with the app-naming `User-Agent` and an `Accept`
header ([§3.7](#37-undocumented-and-bot-protected-third-party-apis)): one schema fetch, five
`GET /variants/`, and three `POST /find-my-combos`. No authentication was attempted and no
challenge was encountered. No 429.

**Addendum — four probes taken to settle the paging path and two mapping questions.
[verified 2026-08-24]** Taken after
[CAP-02](#cap-02--combo-discovery) was specified, because three of its bullets rest on behaviour
nothing above establishes. Five requests — four `GET /variants/` and one Scryfall
`POST /cards/collection` — 1.2 seconds apart, with the app-naming `User-Agent` and an `Accept`
header. No 429. The captures are in
[`tests/fixtures/spellbook/`](../tests/fixtures/spellbook/README.md), which records which of them
are verbatim and which are truncated.

1. **`/variants/` ordering is stable across calls.** `card:"Thassa's Oracle"` at
   `limit=40&offset=0` and then `limit=40&offset=40` returned 40 ids each, **zero overlap and no
   gap** — 80 distinct ids in 80 slots, `count` 96 on both. Page 1's `next` was exactly the URL
   page 2 was fetched by. **[verified]** This is the check
   [CAP-02](#cap-02--combo-discovery)'s third cap bullet gates the upstream-paging path on, so
   that path ships as specified and neither fallback — an explicit `ordering` parameter, or one
   fetch and a client-side slice — is needed.

2. **A valid query with no matches is HTTP 200 carrying `{"count":0,"next":null,"previous":null,
   "results":[]}`, not a 404.** **[verified]** This is the **opposite** of Scryfall, which answers
   zero matches with a 404 that [CAP-01](#cap-01--card-search) deliberately maps to a successful
   empty result ([§4.1.1](#411-search-endpoint)). A consumer that ports that mapping here gains
   nothing and loses a real signal: a 404 from this host means a bad path, not an empty answer.
   Recorded because assuming parity is the standing hazard of this section — the HTTP 400 above is
   the other half of the same warning, in the other direction.

3. **`count` is `null` unless the request sends `count=true`.** The key is **always present**, so
   a missing total does not announce itself as missing — it reads as a total of nothing. `next` is
   populated either way and cannot substitute, since it names the following page rather than a
   size. **[verified]** The OpenAPI schema declares `count` with `default: false`, so this is the
   documented behaviour rather than a surprise; it is recorded because every capture taken on
   2026-07-29 and earlier this date happened to carry `count=true`, which makes the field look
   unconditional. Any call whose response must state a total sends `count=true`.

4. **Scryfall's `POST /cards/collection` reports a miss in `not_found` as the identifier object
   submitted, not as a bare string.** Three names, one invented, returned
   `{ object, not_found, data }` with `not_found: [{"name":"Zzzz Not A Real Card 9999"}]` and the
   two real cards in `data`. **[verified]** This is the mechanism
   [§4.1.2](#412-batch-resolution) supplies and the only way a caller learns that a submitted
   name matched nothing — Commander Spellbook itself will never say so.

**Addendum — the admins answered, and the usage contract is SHAPE-based rather than a rate.
[verified 2026-08-25]** The Discord message this section, [OQ-05](#oq-05--do-commander-spellbook-or-archidekt-impose-rate-limits)
and [OQ-06](#oq-06--is-commander-spellbooks-combo-data-licensed-as-distinct-from-its-code) have all
been waiting on since 2026-07-29 was answered. This is the **first direct statement from the source
owner** in this document; everything above it about this API's posture was observation or
inference.

What they published, in their own terms:

- **Anonymous use is sanctioned outright** — "You can use the HTTP API to make unauthenticated
  sparse requests."
- **The guideline is per-interaction call count, not requests per second** — "with the general
  guideline to have few http calls per user interaction with your tool."
- **Bulk export over the paginated API is asked against, explicitly** — "Please refrain from using
  it to bulk export data, consuming hundreds or more result pages every time using a ton of
  resources. Use the bulk json file for that instead, and configure a periodic update task."
- **The `User-Agent` requirement is confirmed as the source's own ask** — "To be a good citizen,
  setup your http calls to have your service name (optionally with a version) as User Agent." This
  is what [§3.4](#34-rate-limits-are-hard-constraints-not-guidance) and
  [§3.7](#37-undocumented-and-bot-protected-third-party-apis) already require of every source, and
  it moves from inferred courtesy to a stated request here.
- Endpoints re-confirmed, plus two this document had not recorded: `/schema/swagger` and
  `/schema/redoc` beside `/schema`. Both bulk URLs and
  `@space-cow-media/spellbook-client` were named as the recommended paths.

**No number was given, and the absence is the finding rather than an omission to fill in.** There
is still no published requests-per-second figure and still no rate-limit header
([OQ-05](#oq-05--do-commander-spellbook-or-archidekt-impose-rate-limits)), so
[§3.7](#37-undocumented-and-bot-protected-third-party-apis)'s "self-throttle conservatively where no
limit is published" is **not** discharged by this reply — what changed is that the lane is now a
*chosen* conservatism against a known-friendly source rather than a default against an unknown one.
The 500 ms lane stays.

**The constraint that IS new is a shape this document must not violate later.** "Few http calls per
user interaction" and "refrain from consuming hundreds or more result pages" bear directly on any
future capability that would sweep a query to exhaustion. [CAP-02](#cap-02--combo-discovery) as
delivered satisfies both by construction — one upstream request per tool call, paging reported and
never auto-resolved — but that was a decision taken for the model's context budget, and it now has
a second and independent reason to hold.

**One tension inside that, recorded rather than glossed.** `combo_find_deck` holds no per-user state
([D-03](#d-03--testability-handlers-callable-as-plain-functions)), so paging **re-fetches the whole
upstream result each time**: walking the 229 near-misses of the deck measured in
[§4.4.1](#441-the-combo-payload-is-enormous--measured)'s 2026-08-25 addendum costs six calls of
roughly a megabyte apiece rather than one. That is well inside both stated limits — six pages is not
"hundreds", and one deck is not a bulk export — and the responses are gzipped at ~12:1, so the wire
cost is smaller than the character counts suggest. It is written down because the multiplier is
invisible from the tool's interface and is the thing that would first push against *"few http calls
per user interaction"* if a later capability paged more aggressively or auto-resolved pages.

**Two things this reply does not do.** It does not license the data — see
[OQ-06](#oq-06--is-commander-spellbooks-combo-data-licensed-as-distinct-from-its-code), where
permission to consume is recorded as exactly that and not as a licence grant. And **the
recommendation of `@space-cow-media/spellbook-client` does not reopen
[D-16](#d-16--no-npm-commander-spellbook-client-dependency)**, which is in the locked
[§2](#2-locked-decisions): that decision rejected the package on grounds about *this* codebase — a
zero-runtime-dependency bundle, the wire types whose omissions are the price and image mechanism —
and not on any doubt about the package's quality or provenance, which the admins' endorsement
speaks to and D-16 never disputed. A session that wants to revisit it must do so as a deliberate
[§2](#2-locked-decisions) amendment with the author, not as a consequence of this addendum.

#### 4.4.1 The combo payload is enormous — measured

This is the finding that shapes the capability, and it was measured rather than estimated. It is
the same situation [§4.8.1](#481-the-deck-payload-is-enormous--measured) records for Moxfield,
arriving before the spec rather than after delivery.

**One 94-card Commander deck through `POST /find-my-combos` returned 640,684 characters.**
**[verified 2026-08-24]** The deck holds 93 main cards and one commander, and the response
carries 164 variants across the six buckets.

| Bucket | Variants | Chars | Share |
|---|---|---|---|
| `included` — combos the deck actually contains | 8 | 34,645 | **5.4%** |
| `almostIncluded` | 106 | 413,309 | **64.5%** |
| `almostIncludedByAddingColors` | 49 | 189,148 | 29.5% |
| `almostIncludedByChangingCommanders` | 1 | 3,323 | 0.5% |
| `includedByChangingCommanders`, `…ByAddingColorsAndChangingCommanders` | 0 | 4 | 0.0% |

**The two numbers that matter more than the total.** First, **the answer to the question asked is
5.4% of the response** — 156 of the 164 variants returned are combos the deck does *not* contain.
Second, **the ten `imageUri*` fields inside `uses[].card` are 268,676 characters, 41.9% of the
whole payload**, which is the single largest lever and the exact counterpart of Moxfield's twelve
vendor and affiliate URL fields. Average variant: 3,904 characters.

**A single card's combos are unbounded, and `/variants/` applies no default page cap.**
`card:"Thassa's Oracle"` returned **all 96 variants in one response, 533,840 characters, with
`next: null`**. **[verified]** Popularity scales it without limit: Sol Ring appears in **129**
combos, Basalt Monolith **287**, and **Dockside Extortionist 476** — which projects past 2.6 MB
for one card at the measured per-variant cost.

**Set both against the ceiling this project has already hit.**
[OQ-02](#oq-02--how-verbose-should-a-search-result-be) records a
[CAP-01](#cap-01--card-search) response of 116,626 characters that **exceeded a harness
tool-result ceiling** (issue #25). The deck read is **5.5×** that and one popular card's combos
**4.6×**. A passthrough is not on the table at any deck size or for any card worth asking about.

**The trim was measured on the same payloads, not projected: 76–78% smaller, at 930–1,236
characters per combo.** **[verified 2026-08-24]** Shaping each variant to combo id, the cards it
uses (name, `oracleId`, quantity, zone, commander flag), what it produces, colour identity, mana
needed, popularity, bracket tag, prerequisites and description:

| Payload | Raw | Trimmed | Per combo |
|---|---|---|---|
| The 8 `included` combos | 34,645 | **8,461** | 1,058 |
| The 156 near-miss combos | 605,778 | **145,132** | 930 |
| `card:"Thassa's Oracle"`, 96 variants | 533,789 | **118,682** | 1,236 |

Per-combo cost varies with how many cards a combo uses, so a budget derived from one query is an
estimate and not a constant — the same warning [§4.1.1](#411-search-endpoint) attaches to its own
per-card figure. **`description` is ~40% of the *trimmed* form** and is deliberately kept: it is
the step-by-step line explaining how the combo executes, which is what the model reasons from,
and the argument for keeping it is the one
[OQ-02](#oq-02--how-verbose-should-a-search-result-be) used to keep `oracle_text`.

**Addendum 2026-08-25 — the warning above came true, and one measured page is above the band.**
**[verified 2026-08-25]** [Slice 16](./slices/TrackA-Slice16.md) shipped the trim and measured it
live through the delivered shaper. **The rows above stand as written**; these are additional
measurements, not corrections.

| Payload | Raw | Shaped | Per combo |
|---|---|---|---|
| `variants-page1.json`, 40 variants (fixture) | 173,135 | 40,096 | 1,001 |
| `card:"Thassa's Oracle"` page 1, live | — | 40,202 | 1,005 |
| `card:"Thassa's Oracle"` page 2, live | — | **63,688** | **1,592** |

The fixture page is the only one of the three with a raw figure beside it, and it shapes 173,135 to
40,096 — a **76.8%** reduction, inside the 76–78% band measured 2026-08-24. `description` is
**36.5%** of the trimmed form, consistent with the ~40% this section already records, and it is
kept. **Page 2 is the finding.** At 1,592 characters per combo it is above the
930–1,236 band measured 2026-08-24, and its 63,688-character page is above the "under 50,000" page
budget [CAP-02](#cap-02--combo-discovery)'s page-cap bullet derives from the 1,236 figure. Nothing
is broken by it — 63,688 is 55% of the 116,626 that breached a harness tool-result ceiling
(issue #25) — but **that budget is an estimate from one query and is not a guarantee**, which is
this section's own "per-combo cost varies with how many cards a combo uses" arriving as a
measurement. The cause is visible in the fixtures: `variants-page1.json`'s 40 variants average 2.9
cards per combo at a 1,000-character mean, while the eight verbatim variants in the derived
`variants-page2.json` average 3.4 cards at a **1,340** mean, min 897 and max 1,838. Evidence:
[`docs/slices/TrackA-Slice16-results.md`](./slices/TrackA-Slice16-results.md).

**Addendum 2026-08-25, second entry — the tail was sampled, and the page cap was re-sized on it.**
**[verified 2026-08-25]** The addendum above measured two pages of one query and correctly refused
to generalize from them. This one sampled the distribution deliberately: **577 combos across 15
queries**, shaped through the delivered shaper, chosen to stress each driver of shaped size using
Commander Spellbook's own `cards>N`, `steps>N`, `results>N` and `prerequisites>N` operators — all
four confirmed real against `/explain-query`. **Both addenda's rows stand; neither is corrected.**

| | per combo |
|---|---|
| min / p50 / p90 | 547 / **1,390** / 2,043 |
| p95 / p99 / max | 2,296 / **2,530** / **4,421** |
| sampled mean | **1,393** |

**`card:"Thassa's Oracle"` is a cheap query, not a typical one.** Its ~1,001 characters per combo
sits near the bottom of that distribution, and the 930–1,236 band above is **below the sampled
mean**. Per-combo cost tracks how many cards a combo uses: a 10-card combo shapes to 4,421
characters where a 2-card one shapes to 547.

Worst real 40-combo pages measured: `cards>5 steps>5` **99,311**, `cards>5` 98,017,
`cards>4 prerequisites>2` 81,887, `cards>4` 71,295, `steps>8` 67,748. The first is **85% of the
116,626** that breached a harness tool-result ceiling, and it is an ordinary query a user can type.

**[CAP-02](#cap-02--combo-discovery)'s page cap was therefore amended from 40 to 20**, and the same
queries re-measured through the shipped tool: `cards>5 steps>5` **58,240**, `card:"Thassa's Oracle"`
**16,903**. The reasoning is margin rather than arithmetic — **116,626 is a value known to fail, not
the limit, and the true ceiling is unknown and lower** — so 25 was rejected for putting a
maximum-cost page at 95% of a known-bad figure while 20 keeps it under 90,000. A byte-aware cap was
considered and not taken: it would adapt to the 5.7× cost variance, but paging would have to move
from page numbers to explicit offsets, and that shape is what
[Slice 17](./slices/TrackA-Slice17.md) consumes.

**Addendum 2026-08-25, third entry — the byte-aware cap was taken after all, and measured.**
**[verified 2026-08-25]** The entry above recorded a byte-aware cap as considered and deferred on
the grounds that it costs a contract change. It was reconsidered before
[Slice 17](./slices/TrackA-Slice17.md) built on the page-number shape, which is the cheapest
moment it could be done, and two probes removed the objection to it. **Both earlier addenda stand;
neither is corrected.**

**`/variants/` ignores field selection.** `fields=`, `fields[]=`, `only=` and `omit=` are all
accepted and silently ignored — the variant always carries all 20 keys, including `prices` and the
ten `imageUri*`. So the 41.9% this capability discards **cannot be avoided by asking for less**,
and fetching more variants adds no new class of waste.

**Responses are gzipped**, which is what makes fetching more than is returned cheap:

| variants fetched | raw | on the wire |
|---|---|---|
| 20 | 76,421 | **7.1 KB** |
| 40 | 173,192 | 14.4 KB |
| 60 | 249,561 | **20.4 KB** |

At roughly **12:1**, over-fetching costs ~13 KB per call — and it *reduces* the quantity
[§3.4](#34-rate-limits-are-hard-constraints-not-guidance) and
[§3.7](#37-undocumented-and-bot-protected-third-party-apis) actually constrain, which is request
**rate**: sweeping all 96 combos of one query went from 5 requests to **3**.

Measured live through the shipped tool at a 50,000-character budget, fetching 60 upstream:

| query | pages | combos per page | largest page |
|---|---|---|---|
| `card:"Thassa's Oracle"` (96 combos) | **3** | 47, 30, 19 | 49,473 |
| `cards>5 steps>5` (41 combos) | 3 | 16, 23, 2 | 49,366 |

Every combo was reached exactly once by following `next_offset`, none repeated. **Page size varies
within a single query** — 47 then 30 then 19, as later combos in the same result use more cards —
which is the behaviour no fixed count can produce, and the clearest evidence that a count was the
wrong instrument. Evidence:
[`docs/slices/TrackA-Slice16-results.md`](./slices/TrackA-Slice16-results.md).

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
    legalities, and price. Per response it also returns `total_cards`, `page`, `has_more`,
    `legalities_mode`, `legalities_included`, and a `note` when the model should act.
  - **`legalities` is trimmed to the format the query names** (amended 2026-08-04, resolving
    [OQ-02](#oq-02--how-verbose-should-a-search-result-be)). When `q` carries `f:`, `banned:`, or
    `restricted:`, only that format's legality is returned; when it names no format, a small
    default set is. The full map is available behind an opt-in. Untrimmed passthrough measured
    **54.5%** of a real response's bytes — a majority of the payload spent on formats the user
    did not ask about, and enough to exceed a harness tool-result ceiling at well under one page.
  - **The trimmed scope is reported once per response** (implemented 2026-08-10), because an
    absent legality key must never read as "not legal"
    ([§3.6](#36-error-surface)). `legalities_mode` is `queried` | `default` | `all` and describes
    the scope actually applied — a `queried` request whose scan found no format reports `default`,
    because that is what the payload carries. `legalities_included` lists the keys present on
    every card. Formats outside it were **not returned** and that is not a claim about legality.
  - **Card images are available behind an opt-in and are absent by default** (added 2026-08-11,
    answering [OQ-13](#oq-13--should-a-card-search-result-carry-image-uris-and-at-what-cost); **not
    implemented**). `images: "none" | "normal"`, defaulting to `"none"`. When `"normal"`, each card
    carries an `images` **array** of Scryfall `normal` URIs — one entry for an ordinary card and one
    per face for a multi-faced one, in face order, because
    [§4.1.4](#414-card-image-uris) establishes that a transform card has no top-level `image_uris`
    at all. The URIs are passed through exactly as Scryfall returns them, `?timestamp` included, and
    are never assembled from the card `id`. Measured cost on a full page: **+9,888 characters on 88
    cards, +21.6%**, which is why the default is off.
  - **No artist field, and that is a [§3.3](#33-legal-and-terms-of-service) decision rather than an
    omission.** That section requires the artist and copyright stay identifiable wherever images are
    surfaced. An unmodified full card face prints both in its own border, so the obligation is met
    by what the URI already points at and costs nothing. A consumer that crops — `art_crop`, or any
    other framing that removes the border — is outside what this capability's images support, and
    would need the artist carried separately before it could satisfy
    [§3.3](#33-legal-and-terms-of-service).
  - **Price correctness is part of this capability, not deferred.** Results constrain to
    paper printings for price purposes, and surface `usd_foil` / `usd_etched` when `usd` is
    null rather than reporting no price ([§4.1.3](#413-price-fields--three-verified-traps)). A card with genuinely no paper price says
    so, and says why (digital-only).
  - **Paginates explicitly.** Page size is 88 — exactly half Scryfall's 175, so both halves of
    every upstream page are addressable at one upstream request per call
    ([OQ-02](#oq-02--how-verbose-should-a-search-result-be), implemented 2026-08-10; it was 175
    before that). When more results exist, the response says
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
  9. A query with more matches than fit on one page reports the total count and that more results
     exist. (Page size was 175 when this was written; it is 88 since 2026-08-10 — see criterion 14.)
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
  14. **A page reports at most 88 cards, and every matching card is reachable by some page.**
      Added 2026-08-10 with [OQ-02](#oq-02--how-verbose-should-a-search-result-be)'s page cap. A
      query matching more than 88 cards returns 88 with `has_more: true` — including when Scryfall
      itself reports `has_more: false`, the case issue #25 hit at 111 cards. Card 89 of that result
      appears on page 2, and no card is reachable by no page: page size 88 is exactly half
      Scryfall's 175, so both halves of every upstream page are addressable. Kept separate from
      criterion 13 rather than folded into it — two levers decided three days apart, with different
      failure modes, get two independently falsifiable criteria.
  15. **`images` is absent by default, and present for every face when asked for.** Added
      2026-08-11 with [OQ-13](#oq-13--should-a-card-search-result-carry-image-uris-and-at-what-cost)'s
      answer; **not implemented**. A call that does not set `images` returns no image field on any
      card and is byte-identical to the same call before this criterion existed — the default costs
      nothing, which is the whole basis of the decision. A call setting `images: "normal"` returns
      one URI for a single-faced card and **two for a transform card**, checked against a real
      multi-faced card rather than a fixture, since the failure this addresses is specifically that
      `image_uris` is absent at the top level there
      ([§4.1.4](#414-card-image-uris)) and a consumer reading it unconditionally gets `undefined`
      with no error. No URI is constructed from a card `id`.
- **Open questions:** [OQ-01](#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) (how to surface syntax), [OQ-02](#oq-02--how-verbose-should-a-search-result-be) (result verbosity vs. context
  budget), [OQ-09](#oq-09--should-price-resolution-fall-back-to-eur-when-no-usd-price-exists) (EUR fallback when no USD price exists — opened by the acceptance pass),
  [OQ-13](#oq-13--should-a-card-search-result-carry-image-uris-and-at-what-cost) (image URIs —
  answered 2026-08-11, unimplemented).
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
- **Delivery-note addendum (2026-08-10).** Both levers are implemented and
  **[CAP-01](#cap-01--card-search) is delivered against criteria 1–14.** Criterion 13 stayed as
  written and a criterion 14 was added, which is the choice the 2026-08-07 addendum left to the
  implementing slice — [Slice 14](./slices/TrackA-Slice14.md). The trim, the cap and the paging
  arithmetic all live in [`src/tools/card-search.ts`](../src/tools/card-search.ts), so the sentence
  above about neither being in `src/` is true only of its own date. Verified live: issue #25's exact
  query returned **53,043 characters against the 116,626 that breached the ceiling**, 88 cards with
  `has_more: true` where Scryfall reported `has_more: false`, and its page 2 returned the remaining
  23 — all 111 cards reachable. `npm run acceptance` passed 13 of 13 with no 429. Evidence:
  [`docs/slices/TrackA-Slice14-results.md`](./slices/TrackA-Slice14-results.md).
- **Delivery-note addendum (2026-08-11).** A criterion 15 was added and **is not implemented**, so
  **[CAP-01](#cap-01--card-search) remains delivered against criteria 1–14** and its `Status` is
  unchanged. This is the same shape as 2026-08-04, when criterion 13 was added to a block already
  marked delivered, and it is stated here rather than left to inference because the 2026-08-08
  revision-log row exists entirely because a count went stale in four places at once. Nothing in
  [`src/`](../src/tools/card-search.ts) changed and no slice is scheduled: the decision behind
  criterion 15 is
  [OQ-13](#oq-13--should-a-card-search-result-carry-image-uris-and-at-what-cost), and the thing
  waiting on it is a plugin component
  ([`docs/PLUGIN-PRD.md` PC-04](./PLUGIN-PRD.md#pc-04--card-viewer)), not anything this document
  owns.

---

### CAP-02 — Combo discovery

- **Status:** delivered (2026-08-25)
- **Phase:** 2
- **User need:** I want to know what combos a card is part of, and what combos are already
  sitting in a deck I have built — including the ones I am one card away from, because that is
  the interesting answer. I do not want to read Commander Spellbook's site and cross-reference it
  against my list by hand.
- **Behavior:**
  - **Two tools, because the two questions take different inputs.** `combo_search` takes a
    Commander Spellbook query string; `combo_find_deck` takes a decklist. A single tool with
    mutually exclusive parameters was rejected: tool schemas are **deferred** on the Claude Code
    surface and cost 0 resident tokens ([`docs/PLUGIN-PRD.md` PQ-01](./PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports)),
    so a second tool is nearly free while a one-of schema is a standing invitation to set both or
    neither. This is a different answer from
    [OQ-12](#oq-12--what-is-the-normalized-deck-shape-and-does-one-tool-serve-both-platforms-or-two)'s
    one-tool `deck_read` and does not disturb it: there, two platforms answered the *same*
    question over the same input, and here two inputs answer different questions.
  - **`combo_search` passes its query through unmodified.** The full Commander Spellbook search
    syntax is supported because Commander Spellbook evaluates it — this capability does not
    parse, validate, or reimplement it, exactly as [CAP-01](#cap-01--card-search) does not for
    Scryfall. "Combos involving a given card" is `card:"…"` and is the common case, but nothing
    narrows the query to that.
  - **A malformed query is loudly correctable here, which is not true of
    [CAP-01](#cap-01--card-search).** Commander Spellbook rejects an unrecognized operator with
    HTTP 400 naming the offending character's position, where Scryfall silently drops the term
    and answers from fewer constraints ([§4.1.1](#411-search-endpoint),
    [§4.4](#44-commander-spellbook)). The verbatim `details` is passed through
    ([D-10](#d-10--tool-handlers-never-throw)), so the model self-corrects on the next call.
    Stated explicitly because a reader who knows [CAP-01](#cap-01--card-search) will assume
    parity and be wrong in the safe direction.
  - **`combo_find_deck` takes a list of card names plus commanders, never a deck URL.** It
    composes with [OQ-12](#oq-12--what-is-the-normalized-deck-shape-and-does-one-tool-serve-both-platforms-or-two)'s
    `deck_read` when that capability lands, and works today against a list the user pasted, so it
    has **no dependency on deck reading**. Commander Spellbook's own
    `/card-list-from-url` would resolve an Archidekt or Moxfield URL directly
    ([§4.4](#44-commander-spellbook)) and is deliberately not used: it routes the user's deck URL
    through a third party and would serve deck resolution twice, once here and once in the
    capability [D-13](#d-13--deck-platform-order-archidekt-first-moxfield-second) already orders.
  - **Every submitted card name is resolved through
    [§4.1.2](#412-batch-resolution) before the combo call**, and any name Scryfall does not
    resolve is **reported in the response**. This is the guard against the trap in
    [§4.4](#44-commander-spellbook): Commander Spellbook ignores an unrecognized name silently,
    returns HTTP 200, and no endpoint it serves will say a name matched nothing — so a decklist
    with one typo yields fewer combos than the deck really holds, with no signal. Batch
    resolution costs **2 requests for a 100-card deck** at 75 identifiers each, never a loop over
    `/cards/named`. It is the only reason this capability touches Scryfall at all.
  - **Near-misses are behind an opt-in and are absent by default.**
    `include: "matched" | "matched+near"`, defaulting to `"matched"`. Combos the deck contains
    are 5.4% of the upstream payload and the near-misses 94.6%
    ([§4.4.1](#441-the-combo-payload-is-enormous--measured)), so the default answers the question
    asked and the opt-in buys the "add one card and you have a combo" answer deliberately. The
    parameter is additive and defaults to cheap, which is the direction
    [OQ-13](#oq-13--should-a-card-search-result-carry-image-uris-and-at-what-cost) established is
    safe: forgetting it returns a smaller true answer rather than failing a call invisibly, which
    is what [OQ-02](#oq-02--how-verbose-should-a-search-result-be) rejected a subtractive
    parameter for.
  - **Each returned combo states which bucket it came from**, so a near-miss is never presented
    as a combo the deck contains. The six upstream buckets
    ([§4.4](#44-commander-spellbook)) are reported rather than flattened away, for the same
    reason `legalities_included` exists on [CAP-01](#cap-01--card-search): an unlabelled result
    invites a wrong reading ([§3.6](#36-error-surface)).
  - **A page is filled to a BYTE BUDGET of 50,000 characters, not to a combo count, and where the
    cap is applied differs by tool.** **Amended 2026-08-25, twice, on measurement — this bullet
    first said 40, then 20, and now states a budget.** The counts failed for the same reason: 577
    combos sampled across 15 queries measured per-combo cost at **547 minimum, 1,390 median and
    4,421 maximum**, a **5.7×** spread driven by how many cards a combo uses. Any single count is
    therefore wrong in both directions at once. At 40, the ordinary query `cards>5 steps>5`
    returned a measured **99,311**-character tool result — **85% of the 116,626** that breached a
    harness tool-result ceiling. At 20 it was safe, but an ordinary `card:"…"` query was starved of
    two thirds of the combos that would have fit.
    A budget serves both: measured live through the shipped tool, `card:"Thassa's Oracle"` walks
    its 96 combos in **3 pages of 47, 30 and 19** and `cards>5 steps>5` its 41 in **3 pages of 16,
    23 and 2**, with **no page above 49,473 characters**. Page size varying *within one query* is
    the behaviour no fixed count could have produced.
    **The margin is the point: 116,626 is a value known to FAIL, not the limit**, and the true
    ceiling is unknown and lower, so 50,000 is chosen to match
    [CAP-01](#cap-01--card-search)'s delivered band. See
    [§4.4.1](#441-the-combo-payload-is-enormous--measured).
  - **Because the page size is not constant, `combo_search` pages by OFFSET and reports
    `next_offset`.** A page number cannot express where the next page starts when pages end
    wherever the budget runs out. The caller echoes `next_offset` back as `offset`; the response
    omits it on the last page. **[CAP-01](#cap-01--card-search)'s 88-card arithmetic does not
    transfer, and neither does its page numbering**: Scryfall's `page` is in units of 175 with no
    offset, so its cap had to divide a page evenly or strand cards, and
    [Slice 14](./slices/TrackA-Slice14.md) could not simply have picked a smaller number.
    Commander Spellbook exposes a real `offset`, which is exactly what lets a page end anywhere
    with nothing stranded behind it. **One combo larger than the whole budget is still returned**,
    because a page of zero would leave `next_offset` equal to `offset` and the caller would page
    forever.
  - **`combo_search` pages upstream; `combo_find_deck` must not.** The distinction is the whole
    point and collapsing it breaks one tool or the other. `/variants/` returns **one flat list**,
    so `limit` and `offset` cannot drop the answer to the question asked and are sent upstream —
    which matters because that endpoint applies **no default page cap** and one popular card's
    combos measure 533,840 characters, with 476-combo cards projecting past 2.6 MB
    ([§4.4.1](#441-the-combo-payload-is-enormous--measured)). `/find-my-combos` classifies into six
    buckets, and its `limit` **does not prioritize the combos the deck contains** — a capped
    upstream request drops them in favour of near-misses and reports nothing
    ([§4.4](#44-commander-spellbook)) — so that tool fetches the full result, classifies, and caps
    **after**. Criterion 10 tests the second half; criterion 8 tests both.
  - **Upstream paging rests on `/variants/` ordering being stable across calls — verified
    2026-08-25.** Nothing in [§4.4](#44-commander-spellbook) establishes it, and if it drifts then
    page 2 can repeat or skip combos silently, so the implementing slice was bound to confirm it
    live before the upstream-paging path shipped.
    [Slice 16](./slices/TrackA-Slice16.md) did: pages 1 and 2 of `card:"Thassa's Oracle"` through
    the shipped client on its own lane returned **80 distinct ids in 80 slots, zero overlap and no
    duplicate within a page**
    ([`docs/slices/TrackA-Slice16-results.md`](./slices/TrackA-Slice16-results.md)). **Neither
    fallback was needed** — no explicit `ordering` parameter, and no single fetch with a
    client-side slice. Both stay recorded as the recovery if the ordering ever drifts.
  - **The wire budget and the model budget are different budgets.** `combo_find_deck` fetches the
    full upstream result — 640,684 characters in 1.66 seconds on the measured deck — and trims
    before returning. The ceiling this capability is designed around constrains what reaches the
    model, not what crosses the network, and conflating the two is what would push the cap
    upstream and break the previous bullet.
  - **No Commander Spellbook price is ever returned.** `Variant.prices` carries `tcgplayer`,
    `cardkingdom` and `cardmarket`, and [D-06](#d-06--pricing-from-scryfall) makes Scryfall the
    price source — the same treatment [§4.8.1](#481-the-deck-payload-is-enormous--measured)
    prescribes for Moxfield's embedded copy. **No `imageUri*` field is returned either**, at
    41.9% of the upstream payload ([§4.4.1](#441-the-combo-payload-is-enormous--measured)).
  - **Combo legality is reported for one format**, named by a `format` parameter defaulting to
    `"commander"`, with the format actually applied stated once per response — an absent key must
    never read as "not legal" ([§3.6](#36-error-surface)), which is the discipline
    [CAP-01](#cap-01--card-search)'s `legalities_mode` established. Commander Spellbook returns
    **16 legality keys whose names differ from Scryfall's 23** and judges the *combo* rather than
    a card, so a consumer must not reuse [CAP-01](#cap-01--card-search)'s key set
    ([§4.4](#44-commander-spellbook)).
  - **Commander Spellbook is self-throttled to the strictest lane in
    [§3.4](#34-rate-limits-are-hard-constraints-not-guidance) — 2 per second — because it
    publishes no limit** ([§3.7](#37-undocumented-and-bot-protected-third-party-apis),
    [OQ-05](#oq-05--do-commander-spellbook-or-archidekt-impose-rate-limits)). It is a different
    host from Scryfall and gets its own lane rather than sharing one; the Scryfall lanes are
    sized against Scryfall's published numbers and mean nothing here.
  - **A missing or empty decklist is a structured failure, not a request.** A `GET` to
    `/find-my-combos` with no deck returns HTTP 200 carrying the entire combo corpus as
    near-misses ([§4.4](#44-commander-spellbook)), which is a well-formed meaningless answer of
    the kind this document keeps paying for. The handler refuses before the call.
- **Depends on:** Commander Spellbook ([§4.4](#44-commander-spellbook)) — `GET /variants/` and
  `POST /find-my-combos`. Plus Scryfall `POST /cards/collection` ([§4.1.2](#412-batch-resolution))
  for name validation only, never for combo data. **No other CAP**, and specifically not deck
  reading: the decklist arrives as card names, so
  [D-13](#d-13--deck-platform-order-archidekt-first-moxfield-second)'s platform ordering does not
  gate this.
- **Serves via:** `combo_search` and `combo_find_deck`. Both satisfy
  [D-11](#d-11--tool-naming-convention).
- **Acceptance criteria:**
  1. Both handler functions are invoked directly in a test with no MCP server started and no
     transport constructed ([D-03](#d-03--testability-handlers-callable-as-plain-functions)).
  2. `combo_search` sends its query string upstream byte-identically, verified against a fake
     client — including a query carrying an operator this server has never heard of.
  3. An invalid query returns a structured failure carrying Commander Spellbook's verbatim
     message and does not throw ([D-10](#d-10--tool-handlers-never-throw)). Observed
     2026-08-24: `nonsenseop:foo` returns HTTP 400, "Invalid search query: unexpected character
     : at position 34."
  4. A decklist containing Demonic Consultation and Thassa's Oracle returns that combo, labelled
     as one the deck contains.
  5. **A card name Scryfall does not resolve is reported and not silently dropped.** Checked with
     a deliberately invented name in an otherwise valid decklist — the failure this addresses is
     that the upstream API returns HTTP 200 and says nothing
     ([§4.4](#44-commander-spellbook)).
  6. No response carries a Commander Spellbook price field
     ([D-06](#d-06--pricing-from-scryfall)).
  7. No response carries a Commander Spellbook `imageUri*` field.
  8. A response fills a page to the byte budget, states the total and whether more exist, and
     reports `next_offset` so following it reaches every combo exactly once — none stranded, none
     repeated. (**Amended 2026-08-25** with the page-cap bullet above: this criterion said "at
     most 40 combos", then "at most 20", and now names the budget and the offset contract. What it
     tests is unchanged — that paging reaches everything — only the mechanism it names.)
  9. **`include` defaults to `"matched"`**, and no near-miss combo appears in a response that did
     not ask for one. A call setting `"matched+near"` returns near-misses, each labelled with the
     bucket it came from.
  10. **The cap is never sent upstream as `limit` on `/find-my-combos`.** Verified against a
      fixture whose first five upstream entries classify as four matched and one near: all
      matched combos are returned. Kept separate from criterion 8 because the two fail
      differently — a broken cap returns too much, and a cap pushed upstream returns a plausible
      answer that is missing the combos the user actually has.
  11. Every outbound request carries a `User-Agent` naming this application and an `Accept`
      header ([§3.4](#34-rate-limits-are-hard-constraints-not-guidance),
      [§3.7](#37-undocumented-and-bot-protected-third-party-apis)).
  12. Two Commander Spellbook requests issued back to back do not exceed 2 requests/second, and
      the Scryfall lanes are not shared with them.
  13. An empty or missing decklist returns a structured failure and issues no upstream combo
      request.
  14. Combo legality is returned for the format named by `format`, that format is stated in the
      response, and no other format's legality appears.
- **Open questions:** [OQ-05](#oq-05--do-commander-spellbook-or-archidekt-impose-rate-limits) (no
  documented rate limit — unknown rather than unlimited, so the 2/second lane above is a
  conservative guess and not a measured fit),
  [OQ-06](#oq-06--is-commander-spellbooks-combo-data-licensed-as-distinct-from-its-code) (the
  backend is MIT; the combo *data* carries no stated license), and
  [OQ-14](#oq-14--how-should-commander-spellbook-query-syntax-be-surfaced-to-the-model) (how the
  Commander Spellbook query syntax reaches the model). **None of the three blocks this spec**, and
  that is a deliberate reading rather than an omission: [OQ-05](#oq-05--do-commander-spellbook-or-archidekt-impose-rate-limits)
  and [OQ-06](#oq-06--is-commander-spellbooks-combo-data-licensed-as-distinct-from-its-code) both
  resolve only when a third party replies, and
  [§3.7](#37-undocumented-and-bot-protected-third-party-apis) already states the standing rule for
  a source that has not; [OQ-14](#oq-14--how-should-commander-spellbook-query-syntax-be-surfaced-to-the-model)
  is the [OQ-01](#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) question one source
  over, and [CAP-01](#cap-01--card-search) shipped with that one open.
- **Progress note (2026-08-25).** Track A [Slice 15](./slices/TrackA-Slice15.md) landed the
  transport this capability needs and **none of the capability itself**. `src/http/client.ts` is
  [CAP-01](#cap-01--card-search)'s client generalized over a plain-data source spec — the source
  name, the lane table and the error-`details` reader became data — and `src/spellbook/client.ts`
  gives Commander Spellbook its own lane at 500 ms, which is the 2/second the rate-limit bullet
  above specifies. A **POST** verb this codebase did not have rides the same queue, spacing and
  429 backoff, so `/find-my-combos` and [§4.1.2](#412-batch-resolution) both have a verb to use.
  **Criteria 11 and 12 are verified**: exact header equality on GET and POST for both sources,
  and two Commander Spellbook requests 500 ms apart on one virtual clock with an interleaved
  Scryfall call neither delayed nor delaying — driven through the shipped factories built from one
  `Config`, not through hand-built specs. **Criterion 3 is verified in its client half only** —
  the verbatim 400 body recorded 2026-08-24 returns `bad_request` carrying
  `q: Invalid search query: unexpected character : at position 34.` and does not throw
  ([D-10](#d-10--tool-handlers-never-throw)) — and its handler half waits on `combo_search`, so
  **3 is not verified outright** and the other eleven criteria are untouched. `Status` stays
  `specified`: no tool is registered, neither handler exists, and the Commander Spellbook client
  is called by no production code. **No open question moved**, and
  [OQ-05](#oq-05--do-commander-spellbook-or-archidekt-impose-rate-limits) in particular did not —
  the lane is [§3.7](#37-undocumented-and-bot-protected-third-party-apis)'s conservative
  strictest-lane rule applied, not a measured fit. Evidence:
  [`docs/slices/TrackA-Slice15-results.md`](./slices/TrackA-Slice15-results.md).
- **Progress note (2026-08-25, second entry).** Track A
  [Slice 16](./slices/TrackA-Slice16.md) landed `combo_search` and the normalized combo shape —
  **half the capability, and `Status` stays `specified`.** `src/spellbook/types.ts` declares
  hand-written wire shapes that omit `prices` and every `imageUri*` field, so
  **criteria 6 and 7 are compile-time facts** rather than tests somebody must remember to run
  ([D-16](#d-16--no-npm-commander-spellbook-client-dependency)'s fourth rejection ground stated as
  code); `src/spellbook/combos.ts` carries the shape every later consumer reads plus format
  resolution over Commander Spellbook's 16 legality keys; `src/tools/combo-search.ts` issues
  exactly one upstream request per call at `limit=40`, `offset=(page-1)*40` and `count=true`.
  **Verified: criteria 2, 6 and 7 in full, criterion 3's handler half — so 3 is now verified in
  both halves, the client half having been [Slice 15](./slices/TrackA-Slice15.md)'s — and the
  `combo_search` half of criteria 1, 8 and 14.** Criterion 10 is entirely
  [Slice 17](./slices/TrackA-Slice17.md)'s and is untouched, and **no criterion is marked
  delivered**: the capability is delivered when `combo_find_deck` lands. The third cap bullet above
  is discharged by the live ordering probe recorded there. **One measured figure contradicts the
  page-budget bullet above and is recorded rather than smoothed:** a live page 2 measured **63,688
  characters at 1,592 per combo**, above [§4.4.1](#441-the-combo-payload-is-enormous--measured)'s
  930–1,236 band and above that bullet's stated "under 50,000" — nothing is broken by it, at 55% of
  the 116,626 that breached a harness tool-result ceiling, but **the 50,000 figure is an estimate
  derived from one query and must not be quoted as a guarantee**;
  [§4.4.1](#441-the-combo-payload-is-enormous--measured)'s dated addendum of the same date carries
  the measurement and the cause. Three behaviors are deliberately the **opposite** of
  [CAP-01](#cap-01--card-search)'s and are easy to port by mistake: zero matches is HTTP **200**
  and a successful empty result while a **404 stays a failure**;
  [Slice 14](./slices/TrackA-Slice14.md)'s 88-card half-page arithmetic does not transfer, `ceil`
  over a true `offset` being simply correct here; and `format` always names the format requested,
  so there is no applied-versus-requested gap of the kind `legalities_mode` has. **No open question
  moved** — [OQ-05](#oq-05--do-commander-spellbook-or-archidekt-impose-rate-limits) and
  [OQ-14](#oq-14--how-should-commander-spellbook-query-syntax-be-surfaced-to-the-model) are both
  still open, the latter now *concrete* rather than answered, because the tool exists and the
  measurement method [OQ-01](#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model)
  established is available and was not run. Evidence:
  [`docs/slices/TrackA-Slice16-results.md`](./slices/TrackA-Slice16-results.md).
- **Progress note addendum (2026-08-25) — the page cap was re-sized from 40 to 20 on
  measurement, and the page-cap bullet above is amended rather than annotated.** The 40 rested
  on one query; **577 combos sampled across 15 queries** put its per-combo cost near the cheap
  end of the real distribution (p50 1,390, p99 2,530, max 4,421), and the ordinary query
  `cards>5 steps>5` returned a measured **99,311**-character tool result at 40 — **85% of the
  116,626** that breached a harness ceiling. At 20 it returns **58,240** and a typical query
  **16,903**. Criterion 8's number moves with it, 40 → 20; the criterion is otherwise unchanged
  and is still verified only in its `combo_search` half. **`Status` stays `specified`.** The
  true ceiling is unknown and below 116,626, which is why the cap is sized for margin rather
  than to a target: a cap of 25 would have put a maximum-cost page at 95% of a known-bad
  figure. [§4.4.1](#441-the-combo-payload-is-enormous--measured) carries the distribution and
  the before/after measurements.
- **Progress note addendum (2026-08-25, third) — the fixed cap was replaced by a byte budget,
  and paging moved from page numbers to offsets.** Taken before
  [Slice 17](./slices/TrackA-Slice17.md) built on the page-number shape, which is the cheapest
  moment it could be done. Two probes removed the objection recorded above: `/variants/` **ignores**
  `fields=`/`only=`/`omit=`, so over-fetching adds no waste this capability was not already paying,
  and responses are **gzipped at ~12:1**, so fetching 60 variants instead of 20 costs ~13 KB per
  call while *reducing* request count — the quantity
  [§3.4](#34-rate-limits-are-hard-constraints-not-guidance) and
  [§3.7](#37-undocumented-and-bot-protected-third-party-apis) constrain. `ComboSearchParams.page`
  became `offset`, `ComboSearchData` gained `next_offset`, and the tool schema and description
  moved with them. **`Status` stays `specified` and no criterion changed verification state** —
  criterion 8 was reworded to name the budget and the offset contract rather than a count, and is
  still verified in its `combo_search` half only. Measured live: `card:"Thassa's Oracle"` walks 96
  combos in **3 pages of 47, 30 and 19**, `cards>5 steps>5` its 41 in **3 pages of 16, 23 and 2**,
  no page above **49,473** characters, every combo reached exactly once.
  [§4.4.1](#441-the-combo-payload-is-enormous--measured)'s third addendum carries the probes and
  the walk. **This supersedes the 40 → 20 note above**, which stands as the record of a step that
  really shipped.
- **Delivery note (2026-08-25).** Track A [Slice 17](./slices/TrackA-Slice17.md) landed
  `combo_find_deck` and **all fourteen acceptance criteria are verified**, so `Status` moves
  `specified` → `delivered` and Phase 2 is complete. `src/scryfall/collection.ts` batches
  `POST /cards/collection` at 75 identifiers ([§4.1.2](#412-batch-resolution)) and reads `not_found`
  into a required `unresolved_cards`; `src/tools/combo-find-deck.ts` issues **one** upstream combo
  request per call carrying **no `limit` and no `offset`**, classifies the six buckets matched-first
  with the upstream names verbatim, and caps **after**. Criteria **4, 5, 9, 10 and 13** are verified
  in full and the remaining halves of **1, 8 and 14** with them; 2, 3, 6, 7, 11 and 12 were already
  verified by [Slice 15](./slices/TrackA-Slice15.md) and
  [Slice 16](./slices/TrackA-Slice16.md). Evidence: 70 suites / 297 tests against a 56 / 215
  baseline, `tools/list` reporting **three** tools on the rebuilt bundle, `npm run acceptance`
  13/13 with no 429, and one live run recorded in
  [`docs/slices/TrackA-Slice17-results.md`](./slices/TrackA-Slice17-results.md). **The live run
  used a different deck from [§4.4.1](#441-the-combo-payload-is-enormous--measured)'s and measured
  its own raw figure beside its shaped one** — that section's 94-card list was not recoverable from
  a captured response, so 640,684 is **not** the comparator: the same 100-card deck measured
  **1,005,265** characters raw, **1,073** shaped under the default `include: "matched"` (0.11%), and
  **48,660** shaped for page 1 of `"matched+near"` (45 of 229 combos, `next_offset: 45`). The
  invented name appeared in `unresolved_cards`. `BYTE_BUDGET`, `ENVELOPE_RESERVE` and the page
  filler now live in `src/spellbook/combos.ts` and serve both tools, so the capability's **one**
  budget is one constant; the evidence that the lift changed nothing is `combo_search`'s own suite
  passing unedited. **No `D-` was minted**, [§2](#2-locked-decisions) and [§3](#3-constraints) are
  untouched, and no [`docs/PLUGIN-PRD.md`](./PLUGIN-PRD.md) criterion changed status. **All three
  open questions stay open by explicit decision** — see their dated paragraphs in
  [§7](#7-open-questions).
- **Open-question note (2026-08-25, after delivery).** The Commander Spellbook admins replied to
  the Discord message this capability shipped without
  ([§4.4](#44-commander-spellbook)), and **two of the three open questions moved**.
  [OQ-06](#oq-06--is-commander-spellbooks-combo-data-licensed-as-distinct-from-its-code) is
  **closed**: explicit permission to consume, no licence text, and no redistribution grant.
  [OQ-05](#oq-05--do-commander-spellbook-or-archidekt-impose-rate-limits) is **answered for the
  Commander Spellbook third only** and stays open for Archidekt and Moxfield; **no rate was given**,
  so the 500 ms lane does not move.
  [OQ-14](#oq-14--how-should-commander-spellbook-query-syntax-be-surfaced-to-the-model) is
  untouched. **No code changed** — the admins' stated shape is *few HTTP calls per user
  interaction* and *do not sweep hundreds of result pages*, and this capability already issues one
  upstream request per tool call and reports paging rather than resolving it. That was decided for
  the model's context budget and now has a second, independent reason to hold. **No criterion
  changed status and `Status` stays `delivered`.**

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

**No phase changed on 2026-08-11, and [CAP-01](#cap-01--card-search)'s image criterion is
deliberately unscheduled.** [OQ-13](#oq-13--should-a-card-search-result-carry-image-uris-and-at-what-cost)
amended a Phase 1 capability that is already delivered, which is a shape this section has not had
to describe before — Phase 1 stays complete, because a delivered phase is complete against the
criteria it was delivered against and criterion 15 is not among them. It is unscheduled rather
than queued because it is not a capability and has no row in the table below: it adds a field to a
capability that exists, and the thing that wants it is
[`docs/PLUGIN-PRD.md` PC-04](./PLUGIN-PRD.md#pc-04--card-viewer), whose own scheduling is that
document's to decide. **Do not read the unscheduled state as low value or as deferred-by-doubt** —
the decision is taken and the measurement is done; what is missing is a slice, and the slice
belongs with whichever session commits to the component. The one ordering constraint worth
recording: the component cannot ship before this does, so a plan that schedules
[PC-04](./PLUGIN-PRD.md#pc-04--card-viewer) without scheduling criterion 15 first has the
dependency backwards.

**Phase 2 — Combo discovery.** [CAP-02](#cap-02--combo-discovery) alone. **Specified 2026-08-24,
delivered 2026-08-25.**

Built across three slices rather than one: [Slice 15](./slices/TrackA-Slice15.md) generalized the
transport and added the POST verb, [Slice 16](./slices/TrackA-Slice16.md) landed `combo_search` and
the normalized combo shape, and [Slice 17](./slices/TrackA-Slice17.md) landed `combo_find_deck` and
closed the capability against all fourteen criteria. **The phase is complete in this document's
sense and no further**: two tools are registered and verified, and — exactly as Phase 1's note
records for [CAP-01](#cap-01--card-search) — that is not the same as the *product* being shippable.
[`docs/PLUGIN-PRD.md`](./PLUGIN-PRD.md) owns whether a second query language earns a skill or a
reference file, and no component criterion moved.

Assigned here rather than left unassigned because the session that specified it is the session
this document says owns the call, and because the dependency graph makes the answer unusually
clear. It needs **no credential, no local persistence, and no other capability** — the decklist
arrives as card names, so it does not wait on
[D-13](#d-13--deck-platform-order-archidekt-first-moxfield-second)'s deck-platform ordering, and
it introduces no bulk data, so it does not touch
[OQ-03](#oq-03--what-is-the-bulk-data-storage-strategy-and-when-is-it-introduced). Its only
Scryfall use is [§4.1.2](#412-batch-resolution) batch name resolution, which
[CAP-01](#cap-01--card-search) already established the client and the rate-limit discipline for.
That makes it the cheapest capability in the queue to build next and the only one that could have
been built first instead of [CAP-01](#cap-01--card-search).

**This reorders nothing.** No other queued capability's position changes, no phase is renumbered,
and Phase 1 is untouched — it stays complete against
[CAP-01](#cap-01--card-search)'s criteria 1–14, and criterion 15 stays unscheduled for the
reasons stated above. Phase 2 is a new phase appended, not a resequencing of the table below.

**Nine capabilities are queued and unassigned.** Phase assignment happens in the sessions
that specify them, not here. They are, with the dependencies already visible from [§4](#4-external-dependencies):

| Queued capability | Primary source | Notes from research |
|---|---|---|
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

**Answered and closed 2026-08-10 — both levers are implemented and issue #25 is fixed.**
[Slice 14](./slices/TrackA-Slice14.md) shipped them together, in
[`src/tools/card-search.ts`](../src/tools/card-search.ts). The paragraph above reading "**Nothing is
implemented.**" is true only of its own date and is left as written.

1. **The trim.** `legalities: "queried" | "default" | "all"`, defaulting to `"queried"`, exactly as
   decided. The queried set comes from a **scan, not a parse** — `q` is read to choose which keys to
   keep and the bytes sent to Scryfall are unchanged
   ([D-07](#d-07--three-way-cache-split)) — and it degrades to the seven paper formats on any miss,
   so a scan failure costs bytes and never correctness. **The trim never yields an empty map**,
   which is the guard that keeps a lookup miss from becoming a normal-looking wrong answer.
2. **The cap is 88 cards, not the ~120 this answer estimated**, and the difference is a correctness
   fix rather than a tightening. Scryfall's `page` parameter is in units of **175** and the endpoint
   has **no offset**, so a 120-card cap over a 175-card page would leave cards 121–175 reachable by
   **no `page` value at all** — a silent loss strictly worse than the payload problem the cap exists
   to fix. Halving the upstream page instead makes our page *n* the half-page at
   `floor((n-1)/2)+1`, offset `((n-1) % 2) * 88`, so every card is reachable at **one upstream
   request per call** — which also keeps the [§3.4](#34-rate-limits-are-hard-constraints-not-guidance)
   budget flat. The halves are 88 and 87; page counts therefore anchor to upstream pages, and a
   176-card result is **3** of our pages where `ceil(176/88)` says 2.
3. **The scope is reported**, once per response, as `legalities_mode` and `legalities_included`
   (~100 characters against tens of thousands saved), because an absent key must never read as "not
   legal" ([§3.6](#36-error-surface)).

**Measured.** Issue #25's exact query, live through the built server: **116,626 → 53,043
characters**, 88 cards with `has_more: true` where Scryfall reported `has_more: false`, and page 2
returning the remaining 23 — all 111 cards reachable. The 175-card fixture shapes to **39,844**
characters under the queried trim against the 169,504 recorded in
[§4.1.1](#411-search-endpoint). Note the live figure is well above the fixture's: per-card cost
varies with the cards a query returns, exactly as this answer warned, so the acceptance test asserts
a bound rather than a number. Evidence:
[`docs/slices/TrackA-Slice14-results.md`](./slices/TrackA-Slice14-results.md).

`oracle_text` was **not** trimmed, as decided. No `D-` decision was minted: this is an
implementation of an existing answer, and [§2](#2-locked-decisions) is untouched.

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

**2026-08-25: [CAP-02](#cap-02--combo-discovery) shipped with this open, by explicit decision, and
the question is not weakened by having shipped.** [Slice 17](./slices/TrackA-Slice17.md) delivered
the capability against a Commander Spellbook lane of **one request per 500 ms**. **That figure is
[§3.7](#37-undocumented-and-bot-protected-third-party-apis)'s conservative strictest-lane rule
applied, not a measured fit** — nothing has been observed that would justify loosening it, and
nothing has been observed that confirms it is needed. Three slices of live work across
2026-08-24/25 — the research probes, [Slice 16](./slices/TrackA-Slice16.md)'s ordering probe and
paging walk, and [Slice 17](./slices/TrackA-Slice17.md)'s deck run — encountered **no 429 and no
rate-limit header of any kind**, which is consistent with a generous limit and equally consistent
with a limit this lane never approaches. Absence of evidence remains absence of evidence.

**It resolves only when a third party replies, which is why shipping does not force it.** The
Discord message to the Commander Spellbook admins is still outstanding and is the single action
that would answer both this and
[OQ-06](#oq-06--is-commander-spellbooks-combo-data-licensed-as-distinct-from-its-code) — one
message, two questions. The cost of leaving it open is a slower sweep across many pages, not a
wrong answer, and [§3.7](#37-undocumented-and-bot-protected-third-party-apis) already states the
standing rule for a source that has not answered.

**Answered 2026-08-25 for the Commander Spellbook third only — the admins replied, and the answer
is "no stated rate, but here is a usage shape."** The reply is recorded in full at
[§4.4](#44-commander-spellbook). **Commander Spellbook imposes no published requests-per-second
limit and exposes no rate-limit header**, which this document had already verified as absent; what
the admins added is a contract in a different unit — *"few http calls per user interaction with
your tool"*, and an explicit request to *"refrain from using it to bulk export data, consuming
hundreds or more result pages"*, with the bulk JSON file plus a periodic update task named as the
sanctioned route for anything at that scale.

**The 500 ms lane does not move, and the reason is worth stating so a later session does not read
this as permission.** A usage guideline in calls-per-interaction is not a rate, so there is no
measured figure to loosen toward — [§3.7](#37-undocumented-and-bot-protected-third-party-apis)'s
"self-throttle conservatively where no limit is published" still applies on its own terms. What
changed is the lane's standing: it was a default against a source that had said nothing, and it is
now a deliberate conservatism against a source that has said it is friendly but unquantified.

**[CAP-02](#cap-02--combo-discovery) already satisfies the stated shape, and did so before the
reply arrived** — one upstream request per tool call, paging reported rather than resolved, no bulk
file, no persistence. That was decided for the model's context budget; it now has a second,
independent justification, and **no code changed as a result of this answer**.

**The other two thirds of this question stay open.** The heading names Commander Spellbook and
Archidekt, and the 2026-08-07 widening added Moxfield. **Archidekt and Moxfield have still said
nothing** and are still `[verified absent — meaning unknown]` at [§4.5](#45-archidekt) and
[§4.8](#48-moxfield). Moxfield's channel is
[OQ-10](#oq-10--will-moxfield-grant-this-application-approved-access-and-under-what-terms).
**Do not record this question as closed** — it covers three sources and one has answered.

### OQ-06 — Is Commander Spellbook's combo *data* licensed, as distinct from its code?

The code is MIT; the data has no stated license and there is no ToS page ([§4.4](#44-commander-spellbook)).
*Resolves by:* asking the project admins. Low urgency — the data is served anonymously by a
project that exists to distribute it, and EDHREC already consumes it.

**2026-08-25: [CAP-02](#cap-02--combo-discovery) shipped with this open, by explicit decision.**
[Slice 17](./slices/TrackA-Slice17.md) delivered a capability that returns Commander Spellbook's
combo data to a user, which is the act this question is about, and it is recorded here rather than
quietly passed over. **The position is unchanged and stated plainly: the backend is MIT and the
combo *data* carries no stated licence at all** — not a permissive one, not a restrictive one. The
working treatment is [§4.4](#44-commander-spellbook)'s, marked `[inferred]` there and still
inferred now: served anonymously by a community project that exists to distribute it, already
consumed by EDHREC, so treat as permitted, cache politely, credit the project.

Two things this slice does that keep the exposure small, neither of them an answer. **No bulk file
is downloaded** — `variants.json.gz` stays rejected, so nothing redistributable is held. And **no
persistence of any kind** was introduced: every combo is fetched per call and returned, never
stored. If the answer ever comes back restrictive, what has to change is a live fetch path rather
than a corpus already on disk. **One Discord message to the admins answers this and
[OQ-05](#oq-05--do-commander-spellbook-or-archidekt-impose-rate-limits) together**, and it is still
outstanding.

**Answered and CLOSED 2026-08-25 — with a precise verdict, because the obvious summary of it is
wrong.** The admins replied ([§4.4](#44-commander-spellbook)). **They granted explicit permission
to consume, and they did not state a licence.** Those are different things, and this entry closes
on the first without inventing the second: *"You can use the HTTP API to make unauthenticated
sparse requests"*, with both bulk-file URLs offered by name as the sanctioned route for anything
larger. The data still carries **no licence text**, there is still **no ToS page**, and the MIT
licence still covers the code alone.

**What that settles.** [§4.4](#44-commander-spellbook)'s working treatment — carried there as
`[inferred]` since 2026-07-29 — is now the source owner's own position rather than this project's
reading of the circumstances, and retiring that `[inferred]` is exactly what the reply does.
Consuming the API and returning combos to a user is sanctioned by the people who run it. Credit the
project, which every user-facing surface already does.

**What it does not settle, and what a later capability must not read into it.** Permission to
*consume* is not a grant to *redistribute*. Nothing in the reply says this project may republish the
combo corpus, and the bulk file being offered for download is not that statement either. Any future
capability that stores or ships combo data — as against fetching it per call, which is all
[CAP-02](#cap-02--combo-discovery) does — falls outside what this answer covers and needs its own
ask. That boundary is narrow enough to state now rather than rediscover later, and it is why this
entry closes as **permitted** rather than as **licensed**.

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

### OQ-13 — Should a card search result carry image URIs, and at what cost?

Opened and answered 2026-08-11. Raised from outside this document by
[`docs/PLUGIN-PRD.md` PQ-10](./PLUGIN-PRD.md#pq-10--does-cap-01-gain-an-image-uri-and-what-does-that-cost),
which is blocking [PC-04](./PLUGIN-PRD.md#pc-04--card-viewer) (a card viewer) and correctly refused
to specify around it: [CAP-01](#cap-01--card-search) returns no per-card handle of any kind — no
`id`, no image field, no artist field — so a component that needs to show a card cannot be built
against what this document currently promises. Recorded here as its own question rather than
folded into [OQ-02](#oq-02--how-verbose-should-a-search-result-be), which is closed and whose
subject is the opposite one: [OQ-02](#oq-02--how-verbose-should-a-search-result-be) removed bytes
nobody asked for, and this adds bytes somebody did.
*Resolves by:* deciding whether [CAP-01](#cap-01--card-search) returns an image URI, behind what
default, and at what measured cost to a full page.

**Answered: `images: "none" | "normal"`, defaulting to `"none"`, returning an array of Scryfall
`normal` URIs — one per face.** [CAP-01](#cap-01--card-search)'s behavior gains two bullets and an
acceptance criterion 15. **Nothing is implemented**, no criterion changed status, and
[CAP-01](#cap-01--card-search) stays delivered against 1–14.

**Measured, which is what the question asked for.** One live 175-card page of
`f:commander t:creature` shaped through the delivered `cardSearch`
([§4.1.4](#414-card-image-uris), 2026-08-11). Page 1 is 88 cards and **45,754 characters** under
the queried-legality default. Adding the array of every face's `normal` URI costs **+9,888
characters, +21.6%**, at 112.4 characters per card; front-only would be +9,240 and is rejected
below. That lands a full opted-in page near 55,600 characters against the **116,626** that breached
a harness tool-result ceiling in issue #25 and the **53,043** that replaced it — so an opted-in
page is *slightly worse than the payload that currently ships* and still comfortably inside the
known-bad figure. It is affordable precisely because it is off by default, and it would not have
been affordable three days ago at 175 cards per page.

**Why an opt-in rather than always-on, when [OQ-02](#oq-02--how-verbose-should-a-search-result-be)
distrusted model-set parameters.** That distrust is real and it is recorded in this document, so
it has to be answered rather than stepped around: the 2026-08-04 answer rejected a `fields` /
`verbose` parameter because *nothing in a well-formed query predicts an oversized result*, so the
call that fails is exactly the call that forgot to set it. **The asymmetry is direction.** That
parameter was subtractive and defaulted to expensive, so forgetting it produced a call that failed
with no signal available at query time. This one is additive and defaults to cheap, so forgetting
it produces a call that succeeds and shows no picture — a visible, recoverable outcome the model
can fix on the next call, which is the same self-correction contract
[D-10](#d-10--tool-handlers-never-throw) is built on. A default of `"none"` also means every
existing consumer is byte-identical after this ships, which is what criterion 15's first half
asserts.

**Why not a bare card `id`, which is less than half the bytes.** Returning the 36-character `id`
costs **+3,872 characters, +8.5%** — measurably cheaper, and rejected on two grounds.
[§4.1.4](#414-card-image-uris) verifies that the image URL *is* derivable from the `id` and that
the `?timestamp` is optional, so this option is real rather than theoretical; what it buys is a
hardcoded URL template for a scheme Scryfall does not document as stable, whose breakage would
present as every card image failing at once with no error anywhere. The second ground is the
decisive one and it is a [§3.4](#34-rate-limits-are-hard-constraints-not-guidance) argument, not a
byte argument: a consumer that does *not* assemble the URL has to exchange the `id` for one
through `/cards/{id}`, which is the **2/second** lane, issued by a client sitting outside this
server's two rate-limit lanes. That is two independently throttled callers inside one application,
against a section that is explicit each local copy must be well-behaved on its own. An image URI
resolves on `cards.scryfall.io`, rated **unlimited** by the same section, so it removes the
conflict rather than managing it.

**Why an array, and why `normal`.** [§4.1.4](#414-card-image-uris) verifies that a transform card
carries no top-level `image_uris` at all — the object lives on each `card_faces` entry — so a
single-URI field would be either absent or wrong on every double-faced card, and 6 of 175 cards on
the sampled page were exactly that. An array costs 648 characters over front-only across a full
page and removes a whole class of silent gap. `normal` rather than `large` or `png` because it is
the readable card face at the smallest size, and rather than `art_crop` because
[§3.3](#33-legal-and-terms-of-service) requires the artist and copyright stay identifiable and the
full face carries both in its own border — which is also why no artist field was added.

**What this does not settle.** No verbose mode beyond the two enum values, no `large`/`png`
option, and no answer to whether an opted-in page needs its own cap — the 88-card cap was sized
against a payload without images, and 55,600 characters is a projection from one query's cards,
which [OQ-02](#oq-02--how-verbose-should-a-search-result-be) already established varies by at
least 8% with what a query returns.
*Resolves by:* implementing the parameter with unit tests including a real multi-faced card, then
one live search confirming an opted-in page through a real harness rather than a local
measurement — and, separately,
[`docs/PLUGIN-PRD.md` PQ-10](./PLUGIN-PRD.md#pq-10--does-cap-01-gain-an-image-uri-and-what-does-that-cost)
recording this answer on its own side, which is that document's to do and not this one's.

### OQ-14 — How should Commander Spellbook query syntax be surfaced to the model?

Opened 2026-08-24 by [CAP-02](#cap-02--combo-discovery). `combo_search` takes a Commander
Spellbook query string and passes it through unevaluated, which means the model has to write one —
and this project has surfaced exactly one query language before. This is
[OQ-01](#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) one source over, and the
candidates are the same: a long tool description, a separate syntax tool, an MCP resource, or a
plugin skill.

**It does not block [CAP-02](#cap-02--combo-discovery), and the reason is a measured difference
from [OQ-01](#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) rather than optimism.**
Scryfall **silently drops** an unrecognized term and answers from fewer constraints
([§4.1.1](#411-search-endpoint)), so a model guessing at its syntax produces a wrong answer that
looks right — which is what made [OQ-01](#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model)
urgent. Commander Spellbook returns **HTTP 400 naming the offending character's position**
([§4.4](#44-commander-spellbook)), so a guess fails loudly and the model retries against a real
error message. The cost of leaving this unanswered is therefore wasted calls, not wrong answers,
and [CAP-01](#cap-01--card-search) shipped with
[OQ-01](#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) open on strictly worse terms.

Two things already known that a session answering this should not re-derive. Commander Spellbook
publishes a syntax guide at `commanderspellbook.com/syntax-guide/`, and **`/explain-query?q=`
validates and explains a query server-side** ([§4.4](#44-commander-spellbook)) — which is a third
option [OQ-01](#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) never had: the source
itself will tell you whether a query means what you intended, before you spend a call on it.
Whether that is worth a tool of its own is part of this question.

**There is a plugin-side half this document does not own.**
[PC-01](./PLUGIN-PRD.md#pc-01--scryfall-query-craft) teaches Scryfall syntax, and a second query
language is either a second reference file inside that skill or a second skill — a choice that
belongs to [`docs/PLUGIN-PRD.md`](./PLUGIN-PRD.md) and costs context budget measured there, not
here. Recorded so that whoever answers this half does not discover the other one late.
*Resolves by:* the same method
[OQ-01](#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) used and this document should
reuse — build the tool description first, measure whether Claude writes valid combo queries from
plain-English requests **against a baseline with no syntax help**, and add teaching only where the
measurement shows a gap. That measurement cannot run until
[CAP-02](#cap-02--combo-discovery) is built, so this question waits on the build slice rather than
on a decision.

**2026-08-25: the build slice landed and this stays open — it does not block, and it never did.**
[Slice 17](./slices/TrackA-Slice17.md) closed [CAP-02](#cap-02--combo-discovery) with this
question untouched, exactly as [CAP-01](#cap-01--card-search) shipped with
[OQ-01](#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) open and on strictly worse
terms. **What changed is availability, not urgency:** both tools now exist, so the measurement
method above can finally run, and the thing that was blocking it was the build rather than a
decision.

**It was not run in the delivering slice, deliberately.** The eval method
[OQ-01](#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) established is a session's
work of its own — fresh isolated subagents, a clean without-skill baseline, and many live calls —
and folding it into a build slice is how a measurement gets taken badly. It is post-delivery work,
not follow-up nobody owns.

**Two things a session answering it should not re-derive.** The
`combo_search` description as shipped already names the source, the byte-sized paging contract and
`format`'s refusal behaviour but teaches **none** of the query language, so it is a genuine
no-syntax-help baseline rather than a contaminated one — that is the confound
[`docs/slices/TrackB-Slice9-results.md`](./slices/TrackB-Slice9-results.md) recorded and it is
avoided here by construction. And **the plugin-side half is unchanged and still belongs to
[`docs/PLUGIN-PRD.md`](./PLUGIN-PRD.md)**: whether a second query language is a second reference
file inside [PC-01](./PLUGIN-PRD.md#pc-01--scryfall-query-craft) or a second skill costs context
budget measured there, not here.

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

**The npm `@space-cow-media/spellbook-client` package as a dependency.** Rejected by
[D-16](#d-16--no-npm-commander-spellbook-client-dependency) — and on the weakest grounds of the
three, because it is the **strongest** package this project has evaluated: first-party, MIT, zero
runtime dependencies, version-locked to the API, and it sets a configurable `User-Agent`, which is
the requirement [D-14](#d-14--no-npm-moxfield-api-dependency) found the Moxfield package could not
meet. It is listed here anyway, and the reason to read
[D-16](#d-16--no-npm-commander-spellbook-client-dependency) rather than this line is that "rejected"
means something narrower here than in the two entries above: it would not *replace* the in-house
client but sit beside it, since Scryfall name resolution, Archidekt and Moxfield all still need
one. Its bundle cost is recorded as **unmeasured**, not as disqualifying.

**Reimplementing Commander Spellbook's combo matcher from bulk data.** Rejected for the same
reason as the Scryfall entry above, one source over. There is a gzipped bulk file at a perfectly
ordinary 26.1 MB ([§4.4](#44-commander-spellbook)), so the tempting reading is that the old "606 MB"
objection was simply wrong — it was incomplete, and the real objection is different: matching a
decklist is **computation**, and its six output buckets carry distinctions
[CAP-02](#cap-02--combo-discovery) depends on being exactly right. A local divergence would produce
a correctly-shaped, wrongly-labelled answer rather than a visible failure.

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
| 2026-08-08 | **The twelve-versus-thirteen discrepancy raised by the 2026-08-07 [OQ-02](#oq-02--how-verbose-should-a-search-result-be) row is settled — by propagation, not by a new decision.** [CAP-01](#cap-01--card-search)'s own **Delivery-note addendum (2026-08-07)** had already stated the substance plainly — delivered against criteria 1–12, criterion 13 added 2026-08-04 and not implemented — but four summaries elsewhere still read "all twelve acceptance criteria are verified" with no mention of a thirteenth: this document's status header, [`docs/DEV-ROADMAP.md`](../docs/DEV-ROADMAP.md) §2, [`README.md`](../README.md), and [`CLAUDE.md`](../CLAUDE.md). All four now say **1–12** and name criterion 13 as outstanding. **Nothing dated was rewritten** — the 2026-08-03 delivery note and the 2026-08-07 addendum are untouched — **no criterion changed status, and [§5](#5-capabilities) is unedited.** Whether criterion 13 is widened to cover [OQ-02](#oq-02--how-verbose-should-a-search-result-be)'s page cap, or a fourteenth added, still belongs to the slice that implements the trim. | The addendum was correct and invisible. A reader who opens a header, a roadmap, or a README — which is most readers, and every new session — got "all twelve verified" with nothing to suggest a thirteenth existed, so the resolution lived only in the one place a reader already deep in the block would find. That is the same shape as this project's other silent failures: the record was right and the thing anyone actually reads was wrong. Propagating it costs nothing and removes the last surface that can teach a future session the wrong count. Recorded as its own row rather than folded into a slice, because it is documentation hygiene across two documents and belongs to neither. |
| 2026-08-10 | **[OQ-02](#oq-02--how-verbose-should-a-search-result-be) is closed — both levers implemented, and issue #25 is fixed.** Track A [Slice 14](./slices/TrackA-Slice14.md). `legalities: "queried" \| "default" \| "all"` defaulting to `"queried"`, over a **scan** of `q` that never parses or rewrites it ([D-07](#d-07--three-way-cache-split)) and degrades to the seven paper formats on any miss, so the map is **never empty**; plus a server-enforced page cap. **The cap is 88, not the ~120 this question estimated** — Scryfall's `page` is in units of 175 with no offset, so a 120-cap would strand cards 121–175 behind no `page` value at all; half an upstream page keeps every card reachable at one upstream request per call. `has_more` is now ours to compute, and two new fields (`legalities_mode`, `legalities_included`) report the scope so an absent key never reads as "not legal" ([§3.6](#36-error-surface)). **[CAP-01](#cap-01--card-search) criterion 13 verified and a criterion 14 added and verified — delivered against 1–14.** Live: **116,626 → 53,043 characters** on issue #25's exact query, all 111 cards reachable across 2 pages, `npm run acceptance` 13/13 with no 429. Three live findings in [§4.1.1](#411-search-endpoint): `format:` and `legal:` are real format operators, `f:edh` is an accepted value that is not a legality key, and a page past the end is HTTP **422**, not 404. No new `D-`; [§2](#2-locked-decisions)/[§3](#3-constraints) untouched. | The trim alone was already measured and refuted as sufficient, so shipping half of this would have closed nothing — 88,953 characters against a ceiling 116,626 had breached. Two independently falsifiable criteria rather than one widened criterion 13, because the levers were decided three days apart and fail differently: a broken trim returns wrong legality scope, a broken cap strands cards, and one criterion covering both can half-pass. The page size is the one place this slice overrode its own decision record, and it is recorded as a correctness fix rather than a tightening: "near 120" was an estimate of a byte budget, made before anyone had checked that 120 is unreachable in a 175-unit paging scheme. The alias and 422 findings both belong to the family this project keeps paying for — a normal-looking response carrying a wrong answer — and both are now guarded in code rather than remembered. |
| 2026-08-11 | **[OQ-13](#oq-13--should-a-card-search-result-carry-image-uris-and-at-what-cost) opened and answered: [CAP-01](#cap-01--card-search) gains `images: "none" \| "normal"`, defaulting to `"none"`, returning an array of Scryfall `normal` URIs — one per face.** [CAP-01](#cap-01--card-search)'s behavior gains two bullets (the parameter, and a stated no-artist-field decision) and an **acceptance criterion 15**. New [§4.1.4](#414-card-image-uris) records the image research live. **Nothing is implemented, no criterion changed status, and [CAP-01](#cap-01--card-search) remains delivered against criteria 1–14** — a delivery-note addendum says so, because the 2026-08-08 row exists entirely because a criterion count went stale in four places at once. [§6](#6-phases) records that no phase moved and that criterion 15 is unscheduled rather than queued. **No `D-` decision was added or amended; [§2](#2-locked-decisions), [§3](#3-constraints) and [§8](#8-out-of-scope) are untouched**, and no existing CAP block other than [CAP-01](#cap-01--card-search) was edited. | Raised from outside this document by [`docs/PLUGIN-PRD.md` PQ-10](./PLUGIN-PRD.md#pq-10--does-cap-01-gain-an-image-uri-and-what-does-that-cost), which is blocking [PC-04](./PLUGIN-PRD.md#pc-04--card-viewer) and refused to specify around a server gap — [CAP-01](#cap-01--card-search) returns no per-card handle at all, so a viewer cannot be built against what this document promises. The measurement is the substance: page 1 is 45,754 characters and the image array costs **+9,888, +21.6%**, landing an opted-in page near 55,600 against the 116,626 that breached a harness ceiling and the 53,043 that replaced it. **A bare `id` is less than half the bytes (+3,872, +8.5%) and was rejected anyway**, on [§3.4](#34-rate-limits-are-hard-constraints-not-guidance) grounds rather than byte grounds: exchanging an id for a URL is a `/cards/{id}` call on the **2/second** lane from a client outside this server's two lanes, which is two independently throttled callers in one application, whereas `cards.scryfall.io` is rated unlimited. The opt-in had to answer [OQ-02](#oq-02--how-verbose-should-a-search-result-be)'s recorded distrust of model-set parameters rather than ignore it, and the answer is **direction** — that one was subtractive and defaulted to expensive, so forgetting it failed a call invisibly; this one is additive and defaults to cheap, so forgetting it shows no picture and is recoverable on the next call. An **array** rather than one URI because [§4.1.4](#414-card-image-uris) verifies a transform card has no top-level `image_uris` at all, which would have made a single field silently wrong on 6 of the 175 cards sampled. The two facts [PQ-10](./PLUGIN-PRD.md#pq-10--does-cap-01-gain-an-image-uri-and-what-does-that-cost) carried as `[inferred]` are now verified — the 403 was on `scryfall.com`'s docs pages, and the API itself answered normally. |
| 2026-08-24 | **[§4.4](#44-commander-spellbook) gains four dated addenda and a new [§4.4.1](#441-the-combo-payload-is-enormous--measured), from nine spaced live calls.** The API is on **version 6.2.6 / 32 paths** against the 5.7.5 / 31 recorded 2026-07-29, and the request and response shapes are recorded for the first time: `/find-my-combos` takes a `DeckRequest` of up to 600 main and 12 commanders, and its `results` is an **object of six buckets**, only two of which name combos a deck contains. Three behaviors decide the capability's shape — **`limit` does not prioritize `included`** (at `limit=5`, four matched and one near-miss, reproducible, while the full result's first eight are all matched); **an unrecognized card name is silently ignored** with no endpoint anywhere reporting it, `/card-list-from-text` being a pure text parser; and **an invalid operator is a loud HTTP 400 naming the character position**. A `GET` with no deck returns HTTP 200 carrying the whole corpus as near-misses. [§4.4.1](#441-the-combo-payload-is-enormous--measured) measures **640,684 characters for one 94-card deck** — `included` **5.4%**, `almostIncluded` **64.5%**, `imageUri*` fields **41.9%** — and **533,840 characters for one card's 96 combos** with `next: null`, `/variants/` having no default page cap; Dockside Extortionist is in **476** combos. The trim was measured on the same payloads at **76–78% smaller, 930–1,236 characters per combo**. No rate-limit header on any of the nine responses, re-confirming [OQ-05](#oq-05--do-commander-spellbook-or-archidekt-impose-rate-limits)'s *verified absent, meaning unknown*. **Nothing already in [§4.4](#44-commander-spellbook) was edited**, and no [§2](#2-locked-decisions)/[§3](#3-constraints)/[§8](#8-out-of-scope) text changed. | The 2026-07-29 record was conclusive about the *mechanism* and silent about every shape and every byte, which is enough to queue a capability and not enough to specify one. The payload figures are the substance: this is [§4.8.1](#481-the-deck-payload-is-enormous--measured)'s situation a second time — a source whose natural response is multiples of a ceiling this project has already breached (issue #25, 116,626 characters) — except that here it was measured **before** the spec rather than after delivery, which is the whole difference between a trim that is load-bearing from line one and one that arrives as a bug report. The `limit` finding is the one most likely to be lost: it is invisible at any large limit, it reproduces exactly, and acting on the obvious reading of it would ship a tool that quietly omits the combos a user actually has. Appended as dated addenda plus a child subsection, per [§4](#4-external-dependencies)'s every-claim-is-dated property and because numbering [§4.4.1](#441-the-combo-payload-is-enormous--measured) under [§4.4](#44-commander-spellbook) renames no existing heading. |
| 2026-08-24 | **[CAP-02](#cap-02--combo-discovery) (combo discovery) specified and assigned Phase 2.** `Status: specified`, fourteen acceptance criteria, served by **two tools — `combo_search` and `combo_find_deck`**. `combo_search` passes a Commander Spellbook query through unevaluated, exactly as [CAP-01](#cap-01--card-search) does for Scryfall; `combo_find_deck` takes a card-name list and commanders, **never a deck URL**. Near-misses sit behind `include: "matched" \| "matched+near"` defaulting to `"matched"`; a page carries at most **40** combos; card names are resolved through [§4.1.2](#412-batch-resolution) before the combo call so an unrecognized one is reported rather than dropped; Commander Spellbook prices and `imageUri*` fields are never returned; Commander Spellbook gets its **own** 2/second lane. [§6](#6-phases) gains a Phase 2 entry, the queued table loses its Combo discovery row, and **ten queued capabilities become nine**; the document status header moves from one specified capability to two. **No `D-` decision was minted, [§2](#2-locked-decisions), [§3](#3-constraints) and [§8](#8-out-of-scope) are untouched, no existing CAP block was edited, and no [CAP-01](#cap-01--card-search) criterion changed status.** Nothing is implemented. | Requested directly, using [`docs/prompts/02-add-capability-prompt.md`](./prompts/02-add-capability-prompt.md). Four design choices were put to this document's owner and all four were taken. **Two tools rather than one** departs from [OQ-12](#oq-12--what-is-the-normalized-deck-shape-and-does-one-tool-serve-both-platforms-or-two)'s one-tool `deck_read` and does not disturb it — there, two platforms answered the *same* question over the same input; here two inputs answer different questions, and [`docs/PLUGIN-PRD.md` PQ-01](./PLUGIN-PRD.md#pq-01--do-an-mcp-servers-tool-schemas-count-toward-the-always-on-cost-that-claude-plugin-details-reports) measured a second schema at 0 resident tokens, so the only real cost of one tool would have been a one-of schema the model can get wrong in two directions. **Scryfall pre-validation** is the session's least obvious decision and the one the measurements forced: it puts two requests on the 2/second lane into a capability that otherwise never touches Scryfall, bought purely to convert a silent omission into a reported one. **The cap is 40 and is applied after classification**, which is where [CAP-01](#cap-01--card-search)'s 88-card arithmetic explicitly does *not* transfer — Commander Spellbook has a true `offset`, so no half-page trick is needed, while pushing the cap upstream as `limit` would reintroduce the exact ordering trap recorded in the row above. Phase 2 was assigned here rather than deferred because [§6](#6-phases) says the specifying session owns that call and the graph is unambiguous: no credential, no persistence, no dependent capability, and specifically **no dependency on deck reading**, since the decklist arrives as card names. |
| 2026-08-24 | **[OQ-14](#oq-14--how-should-commander-spellbook-query-syntax-be-surfaced-to-the-model) opened — how Commander Spellbook query syntax reaches the model.** The [OQ-01](#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) question one source over, raised by `combo_search` exposing a second query language. Recorded as **not blocking** [CAP-02](#cap-02--combo-discovery), with a plugin-side half ([PC-01](./PLUGIN-PRD.md#pc-01--scryfall-query-craft) teaches one syntax already) named as belonging to [`docs/PLUGIN-PRD.md`](./PLUGIN-PRD.md) rather than answered here. A row was added to [`OPEN-QUESTIONS.md`](../OPEN-QUESTIONS.md) and its intro counts moved from 26 to 27 and from 13 `OQ-` to 14. | It does not block because the failure mode is measurably milder than the one that made [OQ-01](#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) urgent: Scryfall silently drops an unrecognized term and returns a confident wrong answer, whereas Commander Spellbook returns HTTP 400 naming the character position, so a bad guess costs a call and teaches the model rather than misinforming the user. Stating that reasoning matters more than the verdict — a future session reading two open syntax questions side by side would otherwise treat them as the same risk and prioritize wrongly. It also cannot be answered yet by the method [OQ-01](#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) established, which is measurement against a no-help baseline, and there is nothing to measure until the tool exists. |
| 2026-08-24 | **[D-16](#d-16--no-npm-commander-spellbook-client-dependency) minted — no npm `@space-cow-media/spellbook-client` dependency**, with matching entries in [§8](#8-out-of-scope) and a pointer addendum in [§4.4](#44-commander-spellbook). This is the **strongest** third-party client this project has evaluated and it clears four of [D-14](#d-14--no-npm-moxfield-api-dependency)'s five objections: first-party (published by SpaceCowMedia from the Commander Spellbook backend repo, generated from its OpenAPI schema), MIT, **zero runtime and peer dependencies**, version-locked to API 6.2.6, 152 versions with the latest published 2026-08-23, and a `Configuration` accepting both **`headers`** — the app-naming `User-Agent` requirement `moxfield-api` failed — and an injectable **`fetchApi`**. Rejected on four grounds particular to this codebase, of which one decides it: **it would not replace the in-house client, it would add a second idiom beside it**, since Scryfall name resolution ([§4.1.2](#412-batch-resolution)), Archidekt and Moxfield all need the in-house transport regardless. Plus [§3.4](#34-rate-limits-are-hard-constraints-not-guidance)'s lane not being reusable through its `middleware` hook, its throwing error model against [D-10](#d-10--tool-handlers-never-throw), and its generated variant type declaring the `prices` and `imageUri*` fields [CAP-02](#cap-02--combo-discovery) is forbidden to return. **Bundle cost is recorded as unmeasured, in those words** ([`dist/index.js`](../dist/index.js) is 562,952 bytes and the released bundle 113,631 today). | Recorded as a decision rather than left implicit because the package is good enough that a future session reading its npm page will reach for it and deserves a verdict rather than silence — the failure [§4.8.2](#482-the-npm-moxfield-api-package) exists to prevent for `moxfield-api`, and sharper here because this package genuinely looks right. The generated-type ground is the one worth carrying forward: hand-written wire shapes make [CAP-02](#cap-02--combo-discovery) criteria 6 and 7 **unviolatable at compile time**, where generated ones downgrade them to a test somebody must remember to run — and that is also what rules out the otherwise-attractive middle path of adopting the package as a *type-only* devDependency, which under `verbatimModuleSyntax` would have cost zero bundle bytes. The bundle figure was deliberately not guessed: esbuild tree-shakes ESM and the true delta may be negligible, but a released bundle never self-updates, so asserting an unmeasured number would be the wrong kind of confidence in the one artifact that cannot be recalled. |
| 2026-08-24 | **[§4.4](#44-commander-spellbook) gains a bulk-endpoint addendum correcting its own "606 MB" framing, and [§8](#8-out-of-scope) gains a matching rejection.** `variants.json.gz` is **27,390,889 bytes (26.1 MB)**, directly comparable to [§4.2](#42-scryfall-bulk-data)'s `oracle_cards` at 24.4 MB — so **size is not the reason to avoid it** and the original line must not be read as saying so. The real reasons: `/find-my-combos` performs deck matching **server-side**, so local use means reimplementing a matcher whose six buckets carry distinctions [CAP-02](#cap-02--combo-discovery) depends on; and the file is a **single JSON object, not JSONL**, needing a streaming parser or 606 MB resident where [§4.2](#42-scryfall-bulk-data)'s gzipped JSONL streams with neither. Recorded as useful for one thing: `timestamp` and `version` sit in the first ~100 bytes, so a ranged GET is a **sub-kilobyte staleness and API-version-drift check** — filed against [OQ-03](#oq-03--what-is-the-bulk-data-storage-strategy-and-when-is-it-introduced)'s open refresh-trigger half. The 2026-07-29 line is **left as written**. | A rejection resting on a wrong reason is worse than no rejection, because [§8](#8-out-of-scope) is written to be trusted as current: a session that finds the 26.1 MB file would correctly conclude the stated objection had been overtaken and might reasonably re-open the whole approach. Replacing the reason rather than the verdict is what makes the entry survive the next person who checks it. Appended rather than edited, per [§4](#4-external-dependencies)'s every-claim-is-dated property — the original observation was true, and only its sufficiency as an argument was not. |
| 2026-08-24 | **[CAP-02](#cap-02--combo-discovery)'s page-cap bullet corrected — it contradicted itself on upstream paging.** As first written it opened "the cap is never passed upstream", then noted Commander Spellbook exposes a true `offset`, then scoped the after-classification rule to `combo_find_deck` alone. Now split into two bullets stating the rule per tool: **`combo_search` sends `limit`/`offset` upstream** because `/variants/` returns one flat list where they cannot drop the answer asked for — and must, since that endpoint applies no default cap and one card's combos measure 533,840 characters with 476-combo cards projecting past 2.6 MB — while **`combo_find_deck` fetches the full result and caps after classification**, because its `limit` does not prioritize the combos a deck contains. A third bullet records that upstream paging **rests on `/variants/` ordering being stable across calls, which is unverified**, and binds the implementing slice to confirm it live before that path ships. No acceptance criterion changed: 8 already covered both tools and 10 was already scoped to `/find-my-combos`. | The contradiction was introduced the same day, in this document, and would have been read by whoever built it — most likely as a blanket prohibition, which would have meant a 533 KB transfer on every popular-card query against a source with no published rate limit that [§3.7](#37-undocumented-and-bot-protected-third-party-apis) tells this project to treat as fragile. Caught by the implementation-planning pass rather than by review, which is the argument for planning against a spec before building to it. The ordering caveat is recorded because upstream paging is only correct if the sequence is stable, and a drifting one repeats or skips combos **silently** — the same failure class as the `limit` trap the bullet above it exists to avoid. |
| 2026-08-25 | **Track A [Slice 15](./slices/TrackA-Slice15.md) landed the transport [CAP-02](#cap-02--combo-discovery) needs and none of the capability** (`d08777b`). New `src/http/client.ts` — [CAP-01](#cap-01--card-search)'s client parameterized by a plain-data source spec carrying the source name, the lane table and the error-`details` reader; [`src/scryfall/client.ts`](../src/scryfall/client.ts) reduced to that spec plus a thin factory, every export kept; new `src/spellbook/client.ts` at **one 500 ms lane** with its own reader for Commander Spellbook's Django-REST field-error map; a **POST** verb on the same queue, spacing and 429 backoff; `spellbookBaseUrl` added to [`src/config.ts`](../src/config.ts). **[CAP-02](#cap-02--combo-discovery) criteria 11 and 12 verified, and criterion 3's *client half* only — 3 is not verified outright**, its handler half being [Slice 16](./slices/TrackA-Slice16.md)'s. A dated **Progress note** on the block records that and leaves `Status` at `specified`. **Nothing is wired:** no tool is registered, [`src/index.ts`](../src/index.ts) and [`src/tools/register.ts`](../src/tools/register.ts) show an empty diff, `tools/list` still reports one tool, [`src/result.ts`](../src/result.ts) gained no `FailureCode`, and no npm dependency was added. Lane selection is now **first prefix match in declaration order**, replacing a lane-identity comparison that could not survive generalization. `npm test` **27 suites / 101 tests → 39 / 150**; `npm run typecheck` clean; `npm run acceptance` 13/13 live with no 429. **No `D-` was minted, [§2](#2-locked-decisions), [§3](#3-constraints) and [§4](#4-external-dependencies) are untouched, no [CAP-01](#cap-01--card-search) criterion changed status, and no open question was resolved — [OQ-05](#oq-05--do-commander-spellbook-or-archidekt-impose-rate-limits) is explicitly unmoved.** Evidence: [`docs/slices/TrackA-Slice15-results.md`](./slices/TrackA-Slice15-results.md). | [D-16](#d-16--no-npm-commander-spellbook-client-dependency) rejected the first-party npm client because it would not replace the in-house transport but sit beside it, leaving one source of three speaking a different error model, a different throttle and a different test harness — and a **hand-copied second client fails that test the same way**, so the only reading of that decision that survives contact with a second host is one transport pointed at two of them. Kept out of [Slice 16](./slices/TrackA-Slice16.md) because its correctness claim is *nothing observable changed*, which a diff carrying a new tool makes unfalsifiable: the evidence is [`tests/scryfall/client.test.ts`](../tests/scryfall/client.test.ts) passing with **one changed line** and all 101 pre-existing tests green against the extracted transport, run before a single new test was written. Three things are recorded because they are easy to get wrong later. **Lane selection is declaration order, not most-specific prefix** — a spec declaring `/cards` at 700 ms ahead of `/cards/search` at 50 ms routes `/cards/search` to 700, and a test pins it. **`npm test` does not typecheck** — `--experimental-strip-types` strips types without checking them, so making `ScryfallClient` an alias of the generic client left three test fakes broken with `npm test` still green; `npm run typecheck` is the check for any shared-interface change. And the Commander Spellbook `details` reader accepts a `string` or a `string[]` value and **drops `details` entirely for any other shape**, rather than reporting a half-understood error body — a reader that threw would convert a clean `bad_request` into the [D-10](#d-10--tool-handlers-never-throw) backstop, which reads as a server fault and discourages the retry that fixes it. The live acceptance pass took three attempts, and the two failures are recorded in the results rather than re-run out of existence: both were a first-call `fetch` rejection ~10.7 s into a freshly spawned server, investigated to an intermittent connection failure **not attributable to the refactor**, whose GET path is byte-identical to what shipped. |
| 2026-08-25 | **Track A [Slice 16](./slices/TrackA-Slice16.md) landed `combo_search` — half of [CAP-02](#cap-02--combo-discovery), whose `Status` stays `specified`** (`4bf697d`). Three new modules: `src/spellbook/types.ts`, whose hand-written wire shapes **omit** `prices` and every `imageUri*` field, making criteria 6 and 7 compile-time facts; `src/spellbook/combos.ts`, carrying the normalized combo shape every later consumer reads plus format resolution over Commander Spellbook's **16** legality keys, which are not Scryfall's 23; and `src/tools/combo-search.ts`, one upstream request per call at `limit=40`, `offset=(page-1)*40` and `count=true` with a defensive cap at 40. [`src/tools/register.ts`](../src/tools/register.ts) takes a `Clients` bundle and each handler still receives the one client it needs; `tools/list` reports **two** tools. **Criteria 2, 6 and 7 verified in full, criterion 3's handler half — so 3 is now verified in both halves — and the `combo_search` half of criteria 1, 8 and 14. No criterion is marked delivered**, and criterion 10 is entirely [Slice 17](./slices/TrackA-Slice17.md)'s. A second dated **Progress note** records that on the block; the **third cap bullet's ordering caveat is discharged** by a live probe — 80 distinct ids in 80 slots across pages 1 and 2, zero overlap, neither fallback needed; and [§4.4.1](#441-the-combo-payload-is-enormous--measured) gains a dated addendum measuring the shipped trim: page 1 at 40,202 characters live and 40,096 on the 40-variant fixture, whose 173,135 raw makes that a **76.8%** reduction inside the band already recorded, against **page 2 at 63,688 and 1,592 per combo** — above both the 930–1,236 band and the "under 50,000" page budget. `npm test` **39 suites / 150 tests → 56 / 210**; `npm run typecheck` clean; `npm run acceptance` 13/13 live with no 429. **No `D-` was minted, [§2](#2-locked-decisions) and [§3](#3-constraints) are untouched, no [CAP-01](#cap-01--card-search) criterion changed status, and no open question was resolved** — [OQ-05](#oq-05--do-commander-spellbook-or-archidekt-impose-rate-limits) and [OQ-14](#oq-14--how-should-commander-spellbook-query-syntax-be-surfaced-to-the-model) both stay open. Evidence: [`docs/slices/TrackA-Slice16-results.md`](./slices/TrackA-Slice16-results.md). | Splitting the capability across two slices is what keeps each half's claim falsifiable, and the price of that is a block with partly ticked criteria — so the status is deliberately **not** moved: a half-built capability carrying a delivered status is the reporting failure this document has already paid to unpick once, in the 2026-08-08 row above. The page-budget contradiction is the most useful line here. [§4.4.1](#441-the-combo-payload-is-enormous--measured) already warned that per-combo cost tracks how many cards a combo uses, so a budget derived from one query was always an estimate; the honest record is therefore a dated measurement beside the original rather than a quietly corrected number, and **the page-cap bullet's own "under 50,000" text is left as written — whether to amend it in place is this document's owner's call, not a closeout edit.** Three inversions are recorded because porting [CAP-01](#cap-01--card-search)'s rules is the obvious mistake here: zero matches arrives as HTTP **200** while a **404 stays a failure**, so the deliberate 404-as-empty mapping must not be copied; [Slice 14](./slices/TrackA-Slice14.md)'s 88-card half-page arithmetic does not transfer where a true `offset` exists; and combo legality is **one boolean**, not a map and not Scryfall's `"legal"` strings — guarded so that a legality key upstream dropped returns a structured failure rather than reading as `false`, which [§3.6](#36-error-surface) forbids and which this capability exists partly to avoid. [OQ-14](#oq-14--how-should-commander-spellbook-query-syntax-be-surfaced-to-the-model) is left open on purpose and is now *concrete* rather than answered: the tool exists, so [OQ-01](#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model)'s measurement-against-a-baseline method is finally available, and recording an impression in its place would spend the question without answering it. Two verification steps in [`docs/slices/TrackA-Slice16.md`](./slices/TrackA-Slice16.md) are wrong as written and its acceptance criterion 8 contradicts its own requirement 7 (requirement 7 wins, case-insensitive matching resolving `standardbrawl` rather than refusing it); all three are that document's text, and no [CAP-02](#cap-02--combo-discovery) criterion is affected. |
| 2026-08-25 | **[CAP-02](#cap-02--combo-discovery)'s page cap amended from 40 combos to 20, on measurement, and criterion 8's number with it.** The 40 was derived from one query at 1,236 characters per combo. **577 combos sampled across 15 queries** — using Commander Spellbook's own `cards>N`, `steps>N`, `results>N` and `prerequisites>N` operators, all four confirmed real against `/explain-query` — put that near the **cheap** end: p50 **1,390**, p99 **2,530**, max **4,421**, sampled mean **1,393**, which is itself above the 930–1,236 band. Per-combo cost tracks how many cards a combo uses. At 40, the ordinary query `cards>5 steps>5` returned a measured **99,311**-character tool result, **85% of the 116,626** that breached a harness ceiling in issue #25; at 20 it returns **58,240**, and `card:"Thassa's Oracle"` returns **16,903**. [§4.4.1](#441-the-combo-payload-is-enormous--measured) gains a **second** dated addendum carrying the distribution and the before/after figures, and the first addendum stands as written. The [CAP-02](#cap-02--combo-discovery) page-cap bullet is **amended in place** rather than annotated, and a dated Progress-note addendum records why. **`Status` stays `specified`, no criterion changed verification state** — criterion 8 changed its *number*, not its kind, and is still verified in its `combo_search` half only. `PAGE_SIZE` in `src/tools/combo-search.ts`, the tool description and the input schema all move together; `npm test` stays 56 suites / 210 tests. | The bullet is amended in place rather than left with a dated correction beside it because, unlike [§4](#4-external-dependencies)'s research record, a [§5](#5-capabilities) capability bullet is **instruction to the implementer** — a reader who finds "at most 40 combos" there and a contradicting addendum elsewhere has to guess which binds, and the code can only implement one. The date-stamped reasoning survives in the bullet, the Progress note and [§4.4.1](#441-the-combo-payload-is-enormous--measured). Sizing is by **margin, not by target**: 116,626 is a value known to FAIL rather than the limit, and the true ceiling is unknown and lower, so the question asked was not "what fits 50,000" but "what still fits when every combo on the page is a 10-card one". That rejected 25, whose maximum-cost page reaches 95% of a known-bad figure, and it is why the realistic worst page at 20 (~58,000) is accepted despite exceeding the original 50,000 aspiration — a fixed count cap cannot honour that aspiration against 5.7× cost variance without going to 15 and tripling the page count. A **byte-aware** cap was considered and rejected for now: it adapts to the variance, but nothing may strand a combo behind no reachable page ([Slice 14](./slices/TrackA-Slice14.md)'s lesson), so it requires paging by explicit offset rather than page number — a contract change to the very shape [Slice 17](./slices/TrackA-Slice17.md) is about to consume. Re-sizing was **safe only because** Commander Spellbook exposes a true `offset`: the same change against Scryfall's offsetless `page` would have stranded cards, which is exactly why [Slice 14](./slices/TrackA-Slice14.md) could not simply pick a smaller number. |
| 2026-08-25 | **[CAP-02](#cap-02--combo-discovery)'s page cap became a BYTE BUDGET and paging moved to offsets — this supersedes the 40 → 20 row above, which stands as the record of a step that really shipped.** A fixed count is the wrong instrument for a source whose per-combo cost spans **547 to 4,421** characters, a 5.7× spread: 40 was unsafe (`cards>5 steps>5` measured **99,311**) and 20 starved an ordinary `card:"…"` query of two thirds of the combos that would have fit. `combo_search` now fills a page to **50,000** characters, fetching **60** variants upstream, and reports **`next_offset`**; `ComboSearchParams.page` became `offset`. Two probes removed the objection recorded the same day: `/variants/` **ignores** `fields=`, `fields[]=`, `only=` and `omit=`, so over-fetching adds no waste this capability was not already paying, and responses are **gzipped at ~12:1** (20 variants 7.1 KB on the wire, 60 variants 20.4 KB), so fetching more *reduces* the request rate [§3.4](#34-rate-limits-are-hard-constraints-not-guidance) and [§3.7](#37-undocumented-and-bot-protected-third-party-apis) actually constrain — a 96-combo sweep went from 5 requests to **3**. Measured live through the shipped tool: `card:"Thassa's Oracle"` 96 combos in **3 pages of 47, 30 and 19**; `cards>5 steps>5` 41 in **3 pages of 16, 23 and 2**; largest page **49,473**; every combo reached exactly once. [§4.4.1](#441-the-combo-payload-is-enormous--measured) gains a **third** dated addendum and both earlier ones stand. The page-cap bullet is amended in place and criterion 8 reworded to name the budget and the offset contract. **`Status` stays `specified` and no criterion changed verification state.** `npm test` 56 suites / **215** tests. | Done now rather than later because [Slice 17](./slices/TrackA-Slice17.md) is about to consume this paging shape: changing it today touches one tool, changing it after 17 lands touches two plus both test suites. That inverts the usual ship-and-revisit instinct, and it is the whole reason the question was asked before the PR rather than after. The decisive evidence was **measuring instead of assuming**: the wire-traffic objection that deferred this in the row above was stated without checking whether responses were compressed, and they are — at 12:1 the objection is ~13 KB per call and points the other way once request *rate* is the thing being protected. Recorded because an argument retired by measurement is worth more than one that was never made. **Page size varying within a single query** — 47, then 30, then 19 as later combos use more cards — is the observation that makes a count indefensible rather than merely suboptimal. And one guard is load-bearing: a combo larger than the whole budget is **still returned**, because a page of zero leaves `next_offset` equal to `offset` and the caller pages forever; an oversized response is a bad page, a non-advancing offset is an infinite loop. |
| 2026-08-25 | **Track A [Slice 17](./slices/TrackA-Slice17.md) landed `combo_find_deck` and [CAP-02](#cap-02--combo-discovery) is DELIVERED** — `Status` `specified` → `delivered`, all fourteen criteria verified, and [§6](#6-phases)'s Phase 2 entry updated from "not built". The capability gained a dated delivery note; [§4.1.2](#412-batch-resolution) gained a dated addendum recording that a `name` identifier **rejects the combined `Front // Back` form** of a double-faced card while accepting either face alone. [OQ-05](#oq-05--do-commander-spellbook-or-archidekt-impose-rate-limits), [OQ-06](#oq-06--is-commander-spellbooks-combo-data-licensed-as-distinct-from-its-code) and [OQ-14](#oq-14--how-should-commander-spellbook-query-syntax-be-surfaced-to-the-model) each gained a dated paragraph and **all three stay open**. No `D-` minted; [§2](#2-locked-decisions) and [§3](#3-constraints) untouched. | The three upstream behaviours this tool exists to defeat are all silent, so the shape follows from them rather than from taste: `limit` on `/find-my-combos` **does not prioritize the combos the deck contains**, so the cap is applied after classification and never sent upstream; an unrecognized card name is **ignored with an HTTP 200 and no signal from any endpoint**, which is the only reason the capability touches Scryfall at all; and a request with no deck returns the entire combo corpus as near-misses, so an empty decklist is refused before any call. **The live run substituted a different deck and measured its own raw figure beside its shaped one** rather than comparing a shaped number against [§4.4.1](#441-the-combo-payload-is-enormous--measured)'s 640,684 — the 94-card list there was not recoverable from a captured response, and a cross-deck ratio would have been a number that looks like evidence and is not. The three open questions are recorded as shipped-with-open rather than left silent, because two of them resolve only when a third party replies and the third needs an eval run that a build slice would take badly. |
| 2026-08-25 | **The Commander Spellbook admins replied — [OQ-06](#oq-06--is-commander-spellbooks-combo-data-licensed-as-distinct-from-its-code) CLOSED, [OQ-05](#oq-05--do-commander-spellbook-or-archidekt-impose-rate-limits) answered for the Commander Spellbook third only, and no code changed.** [§4.4](#44-commander-spellbook) gains a dated addendum carrying the reply: anonymous use sanctioned, *"few http calls per user interaction"*, an explicit request to **refrain from bulk-exporting through the paginated API** with the bulk JSON file named as the sanctioned route instead, and the app-naming `User-Agent` confirmed as the source's own ask. [CAP-02](#cap-02--combo-discovery) gains a dated open-question note; `Status` stays `delivered` and no criterion moved. | **The reply is a usage SHAPE, not a rate, and conflating the two would be the mistake here.** No requests-per-second figure was given and no rate-limit header exists, so [§3.7](#37-undocumented-and-bot-protected-third-party-apis)'s "self-throttle conservatively where no limit is published" is not discharged and **the 500 ms lane does not move** — what changed is that it is now a chosen conservatism against a source known to be friendly rather than a default against one that had said nothing. [OQ-05](#oq-05--do-commander-spellbook-or-archidekt-impose-rate-limits) covers **three** sources and one has answered, so it is not closed; Archidekt and Moxfield are unmoved. [OQ-06](#oq-06--is-commander-spellbooks-combo-data-licensed-as-distinct-from-its-code) closes as **permitted, not licensed**: permission to consume is not a grant to redistribute, and a later capability that stores or ships combo data needs its own ask. The admins recommending `@space-cow-media/spellbook-client` **does not reopen** [D-16](#d-16--no-npm-commander-spellbook-client-dependency) — that decision rested on this codebase's zero-runtime-dependency bundle and its deliberately incomplete wire types, never on doubt about the package, and [§2](#2-locked-decisions) is locked. |
| 2026-08-25 | **[OQ-14](#oq-14--how-should-commander-spellbook-query-syntax-be-surfaced-to-the-model)'s plugin-side half measured against a no-help baseline — and it stays open.** The [OQ-01](#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) method run one source over now that [`combo_search`](../src/tools/register.ts) exists ([Slice 16](./slices/TrackA-Slice16.md)): a clean-room subject with no `Skill` tool, 12 cases from [`evals/combo-evals.json`](../evals/combo-evals.json) × two configurations = 24 subagents dispatched one at a time, ~48 sequential live calls, no 429. The `spellbook-combo-craft` skill lifts expectations **37/46 → 45/46** and fully-passed cases **7/12 → 11/12**, flipping four cases (4, 5, 6, 10) fail→pass — each of them either query craft the tool description names no operator for (`result:`, `steps:`, `commander:`, `ci:`) or recovery from a loud upstream 400. It changes **nothing** on tool selection or paging, where the baseline was already correct — the same result [OQ-01](#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) reached for [CAP-01](#cap-01--card-search). **Neither half is resolved:** the plugin-side skill-versus-reference choice belongs to [`docs/PLUGIN-PRD.md`](./PLUGIN-PRD.md), and the tool-description half stays open here — now with data pointing at the [`combo_search`](../src/tools/register.ts) description, which names `card:"…"` but not the four operators above, as the strongest lever. **Nothing was implemented and no [CAP-02](#cap-02--combo-discovery), [CAP-01](#cap-01--card-search) or [`PC-01`](./PLUGIN-PRD.md#pc-01--scryfall-query-craft) criterion changed status**; the skill and eval harness are uncommitted working-tree artifacts. Evidence: [`docs/slices/OQ14-combo-eval-results.md`](./slices/OQ14-combo-eval-results.md). | The measurement method [OQ-14](#oq-14--how-should-commander-spellbook-query-syntax-be-surfaced-to-the-model)'s 2026-08-24 open-row named could not run until the tool existed, and [Slice 16](./slices/TrackA-Slice16.md) left it explicitly un-run; running it turns *concrete* into *evidenced* without spending the question. Recorded as a measurement rather than an answer because [OQ-14](#oq-14--how-should-commander-spellbook-query-syntax-be-surfaced-to-the-model) asks for a decision — enrich the description, keep the skill, or both — and the data informs that decision without being it: the case-10 recovery loop and the zero-match-as-success handling are the part a one-line schema description cannot absorb, so the skill is not made redundant even under the richest description the data argues for. |

---

*Manabase MTG MCP Server is unofficial Fan Content permitted under the Fan Content Policy.
Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of
the Coast. ©Wizards of the Coast LLC. Card data and prices via
[Scryfall](https://scryfall.com). Combo data via
[Commander Spellbook](https://commanderspellbook.com).*
