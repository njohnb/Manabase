# MTG MCP Server — PRD

> **Reading this cold?** Sections 2 and 3 are binding. Section 4 is the research record —
> every claim there is dated and marked verified or inferred. Section 5 opens with the
> capability template; adding a capability means appending a CAP block and updating
> sections 6, 7, and 9. Nothing else.

**Document status:** foundation established 2026-07-29. One capability specified
([CAP-01](#cap-01--card-search)) and **delivered 2026-08-03** — all twelve acceptance criteria
verified ([§9](#9-revision-log)). Eight capabilities queued and unassigned.

---

## 1. Overview

**Problem.** Magic: The Gathering deckbuilding research is spread across tools that don't talk
to each other. Card search lives on Scryfall, combos on Commander Spellbook, decklists on
Archidekt, rules in a 975 KB text file. Answering an ordinary question — "what one-mana
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

### 4.7 WotC Fan Content Policy

**Date verified:** 2026-07-29
**URL:** `https://company.wizards.com/en/legal/fancontentpolicy`

Not a data source — a constraint that governs the whole project, and the actual origin of the
attribution obligation. See [§3.3](#33-legal-and-terms-of-service) for the verbatim disclaimer and [§3.1](#31-distribution-and-install-friction)/[§3.3](#33-legal-and-terms-of-service) for the
non-commercial and non-paywall implications. Scryfall and Commander Spellbook both operate
under this policy and both carry the disclaimer, which is confirmation that it is the right
frame for this project too. **[verified]**

---

## 5. Capabilities

### Capability block template

Reproduce this schema for every new capability. Do not modify it.

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

**IDs are stable and never reused.** Adding a capability means appending a CAP block and
updating [§6](#6-phases), [§7](#7-open-questions), and [§9](#9-revision-log) — nothing else.

---

### CAP-01 — Card search

- **Status:** specified
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
- **Open questions:** [OQ-01](#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) (how to surface syntax), [OQ-02](#oq-02--how-verbose-should-a-search-result-be) (result verbosity vs. context
  budget), [OQ-09](#oq-09--should-price-resolution-fall-back-to-eur-when-no-usd-price-exists) (EUR fallback when no USD price exists — opened by the acceptance pass).
- **Delivery note (2026-08-03).** All twelve acceptance criteria are verified: 2–9 live against
  Scryfall, and 1, 10, 11, 12 at unit level. Criterion 12 is unit-level permanently — provoking
  a real 429 to observe it is what [§3.4](#34-rate-limits-are-hard-constraints-not-guidance)
  forbids. The **Status** field above is left at `specified` because the [§5](#5-capabilities)
  template offers no delivered state; [§6](#6-phases) and [§9](#9-revision-log) carry the
  delivery record.

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

**Eight capabilities are queued and unassigned.** Phase assignment happens in the sessions
that specify them, not here. They are, with the dependencies already visible from [§4](#4-external-dependencies):

| Queued capability | Primary source | Notes from research |
|---|---|---|
| Combo discovery | Commander Spellbook `/find-my-combos`, `/variants/` ([§4.4](#44-commander-spellbook)) | the primitive already exists and is anonymous |
| Archidekt deck reading | Archidekt `GET /api/decks/{id}/` ([§4.5](#45-archidekt)) | works unauth; must handle the 404 masking |
| Arena-format decklist export | none beyond [CAP-01](#cap-01--card-search) / deck reading | pure transformation |
| Decklist pricing | Scryfall `POST /cards/collection` ([§4.1.2](#412-batch-resolution)) | 75/request; inherits [§4.1.3](#413-price-fields--three-verified-traps) price traps |
| Budget alternatives | Scryfall search + collection | depends on [CAP-01](#cap-01--card-search) and pricing |
| Archidekt deck writing | Archidekt write API ([§4.5](#45-archidekt)) | **last** per [D-09](#d-09--archidekt-writes-land-last); [OQ-04](#oq-04--what-is-the-behavior-and-blast-radius-of-archidekts-write-api) unresolved |
| Tag discovery | Scryfall `oracle_tags` / `art_tags` bulk ([§4.3](#43-scryfall-tags-api)) | first capability needing bulk + local storage |
| Comprehensive Rules lookup | WotC CR TXT ([§4.6](#46-comprehensive-rules-wizards-of-the-coast)) | first capability needing runtime fetch + cache ([D-08](#d-08--comprehensive-rules-fetched-at-runtime-never-bundled)) |

Two observations that should inform later phase assignment. **Tag discovery and Rules lookup
are the first capabilities that require local persistence** — everything before them is
stateless request/response, so they carry setup cost the earlier ones don't. And **Archidekt
deck writing should be strictly last** ([D-09](#d-09--archidekt-writes-land-last)), after deck reading has been stable long
enough to trust.

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

### OQ-03 — What is the bulk-data storage strategy, and when is it introduced?

`oracle_tags`/`art_tags` (tag discovery) and the CR text (rules lookup) both need local
persistence. Where does it live on a user's machine, what is the refresh trigger, and does
first run block on a download? Under [D-01](#d-01--distribution-local-package-over-stdio) this is an install-friction question, so it is
product-relevant, not purely design.
*Resolves by:* specifying the tag-discovery capability, which is the first to need it.

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

**Bundling the Comprehensive Rules text in the package.** Rejected by [D-08](#d-08--comprehensive-rules-fetched-at-runtime-never-bundled) on Fan Content
Policy grounds.

**Any paywall, subscription, survey, Discord-join, or channel-follow gate on card data.**
Prohibited by Scryfall's data-use rules ([§3.3](#33-legal-and-terms-of-service)) and by the Fan Content Policy's
non-commercial terms. Not a product option.

**Deck editing outside Archidekt.** No other deck platform is in scope. Archidekt writes are
last ([D-09](#d-09--archidekt-writes-land-last)); other platforms are not queued at all.

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
| 2026-08-04 | **[CAP-01](#cap-01--card-search) recorded as delivered** across Track A Slices 1–6 (PRs #2–#7), and the research record reconciled against what the build found. [§4.1.1](#411-search-endpoint) gains a dated re-verification of the operator counts (the 2026-07-29 figures are kept, not overwritten). [§4.1.3](#413-price-fields--three-verified-traps) gains an addendum widening trap 3: the digital printing now wins a plain `/cards/search` rollup, not only `/cards/named`, and no paper Black Lotus printing carries USD any more. Opened **[OQ-09](#oq-09--should-price-resolution-fall-back-to-eur-when-no-usd-price-exists)** (EUR fallback). Recorded status notes on [OQ-01](#oq-01--how-should-scryfall-syntax-be-surfaced-to-the-model) (compact description shipped, unmeasured) and [OQ-02](#oq-02--how-verbose-should-a-search-result-be) (default field set exists; `legalities` passes through untrimmed). | The build is the first thing to test this document's claims against reality, and it found two upstream data changes and one gap the spec did not anticipate. Recording drift as dated addenda rather than edits keeps [§4](#4-external-dependencies)'s "every claim is dated" property intact — a future session can see both what was true in July and what is true now. OQ-09 exists because the honest `no-price-data` answer for Black Lotus is correct against the spec and unsatisfying to a user, which is a specification question rather than a defect. |
| 2026-08-03 | CAP-01 live acceptance pass: criteria 1–12 verified (criteria 1, 10, 11, 12 at unit level; 2–9 live via `scripts/cap01-live.mjs`). Live totals: regex 1,555, `otag:ramp` 2,274, `function:removal` 6,405, `art:squirrel` 194. Drift from the 2026-07-29 research record: (a) `!"Black Lotus"` now returns the MTGO Vintage Masters printing by default rather than a paper printing — correctly reported as `digital-only`, not a bare no-price; (b) no paper Black Lotus printing carries a USD price any more (EUR only), so criterion 6's paper-price half is evidenced by a substitute `usd>=1 game:paper` probe. No code changes were required. Results: `docs/slices/TrackA-Slice6-results.md`. | Track A Slice 6 (`docs/DEV-ROADMAP.md`) — closes the server half of Phase 1. |

---

*Manabase MTG MCP Server is unofficial Fan Content permitted under the Fan Content Policy.
Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of
the Coast. ©Wizards of the Coast LLC. Card data and prices via
[Scryfall](https://scryfall.com). Combo data via
[Commander Spellbook](https://commanderspellbook.com).*
